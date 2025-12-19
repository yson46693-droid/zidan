<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once 'config.php';

// التحقق من وجود الجداول وإنشاؤها إذا كانت مفقودة
if (!dbTableExists('sales') || !dbTableExists('sale_items')) {
    require_once __DIR__ . '/setup.php';
    try {
        $conn = getDBConnection();
        if ($conn) {
            $conn->query("SET FOREIGN_KEY_CHECKS = 0");
            
            // إنشاء جدول sales إذا كان مفقوداً
            if (!dbTableExists('sales')) {
                $createSales = "
                    CREATE TABLE IF NOT EXISTS `sales` (
                      `id` varchar(50) NOT NULL,
                      `sale_number` varchar(50) NOT NULL,
                      `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `tax` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `customer_name` varchar(255) DEFAULT NULL,
                      `customer_phone` varchar(50) DEFAULT NULL,
                      `created_at` datetime NOT NULL,
                      `updated_at` datetime DEFAULT NULL,
                      `created_by` varchar(50) DEFAULT NULL,
                      PRIMARY KEY (`id`),
                      UNIQUE KEY `sale_number` (`sale_number`),
                      KEY `idx_sale_number` (`sale_number`),
                      KEY `idx_created_at` (`created_at`),
                      KEY `idx_created_by` (`created_by`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                $conn->query($createSales);
            }
            
            // إنشاء جدول sale_items إذا كان مفقوداً
            if (!dbTableExists('sale_items')) {
                $createSaleItems = "
                    CREATE TABLE IF NOT EXISTS `sale_items` (
                      `id` varchar(50) NOT NULL,
                      `sale_id` varchar(50) NOT NULL,
                      `item_type` enum('spare_part','accessory','phone','inventory') NOT NULL,
                      `item_id` varchar(50) NOT NULL,
                      `item_name` varchar(255) NOT NULL,
                      `quantity` int(11) NOT NULL DEFAULT 1,
                      `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `total_price` decimal(10,2) NOT NULL DEFAULT 0.00,
                      `created_at` datetime NOT NULL,
                      PRIMARY KEY (`id`),
                      KEY `idx_sale_id` (`sale_id`),
                      KEY `idx_item_type` (`item_type`),
                      KEY `idx_item_id` (`item_id`),
                      CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                $conn->query($createSaleItems);
            }
            
            $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        }
    } catch (Exception $e) {
        error_log('خطأ في إنشاء جداول POS: ' . $e->getMessage());
    }
}

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة المبيعات
if ($method === 'GET') {
    checkAuth();
    
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    
    $query = "SELECT s.*, u.name as created_by_name 
              FROM sales s 
              LEFT JOIN users u ON s.created_by = u.id 
              WHERE 1=1";
    $params = [];
    
    if ($startDate) {
        $query .= " AND DATE(s.created_at) >= ?";
        $params[] = $startDate;
    }
    
    if ($endDate) {
        $query .= " AND DATE(s.created_at) <= ?";
        $params[] = $endDate;
    }
    
    $query .= " ORDER BY s.created_at DESC";
    
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
    if ($limit > 0) {
        $query .= " LIMIT ?";
        $params[] = $limit;
    }
    
    $sales = dbSelect($query, $params);
    
    if ($sales === false) {
        response(false, 'خطأ في قراءة المبيعات', null, 500);
    }
    
    // جلب عناصر كل عملية بيع
    foreach ($sales as &$sale) {
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        $sale['items'] = $items ? $items : [];
    }
    
    response(true, '', $sales);
}

// إنشاء عملية بيع جديدة
if ($method === 'POST') {
    checkAuth();
    if (!isset($data['_method'])) {
        $data = getRequestData();
    }
    
    $items = $data['items'] ?? [];
    $totalAmount = floatval($data['total_amount'] ?? 0);
    $discount = floatval($data['discount'] ?? 0);
    $tax = floatval($data['tax'] ?? 0);
    $finalAmount = floatval($data['final_amount'] ?? 0);
    $customerName = trim($data['customer_name'] ?? '');
    $customerPhone = trim($data['customer_phone'] ?? '');
    
    if (empty($items) || !is_array($items)) {
        response(false, 'يجب إضافة عناصر للبيع', null, 400);
    }
    
    if ($finalAmount <= 0) {
        response(false, 'المبلغ الإجمالي يجب أن يكون أكبر من الصفر', null, 400);
    }
    
    $session = checkAuth();
    $saleId = generateId();
    
    // إنشاء رقم فاتورة فريد
    $saleNumber = 'SALE-' . date('Ymd') . '-' . substr(uniqid(), -6);
    
    // التحقق من عدم تكرار رقم الفاتورة
    $existing = dbSelectOne("SELECT id FROM sales WHERE sale_number = ?", [$saleNumber]);
    if ($existing) {
        $saleNumber = 'SALE-' . date('Ymd') . '-' . substr(uniqid(), -8);
    }
    
    dbBeginTransaction();
    
    try {
        // إنشاء عملية البيع
        $result = dbExecute(
            "INSERT INTO sales (id, sale_number, total_amount, discount, tax, final_amount, customer_name, customer_phone, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$saleId, $saleNumber, $totalAmount, $discount, $tax, $finalAmount, $customerName, $customerPhone, $session['user_id']]
        );
        
        if ($result === false) {
            throw new Exception('خطأ في إنشاء عملية البيع');
        }
        
        // إضافة عناصر البيع وتحديث الكمية في المخزون
        foreach ($items as $item) {
            $itemId = generateId();
            $itemType = trim($item['item_type'] ?? '');
            $originalItemId = trim($item['item_id'] ?? '');
            $itemName = trim($item['item_name'] ?? '');
            $quantity = intval($item['quantity'] ?? 1);
            $unitPrice = floatval($item['unit_price'] ?? 0);
            $totalPrice = floatval($item['total_price'] ?? 0);
            
            if (empty($itemType) || empty($originalItemId) || empty($itemName)) {
                continue;
            }
            
            // إضافة عنصر البيع
            $itemResult = dbExecute(
                "INSERT INTO sale_items (id, sale_id, item_type, item_id, item_name, quantity, unit_price, total_price, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [$itemId, $saleId, $itemType, $originalItemId, $itemName, $quantity, $unitPrice, $totalPrice]
            );
            
            if ($itemResult === false) {
                throw new Exception('خطأ في إضافة عنصر البيع');
            }
            
            // تحديث الكمية في المخزون
            if ($itemType === 'spare_part') {
                // لقطع الغيار، نتحقق من الكمية في spare_part_items
                // لكن في POS نبيع القطع نفسها، لذا سنحتاج لتحديث الكمية في الجدول المناسب
                // يمكن تخطي هذا إذا كان النظام لا يتبع الكمية لقطع الغيار
            } elseif ($itemType === 'accessory') {
                // تحديث كمية الإكسسوارات
                $updateResult = dbExecute(
                    "UPDATE accessories SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
                    [$quantity, $originalItemId, $quantity]
                );
                if ($updateResult === false) {
                    // لا نوقف العملية، فقط نسجل تحذير
                    error_log("تحذير: فشل تحديث كمية الإكسسوار: $originalItemId");
                }
            } elseif ($itemType === 'phone') {
                // للهواتف، عادة ما يكون الكمية 1 فقط
                // يمكن تخطي التحديث أو حذف الهاتف من المخزون
            } elseif ($itemType === 'inventory') {
                // تحديث كمية المخزون القديم
                $updateResult = dbExecute(
                    "UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
                    [$quantity, $originalItemId, $quantity]
                );
                if ($updateResult === false) {
                    error_log("تحذير: فشل تحديث كمية المخزون: $originalItemId");
                }
            }
        }
        
        dbCommit();
        
        // جلب عملية البيع الكاملة
        $sale = dbSelectOne(
            "SELECT s.*, u.name as created_by_name 
             FROM sales s 
             LEFT JOIN users u ON s.created_by = u.id 
             WHERE s.id = ?",
            [$saleId]
        );
        
        if ($sale) {
            $saleItems = dbSelect(
                "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
                [$saleId]
            );
            $sale['items'] = $saleItems ? $saleItems : [];
        }
        
        response(true, 'تم إنشاء عملية البيع بنجاح', $sale);
        
    } catch (Exception $e) {
        dbRollback();
        response(false, $e->getMessage(), null, 500);
    }
}

// حذف عملية بيع (للمسؤولين فقط)
if ($method === 'DELETE') {
    checkPermission('admin');
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف عملية البيع مطلوب', null, 400);
    }
    
    $sale = dbSelectOne("SELECT id FROM sales WHERE id = ?", [$id]);
    if (!$sale) {
        response(false, 'عملية البيع غير موجودة', null, 404);
    }
    
    // حذف العناصر أولاً (CASCADE سيتولى ذلك تلقائياً)
    dbExecute("DELETE FROM sale_items WHERE sale_id = ?", [$id]);
    $result = dbExecute("DELETE FROM sales WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف عملية البيع', null, 500);
    }
    
    response(true, 'تم حذف عملية البيع بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

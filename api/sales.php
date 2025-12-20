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
    
    // إذا كان هناك sale_id محدد، جلب فاتورة واحدة فقط
    $saleId = $_GET['sale_id'] ?? null;
    if ($saleId) {
        $sale = dbSelectOne(
            "SELECT s.*, u.name as created_by_name 
             FROM sales s 
             LEFT JOIN users u ON s.created_by = u.id 
             WHERE s.id = ?",
            [$saleId]
        );
        
        if (!$sale) {
            response(false, 'الفاتورة غير موجودة', null, 404);
            return;
        }
        
        // جلب عناصر الفاتورة
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$saleId]
        );
        $sale['items'] = (is_array($items) && count($items) > 0) ? $items : [];
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            $sale['sale_number'] = $sale['id'];
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
        
        // التأكد من وجود customer_id
        if (empty($sale['customer_id'])) {
            // محاولة البحث عن العميل برقم الهاتف
            if (!empty($sale['customer_phone'])) {
                $customer = dbSelectOne(
                    "SELECT id FROM customers WHERE phone = ? LIMIT 1",
                    [$sale['customer_phone']]
                );
                if ($customer) {
                    $sale['customer_id'] = $customer['id'];
                    // تحديث الفاتورة في قاعدة البيانات
                    dbExecute(
                        "UPDATE sales SET customer_id = ? WHERE id = ?",
                        [$customer['id'], $saleId]
                    );
                }
            }
        }
        
        response(true, '', $sale);
        return;
    }
    
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
        // التأكد من وجود sale id
        if (empty($sale['id'])) {
            continue;
        }
        
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        $sale['items'] = (is_array($items) && count($items) > 0) ? $items : [];
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            $sale['sale_number'] = $sale['id'];
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
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
    $customerId = trim($data['customer_id'] ?? '');
    $customerName = trim($data['customer_name'] ?? '');
    $customerPhone = trim($data['customer_phone'] ?? '');
    
    if (empty($items) || !is_array($items)) {
        response(false, 'يجب إضافة عناصر للبيع', null, 400);
    }
    
    if ($finalAmount <= 0) {
        response(false, 'المبلغ الإجمالي يجب أن يكون أكبر من الصفر', null, 400);
    }
    
    // التحقق من بيانات العميل (مطلوبة)
    if (empty($customerName)) {
        response(false, 'اسم العميل مطلوب', null, 400);
    }
    
    if (empty($customerPhone)) {
        response(false, 'رقم هاتف العميل مطلوب', null, 400);
    }
    
    // التحقق من صحة رقم الهاتف (يجب أن يكون على الأقل 8 أرقام)
    if (strlen($customerPhone) < 8) {
        response(false, 'رقم الهاتف غير صحيح (يجب أن يكون 8 أرقام على الأقل)', null, 400);
    }
    
    // إذا لم يكن هناك customer_id، البحث عن عميل موجود بنفس رقم الهاتف
    if (empty($customerId)) {
        $existingCustomer = dbSelectOne(
            "SELECT id FROM customers WHERE phone = ? LIMIT 1",
            [$customerPhone]
        );
        
        if ($existingCustomer) {
            $customerId = $existingCustomer['id'];
        }
    } else {
        // التحقق من وجود العميل في قاعدة البيانات
        $customerExists = dbSelectOne(
            "SELECT id FROM customers WHERE id = ?",
            [$customerId]
        );
        
        if (!$customerExists) {
            // إذا لم يوجد العميل، البحث عن عميل آخر بنفس رقم الهاتف
            $existingCustomer = dbSelectOne(
                "SELECT id FROM customers WHERE phone = ? LIMIT 1",
                [$customerPhone]
            );
            
            if ($existingCustomer) {
                $customerId = $existingCustomer['id'];
            } else {
                // إذا لم يوجد عميل، إنشاء عميل جديد
                // سيتم الحصول على $session لاحقاً في السطر 206
                $newCustomerId = generateId();
                // سنحتاج إلى $session لاحقاً، لذا سننشئ العميل بعد الحصول على $session
            }
        }
    }
    
    $session = checkAuth();
    
    // التأكد من وجود customer_id - هذا إلزامي
    // إذا لم يكن هناك customer_id، البحث عن عميل موجود بنفس رقم الهاتف
    if (empty($customerId)) {
        $existingCustomer = dbSelectOne(
            "SELECT id FROM customers WHERE phone = ? LIMIT 1",
            [$customerPhone]
        );
        
        if ($existingCustomer) {
            $customerId = $existingCustomer['id'];
        }
    }
    
    // إذا لم يكن هناك customer_id بعد، إنشاء عميل جديد - هذا إلزامي
    if (empty($customerId)) {
        $newCustomerId = generateId();
        $result = dbExecute(
            "INSERT INTO customers (id, name, phone, address, customer_type, shop_name, created_at, created_by) VALUES (?, ?, ?, ?, 'retail', NULL, NOW(), ?)",
            [$newCustomerId, $customerName, $customerPhone, '', $session['user_id']]
        );
        
        if ($result !== false) {
            $customerId = $newCustomerId;
        } else {
            // إذا فشل إنشاء العميل، إرجاع خطأ
            response(false, 'فشل في إنشاء العميل. يرجى المحاولة مرة أخرى', null, 500);
            return;
        }
    }
    
    // التأكد النهائي من وجود customer_id - هذا إلزامي
    if (empty($customerId)) {
        response(false, 'خطأ في ربط العميل بالفاتورة. يرجى المحاولة مرة أخرى', null, 500);
        return;
    }
    
    $saleId = generateId();
    
    // إنشاء رقم فاتورة عشوائي من 6 أرقام
    do {
        $saleNumber = str_pad(rand(100000, 999999), 6, '0', STR_PAD_LEFT);
        $existing = dbSelectOne("SELECT id FROM sales WHERE sale_number = ?", [$saleNumber]);
    } while ($existing);
    
    dbBeginTransaction();
    
    try {
        // التأكد النهائي من أن customer_id غير فارغ قبل الحفظ - هذا إلزامي
        if (empty($customerId)) {
            throw new Exception('customer_id مطلوب لحفظ الفاتورة');
        }
        
        // إنشاء عملية البيع - التأكد من حفظ customer_id بشكل صحيح (إلزامي)
        $result = dbExecute(
            "INSERT INTO sales (id, sale_number, total_amount, discount, tax, final_amount, customer_id, customer_name, customer_phone, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$saleId, $saleNumber, $totalAmount, $discount, $tax, $finalAmount, $customerId, $customerName, $customerPhone, $session['user_id']]
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
                // لقطع الغيار، يجب أن يكون هناك spare_part_item_id محدد لخصم الكمية من القطعة الفرعية
                // قراءة spare_part_item_id (يمكن أن يكون null أو string)
                $sparePartItemIdRaw = $item['spare_part_item_id'] ?? null;
                $sparePartItemId = isset($sparePartItemIdRaw) && $sparePartItemIdRaw !== null && $sparePartItemIdRaw !== '' 
                    ? trim(strval($sparePartItemIdRaw)) 
                    : '';
                
                // سجل للتحقق من البيانات المستلمة (للتشخيص)
                error_log("Spare part sale - item_name: $itemName, item_id: $originalItemId, spare_part_item_id: " . ($sparePartItemId ?: 'MISSING'));
                
                // التأكد من وجود spare_part_item_id لقطع الغيار (مطلوب)
                if (empty($sparePartItemId)) {
                    throw new Exception("يجب تحديد القطعة الفرعية من بطاقة قطع الغيار: " . $itemName . " (item_id: " . $originalItemId . "). البيانات المستلمة: " . json_encode(['spare_part_item_id' => $sparePartItemIdRaw]));
                }
                
                // خصم من القطعة الفرعية المحددة في بطاقة قطع الغيار
                $sparePartItem = dbSelectOne(
                    "SELECT id, quantity FROM spare_part_items WHERE id = ? AND spare_part_id = ?",
                    [$sparePartItemId, $originalItemId]
                );
                
                if (!$sparePartItem) {
                    throw new Exception("القطعة الفرعية غير موجودة في بطاقة قطع الغيار (spare_part_item_id: $sparePartItemId, spare_part_id: $originalItemId)");
                }
                
                $currentQuantity = intval($sparePartItem['quantity'] ?? 0);
                if ($currentQuantity < $quantity) {
                    throw new Exception("الكمية المتاحة غير كافية للقطعة الفرعية (المتاح: $currentQuantity، المطلوب: $quantity)");
                }
                
                $newQuantity = $currentQuantity - $quantity;
                $updateResult = dbExecute(
                    "UPDATE spare_part_items SET quantity = ? WHERE id = ?",
                    [$newQuantity, $sparePartItemId]
                );
                
                if ($updateResult === false) {
                    global $lastDbError;
                    $errorMsg = $lastDbError ?? 'خطأ غير معروف';
                    throw new Exception("فشل تحديث كمية القطعة الفرعية في بطاقة قطع الغيار: $sparePartItemId. الخطأ: $errorMsg");
                }
                
                // ملاحظة: قطع الغيار الرئيسية لا تحتوي على quantity field، الكمية في القطع الفرعية فقط
            } elseif ($itemType === 'accessory') {
                // تحديث كمية الإكسسوارات - التحقق من الكمية أولاً
                $currentItem = dbSelectOne("SELECT quantity FROM accessories WHERE id = ?", [$originalItemId]);
                if ($currentItem) {
                    $currentQuantity = intval($currentItem['quantity'] ?? 0);
                    if ($currentQuantity >= $quantity) {
                        $newQuantity = $currentQuantity - $quantity;
                        $updateResult = dbExecute(
                            "UPDATE accessories SET quantity = ? WHERE id = ?",
                            [$newQuantity, $originalItemId]
                        );
                        if ($updateResult === false) {
                            throw new Exception("فشل تحديث كمية الإكسسوار: $originalItemId");
                        }
                    } else {
                        throw new Exception("الكمية المتاحة غير كافية للإكسسوار: $originalItemId (المتاح: $currentQuantity، المطلوب: $quantity)");
                    }
                } else {
                    throw new Exception("الإكسسوار غير موجود: $originalItemId");
                }
            } elseif ($itemType === 'phone') {
                // للهواتف، يجب حذفها من المخزون لأنها عناصر فريدة
                // التحقق من وجود الهاتف أولاً
                $phoneExists = dbSelectOne("SELECT id FROM phones WHERE id = ?", [$originalItemId]);
                if ($phoneExists) {
                    // حذف الهاتف من المخزون
                    $deleteResult = dbExecute("DELETE FROM phones WHERE id = ?", [$originalItemId]);
                    if ($deleteResult === false) {
                        throw new Exception("فشل حذف الهاتف من المخزون: $originalItemId");
                    }
                } else {
                    throw new Exception("الهاتف غير موجود في المخزون: $originalItemId");
                }
            } elseif ($itemType === 'inventory') {
                // تحديث كمية المخزون القديم - التحقق من الكمية أولاً
                $currentItem = dbSelectOne("SELECT quantity FROM inventory WHERE id = ?", [$originalItemId]);
                if ($currentItem) {
                    $currentQuantity = intval($currentItem['quantity'] ?? 0);
                    if ($currentQuantity >= $quantity) {
                        $newQuantity = $currentQuantity - $quantity;
                        $updateResult = dbExecute(
                            "UPDATE inventory SET quantity = ? WHERE id = ?",
                            [$newQuantity, $originalItemId]
                        );
                        if ($updateResult === false) {
                            throw new Exception("فشل تحديث كمية المخزون: $originalItemId");
                        }
                    } else {
                        throw new Exception("الكمية المتاحة غير كافية: $originalItemId (المتاح: $currentQuantity، المطلوب: $quantity)");
                    }
                } else {
                    throw new Exception("العنصر غير موجود في المخزون: $originalItemId");
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
            $sale['items'] = (is_array($saleItems) && count($saleItems) > 0) ? $saleItems : [];
            
            // التأكد من وجود sale_number
            if (empty($sale['sale_number'])) {
                $sale['sale_number'] = $sale['id'];
            }
            
            // التأكد من وجود القيم الرقمية
            $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
            $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
            $sale['discount'] = floatval($sale['discount'] ?? 0);
            $sale['tax'] = floatval($sale['tax'] ?? 0);
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

<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once 'config.php';
require_once 'invoices.php';

// تم إزالة Migration الذي يربط الفواتير برقم الهاتف
// جميع الفواتير يجب أن تكون مرتبطة بـ customer_id فقط

// Migration: إضافة total_debt إلى جدول customers إذا لم يكن موجوداً
if (dbTableExists('customers')) {
    try {
        if (!dbColumnExists('customers', 'total_debt')) {
            $conn = getDBConnection();
            if ($conn) {
                // محاولة إيجاد العمود المناسب لوضع total_debt بعده
                $afterCol = null;
                $checkCols = ['shop_name', 'address', 'notes'];
                foreach ($checkCols as $col) {
                    if (dbColumnExists('customers', $col)) {
                        $afterCol = $col;
                        break;
                    }
                }
                
                $sql = $afterCol ? 
                    "ALTER TABLE `customers` ADD COLUMN `total_debt` decimal(10,2) DEFAULT 0.00 AFTER `{$afterCol}`" :
                    "ALTER TABLE `customers` ADD COLUMN `total_debt` decimal(10,2) DEFAULT 0.00 AFTER `shop_name`";
                
                $conn->query($sql);
                error_log('تم إضافة عمود total_debt إلى جدول customers بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود total_debt: ' . $e->getMessage());
        }
    }
}

// Migration: إضافة customer_id و paid_amount و remaining_amount إلى جدول sales إذا لم تكون موجودة
if (dbTableExists('sales')) {
    // Migration: إضافة customer_id أولاً
    try {
        if (!dbColumnExists('sales', 'customer_id')) {
            $conn = getDBConnection();
            if ($conn) {
                $conn->query("ALTER TABLE `sales` ADD COLUMN `customer_id` varchar(50) DEFAULT NULL AFTER `final_amount`");
                // إضافة الفهرس
                try {
                    $conn->query("ALTER TABLE `sales` ADD KEY `idx_customer_id` (`customer_id`)");
                } catch (Exception $e) {
                    // الفهرس قد يكون موجوداً بالفعل
                }
                // إضافة Foreign Key إذا كان جدول customers موجوداً
                if (dbTableExists('customers')) {
                    try {
                        $conn->query("ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL");
                    } catch (Exception $e) {
                        // Foreign Key قد يكون موجوداً بالفعل
                        error_log('ملاحظة: فشل إضافة Foreign Key (قد يكون موجوداً بالفعل): ' . $e->getMessage());
                    }
                }
                error_log('تم إضافة عمود customer_id إلى جدول sales بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود customer_id: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة paid_amount
    try {
        if (!dbColumnExists('sales', 'paid_amount')) {
            $conn = getDBConnection();
            if ($conn) {
                // تحديد العمود المناسب لوضع paid_amount بعده
                $afterCol = dbColumnExists('sales', 'customer_id') ? 'final_amount' : 'final_amount';
                $conn->query("ALTER TABLE `sales` ADD COLUMN `paid_amount` decimal(10,2) DEFAULT 0.00 AFTER `{$afterCol}`");
                error_log('تم إضافة عمود paid_amount إلى جدول sales بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود paid_amount: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة remaining_amount
    try {
        if (!dbColumnExists('sales', 'remaining_amount')) {
            $conn = getDBConnection();
            if ($conn) {
                // التحقق من وجود paid_amount أولاً
                $afterCol = dbColumnExists('sales', 'paid_amount') ? 'paid_amount' : 'final_amount';
                $conn->query("ALTER TABLE `sales` ADD COLUMN `remaining_amount` decimal(10,2) DEFAULT 0.00 AFTER `{$afterCol}`");
                error_log('تم إضافة عمود remaining_amount إلى جدول sales بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود remaining_amount: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة invoice_data لحفظ بيانات الفاتورة كJSON
    try {
        if (!dbColumnExists('sales', 'invoice_data')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود invoice_data بعد remaining_amount
                $afterCol = dbColumnExists('sales', 'remaining_amount') ? 'remaining_amount' : 'final_amount';
                $conn->query("ALTER TABLE `sales` ADD COLUMN `invoice_data` longtext DEFAULT NULL AFTER `{$afterCol}`");
                error_log('تم إضافة عمود invoice_data إلى جدول sales بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود invoice_data: ' . $e->getMessage());
        }
    }
}

// التحقق من وجود الجداول وإنشاؤها إذا كانت مفقودة
if (!dbTableExists('sales') || !dbTableExists('sale_items')) {
    // ✅ تم إزالة setup.php - إنشاء الجداول مباشرة
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
                      `paid_amount` decimal(10,2) DEFAULT 0.00,
                      `remaining_amount` decimal(10,2) DEFAULT 0.00,
                      `customer_id` varchar(50) DEFAULT NULL,
                      `customer_name` varchar(255) DEFAULT NULL,
                      `customer_phone` varchar(50) DEFAULT NULL,
                      `created_at` datetime NOT NULL,
                      `updated_at` datetime DEFAULT NULL,
                      `created_by` varchar(50) DEFAULT NULL,
                      PRIMARY KEY (`id`),
                      UNIQUE KEY `sale_number` (`sale_number`),
                      KEY `idx_sale_number` (`sale_number`),
                      KEY `idx_customer_id` (`customer_id`),
                      KEY `idx_created_at` (`created_at`),
                      KEY `idx_created_by` (`created_by`),
                      CONSTRAINT `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                $conn->query($createSales);
            } else {
                // Migration: إضافة عمود customer_id إذا لم يكن موجوداً
                try {
                    $checkColumn = $conn->query("SHOW COLUMNS FROM `sales` LIKE 'customer_id'");
                    if ($checkColumn->num_rows === 0) {
                        // إضافة العمود
                        $conn->query("ALTER TABLE `sales` ADD COLUMN `customer_id` varchar(50) DEFAULT NULL AFTER `final_amount`");
                        // إضافة الفهرس
                        $conn->query("ALTER TABLE `sales` ADD KEY `idx_customer_id` (`customer_id`)");
                        // إضافة Foreign Key إذا كان جدول customers موجوداً
                        if (dbTableExists('customers')) {
                            try {
                                $conn->query("ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL");
                            } catch (Exception $e) {
                                // تجاهل الخطأ إذا كان Foreign Key موجوداً بالفعل
                                error_log('ملاحظة: فشل إضافة Foreign Key (قد يكون موجوداً بالفعل): ' . $e->getMessage());
                            }
                        }
                        error_log('تم إضافة عمود customer_id إلى جدول sales بنجاح');
                    }
                } catch (Exception $e) {
                    error_log('خطأ في إضافة عمود customer_id: ' . $e->getMessage());
                }
                
                // Migration: إضافة paid_amount و remaining_amount إذا لم يكونا موجودين
                try {
                    if (!dbColumnExists('sales', 'paid_amount')) {
                        $conn->query("ALTER TABLE `sales` ADD COLUMN `paid_amount` decimal(10,2) DEFAULT 0.00 AFTER `final_amount`");
                        error_log('تم إضافة عمود paid_amount إلى جدول sales بنجاح');
                    }
                } catch (Exception $e) {
                    error_log('خطأ في إضافة عمود paid_amount: ' . $e->getMessage());
                }
                
                try {
                    if (!dbColumnExists('sales', 'remaining_amount')) {
                        $conn->query("ALTER TABLE `sales` ADD COLUMN `remaining_amount` decimal(10,2) DEFAULT 0.00 AFTER `paid_amount`");
                        error_log('تم إضافة عمود remaining_amount إلى جدول sales بنجاح');
                    }
                } catch (Exception $e) {
                    error_log('خطأ في إضافة عمود remaining_amount: ' . $e->getMessage());
                }
                
                // Migration: التأكد من أن sale_number فريد (UNIQUE)
                try {
                    $checkUnique = $conn->query("SHOW INDEX FROM `sales` WHERE Key_name = 'sale_number' AND Non_unique = 0");
                    if ($checkUnique->num_rows === 0) {
                        // محاولة إضافة UNIQUE constraint
                        try {
                            // أولاً، حذف أي أرقام فواتير مكررة (الاحتفاظ بالأحدث)
                            $conn->query("
                                DELETE s1 FROM sales s1
                                INNER JOIN sales s2 
                                WHERE s1.sale_number = s2.sale_number 
                                AND s1.id < s2.id
                            ");
                            // إضافة UNIQUE constraint
                            $conn->query("ALTER TABLE `sales` ADD UNIQUE KEY `sale_number` (`sale_number`)");
                            error_log('تم إضافة UNIQUE constraint لـ sale_number بنجاح');
                        } catch (Exception $e) {
                            error_log('ملاحظة: فشل إضافة UNIQUE constraint لـ sale_number (قد يكون موجوداً بالفعل): ' . $e->getMessage());
                        }
                    }
                } catch (Exception $e) {
                    error_log('خطأ في التحقق من UNIQUE constraint لـ sale_number: ' . $e->getMessage());
                }
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
                      `notes` text DEFAULT NULL,
                      `created_at` datetime NOT NULL,
                      PRIMARY KEY (`id`),
                      KEY `idx_sale_id` (`sale_id`),
                      KEY `idx_item_type` (`item_type`),
                      KEY `idx_item_id` (`item_id`),
                      CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                $conn->query($createSaleItems);
            } else {
                // Migration: إضافة عمود notes إذا لم يكن موجوداً (لحفظ بيانات الهاتف)
                try {
                    $checkColumn = $conn->query("SHOW COLUMNS FROM `sale_items` LIKE 'notes'");
                    if ($checkColumn->num_rows === 0) {
                        $conn->query("ALTER TABLE `sale_items` ADD COLUMN `notes` text DEFAULT NULL AFTER `total_price`");
                        error_log('تم إضافة عمود notes إلى جدول sale_items بنجاح');
                    }
                } catch (Exception $e) {
                    error_log('خطأ في إضافة عمود notes: ' . $e->getMessage());
                }
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
        
        // معالجة عناصر البيع وإضافة بيانات الهاتف إذا كانت موجودة
        $processedItems = [];
        foreach ($items as $item) {
            // إذا كان العنصر هاتف وله بيانات في notes (JSON)
            if ($item['item_type'] === 'phone' && !empty($item['notes'])) {
                $notesData = json_decode($item['notes'], true);
                if ($notesData && is_array($notesData)) {
                    if (isset($notesData['phone_data'])) {
                        $item['phone_data'] = $notesData['phone_data'];
                    } else {
                        // للتوافق مع البيانات القديمة - إذا كانت البيانات مباشرة في notes
                        $item['phone_data'] = $notesData;
                    }
                }
            }
            $processedItems[] = $item;
        }
        $sale['items'] = (is_array($processedItems) && count($processedItems) > 0) ? $processedItems : [];
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            $sale['sale_number'] = $sale['id'];
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
        
        // التأكد من وجود customer_id - لا نستخدم رقم الهاتف للربط
        // الفواتير يجب أن تكون مرتبطة بـ customer_id فقط
        
        // إضافة مسار ملف الفاتورة إذا كان موجوداً
        require_once 'invoices.php';
        $saleNumber = $sale['sale_number'] ?? $sale['id'] ?? '';
        if (!empty($saleNumber)) {
            $invoiceFilePath = getInvoiceFilePath($saleNumber);
            if ($invoiceFilePath) {
                $sale['invoice_file_path'] = $invoiceFilePath;
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
        
        // معالجة عناصر البيع وإضافة بيانات الهاتف إذا كانت موجودة
        $processedItems = [];
        foreach ($items as $item) {
            // إذا كان العنصر هاتف وله بيانات في notes (JSON)
            if ($item['item_type'] === 'phone' && !empty($item['notes'])) {
                $notesData = json_decode($item['notes'], true);
                if ($notesData && is_array($notesData)) {
                    if (isset($notesData['phone_data'])) {
                        $item['phone_data'] = $notesData['phone_data'];
                    } else {
                        // للتوافق مع البيانات القديمة - إذا كانت البيانات مباشرة في notes
                        $item['phone_data'] = $notesData;
                    }
                }
            }
            $processedItems[] = $item;
        }
        $sale['items'] = (is_array($processedItems) && count($processedItems) > 0) ? $processedItems : [];
        
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
    $paidAmount = floatval($data['paid_amount'] ?? $finalAmount); // المبلغ المدفوع (افتراضياً كامل المبلغ)
    $remainingAmount = floatval($data['remaining_amount'] ?? 0); // المبلغ المتبقي
    $customerId = trim($data['customer_id'] ?? '');
    $customerName = trim($data['customer_name'] ?? '');
    $customerPhone = trim($data['customer_phone'] ?? '');
    
    if (empty($items) || !is_array($items)) {
        response(false, 'يجب إضافة عناصر للبيع', null, 400);
    }
    
    if ($finalAmount <= 0) {
        response(false, 'المبلغ الإجمالي يجب أن يكون أكبر من الصفر', null, 400);
    }
    
    // التحقق من صحة المبالغ المدفوعة والمتبقية
    if ($paidAmount < 0) {
        response(false, 'المبلغ المدفوع لا يمكن أن يكون سالباً', null, 400);
    }
    
    if ($paidAmount > $finalAmount) {
        response(false, 'المبلغ المدفوع لا يمكن أن يكون أكبر من الإجمالي', null, 400);
    }
    
    // حساب المبلغ المتبقي تلقائياً إذا لم يتم إرساله
    if ($remainingAmount == 0 && $paidAmount < $finalAmount) {
        $remainingAmount = $finalAmount - $paidAmount;
    } else if ($remainingAmount == 0) {
        $remainingAmount = 0; // تم الدفع بالكامل
    }
    
    // التأكد من أن المبالغ متطابقة
    if (abs(($paidAmount + $remainingAmount) - $finalAmount) > 0.01) {
        response(false, 'المبلغ المدفوع والمتبقي يجب أن يساويا الإجمالي', null, 400);
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
    
    // التحقق من وجود العميل في قاعدة البيانات باستخدام customer_id فقط
    if (!empty($customerId)) {
        $customerExists = dbSelectOne(
            "SELECT id FROM customers WHERE id = ?",
            [$customerId]
        );
        
        if (!$customerExists) {
            // إذا لم يوجد العميل بـ customer_id المحدد، سيتم إنشاء عميل جديد لاحقاً
            $customerId = null;
        }
    }
    
    $session = checkAuth();
    $userBranchId = $session['branch_id'] ?? null;
    $userRole = $session['role'];
    
    // دالة مساعدة لجلب الفرع الأول
    function getFirstBranchId() {
        $firstBranch = dbSelectOne(
            "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
        );
        return $firstBranch ? $firstBranch['id'] : null;
    }
    
    // التأكد من وجود customer_id - هذا إلزامي
    // لا نستخدم رقم الهاتف للبحث عن عميل موجود
    // إذا لم يكن هناك customer_id، سيتم إنشاء عميل جديد
    
    // إذا لم يكن هناك customer_id بعد، إنشاء عميل جديد - هذا إلزامي
    if (empty($customerId)) {
        // ✅ إصلاح: تحديد branch_id للعميل الجديد (تماماً مثل api/customers.php)
        $customerBranchId = null;
        
        if ($userRole === 'admin') {
            // المالك: استخدام الفرع الأول كافتراضي
            $customerBranchId = getFirstBranchId();
        } else {
            // المستخدم العادي: استخدام فرعه
            if (!$userBranchId) {
                response(false, 'المستخدم غير مرتبط بفرع', null, 400);
                return;
            }
            $customerBranchId = $userBranchId;
        }
        
        // التأكد من وجود branch_id
        if (empty($customerBranchId)) {
            response(false, 'لا يمكن تحديد الفرع للعميل', null, 500);
            return;
        }
        
        $newCustomerId = generateCustomerId();
        
        // التحقق من وجود عمود branch_id في جدول customers
        $hasBranchIdColumn = dbColumnExists('customers', 'branch_id');
        
        if ($hasBranchIdColumn) {
            // ✅ إصلاح: حفظ branch_id عند إنشاء العميل
            $result = dbExecute(
                "INSERT INTO customers (id, branch_id, name, phone, address, customer_type, shop_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'retail', NULL, NOW(), ?)",
                [$newCustomerId, $customerBranchId, $customerName, $customerPhone, '', $session['user_id']]
            );
        } else {
            // للجداول القديمة التي لا تحتوي على branch_id
            $result = dbExecute(
                "INSERT INTO customers (id, name, phone, address, customer_type, shop_name, created_at, created_by) VALUES (?, ?, ?, ?, 'retail', NULL, NOW(), ?)",
                [$newCustomerId, $customerName, $customerPhone, '', $session['user_id']]
            );
        }
        
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
        
        // جلب نوع العميل للتحقق من إمكانية الدفع الجزئي
        // التحقق من وجود عمود total_debt أولاً
        $hasTotalDebtColumn = dbColumnExists('customers', 'total_debt');
        $selectFields = $hasTotalDebtColumn ? 'customer_type, total_debt' : 'customer_type';
        
        $customer = dbSelectOne(
            "SELECT {$selectFields} FROM customers WHERE id = ?",
            [$customerId]
        );
        $customerType = $customer ? ($customer['customer_type'] ?? 'retail') : 'retail';
        $currentTotalDebt = $hasTotalDebtColumn ? floatval($customer['total_debt'] ?? 0) : 0;
        
        // للعملاء التجاريين فقط: السماح بالدفع الجزئي
        // للعملاء العاديين: يجب دفع كامل المبلغ
        if ($customerType !== 'commercial') {
            // للعملاء العاديين، التأكد من دفع كامل المبلغ
            if ($paidAmount < $finalAmount) {
                throw new Exception('يجب دفع كامل المبلغ للعملاء العاديين');
            }
            $paidAmount = $finalAmount;
            $remainingAmount = 0;
        }
        
        // التحقق من وجود الأعمدة قبل INSERT
        $hasCustomerId = dbColumnExists('sales', 'customer_id');
        $hasPaidAmount = dbColumnExists('sales', 'paid_amount');
        $hasRemainingAmount = dbColumnExists('sales', 'remaining_amount');
        
        // إنشاء عملية البيع - بناء الاستعلام بناءً على الأعمدة الموجودة
        if ($hasCustomerId && $hasPaidAmount && $hasRemainingAmount) {
            // جميع الأعمدة موجودة
            $result = dbExecute(
                "INSERT INTO sales (id, sale_number, total_amount, discount, tax, final_amount, paid_amount, remaining_amount, customer_id, customer_name, customer_phone, created_at, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
                [$saleId, $saleNumber, $totalAmount, $discount, $tax, $finalAmount, $paidAmount, $remainingAmount, $customerId, $customerName, $customerPhone, $session['user_id']]
            );
        } else if ($hasCustomerId) {
            // customer_id موجود لكن paid_amount و remaining_amount غير موجودين
            $result = dbExecute(
                "INSERT INTO sales (id, sale_number, total_amount, discount, tax, final_amount, customer_id, customer_name, customer_phone, created_at, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
                [$saleId, $saleNumber, $totalAmount, $discount, $tax, $finalAmount, $customerId, $customerName, $customerPhone, $session['user_id']]
            );
            error_log('تحذير: أعمدة paid_amount و/أو remaining_amount غير موجودة - تم حفظ الفاتورة بدونها');
        } else {
            // customer_id غير موجود (fallback للجداول القديمة جداً)
            $result = dbExecute(
                "INSERT INTO sales (id, sale_number, total_amount, discount, tax, final_amount, customer_name, customer_phone, created_at, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
                [$saleId, $saleNumber, $totalAmount, $discount, $tax, $finalAmount, $customerName, $customerPhone, $session['user_id']]
            );
            error_log('تحذير: عمود customer_id غير موجود - تم حفظ الفاتورة بدون customer_id');
        }
        
        if ($result === false) {
            throw new Exception('خطأ في إنشاء عملية البيع');
        }
        
        // إضافة عناصر البيع وتحديث الكمية في المخزن
        // حفظ بيانات الهواتف قبل خصم الكمية (النظام الجديد: من inventory)
        $phoneDataMap = [];
        foreach ($items as $item) {
            $itemType = trim($item['item_type'] ?? '');
            $originalItemId = trim($item['item_id'] ?? '');
            
            // إذا كان عنصر هاتف، جلب بياناته من جدول phones (النظام الجديد)
            if ($itemType === 'phone' && !empty($originalItemId)) {
                $phoneData = dbSelectOne(
                    "SELECT brand, model, serial_number, storage, ram, screen_type, processor, battery, 
                            battery_percent, accessories, password, maintenance_history, defects, tax_status, tax_amount,
                            purchase_price, selling_price, image
                     FROM phones WHERE id = ?", 
                    [$originalItemId]
                );
                if ($phoneData) {
                    $phoneDataMap[$originalItemId] = $phoneData;
                }
            }
        }
        
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
            
            // إضافة بيانات الهاتف إذا كانت موجودة (كJSON في notes إذا كان الحقل يدعم JSON)
            $phoneDataArray = null;
            if ($itemType === 'phone') {
                // أولاً: محاولة استخدام phone_data المرسلة من JavaScript
                if (!empty($item['phone_data']) && is_array($item['phone_data'])) {
                    $phoneDataArray = $item['phone_data'];
                }
                // ثانياً: إذا لم تكن موجودة، جلبها من phoneDataMap (تم جلبها مسبقاً)
                elseif (isset($phoneDataMap[$originalItemId])) {
                    $phoneDataArray = $phoneDataMap[$originalItemId];
                }
                // ثالثاً: إذا لم تكن موجودة في أي مكان، جلبها مباشرة من جدول phones (النظام الجديد)
                elseif (!empty($originalItemId)) {
                    $phoneData = dbSelectOne(
                        "SELECT brand, model, serial_number, storage, ram, screen_type, processor, battery, 
                                battery_percent, accessories, password, maintenance_history, defects, tax_status, tax_amount,
                                purchase_price, selling_price, image
                         FROM phones WHERE id = ?", 
                        [$originalItemId]
                    );
                    if ($phoneData) {
                        $phoneDataArray = $phoneData;
                    }
                }
            }
            
            // حفظ spare_part_item_id و item_type في notes لقطع الغيار
            $sparePartItemId = null;
            $sparePartItemType = null;
            $sparePartItemData = null; // لحفظ البيانات للاستخدام لاحقاً
            if ($itemType === 'spare_part') {
                $sparePartItemIdRaw = $item['spare_part_item_id'] ?? null;
                if (isset($sparePartItemIdRaw) && $sparePartItemIdRaw !== null && $sparePartItemIdRaw !== '') {
                    $sparePartItemId = trim(strval($sparePartItemIdRaw));
                    
                    // جلب بيانات spare_part_item (item_type و quantity)
                    if ($sparePartItemId) {
                        $sparePartItemData = dbSelectOne(
                            "SELECT id, quantity, item_type FROM spare_part_items WHERE id = ? AND spare_part_id = ?",
                            [$sparePartItemId, $originalItemId]
                        );
                        if ($sparePartItemData) {
                            $sparePartItemType = $sparePartItemData['item_type'] ?? null;
                        }
                    }
                }
            }
            
            // التحقق من وجود عمود notes في sale_items
            $hasNotesColumn = dbColumnExists('sale_items', 'notes');
            
            // بناء بيانات notes (JSON) إذا كان هناك بيانات لحفظها
            $notesData = null;
            if ($hasNotesColumn) {
                $notesArray = [];
                if ($phoneDataArray) {
                    $notesArray['phone_data'] = $phoneDataArray;
                }
                if ($sparePartItemId) {
                    $notesArray['spare_part_item_id'] = $sparePartItemId;
                    if ($sparePartItemType) {
                        $notesArray['item_type'] = $sparePartItemType;
                    }
                }
                if (!empty($notesArray)) {
                    $notesData = json_encode($notesArray, JSON_UNESCAPED_UNICODE);
                }
            }
            
            if ($hasNotesColumn && $notesData) {
                // إضافة عنصر البيع مع بيانات إضافية في حقل notes
                $itemResult = dbExecute(
                    "INSERT INTO sale_items (id, sale_id, item_type, item_id, item_name, quantity, unit_price, total_price, notes, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    [$itemId, $saleId, $itemType, $originalItemId, $itemName, $quantity, $unitPrice, $totalPrice, $notesData]
                );
            } else {
                // إضافة عنصر البيع بدون notes
                $itemResult = dbExecute(
                    "INSERT INTO sale_items (id, sale_id, item_type, item_id, item_name, quantity, unit_price, total_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    [$itemId, $saleId, $itemType, $originalItemId, $itemName, $quantity, $unitPrice, $totalPrice]
                );
            }
            
            if ($itemResult === false) {
                throw new Exception('خطأ في إضافة عنصر البيع');
            }
            
            // حفظ بيانات الهاتف في متغير للاستخدام لاحقاً في الاستجابة
            if ($itemType === 'phone') {
                // أولاً: استخدام phone_data المرسلة من JavaScript
                if (!empty($item['phone_data']) && is_array($item['phone_data'])) {
                    $item['phone_data'] = $item['phone_data'];
                }
                // ثانياً: إذا لم تكن موجودة، استخدام البيانات من قاعدة البيانات
                elseif (isset($phoneDataMap[$originalItemId])) {
                    $item['phone_data'] = $phoneDataMap[$originalItemId];
                }
            }
            
            // تحديث الكمية في المخزن
            if ($itemType === 'spare_part') {
                // لقطع الغيار، يجب أن يكون هناك spare_part_item_id محدد لخصم الكمية من القطعة الفرعية
                // استخدام spare_part_item_id الذي تم قراءته سابقاً
                
                // سجل للتحقق من البيانات المستلمة (للتشخيص)
                error_log("Spare part sale - item_name: $itemName, item_id: $originalItemId, spare_part_item_id: " . ($sparePartItemId ?: 'MISSING'));
                
                // التأكد من وجود spare_part_item_id لقطع الغيار (مطلوب)
                if (empty($sparePartItemId)) {
                    throw new Exception("يجب تحديد القطعة الفرعية من بطاقة قطع الغيار: " . $itemName . " (item_id: " . $originalItemId . ")");
                }
                
                // خصم من القطعة الفرعية المحددة في بطاقة قطع الغيار
                // استخدام البيانات التي تم جلبها سابقاً
                if (!$sparePartItemData) {
                    throw new Exception("القطعة الفرعية غير موجودة في بطاقة قطع الغيار (spare_part_item_id: $sparePartItemId, spare_part_id: $originalItemId)");
                }
                
                $currentQuantity = intval($sparePartItemData['quantity'] ?? 0);
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
                // النظام الجديد: خصم الكمية من inventory وربط ID من phones
                // التحقق من وجود الهاتف في phones
                $phone = dbSelectOne("SELECT id FROM phones WHERE id = ?", [$originalItemId]);
                if (!$phone) {
                    throw new Exception("الهاتف غير موجود في جدول phones: $originalItemId");
                }
                
                // التحقق من وجود البطاقة في inventory
                $phoneInventory = dbSelectOne(
                    "SELECT id, name, quantity FROM inventory WHERE id = ?", 
                    [$originalItemId]
                );
                
                if (!$phoneInventory) {
                    throw new Exception("بطاقة الهاتف غير موجودة في المخزن: $originalItemId");
                }
                
                $currentQuantity = intval($phoneInventory['quantity'] ?? 0);
                if ($currentQuantity < $quantity) {
                    throw new Exception("الكمية المتاحة غير كافية للهاتف (المتاح: $currentQuantity، المطلوب: $quantity)");
                }
                
                // خصم الكمية من inventory
                $newQuantity = $currentQuantity - $quantity;
                $updateResult = dbExecute(
                    "UPDATE inventory SET quantity = ?, updated_at = NOW() WHERE id = ?",
                    [$newQuantity, $originalItemId]
                );
                
                if ($updateResult === false) {
                    throw new Exception("فشل تحديث كمية الهاتف في المخزن: $originalItemId");
                }
                
                // جلب بيانات الهاتف من جدول phones
                $phoneData = dbSelectOne(
                    "SELECT brand, model, serial_number, storage, ram, screen_type, processor, battery, 
                            battery_percent, accessories, password, maintenance_history, defects, tax_status, tax_amount,
                            purchase_price, selling_price, image
                     FROM phones WHERE id = ?", 
                    [$originalItemId]
                );
                
                // إضافة بيانات الهاتف إلى عنصر البيع
                if ($phoneData && !isset($item['phone_data'])) {
                    $item['phone_data'] = $phoneData;
                }
            } elseif ($itemType === 'inventory') {
                // تحديث كمية المخزن القديم - التحقق من الكمية أولاً
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
                            throw new Exception("فشل تحديث كمية المخزن: $originalItemId");
                        }
                    } else {
                        throw new Exception("الكمية المتاحة غير كافية: $originalItemId (المتاح: $currentQuantity، المطلوب: $quantity)");
                    }
                } else {
                    throw new Exception("العنصر غير موجود في المخزن: $originalItemId");
                }
            }
        }
        
        // ✅ خصم تكلفة المنتجات من المتبقي عند وجود خصم من خزنة الفرع
        $totalProductsCost = 0;
        if ($discount > 0 && $remainingAmount > 0) {
            // حساب إجمالي تكلفة المنتجات المباعة
            foreach ($items as $item) {
                $itemType = trim($item['item_type'] ?? '');
                $originalItemId = trim($item['item_id'] ?? '');
                $quantity = intval($item['quantity'] ?? 1);
                
                if (empty($itemType) || empty($originalItemId)) {
                    continue;
                }
                
                // جلب سعر التكلفة حسب نوع المنتج
                $purchasePrice = 0;
                if ($itemType === 'spare_part') {
                    // لقطع الغيار، جلب سعر التكلفة من spare_parts
                    $sparePart = dbSelectOne("SELECT purchase_price FROM spare_parts WHERE id = ?", [$originalItemId]);
                    $purchasePrice = floatval($sparePart['purchase_price'] ?? 0);
                } elseif ($itemType === 'accessory') {
                    // للإكسسوارات
                    $accessory = dbSelectOne("SELECT purchase_price FROM accessories WHERE id = ?", [$originalItemId]);
                    $purchasePrice = floatval($accessory['purchase_price'] ?? 0);
                } elseif ($itemType === 'phone') {
                    // للهواتف
                    $phone = dbSelectOne("SELECT purchase_price FROM phones WHERE id = ?", [$originalItemId]);
                    $purchasePrice = floatval($phone['purchase_price'] ?? 0);
                } elseif ($itemType === 'inventory') {
                    // للمخزن القديم
                    $inventoryItem = dbSelectOne("SELECT purchase_price FROM inventory WHERE id = ?", [$originalItemId]);
                    $purchasePrice = floatval($inventoryItem['purchase_price'] ?? 0);
                }
                
                $totalProductsCost += ($purchasePrice * $quantity);
            }
            
            // خصم تكلفة المنتجات من المتبقي
            if ($totalProductsCost > 0) {
                $remainingAmount = max(0, $remainingAmount - $totalProductsCost);
                
                // تحديث remaining_amount في قاعدة البيانات
                if (dbColumnExists('sales', 'remaining_amount')) {
                    $updateRemainingResult = dbExecute(
                        "UPDATE sales SET remaining_amount = ? WHERE id = ?",
                        [$remainingAmount, $saleId]
                    );
                    
                    if ($updateRemainingResult !== false) {
                        error_log("✅ تم خصم تكلفة المنتجات ({$totalProductsCost} ج.م) من المتبقي في الفاتورة رقم {$saleNumber}");
                    } else {
                        error_log("⚠️ فشل تحديث المتبقي بعد خصم تكلفة المنتجات");
                    }
                }
            }
        }
        
        // تحديث دين العميل إذا كان عميل تجاري ولديه دين
        if ($customerType === 'commercial' && $remainingAmount > 0) {
            // التحقق من وجود عمود total_debt قبل التحديث
            if (dbColumnExists('customers', 'total_debt')) {
                $newTotalDebt = $currentTotalDebt + $remainingAmount;
                $updateDebtResult = dbExecute(
                    "UPDATE customers SET total_debt = ? WHERE id = ?",
                    [$newTotalDebt, $customerId]
                );
                
                if ($updateDebtResult === false) {
                    throw new Exception('فشل تحديث دين العميل');
                }
            } else {
                // إذا لم يكن العمود موجوداً، تسجيل تحذير فقط (لن نوقف العملية)
                error_log('تحذير: عمود total_debt غير موجود في جدول customers - لم يتم تحديث الدين');
            }
        }
        
        // ✅ إضافة معاملة خزنة للمبيعات
        if (dbTableExists('treasury_transactions') && $paidAmount > 0) {
            // جلب branch_id من العميل
            $customerBranchId = null;
            if (dbColumnExists('customers', 'branch_id')) {
                $customerBranch = dbSelectOne("SELECT branch_id FROM customers WHERE id = ?", [$customerId]);
                if ($customerBranch) {
                    $customerBranchId = $customerBranch['branch_id'] ?? null;
                }
            }
            
            // إذا لم يكن branch_id موجوداً في العميل، استخدام branch_id من المستخدم
            if (empty($customerBranchId)) {
                $customerBranchId = $userBranchId;
            }
            
            // إذا لم يكن branch_id موجوداً، استخدام الفرع الأول
            if (empty($customerBranchId)) {
                $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
                $customerBranchId = $firstBranch ? $firstBranch['id'] : null;
            }
            
            if ($customerBranchId) {
                // تحديد نوع المعاملة حسب نوع العميل
                $amountToAdd = 0;
                $transactionType = '';
                $transactionDescription = '';
                
                if ($customerType === 'commercial') {
                    // للعملاء التجاريين: إضافة المبلغ المدفوع فقط للخزنة
                    $amountToAdd = $paidAmount;
                    $transactionType = 'sales_revenue';
                    $transactionDescription = "مبيعات - عميل تجاري ({$customerName}) - المبلغ المدفوع - فاتورة رقم {$saleNumber}";
                } else {
                    // للعملاء العاديين: إضافة كامل المبلغ للخزنة
                    $amountToAdd = $finalAmount;
                    $transactionType = 'sales_revenue';
                    $transactionDescription = "مبيعات - عميل محل ({$customerName}) - فاتورة رقم {$saleNumber}";
                }
                
                if ($amountToAdd > 0) {
                    // التحقق من عدم وجود معاملة مسجلة مسبقاً
                    $existingTransaction = dbSelectOne(
                        "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'sale' AND transaction_type = ?",
                        [$saleId, $transactionType]
                    );
                    
                    if (!$existingTransaction) {
                        $transactionId = generateId();
                        $result = dbExecute(
                            "INSERT INTO treasury_transactions (
                                id, branch_id, transaction_type, amount, description, 
                                reference_id, reference_type, created_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, 'sale', NOW(), ?)",
                            [$transactionId, $customerBranchId, $transactionType, $amountToAdd, $transactionDescription, $saleId, $session['user_id']]
                        );
                        
                        if ($result === false) {
                            error_log('تحذير: فشل تسجيل معاملة الخزنة للمبيعات - لن نوقف العملية');
                        } else {
                            error_log("✅ تم تسجيل معاملة خزنة للمبيعات: {$amountToAdd} ج.م - نوع العميل: {$customerType} - فاتورة رقم {$saleNumber}");
                        }
                    }
                }
            } else {
                error_log('تحذير: لا يمكن تحديد branch_id لتسجيل معاملة الخزنة للمبيعات');
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
            
            // معالجة عناصر البيع وإضافة بيانات الهاتف إذا كانت موجودة
            $processedItems = [];
            foreach ($saleItems as $saleItem) {
                // إذا كان العنصر هاتف وله بيانات في notes (JSON)
                if ($saleItem['item_type'] === 'phone' && !empty($saleItem['notes'])) {
                    $notesData = json_decode($saleItem['notes'], true);
                    if ($notesData && is_array($notesData)) {
                        if (isset($notesData['phone_data'])) {
                            $saleItem['phone_data'] = $notesData['phone_data'];
                        } else {
                            // للتوافق مع البيانات القديمة - إذا كانت البيانات مباشرة في notes
                            $saleItem['phone_data'] = $notesData;
                        }
                    }
                }
                $processedItems[] = $saleItem;
            }
            $sale['items'] = (is_array($processedItems) && count($processedItems) > 0) ? $processedItems : [];
            
            // التأكد من وجود sale_number
            if (empty($sale['sale_number'])) {
                $sale['sale_number'] = $sale['id'];
            }
            
            // التأكد من وجود القيم الرقمية
            $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
            $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
            $sale['discount'] = floatval($sale['discount'] ?? 0);
            $sale['tax'] = floatval($sale['tax'] ?? 0);
            
            // حفظ بيانات الفاتورة في invoice_data (بدلاً من ملف HTML)
            try {
                // جلب إعدادات المتجر
                require_once 'invoices.php';
                $shopSettings = getShopSettings();
                
                // إنشاء بيانات الفاتورة الكاملة
                $invoiceData = [
                    'sale_id' => $sale['id'],
                    'sale_number' => $sale['sale_number'],
                    'created_at' => $sale['created_at'],
                    'customer' => [
                        'id' => $sale['customer_id'] ?? null,
                        'name' => $sale['customer_name'] ?? '',
                        'phone' => $sale['customer_phone'] ?? ''
                    ],
                    'items' => $sale['items'] ?? [],
                    'amounts' => [
                        'total_amount' => $sale['total_amount'],
                        'discount' => $sale['discount'],
                        'tax' => $sale['tax'],
                        'final_amount' => $sale['final_amount'],
                        'paid_amount' => floatval($sale['paid_amount'] ?? 0),
                        'remaining_amount' => floatval($sale['remaining_amount'] ?? 0)
                    ],
                    'shop_settings' => $shopSettings,
                    'created_by_name' => $sale['created_by_name'] ?? 'غير محدد',
                    'branch_name' => 'الهانوفيل' // يمكن جلبها من قاعدة البيانات لاحقاً
                ];
                
                // حفظ بيانات الفاتورة في invoice_data
                $invoiceDataJson = json_encode($invoiceData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                
                if (dbColumnExists('sales', 'invoice_data')) {
                    $updateResult = dbExecute(
                        "UPDATE sales SET invoice_data = ? WHERE id = ?",
                        [$invoiceDataJson, $sale['id']]
                    );
                    
                    if ($updateResult !== false) {
                        $sale['invoice_data'] = $invoiceData;
                    } else {
                        error_log('تحذير: فشل حفظ بيانات الفاتورة في invoice_data');
                    }
                } else {
                    error_log('تحذير: عمود invoice_data غير موجود في جدول sales');
                }
            } catch (Exception $e) {
                // لا نوقف العملية إذا فشل حفظ البيانات، فقط نسجل الخطأ
                error_log('خطأ في حفظ بيانات الفاتورة: ' . $e->getMessage());
            }
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

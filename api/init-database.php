<?php
/**
 * ملف تهيئة قاعدة البيانات الشامل
 * يقوم بإنشاء جميع الجداول والأعمدة الناقصة تلقائياً
 * يتم استدعاؤه مرة واحدة فقط عند أول زيارة
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/config.php';

/**
 * التحقق من حالة التهيئة
 * @return bool
 */
function isDatabaseInitialized() {
    static $cachedResult = null;
    
    // استخدام cache لتجنب استعلامات متعددة في نفس الطلب
    if ($cachedResult !== null) {
        return $cachedResult;
    }
    
    try {
        $conn = getDBConnection();
        if (!$conn) {
            $cachedResult = false;
            return false;
        }
        
        // التحقق من وجود جدول settings
        if (!dbTableExists('settings')) {
            $cachedResult = false;
            return false;
        }
        
        // التحقق من وجود سجل التهيئة
        $initStatus = dbSelectOne(
            "SELECT value FROM settings WHERE `key` = 'database_initialized'"
        );
        
        $cachedResult = $initStatus && $initStatus['value'] === '1';
        return $cachedResult;
    } catch (Exception $e) {
        $cachedResult = false;
        return false;
    } catch (Error $e) {
        $cachedResult = false;
        return false;
    }
}

/**
 * حفظ حالة التهيئة
 */
function markDatabaseAsInitialized() {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return false;
        }
        
        // التحقق من وجود السجل
        $exists = dbSelectOne(
            "SELECT id FROM settings WHERE `key` = 'database_initialized'"
        );
        
        if ($exists) {
            dbExecute(
                "UPDATE settings SET value = '1', updated_at = NOW() WHERE `key` = 'database_initialized'"
            );
        } else {
            dbExecute(
                "INSERT INTO settings (`key`, `value`, `updated_at`) VALUES ('database_initialized', '1', NOW())"
            );
        }
        
        return true;
    } catch (Exception $e) {
        error_log('خطأ في حفظ حالة التهيئة: ' . $e->getMessage());
        return false;
    }
}

/**
 * تهيئة قاعدة البيانات بالكامل
 * @return array
 */
function initializeDatabase() {
    $conn = getDBConnection();
    if (!$conn) {
        return [
            'success' => false,
            'message' => 'فشل الاتصال بقاعدة البيانات',
            'errors' => []
        ];
    }
    
    $errors = [];
    $migrationsApplied = [];
    
    // تعطيل فحص المفاتيح الخارجية مؤقتاً
    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    
    try {
        // 1. إنشاء جميع الجداول الأساسية
        require_once __DIR__ . '/setup.php';
        $setupResult = setupDatabase();
        
        if (!$setupResult['success']) {
            $errors[] = 'فشل إنشاء الجداول: ' . ($setupResult['message'] ?? 'خطأ غير معروف');
        }
        
        // 2. إضافة جميع الأعمدة الناقصة (بعد إنشاء الجداول)
        // ملاحظة: setup.php قد يحاول إضافة بعض الأعمدة، لكننا نضيفها هنا بشكل آمن
        
        // جدول customers - إضافة الأعمدة الناقصة بالترتيب الصحيح
        if (dbTableExists('customers')) {
            // دالة مساعدة لتحديد العمود المرجعي (AFTER column) بشكل آمن
            $getAfterColumn = function($preferredColumns, $fallback = 'phone') {
                foreach ($preferredColumns as $col) {
                    if (dbColumnExists('customers', $col)) {
                        return $col;
                    }
                }
                // التحقق من وجود العمود الافتراضي قبل استخدامه
                if (dbColumnExists('customers', $fallback)) {
                    return $fallback;
                }
                // إذا لم نجد أي عمود، استخدم FIRST (بدون AFTER)
                return null;
            };
            
            // إضافة customer_type أولاً (بعد phone)
            if (!dbColumnExists('customers', 'customer_type')) {
                try {
                    $afterCol = $getAfterColumn(['phone'], 'address');
                    $sql = $afterCol ? 
                        "ALTER TABLE `customers` ADD COLUMN `customer_type` enum('retail','commercial') NOT NULL DEFAULT 'retail' AFTER `{$afterCol}`" :
                        "ALTER TABLE `customers` ADD COLUMN `customer_type` enum('retail','commercial') NOT NULL DEFAULT 'retail' FIRST";
                    $conn->query($sql);
                    try {
                        $conn->query("ALTER TABLE `customers` ADD KEY `idx_customer_type` (`customer_type`)");
                    } catch (Exception $e) {
                        // الفهرس موجود بالفعل
                    }
                    $migrationsApplied[] = "customers.customer_type";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود customers.customer_type: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة shop_name بعد customer_type (أو phone إذا لم يكن customer_type موجوداً)
            if (!dbColumnExists('customers', 'shop_name')) {
                try {
                    $afterCol = $getAfterColumn(['customer_type', 'phone'], 'address');
                    $sql = $afterCol ? 
                        "ALTER TABLE `customers` ADD COLUMN `shop_name` varchar(255) DEFAULT NULL AFTER `{$afterCol}`" :
                        "ALTER TABLE `customers` ADD COLUMN `shop_name` varchar(255) DEFAULT NULL FIRST";
                    $conn->query($sql);
                    $migrationsApplied[] = "customers.shop_name";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود customers.shop_name: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة branch_id بعد shop_name (أو customer_type إذا لم يكن shop_name موجوداً)
            if (!dbColumnExists('customers', 'branch_id')) {
                try {
                    $afterCol = $getAfterColumn(['shop_name', 'customer_type', 'phone'], 'address');
                    $sql = $afterCol ? 
                        "ALTER TABLE `customers` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `{$afterCol}`" :
                        "ALTER TABLE `customers` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL FIRST";
                    $conn->query($sql);
                    try {
                        $conn->query("ALTER TABLE `customers` ADD KEY `idx_branch_id` (`branch_id`)");
                    } catch (Exception $e) {
                        // الفهرس موجود بالفعل
                    }
                    $migrationsApplied[] = "customers.branch_id";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود customers.branch_id: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة notes بعد shop_name (أو branch_id إذا لم يكن shop_name موجوداً)
            if (!dbColumnExists('customers', 'notes')) {
                try {
                    $afterCol = $getAfterColumn(['shop_name', 'branch_id', 'customer_type', 'phone'], 'address');
                    $sql = $afterCol ? 
                        "ALTER TABLE `customers` ADD COLUMN `notes` text DEFAULT NULL AFTER `{$afterCol}`" :
                        "ALTER TABLE `customers` ADD COLUMN `notes` text DEFAULT NULL FIRST";
                    $conn->query($sql);
                    $migrationsApplied[] = "customers.notes";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود customers.notes: " . $e->getMessage();
                    }
                }
            }
        }
        
        // جدول repairs - إضافة branch_id
        if (dbTableExists('repairs')) {
            if (!dbColumnExists('repairs', 'branch_id')) {
                try {
                    $conn->query("ALTER TABLE `repairs` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `status`");
                    $conn->query("ALTER TABLE `repairs` ADD KEY `idx_branch_id` (`branch_id`)");
                    $migrationsApplied[] = 'repairs.branch_id';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود repairs.branch_id: " . $e->getMessage();
                    }
                }
            }
        }
        
        // جدول chat_messages - إضافة جميع الأعمدة الناقصة بالترتيب الصحيح
        if (dbTableExists('chat_messages')) {
            // إضافة reply_to أولاً (إذا لم يكن موجوداً)
            if (!dbColumnExists('chat_messages', 'reply_to')) {
                try {
                    $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `reply_to` varchar(50) DEFAULT NULL AFTER `message`");
                    $migrationsApplied[] = 'chat_messages.reply_to';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود chat_messages.reply_to: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة file_path بعد reply_to
            if (!dbColumnExists('chat_messages', 'file_path')) {
                try {
                    $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `file_path` varchar(500) DEFAULT NULL AFTER `reply_to`");
                    $migrationsApplied[] = 'chat_messages.file_path';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود chat_messages.file_path: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة file_type بعد file_path
            if (!dbColumnExists('chat_messages', 'file_type')) {
                try {
                    $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `file_type` varchar(50) DEFAULT NULL AFTER `file_path`");
                    $migrationsApplied[] = 'chat_messages.file_type';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود chat_messages.file_type: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة file_name بعد file_type
            if (!dbColumnExists('chat_messages', 'file_name')) {
                try {
                    $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `file_name` varchar(255) DEFAULT NULL AFTER `file_type`");
                    $migrationsApplied[] = 'chat_messages.file_name';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود chat_messages.file_name: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة username إذا لم يكن موجوداً
            if (!dbColumnExists('chat_messages', 'username')) {
                try {
                    $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `username` varchar(255) DEFAULT NULL AFTER `user_id`");
                    $migrationsApplied[] = 'chat_messages.username';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود chat_messages.username: " . $e->getMessage();
                    }
                }
            }
        }
        
        // جدول users - إضافة الأعمدة الناقصة
        if (dbTableExists('users')) {
            $userColumns = [
                'branch_id' => "ALTER TABLE `users` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `role`",
                'avatar' => "ALTER TABLE `users` ADD COLUMN `avatar` text DEFAULT NULL AFTER `name`",
                'salary' => "ALTER TABLE `users` ADD COLUMN `salary` decimal(10,2) DEFAULT 0.00 AFTER `branch_id`",
                'webauthn_enabled' => "ALTER TABLE `users` ADD COLUMN `webauthn_enabled` tinyint(1) DEFAULT 0",
                'specialization' => "ALTER TABLE `users` ADD COLUMN `specialization` enum('soft','hard','fast') DEFAULT NULL AFTER `role`"
            ];
            
            foreach ($userColumns as $columnName => $alterSql) {
                if (!dbColumnExists('users', $columnName)) {
                    try {
                        $conn->query($alterSql);
                        if ($columnName === 'branch_id') {
                            try {
                                $conn->query("ALTER TABLE `users` ADD KEY `idx_branch_id` (`branch_id`)");
                            } catch (Exception $e) {
                                // الفهرس موجود بالفعل
                            }
                        }
                        $migrationsApplied[] = "users.$columnName";
                    } catch (Exception $e) {
                        if (strpos($e->getMessage(), 'Duplicate column') === false) {
                            $errors[] = "خطأ في إضافة عمود users.$columnName: " . $e->getMessage();
                        }
                    }
                }
            }
            
            // تحديث enum role لإضافة 'technician' إذا لم يكن موجوداً
            try {
                $conn = getDBConnection();
                if ($conn) {
                    // التحقق من القيم الحالية لـ enum
                    $checkEnum = $conn->query("SHOW COLUMNS FROM `users` WHERE Field = 'role'");
                    if ($checkEnum && $checkEnum->num_rows > 0) {
                        $columnInfo = $checkEnum->fetch_assoc();
                        $enumValues = $columnInfo['Type'];
                        
                        // التحقق من وجود 'technician' في enum
                        if (strpos($enumValues, 'technician') === false) {
                            // تحديث enum لإضافة 'technician'
                            $conn->query("ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','employee','technician') NOT NULL DEFAULT 'employee'");
                            $migrationsApplied[] = "users.role_enum_technician";
                        }
                    }
                }
            } catch (Exception $e) {
                // تجاهل الخطأ إذا كان enum محدث بالفعل أو لا يمكن تحديثه
                if (strpos($e->getMessage(), 'Duplicate') === false && strpos($e->getMessage(), 'already') === false) {
                    $errors[] = "خطأ في تحديث enum role: " . $e->getMessage();
                }
            }
        }
        
        // جدول expenses - إضافة branch_id إذا لم يكن موجوداً
        if (dbTableExists('expenses')) {
            if (!dbColumnExists('expenses', 'branch_id')) {
                try {
                    $conn->query("ALTER TABLE `expenses` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `expense_date`");
                    try {
                        $conn->query("ALTER TABLE `expenses` ADD KEY `idx_branch_id` (`branch_id`)");
                    } catch (Exception $e) {
                        // الفهرس موجود بالفعل
                    }
                    $migrationsApplied[] = "expenses.branch_id";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود expenses.branch_id: " . $e->getMessage();
                    }
                }
            }
        }
        
        // جدول sales - إضافة customer_id إذا لم يكن موجوداً
        if (dbTableExists('sales')) {
            if (!dbColumnExists('sales', 'customer_id')) {
                try {
                    // تحديد العمود المرجعي بشكل آمن
                    $afterCol = dbColumnExists('sales', 'final_amount') ? 'final_amount' : 
                               (dbColumnExists('sales', 'created_at') ? 'created_at' : null);
                    $sql = $afterCol ? 
                        "ALTER TABLE `sales` ADD COLUMN `customer_id` varchar(50) DEFAULT NULL AFTER `{$afterCol}`" :
                        "ALTER TABLE `sales` ADD COLUMN `customer_id` varchar(50) DEFAULT NULL FIRST";
                    $conn->query($sql);
                    
                    // إضافة فهرس
                    try {
                        $conn->query("ALTER TABLE `sales` ADD KEY `idx_customer_id` (`customer_id`)");
                    } catch (Exception $e) {
                        // الفهرس موجود بالفعل
                    }
                    
                    // إضافة Foreign Key إذا كان جدول customers موجوداً
                    if (dbTableExists('customers')) {
                        try {
                            $conn->query("ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL");
                        } catch (Exception $e) {
                            // Foreign Key موجود بالفعل أو فشل الإضافة
                            error_log("ملاحظة: فشل إضافة Foreign Key لـ sales.customer_id: " . $e->getMessage());
                        }
                    }
                    
                    $migrationsApplied[] = 'sales.customer_id';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود sales.customer_id: " . $e->getMessage();
                    }
                }
            }
            
            // إضافة paid_amount و remaining_amount في جدول sales للدفع الجزئي
            if (!dbColumnExists('sales', 'paid_amount')) {
                try {
                    $conn->query("ALTER TABLE `sales` ADD COLUMN `paid_amount` decimal(10,2) DEFAULT 0.00 AFTER `final_amount`");
                    $migrationsApplied[] = "sales.paid_amount";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود sales.paid_amount: " . $e->getMessage();
                    }
                }
            }
            
            if (!dbColumnExists('sales', 'remaining_amount')) {
                try {
                    $conn->query("ALTER TABLE `sales` ADD COLUMN `remaining_amount` decimal(10,2) DEFAULT 0.00 AFTER `paid_amount`");
                    $migrationsApplied[] = "sales.remaining_amount";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false) {
                        $errors[] = "خطأ في إضافة عمود sales.remaining_amount: " . $e->getMessage();
                    }
                }
            }
        }
        
        // جدول customers - إضافة total_debt لتسجيل إجمالي الدين
        if (dbTableExists('customers')) {
            if (!dbColumnExists('customers', 'total_debt')) {
                try {
                    $afterCol = $getAfterColumn(['shop_name', 'address'], 'notes');
                    $sql = $afterCol ? 
                        "ALTER TABLE `customers` ADD COLUMN `total_debt` decimal(10,2) DEFAULT 0.00 AFTER `{$afterCol}`" :
                        "ALTER TABLE `customers` ADD COLUMN `total_debt` decimal(10,2) DEFAULT 0.00 AFTER `shop_name`";
                    $conn->query($sql);
                    $migrationsApplied[] = "customers.total_debt";
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        $errors[] = "خطأ في إضافة عمود customers.total_debt: " . $e->getMessage();
                    }
                }
            }
        }
        
        // إعادة تفعيل فحص المفاتيح الخارجية
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        
        // حفظ حالة التهيئة
        markDatabaseAsInitialized();
        
        return [
            'success' => true,
            'message' => 'تم تهيئة قاعدة البيانات بنجاح',
            'migrations_applied' => $migrationsApplied,
            'errors' => $errors
        ];
        
    } catch (Exception $e) {
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        error_log('خطأ في تهيئة قاعدة البيانات: ' . $e->getMessage());
        return [
            'success' => false,
            'message' => 'خطأ في تهيئة قاعدة البيانات: ' . $e->getMessage(),
            'errors' => array_merge($errors, [$e->getMessage()])
        ];
    } catch (Error $e) {
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        error_log('خطأ قاتل في تهيئة قاعدة البيانات: ' . $e->getMessage());
        return [
            'success' => false,
            'message' => 'خطأ قاتل في تهيئة قاعدة البيانات: ' . $e->getMessage(),
            'errors' => array_merge($errors, [$e->getMessage()])
        ];
    }
}

/**
 * تهيئة قاعدة البيانات إذا لم تكن مهيأة
 * يتم استدعاؤها تلقائياً عند أول زيارة
 */
function autoInitializeDatabase() {
    // التحقق من حالة التهيئة
    if (isDatabaseInitialized()) {
        return [
            'success' => true,
            'message' => 'قاعدة البيانات مهيأة بالفعل',
            'initialized' => true
        ];
    }
    
    // تهيئة قاعدة البيانات
    $result = initializeDatabase();
    $result['initialized'] = false;
    
    return $result;
}

// إذا تم استدعاء الملف مباشرة (للاستخدام في API)
if (php_sapi_name() !== 'cli' && isset($_GET['action']) && $_GET['action'] === 'init') {
    $result = autoInitializeDatabase();
    response($result['success'], $result['message'], $result);
    exit;
}

?>


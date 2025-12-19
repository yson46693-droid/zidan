<?php
/**
 * ملف إعداد قاعدة البيانات التلقائي
 * يقوم بإنشاء جميع الجداول تلقائياً إذا لم تكن موجودة
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/config.php';

/**
 * إنشاء جميع الجداول تلقائياً
 * @return array
 */
function setupDatabase() {
    $conn = getDBConnection();
    if (!$conn) {
        return [
            'success' => false,
            'message' => 'فشل الاتصال بقاعدة البيانات',
            'tables_created' => []
        ];
    }
    
    $tablesCreated = [];
    $errors = [];
    
    // قائمة الجداول المطلوبة مع استعلامات الإنشاء
    $tables = [
        'customers' => "
            CREATE TABLE IF NOT EXISTS `customers` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) NOT NULL,
              `phone` varchar(50) NOT NULL,
              `address` text DEFAULT NULL,
              `customer_type` enum('retail','commercial') NOT NULL DEFAULT 'retail',
              `shop_name` varchar(255) DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_phone` (`phone`),
              KEY `idx_name` (`name`),
              KEY `idx_customer_type` (`customer_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'expenses' => "
            CREATE TABLE IF NOT EXISTS `expenses` (
              `id` varchar(50) NOT NULL,
              `type` enum('rent','electricity','salaries','parts','other') NOT NULL,
              `amount` decimal(10,2) NOT NULL,
              `description` text DEFAULT NULL,
              `expense_date` date NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_type` (`type`),
              KEY `idx_expense_date` (`expense_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'inventory' => "
            CREATE TABLE IF NOT EXISTS `inventory` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) NOT NULL,
              `quantity` int(11) NOT NULL DEFAULT 0,
              `purchase_price` decimal(10,2) DEFAULT 0.00,
              `selling_price` decimal(10,2) DEFAULT 0.00,
              `category` varchar(100) DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_category` (`category`),
              KEY `idx_name` (`name`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'spare_parts' => "
            CREATE TABLE IF NOT EXISTS `spare_parts` (
              `id` varchar(50) NOT NULL,
              `brand` varchar(100) NOT NULL,
              `model` varchar(255) NOT NULL,
              `barcode` varchar(255) DEFAULT NULL,
              `image` text DEFAULT NULL,
              `purchase_price` decimal(10,2) DEFAULT 0.00,
              `selling_price` decimal(10,2) DEFAULT 0.00,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_brand` (`brand`),
              KEY `idx_model` (`model`),
              KEY `idx_barcode` (`barcode`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'spare_part_items' => "
            CREATE TABLE IF NOT EXISTS `spare_part_items` (
              `id` varchar(50) NOT NULL,
              `spare_part_id` varchar(50) NOT NULL,
              `item_type` varchar(100) NOT NULL,
              `quantity` int(11) DEFAULT 1,
              `price` decimal(10,2) DEFAULT 0.00,
              `purchase_price` decimal(10,2) DEFAULT 0.00,
              `selling_price` decimal(10,2) DEFAULT 0.00,
              `notes` text DEFAULT NULL,
              `custom_value` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_spare_part_id` (`spare_part_id`),
              KEY `idx_item_type` (`item_type`),
              CONSTRAINT `spare_part_items_ibfk_1` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'accessories' => "
            CREATE TABLE IF NOT EXISTS `accessories` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) NOT NULL,
              `type` enum('wired_headphones','wireless_headphones','earbuds','chargers','cables','power_bank','external_battery','other') NOT NULL,
              `image` text DEFAULT NULL,
              `purchase_price` decimal(10,2) DEFAULT 0.00,
              `selling_price` decimal(10,2) DEFAULT 0.00,
              `quantity` int(11) NOT NULL DEFAULT 0,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_type` (`type`),
              KEY `idx_name` (`name`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'phones' => "
            CREATE TABLE IF NOT EXISTS `phones` (
              `id` varchar(50) NOT NULL,
              `brand` varchar(100) NOT NULL,
              `model` varchar(255) NOT NULL,
              `serial_number` varchar(255) DEFAULT NULL,
              `image` text DEFAULT NULL,
              `tax_status` enum('exempt','due') NOT NULL DEFAULT 'exempt',
              `tax_amount` decimal(10,2) DEFAULT 0.00,
              `storage` varchar(50) DEFAULT NULL,
              `ram` varchar(50) DEFAULT NULL,
              `screen_type` varchar(100) DEFAULT NULL,
              `processor` varchar(100) DEFAULT NULL,
              `battery` varchar(50) DEFAULT NULL,
              `accessories` text DEFAULT NULL,
              `password` varchar(255) DEFAULT NULL,
              `maintenance_history` text DEFAULT NULL,
              `defects` text DEFAULT NULL,
              `purchase_price` decimal(10,2) DEFAULT 0.00,
              `selling_price` decimal(10,2) DEFAULT 0.00,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_brand` (`brand`),
              KEY `idx_model` (`model`),
              KEY `idx_serial_number` (`serial_number`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'loss_operations' => "
            CREATE TABLE IF NOT EXISTS `loss_operations` (
              `id` varchar(50) NOT NULL,
              `repair_number` varchar(50) NOT NULL,
              `customer_name` varchar(255) NOT NULL,
              `device_type` varchar(100) NOT NULL,
              `problem` text NOT NULL,
              `loss_amount` decimal(10,2) NOT NULL,
              `loss_reason` text NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_repair_number` (`repair_number`),
              KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'repairs' => "
            CREATE TABLE IF NOT EXISTS `repairs` (
              `id` varchar(50) NOT NULL,
              `repair_number` varchar(50) NOT NULL,
              `customer_id` varchar(50) DEFAULT NULL,
              `customer_name` varchar(255) NOT NULL,
              `customer_phone` varchar(50) NOT NULL,
              `device_type` varchar(100) NOT NULL,
              `device_model` varchar(255) DEFAULT NULL,
              `serial_number` varchar(255) DEFAULT NULL,
              `accessories` text DEFAULT NULL,
              `problem` text NOT NULL,
              `customer_price` decimal(10,2) DEFAULT 0.00,
              `repair_cost` decimal(10,2) DEFAULT 0.00,
              `parts_store` varchar(255) DEFAULT NULL,
              `paid_amount` decimal(10,2) DEFAULT 0.00,
              `remaining_amount` decimal(10,2) DEFAULT 0.00,
              `delivery_date` date DEFAULT NULL,
              `device_image` text DEFAULT NULL,
              `status` enum('pending','in_progress','ready','delivered','cancelled') NOT NULL DEFAULT 'pending',
              `notes` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `repair_number` (`repair_number`),
              KEY `idx_repair_number` (`repair_number`),
              KEY `idx_customer_id` (`customer_id`),
              KEY `idx_status` (`status`),
              KEY `idx_created_at` (`created_at`),
              CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'settings' => "
            CREATE TABLE IF NOT EXISTS `settings` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `key` varchar(100) NOT NULL,
              `value` text DEFAULT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `key` (`key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'telegram_backup_config' => "
            CREATE TABLE IF NOT EXISTS `telegram_backup_config` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `bot_token` varchar(255) DEFAULT NULL,
              `chat_id` varchar(100) DEFAULT NULL,
              `enabled` tinyint(1) DEFAULT 0,
              `backup_interval_hours` int(11) DEFAULT 24,
              `notification_enabled` tinyint(1) DEFAULT 1,
              `last_backup_time` datetime DEFAULT NULL,
              `backup_prefix` varchar(50) DEFAULT 'backup_',
              `auto_backup_enabled` tinyint(1) DEFAULT 0,
              `compress_backup` tinyint(1) DEFAULT 1,
              `include_images` tinyint(1) DEFAULT 1,
              `auto_delete_enabled` tinyint(1) DEFAULT 0,
              `retention_days` int(11) DEFAULT 30,
              `max_backup_files` int(11) DEFAULT 10,
              `last_cleanup_time` datetime DEFAULT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'users' => "
            CREATE TABLE IF NOT EXISTS `users` (
              `id` varchar(50) NOT NULL,
              `username` varchar(100) NOT NULL,
              `password` varchar(255) NOT NULL,
              `name` varchar(255) NOT NULL,
              `role` enum('admin','manager','employee') NOT NULL DEFAULT 'employee',
              `webauthn_enabled` tinyint(1) DEFAULT 0,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `username` (`username`),
              KEY `idx_username` (`username`),
              KEY `idx_role` (`role`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'messages' => "
            CREATE TABLE IF NOT EXISTS `messages` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` varchar(50) NOT NULL,
              `message_text` text NOT NULL,
              `reply_to` int(11) DEFAULT NULL,
              `deleted` tinyint(1) DEFAULT 0,
              `edited` tinyint(1) DEFAULT 0,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_reply_to` (`reply_to`),
              KEY `idx_deleted` (`deleted`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'message_reads' => "
            CREATE TABLE IF NOT EXISTS `message_reads` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `message_id` int(11) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `read_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_read` (`message_id`, `user_id`),
              KEY `idx_message_id` (`message_id`),
              KEY `idx_user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'user_presence' => "
            CREATE TABLE IF NOT EXISTS `user_presence` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` varchar(50) NOT NULL,
              `is_online` tinyint(1) DEFAULT 0,
              `last_seen` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_user` (`user_id`),
              KEY `idx_is_online` (`is_online`),
              KEY `idx_last_seen` (`last_seen`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'webauthn_credentials' => "
            CREATE TABLE IF NOT EXISTS `webauthn_credentials` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` varchar(50) NOT NULL,
              `credential_id` text NOT NULL,
              `public_key` text NOT NULL,
              `device_name` varchar(255) DEFAULT NULL,
              `counter` int(11) DEFAULT 0,
              `created_at` datetime NOT NULL,
              `last_used` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_credential_id` (`credential_id`(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'sales' => "
            CREATE TABLE IF NOT EXISTS `sales` (
              `id` varchar(50) NOT NULL,
              `sale_number` varchar(50) NOT NULL,
              `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
              `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
              `tax` decimal(10,2) NOT NULL DEFAULT 0.00,
              `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
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
        ",
        
        'sale_items' => "
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
        "
    ];
    
    // تعطيل فحص المفاتيح الخارجية مؤقتاً لتسهيل الإنشاء
    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    
    // إنشاء الجداول بالترتيب الصحيح (مع مراعاة العلاقات)
    $tableOrder = [
        'users',
        'customers',
        'settings',
        'telegram_backup_config',
        'expenses',
        'inventory',
        'spare_parts',
        'spare_part_items',
        'accessories',
        'phones',
        'repairs',
        'loss_operations',
        'sales',
        'sale_items',
        'messages',
        'message_reads',
        'user_presence',
        'webauthn_credentials'
    ];
    
    foreach ($tableOrder as $tableName) {
        if (!isset($tables[$tableName])) {
            continue;
        }
        
        // التحقق من وجود الجدول أولاً
        if (dbTableExists($tableName)) {
            continue; // الجدول موجود بالفعل
        }
        
        // محاولة إنشاء الجدول
        $sql = $tables[$tableName];
        
        // إزالة الفواصل الزائدة وتنظيف SQL
        $sql = preg_replace('/\s+/', ' ', $sql);
        $sql = trim($sql);
        
        // تنفيذ الاستعلام
        if ($conn->query($sql)) {
            $tablesCreated[] = $tableName;
        } else {
            $error = $conn->error;
            // تجاهل الأخطاء المتعلقة بالجداول الموجودة بالفعل
            if (strpos($error, 'already exists') === false && 
                strpos($error, 'Duplicate') === false &&
                strpos($error, 'Table') === false) {
                $errors[] = "خطأ في إنشاء جدول $tableName: $error";
                error_log("خطأ في إنشاء جدول $tableName: $error");
            }
        }
    }
    
    // إعادة تفعيل فحص المفاتيح الخارجية
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");
    
    // تطبيق التحديثات على الجداول الموجودة (إضافة الأعمدة الناقصة)
    $migrationsApplied = applyDatabaseMigrations($conn);
    
    // إدراج البيانات الافتراضية إذا لم تكن موجودة
    insertDefaultData($conn);
    
    return [
        'success' => true,
        'message' => count($tablesCreated) > 0 ? 'تم إنشاء ' . count($tablesCreated) . ' جدول بنجاح' : 'جميع الجداول موجودة بالفعل',
        'tables_created' => $tablesCreated,
        'migrations_applied' => $migrationsApplied,
        'errors' => $errors
    ];
}

/**
 * تطبيق التحديثات على قاعدة البيانات (إضافة الأعمدة الناقصة)
 * @param mysqli $conn
 * @return array
 */
function applyDatabaseMigrations($conn) {
    $migrationsApplied = [];
    
    // الحصول على اسم قاعدة البيانات الحالية
    $result = $conn->query("SELECT DATABASE() as dbname");
    $dbname = $result ? $result->fetch_assoc()['dbname'] : DB_NAME;
    
    // التحقق من وجود عمود quantity في جدول accessories
    if (dbTableExists('accessories')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'accessories' AND COLUMN_NAME = 'quantity'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkColumn = $stmt->get_result();
        if ($checkColumn) {
            $result = $checkColumn->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `accessories` ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`");
                $migrationsApplied[] = 'accessories.quantity';
            }
        }
        $stmt->close();
    }
    
    // التحقق من وجود purchase_price و selling_price في جدول spare_part_items
    if (dbTableExists('spare_part_items')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spare_part_items' AND COLUMN_NAME = 'purchase_price'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkPurchasePrice = $stmt->get_result();
        if ($checkPurchasePrice) {
            $result = $checkPurchasePrice->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `spare_part_items` ADD COLUMN `purchase_price` decimal(10,2) DEFAULT 0.00 AFTER `quantity`");
                $migrationsApplied[] = 'spare_part_items.purchase_price';
                
                // نسخ البيانات من price إلى purchase_price
                $conn->query("UPDATE `spare_part_items` SET `purchase_price` = COALESCE(`price`, 0) WHERE `purchase_price` IS NULL OR `purchase_price` = 0");
            }
        }
        $stmt->close();
        
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spare_part_items' AND COLUMN_NAME = 'selling_price'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkSellingPrice = $stmt->get_result();
        if ($checkSellingPrice) {
            $result = $checkSellingPrice->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `spare_part_items` ADD COLUMN `selling_price` decimal(10,2) DEFAULT 0.00 AFTER `purchase_price`");
                $migrationsApplied[] = 'spare_part_items.selling_price';
                
                // نسخ البيانات من price إلى selling_price
                $conn->query("UPDATE `spare_part_items` SET `selling_price` = COALESCE(`price`, 0) WHERE `selling_price` IS NULL OR `selling_price` = 0");
            }
        }
        $stmt->close();
    }
    
    // التحقق من وجود webauthn_enabled في جدول users
    if (dbTableExists('users')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'webauthn_enabled'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkColumn = $stmt->get_result();
        if ($checkColumn) {
            $result = $checkColumn->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `users` ADD COLUMN `webauthn_enabled` tinyint(1) DEFAULT 0");
                $migrationsApplied[] = 'users.webauthn_enabled';
            }
        }
        $stmt->close();
    }
    
    return $migrationsApplied;
}

/**
 * إدراج البيانات الافتراضية
 */
function insertDefaultData($conn) {
    // التحقق من وجود جدول settings أولاً
    if (!dbTableExists('settings')) {
        return;
    }
    
    // إدراج الإعدادات الافتراضية
    $settings = [
        ['shop_name', 'ALAA ZIDAN'],
        ['shop_phone', '01276855966'],
        ['shop_address', 'الاسكندريه,العجمي'],
        ['shop_logo', ''],
        ['low_stock_alert', '0'],
        ['currency', 'ج.م'],
        ['theme', 'light']
    ];
    
    foreach ($settings as $setting) {
        $key = $conn->real_escape_string($setting[0]);
        $value = $conn->real_escape_string($setting[1]);
        
        // التحقق من وجود الإعداد
        $check = $conn->query("SELECT id FROM settings WHERE `key` = '$key'");
        if ($check && $check->num_rows == 0) {
            $conn->query("INSERT INTO settings (`key`, `value`, `updated_at`) VALUES ('$key', '$value', NOW())");
        }
    }
    
    // التحقق من وجود جدول telegram_backup_config
    if (dbTableExists('telegram_backup_config')) {
        $check = $conn->query("SELECT id FROM telegram_backup_config LIMIT 1");
        if ($check && $check->num_rows == 0) {
            $conn->query("INSERT INTO telegram_backup_config (bot_token, chat_id, enabled, backup_interval_hours, notification_enabled, backup_prefix, auto_backup_enabled, compress_backup, include_images, auto_delete_enabled, retention_days, max_backup_files, updated_at) VALUES ('', '', 0, 24, 1, 'backup_', 0, 1, 1, 0, 30, 10, NOW())");
        }
    }
    
    // التحقق من وجود جدول users
    if (dbTableExists('users')) {
        $check = $conn->query("SELECT id FROM users WHERE username = '1' LIMIT 1");
        if ($check && $check->num_rows == 0) {
            $adminId = uniqid('admin_', true);
            $hashedPassword = password_hash('1', PASSWORD_DEFAULT);
            $hashedPassword = $conn->real_escape_string($hashedPassword);
            $conn->query("INSERT INTO users (id, username, password, name, role, created_at) VALUES ('$adminId', '1', '$hashedPassword', 'المدير', 'admin', NOW())");
        }
    }
}

/**
 * التحقق من إعداد قاعدة البيانات (للاستدعاء من API)
 */
if (php_sapi_name() !== 'cli' && isset($_GET['action']) && $_GET['action'] === 'setup') {
    $result = setupDatabase();
    response($result['success'], $result['message'], $result);
    exit;
}

?>

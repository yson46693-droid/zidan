<?php
/**
 * ملف إعداد قاعدة البيانات التلقائي
 * يقوم بإنشاء جميع الجداول تلقائياً إذا لم تكن موجودة
 */

require_once __DIR__ . '/database.php';
// لا نستدعي config.php هنا لتجنب الاعتماد الدائري
// سيتم استدعاؤه فقط عند الحاجة في نهاية الملف

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
              `notes` text DEFAULT NULL,
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
        
        'treasury_transactions' => "
            CREATE TABLE IF NOT EXISTS `treasury_transactions` (
              `id` varchar(50) NOT NULL,
              `branch_id` varchar(50) NOT NULL,
              `transaction_type` enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal') NOT NULL,
              `amount` decimal(10,2) NOT NULL,
              `description` text DEFAULT NULL,
              `reference_id` varchar(50) DEFAULT NULL,
              `reference_type` varchar(50) DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_branch_id` (`branch_id`),
              KEY `idx_transaction_type` (`transaction_type`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_reference` (`reference_id`, `reference_type`)
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
              `status` enum('received','under_inspection','awaiting_customer_approval','in_progress','ready_for_delivery','delivered','cancelled','lost') NOT NULL DEFAULT 'received',
              `branch_id` varchar(50) DEFAULT NULL,
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
              KEY `idx_branch_id` (`branch_id`),
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
        
        'branches' => "
            CREATE TABLE IF NOT EXISTS `branches` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) NOT NULL,
              `code` varchar(50) NOT NULL,
              `has_pos` tinyint(1) DEFAULT 0,
              `is_active` tinyint(1) DEFAULT 1,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `code` (`code`),
              KEY `idx_name` (`name`),
              KEY `idx_is_active` (`is_active`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'users' => "
            CREATE TABLE IF NOT EXISTS `users` (
              `id` varchar(50) NOT NULL,
              `username` varchar(100) NOT NULL,
              `password` varchar(255) NOT NULL,
              `name` varchar(255) NOT NULL,
              `role` enum('admin','manager','employee','technician') NOT NULL,
              `webauthn_enabled` tinyint(1) DEFAULT 0,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `username` (`username`),
              KEY `idx_username` (`username`),
              KEY `idx_role` (`role`)
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
        ",
        
        'product_returns' => "
            CREATE TABLE IF NOT EXISTS `product_returns` (
              `id` varchar(50) NOT NULL,
              `return_number` varchar(50) NOT NULL,
              `sale_id` varchar(50) NOT NULL,
              `sale_number` varchar(50) NOT NULL,
              `customer_id` varchar(50) DEFAULT NULL,
              `customer_name` varchar(255) DEFAULT NULL,
              `total_returned_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
              `status` enum('completed','cancelled') NOT NULL DEFAULT 'completed',
              `notes` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `return_number` (`return_number`),
              KEY `idx_sale_id` (`sale_id`),
              KEY `idx_sale_number` (`sale_number`),
              KEY `idx_customer_id` (`customer_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_created_by` (`created_by`),
              CONSTRAINT `product_returns_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
              CONSTRAINT `product_returns_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'product_return_items' => "
            CREATE TABLE IF NOT EXISTS `product_return_items` (
              `id` varchar(50) NOT NULL,
              `return_id` varchar(50) NOT NULL,
              `sale_item_id` varchar(50) NOT NULL,
              `item_type` enum('spare_part','accessory','phone','inventory') NOT NULL,
              `item_id` varchar(50) NOT NULL,
              `item_name` varchar(255) NOT NULL,
              `original_quantity` int(11) NOT NULL DEFAULT 1,
              `returned_quantity` int(11) NOT NULL DEFAULT 1,
              `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
              `total_price` decimal(10,2) NOT NULL DEFAULT 0.00,
              `is_damaged` tinyint(1) NOT NULL DEFAULT 0,
              `created_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_return_id` (`return_id`),
              KEY `idx_sale_item_id` (`sale_item_id`),
              KEY `idx_item_type` (`item_type`),
              KEY `idx_item_id` (`item_id`),
              KEY `idx_is_damaged` (`is_damaged`),
              CONSTRAINT `product_return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `product_returns` (`id`) ON DELETE CASCADE,
              CONSTRAINT `product_return_items_ibfk_2` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'customer_ratings' => "
            CREATE TABLE IF NOT EXISTS `customer_ratings` (
              `id` varchar(50) NOT NULL,
              `customer_id` varchar(50) NOT NULL,
              `sale_id` varchar(50) DEFAULT NULL,
              `rating` tinyint(1) NOT NULL DEFAULT 5,
              `rating_type` enum('transaction','manual') NOT NULL DEFAULT 'transaction',
              `created_at` datetime NOT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_customer_id` (`customer_id`),
              KEY `idx_sale_id` (`sale_id`),
              KEY `idx_rating` (`rating`),
              KEY `idx_created_at` (`created_at`),
              CONSTRAINT `customer_ratings_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
              CONSTRAINT `customer_ratings_ibfk_2` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_rooms' => "
            CREATE TABLE IF NOT EXISTS `chat_rooms` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) DEFAULT NULL,
              `type` enum('group','private') NOT NULL DEFAULT 'group',
              `created_by` varchar(50) NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_type` (`type`),
              KEY `idx_created_by` (`created_by`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_participants' => "
            CREATE TABLE IF NOT EXISTS `chat_participants` (
              `id` varchar(50) NOT NULL,
              `room_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `joined_at` datetime NOT NULL,
              `last_read_at` datetime DEFAULT NULL,
              `unread_count` int(11) DEFAULT 0,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_room_user` (`room_id`, `user_id`),
              KEY `idx_room_id` (`room_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_unread_count` (`unread_count`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_messages' => "
            CREATE TABLE IF NOT EXISTS `chat_messages` (
              `id` varchar(50) NOT NULL,
              `room_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `message` text NOT NULL,
              `message_type` enum('text','image','file','voice') NOT NULL DEFAULT 'text',
              `file_url` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `deleted_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_room_id` (`room_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_deleted_at` (`deleted_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_reactions' => "
            CREATE TABLE IF NOT EXISTS `chat_reactions` (
              `id` varchar(50) NOT NULL,
              `message_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `reaction_type` varchar(20) NOT NULL DEFAULT 'like',
              `created_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_message_user_reaction` (`message_id`, `user_id`, `reaction_type`),
              KEY `idx_message_id` (`message_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_reaction_type` (`reaction_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'notifications' => "
            CREATE TABLE IF NOT EXISTS `notifications` (
              `id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `type` varchar(50) NOT NULL DEFAULT 'mention',
              `title` varchar(255) NOT NULL,
              `message` text NOT NULL,
              `related_id` varchar(50) DEFAULT NULL,
              `is_read` tinyint(1) DEFAULT 0,
              `created_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_type` (`type`),
              KEY `idx_is_read` (`is_read`),
              KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'salary_deductions' => "
            CREATE TABLE IF NOT EXISTS `salary_deductions` (
              `id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `amount` decimal(10,2) NOT NULL,
              `type` enum('withdrawal','deduction') NOT NULL DEFAULT 'withdrawal',
              `description` text DEFAULT NULL,
              `month_year` date NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `created_by` varchar(50) DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_month_year` (`month_year`),
              KEY `idx_type` (`type`),
              KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'repair_ratings' => "
            CREATE TABLE IF NOT EXISTS `repair_ratings` (
              `id` varchar(50) NOT NULL,
              `repair_id` varchar(50) DEFAULT NULL,
              `repair_number` varchar(50) NOT NULL,
              `repair_rating` tinyint(1) NOT NULL DEFAULT 5,
              `technician_rating` tinyint(1) NOT NULL DEFAULT 5,
              `comment` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_repair_id` (`repair_id`),
              KEY `idx_repair_number` (`repair_number`),
              KEY `idx_created_at` (`created_at`),
              CONSTRAINT `repair_ratings_ibfk_1` FOREIGN KEY (`repair_id`) REFERENCES `repairs` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'technician_manual_ratings' => "
            CREATE TABLE IF NOT EXISTS `technician_manual_ratings` (
              `id` varchar(50) NOT NULL,
              `technician_id` varchar(50) NOT NULL,
              `rating` tinyint(1) NOT NULL,
              `note` text DEFAULT NULL,
              `created_by` varchar(50) NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_technician_id` (`technician_id`),
              KEY `idx_created_at` (`created_at`),
              CONSTRAINT `technician_manual_ratings_ibfk_1` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "
    ];
    
    // تعطيل فحص المفاتيح الخارجية مؤقتاً لتسهيل الإنشاء
    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    
    // إنشاء الجداول بالترتيب الصحيح (مع مراعاة العلاقات)
    $tableOrder = [
        'branches',
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
        'repair_ratings',
        'technician_manual_ratings',
        'loss_operations',
        'treasury_transactions',
        'sales',
        'sale_items',
        'product_returns',
        'product_return_items',
        'customer_ratings',
        'webauthn_credentials',
        'chat_rooms',
        'chat_participants',
        'chat_messages',
        'chat_reactions',
        'notifications',
        'salary_deductions'
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
        
        // التحقق من وجود branch_id في جدول users
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'branch_id'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkBranchId = $stmt->get_result();
        if ($checkBranchId) {
            $result = $checkBranchId->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `users` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `role`");
                // إضافة فهرس للعمود
                $conn->query("ALTER TABLE `users` ADD KEY `idx_branch_id` (`branch_id`)");
                $migrationsApplied[] = 'users.branch_id';
            }
        }
        $stmt->close();
        
        // التحقق من وجود avatar في جدول users
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkAvatar = $stmt->get_result();
        if ($checkAvatar) {
            $result = $checkAvatar->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `users` ADD COLUMN `avatar` text DEFAULT NULL AFTER `name`");
                $migrationsApplied[] = 'users.avatar';
            }
        }
        $stmt->close();
        
        // التحقق من وجود salary في جدول users
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'salary'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkSalary = $stmt->get_result();
        if ($checkSalary) {
            $result = $checkSalary->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `users` ADD COLUMN `salary` decimal(10,2) DEFAULT 0.00 AFTER `branch_id`");
                $migrationsApplied[] = 'users.salary';
            }
        }
        $stmt->close();
    }
    
    // التحقق من وجود branch_id في جدول expenses
    if (dbTableExists('expenses')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'branch_id'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkBranchId = $stmt->get_result();
        if ($checkBranchId) {
            $result = $checkBranchId->fetch_assoc();
            if ($result['count'] == 0) {
                try {
                    $conn->query("ALTER TABLE `expenses` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `expense_date`");
                    // إضافة فهرس للعمود
                    $conn->query("ALTER TABLE `expenses` ADD KEY `idx_branch_id` (`branch_id`)");
                    $migrationsApplied[] = 'expenses.branch_id';
                    error_log("✅ تم إضافة عمود branch_id إلى جدول expenses");
                } catch (Exception $e) {
                    error_log("❌ خطأ في إضافة عمود expenses.branch_id: " . $e->getMessage());
                }
            }
        }
        $stmt->close();
    }
    
    // التحقق من وجود battery_percent في جدول phones
    if (dbTableExists('phones')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'phones' AND COLUMN_NAME = 'battery_percent'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkBatteryPercent = $stmt->get_result();
        if ($checkBatteryPercent) {
            $result = $checkBatteryPercent->fetch_assoc();
            if ($result['count'] == 0) {
                try {
                    $conn->query("ALTER TABLE `phones` ADD COLUMN `battery_percent` int(11) DEFAULT NULL AFTER `battery`");
                    $migrationsApplied[] = 'phones.battery_percent';
                    error_log("✅ تم إضافة عمود battery_percent إلى جدول phones");
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        error_log("❌ خطأ في إضافة عمود phones.battery_percent: " . $e->getMessage());
                    }
                }
            }
        }
        $stmt->close();
    }
    
    // إضافة عمود notes إلى customers إذا لم يكن موجوداً
    if (dbTableExists('customers')) {
        // دالة مساعدة لتحديد العمود المرجعي بشكل آمن
        $getAfterColumn = function($preferredColumns, $fallback = 'phone') use ($conn, $dbname) {
            foreach ($preferredColumns as $col) {
                $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?");
                $stmt->bind_param('ss', $dbname, $col);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                $stmt->close();
                if ($row && $row['count'] > 0) {
                    return $col;
                }
            }
            // التحقق من العمود الافتراضي
            $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?");
            $stmt->bind_param('ss', $dbname, $fallback);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
            if ($row && $row['count'] > 0) {
                return $fallback;
            }
            return null; // استخدام FIRST
        };
        
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'notes'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkNotes = $stmt->get_result();
        if ($checkNotes) {
            $result = $checkNotes->fetch_assoc();
            if ($result['count'] == 0) {
                $afterCol = $getAfterColumn(['shop_name', 'customer_type', 'phone'], 'address');
                $sql = $afterCol ? 
                    "ALTER TABLE `customers` ADD COLUMN `notes` text DEFAULT NULL AFTER `{$afterCol}`" :
                    "ALTER TABLE `customers` ADD COLUMN `notes` text DEFAULT NULL FIRST";
                try {
                    $conn->query($sql);
                    $migrationsApplied[] = 'customers.notes';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        error_log("خطأ في إضافة عمود customers.notes: " . $e->getMessage());
                    }
                }
            }
        }
        $stmt->close();
        
        // التحقق من وجود branch_id في جدول customers
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'branch_id'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkBranchId = $stmt->get_result();
        if ($checkBranchId) {
            $result = $checkBranchId->fetch_assoc();
            if ($result['count'] == 0) {
                $afterCol = $getAfterColumn(['shop_name', 'customer_type', 'phone'], 'address');
                $sql = $afterCol ? 
                    "ALTER TABLE `customers` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `{$afterCol}`" :
                    "ALTER TABLE `customers` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL FIRST";
                try {
                    $conn->query($sql);
                    // إضافة فهرس للعمود
                    try {
                        $conn->query("ALTER TABLE `customers` ADD KEY `idx_branch_id` (`branch_id`)");
                    } catch (Exception $e) {
                        // الفهرس موجود بالفعل
                    }
                    $migrationsApplied[] = 'customers.branch_id';
                } catch (Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate column') === false && 
                        strpos($e->getMessage(), 'Unknown column') === false) {
                        error_log("خطأ في إضافة عمود customers.branch_id: " . $e->getMessage());
                    }
                }
            }
        }
        $stmt->close();
    }
    
    // التحقق من وجود branch_id في جدول repairs
    if (dbTableExists('repairs')) {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'repairs' AND COLUMN_NAME = 'branch_id'");
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $checkBranchId = $stmt->get_result();
        if ($checkBranchId) {
            $result = $checkBranchId->fetch_assoc();
            if ($result['count'] == 0) {
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `status`");
                // إضافة فهرس للعمود
                $conn->query("ALTER TABLE `repairs` ADD KEY `idx_branch_id` (`branch_id`)");
                $migrationsApplied[] = 'repairs.branch_id';
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
    
    // التحقق من وجود جدول branches وإضافة الفروع الافتراضية
    if (dbTableExists('branches')) {
        try {
            // إضافة فرع الهانوفيل
            $checkHanovil = dbSelectOne("SELECT id FROM branches WHERE code = ? LIMIT 1", ['HANOVIL']);
            if ($checkHanovil === false || $checkHanovil === null) {
                $hanovilId = uniqid('branch_', true);
                $result = dbExecute(
                    "INSERT INTO branches (id, name, code, has_pos, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                    [$hanovilId, 'الهانوفيل', 'HANOVIL', 1, 1]
                );
                if ($result === false) {
                    error_log('خطأ في إضافة فرع الهانوفيل');
                } else {
                    error_log('✅ تم إضافة فرع الهانوفيل بنجاح');
                }
            } else {
                error_log('ℹ️ فرع الهانوفيل موجود بالفعل');
            }
            
            // إضافة فرع البيطاش
            $checkBitash = dbSelectOne("SELECT id FROM branches WHERE code = ? LIMIT 1", ['BITASH']);
            if ($checkBitash === false || $checkBitash === null) {
                $bitashId = uniqid('branch_', true);
                $result = dbExecute(
                    "INSERT INTO branches (id, name, code, has_pos, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                    [$bitashId, 'البيطاش', 'BITASH', 1, 1]
                );
                if ($result === false) {
                    error_log('خطأ في إضافة فرع البيطاش');
                } else {
                    error_log('✅ تم إضافة فرع البيطاش بنجاح');
                }
            } else {
                error_log('ℹ️ فرع البيطاش موجود بالفعل');
            }
        } catch (Exception $e) {
            error_log('خطأ في إضافة الفروع الافتراضية: ' . $e->getMessage());
        }
    } else {
        error_log('⚠️ جدول branches غير موجود - سيتم إنشاؤه لاحقاً');
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
 * التحقق من إعداد قاعدة البيانات (للاستدعاء من API أو فتح الملف مباشرة)
 * ✅ إصلاح: التحقق من أن الملف تم فتحه مباشرة وليس من ملف آخر
 */
if (php_sapi_name() !== 'cli') {
    // ✅ التحقق من أن الملف تم فتحه مباشرة (basename من SCRIPT_NAME)
    $scriptName = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $isDirectAccess = ($scriptName === 'setup.php');
    
    // إذا تم فتح الملف مباشرة أو مع ?action=setup
    if ($isDirectAccess && (!isset($_GET['action']) || $_GET['action'] === 'setup')) {
        // تعيين علامة لتجنب الاعتماد الدائري مع config.php
        if (!defined('SETUP_RUNNING')) {
            define('SETUP_RUNNING', true);
        }
        
        // تفعيل عرض الأخطاء للتصحيح
        error_reporting(E_ALL);
        ini_set('display_errors', 0); // لا نعرض الأخطاء مباشرة، سنعرضها في JSON
        ini_set('log_errors', 1);
        
        try {
            $result = setupDatabase();
            
            // إرجاع النتيجة كـ JSON
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => $result['success'],
                'message' => $result['message'],
                'tables_created' => $result['tables_created'] ?? [],
                'migrations_applied' => $result['migrations_applied'] ?? [],
                'errors' => $result['errors'] ?? []
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        } catch (Exception $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'خطأ في إعداد قاعدة البيانات: ' . $e->getMessage(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        } catch (Error $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'خطأ قاتل في إعداد قاعدة البيانات: ' . $e->getMessage(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        }
        exit;
    }
}

?>

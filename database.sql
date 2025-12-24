-- ============================================
-- ملف قاعدة البيانات الموحد
-- نظام إدارة محل صيانة الهواتف
-- ============================================
-- هذا الملف آمن للتشغيل عدة مرات (idempotent)
-- يستخدم IF NOT EXISTS و IF EXISTS للتحقق من وجود الجداول/الأعمدة
-- ============================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================
-- 1. إنشاء الجداول الأساسية
-- ============================================

-- جدول العملاء
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المصروفات
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المخزون
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول قطع الغيار
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول عناصر قطع الغيار
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الإكسسوارات
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الهواتف
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول العمليات الخاسرة
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول عمليات الصيانة
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
  `repair_type` enum('soft','hard','fast') DEFAULT 'soft',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الإعدادات
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول إعدادات النسخ الاحتياطي عبر Telegram
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المستخدمين
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المبيعات (POS)
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
  KEY `idx_created_at` (`created_at`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول عناصر المبيعات
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول بيانات WebAuthn (البصمة)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول تقييمات العملاء
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. إدراج البيانات الافتراضية
-- ============================================

-- إدراج الإعدادات الافتراضية (فقط إذا لم تكن موجودة)
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `updated_at`) VALUES
(1, 'shop_name', 'ALAA ZIDAN', '2025-12-18 00:01:53'),
(2, 'shop_phone', '01276855966', '2025-12-18 00:01:53'),
(3, 'shop_address', 'الاسكندريه,العجمي', '2025-12-18 00:01:53'),
(4, 'shop_logo', '', '2025-12-18 00:01:53'),
(5, 'low_stock_alert', '0', '2025-12-18 00:01:53'),
(6, 'currency', 'ج.م', '2025-12-18 00:01:53'),
(7, 'theme', 'light', '2025-12-18 00:01:53');

-- إدراج إعدادات النسخ الاحتياطي الافتراضية (فقط إذا لم تكن موجودة)
INSERT IGNORE INTO `telegram_backup_config` (`id`, `bot_token`, `chat_id`, `enabled`, `backup_interval_hours`, `notification_enabled`, `last_backup_time`, `backup_prefix`, `auto_backup_enabled`, `compress_backup`, `include_images`, `auto_delete_enabled`, `retention_days`, `max_backup_files`, `last_cleanup_time`, `updated_at`) VALUES
(1, '', '', 0, 24, 1, NULL, 'backup_', 0, 1, 1, 0, 30, 10, NULL, '2025-12-18 00:01:53');

-- إدراج المستخدم الافتراضي (فقط إذا لم يكن موجوداً)
INSERT IGNORE INTO `users` (`id`, `username`, `password`, `name`, `role`, `webauthn_enabled`, `created_at`, `updated_at`) VALUES
('admin_1766045240', '1', '$2y$12$5BqYDsqaEtrxR3Jpy8RCte04crOTe4/rM7Hu0m4e9LfyzfFXuim1e', 'المدير', 'admin', 0, '2025-12-18 00:07:20', NULL);

COMMIT;

-- ============================================
-- 3. الهجرات (Migrations) - آمنة للتشغيل عدة مرات
-- ============================================

SET @dbname = DATABASE();

-- إضافة customer_type و shop_name إلى customers (إذا لم تكن موجودة)
SET @tablename = "customers";
SET @columnname = "customer_type";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " ENUM('retail', 'commercial') NOT NULL DEFAULT 'retail' AFTER `address`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "shop_name";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `customer_type`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة فهرس customer_type (إذا لم يكن موجوداً)
SET @indexname = "idx_customer_type";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD INDEX ", @indexname, " (`customer_type`)")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة customer_id إلى sales (إذا لم يكن موجوداً)
SET @tablename = "sales";
SET @columnname = "customer_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(50) DEFAULT NULL AFTER `final_amount`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة فهرس customer_id في sales (إذا لم يكن موجوداً)
SET @indexname = "idx_customer_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD INDEX ", @indexname, " (`customer_id`)")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة quantity إلى accessories (إذا لم يكن موجوداً)
SET @tablename = "accessories";
SET @columnname = "quantity";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " int(11) NOT NULL DEFAULT 0 AFTER `selling_price`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة purchase_price إلى spare_part_items (إذا لم يكن موجوداً)
SET @tablename = "spare_part_items";
SET @columnname = "purchase_price";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " decimal(10,2) DEFAULT 0.00 AFTER `quantity`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- نسخ البيانات من price إلى purchase_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `purchase_price` = COALESCE(`purchase_price`, `price`, 0)
WHERE `purchase_price` IS NULL OR `purchase_price` = 0;

-- إضافة selling_price إلى spare_part_items (إذا لم يكن موجوداً)
SET @columnname = "selling_price";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " decimal(10,2) DEFAULT 0.00 AFTER `purchase_price`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- نسخ البيانات من price إلى selling_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `selling_price` = COALESCE(`selling_price`, `price`, 0)
WHERE `selling_price` IS NULL OR `selling_price` = 0;

-- إضافة repair_type إلى repairs (إذا لم يكن موجوداً)
SET @tablename = "repairs";
SET @columnname = "repair_type";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL;

-- إضافة webauthn_enabled إلى users (إذا لم يكن موجوداً)
SET @tablename = "users";
SET @columnname = "webauthn_enabled";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " tinyint(1) DEFAULT 0")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة notes إلى customers (إذا لم يكن موجوداً)
SET @tablename = "customers";
SET @columnname = "notes";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " text DEFAULT NULL AFTER `shop_name`")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT 'تم تطبيق جميع الهجرات بنجاح!' AS message;

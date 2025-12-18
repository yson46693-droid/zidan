-- قاعدة بيانات نظام إدارة محل صيانة الهواتف
-- MySQL 5.7+ أو MariaDB 10.2+

-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS `mobile_repair_shop` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `mobile_repair_shop`;

-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  INDEX `idx_username` (`username`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول العملاء
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `address` TEXT,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  `created_by` VARCHAR(50),
  INDEX `idx_phone` (`phone`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول عمليات الصيانة
CREATE TABLE IF NOT EXISTS `repairs` (
  `id` VARCHAR(50) PRIMARY KEY,
  `repair_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` VARCHAR(50),
  `customer_name` VARCHAR(255) NOT NULL,
  `customer_phone` VARCHAR(50) NOT NULL,
  `device_type` VARCHAR(100) NOT NULL,
  `device_model` VARCHAR(255),
  `serial_number` VARCHAR(255),
  `accessories` TEXT,
  `problem` TEXT NOT NULL,
  `customer_price` DECIMAL(10,2) DEFAULT 0.00,
  `repair_cost` DECIMAL(10,2) DEFAULT 0.00,
  `parts_store` VARCHAR(255),
  `paid_amount` DECIMAL(10,2) DEFAULT 0.00,
  `remaining_amount` DECIMAL(10,2) DEFAULT 0.00,
  `delivery_date` DATE,
  `device_image` TEXT,
  `status` ENUM('pending', 'in_progress', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  `created_by` VARCHAR(50),
  INDEX `idx_repair_number` (`repair_number`),
  INDEX `idx_customer_id` (`customer_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المخزون (قطع الغيار)
CREATE TABLE IF NOT EXISTS `inventory` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `purchase_price` DECIMAL(10,2) DEFAULT 0.00,
  `selling_price` DECIMAL(10,2) DEFAULT 0.00,
  `category` VARCHAR(100),
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  `created_by` VARCHAR(50),
  INDEX `idx_category` (`category`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المصروفات
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(50) PRIMARY KEY,
  `type` ENUM('rent', 'electricity', 'salaries', 'parts', 'other') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `description` TEXT,
  `expense_date` DATE NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  `created_by` VARCHAR(50),
  INDEX `idx_type` (`type`),
  INDEX `idx_expense_date` (`expense_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول العمليات الخاسرة
CREATE TABLE IF NOT EXISTS `loss_operations` (
  `id` VARCHAR(50) PRIMARY KEY,
  `repair_number` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(255) NOT NULL,
  `device_type` VARCHAR(100) NOT NULL,
  `problem` TEXT NOT NULL,
  `loss_amount` DECIMAL(10,2) NOT NULL,
  `loss_reason` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME DEFAULT NULL,
  INDEX `idx_repair_number` (`repair_number`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الإعدادات
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  `value` TEXT,
  `updated_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول إعدادات النسخ الاحتياطي عبر Telegram
CREATE TABLE IF NOT EXISTS `telegram_backup_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bot_token` VARCHAR(255),
  `chat_id` VARCHAR(100),
  `enabled` TINYINT(1) DEFAULT 0,
  `backup_interval_hours` INT DEFAULT 24,
  `notification_enabled` TINYINT(1) DEFAULT 1,
  `last_backup_time` DATETIME DEFAULT NULL,
  `backup_prefix` VARCHAR(50) DEFAULT 'backup_',
  `auto_backup_enabled` TINYINT(1) DEFAULT 0,
  `compress_backup` TINYINT(1) DEFAULT 1,
  `include_images` TINYINT(1) DEFAULT 1,
  `auto_delete_enabled` TINYINT(1) DEFAULT 0,
  `retention_days` INT DEFAULT 30,
  `max_backup_files` INT DEFAULT 10,
  `last_cleanup_time` DATETIME DEFAULT NULL,
  `updated_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إدراج المستخدم الافتراضي (سيتم إنشاؤه تلقائياً من config.php إذا لم يكن موجوداً)
-- كلمة المرور الافتراضية: admin123

-- إدراج الإعدادات الافتراضية
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES
('shop_name', 'محل صيانة الهواتف', NOW()),
('shop_phone', '01000000000', NOW()),
('shop_address', 'القاهرة، مصر', NOW()),
('shop_logo', '', NOW()),
('low_stock_alert', '5', NOW()),
('currency', 'ج.م', NOW()),
('theme', 'light', NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- إدراج إعدادات النسخ الاحتياطي الافتراضية
INSERT INTO `telegram_backup_config` (
  `bot_token`, 
  `chat_id`, 
  `enabled`, 
  `backup_interval_hours`, 
  `notification_enabled`,
  `backup_prefix`,
  `auto_backup_enabled`,
  `compress_backup`,
  `include_images`,
  `auto_delete_enabled`,
  `retention_days`,
  `max_backup_files`,
  `updated_at`
) VALUES (
  '',
  '',
  0,
  24,
  1,
  'backup_',
  0,
  1,
  1,
  0,
  30,
  10,
  NOW()
) ON DUPLICATE KEY UPDATE `updated_at` = NOW();


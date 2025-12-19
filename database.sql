
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";



--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `address` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` varchar(50) NOT NULL,
  `type` enum('rent','electricity','salaries','parts','other') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `expense_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `category` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `spare_parts`
--

CREATE TABLE `spare_parts` (
  `id` varchar(50) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `model` varchar(255) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `spare_part_items`
--

CREATE TABLE `spare_part_items` (
  `id` varchar(50) NOT NULL,
  `spare_part_id` varchar(50) NOT NULL,
  `item_type` varchar(100) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `price` decimal(10,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `custom_value` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `accessories`
--

CREATE TABLE `accessories` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('wired_headphones','wireless_headphones','earbuds','chargers','cables','power_bank','external_battery','other') NOT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `phones`
--

CREATE TABLE `phones` (
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
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loss_operations`
--

CREATE TABLE `loss_operations` (
  `id` varchar(50) NOT NULL,
  `repair_number` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `device_type` varchar(100) NOT NULL,
  `problem` text NOT NULL,
  `loss_amount` decimal(10,2) NOT NULL,
  `loss_reason` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repairs`
--

CREATE TABLE `repairs` (
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
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `key`, `value`, `updated_at`) VALUES
(1, 'shop_name', 'ALAA ZIDAN', '2025-12-18 00:01:53'),
(2, 'shop_phone', '01276855966', '2025-12-18 00:01:53'),
(3, 'shop_address', 'الاسكندريه,العجمي', '2025-12-18 00:01:53'),
(4, 'shop_logo', '', '2025-12-18 00:01:53'),
(5, 'low_stock_alert', '0', '2025-12-18 00:01:53'),
(6, 'currency', 'ج.م', '2025-12-18 00:01:53'),
(7, 'theme', 'light', '2025-12-18 00:01:53');

-- --------------------------------------------------------

--
-- Table structure for table `telegram_backup_config`
--

CREATE TABLE `telegram_backup_config` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `telegram_backup_config`
--

INSERT INTO `telegram_backup_config` (`id`, `bot_token`, `chat_id`, `enabled`, `backup_interval_hours`, `notification_enabled`, `last_backup_time`, `backup_prefix`, `auto_backup_enabled`, `compress_backup`, `include_images`, `auto_delete_enabled`, `retention_days`, `max_backup_files`, `last_cleanup_time`, `updated_at`) VALUES
(1, '', '', 0, 24, 1, NULL, 'backup_', 0, 1, 1, 0, 30, 10, NULL, '2025-12-18 00:01:53');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('admin','manager','employee') NOT NULL DEFAULT 'employee',
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `name`, `role`, `created_at`, `updated_at`) VALUES
('admin_1766045240', '1', '$2y$12$5BqYDsqaEtrxR3Jpy8RCte04crOTe4/rM7Hu0m4e9LfyzfFXuim1e', 'المدير', 'admin', '2025-12-18 00:07:20', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_phone` (`phone`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_expense_date` (`expense_date`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `spare_parts`
--
ALTER TABLE `spare_parts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_brand` (`brand`),
  ADD KEY `idx_model` (`model`),
  ADD KEY `idx_barcode` (`barcode`);

--
-- Indexes for table `spare_part_items`
--
ALTER TABLE `spare_part_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_spare_part_id` (`spare_part_id`),
  ADD KEY `idx_item_type` (`item_type`);

--
-- Indexes for table `accessories`
--
ALTER TABLE `accessories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `phones`
--
ALTER TABLE `phones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_brand` (`brand`),
  ADD KEY `idx_model` (`model`),
  ADD KEY `idx_serial_number` (`serial_number`);

--
-- Indexes for table `loss_operations`
--
ALTER TABLE `loss_operations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_repair_number` (`repair_number`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `repairs`
--
ALTER TABLE `repairs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `repair_number` (`repair_number`),
  ADD KEY `idx_repair_number` (`repair_number`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`);

--
-- Indexes for table `telegram_backup_config`
--
ALTER TABLE `telegram_backup_config`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_role` (`role`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `telegram_backup_config`
--
ALTER TABLE `telegram_backup_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for dumped tables
--

--
-- Constraints for table `spare_part_items`
--
ALTER TABLE `spare_part_items`
  ADD CONSTRAINT `spare_part_items_ibfk_1` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `repairs`
--
ALTER TABLE `repairs`
  ADD CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;
COMMIT;


-- Migration script to add quantity column to accessories table
-- Run this script if your database already exists and needs the quantity column added

ALTER TABLE `accessories` 
ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`;


-- Migration: Add customer_type and shop_name to customers table
-- Add customer_id to sales table

-- Add new columns to customers table (check if column exists first)
SET @dbname = DATABASE();
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

-- Add index for customer_type
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

-- Add customer_id to sales table
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

-- Add index for customer_id in sales
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


-- Migration script to add quantity column to accessories table
-- Run this script if your database already exists and needs the quantity column added

ALTER TABLE `accessories` 
ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`;


-- إضافة عمود repair_type إلى جدول repairs
ALTER TABLE `repairs` 
ADD COLUMN `repair_type` ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`;

-- تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL;


-- Migration: إنشاء جداول نظام نقاط البيع (POS)
-- تاريخ الإنشاء: 2025-01-XX

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- جدول المبيعات
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

COMMIT;


-- سكريبت SQL لتحديث جدول spare_part_items لدعم purchase_price و selling_price
-- يجب تشغيل هذا السكريبت على قاعدة البيانات

-- التحقق من وجود الحقول أولاً، ثم إضافتها إذا لم تكن موجودة
SET @dbname = DATABASE();
SET @tablename = 'spare_part_items';

-- إضافة purchase_price إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND COLUMN_NAME = 'purchase_price'
);

SET @query1 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `purchase_price` decimal(10,2) DEFAULT 0.00 AFTER `quantity`',
    'SELECT "Column purchase_price already exists" AS message'
);

PREPARE stmt1 FROM @query1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- إضافة selling_price إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND COLUMN_NAME = 'selling_price'
);

SET @query2 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `selling_price` decimal(10,2) DEFAULT 0.00 AFTER `purchase_price`',
    'SELECT "Column selling_price already exists" AS message'
);

PREPARE stmt2 FROM @query2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- نسخ البيانات من price إلى purchase_price و selling_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `purchase_price` = COALESCE(`purchase_price`, `price`, 0),
    `selling_price` = COALESCE(`selling_price`, `price`, 0)
WHERE `purchase_price` IS NULL OR `selling_price` IS NULL OR `purchase_price` = 0 AND `selling_price` = 0;

SELECT 'تم تحديث جدول spare_part_items بنجاح!' AS message;





SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";



--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `address` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` varchar(50) NOT NULL,
  `type` enum('rent','electricity','salaries','parts','other') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `expense_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `category` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `spare_parts`
--

CREATE TABLE `spare_parts` (
  `id` varchar(50) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `model` varchar(255) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `spare_part_items`
--

CREATE TABLE `spare_part_items` (
  `id` varchar(50) NOT NULL,
  `spare_part_id` varchar(50) NOT NULL,
  `item_type` varchar(100) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `price` decimal(10,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `custom_value` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `accessories`
--

CREATE TABLE `accessories` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('wired_headphones','wireless_headphones','earbuds','chargers','cables','power_bank','external_battery','other') NOT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `phones`
--

CREATE TABLE `phones` (
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
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loss_operations`
--

CREATE TABLE `loss_operations` (
  `id` varchar(50) NOT NULL,
  `repair_number` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `device_type` varchar(100) NOT NULL,
  `problem` text NOT NULL,
  `loss_amount` decimal(10,2) NOT NULL,
  `loss_reason` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repairs`
--

CREATE TABLE `repairs` (
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
  `created_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `key`, `value`, `updated_at`) VALUES
(1, 'shop_name', 'ALAA ZIDAN', '2025-12-18 00:01:53'),
(2, 'shop_phone', '01276855966', '2025-12-18 00:01:53'),
(3, 'shop_address', 'الاسكندريه,العجمي', '2025-12-18 00:01:53'),
(4, 'shop_logo', '', '2025-12-18 00:01:53'),
(5, 'low_stock_alert', '0', '2025-12-18 00:01:53'),
(6, 'currency', 'ج.م', '2025-12-18 00:01:53'),
(7, 'theme', 'light', '2025-12-18 00:01:53');

-- --------------------------------------------------------

--
-- Table structure for table `telegram_backup_config`
--

CREATE TABLE `telegram_backup_config` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `telegram_backup_config`
--

INSERT INTO `telegram_backup_config` (`id`, `bot_token`, `chat_id`, `enabled`, `backup_interval_hours`, `notification_enabled`, `last_backup_time`, `backup_prefix`, `auto_backup_enabled`, `compress_backup`, `include_images`, `auto_delete_enabled`, `retention_days`, `max_backup_files`, `last_cleanup_time`, `updated_at`) VALUES
(1, '', '', 0, 24, 1, NULL, 'backup_', 0, 1, 1, 0, 30, 10, NULL, '2025-12-18 00:01:53');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('admin','manager','employee') NOT NULL DEFAULT 'employee',
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `name`, `role`, `created_at`, `updated_at`) VALUES
('admin_1766045240', '1', '$2y$12$5BqYDsqaEtrxR3Jpy8RCte04crOTe4/rM7Hu0m4e9LfyzfFXuim1e', 'المدير', 'admin', '2025-12-18 00:07:20', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_phone` (`phone`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_expense_date` (`expense_date`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `spare_parts`
--
ALTER TABLE `spare_parts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_brand` (`brand`),
  ADD KEY `idx_model` (`model`),
  ADD KEY `idx_barcode` (`barcode`);

--
-- Indexes for table `spare_part_items`
--
ALTER TABLE `spare_part_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_spare_part_id` (`spare_part_id`),
  ADD KEY `idx_item_type` (`item_type`);

--
-- Indexes for table `accessories`
--
ALTER TABLE `accessories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `phones`
--
ALTER TABLE `phones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_brand` (`brand`),
  ADD KEY `idx_model` (`model`),
  ADD KEY `idx_serial_number` (`serial_number`);

--
-- Indexes for table `loss_operations`
--
ALTER TABLE `loss_operations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_repair_number` (`repair_number`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `repairs`
--
ALTER TABLE `repairs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `repair_number` (`repair_number`),
  ADD KEY `idx_repair_number` (`repair_number`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`);

--
-- Indexes for table `telegram_backup_config`
--
ALTER TABLE `telegram_backup_config`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_role` (`role`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `telegram_backup_config`
--
ALTER TABLE `telegram_backup_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for dumped tables
--

--
-- Constraints for table `spare_part_items`
--
ALTER TABLE `spare_part_items`
  ADD CONSTRAINT `spare_part_items_ibfk_1` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `repairs`
--
ALTER TABLE `repairs`
  ADD CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;
COMMIT;

-- Migration script to add quantity column to accessories table
-- Run this script if your database already exists and needs the quantity column added

ALTER TABLE `accessories` 
ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`;



-- سكريبت SQL لتحديث جدول spare_part_items لدعم purchase_price و selling_price
-- يجب تشغيل هذا السكريبت على قاعدة البيانات

-- التحقق من وجود الحقول أولاً، ثم إضافتها إذا لم تكن موجودة
SET @dbname = DATABASE();
SET @tablename = 'spare_part_items';

-- إضافة purchase_price إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND COLUMN_NAME = 'purchase_price'
);

SET @query1 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `purchase_price` decimal(10,2) DEFAULT 0.00 AFTER `quantity`',
    'SELECT "Column purchase_price already exists" AS message'
);

PREPARE stmt1 FROM @query1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- إضافة selling_price إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND COLUMN_NAME = 'selling_price'
);

SET @query2 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `selling_price` decimal(10,2) DEFAULT 0.00 AFTER `purchase_price`',
    'SELECT "Column selling_price already exists" AS message'
);

PREPARE stmt2 FROM @query2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- نسخ البيانات من price إلى purchase_price و selling_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `purchase_price` = COALESCE(`purchase_price`, `price`, 0),
    `selling_price` = COALESCE(`selling_price`, `price`, 0)
WHERE `purchase_price` IS NULL OR `selling_price` IS NULL OR `purchase_price` = 0 AND `selling_price` = 0;

SELECT 'تم تحديث جدول spare_part_items بنجاح!' AS message;


-- ============================================
-- ملف الهجرات الموحد - Combined Migrations
-- ============================================
-- هذا الملف يجمع جميع الهجرات في مكان واحد
-- آمن للتشغيل عدة مرات (idempotent)
-- ============================================

SET @dbname = DATABASE();

-- ============================================
-- 1. إضافة عمود quantity إلى جدول accessories
-- ============================================
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'accessories' 
    AND COLUMN_NAME = 'quantity'
);

SET @query1 = IF(@column_exists = 0, 
    'ALTER TABLE `accessories` ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`',
    'SELECT "Column quantity already exists in accessories table" AS message'
);

PREPARE stmt1 FROM @query1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- ============================================
-- 2. إضافة purchase_price إلى جدول spare_part_items
-- ============================================
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'spare_part_items' 
    AND COLUMN_NAME = 'purchase_price'
);

SET @query2 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `purchase_price` decimal(10,2) DEFAULT 0.00 AFTER `quantity`',
    'SELECT "Column purchase_price already exists in spare_part_items table" AS message'
);

PREPARE stmt2 FROM @query2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- نسخ البيانات من price إلى purchase_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `purchase_price` = COALESCE(`purchase_price`, `price`, 0)
WHERE `purchase_price` IS NULL OR `purchase_price` = 0;

-- ============================================
-- 3. إضافة selling_price إلى جدول spare_part_items
-- ============================================
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'spare_part_items' 
    AND COLUMN_NAME = 'selling_price'
);

SET @query3 = IF(@column_exists = 0, 
    'ALTER TABLE `spare_part_items` ADD COLUMN `selling_price` decimal(10,2) DEFAULT 0.00 AFTER `purchase_price`',
    'SELECT "Column selling_price already exists in spare_part_items table" AS message'
);

PREPARE stmt3 FROM @query3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- نسخ البيانات من price إلى selling_price للبيانات الموجودة
UPDATE `spare_part_items` 
SET `selling_price` = COALESCE(`selling_price`, `price`, 0)
WHERE `selling_price` IS NULL OR `selling_price` = 0;

-- ============================================
-- 4. إضافة webauthn_enabled إلى جدول users
-- ============================================
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'webauthn_enabled'
);

SET @query4 = IF(@column_exists = 0, 
    'ALTER TABLE `users` ADD COLUMN `webauthn_enabled` tinyint(1) DEFAULT 0',
    'SELECT "Column webauthn_enabled already exists in users table" AS message'
);

PREPARE stmt4 FROM @query4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

SELECT 'تم تطبيق جميع الهجرات بنجاح!' AS message;

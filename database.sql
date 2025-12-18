
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
('admin_1766045240', '1', '$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq', 'المدير', 'admin', '2025-12-18 00:07:20', NULL);

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
-- Constraints for table `repairs`
--
ALTER TABLE `repairs`
  ADD CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;
COMMIT;


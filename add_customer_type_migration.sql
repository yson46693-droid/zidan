-- Migration: Add customer_type and shop_name to customers table
-- Add customer_id to sales table

-- Add new columns to customers table
ALTER TABLE `customers` 
ADD COLUMN IF NOT EXISTS `customer_type` ENUM('retail', 'commercial') NOT NULL DEFAULT 'retail' AFTER `address`,
ADD COLUMN IF NOT EXISTS `shop_name` VARCHAR(255) DEFAULT NULL AFTER `customer_type`,
ADD KEY IF NOT EXISTS `idx_customer_type` (`customer_type`);

-- Add customer_id to sales table
ALTER TABLE `sales`
ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(50) DEFAULT NULL AFTER `final_amount`,
ADD KEY IF NOT EXISTS `idx_customer_id` (`customer_id`),
ADD CONSTRAINT IF NOT EXISTS `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;

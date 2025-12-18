-- Migration script to add quantity column to accessories table
-- Run this script if your database already exists and needs the quantity column added

ALTER TABLE `accessories` 
ADD COLUMN `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`;

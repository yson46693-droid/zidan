-- =====================================================
-- ملف التحديثات والهجرات لقاعدة البيانات
-- يتم تطبيق هذه التحديثات تلقائياً من خلال setup.php
-- =====================================================

-- تحديث 1: إضافة عمود quantity إلى جدول accessories
ALTER TABLE `accessories` 
ADD COLUMN IF NOT EXISTS `quantity` int(11) NOT NULL DEFAULT 0 AFTER `selling_price`;

-- تحديث 2: إضافة purchase_price و selling_price إلى جدول spare_part_items
-- إضافة purchase_price إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'spare_part_items' 
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
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'spare_part_items' 
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
WHERE (`purchase_price` IS NULL OR `selling_price` IS NULL) 
   OR (`purchase_price` = 0 AND `selling_price` = 0 AND `price` > 0);

-- تحديث 3: إضافة عمود webauthn_enabled إلى جدول users
ALTER TABLE `users`
ADD COLUMN IF NOT EXISTS `webauthn_enabled` tinyint(1) DEFAULT 0;

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

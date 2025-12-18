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

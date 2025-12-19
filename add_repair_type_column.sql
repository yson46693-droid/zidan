-- إضافة عمود repair_type إلى جدول repairs
ALTER TABLE `repairs` 
ADD COLUMN `repair_type` ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`;

-- تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL;

-- استعلام SQL لتحديث enum role لإضافة 'technician'
-- قم بتشغيل هذا الاستعلام مرة واحدة فقط

-- تحديث enum role في جدول users لإضافة 'technician'
ALTER TABLE `users` 
MODIFY COLUMN `role` enum('admin','manager','employee','technician') NOT NULL DEFAULT 'employee';

-- التحقق من التحديث
SHOW COLUMNS FROM `users` LIKE 'role';


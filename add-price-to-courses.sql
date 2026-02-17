-- Migration: إضافة عمود السعر لجدول الكورسات
-- شغّل هذا الملف مرة واحدة على قاعدة البيانات إذا ظهر خطأ: Unknown column 'price' in 'field list'
-- الطريقة: phpMyAdmin > قاعدة البيانات > تبويب SQL > الصق الأمر > تنفيذ

ALTER TABLE courses 
ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 500.00 
COMMENT 'سعر الكورس بالجنية' 
AFTER cover_image_url;

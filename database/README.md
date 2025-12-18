# قاعدة البيانات - Database

هذا المجلد يحتوي على جميع ملفات قاعدة البيانات والهجرات.

## الملفات

### 01_main_schema.sql
الملف الرئيسي الذي يحتوي على جميع الجداول الأساسية:
- customers
- expenses
- inventory
- spare_parts
- spare_part_items
- accessories
- phones
- repairs
- loss_operations
- settings
- telegram_backup_config
- users

### 02_migrations.sql و 03_migrations.sql
ملفات الهجرة الأصلية التي تضيف أعمدة جديدة للجداول الموجودة:
- إضافة عمود `quantity` إلى جدول `accessories`
- إضافة أعمدة `purchase_price` و `selling_price` إلى جدول `spare_part_items`

### migrations_combined.sql
ملف موحد يجمع جميع الهجرات في مكان واحد (موصى به للاستخدام):
- يجمع جميع التحديثات في ملف واحد
- آمن للتشغيل عدة مرات
- يحتوي على التحقق من وجود الأعمدة قبل إضافتها

## التحديث التلقائي

النظام يقوم تلقائياً بـ:
1. إنشاء جميع الجداول الناقصة عند أول تشغيل
2. إضافة الأعمدة الناقصة للجداول الموجودة
3. إنشاء البيانات الافتراضية المطلوبة

يتم ذلك من خلال ملف `api/setup.php` الذي يتم استدعاؤه تلقائياً عند تحميل `api/config.php`.

## الجداول الإضافية

يتم إنشاء الجداول التالية تلقائياً أيضاً:
- `messages` - رسائل الدردشة الجماعية
- `message_reads` - تتبع قراءة الرسائل
- `user_presence` - حالة المستخدمين (متصل/غير متصل)
- `webauthn_credentials` - بيانات WebAuthn للمصادقة بالبصمة

## كيفية الاستخدام

لا حاجة لتشغيل الملفات يدوياً - النظام يقوم بذلك تلقائياً. ولكن إذا أردت تشغيلها يدوياً:

```sql
-- تشغيل الملف الرئيسي
SOURCE database/01_main_schema.sql;

-- تشغيل ملف الهجرة الموحد (موصى به)
SOURCE database/migrations_combined.sql;

-- أو تشغيل ملفات الهجرة الفردية
SOURCE database/02_migrations.sql;
SOURCE database/03_migrations.sql;
```

## ملاحظات

- جميع الجداول تستخدم `utf8mb4_unicode_ci` للدعم الكامل للغة العربية
- يتم استخدام `CREATE TABLE IF NOT EXISTS` لتجنب الأخطاء عند تشغيل الملفات أكثر من مرة
- ملفات الهجرة آمنة للتشغيل عدة مرات (idempotent)

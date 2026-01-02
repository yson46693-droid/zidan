# 🔧 حل قوي لفرض إعدادات PHP في LiteSpeed

## ⚠️ المشكلة

بعد تطبيق جميع الحلول السابقة، ما زالت الإعدادات:
- ❌ `session.save_path`: `/opt/alt/php81/var/lib/php/session` (يجب أن يكون `/tmp`)
- ❌ `soap.wsdl_cache_enabled`: `1` (يجب أن يكون `0`)

**السبب:** LiteSpeed مضبوط على مستوى Virtual Host ولا يمكن تغييره من `.htaccess` أو `ini_set()`.

## ✅ الحلول المطبقة (طبقة إضافية)

### 1. تم إنشاء `.auto_prepend.php`
- ✅ ملف يتم تحميله تلقائياً قبل أي ملف PHP
- ✅ يفرض إعدادات `session.save_path` و `soap.wsdl_cache_enabled`

### 2. تم تحديث `api/config.php`
- ✅ استدعاء `.auto_prepend.php` في بداية الملف
- ✅ تطبيق الإعدادات مباشرة إذا لم يكن الملف موجوداً

### 3. تم تحديث `.htaccess`
- ✅ إضافة `auto_prepend_file` لـ LiteSpeed PHP-FPM

### 4. تم تحديث `test-session.php`
- ✅ تطبيق الإعدادات مباشرة في بداية الملف

## 🔍 خطوات التحقق

### 1. امسح Cache

```bash
# امسح أي cache للجلسات
rm -rf /opt/alt/php81/var/lib/php/session/*
rm -rf /tmp/sess_*
```

### 2. أعد تحميل الصفحة

```
https://alaazidan.store/test-session.php
```

**النتيجة المتوقعة:**
- ✅ `session.save_path`: `/tmp`
- ✅ `soap.wsdl_cache_enabled`: `0`

## ⚠️ إذا استمرت المشكلة

إذا لم تعمل الحلول المطبقة، **المشكلة في إعدادات LiteSpeed على مستوى Virtual Host** ولا يمكن حلها من الكود.

### الحل الوحيد: تعديل إعدادات LiteSpeed مباشرة

**يتطلب صلاحيات إدارية على الخادم:**

#### الطريقة 1: عبر لوحة تحكم LiteSpeed

1. سجل الدخول إلى **LiteSpeed WebAdmin Console**
2. اذهب إلى **Virtual Hosts** → **alaazidan.store**
3. اذهب إلى **Script Handler** أو **PHP Settings**
4. ابحث عن **PHP Settings** أو **php.ini Settings**
5. أضف/عدّل الإعدادات التالية:

```
session.save_path = /tmp
soap.wsdl_cache_enabled = 0
soap.wsdl_cache_dir = /tmp
soap.wsdl_cache_ttl = 0
soap.wsdl_cache_limit = 0
```

6. احفظ التغييرات
7. أعد تشغيل LiteSpeed:
   ```bash
   /usr/local/lsws/bin/lswsctrl restart
   ```

#### الطريقة 2: عبر ملف الإعدادات مباشرة

```bash
# ملف الإعدادات (قد يختلف حسب التثبيت)
/usr/local/lsws/conf/vhosts/alaazidan.store/vhost.conf
# أو
/var/www/vhosts/alaazidan.store/conf/vhost.conf
```

أضف/عدّل:

```apache
php_admin_value session.save_path "/tmp"
php_admin_value soap.wsdl_cache_enabled "0"
php_admin_value soap.wsdl_cache_dir "/tmp"
php_admin_value soap.wsdl_cache_ttl "0"
php_admin_value soap.wsdl_cache_limit "0"
```

ثم أعد تشغيل LiteSpeed.

#### الطريقة 3: الاتصال بالدعم الفني

إذا لم تكن لديك صلاحيات إدارية:

1. **اتصل بالدعم الفني** لطلب تعديل إعدادات PHP
2. **أرسل لهم** الرسالة التالية:

```
الموضوع: طلب تعديل إعدادات PHP لـ Virtual Host

السلام عليكم،

أحتاج إلى تعديل إعدادات PHP التالية لـ Virtual Host: alaazidan.store

المطلوب:
- session.save_path = /tmp
- soap.wsdl_cache_enabled = 0
- soap.wsdl_cache_dir = /tmp
- soap.wsdl_cache_ttl = 0
- soap.wsdl_cache_limit = 0

السبب: مشكلة open_basedir restriction - PHP لا يستطيع الوصول إلى 
/opt/alt/php81/var/lib/php/session و /var/lib/php/wsdlcache

شكراً لكم.
```

## 📝 ملاحظات مهمة

1. **الجلسة تعمل حالياً** لكن في مسار خاطئ (`/opt/alt/php81/var/lib/php/session`)
2. **المشكلة الرئيسية** هي أن LiteSpeed مضبوط على مستوى Virtual Host
3. **الحلول المطبقة** ستحاول التغلب على هذا، لكن قد تحتاج إلى تعديل إعدادات LiteSpeed مباشرة
4. **إذا لم تعمل الحلول**، المشكلة في إعدادات الخادم وليس في الكود

## ✅ بعد الإصلاح

بعد تعديل إعدادات LiteSpeed:

1. ✅ `session.save_path` سيكون `/tmp`
2. ✅ `soap.wsdl_cache_enabled` سيكون `0`
3. ✅ الجلسات ستعمل في `/tmp` (مسموح في `open_basedir`)
4. ✅ لن تظهر أخطاء `open_basedir restriction`

## 🗑️ احذف ملفات الاختبار

بعد التحقق من الإعدادات:

```bash
rm test-session.php
rm .auto_prepend.php  # اختياري - يمكن تركه
```

---

**للمزيد من التفاصيل:** راجع `LITESPEED_FIX_GUIDE.md` و `FIX_SESSION_SETTINGS.md`

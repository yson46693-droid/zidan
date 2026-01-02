# 🔧 دليل إصلاح مشاكل LiteSpeed + PHP (403 Forbidden & open_basedir)

## 📋 المشاكل المحددة

1. **403 Forbidden** على الصفحة الرئيسية
2. **404 Not Found** على ملفات موجودة فعليًا
3. **open_basedir restriction** - PHP لا يستطيع الوصول إلى:
   - `/var/lib/php/session`
   - `/var/lib/php/wsdlcache`
4. المسارات المسموح بها فقط:
   - `/var/www/vhosts/alaazidan.store/`
   - `/tmp/`
5. خطأ: `Cannot found appropriate handler for /error_docs/forbidden.html`

---

## ✅ الحلول المطلوبة

### 1️⃣ إصلاح open_basedir Restriction

#### الطريقة الأولى: تعديل session.save_path في PHP (موصى به)

**ملف: `.htaccess` (في المجلد الرئيسي)**

```apache
# ✅ إعدادات PHP للجلسات - حل مشكلة open_basedir
<IfModule mod_php.c>
    # تعيين مسار حفظ الجلسات إلى /tmp (مسموح في open_basedir)
    php_value session.save_path "/tmp"
    
    # تعطيل wsdlcache لتجنب مشكلة open_basedir
    php_value soap.wsdl_cache_enabled "0"
    php_value soap.wsdl_cache_dir "/tmp"
    php_value soap.wsdl_cache_ttl "0"
    php_value soap.wsdl_cache_limit "0"
</IfModule>

# ✅ للاستضافات التي تستخدم PHP-FPM/CGI (LiteSpeed عادة)
<IfModule mod_fastcgi.c>
    # تعيين session.save_path عبر ini_set في config.php (موجود بالفعل)
</IfModule>
```

**ملف: `api/config.php` (موجود بالفعل - ✅ تم إصلاحه)**

الكود موجود في السطور 148-184 ويقوم بـ:
- تعيين `session.save_path` إلى `/tmp`
- تعطيل `soap.wsdl_cache_enabled`
- استخدام مجلد بديل داخل الموقع إذا فشل `/tmp`

#### الطريقة الثانية: تعديل open_basedir في LiteSpeed (إذا كان لديك صلاحيات root)

**ملاحظة:** هذه الطريقة تتطلب صلاحيات إدارية على الخادم.

**في لوحة تحكم LiteSpeed (WebAdmin Console):**

1. اذهب إلى **Virtual Hosts** → اختر **alaazidan.store**
2. اذهب إلى **Script Handler** أو **PHP Settings**
3. ابحث عن **open_basedir** أو **PHP Settings**
4. أضف المسارات التالية:
   ```
   /var/www/vhosts/alaazidan.store/:/tmp/:/var/lib/php/session/:/var/lib/php/wsdlcache/
   ```

**أو عبر ملف الإعدادات:**

```bash
# ملف الإعدادات: /usr/local/lsws/conf/vhosts/alaazidan.store/vhost.conf
# أو: /var/www/vhosts/alaazidan.store/conf/vhost.conf

php_admin_value open_basedir "/var/www/vhosts/alaazidan.store/:/tmp/:/var/lib/php/session/:/var/lib/php/wsdlcache/"
```

**أو عبر .htaccess (إذا كان الخادم يسمح):**

```apache
# ⚠️ قد لا يعمل في جميع الاستضافات المشتركة
<IfModule mod_php.c>
    php_admin_value open_basedir "/var/www/vhosts/alaazidan.store/:/tmp/:/var/lib/php/session/:/var/lib/php/wsdlcache/"
</IfModule>
```

---

### 2️⃣ إصلاح مشكلة ErrorDocument 403

**المشكلة:** `Cannot found appropriate handler for /error_docs/forbidden.html`

**الحل:** إنشاء صفحة خطأ مخصصة أو إزالة ErrorDocument

**ملف: `.htaccess`**

```apache
# ✅ إصلاح ErrorDocument 403
# الطريقة الأولى: إنشاء صفحة خطأ بسيطة
ErrorDocument 403 /403.html

# الطريقة الثانية: استخدام رسالة نصية مباشرة (أبسط)
# ErrorDocument 403 "Access Forbidden - You don't have permission to access this resource."

# الطريقة الثالثة: إزالة ErrorDocument تماماً (إذا لم تكن بحاجة إليه)
# (لا تضيف أي سطر ErrorDocument 403)
```

**إنشاء ملف `403.html` في المجلد الرئيسي:**

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>403 - Access Forbidden</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
        }
        .error-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #f44336; font-size: 72px; margin: 0; }
        h2 { color: #333; margin: 20px 0; }
        p { color: #666; line-height: 1.6; }
        a { color: #2196F3; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>403</h1>
        <h2>Access Forbidden</h2>
        <p>عذراً، ليس لديك صلاحية للوصول إلى هذا المورد.</p>
        <p><a href="/">العودة إلى الصفحة الرئيسية</a></p>
    </div>
</body>
</html>
```

---

### 3️⃣ إصلاح مشكلة 404 Not Found على ملفات موجودة

**المشكلة:** ملفات موجودة فعليًا لكن تظهر 404

**الأسباب المحتملة:**
1. مشكلة في `DirectoryIndex`
2. مشكلة في `RewriteEngine`
3. مشكلة في الصلاحيات

**الحل في `.htaccess`:**

```apache
# ✅ إصلاح DirectoryIndex
DirectoryIndex index.html index.php index.htm

# ✅ السماح بملفات HTML و CSS و JS
<FilesMatch "\.(html|htm|css|js|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$">
    Order allow,deny
    Allow from all
</FilesMatch>

# ✅ ضمان تقديم ملفات HTML بشكل صحيح
AddType text/html .html .htm
AddDefaultCharset UTF-8

# ✅ ضمان تقديم ملفات CSS و JS بشكل صحيح
<IfModule mod_mime.c>
    AddType text/css .css
    AddType application/javascript .js
    AddType text/javascript .js
    AddType application/json .json
</IfModule>

# ✅ منع إعادة توجيه الملفات الموجودة
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # ✅ السماح بجميع الملفات الموجودة فعلياً
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule . - [L]
    
    # ✅ السماح بجميع المجلدات الموجودة فعلياً
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule . - [L]
</IfModule>
```

---

### 4️⃣ إصلاح الصلاحيات (Permissions)

**الصلاحيات الصحيحة للملفات والمجلدات:**

```bash
# ✅ الصلاحيات الموصى بها:

# المجلد الرئيسي
chmod 755 /var/www/vhosts/alaazidan.store/

# ملفات HTML, CSS, JS, JSON
find /var/www/vhosts/alaazidan.store/ -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" \) -exec chmod 644 {} \;

# ملفات PHP
find /var/www/vhosts/alaazidan.store/ -type f -name "*.php" -exec chmod 644 {} \;

# ملفات الصور
find /var/www/vhosts/alaazidan.store/ -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" \) -exec chmod 644 {} \;

# المجلدات
find /var/www/vhosts/alaazidan.store/ -type d -exec chmod 755 {} \;

# ✅ مجلد sessions (إذا كان موجوداً)
chmod 755 /var/www/vhosts/alaazidan.store/sessions/
chmod 644 /var/www/vhosts/alaazidan.store/sessions/* 2>/dev/null || true

# ✅ مجلد logs
chmod 755 /var/www/vhosts/alaazidan.store/logs/
chmod 644 /var/www/vhosts/alaazidan.store/logs/* 2>/dev/null || true

# ✅ مجلد backups
chmod 755 /var/www/vhosts/alaazidan.store/backups/

# ✅ مجلد chat (إذا كان موجوداً)
chmod 755 /var/www/vhosts/alaazidan.store/chat/
chmod 755 /var/www/vhosts/alaazidan.store/chat/images/
chmod 755 /var/www/vhosts/alaazidan.store/chat/files/
chmod 755 /var/www/vhosts/alaazidan.store/chat/audio/

# ✅ مجلد avatars
chmod 755 /var/www/vhosts/alaazidan.store/avatars/
chmod 644 /var/www/vhosts/alaazidan.store/avatars/* 2>/dev/null || true

# ✅ مجلد images
chmod 755 /var/www/vhosts/alaazidan.store/images/
chmod 644 /var/www/vhosts/alaazidan.store/images/* 2>/dev/null || true

# ✅ ملف .htaccess
chmod 644 /var/www/vhosts/alaazidan.store/.htaccess

# ✅ ملف php.ini (إذا كان موجوداً)
chmod 644 /var/www/vhosts/alaazidan.store/php.ini 2>/dev/null || true
```

**ملاحظة:** في الاستضافات المشتركة، عادة ما تكون الصلاحيات مضبوطة تلقائياً. إذا كنت تواجه مشاكل، راجع لوحة التحكم.

---

### 5️⃣ إصلاح مشكلة 403 Forbidden على الصفحة الرئيسية

**الأسباب المحتملة:**
1. مشكلة في `DirectoryIndex`
2. مشكلة في `Options`
3. مشكلة في `AllowOverride`
4. مشكلة في الصلاحيات

**الحل في `.htaccess`:**

```apache
# ✅ إصلاح DirectoryIndex
DirectoryIndex index.html index.php index.htm

# ✅ السماح بعرض الملفات
Options -Indexes +FollowSymLinks

# ✅ السماح بجميع الملفات
<FilesMatch ".*">
    Order allow,deny
    Allow from all
</FilesMatch>

# ✅ قاعدة خاصة لـ index.html
<Files "index.html">
    Order allow,deny
    Allow from all
</Files>

# ✅ قاعدة خاصة لـ index.php
<Files "index.php">
    Order allow,deny
    Allow from all
</Files>
```

---

## 📝 ملف `.htaccess` الكامل المحدث

```apache
# ============================================
# ✅ إصلاح مشاكل LiteSpeed + PHP
# ============================================

# ✅ إصلاح DirectoryIndex
DirectoryIndex index.html index.php index.htm

# ✅ السماح بعرض الملفات
Options -Indexes +FollowSymLinks

# ✅ إصلاح ErrorDocument 403
ErrorDocument 403 /403.html

# ✅ إعدادات PHP للجلسات - حل مشكلة open_basedir
<IfModule mod_php.c>
    # تعيين مسار حفظ الجلسات إلى /tmp (مسموح في open_basedir)
    php_value session.save_path "/tmp"
    
    # تعطيل wsdlcache لتجنب مشكلة open_basedir
    php_value soap.wsdl_cache_enabled "0"
    php_value soap.wsdl_cache_dir "/tmp"
    php_value soap.wsdl_cache_ttl "0"
    php_value soap.wsdl_cache_limit "0"
</IfModule>

# ✅ السماح بجميع الملفات
<FilesMatch ".*">
    Order allow,deny
    Allow from all
</FilesMatch>

# ✅ قاعدة خاصة لـ index.html
<Files "index.html">
    Order allow,deny
    Allow from all
</Files>

# ✅ ضمان تقديم ملفات HTML بشكل صحيح
AddType text/html .html .htm
AddDefaultCharset UTF-8

# ✅ ضمان تقديم ملفات CSS و JS بشكل صحيح
<IfModule mod_mime.c>
    AddType text/css .css
    AddType application/javascript .js
    AddType text/javascript .js
    AddType application/json .json
</IfModule>

# ✅ منع إعادة توجيه الملفات الموجودة
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # ✅ السماح بجميع الملفات الموجودة فعلياً
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule . - [L]
    
    # ✅ السماح بجميع المجلدات الموجودة فعلياً
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule . - [L]
</IfModule>

# ============================================
# ✅ باقي الإعدادات (من .htaccess الأصلي)
# ============================================
# (أضف باقي الإعدادات من .htaccess الحالي هنا)
```

---

## 🔍 خطوات التحقق من الإصلاح

### 1. التحقق من session.save_path

**إنشاء ملف اختبار: `test-session.php`**

```php
<?php
// اختبار session.save_path
echo "session.save_path: " . ini_get('session.save_path') . "\n";
echo "session.save_handler: " . ini_get('session.save_handler') . "\n";
echo "soap.wsdl_cache_enabled: " . ini_get('soap.wsdl_cache_enabled') . "\n";
echo "soap.wsdl_cache_dir: " . ini_get('soap.wsdl_cache_dir') . "\n";

// محاولة بدء جلسة
session_start();
$_SESSION['test'] = 'working';
echo "Session started successfully!\n";
echo "Session ID: " . session_id() . "\n";
?>
```

**الوصول إلى:** `https://alaazidan.store/test-session.php`

**النتيجة المتوقعة:**
```
session.save_path: /tmp
session.save_handler: files
soap.wsdl_cache_enabled: 0
soap.wsdl_cache_dir: /tmp
Session started successfully!
Session ID: [session_id]
```

### 2. التحقق من open_basedir

**إنشاء ملف اختبار: `test-openbasedir.php`**

```php
<?php
echo "open_basedir: " . ini_get('open_basedir') . "\n";

// اختبار الوصول إلى /tmp
if (is_dir('/tmp') && is_writable('/tmp')) {
    echo "✅ /tmp is accessible and writable\n";
} else {
    echo "❌ /tmp is NOT accessible or writable\n";
}

// اختبار الوصول إلى /var/lib/php/session
if (is_dir('/var/lib/php/session')) {
    echo "✅ /var/lib/php/session is accessible\n";
} else {
    echo "⚠️ /var/lib/php/session is NOT accessible (this is OK if using /tmp)\n";
}

// اختبار كتابة ملف في /tmp
$testFile = '/tmp/php_test_' . time() . '.txt';
if (file_put_contents($testFile, 'test') !== false) {
    echo "✅ Can write to /tmp\n";
    unlink($testFile);
} else {
    echo "❌ Cannot write to /tmp\n";
}
?>
```

### 3. التحقق من الصفحة الرئيسية

**الوصول إلى:** `https://alaazidan.store/` أو `https://alaazidan.store/index.html`

**النتيجة المتوقعة:** يجب أن تظهر صفحة تسجيل الدخول بدون خطأ 403.

### 4. التحقق من ملفات موجودة

**الوصول إلى:**
- `https://alaazidan.store/css/style.css`
- `https://alaazidan.store/js/api.js`
- `https://alaazidan.store/manifest.json`

**النتيجة المتوقعة:** يجب أن يتم تحميل الملفات بدون خطأ 404.

---

## 🚨 استكشاف الأخطاء

### إذا استمرت مشكلة 403:

1. **التحقق من الصلاحيات:**
   ```bash
   ls -la /var/www/vhosts/alaazidan.store/index.html
   # يجب أن يكون: -rw-r--r-- (644)
   ```

2. **التحقق من .htaccess:**
   ```bash
   # تعطيل .htaccess مؤقتاً للاختبار
   mv .htaccess .htaccess.bak
   # إذا عملت الصفحة، المشكلة في .htaccess
   ```

3. **التحقق من سجلات الأخطاء:**
   ```bash
   tail -f /var/www/vhosts/alaazidan.store/logs/php_errors.log
   tail -f /usr/local/lsws/logs/error.log
   ```

### إذا استمرت مشكلة open_basedir:

1. **التحقق من config.php:**
   - تأكد من أن الكود في السطور 148-184 موجود ويعمل.

2. **التحقق من php.ini:**
   - إذا كان لديك `php.ini` محلي، تأكد من الإعدادات.

3. **الاتصال بالدعم الفني:**
   - إذا لم تكن لديك صلاحيات root، اتصل بالدعم الفني لطلب تعديل `open_basedir`.

---

## 📞 ملاحظات مهمة

1. **في الاستضافات المشتركة:**
   - قد لا تتمكن من تعديل `open_basedir` مباشرة.
   - استخدم الحل الأول (تعديل `session.save_path` إلى `/tmp`).
   - هذا الحل موجود بالفعل في `api/config.php`.

2. **في LiteSpeed:**
   - تأكد من أن `mod_php` أو `PHP-FPM` مفعّل.
   - تحقق من إعدادات `Script Handler` في لوحة التحكم.

3. **الأمان:**
   - لا تفتح `open_basedir` أكثر من اللازم.
   - استخدم فقط المسارات المطلوبة.

---

## ✅ الخلاصة

1. ✅ **session.save_path** → تم إصلاحه في `api/config.php` (يستخدم `/tmp`)
2. ✅ **soap.wsdl_cache** → تم تعطيله في `api/config.php`
3. ⚠️ **open_basedir** → يحتاج تعديل في LiteSpeed (إذا كان لديك صلاحيات)
4. ✅ **ErrorDocument 403** → إنشاء ملف `403.html` أو إزالة السطر
5. ✅ **404 Not Found** → إضافة قواعد في `.htaccess`
6. ✅ **الصلاحيات** → استخدام `chmod` كما هو موضح أعلاه

---

## 📚 مراجع

- [LiteSpeed Documentation](https://www.litespeedtech.com/support/wiki/doku.php)
- [PHP open_basedir](https://www.php.net/manual/en/ini.core.php#ini.open-basedir)
- [Apache .htaccess Guide](https://httpd.apache.org/docs/current/howto/htaccess.html)

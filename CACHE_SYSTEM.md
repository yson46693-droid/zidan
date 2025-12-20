# نظام إدارة الكاش - Cache Management System

## نظرة سريعة

نظام بسيط وقوي لإدارة الكاش متوافق 100% مع InfinityFree Shared Hosting.

## الميزات

✅ منع كاش صفحات PHP (HTML الناتج)  
✅ Cache Busting ذكي لملفات CSS/JS باستخدام `filemtime()`  
✅ الحفاظ على كاش الصور والملفات الثابتة  
✅ بدون أي تأثير على الأداء  
✅ متوافق مع InfinityFree (بدون SSH، بدون Redis، بدون CDN)  

## الاستخدام السريع

### 1. في أي ملف PHP ينتج HTML:

```php
<?php
require_once __DIR__ . '/includes/cache.php';
disablePageCache();
?>
```

### 2. إضافة CSS/JS مع Cache Busting:

```php
<!-- CSS -->
<link rel="stylesheet" href="<?php echo asset('css/style.css'); ?>">

<!-- JS -->
<script src="<?php echo asset('js/app.js'); ?>"></script>
```

### 3. للإداء الأفضل (استخدام cache داخلي):

```php
<link rel="stylesheet" href="<?php echo asset_cached('css/style.css'); ?>">
<script src="<?php echo asset_cached('js/app.js'); ?>"></script>
```

## مثال كامل

انظر ملف `example-cache-usage.php` للحصول على مثال كامل.

## الملاحظات

- يتم تحديث timestamp تلقائياً فقط عند تعديل الملف
- الصور والملفات الثابتة تحتفظ بكاشها (1 سنة)
- لا حاجة لتعديل `.htaccess` يدوياً (تم التعديل تلقائياً)

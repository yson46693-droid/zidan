<?php
/**
 * مثال عملي لاستخدام نظام إدارة الكاش
 * 
 * هذا الملف يوضح كيفية:
 * 1. منع كاش صفحات PHP
 * 2. إضافة Cache Busting لملفات CSS/JS
 */

// تحميل ملف إدارة الكاش
require_once __DIR__ . '/includes/cache.php';

// منع كاش هذه الصفحة (يجب استدعاؤه قبل أي output)
disablePageCache();

?><!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مثال استخدام نظام الكاش</title>
    
    <!-- استخدام asset() لإضافة Cache Busting للـ CSS -->
    <link rel="stylesheet" href="<?php echo asset('css/style.css'); ?>">
    <link rel="stylesheet" href="<?php echo asset('css/dark-mode.css'); ?>">
    
    <!-- مثال: استخدام asset_cached() للإداء الأفضل (يُوصى به) -->
    <link rel="stylesheet" href="<?php echo asset_cached('css/pos.css'); ?>">
</head>
<body>
    <h1>مثال استخدام نظام الكاش</h1>
    
    <p>هذه الصفحة تستخدم نظام إدارة الكاش الذي:</p>
    <ul>
        <li>يمنع كاش HTML الناتج من PHP</li>
        <li>يضيف Cache Busting تلقائي لملفات CSS/JS بناءً على وقت تعديل الملف</li>
        <li>يحافظ على كاش الصور والملفات الثقيلة</li>
    </ul>
    
    <!-- استخدام asset() لإضافة Cache Busting للـ JS -->
    <script src="<?php echo asset('js/utils.js'); ?>"></script>
    <script src="<?php echo asset('js/app.js'); ?>"></script>
    
    <!-- مثال: استخدام asset_cached() للإداء الأفضل -->
    <script src="<?php echo asset_cached('js/api.js'); ?>"></script>
    
    <script>
        // مثال: يمكنك استخدام PHP داخل JavaScript أيضاً
        console.log('CSS: <?php echo asset("css/style.css"); ?>');
    </script>
</body>
</html>

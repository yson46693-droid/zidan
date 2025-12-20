<?php
/**
 * نظام إدارة الكاش (Cache Management)
 * 
 * يوفر:
 * - منع كاش صفحات PHP (HTML الناتج)
 * - Cache Busting ذكي لملفات CSS/JS باستخدام filemtime()
 * 
 * متوافق 100% مع InfinityFree Shared Hosting
 */

// منع كاش صفحات PHP (يجب استدعاؤه في بداية كل ملف PHP ينتج HTML)
function disablePageCache() {
    // التأكد من عدم إرسال headers مسبقاً
    if (headers_sent()) {
        return false;
    }
    
    // Headers لمنع الكاش (متوافق مع جميع المتصفحات)
    header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
    
    return true;
}

/**
 * إضافة Cache Busting لملفات CSS/JS
 * 
 * @param string $path المسار النسبي للملف (مثل: css/style.css أو js/app.js)
 * @param string $basePath المسار الأساسي (افتراضي: __DIR__ . '/..')
 * @return string المسار مع timestamp للكاش
 * 
 * مثال:
 * echo '<link rel="stylesheet" href="' . asset('css/style.css') . '">';
 * echo '<script src="' . asset('js/app.js') . '"></script>';
 */
function asset($path, $basePath = null) {
    // تحديد المسار الأساسي
    if ($basePath === null) {
        $basePath = dirname(__DIR__);
    }
    
    // تنظيف المسار (إزالة / في البداية)
    $path = ltrim($path, '/');
    
    // المسار الكامل للملف
    $fullPath = rtrim($basePath, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
    
    // التحقق من وجود الملف
    if (!file_exists($fullPath)) {
        // إذا لم يوجد الملف، إرجاع المسار بدون timestamp
        return '/' . $path;
    }
    
    // الحصول على وقت آخر تعديل للملف
    $filemtime = filemtime($fullPath);
    
    // إضافة timestamp كـ query parameter
    $separator = strpos($path, '?') !== false ? '&' : '?';
    return '/' . $path . $separator . 'v=' . $filemtime;
}

/**
 * نسخة محسّنة من asset() مع cache للـ filemtime() لتقليل استدعاءات النظام
 * 
 * @param string $path المسار النسبي للملف
 * @param string $basePath المسار الأساسي
 * @return string المسار مع timestamp
 */
function asset_cached($path, $basePath = null) {
    static $cache = [];
    
    // مفتاح الكاش
    $cacheKey = ($basePath ?? dirname(__DIR__)) . '|' . $path;
    
    // إذا كان موجوداً في الكاش، إرجاعه
    if (isset($cache[$cacheKey])) {
        return $cache[$cacheKey];
    }
    
    // حساب القيمة وإضافة للكاش
    $cache[$cacheKey] = asset($path, $basePath);
    
    return $cache[$cacheKey];
}

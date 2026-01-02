<?php
/**
 * ملف اختبار session.save_path و open_basedir
 * الوصول: https://alaazidan.store/test-session.php
 * 
 * ⚠️ احذف هذا الملف بعد التحقق من الإعدادات
 */

// ✅ CRITICAL: تطبيق إعدادات PHP قبل أي شيء آخر
@ini_set('soap.wsdl_cache_enabled', '0');
@ini_set('soap.wsdl_cache_dir', '/tmp');
@ini_set('soap.wsdl_cache_ttl', '0');
@ini_set('soap.wsdl_cache_limit', '0');

if (session_status() === PHP_SESSION_NONE) {
    $sessionPath = '/tmp';
    if (is_dir($sessionPath) && is_writable($sessionPath)) {
        @ini_set('session.save_path', $sessionPath);
        if (function_exists('session_save_path')) {
            session_save_path($sessionPath);
        }
    }
}

// تنظيف output buffer
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

// إعدادات HTTP headers
header('Content-Type: text/html; charset=utf-8');

?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار Session & open_basedir</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            direction: rtl;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2196F3;
            margin-bottom: 20px;
            font-size: 28px;
        }
        .test-item {
            margin: 15px 0;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 5px;
            border-right: 4px solid #2196F3;
        }
        .test-item h3 {
            color: #333;
            margin-bottom: 10px;
            font-size: 18px;
        }
        .test-item p {
            color: #666;
            line-height: 1.6;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 10px;
            border-radius: 3px;
            margin: 5px 0;
        }
        .success {
            color: #4CAF50;
            font-weight: bold;
        }
        .error {
            color: #f44336;
            font-weight: bold;
        }
        .warning {
            color: #FFA500;
            font-weight: bold;
        }
        .info {
            color: #2196F3;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 اختبار Session & open_basedir Settings</h1>
        
        <?php
        // اختبار session.save_path
        echo '<div class="test-item">';
        echo '<h3>1. Session Settings</h3>';
        $sessionPath = ini_get('session.save_path');
        $sessionHandler = ini_get('session.save_handler');
        echo '<p><strong>session.save_path:</strong> <span class="info">' . htmlspecialchars($sessionPath) . '</span></p>';
        echo '<p><strong>session.save_handler:</strong> <span class="info">' . htmlspecialchars($sessionHandler) . '</span></p>';
        
        // التحقق من أن session.save_path هو /tmp
        if ($sessionPath === '/tmp' || strpos($sessionPath, '/tmp') !== false) {
            echo '<p class="success">✅ session.save_path مضبوط على /tmp (صحيح)</p>';
        } else {
            echo '<p class="warning">⚠️ session.save_path ليس /tmp - قد تحتاج إلى تعديل</p>';
        }
        echo '</div>';
        
        // اختبار soap.wsdl_cache
        echo '<div class="test-item">';
        echo '<h3>2. SOAP WSDL Cache Settings</h3>';
        $wsdlCacheEnabled = ini_get('soap.wsdl_cache_enabled');
        $wsdlCacheDir = ini_get('soap.wsdl_cache_dir');
        echo '<p><strong>soap.wsdl_cache_enabled:</strong> <span class="info">' . htmlspecialchars($wsdlCacheEnabled) . '</span></p>';
        echo '<p><strong>soap.wsdl_cache_dir:</strong> <span class="info">' . htmlspecialchars($wsdlCacheDir) . '</span></p>';
        
        if ($wsdlCacheEnabled == '0' || $wsdlCacheEnabled === '') {
            echo '<p class="success">✅ soap.wsdl_cache_enabled معطّل (صحيح)</p>';
        } else {
            echo '<p class="warning">⚠️ soap.wsdl_cache_enabled مفعّل - قد يسبب مشاكل</p>';
        }
        echo '</div>';
        
        // اختبار open_basedir
        echo '<div class="test-item">';
        echo '<h3>3. open_basedir Settings</h3>';
        $openBasedir = ini_get('open_basedir');
        if (empty($openBasedir)) {
            echo '<p class="info">ℹ️ open_basedir غير مضبوط (غير محدود)</p>';
        } else {
            echo '<p><strong>open_basedir:</strong> <span class="info">' . htmlspecialchars($openBasedir) . '</span></p>';
        }
        echo '</div>';
        
        // اختبار الوصول إلى /tmp
        echo '<div class="test-item">';
        echo '<h3>4. اختبار الوصول إلى /tmp</h3>';
        if (is_dir('/tmp') && is_writable('/tmp')) {
            echo '<p class="success">✅ /tmp قابل للوصول والكتابة</p>';
            
            // محاولة كتابة ملف اختبار
            $testFile = '/tmp/php_test_' . time() . '.txt';
            if (file_put_contents($testFile, 'test') !== false) {
                echo '<p class="success">✅ يمكن الكتابة في /tmp</p>';
                unlink($testFile);
            } else {
                echo '<p class="error">❌ لا يمكن الكتابة في /tmp</p>';
            }
        } else {
            echo '<p class="error">❌ /tmp غير قابل للوصول أو غير قابل للكتابة</p>';
        }
        echo '</div>';
        
        // اختبار الوصول إلى /var/lib/php/session
        echo '<div class="test-item">';
        echo '<h3>5. اختبار الوصول إلى /var/lib/php/session</h3>';
        if (is_dir('/var/lib/php/session')) {
            echo '<p class="success">✅ /var/lib/php/session قابل للوصول</p>';
        } else {
            echo '<p class="warning">⚠️ /var/lib/php/session غير قابل للوصول (هذا طبيعي إذا كنت تستخدم /tmp)</p>';
        }
        echo '</div>';
        
        // اختبار بدء جلسة
        echo '<div class="test-item">';
        echo '<h3>6. اختبار بدء الجلسة</h3>';
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            $_SESSION['test'] = 'working';
            $sessionId = session_id();
            echo '<p class="success">✅ تم بدء الجلسة بنجاح</p>';
            echo '<p><strong>Session ID:</strong> <span class="info">' . htmlspecialchars($sessionId) . '</span></p>';
            echo '<p><strong>Session Data:</strong> <span class="info">' . htmlspecialchars($_SESSION['test']) . '</span></p>';
        } catch (Exception $e) {
            echo '<p class="error">❌ فشل بدء الجلسة: ' . htmlspecialchars($e->getMessage()) . '</p>';
        }
        echo '</div>';
        
        // معلومات PHP
        echo '<div class="test-item">';
        echo '<h3>7. معلومات PHP</h3>';
        echo '<p><strong>PHP Version:</strong> <span class="info">' . phpversion() . '</span></p>';
        echo '<p><strong>Server API:</strong> <span class="info">' . php_sapi_name() . '</span></p>';
        echo '<p><strong>Document Root:</strong> <span class="info">' . htmlspecialchars($_SERVER['DOCUMENT_ROOT'] ?? 'N/A') . '</span></p>';
        echo '</div>';
        ?>
        
        <div class="test-item" style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-right-color: #2196F3;">
            <h3>📝 ملاحظات</h3>
            <p style="color: #333; font-family: Arial, sans-serif;">
                ✅ إذا كانت جميع الاختبارات ناجحة، الإعدادات صحيحة.<br>
                ⚠️ إذا ظهرت أخطاء، راجع ملف <strong>LITESPEED_FIX_GUIDE.md</strong> للحلول.<br>
                🗑️ احذف هذا الملف بعد التحقق من الإعدادات.
            </p>
        </div>
    </div>
</body>
</html>

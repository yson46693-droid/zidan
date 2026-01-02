<?php
/**
 * 🔧 سكريبت اختبار sw.js.php
 * Usage: افتح هذا الملف في المتصفح للتحقق من أن sw.js.php يعمل بشكل صحيح
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار sw.js.php</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .test-result {
            background: white;
            padding: 20px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #2196F3;
        }
        .success { border-left-color: #4CAF50; }
        .error { border-left-color: #f44336; }
        .warning { border-left-color: #FFA500; }
        pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 5px;
        }
        .btn:hover { background: #1976D2; }
    </style>
</head>
<body>
    <h1>🔧 اختبار sw.js.php</h1>
    
    <?php
    $swPhpPath = __DIR__ . '/sw.js.php';
    $swJsPath = __DIR__ . '/sw.js';
    
    // اختبار 1: وجود sw.js.php
    echo '<div class="test-result ' . (file_exists($swPhpPath) ? 'success' : 'error') . '">';
    echo '<h3>1️⃣ اختبار وجود sw.js.php</h3>';
    if (file_exists($swPhpPath)) {
        echo '<p>✅ ملف sw.js.php موجود</p>';
        echo '<p>📁 المسار: ' . $swPhpPath . '</p>';
        echo '<p>🔐 الصلاحيات: ' . substr(sprintf('%o', fileperms($swPhpPath)), -4) . '</p>';
    } else {
        echo '<p>❌ ملف sw.js.php غير موجود</p>';
    }
    echo '</div>';
    
    // اختبار 2: وجود sw.js
    echo '<div class="test-result ' . (file_exists($swJsPath) ? 'success' : 'error') . '">';
    echo '<h3>2️⃣ اختبار وجود sw.js</h3>';
    if (file_exists($swJsPath)) {
        echo '<p>✅ ملف sw.js موجود</p>';
        echo '<p>📁 المسار: ' . $swJsPath . '</p>';
        echo '<p>🔐 الصلاحيات: ' . substr(sprintf('%o', fileperms($swJsPath)), -4) . '</p>';
    } else {
        echo '<p>❌ ملف sw.js غير موجود</p>';
    }
    echo '</div>';
    
    // اختبار 3: قراءة sw.js.php
    if (file_exists($swPhpPath)) {
        echo '<div class="test-result success">';
        echo '<h3>3️⃣ محتوى sw.js.php</h3>';
        echo '<pre>' . htmlspecialchars(file_get_contents($swPhpPath)) . '</pre>';
        echo '</div>';
    }
    
    // اختبار 4: اختبار sw.js.php مباشرة
    echo '<div class="test-result warning">';
    echo '<h3>4️⃣ اختبار sw.js.php مباشرة</h3>';
    echo '<p>📋 افتح الرابط التالي في المتصفح:</p>';
    echo '<p><a href="sw.js.php" target="_blank" class="btn">فتح sw.js.php</a></p>';
    echo '<p>✅ يجب أن ترى محتوى JavaScript</p>';
    echo '<p>❌ إذا رأيت HTML أو رسالة خطأ، المشكلة في إعدادات السيرفر</p>';
    echo '</div>';
    
    // اختبار 5: اختبار MIME Type
    echo '<div class="test-result warning">';
    echo '<h3>5️⃣ اختبار MIME Type</h3>';
    echo '<p>📋 افتح Developer Tools (F12) → Network</p>';
    echo '<p>📋 افتح sw.js.php في المتصفح</p>';
    echo '<p>✅ Content-Type يجب أن يكون: <code>application/javascript</code></p>';
    echo '<p>❌ إذا كان <code>text/html</code>، المشكلة في إعدادات السيرفر</p>';
    echo '</div>';
    
    // اختبار 6: اختبار .htaccess
    $htaccessPath = __DIR__ . '/.htaccess';
    echo '<div class="test-result ' . (file_exists($htaccessPath) ? 'success' : 'warning') . '">';
    echo '<h3>6️⃣ اختبار .htaccess</h3>';
    if (file_exists($htaccessPath)) {
        echo '<p>✅ ملف .htaccess موجود</p>';
        echo '<p>📋 محتوى .htaccess:</p>';
        echo '<pre>' . htmlspecialchars(file_get_contents($htaccessPath)) . '</pre>';
    } else {
        echo '<p>⚠️ ملف .htaccess غير موجود</p>';
        echo '<p>📋 يجب إنشاء ملف .htaccess مع الإعدادات الصحيحة</p>';
    }
    echo '</div>';
    ?>
    
    <div class="test-result">
        <h3>📝 ملاحظات</h3>
        <ul>
            <li>✅ إذا كانت جميع الاختبارات ناجحة، sw.js.php يجب أن يعمل</li>
            <li>❌ إذا فشل اختبار 4 أو 5، المشكلة في إعدادات السيرفر</li>
            <li>🔧 تأكد من أن السيرفر ينفذ PHP للملفات .php</li>
            <li>🔧 تأكد من أن .htaccess موجود وصحيح</li>
        </ul>
    </div>
    
    <div style="margin-top: 30px;">
        <a href="index.html" class="btn">العودة للصفحة الرئيسية</a>
        <a href="sw.js.php" target="_blank" class="btn">فتح sw.js.php</a>
    </div>
</body>
</html>

<?php
/**
 * 🔧 ملف اختبار الوصول لمجلد icons
 * Usage: افتح هذا الملف في المتصفح للتحقق من أن icons يمكن الوصول إليها
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار الوصول لـ icons</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
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
        .icon-preview {
            display: inline-block;
            margin: 10px;
            padding: 10px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
            text-align: center;
        }
        .icon-preview img {
            display: block;
            margin: 0 auto 10px;
        }
        pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>🔧 اختبار الوصول لـ icons</h1>
    
    <?php
    $iconsDir = __DIR__ . '/icons';
    $iconsBaseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']) . '/icons';
    
    // اختبار 1: وجود المجلد
    echo '<div class="test-result ' . (is_dir($iconsDir) ? 'success' : 'error') . '">';
    echo '<h3>1️⃣ وجود مجلد icons</h3>';
    echo '<p>' . (is_dir($iconsDir) ? '✅' : '❌') . ' المسار: ' . htmlspecialchars($iconsDir) . '</p>';
    if (is_dir($iconsDir)) {
        echo '<p>✅ المجلد موجود</p>';
        echo '<p>📋 الصلاحيات: ' . substr(sprintf('%o', fileperms($iconsDir)), -4) . '</p>';
    } else {
        echo '<p>❌ المجلد غير موجود</p>';
    }
    echo '</div>';
    
    // اختبار 2: قائمة الملفات
    if (is_dir($iconsDir)) {
        echo '<div class="test-result success">';
        echo '<h3>2️⃣ الملفات الموجودة في icons</h3>';
        $files = glob($iconsDir . '/*.{png,jpg,jpeg,gif,svg,ico,webp}', GLOB_BRACE);
        if (empty($files)) {
            echo '<p>⚠️ لا توجد ملفات صور في المجلد</p>';
        } else {
            echo '<ul>';
            foreach ($files as $file) {
                $filename = basename($file);
                $url = $iconsBaseUrl . '/' . $filename;
                $exists = file_exists($file);
                $readable = is_readable($file);
                $perms = substr(sprintf('%o', fileperms($file)), -4);
                echo '<li>';
                echo ($exists ? '✅' : '❌') . ' ' . htmlspecialchars($filename);
                echo ' - صلاحيات: ' . $perms;
                echo ' - ' . ($readable ? 'قابل للقراءة' : 'غير قابل للقراءة');
                echo ' - <a href="' . htmlspecialchars($url) . '" target="_blank">اختبار الرابط</a>';
                echo '</li>';
            }
            echo '</ul>';
        }
        echo '</div>';
        
        // اختبار 3: معاينة الأيقونات
        echo '<div class="test-result warning">';
        echo '<h3>3️⃣ معاينة الأيقونات</h3>';
        if (!empty($files)) {
            echo '<div style="display: flex; flex-wrap: wrap;">';
            foreach (array_slice($files, 0, 8) as $file) {
                $filename = basename($file);
                $url = $iconsBaseUrl . '/' . $filename . '?v=' . time();
                echo '<div class="icon-preview">';
                echo '<img src="' . htmlspecialchars($url) . '" alt="' . htmlspecialchars($filename) . '" style="max-width: 64px; max-height: 64px;" onerror="this.parentElement.style.borderColor=\'#f44336\'; this.parentElement.innerHTML+=\'<br><small style=\\\'color:#f44336\\\'>❌ فشل التحميل</small>\';">';
                echo '<small>' . htmlspecialchars($filename) . '</small>';
                echo '</div>';
            }
            echo '</div>';
            echo '<p><strong>ملاحظة:</strong> إذا كانت الأيقونات لا تظهر، فهذا يعني أن هناك مشكلة في الوصول للملفات.</p>';
        }
        echo '</div>';
    }
    
    // اختبار 4: معلومات الخادم
    echo '<div class="test-result success">';
    echo '<h3>4️⃣ معلومات الخادم</h3>';
    echo '<ul>';
    echo '<li>المسار الأساسي: ' . htmlspecialchars(__DIR__) . '</li>';
    echo '<li>URL الأساسي: ' . htmlspecialchars($iconsBaseUrl) . '</li>';
    echo '<li>SERVER_SOFTWARE: ' . htmlspecialchars($_SERVER['SERVER_SOFTWARE'] ?? 'غير معروف') . '</li>';
    echo '<li>SCRIPT_NAME: ' . htmlspecialchars($_SERVER['SCRIPT_NAME'] ?? 'غير معروف') . '</li>';
    echo '</ul>';
    echo '</div>';
    
    // اختبار 5: اختبار الوصول المباشر
    echo '<div class="test-result warning">';
    echo '<h3>5️⃣ روابط اختبار مباشرة</h3>';
    echo '<p>جرب فتح هذه الروابط في تبويب جديد:</p>';
    echo '<ul>';
    $testFiles = ['icon-192x192.png', 'icon-512x512.png', 'icon-72x72.png'];
    foreach ($testFiles as $testFile) {
        $testPath = $iconsDir . '/' . $testFile;
        if (file_exists($testPath)) {
            $testUrl = $iconsBaseUrl . '/' . $testFile . '?v=' . time();
            echo '<li><a href="' . htmlspecialchars($testUrl) . '" target="_blank">' . htmlspecialchars($testFile) . '</a></li>';
        }
    }
    echo '</ul>';
    echo '</div>';
    ?>
    
    <div style="margin-top: 30px;">
        <a href="index.html" style="display: inline-block; padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px;">العودة للصفحة الرئيسية</a>
    </div>
    
    <script>
        // اختبار تحميل الأيقونات باستخدام JavaScript
        document.addEventListener('DOMContentLoaded', function() {
            const icons = ['icon-192x192.png', 'icon-512x512.png', 'icon-72x72.png', 'icon-96x96.png'];
            const baseUrl = '<?php echo $iconsBaseUrl; ?>';
            
            console.log('اختبار تحميل الأيقونات...');
            icons.forEach(function(icon) {
                const img = new Image();
                img.onload = function() {
                    console.log('✅ تم تحميل: ' + icon);
                };
                img.onerror = function() {
                    console.error('❌ فشل تحميل: ' + icon + ' - URL: ' + baseUrl + '/' + icon);
                };
                img.src = baseUrl + '/' + icon + '?v=' + Date.now();
            });
        });
    </script>
</body>
</html>

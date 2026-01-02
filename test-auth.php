<?php
/**
 * 🔧 ملف اختبار api/auth.php
 * Usage: افتح هذا الملف في المتصفح للتحقق من أن api/auth.php يعمل بشكل صحيح
 */

// ✅ CRITICAL: تنظيف output buffer قبل أي شيء
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ✅ CRITICAL: إعدادات الأخطاء
error_reporting(E_ALL);
ini_set('display_errors', 0); // لا نعرض الأخطاء مباشرة - سنعالجها
ini_set('log_errors', 1);

// ✅ CRITICAL: معالجة الأخطاء القاتلة
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطأ</title></head><body>';
        echo '<h1>❌ خطأ في الملف</h1>';
        echo '<p><strong>الخطأ:</strong> ' . htmlspecialchars($error['message']) . '</p>';
        echo '<p><strong>الملف:</strong> ' . htmlspecialchars($error['file']) . '</p>';
        echo '<p><strong>السطر:</strong> ' . $error['line'] . '</p>';
        echo '</body></html>';
        exit;
    }
});

// ✅ CRITICAL: معالجة الاستثناءات غير المعالجة
set_exception_handler(function($exception) {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطأ</title></head><body>';
    echo '<h1>❌ خطأ استثناء</h1>';
    echo '<p><strong>الرسالة:</strong> ' . htmlspecialchars($exception->getMessage()) . '</p>';
    echo '<p><strong>الملف:</strong> ' . htmlspecialchars($exception->getFile()) . '</p>';
    echo '<p><strong>السطر:</strong> ' . $exception->getLine() . '</p>';
    echo '</body></html>';
    exit;
});

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار api/auth.php</title>
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
        pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 5px;
            border: none;
            cursor: pointer;
        }
        .btn:hover { background: #1976D2; }
        .btn-danger { background: #f44336; }
        .btn-danger:hover { background: #d32f2f; }
        form {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        input {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <h1>🔧 اختبار api/auth.php</h1>
    
    <?php
    $authPath = __DIR__ . '/api/auth.php';
    $configPath = __DIR__ . '/api/config.php';
    $databasePath = __DIR__ . '/api/database.php';
    
    // اختبار 1: وجود الملفات
    echo '<div class="test-result ' . (file_exists($authPath) ? 'success' : 'error') . '">';
    echo '<h3>1️⃣ اختبار وجود الملفات</h3>';
    echo '<ul>';
    echo '<li>' . (file_exists($authPath) ? '✅' : '❌') . ' api/auth.php: ' . ($authPath) . '</li>';
    echo '<li>' . (file_exists($configPath) ? '✅' : '❌') . ' api/config.php: ' . ($configPath) . '</li>';
    echo '<li>' . (file_exists($databasePath) ? '✅' : '❌') . ' api/database.php: ' . ($databasePath) . '</li>';
    echo '</ul>';
    echo '</div>';
    
    // اختبار 2: صلاحيات الملفات
    if (file_exists($authPath)) {
        echo '<div class="test-result success">';
        echo '<h3>2️⃣ صلاحيات الملفات</h3>';
        echo '<ul>';
        echo '<li>api/auth.php: ' . substr(sprintf('%o', fileperms($authPath)), -4) . '</li>';
        echo '<li>api/config.php: ' . (file_exists($configPath) ? substr(sprintf('%o', fileperms($configPath)), -4) : 'غير موجود') . '</li>';
        echo '<li>api/database.php: ' . (file_exists($databasePath) ? substr(sprintf('%o', fileperms($databasePath)), -4) : 'غير موجود') . '</li>';
        echo '</ul>';
        echo '</div>';
    }
    
    // اختبار 3: تحميل config.php (بدون تنفيذ فعلي - فقط فحص الصيغة)
    echo '<div class="test-result warning">';
    echo '<h3>3️⃣ اختبار config.php</h3>';
    if (file_exists($configPath)) {
        // ✅ فحص الصيغة فقط بدون تنفيذ
        $configContent = @file_get_contents($configPath);
        if ($configContent === false) {
            echo '<p>❌ لا يمكن قراءة ملف config.php (مشكلة في الصلاحيات)</p>';
        } else {
            // فحص بسيط للصيغة
            if (strpos($configContent, '<?php') !== false) {
                echo '<p>✅ ملف config.php موجود ويمكن قراءته</p>';
                echo '<p>📋 حجم الملف: ' . number_format(filesize($configPath)) . ' بايت</p>';
                
                // ✅ محاولة فحص syntax فقط (بدون تنفيذ)
                $syntaxCheck = @shell_exec('php -l ' . escapeshellarg($configPath) . ' 2>&1');
                if ($syntaxCheck && strpos($syntaxCheck, 'No syntax errors') !== false) {
                    echo '<p>✅ الصيغة صحيحة</p>';
                } else {
                    echo '<p>⚠️ لا يمكن فحص الصيغة (قد يكون طبيعي على بعض الاستضافات)</p>';
                }
            } else {
                echo '<p>⚠️ ملف config.php لا يبدأ بـ &lt;?php</p>';
            }
        }
    } else {
        echo '<p>❌ ملف config.php غير موجود</p>';
    }
    echo '</div>';
    
    // اختبار 4: اختبار api/auth.php مباشرة
    echo '<div class="test-result warning">';
    echo '<h3>4️⃣ اختبار api/auth.php مباشرة</h3>';
    echo '<p>📋 استخدم النموذج أدناه لاختبار تسجيل الدخول:</p>';
    echo '</div>';
    
    // اختبار 5: فحص سجلات الأخطاء
    echo '<div class="test-result warning">';
    echo '<h3>5️⃣ فحص سجلات الأخطاء</h3>';
    $errorLogPaths = [
        __DIR__ . '/logs/php_errors.log',
        __DIR__ . '/logs/error_log',
        ini_get('error_log')
    ];
    
    $foundLog = false;
    foreach ($errorLogPaths as $errorLogPath) {
        if ($errorLogPath && file_exists($errorLogPath) && is_readable($errorLogPath)) {
            $errors = @file_get_contents($errorLogPath);
            if ($errors !== false) {
                $recentErrors = array_slice(explode("\n", $errors), -20); // آخر 20 سطر
                echo '<p>📋 آخر 20 سطر من سجل الأخطاء (' . basename($errorLogPath) . '):</p>';
                echo '<pre>' . htmlspecialchars(implode("\n", $recentErrors)) . '</pre>';
                $foundLog = true;
                break;
            }
        }
    }
    
    if (!$foundLog) {
        echo '<p>⚠️ لم يتم العثور على سجل الأخطاء في الأماكن التالية:</p>';
        echo '<ul>';
        foreach ($errorLogPaths as $path) {
            if ($path) {
                echo '<li>' . htmlspecialchars($path) . '</li>';
            }
        }
        echo '</ul>';
        echo '<p>📋 تحقق من إعدادات PHP: <code>ini_get(\'error_log\')</code></p>';
    }
    echo '</div>';
    
    // اختبار 6: معلومات PHP
    echo '<div class="test-result success">';
    echo '<h3>6️⃣ معلومات PHP</h3>';
    echo '<ul>';
    echo '<li>إصدار PHP: ' . phpversion() . '</li>';
    echo '<li>error_log: ' . (ini_get('error_log') ?: 'غير معرّف') . '</li>';
    echo '<li>display_errors: ' . (ini_get('display_errors') ? 'On' : 'Off') . '</li>';
    echo '<li>log_errors: ' . (ini_get('log_errors') ? 'On' : 'Off') . '</li>';
    echo '</ul>';
    echo '</div>';
    ?>
    
    <form method="POST" action="api/auth.php" id="testForm">
        <h3>🧪 اختبار تسجيل الدخول</h3>
        <input type="text" name="username" placeholder="اسم المستخدم" value="1" required>
        <input type="password" name="password" placeholder="كلمة المرور" value="1" required>
        <button type="submit" class="btn">اختبار تسجيل الدخول</button>
    </form>
    
    <div id="result" style="display: none;" class="test-result">
        <h3>📥 النتيجة:</h3>
        <pre id="resultContent"></pre>
    </div>
    
    <script>
        document.getElementById('testForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const resultDiv = document.getElementById('result');
            const resultContent = document.getElementById('resultContent');
            
            resultDiv.style.display = 'block';
            resultContent.textContent = 'جاري الاختبار...';
            
            try {
                const response = await fetch('api/auth.php', {
                    method: 'POST',
                    body: formData
                });
                
                const text = await response.text();
                let jsonData;
                
                try {
                    jsonData = JSON.parse(text);
                    resultContent.textContent = JSON.stringify(jsonData, null, 2);
                    resultDiv.className = 'test-result ' + (jsonData.success ? 'success' : 'error');
                } catch (e) {
                    resultContent.textContent = 'Status: ' + response.status + '\n\n' + text;
                    resultDiv.className = 'test-result error';
                }
            } catch (error) {
                resultContent.textContent = 'خطأ: ' + error.message;
                resultDiv.className = 'test-result error';
            }
        });
    </script>
    
    <div style="margin-top: 30px;">
        <a href="index.html" class="btn">العودة للصفحة الرئيسية</a>
        <a href="test-sw-js.php" class="btn">اختبار Service Worker</a>
    </div>
</body>
</html>

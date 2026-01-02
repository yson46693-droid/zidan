<?php
/**
 * 🔧 ملف اختبار مباشر لـ api/auth.php
 * هذا الملف يحاكي طلب POST مباشرة
 */

// ✅ CRITICAL: تنظيف output buffer
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ✅ CRITICAL: إعدادات الأخطاء
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار مباشر - api/auth.php</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .result {
            background: white;
            padding: 20px;
            margin: 20px 0;
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
    </style>
</head>
<body>
    <h1>🔧 اختبار مباشر - api/auth.php</h1>
    
    <?php
    echo '<div class="result warning">';
    echo '<h3>📋 اختبار تحميل config.php</h3>';
    
    try {
        ob_start();
        require_once __DIR__ . '/api/config.php';
        $output = ob_get_clean();
        
        if (!empty($output)) {
            echo '<p>⚠️ تم إنتاج output عند تحميل config.php:</p>';
            echo '<pre>' . htmlspecialchars($output) . '</pre>';
        }
        
        // التحقق من الدوال
        $functions = ['getRequestMethod', 'getRequestData', 'response', 'getDBConnection', 'dbSelectOne'];
        $missing = [];
        foreach ($functions as $func) {
            if (!function_exists($func)) {
                $missing[] = $func;
            }
        }
        
        if (empty($missing)) {
            echo '<p>✅ جميع الدوال المطلوبة موجودة</p>';
        } else {
            echo '<p>❌ الدوال المفقودة:</p>';
            echo '<ul>';
            foreach ($missing as $func) {
                echo '<li>' . htmlspecialchars($func) . '</li>';
            }
            echo '</ul>';
        }
        
    } catch (Exception $e) {
        echo '<p>❌ خطأ في تحميل config.php:</p>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
        echo '<p>File: ' . htmlspecialchars($e->getFile()) . '</p>';
        echo '<p>Line: ' . $e->getLine() . '</p>';
    } catch (Error $e) {
        echo '<p>❌ خطأ قاتل في تحميل config.php:</p>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
        echo '<p>File: ' . htmlspecialchars($e->getFile()) . '</p>';
        echo '<p>Line: ' . $e->getLine() . '</p>';
    }
    
    echo '</div>';
    
    // اختبار api/auth.php مباشرة
    echo '<div class="result warning">';
    echo '<h3>📋 اختبار api/auth.php مباشرة</h3>';
    echo '<p>محاكاة طلب POST...</p>';
    
    // محاكاة POST request
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = [
        'username' => '1',
        'password' => '1'
    ];
    
    // التقاط output
    ob_start();
    try {
        include __DIR__ . '/api/auth.php';
        $output = ob_get_clean();
        
        echo '<p>✅ تم تنفيذ api/auth.php</p>';
        echo '<p>📥 Output:</p>';
        echo '<pre>' . htmlspecialchars($output) . '</pre>';
        
        // محاولة تحليل JSON
        $json = json_decode($output, true);
        if ($json) {
            echo '<p>📋 JSON Parsed:</p>';
            echo '<pre>' . htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
        } else {
            echo '<p>⚠️ Output ليس JSON صحيح</p>';
        }
        
    } catch (Exception $e) {
        $output = ob_get_clean();
        echo '<p>❌ خطأ في تنفيذ api/auth.php:</p>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
        echo '<p>File: ' . htmlspecialchars($e->getFile()) . '</p>';
        echo '<p>Line: ' . $e->getLine() . '</p>';
        if (!empty($output)) {
            echo '<p>Output قبل الخطأ:</p>';
            echo '<pre>' . htmlspecialchars($output) . '</pre>';
        }
    } catch (Error $e) {
        $output = ob_get_clean();
        echo '<p>❌ خطأ قاتل في تنفيذ api/auth.php:</p>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
        echo '<p>File: ' . htmlspecialchars($e->getFile()) . '</p>';
        echo '<p>Line: ' . $e->getLine() . '</p>';
        if (!empty($output)) {
            echo '<p>Output قبل الخطأ:</p>';
            echo '<pre>' . htmlspecialchars($output) . '</pre>';
        }
    }
    
    echo '</div>';
    ?>
    
    <div style="margin-top: 30px;">
        <a href="index.html" style="display: inline-block; padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px;">العودة للصفحة الرئيسية</a>
    </div>
</body>
</html>

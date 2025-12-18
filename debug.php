<?php
/**
 * ملف تصحيح الأخطاء - يعرض معلومات عن حالة النظام
 * يمكن الوصول إليه عبر: /debug.php
 */

header('Content-Type: text/html; charset=utf-8');

// التحقق من أن الملف يعمل
echo "<!DOCTYPE html>
<html lang='ar' dir='rtl'>
<head>
    <meta charset='UTF-8'>
    <title>معلومات التصحيح - نظام إدارة محل الصيانة</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        h1 { color: #2196F3; }
        .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: right; border: 1px solid #ddd; }
        th { background: #2196F3; color: white; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🔧 معلومات التصحيح - نظام إدارة محل الصيانة</h1>";

// 1. معلومات PHP
echo "<div class='section'>
    <h2>معلومات PHP</h2>
    <table>
        <tr><th>المعلومة</th><th>القيمة</th></tr>
        <tr><td>إصدار PHP</td><td>" . phpversion() . "</td></tr>
        <tr><td>MySQLi مفعّل</td><td>" . (extension_loaded('mysqli') ? '<span class="success">✅ نعم</span>' : '<span class="error">❌ لا</span>') . "</td></tr>
        <tr><td>JSON مفعّل</td><td>" . (extension_loaded('json') ? '<span class="success">✅ نعم</span>' : '<span class="error">❌ لا</span>') . "</td></tr>
        <tr><td>Session مفعّل</td><td>" . (function_exists('session_start') ? '<span class="success">✅ نعم</span>' : '<span class="error">❌ لا</span>') . "</td></tr>
    </table>
</div>";

// 2. اختبار الاتصال بقاعدة البيانات
echo "<div class='section'>
    <h2>اختبار الاتصال بقاعدة البيانات</h2>";

require_once __DIR__ . '/database.php';

$conn = getDBConnection();
if ($conn) {
    echo "<p class='success'>✅ تم الاتصال بقاعدة البيانات بنجاح</p>";
    echo "<table>
        <tr><th>المعلومة</th><th>القيمة</th></tr>
        <tr><td>Host</td><td>" . DB_HOST . "</td></tr>
        <tr><td>User</td><td>" . DB_USER . "</td></tr>
        <tr><td>Database</td><td>" . DB_NAME . "</td></tr>
        <tr><td>Charset</td><td>" . DB_CHARSET . "</td></tr>
        <tr><td>MySQL Version</td><td>" . $conn->server_info . "</td></tr>
    </table>";
    
    // التحقق من الجداول
    $tables = ['users', 'customers', 'repairs', 'inventory', 'expenses', 'loss_operations', 'settings', 'telegram_backup_config'];
    echo "<h3>حالة الجداول:</h3><table><tr><th>اسم الجدول</th><th>الحالة</th></tr>";
    foreach ($tables as $table) {
        $result = $conn->query("SHOW TABLES LIKE '$table'");
        $exists = $result && $result->num_rows > 0;
        echo "<tr><td>$table</td><td>" . ($exists ? '<span class="success">✅ موجود</span>' : '<span class="error">❌ غير موجود</span>') . "</td></tr>";
    }
    echo "</table>";
    
    // التحقق من وجود المستخدم
    $user = dbSelectOne("SELECT COUNT(*) as count FROM users WHERE username = '1'", []);
    if ($user && $user['count'] > 0) {
        echo "<p class='success'>✅ المستخدم '1' موجود في قاعدة البيانات</p>";
    } else {
        echo "<p class='error'>❌ المستخدم '1' غير موجود في قاعدة البيانات</p>";
    }
    
} else {
    echo "<p class='error'>❌ فشل الاتصال بقاعدة البيانات</p>";
    echo "<p>تحقق من إعدادات قاعدة البيانات في ملف api/database.php</p>";
}

echo "</div>";

// 3. معلومات الملفات
echo "<div class='section'>
    <h2>معلومات الملفات</h2>
    <table>
        <tr><th>الملف</th><th>الحالة</th></tr>";

$files = [
    'api/config.php',
    'api/database.php',
    'api/auth.php',
    'database.sql'
];

foreach ($files as $file) {
    $exists = file_exists(__DIR__ . '/../' . $file);
    echo "<tr><td>$file</td><td>" . ($exists ? '<span class="success">✅ موجود</span>' : '<span class="error">❌ غير موجود</span>') . "</td></tr>";
}

echo "</table></div>";

// 4. سجلات الأخطاء
$logFile = __DIR__ . '/../logs/php_errors.log';
echo "<div class='section'>
    <h2>آخر الأخطاء (من ملف السجلات)</h2>";

if (file_exists($logFile)) {
    $lines = file($logFile);
    $lastLines = array_slice($lines, -20); // آخر 20 سطر
    echo "<pre>" . htmlspecialchars(implode('', $lastLines)) . "</pre>";
} else {
    echo "<p class='warning'>⚠️ ملف السجلات غير موجود</p>";
}

echo "</div>";

echo "</div></body></html>";
?>


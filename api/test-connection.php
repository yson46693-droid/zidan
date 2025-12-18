<?php
/**
 * ملف اختبار الاتصال بقاعدة البيانات
 * يمكن الوصول إليه عبر: /api/test-connection.php
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/database.php';

$result = [
    'success' => false,
    'message' => '',
    'details' => []
];

try {
    // اختبار الاتصال
    $conn = getDBConnection();
    
    if ($conn) {
        $result['success'] = true;
        $result['message'] = 'تم الاتصال بقاعدة البيانات بنجاح';
        $result['details'] = [
            'host' => DB_HOST,
            'user' => DB_USER,
            'database' => DB_NAME,
            'port' => defined('DB_PORT') ? DB_PORT : 3306,
            'charset' => DB_CHARSET,
            'mysql_version' => $conn->server_info,
            'connection_id' => $conn->thread_id
        ];
        
        // اختبار استعلام بسيط
        $testQuery = dbSelectOne("SELECT 1 as test");
        if ($testQuery !== false) {
            $result['details']['query_test'] = 'نجح';
        } else {
            $result['details']['query_test'] = 'فشل';
        }
        
        // التحقق من الجداول
        $tables = ['users', 'customers', 'repairs', 'inventory', 'expenses', 'loss_operations', 'settings', 'telegram_backup_config'];
        $result['details']['tables'] = [];
        foreach ($tables as $table) {
            $tableCheck = dbSelectOne("SHOW TABLES LIKE '$table'");
            $result['details']['tables'][$table] = $tableCheck ? 'موجود' : 'غير موجود';
        }
        
        // التحقق من المستخدم 1
        $user1 = dbSelectOne("SELECT id, username, name, role FROM users WHERE username = '1'");
        $result['details']['user_1'] = $user1 ? [
            'exists' => true,
            'id' => $user1['id'],
            'name' => $user1['name'],
            'role' => $user1['role']
        ] : ['exists' => false];
        
    } else {
        $result['message'] = 'فشل الاتصال بقاعدة البيانات';
        $result['details'] = [
            'host' => DB_HOST,
            'user' => DB_USER,
            'database' => DB_NAME,
            'port' => defined('DB_PORT') ? DB_PORT : 3306,
            'error' => 'لا يمكن الاتصال. تحقق من إعدادات قاعدة البيانات.'
        ];
    }
    
} catch (Exception $e) {
    $result['message'] = 'خطأ: ' . $e->getMessage();
    $result['details'] = [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ];
} catch (Error $e) {
    $result['message'] = 'خطأ قاتل: ' . $e->getMessage();
    $result['details'] = [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ];
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>


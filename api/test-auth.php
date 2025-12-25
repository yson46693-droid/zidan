<?php
/**
 * ملف اختبار لتشخيص مشكلة 403 في auth.php
 * استخدم هذا الملف للتحقق من أن الخادم يسمح بتنفيذ PHP
 */

// تنظيف output buffer
while (ob_get_level() > 0) {
    ob_end_clean();
}

// إعدادات CORS
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$currentHost = $_SERVER['HTTP_HOST'] ?? '';

if (!empty($requestOrigin)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Access-Control-Allow-Credentials: true');
} elseif (!empty($currentHost)) {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $currentOrigin = $protocol . '://' . $currentHost;
    header('Access-Control-Allow-Origin: ' . $currentOrigin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// معالجة طلبات OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// معلومات التشخيص
$diagnostics = [
    'success' => true,
    'message' => '✅ ملف test-auth.php يعمل بشكل صحيح',
    'server_info' => [
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
        'request_method' => $_SERVER['REQUEST_METHOD'],
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
        'http_host' => $_SERVER['HTTP_HOST'] ?? 'unknown',
        'http_origin' => $_SERVER['HTTP_ORIGIN'] ?? 'none',
        'https' => isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'not_set',
        'server_port' => $_SERVER['SERVER_PORT'] ?? 'unknown',
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'not_set',
        'content_length' => $_SERVER['CONTENT_LENGTH'] ?? '0'
    ],
    'file_permissions' => [
        'auth_php_exists' => file_exists(__DIR__ . '/auth.php'),
        'auth_php_readable' => is_readable(__DIR__ . '/auth.php'),
        'config_php_exists' => file_exists(__DIR__ . '/config.php'),
        'config_php_readable' => is_readable(__DIR__ . '/config.php'),
        'database_php_exists' => file_exists(__DIR__ . '/database.php'),
        'database_php_readable' => is_readable(__DIR__ . '/database.php')
    ],
    'session_info' => [
        'session_status' => session_status(),
        'session_id' => session_id() ?: 'not_started'
    ],
    'post_data' => [
        'has_post_data' => !empty($_POST),
        'post_keys' => array_keys($_POST),
        'raw_input' => file_get_contents('php://input') ?: 'empty'
    ]
];

// محاولة الاتصال بقاعدة البيانات
try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/database.php';
    
    $conn = getDBConnection();
    if ($conn) {
        $diagnostics['database'] = [
            'connected' => true,
            'host' => defined('DB_HOST') ? DB_HOST : 'unknown',
            'database' => defined('DB_NAME') ? DB_NAME : 'unknown',
            'charset' => $conn->character_set_name()
        ];
    } else {
        $diagnostics['database'] = [
            'connected' => false,
            'error' => 'فشل الاتصال بقاعدة البيانات'
        ];
    }
} catch (Exception $e) {
    $diagnostics['database'] = [
        'connected' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ];
}

echo json_encode($diagnostics, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>


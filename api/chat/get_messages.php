<?php
/**
 * API: جلب رسائل الدردشة الجماعية
 */

define('ACCESS_ALLOWED', true);

// بدء الجلسة أولاً
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// إعدادات CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    return false;
});

try {
    // تحميل ملف قاعدة البيانات مباشرة
    require_once __DIR__ . '/../database.php';
    require_once __DIR__ . '/auth_helper.php';
    require_once __DIR__ . '/../../includes/chat.php';
} catch (Throwable $e) {
    error_log('chat/get_messages bootstrap error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Initialization error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// التحقق من المصادقة
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode([
        'success' => false, 
        'error' => 'غير مصرح لك. يرجى تسجيل الدخول.',
        'debug' => [
            'session_id' => session_id(),
            'has_user_id' => isset($_SESSION['user_id']),
            'session_data' => isset($_SESSION) ? array_keys($_SESSION) : []
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $currentUser = getCurrentUser();
    if (!$currentUser || !isset($currentUser['id'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false, 
            'error' => 'لم يتم العثور على بيانات المستخدم',
            'debug' => [
                'session_id' => session_id(),
                'has_user_id' => isset($_SESSION['user_id']),
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $userId = $currentUser['id']; // استخدام ID كما هو (قد يكون string)

    updateUserPresence($userId, true);

    $since = isset($_GET['since']) ? (string) $_GET['since'] : null;
    $afterId = isset($_GET['after_id']) ? (int) $_GET['after_id'] : null;
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;

    $limit = max(1, min($limit, 200));

    if ($afterId !== null && $afterId > 0) {
        $since = null;
    }

    $messages = getChatMessages($since, $limit, $userId);

    if ($afterId !== null && $afterId > 0) {
        $messages = array_values(array_filter($messages, function ($message) use ($afterId) {
            return (int) $message['id'] > $afterId;
        }));
    }

    $markReadIds = [];
    foreach ($messages as $message) {
        if ((int) $message['user_id'] !== $userId && (int) $message['deleted'] === 0) {
            $markReadIds[] = (int) $message['id'];
        }
    }

    if (!empty($markReadIds)) {
        foreach ($markReadIds as $mid) {
            markMessageAsRead($mid, $userId);
        }
    }

    $latestTimestamp = getLastMessageTimestamp();

    // جلب المستخدمين مع معالجة الأخطاء
    $users = [];
    try {
        $users = getActiveUsers();
        if (!is_array($users)) {
            error_log('get_messages: getActiveUsers لم تعد مصفوفة');
            $users = [];
        }
    } catch (Throwable $userError) {
        error_log('get_messages: خطأ في جلب المستخدمين: ' . $userError->getMessage());
        $users = [];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'messages' => $messages,
            'latest_timestamp' => $latestTimestamp,
            'users' => $users,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('chat/get_messages error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}


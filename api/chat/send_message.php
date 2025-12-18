<?php
/**
 * API: إرسال رسالة جديدة إلى الدردشة الجماعية
 */

define('ACCESS_ALLOWED', true);

// بدء الجلسة أولاً
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
    require_once __DIR__ . '/../database.php';
    require_once __DIR__ . '/auth_helper.php';
    require_once __DIR__ . '/../../includes/chat.php';
} catch (Throwable $e) {
    error_log('chat/send_message bootstrap error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Initialization error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $currentUser = getCurrentUser();
    if (!$currentUser || !isset($currentUser['id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'User not found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $userId = $currentUser['id'];

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $messageText = isset($payload['message']) ? (string) $payload['message'] : '';
    $replyTo = isset($payload['reply_to']) ? (int) $payload['reply_to'] : null;

    if ($replyTo !== null && $replyTo <= 0) {
        $replyTo = null;
    }

    if ($replyTo !== null) {
        $original = db()->queryOne(
            "SELECT id FROM messages WHERE id = ?",
            [$replyTo]
        );
        if (!$original) {
            $replyTo = null;
        }
    }

    $message = sendChatMessage($userId, $messageText, $replyTo);
    markMessageAsRead((int) $message['id'], $userId);

    echo json_encode([
        'success' => true,
        'data' => $message,
    ], JSON_UNESCAPED_UNICODE);
} catch (InvalidArgumentException $invalid) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => $invalid->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('chat/send_message error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}


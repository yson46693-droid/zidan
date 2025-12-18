<?php
/**
 * API تسجيل WebAuthn - نظام جديد مبسط
 */

// منع أي output قبل headers
ob_start();

define('ACCESS_ALLOWED', true);

// بدء الجلسة قبل تحميل الملفات
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/../webauthn/webauthn.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'خطأ في تحميل النظام: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// تنظيف output buffer
ob_end_clean();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'يجب استخدام طريقة POST'], JSON_UNESCAPED_UNICODE);
    exit;
}

// التحقق من تسجيل الدخول
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'غير مصرح. يرجى تسجيل الدخول أولاً'], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = $_SESSION['user_id'];

try {
    // قراءة البيانات من JSON
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    
    if (!$input) {
        $input = $_POST;
    }

    $action = $input['action'] ?? 'challenge';

    if ($action === 'challenge') {
        // إنشاء challenge للتسجيل
        $user = dbSelectOne(
            "SELECT id, username, name FROM users WHERE id = ?",
            [$userId]
        );
        
        if (!$user) {
            throw new Exception('المستخدم غير موجود');
        }

        $challenge = WebAuthn::createRegistrationChallenge($userId, $user['username']);
        
        if (!$challenge) {
            throw new Exception('فشل في إنشاء challenge');
        }

        echo json_encode([
            'success' => true,
            'data' => $challenge
        ], JSON_UNESCAPED_UNICODE);

    } elseif ($action === 'verify') {
        // التحقق من البصمة وحفظها
        $response = $input['response'] ?? null;
        
        if (!$response) {
            throw new Exception('بيانات الاعتماد غير مكتملة');
        }

        // تحويل response من JSON string إلى array إذا لزم الأمر
        if (is_string($response)) {
            $response = json_decode($response, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('استجابة غير صحيحة: ' . json_last_error_msg());
            }
        }

        // التحقق من البصمة
        $result = WebAuthn::verifyRegistration(json_encode($response), $userId);
        
        if ($result) {
            // تحديث حالة المستخدم
            dbExecute("UPDATE users SET webauthn_enabled = 1, updated_at = NOW() WHERE id = ?", [$userId]);
            
            echo json_encode([
                'success' => true,
                'message' => 'تم تسجيل البصمة بنجاح'
            ], JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('فشل التحقق من البصمة. تحقق من سجلات الخادم.');
        }

    } else {
        throw new Exception('إجراء غير صحيح');
    }

} catch (Exception $e) {
    http_response_code(500);
    error_log("WebAuthn register error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>

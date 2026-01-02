<?php
/**
 * API لإدارة بيانات WebAuthn (البصمة)
 */

// منع أي output قبل headers
ob_start();

define('ACCESS_ALLOWED', true);

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/database.php';
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
// CORS headers
header('Access-Control-Allow-Origin: ' . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// التحقق من تسجيل الدخول باستخدام checkAuth()
// checkAuth() سيقوم بـ response() تلقائياً إذا لم يكن هناك جلسة نشطة
$session = checkAuth();
$userId = $session['user_id'];

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    try {
        $credentials = dbSelect(
            "SELECT id, credential_id, device_name, created_at, last_used 
             FROM webauthn_credentials 
             WHERE user_id = ? 
             ORDER BY created_at DESC",
            [$userId]
        );
        
        // التأكد من أن $credentials هو array
        if ($credentials === false) {
            $credentials = [];
        }
        
        response(true, '', ['credentials' => $credentials]);
        
    } catch (Exception $e) {
        error_log("WebAuthn Credentials List Error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        response(false, 'خطأ في تحميل البصمات: ' . $e->getMessage(), null, 500);
    }
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete') {
    // حذف اعتماد محدد
    $data = getRequestData();
    $credentialId = $data['credential_id'] ?? $_POST['credential_id'] ?? '';
    
    if (empty($credentialId)) {
        response(false, 'معرّف الاعتماد مطلوب', null, 400);
    }
    
    // التحقق من أن الاعتماد يخص المستخدم الحالي
    $credential = dbSelectOne(
        "SELECT id FROM webauthn_credentials WHERE id = ? AND user_id = ?",
        [$credentialId, $userId]
    );
    
    if (!$credential) {
        response(false, 'الاعتماد غير موجود أو غير مسموح', null, 404);
    }
    
    // حذف الاعتماد
    $result = dbExecute(
        "DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?",
        [$credentialId, $userId]
    );
    
    if ($result === false) {
        response(false, 'فشل حذف البصمة', null, 500);
    }
    
    // التحقق من وجود اعتماديات أخرى للمستخدم
    $remainingCount = dbSelectOne(
        "SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ?",
        [$userId]
    );
    
    // إذا لم يبق أي اعتماد، تحديث حالة المستخدم
    if ($remainingCount && $remainingCount['count'] == 0) {
        dbExecute(
            "UPDATE users SET webauthn_enabled = 0, updated_at = NOW() WHERE id = ?",
            [$userId]
        );
    }
    
    response(true, 'تم حذف البصمة بنجاح', [
        'remaining_count' => $remainingCount ? $remainingCount['count'] : 0
    ]);
    
} else {
    response(false, 'إجراء غير صحيح', null, 400);
}
?>

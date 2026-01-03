<?php
/**
 * API تسجيل الدخول WebAuthn
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
    echo json_encode(['success' => false, 'error' => 'يجب استخدام طريقة POST'], JSON_UNESCAPED_UNICODE);
    exit;
}

// قراءة البيانات من JSON أو POST
$rawInput = file_get_contents('php://input');
$input = null;

// محاولة قراءة JSON أولاً
if (!empty($rawInput)) {
    $input = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        // إذا فشل فك الترميز JSON، نستخدم $_POST
        $input = null;
    }
}

// إذا لم يكن هناك JSON، استخدم $_POST
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$action = $input['action'] ?? '';

try {
    if ($action === 'create_challenge') {
        $username = $input['username'] ?? '';
        
        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'اسم المستخدم مطلوب'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        error_log("WebAuthn Login API - Creating challenge for username: " . $username);
        
        $challenge = WebAuthn::createLoginChallenge($username);
        
        if ($challenge && is_array($challenge)) {
            error_log("WebAuthn Login API - Challenge created successfully. allowCredentials count: " . (isset($challenge['allowCredentials']) ? count($challenge['allowCredentials']) : 0));
            echo json_encode(['success' => true, 'challenge' => $challenge], JSON_UNESCAPED_UNICODE);
        } else {
            error_log("WebAuthn Login API - Failed to create challenge. Challenge type: " . gettype($challenge));
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'لا توجد بصمات مسجلة لهذا المستخدم'], JSON_UNESCAPED_UNICODE);
        }
        
    } elseif ($action === 'verify') {
        $response = $input['response'] ?? $_POST['response'] ?? '';
        
        if (empty($response)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'الاستجابة مطلوبة'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        // تحويل JSON string إلى array إذا لزم الأمر
        if (is_string($response)) {
            $response = json_decode($response, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'استجابة غير صحيحة: ' . json_last_error_msg()], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        
        // إذا كان response هو array بالفعل، استخدمه مباشرة
        if (!is_array($response)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'استجابة غير صحيحة: يجب أن تكون array أو JSON string'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        // إرسال response object كامل إلى verifyLogin
        error_log("WebAuthn Login API - Verifying login. Response keys: " . implode(', ', array_keys($response)));
        if (isset($response['rawId'])) {
            error_log("WebAuthn Login API - rawId (first 30 chars): " . substr($response['rawId'], 0, 30));
        }
        
        $userId = WebAuthn::verifyLogin(json_encode($response));
        
        error_log("WebAuthn Login API - verifyLogin returned: " . ($userId ? $userId : 'false'));
        
        if ($userId) {
            // الحصول على بيانات المستخدم مع اسم الفرع
            $user = dbSelectOne(
                "SELECT u.id, u.username, u.name, u.role, u.branch_id, b.name as branch_name 
                 FROM users u 
                 LEFT JOIN branches b ON u.branch_id = b.id 
                 WHERE u.id = ?",
                [$userId]
            );
            
            if ($user) {
                // تسجيل الدخول
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['name'] = $user['name'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['branch_id'] = $user['branch_id'] ?? null; // ✅ حفظ branch_id في الجلسة
                
                error_log("WebAuthn Login API - Session created for user: " . $user['id'] . " - branch_id: " . ($user['branch_id'] ?? 'null'));
                
                // ✅ CRITICAL: إغلاق الجلسة قبل إرسال الاستجابة لتجنب مشاكل headers
                // وضمان حفظ الجلسة بشكل صحيح
                if (session_status() === PHP_SESSION_ACTIVE) {
                    session_write_close();
                    error_log("WebAuthn Login API - Session written to cookies successfully");
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'تم تسجيل الدخول بنجاح',
                    'data' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'name' => $user['name'],
                        'role' => $user['role'],
                        'branch_id' => $user['branch_id'] ?? null,
                        'branch_name' => $user['branch_name'] ?? null
                    ]
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'المستخدم غير موجود'], JSON_UNESCAPED_UNICODE);
            }
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'فشل التحقق من البصمة'], JSON_UNESCAPED_UNICODE);
        }
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'إجراء غير صحيح'], JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    $errorDetails = [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ];
    error_log("WebAuthn Login API Error: " . json_encode($errorDetails, JSON_UNESCAPED_UNICODE));
    http_response_code(500);
    
    $userMessage = $e->getMessage();
    if (strpos($e->getMessage(), 'Direct access not allowed') !== false) {
        $userMessage = 'خطأ في تحميل نظام WebAuthn. تحقق من إعدادات الخادم.';
    }
    
    echo json_encode([
        'success' => false, 
        'error' => $userMessage,
        'message' => $userMessage,
        'debug' => (defined('DEBUG_MODE') && DEBUG_MODE) ? $errorDetails : null
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    $errorDetails = [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ];
    error_log("WebAuthn Login API Fatal Error: " . json_encode($errorDetails, JSON_UNESCAPED_UNICODE));
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'حدث خطأ قاتل في النظام',
        'message' => 'حدث خطأ قاتل: ' . $e->getMessage(),
        'debug' => (defined('DEBUG_MODE') && DEBUG_MODE) ? $errorDetails : null
    ], JSON_UNESCAPED_UNICODE);
}
?>

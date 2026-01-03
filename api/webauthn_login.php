<?php
/**
 * API تسجيل الدخول WebAuthn
 */

// منع أي output قبل headers
ob_start();

define('ACCESS_ALLOWED', true);

// ✅ CRITICAL: بدء الجلسة قبل تحميل أي ملفات (قبل config.php الذي يرسل headers)
// هذا يضمن أننا نستطيع حفظ الجلسة قبل إرسال أي headers
if (session_status() === PHP_SESSION_NONE) {
    // استخدام session handler مخصص من config.php
    // لكن أولاً نحتاج إلى تحميل config.php بدون إرسال headers
    // لذلك سنبدأ الجلسة يدوياً أولاً
    @session_start();
    error_log("WebAuthn Login API - Session started before loading config.php. Session ID: " . session_id());
}

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/../webauthn/webauthn.php';
    
    // ✅ CRITICAL: بعد تحميل config.php، التأكد من أن الجلسة نشطة
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
        error_log("WebAuthn Login API - Session restarted after loading config.php. Session ID: " . session_id());
    }
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'خطأ في تحميل النظام: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// تنظيف output buffer
ob_end_clean();

// ✅ CRITICAL: لا نرسل headers هنا - سنرسلها بعد حفظ الجلسة
// header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
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
        // ✅ إرسال CORS headers قبل أي شيء (لا نحتاج إلى حفظ جلسة هنا)
        if (!headers_sent()) {
            sendCORSHeaders();
            header('Content-Type: application/json; charset=utf-8');
        }
        
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
        // ⚠️ لا نرسل headers هنا - سنرسلها بعد حفظ الجلسة في حالة النجاح
        // فقط في حالة الأخطاء نرسل headers
        
        $response = $input['response'] ?? $_POST['response'] ?? '';
        
        if (empty($response)) {
            if (!headers_sent()) {
                sendCORSHeaders();
                header('Content-Type: application/json; charset=utf-8');
            }
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'الاستجابة مطلوبة'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        // تحويل JSON string إلى array إذا لزم الأمر
        if (is_string($response)) {
            $response = json_decode($response, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                if (!headers_sent()) {
                    sendCORSHeaders();
                    header('Content-Type: application/json; charset=utf-8');
                }
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'استجابة غير صحيحة: ' . json_last_error_msg()], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        
        // إذا كان response هو array بالفعل، استخدمه مباشرة
        if (!is_array($response)) {
            if (!headers_sent()) {
                sendCORSHeaders();
                header('Content-Type: application/json; charset=utf-8');
            }
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
                // ✅ CRITICAL: التأكد من أن الجلسة نشطة قبل حفظ البيانات
                if (session_status() === PHP_SESSION_NONE) {
                    error_log("WebAuthn Login API - WARNING: Session not started, starting now...");
                    session_start();
                }
                
                // ✅ تسجيل حالة الجلسة قبل حفظ البيانات
                error_log("WebAuthn Login API - Session ID before setting user data: " . session_id());
                error_log("WebAuthn Login API - Session status before setting user data: " . session_status());
                error_log("WebAuthn Login API - Session data before setting user data: " . json_encode($_SESSION));
                
                // ✅ CRITICAL: حفظ بيانات المستخدم في الجلسة فوراً
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['name'] = $user['name'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['branch_id'] = $user['branch_id'] ?? null; // ✅ حفظ branch_id في الجلسة
                
                // ✅ CRITICAL: حفظ الجلسة فوراً بعد تعيين البيانات وقبل أي شيء آخر
                // هذا مهم جداً لأن config.php يرسل CORS headers عند التحميل
                // لذلك يجب حفظ الجلسة قبل استدعاء response() أو أي دالة أخرى ترسل headers
                if (session_status() === PHP_SESSION_ACTIVE) {
                    // ✅ التحقق من أن headers لم يتم إرسالها بعد
                    if (!headers_sent($file, $line)) {
                        // ✅ حفظ الجلسة قبل إرسال أي headers
                        // هذا سيستدعي CookieSessionHandler::write() الذي سيحفظ البيانات في cookies
                        session_commit();
                        error_log("WebAuthn Login API - ✅ Session committed successfully before sending response");
                        error_log("WebAuthn Login API - Session ID after commit: " . session_id());
                    } else {
                        // ⚠️ Headers تم إرسالها بالفعل - لا يمكن حفظ الجلسة في cookies
                        error_log("WebAuthn Login API - ⚠️ WARNING: Headers already sent at $file:$line - Cannot save session to cookies!");
                        error_log("WebAuthn Login API - Attempting to commit session anyway (may not work)...");
                        // محاولة حفظ الجلسة على أي حال (قد لا تعمل)
                        @session_commit();
                    }
                } else {
                    error_log("WebAuthn Login API - ❌ ERROR: Session is not active! Status: " . session_status());
                    // محاولة إعادة بدء الجلسة وحفظ البيانات
                    if (session_status() === PHP_SESSION_NONE) {
                        @session_start();
                        $_SESSION['user_id'] = $user['id'];
                        $_SESSION['username'] = $user['username'];
                        $_SESSION['name'] = $user['name'];
                        $_SESSION['role'] = $user['role'];
                        $_SESSION['branch_id'] = $user['branch_id'] ?? null;
                        if (!headers_sent()) {
                            @session_commit();
                            error_log("WebAuthn Login API - Session restarted and data saved");
                        } else {
                            error_log("WebAuthn Login API - ⚠️ Cannot commit restarted session - headers already sent");
                        }
                    }
                }
                
                // ✅ تسجيل حالة الجلسة بعد الحفظ
                error_log("WebAuthn Login API - Session data after commit: " . json_encode($_SESSION));
                error_log("WebAuthn Login API - Headers sent after session_commit: " . (headers_sent() ? 'YES' : 'NO'));
                error_log("WebAuthn Login API - Cookies after session_commit: " . json_encode($_COOKIE));
                
                // ✅ CRITICAL: إرسال CORS headers بعد حفظ الجلسة مباشرة
                // هذا يضمن أن الجلسة تم حفظها في cookies قبل إرسال أي headers أخرى
                if (!headers_sent()) {
                    sendCORSHeaders();
                    error_log("WebAuthn Login API - ✅ CORS headers sent after session commit");
                } else {
                    error_log("WebAuthn Login API - ⚠️ Cannot send CORS headers - headers already sent");
                }
                
                // ✅ CRITICAL: التحقق من أن البيانات محفوظة في $_SESSION قبل response()
                error_log("WebAuthn Login API - Final session data before response(): " . json_encode($_SESSION));
                if (isset($_SESSION['user_id'])) {
                    error_log("WebAuthn Login API - ✅ User data confirmed in session: user_id=" . $_SESSION['user_id']);
                } else {
                    error_log("WebAuthn Login API - ❌ ERROR: User data NOT found in session before response()!");
                }
                
                // ✅ CRITICAL: استخدام response() من config.php بدلاً من echo مباشرة
                // response() سيتعامل مع headers بشكل صحيح
                // CORS headers تم إرسالها بالفعل بعد حفظ الجلسة
                response(true, 'تم تسجيل الدخول بنجاح', [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'branch_id' => $user['branch_id'] ?? null,
                    'branch_name' => $user['branch_name'] ?? null
                ]);
            } else {
                if (!headers_sent()) {
                    sendCORSHeaders();
                    header('Content-Type: application/json; charset=utf-8');
                }
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'المستخدم غير موجود'], JSON_UNESCAPED_UNICODE);
            }
        } else {
            if (!headers_sent()) {
                sendCORSHeaders();
                header('Content-Type: application/json; charset=utf-8');
            }
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'فشل التحقق من البصمة'], JSON_UNESCAPED_UNICODE);
        }
        
    } else {
        if (!headers_sent()) {
            sendCORSHeaders();
            header('Content-Type: application/json; charset=utf-8');
        }
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
    
    if (!headers_sent()) {
        sendCORSHeaders();
        header('Content-Type: application/json; charset=utf-8');
    }
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
    
    if (!headers_sent()) {
        sendCORSHeaders();
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'حدث خطأ قاتل في النظام',
        'message' => 'حدث خطأ قاتل: ' . $e->getMessage(),
        'debug' => (defined('DEBUG_MODE') && DEBUG_MODE) ? $errorDetails : null
    ], JSON_UNESCAPED_UNICODE);
}
?>

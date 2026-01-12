<?php
// ✅ CRITICAL: تنظيف output buffer قبل أي شيء تماماً
while (ob_get_level() > 0) {
    @ob_end_clean();
}
@ob_end_flush();
@ob_end_clean();


// ✅ CRITICAL: معالجة الأخطاء القاتلة
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // تنظيف أي output
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'خطأ  في PHP: ' . $error['message'],
            'error' => $error['message'],
            'file' => $error['file'],
            'line' => $error['line'],
            'type' => 'Fatal Error'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

// ✅ CRITICAL: معالجة الاستثناءات غير المعالجة
set_exception_handler(function($exception) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'خطأ استثناء غير معالج: ' . $exception->getMessage(),
        'error' => $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
        'type' => 'Uncaught Exception'
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

try {
    require_once 'config.php';
} catch (Exception $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'خطأ في تحميل ملف الإعدادات: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'type' => 'Config Exception'
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Error $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'خطأ  في تحميل ملف الإعدادات: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'type' => 'Config Fatal Error'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ✅ التحقق من أن الدوال المطلوبة موجودة
if (!function_exists('getRequestMethod')) {
    response(false, 'دالة getRequestMethod غير موجودة', null, 500);
}
if (!function_exists('getRequestData')) {
    response(false, 'دالة getRequestData غير موجودة', null, 500);
}
if (!function_exists('response')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'دالة response غير موجودة',
        'error' => 'Function response() not found'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
if (!function_exists('getDBConnection')) {
    response(false, 'دالة getDBConnection غير موجودة', null, 500);
}
if (!function_exists('dbSelectOne')) {
    response(false, 'دالة dbSelectOne غير موجودة', null, 500);
}

$method = getRequestMethod();

/**
 * ✅ SECURITY: Rate Limiting - التحقق من عدد محاولات تسجيل الدخول
 * @param string $identifier - المعرف (IP Address أو Username)
 * @param int $maxAttempts - الحد الأقصى للمحاولات (افتراضي: 5)
 * @param int $timeWindow - نافذة الوقت بالثواني (افتراضي: 300 = 5 دقائق)
 * @return array - ['allowed' => bool, 'remaining' => int, 'reset_time' => int]
 */
function checkRateLimit($identifier, $maxAttempts = 5, $timeWindow = 300) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $key = 'login_attempts_' . md5($identifier);
    $currentTime = time();
    
    // الحصول على محاولات الدخول السابقة
    $attempts = $_SESSION[$key] ?? ['count' => 0, 'first_attempt' => $currentTime, 'last_attempt' => 0];
    
    // إعادة تعيين العداد إذا انتهت نافذة الوقت
    if ($currentTime - $attempts['first_attempt'] > $timeWindow) {
        $attempts = ['count' => 0, 'first_attempt' => $currentTime, 'last_attempt' => $currentTime];
    }
    
    // التحقق من عدد المحاولات
    if ($attempts['count'] >= $maxAttempts) {
        $resetTime = $attempts['first_attempt'] + $timeWindow;
        $remainingTime = max(0, $resetTime - $currentTime);
        
        return [
            'allowed' => false,
            'remaining' => 0,
            'reset_time' => $resetTime,
            'remaining_time' => $remainingTime
        ];
    }
    
    // زيادة عدد المحاولات
    $attempts['count']++;
    $attempts['last_attempt'] = $currentTime;
    $_SESSION[$key] = $attempts;
    
    $remaining = max(0, $maxAttempts - $attempts['count']);
    
    return [
        'allowed' => true,
        'remaining' => $remaining,
        'reset_time' => $attempts['first_attempt'] + $timeWindow
    ];
}

/**
 * ✅ SECURITY: إعادة تعيين Rate Limiting بعد تسجيل الدخول الناجح
 * @param string $identifier - المعرف (IP Address أو Username)
 */
function resetRateLimit($identifier) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $key = 'login_attempts_' . md5($identifier);
    unset($_SESSION[$key]);
}

// تسجيل الدخول
if ($method === 'POST') {
    try {
        $data = getRequestData();
    } catch (Exception $e) {
        error_log('خطأ في getRequestData: ' . $e->getMessage());
        response(false, 'خطأ في قراءة بيانات الطلب: ' . $e->getMessage(), [
            'error_type' => 'Request Data Exception',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ], 500);
    } catch (Error $e) {
        error_log('خطأ قاتل في getRequestData: ' . $e->getMessage());
        response(false, 'خطأ قاتل في قراءة بيانات الطلب: ' . $e->getMessage(), [
            'error_type' => 'Request Data Fatal Error',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ], 500);
    }
    
    // التحقق من طلب تسجيل الخروج
    if (isset($data['action']) && $data['action'] === 'logout') {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // مسح جميع بيانات الجلسة
        $_SESSION = array();
        
        // حذف session cookie من المتصفح
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
        
        // تدمير الجلسة
        session_destroy();
        
        response(true, 'تم تسجيل الخروج بنجاح');
    }
    
    // تسجيل الدخول العادي
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    // تفعيل عرض الأخطاء للتصحيح
    error_log("تسجيل الدخول - اسم المستخدم: " . $username);
    
    if (empty($username) || empty($password)) {
        error_log("خطأ: اسم المستخدم أو كلمة المرور فارغة");
        response(false, 'اسم المستخدم وكلمة المرور مطلوبة', null, 400);
    }
    
    // ✅ SECURITY: Rate Limiting - التحقق من عدد محاولات تسجيل الدخول
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateLimitIdentifier = $clientIP . '_' . strtolower($username); // استخدام IP + Username
    $rateLimit = checkRateLimit($rateLimitIdentifier, 5, 300); // 5 محاولات كل 5 دقائق
    
    if (!$rateLimit['allowed']) {
        $remainingMinutes = ceil($rateLimit['remaining_time'] / 60);
        error_log("❌ Rate Limit: تم تجاوز عدد محاولات تسجيل الدخول - IP: $clientIP, Username: $username");
        response(false, "تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة مرة أخرى بعد $remainingMinutes دقيقة", [
            'rate_limit' => true,
            'remaining_time' => $rateLimit['remaining_time'],
            'reset_time' => $rateLimit['reset_time']
        ], 429); // 429 Too Many Requests
    }
    
    // التحقق من الاتصال بقاعدة البيانات
    try {
        $conn = getDBConnection();
        if (!$conn) {
            // ✅ SECURITY: إرسال رسالة عامة فقط بدون معلومات حساسة
            response(false, "فشل الاتصال بقاعدة البيانات. يرجى الاتصال بالدعم الفني.", null, 500);
        }
        
        error_log("✅ تم الاتصال بقاعدة البيانات بنجاح");
        
        // البحث عن المستخدم في قاعدة البيانات مع اسم الفرع ورمز الفرع
        $user = dbSelectOne(
            "SELECT u.id, u.username, u.password, u.name, u.role, u.branch_id, b.name as branch_name, b.code as branch_code 
             FROM users u 
             LEFT JOIN branches b ON u.branch_id = b.id 
             WHERE u.username = ?",
            [$username]
        );
        
        error_log("نتيجة البحث عن المستخدم: " . ($user ? "موجود" : "غير موجود"));
        
        if ($user === false) {
            error_log("خطأ في تنفيذ استعلام البحث عن المستخدم");
            response(false, 'خطأ في قاعدة البيانات. تحقق من سجلات الأخطاء.', null, 500);
        }
        
        if ($user) {
            error_log("المستخدم موجود - التحقق من كلمة المرور...");
            
            if (empty($user['password'])) {
                error_log("تحذير: كلمة المرور فارغة في قاعدة البيانات للمستخدم: " . $username);
                response(false, 'خطأ في بيانات المستخدم. يرجى الاتصال بالدعم الفني.', null, 500);
            }
            
            $passwordMatch = password_verify($password, $user['password']);
            error_log("نتيجة التحقق من كلمة المرور: " . ($passwordMatch ? "صحيحة" : "غير صحيحة"));
            
            if ($passwordMatch) {
                // ✅ SECURITY: إعادة تعيين Rate Limiting بعد تسجيل الدخول الناجح
                resetRateLimit($rateLimitIdentifier);
                
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                
                // ✅ SECURITY: إعادة توليد معرف الجلسة بعد تسجيل الدخول الناجح (حماية من Session Fixation)
                session_regenerate_id(true); // true = حذف الجلسة القديمة
                
                // حفظ بيانات الجلسة
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['name'] = $user['name'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['branch_id'] = $user['branch_id'] ?? null; // ✅ حفظ branch_id في الجلسة
                
                // ✅ SECURITY: حفظ IP Address للتحقق لاحقاً
                $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'] ?? '';
                $_SESSION['last_regeneration'] = time(); // ✅ SECURITY: حفظ وقت آخر إعادة توليد
                
                error_log("✅ تم تسجيل الدخول بنجاح للمستخدم: " . $username . " - branch_id: " . ($user['branch_id'] ?? 'null'));
                
                // ✅ توليد Tokens قبل إغلاق الجلسة
                $csrfToken = generateCSRFToken();
                $apiToken = generateAPIRequestToken();
                
                // ✅ CRITICAL: إغلاق الجلسة قبل إرسال الاستجابة لتجنب مشاكل headers
                session_write_close();
                
                // إرجاع الاستجابة مباشرة - response() ستقوم بـ exit تلقائياً
                response(true, 'تم تسجيل الدخول بنجاح', [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'branch_id' => $user['branch_id'] ?? null,
                    'branch_name' => $user['branch_name'] ?? null,
                    'branch_code' => $user['branch_code'] ?? null,
                    'csrf_token' => $csrfToken,
                    'api_token' => $apiToken
                ]);
            } else {
                error_log("❌ كلمة المرور غير صحيحة للمستخدم: " . $username);
            }
        } else {
            error_log("❌ المستخدم غير موجود: " . $username);
        }
    } catch (Exception $e) {
        $errorMsg = "خطأ في استعلام قاعدة البيانات: " . $e->getMessage();
        error_log($errorMsg);
        error_log("Stack trace: " . $e->getTraceAsString());
        
        // ✅ إرجاع معلومات أكثر تفصيلاً للتصحيح
        response(false, 'خطأ في قاعدة البيانات: ' . $e->getMessage(), [
            'error_type' => 'Exception',
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => explode("\n", $e->getTraceAsString())
        ], 500);
    } catch (Error $e) {
        $errorMsg = "خطأ  في قاعدة البيانات: " . $e->getMessage();
        error_log($errorMsg);
        error_log("Stack trace: " . $e->getTraceAsString());
        
        // ✅ إرجاع معلومات أكثر تفصيلاً للتصحيح
        response(false, 'خطأ  في قاعدة البيانات: ' . $e->getMessage(), [
            'error_type' => 'Fatal Error',
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => explode("\n", $e->getTraceAsString())
        ], 500);
    } catch (Throwable $e) {
        // ✅ معالجة أي نوع آخر من الأخطاء (PHP 7+)
        $errorMsg = "خطأ غير متوقع: " . $e->getMessage();
        error_log($errorMsg);
        error_log("Stack trace: " . $e->getTraceAsString());
        
        response(false, 'خطأ غير متوقع: ' . $e->getMessage(), [
            'error_type' => 'Throwable',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ], 500);
    }
    
    response(false, 'اسم المستخدم أو كلمة المرور غير صحيحة', null, 401);
}

// التحقق من الجلسة
if ($method === 'GET') {
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    } else {
    }
    
    error_log("Auth API - Session data: " . json_encode($_SESSION));
    
    if (isset($_SESSION['user_id'])) {
        
        // جلب اسم الفرع ورمز الفرع إذا كان branch_id موجوداً
        $branchName = null;
        $branchCode = null;
        if (isset($_SESSION['branch_id']) && $_SESSION['branch_id']) {
            $branch = dbSelectOne("SELECT name, code FROM branches WHERE id = ?", [$_SESSION['branch_id']]);
            if ($branch) {
                if (isset($branch['name'])) {
                    $branchName = $branch['name'];
                }
                if (isset($branch['code'])) {
                    $branchCode = $branch['code'];
                }
            }
        }
        
        error_log("Auth API - Returning user data: id=" . $_SESSION['user_id'] . ", username=" . ($_SESSION['username'] ?? 'null') . ", role=" . ($_SESSION['role'] ?? 'null'));
        
        // ✅ توليد Tokens للجلسة النشطة
        $csrfToken = generateCSRFToken();
        $apiToken = generateAPIRequestToken();
        
        response(true, 'الجلسة نشطة', [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'] ?? '',
            'name' => $_SESSION['name'] ?? '',
            'role' => $_SESSION['role'] ?? 'employee',
            'branch_id' => $_SESSION['branch_id'] ?? null,
            'branch_name' => $branchName,
            'branch_code' => $branchCode,
            'csrf_token' => $csrfToken,
            'api_token' => $apiToken
        ]);
    } else {
        error_log("Auth API - No user_id in session. Session keys: " . implode(', ', array_keys($_SESSION)));
        error_log("Auth API - Full session data: " . json_encode($_SESSION));
        response(false, 'لا توجد جلسة نشطة', null, 401);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>



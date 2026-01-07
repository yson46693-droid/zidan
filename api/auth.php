<?php
// ✅ CRITICAL: تنظيف output buffer قبل أي شيء تماماً
while (ob_get_level() > 0) {
    @ob_end_clean();
}
@ob_end_flush();
@ob_end_clean();

// ✅ CRITICAL: بدء معالجة الأخطاء قبل أي شيء
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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
            'message' => 'خطأ قاتل في PHP: ' . $error['message'],
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
        'message' => 'خطأ قاتل في تحميل ملف الإعدادات: ' . $e->getMessage(),
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
    
    // التحقق من الاتصال بقاعدة البيانات
    try {
        $conn = getDBConnection();
        if (!$conn) {
            $errorMsg = "فشل الاتصال بقاعدة البيانات. تحقق من إعدادات قاعدة البيانات في api/database.php";
            // ✅ SECURITY: تسجيل معلومات قاعدة البيانات في error_log فقط (وليس في الاستجابة)
            error_log("خطأ: " . $errorMsg . " | Host: " . (defined('DB_HOST') ? DB_HOST : 'غير معرّف') . 
                     " | User: " . (defined('DB_USER') ? DB_USER : 'غير معرّف') . 
                     " | Database: " . (defined('DB_NAME') ? DB_NAME : 'غير معرّف'));
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
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                
                // حفظ بيانات الجلسة
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['name'] = $user['name'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['branch_id'] = $user['branch_id'] ?? null; // ✅ حفظ branch_id في الجلسة
                
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
        $errorMsg = "خطأ قاتل في قاعدة البيانات: " . $e->getMessage();
        error_log($errorMsg);
        error_log("Stack trace: " . $e->getTraceAsString());
        
        // ✅ إرجاع معلومات أكثر تفصيلاً للتصحيح
        response(false, 'خطأ قاتل في قاعدة البيانات: ' . $e->getMessage(), [
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
    // ✅ تسجيلات مفصلة لحالة الجلسة عند التحقق
    error_log("Auth API - checkAuth called");
    error_log("Auth API - Session status before start: " . session_status());
    error_log("Auth API - Cookies received: " . json_encode($_COOKIE));
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
        error_log("Auth API - Session started. Session ID: " . session_id());
    } else {
        error_log("Auth API - Session already active. Session ID: " . session_id());
    }
    
    error_log("Auth API - Session status after start: " . session_status());
    error_log("Auth API - Session data: " . json_encode($_SESSION));
    
    if (isset($_SESSION['user_id'])) {
        error_log("Auth API - User ID found in session: " . $_SESSION['user_id']);
        
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



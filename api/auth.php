<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

// بدء معالجة الأخطاء قبل أي شيء
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once 'config.php';
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'خطأ في تحميل ملف الإعدادات: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Error $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'خطأ قاتل في تحميل ملف الإعدادات: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = getRequestMethod();

// تسجيل الدخول
if ($method === 'POST') {
    $data = getRequestData();
    
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
            error_log("خطأ: " . $errorMsg);
            response(false, $errorMsg, [
                'debug' => [
                    'host' => defined('DB_HOST') ? DB_HOST : 'غير معرّف',
                    'user' => defined('DB_USER') ? DB_USER : 'غير معرّف',
                    'database' => defined('DB_NAME') ? DB_NAME : 'غير معرّف'
                ]
            ], 500);
        }
        
        error_log("✅ تم الاتصال بقاعدة البيانات بنجاح");
        
        // البحث عن المستخدم في قاعدة البيانات
        $user = dbSelectOne(
            "SELECT id, username, password, name, role FROM users WHERE username = ?",
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
                
                error_log("✅ تم تسجيل الدخول بنجاح للمستخدم: " . $username);
                
                // إرجاع الاستجابة مباشرة - response() ستقوم بـ exit تلقائياً
                response(true, 'تم تسجيل الدخول بنجاح', [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role']
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
        response(false, 'خطأ في قاعدة البيانات: ' . $e->getMessage(), [
            'error_type' => 'Exception',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ], 500);
    } catch (Error $e) {
        $errorMsg = "خطأ قاتل في قاعدة البيانات: " . $e->getMessage();
        error_log($errorMsg);
        error_log("Stack trace: " . $e->getTraceAsString());
        response(false, 'خطأ قاتل في قاعدة البيانات: ' . $e->getMessage(), [
            'error_type' => 'Fatal Error',
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
    }
    
    if (isset($_SESSION['user_id'])) {
        response(true, 'الجلسة نشطة', [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'] ?? '',
            'name' => $_SESSION['name'] ?? '',
            'role' => $_SESSION['role'] ?? 'employee'
        ]);
    } else {
        response(false, 'لا توجد جلسة نشطة', null, 401);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>



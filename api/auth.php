<?php
// تنظيف output buffer قبل أي شيء
while (ob_get_level() > 0) {
    ob_end_clean();
}

// بدء معالجة الأخطاء قبل أي شيء
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

// إصلاح CORS احتياطي - للتأكد من عمل CORS حتى لو فشل config.php
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$currentHost = $_SERVER['HTTP_HOST'] ?? '';

if (!empty($requestOrigin)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Access-Control-Allow-Credentials: true');
} elseif (!empty($currentHost)) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $currentOrigin = $protocol . '://' . $currentHost;
    header('Access-Control-Allow-Origin: ' . $currentOrigin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: false');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override');

// معالجة طلبات OPTIONS (preflight) فوراً
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

// تسجيل معلومات الطلب للتشخيص
error_log("Auth Request - Method: " . $method . ", Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? 'none') . ", Host: " . ($_SERVER['HTTP_HOST'] ?? 'none') . ", IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

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
        try {
            // محاولة جلب البيانات مع branch_id و avatar
            $user = dbSelectOne(
                "SELECT id, username, password, name, role, branch_id, avatar FROM users WHERE username = ?",
                [$username]
            );
        } catch (Exception $e) {
            // إذا فشل بسبب عمود غير موجود، جلب البيانات بدونها
            error_log('محاولة جلب بيانات المستخدم: ' . $e->getMessage());
            try {
                $user = dbSelectOne(
                    "SELECT id, username, password, name, role, branch_id FROM users WHERE username = ?",
                    [$username]
                );
            } catch (Exception $e2) {
                $user = dbSelectOne(
                    "SELECT id, username, password, name, role FROM users WHERE username = ?",
                    [$username]
                );
            }
            if ($user) {
                if (!isset($user['avatar'])) $user['avatar'] = null;
                if (!isset($user['branch_id'])) $user['branch_id'] = null;
            }
        }
        
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
                $_SESSION['branch_id'] = $user['branch_id'] ?? null;
                
                error_log("✅ تم تسجيل الدخول بنجاح للمستخدم: " . $username);
                
                // إرجاع الاستجابة مباشرة - response() ستقوم بـ exit تلقائياً
                $userData = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'branch_id' => $user['branch_id'] ?? null,
                    'is_owner' => ($user['role'] === 'admin')
                ];
                
                // إضافة avatar إذا كان موجوداً
                if (isset($user['avatar'])) {
                    $userData['avatar'] = $user['avatar'];
                } else {
                    $userData['avatar'] = null;
                }
                
                // جلب معلومات الفرع إذا كان مرتبطاً بفرع
                if (!empty($user['branch_id'])) {
                    try {
                        $branch = dbSelectOne(
                            "SELECT id, name, code, has_pos FROM branches WHERE id = ?",
                            [$user['branch_id']]
                        );
                        if ($branch) {
                            $userData['branch_name'] = $branch['name'];
                            $userData['branch_code'] = $branch['code'];
                            $userData['has_pos'] = (bool)$branch['has_pos'];
                        }
                    } catch (Exception $e) {
                        error_log('خطأ في جلب معلومات الفرع: ' . $e->getMessage());
                    }
                } else {
                    $userData['branch_name'] = null;
                    $userData['branch_code'] = null;
                    $userData['has_pos'] = false;
                }
                
                response(true, 'تم تسجيل الدخول بنجاح', $userData);
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
        // جلب بيانات المستخدم من قاعدة البيانات (بما في ذلك avatar و branch_id)
        $userId = $_SESSION['user_id'];
        try {
            $user = dbSelectOne(
                "SELECT id, username, name, role, branch_id, avatar FROM users WHERE id = ?",
                [$userId]
            );
            
            if ($user) {
                $userData = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'branch_id' => $user['branch_id'] ?? null,
                    'is_owner' => ($user['role'] === 'admin'),
                    'avatar' => $user['avatar'] ?? null
                ];
                
                // جلب معلومات الفرع إذا كان مرتبطاً بفرع
                if (!empty($user['branch_id'])) {
                    try {
                        $branch = dbSelectOne(
                            "SELECT id, name, code, has_pos FROM branches WHERE id = ?",
                            [$user['branch_id']]
                        );
                        if ($branch) {
                            $userData['branch_name'] = $branch['name'];
                            $userData['branch_code'] = $branch['code'];
                            $userData['has_pos'] = (bool)$branch['has_pos'];
                        }
                    } catch (Exception $e) {
                        error_log('خطأ في جلب معلومات الفرع: ' . $e->getMessage());
                    }
                } else {
                    $userData['branch_name'] = null;
                    $userData['branch_code'] = null;
                    $userData['has_pos'] = false;
                }
                
                response(true, 'الجلسة نشطة', $userData);
            } else {
                // إذا لم يتم العثور على المستخدم في قاعدة البيانات، استخدام بيانات الجلسة
                $userData = [
                    'id' => $_SESSION['user_id'],
                    'username' => $_SESSION['username'] ?? '',
                    'name' => $_SESSION['name'] ?? '',
                    'role' => $_SESSION['role'] ?? 'employee',
                    'branch_id' => $_SESSION['branch_id'] ?? null,
                    'is_owner' => ($_SESSION['role'] ?? 'employee') === 'admin',
                    'avatar' => null
                ];
                response(true, 'الجلسة نشطة', $userData);
            }
        } catch (Exception $e) {
            error_log('خطأ في جلب بيانات المستخدم: ' . $e->getMessage());
            // في حالة الخطأ، استخدام بيانات الجلسة
            $userData = [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'] ?? '',
                'name' => $_SESSION['name'] ?? '',
                'role' => $_SESSION['role'] ?? 'employee',
                'branch_id' => $_SESSION['branch_id'] ?? null,
                'is_owner' => ($_SESSION['role'] ?? 'employee') === 'admin',
                'avatar' => null
            ];
            response(true, 'الجلسة نشطة', $userData);
        }
    } else {
        response(false, 'لا توجد جلسة نشطة', null, 401);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>



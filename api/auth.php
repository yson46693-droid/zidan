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

// ✅ تحسين اكتشاف HTTPS
$isHttps = false;
if (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) {
    $isHttps = true;
} elseif (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) {
    $isHttps = true;
} elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $isHttps = true;
} elseif (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
    $isHttps = true;
}

if (!empty($requestOrigin)) {
    // ✅ السماح بالدومينات الفرعية تلقائياً (مثل zidan.egsystem.top)
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Access-Control-Allow-Credentials: true');
} elseif (!empty($currentHost)) {
    $protocol = $isHttps ? 'https' : 'http';
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

// تسجيل معلومات الطلب للتشخيص (مفصل)
$logInfo = [
    'method' => $method,
    'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'none',
    'host' => $_SERVER['HTTP_HOST'] ?? 'none',
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'https' => isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'not_set',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'not_set'
];
error_log("🔐 Auth Request: " . json_encode($logInfo, JSON_UNESCAPED_UNICODE));

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
    
    // التحقق من الاتصال بقاعدة البيانات وإصلاحها إذا لزم الأمر
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
        
        // ✅ التأكد من أن قاعدة البيانات محدثة (إضافة الأعمدة الناقصة)
        try {
            if (file_exists(__DIR__ . '/setup.php')) {
                require_once __DIR__ . '/setup.php';
                // تطبيق التحديثات فقط (بدون إنشاء جداول جديدة)
                $migrationsApplied = applyDatabaseMigrations($conn);
                if (!empty($migrationsApplied)) {
                    error_log("✅ تم تطبيق تحديثات قاعدة البيانات: " . implode(', ', $migrationsApplied));
                }
            }
        } catch (Exception $e) {
            error_log("⚠️ تحذير: فشل التحقق من تحديثات قاعدة البيانات: " . $e->getMessage());
            // لا نوقف العملية، فقط نسجل التحذير
        } catch (Error $e) {
            error_log("⚠️ تحذير: خطأ قاتل في التحقق من تحديثات قاعدة البيانات: " . $e->getMessage());
            // لا نوقف العملية، فقط نسجل التحذير
        }
        
        // البحث عن المستخدم في قاعدة البيانات
        // محاولة جلب البيانات مع جميع الأعمدة المتاحة (بدون specialization لأنه قد لا يكون موجوداً)
        $user = dbSelectOne(
            "SELECT id, username, password, name, role, branch_id, avatar FROM users WHERE username = ?",
            [$username]
        );
        
        // إذا فشل مرة أخرى، محاولة بدون avatar
        if ($user === false) {
            error_log('⚠️ فشل جلب بيانات المستخدم مع avatar، محاولة بدونها');
            $user = dbSelectOne(
                "SELECT id, username, password, name, role, branch_id FROM users WHERE username = ?",
                [$username]
            );
        }
        
        // إذا فشل مرة أخرى، محاولة بدون branch_id
        if ($user === false) {
            error_log('⚠️ فشل جلب بيانات المستخدم مع branch_id، محاولة بدونها');
            $user = dbSelectOne(
                "SELECT id, username, password, name, role FROM users WHERE username = ?",
                [$username]
            );
        }
        
        // التأكد من أن البيانات تم جلبها بنجاح
        if ($user === false || $user === null) {
            error_log('❌ فشل جلب بيانات المستخدم بالكامل');
            $user = null;
        } else {
            // التأكد من وجود جميع الحقول (تعيين null للأعمدة غير الموجودة)
            if (!isset($user['avatar'])) $user['avatar'] = null;
            if (!isset($user['branch_id'])) $user['branch_id'] = null;
            if (!isset($user['specialization'])) $user['specialization'] = null;
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
                
                // ✅ التحقق من role وبيانات المستخدم قبل إرجاع الاستجابة
                $errorReason = null;
                
                // التحقق من وجود role
                if (empty($userData['role'])) {
                    $errorReason = 'فشل في تحديد دور المستخدم: role فارغ';
                    error_log('❌ ' . $errorReason . ' - User ID: ' . $userData['id']);
                } 
                // التحقق من صحة role
                elseif (!in_array($userData['role'], ['admin', 'manager', 'employee'])) {
                    $errorReason = 'دور المستخدم غير صحيح: ' . $userData['role'];
                    error_log('❌ ' . $errorReason . ' - User ID: ' . $userData['id']);
                }
                // التحقق من وجود بيانات أساسية
                elseif (empty($userData['id']) || empty($userData['username']) || empty($userData['name'])) {
                    $errorReason = 'بيانات المستخدم غير مكتملة: id=' . ($userData['id'] ?? 'null') . ', username=' . ($userData['username'] ?? 'null') . ', name=' . ($userData['name'] ?? 'null');
                    error_log('❌ ' . $errorReason);
                }
                
                // إذا كان هناك خطأ، عمل logout وإرجاع الخطأ
                if ($errorReason !== null) {
                    // مسح الجلسة
                    $_SESSION = array();
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
                    session_destroy();
                    
                    error_log('❌ تم تسجيل الخروج تلقائياً بسبب: ' . $errorReason);
                    response(false, $errorReason, [
                        'error_type' => 'user_data_validation_failed',
                        'reason' => $errorReason,
                        'user_id' => $userData['id'] ?? null
                    ], 500);
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
        
        // محاولة جلب البيانات مع جميع الأعمدة المتاحة (بدون specialization لأنه قد لا يكون موجوداً)
        $user = dbSelectOne(
            "SELECT id, username, name, role, branch_id, avatar FROM users WHERE id = ?",
            [$userId]
        );
        
        // إذا فشل مرة أخرى، محاولة بدون avatar
        if ($user === false) {
            error_log('⚠️ فشل جلب البيانات مع avatar، محاولة بدونها');
            $user = dbSelectOne(
                "SELECT id, username, name, role, branch_id FROM users WHERE id = ?",
                [$userId]
            );
        }
        
        // إذا فشل مرة أخرى، محاولة بدون branch_id
        if ($user === false) {
            error_log('⚠️ فشل جلب البيانات مع branch_id، محاولة بدونها');
            $user = dbSelectOne(
                "SELECT id, username, name, role FROM users WHERE id = ?",
                [$userId]
            );
        }
        
        // التأكد من أن البيانات تم جلبها بنجاح
        if ($user === false || $user === null) {
            error_log('❌ فشل جلب بيانات المستخدم بالكامل');
            $user = null;
        } else {
            // التأكد من وجود جميع الحقول (تعيين null للأعمدة غير الموجودة)
            if (!isset($user['avatar'])) $user['avatar'] = null;
            if (!isset($user['branch_id'])) $user['branch_id'] = null;
            if (!isset($user['specialization'])) $user['specialization'] = null;
        }
        
        try {
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
                
                // ✅ التحقق من role وبيانات المستخدم
                $errorReason = null;
                
                // التحقق من وجود role
                if (empty($userData['role'])) {
                    $errorReason = 'فشل في تحديد دور المستخدم: role فارغ';
                    error_log('❌ ' . $errorReason . ' - User ID: ' . $userData['id']);
                } 
                // التحقق من صحة role
                elseif (!in_array($userData['role'], ['admin', 'manager', 'employee'])) {
                    $errorReason = 'دور المستخدم غير صحيح: ' . $userData['role'];
                    error_log('❌ ' . $errorReason . ' - User ID: ' . $userData['id']);
                }
                // التحقق من وجود بيانات أساسية
                elseif (empty($userData['id']) || empty($userData['username']) || empty($userData['name'])) {
                    $errorReason = 'بيانات المستخدم غير مكتملة: id=' . ($userData['id'] ?? 'null') . ', username=' . ($userData['username'] ?? 'null') . ', name=' . ($userData['name'] ?? 'null');
                    error_log('❌ ' . $errorReason);
                }
                
                // إذا كان هناك خطأ، عمل logout وإرجاع الخطأ
                if ($errorReason !== null) {
                    // مسح الجلسة
                    $_SESSION = array();
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
                    session_destroy();
                    
                    error_log('❌ تم تسجيل الخروج تلقائياً بسبب: ' . $errorReason);
                    response(false, $errorReason, [
                        'error_type' => 'user_data_validation_failed',
                        'reason' => $errorReason,
                        'user_id' => $userData['id'] ?? null
                    ], 500);
                }
                
                response(true, 'الجلسة نشطة', $userData);
            } else {
                // إذا لم يتم العثور على المستخدم في قاعدة البيانات، التحقق من بيانات الجلسة
                $sessionRole = $_SESSION['role'] ?? 'employee';
                $sessionUserId = $_SESSION['user_id'] ?? null;
                
                // ✅ التحقق من role في الجلسة
                $errorReason = null;
                
                if (empty($sessionRole) || !in_array($sessionRole, ['admin', 'manager', 'employee'])) {
                    $errorReason = 'دور المستخدم في الجلسة غير صحيح أو فارغ: ' . ($sessionRole ?? 'null');
                    error_log('❌ ' . $errorReason . ' - Session User ID: ' . $sessionUserId);
                } elseif (empty($sessionUserId) || empty($_SESSION['username'] ?? '') || empty($_SESSION['name'] ?? '')) {
                    $errorReason = 'بيانات الجلسة غير مكتملة: id=' . ($sessionUserId ?? 'null') . ', username=' . ($_SESSION['username'] ?? 'null') . ', name=' . ($_SESSION['name'] ?? 'null');
                    error_log('❌ ' . $errorReason);
                }
                
                // إذا كان هناك خطأ، عمل logout
                if ($errorReason !== null) {
                    $_SESSION = array();
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
                    session_destroy();
                    
                    error_log('❌ تم تسجيل الخروج تلقائياً بسبب: ' . $errorReason);
                    response(false, $errorReason, [
                        'error_type' => 'session_data_validation_failed',
                        'reason' => $errorReason,
                        'user_id' => $sessionUserId
                    ], 500);
                }
                
                // استخدام بيانات الجلسة إذا كانت صحيحة
                $userData = [
                    'id' => $_SESSION['user_id'],
                    'username' => $_SESSION['username'] ?? '',
                    'name' => $_SESSION['name'] ?? '',
                    'role' => $sessionRole,
                    'branch_id' => $_SESSION['branch_id'] ?? null,
                    'is_owner' => ($sessionRole === 'admin'),
                    'avatar' => null
                ];
                response(true, 'الجلسة نشطة', $userData);
            }
        } catch (Exception $e) {
            error_log('خطأ في جلب بيانات المستخدم: ' . $e->getMessage());
            
            // ✅ التحقق من بيانات الجلسة في حالة الخطأ
            $sessionRole = $_SESSION['role'] ?? 'employee';
            $sessionUserId = $_SESSION['user_id'] ?? null;
            
            $errorReason = null;
            if (empty($sessionRole) || !in_array($sessionRole, ['admin', 'manager', 'employee'])) {
                $errorReason = 'دور المستخدم في الجلسة غير صحيح أو فارغ: ' . ($sessionRole ?? 'null');
            } elseif (empty($sessionUserId) || empty($_SESSION['username'] ?? '') || empty($_SESSION['name'] ?? '')) {
                $errorReason = 'بيانات الجلسة غير مكتملة: id=' . ($sessionUserId ?? 'null') . ', username=' . ($_SESSION['username'] ?? 'null') . ', name=' . ($_SESSION['name'] ?? 'null');
            }
            
            // إذا كان هناك خطأ في بيانات الجلسة، عمل logout
            if ($errorReason !== null) {
                $_SESSION = array();
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
                session_destroy();
                
                error_log('❌ تم تسجيل الخروج تلقائياً بسبب: ' . $errorReason);
                response(false, $errorReason, [
                    'error_type' => 'session_data_validation_failed',
                    'reason' => $errorReason,
                    'user_id' => $sessionUserId
                ], 500);
            }
            
            // في حالة الخطأ، استخدام بيانات الجلسة إذا كانت صحيحة
            $userData = [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'] ?? '',
                'name' => $_SESSION['name'] ?? '',
                'role' => $sessionRole,
                'branch_id' => $_SESSION['branch_id'] ?? null,
                'is_owner' => ($sessionRole === 'admin'),
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



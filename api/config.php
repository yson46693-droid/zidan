<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

// إعدادات النظام الأساسية
header('Content-Type: application/json; charset=utf-8');

// تحسين CORS للاستضافات المجانية
// السماح بالأصل المحدد في الطلب (للسماح بملفات تعريف الارتباط)
$allowedOrigins = [
    'https://alaa-zidan.free.nf',
    'http://alaa-zidan.free.nf',
    'https://www.alaa-zidan.free.nf',
    'http://www.alaa-zidan.free.nf'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$origin = '*';

// إذا كان الطلب من أصل مسموح، استخدمه مع credentials
if (!empty($requestOrigin)) {
    // التحقق من أن الأصل مسموح به
    foreach ($allowedOrigins as $allowedOrigin) {
        if (strpos($requestOrigin, $allowedOrigin) !== false || $requestOrigin === $allowedOrigin) {
            $origin = $requestOrigin;
            break;
        }
    }
}

if ($origin !== '*') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: false');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override');
header('Access-Control-Max-Age: 3600');

// إضافة headers إضافية للأمان
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');

// معالجة طلبات OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// معالجة أخطاء PHP - تفعيل وضع التطوير
error_reporting(E_ALL);
ini_set('display_errors', 0); // إخفاء الأخطاء من الشاشة (سنعرضها في JSON)
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');

// معالج الأخطاء المخصص
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    // لا نوقف التنفيذ، فقط نسجل الخطأ
    return false;
});

// معالج الاستثناءات
set_exception_handler(function($exception) {
    error_log("Uncaught Exception: " . $exception->getMessage() . " in " . $exception->getFile() . " on line " . $exception->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'خطأ في الخادم: ' . $exception->getMessage(),
        'error' => $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

// إنشاء مجلد السجلات إذا لم يكن موجوداً
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}

// تعيين مسار ملف السجلات
ini_set('error_log', $logDir . '/php_errors.log');

// تحميل ملف قاعدة البيانات
require_once __DIR__ . '/database.php';

// إعدادات الجلسة (قبل بدء الجلسة)
if (session_status() === PHP_SESSION_NONE) {
    // تكوين ملفات تعريف الارتباط للجلسة للعمل مع CORS
    $cookieParams = session_get_cookie_params();
    $isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    
    // إذا كان HTTPS متاحاً، استخدم SameSite=None للسماح بالطلبات عبر المواقع
    // إذا لم يكن HTTPS، استخدم SameSite=Lax (أكثر أماناً)
    session_set_cookie_params([
        'lifetime' => $cookieParams['lifetime'] ?: 86400, // 24 ساعة
        'path' => '/',
        'domain' => '', // فارغ للسماح بأي domain
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => $isSecure ? 'None' : 'Lax' // None يتطلب Secure=true
    ]);
    session_start();
}

if (!isset($_SESSION['db_setup_checked'])) {
    require_once __DIR__ . '/setup.php';
    try {
        $setupResult = setupDatabase();
        $_SESSION['db_setup_checked'] = true;
        
        // تسجيل في السجل إذا تم إنشاء جداول جديدة
        if (!empty($setupResult['tables_created'])) {
            error_log('تم إنشاء الجداول التالية تلقائياً: ' . implode(', ', $setupResult['tables_created']));
        }
    } catch (Exception $e) {
        error_log('خطأ في إعداد قاعدة البيانات: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    }
}

// مسارات الملفات (للنسخ الاحتياطي والصور فقط)
define('DATA_DIR', __DIR__ . '/../data/');
define('BACKUP_DIR', __DIR__ . '/../backups/');

// دوال مساعدة
function generateId() {
    return uniqid('', true);
}

// دوال JSON (للنسخ الاحتياطي فقط)
function readJSON($file) {
    if (!file_exists($file)) {
        file_put_contents($file, json_encode([], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        return [];
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: [];
}

function writeJSON($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function response($success, $message = '', $data = null, $code = 200) {
    // تنظيف أي output سابق
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // التأكد من أن headers لم يتم إرسالها بعد
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
    
    $response = [
        'success' => (bool)$success,
        'message' => (string)$message,
        'data' => $data
    ];
    
    // في وضع التطوير، أضف معلومات إضافية
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        $response['debug'] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ];
    }
    
    $jsonOutput = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
    // التأكد من أن JSON صحيح
    if ($jsonOutput === false) {
        $jsonOutput = json_encode([
            'success' => false,
            'message' => 'خطأ في ترميز الاستجابة',
            'data' => null
        ], JSON_UNESCAPED_UNICODE);
    }
    
    // إرسال الاستجابة وإنهاء السكريبت
    echo $jsonOutput;
    
    // إنهاء السكريبت فوراً
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    
    exit(0);
}

function getRequestMethod() {
    return $_SERVER['REQUEST_METHOD'];
}

function getRequestData() {
    $data = json_decode(file_get_contents('php://input'), true);
    return $data ?: [];
}

// التحقق من الجلسة
function checkAuth() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        response(false, 'غير مصرح، يرجى تسجيل الدخول', null, 401);
    }
    return $_SESSION;
}

// التحقق من الصلاحيات
function checkPermission($requiredRole) {
    $session = checkAuth();
    $roles = ['admin' => 3, 'manager' => 2, 'employee' => 1];
    
    $userRole = $session['role'];
    if ($roles[$userRole] < $roles[$requiredRole]) {
        response(false, 'ليس لديك صلاحية للوصول', null, 403);
    }
}

// إنشاء مستخدم افتراضي عند أول تشغيل
function initializeSystem() {
    try {
        // التحقق من الاتصال أولاً قبل محاولة إنشاء قاعدة البيانات
        $conn = getDBConnection();
        if (!$conn) {
            error_log('تحذير: لا يمكن الاتصال بقاعدة البيانات أثناء التهيئة');
            return; // لا نوقف التنفيذ، فقط نسجل التحذير
        }
        
        // إنشاء قاعدة البيانات إذا لم تكن موجودة
        createDatabaseIfNotExists();
        
        // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
        if (!is_dir(BACKUP_DIR)) {
            @mkdir(BACKUP_DIR, 0755, true);
        }
        
        // التحقق من وجود المستخدم الافتراضي (admin)
        $defaultUser = dbSelectOne("SELECT * FROM users WHERE username = ?", ['admin']);
        
        if (!$defaultUser) {
            $userId = generateId();
            $password = password_hash('admin123', PASSWORD_DEFAULT);
            $result = dbExecute(
                "INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                [$userId, 'admin', $password, 'المدير', 'admin']
            );
            if ($result === false) {
                error_log('تحذير: فشل إنشاء المستخدم الافتراضي admin');
            }
        }
        
        // التحقق من وجود المستخدم 1
        $user1 = dbSelectOne("SELECT * FROM users WHERE username = ?", ['1']);
        if (!$user1) {
            $userId1 = generateId();
            $password1 = password_hash('1', PASSWORD_DEFAULT);
            $result1 = dbExecute(
                "INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                [$userId1, '1', $password1, 'المدير', 'admin']
            );
            if ($result1 === false) {
                error_log('تحذير: فشل إنشاء المستخدم 1');
            }
        }
        
        // التحقق من وجود الإعدادات الافتراضية
        $shopName = dbSelectOne("SELECT * FROM settings WHERE `key` = ?", ['shop_name']);
        
        if (!$shopName) {
            $defaultSettings = [
                ['shop_name', 'محل صيانة الهواتف'],
                ['shop_phone', '01000000000'],
                ['shop_address', 'القاهرة، مصر'],
                ['shop_logo', ''],
                ['low_stock_alert', '5'],
                ['currency', 'ج.م'],
                ['theme', 'light']
            ];
            
            foreach ($defaultSettings as $setting) {
                $result = dbExecute(
                    "INSERT INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())",
                    $setting
                );
                if ($result === false) {
                    error_log('تحذير: فشل إدراج إعداد: ' . $setting[0]);
                }
            }
        }
    } catch (Exception $e) {
        // تسجيل الخطأ ولكن لا نوقف التنفيذ
        error_log('خطأ في تهيئة النظام: ' . $e->getMessage() . ' في ' . $e->getFile() . ' على السطر ' . $e->getLine());
    } catch (Error $e) {
        // معالجة الأخطاء القاتلة (PHP 7+)
        error_log('خطأ قاتل في تهيئة النظام: ' . $e->getMessage() . ' في ' . $e->getFile() . ' على السطر ' . $e->getLine());
    }
}

// تهيئة النظام فقط إذا لم يكن هناك خطأ في التحميل
try {
    initializeSystem();
} catch (Exception $e) {
    error_log('خطأ في تهيئة النظام: ' . $e->getMessage());
} catch (Error $e) {
    error_log('خطأ قاتل في تهيئة النظام: ' . $e->getMessage());
}
?>



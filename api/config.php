<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

// إعدادات timeout لتحسين الأداء وتجنب التعليق (30 ثانية كحد أقصى)
set_time_limit(30);
ini_set('max_execution_time', 30);
ini_set('default_socket_timeout', 10);

// إعدادات النظام الأساسية
header('Content-Type: application/json; charset=utf-8');

// تعيين التوقيت لمصر - الإسكندرية
date_default_timezone_set('Africa/Cairo');

// تحسين CORS للاستضافات المجانية
// السماح بالأصل المحدد في الطلب (للسماح بملفات تعريف الارتباط)
$allowedOrigins = [
    'https://alaa-zidan.free.nf',
    'http://alaa-zidan.free.nf',
    'https://www.alaa-zidan.free.nf',
    'http://www.alaa-zidan.free.nf',
    'https://my-store.free.nf',
    'http://my-store.free.nf',
    'https://www.my-store.free.nf',
    'http://www.my-store.free.nf',
    'https://www.egsystem.top',
    'http://www.egsystem.top',
    'https://egsystem.top',
    'http://egsystem.top',
    // ✅ إضافة الدومين الجديد zidan.egsystem.top
    'https://zidan.egsystem.top',
    'http://zidan.egsystem.top',
    'https://www.zidan.egsystem.top',
    'http://www.zidan.egsystem.top',
    // إضافة localhost للاختبار المحلي
    'http://localhost',
    'https://localhost',
    'http://127.0.0.1',
    'https://127.0.0.1',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$origin = '*';

// إذا كان الطلب من أصل مسموح، استخدمه مع credentials
if (!empty($requestOrigin)) {
    // التحقق من أن الأصل مسموح به (بما في ذلك الدومينات الفرعية)
    foreach ($allowedOrigins as $allowedOrigin) {
        // مطابقة دقيقة أو دومين فرعي
        if ($requestOrigin === $allowedOrigin || 
            strpos($requestOrigin, $allowedOrigin) !== false ||
            // دعم الدومينات الفرعية: zidan.egsystem.top يطابق egsystem.top
            (strpos($allowedOrigin, 'egsystem.top') !== false && strpos($requestOrigin, 'egsystem.top') !== false)) {
            $origin = $requestOrigin;
            break;
        }
    }
}

if ($origin !== '*') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else {
    // إذا لم يكن في القائمة، السماح به في وضع التطوير
    // أو يمكنك إضافة origin الحالي تلقائياً
    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
    if (!empty($currentHost)) {
        // ✅ تحسين اكتشاف HTTPS - متسق مع auth.php
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
        
        $protocol = $isHttps ? 'https' : 'http';
        $currentOrigin = $protocol . '://' . $currentHost;
        header('Access-Control-Allow-Origin: ' . $currentOrigin);
        header('Access-Control-Allow-Credentials: true');
    } else {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Credentials: false');
    }
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
ini_set('display_errors', 1); // إخفاء الأخطاء من الشاشة (سنعرضها في JSON)
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

// ✅ تعريف مسارات الملفات قبل تحميل أي ملفات أخرى تستخدمها
// مسارات الملفات (للنسخ الاحتياطي والصور فقط)
define('DATA_DIR', __DIR__ . '/../data/');
define('BACKUP_DIR', __DIR__ . '/../backups/');

// تحميل ملف قاعدة البيانات
require_once __DIR__ . '/database.php';

// تحميل ملف تنظيف الفواتير التلقائي
require_once __DIR__ . '/invoice-cleanup.php';

// ✅ تهيئة قاعدة البيانات تلقائياً عند أول زيارة (مرة واحدة فقط)
if (file_exists(__DIR__ . '/init-database.php')) {
    require_once __DIR__ . '/init-database.php';
    // التحقق من حالة التهيئة وتهيئة قاعدة البيانات إذا لزم الأمر
    try {
        $initResult = autoInitializeDatabase();
        if (!$initResult['initialized'] && $initResult['success']) {
            error_log("✅ تم تهيئة قاعدة البيانات تلقائياً: " . json_encode($initResult['migrations_applied'] ?? [], JSON_UNESCAPED_UNICODE));
        }
    } catch (Exception $e) {
        error_log("⚠️ تحذير: فشل التحقق من تهيئة قاعدة البيانات: " . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل التحذير
    } catch (Error $e) {
        error_log("⚠️ تحذير: خطأ قاتل في التحقق من تهيئة قاعدة البيانات: " . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل التحذير
    }
}

// إعدادات الجلسة (قبل بدء الجلسة)
if (session_status() === PHP_SESSION_NONE) {
    // تكوين ملفات تعريف الارتباط للجلسة للعمل مع CORS
    $cookieParams = session_get_cookie_params();
    
    // ✅ تحسين اكتشاف HTTPS - يعمل مع جميع أنواع الاستضافات
    $isSecure = false;
    if (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) {
        $isSecure = true;
    } elseif (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) {
        $isSecure = true;
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
        $isSecure = true;
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
        $isSecure = true;
    } elseif (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
        $isSecure = true;
    }
    
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
        // إضافة timeout protection لـ setupDatabase
        $startTime = microtime(true);
        $maxSetupTime = 10; // 10 ثواني كحد أقصى
        
        $setupResult = setupDatabase();
        
        // التحقق من الوقت المستغرق
        $elapsedTime = microtime(true) - $startTime;
        if ($elapsedTime > $maxSetupTime) {
            error_log('تحذير: setupDatabase() استغرق وقتاً طويلاً: ' . round($elapsedTime, 2) . ' ثانية');
        }
        
        $_SESSION['db_setup_checked'] = true;
        
        // تسجيل في السجل إذا تم إنشاء جداول جديدة
        if (!empty($setupResult['tables_created'])) {
            error_log('تم إنشاء الجداول التالية تلقائياً: ' . implode(', ', $setupResult['tables_created']));
        }
    } catch (Exception $e) {
        error_log('خطأ في إعداد قاعدة البيانات: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
        // لكن نحدد أن setup تم التحقق منه لتجنب المحاولة مرة أخرى
        $_SESSION['db_setup_checked'] = true;
    } catch (Error $e) {
        error_log('خطأ قاتل في إعداد قاعدة البيانات: ' . $e->getMessage());
        $_SESSION['db_setup_checked'] = true;
    }
}

// ✅ تم نقل تعريف DATA_DIR و BACKUP_DIR إلى الأعلى (قبل تحميل invoice-cleanup.php)

// دوال مساعدة
function generateId() {
    return uniqid('', true);
}

/**
 * توليد ID من 7 أرقام عشوائية للهواتف
 * @return string - ID من 7 أرقام
 */
function generatePhoneId() {
    // توليد رقم من 7 أرقام (1000000 إلى 9999999)
    return str_pad(rand(1000000, 9999999), 7, '0', STR_PAD_LEFT);
}

// توليد معرف عشوائي فريد للعملاء (6 أحرف: أرقام وحروف)
function generateCustomerId() {
    try {
        // مجموعة الأحرف المسموحة (أرقام 0-9 وحروف كبيرة A-Z)
        $chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $maxAttempts = 100; // عدد المحاولات للعثور على ID فريد
        $attempts = 0;
        
        do {
            // توليد ID عشوائي من 6 أحرف
            $newId = '';
            for ($i = 0; $i < 6; $i++) {
                $newId .= $chars[rand(0, strlen($chars) - 1)];
            }
            
            // التحقق من عدم وجود المعرف (حماية من التكرار)
            $exists = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$newId]);
            $attempts++;
            
            // إذا لم يوجد المعرف، نعيده
            if (!$exists) {
                return $newId;
            }
            
            // إذا وصلنا لعدد المحاولات الأقصى، نستخدم timestamp كحل بديل
            if ($attempts >= $maxAttempts) {
                error_log('تحذير: تم الوصول لعدد المحاولات الأقصى في توليد معرف العميل، استخدام timestamp');
                return 'C' . time() . rand(100, 999);
            }
        } while ($exists);
        
        return $newId;
    } catch (Exception $e) {
        error_log('خطأ في توليد معرف العميل: ' . $e->getMessage());
        // استخدام timestamp كحل بديل في حالة الخطأ
        return 'C' . time() . rand(100, 999);
    }
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
    // إذا تم قراءة البيانات مسبقاً وحفظها، إرجاعها
    // هذا يحل مشكلة php://input الذي يمكن قراءته مرة واحدة فقط
    if (isset($GLOBALS['_cached_request_data']) && $GLOBALS['_cached_request_data'] !== null) {
        return $GLOBALS['_cached_request_data'];
    }
    
    // محاولة قراءة JSON أولاً
    $rawInput = file_get_contents('php://input');
    
    if (!empty($rawInput)) {
        $jsonData = json_decode($rawInput, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
            // حفظ البيانات في متغير عام للاستخدام لاحقاً
            $GLOBALS['_cached_request_data'] = $jsonData;
            return $jsonData;
        }
    }
    
    // إذا لم يكن JSON، استخدام $_POST
    if (!empty($_POST)) {
        // حفظ البيانات في متغير عام للاستخدام لاحقاً
        $GLOBALS['_cached_request_data'] = $_POST;
        return $_POST;
    }
    
    // إذا لم يكن هناك بيانات، إرجاع array فارغ
    $GLOBALS['_cached_request_data'] = [];
    return [];
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
        
        // إنشاء قاعدة البيانات إذا لم تكن موجودة (فقط عند الحاجة)
        // ملاحظة: createDatabaseIfNotExists قد يكون بطيئاً، لذلك نستخدمه بحذر
        // يمكن تخطي هذا إذا كانت قاعدة البيانات موجودة مسبقاً
        
        // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
        if (!is_dir(BACKUP_DIR)) {
            @mkdir(BACKUP_DIR, 0755, true);
        }
        
        // التحقق من وجود المستخدم الافتراضي (admin) - استعلام واحد فقط
        $defaultUser = dbSelectOne("SELECT id FROM users WHERE username = ? LIMIT 1", ['admin']);
        
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
        
        // التحقق من وجود المستخدم 1 - استعلام واحد فقط
        $user1 = dbSelectOne("SELECT id FROM users WHERE username = ? LIMIT 1", ['1']);
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
        
        // التحقق من وجود الإعدادات الافتراضية - استعلام واحد فقط
        $shopName = dbSelectOne("SELECT `key` FROM settings WHERE `key` = ? LIMIT 1", ['shop_name']);
        
        if (!$shopName) {
            $defaultSettings = [
                ['shop_name', 'محل صيانة الهواتف'],
                ['shop_phone', '01000000000'],
                ['shop_address', 'القاهرة، مصر'],
                ['shop_logo', ''],
                ['low_stock_alert', '5'],
                ['currency', 'ج.م'],
                ['theme', 'light'],
                ['loading_page_enabled', '1'] // تفعيل صفحة التحميل افتراضياً
            ];
            
            // استخدام INSERT IGNORE أو ON DUPLICATE KEY UPDATE لتجنب الأخطاء
            foreach ($defaultSettings as $setting) {
                $result = dbExecute(
                    "INSERT IGNORE INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())",
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

// تهيئة النظام فقط مرة واحدة (caching باستخدام session)
// هذا يمنع استدعاء initializeSystem() في كل طلب مما يسبب بطء كبير
if (!isset($_SESSION['system_initialized'])) {
    try {
        // إضافة timeout protection
        $startTime = microtime(true);
        $maxInitTime = 5; // 5 ثواني كحد أقصى للتهيئة
        
        initializeSystem();
        
        // التحقق من الوقت المستغرق
        $elapsedTime = microtime(true) - $startTime;
        if ($elapsedTime > $maxInitTime) {
            error_log('تحذير: initializeSystem() استغرق وقتاً طويلاً: ' . round($elapsedTime, 2) . ' ثانية');
        }
        
        // تحديد أن النظام تم تهيئته
        $_SESSION['system_initialized'] = true;
    } catch (Exception $e) {
        error_log('خطأ في تهيئة النظام: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    } catch (Error $e) {
        error_log('خطأ قاتل في تهيئة النظام: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    }
}

// جدولة تنظيف الفواتير القديمة (معطل - تم إيقاف النظام)
// يتم تنفيذ cleanup بعد إرسال الاستجابة (async) لضمان عدم التأثير على المستخدم
// if (function_exists('scheduleInvoiceCleanupIfNeeded')) {
//     scheduleInvoiceCleanupIfNeeded();
// }
?>



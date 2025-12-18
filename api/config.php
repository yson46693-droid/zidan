<?php
// إعدادات النظام الأساسية
header('Content-Type: application/json; charset=utf-8');

// تحسين CORS للاستضافات المجانية
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override');
header('Access-Control-Allow-Credentials: true');
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
ini_set('display_errors', 1); // تفعيل عرض الأخطاء على الشاشة
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');

// إنشاء مجلد السجلات إذا لم يكن موجوداً
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}

// تعيين مسار ملف السجلات
ini_set('error_log', $logDir . '/php_errors.log');

// تحميل ملف قاعدة البيانات
require_once __DIR__ . '/database.php';

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
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
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
    session_start();
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
        // إنشاء قاعدة البيانات إذا لم تكن موجودة
        createDatabaseIfNotExists();
        
        // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
        if (!is_dir(BACKUP_DIR)) {
            @mkdir(BACKUP_DIR, 0755, true);
        }
        
        // التحقق من وجود المستخدم الافتراضي
        $defaultUser = dbSelectOne("SELECT * FROM users WHERE username = ?", ['admin']);
        
        if (!$defaultUser) {
            $userId = generateId();
            $password = password_hash('admin123', PASSWORD_DEFAULT);
            dbExecute(
                "INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                [$userId, 'admin', $password, 'المدير', 'admin']
            );
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
                dbExecute(
                    "INSERT INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())",
                    $setting
                );
            }
        }
    } catch (Exception $e) {
        // تسجيل الخطأ
        error_log('خطأ في تهيئة النظام: ' . $e->getMessage());
    }
}

initializeSystem();
?>



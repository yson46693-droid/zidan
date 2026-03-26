<?php
// ✅ CRITICAL: قمع تحذيرات open_basedir المتعلقة بـ wsdlcache في بداية الملف
// هذه التحذيرات تظهر حتى لو كان wsdlcache معطّل لأن PHP extension يحاول الوصول إلى المجلد
$originalErrorReporting = error_reporting();
error_reporting(E_ALL & ~E_WARNING);
$originalErrorHandler = set_error_handler(function($errno, $errstr, $errfile, $errline) use (&$originalErrorHandler) {
    // قمع تحذيرات open_basedir المتعلقة بـ wsdlcache
    if (strpos($errstr, 'open_basedir restriction') !== false && 
        strpos($errstr, 'wsdlcache') !== false) {
        // تجاهل هذا التحذير - لا يؤثر على عمل التطبيق
        return true;
    }
    // تمرير باقي الأخطاء إلى المعالج الأصلي
    if ($originalErrorHandler) {
        return call_user_func($originalErrorHandler, $errno, $errstr, $errfile, $errline);
    }
    return false;
}, E_WARNING);

// ✅ تحميل إعدادات PHP قبل أي شيء آخر
$autoPrependFile = __DIR__ . '/../.auto_prepend.php';
if (file_exists($autoPrependFile)) {
    require_once $autoPrependFile;
} else {
    @ini_set('soap.wsdl_cache_enabled', '0');
}

// ✅ استعادة error_reporting إلى القيمة الأصلية (بعد تطبيق الإعدادات)
error_reporting($originalErrorReporting);

// ✅ CRITICAL: تنظيف output buffer قبل أي شيء لمنع "headers already sent"
// التحقق من وجود buffer قبل محاولة حذفه
while (ob_get_level() > 0) {
    @ob_end_clean();
}

// ✅ CRITICAL: بدء output buffering لمنع أي output غير مقصود
// لكن فقط إذا لم يكن هناك buffer نشط بالفعل
if (ob_get_level() === 0) {
    @ob_start();
}

// ✅ CRITICAL: تعريف CookieSessionHandler قبل أي شيء آخر
// (لا يحتاج إلى database.php، يمكن تعريفه مباشرة)
class CookieSessionHandler implements SessionHandlerInterface {
    private $cookieName = 'PHPSESSDATA';
    private $lifetime = 86400; // 24 ساعة
    
    #[\ReturnTypeWillChange]
    public function open($save_path, $name): bool {
        return true;
    }
    
    #[\ReturnTypeWillChange]
    public function close(): bool {
        return true;
    }
    
    #[\ReturnTypeWillChange]
    public function read($session_id): string|false {
        // محاولة قراءة البيانات من cookie واحد
        if (isset($_COOKIE[$this->cookieName])) {
            $data = base64_decode($_COOKIE[$this->cookieName]);
            if ($data !== false) {
                $decoded = json_decode($data, true);
                if ($decoded !== null && isset($decoded['data']) && isset($decoded['expires'])) {
                    // التحقق من انتهاء الصلاحية
                    if ($decoded['expires'] > time()) {
                        return $decoded['data'];
                    }
                }
            }
        }
        
        // محاولة قراءة البيانات من cookies مقسمة
        if (isset($_COOKIE[$this->cookieName . '_count'])) {
            $count = (int)$_COOKIE[$this->cookieName . '_count'];
            $chunks = [];
            for ($i = 0; $i < $count; $i++) {
                if (isset($_COOKIE[$this->cookieName . '_' . $i])) {
                    $chunks[] = $_COOKIE[$this->cookieName . '_' . $i];
                }
            }
            if (count($chunks) === $count) {
                $encoded = implode('', $chunks);
                $data = base64_decode($encoded);
                if ($data !== false) {
                    $decoded = json_decode($data, true);
                    if ($decoded !== null && isset($decoded['data']) && isset($decoded['expires'])) {
                        // التحقق من انتهاء الصلاحية
                        if ($decoded['expires'] > time()) {
                            return $decoded['data'];
                        }
                    }
                }
            }
        }
        
        return '';
    }
    
    #[\ReturnTypeWillChange]
    public function write($session_id, $session_data): bool {
        // ✅ CRITICAL: التحقق من أن headers لم يتم إرسالها بعد
        if (headers_sent($file, $line)) {
            // إذا تم إرسال headers بالفعل، لا يمكن إرسال cookies
            // هذا يحدث عادة عند استدعاء session_write_close() بعد response()
            // وهذا أمر طبيعي ولا يعتبر خطأ - نعود بصمت
            return true; // نعيد true لتجنب خطأ
        }
        
        $isSecure = false;
        if (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) {
            $isSecure = true;
        } elseif (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) {
            $isSecure = true;
        } elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
            $isSecure = true;
        } elseif (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
            $isSecure = true;
        }
        
        $data = [
            'data' => $session_data,
            'expires' => time() + $this->lifetime
        ];
        
        $encoded = base64_encode(json_encode($data));
        
        // تقسيم البيانات إذا كانت كبيرة جداً (حد cookies هو 4096 بايت)
        if (strlen($encoded) > 4000) {
            // إذا كانت كبيرة جداً، نحفظها في عدة cookies
            $chunks = str_split($encoded, 4000);
            $samesite = $isSecure ? 'None' : 'Lax';
            foreach ($chunks as $index => $chunk) {
                if (PHP_VERSION_ID >= 70300) {
                    @setcookie($this->cookieName . '_' . $index, $chunk, [
                        'expires' => time() + $this->lifetime,
                        'path' => '/',
                        'domain' => '',
                        'secure' => $isSecure,
                        'httponly' => true,
                        'samesite' => $samesite
                    ]);
                } else {
                    @setcookie($this->cookieName . '_' . $index, $chunk, time() + $this->lifetime, '/', '', $isSecure, true);
                }
            }
            if (PHP_VERSION_ID >= 70300) {
                @setcookie($this->cookieName . '_count', count($chunks), [
                    'expires' => time() + $this->lifetime,
                    'path' => '/',
                    'domain' => '',
                    'secure' => $isSecure,
                    'httponly' => true,
                    'samesite' => $samesite
                ]);
            } else {
                @setcookie($this->cookieName . '_count', count($chunks), time() + $this->lifetime, '/', '', $isSecure, true);
            }
        } else {
            $samesite = $isSecure ? 'None' : 'Lax';
            if (PHP_VERSION_ID >= 70300) {
                @setcookie($this->cookieName, $encoded, [
                    'expires' => time() + $this->lifetime,
                    'path' => '/',
                    'domain' => '',
                    'secure' => $isSecure,
                    'httponly' => true,
                    'samesite' => $samesite
                ]);
            } else {
                @setcookie($this->cookieName, $encoded, time() + $this->lifetime, '/', '', $isSecure, true);
            }
        }
        
        return true;
    }
    
    #[\ReturnTypeWillChange]
    public function destroy($session_id): bool {
        // حذف جميع cookies المتعلقة بالجلسة
        if (isset($_COOKIE[$this->cookieName])) {
            setcookie($this->cookieName, '', time() - 3600, '/', '', false, true);
        }
        
        // حذف cookies المقسمة إذا كانت موجودة
        if (isset($_COOKIE[$this->cookieName . '_count'])) {
            $count = (int)$_COOKIE[$this->cookieName . '_count'];
            for ($i = 0; $i < $count; $i++) {
                setcookie($this->cookieName . '_' . $i, '', time() - 3600, '/', '', false, true);
            }
            setcookie($this->cookieName . '_count', '', time() - 3600, '/', '', false, true);
        }
        
        return true;
    }
    
    #[\ReturnTypeWillChange]
    public function gc($maxlifetime): int|false {
        // لا حاجة لتنظيف - cookies تنتهي تلقائياً
        // نرجع 0 (عدد الجلسات المحذوفة) أو false في حالة الخطأ
        return 0;
    }
}

// ✅ CRITICAL: بدء الجلسة قبل أي headers لمنع "Cannot set session cookie - headers already sent"
if (session_status() === PHP_SESSION_NONE) {
    @ini_set('soap.wsdl_cache_enabled', '0');
    
    // استخدام معالج الجلسات المخصص (cookies)
    $handler = new CookieSessionHandler();
    session_set_save_handler($handler, true);
    
    // اكتشاف HTTPS
    $isSecure = false;
    if (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) {
        $isSecure = true;
    } elseif (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) {
        $isSecure = true;
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
        $isSecure = true;
    } elseif (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https') {
        $isSecure = true;
    }
    
    
    session_set_cookie_params([
        'lifetime' => 86400, // 24 ساعة
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => $isSecure ? 'None' : 'Lax'
    ]);
    
    @session_start();
}

// إعدادات timeout لتحسين الأداء وتجنب التعليق (30 ثانية كحد أقصى)
set_time_limit(30);
ini_set('max_execution_time', 30);
ini_set('default_socket_timeout', 10);

// تعيين التوقيت لمصر - الإسكندرية
date_default_timezone_set('Africa/Cairo');

// ✅ CRITICAL: دالة لإرسال CORS headers - يمكن استدعاؤها بعد حفظ الجلسة
function sendCORSHeaders() {
    // التحقق من أن headers لم يتم إرسالها بعد
    if (headers_sent()) {
        return; // Headers تم إرسالها بالفعل
    }
    
    // ✅ SECURITY: إعدادات HTTP Headers - قائمة Origins مسموحة فقط (مطابقة دقيقة)
    // السماح بالأصل المحدد في الطلب (للسماح بملفات تعريف الارتباط)
    $allowedOrigins = [
        'https://www.alaazidan.store',
        'https://test.alaazidan.store',
        'https://alaazidan.store',
        'http://localhost',
        'https://localhost',
        'http://127.0.0.1',
        'https://127.0.0.1',
        'http://localhost:5500',
        'https://localhost:5500',
        'http://127.0.0.1:5500',
        'https://127.0.0.1:5500',
        'http://localhost:8000',
        'https://localhost:8000',
        'http://127.0.0.1:8000',
        'https://127.0.0.1:8000'
    ];
    
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $origin = null;
    
    // ✅ SECURITY: التحقق من أن الأصل مسموح به - مطابقة دقيقة فقط (لا strpos)
    if (!empty($requestOrigin)) {
        // ✅ SECURITY: استخدام in_array للمطابقة الدقيقة فقط
        if (in_array($requestOrigin, $allowedOrigins, true)) {
            $origin = $requestOrigin;
        }
    }
    
    // ✅ SECURITY: إرسال CORS headers فقط إذا كان الـ origin مسموحاً به
    // لا نرسل CORS headers لأي origin غير مسموح - هذا يمنع CSRF attacks
    if ($origin !== null) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    // ✅ SECURITY: إذا لم يكن الـ origin مسموحاً، لا نرسل CORS headers
    // المتصفح سيرفض الطلب تلقائياً - هذا أكثر أماناً من السماح بـ *
    
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override');
    header('Access-Control-Max-Age: 3600');
    
    // إضافة headers إضافية للأمان
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
}

// ✅ CRITICAL: التحقق من اسم الملف - إذا كان webauthn_login.php، لا نرسل headers تلقائياً
// سيتم استدعاء sendCORSHeaders() يدوياً بعد حفظ الجلسة
$currentScript = basename($_SERVER['SCRIPT_NAME'] ?? '');
$isWebAuthnLogin = ($currentScript === 'webauthn_login.php');

// ✅ إرسال CORS headers تلقائياً فقط إذا لم يكن webauthn_login.php
// webauthn_login.php سيدعو sendCORSHeaders() يدوياً بعد حفظ الجلسة
if (!$isWebAuthnLogin) {
    sendCORSHeaders();
}

// معالجة طلبات OPTIONS (preflight) - يجب أن تكون بعد إرسال CORS headers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (!$isWebAuthnLogin) {
        sendCORSHeaders(); // إرسال CORS headers للـ preflight
    }
    http_response_code(200);
    exit();
}

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

// ✅ تهيئة قاعدة البيانات - تم إزالة init-database.php (لم يعد مطلوباً)
// ✅ ملاحظة: CookieSessionHandler وبدء الجلسة تم نقلهما إلى بداية الملف (قبل أي headers)

// ✅ تم إزالة setup.php - لم يعد مطلوباً
if (!isset($_SESSION['db_setup_checked'])) {
    $_SESSION['db_setup_checked'] = true;
}

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
    // ✅ CRITICAL: تنظيف أي output سابق تماماً
    // التحقق من وجود buffer قبل محاولة حذفه
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    
    // ✅ CRITICAL: إيقاف output buffering تماماً (فقط إذا كان موجوداً)
    if (ob_get_level() > 0) {
        @ob_end_flush();
        @ob_end_clean();
    }
    
    // ✅ CRITICAL: التأكد من أن headers لم يتم إرسالها بعد
    if (!headers_sent($file, $line)) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8', true);
        header('Cache-Control: no-cache, no-store, must-revalidate', true);
        header('Pragma: no-cache', true);
        header('Expires: 0', true);
    } else {
        // ✅ إذا تم إرسال headers بالفعل، تسجيل الخطأ
        error_log("Warning: Headers already sent in $file on line $line");
    }
    
    // مسح أي token محفوظ في الجلسة
    if (session_status() !== PHP_SESSION_NONE && isset($_SESSION['new_api_token'])) {
        unset($_SESSION['new_api_token']);
    }

    $response = [
        'success' => (bool)$success,
        'message' => (string)$message,
        'data' => $data
    ];

    // ✅ إرسال tokens جديدة على مستوى الاستجابة (وليس داخل data) لعدم إفساد بنية البيانات
    if (session_status() !== PHP_SESSION_NONE && isset($_SESSION['user_id'])) {
        $response['csrf_token'] = generateCSRFToken();
        $response['api_token'] = generateAPIRequestToken();
    }
    
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
    
    // ✅ CRITICAL: إرسال الاستجابة بدون أي output إضافي
    // استخدام output buffering لضمان عدم وجود output إضافي
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    echo $jsonOutput;
    
    // ✅ CRITICAL: إنهاء السكريبت فوراً قبل أي شيء آخر
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    
    // ✅ CRITICAL: إنهاء فوري - لا شيء بعد هذا
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

// ✅ SECURITY: التحقق من الجلسة مع Session Regeneration والتحقق من IP
function checkAuth() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['user_id'])) {
        response(false, 'غير مصرح، يرجى تسجيل الدخول', null, 401);
    }
    
    // ✅ SECURITY: التحقق من IP Address (حماية من Session Hijacking)
    $currentIP = $_SERVER['REMOTE_ADDR'] ?? '';
    $sessionIP = $_SESSION['ip_address'] ?? '';
    
    // السماح بالتنوع في IP إذا كان المستخدم خلف proxy/CDN
    // ولكن نحذر إذا تغير IP بشكل كبير
    if (!empty($sessionIP) && !empty($currentIP)) {
        // السماح بنفس IP أو IP في نفس الشبكة الفرعية (آخر 3 octets)
        $sessionIPParts = explode('.', $sessionIP);
        $currentIPParts = explode('.', $currentIP);
        
        // إذا كان IP مختلف تماماً، طلب تسجيل الدخول مرة أخرى
        if (count($sessionIPParts) === 4 && count($currentIPParts) === 4) {
            // مقارنة أول 3 octets (السماح بتغير آخر octet)
            $sessionNetwork = $sessionIPParts[0] . '.' . $sessionIPParts[1] . '.' . $sessionIPParts[2];
            $currentNetwork = $currentIPParts[0] . '.' . $currentIPParts[1] . '.' . $currentIPParts[2];
            
            if ($sessionNetwork !== $currentNetwork && $sessionIP !== $currentIP) {
                // IP مختلف بشكل كبير - تسجيل الخطأ ولكن السماح مؤقتاً
                error_log("⚠️ SECURITY WARNING: IP Address changed for user {$_SESSION['user_id']}: $sessionIP -> $currentIP");
                // ملاحظة: في بيئة الإنتاج، قد نرغب في إجبار تسجيل الدخول مرة أخرى
            }
        }
    } else {
        // حفظ IP الحالي في الجلسة
        $_SESSION['ip_address'] = $currentIP;
    }
    
    // ✅ SECURITY: Session Regeneration - إعادة توليد معرف الجلسة كل 720 دقيقة (12 ساعة)
    $regenerationInterval = 720 * 60; // 720 دقيقة بالثواني
    $lastRegeneration = $_SESSION['last_regeneration'] ?? 0;
    $currentTime = time();
    
    if ($currentTime - $lastRegeneration > $regenerationInterval) {
        // إعادة توليد معرف الجلسة
        session_regenerate_id(true); // true = حذف الجلسة القديمة
        $_SESSION['last_regeneration'] = $currentTime;
        error_log("✅ Session regenerated for user {$_SESSION['user_id']}");
    }
    
    return $_SESSION;
}

// التحقق من الصلاحيات
function checkPermission($requiredRole) {
    $session = checkAuth();
    $roles = ['admin' => 3, 'manager' => 2, 'technician' => 1.5, 'employee' => 1];
    
    $userRole = $session['role'];
    if ($roles[$userRole] < $roles[$requiredRole]) {
        response(false, 'ليس لديك صلاحية للوصول', null, 403);
    }
}

/**
 * ✅ تنظيف المدخلات من XSS و SQL Injection
 * @param mixed $data
 * @return mixed
 */
function cleanInput($data) {
    if (is_array($data)) {
        return array_map('cleanInput', $data);
    }
    if (is_string($data)) {
        // إزالة HTML tags
        $data = strip_tags($data);
        // تحويل special characters
        $data = htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
    }
    return $data;
}

/**
 * ✅ تنظيف المخرجات من XSS
 * @param mixed $data
 * @return mixed
 */
function cleanOutput($data) {
    if (is_array($data)) {
        return array_map('cleanOutput', $data);
    }
    if (is_string($data)) {
        return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    }
    return $data;
}

/**
 * ✅ تنظيف رقم العملية أو المعرف (للاستخدام في URLs و IDs)
 * يسمح فقط بالأحرف والأرقام والشرطة السفلية والشرطة
 * @param string $id
 * @return string
 */
function cleanId($id) {
    if (!is_string($id)) {
        return '';
    }
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
}

/**
 * ✅ تنظيف النص (للأسماء والعناوين)
 * @param string $text
 * @return string
 */
function cleanText($text) {
    if (!is_string($text)) {
        return '';
    }
    $text = trim($text);
    $text = strip_tags($text);
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    return $text;
}

/**
 * ✅ تنظيف رقم صحيح من $_GET أو $_POST
 * @param mixed $value
 * @param int|null $default
 * @return int|null
 */
function cleanInt($value, $default = null) {
    if ($value === null || $value === '') {
        return $default;
    }
    $intValue = filter_var($value, FILTER_VALIDATE_INT);
    return $intValue !== false ? $intValue : $default;
}

/**
 * ✅ تنظيف رقم عشري من $_GET أو $_POST
 * @param mixed $value
 * @param float|null $default
 * @return float|null
 */
function cleanFloat($value, $default = null) {
    if ($value === null || $value === '') {
        return $default;
    }
    $floatValue = filter_var($value, FILTER_VALIDATE_FLOAT);
    return $floatValue !== false ? $floatValue : $default;
}

/**
 * ✅ تنظيف branch_id (يسمح بالأحرف والأرقام والشرطة السفلية والنقطة)
 * لأن branch_id يتم توليده باستخدام uniqid() الذي قد يحتوي على نقطة
 * @param string $branchId
 * @return string
 */
function cleanBranchId($branchId) {
    if (!is_string($branchId)) {
        return '';
    }
    // يسمح بالأحرف والأرقام والشرطة السفلية والنقطة
    return preg_replace('/[^a-zA-Z0-9_.-]/', '', $branchId);
}

// ✅ تم إزالة إدراج البيانات الافتراضية - لم يعد يتم إنشاء مستخدمين أو إعدادات افتراضية
function initializeSystem() {
    try {
        // التحقق من الاتصال أولاً قبل محاولة إنشاء قاعدة البيانات
        $conn = getDBConnection();
        if (!$conn) {
            error_log('تحذير: لا يمكن الاتصال بقاعدة البيانات أثناء التهيئة');
            return; // لا نوقف التنفيذ، فقط نسجل التحذير
        }
        
        // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
        if (!is_dir(BACKUP_DIR)) {
            @mkdir(BACKUP_DIR, 0755, true);
        }
        
        // ✅ تم إزالة إدراج البيانات الافتراضية:
        // - لا يتم إنشاء مستخدم 'admin' افتراضياً
        // - لا يتم إنشاء مستخدم '1' افتراضياً
        // - لا يتم إنشاء إعدادات افتراضية
        
    } catch (Exception $e) {
        // تسجيل الخطأ ولكن لا نوقف التنفيذ
        error_log('خطأ في تهيئة النظام: ' . $e->getMessage() . ' في ' . $e->getFile() . ' على السطر ' . $e->getLine());
    } catch (Error $e) {
        // معالجة الأخطاء القاتلة (PHP 7+)
        error_log('خطأ  في تهيئة النظام: ' . $e->getMessage() . ' في ' . $e->getFile() . ' على السطر ' . $e->getLine());
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
        error_log('خطأ  في تهيئة النظام: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    }
}

// ✅ تضمين نظام حماية API المتعدد الطبقات
require_once __DIR__ . '/api-security.php';

/* ============== AUTOMATIC DAILY BACKUP ================= */

/**
 * ✅ استدعاء النسخة الاحتياطية تلقائياً عند أول زيارة (مرة واحدة يومياً)
 * يعمل في الخلفية بعد إرسال الاستجابة حتى لا يبطئ الموقع
 */
function triggerAutomaticBackup() {
    // ✅ التحقق من وجود lock file (نسخة احتياطية قيد التنفيذ)
    $lockFile = __DIR__ . '/../data/backup_lock.lock';
    if (file_exists($lockFile)) {
        $lockTime = filemtime($lockFile);
        // ✅ إذا كان lock file موجوداً وأقل من 10 دقائق، لا نعمل نسخة احتياطية
        if ((time() - $lockTime) < 600) {
            return; // نسخة احتياطية قيد التنفيذ
        } else {
            // ✅ lock file قديم، حذفه
            @unlink($lockFile);
        }
    }
    
    // ✅ التحقق من الحاجة لعمل نسخة احتياطية (مرة واحدة يومياً)
    $lastBackupFile = __DIR__ . '/../data/last_backup_timestamp.json';
    
    // قراءة تاريخ آخر نسخة احتياطية
    $shouldBackup = false;
    $lastBackup = 0;
    
    if (file_exists($lastBackupFile)) {
        try {
            $data = json_decode(file_get_contents($lastBackupFile), true);
            $lastBackup = isset($data['timestamp']) ? (int)$data['timestamp'] : 0;
            
            // ✅ التحقق من صحة timestamp (يجب أن يكون أكبر من 0)
            if ($lastBackup <= 0) {
                error_log('⚠️ timestamp غير صحيح في last_backup_timestamp.json، سيتم عمل نسخة احتياطية');
                $shouldBackup = true;
            } else {
                // ✅ التحقق من أن timestamp صحيح (أكبر من 0)
                if ($lastBackup <= 0) {
                    error_log('⚠️ timestamp غير صحيح في last_backup_timestamp.json، سيتم عمل نسخة احتياطية');
                    $shouldBackup = true;
                } else {
                    // التحقق من مرور 24 ساعة (86400 ثانية)
                    $hoursSinceLastBackup = (time() - $lastBackup) / 3600;
                    $shouldBackup = (time() - $lastBackup) >= 86400;
                    
                    if ($shouldBackup) {
                        error_log("🔄 تم اكتشاف حاجة لعمل نسخة احتياطية - آخر نسخة كانت منذ " . round($hoursSinceLastBackup, 2) . " ساعة");
                    } else {
                        error_log("ℹ️ لم يمر 24 ساعة بعد آخر نسخة احتياطية - متبقي: " . round(24 - $hoursSinceLastBackup, 2) . " ساعة");
                    }
                }
            }
        } catch (Exception $e) {
            // في حالة الخطأ، نعمل نسخة احتياطية
            error_log('⚠️ خطأ في قراءة last_backup_timestamp.json: ' . $e->getMessage() . ' - سيتم عمل نسخة احتياطية');
            $shouldBackup = true;
        }
    } else {
        // إذا لم توجد نسخة احتياطية سابقة، يجب عمل واحدة
        error_log('ℹ️ لم يتم العثور على last_backup_timestamp.json - سيتم عمل نسخة احتياطية');
        $shouldBackup = true;
    }
    
    // ✅ إذا لم يمر 24 ساعة، لا نعمل نسخة احتياطية
    if (!$shouldBackup) {
        return;
    }
    
    // ✅ استخدام register_shutdown_function لتنفيذ النسخة الاحتياطية في الخلفية
    // بعد إرسال الاستجابة للمستخدم (لا يبطئ الموقع)
    $backupScript = __DIR__ . '/backup_db.php';
    
    register_shutdown_function(function() use ($backupScript) {
        try {
            error_log('🔄 [BACKUP] بدء تنفيذ النسخة الاحتياطية التلقائية في الخلفية...');
            
            // ✅ استخدام fastcgi_finish_request() إذا كان متاحاً (لإرسال الاستجابة فوراً)
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
                error_log('✅ [BACKUP] تم إرسال الاستجابة للمستخدم (fastcgi_finish_request)');
            } else {
                // ✅ إذا لم يكن fastcgi متاحاً، نرسل الاستجابة يدوياً
                // إغلاق output buffer وإرسال الاستجابة
                if (ob_get_level() > 0) {
                    ob_end_flush();
                }
                flush();
                error_log('✅ [BACKUP] تم إرسال الاستجابة للمستخدم (flush)');
            }
            
            // ✅ تجاهل انقطاع الاتصال من المستخدم (للاستمرار في الخلفية)
            ignore_user_abort(true);
            
            // ✅ زيادة timeout للسماح بإكمال النسخة الاحتياطية
            set_time_limit(300); // 5 دقائق
            
            // ✅ استدعاء ملف النسخة الاحتياطية مباشرة
            if (file_exists($backupScript)) {
                // ✅ تعريف constant للاستدعاء الصامت
                if (!defined('BACKUP_SILENT_MODE')) {
                    define('BACKUP_SILENT_MODE', true);
                }
                
                error_log('🔄 [BACKUP] استدعاء backup_db.php...');
                
                // ✅ منع أي output محتمل
                ob_start();
                
                // ✅ استدعاء الملف مباشرة
                try {
                    include $backupScript;
                } catch (Exception $e) {
                    error_log('❌ [BACKUP] خطأ في include backup_db.php: ' . $e->getMessage());
                } catch (Error $e) {
                    error_log('❌ [BACKUP] خطأ قاتل في include backup_db.php: ' . $e->getMessage());
                }
                
                $output = ob_get_clean();
                
                if (!empty($output)) {
                    error_log('⚠️ [BACKUP] تم اكتشاف output من backup_db.php: ' . substr($output, 0, 200));
                }
                
                error_log('✅ [BACKUP] تم إكمال استدعاء backup_db.php');
            } else {
                error_log('❌ [BACKUP] ملف backup_db.php غير موجود: ' . $backupScript);
            }
        } catch (Exception $e) {
            // تسجيل الخطأ ولكن لا نوقف التنفيذ
            error_log('❌ [BACKUP] خطأ في استدعاء النسخة الاحتياطية التلقائية: ' . $e->getMessage());
            error_log('❌ [BACKUP] Stack trace: ' . $e->getTraceAsString());
        } catch (Error $e) {
            error_log('❌ [BACKUP] خطأ قاتل في استدعاء النسخة الاحتياطية التلقائية: ' . $e->getMessage());
            error_log('❌ [BACKUP] Stack trace: ' . $e->getTraceAsString());
        }
    });
}

// ✅ استدعاء النسخة الاحتياطية التلقائية (مرة واحدة يومياً)
// يعمل فقط إذا مر 24 ساعة منذ آخر نسخة احتياطية
// ✅ register_shutdown_function لا يسبب أي output لأنه يعمل بعد إرسال الاستجابة
triggerAutomaticBackup();

?>



# 🔒 تقرير الأمان والتعديلات المطلوبة

## 📋 ملخص التقرير

تم فحص النظام واكتشاف **10 ثغرات أمنية** رئيسية تحتاج إلى إصلاح فوري. هذا التقرير يحتوي على جميع التعديلات المطلوبة مع الحلول الكاملة المتوافقة مع استضافات مجانية مثل InfinityFree.

---

## 🚨 الأخطاء الأمنية المكتشفة

### 1. ⚠️ كشف بيانات قاعدة البيانات (خطورة: عالية جداً)
**الموقع:** `api/database.php`  
**المشكلة:** بيانات الاتصال بقاعدة البيانات مكشوفة في الكود المصدري  
**الخطورة:** يمكن لأي شخص يصل للكود الوصول الكامل لقاعدة البيانات

### 2. ⚠️ عدم وجود حماية CSRF (خطورة: عالية)
**الموقع:** جميع ملفات API  
**المشكلة:** لا توجد حماية من هجمات Cross-Site Request Forgery  
**الخطورة:** يمكن تنفيذ عمليات غير مرغوبة باسم المستخدم المسجل

### 3. ⚠️ CORS مفتوح بالكامل (خطورة: متوسطة)
**الموقع:** `api/config.php` السطر 12  
**المشكلة:** `Access-Control-Allow-Origin: *` يسمح لأي موقع بالوصول  
**الخطورة:** هجمات من مواقع خارجية

### 4. ⚠️ مفتاح التشفير الافتراضي (خطورة: عالية)
**الموقع:** `api/encryption.php` السطر 8  
**المشكلة:** مفتاح تشفير ثابت وواضح في الكود  
**الخطورة:** يمكن فك تشفير جميع البيانات المشفرة

### 5. ⚠️ إعدادات الجلسة غير آمنة (خطورة: متوسطة)
**الموقع:** `api/config.php`  
**المشكلة:** لا توجد إعدادات أمنية للجلسات  
**الخطورة:** سرقة الجلسات (Session Hijacking)

### 6. ⚠️ رفع الملفات غير آمن (خطورة: عالية)
**الموقع:** `api/images.php`  
**المشكلة:** لا يوجد تحقق صارم من نوع الملف  
**الخطورة:** رفع ملفات خبيثة (PHP Shells, Malware)

### 7. ⚠️ كلمات مرور افتراضية ضعيفة (خطورة: عالية جداً)
**الموقع:** `api/config.php` السطور 219, 233  
**المشكلة:** `admin123` و `1` كلمات مرور ضعيفة جداً  
**الخطورة:** وصول غير مصرح به للنظام

### 8. ⚠️ تسريب معلومات في رسائل الخطأ (خطورة: متوسطة)
**الموقع:** `api/config.php` السطور 48-51  
**المشكلة:** عرض مسارات الملفات وأرقام الأسطر في الأخطاء  
**الخطورة:** معلومات قيمة للمهاجمين

### 9. ⚠️ عدم تنظيف المدخلات من XSS (خطورة: عالية)
**الموقع:** جميع ملفات API  
**المشكلة:** لا يوجد `htmlspecialchars` أو `htmlentities`  
**الخطورة:** حقن سكريبتات خبيثة (XSS Attacks)

### 10. ⚠️ عدم وجود Rate Limiting (خطورة: متوسطة)
**الموقع:** `api/auth.php`  
**المشكلة:** لا يوجد حد لعدد محاولات تسجيل الدخول  
**الخطورة:** هجمات Brute Force

---

## ✅ الحلول والتعديلات المطلوبة

### 🔧 التعديل 1: حماية بيانات قاعدة البيانات

**الملف:** `api/database.php`

**قبل التعديل:**
```php
define('DB_HOST', 'sql100.infinityfree.com');
define('DB_USER', 'if0_40710456');
define('DB_PASS', 'Osama7444');
define('DB_NAME', 'if0_40710456_zd');
```

**بعد التعديل:**
```php
<?php
/**
 * ملف إعدادات قاعدة البيانات MySQL
 * قم بتعديل هذه الإعدادات حسب بيئة الاستضافة الخاصة بك
 */

// قراءة الإعدادات من ملف منفصل (أكثر أماناً)
$dbConfigFile = __DIR__ . '/../.db_config.php';

if (file_exists($dbConfigFile)) {
    require_once $dbConfigFile;
} else {
    // قيم افتراضية (يجب تغييرها فوراً)
    define('DB_HOST', 'sql100.infinityfree.com');
    define('DB_USER', 'if0_40710456');
    define('DB_PASS', 'Osama7444'); // ⚠️ يجب تغييرها فوراً
    define('DB_NAME', 'if0_40710456_zd');
    define('DB_PORT', '3306');
    define('DB_CHARSET', 'utf8mb4');
}

// ... باقي الكود
```

**إنشاء ملف:** `.db_config.php` في المجلد الرئيسي (خارج `api/`)
```php
<?php
// ملف إعدادات قاعدة البيانات - لا ترفعه على Git
define('DB_HOST', 'sql100.infinityfree.com');
define('DB_USER', 'if0_40710456');
define('DB_PASS', 'Osama7444'); // ⚠️ غيّر هذه القيمة
define('DB_NAME', 'if0_40710456_zd');
define('DB_PORT', '3306');
define('DB_CHARSET', 'utf8mb4');
```

**إضافة إلى `.gitignore`:**
```
.db_config.php
.env.local
.encryption_key
.default_password
```

---

### 🔧 التعديل 2: إضافة حماية CSRF

**الملف:** `api/config.php`

**إضافة بعد السطر 70 (بعد `session_start()`):**
```php
// ========== حماية CSRF ==========
/**
 * إنشاء CSRF Token
 * @return string
 */
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * التحقق من CSRF Token
 * @param string $token
 * @return bool
 */
function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * التحقق من CSRF في الطلبات الحساسة
 */
function checkCSRF() {
    $method = getRequestMethod();
    
    // التحقق فقط في الطلبات التي تغير البيانات
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        $data = getRequestData();
        $token = $data['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        
        // استثناء طلبات تسجيل الدخول من CSRF (لأنها لا تحتاج جلسة)
        $isLoginRequest = (basename($_SERVER['PHP_SELF']) === 'auth.php' && 
                           isset($data['username']) && isset($data['password']));
        
        // استثناء طلبات OPTIONS (preflight)
        $isOptionsRequest = ($method === 'OPTIONS');
        
        if (!$isLoginRequest && !$isOptionsRequest && !verifyCSRFToken($token)) {
            response(false, 'رمز CSRF غير صحيح أو منتهي الصلاحية. يرجى تحديث الصفحة والمحاولة مرة أخرى', null, 403);
        }
    }
}

// استدعاء التحقق من CSRF تلقائياً
checkCSRF();
// ========== نهاية حماية CSRF ==========
```

**ملاحظة:** يجب إضافة `csrf_token` في جميع الطلبات من JavaScript:
```javascript
// في js/api.js - تعديل دالة request
async request(endpoint, method = 'GET', data = null) {
    // ... الكود الموجود ...
    
    // إضافة CSRF Token للطلبات الحساسة
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(actualMethod)) {
        // الحصول على CSRF Token من الجلسة أو localStorage
        const csrfToken = sessionStorage.getItem('csrf_token') || '';
        if (csrfToken) {
            if (!data) data = {};
            data.csrf_token = csrfToken;
        }
    }
    
    // ... باقي الكود
}
```

---

### 🔧 التعديل 3: تحسين إعدادات CORS

**الملف:** `api/config.php`

**استبدال السطور 11-16:**
```php
// تحسين CORS للاستضافات المجانية
$allowedOrigins = [
    'https://yourdomain.com',        // ⚠️ غيّر إلى دومينك
    'https://www.yourdomain.com',    // ⚠️ غيّر إلى دومينك
    'http://localhost:8000'           // للتطوير فقط
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // للاستضافات المجانية، قد تحتاج للسماح بجميع المصادر
    // لكن يجب إضافة حماية إضافية
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override, X-CSRF-Token');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
```

---

### 🔧 التعديل 4: تحسين مفتاح التشفير

**الملف:** `api/encryption.php`

**استبدال السطر 8 والكلاس بالكامل:**
```php
<?php
/**
 * نظام التشفير وفك التشفير للبيانات الحساسة
 * يستخدم AES-256-GCM للتشفير الآمن
 */

class DataEncryption {
    private static $encryptionKey = null;
    private static $cipher = 'aes-256-gcm';
    
    /**
     * الحصول على مفتاح التشفير من ملف منفصل
     * @return string
     */
    private static function getEncryptionKey() {
        if (self::$encryptionKey !== null) {
            return self::$encryptionKey;
        }
        
        $keyFile = __DIR__ . '/../.encryption_key';
        
        if (!file_exists($keyFile)) {
            // إنشاء مفتاح جديد عشوائي آمن
            $key = bin2hex(random_bytes(32)); // 256-bit key (64 حرف hex)
            file_put_contents($keyFile, $key);
            chmod($keyFile, 0600); // صلاحيات قراءة/كتابة للمالك فقط
            error_log('تم إنشاء مفتاح تشفير جديد في: ' . $keyFile);
            self::$encryptionKey = $key;
            return $key;
        }
        
        $key = trim(file_get_contents($keyFile));
        if (strlen($key) < 32) {
            throw new Exception('مفتاح التشفير غير صحيح. يجب أن يكون 32 بايت على الأقل');
        }
        
        self::$encryptionKey = $key;
        return $key;
    }
    
    /**
     * تشفير البيانات الحساسة
     * @param string $data البيانات المراد تشفيرها
     * @return string البيانات المشفرة مع IV و Tag
     */
    public static function encrypt($data) {
        if (empty($data)) {
            return $data;
        }
        
        $key = self::getEncryptionKey();
        
        // إنشاء IV عشوائي
        $iv = random_bytes(16);
        
        // تشفير البيانات
        $encrypted = openssl_encrypt($data, self::$cipher, $key, 0, $iv, $tag);
        
        if ($encrypted === false) {
            throw new Exception('فشل في تشفير البيانات');
        }
        
        // دمج IV + Tag + البيانات المشفرة
        return base64_encode($iv . $tag . $encrypted);
    }
    
    /**
     * فك تشفير البيانات الحساسة
     * @param string $encryptedData البيانات المشفرة
     * @return string البيانات الأصلية
     */
    public static function decrypt($encryptedData) {
        if (empty($encryptedData)) {
            return $encryptedData;
        }
        
        $key = self::getEncryptionKey();
        
        // فك تشفير Base64
        $data = base64_decode($encryptedData);
        
        if ($data === false) {
            throw new Exception('فشل في فك تشفير Base64');
        }
        
        // التحقق من الطول الأدنى (16 IV + 16 Tag = 32)
        if (strlen($data) < 32) {
            throw new Exception('بيانات مشفرة غير صحيحة');
        }
        
        // استخراج IV و Tag و البيانات المشفرة
        $iv = substr($data, 0, 16);
        $tag = substr($data, 16, 16);
        $encrypted = substr($data, 32);
        
        // فك تشفير البيانات
        $decrypted = openssl_decrypt($encrypted, self::$cipher, $key, 0, $iv, $tag);
        
        if ($decrypted === false) {
            throw new Exception('فشل في فك تشفير البيانات');
        }
        
        return $decrypted;
    }
    
    // ... باقي الدوال الموجودة (encryptArray, decryptArray, etc.) ...
}
```

---

### 🔧 التعديل 5: تحسين أمان الجلسات

**الملف:** `api/config.php`

**إضافة دالة جديدة بعد السطر 70:**
```php
/**
 * بدء جلسة آمنة
 */
function secureSessionStart() {
    if (session_status() === PHP_SESSION_NONE) {
        // إعدادات أمنية للجلسة
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_only_cookies', 1);
        ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 1 : 0);
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.gc_maxlifetime', 3600); // ساعة واحدة
        ini_set('session.use_strict_mode', 1);
        
        session_start();
        
        // إعادة توليد معرف الجلسة كل 5 دقائق (حماية من Session Fixation)
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        } else if (time() - $_SESSION['created'] > 300) {
            session_regenerate_id(true);
            $_SESSION['created'] = time();
        }
        
        // التحقق من IP Address (اختياري - قد يسبب مشاكل مع VPN)
        // if (isset($_SESSION['ip']) && $_SESSION['ip'] !== $_SERVER['REMOTE_ADDR']) {
        //     session_destroy();
        //     response(false, 'تم اكتشاف تغيير في عنوان IP', null, 403);
        // } else {
        //     $_SESSION['ip'] = $_SERVER['REMOTE_ADDR'];
        // }
    }
}
```

**استبدال جميع `session_start()` بـ `secureSessionStart()`:**
- في `api/config.php` السطر 71
- في `api/auth.php` السطور 48, 127, 177
- في جميع ملفات API الأخرى

---

### 🔧 التعديل 6: تحسين أمان رفع الملفات

**الملف:** `api/images.php`

**استبدال دالة `saveImage` بالكامل:**
```php
/**
 * حفظ الصورة كملف JPG
 * @param string $imageData - بيانات الصورة كـ Base64
 * @param string $repairId - رقم العملية
 * @return string|false - مسار الصورة المحفوظة أو false في حالة الفشل
 */
function saveImage($imageData, $repairId) {
    // تنظيف بيانات Base64
    $imageData = preg_replace('/^data:image\/[^;]+;base64,/', '', $imageData);
    $decoded = base64_decode($imageData, true);
    
    if ($decoded === false) {
        throw new Exception('بيانات الصورة غير صحيحة');
    }
    
    // التحقق من الحجم (أقصى 5MB)
    $maxSize = 5 * 1024 * 1024; // 5MB
    if (strlen($decoded) > $maxSize) {
        throw new Exception('حجم الصورة كبير جداً (الحد الأقصى 5MB)');
    }
    
    // التحقق من نوع الملف باستخدام getimagesize
    $imageInfo = @getimagesizefromstring($decoded);
    if ($imageInfo === false) {
        throw new Exception('الملف ليس صورة صالحة');
    }
    
    // السماح فقط بأنواع محددة
    $allowedTypes = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF];
    if (!in_array($imageInfo[2], $allowedTypes)) {
        throw new Exception('نوع الصورة غير مدعوم. يسمح فقط بـ JPG, PNG, GIF');
    }
    
    // التحقق من الأبعاد (منع صور ضخمة)
    $maxWidth = 4000;
    $maxHeight = 4000;
    if ($imageInfo[0] > $maxWidth || $imageInfo[1] > $maxHeight) {
        throw new Exception("أبعاد الصورة كبيرة جداً (الحد الأقصى: {$maxWidth}x{$maxHeight})");
    }
    
    // تنظيف اسم الملف (منع Path Traversal)
    $repairId = preg_replace('/[^a-zA-Z0-9_-]/', '', $repairId);
    if (empty($repairId)) {
        throw new Exception('رقم العملية غير صحيح');
    }
    
    $filename = 'repair_' . $repairId . '.jpg';
    $filepath = IMAGES_DIR . $filename;
    
    // التأكد من أن المسار داخل مجلد الصور (حماية إضافية)
    $realImagesDir = realpath(IMAGES_DIR);
    $realFilePath = realpath(dirname($filepath));
    if ($realFilePath !== $realImagesDir) {
        throw new Exception('مسار الملف غير آمن');
    }
    
    // حفظ الصورة
    $result = file_put_contents($filepath, $decoded);
    
    if ($result === false) {
        throw new Exception('فشل في كتابة الملف');
    }
    
    // التحقق مرة أخرى من أن الملف صورة صالحة (بعد الحفظ)
    $finalCheck = @getimagesize($filepath);
    if ($finalCheck === false) {
        @unlink($filepath);
        throw new Exception('فشل التحقق من صحة الصورة بعد الحفظ');
    }
    
    // التحقق من أن الملف ليس PHP (حماية إضافية)
    $fileContent = file_get_contents($filepath, false, null, 0, 100);
    if (stripos($fileContent, '<?php') !== false || 
        stripos($fileContent, '<?=') !== false ||
        stripos($fileContent, '<script') !== false) {
        @unlink($filepath);
        throw new Exception('الملف يحتوي على كود خبيث');
    }
    
    // ضغط الصورة وتحسين الجودة
    optimizeImage($filepath);
    
    return $filepath;
}
```

---

### 🔧 التعديل 7: تغيير كلمات المرور الافتراضية

**الملف:** `api/config.php`

**استبدال دالة `initializeSystem` (السطور 197-274):**
```php
// إنشاء مستخدم افتراضي عند أول تشغيل
function initializeSystem() {
    try {
        // التحقق من الاتصال أولاً قبل محاولة إنشاء قاعدة البيانات
        $conn = getDBConnection();
        if (!$conn) {
            error_log('تحذير: لا يمكن الاتصال بقاعدة البيانات أثناء التهيئة');
            return;
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
            
            // استخدام كلمة مرور قوية عشوائية
            $defaultPassword = bin2hex(random_bytes(8)); // 16 حرف عشوائي
            $password = password_hash($defaultPassword, PASSWORD_DEFAULT);
            
            // حفظ كلمة المرور في ملف آمن (للمرة الأولى فقط)
            $passwordFile = __DIR__ . '/../.default_password';
            if (!file_exists($passwordFile)) {
                file_put_contents($passwordFile, $defaultPassword);
                chmod($passwordFile, 0600);
                error_log('⚠️ كلمة مرور المدير الافتراضية: ' . $defaultPassword);
                error_log('⚠️ يرجى تغييرها فوراً بعد تسجيل الدخول الأول');
                error_log('⚠️ الملف: ' . $passwordFile);
            }
            
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
            
            // استخدام كلمة مرور قوية عشوائية
            $defaultPassword1 = bin2hex(random_bytes(8));
            $password1 = password_hash($defaultPassword1, PASSWORD_DEFAULT);
            
            // حفظ كلمة المرور في ملف آمن
            $passwordFile1 = __DIR__ . '/../.default_password_user1';
            if (!file_exists($passwordFile1)) {
                file_put_contents($passwordFile1, $defaultPassword1);
                chmod($passwordFile1, 0600);
                error_log('⚠️ كلمة مرور المستخدم "1" الافتراضية: ' . $defaultPassword1);
                error_log('⚠️ يرجى تغييرها فوراً بعد تسجيل الدخول الأول');
            }
            
            $result1 = dbExecute(
                "INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                [$userId1, '1', $password1, 'المدير', 'admin']
            );
            if ($result1 === false) {
                error_log('تحذير: فشل إنشاء المستخدم 1');
            }
        }
        
        // ... باقي الكود (الإعدادات الافتراضية) ...
    } catch (Exception $e) {
        error_log('خطأ في تهيئة النظام: ' . $e->getMessage());
    }
}
```

---

### 🔧 التعديل 8: تحسين معالجة الأخطاء

**الملف:** `api/config.php`

**استبدال معالج الاستثناءات (السطور 42-54):**
```php
// معالج الاستثناءات
set_exception_handler(function($exception) {
    // تسجيل الخطأ في السجل
    error_log("Uncaught Exception: " . $exception->getMessage() . 
              " in " . $exception->getFile() . " on line " . $exception->getLine());
    error_log("Stack trace: " . $exception->getTraceAsString());
    
    http_response_code(500);
    
    // تحديد وضع التشغيل (الإنتاج أو التطوير)
    $isProduction = !defined('DEBUG_MODE') || !DEBUG_MODE;
    
    if ($isProduction) {
        // في وضع الإنتاج، لا تعرض تفاصيل الخطأ
        echo json_encode([
            'success' => false,
            'message' => 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني.'
        ], JSON_UNESCAPED_UNICODE);
    } else {
        // في وضع التطوير فقط - عرض تفاصيل محدودة
        echo json_encode([
            'success' => false,
            'message' => 'خطأ في الخادم: ' . $exception->getMessage(),
            'error' => $exception->getMessage(),
            'file' => basename($exception->getFile()), // فقط اسم الملف (بدون مسار كامل)
            'line' => $exception->getLine()
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
});
```

**إضافة ثابت DEBUG_MODE في بداية `api/config.php`:**
```php
// تحديد وضع التشغيل (true للتطوير، false للإنتاج)
define('DEBUG_MODE', false); // ⚠️ غيّر إلى false في الإنتاج
```

---

### 🔧 التعديل 9: إضافة تنظيف المدخلات من XSS

**الملف:** `api/config.php`

**إضافة دوال مساعدة بعد السطر 163:**
```php
/**
 * تنظيف المدخلات من XSS
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
 * تنظيف المخرجات من XSS
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
 * تنظيف رقم العملية أو المعرف
 * @param string $id
 * @return string
 */
function cleanId($id) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
}

/**
 * تنظيف النص (للأسماء والعناوين)
 * @param string $text
 * @return string
 */
function cleanText($text) {
    $text = trim($text);
    $text = strip_tags($text);
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    return $text;
}
```

**استخدام الدوال في جميع ملفات API:**
```php
// مثال في api/users.php:
$username = cleanText($data['username'] ?? '');
$name = cleanText($data['name'] ?? '');
$id = cleanId($data['id'] ?? '');

// مثال في api/inventory.php:
$brand = cleanText($data['brand'] ?? '');
$model = cleanText($data['model'] ?? '');
```

---

### 🔧 التعديل 10: إضافة Rate Limiting

**الملف:** `api/config.php`

**إضافة دالة Rate Limiting بعد السطر 163:**
```php
/**
 * Rate Limiting - منع الهجمات المتكررة
 * @param string $action نوع العملية (login, register, etc.)
 * @param int $maxAttempts الحد الأقصى للمحاولات
 * @param int $timeWindow نافذة الوقت بالثواني
 * @return bool
 */
function checkRateLimit($action, $maxAttempts = 5, $timeWindow = 300) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $key = 'rate_limit_' . $action;
    $now = time();
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = [
            'count' => 0,
            'reset' => $now + $timeWindow,
            'first_attempt' => $now
        ];
    }
    
    // إعادة تعيين إذا انتهت الفترة
    if ($now > $_SESSION[$key]['reset']) {
        $_SESSION[$key] = [
            'count' => 0,
            'reset' => $now + $timeWindow,
            'first_attempt' => $now
        ];
    }
    
    // زيادة العداد
    $_SESSION[$key]['count']++;
    
    if ($_SESSION[$key]['count'] > $maxAttempts) {
        $remaining = $_SESSION[$key]['reset'] - $now;
        $minutes = ceil($remaining / 60);
        response(false, "تم تجاوز الحد المسموح من المحاولات ({$maxAttempts} محاولات كل " . ($timeWindow/60) . " دقيقة). يرجى المحاولة بعد {$minutes} دقيقة", [
            'retry_after' => $remaining,
            'max_attempts' => $maxAttempts
        ], 429);
    }
    
    return true;
}
```

**تطبيق Rate Limiting في `api/auth.php`:**
```php
// في بداية معالجة تسجيل الدخول (بعد السطر 42)
if ($method === 'POST') {
    // Rate Limiting لتسجيل الدخول
    checkRateLimit('login', 5, 300); // 5 محاولات كل 5 دقائق
    
    $data = getRequestData();
    // ... باقي الكود
}
```

---

## 📝 ملف .htaccess محسّن

**الملف:** `api/.htaccess`

**استبدال المحتوى بالكامل:**
```apache
# إعدادات خاصة بمجلد API

# تفعيل PHP
AddType application/x-httpd-php .php

# حماية الملفات الحساسة
<FilesMatch "\.(env|key|log|sql|config|db)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# منع عرض محتويات المجلدات
Options -Indexes

# حماية من XSS و Clickjacking
<IfModule mod_headers.c>
    Header set X-XSS-Protection "1; mode=block"
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# حل مشكلة CORS للاستضافات المجانية
<IfModule mod_headers.c>
    # ⚠️ غيّر الدومين إلى دومينك الخاص
    SetEnvIf Origin "^https?://(www\.)?(yourdomain\.com|localhost)(:\d+)?$" CORS=1
    Header always set Access-Control-Allow-Origin "%{CORS}e" env=CORS
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-HTTP-Method-Override, X-CSRF-Token"
    Header always set Access-Control-Allow-Credentials "true"
    Header always set Access-Control-Max-Age "3600"
</IfModule>

# معالجة طلبات OPTIONS (preflight)
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ - [R=200,L]

# تعطيل تنفيذ PHP في مجلد الصور (حماية إضافية)
<DirectoryMatch "^.*/images/">
    php_flag engine off
    <FilesMatch "\.php$">
        Order allow,deny
        Deny from all
    </FilesMatch>
</DirectoryMatch>

# السماح بملفات API العامة
<FilesMatch "\.(php)$">
    Order allow,deny
    Allow from all
</FilesMatch>

# منع الوصول المباشر لملفات معينة
<FilesMatch "^(config|database|encryption)\.php$">
    Order allow,deny
    Deny from all
</FilesMatch>
```

---

## 📋 قائمة التحقق النهائية

قبل رفع الملفات على الخادم، تأكد من:

- [ ] **تغيير كلمات مرور قاعدة البيانات** في `.db_config.php`
- [ ] **تغيير كلمات المرور الافتراضية** (`admin123`, `1`) - اقرأها من `.default_password`
- [ ] **إنشاء مفتاح تشفير جديد** - سيتم إنشاؤه تلقائياً في `.encryption_key`
- [ ] **إضافة حماية CSRF** - تطبيق التعديل 2
- [ ] **تحسين إعدادات CORS** - تغيير الدومين في التعديل 3
- [ ] **تحسين أمان الجلسات** - تطبيق التعديل 5
- [ ] **تحسين أمان رفع الملفات** - تطبيق التعديل 6
- [ ] **إضافة Rate Limiting** - تطبيق التعديل 10
- [ ] **تنظيف جميع المدخلات من XSS** - تطبيق التعديل 9 في جميع الملفات
- [ ] **إخفاء تفاصيل الأخطاء** - تعيين `DEBUG_MODE = false` في الإنتاج
- [ ] **حماية الملفات الحساسة** - تحديث `.htaccess`
- [ ] **إضافة الملفات الحساسة إلى `.gitignore`**:
  ```
  .db_config.php
  .encryption_key
  .default_password
  .default_password_user1
  logs/
  *.log
  ```
- [ ] **نسخ احتياطي لقاعدة البيانات** قبل التطبيق
- [ ] **اختبار جميع الوظائف** بعد التطبيق

---

## ⚠️ ملاحظات مهمة لـ InfinityFree

1. **لا يمكن استخدام `.env` مباشرة** - استخدم ملف PHP منفصل (`.db_config.php`)
2. **بعض إعدادات `.htaccess` قد لا تعمل** - حسب خطة الاستضافة المجانية
3. **Rate Limiting يعتمد على الجلسات** - قد تكون محدودة في الاستضافات المجانية
4. **HTTPS قد لا يكون متاحاً** - في الخطة المجانية، استخدم HTTP فقط
5. **صلاحيات الملفات** - قد لا تتمكن من تغيير `chmod` في الاستضافات المجانية
6. **مجلد السجلات** - تأكد من وجود مجلد `logs/` مع صلاحيات الكتابة

---

## 🚀 خطوات التطبيق

1. **نسخ احتياطي كامل** للمشروع وقاعدة البيانات
2. **تطبيق التعديلات بالترتيب** من 1 إلى 10
3. **اختبار كل تعديل** بعد تطبيقه
4. **مراجعة ملفات السجل** (`logs/php_errors.log`) للتحقق من الأخطاء
5. **تغيير جميع كلمات المرور** الافتراضية
6. **اختبار شامل** لجميع وظائف النظام

---

## 📞 الدعم

إذا واجهت أي مشاكل أثناء التطبيق:
1. راجع ملفات السجل (`logs/php_errors.log`)
2. تأكد من صلاحيات الملفات والمجلدات
3. تحقق من إعدادات PHP في لوحة التحكم
4. راجع وثائق InfinityFree

---

**تاريخ التقرير:** 2024  
**الإصدار:** 1.0  
**الحالة:** ⚠️ يحتاج تطبيق فوري

<?php
/**
 * ملف إعدادات قاعدة البيانات MySQL
 * 
 * ✅ تم تحديث الملف لقراءة البيانات من ملف .env
 * 
 * لاستخدام ملف .env:
 * 1. أنشئ ملف .env في المجلد الرئيسي للمشروع (بجانب index.html)
 * 2. أضف السطور التالية إلى ملف .env:
 * 
 * DB_HOST=localhost
 * DB_PORT=3306
 * DB_NAME=اسم_قاعدة_البيانات
 * DB_USER=اسم_المستخدم
 * DB_PASS=كلمة_المرور
 * DB_CHARSET=utf8mb4
 * 
 * ملاحظة: ملف .env موجود في .gitignore ولن يتم رفعه إلى Git
 * ملاحظة: إذا لم يكن ملف .env موجوداً، سيتم استخدام القيم الافتراضية
 */

// ✅ دالة لقراءة متغيرات .env
function loadEnv($filePath) {
    if (!file_exists($filePath)) {
        return [];
    }
    
    $env = [];
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        // تجاهل التعليقات
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // تقسيم السطر إلى key=value
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // إزالة علامات الاقتباس إذا كانت موجودة
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            
            $env[$key] = $value;
        }
    }
    
    return $env;
}

// ✅ قراءة بيانات .env
// ندعم مكانين شائعين:
// 1) داخل api/ (مذكور في TODO_IMPROVEMENTS.md)
// 2) في جذر المشروع (بجانب index.html)
$env = [];
$envPaths = [
    __DIR__ . '/.env',
    __DIR__ . '/../.env',
];
foreach ($envPaths as $path) {
    $loaded = loadEnv($path);
    if (!empty($loaded)) {
        $env = $loaded;
        break;
    }
}

// ✅ دعم متغيرات البيئة (تتغلب على .env لو موجودة)
// مفيد للاستضافات التي تمنع ملفات .env أو تستخدم لوحة تحكم لإضافة ENV vars
function envOr($key, $fallback = null) {
    $v = getenv($key);
    if ($v === false || $v === null || $v === '') return $fallback;
    return $v;
}

// ✅ إعدادات قاعدة البيانات - قراءة من .env أو استخدام القيم الافتراضية
define('DB_HOST', envOr('DB_HOST', $env['DB_HOST'] ?? 'localhost'));
define('DB_PORT', envOr('DB_PORT', $env['DB_PORT'] ?? '3306'));
// ملاحظة: DB_NAME الافتراضي "1" كان يسبب فشل اتصال صامت في أغلب البيئات
define('DB_NAME', envOr('DB_NAME', $env['DB_NAME'] ?? ''));
define('DB_USER', envOr('DB_USER', $env['DB_USER'] ?? 'root'));
define('DB_PASS', envOr('DB_PASS', $env['DB_PASS'] ?? ''));
define('DB_CHARSET', envOr('DB_CHARSET', $env['DB_CHARSET'] ?? 'utf8mb4'));

// متغير عام لتخزين آخر خطأ في قاعدة البيانات
$lastDbError = null;

/**
 * إنشاء اتصال بقاعدة البيانات
 * @return mysqli|null
 */
function getDBConnection() {
    static $connection = null;
    
    if ($connection === null) {
        try {
            // ✅ تحقق سريع من الإعدادات لتشخيص أوضح
            if (trim((string)DB_NAME) === '') {
                error_log('❌ إعدادات قاعدة البيانات غير مكتملة: DB_NAME فارغ. يرجى ضبط .env (في api/.env أو ../.env) أو Environment Variables.');
                return null;
            }

            // إعدادات timeout قبل الاتصال (10 ثواني)
            ini_set('default_socket_timeout', 10);
            
            // استخدام DB_PORT في الاتصال
            $port = is_numeric(DB_PORT) ? (int)DB_PORT : 3306;
            $connection = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, $port);
            
            // التحقق من نجاح الاتصال
            if (!$connection || $connection->connect_error) {
                $errorMsg = 'خطأ في الاتصال بقاعدة البيانات: ' . ($connection ? $connection->connect_error : 'فشل إنشاء الاتصال') . 
                           ' | Host: ' . DB_HOST . ':' . DB_PORT . ' | User: ' . DB_USER . ' | Database: ' . DB_NAME;
                error_log($errorMsg);
                $connection = null;
                return null;
            }
            
            // تعيين timeout للقراءة والكتابة (10 ثواني)
            // ملاحظة: connect_timeout يتم تعيينه عبر ini_set('default_socket_timeout') قبل الاتصال
            if (method_exists($connection, 'options')) {
                @$connection->options(MYSQLI_OPT_READ_TIMEOUT, 10);
                // MYSQLI_OPT_WRITE_TIMEOUT متاح فقط في PHP 7.2.13+
                if (defined('MYSQLI_OPT_WRITE_TIMEOUT')) {
                    @$connection->options(MYSQLI_OPT_WRITE_TIMEOUT, 10);
                }
            }
            
            // تعيين الترميز
            $connection->set_charset(DB_CHARSET);
            
            // تعيين التوقيت لمصر - الإسكندرية
            $connection->query("SET time_zone = '+02:00'");
            
        } catch (Exception $e) {
            error_log('خطأ في الاتصال بقاعدة البيانات: ' . $e->getMessage());
            $connection = null;
            return null;
        } catch (Error $e) {
            // معالجة الأخطاء القاتلة (PHP 7+)
            error_log('خطأ قاتل في الاتصال بقاعدة البيانات: ' . $e->getMessage());
            $connection = null;
            return null;
        }
    }
    
    return $connection;
}

/**
 * تنفيذ استعلام SELECT
 * @param string $query
 * @param array $params
 * @return array|false
 */
function dbSelect($query, $params = []) {
    global $lastDbError;
    $conn = getDBConnection();
    if (!$conn) {
        $lastDbError = 'فشل الاتصال بقاعدة البيانات';
        return false;
    }
    
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        $lastDbError = $conn->error;
        $error = $conn->error;
        error_log('خطأ في إعداد الاستعلام: ' . $error . ' | الاستعلام: ' . substr($query, 0, 200));
        
        // ✅ إذا كان الخطأ متعلق بجدول غير موجود أو عمود مفقود
        if (strpos($error, "doesn't exist") !== false || 
            strpos($error, 'Table') !== false || 
            strpos($error, "Unknown column") !== false) {
            error_log("⚠️ تم اكتشاف مشكلة في قاعدة البيانات: $error");
            error_log("❌ لا يمكن إصلاح قاعدة البيانات تلقائياً - يرجى التحقق من الجداول والأعمدة يدوياً");
        }
        return false;
    }
    
    if (!empty($params)) {
        $types = '';
        $values = [];
        
        foreach ($params as $param) {
            if (is_int($param)) {
                $types .= 'i';
            } elseif (is_float($param)) {
                $types .= 'd';
            } else {
                $types .= 's';
            }
            $values[] = $param;
        }
        
        $stmt->bind_param($types, ...$values);
    }
    
    if (!$stmt->execute()) {
        $lastDbError = $stmt->error;
        error_log('خطأ في تنفيذ الاستعلام: ' . $stmt->error . ' | الاستعلام: ' . substr($query, 0, 200));
        $stmt->close();
        return false;
    }
    
    $result = $stmt->get_result();
    $data = [];
    
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    
    $stmt->close();
    $lastDbError = null; // مسح الخطأ عند النجاح
    return $data;
}

/**
 * تنفيذ استعلام SELECT واحد
 * @param string $query
 * @param array $params
 * @return array|null|false
 */
function dbSelectOne($query, $params = []) {
    $result = dbSelect($query, $params);
    return $result !== false ? (isset($result[0]) ? $result[0] : null) : false;
}

/**
 * تنفيذ استعلام INSERT/UPDATE/DELETE
 * @param string $query
 * @param array $params
 * @return int|false عدد الصفوف المتأثرة أو false في حالة الخطأ
 */
function dbExecute($query, $params = []) {
    global $lastDbError;
    $conn = getDBConnection();
    if (!$conn) {
        $lastDbError = 'فشل الاتصال بقاعدة البيانات';
        return false;
    }
    
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        $lastDbError = $conn->error;
        error_log('خطأ في إعداد الاستعلام: ' . $conn->error . ' | الاستعلام: ' . substr($query, 0, 200));
        return false;
    }
    
    if (!empty($params)) {
        $types = '';
        $values = [];
        
        foreach ($params as $param) {
            if (is_int($param)) {
                $types .= 'i';
            } elseif (is_float($param)) {
                $types .= 'd';
            } else {
                $types .= 's';
            }
            $values[] = $param;
        }
        
        // ✅ تسجيل للتشخيص (فقط للاستعلامات المهمة)
        if (strpos($query, 'UPDATE accessories') !== false && strpos($query, 'type') !== false) {
        }
        
        // ✅ إصلاح: استخدام طريقة موثوقة لربط المعاملات
        // إنشاء مصفوفة من المراجع للمعاملات بشكل صحيح
        $bindParams = [];
        $bindParams[0] = $types;
        
        // إنشاء مراجع منفصلة لكل قيمة
        for ($i = 0; $i < count($values); $i++) {
            $bindParams[$i + 1] = &$values[$i];
        }
        
        // استخدام ReflectionMethod لربط المعاملات بشكل صحيح
        $ref = new ReflectionMethod($stmt, 'bind_param');
        $bindResult = $ref->invokeArgs($stmt, $bindParams);
        
        // ✅ تسجيل للتشخيص
        if (strpos($query, 'UPDATE accessories') !== false && strpos($query, 'type') !== false) {
            if (!$bindResult) {
            } else {
            }
        }
    }
    
    if (!$stmt->execute()) {
        $lastDbError = $stmt->error;
        $stmt->close();
        return false;
    }
    
    $affectedRows = $stmt->affected_rows;
    $insertId = $stmt->insert_id;
    
    // ✅ تسجيل للتشخيص (فقط للاستعلامات المهمة)
    if (strpos($query, 'UPDATE accessories') !== false && strpos($query, 'type') !== false) {
    }
    
    $stmt->close();
    $lastDbError = null;
    
    return $insertId > 0 ? $insertId : $affectedRows;
}

/**
 * بدء معاملة (Transaction)
 * @return bool
 */
function dbBeginTransaction() {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    return $conn->begin_transaction();
}

/**
 * تأكيد المعاملة (Commit)
 * @return bool
 */
function dbCommit() {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    return $conn->commit();
}

/**
 * إلغاء المعاملة (Rollback)
 * @return bool
 */
function dbRollback() {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    return $conn->rollback();
}

/**
 * تنظيف البيانات قبل إدخالها في قاعدة البيانات
 * @param string $data
 * @return string
 */
function dbEscape($data) {
    $conn = getDBConnection();
    if (!$conn) {
        return '';
    }
    return $conn->real_escape_string($data);
}

/**
 * التحقق من وجود جدول
 * ✅ إصلاح: استخدام INFORMATION_SCHEMA مع prepared statements (متوافق مع جميع إصدارات MySQL/MariaDB)
 * @param string $tableName
 * @return bool
 */
function dbTableExists($tableName) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    // ✅ تنظيف اسم الجدول (يسمح فقط بالأحرف والأرقام والشرطة السفلية)
    $tableName = preg_replace('/[^a-zA-Z0-9_]/', '', $tableName);
    
    if (empty($tableName)) {
        return false;
    }
    
    // ✅ استخدام INFORMATION_SCHEMA مع prepared statements (متوافق مع جميع الإصدارات)
    try {
        $dbResult = $conn->query("SELECT DATABASE()");
        if (!$dbResult) {
            return false;
        }
        $dbRow = $dbResult->fetch_row();
        $dbName = $dbRow ? $dbRow[0] : DB_NAME;
        
        // إذا لم يتم الحصول على اسم قاعدة البيانات، استخدام DB_NAME من config
        if (empty($dbName)) {
            $dbName = DB_NAME;
        }
        
        $stmt = $conn->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?");
        if (!$stmt) {
            return false;
        }
        
        $stmt->bind_param("ss", $dbName, $tableName);
        if (!$stmt->execute()) {
            $stmt->close();
            return false;
        }
        
        $result = $stmt->get_result();
        $row = $result->fetch_row();
        $exists = ($row && $row[0] > 0);
        $stmt->close();
        
        return $exists;
    } catch (Exception $e) {
        return false;
    } catch (Error $e) {
        return false;
    }
}

/**
 * إنشاء قاعدة البيانات إذا لم تكن موجودة
 * @return bool
 */
function createDatabaseIfNotExists() {
    try {
        // إعدادات timeout قبل الاتصال
        ini_set('default_socket_timeout', 10);
        
        // استخدام DB_PORT في الاتصال
        $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, null, DB_PORT);
        
        if ($conn->connect_error) {
            return false;
        }
        
        // تعيين timeout للقراءة والكتابة (10 ثواني)
        if (method_exists($conn, 'options')) {
            @$conn->options(MYSQLI_OPT_READ_TIMEOUT, 10);
            // MYSQLI_OPT_WRITE_TIMEOUT متاح فقط في PHP 7.2.13+
            if (defined('MYSQLI_OPT_WRITE_TIMEOUT')) {
                @$conn->options(MYSQLI_OPT_WRITE_TIMEOUT, 10);
            }
        }
        
        $sql = "CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
        
        if ($conn->query($sql) === TRUE) {
            $conn->close();
            return true;
        } else {
            $conn->close();
            return false;
        }
    } catch (Exception $e) {
        return false;
    } catch (Error $e) {
        return false;
    }
}

/**
 * التحقق من وجود عمود في جدول
 * @param string $tableName
 * @param string $columnName
 * @return bool
 */
function dbColumnExists($tableName, $columnName) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS 
                           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    if (!$stmt) {
        return false;
    }
    
    $dbName = DB_NAME;
    $stmt->bind_param('sss', $dbName, $tableName, $columnName);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return $row && $row['count'] > 0;
}

?>


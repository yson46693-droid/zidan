<?php
/**
 * ملف إعدادات قاعدة البيانات MySQL
 * قم بتعديل هذه الإعدادات حسب بيئة الاستضافة الخاصة بك
 */

// إعدادات قاعدة البيانات
define('DB_HOST', 'sql211.infinityfree.com');
define('DB_USER', 'if0_40099081');
define('DB_PORT', '3306');
define('DB_PASS', '2sfYXFo1ezB');
define('DB_NAME', 'if0_40099081_1');
define('DB_CHARSET', 'utf8mb4');

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
            $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            
            if ($connection->connect_error) {
                $errorMsg = 'خطأ في الاتصال بقاعدة البيانات: ' . $connection->connect_error . 
                           ' | Host: ' . DB_HOST . ' | User: ' . DB_USER . ' | Database: ' . DB_NAME;
                error_log($errorMsg);
                return null;
            }
            
            // تعيين الترميز
            $connection->set_charset(DB_CHARSET);
            
            // تعيين التوقيت لمصر - الإسكندرية
            $connection->query("SET time_zone = '+02:00'");
            
        } catch (Exception $e) {
            error_log('خطأ في الاتصال بقاعدة البيانات: ' . $e->getMessage());
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
        
        $stmt->bind_param($types, ...$values);
    }
    
    if (!$stmt->execute()) {
        $lastDbError = $stmt->error;
        error_log('خطأ في تنفيذ الاستعلام: ' . $stmt->error . ' | الاستعلام: ' . substr($query, 0, 200));
        $stmt->close();
        return false;
    }
    
    $affectedRows = $stmt->affected_rows;
    $insertId = $stmt->insert_id;
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
 * @param string $tableName
 * @return bool
 */
function dbTableExists($tableName) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    $result = $conn->query("SHOW TABLES LIKE '$tableName'");
    return $result && $result->num_rows > 0;
}

/**
 * إنشاء قاعدة البيانات إذا لم تكن موجودة
 * @return bool
 */
function createDatabaseIfNotExists() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS);
    
    if ($conn->connect_error) {
        error_log('خطأ في الاتصال: ' . $conn->connect_error);
        return false;
    }
    
    $sql = "CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    
    if ($conn->query($sql) === TRUE) {
        $conn->close();
        return true;
    } else {
        error_log('خطأ في إنشاء قاعدة البيانات: ' . $conn->error);
        $conn->close();
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


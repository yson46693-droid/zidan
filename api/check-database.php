<?php
/**
 * ملف التحقق من قاعدة البيانات وإنشاء الجداول الناقصة تلقائياً
 * يتم استدعاؤه تلقائياً عند حدوث خطأ في قاعدة البيانات
 */

require_once __DIR__ . '/setup.php';
require_once __DIR__ . '/config.php';

/**
 * التحقق من وجود جميع الجداول المطلوبة وإنشاؤها إذا كانت ناقصة
 * @return array
 */
function checkAndCreateMissingTables() {
    $conn = getDBConnection();
    if (!$conn) {
        return [
            'success' => false,
            'message' => 'فشل الاتصال بقاعدة البيانات',
            'tables_checked' => [],
            'tables_created' => []
        ];
    }
    
    $tablesChecked = [];
    $tablesCreated = [];
    $errors = [];
    
    // قائمة الجداول المطلوبة
    $requiredTables = [
        'users',
        'customers',
        'settings',
        'telegram_backup_config',
        'expenses',
        'inventory',
        'spare_parts',
        'spare_part_items',
        'accessories',
        'phones',
        'repairs',
        'loss_operations',
        'sales',
        'sale_items',
        'customer_ratings',
        'webauthn_credentials',
        'chat_rooms',
        'chat_participants',
        'chat_messages',
        'chat_reactions'
    ];
    
    // التحقق من وجود كل جدول
    foreach ($requiredTables as $tableName) {
        $tablesChecked[] = $tableName;
        
        if (!dbTableExists($tableName)) {
            // الجدول غير موجود، نحتاج إلى إنشائه
            // استدعاء setupDatabase لإنشاء الجداول الناقصة
            error_log("⚠️ جدول $tableName غير موجود، سيتم إنشاؤه تلقائياً");
            $tablesCreated[] = $tableName;
        }
    }
    
    // إذا كان هناك جداول ناقصة، قم بإنشائها
    if (count($tablesCreated) > 0) {
        error_log("🔧 إنشاء " . count($tablesCreated) . " جدول ناقص: " . implode(', ', $tablesCreated));
        $setupResult = setupDatabase();
        
        if ($setupResult['success']) {
            return [
                'success' => true,
                'message' => 'تم التحقق من قاعدة البيانات وإنشاء الجداول الناقصة بنجاح',
                'tables_checked' => $tablesChecked,
                'tables_created' => $setupResult['tables_created'],
                'migrations_applied' => $setupResult['migrations_applied'] ?? []
            ];
        } else {
            return [
                'success' => false,
                'message' => 'فشل في إنشاء الجداول الناقصة: ' . ($setupResult['message'] ?? 'خطأ غير معروف'),
                'tables_checked' => $tablesChecked,
                'tables_created' => [],
                'errors' => $setupResult['errors'] ?? []
            ];
        }
    }
    
    return [
        'success' => true,
        'message' => 'جميع الجداول موجودة',
        'tables_checked' => $tablesChecked,
        'tables_created' => []
    ];
}

/**
 * التحقق من وجود جدول معين
 * @param string $tableName
 * @return bool
 */
function dbTableExists($tableName) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    try {
        $result = $conn->query("SHOW TABLES LIKE '$tableName'");
        return $result && $result->num_rows > 0;
    } catch (Exception $e) {
        error_log("خطأ في التحقق من وجود جدول $tableName: " . $e->getMessage());
        return false;
    }
}

// إذا تم استدعاء الملف مباشرة من API
if (php_sapi_name() !== 'cli' && isset($_GET['action']) && $_GET['action'] === 'check') {
    header('Content-Type: application/json; charset=utf-8');
    $result = checkAndCreateMissingTables();
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// إذا تم استدعاء الملف تلقائياً عند حدوث خطأ
// يمكن استدعاؤه من ملفات API الأخرى عند حدوث خطأ في قاعدة البيانات
if (php_sapi_name() !== 'cli' && isset($_GET['auto_fix']) && $_GET['auto_fix'] === '1') {
    // التحقق التلقائي وإصلاح الجداول الناقصة
    $result = checkAndCreateMissingTables();
    
    if ($result['success']) {
        // إعادة توجيه أو إرجاع رسالة نجاح
        if (isset($_GET['redirect'])) {
            header('Location: ' . $_GET['redirect']);
            exit;
        }
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'message' => 'تم إصلاح قاعدة البيانات تلقائياً',
            'details' => $result
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    } else {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'فشل إصلاح قاعدة البيانات',
            'details' => $result
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
}

?>


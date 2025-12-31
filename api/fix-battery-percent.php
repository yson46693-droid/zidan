<?php
/**
 * ملف إصلاح سريع لإضافة عمود battery_percent إلى جدول phones
 * يمكن استدعاؤه مباشرة من المتصفح: api/fix-battery-percent.php
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $conn = getDBConnection();
    if (!$conn) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'فشل الاتصال بقاعدة البيانات'
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    // التحقق من وجود العمود
    $dbname = DB_NAME;
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'phones' AND COLUMN_NAME = 'battery_percent'");
    $stmt->bind_param('s', $dbname);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    if ($row['count'] > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'العمود battery_percent موجود بالفعل في جدول phones'
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    // إضافة العمود
    $conn->query("ALTER TABLE `phones` ADD COLUMN `battery_percent` int(11) DEFAULT NULL AFTER `battery`");
    
    echo json_encode([
        'success' => true,
        'message' => '✅ تم إضافة عمود battery_percent إلى جدول phones بنجاح'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'خطأ في إضافة العمود: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}


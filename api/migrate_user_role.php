<?php
/**
 * Migration Script - إضافة نوع حساب "فني صيانة"
 */
require_once 'config.php';
require_once 'database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('فشل الاتصال بقاعدة البيانات');
    }
    
    // التحقق من نوع ENUM الحالي
    $result = dbSelectOne("SHOW COLUMNS FROM users WHERE Field = 'role'");
    
    if ($result) {
        $type = $result['Type'];
        
        // التحقق من وجود 'technician' في ENUM
        if (strpos($type, 'technician') === false) {
            // تحديث ENUM لإضافة 'technician'
            $alterQuery = "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin','manager','employee','technician') NOT NULL DEFAULT 'employee'";
            
            if (dbExecute($alterQuery, [])) {
                response(true, 'تم تحديث نوع الدور بنجاح', ['message' => 'تم إضافة نوع حساب "فني صيانة"']);
            } else {
                response(false, 'فشل تحديث نوع الدور', null, 500);
            }
        } else {
            response(true, 'نوع الدور محدث بالفعل', ['message' => 'نوع حساب "فني صيانة" موجود بالفعل']);
        }
    } else {
        response(false, 'لم يتم العثور على عمود role', null, 404);
    }
    
} catch (Exception $e) {
    error_log('خطأ في الهجرة: ' . $e->getMessage());
    response(false, 'خطأ في الهجرة: ' . $e->getMessage(), [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 500);
}
?>


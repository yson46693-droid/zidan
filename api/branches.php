<?php
/**
 * API لإدارة الفروع
 */
require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();

// قراءة جميع الفروع
if ($method === 'GET') {
    checkAuth();
    
    $branches = dbSelect("SELECT id, name, code, has_pos, is_active, created_at FROM branches WHERE is_active = 1 ORDER BY name ASC");
    
    if ($branches === false) {
        response(false, 'خطأ في قراءة الفروع', null, 500);
    }
    
    // التأكد من أن $branches هي array
    if (!is_array($branches)) {
        $branches = [];
    }
    
    response(true, '', $branches);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


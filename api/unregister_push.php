<?php
/**
 * إلغاء تسجيل Push Subscription
 */
require_once __DIR__ . '/config.php';

try {
    $method = getRequestMethod();
    $data = getRequestData();
    $session = checkAuth();
    $userId = $session['user_id'];
    
    if ($method !== 'POST') {
        response(false, 'طريقة الطلب غير مدعومة', null, 405);
    }
    
    // الحصول على endpoint
    $endpoint = $data['endpoint'] ?? '';
    
    if (empty($endpoint)) {
        response(false, 'Endpoint مطلوب', null, 400);
    }
    
    // حذف Push Subscription
    $result = dbExecute("
        DELETE FROM push_subscriptions 
        WHERE user_id = ? AND endpoint = ?
    ", [$userId, $endpoint]);
    
    response(true, 'تم إلغاء تسجيل Push Subscription بنجاح', [
        'deleted' => true
    ]);
    
} catch (Exception $e) {
    error_log('خطأ في unregister_push.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في إلغاء تسجيل Push Subscription: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في unregister_push.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في إلغاء تسجيل Push Subscription', null, 500);
}
?>


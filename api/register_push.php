<?php
/**
 * تسجيل Push Subscription للمستخدم
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
    
    // الحصول على بيانات Push Subscription
    $endpoint = $data['endpoint'] ?? '';
    $p256dh = $data['keys']['p256dh'] ?? '';
    $auth = $data['keys']['auth'] ?? '';
    
    // التحقق من وجود جميع البيانات المطلوبة
    if (empty($endpoint) || empty($p256dh) || empty($auth)) {
        response(false, 'بيانات Push Subscription غير مكتملة', null, 400);
    }
    
    // إنشاء معرف فريد للـ subscription
    $subscriptionId = generateId();
    
    // التحقق من وجود subscription موجود
    $existing = dbSelectOne("
        SELECT id FROM push_subscriptions 
        WHERE user_id = ? AND endpoint = ?
    ", [$userId, $endpoint]);
    
    if ($existing) {
        // تحديث subscription موجود
        $result = dbExecute("
            UPDATE push_subscriptions 
            SET p256dh = ?, auth = ?, updated_at = NOW()
            WHERE user_id = ? AND endpoint = ?
        ", [$p256dh, $auth, $userId, $endpoint]);
    } else {
        // إنشاء subscription جديد
        $result = dbExecute("
            INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ", [$subscriptionId, $userId, $endpoint, $p256dh, $auth]);
    }
    
    if (!$result) {
        response(false, 'فشل تسجيل Push Subscription', null, 500);
    }
    
    response(true, 'تم تسجيل Push Subscription بنجاح', [
        'subscription_id' => $subscriptionId
    ]);
    
} catch (Exception $e) {
    error_log('خطأ في register_push.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في تسجيل Push Subscription: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في register_push.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في تسجيل Push Subscription', null, 500);
}
?>


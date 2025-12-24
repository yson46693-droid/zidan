<?php
/**
 * إرسال رسالة جديدة
 * يدعم الرد على الرسائل (reply_to)
 */
require_once __DIR__ . '/config.php';

try {
    $method = getRequestMethod();
    $data = getRequestData();
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // الحصول على username من قاعدة البيانات
    $user = dbSelectOne("SELECT name, username FROM users WHERE id = ?", [$userId]);
    $username = $user['name'] ?? $user['username'] ?? 'مستخدم';
    
    if ($method !== 'POST') {
        response(false, 'طريقة الطلب غير مدعومة', null, 405);
    }
    
    // الحصول على البيانات
    $message = trim($data['message'] ?? '');
    $replyTo = $data['reply_to'] ?? null;
    
    // التحقق من وجود الرسالة
    if (empty($message)) {
        response(false, 'الرسالة لا يمكن أن تكون فارغة', null, 400);
    }
    
    // التحقق من طول الرسالة (حد أقصى 1000 حرف)
    if (mb_strlen($message) > 1000) {
        response(false, 'الرسالة طويلة جداً. الحد الأقصى 1000 حرف', null, 400);
    }
    
    // فلترة XSS
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    
    // التحقق من وجود الرسالة المراد الرد عليها (إذا كان reply_to موجود)
    $replyToMessage = null;
    if (!empty($replyTo)) {
        $replyToMessage = dbSelectOne("
            SELECT id, user_id, username, message 
            FROM chat_messages 
            WHERE id = ?
        ", [$replyTo]);
        
        if (!$replyToMessage) {
            response(false, 'الرسالة المراد الرد عليها غير موجودة', null, 404);
        }
    }
    
    // إنشاء معرف فريد للرسالة
    $messageId = generateId();
    
    // حفظ الرسالة في قاعدة البيانات
    $result = dbExecute("
        INSERT INTO chat_messages (id, user_id, username, message, reply_to, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ", [$messageId, $userId, $username, $message, $replyTo]);
    
    if (!$result) {
        response(false, 'فشل إرسال الرسالة', null, 500);
    }
    
    // تحديث حالة النشاط للمرسل
    updateUserActivity($userId);
    
    // إعداد بيانات الرسالة المرسلة
    $sentMessage = [
        'id' => $messageId,
        'user_id' => $userId,
        'username' => $username,
        'message' => $message,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    // إضافة معلومات الرد إذا كان موجوداً
    if ($replyToMessage) {
        $sentMessage['reply_to'] = [
            'id' => $replyToMessage['id'],
            'user_id' => $replyToMessage['user_id'],
            'username' => $replyToMessage['username'],
            'message' => $replyToMessage['message']
        ];
    }
    
    // إرسال Web Push للمستخدمين غير المفتوحين (سيتم تنفيذه لاحقاً)
    // sendPushNotifications($userId, $message, $username);
    
    response(true, 'تم إرسال الرسالة بنجاح', $sentMessage);
    
} catch (Exception $e) {
    error_log('خطأ في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في إرسال الرسالة: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في إرسال الرسالة', null, 500);
}

/**
 * تحديث حالة النشاط للمستخدم
 */
function updateUserActivity($userId) {
    try {
        dbExecute("
            INSERT INTO active_users (user_id, last_activity, is_online)
            VALUES (?, NOW(), 1)
            ON DUPLICATE KEY UPDATE last_activity = NOW(), is_online = 1
        ", [$userId]);
    } catch (Exception $e) {
        error_log('خطأ في updateUserActivity: ' . $e->getMessage());
    }
}

/**
 * إرسال إشعارات Push للمستخدمين غير المفتوحين
 * (سيتم تنفيذه لاحقاً عند إضافة Web Push)
 */
function sendPushNotifications($senderId, $message, $senderName) {
    // TODO: تنفيذ إرسال Web Push
    // 1. الحصول على جميع المستخدمين المفتوحين (من active_users)
    // 2. الحصول على Push Subscriptions للمستخدمين غير المفتوحين
    // 3. إرسال Push Notification لكل subscription
}
?>


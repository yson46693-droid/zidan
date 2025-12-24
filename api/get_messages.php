<?php
/**
 * جلب الرسائل عند دخول المستخدم
 * يجلب آخر 50 رسالة
 */
require_once __DIR__ . '/config.php';

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // تحديث حالة النشاط
    updateUserActivity($userId);
    
    // جلب آخر 50 رسالة
    $messages = dbSelect("
        SELECT 
            cm.id,
            cm.user_id,
            cm.username,
            cm.message,
            cm.reply_to,
            cm.created_at,
            rm.id as reply_to_id,
            rm.user_id as reply_to_user_id,
            rm.username as reply_to_username,
            rm.message as reply_to_message
        FROM chat_messages cm
        LEFT JOIN chat_messages rm ON rm.id = cm.reply_to
        ORDER BY cm.id DESC
        LIMIT 50
    ", []);
    
    // عكس الترتيب (الأقدم أولاً)
    $messages = array_reverse($messages);
    
    // تنسيق البيانات
    $formattedMessages = [];
    foreach ($messages as $message) {
        $formattedMessage = [
            'id' => $message['id'],
            'user_id' => $message['user_id'],
            'username' => $message['username'],
            'message' => $message['message'],
            'created_at' => $message['created_at']
        ];
        
        // إضافة معلومات الرد إذا كان موجوداً
        if (!empty($message['reply_to'])) {
            $formattedMessage['reply_to'] = [
                'id' => $message['reply_to_id'],
                'user_id' => $message['reply_to_user_id'],
                'username' => $message['reply_to_username'],
                'message' => $message['reply_to_message']
            ];
        }
        
        $formattedMessages[] = $formattedMessage;
    }
    
    response(true, 'تم جلب الرسائل بنجاح', $formattedMessages);
    
} catch (Exception $e) {
    error_log('خطأ في get_messages.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في جلب الرسائل: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في get_messages.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في جلب الرسائل', null, 500);
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
?>


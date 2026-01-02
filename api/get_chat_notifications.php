<?php
/**
 * API لجلب الإشعارات المحفوظة من chat_pending_notifications
 * يتم استدعاؤه عند تحميل الصفحة أو عند فحص الإشعارات
 */
require_once __DIR__ . '/config.php';

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // التأكد من وجود جدول chat_pending_notifications
    if (!dbTableExists('chat_pending_notifications')) {
        response(true, 'لا توجد إشعارات', []);
        exit;
    }
    
    // جلب الإشعارات المعلقة للمستخدم
    $pendingNotifications = dbSelect("
        SELECT 
            cpn.id,
            cpn.message_id,
            cpn.created_at,
            cm.user_id,
            COALESCE(u.name, u.username, 'مستخدم') as username,
            u.avatar,
            cm.message,
            cm.file_type,
            cm.file_name
        FROM chat_pending_notifications cpn
        INNER JOIN chat_messages cm ON cm.id = cpn.message_id
        LEFT JOIN users u ON u.id = cm.user_id
        WHERE cpn.user_id = ?
        AND (cm.deleted_at IS NULL OR cm.deleted_at = '')
        ORDER BY cpn.created_at DESC
        LIMIT 50
    ", [$userId]);
    
    if ($pendingNotifications === false) {
        response(false, 'خطأ في جلب الإشعارات', null, 500);
        exit;
    }
    
    // تنسيق البيانات
    $formattedNotifications = [];
    foreach ($pendingNotifications as $notification) {
        // تخطي الإشعارات من المستخدم نفسه (للحماية الإضافية)
        if ($notification['user_id'] == $userId) {
            continue;
        }
        
        $formattedNotifications[] = [
            'id' => $notification['message_id'],
            'user_id' => $notification['user_id'],
            'username' => $notification['username'] ?? 'مستخدم',
            'avatar' => $notification['avatar'] ?? null,
            'message' => $notification['message'] ?? '',
            'file_type' => $notification['file_type'] ?? null,
            'file_name' => $notification['file_name'] ?? null,
            'created_at' => $notification['created_at']
        ];
    }
    
    // مسح الإشعارات المعلقة بعد جلبها (تم قراءتها)
    if (!empty($formattedNotifications)) {
        $messageIds = array_column($formattedNotifications, 'id');
        if (!empty($messageIds)) {
            $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
            dbExecute("
                DELETE FROM chat_pending_notifications 
                WHERE user_id = ? AND message_id IN ($placeholders)
            ", array_merge([$userId], $messageIds));
        }
    }
    
    response(true, 'تم جلب الإشعارات بنجاح', $formattedNotifications);
    
} catch (Exception $e) {
    error_log('خطأ في get_chat_notifications.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في جلب الإشعارات: ' . $e->getMessage(), null, 500);
}
?>

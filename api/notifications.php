<?php
/**
 * API لجلب وإدارة الإشعارات
 */
require_once __DIR__ . '/config.php';

try {
    $method = getRequestMethod();
    $data = getRequestData();
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // التأكد من وجود جدول notifications
    if (!dbTableExists('notifications')) {
        // محاولة إنشاء الجدول
        $conn = getDBConnection();
        if ($conn) {
            $sql = "
                CREATE TABLE IF NOT EXISTS `notifications` (
                  `id` varchar(50) NOT NULL,
                  `user_id` varchar(50) NOT NULL,
                  `type` varchar(50) NOT NULL DEFAULT 'mention',
                  `title` varchar(255) NOT NULL,
                  `message` text NOT NULL,
                  `related_id` varchar(50) DEFAULT NULL,
                  `is_read` tinyint(1) DEFAULT 0,
                  `created_at` datetime NOT NULL,
                  PRIMARY KEY (`id`),
                  KEY `idx_user_id` (`user_id`),
                  KEY `idx_type` (`type`),
                  KEY `idx_is_read` (`is_read`),
                  KEY `idx_created_at` (`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            $conn->query($sql);
        }
    }
    
    // جلب الإشعارات
    if ($method === 'GET') {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $unreadOnly = isset($_GET['unread_only']) && $_GET['unread_only'] === 'true';
        
        $query = "SELECT * FROM notifications WHERE user_id = ?";
        $params = [$userId];
        
        if ($unreadOnly) {
            $query .= " AND is_read = 0";
        }
        
        $query .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;
        
        $notifications = dbSelect($query, $params);
        
        if ($notifications === false) {
            response(false, 'خطأ في جلب الإشعارات', null, 500);
        }
        
        // تنسيق البيانات
        $formattedNotifications = [];
        foreach ($notifications as $notification) {
            $formattedNotifications[] = [
                'id' => $notification['id'],
                'type' => $notification['type'],
                'title' => $notification['title'],
                'message' => $notification['message'],
                'related_id' => $notification['related_id'],
                'is_read' => (bool)$notification['is_read'],
                'created_at' => $notification['created_at']
            ];
        }
        
        // جلب عدد الإشعارات غير المقروءة
        $unreadCount = dbSelectOne("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0", [$userId]);
        $unreadCount = $unreadCount ? (int)$unreadCount['count'] : 0;
        
        response(true, 'تم جلب الإشعارات بنجاح', [
            'notifications' => $formattedNotifications,
            'unread_count' => $unreadCount
        ]);
    }
    
    // تحديث حالة الإشعار (قراءة/حذف)
    if ($method === 'PUT') {
        $notificationId = $data['id'] ?? null;
        $action = $data['action'] ?? 'read'; // 'read' or 'delete'
        
        if (!$notificationId) {
            response(false, 'معرف الإشعار مطلوب', null, 400);
        }
        
        // التحقق من أن الإشعار يخص المستخدم الحالي
        $notification = dbSelectOne("SELECT * FROM notifications WHERE id = ? AND user_id = ?", [$notificationId, $userId]);
        if (!$notification) {
            response(false, 'الإشعار غير موجود أو لا يخصك', null, 404);
        }
        
        if ($action === 'read') {
            // تحديث حالة القراءة
            $result = dbExecute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [$notificationId, $userId]);
            if ($result) {
                response(true, 'تم تحديث حالة الإشعار', ['is_read' => true]);
            } else {
                response(false, 'فشل تحديث حالة الإشعار', null, 500);
            }
        } elseif ($action === 'delete') {
            // حذف الإشعار
            $result = dbExecute("DELETE FROM notifications WHERE id = ? AND user_id = ?", [$notificationId, $userId]);
            if ($result) {
                response(true, 'تم حذف الإشعار', ['deleted' => true]);
            } else {
                response(false, 'فشل حذف الإشعار', null, 500);
            }
        } else {
            response(false, 'إجراء غير صحيح', null, 400);
        }
    }
    
    // تحديد جميع الإشعارات كمقروءة
    if ($method === 'POST' && isset($data['action']) && $data['action'] === 'mark_all_read') {
        $result = dbExecute("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [$userId]);
        if ($result) {
            response(true, 'تم تحديد جميع الإشعارات كمقروءة', ['marked' => true]);
        } else {
            response(false, 'فشل تحديث الإشعارات', null, 500);
        }
    }
    
    response(false, 'طريقة غير مدعومة', null, 405);
    
} catch (Exception $e) {
    error_log('خطأ في notifications.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في معالجة الإشعارات: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في notifications.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في معالجة الإشعارات', null, 500);
}
?>


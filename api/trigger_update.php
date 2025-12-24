<?php
/**
 * Endpoint لاستدعاء تحديث الشات لكل مستخدم نشط
 * يتم استدعاؤه من send_message.php بعد إرسال رسالة جديدة
 */
require_once __DIR__ . '/config.php';

try {
    // التحقق من أن الطلب من السيرفر نفسه (أمان)
    $serverKey = $_GET['key'] ?? '';
    $expectedKey = md5('chat_update_trigger_' . date('Y-m-d-H'));
    
    if ($serverKey !== $expectedKey) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'غير مصرح']);
        exit;
    }
    
    $messageId = $_GET['message_id'] ?? '';
    if (empty($messageId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'معرف الرسالة مطلوب']);
        exit;
    }
    
    // الحصول على جميع المستخدمين النشطين
    $activeUsers = dbSelect("
        SELECT user_id 
        FROM active_users 
        WHERE is_online = 1 
        AND last_activity >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        ORDER BY last_activity DESC
    ", []);
    
    if (empty($activeUsers)) {
        echo json_encode(['success' => true, 'message' => 'لا يوجد مستخدمون نشطون', 'notified' => 0]);
        exit;
    }
    
    // إضافة إشعار معلق لكل مستخدم نشط
    ensureChatNotificationsTable();
    $notifiedCount = 0;
    
    foreach ($activeUsers as $user) {
        $notificationId = generateId();
        try {
            dbExecute("
                INSERT INTO chat_pending_notifications (id, user_id, message_id, created_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE created_at = NOW()
            ", [$notificationId, $user['user_id'], $messageId]);
            $notifiedCount++;
        } catch (Exception $e) {
            error_log('خطأ في إضافة إشعار للمستخدم ' . $user['user_id'] . ': ' . $e->getMessage());
        }
    }
    
    echo json_encode([
        'success' => true, 
        'message' => "تم إشعار {$notifiedCount} مستخدم نشط",
        'notified' => $notifiedCount
    ]);
    
} catch (Exception $e) {
    error_log('خطأ في trigger_update.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'حدث خطأ']);
}

/**
 * التأكد من وجود جدول active_users
 */
function ensureActiveUsersTable() {
    if (!dbTableExists('active_users')) {
        $conn = getDBConnection();
        if ($conn) {
            $sql = "
                CREATE TABLE IF NOT EXISTS `active_users` (
                  `user_id` varchar(50) NOT NULL,
                  `last_activity` datetime NOT NULL,
                  `is_online` tinyint(1) DEFAULT 1,
                  PRIMARY KEY (`user_id`),
                  KEY `idx_last_activity` (`last_activity`),
                  KEY `idx_is_online` (`is_online`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            if (!$conn->query($sql)) {
                error_log("خطأ في إنشاء جدول active_users: " . $conn->error);
                return false;
            }
        }
    }
    return true;
}

/**
 * التأكد من وجود جدول chat_pending_notifications
 */
function ensureChatNotificationsTable() {
    try {
        if (!dbTableExists('chat_pending_notifications')) {
            $conn = getDBConnection();
            if ($conn) {
                $sql = "
                    CREATE TABLE IF NOT EXISTS `chat_pending_notifications` (
                      `id` varchar(50) NOT NULL,
                      `user_id` varchar(50) NOT NULL,
                      `message_id` varchar(50) NOT NULL,
                      `created_at` datetime NOT NULL,
                      PRIMARY KEY (`id`),
                      UNIQUE KEY `unique_user_message` (`user_id`, `message_id`),
                      KEY `idx_user_id` (`user_id`),
                      KEY `idx_message_id` (`message_id`),
                      KEY `idx_created_at` (`created_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                if (!$conn->query($sql)) {
                    error_log("خطأ في إنشاء جدول chat_pending_notifications: " . $conn->error);
                    return false;
                }
            }
        }
        return true;
    } catch (Exception $e) {
        error_log('خطأ في ensureChatNotificationsTable: ' . $e->getMessage());
        return false;
    }
}
?>


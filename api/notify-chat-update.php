<?php
/**
 * API لتحديث محتويات الشات لجميع المستخدمين المسجلين دخولهم
 * يتم استدعاؤه تلقائياً بعد إرسال أي رسالة جديدة في الشات
 * 
 * هذا API مقترن تماماً بنظام الرسائل - يتم استدعاؤه من send_message.php
 * مباشرة بعد حفظ الرسالة في قاعدة البيانات
 * 
 * يمكن استخدامه بطريقتين:
 * 1. استدعاء مباشر للدالة notifyAllUsersForChatUpdate() من PHP
 * 2. HTTP request إلى api/notify-chat-update.php
 */
require_once __DIR__ . '/config.php';

// ✅ التحقق من أن الملف يتم تنفيذه كـ HTTP request وليس function call
// إذا كان لا يتم تنفيذ مباشرة من PHP (مثل require_once)، تخطي HTTP handling
if (!defined('NOTIFY_CHAT_UPDATE_SKIP_HTTP') && php_sapi_name() !== 'cli') {
    try {
        // التحقق من أن الطلب POST أو GET (للأمان)
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        
        // السماح بالاستدعاء المباشر من PHP أو HTTP request
        // إذا كان HTTP request، التحقق من authentication
        if ($method === 'POST' || isset($_GET['message_id'])) {
            // الحصول على message_id من الطلب
            $messageId = $_POST['message_id'] ?? $_GET['message_id'] ?? '';
            $senderId = $_POST['sender_id'] ?? $_GET['sender_id'] ?? '';
            
            if (empty($messageId)) {
                response(false, 'معرف الرسالة مطلوب', null, 400);
            }
            
            // إذا كان HTTP request، التحقق من authentication
            if ($method === 'POST') {
                try {
                    $session = checkAuth();
                    $currentUserId = $session['user_id'];
                    // يمكن استخدام $currentUserId للتأكد من أن المستخدم مسجل دخول
                } catch (Exception $e) {
                    // إذا فشل authentication، السماح بالاستدعاء إذا كان هناك server key
                    $serverKey = $_POST['server_key'] ?? $_GET['server_key'] ?? '';
                    $expectedKey = md5('chat_update_' . date('Y-m-d-H'));
                    if ($serverKey !== $expectedKey) {
                        response(false, 'غير مصرح بالوصول', null, 403);
                    }
                }
            }
            
            // استدعاء الدالة لتحديث الشات لجميع المستخدمين
            $result = notifyAllUsersForChatUpdate($messageId, $senderId);
            
            response(true, 'تم تحديث الشات لجميع المستخدمين بنجاح', $result);
        } else {
            response(false, 'طريقة الطلب غير مدعومة', null, 405);
        }
        
    } catch (Exception $e) {
        error_log('خطأ في notify-chat-update.php: ' . $e->getMessage());
        response(false, 'حدث خطأ في تحديث الشات: ' . $e->getMessage(), null, 500);
    } catch (Error $e) {
        error_log('خطأ قاتل في notify-chat-update.php: ' . $e->getMessage());
        response(false, 'حدث خطأ قاتل في تحديث الشات', null, 500);
    }
    
    // ✅ إيقاف التنفيذ بعد معالجة HTTP request
    exit;
}

/**
 * إشعار جميع المستخدمين المسجلين دخولهم بتحديث الشات
 * هذه الدالة يمكن استدعاؤها مباشرة من send_message.php
 * 
 * @param string $messageId معرف الرسالة الجديدة
 * @param string $senderId معرف المستخدم المرسل (للتجاهل)
 * @return array معلومات عن عملية الإشعار
 */
function notifyAllUsersForChatUpdate($messageId, $senderId = '') {
    try {
        // التأكد من وجود جدول الإشعارات المعلقة
        if (!ensureChatNotificationsTable()) {
            error_log('فشل في التأكد من وجود جدول chat_pending_notifications');
            return ['notified' => 0, 'error' => 'فشل في إنشاء الجدول'];
        }
        
        // الحصول على جميع المستخدمين المسجلين في النظام (ما عدا المرسل)
        $allUsers = dbSelect("
            SELECT id 
            FROM users 
            " . (!empty($senderId) ? "WHERE id != ?" : "") . "
            ORDER BY id DESC
        ", !empty($senderId) ? [$senderId] : []);
        
        if (empty($allUsers)) {
            error_log('⚠️ لا يوجد مستخدمون آخرون لإرسال الإشعارات لهم');
            return ['notified' => 0, 'message' => 'لا يوجد مستخدمون آخرون'];
        }
        
        $notifiedCount = 0;
        $errors = [];
        
        // إضافة إشعار معلق لكل مستخدم مسجل في النظام
        foreach ($allUsers as $user) {
            $notificationId = generateId();
            try {
                dbExecute("
                    INSERT INTO chat_pending_notifications (id, user_id, message_id, created_at)
                    VALUES (?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE created_at = NOW()
                ", [$notificationId, $user['id'], $messageId]);
                $notifiedCount++;
            } catch (Exception $e) {
                // تجاهل الأخطاء في حالة التكرار
                $errors[] = 'خطأ في إضافة إشعار للمستخدم ' . $user['id'] . ': ' . $e->getMessage();
                error_log('خطأ في إضافة إشعار للمستخدم ' . $user['id'] . ': ' . $e->getMessage());
            }
        }
        
        error_log("✅ تم إشعار {$notifiedCount} مستخدم بتحديث الشات - رسالة: {$messageId}");
        
        return [
            'notified' => $notifiedCount,
            'total_users' => count($allUsers),
            'message_id' => $messageId,
            'errors' => $errors
        ];
        
    } catch (Exception $e) {
        error_log('خطأ في notifyAllUsersForChatUpdate: ' . $e->getMessage());
        return ['notified' => 0, 'error' => $e->getMessage()];
    }
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

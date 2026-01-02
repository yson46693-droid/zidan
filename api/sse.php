<?php
/**
 * Server-Sent Events (SSE) endpoint للاستماع للرسائل الجديدة
 * بديل أفضل لـ Long Polling - يقلل الضغط على السيرفر بشكل كبير
 */
require_once __DIR__ . '/config.php';

// تعطيل output buffering للـ SSE
while (ob_get_level() > 0) {
    ob_end_clean();
}

// إعداد headers للـ SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // تعطيل buffering في Nginx

// إعدادات HTTP Headers
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://alaa-zidan.free.nf',
    'http://alaa-zidan.free.nf',
    'https://www.alaa-zidan.free.nf',
    'http://www.alaa-zidan.free.nf'
];

if (!empty($requestOrigin)) {
    foreach ($allowedOrigins as $allowedOrigin) {
        if (strpos($requestOrigin, $allowedOrigin) !== false || $requestOrigin === $allowedOrigin) {
            header('Access-Control-Allow-Origin: ' . $requestOrigin);
            header('Access-Control-Allow-Credentials: true');
            break;
        }
    }
}

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // الحصول على last_id من الطلب
    $lastId = $_GET['last_id'] ?? '0';
    
    // إذا كان last_id فارغاً، استخدام '0' كقيمة افتراضية
    if (empty($lastId) || $lastId === '') {
        $lastId = '0';
    }
    
    // تحديث حالة النشاط للمستخدم
    updateUserActivity($userId);
    
    // إرسال رسالة أولية للاتصال
    echo "data: " . json_encode(['type' => 'connected', 'message' => 'تم الاتصال بنجاح'], JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
    
    // إعداد timeout طويل للاتصال المستمر
    set_time_limit(300); // 5 دقائق
    ignore_user_abort(true);
    
    // حلقة SSE - فحص كل ثانية
    $iteration = 0;
    $maxIterations = 300; // 5 دقائق = 300 ثانية
    
    while ($iteration < $maxIterations) {
        // التحقق من انقطاع الاتصال
        if (connection_aborted()) {
            break;
        }
        
        // التحقق من وجود إشعارات معلقة أولاً (أسرع)
        $pendingNotification = checkPendingNotification($userId);
        if ($pendingNotification && isset($pendingNotification['message_id'])) {
            // يوجد إشعار معلق - جلب الرسائل الجديدة فوراً
            $newMessages = getNewMessages($lastId);
            
            if (!empty($newMessages)) {
                // تحديث last_id
                $lastId = $newMessages[count($newMessages) - 1]['id'];
                
                // مسح الإشعارات المعلقة بعد قراءتها
                clearPendingNotifications($userId, $pendingNotification['message_id']);
                
                // إرسال الرسائل الجديدة عبر SSE
                echo "data: " . json_encode([
                    'type' => 'messages',
                    'data' => $newMessages
                ], JSON_UNESCAPED_UNICODE) . "\n\n";
                flush();
                
                // إعادة تعيين العداد بعد إرسال الرسائل
                $iteration = 0;
            }
        } else {
            // فحص قاعدة البيانات مباشرة (كل 3 ثواني لتقليل الضغط)
            if ($iteration % 3 === 0) {
                $newMessages = getNewMessages($lastId);
                
                if (!empty($newMessages)) {
                    // تحديث last_id
                    $lastId = $newMessages[count($newMessages) - 1]['id'];
                    
                    // إرسال الرسائل الجديدة عبر SSE
                    echo "data: " . json_encode([
                        'type' => 'messages',
                        'data' => $newMessages
                    ], JSON_UNESCAPED_UNICODE) . "\n\n";
                    flush();
                    
                    // إعادة تعيين العداد بعد إرسال الرسائل
                    $iteration = 0;
                }
            }
        }
        
        // إرسال heartbeat كل 30 ثانية للحفاظ على الاتصال
        if ($iteration % 30 === 0 && $iteration > 0) {
            echo "data: " . json_encode(['type' => 'heartbeat', 'timestamp' => time()], JSON_UNESCAPED_UNICODE) . "\n\n";
            flush();
        }
        
        // انتظار ثانية واحدة قبل المحاولة التالية
        sleep(1);
        $iteration++;
    }
    
    // إرسال رسالة انتهاء الاتصال
    echo "data: " . json_encode(['type' => 'closed', 'message' => 'انتهى الاتصال'], JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
    
} catch (Exception $e) {
    error_log('خطأ في sse.php: ' . $e->getMessage());
    echo "data: " . json_encode([
        'type' => 'error',
        'message' => 'حدث خطأ في الاتصال: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
} catch (Error $e) {
    error_log('خطأ قاتل في sse.php: ' . $e->getMessage());
    echo "data: " . json_encode([
        'type' => 'error',
        'message' => 'حدث خطأ قاتل في الاتصال'
    ], JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}

/**
 * الحصول على الرسائل الجديدة بعد last_id
 */
function getNewMessages($lastId) {
    try {
        // إذا كان lastId = '0'، جلب آخر 50 رسالة
        if ($lastId === '0' || empty($lastId)) {
            $messages = dbSelect("
                SELECT 
                    cm.id,
                    cm.user_id,
                    COALESCE(u.name, u.username, 'مستخدم') as username,
                    u.avatar,
                    cm.message,
                    cm.reply_to,
                    cm.file_path,
                    cm.file_type,
                    cm.file_name,
                    cm.created_at,
                    rm.id as reply_to_id,
                    rm.user_id as reply_to_user_id,
                    COALESCE(ru.name, ru.username, 'مستخدم') as reply_to_username,
                    rm.message as reply_to_message
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                LEFT JOIN chat_messages rm ON rm.id = cm.reply_to AND (rm.deleted_at IS NULL OR rm.deleted_at = '')
                LEFT JOIN users ru ON ru.id = rm.user_id
                WHERE (cm.deleted_at IS NULL OR cm.deleted_at = '')
                ORDER BY cm.id DESC
                LIMIT 50
            ", []);
            
            // عكس الترتيب (الأقدم أولاً)
            $messages = array_reverse($messages);
        } else {
            // استعلام للحصول على الرسائل الجديدة بعد last_id
            $messages = dbSelect("
                SELECT 
                    cm.id,
                    cm.user_id,
                    COALESCE(u.name, u.username, 'مستخدم') as username,
                    u.avatar,
                    cm.message,
                    cm.reply_to,
                    cm.file_path,
                    cm.file_type,
                    cm.file_name,
                    cm.created_at,
                    rm.id as reply_to_id,
                    rm.user_id as reply_to_user_id,
                    COALESCE(ru.name, ru.username, 'مستخدم') as reply_to_username,
                    rm.message as reply_to_message
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                LEFT JOIN chat_messages rm ON rm.id = cm.reply_to AND (rm.deleted_at IS NULL OR rm.deleted_at = '')
                LEFT JOIN users ru ON ru.id = rm.user_id
                WHERE cm.id > ? AND (cm.deleted_at IS NULL OR cm.deleted_at = '')
                ORDER BY cm.id ASC
                LIMIT 50
            ", [$lastId]);
        }
        
        // تنسيق البيانات
        $formattedMessages = [];
        foreach ($messages as $message) {
            $formattedMessage = [
                'id' => $message['id'],
                'user_id' => $message['user_id'],
                'username' => $message['username'],
                'avatar' => $message['avatar'] ?? null,
                'message' => $message['message'],
                'created_at' => $message['created_at']
            ];
            
            // إضافة معلومات الملف إذا كان موجوداً
            if (!empty($message['file_path']) || !empty($message['file_type'])) {
                $formattedMessage['file_path'] = $message['file_path'] ?? null;
                $formattedMessage['file_type'] = $message['file_type'] ?? 'file';
                // إضافة file_name إذا كان موجوداً
                if (!empty($message['file_name'])) {
                    $formattedMessage['file_name'] = $message['file_name'];
                }
            }
            
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
        
        return $formattedMessages;
        
    } catch (Exception $e) {
        error_log('خطأ في getNewMessages: ' . $e->getMessage());
        return [];
    }
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
 * تحديث حالة النشاط للمستخدم
 */
function updateUserActivity($userId) {
    try {
        // التأكد من وجود الجدول أولاً
        if (!ensureActiveUsersTable()) {
            error_log('فشل في التأكد من وجود جدول active_users');
            return;
        }
        
        // التحقق من وجود المستخدم في active_users
        $existing = dbSelectOne("SELECT * FROM active_users WHERE user_id = ?", [$userId]);
        
        if ($existing) {
            // تحديث last_activity
            dbExecute("
                UPDATE active_users 
                SET last_activity = NOW(), is_online = 1 
                WHERE user_id = ?
            ", [$userId]);
        } else {
            // إضافة المستخدم
            dbExecute("
                INSERT INTO active_users (user_id, last_activity, is_online)
                VALUES (?, NOW(), 1)
                ON DUPLICATE KEY UPDATE last_activity = NOW(), is_online = 1
            ", [$userId]);
        }
    } catch (Exception $e) {
        error_log('خطأ في updateUserActivity: ' . $e->getMessage());
    }
}

/**
 * التحقق من وجود إشعار معلق للمستخدم
 */
function checkPendingNotification($userId) {
    try {
        if (!dbTableExists('chat_pending_notifications')) {
            return null;
        }
        
        $notification = dbSelectOne("
            SELECT * FROM chat_pending_notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        ", [$userId]);
        
        return $notification;
    } catch (Exception $e) {
        error_log('خطأ في checkPendingNotification: ' . $e->getMessage());
        return null;
    }
}

/**
 * مسح الإشعارات المعلقة بعد قراءتها
 */
function clearPendingNotifications($userId, $messageId = null) {
    try {
        if (!dbTableExists('chat_pending_notifications')) {
            return;
        }
        
        if ($messageId) {
            // مسح إشعار محدد
            dbExecute("
                DELETE FROM chat_pending_notifications 
                WHERE user_id = ? AND message_id = ?
            ", [$userId, $messageId]);
        } else {
            // مسح جميع الإشعارات المعلقة للمستخدم
            dbExecute("
                DELETE FROM chat_pending_notifications 
                WHERE user_id = ?
            ", [$userId]);
        }
    } catch (Exception $e) {
        error_log('خطأ في clearPendingNotifications: ' . $e->getMessage());
    }
}
?>


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
    
    // الحصول على last_id من الطلب (اختياري)
    $lastId = $_GET['last_id'] ?? null;
    
    // التأكد من وجود الأعمدة المطلوبة في قاعدة البيانات
    ensureChatMessagesColumns();
    
    // جلب الرسائل
    // إذا كان last_id موجوداً، جلب الرسائل الجديدة فقط بعد هذا ID
    if (!empty($lastId) && $lastId !== '0') {
        $messages = getMessagesQuery($lastId, true);
    } else {
        // جلب آخر 50 رسالة
        $messages = getMessagesQuery(null, false);
    }
    
    // عكس الترتيب (الأقدم أولاً) - فقط إذا كان هناك رسائل
    if (!empty($messages)) {
        $messages = array_reverse($messages);
    } else {
        $messages = [];
    }
    
    // تنسيق البيانات
    $formattedMessages = [];
    foreach ($messages as $message) {
        $formattedMessage = [
            'id' => $message['id'] ?? null,
            'user_id' => $message['user_id'] ?? null,
            'username' => $message['username'] ?? 'مستخدم',
            'avatar' => $message['avatar'] ?? null,
            'message' => $message['message'] ?? '',
            'created_at' => $message['created_at'] ?? date('Y-m-d H:i:s')
        ];
        
        // إضافة معلومات الملف إذا كان موجوداً
        if (!empty($message['file_path']) || !empty($message['file_type'])) {
            $formattedMessage['file_path'] = $message['file_path'] ?? null;
            $formattedMessage['file_type'] = $message['file_type'] ?? 'file';
            // إضافة file_name إذا كان موجوداً
            if (isset($message['file_name']) && !empty($message['file_name'])) {
                $formattedMessage['file_name'] = $message['file_name'];
            }
        }
        
        // إضافة معلومات الرد إذا كان موجوداً
        if (!empty($message['reply_to']) && !empty($message['reply_to_id'])) {
            $formattedMessage['reply_to'] = [
                'id' => $message['reply_to_id'] ?? null,
                'user_id' => $message['reply_to_user_id'] ?? null,
                'username' => $message['reply_to_username'] ?? 'مستخدم',
                'message' => $message['reply_to_message'] ?? ''
            ];
        }
        
        $formattedMessages[] = $formattedMessage;
    }
    
    response(true, 'تم جلب الرسائل بنجاح', $formattedMessages);
    
} catch (Exception $e) {
    error_log('خطأ في get_messages.php: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    response(false, 'حدث خطأ في جلب الرسائل: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في get_messages.php: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    response(false, 'حدث خطأ قاتل في جلب الرسائل', null, 500);
}

/**
 * التأكد من وجود الأعمدة المطلوبة في جدول chat_messages
 */
function ensureChatMessagesColumns() {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return false;
        }
        
        // التحقق من وجود الأعمدة وإضافتها إذا لم تكن موجودة
        $columns = [
            'file_path' => "ALTER TABLE `chat_messages` ADD COLUMN `file_path` varchar(500) DEFAULT NULL AFTER `reply_to`",
            'file_type' => "ALTER TABLE `chat_messages` ADD COLUMN `file_type` varchar(50) DEFAULT NULL AFTER `file_path`",
            'file_name' => "ALTER TABLE `chat_messages` ADD COLUMN `file_name` varchar(255) DEFAULT NULL AFTER `file_type`",
            'deleted_at' => "ALTER TABLE `chat_messages` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `created_at`"
        ];
        
        foreach ($columns as $columnName => $alterSql) {
            $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE '{$columnName}'");
            if ($result && $result->num_rows == 0) {
                try {
                    $conn->query($alterSql);
                } catch (Exception $e) {
                    error_log("خطأ في إضافة عمود {$columnName}: " . $e->getMessage());
                }
            }
        }
        
        return true;
    } catch (Exception $e) {
        error_log('خطأ في ensureChatMessagesColumns: ' . $e->getMessage());
        return false;
    }
}

/**
 * جلب الرسائل مع معالجة الأعمدة المفقودة
 */
function getMessagesQuery($lastId = null, $isNewMessages = false) {
    try {
        // محاولة الجلب مع جميع الأعمدة
        $query = "
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
        ";
        
        if ($isNewMessages && $lastId) {
            $query .= " AND cm.id > ? ORDER BY cm.id ASC LIMIT 50";
            $params = [$lastId];
        } else {
            $query .= " ORDER BY cm.id DESC LIMIT 50";
            $params = [];
        }
        
        return dbSelect($query, $params);
        
    } catch (Exception $e) {
        // إذا فشل بسبب عمود مفقود، محاولة بدون file_name و avatar
        error_log('محاولة جلب الرسائل بدون أعمدة إضافية: ' . $e->getMessage());
        try {
            $query = "
                SELECT 
                    cm.id,
                    cm.user_id,
                    COALESCE(u.name, u.username, 'مستخدم') as username,
                    cm.message,
                    cm.reply_to,
                    cm.file_path,
                    cm.file_type,
                    cm.created_at,
                    rm.id as reply_to_id,
                    rm.user_id as reply_to_user_id,
                    COALESCE(ru.name, ru.username, 'مستخدم') as reply_to_username,
                    rm.message as reply_to_message
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                LEFT JOIN chat_messages rm ON rm.id = cm.reply_to
                LEFT JOIN users ru ON ru.id = rm.user_id
                WHERE 1=1
            ";
            
            // محاولة إضافة شرط deleted_at إذا كان موجوداً
            try {
                $conn = getDBConnection();
                if ($conn) {
                    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE 'deleted_at'");
                    if ($result && $result->num_rows > 0) {
                        $query = str_replace("WHERE 1=1", "WHERE (cm.deleted_at IS NULL OR cm.deleted_at = '')", $query);
                    }
                }
            } catch (Exception $e3) {
                // تجاهل الخطأ
            }
            
            if ($isNewMessages && $lastId) {
                $query .= " AND cm.id > ? ORDER BY cm.id ASC LIMIT 50";
                $params = [$lastId];
            } else {
                $query .= " ORDER BY cm.id DESC LIMIT 50";
                $params = [];
            }
            
            return dbSelect($query, $params);
            
        } catch (Exception $e2) {
            error_log('فشل جلب الرسائل: ' . $e2->getMessage());
            return [];
        }
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
 * ✅ محسّن: يستخدم throttling لتقليل تحديثات قاعدة البيانات (كل 30 ثانية كحد أقصى)
 */
function updateUserActivity($userId) {
    try {
        // ✅ Throttling: تحديث فقط كل 30 ثانية لتقليل الضغط على قاعدة البيانات
        static $lastActivityUpdate = [];
        static $activityUpdateThreshold = 30000; // 30 ثانية بالمللي ثانية
        
        $now = round(microtime(true) * 1000); // milliseconds
        if (isset($lastActivityUpdate[$userId])) {
            $timeSinceLastUpdate = $now - $lastActivityUpdate[$userId];
            if ($timeSinceLastUpdate < $activityUpdateThreshold) {
                return; // تخطي التحديث إذا مر أقل من 30 ثانية
            }
        }
        
        // التأكد من وجود الجدول أولاً
        if (!ensureActiveUsersTable()) {
            error_log('فشل في التأكد من وجود جدول active_users');
            return;
        }
        
        // تحديث timestamp
        $lastActivityUpdate[$userId] = $now;
        
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

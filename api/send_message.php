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
    $fileType = $data['file_type'] ?? null; // 'image', 'file'
    $fileData = $data['file_data'] ?? null; // Base64 encoded file
    $fileName = $data['file_name'] ?? null;
    $mentions = $data['mentions'] ?? [];
    
    // التحقق من وجود الرسالة أو الملف
    if (empty($message) && empty($fileData)) {
        response(false, 'الرسالة أو الملف مطلوب', null, 400);
    }
    
    // التحقق من طول الرسالة (حد أقصى 1000 حرف)
    if (mb_strlen($message) > 1000) {
        response(false, 'الرسالة طويلة جداً. الحد الأقصى 1000 حرف', null, 400);
    }
    
    // فلترة XSS
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    
    // التحقق من وجود الرسالة المراد الرد عليها (إذا كان reply_to موجود)
    $replyToMessage = null;
    $replyToId = null;
    
    if (!empty($replyTo)) {
        // إذا كان reply_to كائن، استخراج ID
        if (is_array($replyTo) && isset($replyTo['id'])) {
            $replyToId = $replyTo['id'];
        } else {
            $replyToId = $replyTo;
        }
        
        // التحقق من وجود الرسالة في قاعدة البيانات
        $replyToMessage = dbSelectOne("
            SELECT 
                cm.id, 
                cm.user_id, 
                COALESCE(u.name, u.username, 'مستخدم') as username, 
                cm.message 
            FROM chat_messages cm
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE cm.id = ? AND (cm.deleted_at IS NULL OR cm.deleted_at = '')
        ", [$replyToId]);
        
        if (!$replyToMessage) {
            response(false, 'الرسالة المراد الرد عليها غير موجودة', null, 404);
        }
    }
    
    // معالجة الملفات والصور
    $filePath = null;
    if (!empty($fileData) && !empty($fileType)) {
        $filePath = saveChatFile($fileData, $fileType, $fileName, $userId);
        if (!$filePath) {
            response(false, 'فشل في حفظ الملف', null, 500);
        }
        
        // إذا كانت صورة وليس هناك نص، إضافة نص افتراضي
        if ($fileType === 'image' && empty($message)) {
            $message = '📷 صورة';
        } elseif ($fileType === 'audio' && empty($message)) {
            $message = '🎤 رسالة صوتية';
        } elseif ($fileType === 'file' && empty($message)) {
            $message = '📎 ملف: ' . ($fileName ?? 'ملف');
        }
    }
    
    // إنشاء معرف فريد للرسالة
    $messageId = generateId();
    
    // التأكد من وجود الأعمدة المطلوبة
    ensureChatMessagesColumns();
    
    // حفظ الرسالة في قاعدة البيانات
    try {
        $result = dbExecute("
            INSERT INTO chat_messages (id, user_id, username, message, reply_to, file_path, file_type, file_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ", [$messageId, $userId, $username, $message, $replyToId, $filePath, $fileType, $fileName]);
    } catch (Exception $e) {
        // إذا فشل بسبب عدم وجود عمود، محاولة إضافته
        error_log('محاولة إضافة الأعمدة المفقودة: ' . $e->getMessage());
        try {
            $conn = getDBConnection();
            if ($conn) {
                // محاولة إضافة الأعمدة المفقودة
                $columns = [
                    'username' => "ALTER TABLE chat_messages ADD COLUMN username VARCHAR(255) DEFAULT NULL",
                    'file_path' => "ALTER TABLE chat_messages ADD COLUMN file_path VARCHAR(500) DEFAULT NULL",
                    'file_type' => "ALTER TABLE chat_messages ADD COLUMN file_type VARCHAR(50) DEFAULT NULL",
                    'file_name' => "ALTER TABLE chat_messages ADD COLUMN file_name VARCHAR(255) DEFAULT NULL"
                ];
                
                foreach ($columns as $columnName => $alterSql) {
                    try {
                        $result = $conn->query("SHOW COLUMNS FROM chat_messages LIKE '{$columnName}'");
                        if ($result && $result->num_rows == 0) {
                            $conn->query($alterSql);
                        }
                    } catch (Exception $e3) {
                        // العمود موجود بالفعل أو خطأ آخر
                    }
                }
                
                // محاولة الإدراج مرة أخرى
                $result = dbExecute("
                    INSERT INTO chat_messages (id, user_id, username, message, reply_to, file_path, file_type, file_name, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ", [$messageId, $userId, $username, $message, $replyToId, $filePath, $fileType, $fileName]);
            } else {
                throw new Exception('فشل الاتصال بقاعدة البيانات');
            }
        } catch (Exception $e2) {
            error_log('فشل الإدراج بعد إضافة الأعمدة: ' . $e2->getMessage());
            // محاولة أخيرة بدون الأعمدة الإضافية
            try {
                $result = dbExecute("
                    INSERT INTO chat_messages (id, user_id, message, reply_to, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                ", [$messageId, $userId, $message, $replyToId]);
                // إذا نجح الإدراج بدون file_path، محاولة تحديثه
                if ($filePath) {
                    try {
                        dbExecute("UPDATE chat_messages SET file_path = ?, file_type = ? WHERE id = ?", 
                            [$filePath, $fileType, $messageId]);
                    } catch (Exception $e3) {
                        error_log('فشل تحديث file_path: ' . $e3->getMessage());
                    }
                }
            } catch (Exception $e3) {
                error_log('فشل الإدراج النهائي: ' . $e3->getMessage());
                response(false, 'فشل إرسال الرسالة', null, 500);
            }
        }
    }
    
    if (!$result) {
        response(false, 'فشل إرسال الرسالة', null, 500);
    }
    
    // تحديث حالة النشاط للمرسل
    updateUserActivity($userId);
    
    // معالجة الـ mentions وإرسال الإشعارات
    if (!empty($mentions) && is_array($mentions)) {
        foreach ($mentions as $mention) {
            if (isset($mention['user_id']) && $mention['user_id'] !== $userId) {
                sendMentionNotification($mention['user_id'], $userId, $username, $message, $messageId);
            }
        }
    }
    
    // ✅ إشعار جميع المستخدمين المسجلين دخولهم بتحديث الشات فوراً
    // استدعاء API تحديث الشات - مقترن تماماً بإرسال الرسائل
    require_once __DIR__ . '/notify-chat-update.php';
    notifyAllUsersForChatUpdate($messageId, $userId);
    
    // إعداد بيانات الرسالة المرسلة
    $sentMessage = [
        'id' => $messageId,
        'user_id' => $userId,
        'username' => $username,
        'message' => $message,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    // إضافة معلومات الملف إذا كان موجوداً
    if ($filePath) {
        $sentMessage['file_path'] = $filePath;
        $sentMessage['file_type'] = $fileType;
        $sentMessage['file_name'] = $fileName;
    }
    
    // إضافة معلومات الرد إذا كان موجوداً
    if ($replyToMessage) {
        $sentMessage['reply_to'] = [
            'id' => $replyToMessage['id'],
            'user_id' => $replyToMessage['user_id'],
            'username' => $replyToMessage['username'],
            'message' => $replyToMessage['message']
        ];
    }
    
    // إضافة معلومات الـ mentions
    if (!empty($mentions)) {
        $sentMessage['mentions'] = $mentions;
    }
    
    // ملاحظة: نظام الإشعارات يعمل الآن من JavaScript في جميع الصفحات
    // باستخدام Browser Notifications API بدون الحاجة لـ VAPID keys
    // النظام يتحقق تلقائياً من الرسائل الجديدة ويعرض الإشعارات
    
    response(true, 'تم إرسال الرسالة بنجاح', $sentMessage);
    
} catch (Exception $e) {
    error_log('خطأ في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في إرسال الرسالة: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في إرسال الرسالة', null, 500);
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
            'username' => "ALTER TABLE `chat_messages` ADD COLUMN `username` varchar(100) DEFAULT NULL AFTER `user_id`",
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
 * حفظ ملف الشات
 */
function saveChatFile($fileData, $fileType, $fileName, $userId) {
    try {
        // تحديد المجلد
        $chatDir = __DIR__ . '/../chat/';
        if ($fileType === 'image') {
            $targetDir = $chatDir . 'images/';
        } elseif ($fileType === 'audio') {
            $targetDir = $chatDir . 'audio/';
        } else {
            $targetDir = $chatDir . 'files/';
        }
        
        // التأكد من وجود المجلد
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0755, true);
        }
        
        // تنظيف بيانات Base64
        $fileData = preg_replace('/^data:[^;]+;base64,/', '', $fileData);
        $fileData = base64_decode($fileData);
        
        if ($fileData === false) {
            throw new Exception('بيانات الملف غير صحيحة');
        }
        
        // إنشاء اسم الملف
        $extension = '';
        if ($fileType === 'image') {
            $extension = '.jpg';
        } elseif ($fileType === 'audio') {
            // ✅ دعم تنسيقات صوتية متعددة (mp3, m4a, mp4, webm, wav)
            if ($fileName) {
                $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
                if (in_array(strtolower($fileExtension), ['mp3', 'm4a', 'mp4', 'webm', 'wav', 'ogg'])) {
                    $extension = '.' . strtolower($fileExtension);
                } else {
                    $extension = '.mp3'; // افتراضي - استخدام mp3 للتوافق العالمي
                }
            } else {
                $extension = '.mp3'; // تنسيق التسجيل الصوتي الافتراضي - استخدام mp3
            }
        } elseif ($fileName) {
            $extension = '.' . pathinfo($fileName, PATHINFO_EXTENSION);
        } else {
            $extension = '.bin';
        }
        
        $filename = 'chat_' . generateId() . $extension;
        $filepath = $targetDir . $filename;
        
        // حفظ الملف
        if (file_put_contents($filepath, $fileData) === false) {
            throw new Exception('فشل في حفظ الملف');
        }
        
        // إرجاع المسار النسبي
        if ($fileType === 'image') {
            return 'chat/images/' . $filename;
        } elseif ($fileType === 'audio') {
            return 'chat/audio/' . $filename;
        } else {
            return 'chat/files/' . $filename;
        }
        
    } catch (Exception $e) {
        error_log('خطأ في saveChatFile: ' . $e->getMessage());
        return null;
    }
}

/**
 * إشعار جميع المستخدمين في الشات بوجود رسالة جديدة
 * يتم استدعاؤه بعد إرسال رسالة جديدة مباشرة
 * يضيف إشعارات معلقة لكل مستخدم (حتى غير النشطين) - يتم فحصها من JavaScript
 */
function notifyActiveChatUsers($messageId, $senderId) {
    try {
        // إنشاء جدول للإشعارات المعلقة إذا لم يكن موجوداً
        if (!ensureChatNotificationsTable()) {
            error_log('فشل في التأكد من وجود جدول chat_pending_notifications');
            return;
        }
        
        // الحصول على جميع المستخدمين (ما عدا المرسل)
        $allUsers = dbSelect("
            SELECT id 
            FROM users 
            WHERE id != ?
            ORDER BY id DESC
        ", [$senderId]);
        
        if (empty($allUsers)) {
            error_log('⚠️ لا يوجد مستخدمون آخرون لإرسال الإشعارات لهم');
            return;
        }
        
        $notifiedCount = 0;
        
        // إضافة إشعار لكل مستخدم (حتى غير النشطين)
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
                error_log('خطأ في إضافة إشعار للمستخدم ' . $user['id'] . ': ' . $e->getMessage());
            }
        }
        
        error_log("✅ تم إشعار {$notifiedCount} مستخدم برسالة جديدة: {$messageId}");
        
    } catch (Exception $e) {
        error_log('خطأ في notifyActiveChatUsers: ' . $e->getMessage());
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

/**
 * إرسال إشعار mention للمستخدم
 */
function sendMentionNotification($mentionedUserId, $senderId, $senderName, $message, $messageId) {
    try {
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
        
        // إنشاء معرف فريد للإشعار
        $notificationId = generateId();
        
        // تقصير الرسالة إذا كانت طويلة
        $shortMessage = mb_strlen($message) > 100 ? mb_substr($message, 0, 100) . '...' : $message;
        
        // حفظ الإشعار في قاعدة البيانات
        $result = dbExecute("
            INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at)
            VALUES (?, ?, 'mention', ?, ?, ?, 0, NOW())
        ", [
            $notificationId,
            $mentionedUserId,
            "تم ذكرك في الشات",
            "تم ذكرك في الشات بواسطة {$senderName}: {$shortMessage}",
            $messageId
        ]);
        
        if ($result) {
            error_log("✅ تم حفظ إشعار mention: User {$mentionedUserId} mentioned by {$senderName} in message {$messageId}");
        } else {
            error_log("❌ فشل حفظ إشعار mention: User {$mentionedUserId} mentioned by {$senderName}");
        }
        
    } catch (Exception $e) {
        error_log('خطأ في إرسال إشعار mention: ' . $e->getMessage());
    }
}

?>


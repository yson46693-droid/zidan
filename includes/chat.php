<?php
/**
 * دوال نظام الشات الجماعي
 */

require_once __DIR__ . '/../api/database.php';

// إنشاء الجداول المطلوبة للشات إذا لم تكن موجودة
function setupChatTables() {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }

    // جدول الرسائل
    $messagesTable = "CREATE TABLE IF NOT EXISTS `messages` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` varchar(50) NOT NULL,
        `message_text` text NOT NULL,
        `reply_to` int(11) DEFAULT NULL,
        `deleted` tinyint(1) DEFAULT 0,
        `edited` tinyint(1) DEFAULT 0,
        `created_at` datetime NOT NULL,
        `updated_at` datetime DEFAULT NULL,
        `read_by_count` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (`id`),
        KEY `idx_user_id` (`user_id`),
        KEY `idx_created_at` (`created_at`),
        KEY `idx_reply_to` (`reply_to`),
        KEY `idx_deleted` (`deleted`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    // جدول قراءة الرسائل
    $readTable = "CREATE TABLE IF NOT EXISTS `message_reads` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `message_id` int(11) NOT NULL,
        `user_id` varchar(50) NOT NULL,
        `read_at` datetime NOT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_read` (`message_id`, `user_id`),
        KEY `idx_message_id` (`message_id`),
        KEY `idx_user_id` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    // جدول حالة المستخدمين (user_status كما في الدليل)
    $statusTable = "CREATE TABLE IF NOT EXISTS `user_status` (
        `user_id` varchar(50) NOT NULL,
        `last_seen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `is_online` tinyint(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (`user_id`),
        KEY `idx_is_online` (`is_online`),
        KEY `idx_last_seen` (`last_seen`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    // إنشاء جدول user_presence القديم إذا لم يكن موجوداً (للتوافق)
    $presenceTable = "CREATE TABLE IF NOT EXISTS `user_presence` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` varchar(50) NOT NULL,
        `is_online` tinyint(1) DEFAULT 0,
        `last_seen` datetime NOT NULL,
        `updated_at` datetime DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_user` (`user_id`),
        KEY `idx_is_online` (`is_online`),
        KEY `idx_last_seen` (`last_seen`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    try {
        $conn->query($messagesTable);
        $conn->query($readTable);
        $conn->query($statusTable);
        $conn->query($presenceTable); // للتوافق مع الكود القديم
        
        // محاولة إضافة read_by_count إذا لم يكن موجوداً
        try {
            $conn->query("ALTER TABLE `messages` ADD COLUMN `read_by_count` int(11) NOT NULL DEFAULT 0");
        } catch (Exception $e) {
            // العمود موجود بالفعل، تجاهل الخطأ
        }
        
        return true;
    } catch (Exception $e) {
        error_log('خطأ في إنشاء جداول الشات: ' . $e->getMessage());
        return false;
    }
}

/**
 * تهيئة مخطط الدردشة (كما في الدليل)
 * يمكن استدعاؤها في بداية كل ملف API
 */
function ensureChatSchema() {
    return setupChatTables();
}

// تهيئة الجداول عند أول استخدام
if (!isset($GLOBALS['chat_tables_setup'])) {
    setupChatTables();
    $GLOBALS['chat_tables_setup'] = true;
}

/**
 * إرسال رسالة جديدة
 */
function sendChatMessage($userId, $messageText, $replyTo = null) {
    if (empty(trim($messageText))) {
        throw new InvalidArgumentException('الرسالة لا يمكن أن تكون فارغة');
    }

    $conn = getDBConnection();
    if (!$conn) {
        throw new RuntimeException('فشل الاتصال بقاعدة البيانات');
    }

    $messageText = trim($messageText);
    if (strlen($messageText) > 5000) {
        throw new InvalidArgumentException('الرسالة طويلة جداً (الحد الأقصى 5000 حرف)');
    }

    // إعداد الاستعلام مع معالجة NULL بشكل صحيح
    if ($replyTo && $replyTo > 0) {
        $stmt = $conn->prepare("INSERT INTO messages (user_id, message_text, reply_to, created_at) VALUES (?, ?, ?, NOW())");
        if (!$stmt) {
            throw new RuntimeException('فشل في إعداد الاستعلام: ' . $conn->error);
        }
        $stmt->bind_param('ssi', $userId, $messageText, $replyTo);
    } else {
        $stmt = $conn->prepare("INSERT INTO messages (user_id, message_text, reply_to, created_at) VALUES (?, ?, NULL, NOW())");
        if (!$stmt) {
            throw new RuntimeException('فشل في إعداد الاستعلام: ' . $conn->error);
        }
        $stmt->bind_param('ss', $userId, $messageText);
    }

    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        error_log('خطأ في إرسال الرسالة: ' . $error);
        throw new RuntimeException('فشل في إرسال الرسالة: ' . $error);
    }

    $messageId = $conn->insert_id;
    $stmt->close();

    return getChatMessageById($messageId);
}

/**
 * جلب رسالة بواسطة ID
 */
function getChatMessageById($messageId) {
    $conn = getDBConnection();
    if (!$conn) {
        return null;
    }

    $stmt = $conn->prepare("
        SELECT m.*, 
               u.name as user_name, 
               u.username,
               r.message_text as reply_text,
               r.user_id as reply_user_id,
               ru.name as reply_user_name,
               COALESCE(m.read_by_count, (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id)) as read_by_count
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN messages r ON m.reply_to = r.id
        LEFT JOIN users ru ON r.user_id = ru.id
        WHERE m.id = ?
    ");

    if (!$stmt) {
        return null;
    }

    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $result = $stmt->get_result();
    $message = $result->fetch_assoc();
    $stmt->close();

    return $message;
}

/**
 * جلب الرسائل
 */
function getChatMessages($since = null, $limit = 50, $userId = null) {
    $conn = getDBConnection();
    if (!$conn) {
        return [];
    }

    $limit = max(1, min($limit, 200));
    $where = "m.deleted = 0";
    $params = [];
    $types = '';

    if ($since) {
        $where .= " AND m.created_at > ?";
        $params[] = $since;
        $types .= 's';
    }

    $query = "
        SELECT m.*, 
               u.name as user_name, 
               u.username,
               r.message_text as reply_text,
               r.user_id as reply_user_id,
               ru.name as reply_user_name,
               COALESCE(m.read_by_count, (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id)) as read_by_count
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN messages r ON m.reply_to = r.id
        LEFT JOIN users ru ON r.user_id = ru.id
        WHERE $where
        ORDER BY m.id DESC
        LIMIT ?
    ";

    $params[] = $limit;
    $types .= 'i';

    $stmt = $conn->prepare($query);
    if (!$stmt) {
        return [];
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $messages = [];

    while ($row = $result->fetch_assoc()) {
        $messages[] = $row;
    }

    $stmt->close();
    return array_reverse($messages); // عكس الترتيب للحصول على الأقدم أولاً
}

/**
 * تحديث رسالة
 */
function updateChatMessage($messageId, $userId, $newText) {
    if (empty(trim($newText))) {
        throw new InvalidArgumentException('الرسالة لا يمكن أن تكون فارغة');
    }

    $conn = getDBConnection();
    if (!$conn) {
        throw new RuntimeException('فشل الاتصال بقاعدة البيانات');
    }

    // التحقق من أن الرسالة تنتمي للمستخدم
    $stmt = $conn->prepare("SELECT user_id, deleted FROM messages WHERE id = ?");
    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $result = $stmt->get_result();
    $message = $result->fetch_assoc();
    $stmt->close();

    if (!$message) {
        throw new InvalidArgumentException('الرسالة غير موجودة');
    }

    if ($message['user_id'] !== $userId) {
        throw new RuntimeException('ليس لديك صلاحية لتعديل هذه الرسالة');
    }

    if ($message['deleted']) {
        throw new RuntimeException('لا يمكن تعديل رسالة محذوفة');
    }

    $newText = trim($newText);
    if (strlen($newText) > 5000) {
        throw new InvalidArgumentException('الرسالة طويلة جداً');
    }

    $stmt = $conn->prepare("UPDATE messages SET message_text = ?, edited = 1, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param('si', $newText, $messageId);

    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('فشل في تحديث الرسالة');
    }

    $stmt->close();
    return getChatMessageById($messageId);
}

/**
 * حذف رسالة (حذف منطقي)
 */
function softDeleteChatMessage($messageId, $userId) {
    $conn = getDBConnection();
    if (!$conn) {
        throw new RuntimeException('فشل الاتصال بقاعدة البيانات');
    }

    // التحقق من أن الرسالة تنتمي للمستخدم
    $stmt = $conn->prepare("SELECT user_id, deleted FROM messages WHERE id = ?");
    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $result = $stmt->get_result();
    $message = $result->fetch_assoc();
    $stmt->close();

    if (!$message) {
        throw new InvalidArgumentException('الرسالة غير موجودة');
    }

    if ($message['user_id'] !== $userId) {
        throw new RuntimeException('ليس لديك صلاحية لحذف هذه الرسالة');
    }

    if ($message['deleted']) {
        return getChatMessageById($messageId);
    }

    $stmt = $conn->prepare("UPDATE messages SET deleted = 1, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param('i', $messageId);

    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('فشل في حذف الرسالة');
    }

    $stmt->close();
    return getChatMessageById($messageId);
}

/**
 * تحديث حالة المستخدم
 * يستخدم user_status (الجديد) مع دعم user_presence (القديم) للتوافق
 */
function updateUserPresence($userId, $isOnline) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }

    $online = $isOnline ? 1 : 0;
    
    // تحديث user_status (الجديد)
    $stmt = $conn->prepare("
        INSERT INTO user_status (user_id, is_online, last_seen)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            is_online = VALUES(is_online),
            last_seen = NOW()
    ");

    if ($stmt) {
        $stmt->bind_param('si', $userId, $online);
        $stmt->execute();
        $stmt->close();
    }
    
    // تحديث user_presence (القديم) للتوافق
    $stmtOld = $conn->prepare("
        INSERT INTO user_presence (user_id, is_online, last_seen, updated_at)
        VALUES (?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
            is_online = VALUES(is_online),
            last_seen = NOW(),
            updated_at = NOW()
    ");

    if ($stmtOld) {
        $stmtOld->bind_param('si', $userId, $online);
        $stmtOld->execute();
        $stmtOld->close();
    }

    return true;
}

/**
 * جلب المستخدمين النشطين
 * يستخدم user_status (الجديد) مع دعم user_presence (القديم) للتوافق
 */
function getActiveUsers() {
    $conn = getDBConnection();
    if (!$conn) {
        error_log('getActiveUsers: فشل الاتصال بقاعدة البيانات');
        return [];
    }

    try {
        // محاولة استخدام user_status أولاً
        $query = "
            SELECT u.id, u.username, u.name,
                   COALESCE(s.is_online, p.is_online, 0) as is_online,
                   COALESCE(s.last_seen, p.last_seen, u.created_at) as last_seen
            FROM users u
            LEFT JOIN user_status s ON u.id = s.user_id
            LEFT JOIN user_presence p ON u.id = p.user_id
            ORDER BY COALESCE(s.is_online, p.is_online, 0) DESC, 
                     COALESCE(s.last_seen, p.last_seen, u.created_at) DESC
        ";

        $result = $conn->query($query);
        if (!$result) {
            error_log('getActiveUsers: خطأ في الاستعلام: ' . $conn->error);
            return [];
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            // التأكد من وجود البيانات الأساسية
            if (!empty($row['id'])) {
                // تحويل is_online إلى رقم صحيح
                $row['is_online'] = (int)($row['is_online'] ?? 0);
                // التأكد من وجود name أو username
                if (empty($row['name']) && !empty($row['username'])) {
                    $row['name'] = $row['username'];
                }
                $users[] = $row;
            }
        }

        error_log('getActiveUsers: تم جلب ' . count($users) . ' مستخدم');
        return $users;
    } catch (Exception $e) {
        error_log('getActiveUsers: خطأ: ' . $e->getMessage());
        return [];
    }
}

/**
 * تحديد رسالة كمقروءة
 * يحدث read_by_count في جدول messages تلقائياً
 */
function markMessageAsRead($messageId, $userId) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }

    // إدراج/تحديث في message_reads
    $stmt = $conn->prepare("
        INSERT INTO message_reads (message_id, user_id, read_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE read_at = NOW()
    ");

    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('is', $messageId, $userId);
    $result = $stmt->execute();
    $stmt->close();
    
    if (!$result) {
        return false;
    }
    
    // تحديث read_by_count في جدول messages
    $updateStmt = $conn->prepare("
        UPDATE messages 
        SET read_by_count = (
            SELECT COUNT(*) 
            FROM message_reads 
            WHERE message_id = ?
        )
        WHERE id = ?
    ");
    
    if ($updateStmt) {
        $updateStmt->bind_param('ii', $messageId, $messageId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    return $result;
}

/**
 * جلب آخر timestamp للرسائل
 */
function getLastMessageTimestamp() {
    $conn = getDBConnection();
    if (!$conn) {
        return null;
    }

    $result = $conn->query("SELECT MAX(created_at) as last_timestamp FROM messages WHERE deleted = 0");
    if (!$result) {
        return null;
    }

    $row = $result->fetch_assoc();
    return $row['last_timestamp'] ?? null;
}

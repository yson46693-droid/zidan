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

    // جدول حالة المستخدمين
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
        $conn->query($presenceTable);
        return true;
    } catch (Exception $e) {
        error_log('خطأ في إنشاء جداول الشات: ' . $e->getMessage());
        return false;
    }
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

    $stmt = $conn->prepare("INSERT INTO messages (user_id, message_text, reply_to, created_at) VALUES (?, ?, ?, NOW())");
    if (!$stmt) {
        throw new RuntimeException('فشل في إعداد الاستعلام');
    }

    $replyToValue = $replyTo && $replyTo > 0 ? $replyTo : null;
    $stmt->bind_param('ssi', $userId, $messageText, $replyToValue);

    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('فشل في إرسال الرسالة');
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
               (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id) as read_by_count
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
               (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id) as read_by_count
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
 */
function updateUserPresence($userId, $isOnline) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }

    $stmt = $conn->prepare("
        INSERT INTO user_presence (user_id, is_online, last_seen, updated_at)
        VALUES (?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
            is_online = VALUES(is_online),
            last_seen = NOW(),
            updated_at = NOW()
    ");

    if (!$stmt) {
        return false;
    }

    $online = $isOnline ? 1 : 0;
    $stmt->bind_param('si', $userId, $online);
    $result = $stmt->execute();
    $stmt->close();

    return $result;
}

/**
 * جلب المستخدمين النشطين
 */
function getActiveUsers() {
    $conn = getDBConnection();
    if (!$conn) {
        return [];
    }

    $query = "
        SELECT u.id, u.username, u.name,
               COALESCE(p.is_online, 0) as is_online,
               COALESCE(p.last_seen, u.created_at) as last_seen
        FROM users u
        LEFT JOIN user_presence p ON u.id = p.user_id
        ORDER BY p.is_online DESC, p.last_seen DESC
    ";

    $result = $conn->query($query);
    if (!$result) {
        return [];
    }

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    return $users;
}

/**
 * تحديد رسالة كمقروءة
 */
function markMessageAsRead($messageId, $userId) {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }

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

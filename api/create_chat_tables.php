<?php
/**
 * إنشاء جداول الشات
 */
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/config.php';

function createChatTables() {
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    $tables = [
        'chat_rooms' => "
            CREATE TABLE IF NOT EXISTS `chat_rooms` (
              `id` varchar(50) NOT NULL,
              `name` varchar(255) DEFAULT NULL,
              `type` enum('group','private') NOT NULL DEFAULT 'group',
              `created_by` varchar(50) NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_type` (`type`),
              KEY `idx_created_by` (`created_by`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_participants' => "
            CREATE TABLE IF NOT EXISTS `chat_participants` (
              `id` varchar(50) NOT NULL,
              `room_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `joined_at` datetime NOT NULL,
              `last_read_at` datetime DEFAULT NULL,
              `unread_count` int(11) DEFAULT 0,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_room_user` (`room_id`, `user_id`),
              KEY `idx_room_id` (`room_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_unread_count` (`unread_count`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_messages' => "
            CREATE TABLE IF NOT EXISTS `chat_messages` (
              `id` varchar(50) NOT NULL,
              `room_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `message` text NOT NULL,
              `message_type` enum('text','image','file','voice','audio','location') NOT NULL DEFAULT 'text',
              `file_url` text DEFAULT NULL,
              `reply_to` varchar(50) DEFAULT NULL,
              `edited_at` datetime DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `deleted_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_room_id` (`room_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_deleted_at` (`deleted_at`),
              KEY `idx_reply_to` (`reply_to`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'chat_reactions' => "
            CREATE TABLE IF NOT EXISTS `chat_reactions` (
              `id` varchar(50) NOT NULL,
              `message_id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `reaction_type` varchar(20) NOT NULL DEFAULT 'like',
              `created_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_message_user_reaction` (`message_id`, `user_id`, `reaction_type`),
              KEY `idx_message_id` (`message_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_reaction_type` (`reaction_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "
    ];
    
    $created = [];
    foreach ($tables as $tableName => $sql) {
        if ($conn->query($sql)) {
            $created[] = $tableName;
        } else {
            error_log("خطأ في إنشاء جدول $tableName: " . $conn->error);
        }
    }
    
    // تحديث جدول chat_messages لإضافة الأعمدة الجديدة
    updateChatMessagesTable($conn);
    
    return $created;
}

// تحديث جدول chat_messages لإضافة الأعمدة الجديدة
function updateChatMessagesTable($conn) {
    if (!$conn) return;
    
    // التحقق من وجود الأعمدة وإضافتها إذا لم تكن موجودة
    $columns = [
        'reply_to' => "ALTER TABLE `chat_messages` ADD COLUMN IF NOT EXISTS `reply_to` varchar(50) DEFAULT NULL AFTER `file_url`, ADD KEY IF NOT EXISTS `idx_reply_to` (`reply_to`)",
        'edited_at' => "ALTER TABLE `chat_messages` ADD COLUMN IF NOT EXISTS `edited_at` datetime DEFAULT NULL AFTER `reply_to`"
    ];
    
    // التحقق من وجود العمود reply_to
    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE 'reply_to'");
    if ($result->num_rows == 0) {
        $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `reply_to` varchar(50) DEFAULT NULL AFTER `file_url`, ADD KEY `idx_reply_to` (`reply_to`)");
    }
    
    // التحقق من وجود العمود edited_at
    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE 'edited_at'");
    if ($result->num_rows == 0) {
        $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `edited_at` datetime DEFAULT NULL AFTER `reply_to`");
    }
    
    // تحديث message_type لدعم 'audio' و 'image' و 'location'
    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` WHERE Field = 'message_type'");
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        if (strpos($row['Type'], 'audio') === false || strpos($row['Type'], 'image') === false || strpos($row['Type'], 'location') === false) {
            $conn->query("ALTER TABLE `chat_messages` MODIFY COLUMN `message_type` enum('text','image','file','voice','audio','location') NOT NULL DEFAULT 'text'");
        }
    }
}

// تنفيذ إنشاء الجداول (سيتم استدعاؤها من chat.php)
// لا ننفذها هنا مباشرة لتجنب التنفيذ المتكرر
?>


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
              `message_type` enum('text','image','file','voice') NOT NULL DEFAULT 'text',
              `file_url` text DEFAULT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              `deleted_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_room_id` (`room_id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_deleted_at` (`deleted_at`)
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
    
    return $created;
}

// تنفيذ إنشاء الجداول (سيتم استدعاؤها من chat.php)
// لا ننفذها هنا مباشرة لتجنب التنفيذ المتكرر
?>


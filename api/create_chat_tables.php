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
              `user_id` varchar(50) NOT NULL,
              `username` varchar(100) NOT NULL,
              `message` text NOT NULL,
              `reply_to` varchar(50) DEFAULT NULL,
              `created_at` datetime NOT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_user_id` (`user_id`),
              KEY `idx_created_at` (`created_at`),
              KEY `idx_reply_to` (`reply_to`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'push_subscriptions' => "
            CREATE TABLE IF NOT EXISTS `push_subscriptions` (
              `id` varchar(50) NOT NULL,
              `user_id` varchar(50) NOT NULL,
              `endpoint` text NOT NULL,
              `p256dh` text NOT NULL,
              `auth` text NOT NULL,
              `created_at` datetime NOT NULL,
              `updated_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_user_endpoint` (`user_id`, `endpoint`(255)),
              KEY `idx_user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        'active_users' => "
            CREATE TABLE IF NOT EXISTS `active_users` (
              `user_id` varchar(50) NOT NULL,
              `last_activity` datetime NOT NULL,
              `is_online` tinyint(1) DEFAULT 1,
              PRIMARY KEY (`user_id`),
              KEY `idx_last_activity` (`last_activity`),
              KEY `idx_is_online` (`is_online`)
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
    
    // تحديث جدول chat_messages الموجود (إذا كان موجوداً)
    updateChatMessagesTable($conn);
    
    // إنشاء الجداول الجديدة
    createNewChatTables($conn);
    
    return $created;
}

// إنشاء الجداول الجديدة
function createNewChatTables($conn) {
    if (!$conn) return;
    
    // إنشاء جدول push_subscriptions
    $pushSubscriptionsSQL = "
        CREATE TABLE IF NOT EXISTS `push_subscriptions` (
          `id` varchar(50) NOT NULL,
          `user_id` varchar(50) NOT NULL,
          `endpoint` text NOT NULL,
          `p256dh` text NOT NULL,
          `auth` text NOT NULL,
          `created_at` datetime NOT NULL,
          `updated_at` datetime DEFAULT NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `unique_user_endpoint` (`user_id`, `endpoint`(255)),
          KEY `idx_user_id` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    if (!$conn->query($pushSubscriptionsSQL)) {
        error_log("خطأ في إنشاء جدول push_subscriptions: " . $conn->error);
    }
    
    // إنشاء جدول active_users
    $activeUsersSQL = "
        CREATE TABLE IF NOT EXISTS `active_users` (
          `user_id` varchar(50) NOT NULL,
          `last_activity` datetime NOT NULL,
          `is_online` tinyint(1) DEFAULT 1,
          PRIMARY KEY (`user_id`),
          KEY `idx_last_activity` (`last_activity`),
          KEY `idx_is_online` (`is_online`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    if (!$conn->query($activeUsersSQL)) {
        error_log("خطأ في إنشاء جدول active_users: " . $conn->error);
    }
}

// تحديث جدول chat_messages الموجود (للترقية من النسخة القديمة)
function updateChatMessagesTable($conn) {
    if (!$conn) return;
    
    // التحقق من وجود الجدول
    $result = $conn->query("SHOW TABLES LIKE 'chat_messages'");
    if ($result->num_rows == 0) {
        return; // الجدول غير موجود، سيتم إنشاؤه بالشكل الجديد
    }
    
    // التحقق من وجود عمود username
    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE 'username'");
    if ($result->num_rows == 0) {
        // إضافة عمود username
        $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `username` varchar(100) NOT NULL DEFAULT '' AFTER `user_id`");
        
        // ملء username من جدول users للرسائل الموجودة
        $conn->query("
            UPDATE chat_messages cm
            INNER JOIN users u ON u.id = cm.user_id
            SET cm.username = COALESCE(u.name, u.username, 'مستخدم')
            WHERE cm.username = '' OR cm.username IS NULL
        ");
    }
    
    // التحقق من وجود عمود reply_to
    $result = $conn->query("SHOW COLUMNS FROM `chat_messages` LIKE 'reply_to'");
    if ($result->num_rows == 0) {
        $conn->query("ALTER TABLE `chat_messages` ADD COLUMN `reply_to` varchar(50) DEFAULT NULL AFTER `message`, ADD KEY `idx_reply_to` (`reply_to`)");
    } else {
        // التأكد من وجود الفهرس
        $indexResult = $conn->query("SHOW INDEX FROM `chat_messages` WHERE Key_name = 'idx_reply_to'");
        if ($indexResult->num_rows == 0) {
            $conn->query("ALTER TABLE `chat_messages` ADD KEY `idx_reply_to` (`reply_to`)");
        }
    }
    
    // ملاحظة: لا نحذف الأعمدة القديمة (room_id, message_type, etc.) لتجنب فقدان البيانات
    // لكن الجدول الجديد لن يستخدمها
}

// تنفيذ إنشاء الجداول (سيتم استدعاؤها من chat.php)
// لا ننفذها هنا مباشرة لتجنب التنفيذ المتكرر
?>


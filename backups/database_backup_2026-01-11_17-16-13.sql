-- Database Backup
-- Date: 2026-01-11 17:16:13

SET AUTOCOMMIT=0;
START TRANSACTION;

DROP TABLE IF EXISTS `accessories`;
CREATE TABLE `accessories` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `accessories` (`id`,`name`,`type`,`image`,`purchase_price`,`selling_price`,`quantity`,`created_at`,`updated_at`,`created_by`) VALUES ('69621bbf581c95.38257127','P9','wireless_headphones','data:image/jpeg;base64,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','10.00','250.00','1','2026-01-10 11:28:31',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `active_users`;
CREATE TABLE `active_users` (
  `user_id` varchar(50) NOT NULL,
  `last_activity` datetime NOT NULL,
  `is_online` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`user_id`),
  KEY `idx_last_activity` (`last_activity`),
  KEY `idx_is_online` (`is_online`),
  KEY `idx_active_users_last_activity` (`last_activity`),
  KEY `idx_active_users_is_online` (`is_online`),
  KEY `idx_active_users_online_activity` (`is_online`,`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `active_users` (`user_id`,`last_activity`,`is_online`) VALUES ('123','2026-01-10 11:53:36','1');
INSERT INTO `active_users` (`user_id`,`last_activity`,`is_online`) VALUES ('6958d64e840c93.35864727','2026-01-10 12:34:19','1');
INSERT INTO `active_users` (`user_id`,`last_activity`,`is_online`) VALUES ('admin_1766045240','2026-01-10 22:29:42','1');
INSERT INTO `active_users` (`user_id`,`last_activity`,`is_online`) VALUES ('696227a37704c9.26838113','2026-01-10 22:55:52','1');

DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) NOT NULL,
  `has_pos` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_name` (`name`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `branches` (`id`,`name`,`code`,`has_pos`,`is_active`,`created_at`,`updated_at`) VALUES ('branch_694e1f2e92b0c2.18292723','الهانوفيل','HANOVIL','1','1','2025-12-26 07:37:50',NULL);
INSERT INTO `branches` (`id`,`name`,`code`,`has_pos`,`is_active`,`created_at`,`updated_at`) VALUES ('branch_694e1f2e9401b1.86979510','البيطاش','BITASH','0','1','2025-12-26 07:37:50',NULL);

DROP TABLE IF EXISTS `brsql`;
CREATE TABLE `brsql` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('1','Samsung',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('2','Apple',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('3','Xiaomi',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('4','Oppo',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('5','vivo',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('6','Huawei',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('7','Realme',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('8','OnePlus',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('9','Google',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('10','Motorola',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('11','Nokia',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('12','Tecno',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('13','Infinix',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('14','Lenovo',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('15','Sony',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('16','Asus',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('17','ZTE',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('18','Meizu',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('19','HTC',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('20','Microsoft',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('21','Acer',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('22','alcatel',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');
INSERT INTO `brsql` (`id`,`name`,`logo`,`deleted_at`,`created_at`,`updated_at`) VALUES ('23','Lava',NULL,NULL,'2025-12-31 00:40:07','2025-12-31 00:40:07');

DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` varchar(50) NOT NULL,
  `room_id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `message` text NOT NULL,
  `reply_to` varchar(50) DEFAULT NULL,
  `message_type` enum('text','image','file','voice') NOT NULL DEFAULT 'text',
  `file_url` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_room_id` (`room_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_chat_messages_id` (`id`),
  KEY `idx_chat_messages_created_at` (`created_at`),
  KEY `idx_chat_messages_deleted_at` (`deleted_at`),
  KEY `idx_chat_messages_id_deleted` (`id`,`deleted_at`),
  KEY `idx_chat_messages_user_id` (`user_id`),
  KEY `idx_chat_messages_room_id` (`room_id`),
  KEY `idx_chat_messages_reply_to` (`reply_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `chat_messages` (`id`,`room_id`,`user_id`,`username`,`message`,`reply_to`,`message_type`,`file_url`,`created_at`,`updated_at`,`deleted_at`,`file_path`,`file_type`,`file_name`) VALUES ('696220580fd077.60253751','','admin_1766045240','م/ علاء زيدان','.',NULL,'text',NULL,'2026-01-10 11:48:08',NULL,NULL,NULL,NULL,NULL);
INSERT INTO `chat_messages` (`id`,`room_id`,`user_id`,`username`,`message`,`reply_to`,`message_type`,`file_url`,`created_at`,`updated_at`,`deleted_at`,`file_path`,`file_type`,`file_name`) VALUES ('69622080d4ec38.63850255','','123','مدير هانوفيل','.................................',NULL,'text',NULL,'2026-01-10 11:48:48',NULL,NULL,NULL,NULL,NULL);
INSERT INTO `chat_messages` (`id`,`room_id`,`user_id`,`username`,`message`,`reply_to`,`message_type`,`file_url`,`created_at`,`updated_at`,`deleted_at`,`file_path`,`file_type`,`file_name`) VALUES ('696220b58d7ba9.93013198','','admin_1766045240','م/ علاء زيدان','🎤 رسالة صوتية',NULL,'text',NULL,'2026-01-10 11:49:41',NULL,NULL,'chat/audio/chat_696220b58d2286.72454373.mp3','audio','audio.mp3');
INSERT INTO `chat_messages` (`id`,`room_id`,`user_id`,`username`,`message`,`reply_to`,`message_type`,`file_url`,`created_at`,`updated_at`,`deleted_at`,`file_path`,`file_type`,`file_name`) VALUES ('696290c311d7c1.14466794','','admin_1766045240','م/ علاء زيدان','🎤 رسالة صوتية',NULL,'text',NULL,'2026-01-10 19:47:47',NULL,NULL,'chat/audio/chat_696290c311a102.69199897.mp3','audio','audio.mp3');
INSERT INTO `chat_messages` (`id`,`room_id`,`user_id`,`username`,`message`,`reply_to`,`message_type`,`file_url`,`created_at`,`updated_at`,`deleted_at`,`file_path`,`file_type`,`file_name`) VALUES ('69629995332e51.40020135','','696227a37704c9.26838113','موظف بيطاش','📦 طلب منتج<br />\nمن: البيطاش<br />\nإلى: الهانوفيل<br />\n<br />\nالمنتج: Samsung A12<br />\n<br />\nالقطع المطلوبة:<br />\n• بطارية: 1<br />\n<br />\nإجمالي: 1 قطعة<br />\nرقم الطلب: REQ202601100001<br />\n',NULL,'text',NULL,'2026-01-10 20:25:25',NULL,NULL,NULL,NULL,NULL);

DROP TABLE IF EXISTS `chat_participants`;
CREATE TABLE `chat_participants` (
  `id` varchar(50) NOT NULL,
  `room_id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `joined_at` datetime NOT NULL,
  `last_read_at` datetime DEFAULT NULL,
  `unread_count` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_room_user` (`room_id`,`user_id`),
  KEY `idx_room_id` (`room_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_unread_count` (`unread_count`),
  KEY `idx_chat_participants_room_id` (`room_id`),
  KEY `idx_chat_participants_user_id` (`user_id`),
  KEY `idx_chat_participants_room_user` (`room_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `chat_pending_notifications`;
CREATE TABLE `chat_pending_notifications` (
  `id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `message_id` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_message` (`user_id`,`message_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_chat_pending_notifications_user_id` (`user_id`),
  KEY `idx_chat_pending_notifications_message_id` (`message_id`),
  KEY `idx_chat_pending_notifications_created_at` (`created_at`),
  KEY `idx_chat_pending_notifications_user_message` (`user_id`,`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622058208ed5.15264334','69587b7e735f36.14967310','696220580fd077.60253751','2026-01-10 11:48:08');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622058212c37.87010641','69531a2daf23d0.32811200','696220580fd077.60253751','2026-01-10 11:48:08');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622058218e66.13261169','6950d17c723f76.57576419','696220580fd077.60253751','2026-01-10 11:48:08');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622080e0bef4.22175704','69587b7e735f36.14967310','69622080d4ec38.63850255','2026-01-10 11:48:48');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622080e16ad5.43931433','69531a2daf23d0.32811200','69622080d4ec38.63850255','2026-01-10 11:48:48');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('69622080e1ee03.74972947','6950d17c723f76.57576419','69622080d4ec38.63850255','2026-01-10 11:48:48');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696220b59f00b2.17439190','69587b7e735f36.14967310','696220b58d7ba9.93013198','2026-01-10 11:49:41');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696220b59fb167.48690285','69531a2daf23d0.32811200','696220b58d7ba9.93013198','2026-01-10 11:49:41');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696220b5a054a0.28651682','6950d17c723f76.57576419','696220b58d7ba9.93013198','2026-01-10 11:49:41');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696290c32103e1.12135991','6958d64e840c93.35864727','696290c311d7c1.14466794','2026-01-10 19:47:47');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696290c3217444.26230676','69587b7e735f36.14967310','696290c311d7c1.14466794','2026-01-10 19:47:47');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696290c321e7c2.57121355','69531a2daf23d0.32811200','696290c311d7c1.14466794','2026-01-10 19:47:47');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696290c3225eb6.40289344','6950d17c723f76.57576419','696290c311d7c1.14466794','2026-01-10 19:47:47');
INSERT INTO `chat_pending_notifications` (`id`,`user_id`,`message_id`,`created_at`) VALUES ('696290c322d756.31620346','123','696290c311d7c1.14466794','2026-01-10 19:47:47');

DROP TABLE IF EXISTS `chat_reactions`;
CREATE TABLE `chat_reactions` (
  `id` varchar(50) NOT NULL,
  `message_id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `reaction_type` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_message_user_reaction` (`message_id`,`user_id`,`reaction_type`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_reaction_type` (`reaction_type`),
  KEY `idx_chat_reactions_message_id` (`message_id`),
  KEY `idx_chat_reactions_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `chat_rooms`;
CREATE TABLE `chat_rooms` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` enum('group','private') NOT NULL DEFAULT 'group',
  `created_by` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_chat_rooms_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `customer_ratings`;
CREATE TABLE `customer_ratings` (
  `id` varchar(50) NOT NULL,
  `customer_id` varchar(50) NOT NULL,
  `sale_id` varchar(50) DEFAULT NULL,
  `rating` tinyint(1) NOT NULL DEFAULT 5,
  `rating_type` enum('transaction','manual') NOT NULL DEFAULT 'transaction',
  `created_at` datetime NOT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_sale_id` (`sale_id`),
  KEY `idx_rating` (`rating`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `customer_ratings_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_ratings_ibfk_2` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `customer_ratings` (`id`,`customer_id`,`sale_id`,`rating`,`rating_type`,`created_at`,`created_by`) VALUES ('69621b269b7767.77508044','MQ1O1R',NULL,'5','manual','2026-01-10 11:25:58','admin_1766045240');
INSERT INTO `customer_ratings` (`id`,`customer_id`,`sale_id`,`rating`,`rating_type`,`created_at`,`created_by`) VALUES ('6962bcc24d1d52.54136430','CICWLB',NULL,'2','transaction','2026-01-10 22:55:30','696227a37704c9.26838113');

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `customer_type` enum('retail','commercial') NOT NULL DEFAULT 'retail',
  `shop_name` varchar(255) DEFAULT NULL,
  `total_debt` decimal(10,2) DEFAULT 0.00,
  `branch_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_name` (`name`),
  KEY `idx_branch_id` (`branch_id`),
  KEY `idx_customer_type` (`customer_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `customers` (`id`,`name`,`phone`,`customer_type`,`shop_name`,`total_debt`,`branch_id`,`notes`,`address`,`created_at`,`updated_at`,`created_by`) VALUES ('CICWLB','1','111111111111111111','retail',NULL,'0.00','branch_694e1f2e9401b1.86979510',NULL,'','2026-01-10 21:37:10',NULL,'696227a37704c9.26838113');
INSERT INTO `customers` (`id`,`name`,`phone`,`customer_type`,`shop_name`,`total_debt`,`branch_id`,`notes`,`address`,`created_at`,`updated_at`,`created_by`) VALUES ('JD7KVF','احمد','01102289090','retail',NULL,'0.00','branch_694e1f2e92b0c2.18292723',NULL,'الهانوفيل','2026-01-10 11:17:16','2026-01-10 11:25:02','admin_1766045240');
INSERT INTO `customers` (`id`,`name`,`phone`,`customer_type`,`shop_name`,`total_debt`,`branch_id`,`notes`,`address`,`created_at`,`updated_at`,`created_by`) VALUES ('MQ1O1R','مهندس / عبدالحليم','01234567890','commercial','حليم ستور','250.00','branch_694e1f2e92b0c2.18292723',NULL,'الهانوفيل','2026-01-10 11:24:41',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `expenses`;
CREATE TABLE `expenses` (
  `id` varchar(50) NOT NULL,
  `type` enum('rent','electricity','salaries','parts','other') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `expense_date` date NOT NULL,
  `branch_id` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_expense_date` (`expense_date`),
  KEY `idx_branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `expenses` (`id`,`type`,`amount`,`description`,`expense_date`,`branch_id`,`created_at`,`updated_at`,`created_by`) VALUES ('6962994d307845.87477344','','1000.00','','2026-01-10','branch_694e1f2e9401b1.86979510','2026-01-10 20:24:13',NULL,'696227a37704c9.26838113');

DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `category` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `inventory` (`id`,`name`,`quantity`,`purchase_price`,`selling_price`,`category`,`created_at`,`updated_at`,`created_by`) VALUES ('7103855','Apple iphone 16 - SN: SN123456','1','100.00','45000.00',NULL,'2026-01-10 11:30:30',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `inventory_requests`;
CREATE TABLE `inventory_requests` (
  `id` varchar(50) NOT NULL,
  `request_number` varchar(50) NOT NULL,
  `from_branch_id` varchar(50) DEFAULT NULL,
  `to_branch_id` varchar(50) NOT NULL,
  `item_type` enum('inventory','spare_part','accessory') NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `items` text DEFAULT NULL,
  `status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  `requested_by` varchar(50) DEFAULT NULL,
  `approved_by` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`),
  KEY `idx_from_branch` (`from_branch_id`),
  KEY `idx_to_branch` (`to_branch_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `inventory_requests` (`id`,`request_number`,`from_branch_id`,`to_branch_id`,`item_type`,`item_id`,`item_name`,`quantity`,`items`,`status`,`requested_by`,`approved_by`,`notes`,`created_at`,`updated_at`) VALUES ('696299952e6ba8.21814057','REQ202601100001','branch_694e1f2e9401b1.86979510','branch_694e1f2e92b0c2.18292723','spare_part','69621ce966c6f6.58644336','Samsung A12','1','[{\"item_type\":\"battery\",\"quantity\":1,\"custom_value\":null}]','pending','696227a37704c9.26838113',NULL,'','2026-01-10 20:25:25',NULL);

DROP TABLE IF EXISTS `loss_operations`;
CREATE TABLE `loss_operations` (
  `id` varchar(50) NOT NULL,
  `repair_number` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `device_type` varchar(100) NOT NULL,
  `problem` text NOT NULL,
  `loss_amount` decimal(10,2) NOT NULL,
  `loss_reason` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_repair_number` (`repair_number`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `message_reads`;
CREATE TABLE `message_reads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_id` int(11) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `read_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_read` (`message_id`,`user_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notifications` (`id`,`user_id`,`type`,`title`,`message`,`related_id`,`is_read`,`created_at`) VALUES ('6962999534fc23.25672507','123','inventory_request','طلب منتج جديد من البيطاش','📦 طلب منتج<br />\nمن: البيطاش<br />\nإلى: الهانوفيل<br />\n<br />\nالمنتج: Samsung A12<br />\n<br />\nالقطع المطلوبة:<br />\n• بطارية: 1<br />\n<br />\nإجمالي: 1 قطعة<br />\nرقم الطلب: REQ202601100001<br />\n','696299952e6ba8.21814057','0','2026-01-10 20:25:25');
INSERT INTO `notifications` (`id`,`user_id`,`type`,`title`,`message`,`related_id`,`is_read`,`created_at`) VALUES ('6962999535f5b8.33638819','6950d17c723f76.57576419','inventory_request','طلب منتج جديد من البيطاش','📦 طلب منتج<br />\nمن: البيطاش<br />\nإلى: الهانوفيل<br />\n<br />\nالمنتج: Samsung A12<br />\n<br />\nالقطع المطلوبة:<br />\n• بطارية: 1<br />\n<br />\nإجمالي: 1 قطعة<br />\nرقم الطلب: REQ202601100001<br />\n','696299952e6ba8.21814057','0','2026-01-10 20:25:25');
INSERT INTO `notifications` (`id`,`user_id`,`type`,`title`,`message`,`related_id`,`is_read`,`created_at`) VALUES ('69629995365701.29221150','69531a2daf23d0.32811200','inventory_request','طلب منتج جديد من البيطاش','📦 طلب منتج<br />\nمن: البيطاش<br />\nإلى: الهانوفيل<br />\n<br />\nالمنتج: Samsung A12<br />\n<br />\nالقطع المطلوبة:<br />\n• بطارية: 1<br />\n<br />\nإجمالي: 1 قطعة<br />\nرقم الطلب: REQ202601100001<br />\n','696299952e6ba8.21814057','0','2026-01-10 20:25:25');
INSERT INTO `notifications` (`id`,`user_id`,`type`,`title`,`message`,`related_id`,`is_read`,`created_at`) VALUES ('6962999536d032.98937369','admin_1766045240','inventory_request','طلب منتج جديد من البيطاش','📦 طلب منتج<br />\nمن: البيطاش<br />\nإلى: الهانوفيل<br />\n<br />\nالمنتج: Samsung A12<br />\n<br />\nالقطع المطلوبة:<br />\n• بطارية: 1<br />\n<br />\nإجمالي: 1 قطعة<br />\nرقم الطلب: REQ202601100001<br />\n','696299952e6ba8.21814057','0','2026-01-10 20:25:25');

DROP TABLE IF EXISTS `phones`;
CREATE TABLE `phones` (
  `id` varchar(50) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `model` varchar(255) NOT NULL,
  `serial_number` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `tax_status` enum('exempt','due') NOT NULL DEFAULT 'exempt',
  `tax_amount` decimal(10,2) DEFAULT 0.00,
  `storage` varchar(50) DEFAULT NULL,
  `ram` varchar(50) DEFAULT NULL,
  `screen_type` varchar(100) DEFAULT NULL,
  `processor` varchar(100) DEFAULT NULL,
  `battery` varchar(50) DEFAULT NULL,
  `battery_percent` int(11) DEFAULT NULL,
  `accessories` text DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `maintenance_history` text DEFAULT NULL,
  `defects` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_brand` (`brand`),
  KEY `idx_model` (`model`),
  KEY `idx_serial_number` (`serial_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `phones` (`id`,`brand`,`model`,`serial_number`,`image`,`tax_status`,`tax_amount`,`storage`,`ram`,`screen_type`,`processor`,`battery`,`battery_percent`,`accessories`,`password`,`maintenance_history`,`defects`,`purchase_price`,`selling_price`,`created_at`,`updated_at`,`created_by`) VALUES ('7103855','Apple','iphone 16','SN123456','data:image/jpeg;base64,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','exempt','0.00','128','6','AMOLED','A15','3700','95','علبه','','مغير بطاريه اصليه','','100.00','45000.00','2026-01-10 11:30:30',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `product_return_items`;
CREATE TABLE `product_return_items` (
  `id` varchar(50) NOT NULL,
  `return_id` varchar(50) NOT NULL,
  `sale_item_id` varchar(50) NOT NULL,
  `item_type` enum('spare_part','accessory','phone','inventory') NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `original_quantity` int(11) NOT NULL DEFAULT 1,
  `returned_quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_damaged` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_return_id` (`return_id`),
  KEY `idx_sale_item_id` (`sale_item_id`),
  KEY `idx_item_type` (`item_type`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_is_damaged` (`is_damaged`),
  CONSTRAINT `product_return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `product_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_return_items_ibfk_2` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `product_returns`;
CREATE TABLE `product_returns` (
  `id` varchar(50) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `sale_id` varchar(50) NOT NULL,
  `sale_number` varchar(50) NOT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `total_returned_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('completed','cancelled') NOT NULL DEFAULT 'completed',
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `return_number` (`return_number`),
  KEY `idx_sale_id` (`sale_id`),
  KEY `idx_sale_number` (`sale_number`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `product_returns_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_returns_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `repair_ratings`;
CREATE TABLE `repair_ratings` (
  `id` varchar(50) NOT NULL,
  `repair_id` varchar(50) DEFAULT NULL,
  `repair_number` varchar(50) NOT NULL,
  `repair_rating` tinyint(1) NOT NULL DEFAULT 5,
  `technician_rating` tinyint(1) NOT NULL DEFAULT 5,
  `comment` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_repair_id` (`repair_id`),
  KEY `idx_repair_number` (`repair_number`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `repair_ratings_ibfk_1` FOREIGN KEY (`repair_id`) REFERENCES `repairs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `repairs`;
CREATE TABLE `repairs` (
  `id` varchar(50) NOT NULL,
  `repair_number` varchar(50) NOT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(50) NOT NULL,
  `device_type` varchar(100) NOT NULL,
  `device_model` varchar(255) DEFAULT NULL,
  `serial_number` varchar(255) DEFAULT NULL,
  `accessories` text DEFAULT NULL,
  `problem` text NOT NULL,
  `repair_type` enum('soft','hard','fast') DEFAULT 'soft',
  `customer_price` decimal(10,2) DEFAULT 0.00,
  `repair_cost` decimal(10,2) DEFAULT 0.00,
  `inspection_cost` decimal(10,2) DEFAULT 0.00,
  `parts_store` varchar(255) DEFAULT NULL,
  `spare_parts_invoices` text DEFAULT NULL,
  `paid_amount` decimal(10,2) DEFAULT 0.00,
  `remaining_amount` decimal(10,2) DEFAULT 0.00,
  `delivery_date` date DEFAULT NULL,
  `device_image` text DEFAULT NULL,
  `status` enum('received','under_inspection','awaiting_customer_approval','customer_approved','in_progress','ready_for_delivery','delivered','cancelled','lost') NOT NULL DEFAULT 'received',
  `inspection_report` text DEFAULT NULL,
  `branch_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `repair_number` (`repair_number`),
  KEY `idx_repair_number` (`repair_number`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_branch_id` (`branch_id`),
  CONSTRAINT `repairs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `repairs` (`id`,`repair_number`,`customer_id`,`customer_name`,`customer_phone`,`device_type`,`device_model`,`serial_number`,`accessories`,`problem`,`repair_type`,`customer_price`,`repair_cost`,`inspection_cost`,`parts_store`,`spare_parts_invoices`,`paid_amount`,`remaining_amount`,`delivery_date`,`device_image`,`status`,`inspection_report`,`branch_id`,`notes`,`created_at`,`updated_at`,`created_by`) VALUES ('6962191ce28518.46881052','CCG4GD','JD7KVF','احمد','01102289090','Samsung','A12','SN123456','جراب','سوفت وير','soft','200.00','50.00','0.00',NULL,NULL,'50.00','150.00','2026-01-10','','delivered',NULL,'branch_694e1f2e92b0c2.18292723','الجهاز به خدوش','2026-01-10 11:17:16','2026-01-10 11:22:14','admin_1766045240');
INSERT INTO `repairs` (`id`,`repair_number`,`customer_id`,`customer_name`,`customer_phone`,`device_type`,`device_model`,`serial_number`,`accessories`,`problem`,`repair_type`,`customer_price`,`repair_cost`,`inspection_cost`,`parts_store`,`spare_parts_invoices`,`paid_amount`,`remaining_amount`,`delivery_date`,`device_image`,`status`,`inspection_report`,`branch_id`,`notes`,`created_at`,`updated_at`,`created_by`) VALUES ('6962aa666a5730.02422554','2BRJIL','CICWLB','1','111111111111111111','Google','fgfhfg','212112','11','122','soft','1000.00','500.00','0.00',NULL,NULL,'500.00','500.00','2026-01-17','','delivered',NULL,'branch_694e1f2e9401b1.86979510','13121','2026-01-10 21:37:10','2026-01-10 22:55:28','6958d64e840c93.35864727');

DROP TABLE IF EXISTS `salary_deductions`;
CREATE TABLE `salary_deductions` (
  `id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('withdrawal','deduction') NOT NULL DEFAULT 'withdrawal',
  `description` text DEFAULT NULL,
  `month_year` date NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_month_year` (`month_year`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `salary_deductions` (`id`,`user_id`,`amount`,`type`,`description`,`month_year`,`created_at`,`updated_at`,`created_by`) VALUES ('69622684dde0a4.95890177','69531a2daf23d0.32811200','1000.00','withdrawal','','2026-01-01','2026-01-10 12:14:28',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
  `id` varchar(50) NOT NULL,
  `sale_id` varchar(50) NOT NULL,
  `item_type` enum('spare_part','accessory','phone','inventory') NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_id` (`sale_id`),
  KEY `idx_item_type` (`item_type`),
  KEY `idx_item_id` (`item_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sale_items` (`id`,`sale_id`,`item_type`,`item_id`,`item_name`,`quantity`,`unit_price`,`total_price`,`created_at`) VALUES ('69621ed2c59f43.23603867','69621ed2c084e7.01405918','accessory','69621bbf581c95.38257127','P9','9','250.00','2250.00','2026-01-10 11:41:38');

DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` varchar(50) NOT NULL,
  `sale_number` varchar(50) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(10,2) NOT NULL DEFAULT 0.00,
  `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `customer_id` varchar(50) DEFAULT NULL,
  `paid_amount` decimal(10,2) DEFAULT 0.00,
  `remaining_amount` decimal(10,2) DEFAULT 0.00,
  `invoice_data` longtext DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sale_number` (`sale_number`),
  KEY `idx_sale_number` (`sale_number`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_customer_id` (`customer_id`),
  CONSTRAINT `sales_ibfk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sales` (`id`,`sale_number`,`total_amount`,`discount`,`tax`,`final_amount`,`customer_id`,`paid_amount`,`remaining_amount`,`invoice_data`,`customer_name`,`customer_phone`,`created_at`,`updated_at`,`created_by`) VALUES ('69621ed2c084e7.01405918','981307','2250.00','0.00','0.00','2250.00','MQ1O1R','2000.00','250.00','{\n    \"sale_id\": \"69621ed2c084e7.01405918\",\n    \"sale_number\": \"981307\",\n    \"created_at\": \"2026-01-10 11:41:38\",\n    \"customer\": {\n        \"id\": \"MQ1O1R\",\n        \"name\": \"مهندس \\/ عبدالحليم\",\n        \"phone\": \"01234567890\"\n    },\n    \"items\": [\n        {\n            \"id\": \"69621ed2c59f43.23603867\",\n            \"sale_id\": \"69621ed2c084e7.01405918\",\n            \"item_type\": \"accessory\",\n            \"item_id\": \"69621bbf581c95.38257127\",\n            \"item_name\": \"P9\",\n            \"quantity\": 9,\n            \"unit_price\": \"250.00\",\n            \"total_price\": \"2250.00\",\n            \"created_at\": \"2026-01-10 11:41:38\"\n        }\n    ],\n    \"amounts\": {\n        \"total_amount\": 2250,\n        \"discount\": 0,\n        \"tax\": 0,\n        \"final_amount\": 2250,\n        \"paid_amount\": 2000,\n        \"remaining_amount\": 250\n    },\n    \"shop_settings\": {\n        \"shop_name\": \"ALAA ZIDAN\",\n        \"shop_phone\": \"03\\/4327726\",\n        \"shop_address\": \"الاسكندريه-العجمي-الهانوفيل-مول بانوراما-الدور الاول\",\n        \"shop_logo\": \"\",\n        \"currency\": \"ج.م\",\n        \"whatsapp_number\": \"01287889000\"\n    },\n    \"created_by_name\": \"م\\/ علاء زيدان\",\n    \"branch_name\": \"الهانوفيل\"\n}','مهندس / عبدالحليم','01234567890','2026-01-10 11:41:38',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('1','shop_name','ALAA ZIDAN','2025-12-18 01:54:09');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('2','shop_phone','03/4327726','2025-12-18 01:54:09');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('3','shop_address','الاسكندريه-العجمي-الهانوفيل-مول بانوراما-الدور الاول','2025-12-18 01:54:09');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('4','shop_logo','','2025-12-18 00:01:53');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('5','low_stock_alert','0','2025-12-18 00:01:53');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('6','currency','ج.م','2025-12-18 01:54:09');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('7','theme','light','2025-12-18 00:01:53');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('8','database_initialized','1','2025-12-26 03:16:08');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('9','whatsapp_number','01287889000','2025-12-27 01:54:34');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('10','shop_name_2','ALAA ZIDAN','2026-01-10 22:30:01');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('11','shop_phone_2','03/3088192','2026-01-10 22:30:01');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('12','shop_address_2','الاسكندريه-العجمي-البيطاش الرئيسيي','2026-01-10 22:30:01');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('13','currency_2','ج.م','2026-01-10 22:30:01');
INSERT INTO `settings` (`id`,`key`,`value`,`updated_at`) VALUES ('14','whatsapp_number_2','000000000000000000','2026-01-10 22:30:01');

DROP TABLE IF EXISTS `spare_part_items`;
CREATE TABLE `spare_part_items` (
  `id` varchar(50) NOT NULL,
  `spare_part_id` varchar(50) NOT NULL,
  `item_type` varchar(100) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `custom_value` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_spare_part_id` (`spare_part_id`),
  KEY `idx_item_type` (`item_type`),
  CONSTRAINT `spare_part_items_ibfk_1` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `spare_part_items` (`id`,`spare_part_id`,`item_type`,`quantity`,`purchase_price`,`selling_price`,`notes`,`custom_value`,`created_at`,`updated_at`) VALUES ('69621ce9676523.40085780','69621ce966c6f6.58644336','battery','2','100.00','250.00','','','2026-01-10 11:33:29',NULL);
INSERT INTO `spare_part_items` (`id`,`spare_part_id`,`item_type`,`quantity`,`purchase_price`,`selling_price`,`notes`,`custom_value`,`created_at`,`updated_at`) VALUES ('69621ce972a3c4.06773601','69621ce966c6f6.58644336','motherboard','1','150.00','200.00','','A127F','2026-01-10 11:33:29',NULL);
INSERT INTO `spare_part_items` (`id`,`spare_part_id`,`item_type`,`quantity`,`purchase_price`,`selling_price`,`notes`,`custom_value`,`created_at`,`updated_at`) VALUES ('69621ce976ed46.42860771','69621ce966c6f6.58644336','screen','1','200.00','350.00','','','2026-01-10 11:33:29',NULL);
INSERT INTO `spare_part_items` (`id`,`spare_part_id`,`item_type`,`quantity`,`purchase_price`,`selling_price`,`notes`,`custom_value`,`created_at`,`updated_at`) VALUES ('69621ce97aa905.68310597','69621ce966c6f6.58644336','earpiece','3','40.00','50.00','','','2026-01-10 11:33:29',NULL);

DROP TABLE IF EXISTS `spare_parts`;
CREATE TABLE `spare_parts` (
  `id` varchar(50) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `model` varchar(255) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_brand` (`brand`),
  KEY `idx_model` (`model`),
  KEY `idx_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `spare_parts` (`id`,`brand`,`model`,`barcode`,`image`,`purchase_price`,`selling_price`,`created_at`,`updated_at`,`created_by`) VALUES ('69621ce966c6f6.58644336','Samsung','A12','Samsung-A12-1768037609410','','0.00','0.00','2026-01-10 11:33:29',NULL,'admin_1766045240');

DROP TABLE IF EXISTS `technician_manual_ratings`;
CREATE TABLE `technician_manual_ratings` (
  `id` varchar(50) NOT NULL,
  `technician_id` varchar(50) NOT NULL,
  `rating` tinyint(1) NOT NULL,
  `note` text DEFAULT NULL,
  `created_by` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_technician_id` (`technician_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `technician_manual_ratings_ibfk_1` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `telegram_backup_config`;
CREATE TABLE `telegram_backup_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(255) DEFAULT NULL,
  `chat_id` varchar(100) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT 0,
  `backup_interval_hours` int(11) DEFAULT 24,
  `notification_enabled` tinyint(1) DEFAULT 1,
  `last_backup_time` datetime DEFAULT NULL,
  `backup_prefix` varchar(50) DEFAULT 'backup_',
  `auto_backup_enabled` tinyint(1) DEFAULT 0,
  `compress_backup` tinyint(1) DEFAULT 1,
  `include_images` tinyint(1) DEFAULT 1,
  `auto_delete_enabled` tinyint(1) DEFAULT 0,
  `retention_days` int(11) DEFAULT 30,
  `max_backup_files` int(11) DEFAULT 10,
  `last_cleanup_time` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `treasury_transactions`;
CREATE TABLE `treasury_transactions` (
  `id` varchar(50) NOT NULL,
  `branch_id` varchar(50) NOT NULL,
  `transaction_type` enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection','normal_return') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `reference_id` varchar(50) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_branch_id` (`branch_id`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reference` (`reference_id`,`reference_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962191ce65f55.12500658','branch_694e1f2e92b0c2.18292723','repair_profit','50.00','مبلغ مدفوع مقدماً - عملية صيانة رقم: CCG4GD','6962191ce28518.46881052','repair','2026-01-10 11:17:16','admin_1766045240');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('69621a3e67b8d8.81364422','branch_694e1f2e92b0c2.18292723','repair_cost','50.00','تكلفة الإصلاح - عملية صيانة رقم: CCG4GD','6962191ce28518.46881052','repair','2026-01-10 11:22:06','admin_1766045240');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('69621a4627d1a0.23565557','branch_694e1f2e92b0c2.18292723','repair_profit','150.00','المبلغ المتبقي - عملية صيانة رقم: CCG4GD','6962191ce28518.46881052','repair','2026-01-10 11:22:14','admin_1766045240');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('69621ed2ca8cf7.78097853','branch_694e1f2e92b0c2.18292723','sales_revenue','2000.00','مبيعات - عميل تجاري (مهندس / عبدالحليم) - المبلغ المدفوع - فاتورة رقم 981307','69621ed2c084e7.01405918','sale','2026-01-10 11:41:38','admin_1766045240');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('69622684df3523.33696704','branch_694e1f2e92b0c2.18292723','withdrawal','1000.00','مسحوبة راتب - فني هانوفيل','69622684dde0a4.95890177','salary_deduction','2026-01-10 12:14:28','admin_1766045240');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962994d31a398.39081537','branch_694e1f2e9401b1.86979510','expense','1000.00','أخرى','6962994d307845.87477344','expense','2026-01-10 20:24:13','696227a37704c9.26838113');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962995892b511.89551955','branch_694e1f2e9401b1.86979510','deposit','1000.00','تسوية رصيد سالب','6962995892b511.89551955','deposit','2026-01-10 20:24:24','696227a37704c9.26838113');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962aa666edf49.32710303','branch_694e1f2e9401b1.86979510','deposit','500.00','مبلغ مدفوع مقدماً - عملية صيانة رقم: 2BRJIL','6962aa666a5730.02422554','repair','2026-01-10 21:37:10','696227a37704c9.26838113');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962ba1487f992.04301149','branch_694e1f2e9401b1.86979510','repair_cost','500.00','تكلفة الإصلاح - عملية صيانة رقم: 2BRJIL','6962aa666a5730.02422554','repair','2026-01-10 22:44:04','696227a37704c9.26838113');
INSERT INTO `treasury_transactions` (`id`,`branch_id`,`transaction_type`,`amount`,`description`,`reference_id`,`reference_type`,`created_at`,`created_by`) VALUES ('6962bcc0788ff6.99341651','branch_694e1f2e9401b1.86979510','deposit','500.00','المبلغ المتبقي - عملية صيانة رقم: 2BRJIL','6962aa666a5730.02422554','repair','2026-01-10 22:55:28','696227a37704c9.26838113');

DROP TABLE IF EXISTS `user_presence`;
CREATE TABLE `user_presence` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `last_seen` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user` (`user_id`),
  KEY `idx_is_online` (`is_online`),
  KEY `idx_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `avatar` text DEFAULT NULL,
  `role` enum('admin','manager','employee','technician') NOT NULL DEFAULT 'employee',
  `branch_id` varchar(50) DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `webauthn_enabled` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('123','2','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','مدير هانوفيل',NULL,'manager','branch_694e1f2e92b0c2.18292723','6000.00','2025-12-28 07:35:30','2025-12-30 23:08:01','0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('6950d17c723f76.57576419','3','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','موظف هانوفيل',NULL,'employee','branch_694e1f2e92b0c2.18292723','4500.00','2025-12-28 08:43:08',NULL,'0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('69531a2daf23d0.32811200','4','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','فني هانوفيل',NULL,'technician','branch_694e1f2e92b0c2.18292723','20000.00','2025-12-30 02:17:50','2026-01-10 12:28:21','0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('69587b7e735f36.14967310','02','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','مدير بيطاش',NULL,'manager','branch_694e1f2e9401b1.86979510','5000.00','2026-01-03 04:14:22','2026-01-03 09:59:36','0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('6958d64e840c93.35864727','04','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','فني بيطاش',NULL,'technician','branch_694e1f2e9401b1.86979510','8000.00','2026-01-03 10:41:50','2026-01-04 04:17:12','0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('696227a37704c9.26838113','03','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','موظف بيطاش',NULL,'employee','branch_694e1f2e9401b1.86979510','0.00','2026-01-10 12:19:15',NULL,'0');
INSERT INTO `users` (`id`,`username`,`password`,`name`,`avatar`,`role`,`branch_id`,`salary`,`created_at`,`updated_at`,`webauthn_enabled`) VALUES ('admin_1766045240','1','$2y$12$a0P7RSZBqNKE.ivxgb.L0OY8In3WBtfzdFBarl6XDtWpo4CaVJwrq','م/ علاء زيدان','avatars/avatar_admin_1766045240_1767156620.jpg','admin',NULL,'0.00','2025-12-18 00:07:20','2026-01-03 03:41:02','1');

DROP TABLE IF EXISTS `webauthn_credentials`;
CREATE TABLE `webauthn_credentials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `credential_id` text NOT NULL,
  `public_key` text NOT NULL,
  `device_name` varchar(255) DEFAULT NULL,
  `counter` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `last_used` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_credential_id` (`credential_id`(255))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `webauthn_credentials` (`id`,`user_id`,`credential_id`,`public_key`,`device_name`,`counter`,`created_at`,`last_used`) VALUES ('2','admin_1766045240','JGtagQrTfPI32UUuBE+0IzC9JOg=','pQECAyYgASFYIMl2sKaNhmLXpjQOIvQTWl8e18VewnLdOzp5eKqig0JpIlggBJKjE+ZYLfWLpoACS1gnnQYGmXLIR1+k+H7cPZlzGLo=','iPhone','17','2026-01-03 03:41:02','2026-01-05 16:45:19');

COMMIT;

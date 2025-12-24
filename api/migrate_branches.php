<?php
/**
 * Migration Script - إضافة نظام الفروع
 * هذا الملف آمن للتشغيل عدة مرات (idempotent)
 */

require_once 'config.php';
require_once 'database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('فشل الاتصال بقاعدة البيانات');
    }
    
    $results = [];
    $errors = [];
    
    // 1. إنشاء جدول الفروع
    $createBranchesTable = "
    CREATE TABLE IF NOT EXISTS `branches` (
      `id` varchar(50) NOT NULL,
      `name` varchar(255) NOT NULL,
      `code` varchar(50) NOT NULL,
      `has_pos` tinyint(1) DEFAULT 1,
      `is_active` tinyint(1) DEFAULT 1,
      `created_at` datetime NOT NULL,
      `updated_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `code` (`code`),
      KEY `idx_code` (`code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    if (dbExecute($createBranchesTable, [])) {
        $results[] = 'تم إنشاء جدول branches';
    } else {
        $errors[] = 'فشل إنشاء جدول branches';
    }
    
    // 2. إدراج الفروع الافتراضية
    $insertBranches = "
    INSERT IGNORE INTO `branches` (`id`, `name`, `code`, `has_pos`, `is_active`, `created_at`) VALUES
    ('branch_hanovil', 'فرع الهانوفيل', 'HANOVIL', 1, 1, NOW()),
    ('branch_bitash', 'فرع البيطاش', 'BITASH', 0, 1, NOW())
    ";
    
    if (dbExecute($insertBranches, [])) {
        $results[] = 'تم إدراج الفروع الافتراضية';
    } else {
        $errors[] = 'فشل إدراج الفروع الافتراضية';
    }
    
    // 3. إضافة branch_id إلى users
    if (!dbColumnExists('users', 'branch_id')) {
        $alterUsers = "ALTER TABLE `users` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `role`";
        if (dbExecute($alterUsers, [])) {
            $results[] = 'تم إضافة branch_id إلى users';
            
            // إضافة الفهرس
            $addIndex = "ALTER TABLE `users` ADD INDEX `idx_branch_id` (`branch_id`)";
            dbExecute($addIndex, []);
            
            // إضافة Foreign Key
            try {
                $addFK = "ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL";
                dbExecute($addFK, []);
            } catch (Exception $e) {
                // قد يكون موجوداً بالفعل
                error_log('ملاحظة: ' . $e->getMessage());
            }
        } else {
            $errors[] = 'فشل إضافة branch_id إلى users';
        }
    } else {
        $results[] = 'عمود branch_id موجود بالفعل في users';
    }
    
    // 4. إضافة branch_id إلى repairs
    if (!dbColumnExists('repairs', 'branch_id')) {
        $alterRepairs = "ALTER TABLE `repairs` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `id`";
        if (dbExecute($alterRepairs, [])) {
            $results[] = 'تم إضافة branch_id إلى repairs';
            
            // إضافة الفهرس
            $addIndex = "ALTER TABLE `repairs` ADD INDEX `idx_branch_id` (`branch_id`)";
            dbExecute($addIndex, []);
            
            // إضافة Foreign Key
            try {
                $addFK = "ALTER TABLE `repairs` ADD CONSTRAINT `repairs_ibfk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL";
                dbExecute($addFK, []);
            } catch (Exception $e) {
                error_log('ملاحظة: ' . $e->getMessage());
            }
        } else {
            $errors[] = 'فشل إضافة branch_id إلى repairs';
        }
    } else {
        $results[] = 'عمود branch_id موجود بالفعل في repairs';
    }
    
    // 5. إضافة branch_id إلى customers
    if (!dbColumnExists('customers', 'branch_id')) {
        $alterCustomers = "ALTER TABLE `customers` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `id`";
        if (dbExecute($alterCustomers, [])) {
            $results[] = 'تم إضافة branch_id إلى customers';
            
            // إضافة الفهرس
            $addIndex = "ALTER TABLE `customers` ADD INDEX `idx_branch_id` (`branch_id`)";
            dbExecute($addIndex, []);
            
            // إضافة Foreign Key
            try {
                $addFK = "ALTER TABLE `customers` ADD CONSTRAINT `customers_ibfk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL";
                dbExecute($addFK, []);
            } catch (Exception $e) {
                error_log('ملاحظة: ' . $e->getMessage());
            }
        } else {
            $errors[] = 'فشل إضافة branch_id إلى customers';
        }
    } else {
        $results[] = 'عمود branch_id موجود بالفعل في customers';
    }
    
    // 6. إضافة branch_id إلى sales
    if (!dbColumnExists('sales', 'branch_id')) {
        $alterSales = "ALTER TABLE `sales` ADD COLUMN `branch_id` varchar(50) DEFAULT NULL AFTER `id`";
        if (dbExecute($alterSales, [])) {
            $results[] = 'تم إضافة branch_id إلى sales';
            
            // إضافة الفهرس
            $addIndex = "ALTER TABLE `sales` ADD INDEX `idx_branch_id` (`branch_id`)";
            dbExecute($addIndex, []);
            
            // إضافة Foreign Key
            try {
                $addFK = "ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL";
                dbExecute($addFK, []);
            } catch (Exception $e) {
                error_log('ملاحظة: ' . $e->getMessage());
            }
        } else {
            $errors[] = 'فشل إضافة branch_id إلى sales';
        }
    } else {
        $results[] = 'عمود branch_id موجود بالفعل في sales';
    }
    
    // 7. إنشاء جدول طلبات قطع الغيار
    $createInventoryRequestsTable = "
    CREATE TABLE IF NOT EXISTS `inventory_requests` (
      `id` varchar(50) NOT NULL,
      `request_number` varchar(50) NOT NULL,
      `from_branch_id` varchar(50) NOT NULL,
      `to_branch_id` varchar(50) NOT NULL,
      `item_type` enum('inventory','spare_part','accessory') NOT NULL,
      `item_id` varchar(50) NOT NULL,
      `item_name` varchar(255) NOT NULL,
      `quantity` int(11) NOT NULL DEFAULT 1,
      `status` enum('pending','approved','rejected','completed') DEFAULT 'pending',
      `requested_by` varchar(50) NOT NULL,
      `approved_by` varchar(50) DEFAULT NULL,
      `notes` text DEFAULT NULL,
      `created_at` datetime NOT NULL,
      `updated_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `request_number` (`request_number`),
      KEY `idx_from_branch` (`from_branch_id`),
      KEY `idx_to_branch` (`to_branch_id`),
      KEY `idx_status` (`status`),
      KEY `idx_request_number` (`request_number`),
      CONSTRAINT `inventory_requests_ibfk_from` FOREIGN KEY (`from_branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
      CONSTRAINT `inventory_requests_ibfk_to` FOREIGN KEY (`to_branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
      CONSTRAINT `inventory_requests_ibfk_requested` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
      CONSTRAINT `inventory_requests_ibfk_approved` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    if (dbExecute($createInventoryRequestsTable, [])) {
        $results[] = 'تم إنشاء جدول inventory_requests';
    } else {
        $errors[] = 'فشل إنشاء جدول inventory_requests';
    }
    
    // 8. تحديث البيانات الموجودة - ربطها بالفرع الأول
    $updateRepairs = "UPDATE `repairs` SET `branch_id` = 'branch_hanovil' WHERE `branch_id` IS NULL";
    if (dbExecute($updateRepairs, [])) {
        $results[] = 'تم تحديث عمليات الصيانة الموجودة';
    }
    
    $updateCustomers = "UPDATE `customers` SET `branch_id` = 'branch_hanovil' WHERE `branch_id` IS NULL";
    if (dbExecute($updateCustomers, [])) {
        $results[] = 'تم تحديث العملاء الموجودين';
    }
    
    $updateSales = "UPDATE `sales` SET `branch_id` = 'branch_hanovil' WHERE `branch_id` IS NULL";
    if (dbExecute($updateSales, [])) {
        $results[] = 'تم تحديث المبيعات الموجودة';
    }
    
    $updateUsers = "UPDATE `users` SET `branch_id` = 'branch_hanovil' WHERE `role` != 'admin' AND `branch_id` IS NULL";
    if (dbExecute($updateUsers, [])) {
        $results[] = 'تم تحديث المستخدمين الموجودين';
    }
    
    response(true, 'تم تنفيذ الهجرة بنجاح', [
        'results' => $results,
        'errors' => $errors
    ]);
    
} catch (Exception $e) {
    error_log('خطأ في الهجرة: ' . $e->getMessage());
    response(false, 'خطأ في الهجرة: ' . $e->getMessage(), [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 500);
}
?>


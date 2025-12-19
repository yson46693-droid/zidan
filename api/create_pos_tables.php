<?php
/**
 * ملف إنشاء جداول نظام نقاط البيع (POS)
 * يمكن تشغيله مرة واحدة لإنشاء الجداول المطلوبة
 */

require_once 'config.php';

// التحقق من تسجيل الدخول
checkAuth();

// التحقق من الصلاحيات (manager أو admin فقط)
checkPermission('manager');

header('Content-Type: text/html; charset=utf-8');

$conn = getDBConnection();
if (!$conn) {
    die('فشل الاتصال بقاعدة البيانات');
}

$errors = [];
$success = [];

// تعطيل فحص المفاتيح الخارجية مؤقتاً
$conn->query("SET FOREIGN_KEY_CHECKS = 0");

// إنشاء جدول sales
$createSalesTable = "
    CREATE TABLE IF NOT EXISTS `sales` (
      `id` varchar(50) NOT NULL,
      `sale_number` varchar(50) NOT NULL,
      `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
      `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
      `tax` decimal(10,2) NOT NULL DEFAULT 0.00,
      `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
      `customer_name` varchar(255) DEFAULT NULL,
      `customer_phone` varchar(50) DEFAULT NULL,
      `created_at` datetime NOT NULL,
      `updated_at` datetime DEFAULT NULL,
      `created_by` varchar(50) DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `sale_number` (`sale_number`),
      KEY `idx_sale_number` (`sale_number`),
      KEY `idx_created_at` (`created_at`),
      KEY `idx_created_by` (`created_by`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($createSalesTable)) {
    $success[] = 'تم إنشاء جدول sales بنجاح';
} else {
    $errors[] = 'خطأ في إنشاء جدول sales: ' . $conn->error;
}

// إنشاء جدول sale_items
$createSaleItemsTable = "
    CREATE TABLE IF NOT EXISTS `sale_items` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($createSaleItemsTable)) {
    $success[] = 'تم إنشاء جدول sale_items بنجاح';
} else {
    $errors[] = 'خطأ في إنشاء جدول sale_items: ' . $conn->error;
}

// إعادة تفعيل فحص المفاتيح الخارجية
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إنشاء جداول POS</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2196F3;
            margin-bottom: 20px;
        }
        .success {
            background: #4CAF50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .error {
            background: #f44336;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .info {
            background: #2196F3;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        a {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 5px;
        }
        a:hover {
            background: #1976D2;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>إنشاء جداول نظام نقاط البيع (POS)</h1>
        
        <?php if (!empty($success)): ?>
            <?php foreach ($success as $msg): ?>
                <div class="success">✓ <?php echo htmlspecialchars($msg); ?></div>
            <?php endforeach; ?>
        <?php endif; ?>
        
        <?php if (!empty($errors)): ?>
            <?php foreach ($errors as $msg): ?>
                <div class="error">✗ <?php echo htmlspecialchars($msg); ?></div>
            <?php endforeach; ?>
        <?php endif; ?>
        
        <?php if (empty($errors) && !empty($success)): ?>
            <div class="info">
                <strong>تم بنجاح!</strong><br>
                تم إنشاء جميع الجداول المطلوبة لنظام نقاط البيع.
                يمكنك الآن استخدام نظام POS.
            </div>
            <a href="../pos.html">الذهاب إلى نظام POS</a>
            <a href="../dashboard.html">العودة للوحة التحكم</a>
        <?php endif; ?>
        
        <?php if (!empty($errors)): ?>
            <div class="info">
                <strong>ملاحظة:</strong><br>
                إذا كانت الجداول موجودة بالفعل، قد تظهر رسائل خطأ. يمكنك تجاهلها.
            </div>
            <a href="../dashboard.html">العودة للوحة التحكم</a>
        <?php endif; ?>
    </div>
</body>
</html>

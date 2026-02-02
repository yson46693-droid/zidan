<?php
/**
 * إدارة طلبات قطع الغيار بين الفروع
 */
require_once 'config.php';

/**
 * جلب الفرع الأول (HANOVIL) حسب تاريخ الإنشاء
 */
function getFirstBranchId() {
    $firstBranch = dbSelectOne(
        "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
    );
    return $firstBranch ? $firstBranch['id'] : null;
}

// التأكد من وجود جدول inventory_requests
if (!dbTableExists('inventory_requests')) {
    $conn = getDBConnection();
    if ($conn) {
        $createTableSQL = "CREATE TABLE IF NOT EXISTS `inventory_requests` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        if ($conn->query($createTableSQL)) {
            error_log('✅ تم إنشاء جدول inventory_requests بنجاح');
        } else {
            error_log('❌ فشل إنشاء جدول inventory_requests: ' . $conn->error);
        }
    }
}

$method = getRequestMethod();
$data = getRequestData();

// إنشاء طلب جديد
if ($method === 'POST') {
    $session = checkAuth();
    $userBranchId = $session['branch_id'] ?? null;
    $userRole = $session['role'];
    
    if ($userRole !== 'admin' && !$userBranchId) {
        response(false, 'المستخدم غير مرتبط بفرع', null, 400);
    }
    
    $itemType = $data['item_type'] ?? '';
    $itemId = $data['item_id'] ?? '';
    $itemName = $data['item_name'] ?? '';
    $quantity = intval($data['quantity'] ?? 1);
    $items = $data['items'] ?? null; // مصفوفة القطع الفرعية (لقطع الغيار)
    
    // الحصول على ID الفرع الأول إذا لم يتم تحديد to_branch_id
    $toBranchId = $data['to_branch_id'] ?? null;
    if (!$toBranchId) {
        $toBranchId = getFirstBranchId();
        if (!$toBranchId) {
            response(false, 'لم يتم العثور على الفرع الأول', null, 404);
        }
    }
    
    $notes = trim($data['notes'] ?? '');
    
    // التحقق من البيانات
    // إذا كانت قطع غيار و items موجودة، استخدام items
    if ($itemType === 'spare_part' && is_array($items) && !empty($items)) {
        // التحقق من items بدلاً من quantity
        if (empty($itemType) || empty($itemId) || empty($itemName)) {
            response(false, 'البيانات المطلوبة غير مكتملة', null, 400);
        }
        // حساب إجمالي الكمية من items
        $quantity = array_sum(array_column($items, 'quantity'));
    } else {
        // للمنتجات الأخرى، التحقق من quantity
        if (empty($itemType) || empty($itemId) || empty($itemName) || $quantity <= 0) {
            response(false, 'البيانات المطلوبة غير مكتملة', null, 400);
        }
    }
    
    // التحقق من صحة نوع القطعة
    if (!in_array($itemType, ['inventory', 'spare_part', 'accessory'])) {
        response(false, 'نوع القطعة غير صحيح', null, 400);
    }
    
    // التحقق من وجود الفرع المطلوب منه
    $toBranch = dbSelectOne("SELECT id, name FROM branches WHERE id = ?", [$toBranchId]);
    if (!$toBranch) {
        response(false, 'الفرع المطلوب منه غير موجود', null, 404);
    }
    
    // توليد رقم الطلب
    $todayCount = dbSelectOne(
        "SELECT COUNT(*) as count FROM inventory_requests WHERE DATE(created_at) = CURDATE()",
        []
    );
    $count = $todayCount ? intval($todayCount['count']) : 0;
    $requestNumber = 'REQ' . date('Ymd') . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
    
    $requestId = generateId();
    
    // التحقق من وجود حقل items في الجدول
    $hasItemsColumn = dbColumnExists('inventory_requests', 'items');
    $itemsJson = null;
    
    if ($itemType === 'spare_part' && is_array($items) && !empty($items) && $hasItemsColumn) {
        // حفظ items كـ JSON
        $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);
    }
    
    // حفظ الطلب
    if ($hasItemsColumn && $itemsJson !== null) {
        $result = dbExecute(
            "INSERT INTO inventory_requests 
            (id, request_number, from_branch_id, to_branch_id, item_type, item_id, item_name, quantity, items, status, requested_by, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())",
            [$requestId, $requestNumber, $userBranchId, $toBranchId, $itemType, $itemId, $itemName, $quantity, $itemsJson, $session['user_id'], $notes]
        );
    } else {
        $result = dbExecute(
            "INSERT INTO inventory_requests 
            (id, request_number, from_branch_id, to_branch_id, item_type, item_id, item_name, quantity, status, requested_by, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())",
            [$requestId, $requestNumber, $userBranchId, $toBranchId, $itemType, $itemId, $itemName, $quantity, $session['user_id'], $notes]
        );
    }
    
    if ($result === false) {
        response(false, 'خطأ في إنشاء الطلب', null, 500);
    }
    
    // جلب معلومات الفرع الطالب
    $fromBranch = dbSelectOne("SELECT name FROM branches WHERE id = ?", [$userBranchId]);
    $fromBranchName = $fromBranch ? $fromBranch['name'] : 'فرع غير معروف';
    
    // قائمة أنواع قطع الغيار
    $sparePartTypes = [
        'screen' => 'شاشة',
        'touch' => 'تاتش',
        'battery' => 'بطارية',
        'rear_camera' => 'كاميرا خلفية',
        'front_camera' => 'كاميرا أمامية',
        'charging_port' => 'فلاتة شحن',
        'flex_connector' => 'فلاتة ربط',
        'power_flex' => 'فلاتة باور',
        'motherboard' => 'بوردة',
        'frame' => 'فريم',
        'housing' => 'هاوسنج',
        'back_cover' => 'ظهر',
        'lens' => 'عدسات',
        'ic' => 'IC',
        'external_buttons' => 'أزرار خارجية',
        'earpiece' => 'سماعة مكالمات',
        'speaker' => 'علبة جرس',
        'network_wire' => 'واير شبكة',
        'network_flex' => 'فلاتة شبكة',
        'hand_free' => 'هاند فري',
        'auxiliary_cameras' => 'كاميرات مساعده',
        'baga' => 'باغه',
        'camera_baga' => 'باغة كاميرا',
        'frame_camera_baga' => 'فريم باغة كاميرا',
        'vibration' => 'فيبريشن',
        'microphone' => 'مايكروفون',
        'back_flex' => 'فلاتة باك',
        'sensor' => 'سينسور',
        'sim_tray' => 'درج خط',
        'home_flex' => 'فلاتة هوم',
        'home_button' => 'زرار هوم',
        'upper_shield' => 'شيلد علوي',
        'lower_shield' => 'شيلد سفلي',
        
        'other' => 'ملحقات أخرى'
    ];
    
    // بناء رسالة مبسطة
    $chatMessage = "📦 طلب منتج\n";
    $chatMessage .= "من: {$fromBranchName}\n";
    $chatMessage .= "إلى: {$toBranch['name']}\n\n";
    $chatMessage .= "المنتج: {$itemName}\n";
    
    // إذا كانت قطع غيار و items موجودة، عرض تفاصيل القطع
    if ($itemType === 'spare_part' && is_array($items) && !empty($items)) {
        $chatMessage .= "\nالقطع المطلوبة:\n";
        foreach ($items as $item) {
            $itemTypeName = $sparePartTypes[$item['item_type']] ?? $item['item_type'];
            $qty = intval($item['quantity'] ?? 0);
            if ($qty > 0) {
                $chatMessage .= "• {$itemTypeName}: {$qty}";
                if (!empty($item['custom_value'])) {
                    $chatMessage .= " ({$item['custom_value']})";
                }
                $chatMessage .= "\n";
            }
        }
        $chatMessage .= "\nإجمالي: {$quantity} قطعة\n";
    } else {
        $chatMessage .= "الكمية: {$quantity}\n";
    }
    
    $chatMessage .= "رقم الطلب: {$requestNumber}\n";
    if (!empty($notes)) {
        // تأمين الملاحظات من XSS قبل إضافتها
        $safeNotes = htmlspecialchars($notes, ENT_QUOTES, 'UTF-8');
        $chatMessage .= "ملاحظات: {$safeNotes}\n";
    }
    
    // تحويل الأسطر الجديدة إلى <br> لعرضها بشكل صحيح في الشات
    $chatMessage = nl2br($chatMessage);
    
    // إرسال رسالة مبسطة في الشات
    try {
        // حفظ الرسالة في الشات مباشرة
        $messageId = generateId();
        $user = dbSelectOne("SELECT name, username FROM users WHERE id = ?", [$session['user_id']]);
        $username = $user ? ($user['name'] ?? $user['username'] ?? 'مستخدم') : 'مستخدم';
        
        dbExecute(
            "INSERT INTO chat_messages (id, user_id, username, message, created_at) VALUES (?, ?, ?, ?, NOW())",
            [$messageId, $session['user_id'], $username, $chatMessage]
        );
    } catch (Exception $e) {
        error_log('خطأ في إرسال رسالة الشات: ' . $e->getMessage());
    }
    
    // إرسال إشعارات لكل المستخدمين المرتبطين بالفرع الأول (الهانوفيل) والمالك
    try {
        // التأكد من وجود جدول notifications
        if (!dbTableExists('notifications')) {
            $conn = getDBConnection();
            if ($conn) {
                $createNotificationsTableSQL = "
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
                $conn->query($createNotificationsTableSQL);
            }
        }
        
        // جلب الفرع الأول (الهانوفيل)
        $firstBranch = dbSelectOne(
            "SELECT id, code FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
        );
        $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
        $firstBranchCode = $firstBranch ? ($firstBranch['code'] ?? '') : '';
        
        // جلب جميع المستخدمين المرتبطين بالفرع الأول + المالك (admin)
        $usersToNotify = [];
        
        if ($firstBranchId) {
            // جلب جميع المستخدمين المرتبطين بالفرع الأول
            $branchUsers = dbSelect(
                "SELECT id FROM users WHERE branch_id = ?",
                [$firstBranchId]
            );
            if ($branchUsers && is_array($branchUsers)) {
                foreach ($branchUsers as $user) {
                    $usersToNotify[$user['id']] = true;
                }
            }
        }
        
        // جلب جميع المالكين (admin) حتى لو لم يكونوا مرتبطين بفرع
        $adminUsers = dbSelect(
            "SELECT id FROM users WHERE role = 'admin'"
        );
        if ($adminUsers && is_array($adminUsers)) {
            foreach ($adminUsers as $user) {
                $usersToNotify[$user['id']] = true;
            }
        }
        
        // إرسال الإشعار لكل مستخدم
        $notificationTitle = "طلب منتج جديد من {$fromBranchName}";
        
        foreach ($usersToNotify as $userId => $value) {
            try {
                $notificationId = generateId();
                dbExecute(
                    "INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, created_at) 
                     VALUES (?, ?, 'inventory_request', ?, ?, ?, 0, NOW())",
                    [$notificationId, $userId, $notificationTitle, $chatMessage, $requestId]
                );
            } catch (Exception $e) {
                error_log('خطأ في إرسال إشعار للمستخدم ' . $userId . ': ' . $e->getMessage());
            }
        }
    } catch (Exception $e) {
        error_log('خطأ في إرسال الإشعارات: ' . $e->getMessage());
    }
    
    $newRequest = dbSelectOne(
        "SELECT ir.*, b1.name as from_branch_name, b2.name as to_branch_name, u.name as requested_by_name
         FROM inventory_requests ir
         LEFT JOIN branches b1 ON ir.from_branch_id = b1.id
         LEFT JOIN branches b2 ON ir.to_branch_id = b2.id
         LEFT JOIN users u ON ir.requested_by = u.id
         WHERE ir.id = ?",
        [$requestId]
    );
    
    response(true, 'تم إنشاء الطلب بنجاح', $newRequest);
}

// قراءة الطلبات
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    $query = "SELECT ir.*, 
              b1.name as from_branch_name, 
              b2.name as to_branch_name,
              u1.name as requested_by_name,
              u2.name as approved_by_name
              FROM inventory_requests ir
              LEFT JOIN branches b1 ON ir.from_branch_id = b1.id
              LEFT JOIN branches b2 ON ir.to_branch_id = b2.id
              LEFT JOIN users u1 ON ir.requested_by = u1.id
              LEFT JOIN users u2 ON ir.approved_by = u2.id
              WHERE 1=1";
    $params = [];
    
    // المالك يرى كل الطلبات
    if ($userRole !== 'admin' && $userBranchId) {
        // المستخدم يرى طلبات فرعه فقط (الطلبات المرسلة أو المستلمة)
        $query .= " AND (ir.from_branch_id = ? OR ir.to_branch_id = ?)";
        $params[] = $userBranchId;
        $params[] = $userBranchId;
    }
    
    // فلترة حسب الحالة إذا كانت موجودة
    $status = $_GET['status'] ?? null;
    if ($status && in_array($status, ['pending', 'approved', 'rejected', 'completed'])) {
        $query .= " AND ir.status = ?";
        $params[] = $status;
    }
    
    $query .= " ORDER BY ir.created_at DESC";
    
    $requests = dbSelect($query, $params);
    
    if ($requests === false) {
        response(false, 'خطأ في قراءة الطلبات', null, 500);
    }
    
    response(true, '', $requests);
}

// تحديث حالة الطلب (موافقة/رفض/إكمال)
if ($method === 'PUT') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    $requestId = $data['id'] ?? '';
    $status = $data['status'] ?? '';
    $notes = trim($data['notes'] ?? '');
    
    if (empty($requestId) || empty($status)) {
        response(false, 'معرف الطلب والحالة مطلوبان', null, 400);
    }
    
    if (!in_array($status, ['approved', 'rejected', 'completed'])) {
        response(false, 'الحالة غير صحيحة', null, 400);
    }
    
    // التحقق من وجود الطلب
    $request = dbSelectOne(
        "SELECT * FROM inventory_requests WHERE id = ?",
        [$requestId]
    );
    
    if (!$request) {
        response(false, 'الطلب غير موجود', null, 404);
    }
    
    // التحقق من الصلاحيات - فقط المالك أو مدير الفرع المطلوب منه يمكنه الموافقة
    if ($userRole !== 'admin') {
        if (!$userBranchId || $request['to_branch_id'] !== $userBranchId) {
            response(false, 'ليس لديك صلاحية لتحديث هذا الطلب', null, 403);
        }
    }
    
    // تحديث الطلب
    $updateFields = ["status = ?", "approved_by = ?", "updated_at = NOW()"];
    $updateParams = [$status, $session['user_id']];
    
    if (!empty($notes)) {
        $updateFields[] = "notes = ?";
        $updateParams[] = $notes;
    }
    
    $updateParams[] = $requestId;
    
    $result = dbExecute(
        "UPDATE inventory_requests SET " . implode(', ', $updateFields) . " WHERE id = ?",
        $updateParams
    );
    
    if ($result === false) {
        response(false, 'خطأ في تحديث الطلب', null, 500);
    }
    
    // إرسال رسالة في الشات عن التحديث
    try {
        $statusText = [
            'approved' => '✅ تمت الموافقة',
            'rejected' => '❌ تم الرفض',
            'completed' => '✅ تم الإكمال'
        ];
        
        $chatMessage = "📋 تحديث طلب قطع غيار\n";
        $chatMessage .= "رقم الطلب: {$request['request_number']}\n";
        $chatMessage .= "الحالة: " . ($statusText[$status] ?? $status);
        if (!empty($notes)) {
            // تأمين الملاحظات من XSS قبل إضافتها
            $safeNotes = htmlspecialchars($notes, ENT_QUOTES, 'UTF-8');
            $chatMessage .= "\nملاحظات: {$safeNotes}";
        }
        
        // تحويل الأسطر الجديدة إلى <br> لعرضها بشكل صحيح في الشات
        $chatMessage = nl2br($chatMessage);
        
        $messageId = generateId();
        $user = dbSelectOne("SELECT name, username FROM users WHERE id = ?", [$session['user_id']]);
        $username = $user ? ($user['name'] ?? $user['username'] ?? 'مستخدم') : 'مستخدم';
        
        dbExecute(
            "INSERT INTO chat_messages (id, user_id, username, message, created_at) VALUES (?, ?, ?, ?, NOW())",
            [$messageId, $session['user_id'], $username, $chatMessage]
        );
    } catch (Exception $e) {
        error_log('خطأ في إرسال رسالة الشات: ' . $e->getMessage());
    }
    
    $updatedRequest = dbSelectOne(
        "SELECT ir.*, b1.name as from_branch_name, b2.name as to_branch_name, u1.name as requested_by_name, u2.name as approved_by_name
         FROM inventory_requests ir
         LEFT JOIN branches b1 ON ir.from_branch_id = b1.id
         LEFT JOIN branches b2 ON ir.to_branch_id = b2.id
         LEFT JOIN users u1 ON ir.requested_by = u1.id
         LEFT JOIN users u2 ON ir.approved_by = u2.id
         WHERE ir.id = ?",
        [$requestId]
    );
    
    response(true, 'تم تحديث الطلب بنجاح', $updatedRequest);
}

// حذف طلب (فقط للطلبات المعلقة)
if ($method === 'DELETE') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    $requestId = $data['id'] ?? '';
    
    if (empty($requestId)) {
        response(false, 'معرف الطلب مطلوب', null, 400);
    }
    
    // التحقق من وجود الطلب
    $request = dbSelectOne(
        "SELECT * FROM inventory_requests WHERE id = ?",
        [$requestId]
    );
    
    if (!$request) {
        response(false, 'الطلب غير موجود', null, 404);
    }
    
    // فقط منشئ الطلب أو المالك يمكنه الحذف (ولكن فقط إذا كان معلقاً)
    if ($request['status'] !== 'pending') {
        response(false, 'لا يمكن حذف الطلب بعد الموافقة عليه', null, 400);
    }
    
    if ($userRole !== 'admin' && $request['requested_by'] !== $session['user_id']) {
        response(false, 'ليس لديك صلاحية لحذف هذا الطلب', null, 403);
    }
    
    $result = dbExecute("DELETE FROM inventory_requests WHERE id = ?", [$requestId]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف الطلب', null, 500);
    }
    
    response(true, 'تم حذف الطلب بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


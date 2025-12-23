<?php
require_once __DIR__ . '/config.php';

$method = getRequestMethod();
$data = getRequestData();
$session = checkAuth();
$userId = $session['user_id'];

// إنشاء جداول الشات إذا لم تكن موجودة
if (!function_exists('createChatTables')) {
    require_once __DIR__ . '/create_chat_tables.php';
}
if (function_exists('createChatTables')) {
    createChatTables();
}

// الحصول على أو إنشاء غرفة الشات الجماعية
if ($method === 'GET' && !isset($_GET['action'])) {
    // الحصول على جميع الغرف التي يشارك فيها المستخدم
    $rooms = dbSelect("
        SELECT 
            cr.*,
            COUNT(DISTINCT cp.user_id) as participant_count,
            (SELECT COUNT(*) FROM chat_messages cm WHERE cm.room_id = cr.id AND cm.deleted_at IS NULL) as message_count,
            (SELECT MAX(created_at) FROM chat_messages cm WHERE cm.room_id = cr.id AND cm.deleted_at IS NULL) as last_message_at
        FROM chat_rooms cr
        INNER JOIN chat_participants cp ON cp.room_id = cr.id
        WHERE cp.user_id = ?
        GROUP BY cr.id
        ORDER BY last_message_at DESC, cr.created_at DESC
    ", [$userId]);
    
    // إضافة معلومات المشاركين لكل غرفة
    foreach ($rooms as &$room) {
        $participants = dbSelect("
            SELECT u.id, u.name, u.username, cp.joined_at, cp.unread_count, cp.last_read_at
            FROM chat_participants cp
            INNER JOIN users u ON u.id = cp.user_id
            WHERE cp.room_id = ?
            ORDER BY cp.joined_at ASC
        ", [$room['id']]);
        
        $room['participants'] = $participants;
        
        // الحصول على آخر رسالة
        $lastMessage = dbSelectOne("
            SELECT cm.*, u.name as user_name, u.username
            FROM chat_messages cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.room_id = ? AND cm.deleted_at IS NULL
            ORDER BY cm.created_at DESC
            LIMIT 1
        ", [$room['id']]);
        
        $room['last_message'] = $lastMessage;
    }
    
    response(true, 'تم جلب الغرف بنجاح', $rooms);
}

// الحصول على رسائل غرفة معينة
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'messages') {
    $roomId = $_GET['room_id'] ?? '';
    
    if (empty($roomId)) {
        response(false, 'معرف الغرفة مطلوب', null, 400);
    }
    
    // التحقق من أن المستخدم مشارك في الغرفة
    $participant = dbSelectOne("SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?", [$roomId, $userId]);
    if (!$participant) {
        response(false, 'غير مصرح بالوصول لهذه الغرفة', null, 403);
    }
    
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    $messages = dbSelect("
        SELECT 
            cm.*,
            u.name as user_name,
            u.username,
            (SELECT COUNT(*) FROM chat_reactions cr WHERE cr.message_id = cm.id) as reaction_count
        FROM chat_messages cm
        INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.room_id = ? AND cm.deleted_at IS NULL
        ORDER BY cm.created_at DESC
        LIMIT ? OFFSET ?
    ", [$roomId, $limit, $offset]);
    
    // الحصول على ردود الفعل لكل رسالة
    foreach ($messages as &$message) {
        $reactions = dbSelect("
            SELECT cr.*, u.name as user_name
            FROM chat_reactions cr
            INNER JOIN users u ON u.id = cr.user_id
            WHERE cr.message_id = ?
            ORDER BY cr.created_at ASC
        ", [$message['id']]);
        
        // تجميع ردود الفعل حسب النوع
        $reactionsGrouped = [];
        foreach ($reactions as $reaction) {
            $type = $reaction['reaction_type'];
            if (!isset($reactionsGrouped[$type])) {
                $reactionsGrouped[$type] = ['count' => 0, 'users' => []];
            }
            $reactionsGrouped[$type]['count']++;
            $reactionsGrouped[$type]['users'][] = $reaction['user_name'];
        }
        
        $message['reactions'] = $reactionsGrouped;
    }
    
    // تحديث last_read_at للمستخدم
    dbExecute("UPDATE chat_participants SET last_read_at = NOW() WHERE room_id = ? AND user_id = ?", [$roomId, $userId]);
    dbExecute("UPDATE chat_participants SET unread_count = 0 WHERE room_id = ? AND user_id = ?", [$roomId, $userId]);
    
    response(true, 'تم جلب الرسائل بنجاح', array_reverse($messages));
}

// إرسال رسالة
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'send_message') {
    $roomId = $data['room_id'] ?? '';
    $message = $data['message'] ?? '';
    $messageType = $data['message_type'] ?? 'text';
    $fileUrl = $data['file_url'] ?? null;
    
    if (empty($roomId) || empty($message)) {
        response(false, 'معرف الغرفة والرسالة مطلوبان', null, 400);
    }
    
    // التحقق من أن المستخدم مشارك في الغرفة
    $participant = dbSelectOne("SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?", [$roomId, $userId]);
    if (!$participant) {
        response(false, 'غير مصرح بالوصول لهذه الغرفة', null, 403);
    }
    
    $messageId = generateId();
    $result = dbExecute("
        INSERT INTO chat_messages (id, room_id, user_id, message, message_type, file_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ", [$messageId, $roomId, $userId, $message, $messageType, $fileUrl]);
    
    if ($result) {
        // زيادة unread_count لجميع المشاركين ما عدا المرسل
        dbExecute("
            UPDATE chat_participants 
            SET unread_count = unread_count + 1 
            WHERE room_id = ? AND user_id != ?
        ", [$roomId, $userId]);
        
        // الحصول على الرسالة المرسلة مع معلومات المستخدم
        $sentMessage = dbSelectOne("
            SELECT cm.*, u.name as user_name, u.username
            FROM chat_messages cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.id = ?
        ", [$messageId]);
        
        $sentMessage['reactions'] = [];
        
        response(true, 'تم إرسال الرسالة بنجاح', $sentMessage);
    } else {
        response(false, 'فشل إرسال الرسالة', null, 500);
    }
}

// إضافة رد فعل
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'add_reaction') {
    $messageId = $data['message_id'] ?? '';
    $reactionType = $data['reaction_type'] ?? 'like';
    
    if (empty($messageId)) {
        response(false, 'معرف الرسالة مطلوب', null, 400);
    }
    
    // التحقق من أن الرسالة موجودة
    $message = dbSelectOne("SELECT * FROM chat_messages WHERE id = ? AND deleted_at IS NULL", [$messageId]);
    if (!$message) {
        response(false, 'الرسالة غير موجودة', null, 404);
    }
    
    // التحقق من أن المستخدم مشارك في الغرفة
    $participant = dbSelectOne("SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?", [$message['room_id'], $userId]);
    if (!$participant) {
        response(false, 'غير مصرح بالوصول لهذه الغرفة', null, 403);
    }
    
    // التحقق من وجود رد الفعل مسبقاً
    $existingReaction = dbSelectOne("
        SELECT * FROM chat_reactions 
        WHERE message_id = ? AND user_id = ? AND reaction_type = ?
    ", [$messageId, $userId, $reactionType]);
    
    if ($existingReaction) {
        // إزالة رد الفعل
        dbExecute("DELETE FROM chat_reactions WHERE id = ?", [$existingReaction['id']]);
        response(true, 'تم إزالة رد الفعل', ['removed' => true]);
    } else {
        // إضافة رد الفعل
        $reactionId = generateId();
        $result = dbExecute("
            INSERT INTO chat_reactions (id, message_id, user_id, reaction_type, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ", [$reactionId, $messageId, $userId, $reactionType]);
        
        if ($result) {
            response(true, 'تم إضافة رد الفعل بنجاح', ['added' => true]);
        } else {
            response(false, 'فشل إضافة رد الفعل', null, 500);
        }
    }
}

// إنشاء أو الحصول على غرفة خاصة
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'get_or_create_private_room') {
    $otherUserId = $data['user_id'] ?? '';
    
    if (empty($otherUserId)) {
        response(false, 'معرف المستخدم مطلوب', null, 400);
    }
    
    if ($otherUserId === $userId) {
        response(false, 'لا يمكن إنشاء محادثة خاصة مع نفسك', null, 400);
    }
    
    // البحث عن غرفة خاصة موجودة بين المستخدمين
    $existingRoom = dbSelectOne("
        SELECT cr.*
        FROM chat_rooms cr
        INNER JOIN chat_participants cp1 ON cp1.room_id = cr.id AND cp1.user_id = ?
        INNER JOIN chat_participants cp2 ON cp2.room_id = cr.id AND cp2.user_id = ?
        WHERE cr.type = 'private'
        LIMIT 1
    ", [$userId, $otherUserId]);
    
    if ($existingRoom) {
        // الحصول على معلومات المستخدم الآخر
        $otherUser = dbSelectOne("SELECT id, name, username FROM users WHERE id = ?", [$otherUserId]);
        $existingRoom['other_user'] = $otherUser;
        response(true, 'تم العثور على الغرفة', $existingRoom);
    } else {
        // إنشاء غرفة خاصة جديدة
        $roomId = generateId();
        $otherUser = dbSelectOne("SELECT id, name, username FROM users WHERE id = ?", [$otherUserId]);
        
        if (!$otherUser) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // إنشاء الغرفة
        dbExecute("
            INSERT INTO chat_rooms (id, name, type, created_by, created_at)
            VALUES (?, ?, 'private', ?, NOW())
        ", [$roomId, null, $userId]);
        
        // إضافة المشاركين
        dbExecute("
            INSERT INTO chat_participants (id, room_id, user_id, joined_at)
            VALUES (?, ?, ?, NOW())
        ", [generateId(), $roomId, $userId]);
        
        dbExecute("
            INSERT INTO chat_participants (id, room_id, user_id, joined_at)
            VALUES (?, ?, ?, NOW())
        ", [generateId(), $roomId, $otherUserId]);
        
        $newRoom = [
            'id' => $roomId,
            'name' => null,
            'type' => 'private',
            'created_by' => $userId,
            'created_at' => date('Y-m-d H:i:s'),
            'other_user' => $otherUser
        ];
        
        response(true, 'تم إنشاء الغرفة بنجاح', $newRoom);
    }
}

// الحصول على جميع المستخدمين
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'users') {
    $users = dbSelect("
        SELECT id, name, username, role, created_at
        FROM users
        WHERE id != ?
        ORDER BY name ASC
    ", [$userId]);
    
    response(true, 'تم جلب المستخدمين بنجاح', $users);
}

// الحصول على غرفة الشات الجماعية الافتراضية
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'get_or_create_group_room') {
    // البحث عن غرفة جماعية موجودة
    $groupRoom = dbSelectOne("
        SELECT * FROM chat_rooms 
        WHERE type = 'group' 
        ORDER BY created_at ASC 
        LIMIT 1
    ");
    
    if ($groupRoom) {
        // التحقق من أن المستخدم مشارك
        $participant = dbSelectOne("SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?", [$groupRoom['id'], $userId]);
        
        if (!$participant) {
            // إضافة المستخدم للغرفة
            dbExecute("
                INSERT INTO chat_participants (id, room_id, user_id, joined_at)
                VALUES (?, ?, ?, NOW())
            ", [generateId(), $groupRoom['id'], $userId]);
        }
        
        response(true, 'تم العثور على الغرفة الجماعية', $groupRoom);
    } else {
        // إنشاء غرفة جماعية جديدة
        $roomId = generateId();
        dbExecute("
            INSERT INTO chat_rooms (id, name, type, created_by, created_at)
            VALUES (?, 'المحادثة العامة', 'group', ?, NOW())
        ", [$roomId, $userId]);
        
        // إضافة جميع المستخدمين للغرفة
        $allUsers = dbSelect("SELECT id FROM users", []);
        foreach ($allUsers as $user) {
            dbExecute("
                INSERT INTO chat_participants (id, room_id, user_id, joined_at)
                VALUES (?, ?, ?, NOW())
            ", [generateId(), $roomId, $user['id']]);
        }
        
        $newRoom = [
            'id' => $roomId,
            'name' => 'المحادثة العامة',
            'type' => 'group',
            'created_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        response(true, 'تم إنشاء الغرفة الجماعية بنجاح', $newRoom);
    }
}

response(false, 'عملية غير مدعومة', null, 405);
?>


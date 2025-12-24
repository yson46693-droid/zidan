<?php
/**
 * إرسال رسالة جديدة
 * يدعم الرد على الرسائل (reply_to)
 */
require_once __DIR__ . '/config.php';

try {
    $method = getRequestMethod();
    $data = getRequestData();
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // الحصول على username من قاعدة البيانات
    $user = dbSelectOne("SELECT name, username FROM users WHERE id = ?", [$userId]);
    $username = $user['name'] ?? $user['username'] ?? 'مستخدم';
    
    if ($method !== 'POST') {
        response(false, 'طريقة الطلب غير مدعومة', null, 405);
    }
    
    // الحصول على البيانات
    $message = trim($data['message'] ?? '');
    $replyTo = $data['reply_to'] ?? null;
    $fileType = $data['file_type'] ?? null; // 'image', 'file'
    $fileData = $data['file_data'] ?? null; // Base64 encoded file
    $fileName = $data['file_name'] ?? null;
    $mentions = $data['mentions'] ?? [];
    
    // التحقق من وجود الرسالة أو الملف
    if (empty($message) && empty($fileData)) {
        response(false, 'الرسالة أو الملف مطلوب', null, 400);
    }
    
    // التحقق من طول الرسالة (حد أقصى 1000 حرف)
    if (mb_strlen($message) > 1000) {
        response(false, 'الرسالة طويلة جداً. الحد الأقصى 1000 حرف', null, 400);
    }
    
    // فلترة XSS
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    
    // التحقق من وجود الرسالة المراد الرد عليها (إذا كان reply_to موجود)
    $replyToMessage = null;
    $replyToId = null;
    
    if (!empty($replyTo)) {
        // إذا كان reply_to كائن، استخراج ID
        if (is_array($replyTo) && isset($replyTo['id'])) {
            $replyToId = $replyTo['id'];
        } else {
            $replyToId = $replyTo;
        }
        
        // التحقق من وجود الرسالة في قاعدة البيانات
        $replyToMessage = dbSelectOne("
            SELECT 
                cm.id, 
                cm.user_id, 
                COALESCE(u.name, u.username, 'مستخدم') as username, 
                cm.message 
            FROM chat_messages cm
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE cm.id = ? AND (cm.deleted_at IS NULL OR cm.deleted_at = '')
        ", [$replyToId]);
        
        if (!$replyToMessage) {
            response(false, 'الرسالة المراد الرد عليها غير موجودة', null, 404);
        }
    }
    
    // معالجة الملفات والصور
    $filePath = null;
    if (!empty($fileData) && !empty($fileType)) {
        $filePath = saveChatFile($fileData, $fileType, $fileName, $userId);
        if (!$filePath) {
            response(false, 'فشل في حفظ الملف', null, 500);
        }
        
        // إذا كانت صورة وليس هناك نص، إضافة نص افتراضي
        if ($fileType === 'image' && empty($message)) {
            $message = '📷 صورة';
        } elseif ($fileType === 'file' && empty($message)) {
            $message = '📎 ملف: ' . ($fileName ?? 'ملف');
        }
    }
    
    // إنشاء معرف فريد للرسالة
    $messageId = generateId();
    
    // حفظ الرسالة في قاعدة البيانات
    // التحقق من وجود عمود username أولاً
    try {
        $result = dbExecute("
            INSERT INTO chat_messages (id, user_id, username, message, reply_to, file_path, file_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ", [$messageId, $userId, $username, $message, $replyToId, $filePath, $fileType]);
    } catch (Exception $e) {
        // إذا فشل بسبب عدم وجود عمود username أو file_path، محاولة بدونها
        error_log('محاولة إدراج بدون أعمدة إضافية: ' . $e->getMessage());
        try {
            $result = dbExecute("
                INSERT INTO chat_messages (id, user_id, message, reply_to, created_at)
                VALUES (?, ?, ?, ?, NOW())
            ", [$messageId, $userId, $message, $replyToId]);
        } catch (Exception $e2) {
            error_log('فشل الإدراج: ' . $e2->getMessage());
            response(false, 'فشل إرسال الرسالة', null, 500);
        }
    }
    
    if (!$result) {
        response(false, 'فشل إرسال الرسالة', null, 500);
    }
    
    // تحديث حالة النشاط للمرسل
    updateUserActivity($userId);
    
    // معالجة الـ mentions وإرسال الإشعارات
    if (!empty($mentions) && is_array($mentions)) {
        foreach ($mentions as $mention) {
            if (isset($mention['user_id']) && $mention['user_id'] !== $userId) {
                sendMentionNotification($mention['user_id'], $userId, $username, $message, $messageId);
            }
        }
    }
    
    // إعداد بيانات الرسالة المرسلة
    $sentMessage = [
        'id' => $messageId,
        'user_id' => $userId,
        'username' => $username,
        'message' => $message,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    // إضافة معلومات الملف إذا كان موجوداً
    if ($filePath) {
        $sentMessage['file_path'] = $filePath;
        $sentMessage['file_type'] = $fileType;
        $sentMessage['file_name'] = $fileName;
    }
    
    // إضافة معلومات الرد إذا كان موجوداً
    if ($replyToMessage) {
        $sentMessage['reply_to'] = [
            'id' => $replyToMessage['id'],
            'user_id' => $replyToMessage['user_id'],
            'username' => $replyToMessage['username'],
            'message' => $replyToMessage['message']
        ];
    }
    
    // إضافة معلومات الـ mentions
    if (!empty($mentions)) {
        $sentMessage['mentions'] = $mentions;
    }
    
    // إرسال Web Push للمستخدمين غير المفتوحين
    try {
        sendPushNotifications($userId, $message, $username, $messageId);
    } catch (Exception $e) {
        // لا نوقف التنفيذ عند فشل إرسال الإشعارات
        error_log('خطأ في إرسال إشعارات Push: ' . $e->getMessage());
    }
    
    response(true, 'تم إرسال الرسالة بنجاح', $sentMessage);
    
} catch (Exception $e) {
    error_log('خطأ في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في إرسال الرسالة: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في send_message.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في إرسال الرسالة', null, 500);
}

/**
 * التأكد من وجود جدول active_users
 */
function ensureActiveUsersTable() {
    if (!dbTableExists('active_users')) {
        $conn = getDBConnection();
        if ($conn) {
            $sql = "
                CREATE TABLE IF NOT EXISTS `active_users` (
                  `user_id` varchar(50) NOT NULL,
                  `last_activity` datetime NOT NULL,
                  `is_online` tinyint(1) DEFAULT 1,
                  PRIMARY KEY (`user_id`),
                  KEY `idx_last_activity` (`last_activity`),
                  KEY `idx_is_online` (`is_online`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            if (!$conn->query($sql)) {
                error_log("خطأ في إنشاء جدول active_users: " . $conn->error);
                return false;
            }
        }
    }
    return true;
}

/**
 * تحديث حالة النشاط للمستخدم
 */
function updateUserActivity($userId) {
    try {
        // التأكد من وجود الجدول أولاً
        if (!ensureActiveUsersTable()) {
            error_log('فشل في التأكد من وجود جدول active_users');
            return;
        }
        
        dbExecute("
            INSERT INTO active_users (user_id, last_activity, is_online)
            VALUES (?, NOW(), 1)
            ON DUPLICATE KEY UPDATE last_activity = NOW(), is_online = 1
        ", [$userId]);
    } catch (Exception $e) {
        error_log('خطأ في updateUserActivity: ' . $e->getMessage());
    }
}

/**
 * حفظ ملف الشات
 */
function saveChatFile($fileData, $fileType, $fileName, $userId) {
    try {
        // تحديد المجلد
        $chatDir = __DIR__ . '/../chat/';
        if ($fileType === 'image') {
            $targetDir = $chatDir . 'images/';
        } else {
            $targetDir = $chatDir . 'files/';
        }
        
        // التأكد من وجود المجلد
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0755, true);
        }
        
        // تنظيف بيانات Base64
        $fileData = preg_replace('/^data:[^;]+;base64,/', '', $fileData);
        $fileData = base64_decode($fileData);
        
        if ($fileData === false) {
            throw new Exception('بيانات الملف غير صحيحة');
        }
        
        // إنشاء اسم الملف
        $extension = '';
        if ($fileType === 'image') {
            $extension = '.jpg';
        } elseif ($fileName) {
            $extension = '.' . pathinfo($fileName, PATHINFO_EXTENSION);
        } else {
            $extension = '.bin';
        }
        
        $filename = 'chat_' . generateId() . $extension;
        $filepath = $targetDir . $filename;
        
        // حفظ الملف
        if (file_put_contents($filepath, $fileData) === false) {
            throw new Exception('فشل في حفظ الملف');
        }
        
        // إرجاع المسار النسبي
        return 'chat/' . ($fileType === 'image' ? 'images/' : 'files/') . $filename;
        
    } catch (Exception $e) {
        error_log('خطأ في saveChatFile: ' . $e->getMessage());
        return null;
    }
}

/**
 * إرسال إشعار mention للمستخدم
 */
function sendMentionNotification($mentionedUserId, $senderId, $senderName, $message, $messageId) {
    try {
        // حفظ الإشعار في قاعدة البيانات (إذا كان هناك جدول notifications)
        // يمكن إضافة جدول notifications لاحقاً
        
        // إرسال إشعار متصفح إذا كان المستخدم المذكور متصلاً
        // سيتم التعامل معه من خلال Long Polling
        
        error_log("Mention notification: User {$mentionedUserId} mentioned by {$senderName} in message {$messageId}");
        
    } catch (Exception $e) {
        error_log('خطأ في إرسال إشعار mention: ' . $e->getMessage());
    }
}

/**
 * إرسال إشعارات Push للمستخدمين غير المفتوحين
 * يرسل إشعارات للمستخدمين الذين لديهم push subscriptions وغير موجودين في صفحة الشات
 */
function sendPushNotifications($senderId, $message, $senderName, $messageId = null) {
    try {
        // التحقق من البيانات الأساسية
        if (empty($senderId) || empty($message) || empty($senderName)) {
            error_log('بيانات sendPushNotifications غير مكتملة');
            return;
        }
        
        // التأكد من وجود الجداول المطلوبة
        if (!function_exists('dbTableExists')) {
            error_log('دالة dbTableExists غير موجودة');
            return;
        }
        
        if (!dbTableExists('push_subscriptions')) {
            error_log('جدول push_subscriptions غير موجود');
            return;
        }
        
        // التحقق من وجود جدول active_users (اختياري)
        $hasActiveUsersTable = dbTableExists('active_users');
        
        // الحصول على جميع المستخدمين المفتوحين (نشطون في آخر دقيقة) إذا كان الجدول موجوداً
        $activeUserIds = [];
        if ($hasActiveUsersTable) {
            try {
                $activeUsers = dbSelect("
                    SELECT DISTINCT user_id 
                    FROM active_users 
                    WHERE is_online = 1 
                    AND last_activity >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                ", []);
                
                if ($activeUsers && count($activeUsers) > 0) {
                    foreach ($activeUsers as $activeUser) {
                        if (!empty($activeUser['user_id'])) {
                            $activeUserIds[] = $activeUser['user_id'];
                        }
                    }
                }
            } catch (Exception $e) {
                error_log('خطأ في جلب المستخدمين النشطين: ' . $e->getMessage());
                // نكمل العملية حتى لو فشل جلب المستخدمين النشطين
            }
        }
        
        // الحصول على جميع push subscriptions للمستخدمين غير المفتوحين
        $subscriptions = [];
        try {
            if (empty($activeUserIds)) {
                // إذا لم يكن هناك مستخدمين نشطين، أرسل لجميع subscriptions (عدا المرسل)
                $subscriptions = dbSelect("
                    SELECT id, user_id, endpoint, p256dh, auth
                    FROM push_subscriptions
                    WHERE user_id != ? AND endpoint IS NOT NULL AND endpoint != ''
                ", [$senderId]);
            } else {
                // إرسال فقط للمستخدمين غير المفتوحين
                $placeholders = str_repeat('?,', count($activeUserIds) - 1) . '?';
                $params = array_merge([$senderId], $activeUserIds);
                $subscriptions = dbSelect("
                    SELECT id, user_id, endpoint, p256dh, auth
                    FROM push_subscriptions
                    WHERE user_id != ? AND user_id NOT IN ($placeholders)
                    AND endpoint IS NOT NULL AND endpoint != ''
                ", $params);
            }
        } catch (Exception $e) {
            error_log('خطأ في جلب push subscriptions: ' . $e->getMessage());
            return;
        }
        
        if (empty($subscriptions) || !is_array($subscriptions)) {
            // لا توجد subscriptions لإرسال إشعارات إليها - هذا طبيعي
            return;
        }
        
        // تحضير نص الإشعار
        $notificationTitle = html_entity_decode($senderName, ENT_QUOTES, 'UTF-8');
        $notificationBody = html_entity_decode($message, ENT_QUOTES, 'UTF-8');
        $notificationBody = mb_strlen($notificationBody) > 100 ? mb_substr($notificationBody, 0, 100) . '...' : $notificationBody;
        $notificationIcon = '/icons/icon-192x192.png';
        $notificationBadge = '/icons/icon-72x72.png';
        
        // إعداد بيانات الإشعار
        $notificationData = [
            'title' => $notificationTitle,
            'body' => $notificationBody,
            'icon' => $notificationIcon,
            'badge' => $notificationBadge,
            'tag' => $messageId ?? 'message',
            'data' => [
                'url' => '/chat.html',
                'messageId' => $messageId ?? '',
                'userId' => $senderId
            ]
        ];
        
        // إرسال إشعار لكل subscription
        $successCount = 0;
        $failCount = 0;
        
        foreach ($subscriptions as $subscription) {
            try {
                // التحقق من صحة بيانات الـ subscription
                if (empty($subscription['endpoint']) || empty($subscription['p256dh']) || empty($subscription['auth'])) {
                    continue;
                }
                
                sendWebPushNotification(
                    $subscription['endpoint'],
                    $subscription['p256dh'],
                    $subscription['auth'],
                    $notificationData
                );
                
                $successCount++;
                
            } catch (Exception $e) {
                error_log("خطأ في إرسال إشعار Push للمستخدم {$subscription['user_id']}: " . $e->getMessage());
                $failCount++;
            }
        }
        
        // تسجيل إحصائيات
        if ($successCount > 0 || $failCount > 0) {
            error_log("إشعارات Push: نجح {$successCount}، فشل {$failCount} من " . count($subscriptions));
        }
        
    } catch (Exception $e) {
        error_log('خطأ في sendPushNotifications: ' . $e->getMessage());
        // لا نرمي الخطأ حتى لا نوقف إرسال الرسالة
    } catch (Error $e) {
        error_log('خطأ قاتل في sendPushNotifications: ' . $e->getMessage());
        // لا نرمي الخطأ حتى لا نوقف إرسال الرسالة
    }
}

/**
 * إرسال إشعار Web Push واحد
 * ملاحظة: Web Push يتطلب VAPID keys للتشفير الصحيح
 * حالياً نستخدم طريقة بسيطة - يمكن تحسينها بإضافة VAPID keys لاحقاً
 */
function sendWebPushNotification($endpoint, $p256dh, $auth, $notification) {
    try {
        // التحقق من نوع endpoint
        if (strpos($endpoint, 'fcm.googleapis.com') !== false || strpos($endpoint, 'gcm-http.googleapis.com') !== false) {
            // إرسال عبر FCM (Firebase Cloud Messaging)
            sendFCMNotification($endpoint, $notification);
            return;
        }
        
        // إعداد بيانات الإشعار
        $payload = json_encode([
            'title' => $notification['title'],
            'body' => $notification['body'],
            'icon' => $notification['icon'] ?? '',
            'badge' => $notification['badge'] ?? '',
            'tag' => $notification['tag'] ?? '',
            'data' => $notification['data'] ?? []
        ]);
        
        // إعداد headers للطلب
        $headers = [
            'Content-Type: application/json',
            'TTL: 60'
        ];
        
        // ملاحظة: لإرسال Web Push بشكل صحيح، نحتاج:
        // 1. VAPID public key في header 'Authorization: vapid t=<JWT>'
        // 2. VAPID public key في header 'Crypto-Key: p256ecdsa=<public_key>'
        // 3. تشفير payload باستخدام p256dh و auth keys
        
        // حالياً نرسل الطلب بدون VAPID (قد لا يعمل في بعض المتصفحات)
        // لكن هذا أفضل من عدم المحاولة على الإطلاق
        
        // استخدام cURL لإرسال الطلب
        $ch = curl_init($endpoint);
        if (!$ch) {
            throw new Exception('فشل تهيئة cURL');
        }
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        // معالجة النتيجة
        if ($curlError) {
            error_log("خطأ cURL في إرسال Web Push: $curlError");
            return;
        }
        
        if ($httpCode >= 200 && $httpCode < 300) {
            error_log("✅ تم إرسال Web Push بنجاح: $endpoint (HTTP $httpCode)");
        } elseif ($httpCode === 401 || $httpCode === 403) {
            // خطأ في المصادقة - عادة بسبب عدم وجود VAPID keys
            error_log("⚠️ فشل إرسال Web Push - يحتاج VAPID keys: $endpoint (HTTP $httpCode)");
        } elseif ($httpCode === 410) {
            // Subscription منتهية - يجب حذفها
            error_log("⚠️ Subscription منتهية: $endpoint (HTTP $httpCode)");
        } else {
            error_log("❌ فشل إرسال Web Push: $endpoint (HTTP $httpCode)");
        }
        
    } catch (Exception $e) {
        error_log('خطأ في sendWebPushNotification: ' . $e->getMessage());
        // لا نرمي الخطأ حتى لا نوقف العملية
    }
}

/**
 * إرسال إشعار عبر Firebase Cloud Messaging
 */
function sendFCMNotification($endpoint, $notification) {
    // FCM يتطلب server key خاص من Firebase Console
    // حالياً نتركه كـ placeholder
    error_log('FCM notification (غير مدعوم حالياً - يحتاج Firebase Server Key): ' . $endpoint);
}
?>


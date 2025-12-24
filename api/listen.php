<?php
/**
 * Long Polling endpoint للاستماع للرسائل الجديدة
 * يستخدم sleep(1) و timeout 20 ثانية
 */
require_once __DIR__ . '/config.php';

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // الحصول على last_id من الطلب
    $lastId = $_GET['last_id'] ?? '0';
    
    // إذا كان last_id فارغاً، استخدام '0' كقيمة افتراضية
    if (empty($lastId) || $lastId === '') {
        $lastId = '0';
    }
    
    // تحديث حالة النشاط للمستخدم
    updateUserActivity($userId);
    
    // إعداد timeout 20 ثانية
    set_time_limit(25); // 20 ثانية + 5 ثواني buffer
    ignore_user_abort(false);
    
    // Long Polling loop
    $maxIterations = 20; // 20 ثانية = 20 * sleep(1)
    $iteration = 0;
    
    while ($iteration < $maxIterations) {
        // البحث عن رسائل جديدة بعد last_id
        $newMessages = getNewMessages($lastId);
        
        if (!empty($newMessages)) {
            // تم العثور على رسائل جديدة - إرجاعها فوراً
            response(true, 'تم جلب الرسائل بنجاح', $newMessages);
            return; // إنهاء التنفيذ بعد إرجاع الرسائل
        }
        
        // انتظار ثانية واحدة قبل المحاولة التالية
        sleep(1);
        $iteration++;
        
        // التحقق من انقطاع الاتصال
        if (connection_aborted()) {
            exit;
        }
    }
    
    // انتهى الوقت - إرجاع array فارغ
    response(true, 'لا توجد رسائل جديدة', []);
    
} catch (Exception $e) {
    error_log('خطأ في listen.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في الاستماع للرسائل: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في listen.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في الاستماع للرسائل', null, 500);
}

/**
 * الحصول على الرسائل الجديدة بعد last_id
 */
function getNewMessages($lastId) {
    try {
        // إذا كان lastId = '0'، جلب آخر 50 رسالة
        if ($lastId === '0' || empty($lastId)) {
            $messages = dbSelect("
                SELECT 
                    cm.id,
                    cm.user_id,
                    COALESCE(u.name, u.username, 'مستخدم') as username,
                    cm.message,
                    cm.reply_to,
                    cm.created_at,
                    rm.id as reply_to_id,
                    rm.user_id as reply_to_user_id,
                    COALESCE(ru.name, ru.username, 'مستخدم') as reply_to_username,
                    rm.message as reply_to_message
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                LEFT JOIN chat_messages rm ON rm.id = cm.reply_to AND (rm.deleted_at IS NULL OR rm.deleted_at = '')
                LEFT JOIN users ru ON ru.id = rm.user_id
                WHERE (cm.deleted_at IS NULL OR cm.deleted_at = '')
                ORDER BY cm.id DESC
                LIMIT 50
            ", []);
            
            // عكس الترتيب (الأقدم أولاً)
            $messages = array_reverse($messages);
        } else {
            // استعلام للحصول على الرسائل الجديدة بعد last_id
            $messages = dbSelect("
                SELECT 
                    cm.id,
                    cm.user_id,
                    COALESCE(u.name, u.username, 'مستخدم') as username,
                    cm.message,
                    cm.reply_to,
                    cm.created_at,
                    rm.id as reply_to_id,
                    rm.user_id as reply_to_user_id,
                    COALESCE(ru.name, ru.username, 'مستخدم') as reply_to_username,
                    rm.message as reply_to_message
                FROM chat_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                LEFT JOIN chat_messages rm ON rm.id = cm.reply_to AND (rm.deleted_at IS NULL OR rm.deleted_at = '')
                LEFT JOIN users ru ON ru.id = rm.user_id
                WHERE cm.id > ? AND (cm.deleted_at IS NULL OR cm.deleted_at = '')
                ORDER BY cm.id ASC
                LIMIT 50
            ", [$lastId]);
        }
        
        // تنسيق البيانات
        $formattedMessages = [];
        foreach ($messages as $message) {
            $formattedMessage = [
                'id' => $message['id'],
                'user_id' => $message['user_id'],
                'username' => $message['username'],
                'message' => $message['message'],
                'created_at' => $message['created_at']
            ];
            
            // إضافة معلومات الرد إذا كان موجوداً
            if (!empty($message['reply_to'])) {
                $formattedMessage['reply_to'] = [
                    'id' => $message['reply_to_id'],
                    'user_id' => $message['reply_to_user_id'],
                    'username' => $message['reply_to_username'],
                    'message' => $message['reply_to_message']
                ];
            }
            
            $formattedMessages[] = $formattedMessage;
        }
        
        return $formattedMessages;
        
    } catch (Exception $e) {
        error_log('خطأ في getNewMessages: ' . $e->getMessage());
        return [];
    }
}

/**
 * تحديث حالة النشاط للمستخدم
 */
function updateUserActivity($userId) {
    try {
        // التحقق من وجود المستخدم في active_users
        $existing = dbSelectOne("SELECT * FROM active_users WHERE user_id = ?", [$userId]);
        
        if ($existing) {
            // تحديث last_activity
            dbExecute("
                UPDATE active_users 
                SET last_activity = NOW(), is_online = 1 
                WHERE user_id = ?
            ", [$userId]);
        } else {
            // إضافة المستخدم
            dbExecute("
                INSERT INTO active_users (user_id, last_activity, is_online)
                VALUES (?, NOW(), 1)
                ON DUPLICATE KEY UPDATE last_activity = NOW(), is_online = 1
            ", [$userId]);
        }
    } catch (Exception $e) {
        error_log('خطأ في updateUserActivity: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    }
}
?>


<?php
/**
 * الحصول على حالة النشاط للمستخدمين
 */
require_once __DIR__ . '/config.php';

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    $method = getRequestMethod();
    $data = getRequestData();
    
    // الحصول على user_ids من الطلب
    $userIds = [];
    
    if ($method === 'GET') {
        // من query string
        if (isset($_GET['user_ids'])) {
            $userIds = is_array($_GET['user_ids']) ? $_GET['user_ids'] : explode(',', $_GET['user_ids']);
        } elseif (isset($_GET['user_id'])) {
            $userIds = [$_GET['user_id']];
        }
    } else {
        // من POST data
        if (isset($data['user_ids'])) {
            $userIds = is_array($data['user_ids']) ? $data['user_ids'] : explode(',', $data['user_ids']);
        } elseif (isset($data['user_id'])) {
            $userIds = [$data['user_id']];
        }
    }
    
    // إذا لم يتم تحديد user_ids، إرجاع حالة جميع المستخدمين
    if (empty($userIds)) {
        $userIds = null;
    }
    
    // الحصول على حالة النشاط
    $activities = getUserActivities($userIds);
    
    response(true, 'تم جلب حالة النشاط بنجاح', $activities);
    
} catch (Exception $e) {
    error_log('خطأ في get_user_activity.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في جلب حالة النشاط: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في get_user_activity.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في جلب حالة النشاط', null, 500);
}

/**
 * الحصول على حالة النشاط للمستخدمين
 */
function getUserActivities($userIds = null) {
    try {
        $activities = [];
        
        if ($userIds === null) {
            // الحصول على حالة جميع المستخدمين
            $users = dbSelect("
                SELECT 
                    u.id,
                    u.name,
                    u.username,
                    COALESCE(au.last_activity, u.created_at) as last_activity,
                    COALESCE(au.is_online, 0) as is_online
                FROM users u
                LEFT JOIN active_users au ON au.user_id = u.id
                ORDER BY u.name ASC
            ", []);
        } else {
            // الحصول على حالة مستخدمين محددين
            if (empty($userIds)) {
                return [];
            }
            
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $users = dbSelect("
                SELECT 
                    u.id,
                    u.name,
                    u.username,
                    COALESCE(au.last_activity, u.created_at) as last_activity,
                    COALESCE(au.is_online, 0) as is_online
                FROM users u
                LEFT JOIN active_users au ON au.user_id = u.id
                WHERE u.id IN ($placeholders)
                ORDER BY u.name ASC
            ", $userIds);
        }
        
        // حساب الوقت المنقضي لكل مستخدم
        foreach ($users as $user) {
            $lastActivity = $user['last_activity'];
            $timeAgo = calculateTimeAgo($lastActivity);
            
            $activities[] = [
                'user_id' => $user['id'],
                'name' => $user['name'],
                'username' => $user['username'],
                'last_activity' => $lastActivity,
                'is_online' => (bool)$user['is_online'],
                'time_ago' => $timeAgo,
                'time_ago_text' => formatTimeAgo($timeAgo)
            ];
        }
        
        return $activities;
        
    } catch (Exception $e) {
        error_log('خطأ في getUserActivities: ' . $e->getMessage());
        return [];
    }
}

/**
 * حساب الوقت المنقضي منذ آخر نشاط (بالثواني)
 */
function calculateTimeAgo($lastActivity) {
    if (empty($lastActivity)) {
        return null;
    }
    
    try {
        $lastActivityTime = new DateTime($lastActivity);
        $now = new DateTime();
        $diff = $now->getTimestamp() - $lastActivityTime->getTimestamp();
        
        return $diff;
    } catch (Exception $e) {
        error_log('خطأ في calculateTimeAgo: ' . $e->getMessage());
        return null;
    }
}

/**
 * تنسيق الوقت المنقضي كنص
 */
function formatTimeAgo($seconds) {
    if ($seconds === null) {
        return 'غير معروف';
    }
    
    if ($seconds < 60) {
        // أقل من دقيقة
        return 'نشط الآن';
    } elseif ($seconds < 3600) {
        // أقل من ساعة
        $minutes = floor($seconds / 60);
        return "نشط منذ $minutes دقيقة";
    } elseif ($seconds < 86400) {
        // أقل من 24 ساعة
        $hours = floor($seconds / 3600);
        return "نشط منذ $hours ساعة";
    } else {
        // أكثر من 24 ساعة
        $days = floor($seconds / 86400);
        return "نشط منذ $days يوم";
    }
}
?>


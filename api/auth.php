<?php
require_once 'config.php';

$method = getRequestMethod();

// تسجيل الدخول
if ($method === 'POST') {
    $data = getRequestData();
    
    // التحقق من طلب تسجيل الخروج
    if (isset($data['action']) && $data['action'] === 'logout') {
        session_start();
        
        // مسح جميع بيانات الجلسة
        $_SESSION = array();
        
        // حذف session cookie من المتصفح
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
        
        // تدمير الجلسة
        session_destroy();
        
        response(true, 'تم تسجيل الخروج بنجاح');
    }
    
    // تسجيل الدخول العادي
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    // تفعيل عرض الأخطاء للتصحيح
    error_log("تسجيل الدخول - اسم المستخدم: " . $username);
    
    if (empty($username) || empty($password)) {
        error_log("خطأ: اسم المستخدم أو كلمة المرور فارغة");
        response(false, 'اسم المستخدم وكلمة المرور مطلوبة', null, 400);
    }
    
    // التحقق من الاتصال بقاعدة البيانات
    $conn = getDBConnection();
    if (!$conn) {
        error_log("خطأ: فشل الاتصال بقاعدة البيانات");
        response(false, 'خطأ في الاتصال بقاعدة البيانات. تحقق من إعدادات قاعدة البيانات.', null, 500);
    }
    
    // البحث عن المستخدم في قاعدة البيانات
    try {
        $user = dbSelectOne(
            "SELECT id, username, password, name, role FROM users WHERE username = ?",
            [$username]
        );
        
        error_log("نتيجة البحث عن المستخدم: " . ($user ? "موجود" : "غير موجود"));
        
        if ($user) {
            error_log("المستخدم موجود - التحقق من كلمة المرور...");
            $passwordMatch = password_verify($password, $user['password']);
            error_log("نتيجة التحقق من كلمة المرور: " . ($passwordMatch ? "صحيحة" : "غير صحيحة"));
            
            if ($passwordMatch) {
                session_start();
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['name'] = $user['name'];
                $_SESSION['role'] = $user['role'];
                
                error_log("تم تسجيل الدخول بنجاح للمستخدم: " . $username);
                response(true, 'تم تسجيل الدخول بنجاح', [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role']
                ]);
            } else {
                error_log("كلمة المرور غير صحيحة للمستخدم: " . $username);
            }
        } else {
            error_log("المستخدم غير موجود: " . $username);
        }
    } catch (Exception $e) {
        error_log("خطأ في استعلام قاعدة البيانات: " . $e->getMessage());
        response(false, 'خطأ في قاعدة البيانات: ' . $e->getMessage(), null, 500);
    }
    
    response(false, 'اسم المستخدم أو كلمة المرور غير صحيحة', null, 401);
}

// التحقق من الجلسة
if ($method === 'GET') {
    session_start();
    if (isset($_SESSION['user_id'])) {
        response(true, 'الجلسة نشطة', [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'name' => $_SESSION['name'],
            'role' => $_SESSION['role']
        ]);
    } else {
        response(false, 'لا توجد جلسة نشطة', null, 401);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>



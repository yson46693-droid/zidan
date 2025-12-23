<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// التحقق من الجلسة
$session = checkAuth();
$currentUserId = $session['user_id'];

// قراءة بيانات الملف الشخصي للمستخدم الحالي
if ($method === 'GET') {
    try {
        $user = dbSelectOne(
            "SELECT id, username, name, role, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // إزالة الحقول الحساسة إن وجدت
        unset($user['password']);
        
        response(true, '', $user);
    } catch (Exception $e) {
        error_log('خطأ في قراءة الملف الشخصي: ' . $e->getMessage());
        response(false, 'خطأ في قراءة بيانات الملف الشخصي', null, 500);
    }
}

// تحديث بيانات الملف الشخصي للمستخدم الحالي
if ($method === 'PUT') {
    try {
        if (!isset($data['name']) && !isset($data['username']) && !isset($data['password'])) {
            $data = getRequestData();
        }
        
        // التحقق من وجود المستخدم
        $user = dbSelectOne("SELECT id, username FROM users WHERE id = ?", [$currentUserId]);
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // بناء استعلام التحديث
        $updateFields = [];
        $updateParams = [];
        
        // تحديث الاسم
        if (isset($data['name'])) {
            $name = trim($data['name']);
            if (empty($name)) {
                response(false, 'الاسم لا يمكن أن يكون فارغاً', null, 400);
            }
            $updateFields[] = "name = ?";
            $updateParams[] = $name;
        }
        
        // تحديث اسم المستخدم مع التحقق من عدم التكرار
        if (isset($data['username'])) {
            $username = trim($data['username']);
            if (empty($username)) {
                response(false, 'اسم المستخدم لا يمكن أن يكون فارغاً', null, 400);
            }
            
            // التحقق من أن اسم المستخدم الجديد غير موجود بالفعل (باستثناء المستخدم الحالي)
            $existingUser = dbSelectOne(
                "SELECT id FROM users WHERE username = ? AND id != ?",
                [$username, $currentUserId]
            );
            
            if ($existingUser) {
                response(false, 'اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر', null, 400);
            }
            
            $updateFields[] = "username = ?";
            $updateParams[] = $username;
            
            // تحديث اسم المستخدم في الجلسة أيضاً
            $_SESSION['username'] = $username;
        }
        
        // تحديث كلمة المرور
        if (isset($data['password']) && !empty($data['password'])) {
            $password = $data['password'];
            if (strlen($password) < 6) {
                response(false, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', null, 400);
            }
            $updateFields[] = "password = ?";
            $updateParams[] = password_hash($password, PASSWORD_DEFAULT);
        }
        
        // إذا لم يكن هناك أي تحديثات
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        // إضافة updated_at
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $currentUserId;
        
        // بناء وتنفيذ الاستعلام
        $query = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            error_log('خطأ في تحديث الملف الشخصي للمستخدم: ' . $currentUserId);
            response(false, 'خطأ في تحديث بيانات الملف الشخصي', null, 500);
        }
        
        // الحصول على البيانات المحدثة
        $updatedUser = dbSelectOne(
            "SELECT id, username, name, role, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        // تحديث الجلسة
        if (isset($data['name'])) {
            $_SESSION['name'] = $updatedUser['name'];
        }
        
        response(true, 'تم تحديث بيانات الملف الشخصي بنجاح', $updatedUser);
        
    } catch (Exception $e) {
        error_log('خطأ في تحديث الملف الشخصي: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء تحديث بيانات الملف الشخصي: ' . $e->getMessage(), null, 500);
    }
}

// التحقق من توفر اسم المستخدم (للتحقق الفوري في الواجهة)
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'check_username') {
    try {
        $username = trim($data['username'] ?? '');
        
        if (empty($username)) {
            response(false, 'اسم المستخدم فارغ', ['available' => false], 400);
        }
        
        // التحقق من أن اسم المستخدم غير موجود (باستثناء المستخدم الحالي)
        $existingUser = dbSelectOne(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            [$username, $currentUserId]
        );
        
        if ($existingUser) {
            response(true, 'اسم المستخدم موجود مسبقاً', ['available' => false], 200);
        } else {
            response(true, 'اسم المستخدم متاح', ['available' => true], 200);
        }
        
    } catch (Exception $e) {
        error_log('خطأ في التحقق من اسم المستخدم: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء التحقق من اسم المستخدم', null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// تسجيل المعلومات الأساسية للتشخيص
error_log('users.php - Method: ' . $method . ', Request Method: ' . getRequestMethod());
error_log('users.php - Data keys: ' . implode(', ', array_keys($data)));

// قراءة جميع المستخدمين
if ($method === 'GET') {
    checkPermission('admin');
    $users = dbSelect("SELECT id, username, name, role, created_at, updated_at FROM users ORDER BY created_at DESC");
    
    if ($users === false) {
        response(false, 'خطأ في قراءة المستخدمين', null, 500);
    }
    
    // التأكد من أن $users هي array (حتى لو كانت فارغة)
    if (!is_array($users)) {
        $users = [];
    }
    
    // التحقق من صحة كل مستخدم قبل الإرجاع
    $validUsers = [];
    foreach ($users as $user) {
        if (is_array($user) && isset($user['id'])) {
            $validUsers[] = $user;
        }
    }
    
    response(true, '', $validUsers);
}

// إضافة مستخدم جديد
if ($method === 'POST') {
    checkPermission('admin');
    
    // قراءة البيانات - إذا كانت الطريقة POST عادية (ليست PUT/DELETE محولة)،
    // يجب أن تكون البيانات في $data بالفعل من getRequestData() في السطر 5
    // لكن إذا كانت الطريقة POST محولة من PUT/DELETE، قد تحتوي على _method فقط
    if (empty($data) || (!isset($data['username']) && !isset($data['name']) && !isset($data['_method']))) {
        // محاولة قراءة البيانات مرة أخرى
        $data = getRequestData();
    }
    
    // تسجيل البيانات المستلمة للتشخيص
    error_log('POST /users.php - البيانات المستلمة: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
    error_log('POST /users.php - $_POST: ' . json_encode($_POST, JSON_UNESCAPED_UNICODE));
    if (isset($GLOBALS['_cached_request_data'])) {
        error_log('POST /users.php - _cached_request_data: ' . json_encode($GLOBALS['_cached_request_data'], JSON_UNESCAPED_UNICODE));
    }
    
    // قراءة القيم من البيانات
    $username = isset($data['username']) ? trim($data['username']) : '';
    $password = isset($data['password']) ? $data['password'] : '';
    $name = isset($data['name']) ? trim($data['name']) : '';
    $role = isset($data['role']) ? $data['role'] : 'employee';
    
    // تسجيل القيم بعد المعالجة
    error_log('POST /users.php - القيم بعد المعالجة: username="' . $username . '", name="' . $name . '", password=' . (empty($password) ? '(empty)' : '(set)') . ', role="' . $role . '"');
    
    // التحقق من الحقول المطلوبة
    if (empty($username) || empty($password) || empty($name)) {
        error_log('POST /users.php - خطأ: الحقول المطلوبة فارغة - username: ' . (empty($username) ? 'empty' : 'ok') . ', password: ' . (empty($password) ? 'empty' : 'ok') . ', name: ' . (empty($name) ? 'empty' : 'ok'));
        response(false, 'جميع الحقول مطلوبة (username, password, name)', null, 400);
    }
    
    // التحقق من عدم تكرار اسم المستخدم
    $existingUser = dbSelectOne("SELECT id FROM users WHERE username = ?", [$username]);
    if ($existingUser) {
        response(false, 'اسم المستخدم موجود مسبقاً', null, 400);
    }
    
    $userId = generateId();
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $result = dbExecute(
        "INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [$userId, $username, $hashedPassword, $name, $role]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة المستخدم', null, 500);
    }
    
    $newUser = [
        'id' => $userId,
        'username' => $username,
        'name' => $name,
        'role' => $role,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    response(true, 'تم إضافة المستخدم بنجاح', $newUser);
}

// تعديل مستخدم
if ($method === 'PUT') {
    checkPermission('admin');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف المستخدم مطلوب', null, 400);
    }
    
    // التحقق من وجود المستخدم
    $user = dbSelectOne("SELECT id FROM users WHERE id = ?", [$id]);
    if (!$user) {
        response(false, 'المستخدم غير موجود', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    if (isset($data['name'])) {
        $updateFields[] = "name = ?";
        $updateParams[] = trim($data['name']);
    }
    
    if (isset($data['role'])) {
        $updateFields[] = "role = ?";
        $updateParams[] = $data['role'];
    }
    
    if (isset($data['password']) && !empty($data['password'])) {
        $updateFields[] = "password = ?";
        $updateParams[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل المستخدم', null, 500);
    }
    
    response(true, 'تم تعديل المستخدم بنجاح');
}

// حذف مستخدم
if ($method === 'DELETE') {
    checkPermission('admin');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف المستخدم مطلوب', null, 400);
    }
    
    // التحقق من وجود المستخدم
    $user = dbSelectOne("SELECT id FROM users WHERE id = ?", [$id]);
    if (!$user) {
        response(false, 'المستخدم غير موجود', null, 404);
    }
    
    $result = dbExecute("DELETE FROM users WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف المستخدم', null, 500);
    }
    
    response(true, 'تم حذف المستخدم بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع المستخدمين
if ($method === 'GET') {
    checkPermission('admin');
    $users = dbSelect("SELECT id, username, name, role, created_at, updated_at FROM users ORDER BY created_at DESC");
    
    if ($users === false) {
        response(false, 'خطأ في قراءة المستخدمين', null, 500);
    }
    
    response(true, '', $users);
}

// إضافة مستخدم جديد
if ($method === 'POST') {
    checkPermission('admin');
    if (!isset($data['username'])) {
        $data = getRequestData();
    }
    
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $name = trim($data['name'] ?? '');
    $role = $data['role'] ?? 'employee';
    
    if (empty($username) || empty($password) || empty($name)) {
        response(false, 'جميع الحقول مطلوبة', null, 400);
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

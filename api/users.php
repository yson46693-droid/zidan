<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// تسجيل المعلومات الأساسية للتشخيص
error_log('users.php - Method: ' . $method . ', Request Method: ' . getRequestMethod());
error_log('users.php - Data keys: ' . implode(', ', array_keys($data)));

// قراءة المستخدمين
if ($method === 'GET') {
    checkPermission('admin');
    
    // ✅ إذا كان هناك id أو username في query parameter، جلب مستخدم واحد
    $userId = $_GET['id'] ?? $data['id'] ?? null;
    $username = $_GET['username'] ?? $data['username'] ?? null;
    
    if ($userId || $username) {
        // ✅ التحقق من وجود الأعمدة قبل استخدامها في الاستعلام
        $hasAvatar = dbColumnExists('users', 'avatar');
        $hasSpecialization = dbColumnExists('users', 'specialization');
        $hasWebauthnEnabled = dbColumnExists('users', 'webauthn_enabled');
        
        // بناء الاستعلام بناءً على الأعمدة الموجودة
        $selectFields = "u.id, u.username, u.name, u.role, u.branch_id, u.salary";
        if ($hasAvatar) {
            $selectFields .= ", u.avatar";
        }
        if ($hasWebauthnEnabled) {
            $selectFields .= ", u.webauthn_enabled";
        }
        if ($hasSpecialization) {
            $selectFields .= ", u.specialization";
        }
        $selectFields .= ", b.name as branch_name, u.created_at, u.updated_at";
        
        // بناء شرط WHERE حسب المعامل الممرر
        $whereClause = "";
        $whereParams = [];
        
        if ($userId) {
            // تنظيف userId
            $userId = trim($userId);
            if (empty($userId) || $userId === 'null' || $userId === 'undefined') {
                response(false, 'معرف المستخدم غير صحيح', null, 400);
            }
            $whereClause = "WHERE u.id = ?";
            $whereParams[] = $userId;
        } elseif ($username) {
            // تنظيف username
            $username = trim($username);
            if (empty($username) || $username === 'null' || $username === 'undefined') {
                response(false, 'اسم المستخدم غير صحيح', null, 400);
            }
            $whereClause = "WHERE u.username = ?";
            $whereParams[] = $username;
        }
        
        // جلب بيانات المستخدم مع معلومات الفرع
        $user = dbSelectOne(
            "SELECT {$selectFields}
             FROM users u 
             LEFT JOIN branches b ON u.branch_id = b.id 
             {$whereClause}",
            $whereParams
        );
        
        if (!$user || $user === false) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // إزالة الحقول الحساسة
        unset($user['password']);
        
        // التأكد من وجود جميع الحقول (تعيين null للأعمدة غير الموجودة)
        if (!isset($user['avatar'])) {
            $user['avatar'] = null;
        }
        if (!isset($user['specialization'])) {
            $user['specialization'] = null;
        }
        if (!isset($user['webauthn_enabled'])) {
            $user['webauthn_enabled'] = 0;
        }
        
        response(true, '', $user);
    }
    
    // ✅ إذا لم يكن هناك id، جلب جميع المستخدمين
    $users = dbSelect("SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at, u.updated_at 
                       FROM users u 
                       LEFT JOIN branches b ON u.branch_id = b.id 
                       ORDER BY u.created_at DESC");
    
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
    $branchId = isset($data['branch_id']) && !empty($data['branch_id']) ? trim($data['branch_id']) : null;
    $salary = isset($data['salary']) ? floatval($data['salary']) : 0.00;
    
    // التحقق من صحة نوع الدور
    if (!in_array($role, ['admin', 'manager', 'employee', 'technician'])) {
        response(false, 'نوع الدور غير صحيح', null, 400);
    }
    
    // التحقق من الفرع (مطلوب لجميع الأدوار عدا المالك)
    if ($role !== 'admin' && !$branchId) {
        response(false, 'الفرع مطلوب لجميع الأدوار عدا المالك', null, 400);
    }
    
    // التحقق من وجود الفرع إذا كان محدداً
    if ($branchId) {
        $branch = dbSelectOne("SELECT id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            response(false, 'الفرع المحدد غير موجود', null, 404);
        }
    }
    
    // تسجيل القيم بعد المعالجة
    error_log('POST /users.php - القيم بعد المعالجة: username="' . $username . '", name="' . $name . '", password=' . (empty($password) ? '(empty)' : '(set)') . ', role="' . $role . '", branch_id="' . ($branchId ?? 'NULL') . '"');
    
    // التحقق من الحقول المطلوبة
    if (empty($username) || empty($password) || empty($name)) {
        error_log('POST /users.php - خطأ: الحقول المطلوبة فارغة - username: ' . (empty($username) ? 'empty' : 'ok') . ', password: ' . (empty($password) ? 'empty' : 'ok') . ', name: ' . (empty($name) ? 'empty' : 'ok'));
        response(false, 'جميع الحقول مطلوبة (username, password, name)', null, 400);
    }
    
    // ✅ التحقق من عدم تكرار اسم المستخدم
    // استخدام BINARY للتأكد من المقارنة الحساسة لحالة الأحرف (case-sensitive)
    $existingUser = dbSelectOne("SELECT id FROM users WHERE BINARY username = ?", [$username]);
    if ($existingUser) {
        response(false, 'اسم المستخدم موجود مسبقاً', null, 400);
    }
    
    $userId = generateId();
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $result = dbExecute(
        "INSERT INTO users (id, username, password, name, role, branch_id, salary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
        [$userId, $username, $hashedPassword, $name, $role, $branchId, $salary]
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

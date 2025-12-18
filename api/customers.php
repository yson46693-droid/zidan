<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع العملاء
if ($method === 'GET') {
    checkAuth();
    $customers = dbSelect("SELECT * FROM customers ORDER BY created_at DESC");
    
    if ($customers === false) {
        response(false, 'خطأ في قراءة العملاء', null, 500);
    }
    
    response(true, '', $customers);
}

// إضافة عميل جديد
if ($method === 'POST') {
    checkAuth();
    if (!isset($data['name'])) {
        $data = getRequestData();
    }
    
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $address = trim($data['address'] ?? '');
    
    if (empty($name) || empty($phone)) {
        response(false, 'الاسم ورقم الهاتف مطلوبان', null, 400);
    }
    
    $session = checkAuth();
    $customerId = generateId();
    
    $result = dbExecute(
        "INSERT INTO customers (id, name, phone, address, created_at, created_by) VALUES (?, ?, ?, ?, NOW(), ?)",
        [$customerId, $name, $phone, $address, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة العميل', null, 500);
    }
    
    $newCustomer = dbSelectOne("SELECT * FROM customers WHERE id = ?", [$customerId]);
    
    response(true, 'تم إضافة العميل بنجاح', $newCustomer);
}

// تعديل عميل
if ($method === 'PUT') {
    checkAuth();
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$id]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    if (isset($data['name'])) {
        $updateFields[] = "name = ?";
        $updateParams[] = trim($data['name']);
    }
    
    if (isset($data['phone'])) {
        $updateFields[] = "phone = ?";
        $updateParams[] = trim($data['phone']);
    }
    
    if (isset($data['address'])) {
        $updateFields[] = "address = ?";
        $updateParams[] = trim($data['address']);
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE customers SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل العميل', null, 500);
    }
    
    response(true, 'تم تعديل العميل بنجاح');
}

// حذف عميل
if ($method === 'DELETE') {
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$id]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    $result = dbExecute("DELETE FROM customers WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف العميل', null, 500);
    }
    
    response(true, 'تم حذف العميل بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

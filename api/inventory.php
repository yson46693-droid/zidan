<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع قطع الغيار
if ($method === 'GET') {
    checkAuth();
    $inventory = dbSelect("SELECT * FROM inventory ORDER BY created_at DESC");
    
    if ($inventory === false) {
        response(false, 'خطأ في قراءة المخزون', null, 500);
    }
    
    response(true, '', $inventory);
}

// إضافة قطعة غيار جديدة
if ($method === 'POST') {
    checkPermission('manager');
    if (!isset($data['name'])) {
        $data = getRequestData();
    }
    
    $name = trim($data['name'] ?? '');
    $quantity = intval($data['quantity'] ?? 0);
    $purchase_price = floatval($data['purchase_price'] ?? 0);
    $selling_price = floatval($data['selling_price'] ?? 0);
    $category = trim($data['category'] ?? '');
    
    if (empty($name)) {
        response(false, 'اسم القطعة مطلوب', null, 400);
    }
    
    $session = checkAuth();
    $itemId = generateId();
    
    $result = dbExecute(
        "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, category, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
        [$itemId, $name, $quantity, $purchase_price, $selling_price, $category, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة قطعة الغيار', null, 500);
    }
    
    $newItem = dbSelectOne("SELECT * FROM inventory WHERE id = ?", [$itemId]);
    
    response(true, 'تم إضافة قطعة الغيار بنجاح', $newItem);
}

// تعديل قطعة غيار
if ($method === 'PUT') {
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف القطعة مطلوب', null, 400);
    }
    
    // التحقق من وجود القطعة
    $item = dbSelectOne("SELECT id FROM inventory WHERE id = ?", [$id]);
    if (!$item) {
        response(false, 'قطعة الغيار غير موجودة', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    if (isset($data['name'])) {
        $updateFields[] = "name = ?";
        $updateParams[] = trim($data['name']);
    }
    
    if (isset($data['quantity'])) {
        $updateFields[] = "quantity = ?";
        $updateParams[] = intval($data['quantity']);
    }
    
    if (isset($data['purchase_price'])) {
        $updateFields[] = "purchase_price = ?";
        $updateParams[] = floatval($data['purchase_price']);
    }
    
    if (isset($data['selling_price'])) {
        $updateFields[] = "selling_price = ?";
        $updateParams[] = floatval($data['selling_price']);
    }
    
    if (isset($data['category'])) {
        $updateFields[] = "category = ?";
        $updateParams[] = trim($data['category']);
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE inventory SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل قطعة الغيار', null, 500);
    }
    
    response(true, 'تم تعديل قطعة الغيار بنجاح');
}

// حذف قطعة غيار
if ($method === 'DELETE') {
    checkPermission('admin');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف القطعة مطلوب', null, 400);
    }
    
    // التحقق من وجود القطعة
    $item = dbSelectOne("SELECT id FROM inventory WHERE id = ?", [$id]);
    if (!$item) {
        response(false, 'قطعة الغيار غير موجودة', null, 404);
    }
    
    $result = dbExecute("DELETE FROM inventory WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف قطعة الغيار', null, 500);
    }
    
    response(true, 'تم حذف قطعة الغيار بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

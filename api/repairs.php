<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع عمليات الصيانة
if ($method === 'GET') {
    checkAuth();
    $repairs = dbSelect("SELECT * FROM repairs ORDER BY created_at DESC");
    
    if ($repairs === false) {
        response(false, 'خطأ في قراءة عمليات الصيانة', null, 500);
    }
    
    // إضافة cost للتوافق مع الكود القديم
    foreach ($repairs as &$repair) {
        $repair['cost'] = $repair['customer_price'];
    }
    
    response(true, '', $repairs);
}

// إضافة عملية صيانة جديدة
if ($method === 'POST') {
    checkAuth();
    if (!isset($data['_method'])) {
        $data = getRequestData();
    }
    
    $customer_id = $data['customer_id'] ?? null;
    $customer_name = trim($data['customer_name'] ?? '');
    $customer_phone = trim($data['customer_phone'] ?? '');
    $device_type = trim($data['device_type'] ?? '');
    $device_model = trim($data['device_model'] ?? '');
    $serial_number = trim($data['serial_number'] ?? '');
    $accessories = trim($data['accessories'] ?? '');
    $problem = trim($data['problem'] ?? '');
    $repair_type = trim($data['repair_type'] ?? 'soft');
    // التحقق من صحة نوع الصيانة
    if (!in_array($repair_type, ['soft', 'hard', 'fast'])) {
        $repair_type = 'soft';
    }
    $customer_price = floatval($data['customer_price'] ?? 0);
    $repair_cost = floatval($data['repair_cost'] ?? 0);
    $parts_store = trim($data['parts_store'] ?? '');
    $paid_amount = floatval($data['paid_amount'] ?? 0);
    $remaining_amount = floatval($data['remaining_amount'] ?? 0);
    $delivery_date = $data['delivery_date'] ?? null;
    $device_image = $data['device_image'] ?? '';
    $status = $data['status'] ?? 'pending';
    $notes = trim($data['notes'] ?? '');
    
    if (empty($customer_name) || empty($customer_phone) || empty($device_type) || empty($problem)) {
        response(false, 'الحقول الأساسية مطلوبة', null, 400);
    }
    
    // توليد رقم عملية
    $todayCount = dbSelectOne(
        "SELECT COUNT(*) as count FROM repairs WHERE DATE(created_at) = CURDATE()",
        []
    );
    $count = $todayCount ? intval($todayCount['count']) : 0;
    $repairNumber = 'R' . date('Ymd') . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
    
    $repairId = generateId();
    $session = checkAuth();
    $createdBy = $session['user_id'];
    
    $result = dbExecute(
        "INSERT INTO repairs (
            id, repair_number, customer_id, customer_name, customer_phone, 
            device_type, device_model, serial_number, accessories, problem, repair_type,
            customer_price, repair_cost, parts_store, paid_amount, remaining_amount,
            delivery_date, device_image, status, notes, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [
            $repairId, $repairNumber, $customer_id, $customer_name, $customer_phone,
            $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
            $customer_price, $repair_cost, $parts_store, $paid_amount, $remaining_amount,
            $delivery_date, $device_image, $status, $notes, $createdBy
        ]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة عملية الصيانة', null, 500);
    }
    
    $newRepair = dbSelectOne("SELECT * FROM repairs WHERE id = ?", [$repairId]);
    $newRepair['cost'] = $newRepair['customer_price']; // للتوافق
    
    response(true, 'تم إضافة عملية الصيانة بنجاح', $newRepair);
}

// تعديل عملية صيانة
if ($method === 'PUT') {
    checkAuth();
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    // التحقق من وجود العملية
    $repair = dbSelectOne("SELECT id FROM repairs WHERE id = ?", [$id]);
    if (!$repair) {
        response(false, 'عملية الصيانة غير موجودة', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    $fields = [
        'customer_id', 'customer_name', 'customer_phone', 'device_type', 'device_model',
        'serial_number', 'accessories', 'problem', 'repair_type', 'customer_price', 'repair_cost',
        'parts_store', 'paid_amount', 'remaining_amount', 'delivery_date',
        'device_image', 'status', 'notes'
    ];
    
    // التحقق من صحة نوع الصيانة إذا كان موجوداً
    if (isset($data['repair_type']) && !in_array($data['repair_type'], ['soft', 'hard', 'fast'])) {
        $data['repair_type'] = 'soft';
    }
    
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if (in_array($field, ['customer_price', 'repair_cost', 'paid_amount', 'remaining_amount'])) {
                $updateFields[] = "$field = ?";
                $updateParams[] = floatval($data[$field]);
            } else {
                $updateFields[] = "$field = ?";
                $updateParams[] = $data[$field];
            }
        }
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE repairs SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل عملية الصيانة', null, 500);
    }
    
    response(true, 'تم تعديل عملية الصيانة بنجاح');
}

// حذف عملية صيانة
if ($method === 'DELETE') {
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    // التحقق من وجود العملية
    $repair = dbSelectOne("SELECT id FROM repairs WHERE id = ?", [$id]);
    if (!$repair) {
        response(false, 'عملية الصيانة غير موجودة', null, 404);
    }
    
    $result = dbExecute("DELETE FROM repairs WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف عملية الصيانة', null, 500);
    }
    
    response(true, 'تم حذف عملية الصيانة بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

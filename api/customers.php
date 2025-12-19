<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع العملاء
if ($method === 'GET') {
    checkAuth();
    
    // Filter by customer type if provided
    $customerType = $_GET['type'] ?? null;
    
    $query = "SELECT * FROM customers WHERE 1=1";
    $params = [];
    
    if ($customerType && in_array($customerType, ['retail', 'commercial'])) {
        $query .= " AND customer_type = ?";
        $params[] = $customerType;
    }
    
    $query .= " ORDER BY created_at DESC";
    
    $customers = dbSelect($query, $params);
    
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
    $customerType = trim($data['customer_type'] ?? 'retail');
    $shopName = trim($data['shop_name'] ?? '');
    
    // Validate customer type
    if (!in_array($customerType, ['retail', 'commercial'])) {
        $customerType = 'retail';
    }
    
    // Shop name is required for commercial customers
    if ($customerType === 'commercial' && empty($shopName)) {
        response(false, 'اسم المحل مطلوب للعملاء التجاريين', null, 400);
    }
    
    if (empty($name) || empty($phone)) {
        response(false, 'الاسم ورقم الهاتف مطلوبان', null, 400);
    }
    
    $session = checkAuth();
    $customerId = generateId();
    
    $result = dbExecute(
        "INSERT INTO customers (id, name, phone, address, customer_type, shop_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
        [$customerId, $name, $phone, $address, $customerType, $shopName ?: null, $session['user_id']]
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
    
    if (isset($data['customer_type'])) {
        $customerType = trim($data['customer_type']);
        if (in_array($customerType, ['retail', 'commercial'])) {
            $updateFields[] = "customer_type = ?";
            $updateParams[] = $customerType;
        }
    }
    
    if (isset($data['shop_name'])) {
        $updateFields[] = "shop_name = ?";
        $updateParams[] = trim($data['shop_name']) ?: null;
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

// الحصول على مبيعات العميل
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'sales') {
    checkAuth();
    
    $customerId = $_GET['customer_id'] ?? '';
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل أولاً
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // جلب مبيعات العميل فقط - التأكد من استخدام customer_id بشكل صحيح
    $sales = dbSelect(
        "SELECT s.*, u.name as created_by_name 
         FROM sales s 
         LEFT JOIN users u ON s.created_by = u.id 
         WHERE s.customer_id = ? AND s.customer_id IS NOT NULL
         ORDER BY s.created_at DESC",
        [$customerId]
    );
    
    if ($sales === false) {
        response(false, 'خطأ في قراءة المبيعات', null, 500);
    }
    
    // التأكد من أن $sales هو array
    if (!is_array($sales)) {
        $sales = [];
    }
    
    // فلترة المبيعات للتأكد من أنها تخص هذا العميل فقط
    $sales = array_filter($sales, function($sale) use ($customerId) {
        return !empty($sale['customer_id']) && $sale['customer_id'] === $customerId;
    });
    
    // إعادة ترقيم المصفوفة
    $sales = array_values($sales);
    
    // جلب عناصر كل عملية بيع
    foreach ($sales as &$sale) {
        // التأكد من وجود sale id
        if (empty($sale['id'])) {
            continue;
        }
        
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        $sale['items'] = (is_array($items) && count($items) > 0) ? $items : [];
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            // إذا لم يكن هناك sale_number، استخدام id كبديل
            $sale['sale_number'] = $sale['id'];
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
    }
    
    response(true, '', $sales);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

<?php
require_once 'config.php';
require_once 'invoices.php';

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
    $customer = dbSelectOne("SELECT id, phone FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // Migration: تحديث الفواتير القديمة التي لا تحتوي على customer_id
    // البحث عن فواتير بدون customer_id ولكن رقم الهاتف يطابق العميل
    if (!empty($customer['phone'])) {
        try {
            // التحقق من وجود عمود customer_id في جدول sales
            if (dbColumnExists('sales', 'customer_id')) {
                // تحديث الفواتير التي لا تحتوي على customer_id ولكن رقم الهاتف يطابق
                $updated = dbExecute(
                    "UPDATE sales 
                     SET customer_id = ? 
                     WHERE (customer_id IS NULL OR customer_id = '') 
                     AND customer_phone = ?",
                    [$customerId, $customer['phone']]
                );
                if ($updated !== false) {
                    error_log("تم تحديث $updated فاتورة قديمة بربطها بالعميل $customerId");
                }
            }
        } catch (Exception $e) {
            error_log('ملاحظة: فشل تحديث الفواتير القديمة: ' . $e->getMessage());
        }
    }
    
    // جلب مبيعات العميل - البحث باستخدام customer_id أولاً، ثم رقم الهاتف كـ fallback
    // هذا يضمن جلب جميع الفواتير (القديمة والجديدة)
    $sales = dbSelect(
        "SELECT s.*, u.name as created_by_name 
         FROM sales s 
         LEFT JOIN users u ON s.created_by = u.id 
         WHERE (
             s.customer_id = ?
             OR 
             (COALESCE(s.customer_id, '') = '' AND s.customer_phone = ?)
         )
         ORDER BY s.created_at DESC",
        [$customerId, $customer['phone']]
    );
    
    if ($sales === false) {
        response(false, 'خطأ في قراءة المبيعات', null, 500);
    }
    
    // التأكد من أن $sales هو array
    if (!is_array($sales)) {
        $sales = [];
    }
    
    // فلترة إضافية للمبيعات والتأكد من ربطها بالعميل
    $filteredSales = [];
    foreach ($sales as $sale) {
        // التأكد من وجود sale id
        if (empty($sale['id'])) {
            continue;
        }
        
        // التحقق من ربط الفاتورة بالعميل
        $isCustomerMatch = (
            (!empty($sale['customer_id']) && $sale['customer_id'] === $customerId) ||
            (!empty($sale['customer_phone']) && $sale['customer_phone'] === $customer['phone'])
        );
        
        if (!$isCustomerMatch) {
            // إذا لم تكن الفاتورة مرتبطة بالعميل، تخطيها
            continue;
        }
        
        // إذا كانت الفاتورة لا تحتوي على customer_id ولكن رقم الهاتف يطابق، تحديثها تلقائياً
        if (empty($sale['customer_id']) || $sale['customer_id'] !== $customerId) {
            if (!empty($sale['customer_phone']) && $sale['customer_phone'] === $customer['phone']) {
                // تحديث الفاتورة بربطها بالعميل
                if (dbColumnExists('sales', 'customer_id')) {
                    $updateResult = dbExecute(
                        "UPDATE sales SET customer_id = ? WHERE id = ?",
                        [$customerId, $sale['id']]
                    );
                    if ($updateResult !== false) {
                        $sale['customer_id'] = $customerId;
                    }
                }
            }
        }
        
        // جلب عناصر الفاتورة
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        
        // التأكد من وجود عناصر في الفاتورة (لتصفية الفواتير الفارغة)
        if (!is_array($items) || count($items) === 0) {
            continue; // تخطي الفواتير بدون عناصر
        }
        
        $sale['items'] = $items;
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            $sale['sale_number'] = $sale['id'];
        }
        
        // حساب المبالغ من العناصر إذا كانت غير موجودة أو قيمتها 0
        $calculatedTotal = 0;
        foreach ($items as $item) {
            $itemTotal = floatval($item['total_price'] ?? 0);
            $itemQuantity = intval($item['quantity'] ?? 1);
            $calculatedTotal += ($itemTotal * $itemQuantity);
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
        
        // إذا كانت المبالغ 0، نستخدم القيم المحسوبة من العناصر
        if ($sale['total_amount'] == 0 && $calculatedTotal > 0) {
            $sale['total_amount'] = $calculatedTotal;
        }
        if ($sale['final_amount'] == 0 && $calculatedTotal > 0) {
            $sale['final_amount'] = $calculatedTotal - $sale['discount'] + $sale['tax'];
        }
        
        // إضافة مسار ملف الفاتورة - إنشاء الملف إذا لم يكن موجوداً
        $saleNumber = $sale['sale_number'] ?? $sale['id'] ?? '';
        if (!empty($saleNumber)) {
            // أولاً، التحقق من وجود الملف
            $invoiceFilePath = getInvoiceFilePath($saleNumber);
            
            // إذا لم يكن الملف موجوداً، قم بإنشائه من بيانات الفاتورة الحالية
            if (!$invoiceFilePath && !empty($sale['items']) && is_array($sale['items']) && count($sale['items']) > 0) {
                try {
                    // استخدام بيانات الفاتورة الموجودة بالفعل (لا حاجة لجلبها مرة أخرى)
                    // التأكد من وجود sale_number
                    if (empty($sale['sale_number'])) {
                        $sale['sale_number'] = $sale['id'];
                    }
                    
                    // التأكد من وجود القيم الرقمية
                    $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
                    $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
                    $sale['discount'] = floatval($sale['discount'] ?? 0);
                    $sale['tax'] = floatval($sale['tax'] ?? 0);
                    
                    // إنشاء ملف الفاتورة
                    $createdFilePath = saveInvoiceAsFile($sale);
                    if ($createdFilePath) {
                        $invoiceFilePath = $createdFilePath;
                    }
                } catch (Exception $e) {
                    // في حالة حدوث خطأ، لا نوقف العملية - فقط نسجل الخطأ
                    error_log('خطأ في إنشاء ملف الفاتورة للفاتورة ' . $saleNumber . ': ' . $e->getMessage());
                }
            }
            
            // إضافة مسار الملف إذا كان موجوداً
            if ($invoiceFilePath) {
                $sale['invoice_file_path'] = $invoiceFilePath;
            }
        }
        
        $filteredSales[] = $sale;
    }
    
    $sales = $filteredSales;
    
    response(true, '', $sales);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

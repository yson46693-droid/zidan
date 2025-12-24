<?php
require_once 'config.php';
require_once 'invoices.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// تسجيل للتحقق من البيانات المستلمة (للتطوير فقط)
if (isset($data['action']) && $data['action'] === 'update_rating') {
    error_log('update_rating request - method: ' . $method . ', data: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
}

/**
 * معالج أخطاء قاعدة البيانات - التحقق من الجداول الناقصة تلقائياً
 */
function handleDatabaseError($error, $query = '') {
    // التحقق من وجود خطأ متعلق بجدول غير موجود
    if (strpos($error, "doesn't exist") !== false || strpos($error, 'Table') !== false) {
        error_log("⚠️ تم اكتشاف جدول ناقص: $error");
        
        // استدعاء ملف التحقق من قاعدة البيانات
        if (file_exists(__DIR__ . '/check-database.php')) {
            require_once __DIR__ . '/check-database.php';
            $checkResult = checkAndCreateMissingTables();
            
            if ($checkResult['success'] && !empty($checkResult['tables_created'])) {
                error_log("✅ تم إنشاء الجداول الناقصة تلقائياً: " . implode(', ', $checkResult['tables_created']));
                // إعادة المحاولة بعد إنشاء الجداول
                return true;
            }
        }
        
        // محاولة استدعاء setupDatabase مباشرة
        if (file_exists(__DIR__ . '/setup.php')) {
            require_once __DIR__ . '/setup.php';
            $setupResult = setupDatabase();
            
            if ($setupResult['success'] && !empty($setupResult['tables_created'])) {
                error_log("✅ تم إنشاء الجداول الناقصة تلقائياً: " . implode(', ', $setupResult['tables_created']));
                return true;
            }
        }
    }
    
    return false;
}

// الحصول على مبيعات العميل - يجب أن يكون قبل الشرط العام GET
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
    // استخدام OR للبحث في كلا الحالتين
    $sales = dbSelect(
        "SELECT s.*, u.name as created_by_name 
         FROM sales s 
         LEFT JOIN users u ON s.created_by = u.id 
         WHERE (
             s.customer_id = ?
             OR 
             (s.customer_phone = ? AND (s.customer_id IS NULL OR s.customer_id = ''))
         )
         ORDER BY s.created_at DESC",
        [$customerId, $customer['phone']]
    );
    
    if ($sales === false) {
        error_log("خطأ في جلب مبيعات العميل $customerId: " . (isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف'));
        response(false, 'خطأ في قراءة المبيعات', null, 500);
    }
    
    // التأكد من أن $sales هو array
    if (!is_array($sales)) {
        $sales = [];
    }
    
    error_log("تم جلب " . count($sales) . " فاتورة للعميل $customerId (رقم الهاتف: " . ($customer['phone'] ?? 'غير محدد') . ")");
    
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
        
        // التأكد من أن $items هو array
        if (!is_array($items)) {
            $items = [];
        }
        
        // إذا كانت الفاتورة بدون عناصر، نسجل تحذير لكن نستمر (قد تكون فاتورة قديمة)
        if (count($items) === 0) {
            error_log("تحذير: الفاتورة " . ($sale['sale_number'] ?? $sale['id']) . " لا تحتوي على عناصر");
            // نستمر في المعالجة لكن نضيف items كـ array فارغ
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

// الحصول على التقييم التراكمي للعميل
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'rating') {
    checkAuth();
    
    $customerId = $_GET['customer_id'] ?? '';
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // حساب التقييم التراكمي (متوسط التقييمات)
    $ratingResult = dbSelectOne(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
         FROM customer_ratings 
         WHERE customer_id = ?",
        [$customerId]
    );
    
    $averageRating = $ratingResult ? floatval($ratingResult['average_rating'] ?? 0) : 0;
    $totalRatings = $ratingResult ? intval($ratingResult['total_ratings'] ?? 0) : 0;
    
    response(true, '', [
        'average_rating' => round($averageRating, 2),
        'total_ratings' => $totalRatings
    ]);
}

// قراءة جميع العملاء
if ($method === 'GET') {
    checkAuth();
    
    // Filter by customer type if provided
    $customerType = $_GET['type'] ?? null;
    
    // استخدام استعلام محسّن متوافق مع ONLY_FULL_GROUP_BY
    // تحديد الأعمدة صراحة بدلاً من c.* لتجنب مشاكل GROUP BY
    $query = "SELECT c.id, c.name, c.phone, c.address, c.customer_type, c.shop_name, c.notes, c.created_at, c.updated_at, c.created_by,
              COALESCE(AVG(cr.rating), 0) as average_rating,
              COUNT(cr.id) as total_ratings
              FROM customers c
              LEFT JOIN customer_ratings cr ON c.id = cr.customer_id
              WHERE 1=1";
    $params = [];
    
    if ($customerType && in_array($customerType, ['retail', 'commercial'])) {
        $query .= " AND c.customer_type = ?";
        $params[] = $customerType;
    }
    
    // إضافة جميع الأعمدة في GROUP BY للتوافق مع ONLY_FULL_GROUP_BY
    $query .= " GROUP BY c.id, c.name, c.phone, c.address, c.customer_type, c.shop_name, c.notes, c.created_at, c.updated_at, c.created_by ORDER BY c.created_at DESC";
    
    $customers = dbSelect($query, $params);
    
    if ($customers === false) {
        $error = isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف';
        error_log("خطأ في جلب العملاء: $error");
        
        // محاولة إصلاح قاعدة البيانات تلقائياً
        if (handleDatabaseError($error, $query)) {
            // إعادة المحاولة بعد إصلاح قاعدة البيانات
            $customers = dbSelect($query, $params);
            if ($customers === false) {
                error_log("فشل إصلاح قاعدة البيانات أو إعادة المحاولة");
                response(false, 'خطأ في قراءة العملاء بعد محاولة الإصلاح', null, 500);
            }
        } else {
            response(false, 'خطأ في قراءة العملاء', null, 500);
        }
    }
    
    // التأكد من أن $customers هو array (قد يكون null أو false)
    if (!is_array($customers)) {
        error_log("تحذير: dbSelect لم يرجع array للعملاء، القيمة: " . var_export($customers, true));
        $customers = [];
    }
    
    // تحويل التقييمات إلى أرقام
    foreach ($customers as &$customer) {
        $customer['average_rating'] = round(floatval($customer['average_rating'] ?? 0), 2);
        $customer['total_ratings'] = intval($customer['total_ratings'] ?? 0);
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
    
    if (isset($data['notes'])) {
        $updateFields[] = "notes = ?";
        $updateParams[] = trim($data['notes']);
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

// حفظ تقييم للعميل
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'rating') {
    checkAuth();
    
    $customerId = trim($data['customer_id'] ?? '');
    $saleId = trim($data['sale_id'] ?? '');
    $rating = intval($data['rating'] ?? 0);
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    if ($rating < 1 || $rating > 5) {
        response(false, 'التقييم يجب أن يكون بين 1 و 5', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // التحقق من وجود الفاتورة إذا تم إرسال sale_id
    if (!empty($saleId)) {
        $sale = dbSelectOne("SELECT id FROM sales WHERE id = ?", [$saleId]);
        if (!$sale) {
            response(false, 'الفاتورة غير موجودة', null, 404);
        }
    }
    
    $session = checkAuth();
    $ratingId = generateId();
    
    $result = dbExecute(
        "INSERT INTO customer_ratings (id, customer_id, sale_id, rating, rating_type, created_at, created_by) 
         VALUES (?, ?, ?, ?, 'transaction', NOW(), ?)",
        [$ratingId, $customerId, $saleId ?: null, $rating, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في حفظ التقييم', null, 500);
    }
    
    // حساب التقييم التراكمي الجديد
    $ratingResult = dbSelectOne(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
         FROM customer_ratings 
         WHERE customer_id = ?",
        [$customerId]
    );
    
    $averageRating = $ratingResult ? round(floatval($ratingResult['average_rating'] ?? 0), 2) : 0;
    
    response(true, 'تم حفظ التقييم بنجاح', [
        'rating_id' => $ratingId,
        'average_rating' => $averageRating
    ]);
}

// تعديل التقييم التراكمي (للمالك فقط)
// التحقق من PUT method (مباشرة أو عبر _method)
$isPutMethod = ($method === 'PUT' || ($method === 'POST' && isset($data['_method']) && $data['_method'] === 'PUT'));
if ($isPutMethod && isset($data['action']) && $data['action'] === 'update_rating') {
    checkPermission('admin'); // المالك فقط
    
    // إعادة قراءة البيانات للتأكد من الحصول على أحدث البيانات
    $requestData = getRequestData();
    $data = array_merge($data, $requestData);
    
    // محاولة قراءة customer_id من مصادر مختلفة
    $customerId = trim($data['customer_id'] ?? $data['id'] ?? '');
    $rating = intval($data['rating'] ?? 0);
    
    // تسجيل البيانات للتحقق
    error_log('update_rating request data: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
    
    if (empty($customerId)) {
        error_log('update_rating error: customer_id is empty. Data received: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    if ($rating < 1 || $rating > 5) {
        response(false, 'التقييم يجب أن يكون بين 1 و 5', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    $session = checkAuth();
    $ratingId = generateId();
    
    // حذف التقييمات اليدوية السابقة للعميل
    dbExecute(
        "DELETE FROM customer_ratings WHERE customer_id = ? AND rating_type = 'manual'",
        [$customerId]
    );
    
    // إضافة التقييم اليدوي الجديد
    $result = dbExecute(
        "INSERT INTO customer_ratings (id, customer_id, sale_id, rating, rating_type, created_at, created_by) 
         VALUES (?, ?, NULL, ?, 'manual', NOW(), ?)",
        [$ratingId, $customerId, $rating, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في تعديل التقييم', null, 500);
    }
    
    // حساب التقييم التراكمي الجديد
    $ratingResult = dbSelectOne(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
         FROM customer_ratings 
         WHERE customer_id = ?",
        [$customerId]
    );
    
    $averageRating = $ratingResult ? round(floatval($ratingResult['average_rating'] ?? 0), 2) : 0;
    
    response(true, 'تم تحديث التقييم بنجاح', [
        'rating_id' => $ratingId,
        'average_rating' => $averageRating
    ]);
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

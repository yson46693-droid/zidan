<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

/**
 * جلب الفرع الأول حسب تاريخ الإنشاء
 */
function getFirstBranchId() {
    $firstBranch = dbSelectOne(
        "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
    );
    return $firstBranch ? $firstBranch['id'] : null;
}

// جلب الماركات من قاعدة البيانات
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'brands') {
    checkAuth();
    
    try {
        $allBrands = [];
        
        // 1. جلب الماركات من جدول phones
        $phonesBrands = dbSelect("SELECT DISTINCT brand FROM phones WHERE brand IS NOT NULL AND brand != '' AND TRIM(brand) != ''", []);
        if (is_array($phonesBrands)) {
            foreach ($phonesBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 2. جلب الماركات من جدول spare_parts
        $sparePartsBrands = dbSelect("SELECT DISTINCT brand FROM spare_parts WHERE brand IS NOT NULL AND brand != '' AND TRIM(brand) != ''", []);
        if (is_array($sparePartsBrands)) {
            foreach ($sparePartsBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 3. جلب الماركات من جدول repairs (device_type) - قد تحتوي على ماركات غير موجودة في الجداول الأخرى
        $repairsBrands = dbSelect("SELECT DISTINCT device_type as brand FROM repairs WHERE device_type IS NOT NULL AND device_type != '' AND TRIM(device_type) != ''", []);
        if (is_array($repairsBrands)) {
            foreach ($repairsBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 4. جلب الماركات من جدول brsql (الجدول الرئيسي للماركات)
        $brsqlBrands = dbSelect("SELECT DISTINCT name as brand FROM brsql WHERE name IS NOT NULL AND name != '' AND TRIM(name) != '' ORDER BY name ASC", []);
        if (is_array($brsqlBrands)) {
            foreach ($brsqlBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
            error_log('تم جلب الماركات من جدول brsql: ' . count($brsqlBrands));
        }
        
        // إزالة التكرارات وترتيب الماركات
        $uniqueBrands = array_values(array_unique($allBrands));
        sort($uniqueBrands);
        
        // تسجيل عدد الماركات للتحقق
        error_log('عدد الماركات المجلوبة من phones: ' . (is_array($phonesBrands) ? count($phonesBrands) : 0));
        error_log('عدد الماركات المجلوبة من spare_parts: ' . (is_array($sparePartsBrands) ? count($sparePartsBrands) : 0));
        error_log('عدد الماركات المجلوبة من repairs: ' . (is_array($repairsBrands) ? count($repairsBrands) : 0));
        error_log('إجمالي الماركات الفريدة: ' . count($uniqueBrands));
        
        response(true, '', $uniqueBrands);
    } catch (Exception $e) {
        error_log('خطأ في جلب الماركات: ' . $e->getMessage());
        response(false, 'خطأ في جلب الماركات: ' . $e->getMessage(), null, 500);
    }
}

// قراءة جميع عمليات الصيانة
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    // بناء الاستعلام مع فلترة حسب الفرع
    $query = "SELECT r.*, b.name as branch_name 
              FROM repairs r 
              LEFT JOIN branches b ON r.branch_id = b.id 
              WHERE 1=1";
    $params = [];
    
    // فلترة حسب الفرع
    if ($userRole === 'admin') {
        // المالك: يمكنه فلترة حسب branch_id من query parameter
        $filterBranchId = $_GET['branch_id'] ?? null;
        if ($filterBranchId && $filterBranchId !== '') {
            $query .= " AND r.branch_id = ?";
            $params[] = $filterBranchId;
        }
        // إذا لم يتم تمرير branch_id، عرض جميع العمليات
    } else {
        // المستخدم العادي: فلترة تلقائية حسب فرعه
        if ($userBranchId) {
            $query .= " AND r.branch_id = ?";
            $params[] = $userBranchId;
        }
    }
    
    $query .= " ORDER BY r.created_at DESC";
    
    $repairs = dbSelect($query, $params);
    
    if ($repairs === false) {
        response(false, 'خطأ في قراءة عمليات الصيانة', null, 500);
    }
    
    // إضافة cost للتوافق مع الكود القديم ومعالجة أرقام الفواتير
    foreach ($repairs as &$repair) {
        $repair['cost'] = $repair['customer_price'];
        
        // معالجة أرقام فواتير قطع الغيار
        if (isset($repair['spare_parts_invoices']) && !empty($repair['spare_parts_invoices'])) {
            try {
                $invoices = json_decode($repair['spare_parts_invoices'], true);
                if (is_array($invoices)) {
                    $repair['spare_parts_invoices'] = $invoices;
                } else {
                    $repair['spare_parts_invoices'] = [];
                }
            } catch (Exception $e) {
                $repair['spare_parts_invoices'] = [];
            }
        } else {
            $repair['spare_parts_invoices'] = [];
        }
    }
    
    response(true, '', $repairs);
}

// إضافة عملية صيانة جديدة
if ($method === 'POST') {
    checkAuth();
    if (!isset($data['_method'])) {
        $data = getRequestData();
    }
    
    // Migration: إضافة spare_parts_invoices لحفظ أرقام فواتير قطع الغيار
    try {
        if (!dbColumnExists('repairs', 'spare_parts_invoices')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود spare_parts_invoices بعد parts_store
                $afterCol = dbColumnExists('repairs', 'parts_store') ? 'parts_store' : 'repair_cost';
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `spare_parts_invoices` text DEFAULT NULL AFTER `{$afterCol}`");
                error_log('تم إضافة عمود spare_parts_invoices إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود spare_parts_invoices: ' . $e->getMessage());
        }
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
    
    // معالجة أرقام فواتير قطع الغيار
    $spare_parts_invoices = null;
    if (isset($data['spare_parts_invoices']) && is_array($data['spare_parts_invoices']) && !empty($data['spare_parts_invoices'])) {
        // تصفية الأرقام الفارغة وتحويلها إلى JSON
        $filteredInvoices = array_filter(array_map('trim', $data['spare_parts_invoices']));
        if (!empty($filteredInvoices)) {
            $spare_parts_invoices = json_encode(array_values($filteredInvoices), JSON_UNESCAPED_UNICODE);
        }
    }
    
    $paid_amount = floatval($data['paid_amount'] ?? 0);
    $remaining_amount = floatval($data['remaining_amount'] ?? 0);
    $delivery_date = $data['delivery_date'] ?? null;
    $device_image = $data['device_image'] ?? '';
    $status = $data['status'] ?? 'received';
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
    $userBranchId = $session['branch_id'] ?? null;
    $userRole = $session['role'];
    
    // تحديد branch_id للعملية
    $repairBranchId = null;
    
    if ($userRole === 'admin') {
        // المالك: استخدام branch_id من البيانات أو الفرع الأول
        if (isset($data['branch_id']) && $data['branch_id'] !== '') {
            $repairBranchId = $data['branch_id'];
        } else {
            $repairBranchId = getFirstBranchId();
        }
    } else {
        // المستخدم العادي: استخدام فرعه
        if (!$userBranchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 400);
        }
        $repairBranchId = $userBranchId;
    }
    
    // بناء الاستعلام بناءً على وجود العمود
    $hasSparePartsInvoices = dbColumnExists('repairs', 'spare_parts_invoices');
    
    if ($hasSparePartsInvoices) {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, parts_store, spare_parts_invoices, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $parts_store, $spare_parts_invoices, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    } else {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, parts_store, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $parts_store, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    }
    
    if ($result === false) {
        response(false, 'خطأ في إضافة عملية الصيانة', null, 500);
    }
    
    $newRepair = dbSelectOne("SELECT * FROM repairs WHERE id = ?", [$repairId]);
    $newRepair['cost'] = $newRepair['customer_price']; // للتوافق
    
    // معالجة أرقام فواتير قطع الغيار
    if (isset($newRepair['spare_parts_invoices']) && !empty($newRepair['spare_parts_invoices'])) {
        try {
            $invoices = json_decode($newRepair['spare_parts_invoices'], true);
            if (is_array($invoices)) {
                $newRepair['spare_parts_invoices'] = $invoices;
            } else {
                $newRepair['spare_parts_invoices'] = [];
            }
        } catch (Exception $e) {
            $newRepair['spare_parts_invoices'] = [];
        }
    } else {
        $newRepair['spare_parts_invoices'] = [];
    }
    
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
        'parts_store', 'spare_parts_invoices', 'paid_amount', 'remaining_amount', 'delivery_date',
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
            } else if ($field === 'spare_parts_invoices') {
                // معالجة أرقام فواتير قطع الغيار
                $spare_parts_invoices = null;
                if (is_array($data[$field]) && !empty($data[$field])) {
                    $filteredInvoices = array_filter(array_map('trim', $data[$field]));
                    if (!empty($filteredInvoices)) {
                        $spare_parts_invoices = json_encode(array_values($filteredInvoices), JSON_UNESCAPED_UNICODE);
                    }
                }
                $updateFields[] = "$field = ?";
                $updateParams[] = $spare_parts_invoices;
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

<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة الموظفين والمديرين مع رواتبهم
if ($method === 'GET') {
    checkAuth();
    
    try {
        $branchId = $data['branch_id'] ?? null;
        
        // بناء الاستعلام
        $query = "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, 
                         b.name as branch_name
                  FROM users u 
                  LEFT JOIN branches b ON u.branch_id = b.id 
                  WHERE u.role IN ('employee', 'manager')";
        
        $params = [];
        
        // إذا كان branch_id محدداً، فلتر حسب الفرع
        if ($branchId && $branchId !== '') {
            $query .= " AND u.branch_id = ?";
            $params[] = $branchId;
        }
        
        $query .= " ORDER BY u.role, u.name ASC";
        
        $users = dbSelect($query, $params);
        
        if ($users === false) {
            response(false, 'خطأ في قراءة الموظفين', null, 500);
        }
        
        // إضافة معلومات المسحوبات والخصومات لكل مستخدم
        foreach ($users as &$user) {
            $userId = $user['id'];
            $currentMonth = date('Y-m');
            
            // الحصول على المسحوبات والخصومات للشهر الحالي
            $deductions = dbSelect(
                "SELECT id, amount, type, description, created_at 
                 FROM salary_deductions 
                 WHERE user_id = ? AND DATE_FORMAT(month_year, '%Y-%m') = ? 
                 ORDER BY created_at DESC",
                [$userId, $currentMonth]
            );
            
            $user['deductions'] = $deductions !== false ? $deductions : [];
            
            // حساب إجمالي المسحوبات والخصومات
            $totalDeductions = 0;
            if ($user['deductions']) {
                foreach ($user['deductions'] as $deduction) {
                    $totalDeductions += floatval($deduction['amount']);
                }
            }
            
            $user['total_deductions'] = $totalDeductions;
            $user['net_salary'] = floatval($user['salary'] ?? 0) - $totalDeductions;
        }
        
        response(true, '', $users);
    } catch (Exception $e) {
        error_log('Error in salaries.php GET: ' . $e->getMessage());
        response(false, 'خطأ في قراءة المستحقات', null, 500);
    }
}

// الحصول على تفاصيل مستخدم معين (للمودال)
if ($method === 'GET' && isset($data['action']) && $data['action'] === 'user_details') {
    checkAuth();
    
    try {
        $userId = $data['user_id'] ?? '';
        
        if (empty($userId)) {
            response(false, 'معرف المستخدم مطلوب', null, 400);
        }
        
        // الحصول على معلومات المستخدم
        $user = dbSelectOne(
            "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, 
                    b.name as branch_name
             FROM users u 
             LEFT JOIN branches b ON u.branch_id = b.id 
             WHERE u.id = ? AND u.role IN ('employee', 'manager')",
            [$userId]
        );
        
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // الحصول على جميع المسحوبات والخصومات
        $deductions = dbSelect(
            "SELECT id, amount, type, description, month_year, created_at 
             FROM salary_deductions 
             WHERE user_id = ? 
             ORDER BY month_year DESC, created_at DESC",
            [$userId]
        );
        
        $user['deductions'] = $deductions !== false ? $deductions : [];
        
        // تجميع المسحوبات حسب الشهر
        $monthlyDeductions = [];
        foreach ($user['deductions'] as $deduction) {
            $monthYear = $deduction['month_year'];
            if (!isset($monthlyDeductions[$monthYear])) {
                $monthlyDeductions[$monthYear] = [];
            }
            $monthlyDeductions[$monthYear][] = $deduction;
        }
        $user['monthly_deductions'] = $monthlyDeductions;
        
        response(true, '', $user);
    } catch (Exception $e) {
        error_log('Error in salaries.php user_details: ' . $e->getMessage());
        response(false, 'خطأ في قراءة تفاصيل المستخدم', null, 500);
    }
}

// إضافة مسحوبة/خصم
if ($method === 'POST') {
    checkPermission('manager');
    
    try {
        if (!isset($data['user_id']) || !isset($data['amount']) || !isset($data['type'])) {
            response(false, 'المستخدم والمبلغ والنوع مطلوبون', null, 400);
        }
        
        $userId = trim($data['user_id']);
        $amount = floatval($data['amount']);
        $deductionType = trim($data['type']); // 'withdrawal' أو 'deduction'
        $description = trim($data['description'] ?? '');
        $monthYear = $data['month_year'] ?? date('Y-m-d');
        
        if (empty($userId) || $amount <= 0) {
            response(false, 'المستخدم والمبلغ مطلوبان', null, 400);
        }
        
        // التحقق من وجود المستخدم
        $user = dbSelectOne("SELECT id FROM users WHERE id = ?", [$userId]);
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        $session = checkAuth();
        $deductionId = generateId();
        
        $result = dbExecute(
            "INSERT INTO salary_deductions (id, user_id, amount, type, description, month_year, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$deductionId, $userId, $amount, $deductionType, $description, $monthYear, $session['user_id']]
        );
        
        if ($result === false) {
            response(false, 'خطأ في إضافة المسحوبة/الخصم', null, 500);
        }
        
        $newDeduction = dbSelectOne("SELECT * FROM salary_deductions WHERE id = ?", [$deductionId]);
        
        response(true, 'تم إضافة المسحوبة/الخصم بنجاح', $newDeduction);
    } catch (Exception $e) {
        error_log('Error in salaries.php POST: ' . $e->getMessage());
        response(false, 'خطأ في إضافة المسحوبة/الخصم', null, 500);
    }
}

// تعديل مسحوبة/خصم
if ($method === 'PUT') {
    checkPermission('manager');
    
    try {
        if (!isset($data['id'])) {
            $data = getRequestData();
        }
        
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف المسحوبة/الخصم مطلوب', null, 400);
        }
        
        // التحقق من وجود المسحوبة/الخصم
        $deduction = dbSelectOne("SELECT id FROM salary_deductions WHERE id = ?", [$id]);
        if (!$deduction) {
            response(false, 'المسحوبة/الخصم غير موجود', null, 404);
        }
        
        // بناء استعلام التحديث
        $updateFields = [];
        $updateParams = [];
        
        if (isset($data['amount'])) {
            $updateFields[] = "amount = ?";
            $updateParams[] = floatval($data['amount']);
        }
        
        if (isset($data['type'])) {
            $updateFields[] = "type = ?";
            $updateParams[] = trim($data['type']);
        }
        
        if (isset($data['description'])) {
            $updateFields[] = "description = ?";
            $updateParams[] = trim($data['description']);
        }
        
        if (isset($data['month_year'])) {
            $updateFields[] = "month_year = ?";
            $updateParams[] = $data['month_year'];
        }
        
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $id;
        
        $query = "UPDATE salary_deductions SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            response(false, 'خطأ في تعديل المسحوبة/الخصم', null, 500);
        }
        
        response(true, 'تم تعديل المسحوبة/الخصم بنجاح');
    } catch (Exception $e) {
        error_log('Error in salaries.php PUT: ' . $e->getMessage());
        response(false, 'خطأ في تعديل المسحوبة/الخصم', null, 500);
    }
}

// حذف مسحوبة/خصم
if ($method === 'DELETE') {
    checkPermission('manager');
    
    try {
        if (!isset($data['id'])) {
            $data = getRequestData();
        }
        
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف المسحوبة/الخصم مطلوب', null, 400);
        }
        
        // التحقق من وجود المسحوبة/الخصم
        $deduction = dbSelectOne("SELECT id FROM salary_deductions WHERE id = ?", [$id]);
        if (!$deduction) {
            response(false, 'المسحوبة/الخصم غير موجود', null, 404);
        }
        
        $result = dbExecute("DELETE FROM salary_deductions WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف المسحوبة/الخصم', null, 500);
        }
        
        response(true, 'تم حذف المسحوبة/الخصم بنجاح');
    } catch (Exception $e) {
        error_log('Error in salaries.php DELETE: ' . $e->getMessage());
        response(false, 'خطأ في حذف المسحوبة/الخصم', null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


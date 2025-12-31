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

// قراءة جميع المصروفات
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    
    // فلترة حسب الفرع - للمالك يمكنه الفلترة حسب branch_id المرسل، للمستخدم العادي يرى فرعه فقط
    $branchId = $_GET['branch_id'] ?? $data['branch_id'] ?? null;
    
    // بناء الاستعلام
    $query = "SELECT e.*, b.name as branch_name 
              FROM expenses e 
              LEFT JOIN branches b ON e.branch_id = b.id 
              WHERE 1=1";
    $params = [];
    
    // إذا كان المستخدم غير مالك، فلترة حسب فرعه فقط
    if (!$isOwner && $userBranchId) {
        $query .= " AND e.branch_id = ?";
        $params[] = $userBranchId;
    } elseif ($isOwner && $branchId && $branchId !== '') {
        // المالك يمكنه اختيار الفرع
        $query .= " AND e.branch_id = ?";
        $params[] = $branchId;
    }
    
    $query .= " ORDER BY e.expense_date DESC, e.created_at DESC";
    
    $expenses = dbSelect($query, $params);
    
    if ($expenses === false) {
        response(false, 'خطأ في قراءة المصروفات', null, 500);
    }
    
    // إضافة date للتوافق مع الكود القديم
    foreach ($expenses as &$expense) {
        $expense['date'] = $expense['expense_date'];
    }
    
    response(true, '', $expenses);
}

// إضافة مصروف جديد
if ($method === 'POST') {
    checkPermission('manager');
    if (!isset($data['type'])) {
        $data = getRequestData();
    }
    
    $type = trim($data['type'] ?? 'أخرى'); // قيمة افتراضية إذا لم يتم إرسال النوع
    $amount = floatval($data['amount'] ?? 0);
    $expense_date = $data['date'] ?? $data['expense_date'] ?? date('Y-m-d');
    $description = trim($data['description'] ?? '');
    
    if ($amount <= 0) {
        response(false, 'المبلغ مطلوب', null, 400);
    }
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    
    // تحديد branch_id - المالك يمكنه اختيار الفرع، المستخدم العادي يستخدم فرعه
    $branchId = null;
    if ($isOwner) {
        // المالك: استخدام branch_id من البيانات أو الفرع الأول
        if (isset($data['branch_id']) && $data['branch_id'] !== '') {
            $branchId = $data['branch_id'];
        } else {
            $branchId = getFirstBranchId();
        }
    } else {
        // المستخدم العادي يستخدم فرعه المرتبط به
        $branchId = $userBranchId;
    }
    
    $expenseId = generateId();
    
    $result = dbExecute(
        "INSERT INTO expenses (id, type, amount, description, expense_date, branch_id, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
        [$expenseId, $type, $amount, $description, $expense_date, $branchId, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة المصروف', null, 500);
    }
    
    // إضافة معاملة في treasury_transactions
    if ($branchId) {
        $transactionId = generateId();
        $typeNames = [
            'rent' => 'إيجار',
            'electricity' => 'كهرباء',
            'salaries' => 'رواتب',
            'parts' => 'قطع غيار',
            'other' => 'أخرى'
        ];
        $typeName = $typeNames[$type] ?? $type;
        $transactionDescription = $typeName . ($description ? ' - ' . $description : '');
        
        // استخدام expense_date لتاريخ المعاملة
        $transactionDate = $expense_date;
        
        $transactionResult = dbExecute(
            "INSERT INTO treasury_transactions (
                id, branch_id, transaction_type, amount, description, 
                reference_id, reference_type, created_at, created_by
            ) VALUES (?, ?, 'expense', ?, ?, ?, 'expense', ?, ?)",
            [$transactionId, $branchId, $amount, $transactionDescription, $expenseId, $transactionDate . ' ' . date('H:i:s'), $session['user_id']]
        );
        
        if ($transactionResult === false) {
            error_log('❌ تحذير: فشل إضافة معاملة المصروف في treasury_transactions');
            // لا نوقف العملية، فقط نسجل التحذير
        } else {
            error_log('✅ تم إضافة معاملة المصروف في treasury_transactions بنجاح: ' . $amount . ' ج.م');
        }
    }
    
    $newExpense = dbSelectOne("SELECT e.*, b.name as branch_name FROM expenses e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.id = ?", [$expenseId]);
    if ($newExpense) {
        $newExpense['date'] = $newExpense['expense_date']; // للتوافق
    }
    
    response(true, 'تم إضافة المصروف بنجاح', $newExpense);
}

// تعديل مصروف
if ($method === 'PUT') {
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف المصروف مطلوب', null, 400);
    }
    
    // التحقق من وجود المصروف
    $expense = dbSelectOne("SELECT id FROM expenses WHERE id = ?", [$id]);
    if (!$expense) {
        response(false, 'المصروف غير موجود', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    if (isset($data['type'])) {
        $updateFields[] = "type = ?";
        $updateParams[] = trim($data['type']);
    }
    
    if (isset($data['amount'])) {
        $updateFields[] = "amount = ?";
        $updateParams[] = floatval($data['amount']);
    }
    
    $expenseDate = $data['date'] ?? $data['expense_date'] ?? null;
    if ($expenseDate) {
        $updateFields[] = "expense_date = ?";
        $updateParams[] = $expenseDate;
    }
    
    if (isset($data['description'])) {
        $updateFields[] = "description = ?";
        $updateParams[] = trim($data['description']);
    }
    
    // تحديث branch_id - فقط للمالك
    if (isset($data['branch_id'])) {
        $session = checkAuth();
        $userRole = $session['role'] ?? 'employee';
        $isOwner = ($userRole === 'admin');
        
        if ($isOwner) {
            $branchId = $data['branch_id'];
            if ($branchId === '') {
                $branchId = null;
            }
            $updateFields[] = "branch_id = ?";
            $updateParams[] = $branchId;
        }
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE expenses SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل المصروف', null, 500);
    }
    
    // تحديث المعاملة في treasury_transactions إذا تم تعديل المبلغ أو التاريخ
    $expense = dbSelectOne("SELECT * FROM expenses WHERE id = ?", [$id]);
    if ($expense && $expense['branch_id']) {
        $session = checkAuth();
        
        // البحث عن المعاملة المرتبطة بهذا المصروف
        $existingTransaction = dbSelectOne(
            "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'expense'",
            [$id]
        );
        
        if ($existingTransaction) {
            // تحديث المعاملة الموجودة
            $typeNames = [
                'rent' => 'إيجار',
                'electricity' => 'كهرباء',
                'salaries' => 'رواتب',
                'parts' => 'قطع غيار',
                'other' => 'أخرى'
            ];
            $typeName = $typeNames[$expense['type']] ?? $expense['type'];
            $transactionDescription = $typeName . ($expense['description'] ? ' - ' . $expense['description'] : '');
            
            // استخدام expense_date لتاريخ المعاملة
            $transactionDate = $expense['expense_date'];
            
            $updateTransactionResult = dbExecute(
                "UPDATE treasury_transactions SET 
                 amount = ?, description = ?, created_at = ?
                 WHERE id = ?",
                [$expense['amount'], $transactionDescription, $transactionDate . ' ' . date('H:i:s'), $existingTransaction['id']]
            );
            
            if ($updateTransactionResult === false) {
                error_log('❌ تحذير: فشل تحديث معاملة المصروف في treasury_transactions');
            } else {
                error_log('✅ تم تحديث معاملة المصروف في treasury_transactions بنجاح');
            }
        } else {
            // إذا لم توجد معاملة، إضافة واحدة جديدة
            $transactionId = generateId();
            $typeNames = [
                'rent' => 'إيجار',
                'electricity' => 'كهرباء',
                'salaries' => 'رواتب',
                'parts' => 'قطع غيار',
                'other' => 'أخرى'
            ];
            $typeName = $typeNames[$expense['type']] ?? $expense['type'];
            $transactionDescription = $typeName . ($expense['description'] ? ' - ' . $expense['description'] : '');
            
            $transactionDate = $expense['expense_date'];
            
            $transactionResult = dbExecute(
                "INSERT INTO treasury_transactions (
                    id, branch_id, transaction_type, amount, description, 
                    reference_id, reference_type, created_at, created_by
                ) VALUES (?, ?, 'expense', ?, ?, ?, 'expense', ?, ?)",
                [$transactionId, $expense['branch_id'], $expense['amount'], $transactionDescription, $id, $transactionDate . ' ' . date('H:i:s'), $session['user_id']]
            );
            
            if ($transactionResult === false) {
                error_log('❌ تحذير: فشل إضافة معاملة المصروف في treasury_transactions');
            } else {
                error_log('✅ تم إضافة معاملة المصروف في treasury_transactions بنجاح');
            }
        }
    }
    
    response(true, 'تم تعديل المصروف بنجاح');
}

// حذف مصروف
if ($method === 'DELETE') {
    checkPermission('admin');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف المصروف مطلوب', null, 400);
    }
    
    // التحقق من وجود المصروف
    $expense = dbSelectOne("SELECT id FROM expenses WHERE id = ?", [$id]);
    if (!$expense) {
        response(false, 'المصروف غير موجود', null, 404);
    }
    
    // حذف المعاملة المرتبطة من treasury_transactions
    $deleteTransactionResult = dbExecute(
        "DELETE FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'expense'",
        [$id]
    );
    
    if ($deleteTransactionResult === false) {
        error_log('❌ تحذير: فشل حذف معاملة المصروف من treasury_transactions');
        // لا نوقف العملية، فقط نسجل التحذير
    }
    
    $result = dbExecute("DELETE FROM expenses WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف المصروف', null, 500);
    }
    
    response(true, 'تم حذف المصروف بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

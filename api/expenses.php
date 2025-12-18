<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة جميع المصروفات
if ($method === 'GET') {
    checkAuth();
    $expenses = dbSelect("SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC");
    
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
    
    $type = trim($data['type'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $expense_date = $data['date'] ?? $data['expense_date'] ?? date('Y-m-d');
    $description = trim($data['description'] ?? '');
    
    if (empty($type) || $amount <= 0) {
        response(false, 'نوع المصروف والمبلغ مطلوبان', null, 400);
    }
    
    $session = checkAuth();
    $expenseId = generateId();
    
    $result = dbExecute(
        "INSERT INTO expenses (id, type, amount, description, expense_date, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [$expenseId, $type, $amount, $description, $expense_date, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة المصروف', null, 500);
    }
    
    $newExpense = dbSelectOne("SELECT * FROM expenses WHERE id = ?", [$expenseId]);
    $newExpense['date'] = $newExpense['expense_date']; // للتوافق
    
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
    
    $result = dbExecute("DELETE FROM expenses WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف المصروف', null, 500);
    }
    
    response(true, 'تم حذف المصروف بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

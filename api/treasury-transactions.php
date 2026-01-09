<?php
/**
 * API لجلب سجل معاملات الخزنة
 */

require_once 'config.php';

// التأكد من وجود جدول treasury_transactions
if (!dbTableExists('treasury_transactions')) {
    $conn = getDBConnection();
    if ($conn) {
        $createTableSQL = "CREATE TABLE IF NOT EXISTS `treasury_transactions` (
            `id` varchar(50) NOT NULL,
            `branch_id` varchar(50) NOT NULL,
            `transaction_type` enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return') NOT NULL,
            `amount` decimal(10,2) NOT NULL,
            `description` text DEFAULT NULL,
            `reference_id` varchar(50) DEFAULT NULL,
            `reference_type` varchar(50) DEFAULT NULL,
            `created_at` datetime NOT NULL,
            `created_by` varchar(50) DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_branch_id` (`branch_id`),
            KEY `idx_transaction_type` (`transaction_type`),
            KEY `idx_created_at` (`created_at`),
            KEY `idx_reference` (`reference_id`, `reference_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        if ($conn->query($createTableSQL)) {
            error_log('✅ تم إنشاء جدول treasury_transactions بنجاح');
        } else {
            error_log('❌ فشل إنشاء جدول treasury_transactions: ' . $conn->error);
        }
    }
}

$method = getRequestMethod();

if ($method === 'GET') {
    checkAuth();
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    $isManager = ($userRole === 'manager');
    
    // السماح لجميع المستخدمين بعرض سجل المعاملات
    // (لكن غير المالك يمكنه رؤية فرعه فقط - يتم التحقق من ذلك لاحقاً)
    
    // ✅ تنظيف branch_id (يسمح بالنقطة لأن generateId() يولد IDs مع نقطة)
    $requestedBranchId = cleanBranchId($_GET['branch_id'] ?? '');
    $requestedBranchId = !empty($requestedBranchId) ? $requestedBranchId : null;
    $page = intval($_GET['page'] ?? 1);
    $perPage = intval($_GET['per_page'] ?? 20);
    $offset = ($page - 1) * $perPage;
    
    // إذا لم يكن المستخدم مالك، يجب أن يطلب فرعه فقط
    if (!$isOwner) {
        if (!$userBranchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 403);
        }
        
        // التحقق من أن المستخدم لا يطلب فرع آخر غير فرعه
        if ($requestedBranchId && $requestedBranchId !== $userBranchId) {
            response(false, 'ليس لديك صلاحية لعرض بيانات هذا الفرع', null, 403);
        }
        
        // استخدام فرع المستخدم فقط
        $branchId = $userBranchId;
    } else {
        // المالك يمكنه اختيار أي فرع
        $branchId = $requestedBranchId;
    }
    
    if (!$branchId || empty(trim($branchId))) {
        response(false, 'معرف الفرع مطلوب', null, 400);
    }
    
    // ✅ التحقق من أن branch_id صحيح قبل استخدامه في الاستعلام
    $branchId = trim($branchId);
    if (empty($branchId)) {
        response(false, 'معرف الفرع غير صحيح', null, 400);
    }
    
    // ✅ فلترة حسب التاريخ (اختياري)
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    
    $dateFilter = '';
    $dateParams = [];
    
    if ($startDate && $endDate) {
        $dateFilter = " AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?";
        $dateParams = [$startDate, $endDate];
    } elseif ($startDate) {
        $dateFilter = " AND DATE(t.created_at) >= ?";
        $dateParams = [$startDate];
    } elseif ($endDate) {
        $dateFilter = " AND DATE(t.created_at) <= ?";
        $dateParams = [$endDate];
    }
    
    // جلب إجمالي عدد المعاملات
    $totalQuery = "SELECT COUNT(*) as total FROM treasury_transactions t WHERE t.branch_id = ?" . $dateFilter;
    $totalParams = array_merge([$branchId], $dateParams);
    $totalResult = dbSelectOne($totalQuery, $totalParams);
    if ($totalResult === false) {
        response(false, 'خطأ في جلب عدد المعاملات', null, 500);
    }
    $total = intval($totalResult['total'] ?? 0);
    $totalPages = ceil($total / $perPage);
    
    // جلب المعاملات مع pagination
    $transactionsQuery = "SELECT t.*, u.name as created_by_name 
         FROM treasury_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.branch_id = ?" . $dateFilter . "
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?";
    $transactionsParams = array_merge([$branchId], $dateParams, [$perPage, $offset]);
    $transactions = dbSelect($transactionsQuery, $transactionsParams);
    
    if ($transactions === false) {
        response(false, 'خطأ في جلب المعاملات', null, 500);
    }
    
    // إضافة نص نوع المعاملة بالعربية
    $transactionTypes = [
        'expense' => 'مصروف',
        'repair_cost' => 'تكلفة صيانة',
        'repair_profit' => 'ربح صيانة',
        'loss_operation' => 'عملية خاسرة',
        'sales_revenue' => 'إيراد مبيعات',
        'sales_cost' => 'تكلفة مبيعات',
        'withdrawal' => 'سحب من الخزنة',
        'deposit' => 'إضافة إلى الخزنة',
        'damaged_return' => 'مرتجع تالف',
        'debt_collection' => 'تحصيل دين'
    ];
    
    foreach ($transactions as &$transaction) {
        $transaction['type_text'] = $transactionTypes[$transaction['transaction_type']] ?? $transaction['transaction_type'];
    }
    
    response(true, 'تم جلب المعاملات بنجاح', [
        'transactions' => $transactions,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $totalPages
        ]
    ]);
}

// ✅ تعديل وصف معاملة
if ($method === 'PUT') {
    checkAuth();
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    $isManager = ($userRole === 'manager');
    
    // التحقق من الصلاحيات - فقط المدير والمالك يمكنهم تعديل الوصف
    if (!$isOwner && !$isManager) {
        response(false, 'ليس لديك صلاحية لتعديل الوصف', null, 403);
    }
    
    $data = getRequestData();
    $transactionId = cleanInput($data['id'] ?? '');
    $newDescription = trim($data['description'] ?? '');
    
    if (empty($transactionId)) {
        response(false, 'معرف المعاملة مطلوب', null, 400);
    }
    
    // جلب المعاملة للتأكد من وجودها
    $transaction = dbSelectOne(
        "SELECT * FROM treasury_transactions WHERE id = ?",
        [$transactionId]
    );
    
    if (!$transaction) {
        response(false, 'المعاملة غير موجودة', null, 404);
    }
    
    // التحقق من الصلاحيات - غير المالك يمكنه تعديل معاملات فرعه فقط
    if (!$isOwner) {
        if (!$userBranchId || $transaction['branch_id'] !== $userBranchId) {
            response(false, 'ليس لديك صلاحية لتعديل هذه المعاملة', null, 403);
        }
    }
    
    // تحديث الوصف
    $result = dbExecute(
        "UPDATE treasury_transactions SET description = ? WHERE id = ?",
        [$newDescription, $transactionId]
    );
    
    if ($result === false) {
        response(false, 'خطأ في تحديث الوصف', null, 500);
    }
    
    // جلب المعاملة المحدثة
    $updatedTransaction = dbSelectOne(
        "SELECT t.*, u.name as created_by_name 
         FROM treasury_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.id = ?",
        [$transactionId]
    );
    
    // إضافة نص نوع المعاملة بالعربية
    $transactionTypes = [
        'expense' => 'مصروف',
        'repair_cost' => 'تكلفة صيانة',
        'repair_profit' => 'ربح صيانة',
        'loss_operation' => 'عملية خاسرة',
        'sales_revenue' => 'إيراد مبيعات',
        'sales_cost' => 'تكلفة مبيعات',
        'withdrawal' => 'سحب من الخزنة',
        'deposit' => 'إضافة إلى الخزنة',
        'damaged_return' => 'مرتجع تالف',
        'debt_collection' => 'تحصيل دين'
    ];
    
    if ($updatedTransaction) {
        $updatedTransaction['type_text'] = $transactionTypes[$updatedTransaction['transaction_type']] ?? $updatedTransaction['transaction_type'];
    }
    
    response(true, 'تم تحديث الوصف بنجاح', $updatedTransaction);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


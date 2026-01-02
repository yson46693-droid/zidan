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
    
    $requestedBranchId = $_GET['branch_id'] ?? null;
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
    
    if (!$branchId) {
        response(false, 'معرف الفرع مطلوب', null, 400);
    }
    
    // جلب إجمالي عدد المعاملات
    $totalQuery = "SELECT COUNT(*) as total FROM treasury_transactions WHERE branch_id = ?";
    $totalResult = dbSelectOne($totalQuery, [$branchId]);
    $total = intval($totalResult['total'] ?? 0);
    $totalPages = ceil($total / $perPage);
    
    // جلب المعاملات مع pagination
    $transactions = dbSelect(
        "SELECT t.*, u.name as created_by_name 
         FROM treasury_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.branch_id = ?
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?",
        [$branchId, $perPage, $offset]
    );
    
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
        'damaged_return' => 'مرتجع تالف'
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

response(false, 'طريقة غير مدعومة', null, 405);
?>


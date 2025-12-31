<?php
/**
 * API لإدارة عمليات الإضافة إلى الخزنة
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
} else {
    // التأكد من وجود 'deposit' في enum
    $conn = getDBConnection();
    if ($conn) {
        $checkEnumQuery = "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_SCHEMA = DATABASE() 
                          AND TABLE_NAME = 'treasury_transactions' 
                          AND COLUMN_NAME = 'transaction_type'";
        $result = $conn->query($checkEnumQuery);
        if ($result && $row = $result->fetch_assoc()) {
            $columnType = $row['COLUMN_TYPE'];
            if (strpos($columnType, 'deposit') === false) {
                // إضافة 'deposit' إلى enum (إذا لم يكن موجوداً)
                $alterQuery = "ALTER TABLE treasury_transactions 
                              MODIFY COLUMN transaction_type 
                              enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return') NOT NULL";
                if ($conn->query($alterQuery)) {
                    error_log('✅ تم إضافة deposit إلى enum بنجاح');
                } else {
                    error_log('❌ فشل إضافة deposit إلى enum: ' . $conn->error);
                }
            }
        }
    }
}

$method = getRequestMethod();
$data = getRequestData();

// إضافة إيداع جديد
if ($method === 'POST') {
    checkAuth(); // التحقق من تسجيل الدخول فقط
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    $isManager = ($userRole === 'manager');
    
    // التحقق من الصلاحيات - فقط المدير والمالك يمكنهم إضافة إيداعات
    if (!$isOwner && !$isManager) {
        response(false, 'ليس لديك صلاحية لإضافة إيداع', null, 403);
    }
    
    $requestedBranchId = $data['branch_id'] ?? null;
    $amount = floatval($data['amount'] ?? 0);
    $description = trim($data['description'] ?? '');
    
    // إذا لم يكن المستخدم مالك، يجب أن يطلب فرعه فقط
    if (!$isOwner) {
        if (!$userBranchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 403);
        }
        
        // التحقق من أن المستخدم لا يطلب فرع آخر غير فرعه
        if ($requestedBranchId && $requestedBranchId !== $userBranchId) {
            response(false, 'ليس لديك صلاحية لإضافة إيداع لهذا الفرع', null, 403);
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
    
    if ($amount <= 0) {
        response(false, 'المبلغ يجب أن يكون أكبر من صفر', null, 400);
    }
    $depositId = generateId();
    
    // إضافة الإيداع كمعاملة في سجل الخزنة
    $result = dbExecute(
        "INSERT INTO treasury_transactions (
            id, branch_id, transaction_type, amount, description, 
            reference_id, reference_type, created_at, created_by
        ) VALUES (?, ?, 'deposit', ?, ?, ?, 'deposit', NOW(), ?)",
        [$depositId, $branchId, $amount, $description, $depositId, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في تسجيل الإيداع', null, 500);
    }
    
    $deposit = dbSelectOne(
        "SELECT * FROM treasury_transactions WHERE id = ?",
        [$depositId]
    );
    
    response(true, 'تم تسجيل الإيداع بنجاح', $deposit);
}

// جلب سجل الإيداعات
if ($method === 'GET') {
    checkAuth();
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    
    $requestedBranchId = $_GET['branch_id'] ?? null;
    
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
    
    $deposits = dbSelect(
        "SELECT t.*, u.name as created_by_name 
         FROM treasury_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.branch_id = ? AND t.transaction_type = 'deposit'
         ORDER BY t.created_at DESC",
        [$branchId]
    );
    
    if ($deposits === false) {
        response(false, 'خطأ في جلب الإيداعات', null, 500);
    }
    
    response(true, 'تم جلب الإيداعات بنجاح', $deposits);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


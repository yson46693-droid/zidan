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
    
    // ✅ منطق تسوية الرصيد السالب: حساب الرصيد الحالي أولاً
    try {
        // تحديد الفترة الزمنية (الشهر الحالي)
        $now = new DateTime();
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
        
        // ✅ حساب صافي رصيد الخزنة الحالي باستخدام API branch-treasury
        // نستخدم نفس المنطق لكن بطريقة أبسط: نطلب الرصيد من API branch-treasury
        // أو نحسبه مباشرة من treasury_transactions
        
        // حساب الرصيد من جميع المعاملات في الشهر الحالي
        // الرصيد = (الإضافات) - (الخصومات)
        $additions = dbSelectOne(
            "SELECT SUM(amount) as total FROM treasury_transactions 
             WHERE branch_id = ? 
             AND transaction_type IN ('deposit', 'repair_profit', 'debt_collection')
             AND DATE(created_at) BETWEEN ? AND ?",
            [$branchId, $startDate, $endDate]
        );
        $totalAdditions = floatval($additions['total'] ?? 0);
        
        $deductions = dbSelectOne(
            "SELECT SUM(amount) as total FROM treasury_transactions 
             WHERE branch_id = ? 
             AND transaction_type IN ('withdrawal', 'expense', 'repair_cost', 'loss_operation', 'sales_cost', 'damaged_return')
             AND DATE(created_at) BETWEEN ? AND ?",
            [$branchId, $startDate, $endDate]
        );
        $totalDeductions = floatval($deductions['total'] ?? 0);
        
        // إضافة المصروفات من جدول expenses
        $expensesResult = dbSelectOne(
            "SELECT SUM(amount) as total FROM expenses 
             WHERE branch_id = ? AND expense_date BETWEEN ? AND ?",
            [$branchId, $startDate, $endDate]
        );
        $totalExpenses = floatval($expensesResult['total'] ?? 0);
        
        // إضافة المسحوبات من الرواتب
        if (dbTableExists('salary_deductions')) {
            $salaryWithdrawalsResult = dbSelectOne(
                "SELECT SUM(sd.amount) as total FROM salary_deductions sd
                 INNER JOIN users u ON sd.user_id = u.id
                 WHERE u.branch_id = ? AND sd.type = 'withdrawal' 
                 AND DATE(sd.created_at) BETWEEN ? AND ?",
                [$branchId, $startDate, $endDate]
            );
            $totalSalaryWithdrawals = floatval($salaryWithdrawalsResult['total'] ?? 0);
        } else {
            $totalSalaryWithdrawals = 0;
        }
        
        // حساب صافي الرصيد
        $currentNetBalance = $totalAdditions - ($totalDeductions + $totalExpenses + $totalSalaryWithdrawals);
        
        // ✅ إذا كان الرصيد سالباً، يتم أولاً تسوية الرصيد السالب حتى يصل إلى صفر
        // أي مبلغ متبقٍ بعد تسوية الرصيد السالب يتم إضافته ليصبح الرصيد موجباً
        $settlementAmount = 0;
        $remainingAmount = $amount;
        
        if ($currentNetBalance < 0) {
            // الرصيد سالب - نحتاج لتسويته
            $negativeBalance = abs($currentNetBalance);
            
            if ($amount >= $negativeBalance) {
                // المبلغ كافٍ لتسوية الرصيد السالب
                $settlementAmount = $negativeBalance;
                $remainingAmount = $amount - $negativeBalance;
            } else {
                // المبلغ غير كافٍ - يتم استخدامه كله لتسوية جزء من الرصيد السالب
                $settlementAmount = $amount;
                $remainingAmount = 0;
            }
        }
        
        // ✅ إذا كان هناك مبلغ تسوية، نضيف معاملة تسوية منفصلة
        if ($settlementAmount > 0) {
            $settlementId = generateId();
            $settlementDescription = 'تسوية رصيد سالب' . ($description ? ' - ' . $description : '');
            
            $settlementResult = dbExecute(
                "INSERT INTO treasury_transactions (
                    id, branch_id, transaction_type, amount, description, 
                    reference_id, reference_type, created_at, created_by
                ) VALUES (?, ?, 'deposit', ?, ?, ?, 'deposit', NOW(), ?)",
                [$settlementId, $branchId, $settlementAmount, $settlementDescription, $settlementId, $session['user_id']]
            );
            
            if ($settlementResult === false) {
                error_log('⚠️ تحذير: فشل تسجيل معاملة تسوية الرصيد السالب');
            }
        }
        
        // ✅ إضافة المبلغ المتبقي (إن وجد) كرصيد موجب
        if ($remainingAmount > 0) {
            $depositId = generateId();
            $depositDescription = $description ?: 'إضافة إلى الخزنة';
            
            $result = dbExecute(
                "INSERT INTO treasury_transactions (
                    id, branch_id, transaction_type, amount, description, 
                    reference_id, reference_type, created_at, created_by
                ) VALUES (?, ?, 'deposit', ?, ?, ?, 'deposit', NOW(), ?)",
                [$depositId, $branchId, $remainingAmount, $depositDescription, $depositId, $session['user_id']]
            );
            
            if ($result === false) {
                response(false, 'خطأ في تسجيل الإيداع', null, 500);
            }
            
            $deposit = dbSelectOne(
                "SELECT * FROM treasury_transactions WHERE id = ?",
                [$depositId]
            );
            
            response(true, 'تم تسجيل الإيداع بنجاح' . ($settlementAmount > 0 ? ' (تم تسوية رصيد سالب: ' . number_format($settlementAmount, 2) . ' ج.م)' : ''), $deposit);
        } else {
            // تم استخدام المبلغ كله لتسوية الرصيد السالب
            response(true, 'تم تسوية الرصيد السالب بنجاح: ' . number_format($settlementAmount, 2) . ' ج.م', [
                'settlement_amount' => $settlementAmount,
                'remaining_amount' => 0
            ]);
        }
        
    } catch (Exception $e) {
        error_log('Error calculating treasury balance for deposit: ' . $e->getMessage());
        // في حالة الخطأ، نضيف المبلغ مباشرة (سلوك قديم)
        $depositId = generateId();
        
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


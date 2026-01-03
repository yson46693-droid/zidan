<?php
/**
 * API لإدارة تحصيلات الدين من العملاء التجاريين في الخزنة
 */

require_once 'config.php';

// التأكد من وجود جدول treasury_transactions
if (!dbTableExists('treasury_transactions')) {
    $conn = getDBConnection();
    if ($conn) {
        $createTableSQL = "CREATE TABLE IF NOT EXISTS `treasury_transactions` (
            `id` varchar(50) NOT NULL,
            `branch_id` varchar(50) NOT NULL,
            `transaction_type` enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection') NOT NULL,
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
    // التأكد من وجود 'debt_collection' في enum
    try {
        $conn = getDBConnection();
        if ($conn) {
            $checkEnum = $conn->query("SHOW COLUMNS FROM treasury_transactions WHERE Field = 'transaction_type'");
            if ($checkEnum && $row = $checkEnum->fetch_assoc()) {
                $enumValues = $row['Type'];
                if (strpos($enumValues, 'debt_collection') === false) {
                    // إضافة 'debt_collection' إلى enum
                    $conn->query("ALTER TABLE treasury_transactions MODIFY COLUMN transaction_type enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection') NOT NULL");
                    error_log('✅ تم إضافة debt_collection إلى enum');
                }
            }
        }
    } catch (Exception $e) {
        error_log('⚠️ تحذير: ' . $e->getMessage());
    }
}

$method = getRequestMethod();
$data = getRequestData();

// إضافة تحصيل دين جديد
if ($method === 'POST') {
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $isOwner = ($userRole === 'admin' || $userRole === 'owner');
    $isManager = ($userRole === 'manager');
    
    // التحقق من الصلاحيات - فقط المدير والمالك يمكنهم تسجيل تحصيلات الدين
    if (!$isOwner && !$isManager) {
        response(false, 'ليس لديك صلاحية لتسجيل تحصيلات الدين', null, 403);
    }
    
    $branchId = $data['branch_id'] ?? null;
    $customerId = trim($data['customer_id'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $description = trim($data['description'] ?? '');
    
    if (!$branchId) {
        response(false, 'معرف الفرع مطلوب', null, 400);
    }
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    if ($amount <= 0) {
        response(false, 'المبلغ يجب أن يكون أكبر من الصفر', null, 400);
    }
    
    // التحقق من وجود العميل ونوعه
    $customer = dbSelectOne(
        "SELECT id, customer_type, total_debt, name FROM customers WHERE id = ?",
        [$customerId]
    );
    
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // التحقق من أن العميل تجاري
    if ($customer['customer_type'] !== 'commercial') {
        response(false, 'يمكن تحصيل الدين من العملاء التجاريين فقط', null, 400);
    }
    
    // التحقق من وجود عمود total_debt
    $hasTotalDebtColumn = dbColumnExists('customers', 'total_debt');
    if (!$hasTotalDebtColumn) {
        response(false, 'نظام الديون غير مفعّل في قاعدة البيانات', null, 500);
    }
    
    $currentDebt = floatval($customer['total_debt'] ?? 0);
    
    if ($amount > $currentDebt) {
        response(false, "المبلغ المراد تحصيله ({$amount}) أكبر من إجمالي الدين ({$currentDebt})", null, 400);
    }
    
    // حساب الدين الجديد
    $newDebt = $currentDebt - $amount;
    
    // بدء المعاملة
    dbBeginTransaction();
    
    try {
        // تحديث دين العميل
        $updateResult = dbExecute(
            "UPDATE customers SET total_debt = ? WHERE id = ?",
            [$newDebt, $customerId]
        );
        
        if ($updateResult === false) {
            throw new Exception('فشل تحديث دين العميل');
        }
        
        // تسجيل تحصيل الدين في سجل معاملات الخزنة
        $collectionId = generateId();
        $customerName = $customer['name'] ?? 'عميل غير معروف';
        $transactionDescription = "تحصيل دين من {$customerName}";
        if (!empty($description)) {
            $transactionDescription .= " - {$description}";
        }
        
        $result = dbExecute(
            "INSERT INTO treasury_transactions (
                id, branch_id, transaction_type, amount, description, 
                reference_id, reference_type, created_at, created_by
            ) VALUES (?, ?, 'debt_collection', ?, ?, ?, 'debt_collection', NOW(), ?)",
            [$collectionId, $branchId, $amount, $transactionDescription, $customerId, $session['user_id']]
        );
        
        if ($result === false) {
            throw new Exception('فشل تسجيل تحصيل الدين في سجل الخزنة');
        }
        
        dbCommit();
        
        // جلب بيانات التحصيل المسجلة
        $collection = dbSelectOne(
            "SELECT * FROM treasury_transactions WHERE id = ?",
            [$collectionId]
        );
        
        response(true, "تم تحصيل {$amount} ج.م بنجاح. الدين المتبقي: {$newDebt} ج.م", $collection);
        
    } catch (Exception $e) {
        dbRollback();
        error_log('خطأ في تحصيل الدين: ' . $e->getMessage());
        response(false, 'خطأ في تحصيل الدين: ' . $e->getMessage(), null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


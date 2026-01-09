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
    
    // ✅ منطق تسوية الرصيد السالب: حساب الرصيد الحالي أولاً باستخدام نفس منطق branch-treasury.php
    try {
        // جلب معرف الفرع الأول
        $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
        $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
        $isFirstBranch = ($branchId === $firstBranchId);
        
        // تحديد الفترة الزمنية (الشهر الحالي)
        $now = new DateTime();
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
        
        // ✅ استخدام نفس منطق حساب الرصيد من branch-treasury.php
        // 1. جلب المصروفات
        $expensesResult = dbSelectOne("SELECT SUM(amount) as total FROM expenses WHERE branch_id = ? AND expense_date BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
        $totalExpenses = floatval($expensesResult['total'] ?? 0);
        
        // 2. جلب تكاليف عمليات الصيانة
        $totalRepairCosts = 0;
        if (dbTableExists('treasury_transactions')) {
            $repairCostsResult = dbSelectOne("SELECT SUM(amount) as total FROM treasury_transactions WHERE branch_id = ? AND transaction_type = 'repair_cost' AND DATE(created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
            $totalRepairCosts = floatval($repairCostsResult['total'] ?? 0);
        }
        
        // 3. جلب الإيرادات الفعلية من عمليات الصيانة
        $totalRepairRevenue = 0;
        if ($isFirstBranch) {
            if (dbTableExists('treasury_transactions')) {
                $paidAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id WHERE tt.branch_id = ? AND tt.transaction_type = 'repair_profit' AND tt.reference_type = 'repair' AND tt.description LIKE '%مبلغ مدفوع مقدماً%' AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalPaidAmount = floatval($paidAmountResult['total'] ?? 0);
                
                $remainingAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id WHERE tt.branch_id = ? AND tt.transaction_type = 'repair_profit' AND tt.reference_type = 'repair' AND tt.description LIKE '%المبلغ المتبقي%' AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalRemainingAmount = floatval($remainingAmountResult['total'] ?? 0);
                
                $refundAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id WHERE tt.branch_id = ? AND tt.transaction_type = 'withdrawal' AND tt.reference_type = 'repair' AND tt.description LIKE '%استرجاع مبلغ مدفوع مقدماً%' AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalRefundAmount = floatval($refundAmountResult['total'] ?? 0);
                
                $totalRepairRevenue = $totalPaidAmount + $totalRemainingAmount - $totalRefundAmount;
            }
        } else {
            if (dbTableExists('treasury_transactions')) {
                $paidAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id WHERE tt.branch_id = ? AND tt.transaction_type = 'deposit' AND tt.reference_type = 'repair' AND tt.description LIKE '%مبلغ مدفوع مقدماً%' AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalPaidAmount = floatval($paidAmountResult['total'] ?? 0);
                
                $remainingAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id LEFT JOIN customers c ON r.customer_id = c.id WHERE tt.branch_id = ? AND tt.transaction_type = 'deposit' AND tt.reference_type = 'repair' AND tt.description LIKE '%المبلغ المتبقي%' AND (c.customer_type IS NULL OR c.customer_type = 'retail' OR c.customer_type != 'commercial') AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalRemainingAmount = floatval($remainingAmountResult['total'] ?? 0);
                
                $refundAmountResult = dbSelectOne("SELECT SUM(tt.amount) as total FROM treasury_transactions tt INNER JOIN repairs r ON tt.reference_id = r.id WHERE tt.branch_id = ? AND tt.transaction_type = 'withdrawal' AND tt.reference_type = 'repair' AND tt.description LIKE '%استرجاع مبلغ مدفوع مقدماً%' AND DATE(tt.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
                $totalRefundAmount = floatval($refundAmountResult['total'] ?? 0);
                
                $totalRepairRevenue = $totalPaidAmount + $totalRemainingAmount - $totalRefundAmount;
            }
        }
        
        // 4. جلب المبيعات (للفرع الأول فقط)
        $totalSales = 0;
        if ($isFirstBranch) {
            // ✅ إصلاح: استخدام treasury_transactions لحساب إجمالي المبيعات (لضمان استخدام المبلغ المدفوع للعملاء التجاريين)
            if (dbTableExists('treasury_transactions')) {
                // جلب المبيعات من treasury_transactions (تحتوي على المبلغ الفعلي المضاف للخزنة)
                $salesRevenueQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                                      WHERE branch_id = ? 
                                      AND transaction_type = 'sales_revenue' 
                                      AND reference_type = 'sale'
                                      AND DATE(created_at) BETWEEN ? AND ?";
                $salesRevenueResult = dbSelectOne($salesRevenueQuery, [$branchId, $startDate, $endDate]);
                $totalSales = floatval($salesRevenueResult['total'] ?? 0);
                
                // جلب المبيعات القديمة التي لم تُسجل في treasury_transactions (fallback)
                $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
                $hasPaidAmountColumn = dbColumnExists('sales', 'paid_amount');
                $salesQuery = "SELECT s.id, s.final_amount";
                if ($hasPaidAmountColumn && $hasCustomerIdColumn) {
                    $salesQuery .= ", s.paid_amount, c.customer_type";
                }
                $salesQuery .= " FROM sales s INNER JOIN users u ON s.created_by = u.id";
                if ($hasCustomerIdColumn) {
                    $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
                }
                $salesQuery .= " WHERE DATE(s.created_at) BETWEEN ? AND ?
                               AND NOT EXISTS (
                                   SELECT 1 FROM treasury_transactions tt 
                                   WHERE tt.reference_id = s.id 
                                   AND tt.reference_type = 'sale' 
                                   AND tt.transaction_type = 'sales_revenue'
                               )";
                $salesParams = [$startDate, $endDate];
                
                if ($hasCustomerIdColumn) {
                    $salesQuery .= " AND ((u.branch_id = ? OR u.role = 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL))";
                    $salesParams[] = $branchId;
                    $salesParams[] = $branchId;
                } else {
                    $salesQuery .= " AND (u.branch_id = ? OR u.role = 'admin')";
                    $salesParams[] = $branchId;
                }
                
                $sales = dbSelect($salesQuery, $salesParams);
                if ($sales !== false && is_array($sales)) {
                    foreach ($sales as $sale) {
                        // للمبيعات القديمة: استخدام paid_amount للعملاء التجاريين و final_amount للعملاء العاديين
                        if ($hasPaidAmountColumn && $hasCustomerIdColumn) {
                            $customerType = $sale['customer_type'] ?? 'retail';
                            if ($customerType === 'commercial') {
                                $amount = floatval($sale['paid_amount'] ?? 0);
                            } else {
                                $amount = floatval($sale['final_amount'] ?? 0);
                            }
                        } else {
                            // للجداول القديمة: استخدام final_amount
                            $amount = floatval($sale['final_amount'] ?? 0);
                        }
                        $totalSales += $amount;
                    }
                }
            } else {
                // Fallback: استخدام sales مباشرة (للجداول القديمة)
                $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
                $hasPaidAmountColumn = dbColumnExists('sales', 'paid_amount');
                $salesQuery = "SELECT s.id, s.final_amount";
                if ($hasPaidAmountColumn && $hasCustomerIdColumn) {
                    $salesQuery .= ", s.paid_amount, c.customer_type";
                }
                $salesQuery .= " FROM sales s INNER JOIN users u ON s.created_by = u.id";
                if ($hasCustomerIdColumn) {
                    $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
                }
                $salesQuery .= " WHERE DATE(s.created_at) BETWEEN ? AND ?";
                $salesParams = [$startDate, $endDate];
                
                if ($hasCustomerIdColumn) {
                    $salesQuery .= " AND ((u.branch_id = ? OR u.role = 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL))";
                    $salesParams[] = $branchId;
                    $salesParams[] = $branchId;
                } else {
                    $salesQuery .= " AND (u.branch_id = ? OR u.role = 'admin')";
                    $salesParams[] = $branchId;
                }
                
                $sales = dbSelect($salesQuery, $salesParams);
                if ($sales !== false && is_array($sales)) {
                    foreach ($sales as $sale) {
                        if ($hasPaidAmountColumn && $hasCustomerIdColumn) {
                            $customerType = $sale['customer_type'] ?? 'retail';
                            if ($customerType === 'commercial') {
                                $amount = floatval($sale['paid_amount'] ?? 0);
                            } else {
                                $amount = floatval($sale['final_amount'] ?? 0);
                            }
                        } else {
                            $amount = floatval($sale['final_amount'] ?? 0);
                        }
                        $totalSales += $amount;
                    }
                }
            }
        }
        
        // 5. حساب إجمالي الإيرادات
        if ($isFirstBranch) {
            $totalRevenue = $totalSales + $totalRepairRevenue;
        } else {
            $totalRevenue = $totalRepairRevenue;
        }
        
        // 6. جلب العمليات الخاسرة
        $lossResult = dbSelectOne("SELECT SUM(lo.loss_amount) as total FROM loss_operations lo INNER JOIN repairs r ON lo.repair_number = r.repair_number WHERE r.branch_id = ? AND DATE(lo.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
        $totalLosses = floatval($lossResult['total'] ?? 0);
        
        // 7. جلب السحوبات من الخزنة
        $totalTreasuryWithdrawals = 0;
        if (dbTableExists('treasury_transactions')) {
            $treasuryWithdrawalsResult = dbSelectOne("SELECT SUM(amount) as total FROM treasury_transactions WHERE branch_id = ? AND transaction_type = 'withdrawal' AND (reference_type IS NULL OR reference_type != 'salary_deduction') AND (description IS NULL OR description NOT LIKE '%استرجاع مبلغ مدفوع مقدماً%') AND DATE(created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
            $totalTreasuryWithdrawals = floatval($treasuryWithdrawalsResult['total'] ?? 0);
        }
        
        // 8. جلب المسحوبات من الرواتب
        $totalSalaryWithdrawals = 0;
        if (dbTableExists('salary_deductions')) {
            $salaryWithdrawalsResult = dbSelectOne("SELECT SUM(sd.amount) as total FROM salary_deductions sd INNER JOIN users u ON sd.user_id = u.id WHERE u.branch_id = ? AND sd.type = 'withdrawal' AND DATE(sd.created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
            $totalSalaryWithdrawals = floatval($salaryWithdrawalsResult['total'] ?? 0);
        }
        
        // 9. جلب الإيداعات
        // ✅ للفرع الثاني: استبعاد معاملات الصيانة (reference_type = 'repair') لأنها تُحسب في totalRepairRevenue
        if ($isFirstBranch) {
            // الفرع الأول: جلب جميع الإيداعات (أرباح الصيانة تُسجل كـ repair_profit وليس deposit)
            $depositsResult = dbSelectOne("SELECT SUM(amount) as total FROM treasury_transactions WHERE branch_id = ? AND transaction_type = 'deposit' AND DATE(created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
        } else {
            // الفرع الثاني: استبعاد معاملات الصيانة (reference_type = 'repair') لأنها تُحسب في totalRepairRevenue
            $depositsResult = dbSelectOne("SELECT SUM(amount) as total FROM treasury_transactions WHERE branch_id = ? AND transaction_type = 'deposit' AND (reference_type IS NULL OR reference_type != 'repair') AND DATE(created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
        }
        $totalDeposits = floatval($depositsResult['total'] ?? 0);
        
        // 10. جلب تحصيلات الدين
        $debtCollectionsResult = dbSelectOne("SELECT SUM(amount) as total FROM treasury_transactions WHERE branch_id = ? AND transaction_type = 'debt_collection' AND DATE(created_at) BETWEEN ? AND ?", [$branchId, $startDate, $endDate]);
        $totalDebtCollections = floatval($debtCollectionsResult['total'] ?? 0);
        
        // 11. ✅ جلب المرتجعات (للفرع الأول فقط) - استخدام المبلغ المدفوع للعميل من treasury_transactions (وليس سعر المنتج)
        $totalDamagedReturns = 0;
        $totalNormalReturns = 0;
        if ($isFirstBranch) {
            // جلب المرتجعات التالفة من treasury_transactions
            $damagedReturnsQuery = "SELECT SUM(tt.amount) as total 
                                   FROM treasury_transactions tt
                                   INNER JOIN product_returns pr ON tt.reference_id = pr.id
                                   WHERE tt.transaction_type = 'damaged_return'
                                   AND tt.reference_type = 'product_return'
                                   AND tt.branch_id = ?
                                   AND DATE(tt.created_at) BETWEEN ? AND ?";
            $damagedReturnsParams = [$branchId, $startDate, $endDate];
            
            $damagedReturnsResult = dbSelectOne($damagedReturnsQuery, $damagedReturnsParams);
            $totalDamagedReturns = floatval($damagedReturnsResult['total'] ?? 0);
            
            // جلب المرتجعات السليمة من treasury_transactions
            $normalReturnsQuery = "SELECT SUM(tt.amount) as total 
                                  FROM treasury_transactions tt
                                  INNER JOIN product_returns pr ON tt.reference_id = pr.id
                                  WHERE tt.transaction_type = 'normal_return'
                                  AND tt.reference_type = 'product_return'
                                  AND tt.branch_id = ?
                                  AND DATE(tt.created_at) BETWEEN ? AND ?";
            $normalReturnsParams = [$branchId, $startDate, $endDate];
            
            $normalReturnsResult = dbSelectOne($normalReturnsQuery, $normalReturnsParams);
            $totalNormalReturns = floatval($normalReturnsResult['total'] ?? 0);
        }
        
        // 12. حساب إجمالي السحوبات
        $totalWithdrawals = $totalTreasuryWithdrawals + $totalSalaryWithdrawals;
        
        // 13. حساب صافي الرصيد باستخدام نفس المعادلة من branch-treasury.php
        if ($isFirstBranch) {
            $currentNetBalance = ($totalRevenue + $totalDeposits + $totalDebtCollections) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalWithdrawals + $totalDamagedReturns + $totalNormalReturns);
        } else {
            $currentNetBalance = ($totalRevenue + $totalDeposits + $totalDebtCollections) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalSalaryWithdrawals + $totalTreasuryWithdrawals);
        }
        
        // ✅ تسجيل للتشخيص
        error_log("🔍 [Treasury Deposits Debug] حساب الرصيد قبل الإضافة:");
        error_log("   - الإيرادات: {$totalRevenue}");
        error_log("   - الإيداعات: {$totalDeposits}");
        error_log("   - تحصيلات الدين: {$totalDebtCollections}");
        error_log("   - المصروفات: {$totalExpenses}");
        error_log("   - تكاليف الصيانة: {$totalRepairCosts}");
        error_log("   - الرصيد الصافي الحالي: {$currentNetBalance}");
        
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


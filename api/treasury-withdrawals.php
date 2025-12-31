<?php
/**
 * API لإدارة عمليات السحب من الخزنة
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
$data = getRequestData();

// إضافة سحب جديد
if ($method === 'POST') {
    checkAuth(); // التحقق من تسجيل الدخول فقط
    
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    $isManager = ($userRole === 'manager');
    
    // التحقق من الصلاحيات - فقط المدير والمالك يمكنهم إضافة سحوبات
    if (!$isOwner && !$isManager) {
        response(false, 'ليس لديك صلاحية لإضافة سحب', null, 403);
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
            response(false, 'ليس لديك صلاحية لإضافة سحب لهذا الفرع', null, 403);
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
    
    // حساب الرصيد الحالي للخزنة قبل السحب
    try {
        // جلب معرف الفرع الأول
        $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
        $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
        $isFirstBranch = ($branchId === $firstBranchId);
        
        // تحديد الفترة الزمنية (الشهر الحالي)
        $now = new DateTime();
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
        
        // 1. جلب المصروفات
        $expensesQuery = "SELECT SUM(amount) as total FROM expenses WHERE branch_id = ? AND expense_date BETWEEN ? AND ?";
        $expensesResult = dbSelectOne($expensesQuery, [$branchId, $startDate, $endDate]);
        $totalExpenses = floatval($expensesResult['total'] ?? 0);
        
        // 2. جلب تكاليف عمليات الصيانة
        // ✅ تحسين: استخدام COALESCE للحصول على أول قيمة غير NULL لتحديد التاريخ المناسب للفلترة
        $repairCostsQuery = "SELECT SUM(repair_cost) as total FROM repairs WHERE branch_id = ? AND status = 'delivered' 
                             AND DATE(COALESCE(delivery_date, updated_at, created_at)) BETWEEN ? AND ?";
        $repairCostsResult = dbSelectOne($repairCostsQuery, [$branchId, $startDate, $endDate]);
        $totalRepairCosts = floatval($repairCostsResult['total'] ?? 0);
        
        // 3. جلب أرباح عمليات الصيانة
        // ✅ تحسين: استخدام COALESCE للحصول على أول قيمة غير NULL لتحديد التاريخ المناسب للفلترة
        $repairProfitsQuery = "SELECT SUM(customer_price - repair_cost) as total FROM repairs 
                               WHERE branch_id = ? AND status = 'delivered' 
                               AND DATE(COALESCE(delivery_date, updated_at, created_at)) BETWEEN ? AND ?";
        $repairProfitsResult = dbSelectOne($repairProfitsQuery, [$branchId, $startDate, $endDate]);
        $totalRepairProfits = floatval($repairProfitsResult['total'] ?? 0);
        
        // 4. جلب العمليات الخاسرة
        $lossQuery = "SELECT SUM(lo.loss_amount) as total 
                      FROM loss_operations lo
                      INNER JOIN repairs r ON lo.repair_number = r.repair_number
                      WHERE r.branch_id = ? AND DATE(lo.created_at) BETWEEN ? AND ?";
        $lossResult = dbSelectOne($lossQuery, [$branchId, $startDate, $endDate]);
        $totalLosses = floatval($lossResult['total'] ?? 0);
        if ($totalLosses === null) {
            $totalLosses = 0;
        }
        
        // 5. جلب السحوبات العادية من الخزنة (باستثناء المسحوبات/الخصومات من الرواتب)
        // نستبعد المسحوبات من الرواتب لأننا سنجلبها مباشرة من salary_deductions
        $withdrawalsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                              WHERE branch_id = ? AND transaction_type = 'withdrawal' 
                              AND (reference_type IS NULL OR reference_type != 'salary_deduction')
                              AND DATE(created_at) BETWEEN ? AND ?";
        $withdrawalsResult = dbSelectOne($withdrawalsQuery, [$branchId, $startDate, $endDate]);
        $totalWithdrawals = floatval($withdrawalsResult['total'] ?? 0);
        if ($totalWithdrawals === null) {
            $totalWithdrawals = 0;
        }
        
        // 5.0.1. جلب المسحوبات فقط (type='withdrawal') من الرواتب مباشرة من salary_deductions
        // هذا يضمن حساب جميع المسحوبات حتى القديمة التي لم تُسجل في treasury_transactions
        $totalSalaryWithdrawals = 0;
        if (dbTableExists('salary_deductions')) {
            try {
                $salaryWithdrawalsQuery = "SELECT SUM(sd.amount) as total 
                                          FROM salary_deductions sd
                                          INNER JOIN users u ON sd.user_id = u.id
                                          WHERE u.branch_id = ? 
                                          AND sd.type = 'withdrawal'
                                          AND DATE(sd.created_at) BETWEEN ? AND ?";
                $salaryWithdrawalsResult = dbSelectOne($salaryWithdrawalsQuery, [$branchId, $startDate, $endDate]);
                $totalSalaryWithdrawals = floatval($salaryWithdrawalsResult['total'] ?? 0);
                
                if ($totalSalaryWithdrawals === null) {
                    $totalSalaryWithdrawals = 0;
                }
            } catch (Exception $e) {
                error_log('⚠️ تحذير: خطأ في جلب المسحوبات من salary_deductions: ' . $e->getMessage());
                $totalSalaryWithdrawals = 0;
            }
        }
        
        // إضافة المسحوبات من الرواتب إلى إجمالي السحوبات
        $totalWithdrawals += $totalSalaryWithdrawals;
        
        // 5.1. جلب الإيداعات السابقة
        $depositsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                          WHERE branch_id = ? AND transaction_type = 'deposit' 
                          AND DATE(created_at) BETWEEN ? AND ?";
        $depositsResult = dbSelectOne($depositsQuery, [$branchId, $startDate, $endDate]);
        $totalDeposits = floatval($depositsResult['total'] ?? 0);
        if ($totalDeposits === null) {
            $totalDeposits = 0;
        }
        
        // 5.2. جلب المرتجعات التالفة
        // ربط المرتجعات التالفة بالفرع من خلال المبيعات
        $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
        $damagedReturnsQuery = "SELECT SUM(pri.total_price) as total 
                               FROM product_return_items pri
                               INNER JOIN product_returns pr ON pri.return_id = pr.id
                               INNER JOIN sales s ON pr.sale_id = s.id
                               INNER JOIN users u ON s.created_by = u.id";
        if ($hasCustomerIdColumn) {
            $damagedReturnsQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
        }
        $damagedReturnsQuery .= " WHERE pri.is_damaged = 1 
                                 AND DATE(pr.created_at) BETWEEN ? AND ?";
        $damagedReturnsParams = [$startDate, $endDate];
        
        // فلترة حسب الفرع
        if ($isFirstBranch) {
            if ($hasCustomerIdColumn) {
                $damagedReturnsQuery .= " AND ((u.branch_id = ? OR u.role = 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL))";
                $damagedReturnsParams[] = $branchId;
                $damagedReturnsParams[] = $branchId;
            } else {
                $damagedReturnsQuery .= " AND (u.branch_id = ? OR u.role = 'admin')";
                $damagedReturnsParams[] = $branchId;
            }
        } else {
            if ($hasCustomerIdColumn) {
                $damagedReturnsQuery .= " AND u.branch_id = ? AND (u.role IS NULL OR u.role != 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL)";
                $damagedReturnsParams[] = $branchId;
                $damagedReturnsParams[] = $branchId;
            } else {
                $damagedReturnsQuery .= " AND u.branch_id = ? AND (u.role IS NULL OR u.role != 'admin')";
                $damagedReturnsParams[] = $branchId;
            }
        }
        
        $damagedReturnsResult = dbSelectOne($damagedReturnsQuery, $damagedReturnsParams);
        $totalDamagedReturns = floatval($damagedReturnsResult['total'] ?? 0);
        if ($totalDamagedReturns === null) {
            $totalDamagedReturns = 0;
        }
        
        // 5.3. جلب المرتجعات السليمة (للفرع الأول فقط)
        $totalNormalReturns = 0;
        if ($isFirstBranch) {
            $normalReturnsQuery = "SELECT SUM(pri.total_price) as total 
                                  FROM product_return_items pri
                                  INNER JOIN product_returns pr ON pri.return_id = pr.id
                                  INNER JOIN sales s ON pr.sale_id = s.id
                                  INNER JOIN users u ON s.created_by = u.id";
            if ($hasCustomerIdColumn) {
                $normalReturnsQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
            }
            $normalReturnsQuery .= " WHERE pri.is_damaged = 0 
                                    AND DATE(pr.created_at) BETWEEN ? AND ?";
            $normalReturnsParams = [$startDate, $endDate];
            
            // فلترة حسب الفرع الأول
            if ($hasCustomerIdColumn) {
                $normalReturnsQuery .= " AND ((u.branch_id = ? OR u.role = 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL))";
                $normalReturnsParams[] = $branchId;
                $normalReturnsParams[] = $branchId;
            } else {
                $normalReturnsQuery .= " AND (u.branch_id = ? OR u.role = 'admin')";
                $normalReturnsParams[] = $branchId;
            }
            
            $normalReturnsResult = dbSelectOne($normalReturnsQuery, $normalReturnsParams);
            $totalNormalReturns = floatval($normalReturnsResult['total'] ?? 0);
            if ($totalNormalReturns === null) {
                $totalNormalReturns = 0;
            }
        }
        
        // 6. جلب المبيعات (للفرع الأول فقط)
        $totalSales = 0;
        $totalSalesRevenue = 0;
        $totalSalesCost = 0;
        
        if ($isFirstBranch) {
            $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
            
            $salesQuery = "SELECT s.id FROM sales s 
                           INNER JOIN users u ON s.created_by = u.id";
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
                    $saleItems = dbSelect("SELECT * FROM sale_items WHERE sale_id = ?", [$sale['id']]);
                    
                    if ($saleItems !== false && is_array($saleItems)) {
                        foreach ($saleItems as $item) {
                            $itemType = $item['item_type'] ?? '';
                            $itemId = $item['item_id'] ?? '';
                            $quantity = intval($item['quantity'] ?? 1);
                            $unitPrice = floatval($item['unit_price'] ?? 0);
                            
                            $totalSalesRevenue += ($unitPrice * $quantity);
                            
                            // جلب سعر التكلفة
                            $purchasePrice = 0;
                            if ($itemType === 'inventory') {
                                $inventoryItem = dbSelectOne("SELECT purchase_price FROM inventory WHERE id = ?", [$itemId]);
                                $purchasePrice = floatval($inventoryItem['purchase_price'] ?? 0);
                            } elseif ($itemType === 'spare_part') {
                                $sparePart = dbSelectOne("SELECT purchase_price FROM spare_parts WHERE id = ?", [$itemId]);
                                $purchasePrice = floatval($sparePart['purchase_price'] ?? 0);
                            } elseif ($itemType === 'accessory') {
                                $accessory = dbSelectOne("SELECT purchase_price FROM accessories WHERE id = ?", [$itemId]);
                                $purchasePrice = floatval($accessory['purchase_price'] ?? 0);
                            } elseif ($itemType === 'phone') {
                                $phone = dbSelectOne("SELECT purchase_price FROM phones WHERE id = ?", [$itemId]);
                                $purchasePrice = floatval($phone['purchase_price'] ?? 0);
                            }
                            
                            $totalSalesCost += ($purchasePrice * $quantity);
                        }
                    }
                }
            }
            
            $totalSales = $totalSalesRevenue;
        }
        
        // حساب إجمالي الإيرادات
        if ($isFirstBranch) {
            $totalRevenue = $totalSales + $totalRepairProfits;
        } else {
            $totalRevenue = $totalRepairProfits;
        }
        
        // حساب صافي رصيد الخزنة الحالي (بدون السحب الجديد)
        // صافي رصيد الخزنة = (إجمالي الإيرادات + إجمالي الإيداعات) - (إجمالي مصروفات الفرع + إجمالي تكاليف عمليات الصيانة + إجمالي العمليات الخاسرة + إجمالي السحوبات + إجمالي المرتجعات التالفة + إجمالي المرتجعات السليمة)
        // قيمة إيجابية تعني ربح، قيمة سالبة تعني خسارة
        $currentNetBalance = ($totalRevenue + $totalDeposits) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalWithdrawals + $totalDamagedReturns + $totalNormalReturns);
        
        // التحقق من أن الرصيد كافٍ للسحب (يجب أن يكون الرصيد أكبر أو يساوي المبلغ المطلوب سحبه)
        if ($currentNetBalance < $amount) {
            $availableBalance = max(0, $currentNetBalance);
            response(false, "رصيد الخزنة غير كافٍ. الرصيد المتاح: " . number_format($availableBalance, 2) . " ج.م والمبلغ المطلوب: " . number_format($amount, 2) . " ج.م", null, 400);
        }
        
    } catch (Exception $e) {
        error_log('Error calculating treasury balance: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء التحقق من رصيد الخزنة', null, 500);
    }
    
    $session = checkAuth();
    $withdrawalId = generateId();
    
    // إضافة السحب كمعاملة في سجل الخزنة
    $result = dbExecute(
        "INSERT INTO treasury_transactions (
            id, branch_id, transaction_type, amount, description, 
            reference_id, reference_type, created_at, created_by
        ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'withdrawal', NOW(), ?)",
        [$withdrawalId, $branchId, $amount, $description, $withdrawalId, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في تسجيل السحب', null, 500);
    }
    
    $withdrawal = dbSelectOne(
        "SELECT * FROM treasury_transactions WHERE id = ?",
        [$withdrawalId]
    );
    
    response(true, 'تم تسجيل السحب بنجاح', $withdrawal);
}

// جلب سجل السحوبات
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
    
    $withdrawals = dbSelect(
        "SELECT t.*, u.name as created_by_name 
         FROM treasury_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.branch_id = ? AND t.transaction_type = 'withdrawal'
         ORDER BY t.created_at DESC",
        [$branchId]
    );
    
    if ($withdrawals === false) {
        response(false, 'خطأ في جلب السحوبات', null, 500);
    }
    
    response(true, 'تم جلب السحوبات بنجاح', $withdrawals);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


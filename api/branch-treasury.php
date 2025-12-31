<?php
/**
 * API لجلب بيانات خزنة الفرع
 * يعرض: المبيعات، عمليات الصيانة، المصروفات، العمليات الخاسرة
 */

require_once 'config.php';

$method = getRequestMethod();

if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    $isManager = ($userRole === 'manager');
    
    // التحقق من الصلاحيات - فقط المدير والمالك يمكنهم رؤية بيانات الخزنة
    if (!$isOwner && !$isManager) {
        response(false, 'ليس لديك صلاحية لعرض بيانات الخزنة', null, 403);
    }
    
    $requestedBranchId = $_GET['branch_id'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $filterType = $_GET['filter_type'] ?? 'month'; // 'today', 'month', 'custom'
    
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
    
    // جلب معرف الفرع الأول
    $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
    $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
    $isFirstBranch = ($branchId === $firstBranchId);
    
    // تحديد الفترة الزمنية
    $now = new DateTime();
    if ($filterType === 'today') {
        $startDate = $now->format('Y-m-d');
        $endDate = $now->format('Y-m-d');
    } elseif ($filterType === 'month') {
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
    } elseif ($filterType === 'custom') {
        if (!$startDate || !$endDate) {
            response(false, 'تاريخ البداية والنهاية مطلوبان للفلترة المخصصة', null, 400);
        }
    } else {
        response(false, 'نوع الفلترة غير صحيح', null, 400);
    }
    
    // 1. جلب المصروفات
    $expensesQuery = "SELECT SUM(amount) as total FROM expenses WHERE branch_id = ? AND expense_date BETWEEN ? AND ?";
    $expensesResult = dbSelectOne($expensesQuery, [$branchId, $startDate, $endDate]);
    $totalExpenses = floatval($expensesResult['total'] ?? 0);
    
    // 2. جلب تكاليف عمليات الصيانة المرتبطة بالفرع
    $repairCostsQuery = "SELECT SUM(repair_cost) as total FROM repairs WHERE branch_id = ? AND status = 'delivered' 
                         AND ((delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                              OR (delivery_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))";
    $repairCostsResult = dbSelectOne($repairCostsQuery, [$branchId, $startDate, $endDate, $startDate, $endDate]);
    $totalRepairCosts = floatval($repairCostsResult['total'] ?? 0);
    
    // 3. جلب أرباح عمليات الصيانة المرتبطة بالفرع
    $repairProfitsQuery = "SELECT SUM(customer_price - repair_cost) as total FROM repairs 
                           WHERE branch_id = ? AND status = 'delivered' 
                           AND ((delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                                OR (delivery_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))";
    $repairProfitsResult = dbSelectOne($repairProfitsQuery, [$branchId, $startDate, $endDate, $startDate, $endDate]);
    $totalRepairProfits = floatval($repairProfitsResult['total'] ?? 0);
    
    // 4. جلب العمليات الخاسرة المرتبطة بالفرع
    // ملاحظة: جدول loss_operations لا يحتوي على branch_id حالياً
    // سنستخدم repair_number للربط مع repairs
    $lossQuery = "SELECT SUM(lo.loss_amount) as total 
                  FROM loss_operations lo
                  INNER JOIN repairs r ON lo.repair_number = r.repair_number
                  WHERE r.branch_id = ? AND DATE(lo.created_at) BETWEEN ? AND ?";
    $lossResult = dbSelectOne($lossQuery, [$branchId, $startDate, $endDate]);
    $totalLosses = floatval($lossResult['total'] ?? 0);
    
    // في حالة عدم وجود ربط (NULL)، نعتبر القيمة 0
    if ($totalLosses === null) {
        $totalLosses = 0;
    }
    
    // 5. جلب السحوبات من الخزنة (من نموذج سحب من الخزنة)
    // هذه السحوبات من treasury_transactions (transaction_type = 'withdrawal' و reference_type != 'salary_deduction')
    $treasuryWithdrawalsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                                 WHERE branch_id = ? AND transaction_type = 'withdrawal' 
                                 AND (reference_type IS NULL OR reference_type != 'salary_deduction')
                                 AND DATE(created_at) BETWEEN ? AND ?";
    $treasuryWithdrawalsResult = dbSelectOne($treasuryWithdrawalsQuery, [$branchId, $startDate, $endDate]);
    $totalTreasuryWithdrawals = floatval($treasuryWithdrawalsResult['total'] ?? 0);
    
    if ($totalTreasuryWithdrawals === null) {
        $totalTreasuryWithdrawals = 0;
    }
    
    // إجمالي السحوبات = سحوبات الخزنة + مسحوبات الرواتب
    $totalWithdrawals = $totalTreasuryWithdrawals;
    
    // 5.1. جلب المسحوبات فقط (type='withdrawal') من الرواتب مباشرة من salary_deductions
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
    
    // إضافة المسحوبات من الرواتب إلى إجمالي السحوبات (لحساب صافي رصيد الخزنة)
    $totalWithdrawals += $totalSalaryWithdrawals;
    
    // 5.1. جلب الإيداعات إلى الخزنة
    $depositsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                      WHERE branch_id = ? AND transaction_type = 'deposit' 
                      AND DATE(created_at) BETWEEN ? AND ?";
    $depositsResult = dbSelectOne($depositsQuery, [$branchId, $startDate, $endDate]);
    $totalDeposits = floatval($depositsResult['total'] ?? 0);
    if ($totalDeposits === null) {
        $totalDeposits = 0;
    }
    
    // 5.2. جلب تحصيلات الدين من العملاء التجاريين
    $debtCollectionsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                             WHERE branch_id = ? AND transaction_type = 'debt_collection' 
                             AND DATE(created_at) BETWEEN ? AND ?";
    $debtCollectionsResult = dbSelectOne($debtCollectionsQuery, [$branchId, $startDate, $endDate]);
    $totalDebtCollections = floatval($debtCollectionsResult['total'] ?? 0);
    if ($totalDebtCollections === null) {
        $totalDebtCollections = 0;
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
    $salesProfit = 0;
    
    if ($isFirstBranch) {
        $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
        
        $salesQuery = "SELECT s.id FROM sales s 
                       INNER JOIN users u ON s.created_by = u.id";
        if ($hasCustomerIdColumn) {
            $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
        }
        $salesQuery .= " WHERE DATE(s.created_at) BETWEEN ? AND ?";
        $salesParams = [$startDate, $endDate];
        
        // فلترة المبيعات حسب الفرع الأول
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
        
        $salesProfit = $totalSalesRevenue - $totalSalesCost;
        $totalSales = $totalSalesRevenue;
    }
    
    // حساب إجمالي الإيرادات
    if ($isFirstBranch) {
        // الفرع الأول: المبيعات + أرباح عمليات الصيانة
        $totalRevenue = $totalSales + $totalRepairProfits;
    } else {
        // الفرع الثاني: أرباح عمليات الصيانة فقط
        $totalRevenue = $totalRepairProfits;
    }
    
    // حساب صافي رصيد الخزنة
    // صافي رصيد الخزنة = (إجمالي الإيرادات + إجمالي الإيداعات) - (إجمالي مصروفات الفرع + إجمالي تكاليف عمليات الصيانة + إجمالي العمليات الخاسرة + إجمالي السحوبات + إجمالي المرتجعات التالفة + إجمالي المرتجعات السليمة)
    // قيمة إيجابية تعني ربح، قيمة سالبة تعني خسارة
    $netBalance = ($totalRevenue + $totalDeposits) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalWithdrawals + $totalDamagedReturns + $totalNormalReturns);
    
    $data = [
        'branch_id' => $branchId,
        'is_first_branch' => $isFirstBranch,
        'filter_type' => $filterType,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'expenses' => [
            'total' => $totalExpenses
        ],
        'repairs' => [
            'total_costs' => $totalRepairCosts,
            'total_profits' => $totalRepairProfits
        ],
        'loss_operations' => [
            'total' => $totalLosses
        ],
        'withdrawals' => [
            'total' => $totalWithdrawals, // إجمالي السحوبات (سحوبات الخزنة + مسحوبات الرواتب)
            'treasury_withdrawals' => $totalTreasuryWithdrawals, // السحوبات من نموذج سحب من الخزنة (مُدرجة في total)
            'salary_withdrawals' => $totalSalaryWithdrawals // المسحوبات فقط (type='withdrawal') من الرواتب (مُدرجة في total)
        ],
        'deposits' => [
            'total' => $totalDeposits
        ],
        'debt_collections' => [
            'total' => $totalDebtCollections
        ],
        'damaged_returns' => [
            'total' => $totalDamagedReturns
        ],
        'normal_returns' => $isFirstBranch ? [
            'total' => $totalNormalReturns
        ] : null,
        'sales' => $isFirstBranch ? [
            'total' => $totalSales,
            'total_revenue' => $totalSalesRevenue,
            'total_cost' => $totalSalesCost,
            'profit' => $salesProfit
        ] : null,
        'revenue' => [
            'total' => $totalRevenue
        ],
        'net_balance' => $netBalance
    ];
    
    response(true, 'تم جلب بيانات الخزنة بنجاح', $data);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


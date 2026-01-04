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
    $isOwner = ($userRole === 'admin' || $userRole === 'owner');
    $isManager = ($userRole === 'manager');
    $isTechnician = ($userRole === 'technician');
    
    // التحقق من الصلاحيات - المالك والمدير وفني الصيانة يمكنهم رؤية بيانات الخزنة
    // فني الصيانة يمكنه رؤية بيانات فرعه فقط
    if (!$isOwner && !$isManager && !$isTechnician) {
        response(false, 'ليس لديك صلاحية لعرض بيانات الخزنة', null, 403);
    }
    
    $requestedBranchId = $_GET['branch_id'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $filterType = $_GET['filter_type'] ?? 'month'; // 'today', 'month', 'custom'
    
    // إذا لم يكن المستخدم مالك، يجب أن يطلب فرعه فقط (يشمل المدير وفني الصيانة)
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
    
    // ✅ إصلاح: تحديث الحالات الفارغة أو NULL إلى 'delivered' إذا كان لديها delivery_date
    // وتسجيل أرباح الصيانة في treasury_transactions للعمليات التي تم تحديث حالتها
    try {
        // جلب العمليات التي سيتم تحديث حالتها
        $repairsToFix = dbSelect(
            "SELECT id, repair_number, branch_id, customer_price, repair_cost 
             FROM repairs 
             WHERE (status IS NULL OR status = '' OR status = ' ') 
             AND delivery_date IS NOT NULL 
             AND branch_id IS NOT NULL"
        );
        
        if ($repairsToFix && count($repairsToFix) > 0) {
            // تحديث الحالة
            $fixStatusQuery = "UPDATE repairs 
                              SET status = 'delivered' 
                              WHERE (status IS NULL OR status = '' OR status = ' ') 
                              AND delivery_date IS NOT NULL";
            $fixStatusResult = dbExecute($fixStatusQuery, []);
            
            if ($fixStatusResult !== false) {
                error_log("✅ [Branch Treasury] تم تحديث " . count($repairsToFix) . " عملية من الحالة الفارغة إلى 'delivered'");
                
                // تسجيل أرباح الصيانة في treasury_transactions
                if (dbTableExists('treasury_transactions')) {
                    $conn = getDBConnection();
                    if ($conn) {
                        try {
                            $conn->query("ALTER TABLE treasury_transactions MODIFY transaction_type enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection') NOT NULL");
                        } catch (Exception $e) {
                            // تجاهل الخطأ
                        }
                    }
                    
                    foreach ($repairsToFix as $repair) {
                        $customerPrice = floatval($repair['customer_price'] ?? 0);
                        $repairCost = floatval($repair['repair_cost'] ?? 0);
                        $profit = $customerPrice - $repairCost;
                        $repairId = $repair['id'];
                        $repairBranchId = $repair['branch_id'];
                        $repairNumber = $repair['repair_number'] ?? $repairId;
                        
                        if ($profit > 0) {
                            // التحقق من عدم وجود معاملة مسجلة مسبقاً
                            $existingTransaction = dbSelectOne(
                                "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = 'repair_profit'",
                                [$repairId]
                            );
                            
                            if (!$existingTransaction) {
                                $transactionId = generateId();
                                $transactionDescription = "ربح عملية صيانة - رقم العملية: {$repairNumber}";
                                
                                $transactionResult = dbExecute(
                                    "INSERT INTO treasury_transactions (
                                        id, branch_id, transaction_type, amount, description, 
                                        reference_id, reference_type, created_at, created_by
                                    ) VALUES (?, ?, 'repair_profit', ?, ?, ?, 'repair', NOW(), NULL)",
                                    [$transactionId, $repairBranchId, $profit, $transactionDescription, $repairId]
                                );
                                
                                if ($transactionResult !== false) {
                                    error_log("✅ [Branch Treasury] تم تسجيل ربح الصيانة في treasury_transactions: {$profit} ج.م للعملية {$repairNumber}");
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (Exception $e) {
        error_log("⚠️ [Branch Treasury] خطأ في تحديث الحالات: " . $e->getMessage());
    }
    
    // ✅ تحديث العمليات المسلمة التي لا يوجد لها delivery_date (للاسترجاع/الإصلاح)
    // هذا يضمن أن جميع العمليات المسلمة لديها delivery_date
    try {
        $updateQuery = "UPDATE repairs 
                       SET delivery_date = DATE(COALESCE(updated_at, created_at)) 
                       WHERE status = 'delivered' AND delivery_date IS NULL";
        dbExecute($updateQuery, []);
        error_log("✅ [Branch Treasury] تم تحديث delivery_date للعمليات المسلمة بدون تاريخ تسليم");
    } catch (Exception $e) {
        error_log("⚠️ [Branch Treasury] خطأ في تحديث delivery_date: " . $e->getMessage());
    }
    
    // ✅ التحقق من وجود عمليات مسلمة بدون branch_id - هذا للاسترجاع فقط
    $repairsWithoutBranch = dbSelect("SELECT id, repair_number FROM repairs WHERE status = 'delivered' AND branch_id IS NULL LIMIT 10");
    if ($repairsWithoutBranch && count($repairsWithoutBranch) > 0) {
        error_log("⚠️ [Branch Treasury] يوجد " . count($repairsWithoutBranch) . " عمليات مسلمة بدون branch_id");
    }
    
    // ✅ استعلامات تشخيصية شاملة للتحقق من البيانات الفعلية
    // 1. إجمالي العمليات في النظام
    $totalRepairsQuery = "SELECT COUNT(*) as total FROM repairs";
    $totalRepairsResult = dbSelectOne($totalRepairsQuery);
    $totalRepairs = intval($totalRepairsResult['total'] ?? 0);
    error_log("🔍 [Branch Treasury Debug] إجمالي العمليات في النظام: {$totalRepairs}");
    
    // 2. جميع الحالات المستخدمة في النظام
    $statusQuery = "SELECT status, COUNT(*) as count FROM repairs GROUP BY status ORDER BY count DESC";
    $statusResults = dbSelect($statusQuery);
    if ($statusResults && count($statusResults) > 0) {
        error_log("🔍 [Branch Treasury Debug] توزيع الحالات في النظام:");
        foreach ($statusResults as $statusRow) {
            error_log("   - {$statusRow['status']}: {$statusRow['count']} عملية");
        }
    }
    
    // 3. العمليات للفرع المحدد (جميع الحالات)
    $branchAllQuery = "SELECT COUNT(*) as total FROM repairs WHERE branch_id = ?";
    $branchAllResult = dbSelectOne($branchAllQuery, [$branchId]);
    $branchAll = intval($branchAllResult['total'] ?? 0);
    error_log("🔍 [Branch Treasury Debug] إجمالي عمليات الفرع {$branchId}: {$branchAll}");
    
    // 4. توزيع الحالات للفرع المحدد
    $branchStatusQuery = "SELECT status, COUNT(*) as count FROM repairs WHERE branch_id = ? GROUP BY status ORDER BY count DESC";
    $branchStatusResults = dbSelect($branchStatusQuery, [$branchId]);
    if ($branchStatusResults && count($branchStatusResults) > 0) {
        error_log("🔍 [Branch Treasury Debug] توزيع الحالات للفرع {$branchId}:");
        foreach ($branchStatusResults as $statusRow) {
            error_log("   - {$statusRow['status']}: {$statusRow['count']} عملية");
        }
    }
    
    // 5. إجمالي العمليات المسلمة في النظام (delivered)
    $debugQuery1 = "SELECT COUNT(*) as total FROM repairs WHERE status = 'delivered'";
    $debugResult1 = dbSelectOne($debugQuery1);
    $totalDelivered = intval($debugResult1['total'] ?? 0);
    error_log("🔍 [Branch Treasury Debug] إجمالي العمليات المسلمة (delivered) في النظام: {$totalDelivered}");
    
    // 6. العمليات المسلمة للفرع المحدد
    $debugQuery2 = "SELECT COUNT(*) as total FROM repairs WHERE branch_id = ? AND status = 'delivered'";
    $debugResult2 = dbSelectOne($debugQuery2, [$branchId]);
    $branchDelivered = intval($debugResult2['total'] ?? 0);
    error_log("🔍 [Branch Treasury Debug] العمليات المسلمة (delivered) للفرع {$branchId}: {$branchDelivered}");
    
    // 7. التحقق من عمليات بجميع الحالات المحتملة للانتهاء
    $allCompletedStatuses = ['delivered', 'completed', 'finished', 'done'];
    foreach ($allCompletedStatuses as $status) {
        $statusCountQuery = "SELECT COUNT(*) as total FROM repairs WHERE branch_id = ? AND status = ?";
        $statusCountResult = dbSelectOne($statusCountQuery, [$branchId, $status]);
        $statusCount = intval($statusCountResult['total'] ?? 0);
        if ($statusCount > 0) {
            error_log("🔍 [Branch Treasury Debug] وجدت {$statusCount} عملية بحالة '{$status}' للفرع {$branchId}");
        }
    }
    
    // 8. عينة من العمليات المسلمة للفرع (بدون فلترة تاريخ)
    $sampleQuery = "SELECT id, repair_number, branch_id, status, customer_price, repair_cost, 
                           delivery_date, updated_at, created_at,
                           (customer_price - repair_cost) as profit
                    FROM repairs 
                    WHERE branch_id = ? AND status = 'delivered' 
                    ORDER BY created_at DESC LIMIT 5";
    $sampleRepairs = dbSelect($sampleQuery, [$branchId]);
    if ($sampleRepairs && count($sampleRepairs) > 0) {
        error_log("🔍 [Branch Treasury Debug] عينة من العمليات المسلمة للفرع:");
        foreach ($sampleRepairs as $repair) {
            $profit = floatval($repair['profit'] ?? 0);
            $deliveryDate = $repair['delivery_date'] ?? 'NULL';
            $updatedAt = $repair['updated_at'] ?? 'NULL';
            $createdAt = $repair['created_at'] ?? 'NULL';
            error_log("   - {$repair['repair_number']}: الربح={$profit}, الحالة={$repair['status']}, delivery_date={$deliveryDate}, updated_at={$updatedAt}, created_at={$createdAt}");
        }
    } else {
        error_log("🔍 [Branch Treasury Debug] لا توجد عمليات مسلمة (delivered) للفرع {$branchId}");
        
        // 9. محاولة جلب أي عمليات للفرع (بأي حالة) تحتوي على بيانات مالية
        $anyRepairsQuery = "SELECT id, repair_number, branch_id, status, customer_price, repair_cost, 
                                   delivery_date, updated_at, created_at,
                                   (customer_price - repair_cost) as profit
                            FROM repairs 
                            WHERE branch_id = ? 
                            AND customer_price > 0 
                            AND repair_cost >= 0
                            ORDER BY created_at DESC LIMIT 10";
        $anyRepairs = dbSelect($anyRepairsQuery, [$branchId]);
        if ($anyRepairs && count($anyRepairs) > 0) {
            error_log("🔍 [Branch Treasury Debug] عينة من عمليات الفرع (بأي حالة) مع بيانات مالية:");
            foreach ($anyRepairs as $repair) {
                $profit = floatval($repair['profit'] ?? 0);
                $deliveryDate = $repair['delivery_date'] ?? 'NULL';
                error_log("   - {$repair['repair_number']}: الحالة={$repair['status']}, الربح={$profit}, delivery_date={$deliveryDate}");
            }
        }
    }
    
    // جلب العمليات المسلمة مع فلترة التاريخ (بما في ذلك الحالات الفارغة مع delivery_date)
    $filteredQuery = "SELECT COUNT(*) as count, SUM(customer_price - repair_cost) as total_profit
                      FROM repairs 
                      WHERE branch_id = ? 
                      AND (status = 'delivered' OR (status IS NULL OR status = '' OR status = ' ') AND delivery_date IS NOT NULL)
                      AND (
                          (delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                          OR (delivery_date IS NULL AND updated_at IS NOT NULL AND DATE(updated_at) BETWEEN ? AND ?)
                          OR (delivery_date IS NULL AND updated_at IS NULL AND DATE(created_at) BETWEEN ? AND ?)
                      )";
    $filteredResult = dbSelectOne($filteredQuery, [$branchId, $startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
    $filteredCount = intval($filteredResult['count'] ?? 0);
    $filteredProfit = floatval($filteredResult['total_profit'] ?? 0);
    error_log("🔍 [Branch Treasury Debug] العمليات المسلمة للفرع في الفترة ({$startDate} - {$endDate}): {$filteredCount} عمليات، إجمالي الربح: {$filteredProfit}");
    
    // 1. جلب المصروفات
    $expensesQuery = "SELECT SUM(amount) as total FROM expenses WHERE branch_id = ? AND expense_date BETWEEN ? AND ?";
    $expensesResult = dbSelectOne($expensesQuery, [$branchId, $startDate, $endDate]);
    $totalExpenses = floatval($expensesResult['total'] ?? 0);
    
    // 2. جلب تكاليف عمليات الصيانة المرتبطة بالفرع
    $totalRepairCosts = 0;
    if ($isFirstBranch) {
        // الفرع الأول: من جدول repairs مباشرة (النظام القديم)
        $repairCostsQuery = "SELECT SUM(repair_cost) as total FROM repairs WHERE branch_id = ? 
                             AND (status = 'delivered' OR (status IS NULL OR status = '' OR status = ' ') AND delivery_date IS NOT NULL)
                             AND (
                                 (delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                                 OR (delivery_date IS NULL AND updated_at IS NOT NULL AND DATE(updated_at) BETWEEN ? AND ?)
                                 OR (delivery_date IS NULL AND updated_at IS NULL AND DATE(created_at) BETWEEN ? AND ?)
                             )";
        $repairCostsResult = dbSelectOne($repairCostsQuery, [$branchId, $startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
        $totalRepairCosts = floatval($repairCostsResult['total'] ?? 0);
    } else {
        // الفرع الثاني: من treasury_transactions فقط (يتم تسجيله عند تغيير الحالة إلى 'ready_for_delivery')
        if (dbTableExists('treasury_transactions')) {
            $repairCostsQuery = "SELECT SUM(amount) as total FROM treasury_transactions 
                                 WHERE branch_id = ? AND transaction_type = 'repair_cost' 
                                 AND DATE(created_at) BETWEEN ? AND ?";
            $repairCostsResult = dbSelectOne($repairCostsQuery, [$branchId, $startDate, $endDate]);
            $totalRepairCosts = floatval($repairCostsResult['total'] ?? 0);
            if ($totalRepairCosts === null) {
                $totalRepairCosts = 0;
            }
        }
    }
    
    // 3. جلب أرباح عمليات الصيانة المرتبطة بالفرع
    $totalRepairProfits = 0;
    if ($isFirstBranch) {
        // الفرع الأول: من جدول repairs مباشرة (النظام القديم)
        $repairProfitsQuery = "SELECT SUM(customer_price - repair_cost) as total FROM repairs 
                               WHERE branch_id = ? 
                               AND (status = 'delivered' OR (status IS NULL OR status = '' OR status = ' ') AND delivery_date IS NOT NULL)
                               AND (
                                   (delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                                   OR (delivery_date IS NULL AND updated_at IS NOT NULL AND DATE(updated_at) BETWEEN ? AND ?)
                                   OR (delivery_date IS NULL AND updated_at IS NULL AND DATE(created_at) BETWEEN ? AND ?)
                               )";
        $repairProfitsResult = dbSelectOne($repairProfitsQuery, [$branchId, $startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
        $totalRepairProfits = floatval($repairProfitsResult['total'] ?? 0);
        
        // ✅ إذا كانت النتيجة 0، نتحقق باستخدام استعلام بديل أبسط (بدون فلترة التاريخ أولاً)
        if ($totalRepairProfits == 0) {
            $altQuery = "SELECT SUM(customer_price - repair_cost) as total FROM repairs 
                         WHERE branch_id = ? 
                         AND (status = 'delivered' OR (status IS NULL OR status = '' OR status = ' ') AND delivery_date IS NOT NULL)";
            $altResult = dbSelectOne($altQuery, [$branchId]);
            $altTotal = floatval($altResult['total'] ?? 0);
            
            if ($altTotal > 0) {
                error_log("⚠️ [Branch Treasury] يوجد {$altTotal} أرباح للفرع ولكن خارج الفترة المحددة ({$startDate} - {$endDate})");
                
                $flexibleQuery = "SELECT SUM(customer_price - repair_cost) as total FROM repairs 
                                 WHERE branch_id = ? 
                                 AND (status = 'delivered' OR (status IS NULL OR status = '' OR status = ' ') AND delivery_date IS NOT NULL)
                                 AND (DATE(delivery_date) BETWEEN ? AND ? 
                                      OR DATE(updated_at) BETWEEN ? AND ?
                                      OR DATE(created_at) BETWEEN ? AND ?)";
                $flexibleResult = dbSelectOne($flexibleQuery, [$branchId, $startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
                $flexibleTotal = floatval($flexibleResult['total'] ?? 0);
                
                if ($flexibleTotal > 0) {
                    $totalRepairProfits = $flexibleTotal;
                    error_log("✅ [Branch Treasury] تم استخدام استعلام مرن - الأرباح: {$flexibleTotal}");
                }
            }
        }
    } else {
        // الفرع الثاني: إيرادات = (إجمالي المدفوع مقدماً + إجمالي المتبقي)
        // المدفوع مقدماً: يُحسب مباشرة من treasury_transactions (deposit - مبلغ مدفوع مقدماً)
        // المتبقي: يُحسب من treasury_transactions (deposit - المبلغ المتبقي) لكن فقط للعملاء retail (ليس commercial)
        $totalRepairProfits = 0;
        
        if (dbTableExists('treasury_transactions')) {
            // 1. جلب المدفوع مقدماً (جميع العملاء)
            $paidAmountQuery = "SELECT SUM(tt.amount) as total FROM treasury_transactions tt
                               INNER JOIN repairs r ON tt.reference_id = r.id
                               WHERE tt.branch_id = ? 
                               AND tt.transaction_type = 'deposit'
                               AND tt.reference_type = 'repair'
                               AND tt.description LIKE '%مبلغ مدفوع مقدماً%'
                               AND DATE(tt.created_at) BETWEEN ? AND ?";
            $paidAmountResult = dbSelectOne($paidAmountQuery, [$branchId, $startDate, $endDate]);
            $totalPaidAmount = floatval($paidAmountResult['total'] ?? 0);
            if ($totalPaidAmount === null) {
                $totalPaidAmount = 0;
            }
            
            // 2. جلب المتبقي (فقط للعملاء retail - ليس commercial)
            $remainingAmountQuery = "SELECT SUM(tt.amount) as total FROM treasury_transactions tt
                                    INNER JOIN repairs r ON tt.reference_id = r.id
                                    LEFT JOIN customers c ON r.customer_id = c.id
                                    WHERE tt.branch_id = ? 
                                    AND tt.transaction_type = 'deposit'
                                    AND tt.reference_type = 'repair'
                                    AND tt.description LIKE '%المبلغ المتبقي%'
                                    AND (c.customer_type IS NULL OR c.customer_type = 'retail' OR c.customer_type != 'commercial')
                                    AND DATE(tt.created_at) BETWEEN ? AND ?";
            $remainingAmountResult = dbSelectOne($remainingAmountQuery, [$branchId, $startDate, $endDate]);
            $totalRemainingAmount = floatval($remainingAmountResult['total'] ?? 0);
            if ($totalRemainingAmount === null) {
                $totalRemainingAmount = 0;
            }
            
            // إجمالي الإيرادات = المدفوع مقدماً + المتبقي (لكن فقط من retail)
            $totalRepairProfits = $totalPaidAmount + $totalRemainingAmount;
        }
    }
    
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
        
        // ✅ إصلاح: جلب final_amount من جدول sales مباشرة (بعد خصم الخصم)
        $salesQuery = "SELECT s.id, s.final_amount FROM sales s 
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
                // ✅ إصلاح: استخدام final_amount من جدول sales (بعد خصم الخصم)
                $finalAmount = floatval($sale['final_amount'] ?? 0);
                $totalSalesRevenue += $finalAmount;
                
                // حساب التكلفة من sale_items (التكلفة لا تتأثر بالخصم)
                $saleItems = dbSelect("SELECT * FROM sale_items WHERE sale_id = ?", [$sale['id']]);
                
                if ($saleItems !== false && is_array($saleItems)) {
                    foreach ($saleItems as $item) {
                        $itemType = $item['item_type'] ?? '';
                        $itemId = $item['item_id'] ?? '';
                        $quantity = intval($item['quantity'] ?? 1);
                        
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
    if ($isFirstBranch) {
        // الفرع الأول: المعادلة القديمة (المحافظة على التوافق)
        // صافي رصيد الخزنة = (إجمالي الإيرادات + إجمالي الإيداعات) - (إجمالي مصروفات الفرع + إجمالي تكاليف عمليات الصيانة + إجمالي العمليات الخاسرة + إجمالي السحوبات + إجمالي المرتجعات التالفة + إجمالي المرتجعات السليمة)
        $netBalance = ($totalRevenue + $totalDeposits) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalWithdrawals + $totalDamagedReturns + $totalNormalReturns);
    } else {
        // الفرع الثاني: المعادلة الجديدة
        // صافي رصيد الخزنة = (إجمالي الإيرادات + إجمالي الإضافات + إجمالي تحصيلات الدين) - (إجمالي مصروفات الفرع + إجمالي تكاليف عمليات الصيانة + إجمالي العمليات الخاسرة + إجمالي المسحوبات + سحوبات من الخزنة)
        // قيمة إيجابية تعني ربح، قيمة سالبة تعني خسارة
        $netBalance = ($totalRevenue + $totalDeposits + $totalDebtCollections) - ($totalExpenses + $totalRepairCosts + $totalLosses + $totalSalaryWithdrawals + $totalTreasuryWithdrawals);
    }
    
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


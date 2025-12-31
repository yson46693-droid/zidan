<?php
require_once 'config.php';

$method = getRequestMethod();

if ($method === 'GET') {
    checkAuth();
    
    $type = $_GET['type'] ?? 'daily';
    $startDate = $_GET['start_date'] ?? date('Y-m-d');
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    $branchId = $_GET['branch_id'] ?? null;
    
    // حساب الإيرادات (صافي ربح عمليات الصيانة - فقط العمليات المسلمة)
    $revenue = 0;
    $repairsList = [];
    $totalRepairProfit = 0;
    $totalRepairCosts = 0;
    
    // بناء استعلام العمليات المسلمة
    if ($type === 'daily') {
        $repairsQuery = "SELECT * FROM repairs 
                        WHERE status = 'delivered' 
                        AND (DATE(delivery_date) = ? OR (delivery_date IS NULL AND DATE(created_at) = ?))";
        $repairsParams = [$startDate, $startDate];
        
        // إضافة فلترة الفرع إذا كان محدد
        if ($branchId) {
            $repairsQuery .= " AND branch_id = ?";
            $repairsParams[] = $branchId;
        }
    } elseif ($type === 'monthly') {
        $repairsQuery = "SELECT * FROM repairs 
                        WHERE status = 'delivered' 
                        AND (DATE_FORMAT(delivery_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m') 
                             OR (delivery_date IS NULL AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')))";
        $repairsParams = [$startDate, $startDate];
        
        // إضافة فلترة الفرع إذا كان محدد
        if ($branchId) {
            $repairsQuery .= " AND branch_id = ?";
            $repairsParams[] = $branchId;
        }
    } else { // custom
        $repairsQuery = "SELECT * FROM repairs 
                        WHERE status = 'delivered' 
                        AND ((delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                             OR (delivery_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))";
        $repairsParams = [$startDate, $endDate, $startDate, $endDate];
        
        // إضافة فلترة الفرع إذا كان محدد
        if ($branchId) {
            $repairsQuery .= " AND branch_id = ?";
            $repairsParams[] = $branchId;
        }
    }
    
    $repairs = dbSelect($repairsQuery, $repairsParams);
    
    if ($repairs !== false) {
        foreach ($repairs as $repair) {
            $customerPrice = floatval($repair['customer_price'] ?? 0);
            $repairCost = floatval($repair['repair_cost'] ?? 0);
            $repairProfit = $customerPrice - $repairCost;
            
            $revenue += $repairProfit;
            $totalRepairProfit += $repairProfit;
            $totalRepairCosts += $repairCost;
            $repair['profit'] = $repairProfit;
            $repair['cost'] = $customerPrice; // للتوافق
            $repairsList[] = $repair;
        }
    }
    
    // حساب المصروفات
    $totalExpenses = 0;
    $expensesList = [];
    
    // 1. المصروفات المسجلة
    if ($type === 'daily') {
        $expensesQuery = "SELECT * FROM expenses WHERE expense_date = ?";
        $expensesParams = [$startDate];
    } elseif ($type === 'monthly') {
        $expensesQuery = "SELECT * FROM expenses WHERE DATE_FORMAT(expense_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')";
        $expensesParams = [$startDate];
    } else { // custom
        $expensesQuery = "SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ?";
        $expensesParams = [$startDate, $endDate];
    }
    
    // إضافة فلترة الفرع للمصروفات إذا كان محدد
    if ($branchId) {
        $expensesQuery .= " AND branch_id = ?";
        $expensesParams[] = $branchId;
    }
    
    $expenses = dbSelect($expensesQuery, $expensesParams);
    
    if ($expenses !== false) {
        foreach ($expenses as $expense) {
            $totalExpenses += floatval($expense['amount']);
            $expense['date'] = $expense['expense_date']; // للتوافق
            $expensesList[] = $expense;
        }
    }
    
    // 2. تكلفة المخزون (تكلفة الشراء الكلية)
    // ✅ ملاحظة: المخزون مشترك بين الفروع، لذلك لا نفلتره حسب الفرع
    // (المخزون هو تكلفة شراء عامة وليست مصروفات فرع محدد)
    // ⚠️ مهم: تكلفة المخزون لا تُضاف للمصروفات - تُخصم فقط عند البيع (في $totalSalesCost)
    $inventory = dbSelect("SELECT purchase_price, quantity FROM inventory");
    $inventoryCost = 0;
    
    if ($inventory !== false) {
        foreach ($inventory as $item) {
            $purchasePrice = floatval($item['purchase_price'] ?? 0);
            $quantity = floatval($item['quantity'] ?? 0);
            $inventoryCost += ($purchasePrice * $quantity);
        }
    }
    
    // ❌ لا نضيف تكلفة المخزون للمصروفات
    // تكلفة المخزون تُخصم فقط عند البيع (في حساب $totalSalesCost)
    // $totalExpenses += $inventoryCost;
    
    // 3. العمليات الخاسرة
    $lossExpenses = 0;
    $lossList = [];
    
    if ($type === 'daily') {
        $lossQuery = "SELECT * FROM loss_operations WHERE DATE(created_at) = ?";
        $lossParams = [$startDate];
    } elseif ($type === 'monthly') {
        $lossQuery = "SELECT * FROM loss_operations WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')";
        $lossParams = [$startDate];
    } else { // custom
        $lossQuery = "SELECT * FROM loss_operations WHERE DATE(created_at) BETWEEN ? AND ?";
        $lossParams = [$startDate, $endDate];
    }
    
    // ملاحظة: جدول loss_operations لا يحتوي على branch_id
    // العمليات الخاسرة لا تُفلتر حسب الفرع حالياً
    
    $lossOperations = dbSelect($lossQuery, $lossParams);
    
    if ($lossOperations !== false) {
        foreach ($lossOperations as $loss) {
            $lossExpenses += floatval($loss['loss_amount']);
            $lossList[] = $loss;
        }
    }
    
    // إضافة العمليات الخاسرة للمصروفات
    $totalExpenses += $lossExpenses;
    
    // حساب صافي ربح المبيعات من نقاط البيع
    $salesProfit = 0;
    $totalSalesRevenue = 0;
    $totalSalesCost = 0;
    
    // بناء استعلام المبيعات مع فلترة حسب الفرع
    // ملاحظة: نستخدم INNER JOIN لضمان أن المبيعات مرتبطة بمستخدم
    // معالجة خاصة للمالكين (admin) - جميع مبيعاتهم تُحسب في الفرع الأول فقط
    // ✅ إصلاح: إضافة JOIN مع جدول customers للفلترة حسب فرع العميل أيضاً
    $hasCustomerIdColumn = dbColumnExists('sales', 'customer_id');
    
    if ($type === 'daily') {
        $salesQuery = "SELECT s.id FROM sales s 
                       INNER JOIN users u ON s.created_by = u.id";
        if ($hasCustomerIdColumn) {
            $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
        }
        $salesQuery .= " WHERE DATE(s.created_at) = ?";
        $salesParams = [$startDate];
    } elseif ($type === 'monthly') {
        $salesQuery = "SELECT s.id FROM sales s 
                       INNER JOIN users u ON s.created_by = u.id";
        if ($hasCustomerIdColumn) {
            $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
        }
        $salesQuery .= " WHERE DATE_FORMAT(s.created_at, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')";
        $salesParams = [$startDate];
    } else { // custom
        $salesQuery = "SELECT s.id FROM sales s 
                       INNER JOIN users u ON s.created_by = u.id";
        if ($hasCustomerIdColumn) {
            $salesQuery .= " LEFT JOIN customers c ON s.customer_id = c.id";
        }
        $salesQuery .= " WHERE DATE(s.created_at) BETWEEN ? AND ?";
        $salesParams = [$startDate, $endDate];
    }
    
    // إضافة فلترة الفرع للمبيعات إذا كان محدد
    if ($branchId) {
        // جلب معرف الفرع الأول (للتعامل مع المالكين)
        $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
        $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
        
        // فلترة حسب branch_id مع معالجة خاصة للمالكين:
        // - جميع مبيعات المالكين (admin) تُحسب دائماً في الفرع الأول فقط (للعملاء من الفرع الأول)
        // - مبيعات المستخدمين العاديين تُحسب في الفرع المحدد حسب branch_id
        if ($firstBranchId && $branchId === $firstBranchId) {
            // للفرع الأول: نضيف المبيعات من المستخدمين الذين لهم branch_id = الفرع الأول
            // + جميع مبيعات المالكين (للعملاء من الفرع الأول فقط)
            if ($hasCustomerIdColumn) {
                // ✅ إصلاح: فلترة حسب فرع العميل أيضاً
                // للمالكين: نحسب فقط المبيعات للعملاء من الفرع الأول (c.branch_id = الفرع الأول)
                // للمستخدمين العاديين: نحسب المبيعات للعملاء من الفرع الأول أيضاً
                // c.branch_id IS NULL للعملاء القديمين (قبل إضافة عمود branch_id) - نعتبرهم من الفرع الأول
                $salesQuery .= " AND ((u.branch_id = ? OR u.role = 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL))";
                $salesParams[] = $branchId;
                $salesParams[] = $branchId;
            } else {
                // للجداول القديمة التي لا تحتوي على customer_id
                $salesQuery .= " AND (u.branch_id = ? OR u.role = 'admin')";
                $salesParams[] = $branchId;
            }
        } else {
            // للفروع الأخرى: فقط المبيعات من المستخدمين العاديين (وليس المالكين) الذين لهم branch_id = الفرع المحدد
            // + يجب أن يكون العميل من نفس الفرع
            if ($hasCustomerIdColumn) {
                $salesQuery .= " AND u.branch_id = ? AND (u.role IS NULL OR u.role != 'admin') AND (c.branch_id = ? OR c.branch_id IS NULL)";
                $salesParams[] = $branchId;
                $salesParams[] = $branchId;
            } else {
                $salesQuery .= " AND u.branch_id = ? AND (u.role IS NULL OR u.role != 'admin')";
                $salesParams[] = $branchId;
            }
        }
    }
    
    $sales = dbSelect($salesQuery, $salesParams);
    
    // تسجيل للتصحيح
    if ($branchId) {
        $salesCount = is_array($sales) ? count($sales) : 0;
        error_log("🔍 [Reports] Branch ID: $branchId, Sales Count: $salesCount");
        error_log("🔍 [Reports] Sales Query: " . $salesQuery);
        error_log("🔍 [Reports] Sales Params: " . json_encode($salesParams));
        if (is_array($sales) && count($sales) > 0) {
            error_log("🔍 [Reports] First Sale ID: " . $sales[0]['id']);
            // جلب تفاصيل أول عملية بيع للتصحيح
            $firstSale = dbSelectOne(
                "SELECT s.id, s.customer_id, s.created_by, u.role, u.branch_id as user_branch_id, c.branch_id as customer_branch_id 
                 FROM sales s 
                 INNER JOIN users u ON s.created_by = u.id 
                 LEFT JOIN customers c ON s.customer_id = c.id 
                 WHERE s.id = ?",
                [$sales[0]['id']]
            );
            if ($firstSale) {
                error_log("🔍 [Reports] First Sale Details: " . json_encode($firstSale));
            }
        } else {
            error_log("⚠️ [Reports] No sales found for branch $branchId");
            // جلب عينة من المبيعات للتحقق
            $sampleSales = dbSelect(
                "SELECT s.id, s.customer_id, s.created_by, u.role, u.branch_id as user_branch_id, c.branch_id as customer_branch_id 
                 FROM sales s 
                 INNER JOIN users u ON s.created_by = u.id 
                 LEFT JOIN customers c ON s.customer_id = c.id 
                 WHERE DATE(s.created_at) = ? 
                 LIMIT 5",
                [$startDate]
            );
            if ($sampleSales) {
                error_log("🔍 [Reports] Sample sales for today: " . json_encode($sampleSales));
            }
        }
    }
    
    if ($sales !== false && is_array($sales)) {
        foreach ($sales as $sale) {
            // جلب عناصر البيع
            $saleItems = dbSelect(
                "SELECT * FROM sale_items WHERE sale_id = ?",
                [$sale['id']]
            );
            
            if ($saleItems !== false && is_array($saleItems)) {
                foreach ($saleItems as $item) {
                    $itemType = $item['item_type'] ?? '';
                    $itemId = $item['item_id'] ?? '';
                    $quantity = intval($item['quantity'] ?? 1);
                    $unitPrice = floatval($item['unit_price'] ?? 0);
                    
                    // حساب إجمالي سعر البيع
                    $totalSalesRevenue += ($unitPrice * $quantity);
                    
                    // جلب سعر التكلفة حسب نوع العنصر
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
                    
                    // حساب إجمالي سعر التكلفة
                    $totalSalesCost += ($purchasePrice * $quantity);
                }
            }
        }
    }
    
    // صافي ربح المبيعات = إجمالي أسعار البيع - إجمالي أسعار التكلفة
    $salesProfit = $totalSalesRevenue - $totalSalesCost;
    
    // إجمالي الإيرادات = صافي ربح العمليات + صافي ربح المبيعات
    $totalRevenue = $revenue + $salesProfit;
    
    // صافي الربح النهائي = الإيرادات الكلية - المصروفات
    $profit = $totalRevenue - $totalExpenses;
    
    $report = [
        'type' => $type,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'revenue' => $revenue,
        'sales_profit' => $salesProfit,
        'total_sales_revenue' => $totalSalesRevenue,
        'total_sales_cost' => $totalSalesCost,
        'total_revenue' => $totalRevenue,
        'total_repair_profit' => $totalRepairProfit,
        'total_repair_costs' => $totalRepairCosts,
        'expenses' => $totalExpenses,
        'registered_expenses' => $totalExpenses - $lossExpenses,
        'inventory_cost' => $inventoryCost,
        'loss_expenses' => $lossExpenses,
        'profit' => $profit,
        'repairs_count' => count($repairsList),
        'expenses_count' => count($expensesList),
        'losses_count' => count($lossList),
        'repairs' => $repairsList,
        'expenses_list' => $expensesList,
        'loss_list' => $lossList
    ];
    
    response(true, '', $report);
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

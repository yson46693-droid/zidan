<?php
require_once 'config.php';

$method = getRequestMethod();

if ($method === 'GET') {
    checkAuth();
    
    $type = $_GET['type'] ?? 'daily';
    $startDate = $_GET['start_date'] ?? date('Y-m-d');
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    
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
    } elseif ($type === 'monthly') {
        $repairsQuery = "SELECT * FROM repairs 
                        WHERE status = 'delivered' 
                        AND (DATE_FORMAT(delivery_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m') 
                             OR (delivery_date IS NULL AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')))";
        $repairsParams = [$startDate, $startDate];
    } else { // custom
        $repairsQuery = "SELECT * FROM repairs 
                        WHERE status = 'delivered' 
                        AND ((delivery_date IS NOT NULL AND DATE(delivery_date) BETWEEN ? AND ?)
                             OR (delivery_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))";
        $repairsParams = [$startDate, $endDate, $startDate, $endDate];
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
    
    $expenses = dbSelect($expensesQuery, $expensesParams);
    
    if ($expenses !== false) {
        foreach ($expenses as $expense) {
            $totalExpenses += floatval($expense['amount']);
            $expense['date'] = $expense['expense_date']; // للتوافق
            $expensesList[] = $expense;
        }
    }
    
    // 2. تكلفة المخزون (تكلفة الشراء الكلية)
    $inventory = dbSelect("SELECT purchase_price, quantity FROM inventory");
    $inventoryCost = 0;
    
    if ($inventory !== false) {
        foreach ($inventory as $item) {
            $purchasePrice = floatval($item['purchase_price'] ?? 0);
            $quantity = floatval($item['quantity'] ?? 0);
            $inventoryCost += ($purchasePrice * $quantity);
        }
    }
    
    // إضافة تكلفة المخزون للمصروفات
    $totalExpenses += $inventoryCost;
    
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
    
    $lossOperations = dbSelect($lossQuery, $lossParams);
    
    if ($lossOperations !== false) {
        foreach ($lossOperations as $loss) {
            $lossExpenses += floatval($loss['loss_amount']);
            $lossList[] = $loss;
        }
    }
    
    // إضافة العمليات الخاسرة للمصروفات
    $totalExpenses += $lossExpenses;
    
    // صافي الربح = الإيرادات - المصروفات
    $profit = $revenue - $totalExpenses;
    
    $report = [
        'type' => $type,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'revenue' => $revenue,
        'total_repair_profit' => $totalRepairProfit,
        'total_repair_costs' => $totalRepairCosts,
        'expenses' => $totalExpenses,
        'registered_expenses' => $totalExpenses - $inventoryCost - $lossExpenses,
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

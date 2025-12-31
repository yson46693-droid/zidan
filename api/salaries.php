<?php
require_once 'config.php';

/**
 * إنشاء جدول salary_deductions إذا لم يكن موجوداً
 * @return bool
 */
function ensureSalaryDeductionsTable() {
    if (dbTableExists('salary_deductions')) {
        return true;
    }
    
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return false;
        }
        
        $sql = "CREATE TABLE IF NOT EXISTS `salary_deductions` (
            `id` varchar(50) NOT NULL,
            `user_id` varchar(50) NOT NULL,
            `amount` decimal(10,2) NOT NULL,
            `type` enum('withdrawal','deduction') NOT NULL DEFAULT 'withdrawal',
            `description` text DEFAULT NULL,
            `month_year` date NOT NULL,
            `created_at` datetime NOT NULL,
            `updated_at` datetime DEFAULT NULL,
            `created_by` varchar(50) DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_user_id` (`user_id`),
            KEY `idx_month_year` (`month_year`),
            KEY `idx_type` (`type`),
            KEY `idx_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        if ($conn->query($sql)) {
            error_log('✅ تم إنشاء جدول salary_deductions بنجاح');
            return true;
        } else {
            error_log('❌ خطأ في إنشاء جدول salary_deductions: ' . $conn->error);
            return false;
        }
    } catch (Exception $e) {
        error_log('❌ خطأ في إنشاء جدول salary_deductions: ' . $e->getMessage());
        return false;
    }
}

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// التأكد من وجود جدول salary_deductions قبل أي عملية
ensureSalaryDeductionsTable();

// قراءة الموظفين والمديرين مع رواتبهم
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'] ?? 'employee';
    $userBranchId = $session['branch_id'] ?? null;
    $isOwner = ($userRole === 'admin');
    
    try {
        $branchId = $_GET['branch_id'] ?? $data['branch_id'] ?? null;
        $monthYear = $_GET['month_year'] ?? $data['month_year'] ?? null;
        
        // إذا لم يتم تحديد الشهر، استخدام الشهر الحالي
        if (!$monthYear) {
            $monthYear = date('Y-m');
        }
        
        // التحقق من صحة تنسيق الشهر (YYYY-MM)
        if (!preg_match('/^\d{4}-\d{2}$/', $monthYear)) {
            $monthYear = date('Y-m');
        }
        
        // بناء الاستعلام
        $query = "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, 
                         b.name as branch_name
                  FROM users u 
                  LEFT JOIN branches b ON u.branch_id = b.id 
                  WHERE u.role IN ('employee', 'manager', 'technician')";
        
        $params = [];
        
        // إذا كان المستخدم غير مالك، فلترة حسب فرعه فقط
        if (!$isOwner && $userBranchId) {
            $query .= " AND u.branch_id = ?";
            $params[] = $userBranchId;
        } elseif ($isOwner && $branchId && $branchId !== '') {
            // المالك يمكنه اختيار الفرع
            $query .= " AND u.branch_id = ?";
            $params[] = $branchId;
        }
        
        $query .= " ORDER BY u.role, u.name ASC";
        
        $users = dbSelect($query, $params);
        
        if ($users === false) {
            response(false, 'خطأ في قراءة الموظفين', null, 500);
        }
        
        // إضافة معلومات المسحوبات والخصومات لكل مستخدم
        foreach ($users as &$user) {
            $userId = $user['id'];
            
            // الحصول على المسحوبات والخصومات للشهر المحدد
            try {
                $deductions = dbSelect(
                    "SELECT id, amount, type, description, created_at, month_year
                     FROM salary_deductions 
                     WHERE user_id = ? AND DATE_FORMAT(month_year, '%Y-%m') = ? 
                     ORDER BY created_at DESC",
                    [$userId, $monthYear]
                );
                
                $user['deductions'] = $deductions !== false ? $deductions : [];
            } catch (Exception $e) {
                // إذا كان الجدول غير موجود، محاولة إنشاؤه مرة أخرى
                if (strpos($e->getMessage(), "doesn't exist") !== false) {
                    ensureSalaryDeductionsTable();
                    $deductions = dbSelect(
                        "SELECT id, amount, type, description, created_at, month_year
                         FROM salary_deductions 
                         WHERE user_id = ? AND DATE_FORMAT(month_year, '%Y-%m') = ? 
                         ORDER BY created_at DESC",
                        [$userId, $monthYear]
                    );
                    $user['deductions'] = $deductions !== false ? $deductions : [];
                } else {
                    $user['deductions'] = [];
                }
            }
            
            // حساب إجمالي المسحوبات والخصومات منفصلة
            $totalDeductions = 0; // الخصومات فقط (type = 'deduction')
            $totalWithdrawals = 0; // المسحوبات فقط (type = 'withdrawal')
            if ($user['deductions']) {
                foreach ($user['deductions'] as $deduction) {
                    $amount = floatval($deduction['amount']);
                    if ($deduction['type'] === 'deduction') {
                        $totalDeductions += $amount;
                    } else if ($deduction['type'] === 'withdrawal') {
                        $totalWithdrawals += $amount;
                    }
                }
            }
            
            $user['total_deductions'] = $totalDeductions; // الخصومات فقط
            $user['total_withdrawals'] = $totalWithdrawals; // المسحوبات فقط
            $user['net_salary'] = floatval($user['salary'] ?? 0) - $totalDeductions - $totalWithdrawals;
            $user['month_year'] = $monthYear; // إضافة الشهر المحدد للاستجابة
        }
        
        response(true, '', $users);
    } catch (Exception $e) {
        error_log('Error in salaries.php GET: ' . $e->getMessage());
        response(false, 'خطأ في قراءة المستحقات', null, 500);
    }
}

// الحصول على تفاصيل مستخدم معين (للمودال)
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'user_details') {
    checkAuth();
    
    try {
        $userId = $_GET['user_id'] ?? $data['user_id'] ?? '';
        
        if (empty($userId)) {
            response(false, 'معرف المستخدم مطلوب', null, 400);
        }
        
        // الحصول على معلومات المستخدم
        // ✅ ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
        // تنظيف userId فقط دون تحويله إلى رقم
        $userId = trim($userId);
        if (empty($userId) || $userId === 'null' || $userId === 'undefined') {
            response(false, 'معرف المستخدم غير صحيح', null, 400);
        }
        
        // ✅ استخدام نفس الاستعلام الذي يعمل في جدول المستحقات
        $user = dbSelectOne(
            "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, 
                    b.name as branch_name
             FROM users u 
             LEFT JOIN branches b ON u.branch_id = b.id 
             WHERE u.id = ? AND u.role IN ('employee', 'manager', 'technician')",
            [$userId]
        );
        
        if (!$user || $user === false) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // ✅ التأكد من أن id موجود دائماً
        // ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
        if (!isset($user['id']) || $user['id'] === null || $user['id'] === '') {
            $user['id'] = $userId;
        } else {
            $user['id'] = trim($user['id']);
        }
        
        // ✅ التأكد من أن id صحيح (string غير فارغ)
        if (empty($user['id']) || $user['id'] === 'null' || $user['id'] === 'undefined') {
            $user['id'] = $userId;
        }
        
        // ✅ التأكد من أن جميع الحقول موجودة - معالجة شاملة للقيم null والفارغة
        // معالجة name
        if (!isset($user['name']) || $user['name'] === null || $user['name'] === '' || 
            (is_string($user['name']) && trim($user['name']) === '') ||
            $user['name'] === 'null' || $user['name'] === 'undefined') {
            $user['name'] = 'غير محدد';
        } else {
            $user['name'] = trim($user['name']);
        }
        
        // معالجة username
        if (!isset($user['username']) || $user['username'] === null || $user['username'] === '' || 
            (is_string($user['username']) && trim($user['username']) === '') ||
            $user['username'] === 'null' || $user['username'] === 'undefined') {
            $user['username'] = 'غير محدد';
        } else {
            $user['username'] = trim($user['username']);
        }
        
        // معالجة role
        if (!isset($user['role']) || $user['role'] === null || $user['role'] === '' || 
            (is_string($user['role']) && trim($user['role']) === '') ||
            $user['role'] === 'null' || $user['role'] === 'undefined') {
            $user['role'] = 'employee'; // قيمة افتراضية
        } else {
            $user['role'] = trim($user['role']);
        }
        
        // معالجة branch_name - استخدام COALESCE في SQL بدلاً من PHP
        if (!isset($user['branch_name']) || $user['branch_name'] === null || $user['branch_name'] === '' || 
            (is_string($user['branch_name']) && trim($user['branch_name']) === '') ||
            $user['branch_name'] === 'null' || $user['branch_name'] === 'undefined') {
            $user['branch_name'] = 'غير محدد';
        } else {
            $user['branch_name'] = trim($user['branch_name']);
        }
        
        // ✅ التأكد من أن salary موجود
        if (!isset($user['salary']) || $user['salary'] === null || $user['salary'] === '') {
            $user['salary'] = 0;
        } else {
            $user['salary'] = floatval($user['salary']);
        }
        
        // الحصول على جميع المسحوبات والخصومات
        try {
            $deductions = dbSelect(
                "SELECT id, amount, type, description, month_year, created_at 
                 FROM salary_deductions 
                 WHERE user_id = ? 
                 ORDER BY month_year DESC, created_at DESC",
                [$userId]
            );
            
            $user['deductions'] = $deductions !== false ? $deductions : [];
        } catch (Exception $e) {
            // إذا كان الجدول غير موجود، محاولة إنشاؤه مرة أخرى
            if (strpos($e->getMessage(), "doesn't exist") !== false) {
                ensureSalaryDeductionsTable();
                $deductions = dbSelect(
                    "SELECT id, amount, type, description, month_year, created_at 
                     FROM salary_deductions 
                     WHERE user_id = ? 
                     ORDER BY month_year DESC, created_at DESC",
                    [$userId]
                );
                $user['deductions'] = $deductions !== false ? $deductions : [];
            } else {
                $user['deductions'] = [];
            }
        }
        
        // تجميع المسحوبات حسب الشهر
        $monthlyDeductions = [];
        foreach ($user['deductions'] as $deduction) {
            $monthYear = $deduction['month_year'];
            if (!isset($monthlyDeductions[$monthYear])) {
                $monthlyDeductions[$monthYear] = [];
            }
            $monthlyDeductions[$monthYear][] = $deduction;
        }
        $user['monthly_deductions'] = $monthlyDeductions;
        
        // ✅ التحقق النهائي من أن جميع الحقول الأساسية موجودة
        if (!isset($user['id']) || $user['id'] <= 0) {
            $user['id'] = $userId;
        }
        if (!isset($user['name']) || trim($user['name']) === '') {
            $user['name'] = 'غير محدد';
        }
        if (!isset($user['username']) || trim($user['username']) === '') {
            $user['username'] = 'غير محدد';
        }
        if (!isset($user['role']) || trim($user['role']) === '') {
            $user['role'] = 'employee';
        }
        if (!isset($user['branch_name']) || trim($user['branch_name']) === '') {
            $user['branch_name'] = 'غير محدد';
        }
        
        response(true, '', $user);
    } catch (Exception $e) {
        error_log('Error in salaries.php user_details: ' . $e->getMessage());
        response(false, 'خطأ في قراءة تفاصيل المستخدم', null, 500);
    }
}

// الحصول على جميع السحوبات والخصومات لجميع المستخدمين
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'all_deductions') {
    checkAuth();
    
    try {
        $userId = $_GET['user_id'] ?? $data['user_id'] ?? null;
        
        // بناء الاستعلام لجلب جميع السحوبات والخصومات مع معلومات المستخدمين
        // استخدام LEFT JOIN لضمان جلب جميع السجلات حتى لو كان user_id فارغاً
        // استخدام COALESCE لضمان الحصول على اسم المستخدم حتى لو كان name فارغاً
        $query = "SELECT sd.id, sd.user_id, sd.amount, sd.type, sd.description, sd.month_year, sd.created_at, sd.created_by,
                         COALESCE(NULLIF(u.name, ''), u.username, 'غير محدد') as user_name,
                         COALESCE(u.username, '') as user_username, 
                         COALESCE(u.role, '') as user_role,
                         COALESCE(NULLIF(b.name, ''), 'غير محدد') as branch_name
                  FROM salary_deductions sd
                  LEFT JOIN users u ON sd.user_id = u.id AND u.role IN ('employee', 'manager', 'technician')
                  LEFT JOIN branches b ON u.branch_id = b.id";
        
        $params = [];
        
        // فلترة حسب المستخدم إذا تم تحديده
        if ($userId && $userId !== '' && $userId !== 'all') {
            $query .= " AND sd.user_id = ?";
            $params[] = $userId;
        }
        
        $query .= " ORDER BY sd.created_at DESC, sd.month_year DESC";
        
        $deductions = dbSelect($query, $params);
        
        if ($deductions === false) {
            error_log('❌ خطأ في جلب السحوبات والخصومات من قاعدة البيانات');
            response(false, 'خطأ في قراءة السحوبات والخصومات', null, 500);
        }
        
        // التأكد من أن deductions هي مصفوفة
        if (!is_array($deductions)) {
            $deductions = [];
        }
        
        // تنظيف البيانات - التأكد من أن كل عنصر له الحقول المطلوبة
        $cleanedDeductions = [];
        foreach ($deductions as $deduction) {
            if (!isset($deduction['id']) || empty($deduction['id'])) {
                continue; // تخطي السجلات غير الصحيحة
            }
            
            // التأكد من وجود user_id - إذا كان فارغاً، جلب user_id من قاعدة البيانات
            $userId = $deduction['user_id'] ?? '';
            if (empty($userId) || trim($userId) === '') {
                // محاولة جلب user_id من قاعدة البيانات باستخدام id السحب
                $deductionInfo = dbSelectOne("SELECT user_id FROM salary_deductions WHERE id = ?", [$deduction['id']]);
                if ($deductionInfo && !empty($deductionInfo['user_id'])) {
                    $userId = $deductionInfo['user_id'];
                    // تحديث user_id في البيانات
                    $deduction['user_id'] = $userId;
                    
                    // جلب بيانات المستخدم من قاعدة البيانات
                    $userInfo = dbSelectOne(
                        "SELECT u.id, u.name, u.username, u.role, b.name as branch_name 
                         FROM users u 
                         LEFT JOIN branches b ON u.branch_id = b.id 
                         WHERE u.id = ?",
                        [$userId]
                    );
                    
                    if ($userInfo) {
                        $deduction['user_name'] = !empty($userInfo['name']) ? $userInfo['name'] : $userInfo['username'];
                        $deduction['user_username'] = $userInfo['username'] ?? '';
                        $deduction['user_role'] = $userInfo['role'] ?? '';
                        $deduction['branch_name'] = $userInfo['branch_name'] ?? 'غير محدد';
                    }
                }
            }
            
            // جلب اسم المستخدم - الاستعلام يستخدم COALESCE لذا يجب أن يكون موجوداً
            $userName = '';
            if (!empty($deduction['user_name']) && trim($deduction['user_name']) !== 'غير محدد') {
                $userName = trim($deduction['user_name']);
            } elseif (!empty($deduction['user_username'])) {
                $userName = trim($deduction['user_username']);
            } else {
                $userName = 'غير محدد';
            }
            
            // جلب اسم الفرع
            $branchName = '';
            if (!empty($deduction['branch_name']) && trim($deduction['branch_name']) !== 'غير محدد') {
                $branchName = trim($deduction['branch_name']);
            } else {
                $branchName = 'غير محدد';
            }
            
            $cleanedDeductions[] = [
                'id' => $deduction['id'] ?? '',
                'user_id' => $userId,
                'amount' => floatval($deduction['amount'] ?? 0),
                'type' => $deduction['type'] ?? 'withdrawal',
                'description' => $deduction['description'] ?? '',
                'month_year' => $deduction['month_year'] ?? '',
                'created_at' => $deduction['created_at'] ?? '',
                'created_by' => $deduction['created_by'] ?? '',
                'user_name' => $userName,
                'user_username' => $deduction['user_username'] ?? '',
                'user_role' => $deduction['user_role'] ?? '',
                'branch_name' => $branchName
            ];
        }
        
        // تسجيل عينة من البيانات للتحقق
        if (count($cleanedDeductions) > 0) {
            error_log('✅ عينة من البيانات المرجعة: ' . json_encode($cleanedDeductions[0], JSON_UNESCAPED_UNICODE));
        }
        
        // جلب قائمة المستخدمين الذين لديهم سحوبات/خصومات
        $usersQuery = "SELECT DISTINCT u.id, u.name, u.username, u.role, b.name as branch_name
                       FROM users u
                       INNER JOIN salary_deductions sd ON u.id = sd.user_id
                       LEFT JOIN branches b ON u.branch_id = b.id
                       WHERE u.role IN ('employee', 'manager', 'technician')
                       ORDER BY u.name ASC";
        
        $users = dbSelect($usersQuery, []);
        
        // التأكد من أن users هي مصفوفة
        if (!is_array($users)) {
            $users = [];
        }
        
        // تنظيف بيانات المستخدمين
        $cleanedUsers = [];
        foreach ($users as $user) {
            if (!isset($user['id']) || empty($user['id'])) {
                continue;
            }
            
            $cleanedUsers[] = [
                'id' => $user['id'] ?? '',
                'name' => $user['name'] ?? $user['username'] ?? 'غير محدد',
                'username' => $user['username'] ?? '',
                'role' => $user['role'] ?? '',
                'branch_name' => $user['branch_name'] ?? 'غير محدد'
            ];
        }
        
        error_log('✅ تم جلب ' . count($cleanedDeductions) . ' سجل من السحوبات والخصومات و ' . count($cleanedUsers) . ' مستخدم');
        
        response(true, '', [
            'deductions' => $cleanedDeductions,
            'users' => $cleanedUsers
        ]);
    } catch (Exception $e) {
        error_log('Error in salaries.php GET all_deductions: ' . $e->getMessage());
        response(false, 'خطأ في قراءة السحوبات والخصومات', null, 500);
    }
}

// إضافة مسحوبة/خصم
if ($method === 'POST') {
    checkPermission('manager');
    
    try {
        if (!isset($data['user_id']) || !isset($data['amount']) || !isset($data['type'])) {
            response(false, 'المستخدم والمبلغ والنوع مطلوبون', null, 400);
        }
        
        $userId = trim($data['user_id']);
        $amount = floatval($data['amount']);
        $deductionType = trim($data['type']); // 'withdrawal' أو 'deduction'
        $description = trim($data['description'] ?? '');
        $monthYear = $data['month_year'] ?? date('Y-m-d');
        
        if (empty($userId) || $amount <= 0) {
            response(false, 'المستخدم والمبلغ مطلوبان', null, 400);
        }
        
        // التحقق من وجود المستخدم والحصول على branch_id
        $user = dbSelectOne("SELECT id, branch_id FROM users WHERE id = ?", [$userId]);
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        $branchId = $user['branch_id'] ?? null;
        if (!$branchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 400);
        }
        
        $session = checkAuth();
        $deductionId = generateId();
        
        // التأكد من وجود الجدول قبل الإدراج
        ensureSalaryDeductionsTable();
        
        $result = dbExecute(
            "INSERT INTO salary_deductions (id, user_id, amount, type, description, month_year, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$deductionId, $userId, $amount, $deductionType, $description, $monthYear, $session['user_id']]
        );
        
        if ($result === false) {
            // إذا كان الخطأ متعلق بجدول غير موجود، محاولة إنشاؤه مرة أخرى
            $conn = getDBConnection();
            if ($conn && strpos($conn->error, "doesn't exist") !== false) {
                ensureSalaryDeductionsTable();
                $result = dbExecute(
                    "INSERT INTO salary_deductions (id, user_id, amount, type, description, month_year, created_at, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
                    [$deductionId, $userId, $amount, $deductionType, $description, $monthYear, $session['user_id']]
                );
            }
            
            if ($result === false) {
                response(false, 'خطأ في إضافة المسحوبة/الخصم', null, 500);
            }
        }
        
        // ✅ تسجيل المسحوبة/الخصم في سجل معاملات الخزنة
        try {
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
                    
                    $conn->query($createTableSQL);
                }
            }
            
            // إنشاء وصف للمعاملة
            $userName = dbSelectOne("SELECT name FROM users WHERE id = ?", [$userId]);
            $userNameText = $userName ? $userName['name'] : 'مستخدم غير معروف';
            $transactionDescription = ($deductionType === 'withdrawal' ? 'مسحوبة راتب' : 'خصم راتب') . ' - ' . $userNameText;
            if (!empty($description)) {
                $transactionDescription .= ' - ' . $description;
            }
            
            // إضافة المعاملة في treasury_transactions
            $transactionId = generateId();
            $transactionResult = dbExecute(
                "INSERT INTO treasury_transactions (
                    id, branch_id, transaction_type, amount, description, 
                    reference_id, reference_type, created_at, created_by
                ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'salary_deduction', NOW(), ?)",
                [$transactionId, $branchId, $amount, $transactionDescription, $deductionId, $session['user_id']]
            );
            
            if ($transactionResult === false) {
                error_log('⚠️ تحذير: فشل تسجيل المسحوبة/الخصم في سجل معاملات الخزنة. ID: ' . $deductionId);
                // لا نوقف العملية، فقط نسجل تحذير
            }
        } catch (Exception $e) {
            error_log('⚠️ تحذير: خطأ في تسجيل المسحوبة/الخصم في سجل معاملات الخزنة: ' . $e->getMessage());
            // لا نوقف العملية، فقط نسجل تحذير
        }
        
        $newDeduction = dbSelectOne("SELECT * FROM salary_deductions WHERE id = ?", [$deductionId]);
        
        response(true, 'تم إضافة المسحوبة/الخصم بنجاح', $newDeduction);
    } catch (Exception $e) {
        error_log('Error in salaries.php POST: ' . $e->getMessage());
        response(false, 'خطأ في إضافة المسحوبة/الخصم', null, 500);
    }
}

// تعديل مسحوبة/خصم
if ($method === 'PUT') {
    checkPermission('manager');
    
    try {
        if (!isset($data['id'])) {
            $data = getRequestData();
        }
        
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف المسحوبة/الخصم مطلوب', null, 400);
        }
        
        // التأكد من وجود الجدول قبل البحث
        ensureSalaryDeductionsTable();
        
        // التحقق من وجود المسحوبة/الخصم والحصول على بياناتها
        $deduction = dbSelectOne("SELECT id, user_id, amount, type, description FROM salary_deductions WHERE id = ?", [$id]);
        if (!$deduction) {
            response(false, 'المسحوبة/الخصم غير موجود', null, 404);
        }
        
        // الحصول على branch_id من المستخدم
        $user = dbSelectOne("SELECT branch_id FROM users WHERE id = ?", [$deduction['user_id']]);
        $branchId = $user ? ($user['branch_id'] ?? null) : null;
        
        // بناء استعلام التحديث
        $updateFields = [];
        $updateParams = [];
        
        $newAmount = isset($data['amount']) ? floatval($data['amount']) : floatval($deduction['amount']);
        $newType = isset($data['type']) ? trim($data['type']) : $deduction['type'];
        $newDescription = isset($data['description']) ? trim($data['description']) : ($deduction['description'] ?? '');
        
        if (isset($data['amount'])) {
            $updateFields[] = "amount = ?";
            $updateParams[] = $newAmount;
        }
        
        if (isset($data['type'])) {
            $updateFields[] = "type = ?";
            $updateParams[] = $newType;
        }
        
        if (isset($data['description'])) {
            $updateFields[] = "description = ?";
            $updateParams[] = $newDescription;
        }
        
        if (isset($data['month_year'])) {
            $updateFields[] = "month_year = ?";
            $updateParams[] = $data['month_year'];
        }
        
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $id;
        
        $query = "UPDATE salary_deductions SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            response(false, 'خطأ في تعديل المسحوبة/الخصم', null, 500);
        }
        
        // ✅ تحديث المعاملة في treasury_transactions
        if ($branchId && (isset($data['amount']) || isset($data['type']) || isset($data['description']))) {
            try {
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
                        
                        $conn->query($createTableSQL);
                    }
                }
                
                // البحث عن المعاملة المرتبطة
                $transaction = dbSelectOne(
                    "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'salary_deduction'",
                    [$id]
                );
                
                $userName = dbSelectOne("SELECT name FROM users WHERE id = ?", [$deduction['user_id']]);
                $userNameText = $userName ? $userName['name'] : 'مستخدم غير معروف';
                $transactionDescription = ($newType === 'withdrawal' ? 'مسحوبة راتب' : 'خصم راتب') . ' - ' . $userNameText;
                if (!empty($newDescription)) {
                    $transactionDescription .= ' - ' . $newDescription;
                }
                
                if ($transaction) {
                    // تحديث المعاملة الموجودة
                    dbExecute(
                        "UPDATE treasury_transactions SET amount = ?, description = ? WHERE id = ?",
                        [$newAmount, $transactionDescription, $transaction['id']]
                    );
                } else {
                    // إنشاء معاملة جديدة إذا لم تكن موجودة (للمسحوبات القديمة)
                    $transactionId = generateId();
                    $session = checkAuth();
                    dbExecute(
                        "INSERT INTO treasury_transactions (
                            id, branch_id, transaction_type, amount, description, 
                            reference_id, reference_type, created_at, created_by
                        ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'salary_deduction', NOW(), ?)",
                        [$transactionId, $branchId, $newAmount, $transactionDescription, $id, $session['user_id']]
                    );
                }
            } catch (Exception $e) {
                error_log('⚠️ تحذير: خطأ في تحديث المعاملة في سجل معاملات الخزنة: ' . $e->getMessage());
                // لا نوقف العملية، فقط نسجل تحذير
            }
        }
        
        response(true, 'تم تعديل المسحوبة/الخصم بنجاح');
    } catch (Exception $e) {
        error_log('Error in salaries.php PUT: ' . $e->getMessage());
        response(false, 'خطأ في تعديل المسحوبة/الخصم', null, 500);
    }
}

// حذف مسحوبة/خصم
if ($method === 'DELETE') {
    checkPermission('manager');
    
    try {
        if (!isset($data['id'])) {
            $data = getRequestData();
        }
        
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف المسحوبة/الخصم مطلوب', null, 400);
        }
        
        // التأكد من وجود الجدول قبل البحث
        ensureSalaryDeductionsTable();
        
        // التحقق من وجود المسحوبة/الخصم
        $deduction = dbSelectOne("SELECT id FROM salary_deductions WHERE id = ?", [$id]);
        if (!$deduction) {
            response(false, 'المسحوبة/الخصم غير موجود', null, 404);
        }
        
        // ✅ حذف المعاملة المرتبطة من treasury_transactions قبل حذف المسحوبة/الخصم
        try {
            $transaction = dbSelectOne(
                "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'salary_deduction'",
                [$id]
            );
            
            if ($transaction) {
                dbExecute("DELETE FROM treasury_transactions WHERE id = ?", [$transaction['id']]);
            }
        } catch (Exception $e) {
            error_log('⚠️ تحذير: خطأ في حذف المعاملة من سجل معاملات الخزنة: ' . $e->getMessage());
            // لا نوقف العملية، فقط نسجل تحذير
        }
        
        $result = dbExecute("DELETE FROM salary_deductions WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف المسحوبة/الخصم', null, 500);
        }
        
        response(true, 'تم حذف المسحوبة/الخصم بنجاح');
    } catch (Exception $e) {
        error_log('Error in salaries.php DELETE: ' . $e->getMessage());
        response(false, 'خطأ في حذف المسحوبة/الخصم', null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


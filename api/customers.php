<?php
require_once 'config.php';
require_once 'invoices.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// Debug: logging للطلبات التي تحتوي على update_rating
if (isset($data['action']) && $data['action'] === 'update_rating') {
    error_log('🔍 update_rating request - Initial $data: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
    error_log('🔍 update_rating request - $GLOBALS: ' . json_encode($GLOBALS['_cached_request_data'] ?? [], JSON_UNESCAPED_UNICODE));
    error_log('🔍 update_rating request - Method: ' . $method);
}

/**
 * معالج أخطاء قاعدة البيانات - التحقق من الجداول الناقصة تلقائياً
 */
function handleDatabaseError($error, $query = '') {
    // التحقق من وجود خطأ متعلق بجدول غير موجود
    if (strpos($error, "doesn't exist") !== false || strpos($error, 'Table') !== false) {
        error_log("⚠️ تم اكتشاف جدول ناقص: $error");
        
        // استدعاء ملف التحقق من قاعدة البيانات
        if (file_exists(__DIR__ . '/check-database.php')) {
            require_once __DIR__ . '/check-database.php';
            $checkResult = checkAndCreateMissingTables();
            
            if ($checkResult['success'] && !empty($checkResult['tables_created'])) {
                error_log("✅ تم إنشاء الجداول الناقصة تلقائياً: " . implode(', ', $checkResult['tables_created']));
                // إعادة المحاولة بعد إنشاء الجداول
                return true;
            }
        }
        
        // محاولة استدعاء setupDatabase مباشرة
        if (file_exists(__DIR__ . '/setup.php')) {
            require_once __DIR__ . '/setup.php';
            $setupResult = setupDatabase();
            
            if ($setupResult['success'] && !empty($setupResult['tables_created'])) {
                error_log("✅ تم إنشاء الجداول الناقصة تلقائياً: " . implode(', ', $setupResult['tables_created']));
                return true;
            }
        }
    }
    
    return false;
}

/**
 * جلب الفرع الأول (الهانوفيل) حسب تاريخ الإنشاء
 */
function getFirstBranchId() {
    $firstBranch = dbSelectOne(
        "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
    );
    return $firstBranch ? $firstBranch['id'] : null;
}

// الحصول على مبيعات العميل - يجب أن يكون قبل الشرط العام GET
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'sales') {
    checkAuth();
    
    $customerId = $_GET['customer_id'] ?? '';
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل أولاً
    $customer = dbSelectOne("SELECT id, phone FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // إزالة كود Migration - لا نربط الفواتير القديمة تلقائياً
    // لأن هذا قد يربط فواتير عميل قديم بعميل جديد بنفس رقم الهاتف
    // الفواتير يجب أن تُربط بالعميل الصحيح عند إنشائها فقط
    
    // جلب مبيعات العميل - البحث باستخدام customer_id فقط
    // هذا يضمن جلب فقط الفواتير المرتبطة بهذا العميل تحديداً
    // لا نستخدم رقم الهاتف للربط لتجنب ربط فواتير عميل آخر
    $sales = dbSelect(
        "SELECT s.*, u.name as created_by_name 
         FROM sales s 
         LEFT JOIN users u ON s.created_by = u.id 
         WHERE s.customer_id = ?
         ORDER BY s.created_at DESC",
        [$customerId]
    );
    
    if ($sales === false) {
        error_log("خطأ في جلب مبيعات العميل $customerId: " . (isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف'));
        response(false, 'خطأ في قراءة المبيعات', null, 500);
    }
    
    // التأكد من أن $sales هو array
    if (!is_array($sales)) {
        $sales = [];
    }
    
    // Debug log removed for production
    
    // فلترة إضافية للمبيعات والتأكد من ربطها بالعميل
    $filteredSales = [];
    foreach ($sales as $sale) {
        // التأكد من وجود sale id
        if (empty($sale['id'])) {
            continue;
        }
        
        // التحقق من ربط الفاتورة بالعميل - استخدام customer_id فقط
        // لا نستخدم رقم الهاتف للربط لتجنب ربط فواتير عميل آخر
        if (empty($sale['customer_id']) || $sale['customer_id'] !== $customerId) {
            // إذا لم تكن الفاتورة مرتبطة بالعميل، تخطيها
            continue;
        }
        
        // جلب عناصر الفاتورة
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        
        // التأكد من أن $items هو array
        if (!is_array($items)) {
            $items = [];
        }
        
        // إذا كانت الفاتورة بدون عناصر، نستمر في المعالجة (قد تكون فاتورة قديمة)
        if (count($items) === 0) {
            // نستمر في المعالجة لكن نضيف items كـ array فارغ
        }
        
        $sale['items'] = $items;
        
        // التأكد من وجود sale_number
        if (empty($sale['sale_number'])) {
            $sale['sale_number'] = $sale['id'];
        }
        
        // حساب المبالغ من العناصر إذا كانت غير موجودة أو قيمتها 0
        $calculatedTotal = 0;
        foreach ($items as $item) {
            $itemTotal = floatval($item['total_price'] ?? 0);
            $itemQuantity = intval($item['quantity'] ?? 1);
            $calculatedTotal += ($itemTotal * $itemQuantity);
        }
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
        
        // إذا كانت المبالغ 0، نستخدم القيم المحسوبة من العناصر
        if ($sale['total_amount'] == 0 && $calculatedTotal > 0) {
            $sale['total_amount'] = $calculatedTotal;
        }
        if ($sale['final_amount'] == 0 && $calculatedTotal > 0) {
            $sale['final_amount'] = $calculatedTotal - $sale['discount'] + $sale['tax'];
        }
        
        // تم تعطيل حفظ الفواتير في مجلد الفواتير - البيانات تُحفظ في invoice_data فقط
        // إضافة مسار ملف الفاتورة فقط إذا كان موجوداً مسبقاً (للفواتير القديمة)
        $saleNumber = $sale['sale_number'] ?? $sale['id'] ?? '';
        if (!empty($saleNumber)) {
            // التحقق من وجود الملف فقط (بدون إنشاء جديد)
            $invoiceFilePath = getInvoiceFilePath($saleNumber);
            
            // إضافة مسار الملف إذا كان موجوداً (للفواتير القديمة فقط)
            if ($invoiceFilePath) {
                $sale['invoice_file_path'] = $invoiceFilePath;
            }
        }
        
        $filteredSales[] = $sale;
    }
    
    $sales = $filteredSales;
    
    // التأكد من أن الاستجابة تحتوي على array
    if (!is_array($sales)) {
        error_log("⚠️ تحذير: $sales ليس array، تحويله إلى array فارغ");
        $sales = [];
    }
    
    response(true, '', $sales);
}

// الحصول على التقييم التراكمي للعميل
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'rating') {
    checkAuth();
    
    $customerId = $_GET['customer_id'] ?? '';
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود تقييم يدوي - إذا كان موجوداً، نستخدمه مباشرة
    $manualRating = dbSelectOne(
        "SELECT rating 
         FROM customer_ratings 
         WHERE customer_id = ? AND rating_type = 'manual' 
         ORDER BY created_at DESC 
         LIMIT 1",
        [$customerId]
    );
    
    if ($manualRating && isset($manualRating['rating'])) {
        // استخدام التقييم اليدوي مباشرة
        $averageRating = round(floatval($manualRating['rating']), 2);
        
        // حساب عدد التقييمات الكلي للعرض فقط
        $totalRatingsResult = dbSelectOne(
            "SELECT COUNT(*) as total_ratings 
             FROM customer_ratings 
             WHERE customer_id = ?",
            [$customerId]
        );
        $totalRatings = $totalRatingsResult ? intval($totalRatingsResult['total_ratings'] ?? 0) : 1;
    } else {
        // إذا لم يكن هناك تقييم يدوي، نحسب المتوسط من تقييمات المعاملات فقط
        $ratingResult = dbSelectOne(
            "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
             FROM customer_ratings 
             WHERE customer_id = ? AND rating_type = 'transaction'",
            [$customerId]
        );
        
        $averageRating = $ratingResult ? floatval($ratingResult['average_rating'] ?? 0) : 0;
        $totalRatings = $ratingResult ? intval($ratingResult['total_ratings'] ?? 0) : 0;
    }
    
    response(true, '', [
        'average_rating' => round($averageRating, 2),
        'total_ratings' => $totalRatings
    ]);
}

// قراءة جميع العملاء
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    // Filter by customer type if provided
    $customerType = $_GET['type'] ?? null;
    
    // استخدام استعلام محسّن متوافق مع ONLY_FULL_GROUP_BY
    // تحديد الأعمدة صراحة بدلاً من c.* لتجنب مشاكل GROUP BY
    // التحقق من وجود عمود total_debt قبل إضافته للاستعلام
    $hasTotalDebtColumn = dbColumnExists('customers', 'total_debt');
    $totalDebtField = $hasTotalDebtColumn ? ', c.total_debt' : '';
    
    $query = "SELECT c.id, c.name, c.phone, c.address, c.customer_type, c.shop_name, c.notes, c.created_at, c.updated_at, c.created_by,
              c.branch_id, b.name as branch_name{$totalDebtField},
              COALESCE(AVG(cr.rating), 0) as average_rating,
              COUNT(cr.id) as total_ratings
              FROM customers c
              LEFT JOIN customer_ratings cr ON c.id = cr.customer_id
              LEFT JOIN branches b ON c.branch_id = b.id
              WHERE 1=1";
    $params = [];
    
    // فلترة حسب الفرع
    if ($userRole === 'admin') {
        // المالك: يمكنه فلترة حسب branch_id من query parameter
        $filterBranchId = $_GET['branch_id'] ?? null;
        if ($filterBranchId && $filterBranchId !== '') {
            $query .= " AND c.branch_id = ?";
            $params[] = $filterBranchId;
        }
        // إذا لم يتم تمرير branch_id، عرض جميع العملاء
    } else {
        // المستخدم العادي: فلترة تلقائية حسب فرعه
        if ($userBranchId) {
            $query .= " AND c.branch_id = ?";
            $params[] = $userBranchId;
        }
    }
    
    if ($customerType && in_array($customerType, ['retail', 'commercial'])) {
        $query .= " AND c.customer_type = ?";
        $params[] = $customerType;
    }
    
    // إضافة جميع الأعمدة في GROUP BY للتوافق مع ONLY_FULL_GROUP_BY
    $groupByFields = "c.id, c.name, c.phone, c.address, c.customer_type, c.shop_name, c.notes, c.branch_id, b.name, c.created_at, c.updated_at, c.created_by";
    if ($hasTotalDebtColumn) {
        $groupByFields .= ", c.total_debt";
    }
    $query .= " GROUP BY {$groupByFields} ORDER BY c.created_at DESC";
    
    $customers = dbSelect($query, $params);
    
    if ($customers === false) {
        $error = isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف';
        error_log("خطأ في جلب العملاء: $error");
        
        // محاولة إصلاح قاعدة البيانات تلقائياً
        if (handleDatabaseError($error, $query)) {
            // إعادة المحاولة بعد إصلاح قاعدة البيانات
            $customers = dbSelect($query, $params);
            if ($customers === false) {
                error_log("فشل إصلاح قاعدة البيانات أو إعادة المحاولة");
                response(false, 'خطأ في قراءة العملاء بعد محاولة الإصلاح', null, 500);
            }
        } else {
            response(false, 'خطأ في قراءة العملاء', null, 500);
        }
    }
    
    // التأكد من أن $customers هو array (قد يكون null أو false)
    if (!is_array($customers)) {
        error_log("تحذير: dbSelect لم يرجع array للعملاء، القيمة: " . var_export($customers, true));
        $customers = [];
    }
    
    // جلب جميع التقييمات اليدوية دفعة واحدة للأداء الأفضل
    $customerIds = array_column($customers, 'id');
    $manualRatingsMap = [];
    
    if (!empty($customerIds)) {
        // استخدام placeholders للاستعلام
        // جلب أحدث تقييم يدوي لكل عميل باستخدام subquery
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $manualRatings = dbSelect(
            "SELECT cr1.customer_id, cr1.rating 
             FROM customer_ratings cr1
             INNER JOIN (
                 SELECT customer_id, MAX(created_at) as max_created_at
                 FROM customer_ratings
                 WHERE customer_id IN ($placeholders) AND rating_type = 'manual'
                 GROUP BY customer_id
             ) cr2 ON cr1.customer_id = cr2.customer_id 
                   AND cr1.created_at = cr2.max_created_at 
                   AND cr1.rating_type = 'manual'",
            $customerIds
        );
        
        if ($manualRatings && is_array($manualRatings)) {
            // إنشاء خريطة customer_id => rating
            foreach ($manualRatings as $manualRating) {
                $customerId = $manualRating['customer_id'] ?? '';
                if ($customerId) {
                    $manualRatingsMap[$customerId] = floatval($manualRating['rating'] ?? 0);
                }
            }
        }
    }
    
    // جلب متوسطات تقييمات المعاملات دفعة واحدة للأداء الأفضل
    $transactionRatingsMap = [];
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $transactionRatings = dbSelect(
            "SELECT customer_id, AVG(rating) as average_rating 
             FROM customer_ratings 
             WHERE customer_id IN ($placeholders) AND rating_type = 'transaction'
             GROUP BY customer_id",
            $customerIds
        );
        
        if ($transactionRatings && is_array($transactionRatings)) {
            foreach ($transactionRatings as $transactionRating) {
                $customerId = $transactionRating['customer_id'] ?? '';
                if ($customerId) {
                    $transactionRatingsMap[$customerId] = floatval($transactionRating['average_rating'] ?? 0);
                }
            }
        }
    }
    
    // تحويل التقييمات إلى أرقام ومعالجة التقييمات اليدوية
    foreach ($customers as &$customer) {
        $customerId = $customer['id'] ?? '';
        
        // التحقق من وجود تقييم يدوي - إذا كان موجوداً، نستخدمه مباشرة
        if (isset($manualRatingsMap[$customerId])) {
            // استخدام التقييم اليدوي مباشرة
            $customer['average_rating'] = round($manualRatingsMap[$customerId], 2);
        } elseif (isset($transactionRatingsMap[$customerId])) {
            // إذا لم يكن هناك تقييم يدوي، نستخدم متوسط تقييمات المعاملات
            $customer['average_rating'] = round($transactionRatingsMap[$customerId], 2);
        } else {
            // إذا لم يكن هناك أي تقييمات، نستخدم القيمة الحالية (0 عادة)
            $customer['average_rating'] = round(floatval($customer['average_rating'] ?? 0), 2);
        }
        
        $customer['total_ratings'] = intval($customer['total_ratings'] ?? 0);
    }
    
    response(true, '', $customers);
}

// تحصيل دين من عميل تجاري
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'collect_debt') {
    checkAuth();
    
    $customerId = trim($data['customer_id'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $notes = trim($data['notes'] ?? '');
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    if ($amount <= 0) {
        response(false, 'المبلغ يجب أن يكون أكبر من الصفر', null, 400);
    }
    
    // التحقق من وجود العميل ونوعه
    $customer = dbSelectOne(
        "SELECT id, customer_type, total_debt, name, branch_id FROM customers WHERE id = ?",
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
    
    // الحصول على branch_id من العميل أو من المستخدم
    $branchId = $customer['branch_id'] ?? $session['branch_id'] ?? null;
    if (!$branchId) {
        // محاولة الحصول على branch_id من آخر عملية بيع للعميل
        $lastSale = dbSelectOne(
            "SELECT s.created_by, u.branch_id FROM sales s 
             LEFT JOIN users u ON s.created_by = u.id 
             WHERE s.customer_id = ? 
             ORDER BY s.created_at DESC LIMIT 1",
            [$customerId]
        );
        if ($lastSale && $lastSale['branch_id']) {
            $branchId = $lastSale['branch_id'];
        }
    }
    
    if (!$branchId) {
        response(false, 'لم يتم العثور على فرع العميل', null, 400);
    }
    
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
        if (dbTableExists('treasury_transactions')) {
            // التحقق من وجود 'debt_collection' في enum
            $conn = getDBConnection();
            if ($conn) {
                try {
                    // محاولة إضافة 'debt_collection' إلى enum إذا لم يكن موجوداً
                    $conn->query("ALTER TABLE treasury_transactions MODIFY transaction_type enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection') NOT NULL");
                } catch (Exception $e) {
                    // تجاهل الخطأ إذا كان العمود موجوداً بالفعل
                }
            }
            
            $collectionId = generateId();
            $customerName = $customer['name'] ?? 'عميل غير معروف';
            $transactionDescription = "تحصيل دين من {$customerName}";
            if (!empty($notes)) {
                $transactionDescription .= " - {$notes}";
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
        }
        
        dbCommit();
        
        // جلب بيانات العميل المحدثة
        $updatedCustomer = dbSelectOne("SELECT * FROM customers WHERE id = ?", [$customerId]);
        
        response(true, "تم تحصيل {$amount} ج.م بنجاح. الدين المتبقي: {$newDebt} ج.م", $updatedCustomer);
        
    } catch (Exception $e) {
        dbRollback();
        response(false, 'خطأ في تحصيل الدين: ' . $e->getMessage(), null, 500);
    }
}

// حفظ تقييم للعميل - يجب أن يأتي قبل شرط إضافة العميل الجديد
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'rating') {
    checkAuth();
    
    // إذا لم يتم تمرير البيانات بشكل صحيح، محاولة قراءتها
    if (!isset($data['customer_id']) && !isset($data['rating'])) {
        $data = getRequestData();
    }
    
    $customerId = trim($data['customer_id'] ?? '');
    $saleId = trim($data['sale_id'] ?? '');
    $rating = intval($data['rating'] ?? 0);
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    if ($rating < 1 || $rating > 5) {
        response(false, 'التقييم يجب أن يكون بين 1 و 5', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // التحقق من وجود الفاتورة إذا تم إرسال sale_id
    if (!empty($saleId)) {
        $sale = dbSelectOne("SELECT id FROM sales WHERE id = ?", [$saleId]);
        if (!$sale) {
            response(false, 'الفاتورة غير موجودة', null, 404);
        }
    }
    
    $session = checkAuth();
    $ratingId = generateId();
    
    $result = dbExecute(
        "INSERT INTO customer_ratings (id, customer_id, sale_id, rating, rating_type, created_at, created_by) 
         VALUES (?, ?, ?, ?, 'transaction', NOW(), ?)",
        [$ratingId, $customerId, $saleId ?: null, $rating, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في حفظ التقييم', null, 500);
    }
    
    // حساب التقييم التراكمي الجديد
    $ratingResult = dbSelectOne(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
         FROM customer_ratings 
         WHERE customer_id = ?",
        [$customerId]
    );
    
    $averageRating = $ratingResult ? round(floatval($ratingResult['average_rating'] ?? 0), 2) : 0;
    
    response(true, 'تم حفظ التقييم بنجاح', [
        'rating_id' => $ratingId,
        'average_rating' => $averageRating
    ]);
}

// إضافة عميل جديد
if ($method === 'POST') {
    checkAuth();
    if (!isset($data['name'])) {
        $data = getRequestData();
    }
    
    // التحقق من action - إذا كان collect_debt أو rating، تم معالجته أعلاه
    if (isset($data['action'])) {
        if ($data['action'] === 'collect_debt') {
            // تم معالجته أعلاه
            return;
        }
        if ($data['action'] === 'rating') {
            // تم معالجته أعلاه
            return;
        }
    }
    
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $address = trim($data['address'] ?? '');
    $customerType = trim($data['customer_type'] ?? 'retail');
    $shopName = trim($data['shop_name'] ?? '');
    
    // Validate customer type
    if (!in_array($customerType, ['retail', 'commercial'])) {
        $customerType = 'retail';
    }
    
    // Shop name is required for commercial customers
    if ($customerType === 'commercial' && empty($shopName)) {
        response(false, 'اسم المحل مطلوب للعملاء التجاريين', null, 400);
    }
    
    if (empty($name) || empty($phone)) {
        response(false, 'الاسم ورقم الهاتف مطلوبان', null, 400);
    }
    
    // التحقق من عدم تكرار رقم الهاتف
    $existingCustomer = dbSelectOne("SELECT id, name FROM customers WHERE phone = ?", [$phone]);
    if ($existingCustomer) {
        response(false, 'رقم الهاتف مستخدم بالفعل لعميل آخر: ' . $existingCustomer['name'], null, 400);
    }
    
    $session = checkAuth();
    $userBranchId = $session['branch_id'] ?? null;
    $userRole = $session['role'];
    
    // تحديد branch_id للعميل الجديد
    $customerBranchId = null;
    
    if ($userRole === 'admin') {
        // المالك: استخدام branch_id من البيانات أو الفرع الأول
        $customerBranchId = $data['branch_id'] ?? null;
        if (empty($customerBranchId)) {
            // إذا لم يتم تمرير branch_id، استخدام الفرع الأول
            $customerBranchId = getFirstBranchId();
        }
    } else {
        // المستخدم العادي: استخدام فرعه
        if (!$userBranchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 400);
        }
        $customerBranchId = $userBranchId;
    }
    
    // التأكد من وجود branch_id
    if (empty($customerBranchId)) {
        response(false, 'لا يمكن تحديد الفرع للعميل', null, 400);
    }
    
    $customerId = generateCustomerId();
    
    $result = dbExecute(
        "INSERT INTO customers (id, branch_id, name, phone, address, customer_type, shop_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [$customerId, $customerBranchId, $name, $phone, $address, $customerType, $shopName ?: null, $session['user_id']]
    );
    
    if ($result === false) {
        response(false, 'خطأ في إضافة العميل', null, 500);
    }
    
    $newCustomer = dbSelectOne("SELECT * FROM customers WHERE id = ?", [$customerId]);
    
    response(true, 'تم إضافة العميل بنجاح', $newCustomer);
}

// تعديل عميل
if ($method === 'PUT' && !(isset($data['action']) && $data['action'] === 'update_rating')) {
    checkAuth();
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$id]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    if (isset($data['name'])) {
        $updateFields[] = "name = ?";
        $updateParams[] = trim($data['name']);
    }
    
    if (isset($data['phone'])) {
        $newPhone = trim($data['phone']);
        // التحقق من عدم تكرار رقم الهاتف (عدا العميل الحالي)
        $existingCustomer = dbSelectOne("SELECT id, name FROM customers WHERE phone = ? AND id != ?", [$newPhone, $id]);
        if ($existingCustomer) {
            response(false, 'رقم الهاتف مستخدم بالفعل لعميل آخر: ' . $existingCustomer['name'], null, 400);
        }
        $updateFields[] = "phone = ?";
        $updateParams[] = $newPhone;
    }
    
    if (isset($data['address'])) {
        $updateFields[] = "address = ?";
        $updateParams[] = trim($data['address']);
    }
    
    if (isset($data['customer_type'])) {
        $customerType = trim($data['customer_type']);
        if (in_array($customerType, ['retail', 'commercial'])) {
            $updateFields[] = "customer_type = ?";
            $updateParams[] = $customerType;
        }
    }
    
    if (isset($data['shop_name'])) {
        $updateFields[] = "shop_name = ?";
        $updateParams[] = trim($data['shop_name']) ?: null;
    }
    
    if (isset($data['notes'])) {
        $updateFields[] = "notes = ?";
        $updateParams[] = trim($data['notes']);
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE customers SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'خطأ في تعديل العميل', null, 500);
    }
    
    response(true, 'تم تعديل العميل بنجاح');
}

// تعديل التقييم التراكمي (للمالك فقط)
// التحقق من PUT method (مباشرة أو عبر _method)
$isPutMethod = ($method === 'PUT' || ($method === 'POST' && isset($data['_method']) && $data['_method'] === 'PUT'));
if ($isPutMethod && isset($data['action']) && $data['action'] === 'update_rating') {
    try {
        error_log('🔍 update_rating: Starting - Method: ' . $method);
        error_log('🔍 update_rating: Initial data: ' . json_encode($data, JSON_UNESCAPED_UNICODE));
        
        // التحقق من الصلاحيات أولاً
        error_log('🔍 update_rating: Before checkPermission');
        checkPermission('admin'); // المالك فقط
        error_log('🔍 update_rating: After checkPermission - continuing...');
        
        // قراءة customer_id و rating مباشرة من $data
        $customerId = isset($data['customer_id']) ? trim($data['customer_id']) : (isset($data['id']) ? trim($data['id']) : null);
        $rating = isset($data['rating']) ? intval($data['rating']) : 0;
        
        error_log('🔍 update_rating: Extracted - customerId: "' . ($customerId ?? 'NULL') . '", rating: ' . $rating);
        
        if (empty($customerId)) {
            error_log('❌ update_rating: customer_id is missing or empty');
            error_log('❌ update_rating: Full $data = ' . json_encode($data, JSON_UNESCAPED_UNICODE));
            response(false, 'معرف العميل مطلوب', null, 400);
        }
        
        // التحقق من صحة التقييم
        if ($rating < 1 || $rating > 5) {
            error_log('❌ update_rating: Invalid rating value: ' . $rating);
            response(false, 'التقييم يجب أن يكون بين 1 و 5', null, 400);
        }
        
        // التحقق من وجود العميل
        error_log('🔍 update_rating: Checking if customer exists: ' . $customerId);
        $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$customerId]);
        if (!$customer || empty($customer['id'])) {
            error_log('❌ update_rating: Customer not found with id: ' . $customerId);
            response(false, 'العميل غير موجود', null, 404);
        }
        
        // استخدام id من قاعدة البيانات لضمان الصحة
        $customerId = $customer['id'];
        error_log('🔍 update_rating: Customer found, proceeding with update');
        
        // الحصول على معلومات الجلسة
        $session = checkAuth();
        $ratingId = generateId();
        
        // حذف التقييمات اليدوية السابقة للعميل
        error_log('🔍 update_rating: Deleting previous manual ratings');
        $deleteResult = dbExecute(
            "DELETE FROM customer_ratings WHERE customer_id = ? AND rating_type = 'manual'",
            [$customerId]
        );
        
        if ($deleteResult === false) {
            error_log('⚠️ update_rating: Warning - Failed to delete previous ratings, continuing anyway');
        }
        
        // إضافة التقييم اليدوي الجديد
        error_log('🔍 update_rating: Inserting new rating: ' . $rating);
        $result = dbExecute(
            "INSERT INTO customer_ratings (id, customer_id, sale_id, rating, rating_type, created_at, created_by) 
             VALUES (?, ?, NULL, ?, 'manual', NOW(), ?)",
            [$ratingId, $customerId, $rating, $session['user_id']]
        );
        
        if ($result === false) {
            error_log('❌ update_rating: Failed to insert rating into database');
            response(false, 'خطأ في تعديل التقييم', null, 500);
        }
        
        error_log('✅ update_rating: Rating inserted successfully');
        
        // عند وجود تقييم يدوي، نستخدمه مباشرة كالتقييم التراكمي
        // بدلاً من حساب المتوسط مع تقييمات المعاملات
        $averageRating = round(floatval($rating), 2);
        
        // حساب عدد التقييمات الكلي (transaction + manual) للعرض فقط
        $totalRatingsResult = dbSelectOne(
            "SELECT COUNT(*) as total_ratings 
             FROM customer_ratings 
             WHERE customer_id = ?",
            [$customerId]
        );
        $totalRatings = $totalRatingsResult ? intval($totalRatingsResult['total_ratings'] ?? 0) : 1;
        
        error_log('✅ update_rating: Success - average_rating: ' . $averageRating . ' (manual rating used directly)');
        
        response(true, 'تم تحديث التقييم بنجاح', [
            'rating_id' => $ratingId,
            'average_rating' => $averageRating,
            'total_ratings' => $totalRatings
        ]);
        
    } catch (Exception $e) {
        error_log('❌ update_rating: Exception caught - ' . $e->getMessage());
        error_log('❌ update_rating: Stack trace - ' . $e->getTraceAsString());
        response(false, 'حدث خطأ أثناء تحديث التقييم: ' . $e->getMessage(), null, 500);
    }
}

// حذف عميل
if ($method === 'DELETE') {
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل
    $customer = dbSelectOne("SELECT id FROM customers WHERE id = ?", [$id]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    $result = dbExecute("DELETE FROM customers WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف العميل', null, 500);
    }
    
    response(true, 'تم حذف العميل بنجاح');
}


response(false, 'طريقة غير مدعومة', null, 405);
?>

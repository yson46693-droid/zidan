<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

/**
 * جلب الفرع الأول حسب تاريخ الإنشاء
 */
function getFirstBranchId() {
    $firstBranch = dbSelectOne(
        "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1"
    );
    return $firstBranch ? $firstBranch['id'] : null;
}

// جلب الماركات من قاعدة البيانات
if ($method === 'GET' && isset($_GET['action']) && cleanInput($_GET['action']) === 'brands') {
    checkAuth();
    // ✅ الطلبات GET لا تحتاج إلى checkAPISecurity() (لا تحتاج إلى API Token)
    
    try {
        $allBrands = [];
        
        // 1. جلب الماركات من جدول phones
        $phonesBrands = dbSelect("SELECT DISTINCT brand FROM phones WHERE brand IS NOT NULL AND brand != '' AND TRIM(brand) != ''", []);
        if (is_array($phonesBrands)) {
            foreach ($phonesBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 2. جلب الماركات من جدول spare_parts
        $sparePartsBrands = dbSelect("SELECT DISTINCT brand FROM spare_parts WHERE brand IS NOT NULL AND brand != '' AND TRIM(brand) != ''", []);
        if (is_array($sparePartsBrands)) {
            foreach ($sparePartsBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 3. جلب الماركات من جدول repairs (device_type) - قد تحتوي على ماركات غير موجودة في الجداول الأخرى
        $repairsBrands = dbSelect("SELECT DISTINCT device_type as brand FROM repairs WHERE device_type IS NOT NULL AND device_type != '' AND TRIM(device_type) != ''", []);
        if (is_array($repairsBrands)) {
            foreach ($repairsBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
        }
        
        // 4. جلب الماركات من جدول brsql (الجدول الرئيسي للماركات)
        $brsqlBrands = dbSelect("SELECT DISTINCT name as brand FROM brsql WHERE name IS NOT NULL AND name != '' AND TRIM(name) != '' ORDER BY name ASC", []);
        if (is_array($brsqlBrands)) {
            foreach ($brsqlBrands as $row) {
                if (isset($row['brand']) && !empty(trim($row['brand']))) {
                    $allBrands[] = trim($row['brand']);
                }
            }
            error_log('تم جلب الماركات من جدول brsql: ' . count($brsqlBrands));
        }
        
        // إزالة التكرارات وترتيب الماركات
        $uniqueBrands = array_values(array_unique($allBrands));
        sort($uniqueBrands);
        
        // تسجيل عدد الماركات للتحقق
        error_log('عدد الماركات المجلوبة من phones: ' . (is_array($phonesBrands) ? count($phonesBrands) : 0));
        error_log('عدد الماركات المجلوبة من spare_parts: ' . (is_array($sparePartsBrands) ? count($sparePartsBrands) : 0));
        error_log('عدد الماركات المجلوبة من repairs: ' . (is_array($repairsBrands) ? count($repairsBrands) : 0));
        error_log('إجمالي الماركات الفريدة: ' . count($uniqueBrands));
        
        response(true, '', $uniqueBrands);
    } catch (Exception $e) {
        error_log('خطأ في جلب الماركات: ' . $e->getMessage());
        response(false, 'خطأ في جلب الماركات: ' . $e->getMessage(), null, 500);
    }
}

// الحصول على صيانات العميل - يجب أن يكون قبل الشرط العام GET
if ($method === 'GET' && isset($_GET['action']) && cleanInput($_GET['action']) === 'customer') {
    checkAuth();
    
    // ✅ تنظيف معرف العميل
    $customerId = cleanId($_GET['customer_id'] ?? '');
    
    if (empty($customerId)) {
        response(false, 'معرف العميل مطلوب', null, 400);
    }
    
    // التحقق من وجود العميل أولاً
    $customer = dbSelectOne("SELECT id, phone FROM customers WHERE id = ?", [$customerId]);
    if (!$customer) {
        response(false, 'العميل غير موجود', null, 404);
    }
    
    // جلب صيانات العميل - البحث باستخدام customer_id فقط
    // ✅ إصلاح: جلب رقم الهاتف من جدول customers
    $repairs = dbSelect(
        "SELECT r.*, b.name as branch_name, u.name as created_by_name,
         COALESCE(c.phone, r.customer_phone) as customer_phone
         FROM repairs r 
         LEFT JOIN branches b ON r.branch_id = b.id 
         LEFT JOIN users u ON r.created_by = u.id 
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.customer_id = ?
         ORDER BY r.created_at DESC",
        [$customerId]
    );
    
    if ($repairs === false) {
        error_log("خطأ في جلب صيانات العميل $customerId: " . (isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف'));
        response(false, 'خطأ في قراءة الصيانات', null, 500);
    }
    
    // التأكد من أن $repairs هو array
    if (!is_array($repairs)) {
        $repairs = [];
    }
    
    // إضافة cost للتوافق مع الكود القديم ومعالجة أرقام الفواتير
    foreach ($repairs as &$repair) {
        $repair['cost'] = $repair['customer_price'];
        
        // إضافة repair_type افتراضي إذا لم يكن موجوداً
        if (!isset($repair['repair_type']) || empty($repair['repair_type'])) {
            $repair['repair_type'] = 'soft';
        }
        
        // معالجة أرقام فواتير قطع الغيار
        if (isset($repair['spare_parts_invoices']) && !empty($repair['spare_parts_invoices'])) {
            try {
                $invoices = json_decode($repair['spare_parts_invoices'], true);
                if (is_array($invoices)) {
                    $repair['spare_parts_invoices'] = $invoices;
                } else {
                    $repair['spare_parts_invoices'] = [];
                }
            } catch (Exception $e) {
                $repair['spare_parts_invoices'] = [];
            }
        } else {
            $repair['spare_parts_invoices'] = [];
        }
    }
    
    response(true, '', $repairs);
}

// قراءة جميع عمليات الصيانة
if ($method === 'GET') {
    // ✅ تنظيف رقم الصيانة
    $repairNumber = cleanText($_GET['repair_number'] ?? '');
    $repairNumber = !empty($repairNumber) ? $repairNumber : null;
    
    // ✅ التحقق من وجود session قبل استدعاء checkAuth
    $session = null;
    $userRole = null;
    $userBranchId = null;
    $isPublicTracking = false;
    
    // ✅ التحقق من وجود session (بدون استدعاء checkAuth الذي يقوم بـ exit)
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    // ✅ إذا كان هناك repair_number ولم يكن هناك session، نعتبره public tracking
    if ($repairNumber && $repairNumber !== '' && !isset($_SESSION['user_id'])) {
        $isPublicTracking = true;
    } else if (isset($_SESSION['user_id'])) {
        // ✅ المستخدم مسجل دخول
        $session = $_SESSION;
        $userRole = $session['role'] ?? null;
        $userBranchId = $session['branch_id'] ?? null;
        $isPublicTracking = false;
    } else {
        // ✅ لا يوجد session ولا repair_number - يتطلب auth
        checkAuth(); // هذا سيستدعي response() و exit إذا فشل
        // ✅ لن نصل هنا إذا فشل checkAuth
        $session = $_SESSION;
        $userRole = $session['role'] ?? null;
        $userBranchId = $session['branch_id'] ?? null;
    }
    
    // Migration: تحديث عمود status ليشمل جميع القيم المستخدمة
    try {
        $conn = getDBConnection();
        if ($conn) {
            // التحقق من القيم الحالية في ENUM
            $result = $conn->query("SHOW COLUMNS FROM repairs WHERE Field = 'status'");
            if ($result && $result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $type = $row['Type'];
                
                // التحقق من وجود جميع القيم المطلوبة
                $requiredValues = ['received', 'under_inspection', 'awaiting_customer_approval', 'customer_approved', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled', 'lost'];
                $hasAllValues = true;
                
                foreach ($requiredValues as $value) {
                    if (strpos($type, "'$value'") === false) {
                        $hasAllValues = false;
                        break;
                    }
                }
                
                // إذا لم تكن جميع القيم موجودة، تحديث ENUM
                if (!$hasAllValues) {
                    $enumValues = implode(',', array_map(function($v) { return "'$v'"; }, $requiredValues));
                    $conn->query("ALTER TABLE `repairs` MODIFY COLUMN `status` ENUM($enumValues) NOT NULL DEFAULT 'received'");
                    error_log('✅ تم تحديث عمود status في جدول repairs ليشمل جميع القيم المطلوبة');
                    
                    // ✅ تحديث السجلات الموجودة التي تستخدم القيم القديمة
                    // pending -> received
                    $conn->query("UPDATE `repairs` SET `status` = 'received' WHERE `status` = 'pending'");
                    // ready -> ready_for_delivery
                    $conn->query("UPDATE `repairs` SET `status` = 'ready_for_delivery' WHERE `status` = 'ready'");
                    error_log('✅ تم تحديث السجلات الموجودة لاستخدام القيم الجديدة');
                }
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate') === false && strpos($e->getMessage(), 'already exists') === false) {
            error_log('⚠️ خطأ في تحديث عمود status: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة repair_type إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'repair_type')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود repair_type بعد problem
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `repair_type` ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`");
                // تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
                $conn->query("UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL");
                error_log('تم إضافة عمود repair_type إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود repair_type: ' . $e->getMessage());
        }
    }
    
    // بناء الاستعلام مع فلترة حسب الفرع
    // ✅ إصلاح: جلب رقم الهاتف من جدول customers إذا كان customer_id موجوداً
    $query = "SELECT r.*, 
              b.name as branch_name, 
              b.id as branch_id,
              u.name as technician_name,
              u.username as technician_username,
              u.role as technician_role,
              COALESCE(c.phone, r.customer_phone) as customer_phone
              FROM repairs r 
              LEFT JOIN branches b ON r.branch_id = b.id 
              LEFT JOIN users u ON r.created_by = u.id 
              LEFT JOIN customers c ON r.customer_id = c.id
              WHERE 1=1";
    $params = [];
    
    // ✅ التحقق من وجود id أو repair_number للوصول إلى عملية معينة
    // ✅ استخدام cleanBranchId() لأن repair_id قد يحتوي على نقطة (مثل: 695fd7ce455de3.90007175)
    $repairId = cleanBranchId($_GET['id'] ?? '');
    $repairId = !empty($repairId) ? $repairId : null;
    $isSingleRepairRequest = ($repairId && $repairId !== '') || ($repairNumber && $repairNumber !== '');
    
    // ✅ فلترة حسب repair_number إذا كان موجوداً (لصفحة تتبع الصيانة - بدون auth)
    if ($isPublicTracking) {
        // استخدام BINARY للحساسية لحالة الأحرف أو UPPER/LOWER للمقارنة
        $query .= " AND UPPER(TRIM(r.repair_number)) = UPPER(TRIM(?))";
        $params[] = trim($repairNumber);
    } elseif ($repairNumber && $repairNumber !== '' && !$isPublicTracking) {
        // ✅ للمستخدمين المسجلين (بما في ذلك المالك): فلترة حسب repair_number
        $query .= " AND UPPER(TRIM(r.repair_number)) = UPPER(TRIM(?))";
        $params[] = trim($repairNumber);
    }
    
    // ✅ فلترة حسب id إذا كان موجوداً (لطباعة الإيصال، الباركود، إلخ)
    if ($repairId && $repairId !== '' && !$isPublicTracking) {
        $query .= " AND r.id = ?";
        $params[] = $repairId;
    }
    
    // ✅ التحقق من أن المستخدم مالك (admin أو owner)
    $isOwner = ($userRole === 'admin' || $userRole === 'owner');
    
    // فلترة حسب الفرع (فقط إذا لم يكن هناك repair_number أو id - للداشبورد)
    if (!$isPublicTracking && !$isSingleRepairRequest) {
        if ($isOwner) {
            // ✅ المالك: يجب تمرير branch_id دائماً - منع عرض عمليات من فروع أخرى
            // ✅ تنظيف branch_id (يسمح بالنقطة لأن generateId() يولد IDs مع نقطة)
            $filterBranchId = cleanBranchId($_GET['branch_id'] ?? '');
            $filterBranchId = !empty($filterBranchId) ? $filterBranchId : null;
            if ($filterBranchId && $filterBranchId !== '') {
                $query .= " AND r.branch_id = ?";
                $params[] = $filterBranchId;
            } else {
                // ✅ إذا لم يتم تمرير branch_id للمالك، نرفض الطلب لمنع عرض جميع العمليات
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'يجب تحديد branch_id لعرض عمليات الصيانة'
                ]);
                exit;
            }
        } else {
            // المستخدم العادي: فلترة تلقائية حسب فرعه
            if ($userBranchId) {
                $query .= " AND r.branch_id = ?";
                $params[] = $userBranchId;
            } else {
                // ✅ إذا لم يكن للمستخدم فرع، لا نعرض أي عمليات
                $query .= " AND 1=0"; // شرط مستحيل - لا يعرض أي عمليات
            }
        }
    } elseif (!$isPublicTracking && $isSingleRepairRequest && $isOwner) {
        // ✅ للمالك: السماح بالوصول إلى عملية معينة (id أو repair_number) حتى بدون branch_id
        // لا حاجة لإضافة فلترة branch_id هنا - المالك يمكنه الوصول إلى أي عملية
    } elseif (!$isPublicTracking && $isSingleRepairRequest && !$isOwner) {
        // ✅ للمستخدمين العاديين: التحقق من أن العملية تنتمي لفرعهم
        if ($userBranchId) {
            $query .= " AND r.branch_id = ?";
            $params[] = $userBranchId;
        } else {
            // ✅ إذا لم يكن للمستخدم فرع، لا نعرض أي عمليات
            $query .= " AND 1=0"; // شرط مستحيل - لا يعرض أي عمليات
        }
    }
    
    $query .= " ORDER BY r.created_at DESC";
    
    // ✅ إذا كان البحث بـ repair_number، استخدم dbSelectOne لإرجاع object واحد
    if ($isPublicTracking) {
        // ✅ البحث المباشر عن repair_number بدون تعقيدات
        $searchNumber = trim($repairNumber);
        
        // ✅ محاولة 1: البحث المباشر بدون JOIN أولاً (الأسرع)
        $directQuery = "SELECT * FROM repairs WHERE repair_number = ? LIMIT 1";
        $repair = dbSelectOne($directQuery, [$searchNumber]);
        
        // ✅ إذا لم يتم العثور عليه، محاولة البحث بدون TRIM
        if (!$repair || $repair === false) {
            $repair = dbSelectOne($directQuery, [$repairNumber]);
        }
        
        // ✅ إذا تم العثور عليه، جلب البيانات الإضافية من JOIN
        if ($repair && $repair !== false) {
            // ✅ التحقق من وجود عمود avatar
            $hasAvatar = dbColumnExists('users', 'avatar');
            $avatarField = $hasAvatar ? ', u.avatar as technician_avatar' : '';
            
            $fullQuery = "SELECT r.*, 
                         b.name as branch_name, 
                         b.id as branch_id,
                         u.name as technician_name,
                         u.username as technician_username,
                         u.role as technician_role{$avatarField},
                         COALESCE(c.phone, r.customer_phone) as customer_phone
                         FROM repairs r 
                         LEFT JOIN branches b ON r.branch_id = b.id 
                         LEFT JOIN users u ON r.created_by = u.id 
                         LEFT JOIN customers c ON r.customer_id = c.id
                         WHERE r.repair_number = ?
                         LIMIT 1";
            
            $fullResult = dbSelectOne($fullQuery, [$searchNumber]);
            if ($fullResult && $fullResult !== false) {
                $repair = $fullResult;
            }
        }
        
        // ✅ التحقق من النتيجة النهائية
        if ($repair === false) {
            $error = isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف';
            error_log("❌ خطأ في البحث عن الصيانة برقم: $searchNumber - الخطأ: $error");
            response(false, 'حدث خطأ في البحث عن عملية الصيانة', null, 500);
        }
        
        if (!$repair || empty($repair)) {
            error_log("❌ لم يتم العثور على الصيانة برقم: '$searchNumber'");
            response(false, 'لم يتم العثور على عملية الصيانة برقم: ' . $searchNumber, null, 404);
        }
        
        // إضافة cost للتوافق مع الكود القديم ومعالجة أرقام الفواتير
        $repair['cost'] = $repair['customer_price'] ?? 0;
        
        // إضافة repair_type افتراضي إذا لم يكن موجوداً
        if (!isset($repair['repair_type']) || empty($repair['repair_type'])) {
            $repair['repair_type'] = 'soft';
        }
        
        // معالجة أرقام فواتير قطع الغيار
        if (isset($repair['spare_parts_invoices']) && !empty($repair['spare_parts_invoices'])) {
            try {
                $invoices = json_decode($repair['spare_parts_invoices'], true);
                if (is_array($invoices)) {
                    $repair['spare_parts_invoices'] = $invoices;
                } else {
                    $repair['spare_parts_invoices'] = [];
                }
            } catch (Exception $e) {
                $repair['spare_parts_invoices'] = [];
            }
        } else {
            $repair['spare_parts_invoices'] = [];
        }
        
        // ✅ التأكد من أن repair_number موجود في النتيجة
        if (!isset($repair['repair_number'])) {
            error_log("❌ خطأ: repair_number غير موجود في النتيجة");
            response(false, 'خطأ في بيانات الصيانة', null, 500);
        }
        
        error_log("✅ إرجاع بيانات الصيانة: " . $repair['repair_number']);
        response(true, '', $repair);
    } elseif ($isSingleRepairRequest && !$isPublicTracking) {
        // ✅ للوصول إلى عملية معينة باستخدام id (لطباعة الإيصال، الباركود، إلخ)
        error_log("🔍 [Repairs] البحث عن عملية صيانة - ID: " . ($repairId ?? 'null') . ", repair_number: " . ($repairNumber ?? 'null'));
        error_log("🔍 [Repairs] Query: " . $query);
        error_log("🔍 [Repairs] Params: " . json_encode($params));
        
        $repair = dbSelectOne($query, $params);
        
        if ($repair === false) {
            $error = isset($GLOBALS['lastDbError']) ? $GLOBALS['lastDbError'] : 'خطأ غير معروف';
            error_log("❌ خطأ في البحث عن الصيانة: $error");
            error_log("❌ Query: " . $query);
            error_log("❌ Params: " . json_encode($params));
            response(false, 'حدث خطأ في البحث عن عملية الصيانة', null, 500);
        }
        
        if (!$repair || empty($repair)) {
            error_log("❌ لم يتم العثور على الصيانة - ID: " . ($repairId ?? 'null') . ", repair_number: " . ($repairNumber ?? 'null'));
            error_log("❌ Query: " . $query);
            error_log("❌ Params: " . json_encode($params));
            response(false, 'لم يتم العثور على عملية الصيانة', null, 404);
        }
        
        // إضافة cost للتوافق مع الكود القديم ومعالجة أرقام الفواتير
        $repair['cost'] = $repair['customer_price'] ?? 0;
        
        // إضافة repair_type افتراضي إذا لم يكن موجوداً
        if (!isset($repair['repair_type']) || empty($repair['repair_type'])) {
            $repair['repair_type'] = 'soft';
        }
        
        // معالجة أرقام فواتير قطع الغيار
        if (isset($repair['spare_parts_invoices']) && !empty($repair['spare_parts_invoices'])) {
            try {
                $invoices = json_decode($repair['spare_parts_invoices'], true);
                if (is_array($invoices)) {
                    $repair['spare_parts_invoices'] = $invoices;
                } else {
                    $repair['spare_parts_invoices'] = [];
                }
            } catch (Exception $e) {
                $repair['spare_parts_invoices'] = [];
            }
        } else {
            $repair['spare_parts_invoices'] = [];
        }
        
        error_log("✅ إرجاع بيانات الصيانة (id): " . ($repair['id'] ?? 'unknown'));
        response(true, '', $repair);
    } else {
        // للداشبورد: إرجاع array
        $repairs = dbSelect($query, $params);
        
        if ($repairs === false) {
            response(false, 'خطأ في قراءة عمليات الصيانة', null, 500);
        }
        
        // إضافة cost للتوافق مع الكود القديم ومعالجة أرقام الفواتير
        foreach ($repairs as &$repair) {
            $repair['cost'] = $repair['customer_price'];
            
            // إضافة repair_type افتراضي إذا لم يكن موجوداً
            if (!isset($repair['repair_type']) || empty($repair['repair_type'])) {
                $repair['repair_type'] = 'soft';
            }
            
            // معالجة أرقام فواتير قطع الغيار
            if (isset($repair['spare_parts_invoices']) && !empty($repair['spare_parts_invoices'])) {
                try {
                    $invoices = json_decode($repair['spare_parts_invoices'], true);
                    if (is_array($invoices)) {
                        $repair['spare_parts_invoices'] = $invoices;
                    } else {
                        $repair['spare_parts_invoices'] = [];
                    }
                } catch (Exception $e) {
                    $repair['spare_parts_invoices'] = [];
                }
            } else {
                $repair['spare_parts_invoices'] = [];
            }
        }
        
        response(true, '', $repairs);
    }
}

// إضافة عملية صيانة جديدة
if ($method === 'POST') {
    if (!isset($data['_method'])) {
        $data = getRequestData();
    }
    
    // ✅ موافقة/رفض العميل على عملية الصيانة (يجب أن يكون قبل checkAuth وباقي الكود)
    if (isset($data['action']) && ($data['action'] === 'approve' || $data['action'] === 'reject')) {
        // لا يتطلب auth لأن العميل يصل من رابط عام
        $repairNumber = $data['repair_number'] ?? '';
        
        if (empty($repairNumber)) {
            response(false, 'رقم عملية الصيانة مطلوب', null, 400);
        }
        
        // التحقق من وجود العملية وحالتها
        $repair = dbSelectOne("SELECT id, status, notes FROM repairs WHERE repair_number = ?", [$repairNumber]);
        if (!$repair) {
            response(false, 'عملية الصيانة غير موجودة', null, 404);
        }
        
        // التحقق من أن الحالة هي "بانتظار موافقة العميل"
        if ($repair['status'] !== 'awaiting_customer_approval') {
            response(false, 'لا يمكن الموافقة/الرفض على هذه العملية. يجب أن تكون في حالة "بانتظار موافقة العميل"', null, 400);
        }
        
        try {
            if ($data['action'] === 'approve') {
                // الموافقة: تغيير الحالة إلى "تم الحصول علي الموافقه"
                $result = dbExecute(
                    "UPDATE repairs SET status = 'customer_approved', updated_at = NOW() WHERE id = ?",
                    [$repair['id']]
                );
                
                if ($result === false) {
                    response(false, 'حدث خطأ أثناء تحديث حالة العملية', null, 500);
                }
                
                response(true, 'تم الحصول على موافقتك بنجاح. سيتم البدء في إصلاح الجهاز قريباً.');
            } else {
                // الرفض: تغيير الحالة إلى "ملغي" وإضافة ملاحظة محمية
                $protectedNote = "ملغي نتيجة طلب العميل";
                
                // إضافة الملاحظة المحمية في نهاية الملاحظات الموجودة (إذا كانت موجودة)
                $existingNotes = trim($repair['notes'] ?? '');
                $newNotes = $existingNotes ? $existingNotes . "\n\n" . $protectedNote : $protectedNote;
                
                $result = dbExecute(
                    "UPDATE repairs SET status = 'cancelled', notes = ?, updated_at = NOW() WHERE id = ?",
                    [$newNotes, $repair['id']]
                );
                
                if ($result === false) {
                    response(false, 'حدث خطأ أثناء تحديث حالة العملية', null, 500);
                }
                
                response(true, 'تم إلغاء العملية بناءً على طلبك');
            }
        } catch (Exception $e) {
            error_log('❌ خطأ في موافقة/رفض العميل: ' . $e->getMessage());
            response(false, 'حدث خطأ أثناء معالجة طلبك: ' . $e->getMessage(), null, 500);
        }
    }
    
    // إضافة عملية صيانة جديدة (يتطلب auth)
    checkAuth();
    checkAPISecurity(); // ✅ حماية API متعددة الطبقات
    
    // Migration: إضافة spare_parts_invoices لحفظ أرقام فواتير قطع الغيار
    try {
        if (!dbColumnExists('repairs', 'spare_parts_invoices')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود spare_parts_invoices بعد parts_store
                $afterCol = dbColumnExists('repairs', 'parts_store') ? 'parts_store' : 'repair_cost';
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `spare_parts_invoices` text DEFAULT NULL AFTER `{$afterCol}`");
                error_log('تم إضافة عمود spare_parts_invoices إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود spare_parts_invoices: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة repair_type إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'repair_type')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود repair_type بعد problem
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `repair_type` ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`");
                // تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
                $conn->query("UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL");
                error_log('تم إضافة عمود repair_type إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود repair_type: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة inspection_cost إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'inspection_cost')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود inspection_cost بعد repair_cost
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `inspection_cost` DECIMAL(10,2) DEFAULT 0 AFTER `repair_cost`");
                error_log('تم إضافة عمود inspection_cost إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود inspection_cost: ' . $e->getMessage());
        }
    }
    
    $customer_id = $data['customer_id'] ?? null;
    $customer_name = trim($data['customer_name'] ?? '');
    $customer_phone = trim($data['customer_phone'] ?? '');
    $device_type = trim($data['device_type'] ?? '');
    $device_model = trim($data['device_model'] ?? '');
    $serial_number = trim($data['serial_number'] ?? '');
    $accessories = trim($data['accessories'] ?? '');
    $problem = trim($data['problem'] ?? '');
    $repair_type = trim($data['repair_type'] ?? 'soft');
    // التحقق من صحة نوع الصيانة
    if (!in_array($repair_type, ['soft', 'hard', 'fast'])) {
        $repair_type = 'soft';
    }
    $customer_price = floatval($data['customer_price'] ?? 0);
    $repair_cost = floatval($data['repair_cost'] ?? 0);
    $parts_store = trim($data['parts_store'] ?? '');
    
    // معالجة أرقام فواتير قطع الغيار
    $spare_parts_invoices = null;
    if (isset($data['spare_parts_invoices']) && is_array($data['spare_parts_invoices']) && !empty($data['spare_parts_invoices'])) {
        // تصفية الأرقام الفارغة وتحويلها إلى JSON
        $filteredInvoices = array_filter(array_map('trim', $data['spare_parts_invoices']));
        if (!empty($filteredInvoices)) {
            $spare_parts_invoices = json_encode(array_values($filteredInvoices), JSON_UNESCAPED_UNICODE);
        }
    }
    
    $paid_amount = floatval($data['paid_amount'] ?? 0);
    // ✅ حساب remaining_amount تلقائياً: customer_price - paid_amount
    // إذا تم إرسال remaining_amount، استخدمه، وإلا احسبه تلقائياً
    if (isset($data['remaining_amount'])) {
        $remaining_amount = floatval($data['remaining_amount']);
    } else {
        // حساب تلقائي: customer_price - paid_amount
        $remaining_amount = $customer_price - $paid_amount;
    }
    $delivery_date = $data['delivery_date'] ?? null;
    $device_image = $data['device_image'] ?? '';
    $status = $data['status'] ?? 'received';
    $notes = trim($data['notes'] ?? '');
    
    if (empty($customer_name) || empty($customer_phone) || empty($device_type) || empty($problem)) {
        response(false, 'الحقول الأساسية مطلوبة', null, 400);
    }
    
    // توليد أو استخدام رقم العملية المرسل
    $repairNumber = trim($data['repair_number'] ?? '');
    
    // إذا لم يتم إرسال رقم عملية، توليد رقم عشوائي من 6 أحرف
    if (empty($repairNumber)) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $repairNumber = '';
        for ($i = 0; $i < 6; $i++) {
            $repairNumber .= $chars[rand(0, strlen($chars) - 1)];
        }
    }
    
    // التحقق من أن الرقم فريد (إذا كان موجوداً في قاعدة البيانات، توليد رقم جديد)
    $maxAttempts = 10;
    $attempts = 0;
    while ($attempts < $maxAttempts) {
        $existing = dbSelectOne(
            "SELECT id FROM repairs WHERE repair_number = ?",
            [$repairNumber]
        );
        
        if (!$existing) {
            break; // الرقم فريد، يمكن استخدامه
        }
        
        // توليد رقم جديد
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $repairNumber = '';
        for ($i = 0; $i < 6; $i++) {
            $repairNumber .= $chars[rand(0, strlen($chars) - 1)];
        }
        $attempts++;
    }
    
    if ($attempts >= $maxAttempts) {
        response(false, 'فشل في توليد رقم عملية فريد', null, 500);
    }
    
    $repairId = generateId();
    $session = checkAuth();
    // ✅ استخدام created_by من البيانات المرسلة إذا كان موجوداً، وإلا استخدام المستخدم الحالي
    $createdBy = $data['created_by'] ?? $session['user_id'];
    $userBranchId = $session['branch_id'] ?? null;
    $userRole = $session['role'];
    
    error_log("✅ [Repairs] POST - created_by من البيانات: " . ($data['created_by'] ?? 'null') . ", createdBy النهائي: $createdBy, user_id: " . $session['user_id']);
    
    // تحديد branch_id للعملية
    $repairBranchId = null;
    
    if ($userRole === 'admin') {
        // المالك: استخدام branch_id من البيانات أو الفرع الأول
        if (isset($data['branch_id']) && $data['branch_id'] !== '') {
            $repairBranchId = $data['branch_id'];
        } else {
            $repairBranchId = getFirstBranchId();
        }
    } else {
        // المستخدم العادي: استخدام فرعه
        if (!$userBranchId) {
            response(false, 'المستخدم غير مرتبط بفرع', null, 400);
        }
        $repairBranchId = $userBranchId;
    }
    
    // بناء الاستعلام بناءً على وجود الأعمدة
    $hasSparePartsInvoices = dbColumnExists('repairs', 'spare_parts_invoices');
    $hasInspectionCost = dbColumnExists('repairs', 'inspection_cost');
    
    if ($hasSparePartsInvoices && $hasInspectionCost) {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, inspection_cost, parts_store, spare_parts_invoices, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $inspection_cost, $parts_store, $spare_parts_invoices, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    } else if ($hasSparePartsInvoices) {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, parts_store, spare_parts_invoices, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $parts_store, $spare_parts_invoices, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    } else if ($hasInspectionCost) {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, inspection_cost, parts_store, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $inspection_cost, $parts_store, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    } else {
        $result = dbExecute(
            "INSERT INTO repairs (
                id, branch_id, repair_number, customer_id, customer_name, customer_phone, 
                device_type, device_model, serial_number, accessories, problem, repair_type,
                customer_price, repair_cost, parts_store, paid_amount, remaining_amount,
                delivery_date, device_image, status, notes, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [
                $repairId, $repairBranchId, $repairNumber, $customer_id, $customer_name, $customer_phone,
                $device_type, $device_model, $serial_number, $accessories, $problem, $repair_type,
                $customer_price, $repair_cost, $parts_store, $paid_amount, $remaining_amount,
                $delivery_date, $device_image, $status, $notes, $createdBy
            ]
        );
    }
    
    if ($result === false) {
        response(false, 'خطأ في إضافة عملية الصيانة', null, 500);
    }
    
    // ✅ إضافة المبلغ المدفوع مقدماً إلى الخزنة تلقائياً لجميع أنواع العملاء
    // ✅ تسجيل المبلغ حسب نوع الفرع: repair_profit للفرع الأول، deposit للفرع الثاني
    if ($paid_amount > 0 && $repairBranchId) {
        if (dbTableExists('treasury_transactions')) {
            // تحديد نوع الفرع (الأول أو الثاني)
            $branch = dbSelectOne("SELECT id, name, created_at FROM branches WHERE id = ?", [$repairBranchId]);
            $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
            $isFirstBranch = $branch && $firstBranch && $branch['id'] === $firstBranch['id'];
            
            // تحديد نوع المعاملة: repair_profit للفرع الأول، deposit للفرع الثاني
            $transactionType = $isFirstBranch ? 'repair_profit' : 'deposit';
            $transactionTypeLabel = $isFirstBranch ? 'أرباح الصيانة' : 'إيرادات';
            
            // التحقق من عدم وجود معاملة مسجلة مسبقاً
            $existingTransaction = dbSelectOne(
                "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = ? AND description LIKE ?",
                [$repairId, $transactionType, '%مبلغ مدفوع مقدماً%']
            );
            
            if (!$existingTransaction) {
                $transactionId = generateId();
                $transactionDescription = "مبلغ مدفوع مقدماً - عملية صيانة رقم: {$repairNumber}";
                
                $transactionResult = dbExecute(
                    "INSERT INTO treasury_transactions (
                        id, branch_id, transaction_type, amount, description, 
                        reference_id, reference_type, created_at, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, 'repair', NOW(), ?)",
                    [$transactionId, $repairBranchId, $transactionType, $paid_amount, $transactionDescription, $repairId, $session['user_id']]
                );
                
                if ($transactionResult !== false) {
                    error_log("✅ [Repairs API] تم إضافة المبلغ المدفوع مقدماً ({$paid_amount} ج.م) إلى الخزنة كـ {$transactionTypeLabel} للعملية {$repairNumber}");
                } else {
                    error_log("⚠️ [Repairs API] فشل إضافة المبلغ المدفوع مقدماً إلى الخزنة");
                }
            }
        }
    }
    
    // ✅ لا يتم إضافة الدين عند إنشاء العملية - سيتم إضافته فقط عند تغيير الحالة إلى "جاهز للتسليم"
    // (لأن العملية الجديدة عادة ما تكون بحالة 'received' وليس 'ready_for_delivery')
    
    $newRepair = dbSelectOne("SELECT * FROM repairs WHERE id = ?", [$repairId]);
    $newRepair['cost'] = $newRepair['customer_price']; // للتوافق
    
    // معالجة أرقام فواتير قطع الغيار
    if (isset($newRepair['spare_parts_invoices']) && !empty($newRepair['spare_parts_invoices'])) {
        try {
            $invoices = json_decode($newRepair['spare_parts_invoices'], true);
            if (is_array($invoices)) {
                $newRepair['spare_parts_invoices'] = $invoices;
            } else {
                $newRepair['spare_parts_invoices'] = [];
            }
        } catch (Exception $e) {
            $newRepair['spare_parts_invoices'] = [];
        }
    } else {
        $newRepair['spare_parts_invoices'] = [];
    }
    
    response(true, 'تم إضافة عملية الصيانة بنجاح', $newRepair);
}

// تعديل عملية صيانة
if ($method === 'PUT') {
    checkAuth();
    checkAPISecurity(); // ✅ حماية API متعددة الطبقات
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    // Migration: تحديث عمود status ليشمل جميع القيم المستخدمة
    try {
        $conn = getDBConnection();
        if ($conn) {
            // التحقق من القيم الحالية في ENUM
            $result = $conn->query("SHOW COLUMNS FROM repairs WHERE Field = 'status'");
            if ($result && $result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $type = $row['Type'];
                
                // التحقق من وجود جميع القيم المطلوبة
                $requiredValues = ['received', 'under_inspection', 'awaiting_customer_approval', 'customer_approved', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled', 'lost'];
                $hasAllValues = true;
                
                foreach ($requiredValues as $value) {
                    if (strpos($type, "'$value'") === false) {
                        $hasAllValues = false;
                        break;
                    }
                }
                
                // إذا لم تكن جميع القيم موجودة، تحديث ENUM
                if (!$hasAllValues) {
                    $enumValues = implode(',', array_map(function($v) { return "'$v'"; }, $requiredValues));
                    $conn->query("ALTER TABLE `repairs` MODIFY COLUMN `status` ENUM($enumValues) NOT NULL DEFAULT 'received'");
                    error_log('✅ تم تحديث عمود status في جدول repairs ليشمل جميع القيم المطلوبة');
                    
                    // ✅ تحديث السجلات الموجودة التي تستخدم القيم القديمة
                    // pending -> received
                    $conn->query("UPDATE `repairs` SET `status` = 'received' WHERE `status` = 'pending'");
                    // ready -> ready_for_delivery
                    $conn->query("UPDATE `repairs` SET `status` = 'ready_for_delivery' WHERE `status` = 'ready'");
                    error_log('✅ تم تحديث السجلات الموجودة لاستخدام القيم الجديدة');
                }
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate') === false && strpos($e->getMessage(), 'already exists') === false) {
            error_log('⚠️ خطأ في تحديث عمود status: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة repair_type إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'repair_type')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود repair_type بعد problem
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `repair_type` ENUM('soft', 'hard', 'fast') DEFAULT 'soft' AFTER `problem`");
                // تحديث السجلات الموجودة لتكون من نوع 'soft' كقيمة افتراضية
                $conn->query("UPDATE `repairs` SET `repair_type` = 'soft' WHERE `repair_type` IS NULL");
                error_log('تم إضافة عمود repair_type إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود repair_type: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة inspection_cost إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'inspection_cost')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود inspection_cost بعد repair_cost
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `inspection_cost` DECIMAL(10,2) DEFAULT 0 AFTER `repair_cost`");
                error_log('تم إضافة عمود inspection_cost إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود inspection_cost: ' . $e->getMessage());
        }
    }
    
    // Migration: إضافة inspection_report إذا لم يكن موجوداً
    try {
        if (!dbColumnExists('repairs', 'inspection_report')) {
            $conn = getDBConnection();
            if ($conn) {
                // إضافة عمود inspection_report بعد status
                $conn->query("ALTER TABLE `repairs` ADD COLUMN `inspection_report` TEXT DEFAULT NULL AFTER `status`");
                error_log('تم إضافة عمود inspection_report إلى جدول repairs بنجاح');
            }
        }
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate column') === false) {
            error_log('خطأ في إضافة عمود inspection_report: ' . $e->getMessage());
        }
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    // التحقق من وجود العملية
    $repair = dbSelectOne("SELECT id, status, notes FROM repairs WHERE id = ?", [$id]);
    if (!$repair) {
        response(false, 'عملية الصيانة غير موجودة', null, 404);
    }
    
    // ✅ السماح بتعديل inspection_cost فقط للعمليات الملغاة
    if ($repair['status'] === 'cancelled') {
        // السماح بتعديل inspection_cost فقط للعمليات الملغاة
        $allowedFieldsForCancelled = ['inspection_cost'];
        $requestedFields = array_keys($data);
        
        // إزالة الحقول التقنية من الحقول المطلوبة للتحقق
        $requestedFields = array_filter($requestedFields, function($field) {
            // إزالة 'id' و '_method' من الحقول المطلوبة للتحقق
            return $field !== 'id' && $field !== '_method';
        });
        
        // إعادة فهرسة المصفوفة بعد التصفية
        $requestedFields = array_values($requestedFields);
        
        // التحقق من أن التعديل يحتوي على inspection_cost فقط
        $hasOnlyAllowedFields = count($requestedFields) === 1 && in_array('inspection_cost', $requestedFields);
        
        if (!$hasOnlyAllowedFields) {
            response(false, 'يمكن تعديل تكلفة الكشف فقط للعمليات الملغاة', null, 400);
        }
    }
    
    // ✅ حماية الملاحظة المحمية من التعديل
    $protectedNote = "ملغي نتيجة طلب العميل";
    $currentNotes = $repair['notes'] ?? '';
    
    // إذا كانت الملاحظة المحمية موجودة، يجب إبقاؤها عند التحديث
    if (strpos($currentNotes, $protectedNote) !== false && isset($data['notes'])) {
        // التحقق من أن الملاحظة الجديدة لا تحذف الملاحظة المحمية
        if (strpos($data['notes'], $protectedNote) === false) {
            // إعادة إضافة الملاحظة المحمية في نهاية الملاحظات
            $newNotes = trim($data['notes']);
            if ($newNotes) {
                $newNotes = $newNotes . "\n\n" . $protectedNote;
            } else {
                $newNotes = $protectedNote;
            }
            $data['notes'] = $newNotes;
        }
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    $fields = [
        'customer_id', 'customer_name', 'customer_phone', 'device_type', 'device_model',
        'serial_number', 'accessories', 'problem', 'repair_type', 'customer_price', 'repair_cost',
        'inspection_cost', 'parts_store', 'spare_parts_invoices', 'paid_amount', 'remaining_amount', 'delivery_date',
        'device_image', 'status', 'inspection_report', 'notes', 'created_by'
    ];
    
    // التحقق من صحة نوع الصيانة إذا كان موجوداً
    if (isset($data['repair_type']) && !in_array($data['repair_type'], ['soft', 'hard', 'fast'])) {
        $data['repair_type'] = 'soft';
    }
    
    // ✅ عند تحديث customer_price أو paid_amount، يجب تحديث remaining_amount تلقائياً
    $shouldUpdateRemainingAmount = false;
    $newCustomerPrice = null;
    $newPaidAmount = null;
    $currentRepair = null;
    
    // جلب البيانات الحالية من قاعدة البيانات
    $currentRepair = dbSelectOne("SELECT customer_id, customer_price, paid_amount, remaining_amount, delivery_date, status FROM repairs WHERE id = ?", [$id]);
    
    if ($currentRepair) {
        $currentCustomerId = $currentRepair['customer_id'] ?? null;
        $currentCustomerPrice = floatval($currentRepair['customer_price'] ?? 0);
        $currentPaidAmount = floatval($currentRepair['paid_amount'] ?? 0);
        $currentRemainingAmount = floatval($currentRepair['remaining_amount'] ?? 0);
        $currentDeliveryDate = $currentRepair['delivery_date'] ?? null;
        $currentStatus = $currentRepair['status'] ?? '';
        
        // تحديد القيم الجديدة
        if (array_key_exists('customer_price', $data)) {
            $newCustomerPrice = floatval($data['customer_price']);
        } else {
            $newCustomerPrice = $currentCustomerPrice;
        }
        
        if (array_key_exists('paid_amount', $data)) {
            $newPaidAmount = floatval($data['paid_amount']);
        } else {
            $newPaidAmount = $currentPaidAmount;
        }
        
        // حساب remaining_amount تلقائياً: customer_price - paid_amount
        $calculatedRemainingAmount = $newCustomerPrice - $newPaidAmount;
        
        // تحديث remaining_amount في البيانات إذا تم تحديث customer_price أو paid_amount
        if (array_key_exists('customer_price', $data) || array_key_exists('paid_amount', $data)) {
            $data['remaining_amount'] = $calculatedRemainingAmount;
            $shouldUpdateRemainingAmount = true;
            error_log("✅ [Repairs API] تحديث remaining_amount تلقائياً: customer_price ({$newCustomerPrice}) - paid_amount ({$newPaidAmount}) = {$calculatedRemainingAmount}");
        }
        
        // ✅ تحديث دين العميل للعملاء التجاريين فقط عند تغيير الحالة إلى "جاهز للتسليم" أو "تم التسليم"
        $newStatus = isset($data['status']) ? $data['status'] : $currentStatus;
        $newRemainingAmount = isset($data['remaining_amount']) ? floatval($data['remaining_amount']) : $currentRemainingAmount;
        
        // عند تغيير الحالة إلى "جاهز للتسليم" يتم إضافة المبلغ المتبقي إلى الديون
        if ($currentCustomerId && $newStatus === 'ready_for_delivery' && $currentStatus !== 'ready_for_delivery' && dbColumnExists('customers', 'total_debt')) {
            // جلب نوع العميل والدين الحالي
            $customer = dbSelectOne(
                "SELECT customer_type, total_debt FROM customers WHERE id = ?",
                [$currentCustomerId]
            );
            
            if ($customer && ($customer['customer_type'] ?? 'retail') === 'commercial' && $newRemainingAmount > 0) {
                $currentTotalDebt = floatval($customer['total_debt'] ?? 0);
                $newTotalDebt = $currentTotalDebt + $newRemainingAmount;
                
                $updateDebtResult = dbExecute(
                    "UPDATE customers SET total_debt = ? WHERE id = ?",
                    [$newTotalDebt, $currentCustomerId]
                );
                
                if ($updateDebtResult === false) {
                    error_log('⚠️ فشل تحديث دين العميل بعد تغيير الحالة إلى "جاهز للتسليم"');
                } else {
                    error_log("✅ تم إضافة المبلغ المتبقي ({$newRemainingAmount}) إلى دين العميل عند تغيير الحالة إلى 'جاهز للتسليم': {$currentTotalDebt} + {$newRemainingAmount} = {$newTotalDebt}");
                }
            }
        }
        
        // ✅ عند تغيير الحالة إلى "تم التسليم" للعملاء التجاريين: إضافة المبلغ المتبقي للديون إذا لم يتم إضافته من قبل
        if ($currentCustomerId && $newStatus === 'delivered' && $currentStatus !== 'delivered' && dbColumnExists('customers', 'total_debt')) {
            // جلب نوع العميل والدين الحالي
            $customer = dbSelectOne(
                "SELECT customer_type, total_debt FROM customers WHERE id = ?",
                [$currentCustomerId]
            );
            
            if ($customer && ($customer['customer_type'] ?? 'retail') === 'commercial' && $newRemainingAmount > 0) {
                // التحقق من أن المبلغ المتبقي لم يتم إضافته للديون من قبل (عند تغيير الحالة إلى ready_for_delivery)
                // إذا كانت الحالة السابقة ليست ready_for_delivery، فيجب إضافة المبلغ المتبقي للديون
                if ($currentStatus !== 'ready_for_delivery') {
                    $currentTotalDebt = floatval($customer['total_debt'] ?? 0);
                    $newTotalDebt = $currentTotalDebt + $newRemainingAmount;
                    
                    $updateDebtResult = dbExecute(
                        "UPDATE customers SET total_debt = ? WHERE id = ?",
                        [$newTotalDebt, $currentCustomerId]
                    );
                    
                    if ($updateDebtResult === false) {
                        error_log('⚠️ فشل تحديث دين العميل بعد تغيير الحالة إلى "تم التسليم"');
                    } else {
                        error_log("✅ تم إضافة المبلغ المتبقي ({$newRemainingAmount}) إلى دين العميل عند تغيير الحالة إلى 'تم التسليم': {$currentTotalDebt} + {$newRemainingAmount} = {$newTotalDebt}");
                    }
                }
            }
        }
        
        // ✅ إصلاح: عند تغيير الحالة إلى "delivered"، تعيين delivery_date تلقائياً إذا كان NULL
        if (isset($data['status']) && $data['status'] === 'delivered' && $currentStatus !== 'delivered') {
            // إذا كان delivery_date فارغاً أو null، تعيينه إلى تاريخ اليوم
            if (empty($data['delivery_date']) && empty($currentDeliveryDate)) {
                $data['delivery_date'] = date('Y-m-d');
                error_log("✅ [Repairs API] تعيين delivery_date تلقائياً إلى تاريخ اليوم: " . $data['delivery_date']);
            } elseif (empty($data['delivery_date']) && !empty($currentDeliveryDate)) {
                // إذا كان delivery_date موجوداً في قاعدة البيانات، نستخدمه
                // لا حاجة لتحديثه
            }
        }
    }
    
    foreach ($fields as $field) {
        // ✅ إصلاح: التحقق من وجود الحقل في البيانات المرسلة (حتى لو كانت القيمة null أو '')
        if (array_key_exists($field, $data)) {
            // ✅ تسجيل الحالة للتحديث
            if ($field === 'status') {
                error_log("✅ [Repairs API] تحديث الحالة: " . $data[$field] . " للعملية: " . $id);
            }
            
            if (in_array($field, ['customer_price', 'repair_cost', 'inspection_cost', 'paid_amount', 'remaining_amount'])) {
                $updateFields[] = "$field = ?";
                $updateParams[] = floatval($data[$field]);
            } else if ($field === 'spare_parts_invoices') {
                // معالجة أرقام فواتير قطع الغيار
                $spare_parts_invoices = null;
                if (is_array($data[$field]) && !empty($data[$field])) {
                    $filteredInvoices = array_filter(array_map('trim', $data[$field]));
                    if (!empty($filteredInvoices)) {
                        $spare_parts_invoices = json_encode(array_values($filteredInvoices), JSON_UNESCAPED_UNICODE);
                    }
                }
                $updateFields[] = "$field = ?";
                $updateParams[] = $spare_parts_invoices;
            } else {
                $updateFields[] = "$field = ?";
                // ✅ إصلاح: معالجة القيم الفارغة بشكل صحيح - لكن status يجب أن يكون string دائماً
                if ($field === 'status') {
                    $updateParams[] = $data[$field]; // status يجب أن يكون string دائماً
                } else {
                    $updateParams[] = ($data[$field] === null || $data[$field] === '') ? null : $data[$field];
                }
            }
        }
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE repairs SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    // ✅ تسجيل الاستعلام للتحديث
    error_log("✅ [Repairs API] استعلام التحديث: " . $query);
    error_log("✅ [Repairs API] معاملات التحديث: " . json_encode($updateParams));
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        error_log("❌ [Repairs API] فشل تحديث العملية: " . $id);
        response(false, 'خطأ في تعديل عملية الصيانة', null, 500);
    }
    
    // ✅ التحقق من تحديث الحالة بشكل صحيح
    $updatedRepair = dbSelectOne("SELECT status, customer_price, repair_cost, inspection_cost, branch_id, remaining_amount, paid_amount, customer_id, repair_number FROM repairs WHERE id = ?", [$id]);
    if ($updatedRepair) {
        error_log("✅ [Repairs API] الحالة بعد التحديث: " . $updatedRepair['status']);
        $branchId = $updatedRepair['branch_id'] ?? null;
        $repairNumberText = $updatedRepair['repair_number'] ?? $id;
        
        // ✅ إضافة المبلغ المتبقي إلى الخزنة عند تغيير الحالة إلى "delivered"
        // ✅ تسجيل المبلغ حسب نوع الفرع: repair_profit للفرع الأول، deposit للفرع الثاني
        // ✅ إذا كان العميل تجاري (commercial): لا يتم إضافة المبلغ المتبقي للخزنة على الإطلاق - يُضاف فقط للديون
        if (isset($data['status']) && $data['status'] === 'delivered' && $currentStatus !== 'delivered') {
            $remainingAmount = floatval($updatedRepair['remaining_amount'] ?? 0);
            $customerId = $updatedRepair['customer_id'] ?? null;
            
            if ($remainingAmount > 0 && $branchId && dbTableExists('treasury_transactions')) {
                // التحقق من نوع العميل - إذا كان commercial فلا يُضاف للخزنة على الإطلاق
                $shouldAddToRevenue = true;
                if ($customerId) {
                    $customer = dbSelectOne("SELECT customer_type FROM customers WHERE id = ?", [$customerId]);
                    if ($customer && ($customer['customer_type'] ?? 'retail') === 'commercial') {
                        $shouldAddToRevenue = false;
                        error_log("ℹ️ [Repairs API] المبلغ المتبقي ({$remainingAmount} ج.م) لا يُضاف للخزنة لأن العميل تجاري (commercial) - سيتم إضافته للديون فقط - العملية {$repairNumberText}");
                    }
                }
                
                if ($shouldAddToRevenue) {
                    // تحديد نوع الفرع (الأول أو الثاني)
                    $branch = dbSelectOne("SELECT id, name, created_at FROM branches WHERE id = ?", [$branchId]);
                    $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
                    $isFirstBranch = $branch && $firstBranch && $branch['id'] === $firstBranch['id'];
                    
                    // تحديد نوع المعاملة: repair_profit للفرع الأول، deposit للفرع الثاني
                    $transactionType = $isFirstBranch ? 'repair_profit' : 'deposit';
                    $transactionTypeLabel = $isFirstBranch ? 'أرباح الصيانة' : 'إيرادات';
                    
                    // التحقق من عدم وجود معاملة مسجلة مسبقاً
                    $existingTransaction = dbSelectOne(
                        "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = ? AND description LIKE ?",
                        [$id, $transactionType, '%المبلغ المتبقي%']
                    );
                    
                    if (!$existingTransaction) {
                        $session = checkAuth();
                        $transactionId = generateId();
                        $transactionDescription = "المبلغ المتبقي - عملية صيانة رقم: {$repairNumberText}";
                        
                        $transactionResult = dbExecute(
                            "INSERT INTO treasury_transactions (
                                id, branch_id, transaction_type, amount, description, 
                                reference_id, reference_type, created_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, 'repair', NOW(), ?)",
                            [$transactionId, $branchId, $transactionType, $remainingAmount, $transactionDescription, $id, $session['user_id']]
                        );
                        
                        if ($transactionResult !== false) {
                            error_log("✅ [Repairs API] تم إضافة المبلغ المتبقي ({$remainingAmount} ج.م) إلى الخزنة كـ {$transactionTypeLabel} للعملية {$repairNumberText}");
                        } else {
                            error_log("⚠️ [Repairs API] فشل إضافة المبلغ المتبقي إلى الخزنة");
                        }
                    } else {
                        error_log("ℹ️ [Repairs API] تم بالفعل إضافة المبلغ المتبقي للعملية {$repairNumberText}");
                    }
                }
            }
        }
        
        // ✅ خصم تكلفة الإصلاح من الخزنة عند تغيير الحالة إلى "ready_for_delivery"
        if (isset($data['status']) && $data['status'] === 'ready_for_delivery' && $currentStatus !== 'ready_for_delivery') {
            $repairCost = floatval($updatedRepair['repair_cost'] ?? 0);
            
            if ($repairCost > 0 && $branchId && dbTableExists('treasury_transactions')) {
                // التحقق من عدم وجود معاملة مسجلة مسبقاً
                $existingTransaction = dbSelectOne(
                    "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = 'repair_cost'",
                    [$id]
                );
                
                if (!$existingTransaction) {
                    $session = checkAuth();
                    $transactionId = generateId();
                    $transactionDescription = "تكلفة الإصلاح - عملية صيانة رقم: {$repairNumberText}";
                    
                    $transactionResult = dbExecute(
                        "INSERT INTO treasury_transactions (
                            id, branch_id, transaction_type, amount, description, 
                            reference_id, reference_type, created_at, created_by
                        ) VALUES (?, ?, 'repair_cost', ?, ?, ?, 'repair', NOW(), ?)",
                        [$transactionId, $branchId, $repairCost, $transactionDescription, $id, $session['user_id']]
                    );
                    
                    if ($transactionResult !== false) {
                        error_log("✅ [Repairs API] تم خصم تكلفة الإصلاح ({$repairCost} ج.م) من الخزنة للعملية {$repairNumberText}");
                    } else {
                        error_log("⚠️ [Repairs API] فشل خصم تكلفة الإصلاح من الخزنة");
                    }
                }
            }
        }
        
        // ✅ معالجة حالة "cancelled": خصم المبلغ المدفوع مقدماً من خزنة الفرع
        if (isset($data['status']) && $data['status'] === 'cancelled' && $currentStatus !== 'cancelled') {
            $paidAmount = floatval($updatedRepair['paid_amount'] ?? 0);
            
            // خصم المبلغ المدفوع مقدماً بالكامل من الخزنة
            if ($paidAmount > 0 && $branchId && dbTableExists('treasury_transactions')) {
                // التحقق من عدم وجود معاملة خصم مسجلة مسبقاً
                $existingTransaction = dbSelectOne(
                    "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = 'withdrawal' AND description LIKE ?",
                    [$id, '%استرجاع مبلغ مدفوع مقدماً%']
                );
                
                if (!$existingTransaction) {
                    $session = checkAuth();
                    $transactionId = generateId();
                    $transactionDescription = "استرجاع مبلغ مدفوع مقدماً - عملية صيانة ملغية رقم: {$repairNumberText}";
                    
                    $transactionResult = dbExecute(
                        "INSERT INTO treasury_transactions (
                            id, branch_id, transaction_type, amount, description, 
                            reference_id, reference_type, created_at, created_by
                        ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'repair', NOW(), ?)",
                        [$transactionId, $branchId, $paidAmount, $transactionDescription, $id, $session['user_id']]
                    );
                    
                    if ($transactionResult !== false) {
                        error_log("✅ [Repairs API] تم خصم المبلغ المدفوع مقدماً ({$paidAmount} ج.م) من خزنة الفرع للعملية الملغية {$repairNumberText}");
                    } else {
                        error_log("⚠️ [Repairs API] فشل خصم المبلغ المدفوع مقدماً من خزنة الفرع");
                    }
                } else {
                    error_log("ℹ️ [Repairs API] تم بالفعل خصم المبلغ المدفوع مقدماً للعملية الملغية {$repairNumberText}");
                }
            } else if ($paidAmount > 0) {
                error_log("⚠️ [Repairs API] لا يمكن خصم المبلغ المدفوع مقدماً: branchId أو treasury_transactions غير متاح");
            }
        }
        
        // ✅ معالجة تحديث inspection_cost للعمليات الملغاة
        // التحقق من أن العملية ملغاة (من قاعدة البيانات بعد التحديث)
        $updatedStatus = $updatedRepair['status'] ?? '';
        if ($updatedStatus === 'cancelled' && isset($data['inspection_cost'])) {
            $inspectionCost = floatval($data['inspection_cost']);
            $paidAmount = floatval($updatedRepair['paid_amount'] ?? 0);
            
            if ($inspectionCost >= 0 && $paidAmount > 0 && $branchId && dbTableExists('treasury_transactions')) {
                $session = checkAuth();
                
                // ✅ 1. خصم المبلغ المدفوع مقدماً من الخزنة (إذا لم يتم خصمه مسبقاً)
                $existingWithdrawal = dbSelectOne(
                    "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = 'withdrawal' AND description LIKE ?",
                    [$id, '%استرجاع مبلغ مدفوع مقدماً%']
                );
                
                if (!$existingWithdrawal) {
                    $withdrawalId = generateId();
                    $withdrawalDescription = "استرجاع مبلغ مدفوع مقدماً - عملية صيانة ملغية رقم: {$repairNumberText}";
                    
                    $withdrawalResult = dbExecute(
                        "INSERT INTO treasury_transactions (
                            id, branch_id, transaction_type, amount, description, 
                            reference_id, reference_type, created_at, created_by
                        ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'repair', NOW(), ?)",
                        [$withdrawalId, $branchId, $paidAmount, $withdrawalDescription, $id, $session['user_id']]
                    );
                    
                    if ($withdrawalResult !== false) {
                        error_log("✅ [Repairs API] تم خصم المبلغ المدفوع مقدماً ({$paidAmount} ج.م) من خزنة الفرع للعملية الملغية {$repairNumberText}");
                    } else {
                        error_log("⚠️ [Repairs API] فشل خصم المبلغ المدفوع مقدماً من خزنة الفرع");
                    }
                } else {
                    error_log("ℹ️ [Repairs API] تم بالفعل خصم المبلغ المدفوع مقدماً للعملية الملغية {$repairNumberText}");
                }
                
                // ✅ 2. إضافة تكلفة الكشف إلى الخزنة كإيرادات
                // نضيف تكلفة الكشف بالكامل كإيرادات (حتى لو كانت أقل من المبلغ المدفوع)
                if ($inspectionCost > 0) {
                    // تحديد نوع الفرع (الأول أو الثاني)
                    $branch = dbSelectOne("SELECT id, name, created_at FROM branches WHERE id = ?", [$branchId]);
                    $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
                    $isFirstBranch = $branch && $firstBranch && $branch['id'] === $firstBranch['id'];
                    
                    // تحديد نوع المعاملة: repair_profit للفرع الأول، deposit للفرع الثاني
                    $transactionType = $isFirstBranch ? 'repair_profit' : 'deposit';
                    $transactionTypeLabel = $isFirstBranch ? 'أرباح الصيانة' : 'إيرادات';
                    
                    // التحقق من عدم وجود معاملة مسجلة مسبقاً
                    $existingTransaction = dbSelectOne(
                        "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'repair' AND transaction_type = ? AND description LIKE ?",
                        [$id, $transactionType, '%تكلفة الكشف - عملية صيانة ملغية%']
                    );
                    
                    if (!$existingTransaction) {
                        $transactionId = generateId();
                        $transactionDescription = "تكلفة الكشف - عملية صيانة ملغية رقم: {$repairNumberText} (المبلغ المدفوع: {$paidAmount} ج.م)";
                        
                        $transactionResult = dbExecute(
                            "INSERT INTO treasury_transactions (
                                id, branch_id, transaction_type, amount, description, 
                                reference_id, reference_type, created_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, 'repair', NOW(), ?)",
                            [$transactionId, $branchId, $transactionType, $inspectionCost, $transactionDescription, $id, $session['user_id']]
                        );
                        
                        if ($transactionResult !== false) {
                            error_log("✅ [Repairs API] تم إضافة {$transactionTypeLabel} ({$inspectionCost} ج.م) إلى الخزنة للعملية الملغية {$repairNumberText}");
                        } else {
                            error_log("⚠️ [Repairs API] فشل إضافة {$transactionTypeLabel} إلى الخزنة");
                        }
                    } else {
                        error_log("ℹ️ [Repairs API] تم بالفعل إضافة تكلفة الكشف للعملية الملغية {$repairNumberText}");
                    }
                } else {
                    error_log("ℹ️ [Repairs API] تكلفة الكشف ({$inspectionCost}) غير صالحة - لا يتم إضافة شيء");
                }
            } else {
                if ($paidAmount <= 0) {
                    error_log("ℹ️ [Repairs API] لا يوجد مبلغ مدفوع مقدماً للعملية الملغية {$repairNumberText}");
                } else if (!$branchId) {
                    error_log("⚠️ [Repairs API] لا يمكن معالجة تكلفة الكشف: branchId غير متاح");
                }
            }
        }
        
        // ✅ ملاحظة: صافي ربح العملية (customer_price - repair_cost) هو إحصائية فقط
        // ولا يجب تسجيله في سجل معاملات الخزنة لأنه ليس مبلغاً فعلياً يُضاف أو يُخصم من الخزنة
        // الإيرادات الفعلية تُسجل عند استلام المبلغ المدفوع مقدماً والمبلغ المتبقي
        // التكاليف الفعلية تُسجل عند تغيير الحالة إلى "ready_for_delivery"
    }
    
    response(true, 'تم تعديل عملية الصيانة بنجاح');
}

// حذف عملية صيانة
if ($method === 'DELETE') {
    checkAuth();
    checkAPISecurity(); // ✅ حماية API متعددة الطبقات
    checkPermission('manager');
    if (!isset($data['id'])) {
        $data = getRequestData();
    }
    
    $id = $data['id'] ?? '';
    
    if (empty($id)) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    // التحقق من وجود العملية
    $repair = dbSelectOne("SELECT id FROM repairs WHERE id = ?", [$id]);
    if (!$repair) {
        response(false, 'عملية الصيانة غير موجودة', null, 404);
    }
    
    $result = dbExecute("DELETE FROM repairs WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف عملية الصيانة', null, 500);
    }
    
    response(true, 'تم حذف عملية الصيانة بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

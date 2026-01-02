<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// جلب الفنيين مع تقييماتهم التراكمية
if ($method === 'GET') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    // تحديد branch_id المطلوب
    $branchId = $_GET['branch_id'] ?? null;
    $month = $_GET['month'] ?? null; // YYYY-MM format
    
    // التحقق من وجود parameter include_admins
    $includeAdmins = isset($_GET['include_admins']) && $_GET['include_admins'] === 'true';
    // التحقق من وجود parameter include_all_users (يشمل جميع المستخدمين المرتبطين بالفرع)
    $includeAllUsers = isset($_GET['include_all_users']) && $_GET['include_all_users'] === 'true';
    
    error_log("🔍 [Technicians] GET params: " . json_encode($_GET));
    error_log("🔍 [Technicians] include_admins: " . ($includeAdmins ? 'true' : 'false') . ", include_all_users: " . ($includeAllUsers ? 'true' : 'false') . ", userRole: $userRole, userBranchId: " . ($userBranchId ?? 'null'));
    
    // فلترة حسب الفرع
    if ($userRole === 'admin') {
        // المالك: يمكنه اختيار أي فرع
        // إذا كان include_admins=true ولم يكن هناك branch_id، جلب المالكين فقط
        if (!$branchId && $includeAdmins) {
            $branchId = null; // السماح بجلب المالكين فقط
        } elseif (!$branchId) {
            response(false, 'معرف الفرع مطلوب', null, 400);
        }
    } else {
        // المستخدم العادي: استخدام فرعه فقط
        // ✅ إذا كان include_all_users=true، يجب استخدام branch_id من الـ URL أو userBranchId
        if ($includeAllUsers) {
            // ✅ استخدام branch_id من الـ URL إذا كان موجوداً، وإلا استخدام userBranchId
            if (!$branchId && $userBranchId) {
                $branchId = $userBranchId;
            }
            if (!$branchId) {
                response(false, 'المستخدم غير مرتبط بفرع', null, 400);
            }
        } else {
            // إذا كان include_admins=true ولم يكن هناك branch_id، السماح بجلب المالكين فقط
            if (!$branchId && $includeAdmins) {
                $branchId = null; // السماح بجلب المالكين فقط
            } elseif (!$userBranchId) {
                response(false, 'المستخدم غير مرتبط بفرع', null, 400);
            } else {
                $branchId = $userBranchId;
            }
        }
    }
    
    error_log("🔍 [Technicians] بعد تحديد الفرع - branchId: " . ($branchId ?? 'null') . ", userBranchId: " . ($userBranchId ?? 'null') . ", includeAllUsers: " . ($includeAllUsers ? 'true' : 'false'));
    
    // تحديد نطاق التاريخ للفلترة الشهرية
    $dateFilter = '';
    $dateParams = [];
    if ($month) {
        // التحقق من صحة تنسيق الشهر (YYYY-MM)
        if (preg_match('/^\d{4}-\d{2}$/', $month)) {
            $startDate = $month . '-01';
            $endDate = date('Y-m-t', strtotime($startDate)); // آخر يوم في الشهر
            $dateFilter = " AND DATE(rr.created_at) >= ? AND DATE(rr.created_at) <= ?";
            $dateParams = [$startDate, $endDate];
        }
    }
    
    // بناء الاستعلام: جلب الفنيين المرتبطين بالفرع + المالكين (إذا طُلب)
    // أو جلب جميع المستخدمين المرتبطين بالفرع (إذا طُلب include_all_users)
    // ✅ إعطاء الأولوية لـ include_all_users
    error_log("🔍 [Technicians] قبل بناء الاستعلام - includeAllUsers: " . ($includeAllUsers ? 'true' : 'false') . ", branchId: " . ($branchId ?? 'null'));
    
    if ($includeAllUsers && $branchId) {
        // ✅ جلب جميع المستخدمين المرتبطين بالفرع من نوع admin و technician
        // ✅ التحقق من وجود عمود avatar
        $hasAvatar = dbColumnExists('users', 'avatar');
        $avatarField = $hasAvatar ? ', u.avatar' : '';
        
        $userId = $session['user_id'] ?? null;
        error_log("✅ [Technicians] جلب جميع المستخدمين (include_all_users) - branchId: $branchId, userId: $userId, userRole: $userRole");
        
        // ✅ الاستعلام: جلب جميع الفنيين المرتبطين بالفرع + جميع المالكين (حتى غير المرتبطين بفرع)
        $technicians = dbSelect(
            "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at{$avatarField}
             FROM users u
             LEFT JOIN branches b ON u.branch_id = b.id
             WHERE (u.branch_id = ? AND u.role = 'technician')
                OR (u.role = 'admin')
             ORDER BY 
                CASE WHEN u.role = 'admin' THEN 1 ELSE 2 END,
                u.role ASC, 
                u.name ASC",
            [$branchId]
        );
        
        if ($technicians && is_array($technicians)) {
            error_log("✅ [Technicians] تم جلب " . count($technicians) . " مستخدم من include_all_users");
            foreach ($technicians as $tech) {
                error_log("   - " . ($tech['name'] ?? '') . " (role: " . ($tech['role'] ?? '') . ", id: " . ($tech['id'] ?? '') . ")");
            }
        } else {
            error_log("⚠️ [Technicians] لم يتم جلب أي مستخدمين من include_all_users");
        }
    } elseif ($includeAdmins) {
        error_log("✅ [Technicians] استخدام include_admins - branchId: " . ($branchId ?? 'null'));
        if ($branchId) {
            // ✅ جلب الفنيين والمالكين - جلب admin المرتبطين بالفرع + admin غير المرتبطين بفرع (للفرع الأول)
            // للتحقق من أن هذا الفرع الأول، نتحقق من ترتيب الفروع
            $firstBranch = dbSelect(
                "SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1",
                []
            );
            $isFirstBranch = false;
            if ($firstBranch && is_array($firstBranch) && count($firstBranch) > 0) {
                $firstBranchId = $firstBranch[0]['id'] ?? null;
                $isFirstBranch = ($firstBranchId === $branchId);
            }
            
            // ✅ التحقق من وجود عمود avatar
            $hasAvatar = dbColumnExists('users', 'avatar');
            $avatarField = $hasAvatar ? ', u.avatar' : '';
            
            if ($isFirstBranch) {
                // ✅ الفرع الأول: جلب الفنيين المرتبطين + admin المرتبطين + admin غير المرتبطين بفرع
                $technicians = dbSelect(
                    "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at{$avatarField}
                     FROM users u
                     LEFT JOIN branches b ON u.branch_id = b.id
                     WHERE (u.role = 'technician' AND u.branch_id = ?) 
                        OR (u.role = 'admin' AND u.branch_id = ?)
                        OR (u.role = 'admin' AND u.branch_id IS NULL)
                     ORDER BY u.role DESC, u.name ASC",
                    [$branchId, $branchId]
                );
            } else {
                // الفروع الأخرى: جلب الفنيين والمالكين المرتبطين بالفرع فقط
                $technicians = dbSelect(
                    "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at{$avatarField}
                     FROM users u
                     LEFT JOIN branches b ON u.branch_id = b.id
                     WHERE (u.role = 'technician' AND u.branch_id = ?) OR (u.role = 'admin' AND u.branch_id = ?)
                     ORDER BY u.role DESC, u.name ASC",
                    [$branchId, $branchId]
                );
            }
        } else {
            // جلب المالكين فقط (عندما لا يكون هناك branch_id)
            // ✅ التحقق من وجود عمود avatar
            $hasAvatar = dbColumnExists('users', 'avatar');
            $avatarField = $hasAvatar ? ', u.avatar' : '';
            $technicians = dbSelect(
                "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at{$avatarField}
                 FROM users u
                 LEFT JOIN branches b ON u.branch_id = b.id
                 WHERE u.role = 'admin'
                 ORDER BY u.name ASC",
                []
            );
        }
    } else {
        // جلب الفنيين فقط (السلوك الافتراضي)
        if (!$branchId) {
            response(false, 'معرف الفرع مطلوب', null, 400);
        }
        $technicians = dbSelect(
            "SELECT u.id, u.username, u.name, u.role, u.branch_id, u.salary, b.name as branch_name, u.created_at
             FROM users u
             LEFT JOIN branches b ON u.branch_id = b.id
             WHERE u.role = 'technician' AND u.branch_id = ?
             ORDER BY u.name ASC",
            [$branchId]
        );
    }
    
    if ($technicians === false) {
        response(false, 'خطأ في جلب الفنيين', null, 500);
    }
    
    if (!is_array($technicians)) {
        $technicians = [];
    }
    
    // جلب التقييمات التراكمية لكل فني
    foreach ($technicians as &$technician) {
        // جلب جميع تقييمات الفني من repair_ratings (تراكمي)
        // تخطي جلب التقييمات إذا كان branchId هو null (عند جلب المالكين فقط)
        $rating = null;
        if ($branchId !== null) {
            $rating = dbSelectOne(
                "SELECT 
                    AVG(rr.technician_rating) as avg_rating, 
                    COUNT(rr.id) as total_ratings
                 FROM repair_ratings rr
                 INNER JOIN repairs r ON rr.repair_id = r.id
                 WHERE r.created_by = ? AND r.branch_id = ?",
                [$technician['id'], $branchId]
            );
        }
        
        // جلب التقييم اليدوي (من المالك)
        $manualRating = dbSelectOne(
            "SELECT rating FROM technician_manual_ratings 
             WHERE technician_id = ? 
             ORDER BY created_at DESC LIMIT 1",
            [$technician['id']]
        );
        
        if ($rating && isset($rating['avg_rating']) && $rating['avg_rating'] !== null) {
            $autoRating = round(floatval($rating['avg_rating']), 2);
            $totalRatings = intval($rating['total_ratings']);
            
            // إذا كان هناك تقييم يدوي، دمجه مع التقييم التلقائي (70% تلقائي + 30% يدوي)
            if ($manualRating && isset($manualRating['rating'])) {
                $manualRatingValue = intval($manualRating['rating']);
                $technician['avg_rating'] = round(($autoRating * 0.7) + ($manualRatingValue * 0.3), 2);
                $technician['has_manual_rating'] = true;
                $technician['manual_rating'] = $manualRatingValue;
            } else {
                $technician['avg_rating'] = $autoRating;
                $technician['has_manual_rating'] = false;
                $technician['manual_rating'] = null;
            }
            
            $technician['total_ratings'] = $totalRatings;
        } else {
            // إذا لم يكن هناك تقييمات تلقائية، استخدام التقييم اليدوي فقط
            if ($manualRating && isset($manualRating['rating'])) {
                $technician['avg_rating'] = intval($manualRating['rating']);
                $technician['has_manual_rating'] = true;
                $technician['manual_rating'] = intval($manualRating['rating']);
            } else {
                $technician['avg_rating'] = 0;
                $technician['has_manual_rating'] = false;
                $technician['manual_rating'] = null;
            }
            $technician['total_ratings'] = 0;
        }
        
        // جلب التقييمات الشهرية إذا تم تحديد شهر
        // تخطي جلب التقييمات الشهرية إذا كان branchId هو null
        if ($month && !empty($dateFilter) && $branchId !== null) {
            $monthlyRating = dbSelectOne(
                "SELECT 
                    AVG(rr.technician_rating) as avg_rating, 
                    COUNT(rr.id) as total_ratings
                 FROM repair_ratings rr
                 INNER JOIN repairs r ON rr.repair_id = r.id
                 WHERE r.created_by = ? AND r.branch_id = ?" . $dateFilter,
                array_merge([$technician['id'], $branchId], $dateParams)
            );
            
            if ($monthlyRating && isset($monthlyRating['avg_rating']) && $monthlyRating['avg_rating'] !== null) {
                $technician['monthly_avg_rating'] = round(floatval($monthlyRating['avg_rating']), 2);
                $technician['monthly_ratings'] = intval($monthlyRating['total_ratings']);
            } else {
                $technician['monthly_avg_rating'] = 0;
                $technician['monthly_ratings'] = 0;
            }
        } else {
            $technician['monthly_avg_rating'] = 0;
            $technician['monthly_ratings'] = 0;
        }
        
        // جلب عدد العمليات المكتملة للفني (تراكمي)
        // تخطي جلب العمليات المكتملة إذا كان branchId هو null
        if ($branchId !== null) {
            $completedRepairs = dbSelectOne(
                "SELECT COUNT(*) as count
                 FROM repairs
                 WHERE created_by = ? AND branch_id = ? AND status = 'delivered'",
                [$technician['id'], $branchId]
            );
            
            $technician['completed_repairs'] = $completedRepairs ? intval($completedRepairs['count']) : 0;
            
            // جلب عدد العمليات المكتملة للفني (شهري)
            if ($month && !empty($dateFilter)) {
                $monthlyRepairs = dbSelectOne(
                    "SELECT COUNT(*) as count
                     FROM repairs
                     WHERE created_by = ? AND branch_id = ? AND status = 'delivered' 
                     AND DATE(updated_at) >= ? AND DATE(updated_at) <= ?",
                    array_merge([$technician['id'], $branchId], $dateParams)
                );
                
                $technician['monthly_repairs'] = $monthlyRepairs ? intval($monthlyRepairs['count']) : 0;
            } else {
                $technician['monthly_repairs'] = 0;
            }
        } else {
            // عند جلب المالكين فقط، لا توجد عمليات مكتملة مرتبطة بفرع محدد
            $technician['completed_repairs'] = 0;
            $technician['monthly_repairs'] = 0;
        }
    }
    
    response(true, '', $technicians);
}

response(false, 'طريقة الطلب غير مدعومة', null, 405);

<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

/**
 * إنشاء جدول تقييمات الصيانة إذا لم يكن موجوداً
 */
function createRepairRatingsTable() {
    $query = "
        CREATE TABLE IF NOT EXISTS `repair_ratings` (
            `id` varchar(50) NOT NULL,
            `repair_id` varchar(50) DEFAULT NULL,
            `repair_number` varchar(50) NOT NULL,
            `repair_rating` tinyint(1) NOT NULL DEFAULT 5,
            `technician_rating` tinyint(1) NOT NULL DEFAULT 5,
            `comment` text DEFAULT NULL,
            `created_at` datetime NOT NULL,
            `updated_at` datetime DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_repair_id` (`repair_id`),
            KEY `idx_repair_number` (`repair_number`),
            KEY `idx_created_at` (`created_at`),
            CONSTRAINT `repair_ratings_ibfk_1` FOREIGN KEY (`repair_id`) REFERENCES `repairs` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    dbExecute($query, []);
}

// قراءة تقييم عملية صيانة
if ($method === 'GET') {
    $repairId = $_GET['repair_id'] ?? null;
    $repairNumber = $_GET['repair_number'] ?? null;
    $technicianId = $_GET['technician_id'] ?? null;
    
    // ✅ إذا كان هناك technician_id، جلب تقييمات الفني
    if ($technicianId) {
        // ✅ التحقق من وجود parameter "detailed" - إذا كان موجوداً، جلب التفاصيل (يتطلب auth)
        $detailed = isset($_GET['detailed']) && $_GET['detailed'] === 'true';
        
        if ($detailed) {
            // جلب جميع التقييمات التفصيلية (للمالك في dashboard) - يتطلب auth
            checkAuth();
            
            $ratings = dbSelect(
                "SELECT rr.*, r.repair_number, r.customer_name, r.customer_phone, r.created_at as repair_created_at
                 FROM repair_ratings rr
                 INNER JOIN repairs r ON rr.repair_id = r.id
                 WHERE r.created_by = ?
                 ORDER BY rr.created_at DESC",
                [$technicianId]
            );
            
            if ($ratings === false) {
                response(false, 'خطأ في قراءة التقييمات', null, 500);
            }
            
            if (!$ratings || !is_array($ratings)) {
                response(true, 'لا توجد تقييمات', []);
            }
            
            response(true, '', $ratings);
        } else {
            // ✅ جلب التقييم التراكمي فقط (لصفحة تتبع الصيانة العامة) - بدون auth
            // جلب التقييمات التلقائية من repair_ratings
            $rating = dbSelectOne(
                "SELECT 
                    AVG(rr.technician_rating) as avg_rating,
                    COUNT(rr.id) as total_ratings
                 FROM repair_ratings rr
                 INNER JOIN repairs r ON rr.repair_id = r.id
                 WHERE r.created_by = ?",
                [$technicianId]
            );
            
            // جلب التقييم اليدوي (من المالك)
            $manualRating = dbSelectOne(
                "SELECT rating FROM technician_manual_ratings 
                 WHERE technician_id = ? 
                 ORDER BY created_at DESC LIMIT 1",
                [$technicianId]
            );
            
            if ($rating === false) {
                response(false, 'خطأ في قراءة التقييم', null, 500);
            }
            
            $finalRating = 0;
            $totalRatings = 0;
            
            if ($rating && isset($rating['avg_rating']) && $rating['avg_rating'] !== null) {
                $autoRating = round(floatval($rating['avg_rating']), 2);
                $totalRatings = intval($rating['total_ratings']);
                
                // إذا كان هناك تقييم يدوي، دمجه مع التقييم التلقائي (70% تلقائي + 30% يدوي)
                if ($manualRating && isset($manualRating['rating'])) {
                    $manualRatingValue = intval($manualRating['rating']);
                    $finalRating = round(($autoRating * 0.7) + ($manualRatingValue * 0.3), 2);
                } else {
                    $finalRating = $autoRating;
                }
            } else {
                // إذا لم يكن هناك تقييمات تلقائية، استخدام التقييم اليدوي فقط
                if ($manualRating && isset($manualRating['rating'])) {
                    $finalRating = intval($manualRating['rating']);
                } else {
                    $finalRating = 0;
                }
                $totalRatings = 0;
            }
            
            response(true, '', [
                'avg_rating' => $finalRating,
                'total_ratings' => $totalRatings
            ]);
        }
    }
    
    // ✅ إذا كان هناك repair_id أو repair_number، جلب تقييم العملية
    if (!$repairId && !$repairNumber) {
        response(false, 'معرف العملية أو رقم العملية مطلوب', null, 400);
    }
    
    // بناء الاستعلام
    $query = "SELECT * FROM repair_ratings WHERE 1=1";
    $params = [];
    
    if ($repairId) {
        $query .= " AND repair_id = ?";
        $params[] = $repairId;
    }
    
    if ($repairNumber) {
        $query .= " AND repair_number = ?";
        $params[] = $repairNumber;
    }
    
    $query .= " ORDER BY created_at DESC LIMIT 1";
    
    $rating = dbSelectOne($query, $params);
    
    if ($rating === false) {
        response(false, 'خطأ في قراءة التقييم', null, 500);
    }
    
    if (!$rating) {
        response(true, 'لا يوجد تقييم', null);
    }
    
    response(true, '', $rating);
}

// إضافة أو تحديث تقييم
if ($method === 'POST') {
    // التحقق من وجود الجدول
    createRepairRatingsTable();
    
    $repairId = trim($data['repair_id'] ?? '');
    $repairNumber = trim($data['repair_number'] ?? '');
    $repairRating = intval($data['repair_rating'] ?? 0);
    $technicianRating = intval($data['technician_rating'] ?? 0);
    $comment = trim($data['comment'] ?? '');
    
    // التحقق من البيانات المطلوبة
    if (empty($repairNumber)) {
        response(false, 'رقم العملية مطلوب', null, 400);
    }
    
    if ($repairRating < 1 || $repairRating > 5) {
        response(false, 'تقييم الصيانة يجب أن يكون بين 1 و 5', null, 400);
    }
    
    if ($technicianRating < 1 || $technicianRating > 5) {
        response(false, 'تقييم الفني يجب أن يكون بين 1 و 5', null, 400);
    }
    
    // التحقق من وجود العملية
    if ($repairId) {
        $repair = dbSelectOne("SELECT id FROM repairs WHERE id = ?", [$repairId]);
        if (!$repair) {
            response(false, 'عملية الصيانة غير موجودة', null, 404);
        }
    } else {
        // البحث عن العملية برقمها
        $repair = dbSelectOne("SELECT id FROM repairs WHERE repair_number = ?", [$repairNumber]);
        if ($repair) {
            $repairId = $repair['id'];
        }
    }
    
    // التحقق من وجود تقييم سابق
    $existingRating = dbSelectOne(
        "SELECT id FROM repair_ratings WHERE repair_number = ?",
        [$repairNumber]
    );
    
    if ($existingRating) {
        // ✅ التقييم يكون مرة واحدة فقط - رفض التحديث
        response(false, 'تم إرسال التقييم مسبقاً. لا يمكن تعديل التقييم.', null, 400);
    } else {
        // إضافة تقييم جديد
        $ratingId = generateId();
        
        $result = dbExecute(
            "INSERT INTO repair_ratings (
                id, repair_id, repair_number, repair_rating, 
                technician_rating, comment, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [
                $ratingId,
                $repairId ?: null,
                $repairNumber,
                $repairRating,
                $technicianRating,
                $comment ?: null
            ]
        );
        
        if ($result === false) {
            response(false, 'خطأ في حفظ التقييم', null, 500);
        }
    }
    
    // جلب التقييم المحفوظ
    $savedRating = dbSelectOne("SELECT * FROM repair_ratings WHERE id = ?", [$ratingId]);
    
    response(true, 'تم حفظ التقييم بنجاح', $savedRating);
}

// حذف تقييم
if ($method === 'DELETE') {
    checkAuth();
    
    $ratingId = trim($data['id'] ?? '');
    
    if (empty($ratingId)) {
        response(false, 'معرف التقييم مطلوب', null, 400);
    }
    
    $result = dbExecute("DELETE FROM repair_ratings WHERE id = ?", [$ratingId]);
    
    if ($result === false) {
        response(false, 'خطأ في حذف التقييم', null, 500);
    }
    
    response(true, 'تم حذف التقييم بنجاح');
}

response(false, 'طريقة الطلب غير مدعومة', null, 405);

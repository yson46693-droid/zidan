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
        // تحديث التقييم الموجود
        $result = dbExecute(
            "UPDATE repair_ratings SET 
                repair_id = ?,
                repair_rating = ?,
                technician_rating = ?,
                comment = ?,
                updated_at = NOW()
            WHERE id = ?",
            [
                $repairId ?: null,
                $repairRating,
                $technicianRating,
                $comment ?: null,
                $existingRating['id']
            ]
        );
        
        if ($result === false) {
            response(false, 'خطأ في تحديث التقييم', null, 500);
        }
        
        $ratingId = $existingRating['id'];
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

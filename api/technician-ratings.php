<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// تعديل تقييم فني (للمالك فقط)
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'update_manual') {
    $session = checkAuth();
    $userRole = $session['role'];
    
    // التحقق من أن المستخدم هو مالك
    if ($userRole !== 'admin') {
        response(false, 'هذه الميزة متاحة للمالك فقط', null, 403);
    }
    
    $technicianId = trim($data['technician_id'] ?? '');
    $rating = intval($data['rating'] ?? 0);
    $note = trim($data['note'] ?? '');
    
    // التحقق من البيانات
    if (empty($technicianId)) {
        response(false, 'معرف الفني مطلوب', null, 400);
    }
    
    if ($rating < 1 || $rating > 5) {
        response(false, 'التقييم يجب أن يكون بين 1 و 5', null, 400);
    }
    
    // التحقق من وجود الفني
    $technician = dbSelectOne("SELECT id, name FROM users WHERE id = ? AND role = 'technician'", [$technicianId]);
    if (!$technician) {
        response(false, 'الفني غير موجود', null, 404);
    }
    
    // التحقق من وجود جدول تقييمات الفنيين اليدوية وإنشاؤه إذا لم يكن موجوداً
    if (!dbTableExists('technician_manual_ratings')) {
        $conn = getDBConnection();
        if ($conn) {
            $createTableQuery = "
                CREATE TABLE IF NOT EXISTS `technician_manual_ratings` (
                    `id` varchar(50) NOT NULL,
                    `technician_id` varchar(50) NOT NULL,
                    `rating` tinyint(1) NOT NULL,
                    `note` text DEFAULT NULL,
                    `created_by` varchar(50) NOT NULL,
                    `created_at` datetime NOT NULL,
                    `updated_at` datetime DEFAULT NULL,
                    PRIMARY KEY (`id`),
                    KEY `idx_technician_id` (`technician_id`),
                    KEY `idx_created_at` (`created_at`),
                    CONSTRAINT `technician_manual_ratings_ibfk_1` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            if (!$conn->query($createTableQuery)) {
                error_log('خطأ في إنشاء جدول technician_manual_ratings: ' . $conn->error);
                response(false, 'خطأ في إعداد قاعدة البيانات', null, 500);
            }
        } else {
            response(false, 'فشل الاتصال بقاعدة البيانات', null, 500);
        }
    }
    
    // التحقق من وجود تقييم يدوي سابق للفني
    $existingRating = dbSelectOne(
        "SELECT id FROM technician_manual_ratings WHERE technician_id = ? ORDER BY created_at DESC LIMIT 1",
        [$technicianId]
    );
    
    try {
        if ($existingRating) {
            // تحديث التقييم الموجود
            $result = dbExecute(
                "UPDATE technician_manual_ratings SET 
                    rating = ?,
                    note = ?,
                    updated_at = NOW()
                WHERE id = ?",
                [$rating, $note ?: null, $existingRating['id']]
            );
            
            if ($result === false) {
                global $lastDbError;
                $errorMsg = $lastDbError ?? 'خطأ غير معروف في تحديث التقييم';
                error_log('خطأ في تحديث التقييم: ' . $errorMsg);
                response(false, 'خطأ في تحديث التقييم: ' . $errorMsg, null, 500);
            }
            
            $ratingId = $existingRating['id'];
        } else {
            // إضافة تقييم جديد
            $ratingId = generateId();
            
            $result = dbExecute(
                "INSERT INTO technician_manual_ratings (id, technician_id, rating, note, created_by, created_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())",
                [$ratingId, $technicianId, $rating, $note ?: null, $session['user_id']]
            );
            
            if ($result === false) {
                global $lastDbError;
                $errorMsg = $lastDbError ?? 'خطأ غير معروف في حفظ التقييم';
                error_log('خطأ في حفظ التقييم: ' . $errorMsg);
                response(false, 'خطأ في حفظ التقييم: ' . $errorMsg, null, 500);
            }
        }
        
        // جلب التقييم المحفوظ
        $savedRating = dbSelectOne("SELECT * FROM technician_manual_ratings WHERE id = ?", [$ratingId]);
        
        if (!$savedRating) {
            error_log('تحذير: تم حفظ التقييم لكن فشل جلب البيانات');
            response(false, 'تم حفظ التقييم لكن فشل جلب البيانات', null, 500);
        }
        
        response(true, 'تم تعديل التقييم بنجاح', $savedRating);
    } catch (Exception $e) {
        error_log('خطأ في حفظ/تحديث التقييم: ' . $e->getMessage());
        response(false, 'خطأ في حفظ التقييم: ' . $e->getMessage(), null, 500);
    } catch (Error $e) {
        error_log('خطأ قاتل في حفظ/تحديث التقييم: ' . $e->getMessage());
        response(false, 'خطأ قاتل في حفظ التقييم: ' . $e->getMessage(), null, 500);
    }
}

// جلب التقييم اليدوي للفني
if ($method === 'GET') {
    $technicianId = $_GET['technician_id'] ?? null;
    
    if (!$technicianId) {
        response(false, 'معرف الفني مطلوب', null, 400);
    }
    
    $rating = dbSelectOne(
        "SELECT * FROM technician_manual_ratings 
         WHERE technician_id = ? 
         ORDER BY created_at DESC LIMIT 1",
        [$technicianId]
    );
    
    if (!$rating) {
        response(true, 'لا يوجد تقييم يدوي', null);
    }
    
    response(true, '', $rating);
}

response(false, 'طريقة الطلب غير مدعومة', null, 405);

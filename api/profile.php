<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// التحقق من الجلسة
$session = checkAuth();
$currentUserId = $session['user_id'];

// قراءة بيانات الملف الشخصي للمستخدم الحالي
if ($method === 'GET') {
    try {
        // محاولة جلب avatar مع البيانات (بدون specialization لأنه قد لا يكون موجوداً)
        $user = dbSelectOne(
            "SELECT id, username, name, role, avatar, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        // التأكد من وجود الحقول (تعيين null للأعمدة غير الموجودة)
        if ($user) {
            if (!isset($user['avatar'])) {
                $user['avatar'] = null;
            }
            if (!isset($user['specialization'])) {
                $user['specialization'] = null;
            }
        }
        
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // إزالة الحقول الحساسة إن وجدت
        unset($user['password']);
        
        // التأكد من وجود avatar و specialization (null إذا لم يكن موجوداً)
        if (!isset($user['avatar'])) {
            $user['avatar'] = null;
        }
        if (!isset($user['specialization'])) {
            $user['specialization'] = null;
        }
        
        response(true, '', $user);
    } catch (Exception $e) {
        error_log('خطأ في قراءة الملف الشخصي: ' . $e->getMessage());
        response(false, 'خطأ في قراءة بيانات الملف الشخصي', null, 500);
    }
}

// تحديث بيانات الملف الشخصي للمستخدم الحالي
if ($method === 'PUT') {
    try {
        if (!isset($data['name']) && !isset($data['username']) && !isset($data['password'])) {
            $data = getRequestData();
        }
        
        // التحقق من وجود المستخدم
        $user = dbSelectOne("SELECT id, username FROM users WHERE id = ?", [$currentUserId]);
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        // بناء استعلام التحديث
        $updateFields = [];
        $updateParams = [];
        
        // تحديث الاسم
        if (isset($data['name'])) {
            $name = trim($data['name']);
            if (empty($name)) {
                response(false, 'الاسم لا يمكن أن يكون فارغاً', null, 400);
            }
            $updateFields[] = "name = ?";
            $updateParams[] = $name;
        }
        
        // تحديث اسم المستخدم مع التحقق من عدم التكرار
        if (isset($data['username'])) {
            $username = trim($data['username']);
            if (empty($username)) {
                response(false, 'اسم المستخدم لا يمكن أن يكون فارغاً', null, 400);
            }
            
            // التحقق من أن اسم المستخدم الجديد غير موجود بالفعل (باستثناء المستخدم الحالي)
            $existingUser = dbSelectOne(
                "SELECT id FROM users WHERE username = ? AND id != ?",
                [$username, $currentUserId]
            );
            
            if ($existingUser) {
                response(false, 'اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر', null, 400);
            }
            
            $updateFields[] = "username = ?";
            $updateParams[] = $username;
            
            // تحديث اسم المستخدم في الجلسة أيضاً
            $_SESSION['username'] = $username;
        }
        
        // تحديث كلمة المرور
        if (isset($data['password']) && !empty($data['password'])) {
            $password = $data['password'];
            if (strlen($password) < 6) {
                response(false, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', null, 400);
            }
            $updateFields[] = "password = ?";
            $updateParams[] = password_hash($password, PASSWORD_DEFAULT);
        }
        
        // تحديث التخصص (فقط للفنيين) - مع التحقق من وجود العمود
        if (isset($data['specialization'])) {
            $specialization = trim($data['specialization']);
            // التحقق من أن التخصص صحيح
            if (!empty($specialization) && !in_array($specialization, ['soft', 'hard', 'fast'])) {
                response(false, 'التخصص غير صحيح', null, 400);
            }
            // محاولة التحقق من وجود عمود specialization قبل إضافته للاستعلام
            try {
                $conn = getDBConnection();
                if ($conn) {
                    $checkColumn = $conn->query("SHOW COLUMNS FROM users LIKE 'specialization'");
                    if ($checkColumn && $checkColumn->num_rows > 0) {
                        $updateFields[] = "specialization = ?";
                        $updateParams[] = !empty($specialization) ? $specialization : null;
                    } else {
                        error_log('⚠️ عمود specialization غير موجود في جدول users - سيتم تجاهل التحديث');
                    }
                }
            } catch (Exception $e) {
                error_log('⚠️ خطأ في التحقق من عمود specialization: ' . $e->getMessage());
                // تجاهل الخطأ ومتابعة التحديثات الأخرى
            }
        }
        
        // إذا لم يكن هناك أي تحديثات
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        // إضافة updated_at
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $currentUserId;
        
        // بناء وتنفيذ الاستعلام
        $query = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            error_log('خطأ في تحديث الملف الشخصي للمستخدم: ' . $currentUserId);
            response(false, 'خطأ في تحديث بيانات الملف الشخصي', null, 500);
        }
        
        // الحصول على البيانات المحدثة (بدون specialization لأنه قد لا يكون موجوداً)
        $updatedUser = dbSelectOne(
            "SELECT id, username, name, role, avatar, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        // التأكد من وجود الحقول (تعيين null للأعمدة غير الموجودة)
        if ($updatedUser) {
            if (!isset($updatedUser['avatar'])) {
                $updatedUser['avatar'] = null;
            }
            if (!isset($updatedUser['specialization'])) {
                $updatedUser['specialization'] = null;
            }
        }
        
        // تحديث الجلسة
        if (isset($data['name'])) {
            $_SESSION['name'] = $updatedUser['name'];
        }
        
        response(true, 'تم تحديث بيانات الملف الشخصي بنجاح', $updatedUser);
        
    } catch (Exception $e) {
        error_log('خطأ في تحديث الملف الشخصي: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء تحديث بيانات الملف الشخصي: ' . $e->getMessage(), null, 500);
    }
}

// رفع صورة الملف الشخصي
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'upload_avatar') {
    try {
        $avatarData = $data['avatar_data'] ?? '';
        
        if (empty($avatarData)) {
            response(false, 'بيانات الصورة مطلوبة', null, 400);
        }
        
        // حفظ الصورة
        $avatarPath = saveAvatar($currentUserId, $avatarData);
        
        if (!$avatarPath) {
            response(false, 'فشل في حفظ الصورة', null, 500);
        }
        
        // تحديث مسار الصورة في قاعدة البيانات
        try {
            dbExecute("UPDATE users SET avatar = ? WHERE id = ?", [$avatarPath, $currentUserId]);
        } catch (Exception $e) {
            // إذا لم يكن عمود avatar موجوداً، محاولة إضافته
            error_log('محاولة إضافة عمود avatar: ' . $e->getMessage());
            try {
                $conn = getDBConnection();
                if ($conn) {
                    $conn->query("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL");
                    dbExecute("UPDATE users SET avatar = ? WHERE id = ?", [$avatarPath, $currentUserId]);
                }
            } catch (Exception $e2) {
                error_log('فشل إضافة عمود avatar: ' . $e2->getMessage());
            }
        }
        
        // الحصول على البيانات المحدثة
        $updatedUser = dbSelectOne(
            "SELECT id, username, name, role, avatar, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        response(true, 'تم تحديث صورة الملف الشخصي بنجاح', $updatedUser);
        
    } catch (Exception $e) {
        error_log('خطأ في رفع صورة الملف الشخصي: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء رفع الصورة: ' . $e->getMessage(), null, 500);
    }
}

// حذف صورة الملف الشخصي
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'remove_avatar') {
    try {
        // الحصول على مسار الصورة الحالية
        $user = dbSelectOne("SELECT avatar FROM users WHERE id = ?", [$currentUserId]);
        
        if ($user && !empty($user['avatar'])) {
            // حذف الملف
            $avatarPath = __DIR__ . '/../' . $user['avatar'];
            if (file_exists($avatarPath)) {
                unlink($avatarPath);
            }
        }
        
        // تحديث قاعدة البيانات
        try {
            dbExecute("UPDATE users SET avatar = NULL WHERE id = ?", [$currentUserId]);
        } catch (Exception $e) {
            error_log('خطأ في تحديث قاعدة البيانات: ' . $e->getMessage());
        }
        
        // الحصول على البيانات المحدثة
        $updatedUser = dbSelectOne(
            "SELECT id, username, name, role, avatar, created_at, updated_at FROM users WHERE id = ?",
            [$currentUserId]
        );
        
        response(true, 'تم حذف صورة الملف الشخصي بنجاح', $updatedUser);
        
    } catch (Exception $e) {
        error_log('خطأ في حذف صورة الملف الشخصي: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء حذف الصورة: ' . $e->getMessage(), null, 500);
    }
}

// جلب تقييم الفني (للفنيين فقط)
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_technician_rating') {
    try {
        // التحقق من أن المستخدم فني
        $user = dbSelectOne("SELECT id, role, branch_id FROM users WHERE id = ?", [$currentUserId]);
        if (!$user) {
            response(false, 'المستخدم غير موجود', null, 404);
        }
        
        if ($user['role'] !== 'technician') {
            response(false, 'هذه الميزة متاحة للفنيين فقط', null, 403);
        }
        
        $branchId = $user['branch_id'];
        
        // جلب التقييم التراكمي من repair_ratings
        $autoRating = dbSelectOne(
            "SELECT 
                AVG(rr.technician_rating) as avg_rating, 
                COUNT(rr.id) as total_ratings
             FROM repair_ratings rr
             INNER JOIN repairs r ON rr.repair_id = r.id
             WHERE r.created_by = ? AND r.branch_id = ?",
            [$currentUserId, $branchId]
        );
        
        // جلب التقييم اليدوي (من المالك) مع الملاحظات
        $manualRating = dbSelectOne(
            "SELECT rating, note, created_at, updated_at 
             FROM technician_manual_ratings 
             WHERE technician_id = ? 
             ORDER BY created_at DESC LIMIT 1",
            [$currentUserId]
        );
        
        // حساب التقييم النهائي
        $finalRating = 0;
        $hasAutoRating = false;
        $hasManualRating = false;
        
        if ($autoRating && isset($autoRating['avg_rating']) && $autoRating['avg_rating'] !== null) {
            $autoRatingValue = round(floatval($autoRating['avg_rating']), 2);
            $totalRatings = intval($autoRating['total_ratings']);
            $hasAutoRating = true;
            
            // إذا كان هناك تقييم يدوي، دمجه مع التقييم التلقائي (70% تلقائي + 30% يدوي)
            if ($manualRating && isset($manualRating['rating'])) {
                $manualRatingValue = intval($manualRating['rating']);
                $finalRating = round(($autoRatingValue * 0.7) + ($manualRatingValue * 0.3), 2);
                $hasManualRating = true;
            } else {
                $finalRating = $autoRatingValue;
            }
        } else {
            // إذا لم يكن هناك تقييمات تلقائية، استخدام التقييم اليدوي فقط
            if ($manualRating && isset($manualRating['rating'])) {
                $finalRating = intval($manualRating['rating']);
                $hasManualRating = true;
            }
        }
        
        response(true, '', [
            'final_rating' => $finalRating,
            'auto_rating' => $hasAutoRating ? round(floatval($autoRating['avg_rating']), 2) : null,
            'total_ratings' => $hasAutoRating ? intval($autoRating['total_ratings']) : 0,
            'manual_rating' => $hasManualRating ? intval($manualRating['rating']) : null,
            'manual_note' => $hasManualRating ? ($manualRating['note'] ?? null) : null,
            'manual_rating_date' => $hasManualRating ? ($manualRating['updated_at'] ?? $manualRating['created_at'] ?? null) : null,
            'has_manual_rating' => $hasManualRating,
            'has_auto_rating' => $hasAutoRating
        ]);
        
    } catch (Exception $e) {
        error_log('خطأ في جلب تقييم الفني: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء جلب التقييم: ' . $e->getMessage(), null, 500);
    }
}

// التحقق من توفر اسم المستخدم (للتحقق الفوري في الواجهة)
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'check_username') {
    try {
        $username = trim($data['username'] ?? '');
        
        if (empty($username)) {
            response(false, 'اسم المستخدم فارغ', ['available' => false], 400);
        }
        
        // التحقق من أن اسم المستخدم غير موجود (باستثناء المستخدم الحالي)
        $existingUser = dbSelectOne(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            [$username, $currentUserId]
        );
        
        if ($existingUser) {
            response(true, 'اسم المستخدم موجود مسبقاً', ['available' => false], 200);
        } else {
            response(true, 'اسم المستخدم متاح', ['available' => true], 200);
        }
        
    } catch (Exception $e) {
        error_log('خطأ في التحقق من اسم المستخدم: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء التحقق من اسم المستخدم', null, 500);
    }
}

/**
 * حفظ صورة الملف الشخصي
 */
function saveAvatar($userId, $avatarData) {
    try {
        // تحديد المجلد
        $avatarsDir = __DIR__ . '/../avatars/';
        
        // التأكد من وجود المجلد
        if (!file_exists($avatarsDir)) {
            mkdir($avatarsDir, 0755, true);
        }
        
        // تنظيف بيانات Base64
        $avatarData = preg_replace('/^data:[^;]+;base64,/', '', $avatarData);
        $avatarData = base64_decode($avatarData);
        
        if ($avatarData === false) {
            throw new Exception('بيانات الصورة غير صحيحة');
        }
        
        // إنشاء اسم الملف
        $filename = 'avatar_' . $userId . '_' . time() . '.jpg';
        $filepath = $avatarsDir . $filename;
        
        // حفظ الصورة
        if (file_put_contents($filepath, $avatarData) === false) {
            throw new Exception('فشل في حفظ الصورة');
        }
        
        // ضغط وتحسين الصورة
        optimizeAvatarImage($filepath);
        
        // حذف الصورة القديمة إن وجدت
        $oldAvatars = glob($avatarsDir . 'avatar_' . $userId . '_*.jpg');
        foreach ($oldAvatars as $oldAvatar) {
            if ($oldAvatar !== $filepath && file_exists($oldAvatar)) {
                unlink($oldAvatar);
            }
        }
        
        // إرجاع المسار النسبي
        return 'avatars/' . $filename;
        
    } catch (Exception $e) {
        error_log('خطأ في saveAvatar: ' . $e->getMessage());
        return null;
    }
}

/**
 * تحسين وضغط صورة الملف الشخصي
 */
function optimizeAvatarImage($filepath) {
    try {
        // التحقق من وجود GD extension
        if (!function_exists('imagecreatefromstring')) {
            return;
        }
        
        // قراءة الصورة
        $imageData = file_get_contents($filepath);
        $image = imagecreatefromstring($imageData);
        
        if (!$image) {
            return;
        }
        
        // تحديد الحجم الأقصى (200x200)
        $maxWidth = 200;
        $maxHeight = 200;
        
        $width = imagesx($image);
        $height = imagesy($image);
        
        // حساب الحجم الجديد مع الحفاظ على النسبة
        if ($width > $maxWidth || $height > $maxHeight) {
            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);
            
            // إنشاء صورة جديدة
            $newImage = imagecreatetruecolor($newWidth, $newHeight);
            
            // الحفاظ على الشفافية للـ PNG
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
            
            // تغيير حجم الصورة
            imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // حفظ الصورة
            imagejpeg($newImage, $filepath, 85);
            
            // تحرير الذاكرة
            imagedestroy($image);
            imagedestroy($newImage);
        } else {
            // إذا كانت الصورة صغيرة، فقط حفظها كـ JPEG
            imagejpeg($image, $filepath, 85);
            imagedestroy($image);
        }
        
    } catch (Exception $e) {
        error_log('خطأ في optimizeAvatarImage: ' . $e->getMessage());
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


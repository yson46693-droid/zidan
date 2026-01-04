<?php
/**
 * API لرفع وإدارة صور الأجهزة
 * تخزين الصور كملفات JPG منفصلة مرتبطة برقم العملية
 */

require_once 'config.php';

// إضافة مسار مجلد الصور
define('IMAGES_DIR', __DIR__ . '/../images/');

// التأكد من وجود مجلد الصور
if (!file_exists(IMAGES_DIR)) {
    mkdir(IMAGES_DIR, 0755, true);
}

$method = getRequestMethod();

// رفع صورة جديدة
if ($method === 'POST') {
    $data = getRequestData();
    
    if (isset($data['action']) && $data['action'] === 'upload_image') {
        checkAuth();
        
        $repairId = $data['repair_id'] ?? '';
        $imageData = $data['image_data'] ?? '';
        
        if (empty($repairId) || empty($imageData)) {
            response(false, 'رقم العملية وبيانات الصورة مطلوبة', null, 400);
        }
        
        try {
            // حذف الصورة القديمة إن وجدت
            deleteOldImage($repairId);
            
            // حفظ الصورة الجديدة
            $imagePath = saveImage($imageData, $repairId);
            
            if ($imagePath) {
                response(true, 'تم رفع الصورة بنجاح', ['image_path' => $imagePath]);
            } else {
                response(false, 'فشل في حفظ الصورة', null, 500);
            }
            
        } catch (Exception $e) {
            response(false, 'خطأ في رفع الصورة: ' . $e->getMessage(), null, 500);
        }
    }
    
    // حذف صورة
    if (isset($data['action']) && $data['action'] === 'delete_image') {
        checkAuth();
        
        $repairId = $data['repair_id'] ?? '';
        
        if (empty($repairId)) {
            response(false, 'رقم العملية مطلوب', null, 400);
        }
        
        try {
            $deleted = deleteOldImage($repairId);
            
            if ($deleted) {
                response(true, 'تم حذف الصورة بنجاح');
            } else {
                response(false, 'الصورة غير موجودة', null, 404);
            }
            
        } catch (Exception $e) {
            response(false, 'خطأ في حذف الصورة: ' . $e->getMessage(), null, 500);
        }
    }
    
    // تنظيف الصور القديمة (أكثر من 6 أشهر)
    if (isset($data['action']) && $data['action'] === 'cleanup_old_images') {
        checkAuth();
        
        try {
            $result = cleanupOldImages(6); // 6 أشهر
            
            if ($result['success']) {
                response(true, $result['message'], [
                    'deleted_count' => $result['deleted_count'],
                    'total_size_freed' => $result['total_size_freed'],
                    'files' => $result['files']
                ]);
            } else {
                response(false, $result['message'], null, 500);
            }
            
        } catch (Exception $e) {
            error_log('خطأ في تنظيف الصور القديمة: ' . $e->getMessage());
            response(false, 'خطأ في تنظيف الصور القديمة: ' . $e->getMessage(), null, 500);
        }
    }
}

// الحصول على صورة
if ($method === 'GET') {
    $repairId = $_GET['repair_id'] ?? '';
    
    if (empty($repairId)) {
        response(false, 'رقم العملية مطلوب', null, 400);
    }
    
    $imagePath = getImagePath($repairId);
    
    if ($imagePath && file_exists($imagePath)) {
        // إرجاع مسار الصورة
        $relativePath = 'images/' . basename($imagePath);
        response(true, 'تم العثور على الصورة', ['image_path' => $relativePath]);
    } else {
        response(false, 'الصورة غير موجودة', null, 404);
    }
}

/**
 * حفظ الصورة كملف JPG
 * @param string $imageData - بيانات الصورة كـ Base64
 * @param string $repairId - رقم العملية
 * @return string|false - مسار الصورة المحفوظة أو false في حالة الفشل
 */
function saveImage($imageData, $repairId) {
    // تنظيف بيانات Base64
    $imageData = preg_replace('/^data:image\/[^;]+;base64,/', '', $imageData);
    $imageData = base64_decode($imageData);
    
    if ($imageData === false) {
        throw new Exception('بيانات الصورة غير صحيحة');
    }
    
    // إنشاء اسم الملف بناءً على رقم العملية
    $filename = 'repair_' . $repairId . '.jpg';
    $filepath = IMAGES_DIR . $filename;
    
    // حفظ الصورة
    $result = file_put_contents($filepath, $imageData);
    
    if ($result === false) {
        throw new Exception('فشل في كتابة الملف');
    }
    
    // ضغط الصورة وتحسين الجودة
    optimizeImage($filepath);
    
    return $filepath;
}

/**
 * حذف الصورة القديمة
 * @param string $repairId - رقم العملية
 * @return bool - true إذا تم الحذف أو لم تكن موجودة
 */
function deleteOldImage($repairId) {
    $filename = 'repair_' . $repairId . '.jpg';
    $filepath = IMAGES_DIR . $filename;
    
    if (file_exists($filepath)) {
        return unlink($filepath);
    }
    
    return true; // الصورة غير موجودة، نعتبرها محذوفة
}

/**
 * الحصول على مسار الصورة
 * @param string $repairId - رقم العملية
 * @return string|null - مسار الصورة أو null إذا لم تكن موجودة
 */
function getImagePath($repairId) {
    $filename = 'repair_' . $repairId . '.jpg';
    $filepath = IMAGES_DIR . $filename;
    
    if (file_exists($filepath)) {
        return $filepath;
    }
    
    return null;
}

/**
 * تحسين الصورة وضغطها
 * @param string $filepath - مسار الصورة
 */
function optimizeImage($filepath) {
    // التحقق من وجود مكتبة GD
    if (!extension_loaded('gd')) {
        return;
    }
    
    // قراءة الصورة
    $imageInfo = getimagesize($filepath);
    if (!$imageInfo) {
        return;
    }
    
    $width = $imageInfo[0];
    $height = $imageInfo[1];
    $mimeType = $imageInfo['mime'];
    
    // إنشاء الصورة من البيانات
    switch ($mimeType) {
        case 'image/jpeg':
            $sourceImage = imagecreatefromjpeg($filepath);
            break;
        case 'image/png':
            $sourceImage = imagecreatefrompng($filepath);
            break;
        case 'image/gif':
            $sourceImage = imagecreatefromgif($filepath);
            break;
        default:
            return;
    }
    
    if (!$sourceImage) {
        return;
    }
    
    // تحديد الحجم الأقصى
    $maxWidth = 800;
    $maxHeight = 600;
    
    // حساب الأبعاد الجديدة
    if ($width > $maxWidth || $height > $maxHeight) {
        $ratio = min($maxWidth / $width, $maxHeight / $height);
        $newWidth = intval($width * $ratio);
        $newHeight = intval($height * $ratio);
        
        // إنشاء صورة جديدة
        $resizedImage = imagecreatetruecolor($newWidth, $newHeight);
        
        // الحفاظ على الشفافية للصور PNG
        if ($mimeType === 'image/png') {
            imagealphablending($resizedImage, false);
            imagesavealpha($resizedImage, true);
            $transparent = imagecolorallocatealpha($resizedImage, 255, 255, 255, 127);
            imagefilledrectangle($resizedImage, 0, 0, $newWidth, $newHeight, $transparent);
        }
        
        // تغيير حجم الصورة
        imagecopyresampled($resizedImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        
        // حفظ الصورة المحسنة
        imagejpeg($resizedImage, $filepath, 85); // جودة 85%
        
        // تنظيف الذاكرة
        imagedestroy($sourceImage);
        imagedestroy($resizedImage);
    } else {
        // إذا كانت الصورة صغيرة، فقط نحسن الجودة
        imagejpeg($sourceImage, $filepath, 85);
        imagedestroy($sourceImage);
    }
}

/**
 * الحصول على معلومات الصورة
 * @param string $repairId - رقم العملية
 * @return array|null - معلومات الصورة أو null إذا لم تكن موجودة
 */
function getImageInfo($repairId) {
    $imagePath = getImagePath($repairId);
    
    if (!$imagePath) {
        return null;
    }
    
    $imageInfo = getimagesize($imagePath);
    if (!$imageInfo) {
        return null;
    }
    
    return [
        'path' => 'images/' . basename($imagePath),
        'size' => filesize($imagePath),
        'width' => $imageInfo[0],
        'height' => $imageInfo[1],
        'mime' => $imageInfo['mime'],
        'created_at' => date('Y-m-d H:i:s', filemtime($imagePath))
    ];
}

/**
 * تنظيف الصور القديمة (أكثر من عدد محدد من الأشهر)
 * @param int $months - عدد الأشهر (افتراضي: 6)
 * @return array - نتائج العملية
 */
function cleanupOldImages($months = 6) {
    try {
        if (!is_dir(IMAGES_DIR)) {
            return [
                'success' => false,
                'message' => 'مجلد الصور غير موجود',
                'deleted_count' => 0,
                'total_size_freed' => 0,
                'files' => []
            ];
        }
        
        // حساب التاريخ المحدد (قبل 6 أشهر)
        $cutoffDate = strtotime("-{$months} months");
        $deletedCount = 0;
        $totalSizeFreed = 0;
        $deletedFiles = [];
        $errors = [];
        
        // قراءة جميع الملفات في مجلد الصور
        $files = scandir(IMAGES_DIR);
        
        if ($files === false) {
            return [
                'success' => false,
                'message' => 'فشل في قراءة مجلد الصور',
                'deleted_count' => 0,
                'total_size_freed' => 0,
                'files' => []
            ];
        }
        
        // تصفية الملفات - فقط ملفات repair_*.jpg
        foreach ($files as $file) {
            // التحقق من أن الملف هو صورة عملية صيانة
            if (!preg_match('/^repair_.+\.jpg$/i', $file)) {
                continue;
            }
            
            $filepath = IMAGES_DIR . $file;
            
            // التحقق من أن الملف موجود ويمكن قراءته
            if (!is_file($filepath) || !is_readable($filepath)) {
                continue;
            }
            
            // الحصول على تاريخ آخر تعديل للملف
            $fileModificationTime = filemtime($filepath);
            
            if ($fileModificationTime === false) {
                $errors[] = "لا يمكن الحصول على تاريخ الملف: {$file}";
                continue;
            }
            
            // التحقق إذا كان الملف أقدم من التاريخ المحدد
            if ($fileModificationTime < $cutoffDate) {
                $fileSize = filesize($filepath);
                
                // محاولة حذف الملف
                if (@unlink($filepath)) {
                    $deletedCount++;
                    $totalSizeFreed += $fileSize;
                    $fileAgeDays = round((time() - $fileModificationTime) / 86400);
                    $deletedFiles[] = [
                        'filename' => $file,
                        'size' => $fileSize,
                        'deleted_at' => date('Y-m-d H:i:s'),
                        'file_age_days' => $fileAgeDays
                    ];
                    
                    // تسجيل عملية الحذف
                    error_log("تم حذف صورة قديمة: {$file} (عمر الملف: {$fileAgeDays} يوم)");
                } else {
                    $errors[] = "فشل في حذف الملف: {$file}";
                }
            }
        }
        
        // بناء رسالة النتيجة
        $message = "تم حذف {$deletedCount} صورة قديمة";
        if ($totalSizeFreed > 0) {
            $message .= " وتحرير " . formatBytes($totalSizeFreed) . " من المساحة";
        }
        
        if (!empty($errors)) {
            $message .= ". حدثت " . count($errors) . " أخطاء أثناء العملية";
            error_log("أخطاء أثناء تنظيف الصور القديمة: " . implode(", ", $errors));
        }
        
        return [
            'success' => true,
            'message' => $message,
            'deleted_count' => $deletedCount,
            'total_size_freed' => $totalSizeFreed,
            'files' => $deletedFiles,
            'errors' => $errors
        ];
        
    } catch (Exception $e) {
        error_log('خطأ في تنظيف الصور القديمة: ' . $e->getMessage());
        return [
            'success' => false,
            'message' => 'خطأ في تنظيف الصور القديمة: ' . $e->getMessage(),
            'deleted_count' => 0,
            'total_size_freed' => 0,
            'files' => []
        ];
    }
}

/**
 * تحويل البايتات إلى تنسيق قابل للقراءة
 * @param int $bytes - حجم الملف بالبايت
 * @param int $precision - دقة الأرقام العشرية
 * @return string - الحجم بصيغة قابلة للقراءة
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    if ($bytes == 0) {
        return '0 B';
    }
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}
?>


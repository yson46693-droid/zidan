<?php
/**
 * سكريبت لإنشاء أيقونات PWA من اللوجو PNG
 * يعمل على الخادم ويستخدم GD library أو ImageMagick
 */

// تجاوز متطلبات config.php للاستخدام من سطر الأوامر
if (php_sapi_name() === 'cli' || !isset($_SERVER['REQUEST_METHOD'])) {
    // لا نحتاج قاعدة البيانات لهذا السكريبت
    if (!defined('DB_HOST')) {
        define('DB_HOST', '');
        define('DB_USER', '');
        define('DB_PASS', '');
        define('DB_NAME', '');
    }
}

// مسار اللوجو الأصلي
$logoPath = __DIR__ . '/vertopal.com_photo_5922357566287580087_y.png';
$iconsDir = __DIR__ . '/icons/';

// الأبعاد المطلوبة للأيقونات
$sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// التحقق من وجود اللوجو
if (!file_exists($logoPath)) {
    die(json_encode(['error' => 'اللوجو غير موجود: ' . $logoPath]));
}

// إنشاء مجلد الأيقونات إذا لم يكن موجوداً
if (!is_dir($iconsDir)) {
    mkdir($iconsDir, 0755, true);
}

// محاولة استخدام GD library
if (extension_loaded('gd')) {
    // قراءة معلومات الصورة
    $imageInfo = getimagesize($logoPath);
    if (!$imageInfo) {
        die(json_encode(['error' => 'فشل قراءة معلومات الصورة']));
    }
    
    $mimeType = $imageInfo['mime'];
    $sourceImage = null;
    
    // قراءة الصورة حسب نوعها
    switch ($mimeType) {
        case 'image/png':
            $sourceImage = imagecreatefrompng($logoPath);
            break;
        case 'image/jpeg':
        case 'image/jpg':
            $sourceImage = imagecreatefromjpeg($logoPath);
            break;
        case 'image/gif':
            $sourceImage = imagecreatefromgif($logoPath);
            break;
        default:
            die(json_encode(['error' => 'نوع الصورة غير مدعوم: ' . $mimeType]));
    }
    
    if (!$sourceImage) {
        die(json_encode(['error' => 'فشل قراءة الصورة']));
    }
    
    $sourceWidth = imagesx($sourceImage);
    $sourceHeight = imagesy($sourceImage);
    
    $created = [];
    $errors = [];
    
    foreach ($sizes as $size) {
        // إنشاء صورة جديدة بالحجم المطلوب
        $newImage = imagecreatetruecolor($size, $size);
        
        // الحفاظ على الشفافية للـ PNG
        imagealphablending($newImage, false);
        imagesavealpha($newImage, true);
        $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
        imagefilledrectangle($newImage, 0, 0, $size, $size, $transparent);
        
        // حساب النسبة للحفاظ على الشكل
        $ratio = min($size / $sourceWidth, $size / $sourceHeight);
        $newWidth = $sourceWidth * $ratio;
        $newHeight = $sourceHeight * $ratio;
        
        // حساب الموضع للتوسيط
        $x = ($size - $newWidth) / 2;
        $y = ($size - $newHeight) / 2;
        
        // تغيير حجم الصورة مع الحفاظ على الجودة
        imagealphablending($newImage, true);
        imagecopyresampled(
            $newImage, 
            $sourceImage, 
            $x, $y, 0, 0, 
            $newWidth, $newHeight, 
            $sourceWidth, $sourceHeight
        );
        
        // حفظ الأيقونة
        $outputPath = $iconsDir . 'icon-' . $size . 'x' . $size . '.png';
        if (imagepng($newImage, $outputPath, 0)) {
            $created[] = $size;
        } else {
            $errors[] = $size;
        }
        
        // تنظيف الذاكرة
        imagedestroy($newImage);
    }
    
    // تنظيف الذاكرة
    imagedestroy($sourceImage);
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'created' => $created,
        'errors' => $errors,
        'message' => 'تم إنشاء ' . count($created) . ' أيقونة بنجاح'
    ]);
    
} else {
    // إذا لم تكن GD متوفرة، حاول استخدام ImageMagick
    if (extension_loaded('imagick')) {
        $created = [];
        $errors = [];
        
        foreach ($sizes as $size) {
            try {
                $imagick = new Imagick($logoPath);
                $imagick->setImageFormat('png');
                
                // حساب النسبة
                $width = $imagick->getImageWidth();
                $height = $imagick->getImageHeight();
                $ratio = min($size / $width, $size / $height);
                $newWidth = $width * $ratio;
                $newHeight = $height * $ratio;
                
                // تغيير الحجم
                $imagick->resizeImage($newWidth, $newHeight, Imagick::FILTER_LANCZOS, 1, true);
                
                // إنشاء canvas جديد بالحجم المطلوب
                $canvas = new Imagick();
                $canvas->newImage($size, $size, new ImagickPixel('transparent'));
                $canvas->setImageFormat('png');
                
                // وضع الصورة في المنتصف
                $x = ($size - $newWidth) / 2;
                $y = ($size - $newHeight) / 2;
                $canvas->compositeImage($imagick, Imagick::COMPOSITE_OVER, $x, $y);
                
                // حفظ
                $outputPath = $iconsDir . 'icon-' . $size . 'x' . $size . '.png';
                if ($canvas->writeImage($outputPath)) {
                    $created[] = $size;
                } else {
                    $errors[] = $size;
                }
                
                $imagick->destroy();
                $canvas->destroy();
            } catch (Exception $e) {
                $errors[] = $size;
            }
        }
        
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'created' => $created,
            'errors' => $errors,
            'message' => 'تم إنشاء ' . count($created) . ' أيقونة بنجاح باستخدام ImageMagick'
        ]);
    } else {
        // إذا لم تكن أي مكتبة متوفرة، أرشد المستخدم لاستخدام الصفحة HTML
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'مكتبة GD و ImageMagick غير متوفرة. يرجى استخدام create-icons.html لإنشاء الأيقونات يدوياً.',
            'alternative' => 'create-icons.html'
        ]);
    }
}
?>

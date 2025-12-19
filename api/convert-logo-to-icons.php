<?php
/**
 * سكريبت لتحويل اللوجو JPG إلى أيقونات PNG بأحجام مختلفة
 * يجب تشغيل هذا السكريبت مرة واحدة لإنشاء الأيقونات من اللوجو
 */

require_once 'config.php';

// مسار اللوجو الأصلي
$logoPath = '../photo_5922357566287580087_y.jpg';
$iconsDir = '../icons/';

// التحقق من وجود مكتبة GD
if (!extension_loaded('gd')) {
    die('مكتبة GD غير مثبتة. يرجى تثبيتها أولاً.');
}

// التحقق من وجود اللوجو
if (!file_exists($logoPath)) {
    die('اللوجو غير موجود: ' . $logoPath);
}

// التحقق من وجود مجلد الأيقونات
if (!is_dir($iconsDir)) {
    mkdir($iconsDir, 0755, true);
}

// قراءة اللوجو
$sourceImage = imagecreatefromjpeg($logoPath);
if (!$sourceImage) {
    die('فشل قراءة اللوجو');
}

// الأبعاد المطلوبة للأيقونات
$sizes = [72, 96, 128, 144, 152, 192, 384, 512];

echo "بدء تحويل اللوجو إلى أيقونات...\n";

foreach ($sizes as $size) {
    // إنشاء صورة جديدة بالحجم المطلوب
    $newImage = imagecreatetruecolor($size, $size);
    
    // الحفاظ على الشفافية
    imagealphablending($newImage, false);
    imagesavealpha($newImage, true);
    $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
    imagefilledrectangle($newImage, 0, 0, $size, $size, $transparent);
    
    // الحصول على أبعاد الصورة الأصلية
    $sourceWidth = imagesx($sourceImage);
    $sourceHeight = imagesy($sourceImage);
    
    // حساب النسبة للحفاظ على الشكل
    $ratio = min($size / $sourceWidth, $size / $sourceHeight);
    $newWidth = $sourceWidth * $ratio;
    $newHeight = $sourceHeight * $ratio;
    
    // حساب الموضع للتوسيط
    $x = ($size - $newWidth) / 2;
    $y = ($size - $newHeight) / 2;
    
    // تغيير حجم الصورة مع الحفاظ على الجودة
    imagecopyresampled(
        $newImage, 
        $sourceImage, 
        $x, $y, 0, 0, 
        $newWidth, $newHeight, 
        $sourceWidth, $sourceHeight
    );
    
    // حفظ الأيقونة
    $outputPath = $iconsDir . 'icon-' . $size . 'x' . $size . '.png';
    imagepng($newImage, $outputPath, 9); // جودة 9 (0-9)
    
    // تنظيف الذاكرة
    imagedestroy($newImage);
    
    echo "تم إنشاء: icon-{$size}x{$size}.png\n";
}

// تنظيف الذاكرة
imagedestroy($sourceImage);

echo "\nتم تحويل اللوجو إلى أيقونات بنجاح!\n";
echo "يمكنك الآن استخدام الأيقونات في manifest.json\n";
?>

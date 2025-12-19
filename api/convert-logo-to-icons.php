<?php
/**
 * سكريبت لتحويل اللوجو JPG إلى أيقونات PNG بأحجام مختلفة
 * يجب تشغيل هذا السكريبت مرة واحدة لإنشاء الأيقونات من اللوجو
 */

// تجاوز متطلبات config.php للاستخدام من سطر الأوامر
if (!defined('DB_HOST')) {
    // لا نحتاج قاعدة البيانات لهذا السكريبت
    define('DB_HOST', '');
    define('DB_USER', '');
    define('DB_PASS', '');
    define('DB_NAME', '');
}

// مسار اللوجو الأصلي (PNG الجديد)
$logoPath = '../vertopal.com_photo_5922357566287580087_y.png';
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

// قراءة اللوجو (PNG أو JPG)
$imageInfo = getimagesize($logoPath);
if (!$imageInfo) {
    die('فشل قراءة معلومات اللوجو: ' . $logoPath);
}

$mimeType = $imageInfo['mime'];
$sourceImage = null;

switch ($mimeType) {
    case 'image/png':
        $sourceImage = imagecreatefrompng($logoPath);
        break;
    case 'image/jpeg':
    case 'image/jpg':
        $sourceImage = imagecreatefromjpeg($logoPath);
        break;
    default:
        die('نوع الصورة غير مدعوم: ' . $mimeType);
}

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
        // استخدام جودة عالية للأيقونات
        imagepng($newImage, $outputPath, 0); // جودة 0 (أفضل جودة، بدون ضغط)
    
    // تنظيف الذاكرة
    imagedestroy($newImage);
    
    echo "تم إنشاء: icon-{$size}x{$size}.png\n";
}

// تنظيف الذاكرة
imagedestroy($sourceImage);

echo "\nتم تحويل اللوجو إلى أيقونات بنجاح!\n";
echo "يمكنك الآن استخدام الأيقونات في manifest.json\n";
?>

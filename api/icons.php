<?php
/**
 * ✅ حل بديل لتقديم ملفات الأيقونات
 * Usage: icons.php?file=icon-192x192.png
 */

// تحديد مجلد الأيقونات
$iconsDir = __DIR__ . '/../icons/';
$allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'];

// الحصول على اسم الملف من المعامل
$fileName = $_GET['file'] ?? '';

// التحقق من اسم الملف
if (empty($fileName)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Missing file parameter';
    exit;
}

// تنظيف اسم الملف - منع directory traversal
$fileName = basename($fileName);
$filePath = $iconsDir . $fileName;

// التحقق من الامتداد المسموح
$extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden file type';
    exit;
}

// التحقق من وجود الملف
if (!file_exists($filePath) || !is_file($filePath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'File not found';
    exit;
}

// تحديد نوع المحتوى
$mimeTypes = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'svg' => 'image/svg+xml',
    'ico' => 'image/x-icon',
    'webp' => 'image/webp'
];

$contentType = $mimeTypes[$extension] ?? 'application/octet-stream';

// إعداد headers
header('Content-Type: ' . $contentType);
header('Cache-Control: public, max-age=31536000, immutable');
header('Expires: ' . gmdate('D, d M Y H:i:s', time() + 31536000) . ' GMT');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');

// إرسال الملف
readfile($filePath);
exit;

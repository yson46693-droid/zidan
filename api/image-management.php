<?php
/**
 * API إدارة نظام الصور والحذف التلقائي
 * يتضمن النسخ الاحتياطية والإشعارات
 */

require_once 'config.php';

// إضافة مسارات النظام
define('IMAGES_DIR', __DIR__ . '/../images/');
define('BACKUP_DIR', IMAGES_DIR . 'backup/');
define('IMAGE_SETTINGS_FILE', DATA_DIR . 'image-storage-settings.json');

// التأكد من وجود المجلدات
if (!file_exists(IMAGES_DIR)) {
    mkdir(IMAGES_DIR, 0755, true);
}
if (!file_exists(BACKUP_DIR)) {
    mkdir(BACKUP_DIR, 0755, true);
}

$method = getRequestMethod();

// الحصول على إعدادات الصور
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_settings') {
    $settings = getImageSettings();
    response(true, 'تم تحميل الإعدادات', $settings);
}

// تحديث إعدادات الصور
if ($method === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_settings') {
    $data = getRequestData();
    $settings = $data['settings'] ?? [];
    
    if (updateImageSettings($settings)) {
        response(true, 'تم تحديث الإعدادات بنجاح');
    } else {
        response(false, 'فشل في تحديث الإعدادات', null, 500);
    }
}

// تشغيل عملية التنظيف اليدوية
if ($method === 'POST' && isset($_POST['action']) && $_POST['action'] === 'manual_cleanup') {
    try {
        $result = performImageCleanup();
        response(true, 'تمت عملية التنظيف بنجاح', $result);
    } catch (Exception $e) {
        response(false, 'خطأ في عملية التنظيف: ' . $e->getMessage(), null, 500);
    }
}

// الحصول على إحصائيات الصور
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_stats') {
    $stats = getImageStats();
    response(true, 'تم تحميل الإحصائيات', $stats);
}

// إنشاء نسخة احتياطية يدوية
if ($method === 'POST' && isset($_POST['action']) && $_POST['action'] === 'create_backup') {
    try {
        $result = createImageBackup();
        response(true, 'تم إنشاء النسخة الاحتياطية بنجاح', $result);
    } catch (Exception $e) {
        response(false, 'خطأ في إنشاء النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

// استعادة نسخة احتياطية
if ($method === 'POST' && isset($_POST['action']) && $_POST['action'] === 'restore_backup') {
    $data = getRequestData();
    $backupFile = $data['backup_file'] ?? '';
    
    if (empty($backupFile)) {
        response(false, 'ملف النسخة الاحتياطية مطلوب', null, 400);
    }
    
    try {
        $result = restoreFromBackup($backupFile);
        response(true, 'تم استعادة النسخة الاحتياطية بنجاح', $result);
    } catch (Exception $e) {
        response(false, 'خطأ في استعادة النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/**
 * الحصول على إعدادات الصور
 * @return array
 */
function getImageSettings() {
    if (!file_exists(IMAGE_SETTINGS_FILE)) {
        // إنشاء الإعدادات الافتراضية
        $defaultSettings = [
            'image_storage_settings' => [
                'auto_delete_enabled' => true,
                'retention_days' => 30,
                'backup_before_delete' => true,
                'notification_enabled' => true,
                'max_storage_size_mb' => 1000,
                'compression_quality' => 85,
                'max_image_dimensions' => ['width' => 800, 'height' => 600],
                'allowed_formats' => ['jpg', 'jpeg', 'png', 'gif'],
                'storage_path' => 'images/',
                'backup_path' => 'images/backup/',
                'last_cleanup_date' => null,
                'total_images_count' => 0,
                'total_storage_size_mb' => 0,
                'images_to_delete_count' => 0,
                'next_cleanup_date' => null
            ],
            'cleanup_history' => [],
            'notifications' => [
                'admin_notifications' => true,
                'cleanup_warnings' => [
                    '7_days_before' => true,
                    '3_days_before' => true,
                    '1_day_before' => true,
                    'cleanup_completed' => true
                ],
                'storage_warnings' => [
                    '80_percent_full' => true,
                    '90_percent_full' => true,
                    '95_percent_full' => true
                ]
            ],
            'backup_settings' => [
                'enabled' => true,
                'backup_retention_days' => 90,
                'auto_backup_before_delete' => true,
                'backup_compression' => true
            ],
            'user_messages' => [
                'auto_delete_notice' => 'النظام يحذف الصور المخزنة للأجهزة تلقائياً بعد مرور 30 يوم على تخزينها. إذا كنت ترغب في الاحتفاظ بالصور يرجى التواصل مع المطور عبر واتساب.',
                'storage_warning' => 'مساحة التخزين قاربت على الامتلاء. سيتم حذف الصور القديمة تلقائياً لتحرير المساحة.',
                'cleanup_scheduled' => 'تم جدولة عملية تنظيف الصور القديمة. سيتم حذف الصور التي مضى عليها أكثر من 30 يوم.',
                'backup_created' => 'تم إنشاء نسخة احتياطية من الصور قبل الحذف التلقائي.',
                'images_deleted' => 'تم حذف الصور القديمة بنجاح. تم تحرير مساحة تخزين إضافية.',
                'manual_cleanup' => 'يمكنك تشغيل عملية التنظيف اليدوية من لوحة الإدارة.'
            ],
            'developer_contact' => [
                'whatsapp' => '+201234567890',
                'email' => 'developer@example.com',
                'message_template' => 'مرحباً، أود الاحتفاظ بصور الأجهزة في النظام. يرجى إيقاف الحذف التلقائي للصور.'
            ],
            'system_info' => [
                'version' => '1.0.0',
                'created_date' => date('Y-m-d'),
                'last_updated' => date('Y-m-d'),
                'description' => 'نظام إدارة الصور مع الحذف التلقائي والنسخ الاحتياطية'
            ]
        ];
        
        file_put_contents(IMAGE_SETTINGS_FILE, json_encode($defaultSettings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        return $defaultSettings;
    }
    
    return json_decode(file_get_contents(IMAGE_SETTINGS_FILE), true);
}

/**
 * تحديث إعدادات الصور
 * @param array $newSettings
 * @return bool
 */
function updateImageSettings($newSettings) {
    $currentSettings = getImageSettings();
    
    // دمج الإعدادات الجديدة مع الموجودة
    $updatedSettings = array_merge_recursive($currentSettings, $newSettings);
    $updatedSettings['system_info']['last_updated'] = date('Y-m-d H:i:s');
    
    return file_put_contents(IMAGE_SETTINGS_FILE, json_encode($updatedSettings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
}

/**
 * الحصول على إحصائيات الصور
 * @return array
 */
function getImageStats() {
    $settings = getImageSettings();
    $retentionDays = $settings['image_storage_settings']['retention_days'];
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
    
    $totalImages = 0;
    $totalSize = 0;
    $imagesToDelete = 0;
    $oldImagesSize = 0;
    
    if (is_dir(IMAGES_DIR)) {
        $files = glob(IMAGES_DIR . 'repair_*.jpg');
        
        foreach ($files as $file) {
            $totalImages++;
            $fileSize = filesize($file);
            $totalSize += $fileSize;
            
            $fileTime = filemtime($file);
            if ($fileTime < strtotime($cutoffDate)) {
                $imagesToDelete++;
                $oldImagesSize += $fileSize;
            }
        }
    }
    
    return [
        'total_images' => $totalImages,
        'total_size_mb' => round($totalSize / (1024 * 1024), 2),
        'images_to_delete' => $imagesToDelete,
        'old_images_size_mb' => round($oldImagesSize / (1024 * 1024), 2),
        'retention_days' => $retentionDays,
        'cutoff_date' => $cutoffDate,
        'next_cleanup_date' => date('Y-m-d H:i:s', strtotime("+1 day")),
        'storage_usage_percent' => round(($totalSize / (1024 * 1024)) / $settings['image_storage_settings']['max_storage_size_mb'] * 100, 2)
    ];
}

/**
 * تنفيذ عملية تنظيف الصور
 * @return array
 */
function performImageCleanup() {
    $settings = getImageSettings();
    $retentionDays = $settings['image_storage_settings']['retention_days'];
    $backupBeforeDelete = $settings['image_storage_settings']['backup_before_delete'];
    
    $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
    $deletedCount = 0;
    $deletedSize = 0;
    $backupCreated = false;
    
    // إنشاء نسخة احتياطية إذا كان مفعلاً
    if ($backupBeforeDelete) {
        $backupCreated = createImageBackup();
    }
    
    if (is_dir(IMAGES_DIR)) {
        $files = glob(IMAGES_DIR . 'repair_*.jpg');
        
        foreach ($files as $file) {
            $fileTime = filemtime($file);
            
            if ($fileTime < strtotime($cutoffDate)) {
                $fileSize = filesize($file);
                
                if (unlink($file)) {
                    $deletedCount++;
                    $deletedSize += $fileSize;
                }
            }
        }
    }
    
    // تحديث الإعدادات
    $settings['image_storage_settings']['last_cleanup_date'] = date('Y-m-d H:i:s');
    $settings['image_storage_settings']['total_images_count'] -= $deletedCount;
    $settings['image_storage_settings']['total_storage_size_mb'] -= round($deletedSize / (1024 * 1024), 2);
    
    // إضافة إلى تاريخ التنظيف
    $settings['cleanup_history'][] = [
        'date' => date('Y-m-d H:i:s'),
        'deleted_count' => $deletedCount,
        'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2),
        'backup_created' => $backupCreated
    ];
    
    // الاحتفاظ بآخر 50 عملية تنظيف فقط
    if (count($settings['cleanup_history']) > 50) {
        $settings['cleanup_history'] = array_slice($settings['cleanup_history'], -50);
    }
    
    updateImageSettings($settings);
    
    return [
        'deleted_count' => $deletedCount,
        'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2),
        'backup_created' => $backupCreated,
        'cleanup_date' => date('Y-m-d H:i:s')
    ];
}

/**
 * إنشاء نسخة احتياطية من الصور
 * @return bool
 */
function createImageBackup() {
    $backupFileName = 'images_backup_' . date('Y-m-d_H-i-s') . '.zip';
    $backupPath = BACKUP_DIR . $backupFileName;
    
    if (!is_dir(IMAGES_DIR)) {
        return false;
    }
    
    $files = glob(IMAGES_DIR . 'repair_*.jpg');
    
    if (empty($files)) {
        return false;
    }
    
    // إنشاء أرشيف ZIP بسيط
    $zip = new ZipArchive();
    
    if ($zip->open($backupPath, ZipArchive::CREATE) === TRUE) {
        foreach ($files as $file) {
            $zip->addFile($file, basename($file));
        }
        $zip->close();
        
        // تحديث الإعدادات
        $settings = getImageSettings();
        $settings['backup_settings']['last_backup_date'] = date('Y-m-d H:i:s');
        $settings['backup_settings']['last_backup_file'] = $backupFileName;
        updateImageSettings($settings);
        
        return true;
    }
    
    return false;
}

/**
 * استعادة من نسخة احتياطية
 * @param string $backupFile
 * @return array
 */
function restoreFromBackup($backupFile) {
    $backupPath = BACKUP_DIR . $backupFile;
    
    if (!file_exists($backupPath)) {
        throw new Exception('ملف النسخة الاحتياطية غير موجود');
    }
    
    $zip = new ZipArchive();
    
    if ($zip->open($backupPath) === TRUE) {
        $restoredCount = 0;
        
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            
            if (preg_match('/^repair_\d+\.jpg$/', $filename)) {
                $zip->extractTo(IMAGES_DIR, $filename);
                $restoredCount++;
            }
        }
        
        $zip->close();
        
        return [
            'restored_count' => $restoredCount,
            'backup_file' => $backupFile,
            'restore_date' => date('Y-m-d H:i:s')
        ];
    }
    
    throw new Exception('فشل في فتح ملف النسخة الاحتياطية');
}

/**
 * التحقق من الحاجة لعملية تنظيف
 * @return bool
 */
function shouldPerformCleanup() {
    $settings = getImageSettings();
    
    if (!$settings['image_storage_settings']['auto_delete_enabled']) {
        return false;
    }
    
    $lastCleanup = $settings['image_storage_settings']['last_cleanup_date'];
    
    if (!$lastCleanup) {
        return true;
    }
    
    // تنظيف يومي
    return strtotime($lastCleanup) < strtotime('-1 day');
}

/**
 * إرسال إشعار للمدير
 * @param string $message
 * @param string $type
 */
function sendAdminNotification($message, $type = 'info') {
    $settings = getImageSettings();
    
    if (!$settings['notifications']['admin_notifications']) {
        return;
    }
    
    // يمكن إضافة نظام إشعارات هنا (إيميل، SMS، إلخ)
    error_log("Image Storage Notification [{$type}]: {$message}");
}
?>



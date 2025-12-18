<?php
require_once 'config.php';

// دوال مساعدة لقراءة وكتابة إعدادات Telegram
function getTelegramConfig() {
    $config = dbSelectOne("SELECT * FROM telegram_backup_config LIMIT 1");
    
    if (!$config) {
        // إنشاء إعدادات افتراضية
        dbExecute(
            "INSERT INTO telegram_backup_config (
                bot_token, chat_id, enabled, backup_interval_hours, notification_enabled,
                backup_prefix, auto_backup_enabled, compress_backup, include_images,
                auto_delete_enabled, retention_days, max_backup_files, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            ['', '', 0, 24, 1, 'backup_', 0, 1, 1, 0, 30, 10]
        );
        $config = dbSelectOne("SELECT * FROM telegram_backup_config LIMIT 1");
    }
    
    return [
        'telegram_bot' => [
            'bot_token' => $config['bot_token'] ?? '',
            'chat_id' => $config['chat_id'] ?? '',
            'enabled' => (bool)($config['enabled'] ?? 0),
            'backup_interval_hours' => intval($config['backup_interval_hours'] ?? 24),
            'notification_enabled' => (bool)($config['notification_enabled'] ?? 1),
            'last_backup_time' => $config['last_backup_time'] ?? null
        ],
        'backup_settings' => [
            'backup_prefix' => $config['backup_prefix'] ?? 'backup_',
            'auto_backup_enabled' => (bool)($config['auto_backup_enabled'] ?? 0),
            'compress_backup' => (bool)($config['compress_backup'] ?? 1),
            'include_images' => (bool)($config['include_images'] ?? 1),
            'auto_delete_enabled' => (bool)($config['auto_delete_enabled'] ?? 0),
            'retention_days' => intval($config['retention_days'] ?? 30),
            'max_backup_files' => intval($config['max_backup_files'] ?? 10),
            'last_cleanup_time' => $config['last_cleanup_time'] ?? null,
            'backup_files' => ['users.json', 'repairs.json', 'customers.json', 'inventory.json', 'expenses.json', 'settings.json']
        ]
    ];
}

function updateTelegramConfig($data) {
    $updateFields = [];
    $updateParams = [];
    
    $fields = [
        'bot_token', 'chat_id', 'enabled', 'backup_interval_hours', 'notification_enabled',
        'backup_prefix', 'auto_backup_enabled', 'compress_backup', 'include_images',
        'auto_delete_enabled', 'retention_days', 'max_backup_files'
    ];
    
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            $updateFields[] = "$field = ?";
            if (in_array($field, ['enabled', 'notification_enabled', 'auto_backup_enabled', 'compress_backup', 'include_images', 'auto_delete_enabled'])) {
                $updateParams[] = (bool)$data[$field] ? 1 : 0;
            } elseif (in_array($field, ['backup_interval_hours', 'retention_days', 'max_backup_files'])) {
                $updateParams[] = intval($data[$field]);
            } else {
                $updateParams[] = $data[$field];
            }
        }
    }
    
    if (!empty($updateFields)) {
        $updateFields[] = "updated_at = NOW()";
        $query = "UPDATE telegram_backup_config SET " . implode(', ', $updateFields) . " LIMIT 1";
        dbExecute($query, $updateParams);
    }
}

$method = getRequestMethod();

// قراءة إعدادات النسخ الاحتياطي
if ($method === 'GET') {
    checkAuth();
    
    $action = $_GET['action'] ?? 'get_config';
    
    if ($action === 'get_config') {
        $config = getTelegramConfig();
        response(true, '', $config);
    }
    
    if ($action === 'get_backup_status') {
        $config = getTelegramConfig();
        $lastBackupTime = $config['telegram_bot']['last_backup_time'];
        $intervalHours = $config['telegram_bot']['backup_interval_hours'];
        
        $status = [
            'enabled' => $config['telegram_bot']['enabled'],
            'last_backup_time' => $lastBackupTime,
            'next_backup_time' => $lastBackupTime ? date('Y-m-d H:i:s', strtotime($lastBackupTime . " +{$intervalHours} hours")) : null,
            'backup_interval_hours' => $intervalHours,
            'bot_configured' => !empty($config['telegram_bot']['bot_token']) && !empty($config['telegram_bot']['chat_id'])
        ];
        
        response(true, '', $status);
    }
    
    if ($action === 'list_backups') {
        $backupDir = BACKUP_DIR;
        $backups = [];
        
        if (is_dir($backupDir)) {
            $files = scandir($backupDir);
            foreach ($files as $file) {
                if (strpos($file, 'backup_') === 0 && (strpos($file, '.zip') !== false || is_dir($backupDir . $file))) {
                    $filePath = $backupDir . $file;
                    $backups[] = [
                        'filename' => $file,
                        'size' => is_file($filePath) ? filesize($filePath) : getDirectorySize($filePath),
                        'created_at' => date('Y-m-d H:i:s', filemtime($filePath)),
                        'size_formatted' => formatFileSize(is_file($filePath) ? filesize($filePath) : getDirectorySize($filePath)),
                        'is_directory' => is_dir($filePath),
                        'days_old' => floor((time() - filemtime($filePath)) / (24 * 60 * 60))
                    ];
                }
            }
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        usort($backups, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        response(true, '', $backups);
    }
    
    if ($action === 'cleanup_old_backups') {
        $result = cleanupOldBackups();
        if ($result['success']) {
            response(true, $result['message'], $result['data']);
        } else {
            response(false, $result['message'], null, 500);
        }
    }
    
    if ($action === 'get_cleanup_status') {
        $config = getTelegramConfig();
        $backupDir = BACKUP_DIR;
        $oldBackups = [];
        
        if (is_dir($backupDir)) {
            $files = scandir($backupDir);
            foreach ($files as $file) {
                if (strpos($file, 'backup_') === 0) {
                    $filePath = $backupDir . $file;
                    $fileAge = floor((time() - filemtime($filePath)) / (24 * 60 * 60));
                    
                    if ($fileAge >= $config['backup_settings']['retention_days']) {
                        $oldBackups[] = [
                            'filename' => $file,
                            'age_days' => $fileAge,
                            'created_at' => date('Y-m-d H:i:s', filemtime($filePath)),
                            'size_formatted' => formatFileSize(is_file($filePath) ? filesize($filePath) : getDirectorySize($filePath))
                        ];
                    }
                }
            }
        }
        
        $status = [
            'auto_delete_enabled' => $config['backup_settings']['auto_delete_enabled'],
            'retention_days' => $config['backup_settings']['retention_days'],
            'max_backup_files' => $config['backup_settings']['max_backup_files'],
            'last_cleanup_time' => $config['backup_settings']['last_cleanup_time'],
            'old_backups_count' => count($oldBackups),
            'old_backups' => $oldBackups
        ];
        
        response(true, '', $status);
    }
}

// تحديث إعدادات النسخ الاحتياطي
if ($method === 'POST') {
    checkAuth();
    $data = getRequestData();
    
    if (!isset($data['_method'])) {
        $data = getRequestData();
    }
    
    $action = $data['action'] ?? '';
    
    if ($action === 'update_config') {
        $updateData = [];
        
        // تحديث إعدادات البوت
        if (isset($data['bot_token'])) {
            $updateData['bot_token'] = trim($data['bot_token']);
        }
        if (isset($data['chat_id'])) {
            $updateData['chat_id'] = trim($data['chat_id']);
        }
        if (isset($data['enabled'])) {
            $updateData['enabled'] = (bool)$data['enabled'];
        }
        if (isset($data['backup_interval_hours'])) {
            $updateData['backup_interval_hours'] = intval($data['backup_interval_hours']);
        }
        if (isset($data['notification_enabled'])) {
            $updateData['notification_enabled'] = (bool)$data['notification_enabled'];
        }
        
        // تحديث إعدادات النسخ الاحتياطي
        if (isset($data['auto_backup_enabled'])) {
            $updateData['auto_backup_enabled'] = (bool)$data['auto_backup_enabled'];
        }
        if (isset($data['compress_backup'])) {
            $updateData['compress_backup'] = (bool)$data['compress_backup'];
        }
        if (isset($data['include_images'])) {
            $updateData['include_images'] = (bool)$data['include_images'];
        }
        
        updateTelegramConfig($updateData);
        response(true, 'تم تحديث إعدادات النسخ الاحتياطي بنجاح');
    }
    
    if ($action === 'create_backup') {
        $result = createBackup();
        if ($result['success']) {
            response(true, 'تم إنشاء النسخة الاحتياطية بنجاح', $result['data']);
        } else {
            response(false, $result['message'], null, 500);
        }
    }
    
    if ($action === 'send_to_telegram') {
        $backupFile = $data['backup_file'] ?? '';
        if (empty($backupFile)) {
            response(false, 'اسم ملف النسخة الاحتياطية مطلوب', null, 400);
        }
        
        $result = sendBackupToTelegram($backupFile);
        if ($result['success']) {
            response(true, 'تم إرسال النسخة الاحتياطية إلى تليجرام بنجاح');
        } else {
            response(false, $result['message'], null, 500);
        }
    }
    
    if ($action === 'test_telegram') {
        $result = testTelegramConnection();
        if ($result['success']) {
            response(true, 'تم اختبار الاتصال بتليجرام بنجاح');
        } else {
            response(false, $result['message'], null, 500);
        }
    }
}

// حذف نسخة احتياطية
if ($method === 'DELETE') {
    checkPermission('admin');
    $data = getRequestData();
    
    $backupFile = $data['backup_file'] ?? '';
    if (empty($backupFile)) {
        response(false, 'اسم ملف النسخة الاحتياطية مطلوب', null, 400);
    }
    
    $backupPath = BACKUP_DIR . $backupFile;
    if (file_exists($backupPath)) {
        unlink($backupPath);
        response(true, 'تم حذف النسخة الاحتياطية بنجاح');
    } else {
        response(false, 'النسخة الاحتياطية غير موجودة', null, 404);
    }
}

// دالة إنشاء النسخة الاحتياطية
function createBackup() {
    $config = getTelegramConfig();
    $backupSettings = $config['backup_settings'];
    
    $timestamp = date('Y-m-d_H-i-s');
    $backupName = $backupSettings['backup_prefix'] . $timestamp;
    $backupDir = BACKUP_DIR;
    
    // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $backupFiles = [];
    
    // نسخ ملفات JSON
    foreach ($backupSettings['backup_files'] as $file) {
        $sourcePath = DATA_DIR . $file;
        if (file_exists($sourcePath)) {
            $backupFiles[] = $sourcePath;
        }
    }
    
    // نسخ الصور إذا كان مفعلاً
    if ($backupSettings['include_images'] && is_dir('images/')) {
        $backupFiles[] = 'images/';
    }
    
    if (empty($backupFiles)) {
        return ['success' => false, 'message' => 'لا توجد ملفات للنسخ الاحتياطي'];
    }
    
    if ($backupSettings['compress_backup']) {
        // إنشاء ملف ZIP
        $zipFile = $backupDir . $backupName . '.zip';
        $zip = new ZipArchive();
        
        if ($zip->open($zipFile, ZipArchive::CREATE) !== TRUE) {
            return ['success' => false, 'message' => 'فشل في إنشاء ملف ZIP'];
        }
        
        foreach ($backupFiles as $file) {
            if (is_file($file)) {
                $zip->addFile($file, basename($file));
            } elseif (is_dir($file)) {
                addDirectoryToZip($zip, $file, basename($file));
            }
        }
        
        $zip->close();
        $backupFile = $backupName . '.zip';
    } else {
        // نسخ الملفات بدون ضغط
        $backupFolder = $backupDir . $backupName . '/';
        mkdir($backupFolder, 0755, true);
        
        foreach ($backupFiles as $file) {
            if (is_file($file)) {
                copy($file, $backupFolder . basename($file));
            } elseif (is_dir($file)) {
                copyDirectory($file, $backupFolder . basename($file));
            }
        }
        
        $backupFile = $backupName;
    }
    
    // تحديث وقت آخر نسخة احتياطية
    dbExecute("UPDATE telegram_backup_config SET last_backup_time = NOW() LIMIT 1");
    
    // تنظيف النسخ القديمة إذا كان مفعلاً
    $cleanupResult = null;
    if ($backupSettings['auto_delete_enabled']) {
        $cleanupResult = cleanupOldBackups();
    }
    
    return [
        'success' => true,
        'data' => [
            'backup_file' => $backupFile,
            'created_at' => date('Y-m-d H:i:s'),
            'size' => filesize($backupDir . $backupFile),
            'size_formatted' => formatFileSize(filesize($backupDir . $backupFile)),
            'cleanup_result' => $cleanupResult
        ]
    ];
}

// دالة إرسال النسخة الاحتياطية إلى تليجرام
function sendBackupToTelegram($backupFile) {
    $config = getTelegramConfig();
    $botToken = $config['telegram_bot']['bot_token'];
    $chatId = $config['telegram_bot']['chat_id'];
    
    if (empty($botToken) || empty($chatId)) {
        return ['success' => false, 'message' => 'إعدادات بوت تليجرام غير مكتملة'];
    }
    
    $backupPath = BACKUP_DIR . $backupFile;
    if (!file_exists($backupPath)) {
        return ['success' => false, 'message' => 'ملف النسخة الاحتياطية غير موجود'];
    }
    
    $fileSize = filesize($backupPath);
    $maxFileSize = 50 * 1024 * 1024; // 50MB
    
    if ($fileSize > $maxFileSize) {
        return ['success' => false, 'message' => 'حجم الملف كبير جداً للإرسال عبر تليجرام (الحد الأقصى 50MB)'];
    }
    
    $telegramUrl = "https://api.telegram.org/bot{$botToken}/sendDocument";
    
    $postFields = [
        'chat_id' => $chatId,
        'caption' => "📱 نسخة احتياطية من نظام إدارة محل صيانة الهواتف\n📅 التاريخ: " . date('Y-m-d H:i:s') . "\n📊 الحجم: " . formatFileSize($fileSize),
        'document' => new CURLFile($backupPath)
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $telegramUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 300);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if ($result['ok']) {
            return ['success' => true, 'message' => 'تم إرسال النسخة الاحتياطية بنجاح'];
        } else {
            return ['success' => false, 'message' => 'فشل في إرسال النسخة الاحتياطية: ' . $result['description']];
        }
    } else {
        return ['success' => false, 'message' => 'خطأ في الاتصال بتليجرام'];
    }
}

// دالة اختبار الاتصال بتليجرام
function testTelegramConnection() {
    $config = getTelegramConfig();
    $botToken = $config['telegram_bot']['bot_token'];
    $chatId = $config['telegram_bot']['chat_id'];
    
    if (empty($botToken) || empty($chatId)) {
        return ['success' => false, 'message' => 'إعدادات بوت تليجرام غير مكتملة'];
    }
    
    $telegramUrl = "https://api.telegram.org/bot{$botToken}/sendMessage";
    
    $postFields = [
        'chat_id' => $chatId,
        'text' => "🔧 اختبار الاتصال من نظام إدارة محل صيانة الهواتف\n✅ تم الاتصال بنجاح في " . date('Y-m-d H:i:s')
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $telegramUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if ($result['ok']) {
            return ['success' => true, 'message' => 'تم اختبار الاتصال بنجاح'];
        } else {
            return ['success' => false, 'message' => 'فشل في اختبار الاتصال: ' . $result['description']];
        }
    } else {
        return ['success' => false, 'message' => 'خطأ في الاتصال بتليجرام'];
    }
}

// دالة إضافة مجلد إلى ZIP
function addDirectoryToZip($zip, $dir, $zipDir = '') {
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file != '.' && $file != '..') {
            $filePath = $dir . '/' . $file;
            $zipPath = $zipDir ? $zipDir . '/' . $file : $file;
            
            if (is_dir($filePath)) {
                addDirectoryToZip($zip, $filePath, $zipPath);
            } else {
                $zip->addFile($filePath, $zipPath);
            }
        }
    }
}

// دالة نسخ مجلد
function copyDirectory($src, $dst) {
    if (!is_dir($dst)) {
        mkdir($dst, 0755, true);
    }
    
    $files = scandir($src);
    foreach ($files as $file) {
        if ($file != '.' && $file != '..') {
            $srcFile = $src . '/' . $file;
            $dstFile = $dst . '/' . $file;
            
            if (is_dir($srcFile)) {
                copyDirectory($srcFile, $dstFile);
            } else {
                copy($srcFile, $dstFile);
            }
        }
    }
}

// دالة تنظيف النسخ القديمة
function cleanupOldBackups() {
    $config = getTelegramConfig();
    $backupSettings = $config['backup_settings'];
    
    if (!$backupSettings['auto_delete_enabled']) {
        return ['success' => false, 'message' => 'الحذف التلقائي معطل'];
    }
    
    $backupDir = BACKUP_DIR;
    $retentionDays = $backupSettings['retention_days'];
    $maxFiles = $backupSettings['max_backup_files'];
    $deletedFiles = [];
    $deletedSize = 0;
    
    if (!is_dir($backupDir)) {
        return ['success' => false, 'message' => 'مجلد النسخ الاحتياطية غير موجود'];
    }
    
    $files = scandir($backupDir);
    $backupFiles = [];
    
    // جمع جميع ملفات النسخ الاحتياطية
    foreach ($files as $file) {
        if (strpos($file, 'backup_') === 0) {
            $filePath = $backupDir . $file;
            $backupFiles[] = [
                'filename' => $file,
                'path' => $filePath,
                'created_at' => filemtime($filePath),
                'size' => is_file($filePath) ? filesize($filePath) : getDirectorySize($filePath)
            ];
        }
    }
    
    // ترتيب حسب التاريخ (الأقدم أولاً)
    usort($backupFiles, function($a, $b) {
        return $a['created_at'] - $b['created_at'];
    });
    
    $currentTime = time();
    $deletedCount = 0;
    
    foreach ($backupFiles as $file) {
        $fileAge = floor(($currentTime - $file['created_at']) / (24 * 60 * 60));
        
        // حذف الملفات القديمة حسب العمر أو العدد
        if ($fileAge >= $retentionDays || count($backupFiles) - $deletedCount > $maxFiles) {
            if (is_file($file['path'])) {
                if (unlink($file['path'])) {
                    $deletedFiles[] = $file['filename'];
                    $deletedSize += $file['size'];
                    $deletedCount++;
                }
            } elseif (is_dir($file['path'])) {
                if (deleteDirectory($file['path'])) {
                    $deletedFiles[] = $file['filename'];
                    $deletedSize += $file['size'];
                    $deletedCount++;
                }
            }
        }
    }
    
    // تحديث وقت آخر تنظيف
    dbExecute("UPDATE telegram_backup_config SET last_cleanup_time = NOW() LIMIT 1");
    
    $message = "تم حذف {$deletedCount} نسخة احتياطية قديمة";
    if ($deletedSize > 0) {
        $message .= " (تم توفير " . formatFileSize($deletedSize) . ")";
    }
    
    return [
        'success' => true,
        'message' => $message,
        'data' => [
            'deleted_count' => $deletedCount,
            'deleted_files' => $deletedFiles,
            'freed_space' => $deletedSize,
            'freed_space_formatted' => formatFileSize($deletedSize)
        ]
    ];
}

// دالة حذف مجلد
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file != '.' && $file != '..') {
            $filePath = $dir . '/' . $file;
            if (is_dir($filePath)) {
                deleteDirectory($filePath);
            } else {
                unlink($filePath);
            }
        }
    }
    
    return rmdir($dir);
}

// دالة حساب حجم المجلد
function getDirectorySize($dir) {
    $size = 0;
    if (is_dir($dir)) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if ($file != '.' && $file != '..') {
                $filePath = $dir . '/' . $file;
                if (is_dir($filePath)) {
                    $size += getDirectorySize($filePath);
                } else {
                    $size += filesize($filePath);
                }
            }
        }
    }
    return $size;
}

// دالة تنسيق حجم الملف
function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, 2) . ' ' . $units[$pow];
}

response(false, 'طريقة غير مدعومة', null, 405);
?>


<?php
require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();
$action = $_GET['action'] ?? '';

// ✅ التحقق من _method في البيانات (لطلبات DELETE/PUT المحولة إلى POST)
if ($method === 'POST' && isset($data['_method'])) {
    $method = strtoupper($data['_method']);
}

// ✅ جميع العمليات تحتاج صلاحية admin
checkPermission('admin');

// ✅ مسار مجلد النسخ الاحتياطية
$backupDir = realpath(__DIR__ . '/../backups');
if (!$backupDir || !is_string($backupDir)) {
    $backupDir = __DIR__ . '/../backups';
}

// ✅ إنشاء المجلد إذا لم يكن موجوداً
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0755, true);
}

/* ============== قائمة النسخ الاحتياطية ================= */
if ($method === 'GET' && $action === 'list') {
    try {
        $backups = [];
        
        if (is_dir($backupDir)) {
            $files = scandir($backupDir);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..' || $file === '.htaccess') {
                    continue;
                }
                
                $filePath = $backupDir . DIRECTORY_SEPARATOR . $file;
                
                if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'sql') {
                    $backups[] = [
                        'filename' => $file,
                        'size' => filesize($filePath),
                        'size_mb' => round(filesize($filePath) / (1024 * 1024), 2),
                        'date' => date('Y-m-d H:i:s', filemtime($filePath)),
                        'path' => $filePath
                    ];
                }
            }
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        usort($backups, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        response(true, '', $backups);
    } catch (Exception $e) {
        error_log('خطأ في list backups: ' . $e->getMessage());
        response(false, 'خطأ في جلب قائمة النسخ الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/* ============== إنشاء نسخة احتياطية يدوياً ================= */
if ($method === 'POST' && $action === 'create') {
    try {
        // ✅ استدعاء backup_db.php مع force=1
        $backupScript = __DIR__ . '/backup_db.php';
        
        if (!file_exists($backupScript)) {
            response(false, 'ملف النسخ الاحتياطي غير موجود', null, 404);
        }
        
        // ✅ حفظ وقت قبل إنشاء النسخة الاحتياطية
        $beforeBackupTime = time();
        
        // ✅ تعريف constant للاستدعاء اليدوي (للمنع من استدعاء performBackup تلقائياً)
        if (!defined('BACKUP_MANUAL_MODE')) {
            define('BACKUP_MANUAL_MODE', true);
        }
        
        // ✅ منع أي output
        ob_start();
        
        $backupSuccess = false;
        try {
            // ✅ تحميل backup_db.php (سيتم تخطي الكود التنفيذي في النهاية)
            require_once $backupScript;
            
            // ✅ استدعاء performBackup مباشرة مع force=true
            if (function_exists('performBackup')) {
                $backupSuccess = performBackup(true); // force = true
                error_log('✅ [BACKUP] تم استدعاء performBackup - النتيجة: ' . ($backupSuccess ? 'نجح' : 'فشل'));
            } else {
                error_log('❌ [BACKUP] دالة performBackup غير متاحة بعد تحميل backup_db.php');
                ob_end_clean();
                response(false, 'دالة النسخ الاحتياطي غير متاحة', null, 500);
            }
        } catch (Exception $e) {
            ob_end_clean();
            error_log('❌ [BACKUP] خطأ في استدعاء backup_db.php: ' . $e->getMessage());
            response(false, 'خطأ في إنشاء النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
        } catch (Error $e) {
            ob_end_clean();
            error_log('❌ [BACKUP] خطأ قاتل في استدعاء backup_db.php: ' . $e->getMessage());
            response(false, 'خطأ في إنشاء النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
        }
        
        $output = ob_get_clean();
        
        if (!$backupSuccess) {
            error_log('❌ [BACKUP] فشل إنشاء النسخة الاحتياطية - performBackup عاد false');
            response(false, 'فشل إنشاء النسخة الاحتياطية. تحقق من السجلات للحصول على التفاصيل.', null, 500);
        }
        
        // ✅ قراءة آخر نسخة احتياطية تم إنشاؤها
        $lastBackupFile = __DIR__ . '/../data/last_backup_timestamp.json';
        $lastBackupInfo = null;
        
        if (file_exists($lastBackupFile)) {
            try {
                $backupData = json_decode(file_get_contents($lastBackupFile), true);
                if ($backupData && isset($backupData['date'])) {
                    $lastBackupInfo = [
                        'timestamp' => $backupData['timestamp'] ?? null,
                        'date' => $backupData['date'] ?? null
                    ];
                }
            } catch (Exception $e) {
                error_log('⚠️ [BACKUP] خطأ في قراءة last_backup_timestamp.json: ' . $e->getMessage());
            }
        }
        
        // ✅ البحث عن آخر ملف تم إنشاؤه (بعد وقت البدء)
        $latestFile = null;
        if (is_dir($backupDir)) {
            $files = scandir($backupDir);
            $latestTime = 0;
            foreach ($files as $file) {
                if ($file === '.' || $file === '..' || $file === '.htaccess') {
                    continue;
                }
                
                $filePath = $backupDir . DIRECTORY_SEPARATOR . $file;
                if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'sql') {
                    $fileTime = filemtime($filePath);
                    // ✅ فقط الملفات التي تم إنشاؤها بعد بدء العملية
                    if ($fileTime >= $beforeBackupTime && $fileTime > $latestTime) {
                        $latestTime = $fileTime;
                        $latestFile = [
                            'filename' => $file,
                            'size' => filesize($filePath),
                            'size_mb' => round(filesize($filePath) / (1024 * 1024), 2),
                            'date' => date('Y-m-d H:i:s', $fileTime)
                        ];
                    }
                }
            }
        }
        
        if (!$latestFile) {
            error_log('⚠️ [BACKUP] لم يتم العثور على ملف نسخة احتياطية جديد');
            response(false, 'تم تنفيذ النسخ الاحتياطي لكن لم يتم العثور على ملف جديد. تحقق من السجلات.', null, 500);
        }
        
        response(true, 'تم إنشاء النسخة الاحتياطية بنجاح', [
            'last_backup' => $lastBackupInfo,
            'latest_file' => $latestFile
        ]);
    } catch (Exception $e) {
        error_log('❌ [BACKUP] خطأ في create backup: ' . $e->getMessage());
        response(false, 'خطأ في إنشاء النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/* ============== معلومات النسخة الاحتياطية ================= */
if ($method === 'GET' && $action === 'status') {
    try {
        $lastBackupFile = __DIR__ . '/../data/last_backup_timestamp.json';
        $lastBackup = null;
        
        if (file_exists($lastBackupFile)) {
            try {
                $backupData = json_decode(file_get_contents($lastBackupFile), true);
                if ($backupData && isset($backupData['timestamp'])) {
                    $lastBackup = [
                        'timestamp' => (int)$backupData['timestamp'],
                        'date' => $backupData['date'] ?? date('Y-m-d H:i:s', $backupData['timestamp'])
                    ];
                }
            } catch (Exception $e) {
                error_log('خطأ في قراءة last_backup_timestamp.json: ' . $e->getMessage());
            }
        }
        
        // ✅ حساب الوقت المتبقي للنسخة التالية
        $nextBackupTime = null;
        $hoursRemaining = null;
        
        if ($lastBackup) {
            $nextBackupTimestamp = $lastBackup['timestamp'] + 86400; // 24 ساعة
            $currentTime = time();
            
            if ($currentTime < $nextBackupTimestamp) {
                $hoursRemaining = round(($nextBackupTimestamp - $currentTime) / 3600, 2);
                $nextBackupTime = date('Y-m-d H:i:s', $nextBackupTimestamp);
            } else {
                $nextBackupTime = date('Y-m-d H:i:s', $currentTime); // جاهز الآن
                $hoursRemaining = 0;
            }
        }
        
        // ✅ عدد الملفات في مجلد backups
        $backupCount = 0;
        $totalSize = 0;
        
        if (is_dir($backupDir)) {
            $files = scandir($backupDir);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..' || $file === '.htaccess') {
                    continue;
                }
                
                $filePath = $backupDir . DIRECTORY_SEPARATOR . $file;
                if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'sql') {
                    $backupCount++;
                    $totalSize += filesize($filePath);
                }
            }
        }
        
        response(true, '', [
            'enabled' => true,
            'last_backup' => $lastBackup,
            'next_backup_time' => $nextBackupTime,
            'hours_remaining' => $hoursRemaining,
            'backup_count' => $backupCount,
            'total_size_mb' => round($totalSize / (1024 * 1024), 2)
        ]);
    } catch (Exception $e) {
        error_log('خطأ في get backup status: ' . $e->getMessage());
        response(false, 'خطأ في جلب حالة النسخ الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/* ============== استعادة نسخة احتياطية ================= */
if ($method === 'POST' && $action === 'restore') {
    try {
        $filename = $data['filename'] ?? '';
        
        if (empty($filename)) {
            response(false, 'اسم الملف مطلوب', null, 400);
        }
        
        // ✅ التحقق من أن الملف موجود وآمن
        $filePath = $backupDir . DIRECTORY_SEPARATOR . basename($filename);
        
        if (!file_exists($filePath)) {
            response(false, 'الملف غير موجود', null, 404);
        }
        
        // ✅ التحقق من أن الملف .sql
        if (pathinfo($filePath, PATHINFO_EXTENSION) !== 'sql') {
            response(false, 'الملف يجب أن يكون من نوع .sql', null, 400);
        }
        
        // ✅ قراءة محتوى الملف
        $sqlContent = file_get_contents($filePath);
        
        if ($sqlContent === false) {
            response(false, 'فشل قراءة الملف', null, 500);
        }
        
        // ✅ تنفيذ SQL
        $conn = getDBConnection();
        if (!$conn) {
            response(false, 'فشل الاتصال بقاعدة البيانات', null, 500);
        }
        
        // ✅ تعطيل قيود Foreign Key مؤقتاً قبل الاستعادة
        $conn->query("SET FOREIGN_KEY_CHECKS = 0");
        $conn->query("SET AUTOCOMMIT = 0");
        
        // ✅ تنفيذ SQL في معاملة واحدة
        $conn->begin_transaction();
        
        try {
            // ✅ تقسيم SQL إلى استعلامات منفصلة
            $queries = array_filter(
                array_map('trim', explode(';', $sqlContent)),
                function($query) {
                    $trimmed = trim($query);
                    return !empty($trimmed) && 
                           !preg_match('/^--/', $trimmed) && 
                           !preg_match('/^SET\s+AUTOCOMMIT/i', $trimmed) &&
                           !preg_match('/^SET\s+FOREIGN_KEY_CHECKS/i', $trimmed) &&
                           !preg_match('/^START\s+TRANSACTION/i', $trimmed) &&
                           !preg_match('/^COMMIT/i', $trimmed);
                }
            );
            
            $executed = 0;
            $errors = [];
            
            foreach ($queries as $query) {
                $trimmed = trim($query);
                if (!empty($trimmed)) {
                    // ✅ تخطي استعلامات SET و COMMIT
                    if (preg_match('/^(SET|COMMIT|START)/i', $trimmed)) {
                        continue;
                    }
                    
                    if (!$conn->query($trimmed)) {
                        $error = $conn->error;
                        // ✅ تسجيل الخطأ ولكن نستمر (بعض الأخطاء قد تكون متوقعة)
                        $errors[] = [
                            'query' => substr($trimmed, 0, 100),
                            'error' => $error
                        ];
                        error_log('⚠️ [RESTORE] خطأ في استعلام: ' . substr($trimmed, 0, 200) . ' | الخطأ: ' . $error);
                        
                        // ✅ إذا كان الخطأ متعلق بـ Foreign Key، نتخطاه (لأننا عطلناها)
                        if (strpos($error, 'foreign key') !== false || strpos($error, 'FOREIGN KEY') !== false) {
                            continue;
                        }
                        
                        // ✅ إذا كان الخطأ متعلق بجدول غير موجود، نتخطاه (قد يكون تم حذفه)
                        if (strpos($error, "doesn't exist") !== false || strpos($error, 'Unknown table') !== false) {
                            continue;
                        }
                        
                        // ✅ للأخطاء الأخرى، نرمي exception
                        throw new Exception('خطأ في تنفيذ SQL: ' . $error . ' | Query: ' . substr($trimmed, 0, 200));
                    }
                    $executed++;
                }
            }
            
            $conn->commit();
            
            // ✅ إعادة تفعيل قيود Foreign Key
            $conn->query("SET FOREIGN_KEY_CHECKS = 1");
            $conn->query("SET AUTOCOMMIT = 1");
            
            $message = "تم استعادة النسخة الاحتياطية بنجاح ({$executed} استعلام)";
            if (count($errors) > 0) {
                $message .= " مع " . count($errors) . " تحذير";
            }
            
            response(true, $message, [
                'filename' => $filename,
                'queries_executed' => $executed,
                'warnings' => count($errors)
            ]);
        } catch (Exception $e) {
            // ✅ إعادة تفعيل قيود Foreign Key حتى في حالة الخطأ
            $conn->query("SET FOREIGN_KEY_CHECKS = 1");
            $conn->query("SET AUTOCOMMIT = 1");
            
            $conn->rollback();
            error_log('❌ [RESTORE] خطأ في استعادة النسخة الاحتياطية: ' . $e->getMessage());
            response(false, 'خطأ في استعادة النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
        }
    } catch (Exception $e) {
        error_log('خطأ في restore backup: ' . $e->getMessage());
        response(false, 'خطأ في استعادة النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/* ============== تحميل نسخة احتياطية ================= */
if ($method === 'GET' && $action === 'download') {
    try {
        $filename = $_GET['filename'] ?? '';
        
        if (empty($filename)) {
            response(false, 'اسم الملف مطلوب', null, 400);
        }
        
        // ✅ التحقق من أن الملف موجود وآمن
        $filePath = $backupDir . DIRECTORY_SEPARATOR . basename($filename);
        
        if (!file_exists($filePath)) {
            response(false, 'الملف غير موجود', null, 404);
        }
        
        // ✅ التحقق من أن الملف .sql
        if (pathinfo($filePath, PATHINFO_EXTENSION) !== 'sql') {
            response(false, 'الملف يجب أن يكون من نوع .sql', null, 400);
        }
        
        // ✅ إرسال الملف للتحميل
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        
        readfile($filePath);
        exit;
    } catch (Exception $e) {
        error_log('خطأ في download backup: ' . $e->getMessage());
        response(false, 'خطأ في تحميل النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

/* ============== حذف نسخة احتياطية ================= */
if ($method === 'DELETE') {
    try {
        $filename = $data['filename'] ?? $_GET['filename'] ?? '';
        
        if (empty($filename)) {
            response(false, 'اسم الملف مطلوب', null, 400);
        }
        
        // ✅ التحقق من أن الملف موجود وآمن
        $filePath = $backupDir . DIRECTORY_SEPARATOR . basename($filename);
        
        if (!file_exists($filePath)) {
            response(false, 'الملف غير موجود', null, 404);
        }
        
        // ✅ حذف الملف
        if (@unlink($filePath)) {
            response(true, 'تم حذف النسخة الاحتياطية بنجاح');
        } else {
            response(false, 'فشل حذف الملف', null, 500);
        }
    } catch (Exception $e) {
        error_log('خطأ في delete backup: ' . $e->getMessage());
        response(false, 'خطأ في حذف النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

// ✅ إذا لم يتم تحديد action صحيح
response(false, 'عملية غير صحيحة', null, 400);

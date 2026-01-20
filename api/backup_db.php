<?php
/* =====================================================
   DATABASE BACKUP SCRIPT - DAILY AUTOMATIC BACKUP
   ✅ Database ONLY (.sql)
   Save to ../backups
   Send to Telegram
===================================================== */

// ✅ تحميل إعدادات قاعدة البيانات
// ✅ التأكد من تحميل database.php مرة واحدة فقط
if (!defined('DB_HOST') || !defined('DB_USER') || !defined('DB_PASS') || !defined('DB_NAME')) {
    $databaseFile = __DIR__ . '/database.php';
    if (file_exists($databaseFile)) {
        require_once $databaseFile;
    } else {
        error_log('❌ [BACKUP_DB] ملف database.php غير موجود في: ' . $databaseFile);
    }
}

// ✅ التحقق مرة أخرى بعد التحميل
if (!defined('DB_HOST') || !defined('DB_USER') || !defined('DB_PASS') || !defined('DB_NAME')) {
    error_log('❌ [BACKUP_DB] ثوابت قاعدة البيانات غير معرفة بعد تحميل database.php');
    error_log('❌ [BACKUP_DB] DB_HOST معرف: ' . (defined('DB_HOST') ? 'نعم' : 'لا'));
    error_log('❌ [BACKUP_DB] DB_USER معرف: ' . (defined('DB_USER') ? 'نعم' : 'لا'));
    error_log('❌ [BACKUP_DB] DB_PASS معرف: ' . (defined('DB_PASS') ? 'نعم' : 'لا'));
    error_log('❌ [BACKUP_DB] DB_NAME معرف: ' . (defined('DB_NAME') ? 'نعم' : 'لا'));
}

// ✅ إعدادات قاعدة البيانات - استخدام القيم الافتراضية إذا لم تكن معرفة
$host     = defined('DB_HOST') ? DB_HOST : '';
$user     = defined('DB_USER') ? DB_USER : '';
$password = defined('DB_PASS') ? DB_PASS : '';
$database = defined('DB_NAME') ? DB_NAME : '';

// ✅ دالة لقراءة إعدادات Telegram من قاعدة البيانات أو ملف JSON
function loadTelegramConfig($host, $user, $password, $database) {
    $telegramBotToken = '';
    $telegramChatId   = '';
    
    // ✅ محاولة قراءة من قاعدة البيانات أولاً
    try {
        if (!empty($host) && !empty($user) && !empty($database)) {
            $conn = @new mysqli($host, $user, $password, $database);
            if ($conn && !$conn->connect_error) {
                $conn->set_charset("utf8mb4");
                
                // ✅ التحقق من وجود الجدول أولاً
                $tableCheck = $conn->query("SHOW TABLES LIKE 'telegram_backup_config'");
                if ($tableCheck && $tableCheck->num_rows > 0) {
                    $result = $conn->query("SELECT bot_token, chat_id, enabled FROM telegram_backup_config LIMIT 1");
                    if ($result && $result->num_rows > 0) {
                        $dbConfig = $result->fetch_assoc();
                        if ($dbConfig) {
                            $botToken = $dbConfig['bot_token'] ?? '';
                            $chatId = $dbConfig['chat_id'] ?? '';
                            $enabled = isset($dbConfig['enabled']) ? (bool)$dbConfig['enabled'] : false;
                            
                            // ✅ قراءة الإعدادات فقط إذا كانت موجودة ومفعّلة
                            if (!empty($botToken) && !empty($chatId)) {
                                if ($enabled) {
                                    $telegramBotToken = $botToken;
                                    $telegramChatId = $chatId;
                                    error_log('✅ [BACKUP_DB] تم تحميل إعدادات Telegram من قاعدة البيانات (مفعّلة)');
                                } else {
                                    error_log('⚠️ [BACKUP_DB] إعدادات Telegram موجودة في قاعدة البيانات لكن غير مفعّلة (enabled = 0)');
                                }
                            } else {
                                error_log('⚠️ [BACKUP_DB] إعدادات Telegram موجودة في قاعدة البيانات لكن bot_token أو chat_id فارغ');
                            }
                        }
                    } else {
                        error_log('⚠️ [BACKUP_DB] جدول telegram_backup_config موجود لكن لا توجد بيانات');
                    }
                } else {
                    error_log('⚠️ [BACKUP_DB] جدول telegram_backup_config غير موجود في قاعدة البيانات');
                }
                
                $conn->close();
            } else {
                $connectError = $conn ? $conn->connect_error : 'فشل إنشاء الاتصال';
                error_log('⚠️ [BACKUP_DB] خطأ في الاتصال بقاعدة البيانات لقراءة إعدادات Telegram: ' . $connectError);
            }
        } else {
            error_log('⚠️ [BACKUP_DB] إعدادات قاعدة البيانات غير مكتملة لقراءة إعدادات Telegram');
        }
    } catch (Exception $e) {
        error_log('⚠️ [BACKUP_DB] خطأ في قراءة إعدادات Telegram من قاعدة البيانات: ' . $e->getMessage());
    } catch (Error $e) {
        error_log('⚠️ [BACKUP_DB] خطأ قاتل في قراءة إعدادات Telegram من قاعدة البيانات: ' . $e->getMessage());
    }
    
    // ✅ إذا فشلت قراءة من قاعدة البيانات، محاولة قراءة من ملف JSON (نسخة احتياطية)
    if (empty($telegramBotToken) || empty($telegramChatId)) {
        $telegramConfigFile = __DIR__ . '/../data/telegram-backup-config.json';
        if (file_exists($telegramConfigFile)) {
            try {
                $config = json_decode(file_get_contents($telegramConfigFile), true);
                if ($config) {
                    $botToken = $config['bot_token'] ?? '';
                    $chatId = $config['chat_id'] ?? '';
                    if (!empty($botToken) && !empty($chatId)) {
                        $telegramBotToken = $botToken;
                        $telegramChatId = $chatId;
                        error_log('✅ [BACKUP_DB] تم تحميل إعدادات Telegram من ملف JSON (نسخة احتياطية)');
                    } else {
                        error_log('⚠️ [BACKUP_DB] ملف JSON موجود لكن bot_token أو chat_id فارغ');
                    }
                } else {
                    error_log('⚠️ [BACKUP_DB] ملف JSON موجود لكن البيانات غير صالحة');
                }
            } catch (Exception $e) {
                error_log('⚠️ [BACKUP_DB] خطأ في قراءة ملف JSON: ' . $e->getMessage());
            }
        } else {
            error_log('⚠️ [BACKUP_DB] ملف telegram-backup-config.json غير موجود: ' . $telegramConfigFile);
        }
    }
    
    // ✅ تسجيل النتيجة النهائية
    if (empty($telegramBotToken) || empty($telegramChatId)) {
        error_log('❌ [BACKUP_DB] إعدادات Telegram غير متاحة - bot_token أو chat_id فارغ');
    }
    
    return ['bot_token' => $telegramBotToken, 'chat_id' => $telegramChatId];
}

// ✅ قراءة إعدادات Telegram
$telegramConfig = loadTelegramConfig($host, $user, $password, $database);
$telegramBotToken = $telegramConfig['bot_token'];
$telegramChatId   = $telegramConfig['chat_id'];

/* ============== PATH CONFIG ================= */
// ✅ التأكد من أن المسار دائماً string وليس null
$backupStorePath = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "backups";

// ✅ محاولة استخدام realpath أولاً
$backupStore = @realpath($backupStorePath);

// ✅ إذا فشل realpath (المجلد غير موجود)، استخدام المسار النسبي وتحويله
if ($backupStore === false || !is_string($backupStore) || empty($backupStore)) {
    // ✅ استخدام المسار النسبي وتحويله إلى مسار مطلق بناءً على __DIR__
    $parentDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . "..");
    if ($parentDir && is_string($parentDir)) {
        $backupStore = $parentDir . DIRECTORY_SEPARATOR . "backups";
    } else {
        // ✅ إذا فشل كل شيء، استخدام المسار النسبي
        $backupStore = $backupStorePath;
        // ✅ تحويل المسار إلى مسار مطلق
        $backupStore = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $backupStore);
    }
}

// ✅ التأكد من أن $backupStore string صحيح
if (empty($backupStore) || !is_string($backupStore)) {
    error_log('❌ [BACKUP_DB] فشل تحديد مسار مجلد النسخ الاحتياطية');
    // ✅ استخدام مسار افتراضي
    $backupStore = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "backups";
}

// ✅ تسجيل المسار النهائي للتشخيص
error_log('📁 [BACKUP_DB] مسار مجلد النسخ الاحتياطية: ' . $backupStore);

$lastBackupFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "last_backup_timestamp.json";

/* ============== UTILS ================= */
function sendToTelegram($token, $chatId, $filePath, $caption) {
    if (empty($token) || empty($chatId)) {
        error_log('⚠️ [BACKUP_DB] إعدادات Telegram غير مكتملة - Token أو Chat ID فارغ');
        return false;
    }

    if (!file_exists($filePath)) {
        error_log('❌ [BACKUP_DB] ملف النسخة الاحتياطية غير موجود: ' . $filePath);
        return false;
    }

    try {
        $ch = curl_init("https://api.telegram.org/bot{$token}/sendDocument");
        if (!$ch) {
            error_log('❌ [BACKUP_DB] فشل تهيئة cURL');
            return false;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => [
                'chat_id' => $chatId,
                'caption' => $caption,
                'document' => new CURLFile($filePath)
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 60, // 60 ثانية timeout
            CURLOPT_CONNECTTIMEOUT => 10 // 10 ثواني للاتصال
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        
        curl_close($ch);

        if ($curlError) {
            error_log('❌ [BACKUP_DB] خطأ cURL في إرسال Telegram: ' . $curlError);
            return false;
        }

        if ($httpCode === 200) {
            error_log('✅ [BACKUP_DB] تم إرسال النسخة الاحتياطية إلى Telegram بنجاح');
            return true;
        } else {
            error_log('❌ [BACKUP_DB] فشل إرسال Telegram - HTTP Code: ' . $httpCode);
            if ($response) {
                $responseData = json_decode($response, true);
                if (isset($responseData['description'])) {
                    error_log('❌ [BACKUP_DB] رسالة الخطأ من Telegram: ' . $responseData['description']);
                }
            }
            return false;
        }
    } catch (Exception $e) {
        error_log('❌ [BACKUP_DB] خطأ في إرسال Telegram: ' . $e->getMessage());
        return false;
    }
}

function getLastBackupTimestamp() {
    // ✅ استخدام مسار مباشر بدلاً من global variable
    $lastBackupFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "last_backup_timestamp.json";
    
    if (!file_exists($lastBackupFile)) {
        return null;
    }
    
    try {
        $data = json_decode(file_get_contents($lastBackupFile), true);
        $timestamp = isset($data['timestamp']) ? (int)$data['timestamp'] : null;
        
        // ✅ التحقق من أن timestamp صحيح (أكبر من 0)
        if ($timestamp && $timestamp > 0) {
            return $timestamp;
        }
        
        return null;
    } catch (Exception $e) {
        error_log('⚠️ [BACKUP_DB] خطأ في قراءة last_backup_timestamp.json: ' . $e->getMessage());
        return null;
    }
}

function saveLastBackupTimestamp($timestamp) {
    // ✅ استخدام مسار مباشر بدلاً من global variable
    $lastBackupFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "last_backup_timestamp.json";
    
    // ✅ التحقق من أن timestamp صحيح
    if (empty($timestamp) || !is_numeric($timestamp) || $timestamp <= 0) {
        error_log('⚠️ [BACKUP_DB] timestamp غير صحيح: ' . var_export($timestamp, true));
        return false;
    }
    
    try {
        $dir = dirname($lastBackupFile);
        if (!empty($dir) && is_string($dir) && !is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        
        $result = file_put_contents(
            $lastBackupFile,
            json_encode([
                'timestamp' => (int)$timestamp,
                'date' => date('Y-m-d H:i:s', $timestamp)
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            LOCK_EX // ✅ استخدام file locking لمنع الكتابة المتزامنة
        );
        
        if ($result === false) {
            error_log('❌ [BACKUP_DB] فشل كتابة last_backup_timestamp.json');
            return false;
        }
        
        error_log('✅ [BACKUP_DB] تم حفظ timestamp بنجاح: ' . date('Y-m-d H:i:s', $timestamp));
        return true;
    } catch (Exception $e) {
        error_log('❌ [BACKUP_DB] خطأ في حفظ last_backup_timestamp.json: ' . $e->getMessage());
        return false;
    }
}

function shouldRunBackup($force = false) {
    if ($force) return true;
    
    // ✅ التحقق من وجود lock file (نسخة احتياطية قيد التنفيذ)
    $lockFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "backup_lock.lock";
    if (file_exists($lockFile)) {
        // ✅ التحقق من أن lock file ليس قديماً (أكثر من 10 دقائق = 600 ثانية)
        $lockTime = filemtime($lockFile);
        if ((time() - $lockTime) < 600) {
            error_log('⚠️ [BACKUP_DB] نسخة احتياطية قيد التنفيذ بالفعل (lock file موجود)');
            return false;
        } else {
            // ✅ lock file قديم، حذفه
            @unlink($lockFile);
            error_log('⚠️ [BACKUP_DB] تم حذف lock file القديم');
        }
    }
    
    $last = getLastBackupTimestamp();
    if (!$last) return true;
    
    // ✅ التحقق من مرور 24 ساعة (86400 ثانية)
    $timeSinceLastBackup = time() - $last;
    $shouldRun = $timeSinceLastBackup >= 86400;
    
    if (!$shouldRun) {
        $hoursRemaining = round((86400 - $timeSinceLastBackup) / 3600, 2);
        error_log("ℹ️ [BACKUP_DB] لم يمر 24 ساعة بعد آخر نسخة احتياطية - متبقي: {$hoursRemaining} ساعة");
    }
    
    return $shouldRun;
}

/* ============== CLEANUP OLD BACKUPS ================= */
/**
 * ✅ حذف النسخ الاحتياطية القديمة (أكثر من 5 أيام)
 * @param string $backupDir مسار مجلد النسخ الاحتياطية
 * @param int $days عدد الأيام (افتراضي: 5 أيام)
 * @return array إحصائيات الحذف ['deleted' => عدد الملفات المحذوفة, 'failed' => عدد الملفات الفاشلة]
 */
function cleanupOldBackups($backupDir, $days = 5) {
    $deletedCount = 0;
    $failedCount = 0;
    $deletedFiles = [];
    $failedFiles = [];
    
    // ✅ التحقق من أن المجلد موجود
    if (!is_dir($backupDir)) {
        error_log('⚠️ [BACKUP_DB] مجلد النسخ الاحتياطية غير موجود للتنظيف: ' . $backupDir);
        return ['deleted' => 0, 'failed' => 0];
    }
    
    // ✅ حساب الوقت الفاصل (5 أيام = 432000 ثانية)
    $maxAge = $days * 24 * 60 * 60; // 5 أيام بالثواني
    $currentTime = time();
    
    error_log("🗑️ [BACKUP_DB] بدء تنظيف النسخ الاحتياطية القديمة (أكثر من {$days} أيام)...");
    
    try {
        // ✅ قراءة محتويات المجلد
        $files = @scandir($backupDir);
        if ($files === false) {
            error_log('❌ [BACKUP_DB] فشل قراءة محتويات مجلد النسخ الاحتياطية: ' . $backupDir);
            return ['deleted' => 0, 'failed' => 0];
        }
        
        // ✅ تصفية الملفات (تجاهل . و .. والمجلدات الفرعية)
        $backupFiles = array_filter($files, function($file) use ($backupDir) {
            $fullPath = $backupDir . DIRECTORY_SEPARATOR . $file;
            return $file !== '.' && $file !== '..' && is_file($fullPath);
        });
        
        if (empty($backupFiles)) {
            error_log('ℹ️ [BACKUP_DB] لا توجد ملفات نسخ احتياطية للتحقق منها');
            return ['deleted' => 0, 'failed' => 0];
        }
        
        // ✅ فحص كل ملف وحذفه إذا كان قديماً
        foreach ($backupFiles as $file) {
            $filePath = $backupDir . DIRECTORY_SEPARATOR . $file;
            
            // ✅ الحصول على وقت تعديل الملف
            $fileModifiedTime = @filemtime($filePath);
            
            if ($fileModifiedTime === false) {
                error_log("⚠️ [BACKUP_DB] فشل قراءة وقت تعديل الملف: {$file}");
                $failedCount++;
                $failedFiles[] = $file;
                continue;
            }
            
            // ✅ حساب العمر بالثواني
            $fileAge = $currentTime - $fileModifiedTime;
            
            // ✅ إذا كان الملف أقدم من 5 أيام، احذفه
            if ($fileAge > $maxAge) {
                $fileAgeDays = round($fileAge / (24 * 60 * 60), 2);
                $fileDate = date('Y-m-d H:i:s', $fileModifiedTime);
                
                // ✅ محاولة حذف الملف
                if (@unlink($filePath)) {
                    $deletedCount++;
                    $deletedFiles[] = $file;
                    error_log("✅ [BACKUP_DB] تم حذف نسخة احتياطية قديمة: {$file} (عمرها: {$fileAgeDays} يوم - تاريخ: {$fileDate})");
                } else {
                    $failedCount++;
                    $failedFiles[] = $file;
                    error_log("❌ [BACKUP_DB] فشل حذف نسخة احتياطية قديمة: {$file} (عمرها: {$fileAgeDays} يوم)");
                }
            }
        }
        
        // ✅ تسجيل ملخص النتائج
        if ($deletedCount > 0) {
            error_log("✅ [BACKUP_DB] تم حذف {$deletedCount} ملف نسخة احتياطية قديمة");
            if (!empty($deletedFiles)) {
                error_log("📋 [BACKUP_DB] الملفات المحذوفة: " . implode(', ', $deletedFiles));
            }
        } else {
            error_log("ℹ️ [BACKUP_DB] لا توجد نسخ احتياطية قديمة للحذف (جميع الملفات أحدث من {$days} أيام)");
        }
        
        if ($failedCount > 0) {
            error_log("⚠️ [BACKUP_DB] فشل حذف {$failedCount} ملف نسخة احتياطية");
            if (!empty($failedFiles)) {
                error_log("📋 [BACKUP_DB] الملفات الفاشلة: " . implode(', ', $failedFiles));
            }
        }
        
    } catch (Exception $e) {
        error_log('❌ [BACKUP_DB] خطأ في تنظيف النسخ الاحتياطية القديمة: ' . $e->getMessage());
        error_log('❌ [BACKUP_DB] Stack trace: ' . $e->getTraceAsString());
    } catch (Error $e) {
        error_log('❌ [BACKUP_DB] خطأ قاتل في تنظيف النسخ الاحتياطية القديمة: ' . $e->getMessage());
    }
    
    return ['deleted' => $deletedCount, 'failed' => $failedCount];
}

/* ============== MAIN BACKUP ================= */
function performBackup($force = false) {
    global $host, $user, $password, $database;
    global $backupStore, $telegramBotToken, $telegramChatId;
    
    // ✅ إعادة تحميل إعدادات Telegram إذا كانت فارغة (للتأكد من تحميلها)
    if (empty($telegramBotToken) || empty($telegramChatId)) {
        $reloadedConfig = loadTelegramConfig($host, $user, $password, $database);
        if (!empty($reloadedConfig['bot_token']) && !empty($reloadedConfig['chat_id'])) {
            $telegramBotToken = $reloadedConfig['bot_token'];
            $telegramChatId   = $reloadedConfig['chat_id'];
            error_log('✅ [BACKUP_DB] تم إعادة تحميل إعدادات Telegram بنجاح');
        } else {
            error_log('⚠️ [BACKUP_DB] إعدادات Telegram غير متاحة (فارغة أو معطلة)');
        }
    }

    // ✅ التحقق من الحاجة لعمل نسخة احتياطية
    if (!shouldRunBackup($force)) {
        return false;
    }
    
    // ✅ إنشاء lock file لمنع النسخ المتعددة
    $lockFile = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "backup_lock.lock";
    $lockCreated = false;
    
    // ✅ محاولة إنشاء lock file
    if (!file_exists($lockFile)) {
        try {
            $lockDir = dirname($lockFile);
            if (!is_dir($lockDir)) {
                @mkdir($lockDir, 0755, true);
            }
            if (@file_put_contents($lockFile, time()) !== false) {
                $lockCreated = true;
                error_log('✅ [BACKUP_DB] تم إنشاء lock file لمنع النسخ المتعددة');
            }
        } catch (Exception $e) {
            error_log('⚠️ [BACKUP_DB] فشل إنشاء lock file: ' . $e->getMessage());
        }
    } else {
        // ✅ lock file موجود - نسخة احتياطية قيد التنفيذ
        $lockTime = filemtime($lockFile);
        if ((time() - $lockTime) < 600) { // أقل من 10 دقائق
            error_log('⚠️ [BACKUP_DB] نسخة احتياطية قيد التنفيذ بالفعل - تم تخطي الطلب');
            return false;
        } else {
            // ✅ lock file قديم، حذفه وإنشاء واحد جديد
            @unlink($lockFile);
            try {
                if (@file_put_contents($lockFile, time()) !== false) {
                    $lockCreated = true;
                    error_log('✅ [BACKUP_DB] تم حذف lock file القديم وإنشاء واحد جديد');
                }
            } catch (Exception $e) {
                error_log('⚠️ [BACKUP_DB] فشل إنشاء lock file جديد: ' . $e->getMessage());
            }
        }
    }
    
    // ✅ إذا فشل إنشاء lock file ولم يكن force، نرجع false
    if (!$lockCreated && !$force) {
        error_log('⚠️ [BACKUP_DB] فشل إنشاء lock file - تم تخطي النسخة الاحتياطية');
        return false;
    }
    
    // ✅ دالة تنظيف lock file عند الانتهاء
    $cleanupLock = function() use ($lockFile) {
        if (file_exists($lockFile)) {
            @unlink($lockFile);
            error_log('✅ [BACKUP_DB] تم حذف lock file بعد إكمال النسخة الاحتياطية');
        }
    };
    
    // ✅ تسجيل بدء النسخة الاحتياطية
    error_log('🔄 [BACKUP_DB] بدء إنشاء النسخة الاحتياطية...');
    
    // ✅ استخدام try-finally لضمان حذف lock file حتى في حالة الخطأ
    try {

    // ✅ التحقق من أن $backupStore ليس null أو فارغ
    if (empty($backupStore) || !is_string($backupStore)) {
        error_log('❌ [BACKUP_DB] backupStore غير صحيح: ' . var_export($backupStore, true));
        // ✅ محاولة إصلاح المسار
        $backupStore = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "backups";
        error_log('🔄 [BACKUP_DB] محاولة استخدام مسار بديل: ' . $backupStore);
    }

    // ✅ تحويل المسار إلى مسار مطلق إذا كان نسبياً
    $realPath = realpath($backupStore);
    if ($realPath && is_string($realPath)) {
        $backupStore = $realPath;
    } else {
        // ✅ إذا فشل realpath، استخدام المسار المطلق بناءً على __DIR__
        $parentDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . "..");
        if ($parentDir && is_string($parentDir)) {
            $backupStore = $parentDir . DIRECTORY_SEPARATOR . "backups";
        }
        // إذا فشل كل شيء، نستخدم المسار النسبي كما هو
    }

    // ✅ إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
    if (!is_dir($backupStore)) {
        error_log('🔄 [BACKUP_DB] محاولة إنشاء مجلد النسخ الاحتياطية: ' . $backupStore);
        if (!@mkdir($backupStore, 0755, true)) {
            error_log('❌ [BACKUP_DB] فشل إنشاء مجلد النسخ الاحتياطية: ' . $backupStore);
            // ✅ محاولة استخدام مسار بديل
            $backupStore = __DIR__ . DIRECTORY_SEPARATOR . ".." . DIRECTORY_SEPARATOR . "backups";
            if (!@mkdir($backupStore, 0755, true)) {
                error_log('❌ [BACKUP_DB] فشل إنشاء مجلد النسخ الاحتياطية في المسار البديل أيضاً');
                return false;
            }
        } else {
            error_log('✅ [BACKUP_DB] تم إنشاء مجلد النسخ الاحتياطية: ' . $backupStore);
        }
    }
    
    // ✅ التحقق النهائي من أن المجلد موجود
    if (!is_dir($backupStore)) {
        error_log('❌ [BACKUP_DB] مجلد النسخ الاحتياطية غير موجود بعد المحاولات: ' . $backupStore);
        return false;
    }
    
    error_log('✅ [BACKUP_DB] مسار النسخ الاحتياطية صحيح: ' . $backupStore);

    // ✅ تنظيف النسخ الاحتياطية القديمة (أكثر من 5 أيام) قبل إنشاء النسخة الجديدة
    cleanupOldBackups($backupStore, 5);

    // ✅ التحقق من إعدادات قاعدة البيانات
    if (empty($host) || empty($user) || empty($database)) {
        error_log('❌ [BACKUP_DB] إعدادات قاعدة البيانات غير مكتملة');
        error_log('❌ [BACKUP_DB] DB_HOST: ' . var_export($host, true));
        error_log('❌ [BACKUP_DB] DB_USER: ' . var_export($user, true));
        error_log('❌ [BACKUP_DB] DB_NAME: ' . var_export($database, true));
        error_log('❌ [BACKUP_DB] DB_PASS: ' . (empty($password) ? '(فارغ - مسموح)' : '(محدد)'));
        
        // ✅ محاولة إعادة تحميل database.php
        if (file_exists(__DIR__ . '/database.php')) {
            require_once __DIR__ . '/database.php';
            $host     = defined('DB_HOST') ? DB_HOST : '';
            $user     = defined('DB_USER') ? DB_USER : '';
            $password = defined('DB_PASS') ? DB_PASS : '';
            $database = defined('DB_NAME') ? DB_NAME : '';
            
            // ✅ إعادة التحقق بعد إعادة التحميل
            if (empty($host) || empty($user) || empty($database)) {
                error_log('❌ [BACKUP_DB] فشل إعادة تحميل إعدادات قاعدة البيانات');
                return false;
            } else {
                error_log('✅ [BACKUP_DB] تم إعادة تحميل إعدادات قاعدة البيانات بنجاح');
            }
        } else {
            error_log('❌ [BACKUP_DB] ملف database.php غير موجود في: ' . __DIR__ . '/database.php');
            return false;
        }
    }

    $mysqli = new mysqli($host, $user, $password, $database);
    if ($mysqli->connect_error) {
        error_log("❌ [BACKUP_DB] خطأ في الاتصال بقاعدة البيانات: " . $mysqli->connect_error);
        return false;
    }

    $mysqli->set_charset("utf8mb4");

    $tables = [];
    $q = $mysqli->query("SHOW TABLES");
    while ($r = $q->fetch_row()) $tables[] = $r[0];

    $sql  = "-- Database Backup\n";
    $sql .= "-- Date: " . date("Y-m-d H:i:s") . "\n\n";
    $sql .= "SET AUTOCOMMIT=0;\nSTART TRANSACTION;\n\n";

    foreach ($tables as $table) {
        $sql .= "DROP TABLE IF EXISTS `$table`;\n";
        $create = $mysqli->query("SHOW CREATE TABLE `$table`")->fetch_assoc();
        $sql .= $create['Create Table'] . ";\n\n";

        $rows = $mysqli->query("SELECT * FROM `$table`");
        while ($row = $rows->fetch_assoc()) {
            $cols = array_map(fn($c)=>"`$c`", array_keys($row));
            $vals = array_map(fn($v)=>$v===null ? "NULL" : "'".$mysqli->real_escape_string($v)."'", array_values($row));
            $sql .= "INSERT INTO `$table` (".implode(",", $cols).") VALUES (".implode(",", $vals).");\n";
        }
        $sql .= "\n";
    }

    $sql .= "COMMIT;\n";
    $mysqli->close();

    $fileName = "database_backup_" . date("Y-m-d_H-i-s") . ".sql";
    $filePath = $backupStore . DIRECTORY_SEPARATOR . $fileName;

    // ✅ حفظ ملف SQL
    if (file_put_contents($filePath, $sql) === false) {
        error_log('❌ [BACKUP_DB] فشل حفظ ملف النسخة الاحتياطية: ' . $filePath);
        return false;
    }

    error_log('✅ [BACKUP_DB] تم حفظ ملف النسخة الاحتياطية: ' . $fileName);

    // ✅ إرسال إلى Telegram
    $telegramSent = sendToTelegram(
        $telegramBotToken,
        $telegramChatId,
        $filePath,
        "🗄️ Database Backup\n🗓 " . date("Y-m-d H:i:s")
    );

    if ($telegramSent) {
        error_log('✅ [BACKUP_DB] تم إرسال النسخة الاحتياطية إلى Telegram');
    } else {
        error_log('⚠️ [BACKUP_DB] فشل إرسال النسخة الاحتياطية إلى Telegram (تم حفظها محلياً)');
    }

    // ✅ حفظ تاريخ آخر نسخة احتياطية
    $backupTimestamp = time();
    saveLastBackupTimestamp($backupTimestamp);
    
    error_log('✅ [BACKUP_DB] تم إكمال النسخة الاحتياطية بنجاح في: ' . date('Y-m-d H:i:s', $backupTimestamp));
    
    return true;
    
    } catch (Exception $e) {
        error_log('❌ [BACKUP_DB] خطأ في performBackup: ' . $e->getMessage());
        error_log('❌ [BACKUP_DB] Stack trace: ' . $e->getTraceAsString());
        return false;
    } catch (Error $e) {
        error_log('❌ [BACKUP_DB] خطأ قاتل في performBackup: ' . $e->getMessage());
        return false;
    } finally {
        // ✅ حذف lock file في جميع الحالات (نجاح أو فشل)
        if (isset($cleanupLock)) {
            $cleanupLock();
        } elseif (isset($lockFile) && file_exists($lockFile)) {
            @unlink($lockFile);
            error_log('✅ [BACKUP_DB] تم حذف lock file في finally block');
        }
    }
}

/* ============== EXECUTION ================= */
// ✅ التحقق من أن الملف يتم استدعاؤه مباشرة (وليس من config.php أو database-backup.php)
$isDirectCall = !defined('BACKUP_SILENT_MODE') && !defined('BACKUP_MANUAL_MODE');

// ✅ إذا كان الاستدعاء من config.php أو database-backup.php، لا نطبع output ولا نستدعي performBackup تلقائياً
if (!$isDirectCall) {
    // استدعاء صامت (من config.php أو database-backup.php)
    if (defined('BACKUP_MANUAL_MODE')) {
        error_log('🔄 [BACKUP_DB] تم استدعاء backup_db.php في الوضع اليدوي (من database-backup.php)');
        // ✅ في الوضع اليدوي، لا نستدعي performBackup تلقائياً - سيتم استدعاؤه من database-backup.php
        return; // لا نطبع output ولا نستدعي performBackup
    } else {
        error_log('🔄 [BACKUP_DB] تم استدعاء backup_db.php في الوضع الصامت (من config.php)');
        
        // ✅ تعطيل display_errors لمنع أي output غير متوقع
        $originalDisplayErrors = ini_get('display_errors');
        ini_set('display_errors', '0');
        
        // ✅ منع أي output محتمل
        ob_start();
        
        try {
            $result = performBackup(false);
        } catch (Exception $e) {
            error_log('❌ [BACKUP_DB] خطأ في performBackup: ' . $e->getMessage());
            $result = false;
        } catch (Error $e) {
            error_log('❌ [BACKUP_DB] خطأ قاتل في performBackup: ' . $e->getMessage());
            $result = false;
        }
        
        // ✅ تنظيف أي output
        $output = ob_get_clean();
        if (!empty($output)) {
            error_log('⚠️ [BACKUP_DB] تم اكتشاف output غير متوقع: ' . substr($output, 0, 200));
        }
        
        // ✅ استعادة display_errors
        ini_set('display_errors', $originalDisplayErrors);
        
        if ($result) {
            error_log('✅ [BACKUP_DB] تم إكمال النسخة الاحتياطية بنجاح');
        } else {
            error_log('⚠️ [BACKUP_DB] فشل عمل النسخة الاحتياطية أو تم تخطيها');
        }
        
        return; // لا نطبع output ولا نخرج
    }
}

// ✅ استدعاء مباشر (من URL)
$force = isset($_GET['force']) && $_GET['force'] === '1';

if (performBackup($force)) {
    echo "✅ Database backup completed successfully";
} else {
    echo "ℹ️ Backup skipped or failed (check logs)";
}

exit;

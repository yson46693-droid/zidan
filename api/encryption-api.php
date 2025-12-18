<?php
/**
 * API endpoints لإدارة التشفير
 * يوفر واجهة برمجية لإدارة مفاتيح التشفير والبيانات الحساسة
 */

require_once 'config.php';
require_once 'encryption.php';
require_once 'key-manager.php';

$method = getRequestMethod();
$data = getRequestData();

// إنشاء مفتاح تشفير جديد
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'generate-key') {
    checkPermission('admin');
    
    try {
        $newKey = EncryptionKeyManager::generateNewKey();
        response(true, 'تم إنشاء مفتاح تشفير جديد', ['key' => $newKey]);
    } catch (Exception $e) {
        response(false, 'خطأ في إنشاء مفتاح التشفير: ' . $e->getMessage(), null, 500);
    }
}

// تحديث مفتاح التشفير
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'update-key') {
    checkPermission('admin');
    
    $newKey = $data['key'] ?? '';
    
    if (empty($newKey)) {
        response(false, 'مفتاح التشفير مطلوب', null, 400);
    }
    
    if (!EncryptionKeyManager::validateKey($newKey)) {
        response(false, 'مفتاح التشفير غير صحيح', null, 400);
    }
    
    try {
        EncryptionKeyManager::updateKey($newKey);
        response(true, 'تم تحديث مفتاح التشفير بنجاح');
    } catch (Exception $e) {
        response(false, 'خطأ في تحديث مفتاح التشفير: ' . $e->getMessage(), null, 500);
    }
}

// إعادة تشفير جميع البيانات
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'reencrypt-all') {
    checkPermission('admin');
    
    try {
        $newKey = EncryptionKeyManager::generateNewKey();
        EncryptionKeyManager::reencryptAllData($newKey);
        response(true, 'تم إعادة تشفير جميع البيانات بنجاح');
    } catch (Exception $e) {
        response(false, 'خطأ في إعادة تشفير البيانات: ' . $e->getMessage(), null, 500);
    }
}

// إنشاء نسخة احتياطية من مفتاح التشفير
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'backup-key') {
    checkPermission('admin');
    
    try {
        $backupFile = EncryptionKeyManager::backupKey();
        if ($backupFile) {
            response(true, 'تم إنشاء نسخة احتياطية من مفتاح التشفير', ['backup_file' => $backupFile]);
        } else {
            response(false, 'فشل في إنشاء النسخة الاحتياطية', null, 500);
        }
    } catch (Exception $e) {
        response(false, 'خطأ في إنشاء النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

// قائمة النسخ الاحتياطية
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'list-backups') {
    checkPermission('admin');
    
    try {
        $backups = EncryptionKeyManager::listBackups();
        response(true, 'تم تحميل قائمة النسخ الاحتياطية', ['backups' => $backups]);
    } catch (Exception $e) {
        response(false, 'خطأ في تحميل قائمة النسخ الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

// استعادة مفتاح التشفير من النسخة الاحتياطية
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'restore-backup') {
    checkPermission('admin');
    
    $backupFile = $data['backup_file'] ?? '';
    
    if (empty($backupFile)) {
        response(false, 'ملف النسخة الاحتياطية مطلوب', null, 400);
    }
    
    try {
        $success = EncryptionKeyManager::restoreFromBackup();
        if ($success) {
            response(true, 'تم استعادة مفتاح التشفير من النسخة الاحتياطية');
        } else {
            response(false, 'فشل في استعادة النسخة الاحتياطية', null, 500);
        }
    } catch (Exception $e) {
        response(false, 'خطأ في استعادة النسخة الاحتياطية: ' . $e->getMessage(), null, 500);
    }
}

// تشفير بيانات معينة
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'encrypt-data') {
    checkPermission('admin');
    
    $dataToEncrypt = $data['data'] ?? '';
    $fields = $data['fields'] ?? ['password', 'username', 'email'];
    
    if (empty($dataToEncrypt)) {
        response(false, 'البيانات المراد تشفيرها مطلوبة', null, 400);
    }
    
    try {
        $encryptedData = DataEncryption::encryptArray($dataToEncrypt, $fields);
        response(true, 'تم تشفير البيانات بنجاح', ['encrypted_data' => $encryptedData]);
    } catch (Exception $e) {
        response(false, 'خطأ في تشفير البيانات: ' . $e->getMessage(), null, 500);
    }
}

// فك تشفير بيانات معينة
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'decrypt-data') {
    checkPermission('admin');
    
    $dataToDecrypt = $data['data'] ?? '';
    $fields = $data['fields'] ?? ['password', 'username', 'email'];
    
    if (empty($dataToDecrypt)) {
        response(false, 'البيانات المراد فك تشفيرها مطلوبة', null, 400);
    }
    
    try {
        $decryptedData = DataEncryption::decryptArray($dataToDecrypt, $fields);
        response(true, 'تم فك تشفير البيانات بنجاح', ['decrypted_data' => $decryptedData]);
    } catch (Exception $e) {
        response(false, 'خطأ في فك تشفير البيانات: ' . $e->getMessage(), null, 500);
    }
}

// التحقق من صحة البيانات المشفرة
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'validate-encrypted') {
    checkPermission('admin');
    
    $encryptedData = $data['encrypted_data'] ?? '';
    
    if (empty($encryptedData)) {
        response(false, 'البيانات المشفرة مطلوبة', null, 400);
    }
    
    try {
        $isValid = DataEncryption::isValidEncrypted($encryptedData);
        response(true, 'تم التحقق من صحة البيانات المشفرة', ['is_valid' => $isValid]);
    } catch (Exception $e) {
        response(false, 'خطأ في التحقق من صحة البيانات المشفرة: ' . $e->getMessage(), null, 500);
    }
}

// إحصائيات التشفير
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'encryption-stats') {
    checkPermission('admin');
    
    try {
        $stats = [
            'encryption_enabled' => true,
            'encryption_algorithm' => 'AES-256-GCM',
            'encrypted_fields' => ['password', 'username', 'email'],
            'key_length' => 64,
            'last_key_update' => filemtime(EncryptionKeyManager::$keyFile) ?? null,
            'backup_count' => count(EncryptionKeyManager::listBackups())
        ];
        
        response(true, 'تم تحميل إحصائيات التشفير', $stats);
    } catch (Exception $e) {
        response(false, 'خطأ في تحميل إحصائيات التشفير: ' . $e->getMessage(), null, 500);
    }
}

// إذا لم يتم العثور على أي endpoint مناسب
response(false, 'طريقة غير مدعومة', null, 405);
?>


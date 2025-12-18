<?php
/**
 * إدارة مفاتيح التشفير
 * ملف آمن لإدارة مفاتيح التشفير
 */

require_once 'encryption.php';

class EncryptionKeyManager {
    private static $keyFile = 'data/encryption.key';
    private static $backupKeyFile = 'data/encryption.key.backup';
    
    /**
     * إنشاء مفتاح تشفير جديد
     */
    public static function generateNewKey() {
        $newKey = DataEncryption::generateSecureKey();
        
        // إنشاء نسخة احتياطية من المفتاح القديم
        if (file_exists(self::$keyFile)) {
            copy(self::$keyFile, self::$backupKeyFile);
        }
        
        // حفظ المفتاح الجديد
        file_put_contents(self::$keyFile, $newKey);
        
        return $newKey;
    }
    
    /**
     * تحميل مفتاح التشفير
     */
    public static function loadKey() {
        if (file_exists(self::$keyFile)) {
            return trim(file_get_contents(self::$keyFile));
        }
        
        // إنشاء مفتاح جديد إذا لم يوجد
        return self::generateNewKey();
    }
    
    /**
     * تحديث مفتاح التشفير
     */
    public static function updateKey($newKey) {
        // إنشاء نسخة احتياطية
        if (file_exists(self::$keyFile)) {
            copy(self::$keyFile, self::$backupKeyFile);
        }
        
        // حفظ المفتاح الجديد
        file_put_contents(self::$keyFile, $newKey);
        
        // تحديث مفتاح التشفير في النظام
        DataEncryption::changeEncryptionKey($newKey);
    }
    
    /**
     * استعادة المفتاح من النسخة الاحتياطية
     */
    public static function restoreFromBackup() {
        if (file_exists(self::$backupKeyFile)) {
            $backupKey = trim(file_get_contents(self::$backupKeyFile));
            copy(self::$backupKeyFile, self::$keyFile);
            DataEncryption::changeEncryptionKey($backupKey);
            return true;
        }
        return false;
    }
    
    /**
     * حذف النسخة الاحتياطية
     */
    public static function deleteBackup() {
        if (file_exists(self::$backupKeyFile)) {
            unlink(self::$backupKeyFile);
        }
    }
    
    /**
     * التحقق من صحة المفتاح
     */
    public static function validateKey($key) {
        return strlen($key) === 64 && ctype_xdigit($key);
    }
    
    /**
     * تشفير جميع البيانات الموجودة بمفتاح جديد
     */
    public static function reencryptAllData($newKey) {
        if (!self::validateKey($newKey)) {
            throw new Exception('مفتاح التشفير غير صحيح');
        }
        
        // حفظ المفتاح القديم
        $oldKey = self::loadKey();
        
        try {
            // تحديث المفتاح
            self::updateKey($newKey);
            
            // إعادة تشفير ملف المستخدمين
            if (file_exists(USERS_FILE)) {
                $users = DataEncryption::decryptUsersFile(USERS_FILE);
                $encryptedUsers = DataEncryption::encryptArray($users, ['username']);
                file_put_contents(USERS_FILE, json_encode($encryptedUsers, JSON_UNESCAPED_UNICODE));
            }
            
            return true;
        } catch (Exception $e) {
            // استعادة المفتاح القديم في حالة الخطأ
            self::updateKey($oldKey);
            throw $e;
        }
    }
    
    /**
     * إنشاء نسخة احتياطية من المفتاح
     */
    public static function backupKey() {
        if (file_exists(self::$keyFile)) {
            $key = file_get_contents(self::$keyFile);
            $backupName = 'data/encryption.key.backup.' . date('Y-m-d-H-i-s');
            file_put_contents($backupName, $key);
            return $backupName;
        }
        return false;
    }
    
    /**
     * قائمة النسخ الاحتياطية
     */
    public static function listBackups() {
        $backups = [];
        $files = glob('data/encryption.key.backup.*');
        
        foreach ($files as $file) {
            $backups[] = [
                'file' => $file,
                'date' => filemtime($file),
                'size' => filesize($file)
            ];
        }
        
        return $backups;
    }
}

// تهيئة مفتاح التشفير عند تحميل الملف
$encryptionKey = EncryptionKeyManager::loadKey();
DataEncryption::changeEncryptionKey($encryptionKey);

// دالة مساعدة لتشفير البيانات الحساسة
function encryptSensitiveData($data, $fields = ['password', 'username', 'email']) {
    return DataEncryption::encryptArray($data, $fields);
}

// دالة مساعدة لفك تشفير البيانات الحساسة
function decryptSensitiveData($data, $fields = ['password', 'username', 'email']) {
    return DataEncryption::decryptArray($data, $fields);
}

// دالة مساعدة لتشفير كلمة مرور واحدة
function encryptPassword($password) {
    return DataEncryption::encrypt($password);
}

// دالة مساعدة لفك تشفير كلمة مرور واحدة
function decryptPassword($encryptedPassword) {
    return DataEncryption::decrypt($encryptedPassword);
}
?>


<?php
/**
 * نظام التشفير وفك التشفير للبيانات الحساسة
 * يستخدم AES-256-GCM للتشفير الآمن
 */

class DataEncryption {
    private static $encryptionKey = 'your-secret-key-here-change-this-in-production';
    private static $cipher = 'aes-256-gcm';
    
    /**
     * تشفير البيانات الحساسة
     * @param string $data البيانات المراد تشفيرها
     * @return string البيانات المشفرة مع IV و Tag
     */
    public static function encrypt($data) {
        if (empty($data)) {
            return $data;
        }
        
        // إنشاء IV عشوائي
        $iv = random_bytes(16);
        
        // تشفير البيانات
        $encrypted = openssl_encrypt($data, self::$cipher, self::$encryptionKey, 0, $iv, $tag);
        
        if ($encrypted === false) {
            throw new Exception('فشل في تشفير البيانات');
        }
        
        // دمج IV + Tag + البيانات المشفرة
        return base64_encode($iv . $tag . $encrypted);
    }
    
    /**
     * فك تشفير البيانات الحساسة
     * @param string $encryptedData البيانات المشفرة
     * @return string البيانات الأصلية
     */
    public static function decrypt($encryptedData) {
        if (empty($encryptedData)) {
            return $encryptedData;
        }
        
        // فك تشفير Base64
        $data = base64_decode($encryptedData);
        
        if ($data === false) {
            throw new Exception('فشل في فك تشفير Base64');
        }
        
        // استخراج IV و Tag و البيانات المشفرة
        $iv = substr($data, 0, 16);
        $tag = substr($data, 16, 16);
        $encrypted = substr($data, 32);
        
        // فك تشفير البيانات
        $decrypted = openssl_decrypt($encrypted, self::$cipher, self::$encryptionKey, 0, $iv, $tag);
        
        if ($decrypted === false) {
            throw new Exception('فشل في فك تشفير البيانات');
        }
        
        return $decrypted;
    }
    
    /**
     * تشفير مصفوفة من البيانات
     * @param array $data المصفوفة المراد تشفيرها
     * @param array $sensitiveFields الحقول الحساسة المراد تشفيرها
     * @return array المصفوفة مع الحقول المشفرة
     */
    public static function encryptArray($data, $sensitiveFields = ['password', 'username', 'email']) {
        foreach ($sensitiveFields as $field) {
            if (isset($data[$field]) && !empty($data[$field])) {
                $data[$field] = self::encrypt($data[$field]);
            }
        }
        return $data;
    }
    
    /**
     * فك تشفير مصفوفة من البيانات
     * @param array $data المصفوفة المراد فك تشفيرها
     * @param array $sensitiveFields الحقول الحساسة المراد فك تشفيرها
     * @return array المصفوفة مع الحقول المفكوكة
     */
    public static function decryptArray($data, $sensitiveFields = ['password', 'username', 'email']) {
        foreach ($sensitiveFields as $field) {
            if (isset($data[$field]) && !empty($data[$field])) {
                try {
                    $data[$field] = self::decrypt($data[$field]);
                } catch (Exception $e) {
                    // إذا فشل فك التشفير، قد تكون البيانات غير مشفرة
                    // نتركها كما هي
                }
            }
        }
        return $data;
    }
    
    /**
     * تشفير جميع المستخدمين في الملف
     * @param string $filePath مسار ملف المستخدمين
     */
    public static function encryptUsersFile($filePath) {
        if (!file_exists($filePath)) {
            return;
        }
        
        $users = json_decode(file_get_contents($filePath), true);
        if (!$users) {
            return;
        }
        
        $encryptedUsers = [];
        foreach ($users as $user) {
            $encryptedUsers[] = self::encryptArray($user, ['password', 'username']);
        }
        
        file_put_contents($filePath, json_encode($encryptedUsers, JSON_UNESCAPED_UNICODE));
    }
    
    /**
     * فك تشفير جميع المستخدمين في الملف
     * @param string $filePath مسار ملف المستخدمين
     * @return array المستخدمين المفكوكين
     */
    public static function decryptUsersFile($filePath) {
        if (!file_exists($filePath)) {
            return [];
        }
        
        $users = json_decode(file_get_contents($filePath), true);
        if (!$users) {
            return [];
        }
        
        $decryptedUsers = [];
        foreach ($users as $user) {
            $decryptedUsers[] = self::decryptArray($user, ['password', 'username']);
        }
        
        return $decryptedUsers;
    }
    
    /**
     * تغيير مفتاح التشفير
     * @param string $newKey المفتاح الجديد
     */
    public static function changeEncryptionKey($newKey) {
        self::$encryptionKey = $newKey;
    }
    
    /**
     * إنشاء مفتاح تشفير عشوائي آمن
     * @return string مفتاح تشفير جديد
     */
    public static function generateSecureKey() {
        return bin2hex(random_bytes(32)); // 256-bit key
    }
    
    /**
     * التحقق من صحة البيانات المشفرة
     * @param string $encryptedData البيانات المشفرة
     * @return bool true إذا كانت صحيحة
     */
    public static function isValidEncrypted($encryptedData) {
        try {
            self::decrypt($encryptedData);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}

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


/**
 * إدارة التشفير في الواجهة الأمامية
 * يوفر واجهة لإدارة مفاتيح التشفير والبيانات الحساسة
 */

class EncryptionManager {
    constructor() {
        this.isEncryptionEnabled = true;
        this.encryptionKey = null;
    }

    /**
     * تشفير البيانات الحساسة في الواجهة الأمامية
     * @param {string} data البيانات المراد تشفيرها
     * @returns {string} البيانات المشفرة
     */
    async encryptData(data) {
        if (!this.isEncryptionEnabled || !data) {
            return data;
        }

        try {
            // استخدام Web Crypto API للتشفير
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            
            // إنشاء مفتاح تشفير
            const key = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256,
                },
                true,
                ['encrypt', 'decrypt']
            );

            // إنشاء IV عشوائي
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // تشفير البيانات
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataBuffer
            );

            // دمج IV + البيانات المشفرة
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            // تحويل إلى Base64
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('خطأ في تشفير البيانات:', error);
            return data; // إرجاع البيانات الأصلية في حالة الخطأ
        }
    }

    /**
     * فك تشفير البيانات الحساسة في الواجهة الأمامية
     * @param {string} encryptedData البيانات المشفرة
     * @returns {string} البيانات الأصلية
     */
    async decryptData(encryptedData) {
        if (!this.isEncryptionEnabled || !encryptedData) {
            return encryptedData;
        }

        try {
            // تحويل من Base64
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // استخراج IV والبيانات المشفرة
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            // إنشاء مفتاح فك التشفير
            const key = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256,
                },
                true,
                ['encrypt', 'decrypt']
            );

            // فك تشفير البيانات
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );

            // تحويل إلى نص
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('خطأ في فك تشفير البيانات:', error);
            return encryptedData; // إرجاع البيانات المشفرة في حالة الخطأ
        }
    }

    /**
     * تشفير كلمة المرور قبل إرسالها
     * @param {string} password كلمة المرور
     * @returns {string} كلمة المرور المشفرة
     */
    async encryptPassword(password) {
        if (!password) return password;
        
        // استخدام hash بسيط للتشفير الأساسي
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * تشفير البيانات الحساسة في النماذج
     * @param {Object} formData بيانات النموذج
     * @param {Array} sensitiveFields الحقول الحساسة
     * @returns {Object} البيانات مع الحقول المشفرة
     */
    async encryptFormData(formData, sensitiveFields = ['password', 'username', 'email']) {
        const encryptedData = { ...formData };
        
        for (const field of sensitiveFields) {
            if (encryptedData[field]) {
                encryptedData[field] = await this.encryptData(encryptedData[field]);
            }
        }
        
        return encryptedData;
    }

    /**
     * فك تشفير البيانات الحساسة من الخادم
     * @param {Object} data البيانات من الخادم
     * @param {Array} sensitiveFields الحقول الحساسة
     * @returns {Object} البيانات مع الحقول المفكوكة
     */
    async decryptServerData(data, sensitiveFields = ['password', 'username', 'email']) {
        const decryptedData = { ...data };
        
        for (const field of sensitiveFields) {
            if (decryptedData[field]) {
                decryptedData[field] = await this.decryptData(decryptedData[field]);
            }
        }
        
        return decryptedData;
    }

    /**
     * تشفير البيانات المحلية (localStorage)
     * @param {string} key المفتاح
     * @param {any} value القيمة
     */
    async setEncryptedLocalStorage(key, value) {
        try {
            const encryptedValue = await this.encryptData(JSON.stringify(value));
            localStorage.setItem(key, encryptedValue);
        } catch (error) {
            console.error('خطأ في تشفير البيانات المحلية:', error);
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    /**
     * فك تشفير البيانات المحلية (localStorage)
     * @param {string} key المفتاح
     * @returns {any} القيمة المفكوكة
     */
    async getEncryptedLocalStorage(key) {
        try {
            const encryptedValue = localStorage.getItem(key);
            if (!encryptedValue) return null;
            
            const decryptedValue = await this.decryptData(encryptedValue);
            return JSON.parse(decryptedValue);
        } catch (error) {
            console.error('خطأ في فك تشفير البيانات المحلية:', error);
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        }
    }

    /**
     * تفعيل/إلغاء التشفير
     * @param {boolean} enabled حالة التشفير
     */
    setEncryptionEnabled(enabled) {
        this.isEncryptionEnabled = enabled;
        localStorage.setItem('encryption_enabled', enabled.toString());
    }

    /**
     * التحقق من حالة التشفير
     * @returns {boolean} حالة التشفير
     */
    isEncryptionActive() {
        return this.isEncryptionEnabled && 
               typeof crypto !== 'undefined' && 
               crypto.subtle;
    }

    /**
     * إنشاء مفتاح تشفير عشوائي
     * @returns {string} مفتاح تشفير جديد
     */
    generateRandomKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * تشفير البيانات الحساسة في API calls
     * @param {Object} data البيانات المراد إرسالها
     * @returns {Object} البيانات مع الحقول المشفرة
     */
    async encryptApiData(data) {
        if (!this.isEncryptionActive()) {
            return data;
        }

        const sensitiveFields = ['password', 'username', 'email', 'phone'];
        return await this.encryptFormData(data, sensitiveFields);
    }
}

// إنشاء مثيل عام لإدارة التشفير
const encryptionManager = new EncryptionManager();

// تهيئة التشفير عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    const encryptionEnabled = localStorage.getItem('encryption_enabled');
    if (encryptionEnabled !== null) {
        encryptionManager.setEncryptionEnabled(encryptionEnabled === 'true');
    }
});

// تصدير إدارة التشفير للاستخدام العام
window.EncryptionManager = encryptionManager;

/**
 * نظام إدارة الإصدارات
 * Version Management System
 * 
 * هذا الملف يحتوي على رقم الإصدار الحالي للتطبيق
 * يتم تحديثه تلقائياً مع كل تعديل لضمان عدم عرض كاش قديم
 */

// رقم الإصدار - يتم تحديثه تلقائياً مع كل تعديل
// Version number - automatically updated with each modification
// استخدام var بدلاً من const لتجنب خطأ "already declared" عند تحميل الملف أكثر من مرة
// استخدام timestamp في كل مرة لضمان التحديث الفوري
var APP_VERSION = window.APP_VERSION || '2.0.1.' + Date.now();

// تاريخ آخر تحديث
var LAST_UPDATE = window.APP_LAST_UPDATE || new Date().toISOString();

// تصدير معلومات الإصدار
if (typeof window !== 'undefined') {
    window.APP_VERSION = APP_VERSION;
    window.APP_LAST_UPDATE = LAST_UPDATE;
    
    // دالة للحصول على رقم الإصدار
    window.getAppVersion = function() {
        return APP_VERSION;
    };
    
    // دالة للتحقق من وجود تحديث جديد
    window.checkForUpdates = async function() {
        try {
            const response = await fetch('/js/version.js?v=' + Date.now());
            if (response.ok) {
                const text = await response.text();
                const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
                if (match && match[1] !== APP_VERSION) {
                    console.log('🔄 تم اكتشاف تحديث جديد:', match[1]);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('❌ خطأ في التحقق من التحديثات:', error);
            return false;
        }
    };
    
    console.log('✅ نظام الإصدارات مفعّل - الإصدار الحالي:', APP_VERSION);
}

// للاستخدام في Service Worker
if (typeof self !== 'undefined') {
    self.APP_VERSION = APP_VERSION;
}

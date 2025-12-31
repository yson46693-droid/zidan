/**
 * نظام إدارة الإصدارات
 * Version Management System
 * 
 * هذا الملف يحتوي على رقم الإصدار الحالي للتطبيق
 * يتم تحديثه تلقائياً مع كل تعديل لضمان عدم عرض كاش قديم
 */

// رقم الإصدار الافتراضي - سيتم تحديثه من version.json
// Default version - will be updated from version.json
var APP_VERSION = window.APP_VERSION || '2.0.1.' + Date.now();

// تاريخ آخر تحديث
var LAST_UPDATE = window.APP_LAST_UPDATE || new Date().toISOString();

// قراءة الإصدار من ملف version.json (سيتم تحديثه تلقائياً)
(async function() {
    try {
        const response = await fetch('/version.json?v=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            APP_VERSION = data.version + '.' + Date.now();
            LAST_UPDATE = data.last_updated;
            
            // تحديث window.APP_VERSION
            if (typeof window !== 'undefined') {
                window.APP_VERSION = APP_VERSION;
                window.APP_LAST_UPDATE = LAST_UPDATE;
                window.APP_VERSION_CLEAN = data.version; // رقم الإصدار بدون timestamp
            }
        }
    } catch (error) {
        console.warn('[Version] تعذر جلب الإصدار من version.json، استخدام الإصدار الافتراضي');
    }
    
    // تصدير معلومات الإصدار
    if (typeof window !== 'undefined') {
        window.APP_VERSION = APP_VERSION;
        window.APP_LAST_UPDATE = LAST_UPDATE;
        
        // دالة للحصول على رقم الإصدار
        window.getAppVersion = function() {
            return APP_VERSION;
        };
        
        // دالة للحصول على رقم الإصدار بدون timestamp
        window.getAppVersionClean = function() {
            return window.APP_VERSION_CLEAN || APP_VERSION.split('.').slice(0, 3).join('.');
        };
        
        // دالة للتحقق من وجود تحديث جديد
        window.checkForUpdates = async function() {
            try {
                if (!navigator.onLine) {
                    console.log('[Update] لا يوجد اتصال بالإنترنت - سيتم التحقق لاحقاً');
                    return false;
                }
                
                const response = await fetch('/version.json?v=' + Date.now());
                if (response.ok) {
                    const data = await response.json();
                    const currentVersion = window.getAppVersionClean ? window.getAppVersionClean() : APP_VERSION.split('.').slice(0, 3).join('.');
                    if (data.version !== currentVersion) {
                        console.log('🔄 تم اكتشاف تحديث جديد:', data.version);
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('❌ خطأ في التحقق من التحديثات:', error);
                return false;
            }
        };
        
        // دالة لتحديث عرض الإصدار في الواجهة
        window.updateVersionDisplay = function() {
            try {
                const cleanVersion = window.getAppVersionClean ? window.getAppVersionClean() : APP_VERSION.split('.').slice(0, 3).join('.');
                const versionElements = document.querySelectorAll('#appVersionDisplay');
                
                versionElements.forEach(el => {
                    if (el) {
                        el.textContent = 'v' + cleanVersion;
                    }
                });
            } catch (error) {
                console.warn('خطأ في تحديث رقم الإصدار:', error);
            }
        };
        
        // تحديث العرض عند تحميل الصفحة
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(window.updateVersionDisplay, 100);
            });
        } else {
            setTimeout(window.updateVersionDisplay, 100);
        }
        
        console.log('✅ نظام الإصدارات مفعّل - الإصدار الحالي:', APP_VERSION);
    }
    
    // للاستخدام في Service Worker
    if (typeof self !== 'undefined') {
        self.APP_VERSION = APP_VERSION;
    }
})();

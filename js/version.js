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

// قراءة الإصدار من ملف version.json (بدون cache لضمان دائماً أحدث إصدار)
(async function() {
    try {
        // ✅ حذف جميع الكاش المخزن للإصدار (localStorage و sessionStorage)
        const cacheKeys = [
            'version_json_cache',
            'version_json_cache_time',
            'version_check_cache',
            'version_check_cache_time',
            'version_check_timestamp'
        ];
        
        // مسح جميع مفاتيح الكاش من localStorage
        cacheKeys.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                // تجاهل الأخطاء
            }
        });
        
        // مسح جميع مفاتيح الكاش من sessionStorage
        cacheKeys.forEach(key => {
            try {
                sessionStorage.removeItem(key);
            } catch (e) {
                // تجاهل الأخطاء
            }
        });
        
        console.log('🔄 [Version] تم مسح جميع الكاش المخزن للإصدار');
        
        // ✅ جلب الإصدار مباشرة من version.json بدون أي cache
        const cacheBuster = Date.now() + '&nocache=' + Math.random() + '&v=' + Date.now();
        const response = await fetch('/version.json?' + cacheBuster, {
            cache: 'no-store', // منع المتصفح من استخدام cache
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            APP_VERSION = data.version + '.' + Date.now();
            LAST_UPDATE = data.last_updated;
            
            // ✅ لا نحفظ في cache أبداً - دائماً نجلبه من الملف مباشرة
            
            // تحديث window.APP_VERSION
            if (typeof window !== 'undefined') {
                window.APP_VERSION = APP_VERSION;
                window.APP_LAST_UPDATE = LAST_UPDATE;
                window.APP_VERSION_CLEAN = data.version; // رقم الإصدار بدون timestamp
            }
            
            console.log('✅ [Version] تم جلب الإصدار مباشرة من version.json:', data.version);
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
        
        // دالة للتحقق من وجود تحديث جديد (بدون cache لضمان دائماً أحدث إصدار)
        window.checkForUpdates = async function() {
            try {
                if (!navigator.onLine) {
                    console.log('[Update] لا يوجد اتصال بالإنترنت - سيتم التحقق لاحقاً');
                    return false;
                }
                
                // ✅ مسح جميع الكاش المخزن للإصدار قبل التحقق
                const cacheKeys = [
                    'version_json_cache',
                    'version_json_cache_time',
                    'version_check_cache',
                    'version_check_cache_time',
                    'version_check_timestamp'
                ];
                
                cacheKeys.forEach(key => {
                    try {
                        localStorage.removeItem(key);
                        sessionStorage.removeItem(key);
                    } catch (e) {
                        // تجاهل الأخطاء
                    }
                });
                
                // ✅ جلب الإصدار مباشرة من version.json بدون أي cache
                const cacheBuster = Date.now() + '&nocache=' + Math.random() + '&v=' + Date.now();
                const response = await fetch('/version.json?' + cacheBuster, {
                    cache: 'no-store', // منع المتصفح من استخدام cache
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // ✅ لا نحفظ في cache أبداً
                    
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
        
        // تحديث العرض عند تحميل الصفحة - مع إعادة المحاولة للتأكد من التحديث
        const updateDisplayWithRetry = function() {
            if (window.updateVersionDisplay) {
                window.updateVersionDisplay();
                // إعادة المحاولة بعد تأخير للتأكد من التحديث
                setTimeout(() => {
                    if (window.updateVersionDisplay) {
                        window.updateVersionDisplay();
                    }
                }, 500);
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(updateDisplayWithRetry, 100);
                setTimeout(updateDisplayWithRetry, 1000);
            });
        } else {
            setTimeout(updateDisplayWithRetry, 100);
            setTimeout(updateDisplayWithRetry, 1000);
        }
        
        console.log('✅ نظام الإصدارات مفعّل - الإصدار الحالي:', APP_VERSION);
    }
    
    // للاستخدام في Service Worker
    if (typeof self !== 'undefined') {
        self.APP_VERSION = APP_VERSION;
    }
})();

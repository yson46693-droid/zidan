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

// قراءة الإصدار من ملف version.json (مع cache لتقليل الاستدعاءات)
(async function() {
    try {
        // ✅ إصلاح: التحقق من مسح الكاش (hard refresh) ومسح localStorage cache
        const cacheKey = 'version_json_cache';
        const cacheTimeKey = 'version_json_cache_time';
        const versionCheckKey = 'version_check_timestamp';
        const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق
        
        // التحقق من وجود علامة مسح الكاش (hard refresh)
        // عند hard refresh (Ctrl+F5)، يتم إعادة تحميل جميع الملفات بما فيها version.js
        // لذلك نتحقق من timestamp آخر تحقق - إذا كان قديماً جداً، نمسح cache
        const lastCheck = sessionStorage.getItem(versionCheckKey);
        const now = Date.now();
        
        // إذا كان آخر تحقق قديم جداً (أكثر من 10 ثوان) أو غير موجود، نمسح cache
        // هذا يعني أن المستخدم قام بمسح الكاش
        if (!lastCheck || (now - parseInt(lastCheck)) > 10000) {
            console.log('🔄 [Version] تم اكتشاف مسح الكاش - مسح localStorage cache');
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimeKey);
        }
        
        // حفظ timestamp التحقق الحالي
        sessionStorage.setItem(versionCheckKey, now.toString());
        
        const cachedTime = localStorage.getItem(cacheTimeKey);
        
        // إذا كان cache موجوداً وحديثاً (أقل من 5 دقائق)، استخدامه
        if (cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    APP_VERSION = data.version + '.' + Date.now();
                    LAST_UPDATE = data.last_updated;
                    
                    if (typeof window !== 'undefined') {
                        window.APP_VERSION = APP_VERSION;
                        window.APP_LAST_UPDATE = LAST_UPDATE;
                        window.APP_VERSION_CLEAN = data.version;
                    }
                    // لا نعود مباشرة - نتابع لاستدعاء API للتأكد من التحديث
                } catch (e) {
                    // إذا فشل parsing cache، نتابع لاستدعاء API
                }
            }
        }
        
        // ✅ إصلاح: استخدام timestamp و random لضمان عدم استخدام cache
        const response = await fetch('/version.json?v=' + Date.now() + '&nocache=' + Math.random(), {
            cache: 'no-store', // منع المتصفح من استخدام cache
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        if (response.ok) {
            const data = await response.json();
            APP_VERSION = data.version + '.' + Date.now();
            LAST_UPDATE = data.last_updated;
            
            // حفظ في cache
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheTimeKey, now.toString());
            
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
        
        // دالة للتحقق من وجود تحديث جديد (مع cache لتقليل الاستدعاءات)
        window.checkForUpdates = async function() {
            try {
                if (!navigator.onLine) {
                    console.log('[Update] لا يوجد اتصال بالإنترنت - سيتم التحقق لاحقاً');
                    return false;
                }
                
                // ✅ استخدام cache - التحقق فقط كل 5 دقائق
                const cacheKey = 'version_check_cache';
                const cacheTimeKey = 'version_check_cache_time';
                const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق
                
                const cachedTime = localStorage.getItem(cacheTimeKey);
                const now = Date.now();
                
                // إذا كان cache موجوداً وحديثاً، استخدامه
                if (cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION) {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        try {
                            const data = JSON.parse(cached);
                            const currentVersion = window.getAppVersionClean ? window.getAppVersionClean() : APP_VERSION.split('.').slice(0, 3).join('.');
                            if (data.version !== currentVersion) {
                                console.log('🔄 تم اكتشاف تحديث جديد:', data.version);
                                return true;
                            }
                            return false; // لا يوجد تحديث
                        } catch (e) {
                            // إذا فشل parsing cache، نتابع لاستدعاء API
                        }
                    }
                }
                
                // ✅ إصلاح: استخدام timestamp و random لضمان عدم استخدام cache
                const response = await fetch('/version.json?v=' + Date.now() + '&nocache=' + Math.random(), {
                    cache: 'no-store', // منع المتصفح من استخدام cache
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    
                    // حفظ في cache
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    localStorage.setItem(cacheTimeKey, Date.now().toString());
                    
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

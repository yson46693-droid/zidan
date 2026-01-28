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

/**
 * دالة شاملة لمسح جميع أنواع الكاش عند تغيير النسخة
 * Comprehensive function to clear all cache types when version changes
 */
async function clearAllCache() {
    console.log('🧹 [Version] بدء مسح جميع أنواع الكاش...');
    
    try {
        // 1. مسح localStorage (جميع المفاتيح المتعلقة بالكاش)
        try {
            const localStorageKeys = Object.keys(localStorage);
            const cacheRelatedKeys = localStorageKeys.filter(key => 
                key.includes('cache') || 
                key.includes('Cache') || 
                key.includes('version') || 
                key.includes('Version') ||
                key.includes('_last_update') ||
                key.includes('_timestamp') ||
                key.includes('branches_cache') ||
                key.includes('chat_notifications') ||
                key.includes('deleted_notifications') ||
                key.includes('lastReadMessageId') ||
                key.includes('lastChatMessageId') ||
                key.includes('chatUnreadCount') ||
                key.includes('repairTrackingData') ||
                key.includes('repair_rating_') ||
                key.includes('pos_last_camera_id') ||
                key.includes('current_inventory_tab')
            );
            
            cacheRelatedKeys.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn(`[Version] فشل مسح localStorage key: ${key}`, e);
                }
            });
            
            console.log(`✅ [Version] تم مسح ${cacheRelatedKeys.length} مفتاح من localStorage`);
        } catch (e) {
            console.warn('[Version] خطأ في مسح localStorage:', e);
        }
        
        // 2. مسح sessionStorage (جميع المفاتيح المتعلقة بالكاش)
        try {
            const sessionStorageKeys = Object.keys(sessionStorage);
            const cacheRelatedKeys = sessionStorageKeys.filter(key => 
                key.includes('cache') || 
                key.includes('Cache') || 
                key.includes('version') || 
                key.includes('Version') ||
                key.includes('_timestamp') ||
                key.includes('PAGE_STORAGE_KEY') ||
                key.includes('PAGE_SESSION_KEY')
            );
            
            cacheRelatedKeys.forEach(key => {
                try {
                    sessionStorage.removeItem(key);
                } catch (e) {
                    console.warn(`[Version] فشل مسح sessionStorage key: ${key}`, e);
                }
            });
            
            console.log(`✅ [Version] تم مسح ${cacheRelatedKeys.length} مفتاح من sessionStorage`);
        } catch (e) {
            console.warn('[Version] خطأ في مسح sessionStorage:', e);
        }
        
        // 3. مسح IndexedDB Cache
        try {
            if (typeof window !== 'undefined' && window.dbCache) {
                await window.dbCache.clear();
                console.log('✅ [Version] تم مسح IndexedDB Cache');
            } else if (typeof indexedDB !== 'undefined') {
                // محاولة مسح IndexedDB مباشرة
                const dbName = 'pos_inventory_cache';
                const deleteReq = indexedDB.deleteDatabase(dbName);
                await new Promise((resolve, reject) => {
                    deleteReq.onsuccess = () => resolve();
                    deleteReq.onerror = () => reject(deleteReq.error);
                    deleteReq.onblocked = () => {
                        console.warn('[Version] IndexedDB محظور، سيتم المحاولة لاحقاً');
                        resolve();
                    };
                });
                console.log('✅ [Version] تم مسح IndexedDB');
            }
        } catch (e) {
            console.warn('[Version] خطأ في مسح IndexedDB:', e);
        }
        
        // 4. مسح Service Worker Cache
        try {
            const cachesAPI = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' && 'caches' in window ? window.caches : null);
            if (cachesAPI) {
                const cacheNames = await cachesAPI.keys();
                const cachePromises = cacheNames.map(cacheName => {
                    console.log(`🗑️ [Version] حذف Service Worker Cache: ${cacheName}`);
                    return cachesAPI.delete(cacheName);
                });
                await Promise.all(cachePromises);
                console.log(`✅ [Version] تم مسح ${cacheNames.length} Service Worker Cache`);
            }
        } catch (e) {
            console.warn('[Version] خطأ في مسح Service Worker Cache:', e);
        }
        
        // 5. إعادة تسجيل Service Worker لإجباره على التحديث
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(registration => {
                    console.log('🔄 [Version] إعادة تسجيل Service Worker...');
                    return registration.unregister();
                }));
                
                // إعادة التسجيل بعد إلغاء التسجيل
                if (registrations.length > 0) {
                    setTimeout(async () => {
                        try {
                            await navigator.serviceWorker.register('/sw.js');
                            console.log('✅ [Version] تم إعادة تسجيل Service Worker');
                        } catch (e) {
                            console.warn('[Version] فشل إعادة تسجيل Service Worker:', e);
                        }
                    }, 1000);
                }
            }
        } catch (e) {
            console.warn('[Version] خطأ في إعادة تسجيل Service Worker:', e);
        }
        
        console.log('✅ [Version] اكتمل مسح جميع أنواع الكاش');
    } catch (error) {
        console.error('❌ [Version] خطأ عام في مسح الكاش:', error);
    }
}

// قراءة الإصدار من ملف version.json (بدون cache لضمان دائماً أحدث إصدار)
(async function() {
    try {
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
            const newVersion = data.version;
            const storedVersion = localStorage.getItem('app_version_stored');
            
            // ✅ التحقق من تغيير النسخة
            if (storedVersion && storedVersion !== newVersion) {
                console.log(`🔄 [Version] تم اكتشاف تغيير النسخة: ${storedVersion} → ${newVersion}`);
                console.log('🧹 [Version] بدء مسح جميع الكاش بسبب تغيير النسخة...');
                
                // مسح جميع الكاش عند تغيير النسخة
                await clearAllCache();
            }
            
            // حفظ النسخة الحالية
            try {
                localStorage.setItem('app_version_stored', newVersion);
            } catch (e) {
                console.warn('[Version] فشل حفظ النسخة في localStorage:', e);
            }
            
            APP_VERSION = newVersion + '.' + Date.now();
            LAST_UPDATE = data.last_updated;
            
            // تحديث window.APP_VERSION
            if (typeof window !== 'undefined') {
                window.APP_VERSION = APP_VERSION;
                window.APP_LAST_UPDATE = LAST_UPDATE;
                window.APP_VERSION_CLEAN = newVersion; // رقم الإصدار بدون timestamp
            }
            
            console.log('✅ [Version] تم جلب الإصدار مباشرة من version.json:', newVersion);
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
                    const newVersion = data.version;
                    const storedVersion = localStorage.getItem('app_version_stored');
                    const currentVersion = window.getAppVersionClean ? window.getAppVersionClean() : APP_VERSION.split('.').slice(0, 3).join('.');
                    
                    // ✅ التحقق من تغيير النسخة
                    if (newVersion !== currentVersion || (storedVersion && storedVersion !== newVersion)) {
                        console.log(`🔄 [Update] تم اكتشاف تحديث جديد: ${currentVersion} → ${newVersion}`);
                        console.log('🧹 [Update] بدء مسح جميع الكاش بسبب التحديث...');
                        
                        // مسح جميع الكاش عند اكتشاف تحديث جديد
                        await clearAllCache();
                        
                        // حفظ النسخة الجديدة
                        try {
                            localStorage.setItem('app_version_stored', newVersion);
                        } catch (e) {
                            console.warn('[Update] فشل حفظ النسخة في localStorage:', e);
                        }
                        
                        // تحديث المتغيرات
                        APP_VERSION = newVersion + '.' + Date.now();
                        LAST_UPDATE = data.last_updated;
                        if (typeof window !== 'undefined') {
                            window.APP_VERSION = APP_VERSION;
                            window.APP_LAST_UPDATE = LAST_UPDATE;
                            window.APP_VERSION_CLEAN = newVersion;
                        }
                        
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('❌ خطأ في التحقق من التحديثات:', error);
                return false;
            }
        };
        
        // تصدير دالة مسح الكاش للاستخدام الخارجي
        window.clearAllCache = clearAllCache;
        
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

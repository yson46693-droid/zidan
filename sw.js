// Service Worker للعمل بدون إنترنت
// دعم المتصفحات القديمة والحديثة

// رقم الإصدار - يجب تحديثه يدوياً عند إجراء تغييرات على Service Worker
// Version number - must be updated manually when making changes to Service Worker
// 🔧 الحل: استخدام رقم إصدار ثابت بدلاً من Date.now() لمنع reload loop
const APP_VERSION = '2.0.1'; // رقم ثابت - تحديثه يدوياً عند الحاجة فقط

// اسم الـ cache - يجب أن يكون ثابت لنفس الإصدار
// 🔧 الحل: استخدام رقم إصدار ثابت في اسم الـ cache أيضاً
const CACHE_NAME = 'mobile-repair-shop-v' + APP_VERSION;

console.log('[Service Worker] Version:', APP_VERSION);
console.log('[Service Worker] Cache Name:', CACHE_NAME);

// Polyfill للمتصفحات القديمة
if (typeof self !== 'undefined' && !self.caches) {
    // Fallback بسيط للمتصفحات التي لا تدعم Cache API
    console.warn('[SW] Cache API not supported, using fallback');
}
// ✅ تحديد المسار الأساسي بناءً على موقع Service Worker
const getBasePath = () => {
    try {
        // استخدام self.location لتحديد مسار Service Worker
        const swPath = self.location.pathname; // مثال: /sw.js أو /z/sw.js
        console.log('[SW] Service Worker path:', swPath);
        
        // ✅ الحل: إذا كان المسار يبدأ مباشرة بـ /sw.js، نستخدم الجذر
        if (swPath === '/sw.js' || swPath.endsWith('/sw.js')) {
            // استخراج المسار الأساسي (إزالة sw.js من النهاية)
            const swIndex = swPath.lastIndexOf('/sw.js');
            const basePath = swPath.substring(0, swIndex);
            
            // إذا كان basePath فارغاً أو '/'، نعيد '' (جذر)
            if (!basePath || basePath === '/') {
                console.log('[SW] Using root path');
                return '';
            }
            
            // ✅ التحقق من أن المسار صحيح (يجب أن يكون مثل /zidan15)
            // إذا كان المسار يحتوي على .html، فهذا خطأ - نستخدم الجذر
            if (basePath.includes('.html')) {
                console.warn('[SW] Invalid base path detected (contains .html), using root instead:', basePath);
                return '';
            }
            
            console.log('[SW] Base path:', basePath);
            return basePath.startsWith('/') ? basePath : '/' + basePath;
        }
        
        // ✅ إذا لم نجد sw.js في المسار، نستخدم الجذر
        console.log('[SW] sw.js not found in expected format, using root');
        return '';
    } catch (e) {
        console.error('[SW] Error determining base path:', e);
        // ✅ في حالة الخطأ، نستخدم الجذر دائماً
        return '';
    }
};

const BASE_PATH = getBasePath();
console.log('[SW] Using BASE_PATH:', BASE_PATH || '(root)');

// دالة مساعدة لبناء المسارات بشكل صحيح
const buildPath = (path) => {
    // ✅ الحل: إذا كان BASE_PATH يحتوي على .html، نستخدم الجذر بدلاً منه
    // هذا يمنع إنشاء مسارات خاطئة مثل /dashboard.html/index.html
    const effectiveBasePath = (BASE_PATH && BASE_PATH.includes('.html')) ? '' : BASE_PATH;
    
    // إذا كان BASE_PATH فارغاً، نستخدم المسار مباشرة مع / في البداية
    if (!effectiveBasePath) {
        return path.startsWith('/') ? path : '/' + path;
    }
    
    // إذا كان BASE_PATH موجوداً، نضيف المسار إليه
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return effectiveBasePath + cleanPath;
};

// قائمة الملفات الأساسية - جميع ملفات JS و CSS الحرجة
// ✅ تحسين: إضافة جميع ملفات JS و CSS الحرجة لتقليل عدد الطلبات
const essentialFiles = [
    buildPath('/'),
    buildPath('/index.html'),
    buildPath('/dashboard.html'),
    buildPath('/manifest.json'),
    // CSS Files - جميع ملفات CSS الحرجة
    buildPath('/css/style.css'),
    buildPath('/css/loading-overlay.css'),
    buildPath('/css/dark-mode.css'),
    buildPath('/css/security.css'),
    // JS Files - جميع ملفات JS الحرجة
    buildPath('/js/version.js'),
    buildPath('/js/api.js'),
    buildPath('/js/utils.js'),
    buildPath('/js/loading-overlay.js'),
    buildPath('/js/auth.js'),
    buildPath('/js/indexeddb-cache.js'),
    buildPath('/js/global-notifications.js'),
    buildPath('/js/api-batch.js'),
    buildPath('/js/message-polling-manager.js'),
    buildPath('/js/console-manager.js')
    // ملاحظة: الأيقونات لا يتم حفظها في cache لأنها قد تتغير - سيتم جلبها من الشبكة دائماً
];

// قائمة الملفات الاختيارية - ملفات إضافية يمكن تحميلها في الخلفية
// ✅ تحسين: إضافة ملفات JS و CSS إضافية للـ caching
const optionalFiles = [
    buildPath('/install.html'),
    buildPath('/pos.html'),
    buildPath('/chat.html'),
    buildPath('/repair-tracking.html'),
    // CSS Files إضافية
    buildPath('/css/chat.css'),
    buildPath('/css/pos.css'),
    buildPath('/css/repair-tracking.css'),
    buildPath('/css/print.css'),
    buildPath('/css/splash-screen.css'),
    // JS Files إضافية - سيتم تحميلها عند الحاجة (lazy loading)
    buildPath('/js/repairs.js'),
    buildPath('/js/customers.js'),
    buildPath('/js/inventory.js'),
    buildPath('/js/expenses.js'),
    buildPath('/js/reports.js'),
    buildPath('/js/settings.js'),
    buildPath('/js/profile.js'),
    buildPath('/js/product-returns.js'),
    buildPath('/js/chat.js'),
    buildPath('/js/pos.js'),
    buildPath('/js/repair-tracking.js'),
    buildPath('/js/chat-unread-badge.js'),
    buildPath('/js/sync.js'),
    buildPath('/js/encryption.js'),
    buildPath('/js/encryption-settings.js'),
    buildPath('/js/data-protection.js'),
    buildPath('/js/security.js'),
    buildPath('/js/barcode.js'),
    buildPath('/js/small-label.js'),
    buildPath('/js/backup-management.js'),
    buildPath('/js/performance-monitor.js'),
    buildPath('/js/pwa-install.js'),
    buildPath('/js/pwa-validator.js'),
    buildPath('/js/pwa-diagnostics.js'),
    // Images
    buildPath('/vertopal.com_photo_5922357566287580087_y.png')
    // ملاحظة: تم إزالة الأيقونات من cache لأنها ليست ضرورية ويمكن أن تسبب مشاكل
    // الأيقونات ستُجلب مباشرة من manifest.json عند الحاجة
];

// متغير لتتبع العمليات المعلقة
let pendingOperations = new Set();

// دالة لإضافة ملفات بشكل آمن مع معالجة الأخطاء و timeout
async function cacheFilesSafely(cache, files, isEssential = false) {
    // ✅ تحسين: زيادة timeout للملفات الكبيرة (JS/CSS)
    const CACHE_TIMEOUT = 5000; // 5 ثواني للملفات الكبيرة
    
    // دالة مساعدة لإضافة timeout للطلبات
    const fetchWithTimeout = (url, timeout = CACHE_TIMEOUT) => {
        return Promise.race([
            fetch(url),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    };
    
    const results = await Promise.allSettled(
        files.map(async url => {
            try {
                const response = await fetchWithTimeout(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // نسخ الاستجابة قبل وضعها في الـ cache
                const responseClone = response.clone();
                await cache.put(url, responseClone);
                return { url, success: true };
            } catch (error) {
                console.warn(`[SW] Failed to cache ${url}:`, error.message);
                // حتى للملفات الأساسية، لا نرمي الخطأ - نكمل مع باقي الملفات
                // لأن فشل ملف واحد لا يجب أن يمنع تحميل باقي الملفات
                return { url, success: false, error: error.message };
            }
        })
    );
    
    const succeeded = results.filter(r => 
        r.status === 'fulfilled' && r.value && r.value.success
    ).length;
    const failed = results.length - succeeded;
    
    console.log(`[SW] Cached ${succeeded}/${files.length} files${failed > 0 ? ` (${failed} failed)` : ''}`);
    
    return { succeeded, failed, results };
}

// التثبيت - حفظ الملفات في الـ cache
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    const installPromise = caches.open(CACHE_NAME)
        .then(async cache => {
            console.log('[Service Worker] Caching essential files...');
            
            // إضافة الملفات الأساسية أولاً
            const essentialResult = await cacheFilesSafely(cache, essentialFiles, false);
            if (essentialResult.failed > 0) {
                console.warn(`[Service Worker] ${essentialResult.failed} essential file(s) failed to cache`);
            } else {
                console.log('[Service Worker] All essential files cached successfully');
            }
            
            // إضافة الملفات الاختيارية بشكل متوازي (لكن بدون انتظار - non-blocking)
            console.log('[Service Worker] Caching optional files in background...');
            cacheFilesSafely(cache, optionalFiles, false).then(() => {
                console.log('[Service Worker] Optional files cached');
            }).catch(err => {
                console.warn('[Service Worker] Some optional files failed:', err);
            });
            
            console.log('[Service Worker] Installation complete');
        })
        .then(() => {
            // تفعيل Service Worker فوراً
            if (self.skipWaiting) {
                return self.skipWaiting();
            }
        })
        .catch(error => {
            console.error('[Service Worker] Installation error:', error);
            // حتى لو فشل التثبيت، نكمل العملية
        });
    
    event.waitUntil(installPromise);
});

// التفعيل - تنظيف الـ cache القديم
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...', 'Cache:', CACHE_NAME);
    
    const activatePromise = caches.keys()
        .then(cacheNames => {
            console.log('[Service Worker] Found caches:', cacheNames);
            return Promise.all(
                cacheNames.map(cacheName => {
                    // حذف جميع الـ caches القديمة التي لا تطابق الإصدار الحالي
                    // 🔧 تحديث: حذف جميع caches التي تبدأ بـ mobile-repair-shop- إلا الحالي
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('mobile-repair-shop-')) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return Promise.resolve();
                })
            );
        })
        .then(() => {
            // حذف جميع الأيقونات القديمة من cache الحالي لضمان الحصول على أحدث نسخة
            return caches.open(CACHE_NAME).then(cache => {
                return cache.keys().then(keys => {
                    const iconKeys = keys.filter(request => {
                        const url = request.url || '';
                        return url.includes('/icons/') || url.includes('icon-');
                    });
                    
                    if (iconKeys.length > 0) {
                        console.log(`[Service Worker] Deleting ${iconKeys.length} old icon(s) from cache`);
                        return Promise.all(iconKeys.map(key => cache.delete(key)));
                    }
                    return Promise.resolve();
                });
            });
        })
        .then(() => {
            // تفعيل Service Worker فوراً لجميع العملاء
            if (self.skipWaiting) {
                return self.skipWaiting();
            }
        })
        .then(() => {
            // تفعيل Service Worker لجميع العملاء (للمتصفحات القديمة)
            if (self.clients && self.clients.claim) {
                return self.clients.claim();
            }
        })
        // 🔧 الحل: إزالة إرسال SW_UPDATED تلقائياً في activate event
        // سيتم إرسال SW_UPDATED فقط عند وجود updatefound (worker جديد فعلياً)
        // .then(() => {
        //     // إرسال رسالة لجميع العملاء لإعادة تحميل الصفحة
        //     return self.clients.matchAll().then(clients => {
        //         clients.forEach(client => {
        //             client.postMessage({
        //                 type: 'SW_UPDATED',
        //                 version: APP_VERSION,
        //                 message: 'تم تحديث Service Worker - سيتم إعادة تحميل الصفحة'
        //             });
        //         });
        //     });
        // });
    
    event.waitUntil(activatePromise);
});

// اعتراض الطلبات - استخدام الـ cache أو الشبكة
self.addEventListener('fetch', event => {
    const { request } = event;
    
    // ✅ تجاهل ملفات CDN الخارجية (مثل Bootstrap Icons)
    // نترك المتصفح يتعامل معها بشكل طبيعي
    try {
        const requestUrl = new URL(request.url);
        const isExternalCDN = requestUrl.origin !== self.location.origin;
        
        // ✅ تجاهل ملفات CSS و JS من CDN خارجي (مثل cdn.jsdelivr.net)
        if (isExternalCDN && (
            requestUrl.hostname.includes('cdn.jsdelivr.net') ||
            requestUrl.hostname.includes('cdnjs.cloudflare.com') ||
            requestUrl.hostname.includes('unpkg.com') ||
            requestUrl.hostname.includes('fonts.googleapis.com') ||
            requestUrl.hostname.includes('fonts.gstatic.com')
        )) {
            // نترك المتصفح يتعامل مع الطلب بشكل طبيعي بدون intercept
            return;
        }
    } catch (e) {
        // إذا فشل parsing URL، نتابع بشكل طبيعي
    }
    
    // دعم المتصفحات القديمة التي لا تدعم URL constructor
    let url;
    try {
        url = new URL(request.url);
    } catch (e) {
        // للمتصفحات القديمة
        url = { pathname: request.url };
    }
    
    // ✅ تحسين: معالجة طلبات API مع caching ذكي
    if (url.pathname.includes('/api/') || url.pathname.endsWith('.php')) {
        // استراتيجية Network First مع Cache Fallback للـ API requests
        event.respondWith(
            fetch(request, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            })
                .then(response => {
                    // إذا كانت الاستجابة ناجحة (200-299) و GET request، نحفظها في cache
                    if (request.method === 'GET' && response.ok && response.status >= 200 && response.status < 300) {
                        // نسخ الاستجابة قبل حفظها
                        const responseToCache = response.clone();
                        
                        // حفظ في cache بشكل آمن (في الخلفية)
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache).catch(err => {
                                console.warn('[SW] فشل حفظ API response في cache:', request.url, err);
                            });
                        });
                    }
                    
                    return response;
                })
                .catch(error => {
                    // في حالة فشل الشبكة، نجرب من cache
                    const isNetworkError = error.name === 'TypeError' || 
                                         error.name === 'NetworkError' ||
                                         (error.message && (
                                             error.message.includes('Failed to fetch') ||
                                             error.message.includes('NetworkError') ||
                                             error.message.includes('Network request failed') ||
                                             error.message.includes('Load failed')
                                         ));
                    
                    if (isNetworkError) {
                        // محاولة جلب من cache
                        return caches.match(request).then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('[SW] استخدام API response من cache:', request.url);
                                return cachedResponse;
                            }
                            
                            // إذا لم يكن في cache، نعيد رسالة عدم الاتصال
                            return new Response(
                                JSON.stringify({ 
                                    success: false, 
                                    message: 'لا يوجد اتصال بالإنترنت. يرجى المحاولة لاحقاً.',
                                    offline: true
                                }),
                                { 
                                    headers: { 
                                        'Content-Type': 'application/json',
                                        'Cache-Control': 'no-cache'
                                    } 
                                }
                            );
                        });
                    }
                    
                    // في حالة وجود خطأ آخر، نعيد الخطأ الأصلي للكود لمعالجته
                    throw error;
                })
        );
        return;
    }
    
    // تجاهل طلبات POST/PUT/DELETE
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // ✅ تحسين: استراتيجية Network First للملفات الديناميكية مع cache fallback
    // هذا يضمن أن الملفات المحدثة تُجلب من الشبكة أولاً، لكن مع دعم offline
    const isDynamicFile = request.url.includes('?v=') || 
                         request.url.includes('?version=') ||
                         request.url.endsWith('.css') ||
                         request.url.endsWith('.js') ||
                         request.url.endsWith('.html') ||
                         request.url.includes('/icons/');
    
    // ✅ تحسين: معالجة الصور بشكل منفصل مع caching أفضل
    const isImage = request.url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) ||
                    request.url.includes('/images/') ||
                    request.url.includes('/icons/');
    
    // ✅ تحسين: معالجة الصور مع Cache First strategy
    if (isImage) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    // إذا كان موجود في cache، نعيده مباشرة (أسرع)
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // إذا لم يكن في cache، نجلب من الشبكة
                    return fetch(request).then(response => {
                        // إذا كانت الاستجابة ناجحة، نحفظها في cache
                        if (response.ok && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseToCache).catch(err => {
                                    console.warn('[SW] فشل حفظ صورة في cache:', request.url, err);
                                });
                            });
                        }
                        return response;
                    }).catch(error => {
                        console.warn('[SW] فشل جلب صورة:', request.url, error);
                        // إرجاع placeholder image في حالة الفشل
                        return new Response('', { status: 404 });
                    });
                })
        );
        return;
    }
    
    if (isDynamicFile) {
        // ✅ التحقق من أن الطلب هو لملف محلي وليس CDN خارجي
        const requestUrl = new URL(request.url);
        // ✅ الحل الآمن: الاعتماد على origin matching فقط (يعمل مع أي دومين)
        // origin يشمل protocol + hostname + port - آمن 100%
        const isLocalFile = requestUrl.origin === self.location.origin;
        
        // ✅ Network First مع Cache Fallback للملفات الديناميكية
        const fetchOptions = isLocalFile ? {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        } : {
            // ✅ للملفات الخارجية (CDN)، نستخدم fetch عادي بدون headers مخصصة
            cache: 'default',
            credentials: 'omit'
        };
        
        event.respondWith(
            fetch(request, fetchOptions)
                .then(response => {
                    // إذا كانت الاستجابة ناجحة، نحفظها في cache للاستخدام offline
                    if (response.ok && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache).catch(err => {
                                console.warn('[SW] فشل حفظ ملف في cache:', request.url, err);
                            });
                        });
                    }
                    return response;
                })
                .catch(error => {
                    // في حالة فشل الشبكة، نجرب من cache كـ fallback
                    // ✅ للملفات الخارجية، لا نطبع warning لتقليل الضوضاء
                    if (isLocalFile) {
                        console.warn('[SW] فشل جلب من الشبكة، استخدام cache:', request.url, error);
                    }
                    return caches.match(request).then(cachedResponse => {
                        if (cachedResponse) {
                            if (isLocalFile) {
                                console.log('[SW] استخدام نسخة من cache:', request.url);
                            }
                            return cachedResponse;
                        }
                        // ✅ للملفات الخارجية، نعيد response فارغ بدلاً من throw error
                        if (!isLocalFile) {
                            // للملفات الخارجية، نترك المتصفح يتعامل معها بشكل طبيعي
                            return fetch(request, { mode: 'no-cors' }).catch(() => {
                                // إذا فشل أيضاً، نعيد response فارغ
                                return new Response('', { status: 0 });
                            });
                        }
                        // إذا لم يكن في cache أيضاً، نعيد الخطأ الأصلي
                        throw error;
                    });
                })
        );
        return;
    }
    
    // استراتيجية Cache First للملفات الثابتة الأخرى
    // مع دعم المتصفحات القديمة
    if (typeof caches !== 'undefined' && caches.match) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    // إذا كان موجود في الـ cache، نعيده
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // محاولة جلب من الشبكة
                    return fetch(request).then(response => {
                        // إذا كانت الاستجابة ناجحة (200-299)، نحفظها في cache
                        if (response.ok && response.status >= 200 && response.status < 300) {
                            // نسخ الاستجابة قبل حفظها (Response يمكن قراءتها مرة واحدة فقط)
                            const responseToCache = response.clone();
                            
                            // حفظ في cache بشكل آمن
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseToCache).catch(err => {
                                    console.warn('[SW] فشل حفظ في cache:', request.url, err);
                                });
                            });
                            
                            return response;
                        }
                        
                        // تجاهل أخطاء 404 للملفات الاختيارية (مثل telegram-backup-config.json)
                        if (response.status === 404 && (
                            request.url.includes('telegram-backup-config.json') ||
                            request.url.includes('data/')
                        )) {
                            // إرجاع استجابة فارغة للملفات الاختيارية المفقودة
                            return new Response('{}', {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                        
                        // التحقق من صحة الاستجابة
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // حفظ في الـ cache للاستخدام لاحقاً
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            // التحقق من أن الطلب قابل للتخزين
                            if (request.method === 'GET' && response.status === 200) {
                                cache.put(request, responseToCache).catch(err => {
                                    console.log('[SW] Cache put failed:', err);
                                });
                            }
                        }).catch(err => {
                            console.log('[SW] Cache open failed:', err);
                        });

                        return response;
                    }).catch(error => {
                        // في حالة فشل الطلب، نعيد خطأ واضح
                        console.error('[SW] Fetch failed for:', request.url, error);
                        // إعادة المحاولة من الشبكة مباشرة بدون cache
                        return fetch(request.url).catch(() => {
                            // إذا فشل مرة أخرى، نعيد استجابة خطأ
                            return new Response('Network error', { 
                                status: 408, 
                                statusText: 'Request Timeout' 
                            });
                        });
                        
                        // إذا كان طلب HTML، نعيد صفحة offline
                        const acceptHeader = request.headers ? request.headers.get('accept') : '';
                        if (acceptHeader && acceptHeader.includes('text/html')) {
                            return new Response(
                                '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>لا يوجد اتصال</title><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}h1{color:#f44336;}</style></head><body><h1>⚠️ لا يوجد اتصال بالإنترنت</h1><p>يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى</p><button onclick="location.reload()">إعادة المحاولة</button></body></html>',
                                { 
                                    headers: { 
                                        'Content-Type': 'text/html; charset=utf-8',
                                        'Cache-Control': 'no-cache'
                                    } 
                                }
                            );
                        }
                        
                        // للطلبات الأخرى، نعيد استجابة فارغة
                        return new Response('', { status: 408 });
                    });
                })
                .catch(error => {
                    // في حالة فشل كل شيء، نجرب fetch مباشرة
                    console.log('[SW] Cache match failed, trying direct fetch:', error);
                    return fetch(request).catch(() => {
                        return new Response('', { status: 408 });
                    });
                })
        );
    } else {
        // للمتصفحات القديمة التي لا تدعم Cache API
        event.respondWith(fetch(request).catch(() => {
            return new Response('', { status: 408 });
        }));
    }
});

// الإشعارات Push
self.addEventListener('push', event => {
    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { body: event.data.text() };
        }
    }
    
    const title = data.title || data.username || 'إشعار جديد';
    const body = data.body || data.message || 'لديك إشعار جديد';
    const icon = data.icon || '/vertopal.com_photo_5922357566287580087_y.png';
    const badge = '/icons/icon-72x72.png';
    
    const options = {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: [200, 100, 200],
        dir: 'rtl',
        lang: 'ar',
        tag: data.messageId || 'chat-message',
        data: data,
        requireInteraction: false,
        silent: false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// معالجة نقر على الإشعار
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const data = event.notification.data || {};
    const urlToOpen = data.url || '/chat.html';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            // البحث عن نافذة مفتوحة للشات
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('chat.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // إذا لم توجد نافذة مفتوحة، فتح نافذة جديدة
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background Sync - مزامنة في الخلفية
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// دالة مزامنة البيانات
async function syncData() {
    try {
        // محاولة مزامنة البيانات المعلقة
        const pendingData = await getPendingData();
        
        if (pendingData && pendingData.length > 0) {
            for (const item of pendingData) {
                await fetch(item.url, {
                    method: item.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
            }
            
            // مسح البيانات المعلقة بعد المزامنة
            await clearPendingData();
            
            // إرسال رسالة للتطبيق
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_COMPLETE',
                        message: 'تمت المزامنة بنجاح'
                    });
                });
            });
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
        return Promise.reject(error);
    }
}

// الحصول على البيانات المعلقة
async function getPendingData() {
    const cache = await caches.open('pending-sync');
    const requests = await cache.keys();
    const pendingData = [];
    
    for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
            const data = await response.json();
            pendingData.push(data);
        }
    }
    
    return pendingData;
}

// مسح البيانات المعلقة
async function clearPendingData() {
    const cache = await caches.open('pending-sync');
    const requests = await cache.keys();
    
    for (const request of requests) {
        await cache.delete(request);
    }
}

// معالجة رسائل من التطبيق
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'SYNC_NOW') {
        // طلب مزامنة فورية
        event.waitUntil(syncData());
    }
    
    if (event.data && event.data.type === 'CLEANUP') {
        // تنظيف العمليات المعلقة
        pendingOperations.clear();
        console.log('[Service Worker] تم تنظيف العمليات المعلقة');
    }
});

// تنظيف العمليات المعلقة عند إغلاق التبويب
self.addEventListener('beforeunload', () => {
    pendingOperations.clear();
    console.log('[Service Worker] تم تنظيف العمليات المعلقة قبل إغلاق التبويب');
});


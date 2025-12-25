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
        const swPath = self.location.pathname; // مثال: /z/sw.js
        // استخراج المسار الأساسي (إزالة sw.js من النهاية)
        const basePath = swPath.substring(0, swPath.lastIndexOf('/sw.js'));
        console.log('[SW] Service Worker path:', swPath);
        console.log('[SW] Base path:', basePath || '(root)');
        return basePath || '';
    } catch (e) {
        console.error('[SW] Error determining base path:', e);
        return '';
    }
};

const BASE_PATH = getBasePath();
console.log('[SW] Using BASE_PATH:', BASE_PATH || '(root)');

// قائمة الملفات الأساسية فقط - الملفات المهمة التي يجب أن تكون موجودة
// تم تقليل الملفات لتسريع التحميل الأولي
// ملاحظة: الأيقونات لا يتم حفظها في cache لأنها قد تتغير - سيتم جلبها من الشبكة دائماً
const essentialFiles = [
    BASE_PATH + '/',
    BASE_PATH + '/index.html',
    BASE_PATH + '/dashboard.html',
    BASE_PATH + '/manifest.json',
    BASE_PATH + '/css/style.css',
    BASE_PATH + '/js/version.js',
    BASE_PATH + '/js/api.js',
    BASE_PATH + '/js/utils.js'
    // تم إزالة الأيقونات من essentialFiles - سيتم جلبها من الشبكة دائماً لضمان الحصول على أحدث نسخة
];

// قائمة الملفات الاختيارية - يمكن أن تفشل بدون مشكلة
// تم تقليل الملفات - سيتم تحميلها عند الحاجة (lazy loading)
// تم إزالة الملفات التي تسبب أخطاء 404 - سيتم تحميلها عند الحاجة من الصفحة
// ملاحظة: تم إزالة الأيقونات من optionalFiles - سيتم جلبها من الشبكة دائماً لضمان الحصول على أحدث نسخة
const optionalFiles = [
    BASE_PATH + '/install.html',
    BASE_PATH + '/css/dark-mode.css',
    BASE_PATH + '/css/security.css',
    // تم إزالة جميع الأيقونات - سيتم جلبها من الشبكة دائماً لضمان الحصول على أحدث نسخة
    BASE_PATH + '/vertopal.com_photo_5922357566287580087_y.png'
    // باقي ملفات JS سيتم تحميلها عند الحاجة (lazy loading)
];

// متغير لتتبع العمليات المعلقة
let pendingOperations = new Set();

// دالة لإضافة ملفات بشكل آمن مع معالجة الأخطاء و timeout
async function cacheFilesSafely(cache, files, isEssential = false) {
    const CACHE_TIMEOUT = 3000; // تقليل timeout إلى 3 ثواني لتسريع التحميل
    
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
    
    // دعم المتصفحات القديمة التي لا تدعم URL constructor
    let url;
    try {
        url = new URL(request.url);
    } catch (e) {
        // للمتصفحات القديمة
        url = { pathname: request.url };
    }
    
    // معالجة طلبات API وملفات PHP - السماح بمرور جميع الاستجابات من الخادم
    if (url.pathname.includes('/api/') || url.pathname.endsWith('.php')) {
        // عدم اعتراض طلبات API وملفات PHP - السماح بمرورها مباشرة للخادم
        // هذا يضمن أن الأخطاء من الخادم (401, 404, 500) تصل للكود بشكل صحيح
        event.respondWith(
            fetch(request)
                .then(response => {
                    // إرجاع الاستجابة كما هي (حتى لو كانت خطأ من الخادم)
                    // هذا يسمح للكود بمعالجة الأخطاء بشكل صحيح
                    return response;
                })
                .catch(error => {
                    // فقط في حالة NetworkError (فشل الطلب تماماً)، نعرض رسالة عدم الاتصال
                    const isNetworkError = error.name === 'TypeError' || 
                                         error.name === 'NetworkError' ||
                                         (error.message && (
                                             error.message.includes('Failed to fetch') ||
                                             error.message.includes('NetworkError') ||
                                             error.message.includes('Network request failed') ||
                                             error.message.includes('Load failed')
                                         ));
                    
                    // فقط إذا كان خطأ شبكة فعلي، نعرض رسالة عدم الاتصال
                    if (isNetworkError) {
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

    // استراتيجية Network First دائماً للملفات الديناميكية (CSS/JS/HTML)
    // هذا يضمن أن الملفات المحدثة تُجلب من الشبكة أولاً دائماً
    // لا نستخدم cache للملفات الديناميكية لضمان الحصول على آخر إصدار
    const isDynamicFile = request.url.includes('?v=') || 
                         request.url.includes('?version=') ||
                         request.url.endsWith('.css') ||
                         request.url.endsWith('.js') ||
                         request.url.endsWith('.html') ||
                         request.url.includes('/icons/') ||
                         request.url.includes('/api/') ||
                         request.url.endsWith('.php');
    
    if (isDynamicFile) {
        // Network First دائماً - لا نستخدم cache للملفات الديناميكية
        // هذا يضمن الحصول على آخر إصدار من الخادم
        event.respondWith(
            fetch(request, {
                cache: 'no-store', // عدم استخدام cache المتصفح
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            })
                .then(response => {
                    // نرجع الاستجابة مباشرة بدون حفظها في cache
                    // لضمان الحصول على آخر إصدار دائماً
                    return response;
                })
                .catch(error => {
                    // فقط في حالة فشل الشبكة تماماً، نجرب من cache كـ fallback
                    console.warn('[SW] فشل جلب من الشبكة، استخدام cache:', request.url, error);
                    return caches.match(request).then(cachedResponse => {
                        if (cachedResponse) {
                            console.log('[SW] استخدام نسخة من cache:', request.url);
                            return cachedResponse;
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


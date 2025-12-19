// Service Worker للعمل بدون إنترنت
// دعم المتصفحات القديمة والحديثة

// رقم الإصدار - يتم تحديثه تلقائياً مع كل تعديل
// Version number - automatically updated with each modification
// يجب تحديث هذا الرقم يدوياً أو تلقائياً مع كل تعديل
const APP_VERSION = '2.0.1.' + Date.now(); // timestamp للتأكد من التحديث الفوري

const CACHE_NAME = 'mobile-repair-shop-' + APP_VERSION;

console.log('[Service Worker] Version:', APP_VERSION);
console.log('[Service Worker] Cache Name:', CACHE_NAME);

// Polyfill للمتصفحات القديمة
if (typeof self !== 'undefined' && !self.caches) {
    // Fallback بسيط للمتصفحات التي لا تدعم Cache API
    console.warn('[SW] Cache API not supported, using fallback');
}
const urlsToCache = [
    '/',
    '/index.html',
    '/dashboard.html',
    // '/chat.php', // ملفات PHP ديناميكية - لا يجب تخزينها في الـ cache
    '/install.html',
    '/manifest.json',
    '/css/style.css',
    '/css/dark-mode.css',
    '/css/print.css',
    '/css/security.css',
    '/css/chat-integrated.css',
    '/js/version.js', // ملف الإصدارات - مهم جداً
    '/js/api.js',
    '/js/auth.js',
    '/js/utils.js',
    '/js/chat-integrated.js',
    '/js/data-protection.js',
    '/js/security.js',
    '/js/sync.js',
    '/js/encryption.js',
    '/js/encryption-settings.js',
    '/js/barcode.js',
    '/js/small-label.js',
    '/js/image-management.js',
    '/js/backup-management.js',
    '/js/repairs.js',
    '/js/customers.js',
    '/js/inventory.js',
    '/js/expenses.js',
    '/js/reports.js',
    '/js/settings.js',
    '/js/pwa-install.js',
    '/vertopal.com_photo_5922357566287580087_y.png',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png',
    '/favicon.ico'
];

// متغير لتتبع العمليات المعلقة
let pendingOperations = new Set();

// التثبيت - حفظ الملفات في الـ cache
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    // دعم المتصفحات القديمة
    const installPromise = caches.open(CACHE_NAME)
        .then(cache => {
            console.log('[Service Worker] Caching app shell');
            // محاولة إضافة جميع الملفات
            return cache.addAll(urlsToCache).catch(error => {
                console.warn('[Service Worker] Some files failed to cache:', error);
                // في حالة الفشل، نحاول إضافة الملفات الأساسية فقط
                const essentialFiles = [
                    '/',
                    '/index.html',
                    '/manifest.json',
                    '/vertopal.com_photo_5922357566287580087_y.png'
                ];
                return cache.addAll(essentialFiles);
            });
        })
        .then(() => {
            // تفعيل Service Worker فوراً (للمتصفحات القديمة)
            if (self.skipWaiting) {
                return self.skipWaiting();
            }
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
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('mobile-repair-shop-')) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
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
        .then(() => {
            // إرسال رسالة لجميع العملاء لإعادة تحميل الصفحة
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: APP_VERSION,
                        message: 'تم تحديث Service Worker - سيتم إعادة تحميل الصفحة'
                    });
                });
            });
        });
    
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

    // استراتيجية Cache First للملفات الثابتة
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

// الإشعارات Push (جاهز للتفعيل لاحقاً)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'إشعار جديد';
    const options = {
        body: data.body || 'لديك إشعار جديد',
        icon: '/vertopal.com_photo_5922357566287580087_y.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        dir: 'rtl',
        lang: 'ar',
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// معالجة نقر على الإشعار
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
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


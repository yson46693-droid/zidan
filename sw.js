// Service Worker للعمل بدون إنترنت
const CACHE_NAME = 'mobile-repair-shop-v2.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/install.html',
    '/manifest.json',
    '/css/style.css',
    '/css/dark-mode.css',
    '/css/print.css',
    '/css/security.css',
    '/js/api.js',
    '/js/auth.js',
    '/js/utils.js',
    '/js/data-protection.js',
    '/js/security.js',
    '/js/sync.js',
    '/js/encryption.js',
    '/js/encryption-settings.js',
    '/js/barcode.js',
    '/js/small-label.js',
    '/js/image-management.js',
    '/js/test-connection.js',
    '/js/backup-management.js',
    '/js/repairs.js',
    '/js/customers.js',
    '/js/inventory.js',
    '/js/expenses.js',
    '/js/reports.js',
    '/js/settings.js',
    '/js/pwa-install.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/favicon.ico'
];

// متغير لتتبع العمليات المعلقة
let pendingOperations = new Set();

// التثبيت - حفظ الملفات في الـ cache
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// التفعيل - تنظيف الـ cache القديم
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// اعتراض الطلبات - استخدام الـ cache أو الشبكة
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // تجاهل طلبات API - Network First مع fallback للـ cache
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // إذا نجح الطلب، نعيد الاستجابة
                    if (response && response.ok) {
                        return response;
                    }
                    throw new Error('Network request failed');
                })
                .catch(() => {
                    // إذا فشل، نعيد رسالة خطأ JSON
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
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                // إذا كان موجود في الـ cache، نعيده
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // محاولة جلب من الشبكة
                return fetch(request).then(response => {
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
                    });

                    return response;
                }).catch(error => {
                    console.log('[SW] Fetch failed:', error);
                    
                    // إذا كان طلب HTML، نعيد صفحة offline
                    if (request.headers.get('accept').includes('text/html')) {
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
    );
});

// الإشعارات Push (جاهز للتفعيل لاحقاً)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'إشعار جديد';
    const options = {
        body: data.body || 'لديك إشعار جديد',
        icon: '/icons/icon-192x192.png',
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


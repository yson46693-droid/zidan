/**
 * Service Worker Diagnostics
 * Script للتحقق من حالة Service Worker على الدومين
 * 
 * الاستخدام: افتح Console وأدخل:
 *   checkServiceWorker()
 */

// دالة للتحقق من Service Worker
async function checkServiceWorker() {
    console.log('🔍 بدء فحص Service Worker...\n');
    
    const results = {
        supported: false,
        https: false,
        registered: false,
        active: false,
        scope: null,
        errors: []
    };
    
    // 1. تحقق من دعم Service Workers
    if ('serviceWorker' in navigator) {
        results.supported = true;
        console.log('✅ Service Workers مدعومة في المتصفح');
    } else {
        results.supported = false;
        results.errors.push('Service Workers غير مدعومة في هذا المتصفح');
        console.error('❌ Service Workers غير مدعومة في هذا المتصفح');
        return results;
    }
    
    // 2. تحقق من HTTPS
    if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        results.https = true;
        console.log('✅ HTTPS مفعّل (أو localhost)');
    } else {
        results.https = false;
        results.errors.push('Service Workers تتطلب HTTPS (الحالي: ' + location.protocol + ')');
        console.error('❌ Service Workers تتطلب HTTPS');
        console.error('   الحالي:', location.protocol);
        return results;
    }
    
    // 3. تحقق من Service Worker المسجل
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length === 0) {
            results.registered = false;
            results.errors.push('لا يوجد Service Worker مسجل');
            console.warn('⚠️ لا يوجد Service Worker مسجل');
        } else {
            results.registered = true;
            console.log('✅ تم العثور على', registrations.length, 'Service Worker(s) مسجل(ة)');
            
            registrations.forEach((reg, index) => {
                console.log(`\n📋 Service Worker #${index + 1}:`);
                console.log('   Scope:', reg.scope);
                console.log('   Active:', reg.active ? '✅ نعم' : '❌ لا');
                console.log('   Installing:', reg.installing ? '⏳ قيد التثبيت' : '❌ لا');
                console.log('   Waiting:', reg.waiting ? '⏳ في الانتظار' : '❌ لا');
                
                if (reg.active) {
                    results.active = true;
                    results.scope = reg.scope;
                }
            });
        }
    } catch (error) {
        results.errors.push('خطأ في جلب Service Worker registrations: ' + error.message);
        console.error('❌ خطأ في جلب Service Worker registrations:', error);
    }
    
    // 4. تحقق من Controller
    if (navigator.serviceWorker.controller) {
        console.log('\n✅ Service Worker Controller نشط');
        console.log('   Controller URL:', navigator.serviceWorker.controller.scriptURL);
        results.active = true;
    } else {
        console.warn('\n⚠️ لا يوجد Service Worker Controller نشط');
    }
    
    // 5. محاولة تسجيل Service Worker للتجربة
    console.log('\n🔧 محاولة التحقق من Service Worker URL...');
    try {
        const basePath = window.BASE_PATH || '';
        const swUrl = basePath ? `${basePath}/sw.js.php` : '/sw.js.php';
        console.log('   محاولة الوصول إلى:', swUrl);
        
        const response = await fetch(swUrl, { method: 'HEAD' });
        console.log('   Status:', response.status, response.statusText);
        
        const contentType = response.headers.get('Content-Type');
        console.log('   Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/javascript')) {
            console.log('   ✅ Content-Type صحيح');
        } else {
            results.errors.push('Content-Type غير صحيح: ' + contentType);
            console.warn('   ⚠️ Content-Type يجب أن يكون application/javascript');
        }
        
        const swAllowed = response.headers.get('Service-Worker-Allowed');
        console.log('   Service-Worker-Allowed:', swAllowed || '(غير موجود)');
        
        if (swAllowed) {
            console.log('   ✅ Service-Worker-Allowed موجود');
        } else {
            console.warn('   ⚠️ Service-Worker-Allowed غير موجود (موصى به)');
        }
        
    } catch (error) {
        results.errors.push('خطأ في الوصول إلى Service Worker URL: ' + error.message);
        console.error('   ❌ خطأ في الوصول إلى Service Worker URL:', error);
    }
    
    // 6. ملخص النتائج
    console.log('\n' + '='.repeat(50));
    console.log('📊 ملخص النتائج:');
    console.log('='.repeat(50));
    console.log('Service Workers مدعومة:', results.supported ? '✅' : '❌');
    console.log('HTTPS مفعّل:', results.https ? '✅' : '❌');
    console.log('Service Worker مسجل:', results.registered ? '✅' : '❌');
    console.log('Service Worker نشط:', results.active ? '✅' : '❌');
    console.log('Scope:', results.scope || 'N/A');
    
    if (results.errors.length > 0) {
        console.log('\n❌ الأخطاء:');
        results.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    } else {
        console.log('\n✅ لا توجد أخطاء!');
    }
    
    return results;
}

// دالة لمسح Service Workers وإعادة التسجيل
async function resetServiceWorker() {
    console.log('🔄 مسح Service Workers وإعادة التسجيل...\n');
    
    try {
        // 1. إلغاء تسجيل جميع Service Workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('تم العثور على', registrations.length, 'Service Worker(s)');
        
        for (const registration of registrations) {
            const unregistered = await registration.unregister();
            console.log('إلغاء تسجيل Service Worker:', registration.scope, unregistered ? '✅' : '❌');
        }
        
        // 2. مسح Cache Storage
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log('\nتم العثور على', cacheNames.length, 'cache(s)');
            
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('مسح cache:', cacheName, '✅');
            }
        }
        
        // 3. إعادة تحميل الصفحة
        console.log('\n✅ تم المسح بنجاح');
        console.log('🔄 سيتم إعادة تحميل الصفحة الآن...');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('❌ خطأ في مسح Service Workers:', error);
    }
}

// تصدير الدوال للاستخدام
if (typeof window !== 'undefined') {
    window.checkServiceWorker = checkServiceWorker;
    window.resetServiceWorker = resetServiceWorker;
    console.log('💡 Service Worker Diagnostics جاهز!');
    console.log('   استخدم: checkServiceWorker() للتحقق');
    console.log('   استخدم: resetServiceWorker() للمسح وإعادة التسجيل');
}

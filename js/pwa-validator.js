/**
 * PWA Validator - التحقق الشامل من متطلبات PWA
 * أداة للتحقق من أن جميع متطلبات PWA متوفرة
 */

// ✅ منع إعادة التصريح عند تحميل الملف عدة مرات
if (typeof PWAValidator === 'undefined') {
    class PWAValidator {
        constructor() {
        this.results = {
            https: false,
            manifest: false,
            manifestValid: false,
            icons: false,
            serviceWorker: false,
            installable: false
        };
    }
    
    async validate() {
        console.log('🔍 بدء التحقق الشامل من PWA...\n');
        
        // 1. HTTPS
        this.checkHTTPS();
        
        // 2. Manifest
        await this.checkManifest();
        
        // 3. Service Worker
        await this.checkServiceWorker();
        
        // 4. Icons
        await this.checkIcons();
        
        // 5. Installability
        await this.checkInstallability();
        
        // 6. عرض النتائج
        this.displayResults();
        
        return this.results;
    }
    
    checkHTTPS() {
        const isSecure = window.location.protocol === 'https:' || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '[::1]';
        
        this.results.https = isSecure;
        console.log(`HTTPS: ${isSecure ? '✅' : '❌'} ${window.location.protocol}`);
    }
    
    async checkManifest() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        
        if (!manifestLink) {
            console.log('Manifest Link: ❌ غير موجود في HTML');
            return;
        }
        
        console.log(`Manifest Link: ✅ موجود (${manifestLink.href})`);
        this.results.manifest = true;
        
        try {
            const response = await fetch(manifestLink.href);
            
            if (!response.ok) {
                console.log(`Manifest File: ❌ غير قابل للوصول (HTTP ${response.status})`);
                return;
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('json')) {
                console.log(`Manifest Content-Type: ⚠️ ${contentType || 'unknown'}`);
            } else {
                console.log(`Manifest Content-Type: ✅ ${contentType}`);
            }
            
            const manifest = await response.json();
            
            // التحقق من الحقول المطلوبة
            const required = ['name', 'short_name', 'start_url', 'display', 'icons'];
            const missing = required.filter(f => !manifest[f]);
            
            if (missing.length > 0) {
                console.log(`Manifest Fields: ❌ حقول مفقودة: ${missing.join(', ')}`);
                return;
            }
            
            // التحقق من الأيقونات
            if (!manifest.icons || manifest.icons.length === 0) {
                console.log('Manifest Icons: ❌ لا توجد أيقونات');
                return;
            }
            
            // التحقق من وجود أيقونات 192 و 512
            const sizes192 = manifest.icons.some(icon => 
                icon.sizes && (icon.sizes.includes('192') || icon.sizes === '192x192')
            );
            const sizes512 = manifest.icons.some(icon => 
                icon.sizes && (icon.sizes.includes('512') || icon.sizes === '512x512')
            );
            
            if (!sizes192 || !sizes512) {
                console.log(`Manifest Icons: ⚠️ أيقونة 192x192: ${sizes192 ? '✅' : '❌'}, أيقونة 512x512: ${sizes512 ? '✅' : '❌'}`);
            } else {
                console.log(`Manifest Icons: ✅ ${manifest.icons.length} أيقونة (192x192 ✅, 512x512 ✅)`);
            }
            
            this.results.manifestValid = true;
            console.log(`Manifest Valid: ✅ جميع الحقول موجودة وصحيحة`);
            
        } catch (error) {
            console.log(`Manifest Check: ❌ خطأ: ${error.message}`);
        }
    }
    
    async checkServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker Support: ❌ غير مدعوم');
            return;
        }
        
        console.log('Service Worker Support: ✅ مدعوم');
        
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            
            if (registrations.length === 0) {
                console.log('Service Worker Registered: ❌ غير مسجل');
                return;
            }
            
            this.results.serviceWorker = true;
            console.log(`Service Worker Registered: ✅ ${registrations.length} تسجيل`);
            
            registrations.forEach((reg, index) => {
                console.log(`   ${index + 1}. Scope: ${reg.scope}, Active: ${reg.active ? 'Yes' : 'No'}`);
            });
            
        } catch (error) {
            console.log(`Service Worker Check: ❌ خطأ: ${error.message}`);
        }
    }
    
    async checkIcons() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) return;
        
        try {
            const response = await fetch(manifestLink.href);
            const manifest = await response.json();
            
            if (!manifest.icons || manifest.icons.length === 0) {
                console.log('Icons Accessibility: ❌ لا توجد أيقونات');
                return;
            }
            
            let accessible = 0;
            const checks = [];
            
            for (const icon of manifest.icons) {
                try {
                    const iconResponse = await fetch(icon.src, { method: 'HEAD' });
                    if (iconResponse.ok) {
                        accessible++;
                        checks.push(`✅ ${icon.src}`);
                    } else {
                        checks.push(`❌ ${icon.src} (HTTP ${iconResponse.status})`);
                    }
                } catch (error) {
                    checks.push(`❌ ${icon.src} (خطأ)`);
                }
            }
            
            if (accessible === manifest.icons.length) {
                this.results.icons = true;
                console.log(`Icons Accessibility: ✅ جميع الأيقونات متاحة (${accessible}/${manifest.icons.length})`);
            } else {
                console.log(`Icons Accessibility: ⚠️ ${accessible}/${manifest.icons.length} متاحة`);
                checks.forEach(check => console.log(`   ${check}`));
            }
            
        } catch (error) {
            console.log(`Icons Check: ❌ خطأ: ${error.message}`);
        }
    }
    
    async checkInstallability() {
        // التحقق من beforeinstallprompt
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                const allRequirements = 
                    this.results.https &&
                    this.results.manifest &&
                    this.results.manifestValid &&
                    this.results.icons &&
                    this.results.serviceWorker;
                
                if (allRequirements) {
                    this.results.installable = true;
                    console.log('Installability: ✅ جميع المتطلبات متوفرة');
                    console.log('   ملاحظة: Chrome قد لا يظهر زر التثبيت تلقائياً حتى مع توفر جميع المتطلبات');
                    console.log('   استخدم Ctrl+Shift+A أو قائمة Chrome → تثبيت التطبيق');
                } else {
                    console.log('Installability: ❌ بعض المتطلبات مفقودة');
                }
                resolve();
            }, 2000);
            
            window.addEventListener('beforeinstallprompt', (e) => {
                clearTimeout(timeout);
                this.results.installable = true;
                console.log('Installability: ✅ beforeinstallprompt event fired!');
                resolve();
            }, { once: true });
        });
    }
    
    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ملخص نتائج التحقق من PWA');
        console.log('='.repeat(60));
        console.log(`HTTPS:              ${this.results.https ? '✅' : '❌'}`);
        console.log(`Manifest Link:      ${this.results.manifest ? '✅' : '❌'}`);
        console.log(`Manifest Valid:     ${this.results.manifestValid ? '✅' : '❌'}`);
        console.log(`Icons:              ${this.results.icons ? '✅' : '❌'}`);
        console.log(`Service Worker:     ${this.results.serviceWorker ? '✅' : '❌'}`);
        console.log(`Installable:        ${this.results.installable ? '✅' : '⚠️'}`);
        console.log('='.repeat(60));
        
        const allPassed = 
            this.results.https &&
            this.results.manifest &&
            this.results.manifestValid &&
            this.results.icons &&
            this.results.serviceWorker;
        
        if (allPassed) {
            console.log('\n✅ جميع متطلبات PWA الأساسية متوفرة!');
            console.log('💡 للوصول إلى زر التثبيت:');
            console.log('   - Chrome/Edge: Ctrl+Shift+A أو قائمة → تثبيت التطبيق');
            console.log('   - Firefox: قائمة → المزيد من الأدوات → تثبيت كتطبيق');
            console.log('   - أو افتح /install.html');
        } else {
            console.log('\n❌ بعض متطلبات PWA مفقودة');
        }
        console.log('\n');
    }
} // ✅ إغلاق الـ class

// ✅ تصدير - خارج الـ class
if (typeof window !== 'undefined') {
    window.PWAValidator = PWAValidator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAValidator;
}
}

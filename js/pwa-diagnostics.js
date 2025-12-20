/**
 * PWA Diagnostics Tool
 * أداة تشخيص PWA للتحقق من جميع المتطلبات
 */

class PWADiagnostics {
    constructor() {
        this.results = {
            serviceWorker: false,
            manifest: false,
            icons: false,
            https: false,
            installable: false
        };
    }
    
    async runDiagnostics() {
        console.log('🔍 بدء تشخيص PWA...');
        
        // 1. التحقق من HTTPS
        this.checkHTTPS();
        
        // 2. التحقق من Service Worker
        await this.checkServiceWorker();
        
        // 3. التحقق من Manifest
        await this.checkManifest();
        
        // 4. التحقق من الأيقونات
        await this.checkIcons();
        
        // 5. التحقق من Installability
        await this.checkInstallability();
        
        // 6. عرض النتائج
        this.displayResults();
        
        return this.results;
    }
    
    checkHTTPS() {
        const isSecure = window.location.protocol === 'https:' || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
        
        this.results.https = isSecure;
        
        if (isSecure) {
            console.log('✅ HTTPS: متوفر');
        } else {
            console.error('❌ HTTPS: غير متوفر (PWA يتطلب HTTPS)');
        }
    }
    
    async checkServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                if (registrations.length > 0) {
                    this.results.serviceWorker = true;
                    console.log('✅ Service Worker: مسجل بنجاح');
                    console.log('   - عدد التسجيلات:', registrations.length);
                    registrations.forEach((reg, index) => {
                        console.log(`   - التسجيل ${index + 1}:`, reg.scope);
                    });
                } else {
                    console.warn('⚠️ Service Worker: غير مسجل');
                }
            } catch (error) {
                console.error('❌ Service Worker: خطأ في التحقق', error);
            }
        } else {
            console.error('❌ Service Worker: غير مدعوم في هذا المتصفح');
        }
    }
    
    async checkManifest() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        
        if (!manifestLink) {
            console.error('❌ Manifest: رابط manifest غير موجود في HTML');
            return;
        }
        
        try {
            const response = await fetch(manifestLink.href);
            
            if (!response.ok) {
                console.error(`❌ Manifest: غير قابل للوصول (HTTP ${response.status})`);
                return;
            }
            
            const manifest = await response.json();
            
            // التحقق من الحقول المطلوبة
            const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
            const missingFields = requiredFields.filter(field => !manifest[field]);
            
            if (missingFields.length > 0) {
                console.error('❌ Manifest: حقول مفقودة:', missingFields);
                return;
            }
            
            // التحقق من الأيقونات
            if (!manifest.icons || manifest.icons.length === 0) {
                console.error('❌ Manifest: لا توجد أيقونات');
                return;
            }
            
            // التحقق من وجود أيقونة 192x192 على الأقل
            const has192 = manifest.icons.some(icon => 
                icon.sizes && (icon.sizes.includes('192') || icon.sizes.includes('192x192'))
            );
            const has512 = manifest.icons.some(icon => 
                icon.sizes && (icon.sizes.includes('512') || icon.sizes.includes('512x512'))
            );
            
            if (!has192 && !has512) {
                console.warn('⚠️ Manifest: لا توجد أيقونة 192x192 أو 512x512 (مطلوبة)');
            }
            
            this.results.manifest = true;
            console.log('✅ Manifest: صحيح ومتوفر');
            console.log('   - الاسم:', manifest.name);
            console.log('   - الاسم المختصر:', manifest.short_name);
            console.log('   - عدد الأيقونات:', manifest.icons.length);
            console.log('   - أيقونة 192x192:', has192 ? '✅' : '❌');
            console.log('   - أيقونة 512x512:', has512 ? '✅' : '❌');
            
        } catch (error) {
            console.error('❌ Manifest: خطأ في القراءة', error);
        }
    }
    
    async checkIcons() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) return;
        
        try {
            const response = await fetch(manifestLink.href);
            const manifest = await response.json();
            
            if (!manifest.icons || manifest.icons.length === 0) {
                console.error('❌ Icons: لا توجد أيقونات في manifest');
                return;
            }
            
            let accessibleIcons = 0;
            const iconChecks = [];
            
            for (const icon of manifest.icons) {
                try {
                    const iconResponse = await fetch(icon.src, { method: 'HEAD' });
                    if (iconResponse.ok) {
                        accessibleIcons++;
                        iconChecks.push({ src: icon.src, status: '✅' });
                    } else {
                        iconChecks.push({ src: icon.src, status: `❌ (HTTP ${iconResponse.status})` });
                    }
                } catch (error) {
                    iconChecks.push({ src: icon.src, status: '❌ (خطأ في الوصول)' });
                }
            }
            
            if (accessibleIcons === manifest.icons.length) {
                this.results.icons = true;
                console.log(`✅ Icons: جميع الأيقونات متاحة (${accessibleIcons}/${manifest.icons.length})`);
            } else {
                console.warn(`⚠️ Icons: بعض الأيقونات غير متاحة (${accessibleIcons}/${manifest.icons.length})`);
                iconChecks.forEach(check => {
                    console.log(`   ${check.status} ${check.src}`);
                });
            }
        } catch (error) {
            console.error('❌ Icons: خطأ في التحقق', error);
        }
    }
    
    async checkInstallability() {
        // التحقق من beforeinstallprompt event
        let installPromptAvailable = false;
        
        const checkPrompt = () => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(false);
                }, 3000);
                
                window.addEventListener('beforeinstallprompt', (e) => {
                    clearTimeout(timeout);
                    resolve(true);
                }, { once: true });
            });
        };
        
        installPromptAvailable = await checkPrompt();
        
        if (installPromptAvailable) {
            this.results.installable = true;
            console.log('✅ Installability: يمكن تثبيت PWA');
        } else {
            // التحقق من المتطلبات الأخرى
            const allRequirementsMet = 
                this.results.https &&
                this.results.serviceWorker &&
                this.results.manifest &&
                this.results.icons;
            
            if (allRequirementsMet) {
                console.log('⚠️ Installability: جميع المتطلبات متوفرة ولكن beforeinstallprompt لم يظهر بعد');
                console.log('   - قد تحتاج للانتظار قليلاً أو تحديث الصفحة');
                console.log('   - Chrome قد لا يظهر زر التثبيت إذا كان التطبيق مثبتاً بالفعل');
            } else {
                console.warn('⚠️ Installability: بعض المتطلبات مفقودة');
            }
        }
    }
    
    displayResults() {
        console.log('\n📊 ملخص نتائج التشخيص:');
        console.log('─'.repeat(50));
        console.log(`HTTPS:              ${this.results.https ? '✅' : '❌'}`);
        console.log(`Service Worker:     ${this.results.serviceWorker ? '✅' : '❌'}`);
        console.log(`Manifest:           ${this.results.manifest ? '✅' : '❌'}`);
        console.log(`Icons:              ${this.results.icons ? '✅' : '❌'}`);
        console.log(`Installable:        ${this.results.installable ? '✅' : '⚠️'}`);
        console.log('─'.repeat(50));
        
        const allPassed = Object.values(this.results).every(result => result === true);
        
        if (allPassed) {
            console.log('✅ جميع متطلبات PWA متوفرة!');
        } else {
            console.log('❌ بعض متطلبات PWA مفقودة');
        }
    }
}

// تصدير للاستخدام
if (typeof window !== 'undefined') {
    window.PWADiagnostics = PWADiagnostics;
    
    // تشغيل تلقائي في console
    if (window.console) {
        console.log('💡 لفحص PWA، استخدم: new PWADiagnostics().runDiagnostics()');
    }
}

// تصدير للاستخدام في modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWADiagnostics;
}

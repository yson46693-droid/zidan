// إدارة تثبيت PWA
class PWAInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isStandalone = false;
        
        this.init();
    }
    
    init() {
        // التحقق من أن التطبيق مثبت بالفعل
        this.checkIfInstalled();
        
        // الاستماع لحدث beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('✅ PWA install prompt available (beforeinstallprompt event fired)');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
            
            // إظهار زر التثبيت فوراً
            const installButton = document.getElementById('installButton');
            const installLink = document.getElementById('installLink');
            if (installButton) {
                installButton.classList.remove('hidden');
                installButton.style.display = 'inline-flex';
            }
            if (installLink) {
                installLink.style.display = 'inline-block';
            }
        });
        
        // الاستماع لحدث appinstalled
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.deferredPrompt = null;
            this.showSuccessMessage('تم تثبيت التطبيق بنجاح! 🎉');
        });
        
        // التحقق من وضع standalone (مثبت)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isStandalone = true;
            this.isInstalled = true;
            console.log('✅ App is running in standalone mode');
            return; // لا حاجة لإظهار زر التثبيت إذا كان مثبتاً
        }
        
        // التحقق من جميع الأنظمة
        const browser = this.getBrowser();
        const installInfo = this.getInstallInfo();
        
        console.log('📱 Device Info:', installInfo);
        console.log('🌐 Browser:', browser);
        
        // التحقق من iOS
        if (this.isIOS()) {
            this.handleIOSInstall();
        }
        
        // التحقق من Android
        if (this.isAndroid()) {
            this.handleAndroidInstall();
        }
        
        // التحقق من Windows/Chrome Desktop - إظهار زر التثبيت حتى بدون deferredPrompt
        if (this.isWindows() || (browser === 'chrome' && !this.isAndroid() && !this.isIOS())) {
            console.log('🪟 Windows/Chrome Desktop detected - checking install capability');
            this.handleWindowsInstall();
            // إظهار زر التثبيت بعد فترة قصيرة حتى لو لم يظهر beforeinstallprompt
            setTimeout(() => {
                if (!this.isStandaloneMode()) {
                    // التحقق من أن Service Worker مسجل و Manifest موجود
                    this.checkPWARequirements().then(canInstall => {
                        if (canInstall) {
                            console.log('✅ PWA requirements met - showing install button for Chrome');
                            this.showInstallButtonForChrome();
                        } else {
                            console.warn('⚠️ PWA requirements not met - cannot show install button');
                        }
                    }).catch(error => {
                        console.error('❌ Error checking PWA requirements:', error);
                    });
                }
            }, 2000); // زيادة الوقت للانتظار إلى ثانيتين
        }
        
        // التحقق من المتصفحات القديمة
        if (browser === 'ie' || !this.isSupported()) {
            this.handleLegacyBrowser();
        }
        
        // التحقق من Firefox - إظهار زر التثبيت دائماً
        if (browser === 'firefox') {
            console.log('🦊 Firefox detected - initializing install button');
            this.handleFirefoxInstall();
            // إظهار زر التثبيت حتى بدون deferredPrompt
            if (!this.isStandaloneMode()) {
                // استخدام setTimeout لضمان تحميل DOM بالكامل
                setTimeout(() => {
                    this.showInstallButtonForFirefox();
                }, 200);
            }
        }
    }
    
    checkIfInstalled() {
        // التحقق من وضع standalone
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            this.isStandalone = true;
            return true;
        }
        
        // التحقق من وجود Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                if (registrations.length > 0) {
                    console.log('✅ Service Worker is registered');
                }
            });
        }
        
        return false;
    }
    
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    isAndroid() {
        return /Android/.test(navigator.userAgent);
    }
    
    isWindows() {
        return /Windows/.test(navigator.userAgent);
    }
    
    isMacOS() {
        return /Macintosh|Mac OS X/.test(navigator.userAgent);
    }
    
    isLinux() {
        return /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
    }
    
    getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) return 'chrome';
        if (ua.includes('Firefox')) return 'firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
        if (ua.includes('Edg')) return 'edge';
        if (ua.includes('OPR')) return 'opera';
        if (ua.includes('MSIE') || ua.includes('Trident')) return 'ie';
        return 'unknown';
    }
    
    isStandaloneMode() {
        // دعم جميع الطرق للتحقق من وضع standalone
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
               (window.navigator && window.navigator.standalone === true) ||
               (document.referrer && document.referrer.includes('android-app://')) ||
               (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
               (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches);
    }
    
    async install() {
        // في Chrome Desktop، إذا لم يكن deferredPrompt متاحاً، نتحقق من المتطلبات
        const browser = this.getBrowser();
        const isChromeDesktop = browser === 'chrome' && !this.isAndroid() && !this.isIOS();
        
        if (!this.deferredPrompt) {
            if (isChromeDesktop) {
                // في Chrome Desktop، نعرض تعليمات التثبيت اليدوي
                this.showChromeInstallInstructions();
                return false;
            }
            this.showInfoMessage('يرجى استخدام التعليمات المخصصة لجهازك لتثبيت التطبيق');
            return false;
        }
        
        try {
            // إظهار نافذة التثبيت
            this.deferredPrompt.prompt();
            
            // انتظار اختيار المستخدم
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                this.showSuccessMessage('جاري تثبيت التطبيق...');
                this.deferredPrompt = null;
                return true;
            } else {
                this.showInfoMessage('تم إلغاء التثبيت');
                return false;
            }
        } catch (error) {
            console.error('Error during install:', error);
            // في حالة الخطأ، إذا كان Chrome Desktop، نعرض التعليمات
            if (isChromeDesktop) {
                this.showChromeInstallInstructions();
            } else {
                this.showErrorMessage('حدث خطأ أثناء التثبيت. يرجى المحاولة مرة أخرى.');
            }
            return false;
        }
    }
    
    showChromeInstallInstructions() {
        const message = `
            <div style="text-align: right; padding: 15px; direction: rtl;">
                <strong style="font-size: 1.1em; display: block; margin-bottom: 10px;">📥 لتثبيت التطبيق في Chrome:</strong>
                <ol style="margin: 10px 0; padding-right: 20px; line-height: 1.8;">
                    <li>ابحث عن أيقونة التثبيت (📥 أو ➕) في شريط العنوان بجانب شريط البحث</li>
                    <li>أو افتح قائمة Chrome (☰) → "تثبيت التطبيق..."</li>
                    <li>أو استخدم الاختصار: <kbd>Ctrl+Shift+A</kbd> (Windows) أو <kbd>Cmd+Shift+A</kbd> (Mac)</li>
                </ol>
                <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                    💡 <strong>ملاحظة:</strong> إذا لم تظهر أيقونة التثبيت، تأكد من أنك تتصفح عبر HTTPS وأن Service Worker نشط.
                </p>
            </div>
        `;
        
        // محاولة إظهار الرسالة في عنصر statusMessage إذا كان موجوداً
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.innerHTML = message;
            statusMessage.className = 'status-message info';
            statusMessage.style.display = 'block';
            
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 15000);
        } else {
            // إذا لم يكن موجوداً، نستخدم alert مع رسالة مبسطة
            const simpleMessage = 'لتثبيت التطبيق في Chrome:\n\n' +
                '1. ابحث عن أيقونة التثبيت (📥) في شريط العنوان\n' +
                '2. أو افتح قائمة Chrome (☰) → "تثبيت التطبيق..."\n' +
                '3. أو استخدم الاختصار: Ctrl+Shift+A';
            alert(simpleMessage);
        }
    }
    
    showInstallButton() {
        const installButton = document.getElementById('installButton');
        const installLink = document.getElementById('installLink');
        
        if (installButton) {
            console.log('✅ Showing install button');
            installButton.classList.remove('hidden');
            installButton.style.display = 'inline-flex';
            
            // إزالة أي event listeners سابقة وإضافة جديدة
            const newButton = installButton.cloneNode(true);
            installButton.parentNode.replaceChild(newButton, installButton);
            const buttonElement = document.getElementById('installButton');
            if (buttonElement) {
                buttonElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.getBrowser() === 'firefox') {
                        this.installForFirefox();
                    } else {
                        this.install();
                    }
                });
            }
        }
        
        if (installLink) {
            console.log('✅ Showing install link');
            installLink.style.display = 'inline-block';
        }
    }
    
    hideInstallButton() {
        const installButton = document.getElementById('installButton');
        if (installButton) {
            installButton.classList.add('hidden');
        }
    }
    
    handleIOSInstall() {
        // على iOS، لا يمكن تثبيت PWA تلقائياً
        // يجب على المستخدم استخدام زر المشاركة في Safari
        if (!this.isStandaloneMode()) {
            console.log('📱 iOS detected - manual install required');
            this.showIOSInstructions();
        }
    }
    
    handleAndroidInstall() {
        // على Android، يمكن تثبيت PWA تلقائياً
        if (!this.isStandaloneMode() && this.deferredPrompt) {
            console.log('🤖 Android detected - install prompt available');
        }
    }
    
    handleWindowsInstall() {
        // Windows 10+ يدعم PWA
        if (!this.isStandaloneMode()) {
            console.log('🪟 Windows detected - PWA supported');
        }
    }
    
    // التحقق من متطلبات PWA
    async checkPWARequirements() {
        // ✅ انتظار تسجيل Service Worker (بحد أقصى 5 ثوان)
        if ('serviceWorker' in navigator) {
            let attempts = 0;
            const maxAttempts = 10; // 5 ثوان (500ms × 10)
            
            while (attempts < maxAttempts) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    if (registrations.length > 0) {
                        console.log('✅ Service Worker registered');
                        break; // Service Worker موجود
                    }
                } catch (error) {
                    // تجاهل الأخطاء مؤقتاً
                }
                
                // انتظار 500ms قبل المحاولة التالية
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            // التحقق النهائي
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                if (registrations.length === 0) {
                    // ✅ لا نعرض warning إذا كان Service Worker قيد التسجيل
                    const isRegistering = window.serviceWorkerRegistering || false;
                    if (!isRegistering) {
                        console.warn('⚠️ No Service Worker registered');
                    }
                    return false;
                }
            } catch (error) {
                console.warn('⚠️ Error checking Service Worker:', error);
                return false;
            }
        } else {
            console.warn('⚠️ Service Worker not supported');
            return false;
        }
        
        // التحقق من وجود Manifest
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            console.warn('⚠️ Manifest not found');
            return false;
        }
        
        // التحقق من أن Manifest قابل للوصول
        try {
            const manifestResponse = await fetch(manifestLink.href);
            if (!manifestResponse.ok) {
                console.warn('⚠️ Manifest not accessible');
                return false;
            }
            const manifest = await manifestResponse.json();
            if (!manifest.icons || manifest.icons.length === 0) {
                console.warn('⚠️ Manifest missing icons');
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Error checking manifest:', error);
            return false;
        }
        
        return true;
    }
    
    // إظهار زر التثبيت لـ Chrome Desktop
    showInstallButtonForChrome() {
        const installButton = document.getElementById('installButton');
        const installLink = document.getElementById('installLink');
        
        if (installButton) {
            console.log('🪟 Chrome Desktop: Showing install button');
            installButton.classList.remove('hidden');
            installButton.style.display = 'inline-flex';
            
            // إزالة أي event listeners سابقة وإضافة جديدة
            const newButton = installButton.cloneNode(true);
            installButton.parentNode.replaceChild(newButton, installButton);
            const buttonElement = document.getElementById('installButton');
            if (buttonElement) {
                buttonElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔘 Install button clicked, deferredPrompt:', !!this.deferredPrompt);
                    if (this.deferredPrompt) {
                        this.install();
                    } else {
                        // محاولة التثبيت مع إظهار التعليمات
                        this.install();
                    }
                });
            }
        } else {
            console.warn('⚠️ installButton element not found in DOM');
        }
        
        if (installLink) {
            console.log('🪟 Chrome Desktop: Showing install link');
            installLink.style.display = 'inline-block';
            // إضافة event listener للرابط أيضاً
            installLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.deferredPrompt) {
                    this.install();
                } else {
                    this.install();
                }
            });
        }
    }
    
    handleFirefoxInstall() {
        // Firefox يدعم PWA لكن بطريقة مختلفة
        if (!this.isStandaloneMode()) {
            console.log('🦊 Firefox detected - showing install button');
            // إظهار زر التثبيت في Firefox حتى بدون deferredPrompt
            this.showInstallButtonForFirefox();
        }
    }
    
    showInstallButtonForFirefox() {
        const installButton = document.getElementById('installButton');
        if (installButton) {
            console.log('🦊 Firefox: Showing install button');
            installButton.classList.remove('hidden');
            installButton.style.display = 'inline-flex'; // للتأكد من الظهور
            
            // إزالة أي event listeners سابقة
            const newButton = installButton.cloneNode(true);
            installButton.parentNode.replaceChild(newButton, installButton);
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.installForFirefox();
            });
            
            console.log('🦊 Firefox: Install button is now visible');
        } else {
            console.warn('🦊 Firefox: Install button not found in DOM');
        }
    }
    
    async installForFirefox() {
        // في Firefox، نوجه المستخدم للقائمة
        const browser = this.getBrowser();
        
        if (browser === 'firefox') {
            // عرض رسالة توضيحية
            this.showInfoMessage('في Firefox: افتح القائمة (☰) → المزيد من الأدوات → تثبيت كتطبيق');
            
            // إظهار تعليمات Firefox تلقائياً
            setTimeout(() => {
                // محاولة استدعاء دالة showInstructions إذا كانت موجودة
                if (typeof window.showInstructions === 'function') {
                    window.showInstructions('firefox');
                } else {
                    // إذا لم تكن موجودة، نعرض التعليمات مباشرة
                    const instructions = document.getElementById('instructions');
                    const title = document.getElementById('instructionsTitle');
                    const content = document.getElementById('instructionsContent');
                    
                    if (instructions && title && content) {
                        title.textContent = 'تثبيت على Firefox';
                        content.innerHTML = `
                            <div class="instruction-item">
                                <i class="bi bi-three-dots"></i>
                                <div>
                                    <strong>1. افتح القائمة</strong>
                                    <span>اضغط على زر القائمة (☰) في الزاوية العلوية اليمنى</span>
                                </div>
                            </div>
                            <div class="instruction-item">
                                <i class="bi bi-tools"></i>
                                <div>
                                    <strong>2. اختر "المزيد من الأدوات"</strong>
                                    <span>من القائمة المنسدلة، اختر "المزيد من الأدوات"</span>
                                </div>
                            </div>
                            <div class="instruction-item">
                                <i class="bi bi-download"></i>
                                <div>
                                    <strong>3. اختر "تثبيت كتطبيق"</strong>
                                    <span>من القائمة الفرعية، اضغط على "تثبيت كتطبيق"</span>
                                </div>
                            </div>
                            <div class="instruction-item">
                                <i class="bi bi-check-circle"></i>
                                <div>
                                    <strong>4. تأكيد التثبيت</strong>
                                    <span>في النافذة المنبثقة، اضغط "تثبيت"</span>
                                </div>
                            </div>
                        `;
                        instructions.style.display = 'block';
                        instructions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            }, 500);
            
            return false;
        }
        
        // للمتصفحات الأخرى، نستخدم الطريقة العادية
        return await this.install();
    }
    
    handleLegacyBrowser() {
        // المتصفحات القديمة - عرض تعليمات بديلة
        console.log('⚠️ Legacy browser detected - showing alternative instructions');
    }
    
    showIOSInstructions() {
        // يمكن إضافة تعليمات خاصة بـ iOS هنا
        console.log('Show iOS install instructions');
    }
    
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }
    
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }
    
    showInfoMessage(message) {
        this.showMessage(message, 'info');
    }
    
    showMessage(message, type) {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.style.display = 'block';
            
            // إخفاء الرسالة بعد 5 ثوان
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }
    
    // التحقق من دعم PWA
    isSupported() {
        // دعم أساسي: Service Worker
        const hasServiceWorker = 'serviceWorker' in navigator;
        
        // دعم Manifest (حتى في المتصفحات القديمة)
        const hasManifest = 'onbeforeinstallprompt' in window || 
                           document.querySelector('link[rel="manifest"]') !== null;
        
        // دعم Cache API (للمتصفحات القديمة)
        const hasCache = 'caches' in window || 'cache' in window;
        
        return hasServiceWorker || hasManifest || hasCache;
    }
    
    // التحقق من دعم التثبيت التلقائي
    canAutoInstall() {
        // Chrome/Edge/Opera (Android & Desktop)
        if (this.deferredPrompt) return true;
        
        // iOS Safari (يدوي فقط)
        if (this.isIOS() && this.getBrowser() === 'safari') return false;
        
        // Firefox (يدوي)
        if (this.getBrowser() === 'firefox') return false;
        
        // IE (لا يدعم)
        if (this.getBrowser() === 'ie') return false;
        
        // المتصفحات القديمة الأخرى
        return false;
    }
    
    // الحصول على معلومات التثبيت
    getInstallInfo() {
        return {
            isInstalled: this.isInstalled,
            isStandalone: this.isStandalone,
            isIOS: this.isIOS(),
            isAndroid: this.isAndroid(),
            isWindows: this.isWindows(),
            isMacOS: this.isMacOS(),
            isLinux: this.isLinux(),
            browser: this.getBrowser(),
            canInstall: !!this.deferredPrompt,
            canAutoInstall: this.canAutoInstall(),
            isSupported: this.isSupported()
        };
    }
}

// تهيئة مدير التثبيت
let pwaInstallManager;

if (typeof window !== 'undefined') {
    // تهيئة فورية عند تحميل الملف
    const initPWAInstall = () => {
        if (!window.pwaInstallManager) {
            pwaInstallManager = new PWAInstallManager();
            window.pwaInstallManager = pwaInstallManager;
            console.log('✅ PWA Install Manager initialized');
        }
    };
    
    // تهيئة فورية إذا كان DOM جاهز
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initPWAInstall);
    } else {
        initPWAInstall();
    }
    
    // تهيئة إضافية عند DOMContentLoaded للتأكد
    window.addEventListener('DOMContentLoaded', () => {
        if (!window.pwaInstallManager) {
            pwaInstallManager = new PWAInstallManager();
            window.pwaInstallManager = pwaInstallManager;
        }
        
        // إضافة زر التثبيت في الصفحات الأخرى
        const installButton = document.getElementById('installButton');
        if (installButton) {
            // في صفحة install.html
            const browser = pwaInstallManager.getBrowser();
            const isChromeDesktop = browser === 'chrome' && !pwaInstallManager.isAndroid() && !pwaInstallManager.isIOS();
            
            // إظهار الزر في Firefox حتى بدون deferredPrompt
            if (browser === 'firefox' && !pwaInstallManager.isStandaloneMode()) {
                installButton.classList.remove('hidden');
                installButton.addEventListener('click', () => {
                    pwaInstallManager.installForFirefox();
                });
            } 
            // إظهار الزر في Chrome Desktop حتى بدون deferredPrompt (بعد التحقق من المتطلبات)
            else if (isChromeDesktop && !pwaInstallManager.isStandaloneMode()) {
                // التحقق من متطلبات PWA وإظهار الزر
                setTimeout(async () => {
                    const canInstall = await pwaInstallManager.checkPWARequirements();
                    if (canInstall) {
                        console.log('✅ Chrome Desktop: PWA requirements met, showing install button');
                        installButton.classList.remove('hidden');
                        installButton.style.display = 'inline-flex';
                        installButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Chrome install button clicked');
                            pwaInstallManager.install();
                        });
                    } else {
                        console.warn('⚠️ Chrome Desktop: PWA requirements not met');
                    }
                }, 2000);
            }
            // للمتصفحات الأخرى، نعرض الزر فقط إذا كان deferredPrompt متاحاً
            else if (pwaInstallManager.deferredPrompt) {
                installButton.classList.remove('hidden');
                installButton.addEventListener('click', () => {
                    pwaInstallManager.install();
                });
            }
        }
        
        // إظهار زر التثبيت في dashboard.html وأي صفحة أخرى
        const installLink = document.getElementById('installLink');
        const installButtonGlobal = document.getElementById('installButton');
        
        // معالجة installLink
        if (installLink) {
            const browser = pwaInstallManager.getBrowser();
            const isChromeDesktop = browser === 'chrome' && !pwaInstallManager.isAndroid() && !pwaInstallManager.isIOS();
            
            if (!pwaInstallManager.isStandaloneMode()) {
                // إظهار الرابط في Chrome Desktop و Firefox دائماً
                if (isChromeDesktop || browser === 'firefox' || pwaInstallManager.deferredPrompt) {
                    setTimeout(async () => {
                        if (isChromeDesktop) {
                            const canInstall = await pwaInstallManager.checkPWARequirements();
                            if (canInstall) {
                                installLink.style.display = 'inline-block';
                            }
                        } else {
                            installLink.style.display = 'inline-block';
                        }
                    }, 500);
                }
            }
        }
        
        // معالجة installButton في الصفحات الأخرى (index.html, dashboard.html)
        if (installButtonGlobal && !installButtonGlobal.onclick) {
            const browser = pwaInstallManager.getBrowser();
            const isChromeDesktop = browser === 'chrome' && !pwaInstallManager.isAndroid() && !pwaInstallManager.isIOS();
            
            if (!pwaInstallManager.isStandaloneMode()) {
                // إظهار الزر في Chrome Desktop و Firefox
                if (isChromeDesktop || browser === 'firefox' || pwaInstallManager.deferredPrompt) {
                    setTimeout(async () => {
                        if (isChromeDesktop) {
                            const canInstall = await pwaInstallManager.checkPWARequirements();
                            if (canInstall) {
                                installButtonGlobal.classList.remove('hidden');
                                installButtonGlobal.style.display = 'inline-flex';
                                installButtonGlobal.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    pwaInstallManager.install();
                                });
                            }
                        } else {
                            installButtonGlobal.classList.remove('hidden');
                            installButtonGlobal.style.display = 'inline-flex';
                            installButtonGlobal.addEventListener('click', (e) => {
                                e.preventDefault();
                                if (browser === 'firefox') {
                                    pwaInstallManager.installForFirefox();
                                } else {
                                    pwaInstallManager.install();
                                }
                            });
                        }
                    }, 2000);
                }
            }
        }
    });
}

// تصدير للاستخدام في ملفات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstallManager;
}

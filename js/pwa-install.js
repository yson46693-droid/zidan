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
            console.log('✅ PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
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
        }
        
        // التحقق من iOS
        if (this.isIOS()) {
            this.handleIOSInstall();
        }
        
        // التحقق من Android
        if (this.isAndroid()) {
            this.handleAndroidInstall();
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
    
    isStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone ||
               document.referrer.includes('android-app://');
    }
    
    async install() {
        if (!this.deferredPrompt) {
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
            this.showErrorMessage('حدث خطأ أثناء التثبيت. يرجى المحاولة مرة أخرى.');
            return false;
        }
    }
    
    showInstallButton() {
        const installButton = document.getElementById('installButton');
        if (installButton) {
            installButton.classList.remove('hidden');
            installButton.addEventListener('click', () => this.install());
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
        return 'serviceWorker' in navigator && 'PushManager' in window;
    }
    
    // الحصول على معلومات التثبيت
    getInstallInfo() {
        return {
            isInstalled: this.isInstalled,
            isStandalone: this.isStandalone,
            isIOS: this.isIOS(),
            isAndroid: this.isAndroid(),
            canInstall: !!this.deferredPrompt,
            isSupported: this.isSupported()
        };
    }
}

// تهيئة مدير التثبيت
let pwaInstallManager;

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        pwaInstallManager = new PWAInstallManager();
        
        // إضافة زر التثبيت في الصفحات الأخرى
        if (document.getElementById('installButton')) {
            // في صفحة install.html
            if (pwaInstallManager.deferredPrompt) {
                document.getElementById('installButton').addEventListener('click', () => {
                    pwaInstallManager.install();
                });
            }
        }
    });
}

// تصدير للاستخدام في ملفات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstallManager;
}

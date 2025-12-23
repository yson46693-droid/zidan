// نظام Splash Screen - شاشة البداية (لصفحة تسجيل الدخول فقط)
class SplashScreenManager {
    constructor() {
        this.splashElement = null;
        this.minDisplayTime = 1500; // الحد الأدنى للعرض: 1.5 ثانية
        this.startTime = Date.now();
        this.init();
    }

    init() {
        // التحقق من أننا في صفحة تسجيل الدخول فقط
        const isLoginPage = window.location.pathname.includes('index.html') || 
                           window.location.pathname === '/' ||
                           window.location.pathname.endsWith('/');
        
        if (!isLoginPage) {
            // إذا لم نكن في صفحة تسجيل الدخول، لا نعرض splash screen
            return;
        }

        // إنشاء عناصر splash screen
        this.createSplashScreen();
        
        // بدء عملية الإخفاء
        this.startHideProcess();
    }

    createSplashScreen() {
        // التحقق من وجود العنصر أولاً
        if (document.getElementById('splash-screen')) {
            this.splashElement = document.getElementById('splash-screen');
            return;
        }

        // إنشاء عناصر splash screen
        const splashScreen = document.createElement('div');
        splashScreen.id = 'splash-screen';
        splashScreen.className = 'splash-screen';
        splashScreen.innerHTML = `
            <div class="splash-content">
                <div class="splash-logo">
                    <img src="icon-512x512.png" alt="Logo" class="splash-logo-img">
                </div>
                <h1 class="splash-title">نظام إدارة محل الصيانة</h1>
                <p class="splash-subtitle">نظام شامل لإدارة محلات صيانة الهواتف</p>
                <div class="splash-loader"></div>
            </div>
        `;

        // إضافة إلى body
        document.body.appendChild(splashScreen);

        // حفظ المرجع
        this.splashElement = splashScreen;
    }

    startHideProcess() {
        // الانتظار حتى يتم تحميل الصفحة بالكامل
        const hideSplash = () => {
            const elapsedTime = Date.now() - this.startTime;
            const remainingTime = Math.max(0, this.minDisplayTime - elapsedTime);

            setTimeout(() => {
                this.hide();
            }, remainingTime);
        };

        // التحقق من حالة الصفحة
        if (document.readyState === 'complete') {
            // الصفحة محملة بالفعل
            hideSplash();
        } else {
            // انتظار تحميل الصفحة
            window.addEventListener('load', hideSplash);
        }

        // أيضاً التحقق بشكل دوري (fallback)
        let checkCount = 0;
        const maxChecks = 30; // 3 ثوان
        const checkInterval = setInterval(() => {
            checkCount++;
            if (document.readyState === 'complete') {
                clearInterval(checkInterval);
                hideSplash();
            } else if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                // إجبار الإخفاء بعد 3 ثوان
                hideSplash();
            }
        }, 100);
    }

    hide() {
        if (!this.splashElement) {
            return;
        }

        // إضافة class للإخفاء
        this.splashElement.classList.add('hidden');
        
        // إظهار صفحة تسجيل الدخول
        const loginContainer = document.querySelector('.login-container');
        if (loginContainer) {
            loginContainer.classList.add('show');
        }
        
        // إزالة العنصر من DOM بعد انتهاء الانتقال
        setTimeout(() => {
            if (this.splashElement && this.splashElement.parentNode) {
                try {
                    this.splashElement.parentNode.removeChild(this.splashElement);
                } catch (e) {
                    console.warn('خطأ في إزالة splash screen:', e);
                }
                this.splashElement = null;
            }
        }, 600); // نفس مدة الانتقال في CSS
    }

    show() {
        if (!this.splashElement) {
            this.createSplashScreen();
        }

        if (this.splashElement) {
            this.splashElement.classList.remove('hidden');
            this.startTime = Date.now();
        }
    }
}

// إنشاء instance عام
let splashScreenManager;

// تهيئة عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        splashScreenManager = new SplashScreenManager();
    });
} else {
    // إذا كانت الصفحة محملة بالفعل، تهيئة فورية
    splashScreenManager = new SplashScreenManager();
}

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.SplashScreenManager = SplashScreenManager;
    window.splashScreenManager = splashScreenManager;
}


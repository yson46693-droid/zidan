// نظام Splash Screen - شاشة البداية (لصفحة تسجيل الدخول فقط)
class SplashScreenManager {
    constructor() {
        this.splashElement = null;
        this.minDisplayTime = 1500; // الحد الأدنى للعرض: 1.5 ثانية
        this.startTime = Date.now();
        this.hideProcessStarted = false;
        this.hideProcessCompleted = false;
        this.isHiding = false;
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

        // البحث عن splash screen الموجود في HTML أولاً
        this.splashElement = document.getElementById('splash-screen');
        
        // إذا لم يكن موجوداً، إنشاؤه
        if (!this.splashElement) {
            this.createSplashScreen();
        }
        
        // بدء عملية الإخفاء
        this.startHideProcess();
    }

    createSplashScreen() {
        // التحقق مرة أخرى من وجود العنصر (للتأكد)
        const existingElement = document.getElementById('splash-screen');
        if (existingElement) {
            this.splashElement = existingElement;
            return;
        }

        // إنشاء عناصر splash screen فقط إذا لم يكن موجوداً
        const splashScreen = document.createElement('div');
        splashScreen.id = 'splash-screen';
        splashScreen.className = 'splash-screen';
        splashScreen.innerHTML = `
            <div class="splash-content">
                <div class="splash-logo">
                    <img src="icon-512x512.png" alt="Logo" class="splash-logo-img" width="512" height="512" fetchpriority="high" decoding="async" loading="eager">
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
        // منع تشغيل العملية أكثر من مرة
        if (this.hideProcessStarted) {
            return;
        }
        this.hideProcessStarted = true;

        // الانتظار حتى يتم تحميل الصفحة بالكامل
        const hideSplash = () => {
            // التأكد من أن العملية لم تبدأ بالفعل
            if (this.hideProcessCompleted) {
                return;
            }
            this.hideProcessCompleted = true;

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
            // انتظار تحميل الصفحة (مرة واحدة فقط)
            const loadHandler = () => {
                window.removeEventListener('load', loadHandler);
                hideSplash();
            };
            window.addEventListener('load', loadHandler);
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
        // منع الإخفاء المتعدد
        if (this.isHiding || !this.splashElement) {
            return;
        }
        
        this.isHiding = true;

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

// منع التهيئة المتعددة
let splashScreenInitialized = false;

// تهيئة عند تحميل الصفحة (مرة واحدة فقط)
function initSplashScreen() {
    if (splashScreenInitialized) {
        return; // منع التهيئة المتعددة
    }
    
    splashScreenInitialized = true;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!splashScreenManager) {
                splashScreenManager = new SplashScreenManager();
            }
        });
    } else {
        // إذا كانت الصفحة محملة بالفعل، تهيئة فورية
        if (!splashScreenManager) {
            splashScreenManager = new SplashScreenManager();
        }
    }
}

// تهيئة فورية
initSplashScreen();

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.SplashScreenManager = SplashScreenManager;
    window.splashScreenManager = splashScreenManager;
}


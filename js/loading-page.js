// نظام صفحة التحميل الديناميكية
class LoadingPageManager {
    constructor() {
        this.isEnabled = true; // سيتم تحديثه من الإعدادات
        this.progress = 0;
        this.progressInterval = null;
        this.loadingElement = null;
        this.progressBar = null;
        this.progressPercentage = null;
        this.init();
    }

    async init() {
        try {
            // التحقق من الإعدادات أولاً
            await this.checkSettings();
            
            // إنشاء عناصر صفحة التحميل
            this.createLoadingPage();
            
            // بدء التحميل
            this.startLoading();
        } catch (error) {
            console.error('خطأ في تهيئة صفحة التحميل:', error);
            // في حالة الخطأ، نعطل صفحة التحميل
            this.isEnabled = false;
        }
    }

    async checkSettings() {
        try {
            // محاولة جلب الإعدادات من localStorage أولاً (لتحسين الأداء)
            const cachedSettings = localStorage.getItem('app_settings');
            if (cachedSettings) {
                try {
                    const settings = JSON.parse(cachedSettings);
                    if (settings.hasOwnProperty('loading_page_enabled')) {
                        this.isEnabled = settings.loading_page_enabled === '1' || settings.loading_page_enabled === true;
                        return;
                    }
                } catch (e) {
                    // تجاهل خطأ parsing
                }
            }

            // إذا لم تكن موجودة في cache، جلبها من API
            if (typeof API !== 'undefined' && API.getSettings) {
                const result = await API.getSettings();
                if (result && result.success && result.data) {
                    const enabled = result.data.loading_page_enabled;
                    this.isEnabled = enabled === '1' || enabled === true || enabled === 'true';
                    
                    // حفظ في cache
                    if (cachedSettings) {
                        const settings = JSON.parse(cachedSettings);
                        settings.loading_page_enabled = this.isEnabled;
                        localStorage.setItem('app_settings', JSON.stringify(settings));
                    }
                }
            } else {
                // إذا لم يكن API متاحاً، نستخدم القيمة الافتراضية (مفعل)
                this.isEnabled = true;
            }
        } catch (error) {
            console.warn('تحذير: فشل جلب إعدادات صفحة التحميل، استخدام القيمة الافتراضية:', error);
            this.isEnabled = true; // القيمة الافتراضية: مفعل
        }
    }

    createLoadingPage() {
        // التحقق من وجود العنصر أولاً
        if (document.getElementById('loading-page')) {
            this.loadingElement = document.getElementById('loading-page');
            this.progressBar = this.loadingElement.querySelector('.progress-bar');
            this.progressPercentage = this.loadingElement.querySelector('.progress-percentage');
            return;
        }

        // إنشاء عناصر صفحة التحميل
        const loadingPage = document.createElement('div');
        loadingPage.id = 'loading-page';
        loadingPage.className = 'loading-page';
        loadingPage.innerHTML = `
            <div class="loading-page-content">
                <div class="loading-logo">
                    <i class="bi bi-phone-fill"></i>
                </div>
                <h2 class="loading-title">جاري التحميل...</h2>
                <p class="loading-subtitle">يرجى الانتظار</p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="progress-percentage">0%</div>
            </div>
        `;

        // إضافة إلى body
        document.body.appendChild(loadingPage);

        // حفظ المراجع
        this.loadingElement = loadingPage;
        this.progressBar = loadingPage.querySelector('.progress-bar');
        this.progressPercentage = loadingPage.querySelector('.progress-percentage');
    }

    startLoading() {
        if (!this.isEnabled) {
            // إذا كانت صفحة التحميل معطلة، إخفاؤها فوراً
            if (this.loadingElement) {
                this.loadingElement.classList.add('hidden');
            }
            return;
        }

        if (!this.loadingElement) {
            return;
        }

        // إظهار صفحة التحميل
        this.loadingElement.classList.remove('hidden');
        this.progress = 0;
        this.updateProgress(0);

        // محاكاة التقدم
        this.simulateProgress();

        // الاستماع لأحداث تحميل الصفحة
        this.setupPageLoadListeners();
    }

    simulateProgress() {
        // محاكاة التقدم بشكل تدريجي
        let targetProgress = 0;

        // مراحل التحميل
        const stages = [
            { progress: 20, delay: 200 },   // تحميل HTML
            { progress: 40, delay: 400 },  // تحميل CSS
            { progress: 60, delay: 600 },   // تحميل JavaScript
            { progress: 80, delay: 800 },   // تحميل البيانات
            { progress: 95, delay: 1000 }   // تقريباً جاهز
        ];

        stages.forEach((stage, index) => {
            setTimeout(() => {
                targetProgress = stage.progress;
                this.updateProgress(targetProgress);
            }, stage.delay);
        });

        // إذا لم يتم تحميل الصفحة بعد 3 ثوان، نصل إلى 95%
        setTimeout(() => {
            if (this.progress < 95) {
                this.updateProgress(95);
            }
        }, 3000);
    }

    setupPageLoadListeners() {
        // عند تحميل DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateProgress(30);
            });
        } else {
            this.updateProgress(30);
        }

        // عند تحميل جميع الموارد
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
                this.completeLoading();
            });
        } else {
            // إذا كانت الصفحة محملة بالفعل
            setTimeout(() => {
                this.completeLoading();
            }, 500);
        }

        // أيضاً التحقق من حالة الصفحة بشكل دوري (fallback)
        let checkCount = 0;
        const maxChecks = 50; // 5 ثوان
        const checkInterval = setInterval(() => {
            checkCount++;
            if (document.readyState === 'complete') {
                clearInterval(checkInterval);
                this.completeLoading();
            } else if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                // إجبار الإكمال بعد 5 ثوان
                this.completeLoading();
            }
        }, 100);
    }

    updateProgress(percentage) {
        if (!this.isEnabled || !this.progressBar || !this.progressPercentage) {
            return;
        }

        this.progress = Math.min(100, Math.max(0, percentage));
        
        if (this.progressBar) {
            this.progressBar.style.width = this.progress + '%';
        }
        
        if (this.progressPercentage) {
            this.progressPercentage.textContent = Math.round(this.progress) + '%';
        }
    }

    completeLoading() {
        if (!this.isEnabled) {
            return;
        }

        // الوصول إلى 100%
        this.updateProgress(100);

        // إخفاء صفحة التحميل بعد تأخير قصير
        setTimeout(() => {
            this.hide();
        }, 300);
    }

    hide() {
        if (!this.loadingElement) {
            return;
        }

        this.loadingElement.classList.add('hidden');
        
        // إزالة العنصر من DOM بعد انتهاء الانتقال
        setTimeout(() => {
            if (this.loadingElement && this.loadingElement.parentNode) {
                this.loadingElement.parentNode.removeChild(this.loadingElement);
                this.loadingElement = null;
                this.progressBar = null;
                this.progressPercentage = null;
            }
        }, 500);
    }

    show() {
        if (!this.isEnabled) {
            return;
        }

        if (!this.loadingElement) {
            this.createLoadingPage();
        }

        if (this.loadingElement) {
            this.loadingElement.classList.remove('hidden');
            this.progress = 0;
            this.updateProgress(0);
            this.simulateProgress();
        }
    }

    // دالة عامة لإظهار صفحة التحميل أثناء عمليات API
    async withLoading(callback) {
        if (!this.isEnabled) {
            return await callback();
        }

        try {
            this.show();
            const result = await callback();
            return result;
        } finally {
            // لا نخفي صفحة التحميل هنا لأنها قد تكون مطلوبة للصفحة نفسها
        }
    }
}

// إنشاء instance عام
let loadingPageManager;

// تهيئة عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadingPageManager = new LoadingPageManager();
    });
} else {
    loadingPageManager = new LoadingPageManager();
}

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.LoadingPageManager = LoadingPageManager;
    window.loadingPageManager = loadingPageManager;
}


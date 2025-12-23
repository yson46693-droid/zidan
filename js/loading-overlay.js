// نظام Splash Screen للتحميل مع شريط التقدم
class LoadingOverlay {
    constructor() {
        this.overlayElement = null;
        this.progressBar = null;
        this.activeRequests = 0;
        this.progress = 0;
        this.init();
    }

    init() {
        this.createOverlay();
        this.setupAPIInterceptor();
        this.setupPageLoadListener();
        this.setupProgressBar();
    }

    createOverlay() {
        // التحقق من وجود العنصر أولاً
        if (document.getElementById('loading-overlay')) {
            this.overlayElement = document.getElementById('loading-overlay');
            this.progressBar = this.overlayElement.querySelector('.loading-progress-bar');
            return;
        }

        // إنشاء عنصر overlay
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-overlay-content">
                <div class="loading-circle-container">
                    <div class="loading-circle"></div>
                </div>
                <h2 class="loading-text">جاري التحميل...</h2>
                <div class="loading-progress-container">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;

        // إضافة إلى body
        document.body.appendChild(overlay);

        // حفظ المراجع
        this.overlayElement = overlay;
        this.progressBar = overlay.querySelector('.loading-progress-bar');
    }

    show() {
        if (!this.overlayElement) {
            this.createOverlay();
        }

        if (this.overlayElement) {
            this.activeRequests++;
            this.overlayElement.classList.add('active');
            this.startProgress();
        }
    }

    hide() {
        if (!this.overlayElement) {
            return;
        }

        this.activeRequests = Math.max(0, this.activeRequests - 1);

        // إخفاء فقط إذا لم يكن هناك طلبات نشطة
        if (this.activeRequests === 0) {
            // إكمال شريط التقدم قبل الإخفاء
            this.updateProgress(100);
            
            setTimeout(() => {
                if (this.activeRequests === 0 && this.overlayElement) {
                    this.overlayElement.classList.remove('active');
                    this.progress = 0;
                    if (this.progressBar) {
                        this.progressBar.style.width = '0%';
                    }
                }
            }, 300);
        }
    }

    updateProgress(percentage) {
        if (!this.progressBar) {
            return;
        }

        this.progress = Math.min(100, Math.max(0, percentage));
        this.progressBar.style.width = this.progress + '%';
    }

    startProgress() {
        // محاكاة التقدم بشكل تدريجي
        let currentProgress = 0;
        const targetProgress = 90; // الوصول إلى 90% ثم ننتظر اكتمال الطلب
        
        const interval = setInterval(() => {
            if (this.activeRequests === 0) {
                clearInterval(interval);
                return;
            }
            
            if (currentProgress < targetProgress) {
                currentProgress += Math.random() * 15;
                if (currentProgress > targetProgress) {
                    currentProgress = targetProgress;
                }
                this.updateProgress(currentProgress);
            } else {
                clearInterval(interval);
            }
        }, 200);
    }

    setupAPIInterceptor() {
        // اعتراض طلبات API إذا كان API موجوداً
        if (typeof API !== 'undefined' && API.request) {
            const originalRequest = API.request.bind(API);
            const self = this;
            
            API.request = async function(endpoint, method = 'GET', data = null) {
                // إظهار overlay
                self.show();
                
                try {
                    const result = await originalRequest(endpoint, method, data);
                    return result;
                } finally {
                    // إخفاء overlay
                    self.hide();
                }
            };
        }

        // اعتراض fetch مباشرة للطلبات الأخرى
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = async function(...args) {
            // تجاهل طلبات الصور والموارد الثابتة
            const url = args[0];
            if (typeof url === 'string') {
                const isStaticResource = url.match(/\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|css|js)(\?|$)/i);
                if (isStaticResource && !url.includes('api/')) {
                    return originalFetch.apply(this, args);
                }
            }

            // إظهار overlay للطلبات API
            if (typeof url === 'string' && (url.includes('api/') || url.includes('.php'))) {
                self.show();
            }
            
            try {
                const response = await originalFetch.apply(this, args);
                return response;
            } finally {
                if (typeof url === 'string' && (url.includes('api/') || url.includes('.php'))) {
                    self.hide();
                }
            }
        };
    }

    setupPageLoadListener() {
        // إظهار overlay عند تحميل الصفحة
        if (document.readyState === 'loading') {
            this.show();
            
            // محاكاة التقدم أثناء تحميل الصفحة
            this.simulatePageLoad();
        }

        // إخفاء عند تحميل الصفحة بالكامل
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
                this.updateProgress(100);
                setTimeout(() => {
                    this.hide();
                }, 500);
            });
        } else {
            // إذا كانت الصفحة محملة بالفعل
            setTimeout(() => {
                this.hide();
            }, 500);
        }
    }

    simulatePageLoad() {
        // محاكاة مراحل تحميل الصفحة
        const stages = [
            { progress: 20, delay: 100 },
            { progress: 40, delay: 300 },
            { progress: 60, delay: 500 },
            { progress: 80, delay: 700 },
            { progress: 90, delay: 900 }
        ];

        stages.forEach(stage => {
            setTimeout(() => {
                if (this.activeRequests > 0) {
                    this.updateProgress(stage.progress);
                }
            }, stage.delay);
        });
    }

    setupProgressBar() {
        // ربط شريط التقدم بشريط التحميل الخاص بالمتصفح
        if ('performance' in window && 'navigation' in performance) {
            // استخدام Performance API لتتبع التقدم
            const checkProgress = () => {
                if (this.activeRequests > 0 && document.readyState !== 'complete') {
                    // تقدير التقدم بناءً على حالة الصفحة
                    let estimatedProgress = 0;
                    
                    if (document.readyState === 'loading') {
                        estimatedProgress = 30;
                    } else if (document.readyState === 'interactive') {
                        estimatedProgress = 60;
                    } else if (document.readyState === 'complete') {
                        estimatedProgress = 100;
                    }
                    
                    if (estimatedProgress > this.progress) {
                        this.updateProgress(estimatedProgress);
                    }
                    
                    if (document.readyState !== 'complete') {
                        requestAnimationFrame(checkProgress);
                    }
                }
            };
            
            if (document.readyState !== 'complete') {
                requestAnimationFrame(checkProgress);
            }
        }
    }
}

// إنشاء instance عام
let loadingOverlay;

// تهيئة فورية
(function() {
    if (document.body) {
        loadingOverlay = new LoadingOverlay();
    } else {
        // انتظار body إذا لم يكن موجوداً
        const initInterval = setInterval(() => {
            if (document.body) {
                clearInterval(initInterval);
                loadingOverlay = new LoadingOverlay();
            }
        }, 10);
    }
})();

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.LoadingOverlay = LoadingOverlay;
    window.loadingOverlay = loadingOverlay;
}


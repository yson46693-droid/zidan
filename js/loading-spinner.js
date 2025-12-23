// نظام دائرة التحميل الديناميكية
class LoadingSpinner {
    constructor() {
        this.spinnerElement = null;
        this.activeRequests = 0;
        this.init();
    }

    init() {
        this.createSpinner();
        this.setupAPIInterceptor();
        this.setupPageLoadListener();
    }

    createSpinner() {
        // التحقق من وجود العنصر أولاً
        if (document.getElementById('loading-spinner')) {
            this.spinnerElement = document.getElementById('loading-spinner');
            return;
        }

        // إنشاء عنصر دائرة التحميل
        const spinner = document.createElement('div');
        spinner.id = 'loading-spinner';
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `
            <div class="loading-spinner-circle"></div>
            <div class="loading-spinner-text">جاري التحميل...</div>
        `;

        // إضافة إلى body
        document.body.appendChild(spinner);

        // حفظ المرجع
        this.spinnerElement = spinner;
    }

    show() {
        if (!this.spinnerElement) {
            this.createSpinner();
        }

        if (this.spinnerElement) {
            this.activeRequests++;
            this.spinnerElement.classList.add('active');
        }
    }

    hide() {
        if (!this.spinnerElement) {
            return;
        }

        this.activeRequests = Math.max(0, this.activeRequests - 1);

        // إخفاء فقط إذا لم يكن هناك طلبات نشطة
        if (this.activeRequests === 0) {
            // تأخير بسيط لإخفاء سلس
            setTimeout(() => {
                if (this.activeRequests === 0 && this.spinnerElement) {
                    this.spinnerElement.classList.remove('active');
                }
            }, 100);
        }
    }

    setupAPIInterceptor() {
        // اعتراض طلبات API إذا كان API موجوداً
        if (typeof API !== 'undefined' && API.request) {
            const originalRequest = API.request.bind(API);
            
            API.request = async function(endpoint, method = 'GET', data = null) {
                // إظهار دائرة التحميل
                if (window.loadingSpinner) {
                    window.loadingSpinner.show();
                }
                
                try {
                    const result = await originalRequest(endpoint, method, data);
                    return result;
                } finally {
                    // إخفاء دائرة التحميل
                    if (window.loadingSpinner) {
                        window.loadingSpinner.hide();
                    }
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

            // إظهار دائرة التحميل للطلبات API
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
        // إظهار دائرة التحميل عند تحميل الصفحة
        if (document.readyState === 'loading') {
            this.show();
            
            window.addEventListener('DOMContentLoaded', () => {
                // إخفاء بعد تحميل DOM
                setTimeout(() => {
                    this.hide();
                }, 300);
            });
        }

        // إخفاء عند تحميل الصفحة بالكامل
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => {
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
}

// إنشاء instance عام
let loadingSpinner;

// تهيئة فورية
(function() {
    if (document.body) {
        loadingSpinner = new LoadingSpinner();
    } else {
        // انتظار body إذا لم يكن موجوداً
        const initInterval = setInterval(() => {
            if (document.body) {
                clearInterval(initInterval);
                loadingSpinner = new LoadingSpinner();
            }
        }, 10);
    }
})();

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.LoadingSpinner = LoadingSpinner;
    window.loadingSpinner = loadingSpinner;
}


/**
 * Performance Monitoring Utility
 * مراقبة الأداء - أداة لقياس وتحسين أداء الموقع
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.observers = [];
        this.init();
    }

    init() {
        // قياس وقت تحميل الصفحة
        this.measurePageLoad();
        
        // مراقبة Long Tasks
        this.observeLongTasks();
        
        // مراقبة Memory Usage
        this.observeMemory();
        
        // مراقبة Network Requests
        this.observeNetwork();
        
        // قياس Web Vitals
        this.measureWebVitals();
    }

    /**
     * قياس وقت تحميل الصفحة
     */
    measurePageLoad() {
        window.addEventListener('load', () => {
            if (performance.timing) {
                const timing = performance.timing;
                this.metrics.pageLoad = {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,
                    firstByte: timing.responseStart - timing.navigationStart
                };
                
                console.log('📊 Page Load Metrics:', this.metrics.pageLoad);
            }
        });
    }

    /**
     * مراقبة Long Tasks (المهام التي تستغرق أكثر من 50ms)
     */
    observeLongTasks() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) {
                            console.warn('⚠️ Long Task detected:', {
                                duration: entry.duration + 'ms',
                                startTime: entry.startTime,
                                name: entry.name
                            });
                        }
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
                this.observers.push(observer);
            } catch (e) {
                console.warn('Long Task observer not supported');
            }
        }
    }

    /**
     * مراقبة استخدام الذاكرة
     */
    observeMemory() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // أكثر من 50MB
                    console.warn('⚠️ High Memory Usage:', {
                        used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                        total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                        limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
                    });
                }
            }, 30000); // كل 30 ثانية
        }
    }

    /**
     * مراقبة Network Requests
     */
    observeNetwork() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 1000) { // أكثر من ثانية
                            console.warn('⚠️ Slow Network Request:', {
                                url: entry.name,
                                duration: entry.duration.toFixed(2) + 'ms',
                                size: entry.transferSize ? (entry.transferSize / 1024).toFixed(2) + 'KB' : 'N/A'
                            });
                        }
                    }
                });
                observer.observe({ entryTypes: ['resource'] });
                this.observers.push(observer);
            } catch (e) {
                console.warn('Resource observer not supported');
            }
        }
    }

    /**
     * قياس Web Vitals (LCP, FID, CLS)
     */
    measureWebVitals() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
                    console.log('📊 LCP:', this.metrics.lcp.toFixed(2) + 'ms');
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.push(lcpObserver);
            } catch (e) {
                console.warn('LCP observer not supported');
            }

            // Cumulative Layout Shift (CLS)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                    this.metrics.cls = clsValue;
                    if (clsValue > 0.1) {
                        console.warn('⚠️ High CLS:', clsValue.toFixed(4));
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.push(clsObserver);
            } catch (e) {
                console.warn('CLS observer not supported');
            }
        }

        // First Input Delay (FID)
        if ('PerformanceObserver' in window) {
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.metrics.fid = entry.processingStart - entry.startTime;
                        if (this.metrics.fid > 100) {
                            console.warn('⚠️ High FID:', this.metrics.fid.toFixed(2) + 'ms');
                        } else {
                            console.log('📊 FID:', this.metrics.fid.toFixed(2) + 'ms');
                        }
                    }
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.push(fidObserver);
            } catch (e) {
                console.warn('FID observer not supported');
            }
        }
    }

    /**
     * قياس أداء دالة معينة
     */
    measureFunction(name, func) {
        return (...args) => {
            const start = performance.now();
            const result = func.apply(this, args);
            const duration = performance.now() - start;
            
            if (duration > 16) { // أكثر من frame (60fps)
                console.warn(`⚠️ Slow function: ${name}`, duration.toFixed(2) + 'ms');
            }
            
            if (!this.metrics.functions) this.metrics.functions = {};
            if (!this.metrics.functions[name]) this.metrics.functions[name] = [];
            this.metrics.functions[name].push(duration);
            
            return result;
        };
    }

    /**
     * الحصول على جميع المقاييس
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: Date.now()
        };
    }

    /**
     * إرسال المقاييس للخادم (اختياري)
     */
    async sendMetrics() {
        try {
            await fetch('/api/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.getMetrics())
            });
        } catch (e) {
            console.warn('Failed to send metrics:', e);
        }
    }

    /**
     * تنظيف المراقبين
     */
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// تهيئة Performance Monitor
let performanceMonitor = null;

if (typeof window !== 'undefined') {
    // التهيئة فقط في وضع التطوير
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.search.includes('debug=performance')) {
        window.addEventListener('DOMContentLoaded', () => {
            performanceMonitor = new PerformanceMonitor();
            console.log('✅ Performance Monitor initialized');
            
            // إرسال المقاييس عند إغلاق الصفحة
            window.addEventListener('beforeunload', () => {
                performanceMonitor.sendMetrics();
                performanceMonitor.cleanup();
            });
        });
    }
}

// Export للاستخدام في أماكن أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}

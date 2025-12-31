/**
 * Performance Monitor - مراقب الأداء
 * يقيس أداء الموقع بشكل مستمر ويقدم تقارير
 */

(function() {
    'use strict';

    // تجنب تحميل الملف في وضع الإنتاج
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    const PerformanceMonitor = {
        metrics: {
            fcp: 0,
            lcp: 0,
            cls: 0,
            fid: 0,
            ttfb: 0,
            totalLoad: 0,
            resourceCount: 0,
            apiRequests: 0,
            errors: []
        },

        init: function() {
            this.measureNavigationTiming();
            this.measurePaintTiming();
            this.observeLCP();
            this.observeCLS();
            this.observeFID();
            this.trackResources();
            this.trackAPIRequests();
            this.trackErrors();
            
            // عرض التقرير بعد تحميل الصفحة
            window.addEventListener('load', () => {
                setTimeout(() => {
                    this.generateReport();
                }, 2000);
            });
        },

        measureNavigationTiming: function() {
            if (!window.performance || !window.performance.getEntriesByType) {
                return;
            }

            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
                this.metrics.totalLoad = navigation.loadEventEnd - navigation.fetchStart;
            }
        },

        measurePaintTiming: function() {
            if (!window.performance || !window.performance.getEntriesByType) {
                return;
            }

            const paintEntries = performance.getEntriesByType('paint');
            const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            if (fcpEntry) {
                this.metrics.fcp = fcpEntry.startTime;
            }
        },

        observeLCP: function() {
            if (!('PerformanceObserver' in window)) {
                return;
            }

            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
                });
                observer.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch (e) {
                console.warn('[Performance Monitor] LCP observer not supported:', e);
            }
        },

        observeCLS: function() {
            if (!('PerformanceObserver' in window)) {
                return;
            }

            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            this.metrics.cls += entry.value;
                        }
                    }
                });
                observer.observe({ type: 'layout-shift', buffered: true });
            } catch (e) {
                console.warn('[Performance Monitor] CLS observer not supported:', e);
            }
        },

        observeFID: function() {
            if (!('PerformanceObserver' in window)) {
                return;
            }

            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.metrics.fid = entry.processingStart - entry.startTime;
                    }
                });
                observer.observe({ type: 'first-input', buffered: true });
            } catch (e) {
                console.warn('[Performance Monitor] FID observer not supported:', e);
            }
        },

        trackResources: function() {
            if (!window.performance || !window.performance.getEntriesByType) {
                return;
            }

            const resources = performance.getEntriesByType('resource');
            this.metrics.resourceCount = resources.length;
        },

        trackAPIRequests: function() {
            // تتبع طلبات API من خلال fetch و XMLHttpRequest
            const originalFetch = window.fetch;
            const originalXHROpen = XMLHttpRequest.prototype.open;

            window.fetch = function(...args) {
                if (args[0] && typeof args[0] === 'string' && args[0].includes('api/')) {
                    PerformanceMonitor.metrics.apiRequests++;
                }
                return originalFetch.apply(this, args);
            };

            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                if (url && url.includes('api/')) {
                    PerformanceMonitor.metrics.apiRequests++;
                }
                return originalXHROpen.apply(this, [method, url, ...rest]);
            };
        },

        trackErrors: function() {
            window.addEventListener('error', (event) => {
                this.metrics.errors.push({
                    message: event.message,
                    source: event.filename,
                    line: event.lineno,
                    col: event.colno
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.metrics.errors.push({
                    message: 'Unhandled Promise Rejection: ' + event.reason,
                    type: 'promise'
                });
            });
        },

        generateReport: function() {
            const report = {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                metrics: {
                    'First Contentful Paint (FCP)': {
                        value: Math.round(this.metrics.fcp),
                        unit: 'ms',
                        target: 1500,
                        status: this.metrics.fcp <= 1500 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'Largest Contentful Paint (LCP)': {
                        value: Math.round(this.metrics.lcp),
                        unit: 'ms',
                        target: 2500,
                        status: this.metrics.lcp <= 2500 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'Time to First Byte (TTFB)': {
                        value: Math.round(this.metrics.ttfb),
                        unit: 'ms',
                        target: 600,
                        status: this.metrics.ttfb <= 600 ? '✅ ممتاز' : '⚠️ يحتاج تحسين'
                    },
                    'Total Load Time': {
                        value: Math.round(this.metrics.totalLoad),
                        unit: 'ms',
                        target: 3000,
                        status: this.metrics.totalLoad <= 3000 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'Cumulative Layout Shift (CLS)': {
                        value: this.metrics.cls.toFixed(3),
                        unit: '',
                        target: 0.1,
                        status: this.metrics.cls <= 0.1 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'First Input Delay (FID)': {
                        value: Math.round(this.metrics.fid),
                        unit: 'ms',
                        target: 100,
                        status: this.metrics.fid <= 100 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'Resource Count': {
                        value: this.metrics.resourceCount,
                        unit: 'files',
                        target: 30,
                        status: this.metrics.resourceCount <= 30 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'API Requests': {
                        value: this.metrics.apiRequests,
                        unit: 'requests',
                        target: 10,
                        status: this.metrics.apiRequests <= 10 ? '✅ جيد' : '⚠️ يحتاج تحسين'
                    },
                    'Errors': {
                        value: this.metrics.errors.length,
                        unit: 'errors',
                        target: 0,
                        status: this.metrics.errors.length === 0 ? '✅ لا توجد أخطاء' : '🔴 يوجد أخطاء'
                    }
                },
                errors: this.metrics.errors
            };

            // عرض التقرير في console
            console.group('📊 Performance Report - تقرير الأداء');
            console.table(report.metrics);
            
            if (report.errors.length > 0) {
                console.group('🔴 Errors - الأخطاء');
                report.errors.forEach((error, index) => {
                    console.error(`Error ${index + 1}:`, error);
                });
                console.groupEnd();
            }
            
            console.groupEnd();

            // حفظ التقرير في localStorage للوصول إليه لاحقاً
            try {
                localStorage.setItem('performanceReport', JSON.stringify(report));
            } catch (e) {
                console.warn('[Performance Monitor] Cannot save report to localStorage:', e);
            }

            return report;
        },

        getReport: function() {
            try {
                const saved = localStorage.getItem('performanceReport');
                return saved ? JSON.parse(saved) : null;
            } catch (e) {
                return null;
            }
        }
    };

    // تهيئة المراقب عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            PerformanceMonitor.init();
        });
    } else {
        PerformanceMonitor.init();
    }

    // جعل المراقب متاحاً عالمياً للوصول إليه من console
    window.PerformanceMonitor = PerformanceMonitor;

    // إضافة أمر console للوصول السريع
    console.log('%c📊 Performance Monitor', 'color: #2196F3; font-weight: bold; font-size: 14px;');
    console.log('استخدم PerformanceMonitor.getReport() للحصول على آخر تقرير');
    console.log('استخدم PerformanceMonitor.generateReport() لإنشاء تقرير جديد');
})();

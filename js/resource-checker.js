/**
 * ✅ نظام للتحقق من تحميل الموارد الحرجة (CSS, Bootstrap Icons, Fonts)
 * يمنع عرض الصفحة بدون تصميم عند انقطاع الإنترنت
 */

(function() {
    'use strict';
    
    // ✅ قائمة الموارد الحرجة التي يجب تحميلها
    // يتم تحديدها ديناميكياً بناءً على الصفحة الحالية
    function getCriticalResources() {
        const pagePath = window.location.pathname.toLowerCase();
        
        // CSS Files - تختلف حسب الصفحة
        const cssFiles = ['css/style.css'];
        
        // إضافة CSS خاص بالصفحة
        if (pagePath.includes('pos.html')) {
            cssFiles.push('css/pos.css');
        } else if (pagePath.includes('chat.html')) {
            cssFiles.push('css/chat.css');
        }
        
        // Bootstrap Icons - مطلوب في جميع الصفحات
        cssFiles.push('/css/vendor/bootstrap-icons/bootstrap-icons.css');
        
        return {
            css: cssFiles,
            fonts: [
                'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap'
            ]
        };
    }
    
    const CRITICAL_RESOURCES = getCriticalResources();
    
    // ✅ إعدادات النظام
    const CONFIG = {
        maxWaitTime: 10000, // 10 ثوان - أقصى وقت انتظار
        checkInterval: 100, // 100ms - فحص كل 100ms
        showErrorAfter: 5000, // 5 ثوان - إظهار رسالة خطأ بعد 5 ثوان
        minResourcesRequired: 1 // على الأقل ملف CSS واحد يجب أن يكون محمّل
    };
    
    // ✅ حالة النظام
    let resourcesState = {
        cssLoaded: false,
        iconsLoaded: false,
        fontsLoaded: false,
        startTime: Date.now(),
        errorShown: false
    };
    
    /**
     * ✅ التحقق من تحميل ملف CSS
     */
    function checkCSSLoaded(href) {
        try {
            // البحث عن link tag
            const link = document.querySelector(`link[href*="${href.split('/').pop()}"]`);
            if (!link) return false;
            
            // التحقق من أن media تم تغييره من "print" إلى "all"
            if (link.media === 'print') return false;
            
            // التحقق من أن stylesheet محمّل
            try {
                if (link.sheet && link.sheet.cssRules && link.sheet.cssRules.length > 0) {
                    return true;
                }
            } catch (e) {
                // قد يكون هناك CORS error، لكن الملف محمّل
                if (link.href && link.media !== 'print') {
                    return true;
                }
            }
            
            // التحقق من أن href موجود و media = 'all'
            return link.href && (link.media === 'all' || link.media === '');
        } catch (e) {
            console.warn('⚠️ [Resource Checker] خطأ في التحقق من CSS:', href, e);
            return false;
        }
    }
    
    /**
     * ✅ التحقق من تحميل الخطوط
     */
    function checkFontsLoaded() {
        try {
            // التحقق من وجود link tag للخطوط
            const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
            if (!fontLink) {
                // ✅ إذا لم توجد خطوط من Google Fonts، نستخدم fallback
                console.log('⚠️ [Resource Checker] Google Fonts غير موجودة - استخدام fallback');
                return true; // نعتبرها محمّلة (fallback fonts)
            }
            
            // التحقق من أن media تم تغييره من "print" إلى "all"
            if (fontLink.media === 'print') return false;
            
            // ✅ التحقق من أن الخطوط محمّلة (محاولة استخدام font)
            // إذا فشل، نستخدم fallback fonts
            try {
                const testElement = document.createElement('div');
                testElement.style.fontFamily = 'Cairo, Tajawal, sans-serif';
                testElement.style.position = 'absolute';
                testElement.style.visibility = 'hidden';
                testElement.textContent = 'Test';
                document.body.appendChild(testElement);
                
                const computedStyle = window.getComputedStyle(testElement);
                const fontFamily = computedStyle.fontFamily;
                
                document.body.removeChild(testElement);
                
                // إذا كان fontFamily يحتوي على Cairo أو Tajawal، الخطوط محمّلة
                const fontsLoaded = fontFamily.includes('Cairo') || fontFamily.includes('Tajawal');
                
                if (!fontsLoaded) {
                    console.log('⚠️ [Resource Checker] الخطوط لم يتم تحميلها - استخدام fallback');
                    // ✅ إضافة fallback fonts إلى body
                    if (document.body && !document.body.classList.contains('fonts-fallback')) {
                        document.body.classList.add('fonts-fallback');
                        const style = document.createElement('style');
                        style.textContent = `
                            body.fonts-fallback, 
                            body.fonts-fallback * {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif !important;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                }
                
                return true; // نعتبرها محمّلة (fallback fonts متاحة)
            } catch (e) {
                console.warn('⚠️ [Resource Checker] خطأ في التحقق من الخطوط:', e);
                // في حالة الخطأ، نعتبر الخطوط محمّلة (fallback)
                return true;
            }
        } catch (e) {
            console.warn('⚠️ [Resource Checker] خطأ في التحقق من الخطوط:', e);
            // في حالة الخطأ، نعتبر الخطوط محمّلة (fallback)
            return true;
        }
    }
    
    /**
     * ✅ التحقق من جميع الموارد الحرجة
     */
    function checkAllResources() {
        const elapsed = Date.now() - resourcesState.startTime;
        
        // ✅ التحقق من CSS - style.css مطلوب دائماً
        const styleCssLoaded = checkCSSLoaded('style.css');
        
        // ✅ التحقق من CSS خاص بالصفحة (إن وجد)
        const pagePath = window.location.pathname.toLowerCase();
        let pageCssLoaded = true; // افتراضياً محمّل (قد لا يكون موجوداً)
        
        if (pagePath.includes('pos.html')) {
            pageCssLoaded = checkCSSLoaded('pos.css');
        } else if (pagePath.includes('chat.html')) {
            pageCssLoaded = checkCSSLoaded('chat.css');
        }
        
        // ✅ التحقق من Bootstrap Icons
        const iconsCssLoaded = checkCSSLoaded('bootstrap-icons.css');
        
        // ✅ التحقق من الخطوط (مع fallback)
        resourcesState.fontsLoaded = checkFontsLoaded();
        
        // ✅ تحديث الحالة
        resourcesState.cssLoaded = styleCssLoaded;
        resourcesState.iconsLoaded = iconsCssLoaded;
        
        // ✅ على الأقل style.css يجب أن يكون محمّل (الأهم)
        // Bootstrap Icons مهم لكن ليس حرج (يمكن أن تظهر بدون أيقونات)
        const hasMinimumResources = styleCssLoaded;
        
        // ✅ إذا تم تحميل الموارد الحرجة، نسمح بعرض الصفحة
        if (hasMinimumResources) {
            console.log('✅ [Resource Checker] الموارد الحرجة محمّلة بنجاح');
            console.log('   - CSS:', styleCssLoaded ? '✅' : '❌');
            if (pagePath.includes('pos.html') || pagePath.includes('chat.html')) {
                console.log('   - Page CSS:', pageCssLoaded ? '✅' : '⚠️');
            }
            console.log('   - Icons:', iconsCssLoaded ? '✅' : '⚠️');
            console.log('   - Fonts:', resourcesState.fontsLoaded ? '✅' : '⚠️');
            
            // ✅ إزالة overlay إذا كان موجوداً
            hideLoadingOverlay();
            
            return true;
        }
        
        // ✅ إذا لم يتم تحميل الموارد بعد، نتحقق من الوقت
        if (elapsed > CONFIG.maxWaitTime) {
            console.error('❌ [Resource Checker] انتهى وقت الانتظار - الموارد الحرجة لم يتم تحميلها');
            showError();
            // ✅ إظهار body حتى لو لم يتم تحميل الموارد (fallback)
            showBody();
            return false;
        }
        
        // ✅ إظهار رسالة خطأ بعد 5 ثوان
        if (elapsed > CONFIG.showErrorAfter && !resourcesState.errorShown) {
            showError();
            resourcesState.errorShown = true;
        }
        
        return false;
    }
    
    /**
     * ✅ إظهار overlay للتحميل
     */
    function showLoadingOverlay() {
        try {
            // ✅ التحقق من وجود overlay موجود بالفعل
            let overlay = document.getElementById('resource-checker-overlay');
            if (overlay) return;
            
            overlay = document.createElement('div');
            overlay.id = 'resource-checker-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #2196F3, #64B5F6);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
            `;
            
            overlay.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 400px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <h2 style="margin: 0 0 10px; font-size: 24px; font-weight: 700;">جاري تحميل الموارد...</h2>
                    <p style="margin: 0; font-size: 16px; opacity: 0.9;">يرجى الانتظار حتى يتم تحميل جميع الموارد المطلوبة</p>
                    <div id="resource-checker-status" style="margin-top: 20px; font-size: 14px; opacity: 0.8;"></div>
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
            
            document.body.appendChild(overlay);
            
            // ✅ تحديث حالة الموارد
            updateStatus();
        } catch (e) {
            console.error('❌ [Resource Checker] خطأ في إظهار overlay:', e);
        }
    }
    
    /**
     * ✅ إخفاء overlay
     */
    function hideLoadingOverlay() {
        try {
            const overlay = document.getElementById('resource-checker-overlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 500);
            }
        } catch (e) {
            console.error('❌ [Resource Checker] خطأ في إخفاء overlay:', e);
        }
    }
    
    /**
     * ✅ تحديث حالة الموارد في overlay
     */
    function updateStatus() {
        try {
            const statusEl = document.getElementById('resource-checker-status');
            if (!statusEl) return;
            
            const status = [];
            if (resourcesState.cssLoaded) status.push('✅ CSS');
            else status.push('⏳ CSS');
            
            if (resourcesState.iconsLoaded) status.push('✅ الأيقونات');
            else status.push('⏳ الأيقونات');
            
            if (resourcesState.fontsLoaded) status.push('✅ الخطوط');
            else status.push('⏳ الخطوط');
            
            statusEl.textContent = status.join(' • ');
        } catch (e) {
            // تجاهل الأخطاء
        }
    }
    
    /**
     * ✅ إظهار رسالة خطأ
     */
    function showError() {
        try {
            const overlay = document.getElementById('resource-checker-overlay');
            if (!overlay) {
                showLoadingOverlay();
                return;
            }
            
            overlay.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 400px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">⚠️</div>
                    <h2 style="margin: 0 0 10px; font-size: 24px; font-weight: 700;">مشكلة في الاتصال</h2>
                    <p style="margin: 0 0 20px; font-size: 16px; opacity: 0.9;">لا يمكن تحميل الموارد المطلوبة. يرجى التحقق من اتصال الإنترنت.</p>
                    <button id="resource-checker-retry" style="
                        background: white;
                        color: #2196F3;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: 'Cairo', 'Tajawal', sans-serif;
                    ">إعادة المحاولة</button>
                </div>
            `;
            
            // ✅ إضافة event listener للزر
            const retryBtn = document.getElementById('resource-checker-retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        } catch (e) {
            console.error('❌ [Resource Checker] خطأ في إظهار رسالة الخطأ:', e);
        }
    }
    
    /**
     * ✅ إخفاء body حتى يتم تحميل الموارد
     */
    function hideBody() {
        try {
            if (document.body) {
                document.body.style.visibility = 'hidden';
                document.body.style.opacity = '0';
            }
        } catch (e) {
            console.error('❌ [Resource Checker] خطأ في إخفاء body:', e);
        }
    }
    
    /**
     * ✅ إظهار body بعد تحميل الموارد
     */
    function showBody() {
        try {
            if (document.body) {
                document.body.style.visibility = 'visible';
                document.body.style.opacity = '1';
                document.body.style.transition = 'opacity 0.5s ease';
            }
        } catch (e) {
            console.error('❌ [Resource Checker] خطأ في إظهار body:', e);
        }
    }
    
    /**
     * ✅ بدء النظام
     */
    function start() {
        console.log('🔍 [Resource Checker] بدء التحقق من الموارد الحرجة...');
        
        // ✅ إخفاء body في البداية
        hideBody();
        
        // ✅ إظهار overlay
        showLoadingOverlay();
        
        // ✅ بدء الفحص الدوري
        let checkCount = 0;
        const maxChecks = CONFIG.maxWaitTime / CONFIG.checkInterval;
        
        const checkInterval = setInterval(() => {
            checkCount++;
            
            // ✅ تحديث حالة الموارد
            updateStatus();
            
            // ✅ التحقق من الموارد
            if (checkAllResources()) {
                clearInterval(checkInterval);
                showBody();
                console.log('✅ [Resource Checker] تم تحميل الموارد الحرجة بنجاح');
                return;
            }
            
            // ✅ إذا انتهى الوقت، نتوقف
            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                console.error('❌ [Resource Checker] انتهى وقت الانتظار');
                // ✅ إظهار body حتى لو لم يتم تحميل الموارد (fallback)
                showBody();
            }
        }, CONFIG.checkInterval);
        
        // ✅ أيضاً التحقق عند تحميل window
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (checkAllResources()) {
                    clearInterval(checkInterval);
                    showBody();
                }
            }, 1000);
        });
    }
    
    // ✅ بدء النظام عند تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
    
    // ✅ تصدير الدوال للاستخدام الخارجي
    window.ResourceChecker = {
        check: checkAllResources,
        showOverlay: showLoadingOverlay,
        hideOverlay: hideLoadingOverlay
    };
})();

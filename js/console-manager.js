/**
 * Console Manager - إدارة console.log للإنتاج
 * يعطل console.log في بيئة الإنتاج لتحسين الأداء
 */

(function() {
    'use strict';
    
    // التحقق من بيئة الإنتاج (يمكن تغييرها حسب الحاجة)
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1' &&
                        !window.location.hostname.includes('localhost');
    
    // حفظ الدوال الأصلية
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    // تعطيل console.log في الإنتاج (لكن نترك console.error و console.warn للمساعدة في التصحيح)
    if (isProduction) {
        // تعطيل console.log و console.debug فقط
        console.log = function() {
            // لا شيء - معطل في الإنتاج
        };
        
        console.debug = function() {
            // لا شيء - معطل في الإنتاج
        };
        
        // يمكن أيضاً تعطيل console.info
        console.info = function() {
            // لا شيء - معطل في الإنتاج
        };
        
        // نترك console.error و console.warn للمساعدة في التصحيح
        // لكن يمكن تعطيلها أيضاً إذا أردت
        // console.warn = function() {};
        // console.error = function() {};
    }
    
    // إضافة دالة لتفعيل/تعطيل console يدوياً (للمطورين)
    window.enableConsole = function() {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        console.log('✅ Console enabled');
    };
    
    window.disableConsole = function() {
        console.log = function() {};
        console.debug = function() {};
        console.info = function() {};
        console.log('🔇 Console disabled');
    };
    
    // إظهار حالة Console Manager
    if (!isProduction) {
        console.log('🔧 Console Manager: Development mode - all console methods enabled');
    } else {
        console.warn('🔧 Console Manager: Production mode - console.log/debug/info disabled');
    }
})();


<?php
/**
 * ✅ ملف Auto-prepend لفرض إعدادات PHP قبل تحميل أي ملف آخر
 * 
 * هذا الملف يتم تحميله تلقائياً قبل أي ملف PHP آخر
 * لضمان تطبيق إعدادات session.save_path و soap.wsdl_cache_enabled
 * 
 * ملاحظة: قد لا يعمل في جميع الاستضافات، لكنه حل إضافي قوي
 */

// ✅ تعطيل wsdlcache - يجب أن يكون أول شيء
@ini_set('soap.wsdl_cache_enabled', '0');
@ini_set('soap.wsdl_cache_dir', '/tmp');
@ini_set('soap.wsdl_cache_ttl', '0');
@ini_set('soap.wsdl_cache_limit', '0');

// ✅ تعيين session.save_path إلى /tmp - قبل بدء أي جلسة
if (session_status() === PHP_SESSION_NONE) {
    $sessionPath = '/tmp';
    if (is_dir($sessionPath) && is_writable($sessionPath)) {
        @ini_set('session.save_path', $sessionPath);
        if (function_exists('session_save_path')) {
            session_save_path($sessionPath);
        }
    }
}

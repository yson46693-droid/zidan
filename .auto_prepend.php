<?php
/**
 * ✅ ملف Auto-prepend لفرض إعدادات PHP قبل تحميل أي ملف آخر
 * 
 * هذا الملف يتم تحميله تلقائياً قبل أي ملف PHP آخر
 * لضمان تطبيق إعدادات session.save_path و soap.wsdl_cache_enabled
 * 
 * ملاحظة: قد لا يعمل في جميع الاستضافات، لكنه حل إضافي قوي
 */

// ✅ CRITICAL: قمع تحذيرات open_basedir المتعلقة بـ wsdlcache
// هذه التحذيرات تظهر حتى لو كان wsdlcache معطّل لأن PHP extension يحاول الوصول إلى المجلد
error_reporting(E_ALL & ~E_WARNING);
$originalErrorHandler = set_error_handler(function($errno, $errstr, $errfile, $errline) use (&$originalErrorHandler) {
    // قمع تحذيرات open_basedir المتعلقة بـ wsdlcache
    if (strpos($errstr, 'open_basedir restriction') !== false && 
        strpos($errstr, 'wsdlcache') !== false) {
        // تجاهل هذا التحذير - لا يؤثر على عمل التطبيق
        return true;
    }
    // تمرير باقي الأخطاء إلى المعالج الأصلي
    if ($originalErrorHandler) {
        return call_user_func($originalErrorHandler, $errno, $errstr, $errfile, $errline);
    }
    return false;
}, E_WARNING);

// ✅ تعطيل wsdlcache - يجب أن يكون أول شيء (قبل أي شيء آخر)
@ini_set('soap.wsdl_cache_enabled', '0');
@ini_set('soap.wsdl_cache_dir', '/tmp');
@ini_set('soap.wsdl_cache_ttl', '0');
@ini_set('soap.wsdl_cache_limit', '0');

// ✅ محاولة إضافية باستخدام putenv (إذا كان متاحاً)
if (function_exists('putenv')) {
    @putenv('SOAP_WSDL_CACHE_ENABLED=0');
}

// ✅ محاولة إضافية باستخدام ini_alter (deprecated لكن قد يعمل)
if (function_exists('ini_alter')) {
    @ini_alter('soap.wsdl_cache_enabled', '0');
}

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

// ✅ استعادة error_reporting إلى القيمة الأصلية (بعد تطبيق الإعدادات)
error_reporting(E_ALL);

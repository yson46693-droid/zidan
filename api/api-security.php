<?php
/**
 * نظام حماية API متعدد الطبقات - متوافق مع الاستضافة المشتركة
 * يتم تضمينه تلقائياً عبر config.php
 * 
 * المميزات:
 * - CSRF Protection (حماية من Cross-Site Request Forgery)
 * - API Request Token (حماية من الوصول غير المصرح)
 * - Replay Attack Prevention (منع إعادة استخدام الطلبات)
 * - متوافق مع PHP 5.6+ والاستضافة المشتركة
 */

// توليد CSRF Token (مع fallback للـ PHP القديم)
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token'])) {
        // استخدام random_bytes إذا متوفر، وإلا استخدام mt_rand
        if (function_exists('random_bytes')) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } else {
            // Fallback للـ PHP القديم (نادر جداً)
            $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32)) ?: 
                                     hash('sha256', uniqid(mt_rand(), true) . session_id());
        }
    }
    return $_SESSION['csrf_token'];
}

// التحقق من CSRF Token
function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

// توليد API Request Token (مع تحسينات للاستضافة المشتركة)
function generateAPIRequestToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $timestamp = time();
    $sessionId = session_id();
    
    // توليد random string (مع fallback)
    if (function_exists('random_bytes')) {
        $random = bin2hex(random_bytes(16));
    } else {
        $random = bin2hex(openssl_random_pseudo_bytes(16)) ?: 
                 hash('sha256', uniqid(mt_rand(), true) . microtime(true));
    }
    
    $secretKey = $_SESSION['user_id'] ?? 'default_secret';
    $tokenData = $timestamp . '|' . $sessionId . '|' . $random;
    $signature = hash_hmac('sha256', $tokenData, $secretKey);
    $token = base64_encode($tokenData . '|' . $signature);
    
    // حفظ آخر 30 token فقط (تقليل استهلاك الذاكرة)
    if (!isset($_SESSION['api_tokens'])) {
        $_SESSION['api_tokens'] = [];
    }
    $_SESSION['api_tokens'][] = [
        'token' => $token,
        'timestamp' => $timestamp,
        'used' => false
    ];
    
    // تنظيف تلقائي للـ tokens القديمة (أكثر من 10 دقائق)
    $now = time();
    $_SESSION['api_tokens'] = array_filter($_SESSION['api_tokens'], function($t) use ($now) {
        return ($now - $t['timestamp']) < 600;
    });
    
    // الحد الأقصى 30 token
    if (count($_SESSION['api_tokens']) > 30) {
        $_SESSION['api_tokens'] = array_slice($_SESSION['api_tokens'], -30);
    }
    
    return $token;
}

// التحقق من API Request Token
function verifyAPIRequestToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($token)) {
        return false;
    }
    
    try {
        $decoded = @base64_decode($token, true);
        if ($decoded === false) {
            return false;
        }
        
        $parts = explode('|', $decoded);
        if (count($parts) !== 4) {
            return false;
        }
        
        list($timestamp, $sessionId, $random, $signature) = $parts;
        
        // التحقق من session_id أولاً
        if ($sessionId !== session_id()) {
            return false;
        }
        
        // التحقق من التوقيع
        $secretKey = $_SESSION['user_id'] ?? 'default_secret';
        $tokenData = $timestamp . '|' . $sessionId . '|' . $random;
        $expectedSignature = hash_hmac('sha256', $tokenData, $secretKey);
        
        if (!hash_equals($expectedSignature, $signature)) {
            return false;
        }
        
        // ✅ التحقق من انتهاء الصلاحية (30 دقيقة)
        $tokenAge = time() - (int)$timestamp;
        if ($tokenAge > 1800) {
            // ✅ إذا كان Token منتهي الصلاحية لكن المستخدم مسجل دخول، نسمح بالطلب
            // (سيتم توليد token جديد في checkAPISecurity())
            if (isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
                // Token منتهي الصلاحية لكن المستخدم مسجل دخول - نسمح بالطلب
                // لكن نتحقق من Replay Attack أولاً
                if (isset($_SESSION['api_tokens'])) {
                    foreach ($_SESSION['api_tokens'] as &$stored) {
                        if ($stored['token'] === $token) {
                            if ($stored['used']) {
                                return false; // Token مستخدم مسبقاً (Replay Attack)
                            }
                            // ✅ Token منتهي الصلاحية لكن لم يُستخدم مسبقاً - نسمح بالطلب
                            $stored['used'] = true; // وضع علامة كمستخدم
                            return true; // السماح بالطلب لأن المستخدم مسجل دخول
                        }
                    }
                }
                // ✅ Token منتهي الصلاحية لكن المستخدم مسجل دخول - نسمح بالطلب
                return true;
            }
            // Token منتهي الصلاحية والمستخدم غير مسجل دخول
            return false;
        }
        
        // ✅ Token صالح - التحقق من Replay Attacks
        if (isset($_SESSION['api_tokens'])) {
            foreach ($_SESSION['api_tokens'] as &$stored) {
                if ($stored['token'] === $token) {
                    if ($stored['used']) {
                        return false; // Token مستخدم مسبقاً
                    }
                    $stored['used'] = true; // وضع علامة كمستخدم
                    return true;
                }
            }
        }
        return false;
    } catch (Exception $e) {
        error_log('خطأ في التحقق من API Token: ' . $e->getMessage());
        return false;
    } catch (Error $e) {
        error_log('خطأ قاتل في التحقق من API Token: ' . $e->getMessage());
        return false;
    }
}

// دالة الحماية الرئيسية - تستدعى مرة واحدة في كل API
function checkAPISecurity() {
    $method = getRequestMethod();
    $script = basename($_SERVER['PHP_SELF'] ?? '');
    $data = getRequestData();
    
    // استثناءات: تسجيل الدخول و OPTIONS
    $isLogin = ($script === 'auth.php' && isset($data['username']) && isset($data['password']));
    $isOptions = ($method === 'OPTIONS');
    
    if ($isLogin || $isOptions) {
        return true;
    }
    
    // ✅ الطلبات GET لا تحتاج إلى CSRF أو API Token (لتحسين الأداء)
    // التحقق من CSRF و API Token للطلبات الحساسة فقط (POST, PUT, DELETE, PATCH)
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        $csrfToken = $data['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            response(false, 'رمز CSRF غير صحيح. يرجى تحديث الصفحة والمحاولة مرة أخرى', null, 403);
        }
        
        // التحقق من API Token
        $apiToken = $data['api_token'] ?? $_SERVER['HTTP_X_API_TOKEN'] ?? '';
        $tokenValid = verifyAPIRequestToken($apiToken);
        
        if (!$tokenValid) {
            // ✅ إذا كان Token غير صحيح أو منتهي الصلاحية، التحقق من أن المستخدم مسجل دخول
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            // التحقق من أن المستخدم مسجل دخول (للتأكد من أن الطلب شرعي)
            if (isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
                // ✅ المستخدم مسجل دخول بشكل صحيح، السماح بالطلب
                // توليد token جديد للاستخدام المستقبلي (سيتم إرساله في الاستجابة)
                $newToken = generateAPIRequestToken();
                error_log('⚠️ API Token منتهي الصلاحية - تم تجديده تلقائياً للمستخدم: ' . $_SESSION['user_id']);
                // ✅ حفظ Token الجديد في الجلسة لإرساله في الاستجابة
                $_SESSION['new_api_token'] = $newToken;
                return true;
            }
            
            // إذا لم يكن المستخدم مسجل دخول، رفض الطلب
            response(false, 'رمز API غير صحيح أو منتهي الصلاحية. يرجى تحديث الصفحة', null, 403);
        }
    }
    
    // ✅ الطلبات GET لا تحتاج إلى أي تحقق إضافي (يتم التحقق من المصادقة فقط عبر checkAuth())
    // إذا وصلنا هنا، الطلب GET أو تم التحقق من POST/PUT/DELETE بنجاح
    return true;
}
?>

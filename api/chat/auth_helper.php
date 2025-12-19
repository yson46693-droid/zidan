<?php
/**
 * دوال مساعدة للمصادقة في نظام الشات
 */

if (!function_exists('isLoggedIn')) {
    function isLoggedIn() {
        if (session_status() === PHP_SESSION_NONE) {
            // إعدادات الجلسة لضمان عملها بشكل صحيح
            $cookieParams = session_get_cookie_params();
            session_set_cookie_params([
                'lifetime' => $cookieParams['lifetime'],
                'path' => '/',
                'domain' => $cookieParams['domain'],
                'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }
        // التحقق من وجود user_id في الجلسة
        $isLoggedIn = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
        
        // تسجيل للمساعدة في التصحيح
        if (!$isLoggedIn) {
            error_log('User not logged in. Session ID: ' . session_id() . ', Session data: ' . json_encode($_SESSION ?? []));
        }
        
        return $isLoggedIn;
    }
}

if (!function_exists('getCurrentUser')) {
    function getCurrentUser() {
        if (session_status() === PHP_SESSION_NONE) {
            // إعدادات الجلسة لضمان عملها بشكل صحيح
            $cookieParams = session_get_cookie_params();
            session_set_cookie_params([
                'lifetime' => $cookieParams['lifetime'],
                'path' => '/',
                'domain' => $cookieParams['domain'],
                'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }
        
        if (!isset($_SESSION['user_id']) || empty($_SESSION['user_id'])) {
            error_log('getCurrentUser: user_id غير موجود في الجلسة');
            return null;
        }
        
        // إرجاع بيانات المستخدم من الجلسة
        $user = [
            'id' => $_SESSION['user_id'] ?? null,
            'username' => $_SESSION['username'] ?? '',
            'name' => $_SESSION['name'] ?? '',
            'role' => $_SESSION['role'] ?? 'employee',
            'full_name' => $_SESSION['name'] ?? $_SESSION['username'] ?? ''
        ];
        
        // تسجيل للمساعدة في التصحيح
        error_log('getCurrentUser: ' . json_encode($user));
        
        return $user;
    }
}

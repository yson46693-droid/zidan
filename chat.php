<?php
/**
 * صفحة الشات الجماعي
 */

// تفعيل عرض الأخطاء للتطوير (يمكن إزالتها في الإنتاج)
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

// بدء الجلسة أولاً مع إعدادات صحيحة
if (session_status() === PHP_SESSION_NONE) {
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

// معالجة الأخطاء
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    return false;
});

// تحميل ملف إدارة الكاش
require_once __DIR__ . '/includes/cache.php';

// منع كاش هذه الصفحة (يجب استدعاؤه قبل أي output)
disablePageCache();

// تحميل الملفات المطلوبة مع معالجة الأخطاء
try {
    require_once __DIR__ . '/api/database.php';
    require_once __DIR__ . '/api/chat/auth_helper.php';
    require_once __DIR__ . '/includes/chat.php';
} catch (Throwable $e) {
    error_log('خطأ في تحميل الملفات: ' . $e->getMessage());
    http_response_code(500);
    die('خطأ في تحميل الملفات المطلوبة: ' . htmlspecialchars($e->getMessage()));
}

// التحقق من تسجيل الدخول
if (!function_exists('isLoggedIn')) {
    error_log('دالة isLoggedIn غير موجودة');
    http_response_code(500);
    die('خطأ: دالة isLoggedIn غير موجودة');
}

if (!isLoggedIn()) {
    error_log('المستخدم غير مسجل دخول - إعادة التوجيه إلى index.html');
    header('Location: index.html');
    exit;
}

// التحقق من وجود الدوال المطلوبة
if (!function_exists('getCurrentUser')) {
    error_log('دالة getCurrentUser غير موجودة');
    http_response_code(500);
    die('خطأ: دالة getCurrentUser غير موجودة');
}

// دالة للتحقق من الصلاحيات
function requireRole($allowedRoles) {
    if (!function_exists('getCurrentUser')) {
        error_log('دالة getCurrentUser غير موجودة في requireRole');
        header('Location: index.html');
        exit;
    }
    
    $currentUser = getCurrentUser();
    if (!$currentUser) {
        error_log('getCurrentUser عادت null - إعادة التوجيه إلى index.html');
        header('Location: index.html');
        exit;
    }
    
    $userRole = $currentUser['role'] ?? 'employee';
    
    if (!in_array($userRole, $allowedRoles)) {
        error_log('المستخدم لا يملك الصلاحيات المطلوبة. الدور: ' . $userRole);
        header('Location: dashboard.html?error=insufficient_permissions');
        exit;
    }
}

// التحقق من الصلاحيات - السماح لجميع الأدوار
requireRole(['admin', 'manager', 'employee']);

$currentUser = getCurrentUser();
if (!$currentUser) {
    error_log('getCurrentUser عادت null بعد requireRole - إعادة التوجيه إلى index.html');
    header('Location: index.html');
    exit;
}

$currentUserId = (int) ($currentUser['id'] ?? 0);
$currentUserName = $currentUser['name'] ?? ($currentUser['username'] ?? 'عضو');
$currentUserRole = $currentUser['role'] ?? 'member';
$userName = $currentUser['name'] ?? ($currentUser['username'] ?? 'المستخدم');
$userRole = $currentUser['role'] ?? 'member';

// مسار API للشات
$apiBase = 'api/chat';
$roomName = 'الشات الجماعي';

// جلب المستخدمين النشطين
$onlineUsers = [];
$onlineCount = 0;
$membersCount = 0;

if (function_exists('getActiveUsers')) {
    try {
        $onlineUsers = getActiveUsers();
        foreach ($onlineUsers as $onlineUser) {
            if (!empty($onlineUser['is_online'])) {
                $onlineCount++;
            }
        }
        $membersCount = count($onlineUsers);
    } catch (Exception $e) {
        error_log('خطأ في جلب المستخدمين النشطين: ' . $e->getMessage());
        $onlineUsers = [];
    }
}

function getRoleName($role) {
    $roles = [
        'admin' => 'مدير',
        'manager' => 'مدير',
        'employee' => 'موظف',
        'member' => 'عضو'
    ];
    return $roles[$role] ?? $role;
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="description" content="دردشة جماعية لفريق العمل">
    <meta name="theme-color" content="#2196F3">
    <meta name="mobile-web-app-capable" content="yes">
    
    <!-- iOS Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="الشات">
    
    <!-- Windows Meta Tags -->
    <meta name="msapplication-TileColor" content="#2196F3">
    <meta name="msapplication-TileImage" content="icons/icon-144x144.png">
    <meta name="msapplication-navbutton-color" content="#2196F3">
    <meta name="msapplication-starturl" content="/chat.php">
    <meta name="msapplication-tooltip" content="الشات - ALAA ZIDAN">
    <meta name="msapplication-window" content="width=1024;height=768">
    <meta name="msapplication-config" content="browserconfig.xml">
    
    <!-- Meta Tags للمتصفحات القديمة -->
    <meta name="application-name" content="ALAA ZIDAN - APP">
    <meta name="format-detection" content="telephone=no">
    
    <!-- Open Graph (للمتصفحات القديمة) -->
    <meta property="og:title" content="الشات - ALAA ZIDAN">
    <meta property="og:type" content="website">
    <meta property="og:image" content="icons/icon-512x512.png">
    
    <title>الشات - نظام إدارة محل صيانة الهواتف</title>
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-96x96.png">
    <link rel="icon" type="image/png" sizes="16x16" href="icons/icon-72x72.png">
    <link rel="shortcut icon" href="icons/icon-192x192.png">
    
    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-192x192.png">
    <link rel="apple-touch-icon" sizes="152x152" href="icons/icon-152x152.png">
    <link rel="apple-touch-icon" sizes="144x144" href="icons/icon-144x144.png">
    <link rel="apple-touch-icon" sizes="120x120" href="icons/icon-128x128.png">
    <link rel="apple-touch-icon" sizes="114x114" href="icons/icon-128x128.png">
    <link rel="apple-touch-icon" sizes="76x76" href="icons/icon-96x96.png">
    <link rel="apple-touch-icon" sizes="72x72" href="icons/icon-72x72.png">
    <link rel="apple-touch-icon" sizes="60x60" href="icons/icon-72x72.png">
    <link rel="apple-touch-icon" sizes="57x57" href="icons/icon-72x72.png">
    <link rel="apple-touch-icon" href="icons/icon-192x192.png">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- CSS Files - مع Cache Busting تلقائي -->
    <link rel="stylesheet" href="<?php echo asset('css/style.css'); ?>">
    <link rel="stylesheet" href="<?php echo asset('css/chat-integrated.css'); ?>">
    <link rel="stylesheet" href="<?php echo asset('chat/chat.css'); ?>">
    
    <!-- Critical CSS للتأكد من ظهور التصميم فوراً -->
    <style>
        /* CSS Variables */
        :root {
            --chat-primary: #2196F3;
            --chat-secondary: #64B5F6;
            --chat-bg: linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 45%, #e8f4f8 100%);
            --chat-sidebar-bg: linear-gradient(180deg, rgba(33, 150, 243, 0.15) 0%, rgba(100, 181, 246, 0.08) 42%, rgba(255, 255, 255, 0.94) 100%);
            --chat-text: #333;
            --chat-muted: #666;
            --chat-border: rgba(0, 0, 0, 0.08);
            --chat-shadow-md: 0 22px 60px rgba(0, 0, 0, 0.12);
        }
        
        /* Layout Critical Styles */
        .chat-page-content {
            padding: 20px !important;
            height: calc(100vh - 80px) !important;
            overflow: visible !important;
            min-height: 500px !important;
            box-sizing: border-box !important;
            display: block !important;
        }
        
        .chat-app {
            display: flex !important;
            height: 100% !important;
            width: 100% !important;
            background: var(--chat-bg) !important;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: var(--chat-shadow-md);
            position: relative;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            min-height: 400px;
            max-height: 100%;
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        .chat-sidebar {
            width: 280px !important;
            min-width: 280px !important;
            max-width: 280px !important;
            background: var(--chat-sidebar-bg) !important;
            display: flex !important;
            flex-direction: column;
            border-right: 1px solid var(--chat-border);
            position: relative;
            overflow: hidden;
            z-index: 1001;
            flex-shrink: 0;
            height: 100%;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-main {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column;
            background: radial-gradient(circle at top left, rgba(33, 150, 243, 0.08), transparent 52%), var(--chat-bg);
            position: relative;
            height: 100%;
            overflow: hidden;
            min-height: 0;
            min-width: 0;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-header {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            background: linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(100, 181, 246, 0.1));
            border-bottom: 1px solid var(--chat-border);
            position: sticky;
            top: 0;
            z-index: 10;
            flex-shrink: 0;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-messages {
            flex: 1 !important;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 24px;
            display: flex !important;
            flex-direction: column;
            gap: 12px;
            scroll-behavior: smooth;
            min-height: 0;
            position: relative;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-composer {
            padding: 20px 24px !important;
            border-top: 1px solid var(--chat-border);
            background: var(--chat-sidebar-bg);
            display: flex !important;
            flex-direction: column;
            gap: 16px;
            position: sticky;
            bottom: 0;
            z-index: 10;
            flex-shrink: 0;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-input-wrapper {
            display: flex !important;
            align-items: flex-end;
            gap: 12px;
            background: rgba(255, 255, 255, 0.78);
            padding: 14px 18px;
            border-radius: 20px;
            border: 1px solid var(--chat-border);
            box-shadow: 0 12px 30px rgba(33, 150, 243, 0.15);
            min-height: 52px;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-input {
            flex: 1;
            border: none;
            resize: none;
            background: transparent;
            color: var(--chat-text);
            font-size: 15px;
            line-height: 1.6;
            max-height: 160px;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 24px;
            outline: none;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-send-button {
            width: 42px !important;
            height: 42px !important;
            border-radius: 50%;
            border: none;
            background: var(--chat-primary) !important;
            color: #fff !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-empty-state {
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            text-align: center;
            color: var(--chat-muted);
            gap: 12px;
            padding: 40px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(100% - 48px);
            pointer-events: none;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .chat-sidebar-header {
            padding: 24px 24px 16px;
            border-bottom: 1px solid var(--chat-border);
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            position: relative;
            z-index: 1;
        }
        
        .chat-sidebar-search {
            padding: 16px 24px;
            border-bottom: 1px solid var(--chat-border);
            position: relative;
            z-index: 1;
        }
        
        .chat-sidebar-search input {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--chat-border);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.8);
            color: var(--chat-text);
            font-size: 14px;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .chat-user-list {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 0 14px 24px;
            min-height: 0;
        }
    </style>
    
    <!-- تحميل ملف الإصدارات -->
    <script src="js/version.js" defer></script>
</head>
<body>
    <!-- القائمة الجانبية -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h2><i class="bi bi-phone"></i> محل الصيانة</h2>
        </div>
        
        <nav class="sidebar-nav">
            <a href="dashboard.html" class="nav-link">
                <i class="bi bi-speedometer2"></i> لوحة التحكم
            </a>
            <a href="dashboard.html#repairs" class="nav-link">
                <i class="bi bi-tools"></i> عمليات الصيانة
            </a>
            <a href="dashboard.html#customers" class="nav-link">
                <i class="bi bi-people"></i> العملاء
            </a>
            <a href="dashboard.html#inventory" class="nav-link">
                <i class="bi bi-box-seam"></i> المخزون
            </a>
            <a href="pos.html" class="nav-link">
                <i class="bi bi-cash-coin"></i> نقاط البيع
            </a>
            <a href="dashboard.html#expenses" class="nav-link">
                <i class="bi bi-cash-stack"></i> المصروفات
            </a>
            <a href="dashboard.html#reports" class="nav-link" data-permission="manager">
                <i class="bi bi-graph-up"></i> التقارير المالية
            </a>
            <a href="dashboard.html#settings" class="nav-link" data-permission="manager">
                <i class="bi bi-gear"></i> الإعدادات
            </a>
            <a href="chat.php" class="nav-link active">
                <i class="bi bi-chat-dots"></i> الشات
            </a>
        </nav>
        
        <div class="sidebar-footer">
            <div class="user-info">
                <p><i class="bi bi-person-circle"></i> <strong id="userName"><?php echo htmlspecialchars($userName, ENT_QUOTES, 'UTF-8'); ?></strong></p>
                <p><i class="bi bi-shield-check"></i> <span id="userRole"><?php echo htmlspecialchars(getRoleName($userRole), ENT_QUOTES, 'UTF-8'); ?></span></p>
            </div>
            <button onclick="logout()" class="btn btn-danger btn-sm"><i class="bi bi-box-arrow-right"></i> تسجيل الخروج</button>
        </div>
    </aside>

    <!-- المحتوى الرئيسي -->
    <main class="main-content">
        <header class="top-bar">
            <button class="btn-menu" onclick="toggleSidebar()"><i class="bi bi-list"></i></button>
            <h1 id="pageTitle">الشات</h1>
            <div class="header-actions">
                <a href="dashboard.html" class="btn btn-icon" title="العودة للوحة التحكم"><i class="bi bi-arrow-right"></i></a>
                <button onclick="toggleDarkMode()" class="btn btn-icon" title="تبديل الوضع الليلي"><i class="bi bi-moon-stars"></i></button>
            </div>
        </header>

        <div class="content chat-page-content">
            <div class="chat-app" dir="rtl" data-chat-app
                 data-current-user-id="<?php echo $currentUserId; ?>"
                 data-current-user-name="<?php echo htmlspecialchars($currentUserName, ENT_QUOTES, 'UTF-8'); ?>"
                 data-current-user-role="<?php echo htmlspecialchars($currentUserRole, ENT_QUOTES, 'UTF-8'); ?>">
                <button class="chat-sidebar-toggle" type="button" data-chat-sidebar-toggle aria-label="تبديل قائمة الأعضاء">
                    <span class="chat-sidebar-toggle-icon">☰</span>
                </button>
                <div class="chat-sidebar-overlay" data-chat-sidebar-overlay></div>
                <aside class="chat-sidebar" data-chat-sidebar>
                    <div class="chat-sidebar-header">
                        <h2>الأعضاء</h2>
                        <span class="chat-loading">تحديث</span>
                    </div>
                    <div class="chat-sidebar-search">
                        <input type="search" placeholder="ابحث عن عضو..." data-chat-search>
                    </div>
                    <div class="chat-user-list" data-chat-users>
                        <!-- سيتم تعبئته عبر JavaScript -->
                    </div>
                </aside>
                <main class="chat-main">
                    <header class="chat-header">
                        <div class="chat-header-left">
                            <h1><?php echo htmlspecialchars($roomName, ENT_QUOTES, 'UTF-8'); ?></h1>
                            <span data-chat-count><?php echo $onlineCount; ?> متصل / <?php echo $membersCount; ?> أعضاء</span>
                        </div>
                        <div class="chat-header-actions">
                            <button class="chat-button chat-theme-toggle" type="button" data-chat-theme-toggle aria-label="تبديل الوضع الليلي">
                                <span class="chat-theme-icon">🌙</span>
                                <span class="chat-theme-text">الوضع الليلي</span>
                            </button>
                        </div>
                    </header>
                    <section class="chat-messages" data-chat-messages>
                        <div class="chat-empty-state" data-chat-empty>
                            <h3>ابدأ المحادثة الآن</h3>
                        </div>
                    </section>
                    <footer class="chat-composer" data-chat-composer>
                        <div class="chat-reply-bar" data-chat-reply>
                            <div class="chat-reply-info">
                                <strong data-chat-reply-name></strong>
                                <span data-chat-reply-text></span>
                            </div>
                            <button class="chat-reply-dismiss" type="button" data-chat-reply-dismiss>&times;</button>
                        </div>
                        <div class="chat-input-wrapper">
                            <textarea
                                class="chat-input"
                                data-chat-input
                                rows="1"
                                placeholder="اكتب رسالة ..."
                                autocomplete="off"></textarea>
                            <div class="chat-composer-actions">
                                <button class="chat-icon-button chat-send-button" type="button" title="إرسال" data-chat-send aria-label="إرسال الرسالة">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </footer>
                    <div class="chat-toast" data-chat-toast>تم تحديث الدردشة</div>
                </main>
            </div>
        </div>
    </main>

    <script src="<?php echo asset('js/api.js'); ?>"></script>
    <script src="<?php echo asset('js/utils.js'); ?>"></script>
    <script src="<?php echo asset('js/auth.js'); ?>"></script>
    <script>
        // تطبيق التصميم الأساسي فوراً
        (function() {
            // تطبيق الوضع الليلي إذا كان محفوظاً
            if (localStorage.getItem('darkMode') === 'true') {
                document.body.classList.add('dark-mode');
            }
            
            // التأكد من ظهور الشات فوراً
            function ensureChatVisible() {
                const chatApp = document.querySelector('.chat-app');
                if (chatApp) {
                    chatApp.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; height: 100% !important; width: 100% !important;';
                }
                
                const chatMain = document.querySelector('.chat-main');
                if (chatMain) {
                    chatMain.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; flex: 1 !important;';
                }
                
                const chatMessages = document.querySelector('.chat-messages');
                if (chatMessages) {
                    chatMessages.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; flex: 1 !important;';
                }
                
                const chatComposer = document.querySelector('.chat-composer');
                if (chatComposer) {
                    chatComposer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
                }
                
                const chatSidebar = document.querySelector('.chat-sidebar');
                if (chatSidebar) {
                    chatSidebar.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
                }
            }
            
            // تطبيق فوراً
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', ensureChatVisible);
            } else {
                ensureChatVisible();
            }
            
            // تطبيق مرة أخرى بعد تحميل كامل
            window.addEventListener('load', ensureChatVisible);
        })();
        
        // التحقق من تسجيل الدخول
        window.addEventListener('DOMContentLoaded', async function() {
            try {
                if (typeof API === 'undefined' || !API.checkAuth) {
                    console.error('API غير متاح');
                    setTimeout(arguments.callee, 100);
                    return;
                }
                
                const result = await API.checkAuth();
                if (!result || !result.success) {
                    window.location.href = 'index.html';
                    return;
                }
                
                const user = result.data;
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                
                // إخفاء عناصر القائمة حسب الصلاحيات
                document.querySelectorAll('[data-permission]').forEach(el => {
                    const requiredRole = el.dataset.permission;
                    if (requiredRole === 'manager' && user.role !== 'manager') {
                        el.style.display = 'none';
                    }
                });
                
                // تهيئة الشات بعد تأكيد المصادقة
                function initializeChat() {
                    if (typeof window.initChat === 'function') {
                        window.CHAT_API_BASE = '<?php echo htmlspecialchars($apiBase, ENT_QUOTES, 'UTF-8'); ?>';
                        setTimeout(() => {
                            window.initChat(user);
                        }, 100);
                    } else {
                        setTimeout(initializeChat, 200);
                    }
                }
                
                initializeChat();
            } catch (error) {
                console.error('خطأ في تهيئة الشات:', error);
            }
        });
        
        async function logout() {
            if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                try {
                    if (typeof API !== 'undefined' && API.logout) {
                        await API.logout();
                    }
                    window.location.href = 'index.html';
                } catch (error) {
                    window.location.href = 'index.html';
                }
            }
        }
        
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        }
        
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark ? 'true' : 'false');
        }
        
        // تحميل الوضع الليلي المحفوظ
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }
        
        // تسجيل Service Worker لدعم PWA
        const registerServiceWorker = () => {
            if ('serviceWorker' in navigator) {
                try {
                    const appVersion = window.APP_VERSION || 'v' + Date.now();
                    navigator.serviceWorker.register('/sw.js?v=' + appVersion, {
                        scope: '/',
                        updateViaCache: 'none'
                    }).then(registration => {
                        console.log('✅ Service Worker registered in Chat');
                    }).catch(error => {
                        console.warn('Service Worker registration failed:', error);
                    });
                } catch (error) {
                    console.warn('Service Worker registration error:', error);
                }
            }
        };
        
        // تسجيل Service Worker بعد تحميل الصفحة بالكامل
        if (window.requestIdleCallback) {
            window.requestIdleCallback(registerServiceWorker, { timeout: 5000 });
        } else {
            window.addEventListener('load', () => {
                setTimeout(registerServiceWorker, 2000);
            });
        }
    </script>
    <script src="<?php echo asset('js/chat-integrated.js'); ?>"></script>
</body>
</html>

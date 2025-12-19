<?php
/**
 * صفحة الشات - صفحة واحدة فقط
 */
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/chat.php';
require_once __DIR__ . '/includes/path_helper.php';

requireRole(['manager', 'production', 'sales', 'accountant']);

$currentUser = getCurrentUser();
$currentUserId = (int) ($currentUser['id'] ?? 0);
$currentUserName = $currentUser['full_name'] ?? ($currentUser['username'] ?? 'عضو');
$currentUserRole = $currentUser['role'] ?? 'member';
$userName = $currentUser['full_name'] ?? ($currentUser['username'] ?? 'المستخدم');
$userRole = $currentUser['role'] ?? 'member';

$apiBase = getRelativeUrl('api/chat');
$roomName = 'الشات';

$onlineUsers = getActiveUsers();
$onlineCount = 0;
foreach ($onlineUsers as $onlineUser) {
    if (!empty($onlineUser['is_online'])) {
        $onlineCount++;
    }
}
$membersCount = count($onlineUsers);

function getRoleName($role) {
    $roles = [
        'manager' => 'مدير',
        'production' => 'إنتاج',
        'sales' => 'مبيعات',
        'accountant' => 'محاسب',
        'member' => 'عضو'
    ];
    return $roles[$role] ?? $role;
}

function hasPermission($userRole, $requiredRole) {
    if ($requiredRole === 'manager') {
        return $userRole === 'manager';
    }
    return true;
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
    
    <title>الشات - نظام إدارة محل صيانة الهواتف</title>
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-192x192.png">
    <link rel="icon" type="image/png" sizes="16x16" href="icons/icon-96x96.png">
    <link rel="shortcut icon" href="favicon.ico">
    
    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-192x192.png">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- Preload للملفات المهمة لتحميل أسرع -->
    <link rel="preload" href="css/chat-integrated.css" as="style">
    <link rel="stylesheet" href="css/chat-integrated.css" media="print" onload="this.media='all'; this.onload=null;">
    <noscript><link rel="stylesheet" href="css/chat-integrated.css"></noscript>
    
    <!-- Script لضمان تحميل CSS -->
    <script>
        (function() {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/chat-integrated.css';
            link.media = 'all';
            document.head.appendChild(link);
        })();
    </script>
    
    <!-- تحميل ملف الإصدارات أولاً -->
    <script src="js/version.js"></script>
    <script>
        (function() {
            const getAppVersion = function() {
                return window.APP_VERSION || 'v' + Date.now();
            };
            
            document.addEventListener('DOMContentLoaded', function() {
                const version = getAppVersion();
                const versionParam = '?v=' + version;
                
                const cssLinks = document.querySelectorAll('link[rel="stylesheet"]:not([href^="http"])');
                cssLinks.forEach(link => {
                    if (link.href && !link.href.includes('?')) {
                        link.href = link.href + versionParam;
                    }
                });
                
                const jsScripts = document.querySelectorAll('script[src]:not([src*="version.js"]):not([src^="http"])');
                jsScripts.forEach(script => {
                    if (script.src && !script.src.includes('?')) {
                        script.src = script.src + versionParam;
                    }
                });
            });
        })();
    </script>
    
    <link rel="stylesheet" href="css/style.css">
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
                <i class="bi bi-cash-register"></i> نقاط البيع
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
                            <p>شارك فريقك آخر المستجدات، إرسال الرسائل يتم تحديثه فورياً مع ظهور إشعارات عند وصول أي رسالة جديدة.</p>
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
                                placeholder="اكتب رسالة ودية..."
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

    <script src="js/api.js"></script>
    <script src="js/utils.js"></script>
    <script src="js/auth.js"></script>
    <script>
        // تطبيق التصميم الأساسي فوراً قبل تحميل أي شيء آخر
        (function() {
            const chatApp = document.querySelector('.chat-app');
            if (chatApp) {
                chatApp.style.opacity = '1';
                chatApp.style.visibility = 'visible';
            }
            
            // تطبيق الوضع الليلي إذا كان محفوظاً
            if (localStorage.getItem('darkMode') === 'true') {
                document.body.classList.add('dark-mode');
            }
        })();
        
        // التحقق من تسجيل الدخول
        window.addEventListener('DOMContentLoaded', async () => {
            const result = await API.checkAuth();
            if (!result.success) {
                window.location.href = 'index.html';
                return;
            }
            
            const user = result.data;
            
            // إخفاء عناصر القائمة حسب الصلاحيات
            document.querySelectorAll('[data-permission]').forEach(el => {
                const requiredRole = el.dataset.permission;
                if (requiredRole === 'manager' && user.role !== 'manager') {
                    el.style.display = 'none';
                }
            });
            
            // تهيئة الشات بعد تأكيد المصادقة
            function initializeChat() {
                if (window.initChat) {
                    window.CHAT_API_BASE = '<?php echo htmlspecialchars($apiBase, ENT_QUOTES, 'UTF-8'); ?>';
                    console.log('Initializing chat with user:', user);
                    setTimeout(() => {
                        window.initChat(user);
                    }, 100);
                } else {
                    console.warn('initChat not found, retrying...');
                    setTimeout(initializeChat, 200);
                }
            }
            
            if (document.readyState === 'complete') {
                initializeChat();
            } else {
                window.addEventListener('load', initializeChat);
            }
        });
        
        async function logout() {
            if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                await API.logout();
                window.location.href = 'index.html';
            }
        }
        
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
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
    </script>
    <script src="js/chat-integrated.js"></script>
</body>
</html>

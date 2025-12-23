<?php
/**
 * صفحة إدارة سجلات الأخطاء
 */

// تفعيل عرض الأخطاء للتطوير
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// بدء الجلسة أولاً
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

// تحميل الملفات المطلوبة
require_once __DIR__ . '/includes/cache.php';
require_once __DIR__ . '/api/database.php';

// دوال المصادقة
if (!function_exists('isLoggedIn')) {
    function isLoggedIn() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        return isset($_SESSION['user_id']);
    }
}

if (!function_exists('getCurrentUser')) {
    function getCurrentUser() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!isset($_SESSION['user_id'])) {
            return null;
        }
        return [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'] ?? '',
            'name' => $_SESSION['name'] ?? '',
            'role' => $_SESSION['role'] ?? 'employee'
        ];
    }
}

// منع كاش هذه الصفحة
if (function_exists('disablePageCache')) {
    disablePageCache();
}

// التحقق من تسجيل الدخول
if (!function_exists('isLoggedIn') || !isLoggedIn()) {
    header('Location: index.html');
    exit;
}

// التحقق من الصلاحيات - فقط المديرين والمديرين
$currentUser = getCurrentUser();
if (!$currentUser) {
    header('Location: index.html');
    exit;
}

$userRole = $currentUser['role'] ?? 'employee';
if (!in_array($userRole, ['admin', 'manager'])) {
    header('Location: dashboard.html?error=insufficient_permissions');
    exit;
}

$userName = $currentUser['name'] ?? ($currentUser['username'] ?? 'المستخدم');
$userRoleName = $userRole === 'admin' ? 'مدير' : ($userRole === 'manager' ? 'مدير' : 'موظف');

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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="description" content="إدارة سجلات الأخطاء">
    <meta name="theme-color" content="#2196F3">
    
    <title>سجلات الأخطاء - نظام إدارة محل صيانة الهواتف</title>
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-96x96.png">
    <link rel="shortcut icon" href="icons/icon-192x192.png">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- CSS Files -->
    <link rel="stylesheet" href="<?php echo asset('css/style.css'); ?>">
    
    <style>
        .error-logs-container {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .error-logs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .error-logs-header h1 {
            margin: 0;
            color: var(--primary-color, #2196F3);
            font-size: 24px;
        }
        
        .error-logs-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .error-logs-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card.error {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .stat-card.warning {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            color: #333;
        }
        
        .stat-card.info {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            color: #333;
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            opacity: 0.9;
        }
        
        .stat-card .value {
            font-size: 28px;
            font-weight: bold;
            margin: 0;
        }
        
        .error-logs-filters {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .error-logs-filters input,
        .error-logs-filters select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .error-logs-table {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .error-logs-table table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .error-logs-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: right;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .error-logs-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .error-logs-table tr:hover {
            background: #f8f9fa;
        }
        
        .log-type {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .log-type.error {
            background: #fee;
            color: #c33;
        }
        
        .log-type.warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .log-type.info {
            background: #d1ecf1;
            color: #0c5460;
        }
        
        .log-message {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            word-break: break-word;
            max-width: 600px;
        }
        
        .log-actions {
            display: flex;
            gap: 5px;
        }
        
        .log-actions button {
            padding: 6px 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        
        .log-actions .btn-copy {
            background: #2196F3;
            color: white;
        }
        
        .log-actions .btn-copy:hover {
            background: #1976D2;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .empty-state i {
            font-size: 64px;
            margin-bottom: 20px;
            opacity: 0.3;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: none;
        }
        
        .toast.show {
            display: block;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        
        @media (max-width: 768px) {
            .error-logs-table {
                overflow-x: auto;
            }
            
            .error-logs-table table {
                min-width: 800px;
            }
        }
    </style>
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
            <a href="error-logs.php" class="nav-link active" data-permission="manager">
                <i class="bi bi-file-earmark-text"></i> سجلات الأخطاء
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
            <h1 id="pageTitle">سجلات الأخطاء</h1>
            <div class="header-actions">
                <a href="dashboard.html" class="btn btn-icon" title="العودة للوحة التحكم"><i class="bi bi-arrow-right"></i></a>
                <button onclick="toggleDarkMode()" class="btn btn-icon" title="تبديل الوضع الليلي"><i class="bi bi-moon-stars"></i></button>
            </div>
        </header>

        <div class="content">
            <div class="error-logs-container">
                <div class="error-logs-header">
                    <h1><i class="bi bi-file-earmark-text"></i> سجلات الأخطاء</h1>
                    <div class="error-logs-actions">
                        <button class="btn btn-primary" onclick="refreshLogs()">
                            <i class="bi bi-arrow-clockwise"></i> تحديث
                        </button>
                        <?php if ($userRole === 'admin'): ?>
                        <button class="btn btn-danger" onclick="clearLogs()">
                            <i class="bi bi-trash"></i> حذف جميع السجلات
                        </button>
                        <?php endif; ?>
                    </div>
                </div>
                
                <div class="error-logs-stats" id="statsContainer">
                    <div class="stat-card">
                        <h3>إجمالي السجلات</h3>
                        <p class="value" id="totalLogs">-</p>
                    </div>
                    <div class="stat-card error">
                        <h3>أخطاء</h3>
                        <p class="value" id="errorCount">-</p>
                    </div>
                    <div class="stat-card warning">
                        <h3>تحذيرات</h3>
                        <p class="value" id="warningCount">-</p>
                    </div>
                    <div class="stat-card info">
                        <h3>معلومات</h3>
                        <p class="value" id="infoCount">-</p>
                    </div>
                </div>
                
                <div class="error-logs-filters">
                    <input type="number" id="linesInput" placeholder="عدد الأسطر" value="1000" min="1" max="10000" style="width: 120px;">
                    <select id="typeFilter">
                        <option value="">جميع الأنواع</option>
                        <option value="error">أخطاء فقط</option>
                        <option value="warning">تحذيرات فقط</option>
                        <option value="info">معلومات فقط</option>
                    </select>
                    <input type="text" id="searchInput" placeholder="بحث في السجلات..." style="flex: 1; min-width: 200px;">
                    <button class="btn btn-secondary" onclick="applyFilters()">
                        <i class="bi bi-funnel"></i> تطبيق
                    </button>
                </div>
                
                <div class="error-logs-table">
                    <div id="loadingIndicator" class="loading">
                        <i class="bi bi-hourglass-split"></i> جاري التحميل...
                    </div>
                    <div id="emptyState" class="empty-state" style="display: none;">
                        <i class="bi bi-inbox"></i>
                        <h3>لا توجد سجلات</h3>
                        <p>لا توجد سجلات أخطاء لعرضها</p>
                    </div>
                    <table id="logsTable" style="display: none;">
                        <thead>
                            <tr>
                                <th style="width: 60px;">#</th>
                                <th style="width: 180px;">التاريخ والوقت</th>
                                <th style="width: 100px;">النوع</th>
                                <th>الرسالة</th>
                                <th style="width: 100px;">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="logsTableBody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>
    
    <div class="toast" id="toast"></div>
    
    <script src="<?php echo asset('js/api.js'); ?>"></script>
    <script src="<?php echo asset('js/utils.js'); ?>"></script>
    <script src="<?php echo asset('js/auth.js'); ?>"></script>
    <script src="<?php echo asset('js/error-logs.js'); ?>"></script>
    
    <script>
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
    </script>
</body>
</html>

// إدارة المصادقة والصلاحيات

// متغير لمنع الطلبات المتكررة
let checkLoginInProgress = false;
let lastCheckLoginTime = 0;
let cachedAuthResult = null;
let cacheTime = 0;
const CHECK_LOGIN_COOLDOWN = 1000; // 1 ثانية بين الطلبات
const AUTH_CACHE_DURATION = 3000; // 3 ثواني للتخزين المؤقت

// التحقق من تسجيل الدخول
async function checkLogin() {
    const now = Date.now();
    
    // استخدام التخزين المؤقت إذا كان صالحاً
    if (cachedAuthResult !== null && (now - cacheTime < AUTH_CACHE_DURATION)) {
        return cachedAuthResult;
    }
    
    // منع الطلبات المتكررة - إذا كان هناك طلب قيد التنفيذ، انتظر
    if (checkLoginInProgress) {
        // انتظار انتهاء الطلب الحالي (بحد أقصى 2 ثانية)
        const startWait = Date.now();
        while (checkLoginInProgress && (Date.now() - startWait < 2000)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            // إذا أصبحت النتيجة متاحة أثناء الانتظار، استخدمها
            if (cachedAuthResult !== null && (Date.now() - cacheTime < AUTH_CACHE_DURATION)) {
                return cachedAuthResult;
            }
        }
        // إذا انتهى الانتظار ولم تكن هناك نتيجة، أرجع null
        return null;
    }
    
    // تطبيق cooldown - إذا كان آخر طلب منذ أقل من cooldown، استخدم النتيجة المخزنة
    if (now - lastCheckLoginTime < CHECK_LOGIN_COOLDOWN && cachedAuthResult !== null) {
        return cachedAuthResult;
    }
    
    checkLoginInProgress = true;
    lastCheckLoginTime = now;
    
    try {
        const result = await API.checkAuth();
        
        if (!result || !result.success) {
            cachedAuthResult = null;
            cacheTime = 0;
            // مسح جميع البيانات المحلية
            localStorage.clear();
            sessionStorage.clear();
            
            // إذا لم يكن مسجل الدخول، التوجيه لصفحة تسجيل الدخول (فقط إذا لم نكن في صفحة تسجيل الدخول)
            const currentPage = window.location.pathname;
            if (!currentPage.includes('index.html') && currentPage !== '/') {
                if (typeof showLoginRequiredMessage === 'function') {
                    showLoginRequiredMessage();
                }
            }
            return null;
        }
        
        // حفظ بيانات المستخدم
        const user = result.data;
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            // حفظ في التخزين المؤقت
            cachedAuthResult = user;
            cacheTime = Date.now();
        }
        
        return user;
    } catch (error) {
        console.error('خطأ في checkLogin:', error);
        cachedAuthResult = null;
        cacheTime = 0;
        return null;
    } finally {
        checkLoginInProgress = false;
    }
}

// متغير لمنع التوجيه المتعدد
let isRedirectingAfterLogin = false;

// تسجيل الدخول
async function login(username, password) {
    try {
        const result = await API.login(username, password);
        
        // التحقق من النتيجة بشكل صحيح
        if (result && result.success === true && result.data) {
            // منع التوجيه المتعدد
            if (isRedirectingAfterLogin) {
                console.log('⏸️ توجيه قيد التنفيذ بالفعل - تم إلغاء التوجيه المكرر');
                return result;
            }
            
            isRedirectingAfterLogin = true;
            
            // مسح البيانات القديمة أولاً
            localStorage.clear();
            sessionStorage.clear();
            
            // حفظ بيانات المستخدم الجديدة
            localStorage.setItem('currentUser', JSON.stringify(result.data));
            
            // إعادة تهيئة نظام المزامنة
            if (typeof syncManager !== 'undefined') {
                syncManager.stopAutoSync();
                // إعادة إنشاء instance جديد
                window.syncManager = new SyncManager();
            }
            
            console.log('✅ تسجيل الدخول ناجح - التوجيه إلى dashboard.html');
            // استخدام window.location.replace بدلاً من href لتجنب مشاكل التوجيه المتعددة
            window.location.replace('dashboard.html');
            return result;
        }
        
        return result;
    } catch (error) {
        console.error('خطأ في دالة login:', error);
        return {
            success: false,
            message: error.message || 'حدث خطأ أثناء تسجيل الدخول',
            error: error
        };
    }
}

// تسجيل الخروج
async function logout() {
    try {
        // إيقاف المزامنة التلقائية أولاً
        if (typeof syncManager !== 'undefined') {
            syncManager.stopAutoSync();
        }
        
        // إرسال طلب تسجيل الخروج للخادم
        await API.logout();
    } catch (error) {
        console.log('خطأ في تسجيل الخروج من الخادم:', error);
        // نستمر في عملية تسجيل الخروج حتى لو فشل الطلب
    }
    
    // مسح جميع البيانات المحلية
    localStorage.clear();
    sessionStorage.clear();
    
    // مسح جميع الكوكيز
    document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // منع التخزين المؤقت للصفحة
    if (window.history && window.history.pushState) {
        window.history.pushState(null, null, 'index.html');
        window.addEventListener('popstate', function() {
            window.history.pushState(null, null, 'index.html');
        });
    }
    
    // إعادة التوجيه مع منع الرجوع
    window.location.replace('index.html');
    
    // تأكيد إضافي
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 100);
}

// الحصول على المستخدم الحالي
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

// التحقق من الصلاحية
function hasPermission(requiredRole) {
    const user = getCurrentUser();
    if (!user) {
        console.log('hasPermission: No user found');
        return false;
    }
    
    console.log('hasPermission: user =', user, 'requiredRole =', requiredRole);
    
    const roles = { 'admin': 3, 'manager': 2, 'employee': 1 };
    const userRoleLevel = roles[user.role];
    const requiredRoleLevel = roles[requiredRole];
    
    const hasPermission = userRoleLevel >= requiredRoleLevel;
    console.log('hasPermission: userRoleLevel =', userRoleLevel, 'requiredRoleLevel =', requiredRoleLevel, 'hasPermission =', hasPermission);
    
    return hasPermission;
}

// إخفاء عناصر حسب الصلاحية
function hideByPermission() {
    const user = getCurrentUser();
    if (!user) return;
    
    // إخفاء عناصر تحتاج صلاحية admin
    if (user.role !== 'admin') {
        document.querySelectorAll('[data-permission="admin"]').forEach(el => {
            el.style.display = 'none';
        });
    }
    
    // إخفاء عناصر تحتاج صلاحية manager أو أعلى
    if (user.role === 'employee') {
        document.querySelectorAll('[data-permission="manager"]').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// عرض معلومات المستخدم في الواجهة
function displayUserInfo() {
    const user = getCurrentUser();
    if (!user) return;
    
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    
    if (userNameElement) {
        userNameElement.textContent = user.name;
    }
    
    if (userRoleElement) {
        userRoleElement.textContent = getRoleText(user.role);
    }
    
    // تحديث معلومات المستخدم في الـ top-bar للهواتف
    const mobileUserNameElement = document.getElementById('mobileUserName');
    const mobileUserRoleElement = document.getElementById('mobileUserRole');
    
    if (mobileUserNameElement) {
        mobileUserNameElement.textContent = user.name;
    }
    
    if (mobileUserRoleElement) {
        mobileUserRoleElement.textContent = getRoleText(user.role);
    }
}

// عرض رسالة تسجيل الدخول المطلوب
function showLoginRequiredMessage() {
    // إنشاء overlay مع تأثير blur
    const overlay = document.createElement('div');
    overlay.id = 'login-required-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-in-out;
    `;
    
    // إنشاء رسالة في منتصف الشاشة
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 15px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 400px;
        margin: 20px;
        animation: slideIn 0.5s ease-out;
    `;
    
    messageBox.innerHTML = `
        <div style="margin-bottom: 20px;">
            <i class="bi bi-shield-exclamation" style="font-size: 48px; color: #dc3545;"></i>
        </div>
        <h2 style="color: #dc3545; margin-bottom: 15px; font-family: 'Cairo', sans-serif;">الوصول ممنوع</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
            يجب عليك تسجيل الدخول أولاً للوصول إلى هذه الصفحة
        </p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px;">
            <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #dc3545; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span style="color: #666; font-size: 14px;">جاري التوجيه لصفحة تسجيل الدخول...</span>
        </div>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    
    // إضافة تأثير blur على المحتوى الأساسي
    const mainContent = document.querySelector('main') || document.body;
    mainContent.style.filter = 'blur(5px)';
    mainContent.style.transition = 'filter 0.3s ease-in-out';
    
    // إضافة الأنماط المطلوبة
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-30px) scale(0.9);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        #login-required-overlay {
            font-family: 'Cairo', sans-serif;
        }
    `;
    document.head.appendChild(style);
    
    // تأخير 3 ثواني ثم التوجيه لصفحة تسجيل الدخول
    setTimeout(() => {
        // إزالة تأثير blur
        mainContent.style.filter = 'none';
        
        // إزالة overlay
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // إزالة الأنماط
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
        
        // التوجيه لصفحة تسجيل الدخول
        window.location.replace('index.html');
    }, 3000);
}


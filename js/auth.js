// إدارة المصادقة والصلاحيات

// متغير لمنع الطلبات المتكررة
let checkLoginInProgress = false;
let lastCheckLoginTime = 0;
let cachedAuthResult = null;
let cacheTime = 0;
const CHECK_LOGIN_COOLDOWN = 1000; // 1 ثانية بين الطلبات
const AUTH_CACHE_DURATION = 30000; // 30 ثانية للتخزين المؤقت (محسّن لتقليل الطلبات)

// التحقق من تسجيل الدخول
async function checkLogin() {
    const now = Date.now();
    
    // ✅ تحسين: بعد تسجيل الدخول مباشرة (أقل من 5 ثوان)، استخدم البيانات المحفوظة بدون استدعاء الخادم
    const justLoggedInTime = sessionStorage.getItem('just_logged_in_time');
    const isRecentLogin = justLoggedInTime && (now - parseInt(justLoggedInTime)) < 5000; // 5 ثوان فقط لتسجيل الدخول الفوري
    
    if (isRecentLogin) {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                // تحديث cache
                cachedAuthResult = user;
                cacheTime = now;
                // مسح العلامة بعد الاستخدام الناجح
                sessionStorage.removeItem('just_logged_in_time');
                return user;
            }
        } catch (e) {
            console.warn('⚠️ خطأ في قراءة البيانات المحفوظة:', e);
        }
    }
    
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
        // ✅ تسجيل حالة التحقق
        console.log('🔍 checkLogin - Starting checkAuth...');
        console.log('🔍 checkLogin - Cookies:', document.cookie);
        console.log('🔍 checkLogin - localStorage currentUser:', localStorage.getItem('currentUser'));
        console.log('🔍 checkLogin - sessionStorage just_logged_in_time:', sessionStorage.getItem('just_logged_in_time'));
        
        const result = await API.checkAuth(true); // ✅ استخدام silent: true لتجنب عرض loading overlay
        
        console.log('🔍 checkLogin - checkAuth result:', result);
        console.log('🔍 checkLogin - result.success:', result?.success);
        console.log('🔍 checkLogin - result.data:', result?.data);
        
        if (!result || !result.success) {
            console.log('❌ checkLogin - checkAuth failed:', result);
            // التحقق من خطأ الشبكة - في حالة خطأ الشبكة، نحاول استخدام البيانات المحفوظة
            if (result && result.networkError) {
                console.warn('⚠️ خطأ في الشبكة - محاولة استخدام البيانات المحفوظة');
                // محاولة استخدام البيانات المحفوظة من localStorage
                try {
                    const savedUser = localStorage.getItem('currentUser');
                    if (savedUser) {
                        const user = JSON.parse(savedUser);
                        console.log('✅ استخدام بيانات المستخدم المحفوظة');
                        // تحديث cache بدون تحديث cacheTime (لإجبار إعادة المحاولة لاحقاً)
                        cachedAuthResult = user;
                        return user;
                    }
                } catch (e) {
                    console.error('خطأ في قراءة البيانات المحفوظة:', e);
                }
            }
            
            cachedAuthResult = null;
            cacheTime = 0;
            
            // 🔧 الحل 1: التحقق من تسجيل دخول حديث قبل مسح localStorage
            const justLoggedInTime = sessionStorage.getItem('just_logged_in_time');
            const currentPage = window.location.pathname;
            const isIndexPage = currentPage.includes('index.html') || currentPage === '/';
            
            // إذا كان تسجيل دخول حديث (أقل من 15 ثوان) وليس في صفحة index
            if (justLoggedInTime && (now - parseInt(justLoggedInTime)) < 15000 && !isIndexPage) {
                console.log('⏳ تسجيل دخول حديث - إعطاء فرصة للجلسة...');
                // إعطاء فرصة للجلسة - إعادة المحاولة بعد ثانية واحدة
                await new Promise(resolve => setTimeout(resolve, 1000));
                // محاولة مرة أخرى
                try {
                    const retryResult = await API.checkAuth(true); // ✅ استخدام silent: true لتجنب عرض loading overlay
                    if (retryResult && retryResult.success) {
                        const user = retryResult.data;
                        if (user) {
                            localStorage.setItem('currentUser', JSON.stringify(user));
                            cachedAuthResult = user;
                            cacheTime = Date.now();
                            // مسح العلامة بعد النجاح
                            sessionStorage.removeItem('just_logged_in_time');
                        }
                        return user;
                    }
                } catch (retryError) {
                    console.log('فشلت إعادة المحاولة:', retryError);
                }
                // إذا فشلت إعادة المحاولة، لا نمسح العلامة بعد - نتركها لتجنب loop
                // فقط نرجع null بدون استدعاء showLoginRequiredMessage
                console.log('⏸️ فشلت إعادة المحاولة - إرجاع null بدون توجيه لتجنب loop');
                return null;
            }
            
            // مسح جميع البيانات المحلية (فقط إذا لم يكن تسجيل دخول حديث)
            localStorage.clear();
            // لا نمسح sessionStorage بالكامل - نحتفظ بعلامة just_logged_in_time إذا كانت موجودة
            const keepJustLoggedIn = sessionStorage.getItem('just_logged_in_time');
            sessionStorage.clear();
            if (keepJustLoggedIn) {
                sessionStorage.setItem('just_logged_in_time', keepJustLoggedIn);
            }
            
            // إذا لم يكن مسجل الدخول، التوجيه لصفحة تسجيل الدخول (فقط إذا لم نكن في صفحة تسجيل الدخول)
            if (!isIndexPage) {
                if (typeof showLoginRequiredMessage === 'function') {
                    showLoginRequiredMessage();
                }
            }
            return null;
        }
        
        // حفظ بيانات المستخدم
        const user = result.data;
        if (user) {
            // ✅ التحقق من role وبيانات المستخدم
            let errorReason = null;
            
            // التحقق من وجود role
            if (!user.role || user.role === '') {
                errorReason = 'فشل في تحديد دور المستخدم: role فارغ';
                console.error('❌ ' + errorReason, user);
            } 
            // التحقق من صحة role
            else if (!['admin', 'manager', 'employee', 'technician'].includes(user.role)) {
                errorReason = 'دور المستخدم غير صحيح: ' + user.role;
                console.error('❌ ' + errorReason, user);
            }
            // التحقق من وجود بيانات أساسية
            else if (!user.id || !user.username || !user.name) {
                errorReason = 'بيانات المستخدم غير مكتملة: id=' + (user.id || 'null') + ', username=' + (user.username || 'null') + ', name=' + (user.name || 'null');
                console.error('❌ ' + errorReason, user);
            }
            
            // إذا كان هناك خطأ، عمل logout وطباعة الخطأ
            if (errorReason !== null) {
                console.error('❌ فشل في تحديد دور الحساب وبياناته:', errorReason);
                console.error('❌ بيانات المستخدم المستلمة:', user);
                
                // مسح البيانات المحلية
                localStorage.clear();
                sessionStorage.clear();
                cachedAuthResult = null;
                cacheTime = 0;
                
                // عمل logout
                try {
                    await logout();
                } catch (logoutError) {
                    console.error('❌ خطأ في تسجيل الخروج:', logoutError);
                }
                
                return null;
            }
            
            localStorage.setItem('currentUser', JSON.stringify(user));
            // حفظ في التخزين المؤقت
            cachedAuthResult = user;
            cacheTime = Date.now();
            // مسح علامة تسجيل الدخول الحديث بعد نجاح التحقق من الخادم
            const justLoggedInTime2 = sessionStorage.getItem('just_logged_in_time');
            if (justLoggedInTime2) {
                sessionStorage.removeItem('just_logged_in_time');
            }
        }
        
        return user;
    } catch (error) {
        console.error('خطأ في checkLogin:', error);
        
        // في حالة خطأ، محاولة استخدام البيانات المحفوظة (مع التحقق من صحتها)
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                
                // ✅ التحقق من role وبيانات المستخدم المحفوظة
                let errorReason = null;
                
                if (!user.role || user.role === '') {
                    errorReason = 'فشل في تحديد دور المستخدم المحفوظ: role فارغ';
                } else if (!['admin', 'manager', 'employee'].includes(user.role)) {
                    errorReason = 'دور المستخدم المحفوظ غير صحيح: ' + user.role;
                } else if (!user.id || !user.username || !user.name) {
                    errorReason = 'بيانات المستخدم المحفوظة غير مكتملة';
                }
                
                // إذا كانت البيانات المحفوظة غير صحيحة، مسحها
                if (errorReason !== null) {
                    console.error('❌ ' + errorReason, user);
                    localStorage.removeItem('currentUser');
                    cachedAuthResult = null;
                    cacheTime = 0;
                    return null;
                }
                
                console.log('⚠️ استخدام بيانات المستخدم المحفوظة بعد الخطأ');
                // تحديث cache بدون تحديث cacheTime (لإجبار إعادة المحاولة لاحقاً)
                cachedAuthResult = user;
                return user;
            }
        } catch (e) {
            console.error('خطأ في قراءة البيانات المحفوظة:', e);
        }
        
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
async function login(username, password, rememberMe = false) {
    try {
        const result = await API.login(username, password);
        
        // ✅ فحص محتوى النتيجة للتشخيص
        console.log('🔍 فحص نتيجة تسجيل الدخول:');
        console.log('  - hasResult:', !!result);
        console.log('  - success:', result?.success);
        console.log('  - success type:', typeof result?.success);
        console.log('  - hasData:', !!result?.data);
        console.log('  - data:', result?.data);
        console.log('  - dataType:', typeof result?.data);
        console.log('  - result keys:', result ? Object.keys(result) : null);
        console.log('  - full result:', JSON.stringify(result, null, 2));
        
        // التحقق من النتيجة بشكل صحيح
        if (result && result.success === true && result.data) {
            const userData = result.data;
            
            // ✅ التحقق من role وبيانات المستخدم
            let errorReason = null;
            
            // التحقق من وجود role
            if (!userData.role || userData.role === '') {
                errorReason = 'فشل في تحديد دور المستخدم: role فارغ';
                console.error('❌ ' + errorReason, userData);
            } 
            // التحقق من صحة role
            else if (!['admin', 'manager', 'employee', 'technician'].includes(userData.role)) {
                errorReason = 'دور المستخدم غير صحيح: ' + userData.role;
                console.error('❌ ' + errorReason, userData);
            }
            // التحقق من وجود بيانات أساسية
            else if (!userData.id || !userData.username || !userData.name) {
                errorReason = 'بيانات المستخدم غير مكتملة: id=' + (userData.id || 'null') + ', username=' + (userData.username || 'null') + ', name=' + (userData.name || 'null');
                console.error('❌ ' + errorReason, userData);
            }
            
            // إذا كان هناك خطأ، عمل logout وطباعة الخطأ
            if (errorReason !== null) {
                console.error('❌ فشل في تحديد دور الحساب وبياناته:', errorReason);
                console.error('❌ بيانات المستخدم المستلمة:', userData);
                
                // عمل logout
                try {
                    await logout();
                } catch (logoutError) {
                    console.error('❌ خطأ في تسجيل الخروج:', logoutError);
                    // مسح البيانات المحلية حتى لو فشل logout
                    localStorage.clear();
                    sessionStorage.clear();
                }
                
                return {
                    success: false,
                    message: errorReason,
                    error: errorReason,
                    data: null
                };
            }
            
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
            localStorage.setItem('currentUser', JSON.stringify(userData));
            
            // ✅ حفظ اسم المستخدم إذا تم تفعيل "تذكرني" (بعد localStorage.clear())
            if (rememberMe) {
                try {
                    // حفظ اسم المستخدم في localStorage (بدون كلمة المرور لأسباب أمنية)
                    localStorage.setItem('rememberedUsername', username);
                    console.log('✅ تم حفظ اسم المستخدم للذكرى');
                } catch (e) {
                    console.warn('⚠️ فشل حفظ اسم المستخدم:', e);
                }
            }
            // ملاحظة: إذا لم يتم تفعيل "تذكرني"، فلا حاجة لمسح rememberedUsername
            // لأن localStorage.clear() قد قام بذلك بالفعل
            
            // 🔧 الحل 2: إضافة علامة تسجيل دخول حديث مع timestamp
            sessionStorage.setItem('just_logged_in_time', Date.now().toString());
            
            // إعادة تهيئة نظام المزامنة
            if (typeof syncManager !== 'undefined') {
                syncManager.stopAutoSync();
                // إعادة إنشاء instance جديد
                window.syncManager = new SyncManager();
            }
            
            // ✅ تحديد الصفحة المستهدفة للتوجيه
            // التحقق من وجود معامل redirect في URL
            const urlParams = new URLSearchParams(window.location.search);
            let redirectUrl = urlParams.get('redirect');
            
            // إذا لم يكن هناك redirect محدد، استخدم dashboard.html كافتراضي
            if (!redirectUrl || redirectUrl === '') {
                redirectUrl = 'dashboard.html';
            } else {
                // ✅ التأكد من أن URL آمن (منع XSS)
                // إزالة أي محاولات للوصول إلى صفحات خارجية
                if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://') || redirectUrl.startsWith('//')) {
                    console.warn('⚠️ محاولة توجيه غير آمنة تم رفضها:', redirectUrl);
                    redirectUrl = 'dashboard.html';
                }
                // التأكد من أن الصفحة موجودة في نفس المجلد
                if (!redirectUrl.endsWith('.html')) {
                    redirectUrl = 'dashboard.html';
                }
            }
            
            console.log('✅ تسجيل الدخول ناجح - التوجيه إلى', redirectUrl);
            console.log('🔄 بدء عملية التوجيه...');
            
            // ✅ وضع علامة للصفحة المستهدفة لاستدعاء ensureCSSAndIconsLoaded
            sessionStorage.setItem('after_login_fix_css', 'true');
            
            // ✅ التوجيه مباشرة بعد حفظ البيانات
            // استخدام window.location.href لضمان التوجيه في جميع المتصفحات
            try {
                console.log('📍 محاولة التوجيه باستخدام window.location.href:', redirectUrl);
                window.location.href = redirectUrl;
                console.log('✅ تم استدعاء window.location.href بنجاح');
            } catch (error) {
                console.error('❌ خطأ في التوجيه:', error);
                // محاولة بديلة باستخدام replace
                try {
                    console.log('📍 محاولة التوجيه البديلة باستخدام window.location.replace:', redirectUrl);
                    window.location.replace(redirectUrl);
                    console.log('✅ تم استدعاء window.location.replace بنجاح');
                } catch (replaceError) {
                    console.error('❌ خطأ في التوجيه البديل:', replaceError);
                    // آخر محاولة - استخدام assign
                    try {
                        console.log('📍 محاولة التوجيه الأخيرة باستخدام window.location.assign:', redirectUrl);
                        window.location.assign(redirectUrl);
                        console.log('✅ تم استدعاء window.location.assign بنجاح');
                    } catch (assignError) {
                        console.error('❌ فشلت جميع محاولات التوجيه:', assignError);
                    }
                }
            }
            
            return result;
        }
        
        // ✅ إذا فشل الشرط، طباعة السبب
        console.warn('⚠️ لم يتم تنفيذ التوجيه - فحص النتيجة:');
        console.warn('  - hasResult:', !!result);
        console.warn('  - success:', result?.success);
        console.warn('  - success type:', typeof result?.success);
        console.warn('  - success === true:', result?.success === true);
        console.warn('  - hasData:', !!result?.data);
        console.warn('  - data:', result?.data);
        console.warn('  - full result:', JSON.stringify(result, null, 2));
        
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
    
    const roles = { 'admin': 3, 'manager': 2, 'technician': 1.5, 'employee': 1 };
    const userRoleLevel = roles[user.role];
    const requiredRoleLevel = roles[requiredRole];
    
    const hasPermission = userRoleLevel >= requiredRoleLevel;
    console.log('hasPermission: userRoleLevel =', userRoleLevel, 'requiredRoleLevel =', requiredRoleLevel, 'hasPermission =', hasPermission);
    
    return hasPermission;
}

// Cache للتحقق من فرع البيطاش
let baytashBranchId = null;
let baytashCheckTime = 0;
const BAYTASH_CHECK_CACHE_DURATION = 300000; // 5 دقائق

// التحقق من أن المستخدم مرتبط بفرع "البيطاش"
async function isBaytashBranch() {
    try {
        const user = getCurrentUser();
        if (!user || !user.branch_id) return false;
        
        const now = Date.now();
        
        // استخدام cache إذا كان صالحاً
        if (baytashBranchId !== null && (now - baytashCheckTime < BAYTASH_CHECK_CACHE_DURATION)) {
            return String(user.branch_id) === String(baytashBranchId);
        }
        
        // جلب بيانات الفروع
        const result = await API.request('branches.php', 'GET');
        if (!result || !result.success || !result.data) return false;
        
        // البحث عن فرع "البيطاش" (بمراعاة المسافات والفراغات)
        const baytashBranch = result.data.find(branch => {
            const branchName = (branch.name || '').trim();
            return branchName === 'البيطاش';
        });
        
        if (baytashBranch) {
            baytashBranchId = baytashBranch.id;
            baytashCheckTime = now;
        } else {
            baytashBranchId = null;
            baytashCheckTime = now;
            return false;
        }
        
        // التحقق من أن المستخدم مرتبط بهذا الفرع
        return String(user.branch_id) === String(baytashBranchId);
    } catch (error) {
        console.error('خطأ في التحقق من فرع البيطاش:', error);
        return false;
    }
}

// إخفاء عناصر حسب الصلاحية
async function hideByPermission() {
    const user = getCurrentUser();
    if (!user) return;
    
    // ✅ التحقق من فرع "البيطاش" وإخفاء العناصر غير المطلوبة
    const isBaytashUser = await isBaytashBranch();
    
    if (isBaytashUser) {
        // للمستخدمين المرتبطين بفرع "البيطاش": إخفاء العناصر غير المطلوبة
        const elementsToHide = [
            'a[href="#dashboard"]',
            'a[href="pos.html"]',
            'a[href="#product-returns"]',
            'a[href="#settings"]',
            '.nav-link[onclick*="dashboard"]',
            '.nav-link[onclick*="product-returns"]',
            '.nav-link[onclick*="settings"]',
            '.mobile-nav-item[onclick*="dashboard"]',
            '.mobile-nav-item[onclick*="product-returns"]',
            '.mobile-nav-item[onclick*="settings"]',
            '.mobile-nav-item[href="pos.html"]',
            '[data-permission="admin"]'
        ];
        
        elementsToHide.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.position = 'absolute';
                el.style.opacity = '0';
                el.style.width = '0';
                el.style.height = '0';
                el.style.overflow = 'hidden';
            });
        });
        
        // إضافة CSS لإخفاء العناصر
        let styleElement = document.getElementById('baytash-branch-style');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'baytash-branch-style';
            document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = `
            /* إخفاء العناصر غير المطلوبة لفرع البيطاش */
            .sidebar-nav a[href="#dashboard"],
            .sidebar-nav a[href="pos.html"],
            .sidebar-nav a[href="#product-returns"],
            .sidebar-nav a[href="#settings"],
            .mobile-nav-container a[href="#dashboard"],
            .mobile-nav-container a[href="pos.html"],
            .mobile-nav-container a[href="#product-returns"],
            .mobile-nav-container a[href="#settings"],
            .mobile-nav-item[onclick*="'dashboard'"],
            .mobile-nav-item[onclick*="'product-returns'"],
            .mobile-nav-item[onclick*="'settings'"],
            .nav-link[onclick*="'dashboard'"],
            .nav-link[onclick*="'product-returns'"],
            .nav-link[onclick*="'settings'"],
            .sidebar-nav [data-permission="admin"],
            .mobile-nav-container [data-permission="admin"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                margin: 0 !important;
                padding: 0 !important;
            }
        `;
        
        return; // لا نتابع مع باقي المنطق لأننا أضفنا القواعد المطلوبة
    }
    
    // ✅ إخفاء عناصر تحتاج صلاحية admin بشكل قوي
    if (user.role !== 'admin') {
        document.querySelectorAll('[data-permission="admin"]').forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.height = '0';
            el.style.width = '0';
            el.style.overflow = 'hidden';
            el.style.position = 'absolute';
            el.style.margin = '0';
            el.style.padding = '0';
        });
        
        // ✅ إخفاء رابط الإعدادات بشكل صريح
        document.querySelectorAll('a[href="#settings"], .nav-link[onclick*="settings"], .mobile-nav-item[onclick*="settings"]').forEach(link => {
            link.style.display = 'none';
            link.style.visibility = 'hidden';
            link.style.position = 'absolute';
            link.style.opacity = '0';
            link.style.width = '0';
            link.style.height = '0';
            link.style.overflow = 'hidden';
        });
    }
    
    // إخفاء عناصر تحتاج صلاحية manager أو أعلى
    if (user.role === 'employee') {
        // إخفاء عناصر data-permission="manager" مباشرة
        document.querySelectorAll('[data-permission="manager"]').forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.height = '0';
            el.style.width = '0';
            el.style.overflow = 'hidden';
            el.style.position = 'absolute';
            el.style.margin = '0';
            el.style.padding = '0';
        });
        
        // للموظف: إخفاء جميع العناصر عدا (الصيانة، المخزن، نقطة البيع، الشات)
        // إخفاء لوحة التحكم من الشريط الجانبي والموبايل
        document.querySelectorAll('a[href="#dashboard"]').forEach(link => {
            link.style.display = 'none';
            link.style.visibility = 'hidden';
            link.style.position = 'absolute';
            link.style.opacity = '0';
            link.style.width = '0';
            link.style.height = '0';
            link.style.overflow = 'hidden';
        });
    }
    
    // ✅ إخفاء لوحة التحكم لجميع المستخدمين غير admin (manager, technician, employee)
    if (user.role !== 'admin') {
        document.querySelectorAll('a[href="#dashboard"], .nav-link[onclick*="dashboard"], .mobile-nav-item[onclick*="dashboard"]').forEach(link => {
            link.style.display = 'none';
            link.style.visibility = 'hidden';
            link.style.position = 'absolute';
            link.style.opacity = '0';
            link.style.width = '0';
            link.style.height = '0';
            link.style.overflow = 'hidden';
        });
        
        // إخفاء العملاء والمصروفات للموظف فقط (وليس للمدير والفني)
        if (user.role === 'employee') {
            document.querySelectorAll('a[href="#customers"]').forEach(link => {
                link.style.display = 'none';
                link.style.visibility = 'hidden';
                link.style.position = 'absolute';
                link.style.opacity = '0';
                link.style.width = '0';
                link.style.height = '0';
                link.style.overflow = 'hidden';
            });
            
            document.querySelectorAll('a[href="#expenses"]').forEach(link => {
                link.style.display = 'none';
                link.style.visibility = 'hidden';
                link.style.position = 'absolute';
                link.style.opacity = '0';
                link.style.width = '0';
                link.style.height = '0';
                link.style.overflow = 'hidden';
            });
        }
        
        // إضافة CSS مباشرة لإخفاء العناصر
        const styleElement = document.getElementById('employee-permissions-style');
        if (styleElement) {
            let cssContent = `
                /* إخفاء لوحة التحكم لجميع المستخدمين غير admin */
                .sidebar-nav a[href="#dashboard"],
                .mobile-nav-container a[href="#dashboard"],
                .mobile-nav-item[onclick*="'dashboard'"],
                .nav-link[onclick*="'dashboard'"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    width: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                /* ✅ إخفاء الإعدادات لجميع المستخدمين غير admin */
                .sidebar-nav a[href="#settings"],
                .mobile-nav-container a[href="#settings"],
                .mobile-nav-item[onclick*="'settings'"],
                .nav-link[onclick*="'settings'"],
                .sidebar-nav [data-permission="admin"],
                .mobile-nav-container [data-permission="admin"],
                .mobile-nav-item[data-permission="admin"],
                .nav-link[data-permission="admin"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    width: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            `;
            
            // إضافة CSS للموظف فقط
            if (user.role === 'employee') {
                cssContent += `
                    /* إخفاء العناصر المحظورة للموظف */
                    .sidebar-nav a[href="#customers"],
                    .mobile-nav-container a[href="#customers"],
                    .mobile-nav-item[href="#customers"],
                    .sidebar-nav a[href="#expenses"],
                    .mobile-nav-container a[href="#expenses"],
                    .mobile-nav-item[href="#expenses"],
                    /* إخفاء العناصر التي تحتاج صلاحية manager */
                    .sidebar-nav [data-permission="manager"],
                    .mobile-nav-container [data-permission="manager"],
                    .mobile-nav-item[data-permission="manager"],
                    .nav-link[data-permission="manager"],
                    a[data-permission="manager"] {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        height: 0 !important;
                        width: 0 !important;
                        overflow: hidden !important;
                        position: absolute !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                `;
            }
            
            styleElement.textContent = cssContent;
        }
    } else {
        // إزالة CSS للموظف إذا لم يكن موظفاً
        const styleElement = document.getElementById('employee-permissions-style');
        if (styleElement) {
            styleElement.textContent = '';
        }
    }
}

        // إعداد MutationObserver لمراقبة التغييرات في DOM وإخفاء العناصر المحظورة
function setupPermissionObserver() {
    const user = getCurrentUser();
    if (!user || user.role !== 'employee') return;
    
    // مراقبة التغييرات في الشريط الجانبي
    const sidebar = document.getElementById('sidebar');
    const mobileNav = document.getElementById('mobileNavbar');
    
    if (sidebar || mobileNav) {
        const observer = new MutationObserver(() => {
            hideByPermission().catch(error => {
                console.error('خطأ في hideByPermission:', error);
            });
        });
        
        if (sidebar) {
            observer.observe(sidebar, {
                childList: true,
                subtree: true
            });
        }
        
        if (mobileNav) {
            observer.observe(mobileNav, {
                childList: true,
                subtree: true
            });
        }
    }
}

// عرض معلومات المستخدم في الواجهة
function displayUserInfo() {
    const user = getCurrentUser();
    if (!user) {
        console.warn('⚠️ displayUserInfo: لا يوجد مستخدم في localStorage');
        return;
    }
    
    console.log('🔄 displayUserInfo - تحديث الشريط الجانبي:', {
        name: user.name,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        branch_code: user.branch_code
    });
    
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userSpecializationElement = document.getElementById('userSpecialization');
    const userSpecializationTextElement = document.getElementById('userSpecializationText');
    const userBranchElement = document.getElementById('sidebarUserBranch');
    const userBranchTextElement = document.getElementById('userBranchText');
    
    if (userNameElement) {
        userNameElement.textContent = user.name || '';
        console.log('✅ تم تحديث الاسم في الشريط الجانبي:', user.name);
    } else {
        console.warn('⚠️ العنصر userName غير موجود في DOM');
    }
    
    if (userRoleElement) {
        const roleText = typeof getRoleText === 'function' ? getRoleText(user.role) : user.role;
        userRoleElement.textContent = roleText;
        console.log('✅ تم تحديث الدور في الشريط الجانبي:', roleText);
    } else {
        console.warn('⚠️ العنصر userRole غير موجود في DOM');
    }
    
    // عرض التخصص للفنيين فقط
    if (user.role === 'technician' && userSpecializationElement && userSpecializationTextElement) {
        const specializationText = getSpecializationText(user.specialization);
        if (specializationText) {
            userSpecializationTextElement.textContent = specializationText;
            userSpecializationElement.style.display = 'block';
        } else {
            userSpecializationElement.style.display = 'none';
        }
    } else if (userSpecializationElement) {
        userSpecializationElement.style.display = 'none';
    }
    
    // عرض الفرع للمستخدمين الذين ليسوا مالك (admin)
    if (user.role !== 'admin' && userBranchElement && userBranchTextElement) {
        let branchName = user.branch_name || user.branchName || '';
        
        console.log('🔍 عرض الفرع:', { branchName, branch_id: user.branch_id, role: user.role });
        
        // إذا لم يكن branch_name موجوداً، جلبها من API بشكل غير متزامن
        if (!branchName && user.branch_id) {
            console.log('🔄 جلب branch_name من API...');
            // جلب branch_name بشكل غير متزامن بدون منع عرض باقي المعلومات
            API.request('profile.php', 'GET').then(result => {
                if (result && result.success && result.data && result.data.branch_name) {
                    branchName = result.data.branch_name;
                    if (userBranchTextElement) {
                        userBranchTextElement.textContent = branchName;
                    }
                    if (userBranchElement) {
                        userBranchElement.style.display = 'block';
                    }
                    // تحديث البيانات المحفوظة
                    user.branch_name = branchName;
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    console.log('✅ تم تحديث branch_name من API:', branchName);
                }
            }).catch(error => {
                console.warn('لم يتم جلب اسم الفرع:', error);
            });
        }
        
        if (branchName) {
            userBranchTextElement.textContent = branchName;
            userBranchElement.style.display = 'block';
            console.log('✅ تم عرض الفرع في الشريط الجانبي:', branchName);
        } else {
            userBranchElement.style.display = 'none';
            console.log('⚠️ لا يوجد فرع للعرض');
        }
    } else if (userBranchElement) {
        userBranchElement.style.display = 'none';
        if (user.role === 'admin') {
            console.log('ℹ️ المستخدم من نوع admin - لا يتم عرض الفرع');
        }
    } else {
        console.warn('⚠️ العناصر sidebarUserBranch أو userBranchText غير موجودة في DOM');
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

// دالة للحصول على نص التخصص
function getSpecializationText(specialization) {
    if (!specialization) return '';
    
    const specializationMap = {
        'soft': 'سوفت',
        'hard': 'هارد',
        'fast': 'فاست'
    };
    
    return specializationMap[specialization] || '';
}

// متغير لمنع استدعاء showLoginRequiredMessage المتعدد
let isShowingLoginRequiredMessage = false;

// عرض رسالة تسجيل الدخول المطلوب
function showLoginRequiredMessage() {
    // 🔧 الحل 3: منع الاستدعاء المتعدد
    if (isShowingLoginRequiredMessage) {
        console.log('⏸️ رسالة تسجيل الدخول المطلوب معروضة بالفعل');
        return;
    }
    
    isShowingLoginRequiredMessage = true;
    
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
        isShowingLoginRequiredMessage = false; // إعادة تعيين المتغير
        
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

// ✅ تصدير الدوال إلى window للاستخدام العام
if (typeof window !== 'undefined') {
    window.login = login;
    window.checkLogin = checkLogin;
    window.logout = logout;
    // تصدير showLoginRequiredMessage إذا كان موجوداً
    if (typeof showLoginRequiredMessage !== 'undefined') {
        window.showLoginRequired = showLoginRequiredMessage;
        window.showLoginRequiredMessage = showLoginRequiredMessage;
    }
}


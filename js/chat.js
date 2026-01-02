/**
 * ملف JavaScript للشات - نظام لايف مع إشعارات
 * يدعم Long Polling، إشعارات المتصفح، Web Push، نظام الرد المحسّن، وحالة النشاط
 */

// متغيرات عامة
let currentUser = null;
let messages = [];
let lastMessageId = '';
let lastReadMessageId = ''; // آخر رسالة تم قراءتها
let longPollingActive = false;
let longPollingAbortController = null;
let notifications = [];
let pushSubscription = null;
let activityUpdateInterval = null;
let usersActivity = {};
let allUsers = []; // قائمة جميع المستخدمين للـ mention
let mentionMenuVisible = false;
let mentionStartPosition = -1;
let recordRTC = null; // ✅ RecordRTC instance for cross-platform audio recording
let audioStream = null; // ✅ Audio stream for cleanup
let isRecording = false;
let recordingTimer = null;
let recordingStartTime = null;

// منع التكبير بالضغط مرتين
(function() {
    let lastTouchEnd = 0;
    
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
            return false;
        }
        lastTouchEnd = now;
    }, { passive: false });
    
    window.addEventListener('orientationchange', function() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no');
        }
    });
})();

// تحميل الوضع الليلي فوراً - قبل أي شيء آخر
(function loadDarkModeEarly() {
    try {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled') {
            document.body.classList.add('dark-mode');
        }
    } catch (error) {
        console.error('خطأ في تحميل الوضع الليلي:', error);
    }
})();

// فحص تسجيل الدخول الفوري - قبل تحميل الصفحة
(async function checkAuthBeforeLoad() {
    try {
        // الانتظار حتى يتم تحميل API و auth
        let retries = 0;
        const maxRetries = 50; // زيادة عدد المحاولات
        while ((typeof API === 'undefined' || typeof checkLogin !== 'function') && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (typeof API === 'undefined' || typeof checkLogin !== 'function') {
            console.error('❌ فشل تحميل ملفات المصادقة بعد', maxRetries, 'محاولة');
            // إعطاء فرصة إضافية - الانتظار قليلاً ثم المحاولة مرة أخرى
            await new Promise(resolve => setTimeout(resolve, 500));
            if (typeof API === 'undefined' || typeof checkLogin !== 'function') {
                console.error('❌ فشل تحميل ملفات المصادقة - إعادة التوجيه...');
                window.location.href = 'index.html';
                return;
            }
        }
        
        // إعطاء فرصة إضافية للتأكد من أن API جاهز
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // فحص تسجيل الدخول فوراً
        const user = await checkLogin();
        if (!user) {
            console.log('❌ المستخدم غير مسجل دخول - إعادة التوجيه...');
            window.location.href = 'index.html';
            return;
        }
        
        // حفظ المستخدم للمتابعة
        currentUser = user;
        
        // التحقق من صلاحيات المستخدم إذا كان DOM جاهزاً
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndShowDeleteButton);
        } else {
            checkAndShowDeleteButton();
        }
        
    } catch (error) {
        console.error('❌ خطأ في فحص تسجيل الدخول:', error);
        // محاولة مرة أخرى قبل التوجيه
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (typeof checkLogin === 'function') {
                const user = await checkLogin();
                if (user) {
                    console.log('✅ نجحت المحاولة الثانية للتحقق من تسجيل الدخول');
                    currentUser = user;
                    // التحقق من صلاحيات المستخدم إذا كان DOM جاهزاً
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', checkAndShowDeleteButton);
                    } else {
                        checkAndShowDeleteButton();
                    }
                    return;
                }
            }
        } catch (retryError) {
            console.error('❌ فشلت المحاولة الثانية:', retryError);
        }
        window.location.href = 'index.html';
        return;
    }
})();

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // ✅ تحميل الوضع الليلي من localStorage
        if (typeof loadDarkMode === 'function') {
            loadDarkMode();
        }
        
        // ✅ إصلاح CSS و Bootstrap Icons عند تحميل الصفحة
        if (typeof ensureCSSAndIconsLoaded === 'function') {
            ensureCSSAndIconsLoaded();
        }
        
        // الانتظار قليلاً للتأكد من تحميل جميع الملفات
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // التحقق مرة أخرى من تسجيل الدخول
        if (typeof checkLogin !== 'function') {
            console.error('❌ خطأ في تحميل ملفات المصادقة - محاولة مرة أخرى...');
            // إعطاء فرصة إضافية
            await new Promise(resolve => setTimeout(resolve, 500));
            if (typeof checkLogin !== 'function') {
                console.error('❌ فشل تحميل ملفات المصادقة - إعادة التوجيه...');
                window.location.href = 'index.html';
                return;
            }
        }
        
        // إذا لم يكن هناك مستخدم محفوظ، فحص مرة أخرى
        if (!currentUser) {
            try {
                const user = await checkLogin();
                if (!user) {
                    console.log('❌ المستخدم غير مسجل دخول - إعادة التوجيه...');
                    window.location.href = 'index.html';
                    return;
                }
                currentUser = user;
                // التحقق من صلاحيات المستخدم بعد تحديثه
                checkAndShowDeleteButton();
            } catch (loginError) {
                console.error('❌ خطأ في فحص تسجيل الدخول:', loginError);
                // محاولة مرة أخرى
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    const user = await checkLogin();
                    if (user) {
                        currentUser = user;
                        // التحقق من صلاحيات المستخدم بعد تحديثه
                        checkAndShowDeleteButton();
                        checkAndShowDeleteChatButton();
                        checkAndShowDeleteChatButton();
                    } else {
                        window.location.href = 'index.html';
                        return;
                    }
                } catch (retryError) {
                    console.error('❌ فشلت المحاولة الثانية:', retryError);
                    window.location.href = 'index.html';
                    return;
                }
            }
        }
        
        // التحقق من صلاحيات المستخدم قبل تهيئة الشات
        checkAndShowDeleteButton();
        checkAndShowDeleteChatButton();
        checkAndShowDeleteChatButton();
        
        // الآن يمكن تهيئة الشات
        await initializeChat();
    } catch (error) {
        console.error('❌ خطأ في تهيئة الشات:', error);
        // محاولة مرة أخيرة قبل التوجيه
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (typeof checkLogin === 'function') {
                const user = await checkLogin();
                if (user) {
                    currentUser = user;
                    // التحقق من صلاحيات المستخدم بعد تحديثه
                    checkAndShowDeleteButton();
                    await initializeChat();
                    return;
                }
            }
        } catch (retryError) {
            console.error('❌ فشلت المحاولة الأخيرة:', retryError);
        }
        window.location.href = 'index.html';
    }
});

// تهيئة الشات
async function initializeChat() {
    try {
        showLoading(true);
        
        if (typeof API === 'undefined' || !API.request) {
            throw new Error('API غير متاح');
        }
        
        // حذف جميع إشعارات الرسائل عند فتح صفحة الشات
        clearChatNotifications();
        
        // تحديث معلومات المستخدم الحالي
        updateCurrentUserSection();
        
        // تحميل آخر رسالة مقروءة أولاً
        loadLastReadMessageId();
        
        // تحميل الرسائل عند الدخول
        await loadMessages();
        
        // إعداد Event Listeners
        setupEventListeners();
        
        // طلب صلاحيات الإشعارات
        await requestNotificationPermission();
        
        // تسجيل Web Push
        await registerPushSubscription();
        
        // بدء Long Polling
        startLongPolling();
        
        // بدء تحديث حالة النشاط
        startActivityUpdates();
        
        // تحميل قائمة المستخدمين
        await loadUsers();
        
        // إعداد listener لاستقبال الرسائل من الصفحة الرئيسية (عند فتح الشات في iframe)
        setupMessageListener();
        
        // التحقق من صلاحيات المستخدم وإظهار/إخفاء زر حذف الشات
        checkAndShowDeleteChatButton();
        
        // إعداد listener لتحديث الأزرار عند تغيير حجم النافذة
        setupMobileButtonsVisibility();
        
        // تحديث إظهار/إخفاء أزرار الموبايل
        updateMobileButtonsVisibility();
        
        showLoading(false);
    } catch (error) {
        console.error('خطأ في تهيئة الشات:', error);
        showMessage('حدث خطأ في تحميل الشات', 'error');
        showLoading(false);
    }
}

// إعداد listener لاستقبال الرسائل من الصفحة الرئيسية
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        // التحقق من أن الرسالة من نفس المصدر (اختياري - يمكن إزالة هذا للسماح من أي مصدر)
        // if (event.origin !== window.location.origin) return;
        
        if (event.data && event.data.type === 'openDeleteMessagesModal') {
            console.log('📨 تم استقبال طلب فتح مودال حذف الرسائل من الصفحة الرئيسية');
            showDeleteMessagesModal();
        }
    });
}

// تحميل الرسائل عند الدخول
async function loadMessages(forceRefresh = false) {
    try {
        // ✅ إذا كان forceRefresh، نستخدم skipCache و timestamp لإجبار إعادة التحميل
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`get_messages.php?_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            // استدعاء get_messages.php مع silent flag لمنع عرض loading overlay أثناء التحديثات
            result = await API.request('get_messages.php', 'GET', null, { silent: false });
        }
        
        if (result && result.success && result.data) {
            messages = result.data || [];
            
            // حفظ last_id
            if (messages.length > 0) {
                lastMessageId = messages[messages.length - 1].id;
                // تحديث آخر رسالة مقروءة عند فتح الشات
                lastReadMessageId = lastMessageId;
                saveLastReadMessageId();
            }
            
            renderMessages();
            
            // تصفير العداد عند فتح الشات
            updateUnreadBadge(0);
            
            // تحديث lastReadMessageId في chat-unread-badge.js
            if (typeof window.updateLastReadMessageId === 'function') {
                window.updateLastReadMessageId(lastReadMessageId);
            }
            
            // تحديث العداد في dashboard إذا كان متاحاً
            if (typeof window.updateChatUnreadBadge === 'function') {
                window.updateChatUnreadBadge(0);
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل الرسائل:', error);
        showMessage('حدث خطأ في تحميل الرسائل', 'error');
    }
}

// تحديث الرسائل فقط (بدون تحديث الصفحة كاملة)
async function refreshMessages() {
    try {
        const refreshBtn = document.getElementById('refreshMessagesBtn');
        if (!refreshBtn) return;
        
        // منع النقرات المتعددة
        if (refreshBtn.disabled) return;
        refreshBtn.disabled = true;
        refreshBtn.classList.add('refreshing');
        
        // استدعاء loadMessages مع forceRefresh لتحديث الرسائل
        await loadMessages(true);
        
        // تحديث حالة النشاط أيضاً
        await updateUsersActivity();
        
        // إعادة التحقق من صلاحيات المستخدم وإظهار/إخفاء زر الحذف
        checkAndShowDeleteButton();
        checkAndShowDeleteChatButton();
        updateMobileButtonsVisibility();
        
        // إظهار رسالة نجاح خفيفة
        const originalTitle = refreshBtn.title;
        refreshBtn.title = 'تم التحديث';
        
        // إعادة تعيين الزر بعد ثانية
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('refreshing');
            refreshBtn.title = originalTitle;
        }, 1000);
        
    } catch (error) {
        console.error('خطأ في تحديث الرسائل:', error);
        showMessage('حدث خطأ في تحديث الرسائل', 'error');
        
        // إعادة تعيين الزر حتى في حالة الخطأ
        const refreshBtn = document.getElementById('refreshMessagesBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('refreshing');
        }
    }
}

// معالجة زر الرجوع
function handleBackButton(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
        // ✅ إيقاف جميع polling systems قبل المغادرة
        cleanup();
        
        // ✅ التحقق من أننا على الموبايل (ليس داخل iframe)
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            // إذا كنا داخل iframe، نرسل رسالة للصفحة الرئيسية
            if (window.parent) {
                window.parent.postMessage({ type: 'closeChat' }, '*');
            }
            return;
        }
        
        // ✅ استخدام window.location.replace للرجوع
        const referrer = document.referrer;
        if (referrer && referrer.includes('dashboard.html')) {
            window.location.href = 'dashboard.html';
        } else if (referrer && referrer.includes('index.html')) {
            window.location.href = 'index.html';
        } else {
            // إذا لم يكن هناك referrer، نذهب إلى dashboard
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('خطأ في معالجة زر الرجوع:', error);
        // في حالة الخطأ، نذهب إلى dashboard
        window.location.href = 'dashboard.html';
    }
}

// معالجة زر حذف الشات (للمالك فقط)
async function handleDeleteChat(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
        // التحقق من أن المستخدم هو مالك
        let isOwner = false;
        
        if (currentUser) {
            if (currentUser.role === 'admin') {
                isOwner = true;
            } else if (currentUser.is_owner === true || currentUser.is_owner === 'true') {
                isOwner = true;
            }
        }
        
        if (!isOwner) {
            try {
                const savedUser = localStorage.getItem('currentUser');
                if (savedUser) {
                    const user = JSON.parse(savedUser);
                    if (user && (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true')) {
                        isOwner = true;
                    }
                }
            } catch (e) {
                console.error('خطأ في قراءة بيانات المستخدم:', e);
            }
        }
        
        if (!isOwner) {
            showMessage('هذه الميزة متاحة للمالك فقط', 'error');
            return;
        }
        
        // تأكيد الحذف
        if (!confirm('⚠️ تحذير: هل أنت متأكد من حذف جميع رسائل الشات؟\n\nهذا الإجراء لا يمكن التراجع عنه!')) {
            return;
        }
        
        // تأكيد إضافي
        if (!confirm('هل أنت متأكد تماماً؟ سيتم حذف جميع الرسائل بشكل نهائي!')) {
            return;
        }
        
        showLoading(true);
        
        // حذف جميع الرسائل (من تاريخ قديم جداً إلى الآن)
        const now = new Date();
        const oldDate = new Date(0); // تاريخ قديم جداً
        
        const fromDate = oldDate.toISOString().slice(0, 16);
        const toDate = now.toISOString().slice(0, 16);
        
        const result = await API.request('delete_messages.php', 'POST', {
            from_date: fromDate,
            to_date: toDate
        });
        
        showLoading(false);
        
        if (result && result.success) {
            showMessage('تم حذف جميع رسائل الشات بنجاح', 'success');
            
            // إعادة تحميل الرسائل
            await loadMessages(true);
        } else {
            showMessage(result.message || 'حدث خطأ في حذف الرسائل', 'error');
        }
    } catch (error) {
        showLoading(false);
        console.error('خطأ في حذف الشات:', error);
        showMessage('حدث خطأ في حذف الشات', 'error');
    }
}

// إعداد listener لتحديث الأزرار عند تغيير حجم النافذة
function setupMobileButtonsVisibility() {
    // التحقق من حجم الشاشة عند تحميل الصفحة
    updateMobileButtonsVisibility();
    
    // إضافة listener لتحديث الأزرار عند تغيير حجم النافذة
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateMobileButtonsVisibility();
        }, 100);
    });
}

// تحديث إظهار/إخفاء أزرار الموبايل
function updateMobileButtonsVisibility() {
    const mobileHeaderButtons = document.getElementById('mobileHeaderButtons');
    if (!mobileHeaderButtons) {
        console.warn('⚠️ mobileHeaderButtons غير موجود');
        return;
    }
    
    // التحقق من أننا على الموبايل (ليس داخل iframe)
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        mobileHeaderButtons.style.display = 'none';
        console.log('📱 الشات داخل iframe - إخفاء أزرار الموبايل');
        return;
    }
    
    // التحقق من حجم الشاشة
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        mobileHeaderButtons.style.display = 'flex';
        console.log('📱 عرض أزرار الموبايل - العرض:', window.innerWidth);
        
        // التأكد من أن الأزرار قابلة للنقر
        const buttons = mobileHeaderButtons.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.zIndex = '1001';
        });
    } else {
        mobileHeaderButtons.style.display = 'none';
        console.log('💻 إخفاء أزرار الموبايل - العرض:', window.innerWidth);
    }
}

// التحقق من صلاحيات المستخدم وإظهار/إخفاء زر حذف الشات
function checkAndShowDeleteChatButton() {
    const deleteChatBtn = document.getElementById('deleteChatBtn');
    if (!deleteChatBtn) return;
    
    // التحقق من أننا على الموبايل (ليس داخل iframe)
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        deleteChatBtn.style.display = 'none';
        return;
    }
    
    // التحقق من أن المستخدم هو مالك
    let isOwner = false;
    
    if (currentUser) {
        if (currentUser.role === 'admin') {
            isOwner = true;
        } else if (currentUser.is_owner === true || currentUser.is_owner === 'true') {
            isOwner = true;
        }
    }
    
    if (!isOwner) {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user && (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true')) {
                    isOwner = true;
                }
            }
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم:', e);
        }
    }
    
    // إظهار أو إخفاء الزر بناءً على النتيجة
    if (isOwner) {
        deleteChatBtn.style.display = 'flex';
        console.log('✅ زر حذف الشات معروض للمالك');
    } else {
        deleteChatBtn.style.display = 'none';
        console.log('🔒 زر حذف الشات مخفي - المستخدم ليس مالكاً');
    }
}

// عرض الرسائل
function renderMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // حفظ علامة التحميل إذا كانت موجودة
    const loadingIndicator = document.getElementById('chatLoadingIndicator');
    
    // مسح الرسائل القديمة فقط (وليس علامة التحميل)
    const existingMessages = messagesContainer.querySelectorAll('.message, .empty-messages');
    existingMessages.forEach(msg => msg.remove());
    
    // إخفاء علامة التحميل بعد تحميل الرسائل
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-messages">لا توجد رسائل بعد</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        fragment.appendChild(messageElement);
    });
    
    messagesContainer.appendChild(fragment);
    
    // تحديث حالة النشاط بعد عرض الرسائل
    updateMessagesActivity();
    
    scrollToBottom();
}

// إنشاء عنصر رسالة
function createMessageElement(message) {
    const isUserMessage = message.user_id === currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUserMessage ? 'user-message' : ''}`;
    messageDiv.dataset.messageId = message.id;
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (message.avatar) {
        const avatarImg = document.createElement('img');
        avatarImg.src = message.avatar;
        avatarImg.alt = message.username || 'مستخدم';
        // ✅ إضافة lazy loading للصور
        avatarImg.loading = 'lazy';
        avatarImg.decoding = 'async';
        avatarImg.onerror = () => {
            // في حالة فشل تحميل الصورة، عرض الأحرف الأولى
            avatar.innerHTML = '';
            avatar.textContent = getInitials(message.username || 'U');
            avatar.style.background = getAvatarColor(message.user_id);
        };
        avatar.appendChild(avatarImg);
    } else {
        avatar.textContent = getInitials(message.username || 'U');
        avatar.style.background = getAvatarColor(message.user_id);
    }
    
    // مؤشر حالة النشاط
    const onlineIndicator = document.createElement('div');
    onlineIndicator.className = 'online-indicator';
    
    // التحقق من حالة النشاط
    if (usersActivity[message.user_id]) {
        const activity = usersActivity[message.user_id];
        onlineIndicator.className = `online-indicator ${activity.is_online ? 'online' : 'offline'}`;
        onlineIndicator.title = activity.is_online ? 'نشط الآن' : (activity.time_ago_text || 'غير متصل');
    } else {
        // افتراضياً غير متصل إذا لم تكن هناك معلومات
        onlineIndicator.className = 'online-indicator offline';
        onlineIndicator.title = 'غير متصل';
    }
    
    avatar.appendChild(onlineIndicator);
    
    // Content
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Header (للمستخدمين الآخرين فقط) - بدون التوقيت العلوي
    if (!isUserMessage) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = message.username || 'مستخدم';
        
        // ✅ تم حذف التوقيت العلوي - التوقيت يظهر فقط داخل الـ bubble
        header.appendChild(sender);
        content.appendChild(header);
    }
    
    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // عرض الملف أو الصورة إذا كان موجوداً
    if (message.file_path || message.file_type) {
        const fileType = message.file_type || 'file';
        let filePath = message.file_path || '';
        
        // إذا كان المسار نسبي، إضافة المسار الأساسي
        if (filePath && !filePath.startsWith('http') && !filePath.startsWith('data:')) {
            // إزالة أي مسافات في البداية
            filePath = filePath.trim();
            // إذا لم يبدأ بـ /، إضافته
            if (!filePath.startsWith('/')) {
                filePath = '/' + filePath;
            }
            // إزالة أي مسافات إضافية
            filePath = filePath.replace(/\/+/g, '/');
        }
        
        if (fileType === 'image') {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-message';
            
            const img = document.createElement('img');
            // التأكد من أن المسار صحيح
            if (filePath) {
                img.src = filePath;
            } else {
                console.error('مسار الصورة غير موجود:', message);
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3Eصورة غير متاحة%3C/text%3E%3C/svg%3E';
            }
            img.alt = 'صورة';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.onerror = (e) => {
                console.error('فشل تحميل الصورة:', filePath, message);
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3Eفشل تحميل الصورة%3C/text%3E%3C/svg%3E';
            };
            img.onload = () => {
                console.log('تم تحميل الصورة بنجاح:', filePath);
            };
            
            imageContainer.appendChild(img);
            
            if (message.message && message.message.trim() && message.message !== '📷 صورة') {
                const caption = document.createElement('div');
                caption.className = 'image-caption';
                caption.textContent = message.message;
                imageContainer.appendChild(caption);
            }
            
            bubble.appendChild(imageContainer);
        } else if (fileType === 'audio') {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-message-container';
            
            // ✅ مؤشر "جاري الإرسال" للرسائل الصوتية (شبه مخفي)
            if (message.isSending) {
                const sendingIndicator = document.createElement('div');
                sendingIndicator.className = 'audio-sending-indicator';
                sendingIndicator.innerHTML = '<span class="audio-sending-text">جاري الإرسال...</span>';
                audioContainer.appendChild(sendingIndicator);
            }
            
            // إنشاء مشغل الصوت
            const audioPlayer = document.createElement('audio');
            audioPlayer.controls = false;
            audioPlayer.preload = 'metadata';
            // ✅ إزالة crossOrigin - يسبب مشاكل على بعض الهواتف إذا لم يكن الخادم مضبوطاً بشكل صحيح
            // audioPlayer.crossOrigin = 'anonymous';
            
            // تحديد المسار
            if (filePath) {
                // إذا كان المسار Base64 data URL
                if (filePath.startsWith('data:audio')) {
                    audioPlayer.src = filePath;
                } else {
                    // إذا كان مسار ملف
                    const audioPath = filePath.startsWith('/') ? filePath : '/' + filePath;
                    // ✅ إضافة timestamp لمنع cache issues على الهاتف
                    audioPlayer.src = audioPath + (audioPath.includes('?') ? '&' : '?') + 't=' + Date.now();
                }
            }
            
            // حاوية المشغل
            const audioWrapper = document.createElement('div');
            audioWrapper.className = 'audio-player-wrapper';
            
            // زر التشغيل/الإيقاف
            const playPauseBtn = document.createElement('button');
            playPauseBtn.className = 'audio-play-pause-btn';
            playPauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            playPauseBtn.setAttribute('aria-label', 'تشغيل');
            
            // موجة الصوت
            const waveform = document.createElement('div');
            waveform.className = 'audio-waveform';
            for (let i = 0; i < 40; i++) {
                const bar = document.createElement('div');
                bar.className = 'waveform-bar';
                bar.style.height = Math.random() * 60 + 20 + '%';
                waveform.appendChild(bar);
            }
            
            // المدة
            const durationSpan = document.createElement('span');
            durationSpan.className = 'audio-duration';
            durationSpan.textContent = '0:00';
            
            // عند تحميل البيانات
            audioPlayer.addEventListener('loadedmetadata', () => {
                const duration = Math.floor(audioPlayer.duration);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            });
            
            // تحديث حركة الموجة
            const updateWaveform = () => {
                const bars = waveform.querySelectorAll('.waveform-bar');
                bars.forEach((bar, index) => {
                    const delay = index * 0.1;
                    if (audioWrapper.classList.contains('playing')) {
                        bar.style.animation = `waveform-animate 1.2s ease-in-out ${delay}s infinite`;
                    } else {
                        bar.style.animation = 'none';
                    }
                });
            };
            
            // عند انتهاء الصوت
            audioPlayer.addEventListener('ended', () => {
                playPauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                playPauseBtn.setAttribute('aria-label', 'تشغيل');
                audioWrapper.classList.remove('playing');
                updateWaveform();
            });
            
            // معالجة أخطاء تحميل الصوت
            audioPlayer.addEventListener('error', (e) => {
                console.error('خطأ في تحميل الملف الصوتي:', e, audioPlayer.error);
                const error = audioPlayer.error;
                let errorMessage = 'فشل في تشغيل الملف الصوتي';
                let shouldRetry = false;
                
                if (error) {
                    switch (error.code) {
                        case error.MEDIA_ERR_ABORTED:
                            errorMessage = 'تم إلغاء تحميل الملف الصوتي';
                            shouldRetry = true;
                            break;
                        case error.MEDIA_ERR_NETWORK:
                            errorMessage = 'خطأ في الشبكة - يرجى التحقق من الاتصال';
                            shouldRetry = true;
                            break;
                        case error.MEDIA_ERR_DECODE:
                            errorMessage = 'خطأ في فك تشفير الملف الصوتي - قد يكون التنسيق غير مدعوم على هذا الجهاز';
                            break;
                        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            // ✅ كشف iOS وإظهار رسالة مناسبة
                            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                            if (isIOS) {
                                errorMessage = 'تنسيق الملف الصوتي (.webm) غير مدعوم على أجهزة iOS - يرجى استخدام جهاز Android أو الكمبيوتر';
                            } else {
                                errorMessage = 'تنسيق الملف الصوتي غير مدعوم على هذا الجهاز - يرجى المحاولة على جهاز آخر';
                            }
                            console.warn('تنسيق webm غير مدعوم على هذا الجهاز:', navigator.userAgent);
                            break;
                    }
                }
                
                // ✅ محاولة إعادة التحميل إذا كان الخطأ قابل للمعالجة
                if (shouldRetry && filePath && !filePath.startsWith('data:')) {
                    console.log('محاولة إعادة تحميل الملف الصوتي...');
                    const originalSrc = audioPlayer.src;
                    audioPlayer.src = '';
                    setTimeout(() => {
                        // إزالة timestamp وإعادة إضافته
                        const cleanPath = originalSrc.split('?')[0];
                        audioPlayer.src = cleanPath + '?t=' + Date.now();
                        audioPlayer.load();
                    }, 500);
                    return; // لا نعرض خطأ بعد - نعطي فرصة لإعادة التحميل
                }
                
                // إظهار رسالة خطأ للمستخدم
                const errorDiv = document.createElement('div');
                errorDiv.className = 'audio-error';
                errorDiv.textContent = errorMessage;
                audioContainer.appendChild(errorDiv);
                
                // إخفاء زر التشغيل عند وجود خطأ دائم
                playPauseBtn.style.display = 'none';
            });
            
            // التحكم في التشغيل/الإيقاف
            playPauseBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                if (audioPlayer.paused) {
                    try {
                        // التحقق من وجود خطأ قبل المحاولة
                        if (audioPlayer.error) {
                            showMessage('فشل في تشغيل الملف الصوتي - يرجى المحاولة مرة أخرى', 'error');
                            return;
                        }
                        
                        // محاولة تشغيل الصوت
                        await audioPlayer.play();
                        playPauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
                        playPauseBtn.setAttribute('aria-label', 'إيقاف');
                        audioWrapper.classList.add('playing');
                        updateWaveform();
                    } catch (err) {
                        console.error('خطأ في تشغيل الصوت:', err);
                        
                        // محاولة إعادة تحميل الملف إذا فشل التشغيل
                        if (audioPlayer.src && !audioPlayer.src.startsWith('data:')) {
                            const originalSrc = audioPlayer.src;
                            audioPlayer.src = '';
                            setTimeout(() => {
                                audioPlayer.src = originalSrc + '?t=' + Date.now();
                                audioPlayer.load();
                            }, 100);
                        }
                        
                        showMessage('فشل في تشغيل الملف الصوتي - يرجى المحاولة مرة أخرى', 'error');
                    }
                } else {
                    audioPlayer.pause();
                    playPauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                    playPauseBtn.setAttribute('aria-label', 'تشغيل');
                    audioWrapper.classList.remove('playing');
                    updateWaveform();
                }
            });
            
            audioWrapper.appendChild(playPauseBtn);
            audioWrapper.appendChild(waveform);
            audioWrapper.appendChild(durationSpan);
            audioWrapper.appendChild(audioPlayer);
            
            audioContainer.appendChild(audioWrapper);
            bubble.appendChild(audioContainer);
        } else {
            const fileContainer = document.createElement('div');
            fileContainer.className = 'file-message';
            
            const fileLink = document.createElement('a');
            fileLink.className = 'file-link';
            fileLink.href = filePath;
            fileLink.target = '_blank';
            if (message.file_name) {
                fileLink.download = message.file_name;
            }
            
            const fileIcon = document.createElement('span');
            fileIcon.textContent = '📎';
            
            const fileName = document.createElement('span');
            fileName.textContent = message.file_name || 'ملف';
            
            fileLink.appendChild(fileIcon);
            fileLink.appendChild(fileName);
            fileContainer.appendChild(fileLink);
            
            if (message.message && message.message.trim() && !message.message.startsWith('📎 ملف:')) {
                const fileText = document.createElement('div');
                fileText.className = 'file-text';
                fileText.textContent = message.message;
                fileContainer.appendChild(fileText);
            }
            
            bubble.appendChild(fileContainer);
        }
    } else {
        // عرض النص العادي مع دعم الـ mentions
        const textContainer = document.createElement('p');
        textContainer.className = 'message-text';
        
        if (message.mentions && message.mentions.length > 0) {
            // عرض النص مع تمييز الـ mentions
            let displayText = message.message;
            message.mentions.forEach(mention => {
                const mentionPattern = new RegExp(`@${mention.name || mention.username || mention.user_id}`, 'g');
                displayText = displayText.replace(mentionPattern, (match) => {
                    return `<span class="mention-highlight">${match}</span>`;
                });
            });
            textContainer.innerHTML = displayText;
        } else {
            textContainer.textContent = message.message;
        }
        
        bubble.appendChild(textContainer);
    }
    
    // Time - إضافة التوقيت داخل الـ bubble لجميع الرسائل
    const timeContainer = document.createElement('div');
    timeContainer.className = 'message-time-container';
    
    // مؤشر حالة الإرسال
    if (message.isSending) {
        const sendingIndicator = document.createElement('span');
        sendingIndicator.className = 'sending-indicator-icon';
        sendingIndicator.innerHTML = '⏳';
        sendingIndicator.title = 'قيد الإرسال...';
        timeContainer.appendChild(sendingIndicator);
    }
    
    const time = document.createElement('span');
    time.className = 'message-time';
    if (message.isSending) {
        time.textContent = 'قيد الإرسال...';
        time.style.opacity = '0.7';
    } else {
        time.textContent = formatTime(message.created_at);
    }
    timeContainer.appendChild(time);
    
    // إضافة التوقيت داخل الـ bubble لجميع الرسائل
    bubble.appendChild(timeContainer);
    
    content.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    return messageDiv;
}

// إعداد Event Listeners
function setupEventListeners() {
    console.log('🔧 بدء إعداد Event Listeners...');
    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // كشف @ للـ mention
        chatInput.addEventListener('input', handleMentionInput);
        chatInput.addEventListener('keydown', handleMentionKeydown);
    }
    
    // زر الإيموجي
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    // زر المرفقات
    const attachBtn = document.getElementById('attachBtn');
    if (attachBtn) {
        attachBtn.addEventListener('click', toggleAttachMenu);
    }
    
    // زر التسجيل الصوتي
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.addEventListener('mousedown', startAudioRecording);
        audioBtn.addEventListener('mouseup', stopAudioRecording);
        audioBtn.addEventListener('mouseleave', stopAudioRecording);
        audioBtn.addEventListener('touchstart', startAudioRecording, { passive: false });
        audioBtn.addEventListener('touchend', stopAudioRecording);
        audioBtn.addEventListener('touchcancel', stopAudioRecording);
    }
    
    // أيقونة الإشعارات
    const notificationIcon = document.getElementById('notificationIcon');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', toggleNotificationsList);
    }
    
    // زر حذف الرسائل (للمالك فقط)
    const deleteMessagesBtn = document.getElementById('deleteMessagesBtn');
    if (deleteMessagesBtn) {
        deleteMessagesBtn.addEventListener('click', showDeleteMessagesModal);
    }
    
    // زر تحديث الرسائل (في header الموبايل)
    const refreshMessagesBtn = document.getElementById('refreshMessagesBtn');
    if (refreshMessagesBtn) {
        refreshMessagesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 زر التحديث تم النقر عليه');
            refreshMessages();
        });
        // إضافة touch events للموبايل
        refreshMessagesBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 زر التحديث تم اللمس (touch)');
            refreshMessages();
        }, { passive: false });
    } else {
        console.warn('⚠️ زر التحديث غير موجود');
    }
    
    // زر الرجوع (في header الموبايل)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⬅️ زر الرجوع تم النقر عليه');
            handleBackButton(e);
        });
        // إضافة touch events للموبايل
        backBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⬅️ زر الرجوع تم اللمس (touch)');
            handleBackButton(e);
        }, { passive: false });
    } else {
        console.warn('⚠️ زر الرجوع غير موجود');
    }
    
    // زر حذف الشات (في header الموبايل - للمالك فقط)
    const deleteChatBtn = document.getElementById('deleteChatBtn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ زر حذف الشات تم النقر عليه');
            handleDeleteChat(e);
        });
        // إضافة touch events للموبايل
        deleteChatBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ زر حذف الشات تم اللمس (touch)');
            handleDeleteChat(e);
        }, { passive: false });
    } else {
        console.warn('⚠️ زر حذف الشات غير موجود');
    }
    
    // ✅ إضافة event delegation للأزرار كبديل (للتأكد من عملها حتى لو لم تكن موجودة عند التحميل)
    const mobileHeaderButtons = document.getElementById('mobileHeaderButtons');
    if (mobileHeaderButtons) {
        // استخدام event delegation للأزرار
        mobileHeaderButtons.addEventListener('click', function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            
            if (target.id === 'refreshMessagesBtn') {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔄 زر التحديث تم النقر عليه (event delegation)');
                refreshMessages();
            } else if (target.id === 'backBtn') {
                e.preventDefault();
                e.stopPropagation();
                console.log('⬅️ زر الرجوع تم النقر عليه (event delegation)');
                handleBackButton(e);
            } else if (target.id === 'deleteChatBtn') {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ زر حذف الشات تم النقر عليه (event delegation)');
                handleDeleteChat(e);
            }
        });
        
        // إضافة touch events للموبايل (event delegation)
        mobileHeaderButtons.addEventListener('touchend', function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (target.id === 'refreshMessagesBtn') {
                console.log('🔄 زر التحديث تم اللمس (event delegation)');
                refreshMessages();
            } else if (target.id === 'backBtn') {
                console.log('⬅️ زر الرجوع تم اللمس (event delegation)');
                handleBackButton(e);
            } else if (target.id === 'deleteChatBtn') {
                console.log('🗑️ زر حذف الشات تم اللمس (event delegation)');
                handleDeleteChat(e);
            }
        }, { passive: false });
    }
    
    console.log('✅ تم إعداد Event Listeners للأزرار');
    
    // زر الرجوع (القديم - للتوافق)
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // ✅ إيقاف جميع polling systems قبل المغادرة
                cleanup();
                
                // ✅ استخدام window.location.replace بدلاً من history.back() لتجنب مشاكل التنقل
                const referrer = document.referrer;
                const currentUrl = window.location.href;
                
                // التحقق من أن referrer موجود وليس نفس الصفحة
                if (referrer && referrer !== currentUrl) {
                    const referrerUrl = new URL(referrer);
                    const currentUrlObj = new URL(currentUrl);
                    
                    // إذا كان referrer من نفس الموقع، استخدم replace
                    if (referrerUrl.origin === currentUrlObj.origin) {
                        // التحقق من أن الصفحة السابقة ليست chat.html
                        if (!referrer.includes('chat.html')) {
                            window.location.replace(referrer);
                            return;
                        }
                    }
                }
                
                // ✅ وضع علامة للرجوع من الشات
                sessionStorage.setItem('returning_from_chat', 'true');
                
                // Fallback: الانتقال إلى لوحة التحكم مباشرة
                window.location.replace('dashboard.html');
            } catch (error) {
                console.error('خطأ في الرجوع:', error);
                // Fallback: الانتقال إلى لوحة التحكم
                cleanup();
                window.location.replace('dashboard.html');
            }
        });
    }
    
    // كشف حالة التاب (visible/hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // عند إغلاق الصفحة
    window.addEventListener('beforeunload', cleanup);
}

// إرسال رسالة
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    // إخفاء قائمة الـ mention
    hideMentionMenu();
    
    // التحقق من طول الرسالة
    if (messageText.length > 1000) {
        showMessage('الرسالة طويلة جداً. الحد الأقصى 1000 حرف', 'error');
        return;
    }
    
    // استخراج الـ mentions من الرسالة
    const mentions = extractMentions(messageText);
    
    try {
        // إظهار الرسالة محلياً أولاً (optimistic update)
        const tempMessage = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            username: currentUser.name || currentUser.username,
            message: messageText,
            created_at: new Date().toISOString(),
            isSending: true,
            mentions: mentions
        };
        
        messages.push(tempMessage);
        renderMessages();
        chatInput.value = '';
        
        // إرسال الرسالة للخادم
        const result = await API.request('send_message.php', 'POST', {
            message: messageText,
            mentions: mentions
        });
        
        if (result && result.success) {
            // استبدال الرسالة المؤقتة بالرسالة الحقيقية
            const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                messages[tempIndex] = result.data;
                // تحديث lastMessageId إلى آخر رسالة
                if (result.data.id > lastMessageId || lastMessageId === '') {
                    lastMessageId = result.data.id;
                }
                renderMessages();
                
                // ✅ إجبار إعادة تحميل الرسائل من الخادم لإظهار الرسالة الجديدة فوراً
                // انتظار قليل لضمان حفظ الرسالة في قاعدة البيانات
                setTimeout(async () => {
                    await loadMessages(true); // forceRefresh = true
                }, 300);
                
                // إرسال حدث لإشعار النظام بوجود رسالة جديدة
                // هذا سيؤدي إلى فحص فوري للرسائل الجديدة للمستخدمين الآخرين
                window.dispatchEvent(new CustomEvent('messageSent'));
                
                // فحص فوري للرسائل الجديدة (للمستخدمين الآخرين)
                if (longPollingActive) {
                    setTimeout(() => checkForNewMessages(), 500);
                }
            }
        } else {
            // إزالة الرسالة المؤقتة في حالة الفشل
            messages = messages.filter(m => m.id !== tempMessage.id);
            renderMessages();
            showMessage('فشل إرسال الرسالة', 'error');
        }
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        showMessage('حدث خطأ في إرسال الرسالة', 'error');
        
        // إزالة الرسالة المؤقتة
        const tempIndex = messages.findIndex(m => m.id && m.id.startsWith('temp-'));
        if (tempIndex !== -1) {
            messages.splice(tempIndex, 1);
            renderMessages();
        }
    }
}


// نظام محسّن: فتح اتصال SSE فقط عند وجود رسالة جديدة
let eventSource = null;
let checkInterval = null;

// Event listeners references للتنظيف
let messageSentListener = null;
let visibilityChangeListener = null;
let focusListener = null;

function startLongPolling() {
    if (longPollingActive) return;
    
    longPollingActive = true;
    startPeriodicCheck();
}

/**
 * فحص للإشعارات المعلقة فقط عند الحاجة
 * لا فحص دوري - فقط عند وجود إشعار معلق أو حدث إرسال رسالة
 * النظام مقترن تماماً بإرسال الرسائل - لا ضغط على الخادم
 */
function startPeriodicCheck() {
    if (!longPollingActive) return;
    
    // ✅ إيقاف أي event listeners سابقة إذا كانت موجودة
    stopPeriodicCheck();
    
    // فحص فوري أولاً عند فتح الشات
    checkForNewMessages();
    
    // لا فحص دوري - النظام يعتمد على الإشعارات المعلقة فقط
    // الفحص يتم فقط عند:
    // 1. إرسال رسالة جديدة (للمستخدمين الآخرين)
    // 2. عودة المستخدم للصفحة
    // 3. فتح الشات
    
    // الاستماع لحدث إرسال رسالة جديدة من نفس الصفحة
    // عند إرسال رسالة جديدة، نفحص فوراً للمستخدمين الآخرين
    messageSentListener = () => {
        if (longPollingActive) {
            // فحص فوري بعد إرسال رسالة (للمستخدمين الآخرين)
            // السيرفر أضاف إشعارات معلقة لكل مستخدم نشط
            setTimeout(() => checkForNewMessages(), 1000);
        }
    };
    window.addEventListener('messageSent', messageSentListener);
    
    // فحص عند عودة المستخدم للصفحة
    visibilityChangeListener = () => {
        if (!document.hidden && longPollingActive) {
            // فحص فوري عند عودة المستخدم للصفحة
            checkForNewMessages();
        }
    };
    document.addEventListener('visibilitychange', visibilityChangeListener);
    
    // فحص عند التركيز على النافذة
    focusListener = () => {
        if (longPollingActive) {
            checkForNewMessages();
        }
    };
    window.addEventListener('focus', focusListener);
}

// ✅ إيقاف event listeners
function stopPeriodicCheck() {
    if (messageSentListener) {
        window.removeEventListener('messageSent', messageSentListener);
        messageSentListener = null;
    }
    if (visibilityChangeListener) {
        document.removeEventListener('visibilitychange', visibilityChangeListener);
        visibilityChangeListener = null;
    }
    if (focusListener) {
        window.removeEventListener('focus', focusListener);
        focusListener = null;
    }
}

/**
 * التحقق من وجود رسائل جديدة عبر الإشعارات المعلقة
 */
async function checkForNewMessages() {
    if (!longPollingActive) return;
    
    try {
        // فتح اتصال SSE مؤقت فقط عند وجود إشعار معلق
        // نستخدم listen.php للتحقق من الإشعارات المعلقة
        const url = `api/listen.php?last_id=${lastMessageId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Silent-Request': 'true'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result && result.success && result.data && result.data.length > 0) {
            // معالجة الرسائل الجديدة
            processNewMessages(result.data);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            return; // تم إلغاء الطلب
        }
        
        console.error('خطأ في فحص الرسائل الجديدة:', error);
        // لا نعيد المحاولة فوراً - سنحاول في الفحص الدوري التالي
    }
}

/**
 * معالجة الرسائل الجديدة
 */
function processNewMessages(newMessagesArray) {
    let hasNewMessages = false;
    let unreadCount = 0;
    
    newMessagesArray.forEach(newMessage => {
        // تجنب التكرار (بما في ذلك الرسائل المؤقتة)
        const existingMessage = messages.find(m => m.id === newMessage.id || (m.id && m.id.startsWith('temp-') && newMessage.user_id === m.user_id && newMessage.message === m.message));
        
        if (!existingMessage) {
            messages.push(newMessage);
            hasNewMessages = true;
            // تحديث lastMessageId إلى آخر رسالة
            if (newMessage.id > lastMessageId || lastMessageId === '') {
                lastMessageId = newMessage.id;
            }
            // حساب الرسائل غير المقروءة (رسائل من مستخدمين آخرين بعد آخر رسالة مقروءة)
            if (newMessage.user_id !== currentUser.id && 
                (lastReadMessageId === '' || newMessage.id > lastReadMessageId)) {
                unreadCount++;
            }
        } else if (existingMessage.id && existingMessage.id.startsWith('temp-')) {
            // استبدال الرسالة المؤقتة بالرسالة الحقيقية
            const tempIndex = messages.indexOf(existingMessage);
            if (tempIndex !== -1) {
                messages[tempIndex] = newMessage;
                hasNewMessages = true;
                // تحديث lastMessageId
                if (newMessage.id > lastMessageId || lastMessageId === '') {
                    lastMessageId = newMessage.id;
                }
            }
        }
    });
    
    if (hasNewMessages) {
        // إعادة ترتيب الرسائل حسب id
        messages.sort((a, b) => {
            // الرسائل المؤقتة تأتي أولاً
            if (a.id && a.id.startsWith('temp-') && !(b.id && b.id.startsWith('temp-'))) return -1;
            if (b.id && b.id.startsWith('temp-') && !(a.id && a.id.startsWith('temp-'))) return 1;
            // ترتيب حسب id
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
        });
        
        renderMessages();
        
        // تحديث العداد إذا كان المستخدم ليس في صفحة الشات
        if (!document.location.pathname.includes('chat.html')) {
            const unreadCount = calculateUnreadCount();
            updateUnreadBadge(unreadCount);
        }
        
        // عرض إشعار إذا كان التاب مخفي
        if (document.hidden) {
            newMessagesArray.forEach(message => {
                if (message.user_id !== currentUser.id) {
                    showBrowserNotification(message);
                }
            });
        }
    }
}

function stopLongPolling() {
    longPollingActive = false;
    
    // ✅ إيقاف event listeners
    stopPeriodicCheck();
    
    // إيقاف الفحص الدوري
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    
    // إغلاق اتصال SSE إذا كان مفتوحاً
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    if (longPollingAbortController) {
        longPollingAbortController.abort();
        longPollingAbortController = null;
    }
}

// إشعارات المتصفح
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        return;
    }
    
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function showBrowserNotification(message) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    if (document.hidden) {
        const notification = new Notification(message.username || 'مستخدم', {
            body: message.message,
            icon: '/vertopal.com_photo_5922357566287580087_y.png',
            badge: '/ico/icon-72x72.png',
            dir: 'rtl',
            lang: 'ar',
            tag: message.id,
            data: { messageId: message.id }
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        // إضافة للإشعارات المحلية
        addNotification({
            id: message.id,
            username: message.username,
            message: message.message,
            timestamp: new Date().toISOString(),
            read: false
        });
    }
}

// Web Push
async function registerPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        
        // الحصول على subscription الموجود
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // التحقق من وجود VAPID key - إذا لم يكن موجوداً، تخطي Web Push
            // TODO: إضافة VAPID public key في متغير منفصل أو من السيرفر
            const vapidPublicKey = null; // سيتم تعيينه لاحقاً
            
            if (!vapidPublicKey || vapidPublicKey === 'YOUR_VAPID_PUBLIC_KEY') {
                // تخطي Web Push إذا لم يكن VAPID key موجوداً
                return;
            }
            
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });
            } catch (pushError) {
                // تخطي Web Push في حالة الخطأ
                console.warn('تخطي Web Push:', pushError);
                return;
            }
        }
        
        pushSubscription = subscription;
        
        // تسجيل في قاعدة البيانات
        try {
            await API.request('register_push.php', 'POST', {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: arrayBufferToBase64(subscription.getKey('auth'))
                }
            });
        } catch (registerError) {
            console.warn('فشل تسجيل Web Push:', registerError);
        }
        
    } catch (error) {
        // تخطي Web Push في حالة أي خطأ
        console.warn('تخطي Web Push:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== 'string') {
        throw new Error('VAPID key غير صحيح');
    }
    
    try {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (e) {
        throw new Error('فشل تحويل VAPID key: ' + e.message);
    }
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// حالة النشاط - فقط عند فتح صفحة الشات
async function startActivityUpdates() {
    // تحديث فوري عند فتح صفحة الشات
    await updateUsersActivity();
    
    // ✅ تم إلغاء الفحص الدوري - فقط عند فتح/إغلاق صفحة الشات
    // لا حاجة لـ setInterval
}

async function updateUsersActivity() {
    try {
        const result = await API.request('get_user_activity.php');
        
        if (result && result.success && result.data) {
            usersActivity = {};
            result.data.forEach(activity => {
                usersActivity[activity.user_id] = activity;
            });
            
            // تحديث عرض حالة النشاط في قائمة المشاركين
            updateActivityDisplay();
            
            // تحديث حالة النشاط في الرسائل
            updateMessagesActivity();
        }
    } catch (error) {
        console.error('خطأ في تحديث حالة النشاط:', error);
    }
}

// ✅ تحديث حالة النشاط عند مغادرة صفحة الشات
async function updateUserActivityOnLeave() {
    try {
        // تحديث حالة النشاط لـ offline عند مغادرة صفحة الشات
        await API.request('get_user_activity.php', 'POST', {
            action: 'leave_chat',
            is_online: false
        });
        console.log('✅ تم تحديث حالة النشاط عند مغادرة صفحة الشات');
    } catch (error) {
        console.error('خطأ في تحديث حالة النشاط عند المغادرة:', error);
    }
}

function updateActivityDisplay() {
    const participantsList = document.getElementById('participantsList');
    if (!participantsList) return;
    
    const items = participantsList.querySelectorAll('.participant-item');
    items.forEach(item => {
        const userId = item.dataset.userId;
        if (userId && usersActivity[userId]) {
            const activity = usersActivity[userId];
            const activityBadge = item.querySelector('.activity-badge');
            
            if (activityBadge) {
                activityBadge.textContent = activity.time_ago_text || 'غير معروف';
                activityBadge.className = `activity-badge ${activity.is_online ? 'online' : 'offline'}`;
            } else {
                // إنشاء activity badge إذا لم يكن موجوداً
                const info = item.querySelector('.participant-info');
                if (info) {
                    const badge = document.createElement('div');
                    badge.className = `activity-badge ${activity.is_online ? 'online' : 'offline'}`;
                    badge.textContent = activity.time_ago_text || 'غير معروف';
                    info.appendChild(badge);
                }
            }
        }
    });
}

// تحديث حالة النشاط في الرسائل
function updateMessagesActivity() {
    const messageElements = document.querySelectorAll('.message');
    messageElements.forEach(messageElement => {
        const messageId = messageElement.dataset.messageId;
        if (!messageId) return;
        
        // البحث عن الرسالة في المصفوفة
        const message = messages.find(m => m.id === messageId);
        if (!message || !message.user_id) return;
        
        const userId = message.user_id;
        const avatar = messageElement.querySelector('.message-avatar');
        if (!avatar) return;
        
        // البحث عن مؤشر النشاط الموجود أو إنشاء واحد جديد
        let indicator = avatar.querySelector('.online-indicator');
        
        if (usersActivity[userId]) {
            const activity = usersActivity[userId];
            
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'online-indicator';
                avatar.appendChild(indicator);
            }
            
            indicator.className = `online-indicator ${activity.is_online ? 'online' : 'offline'}`;
            indicator.title = activity.is_online ? 'نشط الآن' : (activity.time_ago_text || 'غير متصل');
        } else {
            // إذا لم تكن هناك معلومات، افتراضياً غير متصل
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'online-indicator offline';
                avatar.appendChild(indicator);
            } else {
                indicator.className = 'online-indicator offline';
            }
            indicator.title = 'غير متصل';
        }
    });
}

// قائمة الإشعارات
// دالة للحصول على قائمة الإشعارات المحذوفة
function getDeletedNotifications() {
    try {
        const deleted = localStorage.getItem('deleted_notifications');
        return deleted ? JSON.parse(deleted) : [];
    } catch (e) {
        console.error('خطأ في قراءة الإشعارات المحذوفة:', e);
        return [];
    }
}

// دالة لإضافة إشعار إلى قائمة المحذوفة
function addToDeletedNotifications(notificationId) {
    try {
        const deleted = getDeletedNotifications();
        if (!deleted.includes(notificationId)) {
            deleted.push(notificationId);
            // حفظ فقط آخر 1000 إشعار محذوف (لتفادي امتلاء localStorage)
            const trimmedDeleted = deleted.slice(-1000);
            localStorage.setItem('deleted_notifications', JSON.stringify(trimmedDeleted));
        }
    } catch (e) {
        console.error('خطأ في حفظ الإشعار المحذوف:', e);
    }
}

function addNotification(notification) {
    // التحقق من أن الإشعار غير محذوف
    const deleted = getDeletedNotifications();
    if (deleted.includes(notification.id)) {
        // إذا كان الإشعار محذوفاً، لا نضيفه
        return;
    }
    
    // التحقق من عدم تكرار الإشعار (نفس id)
    const existingIndex = notifications.findIndex(n => n.id === notification.id);
    if (existingIndex !== -1) {
        // تحديث الإشعار الموجود بدلاً من إضافة واحد جديد
        notifications[existingIndex] = {
            ...notifications[existingIndex],
            ...notification,
            read: notification.read !== undefined ? notification.read : notifications[existingIndex].read
        };
    } else {
        // إضافة إشعار جديد
        notifications.unshift({
            ...notification,
            read: notification.read !== undefined ? notification.read : false
        });
    }
    
    // حفظ في localStorage
    try {
        localStorage.setItem('chat_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {
        console.error('خطأ في حفظ الإشعارات:', e);
    }
    
    updateNotificationBadge();
}

// دالة لتحديد الإشعار كمقروء
function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        try {
            localStorage.setItem('chat_notifications', JSON.stringify(notifications.slice(0, 50)));
            renderNotificationsList();
        } catch (e) {
            console.error('خطأ في حفظ الإشعارات:', e);
        }
    }
}

// دالة لتحديد جميع الإشعارات كمقروءة
function markAllNotificationsAsRead() {
    notifications.forEach(n => n.read = true);
    try {
        localStorage.setItem('chat_notifications', JSON.stringify(notifications.slice(0, 50)));
        renderNotificationsList();
    } catch (e) {
        console.error('خطأ في حفظ الإشعارات:', e);
    }
}

function toggleNotificationsList() {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    const isVisible = notificationsList.style.display !== 'none';
    notificationsList.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        renderNotificationsList();
    }
}

function renderNotificationsList() {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    const list = notificationsList.querySelector('.notifications-items');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-notifications">لا توجد إشعارات</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    // أزرار التحكم
    const controlButtons = document.createElement('div');
    controlButtons.className = 'notifications-control-buttons';
    
    // زر "تحديد الكل كمقروء"
    const markAllReadBtn = document.createElement('button');
    markAllReadBtn.className = 'mark-all-read-btn';
    markAllReadBtn.textContent = 'تحديد الكل كمقروء';
    markAllReadBtn.onclick = () => {
        markAllNotificationsAsRead();
    };
    controlButtons.appendChild(markAllReadBtn);
    
    // زر "حذف الكل"
    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'delete-all-notifications-btn';
    deleteAllBtn.textContent = 'حذف جميع الإشعارات';
    deleteAllBtn.onclick = () => {
        if (confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) {
            deleteAllNotifications();
        }
    };
    controlButtons.appendChild(deleteAllBtn);
    
    fragment.appendChild(controlButtons);
    
    notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.onclick = () => {
            // عند النقر على الإشعار، تحديده كمقروء
            if (!notification.read) {
                markNotificationAsRead(notification.id);
            }
        };
        
        const username = document.createElement('div');
        username.className = 'notification-username';
        username.textContent = notification.username;
        
        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = notification.message;
        
        const time = document.createElement('div');
        time.className = 'notification-time';
        time.textContent = formatTime(notification.timestamp);
        
        // مؤشر "غير مقروء"
        if (!notification.read) {
            const unreadIndicator = document.createElement('div');
            unreadIndicator.className = 'unread-indicator';
            unreadIndicator.title = 'غير مقروء';
            content.appendChild(unreadIndicator);
        }
        
        content.appendChild(username);
        content.appendChild(message);
        content.appendChild(time);
        
        const actions = document.createElement('div');
        actions.className = 'notification-actions';
        
        // زر "تم الرؤية" إذا لم يكن مقروءاً
        if (!notification.read) {
            const markReadBtn = document.createElement('button');
            markReadBtn.className = 'mark-read-btn';
            markReadBtn.innerHTML = '✓';
            markReadBtn.title = 'تم الرؤية';
            markReadBtn.onclick = (e) => {
                e.stopPropagation();
                markNotificationAsRead(notification.id);
            };
            actions.appendChild(markReadBtn);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'notification-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'حذف';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteNotification(notification.id);
        };
        actions.appendChild(deleteBtn);
        
        item.appendChild(content);
        item.appendChild(actions);
        fragment.appendChild(item);
    });
    
    list.appendChild(fragment);
    updateNotificationBadge();
}

function deleteNotification(notificationId) {
    // إضافة ID إلى قائمة المحذوفة قبل الحذف
    addToDeletedNotifications(notificationId);
    
    notifications = notifications.filter(n => n.id !== notificationId);
    
    try {
        localStorage.setItem('chat_notifications', JSON.stringify(notifications));
    } catch (e) {
        console.error('خطأ في حفظ الإشعارات:', e);
    }
    
    renderNotificationsList();
}

// دالة لحذف جميع الإشعارات
function deleteAllNotifications() {
    try {
        // إضافة جميع IDs الحالية إلى قائمة المحذوفة
        notifications.forEach(notification => {
            addToDeletedNotifications(notification.id);
        });
        
        notifications = [];
        localStorage.setItem('chat_notifications', JSON.stringify([]));
        updateNotificationBadge();
        renderNotificationsList();
        showMessage('تم حذف جميع الإشعارات', 'success');
    } catch (e) {
        console.error('خطأ في حذف جميع الإشعارات:', e);
        showMessage('حدث خطأ في حذف الإشعارات', 'error');
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        // حساب عدد الإشعارات غير المقروءة فقط
        const unreadCount = notifications.filter(n => !n.read).length;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// تصدير الدوال للاستخدام من ملفات أخرى
window.addChatNotification = addNotification;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// تحميل قائمة المستخدمين
async function loadUsers() {
    try {
        const result = await API.request('get_user_activity.php');
        if (result && result.success && result.data) {
            renderUsers(result.data);
        }
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
    }
}

// عرض قائمة المستخدمين
function renderUsers(users) {
    const participantsList = document.getElementById('participantsList');
    if (!participantsList) return;
    
    participantsList.innerHTML = '';
    
    if (!users || users.length === 0) {
        participantsList.innerHTML = '<div class="empty-participants">لا يوجد مستخدمون</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.dataset.userId = user.user_id;
        
        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = getInitials(user.name || user.username || 'U');
        avatar.style.background = getAvatarColor(user.user_id);
        
        const info = document.createElement('div');
        info.className = 'participant-info';
        
        const name = document.createElement('div');
        name.className = 'participant-name';
        name.textContent = user.name || user.username || 'مستخدم';
        
        const activityBadge = document.createElement('div');
        activityBadge.className = `activity-badge ${user.is_online ? 'online' : 'offline'}`;
        activityBadge.textContent = user.time_ago_text || 'غير معروف';
        
        info.appendChild(name);
        info.appendChild(activityBadge);
        
        item.appendChild(avatar);
        item.appendChild(info);
        
        fragment.appendChild(item);
    });
    
    participantsList.appendChild(fragment);
    
    // حفظ في usersActivity و allUsers
    users.forEach(user => {
        usersActivity[user.user_id] = user;
    });
    
    // حفظ في allUsers للـ mention
    allUsers = users.map(user => ({
        user_id: user.user_id,
        name: user.name,
        username: user.username
    }));
    
    // حفظ في allUsers للـ mention
    allUsers = users.map(user => ({
        user_id: user.user_id,
        name: user.name,
        username: user.username
    }));
}

// معالجة تغيير حالة التاب
function handleVisibilityChange() {
    if (document.hidden) {
        // التاب مخفي - لا حاجة لإشعارات إضافية
    } else {
        // التاب مرئي - تحديث حالة النشاط
        updateUsersActivity();
    }
}


// تنظيف عند إغلاق الصفحة
async function cleanup() {
    console.log('🧹 تنظيف صفحة الشات - إيقاف جميع polling systems');
    
    // إيقاف Long Polling
    stopLongPolling();
    
    // ✅ تحديث حالة النشاط عند مغادرة صفحة الشات (مرة واحدة)
    try {
        // تحديث حالة النشاط لـ offline عند مغادرة صفحة الشات
        await updateUserActivityOnLeave();
    } catch (error) {
        console.error('خطأ في تحديث حالة النشاط عند المغادرة:', error);
    }
    
    // إيقاف تحديث حالة النشاط (إذا كان هناك interval)
    if (activityUpdateInterval) {
        clearInterval(activityUpdateInterval);
        activityUpdateInterval = null;
    }
    
    // ✅ إيقاف MessagePollingManager إذا كان يعمل
    if (window.MessagePollingManager && typeof window.MessagePollingManager.stop === 'function') {
        try {
            window.MessagePollingManager.stop();
            console.log('✅ تم إيقاف MessagePollingManager');
        } catch (e) {
            console.error('خطأ في إيقاف MessagePollingManager:', e);
        }
    }
    
    // ✅ إيقاف GlobalNotificationManager إذا كان يعمل
    if (window.GlobalNotificationManager && typeof window.GlobalNotificationManager.stop === 'function') {
        try {
            window.GlobalNotificationManager.stop();
            console.log('✅ تم إيقاف GlobalNotificationManager');
        } catch (e) {
            console.error('خطأ في إيقاف GlobalNotificationManager:', e);
        }
    }
    
    // ✅ إلغاء جميع event listeners المضافة في startPeriodicCheck
    // (تم إضافة event listeners لـ visibilitychange و focus - لكن لا يمكن إزالتها بدون مرجع)
    
    // تحديث حالة النشاط (offline) - سيتم تحديثها تلقائياً من السيرفر بعد timeout
}

// دوال مساعدة
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(userId) {
    const colors = [
        '#9C27B0', '#BA68C8', '#7B1FA2', '#E91E63', '#F06292',
        '#2196F3', '#64B5F6', '#3F51B5', '#7986CB', '#00BCD4',
        '#4CAF50', '#81C784', '#FF9800', '#FFB74D', '#795548'
    ];
    
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
    }
    
    if (diff < 172800000) {
        return 'أمس';
    }
    
    return date.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function scrollToMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.style.animation = 'highlightMessage 2s ease';
        setTimeout(() => {
            messageElement.style.animation = '';
        }, 2000);
    }
}

function showLoading(show) {
    // التحقق من أن الصفحة تعمل داخل iframe (على الكمبيوتر)
    const isInIframe = window.self !== window.top;
    
    // إذا كانت الصفحة داخل iframe، نعرض علامة التحميل داخل الشات
    if (isInIframe) {
        const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
        if (chatLoadingIndicator) {
            chatLoadingIndicator.style.display = show ? 'flex' : 'none';
            console.log(show ? '📦 عرض علامة التحميل داخل الشات' : '✅ إخفاء علامة التحميل');
        }
        return;
    }
    
    // إذا لم تكن داخل iframe (على الموبايل)، نعرض loading overlay الكامل
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showMessage(message, type = 'info') {
    // تجنب infinite recursion - التحقق من أننا لا نستدعي نفسنا
    if (typeof window.showMessage === 'function' && window.showMessage !== showMessage) {
        window.showMessage(message, type);
    } else {
        // استخدام alert كبديل آمن
        alert(message);
    }
}

function updateCurrentUserSection() {
    const currentUserSection = document.getElementById('currentUserSection');
    if (!currentUserSection || !currentUser) return;
    
    currentUserSection.innerHTML = `
        <div class="current-user-item">
            <div class="current-user-avatar">${getInitials(currentUser.name || currentUser.username || 'U')}</div>
            <div class="current-user-name">${currentUser.name || currentUser.username || 'مستخدم'}</div>
            <button class="logout-btn" onclick="handleLogout()" aria-label="تسجيل الخروج">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </button>
        </div>
    `;
    
    // التحقق من المالك وإظهار زر حذف الرسائل
    checkAndShowDeleteButton();
}

// التحقق من المالك وإظهار زر حذف الرسائل
function checkAndShowDeleteButton() {
    const deleteBtn = document.getElementById('deleteMessagesBtn');
    if (!deleteBtn) return;
    
    // التحقق من أن المستخدم هو مالك (role === 'admin')
    let isOwner = false;
    
    if (currentUser) {
        // التحقق الأول: من role مباشرة (الأكثر دقة)
        if (currentUser.role === 'admin') {
            isOwner = true;
        }
        // التحقق الثاني: من is_owner إذا كان موجوداً
        else if (currentUser.is_owner === true || currentUser.is_owner === 'true') {
            isOwner = true;
        }
    }
    
    // التحقق من localStorage كبديل فقط إذا لم يكن currentUser متاحاً
    if (!isOwner && !currentUser) {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user && (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true')) {
                    isOwner = true;
                }
            }
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم من localStorage:', e);
        }
    }
    
    // إظهار أو إخفاء الزر بناءً على النتيجة
    if (isOwner) {
        deleteBtn.style.display = 'flex';
        console.log('✅ زر حذف الرسائل معروض للمالك');
    } else {
        deleteBtn.style.display = 'none';
        console.log('🔒 زر حذف الرسائل مخفي - المستخدم ليس مالكاً');
    }
}

// منتقي الإيموجي
function toggleEmojiPicker() {
    let emojiPicker = document.getElementById('emojiPicker');
    
    if (!emojiPicker) {
        // إنشاء منتقي الإيموجي
        emojiPicker = document.createElement('div');
        emojiPicker.id = 'emojiPicker';
        emojiPicker.className = 'emoji-picker';
        
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';
        
        // قائمة الإيموجي الشائعة
        const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
        
        emojis.forEach(emoji => {
            const emojiItem = document.createElement('button');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.onclick = () => {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.value += emoji;
                    chatInput.focus();
                }
            };
            emojiGrid.appendChild(emojiItem);
        });
        
        emojiPicker.appendChild(emojiGrid);
        document.body.appendChild(emojiPicker);
        
        // إغلاق منتقي الإيموجي عند النقر خارجه
        document.addEventListener('click', (e) => {
            if (!emojiPicker.contains(e.target) && e.target.id !== 'emojiBtn' && !e.target.closest('#emojiBtn')) {
                emojiPicker.style.display = 'none';
            }
        });
    }
    
    // تبديل عرض منتقي الإيموجي
    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
        emojiPicker.style.display = 'block';
    } else {
        emojiPicker.style.display = 'none';
    }
}

// قائمة المرفقات
function toggleAttachMenu() {
    let attachMenu = document.getElementById('attachMenu');
    
    if (!attachMenu) {
        // إنشاء قائمة المرفقات
        attachMenu = document.createElement('div');
        attachMenu.id = 'attachMenu';
        attachMenu.className = 'attach-menu';
        
        // زر الملفات
        const fileItem = document.createElement('button');
        fileItem.className = 'attach-menu-item';
        fileItem.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>ملف</span>
        `;
        fileItem.onclick = () => {
            attachMenu.style.display = 'none';
            attachFile();
        };
        
        // زر الصور
        const imageItem = document.createElement('button');
        imageItem.className = 'attach-menu-item';
        imageItem.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>صورة</span>
        `;
        imageItem.onclick = () => {
            attachMenu.style.display = 'none';
            attachImage();
        };
        
        // زر الكاميرا
        const cameraItem = document.createElement('button');
        cameraItem.className = 'attach-menu-item';
        cameraItem.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>كاميرا</span>
        `;
        cameraItem.onclick = () => {
            attachMenu.style.display = 'none';
            openCamera();
        };
        
        attachMenu.appendChild(fileItem);
        attachMenu.appendChild(imageItem);
        attachMenu.appendChild(cameraItem);
        
        document.body.appendChild(attachMenu);
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!attachMenu.contains(e.target) && e.target.id !== 'attachBtn' && !e.target.closest('#attachBtn')) {
                attachMenu.style.display = 'none';
            }
        });
    }
    
    // تبديل عرض القائمة
    if (attachMenu.style.display === 'none' || !attachMenu.style.display) {
        attachMenu.style.display = 'flex';
    } else {
        attachMenu.style.display = 'none';
    }
}

// إرفاق ملف
function attachFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // التحقق من حجم الملف (حد أقصى 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    showMessage('حجم الملف كبير جداً. الحد الأقصى 10MB', 'error');
                    return;
                }
                
                // قراءة الملف كـ Base64
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const fileData = event.target.result;
                    await sendFileMessage(fileData, 'file', file.name);
                };
                reader.onerror = () => {
                    showMessage('حدث خطأ في قراءة الملف', 'error');
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('خطأ في إرسال الملف:', error);
                showMessage('حدث خطأ في إرسال الملف', 'error');
            }
        }
    };
    input.click();
}

// دالة ضغط الصور للشات (لتقليل استهلاك الباندويث)
function compressChatImage(file, maxWidth = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // حساب الأبعاد بعد الضغط
                    if (width > maxWidth) {
                        const ratio = maxWidth / width;
                        width = maxWidth;
                        height = Math.round(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // تحويل إلى base64 مع ضغط
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = () => {
                    reject(new Error('فشل تحميل الصورة'));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('فشل قراءة الملف'));
            };
            reader.readAsDataURL(file);
        } catch (error) {
            reject(error);
        }
    });
}

// إرفاق صورة
function attachImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // التحقق من حجم الصورة (حد أقصى 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showMessage('حجم الصورة كبير جداً. الحد الأقصى 5MB', 'error');
                    return;
                }
                
                // ضغط الصورة قبل الرفع لتقليل استهلاك الباندويث
                try {
                    const compressedImage = await compressChatImage(file, 1200, 0.75);
                    await sendFileMessage(compressedImage, 'image', file.name);
                } catch (compressError) {
                    console.warn('فشل ضغط الصورة، استخدام الصورة الأصلية:', compressError);
                    // في حالة فشل الضغط، استخدام الصورة الأصلية
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const fileData = event.target.result;
                        await sendFileMessage(fileData, 'image', file.name);
                    };
                    reader.onerror = () => {
                        showMessage('حدث خطأ في قراءة الصورة', 'error');
                    };
                    reader.readAsDataURL(file);
                }
            } catch (error) {
                console.error('خطأ في إرسال الصورة:', error);
                showMessage('حدث خطأ في إرسال الصورة', 'error');
            }
        }
    };
    input.click();
}

// فتح الكاميرا
function openCamera() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // استخدام الكاميرا الخلفية
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // التحقق من حجم الصورة (حد أقصى 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        showMessage('حجم الصورة كبير جداً. الحد الأقصى 5MB', 'error');
                        return;
                    }
                    
                    // ضغط الصورة قبل الرفع لتقليل استهلاك الباندويث
                    try {
                        const compressedImage = await compressChatImage(file, 1200, 0.75);
                        await sendFileMessage(compressedImage, 'image', file.name || 'camera.jpg');
                    } catch (compressError) {
                        console.warn('فشل ضغط الصورة، استخدام الصورة الأصلية:', compressError);
                        // في حالة فشل الضغط، استخدام الصورة الأصلية
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const fileData = event.target.result;
                            await sendFileMessage(fileData, 'image', file.name || 'camera.jpg');
                        };
                        reader.onerror = () => {
                            showMessage('حدث خطأ في قراءة الصورة', 'error');
                        };
                        reader.readAsDataURL(file);
                    }
                } catch (error) {
                    console.error('خطأ في إرسال الصورة من الكاميرا:', error);
                    showMessage('حدث خطأ في إرسال الصورة', 'error');
                }
            }
        };
        input.click();
    } catch (error) {
        console.error('خطأ في فتح الكاميرا:', error);
        showMessage('حدث خطأ في فتح الكاميرا', 'error');
    }
}

// تسجيل صوتي - باستخدام RecordRTC لدعم جميع الأجهزة (iOS, Android, Desktop)
async function startAudioRecording(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (isRecording) {
        return;
    }
    
    try {
        // ✅ التحقق من دعم getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showMessage('التسجيل الصوتي غير مدعوم في هذا المتصفح - يرجى استخدام متصفح حديث', 'error');
            return;
        }
        
        // ✅ استخدام النظام المركزي للصلاحيات - التحقق من الصلاحية قبل طلبها
        if (typeof window.getMicrophoneStream === 'function') {
            // استخدام الدالة المركزية للتحقق من الصلاحية والحصول على stream
            audioStream = await window.getMicrophoneStream({ audio: true });
            
            if (!audioStream) {
                // فشل الحصول على stream - التحقق من السبب
                const permissionState = await (window.checkMicrophonePermission ? window.checkMicrophonePermission() : Promise.resolve(null));
                
                if (permissionState === 'denied') {
                    showMessage('تم رفض الصلاحية - يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح', 'error');
                } else {
                    showMessage('فشل الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات', 'error');
                }
                return;
            }
        } else {
            // Fallback: إذا لم يكن النظام المركزي متاحاً، استخدام الطريقة القديمة
            // التحقق من حالة صلاحية المايكروفون أولاً
            if (navigator.permissions) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                    
                    if (permissionStatus.state === 'denied') {
                        showMessage('تم رفض الصلاحية - يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح', 'error');
                        return;
                    }
                } catch (e) {
                    console.log('⚠️ لا يمكن التحقق من صلاحية المايكروفون:', e);
                }
            }
            
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        // ✅ استخدام MediaRecorder API الأصلي (يعمل بشكل موثوق على Android/Desktop)
        if (typeof MediaRecorder === 'undefined') {
            throw new Error('MediaRecorder API غير مدعوم في هذا المتصفح');
        }
        
        // ✅ تحديد نوع MIME مدعوم
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }
        
        const mediaRecorder = new MediaRecorder(audioStream, { mimeType: mimeType });
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        // ✅ استخدام wrapper object لتوافق مع كود stopAudioRecording
        recordRTC = {
            isMediaRecorder: true,
            mediaRecorder: mediaRecorder,
            audioChunks: audioChunks,
            stream: audioStream,
            mimeType: mimeType,
            startRecording: () => {
                mediaRecorder.start(1000);
            },
            stopRecording: (callback) => {
                mediaRecorder.onstop = () => {
                    if (audioChunks.length > 0) {
                        recordRTC.audioBlob = new Blob(audioChunks, { type: mimeType });
                    }
                    callback();
                };
                mediaRecorder.stop();
            },
            getBlob: () => recordRTC.audioBlob,
            destroy: () => {
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                }
            }
        };
        
        recordRTC.startRecording();
        isRecording = true;
        recordingStartTime = Date.now();
        
        // تحديث واجهة الزر
        const audioBtn = document.getElementById('audioBtn');
        if (audioBtn) {
            audioBtn.classList.add('recording');
            audioBtn.setAttribute('aria-label', 'إيقاف التسجيل');
        }
        
        // بدء عداد الوقت
        startRecordingTimer();
        
    } catch (error) {
        console.error('خطأ في بدء التسجيل الصوتي:', error);
        isRecording = false;
        
        let errorMessage = 'فشل الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'تم رفض الصلاحية - يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'لم يتم العثور على ميكروفون - يرجى التحقق من الاتصال';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'الميكروفون مستخدم من قبل تطبيق آخر - يرجى إغلاق التطبيقات الأخرى';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage = 'الميكروفون لا يدعم المواصفات المطلوبة';
        }
        
        showMessage(errorMessage, 'error');
        
        // تنظيف
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        const audioBtn = document.getElementById('audioBtn');
        if (audioBtn) {
            audioBtn.classList.remove('recording');
        }
    }
}

// إيقاف التسجيل الصوتي - باستخدام RecordRTC
function stopAudioRecording(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (!isRecording || !recordRTC) {
        return;
    }
    
    isRecording = false;
    
    // إيقاف العداد
    stopRecordingTimer();
    
    // تحديث واجهة الزر
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.classList.remove('recording');
        audioBtn.setAttribute('aria-label', 'تسجيل صوتي');
    }
    
    // ✅ إيقاف التسجيل والحصول على البيانات
    recordRTC.stopRecording(() => {
        try {
            // ✅ الحصول على Blob
            const audioBlob = recordRTC.getBlob();
            
            if (!audioBlob || audioBlob.size === 0) {
                showMessage('فشل التسجيل الصوتي - لم يتم تسجيل أي بيانات', 'error');
                
                // تنظيف
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
                if (recordRTC) {
                    recordRTC.destroy();
                    recordRTC = null;
                }
                return;
            }
            
            // ✅ إيقاف التراكات
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            // ✅ تحويل إلى Base64
            const reader = new FileReader();
            
            reader.onload = async () => {
                try {
                    const audioData = reader.result;
                    // ✅ تحديد اسم الملف بناءً على نوع MIME
                    let fileName = 'audio.webm';
                    if (recordRTC.mimeType) {
                        if (recordRTC.mimeType.includes('webm')) {
                            fileName = 'audio.webm';
                        } else if (recordRTC.mimeType.includes('mp4') || recordRTC.mimeType.includes('m4a')) {
                            fileName = 'audio.m4a';
                        } else if (recordRTC.mimeType.includes('wav')) {
                            fileName = 'audio.wav';
                        }
                    } else if (audioBlob.type) {
                        if (audioBlob.type.includes('webm')) {
                            fileName = 'audio.webm';
                        } else if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
                            fileName = 'audio.m4a';
                        } else if (audioBlob.type.includes('wav')) {
                            fileName = 'audio.wav';
                        }
                    }
                    await sendAudioMessage(audioData, fileName);
                } catch (sendError) {
                    console.error('خطأ في إرسال الرسالة الصوتية:', sendError);
                    showMessage('حدث خطأ في إرسال الرسالة الصوتية', 'error');
                } finally {
                    // ✅ تنظيف
                    if (recordRTC) {
                        recordRTC.destroy();
                        recordRTC = null;
                    }
                }
            };
            
            reader.onerror = (error) => {
                console.error('خطأ في قراءة التسجيل الصوتي:', error);
                showMessage('حدث خطأ في قراءة التسجيل الصوتي', 'error');
                
                // تنظيف
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
                if (recordRTC) {
                    recordRTC.destroy();
                    recordRTC = null;
                }
            };
            
            reader.readAsDataURL(audioBlob);
            
        } catch (error) {
            console.error('خطأ في معالجة التسجيل الصوتي:', error);
            showMessage('حدث خطأ في معالجة التسجيل الصوتي', 'error');
            
            // تنظيف
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            if (recordRTC) {
                recordRTC.destroy();
                recordRTC = null;
            }
        }
    });
}

// بدء عداد التسجيل
function startRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
    }
    
    recordingTimer = setInterval(() => {
        if (isRecording && recordingStartTime) {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // تحديث عنوان الزر أو إظهار مؤشر
            const audioBtn = document.getElementById('audioBtn');
            if (audioBtn) {
                audioBtn.title = `تسجيل... ${timeText}`;
            }
        }
    }, 1000);
}

// إيقاف عداد التسجيل
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    const audioBtn = document.getElementById('audioBtn');
    if (audioBtn) {
        audioBtn.title = 'تسجيل صوتي';
    }
}

// إرسال رسالة صوتية
async function sendAudioMessage(audioData, fileName = 'audio.webm') {
    try {
        showLoading(true);
        
        // إظهار الرسالة محلياً أولاً
        const tempMessage = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            username: currentUser.name || currentUser.username,
            message: '🎤 رسالة صوتية',
            created_at: new Date().toISOString(),
            isSending: true,
            file_path: audioData,
            file_type: 'audio',
            file_name: fileName
        };
        
        messages.push(tempMessage);
        renderMessages();
        
        // إرسال الرسالة للخادم
        const result = await API.request('send_message.php', 'POST', {
            message: '🎤 رسالة صوتية',
            file_type: 'audio',
            file_data: audioData,
            file_name: fileName
        });
        
        showLoading(false);
        
        if (result && result.success) {
            // استبدال الرسالة المؤقتة بالرسالة الحقيقية
            const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                messages[tempIndex] = result.data;
                lastMessageId = result.data.id;
                renderMessages();
                
                // ✅ إجبار إعادة تحميل الرسائل من الخادم
                setTimeout(async () => {
                    await loadMessages(true); // forceRefresh = true
                }, 300);
                
                // إرسال حدث لإشعار النظام بوجود رسالة جديدة
                window.dispatchEvent(new CustomEvent('messageSent'));
                
                // فحص فوري للرسائل الجديدة
                if (longPollingActive) {
                    setTimeout(() => checkForNewMessages(), 500);
                }
            }
        } else {
            // إزالة الرسالة المؤقتة في حالة الفشل
            messages = messages.filter(m => m.id !== tempMessage.id);
            renderMessages();
            showMessage('فشل إرسال الرسالة الصوتية', 'error');
        }
    } catch (error) {
        showLoading(false);
        console.error('خطأ في إرسال الرسالة الصوتية:', error);
        showMessage('حدث خطأ في إرسال الرسالة الصوتية', 'error');
        
        // إزالة الرسالة المؤقتة
        const tempIndex = messages.findIndex(m => m.id && m.id.startsWith('temp-'));
        if (tempIndex !== -1) {
            messages.splice(tempIndex, 1);
            renderMessages();
        }
    }
}

// إرسال رسالة مع ملف
async function sendFileMessage(fileData, fileType, fileName) {
    try {
        const chatInput = document.getElementById('chatInput');
        const messageText = chatInput ? chatInput.value.trim() : '';
        
        // إظهار الرسالة محلياً أولاً
        const tempMessage = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            username: currentUser.name || currentUser.username,
            message: messageText || (fileType === 'image' ? '📷 صورة' : '📎 ملف'),
            created_at: new Date().toISOString(),
            isSending: true,
            file_path: fileData,
            file_type: fileType,
            file_name: fileName
        };
        
        messages.push(tempMessage);
        renderMessages();
        if (chatInput) chatInput.value = '';
        
        // إرسال الرسالة للخادم
        const result = await API.request('send_message.php', 'POST', {
            message: messageText,
            file_type: fileType,
            file_data: fileData,
            file_name: fileName
        });
        
        if (result && result.success) {
            // استبدال الرسالة المؤقتة بالرسالة الحقيقية
            const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                messages[tempIndex] = result.data;
                lastMessageId = result.data.id;
                renderMessages();
                
                // ✅ إجبار إعادة تحميل الرسائل من الخادم لإظهار الرسالة الجديدة فوراً
                // انتظار قليل لضمان حفظ الرسالة في قاعدة البيانات
                setTimeout(async () => {
                    await loadMessages(true); // forceRefresh = true
                }, 300);
                
                // إرسال حدث لإشعار النظام بوجود رسالة جديدة
                window.dispatchEvent(new CustomEvent('messageSent'));
                
                // فحص فوري للرسائل الجديدة (للمستخدمين الآخرين)
                if (longPollingActive) {
                    setTimeout(() => checkForNewMessages(), 500);
                }
            }
        } else {
            // إزالة الرسالة المؤقتة في حالة الفشل
            messages = messages.filter(m => m.id !== tempMessage.id);
            renderMessages();
            showMessage('فشل إرسال الملف', 'error');
        }
    } catch (error) {
        console.error('خطأ في إرسال الملف:', error);
        showMessage('حدث خطأ في إرسال الملف', 'error');
        
        // إزالة الرسالة المؤقتة
        const tempIndex = messages.findIndex(m => m.id && m.id.startsWith('temp-'));
        if (tempIndex !== -1) {
            messages.splice(tempIndex, 1);
            renderMessages();
        }
    }
}

async function handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        cleanup();
        if (typeof logout === 'function') {
            await logout();
        } else {
            window.location.href = 'index.html';
        }
    }
}

// تحميل الإشعارات المحفوظة
function loadSavedNotifications() {
    try {
        const saved = localStorage.getItem('chat_notifications');
        if (saved) {
            const allNotifications = JSON.parse(saved);
            const deleted = getDeletedNotifications();
            
            // تصفية الإشعارات المحذوفة
            notifications = allNotifications.filter(n => !deleted.includes(n.id));
            
            // إضافة خاصية read للإشعارات القديمة التي لا تحتوي عليها
            notifications = notifications.map(n => ({
                ...n,
                read: n.read !== undefined ? n.read : false
            }));
            
            // إذا تمت تصفية إشعارات، حفظ القائمة المحدثة
            if (notifications.length !== allNotifications.length) {
                localStorage.setItem('chat_notifications', JSON.stringify(notifications));
            }
            
            updateNotificationBadge();
        }
    } catch (e) {
        console.error('خطأ في تحميل الإشعارات:', e);
    }
}

// تحميل الإشعارات عند التهيئة
loadSavedNotifications();

// مودال حذف الرسائل
function showDeleteMessagesModal() {
    // التحقق من المالك مرة أخرى (للحماية الإضافية)
    let isOwner = false;
    
    if (currentUser) {
        // التحقق الأول: من role مباشرة (الأكثر دقة)
        if (currentUser.role === 'admin') {
            isOwner = true;
        }
        // التحقق الثاني: من is_owner إذا كان موجوداً
        else if (currentUser.is_owner === true || currentUser.is_owner === 'true') {
            isOwner = true;
        }
    }
    
    // التحقق من localStorage كبديل فقط إذا لم يكن currentUser متاحاً
    if (!isOwner && !currentUser) {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user && (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true')) {
                    isOwner = true;
                }
            }
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم من localStorage:', e);
        }
    }
    
    if (!isOwner) {
        showMessage('هذه الميزة متاحة للمالك فقط', 'error');
        console.warn('⚠️ محاولة وصول غير مصرح بها لحذف الرسائل');
        return;
    }
    
    // إنشاء المودال
    let modal = document.getElementById('deleteMessagesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'deleteMessagesModal';
        modal.className = 'delete-messages-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeDeleteMessagesModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>حذف الرسائل</h3>
                    <button class="modal-close" onclick="closeDeleteMessagesModal()">×</button>
                </div>
                <div class="modal-body">
                    <p class="warning-text">⚠️ تحذير: سيتم حذف جميع الرسائل في الفترة الزمنية المحددة بشكل نهائي ولا يمكن استرجاعها!</p>
                    
                    <div class="form-group">
                        <label for="deleteFromDate">من تاريخ:</label>
                        <input type="datetime-local" id="deleteFromDate" class="form-input" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="deleteToDate">إلى تاريخ:</label>
                        <input type="datetime-local" id="deleteToDate" class="form-input" required>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="confirmDelete" required>
                            أنا أؤكد أنني أريد حذف الرسائل في هذه الفترة الزمنية
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeDeleteMessagesModal()">إلغاء</button>
                    <button class="btn btn-danger" id="confirmDeleteBtn" onclick="confirmDeleteMessages()">حذف الرسائل</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // إعادة تعيين القيم
    document.getElementById('deleteFromDate').value = '';
    document.getElementById('deleteToDate').value = '';
    document.getElementById('confirmDelete').checked = false;
    
    // إظهار المودال
    modal.style.display = 'flex';
}

function closeDeleteMessagesModal() {
    const modal = document.getElementById('deleteMessagesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function confirmDeleteMessages() {
    const fromDate = document.getElementById('deleteFromDate').value;
    const toDate = document.getElementById('deleteToDate').value;
    const confirmCheck = document.getElementById('confirmDelete').checked;
    
    if (!fromDate || !toDate) {
        showMessage('يرجى تحديد الفترة الزمنية', 'error');
        return;
    }
    
    if (!confirmCheck) {
        showMessage('يرجى تأكيد الحذف', 'error');
        return;
    }
    
    // التحقق من أن تاريخ البداية قبل تاريخ النهاية
    if (new Date(fromDate) > new Date(toDate)) {
        showMessage('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
        return;
    }
    
    // تأكيد نهائي
    if (!confirm('هل أنت متأكد تماماً من حذف جميع الرسائل في هذه الفترة؟\n\nهذا الإجراء لا يمكن التراجع عنه!')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const result = await API.request('delete_messages.php', 'POST', {
            from_date: fromDate,
            to_date: toDate
        });
        
        showLoading(false);
        
        if (result && result.success) {
            showMessage(result.message || 'تم حذف الرسائل بنجاح', 'success');
            closeDeleteMessagesModal();
            
            // إعادة تحميل الرسائل
            await loadMessages();
        } else {
            showMessage(result.message || 'حدث خطأ في حذف الرسائل', 'error');
        }
    } catch (error) {
        showLoading(false);
        console.error('خطأ في حذف الرسائل:', error);
        showMessage('حدث خطأ في حذف الرسائل', 'error');
    }
}

// تحميل آخر رسالة مقروءة
function loadLastReadMessageId() {
    try {
        const saved = localStorage.getItem('lastReadMessageId');
        if (saved) {
            lastReadMessageId = saved;
        }
    } catch (e) {
        console.error('خطأ في تحميل آخر رسالة مقروءة:', e);
    }
}

// حفظ آخر رسالة مقروءة
function saveLastReadMessageId() {
    try {
        localStorage.setItem('lastReadMessageId', lastReadMessageId);
        // تحديث lastReadMessageId في chat-unread-badge.js أيضاً
        if (typeof window.updateLastReadMessageId === 'function') {
            window.updateLastReadMessageId(lastReadMessageId);
        }
    } catch (e) {
        console.error('خطأ في حفظ آخر رسالة مقروءة:', e);
    }
}

// تحديث عداد الرسائل غير المقروءة في الشريط الجانبي
function updateUnreadBadge(count) {
    try {
        // تحديث العداد في الشريط الجانبي
        const badge = document.getElementById('chatUnreadBadge');
        const badgeMobile = document.getElementById('chatUnreadBadgeMobile');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count.toString();
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        
        if (badgeMobile) {
            if (count > 0) {
                badgeMobile.textContent = count > 99 ? '99+' : count.toString();
                badgeMobile.style.display = 'flex';
            } else {
                badgeMobile.style.display = 'none';
            }
        }
        
        // حفظ العدد في localStorage للوصول من صفحات أخرى
        localStorage.setItem('chatUnreadCount', count.toString());
        
        // تحديث العداد في dashboard إذا كان متاحاً
        if (typeof window.updateChatUnreadBadge === 'function') {
            window.updateChatUnreadBadge(count);
        }
    } catch (e) {
        console.error('خطأ في تحديث عداد الرسائل غير المقروءة:', e);
    }
}

// حساب عدد الرسائل غير المقروءة
function calculateUnreadCount() {
    try {
        if (!messages || messages.length === 0 || !lastReadMessageId) {
            return 0;
        }
        
        let count = 0;
        messages.forEach(message => {
            // فقط الرسائل من مستخدمين آخرين بعد آخر رسالة مقروءة
            if (message.user_id !== currentUser.id && 
                message.id && 
                !message.id.startsWith('temp-') &&
                message.id > lastReadMessageId) {
                count++;
            }
        });
        
        return count;
    } catch (e) {
        console.error('خطأ في حساب الرسائل غير المقروءة:', e);
        return 0;
    }
}

// تحميل آخر رسالة مقروءة عند التهيئة
loadLastReadMessageId();

// حذف جميع إشعارات الرسائل عند فتح صفحة الشات
function clearChatNotifications() {
    try {
        // استدعاء وظيفة حذف الإشعارات من GlobalNotificationManager إذا كان متاحاً
        if (typeof window.GlobalNotificationManager !== 'undefined' && window.GlobalNotificationManager.clearChatNotifications) {
            window.GlobalNotificationManager.clearChatNotifications();
        }
        
        // حذف آخر معرف رسالة من localStorage لإجبار النظام على إعادة الجلب
        localStorage.removeItem('lastChatMessageId');
        
        // إغلاق جميع الإشعارات المفتوحة (لا يمكن إغلاقها مباشرة في JavaScript)
        // لكن يمكننا تحديث lastMessageId لإجبار النظام على التوقف عن عرض إشعارات قديمة
        
        console.log('✅ تم حذف إشعارات الرسائل عند فتح صفحة الشات');
    } catch (error) {
        console.error('خطأ في حذف إشعارات الرسائل:', error);
    }
}

// معالجة إدخال @ للـ mention
function handleMentionInput(e) {
    const chatInput = e.target;
    if (!chatInput) return;
    
    const value = chatInput.value;
    const cursorPosition = chatInput.selectionStart || 0;
    
    // البحث عن @ قبل موضع المؤشر
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
        // التحقق من أن @ ليس جزءاً من كلمة (يجب أن يكون بعد مسافة أو في البداية)
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
            const query = textBeforeCursor.substring(lastAtIndex + 1);
            // التحقق من أن الاستعلام لا يحتوي على مسافات (لم يكتمل الـ mention بعد)
            if (!query.includes(' ') && !query.includes('\n') && !query.includes('@')) {
                mentionStartPosition = lastAtIndex;
                // التأكد من تحميل المستخدمين إذا لم تكن محملة
                if (!allUsers || allUsers.length === 0) {
                    loadUsers().then(() => {
                        showMentionMenu(query);
                    });
                } else {
                    showMentionMenu(query);
                }
                return;
            }
        }
    }
    
    // إخفاء قائمة الـ mention إذا لم يكن هناك @
    hideMentionMenu();
}

// معالجة مفاتيح لوحة المفاتيح في قائمة الـ mention
function handleMentionKeydown(e) {
    if (!mentionMenuVisible) return;
    
    const mentionMenu = document.getElementById('mentionMenu');
    if (!mentionMenu) return;
    
    const items = mentionMenu.querySelectorAll('.mention-menu-item');
    const activeItem = mentionMenu.querySelector('.mention-menu-item.active');
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeItem) {
            const next = activeItem.nextElementSibling;
            if (next) {
                activeItem.classList.remove('active');
                next.classList.add('active');
                next.scrollIntoView({ block: 'nearest' });
            }
        } else if (items.length > 0) {
            items[0].classList.add('active');
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeItem) {
            const prev = activeItem.previousElementSibling;
            if (prev) {
                activeItem.classList.remove('active');
                prev.classList.add('active');
                prev.scrollIntoView({ block: 'nearest' });
            }
        }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (activeItem) {
            activeItem.click();
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideMentionMenu();
    }
}

// عرض قائمة الـ mention
function showMentionMenu(query = '') {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    let mentionMenu = document.getElementById('mentionMenu');
    
    if (!mentionMenu) {
        mentionMenu = document.createElement('div');
        mentionMenu.id = 'mentionMenu';
        mentionMenu.className = 'mention-menu';
        document.body.appendChild(mentionMenu);
    }
    
    // التأكد من وجود قائمة المستخدمين
    if (!allUsers || allUsers.length === 0) {
        mentionMenu.style.display = 'none';
        mentionMenuVisible = false;
        return;
    }
    
    // فلترة المستخدمين حسب الاستعلام
    const filteredUsers = allUsers.filter(user => {
        if (!user || !user.user_id) return false;
        if (user.user_id === currentUser.id) return false; // استبعاد المستخدم الحالي
        
        if (!query || query.trim() === '') return true;
        
        const name = (user.name || user.username || '').toLowerCase();
        const username = (user.username || user.user_id || '').toLowerCase();
        const searchQuery = query.toLowerCase().trim();
        
        return name.includes(searchQuery) || username.includes(searchQuery) || user.user_id.toLowerCase().includes(searchQuery);
    });
    
    if (filteredUsers.length === 0) {
        mentionMenu.style.display = 'none';
        mentionMenuVisible = false;
        return;
    }
    
    mentionMenu.innerHTML = '';
    
    filteredUsers.forEach(user => {
        const item = document.createElement('button');
        item.className = 'mention-menu-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'mention-avatar';
        avatar.textContent = getInitials(user.name || user.username || 'U');
        avatar.style.background = getAvatarColor(user.user_id);
        
        const info = document.createElement('div');
        info.className = 'mention-info';
        
        const name = document.createElement('div');
        name.className = 'mention-name';
        name.textContent = user.name || user.username || 'مستخدم';
        
        const username = document.createElement('div');
        username.className = 'mention-username';
        username.textContent = '@' + (user.username || user.user_id);
        
        info.appendChild(name);
        info.appendChild(username);
        
        item.appendChild(avatar);
        item.appendChild(info);
        
        item.onclick = () => {
            selectMention(user);
        };
        
        mentionMenu.appendChild(item);
    });
    
    // تحديد العنصر الأول
    const firstItem = mentionMenu.querySelector('.mention-menu-item');
    if (firstItem) {
        firstItem.classList.add('active');
    }
    
    // تحديد موضع القائمة
    positionMentionMenu(chatInput);
    mentionMenu.style.display = 'flex';
    mentionMenuVisible = true;
}

// تحديد موضع قائمة الـ mention
function positionMentionMenu(chatInput) {
    const mentionMenu = document.getElementById('mentionMenu');
    if (!mentionMenu || !chatInput) return;
    
    const inputRect = chatInput.getBoundingClientRect();
    const inputContainer = chatInput.closest('.chat-input-container') || chatInput.closest('.chat-footer');
    const containerRect = inputContainer ? inputContainer.getBoundingClientRect() : inputRect;
    
    // حساب الموضع فوق حقل الإدخال
    const menuHeight = mentionMenu.offsetHeight || 200; // ارتفاع تقريبي
    const spaceAbove = inputRect.top;
    const spaceBelow = window.innerHeight - inputRect.bottom;
    
    if (spaceAbove > menuHeight + 20) {
        // عرض القائمة فوق حقل الإدخال
        mentionMenu.style.bottom = `${window.innerHeight - inputRect.top + 10}px`;
        mentionMenu.style.top = 'auto';
    } else {
        // عرض القائمة تحت حقل الإدخال
        mentionMenu.style.top = `${inputRect.bottom + 10}px`;
        mentionMenu.style.bottom = 'auto';
    }
    
    mentionMenu.style.right = '20px';
    mentionMenu.style.left = 'auto';
    mentionMenu.style.maxWidth = '300px';
    mentionMenu.style.position = 'fixed';
    mentionMenu.style.zIndex = '10000';
}

// إخفاء قائمة الـ mention
function hideMentionMenu() {
    const mentionMenu = document.getElementById('mentionMenu');
    if (mentionMenu) {
        mentionMenu.style.display = 'none';
    }
    mentionMenuVisible = false;
    mentionStartPosition = -1;
}

// اختيار مستخدم من قائمة الـ mention
function selectMention(user) {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || mentionStartPosition === -1) return;
    
    const value = chatInput.value;
    const cursorPosition = chatInput.selectionStart;
    const textBefore = value.substring(0, mentionStartPosition);
    const textAfter = value.substring(cursorPosition);
    
    // إدراج الـ mention
    const mentionText = `@${user.name || user.username || user.user_id} `;
    chatInput.value = textBefore + mentionText + textAfter;
    
    // تحديث موضع المؤشر
    const newPosition = mentionStartPosition + mentionText.length;
    chatInput.setSelectionRange(newPosition, newPosition);
    chatInput.focus();
    
    hideMentionMenu();
}

// استخراج الـ mentions من النص
function extractMentions(text) {
    const mentions = [];
    if (!text || !allUsers || allUsers.length === 0) {
        return mentions;
    }
    
    const mentionRegex = /@([^\s@]+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionText = match[1];
        // البحث عن المستخدم في قائمة المستخدمين
        const user = allUsers.find(u => {
            const name = (u.name || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            const mentionLower = mentionText.toLowerCase();
            return name === mentionLower || username === mentionLower || u.user_id === mentionText;
        });
        
        if (user && user.user_id !== currentUser.id) {
            mentions.push({
                user_id: user.user_id,
                username: user.username || user.user_id,
                name: user.name || user.username || 'مستخدم'
            });
        }
    }
    
    // إزالة التكرار
    return mentions.filter((mention, index, self) => 
        index === self.findIndex(m => m.user_id === mention.user_id)
    );
}

// تحميل الإشعارات عند التهيئة
loadSavedNotifications();

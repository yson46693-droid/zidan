/**
 * ملف JavaScript للشات - نظام لايف مع إشعارات
 * يدعم Long Polling، إشعارات المتصفح، Web Push، نظام الرد المحسّن، وحالة النشاط
 */

// متغيرات عامة
let currentUser = null;
let messages = [];
let lastMessageId = '';
let longPollingActive = false;
let longPollingAbortController = null;
let replyingToMessageId = null;
let replyingToMessage = null; // حفظ معلومات الرسالة الأصلية
let notifications = [];
let pushSubscription = null;
let activityUpdateInterval = null;
let usersActivity = {};

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

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof checkLogin !== 'function') {
            showMessage('خطأ في تحميل ملفات المصادقة', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        
        const user = await checkLogin();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await initializeChat();
    } catch (error) {
        console.error('خطأ في تهيئة الشات:', error);
        showMessage('حدث خطأ في تحميل الشات: ' + (error.message || error), 'error');
    }
});

// تهيئة الشات
async function initializeChat() {
    try {
        showLoading(true);
        
        if (typeof API === 'undefined' || !API.request) {
            throw new Error('API غير متاح');
        }
        
        // تحديث معلومات المستخدم الحالي
        updateCurrentUserSection();
        
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
        
        showLoading(false);
    } catch (error) {
        console.error('خطأ في تهيئة الشات:', error);
        showMessage('حدث خطأ في تحميل الشات', 'error');
        showLoading(false);
    }
}

// تحميل الرسائل عند الدخول
async function loadMessages() {
    try {
        const result = await API.request('get_messages.php');
        
        if (result && result.success && result.data) {
            messages = result.data || [];
            
            // حفظ last_id
            if (messages.length > 0) {
                lastMessageId = messages[messages.length - 1].id;
            }
            
            renderMessages();
        }
    } catch (error) {
        console.error('خطأ في تحميل الرسائل:', error);
        showMessage('حدث خطأ في تحميل الرسائل', 'error');
    }
}

// عرض الرسائل
function renderMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
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
    avatar.textContent = getInitials(message.username || 'U');
    avatar.style.background = getAvatarColor(message.user_id);
    
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
    
    // Header (للمستخدمين الآخرين فقط)
    if (!isUserMessage) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = message.username || 'مستخدم';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTime(message.created_at);
        
        header.appendChild(sender);
        header.appendChild(time);
        content.appendChild(header);
    }
    
    // عرض الرسالة الأصلية إذا كان رد
    if (message.reply_to) {
        const replyPreview = document.createElement('div');
        replyPreview.className = 'message-reply-preview';
        replyPreview.onclick = () => scrollToMessage(message.reply_to.id);
        
        const replyIcon = document.createElement('span');
        replyIcon.className = 'reply-icon';
        replyIcon.textContent = '↩️';
        
        const replyInfo = document.createElement('div');
        replyInfo.className = 'reply-info';
        
        const replyUser = document.createElement('div');
        replyUser.className = 'reply-user';
        replyUser.textContent = message.reply_to.username || 'مستخدم';
        
        const replyText = document.createElement('div');
        replyText.className = 'reply-text';
        const replyMessage = message.reply_to.message || 'رسالة';
        replyText.textContent = replyMessage.length > 50 ? replyMessage.substring(0, 50) + '...' : replyMessage;
        
        replyInfo.appendChild(replyUser);
        replyInfo.appendChild(replyText);
        replyPreview.appendChild(replyIcon);
        replyPreview.appendChild(replyInfo);
        content.appendChild(replyPreview);
    }
    
    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.message;
    bubble.appendChild(text);
    
    // Time
    const timeContainer = document.createElement('div');
    timeContainer.className = 'message-time-container';
    
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(message.created_at);
    timeContainer.appendChild(time);
    
    if (isUserMessage) {
        bubble.appendChild(timeContainer);
    } else {
        const header = content.querySelector('.message-header');
        if (header) {
            header.appendChild(timeContainer);
        }
    }
    
    // زر الرد (لجميع الرسائل)
    const replyBtn = document.createElement('button');
    replyBtn.className = 'message-reply-btn';
    replyBtn.innerHTML = '↩️';
    replyBtn.title = 'رد';
    replyBtn.onclick = (e) => {
        e.stopPropagation();
        replyToMessage(message);
    };
    
    content.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messageDiv.appendChild(replyBtn);
    
    return messageDiv;
}

// إعداد Event Listeners
function setupEventListeners() {
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
    }
    
    // زر الإيموجي
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    // أيقونة الإشعارات
    const notificationIcon = document.getElementById('notificationIcon');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', toggleNotificationsList);
    }
    
    // زر الرجوع
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // محاولة الرجوع إلى الصفحة السابقة
                if (document.referrer && document.referrer !== window.location.href) {
                    window.history.back();
                } else if (window.history.length > 1) {
                    window.history.back();
                } else {
                    // إذا لم تكن هناك صفحة سابقة، الانتقال إلى لوحة التحكم
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                console.error('خطأ في الرجوع:', error);
                // Fallback: الانتقال إلى لوحة التحكم
                window.location.href = 'dashboard.html';
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
    
    // التحقق من طول الرسالة
    if (messageText.length > 1000) {
        showMessage('الرسالة طويلة جداً. الحد الأقصى 1000 حرف', 'error');
        return;
    }
    
    try {
        // إظهار الرسالة محلياً أولاً (optimistic update)
        const tempMessage = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            username: currentUser.name || currentUser.username,
            message: messageText,
            created_at: new Date().toISOString(),
            isSending: true,
            reply_to: replyingToMessage ? {
                id: replyingToMessage.id,
                username: replyingToMessage.username,
                message: replyingToMessage.message
            } : null
        };
        
        messages.push(tempMessage);
        renderMessages();
        chatInput.value = '';
        clearReplyPreview();
        
        // إرسال الرسالة للخادم
        const result = await API.request('send_message.php', 'POST', {
            message: messageText,
            reply_to: replyingToMessage ? {
                id: replyingToMessage.id,
                username: replyingToMessage.username,
                message: replyingToMessage.message
            } : null
        });
        
        if (result && result.success) {
            // استبدال الرسالة المؤقتة بالرسالة الحقيقية
            const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                messages[tempIndex] = result.data;
                lastMessageId = result.data.id;
                renderMessages();
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

// الرد على رسالة
function replyToMessage(message) {
    replyingToMessageId = message.id;
    replyingToMessage = {
        id: message.id,
        username: message.username || 'مستخدم',
        message: message.message || 'رسالة'
    };
    showReplyPreview(message);
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.focus();
    }
}

// إظهار معاينة الرد
function showReplyPreview(message) {
    const existingPreview = document.getElementById('replyPreview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    const preview = document.createElement('div');
    preview.id = 'replyPreview';
    preview.className = 'reply-preview';
    
    const previewContent = document.createElement('div');
    previewContent.className = 'reply-preview-content';
    
    const previewInfo = document.createElement('div');
    previewInfo.className = 'reply-preview-info';
    
    const previewUser = document.createElement('div');
    previewUser.className = 'reply-preview-user';
    previewUser.textContent = `رد على ${message.username || 'مستخدم'}`;
    
    const previewText = document.createElement('div');
    previewText.className = 'reply-preview-text';
    previewText.textContent = message.message || 'رسالة';
    
    previewInfo.appendChild(previewUser);
    previewInfo.appendChild(previewText);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'reply-preview-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = clearReplyPreview;
    
    previewContent.appendChild(previewInfo);
    previewContent.appendChild(closeBtn);
    preview.appendChild(previewContent);
    
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (chatInputContainer) {
        const chatInputWrapper = chatInputContainer.querySelector('.chat-input-wrapper');
        if (chatInputWrapper) {
            chatInputContainer.insertBefore(preview, chatInputWrapper);
        } else {
            chatInputContainer.insertBefore(preview, chatInputContainer.firstChild);
        }
    }
}

// إزالة معاينة الرد
function clearReplyPreview() {
    replyingToMessageId = null;
    replyingToMessage = null;
    const preview = document.getElementById('replyPreview');
    if (preview) {
        preview.remove();
    }
}

// Long Polling
function startLongPolling() {
    if (longPollingActive) return;
    
    longPollingActive = true;
    performLongPoll();
}

async function performLongPoll() {
    if (!longPollingActive) return;
    
    try {
        // إلغاء الطلب السابق إذا كان موجوداً
        if (longPollingAbortController) {
            longPollingAbortController.abort();
        }
        
        longPollingAbortController = new AbortController();
        
        const url = `api/listen.php?last_id=${lastMessageId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            signal: longPollingAbortController.signal
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result && result.success && result.data && result.data.length > 0) {
            // إضافة الرسائل الجديدة
            result.data.forEach(newMessage => {
                // تجنب التكرار
                if (!messages.find(m => m.id === newMessage.id)) {
                    messages.push(newMessage);
                    // تحديث lastMessageId إلى آخر رسالة
                    if (newMessage.id > lastMessageId || lastMessageId === '') {
                        lastMessageId = newMessage.id;
                    }
                }
            });
            
            // إعادة ترتيب الرسائل حسب id
            messages.sort((a, b) => {
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                return 0;
            });
            
            renderMessages();
            
            // عرض إشعار إذا كان التاب مخفي
            if (document.hidden) {
                result.data.forEach(message => {
                    if (message.user_id !== currentUser.id) {
                        showBrowserNotification(message);
                    }
                });
            }
        }
        
        // إعادة المحاولة فوراً
        if (longPollingActive) {
            performLongPoll();
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            return; // تم إلغاء الطلب
        }
        
        console.error('خطأ في Long Polling:', error);
        
        // إعادة المحاولة بعد 2 ثانية
        if (longPollingActive) {
            setTimeout(() => performLongPoll(), 2000);
        }
    }
}

function stopLongPolling() {
    longPollingActive = false;
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
            badge: '/icons/icon-72x72.png',
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
            timestamp: new Date().toISOString()
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

// حالة النشاط
async function startActivityUpdates() {
    // تحديث فوري
    await updateUsersActivity();
    
    // تحديث كل 30 ثانية
    activityUpdateInterval = setInterval(async () => {
        await updateUsersActivity();
    }, 30000);
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
        }
    } catch (error) {
        console.error('خطأ في تحديث حالة النشاط:', error);
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

// قائمة الإشعارات
function addNotification(notification) {
    notifications.unshift(notification);
    
    // حفظ في localStorage
    try {
        localStorage.setItem('chat_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {
        console.error('خطأ في حفظ الإشعارات:', e);
    }
    
    updateNotificationBadge();
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
    
    notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = 'notification-item';
        
        const content = document.createElement('div');
        content.className = 'notification-content';
        
        const username = document.createElement('div');
        username.className = 'notification-username';
        username.textContent = notification.username;
        
        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = notification.message;
        
        const time = document.createElement('div');
        time.className = 'notification-time';
        time.textContent = formatTime(notification.timestamp);
        
        content.appendChild(username);
        content.appendChild(message);
        content.appendChild(time);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'notification-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = () => deleteNotification(notification.id);
        
        item.appendChild(content);
        item.appendChild(deleteBtn);
        fragment.appendChild(item);
    });
    
    list.appendChild(fragment);
    updateNotificationBadge();
}

function deleteNotification(notificationId) {
    notifications = notifications.filter(n => n.id !== notificationId);
    
    try {
        localStorage.setItem('chat_notifications', JSON.stringify(notifications));
    } catch (e) {
        console.error('خطأ في حفظ الإشعارات:', e);
    }
    
    renderNotificationsList();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (notifications.length > 0) {
            badge.textContent = notifications.length > 99 ? '99+' : notifications.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

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
    
    // حفظ في usersActivity
    users.forEach(user => {
        usersActivity[user.user_id] = user;
    });
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
function cleanup() {
    stopLongPolling();
    
    if (activityUpdateInterval) {
        clearInterval(activityUpdateInterval);
    }
    
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
}

// منتقي الإيموجي (مبسط)
function toggleEmojiPicker() {
    // TODO: تنفيذ منتقي الإيموجي
    showMessage('ميزة الإيموجي قيد التطوير', 'info');
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
            notifications = JSON.parse(saved);
            updateNotificationBadge();
        }
    } catch (e) {
        console.error('خطأ في تحميل الإشعارات:', e);
    }
}

// تحميل الإشعارات عند التهيئة
loadSavedNotifications();

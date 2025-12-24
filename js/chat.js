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
let notifications = [];
let pushSubscription = null;
let activityUpdateInterval = null;
let usersActivity = {};
let allUsers = []; // قائمة جميع المستخدمين للـ mention
let mentionMenuVisible = false;
let mentionStartPosition = -1;

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
    
    if (message.avatar) {
        const avatarImg = document.createElement('img');
        avatarImg.src = message.avatar;
        avatarImg.alt = message.username || 'مستخدم';
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
    
    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // عرض الملف أو الصورة إذا كان موجوداً
    if (message.file_path || message.file_type) {
        const fileType = message.file_type || 'file';
        let filePath = message.file_path || '';
        
        // إذا كان المسار نسبي، إضافة المسار الأساسي
        if (filePath && !filePath.startsWith('http') && !filePath.startsWith('data:')) {
            if (!filePath.startsWith('/')) {
                filePath = '/' + filePath;
            }
        }
        
        if (fileType === 'image') {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-message';
            
            const img = document.createElement('img');
            img.src = filePath;
            img.alt = 'صورة';
            img.loading = 'lazy';
            img.onerror = () => {
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3Eفشل تحميل الصورة%3C/text%3E%3C/svg%3E';
            };
            
            imageContainer.appendChild(img);
            
            if (message.message && message.message.trim() && message.message !== '📷 صورة') {
                const caption = document.createElement('div');
                caption.className = 'image-caption';
                caption.textContent = message.message;
                imageContainer.appendChild(caption);
            }
            
            bubble.appendChild(imageContainer);
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
                
                // إعادة تشغيل Long Polling للتأكد من تحديث الرسائل للمستخدمين الآخرين
                if (longPollingActive) {
                    // إلغاء الطلب الحالي وإعادة التشغيل
                    if (longPollingAbortController) {
                        longPollingAbortController.abort();
                    }
                    // إعادة التشغيل بعد فترة قصيرة
                    setTimeout(() => {
                        if (longPollingActive) {
                            performLongPoll();
                        }
                    }, 500);
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
            let hasNewMessages = false;
            result.data.forEach(newMessage => {
                // تجنب التكرار (بما في ذلك الرسائل المؤقتة)
                const existingMessage = messages.find(m => m.id === newMessage.id || (m.id && m.id.startsWith('temp-') && newMessage.user_id === m.user_id && newMessage.message === m.message));
                
                if (!existingMessage) {
                    messages.push(newMessage);
                    hasNewMessages = true;
                    // تحديث lastMessageId إلى آخر رسالة
                    if (newMessage.id > lastMessageId || lastMessageId === '') {
                        lastMessageId = newMessage.id;
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
            }
            
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
            
            // تحديث حالة النشاط في الرسائل
            updateMessagesActivity();
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
                
                // قراءة الصورة كـ Base64
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const fileData = event.target.result;
                    await sendFileMessage(fileData, 'image', file.name);
                };
                reader.onerror = () => {
                    showMessage('حدث خطأ في قراءة الصورة', 'error');
                };
                reader.readAsDataURL(file);
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
                    
                    // قراءة الصورة كـ Base64
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const fileData = event.target.result;
                        await sendFileMessage(fileData, 'image', file.name || 'camera.jpg');
                    };
                    reader.onerror = () => {
                        showMessage('حدث خطأ في قراءة الصورة', 'error');
                    };
                    reader.readAsDataURL(file);
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
            notifications = JSON.parse(saved);
            updateNotificationBadge();
        }
    } catch (e) {
        console.error('خطأ في تحميل الإشعارات:', e);
    }
}

// تحميل الإشعارات عند التهيئة
loadSavedNotifications();

// معالجة إدخال @ للـ mention
function handleMentionInput(e) {
    const chatInput = e.target;
    const value = chatInput.value;
    const cursorPosition = chatInput.selectionStart;
    
    // البحث عن @ قبل موضع المؤشر
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
        // التحقق من أن @ ليس جزءاً من كلمة (يجب أن يكون بعد مسافة أو في البداية)
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
            const query = textBeforeCursor.substring(lastAtIndex + 1);
            // التحقق من أن الاستعلام لا يحتوي على مسافات (لم يكتمل الـ mention بعد)
            if (!query.includes(' ') && !query.includes('\n')) {
                mentionStartPosition = lastAtIndex;
                showMentionMenu(query);
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
    if (!mentionMenu) return;
    
    const inputRect = chatInput.getBoundingClientRect();
    const inputContainer = chatInput.closest('.chat-input-container');
    const containerRect = inputContainer ? inputContainer.getBoundingClientRect() : inputRect;
    
    mentionMenu.style.bottom = `${window.innerHeight - containerRect.top + 10}px`;
    mentionMenu.style.right = '20px';
    mentionMenu.style.left = 'auto';
    mentionMenu.style.maxWidth = '300px';
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

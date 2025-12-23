/**
 * ملف JavaScript للشات
 * يدعم جميع المميزات المطلوبة: محادثة جماعية، محادثة خاصة، ردود الفعل، إشعارات
 */

// متغيرات عامة
let currentUser = null;
let currentRoom = null;
let messages = [];
let participants = [];
let allUsers = [];
let messagePollingInterval = null;
let roomsPollingInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let emojiPickerVisible = false;
let editingMessageId = null;
let replyingToMessageId = null;

// منع التكبير بالضغط مرتين (Double-tap zoom) - إعدادات شاملة
(function() {
    let lastTouchEnd = 0;
    let lastTouchStart = 0;
    let touchCount = 0;
    
    // منع التكبير بالضغط مرتين
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        lastTouchEnd = now;
    }, { passive: false });
    
    // منع التكبير بالضغط المزدوج
    document.addEventListener('touchstart', function(event) {
        const now = Date.now();
        if (now - lastTouchStart < 300) {
            touchCount++;
            if (touchCount >= 2) {
                event.preventDefault();
                event.stopPropagation();
                touchCount = 0;
                return false;
            }
        } else {
            touchCount = 1;
        }
        lastTouchStart = now;
    }, { passive: false });
    
    // منع التكبير بالpinch gesture
    document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, { passive: false });
    
    document.addEventListener('gesturechange', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, { passive: false });
    
    document.addEventListener('gestureend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, { passive: false });
    
    // منع التكبير بالwheel
    let lastWheelTime = 0;
    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false });
    
    // منع التكبير بالkeyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false });
    
    // إعادة تعيين viewport scale عند تغيير الاتجاه
    window.addEventListener('orientationchange', function() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no');
        }
    });
    
    // منع التكبير عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no');
        }
        
        // إعادة تعيين scale كل ثانية كحماية إضافية
        setInterval(function() {
            if (window.visualViewport) {
                if (window.visualViewport.scale !== 1) {
                    window.visualViewport.scale = 1;
                }
            }
        }, 1000);
    });
})();

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // التحقق من تسجيل الدخول
        if (typeof checkLogin !== 'function') {
            console.error('دالة checkLogin غير موجودة');
            showMessage('خطأ في تحميل ملفات المصادقة', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        const user = await checkLogin();
        if (!user) {
            console.log('المستخدم غير مسجل دخول، التوجيه إلى صفحة تسجيل الدخول');
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await initializeChat();
    } catch (error) {
        console.error('خطأ في تهيئة الشات:', error);
        showMessage('حدث خطأ في تحميل الشات: ' + (error.message || error), 'error');
        
        // إظهار تفاصيل الخطأ في console للمطورين
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
});

// تهيئة الشات
async function initializeChat() {
    try {
        showLoading(true);
        
        // التحقق من وجود API
        if (typeof API === 'undefined' || !API.request) {
            throw new Error('API غير متاح. تأكد من تحميل js/api.js');
        }
        
        // تحديث معلومات المستخدم الحالي
        updateCurrentUserSection();
        
        // الحصول على أو إنشاء الغرفة الجماعية
        const groupRoomResult = await API.request('chat.php', 'POST', {
            action: 'get_or_create_group_room'
        });
        
        if (groupRoomResult && groupRoomResult.success) {
            currentRoom = groupRoomResult.data;
            await loadRoomData();
        } else {
            throw new Error(groupRoomResult?.message || 'فشل في الحصول على الغرفة الجماعية');
        }
        
        // تحميل قائمة المستخدمين
        await loadUsers();
        
        // إعداد Event Listeners
        setupEventListeners();
        
        // بدء استطلاع الرسائل
        startMessagePolling();
        
        // بدء استطلاع الإشعارات
        startRoomsPolling();
        
        showLoading(false);
    } catch (error) {
        console.error('خطأ في تهيئة الشات:', error);
        showMessage('حدث خطأ في تحميل الشات: ' + (error.message || error), 'error');
        showLoading(false);
        
        // إظهار تفاصيل الخطأ في console
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// تحميل بيانات الغرفة
async function loadRoomData() {
    if (!currentRoom) return;
    
    try {
        // تحميل الرسائل
        await loadMessages();
        
        // تحميل المشاركين
        await loadParticipants();
        
        // تحديث العنوان إذا كانت محادثة خاصة
        if (currentRoom.type === 'private' && currentRoom.other_user) {
            updateHeaderForPrivateChat(currentRoom.other_user);
        } else {
            updateHeaderForGroupChat();
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات الغرفة:', error);
    }
}

// تحميل الرسائل
async function loadMessages() {
    if (!currentRoom) return;
    
    try {
        const result = await API.request(`chat.php?action=messages&room_id=${currentRoom.id}`);
        
        if (result && result.success) {
            messages = result.data || [];
            renderMessages();
        }
    } catch (error) {
        console.error('خطأ في تحميل الرسائل:', error);
    }
}

// تحميل المشاركين
async function loadParticipants() {
    if (!currentRoom) return;
    
    try {
        // المشاركون موجودون في currentRoom.participants
        if (currentRoom.participants) {
            participants = currentRoom.participants;
            renderParticipants();
        }
    } catch (error) {
        console.error('خطأ في تحميل المشاركين:', error);
    }
}

// تحميل قائمة المستخدمين
async function loadUsers() {
    try {
        const result = await API.request('chat.php?action=users');
        
        if (result && result.success) {
            allUsers = result.data || [];
            renderUsers();
        }
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
    }
}

// عرض الرسائل
function renderMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // مسح الرسائل القديمة
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-messages">لا توجد رسائل بعد</div>';
        return;
    }
    
    // إنشاء DocumentFragment للأداء
    const fragment = document.createDocumentFragment();
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        fragment.appendChild(messageElement);
    });
    
    messagesContainer.appendChild(fragment);
    
    // التمرير للأسفل
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
    avatar.textContent = getInitials(message.user_name || message.username || 'U');
    avatar.style.background = getAvatarColor(message.user_id);
    
    // Content
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Header
    if (!isUserMessage) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = message.user_name || message.username || 'مستخدم';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTime(message.created_at);
        
        header.appendChild(sender);
        header.appendChild(time);
        content.appendChild(header);
    }
    
    // عرض الرد إذا كان موجوداً
    if (message.reply_to_id) {
        const replyPreview = document.createElement('div');
        replyPreview.className = 'message-reply-preview';
        replyPreview.onclick = () => scrollToMessage(message.reply_to_id);
        
        const replyIcon = document.createElement('span');
        replyIcon.className = 'reply-icon';
        replyIcon.textContent = '↩️';
        
        const replyInfo = document.createElement('div');
        replyInfo.className = 'reply-info';
        
        const replyUser = document.createElement('div');
        replyUser.className = 'reply-user';
        replyUser.textContent = message.reply_to_user_name || 'مستخدم';
        
        const replyText = document.createElement('div');
        replyText.className = 'reply-text';
        if (message.reply_to_type === 'audio') {
            replyText.textContent = '🎤 رسالة صوتية';
        } else if (message.reply_to_type === 'file') {
            replyText.textContent = '📎 ' + (message.reply_to_message || 'ملف');
        } else if (message.reply_to_type === 'location') {
            replyText.textContent = '📍 موقع';
        } else if (message.reply_to_type === 'image') {
            replyText.textContent = '🖼️ صورة';
        } else {
            replyText.textContent = message.reply_to_message || 'رسالة';
        }
        
        replyInfo.appendChild(replyUser);
        replyInfo.appendChild(replyText);
        replyPreview.appendChild(replyIcon);
        replyPreview.appendChild(replyInfo);
        content.appendChild(replyPreview);
    }
    
    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // عرض المحتوى حسب نوع الرسالة
    if (message.message_type === 'audio' && message.file_url) {
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-message';
        
        const audioLabel = document.createElement('div');
        audioLabel.className = 'audio-label';
        audioLabel.textContent = '🎤 رسالة صوتية';
        audioLabel.style.cssText = 'font-size: 12px; margin-bottom: 5px; opacity: 0.8;';
        
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'metadata';
        // التأكد من المسار الصحيح
        const audioUrl = message.file_url.startsWith('http') ? message.file_url : 
                        (message.file_url.startsWith('/') ? message.file_url : '/' + message.file_url);
        audio.src = audioUrl;
        audio.style.cssText = 'width: 100%; max-width: 300px; outline: none;';
        
        // معالجة الأخطاء
        audio.onerror = function() {
            console.error('خطأ في تحميل الملف الصوتي:', audioUrl);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'audio-error';
            errorMsg.textContent = '❌ فشل تحميل الملف الصوتي';
            errorMsg.style.cssText = 'color: var(--danger-color); font-size: 12px; margin-top: 5px;';
            audioContainer.appendChild(errorMsg);
        };
        
        audioContainer.appendChild(audioLabel);
        audioContainer.appendChild(audio);
        bubble.appendChild(audioContainer);
        
        if (message.message && message.message !== 'رسالة صوتية') {
            const text = document.createElement('p');
            text.className = 'message-text';
            text.textContent = message.message;
            bubble.appendChild(text);
        }
    } else if (message.message_type === 'image' && message.file_url) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-message';
        
        const img = document.createElement('img');
        img.src = message.file_url.startsWith('http') ? message.file_url : 
                 (message.file_url.startsWith('/') ? message.file_url : '/' + message.file_url);
        img.alt = message.message || 'صورة';
        img.loading = 'lazy';
        img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer;';
        img.onclick = () => {
            // فتح الصورة في نافذة جديدة
            const imageWindow = window.open('', '_blank');
            if (imageWindow) {
                imageWindow.document.write(`
                    <html>
                        <head><title>${message.message || 'صورة'}</title></head>
                        <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background:#000;">
                            <img src="${img.src}" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </body>
                    </html>
                `);
            }
        };
        
        imageContainer.appendChild(img);
        if (message.message && !message.message.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const caption = document.createElement('p');
            caption.className = 'image-caption';
            caption.textContent = message.message;
            caption.style.cssText = 'margin-top: 8px; font-size: 12px; color: inherit; opacity: 0.8;';
            imageContainer.appendChild(caption);
        }
        bubble.appendChild(imageContainer);
    } else if (message.message_type === 'location' && message.location_data) {
        const locationContainer = document.createElement('div');
        locationContainer.className = 'location-message';
        
        const locationData = typeof message.location_data === 'string' 
            ? JSON.parse(message.location_data) 
            : message.location_data;
        
        const latitude = locationData.latitude;
        const longitude = locationData.longitude;
        const address = locationData.address || message.message || '';
        
        // رابط الخريطة
        const mapLink = document.createElement('a');
        mapLink.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
        mapLink.target = '_blank';
        mapLink.className = 'location-link';
        mapLink.style.cssText = 'display: block; text-decoration: none; color: inherit;';
        
        // صورة الخريطة (استخدام OpenStreetMap)
        const mapImage = document.createElement('img');
        mapImage.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=400x300&markers=${latitude},${longitude},red-pushpin`;
        mapImage.alt = 'موقع';
        mapImage.loading = 'lazy';
        mapImage.style.cssText = 'width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 8px; cursor: pointer;';
        mapImage.onerror = function() {
            // استخدام صورة بديلة بسيطة
            this.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.style.cssText = 'width: 100%; max-width: 300px; height: 200px; background: var(--light-bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 48px;';
            fallback.textContent = '📍';
            locationContainer.insertBefore(fallback, locationInfo);
        };
        
        const locationInfo = document.createElement('div');
        locationInfo.className = 'location-info';
        locationInfo.style.cssText = 'padding: 10px;';
        
        const locationIcon = document.createElement('div');
        locationIcon.style.cssText = 'font-size: 20px; margin-bottom: 5px;';
        locationIcon.textContent = '📍';
        
        const locationText = document.createElement('div');
        locationText.className = 'location-text';
        locationText.style.cssText = 'font-size: 14px; font-weight: 600; margin-bottom: 3px;';
        locationText.textContent = address || 'موقع';
        
        const locationCoords = document.createElement('div');
        locationCoords.className = 'location-coords';
        locationCoords.style.cssText = 'font-size: 12px; opacity: 0.7;';
        locationCoords.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        locationInfo.appendChild(locationIcon);
        locationInfo.appendChild(locationText);
        locationInfo.appendChild(locationCoords);
        
        mapLink.appendChild(mapImage);
        mapLink.appendChild(locationInfo);
        locationContainer.appendChild(mapLink);
        bubble.appendChild(locationContainer);
    } else if (message.message_type === 'file' && message.file_url) {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-message';
        
        const fileLink = document.createElement('a');
        fileLink.href = message.file_url;
        fileLink.target = '_blank';
        fileLink.download = message.message || 'ملف';
        fileLink.className = 'file-link';
        fileLink.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px; text-decoration: none; color: inherit;';
        
        const fileIcon = document.createElement('span');
        fileIcon.textContent = '📎';
        fileIcon.style.cssText = 'font-size: 20px;';
        
        const fileName = document.createElement('span');
        fileName.textContent = message.message || 'ملف';
        fileName.style.cssText = 'font-weight: 600;';
        
        fileLink.appendChild(fileIcon);
        fileLink.appendChild(fileName);
        fileContainer.appendChild(fileLink);
        bubble.appendChild(fileContainer);
    } else {
        const text = document.createElement('p');
        text.className = 'message-text';
        text.textContent = message.message;
        bubble.appendChild(text);
    }
    
    // Time and edit indicator
    const timeContainer = document.createElement('div');
    timeContainer.className = 'message-time-container';
    
    const time = document.createElement('span');
    time.className = 'message-time';
    time.style.cssText = isUserMessage ? 'font-size: 11px; color: rgba(255,255,255,0.8);' : 'font-size: 11px; color: var(--text-light);';
    time.textContent = formatTime(message.created_at);
    
    if (message.edited_at) {
        const editedLabel = document.createElement('span');
        editedLabel.className = 'edited-label';
        editedLabel.textContent = ' (تم التعديل)';
        editedLabel.style.cssText = 'font-size: 10px; opacity: 0.7;';
        time.appendChild(editedLabel);
    }
    
    timeContainer.appendChild(time);
    
    if (isUserMessage) {
        bubble.appendChild(timeContainer);
    } else {
        const header = content.querySelector('.message-header');
        if (header) {
            header.appendChild(timeContainer);
        }
    }
    
    // أزرار التعديل والحذف (للمستخدم فقط)
    if (isUserMessage) {
        const actionsMenu = document.createElement('div');
        actionsMenu.className = 'message-actions';
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'message-menu-btn';
        menuBtn.innerHTML = '⋮';
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            showMessageMenu(message.id, menuBtn);
        };
        
        actionsMenu.appendChild(menuBtn);
        messageDiv.appendChild(actionsMenu);
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
    messageDiv.appendChild(replyBtn);
    
    content.appendChild(bubble);
    
    // Reactions
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        
        Object.entries(message.reactions).forEach(([type, data]) => {
            const reactionItem = document.createElement('div');
            reactionItem.className = 'reaction-item';
            reactionItem.dataset.messageId = message.id;
            reactionItem.dataset.reactionType = type;
            reactionItem.onclick = () => toggleReaction(message.id, type);
            
            const icon = document.createElement('span');
            icon.className = 'reaction-icon';
            icon.textContent = getReactionIcon(type);
            
            const count = document.createElement('span');
            count.className = 'reaction-count';
            count.textContent = data.count;
            
            reactionItem.appendChild(icon);
            reactionItem.appendChild(count);
            reactionsDiv.appendChild(reactionItem);
        });
        
        content.appendChild(reactionsDiv);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    return messageDiv;
}

// عرض المشاركين
function renderParticipants() {
    const participantsList = document.getElementById('participantsList');
    if (!participantsList) return;
    
    participantsList.innerHTML = '';
    
    if (participants.length === 0) {
        participantsList.innerHTML = '<div class="empty-participants">لا يوجد مشاركون</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    participants.forEach(participant => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = getInitials(participant.name || participant.username || 'U');
        avatar.style.background = getAvatarColor(participant.id);
        
        const info = document.createElement('div');
        info.className = 'participant-info';
        
        const name = document.createElement('div');
        name.className = 'participant-name';
        name.textContent = participant.name || participant.username || 'مستخدم';
        
        info.appendChild(name);
        
        item.appendChild(avatar);
        item.appendChild(info);
        
        // إشعارات
        if (participant.unread_count > 0) {
            const notification = document.createElement('div');
            notification.className = 'participant-notification';
            notification.textContent = participant.unread_count > 99 ? '99+' : participant.unread_count;
            item.appendChild(notification);
        }
        
        fragment.appendChild(item);
    });
    
    participantsList.appendChild(fragment);
}

// عرض المستخدمين
function renderUsers() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    if (allUsers.length === 0) {
        usersList.innerHTML = '<div class="empty-users">لا يوجد مستخدمون</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    allUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.onclick = () => openPrivateChat(user);
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = getInitials(user.name || user.username || 'U');
        avatar.style.background = getAvatarColor(user.id);
        
        const info = document.createElement('div');
        info.className = 'user-info';
        
        const name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = user.name || user.username || 'مستخدم';
        
        info.appendChild(name);
        
        item.appendChild(avatar);
        item.appendChild(info);
        
        fragment.appendChild(item);
    });
    
    usersList.appendChild(fragment);
}

// تحديث قسم المستخدم الحالي
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

// إعداد Event Listeners
function setupEventListeners() {
    // زر القائمة
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', toggleParticipantsSidebar);
    }
    
    // زر إغلاق قائمة المشاركين
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', toggleParticipantsSidebar);
    }
    
    // زر الشات (للمستخدمين)
    const chatIconBtn = document.getElementById('chatIconBtn');
    if (chatIconBtn) {
        chatIconBtn.addEventListener('click', toggleUsersSidebar);
    }
    
    // زر الرجوع
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            // العودة للمحادثة الجماعية
            if (currentRoom && currentRoom.type === 'private') {
                try {
                    // إعادة تحميل المحادثة الجماعية
                    const groupRoomResult = await API.request('chat.php', 'POST', {
                        action: 'get_or_create_group_room'
                    });
                    
                    if (groupRoomResult && groupRoomResult.success) {
                        currentRoom = groupRoomResult.data;
                        await loadRoomData();
                    }
                } catch (error) {
                    console.error('خطأ في العودة للمحادثة الجماعية:', error);
                    showMessage('حدث خطأ في العودة للمحادثة الجماعية', 'error');
                }
            }
        });
    }
    
    // زر العودة للوحة التحكم
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
    
    // زر إغلاق قائمة المستخدمين
    const closeUsersSidebarBtn = document.getElementById('closeUsersSidebarBtn');
    if (closeUsersSidebarBtn) {
        closeUsersSidebarBtn.addEventListener('click', toggleUsersSidebar);
    }
    
    // Overlay
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeAllSidebars();
        });
    }
    
    // إرسال الرسالة
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
        
        // Debounce للبحث
        let inputTimeout;
        chatInput.addEventListener('input', () => {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                // يمكن إضافة وظيفة بحث هنا
            }, 300);
        });
        
        // إدارة ظهور لوحة المفاتيح
        setupKeyboardHandling(chatInput);
    }
    
    // أزرار الإدخال
    const emojiBtn = document.getElementById('emojiBtn');
    const micBtn = document.getElementById('micBtn');
    const attachBtn = document.getElementById('attachBtn');
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }
    
    if (micBtn) {
        micBtn.addEventListener('click', toggleVoiceRecording);
    }
    
    if (attachBtn) {
        attachBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAttachMenu();
        });
    }
    
    // أزرار قائمة المرفقات
    const cameraBtn = document.getElementById('cameraBtn');
    const galleryBtn = document.getElementById('galleryBtn');
    const locationBtn = document.getElementById('locationBtn');
    const fileBtn = document.getElementById('fileBtn');
    
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            closeAttachMenu();
            openCamera();
        });
    }
    
    if (galleryBtn) {
        galleryBtn.addEventListener('click', () => {
            closeAttachMenu();
            openGallery();
        });
    }
    
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            closeAttachMenu();
            sendLocation();
        });
    }
    
    if (fileBtn) {
        fileBtn.addEventListener('click', () => {
            closeAttachMenu();
            openFilePicker();
        });
    }
    
    // إغلاق قائمة المرفقات عند النقر خارجها
    document.addEventListener('click', (e) => {
        const attachMenu = document.getElementById('attachMenu');
        if (attachMenu && !attachMenu.contains(e.target) && !attachBtn.contains(e.target)) {
            closeAttachMenu();
        }
    });
    
    // أزرار الكاميرا
    const cameraCloseBtn = document.getElementById('cameraCloseBtn');
    const cameraCaptureBtn = document.getElementById('cameraCaptureBtn');
    const cameraFlipBtn = document.getElementById('cameraFlipBtn');
    
    if (cameraCloseBtn) {
        cameraCloseBtn.addEventListener('click', closeCamera);
    }
    
    if (cameraCaptureBtn) {
        cameraCaptureBtn.addEventListener('click', capturePhoto);
    }
    
    if (cameraFlipBtn) {
        cameraFlipBtn.addEventListener('click', flipCamera);
    }
    
    // إغلاق منتقي الإيموجي عند النقر خارجها
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker && !emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
            closeEmojiPicker();
        }
    });
}

// إرسال رسالة
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !currentRoom) return;
    
    // إذا كان في وضع التعديل
    if (editingMessageId) {
        await editMessage(editingMessageId, chatInput.value.trim());
        return;
    }
    
    const messageText = chatInput.value.trim();
    if (!messageText && !replyingToMessageId) return;
    
    try {
        // إظهار مؤشر الإرسال
        const sendingIndicator = showSendingIndicator(messageText, 'text');
        
        // إظهار الرسالة محلياً أولاً
        const tempMessage = {
            id: 'temp-' + Date.now(),
            room_id: currentRoom.id,
            user_id: currentUser.id,
            message: messageText,
            message_type: 'text',
            user_name: currentUser.name || currentUser.username,
            username: currentUser.username,
            created_at: new Date().toISOString(),
            reactions: {},
            isSending: true
        };
        
        messages.push(tempMessage);
        renderMessages();
        chatInput.value = '';
        clearReplyPreview();
        
        try {
            // إرسال الرسالة للخادم
            const result = await API.request('chat.php', 'POST', {
                action: 'send_message',
                room_id: currentRoom.id,
                message: messageText,
                message_type: 'text',
                reply_to: replyingToMessageId || null
            });
            
            // إزالة مؤشر الإرسال
            hideSendingIndicator(sendingIndicator);
            
            if (result && result.success) {
                // استبدال الرسالة المؤقتة بالرسالة الحقيقية
                const tempIndex = messages.findIndex(m => m.id === tempMessage.id);
                if (tempIndex !== -1) {
                    messages[tempIndex] = result.data;
                    renderMessages();
                }
            } else {
                // إزالة الرسالة المؤقتة في حالة الفشل
                messages = messages.filter(m => m.id !== tempMessage.id);
                renderMessages();
                showMessage('فشل إرسال الرسالة', 'error');
            }
        } catch (error) {
            hideSendingIndicator(sendingIndicator);
            // إزالة الرسالة المؤقتة
            messages = messages.filter(m => m.id !== tempMessage.id);
            renderMessages();
            console.error('خطأ في إرسال الرسالة:', error);
            showMessage('حدث خطأ في إرسال الرسالة', 'error');
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

// تبديل رد الفعل
async function toggleReaction(messageId, reactionType) {
    try {
        const result = await API.request('chat.php', 'POST', {
            action: 'add_reaction',
            message_id: messageId,
            reaction_type: reactionType
        });
        
        if (result && result.success) {
            // إعادة تحميل الرسائل لتحديث ردود الفعل
            await loadMessages();
        }
    } catch (error) {
        console.error('خطأ في تبديل رد الفعل:', error);
    }
}

// فتح محادثة خاصة
async function openPrivateChat(user) {
    try {
        showLoading(true);
        closeAllSidebars();
        
        const result = await API.request('chat.php', 'POST', {
            action: 'get_or_create_private_room',
            user_id: user.id
        });
        
        if (result && result.success) {
            currentRoom = result.data;
            await loadRoomData();
        }
        
        showLoading(false);
    } catch (error) {
        console.error('خطأ في فتح المحادثة الخاصة:', error);
        showMessage('حدث خطأ في فتح المحادثة', 'error');
        showLoading(false);
    }
}

// تحديث العنوان للمحادثة الخاصة
function updateHeaderForPrivateChat(otherUser) {
    const chatTitle = document.querySelector('.chat-title');
    const menuBtn = document.getElementById('menuBtn');
    const backBtn = document.getElementById('backBtn');
    
    if (chatTitle) {
        chatTitle.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                <div class="message-avatar" style="width: 32px; height: 32px; font-size: 14px;">
                    ${getInitials(otherUser.name || otherUser.username || 'U')}
                </div>
                <span>${otherUser.name || otherUser.username || 'مستخدم'}</span>
            </div>
        `;
    }
    
    if (menuBtn) menuBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = 'flex';
}

// تحديث العنوان للمحادثة الجماعية
function updateHeaderForGroupChat() {
    const chatTitle = document.querySelector('.chat-title');
    const menuBtn = document.getElementById('menuBtn');
    const backBtn = document.getElementById('backBtn');
    
    if (chatTitle) {
        chatTitle.textContent = 'Quickchat';
    }
    
    if (menuBtn) menuBtn.style.display = 'flex';
    if (backBtn) backBtn.style.display = 'none';
}

// تبديل قائمة المشاركين
function toggleParticipantsSidebar() {
    const sidebar = document.getElementById('participantsSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains('open');
        
        if (isOpen) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        } else {
            closeAllSidebars();
            sidebar.classList.add('open');
            overlay.classList.add('active');
        }
    }
}

// تبديل قائمة المستخدمين
function toggleUsersSidebar() {
    const sidebar = document.getElementById('usersSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains('open');
        
        if (isOpen) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        } else {
            closeAllSidebars();
            sidebar.classList.add('open');
            overlay.classList.add('active');
        }
    }
}

// إغلاق جميع القوائم الجانبية
function closeAllSidebars() {
    const participantsSidebar = document.getElementById('participantsSidebar');
    const usersSidebar = document.getElementById('usersSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (participantsSidebar) participantsSidebar.classList.remove('open');
    if (usersSidebar) usersSidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// بدء استطلاع الرسائل
function startMessagePolling() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    
    messagePollingInterval = setInterval(async () => {
        if (currentRoom) {
            await loadMessages();
        }
    }, 3000); // كل 3 ثوان
}

// بدء استطلاع الإشعارات
function startRoomsPolling() {
    if (roomsPollingInterval) {
        clearInterval(roomsPollingInterval);
    }
    
    roomsPollingInterval = setInterval(async () => {
        try {
            const result = await API.request('chat.php');
            
            if (result && result.success && result.data) {
                // حساب إجمالي الإشعارات غير المقروءة
                let totalUnread = 0;
                result.data.forEach(room => {
                    const participant = room.participants?.find(p => p.user_id === currentUser.id);
                    if (participant && participant.unread_count) {
                        totalUnread += participant.unread_count;
                    }
                });
                
                // تحديث شارة الإشعارات
                updateNotificationBadge(totalUnread);
            }
        } catch (error) {
            console.error('خطأ في استطلاع الإشعارات:', error);
        }
    }, 5000); // كل 5 ثوان
}

// تحديث شارة الإشعارات
function updateNotificationBadge(count) {
    const badge = document.getElementById('menuNotificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// التمرير للأسفل
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // إذا كانت الرسالة من اليوم
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    }
    
    // إذا كانت من الأمس
    if (diff < 172800000) {
        return 'أمس';
    }
    
    // تاريخ كامل
    return date.toLocaleDateString('ar');
}

function getReactionIcon(type) {
    const icons = {
        'like': '👍',
        'dislike': '👎',
        'love': '❤️',
        'laugh': '😂',
        'wow': '😮',
        'sad': '😢',
        'angry': '😠'
    };
    
    return icons[type] || '👍';
}

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showMessage(message, type = 'info') {
    // استخدام دالة showMessage من utils.js إذا كانت موجودة
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, type);
    } else {
        alert(message);
    }
}

async function handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        if (typeof logout === 'function') {
            await logout();
        } else {
            window.location.href = 'index.html';
        }
    }
}

// منتقي الإيموجي
function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker) {
        createEmojiPicker();
        return;
    }
    
    if (emojiPickerVisible) {
        closeEmojiPicker();
    } else {
        showEmojiPicker();
    }
}

function createEmojiPicker() {
    const emojiPicker = document.createElement('div');
    emojiPicker.id = 'emojiPicker';
    emojiPicker.className = 'emoji-picker';
    
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
        '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
        '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
        '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
        '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
        '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
        '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
        '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐', '✋',
        '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️'
    ];
    
    const emojiGrid = document.createElement('div');
    emojiGrid.className = 'emoji-grid';
    
    emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-item';
        emojiBtn.textContent = emoji;
        emojiBtn.type = 'button';
        emojiBtn.onclick = () => insertEmoji(emoji);
        emojiGrid.appendChild(emojiBtn);
    });
    
    emojiPicker.appendChild(emojiGrid);
    document.body.appendChild(emojiPicker);
    showEmojiPicker();
}

function showEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.getElementById('emojiBtn');
    if (!emojiPicker || !emojiBtn) return;
    
    const btnRect = emojiBtn.getBoundingClientRect();
    emojiPicker.style.display = 'block';
    emojiPicker.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
    emojiPicker.style.right = `${window.innerWidth - btnRect.right}px`;
    emojiPickerVisible = true;
}

function closeEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) {
        emojiPicker.style.display = 'none';
        emojiPickerVisible = false;
    }
}

function insertEmoji(emoji) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        const cursorPos = chatInput.selectionStart || chatInput.value.length;
        const textBefore = chatInput.value.substring(0, cursorPos);
        const textAfter = chatInput.value.substring(cursorPos);
        chatInput.value = textBefore + emoji + textAfter;
        chatInput.focus();
        chatInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }
    closeEmojiPicker();
}

// تسجيل الصوت
async function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await sendAudioMessage(audioBlob);
            
            // إيقاف جميع المسارات
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.add('recording');
            micBtn.title = 'إيقاف التسجيل';
        }
        
        showMessage('بدء التسجيل الصوتي...', 'info');
    } catch (error) {
        console.error('خطأ في بدء التسجيل الصوتي:', error);
        showMessage('فشل في الوصول للميكروفون. تأكد من السماح بالوصول للميكروفون.', 'error');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.title = 'تسجيل صوتي';
        }
        
        showMessage('تم إيقاف التسجيل. جاري إرسال الرسالة الصوتية...', 'info');
    }
}

async function sendAudioMessage(audioBlob) {
    if (!currentRoom) return;
    
    try {
        // إظهار مؤشر الإرسال
        const sendingIndicator = showSendingIndicator('رسالة صوتية', 'audio');
        
        // تحويل الصوت إلى Base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result;
                
                const result = await API.request('chat.php', 'POST', {
                    action: 'send_message',
                    room_id: currentRoom.id,
                    message: '',
                    message_type: 'audio',
                    audio_data: base64Audio
                });
                
                // إزالة مؤشر الإرسال
                hideSendingIndicator(sendingIndicator);
                
                if (result && result.success) {
                    showMessage('تم إرسال الرسالة الصوتية بنجاح', 'success');
                    await loadMessages();
                } else {
                    showMessage('فشل إرسال الرسالة الصوتية', 'error');
                }
            } catch (error) {
                hideSendingIndicator(sendingIndicator);
                console.error('خطأ في إرسال الرسالة الصوتية:', error);
                showMessage('حدث خطأ في إرسال الرسالة الصوتية', 'error');
            }
        };
        
        reader.onerror = () => {
            hideSendingIndicator(sendingIndicator);
            showMessage('حدث خطأ في قراءة الملف الصوتي', 'error');
        };
        
        reader.readAsDataURL(audioBlob);
    } catch (error) {
        console.error('خطأ في إرسال الرسالة الصوتية:', error);
        showMessage('حدث خطأ في إرسال الرسالة الصوتية', 'error');
    }
}

// المرفقات
async function handleFileAttachment(file) {
    if (!currentRoom) return;
    
    try {
        // التحقق من حجم الملف (حد أقصى 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showMessage('حجم الملف كبير جداً. الحد الأقصى 10MB', 'error');
            return;
        }
        
        // تحديد نوع الرسالة
        const isImage = file.type.startsWith('image/');
        const messageType = isImage ? 'image' : 'file';
        
        // إظهار مؤشر الإرسال
        const sendingIndicator = showSendingIndicator(file.name, messageType);
        
        // قراءة الملف كـ Base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64File = reader.result;
                const fileType = file.type || 'application/octet-stream';
                const fileName = file.name;
                
                const result = await API.request('chat.php', 'POST', {
                    action: 'send_message',
                    room_id: currentRoom.id,
                    message: fileName,
                    message_type: messageType,
                    file_data: base64File,
                    file_name: fileName,
                    file_type: fileType,
                    file_size: file.size
                });
                
                // إزالة مؤشر الإرسال
                hideSendingIndicator(sendingIndicator);
                
                if (result && result.success) {
                    showMessage(isImage ? 'تم إرسال الصورة بنجاح' : 'تم إرسال الملف بنجاح', 'success');
                    await loadMessages();
                } else {
                    showMessage(isImage ? 'فشل إرسال الصورة' : 'فشل إرسال الملف', 'error');
                }
            } catch (error) {
                hideSendingIndicator(sendingIndicator);
                console.error('خطأ في إرسال الملف:', error);
                showMessage('حدث خطأ في إرسال الملف', 'error');
            }
        };
        
        reader.onerror = () => {
            hideSendingIndicator(sendingIndicator);
            showMessage('حدث خطأ في قراءة الملف', 'error');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('خطأ في إرسال الملف:', error);
        showMessage('حدث خطأ في إرسال الملف', 'error');
    }
}

// عرض قائمة الرسالة (تعديل/حذف)
function showMessageMenu(messageId, button) {
    // إزالة القوائم الأخرى
    const existingMenu = document.querySelector('.message-menu-popup');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const menu = document.createElement('div');
    menu.className = 'message-menu-popup';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'menu-item';
    editBtn.innerHTML = '✏️ تعديل';
    editBtn.onclick = () => {
        startEditingMessage(messageId);
        menu.remove();
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'menu-item delete';
    deleteBtn.innerHTML = '🗑️ حذف';
    deleteBtn.onclick = () => {
        if (confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
            deleteMessage(messageId);
        }
        menu.remove();
    };
    
    menu.appendChild(editBtn);
    menu.appendChild(deleteBtn);
    
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    
    document.body.appendChild(menu);
    
    // إغلاق القائمة عند النقر خارجها
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== button) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// بدء تعديل رسالة
function startEditingMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    editingMessageId = messageId;
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message.message;
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
        
        // تغيير زر الإرسال
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.innerHTML = '✓';
            sendBtn.title = 'حفظ التعديل';
        }
    }
    
    // إظهار معاينة التعديل
    showEditPreview(message);
}

// تعديل رسالة
async function editMessage(messageId, newMessage) {
    if (!newMessage || !newMessage.trim()) {
        showMessage('الرسالة لا يمكن أن تكون فارغة', 'error');
        return;
    }
    
    try {
        const result = await API.request('chat.php', 'POST', {
            action: 'edit_message',
            message_id: messageId,
            message: newMessage.trim()
        });
        
        if (result && result.success) {
            // تحديث الرسالة في القائمة
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages[index] = result.data;
                renderMessages();
            }
            
            // إعادة تعيين حالة التعديل
            cancelEditing();
            showMessage('تم تعديل الرسالة بنجاح', 'success');
        } else {
            showMessage('فشل تعديل الرسالة', 'error');
        }
    } catch (error) {
        console.error('خطأ في تعديل الرسالة:', error);
        showMessage('حدث خطأ في تعديل الرسالة', 'error');
    }
}

// حذف رسالة
async function deleteMessage(messageId) {
    try {
        const result = await API.request('chat.php', 'POST', {
            action: 'delete_message',
            message_id: messageId
        });
        
        if (result && result.success) {
            // إزالة الرسالة من القائمة
            messages = messages.filter(m => m.id !== messageId);
            renderMessages();
            showMessage('تم حذف الرسالة بنجاح', 'success');
        } else {
            showMessage('فشل حذف الرسالة', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف الرسالة:', error);
        showMessage('حدث خطأ في حذف الرسالة', 'error');
    }
}

// الرد على رسالة
function replyToMessage(message) {
    replyingToMessageId = message.id;
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
    previewUser.textContent = `رد على ${message.user_name || message.username || 'مستخدم'}`;
    
    const previewText = document.createElement('div');
    previewText.className = 'reply-preview-text';
    if (message.message_type === 'audio') {
        previewText.textContent = '🎤 رسالة صوتية';
    } else if (message.message_type === 'file') {
        previewText.textContent = '📎 ' + (message.message || 'ملف');
    } else {
        previewText.textContent = message.message || 'رسالة';
    }
    
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
        chatInputContainer.insertBefore(preview, chatInputContainer.firstChild);
    }
}

// إزالة معاينة الرد
function clearReplyPreview() {
    replyingToMessageId = null;
    const preview = document.getElementById('replyPreview');
    if (preview) {
        preview.remove();
    }
}

// إظهار معاينة التعديل
function showEditPreview(message) {
    const existingPreview = document.getElementById('editPreview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    const preview = document.createElement('div');
    preview.id = 'editPreview';
    preview.className = 'edit-preview';
    preview.innerHTML = `
        <div class="edit-preview-content">
            <span>✏️ تعديل رسالة</span>
            <button class="edit-preview-close" onclick="cancelEditing()">×</button>
        </div>
    `;
    
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (chatInputContainer) {
        chatInputContainer.insertBefore(preview, chatInputContainer.firstChild);
    }
}

// إلغاء التعديل
function cancelEditing() {
    editingMessageId = null;
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = '';
    }
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
        `;
        sendBtn.title = 'إرسال';
    }
    
    const preview = document.getElementById('editPreview');
    if (preview) {
        preview.remove();
    }
}

// التمرير لرسالة محددة
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

// إظهار مؤشر الإرسال
function showSendingIndicator(content, type) {
    const indicator = document.createElement('div');
    indicator.className = 'sending-indicator';
    indicator.id = 'sendingIndicator-' + Date.now();
    
        const icon = type === 'audio' ? '🎤' : type === 'image' ? '🖼️' : type === 'file' ? '📎' : type === 'location' ? '📍' : '💬';
        const text = type === 'audio' ? 'جاري إرسال الرسالة الصوتية...' :
                     type === 'image' ? 'جاري إرسال الصورة...' :
                     type === 'file' ? 'جاري إرسال الملف...' :
                     type === 'location' ? 'جاري إرسال الموقع...' :
                     'جاري الإرسال...';
    
    indicator.innerHTML = `
        <div class="sending-indicator-content">
            <div class="sending-spinner"></div>
            <span class="sending-text">${icon} ${text}</span>
        </div>
    `;
    
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (chatInputContainer) {
        chatInputContainer.insertBefore(indicator, chatInputContainer.firstChild);
    }
    
    return indicator;
}

// إخفاء مؤشر الإرسال
function hideSendingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, 300);
    }
}

// إدارة ظهور لوحة المفاتيح (ميزة واتساب)
let keyboardHandlers = {
    resizeHandler: null,
    scrollHandler: null,
    resizeWindowHandler: null
};

function setupKeyboardHandling(chatInput) {
    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    if (!chatContainer || !chatMessages) return;
    
    let initialViewportHeight = window.innerHeight;
    let isKeyboardOpen = false;
    
    function handleViewportResize() {
        if (!window.visualViewport) return;
        const viewport = window.visualViewport;
        const heightDiff = initialViewportHeight - viewport.height;
        
        // إذا كان الفرق أكثر من 150px، فلوحة المفاتيح مفتوحة
        if (heightDiff > 150) {
            if (!isKeyboardOpen) {
                handleKeyboardOpen();
            }
            // تعديل موضع حقل الإدخال
            adjustInputPosition(viewport.height);
        } else {
            if (isKeyboardOpen) {
                handleKeyboardClose();
            }
        }
    }
    
    function handleViewportScroll() {
        if (!window.visualViewport) return;
        // التمرير للأسفل عند ظهور لوحة المفاتيح
        if (isKeyboardOpen) {
            scrollToBottom();
        }
    }
    
    function handleWindowResize() {
        const currentHeight = window.innerHeight;
        const heightDiff = initialViewportHeight - currentHeight;
        
        if (heightDiff > 150) {
            if (!isKeyboardOpen) {
                handleKeyboardOpen();
            }
        } else {
            if (isKeyboardOpen) {
                handleKeyboardClose();
            }
        }
    }
    
    function handleKeyboardOpen() {
        isKeyboardOpen = true;
        chatContainer.classList.add('keyboard-open');
        
        // إخفاء أي قوائم جانبية مفتوحة
        closeAllSidebars();
        
        // التمرير للأسفل
        setTimeout(() => {
            scrollToBottom();
        }, 200);
    }
    
    function handleKeyboardClose() {
        isKeyboardOpen = false;
        chatContainer.classList.remove('keyboard-open');
    }
    
    function adjustInputPosition(viewportHeight) {
        // التأكد من أن حقل الإدخال مرئي
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer) {
            const inputRect = inputContainer.getBoundingClientRect();
            const viewportBottom = viewportHeight;
            
            // إذا كان حقل الإدخال مخفي خلف لوحة المفاتيح
            if (inputRect.bottom > viewportBottom) {
                // التمرير للأسفل
                scrollToBottom();
            }
        }
    }
    
    // حفظ المراجع للدوال
    keyboardHandlers.resizeHandler = handleViewportResize;
    keyboardHandlers.scrollHandler = handleViewportScroll;
    keyboardHandlers.resizeWindowHandler = handleWindowResize;
    
    // استخدام Visual Viewport API إذا كان متاحاً (الأفضل)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportResize);
        window.visualViewport.addEventListener('scroll', handleViewportScroll);
    } else {
        // استخدام window resize كبديل
        window.addEventListener('resize', handleWindowResize);
    }
    
    // عند التركيز على حقل الإدخال
    chatInput.addEventListener('focus', () => {
        setTimeout(() => {
            handleKeyboardOpen();
            // التمرير للأسفل بعد ظهور لوحة المفاتيح
            setTimeout(() => {
                scrollToBottom();
            }, 300);
        }, 100);
    });
    
    // عند إلغاء التركيز
    chatInput.addEventListener('blur', () => {
        setTimeout(() => {
            handleKeyboardClose();
        }, 100);
    });
    
    // حفظ الارتفاع الأولي
    function updateInitialHeight() {
        initialViewportHeight = window.innerHeight;
        if (window.visualViewport) {
            initialViewportHeight = window.visualViewport.height;
        }
    }
    
    window.addEventListener('load', updateInitialHeight);
    
    // إعادة تعيين عند تغيير الاتجاه
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            updateInitialHeight();
            handleKeyboardClose();
        }, 500);
    });
}

// قائمة المرفقات
function toggleAttachMenu() {
    const attachMenu = document.getElementById('attachMenu');
    if (!attachMenu) return;
    
    const isVisible = attachMenu.style.display !== 'none';
    if (isVisible) {
        closeAttachMenu();
    } else {
        showAttachMenu();
    }
}

function showAttachMenu() {
    const attachMenu = document.getElementById('attachMenu');
    const attachBtn = document.getElementById('attachBtn');
    if (!attachMenu || !attachBtn) return;
    
    attachMenu.style.display = 'flex';
    
    // تحديد الموضع
    const btnRect = attachBtn.getBoundingClientRect();
    attachMenu.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
    attachMenu.style.right = `${window.innerWidth - btnRect.right}px`;
}

function closeAttachMenu() {
    const attachMenu = document.getElementById('attachMenu');
    if (attachMenu) {
        attachMenu.style.display = 'none';
    }
}

// فتح معرض الصور
function openGallery() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = false;
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileAttachment(file);
        }
    };
    fileInput.click();
}

// فتح منتقي الملفات
function openFilePicker() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*,audio/*,.pdf,.doc,.docx,.txt';
    fileInput.multiple = false;
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileAttachment(file);
        }
    };
    fileInput.click();
}

// فتح الكاميرا
let cameraStream = null;
let facingMode = 'user'; // 'user' للكاميرا الأمامية، 'environment' للخلفية

async function openCamera() {
    const cameraOverlay = document.getElementById('cameraOverlay');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraFlipBtn = document.getElementById('cameraFlipBtn');
    
    if (!cameraOverlay || !cameraVideo) return;
    
    try {
        // طلب الوصول للكاميرا
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        cameraVideo.srcObject = cameraStream;
        cameraOverlay.style.display = 'flex';
        
        // إظهار زر تبديل الكاميرا إذا كان الجهاز يدعم كاميرات متعددة
        if (cameraFlipBtn && navigator.mediaDevices.getSupportedConstraints().facingMode) {
            cameraFlipBtn.style.display = 'flex';
        }
        
        // منع التمرير عند فتح الكاميرا
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('خطأ في فتح الكاميرا:', error);
        showMessage('فشل في الوصول للكاميرا. تأكد من السماح بالوصول للكاميرا.', 'error');
    }
}

// إغلاق الكاميرا
function closeCamera() {
    const cameraOverlay = document.getElementById('cameraOverlay');
    if (cameraOverlay) {
        cameraOverlay.style.display = 'none';
    }
    
    // إيقاف الكاميرا
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    const cameraVideo = document.getElementById('cameraVideo');
    if (cameraVideo) {
        cameraVideo.srcObject = null;
    }
    
    // إعادة التمرير
    document.body.style.overflow = '';
}

// تبديل الكاميرا
async function flipCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    
    // إيقاف الكاميرا الحالية
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    // فتح الكاميرا الجديدة
    await openCamera();
}

// التقاط صورة
function capturePhoto() {
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    
    if (!cameraVideo || !cameraCanvas) return;
    
    try {
        // تعيين أبعاد Canvas
        cameraCanvas.width = cameraVideo.videoWidth;
        cameraCanvas.height = cameraVideo.videoHeight;
        
        // رسم الفيديو على Canvas
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0);
        
        // تحويل Canvas إلى Blob
        cameraCanvas.toBlob((blob) => {
            if (blob) {
                // إغلاق الكاميرا
                closeCamera();
                
                // إنشاء File من Blob
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                
                // إرسال الصورة
                handleFileAttachment(file);
            }
        }, 'image/jpeg', 0.9);
    } catch (error) {
        console.error('خطأ في التقاط الصورة:', error);
        showMessage('فشل في التقاط الصورة', 'error');
    }
}

// إرسال الموقع
async function sendLocation() {
    if (!currentRoom) return;
    
    if (!navigator.geolocation) {
        showMessage('المتصفح لا يدعم تحديد الموقع', 'error');
        return;
    }
    
    try {
        showMessage('جاري الحصول على الموقع...', 'info');
        
        // إظهار مؤشر الإرسال
        const sendingIndicator = showSendingIndicator('موقع', 'location');
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy || 0;
                
                // الحصول على عنوان الموقع (اختياري)
                let address = '';
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                    );
                    const data = await response.json();
                    if (data && data.display_name) {
                        address = data.display_name;
                    }
                } catch (error) {
                    console.log('فشل في الحصول على العنوان:', error);
                }
                
                // إرسال الموقع
                const result = await API.request('chat.php', 'POST', {
                    action: 'send_message',
                    room_id: currentRoom.id,
                    message: address || `الموقع: ${latitude}, ${longitude}`,
                    message_type: 'location',
                    location_data: {
                        latitude: latitude,
                        longitude: longitude,
                        accuracy: accuracy,
                        address: address
                    }
                });
                
                // إزالة مؤشر الإرسال
                hideSendingIndicator(sendingIndicator);
                
                if (result && result.success) {
                    showMessage('تم إرسال الموقع بنجاح', 'success');
                    await loadMessages();
                } else {
                    showMessage('فشل إرسال الموقع', 'error');
                }
            },
            (error) => {
                hideSendingIndicator(sendingIndicator);
                console.error('خطأ في الحصول على الموقع:', error);
                let errorMessage = 'فشل في الحصول على الموقع';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات المتصفح.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'معلومات الموقع غير متاحة';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'انتهت مهلة الحصول على الموقع';
                        break;
                }
                
                showMessage(errorMessage, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } catch (error) {
        console.error('خطأ في إرسال الموقع:', error);
        showMessage('حدث خطأ في إرسال الموقع', 'error');
    }
}

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    if (roomsPollingInterval) {
        clearInterval(roomsPollingInterval);
    }
    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
    }
    
    // إغلاق الكاميرا إذا كانت مفتوحة
    if (cameraStream) {
        closeCamera();
    }
    
    // إزالة event listeners للوحة المفاتيح
    if (window.visualViewport && keyboardHandlers.resizeHandler) {
        window.visualViewport.removeEventListener('resize', keyboardHandlers.resizeHandler);
        window.visualViewport.removeEventListener('scroll', keyboardHandlers.scrollHandler);
    }
    if (keyboardHandlers.resizeWindowHandler) {
        window.removeEventListener('resize', keyboardHandlers.resizeWindowHandler);
    }
});


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
    
    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.message;
    bubble.appendChild(text);
    
    // Time for user messages
    if (isUserMessage) {
        const time = document.createElement('span');
        time.className = 'message-time';
        time.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 4px; display: block;';
        time.textContent = formatTime(message.created_at);
        bubble.appendChild(time);
    }
    
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
        backBtn.addEventListener('click', () => {
            // العودة للمحادثة الجماعية
            if (currentRoom && currentRoom.type === 'private') {
                // إعادة تحميل المحادثة الجماعية
                const groupRoomResult = await API.request('chat.php', 'POST', {
                    action: 'get_or_create_group_room'
                });
                
                if (groupRoomResult && groupRoomResult.success) {
                    currentRoom = groupRoomResult.data;
                    await loadRoomData();
                }
            }
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
    }
    
    // أزرار الإدخال
    const emojiBtn = document.getElementById('emojiBtn');
    const micBtn = document.getElementById('micBtn');
    const attachBtn = document.getElementById('attachBtn');
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
            // يمكن إضافة emoji picker هنا
            showMessage('قريباً: منتقي الإيموجي', 'info');
        });
    }
    
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            showMessage('قريباً: التسجيل الصوتي', 'info');
        });
    }
    
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            showMessage('قريباً: إرفاق الملفات', 'info');
        });
    }
}

// إرسال رسالة
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !currentRoom) return;
    
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    try {
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
            reactions: {}
        };
        
        messages.push(tempMessage);
        renderMessages();
        chatInput.value = '';
        
        // إرسال الرسالة للخادم
        const result = await API.request('chat.php', 'POST', {
            action: 'send_message',
            room_id: currentRoom.id,
            message: messageText,
            message_type: 'text'
        });
        
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

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    if (roomsPollingInterval) {
        clearInterval(roomsPollingInterval);
    }
});


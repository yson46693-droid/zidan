// نظام الشات المدمج مع الموقع
(function () {
  // تجاهل أخطاء InfinityFree error pages في console
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    // تجاهل أخطاء InfinityFree error pages
    if (message.includes('errors.infinityfree.net') || message.includes('ERR_ABORTED 404')) {
      return; // لا نعرض هذا الخطأ
    }
    originalError.apply(console, args);
  };
  
  // استخدام مسار API من مجلد api/chat
  const API_BASE = window.CHAT_API_BASE || 'api/chat';
  const PRESENCE_INTERVAL = 30000;
  const POLLING_INTERVAL = 12000;

  const selectors = {
    app: '[data-chat-app]',
    messageList: '[data-chat-messages]',
    userList: '[data-chat-users]',
    sendButton: '[data-chat-send]',
    input: '[data-chat-input]',
    toast: '[data-chat-toast]',
    replyBar: '[data-chat-reply]',
    replyDismiss: '[data-chat-reply-dismiss]',
    replyText: '[data-chat-reply-text]',
    replyName: '[data-chat-reply-name]',
    headerCount: '[data-chat-count]',
    composer: '[data-chat-composer]',
    search: '[data-chat-search]',
    emptyState: '[data-chat-empty]',
    sidebarToggle: '[data-chat-sidebar-toggle]',
    sidebar: '[data-chat-sidebar]',
    sidebarOverlay: '[data-chat-sidebar-overlay]',
    themeToggle: '[data-chat-theme-toggle]',
  };

  const state = {
    messages: [],
    users: [],
    latestTimestamp: null,
    lastMessageId: 0,
    replyTo: null,
    editMessage: null,
    statusTimer: null,
    pollingTimer: null,
    isSending: false,
    initialized: false,
    pendingFetchTimeout: null,
  };

  const elements = {};

  const currentUser = {
    id: 0,
    name: '',
    role: '',
  };

  // دوال مساعدة للأداء
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // دالة التهيئة من النظام الخارجي
  window.initChat = function(user) {
    if (!user) {
      return;
    }

    // استخدام ID كما هو (قد يكون string)
    currentUser.id = user.id || user.user_id || '0';
    currentUser.name = user.name || user.username || 'مستخدم';
    currentUser.role = user.role || 'member';

    // تعيين بيانات المستخدم في العنصر
    const app = document.querySelector(selectors.app);
    if (app) {
      app.dataset.currentUserId = currentUser.id;
      app.dataset.currentUserName = currentUser.name;
      app.dataset.currentUserRole = currentUser.role;
    }

    // تهيئة فورية
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(init, 50);
      });
    } else {
      setTimeout(init, 50);
    }
  };

  function init() {
    const app = document.querySelector(selectors.app);
    if (!app) {
      setTimeout(init, 100);
      return;
    }

    try {
      elements.app = app;
      elements.messageList = app.querySelector(selectors.messageList);
      elements.userList = app.querySelector(selectors.userList);
      elements.sendButton = app.querySelector(selectors.sendButton);
      elements.input = app.querySelector(selectors.input);
      elements.toast = app.querySelector(selectors.toast);
      elements.replyBar = app.querySelector(selectors.replyBar);
      elements.replyDismiss = app.querySelector(selectors.replyDismiss);
      elements.replyText = app.querySelector(selectors.replyText);
      elements.replyName = app.querySelector(selectors.replyName);
      elements.headerCount = app.querySelector(selectors.headerCount);
      elements.search = app.querySelector(selectors.search);
      elements.emptyState = app.querySelector(selectors.emptyState);
      elements.sidebarToggle = document.querySelector(selectors.sidebarToggle);
      elements.sidebar = app.querySelector(selectors.sidebar);
      elements.sidebarOverlay = document.querySelector(selectors.sidebarOverlay);
      elements.themeToggle = app.querySelector(selectors.themeToggle);
      elements.composer = app.querySelector(selectors.composer);
      elements.chatMain = app.querySelector('.chat-main');

      // استخدام بيانات المستخدم من النظام
      if (!currentUser.id || currentUser.id === '0') {
        if (app.dataset.currentUserId) {
          currentUser.id = app.dataset.currentUserId;
          currentUser.name = app.dataset.currentUserName || 'مستخدم';
          currentUser.role = app.dataset.currentUserRole || 'member';
        }
      }
      
      // التأكد من وجود بيانات المستخدم
      if (!currentUser.id || currentUser.id === '0' || currentUser.id === 0) {
        console.warn('Chat: No user data found, initialization may fail');
        setTimeout(init, 200);
        return;
      }

      // التأكد من أن العناصر موجودة
      if (!elements.messageList || !elements.input || !elements.sendButton) {
        setTimeout(init, 100);
        return;
      }

      // التأكد من أن التصميم ظاهر
      if (elements.app) {
        elements.app.style.display = 'flex';
        elements.app.style.visibility = 'visible';
        elements.app.style.opacity = '1';
      }
      
      if (elements.chatMain) {
        elements.chatMain.style.display = 'flex';
        elements.chatMain.style.visibility = 'visible';
        elements.chatMain.style.opacity = '1';
      }
      
      if (elements.messageList) {
        elements.messageList.style.display = 'flex';
        elements.messageList.style.visibility = 'visible';
        elements.messageList.style.opacity = '1';
      }
      
      if (elements.composer) {
        elements.composer.style.display = 'flex';
        elements.composer.style.visibility = 'visible';
        elements.composer.style.opacity = '1';
      }
      
      if (elements.sidebar) {
        elements.sidebar.style.display = 'flex';
        elements.sidebar.style.visibility = 'visible';
        elements.sidebar.style.opacity = '1';
      }

      initTheme();
      bindEvents();
      
      // تأخير قصير قبل جلب الرسائل لضمان اكتمال الجلسة
      setTimeout(() => {
        fetchMessages(true);
        startPresenceUpdates();
        startPolling();
        
        // إذا لم يتم جلب المستخدمين بعد ثانية واحدة، نجرب جلبهم بشكل منفصل
        setTimeout(() => {
          if (!state.users || state.users.length === 0) {
            console.log('Chat: محاولة جلب المستخدمين بشكل منفصل...');
            fetchUsersSeparately();
          }
        }, 1000);
      }, 300);
      
      document.addEventListener('visibilitychange', handleVisibilityChange);

      state.initialized = true;
    } catch (error) {
      // Error handling
    }
  }

  function bindEvents() {
    if (elements.sendButton) {
      elements.sendButton.addEventListener('click', handleSend);
    }

    if (elements.input) {
      elements.input.addEventListener('keydown', handleInputKeydown);
      elements.input.addEventListener('input', handleInputResize);
      handleInputResize();
    }

    if (elements.replyDismiss) {
      elements.replyDismiss.addEventListener('click', clearReplyAndEdit);
    }

    if (elements.messageList) {
      elements.messageList.addEventListener('click', handleMessageListClick);
    }

    if (elements.userList && elements.search) {
      // استخدام debounce للبحث
      const debouncedSearch = debounce(handleSearchUsers, 300);
      elements.search.addEventListener('input', (e) => {
        debouncedSearch(e);
      });
    }

    if (elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (elements.sidebarOverlay) {
      elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', toggleTheme);
    }

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1100) {
        if (elements.sidebar && elements.sidebar.classList.contains('active')) {
          if (!elements.sidebar.contains(e.target) && 
              !elements.sidebarToggle.contains(e.target) &&
              !elements.sidebarOverlay.contains(e.target)) {
            closeSidebar();
          }
        }
      }
    });

    // استخدام throttle لـ resize events
    const throttledResize = throttle(() => {
      if (window.innerWidth > 1100) {
        closeSidebar();
      }
    }, 250);
    
    window.addEventListener('resize', throttledResize);

    window.addEventListener('beforeunload', () => {
      if (state.pendingFetchTimeout) {
        window.clearTimeout(state.pendingFetchTimeout);
        state.pendingFetchTimeout = null;
      }
      stopPresenceUpdates();
      stopPolling();
      updatePresence(false).catch(() => null);
    });
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      fetchMessages();
    }
  }

  function toggleSidebar() {
    if (!elements.sidebar) {
      return;
    }
    
    const isActive = elements.sidebar.classList.contains('active');
    if (isActive) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function openSidebar() {
    try {
      if (elements.sidebar) {
        elements.sidebar.classList.add('active');
      }
      if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.add('active');
      }
      if (document.body) {
        document.body.style.overflow = 'hidden';
      }
    } catch (error) {
      // Error handling
    }
  }

  function closeSidebar() {
    try {
      if (elements.sidebar) {
        elements.sidebar.classList.remove('active');
      }
      if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.remove('active');
      }
      if (document.body) {
        document.body.style.overflow = '';
      }
    } catch (error) {
      // Error handling
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('chat-theme');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || darkMode || (!savedTheme && prefersDark)) {
      document.body.classList.add('dark-mode');
      updateThemeIcon(true);
    } else {
      document.body.classList.remove('dark-mode');
      updateThemeIcon(false);
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    
    if (isDark) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('chat-theme', 'light');
      localStorage.setItem('darkMode', 'false');
      updateThemeIcon(false);
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('chat-theme', 'dark');
      localStorage.setItem('darkMode', 'true');
      updateThemeIcon(true);
    }
  }

  function updateThemeIcon(isDark) {
    if (!elements.themeToggle) {
      return;
    }
    
    const icon = elements.themeToggle.querySelector('.chat-theme-icon');
    const text = elements.themeToggle.querySelector('.chat-theme-text');
    
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    
    if (text) {
      text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    }
  }

  function handleSearchUsers(event) {
    if (!elements.userList) {
      return;
    }
    
    try {
      const value = event.target.value.trim().toLowerCase();
      const items = elements.userList.querySelectorAll('[data-chat-user-item]');

      items.forEach((item) => {
        if (!item) return;
        const name = item.dataset.name || '';
        if (!value || name.toLowerCase().includes(value)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    } catch (error) {
      // Error handling - لا نكسر النظام
    }
  }

  function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleInputResize() {
    if (!elements.input) {
      return;
    }
    elements.input.style.height = 'auto';
    elements.input.style.height = Math.min(elements.input.scrollHeight, 160) + 'px';
  }

  function handleSend() {
    if (state.isSending) {
      return;
    }

    const message = elements.input.value.trim();

    if (!message) {
      return;
    }

    if (state.editMessage) {
      updateMessage(state.editMessage.id, message);
    } else {
      sendMessage(message, state.replyTo ? state.replyTo.id : null);
    }
  }

  function handleMessageListClick(event) {
    const actionButton = event.target.closest('[data-chat-action]');
    if (!actionButton) {
      return;
    }

    const messageElement = actionButton.closest('[data-chat-message-id]');
    if (!messageElement) {
      return;
    }

    const messageId = parseInt(messageElement.dataset.chatMessageId, 10);
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }

    const action = actionButton.dataset.chatAction;

    if (action === 'reply') {
      setReply(message);
    } else     if (action === 'edit') {
      if (String(message.user_id) !== String(currentUser.id) || message.deleted) {
        showToast('يمكنك تعديل رسائلك فقط', true);
        return;
      }
      setEdit(message);
    } else if (action === 'delete') {
      if (String(message.user_id) !== String(currentUser.id) || message.deleted) {
        showToast('يمكنك حذف رسائلك فقط', true);
        return;
      }
      confirmDelete(message);
    } else if (action === 'scroll-to-reply') {
      if (!message.reply_to) {
        return;
      }
      scrollToMessage(message.reply_to);
    }
  }

  function setReply(message) {
    state.replyTo = message;
    state.editMessage = null;
    renderReplyBar();
    focusInput();
  }

  function setEdit(message) {
    state.editMessage = message;
    state.replyTo = null;
    renderReplyBar();
    elements.input.value = message.deleted ? '' : message.message_text;
    handleInputResize();
    focusInput(true);
  }

  function clearReplyAndEdit() {
    state.replyTo = null;
    state.editMessage = null;
    renderReplyBar();
  }

  function renderReplyBar() {
    if (!elements.replyBar) {
      return;
    }

    if (state.replyTo) {
      elements.replyBar.classList.add('active');
      elements.replyName.textContent = state.replyTo.user_name || 'مستخدم';
      elements.replyText.textContent = summarizeText(state.replyTo.message_text);
      elements.replyBar.dataset.mode = 'reply';
    } else if (state.editMessage) {
      elements.replyBar.classList.add('active');
      elements.replyName.textContent = 'تعديل رسالة';
      elements.replyText.textContent = summarizeText(state.editMessage.message_text);
      elements.replyBar.dataset.mode = 'edit';
    } else {
      elements.replyBar.classList.remove('active');
      elements.replyName.textContent = '';
      elements.replyText.textContent = '';
      elements.replyBar.dataset.mode = '';
    }
  }

  function summarizeText(text) {
    if (!text) {
      return '';
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 120 ? `${clean.substring(0, 117)}...` : clean;
  }

  function focusInput(selectAll = false) {
    if (elements.input) {
      elements.input.focus({ preventScroll: true });
      if (selectAll) {
        requestAnimationFrame(() => {
          elements.input.setSelectionRange(elements.input.value.length, elements.input.value.length);
        });
      }
    }
  }

  async function sendMessage(message, replyTo) {
    state.isSending = true;
    toggleComposerDisabled(true);

    try {
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/send_message.php`;
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message,
            reply_to: replyTo,
          }),
        });
      } catch (fetchError) {
        // تجاهل أخطاء InfinityFree error pages
        if (fetchError.message && fetchError.message.includes('errors.infinityfree.net')) {
          console.warn('InfinityFree error page detected, ignoring...');
          return;
        }
        throw new Error('خطأ في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
      }

      // التحقق من أن الاستجابة ليست صفحة خطأ InfinityFree
      const responseUrl = response.url || '';
      if (responseUrl.includes('errors.infinityfree.net')) {
        console.warn('InfinityFree error page detected in response, skipping...');
        return;
      }

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // تجاهل خطأ قراءة النص
        }
        
        if (response.status === 403) {
          throw new Error('ليس لديك صلاحية لإرسال الرسائل. يرجى تسجيل الدخول مرة أخرى.');
        } else if (response.status === 404) {
          throw new Error('لم يتم العثور على نقطة النهاية. يرجى التحقق من إعدادات الخادم.');
        } else if (response.status === 401) {
          throw new Error('غير مصرح لك. يرجى تسجيل الدخول مرة أخرى.');
        } else {
          throw new Error(`فشل في إرسال الرسالة: ${response.status}`);
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('خطأ في قراءة البيانات من الخادم.');
      }

      if (!data.success) {
        throw new Error(data.error || 'تعذر إرسال الرسالة');
      }

      elements.input.value = '';
      handleInputResize();
      clearReplyAndEdit();
      
      // التأكد من أن البيانات موجودة
      if (data.data) {
        appendMessages([data.data], true);
        showToast('تم إرسال الرسالة');
        scrollToBottom(true);
      } else {
        console.warn('Chat: لم يتم استلام بيانات الرسالة من الخادم');
        showToast('تم إرسال الرسالة، جاري التحديث...');
      }
      
      // تحديث الرسائل والمستخدمين بعد إرسال الرسالة
      setTimeout(() => {
        fetchMessages();
      }, 500);
    } catch (error) {
      console.error('Chat: خطأ في إرسال الرسالة:', error);
      showToast(error.message || 'حدث خطأ أثناء الإرسال', true);
    } finally {
      state.isSending = false;
      toggleComposerDisabled(false);
    }
  }

  async function updateMessage(messageId, message) {
    const msgToUpdate = state.messages.find((m) => m.id === messageId);
    if (!msgToUpdate || String(msgToUpdate.user_id) !== String(currentUser.id) || msgToUpdate.deleted) {
      showToast('يمكنك تعديل رسائلك فقط', true);
      return;
    }

    state.isSending = true;
    toggleComposerDisabled(true);

    try {
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/update_message.php`;
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message_id: messageId,
            message,
          }),
        });
      } catch (fetchError) {
        if (fetchError.message && fetchError.message.includes('errors.infinityfree.net')) {
          console.warn('InfinityFree error page detected, ignoring...');
          return;
        }
        throw new Error('خطأ في الاتصال بالخادم');
      }

      // التحقق من أن الاستجابة ليست صفحة خطأ InfinityFree
      const responseUrl = response.url || '';
      if (responseUrl.includes('errors.infinityfree.net')) {
        console.warn('InfinityFree error page detected, skipping...');
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Chat: خطأ في قراءة JSON:', jsonError);
        throw new Error('خطأ في قراءة البيانات من الخادم.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'تعذر تعديل الرسالة');
      }

      elements.input.value = '';
      handleInputResize();
      clearReplyAndEdit();
      
      // التأكد من وجود البيانات قبل التحديث
      if (data.data) {
        applyMessageUpdate(data.data);
        showToast('تم تحديث الرسالة');
      } else {
        console.warn('Chat: لم يتم استلام بيانات الرسالة المحدثة');
        showToast('تم التحديث، جاري التحديث...');
      }
      
      setTimeout(() => {
        fetchMessages();
      }, 500);
    } catch (error) {
      console.error('Chat: خطأ في تعديل الرسالة:', error);
      showToast(error.message || 'حدث خطأ أثناء التعديل', true);
    } finally {
      state.isSending = false;
      toggleComposerDisabled(false);
    }
  }

  function applyMessageUpdate(updated) {
    const index = state.messages.findIndex((item) => item.id === updated.id);
    if (index === -1) {
      return false;
    }

    const before = state.messages[index];
    const merged = {
      ...before,
      ...updated,
      edited: 1,
    };

    state.messages[index] = merged;
    renderMessages();
    highlightMessage(updated.id);
    return true;
  }

  function highlightMessage(messageId) {
    if (!elements.messageList) {
      return;
    }
    const target = elements.messageList.querySelector(`[data-chat-message-id="${messageId}"]`);
    if (!target) {
      return;
    }
    target.classList.add('highlight');
    setTimeout(() => {
      target.classList.remove('highlight');
    }, 1200);
  }

  async function confirmDelete(message) {
    if (String(message.user_id) !== String(currentUser.id) || message.deleted) {
      showToast('يمكنك حذف رسائلك فقط', true);
      return;
    }

    const confirmed = window.confirm('هل أنت متأكد من حذف هذه الرسالة؟');
    if (!confirmed) {
      return;
    }

    try {
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/delete_message.php`;
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message_id: message.id,
          }),
        });
      } catch (fetchError) {
        if (fetchError.message && fetchError.message.includes('errors.infinityfree.net')) {
          console.warn('InfinityFree error page detected, ignoring...');
          return;
        }
        throw new Error('خطأ في الاتصال بالخادم');
      }

      // التحقق من أن الاستجابة ليست صفحة خطأ InfinityFree
      const responseUrl = response.url || '';
      if (responseUrl.includes('errors.infinityfree.net')) {
        console.warn('InfinityFree error page detected, skipping...');
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Chat: خطأ في قراءة JSON:', jsonError);
        throw new Error('خطأ في قراءة البيانات من الخادم.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'تعذر حذف الرسالة');
      }

      clearReplyAndEdit();
      
      // التأكد من وجود البيانات قبل التحديث
      if (data.data) {
        applyMessageUpdate(data.data);
        showToast('تم حذف الرسالة');
      } else {
        console.warn('Chat: لم يتم استلام بيانات الرسالة المحذوفة');
        showToast('تم الحذف، جاري التحديث...');
      }
      
      setTimeout(() => {
        fetchMessages();
      }, 500);
    } catch (error) {
      console.error('Chat: خطأ في حذف الرسالة:', error);
      showToast(error.message || 'حدث خطأ أثناء الحذف', true);
    }
  }

  function toggleComposerDisabled(disabled) {
    if (elements.sendButton) elements.sendButton.disabled = disabled;
    if (elements.input) elements.input.disabled = disabled;
  }

  async function fetchMessages(initial = false) {
    try {
      const params = new URLSearchParams();
      if (state.latestTimestamp) {
        params.set('since', state.latestTimestamp);
      }
      if (state.lastMessageId) {
        params.set('after_id', state.lastMessageId);
      }

      // التأكد من أن API_BASE صحيح
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/get_messages.php?${params.toString()}`;
      console.log('Fetching messages from:', url);
      
      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });
      } catch (fetchError) {
        console.error('Network error:', fetchError);
        // تجاهل أخطاء InfinityFree error pages
        if (fetchError.message && fetchError.message.includes('errors.infinityfree.net')) {
          console.warn('InfinityFree error page detected, ignoring...');
          return; // لا نرمي خطأ، فقط نتجاهل
        }
        throw new Error('خطأ في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
      }

      // التحقق من أن الاستجابة ليست صفحة خطأ InfinityFree
      const responseUrl = response.url || '';
      if (responseUrl.includes('errors.infinityfree.net')) {
        console.warn('InfinityFree error page detected in response, skipping...');
        return; // نتجاهل هذا الطلب
      }

      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        let errorText = '';
        try {
          errorText = await response.text();
          // التحقق من أن النص ليس صفحة HTML لخطأ InfinityFree
          if (errorText.includes('errors.infinityfree.net') || errorText.includes('<html>')) {
            console.warn('InfinityFree error page in response body, ignoring...');
            return;
          }
          console.error('Error response:', errorText);
        } catch (e) {
          console.error('Could not read error response');
        }
        
        if (response.status === 403) {
          // لا نرمي خطأ إذا كان من InfinityFree error page
          if (!errorText.includes('errors.infinityfree')) {
            throw new Error('ليس لديك صلاحية للوصول إلى الشات. يرجى تسجيل الدخول مرة أخرى.');
          }
          return;
        } else if (response.status === 404) {
          throw new Error('لم يتم العثور على نقطة النهاية. يرجى التحقق من إعدادات الخادم.');
        } else if (response.status === 401) {
          throw new Error('غير مصرح لك. يرجى تسجيل الدخول مرة أخرى.');
        } else {
          throw new Error(`فشل في تحميل الرسائل: ${response.status} ${response.statusText}`);
        }
      }

      let payload;
      try {
        payload = await response.json();
      } catch (jsonError) {
        throw new Error('خطأ في قراءة البيانات من الخادم.');
      }

      if (!payload.success) {
        throw new Error(payload.error || 'خطأ غير متوقع');
      }

      const { messages, latest_timestamp: latestTimestamp, users } = payload.data || {};

      // تحديث قائمة المستخدمين
      if (Array.isArray(users)) {
        console.log('Chat: تم استلام ' + users.length + ' مستخدم من API');
        state.users = users;
        updateUserList();
      } else if (users !== undefined) {
        console.warn('Chat: users ليست مصفوفة:', users);
        // إذا كانت users موجودة لكن ليست مصفوفة، نجرب استخدام مصفوفة فارغة
        state.users = [];
        updateUserList();
      } else {
        console.warn('Chat: users غير موجودة في payload.data');
        // إذا لم تكن users موجودة، نحاول جلبها من API منفصل
        if (initial) {
          fetchUsersSeparately();
        }
      }

      let hasNewMessages = false;

      if (Array.isArray(messages) && messages.length) {
        hasNewMessages = appendMessages(messages, initial);
      } else if (initial) {
        renderEmptyState(true);
      }

      if (latestTimestamp) {
        state.latestTimestamp = latestTimestamp;
      }

      if (hasNewMessages && !initial) {
        if (state.pendingFetchTimeout) {
          window.clearTimeout(state.pendingFetchTimeout);
        }
        state.pendingFetchTimeout = window.setTimeout(() => {
          state.pendingFetchTimeout = null;
          fetchMessages();
        }, 600);
      }
    } catch (error) {
      showToast(error.message || 'تعذر تحديث الرسائل', true);
    }
  }

  function renderEmptyState(show) {
    if (!elements.emptyState) {
      return;
    }
    try {
      if (show && state.messages.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.emptyState.style.visibility = 'visible';
        elements.emptyState.style.opacity = '1';
      } else {
        elements.emptyState.style.display = 'none';
        elements.emptyState.style.visibility = 'hidden';
        elements.emptyState.style.opacity = '0';
      }
    } catch (error) {
      // Error handling
    }
  }

  function appendMessages(newMessages, initial = false) {
    let hasNew = false;
    const existingIds = new Set(state.messages.map((msg) => msg.id));

    newMessages.forEach((message) => {
      if (!existingIds.has(message.id)) {
        state.messages.push(message);
        state.lastMessageId = Math.max(state.lastMessageId, message.id);
        hasNew = String(message.user_id) !== String(currentUser.id);
      } else if (applyMessageUpdate(message)) {
        hasNew = true;
      }
    });

    state.messages.sort((a, b) => a.id - b.id);
    renderMessages();

    renderEmptyState(state.messages.length === 0);

    if (!initial && hasNew) {
      showToast('رسالة جديدة واردة');
      scrollToBottom();
    } else if (initial) {
      scrollToBottom(true);
    }

    return hasNew;
  }

  function renderMessages() {
    if (!elements.messageList) {
      return;
    }

    try {
      const totalUsers = Math.max(1, state.users.length);
      const fragment = document.createDocumentFragment();
      let currentDate = '';

      // استخدام DocumentFragment لـ batch DOM updates
      state.messages.forEach((message) => {
        if (!message) return;
        const messageDate = formatDate(message.created_at);
        if (messageDate !== currentDate) {
          currentDate = messageDate;
          const divider = createDayDivider(messageDate);
          if (divider) {
            fragment.appendChild(divider);
          }
        }
        const messageEl = createMessageElement(message, totalUsers);
        if (messageEl) {
          fragment.appendChild(messageEl);
        }
      });

      // تحديث DOM مرة واحدة فقط
      elements.messageList.innerHTML = '';
      if (fragment.childNodes.length > 0) {
        elements.messageList.appendChild(fragment);
        renderEmptyState(false);
      } else {
        renderEmptyState(true);
      }
    } catch (error) {
      // Error handling - لا نكسر النظام
    }
  }

  function createDayDivider(label) {
    const divider = document.createElement('div');
    divider.className = 'chat-day-divider';
    divider.innerHTML = `<span>${escapeHTML(label)}</span>`;
    return divider;
  }

  function createMessageElement(message, totalUsers) {
    // مقارنة ID كـ string لتجنب مشاكل التحويل
    const outgoing = String(message.user_id) === String(currentUser.id);
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${outgoing ? 'outgoing' : 'incoming'}${message.deleted ? ' deleted' : ''}${message.edited && !message.deleted ? ' edited' : ''}`;
    messageElement.dataset.chatMessageId = String(message.id);

    const avatar = document.createElement('div');
    avatar.className = 'chat-message-avatar';
    if (message.profile_photo) {
      avatar.innerHTML = `<img src="${escapeAttribute(message.profile_photo)}" alt="${escapeAttribute(message.user_name)}" />`;
    } else {
      avatar.textContent = getInitials(message.user_name);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';

    if (message.reply_to && message.reply_text) {
      const replyFragment = document.createElement('div');
      replyFragment.className = 'chat-reply-preview';
      replyFragment.dataset.chatAction = 'scroll-to-reply';
      replyFragment.innerHTML = `
        <strong>${escapeHTML(message.reply_user_name || 'مستخدم')}</strong>
        <span>${escapeHTML(summarizeText(message.reply_text))}</span>
      `;
      bubble.appendChild(replyFragment);
    }

    const content = document.createElement('div');
    content.className = 'chat-message-content';

    if (!outgoing) {
      const sender = document.createElement('strong');
      sender.textContent = message.user_name || 'مستخدم';
      sender.style.fontSize = '13px';
      sender.style.color = 'var(--chat-primary)';
      content.appendChild(sender);
    }

    const body = document.createElement('div');
    body.className = 'chat-message-body';
    if (message.deleted) {
      body.textContent = 'تم حذف هذه الرسالة';
    } else {
      body.innerHTML = renderMessageText(message.message_text);
    }
    content.appendChild(body);
    bubble.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(message.created_at);
    meta.appendChild(timeSpan);

    if (outgoing) {
      const readSpan = document.createElement('div');
      readSpan.className = 'chat-read-status';
      readSpan.innerHTML = renderReadStatus(message, totalUsers);
      meta.appendChild(readSpan);
    } else {
      meta.appendChild(document.createElement('span'));
    }

    const actions = document.createElement('div');
    actions.className = 'chat-message-actions';

    const replyButton = document.createElement('button');
    replyButton.className = 'chat-message-action-button';
    replyButton.type = 'button';
    replyButton.dataset.chatAction = 'reply';
    replyButton.title = 'رد';
    replyButton.innerHTML = '&#x21a9;';
    actions.appendChild(replyButton);

    if (outgoing && !message.deleted) {
      const editButton = document.createElement('button');
      editButton.className = 'chat-message-action-button';
      editButton.type = 'button';
      editButton.dataset.chatAction = 'edit';
      editButton.title = 'تعديل';
      editButton.innerHTML = '&#9998;';
      actions.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'chat-message-action-button';
      deleteButton.type = 'button';
      deleteButton.dataset.chatAction = 'delete';
      deleteButton.title = 'حذف';
      deleteButton.innerHTML = '&#128465;';
      actions.appendChild(deleteButton);
    }

    meta.appendChild(actions);
    bubble.appendChild(meta);

    messageElement.appendChild(avatar);
    messageElement.appendChild(bubble);

    return messageElement;
  }

  function renderReadStatus(message, totalUsers) {
    const others = Math.max(totalUsers - 1, 0);
    if (others === 0) {
      return '<span>✓</span>';
    }

    const readBy = parseInt(message.read_by_count || 0, 10);
    if (readBy >= others) {
      return '<span style="color: var(--chat-primary)">✓✓</span> تمت القراءة';
    }

    if (readBy > 0) {
      return `<span>✓✓</span> ${readBy}/${others}`;
    }

    return '<span>✓</span> لم تُقرأ بعد';
  }

  function renderMessageText(text) {
    const escaped = escapeHTML(text || '');
    const withLinks = escaped.replace(
      /(https?:\/\/[^\s]+)/gi,
      (url) => `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`
    );
    return withLinks.replace(/\n/g, '<br />');
  }

  function getInitials(name) {
    if (!name) {
      return '?';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function updateUserList() {
    if (!elements.userList) {
      console.warn('Chat: elements.userList غير موجود');
      return;
    }

    try {
      // التأكد من أن state.users موجودة ومصفوفة
      if (!Array.isArray(state.users)) {
        console.warn('Chat: state.users ليست مصفوفة', state.users);
        state.users = [];
      }

      // تحديث العداد في الهيدر
      if (elements.headerCount) {
        const online = state.users.filter((user) => user && Number(user.is_online) === 1).length;
        const total = state.users.length;
        elements.headerCount.textContent = `${online} متصل / ${total} أعضاء`;
      }

      // استخدام DocumentFragment لـ batch DOM updates
      const fragment = document.createDocumentFragment();

      // التأكد من وجود مستخدمين
      if (state.users.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'chat-user-empty';
        emptyMsg.textContent = 'لا يوجد أعضاء';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = 'var(--chat-muted)';
        fragment.appendChild(emptyMsg);
      } else {
        state.users.forEach((user) => {
          if (!user || !user.id) {
            console.warn('Chat: مستخدم غير صالح:', user);
            return;
          }
          
          const item = document.createElement('div');
          item.className = 'chat-user-item';
          item.dataset.chatUserItem = 'true';
          item.dataset.name = (user.name || user.username || '').trim();
          item.dataset.userId = String(user.id);

          const avatar = document.createElement('div');
          avatar.className = 'chat-user-avatar';

          const userName = user.name || user.username || 'مستخدم';
          const initials = getInitials(userName);
          avatar.textContent = initials;

          const status = document.createElement('div');
          const isOnline = Number(user.is_online) === 1;
          status.className = `chat-user-status ${isOnline ? 'online' : ''}`;
          avatar.appendChild(status);

          const meta = document.createElement('div');
          meta.className = 'chat-user-meta';
          const nameElement = document.createElement('h3');
          nameElement.textContent = userName;
          meta.appendChild(nameElement);

          const statusText = document.createElement('span');
          statusText.textContent = isOnline
            ? 'متصل الآن'
            : `آخر ظهور: ${formatRelativeTime(user.last_seen || user.created_at)}`;
          meta.appendChild(statusText);

          item.appendChild(avatar);
          item.appendChild(meta);
          fragment.appendChild(item);
        });
      }

      // تحديث DOM مرة واحدة فقط
      elements.userList.innerHTML = '';
      if (fragment.childNodes.length > 0) {
        elements.userList.appendChild(fragment);
      }
      
      console.log('Chat: تم تحديث قائمة المستخدمين - ' + state.users.length + ' مستخدم');
    } catch (error) {
      console.error('Chat: خطأ في updateUserList:', error);
      // عرض رسالة خطأ للمستخدم
      if (elements.userList) {
        elements.userList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--chat-muted);">خطأ في تحميل الأعضاء</div>';
      }
    }
  }

  function startPresenceUpdates() {
    updatePresence(true).catch(() => null);

    if (state.statusTimer) {
      return;
    }

    state.statusTimer = window.setInterval(() => {
      updatePresence(true).catch(() => null);
    }, PRESENCE_INTERVAL);
  }

  function stopPresenceUpdates() {
    if (state.statusTimer) {
      window.clearInterval(state.statusTimer);
      state.statusTimer = null;
    }
  }

  function startPolling() {
    if (state.pollingTimer) {
      return;
    }

    state.pollingTimer = window.setInterval(() => {
      if (!document.hidden && state.initialized) {
        fetchMessages();
      }
    }, POLLING_INTERVAL);
  }

  function stopPolling() {
    if (state.pollingTimer) {
      window.clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }
  }

  async function fetchUsersSeparately() {
    try {
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/user_status.php`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Chat: فشل جلب المستخدمين:', response.status);
        return;
      }

      const payload = await response.json();
      if (payload.success && Array.isArray(payload.data)) {
        console.log('Chat: تم جلب ' + payload.data.length + ' مستخدم من API منفصل');
        state.users = payload.data;
        updateUserList();
      }
    } catch (error) {
      console.warn('Chat: خطأ في جلب المستخدمين:', error);
    }
  }

  async function updatePresence(isOnline) {
    try {
      const apiBaseUrl = API_BASE || 'api/chat';
      const url = `${apiBaseUrl}/user_status.php`;
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ is_online: Boolean(isOnline) }),
        });
        
        // التحقق من أن الاستجابة ليست صفحة خطأ InfinityFree
        const responseUrl = response.url || '';
        if (responseUrl.includes('errors.infinityfree.net')) {
          return; // نتجاهل
        }
        
        // إذا نجح التحديث، نجرب جلب المستخدمين المحدثين
        if (response.ok) {
          const payload = await response.json();
          if (payload.success && Array.isArray(payload.data)) {
            state.users = payload.data;
            updateUserList();
          }
        }
      } catch (fetchError) {
        // تجاهل أخطاء InfinityFree error pages
        if (fetchError.message && fetchError.message.includes('errors.infinityfree.net')) {
          return; // نتجاهل
        }
        // تجاهل جميع أخطاء presence - لا نكسر النظام
      }
  }

  function scrollToBottom(force = false) {
    if (!elements.messageList) {
      return;
    }
    
    try {
      if (!force) {
        const threshold = 120;
        const distanceFromBottom =
          elements.messageList.scrollHeight -
          elements.messageList.scrollTop -
          elements.messageList.clientHeight;

        if (distanceFromBottom > threshold) {
          return;
        }
      }

      requestAnimationFrame(() => {
        if (elements.messageList) {
          elements.messageList.scrollTop = elements.messageList.scrollHeight;
        }
      });
    } catch (error) {
      // Error handling
    }
  }

  function scrollToMessage(messageId) {
    if (!elements.messageList || !messageId) {
      return;
    }
    
    try {
      const target = elements.messageList.querySelector(
        `[data-chat-message-id="${messageId}"]`
      );
      if (!target) {
        return;
      }

      target.classList.add('highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        if (target) {
          target.classList.remove('highlight');
        }
      }, 1600);
    } catch (error) {
      // Error handling
    }
  }

  function formatDate(dateString) {
    try {
      const date = new Date(dateString.replace(' ', 'T'));
      return date.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  }

  function formatTime(dateString) {
    try {
      const date = new Date(dateString.replace(' ', 'T'));
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return dateString;
    }
  }

  function formatRelativeTime(dateString) {
    if (!dateString) {
      return 'غير معروف';
    }

    const date = new Date(dateString.replace(' ', 'T'));
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) {
      return 'الآن';
    }
    if (minutes < 60) {
      return `منذ ${minutes} دقيقة`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `منذ ${hours} ساعة`;
    }
    const days = Math.floor(hours / 24);
    if (days === 1) {
      return 'منذ يوم';
    }
    if (days === 2) {
      return 'منذ يومين';
    }
    if (days < 7) {
      return `منذ ${days} أيام`;
    }
    return date.toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
    });
  }

  function showToast(message, isError = false) {
    if (!elements.toast) {
      return;
    }
    elements.toast.textContent = message;
    elements.toast.style.background = isError
      ? 'var(--chat-danger)'
      : 'var(--chat-primary)';
    elements.toast.classList.add('visible');
    setTimeout(() => {
      elements.toast.classList.remove('visible');
    }, 2600);
  }

  function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }

  function escapeAttribute(value) {
    return String(value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // تهيئة تلقائية عند تحميل الصفحة
  function autoInit() {
    const app = document.querySelector(selectors.app);
    if (app && app.dataset.currentUserId && app.dataset.currentUserId !== '0') {
      const user = {
        id: app.dataset.currentUserId,
        name: app.dataset.currentUserName || 'مستخدم',
        role: app.dataset.currentUserRole || 'member'
      };
      
      if (user.id && user.id !== '0') {
        // استخدام initChat إذا كان متاحاً، وإلا تهيئة مباشرة
        if (typeof window.initChat === 'function') {
          setTimeout(() => {
            window.initChat(user);
          }, 100);
        } else {
          // تهيئة مباشرة
          currentUser.id = user.id;
          currentUser.name = user.name;
          currentUser.role = user.role;
          
          // تعيين بيانات المستخدم في العنصر
          app.dataset.currentUserId = currentUser.id;
          app.dataset.currentUserName = currentUser.name;
          app.dataset.currentUserRole = currentUser.role;
          
          // تهيئة فورية
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              setTimeout(init, 50);
            });
          } else {
            setTimeout(init, 50);
          }
        }
      }
    } else {
      // إعادة المحاولة بعد فترة قصيرة
      setTimeout(autoInit, 200);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    setTimeout(autoInit, 100);
  }
})();

/**
 * نظام عداد الرسائل غير المقروءة في الشريط الجانبي
 * يعمل في جميع الصفحات (dashboard.html وغيرها)
 * محسّن لتقليل عدد الطلبات
 */

(function() {
    'use strict';
    
    let checkInterval = null;
    let currentUser = null;
    let lastReadMessageId = '';
    let isChatPage = window.location.pathname.includes('chat.html');
    let lastCheckTime = 0;
    let cachedResult = null;
    let cacheExpiry = 0;
    const CACHE_DURATION = 5000; // 5 ثواني cache
    const CHECK_INTERVAL = 60000; // 60 ثانية (محسّن لتقليل الطلبات والاستهلاك)
    let isPageVisible = true;
    let pendingCheck = false;
    
    // تهيئة النظام
    async function init() {
        try {
            // ✅ منع التهيئة في صفحة تسجيل الدخول
            const pathname = window.location.pathname;
            const isLoginPage = pathname.includes('index.html') || pathname === '/' || pathname.endsWith('/');
            if (isLoginPage) {
                console.log('📋 صفحة تسجيل الدخول - لن يتم تهيئة عداد الرسائل غير المقروءة');
                return;
            }
            
            // الانتظار قليلاً لضمان تحميل API
            let retries = 0;
            while ((typeof API === 'undefined' || !API.request) && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }
            
            if (typeof API === 'undefined' || !API.request) {
                console.warn('⚠️ API غير متاح - سيتم المحاولة لاحقاً');
                setTimeout(() => init(), 2000);
                return;
            }
            
            // التحقق من تسجيل الدخول
            if (typeof checkLogin === 'function') {
                const user = await checkLogin();
                if (!user) {
                    return;
                }
                currentUser = user;
            } else {
                // محاولة من localStorage
                try {
                    const userStr = localStorage.getItem('currentUser');
                    if (userStr) {
                        currentUser = JSON.parse(userStr);
                    }
                } catch (e) {
                    console.error('خطأ في تحميل بيانات المستخدم:', e);
                }
            }
            
            if (!currentUser || !currentUser.id) {
                return;
            }
            
            // تحميل آخر رسالة مقروءة
            loadLastReadMessageId();
            
            // إعداد مراقبة حالة الصفحة
            setupVisibilityListener();
            
            // ✅ تحسين الأداء: استخدام MessagePollingManager الموحد
            if (!isChatPage) {
                // الانتظار حتى يتم تحميل MessagePollingManager
                const waitForPollingManager = () => {
                    if (window.MessagePollingManager) {
                        // الاشتراك في MessagePollingManager
                        window.MessagePollingManager.subscribe((result) => {
                            if (result && result.messages) {
                                processMessagesForBadge(result.messages);
                            }
                        });
                        console.log('✅ تم الاشتراك في MessagePollingManager للـ badge');
                    } else {
                        // إعادة المحاولة بعد 500ms
                        setTimeout(waitForPollingManager, 500);
                    }
                };
                
                // بدء بعد 2 ثانية (بعد تحميل MessagePollingManager)
                setTimeout(() => {
                    waitForPollingManager();
                    // Fallback: بدء النظام القديم إذا لم يكن MessagePollingManager متاحاً
                    if (!window.MessagePollingManager) {
                        let checkingStarted = false;
                        const startCheckingDelayed = () => {
                            if (!checkingStarted) {
                                checkingStarted = true;
                                startChecking();
                            }
                        };
                        ['click', 'touchstart', 'mousemove'].forEach(event => {
                            document.addEventListener(event, startCheckingDelayed, { once: true, passive: true });
                        });
                        setTimeout(startCheckingDelayed, 5000);
                    }
                }, 2000);
            } else {
                // في صفحة الشات، ننتظر حتى يتم تحميل الرسائل ثم نحدث العداد
                // سيتم استدعاء updateBadgeFromChat من chat.js
            }
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة عداد الرسائل غير المقروءة:', error);
        }
    }
    
    // إعداد مراقبة حالة الصفحة
    function setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            isPageVisible = !document.hidden;
            
            // إذا أصبحت الصفحة مرئية، فحص فوري
            if (isPageVisible && !isChatPage) {
                const now = Date.now();
                // فحص فوري فقط إذا مر أكثر من 5 ثواني منذ آخر فحص
                if (now - lastCheckTime > 5000) {
                    debouncedCheck();
                }
            }
        });
        
        // مراقبة focus/blur
        window.addEventListener('focus', () => {
            isPageVisible = true;
            if (!isChatPage) {
                const now = Date.now();
                if (now - lastCheckTime > 5000) {
                    debouncedCheck();
                }
            }
        });
        
        window.addEventListener('blur', () => {
            isPageVisible = false;
        });
    }
    
    // Debounce للفحص
    let debounceTimer = null;
    function debouncedCheck() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            checkForUnreadMessages();
        }, 500); // انتظار 500ms قبل الفحص
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
    
    // بدء التحقق من الرسائل الجديدة
    function startChecking() {
        if (checkInterval) {
            return; // يعمل بالفعل
        }
        
        // فحص فوري
        checkForUnreadMessages();
        
        // فحص دوري كل 30 ثانية (محسّن لتقليل الطلبات)
        checkInterval = setInterval(() => {
            // تحديث lastReadMessageId من localStorage قبل كل فحص
            loadLastReadMessageId();
            
            // فحص فقط إذا كانت الصفحة مرئية
            if (isPageVisible) {
                checkForUnreadMessages();
            }
        }, CHECK_INTERVAL);
    }
    
    // إيقاف التحقق
    function stopChecking() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }
    
    // ✅ تحسين الأداء: دالة لمعالجة الرسائل من MessagePollingManager
    function processMessagesForBadge(messages) {
        try {
            if (!currentUser || !currentUser.id) {
                return;
            }
            
            loadLastReadMessageId();
            
            if (messages && messages.length > 0) {
                let unreadCount = 0;
                
                messages.forEach(message => {
                    if (message.user_id !== currentUser.id && 
                        message.id && 
                        !message.id.startsWith('temp-') &&
                        (lastReadMessageId === '' || message.id > lastReadMessageId)) {
                        unreadCount++;
                    }
                });
                
                const now = Date.now();
                cachedResult = { count: unreadCount };
                cacheExpiry = now + CACHE_DURATION;
                
                updateBadge(unreadCount);
            } else {
                const now = Date.now();
                cachedResult = { count: 0 };
                cacheExpiry = now + CACHE_DURATION;
                updateBadge(0);
            }
        } catch (error) {
            console.error('خطأ في معالجة الرسائل للـ badge:', error);
        }
    }

    // التحقق من الرسائل غير المقروءة (Fallback)
    async function checkForUnreadMessages() {
        // ✅ تحسين الأداء: استخدام MessagePollingManager إذا كان متاحاً
        if (window.MessagePollingManager && window.MessagePollingManager.isActive) {
            const cachedResult = window.MessagePollingManager.getCachedResult();
            if (cachedResult && cachedResult.messages) {
                processMessagesForBadge(cachedResult.messages);
            }
            return;
        }

        try {
            if (!currentUser || !currentUser.id) {
                return;
            }
            
            // التحقق من cache
            const now = Date.now();
            if (cachedResult && cacheExpiry > now) {
                updateBadge(cachedResult.count);
                return;
            }
            
            // منع الطلبات المتكررة
            if (pendingCheck) {
                return;
            }
            
            pendingCheck = true;
            lastCheckTime = now;
            
            loadLastReadMessageId();
            
            const result = await API.request('get_messages.php?last_id=0', 'GET', null, { silent: true });
            
            pendingCheck = false;
            
            if (result && result.success && result.data && result.data.length > 0) {
                processMessagesForBadge(result.data);
            } else {
                cachedResult = { count: 0 };
                cacheExpiry = now + CACHE_DURATION;
                updateBadge(0);
            }
        } catch (error) {
            pendingCheck = false;
            console.error('خطأ في التحقق من الرسائل غير المقروءة:', error);
        }
    }
    
    // تحديث العداد
    function updateBadge(count) {
        try {
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
            
            // حفظ العدد في localStorage
            localStorage.setItem('chatUnreadCount', count.toString());
        } catch (e) {
            console.error('خطأ في تحديث العداد:', e);
        }
    }
    
    // دالة عامة لتحديث العداد من chat.js
    window.updateChatUnreadBadge = function(count) {
        updateBadge(count);
        // تحديث lastReadMessageId المحلي أيضاً
        if (count === 0) {
            // إذا تم تصفير العداد، تحديث lastReadMessageId من localStorage
            loadLastReadMessageId();
            // إعادة التحقق من الرسائل غير المقروءة
            debouncedCheck();
        }
        // إلغاء cache عند التحديث اليدوي
        cachedResult = null;
        cacheExpiry = 0;
    };
    
    // دالة لتحديث lastReadMessageId من chat.js
    window.updateLastReadMessageId = function(messageId) {
        if (messageId) {
            lastReadMessageId = messageId;
            try {
                localStorage.setItem('lastReadMessageId', messageId);
            } catch (e) {
                console.error('خطأ في حفظ lastReadMessageId:', e);
            }
            // إلغاء cache
            cachedResult = null;
            cacheExpiry = 0;
            // تحديث العداد بعد تحديث lastReadMessageId
            debouncedCheck();
        }
    };
    
    // الاستماع لتغييرات localStorage (عند فتح الشات من تبويب آخر)
    window.addEventListener('storage', function(e) {
        if (e.key === 'lastReadMessageId') {
            // تحديث lastReadMessageId عند تغييره في تبويب آخر
            loadLastReadMessageId();
            // إلغاء cache
            cachedResult = null;
            cacheExpiry = 0;
            // إعادة التحقق من الرسائل غير المقروءة
            debouncedCheck();
        }
    });
    
    // عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // عند إغلاق الصفحة
    window.addEventListener('beforeunload', stopChecking);
    
})();


/**
 * نظام عداد الرسائل غير المقروءة في الشريط الجانبي
 * يعمل في جميع الصفحات (dashboard.html وغيرها)
 */

(function() {
    'use strict';
    
    let checkInterval = null;
    let currentUser = null;
    let lastReadMessageId = '';
    let isChatPage = window.location.pathname.includes('chat.html');
    
    // تهيئة النظام
    async function init() {
        try {
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
            
            // إذا لم نكن في صفحة الشات، نبدأ التحقق من الرسائل الجديدة
            if (!isChatPage) {
                startChecking();
            } else {
                // في صفحة الشات، ننتظر حتى يتم تحميل الرسائل ثم نحدث العداد
                // سيتم استدعاء updateBadgeFromChat من chat.js
            }
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة عداد الرسائل غير المقروءة:', error);
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
    
    // بدء التحقق من الرسائل الجديدة
    function startChecking() {
        if (checkInterval) {
            return; // يعمل بالفعل
        }
        
        // فحص فوري
        checkForUnreadMessages();
        
        // فحص دوري كل 5 ثواني
        checkInterval = setInterval(() => {
            // تحديث lastReadMessageId من localStorage قبل كل فحص
            loadLastReadMessageId();
            checkForUnreadMessages();
        }, 5000);
    }
    
    // إيقاف التحقق
    function stopChecking() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }
    
    // التحقق من الرسائل غير المقروءة
    async function checkForUnreadMessages() {
        try {
            if (!currentUser || !currentUser.id) {
                return;
            }
            
            // تحديث lastReadMessageId من localStorage قبل التحقق
            loadLastReadMessageId();
            
            // جلب آخر رسالة
            const result = await API.request('get_messages.php?last_id=0', 'GET', null, { silent: true });
            
            if (result && result.success && result.data && result.data.length > 0) {
                // العثور على آخر رسالة
                const lastMessage = result.data[result.data.length - 1];
                
                if (lastMessage && lastMessage.id) {
                    // حساب عدد الرسائل غير المقروءة
                    let unreadCount = 0;
                    
                    result.data.forEach(message => {
                        // فقط الرسائل من مستخدمين آخرين بعد آخر رسالة مقروءة
                        if (message.user_id !== currentUser.id && 
                            message.id && 
                            !message.id.startsWith('temp-') &&
                            (lastReadMessageId === '' || message.id > lastReadMessageId)) {
                            unreadCount++;
                        }
                    });
                    
                    // تحديث العداد
                    updateBadge(unreadCount);
                } else {
                    // لا توجد رسائل، تصفير العداد
                    updateBadge(0);
                }
            } else {
                // لا توجد رسائل، تصفير العداد
                updateBadge(0);
            }
        } catch (error) {
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
            checkForUnreadMessages();
        }
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
            // تحديث العداد بعد تحديث lastReadMessageId
            checkForUnreadMessages();
        }
    };
    
    // الاستماع لتغييرات localStorage (عند فتح الشات من تبويب آخر)
    window.addEventListener('storage', function(e) {
        if (e.key === 'lastReadMessageId') {
            // تحديث lastReadMessageId عند تغييره في تبويب آخر
            loadLastReadMessageId();
            // إعادة التحقق من الرسائل غير المقروءة
            checkForUnreadMessages();
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


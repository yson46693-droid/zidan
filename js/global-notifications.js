/**
 * نظام الإشعارات المركزي - يعمل في جميع الصفحات
 * يستخدم Browser Notifications API بدون الحاجة لـ VAPID keys
 * محسّن لتقليل عدد الطلبات
 */

class GlobalNotificationManager {
    constructor() {
        this.checkInterval = null;
        this.lastMessageId = null;
        this.currentUser = null;
        this.isRunning = false;
        this.checkIntervalMs = 30000; // 30 ثانية (محسّن لتقليل الطلبات)
        this.isChatPage = window.location.pathname.includes('chat.html');
        this.activeNotifications = new Map(); // حفظ مراجع للإشعارات المفتوحة
        this.lastCheckTime = 0;
        this.cachedResult = null;
        this.cacheExpiry = 0;
        this.CACHE_DURATION = 5000; // 5 ثواني cache
        this.pendingCheck = false;
        this.isPageVisible = true;
    }

    // تهيئة النظام
    async init() {
        try {
            // الانتظار قليلاً لضمان تحميل API
            let retries = 0;
            while ((typeof API === 'undefined' || !API.request) && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }

            if (typeof API === 'undefined' || !API.request) {
                console.warn('⚠️ API غير متاح - سيتم المحاولة لاحقاً');
                // إعادة المحاولة بعد 2 ثانية
                setTimeout(() => this.init(), 2000);
                return;
            }

            // التحقق من تسجيل الدخول - استخدام checkLogin أولاً
            if (typeof checkLogin === 'function') {
                const user = await checkLogin();
                if (!user) {
                    console.log('📋 المستخدم غير مسجل دخول - إيقاف نظام الإشعارات');
                    // إيقاف النظام إذا كان يعمل
                    this.stop();
                    return; // المستخدم غير مسجل دخول
                }
                this.currentUser = user;
            } else {
                // إذا لم يكن checkLogin متاحاً، التحقق من localStorage
                // لكن هذا ليس آمناً، لذا نتوقف
                console.warn('⚠️ checkLogin غير متاح - إيقاف نظام الإشعارات');
                this.stop();
                return;
            }

            if (!this.currentUser || !this.currentUser.id) {
                console.warn('⚠️ بيانات المستخدم غير صحيحة');
                return;
            }

            // طلب صلاحيات الإشعارات
            await this.requestNotificationPermission();

            // تحميل آخر معرف رسالة
            this.loadLastMessageId();

            // إعداد مراقبة حالة الصفحة
            this.setupVisibilityListener();

            // 🔧 تحسين الأداء: تأجيل بدء النظام حتى بعد 3 ثواني لتقليل الطلبات الفورية
            if (!this.isChatPage) {
                // تأخير بدء النظام حتى بعد 3 ثواني أو عند التفاعل
                let notificationsStarted = false;
                const startNotificationsDelayed = () => {
                    if (!notificationsStarted) {
                        notificationsStarted = true;
                        this.start();
                    }
                };
                
                // بدء عند التفاعل الأول أو بعد 3 ثواني
                ['click', 'touchstart', 'mousemove'].forEach(event => {
                    document.addEventListener(event, startNotificationsDelayed, { once: true, passive: true });
                });
                setTimeout(startNotificationsDelayed, 3000); // تأخير 3 ثواني
            } else {
                // في صفحة الشات، لا نحتاج للتحقق لأن Long Polling يقوم بذلك
                console.log('📋 نظام الإشعارات يعمل في صفحة الشات - Long Polling يقوم بالتحقق');
            }

        } catch (error) {
            console.error('❌ خطأ في تهيئة نظام الإشعارات:', error);
        }
    }

    // إعداد مراقبة حالة الصفحة
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            // إذا أصبحت الصفحة مرئية، فحص فوري
            if (this.isPageVisible && !this.isChatPage && this.isRunning) {
                const now = Date.now();
                // فحص فوري فقط إذا مر أكثر من 5 ثواني منذ آخر فحص
                if (now - this.lastCheckTime > 5000) {
                    this.debouncedCheck();
                }
            }
        });
        
        // مراقبة focus/blur
        window.addEventListener('focus', () => {
            this.isPageVisible = true;
            if (!this.isChatPage && this.isRunning) {
                const now = Date.now();
                if (now - this.lastCheckTime > 5000) {
                    this.debouncedCheck();
                }
            }
        });
        
        window.addEventListener('blur', () => {
            this.isPageVisible = false;
        });
    }

    // Debounce للفحص
    debounceTimer = null;
    debouncedCheck() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.checkForNewMessages();
        }, 500); // انتظار 500ms قبل الفحص
    }

    // طلب صلاحيات الإشعارات
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('المتصفح لا يدعم الإشعارات');
            return;
        }

        if (Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.error('خطأ في طلب صلاحية الإشعارات:', error);
            }
        }
    }

    // تحميل آخر معرف رسالة من localStorage
    loadLastMessageId() {
        try {
            const lastId = localStorage.getItem('lastChatMessageId');
            if (lastId) {
                this.lastMessageId = lastId;
            } else {
                this.lastMessageId = '0';
            }
        } catch (error) {
            console.error('خطأ في تحميل آخر معرف رسالة:', error);
            this.lastMessageId = '0';
        }
    }

    // حفظ آخر معرف رسالة
    saveLastMessageId(messageId) {
        try {
            localStorage.setItem('lastChatMessageId', messageId);
            this.lastMessageId = messageId;
        } catch (error) {
            console.error('خطأ في حفظ آخر معرف رسالة:', error);
        }
    }

    // بدء النظام
    start() {
        if (this.isRunning) {
            console.log('⚠️ نظام الإشعارات يعمل بالفعل');
            return;
        }

        if (!this.currentUser) {
            console.warn('⚠️ لا يمكن بدء النظام - لا يوجد مستخدم');
            return;
        }

        this.isRunning = true;
        
        console.log('🚀 بدء نظام الإشعارات المركزي', {
            userId: this.currentUser.id,
            lastMessageId: this.lastMessageId,
            interval: this.checkIntervalMs
        });
        
        // فحص فوري بعد تأخير صغير
        setTimeout(() => {
            this.checkForNewMessages();
        }, 1000);

        // فحص دوري كل 30 ثانية (محسّن لتقليل الطلبات)
        this.checkInterval = setInterval(() => {
            // فحص فقط إذا كانت الصفحة مرئية
            if (this.isPageVisible) {
                this.checkForNewMessages();
            }
        }, this.checkIntervalMs);

        console.log('✅ تم بدء نظام الإشعارات المركزي');
    }

    // إيقاف النظام
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        console.log('⏸️ تم إيقاف نظام الإشعارات المركزي');
    }

    // التحقق من وجود رسائل جديدة
    async checkForNewMessages() {
        // منع الاستدعاء في صفحة الشات (Long Polling يقوم بذلك)
        if (this.isChatPage) {
            return;
        }
        
        if (!this.currentUser || !this.lastMessageId) {
            return;
        }

        // التحقق من cache
        const now = Date.now();
        if (this.cachedResult && this.cacheExpiry > now) {
            // استخدام النتيجة المخزنة
            return;
        }

        // منع الطلبات المتكررة
        if (this.pendingCheck) {
            return;
        }

        this.pendingCheck = true;
        this.lastCheckTime = now;

        try {
            // استخدام get_messages.php لجلب الرسائل الجديدة
            // مع silent flag لمنع عرض loading overlay
            const result = await API.request(`get_messages.php?last_id=${this.lastMessageId}`, 'GET', null, { silent: true });
            
            this.pendingCheck = false;
            
            if (result && result.success && result.data && result.data.length > 0) {
                let maxMessageId = this.lastMessageId;
                let hasNewMessages = false;
                
                // معالجة الرسائل الجديدة
                result.data.forEach(message => {
                    // عرض إشعار فقط للرسائل التي ليست من المستخدم الحالي
                    if (message.user_id !== this.currentUser.id) {
                        // التحقق من أن الرسالة جديدة (بعد lastMessageId)
                        if (this.lastMessageId === '0' || (message.id && message.id > this.lastMessageId)) {
                            this.showNotification(message);
                            hasNewMessages = true;
                        }
                    }
                    
                    // تحديث maxMessageId
                    if (message.id && (this.lastMessageId === '0' || message.id > maxMessageId)) {
                        maxMessageId = message.id;
                    }
                });
                
                // تحديث lastMessageId مرة واحدة فقط لأكبر id
                if (maxMessageId !== this.lastMessageId && maxMessageId !== '0') {
                    this.saveLastMessageId(maxMessageId);
                }
                
                // حفظ في cache
                this.cachedResult = { hasNewMessages };
                this.cacheExpiry = now + this.CACHE_DURATION;
            } else {
                // حفظ في cache
                this.cachedResult = { hasNewMessages: false };
                this.cacheExpiry = now + this.CACHE_DURATION;
            }
        } catch (error) {
            this.pendingCheck = false;
            console.error('خطأ في التحقق من الرسائل الجديدة:', error);
        }
    }

    // عرض إشعار للمستخدم
    showNotification(message) {
        // التحقق من عدم تكرار الإشعار (نفس message.id)
        const notificationKey = `notification_${message.id}`;
        const lastShownTime = localStorage.getItem(notificationKey);
        const now = Date.now();
        
        // إذا تم عرض الإشعار خلال آخر 5 دقائق، تخطيه
        if (lastShownTime && (now - parseInt(lastShownTime)) < 300000) {
            console.log('⚠️ تم عرض هذا الإشعار مؤخراً - تخطي');
            return;
        }
        
        // حفظ وقت عرض الإشعار
        localStorage.setItem(notificationKey, now.toString());
        
        // التحقق من صلاحيات الإشعارات
        if (!('Notification' in window)) {
            console.warn('⚠️ المتصفح لا يدعم الإشعارات');
            return;
        }

        if (Notification.permission !== 'granted') {
            console.log('⚠️ صلاحيات الإشعارات غير مُعطاة:', Notification.permission);
            return;
        }

        // التحقق من أن المستخدم ليس في صفحة الشات النشطة
        if (this.isChatPage && document.hasFocus()) {
            console.log('📱 المستخدم في صفحة الشات النشطة - لا حاجة لإشعار');
            // لكن نضيفه إلى قائمة الإشعارات في chat.js
            this.addToChatNotificationsList(message);
            return;
        }

        // إعداد بيانات الإشعار
        const title = 'رسالة جديدة في الشات';
        const senderName = message.username || 'مستخدم';
        const messageBody = this.formatMessageBody(message);
        const timeText = this.formatTime(message.created_at);
        
        // بناء نص الإشعار: اسم المرسل - محتوى الرسالة - التوقيت
        const body = `${senderName}: ${messageBody}\n${timeText}`;
        
        // استخدام مسارات نسبية للأيقونات
        let icon = '/icons/icon-192x192.png';
        let badge = '/icons/icon-72x72.png';
        
        // التحقق من المسار الحالي
        const basePath = window.location.pathname.includes('/zidan/') ? '/zidan' : '';
        if (basePath) {
            icon = basePath + icon;
            badge = basePath + badge;
        }

        try {
            console.log('🔔 عرض إشعار:', { title, body, messageId: message.id });
            
            const notificationTag = 'chat-' + (message.id || Date.now());
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                badge: badge,
                dir: 'rtl',
                lang: 'ar',
                tag: notificationTag,
                data: {
                    messageId: message.id,
                    userId: message.user_id,
                    url: basePath + '/chat.html'
                },
                requireInteraction: false,
                silent: false
            });

            // حفظ مرجع للإشعار
            this.activeNotifications.set(notificationTag, notification);

            // معالجة إغلاق الإشعار
            notification.onclose = () => {
                // إزالة المرجع عند إغلاق الإشعار
                this.activeNotifications.delete(notificationTag);
            };

            // معالجة النقر على الإشعار
            notification.onclick = async () => {
                window.focus();
                notification.close();
                
                // التحقق من تسجيل الدخول قبل الانتقال
                try {
                    if (typeof checkLogin === 'function') {
                        const user = await checkLogin();
                        if (!user) {
                            console.log('❌ المستخدم غير مسجل دخول - إعادة التوجيه إلى صفحة تسجيل الدخول');
                            window.location.href = basePath + '/index.html';
                            return;
                        }
                    }
                    
                    // الانتقال إلى صفحة الشات
                    const currentPath = window.location.pathname;
                    const chatPath = basePath + '/chat.html';
                    if (currentPath !== chatPath && !currentPath.includes('chat.html')) {
                        window.location.href = chatPath;
                    }
                } catch (error) {
                    console.error('❌ خطأ في فحص تسجيل الدخول:', error);
                    window.location.href = basePath + '/index.html';
                }
            };

            // إغلاق الإشعار تلقائياً بعد 10 ثواني
            setTimeout(() => {
                if (this.activeNotifications.has(notificationTag)) {
                    notification.close();
                }
            }, 10000);

            console.log('✅ تم عرض الإشعار بنجاح');
            
            // إضافة الإشعار إلى قائمة الإشعارات في chat.js
            this.addToChatNotificationsList(message);

        } catch (error) {
            console.error('❌ خطأ في عرض الإشعار:', error);
        }
    }
    
    // إضافة الإشعار إلى قائمة الإشعارات في chat.js
    addToChatNotificationsList(message) {
        try {
            // التحقق من وجود دالة addChatNotification من chat.js
            if (typeof window.addChatNotification === 'function') {
                window.addChatNotification({
                    id: message.id,
                    username: message.username || 'مستخدم',
                    message: this.formatMessageBody(message),
                    timestamp: message.created_at || new Date().toISOString(),
                    read: false
                });
                console.log('✅ تم إضافة الإشعار إلى قائمة الإشعارات');
            } else {
                // إذا لم تكن الدالة متاحة، حفظ في localStorage مباشرة
                // سيتم تحميلها عند فتح صفحة الشات
                this.saveNotificationToLocalStorage(message);
            }
        } catch (error) {
            console.error('❌ خطأ في إضافة الإشعار إلى القائمة:', error);
            // محاولة الحفظ في localStorage كبديل
            this.saveNotificationToLocalStorage(message);
        }
    }
    
    // حفظ الإشعار في localStorage للتحميل لاحقاً
    saveNotificationToLocalStorage(message) {
        try {
            const saved = localStorage.getItem('chat_notifications');
            let notifications = saved ? JSON.parse(saved) : [];
            
            // التحقق من عدم التكرار
            const existingIndex = notifications.findIndex(n => n.id === message.id);
            if (existingIndex === -1) {
                notifications.unshift({
                    id: message.id,
                    username: message.username || 'مستخدم',
                    message: this.formatMessageBody(message),
                    timestamp: message.created_at || new Date().toISOString(),
                    read: false
                });
                
                // حفظ فقط آخر 50 إشعار
                notifications = notifications.slice(0, 50);
                localStorage.setItem('chat_notifications', JSON.stringify(notifications));
                console.log('✅ تم حفظ الإشعار في localStorage');
            }
        } catch (error) {
            console.error('❌ خطأ في حفظ الإشعار في localStorage:', error);
        }
    }

    // تنسيق نص الرسالة للإشعار
    formatMessageBody(message) {
        if (message.file_type === 'image') {
            return '📷 صورة' + (message.message && message.message !== '📷 صورة' ? ': ' + message.message : '');
        } else if (message.file_type === 'file') {
            return '📎 ملف' + (message.file_name ? ': ' + message.file_name : '') + (message.message && !message.message.startsWith('📎 ملف:') ? ' - ' + message.message : '');
        } else {
            // تقصير الرسالة الطويلة
            const text = message.message || '';
            return text.length > 100 ? text.substring(0, 100) + '...' : text;
        }
    }

    // تنسيق التوقيت للإشعار
    formatTime(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            
            // إذا كانت أقل من دقيقة
            if (diff < 60000) {
                return 'الآن';
            }
            
            // إذا كانت اليوم
            if (diff < 86400000 && date.getDate() === now.getDate()) {
                return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
            }
            
            // إذا كانت أمس
            if (diff < 172800000) {
                return 'أمس';
            }
            
            // تاريخ كامل
            return date.toLocaleDateString('ar-EG', { 
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'Africa/Cairo'
            });
        } catch (error) {
            console.error('خطأ في تنسيق التوقيت:', error);
            return '';
        }
    }

    // حذف جميع إشعارات الرسائل
    clearChatNotifications() {
        try {
            // إغلاق جميع الإشعارات المفتوحة
            let closedCount = 0;
            this.activeNotifications.forEach((notification, tag) => {
                try {
                    if (tag.startsWith('chat-')) {
                        notification.close();
                        closedCount++;
                    }
                } catch (error) {
                    console.error('خطأ في إغلاق الإشعار:', error);
                }
            });
            this.activeNotifications.clear();
            
            // حذف آخر معرف رسالة من localStorage لإجبار النظام على إعادة الجلب
            localStorage.removeItem('lastChatMessageId');
            this.lastMessageId = '0';
            
            // إلغاء cache
            this.cachedResult = null;
            this.cacheExpiry = 0;
            
            // حذف جميع مفاتيح الإشعارات المعروضة (لإعادة عرضها عند الحاجة)
            // لكن نتركها لتجنب التكرار
            // يمكن حذفها يدوياً إذا لزم الأمر
            
            console.log(`✅ تم حذف إشعارات الرسائل (تم إغلاق ${closedCount} إشعار)`);
        } catch (error) {
            console.error('خطأ في حذف إشعارات الرسائل:', error);
        }
    }
}

// إنشاء مثيل عام
const globalNotificationManager = new GlobalNotificationManager();

// تهيئة عند تحميل الصفحة
function initializeNotifications() {
    // الانتظار حتى يتم تحميل API و auth
    const checkAndInit = () => {
        if (typeof API !== 'undefined' && API.request) {
            // إضافة تأخير إضافي للتأكد من تحميل كل شيء
            setTimeout(() => {
                globalNotificationManager.init();
            }, 500);
        } else {
            // إعادة المحاولة بعد 200ms
            setTimeout(checkAndInit, 200);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(checkAndInit, 300);
        });
    } else {
        checkAndInit();
    }
}

// بدء التهيئة
initializeNotifications();

// إيقاف النظام عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    globalNotificationManager.stop();
});

// ملاحظة: تم إيقاف النظام خارج صفحة الشات
// لا حاجة لتغيير حالة النظام عند تغيير حالة التاب

// تصدير للاستخدام العام
window.GlobalNotificationManager = globalNotificationManager;


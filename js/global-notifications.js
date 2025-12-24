/**
 * نظام الإشعارات المركزي - يعمل في جميع الصفحات
 * يستخدم Browser Notifications API بدون الحاجة لـ VAPID keys
 */

class GlobalNotificationManager {
    constructor() {
        this.checkInterval = null;
        this.lastMessageId = null;
        this.currentUser = null;
        this.isRunning = false;
        this.checkIntervalMs = 5000; // التحقق كل 5 ثواني
        this.isChatPage = window.location.pathname.includes('chat.html');
        this.activeNotifications = new Map(); // حفظ مراجع للإشعارات المفتوحة
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

            // بدء النظام للتحقق من الرسائل الجديدة في جميع الصفحات
            if (!this.isChatPage) {
                // في صفحات أخرى، نبدأ النظام للتحقق من الرسائل الجديدة
                this.start();
            } else {
                // في صفحة الشات، لا نحتاج للتحقق لأن Long Polling يقوم بذلك
                console.log('📋 نظام الإشعارات يعمل في صفحة الشات - Long Polling يقوم بالتحقق');
            }

        } catch (error) {
            console.error('❌ خطأ في تهيئة نظام الإشعارات:', error);
        }
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

        // فحص دوري
        this.checkInterval = setInterval(() => {
            this.checkForNewMessages();
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

        try {
            // استخدام get_messages.php لجلب الرسائل الجديدة
            // مع silent flag لمنع عرض loading overlay
            const result = await API.request(`get_messages.php?last_id=${this.lastMessageId}`, 'GET', null, { silent: true });
            
            if (result && result.success && result.data && result.data.length > 0) {
                let maxMessageId = this.lastMessageId;
                
                // معالجة الرسائل الجديدة
                result.data.forEach(message => {
                    // عرض إشعار فقط للرسائل التي ليست من المستخدم الحالي
                    if (message.user_id !== this.currentUser.id) {
                        this.showNotification(message);
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
            }
        } catch (error) {
            console.error('خطأ في التحقق من الرسائل الجديدة:', error);
        }
    }

    // عرض إشعار للمستخدم
    showNotification(message) {
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
            return; // المستخدم في صفحة الشات، لا حاجة لإشعار
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

        } catch (error) {
            console.error('❌ خطأ في عرض الإشعار:', error);
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


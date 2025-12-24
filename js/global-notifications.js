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
    }

    // تهيئة النظام
    async init() {
        try {
            // التحقق من تسجيل الدخول
            if (typeof checkLogin === 'function') {
                const user = await checkLogin();
                if (!user) {
                    return; // المستخدم غير مسجل دخول
                }
                this.currentUser = user;
            } else {
                // محاولة الحصول من localStorage
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    this.currentUser = JSON.parse(userStr);
                } else {
                    return; // لا يوجد مستخدم
                }
            }

            // طلب صلاحيات الإشعارات
            await this.requestNotificationPermission();

            // تحميل آخر معرف رسالة
            this.loadLastMessageId();

            // بدء النظام (إلا إذا كنا في صفحة الشات - لديها نظامها الخاص)
            if (!this.isChatPage) {
                this.start();
            }

        } catch (error) {
            console.error('خطأ في تهيئة نظام الإشعارات:', error);
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
            return;
        }

        this.isRunning = true;
        
        // فحص فوري
        this.checkForNewMessages();

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
        if (!this.currentUser || !this.isRunning) {
            return;
        }

        try {
            // استخدام API الموجود
            if (typeof API === 'undefined' || !API.request) {
                return;
            }

            const url = `get_messages.php${this.lastMessageId && this.lastMessageId !== '0' ? '?last_id=' + encodeURIComponent(this.lastMessageId) : ''}`;
            const result = await API.request(url);

            if (result && result.success && result.data && Array.isArray(result.data)) {
                // فلترة الرسائل الجديدة فقط
                const newMessages = result.data.filter(msg => {
                    // تجنب الرسائل الخاصة بالمستخدم الحالي
                    if (msg.user_id === this.currentUser.id) {
                        return false;
                    }
                    // تجنب الرسائل القديمة
                    if (this.lastMessageId && msg.id <= this.lastMessageId) {
                        return false;
                    }
                    return true;
                });

                if (newMessages.length > 0) {
                    // تحديث آخر معرف رسالة
                    newMessages.forEach(msg => {
                        if (!this.lastMessageId || msg.id > this.lastMessageId) {
                            this.saveLastMessageId(msg.id);
                        }
                    });

                    // إرسال إشعارات للرسائل الجديدة
                    newMessages.forEach(message => {
                        this.showNotification(message);
                    });
                }
            }

        } catch (error) {
            console.error('خطأ في التحقق من الرسائل الجديدة:', error);
        }
    }

    // عرض إشعار للمستخدم
    showNotification(message) {
        // التحقق من صلاحيات الإشعارات
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        // التحقق من أن المستخدم ليس في صفحة الشات النشطة
        if (this.isChatPage && document.hasFocus()) {
            return; // المستخدم في صفحة الشات، لا حاجة لإشعار
        }

        // إعداد بيانات الإشعار
        const title = message.username || 'مستخدم';
        const body = this.formatMessageBody(message);
        const icon = '/icons/icon-192x192.png';
        const badge = '/icons/icon-72x72.png';

        try {
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                badge: badge,
                dir: 'rtl',
                lang: 'ar',
                tag: message.id,
                data: {
                    messageId: message.id,
                    userId: message.user_id,
                    url: '/chat.html'
                },
                requireInteraction: false,
                silent: false
            });

            // معالجة النقر على الإشعار
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // الانتقال إلى صفحة الشات
                if (window.location.pathname !== '/chat.html' && window.location.pathname !== '/zidan/chat.html') {
                    window.location.href = '/chat.html';
                }
            };

            // إغلاق الإشعار تلقائياً بعد 5 ثواني
            setTimeout(() => {
                notification.close();
            }, 5000);

        } catch (error) {
            console.error('خطأ في عرض الإشعار:', error);
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
}

// إنشاء مثيل عام
const globalNotificationManager = new GlobalNotificationManager();

// تهيئة عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        globalNotificationManager.init();
    });
} else {
    globalNotificationManager.init();
}

// إيقاف النظام عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    globalNotificationManager.stop();
});

// استئناف/إيقاف عند تغيير حالة التاب
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // التاب مخفي - تأكد من أن النظام يعمل
        if (!globalNotificationManager.isRunning && !globalNotificationManager.isChatPage) {
            globalNotificationManager.start();
        }
    } else {
        // التاب مرئي - إذا كان في صفحة الشات، لا حاجة لإشعارات
        if (globalNotificationManager.isChatPage) {
            globalNotificationManager.stop();
        }
    }
});

// تصدير للاستخدام العام
window.GlobalNotificationManager = globalNotificationManager;


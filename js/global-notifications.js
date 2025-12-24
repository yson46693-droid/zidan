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

            // جلب آخر رسالة لضبط lastMessageId بشكل صحيح
            if (!this.lastMessageId || this.lastMessageId === '0') {
                try {
                    const result = await API.request('get_messages.php');
                    if (result && result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
                        // الحصول على آخر رسالة
                        const lastMessage = result.data[result.data.length - 1];
                        if (lastMessage && lastMessage.id) {
                            this.saveLastMessageId(lastMessage.id);
                            console.log('📝 تم ضبط آخر معرف رسالة:', lastMessage.id);
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ فشل جلب آخر رسالة:', error);
                }
            }

            // بدء النظام (إلا إذا كنا في صفحة الشات - لديها نظامها الخاص)
            if (!this.isChatPage) {
                // تأخير صغير قبل البدء
                setTimeout(() => {
                    this.start();
                }, 1000);
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
        if (!this.currentUser || !this.isRunning) {
            return;
        }

        try {
            // استخدام API الموجود
            if (typeof API === 'undefined' || !API.request) {
                console.warn('⚠️ API غير متاح في checkForNewMessages');
                return;
            }

            const url = `get_messages.php${this.lastMessageId && this.lastMessageId !== '0' ? '?last_id=' + encodeURIComponent(this.lastMessageId) : ''}`;
            
            const result = await API.request(url);

            if (result && result.success && result.data && Array.isArray(result.data)) {
                // فلترة الرسائل الجديدة فقط
                const newMessages = result.data.filter(msg => {
                    if (!msg || !msg.id) {
                        return false;
                    }
                    
                    // تجنب الرسائل الخاصة بالمستخدم الحالي
                    if (msg.user_id === this.currentUser.id) {
                        // تحديث lastMessageId حتى لو كانت رسالة المستخدم
                        if (!this.lastMessageId || String(msg.id).localeCompare(String(this.lastMessageId)) > 0) {
                            this.saveLastMessageId(msg.id);
                        }
                        return false;
                    }
                    
                    // تجنب الرسائل القديمة - استخدام مقارنة strings للـ IDs
                    if (this.lastMessageId && this.lastMessageId !== '0') {
                        // مقارنة IDs كـ strings
                        const msgIdStr = String(msg.id);
                        const lastIdStr = String(this.lastMessageId);
                        
                        // إذا كان ID الرسالة أصغر من أو يساوي آخر ID، تجاهلها
                        if (msgIdStr.localeCompare(lastIdStr) <= 0) {
                            return false;
                        }
                    }
                    
                    return true;
                });

                if (newMessages.length > 0) {
                    console.log(`🔔 تم العثور على ${newMessages.length} رسالة جديدة`);
                    
                    // تحديث آخر معرف رسالة لأكبر ID
                    let maxId = this.lastMessageId || '0';
                    newMessages.forEach(msg => {
                        const msgIdStr = String(msg.id);
                        if (msgIdStr.localeCompare(String(maxId)) > 0) {
                            maxId = msg.id;
                        }
                    });
                    if (maxId !== this.lastMessageId) {
                        this.saveLastMessageId(maxId);
                    }

                    // إرسال إشعارات للرسائل الجديدة
                    newMessages.forEach(message => {
                        this.showNotification(message);
                    });
                }
            }

        } catch (error) {
            console.error('❌ خطأ في التحقق من الرسائل الجديدة:', error);
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
        const title = message.username || 'مستخدم';
        const body = this.formatMessageBody(message);
        
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
            
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                badge: badge,
                dir: 'rtl',
                lang: 'ar',
                tag: 'chat-' + (message.id || Date.now()),
                data: {
                    messageId: message.id,
                    userId: message.user_id,
                    url: basePath + '/chat.html'
                },
                requireInteraction: false,
                silent: false
            });

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
                notification.close();
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


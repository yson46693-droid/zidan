/**
 * Message Polling Manager - مدير موحد لـ polling الرسائل
 * يمنع التكرار ويوحد جميع polling instances في واحد
 */

(function() {
    'use strict';

    class MessagePollingManager {
        constructor() {
            this.isActive = false;
            this.pollingInterval = null;
            this.pollingIntervalMs = 10000; // 10 ثواني
            this.lastPollTime = 0;
            this.pendingPoll = false;
            this.subscribers = new Set(); // مشتركين في النتائج
            this.cachedResult = null;
            this.cacheExpiry = 0;
            this.CACHE_DURATION = 5000; // 5 ثواني cache
            this.currentUser = null;
            this.lastMessageId = '0';
        }

        // بدء polling
        start() {
            if (this.isActive) {
                console.log('[Message Polling] Polling نشط بالفعل');
                return;
            }

            // ✅ منع polling في صفحة الشات وصفحة تسجيل الدخول
            const pathname = window.location.pathname;
            if (pathname.includes('chat.html')) {
                console.log('[Message Polling] في صفحة الشات - لا حاجة للـ polling');
                return;
            }
            if (pathname.includes('index.html') || pathname === '/' || pathname.endsWith('/')) {
                console.log('[Message Polling] في صفحة تسجيل الدخول - لا حاجة للـ polling');
                return;
            }

            this.isActive = true;
            this.currentUser = this.getCurrentUser();
            this.loadLastMessageId();

            console.log('[Message Polling] بدء polling موحد للرسائل');

            // فحص فوري أولاً
            this.poll();

            // فحص دوري
            this.pollingInterval = setInterval(() => {
                this.poll();
            }, this.pollingIntervalMs);

        // ✅ حفظ مراجع event listeners للتنظيف
        this.visibilityChangeListener = () => {
            if (!document.hidden && this.isActive) {
                this.poll();
            }
        };
        this.focusListener = () => {
            if (this.isActive) {
                this.poll();
            }
        };
        
        document.addEventListener('visibilitychange', this.visibilityChangeListener);
        window.addEventListener('focus', this.focusListener);
        }

        // إيقاف polling
        stop() {
            if (!this.isActive) {
                return;
            }

            this.isActive = false;
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            
            // ✅ إزالة event listeners
            if (this.visibilityChangeListener) {
                document.removeEventListener('visibilitychange', this.visibilityChangeListener);
                this.visibilityChangeListener = null;
            }
            if (this.focusListener) {
                window.removeEventListener('focus', this.focusListener);
                this.focusListener = null;
            }

            console.log('[Message Polling] تم إيقاف polling');
        }

        // إضافة مشترك (subscriber)
        subscribe(callback) {
            this.subscribers.add(callback);
            // إرسال النتيجة المحفوظة فوراً إذا كانت موجودة
            if (this.cachedResult) {
                try {
                    callback(this.cachedResult);
                } catch (e) {
                    console.error('[Message Polling] خطأ في callback:', e);
                }
            }
        }

        // إزالة مشترك
        unsubscribe(callback) {
            this.subscribers.delete(callback);
        }

        // تنفيذ polling
        async poll() {
            // ✅ منع polling في صفحة الشات وصفحة تسجيل الدخول
            const pathname = window.location.pathname;
            if (pathname.includes('chat.html')) {
                return;
            }
            if (pathname.includes('index.html') || pathname === '/' || pathname.endsWith('/')) {
                return;
            }

            // منع الطلبات المتكررة
            if (this.pendingPoll) {
                return;
            }

            // التحقق من cache
            const now = Date.now();
            if (this.cachedResult && this.cacheExpiry > now) {
                // استخدام النتيجة المخزنة
                this.notifySubscribers(this.cachedResult);
                return;
            }

            // منع polling المتكرر جداً (أقل من ثانيتين)
            if (now - this.lastPollTime < 2000) {
                return;
            }

            this.pendingPoll = true;
            this.lastPollTime = now;

            try {
                // تحديث lastMessageId من localStorage
                this.loadLastMessageId();

                // جلب الرسائل
                const result = await API.request(`get_messages.php?last_id=${this.lastMessageId}`, 'GET', null, { silent: true });

                if (result && result.success && result.data) {
                    const messages = result.data || [];
                    
                    // تحديث lastMessageId
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        if (lastMessage && lastMessage.id) {
                            this.lastMessageId = lastMessage.id;
                            this.saveLastMessageId(this.lastMessageId);
                        }
                    }

                    // حفظ في cache
                    this.cachedResult = {
                        messages: messages,
                        hasNewMessages: messages.length > 0,
                        timestamp: now
                    };
                    this.cacheExpiry = now + this.CACHE_DURATION;

                    // إشعار المشتركين
                    this.notifySubscribers(this.cachedResult);
                } else {
                    // لا توجد رسائل جديدة
                    this.cachedResult = {
                        messages: [],
                        hasNewMessages: false,
                        timestamp: now
                    };
                    this.cacheExpiry = now + this.CACHE_DURATION;
                    this.notifySubscribers(this.cachedResult);
                }
            } catch (error) {
                console.error('[Message Polling] خطأ في polling:', error);
            } finally {
                this.pendingPoll = false;
            }
        }

        // إشعار المشتركين
        notifySubscribers(result) {
            this.subscribers.forEach(callback => {
                try {
                    callback(result);
                } catch (e) {
                    console.error('[Message Polling] خطأ في callback:', e);
                }
            });
        }

        // الحصول على المستخدم الحالي
        getCurrentUser() {
            try {
                const userStr = localStorage.getItem('currentUser');
                return userStr ? JSON.parse(userStr) : null;
            } catch (e) {
                return null;
            }
        }

        // تحميل lastMessageId من localStorage
        loadLastMessageId() {
            try {
                const saved = localStorage.getItem('lastReadMessageId');
                if (saved) {
                    this.lastMessageId = saved;
                }
            } catch (e) {
                // ignore
            }
        }

        // حفظ lastMessageId في localStorage
        saveLastMessageId(messageId) {
            try {
                localStorage.setItem('lastReadMessageId', messageId);
            } catch (e) {
                // ignore
            }
        }

        // الحصول على النتيجة المحفوظة
        getCachedResult() {
            return this.cachedResult;
        }
    }

    // إنشاء instance واحد فقط
    window.MessagePollingManager = window.MessagePollingManager || new MessagePollingManager();

    // ✅ بدء polling تلقائياً عند تحميل الصفحة (بعد 2 ثانية) - فقط إذا لم تكن صفحة تسجيل الدخول
    const pathname = window.location.pathname;
    const isLoginPage = pathname.includes('index.html') || pathname === '/' || pathname.endsWith('/');
    
    if (!isLoginPage) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    window.MessagePollingManager.start();
                }, 2000);
            });
        } else {
            setTimeout(() => {
                window.MessagePollingManager.start();
            }, 2000);
        }
    } else {
        console.log('[Message Polling] صفحة تسجيل الدخول - لن يتم بدء polling');
    }

    console.log('[Message Polling] تم تحميل Message Polling Manager');
})();


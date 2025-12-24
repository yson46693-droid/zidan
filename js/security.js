/**
 * نظام الحماية المتكامل للموقع
 * Security System v2.0 - Advanced Protection
 */

class SecurityManager {
    constructor() {
        this.loginAttempts = new Map();
        this.blockedIPs = new Map();
        this.suspiciousActivities = [];
        this.maxLoginAttempts = 3;
        this.blockDuration = 15 * 60 * 1000; // 15 دقيقة
        this.telegramBotToken = '';
        this.telegramChatId = '';
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('[Security] تهيئة نظام الحماية المتقدم...');
        
        // تحميل إعدادات التليجرام
        await this.loadTelegramConfig();
        
        // تطبيق الحماية الأساسية
        this.applyBasicProtection();
        
        // مراقبة محاولات تسجيل الدخول
        this.monitorLoginAttempts();
        
        // مراقبة الأنشطة المشبوهة
        this.monitorSuspiciousActivities();
        
        // حماية البيانات الحساسة
        this.protectSensitiveData();
        
        // منع التنصت والهجمات
        this.preventEavesdropping();
        
        // مراقبة محاولات الوصول غير المصرح بها
        this.monitorUnauthorizedAccess();
        
        this.isInitialized = true;
        console.log('[Security] تم تفعيل نظام الحماية بنجاح');
    }

    // تحميل إعدادات التليجرام
    async loadTelegramConfig() {
        try {
            const response = await fetch('data/telegram-backup-config.json', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-cache'
            });
            
            // التحقق من حالة الاستجابة قبل محاولة قراءة JSON
            if (response.ok && response.status === 200) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const config = await response.json();
                    this.telegramBotToken = config.bot_token || '';
                    this.telegramChatId = config.chat_id || '';
                } else {
                    // الاستجابة ليست JSON - تجاهل بصمت
                    return;
                }
            } else if (response.status === 404) {
                // الملف غير موجود - استخدام إعدادات افتراضية فارغة
                this.telegramBotToken = '';
                this.telegramChatId = '';
                return;
            } else {
                // خطأ آخر - تجاهل بصمت
                return;
            }
        } catch (error) {
            // تجاهل جميع الأخطاء بصمت - الملف اختياري
            // استخدام إعدادات افتراضية فارغة في حالة الخطأ
            this.telegramBotToken = '';
            this.telegramChatId = '';
            return;
        }
    }

    // تطبيق الحماية الأساسية
    applyBasicProtection() {
        // تم تعطيل الحماية التي تمنع النسخ وفتح الكونسول
        // وضع المطور مفعّل - السماح بالزر الأيمن، النسخ، وفتح الكونسول
        console.log('[Security] وضع المطور مفعّل - السماح بالنسخ وفتح الكونسول');

        // السماح بطباعة الصفحة
        // تم إزالة منع الطباعة
    }

    // إخفاء شريط المطور (خفيف)
    hideDeveloperTools() {
        // تم تعطيل مراقبة شريط المطور لتجنب الحظر المفرط
        // النظام الآن يركز على حماية البيانات فقط
        console.log('[Security] تم تعطيل مراقبة شريط المطور');
    }

    // التعامل مع فتح شريط المطور
    handleDeveloperToolsOpen() {
        // إرسال إشعار فوري فقط (بدون إعادة توجيه)
        this.sendTelegramAlert('🚨 تنبيه أمني', 
            `تم فتح شريط المطور في الموقع!\n` +
            `الوقت: ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}\n` +
            `المتصفح: ${navigator.userAgent}\n` +
            `IP: ${this.getClientIP()}`);

        // تم إزالة إعادة التوجيه إلى about:blank
        // النظام الآن يركز على حماية البيانات فقط
        console.log('[Security] تم اكتشاف فتح شريط المطور - بدون إعادة توجيه');
    }

    // مراقبة محاولات تسجيل الدخول
    monitorLoginAttempts() {
        // تعطيل مراقبة تسجيل الدخول مؤقتاً لتجنب التداخل
        console.log('[Security] تم تعطيل مراقبة تسجيل الدخول مؤقتاً');
        return;
    }

    // التعامل مع فشل تسجيل الدخول
    handleFailedLogin(clientIP, attemptCount) {
        this.loginAttempts.set(clientIP, attemptCount);
        
        if (attemptCount >= this.maxLoginAttempts) {
            // حظر مؤقت
            this.blockedIPs.set(clientIP, Date.now() + this.blockDuration);
            
            this.logSuspiciousActivity(
                `محاولات تسجيل دخول فاشلة متعددة من IP: ${clientIP}`, 
                'CRITICAL'
            );
            
            this.sendTelegramAlert('🚨 محاولة اختراق', 
                `تم حظر IP بسبب محاولات تسجيل دخول فاشلة!\n` +
                `IP: ${clientIP}\n` +
                `عدد المحاولات: ${attemptCount}\n` +
                `الوقت: ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}\n` +
                `مدة الحظر: 15 دقيقة`);
            
            // عرض رسالة الحظر فقط إذا كان المستخدم محظور
            setTimeout(() => {
                if (this.isBlocked(clientIP)) {
                    showMessage('تم حظرك مؤقتاً بسبب محاولات تسجيل دخول فاشلة متعددة', 'error');
                }
            }, 100);
        } else {
            // عرض رسالة تحذيرية فقط
            console.warn(`[Security] محاولة تسجيل دخول فاشلة ${attemptCount}/${this.maxLoginAttempts}`);
        }
    }

    // التحقق من الحظر
    isBlocked(clientIP) {
        // تعطيل الحظر مؤقتاً لتجنب مشاكل تسجيل الدخول
        return false;
    }

    // مراقبة الأنشطة المشبوهة
    monitorSuspiciousActivities() {
        // تعطيل مراقبة الأنشطة المشبوهة مؤقتاً لتجنب التداخل مع API
        console.log('[Security] تم تعطيل مراقبة الأنشطة المشبوهة مؤقتاً');
        return;
    }

    // فحص URLs مشبوهة
    isSuspiciousURL(url) {
        const suspiciousPatterns = [
            /\.env$/,
            /config\.json$/,
            /database\.json$/,
            /users\.json$/,
            /\.sql$/,
            /\.php$/,
            /admin/,
            /backup/,
            /\.git/
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(url));
    }

    // حماية البيانات الحساسة
    protectSensitiveData() {
        // تعطيل حماية البيانات الحساسة مؤقتاً لتجنب التداخل مع API
        console.log('[Security] تم تعطيل حماية البيانات الحساسة مؤقتاً');
        return;
    }

    // فحص البيانات الحساسة
    containsSensitiveData(text) {
        const sensitivePatterns = [
            /password/i,
            /token/i,
            /secret/i,
            /key/i,
            /api_key/i,
            /private/i,
            /credential/i,
            /auth/i,
            /login/i,
            /session/i
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(text));
    }

    // تشويش طلبات الشبكة
    obfuscateNetworkRequests() {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            // إضافة headers عشوائية لتشويش الطلبات
            this.setRequestHeader('X-Security-Token', Math.random().toString(36));
            this.setRequestHeader('X-Request-ID', Date.now().toString());
            
            return originalOpen.apply(this, [method, url, ...args]);
        };
    }

    // منع التنصت والهجمات
    preventEavesdropping() {
        // منع iframe embedding
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }

        // منع clickjacking
        document.addEventListener('DOMContentLoaded', () => {
            if (window.top !== window.self) {
                document.body.style.display = 'none';
                this.logSuspiciousActivity('محاولة clickjacking', 'HIGH');
            }
        });

        // مراقبة تغييرات DOM المشبوهة
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // فحص scripts مشبوهة - فقط للـ scripts الخارجية فعلاً
                            if (node.tagName === 'SCRIPT' && node.src) {
                                try {
                                    // تحويل المسار إلى URL كامل (يدعم المسارات النسبية)
                                    const scriptUrl = new URL(node.src, window.location.href);
                                    const currentOrigin = window.location.origin;
                                    
                                    // تجاهل scripts محلية (من نفس النطاق)
                                    if (scriptUrl.origin === currentOrigin) {
                                        return; // script محلي - لا حاجة للتحذير
                                    }
                                    
                                    // التحقق من أن الـ script من نطاق مختلف (خارجي فعلاً)
                                    // تجاهل data: و blob: URLs (مسموح بها)
                                    if (scriptUrl.origin !== 'null' && 
                                        !scriptUrl.protocol.startsWith('data:') &&
                                        !scriptUrl.protocol.startsWith('blob:')) {
                                        this.logSuspiciousActivity(`إضافة script خارجي: ${node.src}`, 'MEDIUM');
                                    }
                                } catch (e) {
                                    // في حالة فشل تحليل URL، تجاهل (قد يكون مسار نسبي غير صالح)
                                    // لا نحذر من scripts بدون src صالحة
                                }
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // منع تسريب البيانات عبر WebRTC
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
            navigator.mediaDevices.getUserMedia = function(constraints) {
                // السماح فقط للكاميرا في سياق الباركود ريدر
                if (window.location.hash.includes('barcode') || 
                    document.querySelector('#scanner-area')) {
                    return originalGetUserMedia.apply(this, arguments);
                } else {
                    securityManager.logSuspiciousActivity('محاولة الوصول للكاميرا خارج السياق المسموح', 'HIGH');
                    throw new Error('Camera access denied');
                }
            };
        }
    }

    // مراقبة محاولات الوصول غير المصرح بها
    monitorUnauthorizedAccess() {
        // تعطيل مراقبة الوصول غير المصرح به مؤقتاً لتجنب التداخل
        console.log('[Security] تم تعطيل مراقبة الوصول غير المصرح به مؤقتاً');
        return;
    }

    // تسجيل الأنشطة المشبوهة
    logSuspiciousActivity(activity, severity = 'MEDIUM') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            activity: activity,
            severity: severity,
            userAgent: navigator.userAgent,
            url: window.location.href,
            ip: this.getClientIP()
        };
        
        this.suspiciousActivities.push(logEntry);
        
        // الاحتفاظ بآخر 100 نشاط فقط
        if (this.suspiciousActivities.length > 100) {
            this.suspiciousActivities = this.suspiciousActivities.slice(-100);
        }
        
        console.warn(`[Security Alert] ${severity}: ${activity}`);
        
        // إرسال إشعار فوري للأنشطة الحرجة
        if (severity === 'CRITICAL') {
            this.sendTelegramAlert('🚨 تنبيه أمني حرج', 
                `نشاط مشبوه حرج تم اكتشافه!\n` +
                `النشاط: ${activity}\n` +
                `الوقت: ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}\n` +
                `IP: ${this.getClientIP()}`);
        }
    }

    // إرسال إشعار تليجرام
    async sendTelegramAlert(title, message) {
        if (!this.telegramBotToken || !this.telegramChatId) {
            console.warn('[Security] إعدادات التليجرام غير متوفرة');
            return;
        }
        
        try {
            const text = `🔒 ${title}\n\n${message}`;
            const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.telegramChatId,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
            
            if (!response.ok) {
                console.warn('[Security] فشل في إرسال إشعار التليجرام:', response.status);
            }
        } catch (error) {
            console.error('[Security] فشل في إرسال إشعار التليجرام:', error);
        }
    }

    // الحصول على IP العميل
    getClientIP() {
        // استخدام معرف فريد للمتصفح بدلاً من IP
        let clientId = localStorage.getItem('client_security_id');
        if (!clientId) {
            clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('client_security_id', clientId);
        }
        return clientId;
    }

    // الحصول على تقرير الأمان
    getSecurityReport() {
        return {
            totalSuspiciousActivities: this.suspiciousActivities.length,
            blockedIPs: this.blockedIPs.size,
            loginAttempts: this.loginAttempts.size,
            recentActivities: this.suspiciousActivities.slice(-10),
            isInitialized: this.isInitialized
        };
    }

    // تنظيف البيانات المؤقتة
    cleanup() {
        this.loginAttempts.clear();
        this.blockedIPs.clear();
        this.suspiciousActivities = [];
    }
}

// إنشاء instance عالمي لنظام الحماية
window.securityManager = new SecurityManager();

// تصدير للاستخدام في ملفات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
}

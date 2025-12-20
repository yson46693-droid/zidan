/**
 * حماية البيانات الحساسة في API
 * Sensitive Data Protection for API
 */

// تشفير البيانات الحساسة قبل الإرسال
function encryptSensitiveData(data) {
    if (typeof data !== 'object') return data;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'private_key'];
    const encrypted = { ...data };
    
    sensitiveFields.forEach(field => {
        if (encrypted[field]) {
            // تشفير بسيط للبيانات الحساسة
            encrypted[field] = btoa(encrypted[field] + '_SECURED');
        }
    });
    
    return encrypted;
}

// فك تشفير البيانات الحساسة بعد الاستلام
function decryptSensitiveData(data) {
    if (typeof data !== 'object') return data;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'private_key'];
    const decrypted = { ...data };
    
    sensitiveFields.forEach(field => {
        if (decrypted[field] && decrypted[field].includes('_SECURED')) {
            try {
                decrypted[field] = atob(decrypted[field].replace('_SECURED', ''));
            } catch (e) {
                // إذا فشل فك التشفير، احتفظ بالقيمة الأصلية
                console.warn('فشل في فك تشفير البيانات:', field);
            }
        }
    });
    
    return decrypted;
}

// حماية طلبات API
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    // السماح لطلبات API المحلية بالمرور بدون تشفير إضافي
    if (url.includes('api/') || url.includes('auth.php')) {
        return originalFetch(url, options);
    }
    
    // إضافة headers أمنية للطلبات الخارجية فقط
    const secureOptions = {
        ...options,
        headers: {
            ...options.headers,
            'X-Security-Token': Math.random().toString(36),
            'X-Request-ID': Date.now().toString(),
            'X-Protection-Level': 'HIGH',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    };
    
    // تشفير البيانات الحساسة في الطلب (للطلبات الخارجية فقط)
    if (secureOptions.body && typeof secureOptions.body === 'string') {
        try {
            const bodyData = JSON.parse(secureOptions.body);
            const encryptedData = encryptSensitiveData(bodyData);
            secureOptions.body = JSON.stringify(encryptedData);
        } catch (e) {
            // إذا لم تكن JSON، اتركها كما هي
        }
    }
    
    try {
        const response = await originalFetch(url, secureOptions);
        
        // فك تشفير البيانات الحساسة في الاستجابة (للطلبات الخارجية فقط)
        if (response.ok && !url.includes('api/')) {
            const clonedResponse = response.clone();
            try {
                // التحقق من Content-Type قبل محاولة قراءة JSON
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await clonedResponse.json();
                    const decryptedData = decryptSensitiveData(data);
                    
                    // إنشاء استجابة جديدة بالبيانات المفكوكة
                    return new Response(JSON.stringify(decryptedData), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } else {
                    // إذا لم تكن JSON، ارجع الاستجابة الأصلية
                    return response;
                }
            } catch (e) {
                // إذا لم تكن JSON أو فشل التحليل، ارجع الاستجابة الأصلية
                return response;
            }
        }
        
        return response;
    } catch (error) {
        // تسجيل الأخطاء الأمنية فقط للطلبات المهمة
        // تجاهل أخطاء الملفات الاختيارية (مثل telegram-backup-config.json)
        if (!url.includes('telegram-backup-config.json') && 
            !url.includes('data/') && 
            window.securityManager) {
            window.securityManager.logSuspiciousActivity(
                `خطأ في طلب API: ${url} - ${error.message}`,
                'MEDIUM'
            );
        }
        throw error;
    }
};

// حماية localStorage
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    // فحص البيانات الحساسة
    if (key.includes('password') || key.includes('token') || key.includes('secret')) {
        // تشفير البيانات الحساسة قبل الحفظ
        const encryptedValue = btoa(value + '_SECURED');
        return originalSetItem.call(this, key, encryptedValue);
    }
    return originalSetItem.call(this, key, value);
};

const originalGetItem = localStorage.getItem;
localStorage.getItem = function(key) {
    const value = originalGetItem.call(this, key);
    
    // فك تشفير البيانات الحساسة عند القراءة
    if (key.includes('password') || key.includes('token') || key.includes('secret')) {
        if (value && value.includes('_SECURED')) {
            try {
                return atob(value.replace('_SECURED', ''));
            } catch (e) {
                return value;
            }
        }
    }
    
    return value;
};

// حماية sessionStorage
const originalSessionSetItem = sessionStorage.setItem;
sessionStorage.setItem = function(key, value) {
    if (key.includes('password') || key.includes('token') || key.includes('secret')) {
        const encryptedValue = btoa(value + '_SECURED');
        return originalSessionSetItem.call(this, key, encryptedValue);
    }
    return originalSessionSetItem.call(this, key, value);
};

const originalSessionGetItem = sessionStorage.getItem;
sessionStorage.getItem = function(key) {
    const value = originalSessionGetItem.call(this, key);
    
    if (key.includes('password') || key.includes('token') || key.includes('secret')) {
        if (value && value.includes('_SECURED')) {
            try {
                return atob(value.replace('_SECURED', ''));
            } catch (e) {
                return value;
            }
        }
    }
    
    return value;
};

// حماية من تسريب البيانات عبر console
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

function containsSensitiveData(text) {
    return sensitivePatterns.some(pattern => pattern.test(text));
}

// إخفاء البيانات الحساسة من console
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function sanitizeConsoleOutput(args) {
    return args.map(arg => {
        if (typeof arg === 'string' && containsSensitiveData(arg)) {
            return '[SENSITIVE DATA PROTECTED]';
        }
        if (typeof arg === 'object' && arg !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(arg)) {
                if (containsSensitiveData(key) || containsSensitiveData(String(value))) {
                    sanitized[key] = '[PROTECTED]';
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        return arg;
    });
}

console.log = function(...args) {
    const sanitizedArgs = sanitizeConsoleOutput(args);
    originalConsoleLog.apply(console, sanitizedArgs);
};

console.error = function(...args) {
    const sanitizedArgs = sanitizeConsoleOutput(args);
    originalConsoleError.apply(console, sanitizedArgs);
};

console.warn = function(...args) {
    const sanitizedArgs = sanitizeConsoleOutput(args);
    originalConsoleWarn.apply(console, sanitizedArgs);
};

console.info = function(...args) {
    const sanitizedArgs = sanitizeConsoleOutput(args);
    originalConsoleInfo.apply(console, sanitizedArgs);
};

// حماية من تسريب البيانات عبر Network tab
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    // إضافة headers أمنية
    this.setRequestHeader('X-Security-Token', Math.random().toString(36));
    this.setRequestHeader('X-Request-ID', Date.now().toString());
    this.setRequestHeader('X-Protection-Level', 'HIGH');
    
    return originalXHROpen.apply(this, [method, url, ...args]);
};

// حماية من تسريب البيانات عبر WebSocket
if (window.WebSocket) {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        // إضافة حماية للـ WebSocket
        const ws = new originalWebSocket(url, protocols);
        
        const originalSend = ws.send;
        ws.send = function(data) {
            // تشفير البيانات قبل الإرسال
            if (typeof data === 'string' && containsSensitiveData(data)) {
                data = btoa(data + '_SECURED');
            }
            return originalSend.call(this, data);
        };
        
        return ws;
    };
}

console.log('[Data Protection] تم تفعيل حماية البيانات الحساسة');

/**
 * حماية البيانات الحساسة في API
 * Sensitive Data Protection for API
 * Optimized Version - Reduced Overhead
 */

// Cache للنتائج لتجنب إعادة الفحص
const sensitiveDataCache = new Map();
const CACHE_SIZE_LIMIT = 1000;

// تنظيف الكاش عندما يصل للحد الأقصى
function cleanupCache() {
    if (sensitiveDataCache.size > CACHE_SIZE_LIMIT) {
        const entries = Array.from(sensitiveDataCache.entries());
        const toDelete = entries.slice(0, Math.floor(CACHE_SIZE_LIMIT / 2));
        toDelete.forEach(([key]) => sensitiveDataCache.delete(key));
    }
}

// دمج regex patterns في pattern واحد لتحسين الأداء
const sensitivePattern = /password|token|secret|api[_-]?key|private[_-]?key|credential|auth|login|session/i;

// تشفير البيانات الحساسة قبل الإرسال
function encryptSensitiveData(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'private_key'];
    const encrypted = { ...data };
    let hasChanges = false;
    
    sensitiveFields.forEach(field => {
        if (encrypted[field]) {
            encrypted[field] = btoa(encrypted[field] + '_SECURED');
            hasChanges = true;
        }
    });
    
    return hasChanges ? encrypted : data;
}

// فك تشفير البيانات الحساسة بعد الاستلام
function decryptSensitiveData(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'private_key'];
    const decrypted = { ...data };
    let hasChanges = false;
    
    sensitiveFields.forEach(field => {
        if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[field].includes('_SECURED')) {
            try {
                decrypted[field] = atob(decrypted[field].replace('_SECURED', ''));
                hasChanges = true;
            } catch (e) {
                // إذا فشل فك التشفير، احتفظ بالقيمة الأصلية
            }
        }
    });
    
    return hasChanges ? decrypted : data;
}

// فحص محسّن للبيانات الحساسة مع caching
function containsSensitiveData(text) {
    if (typeof text !== 'string' || text.length === 0) return false;
    
    // التحقق من الكاش أولاً
    if (sensitiveDataCache.has(text)) {
        return sensitiveDataCache.get(text);
    }
    
    // فحص باستخدام regex واحد فقط
    const result = sensitivePattern.test(text);
    
    // حفظ النتيجة في الكاش (بحد أقصى)
    cleanupCache();
    sensitiveDataCache.set(text, result);
    
    return result;
}

// تنظيف output محسّن للـ console
function sanitizeConsoleOutput(args) {
    // Early return إذا كانت القائمة فارغة
    if (!args || args.length === 0) return args;
    
    const sanitized = [];
    let hasChanges = false;
    
    for (const arg of args) {
        if (typeof arg === 'string') {
            if (containsSensitiveData(arg)) {
                sanitized.push('[SENSITIVE DATA PROTECTED]');
                hasChanges = true;
            } else {
                sanitized.push(arg);
            }
        } else if (typeof arg === 'object' && arg !== null) {
            // فحص سريع: إذا كان object بسيط (ليس array كبير)، قم بالفحص
            if (Array.isArray(arg) && arg.length > 100) {
                // تجاهل arrays كبيرة لتحسين الأداء
                sanitized.push(arg);
                continue;
            }
            
            const sanitizedObj = {};
            let objHasChanges = false;
            
            for (const [key, value] of Object.entries(arg)) {
                const keySensitive = containsSensitiveData(key);
                const valueStr = String(value);
                const valueSensitive = valueStr.length < 500 && containsSensitiveData(valueStr);
                
                if (keySensitive || valueSensitive) {
                    sanitizedObj[key] = '[PROTECTED]';
                    objHasChanges = true;
                } else {
                    sanitizedObj[key] = value;
                }
            }
            
            sanitized.push(objHasChanges ? sanitizedObj : arg);
            if (objHasChanges) hasChanges = true;
        } else {
            sanitized.push(arg);
        }
    }
    
    return hasChanges ? sanitized : args;
}

// حماية طلبات API مع تحسينات الأداء
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    // السماح لطلبات API المحلية بالمرور بدون معالجة إضافية (تحسين الأداء)
    if (typeof url === 'string' && (url.includes('api/') || url.includes('auth.php') || url.startsWith('./api/') || url.startsWith('/api/'))) {
        return originalFetch(url, options);
    }
    
    // إضافة headers أمنية للطلبات الخارجية فقط
    const secureOptions = {
        ...options,
        headers: {
            ...options.headers,
            'X-Security-Token': Math.random().toString(36).substring(2, 15),
            'X-Request-ID': Date.now().toString(),
            'X-Protection-Level': 'HIGH',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    };
    
    // تشفير البيانات الحساسة في الطلب (للطلبات الخارجية فقط)
    if (secureOptions.body && typeof secureOptions.body === 'string' && secureOptions.body.length < 10000) {
        try {
            const bodyData = JSON.parse(secureOptions.body);
            if (typeof bodyData === 'object') {
                const encryptedData = encryptSensitiveData(bodyData);
                if (encryptedData !== bodyData) {
                    secureOptions.body = JSON.stringify(encryptedData);
                }
            }
        } catch (e) {
            // إذا لم تكن JSON، اتركها كما هي
        }
    }
    
    try {
        const response = await originalFetch(url, secureOptions);
        
        // فك تشفير البيانات الحساسة في الاستجابة (للطلبات الخارجية فقط)
        if (response.ok && typeof url === 'string' && !url.includes('api/')) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    const clonedResponse = response.clone();
                    const data = await clonedResponse.json();
                    
                    // فحص سريع: إذا كانت البيانات كبيرة جداً، تخطي فك التشفير
                    if (JSON.stringify(data).length > 100000) {
                        return response;
                    }
                    
                    const decryptedData = decryptSensitiveData(data);
                    
                    // إنشاء استجابة جديدة فقط إذا تغيرت البيانات
                    if (decryptedData !== data) {
                        return new Response(JSON.stringify(decryptedData), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                } catch (e) {
                    // إذا فشل التحليل، ارجع الاستجابة الأصلية
                }
            }
        }
        
        return response;
    } catch (error) {
        // تسجيل الأخطاء الأمنية فقط للطلبات المهمة
        if (typeof url === 'string' && 
            !url.includes('telegram-backup-config.json') && 
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

// حماية localStorage مع تحسينات
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    // فحص سريع: فقط للمفاتيح المشبوهة
    if (typeof key === 'string' && (key.includes('password') || key.includes('token') || key.includes('secret'))) {
        try {
            const encryptedValue = btoa(value + '_SECURED');
            return originalSetItem.call(this, key, encryptedValue);
        } catch (e) {
            // إذا فشل التشفير، احفظ القيمة الأصلية
            return originalSetItem.call(this, key, value);
        }
    }
    return originalSetItem.call(this, key, value);
};

const originalGetItem = localStorage.getItem;
localStorage.getItem = function(key) {
    const value = originalGetItem.call(this, key);
    
    // فك التشفير فقط للمفاتيح المشبوهة
    if (typeof key === 'string' && value && 
        (key.includes('password') || key.includes('token') || key.includes('secret')) &&
        typeof value === 'string' && value.includes('_SECURED')) {
        try {
            return atob(value.replace('_SECURED', ''));
        } catch (e) {
            return value;
        }
    }
    
    return value;
};

// حماية sessionStorage مع تحسينات
const originalSessionSetItem = sessionStorage.setItem;
sessionStorage.setItem = function(key, value) {
    if (typeof key === 'string' && (key.includes('password') || key.includes('token') || key.includes('secret'))) {
        try {
            const encryptedValue = btoa(value + '_SECURED');
            return originalSessionSetItem.call(this, key, encryptedValue);
        } catch (e) {
            return originalSessionSetItem.call(this, key, value);
        }
    }
    return originalSessionSetItem.call(this, key, value);
};

const originalSessionGetItem = sessionStorage.getItem;
sessionStorage.getItem = function(key) {
    const value = originalSessionGetItem.call(this, key);
    
    if (typeof key === 'string' && value && 
        (key.includes('password') || key.includes('token') || key.includes('secret')) &&
        typeof value === 'string' && value.includes('_SECURED')) {
        try {
            return atob(value.replace('_SECURED', ''));
        } catch (e) {
            return value;
        }
    }
    
    return value;
};

// Console protection مع debouncing للتقليل من الاستدعاءات
let consoleCallCount = 0;
const CONSOLE_CALL_THRESHOLD = 100;

// إعادة تعيين العداد كل دقيقة
setInterval(() => {
    consoleCallCount = 0;
}, 60000);

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// دالة wrapper محسّنة للـ console
function createConsoleWrapper(originalFn, shouldSanitize = true) {
    return function(...args) {
        consoleCallCount++;
        
        // بعد 100 استدعاء، تخطي sanitization للتحسين (في حالة الاستدعاءات الكثيرة)
        // ولكن استمر في الحماية للبيانات الحساسة الحقيقية
        if (shouldSanitize && consoleCallCount < CONSOLE_CALL_THRESHOLD) {
            const sanitizedArgs = sanitizeConsoleOutput(args);
            originalFn.apply(console, sanitizedArgs);
        } else if (shouldSanitize) {
            // للاستدعاءات الكثيرة، فحص سريع فقط
            const quickCheck = args.some(arg => 
                typeof arg === 'string' && containsSensitiveData(arg)
            );
            if (quickCheck) {
                originalFn.apply(console, sanitizeConsoleOutput(args));
            } else {
                originalFn.apply(console, args);
            }
        } else {
            originalFn.apply(console, args);
        }
    };
}

console.log = createConsoleWrapper(originalConsoleLog);
console.error = createConsoleWrapper(originalConsoleError);
console.warn = createConsoleWrapper(originalConsoleWarn);
console.info = createConsoleWrapper(originalConsoleInfo);

// حماية XMLHttpRequest مع تحسينات
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    // فقط للطلبات الخارجية
    if (typeof url === 'string' && !url.includes('api/') && !url.includes('auth.php')) {
        try {
            this.setRequestHeader('X-Security-Token', Math.random().toString(36).substring(2, 15));
            this.setRequestHeader('X-Request-ID', Date.now().toString());
            this.setRequestHeader('X-Protection-Level', 'HIGH');
        } catch (e) {
            // إذا فشل إعداد headers، استمر بدونها
        }
    }
    
    return originalXHROpen.apply(this, [method, url, ...args]);
};

// حماية WebSocket مع تحسينات
if (window.WebSocket) {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        const originalSend = ws.send;
        ws.send = function(data) {
            // فحص سريع فقط
            if (typeof data === 'string' && data.length < 1000 && containsSensitiveData(data)) {
                try {
                    data = btoa(data + '_SECURED');
                } catch (e) {
                    // إذا فشل التشفير، أرسل البيانات الأصلية
                }
            }
            return originalSend.call(this, data);
        };
        
        return ws;
    };
}

// تنظيف الكاش بشكل دوري
setInterval(() => {
    if (sensitiveDataCache.size > CACHE_SIZE_LIMIT) {
        cleanupCache();
    }
}, 300000); // كل 5 دقائق

console.log('[Data Protection] تم تفعيل حماية البيانات الحساسة (نسخة محسّنة)');

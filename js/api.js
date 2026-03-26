// إعدادات API - مسار ديناميكي يعمل من الجذر أو من مجلد فرعي (مثل Hostinger)
function getApiBaseUrl() {
    try {
        const pathname = window.location.pathname || '/';
        const dir = pathname.includes('/') ? pathname.substring(0, pathname.lastIndexOf('/') + 1) : '/';
        return dir + 'api/';
    } catch (e) {
        return 'api/';
    }
}
const API_BASE_URL = getApiBaseUrl();

// نظام Caching للطلبات
const API_CACHE = {
    cache: new Map(),
    maxAge: 5 * 60 * 1000, // 5 دقائق
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    },
    
    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },
    
    clear() {
        this.cache.clear();
    },
    
    // تنظيف الـ cache القديم
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.maxAge) {
                this.cache.delete(key);
            }
        }
    }
};

// ✅ نظام Request Deduplication - منع الطلبات المكررة المتزامنة
const PENDING_REQUESTS = new Map();

function getRequestKey(endpoint, method, data) {
    return `${method}:${endpoint}:${JSON.stringify(data || {})}`;
}

// تنظيف الـ cache كل 10 دقائق
setInterval(() => API_CACHE.cleanup(), 10 * 60 * 1000);

// دوال التواصل مع API
const API = {
    // متغيرات لتخزين Tokens
    csrfToken: null,
    apiToken: null,
    
    // دالة لتحديث Tokens من الاستجابة
    updateTokens(response) {
        if (!response) return;
        // قراءة tokens من المستوى الأعلى للاستجابة (الأولوية)
        if (response.csrf_token) {
            this.csrfToken = response.csrf_token;
        }
        if (response.api_token) {
            this.apiToken = response.api_token;
        }
        // fallback: قراءة من data (للتوافق مع auth.php)
        if (response.data) {
            if (response.data.csrf_token && !response.csrf_token) {
                this.csrfToken = response.data.csrf_token;
            }
            if (response.data.api_token && !response.api_token) {
                this.apiToken = response.data.api_token;
            }
        }
    },
    
    // دالة عامة لإرسال الطلبات
    // يمكن تمرير options إضافية مثل { silent: true } لمنع عرض loading overlay
    async request(endpoint, method = 'GET', data = null, requestOptions = {}) {
        // ✅ استخدام cache للطلبات GET فقط (ما لم يكن skipCache = true)
        if (method === 'GET' && !requestOptions.skipCache) {
            const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
            const cached = API_CACHE.get(cacheKey);
            if (cached) {
                // ✅ تحسين: تقليل console.log في الإنتاج (فقط في وضع التطوير)
                if (window.location.search.includes('debug=true') || window.location.hostname === 'localhost') {
                    console.log(`%c📦 استخدام cache:`, 'color: #FFA500; font-weight: bold;', endpoint);
                }
                return cached;
            }
        }
        
        // تحويل PUT/DELETE إلى POST للتوافق مع الاستضافات المجانية
        let actualMethod = method;
        if (method === 'PUT' || method === 'DELETE') {
            if (!data) data = {};
            data._method = method; // حفظ الطريقة الأصلية
            actualMethod = 'POST';
        }

        // إعداد options للـ fetch
        const fetchOptions = {
            method: actualMethod,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include', // إرسال ملفات تعريف الارتباط مع جميع الطلبات
            cache: 'no-cache',
            redirect: 'follow' // متابعة التوجيهات تلقائياً
        };
        
        // إضافة silent flag إذا كان موجوداً
        if (requestOptions && requestOptions.silent) {
            fetchOptions.headers['X-Silent-Request'] = 'true';
        }

        // ✅ إضافة Tokens للطلبات الحساسة
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            if (!data) data = {};
            
            // إضافة CSRF Token
            if (this.csrfToken) {
                data.csrf_token = this.csrfToken;
                fetchOptions.headers['X-CSRF-Token'] = this.csrfToken;
            }
            
            // إضافة API Token
            if (this.apiToken) {
                data.api_token = this.apiToken;
                fetchOptions.headers['X-API-Token'] = this.apiToken;
            }
        }

        if (data && actualMethod !== 'GET') {
            fetchOptions.body = JSON.stringify(data);
        }

        // التحقق من أن الطلب صامت (silent) - لا يعرض loading overlay
        const isSilent = requestOptions && requestOptions.silent === true;
        
        // ✅ منع إرسال طلبات get_messages.php إذا لم يكن المستخدم مسجل دخول
        const isGetMessages = endpoint.includes('get_messages.php');
        const isChatPage = window.location.pathname.includes('chat.html');
        
        if (isGetMessages && !isChatPage) {
            // التحقق من وجود مستخدم مسجل دخول
            let hasLoggedInUser = false;
            try {
                // محاولة من localStorage
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    hasLoggedInUser = user && user.id;
                }
            } catch (e) {
                // تجاهل الخطأ
            }
            
            // إذا لم يكن هناك مستخدم مسجل دخول، إرجاع استجابة فارغة بدلاً من إرسال الطلب
            if (!hasLoggedInUser) {
                return {
                    success: false,
                    status: 401,
                    message: 'غير مصرح، يرجى تسجيل الدخول',
                    data: []
                };
            }
            
            fetchOptions.headers['X-Silent-Request'] = 'true';
        }
        
        const fullUrl = API_BASE_URL + endpoint;
        
        // ✅ Request Deduplication: منع الطلبات المكررة المتزامنة
        // يجب تعريف requestKey بعد تعديل data في حالة PUT/DELETE
        const requestKey = getRequestKey(endpoint, method, data);
        if (PENDING_REQUESTS.has(requestKey)) {
            // إذا كان هناك طلب قيد التنفيذ لنفس endpoint، نعيد نفس Promise
            if (window.location.search.includes('debug=true') || window.location.hostname === 'localhost') {
                console.log(`%c🔄 Request deduplication:`, 'color: #9C27B0; font-weight: bold;', endpoint, '- استخدام الطلب الموجود');
            }
            const pendingPromise = PENDING_REQUESTS.get(requestKey);
            return pendingPromise.then(result => {
                // نسخ النتيجة لتجنب مشاكل الـ reference
                return JSON.parse(JSON.stringify(result));
            });
        }
        
        if (!isSilent && !(isGetMessages && !isChatPage)) {
            console.log(`%c📡 إرسال طلب ${actualMethod}`, 'color: #2196F3; font-weight: bold;', `إلى: ${fullUrl}`);
        }
        if (data && actualMethod !== 'GET' && !isSilent && !(isGetMessages && !isChatPage)) {
            console.log('📦 بيانات الطلب:', data);
        }
        
        // إضافة timeout للطلبات (تقليل إلى 15 ثانية لتحسين الأداء)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 ثانية
        
        fetchOptions.signal = controller.signal;
        
        // ✅ تحسين: إضافة retry mechanism للطلبات الفاشلة
        let response;
        const maxRetries = 2;
        
        // ✅ إنشاء Promise للطلب وإضافته إلى PENDING_REQUESTS
        const requestPromise = (async () => {
                try {
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        try {
                            response = await fetch(fullUrl, fetchOptions);
                            clearTimeout(timeoutId);
                            break; // نجح الطلب
                        } catch (error) {
                            clearTimeout(timeoutId);
                            // إعادة المحاولة فقط للأخطاء الشبكية (ليس أخطاء HTTP)
                            if (attempt < maxRetries && (
                                error.name === 'TypeError' || 
                                error.name === 'NetworkError' ||
                                error.name === 'AbortError' ||
                                error.message?.includes('Failed to fetch') ||
                                error.message?.includes('Network request failed')
                            )) {
                                console.warn(`[API] محاولة إعادة الطلب (${attempt + 1}/${maxRetries}):`, fullUrl);
                                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // تأخير متزايد
                                // إعادة إنشاء controller للطلب الجديد
                                const newController = new AbortController();
                                const newTimeoutId = setTimeout(() => newController.abort(), 15000);
                                fetchOptions.signal = newController.signal;
                                continue;
                            }
                            throw error; // رمي الخطأ إذا لم يكن خطأ شبكي أو تجاوزنا عدد المحاولات
                        }
                    }
                    clearTimeout(timeoutId);
            
            console.log(`%c📥 استجابة الخادم: ${response.status} ${response.statusText}`, 
                response.ok ? 'color: #4CAF50;' : 'color: #f44336;');
            
            // التحقق من حالة الاستجابة
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`%c❌ خطأ HTTP ${response.status}:`, 'color: #f44336; font-weight: bold;', errorText);
                
                // محاولة تحليل JSON إذا كان موجوداً
                let errorData = null;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    // ليس JSON
                }
                
                return { 
                    success: false, 
                    message: errorData?.message || `خطأ في الخادم (${response.status}): ${response.statusText}`,
                    error: errorText,
                    status: response.status
                };
            }
            
            // التحقق من نوع المحتوى
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('%c❌ الاستجابة ليست JSON:', 'color: #f44336; font-weight: bold;', text);
                
                // محاولة تحليل JSON حتى لو كان Content-Type غير صحيح
                try {
                    const jsonData = JSON.parse(text);
                    return jsonData;
                } catch (e) {
                    // إذا فشل التحليل، إرجاع الخطأ
                    return { 
                        success: false, 
                        message: 'خطأ في تنسيق الاستجابة من الخادم. قد تكون مشكلة في الاستضافة.',
                        error: text.substring(0, 200) // فقط أول 200 حرف لتجنب استجابة ضخمة
                    };
                }
            }
            
            const text = await response.text();
            let result;
            
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error('%c❌ خطأ في تحليل JSON:', 'color: #f44336; font-weight: bold;', text);
                return {
                    success: false,
                    message: 'خطأ في تحليل الاستجابة من الخادم',
                    error: text.substring(0, 200)
                };
            }
            
            // التحقق من وجود success في النتيجة
            if (result.hasOwnProperty('success')) {
                if (result.success) {
                    console.log('%c✅ نجح الطلب:', 'color: #4CAF50; font-weight: bold;', result);
                } else {
                    // ✅ إذا كان الخطأ متعلق بـ API Token، محاولة تحديث Token تلقائياً
                    if (result.message && result.message.includes('رمز API')) {
                        console.warn('⚠️ API Token منتهي الصلاحية - محاولة تحديث Token تلقائياً...');
                        // محاولة تحديث Token عبر checkAuth
                        try {
                            const authResult = await this.checkAuth(true); // silent = true
                            if (authResult && authResult.success) {
                                this.updateTokens(authResult);
                                console.log('✅ تم تحديث API Token تلقائياً');
                                // إعادة المحاولة مرة واحدة فقط
                                if (attempt === 0 && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                                    console.log('🔄 إعادة المحاولة بعد تحديث Token...');
                                    // إضافة Token الجديد للطلب
                                    if (!data) data = {};
                                    if (this.csrfToken) {
                                        data.csrf_token = this.csrfToken;
                                        fetchOptions.headers['X-CSRF-Token'] = this.csrfToken;
                                    }
                                    if (this.apiToken) {
                                        data.api_token = this.apiToken;
                                        fetchOptions.headers['X-API-Token'] = this.apiToken;
                                    }
                                    fetchOptions.body = JSON.stringify(data);
                                    // إعادة المحاولة
                                    response = await fetch(fullUrl, fetchOptions);
                                    const retryText = await response.text();
                                    result = JSON.parse(retryText);
                                    if (result.success) {
                                        console.log('✅ نجح الطلب بعد تحديث Token');
                                        this.updateTokens(result);
                                        // حفظ في cache بعد الاستجابة الناجحة للطلبات GET فقط
                                        if (method === 'GET' && result.success && !requestOptions.skipCache) {
                                            const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
                                            API_CACHE.set(cacheKey, result);
                                        }
                                        return result;
                                    }
                                }
                            }
                        } catch (authError) {
                            console.error('❌ فشل تحديث Token:', authError);
                        }
                    }
                    // ✅ إخفاء رسالة الخطأ للوظائف المعطلة (loss-operations.php)
                    const isDisabledFeature = result.message && (
                        result.message.includes('غير متاحة حالياً') ||
                        result.message.includes('غير متاح')
                    );
                    
                    if (!isDisabledFeature) {
                        console.error('%c❌ فشل الطلب:', 'color: #f44336; font-weight: bold;', result);
                    } else {
                        // ✅ فقط log عادي بدون error للوظائف المعطلة
                        if (window.location.search.includes('debug=true') || window.location.hostname === 'localhost') {
                            console.log('%cℹ️ الوظيفة معطلة:', 'color: #9E9E9E; font-weight: normal;', result.message);
                        }
                    }
                }
            } else {
                console.warn('%c⚠️ الاستجابة لا تحتوي على success:', 'color: #ff9800; font-weight: bold;', result);
                // إضافة success افتراضياً إذا لم يكن موجوداً
                result.success = false;
            }
            
            // ✅ حفظ في cache بعد الاستجابة الناجحة للطلبات GET فقط
            if (method === 'GET' && result.success && !requestOptions.skipCache) {
                const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
                API_CACHE.set(cacheKey, result);
            }
            
            // ✅ مسح الكاش تلقائياً بعد أي عملية POST/PUT/DELETE ناجحة
            // لضمان ظهور التغييرات بشكل فوري في جميع الصفحات
            if ((method === 'POST' || method === 'PUT' || method === 'DELETE' || actualMethod === 'POST') && result.success) {
                // مسح الكاش بالكامل لضمان تحديث جميع البيانات
                API_CACHE.clear();
                console.log('%c🗑️ تم مسح الكاش بعد العملية:', 'color: #FFA500; font-weight: bold;', endpoint);
            }
            
            // ✅ تحديث Tokens بعد استلام الاستجابة
            this.updateTokens(result);
            
            return result;
            } catch (error) {
                // معالجة الأخطاء داخل Promise
                console.error('%c❌ خطأ في الاتصال:', 'color: #f44336; font-size: 14px; font-weight: bold;', error);
                console.error('تفاصيل الخطأ:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                
                // ✅ تحسين: التحقق من وجود cache للطلبات GET عند فشل الاتصال
                if (method === 'GET' && !requestOptions.skipCache) {
                    const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
                    const cached = API_CACHE.get(cacheKey);
                    if (cached) {
                        console.log(`%c📦 استخدام cache بعد فشل الاتصال:`, 'color: #FFA500; font-weight: bold;', endpoint);
                        // ✅ إضافة علامة offline للنتيجة
                        return {
                            ...cached,
                            offline: true,
                            message: cached.message || 'تم تحميل البيانات من الذاكرة المؤقتة (وضع عدم الاتصال)'
                        };
                    }
                }
                
                // معالجة AbortError (timeout)
                if (error.name === 'AbortError') {
                    // ✅ محاولة استخدام cache قبل إرجاع الخطأ
                    if (method === 'GET' && !requestOptions.skipCache) {
                        const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
                        const cached = API_CACHE.get(cacheKey);
                        if (cached) {
                            console.log(`%c📦 استخدام cache بعد timeout:`, 'color: #FFA500; font-weight: bold;', endpoint);
                            return {
                                ...cached,
                                offline: true,
                                message: cached.message || 'تم تحميل البيانات من الذاكرة المؤقتة (انتهت مهلة الطلب)'
                            };
                        }
                    }
                    return {
                        success: false,
                        message: 'انتهت مهلة الطلب. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.',
                        error: 'Request timeout',
                        status: 408,
                        offline: true
                    };
                }
                
                // معالجة NetworkError بشكل أفضل
                const isNetworkError = error.name === 'TypeError' || 
                                     error.name === 'NetworkError' ||
                                     (error.message && (
                                         error.message.includes('fetch') || 
                                         error.message.includes('NetworkError') ||
                                         error.message.includes('Network request failed') ||
                                         error.message.includes('Failed to fetch') ||
                                         error.message.includes('Load failed')
                                     ));
                
                if (isNetworkError) {
                    // ✅ محاولة استخدام cache قبل إرجاع الخطأ
                    if (method === 'GET' && !requestOptions.skipCache) {
                        const cacheKey = `${endpoint}_${JSON.stringify(data || {})}`;
                        const cached = API_CACHE.get(cacheKey);
                        if (cached) {
                            console.log(`%c📦 استخدام cache بعد فشل الشبكة:`, 'color: #FFA500; font-weight: bold;', endpoint);
                            return {
                                ...cached,
                                offline: true,
                                message: cached.message || 'تم تحميل البيانات من الذاكرة المؤقتة (لا يوجد اتصال بالإنترنت)'
                            };
                        }
                    }
                    
                    return {
                        success: false,
                        message: 'لا يوجد اتصال بالإنترنت. تم عرض البيانات المحفوظة محلياً إن وجدت.',
                        error: 'NetworkError: ' + error.message,
                        networkError: true,
                        offline: true
                    };
                }
                
                // إرجاع خطأ عام
                return {
                    success: false,
                    message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
                    error: error.message || 'Unknown error',
                    offline: false
                };
            }
        })();
        
        // ✅ حفظ Promise في PENDING_REQUESTS
        PENDING_REQUESTS.set(requestKey, requestPromise);
        
        // ✅ حذف من PENDING_REQUESTS بعد اكتمال الطلب (نجاح أو فشل)
        requestPromise.finally(() => {
            PENDING_REQUESTS.delete(requestKey);
        });
        
        return requestPromise;
    },

    // المصادقة
    async login(username, password) {
        const result = await this.request('auth.php', 'POST', { username, password });
        this.updateTokens(result);
        return result;
    },

    async checkAuth(silent = false) {
        const options = silent ? { silent: true, skipCache: true } : { skipCache: true };
        const result = await this.request('auth.php', 'GET', null, options);
        this.updateTokens(result);
        return result;
    },

    async logout() {
        return await this.request('auth.php', 'POST', { action: 'logout' });
    },

    // المستخدمين
    async getUsers() {
        return await this.request('users.php', 'GET');
    },

    async getUser(id) {
        if (!id) {
            return { success: false, message: 'معرف المستخدم مطلوب' };
        }
        return await this.request(`users.php?id=${encodeURIComponent(id)}`, 'GET');
    },

    async getUserByUsername(username) {
        if (!username) {
            return { success: false, message: 'اسم المستخدم مطلوب' };
        }
        return await this.request(`users.php?username=${encodeURIComponent(username)}`, 'GET');
    },

    async addUser(userData) {
        return await this.request('users.php', 'POST', userData);
    },

    async updateUser(userId, userData) {
        return await this.request('users.php', 'PUT', { id: userId, ...userData });
    },

    async deleteUser(id) {
        return await this.request('users.php', 'DELETE', { id });
    },

    // الملف الشخصي
    async getProfile() {
        return await this.request('profile.php', 'GET');
    },

    async updateProfile(profileData) {
        return await this.request('profile.php', 'PUT', profileData);
    },

    async checkUsernameAvailability(username) {
        return await this.request('profile.php', 'POST', { action: 'check_username', username });
    },

    // العملاء
    async getCustomers(type = null) {
        const url = type ? `customers.php?type=${type}` : 'customers.php';
        return await this.request(url, 'GET');
    },
    
    async getCustomerSales(customerId) {
        return await this.request(`customers.php?action=sales&customer_id=${customerId}`, 'GET');
    },
    
    async getCustomerRepairs(customerId) {
        return await this.request(`repairs.php?action=customer&customer_id=${customerId}`, 'GET');
    },
    
    async getCustomerRating(customerId) {
        return await this.request(`customers.php?action=rating&customer_id=${customerId}`, 'GET');
    },
    
    async getProductReturns() {
        return await this.request('product-returns.php', 'GET', null, { silent: true });
    },
    
    async saveCustomerRating(customerId, saleId, rating) {
        return await this.request('customers.php', 'POST', {
            action: 'rating',
            customer_id: customerId,
            sale_id: saleId || null,
            rating: rating
        });
    },
    
    async updateCustomerRating(customerId, rating) {
        return await this.request('customers.php', 'PUT', {
            action: 'update_rating',
            customer_id: customerId,
            rating: rating
        });
    },

    async addCustomer(customerData) {
        return await this.request('customers.php', 'POST', customerData);
    },

    async updateCustomer(customerData) {
        return await this.request('customers.php', 'PUT', customerData);
    },

    async collectCustomerDebt(customerId, amount, notes = '') {
        return await this.request('customers.php', 'POST', {
            action: 'collect_debt',
            customer_id: customerId,
            amount: amount,
            notes: notes
        });
    },
    
    async deleteCustomer(id) {
        return await this.request('customers.php', 'DELETE', { id });
    },

    // عمليات الصيانة
    async getRepairs(branchId = null, requestOptions = {}) {
        let url = 'repairs.php';
        if (branchId) {
            url += `?branch_id=${encodeURIComponent(branchId)}`;
        }
        return await this.request(url, 'GET', null, requestOptions);
    },

    async addRepair(repairData) {
        return await this.request('repairs.php', 'POST', repairData);
    },

    async updateRepair(repairData) {
        return await this.request('repairs.php', 'PUT', repairData);
    },

    async deleteRepair(id) {
        return await this.request('repairs.php', 'DELETE', { id });
    },

    // المخزن
    async getInventory() {
        return await this.request('inventory.php', 'GET');
    },

    async addInventoryItem(itemData) {
        return await this.request('inventory.php', 'POST', itemData);
    },

    async updateInventoryItem(itemData) {
        return await this.request('inventory.php', 'PUT', itemData);
    },

    async deleteInventoryItem(id) {
        return await this.request('inventory.php', 'DELETE', { id });
    },

    // قطع الغيار
    async getSpareParts(silent = false) {
        const options = silent ? { silent: true } : {};
        return await this.request('inventory.php?type=spare_parts', 'GET', null, options);
    },

    async addSparePart(partData) {
        return await this.request('inventory.php?type=spare_parts', 'POST', partData);
    },

    async updateSparePart(partData) {
        return await this.request('inventory.php?type=spare_parts', 'PUT', partData);
    },

    async deleteSparePart(id) {
        return await this.request('inventory.php?type=spare_parts', 'DELETE', { id, type: 'spare_parts' });
    },

    // الإكسسوارات
    async getAccessories(silent = false) {
        const options = silent ? { silent: true } : {};
        return await this.request('inventory.php?type=accessories', 'GET', null, options);
    },

    async addAccessory(accessoryData) {
        return await this.request('inventory.php?type=accessories', 'POST', accessoryData);
    },

    async updateAccessory(accessoryData) {
        return await this.request('inventory.php?type=accessories', 'PUT', accessoryData);
    },

    async deleteAccessory(id) {
        return await this.request('inventory.php?type=accessories', 'DELETE', { id, type: 'accessories' });
    },

    // الهواتف
    async getPhones(silent = false) {
        const options = silent ? { silent: true } : {};
        return await this.request('inventory.php?type=phones', 'GET', null, options);
    },

    async getPhoneById(phoneId) {
        return await this.request(`inventory.php?type=phones&phone_id=${encodeURIComponent(phoneId)}`, 'GET');
    },

    async addPhone(phoneData) {
        return await this.request('inventory.php?type=phones', 'POST', phoneData);
    },

    async updatePhone(phoneData) {
        return await this.request('inventory.php?type=phones', 'PUT', phoneData);
    },

    async deletePhone(id) {
        return await this.request('inventory.php?type=phones', 'DELETE', { id, type: 'phones' });
    },

    // المصروفات
    async getExpenses(branchId = null, requestOptions = {}) {
        const url = branchId ? `expenses.php?branch_id=${encodeURIComponent(branchId)}` : 'expenses.php';
        return await this.request(url, 'GET', null, requestOptions);
    },

    async addExpense(expenseData) {
        return await this.request('expenses.php', 'POST', expenseData);
    },

    async updateExpense(expenseData) {
        return await this.request('expenses.php', 'PUT', expenseData);
    },

    async deleteExpense(id) {
        return await this.request('expenses.php', 'DELETE', { id });
    },

    // التقارير
    async getReport(type, startDate, endDate = null, branchId = null) {
        let url = `reports.php?type=${type}&start_date=${startDate}`;
        if (endDate) {
            url += `&end_date=${endDate}`;
        }
        if (branchId) {
            url += `&branch_id=${branchId}`;
        }
        return await this.request(url, 'GET');
    },

    // الإعدادات
    async getSettings() {
        return await this.request('settings.php', 'GET');
    },

    async updateSettings(settingsData) {
        return await this.request('settings.php', 'PUT', settingsData);
    },

    async createBackup() {
        return await this.request('settings.php?action=backup', 'POST');
    },

    async restoreBackup(backupData) {
        return await this.request('settings.php?action=restore', 'POST', backupData);
    },

    // إدارة الصور
    async uploadImage(repairId, imageData) {
        return await this.request('images.php', 'POST', {
            action: 'upload_image',
            repair_id: repairId,
            image_data: imageData
        });
    },

    async deleteImage(repairId) {
        return await this.request('images.php', 'POST', {
            action: 'delete_image',
            repair_id: repairId
        });
    },

    async getImage(repairId) {
        return await this.request(`images.php?repair_id=${repairId}`, 'GET');
    },

    // الحصول على مسار الصورة
    getImagePath(repairId) {
        return `images/repair_${repairId}.jpg`;
    },

    // تنظيف الصور القديمة (أكثر من 6 أشهر)
    async cleanupOldImages() {
        return await this.request('images.php', 'POST', {
            action: 'cleanup_old_images'
        });
    },

    // التحقق من وجود الصورة
    async checkImageExists(repairId) {
        try {
            const result = await this.getImage(repairId);
            return result.success;
        } catch (error) {
            return false;
        }
    },

    // العمليات الخاسرة
    async addLossOperation(lossData) {
        return await this.request('loss-operations.php', 'POST', lossData);
    },

    async getLossOperations() {
        return await this.request('loss-operations.php', 'GET');
    },

    async updateLossOperation(lossData) {
        return await this.request('loss-operations.php', 'PUT', lossData);
    },

    async deleteLossOperation(id) {
        return await this.request('loss-operations.php', 'DELETE', { id });
    },

    // النسخ الاحتياطي عبر Telegram
    async getTelegramBackupConfig() {
        return await this.request('telegram-backup.php?action=get_config', 'GET');
    },

    async getTelegramBackupStatus() {
        return await this.request('telegram-backup.php?action=get_backup_status', 'GET');
    },

    async listBackups() {
        return await this.request('telegram-backup.php?action=list_backups', 'GET');
    },

    // ✅ دوال النسخ الاحتياطي من قاعدة البيانات (SQL)
    async getDatabaseBackupStatus() {
        return await this.request('database-backup.php?action=status', 'GET');
    },

    async listDatabaseBackups() {
        return await this.request('database-backup.php?action=list', 'GET');
    },

    async createDatabaseBackup() {
        return await this.request('database-backup.php?action=create', 'POST');
    },

    async restoreDatabaseBackup(filename) {
        return await this.request('database-backup.php?action=restore', 'POST', { filename });
    },

    async deleteDatabaseBackup(filename) {
        return await this.request('database-backup.php', 'DELETE', { filename });
    },

    async getCleanupStatus() {
        return await this.request('telegram-backup.php?action=get_cleanup_status', 'GET');
    },

    // المستحقات والرواتب
    async getSalaries(branchId = null, monthYear = null) {
        let url = 'salaries.php?';
        const params = [];
        if (branchId) {
            params.push(`branch_id=${branchId}`);
        }
        if (monthYear) {
            params.push(`month_year=${monthYear}`);
        }
        if (params.length > 0) {
            url += params.join('&');
        } else {
            url = 'salaries.php';
        }
        return await this.request(url, 'GET');
    },

    async getAllDeductions(userId = null) {
        const url = userId && userId !== 'all' ? `salaries.php?action=all_deductions&user_id=${userId}` : 'salaries.php?action=all_deductions';
        return await this.request(url, 'GET');
    },

    async getUserSalaryDetails(userId) {
        return await this.request(`salaries.php?action=user_details&user_id=${userId}`, 'GET');
    },

    async addSalaryDeduction(deductionData) {
        return await this.request('salaries.php', 'POST', deductionData);
    },

    async updateSalaryDeduction(deductionData) {
        return await this.request('salaries.php', 'PUT', deductionData);
    },

    async deleteSalaryDeduction(id) {
        return await this.request('salaries.php', 'DELETE', { id });
    },

    // تحديث راتب المستخدم (للمالك فقط)
    async updateUserSalary(userId, salary) {
        return await this.request('users.php', 'PUT', { id: userId, salary: salary });
    }
};

// ✅ تصدير API و API_CACHE إلى window للاستخدام العام
if (typeof window !== 'undefined') {
    window.API = API;
    window.API_CACHE = API_CACHE; // تصدير API_CACHE للاستخدام في api-batch.js
}


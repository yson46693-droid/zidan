/**
 * API Batch Loader - محسّن تحميل طلبات API
 * يجمع الطلبات المتعددة في batch واحد لتحسين الأداء
 * 
 * 
 */

(function() {
    'use strict';

    // Cache للطلبات لتجنب التكرار
    const requestCache = new Map();
    const CACHE_DURATION = 30000; // ✅ PERFORMANCE: زيادة إلى 30 ثانية لتقليل الطلبات المتكررة

    /**
     * دالة لتنظيف الـ cache القديم
     */
    function cleanCache() {
        const now = Date.now();
        for (const [key, value] of requestCache.entries()) {
            if (now - value.timestamp > CACHE_DURATION) {
                requestCache.delete(key);
            }
        }
    }

    /**
     * دالة لإنشاء cache key من الطلب
     */
    function getCacheKey(url, method = 'GET', data = null) {
        const dataStr = data ? JSON.stringify(data) : '';
        return `${method}:${url}:${dataStr}`;
    }

    /**
     * دالة لتحميل عدة طلبات API بشكل متوازي
     * @param {Array} requests - مصفوفة من الطلبات {url, method, data, cache}
     * @returns {Promise} Promise يحل مع نتائج جميع الطلبات
     */
    window.batchAPIRequests = async function(requests) {
        if (!Array.isArray(requests) || requests.length === 0) {
            return [];
        }

        // تنظيف الـ cache القديم
        cleanCache();

        // معالجة الطلبات مع cache
        const promises = requests.map(async (req) => {
            const { url, method = 'GET', data = null, cache = true, skipCache = false } = req;
            
            // ✅ PERFORMANCE: التحقق من الـ cache مع تحسين
            if (cache && !skipCache && method === 'GET') {
                const cacheKey = getCacheKey(url, method, data);
                const cached = requestCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
                    // ✅ تقليل console.log في الإنتاج
                    if (window.location.search.includes('debug=true') || window.location.hostname === 'localhost') {
                        console.log(`%c📦 [Batch API] استخدام cache:`, 'color: #FFA500; font-weight: bold;', url);
                    }
                    return { url, success: true, data: cached.data, fromCache: true };
                }
            }

            // تنفيذ الطلب
            try {
                // ✅ إصلاح: استخدام API.request بشكل صحيح
                // API.request(endpoint, method, data)
                let result;
                if (typeof API !== 'undefined' && typeof API.request === 'function') {
                    // إزالة 'api/' من البداية إذا كان موجوداً (API.request يضيفه تلقائياً)
                    const endpoint = url.startsWith('api/') ? url.substring(4) : url;
                    result = await API.request(endpoint, method, data);
                } else {
                    throw new Error('API.request غير متاح');
                }

                // حفظ في الـ cache للطلبات GET فقط
                if (cache && result && result.success && method === 'GET') {
                    const cacheKey = getCacheKey(url, method, data);
                    requestCache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                }
                
                // ✅ مسح الكاش بعد أي عملية POST/PUT/DELETE ناجحة
                if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && result && result.success) {
                    requestCache.clear();
                    // مسح كاش API الرئيسي أيضاً
                    if (typeof API_CACHE !== 'undefined' && typeof API_CACHE.clear === 'function') {
                        API_CACHE.clear();
                    }
                    console.log('[Batch API] تم مسح الكاش بعد العملية:', method, url);
                }

                return { url, success: true, data: result, fromCache: false };
            } catch (error) {
                console.error(`[Batch API] خطأ في طلب ${url}:`, error);
                return { url, success: false, error: error.message || error, fromCache: false };
            }
        });

        // تنفيذ جميع الطلبات بشكل متوازي
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    url: requests[index].url,
                    success: false,
                    error: result.reason?.message || 'Unknown error',
                    fromCache: false
                };
            }
        });
    };

    /**
     * دالة لتحميل بيانات Dashboard بشكل محسّن
     * تجمع جميع الطلبات المطلوبة في batch واحد
     */
    window.loadDashboardDataBatch = async function(options = {}) {
        const {
            date = null,
            includeRepairs = true,
            includeExpenses = false,
            includeSalaries = false,
            includeSettings = false,
            includeUsers = false
        } = options;

        // تحديد التاريخ
        const today = date || (typeof getTodayDate === 'function' ? getTodayDate() : new Date().toISOString().split('T')[0]);

        // بناء قائمة الطلبات
        const requests = [];

        // طلبات أساسية
        requests.push({
            url: `api/reports.php?type=daily&start_date=${today}`,
            method: 'GET',
            cache: true
        });

        if (includeRepairs) {
            // ✅ إصلاح: الحصول على branch_id المناسب قبل استدعاء API
            let branchId = null;
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            
            if (isOwner) {
                // للمالك: محاولة الحصول على الفرع المحدد من DOM أو استخدام الفرع الأول
                const branchFilter = document.getElementById('repairBranchFilter');
                if (branchFilter && branchFilter.value) {
                    branchId = branchFilter.value;
                } else if (typeof selectedRepairBranchId !== 'undefined' && selectedRepairBranchId) {
                    branchId = selectedRepairBranchId;
                } else if (typeof repairFirstBranchId !== 'undefined' && repairFirstBranchId) {
                    branchId = repairFirstBranchId;
                }
            } else {
                // للمستخدمين العاديين: استخدام فرعهم
                branchId = currentUser && currentUser.branch_id ? currentUser.branch_id : null;
            }
            
            // بناء URL مع branch_id إذا كان متاحاً
            let repairsUrl = 'api/repairs.php';
            if (branchId) {
                repairsUrl += `?branch_id=${encodeURIComponent(branchId)}`;
            }
            
            requests.push({
                url: repairsUrl,
                method: 'GET',
                cache: true
            });
        }

        if (includeExpenses) {
            requests.push({
                url: 'api/expenses.php',
                method: 'GET',
                cache: true
            });
        }

        if (includeSalaries) {
            requests.push({
                url: 'api/salaries.php',
                method: 'GET',
                cache: true
            });
        }

        if (includeSettings) {
            requests.push({
                url: 'api/settings.php',
                method: 'GET',
                cache: true
            });
        }

        if (includeUsers) {
            requests.push({
                url: 'api/users.php',
                method: 'GET',
                cache: true
            });
        }

        // تنفيذ الطلبات بشكل متوازي
        const results = await window.batchAPIRequests(requests);

        // تنظيم النتائج
        const data = {
            report: null,
            repairs: null,
            expenses: null,
            salaries: null,
            settings: null,
            users: null,
            errors: []
        };

        results.forEach((result, index) => {
            const request = requests[index];
            if (result.success && result.data && result.data.success) {
                if (request.url.includes('reports.php')) {
                    data.report = result.data.data;
                } else if (request.url.includes('repairs.php')) {
                    data.repairs = result.data.data;
                } else if (request.url.includes('expenses.php')) {
                    data.expenses = result.data.data;
                } else if (request.url.includes('salaries.php')) {
                    data.salaries = result.data.data;
                } else if (request.url.includes('settings.php')) {
                    data.settings = result.data.data;
                } else if (request.url.includes('users.php')) {
                    data.users = result.data.data;
                }
            } else {
                data.errors.push({
                    url: request.url,
                    error: result.error || 'Unknown error'
                });
            }
        });

        return data;
    };

    /**
     * دالة لمسح الـ cache
     */
    window.clearAPICache = function() {
        requestCache.clear();
        console.log('[Batch API] تم مسح الـ cache');
    };

    /**
     * دالة للحصول على حجم الـ cache
     */
    window.getAPICacheSize = function() {
        return requestCache.size;
    };

    console.log('[Batch API] تم تحميل API Batch Loader');
})();


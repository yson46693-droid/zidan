// إعدادات API
const API_BASE_URL = 'api/';

// دوال التواصل مع API
const API = {
    // دالة عامة لإرسال الطلبات
    // يمكن تمرير options إضافية مثل { silent: true } لمنع عرض loading overlay
    async request(endpoint, method = 'GET', data = null, requestOptions = {}) {
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
            credentials: 'include', // إرسال ملفات تعريف الارتباط مع جميع الطلبات (للمزامنة مع CORS credentials)
            mode: 'cors',
            cache: 'no-cache',
            redirect: 'follow' // متابعة التوجيهات تلقائياً
        };
        
        // إضافة silent flag إذا كان موجوداً
        if (requestOptions && requestOptions.silent) {
            fetchOptions.headers['X-Silent-Request'] = 'true';
        }

        if (data && actualMethod !== 'GET') {
            fetchOptions.body = JSON.stringify(data);
        }

        try {
            // التحقق من أن الطلب صامت (silent) - لا يعرض loading overlay
            const isSilent = requestOptions && requestOptions.silent === true;
            
            // تجاهل get_messages.php من خارج صفحة الشات تلقائياً
            const isGetMessages = endpoint.includes('get_messages.php');
            const isChatPage = window.location.pathname.includes('chat.html');
            if (isGetMessages && !isChatPage) {
                fetchOptions.headers['X-Silent-Request'] = 'true';
            }
            
            if (!isSilent && !(isGetMessages && !isChatPage)) {
                console.log(`%c📡 إرسال طلب ${actualMethod}`, 'color: #2196F3; font-weight: bold;', `إلى: ${API_BASE_URL + endpoint}`);
            }
            if (data && actualMethod !== 'GET' && !isSilent && !(isGetMessages && !isChatPage)) {
                console.log('📦 بيانات الطلب:', data);
            }
            
            // إضافة timeout للطلبات
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 ثانية
            
            fetchOptions.signal = controller.signal;
            
            const response = await fetch(API_BASE_URL + endpoint, fetchOptions);
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
                    console.error('%c❌ فشل الطلب:', 'color: #f44336; font-weight: bold;', result);
                }
            } else {
                console.warn('%c⚠️ الاستجابة لا تحتوي على success:', 'color: #ff9800; font-weight: bold;', result);
                // إضافة success افتراضياً إذا لم يكن موجوداً
                result.success = false;
            }
            
            return result;
        } catch (error) {
            console.error('%c❌ خطأ في الاتصال:', 'color: #f44336; font-size: 14px; font-weight: bold;', error);
            console.error('تفاصيل الخطأ:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // معالجة NetworkError بشكل أفضل
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return {
                    success: false,
                    message: 'خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
                    error: 'NetworkError: ' + error.message,
                    networkError: true
                };
            }
            
            // معالجة NetworkError بشكل أفضل
            if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
                return {
                    success: false,
                    message: 'خطأ في الاتصال بالخادم. يرجى التحقق من:\n1. اتصال الإنترنت\n2. إعدادات الاستضافة\n3. مسار API صحيح',
                    error: 'NetworkError: ' + error.message,
                    networkError: true
                };
            }
            
            // التحقق إذا كان الخطأ بسبب الإلغاء
            if (error.name === 'AbortError') {
                return { 
                    success: false, 
                    message: 'انتهت مهلة الاتصال بالخادم. تحقق من اتصال الإنترنت.',
                    error: 'AbortError',
                    timeout: true
                };
            }
            
            // تحديد نوع الخطأ
            let errorMessage = 'خطأ في الاتصال بالخادم';
            if (error.name === 'SyntaxError') {
                errorMessage = 'خطأ في تحليل الاستجابة من الخادم. قد يكون الخادم يعيد HTML بدلاً من JSON.';
            } else if (error.message && error.message.includes('CORS')) {
                errorMessage = 'خطأ CORS. تحقق من إعدادات الخادم.';
            } else {
                errorMessage = `خطأ: ${error.message || 'خطأ غير معروف'}`;
            }
            
            return { 
                success: false, 
                message: errorMessage,
                error: error.message,
                errorName: error.name
            };
        }
    },

    // المصادقة
    async login(username, password) {
        return await this.request('auth.php', 'POST', { username, password });
    },

    async checkAuth(silent = false) {
        const options = silent ? { silent: true } : {};
        return await this.request('auth.php', 'GET', null, options);
    },

    async logout() {
        return await this.request('auth.php', 'POST', { action: 'logout' });
    },

    // المستخدمين
    async getUsers() {
        return await this.request('users.php', 'GET');
    },

    async addUser(userData) {
        return await this.request('users.php', 'POST', userData);
    },

    async updateUser(userData) {
        return await this.request('users.php', 'PUT', userData);
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
    
    async getCustomerRating(customerId) {
        return await this.request(`customers.php?action=rating&customer_id=${customerId}`, 'GET');
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

    async deleteCustomer(id) {
        return await this.request('customers.php', 'DELETE', { id });
    },

    // عمليات الصيانة
    async getRepairs() {
        return await this.request('repairs.php', 'GET');
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

    // المخزون
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
    async getSpareParts() {
        return await this.request('inventory.php?type=spare_parts', 'GET');
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
    async getAccessories() {
        return await this.request('inventory.php?type=accessories', 'GET');
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
    async getPhones() {
        return await this.request('inventory.php?type=phones', 'GET');
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
    async getExpenses() {
        return await this.request('expenses.php', 'GET');
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
    async getReport(type, startDate, endDate = null) {
        let url = `reports.php?type=${type}&start_date=${startDate}`;
        if (endDate) {
            url += `&end_date=${endDate}`;
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

    async getCleanupStatus() {
        return await this.request('telegram-backup.php?action=get_cleanup_status', 'GET');
    }
};


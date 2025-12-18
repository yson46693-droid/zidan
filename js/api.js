// إعدادات API
const API_BASE_URL = 'api/';

// دوال التواصل مع API
const API = {
    // دالة عامة لإرسال الطلبات
    async request(endpoint, method = 'GET', data = null) {
        // تحويل PUT/DELETE إلى POST للتوافق مع الاستضافات المجانية
        let actualMethod = method;
        if (method === 'PUT' || method === 'DELETE') {
            if (!data) data = {};
            data._method = method; // حفظ الطريقة الأصلية
            actualMethod = 'POST';
        }

        const options = {
            method: actualMethod,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            mode: 'cors',
            cache: 'no-cache'
        };

        if (data && actualMethod !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            console.log(`إرسال طلب ${actualMethod} إلى: ${API_BASE_URL + endpoint}`);
            
            // إضافة timeout للطلبات
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 ثانية
            
            options.signal = controller.signal;
            
            const response = await fetch(API_BASE_URL + endpoint, options);
            clearTimeout(timeoutId);
            
            console.log(`استجابة الخادم: ${response.status} ${response.statusText}`);
            
            // التحقق من حالة الاستجابة
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`خطأ HTTP ${response.status}:`, errorText);
                return { 
                    success: false, 
                    message: `خطأ في الخادم (${response.status}): ${response.statusText}` 
                };
            }
            
            // التحقق من نوع المحتوى
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('الاستجابة ليست JSON:', text);
                return { 
                    success: false, 
                    message: 'خطأ في تنسيق الاستجابة من الخادم. قد تكون مشكلة في الاستضافة.' 
                };
            }
            
            const result = await response.json();
            console.log('نتيجة الطلب:', result);
            return result;
        } catch (error) {
            console.error('خطأ في الاتصال:', error);
            
            // التحقق إذا كان الخطأ بسبب الإلغاء
            if (error.name === 'AbortError') {
                return { 
                    success: false, 
                    message: 'تم إلغاء الطلب',
                    error: 'AbortError'
                };
            }
            
            // تحديد نوع الخطأ
            let errorMessage = 'خطأ في الاتصال بالخادم';
            if (error.name === 'AbortError') {
                errorMessage = 'انتهت مهلة الاتصال بالخادم. تحقق من اتصال الإنترنت.';
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'خطأ في الاتصال بالخادم. تحقق من اتصال الإنترنت أو إعدادات الاستضافة.';
            } else if (error.name === 'SyntaxError') {
                errorMessage = 'خطأ في تحليل الاستجابة من الخادم.';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'خطأ CORS. تحقق من إعدادات الخادم.';
            }
            
            return { 
                success: false, 
                message: errorMessage,
                error: error.message
            };
        }
    },

    // المصادقة
    async login(username, password) {
        return await this.request('auth.php', 'POST', { username, password });
    },

    async checkAuth() {
        return await this.request('auth.php', 'GET');
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

    // العملاء
    async getCustomers() {
        return await this.request('customers.php', 'GET');
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
    }
};


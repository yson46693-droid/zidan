// نظام المزامنة التلقائية

class SyncManager {
    constructor() {
        this.syncInterval = null;
        this.syncFrequency = 300000; // 5 دقائق (300000 ميلي ثانية)
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.isInitialized = false;
    }

    // بدء المزامنة التلقائية
    startAutoSync() {
        if (this.isInitialized) {
            console.log('[Sync] المزامنة مُهيأة بالفعل');
            return;
        }
        
        console.log('[Sync] بدء المزامنة التلقائية');
        this.isInitialized = true;
        this.connectionRetries = 0;
        
        // تحديث حالة الاتصال فوراً
        this.updateSyncStatus('online');
        
        // مزامنة فورية مع تأخير قصير
        setTimeout(() => {
            this.syncAll();
        }, 1000);
        
        // مزامنة دورية
        this.syncInterval = setInterval(() => {
            this.syncAll();
        }, this.syncFrequency);

        // المزامنة عند استعادة الاتصال
        window.addEventListener('online', () => {
            console.log('[Sync] تم استعادة الاتصال - مزامنة...');
            this.connectionRetries = 0;
            this.updateSyncStatus('online');
            this.syncAll();
        });

        // حفظ في localStorage عند المغادرة
        window.addEventListener('beforeunload', () => {
            this.saveToLocalStorage();
        });
    }

    // إيقاف المزامنة
    stopAutoSync() {
        console.log('[Sync] إيقاف المزامنة التلقائية');
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.isInitialized = false;
        this.isSyncing = false;
        this.connectionRetries = 0;
        
        // إزالة مستمعي الأحداث
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('beforeunload', this.saveToLocalStorage);
        
        // إيقاف جميع العمليات المعلقة
        this.abortAllPendingRequests();
    }

    // إيقاف جميع الطلبات المعلقة
    abortAllPendingRequests() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    // مزامنة جميع البيانات
    async syncAll() {
        if (this.isSyncing) {
            console.log('[Sync] المزامنة جارية بالفعل...');
            return;
        }

        this.isSyncing = true;
        this.updateSyncStatus('syncing');

        // إنشاء AbortController جديد
        this.abortController = new AbortController();

        try {
            // التحقق من الاتصال
            if (!navigator.onLine) {
                console.log('[Sync] لا يوجد اتصال - استخدام البيانات المحلية');
                this.loadFromLocalStorage();
                this.updateSyncStatus('offline');
                this.isSyncing = false;
                return;
            }

            // التحقق من صحة الاتصال بالخادم أولاً
            const connectionTest = await this.testConnection();
            if (!connectionTest) {
                this.connectionRetries++;
                if (this.connectionRetries >= this.maxRetries) {
                    console.log('[Sync] فشل الاتصال بعد عدة محاولات - استخدام البيانات المحلية');
                    this.loadFromLocalStorage();
                    this.updateSyncStatus('offline');
                    this.isSyncing = false;
                    return;
                }
                
                // إعادة المحاولة بعد تأخير
                setTimeout(() => {
                    this.syncAll();
                }, 5000);
                this.isSyncing = false;
                return;
            }

            // إعادة تعيين عداد المحاولات عند نجاح الاتصال
            this.connectionRetries = 0;
            this.updateSyncStatus('online');

            // مزامنة كل نوع بيانات
            // ملاحظة: syncLossOperations يجب أن يعمل بعد syncRepairs لتجنب التضارب
            await Promise.all([
                this.syncRepairs(),
                this.syncCustomers(),
                this.syncInventory(),
                this.syncExpenses()
            ]);
            
            // مزامنة العمليات الخاسرة بعد العمليات العادية
            await this.syncLossOperations();

            this.lastSyncTime = new Date();
            this.saveToLocalStorage();
            this.updateSyncStatus('synced');
            
            console.log('[Sync] تمت المزامنة بنجاح');
        } catch (error) {
            // التحقق إذا كان الخطأ بسبب الإلغاء
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء المزامنة');
                return;
            }
            
            console.error('[Sync] خطأ في المزامنة:', error);
            this.updateSyncStatus('error');
            
            // إعادة المحاولة في حالة الخطأ
            this.connectionRetries++;
            if (this.connectionRetries < this.maxRetries) {
                setTimeout(() => {
                    this.syncAll();
                }, 10000); // إعادة المحاولة بعد 10 ثواني
            } else {
                // إذا فشلت جميع المحاولات، اعتبار الاتصال غير متاح
                this.updateSyncStatus('offline');
            }
        } finally {
            this.isSyncing = false;
        }
    }

    // اختبار الاتصال بالخادم
    async testConnection() {
        try {
            // اختبار بسيط للاتصال بدلاً من checkAuth
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 ثواني فقط
            
            // استخدام AbortController الخاص بالمزامنة إذا كان موجوداً
            const signal = this.abortController ? this.abortController.signal : controller.signal;
            
            const response = await fetch('api/auth.php', {
                method: 'GET',
                signal: signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            // اعتبار الاستجابة ناجحة إذا وصلت للخادم
            return response.ok || response.status === 401; // 401 يعني الخادم يعمل لكن غير مسجل دخول
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء اختبار الاتصال');
                return false;
            }
            console.log('[Sync] فشل اختبار الاتصال:', error.message);
            return false;
        }
    }

    // مزامنة العمليات
    async syncRepairs() {
        try {
            const result = await API.getRepairs();
            if (result.success) {
                localStorage.setItem('repairs_cache', JSON.stringify(result.data));
                if (typeof allRepairs !== 'undefined') {
                    // الحفاظ على العمليات الخاسرة عند تحديث العمليات العادية
                    const existingLossOperations = allRepairs.filter(r => r.is_loss_operation);
                    allRepairs = [...result.data, ...existingLossOperations];
                    
                    if (typeof filterRepairs === 'function') {
                        filterRepairs();
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء مزامنة العمليات');
                return;
            }
            console.error('[Sync] خطأ في مزامنة العمليات:', error);
        }
    }

    // مزامنة العملاء
    async syncCustomers() {
        try {
            const result = await API.getCustomers();
            if (result.success) {
                localStorage.setItem('customers_cache', JSON.stringify(result.data));
                if (typeof allCustomers !== 'undefined') {
                    allCustomers = result.data;
                    if (typeof displayCustomers === 'function') {
                        displayCustomers(allCustomers);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء مزامنة العملاء');
                return;
            }
            console.error('[Sync] خطأ في مزامنة العملاء:', error);
        }
    }

    // مزامنة المخزون
    async syncInventory() {
        try {
            const result = await API.getInventory();
            if (result.success) {
                localStorage.setItem('inventory_cache', JSON.stringify(result.data));
                if (typeof allInventory !== 'undefined') {
                    allInventory = result.data;
                    if (typeof displayInventory === 'function') {
                        displayInventory(allInventory);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء مزامنة المخزون');
                return;
            }
            console.error('[Sync] خطأ في مزامنة المخزون:', error);
        }
    }

    // مزامنة المصروفات
    async syncExpenses() {
        try {
            const result = await API.getExpenses();
            if (result.success) {
                localStorage.setItem('expenses_cache', JSON.stringify(result.data));
                if (typeof allExpenses !== 'undefined') {
                    allExpenses = result.data;
                    if (typeof filterExpenses === 'function') {
                        filterExpenses();
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء مزامنة المصروفات');
                return;
            }
            console.error('[Sync] خطأ في مزامنة المصروفات:', error);
        }
    }

    // مزامنة العمليات الخاسرة
    async syncLossOperations() {
        try {
            const result = await API.getLossOperations();
            if (result.success) {
                localStorage.setItem('loss_operations_cache', JSON.stringify(result.data));
                
                // تحديث العمليات مباشرة بدلاً من استدعاء loadRepairs() المكلف
                if (typeof allRepairs !== 'undefined') {
                    // تحويل العمليات الخاسرة إلى تنسيق العمليات العادية
                    const lossOperations = result.data.map(loss => ({
                        id: loss.id,
                        repair_number: loss.repair_number,
                        customer_name: loss.customer_name,
                        customer_phone: '',
                        device_type: loss.device_type,
                        device_model: '',
                        problem: loss.problem,
                        cost: loss.loss_amount,
                        status: 'lost',
                        created_by: '',
                        created_at: loss.created_at,
                        loss_reason: loss.loss_reason,
                        loss_notes: loss.notes,
                        is_loss_operation: true
                    }));
                    
                    // دمج العمليات الخاسرة مع العمليات العادية (إزالة المكررات)
                    const existingRepairs = allRepairs.filter(r => !r.is_loss_operation);
                    allRepairs = [...existingRepairs, ...lossOperations];
                    
                    // تحديث العرض فقط إذا كان قسم الصيانة مفتوح
                    if (typeof filterRepairs === 'function') {
                        filterRepairs();
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Sync] تم إلغاء مزامنة العمليات الخاسرة');
                return;
            }
            console.error('[Sync] خطأ في مزامنة العمليات الخاسرة:', error);
        }
    }

    // حفظ في localStorage
    saveToLocalStorage() {
        const syncData = {
            repairs: typeof allRepairs !== 'undefined' ? allRepairs : [],
            customers: typeof allCustomers !== 'undefined' ? allCustomers : [],
            inventory: typeof allInventory !== 'undefined' ? allInventory : [],
            expenses: typeof allExpenses !== 'undefined' ? allExpenses : [],
            lastSync: this.lastSyncTime
        };
        localStorage.setItem('sync_data', JSON.stringify(syncData));
    }

    // تحميل من localStorage
    loadFromLocalStorage() {
        const syncDataStr = localStorage.getItem('sync_data');
        if (!syncDataStr) return;

        try {
            const syncData = JSON.parse(syncDataStr);
            
            if (syncData.repairs && typeof allRepairs !== 'undefined') {
                allRepairs = syncData.repairs;
                if (typeof filterRepairs === 'function') filterRepairs();
            }
            
            if (syncData.customers && typeof allCustomers !== 'undefined') {
                allCustomers = syncData.customers;
                if (typeof displayCustomers === 'function') displayCustomers(allCustomers);
            }
            
            if (syncData.inventory && typeof allInventory !== 'undefined') {
                allInventory = syncData.inventory;
                if (typeof displayInventory === 'function') displayInventory(allInventory);
            }
            
            if (syncData.expenses && typeof allExpenses !== 'undefined') {
                allExpenses = syncData.expenses;
                if (typeof filterExpenses === 'function') filterExpenses();
            }
            
            // العمليات الخاسرة تُحمل فقط من الملف وليس من localStorage
            
            this.lastSyncTime = syncData.lastSync ? new Date(syncData.lastSync) : null;
        } catch (error) {
            console.error('[Sync] خطأ في تحميل البيانات المحلية:', error);
        }
    }

    // تحديث مؤشر حالة المزامنة
    updateSyncStatus(status) {
        const indicator = document.getElementById('syncIndicator');
        if (!indicator) return;

        const statusConfig = {
            'syncing': { text: '<i class="bi bi-arrow-repeat spin"></i> جاري المزامنة...', color: '#2196F3' },
            'synced': { text: '<i class="bi bi-check-circle"></i> متصل', color: '#4CAF50' },
            'offline': { text: '<i class="bi bi-wifi-off"></i> غير متصل', color: '#FFA500' },
            'error': { text: '<i class="bi bi-x-circle"></i> خطأ في المزامنة', color: '#f44336' },
            'online': { text: '<i class="bi bi-wifi"></i> متصل', color: '#4CAF50' }
        };

        const config = statusConfig[status] || statusConfig['offline'];
        indicator.innerHTML = config.text;
        indicator.style.color = config.color;

        // إضافة وقت آخر مزامنة
        if (status === 'synced' && this.lastSyncTime) {
            const timeStr = this.lastSyncTime.toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Africa/Cairo' 
            });
            indicator.innerHTML = `<i class="bi bi-check-circle"></i> آخر تحديث: ${timeStr}`;
        }
    }

    // مزامنة يدوية
    async manualSync() {
        showMessage('جاري المزامنة...', 'success');
        await this.syncAll();
        showMessage('تمت المزامنة بنجاح', 'success');
    }

    // تغيير تردد المزامنة (بالثواني)
    setFrequency(seconds) {
        this.syncFrequency = seconds * 1000;
        
        // إعادة تشغيل المزامنة بالتردد الجديد
        if (this.syncInterval) {
            this.stopAutoSync();
            this.startAutoSync();
        }
    }
}

// إنشاء instance عالمي
const syncManager = new SyncManager();


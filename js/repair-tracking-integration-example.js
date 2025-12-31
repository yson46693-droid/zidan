/**
 * مثال على كيفية ربط قالب تتبع الصيانة بصفحة عمليات الصيانة
 * 
 * هذا الملف يحتوي على أمثلة للكود الذي يمكن إضافته إلى js/repairs.js
 * لربط صفحة عمليات الصيانة مع صفحة تتبع الصيانة
 */

// ✅ دالة مساعدة لبناء بيانات التتبع من بيانات الصيانة
function buildRepairTrackingData(repair) {
    try {
        if (!repair || typeof repair !== 'object') {
            console.error('❌ بيانات الصيانة غير صحيحة');
            return null;
        }
        
        // تحويل حالة الصيانة إلى حالة التتبع
        const statusMap = {
            'pending': 'pickup',
            'in_progress': 'diagnosis',
            'ready': 'testing',
            'delivered': 'delivery',
            'cancelled': 'pickup'
        };
        
        const trackingStatus = statusMap[repair.status] || 'pickup';
        
        // بناء بيانات المراحل
        const stages = [
            {
                id: 'pickup',
                name: 'الاستلام',
                description: 'تم استلام المنتج منك.',
                date: repair.created_at ? repair.created_at.split('T')[0] : null,
                completed: true
            },
            {
                id: 'diagnosis',
                name: 'التشخيص',
                description: 'نقوم بتشخيص منتجك.',
                date: repair.status === 'in_progress' ? new Date().toISOString().split('T')[0] : null,
                completed: false,
                active: trackingStatus === 'diagnosis'
            },
            {
                id: 'repair',
                name: 'الإصلاح',
                description: 'سيتم إصلاح المنتج.',
                date: null,
                completed: false
            },
            {
                id: 'testing',
                name: 'الاختبار',
                description: 'سيتم اختبار المنتج.',
                date: null,
                completed: false
            },
            {
                id: 'packaging',
                name: 'التغليف',
                description: 'سيتم تغليف المنتج.',
                date: null,
                completed: false
            },
            {
                id: 'delivery',
                name: 'التسليم',
                description: 'سيتم تسليم المنتج.',
                date: repair.delivery_date || null,
                completed: false
            }
        ];
        
        // تحديث حالة المراحل حسب حالة الصيانة
        const stageOrder = ['pickup', 'diagnosis', 'repair', 'testing', 'packaging', 'delivery'];
        const currentIndex = stageOrder.indexOf(trackingStatus);
        
        stages.forEach((stage, index) => {
            if (index < currentIndex) {
                stage.completed = true;
                stage.active = false;
            } else if (index === currentIndex) {
                stage.completed = false;
                stage.active = true;
            } else {
                stage.completed = false;
                stage.active = false;
            }
        });
        
        // بناء وصف الحالة
        const statusDescriptions = {
            'pickup': 'تم استلام المنتج بنجاح منك وهو في انتظار التشخيص.',
            'diagnosis': 'تم تسليم المنتج بنجاح إلى مركز الخدمة وهو قيد التشخيص حالياً. يعمل فريقنا بجد لتحديد المشكلة وتحديد الإصلاحات أو الخدمات المطلوبة.',
            'repair': 'تم تشخيص المشكلة بنجاح. نقوم حالياً بإصلاح المنتج باستخدام أفضل الأدوات والقطع الأصلية.',
            'testing': 'تم إصلاح المنتج بنجاح. نقوم حالياً باختبار المنتج للتأكد من عمله بشكل صحيح.',
            'packaging': 'تم اختبار المنتج بنجاح. نقوم حالياً بتغليف المنتج استعداداً للتسليم.',
            'delivery': 'تم تجهيز المنتج بنجاح. المنتج جاهز للاستلام من مركز الخدمة.'
        };
        
        // حساب تاريخ التسليم المتوقع
        let estimatedDate = repair.delivery_date;
        if (!estimatedDate && repair.created_at) {
            const created = new Date(repair.created_at);
            const estimated = new Date(created);
            estimated.setDate(estimated.getDate() + 14); // 14 يوم من تاريخ الإنشاء
            estimatedDate = estimated.toISOString().split('T')[0];
        }
        
        return {
            repairId: repair.id || null, // ✅ إضافة repair_id للتقييم
            repairNumber: repair.repair_number || '',
            status: trackingStatus,
            statusDescription: statusDescriptions[trackingStatus] || statusDescriptions['diagnosis'],
            estimatedDeliveryDate: estimatedDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            stages: stages
        };
    } catch (error) {
        console.error('❌ خطأ في بناء بيانات التتبع:', error);
        return null;
    }
}

// ✅ دالة فتح صفحة تتبع الصيانة
async function openRepairTracking(repairId, repairNumber) {
    try {
        // إظهار شاشة التحميل
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        // جلب بيانات الصيانة من API
        let repair = null;
        if (typeof API !== 'undefined' && repairId) {
            try {
                const result = await API.request(`repairs.php?id=${encodeURIComponent(repairId)}`, 'GET');
                if (result && result.success && result.data) {
                    repair = Array.isArray(result.data) ? result.data[0] : result.data;
                }
            } catch (apiError) {
                console.warn('⚠️ لا يمكن جلب بيانات الصيانة من API:', apiError);
            }
        }
        
        // إذا لم يتم جلب البيانات من API، استخدام البيانات المتاحة
        if (!repair && repairNumber) {
            // محاولة البحث في البيانات المحلية
            if (typeof allRepairs !== 'undefined' && Array.isArray(allRepairs)) {
                repair = allRepairs.find(r => r.repair_number === repairNumber || r.id === repairId);
            }
        }
        
        // إذا لم يتم العثور على بيانات الصيانة
        if (!repair) {
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
            showMessage('حدث خطأ في جلب بيانات الصيانة', 'error');
            return;
        }
        
        // بناء بيانات التتبع
        const trackingData = buildRepairTrackingData(repair);
        
        if (!trackingData) {
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
            showMessage('حدث خطأ في بناء بيانات التتبع', 'error');
            return;
        }
        
        // حفظ البيانات في localStorage
        localStorage.setItem('repairTrackingData', JSON.stringify(trackingData));
        
        // فتح الصفحة في نافذة جديدة
        const trackingUrl = `repair-tracking.html?repair_number=${encodeURIComponent(trackingData.repairNumber)}&status=${encodeURIComponent(trackingData.status)}`;
        window.open(trackingUrl, '_blank');
        
        // إخفاء شاشة التحميل
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
        
        console.log('✅ تم فتح صفحة تتبع الصيانة:', trackingData);
    } catch (error) {
        console.error('❌ خطأ في فتح صفحة تتبع الصيانة:', error);
        
        // إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
        
        showMessage('حدث خطأ في فتح صفحة تتبع الصيانة', 'error');
    }
}

// ✅ مثال على إضافة زر "عرض الحالة" في جدول عمليات الصيانة
function addTrackingButtonToRepairTable(repair) {
    // هذا مثال على كيفية إضافة الزر في دالة displayRepairs()
    // يمكن إضافة هذا الكود في js/repairs.js في دالة displayRepairs()
    
    return `
        <button 
            onclick="openRepairTracking('${repair.id}', '${repair.repair_number}')" 
            class="btn btn-sm btn-primary"
            title="عرض حالة الصيانة">
            <i class="bi bi-eye"></i> عرض الحالة
        </button>
    `;
}

// ✅ مثال على إضافة عمود "الحالة" في جدول عمليات الصيانة
function addTrackingColumnToRepairTable() {
    // هذا مثال على كيفية إضافة عمود جديد في جدول عمليات الصيانة
    // يمكن إضافة هذا الكود في js/repairs.js في دالة displayRepairs()
    
    return `
        <th>الحالة</th>
    `;
}

// ✅ تصدير الدوال للاستخدام في ملفات أخرى
if (typeof window !== 'undefined') {
    window.openRepairTracking = openRepairTracking;
    window.buildRepairTrackingData = buildRepairTrackingData;
}

// ✅ ملاحظات للتنفيذ:
/*
 * 1. أضف الدالة openRepairTracking() إلى js/repairs.js
 * 2. في دالة displayRepairs()، أضف زر "عرض الحالة" لكل عملية صيانة
 * 3. تأكد من وجود API.getRepair() أو API.request() في ملف js/api.js
 * 4. اختبر الربط بين الصفحتين
 * 
 * مثال على الاستخدام في displayRepairs():
 * 
 * function displayRepairs(repairs) {
 *     const tbody = document.getElementById('repairsTableBody');
 *     tbody.innerHTML = repairs.map(repair => `
 *         <tr>
 *             <td>${repair.repair_number}</td>
 *             <td>${repair.customer_name}</td>
 *             <td>${repair.device_type}</td>
 *             <td>
 *                 <button onclick="openRepairTracking('${repair.id}', '${repair.repair_number}')" 
 *                         class="btn btn-sm btn-primary">
 *                     <i class="bi bi-eye"></i> عرض الحالة
 *                 </button>
 *             </td>
 *         </tr>
 *     `).join('');
 * }
 */

// صفحة تتبع الصيانة
// ✅ حماية من التحميل المكرر
if (typeof window.repairTrackingLoaded !== 'undefined') {
    console.warn('⚠️ repair-tracking.js تم تحميله مسبقاً - تخطي إعادة التحميل');
} else {
    window.repairTrackingLoaded = true;

// ✅ متغيرات القالب - يمكن استقبالها من صفحة عمليات الصيانة
let repairTrackingData = {
    repairNumber: 'GKL/02/05/2023',
    status: 'received', // 'received', 'under_inspection', 'awaiting_customer_approval', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled'
    statusDescription: 'تم استلام الجهاز وهو في انتظار الفحص.',
    estimatedDeliveryDate: '2023-05-31',
    stages: [
        {
            id: 'received',
            name: 'تم الاستلام',
            description: 'تم استلام الجهاز وهو في انتظار الفحص.',
            date: '2023-05-16',
            completed: true,
            active: false
        },
        {
            id: 'under_inspection',
            name: 'قيد الفحص',
            description: 'نقوم بفحص الجهاز لتحديد المشكلة.',
            date: null,
            completed: false,
            active: false
        },
        {
            id: 'awaiting_customer_approval',
            name: 'بانتظار موافقة العميل',
            description: 'بانتظار موافقتك على التكلفة المقترحة.',
            date: null,
            completed: false,
            active: false
        },
        {
            id: 'in_progress',
            name: 'قيد الإصلاح',
            description: 'نقوم بإصلاح الجهاز باستخدام أفضل الأدوات والقطع الأصلية.',
            date: null,
            completed: false,
            active: false
        },
        {
            id: 'ready_for_delivery',
            name: 'جاهز للتسليم',
            description: 'تم إصلاح الجهاز بنجاح وهو جاهز للاستلام.',
            date: null,
            completed: false,
            active: false
        },
        {
            id: 'delivered',
            name: 'تم التسليم',
            description: 'تم تسليم الجهاز بنجاح.',
            date: null,
            completed: false,
            active: false
        }
    ]
};

// ✅ دالة لاستقبال البيانات من صفحة عمليات الصيانة
window.setRepairTrackingData = function(data) {
    try {
        if (!data || typeof data !== 'object') {
            console.error('❌ بيانات غير صحيحة:', data);
            return;
        }
        
        // تحديث البيانات
        if (data.repairNumber) repairTrackingData.repairNumber = data.repairNumber;
        if (data.status) repairTrackingData.status = data.status;
        if (data.statusDescription) repairTrackingData.statusDescription = data.statusDescription;
        if (data.estimatedDeliveryDate) repairTrackingData.estimatedDeliveryDate = data.estimatedDeliveryDate;
        if (data.stages && Array.isArray(data.stages)) repairTrackingData.stages = data.stages;
        
        // ✅ حفظ repair_id إذا كان موجوداً
        if (data.repairId) {
            currentRepairId = data.repairId;
            const repairIdInput = document.getElementById('repairId');
            if (repairIdInput) {
                repairIdInput.value = data.repairId;
            }
        }
        
        if (data.repair_number || data.repairNumber) {
            const repairNumberInput = document.getElementById('repairNumberInput');
            if (repairNumberInput) {
                repairNumberInput.value = data.repair_number || data.repairNumber;
            }
        }
        
        // تحديث العرض
        renderTrackingPage();
        
        console.log('✅ تم تحديث بيانات تتبع الصيانة:', repairTrackingData);
    } catch (error) {
        console.error('❌ خطأ في تحديث بيانات تتبع الصيانة:', error);
    }
};

// ✅ دالة لتحويل التاريخ من YYYY-MM-DD إلى تنسيق عربي
function formatArabicDate(dateString) {
    try {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day} ${month} ${year}`;
    } catch (error) {
        console.error('خطأ في تحويل التاريخ:', error);
        return dateString;
    }
}

// ✅ دالة لتحديد حالة المرحلة
function getStageState(stage, currentStatus) {
    // استخدام البيانات الموجودة في stage مباشرة
    if (stage.completed) {
        return 'completed';
    } else if (stage.active) {
        return 'active';
    } else {
        return 'pending';
    }
}

// ✅ دالة لعرض شريط التقدم
function renderProgressTimeline() {
    try {
        const timeline = document.getElementById('progressTimeline');
        if (!timeline) {
            console.error('❌ العنصر progressTimeline غير موجود');
            return;
        }
        
        const currentStatus = repairTrackingData.status;
        const stages = repairTrackingData.stages || [];
        
        // بناء HTML للمراحل
        let timelineHTML = '';
        
        stages.forEach((stage, index) => {
            const state = getStageState(stage, currentStatus);
            const isCompleted = state === 'completed';
            const isActive = state === 'active';
            
            // حساب عرض الخط بين المراحل
            const lineWidth = index < stages.length - 1 ? '100%' : '0';
            const lineCompleted = isCompleted && index < stages.length - 1;
            
            timelineHTML += `
                <div class="progress-stage">
                    <div class="stage-dot ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}"></div>
                    ${index < stages.length - 1 ? `
                        <div class="stage-line ${lineCompleted ? 'completed' : ''}" style="width: ${lineWidth};"></div>
                    ` : ''}
                    <div class="stage-info ${isActive ? 'active' : ''}">
                        <div class="stage-date">${stage.date ? formatArabicDate(stage.date) : ''}</div>
                        <div class="stage-name">${escapeHtml(stage.name)}</div>
                        <div class="stage-description">${escapeHtml(stage.description)}</div>
                    </div>
                </div>
            `;
        });
        
        timeline.innerHTML = timelineHTML;
    } catch (error) {
        console.error('❌ خطأ في عرض شريط التقدم:', error);
    }
}

// ✅ دالة لعرض صفحة التتبع
function renderTrackingPage() {
    try {
        // ✅ التحقق من انتهاء الصلاحية إذا كان هناك createdAt
        if (repairTrackingData.createdAt && !isViewExpired) {
            const expiryInfo = checkLinkExpiry(repairTrackingData.createdAt);
            isViewExpired = expiryInfo.expiredView;
            isLinkExpired = expiryInfo.expired;
            
            if (expiryInfo.expiredView) {
                showExpiredMessage(expiryInfo);
                const progressSection = document.querySelector('.progress-section');
                const ratingSection = document.getElementById('ratingSection');
                const ratingDisplay = document.getElementById('ratingDisplay');
                if (progressSection) progressSection.style.display = 'none';
                if (ratingSection) ratingSection.style.display = 'none';
                if (ratingDisplay) ratingDisplay.style.display = 'none';
                return;
            }
            
            if (expiryInfo.expired) {
                showExpiredMessage(expiryInfo);
                const ratingSection = document.getElementById('ratingSection');
                if (ratingSection) {
                    ratingSection.style.display = 'none';
                }
            }
        }
        
        // تحديث رقم الصيانة
        const repairNumberEl = document.getElementById('repairNumber');
        if (repairNumberEl) {
            repairNumberEl.textContent = `#${repairTrackingData.repairNumber}`;
        }
        
        // تحديث وصف الحالة
        const statusDescriptionEl = document.getElementById('statusDescription');
        if (statusDescriptionEl) {
            statusDescriptionEl.textContent = repairTrackingData.statusDescription;
        }
        
        // تحديث تاريخ التسليم المتوقع
        const estimatedDeliveryEl = document.getElementById('estimatedDeliveryDate');
        if (estimatedDeliveryEl) {
            estimatedDeliveryEl.textContent = formatArabicDate(repairTrackingData.estimatedDeliveryDate);
        }
        
        // عرض شريط التقدم
        renderProgressTimeline();
    } catch (error) {
        console.error('❌ خطأ في عرض صفحة التتبع:', error);
        showError('حدث خطأ أثناء تحميل بيانات التتبع');
    }
}

// ✅ دالة مساعدة لجلب بيانات الصيانة من API
async function fetchRepairDataFromAPI(repairNumber) {
    try {
        if (typeof API === 'undefined') {
            console.warn('⚠️ API غير متاح');
            return null;
        }
        
        // البحث عن عملية الصيانة برقمها
        const result = await API.request(`repairs.php?repair_number=${encodeURIComponent(repairNumber)}`, 'GET');
        
        if (!result || !result.success || !result.data || result.data.length === 0) {
            console.warn('⚠️ لم يتم العثور على عملية الصيانة');
            return null;
        }
        
        const repair = Array.isArray(result.data) ? result.data[0] : result.data;
        
        // تحويل حالة الصيانة إلى حالة التتبع (استخدام الحالة مباشرة)
        const repairStatus = repair.status || 'received';
        
        // تحديد الحالة النهائية (delivered أو cancelled)
        const isCancelled = repairStatus === 'cancelled' || repairStatus === 'lost';
        const isDelivered = repairStatus === 'delivered';
        const finalStatus = isCancelled ? 'cancelled' : (isDelivered ? 'delivered' : repairStatus);
        
        // بناء بيانات المراحل
        const stages = [
            {
                id: 'received',
                name: 'تم الاستلام',
                description: 'تم استلام الجهاز بنجاح وهو في انتظار الفحص.',
                date: repair.created_at ? repair.created_at.split('T')[0] : null,
                completed: false,
                active: false
            },
            {
                id: 'under_inspection',
                name: 'قيد الفحص',
                description: 'نقوم بفحص الجهاز لتحديد المشكلة.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'awaiting_customer_approval',
                name: 'بانتظار موافقة العميل',
                description: 'بانتظار موافقتك على التكلفة المقترحة.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'in_progress',
                name: 'قيد الإصلاح',
                description: 'نقوم بإصلاح الجهاز باستخدام أفضل الأدوات والقطع الأصلية.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: 'ready_for_delivery',
                name: 'جاهز للتسليم',
                description: 'تم إصلاح الجهاز بنجاح وهو جاهز للاستلام.',
                date: null,
                completed: false,
                active: false
            },
            {
                id: finalStatus,
                name: isCancelled ? 'عملية ملغية' : 'تم التسليم',
                description: isCancelled ? 'تم إلغاء العملية.' : 'تم تسليم الجهاز بنجاح.',
                date: repair.delivery_date || (isDelivered ? new Date().toISOString().split('T')[0] : null),
                completed: false,
                active: false
            }
        ];
        
        // تحديث حالة المراحل حسب حالة الصيانة
        const stageOrder = ['received', 'under_inspection', 'awaiting_customer_approval', 'in_progress', 'ready_for_delivery'];
        
        // العثور على الفهرس الحالي
        let currentIndex = -1;
        if (isDelivered || isCancelled) {
            // إذا كانت delivered أو cancelled، جميع المراحل السابقة مكتملة والمرحلة الأخيرة هي النهائية
            currentIndex = stageOrder.length; // بعد جميع المراحل
        } else {
            currentIndex = stageOrder.indexOf(repairStatus);
        }
        
        stages.forEach((stage, index) => {
            const isLastStage = stage.id === finalStatus;
            const stageOrderIndex = isLastStage ? stageOrder.length : stageOrder.indexOf(stage.id);
            
            if (isLastStage) {
                // المرحلة الأخيرة (delivered/cancelled)
                stage.completed = isDelivered || isCancelled;
                stage.active = false;
            } else if (stageOrderIndex < currentIndex) {
                // المراحل السابقة: مكتملة
                stage.completed = true;
                stage.active = false;
            } else if (stageOrderIndex === currentIndex) {
                // المرحلة الحالية: نشطة
                stage.completed = false;
                stage.active = true;
            } else {
                // المراحل المستقبلية: غير مكتملة
                stage.completed = false;
                stage.active = false;
            }
        });
        
        // بناء وصف الحالة
        const statusDescriptions = {
            'received': 'تم استلام الجهاز وهو في انتظار الفحص.',
            'under_inspection': 'يتم بفحص الجهاز لتحديد المشكلة وتشخيصها بشكل صحيح.',
            'awaiting_customer_approval': 'تم تحديد التكلفة المطلوبة للإصلاح. ننتظر موافقتك للمتابعة.',
            'in_progress': 'نقوم حالياً بإصلاح الجهاز باستخدام أفضل الأدوات والقطع الأصلية.',
            'ready_for_delivery': 'تم إصلاح الجهاز بنجاح وهو جاهز للاستلام من مركز الخدمة.',
            'delivered': 'تم تسليم الجهاز بنجاح. شكراً لثقتك بنا!',
            'cancelled': 'تم إلغاء العملية.',
            'lost': 'تم إلغاء العملية.'
        };
        
        // حساب تاريخ التسليم المتوقع
        let estimatedDate = repair.delivery_date;
        if (!estimatedDate && repair.created_at) {
            const created = new Date(repair.created_at);
            const estimated = new Date(created);
            estimated.setDate(estimated.getDate() + 14); // 14 يوم من تاريخ الإنشاء
            estimatedDate = estimated.toISOString().split('T')[0];
        }
        
        // ✅ إضافة تاريخ الإنشاء للتحقق من انتهاء الصلاحية
        const createdAt = repair.created_at || null;
        
        return {
            repairId: repair.id || null, // ✅ إضافة repair_id للتقييم
            repairNumber: repair.repair_number || repairNumber,
            status: repairStatus,
            statusDescription: statusDescriptions[repairStatus] || statusDescriptions['received'],
            estimatedDeliveryDate: estimatedDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            stages: stages,
            createdAt: createdAt // ✅ إضافة تاريخ الإنشاء
        };
    } catch (error) {
        console.error('❌ خطأ في جلب بيانات الصيانة من API:', error);
        return null;
    }
}

// ✅ دالة للتحقق من انتهاء صلاحية الرابط
function checkLinkExpiry(createdAt) {
    if (!createdAt) return { expired: false, expiredView: false };
    
    try {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        const monthsDiff = Math.floor(daysDiff / 30);
        
        // انتهاء الصلاحية بعد أسبوع (7 أيام)
        const expired = daysDiff > 7;
        
        // انتهاء فترة العرض بعد 3 أشهر (90 يوم)
        const expiredView = daysDiff > 90;
        
        return {
            expired: expired,
            expiredView: expiredView,
            daysSinceCreation: daysDiff,
            monthsSinceCreation: monthsDiff
        };
    } catch (error) {
        console.error('خطأ في التحقق من انتهاء الصلاحية:', error);
        return { expired: false, expiredView: false };
    }
}

// ✅ دالة لعرض رسالة انتهاء الصلاحية
function showExpiredMessage(expiryInfo) {
    try {
        const statusSection = document.querySelector('.status-section');
        if (!statusSection) return;
        
        // إنشاء div للرسالة
        let expiredDiv = document.getElementById('expiredMessage');
        if (!expiredDiv) {
            expiredDiv = document.createElement('div');
            expiredDiv.id = 'expiredMessage';
            expiredDiv.style.cssText = `
                background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: center;
                box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
            `;
            statusSection.insertBefore(expiredDiv, statusSection.firstChild);
        }
        
        if (expiryInfo.expiredView) {
            // بعد 3 أشهر
            expiredDiv.innerHTML = `
                <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    انتهت فترة العرض
                </h3>
                <p style="margin: 0; font-size: 0.95em;">
                    عذراً، انتهت فترة عرض هذه العملية (أكثر من 3 أشهر). لم يعد بإمكانك عرض بيانات العملية.
                </p>
            `;
            expiredDiv.style.display = 'block';
            expiredDiv.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        } else if (expiryInfo.expired) {
            // بعد أسبوع
            expiredDiv.innerHTML = `
                <h3 style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="bi bi-clock-history"></i>
                    انتهت صلاحية الرابط
                </h3>
                <p style="margin: 0; font-size: 0.95em;">
                    انتهت صلاحية الرابط (أكثر من أسبوع). يمكنك عرض بيانات العملية والتقييم فقط، لكن لا يمكنك تعديل التقييم.
                </p>
            `;
            expiredDiv.style.display = 'block';
        } else {
            expiredDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('خطأ في عرض رسالة انتهاء الصلاحية:', error);
    }
}

// ✅ دالة لتحديث البيانات
async function refreshTracking() {
    try {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> جاري التحديث...';
        }
        
        // إظهار شاشة التحميل
        showLoading();
        
        // محاولة جلب البيانات من API إذا كان متاحاً
        const newData = await fetchRepairDataFromAPI(repairTrackingData.repairNumber);
        if (newData) {
            window.setRepairTrackingData(newData);
        } else {
            // إذا فشل جلب البيانات من API، استخدام البيانات المحلية
            console.log('ℹ️ استخدام البيانات المحلية');
        }
        
        // إعادة عرض الصفحة
        renderTrackingPage();
        
        // إخفاء شاشة التحميل
        hideLoading();
        
        // استعادة زر التحديث
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> تحديث';
        }
        
        // رسالة نجاح
        if (typeof showMessage === 'function') {
            showMessage('تم تحديث البيانات بنجاح');
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث البيانات:', error);
        hideLoading();
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> تحديث';
        }
        
        if (typeof showMessage === 'function') {
            showMessage('حدث خطأ أثناء تحديث البيانات', 'error');
        } else {
            alert('حدث خطأ أثناء تحديث البيانات');
        }
    }
}

// ✅ دالة للعودة للصفحة الرئيسية
function goToHome() {
    try {
        // التحقق من وجود دالة للتنقل
        if (typeof window.navigateToSection === 'function') {
            window.navigateToSection('dashboard');
        } else if (typeof window.location !== 'undefined') {
            // إذا كان في صفحة منفصلة، العودة للصفحة الرئيسية
            window.location.href = 'index.html';
        } else {
            console.warn('⚠️ لا يمكن تحديد طريقة التنقل');
        }
    } catch (error) {
        console.error('❌ خطأ في التنقل:', error);
    }
}

// ✅ دالة لإظهار شاشة التحميل
function showLoading() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    } catch (error) {
        console.error('خطأ في إظهار شاشة التحميل:', error);
    }
}

// ✅ دالة لإخفاء شاشة التحميل
function hideLoading() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    } catch (error) {
        console.error('خطأ في إخفاء شاشة التحميل:', error);
    }
}

// ✅ دالة لعرض رسالة خطأ
function showError(message) {
    try {
        if (typeof showMessage === 'function') {
            showMessage(message, 'error');
        } else {
            alert(message);
        }
    } catch (error) {
        console.error('خطأ في عرض رسالة الخطأ:', error);
    }
}

// ✅ دالة لـ escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ✅ تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // التحقق من وجود بيانات في localStorage
        const savedData = localStorage.getItem('repairTrackingData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                window.setRepairTrackingData(data);
                localStorage.removeItem('repairTrackingData'); // حذف البيانات بعد الاستخدام
                console.log('✅ تم تحميل البيانات من localStorage');
            } catch (parseError) {
                console.error('❌ خطأ في تحليل البيانات من localStorage:', parseError);
            }
        }
        
        // التحقق من وجود بيانات في URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const repairNumber = urlParams.get('repair_number');
        const status = urlParams.get('status');
        
        if (repairNumber) {
            repairTrackingData.repairNumber = repairNumber;
            
            // محاولة جلب البيانات من API إذا كان متاحاً
            if (typeof API !== 'undefined') {
                try {
                    const apiData = await fetchRepairDataFromAPI(repairNumber);
                    if (apiData) {
                        window.setRepairTrackingData(apiData);
                        console.log('✅ تم تحميل البيانات من API');
                        
                        // ✅ التحقق من انتهاء الصلاحية
                        if (apiData.createdAt) {
                            const expiryInfo = checkLinkExpiry(apiData.createdAt);
                            
                            // ✅ حفظ حالة انتهاء الصلاحية
                            isViewExpired = expiryInfo.expiredView;
                            isLinkExpired = expiryInfo.expired;
                            
                            // إذا انتهت فترة العرض (3 أشهر)، إخفاء المحتوى
                            if (expiryInfo.expiredView) {
                                showExpiredMessage(expiryInfo);
                                // إخفاء المحتوى الرئيسي
                                const progressSection = document.querySelector('.progress-section');
                                const ratingSection = document.getElementById('ratingSection');
                                const ratingDisplay = document.getElementById('ratingDisplay');
                                if (progressSection) progressSection.style.display = 'none';
                                if (ratingSection) ratingSection.style.display = 'none';
                                if (ratingDisplay) ratingDisplay.style.display = 'none';
                                return; // التوقف هنا
                            }
                            
                            // إذا انتهت الصلاحية (أسبوع)، عرض الرسالة وتعطيل التقييم
                            if (expiryInfo.expired) {
                                showExpiredMessage(expiryInfo);
                                // تعطيل نموذج التقييم (إخفاؤه)
                                const ratingSection = document.getElementById('ratingSection');
                                if (ratingSection) {
                                    ratingSection.style.display = 'none';
                                }
                                // إظهار التقييم الموجود فقط (إذا كان موجوداً)
                                // سيتم التعامل معه في loadExistingRating
                            }
                        }
                    } else {
                        // إذا فشل جلب البيانات من API، استخدام البيانات الافتراضية
                        if (status) {
                            repairTrackingData.status = status;
                        }
                        renderTrackingPage();
                    }
                } catch (apiError) {
                    console.warn('⚠️ لا يمكن جلب البيانات من API:', apiError);
                    if (status) {
                        repairTrackingData.status = status;
                    }
                    renderTrackingPage();
                }
            } else {
                // إذا لم يكن API متاحاً، استخدام البيانات الافتراضية
                if (status) {
                    repairTrackingData.status = status;
                }
                renderTrackingPage();
            }
        } else {
            // إذا لم يكن هناك رقم صيانة، عرض الصفحة بالبيانات الافتراضية
            renderTrackingPage();
        }
        
        console.log('✅ تم تحميل صفحة تتبع الصيانة بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تهيئة الصفحة:', error);
        showError('حدث خطأ أثناء تحميل الصفحة');
    }
});

// ========== دوال التقييم ==========

let currentRepairId = null;
let existingRating = null;

// ✅ دالة لتعيين التقييم
window.setRating = function(type, rating) {
    try {
        const ratingContainer = document.getElementById(`${type}Rating`);
        const ratingValue = document.getElementById(`${type}RatingValue`);
        const ratingError = document.getElementById(`${type}RatingError`);
        
        if (!ratingContainer || !ratingValue) return;
        
        // تحديث النجوم
        const stars = ratingContainer.querySelectorAll('.star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
        
        // تحديث القيمة المخفية
        ratingValue.value = rating;
        
        // إخفاء رسالة الخطأ
        if (ratingError) {
            ratingError.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ خطأ في تعيين التقييم:', error);
    }
};

// ✅ متغير لحفظ حالة انتهاء الصلاحية
let isLinkExpired = false;
let isViewExpired = false;

// ✅ دالة لإرسال التقييم
window.submitRating = async function(event) {
    event.preventDefault();
    
    // ✅ التحقق من انتهاء الصلاحية
    if (isLinkExpired || isViewExpired) {
        showMessage('انتهت صلاحية الرابط. لا يمكن تعديل التقييم.', 'error');
        return;
    }
    
    try {
        const repairRating = parseInt(document.getElementById('repairRatingValue').value);
        const technicianRating = parseInt(document.getElementById('technicianRatingValue').value);
        const comment = document.getElementById('ratingComment').value.trim();
        
        // التحقق من التقييمات
        if (repairRating === 0) {
            document.getElementById('repairRatingError').style.display = 'block';
            return;
        }
        
        if (technicianRating === 0) {
            document.getElementById('technicianRatingError').style.display = 'block';
            return;
        }
        
        // إخفاء رسائل الخطأ
        document.getElementById('repairRatingError').style.display = 'none';
        document.getElementById('technicianRatingError').style.display = 'none';
        
        // إظهار شاشة التحميل
        showLoading();
        
        // تعطيل زر الإرسال
        const submitBtn = document.querySelector('.btn-submit-rating');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإرسال...';
        }
        
        // إرسال التقييم إلى API
        let result = null;
        if (typeof API !== 'undefined') {
            try {
                result = await API.request('repair-ratings.php', 'POST', {
                    repair_id: currentRepairId,
                    repair_number: repairTrackingData.repairNumber,
                    repair_rating: repairRating,
                    technician_rating: technicianRating,
                    comment: comment
                });
            } catch (apiError) {
                console.error('❌ خطأ في إرسال التقييم:', apiError);
                result = { success: false, message: 'حدث خطأ أثناء إرسال التقييم' };
            }
        } else {
            // إذا لم يكن API متاحاً، حفظ في localStorage
            const ratingData = {
                repair_id: currentRepairId,
                repair_number: repairTrackingData.repairNumber,
                repair_rating: repairRating,
                technician_rating: technicianRating,
                comment: comment,
                created_at: new Date().toISOString()
            };
            localStorage.setItem(`repair_rating_${repairTrackingData.repairNumber}`, JSON.stringify(ratingData));
            result = { success: true, message: 'تم حفظ التقييم بنجاح' };
        }
        
        // إخفاء شاشة التحميل
        hideLoading();
        
        if (result && result.success) {
            // إظهار رسالة النجاح
            if (typeof showMessage === 'function') {
                showMessage('شكراً لك! تم حفظ تقييمك بنجاح');
            } else {
                alert('شكراً لك! تم حفظ تقييمك بنجاح');
            }
            
            // حفظ التقييم محلياً
            existingRating = {
                repair_rating: repairRating,
                technician_rating: technicianRating,
                comment: comment,
                created_at: new Date().toISOString()
            };
            
            // إخفاء نموذج التقييم وعرض التقييم الموجود
            hideRatingForm();
            showRatingDisplay();
        } else {
            // إظهار رسالة الخطأ
            if (typeof showMessage === 'function') {
                showMessage(result?.message || 'حدث خطأ أثناء إرسال التقييم', 'error');
            } else {
                alert(result?.message || 'حدث خطأ أثناء إرسال التقييم');
            }
            
            // استعادة زر الإرسال
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> إرسال التقييم';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال التقييم:', error);
        hideLoading();
        
        if (typeof showMessage === 'function') {
            showMessage('حدث خطأ أثناء إرسال التقييم', 'error');
        } else {
            alert('حدث خطأ أثناء إرسال التقييم');
        }
        
        // استعادة زر الإرسال
        const submitBtn = document.querySelector('.btn-submit-rating');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> إرسال التقييم';
        }
    }
};

// ✅ دالة لتخطي التقييم
window.skipRating = function() {
    try {
        if (confirm('هل أنت متأكد من تخطي التقييم؟ يمكنك تقييم الخدمة لاحقاً.')) {
            hideRatingForm();
        }
    } catch (error) {
        console.error('❌ خطأ في تخطي التقييم:', error);
    }
};

// ✅ دالة لإظهار نموذج التقييم
function showRatingForm() {
    try {
        const ratingSection = document.getElementById('ratingSection');
        if (ratingSection) {
            ratingSection.style.display = 'block';
            
            // التمرير إلى نموذج التقييم
            setTimeout(() => {
                ratingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    } catch (error) {
        console.error('❌ خطأ في إظهار نموذج التقييم:', error);
    }
}

// ✅ دالة لإخفاء نموذج التقييم
function hideRatingForm() {
    try {
        const ratingSection = document.getElementById('ratingSection');
        if (ratingSection) {
            ratingSection.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ خطأ في إخفاء نموذج التقييم:', error);
    }
}

// ✅ دالة لإظهار التقييم الموجود
function showRatingDisplay() {
    try {
        const ratingDisplay = document.getElementById('ratingDisplay');
        if (!ratingDisplay || !existingRating) return;
        
        // عرض تقييم الصيانة
        const repairRatingDisplay = document.getElementById('displayRepairRating');
        if (repairRatingDisplay) {
            repairRatingDisplay.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.className = 'star' + (i <= existingRating.repair_rating ? '' : ' empty');
                star.innerHTML = '<i class="bi bi-star"></i>';
                repairRatingDisplay.appendChild(star);
            }
        }
        
        // عرض تقييم الفني
        const technicianRatingDisplay = document.getElementById('displayTechnicianRating');
        if (technicianRatingDisplay) {
            technicianRatingDisplay.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.className = 'star' + (i <= existingRating.technician_rating ? '' : ' empty');
                star.innerHTML = '<i class="bi bi-star"></i>';
                technicianRatingDisplay.appendChild(star);
            }
        }
        
        // عرض التعليق
        const commentDisplay = document.getElementById('displayComment');
        const commentText = document.getElementById('displayCommentText');
        if (commentDisplay && commentText) {
            if (existingRating.comment && existingRating.comment.trim()) {
                commentText.textContent = existingRating.comment;
                commentDisplay.style.display = 'block';
            } else {
                commentDisplay.style.display = 'none';
            }
        }
        
        // عرض التاريخ
        const ratingDate = document.getElementById('displayRatingDate');
        if (ratingDate && existingRating.created_at) {
            ratingDate.textContent = formatArabicDate(existingRating.created_at);
        }
        
        ratingDisplay.style.display = 'block';
        
        // التمرير إلى التقييم
        setTimeout(() => {
            ratingDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    } catch (error) {
        console.error('❌ خطأ في عرض التقييم:', error);
    }
}

// ✅ دالة للتحقق من وجود تقييم
async function checkExistingRating() {
    try {
        if (!currentRepairId && !repairTrackingData.repairNumber) return;
        
        // محاولة جلب التقييم من API
        if (typeof API !== 'undefined') {
            try {
                const result = await API.request(`repair-ratings.php?repair_number=${encodeURIComponent(repairTrackingData.repairNumber)}`, 'GET');
                if (result && result.success && result.data) {
                    existingRating = result.data;
                    return true;
                }
            } catch (apiError) {
                console.warn('⚠️ لا يمكن جلب التقييم من API:', apiError);
            }
        }
        
        // محاولة جلب التقييم من localStorage
        const savedRating = localStorage.getItem(`repair_rating_${repairTrackingData.repairNumber}`);
        if (savedRating) {
            try {
                existingRating = JSON.parse(savedRating);
                return true;
            } catch (parseError) {
                console.error('❌ خطأ في تحليل التقييم من localStorage:', parseError);
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ خطأ في التحقق من التقييم:', error);
        return false;
    }
}

// ✅ تحديث دالة renderTrackingPage لإظهار نموذج التقييم
const originalRenderTrackingPage = renderTrackingPage;
renderTrackingPage = async function() {
    try {
        // استدعاء الدالة الأصلية
        originalRenderTrackingPage();
        
        // ✅ التحقق من انتهاء الصلاحية - إذا انتهت لا نعرض نموذج التقييم
        if (isLinkExpired || isViewExpired) {
            // التحقق من وجود تقييم لإظهاره فقط (read-only)
            const hasRating = await checkExistingRating();
            if (hasRating) {
                showRatingDisplay();
            }
            hideRatingForm();
            return;
        }
        
        // التحقق من حالة الصيانة
        const isDelivered = repairTrackingData.status === 'delivered' || repairTrackingData.status === 'cancelled';
        
        if (isDelivered) {
            // التحقق من وجود تقييم
            const hasRating = await checkExistingRating();
            
            if (hasRating) {
                // إظهار التقييم الموجود
                hideRatingForm();
                showRatingDisplay();
            } else {
                // إظهار نموذج التقييم (فقط إذا لم تنته الصلاحية)
                if (!isLinkExpired) {
                    showRatingForm();
                }
            }
        } else {
            // إخفاء نموذج التقييم إذا لم تكن الصيانة منتهية
            hideRatingForm();
            const ratingDisplay = document.getElementById('ratingDisplay');
            if (ratingDisplay) {
                ratingDisplay.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('❌ خطأ في عرض صفحة التتبع:', error);
    }
};

// ✅ تم دمج إضافة repair_id في دالة setRepairTrackingData الأصلية

// ✅ تصدير الدوال للاستخدام الخارجي
window.refreshTracking = refreshTracking;
window.goToHome = goToHome;
window.renderTrackingPage = renderTrackingPage;
window.submitRating = window.submitRating;
window.setRating = window.setRating;
window.skipRating = window.skipRating;

} // ✅ نهاية حماية من التحميل المكرر

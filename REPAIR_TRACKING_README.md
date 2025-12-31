# 📋 دليل استخدام قالب تتبع الصيانة

## 📁 الملفات المطلوبة

1. **repair-tracking.html** - الصفحة الرئيسية للقالب
2. **css/repair-tracking.css** - ملف التنسيقات
3. **js/repair-tracking.js** - ملف JavaScript للتفاعل

## 🚀 طريقة الاستخدام

### 1. فتح الصفحة مباشرة

```html
<a href="repair-tracking.html?repair_number=R20231201001&status=diagnosis">
    عرض حالة الصيانة
</a>
```

### 2. استخدام JavaScript من صفحة عمليات الصيانة

#### أ) تمرير البيانات عند فتح الصفحة:

```javascript
// في ملف js/repairs.js أو أي ملف متعلق بعمليات الصيانة

function openRepairTracking(repairId, repairNumber) {
    try {
        // جلب بيانات الصيانة من API
        const repair = await API.getRepair(repairId);
        
        if (!repair || !repair.success) {
            showMessage('حدث خطأ في جلب بيانات الصيانة', 'error');
            return;
        }
        
        // تحويل حالة الصيانة إلى حالة التتبع
        const statusMap = {
            'pending': 'pickup',
            'in_progress': 'diagnosis',
            'ready': 'testing',
            'delivered': 'delivery',
            'cancelled': 'pickup'
        };
        
        const trackingStatus = statusMap[repair.data.status] || 'pickup';
        
        // بناء بيانات المراحل
        const stages = [
            {
                id: 'pickup',
                name: 'الاستلام',
                description: 'تم استلام المنتج منك.',
                date: repair.data.created_at ? repair.data.created_at.split('T')[0] : null,
                completed: true
            },
            {
                id: 'diagnosis',
                name: 'التشخيص',
                description: 'نقوم بتشخيص منتجك.',
                date: repair.data.status === 'in_progress' ? new Date().toISOString().split('T')[0] : null,
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
                date: repair.data.delivery_date || null,
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
        
        // بناء بيانات التتبع
        const trackingData = {
            repairNumber: repair.data.repair_number || repairNumber,
            status: trackingStatus,
            statusDescription: getStatusDescription(trackingStatus, repair.data),
            estimatedDeliveryDate: repair.data.delivery_date || calculateEstimatedDate(repair.data.created_at),
            stages: stages
        };
        
        // فتح الصفحة مع تمرير البيانات
        const url = `repair-tracking.html?repair_number=${encodeURIComponent(trackingData.repairNumber)}&status=${encodeURIComponent(trackingStatus)}`;
        window.open(url, '_blank');
        
        // بعد تحميل الصفحة، تمرير البيانات
        setTimeout(() => {
            const trackingWindow = window.open('', '_blank');
            if (trackingWindow && trackingWindow.setRepairTrackingData) {
                trackingWindow.setRepairTrackingData(trackingData);
            }
        }, 500);
        
    } catch (error) {
        console.error('خطأ في فتح صفحة التتبع:', error);
        showMessage('حدث خطأ في فتح صفحة التتبع', 'error');
    }
}

// دالة مساعدة للحصول على وصف الحالة
function getStatusDescription(status, repairData) {
    const descriptions = {
        'pickup': 'تم استلام المنتج بنجاح منك وهو في انتظار التشخيص.',
        'diagnosis': 'تم تسليم المنتج بنجاح إلى مركز الخدمة وهو قيد التشخيص حالياً. يعمل فريقنا بجد لتحديد المشكلة وتحديد الإصلاحات أو الخدمات المطلوبة.',
        'repair': 'تم تشخيص المشكلة بنجاح. نقوم حالياً بإصلاح المنتج باستخدام أفضل الأدوات والقطع الأصلية.',
        'testing': 'تم إصلاح المنتج بنجاح. نقوم حالياً باختبار المنتج للتأكد من عمله بشكل صحيح.',
        'packaging': 'تم اختبار المنتج بنجاح. نقوم حالياً بتغليف المنتج استعداداً للتسليم.',
        'delivery': 'تم تجهيز المنتج بنجاح. المنتج جاهز للاستلام من مركز الخدمة.'
    };
    
    return descriptions[status] || descriptions['diagnosis'];
}

// دالة مساعدة لحساب تاريخ التسليم المتوقع
function calculateEstimatedDate(createdDate) {
    if (!createdDate) return null;
    
    const created = new Date(createdDate);
    const estimated = new Date(created);
    estimated.setDate(estimated.getDate() + 14); // 14 يوم من تاريخ الإنشاء
    
    return estimated.toISOString().split('T')[0];
}
```

#### ب) استخدام localStorage للتمرير بين الصفحات:

```javascript
// في صفحة عمليات الصيانة (js/repairs.js)
function openRepairTracking(repairId, repairNumber) {
    // ... بناء trackingData كما في المثال السابق ...
    
    // حفظ البيانات في localStorage
    localStorage.setItem('repairTrackingData', JSON.stringify(trackingData));
    
    // فتح الصفحة
    window.open('repair-tracking.html', '_blank');
}

// في repair-tracking.js (يتم إضافتها تلقائياً)
// يتم قراءة البيانات من localStorage عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    try {
        const savedData = localStorage.getItem('repairTrackingData');
        if (savedData) {
            const data = JSON.parse(savedData);
            window.setRepairTrackingData(data);
            localStorage.removeItem('repairTrackingData'); // حذف البيانات بعد الاستخدام
        }
    } catch (error) {
        console.error('خطأ في قراءة البيانات:', error);
    }
});
```

## 📊 هيكل البيانات المتوقع

```javascript
{
    repairNumber: 'R20231201001',        // رقم عملية الصيانة
    status: 'diagnosis',                 // الحالة الحالية: 'pickup', 'diagnosis', 'repair', 'testing', 'packaging', 'delivery'
    statusDescription: 'وصف الحالة...',   // وصف نصي للحالة الحالية
    estimatedDeliveryDate: '2023-12-15', // تاريخ التسليم المتوقع (YYYY-MM-DD)
    stages: [                             // مصفوفة المراحل
        {
            id: 'pickup',                 // معرف المرحلة
            name: 'الاستلام',             // اسم المرحلة
            description: 'تم استلام المنتج منك.', // وصف المرحلة
            date: '2023-12-01',          // تاريخ إكمال المرحلة (YYYY-MM-DD) أو null
            completed: true,              // هل تم إكمال المرحلة
            active: false                 // هل المرحلة نشطة حالياً
        },
        // ... باقي المراحل
    ]
}
```

## 🎨 التخصيص

### تغيير الألوان

يمكن تعديل الألوان من خلال CSS Variables في `css/style.css`:

```css
:root {
    --primary-color: #2196F3;      /* اللون الأساسي للمراحل النشطة */
    --success-color: #4CAF50;      /* لون النجاح */
    --text-dark: #333;             /* لون النص الداكن */
    --text-light: #666;            /* لون النص الفاتح */
    --border-color: #ddd;           /* لون الحدود */
}
```

### إضافة مراحل جديدة

في `js/repair-tracking.js`، قم بتحديث مصفوفة `stages` في `repairTrackingData`:

```javascript
stages: [
    // ... المراحل الحالية ...
    {
        id: 'new_stage',
        name: 'مرحلة جديدة',
        description: 'وصف المرحلة الجديدة.',
        date: null,
        completed: false
    }
]
```

## 🔧 الدوال المتاحة

### `setRepairTrackingData(data)`
تحديث بيانات التتبع من خارج الصفحة.

```javascript
window.setRepairTrackingData({
    repairNumber: 'R20231201001',
    status: 'diagnosis',
    // ...
});
```

### `refreshTracking()`
تحديث البيانات من API (إذا كان متاحاً).

```javascript
window.refreshTracking();
```

### `goToHome()`
العودة للصفحة الرئيسية.

```javascript
window.goToHome();
```

## 📱 Responsive Design

القالب متجاوب بالكامل ويعمل على:
- 📱 **Mobile** (< 576px)
- 📱 **Tablet** (576px - 768px)
- 💻 **Desktop** (768px+)

## ⚠️ ملاحظات مهمة

1. **الأمان**: تأكد من استخدام `escapeHtml()` عند عرض البيانات من المستخدم.
2. **الأداء**: يتم استخدام `defer` لتحميل JavaScript بشكل غير متزامن.
3. **التوافق**: القالب متوافق مع جميع المتصفحات الحديثة.
4. **الوصولية**: جميع العناصر قابلة للوصول باستخدام لوحة المفاتيح.

## 🔗 الربط مع صفحة عمليات الصيانة

### مثال كامل للربط:

```javascript
// في js/repairs.js

// إضافة زر "عرض حالة الصيانة" في جدول عمليات الصيانة
function displayRepairs(repairs) {
    // ... كود عرض الجدول ...
    
    // في كل صف، إضافة زر:
    const trackingBtn = `
        <button onclick="openRepairTracking('${repair.id}', '${repair.repair_number}')" 
                class="btn btn-sm btn-primary">
            <i class="bi bi-eye"></i> عرض الحالة
        </button>
    `;
    
    // ... إضافة الزر للجدول ...
}

// دالة فتح صفحة التتبع
async function openRepairTracking(repairId, repairNumber) {
    try {
        // جلب بيانات الصيانة
        const result = await API.getRepair(repairId);
        
        if (!result || !result.success) {
            showMessage('حدث خطأ في جلب بيانات الصيانة', 'error');
            return;
        }
        
        const repair = result.data;
        
        // بناء بيانات التتبع
        const trackingData = buildTrackingData(repair, repairNumber);
        
        // حفظ في localStorage
        localStorage.setItem('repairTrackingData', JSON.stringify(trackingData));
        
        // فتح الصفحة
        window.open('repair-tracking.html', '_blank');
        
    } catch (error) {
        console.error('خطأ في فتح صفحة التتبع:', error);
        showMessage('حدث خطأ في فتح صفحة التتبع', 'error');
    }
}

// دالة مساعدة لبناء بيانات التتبع
function buildTrackingData(repair, repairNumber) {
    // ... بناء البيانات كما في الأمثلة السابقة ...
    return trackingData;
}
```

## ✅ Checklist للتنفيذ

- [ ] إضافة ملفات القالب (HTML, CSS, JS)
- [ ] ربط القالب بصفحة عمليات الصيانة
- [ ] إضافة دالة `getRepairTrackingData()` في API (اختياري)
- [ ] اختبار القالب على مختلف الأجهزة
- [ ] اختبار تمرير البيانات من صفحة عمليات الصيانة
- [ ] التأكد من عمل جميع الأزرار والوظائف

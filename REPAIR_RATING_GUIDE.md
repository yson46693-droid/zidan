# 📋 دليل استخدام نموذج التقييم

## 📁 الملفات المضافة

1. **نموذج التقييم في `repair-tracking.html`** - نموذج تقييم الصيانة والفني
2. **CSS للتقييم في `css/repair-tracking.css`** - تنسيقات نموذج التقييم
3. **JavaScript في `js/repair-tracking.js`** - دوال إدارة التقييم
4. **API Endpoint `api/repair-ratings.php`** - حفظ وجلب التقييمات

## 🎯 المميزات

- ✅ تقييم الصيانة (1-5 نجوم)
- ✅ تقييم الفني (1-5 نجوم)
- ✅ حقل تعليقات اختياري
- ✅ يظهر فقط عند انتهاء الصيانة (status = 'delivery')
- ✅ عرض التقييم الموجود إذا كان موجوداً
- ✅ حفظ التقييم في قاعدة البيانات
- ✅ دعم localStorage كبديل
- ✅ Responsive Design

## 🚀 طريقة العمل

### 1. إظهار النموذج

النموذج يظهر تلقائياً عندما:
- حالة الصيانة = `'delivery'`
- لا يوجد تقييم سابق

```javascript
// في js/repair-tracking.js
if (status === 'delivery') {
    const hasRating = await checkExistingRating();
    if (!hasRating) {
        showRatingForm(); // إظهار النموذج
    } else {
        showRatingDisplay(); // عرض التقييم الموجود
    }
}
```

### 2. إرسال التقييم

```javascript
// عند إرسال النموذج
window.submitRating(event) {
    // التحقق من التقييمات
    // إرسال إلى API
    // حفظ في localStorage كبديل
    // إظهار التقييم الموجود
}
```

### 3. حفظ التقييم

#### أ) في قاعدة البيانات (API):

```php
// api/repair-ratings.php
POST /api/repair-ratings.php
{
    "repair_id": "repair_123",
    "repair_number": "R20231201001",
    "repair_rating": 5,
    "technician_rating": 4,
    "comment": "خدمة ممتازة"
}
```

#### ب) في localStorage (بديل):

```javascript
localStorage.setItem(`repair_rating_${repairNumber}`, JSON.stringify({
    repair_rating: 5,
    technician_rating: 4,
    comment: "خدمة ممتازة",
    created_at: "2023-12-01T10:00:00Z"
}));
```

## 📊 هيكل قاعدة البيانات

```sql
CREATE TABLE IF NOT EXISTS `repair_ratings` (
    `id` varchar(50) NOT NULL,
    `repair_id` varchar(50) DEFAULT NULL,
    `repair_number` varchar(50) NOT NULL,
    `repair_rating` tinyint(1) NOT NULL DEFAULT 5,
    `technician_rating` tinyint(1) NOT NULL DEFAULT 5,
    `comment` text DEFAULT NULL,
    `created_at` datetime NOT NULL,
    `updated_at` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_repair_id` (`repair_id`),
    KEY `idx_repair_number` (`repair_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 🔧 API Endpoints

### 1. جلب التقييم

```javascript
GET /api/repair-ratings.php?repair_number=R20231201001
// أو
GET /api/repair-ratings.php?repair_id=repair_123

// Response
{
    "success": true,
    "data": {
        "id": "rating_123",
        "repair_id": "repair_123",
        "repair_number": "R20231201001",
        "repair_rating": 5,
        "technician_rating": 4,
        "comment": "خدمة ممتازة",
        "created_at": "2023-12-01 10:00:00"
    }
}
```

### 2. حفظ التقييم

```javascript
POST /api/repair-ratings.php
{
    "repair_id": "repair_123",
    "repair_number": "R20231201001",
    "repair_rating": 5,
    "technician_rating": 4,
    "comment": "خدمة ممتازة"
}

// Response
{
    "success": true,
    "message": "تم حفظ التقييم بنجاح",
    "data": { /* التقييم المحفوظ */ }
}
```

### 3. حذف التقييم

```javascript
DELETE /api/repair-ratings.php
{
    "id": "rating_123"
}
```

## 💻 استخدام من صفحة عمليات الصيانة

### تمرير `repair_id` مع البيانات:

```javascript
// في js/repairs.js أو js/repair-tracking-integration-example.js

function buildRepairTrackingData(repair) {
    return {
        repairId: repair.id, // ✅ مهم للتقييم
        repairNumber: repair.repair_number,
        status: 'delivery',
        // ... باقي البيانات
    };
}

// عند فتح صفحة التتبع
const trackingData = buildRepairTrackingData(repair);
localStorage.setItem('repairTrackingData', JSON.stringify(trackingData));
window.open('repair-tracking.html', '_blank');
```

## 🎨 التخصيص

### تغيير عدد النجوم

في `js/repair-tracking.js`، يمكن تعديل عدد النجوم:

```javascript
// حالياً: 5 نجوم
// يمكن تغييرها إلى 10 نجوم مثلاً
```

### تغيير الألوان

في `css/repair-tracking.css`:

```css
.star.active {
    color: var(--warning-color); /* يمكن تغييره */
}
```

### إضافة حقول إضافية

1. إضافة حقل في HTML
2. إضافة CSS للتنسيق
3. إضافة JavaScript للتحقق
4. تحديث API لحفظ الحقل الجديد

## ✅ Checklist

- [x] نموذج التقييم يظهر عند status = 'delivery'
- [x] تقييم الصيانة (1-5 نجوم)
- [x] تقييم الفني (1-5 نجوم)
- [x] حقل تعليقات
- [x] حفظ في قاعدة البيانات
- [x] دعم localStorage
- [x] عرض التقييم الموجود
- [x] Responsive Design
- [x] Error Handling
- [x] API Endpoints

## 🔍 اختبار النموذج

### 1. اختبار يدوي:

1. افتح `repair-tracking.html`
2. اضبط `status = 'delivery'` في JavaScript
3. يجب أن يظهر نموذج التقييم
4. املأ التقييمات وأرسل
5. يجب أن يظهر التقييم الموجود

### 2. اختبار من صفحة عمليات الصيانة:

```javascript
// في console
window.setRepairTrackingData({
    repairId: 'test_123',
    repairNumber: 'R20231201001',
    status: 'delivery',
    // ...
});

// يجب أن يظهر نموذج التقييم
```

## 📝 ملاحظات مهمة

1. **النموذج يظهر فقط عند `status = 'delivery'`**
2. **يتم التحقق من وجود تقييم سابق قبل إظهار النموذج**
3. **إذا كان التقييم موجوداً، يتم عرضه بدلاً من النموذج**
4. **يمكن تخطي التقييم، لكن يمكن تقييمه لاحقاً**
5. **التقييمات محفوظة في جدول `repair_ratings`**

## 🐛 استكشاف الأخطاء

### النموذج لا يظهر:

1. تحقق من `status === 'delivery'`
2. تحقق من عدم وجود تقييم سابق
3. تحقق من وجود العناصر في DOM

### التقييم لا يُحفظ:

1. تحقق من وجود API
2. تحقق من console للأخطاء
3. تحقق من localStorage كبديل

### التقييم الموجود لا يظهر:

1. تحقق من `checkExistingRating()`
2. تحقق من API response
3. تحقق من localStorage

## 🔗 روابط مفيدة

- [REPAIR_TRACKING_README.md](./REPAIR_TRACKING_README.md) - دليل استخدام صفحة التتبع
- [js/repair-tracking-integration-example.js](./js/repair-tracking-integration-example.js) - مثال على الربط

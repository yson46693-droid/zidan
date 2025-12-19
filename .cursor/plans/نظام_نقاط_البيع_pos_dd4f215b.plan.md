---
name: نظام نقاط البيع POS
overview: إنشاء نظام POS كامل يعرض المخزون بنفس التقسيم (قطع الغيار، إكسسوارات، هواتف) مع سلة تسوق وفاتورة بعد الدفع تحتوي على اللوجو
todos:
  - id: create-database-tables
    content: إنشاء جداول sales و sale_items في قاعدة البيانات
    status: completed
  - id: create-sales-api
    content: إنشاء api/sales.php لمعالجة المبيعات وحفظها
    status: completed
  - id: create-pos-html
    content: إنشاء pos.html مع البنية الأساسية (عرض المنتجات، سلة التسوق)
    status: completed
  - id: create-pos-css
    content: إنشاء css/pos.css مع الأنماط باستخدام CSS Variables
    status: completed
  - id: create-pos-js
    content: إنشاء js/pos.js مع الوظائف (جلب المخزون، إدارة السلة، الفاتورة)
    status: completed
  - id: add-pos-link
    content: إضافة رابط POS في القائمة الجانبية في dashboard.html
    status: completed
---

# خ

طة إنشاء نظام نقاط البيع (POS)

## نظرة عامة

إنشاء نظام POS متكامل يعرض المخزون من قاعدة البيانات بنفس التقسيم الموجود (قطع الغيار، إكسسوارات، هواتف) مع واجهة مستخدم حديثة وسلة تسوق وفاتورة بعد الدفع.

## الملفات المطلوبة

### 1. الواجهة الأمامية

- **`pos.html`**: صفحة POS الرئيسية
- قسم عرض المنتجات (يسار) مع تبويبات للفئات
- قسم سلة التسوق (يمين) مع ملخص الطلب
- شريط بحث
- زر الدفع
- **`css/pos.css`**: أنماط POS
- استخدام CSS Variables من `style.css`
- تصميم responsive (mobile-first)
- أنماط للبطاقات والتبويبات والسلة
- **`js/pos.js`**: منطق POS
- جلب المخزون من API (`api/inventory.php`)
- تصفية المنتجات حسب الفئة
- إدارة سلة التسوق (إضافة/حذف/تعديل الكمية)
- حساب الإجمالي (الفرعي، الخصم، الضريبة، الإجمالي)
- إنشاء الفاتورة بعد الدفع
- طباعة الفاتورة

### 2. الواجهة الخلفية

- **`api/sales.php`**: API للمبيعات
- `POST`: إنشاء عملية بيع جديدة
- `GET`: جلب المبيعات (للتقارير)
- حفظ المبيعات في قاعدة البيانات

### 3. قاعدة البيانات

- **جدول `sales`**: لتخزين المبيعات
- `id`, `sale_number`, `total_amount`, `discount`, `tax`, `final_amount`
- `customer_name`, `customer_phone` (اختياري)
- `created_at`, `created_by`
- **جدول `sale_items`**: لتخزين عناصر المبيعات
- `id`, `sale_id`, `item_type` (spare_part/accessory/phone)
- `item_id`, `item_name`, `quantity`, `unit_price`, `total_price`

## التصميم والوظائف

### عرض المخزون

- **تبويبات الفئات**:
- "الكل" (يعرض كل المنتجات)
- "قطع الغيار" (spare_parts)
- "إكسسوارات" (accessories)
- "هواتف" (phones)
- **بطاقات المنتجات**:
- صورة المنتج
- اسم المنتج (brand + model للهواتف وقطع الغيار)
- السعر (selling_price)
- زر "إضافة للسلة"
- **البحث**:
- بحث فوري (debounce 300ms)
- البحث في الاسم والماركة والموديل

### سلة التسوق

- **عرض العناصر**:
- صورة مصغرة
- اسم المنتج
- الكمية (مع أزرار + و -)
- السعر الإجمالي للعنصر
- زر حذف
- **ملخص الطلب**:
- المجموع الفرعي
- الخصم (قابل للتعديل)
- الضريبة (قابل للتعديل)
- الإجمالي النهائي
- **زر الدفع**:
- يفتح نافذة تأكيد
- إدخال اسم العميل (اختياري)
- إدخال رقم الهاتف (اختياري)
- تأكيد الدفع

### الفاتورة

- **بعد الدفع**:
- عرض الفاتورة في نافذة منبثقة
- يحتوي على:
    - لوجو المتجر (من settings)
    - اسم المتجر وعنوانه ورقم الهاتف
    - رقم الفاتورة والتاريخ
    - تفاصيل العناصر
    - المجموع الفرعي والخصم والضريبة والإجمالي
- زر طباعة
- زر إغلاق (يعيد تهيئة السلة)

## التكامل مع النظام الحالي

### استخدام APIs الموجودة

- `api/inventory.php?type=spare_parts` - جلب قطع الغيار
- `api/inventory.php?type=accessories` - جلب الإكسسوارات
- `api/inventory.php?type=phones` - جلب الهواتف
- `api/settings.php` - جلب معلومات المتجر واللوجو

### استخدام CSS Variables

- `--primary-color`, `--secondary-color`
- `--success-color`, `--danger-color`, `--warning-color`
- `--text-dark`, `--text-light`
- `--white`, `--light-bg`
- `--border-color`, `--shadow`

### استخدام دوال API الموجودة

- `API.request()` من `js/api.js`
- `showMessage()` من `js/utils.js` (إن وجدت)

## متطلبات الأداء والأمان

### الأداء

- استخدام `defer` للـ scripts
- Debounce للبحث (300ms)
- Event delegation للبطاقات
- Batch DOM updates
- Lazy loading للصور

### معالجة الأخطاء

- Try-catch لجميع API calls
- التحقق من وجود العناصر قبل التلاعب
- رسائل خطأ واضحة للمستخدم
- Validation للبيانات قبل الإرسال

### Responsive Design

- Mobile-first approach
- Breakpoints:
- Mobile: < 576px
- Tablet: 576px - 768px
- Desktop: 768px+
- اختبار على جميع الأحجام

## خطوات التنفيذ

1. إنشاء جدول `sales` و `sale_items` في قاعدة البيانات
2. إنشاء `api/sales.php` لمعالجة المبيعات
3. إنشاء `pos.html` مع البنية الأساسية
4. إنشاء `css/pos.css` مع الأنماط
5. إنشاء `js/pos.js` مع الوظائف
6. اختبار النظام على جميع الأجهزة
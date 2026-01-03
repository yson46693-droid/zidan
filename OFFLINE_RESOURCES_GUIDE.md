# دليل تحميل الموارد محلياً للعمل بدون إنترنت

## المشكلة
عند انقطاع الإنترنت، لا يتم تحميل الموارد من CDN (مثل Bootstrap Icons و Google Fonts)، مما يؤدي إلى ظهور الموقع بدون تصميم.

## الحل المطبق
تم إنشاء نظام `resource-checker.js` الذي:
1. ✅ يتحقق من تحميل الموارد الحرجة (CSS, Bootstrap Icons, Fonts)
2. ✅ يمنع عرض الصفحة بدون تصميم
3. ✅ يعرض رسالة خطأ واضحة عند انقطاع الإنترنت
4. ✅ يستخدم fallback fonts في حالة فشل تحميل Google Fonts

## الحل الإضافي (اختياري): تحميل Bootstrap Icons محلياً

لتحميل Bootstrap Icons محلياً بدلاً من CDN:

### الخطوة 1: تحميل Bootstrap Icons
1. افتح: https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css
2. احفظ الملف في: `css/bootstrap-icons.css`
3. احفظ ملف الخطوط من: https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff2
4. أنشئ مجلد `css/fonts/` وضع ملف الخطوط فيه

### الخطوة 2: تحديث ملف CSS
افتح `css/bootstrap-icons.css` وعدّل المسارات:
```css
/* تغيير من */
@font-face {
  font-family: "bootstrap-icons";
  src: url("./fonts/bootstrap-icons.woff2") format("woff2");
}

/* إلى */
@font-face {
  font-family: "bootstrap-icons";
  src: url("../css/fonts/bootstrap-icons.woff2") format("woff2");
}
```

### الخطوة 3: تحديث ملفات HTML
استبدل جميع:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
```

بـ:
```html
<link rel="stylesheet" href="css/bootstrap-icons.css">
```

### الملفات التي تحتاج تحديث:
- `index.html`
- `dashboard.html`
- `pos.html`
- `chat.html`
- `install.html`
- `repair-tracking.html`
- جميع ملفات JS التي تضيف Bootstrap Icons ديناميكياً

## الحل الحالي (مطبق)
✅ نظام `resource-checker.js` يمنع عرض الصفحة بدون تصميم
✅ يعمل تلقائياً في جميع الصفحات
✅ لا يحتاج أي إعدادات إضافية

## ملاحظات
- النظام الحالي يعمل بشكل جيد ويمنع عرض الصفحة بدون تصميم
- تحميل Bootstrap Icons محلياً اختياري لكنه يحسن الأداء والموثوقية
- Google Fonts لديها fallback تلقائي (Segoe UI, Arial, etc.)

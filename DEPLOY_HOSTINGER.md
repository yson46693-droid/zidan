# النشر على Hostinger – إصلاح 404 لـ sw.js و api/

إذا ظهرت أخطاء **404** لـ `/sw.js` أو `/api/repairs.php` بعد النشر، فغالباً الملفات تُرفع إلى مجلد غير المجلد الذي يخدمه الدومين.

## الخطوة المطلوبة

1. **الدخول إلى hPanel** (لوحة تحكم Hostinger).
2. **فتح إعدادات الدومين** (Domains → alaazidan.online أو من File Manager).
3. **معرفة "Document root"** (جذر الموقع):
   - إن كان مثلاً: `public_html` → المسار الصحيح للنشر: **`/public_html/`**
   - إن كان مثلاً: `public_html/alaazidan.online` → المسار الصحيح: **`/public_html/alaazidan.online/`**
4. **تعديل سير النشر** في الملف `.github/workflows/debloy.yml`:
   - ابحث عن السطر: `server-dir: /public_html/`
   - غيّره ليطابق الـ Document root، مثلاً:
     ```yaml
     server-dir: /public_html/alaazidan.online/
     ```
5. **حفظ الملف ثم عمل push** حتى يعيد النشر إلى المجلد الصحيح.

بعد ذلك يجب أن تتوفر:
- `sw.js` و `sw.js.php` في جذر الموقع
- مجلد `api/` وبداخله `repairs.php`

والتطبيق يحسب مسارات Service Worker و API من مجلد الصفحة الحالية، فيعمل سواء من الجذر أو من مجلد فرعي.

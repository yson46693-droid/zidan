# دليل الأداء وأفضل الممارسات - Performance Guide
## Performance & Best Practices Guide for Developers & AI Agents

---

## 📋 جدول المحتويات
1. [مقدمة](#مقدمة)
2. [قواعد إلزامية للكتابة](#قواعد-إلزامية-للكتابة)
3. [تحسينات JavaScript](#تحسينات-javascript)
4. [تحسينات CSS](#تحسينات-css)
5. [تحسينات HTML](#تحسينات-html)
6. [تحسينات PHP & API](#تحسينات-php--api)
7. [تحسينات قاعدة البيانات](#تحسينات-قاعدة-البيانات)
8. [تحسينات الشبكة والطلبات](#تحسينات-الشبكة-والطلبات)
9. [تحسينات الصور](#تحسينات-الصور)
10. [أدوات القياس والمراقبة](#أدوات-القياس-والمراقبة)
11. [Checklist قبل الالتزام](#checklist-قبل-الالتزام)

---

## 🎯 مقدمة

هذا الدليل يُعد **إلزامياً** لجميع المطورين و AI Agents الذين يعملون على هذا المشروع. الهدف هو ضمان أعلى أداء ممكن للموقع وتجربة مستخدم ممتازة.

### معايير الأداء المستهدفة:
- **First Contentful Paint (FCP)**: < 1.5 ثانية
- **Largest Contentful Paint (LCP)**: < 2.5 ثانية
- **Time to Interactive (TTI)**: < 3.5 ثانية
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Total Blocking Time (TBT)**: < 300ms
- **First Input Delay (FID)**: < 100ms

---

## ⚡ قواعد إلزامية للكتابة

### ✅ **يجب** اتباع هذه القواعد دائماً:

#### 1. **تجنب DOM Manipulation المفرط**
```javascript
// ❌ خاطئ - يعيد رسم DOM عدة مرات
for (let i = 0; i < 100; i++) {
    document.getElementById('list').innerHTML += `<div>Item ${i}</div>`;
}

// ✅ صحيح - يستخدم DocumentFragment أو يبني HTML مرة واحدة
const fragment = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    fragment.appendChild(div);
}
document.getElementById('list').appendChild(fragment);

// أو أفضل:
document.getElementById('list').innerHTML = Array.from({length: 100}, 
    (_, i) => `<div>Item ${i}</div>`
).join('');
```

#### 2. **استخدم Event Delegation**
```javascript
// ❌ خاطئ - إضافة مستمع لكل عنصر
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', handleClick);
});

// ✅ صحيح - مستمع واحد لجميع العناصر
document.addEventListener('click', (e) => {
    if (e.target.matches('.btn')) {
        handleClick(e);
    }
});
```

#### 3. **استخدم Debounce/Throttle للعمليات المكثفة**
```javascript
// ✅ صحيح - Debounce للبحث
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const searchInput = document.getElementById('search');
searchInput.addEventListener('input', debounce(handleSearch, 300));

// ✅ صحيح - Throttle للتمرير
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

window.addEventListener('scroll', throttle(handleScroll, 100));
```

#### 4. **استخدم Lazy Loading للمكونات الثقيلة**
```javascript
// ✅ صحيح - Lazy Load للمكونات
async function loadComponent(componentName) {
    if (!window.loadedComponents) window.loadedComponents = {};
    if (window.loadedComponents[componentName]) {
        return window.loadedComponents[componentName];
    }
    
    const module = await import(`./components/${componentName}.js`);
    window.loadedComponents[componentName] = module;
    return module;
}

// استخدام
document.getElementById('section').addEventListener('click', async () => {
    const { initSection } = await loadComponent('section');
    initSection();
});
```

#### 5. **استخدم Caching للبيانات والنتائج**
```javascript
// ✅ صحيح - Cache للبيانات
const dataCache = new Map();
const CACHE_DURATION = 60000; // 1 دقيقة

async function fetchDataWithCache(url) {
    const cached = dataCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }
    
    const data = await fetch(url).then(r => r.json());
    dataCache.set(url, { data, timestamp: Date.now() });
    return data;
}
```

#### 6. **تجنب Memory Leaks**
```javascript
// ❌ خاطئ - لا يزيل Event Listeners
function initComponent() {
    window.addEventListener('resize', handleResize);
}

// ✅ صحيح - يزيل Event Listeners
class Component {
    constructor() {
        this.handleResize = this.handleResize.bind(this);
    }
    
    init() {
        window.addEventListener('resize', this.handleResize);
    }
    
    destroy() {
        window.removeEventListener('resize', this.handleResize);
    }
    
    handleResize() {
        // handle resize
    }
}
```

---

## 🚀 تحسينات JavaScript

### 1. **تحميل الملفات**
```html
<!-- ✅ صحيح - استخدام defer/async -->
<script src="js/api.js" defer></script>
<script src="js/utils.js" defer></script>

<!-- ✅ صحيح - تحميل ديناميكي للـ scripts الثقيلة -->
<script>
    window.addEventListener('DOMContentLoaded', () => {
        const script = document.createElement('script');
        script.src = 'js/heavy-script.js';
        script.defer = true;
        document.body.appendChild(script);
    });
</script>
```

### 2. **تقليل حجم الملفات**
- ✅ استخدم **Minification** لجميع ملفات JS في الإنتاج
- ✅ استخدم **Tree Shaking** لإزالة الكود غير المستخدم
- ✅ استخدم **Code Splitting** لتقسيم الملفات الكبيرة
- ✅ تجنب **Deep Nesting** في الكود

### 3. **تحسين Loops**
```javascript
// ✅ صحيح - استخدم Array Methods المدمجة
const doubled = numbers.map(n => n * 2);

// ✅ صحيح - استخدم for...of للـ Arrays
for (const item of items) {
    process(item);
}

// ❌ تجنب - استخدم forEach فقط إذا كان ضرورياً
// (أبطأ من map/filter/reduce)
```

### 4. **استخدام Web Workers للعمليات الثقيلة**
```javascript
// ✅ صحيح - استخدام Web Worker
const worker = new Worker('worker.js');
worker.postMessage({ data: largeData });
worker.onmessage = (e) => {
    const result = e.data;
    // معالجة النتيجة
};
```

### 5. **تحسين Selectors**
```javascript
// ❌ خاطئ - بطيء
document.querySelectorAll('div .class');

// ✅ صحيح - أسرع
document.querySelectorAll('.class');
// أو استخدم getElementById/getElementsByClassName
```

---

## 🎨 تحسينات CSS

### 1. **CSS Minification**
```bash
# استخدم أدوات مثل cssnano أو clean-css
```

### 2. **Critical CSS**
```html
<!-- ✅ صحيح - Critical CSS في الـ head -->
<style>
    /* CSS الحرج فقط */
    body { margin: 0; }
    .header { height: 60px; }
</style>

<!-- CSS غير الحرج يتم تحميله لاحقاً -->
<link rel="stylesheet" href="css/non-critical.css" media="print" onload="this.media='all'">
```

### 3. **تجنب Deep Selectors**
```css
/* ❌ خاطئ - بطيء */
div > div > div > div > .class { }

/* ✅ صحيح - أسرع */
.class { }
```

### 4. **استخدام CSS Variables**
```css
/* ✅ صحيح - CSS Variables */
:root {
    --primary-color: #2196F3;
    --spacing: 1rem;
}

.button {
    background: var(--primary-color);
    padding: var(--spacing);
}
```

### 5. **تجنب Animations المكثفة**
```css
/* ✅ صحيح - استخدم transform و opacity */
.element {
    transform: translateX(100px);
    opacity: 0.5;
    transition: transform 0.3s, opacity 0.3s;
}

/* ❌ تجنب - استخدم position changes (بطيء) */
.element {
    left: 100px;
    transition: left 0.3s;
}
```

---

## 📄 تحسينات HTML

### 1. **تقليل HTML Size**
- ✅ أزل **Whitespace** غير الضروري في الإنتاج
- ✅ استخدم **Semantic HTML**
- ✅ تجنب **Nested Divs** غير الضرورية

### 2. **Lazy Loading للصور**
```html
<!-- ✅ صحيح - Lazy Loading -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- ✅ صحيح - Responsive Images -->
<img srcset="image-small.jpg 480w, image-large.jpg 800w"
     sizes="(max-width: 600px) 480px, 800px"
     src="image.jpg" alt="Description">
```

### 3. **Preload للموارد المهمة**
```html
<!-- ✅ صحيح - Preload -->
<link rel="preload" href="fonts/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="js/critical.js" as="script">
```

### 4. **DNS Prefetch**
```html
<!-- ✅ صحيح - DNS Prefetch -->
<link rel="dns-prefetch" href="//cdn.example.com">
```

---

## 🔧 تحسينات PHP & API

### 1. **استخدام Prepared Statements**
```php
// ✅ صحيح - Prepared Statements (موجود حالياً)
$stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
```

### 2. **Response Caching**
```php
// ✅ صحيح - Cache Headers
header('Cache-Control: public, max-age=3600');
header('ETag: ' . md5($content));
```

### 3. **تقليل Database Queries**
```php
// ❌ خاطئ - Multiple Queries
foreach ($ids as $id) {
    $user = dbSelectOne("SELECT * FROM users WHERE id = ?", [$id]);
}

// ✅ صحيح - Single Query
$idsString = implode(',', array_map('intval', $ids));
$users = dbSelect("SELECT * FROM users WHERE id IN ($idsString)");
```

### 4. **JSON Response Optimization**
```php
// ✅ صحيح - Minimal JSON Response
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'data' => $data
], JSON_UNESCAPED_UNICODE);
```

### 5. **Error Handling**
```php
// ✅ صحيح - Error Logging بدون تعطيل الأداء
try {
    // code
} catch (Exception $e) {
    error_log('Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal error']);
}
```

---

## 🗄️ تحسينات قاعدة البيانات

### 1. **استخدام Indexes**
```sql
-- ✅ صحيح - إضافة Indexes
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_repair_date ON repairs(created_at);
```

### 2. **تجنب SELECT ***
```sql
-- ❌ خاطئ
SELECT * FROM users;

-- ✅ صحيح
SELECT id, name, email FROM users;
```

### 3. **استخدام LIMIT**
```sql
-- ✅ صحيح - Limit النتائج
SELECT * FROM repairs ORDER BY created_at DESC LIMIT 50;
```

### 4. **Query Optimization**
```sql
-- ❌ خاطئ - Subquery في WHERE
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);

-- ✅ صحيح - JOIN
SELECT u.* FROM users u
INNER JOIN orders o ON u.id = o.user_id
GROUP BY u.id;
```

---

## 🌐 تحسينات الشبكة والطلبات

### 1. **Request Debouncing**
```javascript
// ✅ موجود في auth.js - يجب تطبيقه في جميع الأماكن
const CHECK_LOGIN_COOLDOWN = 1000;
```

### 2. **Request Caching**
```javascript
// ✅ صحيح - Cache API Responses
const responseCache = new Map();
const CACHE_DURATION = 60000;

async function apiCall(url, options = {}) {
    const cacheKey = `${url}:${JSON.stringify(options)}`;
    const cached = responseCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    responseCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}
```

### 3. **Batch Requests**
```javascript
// ❌ خاطئ - Multiple Requests
for (const id of ids) {
    await fetch(`/api/item/${id}`);
}

// ✅ صحيح - Single Batch Request
await fetch('/api/items', {
    method: 'POST',
    body: JSON.stringify({ ids })
});
```

### 4. **Request Prioritization**
```javascript
// ✅ صحيح - Critical Requests First
async function loadPage() {
    const critical = await Promise.all([
        fetch('/api/user'),
        fetch('/api/settings')
    ]);
    
    // Non-critical بعد ذلك
    setTimeout(() => {
        fetch('/api/analytics');
    }, 1000);
}
```

---

## 🖼️ تحسينات الصور

### 1. **Image Optimization**
- ✅ استخدم **WebP** format
- ✅ استخدم **Compression** (TinyPNG, ImageOptim)
- ✅ استخدم **Responsive Images**
- ✅ استخدم **Lazy Loading**

### 2. **Image Sizing**
```html
<!-- ✅ صحيح - Correct Image Dimensions -->
<img src="image.jpg" width="800" height="600" alt="Description">
```

### 3. **Background Images**
```css
/* ✅ صحيح - Optimize Background Images */
.header {
    background-image: url('image.webp');
    background-size: cover;
    background-position: center;
}
```

---

## 📊 أدوات القياس والمراقبة

### 1. **Performance API**
```javascript
// ✅ صحيح - Measure Performance
performance.mark('start');
// ... code ...
performance.mark('end');
performance.measure('duration', 'start', 'end');
const duration = performance.getEntriesByName('duration')[0].duration;
console.log(`Duration: ${duration}ms`);
```

### 2. **Lighthouse CI**
```bash
# يجب تشغيل Lighthouse قبل كل commit
npm install -g @lhci/cli
lhci autorun
```

### 3. **Chrome DevTools**
- ✅ استخدم **Performance Tab** لقياس الأداء
- ✅ استخدم **Memory Tab** لكشف Memory Leaks
- ✅ استخدم **Network Tab** لتحليل الطلبات

---

## ✅ Checklist قبل الالتزام

### قبل كل Commit، تأكد من:

#### JavaScript:
- [ ] لا توجد **console.log** في الكود الإنتاجي
- [ ] تم تطبيق **Debounce/Throttle** على Event Handlers المكثفة
- [ ] تم إزالة **Event Listeners** عند destroy
- [ ] لا توجد **Memory Leaks** محتملة
- [ ] تم استخدام **Caching** للبيانات المتكررة
- [ ] تم تحسين **Loops** والـ Selectors
- [ ] تم استخدام **Lazy Loading** للمكونات الثقيلة

#### CSS:
- [ ] تم **Minify** ملفات CSS
- [ ] لا توجد **Deep Selectors** غير ضرورية
- [ ] تم تحسين **Animations** (استخدام transform/opacity)
- [ ] تم وضع **Critical CSS** في الـ head

#### HTML:
- [ ] تم **Minify** HTML في الإنتاج
- [ ] تم إضافة **loading="lazy"** للصور
- [ ] تم استخدام **Semantic HTML**
- [ ] تم إضافة **Preload** للموارد المهمة

#### PHP/API:
- [ ] تم استخدام **Prepared Statements**
- [ ] تم إضافة **Cache Headers** المناسبة
- [ ] تم تقليل **Database Queries** (Batch Queries)
- [ ] تم تحسين **JSON Responses**

#### Database:
- [ ] تم إضافة **Indexes** للـ columns المستخدمة في WHERE/JOIN
- [ ] تم تجنب **SELECT ***
- [ ] تم استخدام **LIMIT** للنتائج الكبيرة

#### Network:
- [ ] تم تطبيق **Request Debouncing**
- [ ] تم إضافة **Response Caching**
- [ ] تم **Batch** الطلبات المتعددة

#### Testing:
- [ ] تم اختبار **Lighthouse Score** (> 90)
- [ ] تم اختبار **Mobile Performance**
- [ ] تم اختبار **Network Throttling** (3G)
- [ ] تم اختبار **Memory Usage**

---

## 🔍 أدوات التحقق التلقائي

### يجب إضافة هذه الأدوات:

```json
// package.json
{
  "scripts": {
    "perf:lighthouse": "lhci autorun",
    "perf:analyze": "webpack-bundle-analyzer",
    "perf:check": "npm run perf:lighthouse && npm run perf:analyze"
  },
  "devDependencies": {
    "@lhci/cli": "^0.12.0",
    "webpack-bundle-analyzer": "^4.8.0"
  }
}
```

---

## 📝 ملاحظات إضافية

### 1. **Service Worker**
- ✅ تم تطبيقه بالفعل في `sw.js`
- ✅ يجب تحديث `APP_VERSION` عند كل تغيير

### 2. **Caching Strategy**
- ✅ **Cache First** للملفات الثابتة
- ✅ **Network First** لـ API calls

### 3. **Code Splitting**
```javascript
// ✅ يجب تقسيم الملفات الكبيرة
// inventory.js (2926 lines) - يجب تقسيمه إلى:
// - inventory-phones.js
// - inventory-parts.js
// - inventory-accessories.js
```

---

## 🎓 Resources

- [Web.dev Performance](https://web.dev/performance/)
- [MDN Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Lighthouse Scoring](https://web.dev/performance-scoring/)

---

## ⚠️ **تحذير مهم**

**كل AI Agent أو Developer يجب أن:**
1. ✅ يقرأ هذا الدليل **قبل** كتابة أي كود
2. ✅ يتبع جميع القواعد المذكورة أعلاه
3. ✅ يفحص الكود باستخدام Checklist قبل الالتزام
4. ✅ يقوم بتشغيل Lighthouse وضمان Score > 90

**عدم الالتزام بهذه القواعد سيؤدي إلى:**
- ❌ رفض Pull Requests
- ❌ طلب إعادة كتابة الكود
- ❌ مشاكل في الأداء تؤثر على تجربة المستخدم

---

**آخر تحديث:** {{ current_date }}
**الإصدار:** 1.0.0

// دوال مساعدة

/**
 * الحصول على المسار الأساسي للتطبيق (يعمل مع المجلدات الفرعية)
 * @returns {string} المسار الأساسي (مثل: '' أو '/z')
 */
function getBasePath() {
    try {
        // استخدام window.location.pathname لتحديد المسار الحالي
        const pathname = window.location.pathname;
        
        // إذا كان المسار يحتوي على index.html أو dashboard.html أو أي ملف HTML
        const match = pathname.match(/^(\/[^\/]+)/);
        if (match && match[1] !== '/') {
            // إذا كان هناك مجلد فرعي (مثل /z/index.html)
            return match[1];
        }
        
        // إذا كان الملف في الجذر (مثل /index.html)
        return '';
    } catch (e) {
        console.error('خطأ في تحديد المسار الأساسي:', e);
        return '';
    }
}

/**
 * الحصول على مسار Service Worker
 * @returns {string} مسار sw.js
 */
function getServiceWorkerPath() {
    const basePath = getBasePath();
    return basePath ? `${basePath}/sw.js` : '/sw.js';
}

/**
 * التحقق من صلاحيات تعديل المخزون
 * @returns {boolean}
 */
function canEditInventory() {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) {
            return false;
        }
        
        const user = JSON.parse(userStr);
        if (!user || typeof user !== 'object') {
            return false;
        }
        
        // ✅ فقط المالك والمدير يمكنهم التعديل
        return user.role === 'admin' || user.role === 'manager';
    } catch (e) {
        console.error('خطأ في التحقق من صلاحيات المخزون:', e);
        return false;
    }
}

// التحقق من إمكانية طلب قطع الغيار (فقط لفرع البيطاش)
function canRequestInventoryItem() {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) {
            return false;
        }
        
        const user = JSON.parse(userStr);
        if (!user || typeof user !== 'object') {
            return false;
        }
        
        const branchCode = user.branch_code || localStorage.getItem('branch_code');
        
        // المالك له كامل الصلاحيات (يرى جميع الأزرار)
        if (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true') {
            return false; // المالك لا يحتاج زر الطلب لأنه يرى أزرار التعديل
        }
        
        // فقط فرع البيطاش يمكنه طلب قطع الغيار
        return branchCode === 'BITASH';
    } catch (e) {
        console.error('خطأ في التحقق من صلاحيات طلب قطع الغيار:', e);
        return false;
    }
}

// عرض رسالة
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// تنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Africa/Cairo'
    });
}

// تنسيق التاريخ والوقت
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Cairo'
    });
}

// تنسيق المبلغ
function formatCurrency(amount) {
    return parseFloat(amount).toFixed(2) + ' ج.م';
}

// الحصول على تاريخ اليوم
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// التحقق من صحة النموذج
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = '#f44336';
            isValid = false;
        } else {
            input.style.borderColor = '#ddd';
        }
    });
    
    return isValid;
}

// تنظيف النموذج
function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.style.borderColor = '#ddd';
        });
    }
}

// نافذة التأكيد
function confirmAction(message) {
    return confirm(message);
}

// دالة debounce لتأخير تنفيذ الدالة
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

// الحصول على الحالة بالعربية
function getStatusText(status) {
    const statuses = {
        'received': 'تم الاستلام',
        'under_inspection': 'قيد الفحص',
        'awaiting_customer_approval': 'بانتظار موافقة العميل',
        'customer_approved': 'تم الحصول علي الموافقه',
        'in_progress': 'قيد الإصلاح',
        'ready_for_delivery': 'جاهز للتسليم',
        'delivered': 'تم التسليم',
        'cancelled': 'عملية ملغية',
        'lost': 'عملية خاسرة',
        // دعم الحالات القديمة للتوافق
        'pending': 'تم الاستلام', // تم الاستلام
        'ready': 'جاهز للتسليم' // جاهز للتسليم
    };
    return statuses[status] || status;
}

// الحصول لون الحالة
function getStatusColor(status) {
    const colors = {
        'received': '#2196F3', // primary-color
        'under_inspection': '#FFA500', // warning-color
        'awaiting_customer_approval': '#FFA500', // warning-color
        'customer_approved': '#4CAF50', // success-color
        'in_progress': '#2196F3', // primary-color
        'ready_for_delivery': '#4CAF50', // success-color
        'delivered': '#4CAF50', // success-color
        'cancelled': '#f44336', // danger-color
        'lost': '#f44336', // danger-color
        // دعم الحالات القديمة للتوافق
        'pending': '#2196F3', // تم الاستلام
        'ready': '#4CAF50' // جاهز للتسليم
    };
    return colors[status] || '#999';
}

// الحصول على الدور بالعربية
function getRoleText(role) {
    const roles = {
        'admin': 'مالك',
        'manager': 'مدير',
        'technician': 'فني صيانة',
        'employee': 'موظف'
    };
    return roles[role] || role;
}

// البحث في جدول
function searchTable(searchInputId, tableId, columns = []) {
    const searchInput = document.getElementById(searchInputId);
    const table = document.getElementById(tableId);
    
    if (!searchInput || !table) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            let found = false;
            const cells = row.querySelectorAll('td');
            
            if (columns.length === 0) {
                // البحث في جميع الأعمدة
                cells.forEach(cell => {
                    if (cell.textContent.toLowerCase().includes(searchTerm)) {
                        found = true;
                    }
                });
            } else {
                // البحث في أعمدة محددة
                columns.forEach(colIndex => {
                    if (cells[colIndex] && cells[colIndex].textContent.toLowerCase().includes(searchTerm)) {
                        found = true;
                    }
                });
            }
            
            row.style.display = found ? '' : 'none';
        });
    });
}

// فلترة حسب التاريخ
function filterByDateRange(startDateId, endDateId, data, dateField) {
    const startDate = document.getElementById(startDateId)?.value;
    const endDate = document.getElementById(endDateId)?.value;
    
    if (!startDate && !endDate) return data;
    
    return data.filter(item => {
        const itemDate = item[dateField]?.split(' ')[0]; // الحصول على التاريخ فقط
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
    });
}

// طباعة صفحة
function printPage() {
    window.print();
}

// تصدير إلى JSON
function exportToJSON(data, filename) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// إغلاق النافذة المنبثقة عند النقر خارجها
function setupModalCloseOnClickOutside() {
    document.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// استيراد من JSON
function importFromJSON(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                callback(data);
            } catch (error) {
                showMessage('خطأ في قراءة الملف', 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// تبديل الوضع الليلي
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode', isDark);
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    return isDark;
}

// تحميل الوضع الليلي
function loadDarkMode() {
    try {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled') {
            document.documentElement.classList.add('dark-mode');
            if (document.body) {
                document.body.classList.add('dark-mode');
            }
        } else {
            document.documentElement.classList.remove('dark-mode');
            if (document.body) {
                document.body.classList.remove('dark-mode');
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل الوضع الليلي:', error);
    }
}

// Pagination
function paginate(data, page = 1, itemsPerPage = 10) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
        data: data.slice(startIndex, endIndex),
        currentPage: page,
        totalPages: Math.ceil(data.length / itemsPerPage),
        totalItems: data.length
    };
}

// إنشاء أزرار Pagination
function createPaginationButtons(container, totalPages, currentPage, onPageChange) {
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // زر السابق
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'السابق';
        prevBtn.className = 'btn-pagination';
        prevBtn.onclick = () => onPageChange(currentPage - 1);
        container.appendChild(prevBtn);
    }
    
    // أرقام الصفحات
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = `btn-pagination ${i === currentPage ? 'active' : ''}`;
            pageBtn.onclick = () => onPageChange(i);
            container.appendChild(pageBtn);
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-dots';
            container.appendChild(dots);
        }
    }
    
    // زر التالي
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'التالي';
        nextBtn.className = 'btn-pagination';
        nextBtn.onclick = () => onPageChange(currentPage + 1);
        container.appendChild(nextBtn);
    }
}

// تخزين الشعار الافتراضي في localStorage
const DEFAULT_LOGO_KEY = 'default_logo_cached';
const DEFAULT_LOGO_VERSION_KEY = 'default_logo_version';
const DEFAULT_LOGO_PATH = 'vertopal.com_photo_5922357566287580087_y.png';
const LOGO_VERSION = '1.0'; // زيادة هذا الرقم لإجبار تحديث الكاش

/**
 * تحميل الشعار الافتراضي من localStorage أو من الملف
 * @returns {Promise<string>} Base64 data URL للشعار
 */
async function getCachedDefaultLogo() {
    try {
        // التحقق من وجود نسخة محفوظة في localStorage
        const cachedLogo = localStorage.getItem(DEFAULT_LOGO_KEY);
        const cachedVersion = localStorage.getItem(DEFAULT_LOGO_VERSION_KEY);
        
        // إذا كان موجوداً وبنفس الإصدار، نرجعه مباشرة
        if (cachedLogo && cachedVersion === LOGO_VERSION) {
            console.log('✅ استخدام الشعار من الكاش المحلي');
            return cachedLogo;
        }
        
        // تحميل الصورة وتحويلها إلى base64
        console.log('📥 تحميل الشعار الافتراضي...');
        const logoDataUrl = await loadImageAsDataUrl(DEFAULT_LOGO_PATH);
        
        // حفظ في localStorage
        try {
            localStorage.setItem(DEFAULT_LOGO_KEY, logoDataUrl);
            localStorage.setItem(DEFAULT_LOGO_VERSION_KEY, LOGO_VERSION);
            console.log('✅ تم حفظ الشعار في الكاش المحلي');
        } catch (e) {
            // في حالة امتلاء localStorage، نتجاهل الخطأ ونستخدم البيانات مباشرة
            console.warn('⚠️ لا يمكن حفظ الشعار في localStorage (قد يكون ممتلئاً)، سيتم استخدامه مباشرة');
        }
        
        return logoDataUrl;
    } catch (error) {
        console.error('❌ خطأ في تحميل الشعار الافتراضي:', error);
        // إرجاع مسار الصورة الأصلي كبديل
        return DEFAULT_LOGO_PATH;
    }
}

/**
 * تحميل صورة وتحويلها إلى base64 data URL
 * @param {string} imagePath - مسار الصورة
 * @returns {Promise<string>} Base64 data URL
 */
function loadImageAsDataUrl(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // لا حاجة لـ crossOrigin للصور المحلية
        
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // تحويل إلى base64
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (error) {
                console.error('خطأ في تحويل الصورة إلى base64:', error);
                // في حالة الفشل (مثل مشكلة CORS)، نرجع المسار الأصلي
                resolve(imagePath);
            }
        };
        
        img.onerror = function() {
            console.warn('فشل تحميل الصورة:', imagePath);
            // في حالة الفشل، نرجع المسار الأصلي
            resolve(imagePath);
        };
        
        // محاولة تحميل الصورة
        img.src = imagePath + '?v=' + LOGO_VERSION; // إضافة version للتحايل على الكاش
    });
}

/**
 * تحديث الشعار في عنصر img باستخدام الكاش المحلي
 * @param {HTMLImageElement|string} imgElement - عنصر img أو selector
 */
async function setCachedLogo(imgElement) {
    const img = typeof imgElement === 'string' ? document.querySelector(imgElement) : imgElement;
    if (!img) {
        console.warn('عنصر الصورة غير موجود');
        return;
    }
    
    try {
        const logoUrl = await getCachedDefaultLogo();
        img.src = logoUrl;
        img.onerror = function() {
            // في حالة الفشل، استخدام المسار الأصلي
            console.warn('فشل تحميل الشعار من الكاش، استخدام المسار الأصلي');
            img.src = DEFAULT_LOGO_PATH;
        };
    } catch (error) {
        console.error('خطأ في تعيين الشعار:', error);
        img.src = DEFAULT_LOGO_PATH;
    }
}

/**
 * عرض نافذة إدخال مخصصة (بديل لـ prompt)
 * @param {string} message - الرسالة المراد عرضها
 * @param {string} defaultValue - القيمة الافتراضية
 * @param {string} inputType - نوع الإدخال (text, number, etc.)
 * @returns {Promise<string|null>} قيمة الإدخال أو null إذا تم الإلغاء
 */
function showInputPrompt(message, defaultValue = '', inputType = 'text') {
    return new Promise((resolve) => {
        try {
            // إنشاء modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '20000';
            modal.setAttribute('id', 'inputPromptModal');
            
            modal.innerHTML = `
                <div class="modal-content modal-sm" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>إدخال البيانات</h3>
                        <button class="btn-close" onclick="this.closest('.modal').remove(); window.inputPromptResolve(null);">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 10px; color: var(--text-dark); font-weight: 500;">
                                ${message}
                            </label>
                            <input 
                                type="${inputType}" 
                                id="inputPromptInput" 
                                value="${defaultValue.replace(/"/g, '&quot;')}" 
                                class="form-control"
                                style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; font-size: 16px;"
                                autofocus
                            />
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid var(--border-color);">
                        <button 
                            type="button" 
                            class="btn btn-secondary" 
                            onclick="this.closest('.modal').remove(); window.inputPromptResolve(null);"
                            style="padding: 10px 20px; background: var(--secondary-color); color: var(--white); border: none; border-radius: 5px; cursor: pointer;"
                        >
                            إلغاء
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-primary" 
                            onclick="handleInputPromptSubmit()"
                            style="padding: 10px 20px; background: var(--primary-color); color: var(--white); border: none; border-radius: 5px; cursor: pointer;"
                        >
                            تأكيد
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // حفظ resolve function في window
            window.inputPromptResolve = resolve;
            
            // دالة submit
            window.handleInputPromptSubmit = function() {
                try {
                    const input = document.getElementById('inputPromptInput');
                    if (!input) {
                        window.inputPromptResolve(null);
                        return;
                    }
                    
                    const value = input.value.trim();
                    const modal = document.getElementById('inputPromptModal');
                    if (modal) {
                        modal.remove();
                    }
                    
                    // تنظيف
                    delete window.inputPromptResolve;
                    delete window.handleInputPromptSubmit;
                    
                    resolve(value || null);
                } catch (error) {
                    console.error('خطأ في معالجة الإدخال:', error);
                    resolve(null);
                }
            };
            
            // إغلاق عند النقر خارج الـ modal
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.remove();
                    if (window.inputPromptResolve) {
                        window.inputPromptResolve(null);
                        delete window.inputPromptResolve;
                        delete window.handleInputPromptSubmit;
                    }
                }
            });
            
            // إرسال عند الضغط على Enter
            const input = document.getElementById('inputPromptInput');
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (window.handleInputPromptSubmit) {
                            window.handleInputPromptSubmit();
                        }
                    }
                });
                
                // التركيز على الإدخال
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 100);
            }
            
        } catch (error) {
            console.error('خطأ في إنشاء نافذة الإدخال:', error);
            resolve(null);
        }
    });
}

/**
 * ✅ دالة عامة لإصلاح CSS و Bootstrap Icons عند التحميل أو التنقل
 * تستخدم عند:
 * - التوجيه بعد تسجيل الدخول
 * - عمل refresh لأي صفحة
 * - الرجوع من صفحة خارجية
 */
function ensureCSSAndIconsLoaded() {
    console.log('🔧 [CSS Fix] بدء ensureCSSAndIconsLoaded...');
    try {
        const styleSheets = [
            { href: 'css/style.css', id: 'main-style' },
            { href: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css', id: 'bootstrap-icons' }
        ];
        
        let fixedCount = 0;
        let addedCount = 0;
        
        styleSheets.forEach(({ href, id }) => {
            // البحث عن الـ stylesheet (قد يكون href كاملاً أو جزئياً أو مع query parameters)
            const fileName = href.split('/').pop().split('?')[0]; // اسم الملف بدون query params
            const existingLink = document.querySelector(`link[href*="${fileName}"]`);
            
            if (existingLink) {
                // التحقق من أن الـ stylesheet محمّل فعلياً
                try {
                    // ✅ إصلاح: التحقق من media="print" أولاً وتغييره
                    if (existingLink.media === 'print' || existingLink.getAttribute('media') === 'print') {
                        existingLink.media = 'all';
                        fixedCount++;
                        console.log(`✅ [CSS Fix] تم تغيير media من print إلى all لـ ${fileName}`);
                    }
                    
                    // ✅ التحقق من أن الـ stylesheet محمّل فعلياً
                    const isLoaded = existingLink.sheet !== null || 
                                    (existingLink.href && existingLink.href.length > 0);
                    
                    if (!isLoaded) {
                        console.log(`🔄 [CSS Fix] ${fileName} غير محمّل - إعادة تحميل...`);
                        // إزالة الـ link القديم
                        const parent = existingLink.parentNode;
                        existingLink.remove();
                        
                        // إنشاء link جديد مع cache busting
                        const newLink = document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = href + (href.includes('?') ? '&' : '?') + '_cssfix=' + Date.now();
                        newLink.media = 'all';
                        if (id) newLink.id = id;
                        if (href.includes('bootstrap-icons')) {
                            newLink.crossOrigin = 'anonymous';
                        }
                        
                        // ✅ إضافة event listeners للتأكد من التحميل
                        newLink.onload = () => {
                            console.log(`✅ [CSS Fix] تم تحميل ${fileName} بنجاح`);
                            // إزالة cache busting parameter بعد التحميل
                            if (newLink.href.includes('_cssfix=')) {
                                newLink.href = href;
                            }
                        };
                        newLink.onerror = () => {
                            console.warn(`⚠️ [CSS Fix] فشل تحميل ${fileName} - محاولة بدون cache busting`);
                            newLink.href = href;
                        };
                        
                        if (parent) {
                            parent.appendChild(newLink);
                        } else {
                            document.head.appendChild(newLink);
                        }
                        addedCount++;
                        console.log(`✅ [CSS Fix] تم إضافة ${fileName} بنجاح`);
                    } else {
                        // التأكد من أن media = "all" (حتى لو كان محمّل)
                        if (existingLink.media === 'print' || existingLink.getAttribute('media') === 'print') {
                            existingLink.media = 'all';
                            fixedCount++;
                            console.log(`✅ [CSS Fix] تم تغيير media من print إلى all لـ ${fileName} (كان محمّل)`);
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ [CSS Fix] خطأ في التحقق من ${fileName}:`, e);
                }
            } else {
                // إذا لم يكن موجوداً، إضافته
                console.log(`➕ [CSS Fix] ${fileName} غير موجود - إضافة...`);
                const newLink = document.createElement('link');
                newLink.rel = 'stylesheet';
                newLink.href = href;
                newLink.media = 'all';
                if (id) newLink.id = id;
                if (href.includes('bootstrap-icons')) {
                    newLink.crossOrigin = 'anonymous';
                }
                
                // ✅ إضافة event listeners للتأكد من التحميل
                newLink.onload = () => {
                    console.log(`✅ [CSS Fix] تم تحميل ${fileName} بنجاح`);
                };
                newLink.onerror = () => {
                    console.warn(`⚠️ [CSS Fix] فشل تحميل ${fileName}`);
                };
                
                document.head.appendChild(newLink);
                addedCount++;
                console.log(`✅ [CSS Fix] تم إضافة ${fileName} بنجاح`);
            }
        });
        
        // ✅ إصلاح إضافي: تغيير جميع stylesheets من media="print" إلى "all"
        const fixAllPrintMedia = () => {
            const allStyleSheets = document.querySelectorAll('link[rel="stylesheet"]');
            let fixedCount = 0;
            allStyleSheets.forEach(link => {
                if (link.media === 'print' || link.getAttribute('media') === 'print') {
                    link.media = 'all';
                    fixedCount++;
                    console.log(`✅ [CSS Fix] تم تغيير media من print إلى all لـ ${link.href.split('/').pop()}`);
                }
            });
            if (fixedCount > 0) {
                console.log(`✅ [CSS Fix] تم إصلاح ${fixedCount} stylesheet(s)`);
            }
        };
        
        fixAllPrintMedia();
        
        // التأكد من أن CSS محمّل بعد قليل
        setTimeout(() => {
            // إضافة class css-loaded إذا لم يكن موجوداً
            if (!document.documentElement.classList.contains('css-loaded')) {
                document.documentElement.classList.add('css-loaded');
            }
            if (!document.body.classList.contains('css-loaded')) {
                document.body.classList.add('css-loaded');
            }
        }, 100);
        
        // ✅ إصلاح إضافي: إعادة التحقق بعد قليل للتأكد من التطبيق
        setTimeout(() => {
            // التحقق مرة أخرى من media="print"
            const allStyleSheets = document.querySelectorAll('link[rel="stylesheet"]');
            let recheckFixed = 0;
            allStyleSheets.forEach(link => {
                if (link.media === 'print' || link.getAttribute('media') === 'print') {
                    link.media = 'all';
                    recheckFixed++;
                }
            });
            if (recheckFixed > 0) {
                console.log(`✅ [CSS Fix] إصلاح إضافي: تم تغيير ${recheckFixed} stylesheet(s) من print إلى all`);
            }
        }, 300);
        
        console.log(`✅ [CSS Fix] انتهى ensureCSSAndIconsLoaded - تم إصلاح ${fixedCount} ملف، تمت إضافة ${addedCount} ملف`);
    } catch (error) {
        console.error('❌ [CSS Fix] خطأ في ensureCSSAndIconsLoaded:', error);
    }
}

// ✅ تصدير الدوال إلى window للاستخدام العام
if (typeof window !== 'undefined') {
    window.showMessage = showMessage;
    window.getBasePath = getBasePath;
    window.formatCurrency = formatCurrency;
    window.formatDate = formatDate;
    window.formatDateTime = formatDateTime;
    window.getTodayDate = getTodayDate;
    window.showInputPrompt = showInputPrompt;
    window.ensureCSSAndIconsLoaded = ensureCSSAndIconsLoaded; // ✅ تصدير الدالة الجديدة
    // تصدير debounce فقط إذا كان موجوداً
    if (typeof debounce !== 'undefined') {
        window.debounce = debounce;
    }
}


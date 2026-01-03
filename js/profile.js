// إدارة الملف الشخصي

let currentUser = null;
let userCredentials = [];

// دالة مساعدة لتنظيف النصوص من HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// تحميل قسم الملف الشخصي
// تحميل webauthn.js إذا لم يكن محمّلاً
async function ensureWebAuthnLoaded() {
    if (typeof simpleWebAuthn !== 'undefined') {
        return Promise.resolve();
    }
    
    // إذا كان هناك دالة loadScriptOnDemand، استخدمها
    if (typeof window.loadScriptOnDemand === 'function') {
        try {
            await window.loadScriptOnDemand('webauthn-script');
            // انتظار تحميل الملف (بحد أقصى 5 ثوان)
            const maxAttempts = 50;
            let attempts = 0;
            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof simpleWebAuthn !== 'undefined') {
                        clearInterval(checkInterval);
                        console.log('✅ WebAuthn script loaded successfully');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.error('❌ Failed to load WebAuthn script after ' + (maxAttempts * 100) + 'ms');
                        reject(new Error('فشل تحميل نظام البصمة'));
                    }
                }, 100);
            });
        } catch (error) {
            console.error('❌ Error loading WebAuthn script:', error);
            throw error;
        }
    } else {
        // إذا لم تكن هناك دالة loadScriptOnDemand، حمّل الملف مباشرة
        return new Promise((resolve, reject) => {
            if (typeof simpleWebAuthn !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'webauthn/webauthn.js';
            script.async = true;
            script.onload = () => {
                // انتظار تحميل الملف (بحد أقصى 3 ثوان)
                const maxAttempts = 30;
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof simpleWebAuthn !== 'undefined') {
                        clearInterval(checkInterval);
                        console.log('✅ WebAuthn script loaded successfully');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        reject(new Error('فشل تحميل نظام البصمة'));
                    }
                }, 100);
            };
            script.onerror = () => {
                reject(new Error('فشل تحميل ملف webauthn.js'));
            };
            document.body.appendChild(script);
        });
    }
}

async function loadProfileSection() {
    const section = document.getElementById('profile-content');
    if (!section) {
        console.error('profile-content not found');
        return;
    }

    try {
        // عرض حالة التحميل
        section.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-light);"><i class="bi bi-hourglass-split"></i> جاري التحميل...</p>';

        // التحقق من وجود الدوال المطلوبة مع retry mechanism
        let retries = 0;
        const maxRetries = 3;
        
        while (typeof getCurrentUser !== 'function' && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 200));
            retries++;
        }
        
        if (typeof getCurrentUser !== 'function') {
            throw new Error('دالة getCurrentUser غير متوفرة. تأكد من تحميل auth.js');
        }

        if (typeof getRoleText !== 'function') {
            console.warn('دالة getRoleText غير متوفرة، سيتم استخدام قيمة افتراضية');
            window.getRoleText = window.getRoleText || function(role) {
                const roles = {
                    'admin': 'مالك',
                    'manager': 'مدير',
                    'employee': 'موظف'
                };
                return roles[role] || role;
            };
        }

        // الحصول على بيانات المستخدم الحالي مع معالجة أفضل للأخطاء
        // أولاً: محاولة جلب البيانات من profile API للحصول على أحدث البيانات (بما في ذلك avatar و branch_name)
        try {
            if (typeof API !== 'undefined' && typeof API.getProfile === 'function') {
                const profileResult = await API.getProfile();
                if (profileResult && profileResult.success && profileResult.data) {
                    currentUser = profileResult.data;
                    // حفظ البيانات المحدثة في localStorage
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            }
        } catch (e) {
            console.warn('فشل الحصول على المستخدم من profile API:', e);
        }
        
        // إذا فشل جلب البيانات من profile API، محاولة من checkLogin
        if (!currentUser) {
            try {
                if (typeof checkLogin === 'function') {
                    const user = await checkLogin();
                    if (user) {
                        currentUser = user;
                        // حفظ البيانات المحدثة في localStorage
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                }
            } catch (e) {
                console.warn('فشل الحصول على المستخدم من checkLogin:', e);
            }
        }
        
        // إذا فشل جلب البيانات من API، محاولة من localStorage
        if (!currentUser) {
            try {
                currentUser = getCurrentUser();
            } catch (error) {
                console.error('خطأ في getCurrentUser:', error);
                currentUser = null;
            }
        }

        if (!currentUser) {
            section.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                    <i class="bi bi-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>خطأ في تحميل الملف الشخصي</p>
                    <p style="font-size: 14px; color: var(--text-light); margin-top: 10px;">يرجى تسجيل الدخول مرة أخرى أو إعادة تحميل الصفحة</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                        <button onclick="if(typeof loadProfileSection === 'function') loadProfileSection(); else location.reload();" class="btn btn-primary">
                            <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                        </button>
                        <button onclick="location.href='index.html'" class="btn btn-secondary">
                            <i class="bi bi-box-arrow-in-right"></i> تسجيل الدخول
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // تحميل webauthn.js قبل الاستخدام
        try {
            await ensureWebAuthnLoaded();
        } catch (error) {
            console.warn('⚠️ Failed to load WebAuthn:', error);
            // نستمر في التحميل حتى لو فشل تحميل WebAuthn
        }

        // تحميل البصمات المسجلة
        await loadCredentials();
        console.log('🔍 بعد تحميل البصمات - عدد البصمات:', userCredentials.length);
        
        // جلب تقييم الفني إذا كان المستخدم فني
        let technicianRating = null;
        if (currentUser.role === 'technician') {
            try {
                const ratingResult = await API.request('profile.php?action=get_technician_rating', 'GET');
                if (ratingResult && ratingResult.success && ratingResult.data) {
                    technicianRating = ratingResult.data;
                }
            } catch (error) {
                console.warn('⚠️ فشل جلب تقييم الفني:', error);
            }
        }

        // جلب بيانات المستحقات للمستخدم الحالي (للموظفين والمديرين والفنيين فقط)
        // ✅ استخدام نفس الطريقة المستخدمة في خزنة الفرع للحصول على بيانات دقيقة
        let userSalaryData = null;
        if (currentUser.role !== 'admin' && currentUser.id) {
            try {
                // استخدام الشهر الحالي (نفس الطريقة في خزنة الفرع)
                const now = new Date();
                const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                
                // جلب المستحقات للشهر الحالي (نفس API المستخدم في خزنة الفرع)
                const salaryResult = await API.getSalaries(null, currentMonth);
                if (salaryResult && salaryResult.success && salaryResult.data && Array.isArray(salaryResult.data)) {
                    // البحث عن المستخدم الحالي في النتائج
                    const userData = salaryResult.data.find(u => String(u.id) === String(currentUser.id));
                    if (userData) {
                        userSalaryData = userData;
                    }
                }
            } catch (error) {
                console.warn('⚠️ فشل جلب بيانات المستحقات:', error);
            }
        }

        // استخدام أيقونة Bootstrap الافتراضية للملف الشخصي
        // التحقق من وجود avatar بشكل صحيح
        const hasAvatar = currentUser.avatar && 
                         currentUser.avatar !== null && 
                         currentUser.avatar !== '' && 
                         String(currentUser.avatar).trim() !== '';
        const avatarSrc = hasAvatar ? currentUser.avatar : '';
        
        // عرض واجهة الملف الشخصي
        section.innerHTML = `
        <div class="profile-container">
            <!-- صورة الملف الشخصي -->
            <div class="profile-section">
                <h3><i class="bi bi-image"></i> صورة الملف الشخصي</h3>
                <div class="profile-avatar-section">
                    <div class="profile-avatar-container">
                        ${hasAvatar 
                            ? `<img id="profileAvatarImg" src="${avatarSrc}?t=${Date.now()}" 
                                     alt="صورة الملف الشخصي" 
                                     class="profile-avatar-preview"
                                     onerror="handleAvatarError()">`
                            : `<div id="profileAvatarDefault" class="profile-avatar-default">
                                   <i class="bi bi-person-circle"></i>
                               </div>`
                        }
                        <div class="profile-avatar-overlay">
                            <label for="profileAvatarInput" class="profile-avatar-upload-btn">
                                <i class="bi bi-camera"></i>
                                <span>تغيير الصورة</span>
                            </label>
                            <input type="file" id="profileAvatarInput" accept="image/*" style="display: none;" onchange="handleAvatarUpload(event)">
                        </div>
                    </div>
                    <div class="profile-avatar-actions">
                        <button type="button" class="btn btn-secondary btn-sm" id="removeAvatarBtn" onclick="removeAvatar()" ${hasAvatar ? '' : 'disabled'}>
                            <i class="bi bi-trash"></i> حذف الصورة
                        </button>
                        <p class="profile-avatar-hint">
                            <i class="bi bi-info-circle"></i> الحد الأقصى لحجم الصورة: 2MB. الصيغ المدعومة: JPG, PNG, GIF
                        </p>
                    </div>
                </div>
            </div>

            <!-- معلومات الحساب -->
            <div class="profile-section">
                <h3><i class="bi bi-person-badge"></i> معلومات الحساب</h3>
                <div class="profile-info-card">
                    <div class="profile-info-item">
                        <label><i class="bi bi-person"></i> الاسم:</label>
                        <span>${currentUser.name || 'غير محدد'}</span>
                    </div>
                    <div class="profile-info-item">
                        <label><i class="bi bi-at"></i> اسم المستخدم:</label>
                        <span>${currentUser.username || 'غير محدد'}</span>
                    </div>
                    <div class="profile-info-item">
                        <label><i class="bi bi-shield-check"></i> الدور:</label>
                        <span>${getRoleText(currentUser.role)}</span>
                    </div>
                    <div class="profile-info-item">
                        <label><i class="bi bi-building"></i> الفرع:</label>
                        <span>${currentUser.branch_name || 'غير محدد'}</span>
                    </div>
                    ${currentUser.role === 'technician' && currentUser.specialization ? `
                    <div class="profile-info-item">
                        <label><i class="bi bi-tools"></i> التخصص:</label>
                        <span>${getSpecializationText(currentUser.specialization)}</span>
                    </div>
                    ` : ''}
                    <div class="profile-info-item">
                        <label><i class="bi bi-fingerprint"></i> حالة البصمة:</label>
                        <span id="biometric-status">${userCredentials.length > 0 ? '<span style="color: #4CAF50;"><i class="bi bi-check-circle"></i> مفعّلة</span>' : '<span style="color: #f44336;"><i class="bi bi-x-circle"></i> غير مفعّلة</span>'}</span>
                    </div>
                </div>
            </div>

            ${userSalaryData && currentUser.role !== 'admin' ? `
            <!-- المستحقات -->
            <div class="profile-section">
                ${(() => {
                    const monthYear = userSalaryData.month_year || new Date().toISOString().slice(0, 7);
                    const formatMonthYear = function(monthYear) {
                        if (!monthYear) return '';
                        try {
                            if (typeof monthYear === 'string' && monthYear.match(/^\d{4}-\d{2}$/)) {
                                const [year, month] = monthYear.split('-');
                                const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                                 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                                const monthIndex = parseInt(month) - 1;
                                return `${monthNames[monthIndex]} ${year}`;
                            }
                            return monthYear;
                        } catch (e) {
                            return monthYear;
                        }
                    };
                    const monthText = formatMonthYear(monthYear);
                    return `<h3><i class="bi bi-cash-stack"></i> المستحقات ${monthText ? `- ${monthText}` : ''}</h3>`;
                })()}
                <div class="profile-info-card">
                    ${(() => {
                        // ✅ استخدام نفس البيانات المحسوبة من API (مثل خزنة الفرع)
                        const salaryAmount = parseFloat(userSalaryData.salary || 0);
                        const totalWithdrawals = parseFloat(userSalaryData.total_withdrawals || 0);
                        const totalDeductions = parseFloat(userSalaryData.total_deductions || 0);
                        const netSalary = parseFloat(userSalaryData.net_salary || salaryAmount);
                        
                        const formatCurrency = window.formatCurrency || function(amount) {
                            return parseFloat(amount || 0).toFixed(2) + ' ج.م';
                        };
                        
                        return `
                            <div class="profile-info-item">
                                <label><i class="bi bi-currency-exchange"></i> الراتب الشهري:</label>
                                <span style="color: var(--primary-color); font-weight: bold;">${formatCurrency(salaryAmount)}</span>
                            </div>
                            <div class="profile-info-item">
                                <label><i class="bi bi-arrow-down-circle"></i> المسحوبات:</label>
                                <span style="color: var(--danger-color); font-weight: bold;">${formatCurrency(totalWithdrawals)}</span>
                            </div>
                            <div class="profile-info-item">
                                <label><i class="bi bi-dash-circle"></i> الخصومات:</label>
                                <span style="color: var(--warning-color); font-weight: bold;">${formatCurrency(totalDeductions)}</span>
                            </div>
                            <div class="profile-info-item" style="border-top: 2px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
                                <label><i class="bi bi-calculator"></i> الصافي:</label>
                                <span style="color: var(--success-color); font-weight: bold; font-size: 1.1em;">${formatCurrency(netSalary)}</span>
                            </div>
                        `;
                    })()}
                </div>
            </div>
            ` : ''}

            ${currentUser.role === 'technician' ? `
            <!-- تقييم الفني -->
            <div class="profile-section technician-rating-section">
                <h3><i class="bi bi-star-fill"></i> تقييم الأداء</h3>
                <div class="technician-rating-card">
                    ${technicianRating ? `
                        <div class="technician-rating-display">
                            <div class="rating-main-display">
                                <div class="rating-value-large">
                                    <span class="rating-number">${technicianRating.final_rating > 0 ? technicianRating.final_rating.toFixed(1) : '0.0'}</span>
                                    <span class="rating-max">/ 5.0</span>
                                </div>
                                <div class="rating-stars-display">
                                    ${[5, 4, 3, 2, 1].map(star => `
                                        <i class="bi bi-star${star <= Math.round(technicianRating.final_rating) ? '-fill' : ''}" 
                                           style="color: ${star <= Math.round(technicianRating.final_rating) ? 'var(--warning-color)' : 'var(--border-color)'}; 
                                                  font-size: 1.8em;"></i>
                                    `).join('')}
                                </div>
                            </div>
                            
                            ${technicianRating.has_auto_rating ? `
                            <div class="rating-details">
                                <div class="rating-detail-item">
                                    <label><i class="bi bi-graph-up"></i> التقييم التراكمي:</label>
                                    <span class="rating-value">${technicianRating.auto_rating.toFixed(1)} / 5.0</span>
                                    <span class="rating-count">(${technicianRating.total_ratings} تقييم)</span>
                                </div>
                            </div>
                            ` : ''}
                            
                            ${technicianRating.has_manual_rating ? `
                            <div class="rating-details">
                                <div class="rating-detail-item">
                                    <label><i class="bi bi-pencil-square"></i> التقييم اليدوي:</label>
                                    <span class="rating-value">${technicianRating.manual_rating} / 5</span>
                                </div>
                                ${technicianRating.manual_note ? `
                                <div class="rating-note">
                                    <label><i class="bi bi-chat-left-text"></i> الملاحظات:</label>
                                    <div class="note-content">${escapeHtml(technicianRating.manual_note)}</div>
                                    ${technicianRating.manual_rating_date ? `
                                    <div class="note-date">
                                        <i class="bi bi-calendar"></i>
                                        ${formatDate(technicianRating.manual_rating_date)}
                                    </div>
                                    ` : ''}
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                            
                            ${!technicianRating.has_auto_rating && !technicianRating.has_manual_rating ? `
                            <div class="no-rating-message">
                                <i class="bi bi-info-circle"></i>
                                <p>لا يوجد تقييمات حتى الآن</p>
                            </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="loading-rating">
                            <i class="bi bi-hourglass-split"></i>
                            <p>جاري تحميل التقييم...</p>
                        </div>
                    `}
                </div>
            </div>
            ` : ''}

            <!-- تعديل بيانات الحساب -->
            <div class="profile-section">
                <h3><i class="bi bi-pencil-square"></i> تعديل بيانات الحساب</h3>
                <form id="profileEditForm" class="profile-edit-form" onsubmit="updateProfile(event)">
                    <div class="form-group">
                        <label for="profileName">
                            <i class="bi bi-person"></i> اسم الحساب *
                        </label>
                        <input 
                            type="text" 
                            id="profileName" 
                            name="name" 
                            value="${currentUser.name || ''}" 
                            required
                            placeholder="أدخل اسم الحساب"
                        >
                    </div>

                    <div class="form-group">
                        <label for="profileUsername">
                            <i class="bi bi-at"></i> اسم المستخدم *
                        </label>
                        <input 
                            type="text" 
                            id="profileUsername" 
                            name="username" 
                            value="${currentUser.username || ''}" 
                            required
                            placeholder="أدخل اسم المستخدم"
                        >
                        <div id="usernameValidation" class="validation-message"></div>
                    </div>

                    <div class="form-group">
                        <label for="profilePassword">
                            <i class="bi bi-lock"></i> كلمة المرور الجديدة
                        </label>
                        <input 
                            type="password" 
                            id="profilePassword" 
                            name="password" 
                            placeholder="اتركه فارغاً للاحتفاظ بالقديمة (الحد الأدنى 6 أحرف)"
                            minlength="6"
                        >
                        <small class="form-hint">
                            <i class="bi bi-info-circle"></i> اترك الحقل فارغاً إذا كنت لا تريد تغيير كلمة المرور
                        </small>
                    </div>

                    ${currentUser.role === 'technician' ? `
                    <div class="form-group">
                        <label for="profileSpecialization">
                            <i class="bi bi-tools"></i> التخصص *
                        </label>
                        <select 
                            id="profileSpecialization" 
                            name="specialization" 
                            required
                        >
                            <option value="">اختر التخصص</option>
                            <option value="soft" ${currentUser.specialization === 'soft' ? 'selected' : ''}>سوفت</option>
                            <option value="hard" ${currentUser.specialization === 'hard' ? 'selected' : ''}>هارد</option>
                            <option value="fast" ${currentUser.specialization === 'fast' ? 'selected' : ''}>فاست</option>
                        </select>
                    </div>
                    ` : ''}

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="saveProfileBtn">
                            <i class="bi bi-save"></i> حفظ التغييرات
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="resetProfileForm()">
                            <i class="bi bi-x-circle"></i> إلغاء
                        </button>
                    </div>
                </form>
            </div>

            <!-- إدارة البصمة -->
            <div class="profile-section">
                <h3><i class="bi bi-fingerprint"></i> إدارة البصمة</h3>
                
                <!-- زر تسجيل بصمة جديدة -->
                <div class="biometric-register-section">
                    <button id="registerBiometricBtn" class="btn btn-primary" style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        border: none;
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        margin-bottom: 20px;
                        width: 100%;
                        transition: all 0.3s;
                    ">
                        <i class="bi bi-fingerprint" style="font-size: 20px;"></i>
                        <span>تسجيل بصمة جديدة</span>
                    </button>
                    <p style="color: #666; font-size: 14px; text-align: center; margin-top: 10px;">
                        <i class="bi bi-info-circle"></i> يمكنك تسجيل عدة بصمات على أجهزة مختلفة
                    </p>
                </div>

                <!-- قائمة البصمات المسجلة -->
                <div class="credentials-list-section">
                    <h4 style="margin-top: 30px; margin-bottom: 15px;">
                        <i class="bi bi-list-check"></i> البصمات المسجلة (${userCredentials.length})
                    </h4>
                    
                    <div id="credentials-list" class="credentials-list">
                        ${userCredentials.length === 0 
                            ? '<p style="text-align: center; color: #999; padding: 20px;">لا توجد بصمات مسجلة بعد</p>'
                            : userCredentials.map(cred => `
                                <div class="credential-item" data-credential-id="${cred.id}">
                                    <div class="credential-info">
                                        <div class="credential-icon">
                                            <i class="bi bi-device-hdd"></i>
                                        </div>
                                        <div class="credential-details">
                                            <div class="credential-name">${cred.device_name || 'جهاز غير معروف'}</div>
                                            <div class="credential-meta">
                                                <span><i class="bi bi-calendar"></i> تم التسجيل: ${formatDate(cred.created_at)}</span>
                                                ${cred.last_used ? `<span style="margin-right: 15px;"><i class="bi bi-clock-history"></i> آخر استخدام: ${formatDate(cred.last_used)}</span>` : '<span style="margin-right: 15px;"><i class="bi bi-clock-history"></i> لم يُستخدم بعد</span>'}
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn btn-danger btn-sm" onclick="deleteCredential(${cred.id})" style="
                                        padding: 8px 15px;
                                        border-radius: 6px;
                                        font-size: 14px;
                                    ">
                                        <i class="bi bi-trash"></i> حذف
                                    </button>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

        // إضافة event listeners للنموذج
        setupProfileFormHandlers();

        // إضافة event listener لزر تسجيل البصمة
        const registerBtn = document.getElementById('registerBiometricBtn');
        if (registerBtn) {
            // إزالة event listener القديم إذا كان موجوداً
            registerBtn.replaceWith(registerBtn.cloneNode(true));
            const newRegisterBtn = document.getElementById('registerBiometricBtn');
            if (newRegisterBtn) {
                newRegisterBtn.addEventListener('click', async () => {
                    // التأكد من تحميل webauthn.js قبل الاستخدام
                    try {
                        await ensureWebAuthnLoaded();
                    } catch (error) {
                        showMessage('خطأ: فشل تحميل نظام البصمة. يرجى إعادة تحميل الصفحة.', 'error');
                        console.error('❌ Failed to load WebAuthn:', error);
                        return;
                    }
                    handleRegisterBiometric();
                });
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل قسم الملف الشخصي:', error);
        const section = document.getElementById('profile-content');
        if (section) {
            section.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                    <i class="bi bi-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>خطأ في تحميل الملف الشخصي</p>
                    <p style="font-size: 14px; color: var(--text-light); margin-top: 10px;">${error.message || 'خطأ غير معروف'}</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                        <button onclick="if(typeof loadProfileSection === 'function') loadProfileSection(); else location.reload();" class="btn btn-primary">
                            <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                        </button>
                        <button onclick="location.reload()" class="btn btn-secondary">
                            <i class="bi bi-arrow-repeat"></i> إعادة تحميل الصفحة
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// تحميل البصمات المسجلة
async function loadCredentials() {
    try {
        const response = await fetch('api/webauthn_credentials.php?action=list', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`خطأ HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // ✅ تسجيل البيانات للتحقق
        console.log('🔍 WebAuthn Credentials Response:', data);

        if (data.success) {
            // ✅ إصلاح: البيانات تأتي في data.data.credentials وليس data.credentials
            const credentials = data.data?.credentials || data.credentials || [];
            userCredentials = Array.isArray(credentials) ? credentials : [];
            console.log('✅ تم تحميل البصمات:', userCredentials.length, 'بصمة');
        } else {
            console.error('❌ خطأ في تحميل البصمات:', data.message || data.error || 'خطأ غير معروف');
            userCredentials = [];
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل البصمات:', error.message || error);
        userCredentials = [];
    }
}

// تسجيل بصمة جديدة
async function handleRegisterBiometric() {
    const btn = document.getElementById('registerBiometricBtn');
    if (!btn) return;

    // التحقق من دعم WebAuthn
    if (typeof simpleWebAuthn === 'undefined') {
        console.error('❌ simpleWebAuthn غير محمّل. تأكد من تحميل webauthn.js');
        showMessage('خطأ: نظام البصمة غير محمّل. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }
    
    if (!simpleWebAuthn.isSupported()) {
        // الحصول على معلومات مفصلة عن سبب عدم الدعم
        const supportInfo = simpleWebAuthn.getSupportInfo();
        console.error('❌ WebAuthn غير مدعوم:', supportInfo);
        
        let errorMsg = '⚠️ WebAuthn غير مدعوم في هذا المتصفح\n\n';
        errorMsg += supportInfo;
        
        showMessage(errorMsg, 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري التسجيل...';

        // طلب اسم الجهاز باستخدام نافذة إدخال مخصصة
        if (typeof window.showInputPrompt === 'undefined') {
            showMessage('خطأ: نظام الإدخال غير متاح. يرجى إعادة تحميل الصفحة.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-fingerprint"></i> <span>تسجيل بصمة جديدة</span>';
            return;
        }
        
        const defaultDeviceName = simpleWebAuthn.detectDeviceName() || '';
        const deviceName = await window.showInputPrompt('أدخل اسم للجهاز (مثال: iPhone 13, Samsung Galaxy, Windows PC):', defaultDeviceName, 'text');
        
        if (!deviceName || deviceName.trim() === '') {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-fingerprint"></i> <span>تسجيل بصمة جديدة</span>';
            return;
        }

        // تسجيل البصمة
        const result = await simpleWebAuthn.register(deviceName.trim());

        if (result && result.success) {
            showMessage('تم تسجيل البصمة بنجاح!', 'success');
            // إعادة تحميل البصمات أولاً
            await loadCredentials();
            // إعادة تحميل القسم
            await loadProfileSection();
        } else {
            const errorMsg = result?.message || 'فشل تسجيل البصمة';
            console.error('WebAuthn registration failed:', errorMsg);
            showMessage(errorMsg, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-fingerprint"></i> <span>تسجيل بصمة جديدة</span>';
        }
    } catch (error) {
        console.error('خطأ في تسجيل البصمة:', error);
        showMessage('حدث خطأ أثناء تسجيل البصمة: ' + (error.message || error), 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-fingerprint"></i> <span>تسجيل بصمة جديدة</span>';
    }
}

// حذف بصمة
async function deleteCredential(credentialId) {
    if (!confirm('هل أنت متأكد من حذف هذه البصمة؟ لن تتمكن من استخدامها لتسجيل الدخول بعد الحذف.')) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('credential_id', credentialId);

        const response = await fetch('api/webauthn_credentials.php', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`خطأ HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showMessage('تم حذف البصمة بنجاح', 'success');
            // إعادة تحميل البصمات أولاً
            await loadCredentials();
            // إعادة تحميل القسم
            await loadProfileSection();
        } else {
            showMessage(data.error || 'فشل حذف البصمة', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف البصمة:', error);
        showMessage('حدث خطأ أثناء حذف البصمة: ' + (error.message || error), 'error');
    }
}

// إعداد معالجات نموذج الملف الشخصي
function setupProfileFormHandlers() {
    const usernameInput = document.getElementById('profileUsername');
    if (!usernameInput) return;

    // التحقق من اسم المستخدم عند الكتابة (مع debounce)
    const checkUsername = debounce(async (username) => {
        const validationDiv = document.getElementById('usernameValidation');
        if (!validationDiv) return;

        // إذا كان اسم المستخدم هو نفسه الحالي، لا حاجة للتحقق
        if (username === currentUser?.username) {
            validationDiv.innerHTML = '';
            validationDiv.className = 'validation-message';
            return;
        }

        if (!username || username.trim().length < 3) {
            validationDiv.innerHTML = '<i class="bi bi-exclamation-circle"></i> اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
            validationDiv.className = 'validation-message error';
            return;
        }

        // عرض حالة التحميل
        validationDiv.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري التحقق...';
        validationDiv.className = 'validation-message loading';

        try {
            const result = await API.checkUsernameAvailability(username.trim());
            
            if (result && result.success) {
                if (result.data && result.data.available) {
                    validationDiv.innerHTML = '<i class="bi bi-check-circle"></i> اسم المستخدم متاح';
                    validationDiv.className = 'validation-message success';
                } else {
                    validationDiv.innerHTML = '<i class="bi bi-x-circle"></i> اسم المستخدم موجود مسبقاً';
                    validationDiv.className = 'validation-message error';
                }
            } else {
                validationDiv.innerHTML = '<i class="bi bi-exclamation-triangle"></i> حدث خطأ أثناء التحقق';
                validationDiv.className = 'validation-message error';
            }
        } catch (error) {
            console.error('خطأ في التحقق من اسم المستخدم:', error);
            validationDiv.innerHTML = '<i class="bi bi-exclamation-triangle"></i> حدث خطأ أثناء التحقق';
            validationDiv.className = 'validation-message error';
        }
    }, 500); // 500ms debounce

    usernameInput.addEventListener('input', (e) => {
        checkUsername(e.target.value);
    });

    // التحقق الأولي عند التحميل
    if (usernameInput.value && usernameInput.value !== currentUser?.username) {
        checkUsername(usernameInput.value);
    }
}

// تحديث بيانات الملف الشخصي
async function updateProfile(event) {
    if (event) {
        event.preventDefault();
    }

    const form = document.getElementById('profileEditForm');
    if (!form) return;

    const nameInput = document.getElementById('profileName');
    const usernameInput = document.getElementById('profileUsername');
    const passwordInput = document.getElementById('profilePassword');
    const specializationInput = document.getElementById('profileSpecialization');
    const saveBtn = document.getElementById('saveProfileBtn');
    const validationDiv = document.getElementById('usernameValidation');

    if (!nameInput || !usernameInput || !passwordInput || !saveBtn) {
        showMessage('خطأ: لم يتم العثور على حقول النموذج', 'error');
        return;
    }

    const name = nameInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const specialization = specializationInput ? specializationInput.value : null;

    // التحقق من صحة البيانات
    if (!name || !username) {
        showMessage('الاسم واسم المستخدم مطلوبان', 'error');
        return;
    }

    if (username.length < 3) {
        showMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل', 'error');
        return;
    }

    // التحقق من أن اسم المستخدم متاح (إذا تغير)
    if (username !== currentUser?.username) {
        if (validationDiv && validationDiv.classList.contains('error')) {
            showMessage('اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر', 'error');
            return;
        }

        // التحقق مرة أخرى قبل الحفظ
        try {
            const checkResult = await API.checkUsernameAvailability(username);
            if (!checkResult || !checkResult.success || !checkResult.data?.available) {
                showMessage('اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر', 'error');
                return;
            }
        } catch (error) {
            console.error('خطأ في التحقق النهائي من اسم المستخدم:', error);
            showMessage('حدث خطأ أثناء التحقق من اسم المستخدم', 'error');
            return;
        }
    }

    // التحقق من كلمة المرور إذا كانت محددة
    if (password && password.length > 0 && password.length < 6) {
        showMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    // التحقق من التخصص للفنيين
    if (currentUser?.role === 'technician' && (!specialization || specialization === '')) {
        showMessage('التخصص مطلوب للفنيين', 'error');
        return;
    }

    // بناء بيانات التحديث
    const updateData = {
        name: name,
        username: username
    };

    if (password && password.length > 0) {
        updateData.password = password;
    }

    // إضافة التخصص للفنيين
    if (currentUser?.role === 'technician' && specialization) {
        updateData.specialization = specialization;
    }

    // تعطيل الزر أثناء الحفظ
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الحفظ...';

    try {
        const result = await API.updateProfile(updateData);

        if (result && result.success) {
            // ✅ التحقق من تغيير اسم المستخدم
            const usernameChanged = result.data && currentUser && result.data.username !== currentUser.username;
            
            showMessage('تم تحديث بيانات الملف الشخصي بنجاح', 'success');
            
            // تحديث بيانات المستخدم الحالي
            if (result.data) {
                currentUser = result.data;
                localStorage.setItem('currentUser', JSON.stringify(result.data));
                
                // تحديث معلومات المستخدم في الواجهة
                if (typeof updateUserInfo === 'function') {
                    updateUserInfo();
                }
            }

            // ✅ إذا تغير اسم المستخدم، عمل refresh كامل للصفحة لعرض الاسم الجديد
            if (usernameChanged) {
                setTimeout(() => {
                    // مسح cache المصادقة لإجبار إعادة التحقق
                    try {
                        // مسح localStorage لإجبار إعادة جلب البيانات من الخادم
                        localStorage.removeItem('currentUser');
                        // مسح sessionStorage أيضاً
                        sessionStorage.removeItem('just_logged_in_time');
                    } catch (e) {
                        console.warn('تحذير: فشل مسح cache المصادقة:', e);
                    }
                    // عمل refresh للصفحة
                    window.location.reload();
                }, 1500); // انتظار 1.5 ثانية لعرض رسالة النجاح
            } else {
                // إعادة تحميل القسم فقط إذا لم يتغير اسم المستخدم
                setTimeout(() => {
                    loadProfileSection();
                }, 1000);
            }
        } else {
            showMessage(result?.message || 'فشل تحديث بيانات الملف الشخصي', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-save"></i> حفظ التغييرات';
        }
    } catch (error) {
        console.error('خطأ في تحديث الملف الشخصي:', error);
        showMessage('حدث خطأ أثناء تحديث بيانات الملف الشخصي: ' + (error.message || 'خطأ غير معروف'), 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> حفظ التغييرات';
    }
}

// إعادة تعيين نموذج الملف الشخصي
function resetProfileForm() {
    if (!currentUser) return;

    const nameInput = document.getElementById('profileName');
    const usernameInput = document.getElementById('profileUsername');
    const passwordInput = document.getElementById('profilePassword');
    const specializationInput = document.getElementById('profileSpecialization');
    const validationDiv = document.getElementById('usernameValidation');

    if (nameInput) nameInput.value = currentUser.name || '';
    if (usernameInput) usernameInput.value = currentUser.username || '';
    if (passwordInput) passwordInput.value = '';
    if (specializationInput) specializationInput.value = currentUser.specialization || '';
    if (validationDiv) {
        validationDiv.innerHTML = '';
        validationDiv.className = 'validation-message';
    }

    showMessage('تم إلغاء التعديلات', 'success');
}

// تنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return `منذ ${minutes} دقيقة`;
            }
            return `منذ ${hours} ساعة`;
        } else if (days === 1) {
            return 'أمس';
        } else if (days < 7) {
            return `منذ ${days} أيام`;
        } else {
            return date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (error) {
        return dateString;
    }
}

// تحديث دالة showSection لدعم قسم الملف الشخصي
if (typeof window.showSection === 'function') {
    const originalShowSection = window.showSection;
    window.showSection = function(sectionId) {
        originalShowSection(sectionId);
        
        if (sectionId === 'profile') {
            loadProfileSection();
        }
    };
} else {
    // إذا لم تكن الدالة موجودة، نراقب تغيير الأقسام
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList && node.classList.contains('section') && node.classList.contains('active') && node.id === 'profile-section') {
                    loadProfileSection();
                }
            });
        });
    });
    
    document.addEventListener('DOMContentLoaded', () => {
        const sectionsContainer = document.querySelector('.main-content');
        if (sectionsContainer) {
            observer.observe(sectionsContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }
    });
}

// تحميل القسم عند تحميل الصفحة إذا كان نشطاً
document.addEventListener('DOMContentLoaded', () => {
    const activeSection = document.querySelector('.section.active');
    if (activeSection && activeSection.id === 'profile-section') {
        loadProfileSection();
    }
});

// دالة مساعدة للحصول على الأحرف الأولى
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// دالة للحصول على نص التخصص (إذا لم تكن موجودة في auth.js)
if (typeof getSpecializationText === 'undefined') {
    function getSpecializationText(specialization) {
        if (!specialization) return '';
        
        const specializationMap = {
            'soft': 'سوفت',
            'hard': 'هارد',
            'fast': 'فاست'
        };
        
        return specializationMap[specialization] || '';
    }
    window.getSpecializationText = getSpecializationText;
}

// معالجة رفع صورة الملف الشخصي
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
        showMessage('الملف المحدد ليس صورة', 'error');
        return;
    }
    
    // التحقق من حجم الملف (2MB)
    if (file.size > 2 * 1024 * 1024) {
        showMessage('حجم الصورة كبير جداً. الحد الأقصى 2MB', 'error');
        return;
    }
    
    try {
        // قراءة الصورة كـ Base64
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target.result;
            
            // عرض حالة التحميل
            const uploadBtn = document.querySelector('.profile-avatar-upload-btn');
            if (uploadBtn) {
                uploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الرفع...';
                uploadBtn.style.pointerEvents = 'none';
            }
            
            try {
                // إرسال الصورة للخادم
                const result = await API.request('profile.php', 'POST', {
                    action: 'upload_avatar',
                    avatar_data: imageData
                });
                
                if (result && result.success) {
                    showMessage('تم تحديث صورة الملف الشخصي بنجاح', 'success');
                    
                    // تحديث الصورة في الواجهة
                    const avatarContainer = document.querySelector('.profile-avatar-container');
                    if (avatarContainer && result.data && result.data.avatar) {
                        // إزالة الأيقونة الافتراضية إن وجدت
                        const defaultAvatar = document.getElementById('profileAvatarDefault');
                        if (defaultAvatar) {
                            defaultAvatar.remove();
                        }
                        
                        // إضافة الصورة
                        let avatarImg = document.getElementById('profileAvatarImg');
                        if (!avatarImg) {
                            avatarImg = document.createElement('img');
                            // ✅ إضافة lazy loading للصور
                            avatarImg.loading = 'lazy';
                            avatarImg.decoding = 'async';
                            avatarImg.id = 'profileAvatarImg';
                            avatarImg.className = 'profile-avatar-preview';
                            avatarImg.alt = 'صورة الملف الشخصي';
                            avatarImg.onerror = handleAvatarError;
                            avatarContainer.insertBefore(avatarImg, avatarContainer.firstChild);
                        }
                        avatarImg.src = result.data.avatar + '?t=' + Date.now();
                    }
                    
                    // تحديث بيانات المستخدم
                    if (result.data) {
                        currentUser = { ...currentUser, ...result.data };
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                    
                    // تفعيل زر حذف الصورة
                    const removeBtn = document.getElementById('removeAvatarBtn');
                    if (removeBtn) {
                        removeBtn.disabled = false;
                    }
                } else {
                    showMessage(result?.message || 'فشل تحديث صورة الملف الشخصي', 'error');
                }
            } catch (error) {
                console.error('خطأ في رفع صورة الملف الشخصي:', error);
                showMessage('حدث خطأ أثناء رفع الصورة', 'error');
            } finally {
                if (uploadBtn) {
                    uploadBtn.innerHTML = '<i class="bi bi-camera"></i><span>تغيير الصورة</span>';
                    uploadBtn.style.pointerEvents = 'auto';
                }
                // إعادة تعيين input
                event.target.value = '';
            }
        };
        
        reader.onerror = () => {
            showMessage('حدث خطأ أثناء قراءة الصورة', 'error');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('خطأ في معالجة الصورة:', error);
        showMessage('حدث خطأ أثناء معالجة الصورة', 'error');
    }
}

// جعل الدالة متاحة عالمياً
window.handleAvatarUpload = handleAvatarUpload;

// معالجة خطأ تحميل الصورة
function handleAvatarError() {
    try {
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarContainer = document.querySelector('.profile-avatar-container');
        
        if (avatarImg && avatarContainer) {
            // إزالة الصورة المعطلة
            avatarImg.remove();
            
            // إضافة الأيقونة الافتراضية
            const defaultAvatar = document.createElement('div');
            defaultAvatar.id = 'profileAvatarDefault';
            defaultAvatar.className = 'profile-avatar-default';
            defaultAvatar.innerHTML = '<i class="bi bi-person-circle"></i>';
            avatarContainer.insertBefore(defaultAvatar, avatarContainer.firstChild);
            
            // تعطيل زر الحذف
            const removeBtn = document.getElementById('removeAvatarBtn');
            if (removeBtn) {
                removeBtn.disabled = true;
            }
            
            // تحديث بيانات المستخدم
            if (currentUser) {
                currentUser.avatar = null;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
        }
    } catch (error) {
        console.error('خطأ في handleAvatarError:', error);
    }
}

// جعل الدالة متاحة عالمياً
window.handleAvatarError = handleAvatarError;

// حذف صورة الملف الشخصي
async function removeAvatar() {
    try {
        // التحقق من وجود زر الحذف
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn && removeBtn.disabled) {
            showMessage('لا توجد صورة للحذف', 'info');
            return;
        }
        
        if (!confirm('هل أنت متأكد من حذف صورة الملف الشخصي؟')) {
            return;
        }
        
        // تعطيل الزر أثناء المعالجة
        if (removeBtn) {
            removeBtn.disabled = true;
            const originalText = removeBtn.innerHTML;
            removeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الحذف...';
            
            try {
                const result = await API.request('profile.php', 'POST', {
                    action: 'remove_avatar'
                });
                
                if (result && result.success) {
                    showMessage('تم حذف صورة الملف الشخصي بنجاح', 'success');
                    
                    // تحديث الصورة في الواجهة - استبدال الصورة بالأيقونة الافتراضية
                    const avatarImg = document.getElementById('profileAvatarImg');
                    const avatarContainer = document.querySelector('.profile-avatar-container');
                    
                    if (avatarContainer) {
                        // إزالة الصورة إن وجدت
                        if (avatarImg) {
                            avatarImg.remove();
                        }
                        
                        // التحقق من عدم وجود أيقونة افتراضية مسبقاً
                        let defaultAvatar = document.getElementById('profileAvatarDefault');
                        if (!defaultAvatar) {
                            // إضافة الأيقونة الافتراضية من Bootstrap
                            defaultAvatar = document.createElement('div');
                            defaultAvatar.id = 'profileAvatarDefault';
                            defaultAvatar.className = 'profile-avatar-default';
                            defaultAvatar.innerHTML = '<i class="bi bi-person-circle"></i>';
                            avatarContainer.insertBefore(defaultAvatar, avatarContainer.firstChild);
                        }
                    }
                    
                    // تحديث بيانات المستخدم
                    if (result.data) {
                        currentUser = { ...currentUser, ...result.data };
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                    
                    // تحديث زر الحذف
                    if (removeBtn) {
                        removeBtn.disabled = true;
                        removeBtn.innerHTML = '<i class="bi bi-trash"></i> حذف الصورة';
                    }
                } else {
                    showMessage(result?.message || 'فشل حذف صورة الملف الشخصي', 'error');
                    if (removeBtn) {
                        removeBtn.disabled = false;
                        removeBtn.innerHTML = originalText;
                    }
                }
            } catch (error) {
                console.error('خطأ في حذف صورة الملف الشخصي:', error);
                showMessage('حدث خطأ أثناء حذف الصورة: ' + (error.message || 'خطأ غير معروف'), 'error');
                if (removeBtn) {
                    removeBtn.disabled = false;
                    removeBtn.innerHTML = originalText;
                }
            }
        } else {
            // إذا لم يكن الزر موجوداً، تنفيذ العملية مباشرة
            const result = await API.request('profile.php', 'POST', {
                action: 'remove_avatar'
            });
            
            if (result && result.success) {
                showMessage('تم حذف صورة الملف الشخصي بنجاح', 'success');
                // إعادة تحميل القسم لعرض التغييرات
                setTimeout(() => {
                    loadProfileSection();
                }, 500);
            } else {
                showMessage(result?.message || 'فشل حذف صورة الملف الشخصي', 'error');
            }
        }
    } catch (error) {
        console.error('خطأ في حذف صورة الملف الشخصي:', error);
        showMessage('حدث خطأ أثناء حذف الصورة: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// جعل الدالة متاحة عالمياً
window.removeAvatar = removeAvatar;

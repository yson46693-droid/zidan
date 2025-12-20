// إدارة الملف الشخصي

let currentUser = null;
let userCredentials = [];

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

        // التحقق من وجود الدوال المطلوبة
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

        // الحصول على بيانات المستخدم الحالي
        currentUser = getCurrentUser();
        if (!currentUser) {
            // محاولة الحصول على المستخدم من checkLogin
            try {
                if (typeof checkLogin === 'function') {
                    const user = await checkLogin();
                    if (user) {
                        currentUser = user;
                    }
                }
            } catch (e) {
                console.warn('فشل الحصول على المستخدم من checkLogin:', e);
            }

            if (!currentUser) {
                section.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                        <i class="bi bi-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <p>خطأ: لم يتم العثور على بيانات المستخدم</p>
                        <p style="font-size: 14px; color: var(--text-light); margin-top: 10px;">يرجى تسجيل الدخول مرة أخرى</p>
                        <button onclick="location.href='index.html'" class="btn btn-primary" style="margin-top: 20px;">
                            <i class="bi bi-box-arrow-in-right"></i> تسجيل الدخول
                        </button>
                    </div>
                `;
                return;
            }
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

        // عرض واجهة الملف الشخصي
        section.innerHTML = `
        <div class="profile-container">
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
                        <label><i class="bi bi-fingerprint"></i> حالة البصمة:</label>
                        <span id="biometric-status">${userCredentials.length > 0 ? '<span style="color: #4CAF50;"><i class="bi bi-check-circle"></i> مفعّلة</span>' : '<span style="color: #f44336;"><i class="bi bi-x-circle"></i> غير مفعّلة</span>'}</span>
                    </div>
                </div>
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
                    <p>حدث خطأ في تحميل الملف الشخصي</p>
                    <p style="font-size: 14px; color: var(--text-light); margin-top: 10px;">${error.message || 'خطأ غير معروف'}</p>
                    <button onclick="if(typeof loadProfileSection === 'function') loadProfileSection(); else location.reload();" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                    </button>
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

        if (data.success) {
            userCredentials = data.credentials || [];
        } else {
            console.error('خطأ في تحميل البصمات:', data.message || data.error || 'خطأ غير معروف');
            userCredentials = [];
        }
    } catch (error) {
        console.error('خطأ في تحميل البصمات:', error.message || error);
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

        // طلب اسم الجهاز
        const deviceName = prompt('أدخل اسم للجهاز (مثال: iPhone 13, Samsung Galaxy, Windows PC):', simpleWebAuthn.detectDeviceName());
        
        if (!deviceName || deviceName.trim() === '') {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-fingerprint"></i> <span>تسجيل بصمة جديدة</span>';
            return;
        }

        // تسجيل البصمة
        const result = await simpleWebAuthn.register(deviceName.trim());

        if (result && result.success) {
            showMessage('تم تسجيل البصمة بنجاح!', 'success');
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

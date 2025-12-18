// إدارة الملف الشخصي

let currentUser = null;
let userCredentials = [];

// تحميل قسم الملف الشخصي
async function loadProfileSection() {
    const section = document.getElementById('profile-content');
    if (!section) {
        console.error('profile-content not found');
        return;
    }

    // الحصول على بيانات المستخدم الحالي
    currentUser = getCurrentUser();
    if (!currentUser) {
        section.innerHTML = '<p style="color: red;">خطأ: لم يتم العثور على بيانات المستخدم</p>';
        return;
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
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        registerBtn.addEventListener('click', handleRegisterBiometric);
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
            console.error('خطأ في تحميل البصمات:', data.error);
            userCredentials = [];
        }
    } catch (error) {
        console.error('خطأ في تحميل البصمات:', error);
        userCredentials = [];
    }
}

// تسجيل بصمة جديدة
async function handleRegisterBiometric() {
    const btn = document.getElementById('registerBiometricBtn');
    if (!btn) return;

    // التحقق من دعم WebAuthn
    if (typeof simpleWebAuthn === 'undefined' || !simpleWebAuthn.isSupported()) {
        showMessage('WebAuthn غير مدعوم في هذا المتصفح. يرجى استخدام متصفح حديث.', 'error');
        return;
    }

    // التحقق من HTTPS (مطلوب لـ WebAuthn إلا في localhost)
    const hostname = window.location.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '[::1]' ||
                       hostname.startsWith('192.168.') ||
                       hostname.startsWith('10.');
    
    if (window.location.protocol !== 'https:' && !isLocalhost) {
        showMessage('WebAuthn يتطلب HTTPS. يرجى الوصول للموقع عبر HTTPS.', 'error');
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
            showMessage(result?.message || 'فشل تسجيل البصمة', 'error');
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

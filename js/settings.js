// الإعدادات

let currentSettings = null;

function loadSettingsSection() {
    const section = document.getElementById('settings-section');
    if (!section) {
        console.error('settings-section not found');
        return;
    }
    
    // عرض حالة التحميل
    section.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري تحميل الإعدادات...</div>';
    
    // تحميل المحتوى بعد تأخير قصير لضمان عرض رسالة التحميل
    setTimeout(() => {
        try {
            section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-gear"></i> الإعدادات</h2>
        </div>

        <div class="settings-container">
            <div class="settings-section">
                <h3><i class="bi bi-shop"></i> إعدادات المحل</h3>
                <form id="shopSettingsForm" onsubmit="saveShopSettings(event)">
                    <div class="form-group">
                        <label for="shopName">اسم المحل</label>
                        <input type="text" id="shopName">
                    </div>

                    <div class="form-group">
                        <label for="shopPhone">رقم الهاتف</label>
                        <input type="tel" id="shopPhone">
                    </div>

                    <div class="form-group">
                        <label for="shopAddress">العنوان</label>
                        <textarea id="shopAddress" rows="2"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="currency">العملة</label>
                        <input type="text" id="currency">
                    </div>

                    <button type="submit" class="btn btn-primary"><i class="bi bi-save-fill"></i> حفظ الإعدادات</button>
                </form>
            </div>

        <div class="settings-section">
            <h3><i class="bi bi-images"></i> إدارة الصور</h3>
            <p>إدارة نظام تخزين الصور والحذف التلقائي</p>
            <button onclick="loadImageManagementSection()" class="btn btn-primary">
                <i class="bi bi-gear"></i> إدارة نظام الصور
            </button>
        </div>

        <div class="settings-section">
            <h3><i class="bi bi-cloud-upload"></i> النسخ الاحتياطية</h3>
            <p>عرض حالة النسخ الاحتياطية التلقائية</p>
            <div class="backup-info-display">
                <div class="info-item">
                    <span class="info-label">الحالة:</span>
                    <span class="info-value" id="backupStatusDisplay">جاري التحميل...</span>
                </div>
                <div class="info-item">
                    <span class="info-label">آخر نسخة احتياطية:</span>
                    <span class="info-value" id="lastBackupDisplay">غير متوفر</span>
                </div>
                <div class="info-item">
                    <span class="info-label">النسخة التالية:</span>
                    <span class="info-value" id="nextBackupDisplay">غير محدد</span>
                </div>
            </div>
        </div>

        <div class="settings-section">
            <h3><i class="bi bi-people"></i> إدارة المستخدمين</h3>
            <button onclick="showAddUserModal()" class="btn btn-primary" style="margin-bottom: 15px;">
                <i class="bi bi-person-plus"></i> إضافة مستخدم
            </button>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>اسم المستخدم</th>
                            <th>الاسم</th>
                            <th>الدور</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr>
                            <td colspan="4" style="text-align: center; padding: 20px;">
                                <i class="bi bi-hourglass-split"></i> جاري تحميل المستخدمين...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="settings-section">
                <h3><i class="bi bi-arrow-repeat"></i> إعدادات المزامنة</h3>
                <div class="form-group">
                    <label for="syncFrequency">تردد المزامنة التلقائية</label>
                    <select id="syncFrequency" onchange="updateSyncFrequency()">
                        <option value="10">كل 10 ثواني (سريع جداً)</option>
                        <option value="30" selected>كل 30 ثانية (موصى به)</option>
                        <option value="60">كل دقيقة</option>
                        <option value="300">كل 5 دقائق</option>
                        <option value="0">يدوي فقط (بدون مزامنة تلقائية)</option>
                    </select>
                </div>
                <button onclick="syncManager.manualSync()" class="btn btn-primary"><i class="bi bi-arrow-clockwise"></i> مزامنة الآن</button>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    آخر مزامنة: <span id="lastSyncTime">لم تتم بعد</span>
                </p>
            </div>

            <div class="settings-section">
                <h3><i class="bi bi-cloud-download"></i> النسخ الاحتياطي</h3>
                <div class="backup-buttons">
                    <button onclick="createBackup()" class="btn btn-success"><i class="bi bi-download"></i> تصدير نسخة احتياطية</button>
                    <button onclick="restoreBackup()" class="btn btn-warning"><i class="bi bi-upload"></i> استعادة نسخة احتياطية</button>
                </div>
            </div>
        </div>

        <!-- نموذج إضافة/تعديل مستخدم -->
        <div id="userModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="userModalTitle">إضافة مستخدم</h3>
                    <button onclick="closeUserModal()" class="btn-close">&times;</button>
                </div>
                <form id="userForm" onsubmit="saveUser(event)">
                    <input type="hidden" id="userId">
                    
                    <div class="form-group">
                        <label for="userName">الاسم *</label>
                        <input type="text" id="userName" required>
                    </div>

                    <div class="form-group">
                        <label for="userUsername">اسم المستخدم *</label>
                        <input type="text" id="userUsername" required>
                    </div>

                    <div class="form-group">
                        <label for="userPassword">كلمة المرور <span id="passwordHint">(اتركه فارغاً للاحتفاظ بالقديمة)</span></label>
                        <input type="password" id="userPassword">
                    </div>

                    <div class="form-group">
                        <label for="userRole">الدور *</label>
                        <select id="userRole" required>
                            <option value="employee">موظف</option>
                            <option value="manager">مدير</option>
                            <option value="admin">مالك</option>
                        </select>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeUserModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

            // التحقق من أن النموذج تم إنشاؤه بنجاح
            setTimeout(() => {
                const userModal = document.getElementById('userModal');
                if (!userModal) {
                    console.error('userModal was not created successfully');
                    console.error('section.innerHTML length:', section.innerHTML.length);
                    // محاولة إعادة إنشاء userModal إذا لم يكن موجوداً
                    const modalHTML = `
                        <div id="userModal" class="modal">
                            <div class="modal-content modal-sm">
                                <div class="modal-header">
                                    <h3 id="userModalTitle">إضافة مستخدم</h3>
                                    <button onclick="closeUserModal()" class="btn-close">&times;</button>
                                </div>
                                <form id="userForm" onsubmit="saveUser(event)">
                                    <input type="hidden" id="userId">
                                    <div class="form-group">
                                        <label for="userName">الاسم *</label>
                                        <input type="text" id="userName" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="userUsername">اسم المستخدم *</label>
                                        <input type="text" id="userUsername" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="userPassword">كلمة المرور <span id="passwordHint">(اتركه فارغاً للاحتفاظ بالقديمة)</span></label>
                                        <input type="password" id="userPassword">
                                    </div>
                                    <div class="form-group">
                                        <label for="userRole">الدور *</label>
                                        <select id="userRole" required>
                                            <option value="employee">موظف</option>
                                            <option value="manager">مدير</option>
                                            <option value="admin">مالك</option>
                                        </select>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" onclick="closeUserModal()" class="btn btn-secondary">إلغاء</button>
                                        <button type="submit" class="btn btn-primary">حفظ</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    `;
                    section.insertAdjacentHTML('beforeend', modalHTML);
                    console.log('تم إعادة إنشاء userModal');
                } else {
                    console.log('userModal created successfully');
                }
            }, 100);

            // تحميل البيانات بشكل آمن مع معالجة الأخطاء
            // تأخير بسيط لضمان أن DOM جاهز
            setTimeout(() => {
                Promise.allSettled([
                    loadSettings().catch(err => {
                        // طباعة الخطأ الحقيقي
                        console.error('خطأ في تحميل الإعدادات:', err);
                        console.error('نوع الخطأ:', err?.name || 'Unknown');
                        console.error('رسالة الخطأ:', err?.message || 'No message');
                        console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        
                        const errorMsg = err?.message || err?.toString() || 'خطأ غير معروف';
                        if (typeof showMessage === 'function') {
                            showMessage('خطأ في تحميل الإعدادات: ' + errorMsg, 'error');
                        }
                        // عرض رسالة خطأ في الواجهة إذا فشل التحميل
                        const shopNameField = document.getElementById('shopName');
                        if (shopNameField && shopNameField.parentElement) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error-message';
                            errorDiv.style.color = 'var(--danger-color)';
                            errorDiv.style.marginTop = '10px';
                            errorDiv.innerHTML = '<i class="bi bi-exclamation-triangle"></i> فشل تحميل الإعدادات. يرجى المحاولة مرة أخرى.';
                            shopNameField.parentElement.appendChild(errorDiv);
                        }
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    }),
                    loadUsers().catch(err => {
                        // طباعة الخطأ الحقيقي
                        console.error('خطأ في تحميل المستخدمين:', err);
                        console.error('نوع الخطأ:', err?.name || 'Unknown');
                        console.error('رسالة الخطأ:', err?.message || 'No message');
                        console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        
                        const errorMsg = err?.message || err?.toString() || 'خطأ غير معروف';
                        if (typeof showMessage === 'function') {
                            showMessage('خطأ في تحميل قائمة المستخدمين: ' + errorMsg, 'error');
                        }
                        // عرض رسالة خطأ في الجدول إذا فشل التحميل
                        const usersTableBody = document.getElementById('usersTableBody');
                        if (usersTableBody) {
                            usersTableBody.innerHTML = `
                                <tr>
                                    <td colspan="4" style="text-align: center; color: var(--danger-color); padding: 20px;">
                                        <i class="bi bi-exclamation-triangle"></i> 
                                        <p>فشل تحميل قائمة المستخدمين</p>
                                        <p style="font-size: 0.9em; margin-top: 10px;">${escapeHtml(errorMsg)}</p>
                                        <button onclick="loadUsers()" class="btn btn-sm btn-primary" style="margin-top: 10px;">
                                            <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                                        </button>
                                    </td>
                                </tr>
                            `;
                        } else {
                            console.error('usersTableBody not found when trying to display error');
                        }
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    }),
                    loadSyncFrequency().catch(err => {
                        console.error('خطأ في تحميل تردد المزامنة:', err);
                        console.error('تفاصيل الخطأ:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    }),
                    loadBackupInfo().catch(err => {
                        console.error('خطأ في تحميل معلومات النسخ الاحتياطية:', err);
                        console.error('تفاصيل الخطأ:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    })
                ]).then((results) => {
                    console.log('تم تحميل قسم الإعدادات بنجاح');
                    // التحقق من وجود أخطاء
                    const errors = results.filter(r => r.status === 'rejected');
                    if (errors.length > 0) {
                        console.warn('تم تحميل القسم مع بعض الأخطاء:', errors.length, 'خطأ');
                        errors.forEach((errorResult, index) => {
                            console.warn(`خطأ ${index + 1}:`, errorResult.reason);
                        });
                    }
                });
            }, 150); // تأخير 150ms لضمان أن DOM جاهز
        } catch (error) {
            // طباعة الخطأ الحقيقي
            console.error('خطأ في تحميل قسم الإعدادات:', error);
            console.error('نوع الخطأ:', error?.name || 'Unknown');
            console.error('رسالة الخطأ:', error?.message || 'No message');
            console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            
            const errorMsg = error?.message || error?.toString() || 'خطأ غير معروف';
            section.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                    <i class="bi bi-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>حدث خطأ في تحميل الإعدادات</p>
                    <p style="font-size: 0.9em; margin-top: 10px; color: #999;">${escapeHtml(errorMsg)}</p>
                    <button onclick="if(typeof loadSettingsSection === 'function') loadSettingsSection(); else location.reload();" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    }, 100);
}

// تحميل معلومات النسخ الاحتياطية للعرض فقط
async function loadBackupInfo() {
    try {
        const status = await API.getTelegramBackupStatus();
        if (status.success) {
            const backupStatus = status.data;
            
            // تحديث عرض الحالة
            const statusElement = document.getElementById('backupStatusDisplay');
            const lastBackupElement = document.getElementById('lastBackupDisplay');
            const nextBackupElement = document.getElementById('nextBackupDisplay');
            
            if (statusElement) {
                statusElement.textContent = backupStatus.enabled ? 'مفعّل' : 'معطّل';
                statusElement.className = `info-value ${backupStatus.enabled ? 'enabled' : 'disabled'}`;
            }
            
            if (lastBackupElement) {
                lastBackupElement.textContent = backupStatus.last_backup_time ? 
                    formatDate(backupStatus.last_backup_time) : 'لم يتم إنشاء نسخة احتياطية';
            }
            
            if (nextBackupElement) {
                nextBackupElement.textContent = backupStatus.next_backup_time ? 
                    formatDateTime(backupStatus.next_backup_time) : 'غير محدد';
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل معلومات النسخ الاحتياطية:', error);
        const statusElement = document.getElementById('backupStatusDisplay');
        if (statusElement) {
            statusElement.textContent = 'خطأ في التحميل';
            statusElement.className = 'info-value error';
        }
    }
}

// تنسيق التاريخ والوقت
function formatDateTime(dateString) {
    if (!dateString) return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// تنسيق التاريخ فقط
function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

async function loadSettings() {
    try {
        const result = await API.getSettings();
        
        // التحقق من response.success بدلاً من الاعتماد على status code فقط
        if (!result || result.success === false) {
            // تحديد نوع الخطأ
            let errorMessage = result?.message || 'فشل تحميل الإعدادات';
            if (result?.status === 401) {
                errorMessage = 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.';
            } else if (result?.networkError) {
                errorMessage = 'خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
            }
            throw new Error(errorMessage);
        }
        
        // التحقق من وجود البيانات
        if (!result.data) {
            console.warn('API رجع success=true لكن data غير موجودة - استخدام إعدادات افتراضية');
            // استخدام إعدادات افتراضية
            currentSettings = {
                shop_name: '',
                shop_phone: '',
                shop_address: '',
                currency: 'ريال'
            };
        } else {
            currentSettings = result.data;
        }
        
        // التحقق من أن settings ليست مصفوفة فارغة
        if (Array.isArray(currentSettings) && currentSettings.length === 0) {
            console.warn('settings هي مصفوفة فارغة - استخدام إعدادات افتراضية');
            currentSettings = {
                shop_name: '',
                shop_phone: '',
                shop_address: '',
                currency: 'ريال'
            };
        }
        
        displaySettings(currentSettings);
    } catch (error) {
        // طباعة الخطأ الحقيقي بدلاً من Object
        console.error('خطأ في loadSettings:', error);
        console.error('نوع الخطأ:', error?.name || 'Unknown');
        console.error('رسالة الخطأ:', error?.message || 'No message');
        console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw error;
    }
}

function displaySettings(settings) {
    if (!settings) {
        console.warn('displaySettings: settings is null or undefined - استخدام إعدادات افتراضية');
        settings = {
            shop_name: '',
            shop_phone: '',
            shop_address: '',
            currency: 'ريال'
        };
    }
    
    // التحقق من أن settings ليست مصفوفة
    if (Array.isArray(settings)) {
        console.warn('displaySettings: settings هي مصفوفة - تحويل إلى object');
        // تحويل المصفوفة إلى object إذا كانت من API
        const settingsObj = {};
        if (settings.length > 0) {
            settings.forEach(item => {
                if (item && item.key && item.value !== undefined) {
                    settingsObj[item.key] = item.value;
                }
            });
        }
        settings = settingsObj;
    }
    
    const shopName = document.getElementById('shopName');
    const shopPhone = document.getElementById('shopPhone');
    const shopAddress = document.getElementById('shopAddress');
    const currency = document.getElementById('currency');
    
    if (shopName) shopName.value = settings.shop_name || '';
    if (shopPhone) shopPhone.value = settings.shop_phone || '';
    if (shopAddress) shopAddress.value = settings.shop_address || '';
    if (currency) currency.value = settings.currency || 'ريال';
}

async function saveShopSettings(event) {
    event.preventDefault();

    const settingsData = {
        shop_name: document.getElementById('shopName').value,
        shop_phone: document.getElementById('shopPhone').value,
        shop_address: document.getElementById('shopAddress').value,
        currency: document.getElementById('currency').value
    };

    const result = await API.updateSettings(settingsData);
    if (result.success) {
        showMessage('تم حفظ الإعدادات بنجاح');
        currentSettings = result.data;
    } else {
        showMessage(result.message, 'error');
    }
}

async function loadUsers() {
    try {
        // التحقق من وجود العنصر قبل محاولة التحميل
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            console.warn('usersTableBody not found, waiting for DOM...');
            // إعادة المحاولة بعد تأخير قصير
            setTimeout(() => {
                loadUsers().catch(err => {
                    console.error('خطأ في إعادة محاولة تحميل المستخدمين:', err);
                    // طباعة الخطأ الحقيقي
                    console.error('تفاصيل الخطأ:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                });
            }, 200);
            return;
        }
        
        const result = await API.getUsers();
        
        // التحقق من response.success بدلاً من الاعتماد على status code فقط
        if (!result || result.success === false) {
            // تحديد نوع الخطأ
            let errorMessage = result?.message || 'فشل تحميل قائمة المستخدمين';
            if (result?.status === 403) {
                errorMessage = 'ليس لديك صلاحية لعرض قائمة المستخدمين. يجب أن تكون مالك (admin) للوصول إلى هذه الصفحة.';
            } else if (result?.status === 401) {
                errorMessage = 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.';
            } else if (result?.networkError) {
                errorMessage = 'خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
            }
            throw new Error(errorMessage);
        }
        
        // التحقق من وجود البيانات وصحتها
        if (!result.data) {
            console.warn('API رجع success=true لكن data غير موجودة');
            throw new Error('البيانات غير متوفرة من الخادم');
        }
        
        displayUsers(result.data);
    } catch (error) {
        // طباعة الخطأ الحقيقي بدلاً من Object
        console.error('خطأ في loadUsers:', error);
        console.error('نوع الخطأ:', error?.name || 'Unknown');
        console.error('رسالة الخطأ:', error?.message || 'No message');
        console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // عرض رسالة الخطأ في الجدول إذا كان موجوداً
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            const errorMsg = error?.message || error?.toString() || 'خطأ غير معروف';
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--danger-color); padding: 20px;">
                        <i class="bi bi-exclamation-triangle"></i> 
                        <p>فشل تحميل قائمة المستخدمين</p>
                        <p style="font-size: 0.9em; margin-top: 10px;">${escapeHtml(errorMsg)}</p>
                        <button onclick="loadUsers()" class="btn btn-sm btn-primary" style="margin-top: 10px;">
                            <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                        </button>
                    </td>
                </tr>
            `;
        }
        throw error;
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    // التحقق من وجود العنصر قبل التعديل
    if (!tbody) {
        console.error('usersTableBody element not found');
        return;
    }
    
    // التحقق من صحة البيانات قبل الاستخدام
    if (!users) {
        console.error('displayUsers: users is null or undefined');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-color);">خطأ: البيانات غير متوفرة</td></tr>';
        return;
    }
    
    if (!Array.isArray(users)) {
        console.error('displayUsers: users is not an array:', typeof users, users);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-color);">خطأ في تنسيق البيانات</td></tr>';
        return;
    }
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">لا يوجد مستخدمين</td></tr>';
        return;
    }

    // التحقق من صحة كل مستخدم قبل عرضه
    const validUsers = users.filter(user => {
        if (!user || typeof user !== 'object') {
            console.warn('displayUsers: مستخدم غير صحيح:', user);
            return false;
        }
        if (!user.id) {
            console.warn('displayUsers: مستخدم بدون id:', user);
            return false;
        }
        return true;
    });
    
    if (validUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-color);">لا توجد بيانات صحيحة للعرض</td></tr>';
        return;
    }

    // دالة مساعدة للحصول على نص الدور
    const getRoleTextFunc = typeof getRoleText === 'function' ? getRoleText : (role) => {
        const roles = {
            'admin': 'مالك',
            'manager': 'مدير',
            'employee': 'موظف'
        };
        return roles[role] || role || 'غير محدد';
    };
    
    tbody.innerHTML = validUsers.map(user => {
        // التحقق من وجود جميع الحقول المطلوبة
        const userId = escapeHtml(String(user.id || ''));
        const username = escapeHtml(String(user.username || ''));
        const name = escapeHtml(String(user.name || ''));
        const role = escapeHtml(String(user.role || 'employee'));
        
        return `
        <tr>
            <td>${username}</td>
            <td>${name}</td>
            <td>${getRoleTextFunc(role)}</td>
            <td>
                <button onclick="editUser('${userId}', '${username}', '${name}', '${role}')" class="btn btn-sm btn-icon" title="تعديل"><i class="bi bi-pencil-square"></i></button>
                <button onclick="deleteUser('${userId}')" class="btn btn-sm btn-icon" title="حذف"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `;
    }).join('');
}

// دالة مساعدة لتجنب XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAddUserModal() {
    console.log('showAddUserModal called'); // للتشخيص
    
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية لإضافة مستخدمين', 'error');
        return;
    }
    
    const userModal = document.getElementById('userModal');
    if (!userModal) {
        console.error('userModal not found');
        showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }

    // التحقق من وجود جميع العناصر المطلوبة
    const requiredElements = ['userModalTitle', 'userForm', 'userId', 'userName', 'userUsername', 'userPassword', 'userRole'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }
    
    // إعداد النموذج بطريقة آمنة
    const titleElement = document.getElementById('userModalTitle');
    const formElement = document.getElementById('userForm');
    const userIdElement = document.getElementById('userId');
    const usernameField = document.getElementById('userUsername');
    const passwordHint = document.getElementById('passwordHint');
    const passwordField = document.getElementById('userPassword');

    if (titleElement) titleElement.textContent = 'إضافة مستخدم';
    if (formElement) formElement.reset();
    if (userIdElement) userIdElement.value = '';
    
    if (usernameField) usernameField.disabled = false;
    
    if (passwordHint) passwordHint.style.display = 'none';
    if (passwordField) {
        passwordField.required = true;
        passwordField.placeholder = '';
    }
    
    userModal.style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function saveUser(event) {
    event.preventDefault();

    // التحقق من وجود النموذج أولاً
    const userModal = document.getElementById('userModal');
    if (!userModal) {
        showMessage('خطأ: نموذج المستخدم غير موجود. يرجى الانتقال إلى قسم الإعدادات أولاً.', 'error');
        console.error('userModal not found');
        return;
    }

    // التحقق من وجود العناصر أولاً
    const nameElement = document.getElementById('userName');
    const usernameElement = document.getElementById('userUsername');
    const passwordElement = document.getElementById('userPassword');
    const roleElement = document.getElementById('userRole');
    const userIdElement = document.getElementById('userId');

    if (!nameElement || !usernameElement || !roleElement || !userIdElement) {
        showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
        console.error('Missing form elements:', {
            nameElement: !!nameElement,
            usernameElement: !!usernameElement,
            passwordElement: !!passwordElement,
            roleElement: !!roleElement,
            userIdElement: !!userIdElement
        });
        return;
    }

    // التحقق من الحقول المطلوبة - استخدام طريقة آمنة
    const name = nameElement ? (nameElement.value || '').trim() : '';
    const username = usernameElement ? (usernameElement.value || '').trim() : '';
    const password = passwordElement ? (passwordElement.value || '') : '';
    const role = roleElement ? (roleElement.value || '') : '';
    const userId = userIdElement ? (userIdElement.value || '') : '';

    if (!name || !username || !role) {
        showMessage('الاسم واسم المستخدم والدور مطلوبة', 'error');
        return;
    }

    // إذا كان مستخدم جديد، كلمة المرور مطلوبة
    if (!userId && !password) {
        showMessage('كلمة المرور مطلوبة للمستخدم الجديد', 'error');
        return;
    }

    const userData = {
        name: name,
        username: username,
        password: password,
        role: role
    };

    let result;

    if (userId) {
        userData.id = userId;
        if (!userData.password) {
            delete userData.password;
        }
        delete userData.username; // لا يمكن تعديل اسم المستخدم
        result = await API.updateUser(userData);
    } else {
        result = await API.addUser(userData);
    }

    if (result.success) {
        showMessage(result.message);
        closeUserModal();
        loadUsers();
    } else {
        showMessage(result.message, 'error');
    }
}

function editUser(id, username, name, role) {
    // التحقق من وجود النموذج أولاً
    const userModal = document.getElementById('userModal');
    if (!userModal) {
        showMessage('خطأ: نموذج المستخدم غير موجود. يرجى الانتقال إلى قسم الإعدادات أولاً.', 'error');
        console.error('userModal not found in editUser');
        return;
    }

    // التحقق من وجود جميع العناصر المطلوبة
    const requiredElements = ['userModalTitle', 'userId', 'userName', 'userUsername', 'userPassword', 'passwordHint', 'userRole'];
    const missingElements = requiredElements.filter(elementId => !document.getElementById(elementId));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements in editUser:', missingElements);
        showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }

    // ملء النموذج بطريقة آمنة
    const titleElement = document.getElementById('userModalTitle');
    const userIdElement = document.getElementById('userId');
    const nameElement = document.getElementById('userName');
    const usernameElement = document.getElementById('userUsername');
    const passwordElement = document.getElementById('userPassword');
    const passwordHintElement = document.getElementById('passwordHint');
    const roleElement = document.getElementById('userRole');

    if (titleElement) titleElement.textContent = 'تعديل المستخدم';
    if (userIdElement) userIdElement.value = id;
    if (nameElement) nameElement.value = name;
    if (usernameElement) {
        usernameElement.value = username;
        usernameElement.disabled = true;
    }
    if (passwordElement) {
        passwordElement.value = '';
        passwordElement.required = false;
    }
    if (passwordHintElement) passwordHintElement.style.display = 'inline';
    if (roleElement) roleElement.value = role;
    
    document.getElementById('userModal').style.display = 'flex';
}

async function deleteUser(id) {
    if (!confirmAction('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    const result = await API.deleteUser(id);
    if (result.success) {
        showMessage(result.message);
        loadUsers();
    } else {
        showMessage(result.message, 'error');
    }
}

async function createBackup() {
    const result = await API.createBackup();
    if (result.success) {
        const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
        exportToJSON(result.data, filename);
        showMessage('تم إنشاء النسخة الاحتياطية بنجاح');
    } else {
        showMessage(result.message, 'error');
    }
}

function restoreBackup() {
    if (!confirmAction('هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم استبدال جميع البيانات الحالية!')) return;

    importFromJSON(async (data) => {
        const result = await API.restoreBackup(data);
        if (result.success) {
            showMessage('تم استعادة النسخة الاحتياطية بنجاح');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showMessage(result.message, 'error');
        }
    });
}

// تحديث تردد المزامنة
function updateSyncFrequency() {
    const frequency = parseInt(document.getElementById('syncFrequency').value);
    
    if (frequency === 0) {
        syncManager.stopAutoSync();
        showMessage('تم إيقاف المزامنة التلقائية', 'success');
    } else {
        syncManager.setFrequency(frequency);
        showMessage(`تم تحديث تردد المزامنة إلى ${frequency} ثانية`, 'success');
    }
    
    // حفظ الإعداد
    localStorage.setItem('syncFrequency', frequency);
}

// تحميل تردد المزامنة المحفوظ
function loadSyncFrequency() {
    const savedFrequency = localStorage.getItem('syncFrequency');
    if (savedFrequency) {
        const frequencySelect = document.getElementById('syncFrequency');
        if (frequencySelect) {
            frequencySelect.value = savedFrequency;
            if (parseInt(savedFrequency) > 0) {
                syncManager.setFrequency(parseInt(savedFrequency));
            }
        }
    }
}

// تحديث وقت آخر مزامنة
setInterval(() => {
    const lastSyncElement = document.getElementById('lastSyncTime');
    if (lastSyncElement && syncManager.lastSyncTime) {
        const timeStr = syncManager.lastSyncTime.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastSyncElement.textContent = timeStr;
    }
}, 1000);

// دالة تحميل قسم إدارة الصور
async function loadImageManagementSection() {
    const section = document.getElementById('settings-section');
    if (!section) return;

    // إخفاء قسم الإعدادات الحالي
    section.style.display = 'none';

    // إنشاء قسم إدارة الصور
    const imageSection = document.createElement('div');
    imageSection.id = 'image-management-section';
    imageSection.className = 'settings-container';
    
    // إضافة زر العودة
    imageSection.innerHTML = `
        <div class="section-header">
            <button onclick="loadSettingsSection()" class="btn btn-secondary">
                <i class="bi bi-arrow-right"></i> العودة للإعدادات
            </button>
        </div>
    `;

    // إضافة القسم إلى الصفحة
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.appendChild(imageSection);
    }

    // تحميل إدارة الصور
    if (typeof imageManagement !== 'undefined') {
        await imageManagement.loadSettings();
    } else {
        showMessage('خطأ في تحميل نظام إدارة الصور', 'error');
    }
}


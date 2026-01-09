// الإعدادات

let currentSettings = null;

// ✅ تصدير فوري للدالة الرئيسية لضمان توفرها - تعريف الدالة أولاً
function loadSettingsSection() {
    console.log('🔧 [Settings] loadSettingsSection تم استدعاؤها');
    const section = document.getElementById('settings-section');
    if (!section) {
        console.error('❌ [Settings] settings-section not found');
        return;
    }
    
    // عرض حالة التحميل
    section.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري تحميل الإعدادات...</div>';
    
    // تحميل المحتوى بعد تأخير قصير لضمان عرض رسالة التحميل
    setTimeout(() => {
        try {
            section.innerHTML = `
        <div class="section-header">
        </div>

        <div class="settings-container">
            <div class="settings-section">
                <h3><i class="bi bi-shop"></i> إعدادات الفروع</h3>
                
                <!-- Tabs للفروع -->
                <div class="branch-tabs">
                    <button type="button" class="branch-tab active" onclick="switchBranchTab(1)">
                        <i class="bi bi-building"></i> الفرع الأول
                    </button>
                    <button type="button" class="branch-tab" onclick="switchBranchTab(2)">
                        <i class="bi bi-building"></i> الفرع الثاني
                    </button>
                </div>

                <!-- نموذج الفرع الأول -->
                <form id="shopSettingsForm" class="branch-form active" data-branch="1" onsubmit="saveShopSettings(event, 1)">
                    <div class="branch-header">
                        <h4><i class="bi bi-building"></i> بيانات الفرع الأول</h4>
                    </div>
                    <div class="form-group">
                        <label for="shopName1">اسم المحل</label>
                        <input type="text" id="shopName1" placeholder="أدخل اسم المحل">
                    </div>

                    <div class="form-group">
                        <label for="shopPhone1">رقم الهاتف</label>
                        <input type="tel" id="shopPhone1" placeholder="أدخل رقم الهاتف">
                    </div>

                    <div class="form-group">
                        <label for="shopAddress1">العنوان</label>
                        <textarea id="shopAddress1" rows="2" placeholder="أدخل العنوان الكامل"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="currency1">العملة</label>
                        <input type="text" id="currency1" placeholder="مثال: ريال" value="ريال">
                    </div>

                    <div class="form-group">
                        <label for="whatsappNumber1"><i class="bi bi-whatsapp" style="color: #25D366;"></i> رقم واتساب</label>
                        <input type="tel" id="whatsappNumber1" placeholder="أدخل رقم واتساب (مثال: 01234567890)">
            </div>

                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-save-fill"></i> حفظ بيانات الفرع الأول
            </button>
                </form>

                <!-- نموذج الفرع الثاني -->
                <form id="shopSettingsForm2" class="branch-form" data-branch="2" onsubmit="saveShopSettings(event, 2)">
                    <div class="branch-header">
                        <h4><i class="bi bi-building"></i> بيانات الفرع الثاني</h4>
                    </div>
                    <div class="form-group">
                        <label for="shopName2">اسم المحل</label>
                        <input type="text" id="shopName2" placeholder="أدخل اسم المحل">
        </div>

                    <div class="form-group">
                        <label for="shopPhone2">رقم الهاتف</label>
                        <input type="tel" id="shopPhone2" placeholder="أدخل رقم الهاتف">
                </div>

                    <div class="form-group">
                        <label for="shopAddress2">العنوان</label>
                        <textarea id="shopAddress2" rows="2" placeholder="أدخل العنوان الكامل"></textarea>
                </div>

                    <div class="form-group">
                        <label for="currency2">العملة</label>
                        <input type="text" id="currency2" placeholder="مثال: ريال" value="ريال">
                </div>

                    <div class="form-group">
                        <label for="whatsappNumber2"><i class="bi bi-whatsapp" style="color: #25D366;"></i> رقم واتساب</label>
                        <input type="tel" id="whatsappNumber2" placeholder="أدخل رقم واتساب (مثال: 01234567890)">
            </div>

                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-save-fill"></i> حفظ بيانات الفرع الثاني
                    </button>
                </form>
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
                            <th>الفرع</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 20px;">
                                <i class="bi bi-hourglass-split"></i> جاري تحميل المستخدمين...
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div id="usersPagination" class="pagination"></div>
            </div>
        </div>

        <div class="settings-section">
            <h3><i class="bi bi-arrow-repeat"></i> المزامنة والنسخ الاحتياطي</h3>
            
            <!-- إعدادات المزامنة -->
            <div class="sync-backup-section">
                <h4><i class="bi bi-arrow-repeat"></i> إعدادات المزامنة</h4>
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
                <button onclick="if(typeof syncManager !== 'undefined' && syncManager){syncManager.manualSync();}else{showMessage('نظام المزامنة غير متوفر حالياً', 'error');}" class="btn btn-primary">
                    <i class="bi bi-arrow-clockwise"></i> مزامنة الآن
                </button>
                <p style="margin-top: 10px; font-size: 0.9em; color: var(--text-light);">
                    آخر مزامنة: <span id="lastSyncTime">لم تتم بعد</span>
                </p>
            </div>

            <!-- حالة النسخ الاحتياطية التلقائية -->
            <div class="sync-backup-section">
                <h4><i class="bi bi-cloud-upload"></i> حالة النسخ الاحتياطية التلقائية</h4>
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
                    <div class="info-item">
                        <span class="info-label">عدد النسخ المحفوظة:</span>
                        <span class="info-value" id="backupCountDisplay">0</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">الحجم الإجمالي:</span>
                        <span class="info-value" id="backupSizeDisplay">0 MB</span>
                    </div>
                </div>
            </div>

            <!-- أزرار النسخ الاحتياطي -->
            <div class="sync-backup-section">
                <h4><i class="bi bi-cloud-download"></i> النسخ الاحتياطي اليدوي</h4>
                <div class="backup-buttons">
                    <button onclick="createDatabaseBackup()" class="btn btn-success" id="createBackupBtn">
                        <i class="bi bi-download"></i> إنشاء نسخة احتياطية الآن
                    </button>
                    <button onclick="loadBackupFiles()" class="btn btn-secondary">
                        <i class="bi bi-arrow-clockwise"></i> تحديث القائمة
                    </button>
                </div>
                <p style="margin-top: 10px; font-size: 0.9em; color: var(--text-light);">
                    <i class="bi bi-info-circle"></i> يتم إنشاء نسخة احتياطية تلقائياً كل 24 ساعة
                </p>
            </div>

            <!-- قائمة النسخ الاحتياطية -->
            <div class="sync-backup-section">
                <h4><i class="bi bi-list-ul"></i> النسخ الاحتياطية المحفوظة</h4>
                <div id="backupFilesList" style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
                    <div style="text-align: center; padding: 20px; color: var(--text-light);">
                        <i class="bi bi-hourglass-split"></i> جاري التحميل...
                    </div>
                </div>
            </div>

            <!-- إدارة التخزين (للمالك فقط) -->
            <div class="sync-backup-section" id="storageManagementSection" style="display: none;">
                <h4><i class="bi bi-hdd-stack"></i> إدارة التخزين</h4>
                <p style="color: var(--warning-color); font-size: 0.9em; margin-bottom: 15px;">
                    <i class="bi bi-exclamation-triangle"></i> هذه الأداة متاحة فقط للمالك. احذر عند حذف الملفات!
                </p>
                
                <div class="storage-tabs">
                    <button type="button" class="storage-tab active" onclick="switchStorageTab('invoices')">
                        <i class="bi bi-file-earmark-pdf"></i> الفواتير
                    </button>
                    <button type="button" class="storage-tab" onclick="switchStorageTab('images')">
                        <i class="bi bi-images"></i> الصور
                    </button>
                    <button type="button" class="storage-tab" onclick="switchStorageTab('database')">
                        <i class="bi bi-database"></i> قاعدة البيانات
                    </button>
                </div>

                <!-- قسم الفواتير -->
                <div class="storage-content active" data-storage="invoices">
                    <div class="storage-header">
                        <h5><i class="bi bi-file-earmark-pdf"></i> ملفات الفواتير</h5>
                        <button onclick="loadStorageFiles('invoices')" class="btn btn-sm btn-secondary">
                            <i class="bi bi-arrow-clockwise"></i> تحديث
                        </button>
                    </div>
                    <div id="invoicesStorageList" class="storage-list">
                        <div style="text-align: center; padding: 20px; color: var(--text-light);">
                            <i class="bi bi-hourglass-split"></i> جاري التحميل...
                        </div>
                    </div>
                    <div id="invoicesPagination" class="pagination"></div>
                </div>

                <!-- قسم الصور -->
                <div class="storage-content" data-storage="images">
                    <div class="storage-header">
                        <h5><i class="bi bi-images"></i> ملفات الصور</h5>
                        <button onclick="loadStorageFiles('images')" class="btn btn-sm btn-secondary">
                            <i class="bi bi-arrow-clockwise"></i> تحديث
                        </button>
                    </div>
                    <div id="imagesStorageList" class="storage-list">
                        <div style="text-align: center; padding: 20px; color: var(--text-light);">
                            <i class="bi bi-hourglass-split"></i> جاري التحميل...
                        </div>
                    </div>
                    <div id="imagesPagination" class="pagination"></div>
                </div>

                <!-- قسم قاعدة البيانات -->
                <div class="storage-content" data-storage="database">
                    <div class="storage-header">
                        <h5><i class="bi bi-database"></i> معلومات قاعدة البيانات</h5>
                        <button onclick="loadDatabaseInfo()" class="btn btn-sm btn-secondary">
                            <i class="bi bi-arrow-clockwise"></i> تحديث
                        </button>
                    </div>
                    <div id="databaseInfo" class="storage-list">
                        <div style="text-align: center; padding: 20px; color: var(--text-light);">
                            <i class="bi bi-hourglass-split"></i> جاري التحميل...
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- نموذج إضافة مستخدم -->
        <div id="userModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="userModalTitle">إضافة مستخدم</h3>
                    <button onclick="closeUserModal()" class="btn-close">&times;</button>
                </div>
                <form id="userForm" onsubmit="saveUser(event)">
                    <div class="form-group">
                        <label for="userName">الاسم *</label>
                        <input type="text" id="userName" name="userName" required>
                    </div>

                    <div class="form-group">
                        <label for="userUsername">اسم المستخدم *</label>
                        <input type="text" id="userUsername" name="userUsername" required>
                    </div>

                    <div class="form-group">
                        <label for="userPassword">كلمة المرور *</label>
                        <input type="password" id="userPassword" name="userPassword" required>
                    </div>

                    <div class="form-group">
                        <label for="userRole">الدور *</label>
                        <select id="userRole" name="userRole" required onchange="toggleBranchField()">
                            <option value="employee">موظف</option>
                            <option value="technician">فني صيانة</option>
                            <option value="manager">مدير</option>
                            <option value="admin">مالك</option>
                        </select>
                    </div>

                    <div class="form-group" id="userBranchGroup">
                        <label for="userBranch">الفرع *</label>
                        <select id="userBranch" name="userBranch">
                            <option value="">اختر الفرع...</option>
                        </select>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeUserModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- نموذج تغيير كلمة المرور (منفصل) -->
        <div id="changePasswordModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="changePasswordModalTitle">تغيير كلمة المرور</h3>
                    <button onclick="closeChangePasswordModal()" class="btn-close">&times;</button>
                </div>
                <form id="changePasswordForm" onsubmit="savePasswordChange(event)">
                    <div class="form-group">
                        <label for="newPassword">كلمة المرور الجديدة *</label>
                        <input type="password" id="newPassword" name="newPassword" required minlength="6" autocomplete="new-password">
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeChangePasswordModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

            // ✅ تصدير الوظائف إلى window مباشرة بعد تحميل HTML
            // ✅ دوال النسخ الاحتياطي من قاعدة البيانات
            if (typeof window !== 'undefined') {
                window.loadBackupInfo = loadBackupInfo;
                window.loadBackupFiles = loadBackupFiles;
                window.createDatabaseBackup = createDatabaseBackup;
                window.restoreDatabaseBackup = restoreDatabaseBackup;
                window.deleteDatabaseBackup = deleteDatabaseBackup;
                window.downloadBackupFile = downloadBackupFile;
                console.log('✅ [Settings] تم تصدير وظائف النسخ الاحتياطي إلى window');
            }

            // تحميل البيانات بشكل آمن مع معالجة الأخطاء
            // تأخير بسيط لضمان أن DOM جاهز
            setTimeout(() => {
                // ✅ التحقق من وجود العناصر المطلوبة قبل تحميل البيانات
                const usersTableBody = document.getElementById('usersTableBody');
                if (!usersTableBody) {
                    // العنصر غير موجود - قد يكون في قسم آخر، لا نعرض تحذير
                    // إعادة المحاولة بعد تأخير إضافي
                    setTimeout(() => {
                        const retryTableBody = document.getElementById('usersTableBody');
                        if (retryTableBody) {
                            loadUsers().catch(err => {
                                console.error('خطأ في تحميل المستخدمين بعد إعادة المحاولة:', err);
                                const errorMsg = err?.message || err?.toString() || 'خطأ غير معروف';
                                if (typeof showMessage === 'function') {
                                    showMessage('خطأ في تحميل قائمة المستخدمين: ' + errorMsg, 'error');
                                }
                            });
                        }
                    }, 300);
                }
                
                // تهيئة إدارة التخزين
                initStorageManagement();
                
                Promise.allSettled([
                    loadSettings().catch(err => {
                        // ✅ loadSettings الآن لا ترمي خطأ، لكن نتعامل مع أي أخطاء غير متوقعة
                        console.error('خطأ غير متوقع في تحميل الإعدادات:', err);
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    }),
                    usersTableBody ? loadUsers().catch(err => {
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
                    }) : Promise.resolve(null),
                    Promise.resolve().then(() => {
                        try {
                            return loadSyncFrequency();
                        } catch (err) {
                            console.error('خطأ في تحميل تردد المزامنة:', err);
                            console.error('تفاصيل الخطأ:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                            return null;
                        }
                    }),
                    loadBackupInfo().catch(err => {
                        console.error('خطأ في تحميل معلومات النسخ الاحتياطية:', err);
                        console.error('تفاصيل الخطأ:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
                        return null;
                    }),
                    loadBackupFiles().catch(err => {
                        console.error('خطأ في تحميل قائمة النسخ الاحتياطية:', err);
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
        const status = await API.getDatabaseBackupStatus();
        if (status.success) {
            const backupStatus = status.data;
            
            // تحديث عرض الحالة
            const statusElement = document.getElementById('backupStatusDisplay');
            const lastBackupElement = document.getElementById('lastBackupDisplay');
            const nextBackupElement = document.getElementById('nextBackupDisplay');
            const backupCountElement = document.getElementById('backupCountDisplay');
            const backupSizeElement = document.getElementById('backupSizeDisplay');
            
            if (statusElement) {
                statusElement.textContent = backupStatus.enabled ? 'مفعّل' : 'معطّل';
                statusElement.className = `info-value ${backupStatus.enabled ? 'enabled' : 'disabled'}`;
            }
            
            if (lastBackupElement) {
                if (backupStatus.last_backup && backupStatus.last_backup.date) {
                    lastBackupElement.textContent = formatDateTime(backupStatus.last_backup.date);
                } else {
                    lastBackupElement.textContent = 'لم يتم إنشاء نسخة احتياطية';
                }
            }
            
            if (nextBackupElement) {
                if (backupStatus.next_backup_time) {
                    if (backupStatus.hours_remaining && backupStatus.hours_remaining > 0) {
                        nextBackupElement.textContent = `${formatDateTime(backupStatus.next_backup_time)} (متبقي: ${backupStatus.hours_remaining.toFixed(1)} ساعة)`;
                    } else {
                        nextBackupElement.textContent = 'جاهز الآن';
                    }
                } else {
                    nextBackupElement.textContent = 'غير محدد';
                }
            }
            
            if (backupCountElement) {
                backupCountElement.textContent = backupStatus.backup_count || 0;
            }
            
            if (backupSizeElement) {
                backupSizeElement.textContent = `${backupStatus.total_size_mb || 0} MB`;
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

// ✅ تحميل قائمة ملفات النسخ الاحتياطية
async function loadBackupFiles() {
    try {
        const listElement = document.getElementById('backupFilesList');
        if (!listElement) return;
        
        listElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        
        const result = await API.listDatabaseBackups();
        
        if (!result || !result.success) {
            listElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> ${result?.message || 'خطأ في تحميل القائمة'}</div>`;
            return;
        }
        
        const backups = result.data || [];
        
        if (backups.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد نسخ احتياطية محفوظة</div>';
            return;
        }
        
        let html = '<div class="backup-files-list">';
        
        backups.forEach((backup, index) => {
            html += `
                <div class="backup-file-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 10px; background: var(--white); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                            <i class="bi bi-file-earmark-code" style="color: var(--primary-color); font-size: 1.2em;"></i>
                            <strong style="color: var(--text-dark);">${escapeHtml(backup.filename)}</strong>
                        </div>
                        <div style="display: flex; gap: 15px; font-size: 0.9em; color: var(--text-light); margin-top: 5px;">
                            <span><i class="bi bi-calendar"></i> ${formatDateTime(backup.date)}</span>
                            <span><i class="bi bi-hdd"></i> ${backup.size_mb} MB</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="restoreDatabaseBackup('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-warning" title="استعادة">
                            <i class="bi bi-arrow-counterclockwise"></i> استعادة
                        </button>
                        <button onclick="downloadBackupFile('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-secondary" title="تحميل">
                            <i class="bi bi-download"></i> تحميل
                        </button>
                        <button onclick="deleteDatabaseBackup('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-danger" title="حذف">
                            <i class="bi bi-trash"></i> حذف
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        listElement.innerHTML = html;
    } catch (error) {
        console.error('خطأ في تحميل قائمة النسخ الاحتياطية:', error);
        const listElement = document.getElementById('backupFilesList');
        if (listElement) {
            listElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> خطأ في تحميل القائمة</div>`;
        }
    }
}

// ✅ إنشاء نسخة احتياطية يدوياً
async function createDatabaseBackup() {
    try {
        const btn = document.getElementById('createBackupBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإنشاء...';
        }
        
        showMessage('جاري إنشاء النسخة الاحتياطية...', 'info');
        
        const result = await API.createDatabaseBackup();
        
        if (result && result.success) {
            showMessage('تم إنشاء النسخة الاحتياطية بنجاح', 'success');
            
            // تحديث المعلومات والقائمة
            await Promise.all([
                loadBackupInfo(),
                loadBackupFiles()
            ]);
        } else {
            showMessage(result?.message || 'فشل إنشاء النسخة الاحتياطية', 'error');
        }
    } catch (error) {
        console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
        showMessage('حدث خطأ أثناء إنشاء النسخة الاحتياطية: ' + (error.message || 'خطأ غير معروف'), 'error');
    } finally {
        const btn = document.getElementById('createBackupBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-download"></i> إنشاء نسخة احتياطية الآن';
        }
    }
}

// ✅ استعادة نسخة احتياطية
async function restoreDatabaseBackup(filename) {
    try {
        if (!filename) {
            showMessage('اسم الملف غير صحيح', 'error');
            return;
        }
        
        const confirmMessage = `⚠️ تحذير: سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية!\n\nالملف: ${filename}\n\nهل أنت متأكد تماماً من الاستعادة؟\n\nهذا الإجراء لا يمكن التراجع عنه!`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // تأكيد إضافي
        const finalConfirm = confirm('⚠️ تحذير نهائي!\n\nسيتم حذف جميع البيانات الحالية واستبدالها بالنسخة الاحتياطية.\n\nهل أنت متأكد 100%؟');
        
        if (!finalConfirm) {
            return;
        }
        
        showMessage('جاري استعادة النسخة الاحتياطية...', 'info');
        
        const result = await API.restoreDatabaseBackup(filename);
        
        if (result && result.success) {
            showMessage('تم استعادة النسخة الاحتياطية بنجاح. سيتم إعادة تحميل الصفحة...', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showMessage(result?.message || 'فشل استعادة النسخة الاحتياطية', 'error');
        }
    } catch (error) {
        console.error('خطأ في استعادة النسخة الاحتياطية:', error);
        showMessage('حدث خطأ أثناء استعادة النسخة الاحتياطية: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ حذف نسخة احتياطية
async function deleteDatabaseBackup(filename) {
    try {
        if (!filename) {
            showMessage('اسم الملف غير صحيح', 'error');
            return;
        }
        
        if (!confirm(`⚠️ هل أنت متأكد من حذف النسخة الاحتياطية:\n${filename}?`)) {
            return;
        }
        
        const result = await API.deleteDatabaseBackup(filename);
        
        if (result && result.success) {
            showMessage('تم حذف النسخة الاحتياطية بنجاح', 'success');
            await loadBackupFiles();
            await loadBackupInfo();
        } else {
            showMessage(result?.message || 'فشل حذف النسخة الاحتياطية', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف النسخة الاحتياطية:', error);
        showMessage('حدث خطأ أثناء حذف النسخة الاحتياطية: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ تحميل ملف نسخة احتياطية
function downloadBackupFile(filename) {
    try {
        if (!filename) {
            showMessage('اسم الملف غير صحيح', 'error');
            return;
        }
        
        // ✅ إنشاء رابط تحميل
        const downloadUrl = `api/database-backup.php?action=download&filename=${encodeURIComponent(filename)}`;
        
        // ✅ فتح في نافذة جديدة للتحميل
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('جاري تحميل الملف...', 'info');
    } catch (error) {
        console.error('خطأ في تحميل الملف:', error);
        showMessage('حدث خطأ أثناء تحميل الملف', 'error');
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

async function loadSettings(forceRefresh = false) {
    try {
        // ✅ إذا كان forceRefresh، نستخدم API.request مباشرة مع skipCache و timestamp
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`settings.php?_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            result = await API.getSettings();
        }
        
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
                currency: 'ريال',
                whatsapp_number: '',
                shop_name_2: '',
                shop_phone_2: '',
                shop_address_2: '',
                currency_2: 'ريال',
                whatsapp_number_2: ''
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
                currency: 'ريال',
                whatsapp_number: '',
                shop_name_2: '',
                shop_phone_2: '',
                shop_address_2: '',
                currency_2: 'ريال',
                whatsapp_number_2: ''
            };
        }
        
        displaySettings(currentSettings);
    } catch (error) {
        // طباعة الخطأ الحقيقي بدلاً من Object
        console.error('خطأ في loadSettings:', error);
        console.error('نوع الخطأ:', error?.name || 'Unknown');
        console.error('رسالة الخطأ:', error?.message || 'No message');
        console.error('تفاصيل الخطأ الكاملة:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // ✅ استخدام إعدادات افتراضية بدلاً من رمي الخطأ
        // هذا يضمن أن الواجهة تعمل حتى لو فشل تحميل الإعدادات
        console.warn('⚠️ استخدام إعدادات افتراضية بسبب خطأ في التحميل');
        currentSettings = {
            shop_name: '',
            shop_phone: '',
            shop_address: '',
            currency: 'ريال',
            whatsapp_number: '',
            shop_name_2: '',
            shop_phone_2: '',
            shop_address_2: '',
            currency_2: 'ريال',
            whatsapp_number_2: ''
        };
        
        // عرض الإعدادات الافتراضية
        try {
            displaySettings(currentSettings);
        } catch (displayError) {
            console.error('خطأ في عرض الإعدادات الافتراضية:', displayError);
        }
        
        // إظهار رسالة تحذير للمستخدم
        if (typeof showMessage === 'function') {
            const errorMsg = error?.message || 'خطأ غير معروف';
            showMessage('تم تحميل الإعدادات بإعدادات افتراضية. ' + errorMsg, 'warning');
        }
        
        // لا نرمي الخطأ - نسمح للصفحة بالاستمرار
        // throw error;
    }
}

function displaySettings(settings) {
    if (!settings) {
        console.warn('displaySettings: settings is null or undefined - استخدام إعدادات افتراضية');
        settings = {
            shop_name: '',
            shop_phone: '',
            shop_address: '',
            currency: 'ريال',
            whatsapp_number: '',
            shop_name_2: '',
            shop_phone_2: '',
            shop_address_2: '',
            currency_2: 'ريال',
            whatsapp_number_2: ''
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
    
    // الفرع الأول
    const shopName1 = document.getElementById('shopName1');
    const shopPhone1 = document.getElementById('shopPhone1');
    const shopAddress1 = document.getElementById('shopAddress1');
    const currency1 = document.getElementById('currency1');
    const whatsappNumber1 = document.getElementById('whatsappNumber1');
    
    if (shopName1) shopName1.value = settings.shop_name || settings.shop_name_1 || '';
    if (shopPhone1) shopPhone1.value = settings.shop_phone || settings.shop_phone_1 || '';
    if (shopAddress1) shopAddress1.value = settings.shop_address || settings.shop_address_1 || '';
    if (currency1) currency1.value = settings.currency || settings.currency_1 || 'ريال';
    if (whatsappNumber1) whatsappNumber1.value = settings.whatsapp_number || settings.whatsapp_number_1 || '';
    
    // الفرع الثاني
    const shopName2 = document.getElementById('shopName2');
    const shopPhone2 = document.getElementById('shopPhone2');
    const shopAddress2 = document.getElementById('shopAddress2');
    const currency2 = document.getElementById('currency2');
    const whatsappNumber2 = document.getElementById('whatsappNumber2');
    
    if (shopName2) shopName2.value = settings.shop_name_2 || '';
    if (shopPhone2) shopPhone2.value = settings.shop_phone_2 || '';
    if (shopAddress2) shopAddress2.value = settings.shop_address_2 || '';
    if (currency2) currency2.value = settings.currency_2 || 'ريال';
    if (whatsappNumber2) whatsappNumber2.value = settings.whatsapp_number_2 || '';
    
    // إعدادات صفحة التحميل
    const loadingPageEnabled = document.getElementById('loadingPageEnabled');
    if (loadingPageEnabled) {
        const enabled = settings.loading_page_enabled;
        loadingPageEnabled.checked = enabled === '1' || enabled === true || enabled === 'true';
    }
}

// دالة التبديل بين الفروع
function switchBranchTab(branchNumber) {
    try {
        // إخفاء جميع النماذج
        const allForms = document.querySelectorAll('.branch-form');
        allForms.forEach(form => {
            form.classList.remove('active');
        });
        
        // إزالة active من جميع التبويبات
        const allTabs = document.querySelectorAll('.branch-tab');
        allTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // إظهار النموذج المحدد
        const targetForm = document.querySelector(`.branch-form[data-branch="${branchNumber}"]`);
        if (targetForm) {
            targetForm.classList.add('active');
        }
        
        // تفعيل التبويب المحدد
        const targetTab = document.querySelector(`.branch-tab:nth-child(${branchNumber})`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    } catch (error) {
        console.error('خطأ في switchBranchTab:', error);
    }
}

async function saveShopSettings(event, branchNumber = 1) {
    event.preventDefault();

    try {
        let settingsData = {};
        
        if (branchNumber === 1) {
            // حفظ بيانات الفرع الأول
            settingsData = {
                shop_name: document.getElementById('shopName1')?.value || '',
                shop_phone: document.getElementById('shopPhone1')?.value || '',
                shop_address: document.getElementById('shopAddress1')?.value || '',
                currency: document.getElementById('currency1')?.value || 'ريال',
                whatsapp_number: document.getElementById('whatsappNumber1')?.value || ''
            };
        } else if (branchNumber === 2) {
            // حفظ بيانات الفرع الثاني
            settingsData = {
                shop_name_2: document.getElementById('shopName2')?.value || '',
                shop_phone_2: document.getElementById('shopPhone2')?.value || '',
                shop_address_2: document.getElementById('shopAddress2')?.value || '',
                currency_2: document.getElementById('currency2')?.value || 'ريال',
                whatsapp_number_2: document.getElementById('whatsappNumber2')?.value || ''
            };
        }

    const result = await API.updateSettings(settingsData);
    if (result.success) {
            showMessage(`تم حفظ بيانات الفرع ${branchNumber === 1 ? 'الأول' : 'الثاني'} بنجاح`);
        currentSettings = result.data;
        
        // ✅ إجبار إعادة تحميل الإعدادات من الخادم لإظهار التعديلات فوراً
        await loadSettings(true); // forceRefresh = true
    } else {
            showMessage(result.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
        }
    } catch (error) {
        console.error('خطأ في saveShopSettings:', error);
        showMessage('حدث خطأ أثناء حفظ الإعدادات: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}


async function loadUsers(forceRefresh = false) {
    try {
        // التحقق من وجود العنصر قبل محاولة التحميل
        let tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            // العنصر غير موجود - قد يكون في قسم آخر، لا نعرض تحذير
            // إعادة المحاولة عدة مرات مع تأخير متزايد
            let retries = 0;
            const maxRetries = 5;
            const checkElement = () => {
                tbody = document.getElementById('usersTableBody');
                if (tbody) {
                    // العنصر موجود الآن، استمر في التحميل
                    loadUsers(forceRefresh).catch(err => {
                        console.error('خطأ في تحميل المستخدمين بعد العثور على العنصر:', err);
                    });
                } else if (retries < maxRetries) {
                    retries++;
                    setTimeout(checkElement, 200 * retries); // تأخير متزايد
                } else {
                    // العنصر غير موجود بعد عدة محاولات - قد يكون المستخدم في قسم آخر
                    // لا نعرض رسالة خطأ لأن هذا قد يكون سلوكاً طبيعياً
                    return;
                }
            };
            checkElement();
            return;
        }
        
        // ✅ إذا كان forceRefresh، نستخدم API.request مباشرة مع skipCache و timestamp
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`users.php?_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            result = await API.getUsers();
        }
        
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
        
        // إعادة تعيين الصفحة الحالية
        usersCurrentPage = 1;
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

// متغيرات pagination
let usersCurrentPage = 1;
let invoicesCurrentPage = 1;
let imagesCurrentPage = 1;
const itemsPerPage = 5;

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const paginationContainer = document.getElementById('usersPagination');
    
    // التحقق من وجود العنصر قبل التعديل
    if (!tbody) {
        // العنصر غير موجود - قد يكون المستخدم في قسم آخر، لا نعرض خطأ
        return;
    }
    
    // التحقق من صحة البيانات قبل الاستخدام
    if (!users) {
        console.error('displayUsers: users is null or undefined');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">خطأ: البيانات غير متوفرة</td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    if (!Array.isArray(users)) {
        console.error('displayUsers: users is not an array:', typeof users, users);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">خطأ في تنسيق البيانات</td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد مستخدمين</td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color);">لا توجد بيانات صحيحة للعرض</td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // تطبيق pagination
    const paginated = paginate(validUsers, usersCurrentPage, itemsPerPage);

    // دالة مساعدة للحصول على نص الدور
    const getRoleTextFunc = typeof getRoleText === 'function' ? getRoleText : (role) => {
        const roles = {
            'admin': 'مالك',
            'manager': 'مدير',
            'technician': 'فني صيانة',
            'employee': 'موظف'
        };
        return roles[role] || role || 'غير محدد';
    };
    
    // ✅ استخدام DocumentFragment لتحسين الأداء
    const fragment = document.createDocumentFragment();
    
    // ✅ التحقق من صلاحية المالك (admin) لعرض زر التعديل
    const isOwner = typeof hasPermission === 'function' ? hasPermission('admin') : false;
    
    paginated.data.forEach(user => {
        // ✅ استخدام القيم الأصلية (قبل escapeHtml) لـ data-* attributes
        const userIdRaw = String(user.id || '');
        const usernameRaw = String(user.username || '');
        const nameRaw = String(user.name || '');
        const roleRaw = String(user.role || 'employee');
        const branchIdRaw = user.branch_id ? String(user.branch_id) : '';
        
        // ✅ استخدام escapeHtml فقط للعرض في HTML (ليس في data-* attributes)
        const userId = escapeHtml(userIdRaw);
        const username = escapeHtml(usernameRaw);
        const name = escapeHtml(nameRaw);
        const role = escapeHtml(roleRaw);
        const branchName = escapeHtml(String(user.branch_name || ''));
        
        // ✅ استخدام data-* attributes بدلاً من onclick مباشرة (أكثر أماناً وأداءً)
        const tr = document.createElement('tr');
        
        // ✅ بناء أزرار الإجراءات - زر التعديل يظهر فقط للمالك
        let actionsHTML = '';
        if (isOwner) {
            actionsHTML = `
                <button 
                    class="btn btn-sm btn-icon edit-user-btn" 
                    title="تعديل"
                    data-user-id="${userIdRaw}"
                    style="margin-left: 5px;"
                >
                    <i class="bi bi-pencil"></i>
                </button>
            `;
        }
        actionsHTML += `
            <button 
                class="btn btn-sm btn-icon delete-user-btn" 
                title="حذف"
                data-user-id="${userIdRaw}"
            >
                <i class="bi bi-trash3"></i>
            </button>
        `;
        
        // ✅ بناء الخلايا القابلة للتعديل (للمالك فقط)
        let usernameCell, nameCell, roleCell, branchCell;
        
        if (isOwner) {
            // اسم المستخدم - قابل للتعديل
            usernameCell = `<td class="editable-cell" data-field="username" data-user-id="${userIdRaw}" data-value="${usernameRaw}" style="cursor: pointer; position: relative;">
                <span class="cell-content">${username}</span>
            </td>`;
            
            // الاسم - قابل للتعديل
            nameCell = `<td class="editable-cell" data-field="name" data-user-id="${userIdRaw}" data-value="${nameRaw}" style="cursor: pointer; position: relative;">
                <span class="cell-content">${name}</span>
            </td>`;
            
            // الدور - غير قابل للتعديل (ممنوع تغييره)
            roleCell = `<td style="cursor: default;">
                <span>${getRoleTextFunc(roleRaw)}</span>
            </td>`;
            
            // الفرع - قابل للتعديل (dropdown)
            branchCell = `<td class="editable-cell" data-field="branch_id" data-user-id="${userIdRaw}" data-value="${branchIdRaw}" style="cursor: pointer; position: relative;">
                <span class="cell-content">${branchName || (roleRaw === 'admin' ? 'كل الفروع' : 'غير محدد')}</span>
            </td>`;
        } else {
            // للمستخدمين غير المالكين - عرض عادي
            usernameCell = `<td>${username}</td>`;
            nameCell = `<td>${name}</td>`;
            roleCell = `<td>${getRoleTextFunc(roleRaw)}</td>`;
            branchCell = `<td>${branchName || (roleRaw === 'admin' ? 'كل الفروع' : 'غير محدد')}</td>`;
        }
        
        tr.innerHTML = `
            ${usernameCell}
            ${nameCell}
            ${roleCell}
            ${branchCell}
            <td>
                ${actionsHTML}
            </td>
        `;
        fragment.appendChild(tr);
    });
    
    // ✅ مسح المحتوى القديم وإضافة الجديد دفعة واحدة
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // ✅ إضافة event listeners باستخدام event delegation
    setupUsersTableEventListeners();
    
    // إضافة pagination buttons
    if (paginationContainer && typeof createPaginationButtons === 'function') {
        createPaginationButtons(paginationContainer, paginated.totalPages, paginated.currentPage, (page) => {
            usersCurrentPage = page;
            displayUsers(users); // إعادة عرض مع الصفحة الجديدة
        });
    }
}

// ✅ إعداد event listeners لجدول المستخدمين باستخدام event delegation
function setupUsersTableEventListeners() {
    try {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            console.warn('usersTableBody not found, skipping event listeners setup');
            return;
        }
        
        // ✅ استخدام event delegation - إزالة listeners القديمة أولاً لتجنب التكرار
        const existingHandler = tbody._usersTableHandler;
        if (existingHandler) {
            tbody.removeEventListener('click', existingHandler);
        }
        
        // ✅ إنشاء handler جديد
        const clickHandler = async (event) => {
            try {
                // ✅ التحقق من النقر على خلية قابلة للتعديل
                const editableCell = event.target.closest('.editable-cell');
                if (editableCell && !editableCell.querySelector('input, select')) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const field = editableCell.getAttribute('data-field');
                    const userId = editableCell.getAttribute('data-user-id');
                    const currentValue = editableCell.getAttribute('data-value') || '';
                    
                    if (!field || !userId) return;
                    
                    // فتح حقل التعديل حسب نوع الحقل (الدور ممنوع)
                    if (field === 'branch_id') {
                        await showBranchDropdown(editableCell, userId, currentValue);
                    } else if (field === 'name' || field === 'username') {
                        showTextInput(editableCell, userId, field, currentValue);
                    }
                    return;
                }
                
                const target = event.target.closest('button');
                if (!target) return;
                
                // زر التعديل (تغيير كلمة المرور)
                if (target.classList.contains('edit-user-btn')) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const userId = target.getAttribute('data-user-id');
                    if (!userId) {
                        console.error('User ID not found in edit button');
                        showMessage('خطأ: معرف المستخدم غير موجود', 'error');
                        return;
                    }
                    
                    // استدعاء دالة تغيير كلمة المرور - النموذج المنفصل
                    await showChangePasswordModal(userId);
                    return;
                }
                
                // زر الحذف
                if (target.classList.contains('delete-user-btn')) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const userId = target.getAttribute('data-user-id');
                    if (!userId) {
                        console.error('User ID not found in delete button');
                        showMessage('خطأ: معرف المستخدم غير موجود', 'error');
                        return;
                    }
                    
                    // استدعاء دالة الحذف
                    await deleteUser(userId);
                    return;
                }
            } catch (error) {
                console.error('خطأ في معالجة حدث النقر على زر المستخدم:', error);
                showMessage('حدث خطأ أثناء تنفيذ العملية', 'error');
            }
        };
        
        // ✅ حفظ المرجع للـ handler لإمكانية إزالته لاحقاً
        tbody._usersTableHandler = clickHandler;
        
        // ✅ إضافة event listener
        tbody.addEventListener('click', clickHandler);
        
        console.log('✅ تم إعداد event listeners لجدول المستخدمين');
    } catch (error) {
        console.error('خطأ في إعداد event listeners لجدول المستخدمين:', error);
    }
}

// دالة مساعدة لتجنب XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ✅ دالة لعرض dropdown للدور
async function showRoleDropdown(cell, userId, currentValue) {
    try {
        const roles = [
            { value: 'employee', text: 'موظف' },
            { value: 'technician', text: 'فني صيانة' },
            { value: 'manager', text: 'مدير' },
            { value: 'admin', text: 'مالك' }
        ];
        
        const select = document.createElement('select');
        select.className = 'inline-edit-select';
        select.style.cssText = 'width: 100%; padding: 5px; border: 1px solid var(--primary-color); border-radius: 4px; background: var(--white);';
        
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.value;
            option.textContent = role.text;
            if (role.value === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        const cellContent = cell.querySelector('.cell-content');
        if (cellContent) {
            cellContent.style.display = 'none';
        }
        cell.innerHTML = '';
        cell.appendChild(select);
        select.focus();
        
        // حفظ عند تغيير القيمة
        const saveHandler = async () => {
            const newValue = select.value;
            if (newValue !== currentValue) {
                await saveUserField(userId, 'role', newValue, cell);
            } else {
                cancelEdit(cell, cellContent?.textContent || '');
            }
        };
        
        // حفظ عند الضغط على Enter أو فقدان التركيز
        select.addEventListener('change', saveHandler);
        select.addEventListener('blur', saveHandler);
        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveHandler();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit(cell, cellContent?.textContent || '');
            }
        });
    } catch (error) {
        console.error('خطأ في showRoleDropdown:', error);
        showMessage('حدث خطأ أثناء فتح قائمة الأدوار', 'error');
    }
}

// ✅ دالة لعرض dropdown للفرع
async function showBranchDropdown(cell, userId, currentValue) {
    try {
        // جلب الفروع
        const result = await API.request('branches.php', 'GET', null, { skipCache: true });
        
        if (!result || !result.success || !result.data || !Array.isArray(result.data)) {
            showMessage('فشل تحميل قائمة الفروع', 'error');
            return;
        }
        
        const select = document.createElement('select');
        select.className = 'inline-edit-select';
        select.style.cssText = 'width: 100%; padding: 5px; border: 1px solid var(--primary-color); border-radius: 4px; background: var(--white);';
        
        // إضافة خيار "لا فرع"
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'لا فرع';
        if (!currentValue) {
            emptyOption.selected = true;
        }
        select.appendChild(emptyOption);
        
        result.data.forEach(branch => {
            if (branch && branch.id && branch.name) {
                const option = document.createElement('option');
                option.value = String(branch.id);
                option.textContent = String(branch.name);
                if (String(branch.id) === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
        
        const cellContent = cell.querySelector('.cell-content');
        if (cellContent) {
            cellContent.style.display = 'none';
        }
        cell.innerHTML = '';
        cell.appendChild(select);
        select.focus();
        
        // حفظ عند تغيير القيمة
        const saveHandler = async () => {
            const newValue = select.value;
            if (newValue !== currentValue) {
                await saveUserField(userId, 'branch_id', newValue || null, cell);
            } else {
                cancelEdit(cell, cellContent?.textContent || '');
            }
        };
        
        // حفظ عند الضغط على Enter أو فقدان التركيز
        select.addEventListener('change', saveHandler);
        select.addEventListener('blur', saveHandler);
        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveHandler();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit(cell, cellContent?.textContent || '');
            }
        });
    } catch (error) {
        console.error('خطأ في showBranchDropdown:', error);
        showMessage('حدث خطأ أثناء فتح قائمة الفروع', 'error');
    }
}

// ✅ دالة لعرض حقل إدخال نص
function showTextInput(cell, userId, field, currentValue) {
    try {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.value = currentValue;
        input.style.cssText = 'width: 100%; padding: 5px; border: 1px solid var(--primary-color); border-radius: 4px; background: var(--white);';
        
        const cellContent = cell.querySelector('.cell-content');
        if (cellContent) {
            cellContent.style.display = 'none';
        }
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // حفظ عند الضغط على Enter أو فقدان التركيز
        const saveHandler = async () => {
            const newValue = input.value.trim();
            if (newValue !== currentValue && newValue.length > 0) {
                // التحقق من صحة اسم المستخدم
                if (field === 'username') {
                    const usernameRegex = /^[a-zA-Z0-9_]+$/;
                    if (!usernameRegex.test(newValue)) {
                        showMessage('اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام وشرطة سفلية (_) فقط', 'error');
                        input.focus();
                        return;
                    }
                    if (newValue.length < 3) {
                        showMessage('اسم المستخدم يجب أن يكون على الأقل 3 أحرف', 'error');
                        input.focus();
                        return;
                    }
                }
                
                if (field === 'name' && newValue.length < 2) {
                    showMessage('الاسم يجب أن يكون على الأقل حرفين', 'error');
                    input.focus();
                    return;
                }
                
                await saveUserField(userId, field, newValue, cell);
            } else {
                cancelEdit(cell, cellContent?.textContent || '');
            }
        };
        
        input.addEventListener('blur', saveHandler);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveHandler();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit(cell, cellContent?.textContent || '');
            }
        });
    } catch (error) {
        console.error('خطأ في showTextInput:', error);
        showMessage('حدث خطأ أثناء فتح حقل الإدخال', 'error');
    }
}

// ✅ دالة لحفظ حقل المستخدم
async function saveUserField(userId, field, value, cell) {
    try {
        const updateData = { [field]: value };
        
        console.log('💾 حفظ حقل المستخدم:', { userId, field, value, updateData });
        
        const result = await API.updateUser(userId, updateData);
        
        console.log('📥 نتيجة التحديث:', result);
        
        if (result && result.success) {
            showMessage('تم تحديث البيانات بنجاح', 'success');
            
            // ✅ إعادة جلب بيانات المستخدم المحدثة من API
            const userResult = await API.getUser(userId);
            
            if (userResult && userResult.success && userResult.data) {
                const updatedUser = userResult.data;
                
                // ✅ التحقق من أن المستخدم المحدث هو المستخدم الحالي (المسجل دخول)
                let currentUser = null;
                try {
                    if (typeof getCurrentUser === 'function') {
                        currentUser = getCurrentUser();
                    } else {
                        // محاولة قراءة من localStorage مباشرة
                        const userStr = localStorage.getItem('currentUser');
                        if (userStr) {
                            currentUser = JSON.parse(userStr);
                        }
                    }
                } catch (e) {
                    console.error('خطأ في قراءة المستخدم الحالي:', e);
                }
                
                const isCurrentUser = currentUser && currentUser.id === userId;
                
                if (isCurrentUser) {
                    console.log('🔄 المستخدم المحدث هو المستخدم الحالي - تحديث البيانات والصلاحيات');
                    
                    // ✅ تحديث بيانات المستخدم في localStorage
                    const updatedUserData = {
                        ...currentUser,
                        ...updatedUser
                    };
                    
                    // ✅ إذا تم تغيير الفرع، جلب branch_code و branch_name من الفروع
                    if (field === 'branch_id') {
                        try {
                            if (updatedUser.branch_id) {
                                // جلب branch_code و branch_name للفرع الجديد
                                const branchesResult = await API.request('branches.php', 'GET', null, { skipCache: true });
                                if (branchesResult && branchesResult.success && branchesResult.data) {
                                    const branch = branchesResult.data.find(b => String(b.id) === String(updatedUser.branch_id));
                                    if (branch) {
                                        if (branch.code) {
                                            updatedUserData.branch_code = branch.code;
                                            console.log('✅ تم تحديث branch_code:', branch.code);
                                        }
                                        // branch_name موجود في updatedUser من API، لكن نستخدم branch.name كبديل
                                        updatedUserData.branch_name = updatedUser.branch_name || branch.name || '';
                                        console.log('✅ تم تحديث branch_name:', updatedUserData.branch_name);
                                    } else {
                                        // إذا لم يتم العثور على الفرع، إزالة branch_code و branch_name
                                        delete updatedUserData.branch_code;
                                        updatedUserData.branch_name = '';
                                        console.log('⚠️ لم يتم العثور على الفرع:', updatedUser.branch_id);
                                    }
                                }
                            } else {
                                // إذا تم حذف الفرع (null)، إزالة branch_code و branch_name
                                delete updatedUserData.branch_code;
                                updatedUserData.branch_name = '';
                                console.log('✅ تم إزالة branch_code و branch_name (لا فرع)');
                            }
                        } catch (e) {
                            console.warn('لم يتم جلب بيانات الفرع:', e);
                            // استخدام البيانات من API كبديل
                            if (updatedUser.branch_name) {
                                updatedUserData.branch_name = updatedUser.branch_name;
                            }
                        }
                    } else {
                        // ✅ إذا تم تغيير الاسم أو اسم المستخدم، تحديثهما مباشرة
                        if (field === 'name' && updatedUser.name) {
                            updatedUserData.name = updatedUser.name;
                        }
                        if (field === 'username' && updatedUser.username) {
                            updatedUserData.username = updatedUser.username;
                        }
                    }
                    
                    // ✅ تحديث localStorage بالبيانات المحدثة
                    localStorage.setItem('currentUser', JSON.stringify(updatedUserData));
                    
                    console.log('✅ تم تحديث localStorage:', {
                        id: updatedUserData.id,
                        name: updatedUserData.name,
                        username: updatedUserData.username,
                        branch_id: updatedUserData.branch_id,
                        branch_name: updatedUserData.branch_name,
                        branch_code: updatedUserData.branch_code
                    });
                    
                    // ✅ التحقق من أن البيانات تم حفظها بشكل صحيح
                    const verifyUser = getCurrentUser();
                    console.log('🔍 التحقق من البيانات المحفوظة:', {
                        name: verifyUser?.name,
                        branch_name: verifyUser?.branch_name,
                        branch_id: verifyUser?.branch_id
                    });
                    
                    // ✅ تحديث الشريط الجانبي - استدعاء فوري بعد تحديث localStorage
                    // استخدام setTimeout متعدد لضمان تحديث DOM
                    setTimeout(() => {
                        if (typeof displayUserInfo === 'function') {
                            displayUserInfo();
                            console.log('✅ تم استدعاء displayUserInfo() لتحديث الشريط الجانبي');
                            
                            // استدعاء إضافي بعد تأخير قصير للتأكد
                            setTimeout(() => {
                                if (typeof displayUserInfo === 'function') {
                                    displayUserInfo();
                                    console.log('✅ تم استدعاء displayUserInfo() مرة أخرى للتأكد');
                                }
                            }, 100);
                        } else {
                            console.error('❌ دالة displayUserInfo غير متوفرة');
                        }
                    }, 50);
                    
                    // ✅ تحديث الصلاحيات في الشريط الجانبي
                    if (typeof hideByPermission === 'function') {
                        await hideByPermission();
                    }
                    
                    // ✅ إعادة تحميل الأقسام المفتوحة لتحديث الأزرار والصلاحيات
                    // التحقق من القسم النشط الحالي
                    const activeSection = document.querySelector('.section.active, [id$="-section"].active');
                    const activeSectionId = activeSection?.id || '';
                    
                    // ✅ إعادة تحميل قسم المخزن إذا كان مفتوحاً
                    if (activeSectionId === 'inventory-section' || document.getElementById('inventory-section')?.classList.contains('active')) {
                        if (typeof loadInventorySection === 'function') {
                            console.log('🔄 إعادة تحميل قسم المخزن لتحديث الأزرار والصلاحيات');
                            try {
                                await loadInventorySection();
                            } catch (e) {
                                console.error('خطأ في إعادة تحميل قسم المخزن:', e);
                            }
                        }
                    }
                    
                    // ✅ إعادة تحميل قسم الصيانة إذا كان مفتوحاً
                    if (activeSectionId === 'repairs-section' || document.getElementById('repairs-section')?.classList.contains('active')) {
                        if (typeof loadRepairsSection === 'function') {
                            console.log('🔄 إعادة تحميل قسم الصيانة');
                            try {
                                await loadRepairsSection();
                            } catch (e) {
                                console.error('خطأ في إعادة تحميل قسم الصيانة:', e);
                            }
                        }
                    }
                    
                    // ✅ إعادة تحميل قسم العملاء إذا كان مفتوحاً
                    if (activeSectionId === 'customers-section' || document.getElementById('customers-section')?.classList.contains('active')) {
                        if (typeof loadCustomersSection === 'function') {
                            console.log('🔄 إعادة تحميل قسم العملاء');
                            try {
                                await loadCustomersSection();
                            } catch (e) {
                                console.error('خطأ في إعادة تحميل قسم العملاء:', e);
                            }
                        }
                    }
                    
                    // ✅ إعادة تحميل قسم المصروفات إذا كان مفتوحاً
                    if (activeSectionId === 'expenses-section' || document.getElementById('expenses-section')?.classList.contains('active')) {
                        if (typeof loadExpensesSection === 'function') {
                            console.log('🔄 إعادة تحميل قسم المصروفات');
                            try {
                                await loadExpensesSection();
                            } catch (e) {
                                console.error('خطأ في إعادة تحميل قسم المصروفات:', e);
                            }
                        }
                    }
                    
                    // ✅ إذا تم تغيير الفرع، إعادة تحميل جميع الأقسام التي تعتمد على الفرع
                    if (field === 'branch_id') {
                        console.log('🔄 تم تغيير الفرع - إعادة تحميل جميع الأقسام المعتمدة على الفرع');
                        
                        // إعادة تحميل المخزن دائماً (لأن الأزرار تعتمد على الفرع)
                        if (typeof loadInventorySection === 'function') {
                            try {
                                await loadInventorySection();
                            } catch (e) {
                                console.error('خطأ في إعادة تحميل قسم المخزن:', e);
                            }
                        }
                    }
                    
                    // ✅ مسح cache الفروع لإجبار إعادة الجلب
                    if (field === 'branch_id') {
                        localStorage.removeItem('branches_cache');
                        // مسح cache API
                        if (typeof API_CACHE !== 'undefined' && API_CACHE.clear) {
                            API_CACHE.clear();
                        }
                    }
                }
                
                // تحديث الخلية بالبيانات المحدثة
                let displayText = '';
                
                if (field === 'name') {
                    displayText = updatedUser.name || value;
                } else if (field === 'username') {
                    displayText = updatedUser.username || value;
                } else if (field === 'branch_id') {
                    displayText = updatedUser.branch_name || (value ? 'غير محدد' : 'لا فرع');
                }
                
                // تحديث الخلية
                cell.innerHTML = `<span class="cell-content">${escapeHtml(displayText)}</span>`;
                cell.setAttribute('data-value', value || '');
                
                console.log('✅ تم تحديث الخلية:', { field, displayText, value });
            } else {
                // إذا فشل جلب البيانات، استخدام القيمة المحدثة مباشرة
                let displayText = value;
                if (field === 'branch_id') {
                    displayText = value ? 'غير محدد' : 'لا فرع';
                }
                cell.innerHTML = `<span class="cell-content">${escapeHtml(displayText)}</span>`;
                cell.setAttribute('data-value', value || '');
            }
            
            // ✅ إعادة تحميل الجدول بالكامل لإظهار جميع التحديثات
            await loadUsers(true);
        } else {
            showMessage(result?.message || 'فشل تحديث البيانات', 'error');
            // إعادة تحميل الجدول لإعادة القيمة القديمة
            await loadUsers(true);
        }
    } catch (error) {
        console.error('خطأ في saveUserField:', error);
        showMessage('حدث خطأ أثناء حفظ التعديلات', 'error');
        // إعادة تحميل الجدول
        await loadUsers(true);
    }
}

// ✅ دالة لإلغاء التعديل
function cancelEdit(cell, originalText) {
    cell.innerHTML = `<span class="cell-content">${escapeHtml(originalText)}</span>`;
}

async function showAddUserModal() {
    try {
        // التحقق من الصلاحية
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لإضافة مستخدمين. يجب أن تكون مالك (admin) للوصول إلى هذه الميزة.', 'error');
            return;
        }
        
        const userModal = document.getElementById('userModal');
        if (!userModal) {
            console.error('userModal not found');
            showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }

        // الحصول على عناصر النموذج
        const form = document.getElementById('userForm');
        const titleElement = document.getElementById('userModalTitle');
        const nameField = document.getElementById('userName');
        const usernameField = document.getElementById('userUsername');
        const passwordField = document.getElementById('userPassword');
        const roleField = document.getElementById('userRole');

        if (!form || !titleElement || !nameField || !usernameField || !passwordField || !roleField) {
            showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }

        // تنظيف النموذج باستخدام form.reset()
        form.reset();
        
        // إزالة معرف التعديل إن وجد
        delete form.dataset.editUserId;
        
        // تعيين القيم الافتراضية بعد reset
        titleElement.textContent = 'إضافة مستخدم';
        roleField.value = 'employee';
        passwordField.required = true;
        
        // إظهار حقل كلمة المرور
        const passwordGroup = passwordField?.closest('.form-group');
        if (passwordGroup) {
            passwordGroup.style.display = 'block';
        }

        // تفعيل اسم المستخدم
        usernameField.disabled = false;

        // إظهار النموذج
        userModal.style.display = 'flex';

        // التحقق من وجود عنصر userBranch قبل تحميل الفروع
        const branchSelect = document.getElementById('userBranch');
        if (!branchSelect) {
            console.error('❌ [showAddUserModal] العنصر userBranch غير موجود في DOM');
            // محاولة انتظار قليلاً ثم إعادة المحاولة
            await new Promise(resolve => setTimeout(resolve, 100));
            const branchSelectRetry = document.getElementById('userBranch');
            if (!branchSelectRetry) {
                showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
                return;
            }
        }

        // تحميل الفروع
        await loadUserBranches(true);

        // إظهار/إخفاء حقل الفرع حسب الدور
        toggleBranchField();
        
        // التركيز على أول حقل
        setTimeout(() => {
            nameField.focus();
        }, 100);
    } catch (error) {
        console.error('خطأ في showAddUserModal:', error);
        showMessage('حدث خطأ أثناء فتح نموذج إضافة المستخدم: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ دالة لتعديل المستخدم - تستدعي نموذج تغيير كلمة المرور
async function showEditUserModal(userId) {
    try {
        // التحقق من الصلاحية
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لتعديل المستخدمين. يجب أن تكون مالك (admin) للوصول إلى هذه الميزة.', 'error');
            return;
        }
        
        if (!userId) {
            showMessage('خطأ: معرف المستخدم غير موجود', 'error');
            return;
        }
        
        // استدعاء نموذج تغيير كلمة المرور
        await showChangePasswordModal(userId);
    } catch (error) {
        console.error('خطأ في showEditUserModal:', error);
        showMessage('حدث خطأ أثناء فتح نموذج تعديل المستخدم: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ نموذج منفصل لتغيير كلمة المرور - يحتوي فقط على حقل كلمة المرور
async function showChangePasswordModal(userId) {
    try {
        // التحقق من الصلاحية
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لتعديل المستخدمين. يجب أن تكون مالك (admin) للوصول إلى هذه الميزة.', 'error');
            return;
        }
        
        if (!userId) {
            showMessage('خطأ: معرف المستخدم غير موجود', 'error');
            return;
        }
        
        const changePasswordModal = document.getElementById('changePasswordModal');
        if (!changePasswordModal) {
            console.error('changePasswordModal not found');
            showMessage('خطأ في تحميل نموذج تغيير كلمة المرور. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }

        const form = document.getElementById('changePasswordForm');
        const titleElement = document.getElementById('changePasswordModalTitle');
        const passwordField = document.getElementById('newPassword');

        if (!form || !titleElement || !passwordField) {
            showMessage('خطأ في تحميل نموذج تغيير كلمة المرور. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }

        // جلب بيانات المستخدم لعرض اسمه
        const result = await API.getUser(userId);
        if (!result || !result.success || !result.data) {
            showMessage(result?.message || 'فشل تحميل بيانات المستخدم', 'error');
            return;
        }

        const user = result.data;

        // تعيين عنوان النموذج
        titleElement.textContent = `تغيير كلمة مرور: ${user.name || user.username}`;
        
        // حفظ معرف المستخدم في النموذج
        form.dataset.userId = userId;
        
        // تنظيف حقل كلمة المرور
        passwordField.value = '';

        // إظهار النموذج
        changePasswordModal.style.display = 'flex';

        // التركيز على حقل كلمة المرور
        setTimeout(() => {
            passwordField.focus();
        }, 100);
    } catch (error) {
        console.error('خطأ في showChangePasswordModal:', error);
        showMessage('حدث خطأ أثناء فتح نموذج تغيير كلمة المرور: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

function closeChangePasswordModal() {
    try {
        const changePasswordModal = document.getElementById('changePasswordModal');
        if (changePasswordModal) {
            changePasswordModal.style.display = 'none';
            
            const form = document.getElementById('changePasswordForm');
            if (form) {
                form.reset();
                delete form.dataset.userId;
            }
        }
    } catch (error) {
        console.error('خطأ في closeChangePasswordModal:', error);
    }
}

async function savePasswordChange(event) {
    event.preventDefault();

    try {
        const form = document.getElementById('changePasswordForm');
        if (!form) {
            showMessage('خطأ: نموذج تغيير كلمة المرور غير موجود.', 'error');
            return;
        }

        const userId = form.dataset.userId;
        if (!userId) {
            showMessage('خطأ: معرف المستخدم غير موجود', 'error');
            return;
        }

        const passwordField = document.getElementById('newPassword');
        if (!passwordField) {
            showMessage('خطأ: حقل كلمة المرور غير موجود', 'error');
            return;
        }

        const password = passwordField.value.trim();

        // التحقق من كلمة المرور
        if (!password || password.length === 0) {
            showMessage('كلمة المرور الجديدة مطلوبة (يجب أن تكون على الأقل 6 أحرف)', 'error');
            passwordField.focus();
            passwordField.style.borderColor = 'var(--danger-color)';
            return;
        }

        if (password.length < 6) {
            showMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف', 'error');
            passwordField.focus();
            passwordField.style.borderColor = 'var(--danger-color)';
            return;
        }

        // إزالة علامة الخطأ
        passwordField.style.borderColor = '';

        // حفظ كلمة المرور
        const result = await API.updateUser(userId, { password: password });
        
        if (result && result.success) {
            showMessage('تم تغيير كلمة المرور بنجاح', 'success');
            closeChangePasswordModal();
        } else {
            showMessage(result?.message || 'فشل تغيير كلمة المرور', 'error');
        }
    } catch (error) {
        console.error('خطأ في savePasswordChange:', error);
        showMessage('حدث خطأ أثناء تغيير كلمة المرور: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

function closeUserModal() {
    try {
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.style.display = 'none';
            
            // تنظيف النموذج
            const form = document.getElementById('userForm');
            if (form) {
                form.reset();
            }
            
            // إعادة تعيين العنوان
            const titleElement = document.getElementById('userModalTitle');
            if (titleElement) {
                titleElement.textContent = 'إضافة مستخدم';
            }
            
            // إزالة علامات الخطأ
            const inputs = userModal.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.style.borderColor = '';
            });
        }
    } catch (error) {
        console.error('خطأ في closeUserModal:', error);
    }
}

async function saveUser(event) {
    event.preventDefault();

    try {
        // التحقق من وجود النموذج أولاً
        const userModal = document.getElementById('userModal');
        if (!userModal) {
            showMessage('خطأ: نموذج المستخدم غير موجود. يرجى الانتقال إلى قسم الإعدادات أولاً.', 'error');
            console.error('userModal not found');
            return;
        }

        // استخدام form.elements للوصول إلى الحقول مباشرة - هذا يتجنب تضارب IDs
        const userForm = document.getElementById('userForm');
        if (!userForm) {
            showMessage('خطأ: نموذج المستخدم غير موجود. يرجى إعادة تحميل الصفحة.', 'error');
            console.error('userForm not found');
            return;
        }

        // ✅ هذا النموذج للإضافة فقط - نموذج تغيير كلمة المرور منفصل
        // الحصول على جميع الحقول المطلوبة
        const nameElement = userForm.querySelector('#userName');
        const usernameElement = userForm.querySelector('#userUsername');
        const passwordElement = userForm.querySelector('#userPassword');
        const roleElement = userForm.querySelector('#userRole');

        if (!nameElement || !usernameElement || !passwordElement || !roleElement) {
            showMessage('خطأ في تحميل نموذج المستخدم. يرجى إعادة تحميل الصفحة.', 'error');
            console.error('Missing form elements:', {
                nameElement: !!nameElement,
                usernameElement: !!usernameElement,
                passwordElement: !!passwordElement,
                roleElement: !!roleElement
            });
            return;
        }
        
        // قراءة القيم مباشرة من الحقول - استخدام طريقة موثوقة
        const name = nameElement && nameElement.value !== undefined ? String(nameElement.value).trim() : '';
        const username = usernameElement && usernameElement.value !== undefined ? String(usernameElement.value).trim() : '';
        const password = passwordElement && passwordElement.value !== undefined ? String(passwordElement.value) : '';
        // ✅ قراءة الدور بشكل صحيح - التحقق من أن القيمة موجودة وليست فارغة
        const role = roleElement && roleElement.value !== undefined && roleElement.value !== '' 
            ? String(roleElement.value).trim() 
            : (roleElement && roleElement.selectedIndex >= 0 && roleElement.options[roleElement.selectedIndex] 
                ? String(roleElement.options[roleElement.selectedIndex].value).trim() 
                : 'employee');

        // التحقق من الحقول المطلوبة مع رسائل خطأ محددة وواضحة
        if (!name || name.trim().length === 0) {
            showMessage('يرجى إدخال اسم المستخدم (الاسم الكامل)', 'error');
            if (nameElement) {
                nameElement.focus();
                nameElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        if (name.trim().length < 2) {
            showMessage('الاسم يجب أن يكون على الأقل حرفين', 'error');
            if (nameElement) {
                nameElement.focus();
                nameElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        if (!username || username.trim().length === 0) {
            showMessage('يرجى إدخال اسم المستخدم (سيستخدم لتسجيل الدخول)', 'error');
            if (usernameElement) {
                usernameElement.focus();
                usernameElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        if (username.trim().length < 3) {
            showMessage('اسم المستخدم يجب أن يكون على الأقل 3 أحرف', 'error');
            if (usernameElement) {
                usernameElement.focus();
                usernameElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        // التحقق من صحة اسم المستخدم (حروف، أرقام، شرطة سفلية فقط)
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username.trim())) {
            showMessage('اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام وشرطة سفلية (_) فقط', 'error');
            if (usernameElement) {
                usernameElement.focus();
                usernameElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        if (!role || role.length === 0) {
            showMessage('يرجى اختيار دور المستخدم من القائمة', 'error');
            if (roleElement) {
                roleElement.focus();
                roleElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        // إزالة علامات الخطأ من الحقول
        if (nameElement) nameElement.style.borderColor = '';
        if (usernameElement) usernameElement.style.borderColor = '';
        if (roleElement) roleElement.style.borderColor = '';
        if (!password || password.trim().length === 0) {
            showMessage('كلمة المرور مطلوبة (يجب أن تكون على الأقل 6 أحرف)', 'error');
            if (passwordElement) {
                passwordElement.focus();
                passwordElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        // التحقق من طول كلمة المرور
        if (password && password.trim().length < 6) {
            showMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف', 'error');
            if (passwordElement) {
                passwordElement.focus();
                passwordElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        // ✅ التحقق من أن role ليس فارغاً قبل الإرسال
        const finalRole = role && role.trim() !== '' ? role.trim() : 'employee';
        
        // ✅ التحقق من أن الدور صحيح
        const validRoles = ['admin', 'manager', 'employee', 'technician'];
        if (!validRoles.includes(finalRole)) {
            console.error('❌ دور غير صحيح:', finalRole, 'القيم المتاحة:', validRoles);
            showMessage('الدور المحدد غير صحيح. يرجى اختيار دور صحيح من القائمة.', 'error');
            if (roleElement) {
                roleElement.focus();
                roleElement.style.borderColor = 'var(--danger-color)';
            }
            return;
        }
        
        // التحقق من أن جميع القيم موجودة قبل الإرسال
        console.log('📤 البيانات قبل الإرسال:', {
            name: name,
            nameLength: name.length,
            username: username,
            usernameLength: username.length,
            password: password ? '***' : '(empty)',
            passwordLength: password ? password.length : 0,
            role: role,
            finalRole: finalRole,
            roleLength: role.length
        });

        const branchId = userForm.querySelector('#userBranch')?.value || null;
        
        // ✅ بناء بيانات المستخدم للإضافة فقط
        const userData = {
            name: name.trim(),
            username: username.trim(),
            password: password.trim(),
            role: finalRole,
            branch_id: branchId || null
        };
        
        // التحقق من الفرع (مطلوب لجميع الأدوار عدا المالك)
        if (finalRole !== 'admin' && !branchId) {
            showMessage('يرجى اختيار الفرع المناسب (الفرع مطلوب لجميع الأدوار عدا المالك)', 'error');
            const branchField = userForm.querySelector('#userBranch');
            if (branchField) {
                branchField.focus();
                branchField.style.borderColor = 'var(--danger-color)';
            }
            return;
        }

        // ✅ إرسال طلب إضافة مستخدم جديد
        console.log('📤 إضافة مستخدم جديد:', { ...userData, password: '***' });
        const result = await API.addUser(userData);

        if (result && result.success) {
            showMessage(result.message || (isEditMode ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح'));
            closeUserModal();
            
            // ✅ إجبار إعادة تحميل المستخدمين من الخادم لإظهار التعديلات فوراً
            await loadUsers(true); // forceRefresh = true
        } else {
            // رسائل خطأ أكثر تفصيلاً بناءً على نوع الخطأ
            let errorMessage = result?.message || 'حدث خطأ أثناء حفظ المستخدم';
            
            // معالجة رسائل الخطأ من الخادم
            if (errorMessage.includes('موجود مسبقاً') || errorMessage.includes('username')) {
                errorMessage = 'اسم المستخدم موجود مسبقاً، يرجى اختيار اسم مستخدم آخر';
                if (usernameElement) {
                    usernameElement.focus();
                    usernameElement.style.borderColor = 'var(--danger-color)';
                }
            } else if (errorMessage.includes('الفرع')) {
                errorMessage = 'الفرع المحدد غير موجود أو غير صحيح، يرجى اختيار فرع آخر';
            } else if (errorMessage.includes('الدور')) {
                errorMessage = 'الدور المحدد غير صحيح، يرجى اختيار دور صحيح';
            } else if (errorMessage.includes('مطلوب') || errorMessage.includes('required')) {
                errorMessage = 'جميع الحقول المطلوبة يجب ملؤها بشكل صحيح';
            }
            
            showMessage(errorMessage, 'error');
            console.error('Error saving user:', result);
        }
    } catch (error) {
        console.error('خطأ في saveUser:', error);
        showMessage('حدث خطأ غير متوقع أثناء حفظ المستخدم. يرجى المحاولة مرة أخرى.', 'error');
    }
}


async function deleteUser(id) {
    try {
        // Error handling: التحقق من وجود id
        if (!id) {
            showMessage('معرف المستخدم غير صحيح', 'error');
            return;
        }

        // Error handling: التحقق من الصلاحية
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لحذف المستخدمين', 'error');
            return;
        }

        if (!confirmAction('هل أنت متأكد من حذف هذا المستخدم؟')) return;

        const result = await API.deleteUser(id);
        if (result && result.success) {
            showMessage(result.message || 'تم حذف المستخدم بنجاح');
            
            // ✅ إجبار إعادة تحميل المستخدمين من الخادم لإظهار الحذف فوراً
            await loadUsers(true); // forceRefresh = true
        } else {
            showMessage(result?.message || 'فشل حذف المستخدم', 'error');
        }
    } catch (error) {
        console.error('خطأ في deleteUser:', error);
        showMessage('حدث خطأ أثناء حذف المستخدم: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ دالة قديمة للتوافق - تستدعي createDatabaseBackup
async function createBackup() {
    await createDatabaseBackup();
}

// ✅ دالة قديمة للتوافق - تعرض قائمة الملفات للاستعادة
function restoreBackup() {
    loadBackupFiles();
    showMessage('يرجى اختيار النسخة الاحتياطية من القائمة أدناه', 'info');
}

// تحديث تردد المزامنة
function updateSyncFrequency() {
    if (typeof syncManager === 'undefined' || !syncManager) {
        showMessage('نظام المزامنة غير متوفر حالياً', 'error');
        return;
    }
    
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
            if (parseInt(savedFrequency) > 0 && typeof syncManager !== 'undefined' && syncManager) {
                syncManager.setFrequency(parseInt(savedFrequency));
            }
        }
    }
}

// تحديث وقت آخر مزامنة
setInterval(() => {
    const lastSyncElement = document.getElementById('lastSyncTime');
    if (lastSyncElement && typeof syncManager !== 'undefined' && syncManager && syncManager.lastSyncTime) {
        const timeStr = syncManager.lastSyncTime.toLocaleTimeString('ar-EG', {
            timeZone: 'Africa/Cairo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastSyncElement.textContent = timeStr;
    }
}, 1000);

// إدارة التخزين - للمالك فقط
function initStorageManagement() {
    try {
        // التحقق من الصلاحية
        if (!hasPermission('admin')) {
            const section = document.getElementById('storageManagementSection');
            if (section) {
    section.style.display = 'none';
            }
            return;
        }
        
        // إظهار القسم للمالك
        const section = document.getElementById('storageManagementSection');
        if (section) {
            section.style.display = 'block';
        }
        
        // تحميل بيانات التخزين
        loadStorageFiles('invoices');
    } catch (error) {
        console.error('خطأ في initStorageManagement:', error);
    }
}

// التبديل بين تبويبات التخزين
function switchStorageTab(type) {
    try {
        // إخفاء جميع المحتويات
        const allContents = document.querySelectorAll('.storage-content');
        allContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // إزالة active من جميع التبويبات
        const allTabs = document.querySelectorAll('.storage-tab');
        allTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // إظهار المحتوى المحدد
        const targetContent = document.querySelector(`.storage-content[data-storage="${type}"]`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // تفعيل التبويب المحدد
        const targetTab = event.target.closest('.storage-tab');
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // تحميل البيانات حسب النوع
        if (type === 'database') {
            loadDatabaseInfo();
        } else {
            loadStorageFiles(type);
        }
    } catch (error) {
        console.error('خطأ في switchStorageTab:', error);
    }
}

// تحميل ملفات التخزين
async function loadStorageFiles(type) {
    try {
        const listElement = document.getElementById(`${type}StorageList`);
        if (!listElement) return;
        
        // إعادة تعيين الصفحة الحالية
        if (type === 'invoices') {
            invoicesCurrentPage = 1;
        } else if (type === 'images') {
            imagesCurrentPage = 1;
        }
        
        listElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        
        const result = await API.request(`storage-management.php?type=${type}`, 'GET');
        
        if (!result || !result.success) {
            listElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> ${result?.message || 'خطأ في تحميل الملفات'}</div>`;
            return;
        }
        
        displayStorageFiles(type, result.data || []);
    } catch (error) {
        console.error('خطأ في loadStorageFiles:', error);
        const listElement = document.getElementById(`${type}StorageList`);
        if (listElement) {
            listElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> خطأ في تحميل الملفات</div>`;
        }
    }
}

// حفظ جميع الملفات لكل نوع
let allStorageFiles = {
    invoices: [],
    images: []
};

// عرض ملفات التخزين
function displayStorageFiles(type, files) {
    const listElement = document.getElementById(`${type}StorageList`);
    const paginationContainer = document.getElementById(`${type}Pagination`);
    if (!listElement) return;
    
    // حفظ جميع الملفات
    allStorageFiles[type] = files || [];
    
    if (!files || files.length === 0) {
        listElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد ملفات</div>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    
    // تطبيق pagination
    const currentPage = type === 'invoices' ? invoicesCurrentPage : imagesCurrentPage;
    const paginated = paginate(files, currentPage, itemsPerPage);
    
    // حساب الحجم الإجمالي
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    let html = `
        <div class="storage-summary">
            <div class="summary-item">
                <span class="summary-label">عدد الملفات:</span>
                <span class="summary-value">${files.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">الحجم الإجمالي:</span>
                <span class="summary-value">${totalSizeMB} MB</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">الصفحة:</span>
                <span class="summary-value">${paginated.currentPage} من ${paginated.totalPages}</span>
            </div>
        </div>
        <div class="storage-bulk-controls" style="margin-bottom: 15px; padding: 10px; background: var(--light-bg); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <button onclick="selectAllFiles('${type}')" class="btn btn-sm btn-secondary">
                    <i class="bi bi-check-square"></i> تحديد الكل
            </button>
                <button onclick="deselectAllFiles('${type}')" class="btn btn-sm btn-secondary">
                    <i class="bi bi-square"></i> إلغاء التحديد
                </button>
                <span id="selectedCount_${type}" style="color: var(--text-light); font-size: 0.9em;">0 ملف محدد</span>
        </div>
            <button onclick="deleteSelectedFiles('${type}')" class="btn btn-sm btn-danger" id="deleteSelectedBtn_${type}" disabled>
                <i class="bi bi-trash"></i> حذف المحدد
            </button>
        </div>
        <div class="storage-files">
    `;
    
    paginated.data.forEach((file, index) => {
        const sizeMB = ((file.size || 0) / (1024 * 1024)).toFixed(2);
        const date = file.date ? new Date(file.date).toLocaleDateString('ar-EG') : 'غير محدد';
        const isDatabase = file.source === 'database' || file.filename?.startsWith('db_');
        const iconClass = type === 'invoices' ? 'file-earmark-pdf' : 'image';
        const sourceBadge = isDatabase ? '<span class="source-badge" style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; margin-right: 8px;">قاعدة البيانات</span>' : '';
        const fileId = `file_${type}_${(currentPage - 1) * itemsPerPage + index}`;
        
        html += `
            <div class="storage-file-item ${isDatabase ? 'database-item' : ''}" style="padding: 12px;">
                <div class="file-checkbox" style="margin-left: 8px;">
                    <input type="checkbox" id="${fileId}" class="file-checkbox-input" data-file='${JSON.stringify(file).replace(/'/g, "&#39;")}' onchange="updateSelectedCount('${type}')">
                </div>
                <div class="file-info" style="flex: 1; min-width: 0;">
                    <div class="file-name" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <i class="bi bi-${iconClass}" style="color: var(--primary-color);"></i>
                        ${sourceBadge}
                        ${file.type ? `<span class="type-badge" style="background: var(--secondary-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7em;">${getImageTypeLabel(file.type)}</span>` : ''}
                        <span style="flex: 1; min-width: 150px;">${escapeHtml(file.name || file.filename || 'غير معروف')}</span>
                        ${file.record_number ? `<span style="color: var(--text-light); font-size: 0.85em;">(${escapeHtml(file.record_number)})</span>` : ''}
                    </div>
                    <div class="file-details" style="display: flex; gap: 12px; margin-top: 5px; font-size: 0.85em;">
                        <span class="file-size" style="color: var(--text-light);">${sizeMB} MB</span>
                        <span class="file-date" style="color: var(--text-light);">${date}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="deleteStorageFile('${type}', ${JSON.stringify(file).replace(/"/g, '&quot;')})" class="btn btn-sm btn-danger">
                        <i class="bi bi-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // إضافة زر حذف الكل
    if (files.length > 0) {
        html += `
            <div class="storage-bulk-actions">
                <button onclick="deleteAllStorageFiles('${type}')" class="btn btn-danger">
                    <i class="bi bi-trash"></i> حذف جميع الملفات
                </button>
            </div>
        `;
    }
    
    listElement.innerHTML = html;
    
    // إضافة pagination buttons
    if (paginationContainer && typeof createPaginationButtons === 'function') {
        createPaginationButtons(paginationContainer, paginated.totalPages, paginated.currentPage, (page) => {
            if (type === 'invoices') {
                invoicesCurrentPage = page;
            } else if (type === 'images') {
                imagesCurrentPage = page;
            }
            displayStorageFiles(type, allStorageFiles[type]); // إعادة عرض مع الصفحة الجديدة
        });
    }
}

// حذف ملف واحد
async function deleteStorageFile(type, file) {
    try {
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لهذا الإجراء', 'error');
            return;
        }
        
        // طلب إدخال كلمة "delete" باستخدام modal مخصص
        const confirmWord = await showDeleteConfirmationModal(`⚠️ تحذير: سيتم حذف الملف نهائياً!\n\nيرجى كتابة كلمة "delete" للتأكيد:`);
        
        if (confirmWord !== 'delete') {
            if (confirmWord !== null) {
                showMessage('لم يتم إدخال كلمة التأكيد بشكل صحيح', 'error');
            }
            return;
        }
        
        // تأكيد إضافي
        const isDatabase = file.source === 'database' || file.filename?.startsWith('db_');
        const sourceText = isDatabase ? ' (من قاعدة البيانات)' : '';
        const confirmMessage = `⚠️ تحذير نهائي!\n\nهل أنت متأكد تماماً من حذف ${isDatabase ? 'الصورة' : 'الملف'}:\n${file.name || file.filename}${sourceText}\n\nهذا الإجراء لا يمكن التراجع عنه!`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        const result = await API.request('storage-management.php', 'DELETE', {
            type: type,
            file: file.filename || file.name || file
        });
        
        if (result && result.success) {
            showMessage('تم حذف الملف بنجاح', 'success');
            // إعادة تعيين الصفحة الحالية
            if (type === 'invoices') {
                invoicesCurrentPage = 1;
            } else if (type === 'images') {
                imagesCurrentPage = 1;
            }
            loadStorageFiles(type);
        } else {
            showMessage(result?.message || 'فشل حذف الملف', 'error');
        }
    } catch (error) {
        console.error('خطأ في deleteStorageFile:', error);
        showMessage('حدث خطأ أثناء حذف الملف', 'error');
    }
}

// حذف جميع الملفات
async function deleteAllStorageFiles(type) {
    try {
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لهذا الإجراء', 'error');
            return;
        }
        
        // طلب إدخال كلمة "delete" باستخدام modal مخصص
        const confirmWord = await showDeleteConfirmationModal(`⚠️ تحذير خطير: سيتم حذف جميع الملفات نهائياً!\n\nيرجى كتابة كلمة "delete" للتأكيد:`);
        
        if (confirmWord !== 'delete') {
            if (confirmWord !== null) {
                showMessage('لم يتم إدخال كلمة التأكيد بشكل صحيح', 'error');
            }
            return;
        }
        
        // تأكيد إضافي
        if (!confirm(`⚠️ تحذير نهائي خطير!\n\nهل أنت متأكد تماماً من حذف جميع الملفات من نوع "${type}"؟\n\nهذا الإجراء لا يمكن التراجع عنه!`)) {
            return;
        }
        
        const result = await API.request('storage-management.php', 'DELETE', {
            type: type,
            delete_all: true
        });
        
        if (result && result.success) {
            showMessage(`تم حذف جميع الملفات بنجاح (${result.data?.deleted_count || 0} ملف)`, 'success');
            // إعادة تعيين الصفحة الحالية
            if (type === 'invoices') {
                invoicesCurrentPage = 1;
            } else if (type === 'images') {
                imagesCurrentPage = 1;
            }
            loadStorageFiles(type);
        } else {
            showMessage(result?.message || 'فشل حذف الملفات', 'error');
        }
    } catch (error) {
        console.error('خطأ في deleteAllStorageFiles:', error);
        showMessage('حدث خطأ أثناء حذف الملفات', 'error');
    }
}

// تحميل معلومات قاعدة البيانات
async function loadDatabaseInfo() {
    try {
        const infoElement = document.getElementById('databaseInfo');
        if (!infoElement) return;
        
        infoElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        
        const result = await API.request('storage-management.php?type=database', 'GET');
        
        if (!result || !result.success) {
            infoElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> ${result?.message || 'خطأ في تحميل المعلومات'}</div>`;
            return;
        }
        
        const dbInfo = result.data || {};
        
        // تحويل الحجم من بايت إلى MB
        const totalSizeBytes = dbInfo.size || 0;
        const dataSizeBytes = dbInfo.data_size || 0;
        const indexSizeBytes = dbInfo.index_size || 0;
        
        const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
        const dataSizeMB = (dataSizeBytes / (1024 * 1024)).toFixed(2);
        const indexSizeMB = (indexSizeBytes / (1024 * 1024)).toFixed(2);
        
        infoElement.innerHTML = `
            <div class="database-info">
                <div class="info-row">
                    <span class="info-label">حجم قاعدة البيانات (الإجمالي):</span>
                    <span class="info-value">${totalSizeMB} MB</span>
                </div>
                <div class="info-row" style="padding-right: 20px;">
                    <span class="info-label" style="font-size: 0.9em; color: var(--text-light);">- حجم البيانات:</span>
                    <span class="info-value" style="font-size: 0.9em;">${dataSizeMB} MB</span>
                </div>
                <div class="info-row" style="padding-right: 20px;">
                    <span class="info-label" style="font-size: 0.9em; color: var(--text-light);">- حجم الفهارس:</span>
                    <span class="info-value" style="font-size: 0.9em;">${indexSizeMB} MB</span>
                </div>
                <div class="info-row">
                    <span class="info-label">عدد الجداول:</span>
                    <span class="info-value">${dbInfo.tables_count || 0}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">عدد السجلات:</span>
                    <span class="info-value">${dbInfo.records_count || 0}</span>
                </div>
                <div class="info-note" style="margin-top: 15px; padding: 10px; background: var(--light-bg); border-radius: 5px; color: var(--text-light); font-size: 0.9em;">
                    <i class="bi bi-info-circle"></i> قاعدة البيانات محمية ولا يمكن حذفها من هنا. استخدم النسخ الاحتياطي للتحكم في البيانات.
                </div>
            </div>
        `;
    } catch (error) {
        console.error('خطأ في loadDatabaseInfo:', error);
        const infoElement = document.getElementById('databaseInfo');
        if (infoElement) {
            infoElement.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> خطأ في تحميل المعلومات</div>`;
        }
    }
}

// دالة تحميل الفروع (خاصة بإعدادات المستخدمين)
async function loadUserBranches(forceRefresh = false) {
    try {
        console.log('🔄 [loadUserBranches] بدء تحميل الفروع...', { forceRefresh });
        
        // انتظار وجود العنصر أولاً (بحد أقصى 3 ثواني)
        let branchSelect = document.getElementById('userBranch');
        let retries = 0;
        const maxRetries = 30;
        const retryDelay = 100;
        
        while (!branchSelect && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            branchSelect = document.getElementById('userBranch');
            retries++;
        }
        
        if (!branchSelect) {
            console.error('❌ [loadUserBranches] العنصر userBranch غير موجود بعد', maxRetries * retryDelay, 'ms');
            return;
        }
        
        if (branchSelect.tagName.toLowerCase() !== 'select') {
            console.error('❌ [loadUserBranches] العنصر userBranch ليس select:', branchSelect.tagName);
            return;
        }
        
        console.log('✅ [loadUserBranches] تم العثور على العنصر userBranch');
        
        // جلب الفروع
        let result;
        try {
            if (forceRefresh) {
                const timestamp = Date.now();
                console.log('🔄 [loadUserBranches] جلب الفروع مع forceRefresh...');
                result = await API.request(`branches.php?_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
            } else {
                console.log('🔄 [loadUserBranches] جلب الفروع من الكاش...');
                result = await API.request('branches.php', 'GET');
            }
            
            console.log('📥 [loadUserBranches] استجابة API:', result);
        } catch (apiError) {
            console.error('❌ [loadUserBranches] خطأ في استدعاء API:', apiError);
            branchSelect.innerHTML = '<option value="">خطأ في تحميل الفروع</option>';
            return;
        }
        
        // التحقق من النتيجة
        if (!result) {
            console.error('❌ [loadUserBranches] لا توجد استجابة من API');
            branchSelect.innerHTML = '<option value="">خطأ في تحميل الفروع</option>';
            return;
        }
        
        if (!result.success) {
            console.error('❌ [loadUserBranches] فشل الطلب:', result.message || result.error);
            branchSelect.innerHTML = '<option value="">خطأ في تحميل الفروع</option>';
            return;
        }
        
        if (!result.data) {
            console.error('❌ [loadUserBranches] لا توجد بيانات في الاستجابة:', result);
            branchSelect.innerHTML = '<option value="">لا توجد فروع متاحة</option>';
            return;
        }
        
        if (!Array.isArray(result.data)) {
            console.error('❌ [loadUserBranches] البيانات ليست مصفوفة:', typeof result.data, result.data);
            branchSelect.innerHTML = '<option value="">خطأ في تنسيق البيانات</option>';
            return;
        }
        
        if (result.data.length === 0) {
            console.warn('⚠️ [loadUserBranches] لا توجد فروع في قاعدة البيانات');
            branchSelect.innerHTML = '<option value="">لا توجد فروع متاحة</option>';
            return;
        }
        
        // حفظ القيمة الحالية
        const currentValue = branchSelect.value;
        
        // مسح القائمة وإضافة الخيارات الجديدة
        branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
        
        let addedCount = 0;
        result.data.forEach((branch, index) => {
            if (branch && branch.id && branch.name) {
                try {
                    const option = document.createElement('option');
                    option.value = String(branch.id).trim();
                    option.textContent = String(branch.name).trim();
                    branchSelect.appendChild(option);
                    addedCount++;
                } catch (optionError) {
                    console.error(`❌ [loadUserBranches] خطأ في إضافة فرع ${index}:`, optionError, branch);
                }
            } else {
                console.warn(`⚠️ [loadUserBranches] فرع غير صحيح في الفهرس ${index}:`, branch);
            }
        });
        
        console.log(`✅ [loadUserBranches] تم تحميل ${addedCount} من ${result.data.length} فرع في القائمة المنسدلة`);
        
        // التحقق من أن الفروع تمت إضافتها
        if (addedCount === 0) {
            console.error('❌ [loadUserBranches] لم يتم إضافة أي فرع!');
            branchSelect.innerHTML = '<option value="">خطأ في تحميل الفروع</option>';
            return;
        }
        
        // استعادة القيمة إذا كانت موجودة وصحيحة
        if (currentValue && Array.from(branchSelect.options).some(opt => opt.value === currentValue)) {
            branchSelect.value = currentValue;
            console.log('✅ [loadUserBranches] تم استعادة القيمة السابقة:', currentValue);
        }
    } catch (error) {
        console.error('❌ [loadUserBranches] خطأ عام في تحميل الفروع:', error);
        console.error('❌ [loadUserBranches] تفاصيل الخطأ:', {
            name: error?.name,
            message: error?.message,
            stack: error?.stack
        });
        
        const branchSelect = document.getElementById('userBranch');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">خطأ في تحميل الفروع</option>';
        }
    }
}

// دالة إظهار/إخفاء حقل الفرع
function toggleBranchField() {
    try {
        const roleField = document.getElementById('userRole');
        const branchGroup = document.getElementById('userBranchGroup');
        const branchField = document.getElementById('userBranch');
        
        if (!roleField || !branchGroup || !branchField) {
            return;
        }
        
        const role = roleField.value;
        if (role === 'admin') {
            branchGroup.style.display = 'none';
            branchField.required = false;
            branchField.value = '';
        } else {
            branchGroup.style.display = 'block';
            branchField.required = true;
        }
    } catch (error) {
        console.error('خطأ في toggleBranchField:', error);
    }
}

// ✅ تصدير فوري للدالة الرئيسية لضمان توفرها فور تحميل الملف
// تصدير فوري في بداية الملف
(function() {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof loadSettingsSection === 'function') {
            window.loadSettingsSection = loadSettingsSection;
            console.log('✅ [Settings] تم تصدير loadSettingsSection إلى window (في بداية الملف)');
        }
    } catch (e) {
        console.error('❌ [Settings] خطأ في تصدير loadSettingsSection:', e);
    }
})();

// تصدير مرة أخرى في نهاية الملف للتأكد
if (typeof window !== 'undefined') {
    try {
        window.loadSettingsSection = loadSettingsSection;
        console.log('✅ [Settings] تم تصدير loadSettingsSection إلى window (في نهاية الملف)');
    } catch (e) {
        console.error('❌ [Settings] خطأ في تصدير loadSettingsSection في نهاية الملف:', e);
    }
}

// جعل جميع دوال إدارة المستخدمين متاحة في النطاق العام
if (typeof window !== 'undefined') {
    // ✅ تصدير الدوال الرئيسية إلى window
    window.loadSettings = loadSettings;
    window.displaySettings = displaySettings;
    window.showAddUserModal = showAddUserModal;
    window.showEditUserModal = showEditUserModal;
    window.closeUserModal = closeUserModal;
    window.saveUser = saveUser;
    window.deleteUser = deleteUser;
    window.loadUsers = loadUsers;
    window.displayUsers = displayUsers;
    
    // تصدير الدالة باسمين للتوافق
    window.loadBranches = loadUserBranches; // للتوافق مع الكود القديم
    window.loadUserBranches = loadUserBranches; // الاسم الجديد
    window.toggleBranchField = toggleBranchField;
    
    // دالة مساعدة للتحقق من الفروع (للتشخيص)
    window.checkBranches = async function() {
        try {
            console.log('🔍 التحقق من الفروع...');
            const result = await API.request('branches.php', 'GET', null, { skipCache: true });
            console.log('📊 نتيجة التحقق:', {
                success: result?.success,
                message: result?.message,
                dataLength: Array.isArray(result?.data) ? result.data.length : 'N/A',
                data: result?.data
            });
            
            if (result && result.success && Array.isArray(result.data)) {
                if (result.data.length === 0) {
                    console.warn('⚠️ لا توجد فروع في قاعدة البيانات');
                    showMessage('لا توجد فروع في قاعدة البيانات. يرجى إضافة فروع من إعدادات الفروع أولاً.', 'warning');
                } else {
                    console.log(`✅ يوجد ${result.data.length} فرع في قاعدة البيانات:`);
                    result.data.forEach((branch, index) => {
                        console.log(`  ${index + 1}. ${branch.name || 'بدون اسم'} (ID: ${branch.id || 'بدون ID'})`);
                    });
                }
            } else {
                console.error('❌ فشل التحقق من الفروع:', result);
            }
        } catch (error) {
            console.error('❌ خطأ في التحقق من الفروع:', error);
        }
    };
    window.switchBranchTab = switchBranchTab;
    window.saveShopSettings = saveShopSettings;
    window.switchStorageTab = switchStorageTab;
    window.loadStorageFiles = loadStorageFiles;
    window.deleteStorageFile = deleteStorageFile;
    window.deleteAllStorageFiles = deleteAllStorageFiles;
    window.loadDatabaseInfo = loadDatabaseInfo;
    window.selectAllFiles = selectAllFiles;
    window.deselectAllFiles = deselectAllFiles;
    window.updateSelectedCount = updateSelectedCount;
    window.deleteSelectedFiles = deleteSelectedFiles;
    window.getImageTypeLabel = getImageTypeLabel;
    window.showDeleteConfirmationModal = showDeleteConfirmationModal;
    
    // ✅ دوال النسخ الاحتياطي من قاعدة البيانات
    window.loadBackupInfo = loadBackupInfo;
    window.loadBackupFiles = loadBackupFiles;
    window.createDatabaseBackup = createDatabaseBackup;
    window.restoreDatabaseBackup = restoreDatabaseBackup;
    window.deleteDatabaseBackup = deleteDatabaseBackup;
    window.downloadBackupFile = downloadBackupFile;
    window.createBackup = createBackup; // للتوافق
    window.restoreBackup = restoreBackup; // للتوافق
}

// نافذة تأكيد مخصصة لطلب إدخال كلمة "delete"
function showDeleteConfirmationModal(message) {
    return new Promise((resolve) => {
        // إنشاء modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.id = 'deleteConfirmationModal';
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeDeleteConfirmationModal(null)"></div>
            <div class="modal-content delete-confirmation-modal" style="max-width: 520px; animation: slideDown 0.3s ease-out;">
                <div class="delete-modal-header">
                    <div class="delete-icon-wrapper">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h3>تأكيد الحذف</h3>
                    <button class="modal-close" onclick="closeDeleteConfirmationModal(null)" title="إغلاق">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="delete-modal-body">
                    <div class="warning-message">
                        <p>${message}</p>
                    </div>
                    <div class="delete-confirm-section">
                        <label for="deleteConfirmInput" class="delete-label">
                            <i class="bi bi-key"></i>
                            <span>أدخل كلمة "<strong>delete</strong>" للتأكيد:</span>
                        </label>
                        <input 
                            type="text" 
                            id="deleteConfirmInput" 
                            class="delete-confirm-input" 
                            placeholder="اكتب delete هنا..."
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <div class="input-hint">
                            <i class="bi bi-info-circle"></i>
                            <span>يجب إدخال الكلمة بشكل صحيح تماماً</span>
                        </div>
                    </div>
                </div>
                <div class="delete-modal-footer">
                    <button class="btn btn-secondary btn-cancel" onclick="closeDeleteConfirmationModal(null)">
                        <i class="bi bi-x-circle"></i>
                        <span>إلغاء</span>
                    </button>
                    <button class="btn btn-danger btn-confirm-delete" id="confirmDeleteBtn" onclick="confirmDeleteAction()" disabled>
                        <i class="bi bi-trash3"></i>
                        <span>تأكيد الحذف</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // التركيز على حقل الإدخال
        const input = document.getElementById('deleteConfirmInput');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (input) {
            input.focus();
            
            // التحقق من صحة الإدخال في الوقت الفعلي
            input.addEventListener('input', (e) => {
                const value = e.target.value.trim().toLowerCase();
                if (value === 'delete') {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';
                    input.style.borderColor = 'var(--success-color)';
                    input.style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.1)';
                } else {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.6';
                    confirmBtn.style.cursor = 'not-allowed';
                    input.style.borderColor = value ? 'var(--danger-color)' : 'var(--border-color)';
                    input.style.boxShadow = value ? '0 0 0 3px rgba(244, 67, 54, 0.1)' : 'none';
                }
            });
            
            // السماح بالحذف عند الضغط على Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && input.value.trim().toLowerCase() === 'delete') {
                    e.preventDefault();
                    confirmDeleteAction();
                }
            });
        }
        
        // دالة إغلاق modal
        window.closeDeleteConfirmationModal = function(value) {
            const modal = document.getElementById('deleteConfirmationModal');
            if (modal) {
                modal.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.remove();
                    }
                }, 200);
            }
            resolve(value);
        };
        
        // دالة تأكيد الحذف
        window.confirmDeleteAction = function() {
            const input = document.getElementById('deleteConfirmInput');
            const value = input ? input.value.trim() : '';
            if (value.toLowerCase() === 'delete') {
                closeDeleteConfirmationModal(value);
            } else {
                showMessage('يجب إدخال كلمة "delete" بشكل صحيح', 'error');
            }
        };
    });
}

// دالة للحصول على تسمية نوع الصورة
function getImageTypeLabel(type) {
    const labels = {
        'repair': 'عملية',
        'spare_part': 'قطع غيار',
        'phone': 'هاتف',
        'accessory': 'إكسسوار',
        'chat': 'شات'
    };
    return labels[type] || type;
}

// تحديد جميع الملفات (في الصفحة الحالية فقط)
function selectAllFiles(type) {
    const checkboxes = document.querySelectorAll(`.storage-content[data-storage="${type}"] .file-checkbox-input`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectedCount(type);
}

// إلغاء تحديد جميع الملفات
function deselectAllFiles(type) {
    const checkboxes = document.querySelectorAll(`.storage-content[data-storage="${type}"] .file-checkbox-input`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedCount(type);
}

// تحديث عدد الملفات المحددة
function updateSelectedCount(type) {
    const checkboxes = document.querySelectorAll(`.storage-content[data-storage="${type}"] .file-checkbox-input:checked`);
    const count = checkboxes.length;
    const countElement = document.getElementById(`selectedCount_${type}`);
    const deleteBtn = document.getElementById(`deleteSelectedBtn_${type}`);
    
    if (countElement) {
        countElement.textContent = `${count} ملف محدد`;
    }
    
    if (deleteBtn) {
        deleteBtn.disabled = count === 0;
    }
}

// حذف الملفات المحددة
async function deleteSelectedFiles(type) {
    try {
        if (!hasPermission('admin')) {
            showMessage('ليس لديك صلاحية لهذا الإجراء', 'error');
            return;
        }
        
        const checkboxes = document.querySelectorAll(`.storage-content[data-storage="${type}"] .file-checkbox-input:checked`);
        
        if (checkboxes.length === 0) {
            showMessage('لم يتم تحديد أي ملفات', 'error');
            return;
        }
        
        const selectedFiles = [];
        checkboxes.forEach(checkbox => {
            try {
                const fileData = JSON.parse(checkbox.getAttribute('data-file').replace(/&#39;/g, "'"));
                selectedFiles.push(fileData);
            } catch (e) {
                console.error('خطأ في قراءة بيانات الملف:', e);
            }
        });
        
        if (selectedFiles.length === 0) {
            showMessage('خطأ في قراءة بيانات الملفات المحددة', 'error');
            return;
        }
        
        // طلب إدخال كلمة "delete" باستخدام modal مخصص
        const confirmWord = await showDeleteConfirmationModal(`⚠️ تحذير: سيتم حذف ${selectedFiles.length} ملف نهائياً!\n\nيرجى كتابة كلمة "delete" للتأكيد:`);
        
        if (confirmWord !== 'delete') {
            if (confirmWord !== null) {
                showMessage('لم يتم إدخال كلمة التأكيد بشكل صحيح', 'error');
            }
            return;
        }
        
        // تأكيد إضافي
        const confirmMessage = `⚠️ تحذير نهائي!\n\nهل أنت متأكد تماماً من حذف ${selectedFiles.length} ملف؟\n\nهذا الإجراء لا يمكن التراجع عنه!`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        const result = await API.request('storage-management.php', 'DELETE', {
            type: type,
            files: selectedFiles.map(f => f.filename || f.name || f)
        });
        
        if (result && result.success) {
            const deletedCount = result.data?.deleted_count || selectedFiles.length;
            const failedCount = result.data?.failed_count || 0;
            
            if (failedCount > 0) {
                showMessage(`تم حذف ${deletedCount} ملف، فشل حذف ${failedCount} ملف`, 'warning');
            } else {
                showMessage(`تم حذف ${deletedCount} ملف بنجاح`, 'success');
            }
            
            // إعادة تعيين الصفحة الحالية
            if (type === 'invoices') {
                invoicesCurrentPage = 1;
            } else if (type === 'images') {
                imagesCurrentPage = 1;
            }
            
            loadStorageFiles(type);
        } else {
            showMessage(result?.message || 'فشل حذف الملفات', 'error');
        }
    } catch (error) {
        console.error('خطأ في deleteSelectedFiles:', error);
        showMessage('حدث خطأ أثناء حذف الملفات', 'error');
    }
}


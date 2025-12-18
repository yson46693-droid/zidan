// إدارة النسخ الاحتياطي التلقائي مع تليجرام

let backupConfig = null;
let backupStatus = null;
let backupList = [];

// تحميل إعدادات النسخ الاحتياطي
async function loadBackupConfig() {
    try {
        const result = await API.getTelegramBackupConfig();
        if (result.success) {
            backupConfig = result.data;
            return backupConfig;
        }
    } catch (error) {
        console.error('خطأ في تحميل إعدادات النسخ الاحتياطي:', error);
    }
    return null;
}

// تحميل حالة النسخ الاحتياطي
async function loadBackupStatus() {
    try {
        const result = await API.getTelegramBackupStatus();
        if (result.success) {
            backupStatus = result.data;
            return backupStatus;
        }
    } catch (error) {
        console.error('خطأ في تحميل حالة النسخ الاحتياطي:', error);
    }
    return null;
}

// تحميل قائمة النسخ الاحتياطية
async function loadBackupList() {
    try {
        const result = await API.listBackups();
        if (result.success) {
            backupList = result.data;
            return backupList;
        }
    } catch (error) {
        console.error('خطأ في تحميل قائمة النسخ الاحتياطية:', error);
    }
    return [];
}

// تحميل حالة التنظيف التلقائي
async function loadCleanupStatus() {
    try {
        const result = await API.getCleanupStatus();
        if (result.success) {
            return result.data;
        }
    } catch (error) {
        console.error('خطأ في تحميل حالة التنظيف:', error);
    }
    return null;
}

// تنظيف النسخ القديمة يدوياً
async function cleanupOldBackups() {
    try {
        showMessage('جاري تنظيف النسخ القديمة...', 'info');
        
        const result = await API.request('telegram-backup.php', 'GET', { action: 'cleanup_old_backups' });
        
        if (result.success) {
            showMessage(result.message, 'success');
            await loadBackupList();
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في تنظيف النسخ القديمة:', error);
        showMessage('خطأ في تنظيف النسخ القديمة', 'error');
        return false;
    }
}

// تحديث إعدادات النسخ الاحتياطي
async function updateBackupConfig(configData) {
    try {
        const result = await API.request('telegram-backup.php', 'POST', {
            action: 'update_config',
            ...configData
        });
        
        if (result.success) {
            showMessage('تم تحديث إعدادات النسخ الاحتياطي بنجاح', 'success');
            await loadBackupConfig();
            await loadBackupStatus();
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في تحديث إعدادات النسخ الاحتياطي:', error);
        showMessage('خطأ في تحديث الإعدادات', 'error');
        return false;
    }
}

// إنشاء نسخة احتياطية يدوية
async function createManualBackup() {
    try {
        showMessage('جاري إنشاء النسخة الاحتياطية...', 'info');
        
        const result = await API.request('telegram-backup.php', 'POST', {
            action: 'create_backup'
        });
        
        if (result.success) {
            showMessage('تم إنشاء النسخة الاحتياطية بنجاح', 'success');
            
            // إرسال إلى تليجرام إذا كان مفعلاً
            if (backupConfig && backupConfig.telegram_bot.enabled) {
                await sendBackupToTelegram(result.data.backup_file);
            }
            
            await loadBackupList();
            await loadBackupStatus();
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
        showMessage('خطأ في إنشاء النسخة الاحتياطية', 'error');
        return false;
    }
}

// إرسال نسخة احتياطية إلى تليجرام
async function sendBackupToTelegram(backupFile) {
    try {
        const result = await API.request('telegram-backup.php', 'POST', {
            action: 'send_to_telegram',
            backup_file: backupFile
        });
        
        if (result.success) {
            showMessage('تم إرسال النسخة الاحتياطية إلى تليجرام بنجاح', 'success');
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في إرسال النسخة الاحتياطية إلى تليجرام:', error);
        showMessage('خطأ في إرسال النسخة الاحتياطية إلى تليجرام', 'error');
        return false;
    }
}

// اختبار الاتصال بتليجرام
async function testTelegramConnection() {
    try {
        showMessage('جاري اختبار الاتصال بتليجرام...', 'info');
        
        const result = await API.request('telegram-backup.php', 'POST', {
            action: 'test_telegram'
        });
        
        if (result.success) {
            showMessage('تم اختبار الاتصال بتليجرام بنجاح', 'success');
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في اختبار الاتصال بتليجرام:', error);
        showMessage('خطأ في اختبار الاتصال بتليجرام', 'error');
        return false;
    }
}

// حذف نسخة احتياطية
async function deleteBackup(backupFile) {
    if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) {
        return false;
    }
    
    try {
        const result = await API.request('telegram-backup.php', 'DELETE', {
            backup_file: backupFile
        });
        
        if (result.success) {
            showMessage('تم حذف النسخة الاحتياطية بنجاح', 'success');
            await loadBackupList();
            return true;
        } else {
            showMessage(result.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('خطأ في حذف النسخة الاحتياطية:', error);
        showMessage('خطأ في حذف النسخة الاحتياطية', 'error');
        return false;
    }
}

// تحميل قسم إدارة النسخ الاحتياطي
async function loadBackupManagementSection() {
    const section = document.getElementById('settings-section');
    if (!section) return;

    section.style.display = 'none';

    const backupSection = document.createElement('div');
    backupSection.id = 'backup-management-section';
    backupSection.className = 'settings-container';

    // تحميل البيانات
    await loadBackupConfig();
    await loadBackupStatus();
    await loadBackupList();
    const cleanupStatus = await loadCleanupStatus();

    backupSection.innerHTML = `
        <div class="section-header">
            <button onclick="loadSettingsSection()" class="btn btn-secondary">
                <i class="bi bi-arrow-right"></i> العودة للإعدادات
            </button>
            <h2><i class="bi bi-cloud-upload"></i> إدارة النسخ الاحتياطية</h2>
        </div>

        <div class="backup-management-content">
            <!-- حالة النسخ الاحتياطي -->
            <div class="backup-status-card">
                <h3><i class="bi bi-info-circle"></i> حالة النسخ الاحتياطي</h3>
                <div class="status-info">
                    <div class="status-item">
                        <span class="status-label">الحالة:</span>
                        <span class="status-value ${backupStatus?.enabled ? 'enabled' : 'disabled'}">
                            ${backupStatus?.enabled ? 'مفعّل' : 'معطّل'}
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">آخر نسخة احتياطية:</span>
                        <span class="status-value">${backupStatus?.last_backup_time ? formatDate(backupStatus.last_backup_time) : 'لم يتم إنشاء نسخة احتياطية'}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">النسخة التالية:</span>
                        <span class="status-value">${backupStatus?.next_backup_time ? formatDate(backupStatus.next_backup_time) : 'غير محدد'}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">معدل النسخ:</span>
                        <span class="status-value">كل ${backupStatus?.backup_interval_hours || 6} ساعات</span>
                    </div>
                </div>
            </div>

            <!-- إعدادات بوت تليجرام -->
            <div class="backup-config-card">
                <h3><i class="bi bi-telegram"></i> إعدادات بوت تليجرام</h3>
                <form id="telegramConfigForm" onsubmit="saveTelegramConfig(event)">
                    <div class="form-group">
                        <label for="botToken">رمز البوت (Bot Token):</label>
                        <input type="text" id="botToken" value="${backupConfig?.telegram_bot?.bot_token || ''}" 
                               placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                    </div>
                    
                    <div class="form-group">
                        <label for="chatId">معرف المحادثة (Chat ID):</label>
                        <input type="text" id="chatId" value="${backupConfig?.telegram_bot?.chat_id || ''}" 
                               placeholder="-1001234567890">
                    </div>
                    
                    <div class="form-group">
                        <label for="backupInterval">معدل النسخ الاحتياطي (بالساعات):</label>
                        <select id="backupInterval">
                            <option value="1" ${backupConfig?.telegram_bot?.backup_interval_hours === 1 ? 'selected' : ''}>كل ساعة</option>
                            <option value="3" ${backupConfig?.telegram_bot?.backup_interval_hours === 3 ? 'selected' : ''}>كل 3 ساعات</option>
                            <option value="6" ${backupConfig?.telegram_bot?.backup_interval_hours === 6 ? 'selected' : ''}>كل 6 ساعات</option>
                            <option value="12" ${backupConfig?.telegram_bot?.backup_interval_hours === 12 ? 'selected' : ''}>كل 12 ساعة</option>
                            <option value="24" ${backupConfig?.telegram_bot?.backup_interval_hours === 24 ? 'selected' : ''}>كل يوم</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="backupEnabled" ${backupConfig?.telegram_bot?.enabled ? 'checked' : ''}>
                            تفعيل النسخ الاحتياطي التلقائي
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="notificationEnabled" ${backupConfig?.telegram_bot?.notification_enabled ? 'checked' : ''}>
                            تفعيل الإشعارات
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="compressBackup" ${backupConfig?.backup_settings?.compress_backup ? 'checked' : ''}>
                            ضغط النسخة الاحتياطية (ZIP)
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="includeImages" ${backupConfig?.backup_settings?.include_images ? 'checked' : ''}>
                            تضمين الصور في النسخة الاحتياطية
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="autoDeleteEnabled" ${backupConfig?.backup_settings?.auto_delete_enabled ? 'checked' : ''}>
                            تفعيل الحذف التلقائي للنسخ القديمة
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label for="retentionDays">فترة الاحتفاظ بالنسخ (بالأيام):</label>
                        <select id="retentionDays">
                            <option value="7" ${backupConfig?.backup_settings?.retention_days === 7 ? 'selected' : ''}>7 أيام</option>
                            <option value="15" ${backupConfig?.backup_settings?.retention_days === 15 ? 'selected' : ''}>15 يوم</option>
                            <option value="30" ${backupConfig?.backup_settings?.retention_days === 30 ? 'selected' : ''}>30 يوم</option>
                            <option value="60" ${backupConfig?.backup_settings?.retention_days === 60 ? 'selected' : ''}>60 يوم</option>
                            <option value="90" ${backupConfig?.backup_settings?.retention_days === 90 ? 'selected' : ''}>90 يوم</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="maxBackupFiles">الحد الأقصى لعدد النسخ:</label>
                        <select id="maxBackupFiles">
                            <option value="10" ${backupConfig?.backup_settings?.max_backup_files === 10 ? 'selected' : ''}>10 نسخ</option>
                            <option value="20" ${backupConfig?.backup_settings?.max_backup_files === 20 ? 'selected' : ''}>20 نسخة</option>
                            <option value="50" ${backupConfig?.backup_settings?.max_backup_files === 50 ? 'selected' : ''}>50 نسخة</option>
                            <option value="100" ${backupConfig?.backup_settings?.max_backup_files === 100 ? 'selected' : ''}>100 نسخة</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save"></i> حفظ الإعدادات
                        </button>
                        <button type="button" onclick="testTelegramConnection()" class="btn btn-info">
                            <i class="bi bi-wifi"></i> اختبار الاتصال
                        </button>
                    </div>
                </form>
            </div>

            <!-- النسخ الاحتياطية اليدوية -->
            <div class="backup-actions-card">
                <h3><i class="bi bi-gear"></i> النسخ الاحتياطية اليدوية</h3>
                <div class="backup-actions">
                    <button onclick="createManualBackup()" class="btn btn-success">
                        <i class="bi bi-cloud-upload"></i> إنشاء نسخة احتياطية الآن
                    </button>
                    <button onclick="cleanupOldBackups()" class="btn btn-warning">
                        <i class="bi bi-trash"></i> تنظيف النسخ القديمة
                    </button>
                </div>
            </div>

            <!-- إدارة الحذف التلقائي -->
            <div class="backup-cleanup-card">
                <h3><i class="bi bi-clock-history"></i> إدارة الحذف التلقائي</h3>
                <div class="cleanup-status">
                    <div class="status-item">
                        <span class="status-label">الحذف التلقائي:</span>
                        <span class="status-value ${cleanupStatus?.auto_delete_enabled ? 'enabled' : 'disabled'}">
                            ${cleanupStatus?.auto_delete_enabled ? 'مفعّل' : 'معطّل'}
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">فترة الاحتفاظ:</span>
                        <span class="status-value">${cleanupStatus?.retention_days || 30} يوم</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">الحد الأقصى للملفات:</span>
                        <span class="status-value">${cleanupStatus?.max_backup_files || 50} ملف</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">آخر تنظيف:</span>
                        <span class="status-value">${cleanupStatus?.last_cleanup_time ? formatDate(cleanupStatus.last_cleanup_time) : 'لم يتم التنظيف بعد'}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">النسخ القديمة:</span>
                        <span class="status-value ${cleanupStatus?.old_backups_count > 0 ? 'warning' : 'success'}">
                            ${cleanupStatus?.old_backups_count || 0} نسخة
                        </span>
                    </div>
                </div>
                
                ${cleanupStatus?.old_backups_count > 0 ? `
                    <div class="old-backups-warning">
                        <h4><i class="bi bi-exclamation-triangle"></i> نسخ قديمة تحتاج للحذف</h4>
                        <div class="old-backups-list">
                            ${cleanupStatus.old_backups.slice(0, 5).map(backup => `
                                <div class="old-backup-item">
                                    <span class="backup-name">${backup.filename}</span>
                                    <span class="backup-age">${backup.age_days} يوم</span>
                                    <span class="backup-size">${backup.size_formatted}</span>
                                </div>
                            `).join('')}
                            ${cleanupStatus.old_backups.length > 5 ? `<p class="more-backups">و ${cleanupStatus.old_backups.length - 5} نسخة أخرى...</p>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- قائمة النسخ الاحتياطية -->
            <div class="backup-list-card">
                <h3><i class="bi bi-list"></i> النسخ الاحتياطية المحفوظة</h3>
                <div class="backup-list">
                    ${backupList.length === 0 ? 
                        '<p class="no-backups">لا توجد نسخ احتياطية محفوظة</p>' :
                        backupList.map(backup => `
                            <div class="backup-item">
                                <div class="backup-info">
                                    <div class="backup-name">${backup.filename}</div>
                                    <div class="backup-details">
                                        <span class="backup-date">${formatDate(backup.created_at)}</span>
                                        <span class="backup-size">${backup.size_formatted}</span>
                                    </div>
                                </div>
                                <div class="backup-actions">
                                    <button onclick="sendBackupToTelegram('${backup.filename}')" class="btn btn-sm btn-info">
                                        <i class="bi bi-telegram"></i> إرسال لتليجرام
                                    </button>
                                    <button onclick="deleteBackup('${backup.filename}')" class="btn btn-sm btn-danger">
                                        <i class="bi bi-trash"></i> حذف
                                    </button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.appendChild(backupSection);
    }
}

// حفظ إعدادات تليجرام
async function saveTelegramConfig(event) {
    event.preventDefault();
    
    const configData = {
        bot_token: document.getElementById('botToken').value.trim(),
        chat_id: document.getElementById('chatId').value.trim(),
        backup_interval_hours: parseInt(document.getElementById('backupInterval').value),
        enabled: document.getElementById('backupEnabled').checked,
        notification_enabled: document.getElementById('notificationEnabled').checked,
        compress_backup: document.getElementById('compressBackup').checked,
        include_images: document.getElementById('includeImages').checked,
        auto_delete_enabled: document.getElementById('autoDeleteEnabled').checked,
        retention_days: parseInt(document.getElementById('retentionDays').value),
        max_backup_files: parseInt(document.getElementById('maxBackupFiles').value)
    };
    
    if (configData.bot_token && configData.chat_id) {
        await updateBackupConfig(configData);
    } else {
        showMessage('يرجى إدخال رمز البوت ومعرف المحادثة', 'warning');
    }
}

// بدء النسخ الاحتياطي التلقائي
function startAutoBackup() {
    if (backupConfig && backupConfig.telegram_bot.enabled) {
        const intervalHours = backupConfig.telegram_bot.backup_interval_hours;
        const intervalMs = intervalHours * 60 * 60 * 1000;
        
        setInterval(async () => {
            try {
                await createManualBackup();
            } catch (error) {
                console.error('خطأ في النسخ الاحتياطي التلقائي:', error);
            }
        }, intervalMs);
    }
}

// تهيئة النسخ الاحتياطي التلقائي
async function initializeAutoBackup() {
    await loadBackupConfig();
    await loadBackupStatus();
    
    if (backupConfig && backupConfig.telegram_bot.enabled) {
        startAutoBackup();
    }
}

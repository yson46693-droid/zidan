/**
 * إدارة التشفير في الإعدادات
 * يوفر واجهة لإدارة مفاتيح التشفير والبيانات الحساسة
 */

class EncryptionSettings {
    constructor() {
        this.encryptionEnabled = true;
        this.currentKey = null;
    }

    /**
     * تحميل إعدادات التشفير
     */
    async loadEncryptionSettings() {
        try {
            const result = await API.request('settings');
            if (result.success) {
                this.encryptionEnabled = result.data.encryption_enabled ?? true;
                this.currentKey = result.data.encryption_key ?? null;
            }
        } catch (error) {
            console.error('خطأ في تحميل إعدادات التشفير:', error);
        }
    }

    /**
     * حفظ إعدادات التشفير
     */
    async saveEncryptionSettings() {
        try {
            const settings = {
                encryption_enabled: this.encryptionEnabled,
                encryption_key: this.currentKey
            };
            
            const result = await API.updateSettings(settings);
            if (result.success) {
                showMessage('تم حفظ إعدادات التشفير بنجاح');
                return true;
            } else {
                showMessage(result.message, 'error');
                return false;
            }
        } catch (error) {
            console.error('خطأ في حفظ إعدادات التشفير:', error);
            showMessage('خطأ في حفظ إعدادات التشفير', 'error');
            return false;
        }
    }

    /**
     * إنشاء مفتاح تشفير جديد
     */
    async generateNewKey() {
        try {
            const result = await API.request('encryption/generate-key', 'POST');
            if (result.success) {
                this.currentKey = result.data.key;
                showMessage('تم إنشاء مفتاح تشفير جديد');
                return this.currentKey;
            } else {
                showMessage(result.message, 'error');
                return null;
            }
        } catch (error) {
            console.error('خطأ في إنشاء مفتاح التشفير:', error);
            showMessage('خطأ في إنشاء مفتاح التشفير', 'error');
            return null;
        }
    }

    /**
     * تحديث مفتاح التشفير
     */
    async updateEncryptionKey(newKey) {
        try {
            const result = await API.request('encryption/update-key', 'POST', { key: newKey });
            if (result.success) {
                this.currentKey = newKey;
                showMessage('تم تحديث مفتاح التشفير بنجاح');
                return true;
            } else {
                showMessage(result.message, 'error');
                return false;
            }
        } catch (error) {
            console.error('خطأ في تحديث مفتاح التشفير:', error);
            showMessage('خطأ في تحديث مفتاح التشفير', 'error');
            return false;
        }
    }

    /**
     * إعادة تشفير جميع البيانات
     */
    async reencryptAllData() {
        try {
            const result = await API.request('encryption/reencrypt-all', 'POST');
            if (result.success) {
                showMessage('تم إعادة تشفير جميع البيانات بنجاح');
                return true;
            } else {
                showMessage(result.message, 'error');
                return false;
            }
        } catch (error) {
            console.error('خطأ في إعادة تشفير البيانات:', error);
            showMessage('خطأ في إعادة تشفير البيانات', 'error');
            return false;
        }
    }

    /**
     * إنشاء نسخة احتياطية من مفتاح التشفير
     */
    async backupEncryptionKey() {
        try {
            const result = await API.request('encryption/backup-key', 'POST');
            if (result.success) {
                showMessage('تم إنشاء نسخة احتياطية من مفتاح التشفير');
                return result.data.backup_file;
            } else {
                showMessage(result.message, 'error');
                return null;
            }
        } catch (error) {
            console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
            showMessage('خطأ في إنشاء النسخة الاحتياطية', 'error');
            return null;
        }
    }

    /**
     * قائمة النسخ الاحتياطية
     */
    async listBackups() {
        try {
            const result = await API.request('encryption/list-backups');
            if (result.success) {
                return result.data.backups;
            } else {
                showMessage(result.message, 'error');
                return [];
            }
        } catch (error) {
            console.error('خطأ في قائمة النسخ الاحتياطية:', error);
            showMessage('خطأ في قائمة النسخ الاحتياطية', 'error');
            return [];
        }
    }

    /**
     * استعادة مفتاح التشفير من النسخة الاحتياطية
     */
    async restoreFromBackup(backupFile) {
        try {
            const result = await API.request('encryption/restore-backup', 'POST', { backup_file: backupFile });
            if (result.success) {
                showMessage('تم استعادة مفتاح التشفير من النسخة الاحتياطية');
                return true;
            } else {
                showMessage(result.message, 'error');
                return false;
            }
        } catch (error) {
            console.error('خطأ في استعادة النسخة الاحتياطية:', error);
            showMessage('خطأ في استعادة النسخة الاحتياطية', 'error');
            return false;
        }
    }

    /**
     * عرض واجهة إدارة التشفير
     */
    showEncryptionManagement() {
        const section = document.getElementById('settings-section');
        if (!section) return;

        section.innerHTML = `
            <div class="section-header">
                <h2><i class="bi bi-shield-lock"></i> إدارة التشفير</h2>
            </div>

            <div class="settings-container">
                <div class="settings-section">
                    <h3><i class="bi bi-key"></i> إعدادات التشفير</h3>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="encryptionEnabled" ${this.encryptionEnabled ? 'checked' : ''}>
                            تفعيل التشفير للبيانات الحساسة
                        </label>
                    </div>

                    <div class="form-group">
                        <label>مفتاح التشفير الحالي</label>
                        <div class="input-group">
                            <input type="password" id="currentKey" value="${this.currentKey || ''}" readonly>
                            <button onclick="toggleKeyVisibility()" class="btn btn-secondary">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <button onclick="generateNewKey()" class="btn btn-primary">
                            <i class="bi bi-key-fill"></i> إنشاء مفتاح جديد
                        </button>
                        <button onclick="updateEncryptionKey()" class="btn btn-warning">
                            <i class="bi bi-arrow-clockwise"></i> تحديث المفتاح
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="bi bi-shield-check"></i> إدارة البيانات</h3>
                    
                    <div class="form-group">
                        <button onclick="reencryptAllData()" class="btn btn-info">
                            <i class="bi bi-arrow-repeat"></i> إعادة تشفير جميع البيانات
                        </button>
                        <button onclick="backupEncryptionKey()" class="btn btn-success">
                            <i class="bi bi-download"></i> إنشاء نسخة احتياطية
                        </button>
                    </div>

                    <div class="form-group">
                        <button onclick="showBackupsList()" class="btn btn-secondary">
                            <i class="bi bi-list"></i> عرض النسخ الاحتياطية
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="bi bi-info-circle"></i> معلومات التشفير</h3>
                    <div class="info-box">
                        <p><strong>نوع التشفير:</strong> AES-256-GCM</p>
                        <p><strong>الحقول المشفرة:</strong> كلمات المرور، أسماء المستخدمين، الإيميلات</p>
                        <p><strong>حالة التشفير:</strong> ${this.encryptionEnabled ? 'مفعل' : 'معطل'}</p>
                    </div>
                </div>
            </div>

            <!-- نموذج تحديث المفتاح -->
            <div id="updateKeyModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>تحديث مفتاح التشفير</h3>
                        <button onclick="closeUpdateKeyModal()" class="btn-close">&times;</button>
                    </div>
                    <form onsubmit="updateEncryptionKey(event)">
                        <div class="form-group">
                            <label for="newKey">المفتاح الجديد</label>
                            <input type="password" id="newKey" required placeholder="أدخل المفتاح الجديد">
                        </div>
                        <div class="form-group">
                            <label for="confirmKey">تأكيد المفتاح</label>
                            <input type="password" id="confirmKey" required placeholder="أكد المفتاح الجديد">
                        </div>
                        <div class="modal-footer">
                            <button type="button" onclick="closeUpdateKeyModal()" class="btn btn-secondary">إلغاء</button>
                            <button type="submit" class="btn btn-primary">تحديث</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- قائمة النسخ الاحتياطية -->
            <div id="backupsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>النسخ الاحتياطية</h3>
                        <button onclick="closeBackupsModal()" class="btn-close">&times;</button>
                    </div>
                    <div id="backupsList"></div>
                    <div class="modal-footer">
                        <button onclick="closeBackupsModal()" class="btn btn-secondary">إغلاق</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// إنشاء مثيل عام لإدارة التشفير
const encryptionSettings = new EncryptionSettings();

// دوال مساعدة للواجهة
function toggleKeyVisibility() {
    const keyInput = document.getElementById('currentKey');
    const toggleBtn = keyInput.nextElementSibling;
    const icon = toggleBtn.querySelector('i');
    
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        keyInput.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

async function generateNewKey() {
    const newKey = await encryptionSettings.generateNewKey();
    if (newKey) {
        document.getElementById('currentKey').value = newKey;
        await encryptionSettings.saveEncryptionSettings();
    }
}

function updateEncryptionKey() {
    document.getElementById('updateKeyModal').style.display = 'flex';
}

async function updateEncryptionKey(event) {
    event.preventDefault();
    
    const newKey = document.getElementById('newKey').value;
    const confirmKey = document.getElementById('confirmKey').value;
    
    if (newKey !== confirmKey) {
        showMessage('المفتاحان غير متطابقين', 'error');
        return;
    }
    
    const success = await encryptionSettings.updateEncryptionKey(newKey);
    if (success) {
        document.getElementById('currentKey').value = newKey;
        closeUpdateKeyModal();
        await encryptionSettings.saveEncryptionSettings();
    }
}

function closeUpdateKeyModal() {
    document.getElementById('updateKeyModal').style.display = 'none';
    document.getElementById('newKey').value = '';
    document.getElementById('confirmKey').value = '';
}

async function reencryptAllData() {
    if (confirm('هل أنت متأكد من إعادة تشفير جميع البيانات؟ هذا قد يستغرق وقتاً طويلاً.')) {
        await encryptionSettings.reencryptAllData();
    }
}

async function backupEncryptionKey() {
    await encryptionSettings.backupEncryptionKey();
}

async function showBackupsList() {
    const backups = await encryptionSettings.listBackups();
    const backupsList = document.getElementById('backupsList');
    
    if (backups.length === 0) {
        backupsList.innerHTML = '<p>لا توجد نسخ احتياطية</p>';
    } else {
        backupsList.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <p><strong>الملف:</strong> ${backup.file}</p>
                <p><strong>التاريخ:</strong> ${new Date(backup.date * 1000).toLocaleString('ar-SA')}</p>
                <p><strong>الحجم:</strong> ${backup.size} بايت</p>
                <button onclick="restoreFromBackup('${backup.file}')" class="btn btn-warning btn-sm">
                    <i class="bi bi-arrow-clockwise"></i> استعادة
                </button>
            </div>
        `).join('');
    }
    
    document.getElementById('backupsModal').style.display = 'flex';
}

function closeBackupsModal() {
    document.getElementById('backupsModal').style.display = 'none';
}

async function restoreFromBackup(backupFile) {
    if (confirm('هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم استبدال المفتاح الحالي.')) {
        const success = await encryptionSettings.restoreFromBackup(backupFile);
        if (success) {
            closeBackupsModal();
            await encryptionSettings.loadEncryptionSettings();
            encryptionSettings.showEncryptionManagement();
        }
    }
}

// تصدير إدارة التشفير للاستخدام العام
window.EncryptionSettings = encryptionSettings;

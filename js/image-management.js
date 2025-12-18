/**
 * إدارة نظام الصور والحذف التلقائي
 * واجهة المستخدم لإدارة إعدادات الصور والنسخ الاحتياطية
 */

class ImageManagement {
    constructor() {
        this.settings = null;
        this.stats = null;
    }

    /**
     * تحميل إعدادات الصور
     */
    async loadSettings() {
        try {
            const response = await API.request('image-management.php?action=get_settings', 'GET');
            if (response.success) {
                this.settings = response.data;
                this.displaySettings();
            }
        } catch (error) {
            console.error('خطأ في تحميل إعدادات الصور:', error);
            showMessage('خطأ في تحميل إعدادات الصور', 'error');
        }
    }

    /**
     * تحميل إحصائيات الصور
     */
    async loadStats() {
        try {
            const response = await API.request('image-management.php?action=get_stats', 'GET');
            if (response.success) {
                this.stats = response.data;
                this.displayStats();
            }
        } catch (error) {
            console.error('خطأ في تحميل إحصائيات الصور:', error);
        }
    }

    /**
     * عرض إعدادات الصور
     */
    displaySettings() {
        if (!this.settings) return;

        const container = document.getElementById('image-management-section');
        if (!container) return;

        const settings = this.settings.image_storage_settings;
        const messages = this.settings.user_messages;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="bi bi-images"></i> إدارة نظام الصور</h2>
                <div class="header-actions">
                    <button onclick="imageManagement.loadStats()" class="btn btn-secondary btn-sm">
                        <i class="bi bi-arrow-clockwise"></i> تحديث الإحصائيات
                    </button>
                    <button onclick="imageManagement.performManualCleanup()" class="btn btn-warning btn-sm">
                        <i class="bi bi-trash3"></i> تنظيف يدوي
                    </button>
                </div>
            </div>

            <!-- إشعار مهم -->
            <div class="alert alert-info" style="margin-bottom: 20px;">
                <h4><i class="bi bi-info-circle-fill"></i> إشعار مهم</h4>
                <p>${messages.auto_delete_notice}</p>
                <div style="margin-top: 10px;">
                    <a href="https://wa.me/+201102289090"> 
                       target="_blank" class="btn btn-success btn-sm">
                        <i class="bi bi-whatsapp"></i> التواصل عبر واتساب
                    </a>
                </div>
            </div>

            <!-- الإحصائيات -->
            <div class="stats-grid" id="image-stats-container">
                <!-- سيتم ملؤها بواسطة displayStats() -->
            </div>

            <!-- إعدادات النظام -->
            <div class="settings-container">
                <div class="settings-section">
                    <h3><i class="bi bi-gear"></i> إعدادات الحذف التلقائي</h3>
                    <form id="imageSettingsForm" onsubmit="imageManagement.updateSettings(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="autoDeleteEnabled" ${settings.auto_delete_enabled ? 'checked' : ''}>
                                    تفعيل الحذف التلقائي
                                </label>
                            </div>
                            <div class="form-group">
                                <label for="retentionDays">عدد أيام الاحتفاظ بالصور</label>
                                <input type="number" id="retentionDays" value="${settings.retention_days}" min="1" max="365">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="backupBeforeDelete" ${settings.backup_before_delete ? 'checked' : ''}>
                                    إنشاء نسخة احتياطية قبل الحذف
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="notificationEnabled" ${settings.notification_enabled ? 'checked' : ''}>
                                    تفعيل الإشعارات
                                </label>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="maxStorageSize">الحد الأقصى لمساحة التخزين (MB)</label>
                                <input type="number" id="maxStorageSize" value="${settings.max_storage_size_mb}" min="100" max="10000">
                            </div>
                            <div class="form-group">
                                <label for="compressionQuality">جودة الضغط (%)</label>
                                <input type="number" id="compressionQuality" value="${settings.compression_quality}" min="10" max="100">
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save-fill"></i> حفظ الإعدادات
                        </button>
                    </form>
                </div>

                <!-- النسخ الاحتياطية -->
                <div class="settings-section">
                    <h3><i class="bi bi-archive"></i> النسخ الاحتياطية</h3>
                    <div class="backup-actions">
                        <button onclick="imageManagement.createBackup()" class="btn btn-success">
                            <i class="bi bi-plus-circle"></i> إنشاء نسخة احتياطية
                        </button>
                        <button onclick="imageManagement.showBackupHistory()" class="btn btn-info">
                            <i class="bi bi-clock-history"></i> تاريخ النسخ الاحتياطية
                        </button>
                    </div>
                </div>

                <!-- معلومات النظام -->
                <div class="settings-section">
                    <h3><i class="bi bi-info-circle"></i> معلومات النظام</h3>
                    <div class="system-info">
                        <p><strong>الإصدار:</strong> ${this.settings.system_info.version}</p>
                        <p><strong>تاريخ الإنشاء:</strong> ${this.settings.system_info.created_date}</p>
                        <p><strong>آخر تحديث:</strong> ${this.settings.system_info.last_updated}</p>
                        <p><strong>مسار التخزين:</strong> ${settings.storage_path}</p>
                        <p><strong>مسار النسخ الاحتياطية:</strong> ${settings.backup_path}</p>
                    </div>
                </div>
            </div>
        `;

        // تحميل الإحصائيات
        this.loadStats();
    }

    /**
     * عرض إحصائيات الصور
     */
    displayStats() {
        if (!this.stats) return;

        const container = document.getElementById('image-stats-container');
        if (!container) return;

        const usagePercent = this.stats.storage_usage_percent;
        const usageColor = usagePercent > 90 ? '#f44336' : usagePercent > 80 ? '#ff9800' : '#4caf50';

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="color: #2196F3; font-size: 2rem;">
                    <i class="bi bi-images"></i>
                </div>
                <div class="stat-content">
                    <h3>${this.stats.total_images}</h3>
                    <p>إجمالي الصور</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="color: ${usageColor}; font-size: 2rem;">
                    <i class="bi bi-hdd"></i>
                </div>
                <div class="stat-content">
                    <h3>${this.stats.total_size_mb} MB</h3>
                    <p>حجم التخزين المستخدم</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="color: #ff9800; font-size: 2rem;">
                    <i class="bi bi-trash3"></i>
                </div>
                <div class="stat-content">
                    <h3>${this.stats.images_to_delete}</h3>
                    <p>صور للحذف (${this.stats.retention_days} يوم)</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="color: #4caf50; font-size: 2rem;">
                    <i class="bi bi-percent"></i>
                </div>
                <div class="stat-content">
                    <h3>${usagePercent}%</h3>
                    <p>نسبة استخدام المساحة</p>
                </div>
            </div>
        `;

        // إضافة شريط التقدم
        container.innerHTML += `
            <div class="progress-container" style="grid-column: 1 / -1; margin-top: 20px;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${usagePercent}%; background: ${usageColor};"></div>
                </div>
                <p style="text-align: center; margin-top: 10px; color: #666;">
                    استخدام المساحة: ${this.stats.total_size_mb} MB من ${this.settings.image_storage_settings.max_storage_size_mb} MB
                </p>
            </div>
        `;
    }

    /**
     * تحديث إعدادات الصور
     */
    async updateSettings(event) {
        event.preventDefault();

        const newSettings = {
            image_storage_settings: {
                auto_delete_enabled: document.getElementById('autoDeleteEnabled').checked,
                retention_days: parseInt(document.getElementById('retentionDays').value),
                backup_before_delete: document.getElementById('backupBeforeDelete').checked,
                notification_enabled: document.getElementById('notificationEnabled').checked,
                max_storage_size_mb: parseInt(document.getElementById('maxStorageSize').value),
                compression_quality: parseInt(document.getElementById('compressionQuality').value)
            }
        };

        try {
            const response = await API.request('image-management.php', 'POST', {
                action: 'update_settings',
                settings: newSettings
            });

            if (response.success) {
                showMessage('تم تحديث الإعدادات بنجاح', 'success');
                this.loadSettings();
            } else {
                showMessage(response.message, 'error');
            }
        } catch (error) {
            console.error('خطأ في تحديث الإعدادات:', error);
            showMessage('خطأ في تحديث الإعدادات', 'error');
        }
    }

    /**
     * تنفيذ عملية تنظيف يدوية
     */
    async performManualCleanup() {
        if (!confirmAction('هل أنت متأكد من تنفيذ عملية التنظيف؟ سيتم حذف الصور التي مضى عليها أكثر من 30 يوم.')) {
            return;
        }

        try {
            showMessage('جاري تنفيذ عملية التنظيف...', 'info');
            
            const response = await API.request('image-management.php', 'POST', {
                action: 'manual_cleanup'
            });

            if (response.success) {
                const result = response.data;
                showMessage(`تم حذف ${result.deleted_count} صورة وتحرير ${result.deleted_size_mb} MB`, 'success');
                this.loadStats();
            } else {
                showMessage(response.message, 'error');
            }
        } catch (error) {
            console.error('خطأ في عملية التنظيف:', error);
            showMessage('خطأ في عملية التنظيف', 'error');
        }
    }

    /**
     * إنشاء نسخة احتياطية
     */
    async createBackup() {
        try {
            showMessage('جاري إنشاء النسخة الاحتياطية...', 'info');
            
            const response = await API.request('image-management.php', 'POST', {
                action: 'create_backup'
            });

            if (response.success) {
                showMessage('تم إنشاء النسخة الاحتياطية بنجاح', 'success');
            } else {
                showMessage(response.message, 'error');
            }
        } catch (error) {
            console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
            showMessage('خطأ في إنشاء النسخة الاحتياطية', 'error');
        }
    }

    /**
     * عرض تاريخ النسخ الاحتياطية
     */
    showBackupHistory() {
        if (!this.settings || !this.settings.cleanup_history) {
            showMessage('لا يوجد تاريخ للنسخ الاحتياطية', 'info');
            return;
        }

        const history = this.settings.cleanup_history;
        let historyHtml = '<h3>تاريخ عمليات التنظيف</h3><div class="history-list">';

        history.slice(-10).reverse().forEach(entry => {
            historyHtml += `
                <div class="history-item">
                    <div class="history-date">${entry.date}</div>
                    <div class="history-details">
                        تم حذف ${entry.deleted_count} صورة (${entry.deleted_size_mb} MB)
                        ${entry.backup_created ? '<span class="backup-badge">نسخة احتياطية</span>' : ''}
                    </div>
                </div>
            `;
        });

        historyHtml += '</div>';

        // عرض في modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="bi bi-clock-history"></i> تاريخ عمليات التنظيف</h2>
                    <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${historyHtml}
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}

// إنشاء instance عام
window.imageManagement = new ImageManagement();


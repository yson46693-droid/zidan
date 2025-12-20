/**
 * إدارة سجلات الأخطاء
 */

(function() {
    'use strict';
    
    const API_BASE = 'api/error-logs.php';
    let currentLogs = [];
    let filteredLogs = [];
    
    // تهيئة الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        loadLogs();
        
        // إضافة مستمعين للأحداث
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(applyFilters, 300));
        }
        
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', applyFilters);
        }
        
        // تحديث تلقائي كل 30 ثانية
        setInterval(loadLogs, 30000);
    });
    
    /**
     * تحميل السجلات
     */
    async function loadLogs() {
        try {
            const linesInput = document.getElementById('linesInput');
            const lines = linesInput ? parseInt(linesInput.value) || 1000 : 1000;
            
            showLoading(true);
            
            const response = await fetch(`${API_BASE}?lines=${lines}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'فشل تحميل السجلات');
            }
            
            currentLogs = result.data.logs || [];
            updateStats(currentLogs);
            applyFilters();
            
        } catch (error) {
            console.error('خطأ في تحميل السجلات:', error);
            showToast('فشل تحميل السجلات: ' + error.message, true);
            showEmptyState(true);
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * تحديث الإحصائيات
     */
    function updateStats(logs) {
        const stats = {
            total: logs.length,
            error: 0,
            warning: 0,
            info: 0
        };
        
        logs.forEach(log => {
            if (log.type === 'error') {
                stats.error++;
            } else if (log.type === 'warning') {
                stats.warning++;
            } else {
                stats.info++;
            }
        });
        
        const totalEl = document.getElementById('totalLogs');
        const errorEl = document.getElementById('errorCount');
        const warningEl = document.getElementById('warningCount');
        const infoEl = document.getElementById('infoCount');
        
        if (totalEl) totalEl.textContent = stats.total.toLocaleString('ar-EG');
        if (errorEl) errorEl.textContent = stats.error.toLocaleString('ar-EG');
        if (warningEl) warningEl.textContent = stats.warning.toLocaleString('ar-EG');
        if (infoEl) infoEl.textContent = stats.info.toLocaleString('ar-EG');
    }
    
    /**
     * تطبيق الفلاتر
     */
    function applyFilters() {
        const typeFilter = document.getElementById('typeFilter');
        const searchInput = document.getElementById('searchInput');
        
        const type = typeFilter ? typeFilter.value : '';
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        filteredLogs = currentLogs.filter(log => {
            // فلترة حسب النوع
            if (type && log.type !== type) {
                return false;
            }
            
            // فلترة حسب البحث
            if (search) {
                const searchText = (log.message || '').toLowerCase() + 
                                 (log.timestamp || '').toLowerCase() +
                                 (log.raw || '').toLowerCase();
                if (!searchText.includes(search)) {
                    return false;
                }
            }
            
            return true;
        });
        
        renderLogs(filteredLogs);
    }
    
    /**
     * عرض السجلات
     */
    function renderLogs(logs) {
        const tableBody = document.getElementById('logsTableBody');
        const table = document.getElementById('logsTable');
        const emptyState = document.getElementById('emptyState');
        
        if (!tableBody) return;
        
        // مسح الجدول
        tableBody.innerHTML = '';
        
        if (logs.length === 0) {
            if (table) table.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (table) table.style.display = 'table';
        if (emptyState) emptyState.style.display = 'none';
        
        // عرض السجلات
        logs.forEach((log, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${log.line_number || (index + 1)}</td>
                <td>${formatTimestamp(log.timestamp)}</td>
                <td><span class="log-type ${log.type}">${getTypeLabel(log.type)}</span></td>
                <td>
                    <div class="log-message" title="${escapeHtml(log.message)}">
                        ${escapeHtml(truncateText(log.message, 150))}
                    </div>
                </td>
                <td>
                    <div class="log-actions">
                        <button class="btn-copy" onclick="copyLog(${index})" title="نسخ السجل">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </td>
            `;
            
            // حفظ الفهرس في السجل
            row.dataset.logIndex = index;
            
            tableBody.appendChild(row);
        });
    }
    
    /**
     * نسخ سجل
     */
    window.copyLog = function(index) {
        const log = filteredLogs[index];
        if (!log) return;
        
        const textToCopy = log.raw || log.message || '';
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('تم نسخ السجل بنجاح');
            }).catch(err => {
                console.error('فشل النسخ:', err);
                fallbackCopy(textToCopy);
            });
        } else {
            fallbackCopy(textToCopy);
        }
    };
    
    /**
     * نسخ احتياطي
     */
    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('تم نسخ السجل بنجاح');
        } catch (err) {
            console.error('فشل النسخ:', err);
            showToast('فشل نسخ السجل', true);
        }
        
        document.body.removeChild(textArea);
    }
    
    /**
     * حذف جميع السجلات
     */
    window.clearLogs = async function() {
        if (!confirm('هل أنت متأكد من حذف جميع السجلات؟\n\nهذه العملية لا يمكن التراجع عنها.')) {
            return;
        }
        
        try {
            const response = await fetch(API_BASE, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'فشل حذف السجلات');
            }
            
            showToast('تم حذف جميع السجلات بنجاح');
            setTimeout(() => {
                loadLogs();
            }, 500);
            
        } catch (error) {
            console.error('خطأ في حذف السجلات:', error);
            showToast('فشل حذف السجلات: ' + error.message, true);
        }
    };
    
    /**
     * تحديث السجلات
     */
    window.refreshLogs = function() {
        loadLogs();
    };
    
    /**
     * تطبيق الفلاتر (من الزر)
     */
    window.applyFilters = function() {
        applyFilters();
    };
    
    /**
     * عرض/إخفاء مؤشر التحميل
     */
    function showLoading(show) {
        const loading = document.getElementById('loadingIndicator');
        const table = document.getElementById('logsTable');
        const emptyState = document.getElementById('emptyState');
        
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (table && !show) table.style.display = 'table';
        if (emptyState && !show) emptyState.style.display = 'none';
    }
    
    /**
     * عرض/إخفاء الحالة الفارغة
     */
    function showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        const table = document.getElementById('logsTable');
        const loading = document.getElementById('loadingIndicator');
        
        if (emptyState) emptyState.style.display = show ? 'block' : 'none';
        if (table) table.style.display = show ? 'none' : 'table';
        if (loading) loading.style.display = 'none';
    }
    
    /**
     * تنسيق التاريخ والوقت
     */
    function formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        
        try {
            // محاولة تحليل التاريخ
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        } catch (e) {
            // في حالة الفشل، إرجاع النص كما هو
        }
        
        return timestamp;
    }
    
    /**
     * الحصول على تسمية النوع
     */
    function getTypeLabel(type) {
        const labels = {
            'error': 'خطأ',
            'warning': 'تحذير',
            'info': 'معلومات'
        };
        return labels[type] || type;
    }
    
    /**
     * تقصير النص
     */
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * الهروب من HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    /**
     * عرض رسالة Toast
     */
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.style.background = isError ? '#f44336' : '#4caf50';
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    /**
     * Debounce function
     */
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
})();

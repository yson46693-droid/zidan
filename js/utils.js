// دوال مساعدة

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
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// تنسيق التاريخ والوقت
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
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

// الحصول على الحالة بالعربية
function getStatusText(status) {
    const statuses = {
        'pending': 'قيد الانتظار',
        'in_progress': 'قيد الإصلاح',
        'ready': 'جاهز',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return statuses[status] || status;
}

// الحصول لون الحالة
function getStatusColor(status) {
    const colors = {
        'pending': '#FFA500',
        'in_progress': '#2196F3',
        'ready': '#4CAF50',
        'delivered': '#4CAF50',
        'cancelled': '#f44336'
    };
    return colors[status] || '#999';
}

// الحصول على الدور بالعربية
function getRoleText(role) {
    const roles = {
        'admin': 'مالك',
        'manager': 'مدير',
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
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    return isDark;
}

// تحميل الوضع الليلي
function loadDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
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


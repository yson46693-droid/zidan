// إدارة المصروفات

let allExpenses = [];
let currentExpensePage = 1;
const expensesPerPage = 10;
let allSalaries = [];
let currentSalaryPage = 1;
const salariesPerPage = 10;
let allBranches = [];
let currentBranchId = null;

function loadExpensesSection() {
    const section = document.getElementById('expenses-section');
    if (!section) {
        console.error('expenses-section not found');
        return;
    }
    
    section.innerHTML = `
        <div class="section-header">
            <button onclick="showAddExpenseModal()" class="btn btn-primary"><i class="bi bi-plus-circle"></i> إضافة مصروف</button>
        </div>

        <!-- Grid Layout للمصروفات والمستحقات -->
        <div class="expenses-grid-container">
            <!-- جدول المصروفات -->
            <div class="expenses-table-wrapper">
                <h3 class="table-title"><i class="bi bi-cash-stack"></i> المصروفات</h3>
                <div class="filters-bar">
                    <input type="text" id="expenseSearch" placeholder="بحث..." class="search-input">
                    <select id="expenseTypeFilter" onchange="filterExpenses()" class="filter-select">
                        <option value="">جميع الأنواع</option>
                        <option value="إيجار">إيجار</option>
                        <option value="كهرباء">كهرباء</option>
                        <option value="رواتب">رواتب</option>
                        <option value="قطع غيار">قطع غيار</option>
                        <option value="أخرى">أخرى</option>
                    </select>
                </div>

                <div class="table-container">
                    <table class="data-table" id="expensesTable">
                        <thead>
                            <tr>
                                <th>النوع</th>
                                <th>المبلغ</th>
                                <th>التاريخ</th>
                                <th>الوصف</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="expensesTableBody"></tbody>
                    </table>
                </div>

                <div class="pagination" id="expensesPagination"></div>
            </div>

            <!-- جدول المستحقات -->
            <div class="salaries-table-wrapper">
                <h3 class="table-title"><i class="bi bi-person-badge"></i> المستحقات</h3>
                <div class="filters-bar">
                    <select id="salaryBranchFilter" onchange="filterSalaries()" class="filter-select">
                        <option value="">جميع الفروع</option>
                    </select>
                    <input type="text" id="salarySearch" placeholder="بحث..." class="search-input">
                </div>

                <div class="table-container">
                    <table class="data-table" id="salariesTable">
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الراتب</th>
                                <th>المسحوبات</th>
                                <th>الصافي</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="salariesTableBody"></tbody>
                    </table>
                </div>

                <div class="pagination" id="salariesPagination"></div>
            </div>
        </div>

        <!-- نموذج إضافة/تعديل مصروف -->
        <div id="expenseModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="expenseModalTitle">إضافة مصروف</h3>
                    <button onclick="closeExpenseModal()" class="btn-close">&times;</button>
                </div>
                <form id="expenseForm" onsubmit="saveExpense(event)">
                    <input type="hidden" id="expenseId">
                    
                    <div class="form-group">
                        <label for="expenseType">النوع *</label>
                        <select id="expenseType" required>
                            <option value="">اختر النوع</option>
                            <option value="إيجار">إيجار</option>
                            <option value="كهرباء">كهرباء</option>
                            <option value="رواتب">رواتب</option>
                            <option value="قطع غيار">قطع غيار</option>
                            <option value="أخرى">أخرى</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="expenseAmount">المبلغ *</label>
                        <input type="number" id="expenseAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="expenseDate">التاريخ *</label>
                        <input type="date" id="expenseDate" required>
                    </div>

                    <div class="form-group">
                        <label for="expenseDescription">الوصف</label>
                        <textarea id="expenseDescription" rows="2"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeExpenseModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- مودال بروفايل المستخدم -->
        <div id="userProfileModal" class="modal">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3 id="userProfileModalTitle">بروفايل المستخدم</h3>
                    <button onclick="closeUserProfileModal()" class="btn-close">&times;</button>
                </div>
                <div id="userProfileContent">
                    <div style="text-align: center; padding: 20px;">
                        <i class="bi bi-hourglass-split"></i> جاري التحميل...
                    </div>
                </div>
            </div>
        </div>

        <!-- مودال إضافة/تعديل مسحوبة/خصم -->
        <div id="deductionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="deductionModalTitle">إضافة مسحوبة/خصم</h3>
                    <button onclick="closeDeductionModal()" class="btn-close">&times;</button>
                </div>
                <form id="deductionForm" onsubmit="saveDeduction(event)">
                    <input type="hidden" id="deductionId">
                    <input type="hidden" id="deductionUserId">
                    
                    <div class="form-group">
                        <label for="deductionType">النوع *</label>
                        <select id="deductionType" required>
                            <option value="withdrawal">مسحوبة</option>
                            <option value="deduction">خصم</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="deductionAmount">المبلغ *</label>
                        <input type="number" id="deductionAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="deductionMonthYear">الشهر *</label>
                        <input type="month" id="deductionMonthYear" required>
                    </div>

                    <div class="form-group">
                        <label for="deductionDescription">الوصف</label>
                        <textarea id="deductionDescription" rows="2"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeDeductionModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    loadExpenses();
    loadBranches();
    loadSalaries();
    
    // إضافة event listeners للبحث
    const expenseSearchInput = document.getElementById('expenseSearch');
    const salarySearchInput = document.getElementById('salarySearch');
    
    if (expenseSearchInput) {
        expenseSearchInput.addEventListener('input', debounce(() => {
            searchTable('expenseSearch', 'expensesTable');
        }, 300));
    }
    
    if (salarySearchInput) {
        salarySearchInput.addEventListener('input', debounce(() => {
            filterSalaries();
        }, 300));
    }
}

async function loadExpenses() {
    const result = await API.getExpenses();
    if (result.success) {
        allExpenses = result.data;
        filterExpenses();
    }
}

function filterExpenses() {
    const typeFilter = document.getElementById('expenseTypeFilter').value;
    let filtered = allExpenses;

    if (typeFilter) {
        filtered = allExpenses.filter(e => e.type === typeFilter);
    }

    displayExpenses(filtered);
}

function displayExpenses(expenses) {
    const paginated = paginate(expenses, currentExpensePage, expensesPerPage);
    const tbody = document.getElementById('expensesTableBody');

    if (paginated.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد مصروفات</td></tr>';
        return;
    }

    tbody.innerHTML = paginated.data.map(expense => `
        <tr>
            <td><strong>${expense.type}</strong></td>
            <td><strong style="color: var(--danger-color);">${formatCurrency(expense.amount)}</strong></td>
            <td>${formatDate(expense.date)}</td>
            <td>${expense.description || '-'}</td>
            <td>
                <button onclick="editExpense('${expense.id}')" class="btn btn-sm btn-icon" title="تعديل"><i class="bi bi-pencil-square"></i></button>
                <button onclick="deleteExpense('${expense.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `).join('');

    createPaginationButtons(
        document.getElementById('expensesPagination'),
        paginated.totalPages,
        currentExpensePage,
        (page) => {
            currentExpensePage = page;
            filterExpenses();
        }
    );

    hideByPermission();
}

function showAddExpenseModal() {
    document.getElementById('expenseModalTitle').textContent = 'إضافة مصروف';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseDate').value = getTodayDate();
    document.getElementById('expenseModal').style.display = 'flex';
}

function closeExpenseModal() {
    document.getElementById('expenseModal').style.display = 'none';
}

async function saveExpense(event) {
    event.preventDefault();

    // التحقق من الحقول المطلوبة
    const type = document.getElementById('expenseType').value;
    const amount = document.getElementById('expenseAmount').value.trim();
    const date = document.getElementById('expenseDate').value;

    if (!type || !amount || !date) {
        showMessage('النوع والمبلغ والتاريخ مطلوبة', 'error');
        return;
    }

    const expenseData = {
        type: type,
        amount: parseFloat(amount),
        date: date,
        description: document.getElementById('expenseDescription').value.trim()
    };

    const expenseId = document.getElementById('expenseId').value;
    let result;

    if (expenseId) {
        expenseData.id = expenseId;
        result = await API.updateExpense(expenseData);
    } else {
        result = await API.addExpense(expenseData);
    }

    if (result.success) {
        showMessage(result.message);
        closeExpenseModal();
        loadExpenses();
        if (typeof currentSection !== 'undefined' && currentSection === 'dashboard') {
            loadDashboardData();
        }
    } else {
        showMessage(result.message, 'error');
    }
}

async function editExpense(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById('expenseModalTitle').textContent = 'تعديل المصروف';
    document.getElementById('expenseId').value = expense.id;
    document.getElementById('expenseType').value = expense.type;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseDate').value = expense.date;
    document.getElementById('expenseDescription').value = expense.description || '';
    
    document.getElementById('expenseModal').style.display = 'flex';
}

async function deleteExpense(id) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية لحذف المصروفات', 'error');
        return;
    }

    if (!confirmAction('هل أنت متأكد من حذف هذا المصروف؟')) return;

    const result = await API.deleteExpense(id);
    if (result.success) {
        showMessage(result.message);
        loadExpenses();
    } else {
        showMessage(result.message, 'error');
    }
}

// ========== دوال المستحقات ==========

async function loadBranches() {
    try {
        const result = await API.request('branches.php', 'GET');
        if (result.success && result.data) {
            allBranches = result.data;
            
            const branchFilter = document.getElementById('salaryBranchFilter');
            if (branchFilter) {
                // الحفاظ على الخيارات الموجودة
                const existingOptions = branchFilter.innerHTML;
                branchFilter.innerHTML = existingOptions;
                
                // إضافة الفروع
                allBranches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchFilter.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل الفروع:', error);
    }
}

async function loadSalaries() {
    try {
        const branchId = currentBranchId || null;
        const result = await API.getSalaries(branchId);
        if (result.success) {
            allSalaries = result.data || [];
            filterSalaries();
        } else {
            console.error('خطأ في تحميل المستحقات:', result.message);
            allSalaries = [];
            filterSalaries();
        }
    } catch (error) {
        console.error('خطأ في تحميل المستحقات:', error);
        allSalaries = [];
        filterSalaries();
    }
}

function filterSalaries() {
    const branchFilter = document.getElementById('salaryBranchFilter');
    const searchInput = document.getElementById('salarySearch');
    
    if (!branchFilter || !searchInput) return;
    
    const branchId = branchFilter.value || '';
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    currentBranchId = branchId || null;
    
    let filtered = allSalaries;
    
    // فلترة حسب الفرع
    if (branchId) {
        filtered = filtered.filter(s => s.branch_id === branchId);
    }
    
    // فلترة حسب البحث
    if (searchTerm) {
        filtered = filtered.filter(s => {
            const name = (s.name || '').toLowerCase();
            const username = (s.username || '').toLowerCase();
            return name.includes(searchTerm) || username.includes(searchTerm);
        });
    }
    
    displaySalaries(filtered);
}

function displaySalaries(salaries) {
    const tbody = document.getElementById('salariesTableBody');
    if (!tbody) return;
    
    const paginated = paginate(salaries, currentSalaryPage, salariesPerPage);
    
    if (paginated.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد مستحقات</td></tr>';
        const paginationDiv = document.getElementById('salariesPagination');
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }
    
    // استخدام DocumentFragment لتحسين الأداء
    const fragment = document.createDocumentFragment();
    
    paginated.data.forEach(salary => {
        const tr = document.createElement('tr');
        const salaryAmount = parseFloat(salary.salary || 0);
        const totalDeductions = parseFloat(salary.total_deductions || 0);
        const netSalary = salaryAmount - totalDeductions;
        
        tr.innerHTML = `
            <td>
                <div><strong>${escapeHtml(salary.name || '')}</strong></div>
                <div style="font-size: 0.85em; color: var(--text-light);">${escapeHtml(salary.username || '')}</div>
            </td>
            <td><strong style="color: var(--primary-color);">${formatCurrency(salaryAmount)}</strong></td>
            <td><strong style="color: var(--danger-color);">${formatCurrency(totalDeductions)}</strong></td>
            <td><strong style="color: var(--success-color);">${formatCurrency(netSalary)}</strong></td>
            <td>
                <button onclick="showUserProfileModal('${salary.id}')" class="btn btn-sm btn-icon" title="عرض البروفايل"><i class="bi bi-person-circle"></i></button>
                <button onclick="showAddDeductionModal('${salary.id}')" class="btn btn-sm btn-icon" title="إضافة مسحوبة/خصم" data-permission="manager"><i class="bi bi-plus-circle"></i></button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    createPaginationButtons(
        document.getElementById('salariesPagination'),
        paginated.totalPages,
        currentSalaryPage,
        (page) => {
            currentSalaryPage = page;
            filterSalaries();
        }
    );
    
    hideByPermission();
}

async function showUserProfileModal(userId) {
    try {
        const modal = document.getElementById('userProfileModal');
        const content = document.getElementById('userProfileContent');
        const title = document.getElementById('userProfileModalTitle');
        
        if (!modal || !content || !title) return;
        
        content.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        modal.style.display = 'flex';
        
        const result = await API.getUserSalaryDetails(userId);
        
        if (!result.success) {
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">${result.message || 'خطأ في تحميل البيانات'}</div>`;
            return;
        }
        
        const user = result.data;
        const salaryAmount = parseFloat(user.salary || 0);
        
        // حساب إجمالي المسحوبات للشهر الحالي
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthDeductions = user.deductions.filter(d => {
            const monthYear = d.month_year ? new Date(d.month_year).toISOString().slice(0, 7) : '';
            return monthYear === currentMonth;
        });
        const currentMonthTotal = currentMonthDeductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
        
        title.textContent = `بروفايل: ${escapeHtml(user.name || '')}`;
        
        let deductionsHtml = '';
        if (user.deductions && user.deductions.length > 0) {
            deductionsHtml = `
                <div class="deductions-list">
                    <h4>المسحوبات والخصومات</h4>
                    <table class="data-table" style="margin-top: 15px;">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>النوع</th>
                                <th>المبلغ</th>
                                <th>الوصف</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${user.deductions.map(d => `
                                <tr>
                                    <td>${formatDate(d.month_year)}</td>
                                    <td><span class="badge ${d.type === 'withdrawal' ? 'badge-warning' : 'badge-danger'}">${d.type === 'withdrawal' ? 'مسحوبة' : 'خصم'}</span></td>
                                    <td><strong style="color: var(--danger-color);">${formatCurrency(d.amount)}</strong></td>
                                    <td>${escapeHtml(d.description || '-')}</td>
                                    <td>
                                        <button onclick="editDeduction('${d.id}')" class="btn btn-sm btn-icon" title="تعديل" data-permission="manager"><i class="bi bi-pencil-square"></i></button>
                                        <button onclick="deleteDeduction('${d.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            deductionsHtml = '<p style="text-align: center; color: var(--text-light); padding: 20px;">لا توجد مسحوبات أو خصومات</p>';
        }
        
        content.innerHTML = `
            <div class="user-profile-content">
                <div class="profile-section">
                    <h4>معلومات المستخدم</h4>
                    <div class="profile-info">
                        <div class="info-item">
                            <span class="info-label">الاسم:</span>
                            <span class="info-value">${escapeHtml(user.name || '')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">اسم المستخدم:</span>
                            <span class="info-value">${escapeHtml(user.username || '')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">الدور:</span>
                            <span class="info-value">${getRoleText(user.role)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">الفرع:</span>
                            <span class="info-value">${escapeHtml(user.branch_name || 'غير محدد')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-section">
                    <h4>تفاصيل الراتب</h4>
                    <div class="salary-details">
                        <div class="salary-item">
                            <span class="salary-label">الراتب الشهري:</span>
                            <span class="salary-value primary">${formatCurrency(salaryAmount)}</span>
                        </div>
                        <div class="salary-item">
                            <span class="salary-label">المسحوبات الشهر الحالي:</span>
                            <span class="salary-value danger">${formatCurrency(currentMonthTotal)}</span>
                        </div>
                        <div class="salary-item total">
                            <span class="salary-label">الصافي الشهر الحالي:</span>
                            <span class="salary-value success">${formatCurrency(salaryAmount - currentMonthTotal)}</span>
                        </div>
                    </div>
                </div>
                
                ${deductionsHtml}
            </div>
        `;
        
        hideByPermission();
    } catch (error) {
        console.error('خطأ في عرض بروفايل المستخدم:', error);
        const content = document.getElementById('userProfileContent');
        if (content) {
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">حدث خطأ أثناء تحميل البيانات</div>`;
        }
    }
}

function closeUserProfileModal() {
    const modal = document.getElementById('userProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showAddDeductionModal(userId) {
    const modal = document.getElementById('deductionModal');
    const title = document.getElementById('deductionModalTitle');
    const form = document.getElementById('deductionForm');
    
    if (!modal || !title || !form) return;
    
    title.textContent = 'إضافة مسحوبة/خصم';
    form.reset();
    document.getElementById('deductionId').value = '';
    document.getElementById('deductionUserId').value = userId;
    
    // تعيين الشهر الحالي
    const monthInput = document.getElementById('deductionMonthYear');
    if (monthInput) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    modal.style.display = 'flex';
}

function closeDeductionModal() {
    const modal = document.getElementById('deductionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveDeduction(event) {
    event.preventDefault();
    
    try {
        const userId = document.getElementById('deductionUserId').value;
        const deductionId = document.getElementById('deductionId').value;
        const type = document.getElementById('deductionType').value;
        const amount = parseFloat(document.getElementById('deductionAmount').value);
        const monthYear = document.getElementById('deductionMonthYear').value;
        const description = document.getElementById('deductionDescription').value.trim();
        
        if (!userId || !amount || !monthYear) {
            showMessage('المستخدم والمبلغ والشهر مطلوبون', 'error');
            return;
        }
        
        const deductionData = {
            user_id: userId,
            amount: amount,
            type: type,
            description: description,
            month_year: monthYear + '-01' // إضافة اليوم الأول للشهر
        };
        
        let result;
        if (deductionId) {
            deductionData.id = deductionId;
            result = await API.updateSalaryDeduction(deductionData);
        } else {
            result = await API.addSalaryDeduction(deductionData);
        }
        
        if (result.success) {
            showMessage(result.message);
            closeDeductionModal();
            loadSalaries();
            
            // تحديث المودال إذا كان مفتوحاً
            const profileModal = document.getElementById('userProfileModal');
            if (profileModal && profileModal.style.display === 'flex') {
                const userIdInput = document.getElementById('deductionUserId');
                if (userIdInput && userIdInput.value) {
                    await showUserProfileModal(userIdInput.value);
                }
            }
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في حفظ المسحوبة/الخصم:', error);
        showMessage('حدث خطأ أثناء حفظ المسحوبة/الخصم', 'error');
    }
}

async function editDeduction(deductionId) {
    try {
        // البحث عن المسحوبة في البيانات الحالية
        let deduction = null;
        for (const salary of allSalaries) {
            if (salary.deductions) {
                deduction = salary.deductions.find(d => d.id === deductionId);
                if (deduction) break;
            }
        }
        
        if (!deduction) {
            showMessage('المسحوبة/الخصم غير موجود', 'error');
            return;
        }
        
        const modal = document.getElementById('deductionModal');
        const title = document.getElementById('deductionModalTitle');
        const form = document.getElementById('deductionForm');
        
        if (!modal || !title || !form) return;
        
        title.textContent = 'تعديل مسحوبة/خصم';
        document.getElementById('deductionId').value = deduction.id;
        document.getElementById('deductionUserId').value = deduction.user_id || '';
        document.getElementById('deductionType').value = deduction.type;
        document.getElementById('deductionAmount').value = deduction.amount;
        document.getElementById('deductionDescription').value = deduction.description || '';
        
        // تعيين الشهر
        const monthInput = document.getElementById('deductionMonthYear');
        if (monthInput && deduction.month_year) {
            const date = new Date(deduction.month_year);
            monthInput.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        modal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في تعديل المسحوبة/الخصم:', error);
        showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
    }
}

async function deleteDeduction(deductionId) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية لحذف المسحوبات/الخصومات', 'error');
        return;
    }
    
    if (!confirmAction('هل أنت متأكد من حذف هذه المسحوبة/الخصم؟')) return;
    
    try {
        const result = await API.deleteSalaryDeduction(deductionId);
        if (result.success) {
            showMessage(result.message);
            loadSalaries();
            
            // تحديث المودال إذا كان مفتوحاً
            const profileModal = document.getElementById('userProfileModal');
            if (profileModal && profileModal.style.display === 'flex') {
                const userIdInput = document.getElementById('deductionUserId');
                if (userIdInput && userIdInput.value) {
                    await showUserProfileModal(userIdInput.value);
                }
            }
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف المسحوبة/الخصم:', error);
        showMessage('حدث خطأ أثناء حذف المسحوبة/الخصم', 'error');
    }
}

// دالة مساعدة لـ escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


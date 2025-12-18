// إدارة المصروفات

let allExpenses = [];
let currentExpensePage = 1;
const expensesPerPage = 10;

function loadExpensesSection() {
    const section = document.getElementById('expenses-section');
    section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-cash-stack"></i> المصروفات</h2>
            <button onclick="showAddExpenseModal()" class="btn btn-primary"><i class="bi bi-plus-circle"></i> إضافة مصروف</button>
        </div>

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
    `;

    loadExpenses();
    searchTable('expenseSearch', 'expensesTable');
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
            <td><strong style="color: #f44336;">${formatCurrency(expense.amount)}</strong></td>
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


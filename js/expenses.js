// إدارة المصروفات

// ✅ حماية من التحميل المكرر: التحقق من أن الملف لم يتم تحميله مسبقاً
if (typeof window.expensesModuleLoaded !== 'undefined') {
    console.warn('⚠️ expenses.js تم تحميله مسبقاً - تخطي إعادة التحميل');
} else {
    window.expensesModuleLoaded = true;

let allExpenses = [];
let currentExpensePage = 1;
const expensesPerPage = 4;
let allSalaries = [];
let currentSalaryPage = 1;
const salariesPerPage = 10;
let allBranches = [];
let currentBranchId = null;

// ✅ تحسين الأداء: Flags لمنع التحميل المكرر
let isLoadingExpenses = false;
let isLoadingSalaries = false;
let isLoadingBranches = false;
let lastExpensesLoadTime = 0;
let lastSalariesLoadTime = 0;
let lastBranchesLoadTime = 0;
const EXPENSE_MIN_LOAD_INTERVAL = 2000; // 2 ثانية كحد أدنى بين الطلبات

function loadExpensesSection() {
    const section = document.getElementById('expenses-section');
    if (!section) {
        console.error('expenses-section not found');
        return;
    }
    
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    const isManager = currentUser && (currentUser.role === 'manager');
    const showAdvancedFeatures = isOwner || isManager;
    // إظهار المستحقات فقط للمستخدمين الذين ليسوا مالك أو مدير (أي الموظف والفني)
    const showSalariesSection = !isOwner && !isManager;
    
    // جميع المستخدمين يستخدمون الصفحة الجديدة (لرؤية سجل المعاملات)
    // لكن الميزات المتقدمة (مثل اختيار الفرع) تظهر فقط للمالك والمدير
    
    section.innerHTML = `
        <div class="section-header">
            ${isOwner ? `
                <div class="branch-switcher" style="margin-right: 15px;">
                    <label for="treasuryBranchSelect" style="margin-left: 10px;">اختر الفرع:</label>
                    <select id="treasuryBranchSelect" onchange="switchTreasuryBranch()" class="filter-select">
                        <option value="">جاري التحميل...</option>
                    </select>
                </div>
            ` : ''}
        </div>

        <!-- خزنة الفرع الأول -->
        <div id="branch1-treasury-section" class="treasury-section" style="display: none;">
            <div class="treasury-header">
                <h2><i class="bi bi-bank"></i> خزنة الفرع الأول</h2>
            </div>
            
            <!-- فلترة المبيعات (للفرع الأول فقط) -->
            <div class="sales-filter-section" style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px;">
                <h3 style="margin-bottom: 15px;"><i class="bi bi-cart-check"></i> المبيعات</h3>
                <div class="filters-bar" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <label>نوع الفلترة:</label>
                    <select id="branch1SalesFilterType" onchange="updateBranch1SalesFilter()" class="filter-select">
                        <option value="today">اليوم الحالي</option>
                        <option value="month" selected>الشهر الحالي</option>
                        <option value="custom">فترة مخصصة</option>
                    </select>
                    <div id="branch1CustomDateRange" style="display: none; gap: 10px; align-items: center;">
                        <input type="date" id="branch1SalesStartDate" class="filter-input">
                        <span>إلى</span>
                        <input type="date" id="branch1SalesEndDate" class="filter-input">
                        <button onclick="loadBranch1TreasuryData()" class="btn btn-sm btn-primary">تطبيق</button>
                    </div>
                </div>
                <div id="branch1SalesSummary" class="sales-summary" style="margin-top: 15px; padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div>
                            <label style="color: var(--text-light); font-size: 0.9em;">إجمالي المبيعات:</label>
                            <div style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);" id="branch1TotalSales">0 ج.م</div>
                        </div>
                        ${isOwner ? `
                        <div>
                            <label style="color: var(--text-light); font-size: 0.9em;">صافي أرباح المبيعات:</label>
                            <div style="font-size: 1.2em; font-weight: bold; color: var(--success-color);" id="branch1SalesProfit">0 ج.م</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- ملخص الخزنة -->
            <div class="treasury-summary" style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي مصروفات الفرع:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1TotalExpenses">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي تكاليف عمليات الصيانة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1RepairCosts">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي أرباح عمليات الصيانة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);" id="branch1RepairProfits">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي العمليات الخاسرة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1LossOperations">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">المرتجعات التالفة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1DamagedReturns">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">المرتجعات السليمة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1NormalReturns">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي الإيرادات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--primary-color);" id="branch1TotalRevenue">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي المسحوبات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1TotalWithdrawals">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">سحوبات من الخزنة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch1TreasuryWithdrawals">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي الإضافات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);" id="branch1TotalDeposits">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي تحصيلات الدين:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);" id="branch1DebtCollections">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--primary-color); border-radius: 8px; border: 1px solid var(--primary-color); box-shadow: var(--shadow);">
                        <label style="color: var(--white); font-size: 0.9em;">صافي رصيد الخزنة:</label>
                        <div style="font-size: 1.8em; font-weight: bold; color: var(--white);" id="branch1NetBalance">0 ج.م</div>
                    </div>
                </div>
            </div>

            <!-- Grid Layout للمصروفات والمستحقات -->
            <div class="expenses-grid-container">
                <!-- جدول المصروفات -->
                <div class="expenses-table-wrapper">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 class="table-title" style="margin: 0;"><i class="bi bi-cash-stack"></i> المصروفات</h3>
                        <button onclick="showAddExpenseModal()" class="btn btn-danger"><i class="bi bi-plus-circle"></i> تسجيل مصروف</button>
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
                                    <th>المبلغ</th>
                                    <th>التاريخ</th>
                                    <th>الوصف</th>
                                </tr>
                            </thead>
                            <tbody id="expensesTableBody"></tbody>
                        </table>
                    </div>

                    <div class="pagination" id="expensesPagination"></div>
                </div>

                <!-- جدول المستحقات -->
                <div class="salaries-table-wrapper" style="display: ${showSalariesSection ? 'block' : 'none'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 class="table-title" style="margin: 0;"><i class="bi bi-person-badge"></i> المستحقات</h3>
                        <button onclick="toggleSalaryFilters()" class="btn btn-sm btn-icon" title="فلترة" style="padding: 8px 12px;">
                            <i class="bi bi-funnel"></i> فلترة
                        </button>
                    </div>
                    <div class="filters-bar" id="salaryFiltersBar" style="display: none;">
                        <input type="text" id="salarySearch" placeholder="بحث..." class="search-input">
                        <input type="month" id="salaryMonthFilter" class="filter-select" style="min-width: 150px;" onchange="handleSalaryMonthFilterChange()">
                    </div>

                    <div class="table-container">
                        <table class="data-table" id="salariesTable">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>الراتب</th>
                                    <th>المسحوبات</th>
                                    <th>الخصومات</th>
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
        </div>

        <!-- خزنة الفرع الثاني -->
        <div id="branch2-treasury-section" class="treasury-section" style="display: none;">
            <div class="treasury-header">
                <h2><i class="bi bi-bank"></i> خزنة الفرع الثاني</h2>
            </div>
            
            <!-- ملخص الخزنة -->
            <div class="treasury-summary" style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي مصروفات الفرع:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch2TotalExpenses">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي تكاليف عمليات الصيانة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch2RepairCosts">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي العمليات الخاسرة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch2LossOperations">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي الإيرادات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--primary-color);" id="branch2TotalRevenue">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي المسحوبات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch2TotalWithdrawals">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">سحوبات من الخزنة:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);" id="branch2TreasuryWithdrawals">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي الإضافات:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);" id="branch2TotalDeposits">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                        <label style="color: var(--text-light); font-size: 0.9em;">إجمالي تحصيلات الدين:</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);" id="branch2DebtCollections">0 ج.م</div>
                    </div>
                    <div class="summary-card" style="padding: 15px; background: var(--primary-color); border-radius: 8px; border: 1px solid var(--primary-color); box-shadow: var(--shadow);">
                        <label style="color: var(--white); font-size: 0.9em;">صافي رصيد الخزنة:</label>
                        <div style="font-size: 1.8em; font-weight: bold; color: var(--white);" id="branch2NetBalance">0 ج.م</div>
                    </div>
                </div>
            </div>

            <!-- Grid Layout للمصروفات والمستحقات -->
            <div class="expenses-grid-container">
                <!-- جدول المصروفات -->
                <div class="expenses-table-wrapper">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 class="table-title" style="margin: 0;"><i class="bi bi-cash-stack"></i> المصروفات</h3>
                        <button onclick="showAddExpenseModal()" class="btn btn-danger"><i class="bi bi-plus-circle"></i> تسجيل مصروف</button>
                    </div>
                    <div class="filters-bar">
                        <input type="text" id="expenseSearch2" placeholder="بحث..." class="search-input">
                        <select id="expenseTypeFilter2" onchange="filterExpenses()" class="filter-select">
                            <option value="">جميع الأنواع</option>
                            <option value="إيجار">إيجار</option>
                            <option value="كهرباء">كهرباء</option>
                            <option value="رواتب">رواتب</option>
                            <option value="قطع غيار">قطع غيار</option>
                            <option value="أخرى">أخرى</option>
                        </select>
                    </div>

                    <div class="table-container">
                        <table class="data-table" id="expensesTable2">
                            <thead>
                                <tr>
                                    <th>المبلغ</th>
                                    <th>التاريخ</th>
                                    <th>الوصف</th>
                                </tr>
                            </thead>
                            <tbody id="expensesTableBody2"></tbody>
                        </table>
                    </div>

                    <div class="pagination" id="expensesPagination2"></div>
                </div>

                <!-- جدول المستحقات -->
                <div class="salaries-table-wrapper" style="display: ${showSalariesSection ? 'block' : 'none'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 class="table-title" style="margin: 0;"><i class="bi bi-person-badge"></i> المستحقات</h3>
                        <button onclick="toggleSalaryFilters2()" class="btn btn-sm btn-icon" title="فلترة" style="padding: 8px 12px;">
                            <i class="bi bi-funnel"></i> فلترة
                        </button>
                    </div>
                    <div class="filters-bar" id="salaryFiltersBar2" style="display: none;">
                        <input type="text" id="salarySearch2" placeholder="بحث..." class="search-input">
                        <input type="month" id="salaryMonthFilter2" class="filter-select" style="min-width: 150px;" onchange="handleSalaryMonthFilterChange2()">
                    </div>

                    <div class="table-container">
                        <table class="data-table" id="salariesTable2">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>الراتب</th>
                                    <th>المسحوبات</th>
                                    <th>الخصومات</th>
                                    <th>الصافي</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="salariesTableBody2"></tbody>
                        </table>
                    </div>

                    <div class="pagination" id="salariesPagination2"></div>
                </div>
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
                        <label for="expenseAmount">المبلغ *</label>
                        <input type="number" id="expenseAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="expenseDate">التاريخ *</label>
                        <input type="date" id="expenseDate" required>
                    </div>

                    <div class="form-group" id="expenseBranchGroup" style="display: none;">
                        <label for="expenseBranch">الفرع</label>
                        <select id="expenseBranch">
                            <option value="">اختر الفرع...</option>
                        </select>
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

        <!-- مودال إضافة/تعديل سحب/خصم -->
        <div id="deductionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="deductionModalTitle">إضافة سحب/خصم</h3>
                    <button onclick="closeDeductionModal()" class="btn-close">&times;</button>
                </div>
                <form id="deductionForm" onsubmit="saveDeduction(event)">
                    <input type="hidden" id="deductionId">
                    <input type="hidden" id="deductionUserId">
                    
                    <div class="form-group">
                        <label for="deductionType">النوع *</label>
                        <select id="deductionType" required>
                            <option value="withdrawal">سحب</option>
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
        
        <!-- مودال تعديل/إضافة الراتب -->
        <div id="editSalaryModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="editSalaryModalTitle">تعديل الراتب</h3>
                    <button onclick="closeEditSalaryModal()" class="btn-close">&times;</button>
                </div>
                <form id="editSalaryForm" onsubmit="saveSalary(event)">
                    <input type="hidden" id="editSalaryUserId">
                    
                    <div class="form-group">
                        <label for="editSalaryUserName">اسم المستخدم</label>
                        <input type="text" id="editSalaryUserName" readonly style="background: var(--light-bg);">
                    </div>

                    <div class="form-group">
                        <label for="editSalaryAmount">الراتب (ج.م) *</label>
                        <input type="number" id="editSalaryAmount" step="0.01" min="0" required>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeEditSalaryModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
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
                        <label for="expenseAmount">المبلغ *</label>
                        <input type="number" id="expenseAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="expenseDate">التاريخ *</label>
                        <input type="date" id="expenseDate" required>
                    </div>

                    <div class="form-group" id="expenseBranchGroup" style="display: none;">
                        <label for="expenseBranch">الفرع</label>
                        <select id="expenseBranch">
                            <option value="">اختر الفرع...</option>
                        </select>
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

        <!-- مودال إضافة/تعديل سحب/خصم -->
        <div id="deductionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="deductionModalTitle">إضافة سحب/خصم</h3>
                    <button onclick="closeDeductionModal()" class="btn-close">&times;</button>
                </div>
                <form id="deductionForm" onsubmit="saveDeduction(event)">
                    <input type="hidden" id="deductionId">
                    <input type="hidden" id="deductionUserId">
                    
                    <div class="form-group">
                        <label for="deductionType">النوع *</label>
                        <select id="deductionType" required>
                            <option value="withdrawal">سحب</option>
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

        <!-- مودال سحب من الخزنة -->
        <div id="withdrawalModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>سحب من الخزنة</h3>
                    <button onclick="closeWithdrawalModal()" class="btn-close">&times;</button>
                </div>
                <form id="withdrawalForm" onsubmit="saveWithdrawal(event)">
                    <div class="form-group">
                        <label for="withdrawalAmount">المبلغ *</label>
                        <input type="number" id="withdrawalAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="withdrawalDescription">الوصف</label>
                        <textarea id="withdrawalDescription" rows="3" placeholder="وصف عملية السحب (اختياري)"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeWithdrawalModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">تأكيد السحب</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- مودال إضافة إلى الخزنة -->
        <div id="depositModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>إضافة إلى الخزنة</h3>
                    <button onclick="closeDepositModal()" class="btn-close">&times;</button>
                </div>
                <form id="depositForm" onsubmit="saveDeposit(event)">
                    <div class="form-group">
                        <label for="depositAmount">المبلغ *</label>
                        <input type="number" id="depositAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="depositDescription">الوصف</label>
                        <textarea id="depositDescription" rows="3" placeholder="وصف عملية الإضافة (اختياري)"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeDepositModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">تأكيد الإضافة</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- مودال تحصيل دين من عميل تجاري -->
        <div id="debtCollectionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3><i class="bi bi-cash-coin"></i> تحصيل دين من عميل تجاري</h3>
                    <button onclick="closeDebtCollectionModal()" class="btn-close">&times;</button>
                </div>
                <form id="debtCollectionForm" onsubmit="saveDebtCollection(event)">
                    <div class="form-group">
                        <label for="debtCollectionCustomer">العميل التجاري *</label>
                        <select id="debtCollectionCustomer" required onchange="updateDebtCollectionCustomerInfo()">
                            <option value="">اختر العميل...</option>
                        </select>
                    </div>

                    <div class="form-group" id="debtCollectionCustomerInfo" style="display: none; padding: 10px; background: var(--light-bg); border-radius: 5px; margin-bottom: 15px;">
                        <div style="font-size: 0.9em; color: var(--text-light);">
                            <div><strong>إجمالي الدين:</strong> <span id="debtCollectionTotalDebt">0</span> ج.م</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="debtCollectionAmount">المبلغ المراد تحصيله (ج.م) *</label>
                        <input type="number" id="debtCollectionAmount" step="0.01" min="0.01" required>
                    </div>

                    <div class="form-group">
                        <label for="debtCollectionDescription">الوصف</label>
                        <textarea id="debtCollectionDescription" rows="3" placeholder="وصف عملية التحصيل (اختياري)"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeDebtCollectionModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-success">تأكيد التحصيل</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- جدول سجل المعاملات -->
        <div class="treasury-transactions-section" style="margin-top: 30px;">
            <div class="section-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <h2><i class="bi bi-clock-history"></i> سجل معاملات الخزنة</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="showDepositModal()" class="btn btn-success"><i class="bi bi-plus-circle"></i> إضافة إلى الخزنة</button>
                    <button onclick="showWithdrawalModal()" class="btn btn-danger"><i class="bi bi-cash-coin"></i> سحب من الخزنة</button>
                </div>
            </div>
            
            <!-- شريط الفلترة والبحث -->
            <div class="filters-bar" style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <div style="flex: 1; min-width: 200px;">
                    <label for="treasuryTransactionSearch" style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">البحث:</label>
                    <input 
                        type="text" 
                        id="treasuryTransactionSearch" 
                        placeholder="ابحث في التاريخ، النوع، المبلغ، الوصف، المستخدم..." 
                        class="search-input"
                        style="width: 100%;"
                    >
                </div>
                <div style="min-width: 200px;">
                    <label for="treasuryTransactionTypeFilter" style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">نوع المعاملة:</label>
                    <select 
                        id="treasuryTransactionTypeFilter" 
                        class="filter-select"
                        style="width: 100%;"
                    >
                        <option value="">جميع الأنواع</option>
                        <option value="مصروف">مصروف</option>
                        <option value="تكلفة صيانة">تكلفة صيانة</option>
                        <option value="ربح صيانة">ربح صيانة</option>
                        <option value="عملية خاسرة">عملية خاسرة</option>
                        <option value="إيراد مبيعات">إيراد مبيعات</option>
                        <option value="تكلفة مبيعات">تكلفة مبيعات</option>
                        <option value="سحب من الخزنة">سحب من الخزنة</option>
                        <option value="إضافة إلى الخزنة">إضافة إلى الخزنة</option>
                        <option value="مرتجع تالف">مرتجع تالف</option>
                    </select>
                </div>
            </div>
            
            <div class="table-container">
                <table class="data-table" id="treasuryTransactionsTable">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>نوع المعاملة</th>
                            <th>المبلغ</th>
                            <th>الوصف</th>
                            <th>المستخدم</th>
                        </tr>
                    </thead>
                    <tbody id="treasuryTransactionsTableBody">
                        <tr>
                            <td colspan="5" style="text-align: center;">جاري التحميل...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="pagination" id="treasuryTransactionsPagination"></div>
        </div>
    `;

    // إضافة event listeners لحقول البحث والفلترة
    setupTreasuryTransactionsFilters();

    // تحميل الفروع للمالك
    if (isOwner) {
        loadTreasuryBranches();
    }
    
    // تحديد الفرع الافتراضي
    if (isOwner) {
        // للمالك: تحميل الفرع الأول افتراضياً
        loadTreasuryBranches().then(() => {
            const branchSelect = document.getElementById('treasuryBranchSelect');
            if (branchSelect && branchSelect.options.length > 1) {
                branchSelect.value = branchSelect.options[1].value;
                switchTreasuryBranch();
            }
        });
    } else {
        // للمستخدم غير المالك: استخدام فرع المستخدم
        if (currentUser) {
            const branchId = currentUser.branch_id;
            // التحقق من أن branch_id موجود وصالح (ليس null, undefined, 0, أو string فارغ)
            if (branchId !== null && branchId !== undefined && branchId !== '' && branchId !== '0' && branchId !== 0) {
                const defaultBranchId = String(branchId).trim();
                currentTreasuryBranchId = defaultBranchId;
                // استخدام requestAnimationFrame لضمان أن DOM جاهز
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        loadTreasuryData(defaultBranchId).catch(error => {
                            console.error('خطأ في تحميل بيانات الخزنة:', error);
                            showMessage('حدث خطأ أثناء تحميل بيانات الخزنة', 'error');
                        });
                    }, 150);
                });
            } else {
                // branch_id غير موجود أو غير صالح - لكن لا نطبع خطأ لأنه قد يكون مالك أو مدير
                // (في هذه الحالة، لا يجب أن يصل الكود هنا لأن المالك والمدير يتم التعامل معهما في الشرط السابق)
            }
        }
    }
    
    // إضافة event listeners للبحث
    const expenseSearchInput = document.getElementById('expenseSearch');
    if (expenseSearchInput) {
        expenseSearchInput.addEventListener('input', debounce(() => {
            searchTable('expenseSearch', 'expensesTable');
        }, 300));
    }
    
    const salarySearchInput = document.getElementById('salarySearch');
    if (salarySearchInput) {
        salarySearchInput.addEventListener('input', debounce(() => {
            filterSalaries();
        }, 300));
    }
}

// دالة لتحميل الصفحة القديمة للمستخدمين العاديين
function loadExpensesSectionLegacy() {
    const section = document.getElementById('expenses-section');
    if (!section) return;
    
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
                                <th>المبلغ</th>
                                <th>التاريخ</th>
                                <th>الوصف</th>
                            </tr>
                        </thead>
                        <tbody id="expensesTableBody"></tbody>
                    </table>
                </div>

                <div class="pagination" id="expensesPagination"></div>
            </div>

            <!-- جدول المستحقات -->
            <div class="salaries-table-wrapper">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 class="table-title" style="margin: 0;"><i class="bi bi-person-badge"></i> المستحقات</h3>
                    <button onclick="toggleSalaryFilters()" class="btn btn-sm btn-icon" title="فلترة" style="padding: 8px 12px;">
                        <i class="bi bi-funnel"></i> فلترة
                    </button>
                </div>
                <div class="filters-bar" id="salaryFiltersBar" style="display: none;">
                    <input type="text" id="salarySearch" placeholder="بحث..." class="search-input">
                    <input type="month" id="salaryMonthFilter" class="filter-select" style="min-width: 150px;" onchange="handleSalaryMonthFilterChange()">
                </div>

                <div class="table-container">
                    <table class="data-table" id="salariesTable">
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الراتب</th>
                                <th>المسحوبات</th>
                                <th>الخصومات</th>
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
                    <h3 id="expenseModalTitle">تسجيل مصروف</h3>
                    <button onclick="closeExpenseModal()" class="btn-close">&times;</button>
                </div>
                <form id="expenseForm" onsubmit="saveExpense(event)">
                    <input type="hidden" id="expenseId">
                    
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

        <!-- مودال إضافة/تعديل سحب/خصم -->
        <div id="deductionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="deductionModalTitle">إضافة سحب/خصم</h3>
                    <button onclick="closeDeductionModal()" class="btn-close">&times;</button>
                </div>
                <form id="deductionForm" onsubmit="saveDeduction(event)">
                    <input type="hidden" id="deductionId">
                    <input type="hidden" id="deductionUserId">
                    
                    <div class="form-group">
                        <label for="deductionType">النوع *</label>
                        <select id="deductionType" required>
                            <option value="withdrawal">سحب</option>
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
    
    // تهيئة فلتر الشهر للمستحقات بالشهر الحالي
    const salaryMonthFilter = document.getElementById('salaryMonthFilter');
    if (salaryMonthFilter) {
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        salaryMonthFilter.value = currentMonth;
    }
    
    const salaryMonthFilter2 = document.getElementById('salaryMonthFilter2');
    if (salaryMonthFilter2) {
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        salaryMonthFilter2.value = currentMonth;
    }
    
    // تحميل البيانات
    loadExpenses();
    loadSalaries();
    
    // إضافة event listeners للبحث
    const expenseSearchInput = document.getElementById('expenseSearch');
    if (expenseSearchInput) {
        expenseSearchInput.addEventListener('input', debounce(() => {
            searchTable('expenseSearch', 'expensesTable');
        }, 300));
    }
    
    const salarySearchInput = document.getElementById('salarySearch');
    if (salarySearchInput) {
        salarySearchInput.addEventListener('input', debounce(() => {
            filterSalaries();
        }, 300));
    }
}

// إعداد فلاتر الفروع حسب نوع المستخدم
function setupBranchFilters() {
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        const expenseBranchFilter = document.getElementById('expenseBranchFilter');
        const salaryBranchFilter = document.getElementById('salaryBranchFilter');
        
        // فلتر الفرع للمصروفات - يظهر فقط للمالك
        if (expenseBranchFilter) {
            if (isOwner) {
                expenseBranchFilter.style.display = 'block';
            } else {
                expenseBranchFilter.style.display = 'none';
            }
        }
        
        // فلتر الفرع للمستحقات - يظهر فقط للمالك
        if (salaryBranchFilter) {
            if (isOwner) {
                salaryBranchFilter.style.display = 'block';
            } else {
                salaryBranchFilter.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('خطأ في إعداد فلاتر الفروع:', error);
    }
}

// ✅ تحسين الأداء: تحميل البيانات بشكل batch
async function loadExpensesDataBatch() {
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // الحصول على branch_id المختار (للمالك فقط)
        let branchId = null;
        if (isOwner) {
            const branchFilter = document.getElementById('expenseBranchFilter');
            if (branchFilter) {
                branchId = branchFilter.value || null;
                if (branchId === '') branchId = null;
            }
        }
        
        // بناء قائمة الطلبات
        const requests = [
            { url: 'api/expenses.php' + (branchId ? `?branch_id=${branchId}` : ''), method: 'GET', cache: true },
            { url: 'api/salaries.php' + (branchId ? `?branch_id=${branchId}` : ''), method: 'GET', cache: true },
            { url: 'api/branches.php?include_with_expenses=true', method: 'GET', cache: true }
        ];
        
        // تنفيذ الطلبات بشكل متوازي
        const results = await window.batchAPIRequests(requests);
        
        // معالجة النتائج
        results.forEach((result, index) => {
            if (result.success && result.data) {
                // result.data هو الاستجابة من API (يحتوي على success و data)
                const apiResponse = result.data;
                if (apiResponse && apiResponse.success && apiResponse.data) {
                    if (index === 0) {
                        // expenses
                        allExpenses = apiResponse.data || [];
                        filterExpenses();
                    } else if (index === 1) {
                        // salaries
                        allSalaries = apiResponse.data || [];
                        filterSalaries();
                    } else if (index === 2) {
                        // branches
                        if (Array.isArray(apiResponse.data)) {
                            allBranches = apiResponse.data;
                            updateBranchFilters();
                        }
                    }
                }
            } else if (result.error) {
                console.warn(`[Batch] خطأ في طلب ${index}:`, result.error);
            }
        });
        
        console.log('✅ تم تحميل بيانات المصروفات بشكل batch');
    } catch (error) {
        console.error('خطأ في تحميل بيانات المصروفات batch:', error);
        // Fallback: تحميل عادي
        loadExpenses(true);
        loadSalaries(true);
        setTimeout(() => {
            loadExpensesBranches(true);
        }, 200);
    }
}

async function loadExpenses(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingExpenses && !force) {
        console.log('⏸️ تحميل المصروفات قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastExpensesLoadTime) < EXPENSE_MIN_LOAD_INTERVAL) {
        console.log('⏸️ تم تحميل المصروفات مؤخراً، تخطي الطلب');
        return;
    }
    
    isLoadingExpenses = true;
    lastExpensesLoadTime = now;
    
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // الحصول على branch_id المختار (للمالك فقط)
        let branchId = null;
        if (isOwner) {
            const branchFilter = document.getElementById('expenseBranchFilter');
            if (branchFilter) {
                branchId = branchFilter.value || null;
                if (branchId === '') {
                    branchId = null;
                }
                
                // إذا كانت القيمة فارغة ولم يتم التحديد بعد، تعيين الفرع الأول كقيمة افتراضية
                if (!branchId && allBranches && allBranches.length > 0) {
                    // ترتيب الفروع حسب created_at واختيار الأول
                    const sortedBranches = [...allBranches].sort((a, b) => {
                        const dateA = new Date(a.created_at || 0);
                        const dateB = new Date(b.created_at || 0);
                        if (dateA.getTime() !== dateB.getTime()) {
                            return dateA.getTime() - dateB.getTime();
                        }
                        return (a.id || '').localeCompare(b.id || '');
                    });
                    const firstBranch = sortedBranches[0];
                    if (firstBranch && firstBranch.id) {
                        branchId = firstBranch.id;
                        branchFilter.value = branchId;
                        console.log(`✅ تم تعيين الفرع الأول كقيمة افتراضية: ${firstBranch.name} (${branchId})`);
                    }
                }
            }
        }
        
        const result = await API.getExpenses(branchId);
        if (result.success) {
            allExpenses = result.data || [];
            filterExpenses();
        } else {
            console.error('خطأ في تحميل المصروفات:', result.message);
            allExpenses = [];
            filterExpenses();
        }
    } catch (error) {
        console.error('خطأ في تحميل المصروفات:', error);
        allExpenses = [];
        filterExpenses();
    } finally {
        isLoadingExpenses = false;
    }
}

function filterExpenses() {
    try {
        const typeFilter = document.getElementById('expenseTypeFilter')?.value || '';
        let filtered = allExpenses;

        if (typeFilter) {
            filtered = filtered.filter(e => e.type === typeFilter);
        }

        displayExpenses(filtered);
    } catch (error) {
        console.error('خطأ في فلترة المصروفات:', error);
        displayExpenses(allExpenses);
    }
}

function displayExpenses(expenses) {
    try {
        const paginated = paginate(expenses, currentExpensePage, expensesPerPage);
        const tbody = document.getElementById('expensesTableBody');
        
        // ✅ Error handling: التحقق من وجود العنصر قبل استخدامه
        if (!tbody) {
            console.warn('⚠️ العنصر expensesTableBody غير موجود في DOM - سيتم تخطي عرض المصروفات');
            return;
        }
        
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // إظهار/إخفاء عمود الفرع
        const branchColumns = document.querySelectorAll('.expense-branch-column');
        branchColumns.forEach(col => {
            col.style.display = isOwner ? 'table-cell' : 'none';
        });

        if (paginated.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">لا توجد مصروفات</td></tr>`;
            return;
        }

        tbody.innerHTML = paginated.data.map(expense => {
            return `
                <tr>
                    <td><strong style="color: var(--danger-color);">${formatCurrency(expense.amount)}</strong></td>
                    <td>${formatDate(expense.date)}</td>
                    <td>${escapeHtml(expense.description || '-')}</td>
                </tr>
            `;
        }).join('');

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
    } catch (error) {
        console.error('خطأ في عرض المصروفات:', error);
        const tbody = document.getElementById('expensesTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">حدث خطأ أثناء تحميل المصروفات</td></tr>';
        }
    }
}

async function showAddExpenseModal() {
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        document.getElementById('expenseModalTitle').textContent = 'إضافة مصروف';
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseId').value = '';
        document.getElementById('expenseDate').value = getTodayDate();
        
        // إظهار/إخفاء حقل الفرع حسب نوع المستخدم
        const branchGroup = document.getElementById('expenseBranchGroup');
        const branchSelect = document.getElementById('expenseBranch');
        if (branchGroup && branchSelect) {
            if (isOwner) {
                branchGroup.style.display = 'block';
                branchSelect.value = '';
            } else {
                branchGroup.style.display = 'none';
                branchSelect.value = '';
            }
        }
        
        // فتح النموذج أولاً
        const expenseModal = document.getElementById('expenseModal');
        if (expenseModal) {
            expenseModal.style.display = 'flex';
        }
        
        // تحميل الفروع بعد فتح النموذج مباشرة (للتأكد من وجود العنصر في DOM)
        if (isOwner) {
            // استخدام setTimeout للتأكد من أن DOM تم تحديثه
            setTimeout(async () => {
                const branchSelect = document.getElementById('expenseBranch');
                if (branchSelect) {
                    // تحميل الفروع إذا لم تكن محملة بالفعل
                    if (allBranches && allBranches.length > 0) {
                        // الفروع محملة بالفعل، فقط تأكد من ملء القائمة
                        if (branchSelect.options.length <= 1) {
                            branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                            allBranches.forEach(branch => {
                                const option = document.createElement('option');
                                option.value = branch.id;
                                option.textContent = branch.name;
                                branchSelect.appendChild(option);
                            });
                            console.log(`✅ تم ملء ${allBranches.length} فرع في expenseBranch`);
                        }
                        
                        // تعيين الفرع الأول كقيمة افتراضية
                        const sortedBranches = [...allBranches].sort((a, b) => {
                            const dateA = new Date(a.created_at || 0);
                            const dateB = new Date(b.created_at || 0);
                            if (dateA.getTime() !== dateB.getTime()) {
                                return dateA.getTime() - dateB.getTime();
                            }
                            return (a.id || '').localeCompare(b.id || '');
                        });
                        const firstBranch = sortedBranches[0];
                        if (firstBranch && firstBranch.id) {
                            branchSelect.value = firstBranch.id;
                            console.log(`✅ تم تعيين الفرع الأول كقيمة افتراضية في النموذج: ${firstBranch.name} (${firstBranch.id})`);
                        }
                    } else {
                        // الفروع غير محملة، قم بتحميلها
                        await loadExpensesBranches();
                        // التحقق من أن الفروع تم تحميلها
                        if (branchSelect.options.length <= 1 && allBranches && allBranches.length > 0) {
                            branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                            allBranches.forEach(branch => {
                                const option = document.createElement('option');
                                option.value = branch.id;
                                option.textContent = branch.name;
                                branchSelect.appendChild(option);
                            });
                            console.log(`✅ تم ملء ${allBranches.length} فرع في expenseBranch بعد التحميل`);
                            
                            // تعيين الفرع الأول كقيمة افتراضية
                            const sortedBranches = [...allBranches].sort((a, b) => {
                                const dateA = new Date(a.created_at || 0);
                                const dateB = new Date(b.created_at || 0);
                                if (dateA.getTime() !== dateB.getTime()) {
                                    return dateA.getTime() - dateB.getTime();
                                }
                                return (a.id || '').localeCompare(b.id || '');
                            });
                            const firstBranch = sortedBranches[0];
                            if (firstBranch && firstBranch.id) {
                                branchSelect.value = firstBranch.id;
                                console.log(`✅ تم تعيين الفرع الأول كقيمة افتراضية في النموذج: ${firstBranch.name} (${firstBranch.id})`);
                            }
                        }
                    }
                } else {
                    console.error('❌ العنصر expenseBranch غير موجود في DOM');
                }
            }, 100);
        }
    } catch (error) {
        console.error('خطأ في عرض نموذج إضافة المصروف:', error);
        showMessage('حدث خطأ أثناء فتح نموذج إضافة المصروف', 'error');
    }
}

function closeExpenseModal() {
    document.getElementById('expenseModal').style.display = 'none';
}

async function saveExpense(event) {
    event.preventDefault();

    try {
        // التحقق من الحقول المطلوبة
        const amount = document.getElementById('expenseAmount').value.trim();
        const date = document.getElementById('expenseDate').value;

        if (!amount || !date) {
            showMessage('المبلغ والتاريخ مطلوبان', 'error');
            return;
        }

        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');

        const expenseData = {
            type: 'أخرى', // قيمة افتراضية
            amount: parseFloat(amount),
            date: date,
            description: document.getElementById('expenseDescription').value.trim()
        };

        // إضافة branch_id للمالك فقط
        if (isOwner) {
            const branchSelect = document.getElementById('expenseBranch');
            if (branchSelect) {
                const branchId = branchSelect.value || null;
                // إذا تم اختيار فرع، إرساله، وإلا لا ترسله ليستخدم API الفرع الأول تلقائياً
                if (branchId && branchId !== '') {
                    expenseData.branch_id = branchId;
                }
                // إذا كان فارغاً، لا نرسل branch_id، وسيستخدم API الفرع الأول
            }
        }

        const expenseId = document.getElementById('expenseId').value;
        let result;

        // إظهار شاشة التحميل قبل بدء العملية
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }

        try {
            if (expenseId) {
                expenseData.id = expenseId;
                result = await API.updateExpense(expenseData);
            } else {
                result = await API.addExpense(expenseData);
            }

            if (result.success) {
                showMessage(result.message);
                closeExpenseModal();
                
                // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
                // إعادة تعيين flag التحميل لإجبار إعادة التحميل
                isLoadingExpenses = false;
                lastExpensesLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
                
                // تحديث قائمة المصروفات
                await loadExpenses(true); // force = true
                
                // إذا كان المستخدم في قسم الخزنة، تحديث بيانات الخزنة وسجل المعاملات
                if (currentTreasuryBranchId) {
                    // تحديث سجل المعاملات أولاً (لإظهار المصروف الجديد) - بدون cache
                    await loadTreasuryTransactions(currentTreasuryBranchId, true);
                    
                    // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                    await loadTreasuryData(currentTreasuryBranchId, true);
                }
                
                // تحديث Dashboard إذا كان مفتوحاً
                if (typeof currentSection !== 'undefined' && currentSection === 'dashboard') {
                    if (typeof loadDashboardData === 'function') {
                        await loadDashboardData();
                    }
                }
            } else {
                showMessage(result.message, 'error');
            }
        } catch (apiError) {
            throw apiError;
        } finally {
            // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
        }
    } catch (error) {
        console.error('خطأ في حفظ المصروف:', error);
        showMessage('حدث خطأ أثناء حفظ المصروف', 'error');
        // التأكد من إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

async function editExpense(id) {
    try {
        const expense = allExpenses.find(e => e.id === id);
        if (!expense) return;

        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');

        document.getElementById('expenseModalTitle').textContent = 'تعديل المصروف';
        document.getElementById('expenseId').value = expense.id;
        document.getElementById('expenseAmount').value = expense.amount;
        document.getElementById('expenseDate').value = expense.date;
        document.getElementById('expenseDescription').value = expense.description || '';
        
        // إظهار/إخفاء حقل الفرع وتحديث قيمته
        const branchGroup = document.getElementById('expenseBranchGroup');
        const branchSelect = document.getElementById('expenseBranch');
        if (branchGroup && branchSelect) {
            if (isOwner) {
                branchGroup.style.display = 'block';
            } else {
                branchGroup.style.display = 'none';
                branchSelect.value = '';
            }
        }
        
        // فتح النموذج أولاً
        const expenseModal = document.getElementById('expenseModal');
        if (expenseModal) {
            expenseModal.style.display = 'flex';
        }
        
        // تحميل الفروع بعد فتح النموذج مباشرة (للتأكد من وجود العنصر في DOM)
        if (isOwner) {
            // استخدام setTimeout للتأكد من أن DOM تم تحديثه
            setTimeout(async () => {
                const branchSelect = document.getElementById('expenseBranch');
                if (branchSelect) {
                    // تحميل الفروع إذا لم تكن محملة بالفعل
                    if (allBranches && allBranches.length > 0) {
                        // الفروع محملة بالفعل، فقط تأكد من ملء القائمة
                        if (branchSelect.options.length <= 1) {
                            branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                            allBranches.forEach(branch => {
                                const option = document.createElement('option');
                                option.value = branch.id;
                                option.textContent = branch.name;
                                branchSelect.appendChild(option);
                            });
                        }
                        // تعيين قيمة الفرع
                        branchSelect.value = expense.branch_id || '';
                        console.log(`✅ تم ملء ${allBranches.length} فرع في expenseBranch وتعيين القيمة: ${expense.branch_id || ''}`);
                    } else {
                        // الفروع غير محملة، قم بتحميلها
                        await loadExpensesBranches();
                        // تعيين قيمة الفرع بعد تحميل الفروع
                        if (allBranches && allBranches.length > 0) {
                            if (branchSelect.options.length <= 1) {
                                branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                                allBranches.forEach(branch => {
                                    const option = document.createElement('option');
                                    option.value = branch.id;
                                    option.textContent = branch.name;
                                    branchSelect.appendChild(option);
                                });
                            }
                            branchSelect.value = expense.branch_id || '';
                            console.log(`✅ تم ملء ${allBranches.length} فرع في expenseBranch بعد التحميل وتعيين القيمة: ${expense.branch_id || ''}`);
                        }
                    }
                } else {
                    console.error('❌ العنصر expenseBranch غير موجود في DOM');
                }
            }, 100);
        }
    } catch (error) {
        console.error('خطأ في تعديل المصروف:', error);
        showMessage('حدث خطأ أثناء تحميل بيانات المصروف', 'error');
    }
}

async function deleteExpense(id) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية لحذف المصروفات', 'error');
        return;
    }

    if (!confirmAction('هل أنت متأكد من حذف هذا المصروف؟')) return;

    // إظهار شاشة التحميل قبل بدء العملية
    if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
        window.loadingOverlay.show();
    }

    try {
        const result = await API.deleteExpense(id);
        if (result.success) {
            showMessage(result.message);
            
            // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
            // إعادة تعيين flag التحميل لإجبار إعادة التحميل
            isLoadingExpenses = false;
            lastExpensesLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
            
            // تحديث قائمة المصروفات
            await loadExpenses(true); // force = true
            
            // إذا كان المستخدم في قسم الخزنة، تحديث بيانات الخزنة وسجل المعاملات
            if (currentTreasuryBranchId) {
                // تحديث سجل المعاملات أولاً (لإظهار الحذف) - بدون cache
                await loadTreasuryTransactions(currentTreasuryBranchId, true);
                
                // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                await loadTreasuryData(currentTreasuryBranchId, true);
            }
            
            // تحديث Dashboard إذا كان مفتوحاً
            if (typeof currentSection !== 'undefined' && currentSection === 'dashboard') {
                if (typeof loadDashboardData === 'function') {
                    await loadDashboardData();
                }
            }
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف المصروف:', error);
        showMessage('حدث خطأ أثناء حذف المصروف', 'error');
    } finally {
        // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// ========== دوال المستحقات ==========

async function loadExpensesBranches(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingBranches && !force) {
        console.log('⏸️ تحميل الفروع قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastBranchesLoadTime) < EXPENSE_MIN_LOAD_INTERVAL) {
        console.log('⏸️ تم تحميل الفروع مؤخراً، تخطي الطلب');
        return;
    }
    
    // ✅ تحسين الأداء: استخدام cache إذا كان متاحاً
    if (!force && allBranches && allBranches.length > 0) {
        console.log('✅ استخدام الفروع من الكاش');
        updateBranchFilters();
        return;
    }
    
    isLoadingBranches = true;
    lastBranchesLoadTime = now;
    
    try {
        console.log('🔄 بدء تحميل الفروع...');
        // جلب جميع الفروع النشطة + الفروع التي لديها مصاريف مرتبطة بها
        const result = await API.request('branches.php?include_with_expenses=true', 'GET');
        console.log('📥 استجابة API:', result);
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            allBranches = result.data;
            console.log(`📊 تم جلب ${allBranches.length} فرع من API`);
            
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            console.log('👤 معلومات المستخدم:', { 
                isOwner, 
                role: currentUser?.role, 
                is_owner: currentUser?.is_owner 
            });
            
            // فلتر الفرع للمصروفات - ملء الفروع دائماً (setupBranchFilters() سيتولى إظهار/إخفاء العنصر)
            const expenseBranchFilter = document.getElementById('expenseBranchFilter');
            if (expenseBranchFilter) {
                console.log('🔍 تم العثور على expenseBranchFilter في DOM');
                expenseBranchFilter.innerHTML = '<option value="">جميع الفروع</option>';
                if (allBranches && allBranches.length > 0) {
                    allBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        expenseBranchFilter.appendChild(option);
                    });
                    console.log(`✅ تم تحميل ${allBranches.length} فرع في expenseBranchFilter`);
                    
                    // للمالك: ضبط الفرع الأول كقيمة افتراضية (الهانوفيل)
                    if (isOwner) {
                        // ترتيب الفروع حسب created_at واختيار الأول
                        const sortedBranches = [...allBranches].sort((a, b) => {
                            const dateA = new Date(a.created_at || 0);
                            const dateB = new Date(b.created_at || 0);
                            if (dateA.getTime() !== dateB.getTime()) {
                                return dateA.getTime() - dateB.getTime();
                            }
                            return (a.id || '').localeCompare(b.id || '');
                        });
                        const firstBranch = sortedBranches[0];
                        if (firstBranch && firstBranch.id) {
                            expenseBranchFilter.value = firstBranch.id;
                            console.log(`✅ تم تعيين الفرع الأول كقيمة افتراضية للمالك: ${firstBranch.name} (${firstBranch.id})`);
                        }
                    }
                } else {
                    console.warn('⚠️ لا توجد فروع متاحة لتحميلها في expenseBranchFilter');
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    expenseBranchFilter.style.display = 'block';
                } else {
                    expenseBranchFilter.style.display = 'none';
                }
            } else {
                console.warn('⚠️ العنصر expenseBranchFilter غير موجود في DOM');
            }
            
            // فلتر الفرع للمستحقات - ملء الفروع دائماً (setupBranchFilters() سيتولى إظهار/إخفاء العنصر)
            const salaryBranchFilter = document.getElementById('salaryBranchFilter');
            if (salaryBranchFilter) {
                salaryBranchFilter.innerHTML = '<option value="">جميع الفروع</option>';
                if (allBranches && allBranches.length > 0) {
                    allBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        salaryBranchFilter.appendChild(option);
                    });
                    console.log(`✅ تم تحميل ${allBranches.length} فرع في salaryBranchFilter`);
                } else {
                    console.warn('⚠️ لا توجد فروع متاحة لتحميلها في salaryBranchFilter');
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    salaryBranchFilter.style.display = 'block';
                } else {
                    salaryBranchFilter.style.display = 'none';
                }
            } else {
                console.warn('⚠️ العنصر salaryBranchFilter غير موجود في DOM');
            }
            
            // قائمة الفروع في نموذج إضافة المصروف - ملء الفروع دائماً (سيتم التحقق من isOwner عند فتح النموذج)
            const expenseBranchSelect = document.getElementById('expenseBranch');
            if (expenseBranchSelect) {
                // حفظ القيمة الحالية إذا كانت موجودة
                const currentValue = expenseBranchSelect.value;
                expenseBranchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                
                if (allBranches && allBranches.length > 0) {
                    allBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        expenseBranchSelect.appendChild(option);
                    });
                    console.log(`✅ تم تحميل ${allBranches.length} فرع في قائمة expenseBranch`);
                } else {
                    console.warn('⚠️ لا توجد فروع متاحة للتحميل');
                }
                
                // استعادة القيمة إذا كانت موجودة
                if (currentValue) {
                    expenseBranchSelect.value = currentValue;
                }
            } else {
                // العنصر غير موجود - هذا طبيعي إذا كان النموذج غير مفتوح
                console.log('ℹ️ العنصر expenseBranch غير موجود في DOM (قد يكون النموذج غير مفتوح)');
            }
        } else {
            console.warn('⚠️ لم يتم العثور على فروع أو البيانات غير صحيحة:', result);
            // إظهار رسالة خطأ للمستخدم
            if (result && !result.success) {
                console.error('❌ خطأ من API:', result.message || 'خطأ غير معروف');
            } else if (!result) {
                console.error('❌ لم يتم الحصول على استجابة من API');
            } else if (!result.data) {
                console.error('❌ لا توجد بيانات في الاستجابة');
            } else if (!Array.isArray(result.data)) {
                console.error('❌ البيانات ليست مصفوفة:', typeof result.data, result.data);
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل الفروع:', error);
        showMessage('حدث خطأ أثناء تحميل الفروع. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        isLoadingBranches = false;
    }
}

// ✅ تحسين الأداء: دالة مساعدة لتحديث فلاتر الفروع من البيانات المحفوظة
function updateBranchFilters() {
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        const expenseBranchFilter = document.getElementById('expenseBranchFilter');
        if (expenseBranchFilter && allBranches && allBranches.length > 0) {
            const currentValue = expenseBranchFilter.value;
            expenseBranchFilter.innerHTML = '<option value="">جميع الفروع</option>';
            allBranches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.id;
                option.textContent = branch.name;
                expenseBranchFilter.appendChild(option);
            });
            if (currentValue) expenseBranchFilter.value = currentValue;
            expenseBranchFilter.style.display = isOwner ? 'block' : 'none';
        }
        
        const salaryBranchFilter = document.getElementById('salaryBranchFilter');
        if (salaryBranchFilter && allBranches && allBranches.length > 0) {
            const currentValue = salaryBranchFilter.value;
            salaryBranchFilter.innerHTML = '<option value="">جميع الفروع</option>';
            allBranches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.id;
                option.textContent = branch.name;
                salaryBranchFilter.appendChild(option);
            });
            if (currentValue) salaryBranchFilter.value = currentValue;
            salaryBranchFilter.style.display = isOwner ? 'block' : 'none';
        }
    } catch (error) {
        console.error('خطأ في تحديث فلاتر الفروع:', error);
    }
}

async function loadSalaries(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingSalaries && !force) {
        console.log('⏸️ تحميل المستحقات قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastSalariesLoadTime) < EXPENSE_MIN_LOAD_INTERVAL) {
        console.log('⏸️ تم تحميل المستحقات مؤخراً، تخطي الطلب');
        return;
    }
    
    isLoadingSalaries = true;
    lastSalariesLoadTime = now;
    
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // الحصول على branch_id المختار (للمالك فقط)
        let branchId = null;
        if (isOwner) {
            const branchFilter = document.getElementById('salaryBranchFilter');
            if (branchFilter) {
                branchId = branchFilter.value || null;
                if (branchId === '') branchId = null;
            }
        }
        
        // الحصول على الشهر المختار (من أي من الحقلين المتاحين)
        const monthFilter = document.getElementById('salaryMonthFilter');
        const monthFilter2 = document.getElementById('salaryMonthFilter2');
        let monthYear = null;
        
        // محاولة القراءة من الحقل الأول، وإذا لم يكن موجوداً أو فارغاً، القراءة من الثاني
        if (monthFilter && monthFilter.value) {
            monthYear = monthFilter.value;
        } else if (monthFilter2 && monthFilter2.value) {
            monthYear = monthFilter2.value;
        } else {
            // إذا لم يتم تحديد شهر، استخدام الشهر الحالي
            const now = new Date();
            monthYear = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        }
        
        currentBranchId = branchId;
        const result = await API.getSalaries(branchId, monthYear);
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
    } finally {
        isLoadingSalaries = false;
    }
}

function filterSalaries() {
    const branchFilter = document.getElementById('salaryBranchFilter');
    const searchInput = document.getElementById('salarySearch');
    
    if (!searchInput) return;
    
    const branchId = branchFilter ? (branchFilter.value || '') : '';
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد مستحقات</td></tr>';
        const paginationDiv = document.getElementById('salariesPagination');
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }
    
    // استخدام DocumentFragment لتحسين الأداء
    const fragment = document.createDocumentFragment();
    
    paginated.data.forEach(salary => {
        // التحقق من أن salary.id موجود
        if (!salary.id || salary.id === null || salary.id === undefined) {
            console.error('تحذير: معرف المستخدم غير موجود في بيانات الراتب:', salary);
            return; // تخطي هذا السطر إذا لم يكن id موجوداً
        }
        
        const tr = document.createElement('tr');
        const salaryAmount = parseFloat(salary.salary || 0);
        const totalDeductions = parseFloat(salary.total_deductions || 0); // الخصومات فقط
        const totalWithdrawals = parseFloat(salary.total_withdrawals || 0); // المسحوبات فقط
        const netSalary = salaryAmount - totalDeductions - totalWithdrawals;
        
        // ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
        // استخدام ID كما هو (string) دون تحويله إلى رقم
        const userId = String(salary.id).trim();
        if (!userId || userId === '' || userId === 'null' || userId === 'undefined') {
            console.error('تحذير: معرف المستخدم غير صحيح في بيانات الراتب:', salary.id, salary);
            return; // تخطي هذا السطر إذا كان ID غير صحيح
        }
        
        // تنظيف ID من الأحرف الخاصة للاستخدام في HTML
        const safeId = userId.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        // سجل للتحقق من ID
        console.log('عرض بيانات المستخدم:', {
            name: salary.name,
            username: salary.username,
            id_from_data: salary.id,
            id_used: userId,
            safeId: safeId
        });
        
        tr.innerHTML = `
            <td>
                <div><strong>${escapeHtml(salary.name || '')}</strong></div>
                <div style="font-size: 0.85em; color: var(--text-light);">${escapeHtml(salary.username || '')}</div>
            </td>
            <td><strong style="color: var(--primary-color);">${formatCurrency(salaryAmount)}</strong></td>
            <td><strong style="color: var(--danger-color);">${formatCurrency(totalWithdrawals)}</strong></td>
            <td><strong style="color: var(--warning-color);">${formatCurrency(totalDeductions)}</strong></td>
            <td><strong style="color: var(--success-color);">${formatCurrency(netSalary)}</strong></td>
            <td>
                <button onclick="showAddDeductionModal('${safeId}')" class="btn btn-sm btn-icon" title="إضافة سحب/خصم" data-permission="manager"><i class="bi bi-plus-circle"></i></button>
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

// ✅ دالة لإظهار/إخفاء فلاتر المستحقات
function toggleSalaryFilters() {
    try {
        const filtersBar = document.getElementById('salaryFiltersBar');
        if (filtersBar) {
            const isVisible = filtersBar.style.display !== 'none';
            filtersBar.style.display = isVisible ? 'none' : 'flex';
            
            // إذا تم إظهار الفلاتر لأول مرة، تهيئة قيمة الشهر
            if (!isVisible) {
                const salaryMonthFilter = document.getElementById('salaryMonthFilter');
                if (salaryMonthFilter && !salaryMonthFilter.value) {
                    const now = new Date();
                    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                    salaryMonthFilter.value = currentMonth;
                }
            }
        }
    } catch (error) {
        console.error('خطأ في تبديل فلاتر المستحقات:', error);
        showMessage('حدث خطأ أثناء تبديل الفلاتر', 'error');
    }
}

// ✅ دالة لإظهار/إخفاء فلاتر المستحقات (الفرع الثاني)
function toggleSalaryFilters2() {
    try {
        const filtersBar = document.getElementById('salaryFiltersBar2');
        if (filtersBar) {
            const isVisible = filtersBar.style.display !== 'none';
            filtersBar.style.display = isVisible ? 'none' : 'flex';
            
            // إذا تم إظهار الفلاتر لأول مرة، تهيئة قيمة الشهر
            if (!isVisible) {
                const salaryMonthFilter2 = document.getElementById('salaryMonthFilter2');
                if (salaryMonthFilter2 && !salaryMonthFilter2.value) {
                    const now = new Date();
                    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                    salaryMonthFilter2.value = currentMonth;
                }
            }
        }
    } catch (error) {
        console.error('خطأ في تبديل فلاتر المستحقات:', error);
        showMessage('حدث خطأ أثناء تبديل الفلاتر', 'error');
    }
}

// ✅ دالة للتعامل مع تغيير فلتر الشهر للمستحقات
function handleSalaryMonthFilterChange() {
    try {
        // مزامنة قيمة فلتر الشهر الأول مع الثاني
        const salaryMonthFilter = document.getElementById('salaryMonthFilter');
        const salaryMonthFilter2 = document.getElementById('salaryMonthFilter2');
        if (salaryMonthFilter && salaryMonthFilter2) {
            salaryMonthFilter2.value = salaryMonthFilter.value;
        }
        // إعادة تحميل المستحقات مع الشهر الجديد
        loadSalaries(true);
    } catch (error) {
        console.error('خطأ في تغيير فلتر الشهر:', error);
        showMessage('حدث خطأ أثناء تغيير فلتر الشهر', 'error');
    }
}

// ✅ دالة للتعامل مع تغيير فلتر الشهر للمستحقات (الفرع الثاني)
function handleSalaryMonthFilterChange2() {
    try {
        // مزامنة قيمة فلتر الشهر الثاني مع الأول
        const salaryMonthFilter = document.getElementById('salaryMonthFilter');
        const salaryMonthFilter2 = document.getElementById('salaryMonthFilter2');
        if (salaryMonthFilter && salaryMonthFilter2) {
            salaryMonthFilter.value = salaryMonthFilter2.value;
        }
        // إعادة تحميل المستحقات مع الشهر الجديد
        loadSalaries(true);
    } catch (error) {
        console.error('خطأ في تغيير فلتر الشهر:', error);
        showMessage('حدث خطأ أثناء تغيير فلتر الشهر', 'error');
    }
}

async function showUserProfileModal(userId) {
    try {
        // سجل للتحقق من ID المستلم
        console.log('showUserProfileModal - ID المستلم:', userId, 'نوع البيانات:', typeof userId);
        
        // التحقق من صحة userId
        if (!userId || userId === null || userId === undefined || userId === '' || 
            userId === 'null' || userId === 'undefined' || String(userId).trim() === '') {
            console.error('معرف المستخدم غير صحيح:', userId);
            showMessage('معرف المستخدم غير صحيح', 'error');
            return;
        }
        
        const modal = document.getElementById('userProfileModal');
        const content = document.getElementById('userProfileContent');
        const title = document.getElementById('userProfileModalTitle');
        
        if (!modal || !content || !title) {
            console.error('عناصر النموذج غير موجودة');
            showMessage('حدث خطأ في فتح النموذج', 'error');
            return;
        }
        
        content.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        modal.style.display = 'flex';
        
        // تنظيف userId - ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
        // استخدام ID كما هو (string) دون تحويله إلى رقم
        const cleanUserId = String(userId).trim();
        
        if (!cleanUserId || cleanUserId === '' || cleanUserId === 'null' || cleanUserId === 'undefined') {
            console.error('معرف المستخدم غير صحيح:', cleanUserId);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">معرف المستخدم غير صحيح</div>`;
            return;
        }
        
        console.log('showUserProfileModal - بعد التنظيف:', {
            cleanUserId: cleanUserId,
            type: typeof cleanUserId
        });
        
        console.log('جلب بيانات المستخدم من API باستخدام ID:', cleanUserId);
        const result = await API.getUserSalaryDetails(cleanUserId);
        
        console.log('نتيجة API:', result);
        
        if (!result || !result.success) {
            const errorMessage = result?.message || 'خطأ في تحميل البيانات';
            console.error('خطأ من API:', errorMessage, result);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">${errorMessage}</div>`;
            return;
        }
        
        const user = result.data;
        console.log('بيانات المستخدم المرجعة:', user);
        console.log('تفاصيل البيانات:', {
            name: user?.name,
            username: user?.username,
            role: user?.role,
            branch_name: user?.branch_name,
            salary: user?.salary
        });
        
        if (!user || typeof user !== 'object') {
            console.error('خطأ: البيانات المرجعة ليست كائن:', user);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">خطأ في تحميل البيانات - البيانات غير صحيحة</div>`;
            return;
        }
        
        // التحقق من أن البيانات الأساسية موجودة
        console.log('التحقق من user.id:', user.id, 'نوع البيانات:', typeof user.id);
        
        // إذا لم يكن id موجوداً، استخدام cleanUserId كبديل
        if (!user.id || user.id === null || user.id === undefined || user.id === '' || 
            user.id === 'null' || user.id === 'undefined' || String(user.id).trim() === '') {
            console.warn('تحذير: معرف المستخدم غير موجود في البيانات المرجعة، استخدام cleanUserId:', cleanUserId);
            // استخدام cleanUserId كبديل
            user.id = cleanUserId;
        }
        
        // التأكد من أن id موجود وصحيح (string)
        const validUserId = String(user.id).trim();
        if (!validUserId || validUserId === '' || validUserId === 'null' || validUserId === 'undefined') {
            console.error('خطأ: معرف المستخدم غير صحيح:', user.id);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">
                <p>خطأ في تحميل البيانات - معرف المستخدم غير صحيح</p>
            </div>`;
            return;
        }
        
        // استخدام cleanUserId الذي تم تعريفه مسبقاً (من parameter)
        // cleanUserId تم تعريفه في بداية الدالة بعد التحقق من صحة userId
        
        const salaryAmount = parseFloat(user.salary || 0);
        
        // التأكد من أن deductions مصفوفة
        const deductions = Array.isArray(user.deductions) ? user.deductions : [];
        
        // حساب إجمالي المسحوبات للشهر الحالي
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthDeductions = deductions.filter(d => {
            if (!d || !d.month_year) return false;
            try {
                // month_year قد يكون بصيغة "YYYY-MM" أو تاريخ كامل
                let monthYear = '';
                if (typeof d.month_year === 'string') {
                    // إذا كان بصيغة "YYYY-MM"
                    if (d.month_year.match(/^\d{4}-\d{2}$/)) {
                        monthYear = d.month_year;
                    } else {
                        // إذا كان تاريخ كامل
                        const date = new Date(d.month_year);
                        if (!isNaN(date.getTime())) {
                            monthYear = date.toISOString().slice(0, 7);
                        }
                    }
                } else if (d.month_year instanceof Date) {
                    monthYear = d.month_year.toISOString().slice(0, 7);
                }
                return monthYear === currentMonth;
            } catch (e) {
                console.error('خطأ في معالجة month_year:', e, d);
                return false;
            }
        });
        const currentMonthTotal = currentMonthDeductions.reduce((sum, d) => {
            return sum + parseFloat(d.amount || 0);
        }, 0);
        
        // التأكد من وجود دوال المساعدة
        const escapeHtml = window.escapeHtml || function(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        const formatDate = window.formatDate || function(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG');
            } catch (e) {
                return dateString;
            }
        };
        
        // دالة لتنسيق الشهر (YYYY-MM) إلى نص عربي
        const formatMonthYear = function(monthYear) {
            if (!monthYear) return '-';
            try {
                // إذا كان بصيغة "YYYY-MM"
                if (typeof monthYear === 'string' && monthYear.match(/^\d{4}-\d{2}$/)) {
                    const [year, month] = monthYear.split('-');
                    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                    const monthIndex = parseInt(month) - 1;
                    return `${monthNames[monthIndex]} ${year}`;
                } else {
                    // إذا كان تاريخ كامل
                    const date = new Date(monthYear);
                    if (!isNaN(date.getTime())) {
                        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                         'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    }
                }
                return monthYear;
            } catch (e) {
                return monthYear;
            }
        };
        
        const formatCurrency = window.formatCurrency || function(amount) {
            return parseFloat(amount || 0).toFixed(2) + ' ج.م';
        };
        
        const getRoleText = window.getRoleText || function(role) {
            // معالجة شاملة للقيم الفارغة أو غير الصحيحة
            if (!role || role === null || role === undefined || role === 'undefined' || role === 'null' || role === '' || (typeof role === 'string' && role.trim() === '')) {
                return 'غير محدد';
            }
            
            // التأكد من أن role هو string
            const roleStr = String(role).trim().toLowerCase();
            
            const roles = {
                'admin': 'مالك',
                'manager': 'مدير',
                'technician': 'فني صيانة',
                'employee': 'موظف'
            };
            
            return roles[roleStr] || roleStr || 'غير محدد';
        };
        
        // معالجة البيانات بشكل آمن - استخدام نفس الطريقة المستخدمة في جدول الرواتب
        // استخراج البيانات مباشرة من user object مع التحقق الصحيح
        // نفس الطريقة المستخدمة في displaySalaries: salary.name || ''
        const userName = (user.name && String(user.name).trim()) || 'غير محدد';
        const userUsername = (user.username && String(user.username).trim()) || 'غير محدد';
        const userRole = (user.role && String(user.role).trim()) || null;
        const userBranchName = (user.branch_name && String(user.branch_name).trim()) || 'غير محدد';
        
        title.textContent = `بروفايل: ${escapeHtml(userName)}`;
        
        // تجميع المسحوبات حسب الشهر
        const monthlyDeductions = {};
        deductions.forEach(d => {
            if (!d || !d.month_year) return;
            let monthYear = '';
            if (typeof d.month_year === 'string') {
                if (d.month_year.match(/^\d{4}-\d{2}$/)) {
                    monthYear = d.month_year;
                } else {
                    const date = new Date(d.month_year);
                    if (!isNaN(date.getTime())) {
                        monthYear = date.toISOString().slice(0, 7);
                    }
                }
            } else if (d.month_year instanceof Date) {
                monthYear = d.month_year.toISOString().slice(0, 7);
            }
            
            if (monthYear) {
                if (!monthlyDeductions[monthYear]) {
                    monthlyDeductions[monthYear] = {
                        withdrawals: [],
                        deductions: [],
                        totalWithdrawals: 0,
                        totalDeductions: 0
                    };
                }
                if (d.type === 'withdrawal') {
                    monthlyDeductions[monthYear].withdrawals.push(d);
                    monthlyDeductions[monthYear].totalWithdrawals += parseFloat(d.amount || 0);
                } else {
                    monthlyDeductions[monthYear].deductions.push(d);
                    monthlyDeductions[monthYear].totalDeductions += parseFloat(d.amount || 0);
                }
            }
        });
        
        // إنشاء قائمة الأشهر للفلترة
        const monthsList = Object.keys(monthlyDeductions).sort().reverse();
        const monthsOptions = monthsList.map(month => {
            return `<option value="${month}">${formatMonthYear(month)}</option>`;
        }).join('');
        
        let deductionsHtml = '';
        if (deductions && deductions.length > 0) {
            deductionsHtml = `
                <div class="deductions-list">
                    <h4>تفاصيل المستحقات</h4>
                    
                    <!-- فلترة -->
                    <div class="filters-bar" style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب الشهر:</label>
                            <select id="userProfileMonthFilter" onchange="filterUserProfileDeductions('${numericUserId}')" class="filter-select" style="width: 100%;">
                                <option value="">جميع الأشهر</option>
                                ${monthsOptions}
                            </select>
                        </div>
                        <div style="min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب النوع:</label>
                            <select id="userProfileTypeFilter" onchange="filterUserProfileDeductions('${numericUserId}')" class="filter-select" style="width: 100%;">
                                <option value="">الكل</option>
                                <option value="withdrawal">سحب فقط</option>
                                <option value="deduction">خصم فقط</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- إحصائيات حسب الشهر -->
                    <div style="margin-bottom: 20px;">
                        <h5 style="margin-bottom: 15px; color: var(--primary-color);">إحصائيات حسب الشهر</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                            ${monthsList.map(month => {
                                const monthData = monthlyDeductions[month];
                                const monthTotal = monthData.totalWithdrawals + monthData.totalDeductions;
                                const monthNet = salaryAmount - monthTotal;
                                return `
                                <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                                    <h6 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">${formatMonthYear(month)}</h6>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">الراتب:</span>
                                            <strong style="color: var(--primary-color);">${formatCurrency(salaryAmount)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">السحوبات:</span>
                                            <strong style="color: var(--warning-color);">${formatCurrency(monthData.totalWithdrawals)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">الخصومات:</span>
                                            <strong style="color: var(--danger-color);">${formatCurrency(monthData.totalDeductions)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-color);">
                                            <span style="color: var(--text-dark); font-weight: 600;">الصافي:</span>
                                            <strong style="color: var(--success-color); font-size: 1.1em;">${formatCurrency(monthNet)}</strong>
                                        </div>
                                    </div>
                                </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <!-- جدول المسحوبات والخصومات -->
                    <div id="userProfileDeductionsTable">
                        <h5 style="margin-bottom: 15px; color: var(--primary-color);">سجل المسحوبات والخصومات</h5>
                        <table class="data-table" style="margin-top: 15px;">
                            <thead>
                                <tr>
                                    <th>الشهر</th>
                                    <th>تاريخ الإضافة</th>
                                    <th>النوع</th>
                                    <th>المبلغ</th>
                                    <th>الوصف</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="userProfileDeductionsTableBody">
                                ${deductions.map(d => {
                                    if (!d) return '';
                                    const safeId = (d.id || '').toString().replace(/'/g, "\\'");
                                    const safeMonthYear = d.month_year || '';
                                    const safeCreatedAt = d.created_at || '';
                                    const safeAmount = parseFloat(d.amount || 0);
                                    const safeDescription = escapeHtml(d.description || '-');
                                    const badgeClass = d.type === 'withdrawal' ? 'badge-warning' : 'badge-danger';
                                    const typeText = d.type === 'withdrawal' ? 'سحب' : 'خصم';
                                    let monthYear = '';
                                    if (typeof safeMonthYear === 'string') {
                                        if (safeMonthYear.match(/^\d{4}-\d{2}$/)) {
                                            monthYear = safeMonthYear;
                                        } else {
                                            const date = new Date(safeMonthYear);
                                            if (!isNaN(date.getTime())) {
                                                monthYear = date.toISOString().slice(0, 7);
                                            }
                                        }
                                    }
                                    return `
                                    <tr data-month="${monthYear}" data-type="${d.type || ''}">
                                        <td><strong>${formatMonthYear(safeMonthYear)}</strong></td>
                                        <td>${formatDate(safeCreatedAt)}</td>
                                        <td><span class="badge ${badgeClass}">${typeText}</span></td>
                                        <td><strong style="color: var(--danger-color);">${formatCurrency(safeAmount)}</strong></td>
                                        <td>${safeDescription}</td>
                                        <td>
                                            <button onclick="editDeduction('${safeId}')" class="btn btn-sm btn-icon" title="تعديل" data-permission="manager"><i class="bi bi-pencil-square"></i></button>
                                            <button onclick="deleteDeduction('${safeId}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
                                        </td>
                                    </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
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
                            <span class="info-value">${escapeHtml(userName)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">اسم المستخدم:</span>
                            <span class="info-value">${escapeHtml(userUsername)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">الدور:</span>
                            <span class="info-value">${getRoleText(userRole)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">الفرع:</span>
                            <span class="info-value">${escapeHtml(userBranchName)}</span>
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

// دالة لعرض سجلات الخصومات والمسحوبات فقط
async function showUserDeductionsModal(userId) {
    try {
        // سجل للتحقق من ID المستلم
        console.log('showUserDeductionsModal - ID المستلم:', userId, 'نوع البيانات:', typeof userId);
        
        // التحقق من صحة userId
        if (!userId || userId === null || userId === undefined || userId === '' || 
            userId === 'null' || userId === 'undefined' || String(userId).trim() === '') {
            console.error('معرف المستخدم غير صحيح:', userId);
            showMessage('معرف المستخدم غير صحيح', 'error');
            return;
        }
        
        const modal = document.getElementById('userProfileModal');
        const content = document.getElementById('userProfileContent');
        const title = document.getElementById('userProfileModalTitle');
        
        if (!modal || !content || !title) {
            console.error('عناصر النموذج غير موجودة');
            showMessage('حدث خطأ في فتح النموذج', 'error');
            return;
        }
        
        content.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        modal.style.display = 'flex';
        
        // تنظيف userId - ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
        const cleanUserId = String(userId).trim();
        
        if (!cleanUserId || cleanUserId === '' || cleanUserId === 'null' || cleanUserId === 'undefined') {
            console.error('معرف المستخدم غير صحيح:', cleanUserId);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">معرف المستخدم غير صحيح</div>`;
            return;
        }
        
        console.log('جلب بيانات المستخدم من API باستخدام ID:', cleanUserId);
        const result = await API.getUserSalaryDetails(cleanUserId);
        
        console.log('نتيجة API:', result);
        
        if (!result || !result.success) {
            const errorMessage = result?.message || 'خطأ في تحميل البيانات';
            console.error('خطأ من API:', errorMessage, result);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">${errorMessage}</div>`;
            return;
        }
        
        const user = result.data;
        console.log('بيانات المستخدم المرجعة:', user);
        
        if (!user || typeof user !== 'object') {
            console.error('خطأ: البيانات المرجعة ليست كائن:', user);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">خطأ في تحميل البيانات - البيانات غير صحيحة</div>`;
            return;
        }
        
        // التأكد من أن deductions مصفوفة
        const deductions = Array.isArray(user.deductions) ? user.deductions : [];
        const salaryAmount = parseFloat(user.salary || 0);
        
        // التأكد من وجود دوال المساعدة
        const escapeHtml = window.escapeHtml || function(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        const formatDate = window.formatDate || function(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG');
            } catch (e) {
                return dateString;
            }
        };
        
        const formatMonthYear = function(monthYear) {
            if (!monthYear) return '-';
            try {
                if (typeof monthYear === 'string' && monthYear.match(/^\d{4}-\d{2}$/)) {
                    const [year, month] = monthYear.split('-');
                    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                    const monthIndex = parseInt(month) - 1;
                    return `${monthNames[monthIndex]} ${year}`;
                } else {
                    const date = new Date(monthYear);
                    if (!isNaN(date.getTime())) {
                        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                         'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    }
                }
                return monthYear;
            } catch (e) {
                return monthYear;
            }
        };
        
        const formatCurrency = window.formatCurrency || function(amount) {
            return parseFloat(amount || 0).toFixed(2) + ' ج.م';
        };
        
        // استخراج البيانات بنفس الطريقة المستخدمة في displaySalaries
        console.log('تفاصيل البيانات المرجعة:', {
            name: user?.name,
            username: user?.username,
            role: user?.role,
            branch_name: user?.branch_name,
            salary: user?.salary,
            deductions: user?.deductions,
            deductions_count: deductions?.length,
            full_user_object: user
        });
        
        // استخدام نفس الطريقة المستخدمة في displaySalaries: salary.name || ''
        // التحقق من وجود البيانات بشكل صحيح
        const userName = (user && user.name) ? String(user.name).trim() : 'غير محدد';
        const userUsername = (user && user.username) ? String(user.username).trim() : 'غير محدد';
        
        console.log('البيانات المستخرجة:', {
            userName: userName,
            userUsername: userUsername,
            salaryAmount: salaryAmount,
            deductionsCount: deductions.length
        });
        
        title.textContent = `سجلات الخصومات والمسحوبات - ${escapeHtml(userName)}`;
        
        // تجميع المسحوبات حسب الشهر
        const monthlyDeductions = {};
        deductions.forEach(d => {
            if (!d || !d.month_year) return;
            let monthYear = '';
            if (typeof d.month_year === 'string') {
                if (d.month_year.match(/^\d{4}-\d{2}$/)) {
                    monthYear = d.month_year;
                } else {
                    const date = new Date(d.month_year);
                    if (!isNaN(date.getTime())) {
                        monthYear = date.toISOString().slice(0, 7);
                    }
                }
            } else if (d.month_year instanceof Date) {
                monthYear = d.month_year.toISOString().slice(0, 7);
            }
            
            if (monthYear) {
                if (!monthlyDeductions[monthYear]) {
                    monthlyDeductions[monthYear] = {
                        withdrawals: [],
                        deductions: [],
                        totalWithdrawals: 0,
                        totalDeductions: 0
                    };
                }
                if (d.type === 'withdrawal') {
                    monthlyDeductions[monthYear].withdrawals.push(d);
                    monthlyDeductions[monthYear].totalWithdrawals += parseFloat(d.amount || 0);
                } else {
                    monthlyDeductions[monthYear].deductions.push(d);
                    monthlyDeductions[monthYear].totalDeductions += parseFloat(d.amount || 0);
                }
            }
        });
        
        // إنشاء قائمة الأشهر للفلترة
        const monthsList = Object.keys(monthlyDeductions).sort().reverse();
        const monthsOptions = monthsList.map(month => {
            return `<option value="${month}">${formatMonthYear(month)}</option>`;
        }).join('');
        
        let deductionsHtml = '';
        if (deductions && deductions.length > 0) {
            deductionsHtml = `
                <div class="deductions-list">
                    <h4>سجلات الخصومات والمسحوبات</h4>
                    
                    <!-- فلترة -->
                    <div class="filters-bar" style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب الشهر:</label>
                            <select id="userDeductionsMonthFilter" onchange="filterUserDeductions('${cleanUserId}')" class="filter-select" style="width: 100%;">
                                <option value="">جميع الأشهر</option>
                                ${monthsOptions}
                            </select>
                        </div>
                        <div style="min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب النوع:</label>
                            <select id="userDeductionsTypeFilter" onchange="filterUserDeductions('${cleanUserId}')" class="filter-select" style="width: 100%;">
                                <option value="">الكل</option>
                                <option value="withdrawal">سحب فقط</option>
                                <option value="deduction">خصم فقط</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- إحصائيات حسب الشهر -->
                    <div style="margin-bottom: 20px;">
                        <h5 style="margin-bottom: 15px; color: var(--primary-color);">إحصائيات حسب الشهر</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                            ${monthsList.map(month => {
                                const monthData = monthlyDeductions[month];
                                const monthTotal = monthData.totalWithdrawals + monthData.totalDeductions;
                                const monthNet = salaryAmount - monthTotal;
                                return `
                                <div class="summary-card" style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                                    <h6 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1.1em;">${formatMonthYear(month)}</h6>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">الراتب:</span>
                                            <strong style="color: var(--primary-color);">${formatCurrency(salaryAmount)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">السحوبات:</span>
                                            <strong style="color: var(--warning-color);">${formatCurrency(monthData.totalWithdrawals)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="color: var(--text-light);">الخصومات:</span>
                                            <strong style="color: var(--danger-color);">${formatCurrency(monthData.totalDeductions)}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-color);">
                                            <span style="color: var(--text-dark); font-weight: 600;">الصافي:</span>
                                            <strong style="color: var(--success-color); font-size: 1.1em;">${formatCurrency(monthNet)}</strong>
                                        </div>
                                    </div>
                                </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <!-- جدول المسحوبات والخصومات -->
                    <div id="userDeductionsTable">
                        <h5 style="margin-bottom: 15px; color: var(--primary-color);">سجل المسحوبات والخصومات</h5>
                        <table class="data-table" style="margin-top: 15px;">
                            <thead>
                                <tr>
                                    <th>الشهر</th>
                                    <th>تاريخ الإضافة</th>
                                    <th>النوع</th>
                                    <th>المبلغ</th>
                                    <th>الوصف</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="userDeductionsTableBody">
                                ${deductions.map(d => {
                                    if (!d) return '';
                                    const safeId = (d.id || '').toString().replace(/'/g, "\\'");
                                    const safeMonthYear = d.month_year || '';
                                    const safeCreatedAt = d.created_at || '';
                                    const safeAmount = parseFloat(d.amount || 0);
                                    const safeDescription = escapeHtml(d.description || '-');
                                    const badgeClass = d.type === 'withdrawal' ? 'badge-warning' : 'badge-danger';
                                    const typeText = d.type === 'withdrawal' ? 'سحب' : 'خصم';
                                    let monthYear = '';
                                    if (typeof safeMonthYear === 'string') {
                                        if (safeMonthYear.match(/^\d{4}-\d{2}$/)) {
                                            monthYear = safeMonthYear;
                                        } else {
                                            const date = new Date(safeMonthYear);
                                            if (!isNaN(date.getTime())) {
                                                monthYear = date.toISOString().slice(0, 7);
                                            }
                                        }
                                    }
                                    return `
                                    <tr data-month="${monthYear}" data-type="${d.type || ''}">
                                        <td><strong>${formatMonthYear(safeMonthYear)}</strong></td>
                                        <td>${formatDate(safeCreatedAt)}</td>
                                        <td><span class="badge ${badgeClass}">${typeText}</span></td>
                                        <td><strong style="color: var(--danger-color);">${formatCurrency(safeAmount)}</strong></td>
                                        <td>${safeDescription}</td>
                                        <td>
                                            <button onclick="editDeduction('${safeId}')" class="btn btn-sm btn-icon" title="تعديل" data-permission="manager"><i class="bi bi-pencil-square"></i></button>
                                            <button onclick="deleteDeduction('${safeId}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
                                        </td>
                                    </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            deductionsHtml = `
                <div style="text-align: center; padding: 40px;">
                    <i class="bi bi-inbox" style="font-size: 3em; color: var(--text-light); margin-bottom: 15px;"></i>
                    <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد مسحوبات أو خصومات للمستخدم: <strong>${escapeHtml(userName)}</strong></p>
                    <p style="color: var(--text-light); font-size: 0.9em; margin-top: 10px;">يمكنك إضافة سحب أو خصم باستخدام الزر في الجدول</p>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="user-profile-content">
                ${deductionsHtml}
            </div>
        `;
        
        hideByPermission();
    } catch (error) {
        console.error('خطأ في عرض سجلات الخصومات والمسحوبات:', error);
        const content = document.getElementById('userProfileContent');
        if (content) {
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">حدث خطأ أثناء تحميل البيانات</div>`;
        }
    }
}

// دالة لعرض جميع السحوبات والخصومات لجميع المستخدمين
async function showAllDeductionsModal(userIdFilter = null) {
    try {
        const modal = document.getElementById('userProfileModal');
        const content = document.getElementById('userProfileContent');
        const title = document.getElementById('userProfileModalTitle');
        
        if (!modal || !content || !title) {
            console.error('عناصر النموذج غير موجودة');
            showMessage('حدث خطأ في فتح النموذج', 'error');
            return;
        }
        
        content.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-hourglass-split"></i> جاري التحميل...</div>';
        modal.style.display = 'flex';
        
        // جلب البيانات من API
        const result = await API.getAllDeductions(userIdFilter);
        
        if (!result || !result.success) {
            const errorMessage = result?.message || 'خطأ في تحميل البيانات';
            console.error('خطأ من API:', errorMessage, result);
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">${errorMessage}</div>`;
            return;
        }
        
        // معالجة البيانات - التأكد من أن البيانات موجودة
        const data = result.data || {};
        let deductions = [];
        let users = [];
        
        // محاولة جلب البيانات بطرق مختلفة
        if (Array.isArray(data.deductions)) {
            deductions = data.deductions;
        } else if (Array.isArray(data)) {
            // إذا كانت البيانات مصفوفة مباشرة
            deductions = data;
        } else if (data && typeof data === 'object') {
            deductions = Array.isArray(data.deductions) ? data.deductions : [];
            users = Array.isArray(data.users) ? data.users : [];
        }
        
        if (Array.isArray(data.users)) {
            users = data.users;
        }
        
        // التأكد من أن deductions هي مصفوفة
        if (!Array.isArray(deductions)) {
            console.error('⚠️ deductions ليست مصفوفة:', deductions);
            deductions = [];
        }
        
        // التأكد من أن users هي مصفوفة
        if (!Array.isArray(users)) {
            console.error('⚠️ users ليست مصفوفة:', users);
            users = [];
        }
        
        // تنظيف البيانات - التأكد من أن كل عنصر له الحقول المطلوبة
        deductions = deductions.filter(d => d && d.id).map(d => ({
            id: d.id || '',
            user_id: d.user_id || '',
            amount: parseFloat(d.amount || 0),
            type: d.type || 'withdrawal',
            description: d.description || '',
            month_year: d.month_year || '',
            created_at: d.created_at || '',
            user_name: d.user_name || d.user_username || 'غير محدد',
            user_username: d.user_username || '',
            branch_name: d.branch_name || 'غير محدد',
            // إضافة علامة للتحقق من جلب بيانات المستخدم
            _userDataLoaded: false
        }));
        
        // جلب بيانات المستخدمين من API
        // أولاً: جمع جميع user_ids الفريدة (تخطي الفارغة)
        const uniqueUserIds = [...new Set(deductions.map(d => {
            const userId = d.user_id;
            return userId && String(userId).trim() ? String(userId).trim() : null;
        }).filter(id => id !== null))];
        
        // ثانياً: جمع جميع deduction ids للسجلات التي لا تحتوي على user_id
        const deductionIdsWithoutUserId = deductions
            .filter(d => !d.user_id || !String(d.user_id).trim())
            .map(d => d.id)
            .filter(id => id && String(id).trim());
        
        const userDataCache = {};
        
        // جلب بيانات جميع المستخدمين باستخدام user_id بشكل متوازي
        if (uniqueUserIds.length > 0) {
            console.log('جلب بيانات المستخدمين من API باستخدام user_id:', uniqueUserIds);
            const userPromises = uniqueUserIds.map(async (userId) => {
                try {
                    const userResult = await API.getUserById(userId);
                    if (userResult && userResult.success && userResult.data) {
                        return { identifier: userId, type: 'user_id', userData: userResult.data };
                    }
                    console.warn(`⚠️ فشل جلب بيانات المستخدم ${userId}:`, userResult);
                    return { identifier: userId, type: 'user_id', userData: null };
                } catch (error) {
                    console.error(`خطأ في جلب بيانات المستخدم ${userId}:`, error);
                    return { identifier: userId, type: 'user_id', userData: null };
                }
            });
            
            const userResults = await Promise.all(userPromises);
            userResults.forEach(({ identifier, userData }) => {
                if (userData) {
                    userDataCache[identifier] = userData;
                }
            });
        }
        
        // جلب user_id من API للسجلات التي لا تحتوي على user_id
        if (deductionIdsWithoutUserId.length > 0) {
            console.log('جلب user_id من API للسجلات التي لا تحتوي على user_id:', deductionIdsWithoutUserId);
            // ملاحظة: نحتاج إلى API endpoint جديد لجلب user_id من deduction id
            // في الوقت الحالي، سنستخدم البيانات المرجعة من API مباشرة
        }
        
        console.log('بيانات المستخدمين المحملة:', userDataCache);
        
        // تحديث بيانات المستخدمين في السجلات
        deductions = deductions.map(d => {
            const userId = d.user_id && String(d.user_id).trim() ? String(d.user_id).trim() : null;
            
            if (userId && userDataCache[userId]) {
                const userData = userDataCache[userId];
                const userName = userData.name || userData.username || 'غير محدد';
                const userUsername = userData.username || '';
                const branchName = userData.branch_name || 'غير محدد';
                
                console.log(`تحديث بيانات المستخدم ${userId}:`, { userName, userUsername, branchName });
                
                return {
                    ...d,
                    user_id: userId, // التأكد من أن user_id موجود
                    user_name: userName,
                    user_username: userUsername,
                    branch_name: branchName,
                    _userDataLoaded: true
                };
            } else if (userId) {
                console.warn(`⚠️ لم يتم العثور على بيانات المستخدم ${userId} في cache`);
            } else {
                console.warn(`⚠️ user_id فارغ في السجل:`, { id: d.id, user_id: d.user_id });
            }
            
            return d;
        });
        
        console.log('البيانات المرجعة (بعد التنظيف):', {
            result: result,
            data: data,
            deductions_count: deductions.length,
            users_count: users.length,
            sample_deduction: deductions[0] || null,
            total_amount: deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
        });
        
        // تسجيل تفصيلي لأول 3 سجلات للتحقق من أسماء المستخدمين
        if (deductions.length > 0) {
            console.log('عينة من السجلات (للتحقق من أسماء المستخدمين):', deductions.slice(0, 3).map(d => ({
                id: d.id,
                user_id: d.user_id,
                user_name: d.user_name,
                user_username: d.user_username,
                branch_name: d.branch_name,
                amount: d.amount
            })));
        }
        
        // التأكد من وجود دوال المساعدة
        const escapeHtml = window.escapeHtml || function(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        const formatDate = window.formatDate || function(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG');
            } catch (e) {
                return dateString;
            }
        };
        
        const formatMonthYear = function(monthYear) {
            if (!monthYear) return '-';
            try {
                if (typeof monthYear === 'string' && monthYear.match(/^\d{4}-\d{2}$/)) {
                    const [year, month] = monthYear.split('-');
                    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                    const monthIndex = parseInt(month) - 1;
                    return `${monthNames[monthIndex]} ${year}`;
                } else {
                    const date = new Date(monthYear);
                    if (!isNaN(date.getTime())) {
                        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                                         'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    }
                }
                return monthYear;
            } catch (e) {
                return monthYear;
            }
        };
        
        const formatCurrency = window.formatCurrency || function(amount) {
            return parseFloat(amount || 0).toFixed(2) + ' ج.م';
        };
        
        title.textContent = 'جميع السحوبات والخصومات';
        
        // إنشاء قائمة المستخدمين للفلترة
        const usersOptions = users.map(user => {
            const userName = user.name || user.username || 'غير محدد';
            const selected = userIdFilter === user.id ? 'selected' : '';
            return `<option value="${user.id}" ${selected}>${escapeHtml(userName)}</option>`;
        }).join('');
        
        // حساب الإحصائيات - التأكد من الحساب الصحيح
        const withdrawalsList = deductions.filter(d => d && d.type === 'withdrawal');
        const deductionsList = deductions.filter(d => d && d.type === 'deduction');
        
        const totalWithdrawals = withdrawalsList.reduce((sum, d) => {
            const amount = parseFloat(d.amount || 0);
            if (isNaN(amount)) {
                console.warn('⚠️ مبلغ غير صحيح في السحب:', d);
                return sum;
            }
            return sum + amount;
        }, 0);
        
        const totalDeductions = deductionsList.reduce((sum, d) => {
            const amount = parseFloat(d.amount || 0);
            if (isNaN(amount)) {
                console.warn('⚠️ مبلغ غير صحيح في الخصم:', d);
                return sum;
            }
            return sum + amount;
        }, 0);
        
        const grandTotal = totalWithdrawals + totalDeductions;
        
        console.log('الإحصائيات المحسوبة:', {
            withdrawals_count: withdrawalsList.length,
            deductions_count: deductionsList.length,
            totalWithdrawals: totalWithdrawals,
            totalDeductions: totalDeductions,
            grandTotal: grandTotal
        });
        
        let deductionsHtml = '';
        if (deductions && deductions.length > 0) {
            deductionsHtml = `
                <div class="deductions-list">
                    <h4 style="margin-bottom: 20px; color: var(--primary-color);">جميع السحوبات والخصومات</h4>
                    
                    <!-- إحصائيات -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                            <div style="color: var(--text-light); font-size: 0.9em; margin-bottom: 5px;">إجمالي السجلات</div>
                            <div style="font-size: 1.5em; font-weight: bold; color: var(--primary-color);">${deductions.length}</div>
                        </div>
                        <div style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                            <div style="color: var(--text-light); font-size: 0.9em; margin-bottom: 5px;">إجمالي المسحوبات</div>
                            <div style="font-size: 1.5em; font-weight: bold; color: var(--warning-color);">${formatCurrency(totalWithdrawals)}</div>
                        </div>
                        <div style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                            <div style="color: var(--text-light); font-size: 0.9em; margin-bottom: 5px;">إجمالي الخصومات</div>
                            <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);">${formatCurrency(totalDeductions)}</div>
                        </div>
                        <div style="padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                            <div style="color: var(--text-light); font-size: 0.9em; margin-bottom: 5px;">الإجمالي الكلي</div>
                            <div style="font-size: 1.5em; font-weight: bold; color: var(--danger-color);">${formatCurrency(grandTotal)}</div>
                        </div>
                    </div>
                    
                    <!-- فلترة -->
                    <div class="filters-bar" style="margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 8px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب المستخدم:</label>
                            <select id="allDeductionsUserFilter" onchange="filterAllDeductions()" class="filter-select" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="all">جميع المستخدمين</option>
                                ${usersOptions}
                            </select>
                        </div>
                        <div style="min-width: 200px;">
                            <label style="display: block; margin-bottom: 5px; color: var(--text-dark); font-weight: 500;">فلترة حسب النوع:</label>
                            <select id="allDeductionsTypeFilter" onchange="filterAllDeductions()" class="filter-select" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="">الكل</option>
                                <option value="withdrawal">سحب فقط</option>
                                <option value="deduction">خصم فقط</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- جدول المسحوبات والخصومات -->
                    <div id="allDeductionsTable" style="overflow-x: auto;">
                        <h5 style="margin-bottom: 15px; color: var(--primary-color);">سجل المسحوبات والخصومات</h5>
                        <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <thead>
                                <tr style="background: var(--light-bg);">
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">المستخدم</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">الفرع</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">الشهر</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">تاريخ الإضافة</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color);">النوع</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">المبلغ</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">الوصف</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color);">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="allDeductionsTableBody">
                                ${deductions.map(d => {
                                    if (!d || !d.id) {
                                        console.warn('⚠️ سجل غير صحيح:', d);
                                        return '';
                                    }
                                    
                                    const safeId = String(d.id || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                    const safeMonthYear = d.month_year || '';
                                    const safeCreatedAt = d.created_at || '';
                                    const safeAmount = parseFloat(d.amount || 0);
                                    
                                    // التحقق من صحة المبلغ
                                    if (isNaN(safeAmount) || safeAmount < 0) {
                                        console.warn('⚠️ مبلغ غير صحيح:', d);
                                    }
                                    
                                    const safeDescription = escapeHtml(String(d.description || '-'));
                                    
                                    // جلب اسم المستخدم - استخدام البيانات المحدثة من API
                                    let userName = 'غير محدد';
                                    if (d.user_name && String(d.user_name).trim() && String(d.user_name).trim() !== 'غير محدد') {
                                        userName = String(d.user_name).trim();
                                    } else if (d.user_username && String(d.user_username).trim()) {
                                        userName = String(d.user_username).trim();
                                    }
                                    userName = escapeHtml(userName);
                                    
                                    // جلب اسم الفرع
                                    let branchName = 'غير محدد';
                                    if (d.branch_name && String(d.branch_name).trim() && String(d.branch_name).trim() !== 'غير محدد') {
                                        branchName = String(d.branch_name).trim();
                                    }
                                    branchName = escapeHtml(branchName);
                                    
                                    // تسجيل للتحقق
                                    if ((userName === 'غير محدد' || userName === '') && d.user_id) {
                                        console.warn('⚠️ اسم المستخدم غير موجود:', {
                                            user_id: d.user_id,
                                            user_name: d.user_name,
                                            user_username: d.user_username,
                                            _userDataLoaded: d._userDataLoaded
                                        });
                                    }
                                    const deductionType = String(d.type || 'withdrawal');
                                    const badgeClass = deductionType === 'withdrawal' ? 'badge-warning' : 'badge-danger';
                                    const typeText = deductionType === 'withdrawal' ? 'سحب' : 'خصم';
                                    let monthYear = '';
                                    if (typeof safeMonthYear === 'string') {
                                        if (safeMonthYear.match(/^\d{4}-\d{2}$/)) {
                                            monthYear = safeMonthYear;
                                        } else {
                                            const date = new Date(safeMonthYear);
                                            if (!isNaN(date.getTime())) {
                                                monthYear = date.toISOString().slice(0, 7);
                                            }
                                        }
                                    }
                                    return `
                                    <tr data-user-id="${String(d.user_id || '')}" data-type="${deductionType}" style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 12px;"><strong>${userName}</strong></td>
                                        <td style="padding: 12px;">${branchName}</td>
                                        <td style="padding: 12px;"><strong>${formatMonthYear(safeMonthYear)}</strong></td>
                                        <td style="padding: 12px;">${formatDate(safeCreatedAt)}</td>
                                        <td style="padding: 12px; text-align: center;">
                                            <span class="badge ${badgeClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">
                                                ${typeText}
                                            </span>
                                        </td>
                                        <td style="padding: 12px;"><strong style="color: var(--danger-color);">${formatCurrency(safeAmount)}</strong></td>
                                        <td style="padding: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeDescription}">${safeDescription}</td>
                                        <td style="padding: 12px; text-align: center;">
                                            <button onclick="editDeduction('${safeId}')" class="btn btn-sm btn-icon" title="تعديل" data-permission="manager" style="margin: 0 3px;">
                                                <i class="bi bi-pencil-square"></i>
                                            </button>
                                            <button onclick="deleteDeduction('${safeId}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager" style="margin: 0 3px; color: var(--danger-color);">
                                                <i class="bi bi-trash3"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            deductionsHtml = `
                <div style="text-align: center; padding: 40px;">
                    <i class="bi bi-inbox" style="font-size: 3em; color: var(--text-light); margin-bottom: 15px;"></i>
                    <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد مسحوبات أو خصومات</p>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="user-profile-content">
                ${deductionsHtml}
            </div>
        `;
        
        hideByPermission();
    } catch (error) {
        console.error('خطأ في عرض جميع السحوبات والخصومات:', error);
        const content = document.getElementById('userProfileContent');
        if (content) {
            content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger-color);">حدث خطأ أثناء تحميل البيانات</div>`;
        }
    }
}

// فلترة جميع السحوبات والخصومات
function filterAllDeductions() {
    try {
        const userFilter = document.getElementById('allDeductionsUserFilter')?.value || 'all';
        const typeFilter = document.getElementById('allDeductionsTypeFilter')?.value || '';
        const tbody = document.getElementById('allDeductionsTableBody');
        
        if (!tbody) return;
        
        // إزالة رسالة "لا توجد نتائج" السابقة إن وجدت
        const existingNoResults = tbody.querySelector('tr[data-no-results]');
        if (existingNoResults) {
            existingNoResults.remove();
        }
        
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => !row.hasAttribute('data-no-results'));
        let visibleCount = 0;
        
        rows.forEach(row => {
            const rowUserId = row.getAttribute('data-user-id') || '';
            const rowType = row.getAttribute('data-type') || '';
            
            let shouldShow = true;
            
            // فلترة حسب المستخدم
            if (userFilter !== 'all' && rowUserId !== userFilter) {
                shouldShow = false;
            }
            
            // فلترة حسب النوع
            if (typeFilter && rowType !== typeFilter) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // إظهار رسالة إذا لم توجد نتائج
        if (visibleCount === 0 && rows.length > 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.setAttribute('data-no-results', 'true');
            noResultsRow.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد نتائج للفلترة المحددة</td>';
            tbody.appendChild(noResultsRow);
        }
    } catch (error) {
        console.error('خطأ في فلترة السحوبات والخصومات:', error);
    }
}

// فلترة المسحوبات والخصومات في نموذج السجلات
function filterUserDeductions(userId) {
    try {
        const monthFilter = document.getElementById('userDeductionsMonthFilter')?.value || '';
        const typeFilter = document.getElementById('userDeductionsTypeFilter')?.value || '';
        const tbody = document.getElementById('userDeductionsTableBody');
        
        if (!tbody) return;
        
        // إزالة رسالة "لا توجد نتائج" السابقة إن وجدت
        const existingNoResults = tbody.querySelector('tr[data-no-results]');
        if (existingNoResults) {
            existingNoResults.remove();
        }
        
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => !row.hasAttribute('data-no-results'));
        let visibleCount = 0;
        
        rows.forEach(row => {
            const rowMonth = row.getAttribute('data-month') || '';
            const rowType = row.getAttribute('data-type') || '';
            
            let shouldShow = true;
            
            // فلترة حسب الشهر
            if (monthFilter && rowMonth !== monthFilter) {
                shouldShow = false;
            }
            
            // فلترة حسب النوع
            if (typeFilter && rowType !== typeFilter) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // إظهار رسالة إذا لم توجد نتائج
        if (visibleCount === 0 && rows.length > 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.setAttribute('data-no-results', 'true');
            noResultsRow.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد نتائج للفلترة المحددة</td>';
            tbody.appendChild(noResultsRow);
        }
    } catch (error) {
        console.error('خطأ في فلترة المسحوبات والخصومات:', error);
    }
}

// فلترة المسحوبات والخصومات في بروفايل المستخدم
function filterUserProfileDeductions(userId) {
    try {
        const monthFilter = document.getElementById('userProfileMonthFilter')?.value || '';
        const typeFilter = document.getElementById('userProfileTypeFilter')?.value || '';
        const tbody = document.getElementById('userProfileDeductionsTableBody');
        
        if (!tbody) return;
        
        // إزالة رسالة "لا توجد نتائج" السابقة إن وجدت
        const existingNoResults = tbody.querySelector('tr[data-no-results]');
        if (existingNoResults) {
            existingNoResults.remove();
        }
        
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => !row.hasAttribute('data-no-results'));
        let visibleCount = 0;
        
        rows.forEach(row => {
            const rowMonth = row.getAttribute('data-month') || '';
            const rowType = row.getAttribute('data-type') || '';
            
            let shouldShow = true;
            
            // فلترة حسب الشهر
            if (monthFilter && rowMonth !== monthFilter) {
                shouldShow = false;
            }
            
            // فلترة حسب النوع
            if (typeFilter && rowType !== typeFilter) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // إظهار رسالة إذا لم توجد نتائج
        if (visibleCount === 0 && rows.length > 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.setAttribute('data-no-results', 'true');
            noResultsRow.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد نتائج للفلترة المحددة</td>';
            tbody.appendChild(noResultsRow);
        }
    } catch (error) {
        console.error('خطأ في فلترة المسحوبات والخصومات:', error);
    }
}

function showAddDeductionModal(userId) {
    const modal = document.getElementById('deductionModal');
    const title = document.getElementById('deductionModalTitle');
    const form = document.getElementById('deductionForm');
    
    if (!modal || !title || !form) return;
    
    title.textContent = 'إضافة سحب/خصم';
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

// ========== دوال تعديل الراتب ==========

function showEditSalaryModal(userId, userName, currentSalary) {
    try {
        const modal = document.getElementById('editSalaryModal');
        const title = document.getElementById('editSalaryModalTitle');
        const form = document.getElementById('editSalaryForm');
        
        if (!modal || !title || !form) {
            console.error('عناصر المودال غير موجودة');
            return;
        }
        
        // التحقق من صلاحيات المالك
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        if (!isOwner) {
            showMessage('هذه الميزة متاحة للمالك فقط', 'error');
            return;
        }
        
        title.textContent = 'تعديل الراتب';
        form.reset();
        
        document.getElementById('editSalaryUserId').value = userId;
        document.getElementById('editSalaryUserName').value = userName || '';
        document.getElementById('editSalaryAmount').value = currentSalary || 0;
        
        modal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في فتح مودال تعديل الراتب:', error);
        showMessage('حدث خطأ في فتح النموذج', 'error');
    }
}

function closeEditSalaryModal() {
    const modal = document.getElementById('editSalaryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveSalary(event) {
    event.preventDefault();
    
    try {
        // التحقق من صلاحيات المالك
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        if (!isOwner) {
            showMessage('هذه الميزة متاحة للمالك فقط', 'error');
            return;
        }
        
        const userId = document.getElementById('editSalaryUserId').value;
        const salary = parseFloat(document.getElementById('editSalaryAmount').value);
        
        if (!userId || !userId.trim()) {
            showMessage('معرف المستخدم مطلوب', 'error');
            return;
        }
        
        if (isNaN(salary) || salary < 0) {
            showMessage('الراتب يجب أن يكون رقماً موجباً', 'error');
            return;
        }
        
        // إظهار شاشة التحميل
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        try {
            const result = await API.updateUserSalary(userId, salary);
            
            if (result.success) {
                showMessage('تم تحديث الراتب بنجاح', 'success');
                closeEditSalaryModal();
                
                // إعادة تحميل بيانات المستحقات
                isLoadingSalaries = false;
                lastSalariesLoadTime = 0;
                
                // تحديث بيانات الخزنة إذا كان المستخدم في قسم الخزنة
                if (currentTreasuryBranchId) {
                    await loadSalariesForBranch(currentTreasuryBranchId);
                } else {
                    await loadSalaries(true);
                }
            } else {
                showMessage(result.message || 'حدث خطأ أثناء تحديث الراتب', 'error');
            }
        } catch (error) {
            console.error('خطأ في تحديث الراتب:', error);
            showMessage('حدث خطأ أثناء تحديث الراتب', 'error');
        } finally {
            // إخفاء شاشة التحميل
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
        }
    } catch (error) {
        console.error('خطأ في حفظ الراتب:', error);
        showMessage('حدث خطأ أثناء حفظ الراتب', 'error');
        
        // إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
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
        
        // إظهار شاشة التحميل قبل بدء العملية
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        try {
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
                
                // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
                // إعادة تعيين flag التحميل لإجبار إعادة التحميل
                isLoadingSalaries = false;
                lastSalariesLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
                
                // تحديث قائمة المستحقات
                await loadSalaries(true); // force = true
                
                // إذا كان المستخدم في قسم الخزنة، تحديث بيانات الخزنة وسجل المعاملات
                if (currentTreasuryBranchId) {
                    // تحديث سجل المعاملات أولاً (لإظهار السحب الجديدة) - بدون cache
                    await loadTreasuryTransactions(currentTreasuryBranchId, true);
                    
                    // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                    await loadTreasuryData(currentTreasuryBranchId, true);
                }
                
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
        } catch (apiError) {
            throw apiError;
        } finally {
            // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
        }
    } catch (error) {
        console.error('خطأ في حفظ السحب/الخصم:', error);
        showMessage('حدث خطأ أثناء حفظ السحب/الخصم', 'error');
        // التأكد من إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

async function editDeduction(deductionId) {
    try {
        // البحث عن السحب في البيانات الحالية
        let deduction = null;
        for (const salary of allSalaries) {
            if (salary.deductions) {
                deduction = salary.deductions.find(d => d.id === deductionId);
                if (deduction) break;
            }
        }
        
        if (!deduction) {
            showMessage('السحب/الخصم غير موجود', 'error');
            return;
        }
        
        const modal = document.getElementById('deductionModal');
        const title = document.getElementById('deductionModalTitle');
        const form = document.getElementById('deductionForm');
        
        if (!modal || !title || !form) return;
        
        title.textContent = 'تعديل سحب/خصم';
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
        console.error('خطأ في تعديل السحب/الخصم:', error);
        showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
    }
}

async function deleteDeduction(deductionId) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية لحذف المسحوبات/الخصومات', 'error');
        return;
    }
    
    if (!confirmAction('هل أنت متأكد من حذف هذه السحب/الخصم؟')) return;
    
    // إظهار شاشة التحميل قبل بدء العملية
    if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
        window.loadingOverlay.show();
    }
    
    try {
        const result = await API.deleteSalaryDeduction(deductionId);
        if (result.success) {
            showMessage(result.message);
            
            // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
            // إعادة تعيين flag التحميل لإجبار إعادة التحميل
            isLoadingSalaries = false;
            lastSalariesLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
            
            // تحديث قائمة المستحقات
            await loadSalaries(true); // force = true
            
            // إذا كان المستخدم في قسم الخزنة، تحديث بيانات الخزنة وسجل المعاملات
            if (currentTreasuryBranchId) {
                // تحديث سجل المعاملات أولاً (لإظهار الحذف) - بدون cache
                await loadTreasuryTransactions(currentTreasuryBranchId, true);
                
                // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                await loadTreasuryData(currentTreasuryBranchId, true);
            }
            
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
        console.error('خطأ في حذف السحب/الخصم:', error);
        showMessage('حدث خطأ أثناء حذف السحب/الخصم', 'error');
    } finally {
        // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// دالة مساعدة لـ escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== دوال الخزنة الجديدة ==========

let currentTreasuryBranchId = null;
let allTreasuryBranches = [];

// تحميل الفروع للمالك
async function loadTreasuryBranches() {
    try {
        const result = await API.request('branches.php', 'GET');
        if (result && result.success && result.data) {
            allTreasuryBranches = result.data;
            const branchSelect = document.getElementById('treasuryBranchSelect');
            if (branchSelect) {
                branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                allTreasuryBranches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل الفروع:', error);
    }
}

// التبديل بين الفروع
function switchTreasuryBranch() {
    const branchSelect = document.getElementById('treasuryBranchSelect');
    if (!branchSelect) return;
    
    const branchId = branchSelect.value;
    if (!branchId) return;
    
    currentTreasuryBranchId = branchId;
    loadTreasuryData(branchId);
}

// تحميل بيانات الخزنة
async function loadTreasuryData(branchId, skipTransactions = false) {
    try {
        if (!branchId) return;
        
        // تعيين الفرع الحالي
        currentTreasuryBranchId = branchId;
        
        // جلب معرف الفرع الأول - إذا لم تكن الفروع محملة، جلبها من API
        let firstBranchId = null;
        if (allTreasuryBranches && allTreasuryBranches.length > 0) {
            const sorted = [...allTreasuryBranches].sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA.getTime() - dateB.getTime();
                }
                return (a.id || '').localeCompare(b.id || '');
            });
            firstBranchId = sorted[0] ? sorted[0].id : null;
        } else {
            // إذا لم تكن الفروع محملة، جلب الفرع الأول من API
            try {
                const branchesResult = await API.request('branches.php', 'GET');
                if (branchesResult && branchesResult.success && branchesResult.data && branchesResult.data.length > 0) {
                    const sorted = [...branchesResult.data].sort((a, b) => {
                        const dateA = new Date(a.created_at || 0);
                        const dateB = new Date(b.created_at || 0);
                        if (dateA.getTime() !== dateB.getTime()) {
                            return dateA.getTime() - dateB.getTime();
                        }
                        return (a.id || '').localeCompare(b.id || '');
                    });
                    firstBranchId = sorted[0] ? sorted[0].id : null;
                    // حفظ الفروع للاستخدام المستقبلي
                    allTreasuryBranches = branchesResult.data;
                }
            } catch (error) {
                console.error('خطأ في جلب الفروع:', error);
            }
        }
        const isFirstBranch = (branchId === firstBranchId);
        
        // إخفاء جميع الأقسام أولاً
        document.getElementById('branch1-treasury-section').style.display = 'none';
        document.getElementById('branch2-treasury-section').style.display = 'none';
        
        // إظهار القسم المناسب
        if (isFirstBranch) {
            document.getElementById('branch1-treasury-section').style.display = 'block';
            await loadBranch1TreasuryData();
        } else {
            document.getElementById('branch2-treasury-section').style.display = 'block';
            await loadBranch2TreasuryData();
        }
        
        // تحميل سجل المعاملات بعد تحميل بيانات الخزنة (فقط إذا لم يتم تخطيه)
        if (!skipTransactions) {
            await loadTreasuryTransactions(branchId);
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات الخزنة:', error);
        showMessage('حدث خطأ أثناء تحميل بيانات الخزنة', 'error');
    }
}

// تحميل بيانات الفرع الأول
async function loadBranch1TreasuryData() {
    try {
        if (!currentTreasuryBranchId) return;
        
        const filterType = document.getElementById('branch1SalesFilterType')?.value || 'month';
        let startDate = null;
        let endDate = null;
        
        if (filterType === 'custom') {
            startDate = document.getElementById('branch1SalesStartDate')?.value;
            endDate = document.getElementById('branch1SalesEndDate')?.value;
            if (!startDate || !endDate) {
                showMessage('يرجى تحديد تاريخ البداية والنهاية', 'error');
                return;
            }
        }
        
        const url = `branch-treasury.php?branch_id=${currentTreasuryBranchId}&filter_type=${filterType}${startDate ? `&start_date=${startDate}&end_date=${endDate}` : ''}&_t=${Date.now()}`;
        const result = await API.request(url, 'GET');
        
        if (result && result.success && result.data) {
            const data = result.data;
            
            // تحديث المبيعات
            if (data.sales) {
                const totalSalesEl = document.getElementById('branch1TotalSales');
                if (totalSalesEl) {
                    totalSalesEl.textContent = formatCurrency(data.sales.total || 0);
                }
                const salesProfitEl = document.getElementById('branch1SalesProfit');
                if (salesProfitEl) {
                    salesProfitEl.textContent = formatCurrency(data.sales.profit || 0);
                }
            }
            
            // تحديث الملخص
            document.getElementById('branch1TotalExpenses').textContent = formatCurrency(data.expenses.total || 0);
            document.getElementById('branch1RepairCosts').textContent = formatCurrency(data.repairs.total_costs || 0);
            document.getElementById('branch1RepairProfits').textContent = formatCurrency(data.repairs.total_profits || 0);
            document.getElementById('branch1LossOperations').textContent = formatCurrency(data.loss_operations.total || 0);
            const branch1DamagedReturnsEl = document.getElementById('branch1DamagedReturns');
            if (branch1DamagedReturnsEl) {
                branch1DamagedReturnsEl.textContent = formatCurrency(data.damaged_returns?.total || 0);
            }
            const branch1NormalReturnsEl = document.getElementById('branch1NormalReturns');
            if (branch1NormalReturnsEl) {
                branch1NormalReturnsEl.textContent = formatCurrency(data.normal_returns?.total || 0);
            }
            document.getElementById('branch1TotalRevenue').textContent = formatCurrency(data.revenue.total || 0);
            
            // تحديث إجمالي المسحوبات والإضافات
            const branch1TotalWithdrawalsEl = document.getElementById('branch1TotalWithdrawals');
            if (branch1TotalWithdrawalsEl) {
                // عرض فقط المسحوبات من salary_deductions (type='withdrawal')
                branch1TotalWithdrawalsEl.textContent = formatCurrency(data.withdrawals?.salary_withdrawals || 0);
            }
            const branch1TreasuryWithdrawalsEl = document.getElementById('branch1TreasuryWithdrawals');
            if (branch1TreasuryWithdrawalsEl) {
                // عرض سحوبات من نموذج سحب من الخزنة
                branch1TreasuryWithdrawalsEl.textContent = formatCurrency(data.withdrawals?.treasury_withdrawals || 0);
            }
            const branch1TotalDepositsEl = document.getElementById('branch1TotalDeposits');
            if (branch1TotalDepositsEl) {
                branch1TotalDepositsEl.textContent = formatCurrency(data.deposits?.total || 0);
            }
            const branch1DebtCollectionsEl = document.getElementById('branch1DebtCollections');
            if (branch1DebtCollectionsEl) {
                branch1DebtCollectionsEl.textContent = formatCurrency(data.debt_collections?.total || 0);
            }
            
            // تحديث صافي رصيد الخزنة
            const netBalance = data.net_balance || 0;
            const netBalanceEl = document.getElementById('branch1NetBalance');
            if (netBalanceEl) {
                netBalanceEl.textContent = formatCurrency(Math.abs(netBalance));
                netBalanceEl.style.color = netBalance >= 0 ? 'rgba(27, 228, 33, 1)' : 'rgba(18, 253, 108, 1)';
            }
            
            // تحميل المصروفات والمستحقات
            await loadExpensesForBranch(currentTreasuryBranchId);
            await loadSalariesForBranch(currentTreasuryBranchId);
        } else {
            showMessage(result?.message || 'حدث خطأ أثناء تحميل البيانات', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات الفرع الأول:', error);
        showMessage('حدث خطأ أثناء تحميل بيانات الفرع الأول', 'error');
    }
}

// تحميل بيانات الفرع الثاني
async function loadBranch2TreasuryData() {
    try {
        if (!currentTreasuryBranchId) return;
        
        const url = `branch-treasury.php?branch_id=${currentTreasuryBranchId}&filter_type=month&_t=${Date.now()}`;
        const result = await API.request(url, 'GET');
        
        if (result && result.success && result.data) {
            const data = result.data;
            
            // تحديث الملخص
            document.getElementById('branch2TotalExpenses').textContent = formatCurrency(data.expenses.total || 0);
            document.getElementById('branch2RepairCosts').textContent = formatCurrency(data.repairs.total_costs || 0);
            document.getElementById('branch2LossOperations').textContent = formatCurrency(data.loss_operations.total || 0);
            document.getElementById('branch2TotalRevenue').textContent = formatCurrency(data.revenue.total || 0);
            
            // تحديث إجمالي المسحوبات والإضافات
            const branch2TotalWithdrawalsEl = document.getElementById('branch2TotalWithdrawals');
            if (branch2TotalWithdrawalsEl) {
                // عرض فقط المسحوبات من salary_deductions (type='withdrawal')
                branch2TotalWithdrawalsEl.textContent = formatCurrency(data.withdrawals?.salary_withdrawals || 0);
            }
            const branch2TreasuryWithdrawalsEl = document.getElementById('branch2TreasuryWithdrawals');
            if (branch2TreasuryWithdrawalsEl) {
                // عرض سحوبات من نموذج سحب من الخزنة
                branch2TreasuryWithdrawalsEl.textContent = formatCurrency(data.withdrawals?.treasury_withdrawals || 0);
            }
            const branch2TotalDepositsEl = document.getElementById('branch2TotalDeposits');
            if (branch2TotalDepositsEl) {
                branch2TotalDepositsEl.textContent = formatCurrency(data.deposits?.total || 0);
            }
            const branch2DebtCollectionsEl = document.getElementById('branch2DebtCollections');
            if (branch2DebtCollectionsEl) {
                branch2DebtCollectionsEl.textContent = formatCurrency(data.debt_collections?.total || 0);
            }
            
            // تحديث صافي رصيد الخزنة
            const netBalance = data.net_balance || 0;
            const netBalanceEl = document.getElementById('branch2NetBalance');
            if (netBalanceEl) {
                netBalanceEl.textContent = formatCurrency(Math.abs(netBalance));
                netBalanceEl.style.color = netBalance >= 0 ? 'rgba(13, 242, 20, 1)' : 'var(--danger-color)';
            }
            
            // تحميل المصروفات والمستحقات
            await loadExpensesForBranch(currentTreasuryBranchId, '2');
            await loadSalariesForBranch(currentTreasuryBranchId, '2');
        } else {
            showMessage(result?.message || 'حدث خطأ أثناء تحميل البيانات', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات الفرع الثاني:', error);
        showMessage('حدث خطأ أثناء تحميل بيانات الفرع الثاني', 'error');
    }
}

// تحديث فلتر المبيعات للفرع الأول
function updateBranch1SalesFilter() {
    const filterType = document.getElementById('branch1SalesFilterType')?.value || 'month';
    const customDateRange = document.getElementById('branch1CustomDateRange');
    
    if (customDateRange) {
        if (filterType === 'custom') {
            customDateRange.style.display = 'flex';
            const now = new Date();
            const startDateInput = document.getElementById('branch1SalesStartDate');
            const endDateInput = document.getElementById('branch1SalesEndDate');
            if (startDateInput && !startDateInput.value) {
                startDateInput.value = now.toISOString().split('T')[0];
            }
            if (endDateInput && !endDateInput.value) {
                endDateInput.value = now.toISOString().split('T')[0];
            }
        } else {
            customDateRange.style.display = 'none';
            loadBranch1TreasuryData();
        }
    }
}

// تحميل المصروفات للفرع
async function loadExpensesForBranch(branchId, suffix = '') {
    try {
        const result = await API.getExpenses(branchId);
        if (result.success) {
            allExpenses = result.data || [];
            const tableId = suffix ? `expensesTable${suffix}` : 'expensesTable';
            const tbodyId = suffix ? `expensesTableBody${suffix}` : 'expensesTableBody';
            displayExpensesForBranch(allExpenses, tableId, tbodyId, suffix);
        }
    } catch (error) {
        console.error('خطأ في تحميل المصروفات:', error);
    }
}

// عرض المصروفات للفرع
function displayExpensesForBranch(expenses, tableId, tbodyId, suffix = '') {
    try {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        const paginated = paginate(expenses, currentExpensePage, expensesPerPage);
        
        if (paginated.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">لا توجد مصروفات</td></tr>';
            return;
        }
        
        tbody.innerHTML = paginated.data.map(expense => `
            <tr>
                <td><strong style="color: var(--danger-color);">${formatCurrency(expense.amount)}</strong></td>
                <td>${formatDate(expense.date)}</td>
                <td>${escapeHtml(expense.description || '-')}</td>
            </tr>
        `).join('');
        
        const paginationId = suffix ? `expensesPagination${suffix}` : 'expensesPagination';
        createPaginationButtons(
            document.getElementById(paginationId),
            paginated.totalPages,
            currentExpensePage,
            (page) => {
                currentExpensePage = page;
                displayExpensesForBranch(expenses, tableId, tbodyId, suffix);
            }
        );
        
        hideByPermission();
    } catch (error) {
        console.error('خطأ في عرض المصروفات:', error);
    }
}

// تحميل المستحقات للفرع
async function loadSalariesForBranch(branchId, suffix = '') {
    try {
        const result = await API.getSalaries(branchId);
        if (result.success) {
            allSalaries = result.data || [];
            const tbodyId = suffix ? `salariesTableBody${suffix}` : 'salariesTableBody';
            displaySalariesForBranch(allSalaries, tbodyId, suffix);
        }
    } catch (error) {
        console.error('خطأ في تحميل المستحقات:', error);
    }
}

// عرض المستحقات للفرع
function displaySalariesForBranch(salaries, tbodyId, suffix = '') {
    try {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        const paginated = paginate(salaries, currentSalaryPage, salariesPerPage);
        
        if (paginated.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد مستحقات</td></tr>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        paginated.data.forEach(salary => {
            // التحقق من أن salary.id موجود
            if (!salary.id || salary.id === null || salary.id === undefined) {
                console.error('تحذير: معرف المستخدم غير موجود في بيانات الراتب:', salary);
                return; // تخطي هذا السطر إذا لم يكن id موجوداً
            }
            
            const tr = document.createElement('tr');
            const salaryAmount = parseFloat(salary.salary || 0);
            const totalDeductions = parseFloat(salary.total_deductions || 0); // الخصومات فقط
            const totalWithdrawals = parseFloat(salary.total_withdrawals || 0); // المسحوبات فقط
            const netSalary = salaryAmount - totalDeductions - totalWithdrawals;
            
            // ID في قاعدة البيانات هو varchar(50) ويمكن أن يكون رقم أو UUID
            // استخدام ID كما هو (string) دون تحويله إلى رقم
            const userId = String(salary.id).trim();
            if (!userId || userId === '' || userId === 'null' || userId === 'undefined') {
                console.error('تحذير: معرف المستخدم غير صحيح في بيانات الراتب:', salary.id, salary);
                return; // تخطي هذا السطر إذا كان ID غير صحيح
            }
            
            // تنظيف ID من الأحرف الخاصة للاستخدام في HTML
            const safeId = userId.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
            // سجل للتحقق من ID
            console.log('عرض بيانات المستخدم (للفرع):', {
                name: salary.name,
                username: salary.username,
                id_from_data: salary.id,
                id_used: userId,
                safeId: safeId
            });
            
            // التحقق من صلاحيات المالك
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            
            // زر تعديل الراتب (للمالك فقط)
            const editSalaryButton = isOwner ? `
                <button onclick="showEditSalaryModal('${safeId}', '${escapeHtml(salary.name || '')}', ${salaryAmount})" class="btn btn-sm btn-icon" title="تعديل الراتب" style="color: var(--primary-color); margin-right: 5px;">
                    <i class="bi bi-pencil-square"></i>
                </button>
            ` : '';
            
            tr.innerHTML = `
                <td>
                    <div><strong>${escapeHtml(salary.name || '')}</strong></div>
                    <div style="font-size: 0.85em; color: var(--text-light);">${escapeHtml(salary.username || '')}</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <strong style="color: var(--primary-color);">${formatCurrency(salaryAmount)}</strong>
                        ${editSalaryButton}
                    </div>
                </td>
                <td><strong style="color: var(--danger-color);">${formatCurrency(totalWithdrawals)}</strong></td>
                <td><strong style="color: var(--warning-color);">${formatCurrency(totalDeductions)}</strong></td>
                <td><strong style="color: var(--success-color);">${formatCurrency(netSalary)}</strong></td>
                <td>
                    <button onclick="showAddDeductionModal('${safeId}')" class="btn btn-sm btn-icon" title="إضافة سحب/خصم" data-permission="manager"><i class="bi bi-plus-circle"></i></button>
                </td>
            `;
            fragment.appendChild(tr);
        });
        
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        
        const paginationId = suffix ? `salariesPagination${suffix}` : 'salariesPagination';
        createPaginationButtons(
            document.getElementById(paginationId),
            paginated.totalPages,
            currentSalaryPage,
            (page) => {
                currentSalaryPage = page;
                displaySalariesForBranch(salaries, tbodyId, suffix);
            }
        );
        
        hideByPermission();
    } catch (error) {
        console.error('خطأ في عرض المستحقات:', error);
    }
}

// ========== دوال السحب من الخزنة ==========

window.showWithdrawalModal = function() {
    try {
        const modal = document.getElementById('withdrawalModal');
        const form = document.getElementById('withdrawalForm');
        
        if (!modal || !form) {
            showMessage('حدث خطأ في فتح نموذج السحب', 'error');
            return;
        }
        
        form.reset();
        modal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في عرض نموذج السحب:', error);
        showMessage('حدث خطأ في فتح نموذج السحب', 'error');
    }
};

window.closeWithdrawalModal = function() {
    const modal = document.getElementById('withdrawalModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.saveWithdrawal = async function(event) {
    event.preventDefault();
    
    try {
        if (!currentTreasuryBranchId) {
            showMessage('يرجى اختيار الفرع أولاً', 'error');
            return;
        }
        
        const amount = parseFloat(document.getElementById('withdrawalAmount').value);
        const description = document.getElementById('withdrawalDescription').value.trim();
        
        if (!amount || amount <= 0) {
            showMessage('المبلغ يجب أن يكون أكبر من صفر', 'error');
            return;
        }
        
        // التحقق من رصيد الخزنة قبل السحب
        try {
            // جلب الرصيد الحالي من API
            const filterType = document.getElementById('branch1SalesFilterType')?.value || 
                              document.getElementById('branch2SalesFilterType')?.value || 'month';
            let startDate = null;
            let endDate = null;
            
            if (filterType === 'custom') {
                startDate = document.getElementById('branch1SalesStartDate')?.value || 
                           document.getElementById('branch2SalesStartDate')?.value;
                endDate = document.getElementById('branch1SalesEndDate')?.value || 
                         document.getElementById('branch2SalesEndDate')?.value;
            }
            
            const url = `branch-treasury.php?branch_id=${currentTreasuryBranchId}&filter_type=${filterType}${startDate ? `&start_date=${startDate}&end_date=${endDate}` : ''}&_t=${Date.now()}`;
            const balanceResult = await API.request(url, 'GET');
            
            if (balanceResult && balanceResult.success && balanceResult.data) {
                const currentNetBalance = parseFloat(balanceResult.data.net_balance || 0);
                
                if (currentNetBalance < amount) {
                    const availableBalance = Math.max(0, currentNetBalance);
                    showMessage(`رصيد الخزنة غير كافٍ. الرصيد المتاح: ${formatCurrency(availableBalance)} والمبلغ المطلوب: ${formatCurrency(amount)}`, 'error');
                    return;
                }
            }
        } catch (error) {
            console.error('خطأ في التحقق من رصيد الخزنة:', error);
            // نستمر في العملية لأن التحقق الأساسي سيكون في الـ API
        }
        
        if (!confirmAction(`هل أنت متأكد من سحب ${formatCurrency(amount)} من الخزنة؟`)) {
            return;
        }
        
        // إظهار شاشة التحميل قبل بدء العملية
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        try {
            const result = await API.request('treasury-withdrawals.php', 'POST', {
                branch_id: currentTreasuryBranchId,
                amount: amount,
                description: description
            });
            
            if (result && result.success) {
                showMessage('تم تسجيل السحب بنجاح');
                closeWithdrawalModal();
                
                // تحديث سجل المعاملات أولاً (لإظهار السحب الجديد) - بدون cache
                await loadTreasuryTransactions(currentTreasuryBranchId, true);
                
                // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                await loadTreasuryData(currentTreasuryBranchId, true);
                
                // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            } else {
                // إخفاء شاشة التحميل في حالة الخطأ
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
                showMessage(result?.message || 'حدث خطأ أثناء تسجيل السحب', 'error');
            }
        } catch (apiError) {
            // إخفاء شاشة التحميل في حالة الخطأ
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
            throw apiError;
        }
    } catch (error) {
        console.error('خطأ في حفظ السحب:', error);
        showMessage('حدث خطأ أثناء تسجيل السحب', 'error');
        // التأكد من إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// ========== دوال الإضافة إلى الخزنة ==========

window.showDepositModal = function() {
    try {
        const modal = document.getElementById('depositModal');
        const form = document.getElementById('depositForm');
        
        if (!modal || !form) {
            showMessage('حدث خطأ في فتح نموذج الإضافة', 'error');
            return;
        }
        
        form.reset();
        modal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في عرض نموذج الإضافة:', error);
        showMessage('حدث خطأ في فتح نموذج الإضافة', 'error');
    }
};

window.closeDepositModal = function() {
    const modal = document.getElementById('depositModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.saveDeposit = async function(event) {
    event.preventDefault();
    
    try {
        if (!currentTreasuryBranchId) {
            showMessage('يرجى اختيار الفرع أولاً', 'error');
            return;
        }
        
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const description = document.getElementById('depositDescription').value.trim();
        
        if (!amount || amount <= 0) {
            showMessage('المبلغ يجب أن يكون أكبر من صفر', 'error');
            return;
        }
        
        if (!confirmAction(`هل أنت متأكد من إضافة ${formatCurrency(amount)} إلى الخزنة؟`)) {
            return;
        }
        
        // إظهار شاشة التحميل قبل بدء العملية
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        try {
            const result = await API.request('treasury-deposits.php', 'POST', {
                branch_id: currentTreasuryBranchId,
                amount: amount,
                description: description
            });
            
            if (result && result.success) {
                showMessage('تم تسجيل الإضافة بنجاح');
                closeDepositModal();
                
                // تحديث سجل المعاملات أولاً (لإظهار الإضافة الجديدة) - بدون cache
                await loadTreasuryTransactions(currentTreasuryBranchId, true);
                
                // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache (تخطي تحديث المعاملات لأننا قمنا بذلك بالفعل)
                await loadTreasuryData(currentTreasuryBranchId, true);
                
                // إخفاء شاشة التحميل بعد اكتمال جميع العمليات والتأكد من عرض البيانات
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            } else {
                // إخفاء شاشة التحميل في حالة الخطأ
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
                showMessage(result?.message || 'حدث خطأ أثناء تسجيل الإضافة', 'error');
            }
        } catch (apiError) {
            // إخفاء شاشة التحميل في حالة الخطأ
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
            throw apiError;
        }
    } catch (error) {
        console.error('خطأ في حفظ الإضافة:', error);
        showMessage('حدث خطأ أثناء تسجيل الإضافة', 'error');
        // التأكد من إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// ========== دوال تحصيل الدين من العملاء التجاريين ==========

window.showDebtCollectionModal = async function() {
    try {
        const modal = document.getElementById('debtCollectionModal');
        const form = document.getElementById('debtCollectionForm');
        const customerSelect = document.getElementById('debtCollectionCustomer');
        
        if (!modal || !form || !customerSelect) {
            showMessage('حدث خطأ في فتح نموذج تحصيل الدين', 'error');
            return;
        }
        
        if (!currentTreasuryBranchId) {
            showMessage('يرجى اختيار الفرع أولاً', 'error');
            return;
        }
        
        // جلب العملاء التجاريين
        try {
            const result = await API.request(`customers.php?type=commercial&branch_id=${currentTreasuryBranchId}`, 'GET');
            if (result && result.success && result.data) {
                customerSelect.innerHTML = '<option value="">اختر العميل...</option>';
                result.data.forEach(customer => {
                    if (customer.customer_type === 'commercial') {
                        const totalDebt = parseFloat(customer.total_debt || 0);
                        if (totalDebt > 0) {
                            const option = document.createElement('option');
                            option.value = customer.id;
                            option.textContent = `${customer.name}${customer.shop_name ? ' - ' + customer.shop_name : ''} (دين: ${formatCurrency(totalDebt)})`;
                            option.setAttribute('data-total-debt', totalDebt);
                            customerSelect.appendChild(option);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('خطأ في جلب العملاء التجاريين:', error);
            showMessage('حدث خطأ في جلب العملاء التجاريين', 'error');
        }
        
        form.reset();
        document.getElementById('debtCollectionCustomerInfo').style.display = 'none';
        modal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في عرض نموذج تحصيل الدين:', error);
        showMessage('حدث خطأ في فتح نموذج تحصيل الدين', 'error');
    }
};

window.closeDebtCollectionModal = function() {
    const modal = document.getElementById('debtCollectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.updateDebtCollectionCustomerInfo = function() {
    const customerSelect = document.getElementById('debtCollectionCustomer');
    const customerInfo = document.getElementById('debtCollectionCustomerInfo');
    const totalDebtEl = document.getElementById('debtCollectionTotalDebt');
    const amountInput = document.getElementById('debtCollectionAmount');
    
    if (!customerSelect || !customerInfo || !totalDebtEl) return;
    
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
        const totalDebt = parseFloat(selectedOption.getAttribute('data-total-debt') || 0);
        totalDebtEl.textContent = formatCurrency(totalDebt);
        customerInfo.style.display = 'block';
        if (amountInput) {
            amountInput.max = totalDebt;
            amountInput.value = totalDebt;
        }
    } else {
        customerInfo.style.display = 'none';
    }
};

window.saveDebtCollection = async function(event) {
    event.preventDefault();
    
    try {
        if (!currentTreasuryBranchId) {
            showMessage('يرجى اختيار الفرع أولاً', 'error');
            return;
        }
        
        const customerId = document.getElementById('debtCollectionCustomer').value;
        const amount = parseFloat(document.getElementById('debtCollectionAmount').value);
        const description = document.getElementById('debtCollectionDescription').value.trim();
        
        if (!customerId) {
            showMessage('يرجى اختيار العميل', 'error');
            return;
        }
        
        if (!amount || amount <= 0) {
            showMessage('المبلغ يجب أن يكون أكبر من صفر', 'error');
            return;
        }
        
        if (!confirmAction(`هل أنت متأكد من تحصيل ${formatCurrency(amount)} من الدين؟`)) {
            return;
        }
        
        // إظهار شاشة التحميل قبل بدء العملية
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        try {
            const result = await API.request('debt-collections.php', 'POST', {
                branch_id: currentTreasuryBranchId,
                customer_id: customerId,
                amount: amount,
                description: description
            });
            
            if (result && result.success) {
                showMessage('تم تسجيل تحصيل الدين بنجاح');
                closeDebtCollectionModal();
                
                // تحديث سجل المعاملات أولاً (لإظهار التحصيل الجديد) - بدون cache
                await loadTreasuryTransactions(currentTreasuryBranchId, true);
                
                // ثم تحديث بيانات الخزنة (لحساب الرصيد الجديد) - بدون cache
                await loadTreasuryData(currentTreasuryBranchId, true);
                
                // إخفاء شاشة التحميل بعد اكتمال جميع العمليات
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            } else {
                // إخفاء شاشة التحميل في حالة الخطأ
                if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
                showMessage(result?.message || 'حدث خطأ أثناء تسجيل تحصيل الدين', 'error');
            }
        } catch (apiError) {
            // إخفاء شاشة التحميل في حالة الخطأ
            if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                window.loadingOverlay.hide();
            }
            throw apiError;
        }
    } catch (error) {
        console.error('خطأ في حفظ تحصيل الدين:', error);
        showMessage('حدث خطأ أثناء تسجيل تحصيل الدين', 'error');
        // التأكد من إخفاء شاشة التحميل في حالة الخطأ
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
};

// ========== دوال سجل المعاملات ==========

let currentTransactionsPage = 1;
const transactionsPerPage = 5;
let allTreasuryTransactions = [];
let filteredTreasuryTransactions = [];

// إعداد event listeners لحقول البحث والفلترة
function setupTreasuryTransactionsFilters() {
    try {
        const searchInput = document.getElementById('treasuryTransactionSearch');
        const typeFilter = document.getElementById('treasuryTransactionTypeFilter');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                applyTreasuryTransactionsFilters();
            }, 300));
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                applyTreasuryTransactionsFilters();
            });
        }
    } catch (error) {
        console.error('خطأ في إعداد فلاتر المعاملات:', error);
    }
}

async function loadTreasuryTransactions(branchId, skipCache = false) {
    try {
        if (!branchId) return;
        
        // تحميل جميع المعاملات (بدون pagination) للفلترة من جانب العميل
        const url = `treasury-transactions.php?branch_id=${branchId}&page=1&per_page=10000${skipCache ? '&_t=' + Date.now() : ''}`;
        const result = await API.request(url, 'GET');
        
        if (result && result.success && result.data) {
            const { transactions } = result.data;
            allTreasuryTransactions = transactions || [];
            // تطبيق الفلترة والبحث الحالية
            applyTreasuryTransactionsFilters();
            
            // الانتظار قليلاً للتأكد من اكتمال تحديث DOM وإظهار المعاملات في الجدول
            await new Promise(resolve => {
                // استخدام requestAnimationFrame لضمان تحديث DOM
                requestAnimationFrame(() => {
                    // تأخير إضافي لضمان اكتمال العرض
                    setTimeout(resolve, 150);
                });
            });
        } else {
            allTreasuryTransactions = [];
            filteredTreasuryTransactions = [];
            const tbody = document.getElementById('treasuryTransactionsTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">حدث خطأ أثناء تحميل المعاملات</td></tr>';
            }
            const paginationDiv = document.getElementById('treasuryTransactionsPagination');
            if (paginationDiv) paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('خطأ في تحميل المعاملات:', error);
        allTreasuryTransactions = [];
        filteredTreasuryTransactions = [];
        const tbody = document.getElementById('treasuryTransactionsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">حدث خطأ أثناء تحميل المعاملات</td></tr>';
        }
        const paginationDiv = document.getElementById('treasuryTransactionsPagination');
        if (paginationDiv) paginationDiv.innerHTML = '';
    }
}

// تطبيق الفلترة والبحث على المعاملات
function applyTreasuryTransactionsFilters() {
    try {
        const searchTerm = (document.getElementById('treasuryTransactionSearch')?.value || '').trim().toLowerCase();
        const typeFilter = document.getElementById('treasuryTransactionTypeFilter')?.value || '';
        
        // فلترة المعاملات
        filteredTreasuryTransactions = allTreasuryTransactions.filter(transaction => {
            // فلترة حسب النوع
            if (typeFilter && (transaction.type_text || transaction.transaction_type) !== typeFilter) {
                return false;
            }
            
            // البحث في جميع الحقول
            if (searchTerm) {
                const dateStr = formatDate(transaction.created_at).toLowerCase();
                const typeStr = (transaction.type_text || transaction.transaction_type || '').toLowerCase();
                const amountStr = formatCurrency(transaction.amount || 0).toLowerCase();
                const descriptionStr = (transaction.description || '').toLowerCase();
                const userStr = (transaction.created_by_name || '').toLowerCase();
                
                const searchText = `${dateStr} ${typeStr} ${amountStr} ${descriptionStr} ${userStr}`;
                if (!searchText.includes(searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // إعادة تعيين الصفحة الحالية إلى 1 عند الفلترة
        currentTransactionsPage = 1;
        
        // عرض المعاملات المفلترة
        displayFilteredTreasuryTransactions();
    } catch (error) {
        console.error('خطأ في تطبيق الفلترة:', error);
        filteredTreasuryTransactions = [];
        displayFilteredTreasuryTransactions();
    }
}

// عرض المعاملات المفلترة مع pagination
function displayFilteredTreasuryTransactions() {
    try {
        const tbody = document.getElementById('treasuryTransactionsTableBody');
        if (!tbody) return;
        
        if (filteredTreasuryTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد معاملات</td></tr>';
            const paginationDiv = document.getElementById('treasuryTransactionsPagination');
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }
        
        // Pagination للبيانات المفلترة
        const totalPages = Math.ceil(filteredTreasuryTransactions.length / transactionsPerPage);
        const startIndex = (currentTransactionsPage - 1) * transactionsPerPage;
        const endIndex = startIndex + transactionsPerPage;
        const paginatedTransactions = filteredTreasuryTransactions.slice(startIndex, endIndex);
        
        // عرض المعاملات
        tbody.innerHTML = paginatedTransactions.map(transaction => {
            const amount = parseFloat(transaction.amount || 0);
            const isNegative = ['expense', 'repair_cost', 'loss_operation', 'sales_cost', 'withdrawal', 'damaged_return'].includes(transaction.transaction_type);
            const amountColor = isNegative ? 'var(--danger-color)' : 'var(--success-color)';
            const amountSign = isNegative ? '-' : '+';
            
            return `
                <tr>
                    <td>${formatDate(transaction.created_at)}</td>
                    <td><strong>${escapeHtml(transaction.type_text || transaction.transaction_type)}</strong></td>
                    <td><strong style="color: ${amountColor};">${amountSign}${formatCurrency(Math.abs(amount))}</strong></td>
                    <td>${escapeHtml(transaction.description || '-')}</td>
                    <td>${escapeHtml(transaction.created_by_name || '-')}</td>
                </tr>
            `;
        }).join('');
        
        // إضافة pagination
        const paginationDiv = document.getElementById('treasuryTransactionsPagination');
        if (paginationDiv && totalPages > 1) {
            createPaginationButtons(
                paginationDiv,
                totalPages,
                currentTransactionsPage,
                (newPage) => {
                    currentTransactionsPage = newPage;
                    displayFilteredTreasuryTransactions();
                }
            );
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('خطأ في عرض المعاملات:', error);
        const tbody = document.getElementById('treasuryTransactionsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">حدث خطأ أثناء عرض المعاملات</td></tr>';
        }
    }
}

// ✅ تصدير الدوال إلى window لجعلها متاحة عالمياً
window.showAddExpenseModal = showAddExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.saveExpense = saveExpense;
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.filterExpenses = filterExpenses;
window.loadExpensesSection = loadExpensesSection;
window.switchTreasuryBranch = switchTreasuryBranch;
window.showUserProfileModal = showUserProfileModal;
window.showUserDeductionsModal = showUserDeductionsModal;
window.showAllDeductionsModal = showAllDeductionsModal;
window.filterAllDeductions = filterAllDeductions;
window.filterUserDeductions = filterUserDeductions;
window.closeUserProfileModal = closeUserProfileModal;
window.showAddDeductionModal = showAddDeductionModal;
window.closeDeductionModal = closeDeductionModal;
window.saveDeduction = saveDeduction;
window.editDeduction = editDeduction;
window.deleteDeduction = deleteDeduction;
window.showEditSalaryModal = showEditSalaryModal;
window.closeEditSalaryModal = closeEditSalaryModal;
window.saveSalary = saveSalary;
window.loadBranch1TreasuryData = loadBranch1TreasuryData;
window.filterUserProfileDeductions = filterUserProfileDeductions;

} // ✅ نهاية حماية من التحميل المكرر


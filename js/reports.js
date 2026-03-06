// التقارير المالية

let currentReport = null;
let branches = [];
let currentBranchId = null;
let branchReports = {}; // تخزين تقارير كل فرع

// تحميل قسم التقارير
async function loadReportsSection() {
    const section = document.getElementById('reports-section');
    if (!section) {
        console.error('❌ [Reports] قسم التقارير غير موجود');
        return;
    }

    try {
        // جلب الفروع
        await loadBranches();
        
        section.innerHTML = `
            <div class="section-header">
                <h2><i class="bi bi-graph-up"></i> التقارير المالية</h2>
                <button onclick="printReport()" class="btn btn-primary" id="printReportBtn" style="display: none;">
                    <i class="bi bi-printer-fill"></i> طباعة التقرير
                </button>
            </div>

            ${branches.length === 0 ? `
                <div class="alert alert-info" style="text-align: center; padding: 40px; margin: 20px 0;">
                    <i class="bi bi-info-circle" style="font-size: 48px; margin-bottom: 20px; color: var(--primary-color);"></i>
                    <p style="font-size: 18px; color: var(--text-dark);">لا توجد فروع متاحة</p>
                    <p style="color: var(--text-light); margin-top: 10px;">يرجى إضافة فروع من الإعدادات أولاً</p>
                </div>
            ` : `
                <div class="branches-tabs-container">
                    <div class="branches-tabs" id="branchesTabs"></div>
                </div>

                <div class="report-filters" id="reportFilters"></div>

                <div id="reportResult" class="report-result" style="display: none;"></div>
            `}

            <style>
                .branches-tabs-container {
                    background: var(--white);
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                    margin-bottom: 25px;
                }

                .branches-tabs {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .branch-tab {
                    padding: 12px 24px;
                    background: var(--light-bg);
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 16px;
                    font-weight: 500;
                    color: var(--text-dark);
                    min-width: 120px;
                    text-align: center;
                }

                .branch-tab:hover {
                    background: var(--secondary-color);
                    color: var(--white);
                    border-color: var(--secondary-color);
                }

                .branch-tab.active {
                    background: var(--primary-color);
                    color: var(--white);
                    border-color: var(--primary-color);
                }

                .report-filters {
                    background: var(--white);
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                    margin-bottom: 25px;
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }

                .report-filters .form-group {
                    flex: 1;
                    min-width: 200px;
                }

                .report-filters label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: var(--text-dark);
                }

                .report-filters select,
                .report-filters input[type="date"],
                .report-filters input[type="month"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 5px;
                    font-size: 14px;
                }

                .report-filters .btn {
                    padding: 10px 30px;
                    white-space: nowrap;
                }

                .report-result {
                    margin-top: 25px;
                }

                .report-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .summary-card {
                    background: var(--white);
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                    text-align: center;
                }

                .summary-card h3 {
                    color: var(--text-light);
                    font-size: 1em;
                    margin-bottom: 10px;
                }

                .summary-value {
                    font-size: 1.8em;
                    font-weight: bold;
                    margin: 10px 0;
                }

                .summary-value.revenue {
                    color: var(--primary-color);
                }

                .summary-value.expense {
                    color: var(--danger-color);
                }

                .summary-value.profit {
                    color: var(--success-color);
                }

                .report-breakdown {
                    background: var(--white);
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                    margin-bottom: 25px;
                }

                .breakdown-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border-color);
                }

                .breakdown-item:last-child {
                    border-bottom: none;
                }

                .breakdown-item.total-breakdown {
                    font-weight: bold;
                    font-size: 1.1em;
                    padding-top: 20px;
                    margin-top: 10px;
                    border-top: 2px solid var(--border-color);
                }

                .report-details {
                    background: var(--white);
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                }

                .report-details h3 {
                    margin-bottom: 20px;
                    color: var(--text-dark);
                }

                .table-container {
                    overflow-x: auto;
                    margin-bottom: 30px;
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .branches-tabs {
                        flex-direction: column;
                    }

                    .branch-tab {
                        width: 100%;
                    }

                    .report-filters {
                        flex-direction: column;
                    }

                    .report-filters .form-group {
                        width: 100%;
                    }

                    .report-summary {
                        grid-template-columns: 1fr;
                    }

                    .summary-card {
                        padding: 20px;
                    }
                }
            </style>
        `;

        // إذا كان هناك فروع، قم بإنشاء التبويبات والفلاتر
        if (branches.length > 0) {
            createBranchTabs();
            createReportFilters();
            // تحديد الفرع الأول كافتراضي
            if (branches.length > 0) {
                currentBranchId = branches[0].id;
                selectBranch(currentBranchId);
            }
        }
    } catch (error) {
        console.error('❌ [Reports] خطأ في تحميل قسم التقارير:', error);
        section.innerHTML = `
            <div class="alert alert-danger" style="text-align: center; padding: 40px; margin: 20px 0;">
                <i class="bi bi-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; color: var(--danger-color);"></i>
                <p style="font-size: 18px; color: var(--danger-color);">حدث خطأ في تحميل التقارير</p>
                <p style="color: var(--text-light); margin-top: 10px;">${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="bi bi-arrow-clockwise"></i> إعادة تحميل الصفحة
                </button>
            </div>
        `;
    }
}

// جلب الفروع
async function loadBranches() {
    try {
        console.log('🔄 [Reports] بدء تحميل الفروع...');
        const result = await API.request('branches.php', 'GET', null, { silent: true });
        console.log('📥 [Reports] استجابة API:', result);
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            branches = result.data;
            console.log(`📊 [Reports] تم جلب ${branches.length} فرع من API`);
            
            // تحديد الفرع الأول (للاستخدام الافتراضي)
            if (branches.length > 0) {
                // ترتيب حسب created_at أو id
                const sortedBranches = [...branches].sort((a, b) => {
                    const dateA = new Date(a.created_at || 0);
                    const dateB = new Date(b.created_at || 0);
                    if (dateA.getTime() !== dateB.getTime()) {
                        return dateA.getTime() - dateB.getTime();
                    }
                    return (a.id || '').localeCompare(b.id || '');
                });
                branches = sortedBranches;
                console.log(`✅ [Reports] تم ترتيب ${branches.length} فرع`);
            }
        } else {
            branches = [];
            console.warn('⚠️ [Reports] لا توجد فروع متاحة - استجابة API:', result);
        }
    } catch (error) {
        console.error('❌ [Reports] خطأ في جلب الفروع:', error);
        branches = [];
    }
}

// إنشاء تبويبات الفروع
function createBranchTabs() {
    const tabsContainer = document.getElementById('branchesTabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = branches.map(branch => `
        <div class="branch-tab ${branch.id === currentBranchId ? 'active' : ''}" 
             onclick="selectBranch(${branch.id})">
            ${branch.name || `الفرع ${branch.id}`}
        </div>
    `).join('');
}

// تحديد فرع
function selectBranch(branchId) {
    currentBranchId = branchId;
    
    // تحديث التبويبات
    const tabs = document.querySelectorAll('.branch-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('onclick').includes(`selectBranch(${branchId})`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // إخفاء نتائج التقرير السابقة
    const reportResult = document.getElementById('reportResult');
    if (reportResult) {
        reportResult.style.display = 'none';
        document.getElementById('printReportBtn').style.display = 'none';
    }
}

// إنشاء فلاتر التقرير
function createReportFilters() {
    const filtersContainer = document.getElementById('reportFilters');
    if (!filtersContainer) return;

    filtersContainer.innerHTML = `
        <div class="form-group">
            <label for="reportType">نوع التقرير</label>
            <select id="reportType" onchange="handleReportTypeChange()">
                <option value="daily">تقرير يومي</option>
                <option value="monthly">تقرير شهري</option>
                <option value="custom">تقرير مخصص</option>
            </select>
        </div>

        <div class="form-group" id="dailyDateGroup">
            <label for="dailyDate">التاريخ</label>
            <input type="date" id="dailyDate" value="${getTodayDate()}">
        </div>

        <div class="form-group" id="monthlyDateGroup" style="display: none;">
            <label for="monthlyDate">الشهر</label>
            <input type="month" id="monthlyDate" value="${new Date().toISOString().slice(0, 7)}">
        </div>

        <div class="form-group" id="customStartDateGroup" style="display: none;">
            <label for="customStartDate">من تاريخ</label>
            <input type="date" id="customStartDate">
        </div>

        <div class="form-group" id="customEndDateGroup" style="display: none;">
            <label for="customEndDate">إلى تاريخ</label>
            <input type="date" id="customEndDate">
        </div>

        <button onclick="generateReport()" class="btn btn-primary">
            <i class="bi bi-search"></i> عرض التقرير
        </button>
    `;
}

// تغيير نوع التقرير
function handleReportTypeChange() {
    const reportType = document.getElementById('reportType').value;
    
    document.getElementById('dailyDateGroup').style.display = 'none';
    document.getElementById('monthlyDateGroup').style.display = 'none';
    document.getElementById('customStartDateGroup').style.display = 'none';
    document.getElementById('customEndDateGroup').style.display = 'none';

    if (reportType === 'daily') {
        document.getElementById('dailyDateGroup').style.display = 'block';
    } else if (reportType === 'monthly') {
        document.getElementById('monthlyDateGroup').style.display = 'block';
    } else if (reportType === 'custom') {
        document.getElementById('customStartDateGroup').style.display = 'block';
        document.getElementById('customEndDateGroup').style.display = 'block';
    }
}

// إنشاء تقرير
async function generateReport() {
    if (!currentBranchId) {
        showMessage('يرجى تحديد فرع', 'error');
        return;
    }

    const reportType = document.getElementById('reportType').value;
    let startDate, endDate;

    try {
        if (reportType === 'daily') {
            startDate = document.getElementById('dailyDate').value;
            if (!startDate) {
                showMessage('يرجى تحديد التاريخ', 'error');
                return;
            }
            endDate = startDate;
        } else if (reportType === 'monthly') {
            const monthValue = document.getElementById('monthlyDate').value;
            if (!monthValue) {
                showMessage('يرجى تحديد الشهر', 'error');
                return;
            }
            startDate = monthValue + '-01';
            const year = parseInt(monthValue.split('-')[0]);
            const month = parseInt(monthValue.split('-')[1]);
            endDate = new Date(year, month, 0).toISOString().split('T')[0];
        } else if (reportType === 'custom') {
            startDate = document.getElementById('customStartDate').value;
            endDate = document.getElementById('customEndDate').value;
            
            if (!startDate || !endDate) {
                showMessage('يرجى تحديد تاريخ البداية والنهاية', 'error');
                return;
            }
        }

        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        const result = await API.getReport(reportType, startDate, endDate, currentBranchId);

        if (result && result.success) {
            currentReport = result.data;
            branchReports[currentBranchId] = currentReport;
            displayReport(currentReport);
            
            const reportResult = document.getElementById('reportResult');
            if (reportResult) {
                reportResult.style.display = 'block';
            }
            const printBtn = document.getElementById('printReportBtn');
            if (printBtn) {
                printBtn.style.display = 'inline-block';
            }
        } else {
            showMessage(result?.message || 'حدث خطأ في جلب التقرير', 'error');
        }
    } catch (error) {
        console.error('❌ [Reports] خطأ في إنشاء التقرير:', error);
        showMessage('حدث خطأ في إنشاء التقرير', 'error');
    } finally {
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// عرض التقرير
function displayReport(report) {
    const reportResult = document.getElementById('reportResult');
    if (!reportResult) return;

    const currentBranch = branches.find(b => b.id === currentBranchId);
    const branchName = currentBranch ? currentBranch.name : 'غير محدد';

    reportResult.innerHTML = `
        <div class="report-header-info" style="background: var(--white); padding: 20px; border-radius: 10px; box-shadow: var(--shadow); margin-bottom: 25px; text-align: center;">
            <h3 style="color: var(--primary-color); margin-bottom: 10px;">
                <i class="bi bi-building"></i> ${branchName}
            </h3>
            <p style="color: var(--text-light);">
                ${report.type === 'daily' ? `تقرير يومي - ${formatDate(report.start_date)}` : 
                  report.type === 'monthly' ? `تقرير شهري - ${formatDate(report.start_date)}` : 
                  `تقرير من ${formatDate(report.start_date)} إلى ${formatDate(report.end_date)}`}
            </p>
        </div>

        <div class="report-summary">
            <div class="summary-card">
                <h3>إيرادات العمليات</h3>
                <p class="summary-value revenue" id="reportRevenue">${formatCurrency(report.revenue || 0)}</p>
                <small style="color: var(--text-light);">صافي ربح عمليات الصيانة</small>
            </div>
            <div class="summary-card">
                <h3>المصروفات الكلية</h3>
                <p class="summary-value expense" id="reportExpenses">${formatCurrency(report.expenses || 0)}</p>
                <small style="color: var(--text-light);">المصروفات + تكلفة المخزن</small>
            </div>
            <div class="summary-card">
                <h3>صافي الربح النهائي</h3>
                <p class="summary-value profit" id="reportProfit" style="color: ${(report.profit || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${formatCurrency(report.profit || 0)}
                </p>
                <small style="color: var(--text-light);">الإيرادات - المصروفات</small>
            </div>
        </div>

        <div class="report-breakdown">
            <div class="breakdown-item">
                <span>إجمالي تكاليف الصيانات:</span>
                <strong style="color: var(--danger-color);">${formatCurrency(report.total_repair_costs || 0)}</strong>
            </div>
            <div class="breakdown-item">
                <span>المصروفات المسجلة:</span>
                <strong>${formatCurrency(report.registered_expenses || 0)}</strong>
            </div>
            <div class="breakdown-item">
                <span>تكلفة المخزن:</span>
                <strong>${formatCurrency(report.inventory_cost || 0)}</strong>
            </div>
            <div class="breakdown-item total-breakdown">
                <span>المصروفات الكلية:</span>
                <strong>${formatCurrency(report.expenses || 0)}</strong>
            </div>
        </div>

        <div class="report-details">
            <h3>تفاصيل العمليات (عدد: <span id="repairsCount">${report.repairs_count || 0}</span>)</h3>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>رقم العملية</th>
                            <th>العميل</th>
                            <th>الجهاز</th>
                            <th>السعر للعميل</th>
                            <th>تكلفة الإصلاح</th>
                            <th>صافي الربح</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody id="reportRepairsBody">
                        ${report.repairs && report.repairs.length > 0 ? report.repairs.map(repair => {
                            const customerPrice = repair.customer_price || repair.cost || 0;
                            const repairCost = repair.repair_cost || 0;
                            const profit = customerPrice - repairCost;
                            return `
                                <tr>
                                    <td>${repair.repair_number || '-'}</td>
                                    <td>${repair.customer_name || '-'}</td>
                                    <td>${repair.device_type || '-'}</td>
                                    <td>${formatCurrency(customerPrice)}</td>
                                    <td>${formatCurrency(repairCost)}</td>
                                    <td style="color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: bold;">
                                        ${formatCurrency(profit)}
                                    </td>
                                    <td>${formatDate(repair.created_at || repair.delivery_date)}</td>
                                </tr>
                            `;
                        }).join('') : '<tr><td colspan="7" style="text-align: center; padding: 40px;">لا توجد عمليات</td></tr>'}
                    </tbody>
                </table>
            </div>

            <h3 style="margin-top: 40px;">تفاصيل المصروفات (عدد: <span id="expensesCount">${report.expenses_count || 0}</span>)</h3>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>المبلغ</th>
                            <th>التاريخ</th>
                            <th>الوصف</th>
                        </tr>
                    </thead>
                    <tbody id="reportExpensesBody">
                        ${report.expenses_list && report.expenses_list.length > 0 ? report.expenses_list.map(expense => `
                            <tr>
                                <td>${expense.type || '-'}</td>
                                <td>${formatCurrency(expense.amount || 0)}</td>
                                <td>${formatDate(expense.date || expense.expense_date)}</td>
                                <td>${expense.description || '-'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 40px;">لا توجد مصروفات</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// طباعة التقرير
function printReport() {
    if (!currentReport || !currentBranchId) {
        showMessage('لا يوجد تقرير للطباعة', 'error');
        return;
    }

    const currentBranch = branches.find(b => b.id === currentBranchId);
    const branchName = currentBranch ? currentBranch.name : 'غير محدد';

    const reportType = document.getElementById('reportType').value;
    let reportTitle = '';
    
    if (reportType === 'daily') {
        reportTitle = `تقرير يومي - ${formatDate(currentReport.start_date)}`;
    } else if (reportType === 'monthly') {
        reportTitle = `تقرير شهري - ${formatDate(currentReport.start_date)}`;
    } else {
        reportTitle = `تقرير من ${formatDate(currentReport.start_date)} إلى ${formatDate(currentReport.end_date)}`;
    }

    const printWindow = window.open('', '', 'width=1000,height=800');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${reportTitle} - ${branchName}</title>
            <link rel="stylesheet" href="css/vendor/bootstrap-icons/bootstrap-icons.css">
            <link rel="stylesheet" href="css/print.css">
        </head>
        <body>
            <div class="report-print">
                <div class="report-header">
                    <h1>محل صيانة الهواتف</h1>
                    <h2>${reportTitle}</h2>
                    <h3 style="color: var(--primary-color); margin-top: 10px;">
                        <i class="bi bi-building"></i> ${branchName}
                    </h3>
                </div>
                
                <div class="report-summary-print">
                    <div class="summary-item">
                        <span>إيرادات العمليات:</span>
                        <strong>${formatCurrency(currentReport.revenue || 0)}</strong>
                        <small style="display: block; color: #999;">صافي ربح عمليات الصيانة</small>
                    </div>
                    <div class="summary-item">
                        <span>المصروفات الكلية:</span>
                        <strong>${formatCurrency(currentReport.expenses || 0)}</strong>
                        <small style="display: block; color: #999;">المصروفات (${formatCurrency(currentReport.registered_expenses || 0)}) + المخزن (${formatCurrency(currentReport.inventory_cost || 0)})</small>
                    </div>
                    <div class="summary-item">
                        <span>صافي الربح النهائي:</span>
                        <strong style="color: ${(currentReport.profit || 0) >= 0 ? '#4CAF50' : '#f44336'}">${formatCurrency(currentReport.profit || 0)}</strong>
                        <small style="display: block; color: #999;">الإيرادات - المصروفات</small>
                    </div>
                </div>

                <h3>تفاصيل العمليات (${currentReport.repairs_count || 0})</h3>
                <table>
                    <thead>
                        <tr>
                            <th>رقم العملية</th>
                            <th>العميل</th>
                            <th>الجهاز</th>
                            <th>السعر للعميل</th>
                            <th>تكلفة الإصلاح</th>
                            <th>صافي الربح</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentReport.repairs && currentReport.repairs.length > 0 ? currentReport.repairs.map(repair => {
                            const customerPrice = repair.customer_price || repair.cost || 0;
                            const repairCost = repair.repair_cost || 0;
                            const profit = customerPrice - repairCost;
                            return `
                                <tr>
                                    <td>${repair.repair_number || '-'}</td>
                                    <td>${repair.customer_name || '-'}</td>
                                    <td>${repair.device_type || '-'}</td>
                                    <td>${formatCurrency(customerPrice)}</td>
                                    <td>${formatCurrency(repairCost)}</td>
                                    <td style="color: ${profit >= 0 ? '#4CAF50' : '#f44336'}; font-weight: bold;">${formatCurrency(profit)}</td>
                                    <td>${formatDate(repair.created_at || repair.delivery_date)}</td>
                                </tr>
                            `;
                        }).join('') : '<tr><td colspan="7" style="text-align: center;">لا توجد عمليات</td></tr>'}
                    </tbody>
                </table>

                <h3>تفاصيل المصروفات (${currentReport.expenses_count || 0})</h3>
                <table>
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>المبلغ</th>
                            <th>التاريخ</th>
                            <th>الوصف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentReport.expenses_list && currentReport.expenses_list.length > 0 ? currentReport.expenses_list.map(expense => `
                            <tr>
                                <td>${expense.type || '-'}</td>
                                <td>${formatCurrency(expense.amount || 0)}</td>
                                <td>${formatDate(expense.date || expense.expense_date)}</td>
                                <td>${expense.description || '-'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align: center;">لا توجد مصروفات</td></tr>'}
                    </tbody>
                </table>

                <div class="report-footer">
                    <p>تاريخ الطباعة: ${formatDateTime(new Date().toISOString())}</p>
                </div>
            </div>
            <div class="no-print" style="text-align: center; margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="window.print()" style="padding: 10px 20px; background: var(--primary-color, #2196F3); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="window.history.back() || window.close()" style="padding: 10px 20px; background: var(--secondary-color, #64B5F6); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-arrow-right"></i> رجوع
                </button>
            </div>
            <style>
                .no-print { display: block !important; }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

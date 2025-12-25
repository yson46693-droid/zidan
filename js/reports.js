// التقارير المالية

let currentReport = null;

function loadReportsSection() {
    const section = document.getElementById('reports-section');
    section.innerHTML = `
        <div class="section-header">
            <button onclick="printReport()" class="btn btn-primary" id="printReportBtn" style="display: none;"><i class="bi bi-printer-fill"></i> طباعة التقرير</button>
        </div>

        <div class="report-filters">
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

            <button onclick="generateReport()" class="btn btn-primary">عرض التقرير</button>
        </div>

        <div id="reportResult" class="report-result" style="display: none;">
            <div class="report-summary">
                <div class="summary-card">
                    <h3>إيرادات العمليات</h3>
                    <p class="summary-value revenue" id="reportRevenue">0 ج.م</p>
                    <small style="color: #666;">صافي ربح عمليات الصيانة</small>
                </div>
                <div class="summary-card">
                    <h3>المصروفات الكلية</h3>
                    <p class="summary-value expense" id="reportExpenses">0 ج.م</p>
                    <small style="color: #666;">المصروفات + تكلفة المخزون</small>
                </div>
                <div class="summary-card">
                    <h3>صافي الربح النهائي</h3>
                    <p class="summary-value profit" id="reportProfit">0 ج.م</p>
                    <small style="color: #666;">الإيرادات - المصروفات</small>
                </div>
            </div>

            <div class="report-breakdown">
                <div class="breakdown-item">
                    <span>إجمالي تكاليف الصيانات:</span>
                    <strong id="totalRepairCosts" style="color: #f44336;">0 ج.م</strong>
                </div>
                <div class="breakdown-item">
                    <span>المصروفات المسجلة:</span>
                    <strong id="registeredExpenses">0 ج.م</strong>
                </div>
                <div class="breakdown-item">
                    <span>تكلفة المخزون:</span>
                    <strong id="inventoryCost">0 ج.م</strong>
                </div>
                <div class="breakdown-item total-breakdown">
                    <span>المصروفات الكلية:</span>
                    <strong id="totalExpensesBreakdown">0 ج.م</strong>
                </div>
            </div>

            <div class="report-details">
                <h3>تفاصيل العمليات (عدد: <span id="repairsCount">0</span>)</h3>
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
                        <tbody id="reportRepairsBody"></tbody>
                    </table>
                </div>

                <h3>تفاصيل المصروفات (عدد: <span id="expensesCount">0</span>)</h3>
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
                        <tbody id="reportExpensesBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

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

async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    let startDate, endDate;

    if (reportType === 'daily') {
        startDate = document.getElementById('dailyDate').value;
        endDate = startDate;
    } else if (reportType === 'monthly') {
        const monthValue = document.getElementById('monthlyDate').value;
        startDate = monthValue + '-01';
    } else if (reportType === 'custom') {
        startDate = document.getElementById('customStartDate').value;
        endDate = document.getElementById('customEndDate').value;
        
        if (!startDate || !endDate) {
            showMessage('يرجى تحديد تاريخ البداية والنهاية', 'error');
            return;
        }
    }

    const result = await API.getReport(reportType, startDate, endDate);

    if (result.success) {
        currentReport = result.data;
        displayReport(currentReport);
        document.getElementById('reportResult').style.display = 'block';
        document.getElementById('printReportBtn').style.display = 'inline-block';
    } else {
        showMessage(result.message, 'error');
    }
}

function displayReport(report) {
    document.getElementById('reportRevenue').textContent = formatCurrency(report.revenue);
    document.getElementById('reportExpenses').textContent = formatCurrency(report.expenses);
    document.getElementById('reportProfit').textContent = formatCurrency(report.profit);
    document.getElementById('reportProfit').style.color = report.profit >= 0 ? '#4CAF50' : '#f44336';

    // عرض التفصيل
    if (document.getElementById('totalRepairCosts')) {
        document.getElementById('totalRepairCosts').textContent = formatCurrency(report.total_repair_costs || 0);
    }
    if (document.getElementById('registeredExpenses')) {
        document.getElementById('registeredExpenses').textContent = formatCurrency(report.registered_expenses || 0);
    }
    if (document.getElementById('inventoryCost')) {
        document.getElementById('inventoryCost').textContent = formatCurrency(report.inventory_cost || 0);
    }
    if (document.getElementById('totalExpensesBreakdown')) {
        document.getElementById('totalExpensesBreakdown').textContent = formatCurrency(report.expenses);
    }

    document.getElementById('repairsCount').textContent = report.repairs_count;
    document.getElementById('expensesCount').textContent = report.expenses_count;

    // عرض العمليات
    const repairsBody = document.getElementById('reportRepairsBody');
    if (report.repairs.length === 0) {
        repairsBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد عمليات</td></tr>';
    } else {
        repairsBody.innerHTML = report.repairs.map(repair => {
            const customerPrice = repair.customer_price || repair.cost || 0;
            const repairCost = repair.repair_cost || 0;
            const profit = customerPrice - repairCost;
            
            return `
            <tr>
                <td>${repair.repair_number}</td>
                <td>${repair.customer_name}</td>
                <td>${repair.device_type}</td>
                <td>${formatCurrency(customerPrice)}</td>
                <td>${formatCurrency(repairCost)}</td>
                <td style="color: ${profit >= 0 ? '#4CAF50' : '#f44336'}; font-weight: bold;">${formatCurrency(profit)}</td>
                <td>${formatDate(repair.created_at)}</td>
            </tr>
        `}).join('');
    }

    // عرض المصروفات
    const expensesBody = document.getElementById('reportExpensesBody');
    if (report.expenses_list.length === 0) {
        expensesBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">لا توجد مصروفات</td></tr>';
    } else {
        expensesBody.innerHTML = report.expenses_list.map(expense => `
            <tr>
                <td>${expense.type}</td>
                <td>${formatCurrency(expense.amount)}</td>
                <td>${formatDate(expense.date)}</td>
                <td>${expense.description || '-'}</td>
            </tr>
        `).join('');
    }
}

function printReport() {
    if (!currentReport) return;

    const reportType = document.getElementById('reportType').value;
    let reportTitle = '';
    
    if (reportType === 'daily') {
        reportTitle = `تقرير يومي - ${formatDate(currentReport.start_date)}`;
    } else if (reportType === 'monthly') {
        reportTitle = `تقرير شهري - ${currentReport.start_date}`;
    } else {
        reportTitle = `تقرير من ${formatDate(currentReport.start_date)} إلى ${formatDate(currentReport.end_date)}`;
    }

    const printWindow = window.open('', '', 'width=1000,height=800');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${reportTitle}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <link rel="stylesheet" href="css/print.css">
        </head>
        <body>
            <div class="report-print">
                <div class="report-header">
                    <h1>محل صيانة الهواتف</h1>
                    <h2>${reportTitle}</h2>
                </div>
                
                <div class="report-summary-print">
                    <div class="summary-item">
                        <span>إيرادات العمليات:</span>
                        <strong>${formatCurrency(currentReport.revenue)}</strong>
                        <small style="display: block; color: #999;">صافي ربح عمليات الصيانة</small>
                    </div>
                    <div class="summary-item">
                        <span>المصروفات الكلية:</span>
                        <strong>${formatCurrency(currentReport.expenses)}</strong>
                        <small style="display: block; color: #999;">المصروفات (${formatCurrency(currentReport.registered_expenses || 0)}) + المخزون (${formatCurrency(currentReport.inventory_cost || 0)})</small>
                    </div>
                    <div class="summary-item">
                        <span>صافي الربح النهائي:</span>
                        <strong style="color: ${currentReport.profit >= 0 ? '#4CAF50' : '#f44336'}">${formatCurrency(currentReport.profit)}</strong>
                        <small style="display: block; color: #999;">الإيرادات - المصروفات</small>
                    </div>
                </div>

                <h3>تفاصيل العمليات (${currentReport.repairs_count})</h3>
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
                        ${currentReport.repairs.length === 0 ? '<tr><td colspan="7" style="text-align: center;">لا توجد عمليات</td></tr>' :
                        currentReport.repairs.map(repair => {
                            const customerPrice = repair.customer_price || repair.cost || 0;
                            const repairCost = repair.repair_cost || 0;
                            const profit = customerPrice - repairCost;
                            return `
                            <tr>
                                <td>${repair.repair_number}</td>
                                <td>${repair.customer_name}</td>
                                <td>${repair.device_type}</td>
                                <td>${formatCurrency(customerPrice)}</td>
                                <td>${formatCurrency(repairCost)}</td>
                                <td style="color: ${profit >= 0 ? '#4CAF50' : '#f44336'}; font-weight: bold;">${formatCurrency(profit)}</td>
                                <td>${formatDate(repair.created_at)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>

                <h3>تفاصيل المصروفات (${currentReport.expenses_count})</h3>
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
                        ${currentReport.expenses_list.length === 0 ? '<tr><td colspan="4" style="text-align: center;">لا توجد مصروفات</td></tr>' :
                        currentReport.expenses_list.map(expense => `
                            <tr>
                                <td>${expense.type}</td>
                                <td>${formatCurrency(expense.amount)}</td>
                                <td>${formatDate(expense.date)}</td>
                                <td>${expense.description || '-'}</td>
                            </tr>
                        `).join('')}
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


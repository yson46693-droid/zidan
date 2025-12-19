// إدارة العملاء

let allCustomers = [];
let retailCustomers = [];
let commercialCustomers = [];
let currentCustomerPage = 1;
let currentCustomerType = 'retail';
const customersPerPage = 10;

function loadCustomersSection() {
    const section = document.getElementById('customers-section');
    section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-people"></i> العملاء</h2>
            <div class="header-actions">
                <button onclick="exportCustomersToCSV()" class="btn btn-success btn-sm">
                    <i class="bi bi-file-earmark-spreadsheet"></i> تصدير CSV
                </button>
                <button onclick="showAddCustomerModal()" class="btn btn-primary">
                    <i class="bi bi-person-plus"></i> إضافة عميل جديد
                </button>
            </div>
        </div>

        <!-- Customer Type Tabs -->
        <div class="customer-type-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 10px;">
            <button onclick="switchCustomerType('retail')" id="tab-retail" class="customer-type-tab active" style="flex: 1; padding: 12px 20px; background: var(--primary-color); color: var(--white); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-person"></i> عملاء المحل
            </button>
            <button onclick="switchCustomerType('commercial')" id="tab-commercial" class="customer-type-tab" style="flex: 1; padding: 12px 20px; background: var(--light-bg); color: var(--text-dark); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-shop"></i> عملاء تجاري
            </button>
        </div>

        <div class="filters-bar">
            <input type="text" id="customerSearch" placeholder="بحث بالاسم أو الهاتف..." class="search-input">
        </div>

        <div class="table-container">
            <table class="data-table" id="customersTable">
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th id="shopNameHeader" style="display: none;">اسم المحل</th>
                        <th>رقم الهاتف</th>
                        <th>العنوان</th>
                        <th>تاريخ التسجيل</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="customersTableBody"></tbody>
            </table>
        </div>

        <div class="pagination" id="customersPagination"></div>

        <!-- نموذج إضافة/تعديل عميل -->
        <div id="customerModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="customerModalTitle">إضافة عميل جديد</h3>
                    <button onclick="closeCustomerModal()" class="btn-close">&times;</button>
                </div>
                <form id="customerForm" onsubmit="saveCustomer(event)">
                    <input type="hidden" id="customerId">
                    
                    <div class="form-group">
                        <label>نوع العميل *</label>
                        <select id="custType" required onchange="toggleShopNameField()">
                            <option value="retail">عميل محل</option>
                            <option value="commercial">عميل تجاري</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="custName">الاسم *</label>
                        <input type="text" id="custName" required>
                    </div>

                    <div class="form-group" id="custShopNameGroup" style="display: none;">
                        <label for="custShopName">اسم المحل *</label>
                        <input type="text" id="custShopName">
                    </div>

                    <div class="form-group">
                        <label for="custPhone">رقم الهاتف *</label>
                        <input type="tel" id="custPhone" required>
                    </div>

                    <div class="form-group">
                        <label for="custAddress">العنوان</label>
                        <textarea id="custAddress" rows="2"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeCustomerModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    loadCustomers();
    
    // Setup search
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const customers = currentCustomerType === 'retail' ? retailCustomers : commercialCustomers;
            const filtered = customers.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.phone.includes(query) ||
                (c.shop_name && c.shop_name.toLowerCase().includes(query))
            );
            displayCustomers(filtered);
        });
    }
}

async function loadCustomers() {
    const retailResult = await API.getCustomers('retail');
    const commercialResult = await API.getCustomers('commercial');
    
    retailCustomers = retailResult.success ? retailResult.data : [];
    commercialCustomers = commercialResult.success ? commercialResult.data : [];
    allCustomers = [...retailCustomers, ...commercialCustomers];
    
    switchCustomerType(currentCustomerType);
}

function switchCustomerType(type) {
    currentCustomerType = type;
    currentCustomerPage = 1;
    
    // Update tabs
    document.querySelectorAll('.customer-type-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.background = 'var(--light-bg)';
        tab.style.color = 'var(--text-dark)';
    });
    
    const activeTab = document.getElementById(`tab-${type}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.background = 'var(--primary-color)';
        activeTab.style.color = 'var(--white)';
    }
    
    // Show/hide shop name column
    const shopNameHeader = document.getElementById('shopNameHeader');
    if (shopNameHeader) {
        shopNameHeader.style.display = type === 'commercial' ? 'table-cell' : 'none';
    }
    
    // Display customers
    const customers = type === 'retail' ? retailCustomers : commercialCustomers;
    displayCustomers(customers);
}

function displayCustomers(customers) {
    const paginated = paginate(customers, currentCustomerPage, customersPerPage);
    const tbody = document.getElementById('customersTableBody');

    if (paginated.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد عملاء</td></tr>';
        return;
    }

    tbody.innerHTML = paginated.data.map(customer => {
        const shopNameCell = currentCustomerType === 'commercial' 
            ? `<td>${customer.shop_name || '-'}</td>` 
            : '';
        
        return `
        <tr>
            <td><strong>${customer.name}</strong></td>
            ${shopNameCell}
            <td>${customer.phone}</td>
            <td>${customer.address || '-'}</td>
            <td>${formatDate(customer.created_at)}</td>
            <td>
                <button onclick="viewCustomerProfile('${customer.id}')" class="btn btn-sm btn-icon" title="عرض البروفايل" style="background: var(--primary-color); color: var(--white);">
                    <i class="bi bi-eye"></i>
                </button>
                <button onclick="editCustomer('${customer.id}')" class="btn btn-sm btn-icon" title="تعديل"><i class="bi bi-pencil-square"></i></button>
                <button onclick="deleteCustomer('${customer.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `;
    }).join('');

    createPaginationButtons(
        document.getElementById('customersPagination'),
        paginated.totalPages,
        currentCustomerPage,
        (page) => {
            currentCustomerPage = page;
            displayCustomers(allCustomers);
        }
    );

    hideByPermission();
}

function toggleShopNameField() {
    const custType = document.getElementById('custType').value;
    const shopNameGroup = document.getElementById('custShopNameGroup');
    const shopNameInput = document.getElementById('custShopName');
    
    if (custType === 'commercial') {
        shopNameGroup.style.display = 'block';
        shopNameInput.required = true;
    } else {
        shopNameGroup.style.display = 'none';
        shopNameInput.required = false;
        shopNameInput.value = '';
    }
}

function showAddCustomerModal() {
    document.getElementById('customerModalTitle').textContent = 'إضافة عميل جديد';
    document.getElementById('customerForm').reset();
    document.getElementById('customerId').value = '';
    document.getElementById('custType').value = 'retail';
    toggleShopNameField();
    document.getElementById('customerModal').style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}

async function saveCustomer(event) {
    event.preventDefault();

    // التحقق من الحقول المطلوبة
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();

    if (!name || !phone) {
        showMessage('الاسم ورقم الهاتف مطلوبان', 'error');
        return;
    }

    const customerType = document.getElementById('custType').value;
    const shopName = document.getElementById('custShopName').value.trim();
    
    if (customerType === 'commercial' && !shopName) {
        showMessage('اسم المحل مطلوب للعملاء التجاريين', 'error');
        return;
    }
    
    const customerData = {
        name: name,
        phone: phone,
        address: document.getElementById('custAddress').value.trim(),
        customer_type: customerType,
        shop_name: customerType === 'commercial' ? shopName : null
    };

    const customerId = document.getElementById('customerId').value;
    let result;

    if (customerId) {
        customerData.id = customerId;
        result = await API.updateCustomer(customerData);
    } else {
        result = await API.addCustomer(customerData);
    }

    if (result.success) {
        showMessage(result.message);
        closeCustomerModal();
        await loadCustomers();
    } else {
        showMessage(result.message, 'error');
    }
}

async function editCustomer(id) {
    const customer = allCustomers.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('customerModalTitle').textContent = 'تعديل بيانات العميل';
    document.getElementById('customerId').value = customer.id;
    document.getElementById('custType').value = customer.customer_type || 'retail';
    document.getElementById('custName').value = customer.name;
    document.getElementById('custPhone').value = customer.phone;
    document.getElementById('custAddress').value = customer.address || '';
    document.getElementById('custShopName').value = customer.shop_name || '';
    
    toggleShopNameField();
    document.getElementById('customerModal').style.display = 'flex';
}

async function viewCustomerProfile(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;
    
    // Load customer sales
    const salesResult = await API.getCustomerSales(customerId);
    const sales = salesResult.success ? salesResult.data : [];
    
    // Create profile modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3><i class="bi bi-person-circle"></i> بروفايل العميل</h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="customer-profile-header" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0 0 10px 0;">${customer.name}</h2>
                    ${customer.customer_type === 'commercial' && customer.shop_name ? `<p style="margin: 0; font-size: 1.1em; opacity: 0.9;"><i class="bi bi-shop"></i> ${customer.shop_name}</p>` : ''}
                    <div style="margin-top: 15px; display: flex; gap: 20px; flex-wrap: wrap;">
                        <div><i class="bi bi-telephone"></i> ${customer.phone}</div>
                        ${customer.address ? `<div><i class="bi bi-geo-alt"></i> ${customer.address}</div>` : ''}
                        <div><i class="bi bi-calendar"></i> ${formatDate(customer.created_at)}</div>
                    </div>
                </div>
                
                <div class="customer-sales-section">
                    <h3 style="margin-bottom: 15px;"><i class="bi bi-receipt"></i> سجل المشتريات (${sales.length})</h3>
                    ${sales.length === 0 ? '<p style="text-align: center; color: var(--text-light); padding: 20px;">لا توجد مشتريات</p>' : `
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>رقم الفاتورة</th>
                                        <th>التاريخ</th>
                                        <th>عدد العناصر</th>
                                        <th>المجموع</th>
                                        <th>الإجمالي</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sales.map(sale => `
                                        <tr>
                                            <td><strong>${sale.sale_number}</strong></td>
                                            <td>${formatDate(sale.created_at)}</td>
                                            <td>${sale.items ? sale.items.length : 0}</td>
                                            <td>${parseFloat(sale.total_amount || 0).toFixed(2)} ج.م</td>
                                            <td><strong style="color: var(--primary-color);">${parseFloat(sale.final_amount || 0).toFixed(2)} ج.م</strong></td>
                                            <td>
                                                <button onclick="viewSaleInvoice('${sale.id}')" class="btn btn-sm btn-primary">
                                                    <i class="bi bi-eye"></i> عرض الفاتورة
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">إغلاق</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function viewSaleInvoice(saleId) {
    // This would open the invoice in a modal or new window
    // For now, we'll just show a message
    showMessage('سيتم عرض الفاتورة قريباً', 'info');
}

async function deleteCustomer(id) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية', 'error');
        return;
    }

    if (!confirmAction('هل أنت متأكد من حذف هذا العميل؟')) return;

    const result = await API.deleteCustomer(id);
    if (result.success) {
        showMessage(result.message);
        loadCustomers();
    } else {
        showMessage(result.message, 'error');
    }
}

// دالة تصدير بيانات العملاء إلى CSV
function exportCustomersToCSV() {
    if (!allCustomers || allCustomers.length === 0) {
        showMessage('لا توجد بيانات عملاء للتصدير', 'warning');
        return;
    }

    try {
        // إعداد البيانات للتصدير
        const csvData = prepareCustomersCSVData();
        
        // إنشاء ملف CSV وتحميله
        downloadCSVFile(csvData, 'customers_data.csv');
        
        showMessage(`تم تصدير ${allCustomers.length} عميل بنجاح`, 'success');
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        showMessage('خطأ في تصدير البيانات', 'error');
    }
}

// إعداد بيانات العملاء للتصدير
function prepareCustomersCSVData() {
    // رؤوس الأعمدة
    const headers = ['اسم العميل', 'رقم الهاتف', 'العنوان', 'تاريخ الإضافة', 'عدد العمليات'];
    
    // البيانات
    const rows = allCustomers.map(customer => {
        // حساب عدد العمليات لكل عميل
        const operationsCount = getCustomerOperationsCount(customer.id);
        
        return [
            customer.name || '',
            customer.phone || '',
            customer.address || '',
            formatDate(customer.created_at) || '',
            operationsCount.toString()
        ];
    });
    
    // دمج الرؤوس والبيانات
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
}

// حساب عدد عمليات العميل
function getCustomerOperationsCount(customerId) {
    // البحث في عمليات الصيانة
    if (typeof allRepairs !== 'undefined' && allRepairs.length > 0) {
        return allRepairs.filter(repair => 
            repair.customer_name === allCustomers.find(c => c.id === customerId)?.name
        ).length;
    }
    return 0;
}

// تحميل ملف CSV
function downloadCSVFile(csvContent, filename) {
    // إنشاء Blob مع ترميز UTF-8 مع BOM للعربية
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // إنشاء رابط التحميل
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // إضافة الرابط للصفحة وتفعيل التحميل
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // تنظيف الذاكرة
    URL.revokeObjectURL(url);
}

// دالة مساعدة لتنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}


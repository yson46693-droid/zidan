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
    
    // Load customer sales - فقط فواتير هذا العميل
    const salesResult = await API.getCustomerSales(customerId);
    let sales = salesResult.success && Array.isArray(salesResult.data) ? salesResult.data : [];
    
    // فلترة إضافية للتأكد من أن الفواتير تخص هذا العميل فقط
    sales = sales.filter(sale => {
        // التأكد من وجود customer_id وأنه يطابق العميل المطلوب
        if (!sale.customer_id || sale.customer_id !== customerId) {
            return false;
        }
        // التأكد من وجود بيانات صحيحة (items و total_amount)
        if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) {
            // إذا كانت الفاتورة بدون عناصر، نتخطاها لأنها قد تكون بيانات خاطئة
            return false;
        }
        return true;
    });
    
    // حساب إجمالي المشتريات
    const totalPurchases = sales.reduce((sum, sale) => {
        return sum + parseFloat(sale.final_amount || sale.total_amount || 0);
    }, 0);
    
    // Create profile modal مع تصميم محسّن بشكل خرافي
    const modal = document.createElement('div');
    modal.className = 'modal customer-profile-modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.3s ease;';
    modal.innerHTML = `
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .customer-profile-content {
                animation: slideUp 0.4s ease;
            }
            .customer-profile-header {
                position: relative;
                overflow: hidden;
            }
            .customer-profile-header::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: rotate 20s linear infinite;
            }
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .stat-card {
                position: relative;
                overflow: hidden;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.2) !important;
            }
            .stat-card::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
                animation: shimmer 2s infinite;
            }
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            .invoice-row {
                transition: all 0.3s ease;
            }
            .invoice-row:hover {
                transform: translateX(-5px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
        </style>
        <div class="modal-content customer-profile-content" style="max-width: 1200px; width: 100%; max-height: 95vh; overflow-y: auto; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); background: white; position: relative;">
            <div class="modal-header customer-profile-header" style="border-bottom: none; padding: 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); border-radius: 20px 20px 0 0; display: flex; justify-content: space-between; align-items: center; position: relative;">
                <div style="display: flex; align-items: center; gap: 15px; position: relative; z-index: 1;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <i class="bi bi-person-circle" style="font-size: 2em; color: white;"></i>
                    </div>
                    <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 10px; font-size: 1.8em; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                        بروفايل العميل
                    </h3>
                </div>
                <div style="display: flex; gap: 12px; align-items: center; position: relative; z-index: 1;">
                    <button onclick="editCustomer('${customer.id}'); this.closest('.modal').remove();" class="btn btn-sm" style="background: rgba(255,255,255,0.25); color: white; border: 2px solid rgba(255,255,255,0.4); padding: 10px 20px; border-radius: 10px; transition: all 0.3s; display: flex; align-items: center; gap: 8px; font-weight: 600; backdrop-filter: blur(10px);" onmouseover="this.style.background='rgba(255,255,255,0.35)'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.25)'; this.style.transform='scale(1)'">
                        <i class="bi bi-pencil-square"></i> تعديل
                    </button>
                    <button onclick="window.print()" class="btn btn-sm" style="background: rgba(255,255,255,0.25); color: white; border: 2px solid rgba(255,255,255,0.4); padding: 10px 20px; border-radius: 10px; transition: all 0.3s; display: flex; align-items: center; gap: 8px; font-weight: 600; backdrop-filter: blur(10px);" onmouseover="this.style.background='rgba(255,255,255,0.35)'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.25)'; this.style.transform='scale(1)'">
                        <i class="bi bi-printer"></i> طباعة
                    </button>
                    <button onclick="this.closest('.modal').remove()" class="btn-close" style="color: white; font-size: 32px; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.2); transition: all 0.3s; border: 2px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); font-weight: bold; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg) scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg) scale(1)'">&times;</button>
                </div>
            </div>
            <div class="modal-body" style="padding: 30px;">
            <div class="modal-body" style="padding: 40px;">
                <!-- Customer Info Card - تصميم محسّن بشكل خرافي -->
                <div class="customer-profile-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 20px; margin-bottom: 35px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); position: relative; overflow: hidden;">
                    <div style="display: flex; align-items: center; gap: 25px; margin-bottom: 25px; position: relative; z-index: 1;">
                        <div style="width: 100px; height: 100px; background: rgba(255,255,255,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 3em; border: 4px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px); box-shadow: 0 8px 20px rgba(0,0,0,0.2);">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div style="flex: 1;">
                            <h2 style="margin: 0 0 10px 0; font-size: 2.2em; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">${customer.name}</h2>
                            ${customer.customer_type === 'commercial' && customer.shop_name ? `
                                <p style="margin: 0; font-size: 1.2em; opacity: 0.95; display: flex; align-items: center; gap: 10px; font-weight: 500;">
                                    <i class="bi bi-shop" style="font-size: 1.3em;"></i> ${customer.shop_name}
                                </p>
                            ` : ''}
                            <p style="margin: 8px 0 0 0; font-size: 0.95em; opacity: 0.9;">
                                ${customer.customer_type === 'commercial' ? '<i class="bi bi-briefcase"></i> عميل تجاري' : '<i class="bi bi-person"></i> عميل محل'}
                            </p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 30px; padding-top: 30px; border-top: 2px solid rgba(255,255,255,0.3); position: relative; z-index: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 1.1em; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                            <i class="bi bi-telephone-fill" style="font-size: 1.4em;"></i>
                            <div>
                                <div style="font-size: 0.85em; opacity: 0.9; margin-bottom: 4px;">رقم الهاتف</div>
                                <div style="font-weight: 600; font-size: 1.1em;">${customer.phone}</div>
                            </div>
                        </div>
                        ${customer.address ? `
                            <div style="display: flex; align-items: center; gap: 12px; font-size: 1.1em; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                <i class="bi bi-geo-alt-fill" style="font-size: 1.4em;"></i>
                                <div>
                                    <div style="font-size: 0.85em; opacity: 0.9; margin-bottom: 4px;">العنوان</div>
                                    <div style="font-weight: 600; font-size: 1.1em;">${customer.address}</div>
                                </div>
                            </div>
                        ` : ''}
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 1.1em; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                            <i class="bi bi-calendar-check-fill" style="font-size: 1.4em;"></i>
                            <div>
                                <div style="font-size: 0.85em; opacity: 0.9; margin-bottom: 4px;">تاريخ التسجيل</div>
                                <div style="font-weight: 600; font-size: 1.1em;">${formatDate(customer.created_at)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Statistics Cards - تحسينات خرافية -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; margin-bottom: 40px;">
                    <div class="stat-card" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; border-radius: 18px; text-align: center; box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                        <div style="position: absolute; bottom: -30px; left: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
                        <div style="font-size: 3.5em; font-weight: 800; margin-bottom: 12px; position: relative; z-index: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">${sales.length}</div>
                        <div style="opacity: 0.95; font-size: 1.15em; font-weight: 600; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="bi bi-receipt-cutoff" style="font-size: 1.3em;"></i> عدد الفواتير
                        </div>
                    </div>
                    <div class="stat-card" style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); color: white; padding: 30px; border-radius: 18px; text-align: center; box-shadow: 0 8px 25px rgba(255, 152, 0, 0.4); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                        <div style="position: absolute; bottom: -30px; left: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
                        <div style="font-size: 3.5em; font-weight: 800; margin-bottom: 12px; position: relative; z-index: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">${totalPurchases.toFixed(2)}</div>
                        <div style="opacity: 0.95; font-size: 1.15em; font-weight: 600; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="bi bi-currency-exchange" style="font-size: 1.3em;"></i> إجمالي المشتريات
                            <span style="font-size: 0.85em; opacity: 0.9;">(ج.م)</span>
                        </div>
                    </div>
                </div>
                
                <!-- Sales History Section -->
                <div class="customer-sales-section">
                    <h3 style="margin-bottom: 25px; display: flex; align-items: center; gap: 12px; font-size: 1.6em; color: var(--text-dark); padding-bottom: 20px; border-bottom: 3px solid var(--primary-color); font-weight: 700;">
                        <div style="width: 45px; height: 45px; background: linear-gradient(135deg, var(--primary-color), #1976D2); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);">
                            <i class="bi bi-receipt-cutoff" style="font-size: 1.3em;"></i>
                        </div>
                        <span>سجل المشتريات</span>
                        ${sales.length > 0 ? `<span style="background: linear-gradient(135deg, var(--primary-color), #1976D2); color: white; padding: 8px 16px; border-radius: 25px; font-size: 0.9em; font-weight: 600; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);">${sales.length} فاتورة</span>` : ''}
                    </h3>
                    ${sales.length === 0 ? `
                        <div style="text-align: center; padding: 60px 20px; background: var(--light-bg); border-radius: 12px; border: 2px dashed var(--border-color);">
                            <i class="bi bi-inbox" style="font-size: 4em; color: var(--text-light); margin-bottom: 15px; display: block;"></i>
                            <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد فواتير مسجلة لهذا العميل</p>
                        </div>
                    ` : `
                        <div class="table-container" style="border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.1); border: 1px solid #e0e0e0;">
                            <table class="data-table" style="margin: 0; border-collapse: collapse;">
                                <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                    <tr>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">رقم الفاتورة</th>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">التاريخ</th>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">عدد العناصر</th>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-align: right; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">المجموع</th>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-align: right; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">الإجمالي</th>
                                        <th style="padding: 20px 18px; font-weight: 700; font-size: 1.05em; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sales.map(sale => {
                                        // التأكد من وجود البيانات الصحيحة
                                        const saleNumber = sale.sale_number || sale.id || 'غير محدد';
                                        const items = sale.items && Array.isArray(sale.items) ? sale.items : [];
                                        const itemsCount = items.length;
                                        
                                        // حساب المبلغ من العناصر إذا لم يكن موجوداً
                                        let totalAmount = parseFloat(sale.total_amount || 0);
                                        let finalAmount = parseFloat(sale.final_amount || 0);
                                        
                                        // إذا كانت القيم 0، نحسبها من العناصر
                                        if (items.length > 0 && (totalAmount === 0 || finalAmount === 0)) {
                                            const calculatedTotal = items.reduce((sum, item) => {
                                                return sum + (parseFloat(item.total_price || 0) * parseInt(item.quantity || 1));
                                            }, 0);
                                            if (totalAmount === 0) totalAmount = calculatedTotal;
                                            if (finalAmount === 0) {
                                                const discount = parseFloat(sale.discount || 0);
                                                const tax = parseFloat(sale.tax || 0);
                                                finalAmount = calculatedTotal - discount + tax;
                                            }
                                        }
                                        
                                        return `
                                        <tr class="invoice-row" style="transition: all 0.3s ease; border-bottom: 2px solid #f0f0f0;" onmouseover="this.style.background='linear-gradient(90deg, rgba(33, 150, 243, 0.05), rgba(33, 150, 243, 0.02))'; this.style.borderLeft='4px solid var(--primary-color)'" onmouseout="this.style.background='transparent'; this.style.borderLeft='none'">
                                            <td style="padding: 18px;">
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary-color), #1976D2); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);">
                                                        <i class="bi bi-receipt" style="font-size: 1.1em;"></i>
                                                    </div>
                                                    <strong style="color: var(--primary-color); font-size: 1.1em; font-weight: 700;">${saleNumber}</strong>
                                                </div>
                                            </td>
                                            <td style="padding: 18px;">
                                                <div style="display: flex; align-items: center; gap: 8px; color: var(--text-dark);">
                                                    <i class="bi bi-calendar3" style="color: var(--primary-color);"></i>
                                                    <span style="font-weight: 500;">${formatDate(sale.created_at)}</span>
                                                </div>
                                            </td>
                                            <td style="padding: 18px; text-align: center;">
                                                <span style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); color: #1976d2; padding: 8px 16px; border-radius: 25px; font-weight: 700; font-size: 1.05em; box-shadow: 0 2px 6px rgba(25, 118, 210, 0.2); display: inline-flex; align-items: center; gap: 6px;">
                                                    <i class="bi bi-box-seam"></i> ${itemsCount}
                                                </span>
                                            </td>
                                            <td style="padding: 18px; text-align: right; color: var(--text-dark); font-weight: 600; font-size: 1.05em;">
                                                ${totalAmount.toFixed(2)} <span style="color: #666; font-size: 0.9em;">ج.م</span>
                                            </td>
                                            <td style="padding: 18px; text-align: right;">
                                                <strong style="color: var(--primary-color); font-size: 1.3em; font-weight: 800; text-shadow: 0 1px 3px rgba(33, 150, 243, 0.2);">
                                                    ${finalAmount.toFixed(2)} <span style="color: #666; font-size: 0.75em; font-weight: 600;">ج.م</span>
                                                </strong>
                                            </td>
                                            <td style="padding: 18px; text-align: center;">
                                                <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
                                                    ${sale.invoice_file_path ? `
                                                        <a href="${sale.invoice_file_path}" target="_blank" class="btn btn-sm" style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 10px 18px; border-radius: 10px; text-decoration: none; transition: all 0.3s; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3); font-weight: 600; border: none; cursor: pointer;" onmouseover="this.style.transform='scale(1.08) translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(76, 175, 80, 0.4)'" onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 4px 12px rgba(76, 175, 80, 0.3)'">
                                                            <i class="bi bi-file-earmark-pdf" style="font-size: 1.1em;"></i> ملف الفاتورة
                                                        </a>
                                                    ` : ''}
                                                    <button onclick="viewSaleInvoice('${sale.id}')" class="btn btn-sm btn-primary" style="padding: 10px 20px; border-radius: 10px; transition: all 0.3s; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3); font-weight: 600; border: none; display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--primary-color), #1976D2);" onmouseover="this.style.transform='scale(1.08) translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(33, 150, 243, 0.4)'" onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 4px 12px rgba(33, 150, 243, 0.3)'">
                                                        <i class="bi bi-eye" style="font-size: 1.1em;"></i> التفاصيل
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // إغلاق عند الضغط خارج الـ modal
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function viewSaleInvoice(saleId) {
    try {
        if (!saleId) {
            showMessage('معرف الفاتورة غير صحيح', 'error');
            return;
        }
        
        // جلب الفاتورة مباشرة من API
        const response = await API.request(`sales.php?sale_id=${saleId}`, 'GET');
        
        if (response && response.success && response.data) {
            // التأكد من وجود البيانات الأساسية
            if (!response.data.id) {
                showMessage('بيانات الفاتورة غير مكتملة', 'error');
                return;
            }
            
            // عرض الفاتورة في modal
            showInvoiceModal(response.data);
        } else {
            const errorMsg = response?.message || 'فشل في جلب بيانات الفاتورة';
            console.error('خطأ في جلب الفاتورة:', errorMsg, response);
            showMessage(errorMsg, 'error');
        }
    } catch (error) {
        console.error('خطأ في عرض الفاتورة:', error);
        showMessage('حدث خطأ في عرض الفاتورة: ' + error.message, 'error');
    }
}

// دالة لعرض الفاتورة في modal
function showInvoiceModal(saleData) {
    // استخدام نفس دالة عرض الفاتورة من pos.js إذا كانت متاحة
    if (typeof showInvoice === 'function') {
        showInvoice(saleData);
    } else {
        // إنشاء modal للفاتورة
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const shopSettings = window.shopSettings || {};
        const shopName = shopSettings.shop_name || 'المتجر';
        const shopPhone = shopSettings.shop_phone || '';
        const shopAddress = shopSettings.shop_address || '';
        const currency = shopSettings.currency || 'ج.م';
        
        // تنسيق التاريخ
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                return dateString;
            }
        };
        
        const formatPrice = (price) => {
            return parseFloat(price || 0).toFixed(2);
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="bi bi-receipt"></i> فاتورة البيع</h3>
                    <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2>${shopName}</h2>
                        ${shopAddress ? `<p>${shopAddress}</p>` : ''}
                        ${shopPhone ? `<p>${shopPhone}</p>` : ''}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: var(--light-bg); border-radius: 5px;">
                        <div>
                            <div><strong>العميل:</strong> ${saleData.customer_name || ''}</div>
                            <div><strong>الهاتف:</strong> ${saleData.customer_phone || ''}</div>
                        </div>
                        <div style="text-align: right;">
                            <div><strong>رقم الفاتورة:</strong> ${saleData.sale_number || ''}</div>
                            <div><strong>التاريخ:</strong> ${formatDate(saleData.created_at)}</div>
                        </div>
                    </div>
                    
                    <table class="data-table" style="width: 100%; margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>المنتج</th>
                                <th>الكمية</th>
                                <th>سعر الوحدة</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(saleData.items || []).map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.item_name || ''}</td>
                                    <td>${item.quantity || 0}</td>
                                    <td>${formatPrice(item.unit_price)} ${currency}</td>
                                    <td>${formatPrice(item.total_price)} ${currency}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="border-top: 2px solid var(--border-color); padding-top: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>المجموع الفرعي:</span>
                            <span>${formatPrice(saleData.total_amount)} ${currency}</span>
                        </div>
                        ${parseFloat(saleData.discount || 0) > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <span>الخصم:</span>
                                <span>- ${formatPrice(saleData.discount)} ${currency}</span>
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold; color: var(--primary-color); margin-top: 15px; padding-top: 15px; border-top: 2px solid var(--border-color);">
                            <span>الإجمالي:</span>
                            <span>${formatPrice(saleData.final_amount)} ${currency}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="window.print()" class="btn btn-primary">
                        <i class="bi bi-printer"></i> طباعة
                    </button>
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إغلاق عند الضغط خارج الـ modal
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
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


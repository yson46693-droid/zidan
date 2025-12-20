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
    
    // Create profile modal مع تصميم محسّن
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div class="modal-header" style="border-bottom: 2px solid var(--border-color); padding: 20px 30px; background: linear-gradient(135deg, #2196F3, #21CBF3); border-radius: 15px 15px 0 0;">
                <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 10px; font-size: 1.5em;">
                    <i class="bi bi-person-circle" style="font-size: 1.3em;"></i> بروفايل العميل
                </h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close" style="color: white; font-size: 28px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px;">
                <!-- Customer Info Card - تصميم محسّن -->
                <div class="customer-profile-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, #1976D2 100%); color: white; padding: 35px; border-radius: 15px; margin-bottom: 30px; box-shadow: 0 5px 20px rgba(33, 150, 243, 0.3);">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
                        <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5em;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div style="flex: 1;">
                            <h2 style="margin: 0 0 8px 0; font-size: 1.8em; font-weight: bold;">${customer.name}</h2>
                            ${customer.customer_type === 'commercial' && customer.shop_name ? `
                                <p style="margin: 0; font-size: 1.1em; opacity: 0.95; display: flex; align-items: center; gap: 8px;">
                                    <i class="bi bi-shop"></i> ${customer.shop_name}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 25px; padding-top: 25px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <div style="display: flex; align-items: center; gap: 10px; font-size: 1.05em;">
                            <i class="bi bi-telephone-fill" style="font-size: 1.2em;"></i>
                            <span>${customer.phone}</span>
                        </div>
                        ${customer.address ? `
                            <div style="display: flex; align-items: center; gap: 10px; font-size: 1.05em;">
                                <i class="bi bi-geo-alt-fill" style="font-size: 1.2em;"></i>
                                <span>${customer.address}</span>
                            </div>
                        ` : ''}
                        <div style="display: flex; align-items: center; gap: 10px; font-size: 1.05em;">
                            <i class="bi bi-calendar-check-fill" style="font-size: 1.2em;"></i>
                            <span>${formatDate(customer.created_at)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Statistics Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 25px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
                        <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 8px;">${sales.length}</div>
                        <div style="opacity: 0.95; font-size: 1.05em;"><i class="bi bi-receipt"></i> عدد الفواتير</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; padding: 25px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);">
                        <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 8px;">${totalPurchases.toFixed(2)}</div>
                        <div style="opacity: 0.95; font-size: 1.05em;"><i class="bi bi-currency-exchange"></i> إجمالي المشتريات (ج.م)</div>
                    </div>
                </div>
                
                <!-- Sales History Section -->
                <div class="customer-sales-section">
                    <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 1.4em; color: var(--text-dark); padding-bottom: 15px; border-bottom: 2px solid var(--border-color);">
                        <i class="bi bi-receipt-cutoff" style="color: var(--primary-color);"></i> 
                        <span>سجل المشتريات</span>
                        ${sales.length > 0 ? `<span style="background: var(--primary-color); color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.8em; font-weight: normal;">${sales.length}</span>` : ''}
                    </h3>
                    ${sales.length === 0 ? `
                        <div style="text-align: center; padding: 60px 20px; background: var(--light-bg); border-radius: 12px; border: 2px dashed var(--border-color);">
                            <i class="bi bi-inbox" style="font-size: 4em; color: var(--text-light); margin-bottom: 15px; display: block;"></i>
                            <p style="color: var(--text-light); font-size: 1.1em; margin: 0;">لا توجد فواتير مسجلة لهذا العميل</p>
                        </div>
                    ` : `
                        <div class="table-container" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                            <table class="data-table" style="margin: 0;">
                                <thead style="background: linear-gradient(135deg, var(--primary-color), #1976D2); color: white;">
                                    <tr>
                                        <th style="padding: 15px; font-weight: 600;">رقم الفاتورة</th>
                                        <th style="padding: 15px; font-weight: 600;">التاريخ</th>
                                        <th style="padding: 15px; font-weight: 600; text-align: center;">عدد العناصر</th>
                                        <th style="padding: 15px; font-weight: 600; text-align: right;">المجموع</th>
                                        <th style="padding: 15px; font-weight: 600; text-align: right;">الإجمالي</th>
                                        <th style="padding: 15px; font-weight: 600; text-align: center;">الإجراءات</th>
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
                                        <tr style="transition: background 0.2s;" onmouseover="this.style.background='var(--light-bg)'" onmouseout="this.style.background='transparent'">
                                            <td style="padding: 15px;"><strong style="color: var(--primary-color);">${saleNumber}</strong></td>
                                            <td style="padding: 15px;">${formatDate(sale.created_at)}</td>
                                            <td style="padding: 15px; text-align: center;">
                                                <span style="background: var(--light-bg); padding: 5px 12px; border-radius: 20px; font-weight: 600; color: var(--text-dark);">
                                                    ${itemsCount}
                                                </span>
                                            </td>
                                            <td style="padding: 15px; text-align: right; color: var(--text-dark);">${totalAmount.toFixed(2)} ج.م</td>
                                            <td style="padding: 15px; text-align: right;">
                                                <strong style="color: var(--primary-color); font-size: 1.1em;">${finalAmount.toFixed(2)} ج.م</strong>
                                            </td>
                                            <td style="padding: 15px; text-align: center;">
                                                <button onclick="viewSaleInvoice('${sale.id}')" class="btn btn-sm btn-primary" style="padding: 8px 20px; border-radius: 8px; transition: all 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                                    <i class="bi bi-eye"></i> عرض الفاتورة
                                                </button>
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


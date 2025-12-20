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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد عملاء</td></tr>';
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
    // Error handling: التحقق من وجود customerId
    if (!customerId) {
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }

    // Error handling: البحث عن العميل
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) {
        showMessage('العميل غير موجود', 'error');
        return;
    }
    
    try {
        // Load customer sales - فقط فواتير هذا العميل
        const salesResult = await API.getCustomerSales(customerId);
        
        // Error handling: التحقق من نجاح الطلب
        if (!salesResult || !salesResult.success) {
            console.error('خطأ في جلب مبيعات العميل:', salesResult?.message || 'خطأ غير معروف');
            console.error('تفاصيل الاستجابة:', salesResult);
            showMessage('حدث خطأ أثناء جلب بيانات العميل', 'error');
        }
        
        let sales = salesResult && salesResult.success && Array.isArray(salesResult.data) ? salesResult.data : [];
        
        console.log('🔍 عدد الفواتير المستلمة من API:', sales.length);
        console.log('🔍 بيانات الفواتير:', sales);
        
        // فلترة إضافية للتأكد من أن الفواتير تخص هذا العميل فقط
        // نتحقق من customer_id أو customer_phone للتأكد من ربط الفاتورة بالعميل
        const originalSalesCount = sales.length;
        sales = sales.filter(sale => {
            // Error handling: التأكد من وجود sale
            if (!sale || !sale.id) {
                console.warn('⚠️ فاتورة بدون id:', sale);
                return false;
            }
            
            // التحقق من ربط الفاتورة بالعميل (customer_id أو customer_phone)
            const isCustomerMatch = (
                (sale.customer_id && sale.customer_id === customerId) ||
                (sale.customer_phone && sale.customer_phone === customer.phone)
            );
            
            if (!isCustomerMatch) {
                console.warn('⚠️ فاتورة لا تطابق العميل:', {
                    saleId: sale.id,
                    saleCustomerId: sale.customer_id,
                    saleCustomerPhone: sale.customer_phone,
                    targetCustomerId: customerId,
                    targetCustomerPhone: customer.phone
                });
                return false;
            }
            
            // Error handling: التأكد من وجود بيانات صحيحة (items)
            // نتحقق من وجود items حتى لو كانت فارغة (قد تكون فاتورة بدون عناصر)
            // إذا لم تكن items موجودة، نضيفها كـ array فارغ
            if (!sale.items || !Array.isArray(sale.items)) {
                console.warn('⚠️ فاتورة بدون items أو items ليست array، إضافة items فارغة:', {
                    saleId: sale.id,
                    items: sale.items
                });
                sale.items = []; // إضافة items فارغة بدلاً من تخطي الفاتورة
            }
            
            return true;
        });
        
        console.log(`✅ بعد الفلترة: ${sales.length} من ${originalSalesCount} فاتورة`);
        
        // حساب إجمالي المشتريات مع error handling
        const totalPurchases = sales.reduce((sum, sale) => {
            try {
                const amount = parseFloat(sale.final_amount || sale.total_amount || 0);
                return sum + (isNaN(amount) ? 0 : amount);
            } catch (error) {
                console.warn('خطأ في حساب مبلغ الفاتورة:', error);
                return sum;
            }
        }, 0);
    
        // Create profile modal using CSS classes
        const modal = document.createElement('div');
        modal.className = 'modal customer-profile-modal';
        
        // Build HTML using DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        const content = document.createElement('div');
        content.className = 'modal-content customer-profile-content';
        
        // Build header
        const header = document.createElement('div');
        header.className = 'modal-header customer-profile-header';
        header.innerHTML = `
            <h3>
                <i class="bi bi-person-circle"></i>
                بروفايل العميل
            </h3>
            <div class="profile-actions">
                <button onclick="editCustomer('${customer.id}'); this.closest('.modal').remove();" class="btn-profile-action">
                    <i class="bi bi-pencil-square"></i> تعديل
                </button>
                <button onclick="window.print()" class="btn-profile-action">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
        `;
        
        // Build body
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        // Customer Info Card
        const customerInfoCard = document.createElement('div');
        customerInfoCard.className = 'customer-info-card';
        
        const customerInfoHeader = document.createElement('div');
        customerInfoHeader.className = 'customer-info-header';
        customerInfoHeader.innerHTML = `
            <div class="customer-avatar">
                <i class="bi bi-person-fill"></i>
            </div>
            <div class="customer-info-details">
                <h2>${escapeHtml(customer.name || '')}</h2>
                ${customer.customer_type === 'commercial' && customer.shop_name ? `
                    <p class="shop-name">
                        <i class="bi bi-shop"></i> ${escapeHtml(customer.shop_name)}
                    </p>
                ` : ''}
                <p class="customer-type">
                    ${customer.customer_type === 'commercial' ? '<i class="bi bi-briefcase"></i> عميل تجاري' : '<i class="bi bi-person"></i> عميل محل'}
                </p>
            </div>
        `;
        
        const customerInfoGrid = document.createElement('div');
        customerInfoGrid.className = 'customer-info-grid';
        customerInfoGrid.innerHTML = `
            <div class="customer-info-item">
                <i class="bi bi-telephone-fill"></i>
                <div>
                    <div class="customer-info-item-label">رقم الهاتف</div>
                    <div class="customer-info-item-value">${escapeHtml(customer.phone || '')}</div>
                </div>
            </div>
            ${customer.address ? `
                <div class="customer-info-item">
                    <i class="bi bi-geo-alt-fill"></i>
                    <div>
                        <div class="customer-info-item-label">العنوان</div>
                        <div class="customer-info-item-value">${escapeHtml(customer.address)}</div>
                    </div>
                </div>
            ` : ''}
            <div class="customer-info-item">
                <i class="bi bi-calendar-check-fill"></i>
                <div>
                    <div class="customer-info-item-label">تاريخ التسجيل</div>
                    <div class="customer-info-item-value">${formatDate(customer.created_at)}</div>
                </div>
            </div>
        `;
        
        customerInfoCard.appendChild(customerInfoHeader);
        customerInfoCard.appendChild(customerInfoGrid);
        
        // Statistics Cards
        const statsGrid = document.createElement('div');
        statsGrid.className = 'customer-stats-grid';
        statsGrid.innerHTML = `
            <div class="customer-stat-card stat-invoices">
                <div class="stat-decorative-circle circle-1"></div>
                <div class="stat-decorative-circle circle-2"></div>
                <div class="customer-stat-value">${sales.length}</div>
                <div class="customer-stat-label">
                    <i class="bi bi-receipt-cutoff"></i> عدد الفواتير
                </div>
            </div>
            <div class="customer-stat-card stat-total">
                <div class="stat-decorative-circle circle-1"></div>
                <div class="stat-decorative-circle circle-2"></div>
                <div class="customer-stat-value">${totalPurchases.toFixed(2)}</div>
                <div class="customer-stat-label">
                    <i class="bi bi-currency-exchange"></i> إجمالي المشتريات
                    <span style="font-size: 0.85em; opacity: 0.9;">(ج.م)</span>
                </div>
            </div>
        `;
        
        // Sales History Section
        const salesSection = document.createElement('div');
        salesSection.className = 'customer-sales-section';
        
        const salesHeader = document.createElement('h3');
        salesHeader.innerHTML = `
            <div class="section-icon">
                <i class="bi bi-receipt-cutoff"></i>
            </div>
            <span>سجل المشتريات</span>
            ${sales.length > 0 ? `<span class="section-badge"> </span>` : ''}
        `;
        
        if (sales.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'customer-sales-empty';
            emptyState.innerHTML = `
                <i class="bi bi-inbox"></i>
                <p>لا توجد فواتير مسجلة لهذا العميل</p>
            `;
            salesSection.appendChild(salesHeader);
            salesSection.appendChild(emptyState);
        } else {
            // Build sales table
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container customer-sales-table';
            
            const table = document.createElement('table');
            table.className = 'data-table';
            
            // Build table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th style="text-align: center;">عدد العناصر</th>
                    <th style="text-align: right;">الإجمالي</th>
                    <th style="text-align: center;">الإجراءات</th>
                </tr>
            `;
            
            // Build table body using DocumentFragment for better performance
            const tbody = document.createElement('tbody');
            const tbodyFragment = document.createDocumentFragment();
            
            sales.forEach(sale => {
                try {
                    // Error handling: التأكد من وجود البيانات الصحيحة
                    const saleNumber = sale.sale_number || sale.id || 'غير محدد';
                    const items = sale.items && Array.isArray(sale.items) ? sale.items : [];
                    const itemsCount = items.length;
                    
                    // حساب المبلغ من العناصر إذا لم يكن موجوداً
                    let totalAmount = parseFloat(sale.total_amount || 0);
                    let finalAmount = parseFloat(sale.final_amount || 0);
                    
                    // إذا كانت القيم 0، نحسبها من العناصر
                    if (items.length > 0 && (totalAmount === 0 || finalAmount === 0)) {
                        const calculatedTotal = items.reduce((sum, item) => {
                            try {
                                const itemPrice = parseFloat(item.total_price || 0);
                                const itemQty = parseInt(item.quantity || 1);
                                return sum + (itemPrice * itemQty);
                            } catch (error) {
                                console.warn('خطأ في حساب عنصر الفاتورة:', error);
                                return sum;
                            }
                        }, 0);
                        
                        if (totalAmount === 0 && !isNaN(calculatedTotal)) {
                            totalAmount = calculatedTotal;
                        }
                        if (finalAmount === 0 && !isNaN(calculatedTotal)) {
                            const discount = parseFloat(sale.discount || 0);
                            const tax = parseFloat(sale.tax || 0);
                            finalAmount = calculatedTotal - discount + tax;
                        }
                    }
                    
                    // Ensure valid numbers
                    totalAmount = isNaN(totalAmount) ? 0 : totalAmount;
                    finalAmount = isNaN(finalAmount) ? 0 : finalAmount;
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <div class="invoice-number-cell">
                                <strong class="invoice-number-text">${escapeHtml(saleNumber)}</strong>
                            </div>
                        </td>
                        <td>
                            <div class="invoice-date-cell">
                                <i class="bi bi-calendar3"></i>
                                <span>${formatDate(sale.created_at)}</span>
                            </div>
                        </td>
                        <td style="text-align: center;">
                            <span class="invoice-items-badge">
                                <i class="bi bi-box-seam"></i> ${itemsCount}
                            </span>
                        </td>
                        <td style="text-align: right;">
                            <strong class="invoice-final-amount">
                                ${finalAmount.toFixed(2)} <span class="invoice-amount-currency">ج.م</span>
                            </strong>
                        </td>
                        <td style="text-align: center;">
                            <div class="invoice-actions">
                                <button onclick="printSaleInvoice('${escapeHtml(sale.id)}')" class="btn-invoice-action btn-invoice-pdf">
                                    <i class="bi bi-printer"></i> طباعة الفاتورة
                                </button>
                            </div>
                        </td>
                    `;
                    tbodyFragment.appendChild(row);
                } catch (error) {
                    console.error('خطأ في معالجة فاتورة:', error, sale);
                }
            });
            
            tbody.appendChild(tbodyFragment);
            table.appendChild(thead);
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            
            salesSection.appendChild(salesHeader);
            salesSection.appendChild(tableContainer);
        }
        
        // Assemble all parts
        body.appendChild(customerInfoCard);
        body.appendChild(statsGrid);
        body.appendChild(salesSection);
        
        content.appendChild(header);
        content.appendChild(body);
        fragment.appendChild(content);
        
        modal.appendChild(fragment);
        document.body.appendChild(modal);
        
        // إغلاق عند الضغط خارج الـ modal
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Error handling: إزالة event listener عند إغلاق الـ modal
        const closeButtons = modal.querySelectorAll('.btn-close, [onclick*="remove"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                modal.remove();
            });
        });
        
    } catch (error) {
        console.error('خطأ في عرض بروفايل العميل:', error);
        showMessage('حدث خطأ أثناء عرض بروفايل العميل: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// دالة لطباعة الفاتورة مباشرة
async function printSaleInvoice(saleId) {
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
            
            // طباعة الفاتورة مباشرة
            printInvoiceDirectly(response.data);
        } else {
            const errorMsg = response?.message || 'فشل في جلب بيانات الفاتورة';
            console.error('خطأ في جلب الفاتورة:', errorMsg, response);
            showMessage(errorMsg, 'error');
        }
    } catch (error) {
        console.error('خطأ في طباعة الفاتورة:', error);
        showMessage('حدث خطأ في طباعة الفاتورة: ' + error.message, 'error');
    }
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

// دالة لطباعة الفاتورة مباشرة في نفس الصفحة
function printInvoiceDirectly(saleData) {
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
    
    // إنشاء نافذة طباعة
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        showMessage('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة', 'error');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>فاتورة ${saleData.sale_number || saleData.id}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 30px;
                    background: #fff;
                    color: #333;
                    line-height: 1.6;
                }
                
                .invoice-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                }
                
                .invoice-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #2196F3;
                }
                
                .invoice-header h1 {
                    font-size: 2.5em;
                    color: #2196F3;
                    margin-bottom: 10px;
                    font-weight: 800;
                }
                
                .invoice-header p {
                    color: #666;
                    font-size: 1.1em;
                    margin: 5px 0;
                }
                
                .invoice-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .invoice-info-section {
                    flex: 1;
                }
                
                .invoice-info-section h3 {
                    color: #2196F3;
                    margin-bottom: 10px;
                    font-size: 1.2em;
                    font-weight: 700;
                }
                
                .invoice-info-section p {
                    margin: 5px 0;
                    color: #333;
                    font-size: 1em;
                }
                
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                
                .invoice-table thead {
                    background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
                    color: white;
                }
                
                .invoice-table th {
                    padding: 15px;
                    text-align: right;
                    font-weight: 700;
                    font-size: 1.05em;
                }
                
                .invoice-table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #ddd;
                    text-align: right;
                }
                
                .invoice-table tbody tr:hover {
                    background: #f8f9fa;
                }
                
                .invoice-summary {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 2px solid #ddd;
                }
                
                .invoice-summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    font-size: 1.1em;
                }
                
                .invoice-total {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 3px solid #2196F3;
                    font-size: 1.4em;
                    font-weight: 800;
                    color: #2196F3;
                }
                
                .invoice-footer {
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #ddd;
                    color: #666;
                }
                
                @media print {
                    body {
                        padding: 0;
                        background: white;
                    }
                    
                    .invoice-container {
                        border: none;
                        padding: 20px;
                        box-shadow: none;
                    }
                    
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="invoice-header">
                    <h1>${escapeHtml(shopName)}</h1>
                    ${shopAddress ? `<p>${escapeHtml(shopAddress)}</p>` : ''}
                    ${shopPhone ? `<p>${escapeHtml(shopPhone)}</p>` : ''}
                </div>
                
                <div class="invoice-info">
                    <div class="invoice-info-section">
                        <h3>معلومات العميل</h3>
                        <p><strong>الاسم:</strong> ${escapeHtml(saleData.customer_name || '')}</p>
                        <p><strong>الهاتف:</strong> ${escapeHtml(saleData.customer_phone || '')}</p>
                    </div>
                    <div class="invoice-info-section">
                        <h3>معلومات الفاتورة</h3>
                        <p><strong>رقم الفاتورة:</strong> ${escapeHtml(saleData.sale_number || saleData.id || '')}</p>
                        <p><strong>التاريخ:</strong> ${formatDate(saleData.created_at)}</p>
                    </div>
                </div>
                
                <table class="invoice-table">
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
                                <td>${escapeHtml(item.item_name || '')}</td>
                                <td>${item.quantity || 0}</td>
                                <td>${formatPrice(item.unit_price)} ${currency}</td>
                                <td>${formatPrice(item.total_price)} ${currency}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="invoice-summary">
                    <div class="invoice-summary-row">
                        <span>المجموع الفرعي:</span>
                        <span>${formatPrice(saleData.total_amount)} ${currency}</span>
                    </div>
                    ${parseFloat(saleData.discount || 0) > 0 ? `
                        <div class="invoice-summary-row">
                            <span>الخصم:</span>
                            <span>- ${formatPrice(saleData.discount)} ${currency}</span>
                        </div>
                    ` : ''}
                    ${parseFloat(saleData.tax || 0) > 0 ? `
                        <div class="invoice-summary-row">
                            <span>الضريبة:</span>
                            <span>+ ${formatPrice(saleData.tax)} ${currency}</span>
                        </div>
                    ` : ''}
                    <div class="invoice-total">
                        <span>الإجمالي:</span>
                        <span>${formatPrice(saleData.final_amount)} ${currency}</span>
                    </div>
                </div>
                
                <div class="invoice-footer">
                    <p>شكراً لثقتكم</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => {
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
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


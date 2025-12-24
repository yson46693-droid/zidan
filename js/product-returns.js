// Product Returns System JavaScript

// Global State
let currentInvoice = null;
let returnItems = {}; // { sale_item_id: { selected: bool, quantity: int, is_damaged: bool } }
let allReturns = [];
let normalReturns = [];
let damagedReturns = [];
let isScannerOpen = false;

// Load Product Returns Section
function loadProductReturnsSection() {
    const section = document.getElementById('product-returns-section');
    if (!section) return;
    
    section.innerHTML = `
        <div class="section-header">
            <h2>
                <i class="bi bi-arrow-return-left"></i> استرجاع المنتجات
                <div style="display: inline-flex; gap: 8px; margin-right: 15px;">
                    <i class="bi bi-phone" style="font-size: 20px; color: var(--primary-color);"></i>
                    <i class="bi bi-tablet" style="font-size: 20px; color: var(--secondary-color);"></i>
                    <i class="bi bi-smartwatch" style="font-size: 20px; color: var(--primary-color);"></i>
                </div>
            </h2>
        </div>

        <div class="product-returns-container" style="padding: 20px;">
            <!-- Search Section -->
            <div class="search-section" style="background: var(--white); padding: 30px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 30px;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
                        <div style="position: relative;">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect fill='%23333' x='10' y='20' width='40' height='30' rx='3'/%3E%3Cline stroke='%23f44336' stroke-width='2' x1='25' y1='35' x2='35' y2='35'/%3E%3Cline stroke='%23333' stroke-width='2' x1='15' y1='15' x2='15' y2='20'/%3E%3Cline stroke='%23333' stroke-width='2' x1='45' y1='15' x2='45' y2='20'/%3E%3C/svg%3E" 
                                 alt="ماسح باركود" style="width: 60px; height: 60px;">
                            <div style="position: absolute; top: 40px; left: 20px; width: 20px; height: 2px; background: #f44336; animation: pulse 1s infinite;"></div>
                        </div>
                        <div style="flex: 1;">
                            <p style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 16px; font-weight: 500;">
                                امسح أو أدخل الرقم الموجود على الفاتورة
                            </p>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" 
                                       id="invoiceSearchInput" 
                                       placeholder="رقم الفاتورة / الباركود"
                                       style="flex: 1; padding: 12px 15px; border: 2px solid var(--border-color); border-radius: 8px; font-size: 16px; outline: none; transition: border-color 0.3s;"
                                       onkeypress="if(event.key === 'Enter') searchInvoiceByNumber()">
                                <button onclick="openBarcodeScanner()" 
                                        class="btn btn-secondary"
                                        style="padding: 12px 20px; background: var(--secondary-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                                    <i class="bi bi-upc-scan"></i> مسح
                                </button>
                                <button onclick="searchInvoiceByNumber()" 
                                        class="btn btn-primary"
                                        style="padding: 12px 25px; background: var(--primary-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                                    <i class="bi bi-search"></i> بحث
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Invoice Details Card -->
            <div id="invoiceDetailsCard" style="display: none; background: var(--white); padding: 30px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 30px;">
                <div style="display: flex; align-items: start; gap: 30px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <div style="margin-bottom: 20px;">
                            <h3 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 18px; font-weight: 600;">
                                رقم الفاتورة : <span id="invoiceNumberDisplay"></span>
                            </h3>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                                <div style="width: 24px; height: 24px; background: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--white); font-size: 14px;">
                                    <i class="bi bi-check"></i>
                                </div>
                                <p style="margin: 0; color: var(--text-dark); font-size: 16px;">
                                    اسم العميل : <strong id="customerNameDisplay"></strong>
                                </p>
                            </div>
                        </div>

                        <div id="invoiceItemsList" style="margin-top: 20px;">
                            <!-- Items will be inserted here -->
                        </div>

                        <div style="margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap;">
                            <button onclick="returnAllItems()" 
                                    class="btn btn-secondary"
                                    style="padding: 10px 20px; background: var(--secondary-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                                <i class="bi bi-check-all"></i> إرجاع الكل
                            </button>
                            <button onclick="clearAllItems()" 
                                    class="btn btn-secondary"
                                    style="padding: 10px 20px; background: var(--text-light); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                                <i class="bi bi-x-circle"></i> إلغاء الكل
                            </button>
                        </div>

                        <button onclick="completeReturn()" 
                                id="completeReturnBtn"
                                class="btn btn-success"
                                style="width: 100%; margin-top: 25px; padding: 15px; background: var(--success-color); color: var(--white); border: none; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: 600; display: none;">
                            <i class="bi bi-check-circle"></i> إتمام عملية الاسترجاع
                        </button>
                    </div>
                    <div style="width: 150px;">
                        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='200' viewBox='0 0 150 200'%3E%3Crect fill='white' stroke='%23333' stroke-width='2' x='10' y='10' width='130' height='180'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='30' x2='130' y2='30'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='50' x2='130' y2='50'/%3E%3Cline stroke='%23333' stroke-width='1' x1='20' y1='70' x2='130' y2='70'/%3E%3Ctext x='75' y='140' text-anchor='middle' font-family='Arial' font-size='16' fill='%23333'%3E548%3C/text%3E%3Ctext x='75' y='160' text-anchor='middle' font-family='Arial' font-size='16' fill='%23333'%3E300%3C/text%3E%3C/svg%3E" 
                         alt="إيصال" style="width: 100%; height: auto; opacity: 0.7;">
                    </div>
                </div>
            </div>

            <!-- Returns Tables Section -->
            <div id="returnsTablesSection" style="margin-top: 40px;">
                <h3 style="margin-bottom: 20px; color: var(--text-dark); font-size: 20px; font-weight: 600;">
                    <i class="bi bi-list-ul"></i> قائمة المرتجعات
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Normal Returns Table -->
                    <div style="background: var(--white); border-radius: 12px; box-shadow: var(--shadow); padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--success-color); font-size: 18px; font-weight: 600;">
                            <i class="bi bi-check-circle"></i> المرتجعات العادية
                        </h4>
                        <div style="overflow-x: auto;">
                            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--light-bg);">
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">رقم الاسترجاع</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">رقم الفاتورة</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">العميل</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody id="normalReturnsTableBody">
                                    <tr>
                                        <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                                            لا توجد مرتجعات عادية
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Damaged Returns Table -->
                    <div style="background: var(--white); border-radius: 12px; box-shadow: var(--shadow); padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--danger-color); font-size: 18px; font-weight: 600;">
                            <i class="bi bi-exclamation-triangle"></i> المرتجعات التالفة
                        </h4>
                        <div style="overflow-x: auto;">
                            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--light-bg);">
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">رقم الاسترجاع</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">رقم الفاتورة</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">العميل</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--border-color);">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody id="damagedReturnsTableBody">
                                    <tr>
                                        <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                                            لا توجد مرتجعات تالفة
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @media (max-width: 768px) {
                .product-returns-container .search-section > div {
                    flex-direction: column;
                }
                
                #returnsTablesSection > div {
                    grid-template-columns: 1fr !important;
                }
            }
        </style>
    `;
    
    // Load returns list
    loadReturnsList();
}

// Search Invoice by Number
async function searchInvoiceByNumber() {
    const input = document.getElementById('invoiceSearchInput');
    if (!input) return;
    
    const saleNumber = input.value.trim();
    if (!saleNumber) {
        showMessage('الرجاء إدخال رقم الفاتورة', 'error');
        return;
    }
    
    try {
        const response = await API.request(`product-returns.php?sale_number=${encodeURIComponent(saleNumber)}`, 'GET');
        
        if (response.success && response.data) {
            currentInvoice = response.data;
            returnItems = {};
            displayInvoiceDetails(response.data);
        } else {
            showMessage(response.message || 'الفاتورة غير موجودة', 'error');
            hideInvoiceDetails();
        }
    } catch (error) {
        console.error('خطأ في البحث عن الفاتورة:', error);
        showMessage('حدث خطأ أثناء البحث عن الفاتورة', 'error');
    }
}

// Display Invoice Details
function displayInvoiceDetails(invoiceData) {
    const card = document.getElementById('invoiceDetailsCard');
    const invoiceNumberDisplay = document.getElementById('invoiceNumberDisplay');
    const customerNameDisplay = document.getElementById('customerNameDisplay');
    const itemsList = document.getElementById('invoiceItemsList');
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (!card || !invoiceNumberDisplay || !customerNameDisplay || !itemsList) return;
    
    invoiceNumberDisplay.textContent = invoiceData.sale_number || invoiceData.id;
    customerNameDisplay.textContent = invoiceData.customer_name || 'غير محدد';
    
    // Clear previous items
    itemsList.innerHTML = '';
    
    if (!invoiceData.items || invoiceData.items.length === 0) {
        itemsList.innerHTML = '<p style="color: var(--text-light);">لا توجد منتجات في هذه الفاتورة</p>';
        return;
    }
    
    // Display items
    invoiceData.items.forEach((item, index) => {
        const itemId = item.id;
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'display: flex; align-items: center; gap: 15px; padding: 15px; margin-bottom: 10px; background: var(--light-bg); border-radius: 8px; border: 2px solid var(--border-color);';
        itemDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <div style="width: 24px; height: 24px; background: var(--success-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--white); font-size: 14px;">
                    <i class="bi bi-check"></i>
                </div>
                <div style="flex: 1;">
                    <p style="margin: 0; color: var(--text-dark); font-size: 16px; font-weight: 500;">
                        ${escapeHtml(item.item_name)}
                    </p>
                    <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 14px;">
                        الكمية: ${item.quantity} | السعر: ${formatCurrency(item.unit_price)}
                    </p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" 
                           id="returnItem_${itemId}"
                           onchange="toggleReturnItem('${itemId}', ${item.quantity})"
                           style="width: 20px; height: 20px; cursor: pointer;">
                    <span style="font-size: 14px; color: var(--text-dark);">إرجاع</span>
                </label>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" 
                           id="damagedItem_${itemId}"
                           onchange="toggleItemDamaged('${itemId}')"
                           style="width: 20px; height: 20px; cursor: pointer;">
                    <span style="font-size: 14px; color: var(--danger-color);">تالف</span>
                </label>
                <input type="number" 
                       id="quantityInput_${itemId}"
                       min="1" 
                       max="${item.quantity}" 
                       value="${item.quantity}"
                       onchange="setReturnQuantity('${itemId}', ${item.quantity})"
                       style="width: 80px; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; text-align: center;"
                       disabled>
            </div>
        `;
        itemsList.appendChild(itemDiv);
    });
    
    card.style.display = 'block';
    completeBtn.style.display = 'none';
}

// Hide Invoice Details
function hideInvoiceDetails() {
    const card = document.getElementById('invoiceDetailsCard');
    if (card) {
        card.style.display = 'none';
    }
    currentInvoice = null;
    returnItems = {};
}

// Toggle Return Item
function toggleReturnItem(itemId, maxQuantity) {
    const checkbox = document.getElementById(`returnItem_${itemId}`);
    const quantityInput = document.getElementById(`quantityInput_${itemId}`);
    const completeBtn = document.getElementById('completeReturnBtn');
    
    if (!checkbox || !quantityInput) return;
    
    if (checkbox.checked) {
        if (!returnItems[itemId]) {
            returnItems[itemId] = {
                selected: true,
                quantity: parseInt(quantityInput.value) || maxQuantity,
                is_damaged: false
            };
        } else {
            returnItems[itemId].selected = true;
        }
        quantityInput.disabled = false;
    } else {
        if (returnItems[itemId]) {
            returnItems[itemId].selected = false;
        }
        quantityInput.disabled = true;
    }
    
    // Show/hide complete button
    const hasSelectedItems = Object.values(returnItems).some(item => item.selected);
    if (completeBtn) {
        completeBtn.style.display = hasSelectedItems ? 'block' : 'none';
    }
}

// Set Return Quantity
function setReturnQuantity(itemId, maxQuantity) {
    const quantityInput = document.getElementById(`quantityInput_${itemId}`);
    if (!quantityInput) return;
    
    let quantity = parseInt(quantityInput.value) || 1;
    if (quantity < 1) quantity = 1;
    if (quantity > maxQuantity) quantity = maxQuantity;
    quantityInput.value = quantity;
    
    if (returnItems[itemId]) {
        returnItems[itemId].quantity = quantity;
    }
}

// Toggle Item Damaged
function toggleItemDamaged(itemId) {
    const checkbox = document.getElementById(`damagedItem_${itemId}`);
    if (!checkbox) return;
    
    if (returnItems[itemId]) {
        returnItems[itemId].is_damaged = checkbox.checked;
    } else {
        // Initialize if not exists
        const returnCheckbox = document.getElementById(`returnItem_${itemId}`);
        if (returnCheckbox && returnCheckbox.checked) {
            const quantityInput = document.getElementById(`quantityInput_${itemId}`);
            const maxQuantity = quantityInput ? parseInt(quantityInput.max) : 1;
            returnItems[itemId] = {
                selected: true,
                quantity: parseInt(quantityInput?.value || maxQuantity),
                is_damaged: checkbox.checked
            };
        }
    }
}

// Return All Items
function returnAllItems() {
    if (!currentInvoice || !currentInvoice.items) return;
    
    currentInvoice.items.forEach(item => {
        const checkbox = document.getElementById(`returnItem_${item.id}`);
        const quantityInput = document.getElementById(`quantityInput_${item.id}`);
        
        if (checkbox && quantityInput) {
            checkbox.checked = true;
            quantityInput.value = item.quantity;
            quantityInput.disabled = false;
            
            returnItems[item.id] = {
                selected: true,
                quantity: item.quantity,
                is_damaged: false
            };
        }
    });
    
    const completeBtn = document.getElementById('completeReturnBtn');
    if (completeBtn) {
        completeBtn.style.display = 'block';
    }
}

// Clear All Items
function clearAllItems() {
    if (!currentInvoice || !currentInvoice.items) return;
    
    currentInvoice.items.forEach(item => {
        const checkbox = document.getElementById(`returnItem_${item.id}`);
        const damagedCheckbox = document.getElementById(`damagedItem_${item.id}`);
        const quantityInput = document.getElementById(`quantityInput_${item.id}`);
        
        if (checkbox) checkbox.checked = false;
        if (damagedCheckbox) damagedCheckbox.checked = false;
        if (quantityInput) {
            quantityInput.value = item.quantity;
            quantityInput.disabled = true;
        }
        
        delete returnItems[item.id];
    });
    
    const completeBtn = document.getElementById('completeReturnBtn');
    if (completeBtn) {
        completeBtn.style.display = 'none';
    }
}

// Complete Return
async function completeReturn() {
    if (!currentInvoice) {
        showMessage('لا توجد فاتورة محددة', 'error');
        return;
    }
    
    // Prepare return items
    const itemsToReturn = [];
    for (const [itemId, itemData] of Object.entries(returnItems)) {
        if (itemData.selected) {
            const saleItem = currentInvoice.items.find(i => i.id === itemId);
            if (saleItem) {
                itemsToReturn.push({
                    sale_item_id: itemId,
                    returned_quantity: itemData.quantity,
                    is_damaged: itemData.is_damaged ? 1 : 0
                });
            }
        }
    }
    
    if (itemsToReturn.length === 0) {
        showMessage('الرجاء تحديد منتج واحد على الأقل للإرجاع', 'error');
        return;
    }
    
    // Validate quantities
    for (const item of itemsToReturn) {
        const saleItem = currentInvoice.items.find(i => i.id === item.sale_item_id);
        if (saleItem && item.returned_quantity > saleItem.quantity) {
            showMessage(`الكمية المراد إرجاعها (${item.returned_quantity}) أكبر من الكمية المباعة (${saleItem.quantity})`, 'error');
            return;
        }
    }
    
    try {
        const response = await API.request('product-returns.php', 'POST', {
            sale_number: currentInvoice.sale_number || currentInvoice.id,
            items: itemsToReturn,
            notes: ''
        });
        
        if (response.success) {
            showMessage('تم إتمام عملية الاسترجاع بنجاح', 'success');
            
            // Reset form
            hideInvoiceDetails();
            const input = document.getElementById('invoiceSearchInput');
            if (input) input.value = '';
            
            // Reload returns list
            loadReturnsList();
        } else {
            showMessage(response.message || 'حدث خطأ أثناء عملية الاسترجاع', 'error');
        }
    } catch (error) {
        console.error('خطأ في إتمام عملية الاسترجاع:', error);
        showMessage('حدث خطأ أثناء عملية الاسترجاع', 'error');
    }
}

// Load Returns List
async function loadReturnsList() {
    try {
        // Load all returns
        const response = await API.request('product-returns.php', 'GET', null, { silent: true });
        
        if (response.success && response.data) {
            allReturns = response.data;
            
            // Separate normal and damaged returns
            normalReturns = [];
            damagedReturns = [];
            
            allReturns.forEach(returnItem => {
                const hasDamagedItems = returnItem.items && returnItem.items.some(item => item.is_damaged == 1);
                if (hasDamagedItems) {
                    damagedReturns.push(returnItem);
                } else {
                    normalReturns.push(returnItem);
                }
            });
            
            displayReturnsTables();
        }
    } catch (error) {
        console.error('خطأ في جلب قائمة المرتجعات:', error);
    }
}

// Display Returns Tables
function displayReturnsTables() {
    const normalTableBody = document.getElementById('normalReturnsTableBody');
    const damagedTableBody = document.getElementById('damagedReturnsTableBody');
    
    // Display normal returns
    if (normalTableBody) {
        if (normalReturns.length === 0) {
            normalTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                        لا توجد مرتجعات عادية
                    </td>
                </tr>
            `;
        } else {
            normalTableBody.innerHTML = normalReturns.map(returnItem => {
                const itemsList = returnItem.items ? returnItem.items.map(item => 
                    `${item.item_name} (${item.returned_quantity})`
                ).join(', ') : 'لا توجد عناصر';
                
                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px;">${escapeHtml(returnItem.return_number)}</td>
                        <td style="padding: 12px;">${escapeHtml(returnItem.sale_number)}</td>
                        <td style="padding: 12px;">${escapeHtml(returnItem.customer_name || 'غير محدد')}</td>
                        <td style="padding: 12px;">${formatDate(returnItem.created_at)}</td>
                    </tr>
                `;
            }).join('');
        }
    }
    
    // Display damaged returns
    if (damagedTableBody) {
        if (damagedReturns.length === 0) {
            damagedTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">
                        لا توجد مرتجعات تالفة
                    </td>
                </tr>
            `;
        } else {
            damagedTableBody.innerHTML = damagedReturns.map(returnItem => {
                const itemsList = returnItem.items ? returnItem.items.map(item => 
                    `${item.item_name} (${item.returned_quantity})`
                ).join(', ') : 'لا توجد عناصر';
                
                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px;">${escapeHtml(returnItem.return_number)}</td>
                        <td style="padding: 12px;">${escapeHtml(returnItem.sale_number)}</td>
                        <td style="padding: 12px;">${escapeHtml(returnItem.customer_name || 'غير محدد')}</td>
                        <td style="padding: 12px;">${formatDate(returnItem.created_at)}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// Open Barcode Scanner
async function openBarcodeScanner() {
    if (isScannerOpen) {
        showMessage('قارئ الباركود مفتوح بالفعل', 'info');
        return;
    }
    
    const existingModal = document.getElementById('barcodeScannerModal');
    if (existingModal) {
        showMessage('قارئ الباركود مفتوح بالفعل', 'info');
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('الكاميرا غير متوفرة في هذا المتصفح', 'error');
        return;
    }
    
    if (typeof Quagga === 'undefined' && typeof window.loadQuagga === 'function') {
        try {
            await window.loadQuagga();
        } catch (error) {
            showMessage('فشل تحميل مكتبة الباركود', 'error');
            return;
        }
    }
    
    isScannerOpen = true;
    
    const scannerModal = document.createElement('div');
    scannerModal.id = 'barcodeScannerModal';
    scannerModal.className = 'modal';
    scannerModal.style.display = 'flex';
    scannerModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2><i class="bi bi-upc-scan"></i> قارئ الباركود</h2>
                <button onclick="closeBarcodeScannerForReturns()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div id="barcode-scanner-container" style="text-align: center;">
                    <div id="scanner-area" style="width: 100%; height: 300px; background: #f0f0f0; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; position: relative;">
                        <p>جاري تحميل قارئ الباركود...</p>
                    </div>
                    <div id="scanner-result" style="margin-top: 20px; display: none;">
                        <div class="alert alert-success">
                            <h4><i class="bi bi-check-circle"></i> تم العثور على الباركود!</h4>
                            <p><strong>رقم الفاتورة:</strong> <span id="scanned-invoice-number"></span></p>
                            <button onclick="useScannedInvoiceNumber()" class="btn btn-primary">
                                <i class="bi bi-search"></i> البحث عن الفاتورة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="retryBarcodeScannerForReturns()" class="btn btn-warning">
                    <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                </button>
                <button onclick="closeBarcodeScannerForReturns()" class="btn btn-secondary">إغلاق</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(scannerModal);
    
    setTimeout(() => {
        initializeBarcodeScannerForReturns();
    }, 200);
}

// Initialize Barcode Scanner for Returns
async function initializeBarcodeScannerForReturns() {
    const scannerArea = document.getElementById('scanner-area');
    if (!scannerArea) return;
    
    scannerArea.innerHTML = '<div class="scanner-loading"><i class="bi bi-camera"></i> جاري تحميل مكتبة الباركود...</div>';
    
    if (typeof Quagga === 'undefined') {
        if (typeof window.loadQuagga === 'function') {
            try {
                await window.loadQuagga();
            } catch (error) {
                scannerArea.innerHTML = '<div class="scanner-error"><i class="bi bi-exclamation-triangle"></i> خطأ: فشل تحميل مكتبة الباركود</div>';
                return;
            }
        } else {
            scannerArea.innerHTML = '<div class="scanner-error"><i class="bi bi-exclamation-triangle"></i> خطأ: مكتبة الباركود غير متاحة</div>';
            return;
        }
    }
    
    scannerArea.innerHTML = '<div class="scanner-loading"><i class="bi bi-camera"></i> جاري تحميل الكاميرا...</div>';
    
    const config = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: scannerArea,
            constraints: {
                width: { min: 320, ideal: 640, max: 1280 },
                height: { min: 240, ideal: 480, max: 720 },
                facingMode: "environment",
                aspectRatio: { min: 1, max: 2 }
            },
            singleChannel: false
        },
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "upc_reader",
                "upc_e_reader"
            ]
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: 2,
        frequency: 10
    };
    
    Quagga.init(config, function(err) {
        if (err) {
            scannerArea.innerHTML = '<div class="scanner-error"><i class="bi bi-exclamation-triangle"></i> خطأ: ' + err.message + '</div>';
            return;
        }
        
        Quagga.start();
        
        let scannedCode = null;
        Quagga.onDetected(function(data) {
            const code = data.codeResult.code;
            if (scannedCode === code) return;
            
            scannedCode = code;
            Quagga.stop();
            
            const resultDiv = document.getElementById('scanner-result');
            const invoiceNumberSpan = document.getElementById('scanned-invoice-number');
            
            if (resultDiv && invoiceNumberSpan) {
                invoiceNumberSpan.textContent = code;
                resultDiv.style.display = 'block';
            }
        });
    });
}

// Close Barcode Scanner
function closeBarcodeScannerForReturns() {
    if (typeof Quagga !== 'undefined') {
        try {
            Quagga.stop();
        } catch (e) {
            // Ignore errors
        }
    }
    
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
        modal.remove();
    }
    
    isScannerOpen = false;
}

// Retry Barcode Scanner
function retryBarcodeScannerForReturns() {
    closeBarcodeScannerForReturns();
    setTimeout(() => {
        openBarcodeScanner();
    }, 300);
}

// Use Scanned Invoice Number
function useScannedInvoiceNumber() {
    const invoiceNumberSpan = document.getElementById('scanned-invoice-number');
    if (invoiceNumberSpan) {
        const input = document.getElementById('invoiceSearchInput');
        if (input) {
            input.value = invoiceNumberSpan.textContent;
            closeBarcodeScannerForReturns();
            searchInvoiceByNumber();
        }
    }
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2) + ' ج.م';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Africa/Cairo'
        });
    } catch (e) {
        return dateString;
    }
}


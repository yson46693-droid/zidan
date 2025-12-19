// POS System JavaScript

// Global State
let allProducts = [];
let filteredProducts = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';
let shopSettings = {};
let debounceTimer = null;
let allCustomers = [];
let currentCustomerType = 'retail';
let selectedCustomerId = null;

// Initialize POS
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.pos-container')) {
        initializePOS();
    }
});

async function initializePOS() {
    try {
        // Load shop settings
        await loadShopSettings();
        
        // Load all products
        await loadAllProducts();
        
        // Load customers
        await loadCustomers();
        
        // Setup event listeners
        setupEventListeners();
        
        // Render initial products
        renderProducts();
        
        // Update cart display
        updateCartDisplay();
    } catch (error) {
        console.error('خطأ في تهيئة نظام POS:', error);
        showMessage('حدث خطأ في تحميل البيانات', 'error');
    }
}

// Load Customers
async function loadCustomers() {
    try {
        const retailRes = await API.getCustomers('retail');
        const commercialRes = await API.getCustomers('commercial');
        
        allCustomers = [];
        if (retailRes && retailRes.success && retailRes.data) {
            allCustomers = allCustomers.concat(retailRes.data.map(c => ({...c, customer_type: 'retail'})));
        }
        if (commercialRes && commercialRes.success && commercialRes.data) {
            allCustomers = allCustomers.concat(commercialRes.data.map(c => ({...c, customer_type: 'commercial'})));
        }
    } catch (error) {
        console.error('خطأ في تحميل العملاء:', error);
    }
}

// Load Shop Settings
async function loadShopSettings() {
    try {
        const response = await API.request('settings.php', 'GET');
        if (response && response.success) {
            shopSettings = response.data || {};
        }
    } catch (error) {
        console.error('خطأ في تحميل إعدادات المتجر:', error);
    }
}

// Load All Products
async function loadAllProducts() {
    try {
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="pos-loading"><i class="bi bi-arrow-repeat"></i> جاري التحميل...</div>';
        }
        
        // Load all product types in parallel
        const [sparePartsRes, accessoriesRes, phonesRes] = await Promise.all([
            API.request('inventory.php?type=spare_parts', 'GET'),
            API.request('inventory.php?type=accessories', 'GET'),
            API.request('inventory.php?type=phones', 'GET')
        ]);
        
        allProducts = [];
        
        // Process spare parts
        if (sparePartsRes && sparePartsRes.success && sparePartsRes.data) {
            sparePartsRes.data.forEach(part => {
                allProducts.push({
                    id: part.id,
                    name: `${part.brand} ${part.model}`,
                    type: 'spare_part',
                    price: parseFloat(part.selling_price || 0),
                    image: part.image || '',
                    quantity: 1, // For spare parts, we don't track quantity in the main table
                    brand: part.brand,
                    model: part.model
                });
            });
        }
        
        // Process accessories
        if (accessoriesRes && accessoriesRes.success && accessoriesRes.data) {
            accessoriesRes.data.forEach(accessory => {
                allProducts.push({
                    id: accessory.id,
                    name: accessory.name,
                    type: 'accessory',
                    price: parseFloat(accessory.selling_price || 0),
                    image: accessory.image || '',
                    quantity: parseInt(accessory.quantity || 0),
                    accessoryType: accessory.type
                });
            });
        }
        
        // Process phones
        if (phonesRes && phonesRes.success && phonesRes.data) {
            phonesRes.data.forEach(phone => {
                allProducts.push({
                    id: phone.id,
                    name: `${phone.brand} ${phone.model}`,
                    type: 'phone',
                    price: parseFloat(phone.selling_price || 0),
                    image: phone.image || '',
                    quantity: 1, // Phones are usually unique items
                    brand: phone.brand,
                    model: phone.model
                });
            });
        }
        
        filteredProducts = [...allProducts];
        
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
        showMessage('حدث خطأ في تحميل المنتجات', 'error');
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="pos-loading">حدث خطأ في تحميل المنتجات</div>';
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Category tabs
    const categoryTabs = document.querySelectorAll('.pos-tab');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            currentCategory = this.dataset.category || 'all';
            
            // Update active tab
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Filter and render products
            filterProducts();
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchQuery = this.value.trim().toLowerCase();
                filterProducts();
            }, 300);
        });
    }
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchQuery = searchInput.value.trim().toLowerCase();
                filterProducts();
            }
        });
    }
    
    // Clear cart button
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (cart.length > 0 && confirm('هل أنت متأكد من مسح السلة؟')) {
                cart = [];
                updateCartDisplay();
                showMessage('تم مسح السلة', 'success');
            }
        });
    }
    
    // Pay button
    const payBtn = document.getElementById('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', function() {
            if (cart.length > 0) {
                openPaymentModal();
            }
        });
    }
    
    // Payment modal
    const paymentModal = document.getElementById('paymentModal');
    const closePaymentModal = document.getElementById('closePaymentModal');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    
    if (closePaymentModal) {
        closePaymentModal.addEventListener('click', closePaymentModalFunc);
    }
    
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closePaymentModalFunc);
    }
    
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', processPayment);
    }
    
    // Invoice modal
    const invoiceModal = document.getElementById('invoiceModal');
    const closeInvoiceModal = document.getElementById('closeInvoiceModal');
    const printInvoiceBtn = document.getElementById('printInvoiceBtn');
    
    if (closeInvoiceModal) {
        closeInvoiceModal.addEventListener('click', closeInvoiceModalFunc);
    }
    
    if (printInvoiceBtn) {
        printInvoiceBtn.addEventListener('click', printInvoice);
    }
    
    // Discount and tax inputs
    const discountInput = document.getElementById('discountInput');
    const taxInput = document.getElementById('taxInput');
    
    if (discountInput) {
        discountInput.addEventListener('input', updateCartSummary);
    }
    
    if (taxInput) {
        taxInput.addEventListener('input', updateCartSummary);
    }
    
    // Close modals on outside click
    if (paymentModal) {
        paymentModal.addEventListener('click', function(e) {
            if (e.target === paymentModal) {
                closePaymentModalFunc();
            }
        });
    }
    
    if (invoiceModal) {
        invoiceModal.addEventListener('click', function(e) {
            if (e.target === invoiceModal) {
                closeInvoiceModalFunc();
            }
        });
    }
}

// Filter Products
function filterProducts() {
    filteredProducts = allProducts.filter(product => {
        // Category filter
        if (currentCategory !== 'all') {
            const typeMap = {
                'spare_parts': 'spare_part',
                'accessories': 'accessory',
                'phones': 'phone'
            };
            if (product.type !== typeMap[currentCategory]) {
                return false;
            }
        }
        
        // Search filter
        if (searchQuery) {
            const searchText = `${product.name} ${product.brand || ''} ${product.model || ''}`.toLowerCase();
            if (!searchText.includes(searchQuery)) {
                return false;
            }
        }
        
        return true;
    });
    
    renderProducts();
}

// Render Products
function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<div class="pos-loading">لا توجد منتجات</div>';
        return;
    }
    
    // Batch DOM updates
    const fragment = document.createDocumentFragment();
    
    filteredProducts.forEach(product => {
        const card = createProductCard(product);
        fragment.appendChild(card);
    });
    
    productsGrid.innerHTML = '';
    productsGrid.appendChild(fragment);
}

// Create Product Card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'pos-product-card';
    
    const isOutOfStock = product.quantity === 0;
    if (isOutOfStock) {
        card.classList.add('out-of-stock');
    }
    
    // تحديد نوع البطاقة حسب نوع المنتج
    let badgeText = '';
    let badgeClass = '';
    if (product.type === 'spare_part') {
        badgeText = 'قطعة غيار';
        badgeClass = '';
    } else if (product.type === 'accessory') {
        badgeText = 'إكسسوار';
        badgeClass = '';
    } else if (product.type === 'phone') {
        badgeText = 'هاتف';
        badgeClass = '';
    }
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'pos-product-image-container';
    
    if (product.image && product.image.trim() !== '') {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.name;
        img.className = 'pos-product-image';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = function() {
            // استبدال الصورة المكسورة بـ placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'pos-product-image-placeholder';
            placeholder.innerHTML = '<i class="bi bi-image"></i>';
            this.parentElement.replaceChild(placeholder, this);
        };
        img.onload = function() {
            // التأكد من أن الصورة تم تحميلها بشكل صحيح
            if (this.naturalWidth === 0 || this.naturalHeight === 0) {
                this.onerror();
            }
        };
        imageContainer.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pos-product-image-placeholder';
        placeholder.innerHTML = '<i class="bi bi-image"></i>';
        imageContainer.appendChild(placeholder);
    }
    
    // Badge
    if (badgeText) {
        const badge = document.createElement('div');
        badge.className = 'pos-product-badge';
        badge.textContent = badgeText;
        imageContainer.appendChild(badge);
    }
    
    // Out of stock badge
    if (isOutOfStock) {
        const stockBadge = document.createElement('div');
        stockBadge.className = 'pos-product-badge out-of-stock';
        stockBadge.textContent = 'غير متوفر';
        imageContainer.appendChild(stockBadge);
    }
    
    // Content
    const content = document.createElement('div');
    content.className = 'pos-product-content';
    
    const name = document.createElement('div');
    name.className = 'pos-product-name';
    name.textContent = product.name;
    content.appendChild(name);
    
    // Product info (price and quantity)
    const info = document.createElement('div');
    info.className = 'pos-product-info';
    
    const price = document.createElement('div');
    price.className = 'pos-product-price';
    price.textContent = formatPrice(product.price);
    info.appendChild(price);
    
    const quantity = document.createElement('div');
    quantity.className = 'pos-product-quantity';
    
    if (isOutOfStock) {
        quantity.classList.add('out-of-stock');
        quantity.innerHTML = '<i class="bi bi-x-circle"></i> غير متوفر';
    } else if (product.quantity > 0 && product.quantity <= 5) {
        quantity.classList.add('low-stock');
        quantity.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${product.quantity}`;
    } else {
        quantity.classList.add('in-stock');
        quantity.innerHTML = `<i class="bi bi-check-circle"></i> ${product.quantity}`;
    }
    
    info.appendChild(quantity);
    content.appendChild(info);
    
    // Add button (appears on hover)
    if (!isOutOfStock) {
        const addBtn = document.createElement('button');
        addBtn.className = 'pos-product-add-btn';
        addBtn.innerHTML = '<i class="bi bi-plus-lg"></i>';
        addBtn.title = 'إضافة للسلة';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(product);
        });
        card.appendChild(addBtn);
    }
    
    // Append elements
    card.appendChild(imageContainer);
    card.appendChild(content);
    
    // Click to add (only if in stock)
    if (!isOutOfStock) {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the add button
            if (!e.target.closest('.pos-product-add-btn')) {
                addToCart(product);
            }
        });
    }
    
    return card;
}

// Add to Cart
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id && item.type === product.type);
    
    if (existingItem) {
        // Check quantity limit
        if (product.quantity > 0 && existingItem.quantity >= product.quantity) {
            showMessage('الكمية المتاحة محدودة', 'error');
            return;
        }
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            type: product.type,
            unitPrice: product.price,
            quantity: 1,
            totalPrice: product.price,
            image: product.image
        });
    }
    
    updateCartDisplay();
    showMessage('تم إضافة المنتج للسلة', 'success');
}

// Remove from Cart
function removeFromCart(index) {
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        updateCartDisplay();
        showMessage('تم حذف المنتج من السلة', 'success');
    }
}

// Update Quantity in Cart
function updateCartQuantity(index, change) {
    if (index >= 0 && index < cart.length) {
        const item = cart[index];
        const newQuantity = item.quantity + change;
        
        if (newQuantity <= 0) {
            removeFromCart(index);
            return;
        }
        
        // Check if product still exists and has quantity
        const product = allProducts.find(p => p.id === item.id && p.type === item.type);
        if (product && product.quantity > 0 && newQuantity > product.quantity) {
            showMessage('الكمية المتاحة محدودة', 'error');
            return;
        }
        
        item.quantity = newQuantity;
        item.totalPrice = item.quantity * item.unitPrice;
        updateCartDisplay();
    }
}

// Update Cart Display
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="pos-cart-empty"><i class="bi bi-cart-x"></i><p>السلة فارغة</p></div>';
        const payBtn = document.getElementById('payBtn');
        if (payBtn) {
            payBtn.disabled = true;
        }
        updateCartSummary();
        return;
    }
    
    // Batch DOM updates
    const fragment = document.createDocumentFragment();
    
    cart.forEach((item, index) => {
        const cartItem = document.createElement('div');
        cartItem.className = 'pos-cart-item';
        
        const imageHtml = item.image
            ? `<img src="${item.image}" alt="${item.name}" class="pos-cart-item-image" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'pos-cart-item-image-placeholder\\'><i class=\\'bi bi-image\\'></i></div>'">`
            : `<div class="pos-cart-item-image-placeholder"><i class="bi bi-image"></i></div>`;
        
        cartItem.innerHTML = `
            ${imageHtml}
            <div class="pos-cart-item-details">
                <div class="pos-cart-item-name">${item.name}</div>
                <div class="pos-cart-item-controls">
                    <button class="btn-quantity" onclick="updateCartQuantity(${index}, -1)">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="btn-quantity" onclick="updateCartQuantity(${index}, 1)">+</button>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                <div class="pos-cart-item-price">${formatPrice(item.totalPrice)}</div>
                <button class="btn-remove-item" onclick="removeFromCart(${index})" title="حذف">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        fragment.appendChild(cartItem);
    });
    
    cartItems.innerHTML = '';
    cartItems.appendChild(fragment);
    
    const payBtn = document.getElementById('payBtn');
    if (payBtn) {
        payBtn.disabled = false;
    }
    
    updateCartSummary();
}

// Update Cart Summary
function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    
    const discountInput = document.getElementById('discountInput');
    const taxInput = document.getElementById('taxInput');
    const discountDisplay = document.getElementById('discountDisplay');
    const taxDisplay = document.getElementById('taxDisplay');
    const subtotalDisplay = document.getElementById('subtotal');
    const totalDisplay = document.getElementById('totalAmount');
    
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const tax = taxInput ? parseFloat(taxInput.value) || 0 : 0;
    
    const finalAmount = subtotal - discount + tax;
    
    if (subtotalDisplay) {
        subtotalDisplay.textContent = formatPrice(subtotal);
    }
    
    if (discountDisplay) {
        discountDisplay.textContent = formatPrice(discount);
    }
    
    if (taxDisplay) {
        taxDisplay.textContent = formatPrice(tax);
    }
    
    if (totalDisplay) {
        totalDisplay.textContent = formatPrice(Math.max(0, finalAmount));
    }
}

// Select Customer Type
function selectCustomerType(type) {
    currentCustomerType = type;
    selectedCustomerId = null;
    
    // Update buttons
    document.querySelectorAll('.btn-customer-type').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.btn-customer-type[data-type="${type}"]`).classList.add('active');
    
    // Show/hide shop name field
    const shopNameGroup = document.getElementById('shopNameGroup');
    if (shopNameGroup) {
        shopNameGroup.style.display = type === 'commercial' ? 'block' : 'none';
        if (type === 'commercial') {
            document.getElementById('shopNameInput').required = true;
        } else {
            document.getElementById('shopNameInput').required = false;
        }
    }
    
    // Load and display customers for this type
    loadCustomersForType(type);
    
    // Reset form
    resetCustomerForm();
}

// Load Customers for Type
function loadCustomersForType(type) {
    const select = document.getElementById('existingCustomerSelect');
    if (!select) return;
    
    const customers = allCustomers.filter(c => c.customer_type === type);
    
    select.innerHTML = '<option value="">-- اختر عميل --</option>';
    customers.forEach(customer => {
        const displayName = customer.customer_type === 'commercial' && customer.shop_name 
            ? `${customer.name} - ${customer.shop_name}`
            : customer.name;
        select.innerHTML += `<option value="${customer.id}">${displayName} - ${customer.phone}</option>`;
    });
    
    // Show existing customers group
    const existingGroup = document.getElementById('existingCustomersGroup');
    if (existingGroup) {
        existingGroup.style.display = customers.length > 0 ? 'block' : 'none';
    }
}

// Select Existing Customer
function selectExistingCustomer(customerId) {
    if (!customerId) {
        resetCustomerForm();
        return;
    }
    
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;
    
    selectedCustomerId = customerId;
    
    // Fill form with customer data
    document.getElementById('customerNameInput').value = customer.name || '';
    document.getElementById('customerPhoneInput').value = customer.phone || '';
    document.getElementById('customerAddressInput').value = customer.address || '';
    
    if (customer.customer_type === 'commercial') {
        document.getElementById('shopNameInput').value = customer.shop_name || '';
        document.getElementById('shopNameGroup').style.display = 'block';
    }
    
    // Hide new customer form
    document.getElementById('newCustomerForm').style.display = 'none';
}

// Show New Customer Form
function showNewCustomerForm() {
    selectedCustomerId = null;
    resetCustomerForm();
    document.getElementById('existingCustomerSelect').value = '';
    document.getElementById('newCustomerForm').style.display = 'block';
}

// Reset Customer Form
function resetCustomerForm() {
    document.getElementById('customerNameInput').value = '';
    document.getElementById('customerPhoneInput').value = '';
    document.getElementById('customerAddressInput').value = '';
    document.getElementById('shopNameInput').value = '';
    document.getElementById('newCustomerForm').style.display = 'block';
}

// Open Payment Modal
function openPaymentModal() {
    const paymentModal = document.getElementById('paymentModal');
    if (!paymentModal) return;
    
    // Reset to default
    currentCustomerType = 'retail';
    selectedCustomerId = null;
    selectCustomerType('retail');
    
    // Reset inputs
    resetCustomerForm();
    
    // Update modal summary
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountInput = document.getElementById('discountInput');
    const taxInput = document.getElementById('taxInput');
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const tax = taxInput ? parseFloat(taxInput.value) || 0 : 0;
    const finalAmount = subtotal - discount + tax;
    
    const modalSubtotal = document.getElementById('modalSubtotal');
    const modalDiscount = document.getElementById('modalDiscount');
    const modalTax = document.getElementById('modalTax');
    const modalTotal = document.getElementById('modalTotal');
    
    if (modalSubtotal) modalSubtotal.textContent = formatPrice(subtotal);
    if (modalDiscount) modalDiscount.textContent = formatPrice(discount);
    if (modalTax) modalTax.textContent = formatPrice(tax);
    if (modalTotal) modalTotal.textContent = formatPrice(Math.max(0, finalAmount));
    
    paymentModal.classList.add('active');
}

// Close Payment Modal
function closePaymentModalFunc() {
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.classList.remove('active');
    }
}

// Process Payment
async function processPayment() {
    try {
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> جاري المعالجة...';
        }
        
        const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const discountInput = document.getElementById('discountInput');
        const taxInput = document.getElementById('taxInput');
        const customerNameInput = document.getElementById('customerNameInput');
        const customerPhoneInput = document.getElementById('customerPhoneInput');
        
        // التحقق من بيانات العميل (مطلوبة)
        const customerName = customerNameInput ? customerNameInput.value.trim() : '';
        const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
        
        if (!customerName) {
            showMessage('اسم العميل مطلوب', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            if (customerNameInput) {
                customerNameInput.focus();
            }
            return;
        }
        
        if (!customerPhone) {
            showMessage('رقم هاتف العميل مطلوب', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            if (customerPhoneInput) {
                customerPhoneInput.focus();
            }
            return;
        }
        
        // التحقق من صحة رقم الهاتف (يجب أن يكون على الأقل 8 أرقام)
        const phoneDigits = customerPhone.replace(/\D/g, ''); // إزالة كل ما عدا الأرقام
        if (phoneDigits.length < 8) {
            showMessage('رقم الهاتف غير صحيح (يجب أن يكون 8 أرقام على الأقل)', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            if (customerPhoneInput) {
                customerPhoneInput.focus();
            }
            return;
        }
        
        const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const tax = taxInput ? parseFloat(taxInput.value) || 0 : 0;
        const finalAmount = subtotal - discount + tax;
        
        // Get shop name for commercial customers
        const shopNameInput = document.getElementById('shopNameInput');
        const shopName = shopNameInput ? shopNameInput.value.trim() : '';
        const addressInput = document.getElementById('customerAddressInput');
        const address = addressInput ? addressInput.value.trim() : '';
        
        // Validate shop name for commercial customers
        if (currentCustomerType === 'commercial' && !selectedCustomerId && !shopName) {
            showMessage('اسم المحل مطلوب للعملاء التجاريين', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            if (shopNameInput) {
                shopNameInput.focus();
            }
            return;
        }
        
        // Save or update customer if new
        let customerId = selectedCustomerId;
        if (!customerId) {
            // Create new customer
            const customerData = {
                name: customerName,
                phone: customerPhone,
                address: address,
                customer_type: currentCustomerType,
                shop_name: currentCustomerType === 'commercial' ? shopName : null
            };
            
            const customerRes = await API.addCustomer(customerData);
            if (customerRes && customerRes.success) {
                customerId = customerRes.data.id;
                // Add to local list
                allCustomers.push(customerRes.data);
            }
        }
        
        const saleData = {
            items: cart.map(item => ({
                item_type: item.type === 'spare_part' ? 'spare_part' : item.type === 'accessory' ? 'accessory' : 'phone',
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice
            })),
            total_amount: subtotal,
            discount: discount,
            tax: tax,
            final_amount: Math.max(0, finalAmount),
            customer_id: customerId,
            customer_name: customerName,
            customer_phone: customerPhone
        };
        
        const response = await API.request('sales.php', 'POST', saleData);
        
        if (response && response.success) {
            closePaymentModalFunc();
            showInvoice(response.data);
            cart = [];
            updateCartDisplay();
            
            // إعادة تحميل المنتجات لتحديث الكميات
            await loadAllProducts();
            filterProducts();
            
            showMessage('تم إتمام عملية البيع بنجاح', 'success');
        } else {
            showMessage(response?.message || 'حدث خطأ في معالجة الدفع', 'error');
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الدفع:', error);
        showMessage('حدث خطأ في معالجة الدفع', 'error');
    } finally {
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
        }
    }
}

// Show Invoice
function showInvoice(saleData) {
    const invoiceModal = document.getElementById('invoiceModal');
    const invoiceBody = document.getElementById('invoiceBody');
    
    if (!invoiceModal || !invoiceBody) return;
    
    const shopName = shopSettings.shop_name || 'المتجر';
    const shopPhone = shopSettings.shop_phone || '';
    const shopAddress = shopSettings.shop_address || '';
    const shopLogo = shopSettings.shop_logo || '';
    const currency = shopSettings.currency || 'ج.م';
    const branchName = 'الهانوفيل';
    const salesPersonName = saleData.created_by_name || 'غير محدد';
    
    // Generate unique barcode for this invoice
    const barcodeData = saleData.sale_number || saleData.id || Date.now().toString();
    let barcodeImage = '';
    if (typeof window.barcodeGenerator !== 'undefined') {
        barcodeImage = window.barcodeGenerator.generateBarcode(barcodeData, 250, 80);
    }
    
    // Format date and time in 12-hour format with AM/PM
    const formattedDateTime = formatDateTime12Hour(saleData.created_at || new Date().toISOString());
    
    // Get logo - try multiple sources
    let logoHtml = '';
    // مسارات اللوجو الاحتياطية (نسبية من المجلد الرئيسي)
    const defaultLogoPath = 'vertopal.com_photo_5922357566287580087_y.png';  // اللوجو PNG في المجلد الرئيسي
    const fallbackLogoPath1 = 'photo_5922357566287580087_y.jpg';             // اللوجو JPG القديم
    const fallbackLogoPath2 = 'icons/icon-192x192.png';                      // أيقونة من مجلد الأيقونات
    
    if (shopLogo && shopLogo.trim() !== '') {
        // استخدام لوجو المتجر من الإعدادات مع مسارات احتياطية
        logoHtml = `<img src="${shopLogo}" alt="ALAA ZIDAN Logo" class="invoice-logo" onerror="this.onerror=null; this.src='${defaultLogoPath}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath1}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath2}'; this.onerror=function(){this.style.display='none';};};};">`;
    } else {
        // استخدام اللوجو الافتراضي PNG مع مسارات احتياطية
        logoHtml = `<img src="${defaultLogoPath}" alt="ALAA ZIDAN Logo" class="invoice-logo" onerror="this.onerror=null; this.src='${fallbackLogoPath1}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath2}'; this.onerror=function(){this.style.display='none';};};">`;
    }
    
    const invoiceHtml = `
        <div class="invoice-wrapper">
            <!-- Logo Section - في البداية -->
            <div class="invoice-logo-section">
                ${logoHtml}
            </div>
            
            <!-- Shop Info -->
            <div class="invoice-header">
                <div class="invoice-shop-name">${shopName}</div>
                <div class="invoice-shop-info">
                    ${shopAddress ? `<div><i class="bi bi-geo-alt-fill"></i> ${shopAddress}</div>` : ''}
                    ${shopPhone ? `<div><i class="bi bi-telephone-fill"></i> ${shopPhone}</div>` : ''}
                </div>
            </div>
            
            <!-- Invoice Details -->
            <div class="invoice-details">
                <div class="invoice-details-left">
                    <div><strong>العميل:</strong> ${saleData.customer_name || ''}</div>
                    <div><strong>الهاتف:</strong> ${saleData.customer_phone || ''}</div>
                </div>
                <div class="invoice-details-right">
                    <div><strong>رقم الفاتورة:</strong> ${saleData.sale_number || ''}</div>
                    <div><strong>التاريخ:</strong> ${formattedDateTime}</div>
                </div>
            </div>
            
            <!-- Branch and Sales Person -->
            <div class="invoice-extra-info">
                <div><strong>الفرع:</strong> ${branchName}</div>
                <div><strong>المسؤول عن البيع:</strong> ${salesPersonName}</div>
            </div>
            
            <!-- Items Table -->
            <table class="invoice-items-table">
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
                            <td>${item.item_name}</td>
                            <td>${item.quantity}</td>
                            <td>${formatPrice(item.unit_price)} ${currency}</td>
                            <td>${formatPrice(item.total_price)} ${currency}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Summary -->
            <div class="invoice-summary">
                <div class="summary-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatPrice(saleData.total_amount)} ${currency}</span>
                </div>
                ${saleData.discount > -1 ? `
                    <div class="summary-row">
                        <span>الخصم:</span>
                        <span>- ${formatPrice(saleData.discount)} ${currency}</span>
                    </div>
                ` : ''}
               
                <hr>
                <div class="summary-row total">
                    <span>الإجمالي:</span>
                    <span>${formatPrice(saleData.final_amount)} ${currency}</span>
                </div>
            </div>
            
            <!-- Barcode -->
            ${barcodeImage ? `
                <div class="invoice-barcode">
                    <img src="${barcodeImage}" alt="Barcode ${barcodeData}">
                    <div class="barcode-text">${barcodeData}</div>
                </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="invoice-footer">
                <div>شكراً لزيارتك</div>
            </div>
        </div>
    `;
    
    invoiceBody.innerHTML = invoiceHtml;
    invoiceModal.classList.add('active');
    
    // Auto-print after showing invoice
    setTimeout(() => {
        printInvoice();
    }, 500);
}

// Close Invoice Modal
function closeInvoiceModalFunc() {
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.classList.remove('active');
    }
}

// Print Invoice
function printInvoice() {
    // Ensure modal is visible for printing
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.classList.add('active');
    }
    
    // Wait a bit for rendering, then print
    setTimeout(() => {
        window.print();
    }, 100);
}

// Format Price (returns only number, currency should be added separately)
function formatPrice(price) {
    return parseFloat(price || 0).toFixed(2);
}

// Format DateTime
function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// Format DateTime in 12-hour format with AM/PM
function formatDateTime12Hour(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const hoursStr = String(hours).padStart(2, '0');
        
        return `${year}/${month}/${day} ${hoursStr}:${minutes} ${ampm}`;
    } catch (error) {
        return dateString;
    }
}

// Expose functions to global scope for onclick handlers
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

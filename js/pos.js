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
                // حساب إجمالي الكمية من القطع الفرعية
                const totalQuantity = (part.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                
                // التأكد من أن items موجودة وليست null
                const items = Array.isArray(part.items) ? part.items : [];
                
                allProducts.push({
                    id: part.id,
                    name: `${part.brand} ${part.model}`,
                    type: 'spare_part',
                    price: parseFloat(part.selling_price || 0),
                    image: part.image || '',
                    quantity: totalQuantity, // إجمالي الكمية من القطع الفرعية
                    brand: part.brand,
                    model: part.model,
                    items: items // حفظ القطع الفرعية
                });
                
                // سجل للتأكد من تحميل القطع الفرعية
                if (items.length > 0) {
                    console.log(`تم تحميل قطعة غيار: ${part.brand} ${part.model} مع ${items.length} قطعة فرعية`);
                }
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
    
    // إخفاء السعر لقطع الغيار (السعر يظهر في النموذج المنبثق للقطع الفرعية)
    if (product.type !== 'spare_part') {
        const price = document.createElement('div');
        price.className = 'pos-product-price';
        const currency = (shopSettings && shopSettings.currency) ? shopSettings.currency : 'ج.م';
        price.textContent = `${formatPrice(product.price)} ${currency}`;
        info.appendChild(price);
    }
    
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
            // إذا كانت قطعة غيار ولديها قطع فرعية، اعرض popup اختيار
            if (product.type === 'spare_part' && product.items && product.items.length > 0) {
                console.log('فتح popup اختيار القطع الفرعية للمنتج:', product.name, 'عدد القطع الفرعية:', product.items.length);
                openSparePartItemsModal(product);
            } else {
                addToCart(product);
            }
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
                // إذا كانت قطعة غيار ولديها قطع فرعية، اعرض popup اختيار
                if (product.type === 'spare_part' && product.items && product.items.length > 0) {
                    console.log('فتح popup اختيار القطع الفرعية للمنتج:', product.name, 'عدد القطع الفرعية:', product.items.length);
                    openSparePartItemsModal(product);
                } else {
                    addToCart(product);
                }
            }
        });
    }
    
    return card;
}

// Open Spare Part Items Modal
function openSparePartItemsModal(product) {
    // إنشاء النموذج المنبثق إذا لم يكن موجوداً
    let modalInstance = document.getElementById('sparePartItemsModal');
    if (!modalInstance) {
        createSparePartItemsModal();
        modalInstance = document.getElementById('sparePartItemsModal');
    }
    
    if (!modalInstance) {
        console.error('فشل في إنشاء النموذج المنبثق');
        showMessage('حدث خطأ في عرض القطع الفرعية', 'error');
        return;
    }
    
    // تعبئة بيانات المنتج
    document.getElementById('sparePartItemsProductName').textContent = product.name;
    document.getElementById('sparePartItemsProductId').value = product.id;
    
    // عرض القطع الفرعية المتوفرة (الكمية > 0)
    const availableItems = (product.items || []).filter(item => (parseInt(item.quantity) || 0) > 0);
    const itemsContainer = document.getElementById('sparePartItemsList');
    
    console.log('المنتج:', product.name, 'إجمالي القطع الفرعية:', (product.items || []).length, 'القطع المتوفرة:', availableItems.length);
    
    if (!availableItems || availableItems.length === 0) {
        itemsContainer.innerHTML = '<div class="pos-loading" style="text-align: center; padding: 20px;">لا توجد قطع فرعية متوفرة</div>';
        modalInstance.classList.add('active');
        return;
    }
    
    // قائمة أنواع قطع الغيار
    const sparePartTypes = {
        'screen': 'شاشة',
        'battery': 'بطارية',
        'rear_camera': 'كاميرا خلفية',
        'front_camera': 'كاميرا أمامية',
        'charging_port': 'فلاتة شحن',
        'flex_connector': 'فلاتة ربط',
        'power_flex': 'فلاتة باور',
        'motherboard': 'بوردة',
        'frame': 'فريم',
        'housing': 'هاوسنج',
        'back_cover': 'ظهر',
        'lens': 'عدسات',
        'ic': 'IC',
        'external_buttons': 'أزرار خارجية',
        'earpiece': 'سماعة مكالمات',
        'speaker': 'علبة جرس',
        'network_wire': 'واير شبكة',
        'network_flex': 'فلاتة شبكة',
        'other': 'ملحقات أخرى'
    };
    
    itemsContainer.innerHTML = availableItems.map((item, index) => {
        const itemTypeName = sparePartTypes[item.item_type] || item.item_type || 'غير محدد';
        const itemQuantity = parseInt(item.quantity) || 0;
        const itemPrice = parseFloat(item.selling_price || item.price || 0);
        
        return `
            <div class="spare-part-item-option" data-item-id="${item.id}" data-item-type="${item.item_type}" data-item-price="${itemPrice}" data-item-quantity="${itemQuantity}">
                <div class="spare-part-item-info">
                    <div class="spare-part-item-name">${itemTypeName}</div>
                    <div class="spare-part-item-details">
                        <span class="spare-part-item-price"><strong>${formatPrice(itemPrice)} ج.م</strong></span>
                        <span class="spare-part-item-stock">المتاح: ${itemQuantity}</span>
                    </div>
                </div>
                <div class="spare-part-item-quantity-control">
                    <button type="button" class="btn-quantity" onclick="decreaseSparePartItemQuantity(${index})">-</button>
                    <input type="number" id="sparePartItemQty_${index}" class="spare-part-item-qty-input" value="1" min="1" max="${itemQuantity}" onchange="updateSparePartItemQuantity(${index}, ${itemQuantity})">
                    <button type="button" class="btn-quantity" onclick="increaseSparePartItemQuantity(${index}, ${itemQuantity})">+</button>
                </div>
                <button type="button" class="btn-add-spare-part-item" onclick="addSparePartItemToCart(${index})">
                    <i class="bi bi-cart-plus"></i> إضافة
                </button>
            </div>
        `;
    }).join('');
    
    modalInstance.classList.add('active');
}

// Create Spare Part Items Modal
function createSparePartItemsModal() {
    const modal = document.createElement('div');
    modal.id = 'sparePartItemsModal';
    modal.className = 'pos-modal';
    modal.innerHTML = `
        <div class="pos-modal-content">
            <div class="pos-modal-header">
                <h3>اختر قطعة من قطع الغيار</h3>
                <button class="btn-close-modal" onclick="closeSparePartItemsModal()">
                    <i class="bi bi-x"></i>
                </button>
            </div>
            <div class="pos-modal-body">
                <div class="spare-part-items-product-info">
                    <strong id="sparePartItemsProductName"></strong>
                </div>
                <input type="hidden" id="sparePartItemsProductId">
                <div id="sparePartItemsList" class="spare-part-items-list">
                    <!-- القطع الفرعية ستُعرض هنا -->
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // إغلاق عند الضغط خارج النموذج
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeSparePartItemsModal();
        }
    });
}

// Close Spare Part Items Modal
function closeSparePartItemsModal() {
    const modal = document.getElementById('sparePartItemsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Spare Part Item Quantity Controls
function decreaseSparePartItemQuantity(index) {
    const input = document.getElementById(`sparePartItemQty_${index}`);
    if (input) {
        const currentValue = parseInt(input.value) || 1;
        if (currentValue > 1) {
            input.value = currentValue - 1;
        }
    }
}

function increaseSparePartItemQuantity(index, maxQuantity) {
    const input = document.getElementById(`sparePartItemQty_${index}`);
    if (input) {
        const currentValue = parseInt(input.value) || 1;
        if (currentValue < maxQuantity) {
            input.value = currentValue + 1;
        } else {
            showMessage('الكمية المتاحة محدودة', 'error');
        }
    }
}

function updateSparePartItemQuantity(index, maxQuantity) {
    const input = document.getElementById(`sparePartItemQty_${index}`);
    if (input) {
        const value = parseInt(input.value) || 1;
        if (value < 1) {
            input.value = 1;
        } else if (value > maxQuantity) {
            input.value = maxQuantity;
            showMessage('الكمية المتاحة محدودة', 'error');
        }
    }
}

// Add Spare Part Item to Cart
function addSparePartItemToCart(index) {
    const modal = document.getElementById('sparePartItemsModal');
    if (!modal) return;
    
    const productId = document.getElementById('sparePartItemsProductId').value;
    const product = allProducts.find(p => p.id === productId && p.type === 'spare_part');
    
    if (!product) {
        showMessage('المنتج غير موجود', 'error');
        return;
    }
    
    const itemOption = document.querySelectorAll('.spare-part-item-option')[index];
    if (!itemOption) {
        showMessage('القطعة غير موجودة', 'error');
        return;
    }
    
    const itemId = itemOption.dataset.itemId;
    const itemType = itemOption.dataset.itemType;
    const itemPrice = parseFloat(itemOption.dataset.itemPrice || 0);
    const maxQuantity = parseInt(itemOption.dataset.itemQuantity || 0);
    const quantityInput = document.getElementById(`sparePartItemQty_${index}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    // التحقق من وجود itemId (مطلوب)
    if (!itemId || itemId.trim() === '') {
        console.error('itemId is missing or empty', { itemOption, index });
        showMessage('خطأ: معرف القطعة الفرعية غير موجود', 'error');
        return;
    }
    
    if (quantity < 1) {
        showMessage('الكمية يجب أن تكون على الأقل 1', 'error');
        return;
    }
    
    if (quantity > maxQuantity) {
        showMessage(`الكمية المتاحة: ${maxQuantity}`, 'error');
        return;
    }
    
    // البحث عن القطعة الفرعية في product.items
    const sparePartItem = (product.items || []).find(item => item.id === itemId);
    if (!sparePartItem) {
        console.error('Spare part item not found in product.items', { itemId, productItems: product.items });
        showMessage('القطعة الفرعية غير موجودة', 'error');
        return;
    }
    
    // قائمة أنواع قطع الغيار
    const sparePartTypes = {
        'screen': 'شاشة',
        'battery': 'بطارية',
        'rear_camera': 'كاميرا خلفية',
        'front_camera': 'كاميرا أمامية',
        'charging_port': 'فلاتة شحن',
        'flex_connector': 'فلاتة ربط',
        'power_flex': 'فلاتة باور',
        'motherboard': 'بوردة',
        'frame': 'فريم',
        'housing': 'هاوسنج',
        'back_cover': 'ظهر',
        'lens': 'عدسات',
        'ic': 'IC',
        'external_buttons': 'أزرار خارجية',
        'earpiece': 'سماعة مكالمات',
        'speaker': 'علبة جرس',
        'network_wire': 'واير شبكة',
        'network_flex': 'فلاتة شبكة',
        'other': 'ملحقات أخرى'
    };
    
    const itemTypeName = sparePartTypes[itemType] || itemType || 'غير محدد';
    const itemName = `${product.name} - ${itemTypeName}`;
    
    // التحقق من عدم وجود نفس القطعة الفرعية في السلة
    const existingItem = cart.find(item => 
        item.type === product.type && 
        item.spare_part_item_id === itemId
    );
    
    if (existingItem) {
        // إذا كانت القطعة موجودة، تحديث الكمية بدلاً من إضافة جديدة
        const newQuantity = existingItem.quantity + quantity;
        const availableQuantity = maxQuantity;
        
        if (newQuantity > availableQuantity) {
            showMessage(`الكمية المتاحة: ${availableQuantity}، الموجود في السلة: ${existingItem.quantity}`, 'error');
            return;
        }
        
        existingItem.quantity = newQuantity;
        existingItem.totalPrice = existingItem.unitPrice * newQuantity;
        updateCartDisplay();
        closeSparePartItemsModal();
        showMessage('تم تحديث الكمية في السلة', 'success');
        return;
    }
    
    // إضافة للسلة مع معلومات القطعة الفرعية
    const cartItem = {
        id: product.id,
        name: itemName,
        type: product.type,
        unitPrice: itemPrice,
        quantity: quantity,
        totalPrice: itemPrice * quantity,
        image: product.image,
        spare_part_item_id: itemId, // ID القطعة الفرعية (مطلوب)
        spare_part_item_type: itemType
    };
    
    // التحقق النهائي من وجود spare_part_item_id
    if (!cartItem.spare_part_item_id) {
        console.error('spare_part_item_id is missing before adding to cart', cartItem);
        showMessage('خطأ: معرف القطعة الفرعية غير موجود', 'error');
        return;
    }
    
    console.log('Adding spare part item to cart:', {
        productName: product.name,
        itemType: itemType,
        itemId: itemId,
        quantity: quantity,
        spare_part_item_id: cartItem.spare_part_item_id
    });
    
    cart.push(cartItem);
    
    updateCartDisplay();
    closeSparePartItemsModal();
    showMessage('تم إضافة المنتج للسلة', 'success');
}

// Add to Cart
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id && item.type === product.type && !item.spare_part_item_id);
    
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
        
        // التحقق من نوع الصورة (base64 أو URL)
        // معالجة الصور base64
        let imageSrc = item.image;
        let isBase64 = false;
        
        if (item.image) {
            // التحقق من base64 (قد يبدأ بـ data: أو مباشرة بـ base64 string)
            if (item.image.startsWith('data:')) {
                isBase64 = true;
                imageSrc = item.image;
            } else if (item.image.startsWith('/9j/') || item.image.startsWith('iVBORw0KGgo') || item.image.length > 100) {
                // صورة base64 بدون prefix
                isBase64 = true;
                // محاولة تحديد نوع الصورة
                if (item.image.startsWith('/9j/')) {
                    imageSrc = `data:image/jpeg;base64,${item.image}`;
                } else if (item.image.startsWith('iVBORw0KGgo')) {
                    imageSrc = `data:image/png;base64,${item.image}`;
                } else {
                    // افتراض JPEG
                    imageSrc = `data:image/jpeg;base64,${item.image}`;
                }
            }
        }
        
        const imageHtml = item.image
            ? `<img src="${imageSrc}" 
                     alt="${item.name}" 
                     class="pos-cart-item-image ${isBase64 ? 'base64-image' : ''}" 
                     ${isBase64 ? '' : 'loading="lazy"'} 
                     ${isBase64 ? '' : 'decoding="async"'}
                     onerror="this.onerror=null; this.style.display='none'; const placeholder = document.createElement('div'); placeholder.className='pos-cart-item-image-placeholder'; placeholder.innerHTML='<i class=\\'bi bi-image\\'></i>'; this.parentElement.replaceChild(placeholder, this);"
                     onload="if(!this.classList.contains('base64-image')) this.classList.add('loaded');">`
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
        // التحقق من القائمة المنسدلة أولاً للحصول على customer_id المحدد
        const existingCustomerSelect = document.getElementById('existingCustomerSelect');
        let customerId = selectedCustomerId;
        
        // إذا لم يكن هناك selectedCustomerId، التحقق من القائمة المنسدلة
        if (!customerId && existingCustomerSelect && existingCustomerSelect.value) {
            customerId = existingCustomerSelect.value;
            // تحديث selectedCustomerId أيضاً
            selectedCustomerId = customerId;
        }
        
        if (!customerId) {
            // البحث عن عميل موجود بنفس رقم الهاتف أولاً
            const existingCustomer = allCustomers.find(c => c.phone === customerPhone);
            
            if (existingCustomer) {
                // استخدام العميل الموجود
                customerId = existingCustomer.id;
                // تحديث selectedCustomerId والقائمة المنسدلة
                selectedCustomerId = customerId;
                if (existingCustomerSelect) {
                    existingCustomerSelect.value = customerId;
                }
            } else {
                // Create new customer
                const customerData = {
                    name: customerName,
                    phone: customerPhone,
                    address: address,
                    customer_type: currentCustomerType,
                    shop_name: currentCustomerType === 'commercial' ? shopName : null
                };
                
                const customerRes = await API.addCustomer(customerData);
                if (customerRes && customerRes.success && customerRes.data && customerRes.data.id) {
                    customerId = customerRes.data.id;
                    // Add to local list
                    allCustomers.push(customerRes.data);
                    // تحديث selectedCustomerId
                    selectedCustomerId = customerId;
                } else {
                    showMessage('فشل في إنشاء العميل. يرجى المحاولة مرة أخرى', 'error');
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
                    }
                    return;
                }
            }
        }
        
        // التأكد من وجود customerId قبل المتابعة
        if (!customerId) {
            showMessage('خطأ في ربط العميل بالفاتورة. يرجى المحاولة مرة أخرى', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            return;
        }
        
        // التأكد النهائي من وجود customerId قبل إرسال البيانات
        if (!customerId) {
            showMessage('خطأ في ربط العميل بالفاتورة. يرجى المحاولة مرة أخرى', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            return;
        }
        
        const saleData = {
            items: cart.map(item => {
                const saleItem = {
                    item_type: item.type === 'spare_part' ? 'spare_part' : item.type === 'accessory' ? 'accessory' : 'phone',
                    item_id: item.id,
                    item_name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: item.totalPrice
                };
                
                // إرسال spare_part_item_id فقط إذا كان المنتج من نوع spare_part وكان موجوداً
                if (item.type === 'spare_part' && item.spare_part_item_id) {
                    saleItem.spare_part_item_id = item.spare_part_item_id;
                }
                
                return saleItem;
            }),
            total_amount: subtotal,
            discount: discount,
            tax: tax,
            final_amount: Math.max(0, finalAmount),
            customer_id: customerId, // هذا إلزامي
            customer_name: customerName,
            customer_phone: customerPhone
        };
        
        // Debug: Log sale data
        console.log('Sending sale data:', saleData);
        console.log('Cart items with spare_part_item_id:', cart.map(item => ({
            name: item.name,
            type: item.type,
            spare_part_item_id: item.spare_part_item_id
        })));
        
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
            
            // عرض modal التقييم إذا كان هناك customer_id
            if (customerId && response.data && response.data.id) {
                setTimeout(() => {
                    showRatingModal(customerId, response.data.id);
                }, 1000); // تأخير ثانية واحدة بعد إظهار الفاتورة
            }
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

// دالة مساعدة لإنشاء QR Code باستخدام API خارجي
function generateQRCodeFallback(data) {
    try {
        // استخدام API موثوق لإنشاء QR Code
        const encodedData = encodeURIComponent(data);
        // استخدام qr-server.com API (أكثر موثوقية من Google Charts)
        return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedData}`;
    } catch (error) {
        console.error('خطأ في إنشاء QR Code البديل:', error);
        // استخدام Google Charts API كبديل نهائي
        return `https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=${encodeURIComponent(data)}&choe=UTF-8`;
    }
}

// Show Invoice
async function showInvoice(saleData) {
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
    const whatsappNumber = '01276855966';
    
    // Check if there's a phone product in the sale
    const hasPhoneProduct = (saleData.items || []).some(item => item.item_type === 'phone');
    let phoneData = null;
    
    if (hasPhoneProduct) {
        // Get the first phone product details
        const phoneItem = (saleData.items || []).find(item => item.item_type === 'phone');
        if (phoneItem) {
            // محاولة استخدام بيانات الهاتف من الاستجابة أولاً (إذا تم حفظها قبل الحذف)
            if (phoneItem.phone_data) {
                phoneData = phoneItem.phone_data;
                console.log('تم استخدام بيانات الهاتف من الاستجابة:', phoneData);
            } else if (phoneItem.item_id) {
                // محاولة جلب البيانات من API (في حالة فشل الحفظ السابق)
                try {
                    const phoneRes = await API.request(`inventory.php?type=phones`, 'GET');
                    if (phoneRes && phoneRes.success && phoneRes.data) {
                        phoneData = phoneRes.data.find(p => p.id === phoneItem.item_id);
                        if (phoneData) {
                            console.log('تم جلب بيانات الهاتف من API:', phoneData);
                        } else {
                            console.warn('لم يتم العثور على بيانات الهاتف في API (ربما تم حذفه بالفعل)');
                        }
                    }
                } catch (error) {
                    console.error('خطأ في جلب بيانات الهاتف:', error);
                }
            }
        }
    }
    
    // Generate QR code with full invoice data as JSON with additional random data for realism
    const saleNumber = saleData.sale_number || saleData.id;
    const saleId = saleData.id || '';
    const createdAt = saleData.created_at || new Date().toISOString();
    const timestamp = Math.floor(Date.now() / 1000);
    
    // إنشاء بيانات عشوائية إضافية
    const verificationCode = (saleId + timestamp).split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b, 0).toString(16).toUpperCase().substring(0, 8);
    const transactionId = 'TXN' + String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0');
    const checksum = (saleNumber + (saleData.final_amount || 0) + timestamp).split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b, 0).toString(16).substring(0, 16);
    const shopId = 'SHOP-' + String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    const branchCode = 'BR-' + branchName.split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b, 0).toString(16).toUpperCase().substring(0, 4);
    const paymentMethods = ['cash', 'card', 'bank_transfer'];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const invoiceVersion = '1.0';
    const systemId = 'SYS-' + String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
    
    const invoiceData = {
        invoice_id: saleId,
        invoice_number: saleNumber,
        version: invoiceVersion,
        timestamp: timestamp,
        date: createdAt,
        shop_id: shopId,
        branch_code: branchCode,
        system_id: systemId,
        customer: {
            name: saleData.customer_name || '',
            phone: saleData.customer_phone || '',
            id: saleData.customer_id || null
        },
        amounts: {
            subtotal: saleData.total_amount || 0,
            discount: saleData.discount || 0,
            tax: saleData.tax || 0,
            total: saleData.final_amount || 0,
            currency: currency
        },
        items: (saleData.items || []).map(item => ({
            name: item.item_name,
            type: item.item_type,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
        })),
        payment: {
            method: paymentMethod,
            transaction_id: transactionId,
            status: 'completed',
            processed_at: new Date().toISOString()
        },
        verification: {
            code: verificationCode,
            checksum: checksum,
            hash: (saleNumber + (saleData.final_amount || 0) + timestamp).split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b, 0).toString(16)
        },
        metadata: {
            created_by: salesPersonName,
            branch: branchName,
            items_count: (saleData.items || []).length,
            generated_at: new Date().toISOString(),
            timezone: 'Africa/Cairo'
        }
    };
    
    // إنشاء بيانات QR Code مبسطة (لتقليل الحجم وضمان القراءة)
    const qrCodeData = JSON.stringify({
        invoice_id: saleId,
        invoice_number: saleNumber,
        date: createdAt,
        total: saleData.final_amount || 0,
        currency: currency,
        verification_code: verificationCode
    });
    
    // إنشاء QR Code حقيقي قابل للقراءة
    let qrCodeImage = '';
    
    // محاولة استخدام مكتبة QRCode.js الحقيقية
    try {
        // التأكد من تحميل المكتبة
        if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
            // استخدام Promise wrapper مع await
            qrCodeImage = await new Promise((resolve, reject) => {
                // تعيين timeout لضمان عدم الانتظار إلى ما لا نهاية
                const timeout = setTimeout(() => {
                    console.warn('انتهت مهلة إنشاء QR Code، استخدام API خارجي');
                    resolve(generateQRCodeFallback(qrCodeData));
                }, 3000);
                
                QRCode.toDataURL(qrCodeData, {
                    width: 250,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    },
                    errorCorrectionLevel: 'M'
                }, function (error, url) {
                    clearTimeout(timeout);
                    if (error) {
                        console.error('خطأ في إنشاء QR Code:', error);
                        // استخدام API خارجي كبديل
                        resolve(generateQRCodeFallback(qrCodeData));
                    } else if (url) {
                        resolve(url);
                    } else {
                        console.warn('لم يتم إنشاء QR Code، استخدام API خارجي');
                        resolve(generateQRCodeFallback(qrCodeData));
                    }
                });
            });
        } else {
            // المكتبة غير متوفرة، استخدام API خارجي
            console.warn('مكتبة QRCode غير متوفرة، استخدام API خارجي');
            qrCodeImage = generateQRCodeFallback(qrCodeData);
        }
    } catch (error) {
        console.error('خطأ في إنشاء QR Code:', error);
        // استخدام API خارجي كبديل
        qrCodeImage = generateQRCodeFallback(qrCodeData);
    }
    
    // التأكد من وجود QR Code
    if (!qrCodeImage) {
        console.warn('فشل إنشاء QR Code، استخدام بيانات بسيطة');
        qrCodeImage = generateQRCodeFallback(JSON.stringify({
            invoice_number: saleNumber,
            total: saleData.final_amount || 0
        }));
    }
    
    // Format date and time in 12-hour format with AM/PM
    const formattedDateTime = formatDateTime12Hour(saleData.created_at || new Date().toISOString());
    
    // Get logo - try multiple sources (larger size)
    let logoHtml = '';
    // مسارات اللوجو الاحتياطية (نسبية من المجلد الرئيسي)
    const defaultLogoPath = 'vertopal.com_photo_5922357566287580087_y.png';  // اللوجو PNG في المجلد الرئيسي
    const fallbackLogoPath1 = 'photo_5922357566287580087_y.jpg';             // اللوجو JPG القديم
    const fallbackLogoPath2 = 'icons/icon-192x192.png';                      // أيقونة من مجلد الأيقونات
    
    // دالة لإنشاء HTML للوجو مع معالجة الأخطاء (حجم أكبر)
    const createLogoHtml = (src, alt = 'ALAA ZIDAN Logo') => {
        return `<img src="${src}" alt="${alt}" class="invoice-logo" style="max-width: 500px; max-height: 500px; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src='${defaultLogoPath}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath1}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath2}'; this.onerror=function(){this.style.display='none';};};};">`;
    };
    
    if (shopLogo && shopLogo.trim() !== '') {
        // استخدام لوجو المتجر من الإعدادات مع مسارات احتياطية
        logoHtml = createLogoHtml(shopLogo);
    } else {
        // استخدام اللوجو الافتراضي PNG مع مسارات احتياطية
        logoHtml = createLogoHtml(defaultLogoPath);
    }
    
    // Phone data section HTML
    const phoneDataSection = phoneData ? `
        <div class="invoice-phone-data">
            <h3>بيانات الهاتف</h3>
            <div class="phone-data-grid">
                <div class="phone-data-item">
                    <strong>الماركة:</strong> ${phoneData.brand || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>الموديل:</strong> ${phoneData.model || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>المساحة:</strong> ${phoneData.storage || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>الرام:</strong> ${phoneData.ram || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>نوع الشاشة:</strong> ${phoneData.screen_type || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>حالة الضريبة:</strong> ${phoneData.tax_status === 'due' ? 'مستحقة' : 'معفاة'}
                </div>
                <div class="phone-data-item">
                    <strong>السيريال نمبر (IMEI):</strong> ${phoneData.serial_number || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>سجل الصيانة:</strong> ${phoneData.maintenance_history || '-'}
                </div>
                ${phoneData.defects ? `
                <div class="phone-data-item full-width">
                    <strong>العيوب:</strong> ${phoneData.defects}
                </div>
                ` : ''}
            </div>
        </div>
    ` : '';
    
    // Invoice terms based on whether there's a phone
    const invoiceTerms = `
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بإبراز الفاتورة الأصلية.</li>
                ${hasPhoneProduct ? `
                <li>يجب مطابقة رقم الـ IMEI المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>
                ` : ''}
                <li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>
            </ol>
        </div>
    `;
    
    const invoiceHtml = `
        <div class="invoice-wrapper">
            <!-- Logo Section - في البداية -->
            <div class="invoice-logo-section">
                ${logoHtml}
            </div>
            
            <!-- Shop Info -->
            <div class="invoice-header">
                <div class="invoice-shop-info">
                    ${shopAddress ? `<div><i class="bi bi-geo-alt-fill"></i> ${shopAddress}</div>` : ''}
                    <div><i class="bi bi-whatsapp" style="color: #25D366;"></i> واتساب: ${whatsappNumber}</div>
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
            
            <!-- Phone Data Section -->
            ${phoneDataSection}
            
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
                    ${(saleData.items || []).map((item, index) => {
                        // التأكد من وجود اسم المنتج مع معالجة الأخطاء
                        const itemName = item.item_name || item.name || 'غير محدد';
                        if (!item.item_name && !item.name) {
                            console.warn('تحذير: اسم المنتج غير موجود في العنصر:', item);
                        }
                        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${itemName}</td>
                            <td>${item.quantity || 0}</td>
                            <td>${formatPrice(item.unit_price)} ${currency}</td>
                            <td>${formatPrice(item.total_price)} ${currency}</td>
                        </tr>
                    `;
                    }).join('')}
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
            
            <!-- Invoice Terms - البنود -->
            ${invoiceTerms}
            
            <!-- Footer -->
            <div class="invoice-footer">
                <div>شكراً لزيارتك</div>
            </div>
            
            <!-- QR Code - في نهاية الفاتورة -->
            <div class="invoice-qrcode">
                <img src="${qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(saleNumber || saleId || '')}`}" 
                     alt="QR Code" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(saleNumber || saleId || '')}'">
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
    
    // Wait a bit for rendering and image loading, then print
    setTimeout(() => {
        // التأكد من تحميل الصور قبل الطباعة
        const logoImg = document.querySelector('.invoice-logo');
        if (logoImg && !logoImg.complete) {
            logoImg.onload = () => {
                setTimeout(() => window.print(), 100);
            };
            logoImg.onerror = () => {
                setTimeout(() => window.print(), 100);
            };
        } else {
            window.print();
        }
    }, 500);
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
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Cairo'
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

// عرض modal التقييم بعد البيع
function showRatingModal(customerId, saleId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h3><i class="bi bi-star"></i> تقييم العملية</h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px; color: var(--text-light); text-align: center;">كيف تقيم هذه العملية؟</p>
                <div id="ratingStarsContainer" style="display: flex; justify-content: center; gap: 15px; font-size: 50px; margin: 30px 0;">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <i class="bi bi-star" 
                           data-rating="${star}" 
                           onclick="selectRatingStarPOS(this, ${star}, '${customerId}', '${saleId}')"
                           style="cursor: pointer; color: var(--border-color); transition: all 0.2s;"
                           onmouseover="highlightRatingStarsPOS(this, ${star})"
                           onmouseout="resetRatingStarsPOS(this)"></i>
                    `).join('')}
                </div>
                <p style="text-align: center; color: var(--text-light); font-size: 14px;">
                    اختر من <strong>1</strong> إلى <strong>5</strong> نجوم
                </p>
            </div>
            <div class="modal-footer">
                <button onclick="skipRating('${customerId}', '${saleId}')" class="btn btn-secondary">تخطي</button>
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

// تحديد نجمة التقييم في POS
function selectRatingStarPOS(element, rating, customerId, saleId) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    
    stars.forEach((star) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating) {
            star.className = 'bi bi-star-fill';
            star.style.color = 'var(--warning-color)';
        } else {
            star.className = 'bi bi-star';
            star.style.color = 'var(--border-color)';
        }
        star.style.pointerEvents = 'none'; // منع النقر بعد الاختيار
    });
    
    // حفظ التقييم
    saveRatingPOS(customerId, saleId, rating, container);
}

// تمييز النجوم عند المرور بالماوس في POS
function highlightRatingStarsPOS(element, rating) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    
    stars.forEach((star) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating && star.className !== 'bi bi-star-fill') {
            star.style.color = 'var(--warning-color)';
            star.style.transform = 'scale(1.15)';
        }
    });
}

// إعادة تعيين النجوم في POS
function resetRatingStarsPOS(element) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    
    stars.forEach((star) => {
        if (star.className !== 'bi bi-star-fill') {
            star.style.color = 'var(--border-color)';
            star.style.transform = 'scale(1)';
        }
    });
}

// حفظ التقييم في POS
async function saveRatingPOS(customerId, saleId, rating, starsContainer) {
    try {
        const result = await API.saveCustomerRating(customerId, saleId, rating);
        
        if (result && result.success) {
            showMessage('تم حفظ التقييم بنجاح', 'success');
            // إغلاق modal بعد ثانية
            setTimeout(() => {
                const modal = starsContainer.closest('.modal');
                if (modal) {
                    modal.remove();
                }
            }, 1000);
        } else {
            showMessage(result?.message || 'فشل حفظ التقييم', 'error');
            // إعادة تفعيل النجوم في حالة الخطأ
            const stars = starsContainer.querySelectorAll('[data-rating]');
            stars.forEach(star => {
                star.style.pointerEvents = 'auto';
            });
        }
    } catch (error) {
        console.error('خطأ في حفظ التقييم:', error);
        showMessage('حدث خطأ أثناء حفظ التقييم', 'error');
        // إعادة تفعيل النجوم في حالة الخطأ
        const stars = starsContainer.querySelectorAll('[data-rating]');
        stars.forEach(star => {
            star.style.pointerEvents = 'auto';
        });
    }
}

// تخطي التقييم
function skipRating(customerId, saleId) {
    const modal = document.querySelector('.modal');
    if (modal && modal.querySelector('#ratingStarsContainer')) {
        modal.remove();
    }
}

// Expose functions to global scope for onclick handlers
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.decreaseSparePartItemQuantity = decreaseSparePartItemQuantity;
window.increaseSparePartItemQuantity = increaseSparePartItemQuantity;
window.updateSparePartItemQuantity = updateSparePartItemQuantity;
window.addSparePartItemToCart = addSparePartItemToCart;
window.closeSparePartItemsModal = closeSparePartItemsModal;
window.selectRatingStarPOS = selectRatingStarPOS;
window.highlightRatingStarsPOS = highlightRatingStarsPOS;
window.resetRatingStarsPOS = resetRatingStarsPOS;
window.skipRating = skipRating;

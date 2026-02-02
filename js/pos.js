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
let firstBranchId = null;

// Initialize POS
document.addEventListener('DOMContentLoaded', function() {
    // ✅ تحميل الوضع الليلي من localStorage
    if (typeof loadDarkMode === 'function') {
        loadDarkMode();
    } else {
        // Fallback: تحميل الوضع الليلي مباشرة
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled') {
            document.body.classList.add('dark-mode');
        }
    }
    
    // ✅ إصلاح CSS و Bootstrap Icons عند تحميل الصفحة
    if (typeof ensureCSSAndIconsLoaded === 'function') {
        ensureCSSAndIconsLoaded();
    }
    
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
        
        // Load first branch ID (for new customers)
        await loadFirstBranchId();
        
        // Load customers
        await loadCustomers();
        
        // Setup event listeners
        setupEventListeners();
        
        // Render initial products
        renderProducts();
        
        // Update cart display
        updateCartDisplay();
        
        // Initialize QR Scanner automatically - wait longer to ensure page is fully loaded
        setTimeout(() => {
            initializePOSQRCodeScannerAuto().catch(error => {
                console.error('Failed to initialize QR scanner:', error);
                // Retry after 2 seconds
                setTimeout(() => {
                    initializePOSQRCodeScannerAuto().catch(err => {
                        console.error('Retry failed:', err);
                    });
                }, 2000);
            });
        }, 1500);
    } catch (error) {
        console.error('خطأ في تهيئة نظام POS:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`❌ فشل تحميل نظام نقطة البيع: ${errorMessage}. يرجى تحديث الصفحة والمحاولة مرة أخرى.`, 'error');
    }
}

// Load Customers
async function loadCustomers() {
    try {
        // التأكد من تحميل الفرع الأول أولاً
        if (!firstBranchId) {
            await loadFirstBranchId();
        }
        
        // جلب العملاء المرتبطين بالفرع الأول فقط
        const branchIdParam = firstBranchId ? `&branch_id=${encodeURIComponent(firstBranchId)}` : '';
        const retailRes = await API.request(`customers.php?type=retail${branchIdParam}`, 'GET');
        const commercialRes = await API.request(`customers.php?type=commercial${branchIdParam}`, 'GET');
        
        allCustomers = [];
        if (retailRes && retailRes.success && retailRes.data) {
            allCustomers = allCustomers.concat(retailRes.data.map(c => ({...c, customer_type: 'retail'})));
        }
        if (commercialRes && commercialRes.success && commercialRes.data) {
            allCustomers = allCustomers.concat(commercialRes.data.map(c => ({...c, customer_type: 'commercial'})));
        }
        
        console.log(`✅ تم تحميل ${allCustomers.length} عميل من الفرع الأول (${firstBranchId})`);
    } catch (error) {
        console.error('خطأ في تحميل العملاء:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`❌ فشل تحميل قائمة العملاء: ${errorMessage}. قد لا تتمكن من إتمام عملية البيع.`, 'error');
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
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`⚠️ فشل تحميل إعدادات المتجر: ${errorMessage}. قد لا تظهر بعض المعلومات في الفاتورة.`, 'error');
    }
}

// Load First Branch ID (for new customers)
async function loadFirstBranchId() {
    try {
        const response = await API.request('branches.php', 'GET', null, { silent: true });
        if (response && response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            // ترتيب الفروع حسب created_at واختيار الأول
            const sortedBranches = [...response.data].sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA.getTime() - dateB.getTime();
                }
                return (a.id || '').localeCompare(b.id || '');
            });
            firstBranchId = sortedBranches[0].id;
            console.log('✅ تم تحميل الفرع الأول:', firstBranchId);
        } else {
            console.warn('⚠️ لا توجد فروع متاحة');
        }
    } catch (error) {
        console.error('خطأ في تحميل الفرع الأول:', error);
        // لا نوقف التطبيق في حالة الخطأ، فقط نسجل الخطأ
    }
}

// Load All Products
async function loadAllProducts(forceRefresh = false) {
    try {
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="pos-loading"><i class="bi bi-arrow-repeat"></i> جاري التحميل...</div>';
        }
        
        // ✅ تعريف cachedProducts خارج if لاستخدامه لاحقاً
        let cachedProducts = null;
        
        // ✅ إذا كان forceRefresh = true، نتخطى الكاش تماماً
        if (!forceRefresh) {
            // ✅ محاولة تحميل من Cache أولاً (سريع جداً)
            try {
                if (typeof dbCache !== 'undefined') {
                    cachedProducts = await dbCache.loadProducts(3600000); // cache صالح لمدة ساعة
                    if (cachedProducts && cachedProducts.length > 0) {
                        allProducts = cachedProducts;
                        filteredProducts = [...allProducts];
                        renderProducts();
                        updateCartDisplay();
                        
                        // عرض رسالة أن البيانات من الكاش (فقط إذا كانت موجودة)
                        if (productsGrid && productsGrid.parentElement) {
                            // التحقق من عدم وجود رسالة سابقة
                            const existingNotice = productsGrid.parentElement.querySelector('.pos-cache-notice');
                            if (!existingNotice) {
                                const cacheNotice = document.createElement('div');
                                cacheNotice.className = 'pos-cache-notice';
                                cacheNotice.innerHTML = '<i class="bi bi-database"></i> البيانات من التخزين المحلي - جاري تحديث البيانات في الخلفية...';
                                cacheNotice.style.cssText = 'padding: 8px; background: var(--light-bg); color: var(--text-light); font-size: 12px; text-align: center; border-radius: 4px; margin-bottom: 10px;';
                                productsGrid.parentElement.insertBefore(cacheNotice, productsGrid);
                                
                                // إخفاء الرسالة بعد 5 ثوان
                                setTimeout(() => {
                                    if (cacheNotice.parentElement) {
                                        cacheNotice.remove();
                                    }
                                }, 5000);
                            }
                        }
                    }
                }
            } catch (error) {
                // تجاهل الأخطاء في تحميل Cache
            }
        }
        
        // ✅ تحميل البيانات الجديدة من الخادم في الخلفية (Silent)
        // ✅ عند forceRefresh = true، نستخدم skipCache لضمان الحصول على أحدث البيانات
        const requestOptions = forceRefresh ? { silent: true, skipCache: true } : { silent: true };
        
        try {
            const [sparePartsRes, accessoriesRes, phonesRes] = await Promise.all([
                API.request('inventory.php?type=spare_parts', 'GET', null, requestOptions),
                API.request('inventory.php?type=accessories', 'GET', null, requestOptions),
                API.request('inventory.php?type=phones', 'GET', null, requestOptions)
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
                        items: items, // حفظ القطع الفرعية
                        barcode: part.barcode || part.code || part.id?.toString() // Bar code for scanning
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
                        accessoryType: accessory.type,
                        barcode: accessory.barcode || accessory.code || accessory.id?.toString() // Bar code for scanning
                    });
                });
            }
            
            // Process phones - النظام الجديد: إخفاء البطاقات بكمية 0
            if (phonesRes && phonesRes.success && phonesRes.data) {
                phonesRes.data.forEach(phone => {
                    // إخفاء البطاقات بكمية 0 من نقطة البيع
                    const quantity = parseInt(phone.quantity || 0);
                    if (quantity > 0) {
                        allProducts.push({
                            id: phone.id,
                            name: `${phone.brand || ''} ${phone.model || ''}`.trim() || phone.name,
                            type: 'phone',
                            price: parseFloat(phone.selling_price || 0),
                            image: phone.image || '',
                            quantity: quantity,
                            brand: phone.brand || '',
                            model: phone.model || '',
                            barcode: phone.barcode || phone.code || phone.id?.toString(), // Bar code for scanning
                            phone_data: phone // حفظ بيانات الهاتف الكاملة
                        });
                    }
                });
            }
            
            filteredProducts = [...allProducts];
            
            // ✅ حفظ البيانات الجديدة في IndexedDB
            try {
                if (typeof dbCache !== 'undefined') {
                    await dbCache.saveProducts(allProducts);
                }
            } catch (error) {
                // تجاهل أخطاء الحفظ
            }
            
            // ✅ تحديث العرض إذا تغيرت البيانات
            if (forceRefresh || !cachedProducts || cachedProducts.length !== allProducts.length) {
                renderProducts();
                updateCartDisplay();
            }
            
        } catch (error) {
            // إذا فشل التحميل ولم يكن هناك cache، عرض رسالة خطأ
            if (!cachedProducts) {
                const errorMessage = error?.message || 'خطأ غير معروف';
                showMessage(`❌ فشل تحميل المنتجات: ${errorMessage}. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.`, 'error');
                if (productsGrid) {
                    productsGrid.innerHTML = '<div class="pos-loading" style="color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> فشل تحميل المنتجات. يرجى تحديث الصفحة.</div>';
                }
            }
        }
        
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`❌ فشل تحميل المنتجات: ${errorMessage}. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.`, 'error');
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="pos-loading" style="color: var(--danger-color);"><i class="bi bi-exclamation-triangle"></i> فشل تحميل المنتجات. يرجى تحديث الصفحة.</div>';
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
    
    // Search button - removed, replaced with barcode scanner
    // Barcode scanner is handled by openPOSBarcodeScanner() function
    
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
    
    // Bottom Action Bar - Complete Sale Button (Mobile)
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', function() {
            if (cart.length > 0) {
                openPaymentModal();
            }
        });
    }
    
    // Header Icons (Mobile)
    const searchHeaderBtn = document.getElementById('searchHeaderBtn');
    if (searchHeaderBtn) {
        searchHeaderBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
            }
        });
    }
    
    const qrHeaderBtn = document.getElementById('qrHeaderBtn');
    if (qrHeaderBtn) {
        qrHeaderBtn.addEventListener('click', function() {
            // Scroll to QR Scanner
            const qrScanner = document.getElementById('posQrScannerMobile');
            if (qrScanner) {
                qrScanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
    
    // More Categories Button (Three Dots)
    const moreCategoriesBtn = document.getElementById('moreCategoriesBtn');
    if (moreCategoriesBtn) {
        moreCategoriesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle visibility of all category tabs
            const categoryTabs = document.querySelectorAll('.pos-tab');
            const tabsContainer = document.querySelector('.pos-tabs');
            
            if (!tabsContainer) return;
            
            // Check if tabs are already expanded
            const isExpanded = tabsContainer.classList.contains('tabs-expanded');
            
            if (isExpanded) {
                // Collapse: Hide all tabs except first 3 (All, Spare Parts, Accessories)
                tabsContainer.classList.remove('tabs-expanded');
                categoryTabs.forEach((tab, index) => {
                    if (index > 2) { // Hide tabs after index 2 (phones and beyond)
                        tab.style.display = 'none';
                    } else {
                        tab.style.display = '';
                    }
                });
            } else {
                // Expand: Show all tabs
                tabsContainer.classList.add('tabs-expanded');
                categoryTabs.forEach(tab => {
                    tab.style.display = '';
                });
            }
        });
        
        // Also handle touch events for mobile
        moreCategoriesBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            moreCategoriesBtn.click();
        });
    }
    
    // Close Payment Modal - Left Button
    const closePaymentModalLeft = document.getElementById('closePaymentModalLeft');
    if (closePaymentModalLeft) {
        closePaymentModalLeft.addEventListener('click', function() {
            closePaymentModalFunc();
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
    
    // Discount input
    const discountInput = document.getElementById('discountInput');
    
    if (discountInput) {
        discountInput.addEventListener('input', updateCartSummary);
    }
    
    // Close modals on outside click - معطل حسب الطلب
    // if (paymentModal) {
    //     paymentModal.addEventListener('click', function(e) {
    //         if (e.target === paymentModal) {
    //             closePaymentModalFunc();
    //         }
    //     });
    // }
    
    // if (invoiceModal) {
    //     invoiceModal.addEventListener('click', function(e) {
    //         if (e.target === invoiceModal) {
    //             closeInvoiceModalFunc();
    //         }
    //     });
    // }
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
        // ✅ إضافة lazy loading للصور
        img.loading = 'lazy';
        img.decoding = 'async';
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
        showMessage('❌ فشل عرض القطع الفرعية. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
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
        'touch': 'تاتش',
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
        'hand_free': 'هاند فري',
        'auxiliary_cameras': 'كاميرات مساعده',
        'baga': 'باغه',
        'camera_baga': 'باغة كاميرا',
        'frame_camera_baga': 'فريم باغة كاميرا',
        'vibration': 'فيبريشن',
        'microphone': 'مايكروفون',
        'back_flex': 'فلاتة باك',
        'sensor': 'سينسور',
        'sim_tray': 'درج خط',
        'home_flex': 'فلاتة هوم',
        'home_button': 'زرار هوم',
        'upper_shield': 'شيلد علوي',
        'lower_shield': 'شيلد سفلي',
        'other': 'ملحقات أخرى'
    };
    
    itemsContainer.innerHTML = availableItems.map((item, index) => {
        const itemTypeName = sparePartTypes[item.item_type] || item.item_type || 'غير محدد';
        const itemQuantity = parseInt(item.quantity) || 0;
        const itemPrice = parseFloat(item.selling_price || item.price || 0);
        const serialNumber = item.serial_number || '';
        
        // تسجيل للتشخيص لقطع الغيار من نوع "بوردة"
        if (item.item_type === 'motherboard') {
            console.log('🔍 [POS] قطعة غيار من نوع بوردة:', {
                item_id: item.id,
                item_type: item.item_type,
                serial_number: serialNumber,
                has_serial: !!serialNumber,
                full_item: item
            });
        }
        
        return `
            <div class="spare-part-item-option" data-item-id="${item.id}" data-item-type="${item.item_type}" data-item-price="${itemPrice}" data-item-quantity="${itemQuantity}" data-serial-number="${serialNumber}">
                <div class="spare-part-item-info">
                    <div class="spare-part-item-name">${itemTypeName}${serialNumber ? ` <span style="color: #666; font-size: 0.9em;">(SN: ${serialNumber})</span>` : ''}</div>
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
    
    // إغلاق عند الضغط خارج النموذج - معطل حسب الطلب
    // modal.addEventListener('click', function(e) {
    //     if (e.target === modal) {
    //         closeSparePartItemsModal();
    //     }
    // });
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
            showMessage(`❌ الكمية المتاحة محدودة! الحد الأقصى: ${maxQuantity} قطعة.`, 'error');
        }
    }
}

function updateSparePartItemQuantity(index, maxQuantity) {
    const input = document.getElementById(`sparePartItemQty_${index}`);
    if (input) {
        const value = parseInt(input.value) || 1;
        if (value < 1) {
            input.value = 1;
            showMessage('⚠️ الكمية يجب أن تكون على الأقل 1 قطعة', 'error');
        } else if (value > maxQuantity) {
            input.value = maxQuantity;
            showMessage(`❌ الكمية المتاحة محدودة! الحد الأقصى: ${maxQuantity} قطعة.`, 'error');
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
        showMessage('❌ المنتج غير موجود في قاعدة البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        return;
    }
    
    const itemOption = document.querySelectorAll('.spare-part-item-option')[index];
    if (!itemOption) {
        showMessage('❌ القطعة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        return;
    }
    
    const itemId = itemOption.dataset.itemId;
    const itemType = itemOption.dataset.itemType;
    const itemPrice = parseFloat(itemOption.dataset.itemPrice || 0);
    const maxQuantity = parseInt(itemOption.dataset.itemQuantity || 0);
    const serialNumber = itemOption.dataset.serialNumber || '';
    const quantityInput = document.getElementById(`sparePartItemQty_${index}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    // تسجيل للتشخيص
    console.log('🔍 [POS] بيانات القطعة:', {
        itemId,
        itemType,
        serialNumber,
        hasSerialNumber: !!serialNumber,
        serialNumberLength: serialNumber.length
    });
    
    // التحقق من وجود itemId (مطلوب)
    if (!itemId || itemId.trim() === '') {
        console.error('itemId is missing or empty', { itemOption, index });
        showMessage('❌ خطأ في البيانات: معرف القطعة الفرعية غير موجود. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        return;
    }
    
    if (quantity < 1) {
        showMessage('⚠️ الكمية يجب أن تكون على الأقل 1 قطعة', 'error');
        return;
    }
    
    if (quantity > maxQuantity) {
        showMessage(`❌ الكمية المتاحة محدودة! الكمية المتوفرة: ${maxQuantity} قطعة فقط.`, 'error');
        return;
    }
    
    // البحث عن القطعة الفرعية في product.items
    const sparePartItem = (product.items || []).find(item => item.id === itemId);
    if (!sparePartItem) {
        console.error('Spare part item not found in product.items', { itemId, productItems: product.items });
        showMessage('❌ القطعة الفرعية غير موجودة في قاعدة البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        return;
    }
    
    // قائمة أنواع قطع الغيار
    const sparePartTypes = {
        'screen': 'شاشة',
        'touch': 'تاتش',
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
        'hand_free': 'هاند فري',
        'auxiliary_cameras': 'كاميرات مساعده',
        'baga': 'باغه',
        'camera_baga': 'باغة كاميرا',
        'frame_camera_baga': 'فريم باغة كاميرا',
        'vibration': 'فيبريشن',
        'microphone': 'مايكروفون',
        'back_flex': 'فلاتة باك',
        'sensor': 'سينسور',
        'sim_tray': 'درج خط',
        'home_flex': 'فلاتة هوم',
        'home_button': 'زرار هوم',
        'upper_shield': 'شيلد علوي',
        'lower_shield': 'شيلد سفلي',
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
            showMessage(`❌ الكمية المتاحة محدودة! المتوفرة: ${availableQuantity} قطعة، الموجود في السلة: ${existingItem.quantity} قطعة.`, 'error');
            return;
        }
        
        existingItem.quantity = newQuantity;
        existingItem.totalPrice = existingItem.unitPrice * newQuantity;
        updateCartDisplay();
        closeSparePartItemsModal();
        showMessage(`تم اضافة المنتج بنجاح : ${itemName}`, 'success');
        playSuccessSound(); // تشغيل صوت النجاح
        // اهتزاز خفيف بعد المسح الناجح (موبايل)
        if (navigator.vibrate) {
            navigator.vibrate(100); // اهتزاز خفيف (100ms)
        }
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
    
    // إضافة السيريال إذا كان موجوداً (لقطع الغيار من نوع "بوردة")
    if (serialNumber && itemType === 'motherboard') {
        cartItem.serial_number = serialNumber;
        console.log('✅ [POS] تم إضافة السيريال إلى cartItem:', {
            serial_number: serialNumber,
            itemType: itemType,
            itemName: itemName
        });
    } else if (serialNumber && itemType !== 'motherboard') {
        console.warn('⚠️ [POS] السيريال موجود لكن النوع ليس motherboard:', {
            serial_number: serialNumber,
            itemType: itemType,
            itemName: itemName
        });
    } else if (!serialNumber && itemType === 'motherboard') {
        console.warn('⚠️ [POS] النوع هو motherboard لكن لا يوجد سيريال:', {
            itemType: itemType,
            itemName: itemName,
            itemOption: itemOption
        });
    }
    
    // التحقق النهائي من وجود spare_part_item_id
    if (!cartItem.spare_part_item_id) {
        console.error('spare_part_item_id is missing before adding to cart', cartItem);
        showMessage('❌ خطأ في البيانات: معرف القطعة الفرعية غير موجود. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        return;
    }
    
    console.log('Adding spare part item to cart:', {
        productName: product.name,
        itemType: itemType,
        itemId: itemId,
        quantity: quantity,
        spare_part_item_id: cartItem.spare_part_item_id,
        serial_number: cartItem.serial_number || 'غير موجود',
        hasSerialNumber: !!cartItem.serial_number
    });
    
    cart.push(cartItem);
    
    updateCartDisplay();
    closeSparePartItemsModal();
    showMessage(`تم اضافة المنتج بنجاح : ${itemName}`, 'success');
    playSuccessSound(); // تشغيل صوت النجاح
    // اهتزاز خفيف بعد المسح الناجح (موبايل)
    if (navigator.vibrate) {
        navigator.vibrate(100); // اهتزاز خفيف (100ms)
    }
}

// Add to Cart
// Play success sound
function playSuccessSound() {
    try {
        // إنشاء صوت نجاح باستخدام Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // تردد عالي
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.error('Error playing success sound:', error);
    }
}

async function addToCart(product, showMessageFlag = true) {
    const existingItem = cart.find(item => item.id === product.id && item.type === product.type && !item.spare_part_item_id);
    
    if (existingItem) {
        // Check quantity limit
        if (product.quantity > 0 && existingItem.quantity >= product.quantity) {
            const availableQty = product.quantity || 0;
            showMessage(`❌ الكمية المتاحة محدودة! الكمية المتوفرة: ${availableQty} قطعة فقط.`, 'error');
            return;
        }
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
        const cartItem = {
            id: product.id,
            name: product.name,
            type: product.type,
            unitPrice: product.price,
            quantity: 1,
            totalPrice: product.price,
            image: product.image
        };
        
        // إضافة phone_data إذا كان المنتج من نوع phone
        if (product.type === 'phone') {
            // إذا كانت البيانات موجودة في product، استخدمها
            if (product.phone_data) {
                cartItem.phone_data = product.phone_data;
            } else {
                // جلب بيانات الهاتف من API
                try {
                    const phoneRes = await API.getPhoneById(product.id);
                    if (phoneRes && phoneRes.success && phoneRes.data) {
                        cartItem.phone_data = phoneRes.data;
                        console.log('✅ تم جلب بيانات الهاتف من API:', phoneRes.data);
                    } else {
                        console.warn('⚠️ لم يتم جلب بيانات الهاتف من API');
                    }
                } catch (error) {
                    console.error('❌ خطأ في جلب بيانات الهاتف:', error);
                    const errorMessage = error?.message || 'خطأ غير معروف';
                    showMessage(`⚠️ فشل جلب بيانات الهاتف: ${errorMessage}. قد لا تظهر بعض المعلومات في الفاتورة.`, 'error');
                }
            }
        }
        
        cart.push(cartItem);
    }
    
    updateCartDisplay();
    
    // عرض الرسالة فقط إذا كان showMessageFlag = true
    if (showMessageFlag) {
        showMessage(`تم اضافة المنتج بنجاح : ${product.name}`, 'success');
        playSuccessSound(); // تشغيل صوت النجاح
        // اهتزاز خفيف بعد المسح الناجح (موبايل)
        if (navigator.vibrate) {
            navigator.vibrate(100); // اهتزاز خفيف (100ms)
        }
    }
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
            const availableQty = product.quantity || 0;
            showMessage(`❌ الكمية المتاحة محدودة! الكمية المتوفرة: ${availableQty} قطعة فقط.`, 'error');
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

// Update Bottom Action Bar (Mobile)
function updateBottomActionBar(subtotal, discount, finalAmount) {
    const bottomTotal = document.getElementById('bottomTotalAmount');
    const bottomItemsCount = document.getElementById('bottomItemsCount');
    const bottomCartBadge = document.getElementById('bottomCartBadge');
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    
    if (bottomTotal) {
        bottomTotal.textContent = finalAmount.toFixed(2);
    }
    
    if (bottomItemsCount) {
        bottomItemsCount.textContent = cart.length;
    }
    
    if (bottomCartBadge) {
        bottomCartBadge.textContent = cart.length;
        bottomCartBadge.style.display = cart.length > 0 ? 'flex' : 'none';
    }
    
    if (completeSaleBtn) {
        completeSaleBtn.disabled = cart.length === 0;
    }
}

// Update Cart Summary
function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    
    const discountInput = document.getElementById('discountInput');
    const subtotalDisplay = document.getElementById('subtotal');
    const totalDisplay = document.getElementById('totalAmount');
    
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    
    const finalAmount = subtotal - discount;
    
    // Update Bottom Action Bar (Mobile)
    updateBottomActionBar(subtotal, discount, finalAmount);
    
    if (subtotalDisplay) {
        subtotalDisplay.textContent = formatPrice(subtotal);
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
    
    // Show/hide payment amount field (for commercial customers only)
    const paymentAmountGroup = document.getElementById('paymentAmountGroup');
    if (paymentAmountGroup) {
        paymentAmountGroup.style.display = type === 'commercial' ? 'block' : 'none';
        if (type === 'commercial') {
            // Set default to full payment
            const paidAmountInput = document.getElementById('paidAmountInput');
            if (paidAmountInput) {
                const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
                const discountInput = document.getElementById('discountInput');
                const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
                const finalAmount = subtotal - discount;
                paidAmountInput.value = finalAmount.toFixed(2);
                paidAmountInput.max = finalAmount;
                updatePaymentAmount();
            }
        } else {
            // Reset for retail customers
            const paidAmountInput = document.getElementById('paidAmountInput');
            if (paidAmountInput) {
                paidAmountInput.value = '';
            }
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
    
    // فلترة العملاء حسب النوع والفرع الأول فقط
    const customers = allCustomers.filter(c => {
        // فلترة حسب النوع
        if (c.customer_type !== type) return false;
        // فلترة حسب الفرع الأول فقط
        if (firstBranchId && c.branch_id !== firstBranchId) return false;
        return true;
    });
    
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
    const confirmSaleDiscountInput = document.getElementById('confirmSaleDiscountInput');
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const finalAmount = subtotal - discount;
    
    // Update Confirm Sale Items List
    updateConfirmSaleItemsList();
    
    // Update discount input in modal
    if (confirmSaleDiscountInput) {
        confirmSaleDiscountInput.value = discount.toFixed(2);
        // Remove old event listeners and add new one
        const newConfirmSaleDiscountInput = confirmSaleDiscountInput.cloneNode(true);
        confirmSaleDiscountInput.parentNode.replaceChild(newConfirmSaleDiscountInput, confirmSaleDiscountInput);
        
        // Sync with main discount input
        newConfirmSaleDiscountInput.addEventListener('input', function() {
            const newDiscount = parseFloat(this.value) || 0;
            if (discountInput) {
                discountInput.value = newDiscount.toFixed(2);
            }
            updateConfirmSaleTotal();
            updateCartSummary();
        });
    }
    
    // Update modal summary (old elements for compatibility)
    const modalSubtotal = document.getElementById('modalSubtotal');
    const modalDiscount = document.getElementById('modalDiscount');
    const modalTotal = document.getElementById('modalTotal');
    
    if (modalSubtotal) modalSubtotal.textContent = formatPrice(subtotal);
    if (modalDiscount) modalDiscount.textContent = formatPrice(discount);
    if (modalTotal) modalTotal.textContent = formatPrice(Math.max(0, finalAmount));
    
    // Update Confirm Sale Total
    updateConfirmSaleTotal();
    
    // Reset payment amount for commercial customers
    const paidAmountInput = document.getElementById('paidAmountInput');
    if (paidAmountInput) {
        paidAmountInput.value = '';
        paidAmountInput.max = finalAmount;
    }
    updatePaymentAmount();
    
    // التأكد من إعادة تعيين display قبل إظهار modal
    paymentModal.style.display = '';
    paymentModal.classList.add('active');
}

// Update Confirm Sale Items List
function updateConfirmSaleItemsList() {
    const itemsList = document.getElementById('confirmSaleItemsList');
    const itemsCount = document.getElementById('confirmSaleItemsCount');
    
    if (!itemsList) return;
    
    if (cart.length === 0) {
        itemsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد عناصر في السلة</div>';
        if (itemsCount) itemsCount.textContent = '0';
        return;
    }
    
    if (itemsCount) itemsCount.textContent = cart.length;
    
    const fragment = document.createDocumentFragment();
    
    cart.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'confirm-sale-item';
        
        // Handle image
        let imageSrc = item.image;
        let isBase64 = false;
        
        if (item.image) {
            if (item.image.startsWith('data:')) {
                isBase64 = true;
                imageSrc = item.image;
            } else if (item.image.startsWith('/9j/') || item.image.startsWith('iVBORw0KGgo') || item.image.length > 100) {
                isBase64 = true;
                if (item.image.startsWith('/9j/')) {
                    imageSrc = `data:image/jpeg;base64,${item.image}`;
                } else if (item.image.startsWith('iVBORw0KGgo')) {
                    imageSrc = `data:image/png;base64,${item.image}`;
                } else {
                    imageSrc = `data:image/jpeg;base64,${item.image}`;
                }
            }
        }
        
        const imageHtml = item.image
            ? `<img src="${imageSrc}" alt="${item.name}" class="confirm-sale-item-image">`
            : `<div class="confirm-sale-item-image-placeholder"><i class="bi bi-image"></i></div>`;
        
        itemDiv.innerHTML = `
            ${imageHtml}
            <div class="confirm-sale-item-details">
                <div class="confirm-sale-item-name">${item.name}</div>
                <div class="confirm-sale-item-price">${formatPrice(item.totalPrice)}</div>
            </div>
            <button class="confirm-sale-item-remove" onclick="removeFromCart(${index}); updateConfirmSaleItemsList(); updateConfirmSaleTotal();" title="حذف">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        fragment.appendChild(itemDiv);
    });
    
    itemsList.innerHTML = '';
    itemsList.appendChild(fragment);
}

// Update Confirm Sale Total
function updateConfirmSaleTotal() {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountInput = document.getElementById('confirmSaleDiscountInput');
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const finalAmount = Math.max(0, subtotal - discount);
    
    const confirmSaleTotal = document.getElementById('confirmSaleTotal');
    if (confirmSaleTotal) {
        confirmSaleTotal.textContent = finalAmount.toFixed(2);
    }
    
    // Update main discount input
    const mainDiscountInput = document.getElementById('discountInput');
    if (mainDiscountInput && discountInput) {
        mainDiscountInput.value = discount.toFixed(2);
    }
    
    // Update payment amount max for commercial customers
    const paidAmountInput = document.getElementById('paidAmountInput');
    if (paidAmountInput) {
        paidAmountInput.max = finalAmount;
        if (currentCustomerType === 'commercial' && paidAmountInput.value) {
            updatePaymentAmount();
        }
    }
}

// Close Payment Modal
function closePaymentModalFunc() {
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.classList.remove('active');
        paymentModal.style.display = ''; // إعادة تعيين display إلى حالته الأصلية
    }
}

// Update Payment Amount
function updatePaymentAmount() {
    const paidAmountInput = document.getElementById('paidAmountInput');
    const remainingAmountDisplay = document.getElementById('remainingAmountDisplay');
    
    if (!paidAmountInput || !remainingAmountDisplay) return;
    
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountInput = document.getElementById('discountInput');
    const confirmSaleDiscountInput = document.getElementById('confirmSaleDiscountInput');
    const discount = confirmSaleDiscountInput ? (parseFloat(confirmSaleDiscountInput.value) || 0) : (discountInput ? (parseFloat(discountInput.value) || 0) : 0);
    const finalAmount = subtotal - discount;
    
    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    const remainingAmount = Math.max(0, finalAmount - paidAmount);
    
    remainingAmountDisplay.textContent = formatPrice(remainingAmount);
    
    // Validate paid amount
    if (paidAmount > finalAmount) {
        paidAmountInput.value = finalAmount.toFixed(2);
        remainingAmountDisplay.textContent = '0.00';
    }
}

// Set Full Payment
function setFullPayment() {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountInput = document.getElementById('discountInput');
    const confirmSaleDiscountInput = document.getElementById('confirmSaleDiscountInput');
    const discount = confirmSaleDiscountInput ? (parseFloat(confirmSaleDiscountInput.value) || 0) : (discountInput ? (parseFloat(discountInput.value) || 0) : 0);
    const finalAmount = subtotal - discount;
    
    const paidAmountInput = document.getElementById('paidAmountInput');
    if (paidAmountInput) {
        paidAmountInput.value = finalAmount.toFixed(2);
        updatePaymentAmount();
    }
}

// Set Partial Payment (50%)
function setPartialPayment() {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountInput = document.getElementById('discountInput');
    const confirmSaleDiscountInput = document.getElementById('confirmSaleDiscountInput');
    const discount = confirmSaleDiscountInput ? (parseFloat(confirmSaleDiscountInput.value) || 0) : (discountInput ? (parseFloat(discountInput.value) || 0) : 0);
    const finalAmount = subtotal - discount;
    
    const paidAmountInput = document.getElementById('paidAmountInput');
    if (paidAmountInput) {
        const partialAmount = (finalAmount * 0.5).toFixed(2);
        paidAmountInput.value = partialAmount;
        updatePaymentAmount();
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
        const customerNameInput = document.getElementById('customerNameInput');
        const customerPhoneInput = document.getElementById('customerPhoneInput');
        
        // التحقق من بيانات العميل (مطلوبة)
        const customerName = customerNameInput ? customerNameInput.value.trim() : '';
        const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
        
        if (!customerName) {
            showMessage('❌ اسم العميل مطلوب! يرجى إدخال اسم العميل لإتمام عملية البيع.', 'error');
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
            showMessage('❌ رقم هاتف العميل مطلوب! يرجى إدخال رقم الهاتف لإتمام عملية البيع.', 'error');
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
            showMessage('❌ رقم الهاتف غير صحيح! يجب أن يكون رقم الهاتف 8 أرقام على الأقل.', 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> تأكيد الدفع';
            }
            if (customerPhoneInput) {
                customerPhoneInput.focus();
            }
            return;
        }
        
        // Get discount from confirm sale input or main input
        const confirmSaleDiscountInput = document.getElementById('confirmSaleDiscountInput');
        const discountValue = confirmSaleDiscountInput ? (parseFloat(confirmSaleDiscountInput.value) || 0) : (discountInput ? (parseFloat(discountInput.value) || 0) : 0);
        const discount = discountValue;
        const finalAmount = subtotal - discount;
        
        // Get payment amounts (for commercial customers)
        const paidAmountInput = document.getElementById('paidAmountInput');
        let paidAmount = finalAmount; // Default: full payment
        let remainingAmount = 0;
        
        if (currentCustomerType === 'commercial' && paidAmountInput) {
            paidAmount = parseFloat(paidAmountInput.value) || finalAmount;
            if (paidAmount > finalAmount) {
                paidAmount = finalAmount;
            }
            remainingAmount = Math.max(0, finalAmount - paidAmount);
        }
        
        // Get shop name for commercial customers
        const shopNameInput = document.getElementById('shopNameInput');
        const shopName = shopNameInput ? shopNameInput.value.trim() : '';
        const addressInput = document.getElementById('customerAddressInput');
        const address = addressInput ? addressInput.value.trim() : '';
        
        // Validate shop name for commercial customers
        if (currentCustomerType === 'commercial' && !selectedCustomerId && !shopName) {
            showMessage('❌ اسم المحل مطلوب للعملاء التجاريين! يرجى إدخال اسم المحل لإتمام عملية البيع.', 'error');
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
                // جلب الفرع الأول إذا لم يكن محملاً
                if (!firstBranchId) {
                    await loadFirstBranchId();
                }
                
                const customerData = {
                    name: customerName,
                    phone: customerPhone,
                    address: address,
                    customer_type: currentCustomerType,
                    shop_name: currentCustomerType === 'commercial' ? shopName : null,
                    branch_id: firstBranchId // ربط العميل بالفرع الأول تلقائياً
                };
                
                const customerRes = await API.addCustomer(customerData);
                if (customerRes && customerRes.success && customerRes.data && customerRes.data.id) {
                    customerId = customerRes.data.id;
                    // Add to local list
                    allCustomers.push(customerRes.data);
                    // تحديث selectedCustomerId
                    selectedCustomerId = customerId;
                } else {
                    const errorMsg = customerRes?.message || 'خطأ غير معروف';
                    showMessage(`❌ فشل في إنشاء العميل: ${errorMsg}. يرجى التحقق من البيانات والمحاولة مرة أخرى.`, 'error');
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
            showMessage('❌ خطأ في ربط العميل بالفاتورة! يرجى التحقق من بيانات العميل والمحاولة مرة أخرى.', 'error');
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
                    // إرسال السيريال إذا كان موجوداً (لقطع الغيار من نوع "بوردة")
                    if (item.serial_number) {
                        saleItem.serial_number = item.serial_number;
                        console.log('✅ [POS] إرسال السيريال مع بيانات البيع:', {
                            item_name: item.name,
                            serial_number: item.serial_number,
                            spare_part_item_id: item.spare_part_item_id,
                            full_saleItem: saleItem
                        });
                    } else {
                        console.warn('⚠️ [POS] لا يوجد سيريال في عنصر السلة:', {
                            item_name: item.name,
                            item_type: item.type,
                            spare_part_item_id: item.spare_part_item_id,
                            full_item: item
                        });
                    }
                }
                
                return saleItem;
                
                // إرسال phone_data إذا كان المنتج من نوع phone وكان موجوداً
                if (item.type === 'phone' && item.phone_data) {
                    saleItem.phone_data = item.phone_data;
                }
                
                return saleItem;
            }),
            total_amount: subtotal,
            discount: discount,
            tax: 0, // لا توجد ضرائب في النظام
            final_amount: Math.max(0, finalAmount),
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            customer_id: customerId, // هذا إلزامي
            customer_name: customerName,
            customer_phone: customerPhone
        };
        
        // Debug: Log sale data
        console.log('Sending sale data:', saleData);
        console.log('Cart items with spare_part_item_id:', cart.map(item => ({
            name: item.name,
            type: item.type,
            spare_part_item_id: item.spare_part_item_id,
            serial_number: item.serial_number || 'غير موجود'
        })));
        console.log('Sale items with serial_number:', saleData.items.map(item => ({
            item_name: item.item_name,
            item_type: item.item_type,
            serial_number: item.serial_number || 'غير موجود',
            spare_part_item_id: item.spare_part_item_id || 'غير موجود'
        })));
        
        const response = await API.request('sales.php', 'POST', saleData);
        
        if (response && response.success) {
            // إغلاق modal الدفع أولاً (سيتم إعادة تعيين display تلقائياً)
            closePaymentModalFunc();
            
            // حفظ بيانات آخر عملية بيع للاستخدام في الطباعة
            window.lastSaleData = response.data;
            
            // ✅ التحقق من وجود items في البيانات
            console.log('📋 [POS] Response data:', response.data);
            console.log('📋 [POS] Items in response:', response.data?.items);
            console.log('📋 [POS] Items count:', response.data?.items?.length || 0);
            
            // ✅ التأكد من وجود items قبل عرض الفاتورة
            if (!response.data.items || !Array.isArray(response.data.items) || response.data.items.length === 0) {
                console.error('❌ [POS] لا توجد عناصر في استجابة API!');
                console.error('❌ [POS] Response data:', JSON.stringify(response.data, null, 2));
                
                // محاولة إصلاح البيانات باستخدام البيانات المرسلة
                if (saleData.items && saleData.items.length > 0) {
                    console.log('✅ [POS] استخدام البيانات المرسلة كبديل');
                    response.data.items = saleData.items;
                } else {
                    showMessage('❌ خطأ: لا توجد منتجات في الفاتورة. يرجى المحاولة مرة أخرى.', 'error');
                    return;
                }
            }
            
            showInvoice(response.data);
            cart = [];
            updateCartDisplay();
            
            // ✅ إعادة تحميل المنتجات لتحديث الكميات (مع skipCache)
            await loadAllProducts(true); // forceRefresh = true
            filterProducts();
            
            showMessage('تم إتمام عملية البيع بنجاح', 'success');
            
            // عرض modal التقييم إذا كان هناك customer_id صحيح
            if (customerId && customerId !== 'undefined' && customerId !== 'null' && String(customerId).trim() !== '' && response.data && response.data.id) {
                setTimeout(() => {
                    // التأكد مرة أخرى من إغلاق modal الدفع قبل عرض modal التقييم
                    closePaymentModalFunc();
                    showRatingModal(customerId, response.data.id);
                }, 1500); // تأخير 1.5 ثانية بعد إظهار الفاتورة لضمان إغلاق modal الدفع
            }
        } else {
            const errorMsg = response?.message || 'خطأ غير معروف';
            showMessage(`❌ فشل إتمام عملية البيع: ${errorMsg}. يرجى التحقق من البيانات والمحاولة مرة أخرى.`, 'error');
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الدفع:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`❌ فشل إتمام عملية البيع: ${errorMessage}. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.`, 'error');
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
    
    // ✅ التحقق من وجود items في saleData
    console.log('📋 [Invoice] Sale Data:', saleData);
    console.log('📋 [Invoice] Items:', saleData.items);
    console.log('📋 [Invoice] Items type:', typeof saleData.items);
    console.log('📋 [Invoice] Items is array:', Array.isArray(saleData.items));
    console.log('📋 [Invoice] Items length:', saleData.items?.length || 0);
    
    // ✅ التأكد من وجود items
    if (!saleData.items || !Array.isArray(saleData.items) || saleData.items.length === 0) {
        console.error('❌ [Invoice] لا توجد عناصر في saleData!');
        console.error('❌ [Invoice] Full saleData:', JSON.stringify(saleData, null, 2));
        
        // محاولة استخدام window.lastSaleData إذا كان متاحاً
        if (window.lastSaleData && window.lastSaleData.items && Array.isArray(window.lastSaleData.items) && window.lastSaleData.items.length > 0) {
            console.log('✅ [Invoice] استخدام window.lastSaleData كبديل');
            saleData.items = window.lastSaleData.items;
        } else {
            showMessage('❌ خطأ: لا توجد منتجات في الفاتورة. يرجى التحقق من البيانات.', 'error');
            return;
        }
    }
    
    const shopName = shopSettings.shop_name || 'المتجر';
    const shopPhone = shopSettings.shop_phone || '';
    const shopAddress = shopSettings.shop_address || '';
    const shopLogo = shopSettings.shop_logo || '';
    const currency = shopSettings.currency || 'ج.م';
    const branchName = 'الهانوفيل';
    const salesPersonName = saleData.created_by_name || 'غير محدد';
    const whatsappNumber = shopSettings.whatsapp_number || '01276855966';
    
    // Check if there's a phone product in the sale
    const hasPhoneProduct = (saleData.items || []).some(item => item.item_type === 'phone');
    // Check if there's a spare part product in the sale
    const hasSparePartProduct = (saleData.items || []).some(item => item.item_type === 'spare_part');
    // Check if there's an accessory product in the sale
    const hasAccessoryProduct = (saleData.items || []).some(item => item.item_type === 'accessory');
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
    const fallbackLogoPath2 = 'ico/icon-192x192.png';                      // أيقونة من مجلد الأيقونات
    
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
                    <strong>السيريال نمبر (SN):</strong> ${phoneData.serial_number || '-'}
                </div>
                <div class="phone-data-item">
                    <strong>الملحقات:</strong> ${phoneData.accessories || '-'}
                </div>
                ${phoneData.battery_percent !== null && phoneData.battery_percent !== undefined ? `
                <div class="phone-data-item">
                    <strong>نسبة البطارية:</strong> ${phoneData.battery_percent}%
                </div>
                ` : ''}
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
    
    // Invoice terms based on whether there's a phone or spare part
    let invoiceTerms = '';
    if (hasSparePartProduct && !hasAccessoryProduct) {
        // For spare parts only, show only one warning
        invoiceTerms = `
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجي تجربة قطعة الغيار بشكل جيد اثناء التواجد في الفرع حيث ان الضمان مقتصر علي التجربه فقط</li>
            </ol>
        </div>
    `;
    } else if (hasSparePartProduct && hasAccessoryProduct) {
        // For spare parts AND accessories, show all warnings including spare part warning as fourth
        invoiceTerms = `
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>
                <li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>
                <li>يرجي تجربة قطعة الغيار بشكل جيد اثناء التواجد في الفرع حيث ان الضمان مقتصر علي التجربه فقط</li>
            </ol>
        </div>
    `;
    } else if (hasAccessoryProduct && hasPhoneProduct) {
        // For accessories AND phone, show all warnings for both
        invoiceTerms = `
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>
                <li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>
                <li>يجب مطابقة رقم الـ Serial Number المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>
                <li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>
            </ol>
        </div>
    `;
    } else {
        // For other products, show standard warnings
        const warrantyWarning = hasAccessoryProduct 
            ? '<li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>'
            : '<li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>';
        
        invoiceTerms = `
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>
                ${hasPhoneProduct ? `
                <li>يجب مطابقة رقم الـ Serial Number المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>
                ` : ''}
                ${warrantyWarning}
            </ol>
        </div>
    `;
    }
    
    // حفظ sale_id في متغير منفصل للاستخدام في الطباعة
    const currentSaleId = saleData.id || saleData.sale_id || '';
    if (currentSaleId) {
        window.currentInvoiceSaleId = currentSaleId;
    }
    
    const invoiceHtml = `
        <div class="invoice-wrapper" data-sale-id="${currentSaleId}">
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
                        <th>السعر</th>
                        <th>إجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${(() => {
                        // ✅ التأكد من وجود items
                        const items = saleData.items || [];
                        console.log('📋 [Invoice] Rendering items:', items);
                        console.log('📋 [Invoice] Items count:', items.length);
                        
                        if (!items || !Array.isArray(items) || items.length === 0) {
                            console.error('❌ [Invoice] لا توجد عناصر للعرض!');
                            return '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--danger-color);">⚠️ لا توجد منتجات في الفاتورة</td></tr>';
                        }
                        
                        return items.map((item, index) => {
                            // التأكد من وجود اسم المنتج مع معالجة الأخطاء
                            let itemName = item.item_name || item.name || 'غير محدد';
                            const quantity = item.quantity || 0;
                            const unitPrice = parseFloat(item.unit_price || 0);
                            const totalPrice = parseFloat(item.total_price || 0);
                            const serialNumber = item.serial_number || '';
                            
                            // تسجيل للتشخيص
                            if ((item.item_type === 'spare_part' || item.type === 'spare_part') && !serialNumber) {
                                console.warn('⚠️ [Invoice] قطعة غيار بدون سيريال:', {
                                    item_name: itemName,
                                    item_type: item.item_type || item.type,
                                    has_serial: !!item.serial_number,
                                    full_item: item
                                });
                            }
                            
                            if (!item.item_name && !item.name) {
                                console.warn('⚠️ [Invoice] اسم المنتج غير موجود في العنصر:', item);
                            }
                            
                            // عرض السيريال في سطر منفصل إذا كان موجوداً
                            if (serialNumber) {
                                console.log('✅ [Invoice] عرض السيريال في الفاتورة:', serialNumber);
                                return `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${itemName}</td>
                                <td>${quantity}</td>
                                <td>${formatPrice(unitPrice)} ${currency}</td>
                                <td>${formatPrice(totalPrice)} ${currency}</td>
                            </tr>
                            <tr style="background-color: #f9f9f9;">
                                <td></td>
                                <td colspan="4" style="padding-right: 20px; padding-top: 5px; padding-bottom: 5px; color: #666; font-size: 0.9em;">
                                    <strong>السيريال:</strong> ${serialNumber}
                                </td>
                            </tr>
                        `;
                            } else {
                                return `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${itemName}</td>
                                <td>${quantity}</td>
                                <td>${formatPrice(unitPrice)} ${currency}</td>
                                <td>${formatPrice(totalPrice)} ${currency}</td>
                            </tr>
                        `;
                            }
                        }).join('');
                    })()}
                </tbody>
            </table>
            
            <!-- Summary -->
            <div class="invoice-summary">
                <div class="summary-row">
                    <span>المجموع الفرعي:</span>
                    <span>${formatPrice(saleData.total_amount)} ${currency}</span>
                </div>
                ${(saleData.paid_amount !== undefined && saleData.paid_amount !== null && parseFloat(saleData.paid_amount) > 0 && parseFloat(saleData.paid_amount) < parseFloat(saleData.final_amount)) ? `
                    <div class="summary-row">
                        <span>المدفوع:</span>
                        <span>${formatPrice(saleData.paid_amount)} ${currency}</span>
                    </div>
                ` : ''}
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
                ${(saleData.remaining_amount !== undefined && saleData.remaining_amount !== null && parseFloat(saleData.remaining_amount) > 0) ? `
                    <div class="summary-row">
                        <span>المتبقي:</span>
                        <span>${formatPrice(saleData.remaining_amount)} ${currency}</span>
                    </div>
                ` : ''}
            </div>
            
            <!-- Invoice Terms - البنود -->
            ${invoiceTerms}
            
            <!-- Footer -->
            <div class="invoice-footer">
                <div>شكرا لتعاملكم معنا</div>
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
    
    // Auto-print after showing invoice - انتظار تحميل جميع العناصر
    // التأكد من أن QR code وجميع العناصر قد تم تحميلها قبل الطباعة
    setTimeout(() => {
        // التحقق من وجود جميع العناصر في DOM
        const qrCodeImg = document.querySelector('.invoice-qrcode img');
        const logoImg = document.querySelector('.invoice-logo');
        const itemsTable = document.querySelector('.invoice-items-table');
        
        // إذا كانت جميع العناصر موجودة، ابدأ عملية الطباعة
        if (qrCodeImg && itemsTable) {
            printInvoice();
        } else {
            // إذا لم تكن العناصر جاهزة، انتظر قليلاً ثم حاول مرة أخرى
            setTimeout(() => {
                printInvoice();
            }, 500);
        }
    }, 800);
}

// Close Invoice Modal
function closeInvoiceModalFunc() {
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.classList.remove('active');
    }
    
    // التأكد من إغلاق modal الدفع أيضاً وإعادة تعيين حالته
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.classList.remove('active');
        paymentModal.style.display = ''; // إعادة تعيين display إلى حالته الأصلية
    }
    
    // التأكد من أن زر الدفع في الحالة الصحيحة
    const payBtn = document.getElementById('payBtn');
    if (payBtn && cart.length > 0) {
        payBtn.disabled = false;
    } else if (payBtn && cart.length === 0) {
        payBtn.disabled = true;
    }
}

// Print Invoice
function printInvoice() {
    // استخدام النظام الجديد - فتح الفاتورة من API
    const invoiceModal = document.getElementById('invoiceModal');
    const invoiceBody = document.getElementById('invoiceBody');
    
    if (!invoiceModal || !invoiceBody) {
        console.error('عناصر الفاتورة غير موجودة');
        return;
    }
    
    // محاولة جلب sale_id من البيانات المعروضة في modal
    // الأولوية: استخدام sale_id المحفوظ في المتغير
    let saleId = window.currentInvoiceSaleId || null;
    
    // إذا لم يكن موجوداً، البحث في HTML
    if (!saleId) {
        const saleIdMatch = invoiceBody.innerHTML.match(/data-sale-id=["']([^"']+)["']/);
        if (saleIdMatch && saleIdMatch[1]) {
            saleId = saleIdMatch[1];
        }
    }
    
    // إذا لم يكن موجوداً، استخدام آخر عملية بيع
    if (!saleId) {
        const lastSaleData = window.lastSaleData;
        if (lastSaleData && lastSaleData.id) {
            saleId = lastSaleData.id;
        }
    }
    
    // التأكد من أن sale_id صحيح وليس فاتورة سابقة
    if (!saleId) {
        console.error('لم يتم العثور على sale_id للفاتورة');
        showMessage('خطأ: لم يتم العثور على بيانات الفاتورة', 'error');
        return;
    }
    
    // إذا كان هناك sale_id، استخدم النظام الجديد
    if (saleId) {
        const invoiceUrl = `api/invoice-view.php?sale_id=${encodeURIComponent(saleId)}`;
        
        // فتح الفاتورة في نافذة جديدة مع اسم محدد لسهولة الإغلاق
        // استخدام نفس الاسم للنافذة لضمان إغلاق النافذة القديمة إذا كانت مفتوحة
        const windowName = 'invoice_print_window';
        const printWindow = window.open(invoiceUrl, windowName, 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
        
        if (!printWindow) {
            showMessage('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة', 'error');
            return;
        }
        
        // حفظ مرجع النافذة للاستخدام لاحقاً
        window.currentInvoiceWindow = printWindow;
        
        // التأكد من أن النافذة مفتوحة بشكل صحيح
        try {
            printWindow.focus();
        } catch (e) {
            console.debug('لا يمكن التركيز على النافذة:', e);
        }
        
        // انتظار تحميل الصفحة ثم طباعتها
        const checkLoad = setInterval(() => {
            try {
                if (printWindow.closed) {
                    clearInterval(checkLoad);
                    window.currentInvoiceWindow = null;
                    return;
                }
                
                // التحقق من تحميل الصفحة
                if (printWindow.document && printWindow.document.readyState === 'complete') {
                    clearInterval(checkLoad);
                    setTimeout(() => {
                        try {
                            if (!printWindow.closed) {
                                printWindow.print();
                            }
                        } catch (e) {
                            console.debug('خطأ في الطباعة:', e);
                        }
                    }, 500);
                }
            } catch (e) {
                // إذا كان هناك خطأ في الوصول للنافذة
                clearInterval(checkLoad);
                console.debug('لا يمكن الوصول للنافذة:', e);
            }
        }, 100);
        
        // timeout أقصى (10 ثواني) للتأكد من عدم الانتظار إلى ما لا نهاية
        setTimeout(() => {
            clearInterval(checkLoad);
        }, 10000);
        
        // معالجة إغلاق النافذة
        const checkWindowClosed = setInterval(() => {
            try {
                if (printWindow.closed) {
                    clearInterval(checkWindowClosed);
                    window.currentInvoiceWindow = null;
                }
            } catch (e) {
                // إذا كان هناك خطأ، النافذة مغلقة على الأرجح
                clearInterval(checkWindowClosed);
                window.currentInvoiceWindow = null;
            }
        }, 500);
        
        return;
    }
    
    // Fallback للطريقة القديمة (إذا لم يكن sale_id متوفراً)
    // Ensure modal is visible for printing
    if (invoiceModal) {
        invoiceModal.classList.add('active');
    }
    
    // Wait a bit for rendering and image loading, then print
    setTimeout(() => {
        // التأكد من تحميل جميع الصور قبل الطباعة (اللوجو وQR Code)
        const logoImg = document.querySelector('.invoice-logo');
        const qrCodeImg = document.querySelector('.invoice-qrcode img');
        
        // timeout أقصى للانتظار (5 ثواني) - في حالة فشل تحميل الصور
        const maxTimeout = setTimeout(() => {
            console.warn('انتهت مهلة الانتظار لتحميل الصور، سيتم الطباعة الآن');
            window.print();
        }, 5000);
        
        // دالة للتحقق من تحميل جميع الصور
        const checkImagesAndPrint = () => {
            let imagesLoaded = 0;
            let imagesToCheck = 0;
            let hasError = false;
            let printCalled = false;
            
            // دالة مساعدة للطباعة (تضمن عدم الطباعة مرتين)
            const doPrint = () => {
                if (!printCalled) {
                    printCalled = true;
                    clearTimeout(maxTimeout);
                    setTimeout(() => window.print(), 200);
                }
            };
            
            // التحقق من اللوجو
            if (logoImg) {
                imagesToCheck++;
                if (logoImg.complete && logoImg.naturalHeight !== 0) {
                    imagesLoaded++;
                } else {
                    logoImg.onload = () => {
                        imagesLoaded++;
                        if (imagesLoaded === imagesToCheck) {
                            doPrint();
                        }
                    };
                    logoImg.onerror = () => {
                        hasError = true;
                        imagesLoaded++;
                        if (imagesLoaded === imagesToCheck) {
                            doPrint();
                        }
                    };
                }
            }
            
            // التحقق من QR Code (الأهم)
            if (qrCodeImg) {
                imagesToCheck++;
                if (qrCodeImg.complete && qrCodeImg.naturalHeight !== 0) {
                    imagesLoaded++;
                } else {
                    qrCodeImg.onload = () => {
                        imagesLoaded++;
                        if (imagesLoaded === imagesToCheck) {
                            doPrint();
                        }
                    };
                    qrCodeImg.onerror = () => {
                        hasError = true;
                        imagesLoaded++;
                        if (imagesLoaded === imagesToCheck) {
                            doPrint();
                        }
                    };
                }
            }
            
            // إذا لم تكن هناك صور للتحقق منها، اطبع مباشرة
            if (imagesToCheck === 0) {
                doPrint();
            } else if (imagesLoaded === imagesToCheck) {
                // جميع الصور محملة بالفعل
                doPrint();
            }
        };
        
        checkImagesAndPrint();
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
    // التأكد من إغلاق جميع الـ modals الأخرى أولاً
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.classList.remove('active');
    }
    
    // إزالة أي modals موجودة مسبقاً
    const existingRatingModals = document.querySelectorAll('.modal[data-rating-modal]');
    existingRatingModals.forEach(m => m.remove());
    
    // التحقق من صحة customerId و saleId
    if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
        console.warn('showRatingModal: customerId غير صحيح، سيتم تخطي عرض modal التقييم');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.setAttribute('data-rating-modal', 'true');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 20000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); animation: fadeIn 0.3s ease;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px; width: 90%; max-height: 90vh; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: slideUp 0.4s ease; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--warning-color) 0%, #FFB74D 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                    <i class="bi bi-star-fill" style="font-size: 1.3em;"></i> تقييم العملية
                </h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 40px 30px; text-align: center; overflow-y: auto; flex: 1; min-height: 0;">
                <div style="margin-bottom: 10px;">
                    <i class="bi bi-emoji-smile" style="font-size: 3em; color: var(--warning-color); margin-bottom: 15px; display: block; animation: bounce 2s infinite;"></i>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 1.3em; font-weight: 600;">
                        كيف تقيم هذه العملية؟
                    </h4>
                    <p style="margin: 0; color: var(--text-light); font-size: 0.95em;">
                        شاركنا رأيك لمساعدتنا على التحسين
                    </p>
                </div>
                
                <div id="ratingStarsContainer" style="display: flex; justify-content: center; gap: 10px; font-size: 45px; margin: 35px 0; padding: 20px 0;">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <div style="position: relative; display: inline-block;">
                            <i class="bi bi-star" 
                               data-rating="${star}" 
                               onclick="selectRatingStarPOS(this, ${star}, '${customerId}', '${saleId}')"
                               style="cursor: pointer; color: var(--border-color); transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"
                               onmouseover="highlightRatingStarsPOS(this, ${star})"
                               onmouseout="resetRatingStarsPOS(this)"></i>
                        </div>
                    `).join('')}
                </div>
                
                <div id="ratingFeedback" style="margin-top: 15px; min-height: 30px;">
                    <p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0; transition: all 0.3s ease;">
                        اختر من <strong style="color: var(--warning-color);">1</strong> إلى <strong style="color: var(--warning-color);">5</strong> نجوم
                    </p>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: center; padding: 20px 30px; border-top: 1px solid var(--border-color); background: var(--light-bg); flex-shrink: 0;">
                <button onclick="skipRating('${customerId}', '${saleId}')" class="btn btn-secondary" style="background: var(--text-light); color: var(--white); border: none; padding: 12px 30px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 102, 102, 0.3)';" onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <i class="bi bi-arrow-left"></i> تخطي
                </button>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes bounce {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-10px);
                }
            }
            
            @keyframes starPulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.2);
                }
            }
            
            #ratingStarsContainer i[data-rating] {
                position: relative;
            }
            
            #ratingStarsContainer i[data-rating]:hover {
                transform: scale(1.3) rotate(15deg) !important;
            }
            
            #ratingStarsContainer i[data-rating].bi-star-fill {
                animation: starPulse 0.5s ease;
            }
            
            @media (max-width: 480px) {
                .modal-content {
                    max-width: 95% !important;
                    margin: 20px;
                    max-height: 85vh !important;
                }
                
                #ratingStarsContainer {
                    font-size: 35px !important;
                    gap: 8px !important;
                }
                
                .modal-body {
                    padding: 30px 20px !important;
                }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
    // modal.addEventListener('click', function(e) {
    //     if (e.target === modal) {
    //         modal.remove();
    //     }
    // });
}

// تحديد نجمة التقييم في POS
function selectRatingStarPOS(element, rating, customerId, saleId) {
    const container = element.parentElement.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('ratingFeedback');
    
    // Update feedback text based on rating
    const feedbackTexts = {
        1: '<p style="color: var(--danger-color); font-weight: 600; margin: 0;">رديء جداً 😞</p>',
        2: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">رديء 😐</p>',
        3: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">متوسط 🙂</p>',
        4: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">جيد جداً 😊</p>',
        5: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">ممتاز 😍</p>'
    };
    
    if (feedbackDiv) {
        feedbackDiv.innerHTML = feedbackTexts[rating] || '';
    }
    
    stars.forEach((star, index) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating) {
            star.className = 'bi bi-star-fill';
            star.style.color = rating <= 2 ? 'var(--danger-color)' : rating <= 3 ? 'var(--warning-color)' : 'var(--success-color)';
            star.style.filter = `drop-shadow(0 4px 8px ${rating <= 2 ? 'rgba(244, 67, 54, 0.4)' : rating <= 3 ? 'rgba(255, 165, 0, 0.4)' : 'rgba(76, 175, 80, 0.4)'})`;
            star.style.transform = 'scale(1.2)';
            
            // Add animation delay for each star
            setTimeout(() => {
                star.style.transform = 'scale(1.1)';
            }, 100 * (index + 1));
        } else {
            star.className = 'bi bi-star';
            star.style.color = 'var(--border-color)';
            star.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
            star.style.transform = 'scale(1)';
        }
        star.style.pointerEvents = 'none'; // منع النقر بعد الاختيار
        star.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    });
    
    // حفظ التقييم بعد تأخير بسيط للسماح بالرسوم المتحركة
    setTimeout(() => {
        saveRatingPOS(customerId, saleId, rating, container);
    }, 300);
}

// تمييز النجوم عند المرور بالماوس في POS
function highlightRatingStarsPOS(element, rating) {
    const container = element.parentElement.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('ratingFeedback');
    
    // Show preview feedback
    const feedbackTexts = {
        1: '<p style="color: var(--danger-color); font-weight: 600; margin: 0;">رديء جداً 😞</p>',
        2: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">رديء 😐</p>',
        3: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">متوسط 🙂</p>',
        4: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">جيد جداً 😊</p>',
        5: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">ممتاز 😍</p>'
    };
    
    if (feedbackDiv && !container.querySelector('.bi-star-fill')) {
        feedbackDiv.innerHTML = feedbackTexts[rating] || '<p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0;">اختر من <strong style="color: var(--warning-color);">1</strong> إلى <strong style="color: var(--warning-color);">5</strong> نجوم</p>';
    }
    
    stars.forEach((star) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating && star.className !== 'bi bi-star-fill') {
            star.style.color = rating <= 2 ? 'var(--danger-color)' : rating <= 3 ? 'var(--warning-color)' : 'var(--success-color)';
            star.style.transform = 'scale(1.25)';
            star.style.filter = `drop-shadow(0 4px 8px ${rating <= 2 ? 'rgba(244, 67, 54, 0.3)' : rating <= 3 ? 'rgba(255, 165, 0, 0.3)' : 'rgba(76, 175, 80, 0.3)'})`;
        }
    });
}

// إعادة تعيين النجوم في POS
function resetRatingStarsPOS(element) {
    const container = element.parentElement.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('ratingFeedback');
    const hasSelectedStars = container.querySelector('.bi-star-fill');
    
    if (!hasSelectedStars) {
        stars.forEach((star) => {
            if (star.className !== 'bi bi-star-fill') {
                star.style.color = 'var(--border-color)';
                star.style.transform = 'scale(1)';
                star.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
            }
        });
        
        if (feedbackDiv) {
            feedbackDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0;">اختر من <strong style="color: var(--warning-color);">1</strong> إلى <strong style="color: var(--warning-color);">5</strong> نجوم</p>';
        }
    }
}

// حفظ التقييم في POS
async function saveRatingPOS(customerId, saleId, rating, starsContainer) {
    try {
        const result = await API.saveCustomerRating(customerId, saleId, rating);
        
        if (result && result.success) {
            // Show success animation
            const feedbackDiv = document.getElementById('ratingFeedback');
            if (feedbackDiv) {
                feedbackDiv.innerHTML = '<p style="color: var(--success-color); font-weight: 600; margin: 0; animation: fadeIn 0.3s ease;"><i class="bi bi-check-circle"></i> شكراً لك! تم حفظ التقييم بنجاح</p>';
            }
            
            showMessage('تم حفظ التقييم بنجاح', 'success');
            
            // إغلاق modal بعد ثانية ونصف للسماح برؤية رسالة النجاح
            setTimeout(() => {
                const modal = starsContainer.closest('.modal');
                if (modal) {
                    modal.style.opacity = '0';
                    modal.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        modal.remove();
                    }, 300);
                }
            }, 1500);
        } else {
            const errorMsg = result?.message || 'خطأ غير معروف';
            showMessage(`❌ فشل حفظ التقييم: ${errorMsg}.`, 'error');
            // إعادة تفعيل النجوم في حالة الخطأ
            const stars = starsContainer.querySelectorAll('[data-rating]');
            stars.forEach(star => {
                star.style.pointerEvents = 'auto';
            });
        }
    } catch (error) {
        console.error('خطأ في حفظ التقييم:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        showMessage(`❌ فشل حفظ التقييم: ${errorMessage}.`, 'error');
        // إعادة تفعيل النجوم في حالة الخطأ
        const stars = starsContainer.querySelectorAll('[data-rating]');
        stars.forEach(star => {
            star.style.pointerEvents = 'auto';
        });
    }
}

// تخطي التقييم
function skipRating(customerId, saleId) {
    // البحث عن modal التقييم المحدد
    const ratingModal = document.querySelector('.modal[data-rating-modal]');
    if (ratingModal) {
        ratingModal.remove();
    } else {
        // إذا لم يتم العثور على modal محدد، البحث عن أي modal يحتوي على ratingStarsContainer
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.querySelector('#ratingStarsContainer')) {
                modal.remove();
            }
        });
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
window.updatePaymentAmount = updatePaymentAmount;
window.setFullPayment = setFullPayment;
window.setPartialPayment = setPartialPayment;

// POS Barcode Scanner
let posScannerOpen = false;
let posQRCodeScannerInstance = null;
let posScannerLocked = false; // منع القراءات المتكررة
let posCurrentCameraFacing = 'environment'; // 'environment' للخلفية، 'user' للأمامية
let posCurrentCameraId = null; // ID الكاميرا الحالية

// Open Barcode Scanner for POS
async function openPOSBarcodeScanner() {
    if (posScannerOpen) {
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    const existingModal = document.getElementById('posBarcodeScannerModal');
    if (existingModal) {
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('❌ الكاميرا غير متوفرة في هذا المتصفح. يرجى استخدام متصفح يدعم الكاميرا (Chrome, Firefox, Safari).', 'error');
        return;
    }
    
    // Load html5-qrcode library
    if (typeof Html5Qrcode === 'undefined') {
        if (typeof window.loadHtml5Qrcode === 'function') {
            try {
                await window.loadHtml5Qrcode();
            } catch (error) {
                console.error('Error loading html5-qrcode:', error);
                const errorMessage = error?.message || 'خطأ غير معروف';
                showMessage(`❌ فشل تحميل مكتبة قراءة QR Code: ${errorMessage}. يرجى التحقق من الاتصال بالإنترنت.`, 'error');
                return;
            }
        } else {
            showMessage('❌ مكتبة قراءة QR Code غير متاحة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
            return;
        }
    }
    
    posScannerOpen = true;
    
    const modal = document.createElement('div');
    modal.id = 'posBarcodeScannerModal';
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 20000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-width: 600px; width: 100%; max-height: 90vh; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: modalSlideIn 0.3s ease; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                    <i class="bi bi-qr-code-scan" style="font-size: 1.3em;"></i> قراءة QR Code للمنتج
                </h2>
                <button onclick="closePOSBarcodeScanner()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px; text-align: center; overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; -webkit-overflow-scrolling: touch;">
                <div id="pos-barcode-scanner-container">
                    <div id="pos-qr-reader" style="width: 100%; min-height: 350px; border-radius: 15px; overflow: hidden; background: var(--light-bg); position: relative; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);">
                        <div id="pos-scanner-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; text-align: center; color: var(--text-dark);">
                            <i class="bi bi-camera" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block; animation: pulse 2s infinite;"></i>
                            <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">جاري تحميل قارئ QR Code...</p>
                            <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا</p>
                        </div>
                        <div id="pos-scanner-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
                            <!-- مربع المسح الرئيسي - أوسع للباركود -->
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 350px; height: 200px; border: 4px solid var(--primary-color); border-radius: 20px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 40px rgba(33, 150, 243, 0.6), inset 0 0 20px rgba(33, 150, 243, 0.2); background: rgba(255,255,255,0.05);"></div>
                            
                            <!-- زوايا المربع - أكثر وضوحاً -->
                            <div style="position: absolute; top: calc(50% - 100px); left: calc(50% - 175px); width: 350px; height: 200px;">
                                <!-- الزاوية العلوية اليسرى -->
                                <div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-top: 5px solid var(--success-color); border-left: 5px solid var(--success-color); border-radius: 8px 0 0 0; box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);"></div>
                                <!-- الزاوية العلوية اليمنى -->
                                <div style="position: absolute; top: 0; right: 0; width: 40px; height: 40px; border-top: 5px solid var(--success-color); border-right: 5px solid var(--success-color); border-radius: 0 8px 0 0; box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);"></div>
                                <!-- الزاوية السفلية اليسرى -->
                                <div style="position: absolute; bottom: 0; left: 0; width: 40px; height: 40px; border-bottom: 5px solid var(--success-color); border-left: 5px solid var(--success-color); border-radius: 0 0 0 8px; box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);"></div>
                                <!-- الزاوية السفلية اليمنى -->
                                <div style="position: absolute; bottom: 0; right: 0; width: 40px; height: 40px; border-bottom: 5px solid var(--success-color); border-right: 5px solid var(--success-color); border-radius: 0 0 8px 0; box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);"></div>
                            </div>
                            
                            <!-- نص إرشادي داخل المربع -->
                            <div style="position: absolute; top: calc(50% + 120px); left: 50%; transform: translateX(-50%); text-align: center; color: var(--white); background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px; font-size: 0.85em; font-weight: 600; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                                <i class="bi bi-arrows-move" style="margin-left: 5px; font-size: 1.1em;"></i>
                                ضع الباركود داخل الإطار
                            </div>
                            
                            <!-- خطوط إرشادية داخل المربع -->
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 350px; height: 200px; opacity: 0.3;">
                                <!-- خط أفقي في المنتصف -->
                                <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--primary-color), transparent);"></div>
                                <!-- خط عمودي في المنتصف -->
                                <div style="position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent);"></div>
                            </div>
                        </div>
                    </div>
                    <div id="pos-scanner-result" style="margin-top: 25px; display: none; animation: slideDown 0.4s ease;">
                        <div style="padding: 25px; border-radius: 15px; background: linear-gradient(135deg, var(--success-color) 0%, #66BB6A 100%); color: var(--white); border: none; box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                                <i class="bi bi-check-circle-fill" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">تم العثور على المنتج!</h4>
                            </div>
                            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                <p id="pos-scanned-product-name" style="margin: 0; font-size: 1.1em; font-weight: 600;"></p>
                            </div>
                        </div>
                    </div>
                    <div id="pos-scanner-error" style="margin-top: 25px; display: none; animation: slideDown 0.4s ease;">
                        <div style="padding: 25px; border-radius: 15px; background: linear-gradient(135deg, var(--danger-color) 0%, #e57373 100%); color: var(--white); border: none; box-shadow: 0 8px 25px rgba(244, 67, 54, 0.4);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                                <i class="bi bi-exclamation-triangle-fill" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">المنتج غير موجود</h4>
                            </div>
                            <p id="pos-scanner-error-message" style="margin: 0; line-height: 1.8; opacity: 0.95;"></p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: center; padding: 20px 30px; border-top: 1px solid var(--border-color); background: var(--light-bg); flex-shrink: 0;">
                <!-- زر التقاط صورة للهواتف (بديل للكاميرا المباشرة) -->
                <button id="pos-scan-image-btn" onclick="openPOSImageScanner()" class="btn" style="background: var(--primary-color); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease; display: none;" onmouseover="this.style.background='var(--secondary-color)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='var(--primary-color)'; this.style.transform='translateY(0)';">
                    <i class="bi bi-camera-fill" style="margin-left: 8px;"></i>التقاط صورة
                </button>
                <button onclick="closePOSBarcodeScanner()" class="btn btn-secondary" style="background: var(--text-light); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)';">إغلاق</button>
            </div>
            <!-- Input file مخفي للهواتف -->
            <input type="file" id="pos-qr-image-input" accept="image/*" capture="environment" style="display: none;">
        </div>
        <style>
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-15px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
            
            #pos-qr-reader video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 15px;
            }
            
            #pos-qr-reader canvas {
                display: none;
            }
            
            /* Scrollbar styling for modal body */
            #posBarcodeScannerModal .modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            #posBarcodeScannerModal .modal-body::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 4px;
            }
            
            #posBarcodeScannerModal .modal-body::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            
            #posBarcodeScannerModal .modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--text-light);
            }
            
            /* Firefox scrollbar */
            #posBarcodeScannerModal .modal-body {
                scrollbar-width: thin;
                scrollbar-color: var(--border-color) var(--light-bg);
            }
            
            @media (max-width: 768px) {
                #posBarcodeScannerModal .modal-content {
                    max-width: 95% !important;
                    max-height: 95vh !important;
                    margin: 10px;
                }
                
                #posBarcodeScannerModal .modal-body {
                    padding: 20px !important;
                }
                
                #posBarcodeScannerModal .modal-header {
                    padding: 20px !important;
                }
                
                #posBarcodeScannerModal .modal-header h2 {
                    font-size: 1.2em !important;
                }
                
                #posBarcodeScannerModal .modal-footer {
                    padding: 15px 20px !important;
                    flex-wrap: wrap;
                }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const closeBtn = modal.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePOSBarcodeScanner();
            });
        }
        
        // التأكد من أن overlay لا يسمح بالضغط (منع التبديل بين الكاميرات)
        const qrReader = document.getElementById('pos-qr-reader');
        if (qrReader) {
            // التأكد من أن overlay لا يسمح بالضغط
            const overlay = document.getElementById('pos-scanner-overlay');
            if (overlay) {
                overlay.style.pointerEvents = 'none'; // منع الضغط على overlay
                overlay.style.cursor = 'default';
            }
            
            // إزالة أي hints للتبديل بين الكاميرات
            const existingHint = document.getElementById('pos-camera-toggle-hint');
            if (existingHint) {
                existingHint.remove();
            }
        }
        
        initializePOSQRCodeScanner();
        
        // إظهار زر التقاط صورة على الهواتف فقط (في modal)
        const isMobileDevice = window.innerWidth <= 767.98;
        const scanImageBtn = document.getElementById('pos-scan-image-btn');
        if (scanImageBtn && isMobileDevice) {
            scanImageBtn.style.display = 'inline-block';
        }
        
        // إضافة event listener لـ file input (في modal)
        const fileInput = document.getElementById('pos-qr-image-input');
        if (fileInput) {
            fileInput.addEventListener('change', handlePOSImageFileSelected);
        }
        
    }, 300);
}

// Initialize POS QR Code Scanner automatically (for inline scanner)
async function initializePOSQRCodeScannerAuto() {
    const isMobile = window.innerWidth <= 767.98;
    
    // للهواتف: استخدام الماسح المدمج
    if (isMobile) {
        // على الهواتف، تهيئة الماسح المدمج
        const qrReader = document.getElementById('pos-qr-reader-mobile');
        if (!qrReader) {
            // Retry after 200ms
            setTimeout(() => {
                initializePOSQRCodeScannerAuto();
            }, 200);
            return;
        }
        
        // تهيئة الماسح للهواتف
        await initializePOSQRCodeScannerMobile();
        return;
    }
    
    // لسطح المكتب: استخدام الطريقة الحالية
    // Check for desktop QR scanner
    const qrReader = document.getElementById('pos-qr-reader');
    
    if (!qrReader) {
        console.warn('⚠️ [POS Scanner] QR Scanner container not found');
        // Retry after 500ms
        setTimeout(() => {
            initializePOSQRCodeScannerAuto();
        }, 500);
        return;
    }
    
    // Check if scanner is already initialized and running
    if (posQRCodeScannerInstance) {
        try {
            // Try to get state to check if scanner is running
            const state = posQRCodeScannerInstance.getState();
            if (state === 2 || state === 'SCANNING') {
                console.log('✅ [POS Scanner] Scanner already running');
                return;
            }
        } catch (e) {
            // Scanner exists but not running, reset it
            console.log('🔄 [POS Scanner] Scanner exists but not running, resetting...');
            posQRCodeScannerInstance = null;
            posScannerOpen = false;
        }
    }
    
    // Check if html5-qrcode library is loaded
    if (typeof Html5Qrcode === 'undefined') {
        console.log('📚 [POS Scanner] Loading html5-qrcode library...');
        // Load library first
        if (typeof window.loadHtml5Qrcode === 'function') {
            try {
                await window.loadHtml5Qrcode();
                // Wait a bit for library to fully initialize
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error('❌ [POS Scanner] Error loading html5-qrcode:', error);
                const loadingDiv = document.getElementById('pos-scanner-loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <i class="bi bi-exclamation-triangle" style="font-size: 2em; color: var(--danger-color); margin-bottom: 10px; display: block;"></i>
                        <p style="font-size: 0.9em; font-weight: 600; color: var(--text-dark);">فشل تحميل مكتبة QR Code</p>
                        <p style="font-size: 0.8em; color: var(--text-light); margin-top: 5px;">يرجى تحديث الصفحة</p>
                    `;
                }
                return;
            }
        } else {
            console.error('❌ [POS Scanner] html5-qrcode library not available');
            const loadingDiv = document.getElementById('pos-scanner-loading');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <i class="bi bi-exclamation-triangle" style="font-size: 2em; color: var(--danger-color); margin-bottom: 10px; display: block;"></i>
                    <p style="font-size: 0.9em; font-weight: 600; color: var(--text-dark);">مكتبة QR Code غير متاحة</p>
                    <p style="font-size: 0.8em; color: var(--text-light); margin-top: 5px;">يرجى تحديث الصفحة</p>
                `;
            }
            return;
        }
    }
    
    console.log('🚀 [POS Scanner] Starting scanner initialization...');
    posScannerOpen = true;
    await initializePOSQRCodeScanner();
    
    // التأكد من أن overlay لا يسمح بالضغط (منع التبديل بين الكاميرات)
    const qrReaderDesktop = document.getElementById('pos-qr-reader');
    
    if (qrReaderDesktop) {
        // التأكد من أن overlay لا يسمح بالضغط
        const overlay = document.getElementById('pos-scanner-overlay');
        if (overlay) {
            overlay.style.pointerEvents = 'none'; // منع الضغط على overlay
            overlay.style.cursor = 'default';
        }
    }
}

// Initialize POS QR Code Scanner for Mobile (Simplified - based on product-returns.js)
async function initializePOSQRCodeScannerMobile() {
    const qrReader = document.getElementById('pos-qr-reader-mobile');
    const loadingDiv = document.getElementById('pos-scanner-loading-mobile');
    const errorDiv = document.getElementById('pos-scanner-error-mobile');
    
    if (!qrReader) return;
    
    // Hide error initially
    if (errorDiv) errorDiv.style.display = 'none';
    
    // Check if Html5Qrcode is loaded
    if (typeof Html5Qrcode === 'undefined') {
        if (loadingDiv) {
            loadingDiv.innerHTML = '<i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i><p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">خطأ: مكتبة QR Code غير متاحة</p>';
        }
        return;
    }
    
    try {
        // Stop existing scanner if any
        if (posQRCodeScannerInstance) {
            try {
                await posQRCodeScannerInstance.stop().catch(() => {});
                await posQRCodeScannerInstance.clear().catch(() => {});
            } catch (e) {
                // Ignore errors
            }
            posQRCodeScannerInstance = null;
        }
        
        // Create scanner instance (same as product-returns.js)
        posQRCodeScannerInstance = new Html5Qrcode("pos-qr-reader-mobile");
        posScannerOpen = true;
        
        // Configuration for QR code scanning (same as product-returns.js)
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };
        
        // Add supportedScanTypes if available (newer versions)
        if (typeof Html5QrcodeScanType !== 'undefined') {
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }
        
        // ✅ التحقق من صلاحية الكاميرا قبل البدء (لتجنب طلب الصلاحية مرة أخرى)
        if (typeof window.checkCameraPermission === 'function') {
            const permissionState = await window.checkCameraPermission();
            if (permissionState === 'denied') {
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i>
                        <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">تم رفض صلاحية الكاميرا</p>
                        <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح</p>
                    `;
                }
                return;
            }
        }
        
        // Start scanning (same as product-returns.js)
        await posQRCodeScannerInstance.start(
            { facingMode: "environment" }, // Use back camera
            config,
            (decodedText, decodedResult) => {
                // Success callback - تنظيف النص ومعالجته
                if (!decodedText || typeof decodedText !== 'string') {
                    return;
                }
                
                // تنظيف النص المقروء - إزالة المسافات والأحرف غير المرئية
                const cleanedText = decodedText
                    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
                    .replace(/\s+/g, ' ') // Normalize spaces
                    .trim(); // Remove leading/trailing spaces
                
                if (!cleanedText || cleanedText.length === 0) {
                    return;
                }
                
                // اهتزاز خفيف (موبايل) عند قراءة QR Code
                if (navigator.vibrate) {
                    navigator.vibrate(100); // اهتزاز خفيف (100ms)
                }
                
                // معالجة QR Code المقروء - استمرار المسح (لا نوقف الكاميرا)
                handlePOSQRCodeScanned(cleanedText);
            },
            (errorMessage) => {
                // Error callback (ignore continuous errors while scanning)
                // Only show errors for actual failures, not during normal scanning
            }
        );
        
        // Hide loading indicator once scanner starts
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
    } catch (error) {
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i>
                <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">خطأ في بدء الكاميرا</p>
                <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">${error.message || 'يرجى التحقق من أذونات الكاميرا'}</p>
            `;
        }
        
        if (errorDiv) {
            const errorMessageEl = document.getElementById('pos-scanner-error-message-mobile');
            if (errorMessageEl) {
                errorMessageEl.textContent = error.message || 'فشل في الوصول إلى الكاميرا. يرجى التحقق من الأذونات والمحاولة مرة أخرى.';
            }
            errorDiv.style.display = 'block';
        }
        
        // Reset instance on error
        posQRCodeScannerInstance = null;
        posScannerOpen = false;
    }
}

// Initialize POS QR Code Scanner
async function initializePOSQRCodeScanner() {
    const timestamp = new Date().toISOString();
    console.log('🚀 [POS Scanner] بدء تهيئة القارئ -', timestamp);
    
    // Check for mobile scanner first, then desktop
    const isMobile = window.innerWidth <= 767.98;
    const qrReaderId = isMobile ? 'pos-qr-reader-mobile' : 'pos-qr-reader';
    const loadingDivId = isMobile ? 'pos-scanner-loading-mobile' : 'pos-scanner-loading';
    const errorDivId = isMobile ? 'pos-scanner-error-mobile' : 'pos-scanner-error';
    
    console.log('📱 [POS Scanner] نوع الجهاز:', isMobile ? 'هاتف' : 'كمبيوتر');
    console.log('🔍 [POS Scanner] QR Reader ID:', qrReaderId);
    console.log('🔍 [POS Scanner] Loading Div ID:', loadingDivId);
    console.log('🔍 [POS Scanner] Error Div ID:', errorDivId);
    
    const qrReader = document.getElementById(qrReaderId);
    const loadingDiv = document.getElementById(loadingDivId);
    const errorDiv = document.getElementById(errorDivId);
    
    if (!qrReader) {
        console.error('❌ [POS Scanner] QR Reader element not found:', qrReaderId);
        console.error('❌ [POS Scanner] جميع العناصر المتاحة:', {
            'pos-qr-reader-mobile': !!document.getElementById('pos-qr-reader-mobile'),
            'pos-qr-reader': !!document.getElementById('pos-qr-reader'),
            'pos-scanner-loading-mobile': !!document.getElementById('pos-scanner-loading-mobile'),
            'pos-scanner-loading': !!document.getElementById('pos-scanner-loading')
        });
        return;
    }
    
    console.log('✅ [POS Scanner] QR Reader element found:', qrReaderId);
    console.log('📐 [POS Scanner] QR Reader dimensions:', {
        width: qrReader.offsetWidth,
        height: qrReader.offsetHeight
    });
    
    // Hide error initially
    if (errorDiv) {
        errorDiv.style.display = 'none';
        console.log('✅ [POS Scanner] Error div hidden');
    }
    
    // Check if Html5Qrcode is loaded
    if (typeof Html5Qrcode === 'undefined') {
        console.error('❌ [POS Scanner] Html5Qrcode library not loaded');
        if (loadingDiv) {
            loadingDiv.innerHTML = '<i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i><p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">خطأ: مكتبة QR Code غير متاحة</p>';
        }
        return;
    }
    
    console.log('✅ [POS Scanner] Html5Qrcode library loaded');
    
    try {
        // Check if already running - simple check
        if (posQRCodeScannerInstance) {
            try {
                // Try to check state, if fails, scanner is not running
                const state = posQRCodeScannerInstance.getState();
                if (state === 2 || state === 'SCANNING') { // SCANNING state
                    console.log('Scanner already running');
                    if (loadingDiv) loadingDiv.style.display = 'none';
                    return;
                } else {
                    // Scanner exists but not running, clear it before creating new instance
                    console.log('🔄 [POS Scanner] الماسح موجود ولكن غير نشط، إعادة إنشاء...');
                    try {
                        await posQRCodeScannerInstance.stop().catch(() => {});
                        await posQRCodeScannerInstance.clear().catch(() => {});
                    } catch (e) {
                        // Ignore errors
                    }
                    posQRCodeScannerInstance = null;
                }
            } catch (e) {
                // Scanner not running or error checking state, clear it
                console.log('🔄 [POS Scanner] خطأ في التحقق من حالة الماسح، إعادة إنشاء...');
                try {
                    await posQRCodeScannerInstance.stop().catch(() => {});
                    await posQRCodeScannerInstance.clear().catch(() => {});
                } catch (clearError) {
                    // Ignore errors
                }
                posQRCodeScannerInstance = null;
            }
        }
        
        // Create scanner instance (use mobile or desktop based on screen size)
        const scannerId = isMobile ? 'pos-qr-reader-mobile' : 'pos-qr-reader';
        posQRCodeScannerInstance = new Html5Qrcode(scannerId);
        
        // إعدادات المسح - دعم QR Code والباركود (محسنة للأداء)
        const config = {
            fps: 30, // زيادة FPS من 10 إلى 30 للسرعة الأفضل
            qrbox: isMobile ? { width: 280, height: 280 } : { width: 350, height: 350 }, // زيادة حجم صندوق القراءة
            aspectRatio: 1.0,
            disableFlip: false
            // ✅ لا نستخدم videoConstraints هنا لأنها تسبب تضارب مع facingMode في cameraConfig
        };
        
        // Add supportedScanTypes if available (newer versions)
        if (typeof Html5QrcodeScanType !== 'undefined') {
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }
        
        console.log('🔍 [POS Scanner] بدء المسح مع الإعدادات:', config);
        
        // ✅ التحقق من صلاحية الكاميرا قبل البدء (لتجنب طلب الصلاحية مرة أخرى)
        if (typeof window.checkCameraPermission === 'function') {
            const permissionState = await window.checkCameraPermission();
            if (permissionState === 'denied') {
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <i class="bi bi-exclamation-triangle" style="font-size: 3em; color: var(--danger-color); margin-bottom: 15px; display: block;"></i>
                        <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">تم رفض صلاحية الكاميرا</p>
                        <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح</p>
                    `;
                }
                return;
            }
        }
        
        // ✅ على الهواتف: استخدام الكاميرا الخلفية مباشرة (environment) - مهم جداً
        // على سطح المكتب: يمكن استخدام الكاميرا المناسبة
        const cameraConfig = isMobile 
            ? { facingMode: "environment" }  // للهواتف: الكاميرا الخلفية مباشرة
            : (posCurrentCameraFacing ? { facingMode: posCurrentCameraFacing } : { facingMode: "environment" });
        
        console.log(`🎥 [POS Scanner] استخدام الكاميرا:`, cameraConfig);
        
        await posQRCodeScannerInstance.start(
            cameraConfig,
            config,
            (decodedText, decodedResult) => {
                // Success callback - تم قراءة QR Code بنجاح
                const timestamp = new Date().toISOString();
                
                // ✅ تنظيف النص المقروء - إزالة المسافات والأحرف غير المرئية
                let cleanedText = decodedText;
                if (decodedText && typeof decodedText === 'string') {
                    cleanedText = decodedText
                        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
                        .replace(/\s+/g, ' ') // Normalize spaces
                        .trim(); // Remove leading/trailing spaces
                }
                
                const logData = {
                    timestamp: timestamp,
                    success: true,
                    decodedText: decodedText,
                    cleanedText: cleanedText,
                    decodedResult: decodedResult,
                    scannerId: scannerId,
                    isMobile: isMobile,
                    cameraConfig: cameraConfig
                };
                
                // Log مفصل في console
                console.log('✅✅✅ [POS Scanner] تم قراءة QR Code بنجاح ✅✅✅');
                console.log('📋 [POS Scanner] البيانات المقروءة (Raw):', decodedText);
                console.log('📋 [POS Scanner] البيانات المقروءة (Cleaned):', cleanedText);
                console.log('📊 [POS Scanner] تفاصيل القراءة:', decodedResult);
                console.log('📱 [POS Scanner] نوع الجهاز:', isMobile ? 'هاتف' : 'كمبيوتر');
                console.log('📷 [POS Scanner] إعدادات الكاميرا:', cameraConfig);
                console.log('⏰ [POS Scanner] الوقت:', timestamp);
                console.log('📦 [POS Scanner] Log Data:', JSON.stringify(logData, null, 2));
                
                // Log في error log أيضاً
                try {
                    const logMessage = `[POS QR Scanner SUCCESS] ${timestamp} - Text: ${cleanedText} (Original: ${decodedText}) - Device: ${isMobile ? 'Mobile' : 'Desktop'} - Camera: ${JSON.stringify(cameraConfig)}`;
                    console.error(logMessage); // استخدام console.error للظهور في error logs
                } catch (e) {
                    console.error('خطأ في تسجيل log:', e);
                }
                
                // معالجة QR Code المقروء باستخدام النص المنظف - بدون إيقاف الماسح
                if (cleanedText && cleanedText.length > 0) {
                    handlePOSQRCodeScanned(cleanedText);
                } else {
                    console.warn('⚠️ [POS Scanner] نص QR Code فارغ بعد التنظيف');
                }
            },
            (errorMessage) => {
                // Error callback - تصفية الأخطاء الطبيعية
                if (!errorMessage) return;
                
                // قائمة بالأخطاء الطبيعية التي تحدث عندما لا يوجد QR code في الإطار
                // هذه الأخطاء طبيعية ولا تحتاج إلى تسجيل
                const normalErrors = [
                    'NotFoundException',
                    'No MultiFormat Readers were able to detect the code',
                    'QR code parse error',
                    'No QR code found',
                    'QR code not found'
                ];
                
                // التحقق إذا كان الخطأ طبيعي (لا يحتاج تسجيل)
                const isNormalError = normalErrors.some(normalError => 
                    errorMessage.includes(normalError)
                );
                
                if (isNormalError) {
                    // هذا طبيعي - يعني لم يجد QR code في هذه اللحظة
                    // لا نريد تسجيل هذه الأخطاء لأنها تحدث مئات المرات في الدقيقة
                    return;
                }
                
                // تسجيل الأخطاء الحقيقية فقط (مشاكل في الكاميرا، أخطاء في الإعدادات، إلخ)
                const timestamp = new Date().toISOString();
                const logData = {
                    timestamp: timestamp,
                    success: false,
                    error: errorMessage,
                    scannerId: scannerId,
                    isMobile: isMobile,
                    cameraConfig: cameraConfig
                };
                
                console.warn('⚠️ [POS Scanner] خطأ أثناء المسح:', errorMessage);
                console.log('📦 [POS Scanner] Error Log Data:', JSON.stringify(logData, null, 2));
                
                // Log في error log للأخطاء الحقيقية فقط
                try {
                    const logMessage = `[POS QR Scanner ERROR] ${timestamp} - Error: ${errorMessage} - Device: ${isMobile ? 'Mobile' : 'Desktop'} - Camera: ${JSON.stringify(cameraConfig)}`;
                    console.error(logMessage);
                } catch (e) {
                    console.error('خطأ في تسجيل error log:', e);
                }
            }
        );
        
        // Hide loading indicator once scanner starts
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        console.log('✅ [POS Scanner] تم بدء الماسح بنجاح');
        
    } catch (error) {
        console.error('❌ [POS Scanner] خطأ في تهيئة الماسح:', error);
        const errorMessage = error?.message || 'خطأ غير معروف';
        
        // محاولة إضافية - استخدام facingMode: environment مباشرة (مثل repairs.js)
        console.log(`🔄 [POS Scanner] محاولة استخدام facingMode: environment مباشرة...`);
        try {
            // إعدادات مبسطة للمحاولة الثانية (محسنة)
            const fallbackConfig = {
                fps: 25, // زيادة FPS للمحاولة الثانية
                qrbox: isMobile ? { width: 280, height: 280 } : { width: 350, height: 350 },
                aspectRatio: 1.0,
                disableFlip: false
                // ✅ لا نستخدم videoConstraints هنا لأنها تسبب تضارب
            };
            
            if (typeof Html5QrcodeScanType !== 'undefined') {
                fallbackConfig.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
            }
            
            await posQRCodeScannerInstance.start(
                { facingMode: "environment" },
                fallbackConfig,
                (decodedText, decodedResult) => {
                    console.log('✅ [POS Scanner] تم قراءة QR Code:', decodedText);
                    handlePOSQRCodeScanned(decodedText);
                },
                (errorMessage) => {
                    // Ignore scanning errors
                }
            );
            if (loadingDiv) loadingDiv.style.display = 'none';
            console.log(`✅ [POS Scanner] تم بدء الماسح بـ facingMode: ${posCurrentCameraFacing}`);
            return;
        } catch (fallbackError) {
            console.error('❌ [POS Scanner] فشلت محاولة facingMode: environment:', fallbackError);
            
            // محاولة أخيرة - تجربة جميع الكاميرات المتاحة للعثور على الكاميرا المطلوبة
            console.log(`🔄 [POS Scanner] محاولة أخيرة - البحث في جميع الكاميرات للعثور على الكاميرا ${posCurrentCameraFacing === 'environment' ? 'الخلفية' : 'الأمامية'}...`);
            try {
                const cameras = await Html5Qrcode.getCameras();
                if (cameras && cameras.length > 0) {
                    // تجربة جميع الكاميرات للعثور على الكاميرا المطلوبة
                    const cameraList = posCurrentCameraFacing === 'environment' 
                        ? [...cameras].reverse() // للخلفية: من الأخير للأول
                        : cameras; // للأمامية: من الأول للأخير
                    
                    for (const cam of cameraList) {
                        const label = (cam.label || '').toLowerCase();
                        const facingMode = cam.facingMode || '';
                        
                        // تخطي الكاميرا غير المطلوبة
                        if (posCurrentCameraFacing === 'environment') {
                            // تخطي الكاميرا الأمامية
                            if (label.includes('front') || 
                                label.includes('user') || 
                                (label.includes('facing') && label.includes('user')) ||
                                label.includes('أمامي') || 
                                label.includes('أمامية') ||
                                label.includes('selfie') ||
                                facingMode === 'user') {
                                console.log(`⏭️ [POS Scanner] تخطي الكاميرا الأمامية: ${cam.label}`);
                                continue;
                            }
                        } else {
                            // تخطي الكاميرا الخلفية
                            if (label.includes('back') || 
                                label.includes('rear') || 
                                label.includes('environment') ||
                                label.includes('خلفي') || 
                                label.includes('خلفية') ||
                                facingMode === 'environment') {
                                console.log(`⏭️ [POS Scanner] تخطي الكاميرا الخلفية: ${cam.label}`);
                                continue;
                            }
                        }
                        
                        try {
                            // استخدام إعدادات مبسطة للمحاولة الأخيرة (محسنة)
                            const finalFallbackConfig = {
                                fps: 20, // زيادة FPS للمحاولة الأخيرة
                                qrbox: isMobile ? { width: 280, height: 280 } : { width: 350, height: 350 },
                                aspectRatio: 1.0,
                                disableFlip: false
                                // ✅ لا نستخدم videoConstraints هنا لأنها تسبب تضارب
                            };
                            
                            if (typeof Html5QrcodeScanType !== 'undefined') {
                                finalFallbackConfig.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
                            }
                            
                            await posQRCodeScannerInstance.start(
                                cam.id,
                                finalFallbackConfig,
                                (decodedText, decodedResult) => {
                                    console.log('✅ [POS Scanner] تم قراءة QR Code:', decodedText);
                                    handlePOSQRCodeScanned(decodedText);
                                },
                                (errorMessage) => {
                                    // Ignore scanning errors
                                }
                            );
                            if (loadingDiv) loadingDiv.style.display = 'none';
                            console.log('✅ [POS Scanner] تم بدء الماسح بالكاميرا:', cam.id, cam.label);
                            localStorage.setItem('pos_last_camera_id', cam.id);
                            return;
                        } catch (camError) {
                            console.log(`⚠️ [POS Scanner] فشلت الكاميرا ${cam.id}, جرب التالية...`);
                            continue;
                        }
                    }
                }
            } catch (finalError) {
                console.error('❌ [POS Scanner] فشلت جميع محاولات الكاميرا:', finalError);
            }
        }
        
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle" style="font-size: 2em; color: var(--danger-color); margin-bottom: 10px; display: block;"></i>
                <p style="font-size: 0.9em; font-weight: 600; color: var(--text-dark);">خطأ في بدء الكاميرا</p>
                <p style="font-size: 0.8em; color: var(--text-light); margin-top: 5px;">يرجى التحقق من أذونات الكاميرا</p>
            `;
        }
        
        if (errorDiv) {
            errorDiv.style.display = 'block';
            const errorMessageEl = document.getElementById('pos-scanner-error-message');
            if (errorMessageEl) {
                errorMessageEl.textContent = '❌ فشل في الوصول إلى الكاميرا. يرجى التحقق من الأذونات والمحاولة مرة أخرى.';
            }
        }
        
        // Reset instance on error
        posQRCodeScannerInstance = null;
        posScannerOpen = false;
    }
}

// Handle scanned QR code in POS
async function handlePOSQRCodeScanned(decodedText) {
    // ✅ تنبيه فوري - تم استدعاء الدالة
    console.log('🚀🚀🚀 [handlePOSQRCodeScanned] تم استدعاء الدالة!');
    console.log('📥 [handlePOSQRCodeScanned] القيمة المستلمة:', decodedText);
    
    // منع القراءات المتكررة - إذا كان القارئ مقفل، تجاهل القراءة
    if (posScannerLocked) {
        console.log('⏳ [POS Scanner] القارئ مقفل مؤقتاً، تجاهل القراءة المتكررة');
        return;
    }
    
    // قفل القارئ لمدة 1 ثانية (1000ms) لمنع القراءات المتكررة
    posScannerLocked = true;
    
    // إعادة فتح القارئ بعد 1 ثانية (1000ms)
    setTimeout(() => {
        posScannerLocked = false;
        console.log('✅ [POS Scanner] تم إلغاء قفل القارئ - جاهز للقراءة التالية');
    }, 1500); // زيادة الوقت قليلاً
    
    // Don't stop scanning - keep camera running for continuous scanning
    const errorDiv = document.getElementById('pos-scanner-error');
    const errorDivMobile = document.getElementById('pos-scanner-error-mobile');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (errorDivMobile) errorDivMobile.style.display = 'none';
    
    // ✅ تحسين معالجة النص المقروء - إزالة المسافات والأحرف غير المرئية
    const normalizeText = (text) => {
        if (!text) return '';
        // تحويل إلى نص وإزالة المسافات من البداية والنهاية
        let normalized = text.toString().trim();
        // إزالة أي أحرف غير مرئية أو مسافات زائدة
        normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
        normalized = normalized.replace(/\s+/g, ' ').trim(); // Normalize spaces
        return normalized;
    };
    
    const originalText = decodedText;
    const cleanedText = normalizeText(decodedText);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 [POS Scanner] بدء معالجة QR Code');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 النص المقروء:', {
        original: originalText,
        cleaned: cleanedText,
        length: cleanedText.length,
        type: typeof cleanedText
    });
    
    // ✅ التحقق من أن المنتجات تم تحميلها
    console.log('📊 فحص المنتجات المحملة:', {
        exists: !!allProducts,
        length: allProducts ? allProducts.length : 0
    });
    
    if (!allProducts || allProducts.length === 0) {
        console.error('❌ [POS Scanner] المنتجات غير محملة بعد - انتظر قليلاً...');
        showMessage('⏳ جاري تحميل المنتجات...', 'info');
        
        // محاولة إعادة تحميل المنتجات
        try {
            await loadAllProducts();
            
            // انتظر قليلاً للتأكد من اكتمال التحميل
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!allProducts || allProducts.length === 0) {
                console.error('❌ [POS Scanner] فشل تحميل المنتجات - القائمة فارغة');
                showMessage('❌ المنتجات غير محملة. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
                return;
            }
            
            console.log('✅ [POS Scanner] تم تحميل المنتجات - عدد المنتجات:', allProducts.length);
            console.log('📊 [POS Scanner] توزيع المنتجات:', {
                phones: allProducts.filter(p => p.type === 'phone').length,
                accessories: allProducts.filter(p => p.type === 'accessory').length,
                spare_parts: allProducts.filter(p => p.type === 'spare_part').length,
                total: allProducts.length
            });
            
            // عرض عينة من المنتجات مع barcodes
            console.log('📋 [POS Scanner] عينة من المنتجات (أول 5):');
            allProducts.slice(0, 5).forEach((p, i) => {
                console.log(`   ${i+1}. ${p.name} (${p.type})`, {
                    id: p.id,
                    barcode: p.barcode,
                    code: p.code
                });
            });
            
            showMessage('✅ تم تحميل المنتجات. جرب مسح QR Code مرة أخرى.', 'success');
        } catch (e) {
            console.error('❌ [POS Scanner] فشل تحميل المنتجات:', e);
            showMessage('❌ حدث خطأ أثناء تحميل المنتجات. يرجى تحديث الصفحة.', 'error');
            return;
        }
    } else {
        console.log('✅ المنتجات محملة:', allProducts.length, 'منتج');
    }
    
    let product = null;
    let productId = null;
    
    // ✅ استخدام النص المنظف للبحث
    decodedText = cleanedText;
    
    // ═══════════════════════════════════════════════════════
    // 🔍 خطوة 0: بحث بسيط ومباشر أولاً (Quick Search)
    // ═══════════════════════════════════════════════════════
    console.log('🔍 [Step 0] بحث بسيط ومباشر...');
    
    const searchValue = cleanedText.toLowerCase().trim();
    
    product = allProducts.find(p => {
        // البحث في جميع الحقول بشكل مباشر (case-insensitive)
        const id = (p.id || '').toString().toLowerCase().trim();
        const barcode = (p.barcode || '').toString().toLowerCase().trim();
        const code = (p.code || '').toString().toLowerCase().trim();
        
        if (id === searchValue || barcode === searchValue || code === searchValue) {
            console.log('✅ [Step 0] تطابق مباشر!', { product: p.name, field: id === searchValue ? 'id' : barcode === searchValue ? 'barcode' : 'code', value: searchValue });
            return true;
        }
        return false;
    });
    
    if (product) {
        console.log('🎉 [Step 0] تم العثور على المنتج بالبحث البسيط:', product.name);
    } else {
        console.log('⚠️ [Step 0] لم يتم العثور على المنتج بالبحث البسيط، سنحاول البحث المتقدم...');
    }
    
    // ═══════════════════════════════════════════════════════
    // 🔍 خطوة 1: محاولة parsing JSON (إذا لم ينجح البحث البسيط)
    // ═══════════════════════════════════════════════════════
    if (!product) {
        console.log('🔍 [Step 1] محاولة parsing JSON...');
    
    try {
        // محاولة تنظيف النص قبل parsing (إزالة أي أحرف غير مرئية)
        const cleanedJsonText = decodedText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const qrData = JSON.parse(cleanedJsonText);
        
        console.log('📋 [POS Scanner] QR Code بصيغة JSON:', qrData);
        
        if (qrData && qrData.type && qrData.id) {
            productId = parseInt(qrData.id); // تحويل ID إلى رقم للتأكد من التطابق
            
            console.log('🔍 [POS Scanner] البحث عن منتج - النوع:', qrData.type, 'ID:', productId);
            
            // Determine product type (case-insensitive)
            const qrType = (qrData.type || '').toLowerCase();
            let targetType = '';
            
            if (qrType === 'spare_part' || qrType === 'sparepart') {
                targetType = 'spare_part';
            } else if (qrType === 'phone') {
                targetType = 'phone';
            } else if (qrType === 'accessory') {
                targetType = 'accessory';
            }
            
            if (targetType) {
                // Find product by type and ID - محاولة مطابقة ID كرقم أو نص
                product = allProducts.find(p => {
                    const pId = parseInt(p.id);
                    const matchById = (pId === productId || p.id.toString() === productId.toString());
                    const matchByType = (p.type === targetType);
                    return matchById && matchByType;
                });
                
                // إذا لم يتم العثور، جرب البحث ب barcode من QR data (case-insensitive)
                if (!product && qrData.barcode) {
                    product = allProducts.find(p => {
                        const normalizedBarcode = normalizeText(p.barcode || '').toLowerCase();
                        const qrBarcode = normalizeText(qrData.barcode).toLowerCase();
                        return normalizedBarcode === qrBarcode && p.type === targetType;
                    });
                }
                
                // إذا لم يتم العثور، جرب البحث بدون تحديد النوع (أي منتج بنفس ID)
                if (!product) {
                    product = allProducts.find(p => {
                        const pId = parseInt(p.id);
                        return (pId === productId || p.id.toString() === productId.toString());
                    });
                    
                    if (product) {
                        console.log('⚠️ [POS Scanner] تم العثور على المنتج بدون مطابقة النوع - النوع الفعلي:', product.type, 'النوع المتوقع:', targetType);
                    }
                }
                
                // إذا لم يتم العثور، جرب البحث ب barcode بدون تحديد النوع
                if (!product && qrData.barcode) {
                    product = allProducts.find(p => {
                        const normalizedBarcode = normalizeText(p.barcode || '').toLowerCase();
                        const qrBarcode = normalizeText(qrData.barcode).toLowerCase();
                        const normalizedCode = normalizeText(p.code || '').toLowerCase();
                        return normalizedBarcode === qrBarcode || normalizedCode === qrBarcode;
                    });
                }
                
                if (product) {
                    console.log('✅ [POS Scanner] تم العثور على المنتج (JSON):', product.name, 'ID:', product.id, 'Type:', product.type);
                } else {
                    console.log('❌ [POS Scanner] لم يتم العثور على المنتج - ID:', productId, 'Type:', qrData.type, 'Barcode:', qrData.barcode);
                    console.log('💡 [POS Scanner] المنتجات المتاحة من نوع', targetType + ':', allProducts.filter(p => p.type === targetType).length);
                    console.log('💡 [POS Scanner] إجمالي المنتجات:', allProducts.length);
                }
            } else {
                console.log('⚠️ [POS Scanner] نوع المنتج غير معروف:', qrData.type);
            }
        } else {
            console.log('⚠️ [POS Scanner] QR Code JSON لا يحتوي على type أو id:', qrData);
        }
    } catch (e) {
        // Not JSON format - fallback to simple text search (for backward compatibility)
        console.log('ℹ️ [Step 1] QR Code ليس بصيغة JSON');
    }
    }
    
    // ═══════════════════════════════════════════════════════
    // 🔍 خطوة 2: بحث متقدم مع تنظيف النص
    // ═══════════════════════════════════════════════════════
    if (!product) {
        console.log('🔍 [Step 2] بحث متقدم مع تنظيف النص...');
        const decodedTextStr = normalizeText(decodedText);
        const decodedTextLower = decodedTextStr.toLowerCase();
        console.log('🔍 [POS Scanner] البحث في جميع المنتجات عن:', decodedTextStr);
        console.log('📦 [POS Scanner] إجمالي المنتجات المتاحة:', allProducts.length);
        
        // Log first few products for debugging
        if (allProducts.length > 0) {
            const sampleProducts = allProducts.slice(0, 5).map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                barcode: p.barcode,
                code: p.code,
                normalizedBarcode: normalizeText(p.barcode || ''),
                normalizedCode: normalizeText(p.code || ''),
                normalizedId: normalizeText(p.id?.toString() || '')
            }));
            console.log('📋 [POS Scanner] أمثلة على المنتجات (مع النصوص المنظفة):', sampleProducts);
        }
        
        // Search in all product types: phones, accessories, spare_parts
        product = allProducts.find(p => {
            // Normalize all comparison values
            const normalizedId = normalizeText(p.id?.toString() || '');
            const normalizedBarcode = normalizeText(p.barcode || '');
            const normalizedCode = normalizeText(p.code || '');
            
            // Convert to lowercase for case-insensitive comparison
            const normalizedIdLower = normalizedId.toLowerCase();
            const normalizedBarcodeLower = normalizedBarcode.toLowerCase();
            const normalizedCodeLower = normalizedCode.toLowerCase();
            
            const originalTextLower = originalText.toLowerCase();
            
            // Try ID match first (exact match after normalization - case insensitive)
            if (normalizedId && normalizedIdLower === decodedTextLower) {
                console.log('✅ [POS Scanner] تطابق ID:', p.id, '=', decodedTextStr);
                return true;
            }
            
            // Try barcode match (exact match after normalization - case insensitive)
            if (normalizedBarcode && normalizedBarcodeLower === decodedTextLower) {
                console.log('✅ [POS Scanner] تطابق Barcode:', p.barcode, '=', decodedTextStr);
                return true;
            }
            
            // Try code match (exact match after normalization - case insensitive)
            if (normalizedCode && normalizedCodeLower === decodedTextLower) {
                console.log('✅ [POS Scanner] تطابق Code:', p.code, '=', decodedTextStr);
                return true;
            }
            
            // Try without normalization but with lowercase (in case original text matches)
            if (p.id && p.id.toString().toLowerCase() === originalTextLower) {
                console.log('✅ [POS Scanner] تطابق ID (Original):', p.id);
                return true;
            }
            
            if (p.barcode && p.barcode.toString().toLowerCase() === originalTextLower) {
                console.log('✅ [POS Scanner] تطابق Barcode (Original):', p.barcode);
                return true;
            }
            
            if (p.code && p.code.toString().toLowerCase() === originalTextLower) {
                console.log('✅ [POS Scanner] تطابق Code (Original):', p.code);
                return true;
            }
            
            // Try exact match with original case (case sensitive)
            if (normalizedId && normalizedId === decodedTextStr) {
                console.log('✅ [POS Scanner] تطابق ID (Case Sensitive):', p.id, '=', decodedTextStr);
                return true;
            }
            
            if (normalizedBarcode && normalizedBarcode === decodedTextStr) {
                console.log('✅ [POS Scanner] تطابق Barcode (Case Sensitive):', p.barcode, '=', decodedTextStr);
                return true;
            }
            
            if (normalizedCode && normalizedCode === decodedTextStr) {
                console.log('✅ [POS Scanner] تطابق Code (Case Sensitive):', p.code, '=', decodedTextStr);
                return true;
            }
            
            return false;
        });
        
        if (product) {
            console.log('✅ [Step 2] تم العثور على المنتج:', product.name, 'Type:', product.type);
        } else {
            console.log('⚠️ [Step 2] لم يتم العثور على المنتج');
        }
    }
    
    // ═══════════════════════════════════════════════════════
    // 🔍 خطوة 3: بحث جزئي (بدون مسافات وأحرف خاصة)
    // ═══════════════════════════════════════════════════════
    if (!product) {
        const decodedTextStr = normalizeText(decodedText);
        console.log('🔍 [Step 3] بحث جزئي (بدون مسافات/أحرف خاصة)...');
        
        // Remove all spaces and special characters for comparison
        const decodedNoSpaces = decodedTextStr.replace(/[\s\-_]+/g, '').toLowerCase();
        
        product = allProducts.find(p => {
            // Try multiple fields: barcode, code, id
            const fields = [
                p.barcode,
                p.code,
                p.id?.toString()
            ];
            
            for (const field of fields) {
                if (!field) continue;
                
                const normalizedField = normalizeText(field.toString()).replace(/[\s\-_]+/g, '').toLowerCase();
                
                if (normalizedField === decodedNoSpaces) {
                    console.log('✅ [POS Scanner] تطابق جزئي (بدون مسافات):', field, '=', decodedTextStr);
                    return true;
                }
            }
            
            return false;
        });
        
        if (product) {
            console.log('✅ [Step 3] تم العثور على المنتج:', product.name);
        } else {
            console.log('⚠️ [Step 3] لم يتم العثور على المنتج');
            
            // Log some products for comparison
            if (allProducts.length > 0) {
                console.log('═══════════════════════════════════════════════════════');
                console.log('📊 عينة من المنتجات للمقارنة (أول 10):');
                console.log('═══════════════════════════════════════════════════════');
                allProducts.slice(0, 10).forEach((p, i) => {
                    const normalizedBarcode = normalizeText(p.barcode || '').replace(/[\s\-_]+/g, '').toLowerCase();
                    const normalizedCode = normalizeText(p.code || '').replace(/[\s\-_]+/g, '').toLowerCase();
                    const normalizedId = normalizeText(p.id?.toString() || '').replace(/[\s\-_]+/g, '').toLowerCase();
                    
                    const match = normalizedBarcode === decodedNoSpaces || normalizedCode === decodedNoSpaces || normalizedId === decodedNoSpaces;
                    
                    console.log(`${i+1}. ${match ? '✅' : '❌'} ${p.name} (${p.type})`);
                    console.log(`   - ID: ${p.id} (normalized: ${normalizedId})`);
                    console.log(`   - Barcode: ${p.barcode} (normalized: ${normalizedBarcode})`);
                    console.log(`   - Code: ${p.code} (normalized: ${normalizedCode})`);
                    console.log(`   - Match: ${match ? 'نعم ✅' : 'لا ❌'}`);
                    console.log('');
                });
                console.log('═══════════════════════════════════════════════════════');
            }
        }
    }
    
    if (!product) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('❌ [POS Scanner] لم يتم العثور على المنتج!');
        console.log('═══════════════════════════════════════════════════════');
        
        // ✅ عرض معلومات تشخيصية شاملة
        console.log('📊 معلومات التشخيص:');
        console.log('   - QR Code المقروء:', cleanedText);
        console.log('   - عدد المنتجات المحملة:', allProducts ? allProducts.length : 0);
        
        if (allProducts && allProducts.length > 0) {
            console.log('   - أول 10 منتجات مع barcodes:', allProducts.slice(0, 10).map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                barcode: p.barcode,
                code: p.code
            })));
        }
        
        // ✅ إنشاء رسالة خطأ مفصلة مع اقتراحات
        let debugInfo = `
═══════════════════════════════════════
❌ المنتج غير موجود
═══════════════════════════════════════

📋 QR Code المقروء: "${cleanedText}"
📦 عدد المنتجات: ${allProducts ? allProducts.length : 0}

💡 الحلول المقترحة:
1. تأكد أن المنتج موجود في المخزون
2. تأكد أن المنتج له barcode أو code في قاعدة البيانات
3. تحقق من أن QR Code يطابق barcode/code/id المخزن
4. افتح Console (F12) لعرض المزيد من المعلومات
`;
        
        console.log(debugInfo);
        
        // Show error message for mobile with debug info
        const errorDivMobile = document.getElementById('pos-scanner-error-mobile');
        if (errorDivMobile) {
            const errorMessageMobile = document.getElementById('pos-scanner-error-message-mobile');
            if (errorMessageMobile) {
                // جمع عينة من المنتجات للمقارنة
                let sampleProductsHTML = '';
                if (allProducts && allProducts.length > 0) {
                    const samples = allProducts.slice(0, 5);
                    sampleProductsHTML = '<div style="margin-top: 10px; font-size: 0.85em; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: right;">';
                    sampleProductsHTML += '<div style="font-weight: bold; margin-bottom: 8px;">📊 أمثلة على المنتجات المتاحة:</div>';
                    samples.forEach((p, i) => {
                        const displayBarcode = p.barcode || p.code || p.id;
                        sampleProductsHTML += `<div style="margin-bottom: 5px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                            ${i+1}. ${p.name}<br>
                            <span style="font-family: monospace; font-size: 0.9em;">Barcode: ${displayBarcode}</span>
                        </div>`;
                    });
                    sampleProductsHTML += '</div>';
                }
                
                errorMessageMobile.innerHTML = `
                    <div style="text-align: right; direction: rtl;">
                        <div style="font-size: 1.1em; font-weight: bold; margin-bottom: 10px;">❌ المنتج غير موجود</div>
                        <div style="margin-bottom: 8px;">📋 القيمة المقروءة:</div>
                        <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all; margin-bottom: 10px; font-size: 1.1em; font-weight: bold;">${cleanedText}</div>
                        <div style="font-size: 0.9em; color: rgba(255,255,255,0.9); margin-bottom: 10px;">
                            📦 المنتجات المحملة: ${allProducts ? allProducts.length : 0}<br>
                            💡 تحقق من أن المنتج موجود في المخزون وله barcode
                        </div>
                        ${sampleProductsHTML}
                    </div>
                `;
            }
            errorDivMobile.style.display = 'block';
            
            // Hide error after 8 seconds (زيادة الوقت لقراءة المعلومات)
            setTimeout(() => {
                if (errorDivMobile) {
                    errorDivMobile.style.display = 'none';
                }
            }, 8000);
        }
        
        // Also show error for desktop with debug info
        if (errorDiv) {
            const errorMessage = document.getElementById('pos-scanner-error-message');
            if (errorMessage) {
                errorMessage.innerHTML = `
                    <div style="text-align: right; direction: rtl;">
                        <div style="font-size: 1.1em; font-weight: bold; margin-bottom: 10px;">❌ المنتج غير موجود</div>
                        <div style="margin-bottom: 8px;">📋 القيمة المقروءة:</div>
                        <div style="background: rgba(0,0,0,0.1); padding: 8px; border-radius: 5px; font-family: monospace; word-break: break-all; margin-bottom: 10px;">${cleanedText}</div>
                        <div style="font-size: 0.9em; opacity: 0.9;">
                            📦 المنتجات المحملة: ${allProducts ? allProducts.length : 0}<br>
                            💡 تحقق من أن المنتج موجود في المخزون وله barcode صحيح<br>
                            🔍 افتح Developer Console (F12) للمزيد من التفاصيل
                        </div>
                    </div>
                `;
            }
            errorDiv.style.display = 'block';
        }
        
        // Show user-friendly message
        showMessage(`❌ المنتج غير موجود. القيمة المقروءة: "${cleanedText}". عدد المنتجات: ${allProducts ? allProducts.length : 0}`, 'error');
        
        console.log('═══════════════════════════════════════════════════════');
        return;
    }
    
    // ═══════════════════════════════════════════════════════
    // ✅ تم العثور على المنتج - إضافة إلى السلة
    // ═══════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 تم العثور على المنتج بنجاح!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📦 معلومات المنتج:');
    console.log('   - الاسم:', product.name);
    console.log('   - النوع:', product.type);
    console.log('   - ID:', product.id);
    console.log('   - Barcode:', product.barcode);
    console.log('   - السعر:', product.price);
    console.log('   - الكمية المتوفرة:', product.quantity);
    console.log('═══════════════════════════════════════════════════════');
    
    // Add product to cart - camera continues running
    if (product.type === 'spare_part' && product.items && product.items.length > 0) {
        openSparePartItemsModal(product);
    } else {
        // إضافة المنتج بدون عرض رسالة (سيتم عرضها في addToCart)
        await addToCart(product, false); // false = لا تعرض رسالة (سنعرضها بعد ذلك)
        // عرض رسالة النجاح الواحدة
        showMessage(`تم اضافة المنتج بنجاح : ${product.name}`, 'success');
        // تشغيل صوت النجاح
        playSuccessSound();
        // اهتزاز خفيف بعد المسح الناجح (موبايل)
        if (navigator.vibrate) {
            navigator.vibrate(100); // اهتزاز خفيف (100ms)
        }
    }
    
    // Continue scanning - don't stop camera
    console.log('📷 الكاميرا ما زالت نشطة - جاهز للمسح التالي');
}

// Toggle Camera (Switch between front and back camera)
async function togglePOSCamera() {
    if (!posQRCodeScannerInstance) {
        console.warn('⚠️ [POS Scanner] الماسح غير نشط، لا يمكن التبديل');
        return;
    }
    
    // حفظ القيمة السابقة للكاميرا
    const previousCameraFacing = posCurrentCameraFacing;
    const previousCameraId = posCurrentCameraId;
    
    try {
        // إيقاف الماسح الحالي بشكل كامل
        try {
            await posQRCodeScannerInstance.stop();
        } catch (stopError) {
            console.warn('⚠️ [POS Scanner] خطأ في إيقاف الماسح (قد يكون متوقفاً بالفعل):', stopError);
        }
        
        try {
            await posQRCodeScannerInstance.clear();
        } catch (clearError) {
            console.warn('⚠️ [POS Scanner] خطأ في مسح الماسح:', clearError);
        }
        
        // إعادة تعيين المثيل إلى null لإجبار إنشاء مثيل جديد
        posQRCodeScannerInstance = null;
        
        // انتظار قليل لضمان إيقاف الكاميرا بالكامل
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // تبديل الكاميرا
        posCurrentCameraFacing = posCurrentCameraFacing === 'environment' ? 'user' : 'environment';
        posCurrentCameraId = null; // إعادة تعيين ID الكاميرا
        
        console.log('🔄 [POS Scanner] التبديل إلى الكاميرا:', posCurrentCameraFacing === 'environment' ? 'الخلفية' : 'الأمامية');
        
        // إعادة تشغيل الماسح بالكاميرا الجديدة
        await initializePOSQRCodeScanner();
        
        showMessage(`تم التبديل إلى الكاميرا ${posCurrentCameraFacing === 'environment' ? 'الخلفية' : 'الأمامية'}`, 'success');
    } catch (error) {
        console.error('❌ [POS Scanner] خطأ في التبديل بين الكاميرات:', error);
        showMessage('❌ فشل التبديل بين الكاميرات. يرجى المحاولة مرة أخرى.', 'error');
        
        // إعادة تعيين القيم السابقة
        posCurrentCameraFacing = previousCameraFacing;
        posCurrentCameraId = previousCameraId;
        
        // إعادة تعيين المثيل
        posQRCodeScannerInstance = null;
        
        // محاولة إعادة تشغيل الماسح بالكاميرا السابقة
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            await initializePOSQRCodeScanner();
        } catch (retryError) {
            console.error('❌ [POS Scanner] فشلت محاولة الاستعادة:', retryError);
            posQRCodeScannerInstance = null;
        }
    }
}

// Close POS QR Code Scanner (only used when leaving page)
async function closePOSBarcodeScanner() {
    try {
        if (posQRCodeScannerInstance) {
            try {
                await posQRCodeScannerInstance.stop();
            } catch (err) {
                // Ignore errors if scanner is already stopped or not running
                const errorMsg = err?.message || err?.toString() || '';
                if (!errorMsg.includes('not running') && !errorMsg.includes('not paused') && !errorMsg.includes('Cannot stop')) {
                    console.error('Error stopping QR scanner:', err);
                }
            }
            try {
                await posQRCodeScannerInstance.clear();
            } catch (err) {
                // Ignore clearing errors if scanner is already stopped
                const errorMsg = err?.message || err?.toString() || '';
                if (!errorMsg.includes('not running') && !errorMsg.includes('Cannot stop')) {
                    console.error('Error clearing QR scanner:', err);
                }
            }
            posQRCodeScannerInstance = null;
        }
    } catch (e) {
        // Ignore general errors if scanner is already stopped
        const errorMsg = e?.message || e?.toString() || '';
        if (!errorMsg.includes('not running') && !errorMsg.includes('not paused') && !errorMsg.includes('Cannot stop')) {
            console.error('Error stopping scanner:', e);
        }
        posQRCodeScannerInstance = null;
    }
    
    const modal = document.getElementById('posBarcodeScannerModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            modal.remove();
            posQRCodeScannerInstance = null;
        }, 300);
    }
    
    posScannerOpen = false;
}

// Close scanner when leaving page
window.addEventListener('beforeunload', async function() {
    await closePOSBarcodeScanner();
});

// Also close on visibility change (tab switching, etc.)
document.addEventListener('visibilitychange', async function() {
    if (document.hidden) {
        // Page is hidden - don't close scanner to allow background scanning
        // Only close when actually leaving the page
    }
});

// دالة لفتح file input للتقاط صورة (للهواتف - بديل للكاميرا المباشرة) - للـ modal
async function openPOSImageScanner() {
    try {
        console.log('📷 [POS Scanner] محاولة فتح file input للـ modal');
        const fileInput = document.getElementById('pos-qr-image-input');
        if (!fileInput) {
            console.error('❌ [POS Scanner] file input للـ modal غير موجود');
            showMessage('❌ خطأ: لا يمكن العثور على زر التقاط الصورة', 'error');
            return;
        }
        
        // إيقاف الكاميرا المباشرة قبل فتح file input
        if (posQRCodeScannerInstance) {
            try {
                console.log('⏸️ [POS Scanner] إيقاف الكاميرا المباشرة...');
                await posQRCodeScannerInstance.stop();
            } catch (e) {
                console.warn('⚠️ [POS Scanner] خطأ في إيقاف الكاميرا (يمكن تجاهله):', e);
            }
        }
        
        // فتح file picker
        console.log('📂 [POS Scanner] فتح file picker...');
        fileInput.click();
    } catch (error) {
        console.error('❌ [POS Scanner] خطأ في فتح file input:', error);
        showMessage('❌ حدث خطأ أثناء فتح الكاميرا. يرجى المحاولة مرة أخرى.', 'error');
    }
}

// دالة لفتح file input للتقاط صورة (للهواتف - بديل للكاميرا المباشرة) - للقارئ المدمج
async function openPOSImageScannerMobile() {
    try {
        console.log('📷 [POS Scanner Mobile] محاولة فتح file input للقارئ المدمج');
        const fileInput = document.getElementById('pos-qr-image-input-mobile');
        if (!fileInput) {
            console.error('❌ [POS Scanner Mobile] file input للقارئ المدمج غير موجود');
            console.error('❌ [POS Scanner Mobile] جميع العناصر المتاحة:', {
                'pos-qr-image-input-mobile': !!document.getElementById('pos-qr-image-input-mobile'),
                'pos-qr-image-input': !!document.getElementById('pos-qr-image-input')
            });
            showMessage('❌ خطأ: لا يمكن العثور على زر التقاط الصورة', 'error');
            return;
        }
        
        // إيقاف الكاميرا المباشرة قبل فتح file input
        if (posQRCodeScannerInstance) {
            try {
                console.log('⏸️ [POS Scanner Mobile] إيقاف الكاميرا المباشرة...');
                await posQRCodeScannerInstance.stop();
            } catch (e) {
                console.warn('⚠️ [POS Scanner Mobile] خطأ في إيقاف الكاميرا (يمكن تجاهله):', e);
            }
        }
        
        // فتح file picker
        console.log('📂 [POS Scanner Mobile] فتح file picker...');
        fileInput.click();
        console.log('✅ [POS Scanner Mobile] تم فتح file picker بنجاح');
    } catch (error) {
        console.error('❌ [POS Scanner Mobile] خطأ في فتح file input:', error);
        showMessage('❌ حدث خطأ أثناء فتح الكاميرا. يرجى المحاولة مرة أخرى.', 'error');
    }
}

// معالج اختيار صورة من file input (للـ modal)
async function handlePOSImageFileSelected(event) {
    await handlePOSImageFileSelectedCommon(event, 'pos-scanner-loading', 'pos-scanner-error', 'pos-scanner-error-message');
}

// معالج اختيار صورة من file input (للقارئ المدمج)
async function handlePOSImageFileSelectedMobile(event) {
    await handlePOSImageFileSelectedCommon(event, 'pos-scanner-loading-mobile', 'pos-scanner-error-mobile', 'pos-scanner-error-message-mobile');
}

// دالة مشتركة لمعالجة اختيار الصورة
async function handlePOSImageFileSelectedCommon(event, loadingDivId, errorDivId, errorMessageId) {
    const timestamp = new Date().toISOString();
    console.log('📸 [POS Scanner] بدء معالجة الصورة المختارة -', timestamp);
    console.log('📋 [POS Scanner] IDs:', { loadingDivId, errorDivId, errorMessageId });
    
    const file = event.target.files?.[0];
    if (!file) {
        console.warn('⚠️ [POS Scanner] لم يتم اختيار ملف');
        return;
    }
    
    console.log('📁 [POS Scanner] معلومات الملف:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(file.lastModified).toISOString()
    });
    
    // التأكد من أن الملف صورة
    if (!file.type.startsWith('image/')) {
        console.error('❌ [POS Scanner] الملف المختار ليس صورة:', file.type);
        showMessage('❌ يرجى اختيار صورة صحيحة', 'error');
        return;
    }
    
    try {
        // إخفاء loading وإظهار رسالة معالجة
        const loadingDiv = document.getElementById(loadingDivId);
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = `
                <i class="bi bi-hourglass-split" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block; animation: pulse 2s infinite;"></i>
                <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">جاري قراءة QR Code...</p>
            `;
            console.log('✅ [POS Scanner] تم إظهار loading div');
        } else {
            console.warn('⚠️ [POS Scanner] loading div غير موجود:', loadingDivId);
        }
        
        console.log('⏳ [POS Scanner] جاري قراءة QR Code من الصورة...');
        
        // التأكد من تحميل مكتبة Html5Qrcode
        if (typeof Html5Qrcode === 'undefined') {
            console.log('📚 [POS Scanner] تحميل مكتبة Html5Qrcode...');
            if (typeof window.loadHtml5Qrcode === 'function') {
                await window.loadHtml5Qrcode();
                console.log('✅ [POS Scanner] تم تحميل مكتبة Html5Qrcode');
            } else {
                throw new Error('مكتبة QR Code غير متاحة');
            }
        }
        
        // قراءة QR code من الصورة
        console.log('🔍 [POS Scanner] بدء قراءة QR Code من الصورة...');
        const decodedText = await Html5Qrcode.scanFileFromDevice(file, true);
        
        if (decodedText) {
            const successTimestamp = new Date().toISOString();
            console.log('✅✅✅ [POS Scanner] تم قراءة QR Code من الصورة بنجاح ✅✅✅');
            console.log('📋 [POS Scanner] البيانات المقروءة:', decodedText);
            console.log('⏰ [POS Scanner] الوقت:', successTimestamp);
            
            // Log في error log
            try {
                const logMessage = `[POS QR Scanner IMAGE SUCCESS] ${successTimestamp} - Text: ${decodedText} - File: ${file.name} - Size: ${file.size} bytes`;
                console.error(logMessage); // استخدام console.error للظهور في error logs
            } catch (e) {
                console.error('خطأ في تسجيل log:', e);
            }
            
            // إخفاء loading
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            
            // معالجة QR code المقروء
            handlePOSQRCodeScanned(decodedText);
            
            // إعادة فتح الكاميرا المباشرة بعد القراءة
            setTimeout(async () => {
                try {
                    const qrReaderId = window.innerWidth <= 767.98 ? 'pos-qr-reader-mobile' : 'pos-qr-reader';
                    const qrReader = document.getElementById(qrReaderId);
                    if (qrReader && typeof initializePOSQRCodeScanner === 'function') {
                        console.log('🔄 [POS Scanner] إعادة فتح الكاميرا المباشرة...');
                        await initializePOSQRCodeScanner();
                    }
                } catch (e) {
                    console.log('⚠️ [POS Scanner] لا يمكن إعادة فتح الكاميرا المباشرة:', e);
                }
            }, 1000);
        } else {
            console.warn('⚠️ [POS Scanner] لم يتم قراءة أي نص من الصورة');
        }
    } catch (error) {
        const errorTimestamp = new Date().toISOString();
        console.error('❌ [POS Scanner] خطأ في قراءة QR Code من الصورة:', error);
        console.error('📦 [POS Scanner] تفاصيل الخطأ:', {
            message: error.message,
            stack: error.stack,
            timestamp: errorTimestamp
        });
        
        // Log في error log
        try {
            const logMessage = `[POS QR Scanner IMAGE ERROR] ${errorTimestamp} - Error: ${error.message} - File: ${file.name} - Size: ${file.size} bytes`;
            console.error(logMessage);
        } catch (e) {
            console.error('خطأ في تسجيل error log:', e);
        }
        
        const loadingDiv = document.getElementById(loadingDivId);
        const errorDiv = document.getElementById(errorDivId);
        const errorMessageEl = document.getElementById(errorMessageId);
        
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        if (errorDiv && errorMessageEl) {
            errorDiv.style.display = 'block';
            if (error.message && error.message.includes('No QR code found')) {
                errorMessageEl.textContent = '❌ لم يتم العثور على QR Code في الصورة. يرجى التأكد من أن الصورة واضحة وأن QR Code موجود فيها.';
            } else {
                errorMessageEl.textContent = `❌ فشل في قراءة QR Code من الصورة: ${error.message || 'خطأ غير معروف'}`;
            }
        }
        
        showMessage('❌ لم يتم العثور على QR Code في الصورة. يرجى المحاولة مرة أخرى.', 'error');
        
        // إعادة فتح الكاميرا المباشرة
        setTimeout(async () => {
            try {
                const qrReaderId = window.innerWidth <= 767.98 ? 'pos-qr-reader-mobile' : 'pos-qr-reader';
                const qrReader = document.getElementById(qrReaderId);
                if (qrReader && typeof initializePOSQRCodeScanner === 'function') {
                    console.log('🔄 [POS Scanner] إعادة فتح الكاميرا المباشرة بعد الخطأ...');
                    await initializePOSQRCodeScanner();
                }
            } catch (e) {
                console.log('⚠️ [POS Scanner] لا يمكن إعادة فتح الكاميرا المباشرة:', e);
            }
        }, 2000);
    } finally {
        // إعادة تعيين file input للسماح باختيار نفس الملف مرة أخرى
        if (event.target) {
            event.target.value = '';
            console.log('🔄 [POS Scanner] تم إعادة تعيين file input');
        }
    }
}

// دالة لإيقاف الماسح المدمج (للهواتف)
async function stopPOSQRCodeScannerMobile() {
    try {
        if (posQRCodeScannerInstance) {
            try {
                await posQRCodeScannerInstance.stop();
            } catch (err) {
                // تجاهل الأخطاء إذا كان الماسح متوقفاً بالفعل
            }
            try {
                await posQRCodeScannerInstance.clear();
            } catch (err) {
                // تجاهل الأخطاء
            }
            posQRCodeScannerInstance = null;
        }
        posScannerOpen = false;
    } catch (e) {
        posQRCodeScannerInstance = null;
        posScannerOpen = false;
    }
}

// Make functions globally available
window.openPOSBarcodeScanner = openPOSBarcodeScanner;
window.closePOSBarcodeScanner = closePOSBarcodeScanner;
window.togglePOSCamera = togglePOSCamera;
window.stopPOSQRCodeScannerMobile = stopPOSQRCodeScannerMobile;
window.initializePOSQRCodeScannerAuto = initializePOSQRCodeScannerAuto;
window.initializePOSQRCodeScannerMobile = initializePOSQRCodeScannerMobile;
window.openPOSImageScanner = openPOSImageScanner;
window.openPOSImageScannerMobile = openPOSImageScannerMobile;
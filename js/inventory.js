// إدارة المخزون - الأقسام الثلاثة

let currentInventoryTab = 'spare_parts'; // spare_parts, accessories, phones
let allSpareParts = [];
let allAccessories = [];
let allPhones = [];
let currentSparePartFilter = 'all';
let currentSparePartBrandFilter = 'all';
let currentAccessoryFilter = 'all';
let currentPhoneBrand = 'all';

// متغيرات لمنع الاستدعاءات المتكررة
let isLoadingSpareParts = false;
let isLoadingAccessories = false;
let isLoadingPhones = false;
let isLoadingInventorySection = false;

// قائمة أنواع قطع الغيار
const sparePartTypes = [
    { id: 'screen', name: 'شاشة', icon: 'bi-display' },
    { id: 'battery', name: 'بطارية', icon: 'bi-battery-full' },
    { id: 'rear_camera', name: 'كاميرا خلفية', icon: 'bi-camera' },
    { id: 'front_camera', name: 'كاميرا أمامية', icon: 'bi-camera-video' },
    { id: 'charging_port', name: 'فلاتة شحن', icon: 'bi-usb-c' },
    { id: 'flex_connector', name: 'فلاتة ربط', icon: 'bi-diagram-3' },
    { id: 'power_flex', name: 'فلاتة باور', icon: 'bi-lightning-charge' },
    { id: 'motherboard', name: 'بوردة', icon: 'bi-cpu' },
    { id: 'frame', name: 'فريم', icon: 'bi-square' },
    { id: 'housing', name: 'هاوسنج', icon: 'bi-box' },
    { id: 'back_cover', name: 'ظهر', icon: 'bi-back' },
    { id: 'lens', name: 'عدسات', icon: 'bi-circle' },
    { id: 'ic', name: 'IC', icon: 'bi-chip', isCustom: true },
    { id: 'external_buttons', name: 'أزرار خارجية', icon: 'bi-three-dots' },
    { id: 'earpiece', name: 'سماعة مكالمات', icon: 'bi-mic' },
    { id: 'speaker', name: 'علبة جرس', icon: 'bi-speaker' },
    { id: 'network_wire', name: 'واير شبكة', icon: 'bi-wifi' },
    { id: 'network_flex', name: 'فلاتة شبكة', icon: 'bi-signal' },
    { id: 'other', name: 'ملحقات أخرى', icon: 'bi-three-dots-vertical', isCustom: true }
];

// قائمة أنواع الإكسسوارات
const accessoryTypes = [
    { id: 'wired_headphones', name: 'سماعات سلك', icon: 'bi-headphones' },
    { id: 'wireless_headphones', name: 'سماعات وايرلس', icon: 'bi-earbuds' },
    { id: 'earbuds', name: 'إيربودز', icon: 'bi-earbuds' },
    { id: 'chargers', name: 'شواحن', icon: 'bi-lightning-charge' },
    { id: 'cables', name: 'كابلات', icon: 'bi-usb-c' },
    { id: 'power_bank', name: 'باور بانك', icon: 'bi-battery-charging' },
    { id: 'external_battery', name: 'بطارية خارجية', icon: 'bi-battery' },
    { id: 'other', name: 'ملحقات', icon: 'bi-box-seam' }
];

// قائمة الماركات الشائعة
const phoneBrands = [
    { id: 'samsung', name: 'Samsung', icon: 'bi-phone', logo: 'brands/samsung.svg' },
    { id: 'apple', name: 'Apple', icon: 'bi-apple', logo: 'brands/apple.svg' },
    { id: 'xiaomi', name: 'Xiaomi', icon: 'bi-phone', logo: 'brands/xiaomi.svg' },
    { id: 'huawei', name: 'Huawei', icon: 'bi-phone', logo: 'brands/huawei.svg' },
    { id: 'oppo', name: 'Oppo', icon: 'bi-phone', logo: 'brands/oppo.svg' },
    { id: 'vivo', name: 'Vivo', icon: 'bi-phone', logo: 'brands/vivo.svg' },
    { id: 'realme', name: 'Realme', icon: 'bi-phone', logo: 'brands/realme.svg' },
    { id: 'oneplus', name: 'OnePlus', icon: 'bi-phone', logo: 'brands/oneplus.svg' },
    { id: 'other', name: 'أخرى', icon: 'bi-phone', logo: 'brands/other.svg' }
];

// تهيئة قسم المخزون

// التبديل بين الأقسام
function switchInventoryTab(tab, element) {
    currentInventoryTab = tab;
    
    // حفظ التبويب الحالي في localStorage
    try {
        localStorage.setItem('current_inventory_tab', tab);
    } catch (error) {
        console.error('خطأ في حفظ التبويب:', error);
    }
    
    // تحديث التبويبات
    document.querySelectorAll('.inventory-tab').forEach(t => t.classList.remove('active'));
    if (element) {
        element.closest('.inventory-tab').classList.add('active');
    } else {
        // البحث عن التبويب المناسب
        document.querySelectorAll('.inventory-tab').forEach(t => {
            if (t.textContent.includes(tab === 'spare_parts' ? 'قطع' : tab === 'accessories' ? 'إكسسوارات' : 'هواتف')) {
                t.classList.add('active');
            }
        });
    }
    
    // إظهار/إخفاء الأقسام
    document.querySelectorAll('.inventory-section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(`${tab}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // إعادة تحميل البيانات دائماً عند التبديل لضمان عرض العناصر
    console.log('🔄 التبديل إلى تبويب:', tab);
    
    // التأكد من أن القسم مرئي قبل تحميل البيانات
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // إعطاء وقت قصير للـ DOM للتحديث
    setTimeout(() => {
        switch(tab) {
            case 'spare_parts':
                // إعادة تحميل دائماً لضمان عرض العناصر
                console.log('📦 تحميل قطع الغيار...');
                loadSpareParts();
                break;
            case 'accessories':
                // إعادة تحميل دائماً لضمان عرض العناصر
                console.log('📦 تحميل الإكسسوارات...');
                loadAccessories();
                break;
            case 'phones':
                // إعادة تحميل دائماً لضمان عرض العناصر
                console.log('📦 تحميل الهواتف...');
                loadPhones();
                break;
        }
    }, 50);
}

// ============================================
// قسم قطع الغيار
// ============================================

async function loadSpareParts() {
    // منع الاستدعاءات المتكررة
    if (isLoadingSpareParts) {
        console.log('⏳ تحميل قطع الغيار قيد التنفيذ بالفعل...');
        return;
    }
    
    isLoadingSpareParts = true;
    try {
        console.log('📥 بدء تحميل قطع الغيار...');
        const result = await API.getSpareParts();
        if (result.success) {
            allSpareParts = result.data || [];
            console.log('✅ تم تحميل قطع الغيار:', allSpareParts.length, 'قطعة');
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('sparePartsGrid');
            if (!grid) {
                console.warn('⚠️ العنصر sparePartsGrid غير موجود، إعادة المحاولة...');
                setTimeout(() => {
                    const retryGrid = document.getElementById('sparePartsGrid');
                    if (retryGrid) {
                        displaySpareParts(allSpareParts);
                        createSparePartsBrandFilters();
                    } else {
                        console.error('❌ العنصر sparePartsGrid غير موجود بعد المحاولة');
                    }
                }, 300);
                return;
            }
            
            displaySpareParts(allSpareParts);
            createSparePartsBrandFilters();
        } else {
            console.error('❌ خطأ في تحميل قطع الغيار:', result.message);
            showMessage(result.message || 'خطأ في تحميل قطع الغيار', 'error');
            
            // عرض رسالة فارغة في Grid
            const grid = document.getElementById('sparePartsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">${result.message || 'خطأ في تحميل قطع الغيار'}</div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل قطع الغيار:', error);
        showMessage('حدث خطأ في تحميل قطع الغيار', 'error');
        
        // عرض رسالة خطأ في Grid
        const grid = document.getElementById('sparePartsGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="inventory-empty">
                    <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                    <div class="inventory-empty-text">حدث خطأ في تحميل قطع الغيار</div>
                </div>
            `;
        }
    } finally {
        isLoadingSpareParts = false;
    }
}

function displaySpareParts(parts) {
    // التأكد من أن القسم نشط
    const section = document.getElementById('spare-parts-section');
    if (section && !section.classList.contains('active')) {
        // جعل القسم نشطاً
        document.querySelectorAll('.inventory-section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
    }
    
    const grid = document.getElementById('sparePartsGrid');
    if (!grid) {
        console.error('❌ العنصر sparePartsGrid غير موجود في displaySpareParts');
        // إعادة المحاولة بعد قليل
        setTimeout(() => {
            const retryGrid = document.getElementById('sparePartsGrid');
            if (retryGrid && parts) {
                displaySpareParts(parts);
            } else {
                console.error('❌ فشل في العثور على sparePartsGrid بعد المحاولة');
            }
        }, 300);
        return;
    }
    
    console.log('📊 عرض قطع الغيار:', parts ? parts.length : 0, 'قطعة');
    
    if (!parts || parts.length === 0) {
        grid.innerHTML = `
            <div class="inventory-empty">
                <div class="inventory-empty-icon"><i class="bi bi-inbox"></i></div>
                <div class="inventory-empty-text">لا توجد قطع غيار</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = parts.map(part => {
        const barcode = part.barcode || `${part.brand}-${part.model}-${part.id}`;
        let barcodeImage = '';
        try {
            if (typeof BarcodeGenerator !== 'undefined') {
                const barcodeGenerator = new BarcodeGenerator();
                barcodeImage = barcodeGenerator.generateBarcode(barcode, 200, 60);
            } else if (typeof window.barcodeGenerator !== 'undefined') {
                barcodeImage = window.barcodeGenerator.generateBarcode(barcode, 200, 60);
            } else {
                // Fallback: نص بسيط
                barcodeImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QmFyY29kZTwvdGV4dD48L3N2Zz4=';
            }
        } catch (error) {
            console.error('خطأ في إنشاء الباركود:', error);
            barcodeImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QmFyY29kZTwvdGV4dD48L3N2Zz4=';
        }
        
        return `
            <div class="inventory-card">
                <div class="inventory-card-header">
                    <div class="inventory-card-title">
                        <h3>${part.brand}</h3>
                        <h2> الموديل : ${part.model}</h2>
                    </div>
                    <div class="inventory-card-icon">
                        <i class="bi bi-phone"></i>
                    </div>
                </div>
                
                <div class="inventory-card-body">
                    ${part.image ? `
                        <div class="inventory-card-image">
                            <img src="${part.image}" alt="${part.brand} ${part.model}">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-image" style="font-size: 48px;"></i>
                        </div>
                    `}
                    
                    <div class="inventory-card-barcode">
                        <img src="${barcodeImage}" alt="Barcode">
                        <div class="inventory-card-barcode-code">
                            <span>${barcode}</span>
                            <button onclick="copyBarcode('${barcode}')" class="inventory-card-barcode-code-copy" title="نسخ الباركود">
                                <i class="bi bi-copy"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="inventory-card-actions">
                    <button onclick="printSparePartBarcode('${part.id}', '${barcode.replace(/'/g, "\\'")}', '${barcodeImage.replace(/'/g, "\\'")}')" class="btn btn-info btn-sm" title="طباعة الباركود">
                        <i class="bi bi-printer"></i> طباعة
                    </button>
                    <button onclick="previewSparePart('${part.id}')" class="btn btn-primary btn-sm">
                        <i class="bi bi-eye"></i> معاينة
                    </button>
                    <button onclick="editSparePart('${part.id}')" class="btn btn-secondary btn-sm" data-permission="manager">
                        <i class="bi bi-pencil"></i> تعديل
                    </button>
                    <button onclick="deleteSparePart('${part.id}')" class="btn btn-danger btn-sm" data-permission="admin">
                        <i class="bi bi-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    hideByPermission();
}

function filterSpareParts() {
    const search = document.getElementById('sparePartsSearch').value.toLowerCase();
    let filtered = allSpareParts;
    
    // فلترة بالماركة
    if (currentSparePartBrandFilter !== 'all') {
        filtered = filtered.filter(part => part.brand.toLowerCase() === currentSparePartBrandFilter);
    }
    
    // البحث بالموديل
    if (search) {
        filtered = filtered.filter(part => 
            part.model.toLowerCase().includes(search) ||
            (part.barcode && part.barcode.toLowerCase().includes(search))
        );
    }
    
    displaySpareParts(filtered);
}

function createSparePartsBrandFilters() {
    // جمع جميع الماركات الفريدة
    const brands = [...new Set(allSpareParts.map(part => part.brand))].sort();
    const container = document.getElementById('sparePartsBrandFilters');
    if (!container) return;
    
    container.innerHTML = `
        <div class="filter-button active" onclick="filterSparePartsByBrand('all', this)">
            <i class="bi bi-grid"></i>
            <span>الكل</span>
        </div>
        ${brands.map(brand => `
            <div class="filter-button" onclick="filterSparePartsByBrand('${brand.toLowerCase()}', this)">
                <i class="bi bi-phone"></i>
                <span>${brand}</span>
            </div>
        `).join('')}
    `;
}

function filterSparePartsByBrand(brand, element) {
    currentSparePartBrandFilter = brand;
    
    // تحديث الأزرار
    document.querySelectorAll('#sparePartsBrandFilters .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (element) {
        element.closest('.filter-button').classList.add('active');
    }
    
    filterSpareParts();
}

function showAddSparePartModal() {
    document.getElementById('sparePartModalTitle').textContent = 'إضافة قطعة غيار';
    document.getElementById('sparePartForm').reset();
    document.getElementById('sparePartId').value = '';
    document.getElementById('sparePartItems').innerHTML = '';
    document.getElementById('sparePartBrandCustom').style.display = 'none';
    document.getElementById('sparePartImagePreview').style.display = 'none';
    document.getElementById('sparePartImageFile').value = '';
    document.getElementById('sparePartModal').style.display = 'flex';
}

function editSparePart(id) {
    const part = allSpareParts.find(p => p.id === id);
    if (!part) return;
    
    document.getElementById('sparePartModalTitle').textContent = 'تعديل قطعة غيار';
    document.getElementById('sparePartId').value = part.id;
    
    // التحقق إذا كانت الماركة موجودة في القائمة
    const brandExists = phoneBrands.find(b => b.name === part.brand);
    if (brandExists) {
        document.getElementById('sparePartBrand').value = part.brand;
        document.getElementById('sparePartBrandCustom').style.display = 'none';
    } else {
        document.getElementById('sparePartBrand').value = 'أخرى';
        document.getElementById('sparePartBrandCustom').value = part.brand;
        document.getElementById('sparePartBrandCustom').style.display = 'block';
    }
    
    document.getElementById('sparePartModel').value = part.model;
    document.getElementById('sparePartBarcode').value = part.barcode || '';
    document.getElementById('sparePartImage').value = part.image || '';
    
    // عرض معاينة الصورة
    if (part.image) {
        const preview = document.getElementById('sparePartImagePreview');
        const previewImg = document.getElementById('sparePartImagePreviewImg');
        previewImg.src = part.image;
        preview.style.display = 'block';
    } else {
        document.getElementById('sparePartImagePreview').style.display = 'none';
    }
    
    // تحميل القطع
    loadSparePartItems(part.items || []);
    
    document.getElementById('sparePartModal').style.display = 'flex';
}

function loadSparePartItems(items) {
    const container = document.getElementById('sparePartItems');
    if (!container) return;
    
    container.innerHTML = items.map(item => {
        const type = sparePartTypes.find(t => t.id === item.item_type);
        const showCustom = type && type.isCustom || item.item_type === 'other';
        const isOther = item.item_type === 'other' || !type;
        
        return `
            <div class="spare-part-item-row" data-item-id="${item.id || ''}" style="display: grid; grid-template-columns: 1.5fr 80px 100px 100px auto; gap: 8px; align-items: center; margin-bottom: 10px; padding: 10px; background: var(--light-bg); border-radius: 6px;">
                <select class="spare-part-item-type" onchange="handleSparePartItemTypeChange(this)">
                    ${sparePartTypes.map(t => `
                        <option value="${t.id}" ${item.item_type === t.id ? 'selected' : ''}>${t.name}</option>
                    `).join('')}
                    ${isOther && !type ? `<option value="other" selected>${item.item_type || 'أخرى'}</option>` : ''}
                </select>
                <input type="number" class="spare-part-item-quantity" value="${item.quantity || 1}" min="1" placeholder="الكمية">
                <input type="number" class="spare-part-item-purchase-price" step="1" min="0" value="${item.purchase_price}" placeholder="سعر التكلفة">
                <input type="number" class="spare-part-item-selling-price" step="1" min="0" value="${item.selling_price || item.price}" placeholder="سعر البيع">
                <input type="text" class="spare-part-item-custom" value="${item.custom_value || (isOther ? item.item_type : '')}" placeholder="أدخل النوع يدوياً" style="display: ${showCustom ? 'block' : 'none'}; grid-column: 1 / -1;">
                <button onclick="removeSparePartItem(this)" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
            </div>
        `;
    }).join('');
}

async function deleteSparePart(id) {
    if (!hasPermission('admin')) {
        showMessage('ليس لديك صلاحية للحذف', 'error');
        return;
    }
    
    if (!confirmAction('هل أنت متأكد من حذف هذه القطعة؟')) return;
    
    const result = await API.deleteSparePart(id);
    if (result.success) {
        showMessage(result.message);
        loadSpareParts();
    } else {
        showMessage(result.message, 'error');
    }
}

function previewSparePart(id) {
    const part = allSpareParts.find(p => p.id === id);
    if (!part) return;
    
    const modal = document.getElementById('previewModal');
    const modalContent = document.getElementById('previewModalContent');
    
    modalContent.innerHTML = `
        <div class="preview-modal-header">
            <h3>معاينة: ${part.brand} ${part.model}</h3>
            <button onclick="closePreviewModal()" class="preview-modal-close">&times;</button>
        </div>
        
        <div class="preview-items-grid">
            ${(part.items || []).map(item => {
                const type = sparePartTypes.find(t => t.id === item.item_type);
                return `
                    <div class="preview-item">
                        <div class="preview-item-icon"><i class="bi ${type ? type.icon : 'bi-circle'}"></i></div>
                        <div class="preview-item-name">${type ? type.name : item.item_type}</div>
                        <div class="preview-item-quantity">الكمية: ${item.quantity || 1}</div>
                        ${item.price && item.price > 0 ? `<div class="preview-item-price" style="color: var(--primary-color); font-weight: bold; margin-top: 5px;">السعر: ${formatCurrency(item.price)}</div>` : ''}
                        ${item.custom_value ? `<div class="preview-item-custom">${item.custom_value}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        ${(part.items || []).length > 0 ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--light-bg);">
                <h4 style="margin-bottom: 15px; color: var(--text-color);">تفاصيل القطع وأسعارها:</h4>
                ${(part.items || []).map(item => {
                    const type = sparePartTypes.find(t => t.id === item.item_type);
                    const itemName = type ? type.name : (item.item_type || 'غير محدد');
                    return `
                        <div style="padding: 10px; margin-bottom: 10px; background: var(--light-bg); border-radius: 6px;">
                            <div style="font-weight: bold; margin-bottom: 5px;">${itemName} (الكمية: ${item.quantity || 1})</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                                <span>سعر التكلفة: <strong>${formatCurrency(item.purchase_price || 0)}</strong></span>
                                <span>سعر البيع: <strong style="color: var(--primary-color);">${formatCurrency(item.selling_price || item.price || 0)}</strong></span>
                            </div>
                            ${item.custom_value ? `<div style="margin-top: 5px; font-size: 0.85em; color: #666;">${item.custom_value}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        ` : ''}
    `;
    
    modal.style.display = 'block';
}

function closePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
}

// ============================================
// قسم الإكسسوارات
// ============================================

function createAccessoryFilters() {
    const container = document.getElementById('accessoryFilters');
    container.innerHTML = `
        <div class="filter-button active" onclick="filterAccessoriesByType('all', this)">
            <i class="bi bi-grid"></i>
            <span>الكل</span>
        </div>
        ${accessoryTypes.map(type => `
            <div class="filter-button" onclick="filterAccessoriesByType('${type.id}', this)">
                <i class="bi ${type.icon}"></i>
                <span>${type.name}</span>
            </div>
        `).join('')}
    `;
}

function filterAccessoriesByType(type, element) {
    currentAccessoryFilter = type;
    
    // تحديث الأزرار
    document.querySelectorAll('#accessoryFilters .filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (element) {
        element.closest('.filter-button').classList.add('active');
    }
    
    filterAccessories();
}

async function loadAccessories() {
    // منع الاستدعاءات المتكررة
    if (isLoadingAccessories) {
        console.log('⏳ تحميل الإكسسوارات قيد التنفيذ بالفعل...');
        return;
    }
    
    isLoadingAccessories = true;
    try {
        console.log('📥 بدء تحميل الإكسسوارات...');
        const result = await API.getAccessories();
        if (result.success) {
            allAccessories = result.data || [];
            console.log('✅ تم تحميل الإكسسوارات:', allAccessories.length, 'إكسسوار');
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('accessoriesGrid');
            if (!grid) {
                console.warn('⚠️ العنصر accessoriesGrid غير موجود، إعادة المحاولة...');
                setTimeout(() => {
                    const retryGrid = document.getElementById('accessoriesGrid');
                    if (retryGrid) {
                        displayAccessories(allAccessories);
                    } else {
                        console.error('❌ العنصر accessoriesGrid غير موجود بعد المحاولة');
                    }
                }, 300);
                return;
            }
            
            displayAccessories(allAccessories);
        } else {
            console.error('❌ خطأ في تحميل الإكسسوارات:', result.message);
            showMessage(result.message || 'خطأ في تحميل الإكسسوارات', 'error');
            
            // عرض رسالة فارغة في Grid
            const grid = document.getElementById('accessoriesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">${result.message || 'خطأ في تحميل الإكسسوارات'}</div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل الإكسسوارات:', error);
        showMessage('حدث خطأ في تحميل الإكسسوارات', 'error');
        
        // عرض رسالة خطأ في Grid
        const grid = document.getElementById('accessoriesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="inventory-empty">
                    <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                    <div class="inventory-empty-text">حدث خطأ في تحميل الإكسسوارات</div>
                </div>
            `;
        }
    } finally {
        isLoadingAccessories = false;
    }
}

function displayAccessories(accessories) {
    // التأكد من أن القسم نشط
    const section = document.getElementById('accessories-section');
    if (section && !section.classList.contains('active')) {
        // جعل القسم نشطاً
        document.querySelectorAll('.inventory-section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
    }
    
    const grid = document.getElementById('accessoriesGrid');
    if (!grid) {
        console.error('❌ العنصر accessoriesGrid غير موجود في displayAccessories');
        // إعادة المحاولة بعد قليل
        setTimeout(() => {
            const retryGrid = document.getElementById('accessoriesGrid');
            if (retryGrid && accessories) {
                displayAccessories(accessories);
            } else {
                console.error('❌ فشل في العثور على accessoriesGrid بعد المحاولة');
            }
        }, 300);
        return;
    }
    
    console.log('📊 عرض الإكسسوارات:', accessories ? accessories.length : 0, 'إكسسوار');
    
    if (!accessories || accessories.length === 0) {
        grid.innerHTML = `
            <div class="inventory-empty">
                <div class="inventory-empty-icon"><i class="bi bi-inbox"></i></div>
                <div class="inventory-empty-text">لا توجد إكسسوارات</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = accessories.map(accessory => {
        const type = accessoryTypes.find(t => t.id === accessory.type);
        
        return `
            <div class="inventory-card">
                <div class="inventory-card-header">
                    <div class="inventory-card-title">
                        <h2>${accessory.name}</h2>
                        <p>${type ? type.name : accessory.type}</p>
                    </div>
                    <div class="inventory-card-icon">
                        <i class="bi ${type ? type.icon : 'bi-box-seam'}"></i>
                    </div>
                </div>
                
                <div class="inventory-card-body">
                    ${accessory.image ? `
                        <div class="inventory-card-image">
                            <img src="${accessory.image}" alt="${accessory.name}">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-image" style="font-size: 48px;"></i>
                        </div>
                    `}
                </div>
                
                <div class="inventory-card-price">
                    <span class="inventory-card-price-label">سعر البيع:</span>
                    <span class="inventory-card-price-value">${formatCurrency(accessory.selling_price || 0)}</span>
                </div>
                
                <div class="inventory-card-quantity" style="margin-top: 10px; padding: 8px; background: var(--light-bg); border-radius: 6px; text-align: center;">
                    <span style="font-weight: bold; color: var(--text-color);">الكمية المتوفرة: </span>
                    <span style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${accessory.quantity || 0}</span>
                </div>
                
                <div class="inventory-card-actions">
                    <button onclick="printAccessoryBarcode('${accessory.id}')" class="btn btn-info btn-sm">
                        <i class="bi bi-printer"></i> طباعة باركود
                    </button>
                    <button onclick="editAccessory('${accessory.id}')" class="btn btn-secondary btn-sm" data-permission="manager">
                        <i class="bi bi-pencil"></i> تعديل
                    </button>
                    <button onclick="deleteAccessory('${accessory.id}')" class="btn btn-danger btn-sm" data-permission="admin">
                        <i class="bi bi-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    hideByPermission();
}

function filterAccessories() {
    const search = document.getElementById('accessoriesSearch').value.toLowerCase();
    let filtered = allAccessories.filter(accessory => 
        accessory.name.toLowerCase().includes(search)
    );
    
    if (currentAccessoryFilter !== 'all') {
        filtered = filtered.filter(accessory => accessory.type === currentAccessoryFilter);
    }
    
    displayAccessories(filtered);
}

async function deleteAccessory(id) {
    if (!hasPermission('admin')) {
        showMessage('ليس لديك صلاحية للحذف', 'error');
        return;
    }
    
    if (!confirmAction('هل أنت متأكد من حذف هذا الإكسسوار؟')) return;
    
    const result = await API.deleteAccessory(id);
    if (result.success) {
        showMessage(result.message);
        loadAccessories();
    } else {
        showMessage(result.message, 'error');
    }
}

// ============================================
// قسم الهواتف
// ============================================

function createPhoneBrands() {
    const container = document.getElementById('phoneBrands');
    container.innerHTML = `
        <div class="brand-button active" onclick="filterPhonesByBrand('all', this)">
            <div class="brand-button-icon"><i class="bi bi-grid"></i></div>
            <div class="brand-button-name">الكل</div>
        </div>
        ${phoneBrands.map(brand => `
            <div class="brand-button" onclick="filterPhonesByBrand('${brand.id}', this)">
                ${brand.logo ? `
                    <div class="brand-button-icon">
                        <img src="${brand.logo}" alt="${brand.name}" class="brand-button-image">
                    </div>
                ` : `
                    <div class="brand-button-icon"><i class="bi ${brand.icon}"></i></div>
                `}
                <div class="brand-button-name">${brand.name}</div>
            </div>
        `).join('')}
    `;
}

function filterPhonesByBrand(brand, element) {
    currentPhoneBrand = brand;
    
    // تحديث الأزرار
    document.querySelectorAll('#phoneBrands .brand-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (element) {
        element.closest('.brand-button').classList.add('active');
    }
    
    filterPhones();
}

async function loadPhones() {
    // منع الاستدعاءات المتكررة
    if (isLoadingPhones) {
        console.log('⏳ تحميل الهواتف قيد التنفيذ بالفعل...');
        return;
    }
    
    isLoadingPhones = true;
    try {
        console.log('📥 بدء تحميل الهواتف...');
        const result = await API.getPhones();
        if (result.success) {
            allPhones = result.data || [];
            console.log('✅ تم تحميل الهواتف:', allPhones.length, 'هاتف');
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('phonesGrid');
            if (!grid) {
                console.warn('⚠️ العنصر phonesGrid غير موجود، إعادة المحاولة...');
                setTimeout(() => {
                    const retryGrid = document.getElementById('phonesGrid');
                    if (retryGrid) {
                        displayPhones(allPhones);
                    } else {
                        console.error('❌ العنصر phonesGrid غير موجود بعد المحاولة');
                    }
                }, 300);
                return;
            }
            
            displayPhones(allPhones);
        } else {
            console.error('❌ خطأ في تحميل الهواتف:', result.message);
            showMessage(result.message || 'خطأ في تحميل الهواتف', 'error');
            
            // عرض رسالة فارغة في Grid
            const grid = document.getElementById('phonesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">${result.message || 'خطأ في تحميل الهواتف'}</div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل الهواتف:', error);
        showMessage('حدث خطأ في تحميل الهواتف', 'error');
        
        // عرض رسالة خطأ في Grid
        const grid = document.getElementById('phonesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="inventory-empty">
                    <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                    <div class="inventory-empty-text">حدث خطأ في تحميل الهواتف</div>
                </div>
            `;
        }
    } finally {
        isLoadingPhones = false;
    }
}

function displayPhones(phones) {
    // التأكد من أن القسم نشط
    const section = document.getElementById('phones-section');
    if (section && !section.classList.contains('active')) {
        // جعل القسم نشطاً
        document.querySelectorAll('.inventory-section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
    }
    
    const grid = document.getElementById('phonesGrid');
    if (!grid) {
        console.error('❌ العنصر phonesGrid غير موجود في displayPhones');
        // إعادة المحاولة بعد قليل
        setTimeout(() => {
            const retryGrid = document.getElementById('phonesGrid');
            if (retryGrid && phones) {
                displayPhones(phones);
            } else {
                console.error('❌ فشل في العثور على phonesGrid بعد المحاولة');
            }
        }, 300);
        return;
    }
    
    console.log('📊 عرض الهواتف:', phones ? phones.length : 0, 'هاتف');
    
    if (!phones || phones.length === 0) {
        grid.innerHTML = `
            <div class="inventory-empty">
                <div class="inventory-empty-icon"><i class="bi bi-inbox"></i></div>
                <div class="inventory-empty-text">لا توجد هواتف</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = phones.map(phone => {
        const brand = phoneBrands.find(b => b.id === phone.brand.toLowerCase()) || phoneBrands[phoneBrands.length - 1];
        
        // التحقق من صحة الصورة
        const isValidImage = phone.image && (
            phone.image.startsWith('data:image/') || 
            phone.image.startsWith('http://') || 
            phone.image.startsWith('https://') || 
            phone.image.startsWith('/')
        );
        
        // تنظيف الصورة من أي أحرف غير صالحة
        const cleanImage = phone.image ? phone.image.trim().replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
        const cleanBrand = (phone.brand || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const cleanModel = (phone.model || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const cleanPhoneId = (phone.id || '').replace(/'/g, '&#39;');
        
        return `
            <div class="inventory-card" onclick="viewPhoneDetails('${cleanPhoneId}')" style="cursor: pointer;">
                <div class="inventory-card-header">
                    <div class="inventory-card-title">
                        <h2>${cleanBrand}</h2>
                        <h1>${cleanModel}</h1>
                    </div>
                    <div class="inventory-card-icon">
                        <i class="bi ${brand.icon}"></i>
                    </div>
                </div>
                
                <div class="inventory-card-body">
                    ${isValidImage ? `
                        <div class="inventory-card-image" data-phone-id="${cleanPhoneId}">
                            <img src="${cleanImage}" 
                                 alt="${cleanBrand} ${cleanModel}" 
                                 loading="lazy" 
                                 decoding="async"
                                 onerror="handlePhoneImageError(this, '${cleanPhoneId}');">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-phone" style="font-size: 48px; color: var(--text-light);"></i>
                        </div>
                    `}
                </div>
                
                <div class="inventory-card-price">
                    <span class="inventory-card-price-label">سعر البيع:</span>
                    <span class="inventory-card-price-value">${formatCurrency(phone.selling_price || 0)}</span>
                </div>
                
                <div class="inventory-card-actions">
                    <button onclick="event.stopPropagation(); printPhoneLabel('${phone.id}')" class="btn btn-info btn-sm">
                        <i class="bi bi-printer"></i> طباعة ملصق
                    </button>
                    <button onclick="event.stopPropagation(); viewPhoneDetails('${phone.id}')" class="btn btn-primary btn-sm">
                        <i class="bi bi-eye"></i> التفاصيل
                    </button>
                    <button onclick="event.stopPropagation(); editPhone('${phone.id}')" class="btn btn-secondary btn-sm" data-permission="manager">
                        <i class="bi bi-pencil"></i> تعديل
                    </button>
                    <button onclick="event.stopPropagation(); deletePhone('${phone.id}')" class="btn btn-danger btn-sm" data-permission="admin">
                        <i class="bi bi-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // تحسين جودة الصور بعد إضافتها للـ DOM
    setTimeout(() => {
        const images = grid.querySelectorAll('.inventory-card-image img');
        images.forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('loaded');
            } else {
                img.addEventListener('load', function() {
                    this.classList.add('loaded');
                });
                img.addEventListener('error', function() {
                    const phoneId = this.closest('.inventory-card-image')?.dataset?.phoneId;
                    handlePhoneImageError(this, phoneId);
                });
            }
        });
    }, 100);
    
    hideByPermission();
}

function filterPhones() {
    const search = document.getElementById('phonesSearch').value.toLowerCase();
    let filtered = allPhones.filter(phone => 
        phone.brand.toLowerCase().includes(search) ||
        phone.model.toLowerCase().includes(search) ||
        (phone.serial_number && phone.serial_number.toLowerCase().includes(search))
    );
    
    if (currentPhoneBrand !== 'all') {
        filtered = filtered.filter(phone => phone.brand.toLowerCase() === currentPhoneBrand);
    }
    
    displayPhones(filtered);
}

function viewPhoneDetails(id) {
    const phone = allPhones.find(p => p.id === id);
    if (!phone) return;
    
    const modal = document.getElementById('phoneDetailsModal');
    const modalContent = document.getElementById('phoneDetailsModalContent');
    
    // دالة مساعدة لإضافة الوحدات إذا لم تكن موجودة
    const addUnit = (value, unit) => {
        if (!value || value === '-') return '-';
        const str = String(value).trim();
        return str.toLowerCase().includes(unit.toLowerCase()) ? str : `${str} ${unit}`;
    };
    
    // معالجة رقم التسلسل
    const formatSerial = (serial) => {
        if (!serial || serial === '-') return '-';
        const str = String(serial).trim();
        // إذا كان كل الأرقام أصفار أو طويل جداً، قم بقصه أو إظهار رسالة
        if (str.length > 30 && /^0+$/.test(str)) {
            return 'غير محدد';
        }
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    };
    
    // معالجة سجل الصيانة
    const formatMaintenance = (history) => {
        if (!history) return null;
        const lines = history.split('\n').filter(line => line.trim());
        if (lines.length === 0) return null;
        return lines.map(line => `<div style="padding: 8px; margin: 5px 0; background: var(--light-bg); border-radius: 5px; border-right: 3px solid var(--primary-color);">${line.trim()}</div>`).join('');
    };
    
    modalContent.innerHTML = `
        <div class="preview-modal-header">
            <h3>${phone.brand} ${phone.model}</h3>
            <button onclick="closePhoneDetailsModal()" class="preview-modal-close">&times;</button>
        </div>
        
        <div style="max-height: 80vh; overflow-y: auto; padding: 20px;">
            ${(() => {
                // التحقق من صحة الصورة
                const isValidImage = phone.image && (
                    phone.image.startsWith('data:image/') || 
                    phone.image.startsWith('http://') || 
                    phone.image.startsWith('https://') || 
                    phone.image.startsWith('/')
                );
                const cleanImage = phone.image ? phone.image.trim().replace(/"/g, '&quot;') : '';
                
                return isValidImage ? `
                    <div style="text-align: center; margin-bottom: 25px;">
                        <img src="${cleanImage}" 
                             alt="${(phone.brand + ' ' + phone.model).replace(/"/g, '&quot;')}" 
                             loading="lazy"
                             decoding="async"
                             onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<i class=\\'bi bi-phone\\' style=\\'font-size: 64px; color: var(--text-light);\\'></i>';"
                             style="max-width: 250px; max-height: 300px; border-radius: 12px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.1); image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: high-quality; object-fit: contain;">
                    </div>
                ` : '';
            })()}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <!-- المعلومات الأساسية -->
                <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid var(--primary-color); color: var(--primary-color); display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-info-circle"></i> المعلومات الأساسية
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--light-bg); border-radius: 8px;">
                            <strong style="color: var(--text-color);">رقم التسلسل:</strong>
                            <span style="font-family: 'Courier New', monospace; color: var(--text-secondary);">${formatSerial(phone.serial_number)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--light-bg); border-radius: 8px;">
                            <strong style="color: var(--text-color);">حالة الضريبة:</strong>
                            <span style="padding: 4px 12px; border-radius: 6px; font-size: 0.9em; background: ${phone.tax_status === 'exempt' ? '#e8f5e9' : '#fff3e0'}; color: ${phone.tax_status === 'exempt' ? '#2e7d32' : '#e65100'};">
                                ${phone.tax_status === 'exempt' ? 'معفي' : 'مستحق'}
                            </span>
                        </div>
                        ${phone.tax_status === 'due' && phone.tax_amount ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--light-bg); border-radius: 8px;">
                            <strong style="color: var(--text-color);">مبلغ الضريبة:</strong>
                            <span style="color: var(--text-secondary); font-weight: 600;">${formatCurrency(phone.tax_amount)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- الإمكانيات -->
                <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid var(--primary-color); color: var(--primary-color); display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-cpu"></i> الإمكانيات
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        ${phone.storage ? `
                            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center;">
                                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 4px;">المساحة</div>
                                <div style="font-weight: bold; color: var(--text-color); font-size: 1.1em;">${addUnit(phone.storage, 'GB')}</div>
                            </div>
                        ` : ''}
                        ${phone.ram ? `
                            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center;">
                                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 4px;">الرام</div>
                                <div style="font-weight: bold; color: var(--text-color); font-size: 1.1em;">${addUnit(phone.ram, 'GB')}</div>
                            </div>
                        ` : ''}
                        ${phone.screen_type ? `
                            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center;">
                                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 4px;">نوع الشاشة</div>
                                <div style="font-weight: bold; color: var(--text-color); font-size: 1.1em;">${phone.screen_type.toUpperCase()}</div>
                            </div>
                        ` : ''}
                        ${phone.processor ? `
                            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center;">
                                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 4px;">المعالج</div>
                                <div style="font-weight: bold; color: var(--text-color); font-size: 1.1em;">${phone.processor}</div>
                            </div>
                        ` : ''}
                        ${phone.battery ? `
                            <div style="padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center; grid-column: span 2;">
                                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 4px;">البطارية</div>
                                <div style="font-weight: bold; color: var(--text-color); font-size: 1.1em;">${addUnit(phone.battery, 'mAh')}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- الأسعار -->
            <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; color: white;">
                <h4 style="margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-currency-exchange"></i> الأسعار
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px);">
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px;">سعر التكلفة</div>
                        <div style="font-size: 1.5em; font-weight: bold;">${formatCurrency(phone.purchase_price || 0)}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.25); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.3);">
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px;">سعر البيع</div>
                        <div style="font-size: 1.5em; font-weight: bold;">${formatCurrency(phone.selling_price || 0)}</div>
                    </div>
                </div>
                ${phone.purchase_price && phone.selling_price ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); text-align: center;">
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">الربح المتوقع</div>
                        <div style="font-size: 1.3em; font-weight: bold;">
                            ${formatCurrency((phone.selling_price || 0) - (phone.purchase_price || 0))}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- معلومات إضافية -->
            ${phone.accessories || phone.defects || phone.maintenance_history ? `
                <div style="display: grid; grid-template-columns: ${phone.accessories && phone.defects ? '1fr 1fr' : '1fr'}; gap: 20px; margin-bottom: 20px;">
                    ${phone.accessories ? `
                        <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                            <h4 style="margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 2px solid var(--success-color); color: var(--success-color); display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-box-seam"></i> ملحقات الجهاز
                            </h4>
                            <div style="color: var(--text-color); line-height: 1.6; white-space: pre-wrap;">${phone.accessories}</div>
                        </div>
                    ` : ''}
                    ${phone.defects ? `
                        <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); border-right: 4px solid var(--error-color);">
                            <h4 style="margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 2px solid var(--error-color); color: var(--error-color); display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-exclamation-triangle"></i> العيوب
                            </h4>
                            <div style="color: var(--text-color); line-height: 1.6; white-space: pre-wrap;">${phone.defects}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            ${phone.maintenance_history ? `
                <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid var(--info-color); color: var(--info-color); display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-tools"></i> سجل الصيانة
                    </h4>
                    <div style="color: var(--text-color);">${formatMaintenance(phone.maintenance_history) || phone.maintenance_history}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.style.display = 'block';
}

function closePhoneDetailsModal() {
    document.getElementById('phoneDetailsModal').style.display = 'none';
}

async function deletePhone(id) {
    if (!hasPermission('admin')) {
        showMessage('ليس لديك صلاحية للحذف', 'error');
        return;
    }
    
    if (!confirmAction('هل أنت متأكد من حذف هذا الهاتف؟')) return;
    
    const result = await API.deletePhone(id);
    if (result.success) {
        showMessage(result.message);
        loadPhones();
    } else {
        showMessage(result.message, 'error');
    }
}

// ============================================
// النماذج المنبثقة
// ============================================

function showAddInventoryModal() {
    if (currentInventoryTab === 'spare_parts') {
        showAddSparePartModal();
    } else if (currentInventoryTab === 'accessories') {
        showAddAccessoryModal();
    } else if (currentInventoryTab === 'phones') {
        showAddPhoneModal();
    }
}

// إضافة النماذج إلى DOM عند تحميل القسم
function createInventoryModals() {
    const section = document.getElementById('inventory-section');
    
    // نافذة معاينة قطع الغيار
    if (!document.getElementById('previewModal')) {
        const previewModal = document.createElement('div');
        previewModal.id = 'previewModal';
        previewModal.className = 'preview-modal';
        previewModal.innerHTML = `
            <div class="preview-modal-content" id="previewModalContent"></div>
        `;
        document.body.appendChild(previewModal);
    }
    
    // نافذة تفاصيل الهاتف
    if (!document.getElementById('phoneDetailsModal')) {
        const phoneModal = document.createElement('div');
        phoneModal.id = 'phoneDetailsModal';
        phoneModal.className = 'preview-modal';
        phoneModal.innerHTML = `
            <div class="preview-modal-content" id="phoneDetailsModalContent"></div>
        `;
        document.body.appendChild(phoneModal);
    }
    
    // نموذج قطع الغيار
    if (!document.getElementById('sparePartModal')) {
        const sparePartModal = document.createElement('div');
        sparePartModal.id = 'sparePartModal';
        sparePartModal.className = 'modal';
        sparePartModal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3 id="sparePartModalTitle">إضافة قطعة غيار</h3>
                    <button onclick="closeSparePartModal()" class="btn-close">&times;</button>
                </div>
                <form id="sparePartForm" onsubmit="saveSparePart(event)">
                    <input type="hidden" id="sparePartId">
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="sparePartBrand">الماركة *</label>
                            <select id="sparePartBrand" required onchange="handleSparePartBrandChange(this)">
                                ${phoneBrands.map(brand => `
                                    <option value="${brand.name}">${brand.name}</option>
                                `).join('')}
                            </select>
                            <input type="text" id="sparePartBrandCustom" style="display: none; margin-top: 10px;" placeholder="أدخل الماركة يدوياً">
                        </div>
                        <div class="form-group">
                            <label for="sparePartModel">الموديل *</label>
                            <input type="text" id="sparePartModel" required>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="sparePartBarcode">الباركود</label>
                            <input type="text" id="sparePartBarcode" placeholder="سيتم إنشاؤه تلقائياً إذا تركت فارغاً">
                        </div>
                        <div class="form-group">
                            <label for="sparePartImage">رابط الصورة</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="sparePartImage" placeholder="أو استخدم زر رفع الصورة" style="flex: 1;">
                                <input type="file" id="sparePartImageFile" accept="image/*" style="display: none;" onchange="handleSparePartImageUpload(this)">
                                <button type="button" onclick="document.getElementById('sparePartImageFile').click()" class="btn btn-secondary">
                                    <i class="bi bi-upload"></i> رفع
                                </button>
                            </div>
                            <div id="sparePartImagePreview" style="margin-top: 10px; display: none;">
                                <img id="sparePartImagePreviewImg" src="" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>قطع الغيار المتوفرة:</label>
                        <div id="sparePartItems" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; background: var(--light-bg);">
                            <!-- سيتم إضافة القطع هنا -->
                        </div>
                        <button type="button" onclick="addSparePartItem()" class="btn btn-secondary btn-sm" style="margin-top: 10px;">
                            <i class="bi bi-plus"></i> إضافة قطعة
                        </button>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" onclick="closeSparePartModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(sparePartModal);
    }
    
    // نموذج الإكسسوارات
    if (!document.getElementById('accessoryModal')) {
        const accessoryModal = document.createElement('div');
        accessoryModal.id = 'accessoryModal';
        accessoryModal.className = 'modal';
        accessoryModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="accessoryModalTitle">إضافة إكسسوار</h3>
                    <button onclick="closeAccessoryModal()" class="btn-close">&times;</button>
                </div>
                <form id="accessoryForm" onsubmit="saveAccessory(event)">
                    <input type="hidden" id="accessoryId">
                    
                    <div class="form-group">
                        <label for="accessoryName">الاسم *</label>
                        <input type="text" id="accessoryName" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="accessoryType">النوع *</label>
                        <select id="accessoryType" required onchange="handleAccessoryTypeChange(this)">
                            ${accessoryTypes.map(type => `
                                <option value="${type.id}">${type.name}</option>
                            `).join('')}
                        </select>
                        <input type="text" id="accessoryTypeCustom" style="display: none; margin-top: 10px;" placeholder="أدخل النوع يدوياً">
                    </div>
                    
                    <div class="form-group">
                        <label for="accessoryImage">رابط الصورة</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="accessoryImage" placeholder="أو استخدم زر رفع الصورة" style="flex: 1;">
                            <input type="file" id="accessoryImageFile" accept="image/*" style="display: none;" onchange="handleAccessoryImageUpload(this)">
                            <button type="button" onclick="document.getElementById('accessoryImageFile').click()" class="btn btn-secondary">
                                <i class="bi bi-upload"></i> رفع
                            </button>
                        </div>
                        <div id="accessoryImagePreview" style="margin-top: 10px; display: none;">
                            <img id="accessoryImagePreviewImg" src="" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="accessoryPurchasePrice">سعر التكلفة</label>
                            <input type="number" id="accessoryPurchasePrice" step="0.01" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="accessorySellingPrice">سعر البيع</label>
                            <input type="number" id="accessorySellingPrice" step="0.01" min="0" value="0">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="accessoryQuantity">الكمية المتوفرة</label>
                        <input type="number" id="accessoryQuantity" min="0" value="0">
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" onclick="closeAccessoryModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(accessoryModal);
    }
    
    // نموذج الهواتف
    if (!document.getElementById('phoneModal')) {
        const phoneModal = document.createElement('div');
        phoneModal.id = 'phoneModal';
        phoneModal.className = 'modal';
        phoneModal.innerHTML = `
            <div class="modal-content modal-lg" style="max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3 id="phoneModalTitle">إضافة هاتف</h3>
                    <button onclick="closePhoneModal()" class="btn-close">&times;</button>
                </div>
                <form id="phoneForm" onsubmit="savePhone(event)">
                    <input type="hidden" id="phoneId">
                    
                    <div class="form-group">
                        <label for="phoneImage">رابط الصورة</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="phoneImage" placeholder="أو استخدم زر رفع الصورة" style="flex: 1;">
                            <input type="file" id="phoneImageFile" accept="image/*" style="display: none;" onchange="handlePhoneImageUpload(this)">
                            <button type="button" onclick="document.getElementById('phoneImageFile').click()" class="btn btn-secondary">
                                <i class="bi bi-upload"></i> رفع
                            </button>
                        </div>
                        <div id="phoneImagePreview" style="margin-top: 10px; display: none;">
                            <img id="phoneImagePreviewImg" src="" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border-color);">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneBrand">الماركة *</label>
                            <select id="phoneBrand" required onchange="handlePhoneBrandChange(this)">
                                ${phoneBrands.map(brand => `
                                    <option value="${brand.name}">${brand.name}</option>
                                `).join('')}
                            </select>
                            <input type="text" id="phoneBrandCustom" style="display: none; margin-top: 10px;" placeholder="أدخل الماركة يدوياً">
                        </div>
                        <div class="form-group">
                            <label for="phoneModel">الموديل *</label>
                            <input type="text" id="phoneModel" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneSerialNumber">Serial Number</label>
                        <input type="text" id="phoneSerialNumber">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneTaxStatus">حالة الضريبة</label>
                            <select id="phoneTaxStatus" onchange="toggleTaxAmount()">
                                <option value="exempt">معفي</option>
                                <option value="due">مستحق</option>
                            </select>
                        </div>
                        <div class="form-group" id="taxAmountGroup" style="display: none;">
                            <label for="phoneTaxAmount">مبلغ الضريبة</label>
                            <input type="number" id="phoneTaxAmount" step="0.01" min="0" value="0">
                        </div>
                    </div>
                    
                    <h4 style="margin-top: 20px; margin-bottom: 15px;">الإمكانيات</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneStorage">المساحة</label>
                            <input type="text" id="phoneStorage" placeholder="مثال: 128GB">
                        </div>
                        <div class="form-group">
                            <label for="phoneRam">الرام</label>
                            <input type="text" id="phoneRam" placeholder="مثال: 6GB">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneScreenType">نوع الشاشة</label>
                            <input type="text" id="phoneScreenType" placeholder="مثال: AMOLED">
                        </div>
                        <div class="form-group">
                            <label for="phoneProcessor">المعالج</label>
                            <input type="text" id="phoneProcessor" placeholder="مثال: Snapdragon 888">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneBattery">البطارية</label>
                        <input type="text" id="phoneBattery" placeholder="مثال: 5000mAh">
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneAccessories">ملحقات الجهاز</label>
                        <textarea id="phoneAccessories" rows="3" placeholder="وصف الملحقات..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="phonePassword">كلمة مرور الجهاز</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="password" id="phonePassword" style="flex: 1;">
                            <button type="button" onclick="togglePhonePassword()" class="btn btn-secondary">
                                <i class="bi bi-eye" id="phonePasswordIcon"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneMaintenanceHistory">سجل الصيانة</label>
                        <textarea id="phoneMaintenanceHistory" rows="3" placeholder="تاريخ الصيانات..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="phoneDefects">عيوب (إن وجدت)</label>
                        <textarea id="phoneDefects" rows="3" placeholder="وصف العيوب..."></textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phonePurchasePrice">سعر التكلفة</label>
                            <input type="number" id="phonePurchasePrice" step="0.01" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="phoneSellingPrice">سعر البيع</label>
                            <input type="number" id="phoneSellingPrice" step="0.01" min="0" value="0">
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" onclick="closePhoneModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(phoneModal);
    }
}

// دوال قطع الغيار
function addSparePartItem() {
    const container = document.getElementById('sparePartItems');
    const itemId = 'item_' + Date.now();
    const itemRow = document.createElement('div');
    itemRow.className = 'spare-part-item-row';
    itemRow.dataset.itemId = itemId;
    itemRow.innerHTML = `
        <select class="spare-part-item-type" onchange="handleSparePartItemTypeChange(this)">
            ${sparePartTypes.map(type => `
                <option value="${type.id}">${type.name}</option>
            `).join('')}
        </select>
        <input type="number" class="spare-part-item-quantity" value="1" min="1" placeholder="الكمية">
        <input type="number" class="spare-part-item-purchase-price" step="0.01" min="0" value="0" placeholder="سعر التكلفة">
        <input type="number" class="spare-part-item-selling-price" step="0.01" min="0" value="0" placeholder="سعر البيع">
        <input type="text" class="spare-part-item-custom" style="display: none; grid-column: 1 / -1;" placeholder="أدخل النوع يدوياً">
        <button onclick="removeSparePartItem(this)" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
    `;
    itemRow.style.cssText = 'display: grid; grid-template-columns: 1.5fr 80px 100px 100px auto; gap: 8px; align-items: center; margin-bottom: 10px; padding: 10px; background: var(--light-bg); border-radius: 6px;';
    container.appendChild(itemRow);
}

function handleSparePartItemTypeChange(select) {
    const row = select.closest('.spare-part-item-row');
    const customInput = row.querySelector('.spare-part-item-custom');
    const type = sparePartTypes.find(t => t.id === select.value);
    
    // إذا كان النوع "أخرى" أو يحتوي على "other" أو "custom"
    if (select.value === 'other' || select.value.includes('other') || (type && type.isCustom)) {
        customInput.style.display = 'block';
        customInput.style.gridColumn = '1 / -1';
        customInput.required = true;
        customInput.placeholder = 'أدخل النوع يدوياً';
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

function removeSparePartItem(button) {
    button.closest('.spare-part-item-row').remove();
}

function closeSparePartModal() {
    document.getElementById('sparePartModal').style.display = 'none';
}

async function saveSparePart(event) {
    event.preventDefault();
    
    const id = document.getElementById('sparePartId').value;
    let brand = document.getElementById('sparePartBrand').value;
    const customBrand = document.getElementById('sparePartBrandCustom').value.trim();
    
    // إذا كانت الماركة "أخرى" واستخدم المستخدم حقل الإدخال
    if ((brand === 'أخرى' || brand.toLowerCase() === 'other') && customBrand) {
        brand = customBrand;
    }
    
    const model = document.getElementById('sparePartModel').value.trim();
    let barcode = document.getElementById('sparePartBarcode').value.trim();
    let image = document.getElementById('sparePartImage').value.trim();
    
    // معالجة رفع الصورة
    const imageFile = document.getElementById('sparePartImageFile').files[0];
    if (imageFile) {
        try {
            const compressedImage = await compressImage(imageFile);
            image = compressedImage;
        } catch (error) {
            console.error('خطأ في ضغط الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'warning');
        }
    }
    
    if (!brand || !model) {
        showMessage('الماركة والموديل مطلوبان', 'error');
        return;
    }
    
    // إنشاء باركود تلقائياً إذا لم يكن موجوداً
    if (!barcode) {
        barcode = `${brand}-${model}-${Date.now()}`;
    }
    
    // جمع القطع
    const items = [];
    document.querySelectorAll('.spare-part-item-row').forEach(row => {
        let itemType = row.querySelector('.spare-part-item-type').value;
        const quantity = parseInt(row.querySelector('.spare-part-item-quantity').value) || 1;
        const purchasePrice = parseFloat(row.querySelector('.spare-part-item-purchase-price').value) || 0;
        const sellingPrice = parseFloat(row.querySelector('.spare-part-item-selling-price').value) || 0;
        const customInput = row.querySelector('.spare-part-item-custom');
        const customValue = customInput && customInput.style.display !== 'none' ? customInput.value.trim() : '';
        
        // إذا كان النوع "أخرى" واستخدم المستخدم حقل الإدخال، استخدم القيمة المدخلة كنوع
        if (itemType === 'other' && customValue) {
            itemType = customValue; // استخدام القيمة المدخلة كنوع
        }
        
        if (itemType) {
            const itemData = {
                item_type: itemType,
                quantity: quantity,
                purchase_price: purchasePrice,
                selling_price: sellingPrice,
                custom_value: customValue
            };
            
            // الحفاظ على id إذا كان موجوداً (وليس id مؤقت)
            const itemId = row.dataset.itemId;
            if (itemId && !itemId.startsWith('item_')) {
                // id حقيقي من قاعدة البيانات
                itemData.id = itemId;
            }
            // إذا كان id مؤقتاً (يبدأ بـ item_)، لن نرسله - سينشئ الـ API id جديد
            
            items.push(itemData);
        }
    });
    
    const partData = {
        brand,
        model,
        barcode,
        image,
        items
    };
    
    // التأكد من عدم وجود حقل price القديم
    delete partData.price;
    
    let result;
    if (id) {
        partData.id = id;
        result = await API.updateSparePart(partData);
    } else {
        result = await API.addSparePart(partData);
    }
    
    if (result.success) {
        showMessage(result.message);
        closeSparePartModal();
        loadSpareParts();
    } else {
        showMessage(result.message, 'error');
    }
}

// دوال الإكسسوارات
function showAddAccessoryModal() {
    document.getElementById('accessoryModalTitle').textContent = 'إضافة إكسسوار';
    document.getElementById('accessoryForm').reset();
    document.getElementById('accessoryId').value = '';
    document.getElementById('accessoryImagePreview').style.display = 'none';
    document.getElementById('accessoryImageFile').value = '';
    document.getElementById('accessoryModal').style.display = 'flex';
}

function editAccessory(id) {
    const accessory = allAccessories.find(a => a.id === id);
    if (!accessory) return;
    
    document.getElementById('accessoryModalTitle').textContent = 'تعديل إكسسوار';
    document.getElementById('accessoryId').value = accessory.id;
    document.getElementById('accessoryName').value = accessory.name;
    
    // التحقق إذا كان النوع موجوداً في القائمة
    const typeExists = accessoryTypes.find(t => t.id === accessory.type);
    if (typeExists) {
        document.getElementById('accessoryType').value = accessory.type;
        document.getElementById('accessoryTypeCustom').style.display = 'none';
    } else {
        document.getElementById('accessoryType').value = 'other';
        document.getElementById('accessoryTypeCustom').value = accessory.type;
        document.getElementById('accessoryTypeCustom').style.display = 'block';
    }
    
    document.getElementById('accessoryImage').value = accessory.image || '';
    document.getElementById('accessoryPurchasePrice').value = accessory.purchase_price || 0;
    document.getElementById('accessorySellingPrice').value = accessory.selling_price || 0;
    document.getElementById('accessoryQuantity').value = accessory.quantity || 0;
    
    // عرض معاينة الصورة
    if (accessory.image) {
        const preview = document.getElementById('accessoryImagePreview');
        const previewImg = document.getElementById('accessoryImagePreviewImg');
        previewImg.src = accessory.image;
        preview.style.display = 'block';
    } else {
        document.getElementById('accessoryImagePreview').style.display = 'none';
    }
    
    document.getElementById('accessoryModal').style.display = 'flex';
}

function closeAccessoryModal() {
    document.getElementById('accessoryModal').style.display = 'none';
}

function handleAccessoryTypeChange(select) {
    const customInput = document.getElementById('accessoryTypeCustom');
    if (select.value === 'other') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

function handlePhoneBrandChange(select) {
    const customInput = document.getElementById('phoneBrandCustom');
    if (select.value === 'أخرى' || select.value.toLowerCase() === 'other') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

function handleSparePartBrandChange(select) {
    const customInput = document.getElementById('sparePartBrandCustom');
    if (select.value === 'أخرى' || select.value.toLowerCase() === 'other') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

async function saveAccessory(event) {
    event.preventDefault();
    
    const id = document.getElementById('accessoryId').value;
    const name = document.getElementById('accessoryName').value.trim();
    let type = document.getElementById('accessoryType').value;
    const customType = document.getElementById('accessoryTypeCustom').value.trim();
    
    // إذا كان النوع "أخرى" واستخدم المستخدم حقل الإدخال
    if (type === 'other' && customType) {
        type = customType;
    }
    
    let image = document.getElementById('accessoryImage').value.trim();
    const purchase_price = parseFloat(document.getElementById('accessoryPurchasePrice').value) || 0;
    const selling_price = parseFloat(document.getElementById('accessorySellingPrice').value) || 0;
    const quantity = parseInt(document.getElementById('accessoryQuantity').value) || 0;
    
    // معالجة رفع الصورة
    const imageFile = document.getElementById('accessoryImageFile').files[0];
    if (imageFile) {
        try {
            const compressedImage = await compressImage(imageFile);
            image = compressedImage;
        } catch (error) {
            console.error('خطأ في ضغط الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'warning');
        }
    }
    
    if (!name || !type) {
        showMessage('الاسم والنوع مطلوبان', 'error');
        return;
    }
    
    const accessoryData = {
        name,
        type,
        image,
        purchase_price,
        selling_price,
        quantity
    };
    
    let result;
    if (id) {
        accessoryData.id = id;
        result = await API.updateAccessory(accessoryData);
    } else {
        result = await API.addAccessory(accessoryData);
    }
    
    if (result.success) {
        showMessage(result.message);
        closeAccessoryModal();
        loadAccessories();
    } else {
        showMessage(result.message, 'error');
    }
}

// دوال الهواتف
function showAddPhoneModal() {
    document.getElementById('phoneModalTitle').textContent = 'إضافة هاتف';
    document.getElementById('phoneForm').reset();
    document.getElementById('phoneId').value = '';
    document.getElementById('phoneTaxStatus').value = 'exempt';
    document.getElementById('phoneBrandCustom').style.display = 'none';
    document.getElementById('phoneImagePreview').style.display = 'none';
    document.getElementById('phoneImageFile').value = '';
    toggleTaxAmount();
    document.getElementById('phoneModal').style.display = 'flex';
}

function editPhone(id) {
    const phone = allPhones.find(p => p.id === id);
    if (!phone) return;
    
    document.getElementById('phoneModalTitle').textContent = 'تعديل هاتف';
    document.getElementById('phoneId').value = phone.id;
    
    // التحقق إذا كانت الماركة موجودة في القائمة
    const brandExists = phoneBrands.find(b => b.name === phone.brand);
    if (brandExists) {
        document.getElementById('phoneBrand').value = phone.brand;
        document.getElementById('phoneBrandCustom').style.display = 'none';
    } else {
        document.getElementById('phoneBrand').value = 'أخرى';
        document.getElementById('phoneBrandCustom').value = phone.brand;
        document.getElementById('phoneBrandCustom').style.display = 'block';
    }
    
    document.getElementById('phoneModel').value = phone.model;
    document.getElementById('phoneSerialNumber').value = phone.serial_number || '';
    document.getElementById('phoneImage').value = phone.image || '';
    document.getElementById('phoneTaxStatus').value = phone.tax_status || 'exempt';
    document.getElementById('phoneTaxAmount').value = phone.tax_amount || 0;
    document.getElementById('phoneStorage').value = phone.storage || '';
    document.getElementById('phoneRam').value = phone.ram || '';
    document.getElementById('phoneScreenType').value = phone.screen_type || '';
    document.getElementById('phoneProcessor').value = phone.processor || '';
    document.getElementById('phoneBattery').value = phone.battery || '';
    document.getElementById('phoneAccessories').value = phone.accessories || '';
    document.getElementById('phonePassword').value = phone.password || '';
    document.getElementById('phoneMaintenanceHistory').value = phone.maintenance_history || '';
    document.getElementById('phoneDefects').value = phone.defects || '';
    document.getElementById('phonePurchasePrice').value = phone.purchase_price || 0;
    document.getElementById('phoneSellingPrice').value = phone.selling_price || 0;
    
    // عرض معاينة الصورة
    if (phone.image) {
        const preview = document.getElementById('phoneImagePreview');
        const previewImg = document.getElementById('phoneImagePreviewImg');
        previewImg.src = phone.image;
        preview.style.display = 'block';
    } else {
        document.getElementById('phoneImagePreview').style.display = 'none';
    }
    
    toggleTaxAmount();
    document.getElementById('phoneModal').style.display = 'flex';
}

function toggleTaxAmount() {
    const taxStatus = document.getElementById('phoneTaxStatus').value;
    const taxAmountGroup = document.getElementById('taxAmountGroup');
    if (taxStatus === 'due') {
        taxAmountGroup.style.display = 'block';
    } else {
        taxAmountGroup.style.display = 'none';
    }
}

function togglePhonePassword() {
    const passwordInput = document.getElementById('phonePassword');
    const passwordIcon = document.getElementById('phonePasswordIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordIcon.classList.remove('bi-eye');
        passwordIcon.classList.add('bi-eye-slash');
    } else {
        passwordInput.type = 'password';
        passwordIcon.classList.remove('bi-eye-slash');
        passwordIcon.classList.add('bi-eye');
    }
}

function closePhoneModal() {
    document.getElementById('phoneModal').style.display = 'none';
}

async function savePhone(event) {
    event.preventDefault();
    
    const id = document.getElementById('phoneId').value;
    let brand = document.getElementById('phoneBrand').value;
    const customBrand = document.getElementById('phoneBrandCustom').value.trim();
    
    // إذا كانت الماركة "أخرى" واستخدم المستخدم حقل الإدخال
    if ((brand === 'أخرى' || brand.toLowerCase() === 'other') && customBrand) {
        brand = customBrand;
    }
    
    const model = document.getElementById('phoneModel').value.trim();
    const serial_number = document.getElementById('phoneSerialNumber').value.trim();
    let image = document.getElementById('phoneImage').value.trim();
    const tax_status = document.getElementById('phoneTaxStatus').value;
    const tax_amount = parseFloat(document.getElementById('phoneTaxAmount').value) || 0;
    const storage = document.getElementById('phoneStorage').value.trim();
    const ram = document.getElementById('phoneRam').value.trim();
    const screen_type = document.getElementById('phoneScreenType').value.trim();
    const processor = document.getElementById('phoneProcessor').value.trim();
    const battery = document.getElementById('phoneBattery').value.trim();
    const accessories = document.getElementById('phoneAccessories').value.trim();
    const password = document.getElementById('phonePassword').value.trim();
    const maintenance_history = document.getElementById('phoneMaintenanceHistory').value.trim();
    const defects = document.getElementById('phoneDefects').value.trim();
    const purchase_price = parseFloat(document.getElementById('phonePurchasePrice').value) || 0;
    const selling_price = parseFloat(document.getElementById('phoneSellingPrice').value) || 0;
    
    if (!brand || !model) {
        showMessage('الماركة والموديل مطلوبان', 'error');
        return;
    }
    
    // معالجة رفع الصورة
    const imageFile = document.getElementById('phoneImageFile').files[0];
    if (imageFile) {
        try {
            const compressedImage = await compressImage(imageFile);
            image = compressedImage;
        } catch (error) {
            console.error('خطأ في ضغط الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'warning');
        }
    }
    
    const phoneData = {
        brand,
        model,
        serial_number,
        image,
        tax_status,
        tax_amount,
        storage,
        ram,
        screen_type,
        processor,
        battery,
        accessories,
        password,
        maintenance_history,
        defects,
        purchase_price,
        selling_price
    };
    
    let result;
    if (id) {
        phoneData.id = id;
        result = await API.updatePhone(phoneData);
    } else {
        result = await API.addPhone(phoneData);
    }
    
    if (result.success) {
        showMessage(result.message);
        closePhoneModal();
        loadPhones();
    } else {
        showMessage(result.message, 'error');
    }
}

// دوال رفع الصور
async function handleSparePartImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        try {
            const compressedImage = await compressImage(file);
            document.getElementById('sparePartImage').value = compressedImage;
            
            // عرض المعاينة
            const preview = document.getElementById('sparePartImagePreview');
            const previewImg = document.getElementById('sparePartImagePreviewImg');
            previewImg.src = compressedImage;
            preview.style.display = 'block';
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'error');
        }
    }
}

async function handleAccessoryImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        try {
            const compressedImage = await compressImage(file);
            document.getElementById('accessoryImage').value = compressedImage;
            
            // عرض المعاينة
            const preview = document.getElementById('accessoryImagePreview');
            const previewImg = document.getElementById('accessoryImagePreviewImg');
            previewImg.src = compressedImage;
            preview.style.display = 'block';
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'error');
        }
    }
}

async function handlePhoneImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        try {
            const compressedImage = await compressImage(file);
            document.getElementById('phoneImage').value = compressedImage;
            
            // عرض المعاينة
            const preview = document.getElementById('phoneImagePreview');
            const previewImg = document.getElementById('phoneImagePreviewImg');
            previewImg.src = compressedImage;
            preview.style.display = 'block';
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'error');
        }
    }
}

// دالة معالجة أخطاء تحميل صور الهواتف
function handlePhoneImageError(imgElement, phoneId) {
    try {
        if (!imgElement || !imgElement.parentElement) return;
        
        const imageContainer = imgElement.parentElement;
        
        // إخفاء الصورة
        imgElement.style.display = 'none';
        
        // التحقق من عدم وجود placeholder بالفعل
        if (imageContainer.querySelector('.bi-phone')) {
            return;
        }
        
        // إضافة placeholder
        const placeholder = document.createElement('i');
        placeholder.className = 'bi bi-phone';
        placeholder.style.fontSize = '48px';
        placeholder.style.color = 'var(--text-light)';
        placeholder.style.display = 'block';
        placeholder.style.margin = '0 auto';
        
        imageContainer.appendChild(placeholder);
        
        // تسجيل الخطأ للتشخيص
        if (phoneId) {
            console.warn(`فشل تحميل صورة الهاتف: ${phoneId}`);
        }
    } catch (error) {
        console.error('خطأ في معالجة خطأ الصورة:', error);
    }
}

// دالة ضغط الصور (مستعارة من repairs.js)
function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// إنشاء النماذج عند تحميل القسم
function loadInventorySection() {
    // منع الاستدعاءات المتكررة
    if (isLoadingInventorySection) {
        console.log('⏳ تحميل قسم المخزون قيد التنفيذ بالفعل...');
        return;
    }
    
    const section = document.getElementById('inventory-section');
    if (!section) {
        console.error('قسم المخزون غير موجود');
        return;
    }
    
    // التأكد من أن قسم المخزون هو القسم النشط قبل تحميل المحتوى
    const isActive = section.classList.contains('active');
    if (!isActive) {
        console.log('⚠️ قسم المخزون غير نشط، لن يتم تحميل المحتوى');
        return;
    }
    
    isLoadingInventorySection = true;
    console.log('📦 تحميل قسم المخزون...');
    
    // مسح البيانات القديمة
    allSpareParts = [];
    allAccessories = [];
    allPhones = [];
    
    section.innerHTML = `
        <div class="section-header">
            <button onclick="showAddInventoryModal()" class="btn btn-primary" data-permission="manager">
                <i class="bi bi-plus-circle"></i> إضافة
            </button>
        </div>

        <!-- تبويبات الأقسام -->
        <div class="inventory-tabs">
            <div class="inventory-tab active" onclick="switchInventoryTab('spare_parts', this)">
                <i class="bi bi-tools"></i>
                <span>قطع الغيار</span>
            </div>
            <div class="inventory-tab" onclick="switchInventoryTab('accessories', this)">
                <i class="bi bi-headphones"></i>
                <span>الإكسسوارات</span>
            </div>
            <div class="inventory-tab" onclick="switchInventoryTab('phones', this)">
                <i class="bi bi-phone"></i>
                <span>الهواتف</span>
            </div>
        </div>

        <!-- قسم قطع الغيار -->
        <div id="spare-parts-section" class="inventory-section active">
            <div class="filter-buttons" id="sparePartsBrandFilters"></div>
            <div class="inventory-search">
                <input type="text" id="sparePartsSearch" placeholder="بحث بالموديل..." onkeyup="filterSpareParts()">
            </div>
            <div class="inventory-grid" id="sparePartsGrid"></div>
        </div>

        <!-- قسم الإكسسوارات -->
        <div id="accessories-section" class="inventory-section">
            <div class="filter-buttons" id="accessoryFilters"></div>
            <div class="inventory-search">
                <input type="text" id="accessoriesSearch" placeholder="بحث في الإكسسوارات..." onkeyup="filterAccessories()">
            </div>
            <div class="inventory-grid" id="accessoriesGrid"></div>
        </div>

        <!-- قسم الهواتف -->
        <div id="phones-section" class="inventory-section">
            <div class="brand-buttons" id="phoneBrands"></div>
            <div class="inventory-search">
                <input type="text" id="phonesSearch" placeholder="بحث في الهواتف..." onkeyup="filterPhones()">
            </div>
            <div class="inventory-grid" id="phonesGrid"></div>
        </div>
    `;

    // إنشاء النماذج
    createInventoryModals();
    
    // استعادة التبويب المحفوظ
    const savedTab = localStorage.getItem('current_inventory_tab') || 'spare_parts';
    currentInventoryTab = savedTab;
    
    // تحديث التبويبات حسب المحفوظ
    document.querySelectorAll('.inventory-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.inventory-section').forEach(s => s.classList.remove('active'));
    
    const savedTabElement = document.querySelector(`.inventory-tab[onclick*="'${savedTab}'"]`);
    if (savedTabElement) {
        savedTabElement.classList.add('active');
    } else {
        // إذا لم يوجد، نستخدم الأول
        document.querySelector('.inventory-tab').classList.add('active');
    }
    
    const savedSection = document.getElementById(`${savedTab}-section`);
    if (savedSection) {
        savedSection.classList.add('active');
    } else {
        document.getElementById('spare-parts-section').classList.add('active');
    }
    
    // تحميل البيانات - دائماً إعادة تحميل كاملة
    console.log('📥 تحميل بيانات المخزون...');
    
    // تحميل البيانات بعد تأخير لضمان أن DOM جاهز تماماً
    setTimeout(() => {
        // التأكد من أن القسم مرئي قبل تحميل البيانات
        const inventorySection = document.getElementById('inventory-section');
        if (!inventorySection) {
            console.error('❌ قسم المخزون غير موجود');
            isLoadingInventorySection = false;
            return;
        }
        
        // التأكد من أن قسم المخزون هو القسم النشط الوحيد
        const isActive = inventorySection.classList.contains('active');
        if (!isActive) {
            console.log('⚠️ قسم المخزون غير نشط، لن يتم تحميل البيانات');
            isLoadingInventorySection = false;
            return;
        }
        
        // التأكد من إخفاء جميع الأقسام الأخرى
        document.querySelectorAll('.section').forEach(sec => {
            if (sec !== inventorySection) {
                sec.classList.remove('active');
                sec.style.display = 'none';
            }
        });
        
        // تأخير إضافي لضمان أن DOM جاهز تماماً
        setTimeout(() => {
            // تحميل البيانات حسب التبويب المحفوظ
            if (savedTab === 'spare_parts') {
                loadSpareParts();
            } else if (savedTab === 'accessories') {
                loadAccessories();
            } else if (savedTab === 'phones') {
                loadPhones();
            } else {
                // تحميل جميع البيانات
                loadSpareParts();
                loadAccessories();
                loadPhones();
            }
            
            // إنشاء أزرار الفلترة بعد تأخير إضافي لضمان أن DOM جاهز
            setTimeout(() => {
                try {
                    createAccessoryFilters();
                    createPhoneBrands();
                    hideByPermission();
                } catch (error) {
                    console.error('خطأ في إنشاء أزرار الفلترة:', error);
                }
            }, 300);
            
            console.log('✅ تم تحميل قسم المخزون بنجاح');
            isLoadingInventorySection = false;
        }, 200);
    }, 200);
}

// ============================================
// دوال الطباعة
// ============================================

// طباعة باركود للإكسسوار
function printAccessoryBarcode(id) {
    const accessory = allAccessories.find(a => a.id === id);
    if (!accessory) {
        showMessage('الإكسسوار غير موجود', 'error');
        return;
    }
    
    // طلب عدد النسخ
    const copies = prompt('كم عدد النسخ المطلوبة للطباعة؟', '1');
    if (!copies || isNaN(copies) || parseInt(copies) < 1) {
        return;
    }
    
    const numCopies = parseInt(copies);
    
    // إنشاء باركود
    const barcode = accessory.barcode || `${accessory.id}-${accessory.name.replace(/\s+/g, '-')}`;
    let barcodeImage = '';
    try {
        if (typeof BarcodeGenerator !== 'undefined') {
            const barcodeGenerator = new BarcodeGenerator();
            barcodeImage = barcodeGenerator.generateBarcode(barcode, 300, 80);
        } else if (typeof window.barcodeGenerator !== 'undefined') {
            barcodeImage = window.barcodeGenerator.generateBarcode(barcode, 300, 80);
        } else {
            showMessage('خطأ: مكتبة الباركود غير متاحة', 'error');
            return;
        }
    } catch (error) {
        console.error('خطأ في إنشاء الباركود:', error);
        showMessage('حدث خطأ في إنشاء الباركود', 'error');
        return;
    }
    
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank');
    const type = accessoryTypes.find(t => t.id === accessory.type);
    
    // إنشاء محتوى الطباعة
    let printContent = '';
    for (let i = 0; i < numCopies; i++) {
        printContent += `
            <div class="barcode-container" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'}; margin-bottom: 20px;">
                <div class="barcode-header">
                    <h2>${accessory.name}</h2>
                </div>
                <div class="barcode-image">
                    ${barcodeImage ? `<img src="${barcodeImage}" alt="Barcode">` : '<div style="padding: 24px; font-size: 24px; background: #f0f0f0; border-radius: 5px;">باركود</div>'}
                </div>

                <div class="barcode-info">
                    <div class="barcode-info-item">
                        <span class="barcode-info-label">السعر:</span>
                        <span class="barcode-info-value">${formatCurrency(accessory.selling_price || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة باركود - ${accessory.name}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background: #f5f5f5;
                    font-size: 22px; /* كبر حجم الخط الأساسي */
                }
                .barcode-container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    max-width: 480px;
                    margin: 0 auto;
                    text-align: center;
                    font-size: 22px;
                }
                .barcode-header {
                    margin-bottom: 28px;
                    border-bottom: 2px solid #2196F3;
                    padding-bottom: 20px;
                }
                .barcode-header h2 {
                    color: #2196F3;
                    font-size: 34px;
                    margin-bottom: 16px;
                }
                .barcode-header p {
                    color: #666;
                    font-size: 22px;
                }
                .barcode-image {
                    margin: 28px 0;
                    padding: 22px;
                    background: #f9f9f9;
                    border-radius: 10px;
                }
                .barcode-image img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }
                .barcode-code {
                    font-family: 'Courier New', monospace;
                    font-size: 28px;
                    font-weight: bold;
                    color: #333;
                    letter-spacing: 5px;
                    margin-top: 20px;
                    padding: 15px;
                    background: #f0f0f0;
                    border-radius: 5px;
                }
                .barcode-info {
                    margin-top: 28px;
                    padding-top: 28px;
                    border-top: 1px solid #ddd;
                }
                .barcode-info-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 18px 0;
                    font-size: 22px;
                }
                .barcode-info-label {
                    color: #666;
                    font-weight: 600;
                    font-size: 22px;
                }
                .barcode-info-value {
                    color: #2196F3;
                    font-weight: bold;
                    font-size: 26px;
                }
                @media print {
                    body {
                        background: white;
                        padding: 0;
                        font-size: 22px;
                    }
                    .barcode-container {
                        box-shadow: none;
                        border: 1px solid #ddd;
                        font-size: 22px;
                        page-break-inside: avoid;
                        margin-bottom: 10mm;
                    }
                    .no-print {
                        display: none;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <div class="no-print" style="text-align: center; margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="window.print()" style="padding: 10px 20px; background: var(--primary-color, #2196F3); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="window.history.back() || window.close()" style="padding: 10px 20px; background: var(--secondary-color, #64B5F6); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-arrow-right"></i> رجوع
                </button>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// دالة نسخ الباركود
function copyBarcode(barcode) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(barcode).then(() => {
            showMessage('تم نسخ الباركود: ' + barcode, 'success');
        }).catch(err => {
            console.error('خطأ في النسخ:', err);
            fallbackCopyBarcode(barcode);
        });
    } else {
        fallbackCopyBarcode(barcode);
    }
}

// دالة نسخ احتياطية
function fallbackCopyBarcode(barcode) {
    const textArea = document.createElement('textarea');
    textArea.value = barcode;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showMessage('تم نسخ الباركود: ' + barcode, 'success');
    } catch (err) {
        console.error('خطأ في النسخ:', err);
        showMessage('فشل نسخ الباركود', 'error');
    }
    document.body.removeChild(textArea);
}

// دالة طباعة باركود قطع الغيار
function printSparePartBarcode(partId, barcode, barcodeImage) {
    const part = allSpareParts.find(p => p.id === partId);
    if (!part) {
        showMessage('قطعة الغيار غير موجودة', 'error');
        return;
    }
    
    // استخدام الباركود الممرر أو إنشاء واحد جديد
    const actualBarcode = barcode || part.barcode || `${part.brand}-${part.model}-${part.id}`;
    
    // استخدام صورة الباركود الممررة أو إنشاء واحدة جديدة
    let actualBarcodeImage = barcodeImage || '';
    
    if (!actualBarcodeImage) {
        try {
            if (typeof BarcodeGenerator !== 'undefined') {
                const barcodeGenerator = new BarcodeGenerator();
                actualBarcodeImage = barcodeGenerator.generateBarcode(actualBarcode, 200, 60);
            } else if (typeof window.barcodeGenerator !== 'undefined') {
                actualBarcodeImage = window.barcodeGenerator.generateBarcode(actualBarcode, 200, 60);
            } else {
                showMessage('خطأ: مكتبة الباركود غير متاحة', 'error');
                return;
            }
        } catch (error) {
            console.error('خطأ في إنشاء الباركود:', error);
            showMessage('حدث خطأ في إنشاء الباركود', 'error');
            return;
        }
    }
    
    // التحقق من أن صورة الباركود صالحة
    if (!actualBarcodeImage || actualBarcodeImage.trim() === '') {
        console.error('صورة الباركود فارغة');
        showMessage('خطأ: لم يتم إنشاء صورة الباركود', 'error');
        return;
    }
    
    // طلب عدد النسخ
    const copies = prompt('كم عدد النسخ المطلوبة للطباعة؟', '1');
    if (!copies || isNaN(copies) || parseInt(copies) < 1) {
        return;
    }
    
    const numCopies = parseInt(copies);
    
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // إنشاء محتوى الطباعة
    let printContent = '';
    for (let i = 0; i < numCopies; i++) {
        printContent += `
            <div class="barcode-label" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'}; margin-bottom: 10px;">
                <div class="barcode-label-content">
                    <div class="barcode-label-header">
                        <h4>${part.brand}</h4>
                        <p>${part.model}</p>
                    </div>
                    <div class="barcode-label-barcode">
                        <img src="${actualBarcodeImage.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" alt="Barcode ${actualBarcode.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" style="max-width: 100%; height: auto;">
                    </div>
                    <div class="barcode-label-code">
                        ${actualBarcode.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}
                    </div>
                </div>
            </div>
        `;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة باركود - ${part.brand} ${part.model}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 10px;
                    background: white;
                }
                .barcode-label {
                    width: 100%;
                    max-width: 100mm;
                    margin: 0 auto 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    overflow: hidden;
                }
                .barcode-label-content {
                    padding: 8px;
                    text-align: center;
                }
                .barcode-label-header {
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #eee;
                }
                .barcode-label-header h4 {
                    font-size: 12px;
                    margin: 0 0 3px 0;
                    color: #333;
                    font-weight: 600;
                }
                .barcode-label-header p {
                    font-size: 10px;
                    margin: 0;
                    color: #666;
                }
                .barcode-label-barcode {
                    margin-top: 5px;
                }
                .barcode-label-barcode img {
                    max-width: 100%;
                    height: auto;
                    max-height: 40px;
                    display: block;
                    margin: 0 auto;
                }
                .barcode-label-code {
                    margin-top: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 9px;
                    color: #333;
                    letter-spacing: 1px;
                }
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    .barcode-label {
                        page-break-inside: avoid;
                        margin-bottom: 5mm;
                        border: none;
                    }
                    .no-print {
                        display: none;
                    }
                }
                @page {
                    size: auto;
                    margin: 5mm;
                }
            </style>
        </head>
        <body>
            ${printContent}
            <div class="no-print" style="text-align: center; margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="window.print()" style="padding: 10px 20px; background: var(--primary-color, #2196F3); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="window.history.back() || window.close()" style="padding: 10px 20px; background: var(--secondary-color, #64B5F6); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    <i class="bi bi-arrow-right"></i> رجوع
                </button>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// طباعة ملصق احترافي للهاتف
function printPhoneLabel(id) {
    const phone = allPhones.find(p => p.id === id);
    if (!phone) {
        showMessage('الهاتف غير موجود', 'error');
        return;
    }
    
    // إنشاء باركود فريد لكل بطاقة يحمل بيانات الجهاز
    // إنشاء معرف فريد لكل بطاقة (timestamp + random)
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    
    // بناء بيانات الباركود: نوع-ماركة-موديل-المساحة-الرام-سعر-معرف-رقم_فريد
    const barcodeData = {
        type: 'PHONE',
        brand: phone.brand || '',
        model: phone.model || '',
        storage: phone.storage || '',
        ram: phone.ram || '',
        price: phone.selling_price || 0,
        id: phone.id || '',
        serial: phone.serial_number || '',
        unique: uniqueId
    };
    
    // إنشاء نص الباركود بتنسيق قابل للقراءة
    const barcode = `PHONE-${barcodeData.brand}-${barcodeData.model}-${barcodeData.id}-${uniqueId}`;
    
    let barcodeImage = '';
    try {
        if (typeof BarcodeGenerator !== 'undefined') {
            const barcodeGenerator = new BarcodeGenerator();
            barcodeImage = barcodeGenerator.generateBarcode(barcode, 350, 100);
        } else if (typeof window.barcodeGenerator !== 'undefined') {
            barcodeImage = window.barcodeGenerator.generateBarcode(barcode, 350, 100);
        }
    } catch (error) {
        console.error('خطأ في إنشاء الباركود:', error);
    }
    
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ملصق جهاز - ${phone.brand} ${phone.model}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .label-container {
                    background: white;
                    padding: 20px;
                    border: 2px solid #000000;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    max-width: 750px;
                    margin: 0 auto;
                    color: #000000;
                }
                .label-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #000000;
                }
                .label-header h1 {
                    font-size: 28px;
                    margin-bottom: 8px;
                    color: #000000;
                }
                .label-header h2 {
                    font-size: 22px;
                    color: #000000;
                    font-weight: 400;
                }
                .label-barcode {
                    background: white;
                    padding: 15px;
                    border: 1px solid #000000;
                    border-radius: 8px;
                    margin: 15px 0;
                    text-align: center;
                }
                .label-barcode img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto 12px;
                }
                .label-barcode-code {
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    font-weight: bold;
                    color: #333;
                    letter-spacing: 2px;
                    padding: 8px;
                    background: #f0f0f0;
                    border: 1px solid #000000;
                    border-radius: 5px;
                }
                .label-specs {
                    background: white;
                    padding: 15px;
                    border: 1px solid #000000;
                    border-radius: 8px;
                    margin-top: 15px;
                }
                .label-specs h3 {
                    font-size: 18px;
                    margin-bottom: 12px;
                    text-align: center;
                    border-bottom: 2px solid #000000;
                    padding-bottom: 8px;
                    color: #000000;
                }
                .specs-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 12px;
                    margin-top: 12px;
                }
                .spec-item {
                    background: white;
                    padding: 10px;
                    border: 1px solid #000000;
                    border-radius: 5px;
                }
                .spec-label {
                    font-size: 11px;
                    color: #000000;
                    margin-bottom: 4px;
                }
                .spec-value {
                    font-size: 15px;
                    font-weight: bold;
                    color: #000000;
                }
                .label-footer {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 2px solid #000000;
                    text-align: center;
                }
                .label-footer-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    font-size: 16px;
                    color: #000000;
                }
                .label-price {
                    font-size: 22px;
                    font-weight: bold;
                    color: #000000;
                }
                .label-serial {
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    margin-top: 10px;
                }
                @media print {
                    body {
                        background: white;
                        padding: 0;
                    }
                    .label-container {
                        box-shadow: none;
                        border: 2px solid #000000;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="label-container">
                <div class="label-header">
                    <h1>${phone.brand}</h1>
                    <h2>${phone.model}</h2>
                </div>
                
                <div class="label-barcode">
                    ${barcodeImage ? `<img src="${barcodeImage}" alt="Barcode">` : '<div style="padding: 30px; background: #f0f0f0; border-radius: 5px; color: #333;">باركود</div>'}
                </div>
                
                <div class="label-specs">
                    <h3>إمكانيات الجهاز</h3>
                    <div class="specs-grid">
                        ${phone.storage ? `
                            <div class="spec-item">
                                <div class="spec-label">المساحة</div>
                                <div class="spec-value">${phone.storage}</div>
                            </div>
                        ` : ''}
                        ${phone.ram ? `
                            <div class="spec-item">
                                <div class="spec-label">الرام</div>
                                <div class="spec-value">${phone.ram}</div>
                            </div>
                        ` : ''}
                        ${phone.screen_type ? `
                            <div class="spec-item">
                                <div class="spec-label">نوع الشاشة</div>
                                <div class="spec-value">${phone.screen_type}</div>
                            </div>
                        ` : ''}
                        ${phone.processor ? `
                            <div class="spec-item">
                                <div class="spec-label">المعالج</div>
                                <div class="spec-value">${phone.processor}</div>
                            </div>
                        ` : ''}
                        ${phone.battery ? `
                            <div class="spec-item">
                                <div class="spec-label">البطارية</div>
                                <div class="spec-value">${phone.battery}</div>
                            </div>
                        ` : ''}
                        ${phone.tax_status ? `
                            <div class="spec-item">
                                <div class="spec-label">حالة الضريبة</div>
                                <div class="spec-value">${phone.tax_status === 'exempt' ? 'معفي' : 'مستحق'}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="label-footer">
                    <div class="label-footer-item">
                        <span style="font-size: 1.3em;">سعر الجهاز</span>
                        <span class="label-price">${formatCurrency(phone.selling_price || 0)}</span>
                    </div>
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
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// دالة نسخ الباركود
function copyBarcode(barcode) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(barcode).then(() => {
            showMessage('تم نسخ الباركود: ' + barcode, 'success');
        }).catch(err => {
            console.error('خطأ في النسخ:', err);
            fallbackCopyBarcode(barcode);
        });
    } else {
        fallbackCopyBarcode(barcode);
    }
}

// دالة نسخ احتياطية
function fallbackCopyBarcode(barcode) {
    const textArea = document.createElement('textarea');
    textArea.value = barcode;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showMessage('تم نسخ الباركود: ' + barcode, 'success');
    } catch (err) {
        console.error('خطأ في النسخ:', err);
        showMessage('فشل نسخ الباركود', 'error');
    }
    document.body.removeChild(textArea);
}



// إدارة المخزون - الأقسام الثلاثة

let currentInventoryTab = 'spare_parts'; // spare_parts, accessories, phones
let allSpareParts = [];
let allAccessories = [];
let allPhones = [];
let currentSparePartFilter = 'all';
let currentAccessoryFilter = 'all';
let currentPhoneBrand = 'all';

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
    { id: 'samsung', name: 'Samsung', icon: 'bi-phone' },
    { id: 'apple', name: 'Apple', icon: 'bi-apple' },
    { id: 'xiaomi', name: 'Xiaomi', icon: 'bi-phone' },
    { id: 'huawei', name: 'Huawei', icon: 'bi-phone' },
    { id: 'oppo', name: 'Oppo', icon: 'bi-phone' },
    { id: 'vivo', name: 'Vivo', icon: 'bi-phone' },
    { id: 'realme', name: 'Realme', icon: 'bi-phone' },
    { id: 'oneplus', name: 'OnePlus', icon: 'bi-phone' },
    { id: 'other', name: 'أخرى', icon: 'bi-phone' }
];

// تهيئة قسم المخزون

// التبديل بين الأقسام
function switchInventoryTab(tab, element) {
    currentInventoryTab = tab;
    
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
}

// ============================================
// قسم قطع الغيار
// ============================================

async function loadSpareParts() {
    try {
        const result = await API.getSpareParts();
        if (result.success) {
            allSpareParts = result.data || [];
            displaySpareParts(allSpareParts);
        } else {
            console.error('خطأ في تحميل قطع الغيار:', result.message);
            showMessage(result.message || 'خطأ في تحميل قطع الغيار', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل قطع الغيار:', error);
        showMessage('حدث خطأ في تحميل قطع الغيار', 'error');
    }
}

function displaySpareParts(parts) {
    const grid = document.getElementById('sparePartsGrid');
    if (!grid) return;
    
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
                        <p>${part.model}</p>
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
                        <div class="inventory-card-barcode-code">${barcode}</div>
                    </div>
                </div>
                
                <div class="inventory-card-price">
                    <span class="inventory-card-price-label">سعر البيع:</span>
                    <span class="inventory-card-price-value">${formatCurrency(part.selling_price || 0)}</span>
                </div>
                
                <div class="inventory-card-actions">
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
    const filtered = allSpareParts.filter(part => 
        part.brand.toLowerCase().includes(search) ||
        part.model.toLowerCase().includes(search) ||
        (part.barcode && part.barcode.toLowerCase().includes(search))
    );
    displaySpareParts(filtered);
}

function showAddSparePartModal() {
    document.getElementById('sparePartModalTitle').textContent = 'إضافة قطعة غيار';
    document.getElementById('sparePartForm').reset();
    document.getElementById('sparePartId').value = '';
    document.getElementById('sparePartItems').innerHTML = '';
    document.getElementById('sparePartImagePreview').style.display = 'none';
    document.getElementById('sparePartImageFile').value = '';
    document.getElementById('sparePartModal').style.display = 'flex';
}

function editSparePart(id) {
    const part = allSpareParts.find(p => p.id === id);
    if (!part) return;
    
    document.getElementById('sparePartModalTitle').textContent = 'تعديل قطعة غيار';
    document.getElementById('sparePartId').value = part.id;
    document.getElementById('sparePartBrand').value = part.brand;
    document.getElementById('sparePartModel').value = part.model;
    document.getElementById('sparePartBarcode').value = part.barcode || '';
    document.getElementById('sparePartImage').value = part.image || '';
    document.getElementById('sparePartPurchasePrice').value = part.purchase_price || 0;
    document.getElementById('sparePartSellingPrice').value = part.selling_price || 0;
    
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
        const showCustom = type && type.isCustom;
        
        return `
            <div class="spare-part-item-row" data-item-id="${item.id || ''}">
                <select class="spare-part-item-type" onchange="handleSparePartItemTypeChange(this)">
                    ${sparePartTypes.map(t => `
                        <option value="${t.id}" ${item.item_type === t.id ? 'selected' : ''}>${t.name}</option>
                    `).join('')}
                </select>
                <input type="number" class="spare-part-item-quantity" value="${item.quantity || 1}" min="1" placeholder="الكمية">
                <input type="text" class="spare-part-item-custom" value="${item.custom_value || ''}" placeholder="القيمة" style="display: ${showCustom ? 'block' : 'none'};">
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
                        ${item.custom_value ? `<div class="preview-item-custom">${item.custom_value}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--light-bg);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>سعر التكلفة:</span>
                <strong>${formatCurrency(part.purchase_price || 0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>سعر البيع:</span>
                <strong style="color: var(--primary-color);">${formatCurrency(part.selling_price || 0)}</strong>
            </div>
        </div>
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
    try {
        const result = await API.getAccessories();
        if (result.success) {
            allAccessories = result.data || [];
            displayAccessories(allAccessories);
        } else {
            console.error('خطأ في تحميل الإكسسوارات:', result.message);
            showMessage(result.message || 'خطأ في تحميل الإكسسوارات', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل الإكسسوارات:', error);
        showMessage('حدث خطأ في تحميل الإكسسوارات', 'error');
    }
}

function displayAccessories(accessories) {
    const grid = document.getElementById('accessoriesGrid');
    if (!grid) return;
    
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
                        <h3>${accessory.name}</h3>
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
                <div class="brand-button-icon"><i class="bi ${brand.icon}"></i></div>
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
    try {
        const result = await API.getPhones();
        if (result.success) {
            allPhones = result.data || [];
            displayPhones(allPhones);
        } else {
            console.error('خطأ في تحميل الهواتف:', result.message);
            showMessage(result.message || 'خطأ في تحميل الهواتف', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحميل الهواتف:', error);
        showMessage('حدث خطأ في تحميل الهواتف', 'error');
    }
}

function displayPhones(phones) {
    const grid = document.getElementById('phonesGrid');
    if (!grid) return;
    
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
        
        return `
            <div class="inventory-card" onclick="viewPhoneDetails('${phone.id}')" style="cursor: pointer;">
                <div class="inventory-card-header">
                    <div class="inventory-card-title">
                        <h3>${phone.brand}</h3>
                        <p>${phone.model}</p>
                    </div>
                    <div class="inventory-card-icon">
                        <i class="bi ${brand.icon}"></i>
                    </div>
                </div>
                
                <div class="inventory-card-body">
                    ${phone.image ? `
                        <div class="inventory-card-image">
                            <img src="${phone.image}" alt="${phone.brand} ${phone.model}">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-phone" style="font-size: 48px;"></i>
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
    
    modalContent.innerHTML = `
        <div class="preview-modal-header">
            <h3>${phone.brand} ${phone.model}</h3>
            <button onclick="closePhoneDetailsModal()" class="preview-modal-close">&times;</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <div>
                <h4>المعلومات الأساسية</h4>
                <p><strong>Serial Number:</strong> ${phone.serial_number || '-'}</p>
                <p><strong>حالة الضريبة:</strong> ${phone.tax_status === 'exempt' ? 'معفي' : 'مستحق'} ${phone.tax_status === 'due' ? `(${formatCurrency(phone.tax_amount || 0)})` : ''}</p>
            </div>
            
            <div>
                <h4>الإمكانيات</h4>
                <p><strong>المساحة:</strong> ${phone.storage || '-'}</p>
                <p><strong>الرام:</strong> ${phone.ram || '-'}</p>
                <p><strong>نوع الشاشة:</strong> ${phone.screen_type || '-'}</p>
                <p><strong>المعالج:</strong> ${phone.processor || '-'}</p>
                <p><strong>البطارية:</strong> ${phone.battery || '-'}</p>
            </div>
        </div>
        
        ${phone.accessories ? `<div style="margin-top: 20px;"><strong>ملحقات الجهاز:</strong> ${phone.accessories}</div>` : ''}
        ${phone.defects ? `<div style="margin-top: 20px;"><strong>عيوب:</strong> ${phone.defects}</div>` : ''}
        ${phone.maintenance_history ? `<div style="margin-top: 20px;"><strong>سجل الصيانة:</strong> ${phone.maintenance_history}</div>` : ''}
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--light-bg);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>سعر التكلفة:</span>
                <strong>${formatCurrency(phone.purchase_price || 0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>سعر البيع:</span>
                <strong style="color: var(--primary-color);">${formatCurrency(phone.selling_price || 0)}</strong>
            </div>
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
                            <input type="text" id="sparePartBrand" required>
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
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="sparePartPurchasePrice">سعر التكلفة</label>
                            <input type="number" id="sparePartPurchasePrice" step="0.01" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="sparePartSellingPrice">سعر البيع</label>
                            <input type="number" id="sparePartSellingPrice" step="0.01" min="0" value="0">
                        </div>
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
                        <select id="accessoryType" required>
                            ${accessoryTypes.map(type => `
                                <option value="${type.id}">${type.name}</option>
                            `).join('')}
                        </select>
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
                            <select id="phoneBrand" required>
                                ${phoneBrands.map(brand => `
                                    <option value="${brand.name}">${brand.name}</option>
                                `).join('')}
                            </select>
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
        <input type="text" class="spare-part-item-custom" style="display: none;" placeholder="القيمة">
        <button onclick="removeSparePartItem(this)" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
    `;
    container.appendChild(itemRow);
}

function handleSparePartItemTypeChange(select) {
    const row = select.closest('.spare-part-item-row');
    const customInput = row.querySelector('.spare-part-item-custom');
    const type = sparePartTypes.find(t => t.id === select.value);
    
    if (type && type.isCustom) {
        customInput.style.display = 'block';
        customInput.required = true;
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
    const brand = document.getElementById('sparePartBrand').value.trim();
    const model = document.getElementById('sparePartModel').value.trim();
    let barcode = document.getElementById('sparePartBarcode').value.trim();
    let image = document.getElementById('sparePartImage').value.trim();
    const purchase_price = parseFloat(document.getElementById('sparePartPurchasePrice').value) || 0;
    const selling_price = parseFloat(document.getElementById('sparePartSellingPrice').value) || 0;
    
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
        const itemType = row.querySelector('.spare-part-item-type').value;
        const quantity = parseInt(row.querySelector('.spare-part-item-quantity').value) || 1;
        const customInput = row.querySelector('.spare-part-item-custom');
        const customValue = customInput && customInput.style.display !== 'none' ? customInput.value.trim() : '';
        
        if (itemType) {
            items.push({
                item_type: itemType,
                quantity: quantity,
                custom_value: customValue
            });
        }
    });
    
    const partData = {
        brand,
        model,
        barcode,
        image,
        purchase_price,
        selling_price,
        items
    };
    
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
    document.getElementById('accessoryType').value = accessory.type;
    document.getElementById('accessoryImage').value = accessory.image || '';
    document.getElementById('accessoryPurchasePrice').value = accessory.purchase_price || 0;
    document.getElementById('accessorySellingPrice').value = accessory.selling_price || 0;
    
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

async function saveAccessory(event) {
    event.preventDefault();
    
    const id = document.getElementById('accessoryId').value;
    const name = document.getElementById('accessoryName').value.trim();
    const type = document.getElementById('accessoryType').value;
    let image = document.getElementById('accessoryImage').value.trim();
    const purchase_price = parseFloat(document.getElementById('accessoryPurchasePrice').value) || 0;
    const selling_price = parseFloat(document.getElementById('accessorySellingPrice').value) || 0;
    
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
        selling_price
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
    document.getElementById('phoneBrand').value = phone.brand;
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
    const brand = document.getElementById('phoneBrand').value;
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
    const section = document.getElementById('inventory-section');
    section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-box-seam"></i> المخزون</h2>
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
            <div class="inventory-search">
                <input type="text" id="sparePartsSearch" placeholder="بحث في قطع الغيار..." onkeyup="filterSpareParts()">
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
    
    // تحميل البيانات
    loadSpareParts();
    loadAccessories();
    loadPhones();
    
    // إنشاء أزرار الفلترة
    createAccessoryFilters();
    createPhoneBrands();
    
    hideByPermission();
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
    
    // إنشاء باركود
    const barcode = `${accessory.type}-${accessory.id}-${Date.now()}`;
    let barcodeImage = '';
    try {
        if (typeof BarcodeGenerator !== 'undefined') {
            const barcodeGenerator = new BarcodeGenerator();
            barcodeImage = barcodeGenerator.generateBarcode(barcode, 300, 80);
        } else if (typeof window.barcodeGenerator !== 'undefined') {
            barcodeImage = window.barcodeGenerator.generateBarcode(barcode, 300, 80);
        }
    } catch (error) {
        console.error('خطأ في إنشاء الباركود:', error);
    }
    
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank');
    const type = accessoryTypes.find(t => t.id === accessory.type);
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة باركود - ${accessory.name}</title>
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
                .barcode-container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    max-width: 400px;
                    margin: 0 auto;
                    text-align: center;
                }
                .barcode-header {
                    margin-bottom: 20px;
                    border-bottom: 2px solid #2196F3;
                    padding-bottom: 15px;
                }
                .barcode-header h2 {
                    color: #2196F3;
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .barcode-header p {
                    color: #666;
                    font-size: 16px;
                }
                .barcode-image {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 8px;
                }
                .barcode-image img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }
                .barcode-code {
                    font-family: 'Courier New', monospace;
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                    letter-spacing: 3px;
                    margin-top: 15px;
                    padding: 10px;
                    background: #f0f0f0;
                    border-radius: 5px;
                }
                .barcode-info {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }
                .barcode-info-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .barcode-info-label {
                    color: #666;
                    font-weight: 600;
                }
                .barcode-info-value {
                    color: #2196F3;
                    font-weight: bold;
                }
                @media print {
                    body {
                        background: white;
                        padding: 0;
                    }
                    .barcode-container {
                        box-shadow: none;
                        border: 1px solid #ddd;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="barcode-container">
                <div class="barcode-header">
                    <h2>${accessory.name}</h2>
                    <p>${type ? type.name : accessory.type}</p>
                </div>
                <div class="barcode-image">
                    ${barcodeImage ? `<img src="${barcodeImage}" alt="Barcode">` : '<div style="padding: 20px; background: #f0f0f0; border-radius: 5px;">باركود</div>'}
                    <div class="barcode-code">${barcode}</div>
                </div>
                <div class="barcode-info">
                    <div class="barcode-info-item">
                        <span class="barcode-info-label">السعر:</span>
                        <span class="barcode-info-value">${formatCurrency(accessory.selling_price || 0)}</span>
                    </div>
                    <div class="barcode-info-item">
                        <span class="barcode-info-label">التاريخ:</span>
                        <span class="barcode-info-value">${new Date().toLocaleDateString('ar-SA')}</span>
                    </div>
                </div>
            </div>
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

// طباعة ملصق احترافي للهاتف
function printPhoneLabel(id) {
    const phone = allPhones.find(p => p.id === id);
    if (!phone) {
        showMessage('الهاتف غير موجود', 'error');
        return;
    }
    
    // إنشاء باركود مخصص للهاتف
    const barcode = `PHONE-${phone.brand}-${phone.model}-${phone.id}`;
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
                    background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    max-width: 500px;
                    margin: 0 auto;
                    color: white;
                }
                .label-header {
                    text-align: center;
                    margin-bottom: 25px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid rgba(255,255,255,0.3);
                }
                .label-header h1 {
                    font-size: 32px;
                    margin-bottom: 10px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .label-header h2 {
                    font-size: 24px;
                    opacity: 0.9;
                    font-weight: 400;
                }
                .label-barcode {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    text-align: center;
                }
                .label-barcode img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto 15px;
                }
                .label-barcode-code {
                    font-family: 'Courier New', monospace;
                    font-size: 16px;
                    font-weight: bold;
                    color: #333;
                    letter-spacing: 2px;
                    padding: 10px;
                    background: #f0f0f0;
                    border-radius: 5px;
                }
                .label-specs {
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 10px;
                    margin-top: 20px;
                    backdrop-filter: blur(10px);
                }
                .label-specs h3 {
                    font-size: 20px;
                    margin-bottom: 15px;
                    text-align: center;
                    border-bottom: 2px solid rgba(255,255,255,0.3);
                    padding-bottom: 10px;
                }
                .specs-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-top: 15px;
                }
                .spec-item {
                    background: rgba(255,255,255,0.2);
                    padding: 12px;
                    border-radius: 8px;
                    backdrop-filter: blur(5px);
                }
                .spec-label {
                    font-size: 12px;
                    opacity: 0.9;
                    margin-bottom: 5px;
                }
                .spec-value {
                    font-size: 16px;
                    font-weight: bold;
                }
                .label-footer {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 2px solid rgba(255,255,255,0.3);
                    text-align: center;
                }
                .label-footer-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 16px;
                }
                .label-price {
                    font-size: 24px;
                    font-weight: bold;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .label-serial {
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    opacity: 0.9;
                    margin-top: 10px;
                }
                @media print {
                    body {
                        background: white;
                        padding: 0;
                    }
                    .label-container {
                        box-shadow: none;
                        border: 2px solid #2196F3;
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
                    <div class="label-barcode-code">${barcode}</div>
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
                        <span>سعر البيع:</span>
                        <span class="label-price">${formatCurrency(phone.selling_price || 0)}</span>
                    </div>
                    ${phone.serial_number ? `
                        <div class="label-serial">
                            Serial: ${phone.serial_number}
                        </div>
                    ` : ''}
                    <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                        تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} ${new Date().toLocaleTimeString('ar-SA')}
                    </div>
                </div>
            </div>
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


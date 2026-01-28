// إدارة المخزن - الأقسام الثلاثة

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
    { id: 'touch', name: 'تاتش', icon: 'bi-display' },
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

// قائمة أنواع الإكسسوارات الأساسية
const accessoryTypes = [
    { id: 'wired_headphones', name: 'سماعات سلك', icon: 'bi-headphones' },
    { id: 'wireless_headphones', name: 'سماعات وايرلس', icon: 'bi-earbuds' },
    { id: 'earbuds', name: 'إيربودز', icon: 'bi-earbuds' },
    { id: 'chargers', name: 'شواحن', icon: 'bi-lightning-charge' },
    { id: 'cables', name: 'كابلات', icon: 'bi-usb-c' },
    { id: 'power_bank', name: 'باور بانك', icon: 'bi-battery-charging' },
    { id: 'external_battery', name: 'بطارية خارجية', icon: 'bi-battery' },
    { id: 'other', name: 'أخرى', icon: 'bi-box-seam' }
];

// دالة للحصول على جميع أنواع الإكسسوارات (الأساسية + من قاعدة البيانات)
function getAllAccessoryTypes() {
    const baseTypes = [...accessoryTypes];
    
    // إزالة "أخرى" من القائمة الأساسية مؤقتاً لإضافتها في النهاية
    const otherType = baseTypes.find(t => t.id === 'other');
    const baseTypesWithoutOther = baseTypes.filter(t => t.id !== 'other');
    
    // إضافة الأنواع الفريدة من قاعدة البيانات
    if (allAccessories && allAccessories.length > 0) {
        const dbTypes = new Set();
        allAccessories.forEach(accessory => {
            if (accessory.type && accessory.type.trim() !== '') {
                // التحقق من أن النوع ليس من الأنواع الأساسية وليس "أخرى"
                const isBaseType = baseTypesWithoutOther.some(t => t.id === accessory.type);
                if (!isBaseType && accessory.type !== 'other') {
                    dbTypes.add(accessory.type);
                }
            }
        });
        
        // إضافة الأنواع من قاعدة البيانات
        dbTypes.forEach(typeName => {
            baseTypesWithoutOther.push({ id: typeName, name: typeName, icon: 'bi-box-seam', isCustom: true });
        });
    }
    
    // إضافة "أخرى" في النهاية دائماً
    if (otherType) {
        baseTypesWithoutOther.push(otherType);
    }
    
    return baseTypesWithoutOther;
}

// دالة للحصول على جميع أنواع قطع الغيار (الأساسية + المحفوظة + اليدوية من النموذج الحالي)
function getAllSparePartTypes(formContainer) {
    const otherType = sparePartTypes.find(t => t.id === 'other');
    const baseWithoutOther = sparePartTypes.filter(t => t.id !== 'other');
    const customTypeCount = new Map(); // لحساب عدد مرات استخدام كل نوع مخصص

    // من قطع الغيار المحفوظة (allSpareParts)
    if (allSpareParts && allSpareParts.length > 0) {
        allSpareParts.forEach(part => {
            (part.items || []).forEach(item => {
                const t = (item.item_type || '').trim();
                if (!t || t === 'other') return;
                if (baseWithoutOther.some(b => b.id === t)) return;
                
                // حساب عدد مرات استخدام كل نوع
                customTypeCount.set(t, (customTypeCount.get(t) || 0) + 1);
            });
        });
    }

    // من صفوف النموذج الحالي (أخرى + إدخال يدوي)
    if (formContainer) {
        const container = typeof formContainer === 'string' ? document.getElementById(formContainer) : formContainer;
        if (container) {
            container.querySelectorAll('.spare-part-item-row').forEach(row => {
                const sel = row.querySelector('.spare-part-item-type');
                const customInp = row.querySelector('.spare-part-item-custom');
                if (!sel || !customInp) return;
                if (sel.value !== 'other') return;
                if (customInp.style.display === 'none') return;
                const v = (customInp.value || '').trim();
                if (!v || baseWithoutOther.some(b => b.id === v)) return;
                customTypeCount.set(v, (customTypeCount.get(v) || 0) + 1);
            });
        }
    }

    // تصفية الأنواع المخصصة: استبعاد الوصفات المحددة
    const filteredCustomTypes = [];
    customTypeCount.forEach((count, typeName) => {
        // استبعاد الأنواع التي تحتوي على "+" (مثل "بصمة اسود+ازرق")
        if (typeName.includes('+')) return;
        
        // استبعاد الأنواع التي استخدمت مرة واحدة فقط (وصف محدد لقطعة معينة)
        // والاحتفاظ فقط بالأنواع التي استخدمت مرتين أو أكثر (أنواع عامة قابلة لإعادة الاستخدام)
        if (count >= 2) {
            filteredCustomTypes.push(typeName);
        }
    });

    const customList = filteredCustomTypes.map(id => ({ id, name: id, icon: 'bi-box-seam', isCustom: true }));
    return [...baseWithoutOther, ...customList, ...(otherType ? [otherType] : [])];
}

// قائمة الماركات - يتم تحميلها من قاعدة البيانات
let phoneBrands = [];

// دالة لجلب الماركات من قاعدة البيانات
async function loadPhoneBrands() {
    try {
        const result = await API.request('inventory.php?action=brands', 'GET', null, { silent: true });
        
        if (result && result.success && Array.isArray(result.data)) {
            // تحويل البيانات من قاعدة البيانات إلى الصيغة المطلوبة
            phoneBrands = result.data.map(brand => {
                const brandName = brand.name || '';
                return {
                    id: brand.id || brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'unknown',
                    name: brandName,
                    logo: brand.logo || null,
                    icon: 'bi-phone',
                    // حفظ اسم الماركة بحروف صغيرة للمطابقة
                    nameLower: brandName.toLowerCase().trim()
                };
            }).filter(brand => brand.name); // استبعاد الماركات بدون اسم
            
            // إضافة "أخرى" في النهاية إذا لم تكن موجودة
            const hasOther = phoneBrands.some(b => b.name === 'أخرى' || b.name.toLowerCase() === 'other');
            if (!hasOther) {
                phoneBrands.push({
                    id: 'other',
                    name: 'أخرى',
                    icon: 'bi-phone',
                    logo: 'other.svg', // سيتم إضافة /brands/ تلقائياً في createPhoneBrands
                    nameLower: 'other'
                });
            }
            
            // تحديث قائمة الماركات في الواجهة إذا كانت موجودة
            updatePhoneBrandsUI();
        } else {
            // في حالة الفشل، استخدام قائمة احتياطية
            phoneBrands = [
                { id: 'other', name: 'أخرى', icon: 'bi-phone', logo: 'other.svg', nameLower: 'other' } // سيتم إضافة /brands/ تلقائياً
            ];
            console.warn('فشل تحميل الماركات من قاعدة البيانات، استخدام القائمة الاحتياطية');
        }
    } catch (error) {
        console.error('خطأ في تحميل الماركات:', error);
        // في حالة الخطأ، استخدام قائمة احتياطية
        phoneBrands = [
            { id: 'other', name: 'أخرى', icon: 'bi-phone', logo: 'other.svg', nameLower: 'other' } // سيتم إضافة /brands/ تلقائياً
        ];
    }
}

// دالة لتحديث واجهة الماركات بعد تحميلها
function updatePhoneBrandsUI() {
    // تحديث select الماركة في نموذج الهاتف إذا كان موجوداً
    const phoneBrandSelect = document.getElementById('phoneBrand');
    if (phoneBrandSelect) {
        const currentValue = phoneBrandSelect.value;
        phoneBrandSelect.innerHTML = phoneBrands.map(brand => 
            `<option value="${brand.name}">${brand.name}</option>`
        ).join('');
        // استعادة القيمة السابقة إذا كانت موجودة
        if (currentValue) {
            phoneBrandSelect.value = currentValue;
        }
    }
    
    // تحديث select الماركة في نموذج قطع الغيار إذا كان موجوداً
    const sparePartBrandSelect = document.getElementById('sparePartBrand');
    if (sparePartBrandSelect) {
        const currentValue = sparePartBrandSelect.value;
        sparePartBrandSelect.innerHTML = phoneBrands.map(brand => 
            `<option value="${brand.name}">${brand.name}</option>`
        ).join('');
        // استعادة القيمة السابقة إذا كانت موجودة
        if (currentValue) {
            sparePartBrandSelect.value = currentValue;
        }
    }
    
    // تحديث فلتر الماركات إذا كان موجوداً
    createPhoneBrands();
}

// تهيئة قسم المخزن

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

async function loadSpareParts(silent = false, forceRefresh = false) {
    // منع الاستدعاءات المتكررة (ما لم يكن forceRefresh)
    if (isLoadingSpareParts && !forceRefresh) {
        return;
    }
    
    isLoadingSpareParts = true;
    let cachedParts = null;
    try {
        // ✅ محاولة تحميل من Cache أولاً (فقط إذا لم يكن forceRefresh)
        if (!forceRefresh) {
            try {
                if (typeof dbCache !== 'undefined') {
                    cachedParts = await dbCache.loadSpareParts(3600000); // cache صالح لمدة ساعة
                    if (cachedParts && cachedParts.length > 0) {
                        allSpareParts = cachedParts;
                        const grid = document.getElementById('sparePartsGrid');
                        if (grid) {
                            displaySpareParts(allSpareParts);
                            await createSparePartsBrandFilters();
                        }
                    }
                }
            } catch (error) {
                // تجاهل أخطاء Cache
            }
        }
        
        // ✅ تحميل البيانات الجديدة من الخادم (Silent إذا كان هناك cache ولم يكن forceRefresh)
        // إذا كان forceRefresh، نستخدم API.request مباشرة مع skipCache و timestamp
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`inventory.php?type=spare_parts&_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            result = await API.getSpareParts((cachedParts && !forceRefresh) ? true : silent);
        }
        if (result.success) {
            allSpareParts = result.data || [];
            
            // ✅ حفظ في IndexedDB
            try {
                if (typeof dbCache !== 'undefined') {
                    await dbCache.saveSpareParts(allSpareParts);
                }
            } catch (error) {
                // تجاهل أخطاء الحفظ
            }
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('sparePartsGrid');
            if (!grid) {
                setTimeout(async () => {
                    const retryGrid = document.getElementById('sparePartsGrid');
                    if (retryGrid) {
                        displaySpareParts(allSpareParts);
                        await createSparePartsBrandFilters();
                    }
                }, 300);
                return;
            }
            
            displaySpareParts(allSpareParts);
            await createSparePartsBrandFilters();
        } else {
            // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
            if (!cachedParts || forceRefresh) {
                showMessage(result.message || 'خطأ في تحميل قطع الغيار', 'error');
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
        }
    } catch (error) {
        // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
        if (!cachedParts || forceRefresh) {
            showMessage('حدث خطأ في تحميل قطع الغيار', 'error');
            const grid = document.getElementById('sparePartsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">حدث خطأ في تحميل قطع الغيار</div>
                    </div>
                `;
            }
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
        // ✅ استخدام barcode البسيط مباشرة للتوافق مع جميع الماسحات
        const barcode = part.barcode || part.id?.toString() || `${part.brand}-${part.model}-${part.id}`;
        const qrData = barcode;
        
        // استخدام QR Code بدلاً من الباركود
        const qrCodeUrl = generateQRCodeFallback(qrData, 200);
        
        // تحديد دالة عرض التفاصيل حسب الصلاحيات
        const showDetailsFunction = canEditInventory() 
            ? `previewSparePart('${part.id}')` 
            : canRequestInventoryItem()
            ? `previewSparePart('${part.id}')`
            : `showInventoryItemDetails('spare_part', '${part.id}')`;
        
        return `
            <div class="inventory-card" onclick="${showDetailsFunction}" style="cursor: pointer;">
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
                    <div class="inventory-card-qrcode">
                        <img src="${qrCodeUrl}" alt="QR Code" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}';">
                        <div class="inventory-card-qrcode-code">
                            <span>${barcode}</span>
                        </div>
                    </div>
                </div>
                
                <div class="inventory-card-quantity" style="margin-top: 10px; padding: 8px; background: var(--light-bg); border-radius: 6px; text-align: center;">
                    <span style="font-weight: bold; color: var(--text-color);">الكمية المتوفرة: </span>
                    <span style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${(() => {
                        // حساب إجمالي الكمية من القطع الفرعية
                        const totalQuantity = (part.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                        return totalQuantity;
                    })()}</span>
                </div>
                
                <div class="inventory-card-actions">
                    ${canEditInventory() ? `
                        <button onclick="event.stopPropagation(); printSparePartQRCode('${part.id}')" class="btn btn-info btn-sm" title="طباعة QR Code">
                            <i class="bi bi-printer"></i> طباعة
                        </button>
                        <button onclick="event.stopPropagation(); previewSparePart('${part.id}')" class="btn btn-primary btn-sm">
                            <i class="bi bi-eye"></i> معاينة
                        </button>
                        <button onclick="event.stopPropagation(); editSparePart('${part.id}')" class="btn btn-secondary btn-sm" data-permission="manager">
                            <i class="bi bi-pencil"></i> تعديل
                        </button>
                        ${hasPermission('admin') ? `
                            <button onclick="event.stopPropagation(); deleteSparePart('${part.id}')" class="btn btn-danger btn-sm" data-permission="admin">
                                <i class="bi bi-trash"></i> حذف
                            </button>
                        ` : ''}
                    ` : canRequestInventoryItem() ? `
                        <div style="display: flex; gap: 8px; width: 100%;">
                            <button onclick="event.stopPropagation(); requestInventoryItem('spare_part', '${part.id}', '${part.brand} ${part.model}')" class="btn btn-warning btn-sm" title="طلب من الفرع الأول" style="flex: 1;">
                                <i class="bi bi-cart-plus"></i> طلب من الفرع الأول
                            </button>
                            <button onclick="event.stopPropagation(); previewSparePart('${part.id}')" class="btn btn-primary btn-sm" title="معاينة" style="flex: 1;">
                                <i class="bi bi-eye"></i> معاينة
                            </button>
                        </div>
                    ` : `
                        <button onclick="event.stopPropagation(); showInventoryItemDetails('spare_part', '${part.id}')" class="btn btn-info btn-sm" title="عرض التفاصيل" style="width: 100%;">
                            <i class="bi bi-info-circle"></i> عرض التفاصيل
                        </button>
                    `}
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

async function createSparePartsBrandFilters() {
    const select = document.getElementById('sparePartsBrandFilter');
    if (!select) return;
    
    // حفظ القيمة الحالية
    const currentValue = select.value;
    
    // ✅ تحميل الماركات من API إذا لم تكن محملة
    if (phoneBrands.length === 0) {
        await loadPhoneBrands();
    }
    
    // ✅ استخدام الماركات من phoneBrands (من API) بدلاً من الاعتماد فقط على allSpareParts
    // جمع الماركات من phoneBrands
    const brandsFromAPI = phoneBrands.map(b => b.name).filter(b => b && b.trim());
    
    // ✅ أيضاً جمع الماركات من allSpareParts (للماركات المخصصة التي قد لا تكون في API)
    const brandsFromParts = [...new Set(allSpareParts.map(part => part.brand).filter(b => b && b.trim()))];
    
    // ✅ دمج الماركات من المصدرين وإزالة التكرار
    const allBrands = [...new Set([...brandsFromAPI, ...brandsFromParts])].sort();
    
    // إضافة خيار "الكل" ثم باقي الماركات
    select.innerHTML = '<option value="all">الكل</option>' +
        allBrands.map(brand => {
            const brandFilter = brand.toLowerCase();
            return `<option value="${brandFilter}">${brand}</option>`;
        }).join('');
    
    // استعادة القيمة السابقة إذا كانت موجودة
    if (currentValue) {
        select.value = currentValue;
    } else {
        select.value = currentSparePartBrandFilter || 'all';
    }
}

function filterSparePartsByBrand(brand, element) {
    currentSparePartBrandFilter = brand;
    
    // تحديث select (إذا كان element هو select نفسه)
    if (element && element.tagName === 'SELECT') {
        element.value = brand;
    } else {
        // إذا تم الاستدعاء من مكان آخر، تحديث select
        const select = document.getElementById('sparePartsBrandFilter');
        if (select) {
            select.value = brand;
        }
    }
    
    filterSpareParts();
}

async function showAddSparePartModal() {
    // التأكد من تحميل الماركات قبل فتح النموذج
    if (phoneBrands.length === 0) {
        await loadPhoneBrands();
        updatePhoneBrandsUI();
    }
    
    document.getElementById('sparePartModalTitle').textContent = 'إضافة قطعة غيار';
    document.getElementById('sparePartForm').reset();
    document.getElementById('sparePartId').value = '';
    document.getElementById('sparePartItems').innerHTML = '';
    document.getElementById('sparePartBrandCustom').style.display = 'none';
    document.getElementById('sparePartModal').style.display = 'flex';
    
    // إضافة event listener لتحديث placeholder حقل السيريال عند تغيير الموديل
    const modelInput = document.getElementById('sparePartModel');
    if (modelInput) {
        // إزالة event listener القديم إن وجد
        const newModelInput = modelInput.cloneNode(true);
        modelInput.parentNode.replaceChild(newModelInput, modelInput);
        
        // إضافة event listener جديد
        newModelInput.addEventListener('input', function() {
            updateSerialPlaceholders(this.value);
        });
    }
}

// دالة لتحديث placeholder حقول السيريال عند تغيير الموديل
function updateSerialPlaceholders(modelValue) {
    document.querySelectorAll('.spare-part-item-serial').forEach(serialInput => {
        if (serialInput.style.display !== 'none') {
            const serialLabel = serialInput.previousElementSibling;
            if (modelValue) {
                if (serialLabel && serialLabel.tagName === 'LABEL') {
                    serialLabel.textContent = `السيريال (الموديل: ${modelValue})`;
                }
                serialInput.setAttribute('data-model', modelValue);
            } else {
                if (serialLabel && serialLabel.tagName === 'LABEL') {
                    serialLabel.textContent = 'السيريال (مرتبط بالموديل)';
                }
                serialInput.removeAttribute('data-model');
            }
        }
    });
}

async function editSparePart(id) {
    // ✅ التحقق من الصلاحيات - فقط للمالك والمدير
    try {
        const user = getCurrentUser();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            showMessage('ليس لديك صلاحية لتعديل قطع الغيار', 'error');
            return;
        }
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        showMessage('خطأ في التحقق من الصلاحيات', 'error');
        return;
    }
    
    // التأكد من تحميل الماركات قبل فتح النموذج
    if (phoneBrands.length === 0) {
        await loadPhoneBrands();
        updatePhoneBrandsUI();
    }
    
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
    
    // تحميل القطع
    loadSparePartItems(part.items || []);
    
    document.getElementById('sparePartModal').style.display = 'flex';
}

function loadSparePartItems(items) {
    const container = document.getElementById('sparePartItems');
    if (!container) return;
    
    // التحقق من صلاحيات المستخدم (فقط المالك والمدير يمكنهم رؤية سعر التكلفة)
    const user = getCurrentUser();
    const canSeePurchasePrice = user && (user.role === 'admin' || user.role === 'manager');
    
    // تحديد grid-template-columns بناءً على الصلاحية
    const gridColumns = canSeePurchasePrice 
        ? '1.5fr 80px 100px 100px auto' 
        : '1.5fr 80px 100px auto';
    
    const allTypes = getAllSparePartTypes(null);
    
    container.innerHTML = items.map(item => {
        const type = allTypes.find(t => t.id === item.item_type);
        const showCustom = type && type.isCustom || item.item_type === 'other';
        const isOther = item.item_type === 'other' || !type;
        const isMotherboard = item.item_type === 'motherboard';
        const modelInput = document.getElementById('sparePartModel');
        const modelValue = modelInput ? modelInput.value : '';
        
        return `
            <div class="spare-part-item-row" data-item-id="${item.id || ''}" style="display: grid; grid-template-columns: ${gridColumns}; gap: 8px; align-items: start; margin-bottom: 10px; padding: 10px; background: var(--light-bg); border-radius: 6px;">
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">نوع القطعة</label>
                    <select class="spare-part-item-type" onchange="handleSparePartItemTypeChange(this)">
                        ${allTypes.map(t => `
                            <option value="${t.id}" ${item.item_type === t.id ? 'selected' : ''}>${t.name}</option>
                        `).join('')}
                        ${isOther && !type ? `<option value="other" selected>${item.item_type || 'أخرى'}</option>` : ''}
                    </select>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">الكمية</label>
                    <input type="number" class="spare-part-item-quantity" value="${item.quantity ?? 0}" min="0">
                </div>
                ${canSeePurchasePrice ? `
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">سعر التكلفة</label>
                    <input type="number" class="spare-part-item-purchase-price" step="1" min="0" value="${item.purchase_price}">
                </div>
                ` : ''}
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">سعر البيع</label>
                    <input type="number" class="spare-part-item-selling-price" step="1" min="0" value="${item.selling_price || item.price}">
                </div>
                <div style="display: flex; flex-direction: column; grid-column: 1 / -2;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500; display: ${showCustom ? 'block' : 'none'};">أدخل النوع يدوياً</label>
                    <input type="text" class="spare-part-item-custom" value="${item.custom_value || (isOther ? item.item_type : '')}" style="display: ${showCustom ? 'block' : 'none'};">
                </div>
                <div style="display: flex; flex-direction: column; grid-column: 1 / -2;">
                    <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500; display: ${isMotherboard ? 'block' : 'none'};">${isMotherboard && modelValue ? `السيريال (الموديل: ${modelValue})` : 'السيريال (مرتبط بالموديل)'}</label>
                    <input type="text" class="spare-part-item-serial" value="${item.serial_number || ''}" style="display: ${isMotherboard ? 'block' : 'none'}; margin-top: ${isMotherboard ? '0' : '0'};" ${isMotherboard ? `data-model="${modelValue}"` : ''}>
                </div>
                <div style="display: flex; align-items: center; height: 100%; padding-top: 20px;">
                    <button onclick="removeSparePartItem(this)" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
                </div>
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                // التحقق من وجود object store قبل الوصول إليه
                if (dbCache.db.objectStoreNames.contains('spare_parts')) {
                    const tx = dbCache.db.transaction('spare_parts', 'readwrite');
                    const store = tx.objectStore('spare_parts');
                    await store.clear();
                    await dbCache.saveMetadata('spare_parts_last_update', 0);
                    console.log('✅ تم مسح cache قطع الغيار');
                } else {
                    console.warn('⚠️ object store spare_parts غير موجود');
                }
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        isLoadingSpareParts = false;
        await loadSpareParts(false, true);
    } else {
        showMessage(result.message, 'error');
    }
}

function previewSparePart(id) {
    const part = allSpareParts.find(p => p.id === id);
    if (!part) return;
    
    // التحقق من صلاحيات المستخدم (فقط المالك يمكنه رؤية سعر التكلفة)
    const user = getCurrentUser();
    const isOwner = user && user.role === 'admin';
    
    const modal = document.getElementById('previewModal');
    const modalContent = document.getElementById('previewModalContent');
    
    modalContent.innerHTML = `
        <div class="preview-modal-header">
            <h3>معاينة: ${part.brand} ${part.model}</h3>
            <button onclick="closePreviewModal()" class="preview-modal-close">&times;</button>
        </div>
        
        <div class="preview-modal-body">
            <div class="preview-items-grid">
                ${(part.items || []).map(item => {
                    const type = sparePartTypes.find(t => t.id === item.item_type);
                    return `
                        <div class="preview-item">
                            <div class="preview-item-icon"><i class="bi ${type ? type.icon : 'bi-circle'}"></i></div>
                            <div class="preview-item-name">${type ? type.name : item.item_type}</div>
                            <div class="preview-item-quantity">الكمية: ${item.quantity ?? 0}</div>
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
                                <div style="font-weight: bold; margin-bottom: 5px;">${itemName} (الكمية: ${item.quantity ?? 0})</div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                                    ${isOwner ? `<span>سعر التكلفة: <strong>${formatCurrency(item.purchase_price || 0)}</strong></span>` : ''}
                                    <span>سعر البيع: <strong style="color: var(--primary-color);">${formatCurrency(item.selling_price || item.price || 0)}</strong></span>
                                </div>
                                ${item.custom_value ? `<div style="margin-top: 5px; font-size: 0.85em; color: #666;">${item.custom_value}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
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
    const select = document.getElementById('accessoryTypeFilter');
    if (!select) return;
    
    // ✅ استخدام getAllAccessoryTypes() للحصول على جميع الأنواع (الأساسية + من قاعدة البيانات)
    const allTypes = getAllAccessoryTypes();
    
    // حفظ القيمة الحالية
    const currentValue = select.value;
    
    // إضافة خيار "الكل" ثم باقي الأنواع
    select.innerHTML = '<option value="all">الكل</option>' +
        allTypes.map(type => {
            return `<option value="${type.id}">${type.name}</option>`;
        }).join('');
    
    // استعادة القيمة السابقة إذا كانت موجودة
    if (currentValue) {
        select.value = currentValue;
    } else {
        select.value = currentAccessoryFilter || 'all';
    }
}

function filterAccessoriesByType(type, element) {
    currentAccessoryFilter = type;
    
    // تحديث select (إذا كان element هو select نفسه)
    if (element && element.tagName === 'SELECT') {
        element.value = type;
    } else {
        // إذا تم الاستدعاء من مكان آخر، تحديث select
        const select = document.getElementById('accessoryTypeFilter');
        if (select) {
            select.value = type;
        }
    }
    
    filterAccessories();
}

async function loadAccessories(silent = false, forceRefresh = false) {
    // منع الاستدعاءات المتكررة (ما لم يكن forceRefresh)
    if (isLoadingAccessories && !forceRefresh) {
        return;
    }
    
    isLoadingAccessories = true;
    let cachedAccessories = null;
    try {
        // ✅ محاولة تحميل من Cache أولاً (فقط إذا لم يكن forceRefresh)
        if (!forceRefresh) {
            try {
                if (typeof dbCache !== 'undefined') {
                    cachedAccessories = await dbCache.loadAccessories(3600000); // cache صالح لمدة ساعة
                    if (cachedAccessories && cachedAccessories.length > 0) {
                        allAccessories = cachedAccessories;
                        const grid = document.getElementById('accessoriesGrid');
                        if (grid) {
                            displayAccessories(allAccessories);
                        }
                    }
                }
            } catch (error) {
                // تجاهل أخطاء Cache
            }
        }
        
        // ✅ تحميل البيانات الجديدة من الخادم (Silent إذا كان هناك cache ولم يكن forceRefresh)
        // إذا كان forceRefresh، نستخدم API.request مباشرة مع skipCache و timestamp
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`inventory.php?type=accessories&_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            result = await API.getAccessories((cachedAccessories && !forceRefresh) ? true : silent);
        }
        if (result.success) {
            allAccessories = result.data || [];
            
            // ✅ حفظ في IndexedDB
            try {
                if (typeof dbCache !== 'undefined') {
                    await dbCache.saveAccessories(allAccessories);
                }
            } catch (error) {
                // تجاهل أخطاء الحفظ
            }
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('accessoriesGrid');
            if (!grid) {
                setTimeout(() => {
                    const retryGrid = document.getElementById('accessoriesGrid');
                    if (retryGrid) {
                        displayAccessories(allAccessories);
                    }
                }, 300);
                return;
            }
            
            displayAccessories(allAccessories);
            
            // ✅ تحديث الفلاتر والقائمة المنسدلة بعد تحميل الإكسسوارات (لإضافة الأنواع الجديدة من قاعدة البيانات)
            if (forceRefresh) {
                updateAccessoryTypeDropdown();
                createAccessoryFilters();
            }
        } else {
            // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
            if (!cachedAccessories || forceRefresh) {
                showMessage(result.message || 'خطأ في تحميل الإكسسوارات', 'error');
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
        }
    } catch (error) {
        // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
        if (!cachedAccessories || forceRefresh) {
            showMessage('حدث خطأ في تحميل الإكسسوارات', 'error');
            const grid = document.getElementById('accessoriesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">حدث خطأ في تحميل الإكسسوارات</div>
                    </div>
                `;
            }
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
        
        // التحقق من صحة رابط الصورة
        const isValidImage = accessory.image && (
            accessory.image.startsWith('data:image/') || 
            accessory.image.startsWith('http://') || 
            accessory.image.startsWith('https://') || 
            accessory.image.startsWith('/')
        );
        
        // تنظيف الصورة من أي أحرف غير صالحة
        const cleanImage = accessory.image ? accessory.image.trim().replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
        const cleanName = (accessory.name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const cleanAccessoryId = (accessory.id || '').replace(/'/g, '&#39;');
        
        return `
            <div class="inventory-card">
                <div class="inventory-card-header">
                    <div class="inventory-card-title">
                        <h2>${cleanName}</h2>
                        <p>${type ? type.name : accessory.type}</p>
                    </div>
                    <div class="inventory-card-icon">
                        <i class="bi ${type ? type.icon : 'bi-box-seam'}"></i>
                    </div>
                </div>
                
                <div class="inventory-card-body">
                    ${isValidImage ? `
                        <div class="inventory-card-image" data-accessory-id="${cleanAccessoryId}">
                            <img src="${cleanImage}" 
                                 alt="${cleanName}" 
                                 loading="lazy" 
                                 decoding="async" 
                                 style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                                 onerror="handleAccessoryImageError(this, '${cleanAccessoryId}');">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-image" style="font-size: 48px; color: var(--text-light);"></i>
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
                    ${canEditInventory() ? `
                        <button onclick="printAccessoryBarcode('${cleanAccessoryId}')" class="btn btn-info btn-sm" title="طباعة QR Code">
                            <i class="bi bi-printer"></i> طباعة QR Code
                        </button>
                        <button onclick="editAccessory('${cleanAccessoryId}')" class="btn btn-secondary btn-sm" data-permission="manager">
                            <i class="bi bi-pencil"></i> تعديل
                        </button>
                        ${hasPermission('admin') ? `
                            <button onclick="deleteAccessory('${cleanAccessoryId}')" class="btn btn-danger btn-sm" data-permission="admin">
                                <i class="bi bi-trash"></i> حذف
                            </button>
                        ` : ''}
                    ` : canRequestInventoryItem() ? `
                        <div style="display: flex; gap: 8px; width: 100%;">
                            <button onclick="requestInventoryItem('accessory', '${cleanAccessoryId}', '${cleanName}')" class="btn btn-warning btn-sm" title="طلب من الفرع الأول" style="flex: 1;">
                                <i class="bi bi-cart-plus"></i> طلب من الفرع الأول
                            </button>
                            <button onclick="showInventoryItemDetails('accessory', '${cleanAccessoryId}')" class="btn btn-primary btn-sm" title="معاينة" style="flex: 1;">
                                <i class="bi bi-eye"></i> معاينة
                            </button>
                        </div>
                    ` : ''}
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
                    const accessoryId = this.closest('.inventory-card-image')?.dataset?.accessoryId;
                    handleAccessoryImageError(this, accessoryId);
                });
            }
        });
    }, 100);
    
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                const tx = dbCache.db.transaction('accessories', 'readwrite');
                const store = tx.objectStore('accessories');
                await store.clear();
                await dbCache.saveMetadata('accessories_last_update', 0);
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        isLoadingAccessories = false;
        await loadAccessories(false, true);
    } else {
        showMessage(result.message, 'error');
    }
}

// ============================================
// قسم الهواتف
// ============================================

function createPhoneBrands() {
    const select = document.getElementById('phoneBrandFilter');
    if (!select) return;
    
    // إذا لم يتم تحميل الماركات بعد، تحميلها أولاً
    if (phoneBrands.length === 0) {
        loadPhoneBrands().then(() => {
            createPhoneBrands(); // إعادة استدعاء الدالة بعد التحميل
        });
        return;
    }
    
    // حفظ القيمة الحالية
    const currentValue = select.value;
    
    // إضافة خيار "الكل" ثم باقي الماركات
    select.innerHTML = '<option value="all">الكل</option>' +
        phoneBrands.map(brand => {
            // استخدام اسم الماركة بحروف صغيرة للفلترة (مطابقة مع filterPhones)
            const brandFilter = brand.name.toLowerCase();
            return `<option value="${brandFilter}">${brand.name}</option>`;
        }).join('');
    
    // استعادة القيمة السابقة إذا كانت موجودة
    if (currentValue) {
        select.value = currentValue;
    } else {
        select.value = currentPhoneBrand || 'all';
    }
}

function filterPhonesByBrand(brand, element) {
    currentPhoneBrand = brand;
    
    // تحديث select (إذا كان element هو select نفسه)
    if (element && element.tagName === 'SELECT') {
        element.value = brand;
    } else {
        // إذا تم الاستدعاء من مكان آخر، تحديث select
        const select = document.getElementById('phoneBrandFilter');
        if (select) {
            select.value = brand;
        }
    }
    
    filterPhones();
}

async function loadPhones(silent = false, forceRefresh = false) {
    // منع الاستدعاءات المتكررة (ما لم يكن forceRefresh)
    if (isLoadingPhones && !forceRefresh) {
        return;
    }
    
    isLoadingPhones = true;
    let cachedPhones = null;
    try {
        // ✅ محاولة تحميل من Cache أولاً (فقط إذا لم يكن forceRefresh)
        if (!forceRefresh) {
            try {
                if (typeof dbCache !== 'undefined') {
                    cachedPhones = await dbCache.loadPhones(3600000); // cache صالح لمدة ساعة
                    if (cachedPhones && cachedPhones.length > 0) {
                        allPhones = cachedPhones;
                        const grid = document.getElementById('phonesGrid');
                        if (grid) {
                            displayPhones(allPhones);
                        }
                    }
                }
            } catch (error) {
                // تجاهل أخطاء Cache
            }
        }
        
        // ✅ تحميل البيانات الجديدة من الخادم (Silent إذا كان هناك cache ولم يكن forceRefresh)
        // إذا كان forceRefresh، نستخدم API.request مباشرة مع skipCache و timestamp
        let result;
        if (forceRefresh) {
            const timestamp = Date.now();
            result = await API.request(`inventory.php?type=phones&_t=${timestamp}`, 'GET', null, { silent: false, skipCache: true });
        } else {
            result = await API.getPhones((cachedPhones && !forceRefresh) ? true : silent);
        }
        if (result.success) {
            allPhones = result.data || [];
            
            // ✅ حفظ في IndexedDB
            try {
                if (typeof dbCache !== 'undefined') {
                    await dbCache.savePhones(allPhones);
                }
            } catch (error) {
                // تجاهل أخطاء الحفظ
            }
            
            // التأكد من وجود العنصر قبل العرض
            const grid = document.getElementById('phonesGrid');
            if (!grid) {
                setTimeout(() => {
                    const retryGrid = document.getElementById('phonesGrid');
                    if (retryGrid) {
                        displayPhones(allPhones);
                    }
                }, 300);
                return;
            }
            
            displayPhones(allPhones);
        } else {
            // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
            if (!cachedPhones || forceRefresh) {
                showMessage(result.message || 'خطأ في تحميل الهواتف', 'error');
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
        }
    } catch (error) {
        // إذا فشل ولم يكن هناك cache، عرض رسالة خطأ
        if (!cachedPhones || forceRefresh) {
            showMessage('حدث خطأ في تحميل الهواتف', 'error');
            const grid = document.getElementById('phonesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="inventory-empty">
                        <div class="inventory-empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="inventory-empty-text">حدث خطأ في تحميل الهواتف</div>
                    </div>
                `;
            }
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
        // البحث عن الماركة بناءً على اسم الماركة (مطابقة أفضل)
        const phoneBrand = (phone.brand || '').trim();
        const phoneBrandLower = phoneBrand.toLowerCase();
        
        // البحث عن الماركة في القائمة
        let brand = phoneBrands.find(b => 
            b.nameLower === phoneBrandLower || 
            b.name.toLowerCase() === phoneBrandLower ||
            b.id === phoneBrandLower.replace(/\s+/g, '_')
        );
        
        // إذا لم تُوجد الماركة، استخدام "أخرى" أو أول ماركة في القائمة
        if (!brand) {
            brand = phoneBrands.find(b => b.name === 'أخرى' || b.name.toLowerCase() === 'other') || 
                    phoneBrands[0] || 
                    { id: 'other', name: 'أخرى', icon: 'bi-phone', logo: 'other.svg', nameLower: 'other' }; // سيتم إضافة /brands/ تلقائياً
        }
        
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
        
        // التحقق من الكمية لتحديد حالة البيع
        const quantity = parseInt(phone.quantity || 0);
        const isSoldOut = quantity === 0;
        
        return `
            <div class="inventory-card ${isSoldOut ? 'phone-sold-out' : ''}" onclick="viewPhoneDetails('${cleanPhoneId}')" style="cursor: pointer; position: relative;">
                ${isSoldOut ? `
                    <div class="phone-sold-out-badge">
                        <span>SOLD OUT</span>
                    </div>
                ` : ''}
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
                                 style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                                 onerror="handlePhoneImageError(this, '${cleanPhoneId}');">
                        </div>
                    ` : `
                        <div class="inventory-card-image">
                            <i class="bi bi-phone" style="font-size: 48px; color: var(--text-light);"></i>
                        </div>
                    `}
                </div>
                
                <div class="inventory-card-quantity" style="margin-top: 10px; padding: 8px; background: var(--light-bg); border-radius: 6px; text-align: center;">
                    <span style="font-weight: bold; color: var(--text-color);">الكمية المتوفرة: </span>
                    <span style="font-size: 1.2em; font-weight: bold; color: ${isSoldOut ? 'var(--danger-color)' : 'var(--primary-color)'};">${quantity}</span>
                </div>
                
                <div class="inventory-card-price">
                    <span class="inventory-card-price-label">سعر البيع:</span>
                    <span class="inventory-card-price-value">${formatCurrency(phone.selling_price || 0)}</span>
                </div>
                
                <div class="inventory-card-actions">
                    ${canEditInventory() ? `
                        ${isSoldOut ? `
                            <button disabled class="btn btn-info btn-sm" style="opacity: 0.5; cursor: not-allowed; pointer-events: none;">
                                <i class="bi bi-printer"></i> طباعة ملصق
                            </button>
                            <button onclick="event.stopPropagation(); viewPhoneDetails('${phone.id}')" class="btn btn-primary btn-sm">
                                <i class="bi bi-eye"></i> التفاصيل
                            </button>
                            <button disabled class="btn btn-secondary btn-sm" style="opacity: 0.5; cursor: not-allowed; pointer-events: none;" data-permission="manager">
                                <i class="bi bi-pencil"></i> تعديل
                            </button>
                            ${hasPermission('admin') ? `
                                <button disabled class="btn btn-danger btn-sm" style="opacity: 0.5; cursor: not-allowed; pointer-events: none;" data-permission="admin">
                                    <i class="bi bi-trash"></i> حذف
                                </button>
                            ` : ''}
                        ` : `
                            <button onclick="event.stopPropagation(); printPhoneLabel('${phone.id}')" class="btn btn-info btn-sm">
                                <i class="bi bi-printer"></i> طباعة ملصق
                            </button>
                            <button onclick="event.stopPropagation(); viewPhoneDetails('${phone.id}')" class="btn btn-primary btn-sm">
                                <i class="bi bi-eye"></i> التفاصيل
                            </button>
                            <button onclick="event.stopPropagation(); editPhone('${phone.id}')" class="btn btn-secondary btn-sm" data-permission="manager">
                                <i class="bi bi-pencil"></i> تعديل
                            </button>
                            ${hasPermission('admin') ? `
                                <button onclick="event.stopPropagation(); deletePhone('${phone.id}')" class="btn btn-danger btn-sm" data-permission="admin">
                                    <i class="bi bi-trash"></i> حذف
                                </button>
                            ` : ''}
                        `}
                    ` : canRequestInventoryItem() ? `
                        ${isSoldOut ? `
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <button disabled class="btn btn-warning btn-sm" title="طلب من الفرع الأول" style="flex: 1; opacity: 0.5; cursor: not-allowed; pointer-events: none;">
                                    <i class="bi bi-cart-plus"></i> طلب من الفرع الأول
                                </button>
                                <button onclick="event.stopPropagation(); viewPhoneDetails('${phone.id}')" class="btn btn-primary btn-sm" title="معاينة" style="flex: 1;">
                                    <i class="bi bi-eye"></i> معاينة
                                </button>
                            </div>
                        ` : `
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <button onclick="event.stopPropagation(); requestInventoryItem('phone', '${phone.id}', '${phone.brand} ${phone.model}')" class="btn btn-warning btn-sm" title="طلب من الفرع الأول" style="flex: 1;">
                                    <i class="bi bi-cart-plus"></i> طلب من الفرع الأول
                                </button>
                                <button onclick="event.stopPropagation(); viewPhoneDetails('${phone.id}')" class="btn btn-primary btn-sm" title="معاينة" style="flex: 1;">
                                    <i class="bi bi-eye"></i> معاينة
                                </button>
                            </div>
                        `}
                    ` : ''}
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

// دالة للتحقق من صلاحيات عرض سعر التكلفة (مالك أو مدير في فرع HANOVIL)
function canSeePurchasePrice() {
    try {
        const user = getCurrentUser();
        if (!user) return false;
        
        // المالك له كامل الصلاحيات
        if (user.role === 'admin' || user.is_owner === true || user.is_owner === 'true') {
            return true;
        }
        
        // المدير في الفرع الأول (HANOVIL) له صلاحية
        if (user.role === 'manager') {
            const branchCode = user.branch_code || localStorage.getItem('branch_code') || '';
            return branchCode === 'HANOVIL';
        }
        
        return false;
    } catch (error) {
        console.error('خطأ في التحقق من صلاحيات عرض سعر التكلفة:', error);
        return false;
    }
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
        
        <div class="phone-details-content">
            ${(() => {
                // التحقق من صحة الصورة
                const isValidImage = phone.image && (
                    phone.image.startsWith('data:image/') || 
                    phone.image.startsWith('http://') || 
                    phone.image.startsWith('https://') || 
                    phone.image.startsWith('/')
                );
                const cleanImage = phone.image ? phone.image.trim().replace(/"/g, '&quot;') : '';
                
                // إصلاح: بناء onerror handler بشكل صحيح لتجنب أخطاء syntax
                const onErrorHandler = `this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<i class=&quot;bi bi-phone&quot; style=&quot;font-size: 64px; color: var(--text-light);&quot;></i>';`;
                return isValidImage ? `
                    <div class="phone-details-image">
                        <img src="${cleanImage}" 
                             alt="${(phone.brand + ' ' + phone.model).replace(/"/g, '&quot;')}" 
                             loading="lazy"
                             decoding="async"
                             onerror="${onErrorHandler}"
                             style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 2px solid var(--border-color); box-shadow: var(--shadow); image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: high-quality; object-fit: contain;">
                    </div>
                ` : '';
            })()}
            
            <div class="phone-details-grid">
                <!-- المعلومات الأساسية -->
                <div class="phone-details-card">
                    <h4 class="phone-details-card-title">
                        <i class="bi bi-info-circle"></i> المعلومات الأساسية
                    </h4>
                    <div class="phone-details-list">
                        <div class="phone-details-item">
                            <strong>رقم التسلسل:</strong>
                            <span class="phone-details-value">${formatSerial(phone.serial_number)}</span>
                        </div>
                        <div class="phone-details-item">
                            <strong>حالة الضريبة:</strong>
                            <span class="phone-details-badge ${phone.tax_status === 'exempt' ? 'badge-success' : 'badge-warning'}">
                                ${phone.tax_status === 'exempt' ? 'معفي' : 'مستحق'}
                            </span>
                        </div>
                        ${phone.tax_status === 'due' && phone.tax_amount ? `
                        <div class="phone-details-item">
                            <strong>مبلغ الضريبة:</strong>
                            <span class="phone-details-value">${formatCurrency(phone.tax_amount)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- الإمكانيات -->
                <div class="phone-details-card">
                    <h4 class="phone-details-card-title">
                        <i class="bi bi-cpu"></i> الإمكانيات
                    </h4>
                    <div class="phone-specs-grid">
                        ${phone.storage ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">المساحة</div>
                                <div class="phone-spec-value">${addUnit(phone.storage, 'GB')}</div>
                            </div>
                        ` : ''}
                        ${phone.ram ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">الرام</div>
                                <div class="phone-spec-value">${addUnit(phone.ram, 'GB')}</div>
                            </div>
                        ` : ''}
                        ${phone.screen_type ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">نوع الشاشة</div>
                                <div class="phone-spec-value">${phone.screen_type.toUpperCase()}</div>
                            </div>
                        ` : ''}
                        ${phone.processor ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">المعالج</div>
                                <div class="phone-spec-value">${phone.processor}</div>
                            </div>
                        ` : ''}
                        ${phone.battery ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">البطارية</div>
                                <div class="phone-spec-value">${addUnit(phone.battery, 'mAh')}</div>
                            </div>
                        ` : ''}
                        ${phone.battery_percent ? `
                            <div class="phone-spec-item">
                                <div class="phone-spec-label">نسبة البطارية</div>
                                <div class="phone-spec-value">${phone.battery_percent}%</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- الأسعار -->
            <div class="phone-prices-card">
                <h4 class="phone-prices-title">
                    <i class="bi bi-currency-exchange"></i> الأسعار
                </h4>
                <div class="phone-prices-grid">
                    ${canSeePurchasePrice() ? `
                        <div class="phone-price-item">
                            <div class="phone-price-label">سعر التكلفة</div>
                            <div class="phone-price-value">${formatCurrency(phone.purchase_price || 0)}</div>
                        </div>
                    ` : ''}
                    <div class="phone-price-item phone-price-item-primary">
                        <div class="phone-price-label">سعر البيع</div>
                        <div class="phone-price-value">${formatCurrency(phone.selling_price || 0)}</div>
                    </div>
                </div>
            </div>
            
            <!-- معلومات إضافية -->
            ${phone.accessories || phone.defects || phone.maintenance_history ? `
                <div class="phone-additional-grid">
                    ${phone.accessories ? `
                        <div class="phone-details-card phone-details-card-success">
                            <h4 class="phone-details-card-title phone-details-card-title-success">
                                <i class="bi bi-box-seam"></i> ملحقات الجهاز
                            </h4>
                            <div class="phone-details-text">${phone.accessories}</div>
                        </div>
                    ` : ''}
                    ${phone.defects ? `
                        <div class="phone-details-card phone-details-card-danger">
                            <h4 class="phone-details-card-title phone-details-card-title-danger">
                                <i class="bi bi-exclamation-triangle"></i> العيوب
                            </h4>
                            <div class="phone-details-text">${phone.defects}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            ${phone.maintenance_history ? `
                <div class="phone-details-card phone-details-card-info">
                    <h4 class="phone-details-card-title phone-details-card-title-info">
                        <i class="bi bi-tools"></i> سجل الصيانة
                    </h4>
                    <div class="phone-details-text">${formatMaintenance(phone.maintenance_history) || phone.maintenance_history}</div>
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                const tx = dbCache.db.transaction('phones', 'readwrite');
                const store = tx.objectStore('phones');
                await store.clear();
                await dbCache.saveMetadata('phones_last_update', 0);
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        isLoadingPhones = false;
        await loadPhones(false, true);
    } else {
        showMessage(result.message, 'error');
    }
}

// ============================================
// النماذج المنبثقة
// ============================================

async function showAddInventoryModal() {
    // ✅ التحقق من الصلاحيات - فقط للمالك والمدير
    try {
        const user = getCurrentUser();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            showMessage('ليس لديك صلاحية لإضافة عناصر المخزن', 'error');
            return;
        }
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        showMessage('خطأ في التحقق من الصلاحيات', 'error');
        return;
    }
    
    if (currentInventoryTab === 'spare_parts') {
        await showAddSparePartModal();
    } else if (currentInventoryTab === 'accessories') {
        showAddAccessoryModal();
    } else if (currentInventoryTab === 'phones') {
        await showAddPhoneModal();
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
                            <input type="text" id="sparePartModel" required oninput="updateSerialPlaceholders(this.value)">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="sparePartBarcode">QR Code / الباركود</label>
                        <input type="text" id="sparePartBarcode" placeholder="سيتم إنشاؤه تلقائياً إذا تركت فارغاً" readonly style="background-color: var(--light-bg); cursor: not-allowed;">
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
        sparePartModal.addEventListener('focusout', function onSparePartCustomBlur(e) {
            if (!e.target.matches('.spare-part-item-custom')) return;
            const row = e.target.closest('.spare-part-item-row');
            if (!row) return;
            const select = row.querySelector('.spare-part-item-type');
            const customInp = e.target;
            if (!select || select.value !== 'other') return;
            const val = (customInp.value || '').trim();
            if (!val) return;
            const opts = [...select.options];
            if (opts.some(o => o.value === val)) {
                select.value = val;
                return;
            }
            const otherOpt = opts.find(o => o.value === 'other');
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            if (otherOpt) select.insertBefore(opt, otherOpt);
            else select.appendChild(opt);
            select.value = val;
        });
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
                        <input type="text" id="accessoryTypeCustom" style="display: none; margin-top: 10px;" placeholder="أدخل النوع يدوياً" class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label for="accessoryImage">رابط الصورة</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="accessoryImage" placeholder="أو استخدم زر رفع الصورة" style="flex: 1;">
                            <input type="file" id="accessoryImageFile" accept="image/*" style="display: none;" onchange="handleAccessoryImageUpload(this)">
                            <input type="file" id="accessoryImageCamera" accept="image/*" capture="environment" style="display: none;" onchange="handleAccessoryImageUpload(this)">
                            <button type="button" onclick="document.getElementById('accessoryImageFile').click()" class="btn btn-secondary">
                                <i class="bi bi-upload"></i> رفع
                            </button>
                            <button type="button" onclick="document.getElementById('accessoryImageCamera').click()" class="btn btn-secondary">
                                <i class="bi bi-camera"></i> كاميرا
                            </button>
                        </div>
                        <div id="accessoryImagePreview" style="margin-top: 10px; display: none; width: 100%; max-width: 400px; background: var(--light-bg); border-radius: 8px; padding: 10px; border: 2px solid var(--border-color);">
                            <img id="accessoryImagePreviewImg" src="" style="width: 100%; height: auto; max-height: 300px; object-fit: contain; object-position: center; border-radius: 6px; display: block;">
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
                            <input type="file" id="phoneImageCamera" accept="image/*" capture="environment" style="display: none;" onchange="handlePhoneImageUpload(this)">
                            <button type="button" onclick="document.getElementById('phoneImageFile').click()" class="btn btn-secondary">
                                <i class="bi bi-upload"></i> رفع
                            </button>
                            <button type="button" onclick="document.getElementById('phoneImageCamera').click()" class="btn btn-secondary">
                                <i class="bi bi-camera"></i> كاميرا
                            </button>
                        </div>
                        <div id="phoneImagePreview" style="margin-top: 10px; display: none; width: 100%; max-width: 400px; background: var(--light-bg); border-radius: 8px; padding: 10px; border: 2px solid var(--border-color);">
                            <img id="phoneImagePreviewImg" src="" style="width: 100%; height: auto; max-height: 300px; object-fit: contain; object-position: center; border-radius: 6px; display: block;">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneBrand">الماركة *</label>
                            <select id="phoneBrand" required onchange="handlePhoneBrandChange(this)">
                                ${phoneBrands.length > 0 ? phoneBrands.map(brand => `
                                    <option value="${brand.name}">${brand.name}</option>
                                `).join('') : '<option value="">جاري التحميل...</option>'}
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
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="phoneBattery">البطارية</label>
                            <input type="text" id="phoneBattery" placeholder="مثال: 5000mAh">
                        </div>
                        <div class="form-group">
                            <label for="phoneBatteryPercent">نسبة البطارية %</label>
                            <input type="number" id="phoneBatteryPercent" min="0" max="100" step="1" placeholder="مثال: 85">
                        </div>
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
    if (!container) return;
    const itemId = 'item_' + Date.now();
    const allTypes = getAllSparePartTypes(container);

    // التحقق من صلاحيات المستخدم (فقط المالك والمدير يمكنهم رؤية سعر التكلفة)
    const user = getCurrentUser();
    const canSeePurchasePrice = user && (user.role === 'admin' || user.role === 'manager');
    
    // تحديد grid-template-columns بناءً على الصلاحية
    const gridColumns = canSeePurchasePrice 
        ? '1.5fr 80px 100px 100px auto' 
        : '1.5fr 80px 100px auto';
    
    const modelInput = document.getElementById('sparePartModel');
    const modelValue = modelInput ? modelInput.value : '';
    
    const itemRow = document.createElement('div');
    itemRow.className = 'spare-part-item-row';
    itemRow.dataset.itemId = itemId;
    itemRow.innerHTML = `
        <div style="display: flex; flex-direction: column;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">نوع القطعة</label>
            <select class="spare-part-item-type" onchange="handleSparePartItemTypeChange(this)">
                ${allTypes.map(type => `
                    <option value="${type.id}">${type.name}</option>
                `).join('')}
            </select>
        </div>
        <div style="display: flex; flex-direction: column;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">الكمية</label>
            <input type="number" class="spare-part-item-quantity" value="1" min="1">
        </div>
        ${canSeePurchasePrice ? `
        <div style="display: flex; flex-direction: column;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">سعر التكلفة</label>
            <input type="number" class="spare-part-item-purchase-price" step="0.01" min="0" value="0">
        </div>
        ` : ''}
        <div style="display: flex; flex-direction: column;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500;">سعر البيع</label>
            <input type="number" class="spare-part-item-selling-price" step="0.01" min="0" value="0">
        </div>
        <div style="display: flex; flex-direction: column; grid-column: 1 / -2;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500; display: none;">أدخل النوع يدوياً</label>
            <input type="text" class="spare-part-item-custom" style="display: none;">
        </div>
        <div style="display: flex; flex-direction: column; grid-column: 1 / -2;">
            <label style="font-size: 0.85em; color: var(--text-color); margin-bottom: 4px; font-weight: 500; display: none;">السيريال (مرتبط بالموديل)</label>
            <input type="text" class="spare-part-item-serial" style="display: none;" data-model="${modelValue}">
        </div>
        <div style="display: flex; align-items: center; height: 100%; padding-top: 20px;">
            <button onclick="removeSparePartItem(this)" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>
        </div>
    `;
    itemRow.style.cssText = `display: grid; grid-template-columns: ${gridColumns}; gap: 8px; align-items: start; margin-bottom: 10px; padding: 10px; background: var(--light-bg); border-radius: 6px;`;
    container.appendChild(itemRow);
}

function handleSparePartItemTypeChange(select) {
    const row = select.closest('.spare-part-item-row');
    const customInput = row.querySelector('.spare-part-item-custom');
    const serialInput = row.querySelector('.spare-part-item-serial');
    const customLabel = customInput ? customInput.previousElementSibling : null;
    const serialLabel = serialInput ? serialInput.previousElementSibling : null;
    const container = document.getElementById('sparePartItems');
    const type = getAllSparePartTypes(container).find(t => t.id === select.value);
    
    // إذا كان النوع "أخرى" أو يحتوي على "other" أو "custom"
    if (select.value === 'other' || select.value.includes('other') || (type && type.isCustom)) {
        if (customInput) {
            customInput.style.display = 'block';
            customInput.style.gridColumn = '1 / -2';
            customInput.required = true;
        }
        if (customLabel) {
            customLabel.style.display = 'block';
        }
    } else {
        if (customInput) {
            customInput.style.display = 'none';
            customInput.required = false;
        }
        if (customLabel) {
            customLabel.style.display = 'none';
        }
    }
    
    // إذا كان النوع "بوردة" (motherboard)، إظهار حقل السيريال وربطه بالموديل
    if (select.value === 'motherboard') {
        if (serialInput) {
            serialInput.style.display = 'block';
            serialInput.style.gridColumn = '1 / -2';
            serialInput.style.marginTop = '0';
        }
        // الحصول على الموديل من النموذج وربطه بالسيريال
        const modelInput = document.getElementById('sparePartModel');
        if (modelInput && modelInput.value) {
            if (serialLabel) {
                serialLabel.textContent = `السيريال (الموديل: ${modelInput.value})`;
            }
            if (serialInput) {
                serialInput.setAttribute('data-model', modelInput.value);
            }
        } else {
            if (serialLabel) {
                serialLabel.textContent = 'السيريال (مرتبط بالموديل)';
            }
        }
        if (serialLabel) {
            serialLabel.style.display = 'block';
        }
        // إضافة event listener للموديل إذا لم يكن موجوداً
        if (modelInput && !modelInput.hasAttribute('data-serial-listener')) {
            modelInput.setAttribute('data-serial-listener', 'true');
            modelInput.addEventListener('input', function() {
                updateSerialPlaceholders(this.value);
            });
        }
    } else {
        if (serialInput) {
            serialInput.style.display = 'none';
            serialInput.required = false;
        }
        if (serialLabel) {
            serialLabel.style.display = 'none';
        }
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
    const image = ''; // لا حاجة للصورة في قطع الغيار
    
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
    
    // التحقق من صلاحيات المستخدم (فقط المالك والمدير يمكنهم رؤية/تعديل سعر التكلفة)
    const user = getCurrentUser();
    const canSeePurchasePrice = user && (user.role === 'admin' || user.role === 'manager');
    
    document.querySelectorAll('.spare-part-item-row').forEach(row => {
        let itemType = row.querySelector('.spare-part-item-type').value;
        const quantityInput = row.querySelector('.spare-part-item-quantity').value;
        const quantity = quantityInput === '' ? 1 : (parseInt(quantityInput) ?? 0);
        
        // قراءة سعر التكلفة فقط إذا كان المستخدم لديه صلاحية رؤيته
        const purchasePriceInput = row.querySelector('.spare-part-item-purchase-price');
        const purchasePrice = canSeePurchasePrice && purchasePriceInput 
            ? parseFloat(purchasePriceInput.value) || 0 
            : 0; // إذا لم يكن المستخدم لديه صلاحية، استخدم 0
        
        const sellingPrice = parseFloat(row.querySelector('.spare-part-item-selling-price').value) || 0;
        const customInput = row.querySelector('.spare-part-item-custom');
        const customValue = customInput && customInput.style.display !== 'none' ? customInput.value.trim() : '';
        
        // قراءة السيريال إذا كان النوع "بوردة"
        const serialInput = row.querySelector('.spare-part-item-serial');
        const serialNumber = (itemType === 'motherboard' && serialInput && serialInput.style.display !== 'none') 
            ? serialInput.value.trim() 
            : '';
        
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
            
            // إضافة السيريال إذا كان موجوداً
            if (serialNumber) {
                itemData.serial_number = serialNumber;
            }
            
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // مسح cache أولاً
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                // التحقق من وجود object store قبل الوصول إليه
                if (dbCache.db.objectStoreNames.contains('spare_parts')) {
                    const tx = dbCache.db.transaction('spare_parts', 'readwrite');
                    const store = tx.objectStore('spare_parts');
                    await store.clear();
                    // مسح metadata أيضاً
                    await dbCache.saveMetadata('spare_parts_last_update', 0);
                    console.log('✅ تم مسح cache قطع الغيار');
                } else {
                    console.warn('⚠️ object store spare_parts غير موجود');
                }
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        isLoadingSpareParts = false;
        
        // تحميل البيانات من الخادم مباشرة (بدون cache)
        await loadSpareParts(false, true);
    } else {
        showMessage(result.message, 'error');
    }
}

// دالة لتحديث dropdown أنواع الإكسسوارات
function updateAccessoryTypeDropdown() {
    const select = document.getElementById('accessoryType');
    if (!select) return;
    
    const allTypes = getAllAccessoryTypes();
    const currentValue = select.value;
    
    select.innerHTML = allTypes.map(type => `
        <option value="${type.id}">${type.name}</option>
    `).join('');
    
    // إعادة تعيين القيمة السابقة إذا كانت موجودة
    if (currentValue && allTypes.some(t => t.id === currentValue)) {
        select.value = currentValue;
    }
}

// دوال الإكسسوارات
function showAddAccessoryModal() {
    document.getElementById('accessoryModalTitle').textContent = 'إضافة إكسسوار';
    document.getElementById('accessoryForm').reset();
    document.getElementById('accessoryId').value = '';
    document.getElementById('accessoryImagePreview').style.display = 'none';
    document.getElementById('accessoryImageFile').value = '';
    const customTypeInput = document.getElementById('accessoryTypeCustom');
    if (customTypeInput) {
        customTypeInput.value = '';
        customTypeInput.style.display = 'none';
        customTypeInput.required = false;
    }
    
    // تحديث dropdown الأنواع (بعد إعادة تعيين النموذج)
    updateAccessoryTypeDropdown();
    
    // التأكد من أن القيمة الافتراضية هي الأولى (ليس "أخرى")
    const typeSelect = document.getElementById('accessoryType');
    if (typeSelect && typeSelect.options.length > 0) {
        typeSelect.value = typeSelect.options[0].value;
    }
    
    document.getElementById('accessoryModal').style.display = 'flex';
}

function editAccessory(id) {
    // ✅ التحقق من الصلاحيات - فقط للمالك والمدير
    try {
        const user = getCurrentUser();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            showMessage('ليس لديك صلاحية لتعديل الإكسسوارات', 'error');
            return;
        }
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        showMessage('خطأ في التحقق من الصلاحيات', 'error');
        return;
    }
    
    const accessory = allAccessories.find(a => a.id === id);
    if (!accessory) return;
    
    document.getElementById('accessoryModalTitle').textContent = 'تعديل إكسسوار';
    document.getElementById('accessoryId').value = accessory.id;
    document.getElementById('accessoryName').value = accessory.name;
    
    // تحديث dropdown الأنواع أولاً
    updateAccessoryTypeDropdown();
    
    // التحقق إذا كان النوع موجوداً في القائمة (بما في ذلك الأنواع المخصصة)
    const allTypes = getAllAccessoryTypes();
    const typeExists = allTypes.find(t => t.id === accessory.type);
    
    // ✅ تسجيل للتشخيص
    console.log('🔍 editAccessory - accessory.type:', accessory.type, 'typeExists:', typeExists, 'allTypes:', allTypes.map(t => t.id));
    
    if (typeExists) {
        // النوع موجود في القائمة - اختياره من القائمة
        document.getElementById('accessoryType').value = accessory.type;
        document.getElementById('accessoryTypeCustom').style.display = 'none';
        document.getElementById('accessoryTypeCustom').required = false;
        document.getElementById('accessoryTypeCustom').value = ''; // مسح الحقل اليدوي
    } else {
        // النوع غير موجود في القائمة - استخدام "أخرى" والحقل اليدوي
        document.getElementById('accessoryType').value = 'other';
        document.getElementById('accessoryTypeCustom').value = accessory.type;
        document.getElementById('accessoryTypeCustom').style.display = 'block';
        document.getElementById('accessoryTypeCustom').required = true;
        console.log('✅ تم تعيين النوع المخصص في الحقل اليدوي:', accessory.type);
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
        // ✅ إضافة lazy loading للصور
        previewImg.loading = 'lazy';
        previewImg.decoding = 'async';
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
    const customTypeInput = document.getElementById('accessoryTypeCustom');
    const customType = customTypeInput ? customTypeInput.value.trim() : '';
    
    // ✅ تسجيل للتشخيص
    console.log('🔍 saveAccessory - id:', id, 'type:', type, 'customType:', customType, 'customTypeInput visible:', customTypeInput?.style.display);
    
    // إذا كان النوع "أخرى"، يجب أن يكون المستخدم قد أدخل نوعاً مخصصاً
    if (type === 'other') {
        if (!customType || customType.trim() === '') {
            showMessage('يرجى إدخال النوع', 'error');
            if (customTypeInput) {
                customTypeInput.focus();
            }
            return;
        }
        type = customType.trim(); // استخدام النوع المخصص وإزالة المسافات الزائدة
        console.log('✅ تم استخدام النوع المخصص:', type);
    } else {
        type = type.trim(); // إزالة المسافات الزائدة للأنواع الأخرى
        console.log('✅ تم استخدام النوع المحدد:', type);
    }
    
    // التأكد من أن النوع غير فارغ
    if (!type || type === '') {
        showMessage('يرجى تحديد النوع', 'error');
        return;
    }
    
    let image = document.getElementById('accessoryImage').value.trim();
    const purchase_price = parseFloat(document.getElementById('accessoryPurchasePrice').value) || 0;
    const selling_price = parseFloat(document.getElementById('accessorySellingPrice').value) || 0;
    const quantity = parseInt(document.getElementById('accessoryQuantity').value) || 0;
    
    // معالجة رفع الصورة
    const imageFile = document.getElementById('accessoryImageFile').files[0];
    if (imageFile) {
        try {
            // اقتصاص الصورة بأبعاد مناسبة للبطاقة (400x300)
            const croppedImage = await cropImageForCard(imageFile, 400, 300, 0.85);
            image = croppedImage;
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            showMessage('حدث خطأ في معالجة الصورة', 'warning');
        }
    }
    
    // التحقق من أن الاسم موجود (تم التحقق من type مسبقاً)
    if (!name || name.trim() === '') {
        showMessage('يرجى إدخال الاسم', 'error');
        return;
    }
    
    const accessoryData = {
        name: name.trim(),
        type: type, // النوع تم تنظيفه مسبقاً
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
    
    if (result && result.success) {
        showMessage(result.message || 'تم الحفظ بنجاح');
        closeAccessoryModal();
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // مسح cache أولاً
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                const tx = dbCache.db.transaction('accessories', 'readwrite');
                const store = tx.objectStore('accessories');
                await store.clear();
                // مسح metadata أيضاً
                await dbCache.saveMetadata('accessories_last_update', 0);
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        isLoadingAccessories = false;
        
        // تحميل البيانات من الخادم مباشرة (بدون cache)
        // دائماً نعيد تحميل البيانات بعد الحفظ
        await loadAccessories(false, true);
        
        // ✅ تحديث القائمة المنسدلة للأنواع بعد إعادة التحميل
        // (allAccessories تم تحديثه داخل loadAccessories)
        updateAccessoryTypeDropdown();
        
        // ✅ تحديث فلاتر الأنواع بعد إعادة التحميل
        createAccessoryFilters();
    } else {
        showMessage(result.message, 'error');
    }
}

// دوال الهواتف
async function showAddPhoneModal() {
    // التأكد من تحميل الماركات قبل فتح النموذج
    if (phoneBrands.length === 0) {
        await loadPhoneBrands();
        updatePhoneBrandsUI();
    }
    
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

async function editPhone(id) {
    // ✅ التحقق من الصلاحيات - فقط للمالك والمدير
    try {
        const user = getCurrentUser();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            showMessage('ليس لديك صلاحية لتعديل الهواتف', 'error');
            return;
        }
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        showMessage('خطأ في التحقق من الصلاحيات', 'error');
        return;
    }
    
    // التأكد من تحميل الماركات قبل فتح النموذج
    if (phoneBrands.length === 0) {
        await loadPhoneBrands();
        updatePhoneBrandsUI();
    }
    
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
    document.getElementById('phoneBatteryPercent').value = phone.battery_percent || '';
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
        // ✅ إضافة lazy loading للصور
        previewImg.loading = 'lazy';
        previewImg.decoding = 'async';
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
    const battery_percent = document.getElementById('phoneBatteryPercent').value.trim() ? parseInt(document.getElementById('phoneBatteryPercent').value) : null;
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
            // اقتصاص الصورة بأبعاد مناسبة للبطاقة (400x300)
            const croppedImage = await cropImageForCard(imageFile, 400, 300, 0.85);
            image = croppedImage;
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
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
        battery_percent,
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // مسح cache أولاً
        try {
            if (typeof dbCache !== 'undefined' && dbCache.db) {
                const tx = dbCache.db.transaction('phones', 'readwrite');
                const store = tx.objectStore('phones');
                await store.clear();
                // مسح metadata أيضاً
                await dbCache.saveMetadata('phones_last_update', 0);
                console.log('✅ تم مسح cache الهواتف');
            }
        } catch (error) {
            console.warn('⚠️ لم يتم مسح cache:', error);
        }
        
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        isLoadingPhones = false;
        
        // تحميل البيانات من الخادم مباشرة (بدون cache)
        await loadPhones(false, true);
    } else {
        showMessage(result.message, 'error');
    }
}

// دوال رفع الصور

async function handleAccessoryImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        try {
            // اقتصاص الصورة بأبعاد مناسبة للبطاقة (400x300)
            const croppedImage = await cropImageForCard(file, 400, 300, 0.85);
            document.getElementById('accessoryImage').value = croppedImage;
            
            // عرض المعاينة
            const preview = document.getElementById('accessoryImagePreview');
            const previewImg = document.getElementById('accessoryImagePreviewImg');
            if (preview && previewImg) {
                previewImg.src = croppedImage;
                previewImg.style.objectFit = 'contain';
                previewImg.style.objectPosition = 'center';
                preview.style.display = 'block';
            }
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
            // اقتصاص الصورة بأبعاد مناسبة للبطاقة (400x300)
            const croppedImage = await cropImageForCard(file, 400, 300, 0.85);
            document.getElementById('phoneImage').value = croppedImage;
            
            // عرض المعاينة
            const preview = document.getElementById('phoneImagePreview');
            const previewImg = document.getElementById('phoneImagePreviewImg');
            if (preview && previewImg) {
                previewImg.src = croppedImage;
                previewImg.style.objectFit = 'contain';
                previewImg.style.objectPosition = 'center';
                preview.style.display = 'block';
            }
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

function handleAccessoryImageError(imgElement, accessoryId) {
    try {
        if (!imgElement || !imgElement.parentElement) return;
        
        const imageContainer = imgElement.parentElement;
        
        // إخفاء الصورة
        imgElement.style.display = 'none';
        
        // التحقق من عدم وجود placeholder بالفعل
        if (imageContainer.querySelector('.bi-image')) {
            return;
        }
        
        // إضافة placeholder
        const placeholder = document.createElement('i');
        placeholder.className = 'bi bi-image';
        placeholder.style.fontSize = '48px';
        placeholder.style.color = 'var(--text-light)';
        placeholder.style.display = 'block';
        placeholder.style.margin = '0 auto';
        
        imageContainer.appendChild(placeholder);
        
        // تسجيل الخطأ للتشخيص
        if (accessoryId) {
            console.warn(`فشل تحميل صورة الإكسسوار: ${accessoryId}`);
        }
    } catch (error) {
        console.error('خطأ في معالجة خطأ صورة الإكسسوار:', error);
    }
}

// دالة قراءة اتجاه EXIF من الصورة
function getImageOrientation(file) {
    return new Promise((resolve) => {
        // التحقق من نوع المدخل - إذا كان data URL، نحوله إلى Blob
        let blobToRead;
        
        if (typeof file === 'string') {
            // إذا كان data URL، نحوله إلى Blob
            try {
                const byteString = atob(file.split(',')[1]);
                const mimeString = file.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                blobToRead = new Blob([ab], { type: mimeString });
            } catch (error) {
                // في حالة الخطأ، نرجع -1 (لا اتجاه)
                resolve(-1);
                return;
            }
        } else if (file instanceof Blob || file instanceof File) {
            // إذا كان File أو Blob، نستخدمه مباشرة
            blobToRead = file;
        } else {
            // نوع غير معروف
            resolve(-1);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const view = new DataView(e.target.result);
                if (view.getUint16(0, false) !== 0xFFD8) {
                    resolve(-1); // ليس صورة JPEG
                    return;
                }
                
                const length = view.byteLength;
                let offset = 2;
                
                while (offset < length) {
                    if (view.getUint16(offset, false) !== 0xFFE1) {
                        offset += 2;
                        continue;
                    }
                    
                    // قراءة طول القطعة (2 bytes بعد 0xFFE1)
                    const segmentLength = view.getUint16(offset + 2, false);
                    
                    // التحقق من وجود "Exif\0\0" (تبدأ بعد 4 bytes من offset)
                    if (offset + 10 >= length) {
                        offset += 2;
                        continue;
                    }
                    
                    const exifString = String.fromCharCode(
                        view.getUint8(offset + 4),
                        view.getUint8(offset + 5),
                        view.getUint8(offset + 6),
                        view.getUint8(offset + 7)
                    );
                    if (exifString !== 'Exif') {
                        offset += 2;
                        continue;
                    }
                    
                    // البحث عن IFD (Image File Directory)
                    // بعد "Exif\0\0" (6 bytes من offset + 4) = offset + 10
                    const tiffOffset = offset + 10;
                    if (view.getUint16(tiffOffset, false) === 0x4949) { // "II" - Intel byte order
                        const isLittleEndian = true;
                        offset = tiffOffset + 4;
                    } else if (view.getUint16(tiffOffset, false) === 0x4D4D) { // "MM" - Motorola byte order
                        const isLittleEndian = false;
                        offset = tiffOffset + 4;
                    } else {
                        resolve(-1);
                        return;
                    }
                    
                    const ifdOffset = view.getUint32(offset, !isLittleEndian);
                    offset = tiffOffset + ifdOffset;
                    
                    const entryCount = view.getUint16(offset, !isLittleEndian);
                    offset += 2;
                    
                    for (let i = 0; i < entryCount; i++) {
                        const tag = view.getUint16(offset + (i * 12), !isLittleEndian);
                        if (tag === 0x0112) { // Orientation tag
                            const orientation = view.getUint16(offset + (i * 12) + 8, !isLittleEndian);
                            resolve(orientation);
                            return;
                        }
                    }
                    
                    resolve(-1);
                    return;
                }
                
                resolve(-1);
            } catch (error) {
                // في حالة أي خطأ، نرجع -1
                resolve(-1);
            }
        };
        reader.onerror = () => resolve(-1);
        
        // قراءة أول 64KB فقط
        const slice = blobToRead.slice(0, 65536);
        if (slice instanceof Blob) {
            reader.readAsArrayBuffer(slice);
        } else {
            resolve(-1);
        }
    });
}

// دالة اقتصاص الصورة لتناسب أبعاد البطاقة
function cropImageForCard(file, targetWidth = 400, targetHeight = 300, quality = 0.85) {
    return new Promise(async (resolve, reject) => {
        try {
            // التحقق من نوع المدخل
            let imageSource;
            let orientation = -1;
            
            if (typeof file === 'string') {
                imageSource = file;
                try {
                    orientation = await getImageOrientation(file);
                } catch (error) {
                    orientation = -1;
                }
            } else if (file instanceof Blob || file instanceof File) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        imageSource = e.target.result;
                        orientation = await getImageOrientation(file);
                        processImage();
                    } catch (error) {
                        console.error('خطأ في قراءة اتجاه EXIF:', error);
                        orientation = -1;
                        processImage();
                    }
                };
                reader.onerror = (error) => {
                    console.error('خطأ في قراءة الملف:', error);
                    reject(new Error('فشل قراءة الملف'));
                };
                reader.readAsDataURL(file);
                return;
            } else {
                reject(new Error('نوع ملف غير مدعوم'));
                return;
            }
            
            function processImage() {
                const img = new Image();
                img.onload = () => {
                    try {
                        // تحديد الأبعاد الفعلية للصورة بعد التدوير
                        const needsRotation = orientation >= 5 && orientation <= 8;
                        let sourceWidth = needsRotation ? img.height : img.width;
                        let sourceHeight = needsRotation ? img.width : img.height;
                        
                        // حساب نسبة الاقتصاص (center crop)
                        const targetRatio = targetWidth / targetHeight;
                        const imageRatio = sourceWidth / sourceHeight;
                        
                        let cropWidth, cropHeight, cropX, cropY;
                        
                        if (imageRatio > targetRatio) {
                            // الصورة أوسع - اقتصاص من الجانبين
                            cropHeight = sourceHeight;
                            cropWidth = cropHeight * targetRatio;
                            cropX = (sourceWidth - cropWidth) / 2;
                            cropY = 0;
                        } else {
                            // الصورة أطول - اقتصاص من الأعلى والأسفل
                            cropWidth = sourceWidth;
                            cropHeight = cropWidth / targetRatio;
                            cropX = 0;
                            cropY = (sourceHeight - cropHeight) / 2;
                        }
                        
                        // إنشاء canvas للصورة بعد التحويلات
                        const rotatedCanvas = document.createElement('canvas');
                        rotatedCanvas.width = sourceWidth;
                        rotatedCanvas.height = sourceHeight;
                        const rotatedCtx = rotatedCanvas.getContext('2d');
                        rotatedCtx.imageSmoothingEnabled = true;
                        rotatedCtx.imageSmoothingQuality = 'high';
                        
                        // تطبيق التحويلات بناءً على اتجاه EXIF
                        rotatedCtx.save();
                        
                        switch (orientation) {
                            case 2:
                                rotatedCtx.translate(sourceWidth, 0);
                                rotatedCtx.scale(-1, 1);
                                break;
                            case 3:
                                rotatedCtx.translate(sourceWidth, sourceHeight);
                                rotatedCtx.rotate(Math.PI);
                                break;
                            case 4:
                                rotatedCtx.translate(0, sourceHeight);
                                rotatedCtx.scale(1, -1);
                                break;
                            case 5:
                                rotatedCtx.translate(sourceWidth, 0);
                                rotatedCtx.rotate(Math.PI / 2);
                                rotatedCtx.scale(-1, 1);
                                break;
                            case 6:
                                rotatedCtx.translate(sourceWidth, 0);
                                rotatedCtx.rotate(Math.PI / 2);
                                break;
                            case 7:
                                rotatedCtx.translate(0, sourceHeight);
                                rotatedCtx.rotate(-Math.PI / 2);
                                rotatedCtx.scale(-1, 1);
                                break;
                            case 8:
                                rotatedCtx.translate(0, sourceHeight);
                                rotatedCtx.rotate(-Math.PI / 2);
                                break;
                            default:
                                break;
                        }
                        
                        // رسم الصورة الأصلية مع التحويلات
                        rotatedCtx.drawImage(img, 0, 0);
                        rotatedCtx.restore();
                        
                        // إنشاء canvas نهائي للاقتصاص
                        const finalCanvas = document.createElement('canvas');
                        finalCanvas.width = targetWidth;
                        finalCanvas.height = targetHeight;
                        const finalCtx = finalCanvas.getContext('2d');
                        finalCtx.imageSmoothingEnabled = true;
                        finalCtx.imageSmoothingQuality = 'high';
                        
                        // رسم الصورة المقتطعة
                        finalCtx.drawImage(
                            rotatedCanvas,
                            cropX, cropY, cropWidth, cropHeight,
                            0, 0, targetWidth, targetHeight
                        );
                        
                        const cropped = finalCanvas.toDataURL('image/jpeg', quality);
                        resolve(cropped);
                    } catch (error) {
                        console.error('خطأ في اقتصاص الصورة:', error);
                        reject(error);
                    }
                };
                img.onerror = (error) => {
                    console.error('خطأ في تحميل الصورة:', error);
                    reject(new Error('فشل تحميل الصورة'));
                };
                img.src = imageSource;
            }
            
            if (typeof file === 'string') {
                processImage();
            }
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            reject(error);
        }
    });
}

// دالة ضغط الصور مع معالجة اتجاه EXIF
function compressImage(file, maxWidth = 600, quality = 0.85) {
    return new Promise(async (resolve, reject) => {
        try {
            // معالجة المعاملات - إذا كان المعامل الثاني بين 0 و 1، فهو quality وليس maxWidth
            let actualMaxWidth = maxWidth;
            let actualQuality = quality;
            
            if (typeof maxWidth === 'number' && maxWidth > 0 && maxWidth <= 1) {
                // المعامل الثاني هو quality
                actualQuality = maxWidth;
                actualMaxWidth = 800; // القيمة الافتراضية
            }
            
            // التحقق من نوع المدخل
            let imageSource;
            let orientation = -1;
            
            if (typeof file === 'string') {
                // إذا كان data URL، نستخدمه مباشرة
                imageSource = file;
                // محاولة قراءة اتجاه EXIF من data URL (قد يفشل إذا كانت الصورة معالجة مسبقاً)
                try {
                    orientation = await getImageOrientation(file);
                } catch (error) {
                    // تجاهل الخطأ - نستخدم -1 (لا اتجاه)
                    orientation = -1;
                }
            } else if (file instanceof Blob || file instanceof File) {
                // إذا كان File أو Blob، نحوله إلى data URL أولاً
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        imageSource = e.target.result;
                        // قراءة اتجاه EXIF
                        orientation = await getImageOrientation(file);
                        processImage();
                    } catch (error) {
                        console.error('خطأ في قراءة اتجاه EXIF:', error);
                        orientation = -1;
                        processImage();
                    }
                };
                reader.onerror = (error) => {
                    console.error('خطأ في قراءة الملف:', error);
                    reject(new Error('فشل قراءة الملف'));
                };
                reader.readAsDataURL(file);
                return; // نخرج هنا لأن processImage سيُستدعى من reader.onload
            } else {
                reject(new Error('نوع ملف غير مدعوم'));
                return;
            }
            
            // دالة معالجة الصورة
            function processImage() {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        // تحديد الأبعاد النهائية بناءً على الاتجاه
                        // إذا كان الاتجاه يتطلب تدوير الصورة (5-8)، نبدل الأبعاد
                        const needsRotation = orientation >= 5 && orientation <= 8;
                        let outputWidth = needsRotation ? height : width;
                        let outputHeight = needsRotation ? width : height;
                        
                        // حساب الأبعاد بعد الضغط
                        if (outputWidth > actualMaxWidth) {
                            const ratio = actualMaxWidth / outputWidth;
                            outputWidth = actualMaxWidth;
                            outputHeight = Math.round(outputHeight * ratio);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }
                        
                        canvas.width = outputWidth;
                        canvas.height = outputHeight;
                        
                        const ctx = canvas.getContext('2d');
                        
                        // تحسين جودة الرسم
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        // تطبيق التحويلات بناءً على اتجاه EXIF
                        ctx.save();
                        
                        // تطبيق التحويلات قبل الرسم باستخدام المصفوفات
                        switch (orientation) {
                            case 2:
                                // Flip horizontal
                                ctx.translate(outputWidth, 0);
                                ctx.scale(-1, 1);
                                break;
                            case 3:
                                // Rotate 180
                                ctx.translate(outputWidth, outputHeight);
                                ctx.rotate(Math.PI);
                                break;
                            case 4:
                                // Flip vertical
                                ctx.translate(0, outputHeight);
                                ctx.scale(1, -1);
                                break;
                            case 5:
                                // Rotate 90 clockwise and flip horizontal
                                ctx.translate(outputWidth, 0);
                                ctx.rotate(Math.PI / 2);
                                ctx.scale(-1, 1);
                                break;
                            case 6:
                                // Rotate 90 clockwise (الشائع في الصور الملتقطة من الهواتف)
                                ctx.translate(outputWidth, 0);
                                ctx.rotate(Math.PI / 2);
                                break;
                            case 7:
                                // Rotate 90 counter-clockwise and flip horizontal
                                ctx.translate(0, outputHeight);
                                ctx.rotate(-Math.PI / 2);
                                ctx.scale(-1, 1);
                                break;
                            case 8:
                                // Rotate 90 counter-clockwise
                                ctx.translate(0, outputHeight);
                                ctx.rotate(-Math.PI / 2);
                                break;
                            default:
                                // Orientation 1 - لا تحويل
                                break;
                        }
                        
                        // رسم الصورة بالأبعاد الأصلية (قبل التدوير)
                        ctx.drawImage(img, 0, 0, width, height);
                        ctx.restore();
                        
                        const compressed = canvas.toDataURL('image/jpeg', actualQuality);
                        resolve(compressed);
                    } catch (error) {
                        console.error('خطأ في معالجة الصورة:', error);
                        reject(error);
                    }
                };
                img.onerror = (error) => {
                    console.error('خطأ في تحميل الصورة:', error);
                    reject(new Error('فشل تحميل الصورة'));
                };
                img.src = imageSource;
            }
            
            // إذا كان data URL، نعالج الصورة مباشرة
            if (typeof file === 'string') {
                processImage();
            }
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            reject(error);
        }
    });
}

// إنشاء النماذج عند تحميل القسم
async function loadInventorySection() {
    // منع الاستدعاءات المتكررة
    if (isLoadingInventorySection) {
        console.log('⏳ تحميل قسم المخزن قيد التنفيذ بالفعل...');
        return;
    }
    
    const section = document.getElementById('inventory-section');
    if (!section) {
        console.error('قسم المخزن غير موجود');
        return;
    }
    
    // التأكد من أن قسم المخزن هو القسم النشط قبل تحميل المحتوى
    // إذا لم يكن نشطاً، تفعيله تلقائياً
    if (!section.classList.contains('active')) {
        console.log('⚠️ قسم المخزن غير نشط، سيتم تفعيله تلقائياً');
        section.classList.add('active');
        section.style.display = 'block';
        
        // التأكد من إخفاء جميع الأقسام الأخرى
        document.querySelectorAll('.section').forEach(sec => {
            if (sec !== section) {
                sec.classList.remove('active');
                sec.style.display = 'none';
            }
        });
    }
    
    isLoadingInventorySection = true;
    console.log('📦 تحميل قسم المخزن...');
    
    // مسح البيانات القديمة
    allSpareParts = [];
    allAccessories = [];
    allPhones = [];
    
    // التحقق من نوع المستخدم لإخفاء زر الإضافة للفنيين وفرع البيطاش
    const user = getCurrentUser();
    const isTechnician = user && user.role === 'technician';
    
    // التحقق من أن المستخدم مرتبط بفرع البيطاش
    let isBaytashUser = false;
    try {
        if (typeof isBaytashBranch === 'function') {
            isBaytashUser = await isBaytashBranch();
        }
    } catch (error) {
        console.error('خطأ في التحقق من فرع البيطاش:', error);
    }
    
    // إخفاء زر الإضافة وزر "جرد القسم" للفنيين وأي حساب مرتبط بفرع البيطاش
    const addButtonStyle = (isTechnician || isBaytashUser) ? 'display: none;' : '';
    const printButtonStyle = isBaytashUser ? 'display: none;' : '';
    
    section.innerHTML = `
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
            <button id="printInventoryReportBtn" onclick="printInventoryReport()" class="btn btn-secondary inventory-tab-button" style="${printButtonStyle}" title="طباعة جرد القسم">
                <i class="bi bi-printer"></i> جرد القسم
            </button>
            <button onclick="showAddInventoryModal()" class="btn btn-primary inventory-tab-button" data-permission="manager" style="${addButtonStyle}" title="إضافة عنصر جديد">
                <i class="bi bi-plus-circle"></i> إضافة
            </button>
        </div>

        <!-- قسم قطع الغيار -->
        <div id="spare-parts-section" class="inventory-section active">
            <div class="inventory-search">
                <select id="sparePartsBrandFilter" onchange="filterSparePartsByBrand(this.value, this)">
                    <option value="all">الكل</option>
                </select>
                <input type="text" id="sparePartsSearch" placeholder="بحث بالموديل..." onkeyup="filterSpareParts()">
            </div>
            <div class="inventory-grid" id="sparePartsGrid"></div>
        </div>

        <!-- قسم الإكسسوارات -->
        <div id="accessories-section" class="inventory-section">
            <div class="inventory-search">
                <select id="accessoryTypeFilter" onchange="filterAccessoriesByType(this.value, this)">
                    <option value="all">الكل</option>
                </select>
                <input type="text" id="accessoriesSearch" placeholder="بحث في الإكسسوارات..." onkeyup="filterAccessories()">
            </div>
            <div class="inventory-grid" id="accessoriesGrid"></div>
        </div>

        <!-- قسم الهواتف -->
        <div id="phones-section" class="inventory-section">
            <div class="inventory-search">
                <select id="phoneBrandFilter" onchange="filterPhonesByBrand(this.value, this)">
                    <option value="all">الكل</option>
                </select>
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
    console.log('📥 تحميل بيانات المخزن...');
    
    // تحميل البيانات بعد تأخير لضمان أن DOM جاهز تماماً
    setTimeout(() => {
        // التأكد من أن القسم مرئي قبل تحميل البيانات
        const inventorySection = document.getElementById('inventory-section');
        if (!inventorySection) {
            console.error('❌ قسم المخزن غير موجود');
            isLoadingInventorySection = false;
            return;
        }
        
        // التأكد من أن قسم المخزن هو القسم النشط الوحيد
        // إذا لم يكن نشطاً، تفعيله تلقائياً
        if (!inventorySection.classList.contains('active')) {
            console.log('⚠️ قسم المخزن غير نشط، سيتم تفعيله تلقائياً');
            inventorySection.classList.add('active');
            inventorySection.style.display = 'block';
        }
        
        // التأكد من إخفاء جميع الأقسام الأخرى
        document.querySelectorAll('.section').forEach(sec => {
            if (sec !== inventorySection) {
                sec.classList.remove('active');
                sec.style.display = 'none';
            }
        });
        
        // تأخير إضافي لضمان أن DOM جاهز تماماً
        setTimeout(async () => {
            try {
                // عرض loading overlay عند تحميل البيانات (إذا لم يكن معروضاً بالفعل)
                // التحقق من أن overlay غير معروض بالفعل (مثل حالة تحميل الصفحة الأولي)
                if (typeof window !== 'undefined' && window.loadingOverlay) {
                    const isAlreadyVisible = window.loadingOverlay.overlayElement && 
                                            window.loadingOverlay.overlayElement.classList.contains('active');
                    if (!isAlreadyVisible) {
                        window.loadingOverlay.show();
                    }
                }
                
                // تحميل جميع البيانات دائماً (قطع الغيار، الإكسسوارات، الهواتف)
                // لا نستخدم silent: true حتى تظهر loading overlay عند النقر على التبويب
                console.log('📥 بدء تحميل جميع بيانات المخزن (قطع الغيار، الإكسسوارات، الهواتف)...');
                
                // تحميل الماركات أولاً ثم باقي البيانات
                await loadPhoneBrands();
                
                await Promise.all([
                    loadSpareParts(false), // silent = false لظهور loading overlay
                    loadAccessories(false), // silent = false لظهور loading overlay
                    loadPhones(false) // silent = false لظهور loading overlay
                ]);
                
                // إنشاء الفلاتر بعد اكتمال تحميل جميع البيانات
                setTimeout(async () => {
                    try {
                        await createSparePartsBrandFilters();
                        createAccessoryFilters();
                        createPhoneBrands();
                        hideByPermission();
                    } catch (error) {
                        console.error('خطأ في إنشاء الفلاتر:', error);
                    }
                }, 300);
                
                console.log('✅ تم تحميل جميع بيانات المخزن بنجاح');
            } catch (error) {
                console.error('❌ خطأ في تحميل بيانات المخزن:', error);
            } finally {
                isLoadingInventorySection = false;
                
                // إخفاء loading overlay بعد اكتمال تحميل جميع البيانات
                if (typeof window !== 'undefined' && window.loadingOverlay) {
                    // انتظار قليل لضمان اكتمال جميع العمليات
                    setTimeout(() => {
                        if (window.loadingOverlay) {
                            // استخدام forceHide لإخفاء overlay بشكل كامل بعد اكتمال تحميل جميع البيانات
                            window.loadingOverlay.forceHide();
                            console.log('✅ تم إخفاء شاشة التحميل بعد اكتمال تحميل جميع البيانات');
                        }
                    }, 500);
                }
            }
        }, 200);
    }, 200);
}

// ============================================
// دوال الطباعة
// ============================================

// طباعة QR Code للإكسسوار
async function printAccessoryBarcode(id) {
    try {
        const accessory = allAccessories.find(a => a.id === id);
        if (!accessory) {
            showMessage('الإكسسوار غير موجود', 'error');
            return;
        }
        
        // طلب عدد النسخ باستخدام نافذة إدخال مخصصة
        if (typeof window.showInputPrompt === 'undefined') {
            showMessage('خطأ: نظام الإدخال غير متاح. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
        
        const copies = await window.showInputPrompt('كم عدد النسخ المطلوبة للطباعة؟', '1', 'number');
        if (!copies || isNaN(copies) || parseInt(copies) < 1) {
            return;
        }
        
        const numCopies = parseInt(copies);
        
        // الحصول على قيمة الباركود للـ QR Code
        const barcodeValue = accessory.barcode || accessory.code || accessory.id?.toString() || id;
        
        // ✅ استخدام barcode البسيط مباشرة بدلاً من JSON
        // هذا أفضل للتوافق مع جميع الماسحات (هاتف وسطح المكتب)
        const qrData = barcodeValue;
        
        // إنشاء QR Code
        let qrImage = '';
        try {
            if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
                qrImage = await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve(generateQRCodeFallback(qrData, 300));
                    }, 3000);
                    
                    QRCode.toDataURL(qrData, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    }, function (error, url) {
                        clearTimeout(timeout);
                        if (error || !url) {
                            resolve(generateQRCodeFallback(qrData, 300));
                        } else {
                            resolve(url);
                        }
                    });
                });
            } else {
                qrImage = generateQRCodeFallback(qrData, 300);
            }
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            qrImage = generateQRCodeFallback(qrData, 300);
        }
        
        // إنشاء نافذة الطباعة
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        // إنشاء محتوى الطباعة - ملصق بسيط يحتوي على QR Code فقط
        let printContent = '';
        for (let i = 0; i < numCopies; i++) {
            printContent += `
            <div class="qrcode-container" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'};">
                <div class="qrcode-image">
                    <img src="${qrImage}" alt="QR Code ${barcodeValue}" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}';">
                </div>
            </div>
            `;
        }
        
        // التحقق من أن النافذة جاهزة
        if (!printWindow || !printWindow.document) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة QR Code - ${barcodeValue}</title>
            <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
            <style>
                :root {
                    --white: #ffffff;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 0;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .qrcode-container {
                    width: 60mm;
                    height: 40mm;
                    background: var(--white);
                    padding: 5mm;
                    margin: 0;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-image {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }
                @media print {
                    @page {
                        size: 60mm 40mm;
                        margin: 0;
                    }
                    body {
                        background: white;
                        padding: 0;
                        margin: 0;
                        width: 60mm;
                        height: 40mm;
                    }
                    .qrcode-container {
                        width: 60mm;
                        height: 40mm;
                        page-break-inside: avoid;
                        margin: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 300);
                };
            </script>
        </body>
        </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            if (printWindow && !printWindow.closed) {
                printWindow.focus();
            }
        }, 100);
    } catch (error) {
        console.error('خطأ في طباعة QR Code الإكسسوار:', error);
        showMessage('حدث خطأ أثناء طباعة QR Code', 'error');
    }
}

// دالة مساعدة لتهريب HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// طباعة جرد القسم الحالي
async function printInventoryReport() {
    try {
        const tab = currentInventoryTab;
        let reportTitle = '';
        let reportContent = '';
        
        if (tab === 'spare_parts') {
            // جرد قطع الغيار: كل ماركة والموديلات والقطع المتوفرة
            reportTitle = 'جرد قطع الغيار';
            
            // تجميع البيانات حسب الماركة
            const brandsMap = new Map();
            
            allSpareParts.forEach(part => {
                const brand = part.brand || 'غير محدد';
                if (!brandsMap.has(brand)) {
                    brandsMap.set(brand, []);
                }
                brandsMap.get(brand).push(part);
            });
            
            // بناء محتوى التقرير
            let brandsHtml = '';
            const sortedBrands = Array.from(brandsMap.keys()).sort();
            
            sortedBrands.forEach(brand => {
                const parts = brandsMap.get(brand);
                let modelsHtml = '';
                
                parts.forEach(part => {
                    const model = part.model || 'غير محدد';
                    let itemsHtml = '';
                    
                    if (part.items && part.items.length > 0) {
                        itemsHtml = part.items.map(item => {
                            const itemType = sparePartTypes.find(t => t.id === item.item_type);
                            const itemName = itemType ? itemType.name : (item.item_type || 'غير محدد');
                            const quantity = parseInt(item.quantity || 0);
                            return `
                                <tr>
                                    <td style="padding-right: 20px;">${escapeHtml(itemName)}</td>
                                    <td style="text-align: center; font-weight: bold; color: var(--primary-color);">${quantity}</td>
                                </tr>
                            `;
                        }).join('');
                    } else {
                        itemsHtml = '<tr><td colspan="2" style="text-align: center; color: var(--text-light);">لا توجد قطع متوفرة</td></tr>';
                    }
                    
                    const totalQuantity = (part.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                    
                    modelsHtml += `
                        <div style="margin-bottom: 25px; padding: 15px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color);">
                            <h4 style="color: var(--primary-color); margin-bottom: 10px; font-size: 1.1em; font-weight: 700;">الموديل: ${escapeHtml(model)}</h4>
                            <p style="color: var(--text-light); margin-bottom: 10px; font-size: 0.9em;">إجمالي الكمية: <strong style="color: var(--primary-color);">${totalQuantity}</strong></p>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                                <thead>
                                    <tr style="background: var(--light-bg);">
                                        <th style="padding: 8px; text-align: right; border-bottom: 2px solid var(--border-color);">نوع القطعة</th>
                                        <th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--border-color); width: 100px;">الكمية</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                        </div>
                    `;
                });
                
                brandsHtml += `
                    <div style="margin-bottom: 30px; padding: 20px; background: var(--light-bg); border-radius: 10px; border-right: 4px solid var(--primary-color);">
                        <h3 style="color: var(--primary-color); margin-bottom: 15px; font-size: 1.3em; font-weight: 800;">الماركة: ${escapeHtml(brand)}</h3>
                        ${modelsHtml}
                    </div>
                `;
            });
            
            reportContent = brandsHtml;
            
        } else if (tab === 'accessories') {
            // جرد الإكسسوارات: كل نوع والبطاقات المرتبطة والكميات المتوفرة
            reportTitle = 'جرد الإكسسوارات';
            
            // تجميع البيانات حسب النوع
            const typesMap = new Map();
            
            allAccessories.forEach(accessory => {
                const typeId = accessory.type || 'other';
                const type = getAllAccessoryTypes().find(t => t.id === typeId);
                const typeName = type ? type.name : (accessory.type || 'أخرى');
                
                if (!typesMap.has(typeName)) {
                    typesMap.set(typeName, []);
                }
                typesMap.get(typeName).push(accessory);
            });
            
            // بناء محتوى التقرير
            let typesHtml = '';
            const sortedTypes = Array.from(typesMap.keys()).sort();
            
            sortedTypes.forEach(typeName => {
                const accessories = typesMap.get(typeName);
                let cardsHtml = '';
                
                accessories.forEach(accessory => {
                    const name = accessory.name || 'غير محدد';
                    const quantity = parseInt(accessory.quantity || 0);
                    
                    cardsHtml += `
                        <tr>
                            <td style="padding: 10px; text-align: right;">${escapeHtml(name)}</td>
                            <td style="padding: 10px; text-align: center; font-weight: bold; color: var(--primary-color);">${quantity}</td>
                        </tr>
                    `;
                });
                
                const totalQuantity = accessories.reduce((sum, acc) => sum + (parseInt(acc.quantity || 0)), 0);
                
                typesHtml += `
                    <div style="margin-bottom: 25px; padding: 20px; background: var(--white); border-radius: 8px; border: 1px solid var(--border-color);">
                        <h3 style="color: var(--primary-color); margin-bottom: 15px; font-size: 1.2em; font-weight: 700;">النوع: ${escapeHtml(typeName)}</h3>
                        <p style="color: var(--text-light); margin-bottom: 15px; font-size: 0.95em;">إجمالي الكمية: <strong style="color: var(--primary-color); font-size: 1.1em;">${totalQuantity}</strong></p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background: var(--light-bg);">
                                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid var(--border-color);">الموديل </th>
                                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid var(--border-color); width: 100px;">الكمية المتوفرة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cardsHtml}
                            </tbody>
                        </table>
                    </div>
                `;
            });
            
            reportContent = typesHtml;
            
        } else {
            showMessage('لا يمكن طباعة جرد لهذا القسم', 'warning');
            return;
        }
        
        // فتح نافذة الطباعة
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        const currentDate = new Date().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${reportTitle}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap');
                    
                    :root {
                        --primary-color: #2196F3;
                        --secondary-color: #64B5F6;
                        --success-color: #4CAF50;
                        --warning-color: #FFA500;
                        --danger-color: #f44336;
                        --text-dark: #333;
                        --text-light: #666;
                        --border-color: #ddd;
                        --light-bg: #f5f5f5;
                        --white: #ffffff;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 30px;
                        background: #fff;
                        color: var(--text-dark);
                        line-height: 1.6;
                    }
                    
                    .report-container {
                        max-width: 1000px;
                        margin: 0 auto;
                        background: white;
                        padding: 40px;
                        border: 2px solid var(--border-color);
                        border-radius: 8px;
                    }
                    
                    .report-header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 3px solid var(--primary-color);
                    }
                    
                    .report-header h1 {
                        font-size: 2em;
                        color: var(--primary-color);
                        margin-bottom: 10px;
                        font-weight: 800;
                    }
                    
                    .report-header p {
                        color: var(--text-light);
                        font-size: 1em;
                        margin: 5px 0;
                    }
                    
                    .report-content {
                        margin-top: 20px;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    
                    .no-print {
                        text-align: center;
                        margin-top: 30px;
                        display: flex;
                        gap: 15px;
                        justify-content: center;
                        flex-wrap: wrap;
                    }
                    
                    .no-print button {
                        padding: 12px 25px;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1em;
                        font-family: inherit;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .no-print button:hover {
                        background: var(--secondary-color);
                    }
                    
                    @media print {
                        @page {
                            margin: 0;
                            size: 80mm auto;
                        }
                        
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        body {
                            background: white !important;
                            color: black !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 80mm !important;
                        }
                        
                        .report-container {
                            width: 80mm !important;
                            max-width: 80mm !important;
                            margin: 0 !important;
                            padding: 8px 4px !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            overflow: visible !important;
                            height: auto !important;
                            max-height: none !important;
                            display: block !important;
                            position: static !important;
                            box-sizing: border-box !important;
                        }
                        
                        .report-container * {
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        
                        .report-container > * {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        
                        .report-header {
                            margin-bottom: 10px !important;
                            padding-bottom: 10px !important;
                            font-size: 0.85em !important;
                            page-break-inside: avoid !important;
                        }
                        
                        .report-header h1 {
                            font-size: 1.2em !important;
                            margin-bottom: 5px !important;
                        }
                        
                        .report-header p {
                            font-size: 0.75em !important;
                        }
                        
                        .report-content {
                            margin-top: 10px !important;
                            font-size: 0.8em !important;
                        }
                        
                        .report-content > div {
                            margin-bottom: 15px !important;
                            padding: 10px !important;
                            font-size: 0.8em !important;
                            page-break-inside: avoid !important;
                        }
                        
                        .report-content h3 {
                            font-size: 1em !important;
                            margin-bottom: 8px !important;
                        }
                        
                        .report-content h4 {
                            font-size: 0.9em !important;
                            margin-bottom: 5px !important;
                        }
                        
                        .report-content p {
                            font-size: 0.75em !important;
                            margin-bottom: 5px !important;
                        }
                        
                        .report-content table {
                            font-size: 0.7em !important;
                            margin-top: 5px !important;
                        }
                        
                        .report-content th,
                        .report-content td {
                            padding: 4px 2px !important;
                            font-size: 0.7em !important;
                        }
                        
                        .no-print {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="report-header">
                        <h1><i class="bi bi-clipboard-data"></i> ${reportTitle}</h1>
                        <p>تاريخ الطباعة: ${currentDate}</p>
                    </div>
                    <div class="report-content">
                        ${reportContent}
                    </div>
                </div>
                <div class="no-print">
                    <button onclick="window.print()">
                        <i class="bi bi-printer"></i> طباعة
                    </button>
                    <button onclick="window.close()">
                        <i class="bi bi-x-circle"></i> إغلاق
                    </button>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            if (printWindow && !printWindow.closed) {
                printWindow.focus();
            }
        }, 100);
        
    } catch (error) {
        console.error('خطأ في طباعة جرد المخزن:', error);
        showMessage('حدث خطأ أثناء طباعة الجرد', 'error');
    }
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

// دالة طباعة QR Code قطع الغيار
async function printSparePartQRCode(partId) {
    try {
        const part = allSpareParts.find(p => p.id === partId);
        if (!part) {
            showMessage('قطعة الغيار غير موجودة', 'error');
            return;
        }
        
        // إنشاء بيانات QR Code - تبسيط للتوافق مع الهاتف وسطح المكتب
        // استخدام barcode فقط بدلاً من JSON المعقد لتحسين التوافق
        const barcode = part.barcode || part.id?.toString() || `${part.brand}-${part.model}-${part.id}`;
        
        // ✅ استخدام barcode البسيط مباشرة بدلاً من JSON
        // هذا أفضل للتوافق مع جميع الماسحات
        const qrData = barcode;
        
        // إنشاء QR Code
        let qrImage = '';
        try {
            if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
                qrImage = await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve(generateQRCodeFallback(qrData, 200));
                    }, 3000);
                    
                    QRCode.toDataURL(qrData, {
                        width: 200,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    }, function (error, url) {
                        clearTimeout(timeout);
                        if (error || !url) {
                            resolve(generateQRCodeFallback(qrData, 200));
                        } else {
                            resolve(url);
                        }
                    });
                });
            } else {
                qrImage = generateQRCodeFallback(qrData, 200);
            }
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            qrImage = generateQRCodeFallback(qrData, 200);
        }
        
        // التحقق من أن صورة QR Code صالحة
        if (!qrImage || qrImage.trim() === '') {
            console.error('صورة QR Code فارغة');
            showMessage('خطأ: لم يتم إنشاء صورة QR Code', 'error');
            return;
        }
        
        // طلب عدد النسخ باستخدام نافذة إدخال مخصصة
        if (typeof window.showInputPrompt === 'undefined') {
            showMessage('خطأ: نظام الإدخال غير متاح. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
        
        const copies = await window.showInputPrompt('كم عدد النسخ المطلوبة للطباعة؟', '1', 'number');
        if (!copies || isNaN(copies) || parseInt(copies) < 1) {
            return;
        }
        
        const numCopies = parseInt(copies);
    
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        showMessage('يرجى السماح بفتح النوافذ المنبثقة للطباعة', 'warning');
        return;
    }
    
    // إنشاء محتوى الطباعة
    let printContent = '';
    const safeQRImage = qrImage.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeQRData = encodeURIComponent(qrData);
    
    for (let i = 0; i < numCopies; i++) {
        printContent += `
            <div class="qrcode-label" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'};">
                <div class="qrcode-label-content">
                    <div class="qrcode-label-qrcode">
                        <img src="${safeQRImage}" alt="QR Code" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${safeQRData}';">
                    </div>
                </div>
            </div>
        `;
    }
    
    // التحقق من أن النافذة جاهزة
    if (!printWindow || !printWindow.document) {
        showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة QR Code - ${part.brand || ''} ${part.model || ''}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
            <style>
                :root {
                    --primary-color: #2196F3;
                    --white: #ffffff;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 0;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .qrcode-label {
                    width: 60mm;
                    height: 40mm;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-label-content {
                    width: 100%;
                    height: 100%;
                    padding: 5mm;
                    text-align: center;
                    background: var(--white);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-label-qrcode {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-label-qrcode img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }
                @media print {
                    @page {
                        size: 60mm 40mm;
                        margin: 0;
                    }
                    body {
                        padding: 0;
                        margin: 0;
                        width: 60mm;
                        height: 40mm;
                        background: white;
                    }
                    .qrcode-label {
                        width: 60mm;
                        height: 40mm;
                        page-break-inside: avoid;
                        margin: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 300);
                };
            </script>
        </body>
        </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            if (printWindow && !printWindow.closed) {
                printWindow.focus();
            }
        }, 100);
    } catch (error) {
        console.error('خطأ في طباعة QR Code قطعة الغيار:', error);
        showMessage('حدث خطأ أثناء طباعة QR Code', 'error');
    }
}

// دالة مساعدة لإنشاء QR Code (بديل إذا لم تكن المكتبة متوفرة)
function generateQRCodeFallback(data, size = 250) {
    try {
        const encodedData = encodeURIComponent(data);
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
    } catch (error) {
        console.error('خطأ في إنشاء QR Code البديل:', error);
        return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(data)}&choe=UTF-8`;
    }
}

// طباعة ملصق الهاتف - دالة اختيار نوع الملصق
async function printPhoneLabel(id) {
    try {
        const phone = allPhones.find(p => p.id === id);
        if (!phone) {
            showMessage('الهاتف غير موجود', 'error');
            return;
        }
        
        // عرض خيارات الطباعة
        const labelType = await showPrintLabelOptions();
        if (!labelType) {
            return; // المستخدم ألغى
        }
        
        if (labelType === 'full') {
            await printPhoneFullLabel(id);
        } else if (labelType === 'qrcode') {
            await printPhoneQRCodeOnly(id);
        }
    } catch (error) {
        console.error('خطأ في طباعة ملصق الهاتف:', error);
        showMessage('حدث خطأ أثناء طباعة الملصق', 'error');
    }
}

// عرض خيارات الطباعة
function showPrintLabelOptions() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>اختر نوع الملصق</h2>
                    <button class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 30px; text-align: center;">
                    <button id="full-label-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 15px; padding: 15px; font-size: 16px;">
                        <i class="bi bi-tag-fill"></i> ملصق كامل
                    </button>
                    <button id="qrcode-only-btn" class="btn btn-info" style="width: 100%; padding: 15px; font-size: 16px;">
                        <i class="bi bi-qr-code-scan"></i> QR Code فقط
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // معالجة الإغلاق
        const closeModal = () => {
            modal.remove();
            resolve(null);
        };
        
        modal.querySelector('.btn-close').onclick = closeModal;
        // تعطيل إغلاق المودال عند النقر خارجها - معطل حسب الطلب
        // modal.onclick = (e) => {
        //     if (e.target === modal) closeModal();
        // };
        
        // معالجة الاختيارات
        modal.querySelector('#full-label-btn').onclick = () => {
            modal.remove();
            resolve('full');
        };
        
        modal.querySelector('#qrcode-only-btn').onclick = () => {
            modal.remove();
            resolve('qrcode');
        };
    });
}

// طباعة الملصق الكامل للهاتف
async function printPhoneFullLabel(id) {
    try {
        const phone = allPhones.find(p => p.id === id);
        if (!phone) {
            showMessage('الهاتف غير موجود', 'error');
            return;
        }
        
        // طلب عدد النسخ
        if (typeof window.showInputPrompt === 'undefined') {
            showMessage('خطأ: نظام الإدخال غير متاح. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
        
        const copies = await window.showInputPrompt('كم عدد النسخ المطلوبة للطباعة؟', '1', 'number');
        if (!copies || isNaN(copies) || parseInt(copies) < 1) {
            return;
        }
        
        const numCopies = parseInt(copies);
        
        // الحصول على قيمة الباركود للـ QR Code
        const barcodeValue = phone.barcode || phone.code || phone.id?.toString() || id;
        
        // ✅ استخدام barcode البسيط مباشرة للتوافق مع جميع الماسحات
        const qrData = barcodeValue;
        
        // إنشاء QR Code
        let qrImage = '';
        try {
            if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
                qrImage = await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve(generateQRCodeFallback(qrData, 300));
                    }, 3000);
                    
                    QRCode.toDataURL(qrData, {
                        width: 150,
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    }, function (error, url) {
                        clearTimeout(timeout);
                        if (error || !url) {
                            resolve(generateQRCodeFallback(qrData, 150));
                        } else {
                            resolve(url);
                        }
                    });
                });
            } else {
                qrImage = generateQRCodeFallback(qrData, 150);
            }
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            qrImage = generateQRCodeFallback(qrData, 150);
        }
        
        // إنشاء نافذة الطباعة
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        // إنشاء محتوى الطباعة - ملصق كامل للهاتف
        let printContent = '';
        for (let i = 0; i < numCopies; i++) {
            printContent += `
            <div class="phone-label" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'};">
                <div class="label-header">
                    <div class="brand-name">${phone.brand || 'غير محدد'}</div>
                    <div class="model-name">${phone.model || 'غير محدد'}</div>
                </div>
                
                <div class="label-qrcode">
                    <img src="${qrImage}" alt="QR Code ${barcodeValue}" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}';">
                    <div class="qrcode-text">${barcodeValue}</div>
                </div>
                
                ${(phone.storage || phone.ram || phone.screen_type || phone.processor || phone.battery || (phone.battery_percent !== null && phone.battery_percent !== undefined)) ? `
                <div class="label-specs">
                    ${phone.storage ? `<div class="spec-row"><span class="spec-label">المساحة</span><span class="spec-value">${phone.storage}</span></div>` : ''}
                    ${phone.ram ? `<div class="spec-row"><span class="spec-label">الرام</span><span class="spec-value">${phone.ram}</span></div>` : ''}
                    ${phone.screen_type ? `<div class="spec-row"><span class="spec-label">الشاشة</span><span class="spec-value">${phone.screen_type}</span></div>` : ''}
                    ${phone.processor ? `<div class="spec-row"><span class="spec-label">المعالج</span><span class="spec-value">${phone.processor}</span></div>` : ''}
                    ${phone.battery ? `<div class="spec-row"><span class="spec-label">البطارية</span><span class="spec-value">${phone.battery}</span></div>` : ''}
                    ${(phone.battery_percent !== null && phone.battery_percent !== undefined) ? `<div class="spec-row"><span class="spec-label">نسبة البطارية</span><span class="spec-value">${phone.battery_percent}%</span></div>` : ''}
                </div>
                ` : ''}
                
                <div class="label-price">
                    ${formatCurrency(phone.selling_price || 0)}
                </div>
            </div>
            `;
        }
        
        // التحقق من أن النافذة جاهزة
        if (!printWindow || !printWindow.document) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ملصق الهاتف - ${phone.brand || ''} ${phone.model || ''}</title>
            <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
            <style>
                :root {
                    --primary-color: #2196F3;
                    --secondary-color: #64B5F6;
                    --text-dark: #1a1a1a;
                    --text-light: #555;
                    --border-color: #e0e0e0;
                    --light-bg: #f8f9fa;
                    --white: #ffffff;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 5mm;
                    background: var(--light-bg);
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 5mm;
                    max-width: 210mm;
                    margin: 0 auto;
                }
                .phone-label {
                    width: 100%;
                    max-width: 95mm;
                    background: var(--white);
                    border: 1.5px solid var(--border-color);
                    border-radius: 4px;
                    padding: 5mm;
                    margin: 0 auto;
                    text-align: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    overflow: hidden;
                    position: relative;
                }
                .phone-label::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 0;
                    left: 0;
                    height: 3mm;
                    background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
                }
                .label-header {
                    padding-bottom: 2mm;
                    margin-bottom: 2mm;
                    border-bottom: 1.5px solid var(--border-color);
                }
                .brand-name {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 0.5mm;
                    letter-spacing: 0.3px;
                }
                .model-name {
                    font-size: 10px;
                    color: var(--text-dark);
                    font-weight: 500;
                }
                .label-qrcode {
                    margin: 3mm 0;
                    padding: 2.5mm;
                    background: var(--light-bg);
                    border-radius: 3px;
                }
                .label-qrcode img {
                    width: 32mm;
                    height: 32mm;
                    display: block;
                    margin: 0 auto;
                    border: 1px solid var(--border-color);
                    background: var(--white);
                    padding: 2mm;
                    border-radius: 3px;
                }
                .qrcode-text {
                    font-family: 'Courier New', monospace;
                    font-size: 8px;
                    color: var(--text-dark);
                    margin-top: 2mm;
                    word-break: break-all;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .label-specs {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5mm;
                    margin: 2.5mm 0;
                    padding: 2mm;
                    background: var(--light-bg);
                    border-radius: 3px;
                }
                .spec-row {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 1.5mm 1mm;
                    background: var(--white);
                    border-radius: 3px;
                    border: 0.5px solid rgba(0,0,0,0.08);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    min-height: 8mm;
                }
                .spec-label {
                    color: var(--text-light);
                    font-weight: 600;
                    font-size: 7px;
                    margin-bottom: 0.5mm;
                    text-align: center;
                    line-height: 1.2;
                }
                .spec-value {
                    color: var(--text-dark);
                    font-weight: 700;
                    font-size: 8.5px;
                    text-align: center;
                    word-break: break-word;
                    line-height: 1.2;
                }
                .label-price {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--white);
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    margin-top: 2.5mm;
                    padding: 2.5mm 2mm;
                    border-radius: 3px;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    letter-spacing: 0.5px;
                }
                @media print {
                    body {
                        padding: 5mm;
                        margin: 0;
                        background: white;
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 5mm;
                    }
                    .phone-label {
                        page-break-inside: avoid;
                        margin-bottom: 0;
                        border: 1.5px solid var(--border-color);
                        box-shadow: none;
                    }
                    .phone-label::before {
                        display: block;
                    }
                    .no-print {
                        display: none;
                    }
                    @page {
                        size: A4;
                        margin: 5mm;
                    }
                }
                @media screen and (max-width: 768px) {
                    body {
                        grid-template-columns: 1fr;
                    }
                }
                .print-controls {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    z-index: 1000;
                }
                .print-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 600;
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 140px;
                    color: var(--white);
                }
                @media screen and (max-width: 768px) {
                    .print-controls {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        flex-direction: row;
                        gap: 10px;
                    }
                    .print-btn {
                        width: auto;
                        padding: 10px 20px;
                        font-size: 14px;
                    }
                }
                .print-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .print-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                }
                .print-btn-primary {
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                }
                .print-btn-primary:hover {
                    background: linear-gradient(135deg, var(--secondary-color), var(--primary-color));
                }
                .print-btn-secondary {
                    background: linear-gradient(135deg, #6c757d, #868e96);
                }
                .print-btn-secondary:hover {
                    background: linear-gradient(135deg, #5a6268, #6c757d);
                }
            </style>
        </head>
        <body>
            ${printContent}
            <div class="no-print print-controls">
                <button onclick="window.print()" class="print-btn print-btn-primary">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="window.history.back() || window.close()" class="print-btn print-btn-secondary">
                    <i class="bi bi-arrow-right"></i> رجوع
                </button>
            </div>
        </body>
        </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            if (printWindow && !printWindow.closed) {
                printWindow.focus();
            }
        }, 100);
    } catch (error) {
        console.error('خطأ في طباعة الملصق الكامل:', error);
        showMessage('حدث خطأ أثناء طباعة الملصق', 'error');
    }
}

// طباعة QR Code فقط للهاتف
async function printPhoneQRCodeOnly(id) {
    try {
        const phone = allPhones.find(p => p.id === id);
        if (!phone) {
            showMessage('الهاتف غير موجود', 'error');
            return;
        }
        
        // طلب عدد النسخ
        if (typeof window.showInputPrompt === 'undefined') {
            showMessage('خطأ: نظام الإدخال غير متاح. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
        
        const copies = await window.showInputPrompt('كم عدد النسخ المطلوبة للطباعة؟', '1', 'number');
        if (!copies || isNaN(copies) || parseInt(copies) < 1) {
            return;
        }
        
        const numCopies = parseInt(copies);
        
        // الحصول على قيمة الباركود للـ QR Code
        const barcodeValue = phone.barcode || phone.code || phone.id?.toString() || id;
        
        // ✅ استخدام barcode البسيط مباشرة للتوافق مع جميع الماسحات
        const qrData = barcodeValue;
        
        // إنشاء QR Code
        let qrImage = '';
        try {
            if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
                qrImage = await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve(generateQRCodeFallback(qrData, 300));
                    }, 3000);
                    
                    QRCode.toDataURL(qrData, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    }, function (error, url) {
                        clearTimeout(timeout);
                        if (error || !url) {
                            resolve(generateQRCodeFallback(qrData, 300));
                        } else {
                            resolve(url);
                        }
                    });
                });
            } else {
                qrImage = generateQRCodeFallback(qrData, 300);
            }
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            qrImage = generateQRCodeFallback(qrData, 300);
        }
        
        // إنشاء نافذة الطباعة
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        // إنشاء محتوى الطباعة - QR Code فقط
        let printContent = '';
        for (let i = 0; i < numCopies; i++) {
            printContent += `
            <div class="qrcode-container" style="page-break-after: ${i < numCopies - 1 ? 'always' : 'auto'};">
                <div class="qrcode-image">
                    <img src="${qrImage}" alt="QR Code ${barcodeValue}" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}';">
                </div>
            </div>
            `;
        }
        
        // التحقق من أن النافذة جاهزة
        if (!printWindow || !printWindow.document) {
            showMessage('فشل فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
            return;
        }
        
        printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة QR Code - ${barcodeValue}</title>
            <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
            <style>
                :root {
                    --white: #ffffff;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 0;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .qrcode-container {
                    width: 60mm;
                    height: 40mm;
                    background: var(--white);
                    padding: 5mm;
                    margin: 0;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-image {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qrcode-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }
                @media print {
                    @page {
                        size: 60mm 40mm;
                        margin: 0;
                    }
                    body {
                        background: white;
                        padding: 0;
                        margin: 0;
                        width: 60mm;
                        height: 40mm;
                    }
                    .qrcode-container {
                        width: 60mm;
                        height: 40mm;
                        page-break-inside: avoid;
                        margin: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 300);
                };
            </script>
        </body>
        </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            if (printWindow && !printWindow.closed) {
                printWindow.focus();
            }
        }, 100);
    } catch (error) {
        console.error('خطأ في طباعة QR Code:', error);
        showMessage('حدث خطأ أثناء طباعة QR Code', 'error');
    }
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



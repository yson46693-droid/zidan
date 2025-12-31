// إدارة عمليات الصيانة

let allRepairs = [];
let allUsers = []; // إضافة متغير لحفظ المستخدمين
let currentRepairPage = 1;
const repairsPerPage = 10;
let isScannerOpen = false; // متغير لتتبع حالة الماسح
let currentRepairType = 'soft'; // القسم النشط: soft, hard, fast
let repairBranches = []; // حفظ الفروع
let repairFirstBranchId = null; // الفرع الأول
// ✅ حفظ الفرع المحدد للفلترة
let selectedRepairBranchId = null;
// حفظ العملاء للفرع المحدد
let repairCustomers = []; // جميع العملاء (retail + commercial)
// حفظ الفنيين المتاحين
let repairTechnicians = []; // الفنيين (technician + admin)

// ✅ تحسين الأداء: Flags لمنع التحميل المكرر
let isLoadingRepairBranches = false;
let lastRepairBranchesLoadTime = 0;
const REPAIR_MIN_LOAD_INTERVAL = 2000; // 2 ثانية كحد أدنى بين الطلبات

// ✅ تحسين الأداء: Flags لمنع تحميل العمليات المكرر
let isLoadingRepairs = false;
let lastRepairsLoadTime = 0;
const REPAIRS_MIN_LOAD_INTERVAL = 2000; // 2 ثانية كحد أدنى بين الطلبات

async function loadRepairsSection() {
    // تحميل حالة إذن الكاميرا
    cameraPermissionGranted = localStorage.getItem('cameraPermissionGranted') === 'true';
    
    const section = document.getElementById('repairs-section');
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    section.innerHTML = `
        <div class="section-header">
            <div class="header-actions" style="display: flex; gap: 10px; align-items: center;">
                <select id="repairBranchFilter" onchange="loadRepairs(true)" class="filter-select" required style="${isOwner ? 'display: block;' : 'display: none;'} min-width: 180px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--white); color: var(--text-dark); font-size: 0.95em; cursor: pointer; position: relative; z-index: 10;">
                    <option value="">اختر الفرع</option>
                </select>
                <button onclick="openBarcodeScanner()" class="btn btn-info btn-sm">
                    <i class="bi bi-upc-scan"></i> قارئ الباركود
                </button>
                <button onclick="showLossOperationModal()" class="btn btn-danger btn-sm">
                    <i class="bi bi-exclamation-triangle"></i> عملية خاسرة
                </button>
                <button onclick="showAddRepairModal()" class="btn btn-primary">
                    <i class="bi bi-plus-circle"></i> إضافة عملية جديدة
                </button>
            </div>
        </div>

        <div class="repair-type-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 10px;">
            <button onclick="switchRepairType('soft')" id="tab-soft" class="repair-type-tab active" style="flex: 1; padding: 12px 20px; background: var(--primary-color); color: var(--white); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-code-slash"></i> سوفت
            </button>
            <button onclick="switchRepairType('hard')" id="tab-hard" class="repair-type-tab" style="flex: 1; padding: 12px 20px; background: var(--light-bg); color: var(--text-dark); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-cpu"></i> هارد
            </button>
            <button onclick="switchRepairType('fast')" id="tab-fast" class="repair-type-tab" style="flex: 1; padding: 12px 20px; background: var(--light-bg); color: var(--text-dark); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-lightning-charge"></i> فاست
            </button>
        </div>

        <div class="filters-bar">
            <input type="text" id="repairSearch" placeholder="بحث..." class="search-input">
            <select id="statusFilter" onchange="filterRepairs()" class="filter-select">
                <option value="">جميع الحالات</option>
                <option value="received">تم الاستلام</option>
                <option value="under_inspection">قيد الفحص</option>
                <option value="awaiting_customer_approval">بانتظار موافقة العميل</option>
                <option value="in_progress">قيد الإصلاح</option>
                <option value="ready_for_delivery">جاهز للتسليم</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">عملية ملغية</option>
                <option value="lost">عملية خاسرة</option>
            </select>
        </div>

        <div class="table-container">
            <table class="data-table" id="repairsTable">
                <thead>
                    <tr>
                        <th>رقم العملية</th>
                        <th>العميل</th>
                        <th>الهاتف</th>
                        <th>الجهاز</th>
                        <th>المشكلة</th>
                        <th>التكلفة</th>
                        <th>الحالة</th>
                        <th>الفني المستلم</th>
                        <th>التاريخ</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="repairsTableBody"></tbody>
            </table>
        </div>

        <div class="pagination" id="repairsPagination"></div>

        <!-- نموذج إضافة/تعديل عملية -->
        <div id="repairModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="repairModalTitle">إضافة عملية صيانة جديدة</h3>
                    <button onclick="closeRepairModal()" class="btn-close">&times;</button>
                </div>
                <form id="repairForm" onsubmit="saveRepair(event)">
                    <input type="hidden" id="repairId">
                    <input type="hidden" id="selectedCustomerId">
                    
                    <h4 style="margin: 0 0 15px 0; color: var(--primary-color);">الفرع ونوع العميل</h4>
                    <div class="form-row">
                        <div class="form-group" id="repairBranchGroup" style="display: none;">
                            <label for="repairBranchSelect">الفرع *</label>
                            <select id="repairBranchSelect" required onchange="onRepairBranchChange()">
                                <option value="">اختر الفرع</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="customerType">نوع العميل *</label>
                            <select id="customerType" required onchange="onCustomerTypeChange()">
                                <option value="retail">عميل محل</option>
                                <option value="commercial">عميل تجاري</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="customerSource">حالة العميل *</label>
                            <select id="customerSource" required onchange="onCustomerSourceChange()">
                                <option value="new">عميل جديد</option>
                                <option value="existing">عميل مسجل</option>
                            </select>
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: var(--primary-color);">بيانات العميل</h4>
                    <div class="form-group" id="customerSelectGroup" style="display: none;">
                        <label for="customerSelect">اختر عميل من القائمة</label>
                        <div class="customer-search-wrapper" style="position: relative;">
                            <input type="text" id="customerSelect" class="customer-search-input" placeholder="ابحث بالاسم أو رقم الهاتف..." autocomplete="off" required>
                            <input type="hidden" id="selectedCustomerId" name="selectedCustomerId" value="">
                            <div id="customerDropdown" class="customer-dropdown" style="display: none;"></div>
                        </div>
                    </div>
                    
                    <div id="customerFieldsContainer">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="customerName">اسم العميل *</label>
                                <input type="text" id="customerName" required>
                            </div>
                            <div class="form-group">
                                <label for="customerPhone">رقم الهاتف *</label>
                                <input type="tel" id="customerPhone" required>
                            </div>
                        </div>
                        <div class="form-group" id="shopNameGroup" style="display: none;">
                            <label for="shopName">اسم المحل *</label>
                            <input type="text" id="shopName" placeholder="اسم المحل التجاري">
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: var(--primary-color);">بيانات الجهاز</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="deviceType">نوع الجهاز *</label>
                            <select id="deviceType" required onchange="handleDeviceTypeChange(this)">
                                <option value="">جاري التحميل...</option>
                            </select>
                            <input type="text" id="deviceTypeCustom" style="display: none; margin-top: 10px;" placeholder="أدخل الماركة يدوياً">
                        </div>
                        <div class="form-group">
                            <label for="deviceModel">الموديل</label>
                            <input type="text" id="deviceModel" placeholder="مثال: 14 Pro">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="serialNumber">Serial Number</label>
                            <input type="text" id="serialNumber" placeholder="الرقم التسلسلي">
                        </div>
                        <div class="form-group">
                            <label for="accessories">ملحقات الجهاز</label>
                            <input type="text" id="accessories" placeholder="مثال: شاحن، سماعات، كفر">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="problem">المشكلة *</label>
                        <textarea id="problem" rows="3" required></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="repairType">نوع الصيانة *</label>
                            <select id="repairType" required>
                                <option value="soft">سوفت</option>
                                <option value="hard">هارد</option>
                                <option value="fast">فاست</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>صورة الجهاز</label>
                            <div class="image-upload-container">
                                <input type="file" id="deviceImageFile" accept="image/*" style="display: none;" onchange="handleImageUpload(this)">
                                <button type="button" onclick="document.getElementById('deviceImageFile').click()" class="btn btn-secondary btn-sm">
                                    <i class="bi bi-upload"></i> رفع صورة
                                </button>
                                <button type="button" onclick="openCamera()" class="btn btn-primary btn-sm">
                                    <i class="bi bi-camera"></i> فتح الكاميرا
                                </button>
                                <span id="imageFileName" style="margin-right: 10px; font-size: 0.9em; color: var(--text-light);"></span>
                            </div>
                            <div id="imagePreview" style="margin-top: 10px;"></div>
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: #2196F3;">بيانات العملية</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="repairNumber">رقم العملية *</label>
                            <input type="text" id="repairNumber" required>
                        </div>
                        <div class="form-group">
                            <label for="technicianSelect">الفني المستلم *</label>
                            <select id="technicianSelect" required>
                                <option value="">جاري التحميل...</option>
                            </select>
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: var(--primary-color);">التكاليف والدفع</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="customerPrice">السعر للعميل *</label>
                            <input type="number" id="customerPrice" step="0.01" min="0" required onchange="calculateRemaining()">
                        </div>
                        <div class="form-group">
                            <label for="repairCost">تكلفة الإصلاح</label>
                            <input type="number" id="repairCost" step="0.01" min="0" value="0">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="partsStore">اسم محل قطع الغيار</label>
                        <input type="text" id="partsStore" placeholder="مثال: محل الأمين، متجر العربي">
                    </div>

                    <div class="form-group">
                        <label style="margin-bottom: 10px; display: block;">أرقام فواتير قطع الغيار</label>
                        <div id="sparePartsInvoicesContainer">
                            <div class="invoice-number-row" style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                                <input type="text" class="invoice-number-input" placeholder="رقم الفاتورة" style="flex: 1;">
                                <button type="button" class="btn btn-danger btn-sm remove-invoice-btn" onclick="removeInvoiceField(this)" style="display: none;">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="addInvoiceField()" style="margin-top: 5px;">
                            <i class="bi bi-plus-circle"></i> إضافة رقم فاتورة
                        </button>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="paidAmount">المبلغ المدفوع مقدماً</label>
                            <input type="number" id="paidAmount" step="0.01" min="0" value="0" onchange="calculateRemaining()">
                        </div>
                        <div class="form-group">
                            <label for="remainingAmount">المتبقي</label>
                            <input type="number" id="remainingAmount" step="0.01" readonly style="background: #f5f5f5;">
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: var(--primary-color);">معلومات إضافية</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="deliveryDate">تاريخ التسليم المتوقع</label>
                            <input type="date" id="deliveryDate">
                        </div>
                        <div class="form-group">
                            <label for="status">الحالة</label>
                            <select id="status">
                                <option value="received">تم الاستلام</option>
                                <option value="under_inspection">قيد الفحص</option>
                                <option value="awaiting_customer_approval">بانتظار موافقة العميل</option>
                                <option value="in_progress">قيد الإصلاح</option>
                                <option value="ready_for_delivery">جاهز للتسليم</option>
                                <option value="delivered">تم التسليم</option>
                                <option value="cancelled">عملية ملغية</option>
                                <option value="lost">عملية خاسرة</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="notes">ملاحظات</label>
                        <textarea id="notes" rows="2"></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeRepairModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // تحميل الفروع أولاً (للمالك فقط) ثم تحميل العمليات
    console.log('🔍 [Repairs] loadRepairsSection - Current User:', currentUser);
    console.log('🔍 [Repairs] loadRepairsSection - Is Owner:', isOwner);
    
    if (isOwner) {
        console.log('🔄 [Repairs] بدء تحميل الفروع للمالك...');
        // استخدام requestAnimationFrame لضمان أن DOM جاهز تماماً
        requestAnimationFrame(() => {
            setTimeout(async () => {
                try {
                    console.log('🔄 [Repairs] استدعاء loadRepairBranches()...');
                    await loadRepairBranches(true); // force = true للتأكد من التحميل
                    console.log('✅ [Repairs] تم تحميل الفروع بنجاح');
                    
                    // ✅ تحسين: تحديد فرع افتراضي إذا لم يكن هناك فرع محدد
                    const branchFilter = document.getElementById('repairBranchFilter');
                    if (branchFilter) {
                        if (selectedRepairBranchId) {
                            // إعادة تطبيق الفرع المحدد إذا كان موجوداً
                            branchFilter.value = selectedRepairBranchId;
                        } else if (repairFirstBranchId) {
                            // ✅ تحديد الفرع الأول كافتراضي
                            branchFilter.value = repairFirstBranchId;
                            selectedRepairBranchId = repairFirstBranchId;
                            console.log('✅ [Repairs] تم تحديد الفرع الأول كافتراضي:', repairFirstBranchId);
                        }
                    }
                    
                    loadRepairs();
                    // تهيئة القسم النشط
                    switchRepairType(currentRepairType);
                } catch (error) {
                    console.error('❌ [Repairs] خطأ في تحميل الفروع:', error);
                    console.error('❌ [Repairs] تفاصيل الخطأ:', error.stack);
                    // في حالة الخطأ، تحميل العمليات بدون فلترة
                    loadRepairs();
                    switchRepairType(currentRepairType);
                }
            }, 200); // زيادة الوقت لضمان جاهزية DOM
        });
    } else {
        console.log('ℹ️ [Repairs] المستخدم ليس مالك، تخطي تحميل الفروع');
        // ✅ تحسين: مسح selectedRepairBranchId للموظفين
        selectedRepairBranchId = null;
        loadRepairs();
        // تهيئة القسم النشط
        switchRepairType(currentRepairType);
    }
    
    searchTable('repairSearch', 'repairsTable');
    
    // تحميل الفنيين
    const branchId = getCurrentRepairBranchId();
    if (branchId) {
        await loadRepairTechnicians(branchId);
    } else {
        // إذا لم يكن هناك فرع محدد، جلب جميع المالكين
        await loadRepairTechnicians(null);
    }
}

// جلب الفنيين حسب الفرع المحدد
async function loadRepairTechnicians(branchId) {
    try {
        // إذا لم يكن هناك فرع محدد، استخدام فرع المستخدم الحالي
        if (!branchId) {
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.branch_id) {
                branchId = currentUser.branch_id;
            }
        }
        
        // جلب الفنيين والمالكين من API
        try {
            let url = 'technicians.php?include_admins=true';
            if (branchId) {
                url += `&branch_id=${encodeURIComponent(branchId)}`;
            }
            
            const techniciansResult = await API.request(url, 'GET');
            if (techniciansResult && techniciansResult.success && techniciansResult.data) {
                repairTechnicians = techniciansResult.data;
            } else {
                repairTechnicians = [];
            }
        } catch (error) {
            console.error('⚠️ خطأ في جلب الفنيين:', error);
            repairTechnicians = [];
        }
        
        // تحديث dropdown الفنيين
        updateTechnicianSelect();
    } catch (error) {
        console.error('خطأ في جلب الفنيين:', error);
        repairTechnicians = [];
        updateTechnicianSelect();
    }
}

// تحديث dropdown الفنيين
function updateTechnicianSelect() {
    const technicianSelect = document.getElementById('technicianSelect');
    if (!technicianSelect) return;
    
    // حفظ القيمة المحددة حالياً
    const currentValue = technicianSelect.value;
    
    technicianSelect.innerHTML = '<option value="">اختر الفني...</option>';
    
    if (repairTechnicians.length === 0) {
        technicianSelect.innerHTML = '<option value="">لا يوجد فنيين متاحين</option>';
        return;
    }
    
    // ترتيب الفنيين: المالكين أولاً ثم الفنيين
    const sortedTechnicians = [...repairTechnicians].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return (a.name || '').localeCompare(b.name || '');
    });
    
    sortedTechnicians.forEach(technician => {
        const option = document.createElement('option');
        option.value = technician.id;
        const roleText = technician.role === 'admin' ? 'مالك' : 'فني صيانة';
        option.textContent = `${technician.name || ''} (${roleText})`;
        technicianSelect.appendChild(option);
    });
    
    // استعادة القيمة المحددة إذا كانت موجودة
    if (currentValue && technicianSelect.querySelector(`option[value="${currentValue}"]`)) {
        technicianSelect.value = currentValue;
    } else {
        // تحديد المستخدم الحالي كافتراضي إذا كان متاحاً
        const currentUser = getCurrentUser();
        if (currentUser && technicianSelect.querySelector(`option[value="${currentUser.id}"]`)) {
            technicianSelect.value = currentUser.id;
        }
    }
}

// ========== دوال العملاء ==========

// جلب العملاء حسب الفرع ونوع العميل
async function loadRepairCustomers(branchId, customerType) {
    try {
        if (!branchId && !customerType) {
            repairCustomers = [];
            updateCustomerSelect();
            return;
        }
        
        // للمستخدمين العاديين، استخدام branch_id الخاص بهم
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        let targetBranchId = branchId;
        if (!isOwner) {
            targetBranchId = currentUser.branch_id || null;
        }
        
        if (!targetBranchId) {
            repairCustomers = [];
            updateCustomerSelect();
            return;
        }
        
        const url = `customers.php?type=${customerType}&branch_id=${encodeURIComponent(targetBranchId)}`;
        const result = await API.request(url, 'GET');
        
        if (result && result.success && result.data) {
            repairCustomers = result.data || [];
            updateCustomerSelect();
            // إعداد البحث بعد تحديث القائمة
            setTimeout(() => setupCustomerSearch(), 100);
        } else {
            repairCustomers = [];
            updateCustomerSelect();
            setTimeout(() => setupCustomerSearch(), 100);
        }
    } catch (error) {
        console.error('خطأ في جلب العملاء:', error);
        repairCustomers = [];
        updateCustomerSelect();
        setTimeout(() => setupCustomerSearch(), 100);
    }
}

// تحديث dropdown العملاء
function updateCustomerSelect() {
    const customerSelect = document.getElementById('customerSelect');
    if (!customerSelect) return;
    
    const currentType = document.getElementById('customerType')?.value || 'retail';
    const currentBranchId = getCurrentRepairBranchId();
    
    // إذا لم يكن هناك فرع محدد، امسح القائمة
    if (!currentBranchId) {
        customerSelect.value = '';
        customerSelect.placeholder = '-- اختر عميل --';
        hideCustomerDropdown();
        return;
    }
    
    // فلترة العملاء حسب النوع
    const filteredCustomers = repairCustomers.filter(c => {
        const customerType = c.customer_type || 'retail';
        return customerType === currentType;
    });
    
    // حفظ القيمة المحددة حالياً
    const selectedCustomerId = document.getElementById('selectedCustomerId')?.value || '';
    
    // إذا كان هناك عميل محدد، عرض اسمه
    if (selectedCustomerId) {
        const selectedCustomer = filteredCustomers.find(c => c.id === selectedCustomerId);
        if (selectedCustomer) {
            if (currentType === 'commercial' && selectedCustomer.shop_name) {
                customerSelect.value = `${selectedCustomer.name} - ${selectedCustomer.shop_name} (${selectedCustomer.phone})`;
            } else {
                customerSelect.value = `${selectedCustomer.name} (${selectedCustomer.phone})`;
            }
        }
    } else {
        customerSelect.value = '';
    }
    
    // إعداد البحث (سيتم استدعاؤه تلقائياً عند الحاجة)
    // setupCustomerSearch سيتم استدعاؤه من onCustomerSourceChange
}

// إعداد البحث عن العملاء
let customerSearchInitialized = false;
function setupCustomerSearch() {
    const customerSelect = document.getElementById('customerSelect');
    if (!customerSelect || customerSelect.tagName !== 'INPUT') return;
    
    // تجنب إعادة إعداد البحث إذا كان معدداً بالفعل
    if (customerSearchInitialized) return;
    customerSearchInitialized = true;
    
    // إضافة مستمع البحث مع debounce
    const debouncedSearch = debounce(handleCustomerSearch, 300);
    customerSelect.addEventListener('input', debouncedSearch);
    customerSelect.addEventListener('focus', handleCustomerSearch);
    customerSelect.addEventListener('blur', () => {
        // تأخير إخفاء القائمة للسماح بالنقر على العناصر
        setTimeout(() => {
            hideCustomerDropdown();
        }, 200);
    });
    
    // إغلاق القائمة عند النقر خارجها (مرة واحدة فقط)
    const handleDocumentClick = (e) => {
        const wrapper = document.querySelector('.customer-search-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            hideCustomerDropdown();
        }
    };
    document.addEventListener('click', handleDocumentClick);
}

// البحث عن العملاء
function handleCustomerSearch() {
    const customerSelect = document.getElementById('customerSelect');
    if (!customerSelect || customerSelect.tagName !== 'INPUT') return;
    
    const searchTerm = customerSelect.value.trim().toLowerCase();
    const currentType = document.getElementById('customerType')?.value || 'retail';
    const currentBranchId = getCurrentRepairBranchId();
    
    if (!currentBranchId) {
        hideCustomerDropdown();
        return;
    }
    
    // فلترة العملاء حسب النوع
    let filteredCustomers = repairCustomers.filter(c => {
        const customerType = c.customer_type || 'retail';
        return customerType === currentType;
    });
    
    // البحث بالاسم أو رقم الهاتف
    if (searchTerm) {
        filteredCustomers = filteredCustomers.filter(customer => {
            const name = (customer.name || '').toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            const shopName = (customer.shop_name || '').toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm) || shopName.includes(searchTerm);
        });
    }
    
    // عرض النتائج
    renderCustomerDropdown(filteredCustomers);
}

// عرض قائمة العملاء في dropdown
function renderCustomerDropdown(customers) {
    const dropdown = document.getElementById('customerDropdown');
    if (!dropdown) return;
    
    if (customers.length === 0) {
        dropdown.innerHTML = '<div class="customer-dropdown-empty">لا توجد نتائج</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    const currentType = document.getElementById('customerType')?.value || 'retail';
    const fragment = document.createDocumentFragment();
    
    customers.forEach(customer => {
        const item = document.createElement('div');
        item.className = 'customer-dropdown-item';
        item.dataset.customerId = customer.id;
        
        let displayText = '';
        if (currentType === 'commercial' && customer.shop_name) {
            displayText = `
                <div class="customer-name">${escapeHtml(customer.name)} - ${escapeHtml(customer.shop_name)}</div>
                <div class="customer-phone">${escapeHtml(customer.phone)}</div>
            `;
        } else {
            displayText = `
                <div class="customer-name">${escapeHtml(customer.name)}</div>
                <div class="customer-phone">${escapeHtml(customer.phone)}</div>
            `;
        }
        
        item.innerHTML = displayText;
        
        item.addEventListener('click', () => {
            selectCustomer(customer.id);
        });
        
        fragment.appendChild(item);
    });
    
    dropdown.innerHTML = '';
    dropdown.appendChild(fragment);
    dropdown.style.display = 'block';
}

// اختيار عميل
function selectCustomer(customerId) {
    const customerSelect = document.getElementById('customerSelect');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    if (!customerSelect || !selectedCustomerIdInput) return;
    
    const currentType = document.getElementById('customerType')?.value || 'retail';
    const customer = repairCustomers.find(c => c.id === customerId);
    
    if (!customer) return;
    
    // حفظ ID العميل
    selectedCustomerIdInput.value = customerId;
    
    // عرض اسم العميل
    if (currentType === 'commercial' && customer.shop_name) {
        customerSelect.value = `${customer.name} - ${customer.shop_name} (${customer.phone})`;
    } else {
        customerSelect.value = `${customer.name} (${customer.phone})`;
    }
    
    // إخفاء القائمة
    hideCustomerDropdown();
    
    // استدعاء دالة تغيير العميل
    onCustomerSelectChange();
}

// إخفاء dropdown العملاء
function hideCustomerDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// دالة مساعدة لتهريب HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// الحصول على branch_id الحالي المحدد في النموذج
function getCurrentRepairBranchId() {
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    if (isOwner) {
        const branchSelect = document.getElementById('repairBranchSelect');
        return branchSelect ? branchSelect.value || null : null;
    } else {
        return currentUser.branch_id || null;
    }
}

// عند تغيير الفرع
async function onRepairBranchChange() {
    const branchId = getCurrentRepairBranchId();
    const customerType = document.getElementById('customerType')?.value || 'retail';
    
    if (branchId) {
        await loadRepairCustomers(branchId, customerType);
        await loadRepairTechnicians(branchId);
    } else {
        repairCustomers = [];
        updateCustomerSelect();
        await loadRepairTechnicians(null); // جلب المالكين فقط
    }
}

// عند تغيير نوع العميل
async function onCustomerTypeChange() {
    const branchId = getCurrentRepairBranchId();
    const customerType = document.getElementById('customerType')?.value || 'retail';
    
    // إظهار/إخفاء حقل اسم المحل
    const shopNameGroup = document.getElementById('shopNameGroup');
    if (shopNameGroup) {
        shopNameGroup.style.display = customerType === 'commercial' ? 'block' : 'none';
        const shopNameInput = document.getElementById('shopName');
        if (shopNameInput) {
            shopNameInput.required = customerType === 'commercial';
            if (customerType !== 'commercial') {
                shopNameInput.value = '';
            }
        }
    }
    
    // تحديث قائمة العملاء فقط إذا كان نوع الإدخال هو "عميل مسجل"
    const customerSource = document.getElementById('customerSource')?.value || 'new';
    if (customerSource === 'existing') {
        updateCustomerSelect();
        
        // إذا كان هناك فرع محدد، جلب العملاء
        if (branchId) {
            await loadRepairCustomers(branchId, customerType);
        } else {
            repairCustomers = [];
            updateCustomerSelect();
        }
    }
    
    // مسح الحقول عند تغيير النوع
    clearCustomerFields();
}

// عند تغيير نوع الإدخال (عميل جديد / عميل مسجل)
function onCustomerSourceChange() {
    try {
        const customerSource = document.getElementById('customerSource')?.value || 'new';
        const customerSelectGroup = document.getElementById('customerSelectGroup');
        const customerFieldsContainer = document.getElementById('customerFieldsContainer');
        const customerNameInput = document.getElementById('customerName');
        const customerPhoneInput = document.getElementById('customerPhone');
        const customerSelect = document.getElementById('customerSelect');
        
        if (customerSource === 'existing') {
            // إظهار اختيار العميل من القائمة
            if (customerSelectGroup) {
                customerSelectGroup.style.display = 'block';
            }
            // إخفاء حقول إضافة العميل
            if (customerFieldsContainer) {
                customerFieldsContainer.style.display = 'none';
            }
            // جعل حقول الإدخال غير مطلوبة
            if (customerNameInput) {
                customerNameInput.required = false;
            }
            if (customerPhoneInput) {
                customerPhoneInput.required = false;
            }
            // جعل اختيار العميل مطلوب
            if (customerSelect && customerSelect.tagName === 'INPUT') {
                customerSelect.required = true;
            }
            // مسح حقول الإدخال
            clearCustomerFields();
            
            // تحميل العملاء إذا كان هناك فرع محدد
            const branchId = getCurrentRepairBranchId();
            const customerType = document.getElementById('customerType')?.value || 'retail';
            if (branchId) {
                loadRepairCustomers(branchId, customerType).then(() => {
                    setupCustomerSearch();
                }).catch(error => {
                    console.error('خطأ في تحميل العملاء:', error);
                });
            } else {
                setupCustomerSearch();
            }
        } else {
            // إخفاء اختيار العميل من القائمة
            if (customerSelectGroup) {
                customerSelectGroup.style.display = 'none';
            }
            // إظهار حقول إضافة العميل
            if (customerFieldsContainer) {
                customerFieldsContainer.style.display = 'block';
            }
            // جعل حقول الإدخال مطلوبة
            if (customerNameInput) {
                customerNameInput.required = true;
            }
            if (customerPhoneInput) {
                customerPhoneInput.required = true;
            }
            // جعل اختيار العميل غير مطلوب
            if (customerSelect && customerSelect.tagName === 'INPUT') {
                customerSelect.required = false;
                customerSelect.value = '';
            }
            // مسح اختيار العميل
            const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
            if (selectedCustomerIdInput) {
                selectedCustomerIdInput.value = '';
            }
            hideCustomerDropdown();
        }
    } catch (error) {
        console.error('خطأ في تغيير نوع الإدخال:', error);
    }
}

// عند اختيار عميل من القائمة
function onCustomerSelectChange() {
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    if (!selectedCustomerIdInput || !selectedCustomerIdInput.value) {
        clearCustomerFields();
        return;
    }
    
    const customerId = selectedCustomerIdInput.value;
    const customer = repairCustomers.find(c => c.id === customerId);
    
    if (customer) {
        document.getElementById('customerName').value = customer.name || '';
        document.getElementById('customerPhone').value = customer.phone || '';
        
        const customerType = document.getElementById('customerType')?.value || 'retail';
        if (customerType === 'commercial' && customer.shop_name) {
            const shopNameInput = document.getElementById('shopName');
            if (shopNameInput) {
                shopNameInput.value = customer.shop_name || '';
            }
        }
    } else {
        clearCustomerFields();
    }
}

// مسح اختيار العميل (محذوفة - لم تعد مستخدمة)
// function clearCustomerSelection() {
//     const customerSelect = document.getElementById('customerSelect');
//     if (customerSelect) {
//         customerSelect.value = '';
//     }
//     document.getElementById('selectedCustomerId').value = '';
//     clearCustomerFields();
// }

// مسح حقول بيانات العميل
function clearCustomerFields() {
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    const shopNameInput = document.getElementById('shopName');
    if (shopNameInput) {
        shopNameInput.value = '';
    }
}

// ✅ تحسين الأداء: تحميل الفروع بنفس طريقة expenses.js و customers.js
async function loadRepairBranches(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingRepairBranches && !force) {
        console.log('⏸️ [Repairs] تحميل الفروع قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastRepairBranchesLoadTime) < REPAIR_MIN_LOAD_INTERVAL) {
        console.log('⏸️ [Repairs] تم تحميل الفروع مؤخراً، تخطي الطلب');
        return;
    }
    
    // ✅ تحسين الأداء: استخدام cache إذا كان متاحاً
    if (!force && repairBranches && repairBranches.length > 0) {
        console.log('✅ [Repairs] استخدام الفروع من الكاش');
        updateRepairBranchFilters();
        return;
    }
    
    isLoadingRepairBranches = true;
    lastRepairBranchesLoadTime = now;
    
    try {
        console.log('🔄 [Repairs] بدء تحميل الفروع...');
        // جلب جميع الفروع النشطة
        const result = await API.request('branches.php', 'GET');
        console.log('📥 [Repairs] استجابة API:', result);
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            repairBranches = result.data;
            console.log(`📊 [Repairs] تم جلب ${repairBranches.length} فرع من API`);
            
            // تحديد الفرع الأول (للاستخدام الافتراضي)
            if (repairBranches.length > 0) {
                // ترتيب حسب created_at أو id
                const sortedBranches = [...repairBranches].sort((a, b) => {
                    const dateA = new Date(a.created_at || 0);
                    const dateB = new Date(b.created_at || 0);
                    if (dateA.getTime() !== dateB.getTime()) {
                        return dateA.getTime() - dateB.getTime();
                    }
                    return (a.id || '').localeCompare(b.id || '');
                });
                repairFirstBranchId = sortedBranches[0].id;
                console.log(`✅ [Repairs] الفرع الأول: ${sortedBranches[0].name} (${repairFirstBranchId})`);
            }
            
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            
            // ملء Branch Filter في section-header - ملء الفروع دائماً (سيتم التحقق من isOwner عند العرض)
            // إعادة المحاولة إذا لم يكن العنصر جاهزاً بعد
            let branchFilter = document.getElementById('repairBranchFilter');
            let retries = 0;
            const maxRetries = 10;
            
            // إذا لم يكن العنصر موجوداً، ننتظر قليلاً ثم نحاول مرة أخرى
            while (!branchFilter && retries < maxRetries) {
                console.log(`⏳ [Repairs] انتظار repairBranchFilter في DOM، المحاولة ${retries + 1}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                branchFilter = document.getElementById('repairBranchFilter');
                retries++;
            }
            
            if (branchFilter) {
                console.log('🔍 [Repairs] تم العثور على repairBranchFilter في DOM');
                console.log('📊 [Repairs] عدد الفروع المتاحة:', repairBranches?.length || 0);
                
                // ✅ مسح الخيارات الحالية (بدون خيار "جميع الفروع")
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                
                if (repairBranches && repairBranches.length > 0) {
                    repairBranches.forEach((branch, index) => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchFilter.appendChild(option);
                        console.log(`  ✅ [${index + 1}] تمت إضافة: ${branch.name} (ID: ${branch.id})`);
                    });
                    console.log(`✅ [Repairs] تم تحميل ${repairBranches.length} فرع في repairBranchFilter`);
                    console.log(`🔍 [Repairs] عدد الخيارات في الـ select: ${branchFilter.options.length}`);
                    
                    // للمالك: ضبط الفرع الأول كقيمة افتراضية
                    if (isOwner && repairFirstBranchId) {
                        branchFilter.value = repairFirstBranchId;
                        console.log(`✅ [Repairs] تم تعيين الفرع الأول كقيمة افتراضية للمالك: ${repairFirstBranchId}`);
                    }
                } else {
                    console.warn('⚠️ [Repairs] لا توجد فروع متاحة لتحميلها في repairBranchFilter');
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    branchFilter.style.display = 'block';
                    branchFilter.style.visibility = 'visible';
                    branchFilter.style.opacity = '1';
                    console.log('✅ [Repairs] تم إظهار repairBranchFilter للمالك');
                } else {
                    branchFilter.style.display = 'none';
                }
            } else {
                console.error(`❌ [Repairs] العنصر repairBranchFilter غير موجود في DOM بعد ${maxRetries} محاولة`);
                // محاولة أخيرة بعد تأخير أطول
                setTimeout(async () => {
                    const retryElement = document.getElementById('repairBranchFilter');
                    if (retryElement && repairBranches && repairBranches.length > 0) {
                        console.log('🔄 [Repairs] محاولة أخيرة لملء repairBranchFilter');
                        retryElement.innerHTML = '<option value="">اختر الفرع</option>';
                        repairBranches.forEach(branch => {
                            const option = document.createElement('option');
                            option.value = branch.id;
                            option.textContent = branch.name;
                            retryElement.appendChild(option);
                        });
                        if (isOwner && repairFirstBranchId) {
                            retryElement.value = repairFirstBranchId;
                        }
                        if (isOwner) {
                            retryElement.style.display = 'block';
                        }
                    }
                }, 500);
            }
            
            // ملء Branch Select في نموذج إضافة العملية - ملء الفروع دائماً (سيتم التحقق من isOwner عند فتح النموذج)
            const branchSelect = document.getElementById('repairBranchSelect');
            const branchGroup = document.getElementById('repairBranchGroup');
            if (branchSelect && branchGroup) {
                // حفظ القيمة الحالية إذا كانت موجودة
                const currentValue = branchSelect.value;
                branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                
                if (repairBranches && repairBranches.length > 0) {
                    repairBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchSelect.appendChild(option);
                    });
                    console.log(`✅ [Repairs] تم تحميل ${repairBranches.length} فرع في قائمة repairBranchSelect`);
                    
                    // تحديد الفرع الأول كقيمة افتراضية للمالك
                    if (isOwner && repairFirstBranchId) {
                        branchSelect.value = repairFirstBranchId;
                    }
                } else {
                    console.warn('⚠️ [Repairs] لا توجد فروع متاحة للتحميل');
                }
                
                // استعادة القيمة إذا كانت موجودة
                if (currentValue) {
                    branchSelect.value = currentValue;
                }
                
                // إظهار/إخفاء حسب نوع المستخدم
                if (isOwner) {
                    branchGroup.style.display = 'block';
                    branchSelect.required = true;
                } else {
                    branchGroup.style.display = 'none';
                    branchSelect.required = false;
                }
            } else {
                // العنصر غير موجود - هذا طبيعي إذا كان النموذج غير مفتوح
                console.log('ℹ️ [Repairs] العنصر repairBranchSelect غير موجود في DOM (قد يكون النموذج غير مفتوح)');
            }
        } else {
            console.warn('⚠️ [Repairs] لم يتم العثور على فروع أو البيانات غير صحيحة:', result);
            // إظهار رسالة خطأ للمستخدم
            if (result && !result.success) {
                console.error('❌ [Repairs] خطأ من API:', result.message || 'خطأ غير معروف');
            } else if (!result) {
                console.error('❌ [Repairs] لم يتم الحصول على استجابة من API');
            } else if (!result.data) {
                console.error('❌ [Repairs] لا توجد بيانات في الاستجابة');
            } else if (!Array.isArray(result.data)) {
                console.error('❌ [Repairs] البيانات ليست مصفوفة:', typeof result.data, result.data);
            }
        }
    } catch (error) {
        console.error('❌ [Repairs] خطأ في تحميل الفروع:', error);
        showMessage('حدث خطأ أثناء تحميل الفروع. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        isLoadingRepairBranches = false;
    }
}

// ✅ تحسين الأداء: دالة مساعدة لتحديث فلاتر الفروع من البيانات المحفوظة
function updateRepairBranchFilters() {
    try {
        console.log('🔄 [Repairs] تحديث فلاتر الفروع من الكاش...');
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        console.log('📊 [Repairs] عدد الفروع في الكاش:', repairBranches?.length || 0);
        
        const branchFilter = document.getElementById('repairBranchFilter');
        if (branchFilter) {
            console.log('🔍 [Repairs] تم العثور على repairBranchFilter في updateRepairBranchFilters');
            if (repairBranches && repairBranches.length > 0) {
                const currentValue = branchFilter.value;
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                repairBranches.forEach((branch, index) => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchFilter.appendChild(option);
                    console.log(`  ✅ [${index + 1}] تمت إضافة: ${branch.name} (ID: ${branch.id})`);
                });
                if (currentValue) branchFilter.value = currentValue;
                branchFilter.style.display = isOwner ? 'block' : 'none';
                console.log(`✅ [Repairs] تم تحديث repairBranchFilter بـ ${repairBranches.length} فرع`);
            } else {
                console.warn('⚠️ [Repairs] لا توجد فروع في الكاش لتحديث الفلاتر');
            }
        } else {
            console.warn('⚠️ [Repairs] العنصر repairBranchFilter غير موجود في DOM في updateRepairBranchFilters');
        }
        
        const branchSelect = document.getElementById('repairBranchSelect');
        const branchGroup = document.getElementById('repairBranchGroup');
        if (branchSelect && branchGroup && repairBranches && repairBranches.length > 0) {
            const currentValue = branchSelect.value;
            branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
            repairBranches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.id;
                option.textContent = branch.name;
                branchSelect.appendChild(option);
            });
            if (currentValue) branchSelect.value = currentValue;
        }
    } catch (error) {
        console.error('❌ [Repairs] خطأ في تحديث فلاتر الفروع:', error);
    }
}

// تحميل الفروع - للمالك فقط (deprecated - استخدام loadRepairBranches بدلاً منها)
// تحميل الفروع - deprecated - استخدام loadRepairBranches بدلاً منها
async function loadBranches() {
    // استدعاء الدالة الجديدة
    return await loadRepairBranches(true);
}

// الدالة القديمة - deprecated
async function loadBranches_OLD() {
    try {
        console.log('🔄 [Repairs] بدء تحميل الفروع...');
        console.log('🔄 [Repairs] استدعاء API.request("branches.php", "GET", null, { silent: true })');
        const result = await API.request('branches.php', 'GET', null, { silent: true });
        console.log('📥 [Repairs] استجابة API:', result);
        
        if (!result) {
            console.error('❌ [Repairs] API request لم يُرجع نتيجة');
            return;
        }
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            // حفظ الفروع في المتغير العام
            repairBranches = result.data;
            console.log(`📊 [Repairs] تم جلب ${repairBranches.length} فرع من API`);
            console.log('📊 [Repairs] الفروع:', repairBranches);
            
            // تحديد الفرع الأول (للاستخدام الافتراضي)
            if (repairBranches.length > 0) {
                // ترتيب حسب created_at أو id
                const sortedBranches = [...repairBranches].sort((a, b) => {
                    const dateA = new Date(a.created_at || 0);
                    const dateB = new Date(b.created_at || 0);
                    if (dateA.getTime() !== dateB.getTime()) {
                        return dateA.getTime() - dateB.getTime();
                    }
                    return (a.id || '').localeCompare(b.id || '');
                });
                repairFirstBranchId = sortedBranches[0].id;
                console.log(`🔍 [Repairs] الفرع الأول: ${sortedBranches[0].name} (${repairFirstBranchId})`);
            }
            
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            console.log('🔍 [Repairs] isOwner:', isOwner);
            
            // ملء Branch Filter في section-header - ملء الفروع دائماً
            const branchFilter = document.getElementById('repairBranchFilter');
            if (branchFilter) {
                console.log('🔍 [Repairs] تم العثور على repairBranchFilter في DOM');
                console.log('🔍 [Repairs] عدد الفروع المتاحة:', repairBranches?.length || 0);
                
                // ✅ مسح الخيارات الحالية (بدون خيار "جميع الفروع")
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                console.log('🔍 [Repairs] تم مسح الخيارات، عدد الخيارات الآن:', branchFilter.options.length);
                
                if (repairBranches && repairBranches.length > 0) {
                    console.log('🔍 [Repairs] بدء إضافة الفروع...');
                    repairBranches.forEach((branch, index) => {
                        console.log(`🔍 [Repairs] إضافة فرع ${index + 1}: ${branch.name} (${branch.id})`);
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchFilter.appendChild(option);
                        console.log(`  ✅ تمت إضافة الخيار: ${option.value} - ${option.textContent}`);
                    });
                    console.log(`✅ تم تحميل ${repairBranches.length} فرع في repairBranchFilter`);
                    console.log('🔍 [Repairs] عدد الخيارات بعد الإضافة:', branchFilter.options.length);
                    
                    // التحقق من أن الفروع تمت إضافتها
                    if (branchFilter.options.length <= 1) {
                        console.error('❌ [Repairs] المشكلة: الفروع لم تُضف بشكل صحيح!');
                        console.error('❌ [Repairs] عدد الخيارات:', branchFilter.options.length);
                        console.error('❌ [Repairs] الفروع:', repairBranches);
                    } else {
                        console.log(`✅ [Repairs] تم إضافة ${branchFilter.options.length - 1} فرع بنجاح`);
                        // طباعة جميع الخيارات للتأكد
                        for (let i = 0; i < branchFilter.options.length; i++) {
                            console.log(`  - Option ${i}: value="${branchFilter.options[i].value}", text="${branchFilter.options[i].text}"`);
                        }
                    }
                    
                    // للمالك: ضبط الفرع الأول كقيمة افتراضية (الهانوفيل)
                    if (isOwner && repairFirstBranchId) {
                        branchFilter.value = repairFirstBranchId;
                        console.log(`✅ تم تعيين الفرع الأول كقيمة افتراضية للمالك: ${repairFirstBranchId}`);
                    }
                } else {
                    console.warn('⚠️ لا توجد فروع متاحة لتحميلها في repairBranchFilter');
                    console.warn('⚠️ repairBranches:', repairBranches);
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    branchFilter.style.display = 'block';
                    console.log('✅ [Repairs] تم إظهار repairBranchFilter للمالك');
                } else {
                    branchFilter.style.display = 'none';
                }
            } else {
                console.warn('⚠️ العنصر repairBranchFilter غير موجود في DOM - سيتم إعادة المحاولة...');
                // إعادة المحاولة بعد تأخير قصير
                setTimeout(() => {
                    const retryBranchFilter = document.getElementById('repairBranchFilter');
                    if (retryBranchFilter && repairBranches && repairBranches.length > 0) {
                        console.log('🔄 [Repairs] إعادة المحاولة لملء repairBranchFilter...');
                        retryBranchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                        repairBranches.forEach(branch => {
                            const option = document.createElement('option');
                            option.value = branch.id;
                            option.textContent = branch.name;
                            retryBranchFilter.appendChild(option);
                        });
                        if (isOwner && repairFirstBranchId) {
                            retryBranchFilter.value = repairFirstBranchId;
                        }
                        if (isOwner) {
                            retryBranchFilter.style.display = 'block';
                        }
                        console.log(`✅ [Repairs] تم ملء ${repairBranches.length} فرع في المحاولة الثانية`);
                    } else if (!retryBranchFilter) {
                        console.error('❌ [Repairs] العنصر repairBranchFilter غير موجود حتى بعد إعادة المحاولة');
                    } else if (!repairBranches || repairBranches.length === 0) {
                        console.error('❌ [Repairs] لا توجد فروع متاحة للتحميل');
                    }
                }, 500);
            }
            
            // ملء Branch Select في نموذج إضافة العملية - للمالك فقط
            const branchSelect = document.getElementById('repairBranchSelect');
            const branchGroup = document.getElementById('repairBranchGroup');
            if (branchSelect && branchGroup) {
                branchSelect.innerHTML = '<option value="">اختر الفرع</option>';
                if (repairBranches && repairBranches.length > 0) {
                    repairBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchSelect.appendChild(option);
                    });
                    
                    // تحديد الفرع الأول كقيمة افتراضية للمالك
                    if (isOwner && repairFirstBranchId) {
                        branchSelect.value = repairFirstBranchId;
                    }
                }
                
                // إظهار/إخفاء حسب نوع المستخدم
                if (isOwner) {
                    branchGroup.style.display = 'block';
                    branchSelect.required = true;
                } else {
                    branchGroup.style.display = 'none';
                    branchSelect.required = false;
                }
            }
        } else {
            console.error('❌ [Repairs] استجابة API غير صحيحة أو لا تحتوي على بيانات');
            console.error('❌ [Repairs] result:', result);
            console.error('❌ [Repairs] result.success:', result?.success);
            console.error('❌ [Repairs] result.data:', result?.data);
            const branchFilter = document.getElementById('repairBranchFilter');
            if (branchFilter) {
                const currentUser = getCurrentUser();
                const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
                if (isOwner) {
                    branchFilter.style.display = 'block';
                }
            }
        }
    } catch (error) {
        console.error('❌ [Repairs] خطأ في تحميل الفروع:', error);
        console.error('❌ [Repairs] Stack trace:', error.stack);
        // إظهار القائمة المنسدلة بدون خيارات في حالة الخطأ
        const branchFilter = document.getElementById('repairBranchFilter');
        if (branchFilter) {
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            if (isOwner) {
                branchFilter.style.display = 'block';
            }
        }
    }
}

async function loadRepairs(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingRepairs && !force) {
        console.log('⏸️ [Repairs] تحميل العمليات قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastRepairsLoadTime) < REPAIRS_MIN_LOAD_INTERVAL) {
        console.log('⏸️ [Repairs] تم تحميل العمليات مؤخراً، تخطي الطلب');
        return;
    }
    
    isLoadingRepairs = true;
    lastRepairsLoadTime = now;
    
    try {
        // ✅ تحسين: الحصول على branch_id المختار (مطلوب دائماً للمالك)
        let branchId = selectedRepairBranchId;
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        if (isOwner) {
            const branchFilter = document.getElementById('repairBranchFilter');
            if (branchFilter) {
                // إذا كان هناك قيمة في DOM، نستخدمها ونحدث selectedRepairBranchId
                if (branchFilter.value) {
                    branchId = branchFilter.value;
                    selectedRepairBranchId = branchId;
                } else if (selectedRepairBranchId) {
                    // إذا لم تكن هناك قيمة في DOM لكن selectedRepairBranchId موجود، نعيد تطبيقها
                    branchFilter.value = selectedRepairBranchId;
                    branchId = selectedRepairBranchId;
                } else if (repairFirstBranchId) {
                    // ✅ إذا لم يكن هناك فرع محدد، نستخدم الفرع الأول كافتراضي
                    branchId = repairFirstBranchId;
                    selectedRepairBranchId = branchId;
                    branchFilter.value = branchId;
                    console.log('✅ [Repairs] تم تحديد الفرع الأول كافتراضي:', repairFirstBranchId);
                } else {
                    // ✅ إذا لم يكن هناك فروع، لا نعرض عمليات
                    console.warn('⚠️ [Repairs] لا توجد فروع متاحة - لا يمكن عرض العمليات');
                    allRepairs = [];
                    displayRepairs();
                    return;
                }
            } else if (repairFirstBranchId) {
                // ✅ إذا لم يكن العنصر موجوداً لكن repairFirstBranchId موجود، نستخدمه
                branchId = repairFirstBranchId;
                selectedRepairBranchId = branchId;
            } else {
                console.warn('⚠️ [Repairs] لا توجد فروع متاحة - لا يمكن عرض العمليات');
                allRepairs = [];
                displayRepairs();
                return;
            }
        } else {
            // إذا لم يكن مالك، نمسح selectedRepairBranchId
            selectedRepairBranchId = null;
            branchId = null;
        }
        
        // ✅ تحسين: يجب أن يكون branchId محدداً دائماً للمالك
        if (isOwner && !branchId) {
            console.warn('⚠️ [Repairs] يجب تحديد فرع لعرض العمليات');
            allRepairs = [];
            displayRepairs();
            return;
        }
        
        // ✅ تحسين: استخدام cache للطلبات المتكررة (يعمل تلقائياً في API.request)
        // تحميل البيانات بشكل متوازي مع استخدام cache
        const [repairsResult, usersResult, lossOperationsResult] = await Promise.all([
            API.getRepairs(branchId), // سيستخدم cache تلقائياً
            API.getUsers(), // سيستخدم cache تلقائياً
            API.getLossOperations() // سيستخدم cache تلقائياً
        ]);
        
        if (repairsResult.success) {
            let repairs = repairsResult.data || [];
            
            // ✅ تحسين: فلترة إضافية محلية حسب branch_id (مطلوبة دائماً للمالك)
            if (isOwner && branchId) {
                const branchIdStr = String(branchId);
                console.log('🔍 [Repairs] فلترة العمليات حسب branch_id:', branchIdStr);
                console.log('📊 [Repairs] قبل الفلترة:', repairs.length);
                
                repairs = repairs.filter(repair => {
                    const repairBranchId = repair.branch_id ? String(repair.branch_id) : null;
                    const matches = repairBranchId === branchIdStr;
                    if (!matches && repairBranchId) {
                        console.log(`  ⏭️ [Repairs] تخطي عملية ${repair.id} (branch_id: ${repairBranchId} !== ${branchIdStr})`);
                    }
                    return matches;
                });
                
                console.log('📊 [Repairs] بعد الفلترة:', repairs.length);
            }
            
            allRepairs = repairs;
            
            // ✅ تحسين: إعادة تطبيق قيمة الفرع المحدد على DOM بعد التحميل
            if (isOwner && branchId) {
                const branchFilter = document.getElementById('repairBranchFilter');
                if (branchFilter) {
                    branchFilter.value = String(branchId);
                    selectedRepairBranchId = String(branchId);
                }
                console.log(`✅ [Repairs] تم تحميل ${allRepairs.length} عملية من الفرع ${branchId}`);
            }
        }
        
        if (lossOperationsResult.success) {
            console.log('تم تحميل العمليات الخاسرة:', lossOperationsResult.data);
            
            // تحويل العمليات الخاسرة إلى تنسيق العمليات العادية
            const lossOperations = lossOperationsResult.data.map(loss => ({
                id: loss.id,
                repair_number: loss.repair_number,
                customer_name: loss.customer_name,
                customer_phone: '', // العمليات الخاسرة قد لا تحتوي على رقم الهاتف
                device_type: loss.device_type,
                device_model: '',
                problem: loss.problem,
                cost: loss.loss_amount,
                status: 'lost',
                created_by: '',
                created_at: loss.created_at,
                loss_reason: loss.loss_reason,
                loss_notes: loss.notes,
                is_loss_operation: true // علامة للتمييز
            }));
            
            console.log('تم تحويل العمليات الخاسرة:', lossOperations);
            
            // دمج العمليات العادية مع العمليات الخاسرة
            allRepairs = [...allRepairs, ...lossOperations];
            
            console.log('إجمالي العمليات بعد الدمج:', allRepairs.length);
        }
        
        if (usersResult.success) {
            allUsers = usersResult.data;
        }
        
        filterRepairs();
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        showMessage('خطأ في تحميل البيانات', 'error');
    } finally {
        isLoadingRepairs = false;
    }
}

// الحصول على اسم الفني من معرف المستخدم
function getTechnicianName(userId) {
    if (!userId || !allUsers || allUsers.length === 0) {
        console.log('getTechnicianName: userId =', userId, 'allUsers =', allUsers);
        return 'غير محدد';
    }
    
    const user = allUsers.find(u => u.id === userId || u.user_id === userId);
    console.log('getTechnicianName: found user =', user);
    return user ? user.name : 'غير محدد';
}

// تحديث اسم الفني المستلم في القائمة المنسدلة
function updateTechnicianName() {
    try {
        const technicianSelect = document.getElementById('technicianSelect');
        if (!technicianSelect) return;
        
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        // إذا كانت القائمة محملة بالفعل، حدد المستخدم الحالي
        if (technicianSelect.options.length > 1) {
            const userOption = technicianSelect.querySelector(`option[value="${currentUser.id}"]`) || 
                              technicianSelect.querySelector(`option[value="${currentUser.user_id}"]`);
            if (userOption) {
                technicianSelect.value = currentUser.id || currentUser.user_id;
            }
        }
        // إذا لم تكن القائمة محملة بعد، سيتم تحديد المستخدم الحالي تلقائياً في updateTechnicianSelect()
    } catch (error) {
        console.error('خطأ في تحديث اسم الفني:', error);
    }
}

// التبديل بين أنواع الصيانة
function switchRepairType(type) {
    currentRepairType = type;
    
    // تحديث الأزرار النشطة
    document.querySelectorAll('.repair-type-tab').forEach(tab => {
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
    
    // إعادة تطبيق الفلاتر
    filterRepairs();
}

function filterRepairs() {
    const statusFilterElement = document.getElementById('statusFilter');
    if (!statusFilterElement) {
        console.warn('[Repairs] قسم الصيانة غير محمّل - تخطي الفلترة');
        return;
    }
    
    const statusFilter = statusFilterElement.value;
    let filtered = allRepairs;

    // فلترة حسب نوع الصيانة أولاً
    filtered = filtered.filter(r => {
        // تجاهل العمليات الخاسرة من فلترة النوع
        if (r.is_loss_operation || r.status === 'lost') {
            return true; // عرض العمليات الخاسرة في جميع الأقسام
        }
        return (r.repair_type || 'soft') === currentRepairType;
    });

    // فلترة حسب الحالة
    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }

    displayRepairs(filtered);
}

function displayRepairs(repairs) {
    console.log('عرض العمليات:', repairs);
    
    const paginated = paginate(repairs, currentRepairPage, repairsPerPage);
    const tbody = document.getElementById('repairsTableBody');

    if (paginated.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">لا توجد عمليات</td></tr>';
        return;
    }

    tbody.innerHTML = paginated.data.map(repair => {
        // تحديد إذا كانت العملية خاسرة
        const isLossOperation = repair.is_loss_operation || repair.status === 'lost';
        
        console.log('العملية:', repair.repair_number, 'خاسرة:', isLossOperation);
        
        // تنسيق مختلف للعمليات الخاسرة
        const rowClass = isLossOperation ? 'loss-operation-row' : '';
        const statusBadge = isLossOperation ? 
            `<span class="status-badge" style="background: #dc3545; color: white;">
                <i class="bi bi-exclamation-triangle"></i> خاسرة
            </span>` :
            `<span class="status-badge" style="background: ${getStatusColor(repair.status)}">${getStatusText(repair.status)}</span>`;
        
        // أزرار مختلفة للعمليات الخاسرة
        const actionButtons = isLossOperation ? `
            <button onclick="viewLossOperationDetails('${repair.id}')" class="btn btn-sm btn-icon" title="عرض التفاصيل">
                <i class="bi bi-eye"></i>
            </button>
            <button onclick="deleteLossOperation('${repair.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager">
                <i class="bi bi-trash3"></i>
            </button>
        ` : `
            <button onclick="printRepairReceipt('${repair.id}')" class="btn btn-sm btn-icon" title="طباعة الإيصال">
                <i class="bi bi-receipt"></i>
            </button>
            <button onclick="generateBarcodeLabel('${repair.id}')" class="btn btn-sm btn-icon" title="باركود وملصق">
                <i class="bi bi-upc-scan"></i>
            </button>
            <button onclick="editRepair('${repair.id}')" class="btn btn-sm btn-icon" title="تعديل">
                <i class="bi bi-pencil-square"></i>
            </button>
            <button onclick="deleteRepair('${repair.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager">
                <i class="bi bi-trash3"></i>
            </button>
        `;

        return `
            <tr class="${rowClass}" data-repair-id="${repair.id}">
                <td><strong>${repair.repair_number}</strong></td>
                <td>${repair.customer_name}</td>
                <td>${repair.customer_phone || '-'}</td>
                <td>${repair.device_type} ${repair.device_model || ''}</td>
                <td>${repair.problem}</td>
                <td>${formatCurrency(repair.cost)}</td>
                <td>${statusBadge}</td>
                <td><span class="technician-name">${getTechnicianName(repair.created_by)}</span></td>
                <td>${formatDate(repair.created_at)}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');

    createPaginationButtons(
        document.getElementById('repairsPagination'),
        paginated.totalPages,
        currentRepairPage,
        (page) => {
            currentRepairPage = page;
            filterRepairs();
        }
    );

    hideByPermission();
}

async function showAddRepairModal() {
    document.getElementById('repairModalTitle').textContent = 'إضافة عملية صيانة جديدة';
    document.getElementById('repairForm').reset();
    document.getElementById('repairId').value = '';
    document.getElementById('selectedCustomerId').value = '';
    removeImage(); // مسح الصورة السابقة
    
    // تحميل الماركات
    await loadDeviceBrands();
    
    // تحديث اسم الفني المستلم
    updateTechnicianName();
    
    // تحميل الفروع وملء القائمة (للمالك فقط)
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // إعادة إظهار جميع الحقول المخفية عند التعديل
    const branchGroup = document.getElementById('repairBranchGroup');
    const customerType = document.getElementById('customerType');
    const customerSource = document.getElementById('customerSource');
    const customerSelectGroup = document.getElementById('customerSelectGroup');
    const customerFieldsContainer = document.getElementById('customerFieldsContainer');
    
    // إظهار حقل نوع العميل
    if (customerType && customerType.parentElement && customerType.parentElement.parentElement) {
        customerType.parentElement.parentElement.style.display = 'flex';
    }
    
    // تهيئة نوع العميل الافتراضي
    if (customerType) {
        customerType.value = 'retail';
    }
    
    // تهيئة نوع الإدخال الافتراضي (عميل جديد)
    if (customerSource) {
        customerSource.value = 'new';
    }
    
    // تطبيق حالة الإدخال الافتراضية
    onCustomerSourceChange();
    
    // تطبيق تغييرات نوع العميل
    onCustomerTypeChange(); // لتطبيق التغييرات
    
    // تهيئة الحالة الافتراضية
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
        statusSelect.value = 'received'; // تم الاستلام
    }
    
    // إظهار حقل الفرع عند الإضافة (للمالك فقط)
    if (branchGroup) {
        if (isOwner) {
            branchGroup.style.display = 'block';
            await loadRepairBranches();
            const branchSelect = document.getElementById('repairBranchSelect');
            if (branchSelect) {
                branchSelect.required = true;
                // تحديد الفرع الأول كافتراضي
                if (repairFirstBranchId && branchSelect.querySelector(`option[value="${repairFirstBranchId}"]`)) {
                    branchSelect.value = repairFirstBranchId;
                    await onRepairBranchChange();
                }
            }
        } else {
            branchGroup.style.display = 'none';
            const branchSelect = document.getElementById('repairBranchSelect');
            if (branchSelect) {
                branchSelect.required = false;
            }
            // للموظفين: جلب عملاء فرعهم مباشرة
            const branchId = currentUser.branch_id;
            if (branchId) {
                await loadRepairCustomers(branchId, 'retail');
                await loadRepairTechnicians(branchId);
            }
        }
    }
    
    // تحميل الفنيين حسب الفرع المحدد
    const branchIdForTechnicians = getCurrentRepairBranchId();
    await loadRepairTechnicians(branchIdForTechnicians);
    
    // مسح حقول العميل
    clearCustomerFields();
    
    // مسح حقول أرقام الفواتير
    setSparePartsInvoices([]);
    
    document.getElementById('repairModal').style.display = 'flex';
}

function closeRepairModal() {
    document.getElementById('repairModal').style.display = 'none';
}

// تحميل الماركات من قاعدة البيانات
async function loadDeviceBrands() {
    try {
        const deviceTypeSelect = document.getElementById('deviceType');
        if (!deviceTypeSelect) return;
        
        // إظهار حالة التحميل
        deviceTypeSelect.innerHTML = '<option value="">جاري التحميل...</option>';
        
        const response = await fetch('/api/repairs.php?action=brands', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('فشل في جلب الماركات');
        }
        
        const result = await response.json();
        
        if (!result.success || !Array.isArray(result.data)) {
            throw new Error('بيانات غير صحيحة');
        }
        
        const brands = result.data;
        
        // ملء القائمة المنسدلة
        deviceTypeSelect.innerHTML = '<option value="">اختر الماركة</option>';
        
        brands.forEach(brand => {
            if (brand && brand.trim()) {
                const option = document.createElement('option');
                option.value = brand;
                option.textContent = brand;
                deviceTypeSelect.appendChild(option);
            }
        });
        
        // إضافة خيار "أخرى" في النهاية
        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.textContent = 'أخرى';
        deviceTypeSelect.appendChild(otherOption);
        
    } catch (error) {
        console.error('خطأ في تحميل الماركات:', error);
        const deviceTypeSelect = document.getElementById('deviceType');
        if (deviceTypeSelect) {
            deviceTypeSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
        }
        showMessage('حدث خطأ أثناء تحميل الماركات', 'error');
    }
}

// معالجة تغيير نوع الجهاز
function handleDeviceTypeChange(select) {
    const customInput = document.getElementById('deviceTypeCustom');
    if (!customInput) return;
    
    if (select.value === 'other' || select.value.toLowerCase() === 'other') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
}

// حساب المتبقي
function calculateRemaining() {
    const customerPrice = parseFloat(document.getElementById('customerPrice').value) || 0;
    const paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
    const remaining = customerPrice - paidAmount;
    document.getElementById('remainingAmount').value = remaining.toFixed(2);
}

// تحويل الصورة إلى Base64
async function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// متغير لحفظ الصورة المختارة
let selectedDeviceImage = null;

// معالجة رفع الصورة من الملف
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    try {
        selectedDeviceImage = await imageToBase64(file);
        document.getElementById('imageFileName').textContent = file.name;
        showImagePreview(selectedDeviceImage);
        showMessage('تم رفع الصورة بنجاح', 'success');
    } catch (error) {
        showMessage('خطأ في رفع الصورة', 'error');
    }
}

// متغير لتتبع حالة إذن الكاميرا
let cameraPermissionGranted = false;

// فتح الكاميرا والتقاط صورة
async function openCamera() {
    try {
        // التحقق من دعم الكاميرا
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showMessage('الكاميرا غير مدعومة في هذا المتصفح', 'error');
            return;
        }

        // التحقق من إذن الكاميرا
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                cameraPermissionGranted = permissionStatus.state === 'granted';
                
                if (permissionStatus.state === 'denied') {
                    showMessage('تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا في إعدادات المتصفح.', 'error');
                    return;
                }
            } catch (e) {
                console.log('لا يمكن التحقق من إذن الكاميرا:', e);
            }
        }

        // إخفاء النموذج مؤقتاً وعرض الكاميرا
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.innerHTML = `
            <div class="camera-container" style="position: relative; width: 100%; max-width: 500px; margin: 0 auto;">
                <video id="cameraVideo" autoplay playsinline muted style="width: 100%; height: auto; border-radius: 10px; border: 2px solid #2196F3; background: #000;"></video>
                <canvas id="cameraCanvas" style="display: none;"></canvas>
                <div style="margin-top: 15px; text-align: center;">
                    <button type="button" onclick="capturePhoto()" class="btn btn-primary">
                        <i class="bi bi-camera-fill"></i> التقاط الصورة
                    </button>
                    <button type="button" onclick="closeCameraPreview()" class="btn btn-secondary">
                        <i class="bi bi-x-circle"></i> إلغاء
                    </button>
                </div>
            </div>
        `;

        // الحصول على stream من الكاميرا
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // الكاميرا الخلفية
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });

        // حفظ حالة الإذن
        cameraPermissionGranted = true;
        localStorage.setItem('cameraPermissionGranted', 'true');

        // تشغيل الفيديو
        const video = document.getElementById('cameraVideo');
        video.srcObject = stream;
        
        // انتظار تحميل الفيديو
        video.onloadedmetadata = () => {
            video.play().catch(e => console.log('خطأ في تشغيل الفيديو:', e));
        };
        
        // حفظ stream للإغلاق لاحقاً
        window.currentCameraStream = stream;

    } catch (error) {
        console.error('خطأ في فتح الكاميرا:', error);
        
        if (error.name === 'NotAllowedError') {
            showMessage('تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا في إعدادات المتصفح.', 'error');
        } else if (error.name === 'NotFoundError') {
            showMessage('لم يتم العثور على كاميرا في الجهاز.', 'error');
        } else if (error.name === 'NotReadableError') {
            showMessage('الكاميرا مستخدمة من قبل تطبيق آخر.', 'error');
        } else {
            showMessage('خطأ في الوصول للكاميرا. تأكد من منح الإذن.', 'error');
        }
        
        document.getElementById('imagePreview').innerHTML = '';
    }
}

// التقاط الصورة من الكاميرا
function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    
    if (!video || !canvas) {
        showMessage('خطأ في التقاط الصورة', 'error');
        return;
    }
    
    // ضبط حجم الكانفس حسب الفيديو
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // رسم الصورة
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // تحويل إلى Base64 بجودة جيدة
    selectedDeviceImage = canvas.toDataURL('image/jpeg', 0.85);
    
    // إيقاف الكاميرا
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => track.stop());
        window.currentCameraStream = null;
    }
    
    // عرض معاينة الصورة
    document.getElementById('imageFileName').textContent = '✓ تم التقاط الصورة من الكاميرا';
    showImagePreview(selectedDeviceImage);
    
    showMessage('تم التقاط الصورة بنجاح', 'success');
}

// إغلاق معاينة الكاميرا
function closeCameraPreview() {
    // إيقاف stream الكاميرا
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => track.stop());
        window.currentCameraStream = null;
    }
    
    // حفظ حالة الإذن
    if (cameraPermissionGranted) {
        localStorage.setItem('cameraPermissionGranted', 'true');
    }
    
    // مسح معاينة الكاميرا
    document.getElementById('imagePreview').innerHTML = '';
}

// عرض معاينة الصورة
function showImagePreview(base64Image) {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    
    preview.innerHTML = `
        <div style="position: relative; display: inline-block; margin-top: 10px;">
            <img src="${base64Image}" style="max-width: 250px; max-height: 250px; border-radius: 10px; border: 2px solid #4CAF50; box-shadow: 0 2px 10px rgba(0,0,0,0.1);" loading="lazy" decoding="async" width="250" height="250">
            <button type="button" onclick="removeImage()" class="btn btn-danger btn-sm" style="position: absolute; top: 5px; left: 5px;">
                <i class="bi bi-x"></i> حذف
            </button>
        </div>
    `;
}

// حذف الصورة
function removeImage() {
    selectedDeviceImage = null;
    document.getElementById('imageFileName').textContent = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('deviceImageFile').value = '';
}

async function saveRepair(event) {
    event.preventDefault();

    // تحديد نوع الإدخال (عميل جديد / عميل مسجل)
    const customerSource = document.getElementById('customerSource')?.value || 'new';
    const customerType = document.getElementById('customerType')?.value || 'retail';
    
    let customerName, customerPhone, shopName = '';
    
    if (customerSource === 'existing') {
        // إذا كان عميل مسجل، قراءة البيانات من القائمة المنسدلة
        const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
        if (!selectedCustomerIdInput || !selectedCustomerIdInput.value) {
            showMessage('يجب اختيار عميل من القائمة', 'error');
            return;
        }
        
        const customerId = selectedCustomerIdInput.value;
        const customer = repairCustomers.find(c => c.id === customerId);
        
        if (!customer) {
            showMessage('العميل المحدد غير موجود', 'error');
            return;
        }
        
        customerName = customer.name || '';
        customerPhone = customer.phone || '';
        shopName = (customerType === 'commercial' && customer.shop_name) ? customer.shop_name : '';
    } else {
        // إذا كان عميل جديد، قراءة البيانات من الحقول
        customerName = document.getElementById('customerName').value.trim();
        customerPhone = document.getElementById('customerPhone').value.trim();
        shopName = document.getElementById('shopName')?.value.trim() || '';
    }
    
    // جلب نوع الجهاز (مع دعم الماركة المخصصة)
    let deviceType = document.getElementById('deviceType').value.trim();
    const customDeviceType = document.getElementById('deviceTypeCustom')?.value.trim() || '';
    
    // إذا كانت الماركة "أخرى" واستخدم المستخدم حقل الإدخال
    if ((deviceType === 'other' || deviceType.toLowerCase() === 'other') && customDeviceType) {
        deviceType = customDeviceType;
    }
    
    const problem = document.getElementById('problem').value.trim();
    const customerPrice = document.getElementById('customerPrice').value.trim();

    if (!customerName || !customerPhone || !deviceType || !problem || !customerPrice) {
        showMessage('جميع الحقول المطلوبة يجب أن تكون مملوءة', 'error');
        return;
    }

    // التحقق من shop_name للعملاء التجاريين
    if (customerType === 'commercial' && !shopName) {
        showMessage('اسم المحل مطلوب للعملاء التجاريين', 'error');
        return;
    }

    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // جلب أرقام فواتير قطع الغيار
    const sparePartsInvoices = getSparePartsInvoices();
    
    const repairData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_type: customerType,
        shop_name: customerType === 'commercial' ? shopName : null,
        device_type: deviceType,
        device_model: document.getElementById('deviceModel').value.trim(),
        serial_number: document.getElementById('serialNumber').value.trim(),
        accessories: document.getElementById('accessories').value.trim(),
        problem: problem,
        repair_type: document.getElementById('repairType').value,
        customer_price: parseFloat(customerPrice),
        repair_cost: parseFloat(document.getElementById('repairCost').value) || 0,
        parts_store: document.getElementById('partsStore').value.trim(),
        spare_parts_invoices: sparePartsInvoices,
        paid_amount: parseFloat(document.getElementById('paidAmount').value) || 0,
        remaining_amount: parseFloat(document.getElementById('remainingAmount').value) || 0,
        delivery_date: document.getElementById('deliveryDate').value,
        status: document.getElementById('status').value,
        notes: document.getElementById('notes').value.trim()
    };
    
    // إضافة الفني المستلم من الـ select
    const technicianSelect = document.getElementById('technicianSelect');
    if (technicianSelect && technicianSelect.value) {
        repairData.created_by = technicianSelect.value;
    } else {
        // إذا لم يتم اختيار فني، استخدام المستخدم الحالي
        repairData.created_by = currentUser?.id || currentUser?.user_id || '';
    }
    
    // إضافة branch_id
    const branchId = getCurrentRepairBranchId();
    if (branchId) {
        repairData.branch_id = branchId;
    }

    const repairId = document.getElementById('repairId').value;
    let result;

    if (repairId) {
        repairData.id = repairId;
        result = await API.updateRepair(repairData);
        
        // رفع الصورة الجديدة إذا كانت موجودة
        if (selectedDeviceImage && result.success) {
            try {
                await API.uploadImage(repairId, selectedDeviceImage);
                showMessage('تم حفظ الصورة بنجاح', 'success');
            } catch (error) {
                console.error('خطأ في رفع الصورة:', error);
                showMessage('تم حفظ العملية ولكن حدث خطأ في رفع الصورة', 'warning');
            }
        }
    } else {
        result = await API.addRepair(repairData);
        
        // رفع الصورة الجديدة إذا كانت موجودة
        if (selectedDeviceImage && result.success && result.data && result.data.id) {
            try {
                await API.uploadImage(result.data.id, selectedDeviceImage);
                showMessage('تم حفظ الصورة بنجاح', 'success');
            } catch (error) {
                console.error('خطأ في رفع الصورة:', error);
                showMessage('تم حفظ العملية ولكن حدث خطأ في رفع الصورة', 'warning');
            }
        }
        
        // حفظ العميل تلقائياً إذا كانت عملية جديدة (فقط إذا لم يكن محدداً من القائمة)
        if (result.success) {
            const selectedCustomerId = document.getElementById('selectedCustomerId').value;
            if (!selectedCustomerId) {
                // عميل جديد - إنشاء عميل جديد
                const customerData = {
                    name: customerName,
                    phone: customerPhone,
                    address: '',
                    customer_type: customerType
                };
                
                if (customerType === 'commercial' && shopName) {
                    customerData.shop_name = shopName;
                }
                
                if (branchId) {
                    customerData.branch_id = branchId;
                }
                
                await API.addCustomer(customerData);
            }
        }
    }

    if (result.success) {
        showMessage(result.message);
        closeRepairModal();
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        isLoadingRepairs = false;
        lastRepairsLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
        
        await loadRepairs(true); // force = true بعد حفظ العملية
        
        // تحديث لوحة التحكم دائماً (حتى لو كنا في قسم آخر)
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        
        // ✅ إنشاء رابط التتبع وعرضه للعميل (فقط للعمليات الجديدة)
        if (!repairId && result.data && result.data.repair_number) {
            const trackingLink = generateRepairTrackingLink(result.data.repair_number);
            showTrackingLinkModal(result.data.repair_number, trackingLink);
        }
    } else {
        showMessage(result.message, 'error');
    }
}

// ✅ دالة لإنشاء رابط التتبع
function generateRepairTrackingLink(repairNumber) {
    try {
        // إنشاء رابط تتبع بناءً على الرقم الحالي
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
        const trackingUrl = `${baseUrl}/repair-tracking.html?repair_number=${encodeURIComponent(repairNumber)}`;
        return trackingUrl;
    } catch (error) {
        console.error('خطأ في إنشاء رابط التتبع:', error);
        return '';
    }
}

// ✅ دالة لإنشاء QR Code للرابط (مع fallback)
async function generateRepairTrackingQRCode(trackingLink) {
    try {
        // محاولة استخدام مكتبة QRCode إذا كانت متاحة
        if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
            return await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(generateQRCodeFallback(trackingLink, 200));
                }, 3000);
                
                QRCode.toDataURL(trackingLink, {
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
                        resolve(generateQRCodeFallback(trackingLink, 200));
                    } else {
                        resolve(url);
                    }
                });
            });
        } else {
            // استخدام API fallback
            return generateQRCodeFallback(trackingLink, 200);
        }
    } catch (error) {
        console.error('خطأ في إنشاء QR Code:', error);
        return generateQRCodeFallback(trackingLink, 200);
    }
}

// ✅ دالة fallback لإنشاء QR Code باستخدام API
function generateQRCodeFallback(data, size = 200) {
    try {
        const encodedData = encodeURIComponent(data);
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
    } catch (error) {
        console.error('خطأ في إنشاء QR Code البديل:', error);
        return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(data)}&choe=UTF-8`;
    }
}

// ✅ دالة لعرض رابط التتبع في مودال
function showTrackingLinkModal(repairNumber, trackingLink) {
    try {
        // إنشاء مودال لعرض رابط التتبع
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'trackingLinkModal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3><i class="bi bi-link-45deg"></i> رابط متابعة عملية الصيانة</h3>
                    <button onclick="closeTrackingLinkModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="margin-bottom: 15px; color: var(--text-dark);">
                        <i class="bi bi-info-circle"></i> يمكنك مشاركة هذا الرابط مع العميل لمتابعة حالة عملية الصيانة رقم: <strong>${escapeHtmlForRepairs(repairNumber)}</strong>
                    </p>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                        <input 
                            type="text" 
                            id="trackingLinkInput" 
                            value="${escapeHtmlForRepairs(trackingLink)}" 
                            readonly 
                            style="flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--light-bg); font-size: 0.9em;"
                        >
                        <button 
                            onclick="copyTrackingLink()" 
                            class="btn btn-primary"
                            style="padding: 10px 20px;"
                        >
                            <i class="bi bi-clipboard"></i> نسخ
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button 
                            onclick="openTrackingLink()" 
                            class="btn btn-secondary"
                            style="padding: 10px 20px;"
                        >
                            <i class="bi bi-box-arrow-up-right"></i> فتح الرابط
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeTrackingLinkModal()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // حفظ الرابط في window للوصول إليه من الدوال
        window.currentTrackingLink = trackingLink;
    } catch (error) {
        console.error('خطأ في عرض رابط التتبع:', error);
    }
}

// ✅ دالة لإغلاق مودال رابط التتبع
function closeTrackingLinkModal() {
    const modal = document.getElementById('trackingLinkModal');
    if (modal) {
        modal.remove();
    }
    window.currentTrackingLink = null;
}

// ✅ دالة لنسخ رابط التتبع
function copyTrackingLink() {
    try {
        const input = document.getElementById('trackingLinkInput');
        if (!input) return;
        
        input.select();
        input.setSelectionRange(0, 99999); // للأجهزة المحمولة
        
        navigator.clipboard.writeText(input.value).then(() => {
            showMessage('تم نسخ الرابط بنجاح', 'success');
            
            // تغيير نص الزر مؤقتاً
            const copyBtn = event.target.closest('button');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="bi bi-check-circle"></i> تم النسخ';
                copyBtn.disabled = true;
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.disabled = false;
                }, 2000);
            }
        }).catch(err => {
            console.error('خطأ في النسخ:', err);
            showMessage('حدث خطأ أثناء نسخ الرابط', 'error');
        });
    } catch (error) {
        console.error('خطأ في نسخ رابط التتبع:', error);
        showMessage('حدث خطأ أثناء نسخ الرابط', 'error');
    }
}

// ✅ دالة لفتح رابط التتبع
function openTrackingLink() {
    try {
        const link = window.currentTrackingLink || document.getElementById('trackingLinkInput')?.value;
        if (link) {
            window.open(link, '_blank');
        }
    } catch (error) {
        console.error('خطأ في فتح رابط التتبع:', error);
        showMessage('حدث خطأ أثناء فتح الرابط', 'error');
    }
}

// ✅ تصدير الدوال إلى window
window.closeTrackingLinkModal = closeTrackingLinkModal;
window.copyTrackingLink = copyTrackingLink;
window.openTrackingLink = openTrackingLink;

async function editRepair(id) {
    const repair = allRepairs.find(r => r.id === id);
    if (!repair) return;

    // تحميل الماركات أولاً
    await loadDeviceBrands();

    document.getElementById('repairModalTitle').textContent = 'تعديل عملية الصيانة';
    document.getElementById('repairId').value = repair.id;
    document.getElementById('selectedCustomerId').value = '';
    document.getElementById('customerName').value = repair.customer_name;
    document.getElementById('customerPhone').value = repair.customer_phone;
    
    // تعيين قيمة الماركة بعد تحميل القائمة
    const deviceTypeSelect = document.getElementById('deviceType');
    const deviceTypeCustom = document.getElementById('deviceTypeCustom');
    
    if (deviceTypeSelect && repair.device_type) {
        // التحقق من وجود الماركة في القائمة
        const brandExists = Array.from(deviceTypeSelect.options).some(option => option.value === repair.device_type);
        
        if (brandExists) {
            deviceTypeSelect.value = repair.device_type;
            if (deviceTypeCustom) {
                deviceTypeCustom.style.display = 'none';
                deviceTypeCustom.value = '';
            }
        } else {
            // إذا لم تكن الماركة موجودة، استخدم "أخرى" مع حقل الإدخال
            deviceTypeSelect.value = 'other';
            if (deviceTypeCustom) {
                deviceTypeCustom.style.display = 'block';
                deviceTypeCustom.value = repair.device_type;
                deviceTypeCustom.required = true;
            }
        }
    }
    document.getElementById('deviceModel').value = repair.device_model || '';
    document.getElementById('serialNumber').value = repair.serial_number || '';
    document.getElementById('accessories').value = repair.accessories || '';
    document.getElementById('problem').value = repair.problem;
    document.getElementById('repairType').value = repair.repair_type || 'soft';
    document.getElementById('customerPrice').value = repair.customer_price || repair.cost || 0;
    document.getElementById('repairCost').value = repair.repair_cost || 0;
    document.getElementById('partsStore').value = repair.parts_store || '';
    
    // تحميل أرقام فواتير قطع الغيار
    let sparePartsInvoices = [];
    if (repair.spare_parts_invoices) {
        try {
            // إذا كانت JSON string، تحويلها
            if (typeof repair.spare_parts_invoices === 'string') {
                sparePartsInvoices = JSON.parse(repair.spare_parts_invoices);
            } else if (Array.isArray(repair.spare_parts_invoices)) {
                sparePartsInvoices = repair.spare_parts_invoices;
            }
        } catch (e) {
            console.error('خطأ في تحليل أرقام الفواتير:', e);
            sparePartsInvoices = [];
        }
    }
    setSparePartsInvoices(sparePartsInvoices);
    
    document.getElementById('paidAmount').value = repair.paid_amount || 0;
    document.getElementById('remainingAmount').value = repair.remaining_amount || 0;
    document.getElementById('deliveryDate').value = repair.delivery_date || '';
    document.getElementById('status').value = repair.status;
    document.getElementById('notes').value = repair.notes || '';
    
    // إخفاء حقول الفرع ونوع العميل واختيار العميل عند التعديل
    const branchGroup = document.getElementById('repairBranchGroup');
    if (branchGroup) {
        branchGroup.style.display = 'none';
    }
    const branchSelect = document.getElementById('repairBranchSelect');
    if (branchSelect) {
        branchSelect.required = false;
    }
    
    // إخفاء اختيار نوع العميل واختيار العميل ونوع الإدخال
    const customerType = document.getElementById('customerType');
    if (customerType && customerType.parentElement && customerType.parentElement.parentElement) {
        customerType.parentElement.parentElement.style.display = 'none';
    }
    const customerSource = document.getElementById('customerSource');
    if (customerSource && customerSource.parentElement) {
        customerSource.parentElement.style.display = 'none';
    }
    const customerSelectGroup = document.getElementById('customerSelectGroup');
    if (customerSelectGroup) {
        customerSelectGroup.style.display = 'none';
    }
    
    // إظهار حقول بيانات العميل فقط (بدون shop_name لأنها لا تُستخدم في التعديل)
    const shopNameGroup = document.getElementById('shopNameGroup');
    if (shopNameGroup) {
        shopNameGroup.style.display = 'none';
    }
    
    // عرض الصورة الموجودة إن وجدت
    selectedDeviceImage = null;
    document.getElementById('imageFileName').textContent = '';
    document.getElementById('imagePreview').innerHTML = '';
    
    try {
        const imageExists = await API.checkImageExists(repair.id);
        if (imageExists) {
            const imagePath = API.getImagePath(repair.id);
            showImagePreview(imagePath);
            document.getElementById('imageFileName').textContent = 'صورة موجودة';
        }
    } catch (error) {
        console.log('لا توجد صورة للعملية:', error);
    }
    
    // تحديث dropdown الفني المستلم
    const branchIdForEdit = repair.branch_id || null;
    await loadRepairTechnicians(branchIdForEdit);
    
    // تحديد الفني المستلم من العملية
    const technicianSelect = document.getElementById('technicianSelect');
    if (technicianSelect && repair.created_by) {
        if (technicianSelect.querySelector(`option[value="${repair.created_by}"]`)) {
            technicianSelect.value = repair.created_by;
        }
    }
    
    document.getElementById('repairModal').style.display = 'flex';
}

async function deleteRepair(id) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية', 'error');
        return;
    }

    if (!confirmAction('هل أنت متأكد من حذف هذه العملية؟')) return;

    const result = await API.deleteRepair(id);
    if (result.success) {
        // حذف الصورة المرتبطة بالعملية
        try {
            await API.deleteImage(id);
        } catch (error) {
            console.log('لم يتم العثور على صورة للعملية:', error);
        }
        
        showMessage(result.message);
        loadRepairs(true); // force = true بعد تحديث الحالة
    } else {
        showMessage(result.message, 'error');
    }
}

async function printRepairReceipt(id) {
    const repair = allRepairs.find(r => r.id === id);
    if (!repair) return;

    // جلب إعدادات المحل من ملف settings.json
    let shopSettings = {
        shop_name: 'محل صيانة الهواتف',
        shop_phone: '01000000000',
        shop_address: 'القاهرة، مصر'
    };
    
    try {
        const settingsResponse = await API.request('settings');
        if (settingsResponse.success && settingsResponse.data) {
            shopSettings = settingsResponse.data;
            console.log('تم تحميل إعدادات المحل:', shopSettings);
        }
    } catch (error) {
        console.log('لم يتم تحميل إعدادات المحل، سيتم استخدام القيم الافتراضية:', error);
    }

    // ✅ إنشاء رابط التتبع
    const trackingLink = generateRepairTrackingLink(repair.repair_number);
    
    // ✅ إنشاء QR Code للرابط
    let qrCodeImage = '';
    try {
        qrCodeImage = await generateRepairTrackingQRCode(trackingLink);
    } catch (error) {
        console.error('خطأ في إنشاء QR Code:', error);
        qrCodeImage = generateQRCodeFallback(trackingLink, 200);
    }
    
    // ✅ التحقق من وجود صورة الجهاز
    let hasImage = false;
    try {
        hasImage = await checkAndShowImage(repair.id);
    } catch (error) {
        console.log('خطأ في التحقق من الصورة:', error);
        hasImage = false;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="css/print.css">
        </head>
        <body>
            <div class="receipt">
                <div class="receipt-header">
                    ${shopSettings.shop_logo ? `<div style="text-align: center; margin-bottom: 15px;"><img src="${shopSettings.shop_logo}" alt="شعار المحل" style="max-height: 60px; max-width: 200px;" loading="lazy" decoding="async" width="200" height="60"></div>` : ''}
                    <h1>${shopSettings.shop_name}</h1>
                    <h2>إيصال ${repair.status === 'delivered' ? 'تسليم' : 'استلام'} جهاز</h2>
                    ${shopSettings.shop_address ? `<p style="color: #666; margin: 5px 0;">${shopSettings.shop_address}</p>` : ''}
                    ${shopSettings.shop_phone ? `<p style="color: #666; margin: 5px 0;">${shopSettings.shop_phone}</p>` : ''}
                </div>
                <div class="receipt-info">
                    <p><strong>رقم العملية:</strong> ${repair.repair_number}</p>
                    <p><strong>التاريخ:</strong> ${formatDateTime(repair.created_at)}</p>
                </div>
                <div class="receipt-section">
                    <h3>بيانات العميل</h3>
                    <p><strong>الاسم:</strong> ${repair.customer_name}</p>
                    <p><strong>الهاتف:</strong> ${repair.customer_phone}</p>
                </div>
                <div class="receipt-section">
                    <h3>بيانات الجهاز</h3>
                    <p><strong>النوع:</strong> ${repair.device_type}</p>
                    <p><strong>الموديل:</strong> ${repair.device_model || '-'}</p>
                    <p><strong>الرقم التسلسلي:</strong> ${repair.serial_number || '-'}</p>
                    <p><strong>المشكلة:</strong> ${repair.problem}</p>
                    <p><strong>الملحقات:</strong> ${repair.accessories || '-'}</p>
                </div>
                <div class="receipt-section">
                    <h3>التكلفة والدفع</h3>
                    <p><strong>سعر الصيانة:</strong> ${formatCurrency(repair.customer_price || repair.cost)}  ${shopSettings.currency || 'ج.م'}</p>
                    <p><strong>المبلغ المدفوع مقدماً:</strong> ${formatCurrency(repair.paid_amount || 0)}  ${shopSettings.currency || 'ج.م'}</p>
                    <p><strong>المبلغ المتبقي:</strong> ${formatCurrency(repair.remaining_amount || 0)}  ${shopSettings.currency || 'ج.م'}</p>
                </div>
                <div class="receipt-section">
                    <h3>موعد الاستلام المتوقع</h3>
                    <p><strong>التاريخ:</strong> ${formatDate(repair.delivery_date) || '-'}</p>
                </div>
                <div class="receipt-section">
                    <h3>ملاحظات</h3>
                    <p>${repair.notes || '-'}</p>
                </div>
                
                ${hasImage ? `<div class="receipt-section">
                    <h3>صورة الجهاز</h3>
                    <div style="text-align: center; margin: 10px 0;">
                        <img src="${API.getImagePath(repair.id)}" alt="صورة الجهاز" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; border-radius: 5px;" loading="lazy" decoding="async" width="200" height="200">
                    </div>
                </div>` : ''}
                
                <div class="receipt-footer">
                    <p>شكراً لثقتكم</p>
                    ${repair.status === 'delivered' && repair.delivered_at ? `<p><small>تاريخ التسليم: ${formatDateTime(repair.delivered_at)}</small></p>` : ''}
                </div>
                
                <!-- ✅ QR Code لمتابعة عملية الصيانة -->
                <div class="receipt-section" style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 2px dashed #ddd;">
                    <h3 style="margin-bottom: 10px; color: var(--primary-color, #2196F3);">
                        <i class="bi bi-qr-code-scan"></i> متابعة حالة الصيانة
                    </h3>
                    <p style="margin-bottom: 15px; font-size: 0.9em; color: #666;">
                        امسح الباركود لمتابعة حالة عملية الصيانة
                    </p>
                    <div style="display: inline-block; padding: 15px; background: white; border: 2px solid #ddd; border-radius: 10px;">
                        <img src="${qrCodeImage}" alt="QR Code لمتابعة الصيانة" style="max-width: 200px; max-height: 200px; width: 200px; height: 200px; display: block;" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingLink)}';">
                    </div>
                    <p style="margin-top: 10px; font-size: 0.85em; color: #999;">
                        رقم العملية: ${repair.repair_number}
                    </p>
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
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// وظائف الباركود والملصق الصغير
async function generateBarcodeLabel(repairId) {
    const repair = allRepairs.find(r => r.id === repairId);
    if (!repair) {
        showMessage('العملية غير موجودة', 'error');
        return;
    }

    try {
        // إنشاء الباركود
        const barcodeImage = window.barcodeGenerator.generateBarcode(repair.repair_number, 200, 80);
        
        // إنشاء الملصق الصغير
        const labelImage = window.smallLabelGenerator.generateLabel(repair, 300, 150);
        
        // إنشاء الملصق المتقدم
        const advancedLabelImage = window.smallLabelGenerator.generateAdvancedLabel(repair, 400, 200);
        
        // عرض النتائج
        showBarcodeModal(barcodeImage, labelImage, advancedLabelImage, repair);
        
    } catch (error) {
        console.error('خطأ في إنشاء الباركود:', error);
        showMessage('خطأ في إنشاء الباركود', 'error');
    }
}

function showBarcodeModal(barcodeImage, labelImage, advancedLabelImage, repair) {
    // إنشاء modal للباركود
    const barcodeModal = document.createElement('div');
    barcodeModal.className = 'modal';
    barcodeModal.style.display = 'flex';
    barcodeModal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2><i class="bi bi-upc-scan"></i> باركود وملصق العملية - ${repair.repair_number}</h2>
                <button onclick="closeBarcodeModal()" class="btn-close">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="barcode-section">
                    <h3><i class="bi bi-upc"></i> الباركود الرقمي</h3>
                    <div class="barcode-container" style="text-align: center; margin: 20px 0;">
                        <img src="${barcodeImage}" alt="باركود ${repair.repair_number}" style="border: 1px solid #ddd; padding: 10px; background: white;">
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">رقم العملية: ${repair.repair_number}</p>
                        <button onclick="printBarcode('${barcodeImage}', '${repair.repair_number}')" class="btn btn-primary btn-sm">
                            <i class="bi bi-printer-fill"></i> طباعة الباركود
                        </button>
                    </div>
                </div>
                
                <hr style="margin: 30px 0;">
                
                <div class="label-section">
                    <h3><i class="bi bi-tag-fill"></i> الملصق الصغير</h3>
                    <div class="label-container" style="text-align: center; margin: 20px 0;">
                        <img src="${labelImage}" alt="ملصق ${repair.repair_number}" style="border: 1px solid #ddd; padding: 10px; background: white;">
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">ملصق يحتوي على بيانات المشكلة وتاريخ التسليم</p>
                        <button onclick="printLabel('${labelImage}', '${repair.repair_number}')" class="btn btn-primary btn-sm">
                            <i class="bi bi-printer-fill"></i> طباعة الملصق
                        </button>
                    </div>
                </div>
                
                <hr style="margin: 30px 0;">
                
                <div class="advanced-label-section">
                    <h3><i class="bi bi-qr-code-scan"></i> الملصق المتقدم</h3>
                    <div class="advanced-label-container" style="text-align: center; margin: 20px 0;">
                        <img src="${advancedLabelImage}" alt="ملصق متقدم ${repair.repair_number}" style="border: 1px solid #ddd; padding: 10px; background: white;">
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">ملصق متقدم مع QR Code وبيانات شاملة</p>
                        <button onclick="printAdvancedLabel('${advancedLabelImage}', '${repair.repair_number}')" class="btn btn-primary btn-sm">
                            <i class="bi bi-printer-fill"></i> طباعة الملصق المتقدم
                        </button>
                    </div>
                </div>
                
                <div class="info-section" style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <h4><i class="bi bi-info-circle-fill"></i> معلومات مهمة:</h4>
                    <ul style="margin: 10px 0; padding-right: 20px;">
                        <li>الباركود يمكن طباعته على ملصقات صغيرة</li>
                        <li>الملصق الصغير مناسب للجهاز نفسه</li>
                        <li>الملصق المتقدم مناسب للملفات والوثائق</li>
                        <li>جميع الصور عالية الجودة ومناسبة للطباعة</li>
                    </ul>
                </div>
            </div>
            
            <div class="modal-footer">
                <button onclick="downloadAllBarcodes('${barcodeImage}', '${labelImage}', '${advancedLabelImage}', '${repair.repair_number}')" class="btn btn-success">
                    <i class="bi bi-download"></i> تحميل الكل
                </button>
                <button onclick="closeBarcodeModal()" class="btn btn-secondary">
                    <i class="bi bi-x-circle-fill"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(barcodeModal);
}

function closeBarcodeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

function printBarcode(barcodeImage, repairNumber) {
    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة الباركود - ${repairNumber}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                .barcode-container { margin: 20px 0; }
                img { max-width: 100%; height: auto; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="barcode-container">
                <h3>باركود العملية: ${repairNumber}</h3>
                <img src="${barcodeImage}" alt="باركود ${repairNumber}">
                <p>رقم العملية: ${repairNumber}</p>
            </div>
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
                    setTimeout(() => window.print(), 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printLabel(labelImage, repairNumber) {
    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة الملصق - ${repairNumber}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                .label-container { margin: 20px 0; }
                img { max-width: 100%; height: auto; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="label-container">
                <h3>ملصق العملية: ${repairNumber}</h3>
                <img src="${labelImage}" alt="ملصق ${repairNumber}">
            </div>
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
                    setTimeout(() => window.print(), 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printAdvancedLabel(advancedLabelImage, repairNumber) {
    const printWindow = window.open('', '', 'width=500,height=400');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة الملصق المتقدم - ${repairNumber}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                .advanced-label-container { margin: 20px 0; }
                img { max-width: 100%; height: auto; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="advanced-label-container">
                <h3>الملصق المتقدم - ${repairNumber}</h3>
                <img src="${advancedLabelImage}" alt="ملصق متقدم ${repairNumber}">
            </div>
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
                    setTimeout(() => window.print(), 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadAllBarcodes(barcodeImage, labelImage, advancedLabelImage, repairNumber) {
    // تحميل الباركود
    downloadImage(barcodeImage, `barcode_${repairNumber}.png`);
    
    // تحميل الملصق الصغير
    setTimeout(() => downloadImage(labelImage, `label_${repairNumber}.png`), 500);
    
    // تحميل الملصق المتقدم
    setTimeout(() => downloadImage(advancedLabelImage, `advanced_label_${repairNumber}.png`), 1000);
    
    showMessage('تم بدء تحميل جميع الصور', 'success');
}

function downloadImage(imageData, filename) {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// دالة للتحقق من وجود الصورة وعرضها
async function checkAndShowImage(repairId) {
    try {
        return await API.checkImageExists(repairId);
    } catch (error) {
        return false;
    }
}

// قارئ الباركود
async function openBarcodeScanner() {
    // التحقق من وجود ماسح مفتوح بالفعل
    if (isScannerOpen) {
        console.log('يوجد ماسح مفتوح بالفعل');
        showMessage('قارئ الباركود مفتوح بالفعل', 'info');
        return;
    }
    
    const existingModal = document.getElementById('barcodeScannerModal');
    if (existingModal) {
        console.log('يوجد ماسح مفتوح بالفعل');
        showMessage('قارئ الباركود مفتوح بالفعل', 'info');
        return;
    }
    
    // إغلاق أي modal مفتوح قبل فتح قارئ الباركود
    const openModals = document.querySelectorAll('.modal');
    openModals.forEach(modal => {
        if (modal.id !== 'barcodeScannerModal') {
            modal.remove();
        }
    });
    
    // التحقق من توفر الكاميرا
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('الكاميرا غير متوفرة في هذا المتصفح', 'error');
        return;
    }
    
    // تحميل Quagga أولاً إذا لم يكن محملاً
    if (typeof Quagga === 'undefined' && typeof window.loadQuagga === 'function') {
        try {
            await window.loadQuagga();
        } catch (error) {
            showMessage('فشل تحميل مكتبة الباركود', 'error');
            return;
        }
    }
    
    // تعيين حالة الماسح كمفتوح
    isScannerOpen = true;
    
    console.log('فتح قارئ الباركود');
    
    const scannerModal = document.createElement('div');
    scannerModal.id = 'barcodeScannerModal'; // إضافة ID لسهولة التحقق
    scannerModal.className = 'modal';
    scannerModal.style.display = 'flex';
    scannerModal.style.zIndex = '20000'; // z-index أعلى لضمان الظهور فوق جميع النوافذ
    
    scannerModal.innerHTML = `
        <div class="modal-content" style="max-width: 650px; padding: 0; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color, #2196F3) 0%, var(--secondary-color, #64B5F6) 100%); color: white; border-radius: 12px 12px 0 0; padding: 25px 30px; border-bottom: none;">
                <h2 style="margin: 0; color: white; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                    <i class="bi bi-upc-scan" style="font-size: 1.3em;"></i> قارئ الباركود
                </h2>
                <button onclick="closeBarcodeScanner()" class="btn-close" style="color: white; font-size: 1.8em; opacity: 0.9; transition: all 0.3s ease;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity='0.9'; this.style.transform='scale(1)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px;">
                <div id="barcode-scanner-container" style="text-align: center;">
                    <div id="scanner-area" style="width: 100%; min-height: 350px; background: linear-gradient(135deg, var(--light-bg, #f5f5f5) 0%, #fafafa 100%); border: 2px dashed var(--border-color, #ddd); border-radius: 12px; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 25px; overflow: hidden; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="text-align: center; color: var(--text-light, #666); z-index: 1;">
                            <i class="bi bi-camera" style="font-size: 3em; margin-bottom: 15px; display: block; color: var(--primary-color, #2196F3); opacity: 0.7;"></i>
                            <p style="font-size: 1.1em; font-weight: 500; color: var(--text-dark, #333);">جاري تحميل قارئ الباركود...</p>
                        </div>
                    </div>
                    <div id="scanner-result" style="margin-top: 20px; display: none; animation: slideDown 0.3s ease;">
                        <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, var(--success-color, #4CAF50) 0%, #66BB6A 100%); color: white; border: none; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                <i class="bi bi-check-circle" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">تم العثور على الباركود!</h4>
                            </div>
                            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin-bottom: 20px; backdrop-filter: blur(10px);">
                                <p style="margin: 0 0 8px 0; font-size: 0.95em; opacity: 0.9;">رقم العملية:</p>
                                <p style="margin: 0; font-size: 1.5em; font-weight: 700; letter-spacing: 1px;" id="scanned-repair-number"></p>
                            </div>
                            <button onclick="searchRepairByNumber()" class="btn btn-primary" style="background: white; color: var(--success-color, #4CAF50); border: 2px solid white; padding: 12px 25px; font-weight: 600; border-radius: 8px; width: 100%; transition: all 0.3s ease; font-size: 1em;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255,255,255,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                <i class="bi bi-search"></i> البحث عن العملية
                            </button>
                        </div>
                    </div>
                    <div id="scanner-error" style="margin-top: 20px; display: none; animation: slideDown 0.3s ease;">
                        <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, var(--danger-color, #f44336) 0%, #e57373 100%); color: white; border: none; box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                <i class="bi bi-exclamation-triangle" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">خطأ في المسح</h4>
                            </div>
                            <p id="scanner-error-message" style="margin: 0; line-height: 1.6; opacity: 0.95;"></p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 30px; border-top: 1px solid var(--border-color, #e0e0e0); background: var(--light-bg, #fafafa); border-radius: 0 0 12px 12px;">
                <button onclick="retryBarcodeScanner()" class="btn btn-warning" style="background: var(--warning-color, #FFA500); color: white; border: none; padding: 12px 24px; font-weight: 600; border-radius: 8px; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255, 165, 0, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                </button>
                <button onclick="closeBarcodeScanner()" class="btn btn-secondary" style="background: var(--text-light, #666); color: white; border: none; padding: 12px 24px; font-weight: 600; border-radius: 8px; transition: all 0.3s ease;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 102, 102, 0.3)';" onmouseout="this.style.background='var(--text-light, #666)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    إغلاق
                </button>
            </div>
        </div>
        <style>
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;
    
    document.body.appendChild(scannerModal);
    
    // بدء تشغيل قارئ الباركود مع تأخير لضمان تحميل العناصر
    setTimeout(() => {
        initializeBarcodeScanner();
    }, 200);
    
    // إضافة مراقب لضمان عدم إغلاق النافذة أثناء تشغيل الكاميرا
    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            // منع إغلاق النافذة بالضغط خارجها أثناء تشغيل الكاميرا
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

async function initializeBarcodeScanner() {
    const scannerArea = document.getElementById('scanner-area');
    if (!scannerArea) return;

    // إضافة مؤشر التحميل مع تصميم محسن
    scannerArea.innerHTML = `
        <div style="text-align: center; color: var(--text-light, #666); padding: 40px 20px;">
            <i class="bi bi-camera" style="font-size: 3.5em; margin-bottom: 20px; display: block; color: var(--primary-color, #2196F3); opacity: 0.8; animation: pulse 2s ease-in-out infinite;"></i>
            <p style="font-size: 1.2em; font-weight: 600; color: var(--text-dark, #333); margin-bottom: 10px;">جاري تحميل مكتبة الباركود...</p>
            <div style="width: 200px; height: 4px; background: var(--light-bg, #e0e0e0); border-radius: 2px; margin: 20px auto; overflow: hidden;">
                <div style="width: 60%; height: 100%; background: var(--primary-color, #2196F3); border-radius: 2px; animation: loading 1.5s ease-in-out infinite;"></div>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.05); }
            }
            @keyframes loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(250%); }
            }
        </style>
    `;

    // تحميل Quagga إذا لم يكن محملاً
    if (typeof Quagga === 'undefined') {
        if (typeof window.loadQuagga === 'function') {
            try {
                await window.loadQuagga();
            } catch (error) {
                scannerArea.innerHTML = `
                    <div style="text-align: center; color: var(--danger-color, #f44336); padding: 20px;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                        <p style="font-size: 1.1em; font-weight: 500;">خطأ: فشل تحميل مكتبة الباركود</p>
                    </div>
                `;
                const errorDiv = document.getElementById('scanner-error');
                const errorMessage = document.getElementById('scanner-error-message');
                if (errorDiv && errorMessage) {
                    errorMessage.textContent = 'فشل تحميل مكتبة الباركود. يرجى إعادة المحاولة.';
                    errorDiv.style.display = 'block';
                }
                console.error('Failed to load Quagga:', error);
                return;
            }
        } else {
            scannerArea.innerHTML = `
                <div style="text-align: center; color: var(--danger-color, #f44336); padding: 20px;">
                    <i class="bi bi-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    <p style="font-size: 1.1em; font-weight: 500;">خطأ: مكتبة الباركود غير متاحة</p>
                </div>
            `;
            const errorDiv = document.getElementById('scanner-error');
            const errorMessage = document.getElementById('scanner-error-message');
            if (errorDiv && errorMessage) {
                errorMessage.textContent = 'مكتبة الباركود غير متاحة. يرجى التأكد من تحميل المكتبة.';
                errorDiv.style.display = 'block';
            }
            return;
        }
    }
    
    scannerArea.innerHTML = `
        <div style="text-align: center; color: var(--text-light, #666); padding: 40px 20px;">
            <i class="bi bi-camera-video" style="font-size: 3.5em; margin-bottom: 20px; display: block; color: var(--primary-color, #2196F3); opacity: 0.8; animation: pulse 2s ease-in-out infinite;"></i>
            <p style="font-size: 1.2em; font-weight: 600; color: var(--text-dark, #333); margin-bottom: 10px;">جاري تحميل الكاميرا...</p>
            <div style="width: 200px; height: 4px; background: var(--light-bg, #e0e0e0); border-radius: 2px; margin: 20px auto; overflow: hidden;">
                <div style="width: 60%; height: 100%; background: var(--primary-color, #2196F3); border-radius: 2px; animation: loading 1.5s ease-in-out infinite;"></div>
            </div>
        </div>
    `;

    // إعدادات محسنة للكاميرا
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
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "i2of5_reader"
            ],
            debug: {
                showCanvas: false,
                showPatches: false,
                showFoundPatches: false,
                showSkeleton: false,
                showLabels: false,
                showPatchLabels: false,
                showBoundingBox: false,
                showBoundingBoxes: false
            }
        },
        locate: true,
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: 2,
        frequency: 10,
        area: { // تحديد منطقة المسح
            top: "20%",
            right: "20%",
            left: "20%",
            bottom: "20%"
        }
    };

    // محاولة تشغيل الماسح مع إعادة المحاولة
    let attempts = 0;
    const maxAttempts = 3;

    function tryInit() {
        attempts++;
        
        Quagga.init(config, function(err) {
            if (err) {
                console.error(`محاولة ${attempts}: خطأ في تشغيل قارئ الباركود:`, err);
                
                if (attempts < maxAttempts) {
                    // إعادة المحاولة مع إعدادات أبسط
                    scannerArea.innerHTML = `
                        <div style="text-align: center; color: var(--text-light, #666); padding: 40px 20px;">
                            <i class="bi bi-arrow-clockwise" style="font-size: 3.5em; margin-bottom: 20px; display: block; color: var(--warning-color, #FFA500); animation: spin 1s linear infinite;"></i>
                            <p style="font-size: 1.2em; font-weight: 600; color: var(--text-dark, #333); margin-bottom: 10px;">إعادة المحاولة ${attempts}/${maxAttempts}...</p>
                            <div style="width: 200px; height: 4px; background: var(--light-bg, #e0e0e0); border-radius: 2px; margin: 20px auto; overflow: hidden;">
                                <div style="width: 60%; height: 100%; background: var(--warning-color, #FFA500); border-radius: 2px; animation: loading 1.5s ease-in-out infinite;"></div>
                            </div>
                        </div>
                        <style>
                            @keyframes spin {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                        </style>
                    `;
                    
                    setTimeout(() => {
                        // تبسيط الإعدادات في المحاولات التالية
                        if (attempts > 1) {
                            config.inputStream.constraints = {
                                width: 320,
                                height: 240,
                                facingMode: "environment"
                            };
                        }
                        tryInit();
                    }, 2000);
                } else {
                    // فشل في جميع المحاولات
                    scannerArea.innerHTML = `
                        <div style="text-align: center; padding: 30px 20px; color: var(--danger-color, #f44336);">
                            <i class="bi bi-exclamation-triangle" style="font-size: 3em; margin-bottom: 20px; display: block; color: var(--danger-color, #f44336);"></i>
                            <h4 style="margin-bottom: 20px; font-size: 1.3em; font-weight: 700; color: var(--text-dark, #333);">خطأ في تشغيل الكاميرا</h4>
                            <div style="background: rgba(244, 67, 54, 0.1); padding: 20px; border-radius: 10px; border-right: 4px solid var(--danger-color, #f44336); text-align: right; margin-bottom: 20px;">
                                <p style="margin-bottom: 15px; font-weight: 600; color: var(--text-dark, #333);">تأكد من:</p>
                                <ul style="text-align: right; margin: 0; padding-right: 20px; list-style-type: disc; color: var(--text-dark, #333); line-height: 2;">
                                    <li>منح إذن الوصول للكاميرا</li>
                                    <li>استخدام HTTPS</li>
                                    <li>وجود كاميرا خلفية</li>
                                </ul>
                            </div>
                        </div>
                    `;
                    const errorDiv = document.getElementById('scanner-error');
                    const errorMessage = document.getElementById('scanner-error-message');
                    if (errorDiv && errorMessage) {
                        errorMessage.innerHTML = 'فشل تشغيل الكاميرا بعد عدة محاولات. يرجى التأكد من منح إذن الوصول للكاميرا واستخدام HTTPS.';
                        errorDiv.style.display = 'block';
                    }
                }
                return;
            }
            
            // نجح التشغيل
            console.log('تم تشغيل قارئ الباركود بنجاح');
            scannerArea.innerHTML = '';
            
            try {
                Quagga.start();
                
                // إضافة مؤشر المسح
                const scanIndicator = document.createElement('div');
                scanIndicator.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(33, 150, 243, 0.9);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 12px;
                    z-index: 1000;
                `;
                scanIndicator.innerHTML = '<i class="bi bi-camera-video"></i> الكاميرا نشطة';
                scannerArea.appendChild(scanIndicator);
                
                // تم إزالة مراقب الاستقرار لتجنب الحلقة اللانهائية
                console.log('تم تشغيل قارئ الباركود بنجاح');
                
            } catch (startError) {
                console.error('خطأ في بدء الماسح:', startError);
                scannerArea.innerHTML = `
                    <div style="text-align: center; color: var(--danger-color, #f44336); padding: 20px;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                        <p style="font-size: 1.1em; font-weight: 500;">خطأ في بدء الماسح</p>
                    </div>
                `;
                const errorDiv = document.getElementById('scanner-error');
                const errorMessage = document.getElementById('scanner-error-message');
                if (errorDiv && errorMessage) {
                    errorMessage.textContent = 'حدث خطأ أثناء بدء تشغيل الماسح. يرجى إعادة المحاولة.';
                    errorDiv.style.display = 'block';
                }
                return;
            }
            
            // الاستماع لنتائج الباركود
            Quagga.onDetected(function(data) {
                const code = data.codeResult.code;
                console.log('تم قراءة الباركود:', code);
                
                // إيقاف الماسح بأمان
                try {
                    Quagga.stop();
                } catch (stopError) {
                    console.log('خطأ في إيقاف الماسح:', stopError);
                }
                
                // إخفاء رسالة الخطأ إن وجدت
                const errorDiv = document.getElementById('scanner-error');
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
                
                // البحث عن العملية مباشرة
                const repair = allRepairs.find(r => r.repair_number === code);
                
                if (repair) {
                    // تمييز العملية في الجدول
                    highlightRepairInTable(repair.id);
                    
                    // إغلاق قارئ الباركود تلقائياً
                    setTimeout(() => {
                        closeBarcodeScanner();
                        showMessage(`تم العثور على العملية: ${repair.customer_name}`, 'success');
                    }, 1000);
                } else {
                    // عرض رسالة عدم وجود العملية
                    const resultDiv = document.getElementById('scanner-result');
                    const numberSpan = document.getElementById('scanned-repair-number');
                    if (resultDiv && numberSpan) {
                        numberSpan.textContent = code;
                        resultDiv.style.display = 'block';
                    }
                }
                
                // حفظ رقم العملية للبحث
                window.scannedRepairNumber = code;
            });
        });
    }

    // بدء المحاولة الأولى
    tryInit();
}

function closeBarcodeScanner() {
    console.log('إغلاق قارئ الباركود');
    
    // تعيين حالة الماسح كمغلق
    isScannerOpen = false;
    
    // تم إزالة مراقب الاستقرار
    
    // إيقاف الماسح بأمان
    try {
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
            Quagga.offDetected(); // إزالة مستمعي الأحداث
        }
    } catch (e) {
        console.log('تم إيقاف الماسح بالفعل أو خطأ في الإيقاف:', e);
    }
    
    // إزالة النافذة
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
        modal.remove();
    }
    
    // تنظيف المتغيرات المؤقتة
    if (window.scannedRepairNumber) {
        delete window.scannedRepairNumber;
    }
}

// دالة إعادة المحاولة
function retryBarcodeScanner() {
    console.log('إعادة محاولة تشغيل قارئ الباركود');
    
    // التحقق من أن الماسح مفتوح
    if (!isScannerOpen) {
        console.log('الماسح غير مفتوح، لا يمكن إعادة المحاولة');
        return;
    }
    
    // تم إزالة مراقب الاستقرار
    
    // إيقاف الماسح الحالي فقط بدون إغلاق النافذة
    try {
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
            Quagga.offDetected();
        }
    } catch (e) {
        console.log('خطأ في إيقاف الماسح:', e);
    }
    
    // إعادة تشغيل الماسح بعد تأخير قصير
    setTimeout(() => {
        initializeBarcodeScanner();
    }, 500);
}

function searchRepairByNumber() {
    const repairNumber = window.scannedRepairNumber;
    if (!repairNumber) return;
    
    // البحث في جدول العمليات
    const repair = allRepairs.find(r => r.repair_number === repairNumber);
    
    if (repair) {
        // تمييز العملية في الجدول
        highlightRepairInTable(repair.id);
        closeBarcodeScanner();
        showMessage(`تم العثور على العملية: ${repair.customer_name}`, 'success');
    } else {
        showMessage('لم يتم العثور على العملية بهذا الرقم', 'error');
    }
}

function highlightRepairInTable(repairId) {
    // إزالة التمييز السابق
    document.querySelectorAll('.highlighted-row').forEach(row => {
        row.classList.remove('highlighted-row');
    });
    
    // تمييز الصف المطلوب
    const rows = document.querySelectorAll('#repairsTableBody tr');
    rows.forEach(row => {
        if (row.dataset.repairId === repairId) {
            row.classList.add('highlighted-row');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

// نموذج العمليات الخاسرة
function showLossOperationModal() {
    const lossModal = document.createElement('div');
    lossModal.className = 'modal';
    lossModal.style.display = 'flex';
    lossModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="bi bi-exclamation-triangle"></i> تسجيل عملية خاسرة</h2>
                <button onclick="closeLossOperationModal()" class="btn-close">&times;</button>
            </div>
            <form id="lossOperationForm" onsubmit="saveLossOperation(event)">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="lossRepairNumber">رقم العملية</label>
                        <input type="text" id="lossRepairNumber" placeholder="رقم العملية الخاسرة" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossCustomerName">اسم العميل</label>
                        <input type="text" id="lossCustomerName" placeholder="اسم العميل" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossDeviceType">نوع الجهاز</label>
                        <input type="text" id="lossDeviceType" placeholder="مثال: iPhone 12" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossProblem">تفاصيل المشكلة</label>
                        <textarea id="lossProblem" rows="3" placeholder="وصف تفصيلي للمشكلة التي أدت للخسارة" required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossAmount">تكلفة الخسارة (ج.م)</label>
                        <input type="number" id="lossAmount" step="0.01" min="0" placeholder="0.00" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossReason">سبب الخسارة</label>
                        <select id="lossReason" required>
                            <option value="">اختر سبب الخسارة</option>
                            <option value="device_damage">تلف الجهاز أثناء الإصلاح</option>
                            <option value="wrong_diagnosis">خطأ في التشخيص</option>
                            <option value="missing_parts">فقدان قطع غيار</option>
                            <option value="customer_dispute">نزاع مع العميل</option>
                            <option value="technical_error">خطأ تقني</option>
                            <option value="other">أسباب أخرى</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="lossNotes">ملاحظات إضافية</label>
                        <textarea id="lossNotes" rows="2" placeholder="ملاحظات إضافية حول الخسارة"></textarea>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" onclick="closeLossOperationModal()" class="btn btn-secondary">إلغاء</button>
                    <button type="submit" class="btn btn-danger">
                        <i class="bi bi-exclamation-triangle"></i> تسجيل الخسارة
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(lossModal);
}

function closeLossOperationModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

async function saveLossOperation(event) {
    event.preventDefault();
    
    const lossData = {
        repair_number: document.getElementById('lossRepairNumber').value.trim(),
        customer_name: document.getElementById('lossCustomerName').value.trim(),
        device_type: document.getElementById('lossDeviceType').value.trim(),
        problem: document.getElementById('lossProblem').value.trim(),
        loss_amount: parseFloat(document.getElementById('lossAmount').value),
        loss_reason: document.getElementById('lossReason').value,
        notes: document.getElementById('lossNotes').value.trim(),
        status: 'lost',
        created_at: new Date().toISOString()
    };
    
    // التحقق من البيانات المطلوبة
    if (!lossData.repair_number || !lossData.customer_name || !lossData.device_type || 
        !lossData.problem || !lossData.loss_amount || !lossData.loss_reason) {
        showMessage('جميع الحقول المطلوبة يجب أن تكون مملوءة', 'error');
        return;
    }
    
    try {
        const result = await API.addLossOperation(lossData);
        
        if (result.success) {
            showMessage('تم تسجيل العملية الخاسرة بنجاح', 'success');
            closeLossOperationModal();
            await loadRepairs();
            
            // تحديث لوحة التحكم
            if (typeof loadDashboardData === 'function') {
                await loadDashboardData();
            }
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في حفظ العملية الخاسرة:', error);
        showMessage('خطأ في حفظ العملية الخاسرة', 'error');
    }
}

// عرض تفاصيل العملية الخاسرة
function viewLossOperationDetails(lossId) {
    const lossOperation = allRepairs.find(r => r.id === lossId && r.is_loss_operation);
    if (!lossOperation) {
        showMessage('لم يتم العثور على العملية الخاسرة', 'error');
        return;
    }
    
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal';
    detailsModal.style.display = 'flex';
    detailsModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="bi bi-exclamation-triangle"></i> تفاصيل العملية الخاسرة</h2>
                <button onclick="closeLossDetailsModal()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loss-details">
                    <div class="detail-row">
                        <label>رقم العملية:</label>
                        <span>${lossOperation.repair_number}</span>
                    </div>
                    <div class="detail-row">
                        <label>اسم العميل:</label>
                        <span>${lossOperation.customer_name}</span>
                    </div>
                    <div class="detail-row">
                        <label>نوع الجهاز:</label>
                        <span>${lossOperation.device_type}</span>
                    </div>
                    <div class="detail-row">
                        <label>المشكلة:</label>
                        <span>${lossOperation.problem}</span>
                    </div>
                    <div class="detail-row">
                        <label>تكلفة الخسارة:</label>
                        <span class="loss-amount">${formatCurrency(lossOperation.cost)}</span>
                    </div>
                    <div class="detail-row">
                        <label>سبب الخسارة:</label>
                        <span>${getLossReasonText(lossOperation.loss_reason)}</span>
                    </div>
                    <div class="detail-row">
                        <label>التاريخ:</label>
                        <span>${formatDate(lossOperation.created_at)}</span>
                    </div>
                    ${lossOperation.loss_notes ? `
                    <div class="detail-row">
                        <label>ملاحظات:</label>
                        <span>${lossOperation.loss_notes}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeLossDetailsModal()" class="btn btn-secondary">إغلاق</button>
                <button onclick="deleteLossOperation('${lossOperation.id}')" class="btn btn-danger" data-permission="manager">
                    <i class="bi bi-trash3"></i> حذف العملية
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(detailsModal);
}

// إغلاق نافذة تفاصيل العملية الخاسرة
function closeLossDetailsModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// حذف العملية الخاسرة
async function deleteLossOperation(lossId) {
    if (!confirmAction('هل أنت متأكد من حذف هذه العملية الخاسرة؟')) return;
    
    try {
        const result = await API.deleteLossOperation(lossId);
        
        if (result.success) {
            showMessage('تم حذف العملية الخاسرة بنجاح', 'success');
            closeLossDetailsModal();
            await loadRepairs(true); // force = true بعد حذف العملية الخاسرة
            
            // تحديث لوحة التحكم
            if (typeof loadDashboardData === 'function') {
                await loadDashboardData();
            }
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف العملية الخاسرة:', error);
        showMessage('خطأ في حذف العملية الخاسرة', 'error');
    }
}

// الحصول على نص سبب الخسارة
function getLossReasonText(reason) {
    const reasons = {
        'device_damage': 'تلف الجهاز أثناء الإصلاح',
        'wrong_diagnosis': 'خطأ في التشخيص',
        'missing_parts': 'فقدان قطع غيار',
        'customer_dispute': 'نزاع مع العميل',
        'technical_error': 'خطأ تقني',
        'other': 'أسباب أخرى'
    };
    return reasons[reason] || reason;
}

// ✅ دالة مساعدة لـ escape HTML (للاستخدام في المودال)
function escapeHtmlForRepairs(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// إضافة حقل رقم فاتورة جديد
function addInvoiceField() {
    const container = document.getElementById('sparePartsInvoicesContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'invoice-number-row';
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px;';
    
    row.innerHTML = `
        <input type="text" class="invoice-number-input" placeholder="رقم الفاتورة" style="flex: 1;">
        <button type="button" class="btn btn-danger btn-sm remove-invoice-btn" onclick="removeInvoiceField(this)">
            <i class="bi bi-trash"></i>
        </button>
    `;
    
    container.appendChild(row);
    
    // إظهار أزرار الحذف إذا كان هناك أكثر من حقل واحد
    updateInvoiceRemoveButtons();
}

// حذف حقل رقم فاتورة
function removeInvoiceField(button) {
    const row = button.closest('.invoice-number-row');
    if (!row) return;
    
    const container = document.getElementById('sparePartsInvoicesContainer');
    if (!container) return;
    
    // التأكد من بقاء حقل واحد على الأقل
    const rows = container.querySelectorAll('.invoice-number-row');
    if (rows.length <= 1) return;
    
    row.remove();
    updateInvoiceRemoveButtons();
}

// تحديث حالة أزرار الحذف
function updateInvoiceRemoveButtons() {
    const container = document.getElementById('sparePartsInvoicesContainer');
    if (!container) return;
    
    const rows = container.querySelectorAll('.invoice-number-row');
    const removeButtons = container.querySelectorAll('.remove-invoice-btn');
    
    // إظهار/إخفاء أزرار الحذف بناءً على عدد الحقول
    removeButtons.forEach(btn => {
        if (rows.length > 1) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    });
}

// جلب أرقام الفواتير من النموذج
function getSparePartsInvoices() {
    const container = document.getElementById('sparePartsInvoicesContainer');
    if (!container) return [];
    
    const inputs = container.querySelectorAll('.invoice-number-input');
    const invoices = [];
    
    inputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            invoices.push(value);
        }
    });
    
    return invoices;
}

// تعيين أرقام الفواتير في النموذج
function setSparePartsInvoices(invoices) {
    const container = document.getElementById('sparePartsInvoicesContainer');
    if (!container) return;
    
    // مسح الحقول الحالية
    container.innerHTML = '';
    
    if (!invoices || invoices.length === 0) {
        // إضافة حقل واحد فارغ
        const row = document.createElement('div');
        row.className = 'invoice-number-row';
        row.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px;';
        row.innerHTML = `
            <input type="text" class="invoice-number-input" placeholder="رقم الفاتورة" style="flex: 1;">
            <button type="button" class="btn btn-danger btn-sm remove-invoice-btn" onclick="removeInvoiceField(this)" style="display: none;">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(row);
        return;
    }
    
    // إضافة حقول لكل رقم فاتورة
    invoices.forEach((invoice, index) => {
        const row = document.createElement('div');
        row.className = 'invoice-number-row';
        row.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px;';
        
        const showRemoveBtn = invoices.length > 1 ? 'inline-block' : 'none';
        
        row.innerHTML = `
            <input type="text" class="invoice-number-input" placeholder="رقم الفاتورة" value="${escapeHtml(invoice)}" style="flex: 1;">
            <button type="button" class="btn btn-danger btn-sm remove-invoice-btn" onclick="removeInvoiceField(this)" style="display: ${showRemoveBtn};">
                <i class="bi bi-trash"></i>
            </button>
        `;
        
        container.appendChild(row);
    });
}

// ✅ تصدير الدوال إلى window لجعلها متاحة عالمياً
window.onRepairBranchChange = onRepairBranchChange;
window.onCustomerTypeChange = onCustomerTypeChange;
window.onCustomerSourceChange = onCustomerSourceChange;
window.onCustomerSelectChange = onCustomerSelectChange;
window.addInvoiceField = addInvoiceField;
window.removeInvoiceField = removeInvoiceField;
window.handleDeviceTypeChange = handleDeviceTypeChange;


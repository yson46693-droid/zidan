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
                <select id="repairBranchFilter" onchange="loadRepairs(true)" class="filter-select" required style="${isOwner ? 'display: block;' : 'display: none;'} min-width: 180px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--white); color: var(--text-dark); font-size: 0.9em; cursor: pointer; position: relative; z-index: 10;">
                    <option value="">اختر الفرع</option>
                </select>
                <button onclick="openBarcodeScanner()" class="btn btn-info btn-sm" style="padding: 6px 12px; font-size: 0.85em;">
                    <i class="bi bi-upc-scan"></i> قارئ qr code الاستلام
                </button>
                <button onclick="showAddRepairModal()" class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size: 0.85em;">
                    <i class="bi bi-plus-circle"></i> إضافة عملية جديدة
                </button>
                <button onclick="showLossOperationModal()" class="btn btn-danger btn-sm" style="padding: 6px 12px; font-size: 0.85em;">
                    <i class="bi bi-exclamation-triangle"></i> تسجيل لبس/خساره
                </button>
            </div>
        </div>

        <!-- إحصائيات عمليات الصيانة جاهزة للتسليم -->
        <div id="readyForDeliveryStats" class="stats-container" style="display: block; margin: 0 auto 15px auto; padding: 12px 16px; background: var(--white); border-radius: 8px; box-shadow: var(--shadow); border: 1px solid var(--border-color); max-width: 400px; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;">
                <i class="bi bi-check-circle" style="font-size: 1.5em; color: var(--success-color);"></i>
                <div style="width: 100%;">
                    <div style="font-size: 0.85em; color: var(--text-light); margin-bottom: 6px;">إجمالي المتبقي للصيانات الجاهزة للتسليم</div>
                    <div id="totalReadyForDeliveryRemaining" style="font-size: 1.3em; font-weight: bold; color: var(--success-color);">0.00 ج.م</div>
                </div>
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
                <option value="customer_approved">تم الحصول علي الموافقه</option>
                <option value="in_progress">قيد الإصلاح</option>
                <option value="ready_for_delivery">جاهز للتسليم</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">عملية ملغية</option>
            </select>
            <input type="date" id="dateFromFilter" onchange="filterRepairs()" class="filter-select" placeholder="من تاريخ" title="من تاريخ">
            <input type="date" id="dateToFilter" onchange="filterRepairs()" class="filter-select" placeholder="إلى تاريخ" title="إلى تاريخ">
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

        <!-- حاوية البطاقات للهواتف -->
        <div class="repairs-mobile-container" id="repairsMobileContainer"></div>

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
                            <!-- ✅ تم إزالة العنصر المكرر - يتم استخدام selectedCustomerId من السطر 111 -->
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
                            <label for="devBrand">البراند*</label>
                            <select id="devBrand" required onchange="handleDeviceTypeChange(this)">
                                <option value="">اختر الماركة</option>
                                <option value="Samsung">Samsung</option>
                                <option value="Apple">Apple</option>
                                <option value="Xiaomi">Xiaomi</option>
                                <option value="Oppo">Oppo</option>
                                <option value="vivo">vivo</option>
                                <option value="Huawei">Huawei</option>
                                <option value="Realme">Realme</option>
                                <option value="OnePlus">OnePlus</option>
                                <option value="Google">Google</option>
                                <option value="Motorola">Motorola</option>
                                <option value="Nokia">Nokia</option>
                                <option value="Tecno">Tecno</option>
                                <option value="Infinix">Infinix</option>
                                <option value="Lenovo">Lenovo</option>
                                <option value="Sony">Sony</option>
                                <option value="Asus">Asus</option>
                                <option value="ZTE">ZTE</option>
                                <option value="Meizu">Meizu</option>
                                <option value="HTC">HTC</option>
                                <option value="Microsoft">Microsoft</option>
                                <option value="Acer">Acer</option>
                                <option value="alcatel">alcatel</option>
                                <option value="Lava">Lava</option>
                                <option value="أخرى">other</option>
                            </select>
                            <label for="deviceType">نوع الجهاز *</label>
                            <select id="deviceType" required onchange="handleDeviceTypeChange(this)">
                                <option value="">اختر الماركة</option>
                                <option value="Samsung">Samsung</option>
                                <option value="Apple">Apple</option>
                                <option value="Xiaomi">Xiaomi</option>
                                <option value="Oppo">Oppo</option>
                                <option value="vivo">vivo</option>
                                <option value="Huawei">Huawei</option>
                                <option value="Realme">Realme</option>
                                <option value="OnePlus">OnePlus</option>
                                <option value="Google">Google</option>
                                <option value="Motorola">Motorola</option>
                                <option value="Nokia">Nokia</option>
                                <option value="Tecno">Tecno</option>
                                <option value="Infinix">Infinix</option>
                                <option value="Lenovo">Lenovo</option>
                                <option value="Sony">Sony</option>
                                <option value="Asus">Asus</option>
                                <option value="ZTE">ZTE</option>
                                <option value="Meizu">Meizu</option>
                                <option value="HTC">HTC</option>
                                <option value="Microsoft">Microsoft</option>
                                <option value="Acer">Acer</option>
                                <option value="alcatel">alcatel</option>
                                <option value="Lava">Lava</option>
                                <option value="أخرى">other</option>
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
                            <input type="text" id="repairNumber" required readonly style="background: var(--light-bg); cursor: not-allowed;">
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
                            <input type="number" id="customerPrice" step="0.01" min="0" required oninput="calculateRemaining()">
                        </div>
                        <div class="form-group">
                            <label for="repairCost">تكلفة الإصلاح</label>
                            <input type="number" id="repairCost" step="0.01" min="0" value="0">
                        </div>
                        <div class="form-group" id="inspectionCostGroup" style="display: none;">
                            <label for="inspectionCost">تكلفة الكشف <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="inspectionCost" step="0.01" min="0" value="0">
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
                            <label for="paidAmount" id="paidAmountLabel">المبلغ المدفوع مقدماً</label>
                            <input type="number" id="paidAmount" step="0.01" min="0" value="0" oninput="calculateRemaining()">
                            <small id="paidAmountHint" style="color: var(--text-light); font-size: 0.85em; display: none;">يمكن للعملاء التجاريين الدفع بشكل جزئي - المتبقي يضاف للديون</small>
                        </div>
                        <div class="form-group">
                            <label for="remainingAmount" id="remainingAmountLabel">المتبقي</label>
                            <input type="number" id="remainingAmount" step="0.01" readonly style="background: var(--light-bg);">
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
                            <select id="status" onchange="toggleInspectionCostField()">
                                <option value="received">تم الاستلام</option>
                                <option value="under_inspection">قيد الفحص</option>
                                <option value="awaiting_customer_approval">بانتظار موافقة العميل</option>
                <option value="customer_approved">تم الحصول علي الموافقه</option>
                                <option value="in_progress">قيد الإصلاح</option>
                                <option value="ready_for_delivery">جاهز للتسليم</option>
                                <option value="delivered">تم التسليم</option>
                                <option value="cancelled">عملية ملغية</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" id="inspectionReportGroup">
                        <label for="inspectionReport">تقرير الفحص</label>
                        <textarea id="inspectionReport" rows="4" placeholder="أدخل تقرير الفحص..."></textarea>
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

        <!-- نموذج تسجيل عملية خاسرة -->
        <div id="lossOperationModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>تسجيل عملية خاسرة</h3>
                    <button onclick="closeLossOperationModal()" class="btn-close">&times;</button>
                </div>
                <form id="lossOperationForm" onsubmit="saveLossOperation(event)">
                    <div class="form-group">
                        <label for="lossRepairNumber">رقم عملية الصيانة *</label>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="lossRepairNumber" class="form-control" placeholder="أدخل رقم العملية" required style="flex: 1; min-width: 200px;">
                            <button type="button" onclick="openLossBarcodeScanner()" class="btn btn-info btn-sm" style="padding: 8px 16px; white-space: nowrap;">
                                <i class="bi bi-qr-code-scan"></i> <span class="d-none d-md-inline">QR Scanner</span>
                            </button>
                        </div>
                        <small id="lossRepairValidation" style="color: var(--text-light); font-size: 0.85em; display: block; margin-top: 5px;"></small>
                    </div>

                    <div id="lossRepairInfo" style="display: none; padding: 15px; background: var(--light-bg); border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 10px 0; color: var(--primary-color); font-size: 1em;">معلومات العملية:</h4>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 10px; font-size: 0.9em;">
                            <div><strong>العميل:</strong> <span id="lossCustomerName">-</span></div>
                            <div><strong>الجهاز:</strong> <span id="lossDeviceType">-</span></div>
                            <div><strong>المشكلة:</strong> <span id="lossProblem">-</span></div>
                            <div><strong>الفرع:</strong> <span id="lossBranchName">-</span></div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="lossAmount">مبلغ الخسارة (ج.م) *</label>
                        <input type="number" id="lossAmount" step="0.01" min="0" required class="form-control" placeholder="0.00">
                    </div>

                    <div class="form-group">
                        <label for="lossReason">سبب الخسارة *</label>
                        <textarea id="lossReason" rows="3" required class="form-control" placeholder="أدخل سبب الخسارة..."></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeLossOperationModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-danger">تسجيل الخسارة</button>
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
    
    // ✅ تحديث الإحصائيات بعد تحميل القسم مباشرة
    setTimeout(() => {
        updateReadyForDeliveryStats();
    }, 500);
    
    // ✅ إضافة event listener لرقم العملية في نموذج الخسارة
    const lossRepairNumberInput = document.getElementById('lossRepairNumber');
    if (lossRepairNumberInput) {
        // استخدام debounce لتقليل عدد الطلبات
        let validationTimeout;
        lossRepairNumberInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            validationTimeout = setTimeout(() => {
                onLossRepairNumberChange();
            }, 500);
        });
    }
    
    // ✅ لا يتم تحميل الفنيين هنا - يتم تحميلهم فقط عند فتح نموذج الإضافة/التعديل
}

// جلب الفنيين حسب الفرع المحدد
async function loadRepairTechnicians(branchId, preserveValue = false) {
    try {
        // ✅ الحصول على المستخدم الحالي أولاً
        const currentUser = getCurrentUser();
        if (!currentUser) {
            console.error('❌ [Repairs] لا يمكن تحميل الفنيين - المستخدم غير موجود');
            updateTechnicianSelect(preserveValue);
            return false;
        }
        
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // ✅ إذا لم يكن هناك فرع محدد، استخدام فرع المستخدم الحالي
        if (!branchId && currentUser && currentUser.branch_id) {
            branchId = currentUser.branch_id;
        }
        
        // جلب الفنيين والمالكين من API
        try {
            let url = 'technicians.php?include_admins=true';
            
            // ✅ إذا لم يكن هناك branchId، جلب المالكين فقط (بدون branch_id)
            if (!branchId) {
                // ✅ جلب المالكين فقط بدون branch_id (API سيسمح بذلك مع include_admins=true)
                // لا نضيف branch_id إلى URL
                // ملاحظة: هذا يحدث عندما يكون المستخدم غير مرتبط بفرع
            } else {
                // ✅ إذا كان branchId موجوداً
                // ✅ إذا لم يكن المستخدم مالك (technician, employee, manager)، إضافة include_all_users
                if (!isOwner && branchId) {
                    url += '&include_all_users=true';
                }
                url += `&branch_id=${encodeURIComponent(branchId)}`;
            }
            
            const techniciansResult = await API.request(url, 'GET');
            
            if (techniciansResult && techniciansResult.success) {
                // ✅ التحقق من وجود البيانات
                if (techniciansResult.data && Array.isArray(techniciansResult.data) && techniciansResult.data.length > 0) {
                    // ✅ حفظ البيانات بشكل دائم - لا يتم استبدالها إلا عند استدعاء جديد ناجح
                    repairTechnicians = techniciansResult.data;
                    // ✅ تحديث dropdown الفنيين مع معامل preserveValue
                    updateTechnicianSelect(preserveValue);
                    return true; // إرجاع true للإشارة إلى نجاح التحميل
                } else {
                    // ✅ لا نمسح البيانات الموجودة إذا فشل الطلب - نستخدم البيانات المحفوظة
                    if (repairTechnicians && repairTechnicians.length > 0) {
                        // إذا كانت هناك بيانات محفوظة، نستخدمها
                        updateTechnicianSelect(preserveValue);
                        return true; // إرجاع true لأن لدينا بيانات محفوظة
                    } else {
                        // لا توجد بيانات محفوظة ولا تم جلب بيانات جديدة
                        repairTechnicians = [];
                        updateTechnicianSelect(preserveValue);
                        return false; // إرجاع false للإشارة إلى فشل التحميل
                    }
                }
            } else {
                console.error('❌ [Repairs] فشل جلب الفنيين من API:', techniciansResult ? techniciansResult.message : 'خطأ غير معروف');
                // ✅ لا نمسح البيانات الموجودة إذا فشل الطلب - نستخدم البيانات المحفوظة
                if (repairTechnicians && repairTechnicians.length > 0) {
                    // إذا كانت هناك بيانات محفوظة، نستخدمها
                    updateTechnicianSelect(preserveValue);
                    return true; // إرجاع true لأن لدينا بيانات محفوظة
                } else {
                    // لا توجد بيانات محفوظة ولا تم جلب بيانات جديدة
                    repairTechnicians = [];
                    updateTechnicianSelect(preserveValue);
                    return false; // إرجاع false للإشارة إلى فشل التحميل
                }
            }
        } catch (error) {
            // ✅ لا نمسح البيانات الموجودة عند الخطأ - نستخدم البيانات المحفوظة
            if (repairTechnicians && repairTechnicians.length > 0) {
                // إذا كانت هناك بيانات محفوظة، نستخدمها
                updateTechnicianSelect(preserveValue);
                return true; // إرجاع true لأن لدينا بيانات محفوظة
            } else {
                // لا توجد بيانات محفوظة
                repairTechnicians = [];
                updateTechnicianSelect(preserveValue);
                return false; // إرجاع false للإشارة إلى فشل التحميل
            }
        }
    } catch (error) {                               
        // ✅ لا نمسح البيانات الموجودة عند الخطأ - نستخدم البيانات المحفوظة
        if (repairTechnicians && repairTechnicians.length > 0) {
            // إذا كانت هناك بيانات محفوظة
            updateTechnicianSelect(preserveValue);
            return true; // إرجاع true لأن لدينا بيانات محفوظة
        } else {
            // لا توجد بيانات محفوظة
            repairTechnicians = [];
            updateTechnicianSelect(preserveValue);
            return false; // إرجاع false للإشارة إلى فشل التحميل
        }
    }
}

// تحديث dropdown الفنيين
function updateTechnicianSelect(preserveValue = false) {
    const technicianSelect = document.getElementById('technicianSelect');
    if (!technicianSelect) return;
    
    // حفظ القيمة المحددة حالياً فقط إذا كان مطلوباً (في حالة التعديل)
    const currentValue = preserveValue ? technicianSelect.value : '';
    
    technicianSelect.innerHTML = '<option value="">اختر الفني...</option>';
    
    if (repairTechnicians.length === 0) {
        technicianSelect.innerHTML = '<option value="">لا يوجد فنيين متاحين</option>';
        return;
    }
    
    // ترتيب المستخدمين: المالكين أولاً، ثم حسب الدور
    const roleOrder = { 'admin': 1, 'manager': 2, 'technician': 3, 'employee': 4 };
    const sortedTechnicians = [...repairTechnicians].sort((a, b) => {
        const aOrder = roleOrder[a.role] || 5;
        const bOrder = roleOrder[b.role] || 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || '').localeCompare(b.name || '');
    });
    
    sortedTechnicians.forEach(technician => {
        const option = document.createElement('option');
        option.value = technician.id;
        
        // ✅ نص الدور بالعربية
        let roleText = 'فني صيانة';
        switch (technician.role) {
            case 'admin':
                roleText = 'مالك';
                break;
            case 'manager':
                roleText = 'مدير';
                break;
            case 'technician':
                roleText = 'فني صيانة';
                break;
            case 'employee':
                roleText = 'موظف';
                break;
        }
        
        option.textContent = `${technician.name || ''} (${roleText})`;
        technicianSelect.appendChild(option);
    });
    
    // ✅ استعادة القيمة المحددة فقط إذا كان preserveValue = true (في حالة التعديل)
    // ✅ في حالة الإضافة الجديدة، لا يتم تحديد أي فني تلقائياً
    if (preserveValue && currentValue && technicianSelect.querySelector(`option[value="${currentValue}"]`)) {
        technicianSelect.value = currentValue;
    } else {
        // ✅ التأكد من أن القيمة فارغة في حالة الإضافة الجديدة
        technicianSelect.value = '';
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
    
    // ✅ مسح قيمة الفني المستلم عند تغيير الفرع (لضمان عدم التحديد التلقائي)
    const technicianSelect = document.getElementById('technicianSelect');
    if (technicianSelect) {
        technicianSelect.value = '';
    }
    
    if (branchId) {
        await loadRepairCustomers(branchId, customerType);
        await loadRepairTechnicians(branchId);
    } else {
        repairCustomers = [];
        updateCustomerSelect();
        // ✅ لا نحمل الفنيين بدون branchId - نستخدم البيانات المحفوظة
    }
    
    // ✅ التأكد من أن الفني غير محدد بعد التحميل
    if (technicianSelect) {
        technicianSelect.value = '';
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
    
    // تحديث تسميات وأوصاف حقول الدفع للعملاء التجاريين
    const paidAmountLabel = document.getElementById('paidAmountLabel');
    const remainingAmountLabel = document.getElementById('remainingAmountLabel');
    const paidAmountHint = document.getElementById('paidAmountHint');
    const paidAmountInput = document.getElementById('paidAmount');
    
    if (customerType === 'commercial') {
        // للعملاء التجاريين: السماح بالدفع الجزئي
        if (paidAmountLabel) {
            paidAmountLabel.innerHTML = 'المبلغ المدفوع <span style="color: var(--danger-color);">*</span>';
        }
        if (remainingAmountLabel) {
            remainingAmountLabel.textContent = 'المتبقي (يضاف للديون)';
        }
        if (paidAmountHint) {
            paidAmountHint.style.display = 'block';
        }
        // تعيين القيمة الافتراضية إلى السعر الكامل
        if (paidAmountInput) {
            const customerPriceInput = document.getElementById('customerPrice');
            if (customerPriceInput && customerPriceInput.value) {
                paidAmountInput.value = parseFloat(customerPriceInput.value) || 0;
            } else {
                paidAmountInput.value = '0';
            }
            calculateRemaining();
        }
    } else {
        // للعملاء العاديين: السماح بالدفع الجزئي
        if (paidAmountLabel) {
            paidAmountLabel.textContent = 'المبلغ المدفوع مقدماً';
        }
        if (remainingAmountLabel) {
            remainingAmountLabel.textContent = 'المتبقي';
        }
        if (paidAmountHint) {
            paidAmountHint.style.display = 'none';
        }
        // إعادة تعيين القيمة
        if (paidAmountInput) {
            paidAmountInput.value = '0';
            calculateRemaining();
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
        return;
    }
    if (!force && (now - lastRepairBranchesLoadTime) < REPAIR_MIN_LOAD_INTERVAL) {
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
        // جلب جميع الفروع النشطة
        const result = await API.request('branches.php', 'GET');
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            repairBranches = result.data;
            
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
                await new Promise(resolve => setTimeout(resolve, 100));
                branchFilter = document.getElementById('repairBranchFilter');
                retries++;
            }
            
            if (branchFilter) {                
                // ✅ مسح الخيارات الحالية (بدون خيار "جميع الفروع")
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                
                if (repairBranches && repairBranches.length > 0) {
                    repairBranches.forEach((branch, index) => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchFilter.appendChild(option);
                    });
                    
                    // للمالك: ضبط الفرع الأول كقيمة افتراضية
                    if (isOwner && repairFirstBranchId) {
                        branchFilter.value = repairFirstBranchId;
                    }
                } else {
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    branchFilter.style.display = 'block';
                    branchFilter.style.visibility = 'visible';
                    branchFilter.style.opacity = '1';
                } else {
                    branchFilter.style.display = 'none';
                }
            } else {
                // محاولة أخيرة بعد تأخير أطول
                setTimeout(async () => {
                    const retryElement = document.getElementById('repairBranchFilter');
                    if (retryElement && repairBranches && repairBranches.length > 0) {
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
                    
                    // تحديد الفرع الأول كقيمة افتراضية للمالك
                    if (isOwner && repairFirstBranchId) {
                        branchSelect.value = repairFirstBranchId;
                    }
                } else {
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
            }
        } else {
            // إظهار رسالة خطأ للمستخدم
            if (result && !result.success) {
            } else if (!result) {
            } else if (!result.data) {
            } else if (!Array.isArray(result.data)) {
            }
        }
    } catch (error) {
        showMessage('حدث خطأ أثناء تحميل الفروع. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        isLoadingRepairBranches = false;
    }
}

// ✅ تحسين الأداء: دالة مساعدة لتحديث فلاتر الفروع من البيانات المحفوظة
function updateRepairBranchFilters() {
    try {
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        

        const branchFilter = document.getElementById('repairBranchFilter');
        if (branchFilter) {
            if (repairBranches && repairBranches.length > 0) {
                const currentValue = branchFilter.value;
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                repairBranches.forEach((branch, index) => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchFilter.appendChild(option);
                });
                if (currentValue) branchFilter.value = currentValue;
                branchFilter.style.display = isOwner ? 'block' : 'none';
            } else {
            }
        } else {
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
        const result = await API.request('branches.php', 'GET', null, { silent: true });
        if (!result) {
            return;
        }
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            // حفظ الفروع في المتغير العام
            repairBranches = result.data;
            
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
            }
            
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            
            // ملء Branch Filter في section-header - ملء الفروع دائماً
            const branchFilter = document.getElementById('repairBranchFilter');
            if (branchFilter) {                
                // ✅ مسح الخيارات الحالية (بدون خيار "جميع الفروع")
                branchFilter.innerHTML = '<option value="">اختر الفرع</option>';
                if (repairBranches && repairBranches.length > 0) {
                    repairBranches.forEach((branch, index) => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchFilter.appendChild(option);
                    });
                    // التحقق من أن الفروع تمت إضافتها
                    if (branchFilter.options.length <= 1) {
                    } else {
                    }
                    
                    // للمالك: ضبط الفرع الأول كقيمة افتراضية (الهانوفيل)
                    if (isOwner && repairFirstBranchId) {
                        branchFilter.value = repairFirstBranchId;
                    }
                } else {
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    branchFilter.style.display = 'block';
                } else {
                    branchFilter.style.display = 'none';
                }
            } else {
                // إعادة المحاولة بعد تأخير قصير
                setTimeout(() => {
                    const retryBranchFilter = document.getElementById('repairBranchFilter');
                    if (retryBranchFilter && repairBranches && repairBranches.length > 0) {
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
                    } else if (!retryBranchFilter) {
                    } else if (!repairBranches || repairBranches.length === 0) {
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
        return;
    }
    if (!force && (now - lastRepairsLoadTime) < REPAIRS_MIN_LOAD_INTERVAL) {
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
                } else {
                    // ✅ إذا لم يكن هناك ف
                    allRepairs = [];
                    displayRepairs();
                    return;
                }
            } else if (repairFirstBranchId) {
                // ✅ إذا لم يكن العنصر موجوداً لكن repairFirstBranchId موجود، نستخدمه
                branchId = repairFirstBranchId;
                selectedRepairBranchId = branchId;
            } else {
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
            allRepairs = [];
            filterRepairs(); // ✅ استخدام filterRepairs() بدلاً من displayRepairs() مباشرة
            return;
        }
        
        // ✅ تحسين: استخدام cache للطلبات المتكررة (يعمل تلقائياً في API.request)
        // تحميل البيانات بشكل متوازي مع استخدام cache
        // ✅ عند force = true، نستخدم skipCache لضمان الحصول على أحدث البيانات
        const cacheOptions = force ? { skipCache: true } : {};
        const repairsResult = await API.getRepairs(branchId, cacheOptions);
        
        if (repairsResult.success) {
            let repairs = repairsResult.data || [];
            
            // ✅ فلترة قطعية حسب branch_id - منع ظهور عمليات من فروع أخرى
            const branchIdStr = branchId ? String(branchId) : null;
            if (branchIdStr) {
                repairs = repairs.filter(repair => {
                    const repairBranchId = repair.branch_id ? String(repair.branch_id) : null;
                    const matches = repairBranchId === branchIdStr;
                    if (!matches) {
                        if (repairBranchId) {
                        } else {
                        }
                    }
                    return matches;
                });
                
            } else if (isOwner) {
                // ✅ للمالك: إذا لم يكن هناك branchId، لا نعرض أي عمليات
                repairs = [];
            } else {
                // ✅ للمستخدمين العاديين: فلترة حسب فرعهم
                const currentUser = getCurrentUser();
                const userBranchId = currentUser && currentUser.branch_id ? String(currentUser.branch_id) : null;
                if (userBranchId) {
                    repairs = repairs.filter(repair => {
                        const repairBranchId = repair.branch_id ? String(repair.branch_id) : null;
                        return repairBranchId === userBranchId;
                    });
                } else {
                    // ✅ إذا لم يكن للمستخدم فرع، لا نعرض أي عمليات
                    repairs = [];
                }
            }
            
            // ✅ تسجيل الحالات للتحقق من التحديث
            
            allRepairs = repairs;
            
            // ✅ تحسين: إعادة تطبيق قيمة الفرع المحدد على DOM بعد التحميل
            if (isOwner && branchId) {
                const branchFilter = document.getElementById('repairBranchFilter');
                if (branchFilter) {
                    branchFilter.value = String(branchId);
                    selectedRepairBranchId = String(branchId);
                }
            }
        } else {
            // ✅ التعامل مع حالة فشل API - عرض رسالة خطأ وتعيين قائمة فارغة
            
            // ✅ تحسين: إذا كانت البيانات من cache (offline mode)، نعرض رسالة مختلفة
            if (repairsResult.offline) {
                // إذا كانت هناك بيانات محفوظة، نستخدمها
                if (repairsResult.data && Array.isArray(repairsResult.data) && repairsResult.data.length > 0) {
                    allRepairs = repairsResult.data;
                    showMessage('تم تحميل البيانات من الذاكرة المؤقتة (وضع عدم الاتصال)', 'warning');
                } else {
                    allRepairs = [];
                    showMessage('لا يوجد اتصال بالإنترنت ولا توجد بيانات محفوظة محلياً', 'warning');
                }
            } else {
                // خطأ عادي (ليس offline)
                if (repairsResult.message) {
                    showMessage(repairsResult.message, 'error');
                }
                allRepairs = [];
            }
        }
        
        // ✅ إزالة استدعاء API.getUsers() لأن technician_name يأتي من API.getRepairs مباشرة
        // وإذا احتجنا لاسم الفني، يمكن استخدام repairTechnicians التي تم تحميلها مسبقاً
        
        // ✅ التأكد من استدعاء filterRepairs() دائماً لعرض الجدول (حتى لو كان فارغاً)
        filterRepairs();
        
        // ✅ تحديث إحصائيات العمليات جاهزة للتسليم
        updateReadyForDeliveryStats();
    } catch (error) {
        showMessage('خطأ في تحميل البيانات', 'error');
        // ✅ في حالة الخطأ، نعرض جدول فارغ بدلاً من عدم عرض الجدول
        allRepairs = [];
        filterRepairs();
        // ✅ تحديث الإحصائيات حتى في حالة الخطأ
        updateReadyForDeliveryStats();
    } finally {
        isLoadingRepairs = false;
    }
}

// ✅ دالة لتحديث إحصائيات العمليات جاهزة للتسليم
function updateReadyForDeliveryStats() {
    try {
        const statsContainer = document.getElementById('readyForDeliveryStats');
        const totalRemainingElement = document.getElementById('totalReadyForDeliveryRemaining');
        
        if (!statsContainer || !totalRemainingElement) {
            return;
        }
        
        // حساب إجمالي المتبقي من العمليات التي في حالة "جاهز للتسليم"
        let totalRemaining = 0;
        if (allRepairs && Array.isArray(allRepairs)) {
            const readyForDeliveryRepairs = allRepairs.filter(repair => {
                return repair.status === 'ready_for_delivery';
            });
            
            totalRemaining = readyForDeliveryRepairs.reduce((sum, repair) => {
                const remaining = parseFloat(repair.remaining_amount || 0);
                return sum + (isNaN(remaining) ? 0 : remaining);
            }, 0);
        }
        
        // تحديث القيمة
        totalRemainingElement.textContent = totalRemaining.toFixed(2) + ' ج.م';
        
        // ✅ إظهار الإحصائيات دائماً
        statsContainer.style.display = 'block';
        
    } catch (error) {
    }
}

// الحصول على اسم الفني من معرف المستخدم
function getTechnicianName(userId) {
    if (!userId) {
        return 'غير محدد';
    }
    
    // ✅ استخدام repairTechnicians بدلاً من allUsers (لا يتطلب صلاحيات admin)
    if (!repairTechnicians || repairTechnicians.length === 0) {
        // ✅ محاولة استخدام allUsers كبديل إذا كان محمّلاً (للمالكين فقط)
        if (allUsers && allUsers.length > 0) {
            const userIdStr = String(userId);
            const user = allUsers.find(u => {
                const uId = u.id ? String(u.id) : '';
                const uUserId = u.user_id ? String(u.user_id) : '';
                return uId === userIdStr || uUserId === userIdStr;
            });
            if (user && user.name) {
                return user.name;
            }
        }               
        return 'غير محدد';
    }
    
    // ✅ البحث في repairTechnicians
    const userIdStr = String(userId);
    const technician = repairTechnicians.find(t => {
        const tId = t.id ? String(t.id) : '';
        return tId === userIdStr;
    });
    
    if (technician && technician.name) {
        return technician.name;
    }
    
    return 'غير محدد';
}

// ✅ تحديث اسم الفني المستلم في القائمة المنسدلة (تم إزالة التحديد التلقائي)
function updateTechnicianName() {
    // ✅ تم إزالة التحديد التلقائي للمستخدم الحالي - يجب اختيار الفني يدوياً من النموذج
    // هذه الدالة موجودة للتوافق فقط، لكنها لا تقوم بأي تحديد تلقائي
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
        return;
    }
    
    const statusFilter = statusFilterElement.value;
    const dateFromElement = document.getElementById('dateFromFilter');
    const dateToElement = document.getElementById('dateToFilter');
    const dateFrom = dateFromElement ? dateFromElement.value : '';
    const dateTo = dateToElement ? dateToElement.value : '';
    
    let filtered = allRepairs;

    // ✅ فلترة قطعية حسب branch_id - منع ظهور عمليات من فروع أخرى
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    let targetBranchId = null;
    
    if (isOwner) {
        // للمالك: استخدام الفرع المحدد
        const branchFilter = document.getElementById('repairBranchFilter');
        if (branchFilter && branchFilter.value) {
            targetBranchId = String(branchFilter.value);
        } else if (selectedRepairBranchId) {
            targetBranchId = String(selectedRepairBranchId);
        } else if (repairFirstBranchId) {
            targetBranchId = String(repairFirstBranchId);
        }
    } else {
        // للمستخدمين العاديين: استخدام فرعهم
        targetBranchId = currentUser && currentUser.branch_id ? String(currentUser.branch_id) : null;
    }
    
    if (targetBranchId) {
        filtered = filtered.filter(r => {
            const repairBranchId = r.branch_id ? String(r.branch_id) : null;
            if (repairBranchId !== targetBranchId) {
                return false;
            }
            return true;
        });
    } else if (isOwner) {
        // ✅ للمالك: إذا لم يكن هناك branchId، لا نعرض أي عمليات
        filtered = [];
    } else {
        // ✅ للمستخدمين العاديين: إذا لم يكن لهم فرع، لا نعرض أي عمليات
        filtered = [];
    }

    // فلترة حسب نوع الصيانة
    filtered = filtered.filter(r => {
        return (r.repair_type || 'soft') === currentRepairType;
    });

    // فلترة حسب الحالة
    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }

    // فلترة حسب التاريخ
    if (dateFrom || dateTo) {
        filtered = filtered.filter(r => {
            if (!r.created_at) return false;
            
            try {
                const repairDate = new Date(r.created_at);
                repairDate.setHours(0, 0, 0, 0); // إزالة الوقت للمقارنة
                
                if (dateFrom && dateTo) {
                    // فلترة بين تاريخين
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999); // نهاية اليوم
                    return repairDate >= fromDate && repairDate <= toDate;
                } else if (dateFrom) {
                    // فلترة من تاريخ
                    const fromDate = new Date(dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    return repairDate >= fromDate;
                } else if (dateTo) {
                    // فلترة إلى تاريخ
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999); // نهاية اليوم
                    return repairDate <= toDate;
                }
                
                return true;
            } catch (error) {
                return true; // في حالة الخطأ، نعرض العملية
            }
        });
    }

    displayRepairs(filtered);
    
    // ✅ تحديث إحصائيات العمليات جاهزة للتسليم
    updateReadyForDeliveryStats();
}

function displayRepairs(repairs) {
    // ✅ التأكد من أن repairs موجودة
    if (!repairs || !Array.isArray(repairs)) {
        repairs = [];
    }
    
    const paginated = paginate(repairs, currentRepairPage, repairsPerPage);
    const tbody = document.getElementById('repairsTableBody');
    
    // ✅ التأكد من وجود tbody قبل التعديل
    if (!tbody) {
        return;
    }

    // ✅ التحقق من حجم الشاشة لعرض البطاقات على الهواتف
    const isMobile = window.innerWidth <= 575.98;
    const mobileContainer = document.getElementById('repairsMobileContainer');
    
    if (paginated.data.length === 0) {
        if (isMobile && mobileContainer) {
            mobileContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">لا توجد عمليات</div>';
        } else if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">لا توجد عمليات</td></tr>';
        }
        return;
    }

    // ✅ التحقق من صلاحيات المستخدم (مالك)
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');

    const tableRowsHTML = paginated.data.map(repair => {
        // ✅ إصلاح: التأكد من وجود حالة افتراضية
        const repairStatus = repair.status || 'received';
        // ✅ تسجيل الحالة للتحقق من التحديث - تسجيل جميع الحالات للتحقق
        const statusBadge = `<span class="status-badge" style="background: ${getStatusColor(repairStatus)}">${getStatusText(repairStatus)}</span>`;
        
        // ✅ إصلاح: استخدام customer_price بدلاً من cost
        const repairCost = repair.customer_price || repair.cost || 0;
        
        // ✅ التحقق من إمكانية التعديل: 
        // - يمكن التعديل إذا لم تكن الحالة "cancelled" أو "delivered"
        // - يمكن التعديل للعمليات الملغاة دائماً (لأي مستخدم)
        // - المالك يمكنه التعديل دائماً
        const canEditCancelled = repairStatus === 'cancelled';
        const canEdit = isOwner || (repairStatus !== 'cancelled' && repairStatus !== 'delivered') || canEditCancelled;
        
        // قائمة الإجراءات المنسدلة
        const deleteButtonHTML = hasPermission('manager') ? `
            <div class="actions-dropdown-item delete-item" onclick="deleteRepair('${repair.id}'); closeActionsDropdown(event);">
                <i class="bi bi-trash3"></i>
                <div class="actions-dropdown-item-text">
                    <span class="actions-dropdown-item-title">حذف</span>
                    <span class="actions-dropdown-item-desc">حذف العملية من النظام</span>
                </div>
            </div>
        ` : '';
        
        const actionButtons = `
            <div class="actions-dropdown">
                <button type="button" class="actions-dropdown-btn" onclick="toggleActionsDropdown(event, '${repair.id}')">
                    <i class="bi bi-list"></i>
                    <span>الإجراءات</span>
                    <i class="bi bi-chevron-down" style="font-size: 0.8em;"></i>
            </button>
                <div class="actions-dropdown-menu" id="actions-menu-${repair.id}">
                    <div class="actions-dropdown-item" onclick="printRepairReceipt('${repair.id}'); closeActionsDropdown(event);">
                        <i class="bi bi-receipt"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">طباعة الإيصال</span>
                            <span class="actions-dropdown-item-desc">طباعة إيصال استلام العملية</span>
                        </div>
                    </div>
                    <div class="actions-dropdown-item" onclick="generateBarcodeLabel('${repair.id}'); closeActionsDropdown(event);">
                <i class="bi bi-upc-scan"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">باركود وملصق</span>
                            <span class="actions-dropdown-item-desc">إنشاء وطباعة باركود وملصق</span>
                        </div>
                    </div>
                    <div class="actions-dropdown-item" onclick="openTrackingLinkForRepair('${repair.id}'); closeActionsDropdown(event);">
                        <i class="bi bi-link-45deg"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">رابط المتابعة</span>
                            <span class="actions-dropdown-item-desc">إرسال رابط متابعة العملية للعميل</span>
                        </div>
                    </div>
                    ${canEdit ? `
                    <div class="actions-dropdown-item" onclick="editRepair('${repair.id}'); closeActionsDropdown(event);">
                        <i class="bi bi-pencil-square"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">تعديل</span>
                            <span class="actions-dropdown-item-desc">تعديل بيانات العملية</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="actions-dropdown-item mobile-only" onclick="showRepairDetails('${repair.id}'); closeActionsDropdown(event);">
                        <i class="bi bi-info-circle"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">عرض التفاصيل</span>
                            <span class="actions-dropdown-item-desc">عرض الحالة، الفني المستلم، والتاريخ</span>
                        </div>
                    </div>
                    <div class="actions-dropdown-item" onclick="showRepairImage('${repair.id}'); closeActionsDropdown(event);">
                        <i class="bi bi-image"></i>
                        <div class="actions-dropdown-item-text">
                            <span class="actions-dropdown-item-title">صورة الجهاز</span>
                            <span class="actions-dropdown-item-desc">عرض صورة الجهاز الملتقطة أو المحفوظة</span>
                        </div>
                    </div>
                    ${deleteButtonHTML}
                </div>
            </div>
        `;

        // ✅ زر الاتصال برقم الهاتف
        const phoneNumber = repair.customer_phone || '';
        const cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // إزالة جميع الأحرف غير الرقمية
        const phoneButton = phoneNumber ? 
            `<a href="tel:${cleanPhoneNumber}" class="btn btn-sm btn-success" style="display: inline-flex; align-items: center; gap: 5px; text-decoration: none; padding: 5px 10px;" title="اتصال بـ ${phoneNumber}">
                <i class="bi bi-telephone-fill"></i>
            </a>` : 
            '<span>-</span>';

        // رقم العملية قابل للنسخ
        const repairNumber = repair.repair_number || '-';
        const repairNumberCell = repairNumber !== '-' ? `
            <span class="repair-number-copyable" 
                  onclick="copyRepairNumber('${repairNumber}', this)" 
                  title="اضغط للنسخ: ${repairNumber}"
                  style="cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; user-select: none;"
                  onmouseover="this.style.background='var(--light-bg)'; this.style.color='var(--primary-color)'"
                  onmouseout="this.style.background='transparent'; this.style.color='inherit'">
                <strong>${repairNumber}</strong>
                <i class="bi bi-copy" style="font-size: 0.85em; opacity: 0.6;"></i>
            </span>
        ` : '<strong>-</strong>';
        
        return `
            <tr data-repair-id="${repair.id}">
                <td>${repairNumberCell}</td>
                <td>${repair.customer_name || '-'}</td>
                <td>${phoneButton}</td>
                <td>${repair.device_type || ''} ${repair.device_model || ''}</td>
                <td>${repair.problem || '-'}</td>
                <td>${formatCurrency(repairCost)}</td>
                <td>${statusBadge}</td>
                <td><span class="technician-name">${repair.technician_name || getTechnicianName(repair.created_by) || 'غير محدد'}</span></td>
                <td>${formatDate(repair.created_at)}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
    
    // ✅ عرض البطاقات على الهواتف
    if (isMobile && mobileContainer) {
        const mobileCardsHTML = paginated.data.map(repair => {
            const repairStatus = repair.status || 'received';
            const statusBadge = `<span class="status-badge" style="background: ${getStatusColor(repairStatus)}; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; color: white;">${getStatusText(repairStatus)}</span>`;
            const repairCost = repair.customer_price || repair.cost || 0;
            const phoneNumber = repair.customer_phone || '';
            const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
            const phoneButton = phoneNumber ? 
                `<a href="tel:${cleanPhoneNumber}" class="btn btn-sm btn-success" style="display: inline-flex; align-items: center; gap: 5px; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 0.9em;">
                    <i class="bi bi-telephone-fill"></i> اتصال
                </a>` : '';
            const canEditCancelled = repairStatus === 'cancelled';
            const canEdit = isOwner || (repairStatus !== 'cancelled' && repairStatus !== 'delivered') || canEditCancelled;
            
            // ✅ إنشاء قائمة الإجراءات للبطاقات
            const deleteButtonHTML = hasPermission('manager') ? `
                <div class="actions-dropdown-item delete-item" onclick="deleteRepair('${repair.id}'); closeActionsDropdown(event);">
                    <i class="bi bi-trash3"></i>
                    <div class="actions-dropdown-item-text">
                        <span class="actions-dropdown-item-title">حذف</span>
                        <span class="actions-dropdown-item-desc">حذف العملية من النظام</span>
                    </div>
                </div>
            ` : '';
            
            const actionButtons = `
                <div class="actions-dropdown">
                    <button type="button" class="actions-dropdown-btn" onclick="toggleActionsDropdown(event, '${repair.id}')">
                        <i class="bi bi-list"></i>
                        <span>الإجراءات</span>
                        <i class="bi bi-chevron-down" style="font-size: 0.8em;"></i>
                    </button>
                    <div class="actions-dropdown-menu" id="actions-menu-${repair.id}">
                        <div class="actions-dropdown-item" onclick="printRepairReceipt('${repair.id}'); closeActionsDropdown(event);">
                            <i class="bi bi-receipt"></i>
                            <div class="actions-dropdown-item-text">
                                <span class="actions-dropdown-item-title">طباعة الإيصال</span>
                                <span class="actions-dropdown-item-desc">طباعة إيصال استلام العملية</span>
                            </div>
                        </div>
                        <div class="actions-dropdown-item" onclick="generateBarcodeLabel('${repair.id}'); closeActionsDropdown(event);">
                            <i class="bi bi-upc-scan"></i>
                            <div class="actions-dropdown-item-text">
                                <span class="actions-dropdown-item-title">باركود وملصق</span>
                                <span class="actions-dropdown-item-desc">إنشاء وطباعة باركود وملصق</span>
                            </div>
                        </div>
                        <div class="actions-dropdown-item" onclick="openTrackingLinkForRepair('${repair.id}'); closeActionsDropdown(event);">
                            <i class="bi bi-link-45deg"></i>
                            <div class="actions-dropdown-item-text">
                                <span class="actions-dropdown-item-title">رابط المتابعة</span>
                                <span class="actions-dropdown-item-desc">إرسال رابط متابعة العملية للعميل</span>
                            </div>
                        </div>
                        ${canEdit ? `
                        <div class="actions-dropdown-item" onclick="editRepair('${repair.id}'); closeActionsDropdown(event);">
                            <i class="bi bi-pencil-square"></i>
                            <div class="actions-dropdown-item-text">
                                <span class="actions-dropdown-item-title">تعديل</span>
                                <span class="actions-dropdown-item-desc">تعديل بيانات العملية</span>
                            </div>
                        </div>
                        ` : ''}
                        <div class="actions-dropdown-item" onclick="showRepairImage('${repair.id}'); closeActionsDropdown(event);">
                            <i class="bi bi-image"></i>
                            <div class="actions-dropdown-item-text">
                                <span class="actions-dropdown-item-title">صورة الجهاز</span>
                                <span class="actions-dropdown-item-desc">عرض صورة الجهاز الملتقطة أو المحفوظة</span>
                            </div>
                        </div>
                        ${deleteButtonHTML}
                    </div>
                </div>
            `;
            
            return `
                <div class="repair-mobile-card" data-repair-id="${repair.id}" style="background: var(--white); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; margin-bottom: 12px; box-shadow: var(--shadow);">
                    <!-- الرأس: رقم العملية والعميل والحالة -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1em; color: var(--primary-color); margin-bottom: 4px;">
                                ${repair.repair_number || '-'}
                            </div>
                            <div style="font-size: 0.9em; color: var(--text-dark);">
                                ${repair.customer_name || '-'}
                            </div>
                        </div>
                        <div style="text-align: left;">
                            ${statusBadge}
                        </div>
                    </div>
                    
                    <!-- الأزرار: الاتصال والإجراءات في نفس الصف -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                        ${phoneButton ? `<div>${phoneButton}</div>` : '<div></div>'}
                        <div>${actionButtons}</div>
                    </div>
                    
                    <!-- التفاصيل: عمودين -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px;">
                        <!-- الجهاز والمشكلة في نفس الصف -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                            <div style="font-size: 0.85em; color: var(--text-light);">
                                <strong style="color: var(--text-dark);">الجهاز:</strong><br>
                                <span style="font-size: 0.9em;">${repair.device_type || ''} ${repair.device_model || ''}</span>
                            </div>
                            <div style="font-size: 0.85em; color: var(--text-light);">
                                <strong style="color: var(--text-dark);">المشكلة:</strong><br>
                                <span style="font-size: 0.9em;">${repair.problem || '-'}</span>
                            </div>
                        </div>
                        
                        <!-- التكلفة والفني في نفس الصف -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                            <div style="font-size: 0.85em; color: var(--text-light);">
                                <strong style="color: var(--text-dark);">التكلفة:</strong><br>
                                <span style="color: var(--primary-color); font-weight: bold; font-size: 0.95em;">${formatCurrency(repairCost)}</span>
                            </div>
                            <div style="font-size: 0.85em; color: var(--text-light);">
                                <strong style="color: var(--text-dark);">الفني:</strong><br>
                                <span style="font-size: 0.9em;">${repair.technician_name || getTechnicianName(repair.created_by) || 'غير محدد'}</span>
                            </div>
                        </div>
                        
                        <!-- التاريخ في صف منفصل -->
                        <div style="font-size: 0.85em; color: var(--text-light); text-align: center; padding-top: 8px; border-top: 1px solid var(--border-color);">
                            <strong style="color: var(--text-dark);">التاريخ:</strong> ${formatDate(repair.created_at)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        mobileContainer.innerHTML = mobileCardsHTML;
        // ✅ إعداد event delegation لإغلاق القوائم المنسدلة عند النقر خارجها
        setupActionsDropdownListeners();
    } else if (tbody) {
        tbody.innerHTML = tableRowsHTML;
    }

    // إنشاء pagination مع معلومات إضافية
    const paginationContainer = document.getElementById('repairsPagination');
    if (paginationContainer) {
        // إضافة معلومات عن عدد العناصر المعروضة
        const startItem = ((currentRepairPage - 1) * repairsPerPage) + 1;
        const endItem = Math.min(currentRepairPage * repairsPerPage, paginated.totalItems);
        
        createPaginationButtons(
            paginationContainer,
            paginated.totalPages,
            currentRepairPage,
            (page) => {
                currentRepairPage = page;
                filterRepairs();
                
                // Scroll to top of table
                const tableContainer = document.querySelector('.table-container');
                if (tableContainer) {
                    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        );
        
        // إضافة معلومات Pagination (إزالة القديم أولاً إذا كان موجوداً)
        const existingInfo = paginationContainer.querySelector('.pagination-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        if (paginated.totalPages > 1) {
            const paginationInfo = document.createElement('div');
            paginationInfo.className = 'pagination-info';
            paginationInfo.style.cssText = 'margin-top: 15px; text-align: center; color: var(--text-light); font-size: 0.9em;';
            paginationInfo.textContent = `عرض ${startItem}-${endItem} من ${paginated.totalItems} عملية`;
            paginationContainer.appendChild(paginationInfo);
        }
    }

    hideByPermission();
    
    // ✅ إعداد event delegation لإغلاق القوائم المنسدلة عند النقر خارجها
    setupActionsDropdownListeners();
}

// ✅ دالة نسخ رقم العملية
function copyRepairNumber(repairNumber, element) {
    if (!repairNumber || repairNumber === '-') {
        return;
    }
    
    try {
        // استخدام Clipboard API إذا كان متاحاً
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(repairNumber).then(() => {
                showMessage(`تم نسخ رقم العملية: ${repairNumber}`, 'success');
                
                // تغيير الأيقونة مؤقتاً
                if (element) {
                    const icon = element.querySelector('i');
                    if (icon) {
                        const originalClass = icon.className;
                        icon.className = 'bi bi-check-circle';
                        icon.style.color = 'var(--success-color)';
                        
                        setTimeout(() => {
                            icon.className = originalClass;
                            icon.style.color = '';
                        }, 2000);
                    }
                }
            }).catch(err => {
                console.error('خطأ في النسخ:', err);
                fallbackCopyRepairNumber(repairNumber);
            });
        } else {
            // استخدام طريقة احتياطية
            fallbackCopyRepairNumber(repairNumber);
        }
    } catch (error) {
        console.error('خطأ في نسخ رقم العملية:', error);
        fallbackCopyRepairNumber(repairNumber);
    }
}

// دالة نسخ احتياطية
function fallbackCopyRepairNumber(repairNumber) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = repairNumber;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showMessage(`تم نسخ رقم العملية: ${repairNumber}`, 'success');
        } else {
            showMessage('فشل نسخ رقم العملية', 'error');
        }
    } catch (err) {
        console.error('خطأ في النسخ الاحتياطي:', err);
        showMessage('فشل نسخ رقم العملية', 'error');
    }
}

// ✅ دوال إدارة قائمة الإجراءات المنسدلة
function setupActionsDropdownListeners() {
    // استخدام event delegation لإغلاق القوائم المنسدلة عند النقر خارجها
    // يتم استدعاء هذه الدالة مرة واحدة فقط
    if (window.actionsDropdownListenerSetup) return;
    window.actionsDropdownListenerSetup = true;
    
    document.addEventListener('click', (e) => {
        // التحقق من أن النقر ليس داخل قائمة منسدلة أو زرها
        const dropdown = e.target.closest('.actions-dropdown');
        if (!dropdown) {
            // إغلاق جميع القوائم المنسدلة المفتوحة
            closeAllActionsDropdowns();
        }
    });
}

function toggleActionsDropdown(event, repairId) {
    // منع انتشار الحدث
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    try {
        const menuId = `actions-menu-${repairId}`;
        const menu = document.getElementById(menuId);
        
        if (!menu) {
            console.warn('القائمة المنسدلة غير موجودة:', menuId);
            return;
        }
        
        // إغلاق جميع القوائم المنسدلة الأخرى
        closeAllActionsDropdowns(menuId);
        
        // تبديل حالة القائمة الحالية
        if (menu.classList.contains('show')) {
            menu.classList.remove('show');
            // ✅ إعادة القائمة إلى مكانها الأصلي إذا كانت في body
            if (menu._originalParent && menu.parentElement === document.body) {
                try {
                    menu._originalParent.appendChild(menu);
                    delete menu._originalParent;
                    delete menu.dataset.originalParent;
                } catch (error) {
                    console.warn('تعذر إعادة القائمة إلى مكانها الأصلي:', error);
                }
            }
            // ✅ إعادة تعيين جميع الأنماط عند الإغلاق
            menu.style.position = '';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.right = '';
            menu.style.left = '';
            menu.style.zIndex = '';
            menu.style.maxHeight = '';
            menu.style.overflowY = '';
            menu.style.visibility = '';
            menu.style.display = '';
            menu.style.width = '';
        } else {
            // ✅ إصلاح: استخدام fixed positioning دائماً مع التحقق من حدود الشاشة
            const dropdown = menu.closest('.actions-dropdown');
            
            if (dropdown) {
                // ✅ حفظ المرجع الأصلي للقائمة قبل نقلها
                if (!menu.dataset.originalParent) {
                    // حفظ العنصر الأصلي مباشرة في dataset
                    const originalParent = menu.parentElement;
                    if (originalParent) {
                        menu.dataset.originalParent = originalParent.id || 
                            originalParent.className.split(' ')[0] || 
                            'actions-dropdown';
                        // حفظ مرجع إضافي للعنصر الأصلي
                        menu._originalParent = originalParent;
                    }
                }
                
                // ✅ نقل القائمة إلى body لتجنب مشاكل overflow في الحاويات
                if (menu.parentElement !== document.body) {
                    document.body.appendChild(menu);
                }
                
                // ✅ إعادة تعيين جميع الأنماط أولاً لضمان عدم وجود قيم قديمة
                menu.style.position = '';
                menu.style.top = '';
                menu.style.bottom = '';
                menu.style.right = '';
                menu.style.left = '';
                menu.style.zIndex = '';
                menu.style.maxHeight = '';
                menu.style.overflowY = '';
                menu.style.visibility = '';
                menu.style.display = '';
                menu.style.width = '';
                
                // حساب الموضع باستخدام fixed positioning
                const dropdownRect = dropdown.getBoundingClientRect();
                const padding = 10; // padding من حواف الشاشة
                
                // عرض القائمة بعد إظهارها مؤقتاً لحساب العرض الفعلي
                menu.style.visibility = 'hidden';
                menu.style.display = 'block';
                menu.style.position = 'fixed';
                // ✅ الحفاظ على العرض الأصلي للقائمة
                const originalWidth = menu.offsetWidth || 220;
                menu.style.width = originalWidth + 'px';
                const menuRect = menu.getBoundingClientRect();
                const menuWidth = menuRect.width || 220;
                const menuHeight = menuRect.height || 300;
                menu.style.visibility = '';
                
                // حساب الموضع الأفقي (يمين)
                let rightPosition = window.innerWidth - dropdownRect.right;
                
                // ✅ التحقق من أن القائمة لا تخرج من الشاشة على اليمين
                if (rightPosition + menuWidth > window.innerWidth - padding) {
                    // إذا كانت ستخرج، نضعها على اليسار بدلاً من اليمين
                    menu.style.left = Math.max(padding, dropdownRect.left - menuWidth) + 'px';
                    menu.style.right = 'auto';
                } else {
                    menu.style.right = Math.max(padding, rightPosition) + 'px';
                    menu.style.left = 'auto';
                }
                
                // ✅ إصلاح: حساب الموضع العمودي - اختيار الاتجاه بناءً على المساحة المتاحة
                const spaceAbove = dropdownRect.top - padding;
                const spaceBelow = window.innerHeight - dropdownRect.bottom - padding;
                const gap = 5; // المسافة بين الزر والقائمة
                
                let topPosition;
                let maxHeight;
                
                // اختيار الاتجاه بناءً على المساحة المتاحة
                if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
                    // ✅ فتح القائمة للأسفل إذا كانت المساحة كافية أو أكبر من الأعلى
                    topPosition = dropdownRect.bottom + gap;
                    const availableHeight = window.innerHeight - topPosition - padding;
                    maxHeight = Math.min(menuHeight, availableHeight);
                    menu.style.top = topPosition + 'px';
                    menu.style.bottom = 'auto';
                } else {
                    // ✅ فتح القائمة للأعلى إذا كانت المساحة في الأعلى أكبر
                    topPosition = dropdownRect.top - menuHeight - gap;
                    
                    // التأكد من أن القائمة لا تخرج من الأعلى
                    if (topPosition < padding) {
                        topPosition = padding;
                    }
                    
                    const availableHeight = dropdownRect.top - topPosition - gap;
                    maxHeight = Math.min(menuHeight, availableHeight);
                    menu.style.top = topPosition + 'px';
                    menu.style.bottom = 'auto';
                }
                
                // ✅ تطبيق الموضع بشكل صريح
                menu.style.position = 'fixed';
                menu.style.zIndex = '10001';
                menu.style.maxHeight = maxHeight + 'px';
                menu.style.overflowY = maxHeight < menuHeight ? 'auto' : 'visible';
            } else {
                // Fallback: إذا لم يتم العثور على dropdown
                // ✅ نقل القائمة إلى body حتى في حالة fallback
                if (menu.parentElement !== document.body) {
                    if (!menu.dataset.originalParent) {
                        const originalParent = menu.parentElement;
                        if (originalParent) {
                            menu.dataset.originalParent = originalParent.id || 
                                originalParent.className.split(' ')[0] || 
                                'actions-dropdown';
                            menu._originalParent = originalParent;
                        }
                    }
                    document.body.appendChild(menu);
                }
                menu.style.position = 'fixed';
                menu.style.top = '50%';
                menu.style.right = '50%';
                menu.style.left = 'auto';
                menu.style.zIndex = '10001';
            }
            
            menu.classList.add('show');
        }
    } catch (error) {
        console.error('خطأ في فتح/إغلاق القائمة المنسدلة:', error);
    }
}

function closeActionsDropdown(event) {
    // منع انتشار الحدث
    if (event) {
        event.stopPropagation();
    }
    
    // إغلاق جميع القوائم المنسدلة
    closeAllActionsDropdowns();
}

function closeAllActionsDropdowns(exceptMenuId = null) {
    try {
        const allMenus = document.querySelectorAll('.actions-dropdown-menu');
        allMenus.forEach(menu => {
            if (exceptMenuId && menu.id === exceptMenuId) {
                return; // عدم إغلاق القائمة المحددة
            }
            menu.classList.remove('show');
            // ✅ إعادة القائمة إلى مكانها الأصلي إذا كانت في body
            if (menu._originalParent && menu.parentElement === document.body) {
                try {
                    menu._originalParent.appendChild(menu);
                    delete menu._originalParent;
                    delete menu.dataset.originalParent;
                } catch (error) {
                    console.warn('تعذر إعادة القائمة إلى مكانها الأصلي:', error);
                }
            }
            // ✅ إعادة تعيين جميع الأنماط عند الإغلاق
            menu.style.position = '';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.right = '';
            menu.style.left = '';
            menu.style.zIndex = '';
            menu.style.maxHeight = '';
            menu.style.overflowY = '';
            menu.style.visibility = '';
            menu.style.display = '';
            menu.style.width = '';
        });
    } catch (error) {
        console.error('خطأ في إغلاق القوائم المنسدلة:', error);
    }
}

// ✅ دالة لعرض تفاصيل العملية (الحالة، الفني المستلم، التاريخ)
function showRepairDetails(repairId) {
    try {
        const repair = allRepairs.find(r => r.id === repairId);
        if (!repair) {
            showMessage('العملية غير موجودة', 'error');
            return;
        }
        
        const repairStatus = repair.status || 'received';
        const statusText = getStatusText(repairStatus);
        const statusColor = getStatusColor(repairStatus);
        const technicianName = repair.technician_name || getTechnicianName(repair.created_by) || 'غير محدد';
        const repairDate = formatDate(repair.created_at);
        
        // إنشاء modal للتفاصيل
        const existingModal = document.getElementById('repairDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const detailsModal = document.createElement('div');
        detailsModal.id = 'repairDetailsModal';
        detailsModal.className = 'modal';
        detailsModal.style.display = 'flex';
        
        detailsModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; width: 90%;">
                <div class="modal-header">
                    <h3>تفاصيل العملية #${repair.repair_number || repair.id}</h3>
                    <button onclick="closeRepairDetailsModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        <div class="detail-item" style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: var(--light-bg); border-radius: 8px;">
                            <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em;">الحالة</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="status-badge" style="background: ${statusColor}; color: var(--white); padding: 8px 16px; border-radius: 20px; font-size: 1em; font-weight: 500;">
                                    ${statusText}
                                </span>
                            </div>
                        </div>
                        
                        <div class="detail-item" style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: var(--light-bg); border-radius: 8px;">
                            <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em;">الفني المستلم</label>
                            <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">
                                ${technicianName}
                            </div>
                        </div>
                        
                        <div class="detail-item" style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: var(--light-bg); border-radius: 8px;">
                            <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em;">تاريخ العملية</label>
                            <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">
                                ${repairDate}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 25px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="closeRepairDetailsModal()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailsModal);
        
        // إغلاق modal عند النقر خارجها
        // تعطيل إغلاق المودال عند النقر خارجها - معطل حسب الطلب
        // detailsModal.addEventListener('click', (e) => {
        //     if (e.target === detailsModal) {
        //         closeRepairDetailsModal();
        //     }
        // });
        
    } catch (error) {
        console.error('خطأ في عرض تفاصيل العملية:', error);
        showMessage('حدث خطأ أثناء عرض التفاصيل', 'error');
    }
}

// ✅ دالة لإغلاق modal التفاصيل
function closeRepairDetailsModal() {
    const modal = document.getElementById('repairDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// ✅ دالة لعرض صورة الجهاز
async function showRepairImage(repairId) {
    try {
        const repair = allRepairs.find(r => r.id === repairId);
        if (!repair) {
            showMessage('العملية غير موجودة', 'error');
            return;
        }
        
        // التحقق من وجود الصورة
        const imageExists = await API.checkImageExists(repairId);
        if (!imageExists) {
            showMessage('لا توجد صورة محفوظة لهذه العملية', 'info');
            return;
        }
        
        // جلب مسار الصورة
        const imagePath = API.getImagePath(repairId);
        
        // إنشاء modal لعرض الصورة
        const existingModal = document.getElementById('repairImageModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const imageModal = document.createElement('div');
        imageModal.id = 'repairImageModal';
        imageModal.className = 'modal';
        imageModal.style.display = 'flex';
        
        imageModal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; width: 90%; max-height: 90vh; overflow: auto;">
                <div class="modal-header">
                    <h3>صورة الجهاز - العملية #${repair.repair_number || repair.id}</h3>
                    <button onclick="closeRepairImageModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px; display: flex; justify-content: center; align-items: center; min-height: 300px;">
                    <div style="text-align: center; width: 100%;">
                        <img src="${imagePath}" 
                             alt="صورة الجهاز" 
                             style="max-width: 100%; max-height: 70vh; border-radius: 10px; box-shadow: var(--shadow); object-fit: contain;"
                             onerror="this.parentElement.innerHTML='<p style=\'color: var(--danger-color); padding: 20px;\'>خطأ في تحميل الصورة</p>'"
                             loading="lazy">
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 25px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="closeRepairImageModal()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(imageModal);
        
        // إغلاق modal عند النقر خارجها
        // تعطيل إغلاق المودال عند النقر خارجها - معطل حسب الطلب
        // imageModal.addEventListener('click', (e) => {
        //     if (e.target === imageModal) {
        //         closeRepairImageModal();
        //     }
        // });
        
    } catch (error) {
        console.error('خطأ في عرض صورة الجهاز:', error);
        showMessage('حدث خطأ أثناء تحميل الصورة', 'error');
    }
}

// ✅ دالة لإغلاق modal الصورة
function closeRepairImageModal() {
    const modal = document.getElementById('repairImageModal');
    if (modal) {
        modal.remove();
    }
}

// توليد رقم عملية عشوائي من 6 أحرف (أرقام وحروف)
function generateRandomRepairNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function showAddRepairModal() {
    try {
        // ✅ التحقق من وجود القسم أولاً
        const repairsSection = document.getElementById('repairs-section');
        if (!repairsSection) {
            console.error('قسم الصيانة غير موجود. يرجى الانتقال إلى صفحة الصيانة أولاً.');
            showMessage('خطأ: قسم الصيانة غير موجود. يرجى الانتقال إلى صفحة الصيانة أولاً.', 'error');
            return;
        }
        
        // ✅ التحقق من وجود العناصر قبل الوصول إليها
        let repairModalTitle = document.getElementById('repairModalTitle');
        let repairForm = document.getElementById('repairForm');
        let repairModal = document.getElementById('repairModal');
        
        // ✅ إذا لم تكن العناصر موجودة، إعادة تحميل القسم
        if (!repairModalTitle || !repairForm || !repairModal) {
            console.warn('عناصر النموذج غير موجودة. إعادة تحميل قسم الصيانة...');
            await loadRepairsSection();
            
            // ✅ إعادة المحاولة بعد التحميل
            repairModalTitle = document.getElementById('repairModalTitle');
            repairForm = document.getElementById('repairForm');
            repairModal = document.getElementById('repairModal');
            
            if (!repairModalTitle || !repairForm || !repairModal) {
                console.error('فشل تحميل عناصر النموذج بعد إعادة التحميل.');
                showMessage('خطأ: فشل تحميل النموذج. يرجى إعادة تحميل الصفحة.', 'error');
                return;
            }
        }
        
        repairModalTitle.textContent = 'إضافة عملية صيانة جديدة';
        repairForm.reset();
        
        const repairIdInput = document.getElementById('repairId');
        const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
        if (repairIdInput) repairIdInput.value = '';
        if (selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        
        removeImage(); // مسح الصورة السابقة
        
        // توليد رقم عملية عشوائي تلقائياً
        const repairNumberInput = document.getElementById('repairNumber');
        if (repairNumberInput) {
            repairNumberInput.value = generateRandomRepairNumber();
        }
        
        // التأكد من ظهور خيارات نوع الجهاز الثابتة (تفادي "جاري التحميل" أو "خطأ في التحميل" من كاش قديم)
        ensureDeviceTypeOptions();
        
        // ✅ تم إزالة updateTechnicianName() - الفني يتم اختياره يدوياً فقط من النموذج
        
        // تحميل الفروع وملء القائمة (للمالك فقط)
        let currentUser = getCurrentUser();
        
        // ✅ إذا كان branch_id null، محاولة تحديث بيانات المستخدم من الخادم
        if (currentUser && !currentUser.branch_id) {
            try {
                if (typeof API !== 'undefined' && typeof API.getProfile === 'function') {
                    const profileResult = await API.getProfile();
                    if (profileResult && profileResult.success && profileResult.data) {
                        currentUser = profileResult.data;
                        // حفظ البيانات المحدثة في localStorage
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                }
            } catch (e) {
                console.warn('⚠️ فشل تحديث بيانات المستخدم من الخادم:', e);
            }
        }
        
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        // ✅ إعادة إظهار جميع الحقول المخفية عند التعديل
        const branchGroup = document.getElementById('repairBranchGroup');
        const customerType = document.getElementById('customerType');
        const customerSource = document.getElementById('customerSource');
        const customerSelectGroup = document.getElementById('customerSelectGroup');
        const customerFieldsContainer = document.getElementById('customerFieldsContainer');
        
        // ✅ إعادة إظهار حقول بيانات العميل
        if (customerFieldsContainer) {
            customerFieldsContainer.style.display = 'block';
        }
        
        // ✅ إعادة إظهار حقول بيانات الجهاز والتأكد من خيارات نوع الجهاز الثابتة
        ensureDeviceTypeOptions();
        const deviceTypeGroup = document.getElementById('deviceType')?.parentElement;
        if (deviceTypeGroup) {
            deviceTypeGroup.style.display = 'block';
        }
        const deviceModelGroup = document.getElementById('deviceModel')?.parentElement;
        if (deviceModelGroup) {
            deviceModelGroup.style.display = 'block';
        }
        const accessoriesGroup = document.getElementById('accessories')?.parentElement;
        if (accessoriesGroup) {
            accessoriesGroup.style.display = 'block';
        }
        const problemGroup = document.getElementById('problem')?.parentElement;
        if (problemGroup) {
            problemGroup.style.display = 'block';
        }
        const repairTypeGroup = document.getElementById('repairType')?.parentElement;
        if (repairTypeGroup) {
            repairTypeGroup.style.display = 'block';
        }
        
        // ✅ إعادة إظهار صورة الجهاز
        const imageUploadGroup = document.querySelector('.image-upload-container')?.parentElement;
        if (imageUploadGroup) {
            imageUploadGroup.style.display = 'block';
        }
        
        // ✅ إعادة إظهار رقم العملية
        const repairNumberGroup = document.getElementById('repairNumber')?.parentElement;
        if (repairNumberGroup) {
            repairNumberGroup.style.display = 'block';
        }
        
        // ✅ إعادة إظهار المبلغ المدفوع والمتبقي
        const paidAmountGroup = document.getElementById('paidAmount')?.parentElement;
        if (paidAmountGroup) {
            paidAmountGroup.style.display = 'block';
        }
        const remainingAmountGroup = document.getElementById('remainingAmount')?.parentElement;
        if (remainingAmountGroup) {
            remainingAmountGroup.style.display = 'block';
        }
        
        // ✅ إعادة إظهار الملاحظات
        const notesGroup = document.getElementById('notes')?.parentElement;
        if (notesGroup) {
            notesGroup.style.display = 'block';
        }
        
        // ✅ إخفاء تقرير الفحص عند الإضافة (يظهر فقط عند التعديل)
        const inspectionReportGroup = document.getElementById('inspectionReportGroup');
        if (inspectionReportGroup) {
            inspectionReportGroup.style.display = 'none';
        }
        
        // إظهار حقل نوع العميل
        if (customerType && customerType.parentElement && customerType.parentElement.parentElement) {
            customerType.parentElement.parentElement.style.display = 'flex';
        }
        
        // ✅ إعادة إظهار حقل حالة العميل (حل نهائي للمشكلة)
        if (customerSource && customerSource.parentElement) {
            customerSource.parentElement.style.display = 'block';
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
        
        // ✅ إخفاء النموذج حتى يتم تحميل الفنيين بنجاح
        repairModal.style.display = 'none';
        
        // ✅ مسح قيمة الفني المستلم قبل تحميل الفنيين (لضمان عدم التحديد التلقائي)
        const technicianSelect = document.getElementById('technicianSelect');
        if (technicianSelect) {
            technicianSelect.innerHTML = '<option value="">جاري التحميل...</option>';
            technicianSelect.value = '';
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
                // للموظفين/الفنيين/المديرين: جلب عملاء فرعهم مباشرة
                // ✅ استخدام currentUser المحدث (بعد getProfile إذا لزم الأمر)
                const branchId = currentUser && currentUser.branch_id ? currentUser.branch_id : null;
                if (branchId) {
                    await loadRepairCustomers(branchId, 'retail');
                    // ✅ إضافة: تحميل الفنيين للموظفين/الفنيين/المديرين
                    await loadRepairTechnicians(branchId, false);
                } else {
                    // ✅ المستخدم غير مرتبط بفرع - جلب المالكين فقط
                    await loadRepairTechnicians(null, false);
                }
            }
        }
        
        // ✅ تحميل الفنيين مرة واحدة فقط حسب الفرع المحدد
        let techniciansLoaded = false;
        if (isOwner) {
            // للمالك: تحميل الفنيين حسب الفرع المحدد
            const branchIdForTechnicians = getCurrentRepairBranchId();
            if (branchIdForTechnicians) {
                techniciansLoaded = await loadRepairTechnicians(branchIdForTechnicians, false);
            } else if (currentUser && currentUser.branch_id) {
                // إذا لم يكن هناك فرع محدد، استخدام فرع المستخدم الحالي
                techniciansLoaded = await loadRepairTechnicians(currentUser.branch_id, false);
            } else {
                // إذا لم يكن هناك branchId، لا يمكن تحميل الفنيين
                console.warn('⚠️ [Repairs] لا يمكن تحميل الفنيين - branchId غير محدد');
                if (technicianSelect) {
                    technicianSelect.innerHTML = '<option value="">لا يمكن تحميل الفنيين - الفرع غير محدد</option>';
                }
            }
        } else {
            // ✅ للموظفين/الفنيين/المديرين: تم تحميل الفنيين أعلاه
            // نتحقق من أن التحميل نجح من خلال التحقق من البيانات المحفوظة
            techniciansLoaded = repairTechnicians && repairTechnicians.length > 0;
            
            if (!techniciansLoaded) {
                // إذا فشل التحميل أعلاه، نحاول مرة أخرى
                if (currentUser && currentUser.branch_id) {
                    techniciansLoaded = await loadRepairTechnicians(currentUser.branch_id, false);
                } else {
                    // ✅ محاولة جلب المالكين فقط (بدون branch_id)
                    techniciansLoaded = await loadRepairTechnicians(null, false);
                }
            }
            
            if (!techniciansLoaded) {
                console.error('❌ [Repairs] فشل تحميل الفنيين');
                if (technicianSelect) {
                    technicianSelect.innerHTML = '<option value="">لا يمكن تحميل الفنيين</option>';
                }
            }
        }
        
        // ✅ التأكد من أن الفنيين تم تحميلهم بنجاح قبل عرض النموذج
        if (technicianSelect) {
            // التحقق من أن الفنيين تم تحميلهم
            // نتحقق من repairTechnicians أولاً (البيانات المحفوظة)
            const hasTechniciansData = repairTechnicians && repairTechnicians.length > 0;
            
            // نتحقق من أن الـ dropdown يحتوي على خيارات (أكثر من "اختر الفني...")
            const hasDropdownOptions = technicianSelect.options.length > 1;
            
            // نتحقق من أن الخيار الأول ليس "جاري التحميل" أو رسائل خطأ
            const firstOptionText = technicianSelect.options[0] ? technicianSelect.options[0].textContent : '';
            const isValidFirstOption = firstOptionText.includes('اختر الفني') || firstOptionText === '';
            
            // نجاح التحميل إذا:
            // 1. تم تحميل البيانات بنجاح (techniciansLoaded = true)، أو
            // 2. هناك بيانات محفوظة (hasTechniciansData) و dropdown يحتوي على خيارات
            const loadSuccess = techniciansLoaded || (hasTechniciansData && hasDropdownOptions && isValidFirstOption);
            
            if (!loadSuccess) {
                console.error('❌ [Repairs] فشل تحميل الفنيين - لا يمكن عرض النموذج');
                console.error('   - techniciansLoaded:', techniciansLoaded);
                console.error('   - hasTechniciansData:', hasTechniciansData);
                console.error('   - hasDropdownOptions:', hasDropdownOptions);
                console.error('   - repairTechnicians.length:', repairTechnicians ? repairTechnicians.length : 0);
                console.error('   - dropdown options:', technicianSelect.options.length);
                showMessage('حدث خطأ أثناء تحميل قائمة الفنيين. يرجى المحاولة مرة أخرى.', 'error');
                return;
            }
            
            // ✅ التأكد من أن الفني غير محدد بعد التحميل
            technicianSelect.value = '';
        }
        
        // مسح حقول العميل
        clearCustomerFields();
        
        // مسح حقول أرقام الفواتير
        setSparePartsInvoices([]);
        
        // ✅ إظهار النموذج فقط بعد اكتمال تحميل الفنيين
        repairModal.style.display = 'flex';
    } catch (error) {
        console.error('خطأ في فتح نموذج إضافة العملية:', error);
        showMessage('حدث خطأ أثناء فتح نموذج إضافة العملية. يرجى المحاولة مرة أخرى.', 'error');
    }
}

function closeRepairModal() {
    document.getElementById('repairModal').style.display = 'none';
}

// استعادة خيارات نوع الجهاز الثابتة (من brsql) - لتفادي ظهور "جاري التحميل" أو "خطأ في التحميل" من كاش قديم
function ensureDeviceTypeOptions() {
    const sel = document.getElementById('deviceType');
    if (!sel) return;
    const firstOpt = sel.options[0]?.textContent || '';
    if (firstOpt.includes('جاري التحميل') || firstOpt.includes('خطأ في التحميل') || firstOpt.includes('لا يمكن تحميل') || sel.options.length <= 1) {
        sel.innerHTML = '<option value="">اختر الماركة</option><option value="Samsung">Samsung</option><option value="Apple">Apple</option><option value="Xiaomi">Xiaomi</option><option value="Oppo">Oppo</option><option value="vivo">vivo</option><option value="Huawei">Huawei</option><option value="Realme">Realme</option><option value="OnePlus">OnePlus</option><option value="Google">Google</option><option value="Motorola">Motorola</option><option value="Nokia">Nokia</option><option value="Tecno">Tecno</option><option value="Infinix">Infinix</option><option value="Lenovo">Lenovo</option><option value="Sony">Sony</option><option value="Asus">Asus</option><option value="ZTE">ZTE</option><option value="Meizu">Meizu</option><option value="HTC">HTC</option><option value="Microsoft">Microsoft</option><option value="Acer">Acer</option><option value="alcatel">alcatel</option><option value="Lava">Lava</option><option value="أخرى">أخرى</option>';
    }
}

// معالجة تغيير نوع الجهاز
function handleDeviceTypeChange(select) {
    const customInput = document.getElementById('deviceTypeCustom');
    if (!customInput) return;
    
    if (select.value === 'أخرى' || select.value === 'other' || select.value.toLowerCase() === 'other') {
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
    try {
        const customerPriceInput = document.getElementById('customerPrice');
        const paidAmountInput = document.getElementById('paidAmount');
        const remainingAmountInput = document.getElementById('remainingAmount');
        
        if (!customerPriceInput || !paidAmountInput || !remainingAmountInput) {
            return;
        }
        
        const customerPrice = parseFloat(customerPriceInput.value) || 0;
        const paidAmount = parseFloat(paidAmountInput.value) || 0;
        const remaining = Math.max(0, customerPrice - paidAmount); // التأكد من أن المتبقي لا يكون سالباً
        remainingAmountInput.value = remaining.toFixed(2);
    } catch (error) {
        console.error('خطأ في حساب المتبقي:', error);
    }
}

// إظهار/إخفاء حقل تكلفة الكشف عند تغيير الحالة
function toggleInspectionCostField() {
    try {
        const statusSelect = document.getElementById('status');
        const inspectionCostGroup = document.getElementById('inspectionCostGroup');
        const inspectionCostInput = document.getElementById('inspectionCost');
        const repairId = document.getElementById('repairId').value;
        const paidAmountInput = document.getElementById('paidAmount');
        
        if (!statusSelect || !inspectionCostGroup || !inspectionCostInput) {
            return;
        }
        
        const status = statusSelect.value;
        const isCancelled = status === 'cancelled';
        const paidAmount = parseFloat(paidAmountInput?.value || 0);
        
        // إظهار الحقل فقط عند تغيير الحالة إلى "عملية ملغية" ولدينا مبلغ مدفوع مقدماً (للعمليات الجديدة فقط)
        if (isCancelled && !repairId && paidAmount > 0) {
            inspectionCostGroup.style.display = 'block';
            inspectionCostInput.required = true;
        } else if (isCancelled && repairId) {
            // للعمليات الموجودة: التحقق من وجود paid_amount
            inspectionCostGroup.style.display = 'block';
            inspectionCostInput.required = true;
        } else {
            inspectionCostGroup.style.display = 'none';
            inspectionCostInput.required = false;
            inspectionCostInput.value = '0';
        }
    } catch (error) {
        console.error('خطأ في toggleInspectionCostField:', error);
    }
}

// تحويل الصورة إلى Base64
// ✅ دالة لضغط الصورة بنسبة 50%
function compressImage(imageDataUrl, quality = 0.5) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // تقليل الحجم إلى 50%
                canvas.width = img.width * 0.5;
                canvas.height = img.height * 0.5;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // تحويل إلى base64 بجودة مضغوطة
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = imageDataUrl;
        } catch (error) {
            reject(error);
        }
    });
}

async function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                // ✅ ضغط الصورة بنسبة 50% قبل الحفظ
                const compressedImage = await compressImage(reader.result, 0.5);
                resolve(compressedImage);
            } catch (error) {
                console.error('خطأ في ضغط الصورة:', error);
                // في حالة الخطأ، نرجع الصورة الأصلية
                resolve(reader.result);
            }
        };
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

        // ✅ تعيين علامة السماح بالكاميرا للسياق الأمني (قبل طلب الوصول)
        window.allowCameraAccess = true;
        sessionStorage.setItem('allowCameraAccess', 'true');
        
        // تنظيف العلامة بعد 30 ثانية (للحماية)
        setTimeout(() => {
            window.allowCameraAccess = false;
            sessionStorage.removeItem('allowCameraAccess');
        }, 30000);

        // ✅ استخدام النظام المركزي للصلاحيات - التحقق من الصلاحية قبل طلبها
        let stream = null;
        
        if (typeof window.getCameraStream === 'function') {
            // استخدام الدالة المركزية للتحقق من الصلاحية والحصول على stream
            stream = await window.getCameraStream({ 
                video: { 
                    facingMode: 'environment', // الكاميرا الخلفية
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            if (!stream) {
                // فشل الحصول على stream - التحقق من السبب
                const permissionState = await (window.checkCameraPermission ? window.checkCameraPermission() : Promise.resolve(null));
                
                if (permissionState === 'denied') {
                    showMessage('تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا في إعدادات المتصفح.', 'error');
                } else {
                    showMessage('فشل الوصول إلى الكاميرا. يرجى التحقق من الصلاحيات', 'error');
                }
                return;
            }
        } else {
            // Fallback: إذا لم يكن النظام المركزي متاحاً، استخدام الطريقة القديمة
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
            
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment', // الكاميرا الخلفية
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
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
async function capturePhoto() {
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
    
    // ✅ تحويل إلى Base64 ثم ضغطها بنسبة 50%
    const originalImage = canvas.toDataURL('image/jpeg', 1.0);
    try {
        selectedDeviceImage = await compressImage(originalImage, 0.5);
    } catch (error) {
        console.error('خطأ في ضغط الصورة:', error);
        // في حالة الخطأ، نستخدم الصورة المضغوطة بجودة أقل
        selectedDeviceImage = canvas.toDataURL('image/jpeg', 0.5);
    }
    
    // إيقاف الكاميرا
    if (window.currentCameraStream) {
        window.currentCameraStream.getTracks().forEach(track => track.stop());
        window.currentCameraStream = null;
    }
    
    // ✅ إزالة علامة السماح بالكاميرا
    window.allowCameraAccess = false;
    sessionStorage.removeItem('allowCameraAccess');
    
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
    
    // ✅ إزالة علامة السماح بالكاميرا
    window.allowCameraAccess = false;
    sessionStorage.removeItem('allowCameraAccess');
    
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

    const repairId = document.getElementById('repairId').value;
    const isEditMode = !!repairId;
    
    // ✅ عند التعديل: إرسال فقط الحقول القابلة للتعديل
    if (isEditMode) {
        const repairData = {
            id: repairId
        };
        
        // ✅ التحقق من حالة العملية
        const currentRepairForEdit = allRepairs.find(r => r.id === repairId);
        const isCancelled = currentRepairForEdit && currentRepairForEdit.status === 'cancelled';
        
        if (isCancelled) {
            // ✅ للعمليات الملغاة: إرسال inspection_cost فقط
            const inspectionCostInput = document.getElementById('inspectionCost');
            if (inspectionCostInput) {
                const inspectionCost = inspectionCostInput.value ? parseFloat(inspectionCostInput.value) : 0;
                if (inspectionCost < 0) {
                    showMessage('مبلغ الكشف يجب أن يكون أكبر من أو يساوي 0', 'error');
                    return;
                }
                repairData.inspection_cost = inspectionCost;
            } else {
                showMessage('حقل تكلفة الكشف مطلوب', 'error');
                return;
            }
            // ✅ للعمليات الملغاة: لا نرسل أي حقول أخرى
        } else {
            // ✅ الحقول القابلة للتعديل فقط:
            // 1. الفني المستلم
            const technicianSelect = document.getElementById('technicianSelect');
            if (technicianSelect && technicianSelect.value) {
                repairData.created_by = technicianSelect.value;
            } else {
                showMessage('يجب اختيار الفني المستلم', 'error');
                return;
            }
            
            // 2. السعر للعميل - إرساله دائماً
            const customerPrice = document.getElementById('customerPrice').value.trim();
            repairData.customer_price = customerPrice ? parseFloat(customerPrice) : 0;
            
            // 3. تكلفة الإصلاح - إرسالها دائماً
            const repairCost = document.getElementById('repairCost').value.trim();
            repairData.repair_cost = repairCost ? parseFloat(repairCost) : 0;
            
            // 4. تكلفة الكشف - إرسالها عند الحاجة
            const inspectionCostInput = document.getElementById('inspectionCost');
            if (inspectionCostInput) {
                repairData.inspection_cost = inspectionCostInput.value ? parseFloat(inspectionCostInput.value) : 0;
            }
            
            // 5. اسم محل قطع الغيار - إرساله دائماً (حتى لو فارغ)
            const partsStore = document.getElementById('partsStore').value.trim();
            repairData.parts_store = partsStore || '';
            
            // 5. أرقام فواتير قطع الغيار - إرسالها دائماً
            const sparePartsInvoices = getSparePartsInvoices();
            repairData.spare_parts_invoices = (sparePartsInvoices && sparePartsInvoices.length > 0) ? sparePartsInvoices : [];
            
            // 6. تاريخ التسليم - إرساله دائماً (حتى لو فارغ)
            const deliveryDate = document.getElementById('deliveryDate').value;
            repairData.delivery_date = deliveryDate || null;
            
            // 7. الحالة (مهم جداً!) - إرسالها دائماً
            const statusSelect = document.getElementById('status');
            if (statusSelect && statusSelect.value) {
                repairData.status = statusSelect.value;
            } else {
                // ✅ إرسال حالة افتراضية إذا لم يتم تحديدها
                repairData.status = 'received';
            }
            console.log('✅ [Repairs] إرسال الحالة للتحديث:', repairData.status);
            
            // 8. Serial Number - إرساله دائماً (حتى لو فارغ)
            const serialNumber = document.getElementById('serialNumber').value.trim();
            repairData.serial_number = serialNumber || '';
            
            // 9. تقرير الفحص - إرساله دائماً (حتى لو فارغ)
            const inspectionReportField = document.getElementById('inspectionReport');
            if (inspectionReportField) {
                repairData.inspection_report = inspectionReportField.value.trim() || null;
            }
        }
        
        // ✅ التحقق من تغيير الحالة إلى "delivered" أو "cancelled" لطلب التقييم
        const currentRepairForRating = currentRepairForEdit || allRepairs.find(r => r.id === repairId);
        const oldStatus = currentRepairForRating ? currentRepairForRating.status : null;
        const newStatus = repairData.status;
        const shouldRequestRating = (newStatus === 'delivered' || newStatus === 'cancelled') && 
                                    oldStatus !== newStatus && 
                                    currentRepairForRating && 
                                    currentRepairForRating.customer_id;
        
        // ✅ إرسال التعديلات
        console.log('✅ [Repairs] بيانات التعديل المرسلة:', repairData);
        const result = await API.updateRepair(repairData);
        
        if (result.success) {
            showMessage(result.message || 'تم تعديل العملية بنجاح');
            closeRepairModal();
            
            // ✅ تحديث allRepairs محلياً فوراً لعرض التغييرات بشكل لحظي
            const repairIndex = allRepairs.findIndex(r => String(r.id) === String(repairId));
            if (repairIndex !== -1) {
                // تحديث العملية في allRepairs بالبيانات الجديدة
                const updatedRepair = { ...allRepairs[repairIndex] };
                
                // تحديث جميع الحقول المرسلة
                if (repairData.status !== undefined) {
                    updatedRepair.status = repairData.status;
                    console.log('✅ [Repairs] تحديث الحالة محلياً:', repairData.status);
                }
                if (repairData.customer_price !== undefined) {
                    updatedRepair.customer_price = repairData.customer_price;
                }
                if (repairData.repair_cost !== undefined) {
                    updatedRepair.repair_cost = repairData.repair_cost;
                }
                if (repairData.paid_amount !== undefined) {
                    updatedRepair.paid_amount = repairData.paid_amount;
                }
                if (repairData.remaining_amount !== undefined) {
                    updatedRepair.remaining_amount = repairData.remaining_amount;
                }
                if (repairData.delivery_date !== undefined) {
                    updatedRepair.delivery_date = repairData.delivery_date;
                }
                if (repairData.created_by !== undefined) {
                    updatedRepair.created_by = repairData.created_by;
                }
                if (repairData.serial_number !== undefined) {
                    updatedRepair.serial_number = repairData.serial_number;
                }
                if (repairData.inspection_report !== undefined) {
                    updatedRepair.inspection_report = repairData.inspection_report;
                }
                if (repairData.inspection_cost !== undefined) {
                    updatedRepair.inspection_cost = repairData.inspection_cost;
                }
                if (repairData.parts_store !== undefined) {
                    updatedRepair.parts_store = repairData.parts_store;
                }
                if (repairData.spare_parts_invoices !== undefined) {
                    updatedRepair.spare_parts_invoices = repairData.spare_parts_invoices;
                }
                
                // استبدال العملية المحدثة في المصفوفة
                allRepairs[repairIndex] = updatedRepair;
                console.log('✅ [Repairs] تم تحديث العملية في allRepairs، الحالة الجديدة:', updatedRepair.status);
                
                // ✅ تحديث الجدول فوراً لعرض التغييرات
                filterRepairs();
                console.log('✅ [Repairs] تم استدعاء filterRepairs() لتحديث الجدول');
            } else {
                console.warn('⚠️ [Repairs] لم يتم العثور على العملية في allRepairs، سيتم إعادة تحميل البيانات');
                // إذا لم يتم العثور على العملية، إعادة تحميل البيانات
                isLoadingRepairs = false;
                lastRepairsLoadTime = 0;
                loadRepairs(true).catch(error => {
                    console.error('⚠️ خطأ في إعادة تحميل البيانات:', error);
                });
            }
            
            // ✅ مسح cache لضمان الحصول على أحدث البيانات عند التحديث القادم
            if (typeof API_CACHE !== 'undefined' && API_CACHE.clear) {
                API_CACHE.clear();
                console.log('✅ [Repairs] تم مسح cache بعد التعديل');
            }
            
            // ✅ إعادة تعيين flags للتحميل للسماح بإعادة التحميل عند الحاجة
            isLoadingRepairs = false;
            lastRepairsLoadTime = 0;
            
            // ✅ إذا كانت العملية ملغاة وتم إدخال inspection_cost، سيتم إخفاء زر التعديل تلقائياً
            // لأن canEdit سيتحقق من وجود inspection_cost في loadRepairs
            
            // ✅ طلب التقييم إذا تم تغيير الحالة إلى "delivered" أو "cancelled"
            if (shouldRequestRating && currentRepairForRating && currentRepairForRating.customer_id) {
                setTimeout(() => {
                    showRepairRatingModal(currentRepairForRating.customer_id, repairId, currentRepairForRating.repair_number || '');
                }, 500); // تأخير بسيط لإغلاق النافذة أولاً
            }
            
            // تحديث لوحة التحكم
            if (typeof loadDashboardData === 'function') {
                await loadDashboardData();
            }
        } else {
            showMessage(result.message || 'حدث خطأ أثناء تعديل العملية', 'error');
        }
        
        return; // ✅ إنهاء الدالة هنا عند التعديل
    }
    
    // ✅ عند الإضافة: الكود الأصلي
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
    if ((deviceType === 'أخرى' || deviceType === 'other' || deviceType.toLowerCase() === 'other') && customDeviceType) {
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

    // جلب قيم الدفع
    const paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
    const customerPriceNum = parseFloat(customerPrice);
    
    // ✅ السماح بالدفع الجزئي لجميع أنواع العملاء (العاديين والتجاريين)
    const finalPaidAmount = paidAmount;
    const remainingAmount = Math.max(0, customerPriceNum - finalPaidAmount);

    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // جلب أرقام فواتير قطع الغيار
    const sparePartsInvoices = getSparePartsInvoices();
    
    // جلب رقم العملية من الحقل
    const repairNumber = document.getElementById('repairNumber').value.trim();
    
    // ✅ حماية الملاحظة المحمية من التعديل
    let notesValue = document.getElementById('notes').value.trim();
    const protectedNote = "ملغي نتيجة طلب العميل";
    
    // إذا كانت في وضع التعديل وكانت الملاحظة المحمية موجودة في الملاحظات الحالية، يجب إبقاؤها
    const currentRepairId = document.getElementById('repairId').value;
    if (currentRepairId) {
        const repair = allRepairs.find(r => r.id === currentRepairId);
        if (repair && repair.notes && repair.notes.includes(protectedNote)) {
            // إذا كانت الملاحظة الجديدة لا تحتوي على الملاحظة المحمية، أضفها
            if (!notesValue.includes(protectedNote)) {
                if (notesValue) {
                    notesValue = notesValue + "\n\n" + protectedNote;
                } else {
                    notesValue = protectedNote;
                }
            }
        }
    }
    
    const repairData = {
        repair_number: repairNumber,
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
        inspection_cost: parseFloat(document.getElementById('inspectionCost')?.value || 0) || 0,
        parts_store: document.getElementById('partsStore').value.trim(),
        spare_parts_invoices: sparePartsInvoices,
        paid_amount: finalPaidAmount,
        remaining_amount: remainingAmount,
        delivery_date: document.getElementById('deliveryDate').value,
        status: document.getElementById('status').value,
        notes: notesValue
    };
    
    // ✅ إضافة الفني المستلم من الـ select فقط (مطلوب)
    const technicianSelect = document.getElementById('technicianSelect');
    if (!technicianSelect || !technicianSelect.value) {
        showMessage('يجب اختيار الفني المستلم', 'error');
        return;
    }
    // ✅ استخدام الفني المحدد في النموذج فقط (بدون أي تحديد تلقائي)
    repairData.created_by = technicianSelect.value;
    
    // إضافة branch_id
    const branchId = getCurrentRepairBranchId();
    if (branchId) {
        repairData.branch_id = branchId;
    }

    // ✅ إصلاح: إنشاء العميل الجديد قبل حفظ عملية الصيانة (فقط للعمليات الجديدة)
    if (!repairId) {
        // ✅ التحقق من customerSource بدلاً من selectedCustomerId فقط
        if (customerSource === 'new') {
            // عميل جديد - إنشاء عميل جديد أولاً
            try {
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
                
                const customerResult = await API.addCustomer(customerData);
                
                if (customerResult && customerResult.success && customerResult.data && customerResult.data.id) {
                    // ✅ إضافة customer_id إلى repairData قبل حفظ العملية
                    repairData.customer_id = customerResult.data.id;
                    console.log('✅ تم إنشاء عميل جديد بنجاح:', customerResult.data.id);
                } else {
                    const errorMsg = customerResult?.message || 'فشل في إنشاء العميل';
                    console.error('⚠️ خطأ في إنشاء العميل:', errorMsg);
                    showMessage(`حدث خطأ أثناء إنشاء العميل: ${errorMsg}`, 'error');
                    return;
                }
            } catch (error) {
                console.error('خطأ في إنشاء العميل:', error);
                showMessage('حدث خطأ أثناء إنشاء العميل. يرجى المحاولة مرة أخرى', 'error');
                return;
            }
        } else if (customerSource === 'existing') {
            // عميل موجود - استخدام customer_id المحدد
            const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
            if (!selectedCustomerIdInput || !selectedCustomerIdInput.value) {
                showMessage('يجب اختيار عميل من القائمة', 'error');
                return;
            }
            repairData.customer_id = selectedCustomerIdInput.value;
            console.log('✅ استخدام عميل موجود:', repairData.customer_id);
        } else {
            // حالة غير متوقعة
            console.error('⚠️ customerSource غير معروف:', customerSource);
            showMessage('خطأ في تحديد نوع العميل', 'error');
            return;
        }
    }

    // ✅ عند الإضافة فقط
    let result = await API.addRepair(repairData);
    
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

    if (result.success) {
        showMessage(result.message);
        closeRepairModal();
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        isLoadingRepairs = false;
        lastRepairsLoadTime = 0; // إعادة تعيين الوقت لإجبار التحميل
        
        await loadRepairs(true); // force = true بعد حفظ العملية
        
        // ✅ التبديل إلى تبويب نوع الصيانة الصحيح (فقط للعمليات الجديدة)
        // يجب أن يكون بعد loadRepairs حتى يتم تحميل البيانات أولاً
        if (!repairId && result.data && result.data.repair_type) {
            const savedRepairType = result.data.repair_type;
            if (savedRepairType && savedRepairType !== currentRepairType) {
                switchRepairType(savedRepairType);
            }
        }
        
        // تحديث لوحة التحكم دائماً (حتى لو كنا في قسم آخر)
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
        
        // ✅ تحديث قائمة العملاء إذا كان هناك عميل جديد تم إنشاؤه
        if (customerSource === 'new' && repairData.customer_id && typeof loadCustomers === 'function') {
            // مسح cache العملاء لإجبار إعادة التحميل
            if (typeof API_CACHE !== 'undefined' && API_CACHE.cache && API_CACHE.cache instanceof Map) {
                try {
                    // مسح فقط cache العملاء
                    const cacheKeys = Array.from(API_CACHE.cache.keys());
                    cacheKeys.forEach(key => {
                        if (typeof key === 'string' && key.includes('customers')) {
                            API_CACHE.cache.delete(key);
                        }
                    });
                } catch (error) {
                    console.error('⚠️ خطأ في مسح cache العملاء:', error);
                }
            }
            // إعادة تحميل العملاء في الخلفية
            setTimeout(async () => {
                try {
                    if (typeof loadCustomers === 'function') {
                        await loadCustomers(true);
                    }
                } catch (error) {
                    console.error('⚠️ خطأ في تحديث قائمة العملاء:', error);
                }
            }, 1000);
        }
        
        // ✅ إنشاء رابط التتبع وعرضه للعميل (فقط للعمليات الجديدة)
        if (!repairId && result.data && result.data.repair_number) {
            const trackingLink = generateRepairTrackingLink(result.data.repair_number);
            // جلب بيانات العملية الكاملة لإرسالها في رسالة الواتساب
            const repairData = result.data;
            showTrackingLinkModal(result.data.repair_number, trackingLink, repairData);
        }
    } else {
        const errorMsg = result.message || 'حدث خطأ أثناء حفظ عملية الصيانة';
        console.error('⚠️ خطأ في حفظ عملية الصيانة:', errorMsg);
        showMessage(errorMsg, 'error');
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

// ✅ دالة لتحويل URL الصورة إلى base64 data URL
async function convertImageUrlToDataUrl(imageUrl) {
    try {
        // إذا كان بالفعل data URL، نرجعه كما هو
        if (imageUrl.startsWith('data:')) {
            return imageUrl;
        }
        
        // محاولة تحميل الصورة وتحويلها إلى base64
        return await new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                reject(new Error('انتهت مهلة تحميل الصورة'));
            }, 10000); // 10 ثواني timeout
            
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    // تحويل إلى base64
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    console.warn('خطأ في تحويل الصورة إلى base64، سيتم استخدام URL الأصلي:', error);
                    // في حالة الفشل، نرجع URL الأصلي
                    resolve(imageUrl);
                }
            };
            
            img.onerror = function(error) {
                clearTimeout(timeout);
                console.warn('فشل تحميل الصورة من URL، سيتم استخدام URL الأصلي:', imageUrl);
                // في حالة الفشل، نرجع URL الأصلي
                resolve(imageUrl);
            };
            
            // محاولة تحميل الصورة
            img.src = imageUrl;
        });
    } catch (error) {
        console.error('خطأ في تحويل URL الصورة إلى data URL:', error);
        // في حالة الفشل، نرجع URL الأصلي
        return imageUrl;
    }
}

// ✅ دالة لعرض رابط التتبع في مودال
function showTrackingLinkModal(repairNumber, trackingLink, repairData = null) {
    try {
        // إنشاء مودال لعرض رابط التتبع
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'trackingLinkModal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="bi bi-link-45deg"></i> رابط متابعة عملية الصيانة</h3>
                    <button onclick="closeTrackingLinkModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    <div style="background: var(--light-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid var(--primary-color);">
                        <p style="margin: 0; color: var(--text-dark); font-size: 0.95em; line-height: 1.6;">
                            <i class="bi bi-info-circle" style="color: var(--primary-color); margin-left: 8px;"></i>
                            يمكنك مشاركة هذا الرابط مع العميل لمتابعة حالة عملية الصيانة
                        </p>
                        <p style="margin: 8px 0 0 0; color: var(--text-dark); font-weight: 600;">
                            رقم العملية: <span style="color: var(--primary-color);">${escapeHtmlForRepairs(repairNumber)}</span>
                        </p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-dark); font-weight: 600; font-size: 0.9em;">
                            <i class="bi bi-link-45deg"></i> رابط المتابعة:
                        </label>
                        <div style="display: flex; gap: 10px; align-items: stretch;">
                            <input 
                                type="text" 
                                id="trackingLinkInput" 
                                value="${escapeHtmlForRepairs(trackingLink)}" 
                                readonly 
                                style="flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--white); font-size: 0.9em; font-family: monospace; direction: ltr; text-align: left;"
                            >
                            <button 
                                onclick="copyTrackingLink(event)" 
                                class="btn btn-primary"
                                style="padding: 12px 20px; white-space: nowrap; border-radius: 6px;"
                                title="نسخ الرابط"
                            >
                                <i class="bi bi-clipboard"></i> نسخ
                            </button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button 
                            onclick="openTrackingLink()" 
                            class="btn btn-secondary"
                            style="padding: 12px 24px; border-radius: 6px; flex: 1; min-width: 140px;"
                        >
                            <i class="bi bi-box-arrow-up-right"></i> فتح الرابط
                        </button>
                        <button 
                            onclick="sendTrackingLinkToWhatsApp()" 
                            class="btn"
                            style="padding: 12px 24px; border-radius: 6px; flex: 1; min-width: 140px; background: #25D366; color: white; border: none;"
                            title="إرسال رابط المتابعة إلى العميل عبر واتساب"
                        >
                            <i class="bi bi-whatsapp"></i> إرسال للعميل
                        </button>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 15px 25px; border-top: 1px solid var(--border-color);">
                    <button onclick="closeTrackingLinkModal()" class="btn btn-secondary" style="padding: 10px 20px; border-radius: 6px;">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // حفظ البيانات في window للوصول إليها من الدوال
        window.currentTrackingLink = trackingLink;
        window.currentRepairData = repairData;
        window.currentRepairNumber = repairNumber;
    } catch (error) {
        console.error('خطأ في عرض رابط التتبع:', error);
        showMessage('حدث خطأ أثناء عرض رابط المتابعة', 'error');
    }
}

// ✅ دالة لفتح نموذج رابط المتابعة من قائمة الإجراءات
function openTrackingLinkForRepair(repairId) {
    try {
        // البحث عن العملية في القائمة
        const repair = allRepairs.find(r => r.id === repairId);
        
        if (!repair) {
            showMessage('العملية غير موجودة', 'error');
            return;
        }
        
        if (!repair.repair_number) {
            showMessage('رقم العملية غير متوفر', 'error');
            return;
        }
        
        // إنشاء رابط المتابعة
        const trackingLink = generateRepairTrackingLink(repair.repair_number);
        
        if (!trackingLink) {
            showMessage('فشل إنشاء رابط المتابعة', 'error');
            return;
        }
        
        // عرض النموذج
        showTrackingLinkModal(repair.repair_number, trackingLink, repair);
        
    } catch (error) {
        console.error('خطأ في فتح نموذج رابط المتابعة:', error);
        showMessage('حدث خطأ أثناء فتح نموذج رابط المتابعة', 'error');
    }
}

// ✅ دالة لإغلاق مودال رابط التتبع
function closeTrackingLinkModal() {
    try {
        const modal = document.getElementById('trackingLinkModal');
        if (modal) {
            modal.remove();
        }
        window.currentTrackingLink = null;
        window.currentRepairData = null;
        window.currentRepairNumber = null;
    } catch (error) {
        console.error('خطأ في إغلاق مودال رابط التتبع:', error);
    }
}

// ✅ دالة لنسخ رابط التتبع
function copyTrackingLink(event) {
    try {
        const input = document.getElementById('trackingLinkInput');
        if (!input) return;
        
        input.select();
        input.setSelectionRange(0, 99999); // للأجهزة المحمولة
        
        navigator.clipboard.writeText(input.value).then(() => {
            showMessage('تم نسخ الرابط بنجاح', 'success');
            
            // تغيير نص الزر مؤقتاً
            let copyBtn = null;
            
            // محاولة الحصول على الزر من event إذا كان متاحاً
            if (event && event.target) {
                copyBtn = event.target.closest('button');
            }
            
            // إذا لم نجد الزر من event، نبحث عنه بطريقة أخرى
            if (!copyBtn) {
                // البحث عن الزر الذي يحتوي على onclick="copyTrackingLink"
                const buttons = document.querySelectorAll('button[onclick*="copyTrackingLink"]');
                if (buttons.length > 0) {
                    copyBtn = buttons[0];
                }
            }
            
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

// ✅ دالة لإرسال رابط المتابعة للعميل عبر واتساب
async function sendTrackingLinkToWhatsApp() {
    try {
        const repairData = window.currentRepairData;
        const repairNumber = window.currentRepairNumber;
        const trackingLink = window.currentTrackingLink || document.getElementById('trackingLinkInput')?.value;
        
        if (!trackingLink) {
            showMessage('رابط المتابعة غير متوفر', 'error');
            return;
        }
        
        // جلب بيانات العملية إذا لم تكن متوفرة
        let repair = repairData;
        if (!repair || !repair.customer_phone) {
            // محاولة جلب بيانات العملية من allRepairs أو من API
            if (typeof allRepairs !== 'undefined' && Array.isArray(allRepairs)) {
                repair = allRepairs.find(r => r.repair_number === repairNumber);
            }
            
            // إذا لم يتم العثور على البيانات محلياً، جلبها من API
            if ((!repair || !repair.customer_phone) && repairNumber) {
                try {
                    const result = await API.request(`repairs.php?repair_number=${encodeURIComponent(repairNumber)}`, 'GET');
                    if (result && result.success && result.data) {
                        repair = Array.isArray(result.data) ? result.data[0] : result.data;
                    }
                } catch (apiError) {
                    console.error('خطأ في جلب بيانات العملية:', apiError);
                }
            }
        }
        
        if (!repair || !repair.customer_phone) {
            showMessage('رقم هاتف العميل غير متوفر. يرجى التأكد من إدخال رقم الهاتف في بيانات العملية', 'warning');
            return;
        }
        
        // تنظيف رقم الهاتف وإضافة كود البلد "+2"
        let phoneNumber = repair.customer_phone.toString().trim();
        phoneNumber = phoneNumber.replace(/[\s\-\+\(\)]/g, '');
        phoneNumber = '+2' + phoneNumber;
        
        // بناء رسالة الواتساب
        const customerName = repair.customer_name || 'العميل';
        const deviceType = repair.device_type || 'غير محدد';
        const deviceModel = repair.device_model || '';
        const statusText = getRepairStatusText(repair.status || 'pending');
        const customerPrice = repair.customer_price || 0;
        const paidAmount = repair.paid_amount || 0;
        const remainingAmount = repair.remaining_amount || 0;
        
        // بناء نص الرسالة (مبسط للإرسال عبر واتساب)
        let message = `السلام عليكم ${customerName}\n\n`;
        message += `رقم الصيانة: ${repairNumber}\n`;
        message += `نوع الجهاز: ${deviceType}${deviceModel ? ' - ' + deviceModel : ''}\n`;
        
        if (customerPrice > 0) {
            message += `\nالتكلفة: ${customerPrice.toLocaleString()} ج.م\n`;
            if (paidAmount > 0) {
                message += `المدفوع: ${paidAmount.toLocaleString()} ج.م\n`;
            }
            if (remainingAmount > 0) {
                message += `المتبقي: ${remainingAmount.toLocaleString()} ج.م\n`;
            }
        }
        
        message += `\nرابط متابعة الصيانة:\n`;
        message += `${trackingLink}\n\n`;
        message += `يمكنك متابعة حالة الصيانة من خلال الرابط أعلاه\n\n`;
        message += `شكراً لتعاملك معنا`;
        
        // تشفير الرسالة للـ URL
        const encodedMessage = encodeURIComponent(message);
        
        // إنشاء رابط واتساب
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        
        // فتح واتساب في نافذة جديدة
        window.open(whatsappUrl, '_blank');
        
        showMessage('جارٍ فتح واتساب لإرسال الرسالة...', 'success');
        
    } catch (error) {
        console.error('خطأ في إرسال رابط المتابعة عبر واتساب:', error);
        showMessage('حدث خطأ أثناء محاولة إرسال الرسالة عبر واتساب', 'error');
    }
}

// ✅ دالة مساعدة للحصول على نص حالة الصيانة
function getRepairStatusText(status) {
    const statusMap = {
        'pending': 'قيد الانتظار',
        'in_progress': 'قيد التنفيذ',
        'diagnosis': 'قيد التشخيص',
        'awaiting_parts': 'في انتظار قطع الغيار',
        'awaiting_customer_approval': 'في انتظار موافقة العميل',
        'completed': 'مكتملة',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغاة',
        'pickup': 'استلام'
    };
    return statusMap[status] || status;
}

// ✅ عرض نافذة التقييم للصيانة
function showRepairRatingModal(customerId, repairId, repairNumber) {
    try {
        // التحقق من صحة customerId
        if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
            console.warn('showRepairRatingModal: customerId غير صحيح، سيتم تخطي عرض modal التقييم');
            return;
        }
        
        // إزالة أي modals موجودة مسبقاً
        const existingRatingModals = document.querySelectorAll('.modal[data-repair-rating-modal]');
        existingRatingModals.forEach(m => m.remove());
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.setAttribute('data-repair-rating-modal', 'true');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 20000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); animation: fadeIn 0.3s ease;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px; width: 90%; max-height: 90vh; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: slideUp 0.4s ease; display: flex; flex-direction: column;">
                <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                    <h3 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                        <i class="bi bi-star-fill" style="font-size: 1.3em;"></i> تقييم العميل
                    </h3>
                    <button onclick="this.closest('.modal').remove()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
                </div>
                <div class="modal-body" style="padding: 40px 30px; text-align: center; overflow-y: auto; flex: 1; min-height: 0;">
                    <div style="margin-bottom: 10px;">
                        <i class="bi bi-emoji-smile" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block; animation: bounce 2s infinite;"></i>
                        <h4 style="margin: 0 0 10px 0; color: var(--text-dark); font-size: 1.3em; font-weight: 600;">
                            كيف تقيم هذا العميل؟
                        </h4>
                        <p style="margin: 0; color: var(--text-light); font-size: 0.95em;">
                            شاركنا تقييمك للعميل لمساعدتنا على التحسين
                        </p>
                    </div>
                    
                    <div id="repairRatingStarsContainer" style="display: flex; justify-content: center; gap: 10px; font-size: 45px; margin: 35px 0; padding: 20px 0;">
                        <i class="bi bi-star" data-rating="1" style="cursor: pointer; color: var(--border-color); transition: all 0.3s ease; user-select: none;" 
                           onmouseover="highlightRepairRatingStars(this, 1)" 
                           onmouseout="resetRepairRatingStars(this)" 
                           onclick="selectRepairRatingStar(this, 1, '${customerId}', '${repairId}', '${repairNumber}')"></i>
                        <i class="bi bi-star" data-rating="2" style="cursor: pointer; color: var(--border-color); transition: all 0.3s ease; user-select: none;" 
                           onmouseover="highlightRepairRatingStars(this, 2)" 
                           onmouseout="resetRepairRatingStars(this)" 
                           onclick="selectRepairRatingStar(this, 2, '${customerId}', '${repairId}', '${repairNumber}')"></i>
                        <i class="bi bi-star" data-rating="3" style="cursor: pointer; color: var(--border-color); transition: all 0.3s ease; user-select: none;" 
                           onmouseover="highlightRepairRatingStars(this, 3)" 
                           onmouseout="resetRepairRatingStars(this)" 
                           onclick="selectRepairRatingStar(this, 3, '${customerId}', '${repairId}', '${repairNumber}')"></i>
                        <i class="bi bi-star" data-rating="4" style="cursor: pointer; color: var(--border-color); transition: all 0.3s ease; user-select: none;" 
                           onmouseover="highlightRepairRatingStars(this, 4)" 
                           onmouseout="resetRepairRatingStars(this)" 
                           onclick="selectRepairRatingStar(this, 4, '${customerId}', '${repairId}', '${repairNumber}')"></i>
                        <i class="bi bi-star" data-rating="5" style="cursor: pointer; color: var(--border-color); transition: all 0.3s ease; user-select: none;" 
                           onmouseover="highlightRepairRatingStars(this, 5)" 
                           onmouseout="resetRepairRatingStars(this)" 
                           onclick="selectRepairRatingStar(this, 5, '${customerId}', '${repairId}', '${repairNumber}')"></i>
                    </div>
                    
                    <div id="repairRatingFeedback" style="min-height: 30px; margin-top: 20px;">
                        <p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0;">اختر من <strong style="color: var(--primary-color);">1</strong> إلى <strong style="color: var(--primary-color);">5</strong> نجوم</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
        // modal.addEventListener('click', function(e) {
        //     if (e.target === modal) {
        //         modal.remove();
        //     }
        // });
    } catch (error) {
        console.error('خطأ في عرض نافذة التقييم:', error);
    }
}

// تحديد نجمة التقييم في الصيانة
function selectRepairRatingStar(element, rating, customerId, repairId, repairNumber) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('repairRatingFeedback');
    
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
        saveRepairRating(customerId, repairId, repairNumber, rating, container);
    }, 300);
}

// تمييز النجوم عند المرور بالماوس في الصيانة
function highlightRepairRatingStars(element, rating) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('repairRatingFeedback');
    
    // Show preview feedback
    const feedbackTexts = {
        1: '<p style="color: var(--danger-color); font-weight: 600; margin: 0;">رديء جداً 😞</p>',
        2: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">رديء 😐</p>',
        3: '<p style="color: var(--warning-color); font-weight: 600; margin: 0;">متوسط 🙂</p>',
        4: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">جيد جداً 😊</p>',
        5: '<p style="color: var(--success-color); font-weight: 600; margin: 0;">ممتاز 😍</p>'
    };
    
    if (feedbackDiv && !container.querySelector('.bi-star-fill')) {
        feedbackDiv.innerHTML = feedbackTexts[rating] || '<p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0;">اختر من <strong style="color: var(--primary-color);">1</strong> إلى <strong style="color: var(--primary-color);">5</strong> نجوم</p>';
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

// إعادة تعيين النجوم في الصيانة
function resetRepairRatingStars(element) {
    const container = element.parentElement;
    const stars = container.querySelectorAll('[data-rating]');
    const feedbackDiv = document.getElementById('repairRatingFeedback');
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
            feedbackDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 14px; margin: 0;">اختر من <strong style="color: var(--primary-color);">1</strong> إلى <strong style="color: var(--primary-color);">5</strong> نجوم</p>';
        }
    }
}

// حفظ التقييم في الصيانة
async function saveRepairRating(customerId, repairId, repairNumber, rating, starsContainer) {
    try {
        // حفظ التقييم كتقييم معاملة (transaction rating) للعميل
        const result = await API.saveCustomerRating(customerId, null, rating);
        
        if (result && result.success) {
            // Show success animation
            const feedbackDiv = document.getElementById('repairRatingFeedback');
            if (feedbackDiv) {
                feedbackDiv.innerHTML = '<p style="color: var(--success-color); font-weight: 600; margin: 0; animation: fadeIn 0.3s ease;"><i class="bi bi-check-circle"></i> شكراً لك! تم حفظ التقييم بنجاح</p>';
            }
            
            showMessage('تم حفظ تقييم العميل بنجاح', 'success');
            
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

// ✅ تصدير الدوال إلى window
window.closeTrackingLinkModal = closeTrackingLinkModal;
window.copyTrackingLink = copyTrackingLink;
window.openTrackingLink = openTrackingLink;
window.sendTrackingLinkToWhatsApp = sendTrackingLinkToWhatsApp;
window.openTrackingLinkForRepair = openTrackingLinkForRepair;
window.showAddRepairModal = showAddRepairModal;
window.switchRepairType = switchRepairType;
window.showRepairRatingModal = showRepairRatingModal;
window.selectRepairRatingStar = selectRepairRatingStar;
window.highlightRepairRatingStars = highlightRepairRatingStars;
window.resetRepairRatingStars = resetRepairRatingStars;

async function editRepair(id) {
    const repair = allRepairs.find(r => r.id === id);
    if (!repair) return;
    
    // ✅ التحقق من صلاحيات المستخدم (مالك)
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // ✅ السماح بتعديل العمليات الملغاة لإدخال مبلغ الكشف (لأي مستخدم)
    // ✅ منع التعديل على الطلبات المسلمة ما عدا المالك
    if (repair.status === 'delivered' && !isOwner) {
        if (typeof showMessage === 'function') {
            showMessage('لا يمكن تعديل عملية صيانة مسلمة. فقط المالك يمكنه تعديل العمليات المسلمة.', 'error');
        } else {
            alert('لا يمكن تعديل عملية صيانة مسلمة. فقط المالك يمكنه تعديل العمليات المسلمة.');
        }
        return;
    }
    
    // ✅ للعمليات الملغاة: السماح بالتكرار لأي مستخدم (لا يوجد قيود)

    // التأكد من خيارات نوع الجهاز الثابتة قبل تعبئة النموذج
    ensureDeviceTypeOptions();

    document.getElementById('repairModalTitle').textContent = 'تعديل عملية الصيانة';
    document.getElementById('repairId').value = repair.id;
    document.getElementById('selectedCustomerId').value = '';
    document.getElementById('repairNumber').value = repair.repair_number || '';
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
            deviceTypeSelect.value = 'أخرى';
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
    
    // ✅ تحميل تكلفة الكشف
    const inspectionCostInput = document.getElementById('inspectionCost');
    if (inspectionCostInput) {
        inspectionCostInput.value = repair.inspection_cost || 0;
    }
    
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
    
    document.getElementById('deliveryDate').value = repair.delivery_date || '';
    // ✅ إصلاح: التأكد من وجود حالة افتراضية
    const statusSelect = document.getElementById('status');
    if (statusSelect) {
        statusSelect.value = repair.status || 'received';
    }
    
    // ✅ تحميل تقرير الفحص
    const inspectionReportField = document.getElementById('inspectionReport');
    if (inspectionReportField) {
        inspectionReportField.value = repair.inspection_report || '';
    }
    
    // ✅ إخفاء جميع الحقول غير القابلة للتعديل
    // إخفاء حقول الفرع ونوع العميل
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
    // ✅ إزالة required من customerSelect عند التعديل لأنه مخفي
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
        customerSelect.required = false;
    }
    
    // ✅ إخفاء حقول بيانات العميل وإزالة required منها
    const customerFieldsContainer = document.getElementById('customerFieldsContainer');
    if (customerFieldsContainer) {
        customerFieldsContainer.style.display = 'none';
    }
    const customerName = document.getElementById('customerName');
    if (customerName) {
        customerName.required = false;
    }
    const customerPhone = document.getElementById('customerPhone');
    if (customerPhone) {
        customerPhone.required = false;
    }
    const shopNameGroup = document.getElementById('shopNameGroup');
    if (shopNameGroup) {
        shopNameGroup.style.display = 'none';
    }
    
    // ✅ إخفاء حقول بيانات الجهاز وإزالة required منها
    const deviceTypeSelectForHide = document.getElementById('deviceType');
    if (deviceTypeSelectForHide) {
        deviceTypeSelectForHide.required = false;
    }
    const deviceTypeGroup = deviceTypeSelectForHide?.parentElement;
    if (deviceTypeGroup) {
        deviceTypeGroup.style.display = 'none';
    }
    const problemField = document.getElementById('problem');
    if (problemField) {
        problemField.required = false;
    }
    const deviceModelGroup = document.getElementById('deviceModel')?.parentElement;
    if (deviceModelGroup) {
        deviceModelGroup.style.display = 'none';
    }
    const accessoriesGroup = document.getElementById('accessories')?.parentElement;
    if (accessoriesGroup) {
        accessoriesGroup.style.display = 'none';
    }
    const problemGroup = document.getElementById('problem')?.parentElement;
    if (problemGroup) {
        problemGroup.style.display = 'none';
    }
    const repairTypeGroup = document.getElementById('repairType')?.parentElement;
    if (repairTypeGroup) {
        repairTypeGroup.style.display = 'none';
    }
    
    // ✅ إخفاء صورة الجهاز
    const imageUploadGroup = document.querySelector('.image-upload-container')?.parentElement;
    if (imageUploadGroup) {
        imageUploadGroup.style.display = 'none';
    }
    
    // ✅ إخفاء رقم العملية وإزالة required منه
    const repairNumberField = document.getElementById('repairNumber');
    if (repairNumberField) {
        repairNumberField.required = false;
    }
    const repairNumberGroup = repairNumberField?.parentElement;
    if (repairNumberGroup) {
        repairNumberGroup.style.display = 'none';
    }
    
    // ✅ إخفاء المبلغ المدفوع والمتبقي
    const paidAmountGroup = document.getElementById('paidAmount')?.parentElement;
    if (paidAmountGroup) {
        paidAmountGroup.style.display = 'none';
    }
    const remainingAmountGroup = document.getElementById('remainingAmount')?.parentElement;
    if (remainingAmountGroup) {
        remainingAmountGroup.style.display = 'none';
    }
    
    // ✅ إخفاء الملاحظات
    const notesGroup = document.getElementById('notes')?.parentElement;
    if (notesGroup) {
        notesGroup.style.display = 'none';
    }
    
    // ✅ إظهار الحقول القابلة للتعديل فقط:
    // - الفني المستلم (technicianSelect) - سيتم إظهاره تلقائياً
    // - السعر للعميل (customerPrice) - سيتم إظهاره تلقائياً
    // - تكلفة الإصلاح (repairCost) - سيتم إظهاره تلقائياً
    // - اسم محل قطع الغيار (partsStore) - سيتم إظهاره تلقائياً
    // - أرقام فواتير قطع الغيار (sparePartsInvoicesContainer) - سيتم إظهاره تلقائياً
    // - تاريخ التسليم (deliveryDate) - سيتم إظهاره تلقائياً
    // - الحالة (status) - سيتم إظهاره تلقائياً
    // - Serial Number (serialNumber) - يجب إظهاره
    // - تقرير الفحص (inspectionReport) - يجب إظهاره
    const serialNumberGroup = document.getElementById('serialNumber')?.parentElement;
    if (serialNumberGroup) {
        serialNumberGroup.style.display = 'block';
    }
    const inspectionReportGroup = document.getElementById('inspectionReportGroup');
    if (inspectionReportGroup) {
        inspectionReportGroup.style.display = 'block';
    }
    
    // ✅ إظهار حقل تكلفة الكشف للعمليات الملغاة فقط
    if (repair.status === 'cancelled') {
        const inspectionCostGroup = document.getElementById('inspectionCostGroup');
        if (inspectionCostGroup) {
            inspectionCostGroup.style.display = 'block';
            const inspectionCostInput = document.getElementById('inspectionCost');
            if (inspectionCostInput) {
                inspectionCostInput.required = true;
            }
        }
        
        // ✅ إخفاء جميع الحقول الأخرى للعمليات الملغاة (ما عدا inspection_cost)
        const technicianSelectGroup = document.getElementById('technicianSelect')?.parentElement;
        if (technicianSelectGroup) {
            technicianSelectGroup.style.display = 'none';
        }
        const customerPriceGroup = document.getElementById('customerPrice')?.parentElement;
        if (customerPriceGroup) {
            customerPriceGroup.style.display = 'none';
        }
        const repairCostGroup = document.getElementById('repairCost')?.parentElement;
        if (repairCostGroup) {
            repairCostGroup.style.display = 'none';
        }
        const partsStoreGroup = document.getElementById('partsStore')?.parentElement;
        if (partsStoreGroup) {
            partsStoreGroup.style.display = 'none';
        }
        const sparePartsInvoicesContainer = document.getElementById('sparePartsInvoicesContainer');
        if (sparePartsInvoicesContainer) {
            sparePartsInvoicesContainer.style.display = 'none';
        }
        const deliveryDateGroup = document.getElementById('deliveryDate')?.parentElement;
        if (deliveryDateGroup) {
            deliveryDateGroup.style.display = 'none';
        }
        const statusGroup = document.getElementById('status')?.parentElement;
        if (statusGroup) {
            statusGroup.style.display = 'none';
        }
        if (serialNumberGroup) {
            serialNumberGroup.style.display = 'none';
        }
        if (inspectionReportGroup) {
            inspectionReportGroup.style.display = 'none';
        }
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
    // ✅ استخدام preserveValue = true عند التعديل للحفاظ على قيمة الفني المحددة
    await loadRepairTechnicians(branchIdForEdit, true);
    
    // ✅ إصلاح: تحديد الفني المستلم من العملية بشكل أفضل
    const technicianSelect = document.getElementById('technicianSelect');
    if (technicianSelect && repair.created_by) {
        const createdById = String(repair.created_by);
        // البحث عن الخيار المطابق
        const matchingOption = Array.from(technicianSelect.options).find(option => {
            return option.value === createdById || String(option.value) === createdById;
        });
        
        if (matchingOption) {
            technicianSelect.value = matchingOption.value;
        } else {
            console.warn('editRepair: لم يتم العثور على الفني في القائمة - created_by =', repair.created_by);
            // إذا لم يتم العثور على الفني، نحدد القيمة الأولى المتاحة
            if (technicianSelect.options.length > 1) {
                technicianSelect.selectedIndex = 1; // تخطي الخيار الأول (جاري التحميل...)
            }
        }
    }
    
    // ✅ إصلاح: إعادة حساب المتبقي بعد تحميل القيم
    calculateRemaining();
    
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

// ✅ دالة لطباعة فاتورة التسليم باستخدام القالب الجديد
async function printDeliveredRepairInvoice(repair) {
    try {
        console.log('🚀 ========== بدء طباعة فاتورة التسليم ==========');
        console.log('📋 بيانات العملية الكاملة:', JSON.stringify(repair, null, 2));
        
        if (!repair) {
            console.error('❌ بيانات العملية غير موجودة (repair is null/undefined)');
            showMessage('بيانات العملية غير موجودة', 'error');
            throw new Error('بيانات العملية غير موجودة');
        }
        
        if (!repair.id) {
            console.error('❌ معرف العملية غير موجود (repair.id is missing)');
            console.error('بيانات العملية:', repair);
            showMessage('معرف العملية غير موجود', 'error');
            throw new Error('معرف العملية غير موجود');
        }
        
        console.log('✅ التحقق من البيانات نجح - ID:', repair.id, 'Status:', repair.status);
        // ✅ جلب بيانات الفرع والتحقق من الفرع الثاني
        let branchData = null;
        let isSecondBranch = false;
        
        if (repair.branch_id) {
            try {
                // جلب بيانات الفرع المحدد
                const branchResponse = await API.request(`branches.php?id=${repair.branch_id}`, 'GET');
                if (branchResponse && branchResponse.success && branchResponse.data) {
                    branchData = Array.isArray(branchResponse.data) ? branchResponse.data[0] : branchResponse.data;
                }
                
                // ✅ جلب جميع الفروع للبحث عن فرع "البيطاش"
                const allBranchesResponse = await API.request('branches.php', 'GET');
                if (allBranchesResponse && allBranchesResponse.success && allBranchesResponse.data) {
                    const branches = Array.isArray(allBranchesResponse.data) ? allBranchesResponse.data : [allBranchesResponse.data];
                    
                    // البحث عن فرع "البيطاش"
                    const baytashBranch = branches.find(branch => {
                        const branchName = (branch.name || '').trim();
                        return branchName === 'البيطاش';
                    });
                    
                    if (baytashBranch && String(repair.branch_id) === String(baytashBranch.id)) {
                        isSecondBranch = true;
                        console.log('✅ تم تحديد الفرع الثاني (البيطاش) للعملية - branch_id:', repair.branch_id);
                    } else {
                        console.log('ℹ️ العملية مرتبطة بالفرع الأول - branch_id:', repair.branch_id, 'baytash_id:', baytashBranch?.id);
                    }
                }
            } catch (error) {
                console.error('خطأ في جلب بيانات الفرع:', error);
            }
        }
        
        // ✅ جلب إعدادات المحل
        let shopSettings = {
            shop_name: ' ',
            shop_phone: '',
            shop_address: '',
            shop_logo: '',
            currency: 'ج.م',
            whatsapp_number: '',
            shop_name_2: '',
            shop_phone_2: '',
            shop_address_2: '',
            currency_2: 'ج.م',
            whatsapp_number_2: ''
        };
        
        try {
            const settingsResponse = await API.request('settings.php', 'GET');
            if (settingsResponse && settingsResponse.success && settingsResponse.data) {
                shopSettings = settingsResponse.data;
                console.log('✅ تم جلب إعدادات المحل:', shopSettings);
            }
        } catch (error) {
            console.error('خطأ في جلب إعدادات المحل:', error);
        }
        
        // ✅ استخدام إعدادات الفرع الثاني إذا كانت العملية مرتبطة به، وإلا استخدام إعدادات الفرع الأول
        let finalShopName, finalShopPhone, finalShopAddress, finalShopLogo, currency, whatsappNumber;
        
        if (isSecondBranch) {
            // ✅ استخدام إعدادات الفرع الثاني (المفاتيح التي تنتهي بـ _2)
            finalShopName = (branchData && branchData.name) || shopSettings.shop_name_2 || shopSettings.shop_name || 'محل صيانة الهواتف';
            finalShopPhone = shopSettings.shop_phone_2 || shopSettings.shop_phone || '';
            finalShopAddress = shopSettings.shop_address_2 || shopSettings.shop_address || '';
            finalShopLogo = shopSettings.shop_logo || '';
            currency = shopSettings.currency_2 || shopSettings.currency || 'ج.م';
            whatsappNumber = shopSettings.whatsapp_number_2 || shopSettings.whatsapp_number || '';
            console.log('✅ استخدام إعدادات الفرع الثاني:', { finalShopName, finalShopPhone, finalShopAddress, currency, whatsappNumber });
        } else {
            // ✅ استخدام إعدادات الفرع الأول (المفاتيح العادية)
            finalShopName = (branchData && branchData.name) || shopSettings.shop_name || 'محل صيانة الهواتف';
            finalShopPhone = shopSettings.shop_phone || '';
            finalShopAddress = shopSettings.shop_address || '';
            finalShopLogo = shopSettings.shop_logo || '';
            currency = shopSettings.currency || 'ج.م';
            whatsappNumber = shopSettings.whatsapp_number || '';
            console.log('✅ استخدام إعدادات الفرع الأول:', { finalShopName, finalShopPhone, finalShopAddress, currency, whatsappNumber });
        }
        
        // ✅ دوال مساعدة
        const formatDateFunc = (dateString) => {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Cairo' });
            } catch (e) {
                return '-';
            }
        };
        
        const formatDateTime = (dateString) => {
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
            } catch (e) {
                return '-';
            }
        };
        
        // ✅ تحضير البيانات للقالب
        const invoiceData = {
            shopInfo: {
                address: finalShopAddress || '',
                whatsapp: whatsappNumber || '',
                phone: finalShopPhone || '',
                logo: finalShopLogo || 'vertopal.com_photo_5922357566287580087_y.png'
            },
            repairId: repair.id || '',
            repairNumber: repair.repair_number || repair.id || '',
            customerName: repair.customer_name || '-',
            customerPhone: repair.customer_phone || '-',
            deviceType: repair.device_type || '-',
            deviceModel: repair.device_model || '-',
            serialNumber: repair.serial_number || '-',
            problem: repair.problem || '-',
            accessories: repair.accessories || '',
            technicianName: repair.technician_name || 'غير محدد',
            deliveryDate: repair.delivered_at ? formatDateTime(repair.delivered_at) : (repair.delivery_date ? formatDateFunc(repair.delivery_date) : formatDateFunc(repair.created_at || new Date())),
            repairCost: parseFloat(repair.customer_price || repair.cost || 0),
            paidAmount: parseFloat(repair.paid_amount || 0),
            remainingAmount: parseFloat(repair.remaining_amount || 0),
            total: parseFloat(repair.customer_price || repair.cost || 0),
            notes: repair.notes || '',
            currency: currency || 'ج.م'
        };
        
        console.log('بيانات الفاتورة المحضرة:', invoiceData);
        
        // ✅ فتح القالب في نافذة جديدة مع تمرير البيانات عبر URL
        try {
            const dataParam = encodeURIComponent(JSON.stringify(invoiceData));
            
            // ✅ بناء المسار الصحيح للقالب
            let templateUrl = 'last.html';
            const currentPath = window.location.pathname;
            
            // ✅ بناء المسار النسبي بناءً على موقع الملف الحالي
            if (currentPath && currentPath !== '/') {
                const pathParts = currentPath.split('/').filter(p => p && p !== 'index.html' && p !== 'dashboard.html');
                if (pathParts.length > 0) {
                    // إزالة اسم الملف الحالي
                    pathParts.pop();
                    if (pathParts.length > 0) {
                        templateUrl = '/' + pathParts.join('/') + '/last.html';
                    } else {
                        templateUrl = '/last.html';
                    }
                } else {
                    templateUrl = '/last.html';
                }
            } else {
                templateUrl = '/last.html';
            }
            
            // ✅ بناء URL كامل
            const baseUrl = window.location.origin;
            const urlWithData = baseUrl + templateUrl + '?data=' + dataParam;
            
            console.log('📍 معلومات المسار:');
            console.log('  - المسار الحالي:', currentPath);
            console.log('  - المسار النسبي للقالب:', templateUrl);
            console.log('  - URL الكامل:', urlWithData);
            
            console.log('✅ فتح فاتورة التسليم');
            console.log('المسار النسبي:', templateUrl);
            console.log('URL الكامل:', urlWithData);
            console.log('بيانات الفاتورة:', invoiceData);
            
            // ✅ فتح النافذة
            const printWindow = window.open(urlWithData, '_blank', 'width=900,height=700');
            
            if (!printWindow) {
                showMessage('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال', 'error');
                return;
            }
            
            // ✅ إعطاء النافذة وقت للتحميل
            printWindow.focus();
            console.log('✅ تم فتح نافذة الفاتورة بنجاح');
            console.log('📄 النافذة مفتوحة، البيانات موجودة في URL وسيتم تحميلها تلقائياً');
            
            // ✅ محاولة تحديث البيانات بعد تحميل الصفحة (اختياري - البيانات موجودة في URL)
            let attempts = 0;
            const maxAttempts = 15; // 3 ثوان (15 * 200ms)
            
            const checkAndUpdate = setInterval(() => {
                attempts++;
                try {
                    if (printWindow.closed) {
                        console.log('⚠️ تم إغلاق نافذة الفاتورة');
                        clearInterval(checkAndUpdate);
                        return;
                    }
                    
                    if (printWindow.document && printWindow.document.readyState === 'complete') {
                        try {
                            // محاولة تحديث البيانات مباشرة (قد يفشل بسبب CORS)
                            if (printWindow.setInvoiceData && typeof printWindow.setInvoiceData === 'function') {
                                printWindow.setInvoiceData(invoiceData);
                                console.log('✅ تم تحديث بيانات الفاتورة مباشرة');
                                clearInterval(checkAndUpdate);
                                return;
                            }
                        } catch (e) {
                            // CORS error متوقع - البيانات موجودة في URL وسيتم تحميلها تلقائياً
                            console.log('ℹ️ البيانات موجودة في URL، سيتم تحميلها تلقائياً من last.html');
                        }
                        
                        // التوقف بعد عدد محاولات معين
                        if (attempts >= maxAttempts) {
                            clearInterval(checkAndUpdate);
                            console.log('✅ تم فتح الفاتورة - البيانات موجودة في URL');
                        }
                    }
                } catch (error) {
                    // CORS error متوقع - البيانات موجودة في URL
                    console.log('ℹ️ CORS error متوقع - البيانات موجودة في URL');
                    if (attempts >= maxAttempts) {
                        clearInterval(checkAndUpdate);
                    }
                }
            }, 200);
            
            console.log('✅ ========== انتهى استدعاء printDeliveredRepairInvoice ==========');
            
        } catch (error) {
            console.error('❌ خطأ في فتح نافذة الفاتورة:', error);
            console.error('تفاصيل الخطأ:', {
                message: error.message,
                stack: error.stack,
                url: urlWithData
            });
            showMessage('حدث خطأ أثناء فتح الفاتورة: ' + (error.message || 'خطأ غير معروف'), 'error');
            throw error; // ✅ إعادة رمي الخطأ ليتم التقاطه في printRepairReceipt
        }
        
    } catch (error) {
        console.error('❌ خطأ في طباعة فاتورة التسليم:', error);
        console.error('تفاصيل الخطأ:', {
            message: error.message,
            stack: error.stack,
            repair: repair
        });
        showMessage('حدث خطأ أثناء طباعة الفاتورة: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

async function printRepairReceipt(id) {
    // ✅ استخدام الدالة الصحيحة من customers.js مباشرة
    try {
        // جلب البيانات من API (نفس طريقة customers.js)
        const response = await API.request(`repairs.php?id=${id}`, 'GET');
        if (!response || !response.success || !response.data) {
            const errorMsg = response?.message || 'فشل في جلب بيانات عملية الصيانة';
            showMessage(errorMsg, 'error');
            return;
        }
        
        const repair = Array.isArray(response.data) ? response.data[0] : response.data;
        if (!repair) {
            showMessage('عملية الصيانة غير موجودة', 'error');
            return;
        }
        
        // ✅ إذا كانت الحالة "تم التسليم"، استخدم القالب الجديد
        console.log('🔍 فحص حالة عملية الصيانة...');
        console.log('حالة العملية (الأصلية):', repair.status);
        console.log('نوع البيانات:', typeof repair.status);
        
        const status = String(repair.status || '').toLowerCase().trim();
        console.log('حالة العملية (بعد التحويل):', status);
        console.log('هل الحالة = delivered?', status === 'delivered');
        
        if (status === 'delivered') {
            console.log('✅ استخدام قالب فاتورة التسليم - حالة: تم التسليم');
            console.log('📄 استدعاء printDeliveredRepairInvoice...');
            try {
                await printDeliveredRepairInvoice(repair);
                console.log('✅ تم استدعاء printDeliveredRepairInvoice بنجاح');
                return; // ✅ مهم: إرجاع هنا لمنع استمرار الكود
            } catch (error) {
                console.error('❌ خطأ في printDeliveredRepairInvoice:', error);
                // لا نستمر إلى الإيصال العادي، نعرض رسالة خطأ
                showMessage('حدث خطأ أثناء طباعة فاتورة التسليم: ' + (error.message || 'خطأ غير معروف'), 'error');
                return; // ✅ إرجاع هنا أيضاً لمنع استمرار الكود
            }
        }
        
        console.log('ℹ️ استخدام قالب الإيصال العادي - الحالة:', repair.status, '(ليست delivered)');
        
        // ✅ جلب بيانات الفرع والتحقق من الفرع الثاني
        let branchData = null;
        let isSecondBranch = false;
        
        if (repair.branch_id) {
            try {
                // جلب بيانات الفرع المحدد
                const branchResponse = await API.request(`branches.php?id=${repair.branch_id}`, 'GET');
                if (branchResponse && branchResponse.success && branchResponse.data) {
                    branchData = Array.isArray(branchResponse.data) ? branchResponse.data[0] : branchResponse.data;
                }
                
                // ✅ جلب جميع الفروع للبحث عن فرع "البيطاش"
                const allBranchesResponse = await API.request('branches.php', 'GET');
                if (allBranchesResponse && allBranchesResponse.success && allBranchesResponse.data) {
                    const branches = Array.isArray(allBranchesResponse.data) ? allBranchesResponse.data : [allBranchesResponse.data];
                    
                    // البحث عن فرع "البيطاش"
                    const baytashBranch = branches.find(branch => {
                        const branchName = (branch.name || '').trim();
                        return branchName === 'البيطاش';
                    });
                    
                    if (baytashBranch && String(repair.branch_id) === String(baytashBranch.id)) {
                        isSecondBranch = true;
                        console.log('✅ تم تحديد الفرع الثاني (البيطاش) للعملية - branch_id:', repair.branch_id);
                    } else {
                        console.log('ℹ️ العملية مرتبطة بالفرع الأول - branch_id:', repair.branch_id, 'baytash_id:', baytashBranch?.id);
                    }
                }
            } catch (error) {
                console.error('خطأ في جلب بيانات الفرع:', error);
            }
        }
        
        // ✅ جلب إعدادات المحل
        let shopSettings = {
            shop_name: '',
            shop_phone: '',
            shop_address: '',
            shop_logo: '',
            currency: 'ج.م',
            whatsapp_number: '',
            shop_name_2: '',
            shop_phone_2: '',
            shop_address_2: '',
            currency_2: 'ج.م',
            whatsapp_number_2: ''
        };
        
        try {
            const settingsResponse = await API.request('settings.php', 'GET');
            if (settingsResponse && settingsResponse.success && settingsResponse.data) {
                shopSettings = settingsResponse.data;
                console.log('✅ تم جلب إعدادات المحل:', shopSettings);
            }
        } catch (error) {
            console.error('خطأ في جلب إعدادات المحل:', error);
        }
        
        // ✅ استخدام إعدادات الفرع الثاني إذا كانت العملية مرتبطة به، وإلا استخدام إعدادات الفرع الأول
        let finalShopName, finalShopPhone, finalShopAddress, finalShopLogo, currency, whatsappNumber;
        
        if (isSecondBranch) {
            // ✅ استخدام إعدادات الفرع الثاني (المفاتيح التي تنتهي بـ _2)
            finalShopName = (branchData && branchData.name) || shopSettings.shop_name_2 || shopSettings.shop_name || 'محل صيانة الهواتف';
            finalShopPhone = shopSettings.shop_phone_2 || shopSettings.shop_phone || '';
            finalShopAddress = shopSettings.shop_address_2 || shopSettings.shop_address || '';
            finalShopLogo = shopSettings.shop_logo || '';
            currency = shopSettings.currency_2 || shopSettings.currency || 'ج.م';
            whatsappNumber = shopSettings.whatsapp_number_2 || shopSettings.whatsapp_number || '';
            console.log('✅ استخدام إعدادات الفرع الثاني:', { finalShopName, finalShopPhone, finalShopAddress, currency, whatsappNumber });
        } else {
            // ✅ استخدام إعدادات الفرع الأول (المفاتيح العادية)
            finalShopName = (branchData && branchData.name) || shopSettings.shop_name || 'محل صيانة الهواتف';
            finalShopPhone = shopSettings.shop_phone || '';
            finalShopAddress = shopSettings.shop_address || '';
            finalShopLogo = shopSettings.shop_logo || '';
            currency = shopSettings.currency || 'ج.م';
            whatsappNumber = shopSettings.whatsapp_number || '';
            console.log('✅ استخدام إعدادات الفرع الأول:', { finalShopName, finalShopPhone, finalShopAddress, currency, whatsappNumber });
        }
        
        // ✅ إنشاء رابط التتبع - استخدام repair_number بدلاً من number
        const repairNumber = repair.repair_number || repair.id;
        const trackingLink = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '')}/repair-tracking.html?repair_number=${encodeURIComponent(repairNumber)}`;
        
        // ✅ إنشاء QR Code
        const generateQRCodeFallback = (data, size = 200) => {
            return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&choe=UTF-8`;
        };
        let qrCodeImage = generateQRCodeFallback(trackingLink, 200);
        
        // ✅ تحضير الشعار
        let logoHtml = '';
        const defaultLogoPath = 'vertopal.com_photo_5922357566287580087_y.png';
        const fallbackLogoPath1 = 'photo_5922357566287580087_y.jpg';
        const fallbackLogoPath2 = 'ico/icon-192x192.png';
        
        const createLogoHtml = (src) => {
            return `<img src="${src}" alt="شعار المحل" class="invoice-logo" style="max-width: 500px; max-height: 500px; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src='${defaultLogoPath}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath1}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath2}'; this.onerror=function(){this.style.display='none';};};};">`;
        };
        
        if (finalShopLogo && finalShopLogo.trim() !== '') {
            logoHtml = createLogoHtml(finalShopLogo);
        } else {
            logoHtml = createLogoHtml(defaultLogoPath);
        }
        
        // ✅ دوال مساعدة
        const formatPrice = (price) => parseFloat(price || 0).toFixed(2);
        const formatDateFunc = (dateString) => {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Cairo' });
            } catch (e) {
                return '-';
            }
        };
        const getStatusTextFunc = (status) => {
            const statuses = {
                'received': 'تم الاستلام', 'pending': 'قيد الانتظار', 'in_progress': 'قيد الإصلاح',
                'ready': 'جاهز', 'delivered': 'تم التسليم', 'cancelled': 'ملغي', 'lost': 'مفقود'
            };
            return statuses[status] || status || '-';
        };
        
        const technicianName = repair.technician_name || 'غير محدد';
        const branchName = (branchData && branchData.name) || 'غير محدد';
        
        // ✅ فتح نافذة الطباعة
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            showMessage('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال', 'error');
            return;
        }
        
        // ✅ كتابة HTML - التصميم المطابق للصورة
        const customerName = repair.customer_name || '';
        const customerPhone = repair.customer_phone || '';
        const deliveryDateFormatted = repair.delivery_date ? formatDateFunc(repair.delivery_date) : '';
        const repairCost = repair.customer_price || 0;
        const inspectionCost = repair.inspection_cost || 0;
        
        printWindow.document.open('text/html', 'replace');
        printWindow.document.write(`
<!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>إيصال ${repair.status === 'delivered' ? 'تسليم' : 'استلام'} - ${repair.repair_number}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&family=Almarai:wght@300;400;700;800&display=swap" rel="stylesheet">
            <style>
                /* ✅ إضافة CSS Variables للطباعة */
                :root {
                    --primary-color: #2196F3;
                    --secondary-color: #64B5F6;
                    --text-dark: #333;
                    --text-light: #666;
                    --border-color: #ddd;
                    --light-bg: #f5f5f5;
                    --white: #ffffff;
                }
                
                /* ✅ التأكد من ظهور المحتوى */
                body {
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                
                .invoice-wrapper {
                    visibility: visible !important;
                    opacity: 1 !important;
                    display: block !important;
                }
                
                .invoice-wrapper > * {
                    visibility: visible !important;
                    opacity: 1 !important;
                    display: block !important;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Cairo', 'Tajawal', 'Almarai', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #f5f5f5;
                    padding: 20px;
                    color: #333;
                    margin: 0;
                    direction: rtl;
                }
                
                /* ✅ أنماط invoice-wrapper الأساسية */
                .invoice-wrapper {
                    direction: rtl;
                    font-family: 'Cairo', 'Tajawal', 'Almarai', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #ffffff;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                    border-radius: 16px;
                    font-size: 16px;
                    line-height: 1.7;
                }
                
                .invoice-logo-section {
                    text-align: center;
                    margin-bottom: 3px;
                    margin-top: 0;
                    padding: 2px 0;
                }
                
                .invoice-logo {
                    max-width: 500px;
                    max-height: 500px;
                    width: auto;
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }
                
                .invoice-header {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 3px solid #2196F3;
                }
                
                .invoice-shop-name {
                    font-size: 2.2em;
                    font-weight: 700;
                    color: #2196F3;
                    margin-bottom: 12px;
                }
                
                /* مطابق فاتورة البيع (invoices.php) */
                .invoice-shop-info {
                    color: #666;
                    line-height: 1.8;
                    font-size: 1.05em;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    align-items: center;
                    font-weight: 500;
                }
                
                .invoice-shop-info div {
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #555;
                    font-weight: 500;
                }
                
                /* تفاصيل الفاتورة + device info: نفس تصميم وحجم خطوط invoices.php، اتنين في كل سطر */
                .invoice-details,
                .invoice-extra-info {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 15px;
                    padding: 12px 15px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
                }
                .invoice-details-row,
                .invoice-extra-info-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px 15px;
                }
                .invoice-details-row > div,
                .invoice-extra-info-row > div {
                    color: var(--text-dark);
                    font-size: 0.95em;
                    padding: 4px 0;
                    line-height: 1.5;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .invoice-details-row > div strong,
                .invoice-extra-info-row > div strong {
                    color: var(--primary-color);
                    font-weight: 600;
                    min-width: fit-content;
                }
                
                .invoice-summary {
                    margin-top: 25px;
                    padding: 25px;
                    background: #f8f9fa;
                    border-radius: 12px;
                }
                
                .invoice-summary .summary-row {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 15px;
                    font-size: 1.1em;
                    padding: 10px 0;
                }
                
                .invoice-summary .summary-row.total {
                    font-size: 1.9em;
                    font-weight: 800;
                    color: #2196F3;
                    padding: 20px 0;
                    border-top: 3px solid #2196F3;
                    margin-top: 20px;
                }
                
                @media (max-width: 768px) {
                    .invoice-details,
                    .invoice-extra-info {
                        padding: 12px 15px !important;
                        gap: 8px !important;
                    }
                    .invoice-details-row,
                    .invoice-extra-info-row {
                        gap: 8px 15px !important;
                    }
                }
                
                .invoice-delivery-date {
                    text-align: center;
                    margin: 15px 0;
                    padding: 15px;
                    background: white;
                    border: 2px solid #000;
                    border-radius: 8px;
                    page-break-inside: avoid;
                }
                
                .invoice-delivery-date > div:first-child {
                    color: #000;
                    font-size: 0.95em;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                
                .invoice-delivery-date > div:last-child {
                    color: #000;
                    font-size: 1.3em;
                    font-weight: 700;
                }
                
                .invoice-summary hr {
                    margin: 18px 0;
                    border: none;
                    border-top: 2px solid #e0e0e0;
                }
                
                .invoice-terms {
                    margin-top: 30px;
                    padding: 20px;
                    background: #fff9e6;
                    border: 2px solid var(--warning-color, #FFA500);
                    border-radius: 8px;
                    page-break-inside: avoid;
                }
                
                .invoice-terms h4 {
                    color: var(--warning-color, #FFA500);
                    margin-bottom: 15px;
                    font-size: 1.1em;
                    font-weight: 700;
                    text-align: center;
                }
                
                .invoice-terms ul {
                    margin: 0;
                    padding-right: 25px;
                    color: var(--text-dark, #333);
                    line-height: 2;
                    font-size: 0.95em;
                }
                
                .invoice-terms li {
                    margin-bottom: 8px;
                }
                
                .invoice-qrcode {
                    text-align: center;
                    margin: 30px 0;
                    padding: 0;
                }
                
                .invoice-qrcode img {
                    max-width: 250px;
                    width: 250px;
                    height: 250px;
                    margin: 0 auto;
                    display: block;
                }
                
                .invoice-footer {
                    text-align: center;
                    margin-top: 35px;
                    padding-top: 25px;
                    border-top: 2px solid #2196F3;
                    color: #666;
                    font-size: 1.2em;
                    font-weight: 600;
                }
                
                .no-print {
                    display: block !important;
                    text-align: center;
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .no-print button {
                    padding: 10px 20px;
                    background: var(--primary-color, #2196F3);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }
                
                .no-print button:hover {
                    background: var(--secondary-color, #64B5F6);
                    transform: translateY(-2px);
                }
                
                .no-print button:last-child {
                    background: var(--secondary-color, #64B5F6);
                }
                
                .no-print button:last-child:hover {
                    background: var(--primary-color, #2196F3);
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
                        visibility: visible !important;
                        opacity: 1 !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    .invoice-wrapper {
                        width: 80mm !important;
                        max-width: 80mm !important;
                        margin: 0 !important;
                        padding: 8px 4px !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        background: white !important;
                        height: auto !important;
                        min-height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        box-sizing: border-box !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        display: block !important;
                    }
                    
                    /* ✅ التأكد من ظهور جميع العناصر */
                    .invoice-wrapper > *:not(.invoice-extra-info) {
                        visibility: visible !important;
                        opacity: 1 !important;
                        display: block !important;
                    }
                    
                    .invoice-logo-section,
                    .invoice-header,
                    .invoice-details,
                    .invoice-summary,
                    .invoice-terms,
                    .invoice-qrcode,
                    .invoice-footer {
                        visibility: visible !important;
                        opacity: 1 !important;
                        display: block !important;
                    }
                    
                    .invoice-extra-info {
                        visibility: visible !important;
                        opacity: 1 !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .invoice-details-row,
                    .invoice-extra-info-row {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                    }
                    
                    .invoice-wrapper * {
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    
                    .invoice-logo-section {
                        padding-top: 0 !important;
                        padding-bottom: 0 !important;
                        margin-top: 0 !important;
                        margin-bottom: 2px !important;
                        background: white !important;
                        box-shadow: none !important;
                        text-align: center !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .invoice-logo {
                        max-width: 60mm !important;
                        max-height: 40mm !important;
                        width: auto !important;
                        height: auto !important;
                        display: block !important;
                        margin: 0 auto 0 auto !important;
                        padding: 0 !important;
                    }
                    
                    .invoice-header {
                        border-bottom: 2px solid #2196F3 !important;
                        padding: 5px 0 !important;
                        margin-top: 2px !important;
                        margin-bottom: 8px !important;
                        font-size: 0.85em !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .invoice-header h2 {
                        font-size: 1em !important;
                        margin: 5px 0 !important;
                    }
                    
                    .invoice-shop-info {
                        font-size: 0.85em !important;
                    }
                    
                    .invoice-shop-info div {
                        font-size: 0.85em !important;
                    }
                    
                    .invoice-details,
                    .invoice-extra-info {
                        padding: 6px 8px !important;
                        margin-bottom: 6px !important;
                        gap: 4px 8px !important;
                        font-size: 0.75em !important;
                        page-break-inside: avoid !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .invoice-details-row,
                    .invoice-extra-info-row {
                        gap: 4px 8px !important;
                    }
                    .invoice-details-row > div,
                    .invoice-extra-info-row > div {
                        padding: 2px 0 !important;
                        font-size: 0.75em !important;
                        line-height: 1.3 !important;
                    }
                    
                    .invoice-delivery-date {
                        margin: 15px 0 !important;
                        padding: 10px !important;
                        background: white !important;
                        border: 2px solid #000 !important;
                        border-radius: 8px !important;
                        box-shadow: none !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .invoice-delivery-date > div:first-child {
                        color: #000 !important;
                        font-size: 0.75em !important;
                        margin-bottom: 5px !important;
                    }
                    
                    .invoice-delivery-date > div:last-child {
                        color: #000 !important;
                        font-size: 0.95em !important;
                    }
                    
                    .invoice-summary {
                        padding: 8px !important;
                        margin: 8px 0 !important;
                        font-size: 0.85em !important;
                        page-break-inside: avoid !important;
                        page-break-before: avoid !important;
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                        background: white !important;
                    }
                    
                    .invoice-summary .summary-row {
                        font-size: 0.9em !important;
                        margin-bottom: 5px !important;
                    }
                    
                    .invoice-summary .summary-row.total {
                        font-size: 1.1em !important;
                        padding: 8px 0 !important;
                    }
                    
                    .invoice-qrcode {
                        page-break-inside: avoid !important;
                        page-break-before: avoid !important;
                        page-break-after: avoid !important;
                        margin: 8px 0 !important;
                        padding: 0 !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        text-align: center !important;
                    }
                    
                    .invoice-qrcode img {
                        max-width: 45mm !important;
                        width: 45mm !important;
                        height: 45mm !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        margin: 0 auto !important;
                    }
                    
                    .invoice-qrcode p {
                        font-size: 0.7em !important;
                        margin-top: 3px !important;
                    }
                    
                    .invoice-terms {
                        margin: 10px 0 !important;
                        padding: 10px !important;
                        font-size: 0.75em !important;
                        page-break-inside: avoid !important;
                        background: #fff9e6 !important;
                        border: 1px solid #FFA500 !important;
                    }
                    
                    .invoice-terms h4 {
                        font-size: 0.75em !important;
                        margin-bottom: 6px !important;
                    }
                    
                    .invoice-terms ul {
                        padding-right: 20px !important;
                        line-height: 1.5 !important;
                        font-size: 0.75em !important;
                    }
                    
                    .invoice-terms li {
                        font-size: 0.75em !important;
                        margin-bottom: 4px !important;
                        font-weight: 600 !important;
                    }
                    
                    .invoice-footer {
                        margin: 10px 0 0 0 !important;
                        padding-top: 10px !important;
                        font-size: 0.8em !important;
                        page-break-inside: avoid !important;
                        box-shadow: none !important;
                        border-top: 2px solid #2196F3 !important;
                        background: white !important;
                    }
                    
                    .invoice-footer div {
                        font-size: 0.8em !important;
                    }
                    
                    .repair-device-image {
                        max-width: 100% !important;
                        max-height: 150px !important;
                        width: auto !important;
                        height: auto !important;
                        display: block !important;
                        margin: 5px auto !important;
                        border: 1px solid #ddd !important;
                        border-radius: 5px !important;
                        page-break-inside: avoid !important;
                    }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f5f5f5; direction: rtl;">
            <div class="invoice-wrapper" style="background: white; padding: 20px; margin: 20px auto; max-width: 800px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 16px;">
                <!-- Logo Section -->
                ${logoHtml ? `<div class="invoice-logo-section" style="text-align: center; margin-top: 0; margin-bottom: 2px; padding: 2px 0;">${logoHtml}</div>` : ''}
                
                <!-- Shop Info -->
                <div class="invoice-header">
                    <div class="invoice-shop-info">
                        ${finalShopAddress ? `<div><i class="bi bi-geo-alt-fill"></i> ${finalShopAddress}</div>` : ''}
                        ${(whatsappNumber || finalShopPhone) ? `<div>${whatsappNumber ? `<i class="bi bi-whatsapp" style="color: #25D366;"></i> واتساب: ${whatsappNumber}` : ''}${whatsappNumber && finalShopPhone ? ' | ' : ''}${finalShopPhone ? `<i class="bi bi-telephone-fill"></i> ${finalShopPhone}` : ''}</div>` : ''}
                </div>
                    <h2 style="margin: 10px 0; color: var(--primary-color, #2196F3); font-size: 1.2em; font-weight: 700;">إيصال ${repair.status === 'delivered' ? 'تسليم' : 'استلام'} جهاز</h2>
                </div>
                
                <!-- Invoice Details (اتنين في كل سطر) -->
                <div class="invoice-details">
                    <div class="invoice-details-row">
                        <div><strong>العميل:</strong> ${repair.customer_name || '-'}</div>
                        <div><strong>الهاتف:</strong> ${repair.customer_phone || '-'}</div>
                    </div>
                    <div class="invoice-details-row">
                        <div><strong>رقم العملية:</strong> ${repair.repair_number || '-'}</div>
                        <div><strong>التاريخ:</strong> ${formatDateFunc(repair.created_at)}</div>
                    </div>
                </div>

                <!-- Device Info (اتنين في كل سطر) -->
                <div class="invoice-extra-info">
                    <div class="invoice-extra-info-row">
                        <div><strong>نوع الجهاز:</strong> ${repair.device_type || '-'}</div>
                        <div><strong>الموديل:</strong> ${repair.device_model || '-'}</div>
                    </div>
                    <div class="invoice-extra-info-row">
                        <div><strong>المشكلة:</strong> ${repair.problem || '-'}</div>
                        <div></div>
                    </div>
                    ${repair.accessories ? `
                    <div class="invoice-extra-info-row">
                        <div><strong>الملحقات:</strong> ${repair.accessories}</div>
                        <div></div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Summary -->
                <div class="invoice-summary">
                    <div class="summary-row">
                        <span>تكلفة الصيانة:</span>
                        <span>${formatPrice(repair.customer_price || repair.cost || 0)} ${currency}</span>
                    </div>
                    ${(repair.paid_amount && parseFloat(repair.paid_amount) > 0) ? `
                    <div class="summary-row">
                        <span>المبلغ المدفوع:</span>
                        <span>${formatPrice(repair.paid_amount)} ${currency}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${repair.notes ? `
                <div class="invoice-extra-info" style="margin-top: 5px;">
                    <div><strong>ملاحظات:</strong> ${repair.notes}</div>
                    </div>
                ` : ''}
                
                ${repair.status === 'delivered' && repair.delivered_at ? `
                <div class="invoice-extra-info" style="margin-top: 5px;">
                    <div><strong>تاريخ التسليم:</strong> ${formatDateFunc(repair.delivered_at)}</div>
                </div>
                ` : ''}
                
                <!-- QR Code -->
                <div class="invoice-qrcode">
                    <br>
                    <img src="${qrCodeImage}" alt="QR Code لمتابعة الصيانة" onerror="this.onerror=null; this.src='https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingLink)}';">
                    <p style="margin-top: 5px; font-size: 1em; color: #666;">يمكنك مسح ال qr code لمتابعة الصيانه بشكل لحظي</p>
                    <br>
            </div>
                
                <!-- Terms & Conditions (حجم الخط مطابق device info: 0.95em) -->
                <div class="invoice-terms" style="margin-top: 30px; padding: 20px; background: #fff9e6; border: 2px solid var(--warning-color, #FFA500); border-radius: 8px;">
                    <h4 style="color: var(--warning-color, #FFA500); margin-bottom: 15px; font-size: 0.95em; font-weight: 700; text-align: center;">
                        <i class="bi bi-exclamation-triangle-fill" style="margin-left: 8px;"></i> شروط وأحكام مهمة
                    </h4>
                    <ul style="margin: 0; padding-right: 25px; color: var(--text-dark, #333); line-height: 2; font-size: 0.95em;">
                        <li style="font-weight: 600;">المحل غير مسئول عن الجهاز بعد مرور شهر من تاريخ الاستلام</li>
                        <li style="font-weight: 600;">ضمان البورد ٧ أيام فقط في حالة التغيير</li>
                        <li style="font-weight: 600;">في حال الالغاء او عدم اتمام عملية الصيانه بناءا علي طلبكم بعد الفحص يتم دفع رسوم الفحص التي يحددها فني المسؤوليين في المكان</li>
                        <li style="font-weight: 600;">المحل غير مسؤول عن اي عطل يظهر في الجهاز بعد عملية الصيانه غير العطل المتفق عليه</li>
                        <li style="font-weight: 600;">في حال ظهرت اعطال غير المتفق عليها يقوم المسؤوليين بالتواصل معكم لنوافيكم بمستجدات مبلغ الفاتوره للحصول علي موافقتكم قبل اكمال الصيانه</li>
                    </ul>
                </div>
                
                <!-- Footer -->
                <div class="invoice-footer">
                    <div>شكراً لثقتكم</div>
                </div>
            </div>
            
            <div class="no-print">
                <button onclick="window.print()">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                <button onclick="window.history.back() || window.close()">
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
        console.error('خطأ في طباعة إيصال الصيانة:', error);
        showMessage('حدث خطأ أثناء طباعة الإيصال: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// وظائف QR Code والملصق المحسّن
async function generateBarcodeLabel(repairId) {
    const repair = allRepairs.find(r => r.id === repairId);
    if (!repair) {
        showMessage('العملية غير موجودة', 'error');
        return;
    }

    try {
        // إنشاء رابط التتبع
        const trackingLink = generateRepairTrackingLink(repair.repair_number);
        if (!trackingLink) {
            showMessage('فشل إنشاء رابط التتبع', 'error');
            return;
        }
        
        // إنشاء QR Code للرابط
        let qrCodeImage = '';
        try {
            qrCodeImage = await generateRepairTrackingQRCode(trackingLink);
            if (!qrCodeImage) {
                throw new Error('فشل إنشاء QR Code');
            }
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            qrCodeImage = generateQRCodeFallback(trackingLink, 200);
        }
        
        // ✅ تحويل QR Code إلى data URL إذا كان URL خارجي
        if (qrCodeImage && !qrCodeImage.startsWith('data:')) {
            try {
                qrCodeImage = await convertImageUrlToDataUrl(qrCodeImage);
            } catch (error) {
                console.warn('فشل تحويل QR Code URL إلى data URL، سيتم استخدام URL الأصلي:', error);
            }
        }
        
        // إنشاء الملصق المحسّن مع QR Code وبيانات العملية
        let labelImage = null;
        try {
            labelImage = await generateQRCodeLabel(repair, qrCodeImage);
        } catch (error) {
            console.error('خطأ في إنشاء الملصق:', error);
            showMessage('تم إنشاء QR Code بنجاح، لكن فشل إنشاء الملصق. يمكنك طباعة QR Code فقط.', 'warning');
            // نعرض QR Code فقط حتى لو فشل إنشاء الملصق
            labelImage = null;
        }
        
        // عرض النتائج
        showQRCodeModal(qrCodeImage, labelImage, repair);
        
    } catch (error) {
        console.error('خطأ في إنشاء QR Code:', error);
        showMessage('خطأ في إنشاء QR Code والملصق: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// ✅ دالة جديدة لإنشاء ملصق محسّن مع QR Code وبيانات العملية
async function generateQRCodeLabel(repair, qrCodeImage) {
    try {
        // ✅ تحويل QR Code URL إلى data URL
        let qrCodeDataUrl = qrCodeImage;
        if (!qrCodeImage.startsWith('data:')) {
            try {
                qrCodeDataUrl = await convertImageUrlToDataUrl(qrCodeImage);
            } catch (error) {
                console.warn('فشل تحويل QR Code URL إلى data URL، سيتم استخدام URL الأصلي:', error);
                qrCodeDataUrl = qrCodeImage;
            }
        }
        
        const canvas = document.createElement('canvas');
        // مقاسات 60x40mm (472x315 pixels عند 200 DPI)
        const width = 472; // عرض 60mm
        const height = 315; // ارتفاع 40mm
        const scale = 2; // دقة مضاعفة للجودة العالية
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        
        // تحسين جودة الرسم
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        // تنظيف الخلفية
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, scaledWidth, scaledHeight);
        
        // رسم الحدود
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2 * scale; // حدود أرفع للملصق الصغير
        ctx.strokeRect(2 * scale, 2 * scale, scaledWidth - 4 * scale, scaledHeight - 4 * scale);
        
        // رسم QR Code على اليسار - حجم أصغر ليتناسب مع الملصق
        const qrSize = 130 * scale; // تقليل حجم QR Code قليلاً لإتاحة مساحة أكبر للنص
        const qrX = 8 * scale; // تقليل المسافة من الحافة
        const qrY = 6 * scale; // تقليل المسافة من الأعلى
        const qrEndX = qrX + qrSize; // نهاية QR Code
        
        // تحميل صورة QR Code مع معالجة أخطاء محسّنة
        const qrImg = new Image();
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('انتهت مهلة تحميل صورة QR Code'));
            }, 15000); // 15 ثانية timeout
            
            qrImg.onload = () => {
                clearTimeout(timeout);
                try {
                    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
                    resolve();
                } catch (error) {
                    console.error('خطأ في رسم QR Code على Canvas:', error);
                    reject(error);
                }
            };
            
            qrImg.onerror = (error) => {
                clearTimeout(timeout);
                console.error('فشل تحميل صورة QR Code:', error);
                // إذا كان URL خارجي وفشل التحميل، نرسم رسالة بديلة
                ctx.fillStyle = '#ff0000';
                ctx.font = `bold ${18 * scale}px "Cairo", Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('فشل تحميل QR Code', qrX + qrSize / 2, qrY + qrSize / 2);
                reject(error);
            };
            
            // محاولة تحميل الصورة
            if (qrCodeDataUrl.startsWith('data:') || qrCodeDataUrl.startsWith('http://') || qrCodeDataUrl.startsWith('https://')) {
                qrImg.crossOrigin = 'anonymous';
                qrImg.src = qrCodeDataUrl;
            } else {
                reject(new Error('مسار QR Code غير صحيح'));
            }
        });
        
        // رسم البيانات على اليمين - بعد QR Code بمسافة كافية
        // النص العربي يبدأ من اليمين (RTL)
        const marginFromQR = 10 * scale; // المسافة بين QR Code والنص
        const marginRight = 8 * scale; // المسافة من الحافة اليمنى
        const marginTop = 6 * scale; // المسافة من الأعلى
        const marginBottom = 3 * scale; // المسافة من الأسفل
        const textStartX = scaledWidth - marginRight; // نقطة بداية النص من اليمين
        const dataY = marginTop; // بداية من الأعلى
        const lineHeight = 26 * scale; // ارتفاع السطر الأساسي (زيادة من 20 إلى 26)
        const sectionSpacing = 10 * scale; // مسافة بين الأقسام (زيادة من 8 إلى 10)
        const lineSpacing = 6 * scale; // مسافة بين الأسطر داخل القسم الواحد (زيادة من 4 إلى 6)
        let currentY = dataY;
        
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right'; // النص العربي من اليمين
        ctx.textBaseline = 'top';
        
        // استخدام خط Cairo للوضوح
        const fontFamily = '"Cairo", "Tajawal", Arial, "Segoe UI", sans-serif';
        
        // ========== القسم الأول: عنوان الملصق ==========
        ctx.font = `bold ${22 * scale}px ${fontFamily}`; // زيادة من 18 إلى 22
        ctx.fillText('ملصق الجهاز', textStartX, currentY);
        currentY += lineHeight + sectionSpacing;
        
        // ========== القسم الثاني: رقم العملية ==========
        ctx.font = `bold ${20 * scale}px ${fontFamily}`; // زيادة من 16 إلى 20
        ctx.fillText(`رقم: ${repair.repair_number}`, textStartX, currentY);
        currentY += lineHeight + sectionSpacing;
        
        // ========== القسم الثالث: بيانات العميل ==========
        ctx.font = `${18 * scale}px ${fontFamily}`; // زيادة من 15 إلى 18
        const customerName = repair.customer_name || 'غير محدد';
        if (customerName.length > 12) {
            ctx.fillText(`العميل: ${customerName.substring(0, 12)}...`, textStartX, currentY);
        } else {
            ctx.fillText(`العميل: ${customerName}`, textStartX, currentY);
        }
        currentY += lineHeight + lineSpacing;
        
        if (repair.customer_phone) {
            ctx.font = `${18 * scale}px ${fontFamily}`; // زيادة من 15 إلى 18
            ctx.fillText(`الهاتف: ${repair.customer_phone}`, textStartX, currentY);
            currentY += lineHeight + sectionSpacing;
        } else {
            currentY += sectionSpacing - lineSpacing;
        }
        
        // ========== القسم الرابع: بيانات الجهاز ==========
        const deviceText = `${repair.device_type || ''} ${repair.device_model || ''}`.trim();
        if (deviceText) {
            ctx.font = `${18 * scale}px ${fontFamily}`; // زيادة من 15 إلى 18
            const deviceDisplay = deviceText.length > 15 ? deviceText.substring(0, 15) + '...' : deviceText;
            ctx.fillText(`الجهاز: ${deviceDisplay}`, textStartX, currentY);
            currentY += lineHeight + sectionSpacing;
        }
        
        // ========== القسم الخامس: المشكلة ==========
        ctx.font = `bold ${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
        ctx.fillText('المشكلة:', textStartX, currentY);
        currentY += lineHeight + lineSpacing;
        
        ctx.font = `${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
        const problemText = repair.problem || 'غير محدد';
        // حساب العرض المتاح للنص: من بداية النص (textStartX) إلى نهاية QR Code + margin
        const maxTextWidth = textStartX - (qrEndX + marginFromQR); // العرض المتاح للنص
        const words = problemText.split(' ');
        let line = '';
        let linesCount = 0;
        const maxLines = 2; // تقليل من 3 إلى 2 أسطر للمشكلة لتجنب التداخل
        for (let word of words) {
            if (linesCount >= maxLines) break;
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextWidth && line !== '') {
                ctx.fillText(line.trim(), textStartX, currentY);
                currentY += lineHeight + lineSpacing;
                line = word + ' ';
                linesCount++;
            } else {
                line = testLine;
            }
        }
        if (line && linesCount < maxLines) {
            ctx.fillText(line.trim(), textStartX, currentY);
            currentY += lineHeight;
        }
        currentY += sectionSpacing;
        
        // ========== القسم السادس: تاريخ التسليم ==========
        // التحقق من أن هناك مساحة كافية قبل الرسم
        const remainingHeight = scaledHeight - currentY - marginBottom;
        if (remainingHeight >= lineHeight * 1.5) {
            if (repair.delivery_date) {
                ctx.font = `bold ${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
                ctx.fillText('التسليم:', textStartX, currentY);
                currentY += lineHeight + lineSpacing;
                
                ctx.font = `${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
                const deliveryDate = new Date(repair.delivery_date).toLocaleDateString('ar-EG');
                ctx.fillText(deliveryDate, textStartX, currentY);
            } else {
                ctx.font = `bold ${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
                ctx.fillText('التسليم:', textStartX, currentY);
                currentY += lineHeight + lineSpacing;
                
                ctx.font = `${17 * scale}px ${fontFamily}`; // زيادة من 14 إلى 17
                ctx.fillText('غير محدد', textStartX, currentY);
            }
        }
        
        // تحويل إلى الحجم الأصلي مع الحفاظ على الجودة
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(canvas, 0, 0, width, height);
        
        return finalCanvas.toDataURL('image/png', 1.0);
        
    } catch (error) {
        console.error('خطأ في إنشاء الملصق:', error);
        throw error;
    }
}

// ✅ دالة لعرض QR Code والملصق المحسّن
function showQRCodeModal(qrCodeImage, labelImage, repair) {
    // إزالة أي modal موجود مسبقاً
    const existingModal = document.querySelector('.qr-code-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // إنشاء modal جديد
    const qrCodeModal = document.createElement('div');
    qrCodeModal.className = 'modal qr-code-modal';
    qrCodeModal.style.display = 'flex';
    
    // تنظيف بيانات العملية لعرضها مع استخدام escape للسلامة
    const repairNumber = escapeHtml(repair.repair_number || 'غير محدد');
    const customerName = escapeHtml(repair.customer_name || 'غير محدد');
    const customerPhone = escapeHtml(repair.customer_phone || 'غير محدد');
    const deviceType = escapeHtml(repair.device_type || '');
    const deviceModel = escapeHtml(repair.device_model || '');
    const deviceText = `${deviceType} ${deviceModel}`.trim() || 'غير محدد';
    const problem = escapeHtml(repair.problem || 'غير محدد');
    const createdDate = repair.created_at ? new Date(repair.created_at).toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : 'غير محدد';
    const deliveryDate = repair.delivery_date ? new Date(repair.delivery_date).toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : 'لم يتم تحديده';
    const status = repair.status || 'قيد المعالجة';
    const statusText = {
        'pending': 'قيد الانتظار',
        'in_progress': 'قيد المعالجة',
        'completed': 'مكتملة',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغاة'
    }[status] || status;
    
    qrCodeModal.innerHTML = `
        <style>
            .qr-code-modal-content {
                max-width: 900px !important;
            }
            .qr-code-modal-content::-webkit-scrollbar {
                width: 10px;
            }
            .qr-code-modal-content::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 5px;
            }
            .qr-code-modal-content::-webkit-scrollbar-thumb {
                background: var(--primary-color);
                border-radius: 5px;
            }
            .qr-code-modal-content::-webkit-scrollbar-thumb:hover {
                background: var(--secondary-color);
            }
            @media (max-width: 768px) {
                .qr-code-modal-content {
                    max-width: 95% !important;
                    margin: 10px !important;
                }
                .qr-code-modal-content .modal-header h2 {
                    font-size: 1.2em !important;
                }
                .qr-code-modal-content .modal-body {
                    padding: 20px !important;
                }
                .qr-code-section, .label-section {
                    padding: 20px !important;
                }
                .qr-code-container img {
                    max-width: 200px !important;
                }
                .repair-info-section div {
                    grid-template-columns: 1fr !important;
                }
                .modal-footer {
                    flex-direction: column !important;
                }
                .modal-footer button {
                    width: 100% !important;
                }
            }
            @media (max-width: 576px) {
                .qr-code-container img {
                    max-width: 150px !important;
                }
                .modal-header h2 {
                    font-size: 1em !important;
                    line-height: 1.4 !important;
                }
            }
        </style>
        <div class="modal-content qr-code-modal-content" style="max-width: 900px; max-height: 95vh; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: var(--primary-color) var(--light-bg);">
            <div class="modal-header" style="background: var(--primary-color); color: var(--white); border-radius: 8px 8px 0 0; padding: 20px;">
                <h2 style="margin: 0; color: var(--white); font-size: 1.5em;">
                    <i class="bi bi-qr-code-scan"></i> QR Code وملصق العملية - ${repairNumber}
                </h2>
                <button onclick="closeQRCodeModal()" class="btn-close" style="color: var(--white); font-size: 28px; background: transparent; border: none; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
            
            <div class="modal-body" style="padding: 30px;">
                <!-- QR Code Section -->
                <div class="qr-code-section" style="background: var(--white); border: 2px solid var(--border-color); border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center; box-shadow: var(--shadow);">
                    <h3 style="color: var(--primary-color); margin-bottom: 20px; font-size: 1.3em;">
                        <i class="bi bi-qr-code"></i> QR Code للعملية
                    </h3>
                    <div class="qr-code-container" style="display: inline-block; padding: 20px; background: var(--white); border: 2px solid var(--border-color); border-radius: 8px;">
                        <img src="${qrCodeImage}" alt="QR Code ${repairNumber}" style="max-width: 250px; height: auto; display: block;">
                        <p style="margin-top: 15px; font-size: 0.95em; color: var(--text-light); font-weight: bold;">
                            رقم العملية: ${repairNumber}
                        </p>
                    </div>
                    <p style="margin-top: 15px; font-size: 0.9em; color: var(--text-light); line-height: 1.6;">
                        يمكنك مسح QR Code لمتابعة حالة العملية
                    </p>
                    <button onclick="printQRCode('${qrCodeImage}', '${repairNumber}')" class="btn btn-primary" style="margin-top: 20px; padding: 12px 30px; font-size: 1em; border: none; border-radius: 8px; cursor: pointer; background: var(--primary-color); color: var(--white); display: inline-flex; align-items: center; gap: 8px;">
                        <i class="bi bi-printer-fill"></i> طباعة QR Code
                        </button>
                </div>
                
                <!-- Label Section -->
                ${labelImage ? `
                <div class="label-section" style="background: var(--white); border: 2px solid var(--border-color); border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: var(--shadow);">
                    <h3 style="color: var(--primary-color); margin-bottom: 20px; font-size: 1.3em; text-align: center;">
                        <i class="bi bi-tag-fill"></i> الملصق
                    </h3>
                    <div class="label-container" style="text-align: center;">
                        <div style="display: inline-block; padding: 15px; background: var(--light-bg); border-radius: 8px;">
                            <img src="${labelImage}" alt="ملصق ${repairNumber}" style="max-width: 100%; height: auto; border: 2px solid var(--border-color); border-radius: 8px;">
                        </div>
                        <p style="margin-top: 15px; font-size: 0.95em; color: var(--text-light); line-height: 1.6;">
                            ملصق يحتوي على QR Code وبيانات العملية الكاملة
                        </p>
                        <button onclick="printLabel('${labelImage}', '${repairNumber}')" class="btn btn-primary" style="margin-top: 20px; padding: 12px 30px; font-size: 1em; border: none; border-radius: 8px; cursor: pointer; background: var(--primary-color); color: var(--white); display: inline-flex; align-items: center; gap: 8px;">
                            <i class="bi bi-printer-fill"></i> طباعة الملصق
                        </button>
                    </div>
                </div>
                ` : `
                <div class="label-section" style="background: var(--white); border: 2px solid var(--border-color); border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: var(--shadow);">
                    <h3 style="color: var(--warning-color); margin-bottom: 20px; font-size: 1.3em; text-align: center;">
                        <i class="bi bi-exclamation-triangle-fill"></i> تحذير
                    </h3>
                    <div class="label-container" style="text-align: center;">
                        <p style="margin-top: 15px; font-size: 0.95em; color: var(--text-light); line-height: 1.6;">
                            فشل إنشاء الملصق. يمكنك استخدام QR Code فقط للطباعة.
                        </p>
                    </div>
                </div>
                `}
                
            </div>
            
            <div class="modal-footer" style="padding: 20px; background: var(--light-bg); border-top: 2px solid var(--border-color); border-radius: 0 0 8px 8px; display: flex; gap: 15px; justify-content: flex-end; flex-wrap: wrap;">
                ${labelImage ? `
                <button onclick="downloadQRCodeAndLabel('${qrCodeImage}', '${labelImage}', '${repairNumber}')" class="btn btn-success" style="padding: 12px 25px; font-size: 1em; border: none; border-radius: 8px; cursor: pointer; background: var(--success-color); color: var(--white); display: inline-flex; align-items: center; gap: 8px;">
                    <i class="bi bi-download"></i> تحميل الكل
                </button>
                ` : `
                <button onclick="downloadImage('${qrCodeImage}', 'qrcode_${repairNumber}.png')" class="btn btn-success" style="padding: 12px 25px; font-size: 1em; border: none; border-radius: 8px; cursor: pointer; background: var(--success-color); color: var(--white); display: inline-flex; align-items: center; gap: 8px;">
                    <i class="bi bi-download"></i> تحميل QR Code
                </button>
                `}
                <button onclick="closeQRCodeModal()" class="btn btn-secondary" style="padding: 12px 25px; font-size: 1em; border: none; border-radius: 8px; cursor: pointer; background: var(--text-light); color: var(--white); display: inline-flex; align-items: center; gap: 8px;">
                    <i class="bi bi-x-circle-fill"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(qrCodeModal);
    
    // إضافة تأثير click خارج النموذج للإغلاق
    // تعطيل إغلاق المودال عند النقر خارجها - معطل حسب الطلب
    // qrCodeModal.addEventListener('click', (e) => {
    //     if (e.target === qrCodeModal) {
    //         closeQRCodeModal();
    //     }
    // });
}

// ✅ دالة لإغلاق QR Code Modal
function closeQRCodeModal() {
    const modal = document.querySelector('.qr-code-modal');
    if (modal) {
        modal.remove();
    }
}

// ✅ دالة لطباعة QR Code
function printQRCode(qrCodeImage, repairNumber) {
    try {
        const printWindow = window.open('', '', 'width=500,height=500');
        if (!printWindow) {
            showMessage('يرجى السماح بفتح النوافذ المنبثقة للطباعة', 'warning');
            return;
        }
        
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
                <title>طباعة QR Code - ${repairNumber}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 30px; 
                        text-align: center; 
                        font-family: 'Cairo', 'Tajawal', Arial, sans-serif; 
                        background: #f5f5f5;
                    }
                    .qr-container { 
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        display: inline-block;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin: 20px 0;
                    }
                    .qr-container h3 {
                        color: #2196F3;
                        margin-bottom: 20px;
                        font-size: 1.5em;
                    }
                    .qr-code-wrapper {
                        padding: 20px;
                        background: white;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        display: inline-block;
                        margin: 20px 0;
                    }
                    img { 
                        max-width: 300px; 
                        height: auto; 
                        display: block;
                        width: 472px;
                        height: 315px;
                    }
                    .repair-number {
                        margin-top: 15px;
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #333;
                    }
                    .no-print { 
                        text-align: center; 
                        margin-top: 30px; 
                        display: flex; 
                        gap: 15px; 
                        justify-content: center; 
                        flex-wrap: wrap; 
                    }
                    button {
                        padding: 12px 25px; 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer; 
                        font-size: 1em;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        font-family: inherit;
                    }
                    .btn-print {
                        background: #2196F3; 
                        color: white;
                    }
                    .btn-print:hover {
                        background: #1976D2;
                    }
                    .btn-close {
                        background: #666; 
                        color: white;
                    }
                    .btn-close:hover {
                        background: #555;
                    }
                @media print {
                        body { 
                            background: white;
                            padding: 20px;
                        }
                    .no-print { display: none; }
                        .qr-container {
                            box-shadow: none;
                            border: none;
                        }
                }
            </style>
        </head>
        <body>
                <div class="qr-container">
                    <div class="qr-code-wrapper">
                        <img src="${qrCodeImage}" alt="QR Code ${repairNumber}" onerror="this.onerror=null; this.src='${qrCodeImage}';">
                    </div>
                </div>
                <div class="no-print">
                    <button onclick="window.print()" class="btn-print">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                    <button onclick="window.close()" class="btn-close">
                        <i class="bi bi-x-circle"></i> إغلاق
                </button>
            </div>
            <script>
                window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 300);
                }
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
        showMessage('حدث خطأ أثناء الطباعة', 'error');
    }
}

// ✅ دالة لطباعة الملصق المحسّن
function printLabel(labelImage, repairNumber) {
    try {
        const printWindow = window.open('', '', 'width=700,height=600');
        if (!printWindow) {
            showMessage('يرجى السماح بفتح النوافذ المنبثقة للطباعة', 'warning');
            return;
        }
        
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة الملصق - ${repairNumber}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
            <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 30px; 
                        text-align: center; 
                        font-family: 'Cairo', 'Tajawal', Arial, sans-serif; 
                        background: #f5f5f5;
                    }
                    .label-container { 
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        display: inline-block;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin: 20px 0;
                    }
                    .label-container h3 {
                        color: #2196F3;
                        margin-bottom: 20px;
                        font-size: 1.5em;
                    }
                    img { 
                        max-width: 100%; 
                        height: auto; 
                        display: block;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        width: 472px;
                        height: 315px;
                    }
                    .no-print { 
                        text-align: center; 
                        margin-top: 30px; 
                        display: flex; 
                        gap: 15px; 
                        justify-content: center; 
                        flex-wrap: wrap; 
                    }
                    button {
                        padding: 12px 25px; 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer; 
                        font-size: 1em;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        font-family: inherit;
                    }
                    .btn-print {
                        background: #2196F3; 
                        color: white;
                    }
                    .btn-print:hover {
                        background: #1976D2;
                    }
                    .btn-close {
                        background: #666; 
                        color: white;
                    }
                    .btn-close:hover {
                        background: #555;
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
                    .no-print { display: none; }
                        .label-container {
                            box-shadow: none;
                            border: none;
                            padding: 0;
                            margin: 0;
                            width: 60mm;
                            height: 40mm;
                        }
                        img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                }
            </style>
        </head>
        <body>
            <div class="label-container">
                    <img src="${labelImage}" alt="ملصق ${repairNumber}" onerror="this.onerror=null; this.src='${labelImage}';">
            </div>
                <div class="no-print">
                    <button onclick="window.print()" class="btn-print">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                    <button onclick="window.close()" class="btn-close">
                        <i class="bi bi-x-circle"></i> إغلاق
                </button>
            </div>
            <script>
                window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 300);
                }
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
        console.error('خطأ في طباعة الملصق:', error);
        showMessage('حدث خطأ أثناء الطباعة', 'error');
    }
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

// ✅ دالة لتحميل QR Code والملصق
function downloadQRCodeAndLabel(qrCodeImage, labelImage, repairNumber) {
    try {
        // تحميل QR Code
        downloadImage(qrCodeImage, `qrcode_${repairNumber}.png`);
        
        // تحميل الملصق إذا كان متوفراً
        if (labelImage) {
            setTimeout(() => {
                downloadImage(labelImage, `label_${repairNumber}.png`);
                showMessage('تم تحميل QR Code والملصق بنجاح', 'success');
            }, 500);
        } else {
            showMessage('تم تحميل QR Code بنجاح', 'success');
        }
        
    } catch (error) {
        console.error('خطأ في تحميل الصور:', error);
        showMessage('حدث خطأ أثناء تحميل الصور', 'error');
    }
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

// ✅ قارئ QR Code لإيصال الاستلام
async function openBarcodeScanner() {
    // التحقق من وجود ماسح مفتوح بالفعل
    if (isScannerOpen) {
        console.log('يوجد ماسح مفتوح بالفعل');
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    const existingModal = document.getElementById('barcodeScannerModal');
    if (existingModal) {
        console.log('يوجد ماسح مفتوح بالفعل');
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    // إغلاق أي modal مفتوح قبل فتح قارئ QR Code
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
    
    // ✅ تحميل Html5Qrcode بدلاً من Quagga
    if (typeof Html5Qrcode === 'undefined') {
        if (typeof window.loadHtml5Qrcode === 'function') {
            try {
                await window.loadHtml5Qrcode();
            } catch (error) {
                console.error('Error loading html5-qrcode:', error);
                showMessage('فشل تحميل مكتبة قراءة QR Code', 'error');
                return;
            }
        } else {
            showMessage('مكتبة قراءة QR Code غير متاحة', 'error');
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
                    <i class="bi bi-qr-code-scan" style="font-size: 1.3em;"></i> قارئ QR Code لإيصال الاستلام
                </h2>
                <button onclick="closeBarcodeScanner()" class="btn-close" style="color: white; font-size: 1.8em; opacity: 0.9; transition: all 0.3s ease;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity='0.9'; this.style.transform='scale(1)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px;">
                <div id="barcode-scanner-container" style="text-align: center;">
                    <div id="scanner-area" style="width: 100%; min-height: 400px; background: var(--light-bg, #f5f5f5); border-radius: 15px; overflow: hidden; position: relative; margin-bottom: 25px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);">
                        <div id="scanner-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; text-align: center; color: var(--text-dark);">
                            <i class="bi bi-camera" style="font-size: 3em; color: var(--primary-color, #2196F3); margin-bottom: 15px; display: block; animation: pulse 2s infinite;"></i>
                            <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark, #333);">جاري تحميل قارئ QR Code...</p>
                            <p style="font-size: 0.9em; color: var(--text-light, #666); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا</p>
                        </div>
                        <div id="scanner-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 250px; height: 250px; border: 3px solid var(--primary-color, #2196F3); border-radius: 20px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 30px rgba(33, 150, 243, 0.5);"></div>
                            <div style="position: absolute; top: calc(50% - 125px); left: calc(50% - 125px); width: 250px; height: 250px;">
                                <div style="position: absolute; top: 0; left: 0; width: 30px; height: 30px; border-top: 4px solid var(--primary-color, #2196F3); border-right: 4px solid var(--primary-color, #2196F3); border-radius: 5px 20px 0 0;"></div>
                                <div style="position: absolute; top: 0; right: 0; width: 30px; height: 30px; border-top: 4px solid var(--primary-color, #2196F3); border-left: 4px solid var(--primary-color, #2196F3); border-radius: 20px 5px 0 0;"></div>
                                <div style="position: absolute; bottom: 0; left: 0; width: 30px; height: 30px; border-bottom: 4px solid var(--primary-color, #2196F3); border-right: 4px solid var(--primary-color, #2196F3); border-radius: 0 0 20px 5px;"></div>
                                <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; border-bottom: 4px solid var(--primary-color, #2196F3); border-left: 4px solid var(--primary-color, #2196F3); border-radius: 0 0 5px 20px;"></div>
                            </div>
                        </div>
                    </div>
                    <div id="scanner-result" style="margin-top: 20px; display: none; animation: slideDown 0.3s ease;">
                        <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, var(--success-color, #4CAF50) 0%, #66BB6A 100%); color: white; border: none; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                <i class="bi bi-check-circle" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">تم قراءة QR Code بنجاح!</h4>
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
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            #scanner-area video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 15px;
            }
            
            #scanner-area canvas {
                display: none;
            }
        </style>
    `;
    
    document.body.appendChild(scannerModal);
    
    // ✅ بدء تشغيل قارئ QR Code مع تأخير لضمان تحميل العناصر
    setTimeout(() => {
        initializeQRCodeScanner();
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

// ✅ دالة لاستخراج رقم العملية من رابط التتبع
function extractRepairNumberFromTrackingLink(url) {
    try {
        // ✅ تنظيف النص المقروء - إزالة أي مسافات أو أحرف غير مرئية
        const cleanedUrl = url.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        // ✅ محاولة تحليل الرابط
        try {
            const urlObj = new URL(cleanedUrl);
            // ✅ محاولة جلب repair_number أولاً (المعامل الصحيح)
            let repairNumber = urlObj.searchParams.get('repair_number');
            if (repairNumber) {
                return decodeURIComponent(repairNumber);
            }
            
            // ✅ محاولة جلب number (للدعم مع الروابط القديمة)
            repairNumber = urlObj.searchParams.get('number');
            if (repairNumber) {
                return decodeURIComponent(repairNumber);
            }
        } catch (urlError) {
            // إذا فشل تحليل URL (مثلاً إذا كان النص ليس رابط صحيح)، ننتقل للبحث في النص
            console.log('⚠️ فشل تحليل URL، البحث في النص:', urlError);
        }
        
        // ✅ البحث عن repair_number في النص (لحالة الروابط غير الصحيحة أو النص الخام)
        let match = cleanedUrl.match(/repair_number=([^&?]+)/i);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
        
        // ✅ البحث عن number في النص (للدعم مع الروابط القديمة)
        match = cleanedUrl.match(/[?&]number=([^&?]+)/i);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
        
        // ✅ محاولة أخيرة: البحث عن أي رقم في رابط repair-tracking.html
        match = cleanedUrl.match(/repair-tracking\.html[?&](?:repair_number|number)=([^&?]+)/i);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
        
        return null;
    } catch (error) {
        console.error('❌ خطأ في استخراج رقم العملية من الرابط:', error, 'النص:', url);
        return null;
    }
}

// متغير لحفظ مثيل QR Code Scanner
let qrCodeScannerInstance = null;

// ✅ دالة تهيئة قارئ QR Code
async function initializeQRCodeScanner() {
    const scannerArea = document.getElementById('scanner-area');
    const loadingDiv = document.getElementById('scanner-loading');
    
    if (!scannerArea) {
        console.error('scanner-area element not found');
        return;
    }

    // إخفاء رسالة التحميل
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    try {
        // ✅ إنشاء مثيل Html5Qrcode Scanner
        qrCodeScannerInstance = new Html5Qrcode("scanner-area");
        
        // إعدادات المسح
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };
        
        // إضافة supportedScanTypes إذا كان متاحاً
        if (typeof Html5QrcodeScanType !== 'undefined') {
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }
        
        // ✅ بدء المسح
        await qrCodeScannerInstance.start(
            { facingMode: "environment" }, // استخدام الكاميرا الخلفية
            config,
            (decodedText, decodedResult) => {
                // ✅ معالج نجاح قراءة QR Code
                handleQRCodeScanned(decodedText);
            },
            (errorMessage) => {
                // تجاهل الأخطاء المستمرة أثناء المسح (طبيعي)
            }
        );
        
    } catch (error) {
        console.error('خطأ في بدء قارئ QR Code:', error);
        const errorDiv = document.getElementById('scanner-error');
        const errorMessage = document.getElementById('scanner-error-message');
        if (errorDiv && errorMessage) {
            errorMessage.textContent = 'حدث خطأ أثناء بدء تشغيل قارئ QR Code. يرجى التأكد من منح إذن الوصول للكاميرا.';
            errorDiv.style.display = 'block';
        }
        
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = `
                <div style="text-align: center; color: var(--danger-color, #f44336); padding: 20px;">
                    <i class="bi bi-exclamation-triangle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    <p style="font-size: 1.1em; font-weight: 500;">خطأ في بدء الكاميرا</p>
                </div>
            `;
        }
    }
}

// ✅ دالة معالجة قراءة QR Code
async function handleQRCodeScanned(decodedText) {
    console.log('تم قراءة QR Code:', decodedText);
    
    // إيقاف الماسح
    if (qrCodeScannerInstance) {
        qrCodeScannerInstance.stop().then(() => {
            console.log('تم إيقاف قارئ QR Code');
        }).catch((err) => {
            console.error('خطأ في إيقاف قارئ QR Code:', err);
        });
    }
    
    // إخفاء رسالة الخطأ إن وجدت
    const errorDiv = document.getElementById('scanner-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    // ✅ استخراج رقم العملية من رابط التتبع
    const repairNumber = extractRepairNumberFromTrackingLink(decodedText);
    
    if (!repairNumber) {
        // إذا لم يتم العثور على رقم العملية، عرض رسالة خطأ
        const errorDiv = document.getElementById('scanner-error');
        const errorMessage = document.getElementById('scanner-error-message');
        if (errorDiv && errorMessage) {
            errorMessage.textContent = 'QR Code غير صحيح. يرجى التأكد من أنه QR Code إيصال الاستلام.';
            errorDiv.style.display = 'block';
        }
        return;
    }
    
    console.log('رقم العملية المستخرج:', repairNumber);
    
    // ✅ البحث عن العملية في الجدول
    const repair = allRepairs.find(r => r.repair_number === repairNumber);
    
    if (repair) {
        // عرض رسالة النجاح
        const resultDiv = document.getElementById('scanner-result');
        const numberSpan = document.getElementById('scanned-repair-number');
        if (resultDiv && numberSpan) {
            numberSpan.textContent = repairNumber;
            resultDiv.style.display = 'block';
        }
        
        // حفظ رقم العملية للبحث
        window.scannedRepairNumber = repairNumber;
        
        // ✅ إغلاق قارئ QR Code أولاً لتجنب مشاكل overlay
        closeBarcodeScanner();
        
        // ✅ التأكد من وجود النموذج قبل التبديل
        const repairModal = document.getElementById('repairModal');
        if (!repairModal) {
            console.warn('النموذج غير موجود، إعادة تحميل القسم...');
            await loadRepairsSection();
        }
        
        // ✅ التبديل إلى القسم المناسب للعملية (سوفت/هارد/فاست)
        if (repair.repair_type) {
            switchRepairType(repair.repair_type);
        }
        
        // ✅ حساب الصفحة التي تحتوي على العملية والانتقال إليها
        await navigateToRepairPage(repair);
        
        // ✅ انتظار لضمان تحميل الجدول بعد التبديل وإعادة الرسم
        setTimeout(() => {
            // ✅ تمييز العملية في الجدول تلقائياً باللون الأصفر
            highlightRepairInTable(repair.id);
            
            // عرض رسالة النجاح
            showMessage(`تم العثور على العملية: ${repair.customer_name}`, 'success');
        }, 800); // زيادة الوقت لضمان تحميل الجدول
    } else {
        // عرض رسالة عدم وجود العملية
        const resultDiv = document.getElementById('scanner-result');
        const numberSpan = document.getElementById('scanned-repair-number');
        if (resultDiv && numberSpan) {
            numberSpan.textContent = repairNumber;
            resultDiv.style.display = 'block';
        }
        
        // حفظ رقم العملية للبحث
        window.scannedRepairNumber = repairNumber;
    }
}

function closeBarcodeScanner() {
    console.log('إغلاق قارئ QR Code');
    
    // تعيين حالة الماسح كمغلق
    isScannerOpen = false;
    
    // ✅ إيقاف قارئ QR Code بأمان
    try {
        if (qrCodeScannerInstance) {
            qrCodeScannerInstance.stop().then(() => {
                console.log('تم إيقاف قارئ QR Code');
                qrCodeScannerInstance.clear();
                qrCodeScannerInstance = null;
            }).catch((err) => {
                console.log('تم إيقاف قارئ QR Code بالفعل أو خطأ في الإيقاف:', err);
                qrCodeScannerInstance = null;
            });
        }
    } catch (e) {
        console.log('خطأ في إيقاف قارئ QR Code:', e);
        qrCodeScannerInstance = null;
    }
    
    // ✅ إزالة النافذة بشكل كامل مع التأكد من إزالة جميع overlays
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
        // إخفاء modal أولاً
        modal.style.display = 'none';
        // إزالة modal من DOM
        modal.remove();
    }
    
    // ✅ التأكد من إزالة أي modal آخر قد يكون عالقاً
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(m => {
        if (m.id === 'barcodeScannerModal' || m.classList.contains('barcode-scanner-modal')) {
            m.style.display = 'none';
            m.remove();
        }
    });
    
    // ✅ تنظيف المتغيرات المؤقتة
    if (window.scannedRepairNumber) {
        delete window.scannedRepairNumber;
    }
    
    // ✅ إعادة تفعيل التفاعل مع الصفحة
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
}

// ✅ دالة إعادة المحاولة
function retryBarcodeScanner() {
    console.log('إعادة محاولة تشغيل قارئ QR Code');
    
    // التحقق من أن الماسح مفتوح
    if (!isScannerOpen) {
        console.log('الماسح غير مفتوح، لا يمكن إعادة المحاولة');
        return;
    }
    
    // إخفاء رسائل النتائج والخطأ
    const resultDiv = document.getElementById('scanner-result');
    const errorDiv = document.getElementById('scanner-error');
    if (resultDiv) resultDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    // إيقاف الماسح الحالي فقط بدون إغلاق النافذة
    try {
        if (qrCodeScannerInstance) {
            qrCodeScannerInstance.stop().then(() => {
                qrCodeScannerInstance.clear();
                qrCodeScannerInstance = null;
                // إعادة تشغيل الماسح بعد تأخير قصير
                setTimeout(() => {
                    initializeQRCodeScanner();
                }, 500);
            }).catch((e) => {
                console.log('خطأ في إيقاف قارئ QR Code:', e);
                qrCodeScannerInstance = null;
                // إعادة المحاولة على أي حال
                setTimeout(() => {
                    initializeQRCodeScanner();
                }, 500);
            });
        } else {
            // إذا لم يكن هناك مثيل، ابدأ مباشرة
            setTimeout(() => {
                initializeQRCodeScanner();
            }, 500);
        }
    } catch (e) {
        console.log('خطأ في إعادة المحاولة:', e);
        qrCodeScannerInstance = null;
        setTimeout(() => {
            initializeQRCodeScanner();
        }, 500);
    }
}

function searchRepairByNumber() {
    const repairNumber = window.scannedRepairNumber;
    if (!repairNumber) return;
    
    // البحث في جدول العمليات
    const repair = allRepairs.find(r => r.repair_number === repairNumber);
    
    if (repair) {
        // ✅ إغلاق قارئ QR Code أولاً لتجنب مشاكل overlay
        closeBarcodeScanner();
        
        // ✅ التبديل إلى القسم المناسب للعملية (سوفت/هارد/فاست)
        if (repair.repair_type) {
            switchRepairType(repair.repair_type);
        }
        
        // ✅ الانتقال إلى الصفحة التي تحتوي على العملية
        navigateToRepairPage(repair).then(() => {
            // ✅ انتظار لضمان تحميل الجدول بعد التبديل وإعادة الرسم
            setTimeout(() => {
                // تمييز العملية في الجدول باللون الأصفر
                highlightRepairInTable(repair.id);
                showMessage(`تم العثور على العملية: ${repair.customer_name}`, 'success');
            }, 800);
        });
    } else {
        showMessage('لم يتم العثور على العملية بهذا الرقم', 'error');
    }
}

// ✅ دالة جديدة للانتقال إلى الصفحة التي تحتوي على العملية
async function navigateToRepairPage(repair) {
    try {
        // الحصول على العمليات المفلترة الحالية (حسب نوع العملية والفلترات)
        let filteredRepairs = allRepairs;
        
        // تطبيق فلتر نوع العملية
        if (repair.repair_type) {
            filteredRepairs = filteredRepairs.filter(r => r.repair_type === repair.repair_type);
        }
        
        // تطبيق الفلترات الأخرى إن وجدت
        const statusFilter = document.getElementById('statusFilter');
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        const searchInput = document.getElementById('repairSearch');
        
        if (statusFilter && statusFilter.value) {
            filteredRepairs = filteredRepairs.filter(r => r.status === statusFilter.value);
        }
        
        if (dateFromFilter && dateFromFilter.value) {
            filteredRepairs = filteredRepairs.filter(r => {
                const repairDate = new Date(r.created_at);
                return repairDate >= new Date(dateFromFilter.value);
            });
        }
        
        if (dateToFilter && dateToFilter.value) {
            filteredRepairs = filteredRepairs.filter(r => {
                const repairDate = new Date(r.created_at);
                return repairDate <= new Date(dateToFilter.value + 'T23:59:59');
            });
        }
        
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.trim().toLowerCase();
            filteredRepairs = filteredRepairs.filter(r => {
                return (r.repair_number && r.repair_number.toLowerCase().includes(searchTerm)) ||
                       (r.customer_name && r.customer_name.toLowerCase().includes(searchTerm)) ||
                       (r.customer_phone && r.customer_phone.includes(searchTerm)) ||
                       (r.device_type && r.device_type.toLowerCase().includes(searchTerm));
            });
        }
        
        // البحث عن فهرس العملية في القائمة المفلترة
        const repairIndex = filteredRepairs.findIndex(r => r.id === repair.id);
        
        if (repairIndex !== -1) {
            // حساب الصفحة التي تحتوي على العملية
            const pageNumber = Math.floor(repairIndex / repairsPerPage) + 1;
            
            // الانتقال إلى الصفحة
            if (pageNumber !== currentRepairPage) {
                currentRepairPage = pageNumber;
                console.log(`✅ [QR Scanner] الانتقال إلى الصفحة ${pageNumber} للعثور على العملية`);
                
                // إعادة تطبيق الفلترات لعرض الصفحة الصحيحة
                filterRepairs();
                
                // انتظار قصير لضمان تحديث الجدول
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } else {
            console.warn('⚠️ [QR Scanner] العملية غير موجودة في القائمة المفلترة');
        }
    } catch (error) {
        console.error('❌ [QR Scanner] خطأ في الانتقال إلى صفحة العملية:', error);
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

// ✅ دوال إدارة نموذج تسجيل الخسارة
let lossQRScannerInstance = null;
let lossRepairData = null;

// فتح نموذج تسجيل الخسارة
function showLossOperationModal() {
    const modal = document.getElementById('lossOperationModal');
    if (!modal) {
        showMessage('النموذج غير موجود. يرجى إعادة تحميل الصفحة.', 'error');
        return;
    }
    
    // إعادة تعيين النموذج
    document.getElementById('lossOperationForm').reset();
    document.getElementById('lossRepairInfo').style.display = 'none';
    document.getElementById('lossRepairValidation').textContent = '';
    document.getElementById('lossRepairValidation').style.color = 'var(--text-light)';
    lossRepairData = null;
    
    modal.style.display = 'flex';
}

// إغلاق نموذج تسجيل الخسارة
function closeLossOperationModal() {
    const modal = document.getElementById('lossOperationModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // إيقاف QR scanner إن كان مفتوحاً
    if (lossQRScannerInstance) {
        try {
            lossQRScannerInstance.stop().then(() => {
                lossQRScannerInstance = null;
            }).catch(() => {
                lossQRScannerInstance = null;
            });
        } catch (error) {
            lossQRScannerInstance = null;
        }
    }
}

// التحقق من رقم العملية
async function validateLossRepairNumber(repairNumber) {
    if (!repairNumber || !repairNumber.trim()) {
        return null;
    }
    
    try {
        const result = await API.request(`repairs.php?repair_number=${encodeURIComponent(repairNumber.trim())}`, 'GET');
        
        if (result && result.success && result.data) {
            return result.data;
        }
        
        return null;
    } catch (error) {
        console.error('خطأ في التحقق من رقم العملية:', error);
        return null;
    }
}

// معالج تغيير رقم العملية
async function onLossRepairNumberChange() {
    const repairNumberInput = document.getElementById('lossRepairNumber');
    const validationMsg = document.getElementById('lossRepairValidation');
    const repairInfo = document.getElementById('lossRepairInfo');
    
    if (!repairNumberInput || !validationMsg) {
        return;
    }
    
    const repairNumber = repairNumberInput.value.trim();
    
    if (!repairNumber) {
        validationMsg.textContent = '';
        repairInfo.style.display = 'none';
        lossRepairData = null;
        return;
    }
    
    validationMsg.textContent = 'جاري التحقق...';
    validationMsg.style.color = 'var(--text-light)';
    
    const repair = await validateLossRepairNumber(repairNumber);
    
    if (repair) {
        lossRepairData = repair;
        validationMsg.textContent = '✓ تم العثور على العملية';
        validationMsg.style.color = 'var(--success-color)';
        
        // عرض معلومات العملية
        document.getElementById('lossCustomerName').textContent = repair.customer_name || '-';
        document.getElementById('lossDeviceType').textContent = repair.device_type || '-';
        document.getElementById('lossProblem').textContent = (repair.problem || '-').substring(0, 50) + (repair.problem && repair.problem.length > 50 ? '...' : '');
        document.getElementById('lossBranchName').textContent = repair.branch_name || '-';
        repairInfo.style.display = 'block';
    } else {
        lossRepairData = null;
        validationMsg.textContent = '✗ العملية غير موجودة';
        validationMsg.style.color = 'var(--danger-color)';
        repairInfo.style.display = 'none';
    }
}

// فتح QR Scanner لتسجيل الخسارة
async function openLossBarcodeScanner() {
    // التحقق من وجود ماسح مفتوح بالفعل
    if (lossQRScannerInstance) {
        showMessage('قارئ QR Code مفتوح بالفعل', 'info');
        return;
    }
    
    // التحقق من توفر الكاميرا
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('الكاميرا غير متوفرة في هذا المتصفح', 'error');
        return;
    }
    
    // تحميل Html5Qrcode
    if (typeof Html5Qrcode === 'undefined') {
        if (typeof window.loadHtml5Qrcode === 'function') {
            try {
                await window.loadHtml5Qrcode();
            } catch (error) {
                console.error('Error loading html5-qrcode:', error);
                showMessage('فشل تحميل مكتبة قراءة QR Code', 'error');
                return;
            }
        } else {
            showMessage('مكتبة قراءة QR Code غير متاحة', 'error');
            return;
        }
    }
    
    // إنشاء modal للـ scanner
    const scannerModal = document.createElement('div');
    scannerModal.id = 'lossBarcodeScannerModal';
    scannerModal.className = 'modal';
    scannerModal.style.display = 'flex';
    scannerModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 20000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);';
    scannerModal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-width: 600px; width: 100%; max-height: 90vh; background: var(--white); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: modalSlideIn 0.3s ease; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: var(--white); padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: none; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 1.5em; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                    <i class="bi bi-qr-code-scan" style="font-size: 1.3em;"></i> مسح QR Code من فاتورة الصيانة
                </h2>
                <button onclick="closeLossBarcodeScanner()" class="btn-close" style="background: rgba(255,255,255,0.2); border: none; color: var(--white); font-size: 2em; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; line-height: 1;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='rotate(0deg)';">&times;</button>
            </div>
            <div class="modal-body" style="padding: 30px; text-align: center; overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; -webkit-overflow-scrolling: touch;">
                <div id="loss-barcode-scanner-container">
                    <div id="loss-scanner-area" style="width: 100%; min-height: 400px; border-radius: 15px; overflow: hidden; background: var(--light-bg); position: relative; box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);">
                        <div id="loss-scanner-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; text-align: center; color: var(--text-dark);">
                            <i class="bi bi-camera" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block; animation: pulse 2s infinite;"></i>
                            <p style="font-size: 1.1em; font-weight: 600; color: var(--text-dark);">جاري تحميل قارئ QR Code...</p>
                            <p style="font-size: 0.9em; color: var(--text-light); margin-top: 10px;">يرجى السماح بالوصول إلى الكاميرا</p>
                        </div>
                        <div id="loss-scanner-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
                            <!-- مربع المسح الرئيسي -->
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 250px; height: 250px; border: 4px solid var(--primary-color); border-radius: 20px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 40px rgba(33, 150, 243, 0.6), inset 0 0 20px rgba(33, 150, 243, 0.2); background: rgba(255,255,255,0.05);"></div>
                            
                            <!-- زوايا المربع -->
                            <div style="position: absolute; top: calc(50% - 125px); left: calc(50% - 125px); width: 250px; height: 250px;">
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
                            <div style="position: absolute; top: calc(50% + 140px); left: 50%; transform: translateX(-50%); text-align: center; color: var(--white); background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px; font-size: 0.85em; font-weight: 600; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                                <i class="bi bi-arrows-move" style="margin-left: 5px; font-size: 1.1em;"></i>
                                ضع QR Code داخل الإطار
                            </div>
                            
                            <!-- خطوط إرشادية داخل المربع -->
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 250px; height: 250px; opacity: 0.3;">
                                <!-- خط أفقي في المنتصف -->
                                <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--primary-color), transparent);"></div>
                                <!-- خط عمودي في المنتصف -->
                                <div style="position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent);"></div>
                            </div>
                        </div>
                    </div>
                    <div id="loss-scanner-error" style="margin-top: 25px; display: none; animation: slideDown 0.4s ease;">
                        <div style="padding: 25px; border-radius: 15px; background: linear-gradient(135deg, var(--danger-color) 0%, #e57373 100%); color: var(--white); border: none; box-shadow: 0 8px 25px rgba(244, 67, 54, 0.4);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                                <i class="bi bi-exclamation-triangle-fill" style="font-size: 2em;"></i>
                                <h4 style="margin: 0; font-size: 1.3em; font-weight: 700;">خطأ في المسح</h4>
                            </div>
                            <p id="loss-scanner-error-message" style="margin: 0; line-height: 1.8; opacity: 0.95;"></p>
                            <button onclick="retryLossBarcodeScanner()" class="btn btn-secondary" style="background: var(--white); color: var(--danger-color); border: 2px solid var(--white); padding: 12px 24px; font-weight: 600; border-radius: 10px; margin-top: 15px; width: 100%; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255,255,255,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">إعادة المحاولة</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 30px; border-top: 1px solid var(--border-color); background: var(--light-bg); flex-shrink: 0;">
                <button onclick="closeLossBarcodeScanner()" class="btn btn-secondary" style="background: var(--text-light); color: var(--white); border: none; padding: 12px 24px; font-weight: 600; border-radius: 10px; transition: all 0.3s ease;" onmouseover="this.style.background='#555'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 102, 102, 0.4)';" onmouseout="this.style.background='var(--text-light)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">إغلاق</button>
            </div>
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
            
            #loss-scanner-area video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 15px;
            }
            
            #loss-scanner-area canvas {
                display: none;
            }
            
            /* Scrollbar styling for modal body */
            #lossBarcodeScannerModal .modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            #lossBarcodeScannerModal .modal-body::-webkit-scrollbar-track {
                background: var(--light-bg);
                border-radius: 4px;
            }
            
            #lossBarcodeScannerModal .modal-body::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            
            #lossBarcodeScannerModal .modal-body::-webkit-scrollbar-thumb:hover {
                background: var(--text-light);
            }
            
            /* Firefox scrollbar */
            #lossBarcodeScannerModal .modal-body {
                scrollbar-width: thin;
                scrollbar-color: var(--border-color) var(--light-bg);
            }
            
            @media (max-width: 768px) {
                #lossBarcodeScannerModal .modal-content {
                    max-width: 95% !important;
                    max-height: 95vh !important;
                    margin: 10px;
                }
                
                #lossBarcodeScannerModal .modal-body {
                    padding: 20px !important;
                }
                
                #lossBarcodeScannerModal .modal-header {
                    padding: 20px !important;
                }
                
                #lossBarcodeScannerModal .modal-header h2 {
                    font-size: 1.2em !important;
                }
                
                #lossBarcodeScannerModal .modal-footer {
                    padding: 15px 20px !important;
                    flex-wrap: wrap;
                }
                
                #loss-scanner-area {
                    min-height: 300px !important;
                }
                
                #loss-scanner-overlay > div:first-child {
                    width: 200px !important;
                    height: 200px !important;
                }
                
                #loss-scanner-overlay > div:nth-child(2) {
                    width: 200px !important;
                    height: 200px !important;
                    top: calc(50% - 100px) !important;
                    left: calc(50% - 100px) !important;
                }
            }
        </style>
    `;
    
    document.body.appendChild(scannerModal);
    
    // تهيئة الـ scanner
    setTimeout(() => {
        initializeLossQRCodeScanner();
    }, 100);
}

// إغلاق QR Scanner للخسارة
function closeLossBarcodeScanner() {
    // إيقاف جميع تدفقات الكاميرا أولاً
    try {
        // إيقاف stream المحفوظ
        if (window.lossScannerStream) {
            window.lossScannerStream.getTracks().forEach(track => {
                track.stop();
                console.log('✅ [Loss Scanner] تم إيقاف track:', track.kind);
            });
            window.lossScannerStream = null;
        }
        
        // إيقاف stream من video element
        const scannerArea = document.getElementById('loss-scanner-area');
        if (scannerArea) {
            const videoElement = scannerArea.querySelector('video');
            if (videoElement && videoElement.srcObject) {
                videoElement.srcObject.getTracks().forEach(track => {
                    track.stop();
                    console.log('✅ [Loss Scanner] تم إيقاف track من video element:', track.kind);
                });
                videoElement.srcObject = null;
            }
        }
    } catch (error) {
        console.log('⚠️ [Loss Scanner] خطأ في إيقاف streams:', error);
    }
    
    // إيقاف QR Scanner instance
    if (lossQRScannerInstance) {
        try {
            lossQRScannerInstance.stop().then(() => {
                console.log('✅ [Loss Scanner] تم إيقاف QR Scanner بنجاح');
                try {
                    if (lossQRScannerInstance.clear) {
                        lossQRScannerInstance.clear();
                    }
                } catch (clearErr) {
                    console.log('⚠️ [Loss Scanner] خطأ في clear:', clearErr);
                }
                lossQRScannerInstance = null;
            }).catch((err) => {
                console.log('⚠️ [Loss Scanner] تم إيقاف QR Scanner بالفعل أو خطأ في الإيقاف:', err);
                try {
                    if (lossQRScannerInstance.clear) {
                        lossQRScannerInstance.clear();
                    }
                } catch (clearErr) {
                    console.log('⚠️ [Loss Scanner] خطأ في clear:', clearErr);
                }
                lossQRScannerInstance = null;
            });
        } catch (error) {
            console.error('❌ [Loss Scanner] خطأ في إيقاف QR Scanner:', error);
            lossQRScannerInstance = null;
        }
    }
    
    // إزالة النموذج
    const modal = document.getElementById('lossBarcodeScannerModal');
    if (modal) {
        modal.remove();
    }
}

// إعادة المحاولة للـ scanner
function retryLossBarcodeScanner() {
    closeLossBarcodeScanner();
    setTimeout(() => {
        openLossBarcodeScanner();
    }, 500);
}

// تهيئة QR Code Scanner للخسارة
async function initializeLossQRCodeScanner() {
    const scannerArea = document.getElementById('loss-scanner-area');
    const loadingDiv = document.getElementById('loss-scanner-loading');
    
    if (!scannerArea) {
        console.error('loss-scanner-area element not found');
        return;
    }
    
    try {
        lossQRScannerInstance = new Html5Qrcode("loss-scanner-area");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };
        
        if (typeof Html5QrcodeScanType !== 'undefined') {
            config.supportedScanTypes = [Html5QrcodeScanType.SCAN_TYPE_CAMERA];
        }
        
        // بدء المسح
        await lossQRScannerInstance.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                handleLossQRCodeScanned(decodedText);
            },
            (errorMessage) => {
                // تجاهل الأخطاء المستمرة أثناء المسح (طبيعي)
            }
        );
        
        // إخفاء رسالة التحميل بعد نجاح بدء المسح
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        console.log('✅ [Loss Scanner] تم بدء قارئ QR Code بنجاح');
        
        // حفظ مرجع stream لإيقافه لاحقاً
        try {
            const videoElement = scannerArea.querySelector('video');
            if (videoElement && videoElement.srcObject) {
                window.lossScannerStream = videoElement.srcObject;
            }
        } catch (err) {
            console.log('⚠️ [Loss Scanner] لا يمكن حفظ مرجع stream:', err);
        }
        
    } catch (error) {
        console.error('❌ [Loss Scanner] خطأ في بدء قارئ QR Code:', error);
        
        // إخفاء loading وإظهار رسالة الخطأ
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        const errorDiv = document.getElementById('loss-scanner-error');
        const errorMessage = document.getElementById('loss-scanner-error-message');
        if (errorDiv && errorMessage) {
            errorMessage.textContent = 'فشل في فتح الكاميرا: ' + (error.message || error);
            errorDiv.style.display = 'block';
        }
    }
}

// معالج قراءة QR Code للخسارة
async function handleLossQRCodeScanned(decodedText) {
    console.log('تم قراءة QR Code:', decodedText);
    
    // إيقاف الماسح
    if (lossQRScannerInstance) {
        try {
            await lossQRScannerInstance.stop();
            lossQRScannerInstance = null;
        } catch (error) {
            console.error('خطأ في إيقاف الماسح:', error);
        }
    }
    
    // إغلاق modal الـ scanner
    closeLossBarcodeScanner();
    
    // استخراج رقم العملية
    const repairNumber = extractRepairNumberFromTrackingLink(decodedText);
    
    if (!repairNumber) {
        showMessage('QR Code غير صحيح. يرجى التأكد من أنه QR Code من فاتورة الصيانة.', 'error');
        return;
    }
    
    // تعيين رقم العملية في النموذج
    const repairNumberInput = document.getElementById('lossRepairNumber');
    if (repairNumberInput) {
        repairNumberInput.value = repairNumber;
        // التحقق من العملية
        await onLossRepairNumberChange();
    }
}

// حفظ عملية الخسارة
async function saveLossOperation(event) {
    event.preventDefault();
    
    const repairNumber = document.getElementById('lossRepairNumber').value.trim();
    const lossAmount = parseFloat(document.getElementById('lossAmount').value);
    const lossReason = document.getElementById('lossReason').value.trim();
    
    // التحقق من البيانات
    if (!repairNumber) {
        showMessage('يرجى إدخال رقم عملية الصيانة', 'error');
        return;
    }
    
    if (!lossRepairData) {
        showMessage('يرجى التحقق من رقم العملية أولاً', 'error');
        return;
    }
    
    if (!lossAmount || lossAmount <= 0) {
        showMessage('يرجى إدخال مبلغ خسارة صحيح', 'error');
        return;
    }
    
    if (!lossReason) {
        showMessage('يرجى إدخال سبب الخسارة', 'error');
        return;
    }
    
    try {
        // إظهار loading overlay
        if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
            window.loadingOverlay.show();
        }
        
        // إعداد بيانات الخسارة
        const lossData = {
            repair_number: repairNumber,
            customer_name: lossRepairData.customer_name || 'غير معروف',
            device_type: lossRepairData.device_type || 'غير معروف',
            problem: lossRepairData.problem || 'غير محدد',
            loss_amount: lossAmount,
            loss_reason: lossReason
        };
        
        // إرسال الطلب
        const result = await API.addLossOperation(lossData);
        
        if (result && result.success) {
            showMessage('تم تسجيل العملية الخاسرة بنجاح', 'success');
            closeLossOperationModal();
            
            // تحديث بيانات الخزنة إذا كانت متاحة
            if (typeof loadTreasuryData === 'function' && lossRepairData.branch_id) {
                try {
                    await loadTreasuryData(lossRepairData.branch_id, true);
                } catch (error) {
                    console.error('خطأ في تحديث بيانات الخزنة:', error);
                }
            }
            
            // إعادة تحميل العمليات الخاسرة في صفحة المصروفات
            if (typeof loadExpensesSection === 'function') {
                try {
                    await loadExpensesSection();
                } catch (error) {
                    console.error('خطأ في تحديث صفحة المصروفات:', error);
                }
            }
        } else {
            showMessage(result?.message || 'فشل في تسجيل العملية الخاسرة', 'error');
        }
        
    } catch (error) {
        console.error('خطأ في تسجيل العملية الخاسرة:', error);
        showMessage('حدث خطأ أثناء تسجيل العملية الخاسرة', 'error');
    } finally {
        // إخفاء loading overlay
        if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
            window.loadingOverlay.hide();
        }
    }
}

// ✅ تصدير الدوال إلى window لجعلها متاحة عالمياً
window.onRepairBranchChange = onRepairBranchChange;
window.onCustomerTypeChange = onCustomerTypeChange;
window.onCustomerSourceChange = onCustomerSourceChange;
window.onCustomerSelectChange = onCustomerSelectChange;
window.addInvoiceField = addInvoiceField;
window.removeInvoiceField = removeInvoiceField;
window.handleDeviceTypeChange = handleDeviceTypeChange;
window.printRepairReceipt = printRepairReceipt;
window.printDeliveredRepairInvoice = printDeliveredRepairInvoice;
window.showLossOperationModal = showLossOperationModal;
window.closeLossOperationModal = closeLossOperationModal;
window.openLossBarcodeScanner = openLossBarcodeScanner;
window.closeLossBarcodeScanner = closeLossBarcodeScanner;
window.retryLossBarcodeScanner = retryLossBarcodeScanner;
window.saveLossOperation = saveLossOperation;
window.copyRepairNumber = copyRepairNumber;


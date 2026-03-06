// إدارة العملاء

let allCustomers = [];
let retailCustomers = [];
let commercialCustomers = [];
let currentCustomerPage = 1;
// حفظ نوع العميل من localStorage أو استخدام القيمة الافتراضية
let currentCustomerType = localStorage.getItem('currentCustomerType') || 'retail';
const customersPerPage = 10;
let customerBranches = [];
let firstBranchId = null;
// ✅ حفظ الفرع المحدد للفلترة
let selectedBranchId = null;

// ✅ تحسين الأداء: Flags لمنع التحميل المكرر
let isLoadingCustomerBranches = false;
let lastCustomerBranchesLoadTime = 0;
const CUSTOMER_MIN_LOAD_INTERVAL = 2000; // 2 ثانية كحد أدنى بين الطلبات

async function loadCustomersSection() {
    // ✅ إظهار loading overlay قبل بدء التحميل
    if (typeof showLoading === 'function') {
        showLoading();
    } else if (window.loadingOverlay && typeof window.loadingOverlay.show === 'function') {
        window.loadingOverlay.show();
    }
    
    const section = document.getElementById('customers-section');
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // ✅ التحقق من أن الموظف مرتبط بالفرع الثاني
    const isEmployee = currentUser && currentUser.role === 'employee';
    let branchCode = currentUser?.branch_code || localStorage.getItem('branch_code') || '';
    if (!branchCode && currentUser?.branch_id) {
        try {
            const branchesCache = localStorage.getItem('branches_cache');
            if (branchesCache) {
                const branches = JSON.parse(branchesCache);
                const branch = branches.find(b => b.id === currentUser.branch_id);
                if (branch && branch.code) {
                    branchCode = branch.code;
                }
            }
        } catch (e) {
            // تجاهل الأخطاء
        }
    }
    const isSecondBranchEmployee = isEmployee && String(branchCode).trim() === 'BITASH';
    
    section.innerHTML = `
        <div class="section-header">
            <div class="header-actions" style="display: flex; gap: 10px; align-items: center;">
                <select id="customerBranchFilterHeader" onchange="applyBranchFilter()" class="filter-select" required style="${isOwner ? 'display: block;' : 'display: none;'} min-width: 180px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--white); color: var(--text-dark); font-size: 0.95em; cursor: pointer; position: relative; z-index: 10;">
                    <option value="">اختر الفرع</option>
                </select>
                <button id="exportCustomersBtn" onclick="exportCustomersToCSV()" class="btn btn-success btn-sm" data-permission="admin" style="${isOwner ? '' : 'display: none;'}">
                    <i class="bi bi-file-earmark-spreadsheet"></i> تصدير CSV
                </button>
                <button onclick="showAddCustomerModal()" class="btn btn-primary" id="addCustomerBtn" style="${(isOwner || isSecondBranchEmployee) ? '' : 'display: none;'}">
                    <i class="bi bi-person-plus"></i> إضافة عميل جديد
                </button>
            </div>
        </div>

        <!-- إحصائيات العملاء التجاري -->
        <div id="commercialDebtStats" class="stats-container" style="display: none; margin: 0 auto 15px auto; padding: 12px 16px; background: var(--white); border-radius: 8px; box-shadow: var(--shadow); border: 1px solid var(--border-color); max-width: 400px; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;">
                <i class="bi bi-cash-coin" style="font-size: 1.5em; color: var(--warning-color);"></i>
                <div style="width: 100%;">
                    <div style="font-size: 0.85em; color: var(--text-light); margin-bottom: 6px;">إجمالي ديون العملاء التجاري</div>
                    <div id="totalCommercialDebt" style="font-size: 1.3em; font-weight: bold; color: var(--warning-color);">0.00 ج.م</div>
                </div>
            </div>
        </div>

        <!-- Customer Type Tabs -->
        <div class="customer-type-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 10px;">
            <button onclick="switchCustomerType('retail')" id="tab-retail" class="customer-type-tab active" style="flex: 1; padding: 12px 20px; background: var(--primary-color); color: var(--white); border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.3s;">
                <i class="bi bi-person"></i> زبائن
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
                        <th id="commercialDebtHeader" style="display: none; text-align: right;">الديون</th>
                        <th>رقم الهاتف</th>
                        <th>العنوان</th>
                        <th>التقييم</th>
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
                            <option value="retail">زبون</option>
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

                    <div class="form-group" id="customerBranchGroup" style="display: none;">
                        <label for="customerBranchSelect">الفرع *</label>
                        <select id="customerBranchSelect" required>
                            <option value="">اختر الفرع</option>
                        </select>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeCustomerModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal للهاتف -->
        <div id="phoneActionModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>إجراءات الهاتف</h3>
                    <button onclick="closePhoneActionModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <i class="bi bi-telephone-fill" style="font-size: 3em; color: var(--primary-color); margin-bottom: 15px; display: block;"></i>
                        <p style="font-size: 1.1em; color: var(--text-dark); font-weight: 600; margin-bottom: 5px;">رقم الهاتف</p>
                        <p id="phoneActionModalNumber" style="font-size: 1.3em; color: var(--primary-color); font-weight: bold; direction: ltr; text-align: center;"></p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="copyPhoneNumber()" class="btn-phone-action">
                            <i class="bi bi-copy"></i>
                            <span>نسخ الرقم</span>
                        </button>
                        <button onclick="callPhoneNumber()" class="btn-phone-action">
                            <i class="bi bi-telephone"></i>
                            <span>الاتصال بالرقم</span>
                        </button>
                        <button onclick="whatsappPhoneNumber()" class="btn-phone-action">
                            <i class="bi bi-whatsapp"></i>
                            <span>التواصل عبر واتساب</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // تحميل الفروع أولاً (للمالك فقط)
    console.log('🔍 [Customers] Current User:', currentUser);
    console.log('🔍 [Customers] Is Owner:', isOwner);
    
    // ✅ تحسين: تحميل الفروع والعملاء بشكل متوازي قدر الإمكان
    if (isOwner) {
        // ✅ تحسين: استخدام Promise مباشرة بدلاً من requestAnimationFrame + setTimeout
        (async () => {
            try {
                // ✅ تحسين: استخدام cache إذا كانت الفروع محملة بالفعل
                // فقط نحمّل إذا لم تكن موجودة أو كانت قديمة
                if (!customerBranches || customerBranches.length === 0) {
                    await loadCustomerBranches(false); // ✅ استخدام cache بدلاً من force = true
                } else {
                    // ✅ استخدام الفروع المحملة مسبقاً
                    updateCustomerBranchFilters();
                }
                
                // ✅ تحسين: تحديد فرع افتراضي فوراً (بدون setTimeout)
                const branchFilterHeader = document.getElementById('customerBranchFilterHeader');
                if (branchFilterHeader) {
                    if (selectedBranchId) {
                        branchFilterHeader.value = selectedBranchId;
                    } else if (firstBranchId) {
                        branchFilterHeader.value = firstBranchId;
                        selectedBranchId = firstBranchId;
                        console.log('✅ [Customers] تم تحديد الفرع الأول كافتراضي:', firstBranchId);
                    }
                }
                
                // ✅ تحسين: التأكد من أن branchId محدد قبل تحميل العملاء
                if (!selectedBranchId && firstBranchId) {
                    selectedBranchId = firstBranchId;
                    if (branchFilterHeader) {
                        branchFilterHeader.value = firstBranchId;
                    }
                }
                
                // ✅ تحسين: تحميل العملاء مباشرة (بدون setTimeout)
                if (selectedBranchId || firstBranchId) {
                    await loadCustomers();
                } else {
                    console.error('❌ [Customers] لا يمكن تحميل العملاء - لا يوجد فرع محدد');
                    showMessage('حدث خطأ في تحميل الفروع. يرجى تحديث الصفحة.', 'error');
                }
                
                // ✅ تحسين: تطبيق نوع العميل مباشرة (بدون setTimeout)
                switchCustomerType(currentCustomerType);
                
                // ✅ إخفاء loading overlay بعد اكتمال تحميل جميع البيانات
                if (typeof hideLoading === 'function') {
                    hideLoading();
                } else if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            } catch (error) {
                console.error('❌ [Customers] خطأ في تحميل الفروع:', error);
                showMessage('حدث خطأ في تحميل الفروع. يرجى تحديث الصفحة.', 'error');
                retailCustomers = [];
                commercialCustomers = [];
                allCustomers = [];
                switchCustomerType(currentCustomerType);
                
                if (typeof hideLoading === 'function') {
                    hideLoading();
                } else if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            }
        })();
    } else {
        // ✅ تحسين: مسح selectedBranchId للموظفين
        selectedBranchId = null;
        (async () => {
            try {
                await loadCustomers();
                // ✅ تحسين: تطبيق نوع العميل مباشرة (بدون setTimeout)
                switchCustomerType(currentCustomerType);
                
                if (typeof hideLoading === 'function') {
                    hideLoading();
                } else if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            } catch (error) {
                console.error('❌ [Customers] خطأ في تحميل العملاء:', error);
                if (typeof hideLoading === 'function') {
                    hideLoading();
                } else if (window.loadingOverlay && typeof window.loadingOverlay.hide === 'function') {
                    window.loadingOverlay.hide();
                }
            }
        })();
    }
    
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
    
    // ✅ إخفاء زر التصدير (يظهر فقط للمالك)
    if (typeof hideByPermission === 'function') {
        hideByPermission();
    } else {
        // التحقق المباشر من نوع المستخدم
        try {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                const exportBtn = document.getElementById('exportCustomersBtn');
                if (exportBtn && user.role !== 'admin') {
                    exportBtn.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('خطأ في التحقق من صلاحيات المستخدم:', error);
        }
    }
    
}

async function loadCustomers() {
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    const isEmployee = currentUser && currentUser.role === 'employee';
    
    // ✅ تحسين: استخدام selectedBranchId المحفوظ أو قراءته من DOM
    let branchId = selectedBranchId;
    
    // ✅ للموظف من الفرع الثاني: استخدام branch_id الخاص به
    if (isEmployee && !isOwner) {
        if (currentUser.branch_id) {
            branchId = currentUser.branch_id;
            selectedBranchId = branchId;
        } else {
            console.warn('⚠️ [Customers] الموظف غير مرتبط بفرع - لا يمكن عرض العملاء');
            retailCustomers = [];
            commercialCustomers = [];
            allCustomers = [];
            switchCustomerType(currentCustomerType);
            return;
        }
    } else if (isOwner) {
        const branchFilterHeader = document.getElementById('customerBranchFilterHeader');
        if (branchFilterHeader) {
            // إذا كان هناك قيمة في DOM، نستخدمها ونحدث selectedBranchId
            if (branchFilterHeader.value) {
                branchId = branchFilterHeader.value;
                selectedBranchId = branchId;
            } else if (selectedBranchId) {
                // إذا لم تكن هناك قيمة في DOM لكن selectedBranchId موجود، نعيد تطبيقها
                branchFilterHeader.value = selectedBranchId;
                branchId = selectedBranchId;
            } else if (firstBranchId) {
                // ✅ إذا لم يكن هناك فرع محدد، نستخدم الفرع الأول كافتراضي
                branchId = firstBranchId;
                selectedBranchId = branchId;
                branchFilterHeader.value = branchId;
            } else {
                // ✅ إذا لم يكن هناك فروع، لا نعرض عملاء
                console.warn('⚠️ [Customers] لا توجد فروع متاحة - لا يمكن عرض العملاء');
                retailCustomers = [];
                commercialCustomers = [];
                allCustomers = [];
                switchCustomerType(currentCustomerType);
                return;
            }
        } else if (firstBranchId) {
            // ✅ إذا لم يكن العنصر موجوداً لكن firstBranchId موجود، نستخدمه
            branchId = firstBranchId;
            selectedBranchId = branchId;
        } else {
            console.warn('⚠️ [Customers] لا توجد فروع متاحة - لا يمكن عرض العملاء');
            retailCustomers = [];
            commercialCustomers = [];
            allCustomers = [];
            switchCustomerType(currentCustomerType);
            return;
        }
    } else {
        // إذا لم يكن مالك، نمسح selectedBranchId
        selectedBranchId = null;
        branchId = null;
    }
    
    // ✅ تحسين: يجب أن يكون branchId محدداً دائماً للمالك
    if (isOwner && !branchId) {
        console.warn('⚠️ [Customers] يجب تحديد فرع لعرض العملاء');
        retailCustomers = [];
        commercialCustomers = [];
        allCustomers = [];
        switchCustomerType(currentCustomerType);
        return;
    }
    
    // ✅ تحسين: استخدام cache للطلبات (يعمل تلقائياً في API.request)
    // بناء URL مع branch_id (مطلوب فقط للمالك)
    let retailUrl = 'customers.php?type=retail';
    let commercialUrl = 'customers.php?type=commercial';
    
    // ✅ إضافة branch_id فقط للمالك (API يقوم بالفلترة تلقائياً للمستخدمين الآخرين حسب branch_id الخاص بهم)
    if (isOwner && branchId) {
        retailUrl += `&branch_id=${encodeURIComponent(branchId)}`;
        commercialUrl += `&branch_id=${encodeURIComponent(branchId)}`;
        console.log('🔍 [Customers] جلب العملاء للفرع:', branchId);
    } else if (isOwner && !branchId) {
        // ✅ إذا كان مالك ولم يكن branchId محدداً، لا نجلب العملاء
        console.warn('⚠️ [Customers] branchId غير محدد للمالك - لا يمكن جلب العملاء');
        retailCustomers = [];
        commercialCustomers = [];
        allCustomers = [];
        switchCustomerType(currentCustomerType);
        return;
    } else if (isEmployee && branchId) {
        // ✅ للموظف: API سيقوم بالفلترة تلقائياً حسب branch_id الخاص به
        console.log('🔍 [Customers] جلب عملاء الفرع للموظف:', branchId);
    }
    
    // تحميل العملاء بشكل متوازي (سيستخدم cache تلقائياً)
    const [retailResult, commercialResult] = await Promise.all([
        API.request(retailUrl, 'GET'),
        API.request(commercialUrl, 'GET')
    ]);
    
    // ✅ تحسين: فلترة العملاء حسب النوع و branch_id معاً
    let retailData = retailResult.success ? (retailResult.data || []) : [];
    let commercialData = commercialResult.success ? (commercialResult.data || []) : [];
    
    // فلترة حسب النوع أولاً
    retailCustomers = retailData.filter(c => 
        (c.customer_type || 'retail') === 'retail'
    );
    commercialCustomers = commercialData.filter(c => 
        (c.customer_type || 'commercial') === 'commercial'
    );
    
    // ✅ تحسين: فلترة إضافية محلية حسب branch_id (مطلوبة دائماً للمالك)
    if (isOwner && branchId) {
        const branchIdStr = String(branchId);
        console.log('🔍 [Customers] فلترة العملاء حسب branch_id:', branchIdStr);
        console.log('📊 [Customers] قبل الفلترة - retail:', retailCustomers.length, 'commercial:', commercialCustomers.length);
        
        retailCustomers = retailCustomers.filter(c => {
            const customerBranchId = c.branch_id ? String(c.branch_id) : null;
            const matches = customerBranchId === branchIdStr;
            if (!matches && customerBranchId) {
                console.log(`  ⏭️ [Retail] تخطي عميل ${c.id} (branch_id: ${customerBranchId} !== ${branchIdStr})`);
            }
            return matches;
        });
        
        commercialCustomers = commercialCustomers.filter(c => {
            const customerBranchId = c.branch_id ? String(c.branch_id) : null;
            const matches = customerBranchId === branchIdStr;
            if (!matches && customerBranchId) {
                console.log(`  ⏭️ [Commercial] تخطي عميل ${c.id} (branch_id: ${customerBranchId} !== ${branchIdStr})`);
            }
            return matches;
        });
        
        console.log('📊 [Customers] بعد الفلترة - retail:', retailCustomers.length, 'commercial:', commercialCustomers.length);
        
        // ✅ تحسين: التحقق من أن جميع العملاء المعروضين من الفرع الصحيح
        const invalidRetail = retailCustomers.filter(c => String(c.branch_id) !== branchIdStr);
        const invalidCommercial = commercialCustomers.filter(c => String(c.branch_id) !== branchIdStr);
        
        if (invalidRetail.length > 0 || invalidCommercial.length > 0) {
            console.error('❌ [Customers] تحذير: يوجد عملاء من فروع أخرى!', {
                invalidRetail: invalidRetail.length,
                invalidCommercial: invalidCommercial.length
            });
            // إزالة العملاء غير الصحيحة
            retailCustomers = retailCustomers.filter(c => String(c.branch_id) === branchIdStr);
            commercialCustomers = commercialCustomers.filter(c => String(c.branch_id) === branchIdStr);
        }
    }
    
    allCustomers = [...retailCustomers, ...commercialCustomers];
    
    // ✅ تحسين: التحقق النهائي من أن جميع العملاء من الفرع الصحيح
    if (isOwner && branchId) {
        const branchIdStr = String(branchId);
        const invalidCustomers = allCustomers.filter(c => {
            const customerBranchId = c.branch_id ? String(c.branch_id) : null;
            return customerBranchId !== branchIdStr;
        });
        
        if (invalidCustomers.length > 0) {
            console.error('❌ [Customers] تحذير: يوجد عملاء من فروع أخرى بعد التجميع!', {
                invalidCount: invalidCustomers.length,
                expectedBranch: branchIdStr,
                invalidCustomers: invalidCustomers.map(c => ({ id: c.id, name: c.name, branch_id: c.branch_id }))
            });
            // إزالة العملاء غير الصحيحة
            allCustomers = allCustomers.filter(c => {
                const customerBranchId = c.branch_id ? String(c.branch_id) : null;
                return customerBranchId === branchIdStr;
            });
            retailCustomers = retailCustomers.filter(c => String(c.branch_id) === branchIdStr);
            commercialCustomers = commercialCustomers.filter(c => String(c.branch_id) === branchIdStr);
        }
        
        console.log(`✅ [Customers] تم تحميل ${allCustomers.length} عميل من الفرع ${branchIdStr}`);
    }
    
    // ✅ تحسين: إعادة تطبيق قيمة الفرع المحدد على DOM بعد التحميل
    if (isOwner) {
        const branchFilterHeader = document.getElementById('customerBranchFilterHeader');
        if (branchFilterHeader) {
            // ✅ التأكد من أن القيمة المحددة هي branchId الحالي
            if (branchId) {
                branchFilterHeader.value = String(branchId);
                selectedBranchId = String(branchId);
            } else if (selectedBranchId) {
                branchFilterHeader.value = selectedBranchId;
            }
        }
    }
    
    // استخدام switchCustomerType للتأكد من عرض النوع الصحيح فقط
    switchCustomerType(currentCustomerType);
    
    // ✅ تحديث إحصائيات الديون
    updateCommercialDebtStats();
}

// ✅ دالة لتحديث إحصائيات ديون العملاء التجاري
function updateCommercialDebtStats() {
    try {
        const statsContainer = document.getElementById('commercialDebtStats');
        const totalDebtElement = document.getElementById('totalCommercialDebt');
        
        if (!statsContainer || !totalDebtElement) {
            return;
        }
        
        // حساب إجمالي الديون من العملاء التجاريين
        let totalDebt = 0;
        if (commercialCustomers && Array.isArray(commercialCustomers)) {
            totalDebt = commercialCustomers.reduce((sum, customer) => {
                const debt = parseFloat(customer.total_debt || 0);
                return sum + (isNaN(debt) ? 0 : debt);
            }, 0);
        }
        
        // تحديث القيمة
        totalDebtElement.textContent = totalDebt.toFixed(2) + ' ج.م';
        
        // إظهار الإحصائيات إذا كان هناك عملاء تجاريين
        if (commercialCustomers && commercialCustomers.length > 0) {
            statsContainer.style.display = 'block';
        } else {
            statsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ [Customers] خطأ في تحديث إحصائيات الديون:', error);
    }
}

// ✅ تحسين الأداء: تحميل الفروع بنفس طريقة expenses.js
async function loadCustomerBranches(force = false) {
    // ✅ تحسين الأداء: منع التحميل المكرر
    const now = Date.now();
    if (isLoadingCustomerBranches && !force) {
        console.log('⏸️ [Customers] تحميل الفروع قيد التنفيذ بالفعل');
        return;
    }
    if (!force && (now - lastCustomerBranchesLoadTime) < CUSTOMER_MIN_LOAD_INTERVAL) {
        console.log('⏸️ [Customers] تم تحميل الفروع مؤخراً، تخطي الطلب');
        return;
    }
    
    // ✅ تحسين الأداء: استخدام cache إذا كان متاحاً
    if (!force && customerBranches && customerBranches.length > 0) {
        console.log('✅ [Customers] استخدام الفروع من الكاش');
        updateCustomerBranchFilters();
        return;
    }
    
    isLoadingCustomerBranches = true;
    lastCustomerBranchesLoadTime = now;
    
    try {
        console.log('🔄 [Customers] بدء تحميل الفروع...');
        // جلب جميع الفروع النشطة
        const result = await API.request('branches.php', 'GET');
        console.log('📥 [Customers] استجابة API:', result);
        
        if (result && result.success && result.data && Array.isArray(result.data)) {
            customerBranches = result.data;
            console.log(`📊 [Customers] تم جلب ${customerBranches.length} فرع من API`);
            
            // تحديد الفرع الأول (للاستخدام الافتراضي)
            if (customerBranches.length > 0) {
                // ترتيب حسب created_at أو id
                const sortedBranches = [...customerBranches].sort((a, b) => {
                    const dateA = new Date(a.created_at || 0);
                    const dateB = new Date(b.created_at || 0);
                    if (dateA.getTime() !== dateB.getTime()) {
                        return dateA.getTime() - dateB.getTime();
                    }
                    return (a.id || '').localeCompare(b.id || '');
                });
                firstBranchId = sortedBranches[0].id;
                console.log('✅ [Customers] الفرع الأول:', firstBranchId);
            }
            
            const currentUser = getCurrentUser();
            const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
            
            // ملء Branch Filter في section-header - ملء الفروع دائماً (سيتم التحقق من isOwner عند العرض)
            // ✅ تحسين: تقليل retries من 10 إلى 5 وتحسين delay
            let branchFilterHeader = document.getElementById('customerBranchFilterHeader');
            let retries = 0;
            const maxRetries = 5; // ✅ تقليل من 10 إلى 5
            const retryDelay = 50; // ✅ تقليل من 100ms إلى 50ms
            
            // إذا لم يكن العنصر موجوداً، ننتظر قليلاً ثم نحاول مرة أخرى
            while (!branchFilterHeader && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                branchFilterHeader = document.getElementById('customerBranchFilterHeader');
                retries++;
            }
            
            if (branchFilterHeader) {
                console.log('🔍 [Customers] تم العثور على customerBranchFilterHeader في DOM');
                
                // ✅ مسح الخيارات الحالية
                branchFilterHeader.innerHTML = '<option value="">اختر الفرع</option>';
                
                if (customerBranches && customerBranches.length > 0) {
                    // ✅ تحسين: استخدام DocumentFragment لملء القائمة بشكل أسرع
                    const fragment = document.createDocumentFragment();
                    customerBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        fragment.appendChild(option);
                    });
                    branchFilterHeader.appendChild(fragment);
                    console.log(`✅ [Customers] تم تحميل ${customerBranches.length} فرع في customerBranchFilterHeader`);
                    
                    // ✅ تحديد الفرع الأول كقيمة افتراضية
                    if (firstBranchId && !selectedBranchId) {
                        branchFilterHeader.value = firstBranchId;
                        selectedBranchId = firstBranchId;
                        console.log('✅ [Customers] تم تحديد الفرع الأول كقيمة افتراضية:', firstBranchId);
                    } else if (selectedBranchId) {
                        branchFilterHeader.value = selectedBranchId;
                        console.log('✅ [Customers] تم إعادة تطبيق الفرع المحدد:', selectedBranchId);
                    }
                }
                
                // إعادة تطبيق إعدادات العرض حسب نوع المستخدم
                if (isOwner) {
                    branchFilterHeader.style.display = 'block';
                    branchFilterHeader.style.visibility = 'visible';
                    branchFilterHeader.style.opacity = '1';
                } else {
                    branchFilterHeader.style.display = 'none';
                }
            } else {
                console.error(`❌ [Customers] العنصر customerBranchFilterHeader غير موجود في DOM بعد ${maxRetries} محاولة`);
                // ✅ تحسين: تقليل delay في المحاولة الأخيرة
                setTimeout(async () => {
                    const retryElement = document.getElementById('customerBranchFilterHeader');
                    if (retryElement && customerBranches && customerBranches.length > 0) {
                        console.log('🔄 [Customers] محاولة أخيرة لملء customerBranchFilterHeader');
                        retryElement.innerHTML = '<option value="">اختر الفرع</option>';
                        const fragment = document.createDocumentFragment();
                        customerBranches.forEach(branch => {
                            const option = document.createElement('option');
                            option.value = branch.id;
                            option.textContent = branch.name;
                            fragment.appendChild(option);
                        });
                        retryElement.appendChild(fragment);
                        if (isOwner) {
                            retryElement.style.display = 'block';
                        }
                    }
                }, 200); // ✅ تقليل من 500ms إلى 200ms
            }
            
            // ملء Branch Select في نموذج إضافة العميل - ملء الفروع دائماً (سيتم التحقق من isOwner عند فتح النموذج)
            const branchSelect = document.getElementById('customerBranchSelect');
            if (branchSelect && customerBranches && customerBranches.length > 0) {
                // حفظ القيمة الحالية إذا كانت موجودة
                const currentValue = branchSelect.value;
                branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
                
                // ✅ تحسين: استخدام DocumentFragment
                const fragment = document.createDocumentFragment();
                customerBranches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    fragment.appendChild(option);
                });
                branchSelect.appendChild(fragment);
                console.log(`✅ [Customers] تم تحميل ${customerBranches.length} فرع في قائمة customerBranchSelect`);
                
                if (currentValue) {
                    branchSelect.value = currentValue;
                }
            } else if (!branchSelect) {
                // العنصر غير موجود - هذا طبيعي إذا كان النموذج غير مفتوح
                console.log('ℹ️ [Customers] العنصر customerBranchSelect غير موجود في DOM (قد يكون النموذج غير مفتوح)');
            }
        } else {
            console.warn('⚠️ [Customers] لم يتم العثور على فروع أو البيانات غير صحيحة:', result);
            // إظهار رسالة خطأ للمستخدم
            if (result && !result.success) {
                console.error('❌ [Customers] خطأ من API:', result.message || 'خطأ غير معروف');
            } else if (!result) {
                console.error('❌ [Customers] لم يتم الحصول على استجابة من API');
            } else if (!result.data) {
                console.error('❌ [Customers] لا توجد بيانات في الاستجابة');
            } else if (!Array.isArray(result.data)) {
                console.error('❌ [Customers] البيانات ليست مصفوفة:', typeof result.data, result.data);
            }
        }
    } catch (error) {
        console.error('❌ [Customers] خطأ في تحميل الفروع:', error);
        showMessage('حدث خطأ أثناء تحميل الفروع. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        isLoadingCustomerBranches = false;
    }
}

// ✅ تحسين الأداء: دالة مساعدة لتحديث فلاتر الفروع من البيانات المحفوظة
function updateCustomerBranchFilters() {
    try {
        console.log('🔄 [Customers] تحديث فلاتر الفروع من الكاش...');
        const currentUser = getCurrentUser();
        const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
        
        console.log('📊 [Customers] عدد الفروع في الكاش:', customerBranches?.length || 0);
        
        const branchFilterHeader = document.getElementById('customerBranchFilterHeader');
        if (branchFilterHeader) {
            console.log('🔍 [Customers] تم العثور على customerBranchFilterHeader في updateCustomerBranchFilters');
            if (customerBranches && customerBranches.length > 0) {
                const currentValue = branchFilterHeader.value;
                branchFilterHeader.innerHTML = '<option value="">اختر الفرع</option>';
                customerBranches.forEach((branch, index) => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchFilterHeader.appendChild(option);
                    console.log(`  ✅ [${index + 1}] تمت إضافة: ${branch.name} (ID: ${branch.id})`);
                });
                if (currentValue) branchFilterHeader.value = currentValue;
                branchFilterHeader.style.display = isOwner ? 'block' : 'none';
                console.log(`✅ [Customers] تم تحديث customerBranchFilterHeader بـ ${customerBranches.length} فرع`);
            } else {
                console.warn('⚠️ [Customers] لا توجد فروع في الكاش لتحديث الفلاتر');
            }
        } else {
            console.warn('⚠️ [Customers] العنصر customerBranchFilterHeader غير موجود في DOM في updateCustomerBranchFilters');
        }
        
        const branchSelect = document.getElementById('customerBranchSelect');
        if (branchSelect && customerBranches && customerBranches.length > 0) {
            const currentValue = branchSelect.value;
            branchSelect.innerHTML = '<option value="">اختر الفرع...</option>';
            customerBranches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.id;
                option.textContent = branch.name;
                branchSelect.appendChild(option);
            });
            if (currentValue) branchSelect.value = currentValue;
        }
    } catch (error) {
        console.error('❌ [Customers] خطأ في تحديث فلاتر الفروع:', error);
    }
}

// تطبيق فلترة الفرع (يتم استدعاؤها تلقائياً عند تغيير القيمة)
function applyBranchFilter() {
    const branchFilterHeader = document.getElementById('customerBranchFilterHeader');
    if (branchFilterHeader) {
        // ✅ حفظ قيمة الفرع المحدد
        selectedBranchId = branchFilterHeader.value || null;
        console.log('🔄 [Customers] تغيير فلترة الفرع إلى:', selectedBranchId || 'غير محدد');
    }
    loadCustomers();
}

function switchCustomerType(type) {
    currentCustomerType = type;
    // حفظ نوع العميل في localStorage
    localStorage.setItem('currentCustomerType', type);
    currentCustomerPage = 1;
    
    // مسح البحث عند تغيير النوع
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    
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
    const commercialDebtHeader = document.getElementById('commercialDebtHeader');
    if (commercialDebtHeader) {
        commercialDebtHeader.style.display = type === 'commercial' ? 'table-cell' : 'none';
    }
    
    // Display customers - التأكد من استخدام العملاء الصحيحة فقط
    const customers = type === 'retail' ? retailCustomers : commercialCustomers;
    // فلترة إضافية للتأكد من النوع الصحيح
    const filteredCustomers = customers.filter(c => {
        // التأكد من أن customer_type يطابق النوع المطلوب
        return (c.customer_type || 'retail') === type;
    });
    displayCustomers(filteredCustomers);
    
    // ✅ تحديث إحصائيات الديون
    updateCommercialDebtStats();
}

function displayCustomers(customers) {
    // فلترة إضافية للتأكد من عرض النوع الصحيح فقط
    const filteredCustomers = customers.filter(c => {
        const customerType = c.customer_type || 'retail';
        return customerType === currentCustomerType;
    });
    
    const paginated = paginate(filteredCustomers, currentCustomerPage, customersPerPage);
    const tbody = document.getElementById('customersTableBody');
    
    if (!tbody) {
        console.warn('[Customers] قسم العملاء غير محمّل - تخطي العرض');
        return;
    }

    if (paginated.data.length === 0) {
        const colspan = currentCustomerType === 'commercial' ? 7 : 5;
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">لا يوجد عملاء</td></tr>`;
        return;
    }

    tbody.innerHTML = paginated.data.map(customer => {
        // التأكد مرة أخرى من النوع الصحيح
        const customerType = customer.customer_type || 'retail';
        if (customerType !== currentCustomerType) {
            return ''; // تخطي العملاء من النوع الخاطئ
        }
        
        const shopNameCell = currentCustomerType === 'commercial' 
            ? `<td>${customer.shop_name || '-'}</td>` 
            : '';
        const debtCell = currentCustomerType === 'commercial'
            ? `<td style="text-align: right; font-weight: 600; color: var(--warning-color);">${(parseFloat(customer.total_debt || 0) || 0).toFixed(2)} ج.م</td>`
            : '';
        
        const averageRating = parseFloat(customer.average_rating || 0);
        const totalRatings = parseInt(customer.total_ratings || 0);
        const ratingStars = renderRatingStars(averageRating);
        
        return `
        <tr>
            <td><strong>${customer.name}</strong></td>
            ${shopNameCell}
            ${debtCell}
            <td>
                <span class="phone-number-clickable" data-phone="${escapeHtml(customer.phone)}" style="color: var(--primary-color); cursor: pointer; text-decoration: underline; font-weight: 500; transition: all 0.2s ease;" onmouseover="this.style.color='var(--secondary-color)'" onmouseout="this.style.color='var(--primary-color)'">
                    ${customer.phone}
                </span>
            </td>
            <td>${customer.address || '-'}</td>
            <td>
                ${totalRatings > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="color: var(--warning-color); font-size: 16px;">${ratingStars}</div>
                        <span style="color: var(--text-light); font-size: 13px;">(${averageRating.toFixed(1)})</span>
                    </div>
                ` : '<span style="color: var(--text-light);">لا يوجد تقييم</span>'}
            </td>
            <td>
                <button data-action="view-profile" data-customer-id="${escapeHtml(customer.id)}" class="btn btn-sm btn-icon" title="عرض البروفايل" style="background: var(--primary-color); color: var(--white);">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `;
    }).filter(row => row !== '').join(''); // إزالة الصفوف الفارغة

    createPaginationButtons(
        document.getElementById('customersPagination'),
        paginated.totalPages,
        currentCustomerPage,
        (page) => {
            currentCustomerPage = page;
            // استخدام العملاء المفلترة حسب النوع الحالي
            const customersToDisplay = currentCustomerType === 'retail' ? retailCustomers : commercialCustomers;
            displayCustomers(customersToDisplay);
        }
    );

    hideByPermission();
    
    // إضافة event delegation للأزرار
    setupCustomerActionButtons();
    
    // إضافة event delegation لأرقام الهواتف
    setupPhoneNumberClickHandlers();
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

async function showAddCustomerModal() {
    document.getElementById('customerModalTitle').textContent = 'إضافة عميل جديد';
    document.getElementById('customerForm').reset();
    document.getElementById('customerId').value = '';
    document.getElementById('custType').value = 'retail';
    toggleShopNameField();
    
    // تحميل الفروع إذا لم تكن محملة
    if (customerBranches.length === 0) {
        await loadCustomerBranches();
    }
    
    // إظهار/إخفاء حقل الفرع حسب نوع المستخدم
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    const branchGroup = document.getElementById('customerBranchGroup');
    const branchSelect = document.getElementById('customerBranchSelect');
    
    if (branchGroup && branchSelect) {
        if (isOwner) {
            branchGroup.style.display = 'block';
            branchSelect.required = true;
            // تحديد الفرع الأول كقيمة افتراضية
            if (firstBranchId) {
                branchSelect.value = firstBranchId;
            }
        } else {
            branchGroup.style.display = 'none';
            branchSelect.required = false;
            branchSelect.value = '';
        }
    }
    
    document.getElementById('customerModal').style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}

async function saveCustomer(event) {
    event.preventDefault();

    // ✅ إصلاح: إزالة required من الحقول المخفية قبل التحقق من صحة النموذج
    const branchGroup = document.getElementById('customerBranchGroup');
    const branchSelect = document.getElementById('customerBranchSelect');
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    
    // التأكد من أن الحقل المطلوب مرئي فقط عندما يكون المستخدم مالكاً
    if (branchGroup && branchSelect) {
        if (isOwner && branchGroup.style.display !== 'none') {
            branchSelect.required = true;
        } else {
            branchSelect.required = false;
        }
    }

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
    
    // ✅ التحقق من حقل الفرع إذا كان مرئياً ومطلوباً
    if (isOwner && branchSelect && branchSelect.required && branchGroup.style.display !== 'none') {
        if (!branchSelect.value || branchSelect.value === '') {
            showMessage('يرجى اختيار الفرع', 'error');
            branchSelect.focus();
            return;
        }
    }
    
    const customerData = {
        name: name,
        phone: phone,
        address: document.getElementById('custAddress').value.trim(),
        customer_type: customerType,
        shop_name: customerType === 'commercial' ? shopName : null
    };

    // إضافة branch_id للمالك فقط
    if (isOwner && branchSelect && branchSelect.value) {
        customerData.branch_id = branchSelect.value;
    }

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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        if (typeof isLoadingCustomers !== 'undefined') {
            isLoadingCustomers = false;
        }
        
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
    
    // ✅ إصلاح: التحقق من حالة حقل الفرع قبل فتح النموذج
    const currentUser = getCurrentUser();
    const isOwner = currentUser && (currentUser.is_owner === true || currentUser.is_owner === 'true' || currentUser.role === 'admin');
    const branchGroup = document.getElementById('customerBranchGroup');
    const branchSelect = document.getElementById('customerBranchSelect');
    
    // تحميل الفروع إذا لم تكن محملة
    if (customerBranches.length === 0) {
        await loadCustomerBranches();
    }
    
    if (branchGroup && branchSelect) {
        if (isOwner) {
            branchGroup.style.display = 'block';
            branchSelect.required = true;
            // تعيين قيمة الفرع الحالي للعميل إذا كان موجوداً
            if (customer.branch_id) {
                branchSelect.value = customer.branch_id;
            } else if (firstBranchId) {
                branchSelect.value = firstBranchId;
            }
        } else {
            branchGroup.style.display = 'none';
            branchSelect.required = false;
            branchSelect.value = '';
        }
    }
    
    document.getElementById('customerModal').style.display = 'flex';
}

async function viewCustomerProfile(customerId) {
    try {
        // Error handling: التحقق من وجود customerId
        if (!customerId) {
            console.error('viewCustomerProfile: customerId is missing');
            showMessage('معرف العميل غير صحيح', 'error');
            return;
        }

        // Error handling: البحث عن العميل
        const customer = allCustomers.find(c => c.id === customerId);
        if (!customer) {
            console.error('viewCustomerProfile: Customer not found', { customerId, allCustomersCount: allCustomers.length });
            showMessage('العميل غير موجود', 'error');
            return;
        }
        // Load customer sales - فقط فواتير هذا العميل
        let sales = [];
        try {
            const salesResult = await API.getCustomerSales(customerId);
            
            // Error handling: التحقق من نجاح الطلب
            if (!salesResult) {
                console.error('❌ salesResult is null or undefined');
                showMessage('حدث خطأ أثناء جلب بيانات العميل: لا توجد استجابة من الخادم', 'error');
            } else if (!salesResult.success) {
                console.error('❌ خطأ في جلب مبيعات العميل:', salesResult?.message || 'خطأ غير معروف');
                console.error('❌ تفاصيل الاستجابة:', salesResult);
                showMessage('حدث خطأ أثناء جلب بيانات العميل: ' + (salesResult?.message || 'خطأ غير معروف'), 'error');
            } else if (!Array.isArray(salesResult.data)) {
                console.error('❌ salesResult.data is not an array:', salesResult.data);
                showMessage('حدث خطأ: بيانات غير صحيحة من الخادم', 'error');
            } else {
                sales = salesResult.data;
                console.log('✅ تم جلب ' + sales.length + ' فاتورة للعميل');
            }
        } catch (error) {
            console.error('❌ خطأ في استدعاء API.getCustomerSales:', error);
            showMessage('حدث خطأ أثناء جلب بيانات العميل: ' + (error.message || 'خطأ غير معروف'), 'error');
        }
        
        // Load customer repairs - فقط صيانات هذا العميل
        let repairs = [];
        try {
            const repairsResult = await API.getCustomerRepairs(customerId);
            
            // Error handling: التحقق من نجاح الطلب
            if (!repairsResult) {
                console.warn('⚠️ repairsResult is null or undefined');
            } else if (!repairsResult.success) {
                console.warn('⚠️ خطأ في جلب صيانات العميل:', repairsResult?.message || 'خطأ غير معروف');
            } else if (!Array.isArray(repairsResult.data)) {
                console.warn('⚠️ repairsResult.data is not an array:', repairsResult.data);
            } else {
                repairs = repairsResult.data;
                console.log('✅ تم جلب ' + repairs.length + ' عملية صيانة للعميل');
            }
        } catch (error) {
            console.warn('⚠️ خطأ في استدعاء API.getCustomerRepairs:', error);
            // لا نوقف العملية، فقط نسجل التحذير
        }
        
        // Load customer rating
        const ratingResult = await API.getCustomerRating(customerId);
        const customerRating = ratingResult && ratingResult.success ? ratingResult.data : { average_rating: 0, total_ratings: 0 };
        
        // إضافة التقييم للعميل
        customer.average_rating = customerRating.average_rating || 0;
        customer.total_ratings = customerRating.total_ratings || 0;
        
        // Load product returns to check which sales have returns
        let returns = [];
        try {
            const returnsResult = await API.getProductReturns();
            if (returnsResult && returnsResult.success && Array.isArray(returnsResult.data)) {
                returns = returnsResult.data;
                console.log('✅ تم جلب ' + returns.length + ' عملية استرجاع');
            }
        } catch (error) {
            console.warn('⚠️ خطأ في جلب المرتجعات:', error);
            // لا نوقف العملية، فقط نسجل التحذير
        }
        
        // إنشاء خريطة للفواتير المرتجعة (sale_number => true)
        const returnsMap = {};
        returns.forEach(ret => {
            if (ret.sale_number) {
                returnsMap[ret.sale_number] = true;
            }
        });
        
        // إضافة معلومات المرتجعات لكل فاتورة
        sales = sales.map(sale => {
            sale.hasReturns = returnsMap[sale.sale_number] || false;
            return sale;
        });
        
        console.log('🔍 عدد الفواتير المستلمة من API:', sales.length);
        console.log('🔍 بيانات الفواتير:', sales);
        
        // التأكد من أن جميع الفواتير تحتوي على items (حتى لو كانت فارغة)
        sales = sales.map(sale => {
            // Error handling: التأكد من وجود sale
            if (!sale || !sale.id) {
                console.warn('⚠️ فاتورة بدون id:', sale);
                return null;
            }
            
            // Error handling: التأكد من وجود بيانات صحيحة (items)
            // نتحقق من وجود items حتى لو كانت فارغة (قد تكون فاتورة بدون عناصر)
            // إذا لم تكن items موجودة، نضيفها كـ array فارغ
            if (!sale.items || !Array.isArray(sale.items)) {
                console.warn('⚠️ فاتورة بدون items أو items ليست array، إضافة items فارغة:', {
                    saleId: sale.id,
                    saleNumber: sale.sale_number || sale.id,
                    items: sale.items
                });
                sale.items = []; // إضافة items فارغة بدلاً من تخطي الفاتورة
            }
            
            // التأكد من وجود sale_number
            if (!sale.sale_number) {
                sale.sale_number = sale.id;
            }
            
            // التأكد من وجود المبالغ
            if (!sale.final_amount && sale.total_amount) {
                sale.final_amount = sale.total_amount;
            }
            
            return sale;
        }).filter(sale => sale !== null); // إزالة الفواتير الفارغة فقط
        
        console.log(`✅ بعد المعالجة: ${sales.length} فاتورة`);
        
        // Log تفاصيل كل فاتورة للتحقق
        if (sales.length > 0) {
            console.log('📋 تفاصيل الفواتير:');
            sales.forEach((sale, index) => {
                console.log(`  ${index + 1}. فاتورة ${sale.sale_number || sale.id}: ${sale.items?.length || 0} عنصر، المبلغ: ${sale.final_amount || sale.total_amount || 0}`);
            });
            
            // التحقق من أن جميع الفواتير صالحة
            const validSales = sales.filter(sale => sale && sale.id);
            if (validSales.length !== sales.length) {
                console.warn(`⚠️ تحذير: ${sales.length - validSales.length} فاتورة غير صالحة تمت إزالتها`);
                sales = validSales;
            }
        } else {
            console.warn('⚠️ لا توجد فواتير للعرض');
            console.warn('⚠️ تحقق من:');
            console.warn('  1. هل العميل لديه فواتير في قاعدة البيانات؟');
            console.warn('  2. هل customer_id في الفواتير يطابق customerId؟');
            console.warn('  3. هل customer_phone في الفواتير يطابق رقم هاتف العميل؟');
        }
        
        // حفظ نسخة من sales للتحقق لاحقاً
        window._debugCustomerSales = sales;
        
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
        
        // حساب إجمالي الديون للعملاء التجاريين فقط
        // استخدام total_debt من قاعدة البيانات إذا كان متاحاً، وإلا احسبه من الفواتير
        const isCommercial = customer.customer_type === 'commercial';
        let totalDebts = 0;
        
        if (isCommercial) {
            // محاولة استخدام total_debt من قاعدة البيانات أولاً
            if (customer.total_debt !== undefined && customer.total_debt !== null) {
                totalDebts = parseFloat(customer.total_debt) || 0;
            } else {
                // إذا لم يكن متاحاً، احسبه من الفواتير
                totalDebts = sales.reduce((sum, sale) => {
                    try {
                        const remaining = parseFloat(sale.remaining_amount || 0);
                        return sum + (isNaN(remaining) ? 0 : remaining);
                    } catch (error) {
                        console.warn('خطأ في حساب المتبقي من الفاتورة:', error);
                        return sum;
                    }
                }, 0);
            }
        }
    
        // إغلاق البروفايل السابق إذا كان موجوداً
        const existingProfileModal = document.querySelector('.customer-profile-modal');
        if (existingProfileModal) {
            existingProfileModal.remove();
        }
        
        // Create profile modal using CSS classes
        const modal = document.createElement('div');
        modal.className = 'modal customer-profile-modal';
        modal.id = `customer-profile-${customerId}`;
        
        // Build HTML using DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        const content = document.createElement('div');
        content.className = 'modal-content customer-profile-content';
        
        // التحقق من صلاحية المستخدم (لإظهار زر الحذف)
        const currentUser = getCurrentUser();
        const isAdmin = currentUser && currentUser.role === 'admin';
        
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
                <button onclick="showPrintAccountStatementModal('${customer.id}', '${customer.name}')" class="btn-profile-action">
                    <i class="bi bi-printer"></i> طباعة
                </button>
                ${isAdmin ? `
                <button onclick="deleteCustomerFromProfile('${customer.id}')" class="btn-profile-action" style="background: var(--danger-color); color: var(--white);">
                    <i class="bi bi-trash"></i> حذف
                </button>
                ` : ''}
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
                    ${customer.customer_type === 'commercial' ? '<i class="bi bi-briefcase"></i> عميل تجاري' : '<i class="bi bi-person"></i> زبون'}
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
            <div class="customer-info-item">
                <i class="bi bi-star-fill" style="color: var(--warning-color);"></i>
                <div>
                    <div class="customer-info-item-label">التقييم التراكمي</div>
                    <div class="customer-info-item-value">
                        ${customer.total_ratings > 0 ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: var(--warning-color); font-size: 18px;">${renderRatingStars(customer.average_rating)}</span>
                                <span style="color: var(--text-light);">(${customer.average_rating.toFixed(1)})</span>
                                <span style="color: var(--text-light); font-size: 0.9em;">(${customer.total_ratings} تقييم)</span>
                            </div>
                        ` : '<span style="color: var(--text-light);">لا يوجد تقييم</span>'}
                    </div>
                </div>
            </div>
        `;
        
        customerInfoCard.appendChild(customerInfoHeader);
        customerInfoCard.appendChild(customerInfoGrid);
        
        // إضافة قسم الملاحظات
        const notesSection = document.createElement('div');
        notesSection.className = 'customer-notes-section';
        notesSection.style.cssText = 'margin-top: 20px; padding: 20px; background: var(--white); border-radius: 10px; border: 1px solid var(--border-color);';
        notesSection.innerHTML = `
            <h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
                <i class="bi bi-sticky"></i> ملاحظات العميل
            </h4>
            <textarea id="customerNotesTextarea" rows="4" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; font-family: inherit; resize: vertical;">${escapeHtml(customer.notes || '')}</textarea>
            ${hasPermission('manager') ? `
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button onclick="saveCustomerNotes('${customer.id}')" class="btn btn-primary btn-sm">
                        <i class="bi bi-save"></i> حفظ الملاحظات
                    </button>
                </div>
            ` : ''}
        `;
        customerInfoCard.appendChild(notesSection);
        
        // إضافة زر تعديل التقييم للمالك فقط
        if (hasPermission('admin')) {
            const ratingEditSection = document.createElement('div');
            ratingEditSection.style.cssText = 'margin-top: 15px; padding: 15px; background: var(--light-bg); border-radius: 8px; border: 1px dashed var(--border-color);';
            ratingEditSection.innerHTML = `
                <button onclick="showEditRatingModal('${customer.id}', ${customer.average_rating || 0})" class="btn btn-warning btn-sm" style="background: var(--warning-color); color: var(--white);">
                    <i class="bi bi-star"></i> تعديل التقييم التراكمي
                </button>
            `;
            customerInfoCard.appendChild(ratingEditSection);
        }
        
        // Statistics Cards
        const statsGrid = document.createElement('div');
        statsGrid.className = 'customer-stats-grid';
        // بناء statsGrid مع إضافة مربع "إجمالي الديون" للعملاء التجاريين
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
            ${isCommercial ? `
            <div class="customer-stat-card stat-debts">
                <div class="stat-decorative-circle circle-1"></div>
                <div class="stat-decorative-circle circle-2"></div>
                <div class="customer-stat-value">${totalDebts.toFixed(2)}</div>
                <div class="customer-stat-label">
                    <i class="bi bi-exclamation-triangle"></i> إجمالي الديون
                    <span style="font-size: 0.85em; opacity: 0.9;">(ج.م)</span>
                </div>
                ${totalDebts > 0 ? `
                <div style="margin-top: 10px;">
                    <button onclick="showCollectDebtModal('${customer.id}', ${totalDebts})" class="btn btn-sm" style="background: var(--success-color); color: var(--white); width: 100%;">
                        <i class="bi bi-cash-coin"></i> تحصيل دين
                    </button>
                </div>
                ` : ''}
            </div>
            ` : ''}
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
            ${sales.length > 0 ? `<span class="section-badge">${sales.length}</span>` : ''}
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
            // إضافة حقول البحث
            const searchBar = document.createElement('div');
            searchBar.className = 'filters-bar';
            searchBar.style.cssText = 'margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;';
            searchBar.innerHTML = `
                <input type="text" id="salesSearchInvoiceNumber" placeholder="بحث برقم الفاتورة..." class="search-input" style="flex: 1; min-width: 200px;">
                <input type="date" id="salesSearchDate" placeholder="اختر التاريخ" class="search-input" style="flex: 0 0 auto; max-width: 150px; font-size: 14px;">
            `;
            
            // Build sales table
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container customer-sales-table';
            tableContainer.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';
            
            const table = document.createElement('table');
            table.className = 'data-table';
            
            // Build table header
            const thead = document.createElement('thead');
            // إضافة عمود "المتبقي" للعملاء التجاريين فقط
            const isCommercial = customer.customer_type === 'commercial';
            thead.innerHTML = `
                <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th style="text-align: right;">الإجمالي</th>
                    ${isCommercial ? '<th style="text-align: right;">المتبقي</th>' : ''}
                    <th style="text-align: center;">الإجراءات</th>
                </tr>
            `;
            
            // Build table body - سيتم ملؤه بواسطة displaySalesWithPagination
            const tbody = document.createElement('tbody');
            tbody.id = 'customerSalesTableBody';
            
            table.appendChild(thead);
            table.appendChild(tbody);
            
            // إضافة min-width للجدول لضمان التمرير الأفقي على الموبايل
            table.style.minWidth = '600px';
            
            tableContainer.appendChild(table);
            
            // إضافة pagination container
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';
            paginationContainer.id = 'customerSalesPagination';
            
            salesSection.appendChild(salesHeader);
            salesSection.appendChild(searchBar);
            salesSection.appendChild(tableContainer);
            salesSection.appendChild(paginationContainer);
            
            // حفظ بيانات المبيعات للبحث والتصفح
            window.currentCustomerSales = sales;
            window._originalCustomerSales = sales; // حفظ نسخة أصلية للفلترة
            window.currentCustomerId = customerId;
            window.currentCustomer = customer; // حفظ بيانات العميل للاستخدام في displaySalesWithPagination
            window.currentSalesPage = 1;
            window.salesPerPage = 5;
            
            console.log('🔍 قبل استدعاء displaySalesWithPagination:');
            console.log('  - عدد الفواتير:', sales.length);
            console.log('  - window.currentCustomerSales:', window.currentCustomerSales?.length);
            console.log('  - window.currentSalesPage:', window.currentSalesPage);
            console.log('  - window.salesPerPage:', window.salesPerPage);
            
            // إضافة event listeners للبحث مباشرة بعد إنشاء العناصر (قبل setTimeout)
            // مثل البحث برقم العميل تماماً - يعمل لحظياً
            // استخدام setTimeout صغير لضمان أن العناصر موجودة في DOM
            setTimeout(() => {
                const invoiceSearchInput = document.getElementById('salesSearchInvoiceNumber');
                const dateSearchInput = document.getElementById('salesSearchDate');
                
                if (!invoiceSearchInput) {
                    console.error('❌ salesSearchInvoiceNumber not found in DOM');
                    return;
                }
                
                if (!dateSearchInput) {
                    console.error('❌ salesSearchDate not found in DOM');
                    return;
                }
                
                console.log('✅ تم العثور على حقول البحث، إضافة event listeners...');
                
                // إزالة event listeners السابقة لتجنب التكرار
                if (invoiceSearchInput._searchHandler) {
                    invoiceSearchInput.removeEventListener('input', invoiceSearchInput._searchHandler);
                }
                
                // إنشاء handler جديد - يعمل مباشرة مثل البحث برقم العميل بالضبط
                invoiceSearchInput._searchHandler = function() {
                    const query = this.value.toLowerCase().trim();
                    // استخدام النسخة الأصلية من الفواتير دائماً
                    const originalSales = window._originalCustomerSales || [];
                    
                    // فلترة مباشرة مثل البحث برقم العميل - البحث في أي مكان
                    let filtered = originalSales.filter(sale => {
                        const saleNumber = String(sale.sale_number || sale.id || '').toLowerCase();
                        return saleNumber.includes(query);
                    });
                    
                    // تطبيق فلترة التاريخ أيضاً إذا كان موجوداً
                    const dateInput = document.getElementById('salesSearchDate');
                    if (dateInput && dateInput.value) {
                        const searchDate = dateInput.value;
                        filtered = filtered.filter(sale => {
                            if (!sale.created_at) return false;
                            const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
                            return saleDate === searchDate;
                        });
                    }
                    
                    // إعادة تعيين الصفحة إلى 1 عند البحث
                    window.currentSalesPage = 1;
                    window.currentCustomerSales = filtered;
                    
                    // عرض النتائج مباشرة - مثل displayCustomers في البحث برقم العميل
                    displaySalesWithPagination(filtered);
                };
                
                invoiceSearchInput.addEventListener('input', invoiceSearchInput._searchHandler);
                console.log('✅ تم إضافة event listener للبحث برقم الفاتورة (لحظي)');
                
                // إضافة event listener للبحث بالتاريخ
                if (dateSearchInput) {
                // إزالة event listeners السابقة لتجنب التكرار
                if (dateSearchInput._searchHandler) {
                    dateSearchInput.removeEventListener('change', dateSearchInput._searchHandler);
                }
                
                // إنشاء handler جديد - يعمل مباشرة مثل البحث برقم العميل
                dateSearchInput._searchHandler = function() {
                    const searchDate = this.value;
                    // استخدام النسخة الأصلية من الفواتير دائماً
                    const originalSales = window._originalCustomerSales || [];
                    
                    // فلترة مباشرة
                    let filtered = originalSales.filter(sale => {
                        if (!sale.created_at) return false;
                        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
                        return saleDate === searchDate;
                    });
                    
                    // تطبيق فلترة رقم الفاتورة أيضاً إذا كان موجوداً
                    const invoiceInput = document.getElementById('salesSearchInvoiceNumber');
                    if (invoiceInput && invoiceInput.value.trim()) {
                        const query = invoiceInput.value.toLowerCase().trim();
                        filtered = filtered.filter(sale => {
                            const saleNumber = String(sale.sale_number || sale.id || '').toLowerCase();
                            return saleNumber.includes(query);
                        });
                    }
                    
                    // إعادة تعيين الصفحة إلى 1 عند البحث
                    window.currentSalesPage = 1;
                    window.currentCustomerSales = filtered;
                    
                    // عرض النتائج مباشرة - مثل displayCustomers في البحث برقم العميل
                    displaySalesWithPagination(filtered);
                };
                
                dateSearchInput.addEventListener('change', dateSearchInput._searchHandler);
                console.log('✅ تم إضافة event listener للبحث بالتاريخ (لحظي)');
                }
            }, 50); // setTimeout صغير لضمان أن DOM جاهز
            
            // التأكد من أن sales ليس فارغاً قبل العرض
            if (sales && sales.length > 0) {
                console.log('✅ استدعاء displaySalesWithPagination مع', sales.length, 'فاتورة');
                // استخدام setTimeout لضمان أن DOM جاهز
                setTimeout(() => {
                    displaySalesWithPagination(sales);
                }, 100);
            } else {
                console.warn('⚠️ لا توجد فواتير للعرض - sales فارغ أو length = 0');
                // عرض رسالة في الجدول
                const tbody = document.getElementById('customerSalesTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد فواتير مسجلة لهذا العميل</td></tr>';
                }
                // مسح pagination
                const paginationContainer = document.getElementById('customerSalesPagination');
                if (paginationContainer) {
                    paginationContainer.innerHTML = '';
                }
            }
        }
        
        // Repairs History Section
        const repairsSection = document.createElement('div');
        repairsSection.className = 'customer-sales-section';
        
        const repairsHeader = document.createElement('h3');
        repairsHeader.innerHTML = `
            <div class="section-icon">
                <i class="bi bi-tools"></i>
            </div>
            <span>سجل الصيانات</span>
            ${repairs.length > 0 ? `<span class="section-badge">${repairs.length}</span>` : ''}
        `;
        
        if (repairs.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'customer-sales-empty';
            emptyState.innerHTML = `
                <i class="bi bi-inbox"></i>
                <p>لا توجد عمليات صيانة مسجلة لهذا العميل</p>
            `;
            repairsSection.appendChild(repairsHeader);
            repairsSection.appendChild(emptyState);
        } else {
            // إضافة حقول البحث
            const searchBar = document.createElement('div');
            searchBar.className = 'filters-bar';
            searchBar.style.cssText = 'margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;';
            searchBar.innerHTML = `
                <input type="text" id="repairsSearchNumber" placeholder="بحث برقم العملية..." class="search-input" style="flex: 1; min-width: 200px;">
                <input type="date" id="repairsSearchDate" placeholder="اختر التاريخ" class="search-input" style="flex: 0 0 auto; max-width: 150px; font-size: 14px;">
            `;
            
            // Build repairs table
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container customer-sales-table';
            tableContainer.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';
            
            const table = document.createElement('table');
            table.className = 'data-table';
            
            // Build table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>رقم العملية</th>
                    <th>نوع الجهاز</th>
                    <th>المشكلة</th>
                    <th>التاريخ</th>
                    <th style="text-align: right;">التكلفة</th>
                    <th>الحالة</th>
                    <th style="text-align: center;">الإجراءات</th>
                </tr>
            `;
            
            // Build table body
            const tbody = document.createElement('tbody');
            tbody.id = 'customerRepairsTableBody';
            
            table.appendChild(thead);
            table.appendChild(tbody);
            
            table.style.minWidth = '700px';
            
            tableContainer.appendChild(table);
            
            // إضافة pagination container
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';
            paginationContainer.id = 'customerRepairsPagination';
            
            repairsSection.appendChild(repairsHeader);
            repairsSection.appendChild(searchBar);
            repairsSection.appendChild(tableContainer);
            repairsSection.appendChild(paginationContainer);
            
            // حفظ بيانات الصيانات للبحث والتصفح
            window.currentCustomerRepairs = repairs;
            window._originalCustomerRepairs = repairs;
            window.currentRepairsPage = 1;
            window.repairsPerPage = 5;
            
            // إضافة event listeners للبحث
            setTimeout(() => {
                const numberSearchInput = document.getElementById('repairsSearchNumber');
                const dateSearchInput = document.getElementById('repairsSearchDate');
                
                if (numberSearchInput) {
                    if (numberSearchInput._searchHandler) {
                        numberSearchInput.removeEventListener('input', numberSearchInput._searchHandler);
                    }
                    
                    numberSearchInput._searchHandler = function() {
                        const query = this.value.toLowerCase().trim();
                        const originalRepairs = window._originalCustomerRepairs || [];
                        
                        let filtered = originalRepairs.filter(repair => {
                            const repairNumber = String(repair.repair_number || repair.id || '').toLowerCase();
                            return repairNumber.includes(query);
                        });
                        
                        const dateInput = document.getElementById('repairsSearchDate');
                        if (dateInput && dateInput.value) {
                            const searchDate = dateInput.value;
                            filtered = filtered.filter(repair => {
                                if (!repair.created_at) return false;
                                const repairDate = new Date(repair.created_at).toISOString().split('T')[0];
                                return repairDate === searchDate;
                            });
                        }
                        
                        window.currentRepairsPage = 1;
                        window.currentCustomerRepairs = filtered;
                        displayRepairsWithPagination(filtered);
                    };
                    
                    numberSearchInput.addEventListener('input', numberSearchInput._searchHandler);
                }
                
                if (dateSearchInput) {
                    if (dateSearchInput._searchHandler) {
                        dateSearchInput.removeEventListener('change', dateSearchInput._searchHandler);
                    }
                    
                    dateSearchInput._searchHandler = function() {
                        const searchDate = this.value;
                        const originalRepairs = window._originalCustomerRepairs || [];
                        
                        let filtered = originalRepairs.filter(repair => {
                            if (!repair.created_at) return false;
                            const repairDate = new Date(repair.created_at).toISOString().split('T')[0];
                            return repairDate === searchDate;
                        });
                        
                        const numberInput = document.getElementById('repairsSearchNumber');
                        if (numberInput && numberInput.value.trim()) {
                            const query = numberInput.value.toLowerCase().trim();
                            filtered = filtered.filter(repair => {
                                const repairNumber = String(repair.repair_number || repair.id || '').toLowerCase();
                                return repairNumber.includes(query);
                            });
                        }
                        
                        window.currentRepairsPage = 1;
                        window.currentCustomerRepairs = filtered;
                        displayRepairsWithPagination(filtered);
                    };
                    
                    dateSearchInput.addEventListener('change', dateSearchInput._searchHandler);
                }
            }, 50);
            
            // عرض الصيانات
            if (repairs && repairs.length > 0) {
                setTimeout(() => {
                    displayRepairsWithPagination(repairs);
                }, 100);
            }
        }
        
        // Assemble all parts
        body.appendChild(customerInfoCard);
        body.appendChild(statsGrid);
        body.appendChild(salesSection);
        body.appendChild(repairsSection);
        
        content.appendChild(header);
        content.appendChild(body);
        fragment.appendChild(content);
        
        modal.appendChild(fragment);
        document.body.appendChild(modal);
        
        // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
        // modal.addEventListener('click', function(e) {
        //     if (e.target === modal) {
        //         modal.remove();
        //     }
        // });
        
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

// التأكد من أن الدالة متاحة في النطاق العام
if (typeof window !== 'undefined') {
    window.viewCustomerProfile = viewCustomerProfile;
    window.applyBranchFilter = applyBranchFilter;
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// دالة لرسم النجوم للتقييم
function renderRatingStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '';
    
    // نجوم مملوءة
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="bi bi-star-fill" style="color: var(--warning-color);"></i>';
    }
    
    // نجمة نصف مملوءة
    if (hasHalfStar) {
        starsHtml += '<i class="bi bi-star-half" style="color: var(--warning-color);"></i>';
    }
    
    // نجوم فارغة
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="bi bi-star" style="color: var(--border-color);"></i>';
    }
    
    return starsHtml;
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
    // استخدام النظام الجديد - فتح الفاتورة من API
    if (saleData && saleData.id) {
        const saleId = saleData.id;
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
    
    // Fallback للطريقة القديمة (إذا لم تكن البيانات متوفرة)
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
            <link rel="stylesheet" href="css/vendor/bootstrap-icons/bootstrap-icons.css">
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
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                    
                    body {
                        padding: 0;
                        background: white;
                        width: 80mm;
                        margin: 0;
                    }
                    
                    .invoice-container {
                        width: 80mm !important;
                        max-width: 80mm !important;
                        border: none;
                        padding: 10px 5px;
                        box-shadow: none;
                        margin: 0;
                        page-break-inside: avoid !important;
                    }
                    
                    .invoice-header {
                        font-size: 0.85em !important;
                        margin-bottom: 10px !important;
                        padding-bottom: 10px !important;
                    }
                    
                    .invoice-header h1 {
                        font-size: 1.5em !important;
                    }
                    
                    .invoice-info {
                        font-size: 0.85em !important;
                        padding: 8px !important;
                        margin-bottom: 10px !important;
                        flex-direction: column !important;
                    }
                    
                    .invoice-table {
                        font-size: 0.75em !important;
                    }
                    
                    .invoice-table th,
                    .invoice-table td {
                        padding: 4px 2px !important;
                    }
                    
                    .invoice-summary {
                        font-size: 0.85em !important;
                        padding: 8px !important;
                    }
                    
                    .invoice-summary-row {
                        font-size: 0.9em !important;
                        margin-bottom: 5px !important;
                    }
                    
                    .invoice-total {
                        font-size: 1.1em !important;
                        padding: 8px 0 !important;
                    }
                    
                    .invoice-footer {
                        font-size: 0.85em !important;
                        margin-top: 10px !important;
                        padding-top: 10px !important;
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
        
        // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
        // modal.addEventListener('click', function(e) {
        //     if (e.target === modal) {
        //         modal.remove();
        //     }
        // });
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
        
        // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
        // إعادة تعيين flag التحميل لإجبار إعادة التحميل
        if (typeof isLoadingCustomers !== 'undefined') {
            isLoadingCustomers = false;
        }
        
        await loadCustomers();
    } else {
        showMessage(result.message, 'error');
    }
}

// دالة تصدير بيانات العملاء إلى CSV
function exportCustomersToCSV() {
    // ✅ التحقق من الصلاحيات - فقط للمالك
    try {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.role !== 'admin') {
                showMessage('ليس لديك صلاحية لتصدير بيانات العملاء', 'error');
                return;
            }
        }
    } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
        showMessage('خطأ في التحقق من الصلاحيات', 'error');
        return;
    }
    
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
    // رؤوس الأعمدة - فقط الاسم ورقم الهاتف (قابل للاستيراد على الهاتف)
    const headers = ['الاسم', 'رقم الهاتف'];
    
    // البيانات - فقط الاسم ورقم الهاتف
    const rows = allCustomers.map(customer => {
        return [
            customer.name || '',
            customer.phone || ''
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

// حفظ ملاحظات العميل
async function saveCustomerNotes(customerId) {
    const notesTextarea = document.getElementById('customerNotesTextarea');
    if (!notesTextarea) {
        showMessage('لم يتم العثور على حقل الملاحظات', 'error');
        return;
    }
    
    const notes = notesTextarea.value.trim();
    
    try {
        const result = await API.updateCustomer({
            id: customerId,
            notes: notes
        });
        
        if (result && result.success) {
            showMessage('تم حفظ الملاحظات بنجاح', 'success');
            // تحديث بيانات العميل في المصفوفة
            const customer = allCustomers.find(c => c.id === customerId);
            if (customer) {
                customer.notes = notes;
            }
        } else {
            showMessage(result?.message || 'فشل حفظ الملاحظات', 'error');
        }
    } catch (error) {
        console.error('خطأ في حفظ الملاحظات:', error);
        showMessage('حدث خطأ أثناء حفظ الملاحظات', 'error');
    }
}

// حذف العميل من البروفايل
async function deleteCustomerFromProfile(id) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            showMessage('ليس لديك صلاحية لحذف العملاء', 'error');
            return;
        }

        if (!confirmAction('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع بياناته بما في ذلك الفواتير المرتبطة به.')) return;

        const result = await API.deleteCustomer(id);
        if (result && result.success) {
            showMessage('تم حذف العميل بنجاح', 'success');
            // إغلاق modal البروفايل
            const profileModal = document.querySelector('.customer-profile-modal');
            if (profileModal) {
                profileModal.remove();
            }
            
            // ✅ إجبار إعادة التحميل من الخادم (تخطي cache)
            // إعادة تعيين flag التحميل لإجبار إعادة التحميل
            if (typeof isLoadingCustomers !== 'undefined') {
                isLoadingCustomers = false;
            }
            
            // إعادة تحميل قائمة العملاء
            await loadCustomers();
        } else {
            showMessage(result?.message || 'فشل حذف العميل', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف العميل:', error);
        showMessage('حدث خطأ أثناء حذف العميل', 'error');
    }
}

// عرض modal طباعة كشف حساب
function showPrintAccountStatementModal(customerId, customerName) {
    // التحقق من أن customerId موجود وصحيح
    if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
        console.error('showPrintAccountStatementModal: customerId is missing or invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    // إغلاق بروفايل العميل قبل فتح نموذج الطباعة
    const profileModal = document.querySelector('.customer-profile-modal');
    if (profileModal) {
        profileModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '20000';
    
    // حفظ customerId و customerName في data attributes للـ modal
    modal.setAttribute('data-customer-id', String(customerId));
    modal.setAttribute('data-customer-name', String(customerName));
    
    // تعيين التاريخ الافتراضي (آخر 30 يوم)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const defaultStartDate = startDate.toISOString().split('T')[0];
    const defaultEndDate = endDate.toISOString().split('T')[0];
    
    modal.innerHTML = `
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h3><i class="bi bi-printer"></i> طباعة كشف حساب</h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <form id="printStatementForm" onsubmit="savePrintAccountStatement(event)">
                <div class="modal-body">
                    <div class="form-group">
                        <label>اسم العميل:</label>
                        <div style="font-size: 1.2em; font-weight: 700; color: var(--primary-color); padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center; margin-bottom: 20px;">
                            ${escapeHtml(customerName)}
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="statementStartDate">من تاريخ <span style="color: var(--danger-color);">*</span>:</label>
                        <input type="date" 
                               id="statementStartDate" 
                               class="form-control" 
                               value="${defaultStartDate}"
                               max="${defaultEndDate}"
                               required
                               onchange="validateStatementDates()"
                               style="width: 100%; padding: 12px; font-size: 1em; border: 2px solid var(--border-color); border-radius: 8px;">
                    </div>
                    <div class="form-group">
                        <label for="statementEndDate">إلى تاريخ <span style="color: var(--danger-color);">*</span>:</label>
                        <input type="date" 
                               id="statementEndDate" 
                               class="form-control" 
                               value="${defaultEndDate}"
                               max="${defaultEndDate}"
                               required
                               onchange="validateStatementDates()"
                               style="width: 100%; padding: 12px; font-size: 1em; border: 2px solid var(--border-color); border-radius: 8px;">
                    </div>
                    <div style="background: var(--light-bg); padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 0.9em; color: var(--text-light); border: 1px solid var(--border-color);">
                        <i class="bi bi-info-circle"></i> سيتم طباعة جميع مشتريات العميل خلال الفترة المحددة
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">إلغاء</button>
                    <button type="submit" class="btn btn-primary" style="background: var(--primary-color);">
                        <i class="bi bi-printer"></i> طباعة
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // التركيز على حقل تاريخ البداية
    setTimeout(() => {
        const startDateInput = modal.querySelector('#statementStartDate');
        if (startDateInput) {
            startDateInput.focus();
        }
    }, 100);
    
    // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
    // modal.addEventListener('click', function(e) {
    //     if (e.target === modal) {
    //         modal.remove();
    //     }
    // });
}

// التحقق من صحة التواريخ في نموذج كشف الحساب
function validateStatementDates() {
    const startDateInput = document.getElementById('statementStartDate');
    const endDateInput = document.getElementById('statementEndDate');
    
    if (!startDateInput || !endDateInput) return;
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // التأكد من أن تاريخ البداية لا يتجاوز تاريخ النهاية
    if (startDateInput.value && endDateInput.value && startDate > endDate) {
        endDateInput.value = startDateInput.value;
    }
    
    // التأكد من أن تاريخ النهاية لا يسبق تاريخ البداية
    if (startDateInput.value && endDateInput.value && endDate < startDate) {
        startDateInput.value = endDateInput.value;
    }
    
    // التأكد من أن التواريخ لا تتجاوز اليوم
    if (startDate > today) {
        startDateInput.value = today.toISOString().split('T')[0];
    }
    if (endDate > today) {
        endDateInput.value = today.toISOString().split('T')[0];
    }
}

// حفظ وطباعة كشف الحساب
async function savePrintAccountStatement(event) {
    event.preventDefault();
    
    const form = event.target;
    const modal = form.closest('.modal');
    if (!modal) {
        console.error('savePrintAccountStatement: modal not found');
        showMessage('لم يتم العثور على النموذج', 'error');
        return;
    }
    
    const customerId = modal.getAttribute('data-customer-id');
    const customerName = modal.getAttribute('data-customer-name');
    
    if (!customerId || customerId === 'undefined' || customerId === 'null' || customerId.trim() === '') {
        console.error('savePrintAccountStatement: customerId is invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    const startDateInput = form.querySelector('#statementStartDate');
    const endDateInput = form.querySelector('#statementEndDate');
    
    if (!startDateInput || !endDateInput) {
        showMessage('حقول التاريخ غير موجودة', 'error');
        return;
    }
    
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (!startDate || !endDate) {
        showMessage('يرجى تحديد تاريخ البداية والنهاية', 'error');
        return;
    }
    
    if (startDate > endDate) {
        showMessage('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
        return;
    }
    
    try {
        // إظهار حالة التحميل
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري التحضير...';
        
        // جلب بيانات العميل الكاملة للحصول على customer_type
        // محاولة البحث في قائمة العملاء المحملة أولاً
        let customerData = null;
        
        // البحث في allCustomers
        if (typeof allCustomers !== 'undefined' && Array.isArray(allCustomers)) {
            customerData = allCustomers.find(c => c.id === customerId);
        }
        
        // إذا لم يتم العثور، جرب window.currentCustomer
        if (!customerData && window.currentCustomer && window.currentCustomer.id === customerId) {
            customerData = window.currentCustomer;
        }
        
        // إذا لم يتم العثور، جرب جلب جميع العملاء والبحث
        if (!customerData) {
            try {
                const customerResult = await API.request('customers.php', 'GET');
                if (customerResult && customerResult.success && customerResult.data) {
                    const customers = Array.isArray(customerResult.data) ? customerResult.data : [];
                    customerData = customers.find(c => c.id === customerId);
                }
            } catch (error) {
                console.error('Error fetching customer data:', error);
            }
        }
        
        const customerType = customerData?.customer_type || 'retail';
        const customerPhone = customerData?.phone || '';
        const customerAddress = customerData?.address || '';
        const customerShopName = customerData?.shop_name || '';
        
        // Debug: التأكد من نوع العميل (يمكن إزالة هذا في الإنتاج)
        if (window.DEBUG_MODE) {
            console.log('Customer Data:', customerData);
            console.log('Customer Type:', customerType, 'isRetail:', customerType === 'retail');
        }
        
        // جلب مبيعات العميل خلال الفترة المحددة
        const salesResult = await API.getCustomerSales(customerId);
        
        if (!salesResult || !salesResult.success) {
            showMessage('فشل جلب بيانات المبيعات', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            return;
        }
        
        // فلترة المبيعات حسب الفترة الزمنية
        const sales = (salesResult.data || []).filter(sale => {
            const saleDate = new Date(sale.created_at);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // نهاية اليوم
            
            return saleDate >= start && saleDate <= end;
        });
        
        if (sales.length === 0) {
            showMessage('لا توجد مشتريات للعميل خلال الفترة المحددة', 'warning');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            return;
        }
        
        // حساب الإجماليات
        const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.final_amount || sale.total_amount || 0), 0);
        const totalPaid = sales.reduce((sum, sale) => sum + parseFloat(sale.paid_amount || sale.final_amount || 0), 0);
        const totalRemaining = sales.reduce((sum, sale) => sum + parseFloat(sale.remaining_amount || 0), 0);
        
        // حساب إجمالي التحصيلات من الديون (للعملاء التجاريين فقط)
        // التحصيلات = إجمالي المتبقي من جميع الفواتير - إجمالي الدين الحالي
        let totalCollections = 0;
        let currentTotalDebt = 0;
        
        if (customerType === 'commercial' && customerData) {
            // جلب إجمالي المتبقي من جميع فواتير العميل (ليس فقط في الفترة)
            try {
                const allSalesResult = await API.getCustomerSales(customerId);
                if (allSalesResult && allSalesResult.success && allSalesResult.data) {
                    const allSalesRemaining = allSalesResult.data.reduce((sum, sale) => {
                        return sum + parseFloat(sale.remaining_amount || 0);
                    }, 0);
                    
                    // إجمالي الدين الحالي من قاعدة البيانات
                    currentTotalDebt = parseFloat(customerData.total_debt || 0);
                    
                    // إجمالي التحصيلات = إجمالي المتبقي من جميع الفواتير - إجمالي الدين الحالي
                    totalCollections = Math.max(0, allSalesRemaining - currentTotalDebt);
                }
            } catch (error) {
                console.error('خطأ في حساب التحصيلات:', error);
            }
        }
        
        // إغلاق الـ modal
        modal.remove();
        
        // طباعة كشف الحساب
        printAccountStatementWindow(customerId, customerName, customerType, customerPhone, customerAddress, customerShopName, sales, startDate, endDate, totalAmount, totalPaid, totalRemaining, totalCollections, currentTotalDebt);
        
    } catch (error) {
        console.error('خطأ في طباعة كشف الحساب:', error);
        showMessage('حدث خطأ أثناء طباعة كشف الحساب', 'error');
        
        // إعادة تفعيل الزر
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="bi bi-printer"></i> طباعة';
        }
    }
}


// طباعة كشف الحساب في نافذة جديدة
function printAccountStatementWindow(customerId, customerName, customerType, customerPhone, customerAddress, customerShopName, sales, startDate, endDate, totalAmount, totalPaid, totalRemaining, totalCollections = 0, currentTotalDebt = 0) {
    try {
        const printWindow = window.open('about:blank', '_blank', 'width=1000,height=800');
        
        if (!printWindow) {
            showMessage('يرجى السماح بفتح النوافذ المنبثقة للطباعة', 'error');
            return;
        }
        
        // جلب إعدادات المتجر
        const shopSettings = window.shopSettings || {};
        const shopName = shopSettings.shop_name || 'المتجر';
        const shopPhone = shopSettings.shop_phone || '';
        const shopAddress = shopSettings.shop_address || '';
        const currency = shopSettings.currency || 'ج.م';
        
        // تنسيق التواريخ مسبقاً
        const formattedStartDate = formatDate(startDate);
        const formattedEndDate = formatDate(endDate);
        
        // Escape جميع القيم النصية قبل بناء HTML
        const safeShopAddress = shopAddress ? escapeHtml(shopAddress) : '';
        const safeShopPhone = shopPhone ? escapeHtml(shopPhone) : '';
        const safeCustomerName = escapeHtml(customerName);
        const safeCustomerId = escapeHtml(String(customerId));
        const safeCustomerPhone = customerPhone ? escapeHtml(customerPhone) : '';
        const safeCustomerAddress = customerAddress ? escapeHtml(customerAddress) : '';
        const safeCustomerShopName = customerShopName ? escapeHtml(customerShopName) : '';
        
        // تحديد إذا كان زبون (retail) - يجب إخفاء أعمدة المدفوع والمتبقي
        const isRetailCustomer = customerType === 'retail';
        
        // حساب إجمالي المتبقي بعد التحصيلات (للعملاء التجاريين فقط)
        const totalRemainingAfterCollections = isRetailCustomer ? totalRemaining : Math.max(0, currentTotalDebt);
        
        // Debug: التأكد من نوع العميل في دالة الطباعة (يمكن إزالة هذا في الإنتاج)
        if (window.DEBUG_MODE) {
            console.log('Print Statement - Customer Type:', customerType, 'isRetail:', isRetailCustomer);
            console.log('Collections:', totalCollections, 'Current Debt:', currentTotalDebt, 'Remaining After:', totalRemainingAfterCollections);
        }
        
        // تنسيق بيانات المبيعات مسبقاً
        const formattedSales = sales.map((sale, index) => {
            const saleNumber = sale.sale_number || sale.id || 'غير محدد';
            const saleDate = formatDate(sale.created_at);
            const finalAmount = parseFloat(sale.final_amount || sale.total_amount || 0);
            const paidAmount = parseFloat(sale.paid_amount || sale.final_amount || 0);
            const remainingAmount = parseFloat(sale.remaining_amount || 0);
            
            return {
                index: index + 1,
                saleNumber: escapeHtml(String(saleNumber)),
                saleDate: saleDate,
                finalAmount: finalAmount.toFixed(2),
                paidAmount: paidAmount.toFixed(2),
                remainingAmount: remainingAmount.toFixed(2),
                remainingColor: remainingAmount > 0 ? '#ff9800' : '#4CAF50'
            };
        });
        
        // بناء HTML لكشف الحساب
        const statementHtml = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>كشف حساب - ${safeCustomerName}</title>
            <link rel="stylesheet" href="css/vendor/bootstrap-icons/bootstrap-icons.css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 0;
                    background: #fff;
                    color: #333;
                    line-height: 1.6;
                    margin: 0;
                    width: 80mm;
                    max-width: 80mm;
                }
                
                .statement-container {
                    width: 80mm !important;
                    max-width: 80mm !important;
                    margin: 0 auto;
                    background: white;
                    padding: 8px 4px;
                    border: none;
                    box-sizing: border-box;
                    overflow: visible;
                    height: auto;
                    min-height: auto;
                }
                
                .statement-header {
                    text-align: center;
                    margin-bottom: 10px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #333;
                }
                
                .statement-header h1 {
                    display: none;
                }
                
                .statement-header h2 {
                    font-size: 1.2em;
                    color: #333;
                    margin-bottom: 8px;
                    font-weight: 700;
                }
                
                .statement-info {
                    display: block;
                    margin-bottom: 10px;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                
                .statement-info-section {
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .statement-info-section:last-child {
                    margin-bottom: 0;
                    border-bottom: none;
                    padding-bottom: 0;
                }
                
                .statement-info-section h3 {
                    color: #333;
                    margin-bottom: 6px;
                    font-size: 0.85em;
                    font-weight: 700;
                    text-align: right;
                }
                
                .statement-info-section p {
                    margin: 4px 0;
                    color: #333;
                    font-size: 0.7em;
                    line-height: 1.5;
                    text-align: right;
                    word-wrap: break-word;
                }
                
                .statement-info-section p strong {
                    display: inline-block;
                    min-width: 60px;
                    color: #555;
                }
                
                .statement-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                    font-size: 0.65em;
                    table-layout: fixed;
                }
                
                .statement-table thead {
                    background: #f5f5f5;
                    color: #333;
                }
                
                .statement-table th {
                    padding: 2px 1px;
                    text-align: right;
                    font-weight: 700;
                    font-size: 0.65em;
                    border: 1px solid #ddd;
                    word-wrap: break-word;
                }
                
                .statement-table td {
                    padding: 2px 1px;
                    border: 1px solid #ddd;
                    text-align: right;
                    font-size: 0.65em;
                    word-wrap: break-word;
                    line-height: 1.2;
                }
                
                .statement-table tbody tr:hover {
                    background: #f8f9fa;
                }
                
                .statement-table th.hide-column,
                .statement-table td.hide-column {
                    display: none;
                }
                
                .statement-summary {
                    margin-top: 10px;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                
                .statement-summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    font-size: 0.75em;
                }
                
                .statement-summary-row.hide-row {
                    display: none;
                }
                
                .statement-total {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 3px solid var(--primary-color, #2196F3);
                    font-size: 1.4em;
                    font-weight: 800;
                    color: var(--primary-color, #2196F3);
                }
                
                .statement-footer {
                    text-align: center;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #ddd;
                    color: #666;
                    font-size: 0.7em;
                }
                
                @media print {
                    @page {
                        margin: 0 !important;
                        size: 80mm auto !important;
                    }
                    
                    html, body {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        width: 80mm !important;
                        max-width: 80mm !important;
                        overflow: visible !important;
                        height: auto !important;
                        min-height: auto !important;
                    }
                    
                    .statement-container {
                        width: 80mm !important;
                        max-width: 80mm !important;
                        border: none !important;
                        padding: 8px 4px !important;
                        box-shadow: none !important;
                        margin: 0 auto !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        overflow: visible !important;
                        height: auto !important;
                        min-height: auto !important;
                        position: static !important;
                        box-sizing: border-box !important;
                    }
                    
                    .statement-container > * {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    
                    .statement-container * {
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="statement-container">
                <div class="statement-header">
                    <h2>كشف حساب</h2>
                </div>
                
                <div class="statement-info">
                    <div class="statement-info-section">
                        <h3>بيانات العميل</h3>
                        <p><strong>الاسم:</strong> ${safeCustomerName}</p>
                        ${safeCustomerPhone ? `<p><strong>الهاتف:</strong> ${safeCustomerPhone}</p>` : ''}
                        ${safeCustomerAddress ? `<p><strong>العنوان:</strong> ${safeCustomerAddress}</p>` : ''}
                        ${safeCustomerShopName ? `<p><strong>اسم المحل:</strong> ${safeCustomerShopName}</p>` : ''}
                        ${safeCustomerId ? `<p><strong>معرف العميل:</strong> ${safeCustomerId}</p>` : ''}
                    </div>
                    <div class="statement-info-section">
                        <h3>الفترة الزمنية</h3>
                        <p><strong>من:</strong> ${formattedStartDate}</p>
                        <p><strong>إلى:</strong> ${formattedEndDate}</p>
                    </div>
                </div>
                
                <table class="statement-table">
                    <thead>
                        <tr>
                            <th style="width: ${isRetailCustomer ? '10%' : '8%'}; text-align: center;">#</th>
                            <th style="width: ${isRetailCustomer ? '35%' : '25%'}; text-align: right;">رقم الفاتورة</th>
                            <th style="width: ${isRetailCustomer ? '25%' : '17%'}; text-align: center;">التاريخ</th>
                            <th style="width: ${isRetailCustomer ? '30%' : '20%'}; text-align: right;">الإجمالي</th>
                            ${!isRetailCustomer ? `
                            <th style="width: 15%; text-align: right;">المدفوع</th>
                            <th style="width: 15%; text-align: right;">المتبقي</th>
                            ` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${formattedSales.map(sale => `
                            <tr>
                                <td>${sale.index}</td>
                                <td>${sale.saleNumber}</td>
                                <td>${sale.saleDate}</td>
                                <td>${sale.finalAmount} ${currency}</td>
                                ${!isRetailCustomer ? `
                                <td>${sale.paidAmount} ${currency}</td>
                                <td style="color: ${sale.remainingColor};">
                                    ${sale.remainingAmount} ${currency}
                                </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="statement-summary">
                    <div class="statement-summary-row">
                        <span>عدد الفواتير:</span>
                        <strong>${sales.length}</strong>
                    </div>
                    <div class="statement-summary-row">
                        <span>إجمالي المشتريات:</span>
                        <strong>${totalAmount.toFixed(2)} ${currency}</strong>
                    </div>
                    ${!isRetailCustomer ? `
                    <div class="statement-summary-row">
                        <span>إجمالي المدفوع:</span>
                        <strong>${totalPaid.toFixed(2)} ${currency}</strong>
                    </div>
                    <div class="statement-summary-row" style="color: #ff9800;">
                        <span>إجمالي المتبقي:</span>
                        <strong>${totalRemaining.toFixed(2)} ${currency}</strong>
                    </div>
                    <div class="statement-summary-row" style="color: #4CAF50;">
                        <span>إجمالي التحصيلات من الديون:</span>
                        <strong>${totalCollections.toFixed(2)} ${currency}</strong>
                    </div>
                    <div class="statement-summary-row" style="color: #2196F3; font-weight: 700; border-top: 1px solid #ddd; padding-top: 5px; margin-top: 5px;">
                        <span>إجمالي المتبقي بعد التحصيلات:</span>
                        <strong>${totalRemainingAfterCollections.toFixed(2)} ${currency}</strong>
                    </div>
                    ` : ''}
                </div>
                
                <div class="statement-footer">
                    <p>تم إنشاء هذا الكشف في: ${new Date().toLocaleString('ar-EG')}</p>
                    <p>شكراً لتعاملكم معنا</p>
                </div>
            </div>
        </body>
        </html>
    `;
        
        // كتابة HTML في نافذة الطباعة
        printWindow.document.write(statementHtml);
        printWindow.document.close();
        
        // انتظار تحميل الصفحة ثم الطباعة
        // استخدام setTimeout بدلاً من onload لأن document.write() لا يطلق onload بشكل موثوق
        setTimeout(() => {
            try {
                // التأكد من أن النافذة لا تزال مفتوحة
                if (printWindow && !printWindow.closed) {
                    printWindow.focus();
                    printWindow.print();
                }
            } catch (error) {
                console.error('خطأ في الطباعة:', error);
                showMessage('حدث خطأ أثناء الطباعة. يرجى المحاولة مرة أخرى.', 'error');
            }
        }, 500);
        
    } catch (error) {
        console.error('خطأ في طباعة كشف الحساب:', error);
        showMessage('حدث خطأ أثناء طباعة كشف الحساب', 'error');
    }
}

// عرض modal تعديل التقييم
function showEditRatingModal(customerId, currentRating) {
    // التحقق من أن customerId موجود وصحيح
    if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
        console.error('showEditRatingModal: customerId is missing or invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    // إضافة z-index أعلى من customer-profile-modal لضمان ظهوره فوقه
    modal.style.zIndex = '20000';
    
    // حفظ customerId في data attribute للـ modal
    modal.setAttribute('data-customer-id', String(customerId));
    
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content rating-edit-modal" style="max-width: 520px; animation: slideDown 0.3s ease-out;">
            <div class="rating-modal-header">
                <div class="rating-icon-wrapper">
                    <i class="bi bi-star-fill"></i>
                </div>
                <h3>تعديل التقييم التراكمي</h3>
                <button onclick="this.closest('.modal').remove()" class="modal-close" title="إغلاق">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="rating-modal-body">
                <div class="rating-info-section">
                    <p class="rating-description">
                        <i class="bi bi-info-circle"></i>
                        اختر التقييم الجديد للعميل (من 1 إلى 5 نجوم)
                    </p>
                    <div class="current-rating-display">
                        <span class="current-label">التقييم الحالي:</span>
                        <span class="current-value">${currentRating > 0 ? currentRating.toFixed(1) : 'غير محدد'}</span>
                    </div>
                </div>
                <div class="rating-stars-section">
                    <div id="ratingStarsContainer" class="rating-stars-container">
                        ${[1, 2, 3, 4, 5].map(star => `
                            <div class="star-wrapper" data-rating="${star}">
                                <i class="bi bi-star${star <= Math.round(currentRating) ? '-fill' : ''}" 
                                   data-rating="${star}" 
                                   onclick="selectRatingStar(this, ${star})"
                                   onmouseover="highlightRatingStars(this, ${star})"
                                   onmouseout="resetRatingStars(this, ${Math.round(currentRating)})"></i>
                                <span class="star-number">${star}</span>
                            </div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="selectedRating" value="${Math.round(currentRating)}">
                    <div class="selected-rating-display">
                        <div class="rating-badge">
                            <i class="bi bi-star-fill"></i>
                            <span id="ratingText">${Math.round(currentRating)}</span>
                            <span class="rating-max">/ 5</span>
                        </div>
                        <p class="rating-label">التقييم المحدد</p>
                    </div>
                </div>
            </div>
            <div class="rating-modal-footer">
                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary btn-cancel-rating">
                    <i class="bi bi-x-circle"></i>
                    <span>إلغاء</span>
                </button>
                <button onclick="saveCustomerRatingUpdateFromModal(this)" class="btn btn-primary btn-save-rating">
                    <i class="bi bi-check-circle"></i>
                    <span>حفظ التقييم</span>
                </button>
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
}

// دالة لعرض modal تحصيل الدين
function showCollectDebtModal(customerId, totalDebts) {
    // التحقق من أن customerId موجود وصحيح
    if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
        console.error('showCollectDebtModal: customerId is missing or invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    if (!totalDebts || totalDebts <= 0) {
        showMessage('لا يوجد دين متبقي للتحصيل', 'warning');
        return;
    }
    
    // إغلاق بروفايل العميل قبل فتح نموذج التحصيل
    const profileModal = document.querySelector('.customer-profile-modal');
    if (profileModal) {
        profileModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '20000';
    
    // حفظ customerId و totalDebts في data attributes للـ modal
    modal.setAttribute('data-customer-id', String(customerId));
    modal.setAttribute('data-total-debts', String(totalDebts));
    
    modal.innerHTML = `
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h3><i class="bi bi-cash-coin"></i> تحصيل دين</h3>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <form id="collectDebtForm" onsubmit="saveCollectDebt(event)">
                <div class="modal-body">
                    <div class="form-group">
                        <label>إجمالي الدين الحالي:</label>
                        <div style="font-size: 1.5em; font-weight: 700; color: var(--warning-color); padding: 10px; background: var(--light-bg); border-radius: 8px; text-align: center; margin-bottom: 20px;">
                            ${parseFloat(totalDebts).toFixed(2)} ج.م
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="debtAmount">المبلغ المراد تحصيله (ج.م) *</label>
                        <input type="number" 
                               id="debtAmount" 
                               step="0.01" 
                               min="0.01" 
                               max="${totalDebts}" 
                               value="${totalDebts}"
                               required
                               oninput="validateDebtAmount(this, ${totalDebts})"
                               style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid var(--border-color); border-radius: 8px;">
                        <small style="color: var(--text-light); display: block; margin-top: 5px;">
                            الحد الأقصى: ${parseFloat(totalDebts).toFixed(2)} ج.م
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="debtNotes">ملاحظات (اختياري)</label>
                        <textarea id="debtNotes" 
                                  rows="3" 
                                  placeholder="ملاحظات حول عملية التحصيل..."
                                  style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 8px; resize: vertical;"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">إلغاء</button>
                    <button type="submit" class="btn btn-success" style="background: var(--success-color);">
                        <i class="bi bi-cash-coin"></i> تحصيل
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // التركيز على حقل المبلغ
    setTimeout(() => {
        const amountInput = modal.querySelector('#debtAmount');
        if (amountInput) {
            amountInput.focus();
            amountInput.select();
        }
    }, 100);
    
    // إغلاق عند الضغط خارج الـ modal - معطل حسب الطلب
    // modal.addEventListener('click', function(e) {
    //     if (e.target === modal) {
    //         modal.remove();
    //     }
    // });
}

// دالة للتحقق من صحة المبلغ
function validateDebtAmount(input, maxAmount) {
    const value = parseFloat(input.value) || 0;
    if (value > maxAmount) {
        input.value = maxAmount;
        showMessage(`المبلغ لا يمكن أن يتجاوز إجمالي الدين (${maxAmount.toFixed(2)} ج.م)`, 'warning');
    }
    if (value < 0) {
        input.value = 0;
    }
}

// دالة لحفظ تحصيل الدين
async function saveCollectDebt(event) {
    event.preventDefault();
    
    const form = event.target;
    const modal = form.closest('.modal');
    if (!modal) {
        console.error('saveCollectDebt: modal not found');
        showMessage('لم يتم العثور على النموذج', 'error');
        return;
    }
    
    const customerId = modal.getAttribute('data-customer-id');
    const totalDebts = parseFloat(modal.getAttribute('data-total-debts') || 0);
    
    if (!customerId || customerId === 'undefined' || customerId === 'null' || customerId.trim() === '') {
        console.error('saveCollectDebt: customerId is invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    const amountInput = form.querySelector('#debtAmount');
    const notesInput = form.querySelector('#debtNotes');
    
    if (!amountInput) {
        showMessage('حقل المبلغ غير موجود', 'error');
        return;
    }
    
    const amount = parseFloat(amountInput.value) || 0;
    const notes = notesInput ? notesInput.value.trim() : '';
    
    if (amount <= 0) {
        showMessage('المبلغ يجب أن يكون أكبر من الصفر', 'error');
        return;
    }
    
    if (amount > totalDebts) {
        showMessage(`المبلغ المراد تحصيله (${amount.toFixed(2)}) أكبر من إجمالي الدين (${totalDebts.toFixed(2)})`, 'error');
        return;
    }
    
    try {
        // إظهار حالة التحميل
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري التحصيل...';
        
        // استدعاء API لتحصيل الدين
        const result = await API.collectCustomerDebt(customerId, amount, notes);
        
        if (result && result.success) {
            showMessage(result.message || 'تم تحصيل الدين بنجاح', 'success');
            
            // تحديث total_debt في بيانات العميل المحلية إذا كانت موجودة
            const customer = allCustomers.find(c => c.id === customerId);
            if (customer && result.data && result.data.total_debt !== undefined) {
                customer.total_debt = parseFloat(result.data.total_debt) || 0;
            }
            
            // إغلاق الـ modal
            modal.remove();
            
            // إعادة تحميل قائمة العملاء فقط (بدون فتح البروفايل)
            if (typeof loadCustomers === 'function') {
                loadCustomers();
            }
        } else {
            const errorMsg = result?.message || 'فشل في تحصيل الدين';
            showMessage(errorMsg, 'error');
            
            // إعادة تفعيل الزر
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    } catch (error) {
        console.error('خطأ في تحصيل الدين:', error);
        showMessage('حدث خطأ في تحصيل الدين: ' + (error.message || 'خطأ غير معروف'), 'error');
        
        // إعادة تفعيل الزر
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="bi bi-cash-coin"></i> تحصيل';
        }
    }
}

// تحديد نجمة التقييم
function selectRatingStar(element, rating) {
    // البحث عن container النجوم (ratingStarsContainer)
    const container = document.getElementById('ratingStarsContainer');
    if (!container) {
        console.error('ratingStarsContainer not found');
        return;
    }
    
    const stars = container.querySelectorAll('i[data-rating]');
    const selectedRatingInput = document.getElementById('selectedRating');
    const ratingText = document.getElementById('ratingText');
    
    stars.forEach((star) => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        if (starRating <= rating) {
            star.className = 'bi bi-star-fill';
            star.style.color = 'var(--warning-color)';
        } else {
            star.className = 'bi bi-star';
            star.style.color = 'var(--border-color)';
        }
    });
    
    if (selectedRatingInput) {
        selectedRatingInput.value = rating;
    }
    if (ratingText) {
        ratingText.textContent = rating;
    }
}

// تمييز النجوم عند المرور بالماوس
function highlightRatingStars(element, rating) {
    const container = document.getElementById('ratingStarsContainer');
    if (!container) {
        return;
    }
    
    const stars = container.querySelectorAll('i[data-rating]');
    
    stars.forEach((star) => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        if (starRating <= rating) {
            star.style.color = 'var(--warning-color)';
            star.style.transform = 'scale(1.2)';
        } else {
            star.style.color = 'var(--border-color)';
            star.style.transform = 'scale(1)';
        }
    });
}

// إعادة تعيين النجوم
function resetRatingStars(element, currentRating) {
    const container = document.getElementById('ratingStarsContainer');
    if (!container) {
        return;
    }
    
    const stars = container.querySelectorAll('i[data-rating]');
    const selectedRatingInput = document.getElementById('selectedRating');
    const selectedRating = selectedRatingInput ? parseInt(selectedRatingInput.value) : currentRating;
    
    stars.forEach((star) => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        if (starRating <= selectedRating) {
            star.className = 'bi bi-star-fill';
            star.style.color = 'var(--warning-color)';
        } else {
            star.className = 'bi bi-star';
            star.style.color = 'var(--border-color)';
        }
        star.style.transform = 'scale(1)';
    });
}

// دالة جديدة لقراءة customerId من data attribute
function saveCustomerRatingUpdateFromModal(button) {
    const modal = button.closest('.modal');
    if (!modal) {
        console.error('saveCustomerRatingUpdateFromModal: modal not found');
        showMessage('لم يتم العثور على النموذج', 'error');
        return;
    }
    
    const customerId = modal.getAttribute('data-customer-id');
    if (!customerId || customerId === 'undefined' || customerId === 'null' || customerId.trim() === '') {
        console.error('saveCustomerRatingUpdateFromModal: customerId is invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    saveCustomerRatingUpdate(customerId);
}

// حفظ التقييم المحدث
async function saveCustomerRatingUpdate(customerId) {
    // التحقق من أن customerId موجود وصحيح
    if (!customerId || customerId === 'undefined' || customerId === 'null' || String(customerId).trim() === '') {
        console.error('saveCustomerRatingUpdate: customerId is invalid:', customerId);
        showMessage('معرف العميل غير صحيح', 'error');
        return;
    }
    
    const selectedRatingInput = document.getElementById('selectedRating');
    if (!selectedRatingInput) {
        showMessage('لم يتم العثور على التقييم المحدد', 'error');
        return;
    }
    
    const rating = parseInt(selectedRatingInput.value);
    if (rating < 1 || rating > 5 || isNaN(rating)) {
        showMessage('التقييم يجب أن يكون بين 1 و 5', 'error');
        return;
    }
    
    try {
        console.log('🔄 تحديث التقييم:', { customerId, rating });
        const result = await API.updateCustomerRating(customerId, rating);
        
        if (result && result.success) {
            // جلب التقييم المحدث من API مباشرة بعد التحديث
            const ratingResult = await API.getCustomerRating(customerId);
            const averageRating = ratingResult?.success ? (ratingResult.data?.average_rating || rating) : rating;
            const totalRatings = ratingResult?.success ? (ratingResult.data?.total_ratings || 1) : 1;
            
            showMessage('تم تحديث التقييم بنجاح', 'success');
            
            // إغلاق modal التقييم فقط (وليس بروفايل العميل)
            const ratingModal = document.querySelector('.modal[data-customer-id]');
            if (ratingModal) {
                ratingModal.remove();
            }
            
            // تحديث التقييم في البروفايل مباشرة بدون إعادة فتحه
            const profileModal = document.getElementById(`customer-profile-${customerId}`);
            if (profileModal) {
                
                // البحث عن عنصر التقييم في البروفايل وتحديثه
                const ratingItems = profileModal.querySelectorAll('.customer-info-item');
                let ratingItem = null;
                for (const item of ratingItems) {
                    if (item.querySelector('.bi-star-fill')) {
                        ratingItem = item;
                        break;
                    }
                }
                if (ratingItem) {
                    const ratingValueDiv = ratingItem.querySelector('.customer-info-item-value');
                    if (ratingValueDiv) {
                        ratingValueDiv.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: var(--warning-color); font-size: 18px;">${renderRatingStars(averageRating)}</span>
                                <span style="color: var(--text-light);">(${averageRating.toFixed(1)})</span>
                                <span style="color: var(--text-light); font-size: 0.9em;">(${totalRatings} تقييم)</span>
                            </div>
                        `;
                    }
                }
                
                // تحديث زر تعديل التقييم بالقيمة الجديدة
                const editRatingButton = profileModal.querySelector('button[onclick*="showEditRatingModal"]');
                if (editRatingButton) {
                    const onclickAttr = editRatingButton.getAttribute('onclick');
                    if (onclickAttr) {
                        // تحديث القيمة في onclick
                        const newOnclick = onclickAttr.replace(/showEditRatingModal\('([^']+)',\s*([\d.]+)\)/, 
                            `showEditRatingModal('${customerId}', ${averageRating})`);
                        editRatingButton.setAttribute('onclick', newOnclick);
                    }
                }
                
                // تحديث بيانات العميل في جميع المصفوفات
                const customer = allCustomers.find(c => c.id === customerId);
                if (customer) {
                    customer.average_rating = averageRating;
                    customer.total_ratings = totalRatings;
                }
                
                // تحديث في retailCustomers و commercialCustomers
                const retailCustomer = retailCustomers.find(c => c.id === customerId);
                if (retailCustomer) {
                    retailCustomer.average_rating = averageRating;
                    retailCustomer.total_ratings = totalRatings;
                }
                
                const commercialCustomer = commercialCustomers.find(c => c.id === customerId);
                if (commercialCustomer) {
                    commercialCustomer.average_rating = averageRating;
                    commercialCustomer.total_ratings = totalRatings;
                }
                
                // تحديث التقييم في جدول العملاء الرئيسي مباشرة
                const tbody = document.getElementById('customersTableBody');
                if (tbody) {
                    // البحث عن صف العميل في الجدول
                    const customerRows = tbody.querySelectorAll('tr');
                    customerRows.forEach(row => {
                        const viewButton = row.querySelector(`[data-customer-id="${customerId}"]`);
                        if (viewButton) {
                            // البحث عن خلية التقييم - قد تكون في عمود مختلف حسب نوع العميل
                            const cells = row.querySelectorAll('td');
                            let ratingCell = null;
                            
                            // البحث عن الخلية التي تحتوي على النجوم أو "لا يوجد تقييم"
                            cells.forEach(cell => {
                                const cellContent = cell.innerHTML;
                                if (cellContent.includes('bi-star') || cellContent.includes('لا يوجد تقييم')) {
                                    ratingCell = cell;
                                }
                            });
                            
                            if (ratingCell) {
                                if (totalRatings > 0) {
                                    ratingCell.innerHTML = `
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="color: var(--warning-color); font-size: 16px;">${renderRatingStars(averageRating)}</div>
                                            <span style="color: var(--text-light); font-size: 13px;">(${averageRating.toFixed(1)})</span>
                                        </div>
                                    `;
                                } else {
                                    ratingCell.innerHTML = '<span style="color: var(--text-light);">لا يوجد تقييم</span>';
                                }
                            }
                        }
                    });
                }
            } else {
                // إذا لم يكن البروفايل مفتوحاً، تحديث جدول العملاء مباشرة
                // جلب التقييم المحدث من API
                const ratingResult = await API.getCustomerRating(customerId);
                const averageRating = ratingResult?.success ? (ratingResult.data?.average_rating || rating) : rating;
                const totalRatings = ratingResult?.success ? (ratingResult.data?.total_ratings || 1) : 1;
                
                // تحديث بيانات العميل في جميع المصفوفات
                const customer = allCustomers.find(c => c.id === customerId);
                if (customer) {
                    customer.average_rating = averageRating;
                    customer.total_ratings = totalRatings;
                }
                
                // تحديث في retailCustomers و commercialCustomers
                const retailCustomer = retailCustomers.find(c => c.id === customerId);
                if (retailCustomer) {
                    retailCustomer.average_rating = averageRating;
                    retailCustomer.total_ratings = totalRatings;
                }
                
                const commercialCustomer = commercialCustomers.find(c => c.id === customerId);
                if (commercialCustomer) {
                    commercialCustomer.average_rating = averageRating;
                    commercialCustomer.total_ratings = totalRatings;
                }
                
                // تحديث التقييم في جدول العملاء الرئيسي مباشرة
                const tbody = document.getElementById('customersTableBody');
                if (tbody) {
                    // البحث عن صف العميل في الجدول
                    const customerRows = tbody.querySelectorAll('tr');
                    customerRows.forEach(row => {
                        const viewButton = row.querySelector(`[data-customer-id="${customerId}"]`);
                        if (viewButton) {
                            // البحث عن خلية التقييم
                            const cells = row.querySelectorAll('td');
                            let ratingCell = null;
                            
                            // البحث عن الخلية التي تحتوي على النجوم أو "لا يوجد تقييم"
                            cells.forEach(cell => {
                                const cellContent = cell.innerHTML;
                                if (cellContent.includes('bi-star') || cellContent.includes('لا يوجد تقييم')) {
                                    ratingCell = cell;
                                }
                            });
                            
                            if (ratingCell) {
                                if (totalRatings > 0) {
                                    ratingCell.innerHTML = `
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="color: var(--warning-color); font-size: 16px;">${renderRatingStars(averageRating)}</div>
                                            <span style="color: var(--text-light); font-size: 13px;">(${averageRating.toFixed(1)})</span>
                                        </div>
                                    `;
                                } else {
                                    ratingCell.innerHTML = '<span style="color: var(--text-light);">لا يوجد تقييم</span>';
                                }
                            }
                        }
                    });
                } else {
                    // إذا لم يكن الجدول موجوداً، إعادة تحميل كامل
                    await loadCustomers();
                }
            }
        } else {
            showMessage(result?.message || 'فشل تحديث التقييم', 'error');
        }
    } catch (error) {
        console.error('خطأ في تحديث التقييم:', error);
        showMessage('حدث خطأ أثناء تحديث التقييم', 'error');
    }
}

// عرض المبيعات مع pagination
function displaySalesWithPagination(allSales) {
    console.log('🚀 displaySalesWithPagination called with:', {
        allSalesLength: allSales?.length,
        allSalesType: typeof allSales,
        isArray: Array.isArray(allSales),
        windowCurrentCustomerSales: window.currentCustomerSales?.length
    });
    
    const tbody = document.getElementById('customerSalesTableBody');
    if (!tbody) {
        console.error('❌ customerSalesTableBody not found');
        console.error('❌ تحقق من أن الجدول تم إنشاؤه قبل استدعاء displaySalesWithPagination');
        return;
    }
    
    // Error handling: التأكد من أن allSales هو array
    if (!Array.isArray(allSales)) {
        console.error('❌ allSales is not an array:', allSales);
        console.error('❌ allSales type:', typeof allSales);
        console.error('❌ allSales value:', allSales);
        
        // محاولة استخدام window.currentCustomerSales كبديل
        if (Array.isArray(window.currentCustomerSales)) {
            console.warn('⚠️ استخدام window.currentCustomerSales كبديل');
            allSales = window.currentCustomerSales;
        } else {
            // حساب عدد الأعمدة بناءً على نوع العميل
            const currentCustomer = allCustomers.find(c => c.id === window.currentCustomerId);
            const isCommercial = currentCustomer && currentCustomer.customer_type === 'commercial';
            const colCount = isCommercial ? 5 : 4;
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: var(--danger-color);">خطأ في عرض البيانات: البيانات غير صحيحة</td></tr>`;
            return;
        }
    }
    
    // التأكد من أن allSales ليس null أو undefined
    if (!allSales) {
        console.error('❌ allSales is null or undefined');
        // حساب عدد الأعمدة بناءً على نوع العميل
        const currentCustomer = window.currentCustomer || allCustomers.find(c => c.id === window.currentCustomerId);
        const isCommercial = currentCustomer && currentCustomer.customer_type === 'commercial';
        const colCount = isCommercial ? 5 : 4;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: var(--danger-color);">خطأ: لا توجد بيانات للعرض</td></tr>`;
        return;
    }
    
    console.log(`📊 عرض ${allSales.length} فاتورة (الصفحة ${window.currentSalesPage || 1})`);
    console.log('📊 بيانات allSales:', allSales);
    
    // التأكد من أن paginate function موجودة
    if (typeof paginate !== 'function') {
        console.error('❌ paginate function is not defined!');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-color);">خطأ: دالة paginate غير موجودة</td></tr>';
        return;
    }
    
    const currentPage = window.currentSalesPage || 1;
    const perPage = window.salesPerPage || 5;
    
    console.log(`📊 Pagination settings: page=${currentPage}, perPage=${perPage}`);
    
    const paginated = paginate(allSales, currentPage, perPage);
    
    console.log('📊 Paginated result:', {
        dataLength: paginated.data.length,
        totalPages: paginated.totalPages,
        totalItems: paginated.totalItems,
        currentPage: paginated.currentPage
    });
    
    if (paginated.data.length === 0) {
        console.warn('⚠️ لا توجد فواتير للعرض في هذه الصفحة');
        console.warn('⚠️ allSales.length:', allSales.length);
        console.warn('⚠️ currentPage:', currentPage);
        console.warn('⚠️ perPage:', perPage);
        
        // حساب عدد الأعمدة بناءً على نوع العميل
        const currentCustomer = window.currentCustomer || allCustomers.find(c => c.id === window.currentCustomerId);
        const isCommercial = currentCustomer && currentCustomer.customer_type === 'commercial';
        const colCount = isCommercial ? 5 : 4;
        
        // إذا كان هناك فواتير لكن لا توجد في هذه الصفحة
        if (allSales.length > 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد فواتير في الصفحة ${currentPage} من ${paginated.totalPages}</td></tr>`;
        } else {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد فواتير مسجلة لهذا العميل</td></tr>`;
        }
        
        const paginationContainer = document.getElementById('customerSalesPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        return;
    }
    
    console.log(`✅ عرض ${paginated.data.length} فاتورة من ${paginated.totalPages} صفحة`);
    
    // بناء HTML للفواتير
    const fragment = document.createDocumentFragment();
    console.log('🔨 بدء بناء HTML للفواتير...');
    
    paginated.data.forEach((sale, index) => {
        try {
            console.log(`🔨 معالجة فاتورة ${index + 1}/${paginated.data.length}:`, {
                id: sale.id,
                sale_number: sale.sale_number,
                items_count: sale.items?.length || 0,
                final_amount: sale.final_amount
            });
            
            const saleNumber = sale.sale_number || sale.id || 'غير محدد';
            const items = sale.items && Array.isArray(sale.items) ? sale.items : [];
            
            let totalAmount = parseFloat(sale.total_amount || 0);
            let finalAmount = parseFloat(sale.final_amount || 0);
            
            if (items.length > 0 && (totalAmount === 0 || finalAmount === 0)) {
                const calculatedTotal = items.reduce((sum, item) => {
                    const itemPrice = parseFloat(item.total_price || 0);
                    const itemQty = parseInt(item.quantity || 1);
                    return sum + (itemPrice * itemQty);
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
            
            totalAmount = isNaN(totalAmount) ? 0 : totalAmount;
            finalAmount = isNaN(finalAmount) ? 0 : finalAmount;
            
            // حساب المتبقي من الفاتورة
            const remainingAmount = parseFloat(sale.remaining_amount || 0);
            const hasRemaining = !isNaN(remainingAmount) && remainingAmount > 0;
            
            // التحقق من نوع العميل (من window.currentCustomer أو البحث في allCustomers)
            const currentCustomer = window.currentCustomer || allCustomers.find(c => c.id === window.currentCustomerId);
            const isCommercial = currentCustomer && currentCustomer.customer_type === 'commercial';
            
            // التحقق من وجود مرتجعات لهذه الفاتورة
            const hasReturns = sale.hasReturns || false;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="invoice-number-cell" style="position: relative;">
                        ${hasReturns ? '<span class="return-badge" title="تم إرجاع منتج من هذه الفاتورة"><i class="bi bi-arrow-counterclockwise"></i></span>' : ''}
                        <strong class="invoice-number-text">${escapeHtml(saleNumber)}</strong>
                    </div>
                </td>
                <td>
                    <div class="invoice-date-cell">
                        <i class="bi bi-calendar3"></i>
                        <span>${formatDate(sale.created_at)}</span>
                    </div>
                </td>
                <td style="text-align: right;">
                    <strong class="invoice-final-amount">
                        ${finalAmount.toFixed(2)} <span class="invoice-amount-currency">ج.م</span>
                    </strong>
                </td>
                ${isCommercial ? `
                <td style="text-align: right;">
                    <strong class="invoice-remaining-amount">
                        ${remainingAmount.toFixed(2)} <span class="invoice-amount-currency">ج.م</span>
                    </strong>
                </td>
                ` : ''}
                <td style="text-align: center;">
                    <div class="invoice-actions">
                        <button onclick="printSaleInvoice('${escapeHtml(sale.id)}')" class="btn-invoice-action btn-invoice-pdf">
                            <i class="bi bi-printer"></i> طباعة الفاتورة
                        </button>
                    </div>
                </td>
            `;
            fragment.appendChild(row);
            console.log(`✅ تم إضافة صف للفاتورة ${saleNumber}`);
        } catch (error) {
            console.error('❌ خطأ في معالجة فاتورة:', error, sale);
        }
    });
    
    console.log(`🔨 تم بناء ${fragment.children.length} صف في fragment`);
    
    // مسح tbody وإضافة fragment
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    console.log(`✅ تم إضافة ${tbody.children.length} صف إلى tbody`);
    
    // عرض pagination
    const paginationContainer = document.getElementById('customerSalesPagination');
    if (paginationContainer) {
        console.log('📄 إنشاء أزرار pagination:', {
            totalPages: paginated.totalPages,
            currentPage: window.currentSalesPage || 1,
            totalItems: paginated.totalItems
        });
        
        createPaginationButtons(
            paginationContainer,
            paginated.totalPages,
            window.currentSalesPage || 1,
            (page) => {
                console.log('🔄 تغيير الصفحة إلى:', page);
                window.currentSalesPage = page;
                
                // الحصول على الفواتير المفلترة الحالية (إذا كان هناك فلترة) أو الفواتير الأصلية
                let salesToDisplay = window.currentCustomerSales || [];
                
                // إذا كان هناك فلترة نشطة، نحتاج إلى إعادة تطبيقها
                const invoiceSearchInput = document.getElementById('salesSearchInvoiceNumber');
                const dateSearchInput = document.getElementById('salesSearchDate');
                
                const hasFilter = (invoiceSearchInput && invoiceSearchInput.value.trim()) || 
                                 (dateSearchInput && dateSearchInput.value);
                
                if (hasFilter) {
                    // إذا كان هناك فلترة، نحتاج إلى الحصول على الفواتير الأصلية أولاً
                    // ثم تطبيق الفلترة عليها
                    const originalSales = window._originalCustomerSales || window.currentCustomerSales || [];
                    filterAndDisplaySales(originalSales, false);
                } else {
                    // إذا لم يكن هناك فلترة، استخدم displaySalesWithPagination مباشرة
                    displaySalesWithPagination(salesToDisplay);
                }
            }
        );
    } else {
        console.warn('⚠️ customerSalesPagination container not found');
    }
}

// فلترة وعرض المبيعات (لحظي مثل البحث برقم العميل)
function filterAndDisplaySales(allSales, resetPage = true) {
    const invoiceSearchInput = document.getElementById('salesSearchInvoiceNumber');
    const dateSearchInput = document.getElementById('salesSearchDate');
    
    // التأكد من أن allSales هو array
    if (!Array.isArray(allSales)) {
        console.error('❌ allSales is not an array in filterAndDisplaySales:', allSales);
        allSales = window._originalCustomerSales || [];
    }
    
    let filtered = [...allSales];
    
    // فلترة برقم الفاتورة (البحث في أي مكان في رقم الفاتورة - لحظي مثل البحث برقم العميل)
    if (invoiceSearchInput && invoiceSearchInput.value.trim()) {
        const searchTerm = invoiceSearchInput.value.trim().toLowerCase();
        filtered = filtered.filter(sale => {
            const saleNumber = String(sale.sale_number || sale.id || '').toLowerCase();
            // استخدام includes بدلاً من startsWith للبحث في أي مكان في رقم الفاتورة
            // مثل البحث برقم العميل تماماً
            return saleNumber.includes(searchTerm);
        });
        console.log('🔍 البحث برقم الفاتورة (لحظي):', {
            searchTerm: searchTerm,
            originalCount: allSales.length,
            filteredCount: filtered.length
        });
    }
    
    // فلترة بالتاريخ
    if (dateSearchInput && dateSearchInput.value) {
        const searchDate = dateSearchInput.value;
        filtered = filtered.filter(sale => {
            if (!sale.created_at) return false;
            const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
            return saleDate === searchDate;
        });
        console.log('🔍 البحث بالتاريخ:', {
            searchDate: searchDate,
            originalCount: allSales.length,
            filteredCount: filtered.length
        });
    }
    
    // إعادة تعيين الصفحة الحالية فقط إذا كان resetPage = true (عند البحث، وليس عند تغيير الصفحة)
    if (resetPage) {
        window.currentSalesPage = 1;
        console.log('🔄 إعادة تعيين الصفحة إلى 1 بسبب البحث/الفلترة');
    }
    
    // حفظ الفواتير المفلترة للاستخدام في pagination
    // لكن نحتفظ بالنسخة الأصلية في _originalCustomerSales
    window.currentCustomerSales = filtered;
    
    console.log('🔍 بعد الفلترة:', {
        originalCount: window._originalCustomerSales?.length || 0,
        filteredCount: filtered.length,
        currentPage: window.currentSalesPage,
        hasInvoiceSearch: invoiceSearchInput?.value.trim() || false,
        hasDateSearch: dateSearchInput?.value || false
    });
    
    // عرض الفواتير المفلترة
    displaySalesWithPagination(filtered);
}

// دالة لعرض الصيانات مع pagination
function displayRepairsWithPagination(allRepairs) {
    const tbody = document.getElementById('customerRepairsTableBody');
    if (!tbody) {
        console.error('❌ customerRepairsTableBody not found');
        return;
    }
    
    // Error handling: التأكد من أن allRepairs هو array
    if (!Array.isArray(allRepairs)) {
        console.error('❌ allRepairs is not an array:', allRepairs);
        if (Array.isArray(window.currentCustomerRepairs)) {
            allRepairs = window.currentCustomerRepairs;
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger-color);">خطأ في عرض البيانات: البيانات غير صحيحة</td></tr>';
            return;
        }
    }
    
    if (!allRepairs) {
        console.error('❌ allRepairs is null or undefined');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger-color);">خطأ: لا توجد بيانات للعرض</td></tr>';
        return;
    }
    
    // التأكد من أن paginate function موجودة
    if (typeof paginate !== 'function') {
        console.error('❌ paginate function is not defined!');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger-color);">خطأ: دالة paginate غير موجودة</td></tr>';
        return;
    }
    
    const currentPage = window.currentRepairsPage || 1;
    const perPage = window.repairsPerPage || 5;
    
    const paginated = paginate(allRepairs, currentPage, perPage);
    
    if (paginated.data.length === 0) {
        if (allRepairs.length > 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد عمليات في الصفحة ${currentPage} من ${paginated.totalPages}</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-light);">لا توجد عمليات صيانة مسجلة لهذا العميل</td></tr>';
        }
        
        const paginationContainer = document.getElementById('customerRepairsPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        return;
    }
    
    // Helper functions (استخدام الدوال من repairs.js إذا كانت متاحة، وإلا استخدام fallback)
    const formatDateFunc = typeof formatDate === 'function' ? formatDate : (dateString) => {
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
            return '-';
        }
    };
    
    const formatCurrencyFunc = typeof formatCurrency === 'function' ? formatCurrency : (amount) => {
        const num = parseFloat(amount || 0);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    };
    
    const getStatusColorFunc = typeof getStatusColor === 'function' ? getStatusColor : (status) => {
        const colors = {
            'received': '#2196F3',
            'pending': '#FFA500',
            'in_progress': '#2196F3',
            'ready': '#4CAF50',
            'delivered': '#4CAF50',
            'cancelled': '#f44336',
            'lost': '#f44336'
        };
        return colors[status] || '#999';
    };
    
    const getStatusTextFunc = typeof getStatusText === 'function' ? getStatusText : (status) => {
        const statuses = {
            'received': 'تم الاستلام',
            'pending': 'قيد الانتظار',
            'in_progress': 'قيد الإصلاح',
            'ready': 'جاهز',
            'delivered': 'تم التسليم',
            'cancelled': 'ملغي',
            'lost': 'مفقود'
        };
        return statuses[status] || status || '-';
    };
    
    // بناء HTML للصيانات
    const fragment = document.createDocumentFragment();
    
    paginated.data.forEach((repair) => {
        try {
            const repairNumber = repair.repair_number || repair.id || 'غير محدد';
            const deviceType = repair.device_type || '-';
            const problem = repair.problem || '-';
            const date = formatDateFunc(repair.created_at);
            const cost = parseFloat(repair.customer_price || repair.cost || 0);
            const status = repair.status || 'received';
            const statusColor = getStatusColorFunc(status);
            const statusText = getStatusTextFunc(status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong class="invoice-number-text">${escapeHtml(repairNumber)}</strong>
                </td>
                <td>${escapeHtml(deviceType)}</td>
                <td>${escapeHtml(problem)}</td>
                <td>
                    <div class="invoice-date-cell">
                        <i class="bi bi-calendar3"></i>
                        <span>${date}</span>
                    </div>
                </td>
                <td style="text-align: right;">
                    <strong class="invoice-final-amount">
                        ${formatCurrencyFunc(cost)}
                    </strong>
                </td>
                <td>
                    <span class="status-badge" style="background: ${statusColor}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <div class="invoice-actions">
                        <button onclick="printRepairReceipt('${escapeHtml(repair.id)}')" class="btn-invoice-action btn-invoice-pdf">
                            <i class="bi bi-printer"></i> طباعة الإيصال
                        </button>
                    </div>
                </td>
            `;
            fragment.appendChild(row);
        } catch (error) {
            console.error('❌ خطأ في معالجة عملية صيانة:', error, repair);
        }
    });
    
    // مسح tbody وإضافة fragment
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // عرض pagination
    const paginationContainer = document.getElementById('customerRepairsPagination');
    if (paginationContainer) {
        createPaginationButtons(
            paginationContainer,
            paginated.totalPages,
            window.currentRepairsPage || 1,
            (page) => {
                window.currentRepairsPage = page;
                let repairsToDisplay = window.currentCustomerRepairs || [];
                displayRepairsWithPagination(repairsToDisplay);
            }
        );
    }
}

// ✅ دالة مستقلة لطباعة إيصال الصيانة (للاستخدام في صفحة العملاء)
async function printRepairReceiptFromCustomerPage(repairId) {
    try {
        if (!repairId) {
            showMessage('معرف عملية الصيانة غير صحيح', 'error');
            return;
        }
        
        // ✅ استخدام بيانات الصيانة المحلية أولاً (من سجل صيانات العميل) لتجنب "لم يتم العثور على عملية الصيانة"
        // لأن طلب API بـ id يطبق فلتر الفرع/التخصص وقد لا يعيد العملية إن كانت من فرع آخر
        const idStr = String(repairId).trim();
        const localRepairs = window._originalCustomerRepairs || window.currentCustomerRepairs || [];
        let repair = localRepairs.find(r => r && (String(r.id) === idStr || String(r.repair_number) === idStr));
        
        if (!repair) {
            // جلب بيانات الصيانة من API عند عدم توفرها محلياً
            const response = await API.request(`repairs.php?id=${encodeURIComponent(repairId)}`, 'GET');
            
            if (!response || !response.success || !response.data) {
                const errorMsg = response?.message || 'فشل في جلب بيانات عملية الصيانة';
                console.error('خطأ في جلب بيانات الصيانة:', errorMsg, response);
                showMessage(errorMsg, 'error');
                return;
            }
            
            repair = Array.isArray(response.data) ? response.data[0] : response.data;
        }
        
        if (!repair) {
            showMessage('عملية الصيانة غير موجودة', 'error');
            return;
        }
        
        // ✅ توحيد الحقول عند استخدام بيانات محلية (action=customer يرجع created_by_name بدل technician_name)
        if (!repair.technician_name && repair.created_by_name) {
            repair = { ...repair, technician_name: repair.created_by_name };
        }
        if (repair.customer_price !== undefined && (repair.cost === undefined || repair.cost === null)) {
            repair = { ...repair, cost: repair.customer_price };
        }
        
        // ✅ إذا كانت الحالة "تم التسليم"، استخدم القالب الجديد (last.html)
        const status = String(repair.status || '').toLowerCase().trim();
        if (status === 'delivered') {
            console.log('✅ استخدام قالب فاتورة التسليم - حالة: تم التسليم');
            console.log('📄 استدعاء printDeliveredRepairInvoice...');
            try {
                // التحقق من وجود الدالة في window
                if (typeof window.printDeliveredRepairInvoice === 'function') {
                    await window.printDeliveredRepairInvoice(repair);
                    console.log('✅ تم استدعاء printDeliveredRepairInvoice بنجاح');
                    return; // ✅ مهم: إرجاع هنا لمنع استمرار الكود
                } else {
                    console.error('❌ دالة printDeliveredRepairInvoice غير متاحة');
                    showMessage('دالة طباعة فاتورة التسليم غير متاحة', 'error');
                    return;
                }
            } catch (error) {
                console.error('❌ خطأ في printDeliveredRepairInvoice:', error);
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
                console.error('خطأ في جلب بيانات الفرع، سيتم استخدام الإعدادات العامة:', error);
            }
        }
        
        // ✅ جلب إعدادات المحل العامة
        let shopSettings = {
            shop_name: 'محل صيانة الهواتف',
            shop_phone: '01000000000',
            shop_address: 'القاهرة، مصر',
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
            }
        } catch (error) {
            console.log('لم يتم تحميل إعدادات المحل، سيتم استخدام القيم الافتراضية:', error);
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
        
        // ✅ إنشاء رابط التتبع
        const repairNumber = repair.repair_number || repair.id;
        // ✅ استخدام repair_number بدلاً من number لتوافق مع QR Code
        const trackingLink = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '')}/repair-tracking.html?repair_number=${encodeURIComponent(repairNumber)}`;
        
        // ✅ إنشاء QR Code للرابط (fallback بسيط)
        const generateQRCodeFallback = (data, size = 200) => {
            return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&choe=UTF-8`;
        };
        
        let qrCodeImage = generateQRCodeFallback(trackingLink, 200);
        
        // ✅ تحضير الشعار
        let logoHtml = '';
        const defaultLogoPath = 'vertopal.com_photo_5922357566287580087_y.png';
        const fallbackLogoPath1 = 'photo_5922357566287580087_y.jpg';
        const fallbackLogoPath2 = 'ico/icon-192x192.png';
        
        const createLogoHtml = (src, alt = 'شعار المحل') => {
            return `<img src="${src}" alt="${alt}" class="invoice-logo" style="max-width: 500px; max-height: 500px; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src='${defaultLogoPath}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath1}'; this.onerror=function(){this.onerror=null; this.src='${fallbackLogoPath2}'; this.onerror=function(){this.style.display='none';};};};">`;
        };
        
        if (finalShopLogo && finalShopLogo.trim() !== '') {
            logoHtml = createLogoHtml(finalShopLogo);
        } else {
            logoHtml = createLogoHtml(defaultLogoPath);
        }
        
        // ✅ دالة formatPrice
        const formatPrice = (price) => {
            return parseFloat(price || 0).toFixed(2);
        };
        
        // ✅ دالة formatDate
        const formatDateFunc = (dateString) => {
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
                return '-';
            }
        };
        
        // ✅ دالة getStatusText
        const getStatusTextFunc = (status) => {
            const statuses = {
                'received': 'تم الاستلام',
                'pending': 'قيد الانتظار',
                'in_progress': 'قيد الإصلاح',
                'ready': 'جاهز',
                'delivered': 'تم التسليم',
                'cancelled': 'ملغي',
                'lost': 'مفقود'
            };
            return statuses[status] || status || '-';
        };
        
        // ✅ تحضير اسم الفني
        const technicianName = repair.technician_name || 'غير محدد';
        
        // ✅ تحضير اسم الفرع
        const branchName = (branchData && branchData.name) || 'غير محدد';
        
        // ✅ فتح نافذة الطباعة
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (!printWindow) {
            showMessage('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال', 'error');
            return;
        }
        
        // ✅ كتابة HTML مباشرة
        printWindow.document.open('text/html', 'replace');
        printWindow.document.write(`
            
<!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>إيصال ${repair.status === 'delivered' ? 'تسليم' : 'استلام'} - ${repair.repair_number}</title>
            <link rel="stylesheet" href="css/vendor/bootstrap-icons/bootstrap-icons.css">
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
                
                .invoice-shop-info {
                    color: #666;
                    line-height: 1.8;
                    font-size: 1.25em;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    align-items: center;
                }
                
                .invoice-shop-info div {
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .invoice-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 20px;
                    padding: 20px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .invoice-details-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                
                .invoice-details-row > div {
                    color: #333;
                    font-size: 1.05em;
                    padding: 12px 15px;
                    background: var(--white, #ffffff);
                    border-radius: 8px;
                    border-right: 3px solid var(--primary-color, #2196F3);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                
                .invoice-details-row strong {
                    color: var(--primary-color, #2196F3);
                    font-weight: 600;
                    margin-left: 8px;
                }
                
                .invoice-extra-info {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 20px;
                    padding: 20px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .invoice-extra-info-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                
                .invoice-extra-info-row > div {
                    color: #333;
                    font-size: 1.05em;
                    padding: 12px 15px;
                    background: var(--white, #ffffff);
                    border-radius: 8px;
                    border-right: 3px solid var(--primary-color, #2196F3);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                
                .invoice-extra-info-row strong {
                    color: var(--primary-color, #2196F3);
                    font-weight: 600;
                    margin-left: 8px;
                }
                
                .invoice-summary {
                    margin-top: 25px;
                    padding: 25px;
                    background: #f8f9fa;
                    border-radius: 12px;
                }
                
                .invoice-summary .summary-row {
                    display: flex;
                    justify-content: space-between;
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
                
                /* ✅ Responsive Design للجوال */
                @media (max-width: 768px) {
                    .invoice-details-row {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
                    }
                    
                    .invoice-details {
                        padding: 15px !important;
                    }
                    
                    .invoice-extra-info {
                        padding: 15px !important;
                    }
                    
                    .invoice-extra-info-row {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
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
                    font-size: 1.3em;
                    font-weight: 700;
                    text-align: center;
                }
                
                .invoice-terms ul {
                    margin: 0;
                    padding-right: 25px;
                    color: var(--text-dark, #333);
                    line-height: 2;
                    font-size: 1.1em;
                }
                
                .invoice-terms li {
                    margin-bottom: 8px;
                    font-weight: 600;
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

                    /* إجبار النص على الأسود والكثافة لتفادي الطباعة الباهتة على بعض الاستضافات */
                    body,
                    .invoice-wrapper,
                    .invoice-wrapper *,
                    .invoice-shop-info,
                    .invoice-shop-info div,
                    .invoice-details-row > div,
                    .invoice-extra-info-row > div,
                    .invoice-details-row > div strong,
                    .invoice-extra-info-row > div strong,
                    .invoice-summary,
                    .invoice-summary .summary-row,
                    .invoice-terms,
                    .invoice-terms h4,
                    .invoice-terms ul,
                    .invoice-terms li,
                    .invoice-footer,
                    .invoice-footer div,
                    .invoice-header h2,
                    .invoice-qrcode p {
                        color: #000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .invoice-wrapper,
                    .invoice-shop-info,
                    .invoice-details-row > div,
                    .invoice-extra-info-row > div,
                    .invoice-summary .summary-row,
                    .invoice-terms li,
                    .invoice-footer {
                        font-weight: 600 !important;
                    }
                    .invoice-header h2,
                    .invoice-summary .summary-row.total {
                        font-weight: 700 !important;
                        color: #000 !important;
                    }

                    body {
                        background: white !important;
                        color: #000 !important;
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
                    
                    .invoice-extra-info-row {
                        visibility: visible !important;
                        opacity: 1 !important;
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
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
                        font-size: 0.9em !important;
                    }
                    
                    .invoice-shop-info div {
                        font-size: 0.9em !important;
                    }
                    
                    .invoice-details {
                        padding: 8px !important;
                        margin-bottom: 5px !important;
                        font-size: 0.85em !important;
                        page-break-inside: avoid !important;
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                        background: white !important;
                    }
                    
                    .invoice-details-row {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 3px !important;
                    }
                    
                    .invoice-details-row > div {
                        font-size: 0.8em !important;
                        padding: 6px 8px !important;
                    }
                    
                    .invoice-extra-info {
                        padding: 8px !important;
                        margin-bottom: 5px !important;
                        font-size: 0.85em !important;
                        page-break-inside: avoid !important;
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                        background: white !important;
                    }
                    
                    .invoice-extra-info-row {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 3px !important;
                    }
                    
                    .invoice-extra-info-row > div {
                        font-size: 0.8em !important;
                        padding: 6px 8px !important;
                    }
                    
                    .invoice-extra-info > div:not(.invoice-extra-info-row) {
                        font-size: 0.8em !important;
                        padding: 6px 8px !important;
                    }
                    
                    .invoice-delivery-date {
                        margin: 15px 0 !important;
                        padding: 15px !important;
                        background: linear-gradient(135deg, #2196F3 0%, #64B5F6 100%) !important;
                        border-radius: 8px !important;
                        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3) !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .invoice-delivery-date {
                        padding: 10px !important;
                        margin: 10px 0 !important;
                    }
                    
                    .invoice-delivery-date > div:first-child {
                        font-size: 0.75em !important;
                        margin-bottom: 5px !important;
                    }
                    
                    .invoice-delivery-date > div:last-child {
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
                        font-size: 0.85em !important;
                        page-break-inside: avoid !important;
                        background: #fff9e6 !important;
                        border: 1px solid #FFA500 !important;
                    }
                    
                    .invoice-terms h4 {
                        font-size: 1em !important;
                        margin-bottom: 6px !important;
                    }
                    
                    .invoice-terms ul {
                        padding-right: 20px !important;
                        line-height: 1.5 !important;
                        font-size: 0.9em !important;
                    }
                    
                    .invoice-terms li {
                        font-size: 0.9em !important;
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
                
                <!-- Invoice Details -->
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
                
               
                <!-- Device Info -->
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
                <div class="invoice-extra-info" style="margin-top: 10px;">
                    <div><strong>ملاحظات:</strong> ${repair.notes}</div>
                    </div>
                ` : ''}
                
                ${repair.status === 'delivered' && repair.delivered_at ? `
                <div class="invoice-extra-info" style="margin-top: 10px;">
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
                
                <!-- Terms & Conditions -->
                <div class="invoice-terms" style="margin-top: 30px; padding: 20px; background: #fff9e6; border: 2px solid var(--warning-color, #FFA500); border-radius: 8px;">
                    <h4 style="color: var(--warning-color, #FFA500); margin-bottom: 15px; font-size: 1.3em; font-weight: 700; text-align: center;">
                        <i class="bi bi-exclamation-triangle-fill" style="margin-left: 8px;"></i> شروط وأحكام مهمة
                    </h4>
                    <ul style="margin: 0; padding-right: 25px; color: var(--text-dark, #333); line-height: 2; font-size: 1.1em;">
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
        
        // ✅ التأكد من تحميل الصفحة
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

// ✅ استبدال دالة printRepairReceipt بالدالة الجديدة
window.printRepairReceipt = printRepairReceiptFromCustomerPage;


// إعداد event delegation لأزرار العملاء
function setupCustomerActionButtons() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    // إزالة event listeners السابقة لتجنب التكرار
    const existingHandler = tbody._customerActionHandler;
    if (existingHandler) {
        tbody.removeEventListener('click', existingHandler);
    }
    
    // إضافة event listener جديد
    const handler = function(e) {
        const button = e.target.closest('[data-action="view-profile"]');
        if (button) {
            e.preventDefault();
            e.stopPropagation();
            const customerId = button.getAttribute('data-customer-id');
            if (customerId) {
                try {
                    if (typeof viewCustomerProfile === 'function') {
                        viewCustomerProfile(customerId);
                    } else {
                        console.error('viewCustomerProfile function is not available');
                        showMessage('حدث خطأ في عرض البروفايل', 'error');
                    }
                } catch (error) {
                    console.error('Error calling viewCustomerProfile:', error);
                    showMessage('حدث خطأ في عرض البروفايل: ' + (error.message || 'خطأ غير معروف'), 'error');
                }
            }
        }
    };
    
    tbody._customerActionHandler = handler;
    tbody.addEventListener('click', handler);
}

// إعداد event delegation لأرقام الهواتف
function setupPhoneNumberClickHandlers() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    // إزالة event listeners السابقة لتجنب التكرار
    const existingHandler = tbody._phoneNumberHandler;
    if (existingHandler) {
        tbody.removeEventListener('click', existingHandler);
    }
    
    // إضافة event listener جديد
    const handler = function(e) {
        const phoneElement = e.target.closest('.phone-number-clickable');
        if (phoneElement) {
            e.preventDefault();
            e.stopPropagation();
            const phoneNumber = phoneElement.getAttribute('data-phone');
            if (phoneNumber) {
                try {
                    showPhoneActionModal(phoneNumber);
                } catch (error) {
                    console.error('Error showing phone action modal:', error);
                    showMessage('حدث خطأ في فتح نافذة الهاتف', 'error');
                }
            }
        }
    };
    
    tbody._phoneNumberHandler = handler;
    tbody.addEventListener('click', handler);
}

// عرض modal إجراءات الهاتف
function showPhoneActionModal(phoneNumber) {
    try {
        const modal = document.getElementById('phoneActionModal');
        const phoneDisplay = document.getElementById('phoneActionModalNumber');
        
        if (!modal || !phoneDisplay) {
            console.error('Phone action modal elements not found');
            showMessage('حدث خطأ في فتح نافذة الهاتف', 'error');
            return;
        }
        
        // تنظيف رقم الهاتف من أي مسافات أو أحرف خاصة
        const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
        
        // عرض رقم الهاتف
        phoneDisplay.textContent = cleanPhone;
        
        // حفظ رقم الهاتف في data attribute للاستخدام لاحقاً
        modal.setAttribute('data-phone', cleanPhone);
        
        // إظهار الـ modal
        modal.style.display = 'flex';
        
        // إضافة تأثير fade-in
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // إضافة event listener لإغلاق الـ modal عند النقر خارجها - معطل حسب الطلب
        // const closeOnOutsideClick = function(e) {
        //     if (e.target === modal) {
        //         closePhoneActionModal();
        //         modal.removeEventListener('click', closeOnOutsideClick);
        //     }
        // };
        // modal.addEventListener('click', closeOnOutsideClick);
        
        // إضافة event listener لإغلاق الـ modal عند الضغط على ESC
        const closeOnEscape = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closePhoneActionModal();
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    } catch (error) {
        console.error('Error in showPhoneActionModal:', error);
        showMessage('حدث خطأ في فتح نافذة الهاتف: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// إغلاق modal إجراءات الهاتف
function closePhoneActionModal() {
    try {
        const modal = document.getElementById('phoneActionModal');
        if (!modal) return;
        
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            // إزالة رقم الهاتف المحفوظ
            modal.removeAttribute('data-phone');
        }, 300);
    } catch (error) {
        console.error('Error closing phone action modal:', error);
    }
}

// نسخ رقم الهاتف
function copyPhoneNumber() {
    try {
        const modal = document.getElementById('phoneActionModal');
        if (!modal) {
            showMessage('حدث خطأ في نسخ الرقم', 'error');
            return;
        }
        
        const phoneNumber = modal.getAttribute('data-phone') || '';
        if (!phoneNumber) {
            showMessage('رقم الهاتف غير موجود', 'error');
            return;
        }
        
        // استخدام Clipboard API إذا كان متاحاً
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(phoneNumber).then(() => {
                showMessage('تم نسخ رقم الهاتف بنجاح', 'success');
            }).catch(() => {
                // Fallback: استخدام طريقة قديمة
                fallbackCopyToClipboard(phoneNumber);
            });
        } else {
            // Fallback: استخدام طريقة قديمة
            fallbackCopyToClipboard(phoneNumber);
        }
    } catch (error) {
        console.error('Error copying phone number:', error);
        showMessage('حدث خطأ في نسخ الرقم', 'error');
    }
}

// طريقة بديلة للنسخ (fallback)
function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showMessage('تم نسخ رقم الهاتف بنجاح', 'success');
        } else {
            showMessage('فشل نسخ الرقم. يرجى نسخه يدوياً', 'error');
        }
    } catch (error) {
        console.error('Fallback copy failed:', error);
        showMessage('فشل نسخ الرقم. يرجى نسخه يدوياً', 'error');
    }
}

// الاتصال برقم الهاتف
function callPhoneNumber() {
    try {
        const modal = document.getElementById('phoneActionModal');
        if (!modal) {
            showMessage('حدث خطأ في الاتصال', 'error');
            return;
        }
        
        const phoneNumber = modal.getAttribute('data-phone') || '';
        if (!phoneNumber) {
            showMessage('رقم الهاتف غير موجود', 'error');
            return;
        }
        
        // تنظيف الرقم وإزالة أي رموز خاصة
        const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        
        // استخدام tel: protocol للاتصال
        const telLink = `tel:${cleanPhone}`;
        window.location.href = telLink;
        
        // إغلاق الـ modal بعد محاولة الاتصال
        setTimeout(() => {
            closePhoneActionModal();
        }, 500);
    } catch (error) {
        console.error('Error calling phone number:', error);
        showMessage('حدث خطأ في الاتصال: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// التواصل عبر واتساب
function whatsappPhoneNumber() {
    try {
        const modal = document.getElementById('phoneActionModal');
        if (!modal) {
            showMessage('حدث خطأ في فتح واتساب', 'error');
            return;
        }
        
        const phoneNumber = modal.getAttribute('data-phone') || '';
        if (!phoneNumber) {
            showMessage('رقم الهاتف غير موجود', 'error');
            return;
        }
        
        // تنظيف الرقم وإزالة أي رموز خاصة
        let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
        
        // إزالة علامة + إذا كانت موجودة
        if (cleanPhone.startsWith('+')) {
            cleanPhone = cleanPhone.substring(1);
        }
        
        // إزالة أي أصفار في البداية (لأرقام محلية)
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        
        // استخدام WhatsApp Web API
        const whatsappUrl = `https://wa.me/${cleanPhone}`;
        window.open(whatsappUrl, '_blank');
        
        // إغلاق الـ modal بعد فتح واتساب
        setTimeout(() => {
            closePhoneActionModal();
        }, 500);
    } catch (error) {
        console.error('Error opening WhatsApp:', error);
        showMessage('حدث خطأ في فتح واتساب: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

// Expose functions to global scope for onclick handlers
window.validateStatementDates = validateStatementDates;
window.savePrintAccountStatement = savePrintAccountStatement;
window.showPrintAccountStatementModal = showPrintAccountStatementModal;
window.deleteCustomerFromProfile = deleteCustomerFromProfile;
window.applyBranchFilter = applyBranchFilter;
window.closePhoneActionModal = closePhoneActionModal;
window.copyPhoneNumber = copyPhoneNumber;
window.callPhoneNumber = callPhoneNumber;
window.whatsappPhoneNumber = whatsappPhoneNumber;


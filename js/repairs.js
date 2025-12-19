// إدارة عمليات الصيانة

let allRepairs = [];
let allUsers = []; // إضافة متغير لحفظ المستخدمين
let currentRepairPage = 1;
const repairsPerPage = 10;
let isScannerOpen = false; // متغير لتتبع حالة الماسح
let currentRepairType = 'soft'; // القسم النشط: soft, hard, fast

function loadRepairsSection() {
    // تحميل حالة إذن الكاميرا
    cameraPermissionGranted = localStorage.getItem('cameraPermissionGranted') === 'true';
    
    const section = document.getElementById('repairs-section');
    section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-tools"></i> عمليات الصيانة</h2>
            <div class="header-actions">
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
                <option value="pending">قيد الانتظار</option>
                <option value="in_progress">قيد الإصلاح</option>
                <option value="ready">جاهز</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">ملغي</option>
                <option value="lost">عمليات خاسرة</option>
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
                    
                    <h4 style="margin: 0 0 15px 0; color: #2196F3;">بيانات العميل</h4>
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

                    <h4 style="margin: 20px 0 15px 0; color: #2196F3;">بيانات الجهاز</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="deviceType">نوع الجهاز *</label>
                            <input type="text" id="deviceType" placeholder="مثال: iPhone, Samsung" required>
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
                            <span id="imageFileName" style="margin-right: 10px; font-size: 0.9em; color: #666;"></span>
                        </div>
                        <div id="imagePreview" style="margin-top: 10px;"></div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: #2196F3;">بيانات العملية</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="repairNumber">رقم العملية *</label>
                            <input type="text" id="repairNumber" required>
                        </div>
                        <div class="form-group">
                            <label>الفني المستلم</label>
                            <div class="technician-info" style="padding: 8px 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: #495057;">
                                <i class="bi bi-person-check"></i> <span id="currentTechnicianName">جاري التحميل...</span>
                            </div>
                        </div>
                    </div>

                    <h4 style="margin: 20px 0 15px 0; color: #2196F3;">التكاليف والدفع</h4>
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

                    <h4 style="margin: 20px 0 15px 0; color: #2196F3;">معلومات إضافية</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="deliveryDate">تاريخ التسليم المتوقع</label>
                            <input type="date" id="deliveryDate">
                        </div>
                        <div class="form-group">
                            <label for="status">الحالة</label>
                            <select id="status">
                                <option value="pending">قيد الانتظار</option>
                                <option value="in_progress">قيد الإصلاح</option>
                                <option value="ready">جاهز</option>
                                <option value="delivered">تم التسليم</option>
                                <option value="cancelled">ملغي</option>
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

    loadRepairs();
    searchTable('repairSearch', 'repairsTable');
    
    // تحديث اسم الفني المستلم في النموذج
    updateTechnicianName();
    
    // تهيئة القسم النشط
    switchRepairType(currentRepairType);
}

// تحديث اسم الفني المستلم في النموذج
function updateTechnicianName() {
    const currentUser = getCurrentUser();
    const technicianNameElement = document.getElementById('currentTechnicianName');
    
    if (technicianNameElement && currentUser) {
        technicianNameElement.textContent = currentUser.name;
    } else if (technicianNameElement) {
        technicianNameElement.textContent = 'غير محدد';
    }
}

async function loadRepairs() {
    try {
        const [repairsResult, usersResult, lossOperationsResult] = await Promise.all([
            API.getRepairs(),
            API.getUsers(),
            API.getLossOperations()
        ]);
        
        if (repairsResult.success) {
            allRepairs = repairsResult.data;
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
    const statusFilter = document.getElementById('statusFilter').value;
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

function showAddRepairModal() {
    document.getElementById('repairModalTitle').textContent = 'إضافة عملية صيانة جديدة';
    document.getElementById('repairForm').reset();
    document.getElementById('repairId').value = '';
    removeImage(); // مسح الصورة السابقة
    
    // تحديث اسم الفني المستلم
    updateTechnicianName();
    
    document.getElementById('repairModal').style.display = 'flex';
}

function closeRepairModal() {
    document.getElementById('repairModal').style.display = 'none';
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
            <img src="${base64Image}" style="max-width: 250px; max-height: 250px; border-radius: 10px; border: 2px solid #4CAF50; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
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

    // التحقق من الحقول المطلوبة
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const deviceType = document.getElementById('deviceType').value.trim();
    const problem = document.getElementById('problem').value.trim();
    const customerPrice = document.getElementById('customerPrice').value.trim();

    if (!customerName || !customerPhone || !deviceType || !problem || !customerPrice) {
        showMessage('جميع الحقول المطلوبة يجب أن تكون مملوءة', 'error');
        return;
    }

    const repairData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        device_type: deviceType,
        device_model: document.getElementById('deviceModel').value.trim(),
        serial_number: document.getElementById('serialNumber').value.trim(),
        accessories: document.getElementById('accessories').value.trim(),
        problem: problem,
        repair_type: document.getElementById('repairType').value,
        customer_price: parseFloat(customerPrice),
        repair_cost: parseFloat(document.getElementById('repairCost').value) || 0,
        parts_store: document.getElementById('partsStore').value.trim(),
        paid_amount: parseFloat(document.getElementById('paidAmount').value) || 0,
        remaining_amount: parseFloat(document.getElementById('remainingAmount').value) || 0,
        delivery_date: document.getElementById('deliveryDate').value,
        status: document.getElementById('status').value,
        notes: document.getElementById('notes').value.trim(),
        created_by: getCurrentUser()?.id || getCurrentUser()?.user_id || '' // تحديد الفني المستلم تلقائياً
    };

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
        
        // حفظ العميل تلقائياً إذا كانت عملية جديدة
        if (result.success) {
            await API.addCustomer({
                name: customerName,
                phone: customerPhone,
                address: ''
            });
        }
    }

    if (result.success) {
        showMessage(result.message);
        closeRepairModal();
        await loadRepairs();
        
        // تحديث لوحة التحكم دائماً (حتى لو كنا في قسم آخر)
        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }
    } else {
        showMessage(result.message, 'error');
    }
}

async function editRepair(id) {
    const repair = allRepairs.find(r => r.id === id);
    if (!repair) return;

    document.getElementById('repairModalTitle').textContent = 'تعديل عملية الصيانة';
    document.getElementById('repairId').value = repair.id;
    document.getElementById('customerName').value = repair.customer_name;
    document.getElementById('customerPhone').value = repair.customer_phone;
    document.getElementById('deviceType').value = repair.device_type;
    document.getElementById('deviceModel').value = repair.device_model || '';
    document.getElementById('serialNumber').value = repair.serial_number || '';
    document.getElementById('accessories').value = repair.accessories || '';
    document.getElementById('problem').value = repair.problem;
    document.getElementById('repairType').value = repair.repair_type || 'soft';
    document.getElementById('customerPrice').value = repair.customer_price || repair.cost || 0;
    document.getElementById('repairCost').value = repair.repair_cost || 0;
    document.getElementById('partsStore').value = repair.parts_store || '';
    document.getElementById('paidAmount').value = repair.paid_amount || 0;
    document.getElementById('remainingAmount').value = repair.remaining_amount || 0;
    document.getElementById('deliveryDate').value = repair.delivery_date || '';
    document.getElementById('status').value = repair.status;
    document.getElementById('notes').value = repair.notes || '';
    
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
    
    // تحديث اسم الفني المستلم
    updateTechnicianName();
    
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
        loadRepairs();
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
                    ${shopSettings.shop_logo ? `<div style="text-align: center; margin-bottom: 15px;"><img src="${shopSettings.shop_logo}" alt="شعار المحل" style="max-height: 60px; max-width: 200px;"></div>` : ''}
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
                    <h3>موعد الاستلام المتوقع</h3>
                    <p><strong>التاريخ:</strong> ${formatDate(repair.delivery_date)  || '-'}</p>
                </div>
                <div class="receipt-section"><h3>ملاحظات</h3><p>${repair.notes}</p></div>
                
                ${await checkAndShowImage(repair.id) ? `<div class="receipt-section">
                    <h3>صورة الجهاز</h3>
                    <div style="text-align: center; margin: 10px 0;">
                        <img src="${API.getImagePath(repair.id)}" alt="صورة الجهاز" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                </div>` : ''}
                
                <div class="receipt-footer">
                    <p>شكراً لثقتكم</p>
                    ${repair.status === 'delivered' && repair.delivered_at ? `<p><small>تاريخ التسليم: ${formatDateTime(repair.delivered_at)}</small></p>` : ''}
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
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
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    طباعة
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
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    طباعة
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
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    طباعة
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
function openBarcodeScanner() {
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
    
    // التحقق من توفر الكاميرا
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMessage('الكاميرا غير متوفرة في هذا المتصفح', 'error');
        return;
    }
    
    // تعيين حالة الماسح كمفتوح
    isScannerOpen = true;
    
    console.log('فتح قارئ الباركود');
    
    const scannerModal = document.createElement('div');
    scannerModal.id = 'barcodeScannerModal'; // إضافة ID لسهولة التحقق
    scannerModal.className = 'modal';
    scannerModal.style.display = 'flex';
    scannerModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2><i class="bi bi-upc-scan"></i> قارئ الباركود</h2>
                <button onclick="closeBarcodeScanner()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div id="barcode-scanner-container" style="text-align: center;">
                    <div id="scanner-area" style="width: 100%; height: 300px; background: #f0f0f0; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; position: relative;">
                        <p>جاري تحميل قارئ الباركود...</p>
                    </div>
                    <div id="scanner-result" style="margin-top: 20px; display: none;">
                        <div class="alert alert-success">
                            <h4><i class="bi bi-check-circle"></i> تم العثور على الباركود!</h4>
                            <p><strong>رقم العملية:</strong> <span id="scanned-repair-number"></span></p>
                            <button onclick="searchRepairByNumber()" class="btn btn-primary">
                                <i class="bi bi-search"></i> البحث عن العملية
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="retryBarcodeScanner()" class="btn btn-warning">
                    <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                </button>
                <button onclick="closeBarcodeScanner()" class="btn btn-secondary">إغلاق</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(scannerModal);
    
    // بدء تشغيل قارئ الباركود مع تأخير لضمان تحميل العناصر
    setTimeout(() => {
        initializeBarcodeScanner();
    }, 200);
    
    // إضافة مراقب لضمان عدم إغلاق النافذة أثناء تشغيل الكاميرا
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // منع إغلاق النافذة بالضغط خارجها أثناء تشغيل الكاميرا
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
}

function initializeBarcodeScanner() {
    const scannerArea = document.getElementById('scanner-area');
    if (!scannerArea) return;

    // إضافة مؤشر التحميل
    scannerArea.innerHTML = '<div class="scanner-loading"><i class="bi bi-camera"></i> جاري تحميل الكاميرا...</div>';

    // التحقق من توفر Quagga
    if (typeof Quagga === 'undefined') {
        scannerArea.innerHTML = '<div class="scanner-error"><i class="bi bi-exclamation-triangle"></i> خطأ: مكتبة الباركود غير محملة</div>';
        return;
    }

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
                    scannerArea.innerHTML = `<div class="scanner-loading"><i class="bi bi-camera"></i> إعادة المحاولة ${attempts}/${maxAttempts}...</div>`;
                    
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
                        <div class="scanner-error">
                            <i class="bi bi-exclamation-triangle"></i>
                            <h4>خطأ في تشغيل الكاميرا</h4>
                            <p>تأكد من:</p>
                            <ul style="text-align: right; margin: 10px 0;">
                                <li>منح إذن الوصول للكاميرا</li>
                                <li>استخدام HTTPS</li>
                                <li>وجود كاميرا خلفية</li>
                            </ul>
                            <button onclick="retryBarcodeScanner()" class="btn btn-primary">
                                <i class="bi bi-arrow-clockwise"></i> إعادة المحاولة
                            </button>
                        </div>
                    `;
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
                    top: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 12px;
                    z-index: 1000;
                `;
                scanIndicator.innerHTML = '<i class="bi bi-upc-scan"></i> امسح الباركود';
                scannerArea.appendChild(scanIndicator);
                
                // إضافة مؤشر الاستقرار
                const stabilityIndicator = document.createElement('div');
                stabilityIndicator.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(0,255,0,0.7);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 12px;
                    z-index: 1000;
                `;
                stabilityIndicator.innerHTML = '<i class="bi bi-camera-video"></i> الكاميرا نشطة';
                scannerArea.appendChild(stabilityIndicator);
                
                // تم إزالة مراقب الاستقرار لتجنب الحلقة اللانهائية
                console.log('تم تشغيل قارئ الباركود بنجاح');
                
            } catch (startError) {
                console.error('خطأ في بدء الماسح:', startError);
                scannerArea.innerHTML = '<div class="scanner-error">خطأ في بدء الماسح</div>';
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
                    document.getElementById('scanned-repair-number').textContent = code;
                    document.getElementById('scanner-result').style.display = 'block';
                    document.getElementById('scanner-result').innerHTML = `
                        <div class="alert alert-warning">
                            <h4><i class="bi bi-exclamation-triangle"></i> لم يتم العثور على العملية</h4>
                            <p><strong>رقم العملية:</strong> <span id="scanned-repair-number">${code}</span></p>
                            <p>لم يتم العثور على عملية بهذا الرقم في النظام.</p>
                            <button onclick="closeBarcodeScanner()" class="btn btn-secondary">
                                <i class="bi bi-x"></i> إغلاق
                            </button>
                        </div>
                    `;
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
            await loadRepairs();
            
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


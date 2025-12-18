// إدارة المخزون

let allInventory = [];
let currentInventoryPage = 1;
const inventoryPerPage = 10;

function loadInventorySection() {
    const section = document.getElementById('inventory-section');
    section.innerHTML = `
        <div class="section-header">
            <h2><i class="bi bi-box-seam"></i> المخزون</h2>
            <button onclick="showAddInventoryModal()" class="btn btn-primary"><i class="bi bi-plus-circle"></i> إضافة قطعة غيار</button>
        </div>

        <div class="filters-bar">
            <input type="text" id="inventorySearch" placeholder="بحث..." class="search-input">
        </div>

        <div class="table-container">
            <table class="data-table" id="inventoryTable">
                <thead>
                    <tr>
                        <th>اسم القطعة</th>
                        <th>الفئة</th>
                        <th>الكمية</th>
                        <th>سعر الشراء</th>
                        <th>سعر البيع</th>
                        <th>تاريخ الإضافة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="inventoryTableBody"></tbody>
            </table>
        </div>

        <div class="pagination" id="inventoryPagination"></div>

        <!-- نموذج إضافة/تعديل قطعة غيار -->
        <div id="inventoryModal" class="modal">
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="inventoryModalTitle">إضافة قطعة غيار</h3>
                    <button onclick="closeInventoryModal()" class="btn-close">&times;</button>
                </div>
                <form id="inventoryForm" onsubmit="saveInventoryItem(event)">
                    <input type="hidden" id="itemId">
                    
                    <div class="form-group">
                        <label for="itemName">اسم القطعة *</label>
                        <input type="text" id="itemName" required>
                    </div>

                    <div class="form-group">
                        <label for="itemCategory">الفئة</label>
                        <input type="text" id="itemCategory" placeholder="مثال: شاشات، بطاريات">
                    </div>

                    <div class="form-group">
                        <label for="itemQuantity">الكمية *</label>
                        <input type="number" id="itemQuantity" min="0" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="purchasePrice">سعر الشراء</label>
                            <input type="number" id="purchasePrice" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label for="sellingPrice">سعر البيع</label>
                            <input type="number" id="sellingPrice" step="0.01" min="0">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" onclick="closeInventoryModal()" class="btn btn-secondary">إلغاء</button>
                        <button type="submit" class="btn btn-primary">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    loadInventory();
    searchTable('inventorySearch', 'inventoryTable');
    hideByPermission();
}

async function loadInventory() {
    const result = await API.getInventory();
    if (result.success) {
        allInventory = result.data;
        displayInventory(allInventory);
    }
}

function displayInventory(inventory) {
    const paginated = paginate(inventory, currentInventoryPage, inventoryPerPage);
    const tbody = document.getElementById('inventoryTableBody');

    if (paginated.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد قطع غيار</td></tr>';
        return;
    }

    tbody.innerHTML = paginated.data.map(item => {
        const isLowStock = item.quantity <= 5;
        return `
        <tr ${isLowStock ? 'class="low-stock"' : ''}>
            <td><strong>${item.name}</strong> ${isLowStock ? '<span class="badge badge-warning">كمية منخفضة</span>' : ''}</td>
            <td>${item.category || '-'}</td>
            <td><strong>${item.quantity}</strong></td>
            <td>${formatCurrency(item.purchase_price || 0)}</td>
            <td>${formatCurrency(item.selling_price || 0)}</td>
            <td>${formatDate(item.created_at)}</td>
            <td>
                <button onclick="editInventoryItem('${item.id}')" class="btn btn-sm btn-icon" title="تعديل"><i class="bi bi-pencil-square"></i></button>
                <button onclick="deleteInventoryItem('${item.id}')" class="btn btn-sm btn-icon" title="حذف" data-permission="manager"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `}).join('');

    createPaginationButtons(
        document.getElementById('inventoryPagination'),
        paginated.totalPages,
        currentInventoryPage,
        (page) => {
            currentInventoryPage = page;
            displayInventory(allInventory);
        }
    );

    hideByPermission();
}

function showAddInventoryModal() {
    document.getElementById('inventoryModalTitle').textContent = 'إضافة قطعة غيار';
    document.getElementById('inventoryForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('inventoryModal').style.display = 'flex';
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').style.display = 'none';
}

async function saveInventoryItem(event) {
    event.preventDefault();

    // التحقق من الحقول المطلوبة
    const name = document.getElementById('itemName').value.trim();
    const quantity = document.getElementById('itemQuantity').value.trim();

    if (!name || !quantity) {
        showMessage('اسم القطعة والكمية مطلوبان', 'error');
        return;
    }

    const itemData = {
        name: name,
        category: document.getElementById('itemCategory').value.trim(),
        quantity: parseInt(quantity),
        purchase_price: parseFloat(document.getElementById('purchasePrice').value) || 0,
        selling_price: parseFloat(document.getElementById('sellingPrice').value) || 0
    };

    const itemId = document.getElementById('itemId').value;
    let result;

    if (itemId) {
        itemData.id = itemId;
        result = await API.updateInventoryItem(itemData);
    } else {
        result = await API.addInventoryItem(itemData);
    }

    if (result.success) {
        showMessage(result.message);
        closeInventoryModal();
        loadInventory();
    } else {
        showMessage(result.message, 'error');
    }
}

async function editInventoryItem(id) {
    const item = allInventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('inventoryModalTitle').textContent = 'تعديل قطعة الغيار';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('purchasePrice').value = item.purchase_price || 0;
    document.getElementById('sellingPrice').value = item.selling_price || 0;
    
    document.getElementById('inventoryModal').style.display = 'flex';
}

async function deleteInventoryItem(id) {
    if (!hasPermission('manager')) {
        showMessage('ليس لديك صلاحية للحذف', 'error');
        return;
    }

    if (!confirmAction('هل أنت متأكد من حذف هذه القطعة؟')) return;

    const result = await API.deleteInventoryItem(id);
    if (result.success) {
        showMessage(result.message);
        loadInventory();
    } else {
        showMessage(result.message, 'error');
    }
}


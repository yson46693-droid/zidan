// ✅ دالة لفتح modal اختيار القطع الفرعية لقطع الغيار
async function openSparePartRequestModal(partId, partName) {
    try {
        // البحث عن قطعة الغيار
        const part = typeof allSpareParts !== 'undefined' ? allSpareParts.find(p => p.id === partId) : null;
        if (!part || !part.items || part.items.length === 0) {
            showMessage('لا توجد قطع فرعية متوفرة', 'error');
            return;
        }
        
        // إنشاء modal
        const existingModal = document.getElementById('sparePartRequestModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'sparePartRequestModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        // الحصول على أنواع قطع الغيار (من inventory.js إذا كان متاحاً)
        let sparePartTypesList = [];
        if (typeof sparePartTypes !== 'undefined') {
            sparePartTypesList = sparePartTypes;
        } else {
            // Fallback: قائمة أساسية
            sparePartTypesList = [
                { id: 'screen', name: 'شاشة', icon: 'bi-display' },
                { id: 'touch', name: 'تاتش', icon: 'bi-display' },
                { id: 'battery', name: 'بطارية', icon: 'bi-battery-full' },
                { id: 'rear_camera', name: 'كاميرا خلفية', icon: 'bi-camera' },
                { id: 'front_camera', name: 'كاميرا أمامية', icon: 'bi-camera-video' },
                { id: 'charging_port', name: 'فلاتة شحن', icon: 'bi-usb-c' },
                { id: 'speaker', name: 'علبة جرس', icon: 'bi-speaker' },
                { id: 'housing', name: 'هاوسنج', icon: 'bi-box' },
                { id: 'other', name: 'ملحقات أخرى', icon: 'bi-three-dots-vertical' }
            ];
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>طلب قطع من: ${partName}</h3>
                    <button onclick="closeSparePartRequestModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: var(--text-light);">اختر القطع المطلوبة وحدد الكمية لكل قطعة:</p>
                    <div id="sparePartRequestItemsList" style="display: flex; flex-direction: column; gap: 15px;">
                        ${part.items.map((item, index) => {
                            const type = sparePartTypesList.find(t => t.id === item.item_type);
                            const itemName = type ? type.name : (item.item_type || 'غير محدد');
                            const availableQuantity = parseInt(item.quantity || 0);
                            return `
                                <div class="request-item-row" style="padding: 15px; background: var(--light-bg); border-radius: 8px; border: 1px solid var(--border-color);">
                                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                                        <div style="font-size: 24px; color: var(--primary-color);">
                                            <i class="bi ${type ? type.icon : 'bi-circle'}"></i>
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="font-weight: 600; font-size: 1.1em; color: var(--text-dark); margin-bottom: 5px;">${itemName}</div>
                                            ${item.custom_value ? `<div style="font-size: 0.9em; color: var(--text-light);">${item.custom_value}</div>` : ''}
                                            <div style="font-size: 0.85em; color: var(--text-light); margin-top: 5px;">
                                                متوفر: <strong style="color: var(--primary-color);">${availableQuantity}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <label style="font-weight: 500; color: var(--text-dark); white-space: nowrap;">الكمية المطلوبة:</label>
                                        <input 
                                            type="number" 
                                            class="request-item-quantity" 
                                            data-item-index="${index}"
                                            min="0" 
                                            max="${availableQuantity}"
                                            value="0" 
                                            style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 1em;"
                                            onchange="updateSparePartRequestTotal()"
                                        />
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div id="sparePartRequestTotal" style="margin-top: 20px; padding: 15px; background: var(--primary-color); color: var(--white); border-radius: 8px; text-align: center; font-weight: 600; font-size: 1.1em;">
                        إجمالي القطع المختارة: <span id="totalSelectedCount">0</span>
                    </div>
                    <div style="margin-top: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">ملاحظات (اختياري):</label>
                        <textarea 
                            id="sparePartRequestNotes" 
                            rows="3" 
                            style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.95em; resize: vertical;"
                            placeholder="أدخل أي ملاحظات إضافية..."
                        ></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="closeSparePartRequestModal()" class="btn btn-secondary">إلغاء</button>
                    <button onclick="submitSparePartRequest('${partId}', '${partName.replace(/'/g, "\\'")}')" class="btn btn-primary" id="submitSparePartRequestBtn" disabled>
                        <i class="bi bi-send"></i> إرسال الطلب
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إغلاق عند النقر خارج الـ modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSparePartRequestModal();
            }
        });
        
        // تحديث العدد الإجمالي
        updateSparePartRequestTotal();
        
    } catch (error) {
        console.error('خطأ في فتح modal طلب قطع الغيار:', error);
        showMessage('حدث خطأ أثناء فتح النموذج', 'error');
    }
}

// ✅ دالة لتحديث العدد الإجمالي للقطع المختارة
function updateSparePartRequestTotal() {
    try {
        const quantityInputs = document.querySelectorAll('.request-item-quantity');
        let total = 0;
        
        quantityInputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            total += qty;
        });
        
        const totalCountElement = document.getElementById('totalSelectedCount');
        const submitBtn = document.getElementById('submitSparePartRequestBtn');
        
        if (totalCountElement) {
            totalCountElement.textContent = total;
        }
        
        if (submitBtn) {
            submitBtn.disabled = total === 0;
            submitBtn.style.opacity = total === 0 ? '0.5' : '1';
            submitBtn.style.cursor = total === 0 ? 'not-allowed' : 'pointer';
        }
    } catch (error) {
        console.error('خطأ في تحديث العدد الإجمالي:', error);
    }
}

// ✅ دالة لإغلاق modal طلب قطع الغيار
function closeSparePartRequestModal() {
    const modal = document.getElementById('sparePartRequestModal');
    if (modal) {
        modal.remove();
    }
}

// ✅ دالة لإرسال طلب قطع الغيار
async function submitSparePartRequest(partId, partName) {
    try {
        const quantityInputs = document.querySelectorAll('.request-item-quantity');
        const selectedItems = [];
        
        // جمع القطع المختارة
        const part = typeof allSpareParts !== 'undefined' ? allSpareParts.find(p => p.id === partId) : null;
        if (!part || !part.items) {
            showMessage('خطأ في البيانات', 'error');
            return;
        }
        
        quantityInputs.forEach((input, index) => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0 && part.items[index]) {
                selectedItems.push({
                    item_type: part.items[index].item_type,
                    quantity: qty,
                    custom_value: part.items[index].custom_value || null
                });
            }
        });
        
        if (selectedItems.length === 0) {
            showMessage('الرجاء اختيار قطعة واحدة على الأقل', 'error');
            return;
        }
        
        const notes = document.getElementById('sparePartRequestNotes')?.value?.trim() || '';
        
        // إرسال الطلب
        const result = await API.request('inventory-requests.php', 'POST', {
            item_type: 'spare_part',
            item_id: partId,
            item_name: partName,
            items: selectedItems,
            notes: notes
        });
        
        if (result && result.success) {
            showMessage('تم إرسال الطلب بنجاح', 'success');
            closeSparePartRequestModal();
        } else {
            showMessage(result?.message || 'حدث خطأ أثناء إرسال الطلب', 'error');
        }
    } catch (error) {
        console.error('خطأ في إرسال طلب قطع الغيار:', error);
        showMessage('حدث خطأ أثناء إرسال الطلب', 'error');
    }
}

// ✅ دالة لطلب منتج من الفرع الأول
async function requestInventoryItem(itemType, itemId, itemName) {
    try {
        // التحقق من الصلاحيات
        if (!canRequestInventoryItem()) {
            showMessage('ليس لديك صلاحية لطلب المنتجات', 'error');
            return;
        }
        
        // إذا كانت قطعة غيار، فتح modal اختيار القطع الفرعية
        if (itemType === 'spare_part') {
            await openSparePartRequestModal(itemId, itemName);
            return;
        }
        
        // للمنتجات الأخرى (إكسسوارات، هواتف)، استخدام الطريقة القديمة
        // طلب الكمية من المستخدم
        const quantityInput = await showInputPrompt('أدخل الكمية المطلوبة:', '1', 'number');
        if (!quantityInput || quantityInput.trim() === '') {
            return; // المستخدم ألغى العملية
        }
        
        const quantity = parseInt(quantityInput);
        if (isNaN(quantity) || quantity <= 0) {
            showMessage('الكمية يجب أن تكون رقماً صحيحاً أكبر من الصفر', 'error');
            return;
        }
        
        // طلب ملاحظات اختيارية
        const notes = await showInputPrompt('ملاحظات (اختياري):', '', 'text');
        const notesValue = notes ? notes.trim() : '';
        
        // تحويل نوع المنتج إلى الصيغة المطلوبة في API
        let apiItemType = itemType;
        if (itemType === 'accessory') {
            apiItemType = 'accessory';
        } else if (itemType === 'phone') {
            apiItemType = 'inventory'; // الهواتف تعامل مع inventory في API
        }
        
        // إرسال الطلب
        const result = await API.request('inventory-requests.php', 'POST', {
            item_type: apiItemType,
            item_id: itemId,
            item_name: itemName,
            quantity: quantity,
            notes: notesValue
        });
        
        if (result && result.success) {
            showMessage('تم إرسال الطلب بنجاح', 'success');
        } else {
            showMessage(result?.message || 'حدث خطأ أثناء إرسال الطلب', 'error');
        }
    } catch (error) {
        console.error('خطأ في طلب المنتج:', error);
        showMessage('حدث خطأ أثناء إرسال الطلب', 'error');
    }
}

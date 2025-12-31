// ✅ دالة لعرض تفاصيل المنتج (بدون تكاليف) للمستخدمين من الفرع الثاني
async function showInventoryItemDetails(itemType, itemId) {
    try {
        let item = null;
        let itemName = '';
        let details = '';
        
        // جلب بيانات المنتج حسب النوع
        if (itemType === 'spare_part') {
            item = allSpareParts.find(p => p.id === itemId);
            if (!item) {
                showMessage('المنتج غير موجود', 'error');
                return;
            }
            itemName = `${item.brand} ${item.model}`;
            
            // بناء التفاصيل (بدون تكاليف)
            details = `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الماركة</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.brand || 'غير محدد'}</div>
                    </div>
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الموديل</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.model || 'غير محدد'}</div>
                    </div>
                    ${item.barcode ? `
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الباركود</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.barcode}</div>
                    </div>
                    ` : ''}
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الكمية المتوفرة</label>
                        <div style="font-size: 1.5em; color: var(--primary-color); font-weight: bold;">
                            ${(() => {
                                const totalQuantity = (item.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                                return totalQuantity;
                            })()}
                        </div>
                    </div>
                    ${(item.items || []).length > 0 ? `
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 12px;">تفاصيل القطع والأسعار</label>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${item.items.map(itemDetail => {
                                const typeName = sparePartTypes.find(t => t.id === itemDetail.item_type)?.name || itemDetail.item_type || 'غير محدد';
                                const sellingPrice = itemDetail.selling_price || itemDetail.price || 0;
                                return `
                                    <div style="padding: 12px; background: var(--white); border-radius: 6px; border: 1px solid var(--border-color);">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <div style="font-weight: 600; color: var(--text-dark); margin-bottom: 4px;">${typeName}</div>
                                                <div style="font-size: 0.9em; color: var(--text-light);">الكمية: ${itemDetail.quantity || 0}</div>
                                            </div>
                                            <div style="font-size: 1.2em; font-weight: bold; color: var(--success-color);">
                                                ${sellingPrice.toFixed(2)} ج.م
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else if (itemType === 'accessory') {
            // البحث في الإكسسوارات
            item = allAccessories.find(a => a.id === itemId);
            if (!item) {
                showMessage('المنتج غير موجود', 'error');
                return;
            }
            itemName = item.name || 'إكسسوار';
            
            details = `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الاسم</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.name || 'غير محدد'}</div>
                    </div>
                    ${item.type ? `
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">النوع</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">
                            ${accessoryTypes.find(t => t.id === item.type)?.name || item.type || 'غير محدد'}
                        </div>
                    </div>
                    ` : ''}
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الكمية المتوفرة</label>
                        <div style="font-size: 1.5em; color: var(--primary-color); font-weight: bold;">${item.quantity || 0}</div>
                    </div>
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">سعر البيع</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);">
                            ${(item.selling_price || item.price || 0).toFixed(2)} ج.م
                        </div>
                    </div>
                </div>
            `;
        } else if (itemType === 'phone') {
            // البحث في الهواتف
            item = allPhones.find(p => p.id === itemId);
            if (!item) {
                showMessage('المنتج غير موجود', 'error');
                return;
            }
            itemName = `${item.brand} ${item.model}`;
            
            details = `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الماركة</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.brand || 'غير محدد'}</div>
                    </div>
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الموديل</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.model || 'غير محدد'}</div>
                    </div>
                    ${item.storage ? `
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">سعة التخزين</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.storage}</div>
                    </div>
                    ` : ''}
                    ${item.color ? `
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">اللون</label>
                        <div style="font-size: 1.1em; color: var(--text-dark); font-weight: 500;">${item.color}</div>
                    </div>
                    ` : ''}
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">الكمية المتوفرة</label>
                        <div style="font-size: 1.5em; color: var(--primary-color); font-weight: bold;">${item.quantity || 0}</div>
                    </div>
                    <div class="detail-item" style="padding: 15px; background: var(--light-bg); border-radius: 8px;">
                        <label style="font-weight: 600; color: var(--text-light); font-size: 0.9em; display: block; margin-bottom: 8px;">سعر البيع</label>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--success-color);">
                            ${(item.selling_price || item.price || 0).toFixed(2)} ج.م
                        </div>
                    </div>
                </div>
            `;
        } else {
            showMessage('نوع المنتج غير معروف', 'error');
            return;
        }
        
        // إنشاء modal للتفاصيل
        const existingModal = document.getElementById('inventoryItemDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const detailsModal = document.createElement('div');
        detailsModal.id = 'inventoryItemDetailsModal';
        detailsModal.className = 'modal';
        detailsModal.style.display = 'flex';
        
        detailsModal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>تفاصيل المنتج: ${itemName}</h3>
                    <button onclick="closeInventoryItemDetailsModal()" class="btn-close">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    ${details}
                </div>
                <div class="modal-footer" style="padding: 20px 25px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="closeInventoryItemDetailsModal()" class="btn btn-secondary">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailsModal);
        
        // إغلاق modal عند النقر خارجها
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                closeInventoryItemDetailsModal();
            }
        });
        
    } catch (error) {
        console.error('خطأ في عرض تفاصيل المنتج:', error);
        showMessage('حدث خطأ أثناء عرض التفاصيل', 'error');
    }
}

// ✅ دالة لإغلاق modal التفاصيل
function closeInventoryItemDetailsModal() {
    const modal = document.getElementById('inventoryItemDetailsModal');
    if (modal) {
        modal.remove();
    }
}

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
            
            // ✅ عرض تفاصيل القطع والأسعار بنفس طريقة previewSparePart (مع الأيقونات والعرض الشبكي) للجميع
            details = `
                <div class="preview-modal-body" style="padding: 0;">
                    <div class="preview-items-grid">
                        ${(item.items || []).length > 0 ? (item.items || []).map(itemDetail => {
                            const type = (typeof sparePartTypes !== 'undefined' && sparePartTypes) ? sparePartTypes.find(t => t.id === itemDetail.item_type) : null;
                            const sellingPrice = parseFloat(itemDetail.selling_price || itemDetail.price || 0) || 0;
                            const formatPrice = (typeof formatCurrency === 'function') ? formatCurrency(sellingPrice) : (typeof window.formatCurrency === 'function' ? window.formatCurrency(sellingPrice) : (sellingPrice.toFixed(2) + ' ج.م'));
                            return `
                                <div class="preview-item">
                                    <div class="preview-item-icon"><i class="bi ${type ? type.icon : 'bi-circle'}"></i></div>
                                    <div class="preview-item-name">${type ? type.name : (itemDetail.item_type || 'غير محدد')}</div>
                                    <div class="preview-item-quantity">الكمية: ${itemDetail.quantity ?? 0}</div>
                                    ${sellingPrice > 0 ? `<div class="preview-item-price" style="color: var(--primary-color); font-weight: bold; margin-top: 5px;">السعر: ${formatPrice}</div>` : ''}
                                    ${itemDetail.custom_value ? `<div class="preview-item-custom" style="margin-top: 5px; font-size: 0.85em; color: var(--text-light);">${itemDetail.custom_value}</div>` : ''}
                                </div>
                            `;
                        }).join('') : `
                            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                                <i class="bi bi-inbox" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                                <div>لا توجد قطع متوفرة</div>
                            </div>
                        `}
                    </div>
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
                            ${(parseFloat(item.selling_price || item.price || 0) || 0).toFixed(2)} ج.م
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
                            ${(parseFloat(item.selling_price || item.price || 0) || 0).toFixed(2)} ج.م
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
        
        // إغلاق modal عند النقر خارجها - معطل حسب الطلب
        // detailsModal.addEventListener('click', (e) => {
        //     if (e.target === detailsModal) {
        //         closeInventoryItemDetailsModal();
        //     }
        // });
        
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

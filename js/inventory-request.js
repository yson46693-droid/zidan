// ✅ دالة لطلب منتج من الفرع الأول
async function requestInventoryItem(itemType, itemId, itemName) {
    try {
        // التحقق من الصلاحيات
        if (!canRequestInventoryItem()) {
            showMessage('ليس لديك صلاحية لطلب المنتجات', 'error');
            return;
        }
        
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
        if (itemType === 'spare_part') {
            apiItemType = 'spare_part';
        } else if (itemType === 'accessory') {
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

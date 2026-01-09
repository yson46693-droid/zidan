<?php
// تنظيف output buffer قبل أي شيء
if (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

/**
 * التحقق من صلاحيات استرجاع المنتجات
 * @return bool
 */
function checkProductReturnsPermission() {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    // المالك له كامل الصلاحيات
    if ($userRole === 'admin') {
        return true;
    }
    
    // المدير في الفرع الأول
    if ($userRole === 'manager' && !$userBranchId) {
        return true;
    }
    
    // جميع الموظفين مسموح لهم
    if ($userRole === 'employee') {
        return true;
    }
    
    return false;
}

/**
 * توليد ID مبسط للهواتف (أقصر من generateId)
 * @return string - ID مبسط
 */
function generateSimplePhoneId() {
    // استخدام timestamp + رقم عشوائي قصير - الحد الأقصى 50 حرف
    // PH (2) + timestamp (10) + random (4) = 16 حرف فقط
    $timestamp = time();
    $random = rand(1000, 9999);
    return 'PH' . $timestamp . $random;
}

/**
 * استخراج نوع القطعة من اسم المنتج
 * @param string $itemName - اسم المنتج
 * @return string|null - نوع القطعة أو null إذا لم يتم التعرف عليه
 */
function extractItemTypeFromName($itemName) {
    // خريطة الأنواع العربية إلى الإنجليزية
    $typeMap = [
        'شاشة' => 'screen',
        'بطارية' => 'battery',
        'كاميرا خلفية' => 'rear_camera',
        'كاميرا أمامية' => 'front_camera',
        'فلاتة شحن' => 'charging_port',
        'فلاتة ربط' => 'flex_connector',
        'فلاتة باور' => 'power_flex',
        'بوردة' => 'motherboard',
        'فريم' => 'frame',
        'هاوسنج' => 'housing',
        'ظهر' => 'back_cover',
        'عدسات' => 'lens',
        'ic' => 'ic',
        'أزرار خارجية' => 'external_buttons',
        'سماعة مكالمات' => 'earpiece',
        'علبة جرس' => 'speaker',
        'واير شبكة' => 'network_wire',
        'فلاتة شبكة' => 'network_flex',
        'ملحقات أخرى' => 'other'
    ];
    
    // البحث عن نوع القطعة في اسم المنتج
    $itemNameLower = mb_strtolower($itemName, 'UTF-8');
    
    foreach ($typeMap as $arabicName => $englishType) {
        if (mb_strpos($itemNameLower, mb_strtolower($arabicName, 'UTF-8')) !== false) {
            error_log('🔍 تم استخراج نوع القطعة من الاسم: ' . $englishType . ' من "' . $itemName . '"');
            return $englishType;
        }
    }
    
    // البحث عن الأنواع الإنجليزية مباشرة
    $englishTypes = array_values($typeMap);
    foreach ($englishTypes as $type) {
        if (stripos($itemName, $type) !== false) {
            error_log('🔍 تم استخراج نوع القطعة من الاسم (إنجليزي): ' . $type . ' من "' . $itemName . '"');
            return $type;
        }
    }
    
    return null;
}

/**
 * إضافة منتج مرتجع إلى المخزن
 * @param array $item - بيانات المنتج المرتجع
 * @param int $quantity - الكمية المراد إضافتها
 * @return bool
 */
function addReturnedItemToInventory($item, $quantity) {
    try {
        $itemType = $item['item_type'];
        $itemId = $item['item_id'];
        $itemName = $item['item_name'];
        $unitPrice = floatval($item['unit_price'] ?? 0);
        
        if ($itemType === 'spare_part') {
            // التحقق من وجود spare_part أولاً
            $sparePart = dbSelectOne("SELECT id FROM spare_parts WHERE id = ?", [$itemId]);
            
            if (!$sparePart) {
                error_log('تحذير: قطعة الغيار غير موجودة: ' . $itemId);
                return false;
            }
            
            // محاولة قراءة spare_part_item_id و item_type من notes إذا كان موجوداً
            $sparePartItemId = null;
            $itemTypeToAdd = 'original'; // القيمة الافتراضية
            $notesData = null;
            
            if (!empty($item['notes'])) {
                $notesData = json_decode($item['notes'], true);
                if (is_array($notesData)) {
                    if (isset($notesData['spare_part_item_id']) && !empty($notesData['spare_part_item_id'])) {
                        $sparePartItemId = trim($notesData['spare_part_item_id']);
                        error_log('📋 تم قراءة spare_part_item_id من notes: ' . $sparePartItemId);
                    }
                    if (isset($notesData['item_type']) && !empty($notesData['item_type'])) {
                        $itemTypeToAdd = trim($notesData['item_type']);
                        error_log('📋 تم قراءة item_type من notes: ' . $itemTypeToAdd);
                    }
                } else {
                    error_log('⚠️ notes موجود لكن غير صالح JSON: ' . substr($item['notes'], 0, 100));
                }
            } else {
                error_log('⚠️ لا يوجد notes في sale_item - قد تكون الفاتورة قديمة');
                // محاولة استخراج نوع القطعة من اسم المنتج
                $extractedType = extractItemTypeFromName($itemName);
                if ($extractedType) {
                    $itemTypeToAdd = $extractedType;
                    error_log('✅ تم استخراج item_type من اسم المنتج: ' . $itemTypeToAdd);
                } else {
                    error_log('⚠️ لم يتم التعرف على نوع القطعة من اسم المنتج: ' . $itemName);
                }
            }
            
            // إذا كان هناك spare_part_item_id محدد، نبحث عن العنصر ونضيف الكمية إليه
            if ($sparePartItemId) {
                error_log('🔍 البحث عن spare_part_item بالـ ID: ' . $sparePartItemId . ' في spare_part: ' . $itemId);
                $existingItem = dbSelectOne(
                    "SELECT id, quantity, item_type FROM spare_part_items WHERE id = ? AND spare_part_id = ?",
                    [$sparePartItemId, $itemId]
                );
                
                if ($existingItem) {
                    // العنصر موجود - إضافة الكمية إليه
                    $currentQuantity = intval($existingItem['quantity'] ?? 0);
                    $newQuantity = $currentQuantity + $quantity;
                    $actualItemType = $existingItem['item_type'] ?? 'original';
                    
                    error_log('✅ تم العثور على spare_part_item: ID=' . $existingItem['id'] . ', item_type=' . $actualItemType . ', الكمية الحالية=' . $currentQuantity);
                    
                    // تحديث الكمية
                    $updateResult = dbExecute(
                        "UPDATE spare_part_items SET quantity = ? WHERE id = ?",
                        [$newQuantity, $sparePartItemId]
                    );
                    
                    if ($updateResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في تحديث كمية spare_part_item: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | spare_part_item_id: ' . $sparePartItemId . ' | spare_part_id: ' . $itemId);
                        return false;
                    }
                    
                    error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى spare_part_item: ' . $sparePartItemId . ' (item_type: ' . $actualItemType . ', الكمية الجديدة: ' . $newQuantity . ')');
                    return true; // تم التحديث بنجاح
                } else {
                    error_log('⚠️ لم يتم العثور على spare_part_item بالـ ID: ' . $sparePartItemId . ' في spare_part: ' . $itemId);
                    // البحث عن جميع spare_part_items لهذا spare_part
                    $allItems = dbSelect(
                        "SELECT id, item_type, quantity FROM spare_part_items WHERE spare_part_id = ?",
                        [$itemId]
                    );
                    if ($allItems) {
                        error_log('📋 spare_part_items الموجودة في spare_part ' . $itemId . ': ' . json_encode($allItems, JSON_UNESCAPED_UNICODE));
                        // إذا كان هناك عنصر واحد فقط، نستخدمه
                        if (count($allItems) === 1) {
                            $singleItem = $allItems[0];
                            error_log('ℹ️ تم العثور على عنصر واحد فقط، استخدامه: ID=' . $singleItem['id'] . ', item_type=' . $singleItem['item_type']);
                            $currentQuantity = intval($singleItem['quantity'] ?? 0);
                            $newQuantity = $currentQuantity + $quantity;
                            
                            $updateResult = dbExecute(
                                "UPDATE spare_part_items SET quantity = ? WHERE id = ?",
                                [$newQuantity, $singleItem['id']]
                            );
                            
                            if ($updateResult === false) {
                                global $lastDbError;
                                error_log('❌ خطأ في تحديث الكمية: ' . ($lastDbError ?? 'خطأ غير معروف'));
                                return false;
                            }
                            
                            error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى العنصر الوحيد (ID: ' . $singleItem['id'] . ', الكمية الجديدة: ' . $newQuantity . ')');
                            return true;
                        }
                    }
                }
            }
            
            // إذا لم يكن هناك spare_part_item_id أو لم يتم العثور على العنصر، نبحث عن عنصر بنفس item_type
            // itemTypeToAdd تم تعيينه بالفعل من notes إذا كان موجوداً
            error_log('🔍 البحث عن spare_part_item بنفس item_type: ' . $itemTypeToAdd . ' في spare_part: ' . $itemId);
            $existingItemByType = dbSelectOne(
                "SELECT id, quantity, item_type FROM spare_part_items WHERE spare_part_id = ? AND item_type = ? LIMIT 1",
                [$itemId, $itemTypeToAdd]
            );
            
            if ($existingItemByType) {
                // العنصر موجود - إضافة الكمية إليه
                $currentQuantity = intval($existingItemByType['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                $actualItemType = $existingItemByType['item_type'] ?? $itemTypeToAdd;
                
                error_log('✅ تم العثور على spare_part_item بنفس item_type: ID=' . $existingItemByType['id'] . ', item_type=' . $actualItemType . ', الكمية الحالية=' . $currentQuantity);
                
                $updateResult = dbExecute(
                    "UPDATE spare_part_items SET quantity = ? WHERE id = ?",
                    [$newQuantity, $existingItemByType['id']]
                );
                
                if ($updateResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في تحديث كمية spare_part_item بنفس item_type: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | item_id: ' . $existingItemByType['id'] . ' | item_type: ' . $itemTypeToAdd);
                    return false;
                }
                
                error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى spare_part_item بنفس item_type: ' . $itemTypeToAdd . ' (ID: ' . $existingItemByType['id'] . ', الكمية الجديدة: ' . $newQuantity . ')');
                return true; // تم التحديث بنجاح
            } else {
                // البحث عن جميع spare_part_items لهذا spare_part لمعرفة الأنواع المتاحة
                $allItems = dbSelect(
                    "SELECT id, item_type, quantity FROM spare_part_items WHERE spare_part_id = ?",
                    [$itemId]
                );
                if ($allItems) {
                    error_log('⚠️ لم يتم العثور على spare_part_item بنوع: ' . $itemTypeToAdd . ' | الأنواع المتاحة: ' . json_encode(array_column($allItems, 'item_type'), JSON_UNESCAPED_UNICODE));
                } else {
                    error_log('⚠️ لا توجد spare_part_items في spare_part: ' . $itemId);
                }
            }
            
            // إذا لم يتم العثور على عنصر موجود، ننشئ عنصر جديد
            error_log('🆕 إنشاء spare_part_item جديد: spare_part_id=' . $itemId . ', item_type=' . $itemTypeToAdd . ', quantity=' . $quantity);
            $newItemId = generateId();
            
            // التحقق من وجود الأعمدة
            $hasPurchasePrice = dbColumnExists('spare_part_items', 'purchase_price');
            $hasSellingPrice = dbColumnExists('spare_part_items', 'selling_price');
            $hasPrice = dbColumnExists('spare_part_items', 'price');
            
            $insertResult = false;
            if ($hasPurchasePrice && $hasSellingPrice) {
                $insertResult = dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    [$newItemId, $itemId, $itemTypeToAdd, $quantity, $unitPrice, $unitPrice]
                );
            } elseif ($hasPrice) {
                $insertResult = dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, price, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())",
                    [$newItemId, $itemId, $itemTypeToAdd, $quantity, $unitPrice]
                );
            } else {
                $insertResult = dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, created_at) 
                     VALUES (?, ?, ?, ?, NOW())",
                    [$newItemId, $itemId, $itemTypeToAdd, $quantity]
                );
            }
            
            if ($insertResult === false) {
                global $lastDbError;
                error_log('❌ خطأ في إنشاء spare_part_item جديد: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | spare_part_id: ' . $itemId . ' | item_type: ' . $itemTypeToAdd);
                return false;
            }
            
            error_log('✅ تم إنشاء spare_part_item جديد: ' . $newItemId . ' بنوع: ' . $itemTypeToAdd . ' وكمية: ' . $quantity);
            return true;
        } elseif ($itemType === 'accessory') {
            // البحث عن الإكسسوار
            $accessory = dbSelectOne("SELECT id, quantity FROM accessories WHERE id = ?", [$itemId]);
            
            if ($accessory) {
                // تحديث الكمية الموجودة
                $currentQuantity = intval($accessory['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                $updateResult = dbExecute(
                    "UPDATE accessories SET quantity = ? WHERE id = ?",
                    [$newQuantity, $itemId]
                );
                
                if ($updateResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في تحديث كمية الإكسسوار: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | accessory_id: ' . $itemId);
                    return false;
                }
                
                error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى الإكسسوار: ' . $itemId . ' (الكمية الجديدة: ' . $newQuantity . ')');
            } else {
                // إنشاء إكسسوار جديد
                $insertResult = dbExecute(
                    "INSERT INTO accessories (id, name, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())",
                    [$itemId, $itemName, $quantity, $unitPrice, $unitPrice]
                );
                
                if ($insertResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في إنشاء إكسسوار جديد: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | accessory_id: ' . $itemId);
                    return false;
                }
                
                error_log('✅ تم إنشاء إكسسوار جديد: ' . $itemId . ' بكمية: ' . $quantity);
            }
        } elseif ($itemType === 'phone') {
            // النظام الجديد: إضافة الكمية لنفس البطاقة في inventory
            error_log('📱 بدء معالجة استرجاع هاتف - item_id: ' . $itemId . ', item_name: ' . $itemName);
            
            // البحث عن البطاقة في inventory أولاً (نفس ID من الفاتورة)
            $existingInventory = dbSelectOne("SELECT id, name, quantity FROM inventory WHERE id = ?", [$itemId]);
            
            if ($existingInventory) {
                // البطاقة موجودة - إضافة الكمية فقط
                error_log('✅ البطاقة موجودة في inventory، إضافة الكمية المرتجعة');
                $currentQuantity = intval($existingInventory['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                
                $updateResult = dbExecute(
                    "UPDATE inventory SET quantity = ?, updated_at = NOW() WHERE id = ?",
                    [$newQuantity, $itemId]
                );
                
                if ($updateResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في تحديث كمية البطاقة: ' . ($lastDbError ?? 'خطأ غير معروف'));
                    return false;
                }
                
                error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى البطاقة: ' . $itemId . ' (الكمية الجديدة: ' . $newQuantity . ')');
                return true;
            }
            
            // البطاقة غير موجودة - محاولة إنشاءها من بيانات notes أو من جدول phones
            error_log('⚠️ البطاقة غير موجودة في inventory، محاولة إنشائها من بيانات الفاتورة');
            
            // أولاً: محاولة جلب البيانات من جدول phones (النظام الجديد)
            $phoneFromPhones = dbSelectOne("SELECT * FROM phones WHERE id = ?", [$itemId]);
            
            if ($phoneFromPhones) {
                error_log('✅ تم العثور على الهاتف في جدول phones');
                $phoneData = $phoneFromPhones;
            } else {
                // ثانياً: محاولة جلب البيانات من notes
                $phoneData = null;
                $notesContent = $item['notes'] ?? null;
                
                error_log('📋 محتوى notes: ' . ($notesContent ? substr($notesContent, 0, 200) : 'فارغ'));
                
                if (!empty($notesContent)) {
                    $notesData = json_decode($notesContent, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        error_log('❌ خطأ في فك تشفير JSON: ' . json_last_error_msg() . ' | المحتوى: ' . substr($notesContent, 0, 100));
                    } else {
                        // البيانات محفوظة في phone_data داخل notes
                        if (isset($notesData['phone_data']) && is_array($notesData['phone_data'])) {
                            $phoneData = $notesData['phone_data'];
                            error_log('✅ تم العثور على phone_data في notes');
                        } else {
                            // محاولة استخدام البيانات مباشرة إذا كانت موجودة
                            if (isset($notesData['brand']) || isset($notesData['model'])) {
                                $phoneData = $notesData;
                                error_log('✅ تم العثور على بيانات الهاتف مباشرة في notes');
                            }
                        }
                    }
                }
            }
            
            if ($phoneData && is_array($phoneData)) {
                error_log('✅ تم قراءة بيانات الهاتف بنجاح: ' . json_encode($phoneData, JSON_UNESCAPED_UNICODE));
                
                // بناء اسم الهاتف من الماركة والموديل والرقم التسلسلي
                $brand = trim($phoneData['brand'] ?? '');
                $model = trim($phoneData['model'] ?? '');
                $serialNumber = trim($phoneData['serial_number'] ?? '');
                
                // إنشاء اسم للبطاقة
                $phoneName = '';
                if (!empty($brand) && !empty($model)) {
                    $phoneName = $brand . ' ' . $model;
                    if (!empty($serialNumber)) {
                        $phoneName .= ' - SN: ' . $serialNumber;
                    }
                } else {
                    // إذا لم تكن هناك بيانات كافية، استخدم اسم العنصر
                    $phoneName = $itemName;
                }
                
                error_log('📝 اسم البطاقة: ' . $phoneName);
                
                // استخدام نفس item_id من الفاتورة لضمان الربط بين البطاقة والفاتورة
                $inventoryId = $itemId; // استخدام نفس ID الهاتف الأصلي
                $purchasePrice = floatval($phoneData['purchase_price'] ?? $unitPrice);
                $sellingPrice = floatval($phoneData['selling_price'] ?? $unitPrice);
                
                error_log('💰 الأسعار - purchase: ' . $purchasePrice . ', selling: ' . $sellingPrice . ', quantity: ' . $quantity);
                error_log('🆔 استخدام نفس ID من الفاتورة: ' . $inventoryId);
                
                // التحقق من وجود الهاتف في phones أولاً
                $existingPhone = dbSelectOne("SELECT id FROM phones WHERE id = ?", [$inventoryId]);
                
                if (!$existingPhone) {
                    // إنشاء هاتف في phones إذا لم يكن موجوداً
                    error_log('🆕 إنشاء هاتف جديد في جدول phones');
                    $phoneInsertResult = dbExecute(
                        "INSERT INTO phones (id, brand, model, serial_number, image, tax_status, tax_amount, storage, ram, screen_type, processor, battery, battery_percent, accessories, password, maintenance_history, defects, purchase_price, selling_price, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                        [
                            $inventoryId,
                            $phoneData['brand'] ?? '',
                            $phoneData['model'] ?? '',
                            $phoneData['serial_number'] ?? '',
                            $phoneData['image'] ?? '',
                            $phoneData['tax_status'] ?? 'exempt',
                            floatval($phoneData['tax_amount'] ?? 0),
                            $phoneData['storage'] ?? '',
                            $phoneData['ram'] ?? '',
                            $phoneData['screen_type'] ?? '',
                            $phoneData['processor'] ?? '',
                            $phoneData['battery'] ?? '',
                            isset($phoneData['battery_percent']) ? intval($phoneData['battery_percent']) : null,
                            $phoneData['accessories'] ?? '',
                            $phoneData['password'] ?? '',
                            $phoneData['maintenance_history'] ?? '',
                            $phoneData['defects'] ?? '',
                            $purchasePrice,
                            $sellingPrice
                        ]
                    );
                    
                    if ($phoneInsertResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في إنشاء هاتف في phones: ' . ($lastDbError ?? 'خطأ غير معروف'));
                        return false;
                    }
                }
                
                // التحقق من وجود البطاقة في inventory
                $existingItem = dbSelectOne("SELECT id, quantity FROM inventory WHERE id = ?", [$inventoryId]);
                
                if ($existingItem) {
                    // البطاقة موجودة - تحديث الكمية فقط
                    error_log('ℹ️ البطاقة موجودة مسبقاً، تحديث الكمية');
                    $currentQuantity = intval($existingItem['quantity'] ?? 0);
                    $newQuantity = $currentQuantity + $quantity;
                    
                    $updateResult = dbExecute(
                        "UPDATE inventory SET quantity = ?, purchase_price = ?, selling_price = ?, updated_at = NOW() WHERE id = ?",
                        [$newQuantity, $purchasePrice, $sellingPrice, $inventoryId]
                    );
                    
                    if ($updateResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في تحديث بطاقة الهاتف: ' . ($lastDbError ?? 'خطأ غير معروف'));
                        return false;
                    }
                    
                    error_log('✅ تم تحديث بطاقة الهاتف بنجاح: ' . $inventoryId . ' - الكمية الجديدة: ' . $newQuantity);
                    return true;
                } else {
                    // البطاقة غير موجودة - إنشاء جديدة في inventory (بدون category - البيانات في phones)
                    error_log('🆕 إنشاء بطاقة هاتف جديدة في inventory بنفس ID من الفاتورة');
                    
                    $insertResult = dbExecute(
                        "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, created_at) 
                         VALUES (?, ?, ?, ?, ?, NOW())",
                        [
                            $inventoryId,
                            $phoneName,
                            $quantity,
                            $purchasePrice,
                            $sellingPrice
                        ]
                    );
                    
                    if ($insertResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في إنشاء بطاقة هاتف في المخزن: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | inventory_id: ' . $inventoryId);
                        return false;
                    }
                    
                    // التحقق من أن البطاقة تم إنشاؤها بالفعل
                    $verifyItem = dbSelectOne("SELECT id, name FROM inventory WHERE id = ?", [$inventoryId]);
                    if (!$verifyItem) {
                        global $lastDbError;
                        error_log('❌ فشل التحقق من إنشاء البطاقة: ' . $inventoryId . ' | الخطأ: ' . ($lastDbError ?? 'غير معروف'));
                        return false;
                    }
                    
                    error_log('✅ تم إنشاء بطاقة هاتف في المخزن بنجاح: ' . $inventoryId . ' - ' . $phoneName);
                    error_log('✅ التحقق: البطاقة موجودة في قاعدة البيانات - ID: ' . $verifyItem['id'] . ', Name: ' . $verifyItem['name']);
                    return true;
                }
            } else {
                // لا توجد بيانات هاتف - محاولة إنشاء بطاقة بسيطة
                error_log('⚠️ لا توجد بيانات هاتف صالحة، إنشاء بطاقة بسيطة');
                
                // استخدام نفس item_id من الفاتورة
                $inventoryId = $itemId;
                $phoneName = $itemName;
                $purchasePrice = $unitPrice;
                $sellingPrice = $unitPrice;
                
                error_log('🆔 استخدام نفس ID من الفاتورة: ' . $inventoryId);
                
                // التحقق من وجود البطاقة في inventory
                $existingItem = dbSelectOne("SELECT id, quantity FROM inventory WHERE id = ?", [$inventoryId]);
                
                if ($existingItem) {
                    // البطاقة موجودة - تحديث الكمية فقط
                    error_log('ℹ️ البطاقة موجودة مسبقاً، تحديث الكمية');
                    $currentQuantity = intval($existingItem['quantity'] ?? 0);
                    $newQuantity = $currentQuantity + $quantity;
                    
                    $updateResult = dbExecute(
                        "UPDATE inventory SET quantity = ?, updated_at = NOW() WHERE id = ?",
                        [$newQuantity, $inventoryId]
                    );
                    
                    if ($updateResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في تحديث كمية البطاقة: ' . ($lastDbError ?? 'خطأ غير معروف'));
                        return false;
                    }
                    
                    error_log('✅ تم تحديث كمية البطاقة: ' . $inventoryId . ' - الكمية الجديدة: ' . $newQuantity);
                    return true;
                } else {
                    // إنشاء بطاقة بسيطة في inventory
                    error_log('🆕 إنشاء بطاقة بسيطة في inventory');
                    
                    $insertResult = dbExecute(
                        "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, created_at) 
                         VALUES (?, ?, ?, ?, ?, NOW())",
                        [$inventoryId, $phoneName, $quantity, $purchasePrice, $sellingPrice]
                    );
                    
                    if ($insertResult === false) {
                        global $lastDbError;
                        error_log('❌ خطأ في إنشاء بطاقة بسيطة: ' . ($lastDbError ?? 'خطأ غير معروف'));
                        return false;
                    }
                    
                    error_log('✅ تم إنشاء بطاقة بسيطة: ' . $inventoryId . ' - ' . $phoneName);
                    return true;
                }
            }
        } elseif ($itemType === 'inventory') {
            // البحث عن المنتج في المخزن
            $inventoryItem = dbSelectOne("SELECT id, quantity FROM inventory WHERE id = ?", [$itemId]);
            
            if ($inventoryItem) {
                // تحديث الكمية الموجودة
                $currentQuantity = intval($inventoryItem['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                $updateResult = dbExecute(
                    "UPDATE inventory SET quantity = ? WHERE id = ?",
                    [$newQuantity, $itemId]
                );
                
                if ($updateResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في تحديث كمية المخزن: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | inventory_id: ' . $itemId);
                    return false;
                }
                
                error_log('✅ تم إضافة الكمية ' . $quantity . ' إلى المخزن: ' . $itemId . ' (الكمية الجديدة: ' . $newQuantity . ')');
            } else {
                // إنشاء منتج جديد في المخزن
                $insertResult = dbExecute(
                    "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())",
                    [$itemId, $itemName, $quantity, $unitPrice, $unitPrice]
                );
                
                if ($insertResult === false) {
                    global $lastDbError;
                    error_log('❌ خطأ في إنشاء منتج جديد في المخزن: ' . ($lastDbError ?? 'خطأ غير معروف') . ' | inventory_id: ' . $itemId);
                    return false;
                }
                
                error_log('✅ تم إنشاء منتج جديد في المخزن: ' . $itemId . ' بكمية: ' . $quantity);
            }
        }
        
        return true;
    } catch (Exception $e) {
        error_log('❌ خطأ في إضافة منتج مرتجع للمخزون: ' . $e->getMessage());
        error_log('Stack trace: ' . $e->getTraceAsString());
        return false;
    } catch (Error $e) {
        error_log('❌ خطأ قاتل في إضافة منتج مرتجع للمخزون: ' . $e->getMessage());
        error_log('Stack trace: ' . $e->getTraceAsString());
        return false;
    }
}

// قراءة البيانات
if ($method === 'GET') {
    checkAuth();
    
    // إذا كان هناك sale_number محدد، جلب تفاصيل الفاتورة
    $saleNumber = $_GET['sale_number'] ?? null;
    if ($saleNumber) {
        $sale = dbSelectOne(
            "SELECT s.*, u.name as created_by_name 
             FROM sales s 
             LEFT JOIN users u ON s.created_by = u.id 
             WHERE s.sale_number = ?",
            [$saleNumber]
        );
        
        if (!$sale) {
            response(false, 'الفاتورة غير موجودة', null, 404);
            return;
        }
        
        // ✅ جلب عناصر الفاتورة مع الأسعار من sale_items (أسعار الفاتورة وليس أسعار المخزن)
        // sale_items يحتوي على unit_price وهو سعر البيع في الفاتورة وليس purchase_price من المخزن
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        
        // معالجة عناصر البيع
        $processedItems = [];
        foreach ($items as $item) {
            // ✅ unit_price من sale_items هو سعر البيع في الفاتورة - سيتم استخدامه في عملية الإرجاع
            // إذا كان العنصر هاتف وله بيانات في notes (JSON)
            if ($item['item_type'] === 'phone' && !empty($item['notes'])) {
                $phoneData = json_decode($item['notes'], true);
                if ($phoneData && is_array($phoneData)) {
                    $item['phone_data'] = $phoneData;
                }
            }
            
            // حساب الكمية المرتجعة سابقاً لهذا العنصر
            $returnedQuantities = dbSelect(
                "SELECT SUM(returned_quantity) as total_returned 
                 FROM product_return_items 
                 WHERE sale_item_id = ?",
                [$item['id']]
            );
            
            $totalReturned = 0;
            if ($returnedQuantities && count($returnedQuantities) > 0 && $returnedQuantities[0]['total_returned']) {
                $totalReturned = intval($returnedQuantities[0]['total_returned']);
            }
            
            $originalQuantity = intval($item['quantity'] ?? 0);
            $availableQuantity = $originalQuantity - $totalReturned;
            
            // إضافة معلومات المرتجعات
            $item['returned_quantity'] = $totalReturned;
            $item['available_quantity'] = max(0, $availableQuantity);
            $item['is_fully_returned'] = ($availableQuantity <= 0);
            
            $processedItems[] = $item;
        }
        $sale['items'] = (is_array($processedItems) && count($processedItems) > 0) ? $processedItems : [];
        
        // التأكد من وجود القيم الرقمية
        $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
        $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
        $sale['discount'] = floatval($sale['discount'] ?? 0);
        $sale['tax'] = floatval($sale['tax'] ?? 0);
        
        response(true, '', $sale);
        return;
    }
    
    // جلب قائمة المرتجعات
    $isDamaged = $_GET['is_damaged'] ?? null;
    
    $query = "SELECT pr.*, u.name as created_by_name 
              FROM product_returns pr 
              LEFT JOIN users u ON pr.created_by = u.id 
              WHERE 1=1";
    $params = [];
    
    // فلترة حسب is_damaged (من خلال العناصر المرتجعة)
    if ($isDamaged !== null) {
        $damagedValue = intval($isDamaged);
        $query .= " AND pr.id IN (
            SELECT DISTINCT return_id 
            FROM product_return_items 
            WHERE is_damaged = ?
        )";
        $params[] = $damagedValue;
    }
    
    $query .= " ORDER BY pr.created_at DESC";
    
    $returns = dbSelect($query, $params);
    
    if ($returns === false) {
        response(false, 'خطأ في قراءة المرتجعات', null, 500);
        return;
    }
    
    // إضافة عناصر كل استرجاع
    foreach ($returns as &$return) {
        $items = dbSelect(
            "SELECT * FROM product_return_items WHERE return_id = ? ORDER BY created_at ASC",
            [$return['id']]
        );
        $return['items'] = $items ? $items : [];
        $return['total_returned_amount'] = floatval($return['total_returned_amount'] ?? 0);
    }
    
    response(true, '', $returns);
}

// إتمام عملية الاسترجاع
if ($method === 'POST') {
    if (!checkProductReturnsPermission()) {
        response(false, 'ليس لديك صلاحية لاسترجاع المنتجات', null, 403);
        return;
    }
    
    $session = checkAuth();
    
    $saleNumber = trim($data['sale_number'] ?? '');
    $items = $data['items'] ?? [];
    $notes = trim($data['notes'] ?? '');
    $refundAmount = floatval($data['refund_amount'] ?? 0); // المبلغ المدفوع للعميل
    
    if (empty($saleNumber)) {
        response(false, 'رقم الفاتورة مطلوب', null, 400);
        return;
    }
    
    if (empty($items) || !is_array($items)) {
        response(false, 'يجب تحديد منتج واحد على الأقل للإرجاع', null, 400);
        return;
    }
    
    // جلب الفاتورة
    $sale = dbSelectOne(
        "SELECT * FROM sales WHERE sale_number = ?",
        [$saleNumber]
    );
    
    if (!$sale) {
        response(false, 'الفاتورة غير موجودة', null, 404);
        return;
    }
    
    // جلب عناصر الفاتورة الأصلية
    $saleItems = dbSelect(
        "SELECT * FROM sale_items WHERE sale_id = ?",
        [$sale['id']]
    );
    
    $saleItemsMap = [];
    foreach ($saleItems as $saleItem) {
        $saleItemsMap[$saleItem['id']] = $saleItem;
    }
    
    // التحقق من صحة البيانات وإنشاء سجل الاسترجاع
    $returnId = generateId();
    $returnNumber = 'RET-' . date('Ymd') . '-' . substr($returnId, -6);
    
    // حساب إجمالي المبلغ المرتجع
    $totalReturnedAmount = 0;
    $returnItems = [];
    
    foreach ($items as $item) {
        $saleItemId = trim($item['sale_item_id'] ?? '');
        $returnedQuantity = intval($item['returned_quantity'] ?? 0);
        $isDamaged = intval($item['is_damaged'] ?? 0);
        
        if (empty($saleItemId) || $returnedQuantity <= 0) {
            continue;
        }
        
        if (!isset($saleItemsMap[$saleItemId])) {
            response(false, 'عنصر الفاتورة غير موجود: ' . $saleItemId, null, 400);
            return;
        }
        
        $saleItem = $saleItemsMap[$saleItemId];
        $originalQuantity = intval($saleItem['quantity'] ?? 0);
        
        // حساب الكمية المرتجعة سابقاً لهذا العنصر
        $returnedQuantities = dbSelect(
            "SELECT SUM(returned_quantity) as total_returned 
             FROM product_return_items 
             WHERE sale_item_id = ?",
            [$saleItemId]
        );
        
        $totalReturned = 0;
        if ($returnedQuantities && count($returnedQuantities) > 0 && $returnedQuantities[0]['total_returned']) {
            $totalReturned = intval($returnedQuantities[0]['total_returned']);
        }
        
        $availableQuantity = $originalQuantity - $totalReturned;
        
        // التحقق من أن الكمية المراد إرجاعها لا تتجاوز الكمية المتاحة
        if ($returnedQuantity > $availableQuantity) {
            response(false, 'الكمية المراد إرجاعها (' . $returnedQuantity . ') أكبر من الكمية المتاحة للإرجاع (' . $availableQuantity . '). تم إرجاع ' . $totalReturned . ' من ' . $originalQuantity . ' سابقاً', null, 400);
            return;
        }
        
        // التحقق من أن الكمية المتاحة أكبر من صفر
        if ($availableQuantity <= 0) {
            response(false, 'تم إرجاع جميع الكمية من هذا المنتج (' . $saleItem['item_name'] . ') سابقاً ولا يمكن إرجاعه مرة أخرى', null, 400);
            return;
        }
        
        // ✅ استخدام سعر المنتج من الفاتورة (unit_price من sale_items) وليس سعر التكلفة من المخزن
        // unit_price من sale_items هو سعر البيع في الفاتورة وليس purchase_price من المخزن
        $unitPrice = floatval($saleItem['unit_price'] ?? 0); // سعر البيع من الفاتورة
        $totalPrice = $unitPrice * $returnedQuantity;
        $totalReturnedAmount += $totalPrice;
        
        $returnItems[] = [
            'sale_item' => $saleItem,
            'returned_quantity' => $returnedQuantity,
            'is_damaged' => $isDamaged,
            'unit_price' => $unitPrice,
            'total_price' => $totalPrice
        ];
    }
    
    if (empty($returnItems)) {
        response(false, 'لا توجد عناصر صالحة للإرجاع', null, 400);
        return;
    }
    
    // بدء المعاملة
    try {
        $conn = getDBConnection();
        if (!$conn) {
            throw new Exception('فشل الاتصال بقاعدة البيانات');
        }
        
        $conn->begin_transaction();
        
        // إنشاء سجل الاسترجاع
        $result = dbExecute(
            "INSERT INTO product_returns (id, return_number, sale_id, sale_number, customer_id, customer_name, 
             total_returned_amount, status, notes, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, NOW(), ?)",
            [
                $returnId,
                $returnNumber,
                $sale['id'],
                $saleNumber,
                $sale['customer_id'] ?? null,
                $sale['customer_name'] ?? null,
                $totalReturnedAmount,
                $notes,
                $session['user_id']
            ]
        );
        
        if ($result === false) {
            throw new Exception('فشل إنشاء سجل الاسترجاع');
        }
        
        // حساب إجمالي المرتجعات التالفة
        $totalDamagedAmount = 0;
        $damagedItems = [];
        
        // جلب معلومات الفرع من البيع
        $saleInfo = dbSelectOne(
            "SELECT s.created_by, u.role, u.branch_id as user_branch_id, c.branch_id as customer_branch_id
             FROM sales s
             INNER JOIN users u ON s.created_by = u.id
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE s.id = ?",
            [$sale['id']]
        );
        
        // تحديد branch_id للاسترجاع (نفس منطق تحديد فرع المبيعات)
        $returnBranchId = null;
        if ($saleInfo) {
            $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
            $firstBranchId = $firstBranch ? $firstBranch['id'] : null;
            $userBranchId = $saleInfo['user_branch_id'] ?? null;
            $userRole = $saleInfo['role'] ?? 'employee';
            $customerBranchId = $saleInfo['customer_branch_id'] ?? null;
            
            if ($firstBranchId && ($userBranchId === $firstBranchId || $userRole === 'admin' || $customerBranchId === $firstBranchId || $customerBranchId === null)) {
                $returnBranchId = $firstBranchId;
            } else {
                $returnBranchId = $userBranchId;
            }
        }
        
        // إذا لم نستطع تحديد الفرع، نستخدم فرع المستخدم الحالي
        if (!$returnBranchId) {
            $session = checkAuth();
            $returnBranchId = $session['branch_id'] ?? null;
            if (!$returnBranchId) {
                $firstBranch = dbSelectOne("SELECT id FROM branches ORDER BY created_at ASC, id ASC LIMIT 1");
                $returnBranchId = $firstBranch ? $firstBranch['id'] : null;
            }
        }
        
        // إنشاء عناصر الاسترجاع وإضافة المنتجات للمخزون
        foreach ($returnItems as $returnItem) {
            $saleItem = $returnItem['sale_item'];
            $itemId = generateId();
            
            // إنشاء سجل عنصر الاسترجاع
            $itemResult = dbExecute(
                "INSERT INTO product_return_items (id, return_id, sale_item_id, item_type, item_id, item_name, 
                 original_quantity, returned_quantity, unit_price, total_price, is_damaged, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [
                    $itemId,
                    $returnId,
                    $saleItem['id'],
                    $saleItem['item_type'],
                    $saleItem['item_id'],
                    $saleItem['item_name'],
                    intval($saleItem['quantity']),
                    $returnItem['returned_quantity'],
                    $returnItem['unit_price'],
                    $returnItem['total_price'],
                    $returnItem['is_damaged']
                ]
            );
            
            if ($itemResult === false) {
                throw new Exception('فشل إنشاء عنصر الاسترجاع');
            }
            
            // إضافة المنتج للمخزون فقط إذا لم يكن تالفاً
            if ($returnItem['is_damaged'] == 0) {
                $addToInventory = addReturnedItemToInventory(
                    $saleItem,
                    $returnItem['returned_quantity']
                );
                
                if (!$addToInventory) {
                    error_log('❌ تحذير: فشل إضافة منتج مرتجع للمخزون: ' . $saleItem['item_name'] . ' (item_type: ' . ($saleItem['item_type'] ?? 'unknown') . ', item_id: ' . ($saleItem['item_id'] ?? 'unknown') . ')');
                    // لا نوقف العملية، فقط نسجل التحذير
                } else {
                    error_log('✅ تم إضافة منتج مرتجع للمخزون بنجاح: ' . $saleItem['item_name'] . ' (الكمية: ' . $returnItem['returned_quantity'] . ')');
                }
            } else {
                // المنتج تالف - إضافة للمرجعات التالفة
                // ✅ استخدام سعر المنتج من الفاتورة (unit_price من sale_items) وليس سعر التكلفة من المخزن
                // $returnItem['total_price'] = unit_price من sale_items × returned_quantity
                // وهذا هو سعر البيع في الفاتورة وليس سعر التكلفة
                $damagedItemPrice = $returnItem['total_price']; // سعر البيع من الفاتورة
                $totalDamagedAmount += $damagedItemPrice;
                $damagedItems[] = $returnItem;
                error_log('ℹ️ المنتج المرتجع تالف، لم يتم إضافته للمخزون: ' . $saleItem['item_name'] . ' - السعر من الفاتورة: ' . $damagedItemPrice . ' ج.م');
            }
        }
        
        // إضافة معاملة في treasury_transactions للمنتجات التالفة
        if ($totalDamagedAmount > 0 && $returnBranchId) {
            // التأكد من وجود 'damaged_return' في enum
            if ($conn) {
                $checkEnumQuery = "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                                  WHERE TABLE_SCHEMA = DATABASE() 
                                  AND TABLE_NAME = 'treasury_transactions' 
                                  AND COLUMN_NAME = 'transaction_type'";
                $result = $conn->query($checkEnumQuery);
                if ($result && $row = $result->fetch_assoc()) {
                    $columnType = $row['COLUMN_TYPE'];
                    if (strpos($columnType, 'damaged_return') === false) {
                        // إضافة 'damaged_return' إلى enum
                        $alterQuery = "ALTER TABLE treasury_transactions 
                                      MODIFY COLUMN transaction_type 
                                      enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return') NOT NULL";
                        if (!$conn->query($alterQuery)) {
                            error_log('❌ فشل إضافة damaged_return إلى enum: ' . $conn->error);
                        } else {
                            error_log('✅ تم إضافة damaged_return إلى enum بنجاح');
                        }
                    }
                }
            }
            
            // إضافة معاملة لكل منتج تالف أو معاملة واحدة للمجموع
            $damagedTransactionId = generateId();
            $damagedDescription = 'مرتجع تالف - ' . count($damagedItems) . ' منتج - فاتورة: ' . $saleNumber;
            if (!empty($notes)) {
                $damagedDescription .= ' - ' . $notes;
            }
            
            $transactionResult = dbExecute(
                "INSERT INTO treasury_transactions (
                    id, branch_id, transaction_type, amount, description, 
                    reference_id, reference_type, created_at, created_by
                ) VALUES (?, ?, 'damaged_return', ?, ?, ?, 'product_return', NOW(), ?)",
                [$damagedTransactionId, $returnBranchId, $totalDamagedAmount, $damagedDescription, $returnId, $session['user_id']]
            );
            
            if ($transactionResult === false) {
                error_log('❌ تحذير: فشل إضافة معاملة المرتجع التالف في treasury_transactions');
                // لا نوقف العملية، فقط نسجل التحذير
            } else {
                error_log('✅ تم إضافة معاملة المرتجع التالف في treasury_transactions بنجاح: ' . $totalDamagedAmount . ' ج.م');
            }
        }
        
        // ✅ خصم المبلغ المدفوع للعميل من خزنة الفرع
        if ($refundAmount > 0 && dbTableExists('treasury_transactions') && $returnBranchId) {
            // التحقق من عدم وجود معاملة مسجلة مسبقاً
            $existingRefundTransaction = dbSelectOne(
                "SELECT id FROM treasury_transactions WHERE reference_id = ? AND reference_type = 'product_return' AND transaction_type = 'withdrawal' AND description LIKE ?",
                [$returnId, '%المبلغ المدفوع للعميل%']
            );
            
            if (!$existingRefundTransaction) {
                $refundTransactionId = generateId();
                $refundDescription = "المبلغ المدفوع للعميل - مرتجع فاتورة رقم {$saleNumber}";
                if (!empty($notes)) {
                    $refundDescription .= ' - ' . $notes;
                }
                
                $refundTransactionResult = dbExecute(
                    "INSERT INTO treasury_transactions (
                        id, branch_id, transaction_type, amount, description, 
                        reference_id, reference_type, created_at, created_by
                    ) VALUES (?, ?, 'withdrawal', ?, ?, ?, 'product_return', NOW(), ?)",
                    [$refundTransactionId, $returnBranchId, $refundAmount, $refundDescription, $returnId, $session['user_id']]
                );
                
                if ($refundTransactionResult === false) {
                    error_log('❌ تحذير: فشل خصم المبلغ المدفوع للعميل من خزنة الفرع');
                    // لا نوقف العملية، فقط نسجل التحذير
                } else {
                    error_log("✅ تم خصم المبلغ المدفوع للعميل ({$refundAmount} ج.م) من خزنة الفرع بنجاح");
                }
            }
        }
        
        $conn->commit();
        
        // جلب بيانات الاسترجاع الكاملة
        $newReturn = dbSelectOne(
            "SELECT pr.*, u.name as created_by_name 
             FROM product_returns pr 
             LEFT JOIN users u ON pr.created_by = u.id 
             WHERE pr.id = ?",
            [$returnId]
        );
        
        $returnItems = dbSelect(
            "SELECT * FROM product_return_items WHERE return_id = ? ORDER BY created_at ASC",
            [$returnId]
        );
        
        $newReturn['items'] = $returnItems ? $returnItems : [];
        $newReturn['total_returned_amount'] = floatval($newReturn['total_returned_amount'] ?? 0);
        
        response(true, 'تم إتمام عملية الاسترجاع بنجاح', $newReturn);
        
    } catch (Exception $e) {
        if (isset($conn)) {
            $conn->rollback();
        }
        error_log('خطأ في عملية الاسترجاع: ' . $e->getMessage());
        response(false, 'حدث خطأ أثناء عملية الاسترجاع: ' . $e->getMessage(), null, 500);
    }
}


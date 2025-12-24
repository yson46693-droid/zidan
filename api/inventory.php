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
$type = $_GET['type'] ?? $data['type'] ?? 'inventory'; // inventory, spare_parts, accessories, phones

/**
 * التحقق من صلاحيات المخزون
 * @param string $action 'read' أو 'write'
 * @return bool
 */
function checkInventoryPermission($action = 'read') {
    $session = checkAuth();
    $userRole = $session['role'];
    $userBranchId = $session['branch_id'] ?? null;
    
    // المالك له كامل الصلاحيات
    if ($userRole === 'admin') {
        return true;
    }
    
    // إذا لم يكن مرتبطاً بفرع
    if (!$userBranchId) {
        return false;
    }
    
    // جلب معلومات الفرع
    try {
        $branch = dbSelectOne("SELECT code, has_pos FROM branches WHERE id = ?", [$userBranchId]);
        if (!$branch) {
            return false;
        }
        
        // الفرع الأول (HANOVIL) له كامل الصلاحيات
        if ($branch['code'] === 'HANOVIL') {
            return true;
        }
        
        // الفرع الثاني (BITASH) - قراءة فقط
        if ($branch['code'] === 'BITASH' && $action === 'read') {
            return true;
        }
        
        // أي إجراء آخر للفرع الثاني = مرفوض
        return false;
    } catch (Exception $e) {
        error_log('خطأ في التحقق من صلاحيات المخزون: ' . $e->getMessage());
        return false;
    }
}

// قراءة البيانات حسب النوع
if ($method === 'GET') {
    checkAuth();
    
    if ($type === 'spare_parts') {
        // قراءة قطع الغيار
        $spareParts = dbSelect("SELECT * FROM spare_parts ORDER BY created_at DESC");
        
        if ($spareParts === false) {
            response(false, 'خطأ في قراءة قطع الغيار', null, 500);
        }
        
        // جلب تفاصيل القطع لكل قطعة غيار
        foreach ($spareParts as &$part) {
            // التحقق من وجود الأعمدة أولاً
            $hasPurchasePrice = dbColumnExists('spare_part_items', 'purchase_price');
            $hasSellingPrice = dbColumnExists('spare_part_items', 'selling_price');
            $hasPrice = dbColumnExists('spare_part_items', 'price');
            
            if ($hasPurchasePrice && $hasSellingPrice) {
                // الجدول يحتوي على purchase_price و selling_price
                $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                    COALESCE(purchase_price, 0) as purchase_price, 
                    COALESCE(selling_price, 0) as selling_price, 
                    notes, custom_value, created_at, updated_at 
                    FROM spare_part_items WHERE spare_part_id = ?", [$part['id']]);
            } elseif ($hasPrice) {
                // الجدول يحتوي على price فقط
                $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                    COALESCE(price, 0) as purchase_price, 
                    COALESCE(price, 0) as selling_price, 
                    notes, custom_value, created_at, updated_at 
                    FROM spare_part_items WHERE spare_part_id = ?", [$part['id']]);
            } else {
                // لا توجد أعمدة أسعار
                $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                    0 as purchase_price, 
                    0 as selling_price, 
                    notes, custom_value, created_at, updated_at 
                    FROM spare_part_items WHERE spare_part_id = ?", [$part['id']]);
            }
            
            $part['items'] = $items ? $items : [];
        }
        
        response(true, '', $spareParts);
    }
    elseif ($type === 'accessories') {
        // قراءة الإكسسوارات
        $accessories = dbSelect("SELECT * FROM accessories ORDER BY created_at DESC");
        
        if ($accessories === false) {
            response(false, 'خطأ في قراءة الإكسسوارات', null, 500);
        }
        
        response(true, '', $accessories);
    }
    elseif ($type === 'phones') {
        // قراءة الهواتف
        $phones = dbSelect("SELECT * FROM phones ORDER BY created_at DESC");
        
        if ($phones === false) {
            response(false, 'خطأ في قراءة الهواتف', null, 500);
        }
        
        response(true, '', $phones);
    }
    else {
        // قراءة المخزون القديم (للتوافق)
        $inventory = dbSelect("SELECT * FROM inventory ORDER BY created_at DESC");
        
        if ($inventory === false) {
            response(false, 'خطأ في قراءة المخزون', null, 500);
        }
        
        response(true, '', $inventory);
    }
}

// إضافة بيانات جديدة
if ($method === 'POST') {
    if (!checkInventoryPermission('write')) {
        response(false, 'ليس لديك صلاحية لتعديل المخزون', null, 403);
    }
    checkPermission('manager');
    
    if ($type === 'spare_parts') {
        // إضافة قطعة غيار
        // إزالة حقل price القديم إذا كان موجوداً (للتأكد من عدم استخدامه)
        unset($data['price']);
        
        $brand = trim($data['brand'] ?? '');
        $model = trim($data['model'] ?? '');
        $barcode = trim($data['barcode'] ?? '');
        $image = trim($data['image'] ?? '');
        $purchase_price = floatval($data['purchase_price'] ?? 0);
        $selling_price = floatval($data['selling_price'] ?? 0);
        $items = $data['items'] ?? []; // قائمة القطع
        
        if (empty($brand) || empty($model)) {
            response(false, 'الماركة والموديل مطلوبان', null, 400);
        }
        
        $session = checkAuth();
        $partId = generateId();
        
        // إضافة قطعة الغيار
        $result = dbExecute(
            "INSERT INTO spare_parts (id, brand, model, barcode, image, purchase_price, selling_price, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$partId, $brand, $model, $barcode, $image, $purchase_price, $selling_price, $session['user_id']]
        );
        
        if ($result === false) {
            global $lastDbError;
            $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
            
            // فحص إذا كان الخطأ متعلق بـ price
            if (stripos($error, 'price') !== false && stripos($error, 'Unknown column') !== false) {
                response(false, 'خطأ: تم إرسال حقل price القديم. يرجى استخدام purchase_price و selling_price بدلاً منه. الخطأ: ' . $error, null, 500);
            } else {
                response(false, 'خطأ في إضافة قطعة الغيار: ' . $error, null, 500);
            }
        }
        
        // إضافة تفاصيل القطع
        if (is_array($items) && !empty($items)) {
            foreach ($items as $item) {
                $itemId = isset($item['id']) && !empty($item['id']) ? trim($item['id']) : generateId();
                $itemType = trim($item['item_type'] ?? '');
                $quantity = intval($item['quantity'] ?? 1);
                $purchasePrice = floatval($item['purchase_price'] ?? $item['price'] ?? 0);
                $sellingPrice = floatval($item['selling_price'] ?? $item['price'] ?? 0);
                $notes = trim($item['notes'] ?? '');
                $customValue = trim($item['custom_value'] ?? '');
                
                if (!empty($itemType)) {
                    // محاولة استخدام purchase_price و selling_price أولاً، وإذا لم تكن موجودة في الجدول، استخدم price
                    $insertResult = dbExecute(
                        "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, purchase_price, selling_price, price, notes, custom_value, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                         ON DUPLICATE KEY UPDATE 
                         item_type = VALUES(item_type),
                         quantity = VALUES(quantity),
                         purchase_price = VALUES(purchase_price),
                         selling_price = VALUES(selling_price),
                         price = VALUES(price),
                         notes = VALUES(notes),
                         custom_value = VALUES(custom_value),
                         updated_at = NOW()",
                        [$itemId, $partId, $itemType, $quantity, $purchasePrice, $sellingPrice, $sellingPrice, $notes, $customValue]
                    );
                    
                    if ($insertResult === false) {
                        global $lastDbError;
                        $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
                        
                        // التحقق إذا كان الخطأ بسبب عدم وجود purchase_price أو selling_price
                        if (stripos($error, 'Unknown column') !== false && 
                            (stripos($error, 'purchase_price') !== false || stripos($error, 'selling_price') !== false)) {
                            // محاولة إدراج بدون purchase_price و selling_price إذا لم تكن موجودة
                            $insertResult = dbExecute(
                                "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, price, notes, custom_value, created_at) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                                 ON DUPLICATE KEY UPDATE 
                                 item_type = VALUES(item_type),
                                 quantity = VALUES(quantity),
                                 price = VALUES(price),
                                 notes = VALUES(notes),
                                 custom_value = VALUES(custom_value),
                                 updated_at = NOW()",
                                [$itemId, $partId, $itemType, $quantity, $sellingPrice, $notes, $customValue]
                            );
                            if ($insertResult === false) {
                                global $lastDbError;
                                response(false, 'خطأ في إضافة تفاصيل القطع: ' . ($lastDbError ?? 'خطأ غير معروف'), null, 500);
                            }
                        } else {
                            response(false, 'خطأ في إضافة تفاصيل القطع: ' . $error, null, 500);
                        }
                    }
                }
            }
        }
        
        $newPart = dbSelectOne("SELECT * FROM spare_parts WHERE id = ?", [$partId]);
        
        // التحقق من وجود الأعمدة أولاً
        $hasPurchasePrice = dbColumnExists('spare_part_items', 'purchase_price');
        $hasSellingPrice = dbColumnExists('spare_part_items', 'selling_price');
        $hasPrice = dbColumnExists('spare_part_items', 'price');
        
        if ($hasPurchasePrice && $hasSellingPrice) {
            // الجدول يحتوي على purchase_price و selling_price
            $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                COALESCE(purchase_price, 0) as purchase_price, 
                COALESCE(selling_price, 0) as selling_price, 
                notes, custom_value, created_at, updated_at 
                FROM spare_part_items WHERE spare_part_id = ?", [$partId]);
        } elseif ($hasPrice) {
            // الجدول يحتوي على price فقط
            $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                COALESCE(price, 0) as purchase_price, 
                COALESCE(price, 0) as selling_price, 
                notes, custom_value, created_at, updated_at 
                FROM spare_part_items WHERE spare_part_id = ?", [$partId]);
        } else {
            // لا توجد أعمدة أسعار
            $items = dbSelect("SELECT id, spare_part_id, item_type, quantity, 
                0 as purchase_price, 
                0 as selling_price, 
                notes, custom_value, created_at, updated_at 
                FROM spare_part_items WHERE spare_part_id = ?", [$partId]);
        }
        
        $newPart['items'] = $items ? $items : [];
        
        response(true, 'تم إضافة قطعة الغيار بنجاح', $newPart);
    }
    elseif ($type === 'accessories') {
        // إضافة إكسسوار
        $name = trim($data['name'] ?? '');
        $accessoryType = trim($data['type'] ?? '');
        $image = trim($data['image'] ?? '');
        $purchase_price = floatval($data['purchase_price'] ?? 0);
        $selling_price = floatval($data['selling_price'] ?? 0);
        
        if (empty($name) || empty($accessoryType)) {
            response(false, 'الاسم والنوع مطلوبان', null, 400);
        }
        
        $session = checkAuth();
        $accessoryId = generateId();
        
        $result = dbExecute(
            "INSERT INTO accessories (id, name, type, image, purchase_price, selling_price, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$accessoryId, $name, $accessoryType, $image, $purchase_price, $selling_price, $session['user_id']]
        );
        
        if ($result === false) {
            global $lastDbError;
            $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
            
            // فحص إذا كان الخطأ متعلق بـ price
            if (stripos($error, 'price') !== false && stripos($error, 'Unknown column') !== false) {
                response(false, 'خطأ: تم إرسال حقل price القديم. يرجى استخدام purchase_price و selling_price بدلاً منه. الخطأ: ' . $error, null, 500);
            } else {
                response(false, 'خطأ في إضافة الإكسسوار: ' . $error, null, 500);
            }
        }
        
        $newAccessory = dbSelectOne("SELECT * FROM accessories WHERE id = ?", [$accessoryId]);
        response(true, 'تم إضافة الإكسسوار بنجاح', $newAccessory);
    }
    elseif ($type === 'phones') {
        // إضافة هاتف
        $brand = trim($data['brand'] ?? '');
        $model = trim($data['model'] ?? '');
        $serial_number = trim($data['serial_number'] ?? '');
        $image = trim($data['image'] ?? '');
        $tax_status = trim($data['tax_status'] ?? 'exempt');
        $tax_amount = floatval($data['tax_amount'] ?? 0);
        $storage = trim($data['storage'] ?? '');
        $ram = trim($data['ram'] ?? '');
        $screen_type = trim($data['screen_type'] ?? '');
        $processor = trim($data['processor'] ?? '');
        $battery = trim($data['battery'] ?? '');
        $accessories = trim($data['accessories'] ?? '');
        $password = trim($data['password'] ?? '');
        $maintenance_history = trim($data['maintenance_history'] ?? '');
        $defects = trim($data['defects'] ?? '');
        $purchase_price = floatval($data['purchase_price'] ?? 0);
        $selling_price = floatval($data['selling_price'] ?? 0);
        
        if (empty($brand) || empty($model)) {
            response(false, 'الماركة والموديل مطلوبان', null, 400);
        }
        
        $session = checkAuth();
        $phoneId = generateId();
        
        $result = dbExecute(
            "INSERT INTO phones (id, brand, model, serial_number, image, tax_status, tax_amount, storage, ram, screen_type, processor, battery, accessories, password, maintenance_history, defects, purchase_price, selling_price, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$phoneId, $brand, $model, $serial_number, $image, $tax_status, $tax_amount, $storage, $ram, $screen_type, $processor, $battery, $accessories, $password, $maintenance_history, $defects, $purchase_price, $selling_price, $session['user_id']]
        );
        
        if ($result === false) {
            global $lastDbError;
            $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
            
            // فحص إذا كان الخطأ متعلق بـ price
            if (stripos($error, 'price') !== false && stripos($error, 'Unknown column') !== false) {
                response(false, 'خطأ: تم إرسال حقل price القديم. يرجى استخدام purchase_price و selling_price بدلاً منه. الخطأ: ' . $error, null, 500);
            } else {
                response(false, 'خطأ في إضافة الهاتف: ' . $error, null, 500);
            }
        }
        
        $newPhone = dbSelectOne("SELECT * FROM phones WHERE id = ?", [$phoneId]);
        response(true, 'تم إضافة الهاتف بنجاح', $newPhone);
    }
    else {
        // إضافة للمخزون القديم (للتوافق) - تم إيقاف هذا القسم
        // يجب استخدام type=spare_parts أو type=accessories أو type=phones
        response(false, 'يرجى تحديد نوع المخزون: type=spare_parts أو type=accessories أو type=phones', null, 400);
        
        /* الكود القديم - تم تعطيله
        $name = trim($data['name'] ?? '');
        $quantity = intval($data['quantity'] ?? 0);
        
        // دعم الحقول القديمة: إذا كان price موجوداً، استخدمه كـ selling_price
        // إزالة price من البيانات قبل الإدراج
        $purchase_price = 0;
        $selling_price = 0;
        
        if (isset($data['price']) && !isset($data['purchase_price']) && !isset($data['selling_price'])) {
            // تحويل price القديم إلى selling_price
            $selling_price = floatval($data['price'] ?? 0);
        } else {
            $purchase_price = floatval($data['purchase_price'] ?? 0);
            $selling_price = floatval($data['selling_price'] ?? 0);
        }
        
        // التأكد من عدم وجود price في البيانات
        unset($data['price']);
        
        $category = trim($data['category'] ?? '');
        
        if (empty($name)) {
            response(false, 'اسم القطعة مطلوب', null, 400);
        }
        
        $session = checkAuth();
        $itemId = generateId();
        
        // التأكد من عدم استخدام price في INSERT - استخدام purchase_price و selling_price فقط
        $result = dbExecute(
            "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, category, created_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
            [$itemId, $name, $quantity, $purchase_price, $selling_price, $category, $session['user_id']]
        );
        
        if ($result === false) {
            // الحصول على خطأ قاعدة البيانات للتحقق
            global $conn, $lastDbError;
            $error = $lastDbError ?? ($conn ? mysqli_error($conn) : 'خطأ غير معروف');
            
            // فحص إذا كان الخطأ متعلق بـ price
            if (stripos($error, 'price') !== false && stripos($error, 'Unknown column') !== false) {
                response(false, 'خطأ: تم إرسال حقل price القديم. يرجى استخدام purchase_price و selling_price بدلاً منه. الخطأ: ' . $error, null, 500);
            } else {
                response(false, 'خطأ في إضافة قطعة الغيار: ' . $error, null, 500);
            }
        }
        
        $newItem = dbSelectOne("SELECT * FROM inventory WHERE id = ?", [$itemId]);
        response(true, 'تم إضافة قطعة الغيار بنجاح', $newItem);
        */
    }
}

// تعديل البيانات
if ($method === 'PUT') {
    if (!checkInventoryPermission('write')) {
        response(false, 'ليس لديك صلاحية لتعديل المخزون', null, 403);
    }
    checkPermission('manager');
    
    if ($type === 'spare_parts') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف قطعة الغيار مطلوب', null, 400);
        }
        
        $part = dbSelectOne("SELECT id FROM spare_parts WHERE id = ?", [$id]);
        if (!$part) {
            response(false, 'قطعة الغيار غير موجودة', null, 404);
        }
        
        // إزالة حقل price القديم إذا كان موجوداً (للتأكد من عدم استخدامه)
        // يجب إزالته من جميع المستويات لتجنب أي مشاكل
        unset($data['price']);
        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as &$item) {
                // items يمكن أن تحتوي على price وهذا صحيح لـ spare_part_items
                // لكن نتأكد من عدم وجود price في المستوى الرئيسي
            }
            unset($item);
        }
        
        $updateFields = [];
        $updateParams = [];
        
        if (isset($data['brand'])) {
            $updateFields[] = "brand = ?";
            $updateParams[] = trim($data['brand']);
        }
        if (isset($data['model'])) {
            $updateFields[] = "model = ?";
            $updateParams[] = trim($data['model']);
        }
        if (isset($data['barcode'])) {
            $updateFields[] = "barcode = ?";
            $updateParams[] = trim($data['barcode']);
        }
        if (isset($data['image'])) {
            $updateFields[] = "image = ?";
            $updateParams[] = trim($data['image']);
        }
        // لا نعدل purchase_price و selling_price في spare_parts الرئيسي - تم إزالتها
        
        // التأكد من عدم وجود price في الحقول المحدثة
        if (in_array('price', $updateFields, true) || isset($data['price'])) {
            response(false, 'خطأ: لا يمكن استخدام حقل price القديم. يرجى استخدام purchase_price و selling_price', null, 400);
        }
        
        if (!empty($updateFields)) {
            $updateFields[] = "updated_at = NOW()";
            $updateParams[] = $id;
            $query = "UPDATE spare_parts SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $result = dbExecute($query, $updateParams);
            
            if ($result === false) {
                global $lastDbError;
                $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
                
                // فحص إذا كان الخطأ متعلق بـ price
                if (stripos($error, 'price') !== false && stripos($error, 'Unknown column') !== false) {
                    response(false, 'خطأ: تم إرسال حقل price القديم. يرجى استخدام purchase_price و selling_price بدلاً منه. الخطأ: ' . $error, null, 500);
                } else {
                    response(false, 'خطأ في تعديل قطعة الغيار: ' . $error, null, 500);
                }
            }
        }
        
        // تحديث تفاصيل القطع
        if (isset($data['items']) && is_array($data['items'])) {
            // حذف القطع القديمة
            $deleteResult = dbExecute("DELETE FROM spare_part_items WHERE spare_part_id = ?", [$id]);
            if ($deleteResult === false) {
                global $lastDbError;
                $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
                response(false, 'خطأ في حذف تفاصيل القطع القديمة: ' . $error, null, 500);
            }
            
            // إضافة القطع الجديدة
            foreach ($data['items'] as $item) {
                $itemId = isset($item['id']) && !empty($item['id']) ? trim($item['id']) : generateId();
                $itemType = trim($item['item_type'] ?? '');
                $quantity = intval($item['quantity'] ?? 1);
                $purchasePrice = floatval($item['purchase_price'] ?? $item['price'] ?? 0);
                $sellingPrice = floatval($item['selling_price'] ?? $item['price'] ?? 0);
                $notes = trim($item['notes'] ?? '');
                $customValue = trim($item['custom_value'] ?? '');
                
                if (!empty($itemType)) {
                    // محاولة استخدام purchase_price و selling_price أولاً، وإذا لم تكن موجودة في الجدول، استخدم price
                    $insertResult = dbExecute(
                        "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, purchase_price, selling_price, price, notes, custom_value, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                         ON DUPLICATE KEY UPDATE 
                         item_type = VALUES(item_type),
                         quantity = VALUES(quantity),
                         purchase_price = VALUES(purchase_price),
                         selling_price = VALUES(selling_price),
                         price = VALUES(price),
                         notes = VALUES(notes),
                         custom_value = VALUES(custom_value),
                         updated_at = NOW()",
                        [$itemId, $id, $itemType, $quantity, $purchasePrice, $sellingPrice, $sellingPrice, $notes, $customValue]
                    );
                    
                    if ($insertResult === false) {
                        global $lastDbError;
                        $error = $lastDbError ?? 'خطأ غير معروف في قاعدة البيانات';
                        
                        // التحقق إذا كان الخطأ بسبب عدم وجود purchase_price أو selling_price
                        if (stripos($error, 'Unknown column') !== false && 
                            (stripos($error, 'purchase_price') !== false || stripos($error, 'selling_price') !== false)) {
                            // محاولة إدراج بدون purchase_price و selling_price إذا لم تكن موجودة
                            $insertResult = dbExecute(
                                "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, price, notes, custom_value, created_at) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                                 ON DUPLICATE KEY UPDATE 
                                 item_type = VALUES(item_type),
                                 quantity = VALUES(quantity),
                                 price = VALUES(price),
                                 notes = VALUES(notes),
                                 custom_value = VALUES(custom_value),
                                 updated_at = NOW()",
                                [$itemId, $id, $itemType, $quantity, $sellingPrice, $notes, $customValue]
                            );
                            if ($insertResult === false) {
                                response(false, 'خطأ في إضافة تفاصيل القطع: ' . ($lastDbError ?? 'خطأ غير معروف'), null, 500);
                            }
                        } else {
                            response(false, 'خطأ في إضافة تفاصيل القطع: ' . $error, null, 500);
                        }
                    }
                }
            }
        }
        
        response(true, 'تم تعديل قطعة الغيار بنجاح');
    }
    elseif ($type === 'accessories') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف الإكسسوار مطلوب', null, 400);
        }
        
        $accessory = dbSelectOne("SELECT id FROM accessories WHERE id = ?", [$id]);
        if (!$accessory) {
            response(false, 'الإكسسوار غير موجود', null, 404);
        }
        
        $updateFields = [];
        $updateParams = [];
        
        if (isset($data['name'])) {
            $updateFields[] = "name = ?";
            $updateParams[] = trim($data['name']);
        }
        if (isset($data['type'])) {
            $updateFields[] = "type = ?";
            $updateParams[] = trim($data['type']);
        }
        if (isset($data['image'])) {
            $updateFields[] = "image = ?";
            $updateParams[] = trim($data['image']);
        }
        if (isset($data['purchase_price'])) {
            $updateFields[] = "purchase_price = ?";
            $updateParams[] = floatval($data['purchase_price']);
        }
        if (isset($data['selling_price'])) {
            $updateFields[] = "selling_price = ?";
            $updateParams[] = floatval($data['selling_price']);
        }
        if (isset($data['quantity'])) {
            $updateFields[] = "quantity = ?";
            $updateParams[] = intval($data['quantity']);
        }
        
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $id;
        $query = "UPDATE accessories SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            response(false, 'خطأ في تعديل الإكسسوار', null, 500);
        }
        
        response(true, 'تم تعديل الإكسسوار بنجاح');
    }
    elseif ($type === 'phones') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف الهاتف مطلوب', null, 400);
        }
        
        $phone = dbSelectOne("SELECT id FROM phones WHERE id = ?", [$id]);
        if (!$phone) {
            response(false, 'الهاتف غير موجود', null, 404);
        }
        
        $updateFields = [];
        $updateParams = [];
        
        if (isset($data['brand'])) {
            $updateFields[] = "brand = ?";
            $updateParams[] = trim($data['brand']);
        }
        if (isset($data['model'])) {
            $updateFields[] = "model = ?";
            $updateParams[] = trim($data['model']);
        }
        if (isset($data['serial_number'])) {
            $updateFields[] = "serial_number = ?";
            $updateParams[] = trim($data['serial_number']);
        }
        if (isset($data['image'])) {
            $updateFields[] = "image = ?";
            $updateParams[] = trim($data['image']);
        }
        if (isset($data['tax_status'])) {
            $updateFields[] = "tax_status = ?";
            $updateParams[] = trim($data['tax_status']);
        }
        if (isset($data['tax_amount'])) {
            $updateFields[] = "tax_amount = ?";
            $updateParams[] = floatval($data['tax_amount']);
        }
        if (isset($data['storage'])) {
            $updateFields[] = "storage = ?";
            $updateParams[] = trim($data['storage']);
        }
        if (isset($data['ram'])) {
            $updateFields[] = "ram = ?";
            $updateParams[] = trim($data['ram']);
        }
        if (isset($data['screen_type'])) {
            $updateFields[] = "screen_type = ?";
            $updateParams[] = trim($data['screen_type']);
        }
        if (isset($data['processor'])) {
            $updateFields[] = "processor = ?";
            $updateParams[] = trim($data['processor']);
        }
        if (isset($data['battery'])) {
            $updateFields[] = "battery = ?";
            $updateParams[] = trim($data['battery']);
        }
        if (isset($data['accessories'])) {
            $updateFields[] = "accessories = ?";
            $updateParams[] = trim($data['accessories']);
        }
        if (isset($data['password'])) {
            $updateFields[] = "password = ?";
            $updateParams[] = trim($data['password']);
        }
        if (isset($data['maintenance_history'])) {
            $updateFields[] = "maintenance_history = ?";
            $updateParams[] = trim($data['maintenance_history']);
        }
        if (isset($data['defects'])) {
            $updateFields[] = "defects = ?";
            $updateParams[] = trim($data['defects']);
        }
        if (isset($data['purchase_price'])) {
            $updateFields[] = "purchase_price = ?";
            $updateParams[] = floatval($data['purchase_price']);
        }
        if (isset($data['selling_price'])) {
            $updateFields[] = "selling_price = ?";
            $updateParams[] = floatval($data['selling_price']);
        }
        
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $id;
        $query = "UPDATE phones SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            response(false, 'خطأ في تعديل الهاتف', null, 500);
        }
        
        response(true, 'تم تعديل الهاتف بنجاح');
    }
    else {
        // تعديل المخزون القديم (للتوافق)
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف القطعة مطلوب', null, 400);
        }
        
        $item = dbSelectOne("SELECT id FROM inventory WHERE id = ?", [$id]);
        if (!$item) {
            response(false, 'قطعة الغيار غير موجودة', null, 404);
        }
        
        $updateFields = [];
        $updateParams = [];
        
        if (isset($data['name'])) {
            $updateFields[] = "name = ?";
            $updateParams[] = trim($data['name']);
        }
        if (isset($data['quantity'])) {
            $updateFields[] = "quantity = ?";
            $updateParams[] = intval($data['quantity']);
        }
        
        // دعم الحقول القديمة: إذا كان price موجوداً، استخدمه كـ selling_price
        if (isset($data['price']) && !isset($data['purchase_price']) && !isset($data['selling_price'])) {
            $updateFields[] = "selling_price = ?";
            $updateParams[] = floatval($data['price']);
        } else {
            if (isset($data['purchase_price'])) {
                $updateFields[] = "purchase_price = ?";
                $updateParams[] = floatval($data['purchase_price']);
            }
            if (isset($data['selling_price'])) {
                $updateFields[] = "selling_price = ?";
                $updateParams[] = floatval($data['selling_price']);
            }
        }
        
        if (isset($data['category'])) {
            $updateFields[] = "category = ?";
            $updateParams[] = trim($data['category']);
        }
        
        if (empty($updateFields)) {
            response(false, 'لا توجد بيانات للتحديث', null, 400);
        }
        
        $updateFields[] = "updated_at = NOW()";
        $updateParams[] = $id;
        $query = "UPDATE inventory SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $result = dbExecute($query, $updateParams);
        
        if ($result === false) {
            response(false, 'خطأ في تعديل قطعة الغيار', null, 500);
        }
        
        response(true, 'تم تعديل قطعة الغيار بنجاح');
    }
}

// حذف البيانات
if ($method === 'DELETE') {
    if (!checkInventoryPermission('write')) {
        response(false, 'ليس لديك صلاحية لحذف المخزون', null, 403);
    }
    checkPermission('admin');
    
    if ($type === 'spare_parts') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف قطعة الغيار مطلوب', null, 400);
        }
        
        $part = dbSelectOne("SELECT id FROM spare_parts WHERE id = ?", [$id]);
        if (!$part) {
            response(false, 'قطعة الغيار غير موجودة', null, 404);
        }
        
        // حذف تفاصيل القطع أولاً (CASCADE سيتولى ذلك تلقائياً)
        dbExecute("DELETE FROM spare_part_items WHERE spare_part_id = ?", [$id]);
        $result = dbExecute("DELETE FROM spare_parts WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف قطعة الغيار', null, 500);
        }
        
        response(true, 'تم حذف قطعة الغيار بنجاح');
    }
    elseif ($type === 'accessories') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف الإكسسوار مطلوب', null, 400);
        }
        
        $accessory = dbSelectOne("SELECT id FROM accessories WHERE id = ?", [$id]);
        if (!$accessory) {
            response(false, 'الإكسسوار غير موجود', null, 404);
        }
        
        $result = dbExecute("DELETE FROM accessories WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف الإكسسوار', null, 500);
        }
        
        response(true, 'تم حذف الإكسسوار بنجاح');
    }
    elseif ($type === 'phones') {
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف الهاتف مطلوب', null, 400);
        }
        
        $phone = dbSelectOne("SELECT id FROM phones WHERE id = ?", [$id]);
        if (!$phone) {
            response(false, 'الهاتف غير موجود', null, 404);
        }
        
        $result = dbExecute("DELETE FROM phones WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف الهاتف', null, 500);
        }
        
        response(true, 'تم حذف الهاتف بنجاح');
    }
    else {
        // حذف من المخزون القديم (للتوافق)
        $id = $data['id'] ?? '';
        
        if (empty($id)) {
            response(false, 'معرف القطعة مطلوب', null, 400);
        }
        
        $item = dbSelectOne("SELECT id FROM inventory WHERE id = ?", [$id]);
        if (!$item) {
            response(false, 'قطعة الغيار غير موجودة', null, 404);
        }
        
        $result = dbExecute("DELETE FROM inventory WHERE id = ?", [$id]);
        
        if ($result === false) {
            response(false, 'خطأ في حذف قطعة الغيار', null, 500);
        }
        
        response(true, 'تم حذف قطعة الغيار بنجاح');
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

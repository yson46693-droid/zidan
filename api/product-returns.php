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
 * إضافة منتج مرتجع إلى المخزون
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
            // لقطع الغيار، ننشئ spare_part_item جديد لأننا لا نعرف القطعة الفرعية الأصلية
            // التحقق من وجود spare_part أولاً
            $sparePart = dbSelectOne("SELECT id FROM spare_parts WHERE id = ?", [$itemId]);
            
            if (!$sparePart) {
                error_log('تحذير: قطعة الغيار غير موجودة: ' . $itemId);
                return false;
            }
            
            // إنشاء spare_part_item جديد
            $newItemId = generateId();
            
            // التحقق من وجود الأعمدة
            $hasPurchasePrice = dbColumnExists('spare_part_items', 'purchase_price');
            $hasSellingPrice = dbColumnExists('spare_part_items', 'selling_price');
            $hasPrice = dbColumnExists('spare_part_items', 'price');
            
            if ($hasPurchasePrice && $hasSellingPrice) {
                dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, 'original', ?, ?, ?, NOW())",
                    [$newItemId, $itemId, $quantity, $unitPrice, $unitPrice]
                );
            } elseif ($hasPrice) {
                dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, price, created_at) 
                     VALUES (?, ?, 'original', ?, ?, NOW())",
                    [$newItemId, $itemId, $quantity, $unitPrice]
                );
            } else {
                dbExecute(
                    "INSERT INTO spare_part_items (id, spare_part_id, item_type, quantity, created_at) 
                     VALUES (?, ?, 'original', ?, NOW())",
                    [$newItemId, $itemId, $quantity]
                );
            }
        } elseif ($itemType === 'accessory') {
            // البحث عن الإكسسوار
            $accessory = dbSelectOne("SELECT id, quantity FROM accessories WHERE id = ?", [$itemId]);
            
            if ($accessory) {
                // تحديث الكمية الموجودة
                $currentQuantity = intval($accessory['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                dbExecute(
                    "UPDATE accessories SET quantity = ? WHERE id = ?",
                    [$newQuantity, $itemId]
                );
            } else {
                // إنشاء إكسسوار جديد
                dbExecute(
                    "INSERT INTO accessories (id, name, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())",
                    [$itemId, $itemName, $quantity, $unitPrice, $unitPrice]
                );
            }
        } elseif ($itemType === 'phone') {
            // للهواتف، نحتاج إلى إعادة إنشاء الهاتف من بيانات sale_item notes
            $phoneData = null;
            if (!empty($item['notes'])) {
                $phoneData = json_decode($item['notes'], true);
            }
            
            if ($phoneData && is_array($phoneData)) {
                // إنشاء هاتف جديد بنفس البيانات
                $newPhoneId = generateId();
                dbExecute(
                    "INSERT INTO phones (id, brand, model, serial_number, storage, ram, screen_type, processor, battery, 
                     accessories, password, maintenance_history, defects, tax_status, tax_amount, 
                     purchase_price, selling_price, image, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    [
                        $newPhoneId,
                        $phoneData['brand'] ?? '',
                        $phoneData['model'] ?? '',
                        $phoneData['serial_number'] ?? '',
                        $phoneData['storage'] ?? '',
                        $phoneData['ram'] ?? '',
                        $phoneData['screen_type'] ?? '',
                        $phoneData['processor'] ?? '',
                        $phoneData['battery'] ?? '',
                        $phoneData['accessories'] ?? '',
                        $phoneData['password'] ?? '',
                        $phoneData['maintenance_history'] ?? '',
                        $phoneData['defects'] ?? '',
                        $phoneData['tax_status'] ?? '',
                        floatval($phoneData['tax_amount'] ?? 0),
                        floatval($phoneData['purchase_price'] ?? $unitPrice),
                        floatval($phoneData['selling_price'] ?? $unitPrice),
                        $phoneData['image'] ?? ''
                    ]
                );
            }
        } elseif ($itemType === 'inventory') {
            // البحث عن المنتج في المخزون
            $inventoryItem = dbSelectOne("SELECT id, quantity FROM inventory WHERE id = ?", [$itemId]);
            
            if ($inventoryItem) {
                // تحديث الكمية الموجودة
                $currentQuantity = intval($inventoryItem['quantity'] ?? 0);
                $newQuantity = $currentQuantity + $quantity;
                dbExecute(
                    "UPDATE inventory SET quantity = ? WHERE id = ?",
                    [$newQuantity, $itemId]
                );
            } else {
                // إنشاء منتج جديد في المخزون
                dbExecute(
                    "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, created_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())",
                    [$itemId, $itemName, $quantity, $unitPrice, $unitPrice]
                );
            }
        }
        
        return true;
    } catch (Exception $e) {
        error_log('خطأ في إضافة منتج مرتجع للمخزون: ' . $e->getMessage());
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
        
        // جلب عناصر الفاتورة
        $items = dbSelect(
            "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
            [$sale['id']]
        );
        
        // معالجة عناصر البيع
        $processedItems = [];
        foreach ($items as $item) {
            // إذا كان العنصر هاتف وله بيانات في notes (JSON)
            if ($item['item_type'] === 'phone' && !empty($item['notes'])) {
                $phoneData = json_decode($item['notes'], true);
                if ($phoneData && is_array($phoneData)) {
                    $item['phone_data'] = $phoneData;
                }
            }
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
        
        if ($returnedQuantity > $originalQuantity) {
            response(false, 'الكمية المراد إرجاعها (' . $returnedQuantity . ') أكبر من الكمية المباعة (' . $originalQuantity . ')', null, 400);
            return;
        }
        
        $unitPrice = floatval($saleItem['unit_price'] ?? 0);
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
                    error_log('تحذير: فشل إضافة منتج مرتجع للمخزون: ' . $saleItem['item_name']);
                    // لا نوقف العملية، فقط نسجل التحذير
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


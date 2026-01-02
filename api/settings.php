<?php
require_once 'config.php';

// دعم _method للاستضافات المجانية
$data = getRequestData();
$method = $data['_method'] ?? getRequestMethod();

// قراءة الإعدادات
if ($method === 'GET') {
    checkAuth();
    
    $settingsRows = dbSelect("SELECT `key`, `value` FROM settings");
    
    if ($settingsRows === false) {
        response(false, 'خطأ في قراءة الإعدادات', null, 500);
    }
    
    $settings = [];
    foreach ($settingsRows as $row) {
        if (isset($row['key']) && isset($row['value'])) {
            $settings[$row['key']] = $row['value'];
        }
    }
    
    // إذا كانت الإعدادات فارغة، نرجع object فارغ بدلاً من array فارغ
    // هذا يضمن أن JavaScript يتعامل معها كـ object وليس array
    if (empty($settings)) {
        $settings = (object)[]; // object فارغ
    }
    
    response(true, '', $settings);
}

// تحديث الإعدادات
if ($method === 'PUT') {
    checkPermission('admin');
    if (!isset($data['shop_name'])) {
        $data = getRequestData();
    }
    
    $allowedKeys = ['shop_name', 'shop_phone', 'shop_address', 'shop_logo', 'low_stock_alert', 'currency', 'theme', 'loading_page_enabled', 'whatsapp_number', 'shop_name_2', 'shop_phone_2', 'shop_address_2', 'currency_2', 'whatsapp_number_2'];
    
    foreach ($allowedKeys as $key) {
        if (isset($data[$key])) {
            $value = $data[$key];
            
            // التحقق من وجود الإعداد
            $existing = dbSelectOne("SELECT id FROM settings WHERE `key` = ?", [$key]);
            
            if ($existing) {
                // تحديث
                dbExecute("UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?", [$value, $key]);
            } else {
                // إضافة
                dbExecute("INSERT INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())", [$key, $value]);
            }
        }
    }
    
    // قراءة الإعدادات المحدثة
    $settingsRows = dbSelect("SELECT `key`, `value` FROM settings");
    $settings = [];
    foreach ($settingsRows as $row) {
        $settings[$row['key']] = $row['value'];
    }
    
    response(true, 'تم حفظ الإعدادات بنجاح', $settings);
}

// النسخ الاحتياطي - تصدير جميع البيانات
if ($method === 'POST' && isset($_GET['action']) && $_GET['action'] === 'backup') {
    checkPermission('admin');
    
    $backup = [
        'users' => dbSelect("SELECT id, username, name, role, created_at, updated_at FROM users"),
        'repairs' => dbSelect("SELECT * FROM repairs"),
        'customers' => dbSelect("SELECT * FROM customers"),
        'inventory' => dbSelect("SELECT * FROM inventory"),
        'expenses' => dbSelect("SELECT * FROM expenses"),
        'loss_operations' => dbSelect("SELECT * FROM loss_operations"),
        'settings' => [],
        'backup_date' => date('Y-m-d H:i:s')
    ];
    
    // إضافة الإعدادات
    $settingsRows = dbSelect("SELECT `key`, `value` FROM settings");
    foreach ($settingsRows as $row) {
        $backup['settings'][$row['key']] = $row['value'];
    }
    
    response(true, 'تم إنشاء النسخة الاحتياطية بنجاح', $backup);
}

// استعادة البيانات
if ($method === 'POST' && isset($_GET['action']) && $_GET['action'] === 'restore') {
    checkPermission('admin');
    $data = getRequestData();
    
    dbBeginTransaction();
    
    try {
        // استعادة المستخدمين
        if (isset($data['users']) && is_array($data['users'])) {
            // حذف المستخدمين الحاليين (عدا المستخدم الحالي)
            $session = checkAuth();
            dbExecute("DELETE FROM users WHERE id != ?", [$session['user_id']]);
            
            foreach ($data['users'] as $user) {
                if (isset($user['id']) && $user['id'] !== $session['user_id']) {
                    dbExecute(
                        "INSERT INTO users (id, username, password, name, role, created_at, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), updated_at = VALUES(updated_at)",
                        [
                            $user['id'],
                            $user['username'],
                            $user['password'] ?? password_hash('temp123', PASSWORD_DEFAULT),
                            $user['name'],
                            $user['role'],
                            $user['created_at'] ?? date('Y-m-d H:i:s'),
                            $user['updated_at'] ?? null
                        ]
                    );
                }
            }
        }
        
        // استعادة العملاء
        if (isset($data['customers']) && is_array($data['customers'])) {
            dbExecute("DELETE FROM customers");
            foreach ($data['customers'] as $customer) {
                dbExecute(
                    "INSERT INTO customers (id, name, phone, address, created_at, updated_at, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        $customer['id'],
                        $customer['name'],
                        $customer['phone'],
                        $customer['address'] ?? '',
                        $customer['created_at'] ?? date('Y-m-d H:i:s'),
                        $customer['updated_at'] ?? null,
                        $customer['created_by'] ?? null
                    ]
                );
            }
        }
        
        // استعادة عمليات الصيانة
        if (isset($data['repairs']) && is_array($data['repairs'])) {
            dbExecute("DELETE FROM repairs");
            foreach ($data['repairs'] as $repair) {
                dbExecute(
                    "INSERT INTO repairs (
                        id, repair_number, customer_id, customer_name, customer_phone,
                        device_type, device_model, serial_number, accessories, problem,
                        customer_price, repair_cost, parts_store, paid_amount, remaining_amount,
                        delivery_date, device_image, status, notes, created_at, updated_at, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $repair['id'],
                        $repair['repair_number'],
                        $repair['customer_id'] ?? null,
                        $repair['customer_name'],
                        $repair['customer_phone'],
                        $repair['device_type'],
                        $repair['device_model'] ?? '',
                        $repair['serial_number'] ?? '',
                        $repair['accessories'] ?? '',
                        $repair['problem'],
                        $repair['customer_price'] ?? $repair['cost'] ?? 0,
                        $repair['repair_cost'] ?? 0,
                        $repair['parts_store'] ?? '',
                        $repair['paid_amount'] ?? 0,
                        $repair['remaining_amount'] ?? 0,
                        $repair['delivery_date'] ?? null,
                        $repair['device_image'] ?? '',
                        $repair['status'] ?? 'pending',
                        $repair['notes'] ?? '',
                        $repair['created_at'] ?? date('Y-m-d H:i:s'),
                        $repair['updated_at'] ?? null,
                        $repair['created_by'] ?? null
                    ]
                );
            }
        }
        
        // استعادة المخزن
        if (isset($data['inventory']) && is_array($data['inventory'])) {
            dbExecute("DELETE FROM inventory");
            foreach ($data['inventory'] as $item) {
                // التعامل مع البيانات القديمة: تحويل price إلى purchase_price و selling_price
                $purchase_price = 0;
                $selling_price = 0;
                
                if (isset($item['price']) && !isset($item['purchase_price']) && !isset($item['selling_price'])) {
                    // البيانات القديمة: استخدم price كـ selling_price
                    $selling_price = floatval($item['price'] ?? 0);
                } else {
                    $purchase_price = floatval($item['purchase_price'] ?? 0);
                    $selling_price = floatval($item['selling_price'] ?? 0);
                }
                
                $result = dbExecute(
                    "INSERT INTO inventory (id, name, quantity, purchase_price, selling_price, category, created_at, updated_at, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $item['id'],
                        $item['name'],
                        $item['quantity'] ?? 0,
                        $purchase_price,
                        $selling_price,
                        $item['category'] ?? '',
                        $item['created_at'] ?? date('Y-m-d H:i:s'),
                        $item['updated_at'] ?? null,
                        $item['created_by'] ?? null
                    ]
                );
                
                if ($result === false) {
                    global $lastDbError;
                    error_log('خطأ في استعادة عنصر من المخزن: ' . ($lastDbError ?? 'خطأ غير معروف'));
                }
            }
        }
        
        // استعادة المصروفات
        if (isset($data['expenses']) && is_array($data['expenses'])) {
            dbExecute("DELETE FROM expenses");
            foreach ($data['expenses'] as $expense) {
                $expenseDate = $expense['date'] ?? $expense['expense_date'] ?? date('Y-m-d');
                dbExecute(
                    "INSERT INTO expenses (id, type, amount, description, expense_date, created_at, updated_at, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $expense['id'],
                        $expense['type'],
                        $expense['amount'],
                        $expense['description'] ?? '',
                        $expenseDate,
                        $expense['created_at'] ?? date('Y-m-d H:i:s'),
                        $expense['updated_at'] ?? null,
                        $expense['created_by'] ?? null
                    ]
                );
            }
        }
        
        // استعادة العمليات الخاسرة
        if (isset($data['loss_operations']) && is_array($data['loss_operations'])) {
            dbExecute("DELETE FROM loss_operations");
            foreach ($data['loss_operations'] as $loss) {
                dbExecute(
                    "INSERT INTO loss_operations (id, repair_number, customer_name, device_type, problem, loss_amount, loss_reason, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $loss['id'],
                        $loss['repair_number'],
                        $loss['customer_name'],
                        $loss['device_type'],
                        $loss['problem'],
                        $loss['loss_amount'],
                        $loss['loss_reason'],
                        $loss['created_at'] ?? date('Y-m-d H:i:s'),
                        $loss['updated_at'] ?? null
                    ]
                );
            }
        }
        
        // استعادة الإعدادات
        if (isset($data['settings']) && is_array($data['settings'])) {
            foreach ($data['settings'] as $key => $value) {
                $existing = dbSelectOne("SELECT id FROM settings WHERE `key` = ?", [$key]);
                if ($existing) {
                    dbExecute("UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?", [$value, $key]);
                } else {
                    dbExecute("INSERT INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())", [$key, $value]);
                }
            }
        }
        
        dbCommit();
        response(true, 'تم استعادة البيانات بنجاح');
        
    } catch (Exception $e) {
        dbRollback();
        response(false, 'خطأ في استعادة البيانات: ' . $e->getMessage(), null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

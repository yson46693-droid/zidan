<?php
/**
 * API لعرض الفاتورة من قاعدة البيانات
 * يستخدم قالب واحد مع متغيرات من قاعدة البيانات
 */

require_once 'config.php';
require_once 'invoices.php';

// التحقق من المصادقة
checkAuth();

// جلب sale_id من الطلب
// ✅ تنظيف معرف الفاتورة
$saleId = cleanId($_GET['sale_id'] ?? '');
$saleId = !empty($saleId) ? $saleId : null;

if (empty($saleId)) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h1>خطأ</h1><p>معرف الفاتورة مطلوب</p></body></html>';
    exit;
}

try {
    // جلب بيانات الفاتورة من قاعدة البيانات
    $sale = dbSelectOne(
        "SELECT s.*, u.name as created_by_name 
         FROM sales s 
         LEFT JOIN users u ON s.created_by = u.id 
         WHERE s.id = ?",
        [$saleId]
    );
    
    if (!$sale) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h1>خطأ</h1><p>الفاتورة غير موجودة</p></body></html>';
        exit;
    }
    
    // جلب عناصر الفاتورة
    $items = dbSelect(
        "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
        [$saleId]
    );
    
    // معالجة عناصر البيع وإضافة بيانات الهاتف إذا كانت موجودة
    $processedItems = [];
    foreach ($items as $item) {
        // إذا كان العنصر هاتف
        if ($item['item_type'] === 'phone') {
            $phoneData = null;
            
            // محاولة جلب بيانات الهاتف من notes (JSON)
            if (!empty($item['notes'])) {
                $notesData = json_decode($item['notes'], true);
                if ($notesData && is_array($notesData)) {
                    if (isset($notesData['phone_data'])) {
                        $phoneData = $notesData['phone_data'];
                    } else {
                        // للتوافق مع البيانات القديمة - إذا كانت البيانات مباشرة في notes
                        $phoneData = $notesData;
                    }
                }
            }
            
            // إذا لم تكن بيانات الهاتف موجودة في notes، جلبها من جدول phones
            if (!$phoneData && !empty($item['item_id'])) {
                try {
                    $phoneFromDB = dbSelectOne(
                        "SELECT brand, model, serial_number, storage, ram, screen_type, processor, battery, 
                                battery_percent, accessories, password, maintenance_history, defects, tax_status, tax_amount,
                                purchase_price, selling_price, image
                         FROM phones WHERE id = ?",
                        [$item['item_id']]
                    );
                    if ($phoneFromDB) {
                        $phoneData = $phoneFromDB;
                    }
                } catch (Exception $e) {
                    error_log('خطأ في جلب بيانات الهاتف من قاعدة البيانات: ' . $e->getMessage());
                }
            }
            
            // إضافة phone_data إلى العنصر
            if ($phoneData) {
                $item['phone_data'] = $phoneData;
            }
        }
        $processedItems[] = $item;
    }
    $sale['items'] = (is_array($processedItems) && count($processedItems) > 0) ? $processedItems : [];
    
    // التأكد من وجود sale_number
    if (empty($sale['sale_number'])) {
        $sale['sale_number'] = $sale['id'];
    }
    
    // التأكد من وجود القيم الرقمية
    $sale['total_amount'] = floatval($sale['total_amount'] ?? 0);
    $sale['final_amount'] = floatval($sale['final_amount'] ?? 0);
    $sale['discount'] = floatval($sale['discount'] ?? 0);
    $sale['tax'] = floatval($sale['tax'] ?? 0);
    $sale['paid_amount'] = floatval($sale['paid_amount'] ?? 0);
    $sale['remaining_amount'] = floatval($sale['remaining_amount'] ?? 0);
    
    // محاولة جلب invoice_data من قاعدة البيانات
    $invoiceData = null;
    if (!empty($sale['invoice_data'])) {
        $invoiceData = json_decode($sale['invoice_data'], true);
    }
    
    // إذا لم تكن invoice_data موجودة، إنشاؤها من البيانات الحالية
    // أو إذا كانت موجودة لكن items لا تحتوي على phone_data، تحديثها
    $needsUpdate = false;
    if (!$invoiceData || !is_array($invoiceData)) {
        $needsUpdate = true;
    } else {
        // التحقق من أن items تحتوي على phone_data إذا كانت هناك هواتف
        foreach ($invoiceData['items'] ?? [] as $item) {
            if (($item['item_type'] ?? '') === 'phone' && empty($item['phone_data'])) {
                // إذا كان هناك هاتف بدون phone_data، نحتاج لتحديث invoice_data
                $needsUpdate = true;
                break;
            }
        }
    }
    
    if ($needsUpdate) {
        // جلب إعدادات المتجر
        $shopSettings = getShopSettings();
        
        // استخدام items المحدثة (التي تحتوي على phone_data)
        $itemsForInvoice = $sale['items'];
        
        // إنشاء بيانات الفاتورة
        $invoiceData = [
            'sale_id' => $sale['id'],
            'sale_number' => $sale['sale_number'],
            'created_at' => $sale['created_at'],
            'customer' => [
                'id' => $sale['customer_id'] ?? null,
                'name' => $sale['customer_name'] ?? '',
                'phone' => $sale['customer_phone'] ?? ''
            ],
            'items' => $itemsForInvoice, // استخدام items المحدثة التي تحتوي على phone_data
            'amounts' => [
                'total_amount' => $sale['total_amount'],
                'discount' => $sale['discount'],
                'tax' => $sale['tax'],
                'final_amount' => $sale['final_amount'],
                'paid_amount' => $sale['paid_amount'],
                'remaining_amount' => $sale['remaining_amount']
            ],
            'shop_settings' => $shopSettings,
            'created_by_name' => $sale['created_by_name'] ?? 'غير محدد',
            'branch_name' => 'الهانوفيل' // يمكن جلبها من قاعدة البيانات لاحقاً
        ];
        
        // حفظ invoice_data في قاعدة البيانات للاستخدام المستقبلي
        if (dbColumnExists('sales', 'invoice_data')) {
            $invoiceDataJson = json_encode($invoiceData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            dbExecute(
                "UPDATE sales SET invoice_data = ? WHERE id = ?",
                [$invoiceDataJson, $sale['id']]
            );
        }
    } else {
        // إذا كانت invoice_data موجودة، استخدام items المحدثة (التي تحتوي على phone_data)
        $invoiceData['items'] = $sale['items'];
    }
    
    // إنشاء HTML للفاتورة باستخدام القالب
    // استخدام shop_settings من invoice_data إذا كانت موجودة، وإلا جلبها من قاعدة البيانات
    $shopSettings = $invoiceData['shop_settings'] ?? getShopSettings();
    $htmlContent = generateInvoiceHTML($sale, $shopSettings);
    
    // إرجاع HTML للفاتورة
    header('Content-Type: text/html; charset=utf-8');
    echo $htmlContent;
    
} catch (Exception $e) {
    error_log('خطأ في عرض الفاتورة: ' . $e->getMessage());
    http_response_code(500);
    echo '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h1>حدث خطأ في عرض الفاتورة</h1><p>' . htmlspecialchars($e->getMessage()) . '</p></body></html>';
}
?>


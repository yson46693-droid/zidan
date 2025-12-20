<?php
/**
 * API لحفظ وإدارة الفواتير كملفات HTML
 */

require_once 'config.php';

// تعريف مجلد الفواتير
define('INVOICES_DIR', __DIR__ . '/../invoices/');

// التأكد من وجود مجلد الفواتير
if (!file_exists(INVOICES_DIR)) {
    mkdir(INVOICES_DIR, 0755, true);
}

// حماية المجلد بملف .htaccess
$htaccessFile = INVOICES_DIR . '.htaccess';
if (!file_exists($htaccessFile)) {
    file_put_contents($htaccessFile, "Options -Indexes\nDeny from all\n");
}

/**
 * حفظ الفاتورة كملف HTML
 * @param array $saleData - بيانات الفاتورة
 * @return string|null - مسار الملف المحفوظ أو null في حالة الفشل
 */
function saveInvoiceAsFile($saleData) {
    try {
        // التأكد من وجود البيانات الأساسية
        if (empty($saleData['id']) || empty($saleData['sale_number'])) {
            error_log('خطأ في حفظ الفاتورة: بيانات غير مكتملة');
            return null;
        }
        
        // جلب إعدادات المتجر
        $shopSettings = getShopSettings();
        
        // إنشاء محتوى HTML للفاتورة
        $htmlContent = generateInvoiceHTML($saleData, $shopSettings);
        
        // إنشاء اسم الملف: invoice_{sale_number}.html
        $filename = 'invoice_' . $saleData['sale_number'] . '.html';
        $filepath = INVOICES_DIR . $filename;
        
        // حفظ الملف
        $result = file_put_contents($filepath, $htmlContent);
        
        if ($result === false) {
            error_log('خطأ في حفظ ملف الفاتورة: ' . $filepath);
            return null;
        }
        
        // حفظ مسار الملف النسبي (للاستخدام في الويب)
        $relativePath = 'invoices/' . $filename;
        
        // تحديث قاعدة البيانات بحفظ مسار الملف (اختياري)
        // يمكن إضافة عمود invoice_file_path في جدول sales
        
        return $relativePath;
        
    } catch (Exception $e) {
        error_log('خطأ في حفظ الفاتورة: ' . $e->getMessage());
        return null;
    }
}

/**
 * جلب إعدادات المتجر
 * @return array
 */
function getShopSettings() {
    $settings = [];
    
    try {
        $shopName = dbSelectOne("SELECT value FROM settings WHERE `key` = 'shop_name'");
        $shopPhone = dbSelectOne("SELECT value FROM settings WHERE `key` = 'shop_phone'");
        $shopAddress = dbSelectOne("SELECT value FROM settings WHERE `key` = 'shop_address'");
        $shopLogo = dbSelectOne("SELECT value FROM settings WHERE `key` = 'shop_logo'");
        $currency = dbSelectOne("SELECT value FROM settings WHERE `key` = 'currency'");
        
        $settings['shop_name'] = $shopName['value'] ?? 'ALAA ZIDAN';
        $settings['shop_phone'] = $shopPhone['value'] ?? '';
        $settings['shop_address'] = $shopAddress['value'] ?? '';
        $settings['shop_logo'] = $shopLogo['value'] ?? '';
        $settings['currency'] = $currency['value'] ?? 'ج.م';
    } catch (Exception $e) {
        error_log('خطأ في جلب إعدادات المتجر: ' . $e->getMessage());
    }
    
    return $settings;
}

/**
 * إنشاء محتوى HTML للفاتورة
 * @param array $saleData - بيانات الفاتورة
 * @param array $shopSettings - إعدادات المتجر
 * @return string - محتوى HTML
 */
function generateInvoiceHTML($saleData, $shopSettings) {
    $shopName = $shopSettings['shop_name'] ?? 'ALAA ZIDAN';
    $shopPhone = $shopSettings['shop_phone'] ?? '';
    $shopAddress = $shopSettings['shop_address'] ?? '';
    $shopLogo = $shopSettings['shop_logo'] ?? '';
    $currency = $shopSettings['currency'] ?? 'ج.م';
    
    // تنسيق التاريخ
    $dateTime = formatDateTime12Hour($saleData['created_at'] ?? date('Y-m-d H:i:s'));
    
    // معالجة اللوجو
    $logoHtml = '';
    if (!empty($shopLogo)) {
        $logoHtml = '<img src="' . htmlspecialchars($shopLogo) . '" alt="' . htmlspecialchars($shopName) . '" style="max-width: 300px; max-height: 300px; display: block; margin: 0 auto;">';
    } else {
        // استخدام اللوجو الافتراضي
        $logoHtml = '<img src="../vertopal.com_photo_5922357566287580087_y.png" alt="' . htmlspecialchars($shopName) . '" style="max-width: 300px; max-height: 300px; display: block; margin: 0 auto;" onerror="this.style.display=\'none\'">';
    }
    
    // جدول العناصر
    $itemsHtml = '';
    $items = $saleData['items'] ?? [];
    foreach ($items as $index => $item) {
        $itemsHtml .= '<tr>';
        $itemsHtml .= '<td style="text-align: center; padding: 10px;">' . ($index + 1) . '</td>';
        $itemsHtml .= '<td style="padding: 10px;">' . htmlspecialchars($item['item_name'] ?? '') . '</td>';
        $itemsHtml .= '<td style="text-align: center; padding: 10px;">' . htmlspecialchars($item['quantity'] ?? 0) . '</td>';
        $itemsHtml .= '<td style="text-align: right; padding: 10px;">' . number_format($item['unit_price'] ?? 0, 2) . ' ' . $currency . '</td>';
        $itemsHtml .= '<td style="text-align: right; padding: 10px;">' . number_format($item['total_price'] ?? 0, 2) . ' ' . $currency . '</td>';
        $itemsHtml .= '</tr>';
    }
    
    // حساب المبالغ
    $totalAmount = floatval($saleData['total_amount'] ?? 0);
    $discount = floatval($saleData['discount'] ?? 0);
    $tax = floatval($saleData['tax'] ?? 0);
    $finalAmount = floatval($saleData['final_amount'] ?? 0);
    
    // HTML كامل للفاتورة
    $html = '<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ' . htmlspecialchars($saleData['sale_number'] ?? '') . '</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Cairo", "Tajawal", "Arial", sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .invoice-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2196F3;
        }
        .invoice-header img {
            margin-bottom: 15px;
        }
        .invoice-header h1 {
            color: #2196F3;
            margin-bottom: 10px;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
        }
        .invoice-info > div {
            flex: 1;
        }
        .invoice-info strong {
            color: #2196F3;
            display: block;
            margin-bottom: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        table th {
            background: #2196F3;
            color: white;
            padding: 12px;
            text-align: right;
            font-weight: 600;
        }
        table td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        table tr:hover {
            background: #f9f9f9;
        }
        .invoice-summary {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
        }
        .summary-row.total {
            font-size: 1.3em;
            font-weight: bold;
            color: #2196F3;
            border-bottom: 2px solid #2196F3;
            margin-top: 10px;
            padding-top: 15px;
        }
        .invoice-footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            color: #666;
        }
        @media print {
            body { background: white; padding: 0; }
            .invoice-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            ' . $logoHtml . '
            <h1>' . htmlspecialchars($shopName) . '</h1>
            ' . (!empty($shopAddress) ? '<p>' . htmlspecialchars($shopAddress) . '</p>' : '') . '
            ' . (!empty($shopPhone) ? '<p>تلفون: ' . htmlspecialchars($shopPhone) . '</p>' : '') . '
        </div>
        
        <div class="invoice-info">
            <div>
                <strong>العميل:</strong>
                ' . htmlspecialchars($saleData['customer_name'] ?? '') . '
                <br><br>
                <strong>رقم الهاتف:</strong>
                ' . htmlspecialchars($saleData['customer_phone'] ?? '') . '
            </div>
            <div style="text-align: right;">
                <strong>رقم الفاتورة:</strong>
                ' . htmlspecialchars($saleData['sale_number'] ?? '') . '
                <br><br>
                <strong>التاريخ:</strong>
                ' . htmlspecialchars($dateTime) . '
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th>المنتج</th>
                    <th style="width: 80px;">الكمية</th>
                    <th style="width: 120px;">سعر الوحدة</th>
                    <th style="width: 120px;">الإجمالي</th>
                </tr>
            </thead>
            <tbody>
                ' . $itemsHtml . '
            </tbody>
        </table>
        
        <div class="invoice-summary">
            <div class="summary-row">
                <span>المجموع الفرعي:</span>
                <span>' . number_format($totalAmount, 2) . ' ' . $currency . '</span>
            </div>';
    
    if ($discount > 0) {
        $html .= '
            <div class="summary-row">
                <span>الخصم:</span>
                <span>- ' . number_format($discount, 2) . ' ' . $currency . '</span>
            </div>';
    }
    
    if ($tax > 0) {
        $html .= '
            <div class="summary-row">
                <span>الضريبة:</span>
                <span>' . number_format($tax, 2) . ' ' . $currency . '</span>
            </div>';
    }
    
    $html .= '
            <div class="summary-row total">
                <span>الإجمالي:</span>
                <span>' . number_format($finalAmount, 2) . ' ' . $currency . '</span>
            </div>
        </div>
        
        <div class="invoice-footer">
            <p>شكراً لزيارتك</p>
            <p style="margin-top: 10px; font-size: 0.9em;">' . htmlspecialchars($shopName) . '</p>
        </div>
    </div>
</body>
</html>';
    
    return $html;
}

/**
 * تنسيق التاريخ والوقت بصيغة 12 ساعة
 * @param string $dateString
 * @return string
 */
function formatDateTime12Hour($dateString) {
    if (empty($dateString)) {
        return '-';
    }
    
    try {
        $date = new DateTime($dateString);
        $year = $date->format('Y');
        $month = $date->format('m');
        $day = $date->format('d');
        $hour = (int)$date->format('H');
        $minute = $date->format('i');
        
        $ampm = $hour >= 12 ? 'مساءً' : 'صباحاً';
        $hour12 = $hour % 12;
        $hour12 = $hour12 ? $hour12 : 12;
        $hour12 = str_pad($hour12, 2, '0', STR_PAD_LEFT);
        
        return $year . '/' . $month . '/' . $day . ' ' . $hour12 . ':' . $minute . ' ' . $ampm;
    } catch (Exception $e) {
        return $dateString;
    }
}

/**
 * جلب مسار ملف الفاتورة
 * @param string $saleNumber - رقم الفاتورة
 * @return string|null
 */
function getInvoiceFilePath($saleNumber) {
    if (empty($saleNumber)) {
        return null;
    }
    
    $filename = 'invoice_' . $saleNumber . '.html';
    $filepath = INVOICES_DIR . $filename;
    
    if (file_exists($filepath)) {
        return 'invoices/' . $filename;
    }
    
    return null;
}

/**
 * حذف ملف الفاتورة
 * @param string $saleNumber - رقم الفاتورة
 * @return bool
 */
function deleteInvoiceFile($saleNumber) {
    if (empty($saleNumber)) {
        return false;
    }
    
    $filename = 'invoice_' . $saleNumber . '.html';
    $filepath = INVOICES_DIR . $filename;
    
    if (file_exists($filepath)) {
        return unlink($filepath);
    }
    
    return true;
}
?>

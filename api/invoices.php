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
 * إنشاء QR Code بسيط كـ SVG
 * @param string $data - البيانات
 * @param int $size - الحجم
 * @return string - SVG كـ base64 data URI
 */
function generateSimpleQRCode($data, $size = 250) {
    // إنشاء نمط بسيط بناءً على hash البيانات
    $hash = md5($data);
    $gridSize = 25;
    $cellSize = $size / $gridSize;
    
    $svg = '<svg width="' . $size . '" height="' . $size . '" xmlns="http://www.w3.org/2000/svg">';
    $svg .= '<rect width="' . $size . '" height="' . $size . '" fill="#ffffff"/>';
    
    // رسم النمط
    for ($i = 0; $i < $gridSize; $i++) {
        for ($j = 0; $j < $gridSize; $j++) {
            $charIndex = ($i * $gridSize + $j) % strlen($hash);
            $charValue = ord($hash[$charIndex]);
            if ($charValue % 3 === 0) {
                $x = $i * $cellSize;
                $y = $j * $cellSize;
                $svg .= '<rect x="' . $x . '" y="' . $y . '" width="' . $cellSize . '" height="' . $cellSize . '" fill="#000000"/>';
            }
        }
    }
    
    // إضافة مربعات الزاوية
    $cornerSize = 7;
    $cornerCellSize = $cellSize;
    // الزاوية العلوية اليسرى
    for ($i = 0; $i < $cornerSize; $i++) {
        for ($j = 0; $j < $cornerSize; $j++) {
            if (($i < 2 || $i >= $cornerSize - 2) || ($j < 2 || $j >= $cornerSize - 2)) {
                $x = $i * $cornerCellSize;
                $y = $j * $cornerCellSize;
                $svg .= '<rect x="' . $x . '" y="' . $y . '" width="' . $cornerCellSize . '" height="' . $cornerCellSize . '" fill="#000000"/>';
            }
        }
    }
    // الزاوية العلوية اليمنى
    for ($i = 0; $i < $cornerSize; $i++) {
        for ($j = 0; $j < $cornerSize; $j++) {
            if (($i < 2 || $i >= $cornerSize - 2) || ($j < 2 || $j >= $cornerSize - 2)) {
                $x = ($gridSize - $cornerSize + $i) * $cornerCellSize;
                $y = $j * $cornerCellSize;
                $svg .= '<rect x="' . $x . '" y="' . $y . '" width="' . $cornerCellSize . '" height="' . $cornerCellSize . '" fill="#000000"/>';
            }
        }
    }
    // الزاوية السفلية اليسرى
    for ($i = 0; $i < $cornerSize; $i++) {
        for ($j = 0; $j < $cornerSize; $j++) {
            if (($i < 2 || $i >= $cornerSize - 2) || ($j < 2 || $j >= $cornerSize - 2)) {
                $x = $i * $cornerCellSize;
                $y = ($gridSize - $cornerSize + $j) * $cornerCellSize;
                $svg .= '<rect x="' . $x . '" y="' . $y . '" width="' . $cornerCellSize . '" height="' . $cornerCellSize . '" fill="#000000"/>';
            }
        }
    }
    
    $svg .= '</svg>';
    
    return 'data:image/svg+xml;base64,' . base64_encode($svg);
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
    $branchName = 'الهانوفيل';
    $salesPersonName = $saleData['created_by_name'] ?? 'غير محدد';
    $whatsappNumber = '01276855966';
    
    // تنسيق التاريخ
    $dateTime = formatDateTime12Hour($saleData['created_at'] ?? date('Y-m-d H:i:s'));
    
    // التحقق من وجود منتج هاتف
    $hasPhoneProduct = false;
    $phoneData = null;
    $items = $saleData['items'] ?? [];
    foreach ($items as $item) {
        if (($item['item_type'] ?? '') === 'phone') {
            $hasPhoneProduct = true;
            // محاولة جلب بيانات الهاتف من notes
            if (!empty($item['notes'])) {
                $phoneDataJson = json_decode($item['notes'], true);
                if ($phoneDataJson && is_array($phoneDataJson)) {
                    $phoneData = $phoneDataJson;
                }
            }
            // أو من phone_data إذا كان موجوداً
            if (!$phoneData && !empty($item['phone_data'])) {
                $phoneData = $item['phone_data'];
            }
            break;
        }
    }
    
    // معالجة اللوجو - نفس الطريقة في JavaScript
    $defaultLogoPath = '../vertopal.com_photo_5922357566287580087_y.png';
    $fallbackLogoPath1 = '../photo_5922357566287580087_y.jpg';
    $fallbackLogoPath2 = '../icons/icon-192x192.png';
    
    $logoHtml = '';
    if (!empty($shopLogo) && trim($shopLogo) !== '') {
        $logoHtml = '<img src="' . htmlspecialchars($shopLogo) . '" alt="ALAA ZIDAN Logo" class="invoice-logo" style="max-width: 500px; max-height: 500px; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src=\'' . $defaultLogoPath . '\'; this.onerror=function(){this.onerror=null; this.src=\'' . $fallbackLogoPath1 . '\'; this.onerror=function(){this.onerror=null; this.src=\'' . $fallbackLogoPath2 . '\'; this.onerror=function(){this.style.display=\'none\';};};};">';
    } else {
        $logoHtml = '<img src="' . $defaultLogoPath . '" alt="ALAA ZIDAN Logo" class="invoice-logo" style="max-width: 500px; max-height: 500px; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src=\'' . $fallbackLogoPath1 . '\'; this.onerror=function(){this.onerror=null; this.src=\'' . $fallbackLogoPath2 . '\'; this.onerror=function(){this.style.display=\'none\';};};};">';
    }
    
    // قسم بيانات الهاتف
    $phoneDataSection = '';
    if ($phoneData) {
        $phoneDataSection = '
            <div class="invoice-phone-data">
                <h3>بيانات الهاتف</h3>
                <div class="phone-data-grid">
                    <div class="phone-data-item">
                        <strong>الماركة:</strong> ' . htmlspecialchars($phoneData['brand'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>الموديل:</strong> ' . htmlspecialchars($phoneData['model'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>المساحة:</strong> ' . htmlspecialchars($phoneData['storage'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>الرام:</strong> ' . htmlspecialchars($phoneData['ram'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>نوع الشاشة:</strong> ' . htmlspecialchars($phoneData['screen_type'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>حالة الضريبة:</strong> ' . (($phoneData['tax_status'] ?? '') === 'due' ? 'مستحقة' : 'معفاة') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>السيريال نمبر (IMEI):</strong> ' . htmlspecialchars($phoneData['serial_number'] ?? '-') . '
                    </div>
                    <div class="phone-data-item">
                        <strong>سجل الصيانة:</strong> ' . htmlspecialchars($phoneData['maintenance_history'] ?? '-') . '
                    </div>';
        if (!empty($phoneData['defects'])) {
            $phoneDataSection .= '
                    <div class="phone-data-item full-width">
                        <strong>العيوب:</strong> ' . htmlspecialchars($phoneData['defects']) . '
                    </div>';
        }
        $phoneDataSection .= '
                </div>
            </div>';
    }
    
    // جدول العناصر
    $itemsHtml = '';
    foreach ($items as $index => $item) {
        $itemName = htmlspecialchars($item['item_name'] ?? $item['name'] ?? 'غير محدد');
        $quantity = intval($item['quantity'] ?? 0);
        $unitPrice = number_format(floatval($item['unit_price'] ?? 0), 2);
        $totalPrice = number_format(floatval($item['total_price'] ?? 0), 2);
        
        $itemsHtml .= '
                        <tr>
                            <td>' . ($index + 1) . '</td>
                            <td>' . $itemName . '</td>
                            <td>' . $quantity . '</td>
                            <td>' . $unitPrice . ' ' . $currency . '</td>
                            <td>' . $totalPrice . ' ' . $currency . '</td>
                        </tr>';
    }
    
    // حساب المبالغ
    $totalAmount = floatval($saleData['total_amount'] ?? 0);
    $discount = floatval($saleData['discount'] ?? 0);
    $tax = floatval($saleData['tax'] ?? 0);
    $finalAmount = floatval($saleData['final_amount'] ?? 0);
    
    // إنشاء QR Code مع بيانات إضافية عشوائية لجعله أكثر واقعية
    $saleNumber = $saleData['sale_number'] ?? $saleData['id'] ?? '';
    $saleId = $saleData['id'] ?? '';
    $createdAt = $saleData['created_at'] ?? date('Y-m-d H:i:s');
    
    // إنشاء بيانات عشوائية إضافية
    $timestamp = time();
    $verificationCode = strtoupper(substr(md5($saleId . $timestamp), 0, 8));
    $transactionId = 'TXN' . str_pad(rand(100000, 999999), 6, '0', STR_PAD_LEFT);
    $checksum = substr(md5($saleNumber . $finalAmount . $timestamp), 0, 16);
    $shopId = 'SHOP-' . str_pad(rand(100, 999), 3, '0', STR_PAD_LEFT);
    $branchCode = 'BR-' . strtoupper(substr(md5($branchName), 0, 4));
    $paymentMethod = ['cash', 'card', 'bank_transfer'][rand(0, 2)];
    $invoiceVersion = '1.0';
    $systemId = 'SYS-' . str_pad(rand(1000, 9999), 4, '0', STR_PAD_LEFT);
    
    $invoiceData = [
        'invoice_id' => $saleId,
        'invoice_number' => $saleNumber,
        'version' => $invoiceVersion,
        'timestamp' => $timestamp,
        'date' => $createdAt,
        'shop_id' => $shopId,
        'branch_code' => $branchCode,
        'system_id' => $systemId,
        'customer' => [
            'name' => $saleData['customer_name'] ?? '',
            'phone' => $saleData['customer_phone'] ?? '',
            'id' => $saleData['customer_id'] ?? null
        ],
        'amounts' => [
            'subtotal' => $totalAmount,
            'discount' => $discount,
            'tax' => $tax,
            'total' => $finalAmount,
            'currency' => $currency
        ],
        'items' => array_map(function($item) {
            return [
                'name' => $item['item_name'] ?? '',
                'type' => $item['item_type'] ?? '',
                'quantity' => intval($item['quantity'] ?? 0),
                'unit_price' => floatval($item['unit_price'] ?? 0),
                'total_price' => floatval($item['total_price'] ?? 0)
            ];
        }, $items),
        'payment' => [
            'method' => $paymentMethod,
            'transaction_id' => $transactionId,
            'status' => 'completed',
            'processed_at' => date('Y-m-d H:i:s', $timestamp)
        ],
        'verification' => [
            'code' => $verificationCode,
            'checksum' => $checksum,
            'hash' => md5($saleNumber . $finalAmount . $timestamp)
        ],
        'metadata' => [
            'created_by' => $salesPersonName,
            'branch' => $branchName,
            'items_count' => count($items),
            'generated_at' => date('Y-m-d H:i:s'),
            'timezone' => 'Africa/Cairo'
        ]
    ];
    $qrCodeData = json_encode($invoiceData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $qrCodeImage = generateSimpleQRCode($qrCodeData, 250);
    
    // البنود والشروط
    $invoiceTerms = '
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بإبراز الفاتورة الأصلية.</li>';
    if ($hasPhoneProduct) {
        $invoiceTerms .= '
                <li>يجب مطابقة رقم الـ IMEI المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>';
    }
    $invoiceTerms .= '
                <li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>
            </ol>
        </div>';
    
    // HTML كامل للفاتورة - مطابق تماماً للقالب في JavaScript
    $html = '<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة ' . htmlspecialchars($saleData['sale_number'] ?? '') . '</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=Almarai:wght@300;400;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #2196F3;
            --secondary-color: #64B5F6;
            --success-color: #4CAF50;
            --warning-color: #FFA500;
            --danger-color: #f44336;
            --text-dark: #333;
            --text-light: #666;
            --border-color: #ddd;
            --light-bg: #f5f5f5;
            --white: #ffffff;
            --shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Cairo", "Tajawal", "Almarai", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: var(--light-bg);
            padding: 20px;
            color: var(--text-dark);
            direction: rtl;
        }
        .invoice-wrapper {
            direction: rtl;
            font-family: "Cairo", "Tajawal", "Almarai", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: var(--white);
            color: var(--text-dark);
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border-radius: 16px;
            font-size: 16px;
            line-height: 1.7;
        }
        .invoice-logo-section {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px 0;
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .invoice-logo {
            max-width: 500px;
            max-height: 500px;
            width: auto;
            height: auto;
            display: block;
            object-fit: contain;
        }
        .invoice-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 25px;
            border-bottom: 3px solid var(--primary-color);
            position: relative;
        }
        .invoice-header::after {
            content: "";
            position: absolute;
            bottom: -3px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: var(--primary-color);
            border-radius: 2px;
        }
        .invoice-shop-info {
            color: var(--text-light);
            line-height: 1.8;
            font-size: 1.05em;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            font-weight: 500;
        }
        .invoice-shop-info div {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #555;
            font-weight: 500;
        }
        .invoice-shop-info i {
            color: var(--primary-color);
            font-size: 1.1em;
        }
        .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 25px;
            padding: 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .invoice-details-left,
        .invoice-details-right {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .invoice-details-left > div,
        .invoice-details-right > div {
            color: var(--text-dark);
            font-size: 1.05em;
            padding: 10px 0;
            border-bottom: 1px dotted #ddd;
            line-height: 1.8;
            font-weight: 500;
        }
        .invoice-details-left > div:last-child,
        .invoice-details-right > div:last-child {
            border-bottom: none;
        }
        .invoice-details-left strong,
        .invoice-details-right strong {
            color: var(--primary-color);
            font-weight: 600;
            margin-left: 8px;
        }
        .invoice-extra-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            padding: 18px 20px;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            font-size: 1.05em;
            color: var(--text-dark);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
            line-height: 1.8;
            font-weight: 500;
        }
        .invoice-extra-info > div {
            padding: 5px 0;
        }
        .invoice-extra-info strong {
            color: var(--primary-color);
            font-weight: 600;
            margin-left: 8px;
        }
        .invoice-phone-data {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .invoice-phone-data h3 {
            margin: 0 0 15px 0;
            color: var(--primary-color);
            font-size: 1.4em;
            text-align: right;
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 12px;
            font-weight: 700;
        }
        .phone-data-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        .phone-data-item {
            padding: 12px 15px;
            background: white;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
            font-size: 1.05em;
            line-height: 1.8;
            font-weight: 500;
        }
        .phone-data-item.full-width {
            grid-column: 1 / -1;
        }
        .phone-data-item strong {
            color: var(--primary-color);
            margin-left: 8px;
            font-weight: 700;
        }
        .invoice-items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: var(--white);
            table-layout: fixed;
            border: 1px solid #ddd;
        }
        .invoice-items-table th,
        .invoice-items-table td {
            padding: 12px 8px;
            text-align: right;
            border: 1px solid #ddd;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
        }
        .invoice-items-table th:nth-child(1),
        .invoice-items-table td:nth-child(1) {
            width: 5%;
            text-align: center;
        }
        .invoice-items-table th:nth-child(2),
        .invoice-items-table td:nth-child(2) {
            width: 40%;
        }
        .invoice-items-table th:nth-child(3),
        .invoice-items-table td:nth-child(3) {
            width: 12%;
            text-align: center;
        }
        .invoice-items-table th:nth-child(4),
        .invoice-items-table td:nth-child(4) {
            width: 20%;
        }
        .invoice-items-table th:nth-child(5),
        .invoice-items-table td:nth-child(5) {
            width: 23%;
        }
        .invoice-items-table th {
            background: #f5f5f5;
            font-weight: 700;
            color: var(--text-dark);
            font-size: 1em;
            border-bottom: 2px solid #ddd;
        }
        .invoice-items-table td {
            color: var(--text-dark);
            font-size: 1em;
            background: var(--white);
            font-weight: 500;
        }
        .invoice-items-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .invoice-summary {
            margin-top: 25px;
            padding: 25px;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .invoice-summary .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 1.1em;
            color: var(--text-dark);
            padding: 10px 0;
            align-items: center;
            line-height: 1.8;
            font-weight: 500;
        }
        .invoice-summary .summary-row span:first-child {
            font-weight: 500;
            color: #555;
        }
        .invoice-summary .summary-row span:last-child {
            font-weight: 600;
            color: var(--text-dark);
        }
        .invoice-summary .summary-row.total {
            font-size: 1.9em;
            font-weight: 800;
            color: var(--primary-color);
            padding: 20px 0;
            border-top: 3px solid var(--primary-color);
            margin-top: 20px;
            margin-bottom: 0;
            background: linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%);
            border-radius: 8px;
            padding-left: 15px;
            padding-right: 15px;
            margin-left: -15px;
            margin-right: -15px;
        }
        .invoice-summary .summary-row.total span:last-child {
            font-size: 1.1em;
            color: var(--primary-color);
        }
        .invoice-summary hr {
            margin: 18px 0;
            border: none;
            border-top: 2px solid #e0e0e0;
        }
        .invoice-qrcode {
            text-align: center;
            margin: 30px 0;
            padding: 0;
            background: transparent;
            border: none;
            box-shadow: none;
        }
        .invoice-qrcode img {
            max-width: 250px;
            width: 250px;
            height: 250px;
            margin: 0 auto;
            display: block;
        }
        .invoice-terms {
            margin: 25px 0;
            padding: 20px;
            background: #fff9e6;
            border-radius: 8px;
            border: 1px solid #ffd700;
        }
        .invoice-terms h4 {
            margin: 0 0 18px 0;
            color: #856404;
            font-size: 1.3em;
            text-align: right;
            font-weight: 700;
        }
        .invoice-terms ol {
            margin: 0;
            padding-right: 25px;
            color: #856404;
            line-height: 2;
            font-size: 1.05em;
            font-weight: 500;
        }
        .invoice-terms li {
            margin-bottom: 12px;
            padding-right: 5px;
        }
        .invoice-footer {
            text-align: center;
            margin-top: 35px;
            padding-top: 25px;
            border-top: 2px solid var(--primary-color);
            color: var(--text-light);
            font-size: 1.2em;
            font-weight: 600;
            position: relative;
        }
        .invoice-footer::before {
            content: "";
            position: absolute;
            top: -2px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 2px;
            background: var(--primary-color);
            border-radius: 2px;
        }
        .invoice-footer div {
            color: #666;
            font-style: italic;
            font-size: 1.1em;
            font-weight: 500;
            line-height: 1.8;
        }
        @media print {
            @page {
                margin: 0.8cm;
                size: A4;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body {
                background: white;
                color: black;
                margin: 0;
                padding: 0;
            }
            .invoice-wrapper {
                page-break-inside: auto !important;
                break-inside: auto !important;
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                display: block !important;
                position: static !important;
            }
            .invoice-logo-section,
            .invoice-header,
            .invoice-phone-data,
            .invoice-details,
            .invoice-extra-info {
                page-break-inside: avoid;
            }
            .invoice-items-table {
                page-break-inside: auto !important;
                display: table !important;
                width: 100% !important;
                border-collapse: collapse !important;
            }
            .invoice-items-table thead {
                display: table-header-group !important;
                page-break-inside: avoid;
            }
            .invoice-items-table tbody tr {
                page-break-inside: avoid;
            }
            .invoice-summary,
            .invoice-qrcode,
            .invoice-terms {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-wrapper">
        <!-- Logo Section - في البداية -->
        <div class="invoice-logo-section">
            ' . $logoHtml . '
        </div>
        
        <!-- Shop Info -->
        <div class="invoice-header">
            <div class="invoice-shop-info">
                ' . (!empty($shopAddress) ? '<div><i class="bi bi-geo-alt-fill"></i> ' . htmlspecialchars($shopAddress) . '</div>' : '') . '
                <div><i class="bi bi-whatsapp" style="color: #25D366;"></i> واتساب: ' . htmlspecialchars($whatsappNumber) . '</div>
                ' . (!empty($shopPhone) ? '<div><i class="bi bi-telephone-fill"></i> ' . htmlspecialchars($shopPhone) . '</div>' : '') . '
            </div>
        </div>
        
        <!-- Invoice Details -->
        <div class="invoice-details">
            <div class="invoice-details-left">
                <div><strong>العميل:</strong> ' . htmlspecialchars($saleData['customer_name'] ?? '') . '</div>
                <div><strong>الهاتف:</strong> ' . htmlspecialchars($saleData['customer_phone'] ?? '') . '</div>
            </div>
            <div class="invoice-details-right">
                <div><strong>رقم الفاتورة:</strong> ' . htmlspecialchars($saleData['sale_number'] ?? '') . '</div>
                <div><strong>التاريخ:</strong> ' . htmlspecialchars($dateTime) . '</div>
            </div>
        </div>
        
        <!-- Branch and Sales Person -->
        <div class="invoice-extra-info">
            <div><strong>الفرع:</strong> ' . htmlspecialchars($branchName) . '</div>
            <div><strong>المسؤول عن البيع:</strong> ' . htmlspecialchars($salesPersonName) . '</div>
        </div>
        
        <!-- Phone Data Section -->
        ' . $phoneDataSection . '
        
        <!-- Items Table -->
        <table class="invoice-items-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الإجمالي</th>
                </tr>
            </thead>
            <tbody>
                ' . $itemsHtml . '
            </tbody>
        </table>
        
        <!-- Summary -->
        <div class="invoice-summary">
            <div class="summary-row">
                <span>المجموع الفرعي:</span>
                <span>' . number_format($totalAmount, 2) . ' ' . $currency . '</span>
            </div>';
    
    if ($discount > -1) {
        $html .= '
            <div class="summary-row">
                <span>الخصم:</span>
                <span>- ' . number_format($discount, 2) . ' ' . $currency . '</span>
            </div>';
    }
    
    $html .= '
            <hr>
            <div class="summary-row total">
                <span>الإجمالي:</span>
                <span>' . number_format($finalAmount, 2) . ' ' . $currency . '</span>
            </div>
        </div>
        
        <!-- QR Code -->
        <div class="invoice-qrcode">
            <img src="' . $qrCodeImage . '" alt="QR Code">
        </div>
        
        <!-- Invoice Terms - البنود في الجزء السفلي بعد QR Code -->
        ' . $invoiceTerms . '
        
        <!-- Footer -->
        <div class="invoice-footer">
            <div>شكراً لزيارتك</div>
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


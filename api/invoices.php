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

// حماية المجلد بملف .htaccess - السماح بملفات HTML فقط
$htaccessFile = INVOICES_DIR . '.htaccess';
if (!file_exists($htaccessFile)) {
    $htaccessContent = "Options -Indexes\n";
    $htaccessContent .= "# السماح بالوصول إلى ملفات HTML فقط (Apache 2.4+)\n";
    $htaccessContent .= "<IfModule mod_authz_core.c>\n";
    $htaccessContent .= "    <FilesMatch \"\\.html$\">\n";
    $htaccessContent .= "        Require all granted\n";
    $htaccessContent .= "    </FilesMatch>\n";
    $htaccessContent .= "</IfModule>\n";
    $htaccessContent .= "# السماح بالوصول إلى ملفات HTML (Apache 2.2)\n";
    $htaccessContent .= "<IfModule !mod_authz_core.c>\n";
    $htaccessContent .= "    <FilesMatch \"\\.html$\">\n";
    $htaccessContent .= "        Allow from all\n";
    $htaccessContent .= "    </FilesMatch>\n";
    $htaccessContent .= "</IfModule>\n";
    file_put_contents($htaccessFile, $htaccessContent);
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
        $whatsappNumber = dbSelectOne("SELECT value FROM settings WHERE `key` = 'whatsapp_number'");
        
        $settings['shop_name'] = $shopName['value'] ?? 'ALAA ZIDAN';
        $settings['shop_phone'] = $shopPhone['value'] ?? '';
        $settings['shop_address'] = $shopAddress['value'] ?? '';
        $settings['shop_logo'] = $shopLogo['value'] ?? '';
        $settings['currency'] = $currency['value'] ?? 'ج.م';
        $settings['whatsapp_number'] = $whatsappNumber['value'] ?? '01276855966';
    } catch (Exception $e) {
        error_log('خطأ في جلب إعدادات المتجر: ' . $e->getMessage());
    }
    
    return $settings;
}

/**
 * إنشاء QR Code حقيقي قابل للقراءة باستخدام API خارجي
 * @param string $data - البيانات
 * @param int $size - الحجم
 * @return string - URL لصورة QR Code
 */
function generateSimpleQRCode($data, $size = 250) {
    // استخدام API موثوق لإنشاء QR Code حقيقي قابل للقراءة
    $encodedData = urlencode($data);
    
    // محاولة استخدام qr-server.com API (أكثر موثوقية)
    $qrServerUrl = "https://api.qrserver.com/v1/create-qr-code/?size={$size}x{$size}&data={$encodedData}";
    
    // محاولة تحميل الصورة باستخدام cURL أولاً (أفضل للـ HTTPS)
    if (function_exists('curl_init')) {
        try {
            $ch = curl_init($qrServerUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
            $imageData = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($imageData !== false && strlen($imageData) > 0 && $httpCode == 200) {
                $base64 = base64_encode($imageData);
                return 'data:image/png;base64,' . $base64;
            }
        } catch (Exception $e) {
            error_log('خطأ في تحميل QR Code باستخدام cURL: ' . $e->getMessage());
        }
    }
    
    // محاولة استخدام file_get_contents فقط إذا كان HTTPS wrapper مفعّل
    if (in_array('https', stream_get_wrappers())) {
        try {
            $imageData = @file_get_contents($qrServerUrl, false, stream_context_create([
                'http' => [
                    'timeout' => 5,
                    'user_agent' => 'Mozilla/5.0'
                ],
                'https' => [
                    'timeout' => 5,
                    'user_agent' => 'Mozilla/5.0'
                ]
            ]));
            
            if ($imageData !== false && strlen($imageData) > 0) {
                $base64 = base64_encode($imageData);
                return 'data:image/png;base64,' . $base64;
            }
        } catch (Exception $e) {
            error_log('خطأ في تحميل QR Code من qr-server.com API: ' . $e->getMessage());
        }
    }
    
    // إذا فشل التحميل، نستخدم URL مباشرة (سيعمل في المتصفح)
    return $qrServerUrl;
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
    $whatsappNumber = $shopSettings['whatsapp_number'] ?? '01276855966';
    
    // تنسيق التاريخ
    $dateTime = formatDateTime12Hour($saleData['created_at'] ?? date('Y-m-d H:i:s'));
    
    // التحقق من وجود منتج هاتف
    $hasPhoneProduct = false;
    $phoneData = null;
    // التحقق من وجود منتج قطعة غيار
    $hasSparePartProduct = false;
    // التحقق من وجود منتج إكسسوار
    $hasAccessoryProduct = false;
    $items = $saleData['items'] ?? [];
    foreach ($items as $item) {
        if (($item['item_type'] ?? '') === 'phone') {
            $hasPhoneProduct = true;
            // محاولة جلب بيانات الهاتف من notes
            if (!empty($item['notes'])) {
                $notesData = json_decode($item['notes'], true);
                if ($notesData && is_array($notesData)) {
                    if (isset($notesData['phone_data'])) {
                        $phoneData = $notesData['phone_data'];
                    } elseif (isset($notesData['brand']) || isset($notesData['model'])) {
                        // محاولة استخدام البيانات مباشرة إذا كانت بيانات الهاتف مباشرة في notes (للتوافق مع البيانات القديمة)
                        $phoneData = $notesData;
                    }
                }
            }
            // أو من phone_data إذا كان موجوداً مباشرة في الـ item
            if (!$phoneData && !empty($item['phone_data'])) {
                $phoneData = is_array($item['phone_data']) ? $item['phone_data'] : json_decode($item['phone_data'], true);
            }
            // إذا وجدنا بيانات الهاتف، نتوقف عن البحث (نأخذ أول هاتف فقط)
            if ($phoneData) {
                break;
            }
        }
        if (($item['item_type'] ?? '') === 'spare_part') {
            $hasSparePartProduct = true;
        }
        if (($item['item_type'] ?? '') === 'accessory') {
            $hasAccessoryProduct = true;
        }
    }
    
    // معالجة اللوجو - نفس الطريقة في JavaScript
    $defaultLogoPath = '../vertopal.com_photo_5922357566287580087_y.png';
    $fallbackLogoPath1 = '../photo_5922357566287580087_y.jpg';
    $fallbackLogoPath2 = '../ico/icon-192x192.png';
    
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
                        <strong>السيريال نمبر (SN):</strong> ' . htmlspecialchars($phoneData['serial_number'] ?? '-') . '
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
    
    // ✅ التحقق من وجود items
    if (empty($items) || !is_array($items) || count($items) === 0) {
        error_log('⚠️ [Invoice] لا توجد عناصر في saleData! saleData keys: ' . implode(', ', array_keys($saleData)));
        error_log('⚠️ [Invoice] saleData items: ' . (isset($saleData['items']) ? 'exists but empty' : 'not exists'));
        
        // محاولة جلب items من sale_id إذا كان متاحاً
        if (!empty($saleData['id'])) {
            try {
                $saleItems = dbSelect(
                    "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
                    [$saleData['id']]
                );
                if (!empty($saleItems) && is_array($saleItems) && count($saleItems) > 0) {
                    $items = $saleItems;
                    error_log('✅ [Invoice] تم جلب ' . count($items) . ' عنصر من قاعدة البيانات');
                }
            } catch (Exception $e) {
                error_log('❌ [Invoice] خطأ في جلب items من قاعدة البيانات: ' . $e->getMessage());
            }
        }
    }
    
    // ✅ التحقق مرة أخرى بعد محاولة الجلب
    if (empty($items) || !is_array($items) || count($items) === 0) {
        $itemsHtml = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #f44336;">⚠️ لا توجد منتجات في الفاتورة</td></tr>';
        error_log('❌ [Invoice] لا توجد عناصر للعرض بعد محاولة الجلب!');
    } else {
        foreach ($items as $index => $item) {
            $itemName = htmlspecialchars($item['item_name'] ?? $item['name'] ?? 'غير محدد');
            $quantity = intval($item['quantity'] ?? 0);
            $unitPrice = number_format(floatval($item['unit_price'] ?? 0), 0);
            $totalPrice = number_format(floatval($item['total_price'] ?? 0), 0);
            
            $itemsHtml .= '
                            <tr>
                                <td>' . ($index + 1) . '</td>
                                <td>' . $itemName . '</td>
                                <td>' . $quantity . '</td>
                                <td>' . $unitPrice . '</td>
                                <td>' . $totalPrice . '</td>
                            </tr>';
        }
    }
    
    // حساب المبالغ
    $totalAmount = floatval($saleData['total_amount'] ?? 0);
    $discount = floatval($saleData['discount'] ?? 0);
    $tax = floatval($saleData['tax'] ?? 0);
    $finalAmount = floatval($saleData['final_amount'] ?? 0);
    $paidAmount = floatval($saleData['paid_amount'] ?? 0);
    $remainingAmount = floatval($saleData['remaining_amount'] ?? 0);
    
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
    // إنشاء بيانات QR Code مبسطة (لتقليل الحجم وضمان القراءة)
    $simpleQRData = json_encode([
        'invoice_id' => $saleId,
        'invoice_number' => $saleNumber,
        'date' => $createdAt,
        'total' => $finalAmount,
        'currency' => $currency,
        'verification_code' => $verificationCode
    ], JSON_UNESCAPED_UNICODE);
    
    $qrCodeImage = generateSimpleQRCode($simpleQRData, 250);
    
    // البنود والشروط
    if ($hasSparePartProduct && !$hasAccessoryProduct) {
        // For spare parts only, show only one warning
        $invoiceTerms = '
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجي تجربة قطعة الغيار بشكل جيد اثناء التواجد في الفرع حيث ان الضمان مقتصر علي التجربه فقط</li>
            </ol>
        </div>';
    } else if ($hasSparePartProduct && $hasAccessoryProduct) {
        // For spare parts AND accessories, show all warnings including spare part warning as fourth
        $invoiceTerms = '
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>
                <li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>
                <li>يرجي تجربة قطعة الغيار بشكل جيد اثناء التواجد في الفرع حيث ان الضمان مقتصر علي التجربه فقط</li>
            </ol>
        </div>';
    } else if ($hasAccessoryProduct && $hasPhoneProduct) {
        // For accessories AND phone, show all warnings for both
        $invoiceTerms = '
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>
                <li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>
                <li>يجب مطابقة رقم الـ Serial Number المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>
                <li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>
            </ol>
        </div>';
    } else {
        // For other products, show standard warnings
        $warrantyWarning = $hasAccessoryProduct 
            ? '<li>يرجي تجربة المنتج جيدا حيث ان ضمان الاكسسوارات مقتصر علي التجربه فقط</li>'
            : '<li>الضمان يشمل عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو السوائل.</li>';
        
        $invoiceTerms = '
        <div class="invoice-terms">
            <h4>تنبيهات هامة:</h4>
            <ol>
                <li>يرجى الاحتفاظ بالفاتورة حيث إنها المستند الوحيد لإثبات عملية الشراء.</li>
                <li>لا يتم الإرجاع أو الاستبدال إلا بالفاتورة الأصلية.</li>';
        if ($hasPhoneProduct) {
            $invoiceTerms .= '
                <li>يجب مطابقة رقم الـ Serial Number المدون بالفاتورة مع الجهاز عند الإرجاع أو الضمان.</li>
                <li>لا يتم استبدال أو رد الأجهزة الجديدة بعد الاستخدام أو فتح ستيكر الضمان الموجود على العلبة.</li>';
        }
        $invoiceTerms .= '
                ' . $warrantyWarning . '
            </ol>
        </div>';
    }
    
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
            font-size: 18px;
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
            gap: 8px 15px;
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
        }
        .invoice-detail-item {
            color: var(--text-dark);
            font-size: 0.95em;
            padding: 4px 0;
            line-height: 1.5;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .invoice-detail-item strong {
            color: var(--primary-color);
            font-weight: 600;
            min-width: fit-content;
        }
        .invoice-phone-data {
            margin: 15px 0;
            padding: 12px 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .invoice-phone-data h3 {
            margin: 0 0 10px 0;
            color: var(--primary-color);
            font-size: 1.1em;
            text-align: right;
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 8px;
            font-weight: 700;
        }
        .phone-data-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 12px;
            margin-top: 10px;
        }
        .phone-data-item {
            padding: 8px 10px;
            background: white;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
            font-size: 0.9em;
            line-height: 1.5;
            font-weight: 500;
        }
        .phone-data-item.full-width {
            grid-column: 1 / -1;
        }
        .phone-data-item strong {
            color: var(--primary-color);
            margin-left: 6px;
            font-weight: 600;
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
            padding: 16px 10px;
            text-align: right;
            border: 1px solid #ddd;
            word-wrap: normal;
            overflow-wrap: normal;
            word-break: keep-all;
            white-space: nowrap;
            line-height: 1.6;
            vertical-align: middle;
            box-sizing: border-box;
        }
        .invoice-items-table th:nth-child(2),
        .invoice-items-table td:nth-child(2) {
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
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
            font-weight: 600;
            color: var(--text-dark);
            font-size: 0.8em;
            border-bottom: 2px solid #ddd;
            white-space: nowrap;
            word-wrap: normal;
            overflow-wrap: normal;
            word-break: keep-all;
            line-height: 1.5;
            padding: 12px 8px;
            text-align: center;
        }
        .invoice-items-table th:nth-child(2) {
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .invoice-items-table td {
            color: var(--text-dark);
            font-size: 1.2em;
            background: var(--white);
            font-weight: 500;
        }
        .invoice-items-table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        .invoice-summary {
            margin-top: 15px;
            padding: 12px 15px;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
        }
        .invoice-summary .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.95em;
            color: var(--text-dark);
            padding: 4px 0;
            align-items: center;
            line-height: 1.5;
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
            font-size: 1.4em;
            font-weight: 800;
            color: var(--primary-color);
            padding: 10px 0;
            border-top: 2px solid var(--primary-color);
            margin-top: 10px;
            margin-bottom: 0;
            background: linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%);
            border-radius: 6px;
            padding-left: 10px;
            padding-right: 10px;
            margin-left: -10px;
            margin-right: -10px;
        }
        .invoice-summary .summary-row.total span:last-child {
            font-size: 1em;
            color: var(--primary-color);
        }
        .invoice-summary hr {
            margin: 10px 0;
            border: none;
            border-top: 1px solid #e0e0e0;
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
                margin: 0;
                size: 80mm auto;
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
                width: 80mm;
            }
            .invoice-wrapper {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 8px 4px !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                display: block !important;
                position: static !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                box-sizing: border-box !important;
            }
            
            .invoice-wrapper * {
                max-width: 100% !important;
                box-sizing: border-box !important;
            }
            
            .invoice-wrapper > * {
                page-break-inside: avoid !important;
            }
            .invoice-logo-section {
                margin-bottom: 10px !important;
                padding: 5px 0 !important;
                page-break-inside: avoid !important;
            }
            .invoice-logo {
                max-width: 60mm !important;
                max-height: 40mm !important;
            }
            .invoice-header {
                margin-bottom: 10px !important;
                padding-bottom: 10px !important;
                page-break-inside: avoid !important;
            }
            .invoice-shop-info {
                font-size: 0.85em !important;
            }
            .invoice-details {
                padding: 6px 8px !important;
                margin-bottom: 6px !important;
                gap: 4px 8px !important;
                font-size: 0.75em !important;
                page-break-inside: avoid !important;
            }
            .invoice-detail-item {
                padding: 2px 0 !important;
                font-size: 0.75em !important;
                line-height: 1.3 !important;
            }
            .invoice-phone-data {
                padding: 6px 8px !important;
                margin: 6px 0 !important;
                font-size: 0.75em !important;
                page-break-inside: avoid !important;
            }
            .invoice-phone-data h3 {
                font-size: 0.9em !important;
                margin-bottom: 6px !important;
                padding-bottom: 4px !important;
            }
            .phone-data-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 4px 6px !important;
                margin-top: 6px !important;
            }
            .phone-data-item {
                padding: 4px 6px !important;
                font-size: 0.75em !important;
                line-height: 1.3 !important;
            }
            .invoice-items-table {
                width: 100% !important;
                max-width: 100% !important;
                font-size: 1em !important;
                page-break-inside: avoid !important;
                display: table !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
                box-sizing: border-box !important;
                margin: 0 !important;
            }
            .invoice-items-table th,
            .invoice-items-table td {
                padding: 6px 3px !important;
                font-size: 1.1em !important;
                box-sizing: border-box !important;
                word-wrap: normal !important;
                overflow-wrap: normal !important;
                word-break: keep-all !important;
                white-space: nowrap !important;
                line-height: 1.4 !important;
                vertical-align: middle !important;
            }
            .invoice-items-table th:nth-child(2),
            .invoice-items-table td:nth-child(2) {
                white-space: normal !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
            }
            .invoice-items-table th {
                font-size: 0.8em !important;
                font-weight: 600 !important;
            }
            /* تحديد عرض الأعمدة بدقة لـ 80mm */
            .invoice-items-table th:nth-child(1),
            .invoice-items-table td:nth-child(1) {
                width: 8% !important;
                min-width: 0 !important;
                max-width: 8% !important;
                text-align: center !important;
            }
            .invoice-items-table th:nth-child(2),
            .invoice-items-table td:nth-child(2) {
                width: 32% !important;
                min-width: 0 !important;
                max-width: 32% !important;
                text-align: right !important;
            }
            .invoice-items-table th:nth-child(3),
            .invoice-items-table td:nth-child(3) {
                width: 12% !important;
                min-width: 0 !important;
                max-width: 12% !important;
                text-align: center !important;
            }
            .invoice-items-table th:nth-child(4),
            .invoice-items-table td:nth-child(4) {
                width: 24% !important;
                min-width: 0 !important;
                max-width: 24% !important;
                text-align: right !important;
            }
            .invoice-items-table th:nth-child(5),
            .invoice-items-table td:nth-child(5) {
                width: 24% !important;
                min-width: 0 !important;
                max-width: 24% !important;
                text-align: right !important;
            }
            .invoice-items-table thead {
                display: table-header-group !important;
            }
            .invoice-items-table tbody tr {
                page-break-inside: avoid !important;
            }
            .invoice-summary {
                padding: 6px 8px !important;
                margin: 6px 0 !important;
                font-size: 0.75em !important;
                page-break-inside: avoid !important;
                page-break-before: avoid !important;
            }
            .invoice-summary .summary-row {
                font-size: 0.75em !important;
                margin-bottom: 3px !important;
                padding: 2px 0 !important;
                line-height: 1.3 !important;
            }
            .invoice-summary .summary-row.total {
                font-size: 0.95em !important;
                padding: 6px 0 !important;
                margin-top: 6px !important;
                margin-left: -6px !important;
                margin-right: -6px !important;
                padding-left: 6px !important;
                padding-right: 6px !important;
            }
            .invoice-summary hr {
                margin: 6px 0 !important;
            }
            .invoice-qrcode {
                margin: 8px 0 !important;
                padding: 0 !important;
                page-break-inside: avoid !important;
                page-break-before: avoid !important;
                page-break-after: avoid !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                text-align: center !important;
            }
            .invoice-qrcode img {
                max-width: 45mm !important;
                width: 45mm !important;
                height: 45mm !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 0 auto !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .invoice-terms {
                padding: 8px !important;
                margin: 8px 0 !important;
                font-size: 0.7em !important;
                page-break-inside: avoid !important;
            }
            .invoice-terms h4 {
                font-size: 0.9em !important;
                margin-bottom: 5px !important;
            }
            .invoice-terms ol {
                padding-right: 15px !important;
                line-height: 1.5 !important;
            }
            .invoice-terms li {
                margin-bottom: 5px !important;
            }
            .invoice-footer {
                margin: 10px 0 0 0 !important;
                padding-top: 10px !important;
                font-size: 0.85em !important;
                page-break-inside: avoid !important;
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
            <div class="invoice-detail-item"><strong>العميل:</strong> ' . htmlspecialchars($saleData['customer_name'] ?? '') . '</div>
            <div class="invoice-detail-item"><strong>الهاتف:</strong> ' . htmlspecialchars($saleData['customer_phone'] ?? '') . '</div>
            <div class="invoice-detail-item"><strong>رقم الفاتورة:</strong> ' . htmlspecialchars($saleData['sale_number'] ?? '') . '</div>
            <div class="invoice-detail-item"><strong>التاريخ:</strong> ' . htmlspecialchars($dateTime) . '</div>
            <div class="invoice-detail-item"><strong>الفرع:</strong> ' . htmlspecialchars($branchName) . '</div>
            <div class="invoice-detail-item"><strong>المسؤول عن البيع:</strong> ' . htmlspecialchars($salesPersonName) . '</div>
        </div>
        
        <!-- Phone Data Section -->
        ' . $phoneDataSection . '
        
        <!-- Items Table -->
        <table class="invoice-items-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>الصنف</th>
                    <th>ك</th>
                    <th>السعر </th>
                    <th>اجمالي</th>
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
                <span>' . number_format($totalAmount, 2) . '</span>
            </div>';
    
    // إضافة المدفوع فقط في حالة الدفع الجزئي
    if ($paidAmount > 0 && $paidAmount < $finalAmount) {
        $html .= '
            <div class="summary-row">
                <span>المدفوع:</span>
                <span>' . number_format($paidAmount, 2) . '</span>
            </div>';
    }
    
    if ($discount > -1) {
        $html .= '
            <div class="summary-row">
                <span>الخصم:</span>
                <span>- ' . number_format($discount, 2) . '</span>
            </div>';
    }
    
    $html .= '
            <hr>
            <div class="summary-row total">
                <span>الإجمالي:</span>
                <span>' . number_format($finalAmount, 2) . '</span>
            </div>';
    
    // إضافة المتبقي فقط في حالة وجود دين
    if ($remainingAmount > 0) {
        $html .= '
            <div class="summary-row">
                <span>المتبقي:</span>
                <span>' . number_format($remainingAmount, 2) . '</span>
            </div>';
    }
    
    $html .= '
        </div>
        
        <!-- Invoice Terms - البنود -->
        ' . $invoiceTerms . '
        
        <!-- Footer -->
        <div class="invoice-footer">
            <div>شكرا لتعاملكم معنا</div>
        </div>
        
        <!-- QR Code - في نهاية الفاتورة -->
        <div class="invoice-qrcode">
            <img src="' . $qrCodeImage . '" alt="QR Code">
        </div>
    </div>
    
    <!-- Print and Back Buttons -->
    <div class="no-print" style="text-align: center; margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: var(--primary-color, #2196F3); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-family: inherit;">
            <i class="bi bi-printer"></i> طباعة
        </button>
        <button onclick="closeInvoiceWindow()" style="padding: 10px 20px; background: var(--secondary-color, #64B5F6); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-family: inherit;">
            <i class="bi bi-arrow-right"></i> رجوع
        </button>
    </div>
    <style>
        .no-print { display: block !important; }
        @media print {
            .no-print { display: none !important; }
        }
    </style>
    <script>
        (function() {
            // دالة لإغلاق النافذة بشكل نهائي
            function closeInvoiceWindow() {
                // الطريقة الأولى: محاولة إغلاق النافذة مباشرة (تعمل إذا كانت مفتوحة بواسطة window.open())
                try {
                    // التحقق من أن النافذة مفتوحة بواسطة JavaScript
                    if (window.opener !== null) {
                        // النافذة مفتوحة بواسطة window.open() - يمكن إغلاقها مباشرة
                        window.close();
                        // إذا لم تُغلق بعد ثانية واحدة، جرب الطرق البديلة
                        setTimeout(function() {
                            if (!document.hidden) {
                                tryAlternativeClose();
                            }
                        }, 1000);
                        return;
                    }
                } catch (e) {
                    console.debug("محاولة الإغلاق المباشر فشلت:", e);
                }
                
                // الطريقة الثانية: محاولة إغلاق النافذة مباشرة (حتى بدون opener)
                try {
                    window.close();
                    // انتظر قليلاً للتحقق من نجاح الإغلاق
                    setTimeout(function() {
                        if (!document.hidden) {
                            tryAlternativeClose();
                        }
                    }, 500);
                } catch (e) {
                    console.debug("محاولة الإغلاق فشلت:", e);
                    tryAlternativeClose();
                }
            }
            
            // دالة بديلة للإغلاق
            function tryAlternativeClose() {
                try {
                    // محاولة الرجوع في التاريخ
                    if (window.history.length > 1) {
                        window.history.back();
                        return;
                    }
                } catch (e) {
                    console.debug("الرجوع في التاريخ فشل:", e);
                }
                
                // إذا فشل كل شيء، أعد التوجيه إلى نقطة البيع
                try {
                    // محاولة تحديد المسار الصحيح بناءً على موقع الملف الحالي
                    const currentPath = window.location.pathname;
                    let redirectPath = "../pos.html";
                    
                    // إذا كان الملف في api/، استخدم ../pos.html
                    if (currentPath.includes("/api/")) {
                        redirectPath = "../pos.html";
                    } else {
                        // إذا كان في مكان آخر، استخدم pos.html مباشرة
                        redirectPath = "pos.html";
                    }
                    
                    window.location.href = redirectPath;
                } catch (e) {
                    console.error("فشل إعادة التوجيه:", e);
                    // آخر محاولة: إعادة التوجيه إلى الصفحة الرئيسية
                    try {
                        window.location.href = "../index.html";
                    } catch (finalError) {
                        console.error("فشل جميع محاولات الإغلاق:", finalError);
                    }
                }
            }
            
            // جعل الدالة متاحة عالمياً
            window.closeInvoiceWindow = closeInvoiceWindow;
            
            // إضافة معالج للأخطاء غير المتوقعة
            window.addEventListener("error", function(e) {
                console.debug("خطأ في النافذة:", e);
            });
        })();
    </script>
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
        $date = new DateTime($dateString, new DateTimeZone('Africa/Cairo'));
        $year = $date->format('Y');
        $month = $date->format('m');
        $day = $date->format('d');
        $hour = (int)$date->format('H');
        $minute = $date->format('i');
        
        $ampm = $hour >= 12 ? 'م' : 'ص ';
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


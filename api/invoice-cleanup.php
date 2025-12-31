<?php
/**
 * API لإدارة حذف الفواتير القديمة تلقائياً
 * يقوم بحذف الفواتير بناءً على نوع المنتجات (هاتف: 365 يوم، إكسسوارات/قطع غيار: 90 يوم)
 */

require_once 'config.php';
require_once 'invoices.php';

// تعريف مسار ملف الإعدادات
define('INVOICE_CLEANUP_SETTINGS_FILE', DATA_DIR . 'invoice-cleanup-settings.json');

// التأكد من وجود مجلد data
if (!file_exists(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}

/**
 * الحصول على إعدادات تنظيف الفواتير
 * @return array
 */
function getInvoiceCleanupSettings() {
    if (!file_exists(INVOICE_CLEANUP_SETTINGS_FILE)) {
        $defaultSettings = [
            'enabled' => true,
            'last_cleanup_date' => null,
            'batch_size' => 50,
            'max_execution_time' => 30,
            'total_deleted' => 0,
            'last_run_stats' => null
        ];
        updateInvoiceCleanupSettings($defaultSettings);
        return $defaultSettings;
    }
    
    $content = file_get_contents(INVOICE_CLEANUP_SETTINGS_FILE);
    $settings = json_decode($content, true);
    
    if (!is_array($settings)) {
        // إذا كان الملف تالفاً، إعادة إنشاء الإعدادات الافتراضية
        $defaultSettings = [
            'enabled' => true,
            'last_cleanup_date' => null,
            'batch_size' => 50,
            'max_execution_time' => 30,
            'total_deleted' => 0,
            'last_run_stats' => null
        ];
        updateInvoiceCleanupSettings($defaultSettings);
        return $defaultSettings;
    }
    
    return $settings;
}

/**
 * تحديث إعدادات تنظيف الفواتير
 * @param array $settings
 * @return bool
 */
function updateInvoiceCleanupSettings($settings) {
    try {
        if (!file_exists(DATA_DIR)) {
            mkdir(DATA_DIR, 0755, true);
        }
        
        return file_put_contents(
            INVOICE_CLEANUP_SETTINGS_FILE,
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        ) !== false;
    } catch (Exception $e) {
        error_log('خطأ في حفظ إعدادات تنظيف الفواتير: ' . $e->getMessage());
        return false;
    }
}

/**
 * تحديد مدة الاحتفاظ للفاتورة بناءً على أنواع المنتجات
 * @param string $saleId - معرف الفاتورة
 * @return int - عدد الأيام (365 للهاتف، 90 للإكسسوارات/قطع الغيار)
 */
function getInvoiceRetentionDays($saleId) {
    try {
        // جلب عناصر الفاتورة
        $items = dbSelect(
            "SELECT DISTINCT item_type FROM sale_items WHERE sale_id = ?",
            [$saleId]
        );
        
        if (empty($items) || !is_array($items)) {
            // إذا لم تكن هناك عناصر، نستخدم القيمة الافتراضية (90 يوم)
            return 90;
        }
        
        $hasPhone = false;
        
        foreach ($items as $item) {
            $itemType = $item['item_type'] ?? '';
            // إذا كان يوجد هاتف → 365 يوم
            if ($itemType === 'phone') {
                $hasPhone = true;
                break; // لا حاجة للاستمرار إذا وجدنا هاتف
            }
        }
        
        // إذا كان يوجد هاتف → 365 يوم
        if ($hasPhone) {
            return 365;
        }
        
        // وإلا → 90 يوم (لإكسسوارات أو قطع غيار)
        return 90;
        
    } catch (Exception $e) {
        error_log('خطأ في تحديد مدة الاحتفاظ للفاتورة ' . $saleId . ': ' . $e->getMessage());
        // في حالة الخطأ، نستخدم القيمة الافتراضية (90 يوم)
        return 90;
    }
}

/**
 * التحقق إذا كان يجب تشغيل cleanup اليوم
 * @return bool
 */
function shouldRunCleanupToday() {
    try {
        $settings = getInvoiceCleanupSettings();
        
        // إذا كان النظام معطلاً
        if (!($settings['enabled'] ?? true)) {
            return false;
        }
        
        $lastCleanupDate = $settings['last_cleanup_date'] ?? null;
        
        // إذا لم يتم cleanup من قبل، يجب التشغيل
        if (empty($lastCleanupDate)) {
            return true;
        }
        
        // التحقق إذا كان آخر cleanup اليوم
        $today = date('Y-m-d');
        $lastCleanupDay = date('Y-m-d', strtotime($lastCleanupDate));
        
        // إذا كان آخر cleanup اليوم، لا نحتاج للتشغيل مرة أخرى
        if ($lastCleanupDay === $today) {
            return false;
        }
        
        // إذا كان آخر cleanup قبل اليوم، يجب التشغيل
        return true;
        
    } catch (Exception $e) {
        error_log('خطأ في التحقق من الحاجة لتنظيف الفواتير: ' . $e->getMessage());
        // في حالة الخطأ، لا نشغل cleanup لتجنب المشاكل
        return false;
    }
}

/**
 * تنفيذ عملية تنظيف الفواتير القديمة
 * @return array
 */
function performInvoiceCleanup() {
    $settings = getInvoiceCleanupSettings();
    
    if (!($settings['enabled'] ?? true)) {
        return [
            'success' => false,
            'message' => 'التنظيف التلقائي معطل',
            'deleted_count' => 0
        ];
    }
    
    $batchSize = intval($settings['batch_size'] ?? 50);
    $maxExecutionTime = intval($settings['max_execution_time'] ?? 30);
    
    $startTime = time();
    $deletedCount = 0;
    $deletedSize = 0;
    $errors = [];
    
    try {
        // جلب جميع الفواتير مع تاريخ إنشائها
        // نأخذ أكثر من batch_size لتغطية الحالات التي قد تحتاج حذف فواتير مختلفة
        $allSales = dbSelect(
            "SELECT id, sale_number, created_at FROM sales ORDER BY created_at ASC",
            []
        );
        
        if (empty($allSales) || !is_array($allSales)) {
            // تحديث آخر تاريخ cleanup
            $settings['last_cleanup_date'] = date('Y-m-d H:i:s');
            updateInvoiceCleanupSettings($settings);
            
            return [
                'success' => true,
                'message' => 'لا توجد فواتير للحذف',
                'deleted_count' => 0
            ];
        }
        
        $currentDate = time();
        $processedCount = 0;
        
        // معالجة كل فاتورة
        foreach ($allSales as $sale) {
            // التحقق من الوقت المتبقي
            if ((time() - $startTime) >= $maxExecutionTime) {
                break; // التوقف إذا تجاوز الوقت المحدد
            }
            
            // التحقق إذا وصلنا للحد الأقصى
            if ($deletedCount >= $batchSize) {
                break;
            }
            
            $saleId = $sale['id'] ?? '';
            $saleNumber = $sale['sale_number'] ?? '';
            $createdAt = $sale['created_at'] ?? '';
            
            if (empty($saleId) || empty($saleNumber) || empty($createdAt)) {
                continue; // تخطي الفواتير التي تفتقد بيانات أساسية
            }
            
            // تحديد مدة الاحتفاظ للفاتورة
            $retentionDays = getInvoiceRetentionDays($saleId);
            
            // حساب تاريخ القطع (الفواتير الأقدم من هذا التاريخ سيتم حذفها)
            $cutoffTimestamp = strtotime("-{$retentionDays} days", $currentDate);
            $saleTimestamp = strtotime($createdAt);
            
            // إذا كانت الفاتورة أقدم من تاريخ القطع
            if ($saleTimestamp < $cutoffTimestamp) {
                // حذف ملف الفاتورة
                $filename = 'invoice_' . $saleNumber . '.html';
                $filepath = INVOICES_DIR . $filename;
                
                if (file_exists($filepath)) {
                    $fileSize = filesize($filepath);
                    
                    if (unlink($filepath)) {
                        $deletedCount++;
                        $deletedSize += $fileSize;
                    } else {
                        $errors[] = "فشل حذف فاتورة: {$saleNumber}";
                    }
                } else {
                    // الملف غير موجود بالفعل (ربما تم حذفه مسبقاً)
                    // نعد هذا نجاحاً
                }
            }
            
            $processedCount++;
        }
        
        // تحديث الإعدادات
        $settings['last_cleanup_date'] = date('Y-m-d H:i:s');
        $settings['total_deleted'] = intval($settings['total_deleted'] ?? 0) + $deletedCount;
        $settings['last_run_stats'] = [
            'date' => date('Y-m-d H:i:s'),
            'deleted_count' => $deletedCount,
            'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2),
            'execution_time_seconds' => time() - $startTime,
            'processed_count' => $processedCount,
            'errors' => $errors
        ];
        
        updateInvoiceCleanupSettings($settings);
        
        return [
            'success' => true,
            'message' => "تم حذف {$deletedCount} فاتورة بنجاح",
            'deleted_count' => $deletedCount,
            'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2),
            'execution_time_seconds' => time() - $startTime,
            'processed_count' => $processedCount,
            'errors' => $errors
        ];
        
    } catch (Exception $e) {
        error_log('خطأ في تنظيف الفواتير: ' . $e->getMessage());
        return [
            'success' => false,
            'message' => 'خطأ في عملية التنظيف: ' . $e->getMessage(),
            'deleted_count' => $deletedCount,
            'errors' => array_merge($errors, [$e->getMessage()])
        ];
    }
}

/**
 * جدولة تنظيف الفواتير إذا لزم الأمر
 * يتم استدعاؤها من config.php عند تهيئة النظام
 */
function scheduleInvoiceCleanupIfNeeded() {
    try {
        // التحقق إذا كان يجب تشغيل cleanup اليوم
        if (!shouldRunCleanupToday()) {
            return; // لا حاجة لتنظيف اليوم
        }
        
        // جدولة cleanup للتنفيذ بعد إرسال الاستجابة
        register_shutdown_function(function() {
            try {
                // إعطاء وقت إضافي للتنفيذ (بعد إرسال الاستجابة)
                set_time_limit(30);
                
                // تنفيذ cleanup
                $result = performInvoiceCleanup();
                
                // تسجيل النتيجة
                if ($result['success']) {
                    error_log('Invoice Cleanup: SUCCESS - Deleted ' . ($result['deleted_count'] ?? 0) . ' invoices');
                } else {
                    error_log('Invoice Cleanup: FAILED - ' . ($result['message'] ?? 'Unknown error'));
                }
                
            } catch (Exception $e) {
                error_log('Invoice Cleanup ERROR: ' . $e->getMessage());
            }
        });
        
    } catch (Exception $e) {
        error_log('خطأ في جدولة تنظيف الفواتير: ' . $e->getMessage());
        // لا نوقف التنفيذ، فقط نسجل الخطأ
    }
}
?>

<?php
/**
 * حذف الرسائل حسب الفترة الزمنية (للمالك فقط)
 */
require_once __DIR__ . '/config.php';

try {
    $session = checkAuth();
    $userId = $session['user_id'];
    
    // التحقق من أن المستخدم مالك (admin فقط)
    $user = dbSelectOne("SELECT role FROM users WHERE id = ?", [$userId]);
    
    if (!$user || $user['role'] !== 'admin') {
        response(false, 'هذه الميزة متاحة للمالك فقط', null, 403);
        return;
    }
    
    // قراءة البيانات
    $data = getRequestData();
    $fromDate = $data['from_date'] ?? null;
    $toDate = $data['to_date'] ?? null;
    
    if (!$fromDate || !$toDate) {
        response(false, 'يرجى تحديد الفترة الزمنية', null, 400);
        return;
    }
    
    // التحقق من صحة التواريخ
    $fromDateTime = DateTime::createFromFormat('Y-m-d\TH:i', $fromDate);
    $toDateTime = DateTime::createFromFormat('Y-m-d\TH:i', $toDate);
    
    if (!$fromDateTime || !$toDateTime) {
        response(false, 'صيغة التاريخ غير صحيحة', null, 400);
        return;
    }
    
    if ($fromDateTime > $toDateTime) {
        response(false, 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية', null, 400);
        return;
    }
    
    // تحويل التواريخ إلى صيغة قاعدة البيانات
    $fromDateFormatted = $fromDateTime->format('Y-m-d H:i:s');
    $toDateFormatted = $toDateTime->format('Y-m-d H:i:s');
    
    // جلب جميع الرسائل المراد حذفها مع معلومات الملفات
    $messagesToDelete = dbSelect("
        SELECT id, file_path, file_type 
        FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
        AND file_path IS NOT NULL
        AND file_path != ''
    ", [$fromDateFormatted, $toDateFormatted]);
    
    // حذف الملفات المرتبطة بالرسائل
    $deletedFilesCount = 0;
    if (!empty($messagesToDelete)) {
        foreach ($messagesToDelete as $msg) {
            $filePath = $msg['file_path'];
            if (!empty($filePath)) {
                // بناء المسار الكامل
                $fullPath = __DIR__ . '/../' . ltrim($filePath, '/');
                
                // حذف الملف إذا كان موجوداً
                if (file_exists($fullPath)) {
                    try {
                        if (unlink($fullPath)) {
                            $deletedFilesCount++;
                            error_log("تم حذف الملف: $fullPath");
                        }
                    } catch (Exception $fileError) {
                        error_log("خطأ في حذف الملف $fullPath: " . $fileError->getMessage());
                    }
                }
            }
        }
    }
    
    // حذف الرسائل في الفترة المحددة
    // استخدام soft delete (تحديث deleted_at) بدلاً من الحذف الفعلي
    $deletedCount = dbExecute("
        UPDATE chat_messages 
        SET deleted_at = NOW() 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    if ($deletedCount === false) {
        response(false, 'حدث خطأ في حذف الرسائل', null, 500);
        return;
    }
    
    // تسجيل العملية
    error_log("تم حذف $deletedCount رسالة و $deletedFilesCount ملف من $fromDateFormatted إلى $toDateFormatted بواسطة المستخدم $userId");
    
    response(true, "تم حذف $deletedCount رسالة و $deletedFilesCount ملف بنجاح", [
        'deleted_count' => $deletedCount,
        'deleted_files_count' => $deletedFilesCount,
        'from_date' => $fromDateFormatted,
        'to_date' => $toDateFormatted
    ]);
    
} catch (Exception $e) {
    error_log('خطأ في delete_messages.php: ' . $e->getMessage());
    response(false, 'حدث خطأ في حذف الرسائل: ' . $e->getMessage(), null, 500);
} catch (Error $e) {
    error_log('خطأ قاتل في delete_messages.php: ' . $e->getMessage());
    response(false, 'حدث خطأ قاتل في حذف الرسائل', null, 500);
}
?>


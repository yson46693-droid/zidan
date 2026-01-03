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
    
    // جلب جميع الرسائل المراد حذفها مع معلومات الملفات (بما فيها الصوتية)
    $messagesToDelete = dbSelect("
        SELECT id, file_path, message_type 
        FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    // حذف الملفات المرتبطة بالرسائل
    $deletedFilesCount = 0;
    $audioFilesDeleted = 0;
    $otherFilesDeleted = 0;
    
    if (!empty($messagesToDelete)) {
        foreach ($messagesToDelete as $msg) {
            $filePath = $msg['file_path'] ?? null;
            $messageType = $msg['message_type'] ?? 'text';
            
            // حذف الملفات الصوتية
            if ($messageType === 'audio' || !empty($filePath)) {
                // إذا كان هناك file_path محفوظ، استخدمه
                if (!empty($filePath)) {
                    $fullPath = __DIR__ . '/../' . ltrim($filePath, '/');
                    
                    // حذف الملف إذا كان موجوداً
                    if (file_exists($fullPath)) {
                        try {
                            if (unlink($fullPath)) {
                                $deletedFilesCount++;
                                if ($messageType === 'audio') {
                                    $audioFilesDeleted++;
                                } else {
                                    $otherFilesDeleted++;
                                }
                                error_log("تم حذف الملف: $fullPath");
                            }
                        } catch (Exception $fileError) {
                            error_log("خطأ في حذف الملف $fullPath: " . $fileError->getMessage());
                        }
                    }
                }
            }
        }
    }
    
    // حذف جميع الملفات الصوتية من مجلد audio إذا كان الحذف شامل (من تاريخ قديم جداً)
    // هذا يضمن حذف جميع الملفات الصوتية المرتبطة بالرسائل المحذوفة
    $audioDir = __DIR__ . '/../chat/audio/';
    if (is_dir($audioDir)) {
        // فقط إذا كانت الفترة كبيرة (من تاريخ قديم جداً)، نحذف جميع الملفات
        // يمكن التحقق من ذلك بفحص إذا كان fromDateFormatted قريب من 1970-01-01
        $fromTimestamp = strtotime($fromDateFormatted);
        $oldTimestamp = strtotime('1970-01-01 00:00:00');
        
        // إذا كانت الفترة تبدأ من تاريخ قديم جداً (أقل من 1980)، نحذف جميع الملفات الصوتية
        if ($fromTimestamp < strtotime('1980-01-01 00:00:00')) {
            $audioFiles = glob($audioDir . '*.*');
            if (!empty($audioFiles)) {
                foreach ($audioFiles as $audioFile) {
                    try {
                        if (is_file($audioFile) && unlink($audioFile)) {
                            $audioFilesDeleted++;
                            $deletedFilesCount++;
                            error_log("تم حذف ملف صوتي: $audioFile");
                        }
                    } catch (Exception $fileError) {
                        error_log("خطأ في حذف الملف الصوتي $audioFile: " . $fileError->getMessage());
                    }
                }
            }
        }
    }
    
    // جلب IDs الرسائل المراد حذفها لحذف reactions أولاً
    $messageIdsToDelete = dbSelect("
        SELECT id FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    // حذف جميع ردود الفعل (reactions) المرتبطة بالرسائل المراد حذفها
    $reactionsDeleted = 0;
    if (!empty($messageIdsToDelete)) {
        $messageIds = array_column($messageIdsToDelete, 'id');
        if (!empty($messageIds)) {
            // استخدام prepared statement مع IN clause
            $placeholders = str_repeat('?,', count($messageIds) - 1) . '?';
            $reactionsDeleted = dbExecute("
                DELETE FROM chat_reactions 
                WHERE message_id IN ($placeholders)
            ", $messageIds);
            
            if ($reactionsDeleted === false) {
                $reactionsDeleted = 0;
            }
        }
    }
    
    // حذف الرسائل في الفترة المحددة (حذف فعلي من قاعدة البيانات)
    $deletedCount = dbExecute("
        DELETE FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    if ($deletedCount === false) {
        response(false, 'حدث خطأ في حذف الرسائل', null, 500);
        return;
    }
    
    // تسجيل العملية
    error_log("تم حذف $deletedCount رسالة و $deletedFilesCount ملف ($audioFilesDeleted ملف صوتي) من $fromDateFormatted إلى $toDateFormatted بواسطة المستخدم $userId");
    
    $message = "تم حذف $deletedCount رسالة بنجاح";
    if ($deletedFilesCount > 0) {
        $message .= " وتم حذف $deletedFilesCount ملف";
        if ($audioFilesDeleted > 0) {
            $message .= " ($audioFilesDeleted ملف صوتي)";
        }
    }
    
    response(true, $message, [
        'deleted_count' => $deletedCount,
        'deleted_files_count' => $deletedFilesCount,
        'audio_files_deleted' => $audioFilesDeleted,
        'other_files_deleted' => $otherFilesDeleted,
        'reactions_deleted' => $reactionsDeleted !== false ? $reactionsDeleted : 0,
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


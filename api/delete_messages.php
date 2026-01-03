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
    // ✅ جلب file_path (النظام القديم) و file_url (النظام الجديد)
    // التحقق من وجود الأعمدة أولاً لتجنب الأخطاء
    $hasFileUrl = dbColumnExists('chat_messages', 'file_url');
    $hasMessageType = dbColumnExists('chat_messages', 'message_type');
    
    $selectFields = 'id, file_path, message';
    if ($hasFileUrl) {
        $selectFields .= ', file_url';
    }
    if ($hasMessageType) {
        $selectFields .= ', message_type';
    }
    
    $messagesToDelete = dbSelect("
        SELECT $selectFields
        FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    // حذف الملفات المرتبطة بالرسائل
    $deletedFilesCount = 0;
    $audioFilesDeleted = 0;
    $imageFilesDeleted = 0;
    $otherFilesDeleted = 0;
    
    if (!empty($messagesToDelete)) {
        foreach ($messagesToDelete as $msg) {
            $filePath = $msg['file_path'] ?? null; // النظام القديم
            $fileUrl = ($hasFileUrl && isset($msg['file_url'])) ? $msg['file_url'] : null; // النظام الجديد
            $messageType = ($hasMessageType && isset($msg['message_type'])) ? $msg['message_type'] : 'text';
            
            // ✅ حذف الملفات من file_path (النظام القديم)
            if (!empty($filePath)) {
                $fullPath = __DIR__ . '/../' . ltrim($filePath, '/');
                
                // حذف الملف إذا كان موجوداً
                if (file_exists($fullPath)) {
                    try {
                        if (unlink($fullPath)) {
                            $deletedFilesCount++;
                            // تصنيف الملفات
                            if (strpos($filePath, '/audio/') !== false || $messageType === 'audio') {
                                $audioFilesDeleted++;
                            } elseif (strpos($filePath, '/images/') !== false || $messageType === 'image') {
                                $imageFilesDeleted++;
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
            
            // ✅ حذف الملفات من file_url (النظام الجديد)
            if (!empty($fileUrl)) {
                // تخطي الملفات التي تبدأ بـ "location:" لأنها بيانات JSON وليست ملفات حقيقية
                if (strpos($fileUrl, 'location:') === 0) {
                    continue;
                }
                
                $fullPath = __DIR__ . '/../' . ltrim($fileUrl, '/');
                
                // حذف الملف إذا كان موجوداً
                if (file_exists($fullPath)) {
                    try {
                        if (unlink($fullPath)) {
                            $deletedFilesCount++;
                            // تصنيف الملفات
                            if (strpos($fileUrl, '/audio/') !== false || $messageType === 'audio') {
                                $audioFilesDeleted++;
                            } elseif (strpos($fileUrl, '/images/') !== false || $messageType === 'image') {
                                $imageFilesDeleted++;
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
    
    // جلب IDs الرسائل المراد حذفها لحذف البيانات المرتبطة أولاً
    $messageIdsToDelete = dbSelect("
        SELECT id, message FROM chat_messages 
        WHERE created_at >= ? 
        AND created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at = '')
    ", [$fromDateFormatted, $toDateFormatted]);
    
    // ✅ حذف جميع ردود الفعل (reactions) المرتبطة بالرسائل المراد حذفها
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
    
    // ✅ حذف جميع الإشعارات المعلقة (chat_pending_notifications) المرتبطة بالرسائل
    $notificationsDeleted = 0;
    if (!empty($messageIdsToDelete)) {
        $messageIds = array_column($messageIdsToDelete, 'id');
        if (!empty($messageIds)) {
            if (dbTableExists('chat_pending_notifications')) {
                $placeholders = str_repeat('?,', count($messageIds) - 1) . '?';
                $notificationsDeleted = dbExecute("
                    DELETE FROM chat_pending_notifications 
                    WHERE message_id IN ($placeholders)
                ", $messageIds);
                
                if ($notificationsDeleted === false) {
                    $notificationsDeleted = 0;
                }
            }
        }
    }
    
    // ✅ حذف طلبات المنتجات (inventory_requests) المرتبطة بالرسائل
    // البحث عن الرسائل التي تحتوي على "📦 طلب منتج" أو "📋 تحديث طلب قطع غيار"
    $inventoryRequestsDeleted = 0;
    if (!empty($messageIdsToDelete)) {
        foreach ($messageIdsToDelete as $msgData) {
            $messageText = $msgData['message'] ?? '';
            $messageId = $msgData['id'];
            
            // التحقق من أن الرسالة تحتوي على طلب منتج
            if (strpos($messageText, '📦 طلب منتج') !== false || 
                strpos($messageText, '📋 تحديث طلب قطع غيار') !== false) {
                
                // استخراج رقم الطلب من الرسالة
                if (preg_match('/رقم الطلب:\s*([^\n]+)/', $messageText, $matches)) {
                    $requestNumber = trim($matches[1]);
                    
                    // البحث عن الطلب في جدول inventory_requests
                    if (dbTableExists('inventory_requests')) {
                        $request = dbSelectOne("
                            SELECT id FROM inventory_requests 
                            WHERE request_number = ? 
                            AND created_at >= ? 
                            AND created_at <= ?
                        ", [$requestNumber, $fromDateFormatted, $toDateFormatted]);
                        
                        if ($request) {
                            // حذف الطلب
                            $deleteResult = dbExecute("DELETE FROM inventory_requests WHERE id = ?", [$request['id']]);
                            if ($deleteResult) {
                                $inventoryRequestsDeleted++;
                                error_log("تم حذف طلب المنتج: {$request['id']} (رقم الطلب: $requestNumber)");
                            }
                        }
                    }
                }
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
    error_log("تم حذف $deletedCount رسالة و $deletedFilesCount ملف ($audioFilesDeleted ملف صوتي، $imageFilesDeleted صورة، $otherFilesDeleted ملف آخر) و $reactionsDeleted رد فعل و $notificationsDeleted إشعار و $inventoryRequestsDeleted طلب منتج من $fromDateFormatted إلى $toDateFormatted بواسطة المستخدم $userId");
    
    $message = "تم حذف $deletedCount رسالة بنجاح";
    if ($deletedFilesCount > 0) {
        $message .= " وتم حذف $deletedFilesCount ملف";
        $fileDetails = [];
        if ($audioFilesDeleted > 0) {
            $fileDetails[] = "$audioFilesDeleted ملف صوتي";
        }
        if ($imageFilesDeleted > 0) {
            $fileDetails[] = "$imageFilesDeleted صورة";
        }
        if ($otherFilesDeleted > 0) {
            $fileDetails[] = "$otherFilesDeleted ملف آخر";
        }
        if (!empty($fileDetails)) {
            $message .= " (" . implode(', ', $fileDetails) . ")";
        }
    }
    if ($reactionsDeleted > 0) {
        $message .= " و $reactionsDeleted رد فعل";
    }
    if ($notificationsDeleted > 0) {
        $message .= " و $notificationsDeleted إشعار";
    }
    if ($inventoryRequestsDeleted > 0) {
        $message .= " و $inventoryRequestsDeleted طلب منتج";
    }
    
    response(true, $message, [
        'deleted_count' => $deletedCount,
        'deleted_files_count' => $deletedFilesCount,
        'audio_files_deleted' => $audioFilesDeleted,
        'image_files_deleted' => $imageFilesDeleted,
        'other_files_deleted' => $otherFilesDeleted,
        'reactions_deleted' => $reactionsDeleted !== false ? $reactionsDeleted : 0,
        'notifications_deleted' => $notificationsDeleted !== false ? $notificationsDeleted : 0,
        'inventory_requests_deleted' => $inventoryRequestsDeleted,
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


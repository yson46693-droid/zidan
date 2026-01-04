<?php
/**
 * API إدارة العمليات الخاسرة
 * تسجيل وتتبع العمليات التي أدت إلى خسائر مالية
 * 
 * ✅ تم تعطيل هذا الملف - لم يعد مستخدماً
 */

// ✅ إرجاع استجابة فارغة فوراً - منع أي تنفيذ
http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => false,
    'message' => 'هذه الوظيفة غير متاحة حالياً',
    'data' => []
], JSON_UNESCAPED_UNICODE);
exit;

require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();

// الحصول على العمليات الخاسرة
if ($method === 'GET') {
    checkAuth();
    
    if (isset($_GET['action']) && $_GET['action'] === 'stats') {
        // إحصائيات العمليات الخاسرة
        $lossOperations = dbSelect("SELECT * FROM loss_operations");
        
        if ($lossOperations === false) {
            response(false, 'خطأ في قراءة العمليات الخاسرة', null, 500);
        }
        
        $totalLosses = 0;
        $lossesByReason = [];
        $lossesByMonth = [];
        
        foreach ($lossOperations as $operation) {
            $totalLosses += floatval($operation['loss_amount']);
            
            // تجميع حسب السبب
            $reason = $operation['loss_reason'];
            if (!isset($lossesByReason[$reason])) {
                $lossesByReason[$reason] = 0;
            }
            $lossesByReason[$reason] += floatval($operation['loss_amount']);
            
            // تجميع حسب الشهر
            $month = date('Y-m', strtotime($operation['created_at']));
            if (!isset($lossesByMonth[$month])) {
                $lossesByMonth[$month] = 0;
            }
            $lossesByMonth[$month] += floatval($operation['loss_amount']);
        }
        
        $stats = [
            'total_losses' => $totalLosses,
            'total_operations' => count($lossOperations),
            'losses_by_reason' => $lossesByReason,
            'losses_by_month' => $lossesByMonth,
            'average_loss' => count($lossOperations) > 0 ? $totalLosses / count($lossOperations) : 0
        ];
        
        response(true, 'تم تحميل إحصائيات العمليات الخاسرة', $stats);
    } else {
        // قراءة جميع العمليات
        $lossOperations = dbSelect("SELECT * FROM loss_operations ORDER BY created_at DESC");
        
        if ($lossOperations === false) {
            response(false, 'خطأ في قراءة العمليات الخاسرة', null, 500);
        }
        
        response(true, 'تم تحميل العمليات الخاسرة', $lossOperations);
    }
}

// إضافة عملية خاسرة جديدة
if ($method === 'POST') {
    checkAuth();
    
    // التحقق من البيانات المطلوبة
    $requiredFields = ['repair_number', 'customer_name', 'device_type', 'problem', 'loss_amount', 'loss_reason'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            response(false, "الحقل {$field} مطلوب", null, 400);
        }
    }
    
    $lossId = generateId();
    $session = checkAuth();
    
    // بدء المعاملة
    dbBeginTransaction();
    
    try {
        // 1. إضافة العملية الخاسرة
        $result = dbExecute(
            "INSERT INTO loss_operations (
                id, repair_number, customer_name, device_type, problem, 
                loss_amount, loss_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
            [
                $lossId,
                $data['repair_number'],
                $data['customer_name'],
                $data['device_type'],
                $data['problem'],
                floatval($data['loss_amount']),
                $data['loss_reason']
            ]
        );
        
        if ($result === false) {
            throw new Exception('فشل في حفظ العملية الخاسرة');
        }
        
        // 2. جلب branch_id من عملية الصيانة
        $repair = dbSelectOne("SELECT branch_id FROM repairs WHERE repair_number = ?", [$data['repair_number']]);
        
        if ($repair && isset($repair['branch_id']) && !empty($repair['branch_id'])) {
            $branchId = $repair['branch_id'];
            
            // 3. تسجيل المعاملة في treasury_transactions
            if (dbTableExists('treasury_transactions')) {
                // التحقق من وجود 'loss_operation' في enum
                $conn = getDBConnection();
                if ($conn) {
                    try {
                        // محاولة إضافة 'loss_operation' إلى enum إذا لم يكن موجوداً
                        $conn->query("ALTER TABLE treasury_transactions MODIFY transaction_type enum('expense','repair_cost','repair_profit','loss_operation','sales_revenue','sales_cost','withdrawal','deposit','damaged_return','debt_collection','normal_return') NOT NULL");
                    } catch (Exception $e) {
                        // تجاهل الخطأ إذا كان العمود موجوداً بالفعل
                    }
                }
                
                $transactionId = generateId();
                $lossAmount = floatval($data['loss_amount']);
                $description = "عملية خاسرة - رقم العملية: {$data['repair_number']} - {$data['loss_reason']}";
                
                $transactionResult = dbExecute(
                    "INSERT INTO treasury_transactions (
                        id, branch_id, transaction_type, amount, description, 
                        reference_id, reference_type, created_at, created_by
                    ) VALUES (?, ?, 'loss_operation', ?, ?, ?, 'loss_operation', NOW(), ?)",
                    [$transactionId, $branchId, $lossAmount, $description, $lossId, $session['user_id']]
                );
                
                if ($transactionResult === false) {
                    throw new Exception('فشل في تسجيل المعاملة في سجل الخزنة');
                }
            }
        }
        
        // تأكيد المعاملة
        dbCommit();
        
        $lossOperation = dbSelectOne("SELECT * FROM loss_operations WHERE id = ?", [$lossId]);
        
        response(true, 'تم تسجيل العملية الخاسرة بنجاح', $lossOperation);
        
    } catch (Exception $e) {
        // إلغاء المعاملة في حالة الخطأ
        dbRollback();
        error_log('خطأ في تسجيل العملية الخاسرة: ' . $e->getMessage());
        response(false, 'فشل في حفظ العملية الخاسرة: ' . $e->getMessage(), null, 500);
    }
}

// تحديث عملية خاسرة
if ($method === 'PUT') {
    checkAuth();
    
    if (!isset($data['id'])) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    $id = $data['id'];
    
    // التحقق من وجود العملية
    $operation = dbSelectOne("SELECT id FROM loss_operations WHERE id = ?", [$id]);
    if (!$operation) {
        response(false, 'العملية الخاسرة غير موجودة', null, 404);
    }
    
    // بناء استعلام التحديث
    $updateFields = [];
    $updateParams = [];
    
    $fields = ['repair_number', 'customer_name', 'device_type', 'problem', 'loss_amount', 'loss_reason'];
    
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if ($field === 'loss_amount') {
                $updateFields[] = "$field = ?";
                $updateParams[] = floatval($data[$field]);
            } else {
                $updateFields[] = "$field = ?";
                $updateParams[] = $data[$field];
            }
        }
    }
    
    if (empty($updateFields)) {
        response(false, 'لا توجد بيانات للتحديث', null, 400);
    }
    
    $updateFields[] = "updated_at = NOW()";
    $updateParams[] = $id;
    
    $query = "UPDATE loss_operations SET " . implode(', ', $updateFields) . " WHERE id = ?";
    
    $result = dbExecute($query, $updateParams);
    
    if ($result === false) {
        response(false, 'فشل في تحديث العملية الخاسرة', null, 500);
    }
    
    $updatedOperation = dbSelectOne("SELECT * FROM loss_operations WHERE id = ?", [$id]);
    
    response(true, 'تم تحديث العملية الخاسرة بنجاح', $updatedOperation);
}

// حذف عملية خاسرة
if ($method === 'DELETE') {
    checkAuth();
    
    if (!isset($data['id'])) {
        response(false, 'معرف العملية مطلوب', null, 400);
    }
    
    $id = $data['id'];
    
    // التحقق من وجود العملية
    $operation = dbSelectOne("SELECT id FROM loss_operations WHERE id = ?", [$id]);
    if (!$operation) {
        response(false, 'العملية الخاسرة غير موجودة', null, 404);
    }
    
    $result = dbExecute("DELETE FROM loss_operations WHERE id = ?", [$id]);
    
    if ($result === false) {
        response(false, 'فشل في حذف العملية الخاسرة', null, 500);
    }
    
    response(true, 'تم حذف العملية الخاسرة بنجاح');
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

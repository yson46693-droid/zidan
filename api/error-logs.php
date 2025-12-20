<?php
/**
 * API: إدارة سجلات الأخطاء
 */

require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();

// مسار ملف السجلات
$logFile = __DIR__ . '/../logs/php_errors.log';

// جلب السجلات
if ($method === 'GET') {
    checkPermission('manager'); // فقط المديرين والمديرين يمكنهم الوصول
    
    $lines = isset($_GET['lines']) ? (int)$_GET['lines'] : 1000; // عدد الأسطر الافتراضي
    $lines = max(1, min($lines, 10000)); // حد أقصى 10000 سطر
    
    if (!file_exists($logFile)) {
        response(true, 'ملف السجلات غير موجود', [
            'logs' => [],
            'total_lines' => 0,
            'file_size' => 0,
            'file_exists' => false
        ]);
    }
    
    $fileSize = filesize($logFile);
    $fileExists = true;
    
    // قراءة آخر N سطر من الملف
    $logs = [];
    if ($fileSize > 0) {
        // استخدام file() لقراءة الملف كله ثم أخذ آخر N سطر
        // هذه الطريقة أكثر كفاءة للملفات الصغيرة والمتوسطة
        $allLines = @file($logFile, FILE_IGNORE_NEW_LINES);
        
        if ($allLines !== false && !empty($allLines)) {
            // أخذ آخر N سطر (نحتفظ بجميع الأسطر بما فيها الفارغة)
            $linesArray = array_slice($allLines, -$lines);
            
            // إذا كان الملف كبير جداً، نستخدم طريقة أخرى
            if (count($allLines) > 10000 && $fileSize > 5 * 1024 * 1024) {
                // للملفات الكبيرة جداً، نقرأ من النهاية
                $handle = @fopen($logFile, 'r');
                if ($handle) {
                    $linesArray = [];
                    $currentLine = '';
                    $pos = $fileSize - 1;
                    $lineCount = 0;
                    
                    // قراءة الملف من النهاية إلى البداية
                    while ($pos >= 0 && $lineCount < $lines) {
                        fseek($handle, $pos);
                        $char = fgetc($handle);
                        
                        if ($char === "\n") {
                            if ($currentLine !== '') {
                                array_unshift($linesArray, $currentLine);
                                $lineCount++;
                                $currentLine = '';
                            }
                        } else {
                            $currentLine = $char . $currentLine;
                        }
                        
                        $pos--;
                    }
                    
                    // إضافة السطر الأخير إذا كان موجوداً
                    if ($currentLine !== '' && $lineCount < $lines) {
                        array_unshift($linesArray, $currentLine);
                    }
                    
                    fclose($handle);
                }
            }
            
            // تحليل السجلات
            $totalLines = count($linesArray);
            foreach ($linesArray as $index => $line) {
                $line = trim($line);
                if (empty($line)) {
                    continue;
                }
                
                // محاولة استخراج التاريخ والوقت
                $timestamp = null;
                $logType = 'info';
                $message = $line;
                
                // نمط: [19-Dec-2025 17:12:05 UTC] ...
                if (preg_match('/^\[([^\]]+)\]\s*(.+)$/', $line, $matches)) {
                    $timestamp = $matches[1];
                    $message = $matches[2];
                    
                    // تحديد نوع السجل
                    if (stripos($message, 'error') !== false || stripos($message, 'خطأ') !== false || preg_match('/PHP Error/i', $message)) {
                        $logType = 'error';
                    } elseif (stripos($message, 'warning') !== false || stripos($message, 'تحذير') !== false || preg_match('/PHP Warning/i', $message)) {
                        $logType = 'warning';
                    } elseif (stripos($message, 'notice') !== false || preg_match('/PHP Notice/i', $message)) {
                        $logType = 'notice';
                    }
                }
                
                $logs[] = [
                    'line_number' => $totalLines - $index,
                    'timestamp' => $timestamp,
                    'type' => $logType,
                    'message' => $message,
                    'raw' => $line
                ];
            }
        }
    }
    
    response(true, '', [
        'logs' => $logs,
        'total_lines' => count($logs),
        'file_size' => $fileSize,
        'file_exists' => $fileExists,
        'file_path' => $logFile
    ]);
}

// حذف السجلات
if ($method === 'DELETE') {
    checkPermission('admin'); // فقط المديرين يمكنهم الحذف
    
    if (!file_exists($logFile)) {
        response(true, 'ملف السجلات غير موجود', ['deleted' => false]);
    }
    
    // حذف محتوى الملف
    $result = @file_put_contents($logFile, '');
    
    if ($result !== false) {
        response(true, 'تم حذف السجلات بنجاح', ['deleted' => true]);
    } else {
        response(false, 'فشل حذف السجلات', ['deleted' => false], 500);
    }
}

// نسخ السجل
if ($method === 'POST' && isset($data['action']) && $data['action'] === 'copy') {
    checkPermission('manager');
    
    $logContent = $data['content'] ?? '';
    
    if (empty($logContent)) {
        response(false, 'لا يوجد محتوى للنسخ', null, 400);
    }
    
    // إرجاع المحتوى للنسخ
    response(true, 'تم تحضير المحتوى للنسخ', [
        'content' => $logContent
    ]);
}

// جلب معلومات الملف
if ($method === 'GET' && isset($_GET['info'])) {
    checkPermission('manager');
    
    $info = [
        'file_exists' => file_exists($logFile),
        'file_size' => file_exists($logFile) ? filesize($logFile) : 0,
        'file_path' => $logFile,
        'last_modified' => file_exists($logFile) ? date('Y-m-d H:i:s', filemtime($logFile)) : null,
        'readable' => file_exists($logFile) ? is_readable($logFile) : false,
        'writable' => file_exists($logFile) ? is_writable($logFile) : false
    ];
    
    response(true, '', $info);
}

response(false, 'طلب غير صحيح', null, 400);

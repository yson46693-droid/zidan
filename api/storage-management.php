<?php
/**
 * API إدارة التخزين - للمالك فقط
 * يتيح للمالك عرض وحذف الملفات المخزنة (الفواتير والصور)
 */

require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();

// التحقق من الصلاحية - المالك فقط
checkPermission('admin');

$type = $_GET['type'] ?? $data['type'] ?? '';

// تعريف المجلدات (فقط إذا لم تكن معرّفة مسبقاً)
if (!defined('INVOICES_DIR')) {
    define('INVOICES_DIR', __DIR__ . '/../invoices/');
}
if (!defined('IMAGES_DIR')) {
    define('IMAGES_DIR', __DIR__ . '/../images/');
}

// قراءة الملفات
if ($method === 'GET') {
    try {
        if ($type === 'database') {
            // معلومات قاعدة البيانات
            $dbInfo = getDatabaseInfo();
            response(true, 'تم تحميل معلومات قاعدة البيانات', $dbInfo);
        } elseif ($type === 'invoices') {
            // ملفات الفواتير
            $files = getStorageFiles('invoices');
            response(true, 'تم تحميل ملفات الفواتير', $files);
        } elseif ($type === 'images') {
            // ملفات الصور (من المجلد + من قاعدة البيانات)
            $files = getStorageFiles('images');
            $dbImages = getDatabaseImages();
            // دمج الصور من المجلد وقاعدة البيانات
            $allImages = array_merge($files, $dbImages);
            response(true, 'تم تحميل ملفات الصور', $allImages);
        } else {
            response(false, 'نوع غير صحيح', null, 400);
        }
    } catch (Exception $e) {
        error_log('خطأ في storage-management.php (GET): ' . $e->getMessage());
        response(false, 'خطأ في تحميل البيانات: ' . $e->getMessage(), null, 500);
    }
}

// حذف الملفات
if ($method === 'DELETE' || ($method === 'POST' && isset($data['_method']) && $data['_method'] === 'DELETE')) {
    try {
        $type = $data['type'] ?? '';
        $deleteAll = isset($data['delete_all']) && $data['delete_all'] === true;
        $filename = $data['file'] ?? '';
        $files = $data['files'] ?? []; // قائمة الملفات للحذف المتعدد
        
        if (empty($type)) {
            response(false, 'نوع الملف مطلوب', null, 400);
        }
        
        if ($deleteAll) {
            // حذف جميع الملفات
            $result = deleteAllStorageFiles($type);
            response(true, 'تم حذف جميع الملفات بنجاح', $result);
        } elseif (!empty($files) && is_array($files) && count($files) > 0) {
            // حذف ملفات متعددة
            $result = deleteMultipleFiles($type, $files);
            response(true, 'تم حذف الملفات المحددة بنجاح', $result);
        } else {
            // حذف ملف واحد
            if (empty($filename)) {
                response(false, 'اسم الملف مطلوب', null, 400);
            }
            
            // التحقق إذا كانت الصورة من قاعدة البيانات
            if ($type === 'images' && strpos($filename, 'db_') === 0) {
                // حذف من قاعدة البيانات
                $deleted = deleteDatabaseImage($filename);
                if ($deleted) {
                    response(true, 'تم حذف الصورة من قاعدة البيانات بنجاح');
                } else {
                    response(false, 'فشل حذف الصورة أو الصورة غير موجودة', null, 404);
                }
            } else {
                // حذف من المجلد
                $deleted = deleteStorageFile($type, $filename);
                if ($deleted) {
                    response(true, 'تم حذف الملف بنجاح');
                } else {
                    response(false, 'فشل حذف الملف أو الملف غير موجود', null, 404);
                }
            }
        }
    } catch (Exception $e) {
        error_log('خطأ في storage-management.php (DELETE): ' . $e->getMessage());
        response(false, 'خطأ في حذف الملف: ' . $e->getMessage(), null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);

/**
 * الحصول على ملفات التخزين
 * @param string $type - 'invoices' أو 'images'
 * @return array
 */
function getStorageFiles($type) {
    $files = [];
    
    if ($type === 'invoices') {
        $dir = INVOICES_DIR;
        $pattern = '*.html';
    } elseif ($type === 'images') {
        $dir = IMAGES_DIR;
        $pattern = '*.jpg';
    } else {
        return $files;
    }
    
    if (!is_dir($dir)) {
        return $files;
    }
    
    $fileList = glob($dir . $pattern);
    
    foreach ($fileList as $filepath) {
        if (is_file($filepath)) {
            $files[] = [
                'filename' => basename($filepath),
                'name' => basename($filepath),
                'size' => filesize($filepath),
                'date' => date('Y-m-d H:i:s', filemtime($filepath))
            ];
        }
    }
    
    // ترتيب حسب التاريخ (الأحدث أولاً)
    usort($files, function($a, $b) {
        return strtotime($b['date']) - strtotime($a['date']);
    });
    
    return $files;
}

/**
 * حذف ملف واحد
 * @param string $type - 'invoices' أو 'images'
 * @param string $filename - اسم الملف
 * @return bool
 */
function deleteStorageFile($type, $filename) {
    if ($type === 'invoices') {
        $dir = INVOICES_DIR;
    } elseif ($type === 'images') {
        $dir = IMAGES_DIR;
    } else {
        return false;
    }
    
    // التأكد من وجود المجلد
    if (!is_dir($dir)) {
        return false;
    }
    
    // التأكد من أن اسم الملف آمن (منع directory traversal)
    $filename = basename($filename);
    $filepath = $dir . $filename;
    
    // التأكد من أن الملف موجود في المجلد المحدد
    $realDir = realpath($dir);
    
    if ($realDir === false) {
        return false;
    }
    
    // التحقق من وجود الملف
    if (!file_exists($filepath) || !is_file($filepath)) {
        return false;
    }
    
    $realFile = realpath($filepath);
    
    if ($realFile === false) {
        return false;
    }
    
    // التأكد من أن الملف داخل المجلد المحدد (منع directory traversal)
    if (strpos($realFile, $realDir) !== 0) {
        error_log("محاولة حذف ملف خارج المجلد المحدد: {$filepath}");
        return false;
    }
    
    // حذف الملف
    $result = @unlink($filepath);
    
    if (!$result) {
        error_log("فشل حذف الملف: {$filepath}");
    }
    
    return $result;
}

/**
 * حذف ملفات متعددة
 * @param string $type - 'invoices' أو 'images'
 * @param array $files - قائمة أسماء الملفات
 * @return array
 */
function deleteMultipleFiles($type, $files) {
    $deletedCount = 0;
    $failedCount = 0;
    $deletedSize = 0;
    $errors = [];
    
    foreach ($files as $file) {
        $filename = is_array($file) ? ($file['filename'] ?? $file['name'] ?? '') : $file;
        
        if (empty($filename)) {
            continue;
        }
        
            // التحقق إذا كانت الصورة من قاعدة البيانات
            if ($type === 'images' && strpos($filename, 'db_') === 0) {
                // حذف من قاعدة البيانات
                $deleted = deleteDatabaseImage($filename);
                if ($deleted) {
                    $deletedCount++;
                } else {
                    $failedCount++;
                    $errors[] = $filename . ' (فشل الحذف من قاعدة البيانات)';
                    error_log('فشل حذف صورة من قاعدة البيانات: ' . $filename);
                }
            } else {
            // حذف من المجلد
            $filepath = ($type === 'invoices' ? INVOICES_DIR : IMAGES_DIR) . basename($filename);
            if (file_exists($filepath)) {
                $fileSize = filesize($filepath);
            } else {
                $fileSize = 0;
            }
            
            $deleted = deleteStorageFile($type, $filename);
            if ($deleted) {
                $deletedCount++;
                $deletedSize += $fileSize;
            } else {
                $failedCount++;
                $errors[] = $filename;
            }
        }
    }
    
    return [
        'deleted_count' => $deletedCount,
        'failed_count' => $failedCount,
        'deleted_size' => $deletedSize,
        'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2),
        'errors' => $errors
    ];
}

/**
 * حذف جميع الملفات
 * @param string $type - 'invoices' أو 'images'
 * @return array
 */
function deleteAllStorageFiles($type) {
    $deletedCount = 0;
    $deletedSize = 0;
    
    if ($type === 'invoices') {
        $dir = INVOICES_DIR;
        $pattern = '*.html';
    } elseif ($type === 'images') {
        $dir = IMAGES_DIR;
        $pattern = '*.jpg';
        
        // حذف الصور من قاعدة البيانات أيضاً (جميع الجداول)
        try {
            $conn = getDBConnection();
            if ($conn) {
                $tables = [
                    ['table' => 'repairs', 'column' => 'device_image'],
                    ['table' => 'spare_parts', 'column' => 'image'],
                    ['table' => 'phones', 'column' => 'image'],
                    ['table' => 'accessories', 'column' => 'image']
                ];
                
                foreach ($tables as $tableInfo) {
                    try {
                        $updateQuery = "UPDATE `{$tableInfo['table']}` SET `{$tableInfo['column']}` = NULL WHERE `{$tableInfo['column']}` IS NOT NULL AND `{$tableInfo['column']}` != ''";
                        $result = $conn->query($updateQuery);
                        if ($result) {
                            $dbDeletedCount = $conn->affected_rows;
                            $deletedCount += $dbDeletedCount;
                        }
                    } catch (Exception $e) {
                        error_log('خطأ في حذف الصور من جدول ' . $tableInfo['table'] . ': ' . $e->getMessage());
                    }
                }
                
                // حذف صور الشات
                try {
                    $updateQuery = "UPDATE chat_messages SET file_path = NULL, message_type = 'text' WHERE message_type = 'image' AND file_path IS NOT NULL AND file_path != ''";
                    $result = $conn->query($updateQuery);
                    if ($result) {
                        $dbDeletedCount = $conn->affected_rows;
                        $deletedCount += $dbDeletedCount;
                    }
                } catch (Exception $e) {
                    // تجاهل إذا كان الجدول غير موجود
                }
            }
        } catch (Exception $e) {
            error_log('خطأ في حذف الصور من قاعدة البيانات: ' . $e->getMessage());
        }
    } else {
        return ['deleted_count' => 0, 'deleted_size' => 0];
    }
    
    if (!is_dir($dir)) {
        return [
            'deleted_count' => $deletedCount,
            'deleted_size' => $deletedSize,
            'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2)
        ];
    }
    
    $files = glob($dir . $pattern);
    
    foreach ($files as $filepath) {
        if (is_file($filepath)) {
            $size = filesize($filepath);
            if (unlink($filepath)) {
                $deletedCount++;
                $deletedSize += $size;
            }
        }
    }
    
    return [
        'deleted_count' => $deletedCount,
        'deleted_size' => $deletedSize,
        'deleted_size_mb' => round($deletedSize / (1024 * 1024), 2)
    ];
}

/**
 * الحصول على الصور المخزنة في قاعدة البيانات من جميع الجداول
 * @return array
 */
function getDatabaseImages() {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return [];
        }
        
        $images = [];
        
        // 1. جلب الصور من جدول repairs
        $query = "SELECT id, repair_number, device_image, created_at, updated_at 
                  FROM repairs 
                  WHERE device_image IS NOT NULL 
                  AND device_image != '' 
                  AND device_image != 'null'
                  ORDER BY created_at DESC";
        
        $result = $conn->query($query);
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $imageSize = calculateImageSize($row['device_image']);
                $images[] = [
                    'filename' => 'db_repairs_' . $row['id'],
                    'name' => 'صورة عملية #' . $row['repair_number'],
                    'table' => 'repairs',
                    'record_id' => $row['id'],
                    'record_number' => $row['repair_number'],
                    'size' => $imageSize,
                    'date' => $row['created_at'] ?: $row['updated_at'],
                    'source' => 'database',
                    'type' => 'repair'
                ];
            }
        }
        
        // 2. جلب الصور من جدول spare_parts
        $query = "SELECT id, brand, model, image, created_at, updated_at 
                  FROM spare_parts 
                  WHERE image IS NOT NULL 
                  AND image != '' 
                  AND image != 'null'
                  ORDER BY created_at DESC";
        
        $result = $conn->query($query);
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $imageSize = calculateImageSize($row['image']);
                $images[] = [
                    'filename' => 'db_spare_parts_' . $row['id'],
                    'name' => 'صورة قطع غيار: ' . $row['brand'] . ' ' . $row['model'],
                    'table' => 'spare_parts',
                    'record_id' => $row['id'],
                    'record_number' => $row['brand'] . ' ' . $row['model'],
                    'size' => $imageSize,
                    'date' => $row['created_at'] ?: $row['updated_at'],
                    'source' => 'database',
                    'type' => 'spare_part'
                ];
            }
        }
        
        // 3. جلب الصور من جدول phones
        $query = "SELECT id, brand, model, image, created_at, updated_at 
                  FROM phones 
                  WHERE image IS NOT NULL 
                  AND image != '' 
                  AND image != 'null'
                  ORDER BY created_at DESC";
        
        $result = $conn->query($query);
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $imageSize = calculateImageSize($row['image']);
                $images[] = [
                    'filename' => 'db_phones_' . $row['id'],
                    'name' => 'صورة هاتف: ' . $row['brand'] . ' ' . $row['model'],
                    'table' => 'phones',
                    'record_id' => $row['id'],
                    'record_number' => $row['brand'] . ' ' . $row['model'],
                    'size' => $imageSize,
                    'date' => $row['created_at'] ?: $row['updated_at'],
                    'source' => 'database',
                    'type' => 'phone'
                ];
            }
        }
        
        // 4. جلب الصور من جدول accessories
        $query = "SELECT id, name, type, image, created_at, updated_at 
                  FROM accessories 
                  WHERE image IS NOT NULL 
                  AND image != '' 
                  AND image != 'null'
                  ORDER BY created_at DESC";
        
        $result = $conn->query($query);
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $imageSize = calculateImageSize($row['image']);
                $images[] = [
                    'filename' => 'db_accessories_' . $row['id'],
                    'name' => 'صورة إكسسوار: ' . $row['name'],
                    'table' => 'accessories',
                    'record_id' => $row['id'],
                    'record_number' => $row['name'],
                    'size' => $imageSize,
                    'date' => $row['created_at'] ?: $row['updated_at'],
                    'source' => 'database',
                    'type' => 'accessory'
                ];
            }
        }
        
        // 5. جلب الصور من جدول chat_messages (إذا كان موجوداً)
        try {
            $query = "SELECT id, room_id, user_id, file_path, created_at 
                      FROM chat_messages 
                      WHERE message_type = 'image' 
                      AND file_path IS NOT NULL 
                      AND file_path != ''
                      ORDER BY created_at DESC";
            
            $result = $conn->query($query);
            if ($result && $result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    // حساب حجم الصورة من الملف
                    $filePath = __DIR__ . '/../' . $row['file_path'];
                    $imageSize = 0;
                    if (file_exists($filePath)) {
                        $imageSize = filesize($filePath);
                    }
                    
                    $images[] = [
                        'filename' => 'db_chat_' . $row['id'],
                        'name' => 'صورة شات (غرفة #' . $row['room_id'] . ')',
                        'table' => 'chat_messages',
                        'record_id' => $row['id'],
                        'record_number' => 'Chat #' . $row['room_id'],
                        'size' => $imageSize,
                        'date' => $row['created_at'],
                        'source' => 'database',
                        'type' => 'chat',
                        'file_path' => $row['file_path']
                    ];
                }
            }
        } catch (Exception $e) {
            // تجاهل إذا كان الجدول غير موجود
            error_log('ملاحظة: جدول chat_messages غير موجود أو به خطأ: ' . $e->getMessage());
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        usort($images, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        return $images;
    } catch (Exception $e) {
        error_log('خطأ في getDatabaseImages: ' . $e->getMessage());
        return [];
    }
}

/**
 * حساب حجم الصورة من base64
 * @param string $imageData
 * @return int
 */
function calculateImageSize($imageData) {
    if (empty($imageData)) {
        return 0;
    }
    
    // إزالة data:image prefix إذا كان موجوداً
    $imageData = preg_replace('/^data:image\/[^;]+;base64,/', '', $imageData);
    $decoded = base64_decode($imageData, true);
    
    if ($decoded !== false) {
        return strlen($decoded);
    }
    
    return 0;
}

/**
 * حذف صورة من قاعدة البيانات
 * @param string $filename - اسم الملف (مثل: db_repairs_123 أو db_spare_parts_456)
 * @return bool
 */
function deleteDatabaseImage($filename) {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return false;
        }
        
        // تحليل اسم الملف لتحديد الجدول والسجل
        // db_repairs_123 -> table: repairs, id: 123
        // db_spare_parts_456 -> table: spare_parts, id: 456
        // db_phones_789 -> table: phones, id: 789
        // db_accessories_101 -> table: accessories, id: 101
        // db_chat_202 -> table: chat_messages, id: 202
        
        // إزالة البادئة "db_"
        $filenameWithoutPrefix = str_replace('db_', '', $filename);
        $parts = explode('_', $filenameWithoutPrefix);
        
        if (count($parts) < 2) {
            error_log('خطأ في تحليل اسم الملف: ' . $filename . ' -> ' . $filenameWithoutPrefix);
            return false;
        }
        
        // تحديد الجدول بناءً على البادئة
        // db_repairs_123 -> repairs, 123
        // db_spare_parts_456 -> spare_parts, 456
        // db_phones_789 -> phones, 789
        // db_accessories_101 -> accessories, 101
        // db_chat_202 -> chat_messages, 202
        
        if ($parts[0] === 'repairs') {
            $table = 'repairs';
            $recordId = $parts[1] ?? '';
        } elseif ($parts[0] === 'spare' && isset($parts[1]) && $parts[1] === 'parts') {
            $table = 'spare_parts';
            $recordId = $parts[2] ?? '';
        } elseif ($parts[0] === 'phones') {
            $table = 'phones';
            $recordId = $parts[1] ?? '';
        } elseif ($parts[0] === 'accessories') {
            $table = 'accessories';
            $recordId = $parts[1] ?? '';
        } elseif ($parts[0] === 'chat') {
            $table = 'chat_messages';
            $recordId = $parts[1] ?? '';
        } else {
            error_log('جدول غير معروف في اسم الملف: ' . $filename . ' -> الجزء الأول: ' . ($parts[0] ?? 'غير موجود'));
            return false;
        }
        
        if (empty($table) || empty($recordId)) {
            error_log('جدول أو معرف فارغ - table: ' . $table . ', id: ' . $recordId . ', filename: ' . $filename);
            return false;
        }
        
        error_log('محاولة حذف صورة - table: ' . $table . ', id: ' . $recordId);
        
        // تحديد اسم عمود الصورة حسب الجدول
        $imageColumn = 'image';
        if ($table === 'repairs') {
            $imageColumn = 'device_image';
        } elseif ($table === 'spare_parts' || $table === 'phones' || $table === 'accessories') {
            $imageColumn = 'image';
        } elseif ($table === 'chat_messages') {
            // للشات، نحذف file_path
            $imageColumn = 'file_path';
        } else {
            return false;
        }
        
        // للشات، نحتاج لجلب file_path قبل الحذف
        $filePathToDelete = null;
        if ($table === 'chat_messages') {
            $checkQuery = "SELECT id, file_path FROM `{$table}` WHERE id = ?";
            $stmt = $conn->prepare($checkQuery);
            if (!$stmt) {
                error_log('خطأ في إعداد استعلام التحقق: ' . $conn->error);
                return false;
            }
            $stmt->bind_param('s', $recordId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if (!$result || $result->num_rows === 0) {
                error_log('السجل غير موجود في جدول ' . $table . ' برقم ' . $recordId);
                return false;
            }
            
            $row = $result->fetch_assoc();
            if (isset($row['file_path']) && !empty($row['file_path'])) {
                $filePathToDelete = $row['file_path'];
            }
        } else {
            // التحقق من وجود السجل للجداول الأخرى
            $checkQuery = "SELECT id FROM `{$table}` WHERE id = ?";
            $stmt = $conn->prepare($checkQuery);
            if (!$stmt) {
                error_log('خطأ في إعداد استعلام التحقق: ' . $conn->error);
                return false;
            }
            $stmt->bind_param('s', $recordId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if (!$result || $result->num_rows === 0) {
                error_log('السجل غير موجود في جدول ' . $table . ' برقم ' . $recordId);
                return false;
            }
        }
        
        // حذف الصورة من قاعدة البيانات
        if ($table === 'chat_messages') {
            // للشات، نحذف file_path ونغير message_type
            $updateQuery = "UPDATE `{$table}` SET file_path = NULL, message_type = 'text' WHERE id = ?";
        } else {
            $updateQuery = "UPDATE `{$table}` SET `{$imageColumn}` = NULL WHERE id = ?";
        }
        
        $stmt = $conn->prepare($updateQuery);
        if (!$stmt) {
            error_log('خطأ في إعداد استعلام التحديث: ' . $conn->error);
            return false;
        }
        
        $stmt->bind_param('s', $recordId);
        
        if ($stmt->execute()) {
            // إذا كانت صورة الشات، نحاول حذف الملف أيضاً
            if ($table === 'chat_messages' && $filePathToDelete) {
                try {
                    $fullPath = __DIR__ . '/../' . $filePathToDelete;
                    if (file_exists($fullPath)) {
                        if (@unlink($fullPath)) {
                            error_log('تم حذف ملف الشات: ' . $fullPath);
                        } else {
                            error_log('فشل حذف ملف الشات: ' . $fullPath);
                        }
                    }
                } catch (Exception $e) {
                    error_log('خطأ في حذف ملف الشات: ' . $e->getMessage());
                }
            }
            return true;
        } else {
            error_log('فشل تنفيذ استعلام التحديث: ' . $stmt->error);
        }
        
        return false;
    } catch (Exception $e) {
        error_log('خطأ في deleteDatabaseImage: ' . $e->getMessage());
        return false;
    }
}

/**
 * الحصول على معلومات قاعدة البيانات
 * @return array
 */
function getDatabaseInfo() {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            return [
                'size' => 0,
                'tables_count' => 0,
                'records_count' => 0,
                'data_size' => 0,
                'index_size' => 0
            ];
        }
        
        $dbname = DB_NAME;
        
        // حجم قاعدة البيانات - طريقة محسّنة
        // حساب حجم البيانات والفهارس بشكل منفصل
        $sizeQuery = "SELECT 
            COALESCE(SUM(data_length), 0) AS data_size_bytes,
            COALESCE(SUM(index_length), 0) AS index_size_bytes,
            COALESCE(SUM(data_length + index_length), 0) AS total_size_bytes,
            COUNT(*) as tables_count
            FROM information_schema.tables 
            WHERE table_schema = ?
            AND engine IS NOT NULL";
        
        $stmt = $conn->prepare($sizeQuery);
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $result = $stmt->get_result();
        $sizeRow = $result->fetch_assoc();
        
        $dataSize = $sizeRow['data_size_bytes'] ?? 0;
        $indexSize = $sizeRow['index_size_bytes'] ?? 0;
        $totalSize = $sizeRow['total_size_bytes'] ?? 0;
        $tablesCount = $sizeRow['tables_count'] ?? 0;
        
        // إذا لم نحصل على نتائج، نجرب طريقة بديلة
        if ($totalSize == 0) {
            // طريقة بديلة: استخدام SHOW TABLE STATUS
            $tablesQuery = "SHOW TABLE STATUS FROM `{$dbname}`";
            $result = $conn->query($tablesQuery);
            
            if ($result) {
                $dataSize = 0;
                $indexSize = 0;
                $tablesCount = 0;
                
                while ($row = $result->fetch_assoc()) {
                    $tablesCount++;
                    $dataSize += $row['Data_length'] ?? 0;
                    $indexSize += $row['Index_length'] ?? 0;
                }
                
                $totalSize = $dataSize + $indexSize;
            }
        }
        
        // عدد السجلات (من جميع الجداول)
        $recordsCount = 0;
        $tablesListQuery = "SELECT table_name 
                           FROM information_schema.tables 
                           WHERE table_schema = ? 
                           AND table_type = 'BASE TABLE'";
        $stmt = $conn->prepare($tablesListQuery);
        $stmt->bind_param('s', $dbname);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $tables = [];
        while ($row = $result->fetch_assoc()) {
            $tables[] = $row['table_name'];
        }
        
        // حساب عدد السجلات من جميع الجداول
        foreach ($tables as $table) {
            try {
                // استخدام prepared statement لتجنب SQL injection
                $tableEscaped = $conn->real_escape_string($table);
                $countQuery = "SELECT COUNT(*) as count FROM `{$tableEscaped}`";
                $countResult = $conn->query($countQuery);
                if ($countResult) {
                    $countRow = $countResult->fetch_assoc();
                    $recordsCount += $countRow['count'] ?? 0;
                }
            } catch (Exception $e) {
                // تجاهل الأخطاء في الجداول غير الموجودة
                error_log('خطأ في حساب السجلات للجدول ' . $table . ': ' . $e->getMessage());
            }
        }
        
        return [
            'size' => $totalSize, // الحجم الكلي بالبايت
            'data_size' => $dataSize, // حجم البيانات بالبايت
            'index_size' => $indexSize, // حجم الفهارس بالبايت
            'tables_count' => $tablesCount,
            'records_count' => $recordsCount
        ];
    } catch (Exception $e) {
        error_log('خطأ في getDatabaseInfo: ' . $e->getMessage());
        return [
            'size' => 0,
            'data_size' => 0,
            'index_size' => 0,
            'tables_count' => 0,
            'records_count' => 0
        ];
    }
}
?>


<?php
/**
 * Service Worker as PHP file
 * This ensures correct MIME type is set
 * IMPORTANT: This file MUST be served by PHP, not as static file
 */

// ✅ CRITICAL: Disable error display but enable logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// ✅ CRITICAL: Clear ALL output buffers FIRST
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ✅ CRITICAL: Remove any existing headers that might interfere
@header_remove('Content-Type');
@header_remove('Content-Length');
@header_remove('X-Powered-By');

// ✅ CRITICAL: Disable compression for Service Worker
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);

// Read sw.js content
$swPath = __DIR__ . '/sw.js';

// ✅ CRITICAL: Check file with better error handling
try {
    if (!file_exists($swPath)) {
        throw new Exception('File not found: ' . $swPath);
    }
    
    if (!is_file($swPath)) {
        throw new Exception('Path is not a file: ' . $swPath);
    }
    
    if (!is_readable($swPath)) {
        throw new Exception('File is not readable: ' . $swPath);
    }
    
    $fileSize = filesize($swPath);
    if ($fileSize === false) {
        throw new Exception('Cannot get file size: ' . $swPath);
    }
    
    // ✅ CRITICAL: Set correct headers BEFORE any output
    @header('Content-Type: application/javascript; charset=utf-8', true);
    @header('Content-Length: ' . $fileSize, true);
    @header('Cache-Control: no-cache, no-store, must-revalidate', true);
    @header('Pragma: no-cache', true);
    @header('Expires: 0', true);
    @header('Service-Worker-Allowed: /', true);
    @header('X-Content-Type-Options: nosniff', true);
    
    // ✅ CRITICAL: Serve the file directly using readfile
    $result = @readfile($swPath);
    
    if ($result === false) {
        throw new Exception('Failed to read file: ' . $swPath);
    }
    
    exit; // ✅ Use exit to prevent any further processing
    
} catch (Exception $e) {
    // Log error
    error_log('sw.js.php Error: ' . $e->getMessage());
    
    // Clear any output
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Return error response
    http_response_code(500);
    @header('Content-Type: application/json; charset=utf-8', true);
    echo json_encode([
        'error' => 'Service Worker file error',
        'message' => $e->getMessage(),
        'path' => $swPath,
        'exists' => file_exists($swPath),
        'is_file' => is_file($swPath),
        'readable' => is_readable($swPath)
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Error $e) {
    // Log fatal error
    error_log('sw.js.php Fatal Error: ' . $e->getMessage());
    
    // Clear any output
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Return error response
    http_response_code(500);
    @header('Content-Type: application/json; charset=utf-8', true);
    echo json_encode([
        'error' => 'Service Worker fatal error',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>


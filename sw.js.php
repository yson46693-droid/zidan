<?php
/**
 * Service Worker as PHP file
 * This ensures correct MIME type is set
 * IMPORTANT: This file MUST be served by PHP, not as static file
 */

// ✅ CRITICAL: Clear ALL output buffers FIRST
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ✅ CRITICAL: Remove any existing headers that might interfere
header_remove('Content-Type');
header_remove('Content-Length');
header_remove('X-Powered-By');

// ✅ CRITICAL: Disable compression for Service Worker
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);

// Read sw.js content
$swPath = __DIR__ . '/sw.js';

if (file_exists($swPath) && is_file($swPath) && is_readable($swPath)) {
    // ✅ CRITICAL: Set correct headers BEFORE any output
    header('Content-Type: application/javascript; charset=utf-8', true);
    header('Content-Length: ' . filesize($swPath), true);
    header('Cache-Control: no-cache, no-store, must-revalidate', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
    header('Service-Worker-Allowed: /', true);
    header('X-Content-Type-Options: nosniff', true);
    
    // ✅ CRITICAL: Serve the file directly using readfile (more efficient)
    readfile($swPath);
    exit; // ✅ Use exit to prevent any further processing
}

// If we reach here, there was an error
http_response_code(404);
header('Content-Type: application/json; charset=utf-8', true);
echo json_encode([
    'error' => 'Service Worker file not found',
    'path' => $swPath,
    'exists' => file_exists($swPath),
    'is_file' => is_file($swPath),
    'readable' => is_readable($swPath)
], JSON_UNESCAPED_UNICODE);
exit;
?>


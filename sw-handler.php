<?php
/**
 * Service Worker Handler
 * This file ensures sw.js is served with correct MIME type
 * Use this if router.php doesn't work properly
 */

// ✅ CRITICAL: Clear any output buffers FIRST
while (ob_get_level() > 0) {
    ob_end_clean();
}

// ✅ CRITICAL: Remove any existing headers
header_remove('Content-Type');
header_remove('Content-Length');

$swPath = __DIR__ . '/sw.js';

if (file_exists($swPath) && is_file($swPath)) {
    // ✅ CRITICAL: Set correct headers for Service Worker BEFORE any output
    header('Content-Type: application/javascript; charset=utf-8', true);
    header('Content-Length: ' . filesize($swPath), true);
    header('Cache-Control: no-cache, no-store, must-revalidate', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
    header('Service-Worker-Allowed: /', true);
    
    // ✅ CRITICAL: Disable output buffering
    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', 1);
    }
    
    // Serve the file directly
    readfile($swPath);
    exit; // ✅ Use exit to prevent any further processing
} else {
    // If sw.js doesn't exist, return 404 with JSON (not HTML)
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8', true);
    echo json_encode([
        'error' => 'Service Worker file not found',
        'path' => $swPath
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>


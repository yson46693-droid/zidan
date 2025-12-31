<?php
/**
 * Router script for PHP built-in server
 * This ensures static files (JS, CSS, images) are served correctly
 * 
 * IMPORTANT: PHP built-in server calls this router for ALL requests,
 * but if a file exists, it may serve it directly. We need to intercept
 * sw.js requests BEFORE PHP serves them.
 */

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Remove query string for file checking
$filePath = __DIR__ . $requestPath;

// ✅ DEBUG: Log sw.js requests (remove in production)
if (preg_match('/sw\.js$/', $requestPath) || preg_match('/sw-handler\.php$/', $requestPath)) {
    error_log("Router: Processing Service Worker request: " . $requestPath);
}

// ✅ CRITICAL: Special handling for Service Worker (sw.js) - MUST be served with correct MIME type
// Handle both root and subdirectory paths (e.g., /sw.js or /zidan15/sw.js)
// This MUST be checked FIRST before any other file handling
if (preg_match('/\/sw\.js$/', $requestPath) || basename($requestPath) === 'sw.js') {
    // Try root directory first (most common case)
    $swPath = __DIR__ . '/sw.js';
    
    // If not in root, try the requested path
    if (!file_exists($swPath) && file_exists($filePath)) {
        $swPath = $filePath;
    }
    
    if (file_exists($swPath) && is_file($swPath)) {
        // Clear any output buffers completely
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        
        // ✅ CRITICAL: Set correct headers for Service Worker BEFORE any output
        // Remove any existing headers that might interfere
        header_remove('Content-Type');
        header_remove('Content-Length');
        
        // Set correct headers for Service Worker
        header('Content-Type: application/javascript; charset=utf-8', true);
        header('Content-Length: ' . filesize($swPath), true);
        header('Cache-Control: no-cache, no-store, must-revalidate', true);
        header('Pragma: no-cache', true);
        header('Expires: 0', true);
        header('Service-Worker-Allowed: /', true);
        
        // Prevent any output buffering
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', 1);
        }
        
        // Serve the file directly
        readfile($swPath);
        exit; // ✅ Use exit instead of return to ensure no further processing
    } else {
        // If sw.js doesn't exist, return 404 with JSON (not HTML)
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8', true);
        echo json_encode([
            'error' => 'Service Worker file not found',
            'path' => $requestPath,
            'attempted_path' => $swPath
        ], JSON_UNESCAPED_UNICODE);
        exit; // ✅ Use exit instead of return
    }
}

// ✅ Special handling for manifest.json
// Handle both root and subdirectory paths
if (preg_match('/\/manifest\.json$/', $requestPath) || basename($requestPath) === 'manifest.json') {
    // Try root directory first
    $manifestPath = __DIR__ . '/manifest.json';
    
    // If not in root, try the requested path
    if (!file_exists($manifestPath) && file_exists($filePath)) {
        $manifestPath = $filePath;
    }
    
    if (file_exists($manifestPath) && is_file($manifestPath)) {
        // Clear any output buffers
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        
        // Set correct headers for manifest
        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Content-Length: ' . filesize($manifestPath));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Serve the file
        readfile($manifestPath);
        return true;
    }
}

// ✅ CRITICAL: Check for PHP files FIRST - before serving any files as text
// For PHP files, let PHP handle them (must be before file serving logic)
if (preg_match('/\.php$/', $requestPath) && file_exists($filePath) && is_file($filePath)) {
    return false; // Let PHP handle it
}

// If the request is for a file that exists, serve it directly
// ✅ IMPORTANT: Skip sw.js and PHP files here (already handled above)
if ($requestPath !== '/' && 
    !preg_match('/\/sw\.js$/', $requestPath) && 
    basename($requestPath) !== 'sw.js' &&
    !preg_match('/\.php$/', $requestPath) && // ✅ Skip PHP files
    file_exists($filePath) && is_file($filePath)) {
    // Set correct MIME types
    $extension = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'js' => 'application/javascript',
        'css' => 'text/css',
        'html' => 'text/html',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'application/vnd.ms-fontobject'
    ];
    
    // ✅ دالة بديلة لـ mime_content_type() تعمل على Windows
    $mimeType = $mimeTypes[$extension] ?? 'application/octet-stream';
    
    // ✅ محاولة استخدام mime_content_type() إذا كانت متوفرة (Linux/Unix)
    if (!isset($mimeTypes[$extension]) && function_exists('mime_content_type')) {
        $detectedMime = @mime_content_type($filePath);
        if ($detectedMime !== false) {
            $mimeType = $detectedMime;
        }
    }
    
    // Clear any output buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Set headers
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($filePath));
    
    // Serve the file
    readfile($filePath);
    return true;
}

// For directory requests, try index.html or index.php
if (is_dir($filePath)) {
    $indexFiles = ['index.html', 'index.php'];
    foreach ($indexFiles as $indexFile) {
        $indexPath = $filePath . '/' . $indexFile;
        if (file_exists($indexPath)) {
            $_SERVER['SCRIPT_NAME'] = $requestPath . '/' . $indexFile;
            $_SERVER['PHP_SELF'] = $requestPath . '/' . $indexFile;
            include $indexPath;
            return true;
        }
    }
}

// If file doesn't exist, return 404 (but NOT for sw.js or manifest.json - already handled above)
if ($requestPath !== '/' && !file_exists($filePath) && 
    !preg_match('/\/sw\.js$/', $requestPath) && 
    !preg_match('/\/manifest\.json$/', $requestPath)) {
    // Clear any output buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'File not found',
        'path' => $requestPath
    ], JSON_UNESCAPED_UNICODE);
    return true;
}

// Default: let PHP handle it
return false;
?>


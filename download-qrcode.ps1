# Script to download QRCode library locally
# Run this script to download the QRCode library for offline use

$ErrorActionPreference = 'Stop'

Write-Host "Downloading QRCode library..."

$urls = @(
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@latest/build/qrcode.min.js'
)

$success = $false
foreach ($url in $urls) {
    try {
        Write-Host "Trying: $url"
        Invoke-WebRequest -Uri $url -OutFile 'js\qrcode.min.js' -TimeoutSec 30
        Write-Host "✅ Successfully downloaded QRCode library to js\qrcode.min.js"
        $success = $true
        break
    } catch {
        Write-Host "❌ Failed: $_"
    }
}

if (-not $success) {
    Write-Host "⚠️ Could not download QRCode library. The application will use API fallback method."
    Write-Host "You can manually download it from: https://github.com/davidshimjs/qrcodejs"
}








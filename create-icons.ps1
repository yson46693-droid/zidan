# Script to create PWA icons from logo PNG
# Uses .NET System.Drawing for image processing

$logoPath = "vertopal.com_photo_5922357566287580087_y.png"
$iconsDir = "icons\"
$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)

# Check if logo exists
if (-not (Test-Path $logoPath)) {
    Write-Host "Logo not found: $logoPath" -ForegroundColor Red
    exit 1
}

# Create icons directory if it doesn't exist
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
    Write-Host "Created icons directory: $iconsDir" -ForegroundColor Green
}

# Load System.Drawing
Add-Type -AssemblyName System.Drawing

try {
    # Load original image
    $originalImage = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath).Path)
    $originalWidth = $originalImage.Width
    $originalHeight = $originalImage.Height
    
    Write-Host "Loaded logo: ${originalWidth}x${originalHeight}" -ForegroundColor Cyan
    Write-Host "Starting icon creation..." -ForegroundColor Yellow
    
    $created = 0
    $errors = 0
    
    foreach ($size in $sizes) {
        try {
            # Calculate ratio to maintain aspect ratio
            $ratio = [Math]::Min($size / $originalWidth, $size / $originalHeight)
            $newWidth = [int]($originalWidth * $ratio)
            $newHeight = [int]($originalHeight * $ratio)
            
            # Calculate position for centering
            $x = [int](($size - $newWidth) / 2)
            $y = [int](($size - $newHeight) / 2)
            
            # Create new image with required size
            $newImage = New-Object System.Drawing.Bitmap($size, $size)
            $graphics = [System.Drawing.Graphics]::FromImage($newImage)
            
            # Set high quality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            
            # White background
            $graphics.Clear([System.Drawing.Color]::White)
            
            # Draw image centered
            $graphics.DrawImage($originalImage, $x, $y, $newWidth, $newHeight)
            
            # Save icon
            $outputPath = Join-Path $iconsDir "icon-${size}x${size}.png"
            $newImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            
            # Clean up memory
            $graphics.Dispose()
            $newImage.Dispose()
            
            Write-Host "Created: icon-${size}x${size}.png" -ForegroundColor Green
            $created++
        }
        catch {
            Write-Host "Failed to create icon-${size}x${size}.png: $_" -ForegroundColor Red
            $errors++
        }
    }
    
    # Clean up memory
    $originalImage.Dispose()
    
    Write-Host "`nResults:" -ForegroundColor Cyan
    Write-Host "   Created: $created icons" -ForegroundColor Green
    if ($errors -gt 0) {
        Write-Host "   Failed: $errors icons" -ForegroundColor Red
    }
    Write-Host "`nDone!" -ForegroundColor Green
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

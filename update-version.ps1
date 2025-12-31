# سكريبت تحديث الإصدار تلقائياً
# Auto Version Update Script

$versionFile = "version.json"
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# قراءة الإصدار الحالي
if (Test-Path $versionFile) {
    $versionData = Get-Content $versionFile | ConvertFrom-Json
    $currentVersion = $versionData.version
    $build = $versionData.build + 1
    
    # تقسيم الإصدار إلى أجزاء
    $parts = $currentVersion.Split('.')
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]
    
    # زيادة رقم البناء (patch)
    $patch = $patch + 1
    
    # إذا وصل patch إلى 10، ارفع minor
    if ($patch -ge 10) {
        $patch = 0
        $minor = $minor + 1
    }
    
    # إذا وصل minor إلى 10، ارفع major
    if ($minor -ge 10) {
        $minor = 0
        $major = $major + 1
    }
    
    $newVersion = "$major.$minor.$patch"
} else {
    # إنشاء إصدار جديد
    $newVersion = "1.0.0"
    $build = 1
}

# حفظ الإصدار الجديد
$versionData = @{
    version = $newVersion
    build = $build
    last_updated = $timestamp
} | ConvertTo-Json

Set-Content -Path $versionFile -Value $versionData

Write-Host "✅ تم تحديث الإصدار إلى: $newVersion (Build: $build)" -ForegroundColor Green

# تحديث manifest.json
$manifestPath = "manifest.json"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $manifest.version = $newVersion
    $manifest.version_name = $newVersion
    
    # تحديث query parameters في الأيقونات
    foreach ($icon in $manifest.icons) {
        if ($icon.src -match '\?v=([\d.]+)') {
            $icon.src = $icon.src -replace '\?v=[\d.]+', "?v=$newVersion"
        } else {
            $icon.src = $icon.src + "?v=$newVersion"
        }
    }
    
    # تحديث shortcuts
    foreach ($shortcut in $manifest.shortcuts) {
        foreach ($icon in $shortcut.icons) {
            if ($icon.src -match '\?v=([\d.]+)') {
                $icon.src = $icon.src -replace '\?v=[\d.]+', "?v=$newVersion"
            } else {
                $icon.src = $icon.src + "?v=$newVersion"
            }
        }
    }
    
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath
    Write-Host "✅ تم تحديث manifest.json" -ForegroundColor Green
}

# تحديث js/version.js
$versionJsPath = "js/version.js"
if (Test-Path $versionJsPath) {
    $content = Get-Content $versionJsPath -Raw
    $content = $content -replace "var APP_VERSION = window\.APP_VERSION \|\| '[\d.]+\.' \+ Date\.now\(\);", "var APP_VERSION = window.APP_VERSION || '$newVersion.' + Date.now();"
    Set-Content -Path $versionJsPath -Value $content
    Write-Host "✅ تم تحديث js/version.js" -ForegroundColor Green
}

# تحديث sw.js
$swJsPath = "sw.js"
if (Test-Path $swJsPath) {
    $content = Get-Content $swJsPath -Raw
    $content = $content -replace "const APP_VERSION = '[\d.]+';", "const APP_VERSION = '$newVersion';"
    Set-Content -Path $swJsPath -Value $content
    Write-Host "✅ تم تحديث sw.js" -ForegroundColor Green
}

# تحديث ملفات HTML (index.html, dashboard.html, etc.)
$htmlFiles = @("index.html", "dashboard.html", "pos.html", "chat.html", "install.html")
foreach ($htmlFile in $htmlFiles) {
    if (Test-Path $htmlFile) {
        $content = Get-Content $htmlFile -Raw
        $content = $content -replace '\?v=[\d.]+', "?v=$newVersion"
        Set-Content -Path $htmlFile -Value $content
        Write-Host "✅ تم تحديث $htmlFile" -ForegroundColor Green
    }
}

Write-Host "`n🎉 تم تحديث جميع الملفات بنجاح!" -ForegroundColor Cyan


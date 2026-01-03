# Script for Git Push
# UTF-8 encoding

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Change to script directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "Adding files..." -ForegroundColor Yellow

# Add all files
git add -A

# Check for changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit" -ForegroundColor Cyan
    exit 0
}

# Create commit
$msg = "Update - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Host "Creating commit..." -ForegroundColor Yellow
git commit -m $msg

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error creating commit" -ForegroundColor Red
    exit 1
}

# Fetch latest changes from remote
Write-Host "Fetching latest changes from remote..." -ForegroundColor Yellow
$fetchOutput = git fetch origin main 2>&1

if ($LASTEXITCODE -ne 0) {
    $fetchError = $fetchOutput -join "`n"
    if ($fetchError -match "Recv failure|Connection was reset|Connection timed out") {
        Write-Host "Warning: Network error during fetch. This may affect push." -ForegroundColor Yellow
    } else {
        Write-Host "Warning: Could not fetch from remote. Continuing with push..." -ForegroundColor Yellow
    }
}

# Check if local branch is behind remote
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main 2>$null

if ($LASTEXITCODE -eq 0 -and $localCommit -ne $remoteCommit) {
    Write-Host "Remote has new changes. Pulling changes..." -ForegroundColor Yellow
    git pull origin main --no-rebase
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error during pull. You may need to resolve conflicts manually." -ForegroundColor Red
        Write-Host "Run 'git pull origin main' manually to resolve conflicts." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Pull completed successfully!" -ForegroundColor Green
}

# Function to check network connectivity
function Test-NetworkConnection {
    try {
        $result = Test-NetConnection -ComputerName github.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
        return $result
    } catch {
        return $false
    }
}

# Function to check git remote URL
function Get-GitRemoteUrl {
    try {
        $remoteUrl = git remote get-url origin 2>$null
        return $remoteUrl
    } catch {
        return $null
    }
}

# Check network connectivity before push
Write-Host "Checking network connectivity..." -ForegroundColor Yellow
$networkOk = Test-NetworkConnection
if (-not $networkOk) {
    Write-Host "Warning: Cannot reach github.com. Network may be down or blocked." -ForegroundColor Yellow
    Write-Host "Attempting push anyway..." -ForegroundColor Yellow
}

# Check remote URL
$remoteUrl = Get-GitRemoteUrl
if ($remoteUrl) {
    Write-Host "Remote URL: $remoteUrl" -ForegroundColor Cyan
}

# Push to GitHub with retry logic
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
$maxRetries = 3
$retryCount = 0
$pushSuccess = $false

while ($retryCount -lt $maxRetries -and -not $pushSuccess) {
    if ($retryCount -gt 0) {
        $waitTime = [math]::Min($retryCount * 2, 10)
        Write-Host "Retry attempt $retryCount of $maxRetries (waiting ${waitTime}s)..." -ForegroundColor Yellow
        Start-Sleep -Seconds $waitTime
    }
    
    # Attempt push with increased buffer size for large files
    $env:GIT_HTTP_BUFFER = "524288000"  # 500MB buffer
    git config --global http.postBuffer 524288000
    git config --global http.lowSpeedLimit 0
    git config --global http.lowSpeedTime 999999
    
    # Capture both stdout and stderr
    $pushOutput = git push origin main 2>&1
    $pushExitCode = $LASTEXITCODE
    
    if ($pushExitCode -eq 0) {
        Write-Host "Push completed successfully!" -ForegroundColor Green
        $pushSuccess = $true
    } else {
        $retryCount++
        $errorMessage = $pushOutput -join "`n"
        
        # Analyze error type
        if ($errorMessage -match "Recv failure|Connection was reset|Connection timed out|Failed to connect") {
            Write-Host "Connection error detected: $($errorMessage.Split("`n")[0])" -ForegroundColor Red
            if ($retryCount -lt $maxRetries) {
                Write-Host "This appears to be a network issue. Will retry..." -ForegroundColor Yellow
                continue
            }
        } elseif ($errorMessage -match "authentication|unauthorized|403|401") {
            Write-Host "Authentication error detected!" -ForegroundColor Red
            Write-Host "You may need to:" -ForegroundColor Yellow
            Write-Host "  - Update your GitHub credentials" -ForegroundColor Yellow
            Write-Host "  - Use a Personal Access Token (PAT)" -ForegroundColor Yellow
            Write-Host "  - Check if your token has expired" -ForegroundColor Yellow
            break
        } elseif ($errorMessage -match "rejected|non-fast-forward|conflict") {
            Write-Host "Push rejected! Remote has changes you don't have locally." -ForegroundColor Red
            Write-Host "Run 'git pull origin main' first, then try again." -ForegroundColor Yellow
            break
        } else {
            Write-Host "Push failed with error:" -ForegroundColor Red
            Write-Host $errorMessage -ForegroundColor Red
        }
    }
}

if (-not $pushSuccess) {
    Write-Host "`nPush failed after $maxRetries attempts" -ForegroundColor Red
    Write-Host "`nTroubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check internet connection: Test-NetConnection github.com -Port 443" -ForegroundColor Cyan
    Write-Host "2. Verify authentication:" -ForegroundColor Cyan
    Write-Host "   - Check: git config --global user.name" -ForegroundColor Gray
    Write-Host "   - Check: git config --global user.email" -ForegroundColor Gray
    Write-Host "   - For HTTPS: Update credentials in Windows Credential Manager" -ForegroundColor Gray
    Write-Host "   - For SSH: Check SSH key: ssh -T git@github.com" -ForegroundColor Gray
    Write-Host "3. Check remote URL: git remote -v" -ForegroundColor Cyan
    Write-Host "4. Try manual push: git push origin main" -ForegroundColor Cyan
    Write-Host "5. If using proxy/VPN, check if it's blocking GitHub" -ForegroundColor Cyan
    Write-Host "6. Check GitHub status: https://www.githubstatus.com" -ForegroundColor Cyan
    
    # Show current git config
    Write-Host "`nCurrent Git Configuration:" -ForegroundColor Yellow
    Write-Host "Remote URL: $remoteUrl" -ForegroundColor Gray
    $gitUser = git config --global user.name 2>$null
    $gitEmail = git config --global user.email 2>$null
    if ($gitUser) { Write-Host "User: $gitUser" -ForegroundColor Gray }
    if ($gitEmail) { Write-Host "Email: $gitEmail" -ForegroundColor Gray }
    
    exit 1
}
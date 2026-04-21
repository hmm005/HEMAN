#Requires -Version 5.1
# Windows PowerShell setup script for deal-dashboard.
# Run from any directory: .\scripts\setup.ps1
$ErrorActionPreference = 'Stop'

function Write-Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

Write-Host "`n*** deal-dashboard Windows Setup ***" -ForegroundColor Cyan

# --- 1. Move to project root ---
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
Write-Host "Project: $projectRoot"

# --- 2. Node version check ---
Write-Section 'Checking Node.js'
try { $nodeRaw = (node --version) } catch {
  Write-Err "Node.js is not installed. Get it at https://nodejs.org/ (LTS recommended)."
  exit 1
}
$nodeMajor = [int]($nodeRaw.TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) {
  Write-Err "Node $nodeRaw is too old. Need >=18. Install LTS from https://nodejs.org/"
  exit 1
}
Write-Ok "Node $nodeRaw"

# --- 3. npm install ---
Write-Section 'Installing dependencies'
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Err "npm install failed. Scroll up for details."
  exit 1
}
Write-Ok 'Dependencies installed'

# --- 4. Prep data/logs dir for pm2 ---
New-Item -ItemType Directory -Force -Path "$projectRoot\data\logs"   | Out-Null
New-Item -ItemType Directory -Force -Path "$projectRoot\data\imports" | Out-Null

# --- 5. .env file ---
Write-Section '.env configuration'
$envPath = Join-Path $projectRoot '.env'
$writeEnv = $true
if (Test-Path $envPath) {
  $choice = Read-Host ".env exists. Overwrite? (y/N)"
  if ($choice -notmatch '^(y|Y)') {
    Write-Warn "Keeping existing .env (skipping email setup)"
    $writeEnv = $false
  }
}

if ($writeEnv) {
  $emailUser = Read-Host "  Email address (e.g. mauricemcc@zohomail.com)"
  if (-not $emailUser) { Write-Err 'Email address is required'; exit 1 }

  $emailHost = Read-Host "  SMTP host [smtp.zoho.com]"
  if (-not $emailHost) { $emailHost = 'smtp.zoho.com' }

  $emailPortStr = Read-Host "  SMTP port [587]"
  if (-not $emailPortStr) { $emailPortStr = '587' }

  # Secure prompt — does NOT echo, does NOT go into command history,
  # and does NOT interpolate $ or other special characters.
  $securePass = Read-Host "  Email password (hidden)" -AsSecureString
  $bstr       = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
  $emailPass  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

  $today  = (Get-Date).ToString('yyyy-MM-dd')
  $warmup = Read-Host "  Warmup start date (YYYY-MM-DD) [$today]"
  if (-not $warmup) { $warmup = $today }

  $envContent = @(
    'PORT=3000',
    'OUTREACH_ENABLED=false',
    "EMAIL_HOST=$emailHost",
    "EMAIL_PORT=$emailPortStr",
    "EMAIL_USER=$emailUser",
    "EMAIL_PASS=$emailPass",
    "EMAIL_FROM=$emailUser",
    "WARMUP_START_DATE=$warmup",
    'SCAN_INTERVAL_MINUTES=30',
    'MAX_ALERTS_PER_SCAN=5'
  )
  # Set-Content with ASCII encoding preserves $ literally — no shell interpolation.
  Set-Content -Path $envPath -Value $envContent -Encoding ASCII
  Write-Ok ".env written"
}

# --- 6. SMTP verification ---
Write-Section 'Testing SMTP login'
$smtpScript = @'
require('dotenv').config();
const n = require('nodemailer');
n.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: parseInt(process.env.EMAIL_PORT) === 465,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
}).verify()
  .then(() => { console.log('SMTP_OK'); process.exit(0); })
  .catch(e => { console.error('SMTP_FAIL', e.message); process.exit(1); });
'@
$smtpResult = $smtpScript | node 2>&1
if ($smtpResult -match 'SMTP_OK') {
  Write-Ok 'SMTP login works'
} else {
  Write-Warn "SMTP login failed: $smtpResult"
  Write-Warn "You can fix .env later and run .\scripts\verify.ps1 — continuing setup."
}

# --- 7. Install pm2 globally if missing ---
Write-Section 'pm2 process manager'
$hasPm2 = $null -ne (Get-Command pm2 -ErrorAction SilentlyContinue)
if (-not $hasPm2) {
  Write-Host '  Installing pm2 and pm2-windows-startup globally...'
  npm install -g pm2 pm2-windows-startup
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'pm2 install failed. Try re-running this script in an Administrator PowerShell.'
    exit 1
  }
  Write-Ok 'pm2 installed'
} else {
  Write-Ok 'pm2 already installed'
}

# --- 8. Start / restart the app ---
Write-Section 'Starting deal-dashboard'
pm2 delete deal-dashboard 2>$null | Out-Null
pm2 start ecosystem.config.js
if ($LASTEXITCODE -ne 0) { Write-Err 'pm2 start failed'; exit 1 }
pm2 save | Out-Null
Write-Ok 'App is running under pm2'

# --- 9. Enable auto-start on boot (best effort; admin may be required) ---
Write-Section 'Auto-start on boot'
try {
  pm2-startup install 2>&1 | Out-Null
  Write-Ok 'Will start automatically when Windows boots'
} catch {
  Write-Warn 'Could not install boot hook (needs admin PowerShell). Not fatal — app still runs.'
}

# --- 10. Final summary ---
Write-Host "`n*** Setup complete ***" -ForegroundColor Green
pm2 status
Write-Host ''
Write-Host "  Dashboard:   http://localhost:3000"        -ForegroundColor Cyan
Write-Host "  Live logs:   pm2 logs deal-dashboard"
Write-Host "  Restart:     pm2 restart deal-dashboard"
Write-Host "  Health:      .\scripts\verify.ps1"
Write-Host "  Import CSV:  npm run import data\imports\leads.csv"
Write-Host "  Dry run:     npm run campaign:dry"
Write-Host ''

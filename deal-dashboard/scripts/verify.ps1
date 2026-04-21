#Requires -Version 5.1
# Quick health check for deal-dashboard on Windows.
# Run: .\scripts\verify.ps1

$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "`n*** deal-dashboard Health Check ***`n" -ForegroundColor Cyan

$results = New-Object System.Collections.Generic.List[object]

function Add-Result($check, $status, $detail) {
  $results.Add([PSCustomObject]@{
    Check  = $check
    Status = $status
    Detail = $detail
  })
}

# 1. pm2 process
try {
  $pm2Json = pm2 jlist 2>$null | Out-String
  if ($pm2Json.Trim()) {
    $apps = $pm2Json | ConvertFrom-Json
    $app = $apps | Where-Object { $_.name -eq 'deal-dashboard' } | Select-Object -First 1
    if ($app -and $app.pm2_env.status -eq 'online') {
      $uptimeMs = (Get-Date).ToFileTimeUtc() - $app.pm2_env.pm_uptime
      $minutes = [math]::Round(((Get-Date) - ([datetimeoffset]::FromUnixTimeMilliseconds($app.pm2_env.pm_uptime)).DateTime).TotalMinutes, 1)
      Add-Result 'pm2 process' 'PASS' "online (${minutes}m uptime, $($app.pm2_env.restart_time) restarts)"
    } else {
      Add-Result 'pm2 process' 'FAIL' 'not running — run .\scripts\setup.ps1'
    }
  } else {
    Add-Result 'pm2 process' 'FAIL' 'pm2 not installed or no processes'
  }
} catch {
  Add-Result 'pm2 process' 'FAIL' $_.Exception.Message
}

# 2. HTTP status endpoint
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/status' -TimeoutSec 5
  Add-Result 'Dashboard HTTP' 'PASS' "port 3000 -> $($resp.StatusCode) OK"
} catch {
  Add-Result 'Dashboard HTTP' 'FAIL' "port 3000 not responding: $($_.Exception.Message)"
}

# 3. SMTP
$smtpScript = @'
require('dotenv').config();
const n = require('nodemailer');
n.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: parseInt(process.env.EMAIL_PORT) === 465,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
}).verify()
  .then(() => { console.log('OK'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
'@
$smtpOut = $smtpScript | node 2>&1
if ($smtpOut -match '^OK') {
  Add-Result 'SMTP login' 'PASS' $env:EMAIL_USER
} else {
  Add-Result 'SMTP login' 'FAIL' ($smtpOut -join ' ')
}

# 4. Lead stats from API (if dashboard is up)
try {
  $stats = (Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/lead-stats' -TimeoutSec 5).Content | ConvertFrom-Json
  Add-Result 'Leads database' 'PASS' "$($stats.total) leads | $($stats.active) active | $($stats.pendingCallReminders) call reminders pending"
} catch {
  Add-Result 'Leads database' 'FAIL' 'could not query /api/lead-stats'
}

$results | Format-Table -AutoSize

$failures = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count
if ($failures -eq 0) {
  Write-Host "All checks passed.`n" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$failures check(s) failed.`n" -ForegroundColor Red
  exit 1
}

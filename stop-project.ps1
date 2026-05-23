$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$IpfsDir = Join-Path $Root "private-ipfs-cluster"
$IpfsStopScript = Join-Path $IpfsDir "scripts\stop-private-network.ps1"
$PortsToStop = @(8545, 5173)

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-ProcessByPort {
  param([int]$Port)

  $connections = @()
  try {
    $connections = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)
  } catch {
    $connections = @()
  }

  $processIds = @(
    $connections |
      Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
      Select-Object -ExpandProperty OwningProcess -Unique
  )

  if ($processIds.Count -eq 0) {
    Write-Host "No local process found on port $Port."
    return
  }

  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Write-Host "Stopping PID $processId ($($process.ProcessName)) on port $Port..."
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Host "Could not stop PID $processId on port ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
}

Write-Host "Whistleblower DApp one-click shutdown" -ForegroundColor Green
Write-Host "Root: $Root"

Write-Step "Stopping frontend and local blockchain"
foreach ($port in $PortsToStop) {
  Stop-ProcessByPort -Port $port
}

Write-Step "Stopping Private IPFS / IPFS Cluster"
if (Test-Path $IpfsStopScript) {
  Push-Location $IpfsDir
  try {
    powershell -NoProfile -ExecutionPolicy Bypass -File $IpfsStopScript
  } finally {
    Pop-Location
  }
} else {
  Write-Host "IPFS stop script not found: $IpfsStopScript" -ForegroundColor Yellow
}

Write-Step "Checking remaining whistleblower Docker containers"
$dockerAvailable = $false
try {
  docker info *> $null
  $dockerAvailable = $true
} catch {
  $dockerAvailable = $false
}

if ($dockerAvailable) {
  $containers = @(docker ps --filter "name=whistleblower" --format "{{.Names}}")
  if ($containers.Count -eq 0) {
    Write-Host "No running whistleblower containers."
  } else {
    Write-Host "These containers are still running:" -ForegroundColor Yellow
    $containers | ForEach-Object { Write-Host "- $_" }
  }
} else {
  Write-Host "Docker daemon is not reachable. If Docker Desktop is closed, IPFS containers are already stopped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Shutdown finished. You can safely close remaining terminal windows." -ForegroundColor Green

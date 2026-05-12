$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-DockerReady {
  try {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker info *> $null
    $ready = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $previousPreference
    return $ready
  } catch {
    $ErrorActionPreference = $previousPreference
    return $false
  }
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI not found. Please install Docker Desktop first: https://www.docker.com/products/docker-desktop/"
}

if (!(Test-DockerReady)) {
  Write-Host "Docker daemon is not ready. Starting Docker Desktop..."

  $dockerDesktopPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dockerDesktopPath) {
    Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden
  } else {
    Write-Host "Docker Desktop executable not found at default path."
    Write-Host "Please open Docker Desktop manually, then re-run this script."
  }

  $maxAttempts = 60
  for ($i = 1; $i -le $maxAttempts; $i++) {
    if (Test-DockerReady) {
      Write-Host "Docker daemon is ready."
      break
    }

    Write-Host "Waiting for Docker daemon... ($i/$maxAttempts)"
    Start-Sleep -Seconds 2
  }

  if (!(Test-DockerReady)) {
    throw "Docker daemon did not become ready in time. Please open Docker Desktop and wait until it is running."
  }
}

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-private-network.ps1")

Write-Host ""
Write-Host "Private IPFS startup pipeline finished."
Write-Host "Gateway: http://127.0.0.1:8080"
Write-Host "Check containers: docker ps --filter `"name=whistleblower`""

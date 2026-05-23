$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$IpfsDir = Join-Path $Root "private-ipfs-cluster"
$DappDir = Join-Path $Root "whistleblower-semaphore"
$FrontendDir = Join-Path $DappDir "frontend"
$FrontendEnv = Join-Path $FrontendDir ".env"
$FrontendEnvExample = Join-Path $FrontendDir ".env.example"
$IpfsEnv = Join-Path $IpfsDir ".env"
$IpfsSwarmKey = Join-Path $IpfsDir "secrets\swarm.key"
$IpfsGenerateSecretsScript = Join-Path $IpfsDir "scripts\generate-secrets.ps1"
$LocalRpcUrl = "http://127.0.0.1:8545"
$FrontendUrl = "http://127.0.0.1:5173"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Rpc {
  param(
    [string]$Method,
    [object[]]$Params = @()
  )

  $body = @{
    jsonrpc = "2.0"
    id = 1
    method = $Method
    params = $Params
  } | ConvertTo-Json -Depth 8

  return Invoke-RestMethod -Uri $LocalRpcUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 3
}

function Test-RpcReady {
  try {
    $result = Invoke-Rpc -Method "eth_chainId"
    return [bool]$result.result
  } catch {
    return $false
  }
}

function Wait-RpcReady {
  param([int]$MaxAttempts = 45)

  for ($i = 1; $i -le $MaxAttempts; $i++) {
    if (Test-RpcReady) {
      Write-Host "Local blockchain RPC is ready."
      return
    }

    Write-Host "Waiting for local blockchain RPC... ($i/$MaxAttempts)"
    Start-Sleep -Seconds 2
  }

  throw "Local blockchain RPC did not become ready. Check the Hardhat terminal."
}

function Start-Terminal {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $escapedDir = $WorkingDirectory.Replace("'", "''")
  $escapedCommand = $Command.Replace("'", "''")
  $psCommand = "Write-Host '$Title' -ForegroundColor Cyan; Set-Location '$escapedDir'; $escapedCommand"

  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $psCommand
  ) -WorkingDirectory $WorkingDirectory
}

function Invoke-CheckedCommand {
  param(
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$Description
  )

  Write-Host $Description
  Push-Location $WorkingDirectory
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & cmd.exe /d /c $Command
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "$Description failed with exit code $exitCode."
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
  }
}

function Ensure-NodeModules {
  param(
    [string]$WorkingDirectory,
    [string]$Name
  )

  $nodeModules = Join-Path $WorkingDirectory "node_modules"
  if (Test-Path $nodeModules) {
    Write-Host "$Name dependencies already installed."
    return
  }

  Invoke-CheckedCommand -WorkingDirectory $WorkingDirectory -Command "npm install" -Description "Installing $Name dependencies..."
}

function Ensure-IpfsConfig {
  if ((Test-Path $IpfsEnv) -and (Test-Path $IpfsSwarmKey)) {
    Write-Host "Private IPFS config already exists."
    return
  }

  if (!(Test-Path $IpfsGenerateSecretsScript)) {
    throw "IPFS generate-secrets script not found: $IpfsGenerateSecretsScript"
  }

  Write-Host "Private IPFS .env or swarm.key is missing. Generating local private IPFS secrets..."
  $backupSuffix = Get-Date -Format "yyyyMMddHHmmss"
  if (Test-Path $IpfsEnv) {
    Copy-Item -Path $IpfsEnv -Destination "$IpfsEnv.backup-$backupSuffix"
    Write-Host "Backed up existing IPFS .env before regenerating secrets."
  }
  if (Test-Path $IpfsSwarmKey) {
    Copy-Item -Path $IpfsSwarmKey -Destination "$IpfsSwarmKey.backup-$backupSuffix"
    Write-Host "Backed up existing IPFS swarm.key before regenerating secrets."
  }
  Invoke-CheckedCommand -WorkingDirectory $IpfsDir -Command "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate-secrets.ps1" -Description "Generating Private IPFS secrets..."
}

function Get-EnvValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (!(Test-Path $Path)) { return "" }
  $line = Get-Content $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))=" } | Select-Object -First 1
  if (!$line) { return "" }
  return ($line -replace "^\s*$([regex]::Escape($Key))=", "").Trim()
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $lines = @()
  if (Test-Path $Path) {
    $lines = @(Get-Content $Path)
  }

  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($Key))=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (!$found) {
    $updated += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $updated -Encoding UTF8
}

function Test-ContractCode {
  param([string]$Address)

  if (!$Address -or $Address -notmatch "^0x[0-9a-fA-F]{40}$") {
    return $false
  }

  try {
    $response = Invoke-Rpc -Method "eth_getCode" -Params @($Address, "latest")
    return $response.result -and $response.result -ne "0x"
  } catch {
    return $false
  }
}

function Deploy-LocalContract {
  Write-Step "Deploying local Semaphore whistleblower contract"
  Push-Location $DappDir
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Hardhat may write Node.js version warnings to stderr even when deploy succeeds.
    # Run through cmd and check the real exit code so warnings do not stop the script.
    $ErrorActionPreference = "Continue"
    $output = & cmd.exe /d /c "npm run deploy:local 2>&1"
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }
    if ($exitCode -ne 0) {
      throw "Deploy command failed with exit code $exitCode."
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    Pop-Location
  }

  $match = $output | Select-String -Pattern @(
    "EmployeeSemaphoreWhistleblower:\s*(0x[0-9a-fA-F]{40})",
    "Contract address:\s*(0x[0-9a-fA-F]{40})",
    "deployed app:\s*(0x[0-9a-fA-F]{40})"
  ) | Select-Object -First 1
  if (!$match) {
    throw "Deploy finished, but contract address was not found in output."
  }

  return $match.Matches[0].Groups[1].Value
}

Write-Host "Whistleblower DApp one-click startup" -ForegroundColor Green
Write-Host "Root: $Root"

Write-Step "Preparing dependencies for first-time setup"
Ensure-NodeModules -WorkingDirectory $IpfsDir -Name "Private IPFS"
Ensure-NodeModules -WorkingDirectory $DappDir -Name "Semaphore DApp"
Ensure-NodeModules -WorkingDirectory $FrontendDir -Name "Frontend"

Write-Step "Preparing Private IPFS config"
Ensure-IpfsConfig

Write-Step "Compiling smart contracts"
Invoke-CheckedCommand -WorkingDirectory $DappDir -Command "npm run compile" -Description "Compiling Semaphore contracts..."

Write-Step "Starting Private IPFS / IPFS Cluster"
Push-Location $IpfsDir
try {
  npm start
} finally {
  Pop-Location
}

Write-Step "Starting local blockchain if needed"
if (Test-RpcReady) {
  Write-Host "Local blockchain RPC is already running."
} else {
  Start-Terminal -Title "Hardhat Local Blockchain" -WorkingDirectory $DappDir -Command "npm run node"
  Wait-RpcReady
}

Write-Step "Preparing frontend .env"
if (!(Test-Path $FrontendEnv)) {
  if (!(Test-Path $FrontendEnvExample)) {
    throw ".env.example not found: $FrontendEnvExample"
  }
  Copy-Item -Path $FrontendEnvExample -Destination $FrontendEnv
  Write-Host "Created frontend .env from .env.example."
}

$clusterPassword = Get-EnvValue -Path $IpfsEnv -Key "CLUSTER_API_PASSWORD"
$frontendClusterPassword = Get-EnvValue -Path $FrontendEnv -Key "VITE_IPFS_CLUSTER_PASSWORD"
if ($clusterPassword -and !$frontendClusterPassword) {
  Set-EnvValue -Path $FrontendEnv -Key "VITE_IPFS_CLUSTER_PASSWORD" -Value $clusterPassword
  Write-Host "Synced VITE_IPFS_CLUSTER_PASSWORD from private-ipfs-cluster .env."
}

$contractAddress = Get-EnvValue -Path $FrontendEnv -Key "VITE_CONTRACT_ADDRESS"
if (Test-ContractCode -Address $contractAddress) {
  Write-Host "Existing frontend contract address is valid: $contractAddress"
} else {
  if ($contractAddress) {
    Write-Host "No contract code found at $contractAddress on local RPC. Deploying again..."
  } else {
    Write-Host "No frontend contract address configured. Deploying..."
  }

  $contractAddress = Deploy-LocalContract
  Set-EnvValue -Path $FrontendEnv -Key "VITE_CONTRACT_ADDRESS" -Value $contractAddress
  Write-Host "Updated frontend .env VITE_CONTRACT_ADDRESS=$contractAddress" -ForegroundColor Green
}

Write-Step "Starting frontend dev server"
Start-Terminal -Title "Whistleblower Frontend" -WorkingDirectory $FrontendDir -Command "npm run dev -- --host 127.0.0.1"

Write-Step "Opening browser"
Start-Sleep -Seconds 3
Start-Process $FrontendUrl

Write-Host ""
Write-Host "Startup finished." -ForegroundColor Green
Write-Host "Frontend: $FrontendUrl"
Write-Host "Contract: $contractAddress"
Write-Host ""
Write-Host "Notes:"
Write-Host "- Keep the Hardhat and Frontend terminals open while using the DApp."
Write-Host "- Private IPFS runs through Docker containers; use Docker Desktop to inspect them."
Write-Host "- If the contract address becomes invalid after restarting Hardhat, rerun this script."

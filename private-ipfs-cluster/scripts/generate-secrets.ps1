$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$secretsDir = Join-Path $root "secrets"
$envPath = Join-Path $root ".env"
$swarmKeyPath = Join-Path $secretsDir "swarm.key"

New-Item -ItemType Directory -Force $secretsDir | Out-Null

function New-HexSecret($bytesLength) {
  $bytes = New-Object byte[] $bytesLength
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return (($bytes | ForEach-Object { $_.ToString("x2") }) -join "")
}

$swarmSecret = New-HexSecret 32
$clusterSecret = New-HexSecret 32
$apiPassword = New-HexSecret 12

$swarmKey = @"
/key/swarm/psk/1.0.0/
/base16/
$swarmSecret
"@

[System.IO.File]::WriteAllText($swarmKeyPath, $swarmKey, (New-Object System.Text.UTF8Encoding($false)))

$envContent = @"
CLUSTER_SECRET=$clusterSecret
CLUSTER_RESTAPI_BASICAUTHCREDENTIALS=admin:$apiPassword
CLUSTER_API_URL=http://127.0.0.1:9094
CLUSTER_API_USER=admin
CLUSTER_API_PASSWORD=$apiPassword
"@

[System.IO.File]::WriteAllText($envPath, $envContent, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Generated:"
Write-Host "  $swarmKeyPath"
Write-Host "  $envPath"
Write-Host ""
Write-Host "Keep these values private. Nodes must share the same swarm.key to join this private IPFS network."

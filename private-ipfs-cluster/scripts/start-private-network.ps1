$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (!(Test-Path ".env") -or !(Test-Path "secrets/swarm.key")) {
  throw "Missing .env or secrets/swarm.key. Run: powershell -ExecutionPolicy Bypass -File scripts/generate-secrets.ps1"
}

docker compose up -d

Write-Host "Waiting for IPFS daemons..."
Start-Sleep -Seconds 8

docker exec whistleblower-ipfs0 ipfs bootstrap rm --all | Out-Null
docker exec whistleblower-ipfs1 ipfs bootstrap rm --all | Out-Null
docker exec whistleblower-ipfs0 ipfs config --json Swarm.AddrFilters '[]' | Out-Null
docker exec whistleblower-ipfs1 ipfs config --json Swarm.AddrFilters '[]' | Out-Null

# Kubo reads connection-gater settings at daemon startup, so restart after config changes.
docker restart whistleblower-ipfs0 whistleblower-ipfs1 | Out-Null
Start-Sleep -Seconds 8

$ipfs0Id = (docker exec whistleblower-ipfs0 ipfs id -f="<id>").Trim()
$ipfs1Id = (docker exec whistleblower-ipfs1 ipfs id -f="<id>").Trim()

docker exec whistleblower-ipfs0 ipfs swarm connect "/dns4/ipfs1/tcp/4001/p2p/$ipfs1Id" | Out-Null
docker exec whistleblower-ipfs1 ipfs swarm connect "/dns4/ipfs0/tcp/4001/p2p/$ipfs0Id" | Out-Null

Write-Host "Private IPFS network is up."
Write-Host "IPFS0 API:      http://127.0.0.1:5001"
Write-Host "IPFS0 Gateway:  http://127.0.0.1:8080/ipfs/<CID>"
Write-Host "Cluster API:    http://127.0.0.1:9094"
Write-Host ""
Write-Host "Connected private swarm peers:"
docker exec whistleblower-ipfs0 ipfs swarm peers

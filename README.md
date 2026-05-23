# Whistleblower Anonymous Reporting System

This repository now has three clear areas:

- `whistleblower-semaphore`: main DApp for employee-only anonymous reports using Semaphore.
- `private-ipfs-cluster`: private IPFS + IPFS Cluster for encrypted report content.
- `legacy-basic-dapp`: archived early demo. Keep it for reference, but it is not the current main flow.

Project documents are in `docs/`.

## Recommended Project Structure

```text
final/
├─ README.md
├─ docs/
│  └─ 實作步驟.pdf
├─ whistleblower-semaphore/
│  ├─ contracts/
│  ├─ frontend/
│  └─ scripts/
├─ private-ipfs-cluster/
│  ├─ docker-compose.yml
│  └─ scripts/
└─ legacy-basic-dapp/
   ├─ contracts/
   ├─ frontend/
   └─ scripts/
```

## Current Main Flow

Use this flow for the final anonymous employee whistleblower demo:

1. Start private IPFS.
2. Start local Hardhat chain or use a shared testnet.
3. Deploy `EmployeeSemaphoreWhistleblower`.
4. Configure frontend contract address.
5. Admin adds employee commitments.
6. Employee generates Semaphore proof and submits report metadata.
7. Admin fetches encrypted content from private IPFS by `ipfsCID` and decrypts with MetaMask.

## One-Click Local Startup

The root folder includes a helper script that starts the local demo with fewer manual steps.

Recommended:

```powershell
cd C:\futen\政大\3_區塊鏈\final
.\start-project.bat
```

Alternative PowerShell command:

```powershell
cd C:\futen\政大\3_區塊鏈\final
powershell -ExecutionPolicy Bypass -File .\start-project.ps1
```

What it does:

- starts Private IPFS / IPFS Cluster by running `private-ipfs-cluster\npm start`
- starts local Hardhat RPC if `http://127.0.0.1:8545` is not running
- copies `whistleblower-semaphore\frontend\.env.example` to `.env` if needed
- syncs `VITE_IPFS_CLUSTER_PASSWORD` from `private-ipfs-cluster\.env` if the frontend value is empty
- checks whether `VITE_CONTRACT_ADDRESS` has contract code on the local chain
- runs `npm run deploy:local` only when the frontend contract address is missing or invalid
- updates `whistleblower-semaphore\frontend\.env` with the deployed contract address
- starts the frontend dev server
- opens `http://127.0.0.1:5173` in the browser

Keep the Hardhat and frontend terminals open while using the demo.

If Docker Desktop is not running, the IPFS startup step will try to open/wait for Docker through the existing `private-ipfs-cluster` startup script. If Docker shows a WSL or daemon error, restart Docker Desktop and run `.\start-project.bat` again.

## One-Click Local Shutdown

When you finish the local demo, run:

```powershell
cd C:\futen\政大\3_區塊鏈\final
.\stop-project.bat
```

Alternative PowerShell command:

```powershell
cd C:\futen\政大\3_區塊鏈\final
powershell -ExecutionPolicy Bypass -File .\stop-project.ps1
```

What it does:

- stops the local frontend process on port `5173`
- stops the local Hardhat RPC process on port `8545`
- stops Private IPFS / IPFS Cluster through `private-ipfs-cluster\scripts\stop-private-network.ps1`
- checks whether any `whistleblower-*` Docker containers are still running

After it finishes, you can safely close remaining terminal windows or shut down the computer.

## 1) Start Private IPFS Server

Open Docker Desktop first. Docker CLI commands only work after Docker Desktop / Docker daemon is running.

Recommended one-command startup:

```powershell
cd C:\futen\政大\3_區塊鏈\final\private-ipfs-cluster
npm start
```

This will try to open Docker Desktop, wait for Docker daemon, and then start private IPFS.

Manual Docker Desktop startup:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker info
```

Manual private IPFS startup:

```powershell
cd C:\futen\政大\3_區塊鏈\final\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\start-private-network.ps1
```

Check running containers:

```powershell
docker ps --filter "name=whistleblower"
npm run health
```

Expected containers:

```text
whistleblower-ipfs0
whistleblower-ipfs1
whistleblower-cluster0
whistleblower-cluster1
```

Frontend Private IPFS Gateway:

```text
http://127.0.0.1:8080
```

Stop IPFS server:

```powershell
cd C:\futen\政大\3_區塊鏈\final\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\stop-private-network.ps1
```

Important: run `scripts\generate-secrets.ps1` only once for a private IPFS network. Do not regenerate secrets unless you intentionally want a new private network.

## 2) Start Local Blockchain and Deploy Semaphore Contract

Terminal A:

```powershell
cd C:\futen\政大\3_區塊鏈\final\whistleblower-semaphore
npm install
npm run compile
npm run node
```

Keep Terminal A running.

Terminal B:

```powershell
cd C:\futen\政大\3_區塊鏈\final\whistleblower-semaphore
npm run deploy:local
```

Copy the deployed `EmployeeSemaphoreWhistleblower` address.

## 3) Configure and Run Frontend

```powershell
cd C:\futen\政大\3_區塊鏈\final\whistleblower-semaphore\frontend
npm install
copy .env.example .env
```

Edit `.env`:

```env
VITE_CONTRACT_ADDRESS=<EmployeeSemaphoreWhistleblower_address>
```

Start frontend:

```powershell
npm run dev
```

## 4) Frontend Checklist

- Click `連接錢包`.
- Click `一鍵連到本機`.
- Keep Private IPFS Gateway as `http://127.0.0.1:8080`.
- Click `檢查 IPFS`.
- Click `檢查合約`.
- Admin clicks `取得 Admin 加密公鑰`.
- Admin clicks `設定 Admin 加密公鑰到鏈上`.
- Employee generates Identity and gives only the commitment to Admin.
- Admin adds the employee commitment.
- Employee generates proof and submits anonymous report.
- Admin loads all reports and decrypts by `ipfsCID`.

## Team Usage

If each teammate runs local Hardhat on their own computer, they are running separate blockchains. They will not see each other's records.

For shared on-chain records across computers:

- Deploy the Semaphore contract once to a shared testnet such as Polygon Amoy.
- Share the same deployed contract address.
- Everyone sets the same `VITE_CONTRACT_ADDRESS`.
- Everyone switches MetaMask to the same testnet.

For shared private IPFS:

- Teammates need Docker Desktop.
- Teammates need the same `private-ipfs-cluster/.env` and `private-ipfs-cluster/secrets/swarm.key`.
- Share those two files securely.
- Do not commit `.env` or `secrets/swarm.key` to GitHub.

## Legacy Basic DApp

The early demo has been moved to `legacy-basic-dapp/` instead of being deleted.

Use it only if you need to review the first basic report contract/UI. It is not the current final architecture.

To run it:

```powershell
cd C:\futen\政大\3_區塊鏈\final\legacy-basic-dapp
npm install
npm run compile
npm run node
```

Then deploy in another terminal:

```powershell
cd C:\futen\政大\3_區塊鏈\final\legacy-basic-dapp
npm run deploy:local
```

And run its frontend:

```powershell
cd C:\futen\政大\3_區塊鏈\final\legacy-basic-dapp\frontend
npm install
npm run dev
```

## Troubleshooting

If Docker Desktop looks like nothing is running:

```powershell
docker ps --filter "name=whistleblower"
```

If the four `whistleblower-*` containers show `Up`, IPFS is running even if Docker Desktop UI is on another tab or has a filter.

If `Check Contract` fails:

- make sure MetaMask is on the same chain as the deployed contract
- re-run `npm run deploy:local` after restarting Hardhat
- update `whistleblower-semaphore/frontend/.env`
- refresh the frontend

If `Check IPFS` fails:

- open Docker Desktop
- run `private-ipfs-cluster/scripts/start-private-network.ps1`
- confirm gateway is `http://127.0.0.1:8080`

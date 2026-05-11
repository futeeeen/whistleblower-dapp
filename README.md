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

## 1) Start Private IPFS Server

Open Docker Desktop first. Docker CLI commands only work after Docker Desktop / Docker daemon is running.

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

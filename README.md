# Whistleblower DApp (Hardhat + React)

## Quick Start

### 1) Install dependencies

```bash
npm install
cd frontend
npm install
```

### 2) Compile contract

```bash
cd ..
npm run compile
```

### 3) Start local blockchain (Terminal A)

```bash
npm run node
```

Keep this terminal running.

### 4) Deploy contract (Terminal B)

```bash
npm run deploy:local
```

Copy the deployed contract address from output, for example:
`Contract address: 0x...`

### 5) Set frontend contract address

```bash
cd frontend
copy .env.example .env
```

Edit `frontend/.env`:

```env
VITE_CONTRACT_ADDRESS=<deployed_address>
```

### 6) Run frontend

```bash
npm run dev
```

Open the Vite URL shown in terminal.

## MetaMask Setup (Local Development)

Use these values when adding/switching local network:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: usually `31337` (`0x7a69`) or `1337` (`0x539`)
- Currency Symbol: `ETH`

Import one test account private key from `npm run node` output.

## How to Get Required MetaMask Info

- RPC URL: from your local node command (`npm run node`), default is `127.0.0.1:8545`
- Chain ID: 
  - from `npm run node` logs, or
  - click `RPC 健康檢查` button in frontend and read `eth_chainId`
- Account Private Key: from `npm run node` account list (`Private Key` lines)
- Contract Address: from `npm run deploy:local` output

## Frontend Buttons and What They Do

- `送出檢舉 (MetaMask)`
  - Sends `submitReport(report, "dummy_hash_for_test")` transaction via MetaMask.

- `RPC 健康檢查`
  - Shows diagnostic info:
    - `eth_chainId`
    - `net_version`
    - `latest block`
    - current account and balance
    - whether contract code exists at configured address
    - `callStatic submitReport` result

- `通用本機 RPC 修復`
  - Auto-detects available local RPC endpoint (`127.0.0.1/localhost`, ports `8545/7545`).
  - Reads detected chainId from RPC.
  - Tries to switch MetaMask to that chain.
  - If chain not found in MetaMask, auto-adds it and then switches.

- `查詢所有檢舉`
  - Reads `caseCount` and fetches `cases(1..N)` from contract.
  - Renders a table with ID, CID/report, content hash, status, and timestamp.

## Common Troubleshooting

- If transaction fails after restarting node:
  - Re-run `npm run deploy:local`
  - Update `frontend/.env` contract address
  - Refresh frontend

- If you see RPC errors like `too many errors`:
  - Click `通用本機 RPC 修復`
  - Then click `RPC 健康檢查` to verify

- If contract is not found (`contract deployed: no`):
  - You are likely using wrong address or wrong chain
  - Re-deploy and update `.env`

## Notes

- Contract source: `contracts/Whistleblower.sol`
- Deploy script: `scripts/deploy.js`
- Frontend main page: `frontend/src/App.jsx`
- ABI in frontend: `frontend/src/Whistleblower.json`

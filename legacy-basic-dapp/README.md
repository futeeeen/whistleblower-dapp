# Legacy Basic Whistleblower DApp

This folder contains the early basic Hardhat + React whistleblower demo.

It is kept for reference only. The current main project is:

- `../whistleblower-semaphore`
- `../private-ipfs-cluster`

## Run Legacy Demo

Install dependencies:

```powershell
npm install
cd frontend
npm install
```

Compile and start local chain:

```powershell
cd ..
npm run compile
npm run node
```

Deploy in another terminal:

```powershell
cd <repo-path>\legacy-basic-dapp
npm run deploy:local
```

Set frontend contract address:

```powershell
cd frontend
copy .env.example .env
```

Edit `.env`:

```env
VITE_CONTRACT_ADDRESS=<deployed_address>
```

Run frontend:

```powershell
npm run dev
```

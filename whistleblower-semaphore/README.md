# Whistleblower Semaphore (Isolated Project)

This folder is an isolated PoC for:
- employee-only anonymous reporting (Semaphore group membership proof)
- nullifier-based replay prevention (same identity cannot report twice in same scope)

It does **not** modify the original whistleblower project.

## Location

`C:\futen\政大\3_區塊鏈\final\whistleblower-semaphore`

## Implemented Components

1. `contracts/EmployeeSemaphoreWhistleblower.sol`
- creates and owns one Semaphore group for employees
- only owner/admin can add employee identity commitments
- accepts anonymous reports only when Semaphore proof is valid
- replay blocked via Semaphore nullifier

2. `scripts/deploy.js`
- deploys `PoseidonT3` library
- deploys `LocalSemaphoreVerifier`
- deploys `LocalSemaphore`
- deploys `EmployeeSemaphoreWhistleblower`

3. `frontend/`
- SaaS Admin create company and report groups
- Admin add employee commitment
- Employee generate identity and proof off-chain
- Employee submit anonymous report
- on-chain verification + verification visualization panel
- one-click network switching (Local / Amoy)

## Install and Compile

```bash
cd whistleblower-semaphore
npm install
npm run compile
```

## Deploy (Local Hardhat)

Terminal A:
```bash
npm run node
```

Terminal B:
```bash
npm run deploy:local
```

Copy `EmployeeSemaphoreWhistleblower` address and set frontend env:

```bash
cd frontend
copy .env.example .env
```

Set:

```env
VITE_CONTRACT_ADDRESS=<EmployeeSemaphoreWhistleblower_address>
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Start Private IPFS Before Testing Reports

Encrypted report content is expected to live in the private IPFS network. After rebooting, open Docker Desktop first and start IPFS:

```powershell
cd C:\futen\政大\3_區塊鏈\final\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\start-private-network.ps1
```

Check that IPFS is running:

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

In the frontend Control Panel, use:

```text
Private IPFS Gateway: http://127.0.0.1:8080
```

Click `檢查 IPFS / Check IPFS` before testing Admin decrypt.

## Frontend Buttons (What each does)

The PoC frontend has three tabs:

- `SaaS Admin`
  - platform/operator-style setup for company and report group onboarding.
  - creates `Company`.
  - creates `ReportGroup`.

- `Admin`
  - company admin workflow.
  - sets Admin encryption public key.
  - adds employee commitments to the selected report group.
  - loads and decrypts reports.

- `Employee`
  - reporter workflow.
  - creates/imports Semaphore identity.
  - generates proof.
  - submits reports by MetaMask or burner wallet.

- `Connect Wallet`
  - connect MetaMask account.

- `一鍵連到本機`
  - switch/add MetaMask network to Hardhat local (`31337`, `http://127.0.0.1:8545`).

- `一鍵連到 Amoy`
  - switch/add MetaMask network to Polygon Amoy (`80002`).

- `Check Contract`
  - diagnostics: `chainId`, contract code existence, `owner`, `groupId`.
  - helps detect wrong chain / wrong contract address.

- `Check IPFS`
  - checks whether the configured Private IPFS Gateway is reachable.
  - if an `ipfsCID` is filled, it also tries to fetch `/ipfs/<CID>`.
  - helps detect whether Docker/IPFS is running before Admin decrypts.

- `Load Group ID`
  - reads `groupId()` from contract.

- `Load Members From Chain`
  - reads `EmployeeMemberAdded` events and rebuilds commitment list for proof generation.

- `Generate New Identity`
  - creates employee Semaphore identity (`privateKey(base64)` + commitment).

- `Import Identity + Show Commitment`
  - restore identity from base64 private key and derive commitment.

- `Preview Reporter Commitment`
  - derive and show commitment from reporter identity input (for testing added vs non-added employee).

- `Admin Add Employee`
  - admin adds commitment into the selected `reportGroupId`.
  - the same employee commitment can be added to different report groups when policies allow it.

- `Generate Proof Off-chain`
  - employee generates ZK proof using identity + group members + report metadata.
  - proof message is bound to:
    - `companyId`
    - `reportGroupId`
    - `ipfsCID`
    - `contentHash/messageHash`
    - `period`
    - `reportSlot`
  - proof scope is bound to:
    - `companyId`
    - `reportGroupId`
    - `period`
    - `reportSlot`

- `Submit Anonymous Report`
  - submits `companyId`, `reportGroupId`, `ipfsCID`, `messageHash`, `period`, `reportSlot`, and proof to contract for on-chain verification.
  - encrypted report content should stay in private IPFS, not on-chain.
  - supports two submit modes:
    - `Use MetaMask wallet`: sender is the connected MetaMask account.
    - `Use anonymous burner wallet`: frontend generates a temporary wallet locally and sends a `gasPrice=0` transaction to the configured RPC.
  - burner mode is intended for local Hardhat / future permissioned-chain zero-gas environments.
  - burner mode is not suitable for Amoy because Amoy is a public testnet and still requires POL for gas.

- `Load All Reports`
  - reads all on-chain report metadata.
  - both Admin and Employee can see `ipfsCID`, `messageHash`, `nullifier`, and timestamp.

- `Decrypt`
  - Admin fetches encrypted content from private IPFS by `ipfsCID`.
  - MetaMask decrypts locally with the Admin wallet private key.
  - Employees can see the CID/hash, but cannot read plaintext without the Admin private key.

## Verification Visualization Panel

After successful submit, panel shows:
- `Validated` status
- transaction hash
- on-chain `nullifier`
- on-chain `message`
- explicit list of not-revealed items

Not revealed by proof itself:
- reporter identity private key
- real employee identity
- exact commitment mapping to real person

## `ipfsCID` and `contentHash`

- `ipfsCID`: pointer to encrypted/off-chain report content on IPFS.
- `messageHash`: integrity checksum used by the proof message. The UI computes it from the report content and binds it with `ipfsCID`.

Contract binds proof to both values by requiring:
- `proof.message == keccak256(companyId, reportGroupId, ipfsCID, messageHash, period, reportSlot)`

The contract also binds the nullifier scope:

```text
proof.scope == keccak256(companyId, reportGroupId, period, reportSlot)
```

The contract stores only metadata and proof-related values. The encrypted report body should be stored in private IPFS.

## Multi-Company / Multi-Group Notes

The contract now has first-class models for:

```text
Company
ReportGroup
Report
```

Default deployment creates:

```text
companyId = 1
reportGroupId = 1
```

Admin can create additional companies and report groups from the Admin tab.

Each `ReportGroup` controls:

- `companyId`
- topic name
- max reports per member
- active time window
- underlying Semaphore group ID

Quota is controlled by `reportSlot`.

Example:

```text
period = 2026-Q1
reportSlot = 1, 2, 3
```

If `maxReportsPerMember = 3`, one valid group member can submit up to three reports in that period by using slots 1, 2, and 3. Reusing the same slot generates the same nullifier scope and is rejected.

## Team Usage Notes

- Local Hardhat is private to each computer. If two teammates each run `npm run node`, they are running two different blockchains.
- To see the same on-chain reports across computers, deploy the contract once to a shared testnet such as Polygon Amoy and share the same contract address.
- To share the same private IPFS network, teammates need the same `private-ipfs-cluster/.env` and `private-ipfs-cluster/secrets/swarm.key`.
- Keep IPFS secrets private. Do not commit them to GitHub.
- Docker Desktop must be running before `start-private-network.ps1` can start the IPFS containers.

## Zero-Gas / Burner Wallet Notes

The local Hardhat config is set for zero-gas experiments:

```js
hardhat: {
  gasPrice: 0,
  initialBaseFeePerGas: 0
},
localhost: {
  url: "http://127.0.0.1:8545",
  gasPrice: 0
}
```

When using `Use anonymous burner wallet`, the frontend:

1. creates a temporary wallet in the browser,
2. connects it to the configured RPC,
3. sends the report transaction with `gasPrice: 0`.

This models the future permissioned-chain design:

```text
Who is eligible to report: ZK proof
Who sends the transaction: burner wallet
Who pays gas: nobody in the employee flow, because gasPrice=0 in the permissioned environment
```

If you restart the Hardhat node, redeploy the contract and update `frontend/.env` again.

## Test Scenarios (Membership Validation)

1. Added identity:
- add commitment with `Admin Add Employee`
- generate proof using that identity
- submit should pass

2. Non-added identity:
- use a different identity not in group
- proof generation or submit should fail verification

## Notes

- First proof generation may take longer (artifact download/initialization).
- Node v19 currently works with warnings; Node `20+` is recommended.
- If `groupId()` fails with CALL_EXCEPTION, usually chain/address mismatch. Use `Check Contract` first.

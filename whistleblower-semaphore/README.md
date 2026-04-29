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

## Frontend Buttons (What each does)

- `Connect Wallet`
  - connect MetaMask account.

- `一鍵連到本機`
  - switch/add MetaMask network to Hardhat local (`31337`, `http://127.0.0.1:8545`).

- `一鍵連到 Amoy`
  - switch/add MetaMask network to Polygon Amoy (`80002`).

- `Check Contract`
  - diagnostics: `chainId`, contract code existence, `owner`, `groupId`.
  - helps detect wrong chain / wrong contract address.

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
  - admin adds commitment into employee group.

- `Generate Proof Off-chain`
  - employee generates ZK proof using identity + group members + `(ipfsCID, contentHash)`.

- `Submit Anonymous Report`
  - submits report + proof to contract for on-chain verification.

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
- `contentHash`: integrity checksum of original content (recommended `sha256:<hex>`).

Contract binds proof to both values by requiring:
- `proof.message == keccak256(ipfsCID, contentHash)`

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

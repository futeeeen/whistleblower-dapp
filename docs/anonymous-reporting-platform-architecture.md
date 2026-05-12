# Anonymous Reporting Platform Architecture

## 1. Product Direction

The product is evolving from a local Semaphore proof-of-concept into an anonymous reporting platform for companies and trusted third-party institutions.

The target architecture uses a consortium / permissioned chain instead of a public chain. Participating companies or third-party institutions can operate authorized nodes. Employees should not need to pay gas fees or prepare ETH / POL / native tokens to submit reports.

Core principle:

```text
Who is eligible to report: verified by ZK proof
Who submits the transaction: anonymous burner wallet
```

The burner wallet is only a transaction sender. It is not the employee identity.

## 2. Current PoC Architecture

Current folders:

- `whistleblower-semaphore`
  - Semaphore-based employee membership verification.
  - Admin can add employee identity commitments.
  - Employee generates proof off-chain.
  - Contract verifies proof and stores report metadata.
  - Nullifier prevents repeated submission in the same scope.

- `private-ipfs-cluster`
  - Private IPFS + IPFS Cluster setup.
  - Encrypted report content is stored off-chain.
  - Chain stores only `ipfsCID`, `messageHash/contentHash`, nullifier, timestamp, and proof-related metadata.

- `legacy-basic-dapp`
  - Early basic demo kept for reference only.
  - Not part of the target product architecture.

Current PoC flow:

```text
Employee
  |
  | Generate Semaphore identity and proof
  | Encrypt report content with Admin public key
  v
Frontend
  |
  | Submit ipfsCID + messageHash + proof
  v
Smart Contract
  |
  | Verify proof
  | Store report metadata
  v
Admin
  |
  | Load report metadata
  | Fetch ciphertext from private IPFS by ipfsCID
  | Decrypt with Admin private key
```

## 3. Future Consortium / Permissioned Chain Architecture

The future production system should run on a consortium / permissioned chain.

Expected properties:

- Companies and trusted third-party institutions can become authorized nodes.
- The chain can use gas accounting for execution limits.
- Gas price can be configured as `0`, or transaction cost can be abstracted away.
- Employees do not need to pay gas fees.
- Platform operating costs are covered by enterprise subscription fees.

Target flow:

```text
Employee
  |
  | Generate ZK proof
  | Encrypt report content
  v
Frontend Platform
  |
  | Upload ciphertext to Private IPFS
  | Receive ipfsCID + contentHash
  | Generate anonymous burner wallet
  | Send gasPrice=0 transaction
  v
Consortium / Permissioned Chain
  |
  | Verify proof
  | Store ipfsCID, hash, metadata, nullifier
  | Keep immutable audit trail
  v
Company Admin
  |
  | Receive report notification
  | Fetch ciphertext from IPFS
  | Decrypt with company private key
```

Important separation:

```text
ZK proof = proves eligibility
Burner wallet = submits transaction
Admin key = decrypts report content
```

## 4. Roles and Permissions

### Platform Operator

Responsibilities:

- Operates the product platform.
- Maintains frontend, optional backend services, monitoring, and deployment tooling.
- Manages consortium chain onboarding process.
- May provide hosted private IPFS infrastructure.
- May provide dashboard, notification, and audit features.

The platform operator should not be able to decrypt employee report content unless explicitly authorized by the company.

### Company Admin

Responsibilities:

- Registers company profile.
- Owns company encryption key pair.
- Configures reporting topics / groups.
- Adds employee membership commitments.
- Reads report metadata from chain.
- Fetches ciphertext from private IPFS.
- Decrypts reports with company private key.

Company Admin should not be able to identify the reporter directly from on-chain data.

### Company / Third-Party Validator Node

Responsibilities:

- Participates in consortium / permissioned chain operation.
- Validates transactions and blocks.
- Helps maintain immutable audit trail.

Validator nodes should validate proof correctness and chain rules, but should not learn report plaintext.

### Employee / Reporter

Responsibilities:

- Generates or stores local ZK identity.
- Produces ZK proof to prove group membership and remaining report quota.
- Encrypts report content using company public key.
- Uses frontend-generated burner wallet to submit transaction.

Employee should not need:

- ETH
- POL
- Native chain token
- Personal wallet binding

### Auditor / Investigator

Responsibilities:

- May be granted read access to report metadata.
- May receive decrypted content from Company Admin or through controlled key-sharing workflow.
- Can use chain data as audit trail.

Auditor permissions should be explicit and scoped.

## 5. Multi-Company / Multi-Group Design

Each company can create multiple reporting topics. Each topic maps to a Semaphore group or a logical report group.

Examples:

- Financial fraud
- Sexual harassment
- Cybersecurity incident
- Insider trading

### Company

```text
Company
- companyId
- companyName
- adminPublicKey
- validator/admin address
- enabled topics/groups
```

Possible future fields:

```text
- status
- createdAt
- metadataURI
- notificationEndpoint
- allowedValidatorNodes
```

### ReportGroup

Each reporting topic is represented as a group.

```text
ReportGroup
- groupId
- companyId
- topicName
- maxReportsPerMember
- startTime
- endTime
- merkleRoot / semaphore group
```

Possible future fields:

```text
- isActive
- quotaMode
- period
- adminPublicKeyOverride
- groupMetadataURI
```

### Report

Each submitted report stores metadata only.

```text
Report
- reportId
- companyId
- groupId
- ipfsCID
- contentHash
- timestamp
- nullifier
- proof metadata
```

Possible future fields:

```text
- status
- encryptedKeyURI
- reportType
- submittedBySender
- chainBlockNumber
```

Note: `submittedBySender` is the burner wallet address. It should not be treated as employee identity.

## 6. Employee Gas-Free Flow

The target design removes employee gas payment while avoiding a Relayer in the MVP.

Design decision:

```text
Employee frontend directly sends transaction to authorized RPC.
Frontend creates an anonymous burner wallet locally.
The burner wallet signs the transaction.
The permissioned chain accepts gasPrice=0 transactions.
```

Flow:

```text
1. Employee opens platform frontend.
2. Frontend loads company and group settings.
3. Employee enters report content.
4. Frontend encrypts report content with company public key.
5. Frontend uploads ciphertext to private IPFS.
6. Frontend receives ipfsCID and contentHash.
7. Frontend generates ZK proof.
8. Frontend generates anonymous burner wallet.
9. Burner wallet signs gasPrice=0 transaction.
10. Transaction is sent to permissioned chain RPC.
11. Contract verifies proof and stores metadata.
```

Why this works:

- The chain still uses gas accounting to limit computation.
- Gas price can be zero in a permissioned chain.
- No public token is needed.
- Enterprise subscription fees cover infrastructure and operations.

Important security note:

Burner wallet anonymity does not equal full network anonymity. RPC nodes may still observe IP or request metadata. Production deployment should consider:

- company intranet access
- VPN
- privacy-preserving gateway
- rate limits
- abuse detection
- separation between login/session and chain transaction sender

## 7. IPFS + Encryption Flow

Report plaintext should never be stored on-chain.

Encryption flow:

```text
1. Company Admin publishes company adminPublicKey.
2. Employee frontend encrypts report content with adminPublicKey.
3. Ciphertext is uploaded to private IPFS.
4. IPFS returns ipfsCID.
5. Frontend computes contentHash.
6. Contract stores ipfsCID and contentHash.
7. Admin later fetches ciphertext by ipfsCID.
8. Admin decrypts with company private key.
```

On-chain storage:

```text
ipfsCID
contentHash
timestamp
companyId
groupId
nullifier
proof metadata
```

Off-chain storage:

```text
ciphertext
optional encrypted attachments
optional report metadata JSON
```

Admin decryption:

```text
ipfsCID -> Private IPFS Gateway -> ciphertext -> Admin private key -> plaintext
```

Integrity:

```text
contentHash = hash(ciphertext or canonical report payload)
```

The team should decide whether `contentHash` refers to:

- ciphertext hash, recommended for verifying stored IPFS payload integrity
- plaintext hash, useful for content integrity but must avoid leaking predictable content fingerprints

For production, ciphertext hash is safer as the default.

## 8. ZK Proof / Nullifier / Quota Design

ZK proof should prove:

- reporter belongs to the company group
- reporter belongs to the selected report topic group
- reporter has remaining report quota
- proof matches submitted metadata

The proof should not reveal:

- employee real identity
- private identity
- which exact commitment belongs to the employee
- report plaintext

### Nullifier

Nullifier prevents duplicate use of the same reporting right.

Basic one-report-per-scope design:

```text
scope = companyId + groupId + period
```

This means one employee can report once per company, group, and period.

### Allowing N Reports

To allow one employee to submit multiple reports, use report slots.

```text
scope = companyId + groupId + period + reportSlot
```

Example:

```text
reportSlot = 1, 2, 3
```

This allows each valid member to report up to three times in that scope.

Contract-level behavior:

```text
usedNullifiers[nullifier] = true
```

If the same nullifier appears again, reject the transaction.

### Report Period

`period` can represent:

- calendar year
- quarter
- incident campaign
- employment cycle
- custom group window

Example:

```text
scope = keccak256(companyId, groupId, "2026-Q1", reportSlot)
```

### Proof Message Binding

The proof should bind to submitted metadata:

```text
message = hash(companyId, groupId, ipfsCID, contentHash, reportSlot, period)
```

This prevents someone from reusing a valid proof with different report metadata.

## 9. Smart Contract Evolution

Current PoC contract can evolve into modules:

### Company Registry

Responsibilities:

- register companies
- store company admin public key
- manage validator/admin addresses
- enable or disable company status

### Group Manager

Responsibilities:

- create report groups
- configure topic name
- configure quota and period
- manage membership commitments
- update Merkle root / Semaphore group

### Report Registry

Responsibilities:

- verify proof
- check nullifier
- store report metadata
- emit report submitted events

### Access Control

Responsibilities:

- company admin permissions
- platform operator permissions
- validator permissions
- emergency pause / incident response

## 10. Roadmap

### Phase 1: Stabilize Current PoC

- Keep Amoy support for public demo.
- Keep local Hardhat flow for development.
- Keep private IPFS cluster folder.
- Improve frontend labels and operator guidance.
- Make report list and Admin decrypt workflow stable.

### Phase 2: Multi-Company Data Model

- Add `companyId`.
- Add company registry contract.
- Add company admin public key per company.
- Add company-level report filtering in frontend.

### Phase 3: Multi-Group / Topic Support

- Add `ReportGroup`.
- Support multiple group IDs per company.
- Add topic configuration:
  - topic name
  - start/end time
  - max reports per member
  - period

### Phase 4: Quota and Nullifier Scope

- Add `reportSlot`.
- Add period-based scope.
- Store used nullifiers.
- Show remaining quota in frontend where possible.

### Phase 5: Burner Wallet Submission

- Frontend generates burner wallet locally.
- Frontend signs transaction using burner wallet.
- Configure permissioned chain RPC with gasPrice=0.
- Remove requirement for employee personal wallet in the reporting flow.
- Keep Admin wallet flow for company management and decryption.

### Phase 6: Consortium Chain Deployment

- Select chain stack:
  - Hyperledger Besu
  - Quorum
  - Polygon Edge style permissioned chain
  - other EVM-compatible permissioned chain
- Configure validator nodes.
- Configure permissioned RPC access.
- Configure monitoring and backups.

### Phase 7: Production Privacy and Operations

- Add abuse prevention and rate limits.
- Add notification workflow for Admin.
- Add audit dashboard.
- Add key rotation and recovery policy.
- Add employee onboarding/offboarding.
- Add company subscription and tenant management.

## 11. Open Questions

- Should `contentHash` be hash of ciphertext or plaintext?
- Should employee ZK identity be generated fully by employee or assisted by company onboarding?
- How should companies revoke membership after employee leaves?
- Should reports allow attachments?
- Should Admin decryption happen only in browser or through a secured admin tool?
- Should third-party investigators have delegated decrypt access?
- How should private IPFS nodes be shared across companies?
- How much network-level anonymity is required beyond ZK identity privacy?


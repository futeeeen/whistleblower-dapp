# Private IPFS Cluster for Encrypted Reports

This folder runs a private IPFS network for encrypted whistleblower report payloads.

The blockchain should store only:

- `ipfsCID`: where the encrypted payload is stored in private IPFS
- `contentHash`: `sha256:<hex>` of the encrypted payload

The encrypted report body itself is pinned in private IPFS through IPFS Cluster.

## Architecture

- `ipfs0`, `ipfs1`: private Kubo IPFS nodes sharing the same `swarm.key`
- `cluster0`, `cluster1`: IPFS Cluster peers using the same `CLUSTER_SECRET`
- `cluster0` REST API: `http://127.0.0.1:9094`
- `ipfs0` gateway: `http://127.0.0.1:8080/ipfs/<CID>`

Because the IPFS nodes share a private swarm key, nodes outside this private network cannot join or fetch content directly from the private swarm.

## First-Time Setup

Open Docker Desktop first. The Docker daemon must be running.

Generate private network secrets:

```powershell
cd <your-repo-path>\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\generate-secrets.ps1
```

This creates:

- `secrets/swarm.key`
- `.env`

Keep both private. Any machine that should join this private IPFS network must use the same `swarm.key` and compatible Cluster secret.

## Start Network

After rebooting your computer, Docker Desktop / Docker daemon must be running before containers can start.

Recommended one-command startup:

```powershell
cd <your-repo-path>\private-ipfs-cluster
npm start
```

This runs `scripts/start-ipfs.ps1`, which will:

1. check whether Docker daemon is ready,
2. try to open Docker Desktop if Docker is not ready,
3. wait for Docker daemon,
4. start the private IPFS containers.

Manual startup:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Check Docker daemon:

```powershell
docker info
```

Then start the private IPFS network:

```powershell
cd <your-repo-path>\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\start-private-network.ps1
```

Check Cluster API:

```powershell
npm run health
```

Check running containers:

```powershell
docker ps --filter "name=whistleblower"
```

Expected containers:

```text
whistleblower-ipfs0
whistleblower-ipfs1
whistleblower-cluster0
whistleblower-cluster1
```

Stop network:

```powershell
cd <your-repo-path>\private-ipfs-cluster
powershell -ExecutionPolicy Bypass -File scripts\stop-private-network.ps1
```

## Docker Desktop Notes

If Docker Desktop looks like nothing is running, check the `Containers` page and search for:

```text
whistleblower
```

The `Images` or `Volumes` pages may show `In use`, which means an image or volume is being used by a running container. The clearest way to see active containers is:

```powershell
docker ps
```

If `docker ps` shows the four `whistleblower-*` containers as `Up`, the IPFS server is running even if Docker Desktop UI is on a different tab or filter.

## Frontend Settings

Use this value in the DApp Control Panel:

```text
Private IPFS Gateway: http://127.0.0.1:8080
```

Then click:

```text
Check IPFS
```

If an `ipfsCID` is filled in the Employee form, the check will also try to read:

```text
http://127.0.0.1:8080/ipfs/<CID>
```

## Upload Encrypted Report

Upload from a file:

```bash
npm run upload -- --file=./shared/encrypted-report.txt
```

Upload from text:

```bash
npm run upload -- --text="encrypted payload"
```

Output example:

```json
{
  "ipfsCID": "bafy...",
  "contentHash": "sha256:...",
  "bytes": 123,
  "clusterApi": "http://127.0.0.1:9094"
}
```

Store only `ipfsCID` and `contentHash` on-chain.

## Admin Fetch and Decrypt

The Admin UI can use the private IPFS gateway to retrieve encrypted content by CID:

```text
http://127.0.0.1:8080/ipfs/<CID>
```

After the encrypted payload is fetched, MetaMask `eth_decrypt` uses the Admin wallet private key to decrypt it locally in the browser. Employees can see the CID and hash, but without the Admin private key they cannot read the plaintext.

## How This Fits the Whistleblower DApp

1. Employee encrypts report content with Admin public key.
2. Encrypted content is uploaded to this private IPFS Cluster.
3. Upload script returns `ipfsCID` and `contentHash`.
4. DApp submits `ipfsCID`, `contentHash`, and Semaphore proof on-chain.
5. Admin later fetches encrypted content from private IPFS and decrypts it with MetaMask.

## Important Notes

- IPFS privacy here means the swarm is private. Anyone with the same `swarm.key` can join the network.
- Do not commit `.env` or `secrets/swarm.key`.
- For multi-machine use, copy the same `swarm.key` to each authorized node and expose/connect the swarm ports intentionally.
- IPFS Cluster helps coordinate pinning. The actual private boundary comes from Kubo private network `swarm.key`.

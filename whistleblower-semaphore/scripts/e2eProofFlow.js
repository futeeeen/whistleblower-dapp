const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");
const { decrypt, encrypt, getEncryptionPublicKey } = require("@metamask/eth-sig-util");
const REPORT_CREDENTIAL_MESSAGE_TAG = "REPORT_CREDENTIAL_V1";

function readEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function loadIpfsConfig() {
  const envPath = path.resolve(__dirname, "../../private-ipfs-cluster/.env");
  const envText = await readFile(envPath, "utf8");
  const env = readEnv(envText);
  return {
    apiUrl: env.CLUSTER_API_URL || "http://127.0.0.1:9094",
    gatewayUrl: env.IPFS_GATEWAY_URL || "http://127.0.0.1:8080",
    user: env.CLUSTER_API_USER || "admin",
    password: env.CLUSTER_API_PASSWORD || ""
  };
}

function sha256Hex(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function toHexEncryptedPayload(encryptedData) {
  return `0x${Buffer.from(JSON.stringify(encryptedData), "utf8").toString("hex")}`;
}

function fromHexEncryptedPayload(hexPayload) {
  const normalized = hexPayload.startsWith("0x") ? hexPayload.slice(2) : hexPayload;
  return JSON.parse(Buffer.from(normalized, "hex").toString("utf8"));
}

async function uploadEncryptedPayload(encryptedPayload) {
  const { apiUrl, user, password } = await loadIpfsConfig();
  if (!password) throw new Error("Missing CLUSTER_API_PASSWORD in private-ipfs-cluster/.env");

  const form = new FormData();
  form.append("file", new Blob([encryptedPayload], { type: "text/plain" }), "e2e-encrypted-report.txt");

  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const response = await fetch(`${apiUrl}/add?cid-version=1&replication-min=1&replication-max=2`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form
  });

  if (!response.ok) {
    throw new Error(`IPFS Cluster upload failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const cid = result.cid?.["/"] || result.cid || result.Cid || result.Name || "";
  if (!cid) throw new Error(`IPFS Cluster upload returned no CID: ${JSON.stringify(result)}`);

  return { cid, apiUrl };
}

async function fetchFromGateway(cid) {
  const { gatewayUrl } = await loadIpfsConfig();
  const response = await fetch(`${gatewayUrl.replace(/\/+$/, "")}/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS Gateway fetch failed: ${response.status} ${await response.text()}`);
  }
  return response.text();
}

function buildSolidityProof(proof) {
  return {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: proof.merkleTreeRoot.toString(),
    nullifier: proof.nullifier.toString(),
    message: proof.message.toString(),
    scope: proof.scope.toString(),
    points: proof.points
  };
}

function encodeScope(companyId, reportGroupId, period, reportSlot) {
  return hre.ethers.BigNumber.from(
    hre.ethers.utils.keccak256(
      hre.ethers.utils.solidityPack(
        ["uint256", "uint256", "string", "uint256"],
        [companyId, reportGroupId, period, reportSlot]
      )
    )
  ).toString();
}

function encodeCredentialMessage(companyId, reportGroupId, period, reportSlot) {
  return hre.ethers.BigNumber.from(
    hre.ethers.utils.keccak256(
      hre.ethers.utils.solidityPack(
        ["uint256", "uint256", "string", "uint256", "string"],
        [companyId, reportGroupId, period, reportSlot, REPORT_CREDENTIAL_MESSAGE_TAG]
      )
    )
  ).toString();
}

async function generateProofWithTimeout(generateProof, identity, group, message, scope, label) {
  const timeoutMs = Number(process.env.E2E_PROOF_TIMEOUT_MS || "120000");
  const childPath = path.resolve(__dirname, "generateSemaphoreProofChild.js");
  console.log(`step - generating Semaphore proof: ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [childPath], {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Semaphore proof generation timed out after ${timeoutMs}ms (${label})`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `Proof child exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not parse proof child output: ${error.message}\n${stdout}`));
      }
    });

    child.stdin.end(JSON.stringify({
      identityExport: identity.export(),
      members: group.members.map((member) => member.toString()),
      message,
      scope
    }));
  });
}

async function expectRevert(label, action) {
  try {
    await action();
  } catch (error) {
    console.log(`ok - ${label}: ${error.reason || error.message.split("\n")[0]}`);
    return;
  }
  throw new Error(`Expected revert did not happen: ${label}`);
}

async function main() {
  const { Identity } = await import("@semaphore-protocol/identity");
  const { Group } = await import("@semaphore-protocol/group");
  const { generateProof } = await import("@semaphore-protocol/proof");

  console.log("E2E proof test started");

  const [owner] = await hre.ethers.getSigners();

  const PoseidonT3 = await hre.ethers.getContractFactory("PoseidonT3");
  const poseidonT3 = await PoseidonT3.deploy();
  await poseidonT3.deployed();

  const Verifier = await hre.ethers.getContractFactory("LocalSemaphoreVerifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();

  const Semaphore = await hre.ethers.getContractFactory("LocalSemaphore", {
    libraries: { PoseidonT3: poseidonT3.address }
  });
  const semaphore = await Semaphore.deploy(verifier.address);
  await semaphore.deployed();

  const App = await hre.ethers.getContractFactory("EmployeeSemaphoreWhistleblower");
  const app = await App.deploy(semaphore.address);
  await app.deployed();
  console.log(`ok - deployed app: ${app.address}`);

  const adminPrivateKey = "1".repeat(64);
  const adminPublicKey = getEncryptionPublicKey(adminPrivateKey);
  const companyTx = await app.createCompany("E2E Company", adminPublicKey, owner.address);
  const companyReceipt = await companyTx.wait();
  const companyId = Number(companyReceipt.events.find((event) => event.event === "CompanyCreated").args.companyId);
  console.log(`ok - company created: companyId=${companyId}`);

  const now = Math.floor(Date.now() / 1000);
  const maxReportsPerMember = 2;
  const groupTx = await app.createReportGroup(companyId, "E2E Financial Fraud", maxReportsPerMember, now - 60, now + 86400);
  const groupReceipt = await groupTx.wait();
  const groupEvent = groupReceipt.events.find((event) => event.event === "ReportGroupCreated");
  const reportGroupId = Number(groupEvent.args.reportGroupId);
  const semaphoreGroupId = Number(groupEvent.args.semaphoreGroupId);
  console.log(`ok - report group created: reportGroupId=${reportGroupId}, semaphoreGroupId=${semaphoreGroupId}`);

  const company = await app.companies(companyId);
  if (company.adminPublicKey !== adminPublicKey) throw new Error("Company admin public key mismatch");
  console.log("ok - company-specific admin public key is on-chain");

  const employeeIdentity = new Identity();
  const commitment = employeeIdentity.commitment.toString();
  await (await app.addEmployeeMember(reportGroupId, commitment)).wait();
  console.log(`ok - employee commitment added: ${commitment}`);

  const group = new Group([commitment]);
  const period = "2026-Q2";

  async function buildReport(reportSlot, plaintext) {
    const encryptedData = encrypt({
      publicKey: adminPublicKey,
      data: plaintext,
      version: "x25519-xsalsa20-poly1305"
    });
    const encryptedPayload = toHexEncryptedPayload(encryptedData);
    const contentHash = `sha256:${sha256Hex(encryptedPayload)}`;
    const { cid } = await uploadEncryptedPayload(encryptedPayload);
    const fetchedPayload = await fetchFromGateway(cid);
    if (fetchedPayload !== encryptedPayload) throw new Error("IPFS gateway payload mismatch");

    const decrypted = decrypt({
      encryptedData: fromHexEncryptedPayload(fetchedPayload),
      privateKey: adminPrivateKey
    });
    if (decrypted !== plaintext) throw new Error("Admin decrypt mismatch");

    const message = encodeCredentialMessage(companyId, reportGroupId, period, reportSlot);
    const scope = encodeScope(companyId, reportGroupId, period, reportSlot);
    const proof = await generateProofWithTimeout(generateProof, employeeIdentity, group, message, scope, `slot=${reportSlot}`);

    return {
      request: { companyId, reportGroupId, ipfsCID: cid, contentHash, period, reportSlot },
      proof: buildSolidityProof(proof),
      encryptedPayload,
      plaintext
    };
  }

  const reportOne = await buildReport(1, "E2E report #1 - encrypted through company public key");
  console.log(`ok - encrypted payload uploaded to private IPFS: ${reportOne.request.ipfsCID}`);

  const burner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const burnerContract = app.connect(burner);
  const submitOne = await burnerContract.submitAnonymousReport(reportOne.request, reportOne.proof, { gasPrice: 0 });
  await submitOne.wait();
  console.log(`ok - burner submitted report #1 with gasPrice=0: burner=${burner.address}`);

  const storedOne = await app.reports(1);
  if (storedOne.ipfsCID !== reportOne.request.ipfsCID) throw new Error("Stored report #1 CID mismatch");
  if (storedOne.contentHash !== reportOne.request.contentHash) throw new Error("Stored report #1 contentHash mismatch");
  if (storedOne.submittedBy !== burner.address) throw new Error("Stored report #1 burner address mismatch");
  console.log("ok - on-chain report #1 metadata matches IPFS/proof request");

  await expectRevert("replay with same nullifier is blocked", async () => {
    await (await burnerContract.submitAnonymousReport(reportOne.request, reportOne.proof, { gasPrice: 0 })).wait();
  });

  const reportTwo = await buildReport(2, "E2E report #2 - allowed by quota slot 2");
  await (await burnerContract.submitAnonymousReport(reportTwo.request, reportTwo.proof, { gasPrice: 0 })).wait();
  console.log("ok - same employee can submit a second report with reportSlot=2");

  const reportThree = await buildReport(3, "E2E report #3 - should exceed quota");
  await expectRevert("reportSlot beyond group quota is rejected", async () => {
    await (await burnerContract.submitAnonymousReport(reportThree.request, reportThree.proof, { gasPrice: 0 })).wait();
  });

  const outsider = new Identity();
  await expectRevert("non-member identity cannot generate a valid group proof", async () => {
    const message = encodeCredentialMessage(companyId, reportGroupId, period, 1);
    const scope = encodeScope(companyId, reportGroupId, period, 1);
    await generateProof(outsider, group, message, scope);
  });

  const reportCount = await app.reportCount();
  if (reportCount.toString() !== "2") throw new Error(`Expected 2 accepted reports, got ${reportCount.toString()}`);
  console.log("ok - final accepted reportCount=2");

  console.log("E2E proof test passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

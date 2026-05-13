import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Buffer } from "buffer";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import appArtifact from "./EmployeeSemaphoreWhistleblower.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const LOCAL_CHAIN_HEX = "0x7a69";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const AMOY_CHAIN_HEX = "0x13882";
const AMOY_RPC_URL = "https://rpc-amoy.polygon.technology";
const REPORT_CREDENTIAL_MESSAGE_TAG = "REPORT_CREDENTIAL_V1";

function App() {
  const [activeTab, setActiveTab] = useState("admin");
  const [showPanel, setShowPanel] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [lang, setLang] = useState("zh");
  const [loading, setLoading] = useState({});
  const [toasts, setToasts] = useState([]);

  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [diag, setDiag] = useState("");

  const [newMemberCommitment, setNewMemberCommitment] = useState("");
  const [removeMemberCommitment, setRemoveMemberCommitment] = useState("");
  const [members, setMembers] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [companyId, setCompanyId] = useState("1");
  const [companyName, setCompanyName] = useState("");
  const [reportGroupId, setReportGroupId] = useState("1");
  const [topicName, setTopicName] = useState("");
  const [maxReportsPerMember, setMaxReportsPerMember] = useState("1");
  const [period, setPeriod] = useState("2026-Q1");
  const [reportSlot, setReportSlot] = useState("1");
  const [proofScope, setProofScope] = useState("");
  const [proofArtifacts, setProofArtifacts] = useState(null);
  const [proofArtifactsStatus, setProofArtifactsStatus] = useState("not loaded");
  const [preparedCredentialContext, setPreparedCredentialContext] = useState("");

  const [identityExport, setIdentityExport] = useState("");
  const [identityCommitment, setIdentityCommitment] = useState("");
  const [reporterIdentityExport, setReporterIdentityExport] = useState("");
  const [reporterCommitmentPreview, setReporterCommitmentPreview] = useState("");

  const [ipfsCID, setIpfsCID] = useState("");
  const [reportPlaintext, setReportPlaintext] = useState("");
  const [messageHash, setMessageHash] = useState("");
  const [encryptedReport, setEncryptedReport] = useState("");
  const [proofJson, setProofJson] = useState("");
  const [submitMode, setSubmitMode] = useState("metamask");
  const [burnerRpcUrl, setBurnerRpcUrl] = useState(LOCAL_RPC_URL);
  const [lastBurnerAddress, setLastBurnerAddress] = useState("");
  const [ipfsClusterApi, setIpfsClusterApi] = useState("http://127.0.0.1:9094");
  const [ipfsClusterUser, setIpfsClusterUser] = useState("admin");
  const [ipfsClusterPassword, setIpfsClusterPassword] = useState("");

  const [adminEncryptionPubKey, setAdminEncryptionPubKey] = useState("");
  const [ipfsGateway, setIpfsGateway] = useState("http://127.0.0.1:8080");
  const [reports, setReports] = useState([]);
  const [reportStatusDrafts, setReportStatusDrafts] = useState({});
  const [threadSecretKey, setThreadSecretKey] = useState("");
  const [threadReportId, setThreadReportId] = useState("");
  const [threadMessages, setThreadMessages] = useState({});
  const [adminReplyDrafts, setAdminReplyDrafts] = useState({});
  const [reporterReplyText, setReporterReplyText] = useState("");

  const canUse = useMemo(() => !!window.ethereum && !!CONTRACT_ADDRESS, []);
  const canRead = !!CONTRACT_ADDRESS && (!!window.ethereum || submitMode === "burner");
  const credentialContext = `${companyId.trim() || "-"}:${reportGroupId.trim() || "-"}:${period.trim() || "-"}:${reportSlot.trim() || "-"}`;
  const helpCopy = {
    zh: {
      title: "使用說明",
      intro: "這個工具分成 Admin 與 Employee。Admin 管理公司、群組、員工 commitment 與解密公鑰；Employee 先準備匿名憑證，再送出加密舉報。",
      quick: [
        "Admin 連接錢包，建立公司與舉報主題。",
        "Admin 取得並設定 Admin 加密公鑰到鏈上。",
        "Employee 產生 Identity，只把 commitment 交給 Admin 加入群組。",
        "Employee 進入頁面後先預載 proving artifacts，並產生匿名憑證。",
        "真正舉報時只加密內容、上傳 Private IPFS，然後使用已準備好的憑證送出。"
      ],
      adminKeyTitle: "Admin 加密公鑰按鈕",
      adminKey: [
        "取得 Admin 加密公鑰：向 MetaMask 取得目前 Admin 帳號的公開加密公鑰。這不是私鑰，可以公開。",
        "設定 Admin 加密公鑰到鏈上：把公鑰寫入合約，讓員工前端依 companyId 自動加密。",
        "只有 Admin 的 MetaMask 私鑰可以解密 IPFS 上的密文內容。"
      ],
      employeeTitle: "Employee 流程",
      employee: [
        "Generate Identity 會產生 privateKey(base64) 與 commitment。",
        "Preload proof artifacts 會先載入 proving wasm/zkey，減少送出時等待。",
        "Prepare anonymous credential 會先產生資格 proof，證明自己屬於目前 company/group/period/slot。",
        "Encrypt + upload report 只負責加密內容、計算 hash，burner 模式會自動上傳 Private IPFS。",
        "Submit Anonymous Report 使用已準備好的匿名憑證，不會重新產生 proof。"
      ],
      reportsTitle: "舉報與解密",
      reports: [
        "Admin 與 Employee 都可以查詢鏈上 metadata。",
        "Employee 只能看到 ipfsCID、hash、nullifier 等資料，不能看到明文。",
        "Admin 可用 Decrypt / Decrypt All 從 IPFS 取回密文並解密。"
      ]
    },
    en: {
      title: "How to use",
      intro: "The tool has Admin and Employee roles. Admin manages companies, groups, commitments, and encryption keys. Employee prepares an anonymous credential before submitting an encrypted report.",
      quick: [
        "Admin connects wallet, creates company and report group.",
        "Admin gets and sets the Admin encryption public key on-chain.",
        "Employee generates an identity and gives only the commitment to Admin.",
        "Employee preloads proving artifacts and prepares an anonymous credential first.",
        "During report submission, the frontend only encrypts/uploads the report and reuses the prepared credential."
      ],
      adminKeyTitle: "Admin encryption key buttons",
      adminKey: [
        "Get Admin Encryption PubKey asks MetaMask for the current Admin account encryption public key. It is public, not private.",
        "Set Admin Encryption PubKey writes that key to the selected companyId so employees encrypt to that company's Admin key.",
        "Only the Admin MetaMask private key can decrypt the ciphertext from IPFS."
      ],
      employeeTitle: "Employee flow",
      employee: [
        "Generate Identity creates a privateKey(base64) and commitment.",
        "Preload proof artifacts loads proving wasm/zkey early to reduce submit-time waiting.",
        "Prepare anonymous credential proves membership for the current company/group/period/slot.",
        "Encrypt + upload report encrypts content, computes hash, and auto-uploads to Private IPFS in burner mode.",
        "Submit Anonymous Report reuses the prepared credential and does not regenerate proof."
      ],
      reportsTitle: "Reports and decryption",
      reports: [
        "Both Admin and Employee can load on-chain metadata.",
        "Employee can only see ipfsCID, hash, nullifier, and metadata, not plaintext.",
        "Admin can use Decrypt or Decrypt All to fetch ciphertext by ipfsCID and decrypt with MetaMask."
      ]
    }
  }[lang];

  const t = {
    zh: {
      title: "Semaphore 員工匿名舉報系統",
      control: "控制面板",
      saasAdmin: "SaaS Admin",
      admin: "Admin",
      employee: "Employee",
      connect: "連接錢包",
      local: "連到本機",
      amoy: "連到 Amoy",
      check: "檢查合約",
      ipfsCheck: "檢查 IPFS",
      gid: "讀取 Group ID",
      members: "載入成員",
      addEmployee: "加入員工",
      removeEmployee: "移除離職員工",
      createCompany: "建立公司",
      createGroup: "建立舉報主題",
      genIdentity: "產生 Identity",
      importIdentity: "匯入 Identity",
      previewReporter: "預覽 Reporter Commitment",
      getAdminPub: "取得 Admin 加密公鑰",
      setAdminPub: "設定公司 Admin 公鑰",
      genProof: "加密並上傳舉報",
      submit: "送出匿名舉報",
      submitMode: "送出方式",
      metamaskMode: "使用 MetaMask 錢包",
      burnerMode: "使用匿名 burner wallet",
      loadReports: "查詢所有鏈上舉報",
      loadCompanyReports: "查詢本公司舉報",
      updateStatus: "更新狀態",
      decrypt: "解密",
      decryptAll: "全部解密",
      loadThread: "載入案件對話",
      sendReply: "送出回覆",
      status: "狀態"
    },
    en: {
      title: "Semaphore Employee Whistleblower",
      control: "Control Panel",
      saasAdmin: "SaaS Admin",
      admin: "Admin",
      employee: "Employee",
      connect: "Connect Wallet",
      local: "Switch Local",
      amoy: "Switch Amoy",
      check: "Check Contract",
      ipfsCheck: "Check IPFS",
      gid: "Load Group ID",
      members: "Load Members",
      addEmployee: "Add Employee",
      removeEmployee: "Remove Ex-Employee",
      createCompany: "Create Company",
      createGroup: "Create Report Group",
      genIdentity: "Generate Identity",
      importIdentity: "Import Identity",
      previewReporter: "Preview Reporter Commitment",
      getAdminPub: "Get Admin Encryption PubKey",
      setAdminPub: "Set Company Admin PubKey",
      genProof: "Encrypt + Upload Report",
      submit: "Submit Anonymous Report",
      submitMode: "Submit Mode",
      metamaskMode: "Use MetaMask wallet",
      burnerMode: "Use anonymous burner wallet",
      loadReports: "Load All Reports",
      loadCompanyReports: "Load Company Reports",
      updateStatus: "Update Status",
      decrypt: "Decrypt",
      decryptAll: "Decrypt All",
      loadThread: "Load Thread",
      sendReply: "Send Reply",
      status: "Status"
    }
  }[lang];

  function pushToast(kind, msg) {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, kind, msg }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
  }

  function parseErr(err) {
    return err?.data?.message || err?.reason || err?.message || "unknown error";
  }

  async function withLoading(key, fn) {
    setLoading((p) => ({ ...p, [key]: true }));
    try { await fn(); } finally { setLoading((p) => ({ ...p, [key]: false })); }
  }

  async function safeRun(fn) {
    try {
      await fn();
    } catch (e) {
      const m = parseErr(e);
      setStatus(m);
      pushToast("error", m);
    }
  }

  function getProvider() { return new ethers.providers.Web3Provider(window.ethereum); }
  function getSignerContract() { return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, getProvider().getSigner()); }
  function getBurnerProvider() { return new ethers.providers.JsonRpcProvider(burnerRpcUrl.trim() || LOCAL_RPC_URL); }
  function getReadProvider() { return submitMode === "burner" ? getBurnerProvider() : getProvider(); }
  function getReadContract() { return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, getReadProvider()); }
  function reportStatusLabel(status) {
    return ["Submitted", "Reviewing", "Confirmed", "Rejected", "Closed"][Number(status)] || "Unknown";
  }

  function getProofDepth() {
    if (!members.length) return 1;
    const group = new Group(members);
    return group.depth || 1;
  }

  function buildCredentialScope() {
    return ethers.BigNumber.from(
      ethers.utils.keccak256(ethers.utils.solidityPack(
        ["uint256", "uint256", "string", "uint256"],
        [companyId.trim(), reportGroupId.trim(), period.trim(), reportSlot.trim()]
      ))
    ).toString();
  }

  function buildCredentialMessage() {
    return ethers.BigNumber.from(
      ethers.utils.keccak256(ethers.utils.solidityPack(
        ["uint256", "uint256", "string", "uint256", "string"],
        [companyId.trim(), reportGroupId.trim(), period.trim(), reportSlot.trim(), REPORT_CREDENTIAL_MESSAGE_TAG]
      ))
    ).toString();
  }

  async function preloadProofArtifacts() {
    const depth = getProofDepth();
    setProofArtifactsStatus(`loading depth=${depth}`);
    const { maybeGetSnarkArtifacts, Project } = await import("@zk-kit/artifacts");
    const artifacts = await maybeGetSnarkArtifacts(Project.SEMAPHORE, {
      parameters: [depth],
      version: "4.13.0"
    });

    // Warm the browser cache before the user starts proof generation.
    const warmCache = async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`artifact fetch failed: ${response.status}`);
        return response;
      } finally {
        clearTimeout(timeout);
      }
    };
    await Promise.all([warmCache(artifacts.wasm), warmCache(artifacts.zkey)]);
    setProofArtifacts(artifacts);
    setProofArtifactsStatus(`ready depth=${depth}`);
    setStatus(`Proof artifacts ready depth=${depth}`);
    pushToast("success", "Proof artifacts ready");
    return artifacts;
  }

  useEffect(() => {
    if (activeTab !== "employee" || proofArtifacts || proofArtifactsStatus.startsWith("loading")) return;
    preloadProofArtifacts().catch((error) => {
      const msg = parseErr(error);
      setProofArtifactsStatus(`failed: ${msg}`);
    });
  }, [activeTab, members.length]);

  async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }

  function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  function generateThreadSecretKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  async function importThreadAesKey(secretKey) {
    return crypto.subtle.importKey("raw", base64ToBytes(secretKey.trim()), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  async function encryptWithThreadKey(secretKey, plainText) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const key = await importThreadAesKey(secretKey);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));
    return { alg: "AES-256-GCM", iv: bytesToBase64(iv), ciphertext: bytesToBase64(cipher) };
  }

  async function decryptWithThreadKey(secretKey, cipherBox) {
    const key = await importThreadAesKey(secretKey);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(cipherBox.iv) }, key, base64ToBytes(cipherBox.ciphertext));
    return new TextDecoder().decode(plain);
  }

  async function buildThreadPayload({ type, plainText, secretKey, encryptedKey = "", reportId = "", senderRole = "" }) {
    const cipher = await encryptWithThreadKey(secretKey, plainText);
    const payload = JSON.stringify({
      version: "thread-hybrid-v1",
      type,
      reportId,
      senderRole,
      encryptedKey,
      cipher,
      createdAt: new Date().toISOString()
    });
    return { payload, contentHash: `sha256:${await sha256Hex(payload)}` };
  }

  async function encryptWithAdminPubKey(pubKey, plainText) {
    const { encrypt } = await import("@metamask/eth-sig-util");
    const enc = encrypt({ publicKey: pubKey, data: plainText, version: "x25519-xsalsa20-poly1305" });
    const hex = "0x" + Buffer.from(JSON.stringify(enc), "utf8").toString("hex");
    return hex;
  }

  async function uploadEncryptedReportToIpfs(encryptedPayload) {
    const api = ipfsClusterApi.trim().replace(/\/+$/, "");
    if (!api) throw new Error("Please enter IPFS Cluster API URL");
    if (!ipfsClusterUser.trim() || !ipfsClusterPassword.trim()) {
      throw new Error("Please enter IPFS Cluster user/password from private-ipfs-cluster/.env");
    }

    const form = new FormData();
    form.append("file", new Blob([encryptedPayload], { type: "text/plain" }), "encrypted-report.txt");

    const auth = btoa(`${ipfsClusterUser.trim()}:${ipfsClusterPassword}`);
    const response = await fetch(`${api}/add?cid-version=1&replication-min=1&replication-max=2`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: status=${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    const cid = result.cid?.["/"] || result.cid || result.Cid || result.Name || "";
    if (!cid) throw new Error("IPFS upload succeeded but no CID returned");
    return cid;
  }

  async function connectWallet() {
    if (!window.ethereum) throw new Error("隢?摰? MetaMask");
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWallet(account || "");
    setStatus("Wallet connected");
    pushToast("success", "Wallet connected");
  }

  async function switchToLocal() {
    if (!window.ethereum) throw new Error("隢?摰? MetaMask");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: LOCAL_CHAIN_HEX }] });
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: LOCAL_CHAIN_HEX, chainName: "Hardhat Local 31337", rpcUrls: [LOCAL_RPC_URL], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }] });
      } else throw e;
    }
    setStatus("Switched to local network");
    pushToast("success", "Switched to local");
  }

  async function switchToAmoy() {
    if (!window.ethereum) throw new Error("隢?摰? MetaMask");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: AMOY_CHAIN_HEX }] });
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: AMOY_CHAIN_HEX, chainName: "Polygon Amoy Testnet", rpcUrls: [AMOY_RPC_URL], nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, blockExplorerUrls: ["https://amoy.polygonscan.com"] }] });
      } else throw e;
    }
    setStatus("Switched to Amoy");
    pushToast("success", "Switched to Amoy");
  }

  async function checkContractHealth() {
    if (!canRead) throw new Error("隢?閮剖????啣?嚗???burner 璅∪?閮剖? RPC");
    const provider = getReadProvider();
    const net = await provider.getNetwork();
    const code = await provider.getCode(CONTRACT_ADDRESS);
    const c = getReadContract();
    let ownerText = "read-failed";
    let gid = "read-failed";
    let pub = "read-failed";
    try { ownerText = await c.owner(); } catch {}
    try { gid = (await c.groupId()).toString(); } catch {}
    try { pub = await c.adminEncryptionPublicKey(); } catch {}
    setDiag(`chainId=${net.chainId} (${net.name}) | code=${code !== "0x" ? "yes" : "no"} | owner=${ownerText} | groupId=${gid} | adminPubKey=${pub ? "set" : "empty"}`);
    setStatus("Contract checked");
    pushToast("success", "Contract checked");
  }

  async function checkIpfsHealth() {
    const gateway = ipfsGateway.trim().replace(/\/+$/, "");
    if (!gateway) throw new Error("隢?閮剖? Private IPFS Gateway");

    const startedAt = performance.now();
    let gatewayText = "gateway=unreachable";
    let cidText = "cid=not-tested";

    try {
      const response = await fetch(gateway, { method: "GET", cache: "no-store" });
      gatewayText = `gateway=reachable status=${response.status}`;
    } catch (error) {
      throw new Error(`IPFS Gateway ?⊥????: ${parseErr(error)}`);
    }

    const cid = ipfsCID.trim();
    if (cid) {
      const response = await fetch(`${gateway}/ipfs/${cid}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`IPFS CID 霈?仃?? status=${response.status}`);
      }
      const text = await response.text();
      cidText = `cid=ok bytes=${text.length}`;
    }

    const elapsed = Math.round(performance.now() - startedAt);
    setDiag(`IPFS ${gatewayText} | ${cidText} | gateway=${gateway} | ${elapsed}ms`);
    setStatus("IPFS checked");
    pushToast("success", cid ? "IPFS CID reachable" : "IPFS gateway reachable");
  }

  async function loadGroupId() {
    const rg = await getReadContract().reportGroups(reportGroupId || "1");
    setGroupId(rg.semaphoreGroupId.toString());
    setCompanyId(rg.companyId.toString());
    setStatus("Report group loaded");
  }

  async function loadMembersFromEvents() {
    const c = getReadContract();
    const addFilter = reportGroupId ? c.filters.EmployeeMemberAdded(reportGroupId, null) : c.filters.EmployeeMemberAdded();
    const removeFilter = reportGroupId ? c.filters.EmployeeMemberRemoved(reportGroupId, null) : c.filters.EmployeeMemberRemoved();
    const [addLogs, removeLogs] = await Promise.all([
      c.queryFilter(addFilter, 0, "latest"),
      c.queryFilter(removeFilter, 0, "latest")
    ]);
    const events = [
      ...addLogs.map((log) => ({ log, type: "add" })),
      ...removeLogs.map((log) => ({ log, type: "remove" }))
    ].sort((a, b) => (a.log.blockNumber - b.log.blockNumber) || (a.log.logIndex - b.log.logIndex));
    const current = [];
    for (const event of events) {
      const commitment = event.log.args.identityCommitment.toString();
      const index = current.indexOf(commitment);
      if (event.type === "add" && index === -1) current.push(commitment);
      if (event.type === "remove" && index !== -1) current.splice(index, 1);
    }
    const list = current;
    setMembers(list);
    setStatus(`Loaded ${list.length} members for reportGroupId=${reportGroupId || "all"}`);
  }

  async function adminGetEncryptionPubKey() {
    if (!wallet) throw new Error("Please connect wallet first");
    const pub = await window.ethereum.request({ method: "eth_getEncryptionPublicKey", params: [wallet] });
    setAdminEncryptionPubKey(pub);
    setStatus("Got admin encryption public key");
    pushToast("success", "Got admin encryption public key");
  }

  async function adminSetEncryptionPubKey() {
    if (!adminEncryptionPubKey.trim()) throw new Error("Please get or enter Admin encryption public key first");
    if (!companyId.trim()) throw new Error("Please enter companyId");
    const tx = await getSignerContract().setCompanyAdminPublicKey(companyId.trim(), adminEncryptionPubKey.trim());
    await tx.wait();
    setStatus(`Company #${companyId.trim()} admin encryption public key set on-chain`);
    pushToast("success", "Company admin pubkey set");
  }

  function createIdentity() {
    const id = new Identity();
    const ex = id.export();
    const cm = id.commitment.toString();
    setIdentityExport(ex);
    setIdentityCommitment(cm);
    setReporterIdentityExport(ex);
    setReporterCommitmentPreview(cm);
    setStatus("Identity generated");
  }

  function importIdentity() {
    const id = Identity.import(identityExport.trim());
    setIdentityCommitment(id.commitment.toString());
    setStatus("Identity imported");
  }

  function previewReporter() {
    const id = Identity.import(reporterIdentityExport.trim());
    setReporterCommitmentPreview(id.commitment.toString());
    setStatus("Reporter commitment previewed");
  }

  async function adminAddEmployee() {
    const commitment = newMemberCommitment.trim();
    if (!commitment) throw new Error("Please enter employee commitment");
    if (!reportGroupId.trim()) throw new Error("Please enter reportGroupId");
    const tx = await getSignerContract().addEmployeeMember(reportGroupId.trim(), commitment);
    await tx.wait();
    setStatus("Employee added");
    pushToast("success", "Employee added");
  }

  async function adminRemoveEmployee() {
    const commitment = removeMemberCommitment.trim();
    if (!commitment) throw new Error("Please enter employee commitment to remove");
    if (!reportGroupId.trim()) throw new Error("Please enter reportGroupId");
    if (!members.length) throw new Error("Please load current members first");
    const group = new Group(members);
    const index = group.indexOf(commitment);
    if (index < 0) throw new Error("Commitment is not in the loaded member list");
    const proof = group.generateMerkleProof(index);
    const siblings = proof.siblings.map((sibling) => sibling.toString());
    const tx = await getSignerContract().removeEmployeeMember(reportGroupId.trim(), commitment, siblings);
    await tx.wait();
    setMembers((prev) => prev.filter((member) => member !== commitment));
    setStatus("Employee commitment removed");
    pushToast("success", "Employee removed");
  }

  async function adminCreateCompany() {
    const name = companyName.trim();
    if (!name) throw new Error("隢撓??company name");
    const adminAddress = wallet || await getProvider().getSigner().getAddress();
    const tx = await getSignerContract().createCompany(name, adminEncryptionPubKey.trim(), adminAddress);
    const receipt = await tx.wait();
    const evt = receipt.events?.find((e) => e.event === "CompanyCreated");
    const id = evt?.args?.companyId?.toString();
    if (id) setCompanyId(id);
    setStatus(`Company created${id ? `: ${id}` : ""}`);
    pushToast("success", "Company created");
  }

  async function adminCreateReportGroup() {
    if (!companyId.trim()) throw new Error("隢撓??companyId");
    if (!topicName.trim()) throw new Error("隢撓??topic name");
    const maxReports = Number(maxReportsPerMember || "0");
    if (!Number.isInteger(maxReports) || maxReports <= 0) throw new Error("maxReportsPerMember 敹?憭扳 0");
    const now = Math.floor(Date.now() / 1000);
    const end = now + 60 * 60 * 24 * 365;
    const tx = await getSignerContract().createReportGroup(companyId.trim(), topicName.trim(), maxReports, now, end);
    const receipt = await tx.wait();
    const evt = receipt.events?.find((e) => e.event === "ReportGroupCreated");
    const id = evt?.args?.reportGroupId?.toString();
    const semaphoreId = evt?.args?.semaphoreGroupId?.toString();
    if (id) setReportGroupId(id);
    if (semaphoreId) setGroupId(semaphoreId);
    setMembers([]);
    setStatus(`Report group created${id ? `: ${id}` : ""}`);
    pushToast("success", "Report group created");
  }

  async function prepareAnonymousCredential() {
    if (!reporterIdentityExport.trim()) throw new Error("Please enter reporter identity");
    if (!members.length) throw new Error("Please load group members first");
    if (!companyId.trim() || !reportGroupId.trim() || !period.trim() || !reportSlot.trim()) {
      throw new Error("Please enter companyId, reportGroupId, period, and reportSlot");
    }

    const c = getReadContract();
    const rg = await c.reportGroups(reportGroupId.trim());
    const gid = rg.semaphoreGroupId.toString();

    const identity = Identity.import(reporterIdentityExport.trim());
    setReporterCommitmentPreview(identity.commitment.toString());

    const group = new Group(members);
    const scope = buildCredentialScope();
    const message = buildCredentialMessage();
    const artifacts = proofArtifacts || await preloadProofArtifacts();
    const proof = await generateProof(identity, group, message, scope, getProofDepth(), artifacts);

    const solidityProof = {
      merkleTreeDepth: proof.merkleTreeDepth,
      merkleTreeRoot: proof.merkleTreeRoot.toString(),
      nullifier: proof.nullifier.toString(),
      message: proof.message.toString(),
      scope: proof.scope.toString(),
      points: proof.points
    };

    setProofJson(JSON.stringify(solidityProof, null, 2));
    setPreparedCredentialContext(credentialContext);
    setGroupId(gid);
    setProofScope(scope);
    setStatus("Anonymous credential prepared");
    pushToast("success", "Anonymous credential prepared");
  }

  async function generateProofAndEncrypt() {
    if (!reportPlaintext.trim()) throw new Error("Please enter report content");
    if (!proofJson.trim() || preparedCredentialContext !== credentialContext) {
      throw new Error("Please prepare an anonymous credential for the current company/group/period/slot first");
    }
    if (submitMode !== "burner" && !ipfsCID.trim()) {
      throw new Error("Please enter ipfsCID, or switch to burner wallet for automatic upload");
    }
    if (!companyId.trim() || !reportGroupId.trim()) throw new Error("Please enter companyId and reportGroupId");

    const c = getReadContract();
    const company = await c.companies(companyId.trim());
    const adminPub = company.adminPublicKey || await c.adminEncryptionPublicKey();
    if (!adminPub) throw new Error("Admin public key is not set");

    const secretKey = generateThreadSecretKey();
    const encryptedKey = await encryptWithAdminPubKey(adminPub, secretKey);
    const { payload: encrypted, contentHash } = await buildThreadPayload({
      type: "initial_report",
      plainText: reportPlaintext.trim(),
      secretKey,
      encryptedKey,
      senderRole: "reporter"
    });
    setThreadSecretKey(secretKey);
    setEncryptedReport(encrypted);
    let finalIpfsCID = ipfsCID.trim();

    if (submitMode === "burner") {
      finalIpfsCID = await uploadEncryptedReportToIpfs(encrypted);
      setIpfsCID(finalIpfsCID);
    }

    setMessageHash(contentHash);
    setStatus("Report encrypted and payload prepared. Save the thread secret key before leaving this page.");
    pushToast("success", "Report encrypted + uploaded");
  }

  async function submitAnonymousReport() {
    if (!proofJson.trim()) throw new Error("Please prepare an anonymous credential first");
    if (preparedCredentialContext !== credentialContext) {
      throw new Error("Anonymous credential does not match the current company/group/period/slot. Please regenerate it.");
    }
    if (!messageHash.trim()) throw new Error("Missing messageHash");

    const proof = JSON.parse(proofJson);
    const request = {
      companyId: companyId.trim(),
      reportGroupId: reportGroupId.trim(),
      ipfsCID: ipfsCID.trim(),
      contentHash: messageHash.trim(),
      period: period.trim(),
      reportSlot: reportSlot.trim()
    };
    let tx;

    if (submitMode === "burner") {
      const provider = getBurnerProvider();
      const network = await provider.getNetwork();
      if (network.chainId === 80002) {
        throw new Error("Amoy is a public testnet. Burner wallet still needs POL there. Use burner mode only on local/permissioned zero-gas chains.");
      }
      const burner = ethers.Wallet.createRandom().connect(provider);
      setLastBurnerAddress(burner.address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, burner);
      tx = await c.submitAnonymousReport(request, proof, { gasPrice: 0 });
    } else {
      tx = await getSignerContract().submitAnonymousReport(request, proof);
    }

    const receipt = await tx.wait();
    const evt = receipt.events?.find((e) => e.event === "AnonymousReportSubmitted");
    const submittedReportId = evt?.args?.reportId?.toString?.() || "";
    if (submittedReportId) setThreadReportId(submittedReportId);
    setStatus(`Anonymous report submitted via ${submitMode === "burner" ? "burner wallet" : "MetaMask"}`);
    pushToast("success", submitMode === "burner" ? "Report submitted by burner wallet" : "Report submitted");
  }

  async function loadAllReports(companyOnly = false) {
    const c = getReadContract();
    const total = Number((await c.reportCount()).toString());
    const list = [];
    for (let i = 1; i <= total; i++) {
      const r = await c.reports(i);
      if (companyOnly && r.companyId.toString() !== companyId.trim()) continue;
      const rs = await c.reportStatuses(i);
      list.push({
        id: Number(r.id),
        companyId: r.companyId.toString(),
        reportGroupId: r.reportGroupId.toString(),
        ipfsCID: r.ipfsCID,
        messageHash: r.contentHash || r.messageHash,
        period: r.period || "",
        reportSlot: r.reportSlot?.toString?.() || "",
        encryptedReport: r.encryptedReport || "",
        timestamp: Number(r.timestamp),
        nullifier: r.nullifier.toString(),
        message: r.message.toString(),
        scope: r.scope?.toString?.() || "",
        submittedBy: r.submittedBy || "",
        status: Number(rs.status || 0),
        statusNote: rs.note || "",
        statusUpdatedAt: Number(rs.updatedAt || 0),
        plainText: ""
      });
    }
    list.sort((a, b) => b.id - a.id);
    setReports(list);
    setStatus(`Loaded ${list.length}${companyOnly ? " company" : ""} reports`);
    pushToast("success", `Loaded ${list.length} reports`);
  }

  async function updateReportStatus(reportId) {
    const draft = reportStatusDrafts[reportId] || {};
    const status = Number(draft.status ?? 1);
    if (!Number.isInteger(status) || status < 0 || status > 4) throw new Error("Invalid report status");
    const note = draft.note || "";
    const tx = await getSignerContract().updateReportStatus(reportId, status, note);
    await tx.wait();
    setReports((prev) => prev.map((report) => (
      report.id === reportId
        ? { ...report, status, statusNote: note, statusUpdatedAt: Math.floor(Date.now() / 1000) }
        : report
    )));
    setStatus(`Report #${reportId} status updated`);
    pushToast("success", `Report #${reportId} status updated`);
  }

  async function decryptOne(reportId) {
    if (!wallet) throw new Error("隢??? Admin ?Ｗ?");
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;
    const encryptedPayload = await fetchEncryptedReportFromIpfs(target);
    let plain;
    let recoveredThreadKey = "";
    try {
      const payload = JSON.parse(encryptedPayload);
      if (payload.version === "thread-hybrid-v1" && payload.encryptedKey) {
        recoveredThreadKey = await window.ethereum.request({ method: "eth_decrypt", params: [payload.encryptedKey, wallet] });
        plain = await decryptWithThreadKey(recoveredThreadKey, payload.cipher);
      } else {
        plain = await window.ethereum.request({ method: "eth_decrypt", params: [encryptedPayload, wallet] });
      }
    } catch {
      plain = await window.ethereum.request({ method: "eth_decrypt", params: [encryptedPayload, wallet] });
    }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, plainText: plain, threadSecretKey: recoveredThreadKey || r.threadSecretKey || "" } : r)));
    if (recoveredThreadKey) setThreadSecretKey(recoveredThreadKey);
    pushToast("success", `Report #${reportId} decrypted`);
  }

  async function fetchEncryptedReportFromIpfs(report) {
    const cid = report.ipfsCID?.trim();
    const gateway = ipfsGateway.replace(/\/+$/, "");

    if (cid && gateway) {
      try {
        const response = await fetch(`${gateway}/ipfs/${cid}`);
        if (response.ok) {
          const text = (await response.text()).trim();
          if (text) return text;
        }
      } catch {
        // Fallback to the legacy on-chain encryptedReport field below.
      }
    }

    if (report.encryptedReport) return report.encryptedReport;
    throw new Error("Cannot fetch encrypted report from IPFS and no on-chain encryptedReport fallback exists.");
  }

  async function decryptAll() {
    for (const r of reports) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await decryptOne(r.id);
      } catch {
        // ignore per-report decrypt failure
      }
    }
    pushToast("success", "Decrypt-all finished");
  }

  async function loadReportMessages(reportId = threadReportId.trim()) {
    if (!reportId) throw new Error("Please enter reportId");
    const c = getReadContract();
    const filter = c.filters.ReportMessageAdded(null, reportId, null);
    const logs = await c.queryFilter(filter, 0, "latest");
    const messages = await Promise.all(logs.map(async (log) => {
      const id = log.args.messageId.toString();
      const m = await c.reportMessages(id);
      return {
        id: Number(m.id),
        reportId: m.reportId.toString(),
        senderRole: Number(m.senderRole),
        ipfsCID: m.ipfsCID,
        contentHash: m.contentHash,
        timestamp: Number(m.timestamp),
        submittedBy: m.submittedBy,
        plainText: ""
      };
    }));
    messages.sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
    setThreadMessages((prev) => ({ ...prev, [reportId]: messages }));
    setThreadReportId(reportId);
    pushToast("success", `Loaded ${messages.length} thread messages`);
    return messages;
  }

  async function decryptThreadMessages(reportId = threadReportId.trim(), key = threadSecretKey.trim()) {
    if (!reportId) throw new Error("Please enter reportId");
    if (!key) throw new Error("Please enter the thread secret key");
    const messages = threadMessages[reportId] || await loadReportMessages(reportId);
    const decrypted = [];
    for (const message of messages) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const payloadText = await fetchEncryptedReportFromIpfs(message);
        const payload = JSON.parse(payloadText);
        // eslint-disable-next-line no-await-in-loop
        const plainText = await decryptWithThreadKey(key, payload.cipher);
        decrypted.push({ ...message, plainText });
      } catch (error) {
        decrypted.push({ ...message, plainText: `(decrypt failed: ${parseErr(error)})` });
      }
    }
    setThreadMessages((prev) => ({ ...prev, [reportId]: decrypted }));
    pushToast("success", "Thread messages decrypted");
  }

  async function addThreadMessageOnChain(reportId, senderRole, text, key) {
    if (!reportId) throw new Error("Please enter reportId");
    if (!text.trim()) throw new Error("Please enter reply text");
    if (!key.trim()) throw new Error("Please enter thread secret key");
    const { payload, contentHash } = await buildThreadPayload({
      type: senderRole === 1 ? "admin_reply" : "reporter_reply",
      plainText: text.trim(),
      secretKey: key.trim(),
      reportId,
      senderRole: String(senderRole)
    });
    const cid = await uploadEncryptedReportToIpfs(payload);

    let tx;
    if (senderRole === 2 || submitMode === "burner") {
      const provider = getBurnerProvider();
      const network = await provider.getNetwork();
      if (network.chainId === 80002) throw new Error("Amoy burner replies still need POL. Use local/permissioned zero-gas RPC.");
      const burner = ethers.Wallet.createRandom().connect(provider);
      setLastBurnerAddress(burner.address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, burner);
      tx = await c.addReportMessage(reportId, senderRole, cid, contentHash, { gasPrice: 0 });
    } else {
      tx = await getSignerContract().addReportMessage(reportId, senderRole, cid, contentHash);
    }
    await tx.wait();
    await loadReportMessages(reportId);
    pushToast("success", "Thread reply submitted");
  }

  async function adminSendReply(reportId) {
    const report = reports.find((r) => r.id === reportId);
    const key = report?.threadSecretKey || threadSecretKey;
    const text = adminReplyDrafts[reportId] || "";
    await addThreadMessageOnChain(String(reportId), 1, text, key);
    setAdminReplyDrafts((prev) => ({ ...prev, [reportId]: "" }));
  }

  async function reporterSendReply() {
    await addThreadMessageOnChain(threadReportId.trim(), 2, reporterReplyText, threadSecretKey.trim());
    setReporterReplyText("");
  }

  const Btn = ({ label, k, onClick, primary = false, disabled = false }) => (
    <button
      style={{
        border: "1px solid " + (primary ? "#1d4ed8" : "#cbd5e1"),
        background: primary ? "#2563eb" : "#fff",
        color: primary ? "#fff" : "#111827",
        borderRadius: 10,
        padding: "8px 12px",
        fontWeight: 700,
        cursor: "pointer",
        opacity: disabled ? 0.55 : 1
      }}
      disabled={disabled || !!loading[k]}
      onClick={() => withLoading(k, () => safeRun(onClick))}
    >
      {loading[k] ? "??" : ""}{label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f3f6fb", padding: 16 }}>
      <div style={{ position: "fixed", right: 16, top: 16, zIndex: 9999, display: "grid", gap: 8 }}>
        {toasts.map((x) => (
          <div key={x.id} style={{ minWidth: 280, maxWidth: 420, borderRadius: 10, border: "1px solid " + (x.kind === "success" ? "#86efac" : "#fca5a5"), background: x.kind === "success" ? "#f0fdf4" : "#fef2f2", color: x.kind === "success" ? "#166534" : "#991b1b", padding: "10px 12px" }}>
            <strong>{x.kind === "success" ? "Success" : "Error"}</strong>
            <div>{x.msg}</div>
          </div>
        ))}
      </div>

      {showHelp ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 18 }}>
          <div style={{ width: "min(860px, 100%)", maxHeight: "86vh", overflow: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)" }}>
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{helpCopy.title}</h2>
              <button onClick={() => setShowHelp(false)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 10px", background: "#fff", cursor: "pointer" }}>
                {lang === "zh" ? "關閉" : "Close"}
              </button>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 14, lineHeight: 1.65, color: "#0f172a" }}>
              <p style={{ margin: 0 }}>{helpCopy.intro}</p>
              <section>
                <h3 style={{ margin: "0 0 6px" }}>{lang === "zh" ? "快速流程" : "Quick flow"}</h3>
                <ol style={{ margin: 0, paddingLeft: 22 }}>
                  {helpCopy.quick.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </section>
              <section>
                <h3 style={{ margin: "0 0 6px" }}>{helpCopy.adminKeyTitle}</h3>
                <ul style={{ margin: 0, paddingLeft: 22 }}>
                  {helpCopy.adminKey.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <section>
                <h3 style={{ margin: "0 0 6px" }}>{helpCopy.employeeTitle}</h3>
                <ul style={{ margin: 0, paddingLeft: 22 }}>
                  {helpCopy.employee.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <section>
                <h3 style={{ margin: "0 0 6px" }}>{helpCopy.reportsTitle}</h3>
                <ul style={{ margin: 0, paddingLeft: 22 }}>
                  {helpCopy.reports.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ maxWidth: 1320, margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0 }}>{t.title}</h1>
            <div style={{ marginTop: 6, color: "#475569" }}>Contract: {CONTRACT_ADDRESS || "(set VITE_CONTRACT_ADDRESS)"}</div>
            <div style={{ marginTop: 2, color: "#475569" }}>Wallet: {wallet || "(not connected)"}</div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {lang === "zh" ? "使用說明" : "Help"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: showPanel ? "340px 1fr" : "70px 1fr", minHeight: "calc(100vh - 150px)", transition: "grid-template-columns .2s ease" }}>
          <aside style={{ borderRight: "1px solid #e5e7eb", padding: 12, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: showPanel ? "space-between" : "center", marginBottom: 10 }}>
              {showPanel ? <strong>{t.control}</strong> : null}
              <button onClick={() => setShowPanel((v) => !v)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>{showPanel ? "收合" : "展開"}</button>
            </div>
            {showPanel ? (
              <>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.connect} k="connect" onClick={connectWallet} primary />
                    <Btn label={t.local} k="local" onClick={switchToLocal} />
                    <Btn label={t.amoy} k="amoy" onClick={switchToAmoy} />
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.check} k="check" onClick={checkContractHealth} disabled={!canRead} />
                    <Btn label={t.ipfsCheck} k="ipfsCheck" onClick={checkIpfsHealth} />
                    <Btn label={t.gid} k="gid" onClick={loadGroupId} disabled={!canRead} />
                    <Btn label={t.members} k="members" onClick={loadMembersFromEvents} disabled={!canRead} />
                  </div>
                  <input
                    value={ipfsGateway}
                    onChange={(e) => setIpfsGateway(e.target.value)}
                    placeholder="Private IPFS Gateway, e.g. http://127.0.0.1:8080"
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginTop: 10 }}
                  />
                  <div style={{ marginTop: 10, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{diag || "Diag: -"}</div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setLang("zh")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: lang === "zh" ? "#111827" : "#fff", color: lang === "zh" ? "#fff" : "#111827", cursor: "pointer" }}>中文</button>
                    <button onClick={() => setLang("en")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: lang === "en" ? "#111827" : "#fff", color: lang === "en" ? "#fff" : "#111827", cursor: "pointer" }}>English</button>
                  </div>
                </div>
              </>
            ) : null}
          </aside>

          <main style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setActiveTab("saasAdmin")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === "saasAdmin" ? "#111827" : "#fff", color: activeTab === "saasAdmin" ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}>{t.saasAdmin}</button>
              <button onClick={() => setActiveTab("admin")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === "admin" ? "#111827" : "#fff", color: activeTab === "admin" ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}>{t.admin}</button>
              <button onClick={() => setActiveTab("employee")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === "employee" ? "#111827" : "#fff", color: activeTab === "employee" ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}>{t.employee}</button>
            </div>

            {activeTab === "saasAdmin" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>SaaS Admin: Company / Group Onboarding</h3>
                  <p style={{ color: "#64748b", marginTop: 0 }}>PoC version: platform operator creates companies and report groups here.</p>
                  <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="companyId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="new company name" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ marginBottom: 12 }}><Btn label={t.createCompany} k="createCompany" onClick={adminCreateCompany} disabled={!canUse} /></div>
                  <input value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="reportGroupId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="topic name, e.g. financial fraud" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <input value={maxReportsPerMember} onChange={(e) => setMaxReportsPerMember(e.target.value)} placeholder="max reports per member" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ marginBottom: 12 }}><Btn label={t.createGroup} k="createGroup" onClick={adminCreateReportGroup} disabled={!canUse} /></div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>companyId: {companyId || "-"} | reportGroupId: {reportGroupId || "-"} | Semaphore groupId: {groupId || "-"}</div>
                </div>
              </div>
            ) : activeTab === "admin" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3>{t.admin}: Employee Membership</h3>
                  <input value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="reportGroupId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <input value={newMemberCommitment} onChange={(e) => setNewMemberCommitment(e.target.value)} placeholder="employee identity commitment" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.addEmployee} k="addEmployee" onClick={adminAddEmployee} primary disabled={!canUse} />
                    <Btn label={t.members} k="loadMembersAdmin" onClick={loadMembersFromEvents} disabled={!canRead} />
                  </div>
                  <input value={removeMemberCommitment} onChange={(e) => setRemoveMemberCommitment(e.target.value)} placeholder="ex-employee commitment to remove" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginTop: 8 }} />
                  <div style={{ marginTop: 8 }}><Btn label={t.removeEmployee} k="removeEmployee" onClick={adminRemoveEmployee} disabled={!canUse} /></div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>reportGroupId: {reportGroupId || "-"} | Semaphore groupId: {groupId || "-"} | active members loaded: {members.length}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    Removing a commitment prevents future credentials from the current member tree. Company HR may know which employee owns a commitment, but submitted reports remain unlinkable to a specific commitment through the proof alone.
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Admin Encryption Key</h3>
                  <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="companyId for this public key" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.getAdminPub} k="getAdminPub" onClick={adminGetEncryptionPubKey} disabled={!canUse} />
                    <Btn label={t.setAdminPub} k="setAdminPub" onClick={adminSetEncryptionPubKey} primary disabled={!canUse} />
                  </div>
                  <textarea value={adminEncryptionPubKey} onChange={(e) => setAdminEncryptionPubKey(e.target.value)} placeholder="admin encryption public key" style={{ width: "100%", height: 100, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    This writes the public key to companies[companyId].adminPublicKey. Only the platform owner or that company's admin address can update it.
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Reports</h3>
                  <input
                    value={ipfsGateway}
                    onChange={(e) => setIpfsGateway(e.target.value)}
                    placeholder="Private IPFS Gateway, e.g. http://127.0.0.1:8080"
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="companyId" style={{ width: 120, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                    <Btn label={t.loadCompanyReports} k="loadCompanyReports" onClick={() => loadAllReports(true)} disabled={!canUse} />
                    <Btn label={t.loadReports} k="loadReports" onClick={() => loadAllReports(false)} disabled={!canUse} />
                    <Btn label={t.decryptAll} k="decryptAll" onClick={decryptAll} disabled={!canUse || reports.length === 0} />
                  </div>
                  {reports.length === 0 ? <div>no reports</div> : reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 8, overflowWrap: "anywhere" }}>
                      <div><strong>#{r.id}</strong> | {new Date(r.timestamp * 1000).toLocaleString()}</div>
                      <div>companyId: {r.companyId} | reportGroupId: {r.reportGroupId}</div>
                      <div>period: {r.period} | slot: {r.reportSlot}</div>
                      <div>ipfsCID: {r.ipfsCID}</div>
                      <div>messageHash: {r.messageHash}</div>
                      <div>status: {reportStatusLabel(r.status)}{r.statusNote ? ` | note: ${r.statusNote}` : ""}</div>
                      <div>nullifier: {r.nullifier}</div>
                      <div>scope: {r.scope}</div>
                      <div>sender: {r.submittedBy}</div>
                      <div>encrypted: {r.encryptedReport ? `${r.encryptedReport.slice(0, 80)}...` : "(fetch by ipfsCID)"}</div>
                      <div style={{ marginTop: 6 }}><Btn label={t.decrypt} k={`decrypt_${r.id}`} onClick={() => decryptOne(r.id)} disabled={!canUse} /></div>
                      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, marginTop: 8 }}>
                        <select
                          value={reportStatusDrafts[r.id]?.status ?? r.status}
                          onChange={(e) => setReportStatusDrafts((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), status: e.target.value } }))}
                          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px" }}
                        >
                          <option value="0">Submitted</option>
                          <option value="1">Reviewing</option>
                          <option value="2">Confirmed</option>
                          <option value="3">Rejected</option>
                          <option value="4">Closed</option>
                        </select>
                        <input
                          value={reportStatusDrafts[r.id]?.note ?? r.statusNote}
                          onChange={(e) => setReportStatusDrafts((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), note: e.target.value } }))}
                          placeholder="status note after reviewing content"
                          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px" }}
                        />
                        <Btn label={t.updateStatus} k={`status_${r.id}`} onClick={() => updateReportStatus(r.id)} disabled={!canUse} />
                      </div>
                      <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>plain: {r.plainText || "(not decrypted)"}</div>
                      <div style={{ marginTop: 10, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Anonymous thread</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <Btn label={t.loadThread} k={`loadThread_${r.id}`} onClick={() => loadReportMessages(String(r.id))} disabled={!canRead} />
                          <Btn label="Decrypt Thread" k={`decryptThread_${r.id}`} onClick={() => decryptThreadMessages(String(r.id), r.threadSecretKey || threadSecretKey)} disabled={!canUse} />
                        </div>
                        <textarea
                          value={adminReplyDrafts[r.id] || ""}
                          onChange={(e) => setAdminReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Admin reply / clarification question. It will be encrypted with this report's thread secret key."
                          style={{ width: "100%", height: 72, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }}
                        />
                        <div style={{ marginTop: 8 }}><Btn label={t.sendReply} k={`adminReply_${r.id}`} onClick={() => adminSendReply(r.id)} disabled={!canUse || !(r.threadSecretKey || threadSecretKey)} /></div>
                        {(threadMessages[String(r.id)] || []).length > 0 ? (
                          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                            {(threadMessages[String(r.id)] || []).map((m) => (
                              <div key={m.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                                <div>message #{m.id} | {m.senderRole === 1 ? "Admin" : "Reporter"} | {new Date(m.timestamp * 1000).toLocaleString()}</div>
                                <div>cid: {m.ipfsCID}</div>
                                <div>hash: {m.contentHash}</div>
                                <div style={{ whiteSpace: "pre-wrap" }}>plain: {m.plainText || "(encrypted)"}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Step 1: Identity</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.genIdentity} k="genIdentity" onClick={async () => createIdentity()} />
                    <Btn label={t.importIdentity} k="importIdentity" onClick={async () => importIdentity()} />
                    <Btn label={t.previewReporter} k="previewReporter" onClick={async () => previewReporter()} />
                  </div>
                  <textarea value={identityExport} onChange={(e) => setIdentityExport(e.target.value)} placeholder="employee privateKey(base64)" style={{ width: "100%", height: 88, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                  <div>identity commitment: {identityCommitment || "-"}</div>
                  <textarea value={reporterIdentityExport} onChange={(e) => setReporterIdentityExport(e.target.value)} placeholder="reporter privateKey(base64)" style={{ width: "100%", height: 88, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                  <div>reporter commitment: {reporterCommitmentPreview || "-"}</div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Step 2: Proof + Encryption</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="companyId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                    <input value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="reportGroupId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                    <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="period, e.g. 2026-Q1" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                    <input value={reportSlot} onChange={(e) => setReportSlot(e.target.value)} placeholder="reportSlot, e.g. 1" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  </div>
                  <input value={ipfsCID} onChange={(e) => setIpfsCID(e.target.value)} placeholder={submitMode === "burner" ? "ipfsCID (burner mode auto-fills after IPFS upload)" : "ipfsCID"} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ height: 8 }} />
                  <textarea value={reportPlaintext} onChange={(e) => setReportPlaintext(e.target.value)} placeholder="??批捆 / report content" style={{ width: "100%", height: 96, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <Btn label="Preload proof artifacts" k="preloadProof" onClick={preloadProofArtifacts} disabled={!canRead} />
                    <Btn label="Prepare anonymous credential" k="prepareCredential" onClick={prepareAnonymousCredential} primary disabled={!canRead} />
                    <Btn label="Encrypt + upload report" k="genProof" onClick={generateProofAndEncrypt} disabled={!canRead} />
                  </div>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>proof artifacts: {proofArtifactsStatus}</div>
                  <div style={{ marginTop: 4, overflowWrap: "anywhere" }}>prepared credential: {preparedCredentialContext || "-"}</div>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>messageHash: {messageHash || "-"}</div>
                  <div style={{ marginTop: 8, border: "1px solid #facc15", background: "#fffbeb", borderRadius: 10, padding: 10, overflowWrap: "anywhere" }}>
                    <strong>Save this thread secret key:</strong>
                    <div style={{ marginTop: 4, fontFamily: "ui-monospace,monospace" }}>{threadSecretKey || "(generated after Encrypt + upload report)"}</div>
                    <div style={{ marginTop: 4, color: "#92400e", fontSize: 13 }}>One report uses one symmetric key. Keep it private; it is required to read Admin replies and send anonymous follow-ups.</div>
                  </div>
                  <div style={{ marginTop: 4, overflowWrap: "anywhere" }}>proof scope: {proofScope || "-"}</div>
                  <textarea value={encryptedReport} onChange={(e) => setEncryptedReport(e.target.value)} placeholder="hybrid encrypted report payload (JSON)" style={{ width: "100%", height: 80, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                  <textarea value={proofJson} onChange={(e) => setProofJson(e.target.value)} placeholder="proof json" style={{ width: "100%", height: 160, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Step 3: Submit + View</h3>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{t.submitMode}</div>
                    <label style={{ display: "block", marginBottom: 6 }}>
                      <input type="radio" checked={submitMode === "metamask"} onChange={() => setSubmitMode("metamask")} /> {t.metamaskMode}
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                      <input type="radio" checked={submitMode === "burner"} onChange={() => setSubmitMode("burner")} /> {t.burnerMode}
                    </label>
                    {submitMode === "burner" ? (
                      <>
                        <input
                          value={burnerRpcUrl}
                          onChange={(e) => setBurnerRpcUrl(e.target.value)}
                          placeholder="Zero-gas RPC URL, e.g. http://127.0.0.1:8545"
                          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
                          <input value={ipfsClusterApi} onChange={(e) => setIpfsClusterApi(e.target.value)} placeholder="IPFS Cluster API, e.g. http://127.0.0.1:9094" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                          <input value={ipfsClusterUser} onChange={(e) => setIpfsClusterUser(e.target.value)} placeholder="user" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                          <input value={ipfsClusterPassword} onChange={(e) => setIpfsClusterPassword(e.target.value)} placeholder="password from private-ipfs-cluster/.env" type="password" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                          Burner wallet ??汗?冽璈????芾?鞎祇?gasPrice=0 鈭斗?嚗??梯??潔???ZK proof 瘙箏??迨璅∪???砍?祇??銝西???喳?? Private IPFS?moy 隞? POL嚗??拍 burner ??gas??                        </div>
                        <div style={{ marginTop: 6, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#334155", overflowWrap: "anywhere" }}>
                          last burner: {lastBurnerAddress || "-"}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.submit} k="submit" onClick={submitAnonymousReport} primary disabled={!CONTRACT_ADDRESS || (submitMode === "metamask" && !canUse)} />
                    <Btn label={t.loadReports} k="loadReportsEmp" onClick={() => loadAllReports(false)} disabled={!canRead} />
                  </div>
                  {reports.length > 0 ? reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginTop: 8, overflowWrap: "anywhere" }}>
                      <div><strong>#{r.id}</strong> | {new Date(r.timestamp * 1000).toLocaleString()}</div>
                      <div>companyId: {r.companyId} | reportGroupId: {r.reportGroupId}</div>
                      <div>period: {r.period} | slot: {r.reportSlot}</div>
                      <div>ipfsCID: {r.ipfsCID}</div>
                      <div>messageHash: {r.messageHash}</div>
                      <div>nullifier: {r.nullifier}</div>
                      <div>scope: {r.scope}</div>
                      <div>sender: {r.submittedBy}</div>
                      <div>encrypted: {r.encryptedReport ? `${r.encryptedReport.slice(0, 80)}...` : "(stored in private IPFS)"}</div>
                      <div>plain: {r.plainText || "(no key / not decrypted)"}</div>
                    </div>
                  )) : <div style={{ marginTop: 8 }}>no reports</div>}
                  <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                    <h3 style={{ margin: "0 0 8px" }}>Anonymous Thread Reply</h3>
                    <input value={threadReportId} onChange={(e) => setThreadReportId(e.target.value)} placeholder="reportId" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", marginBottom: 8 }} />
                    <textarea value={threadSecretKey} onChange={(e) => setThreadSecretKey(e.target.value)} placeholder="thread private key / symmetric key saved from initial report" style={{ width: "100%", height: 76, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace", marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <Btn label={t.loadThread} k="employeeLoadThread" onClick={() => loadReportMessages(threadReportId.trim())} disabled={!canRead} />
                      <Btn label="Decrypt Replies" k="employeeDecryptThread" onClick={() => decryptThreadMessages(threadReportId.trim(), threadSecretKey.trim())} disabled={!canRead} />
                    </div>
                    <textarea value={reporterReplyText} onChange={(e) => setReporterReplyText(e.target.value)} placeholder="Reporter follow-up / rebuttal. It will be encrypted with the saved thread key and submitted by burner wallet." style={{ width: "100%", height: 84, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                    <div style={{ marginTop: 8 }}><Btn label={t.sendReply} k="reporterReply" onClick={reporterSendReply} primary disabled={!CONTRACT_ADDRESS} /></div>
                    {(threadMessages[threadReportId.trim()] || []).length > 0 ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {(threadMessages[threadReportId.trim()] || []).map((m) => (
                          <div key={m.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, overflowWrap: "anywhere" }}>
                            <div>message #{m.id} | {m.senderRole === 1 ? "Admin" : "Reporter"} | {new Date(m.timestamp * 1000).toLocaleString()}</div>
                            <div>cid: {m.ipfsCID}</div>
                            <div>hash: {m.contentHash}</div>
                            <div style={{ whiteSpace: "pre-wrap" }}>plain: {m.plainText || "(encrypted)"}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <strong>{t.status}:</strong> {status || "-"}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;

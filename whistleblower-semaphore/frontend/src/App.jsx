import { useMemo, useState } from "react";
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
  const [members, setMembers] = useState([]);
  const [groupId, setGroupId] = useState("");

  const [identityExport, setIdentityExport] = useState("");
  const [identityCommitment, setIdentityCommitment] = useState("");
  const [reporterIdentityExport, setReporterIdentityExport] = useState("");
  const [reporterCommitmentPreview, setReporterCommitmentPreview] = useState("");

  const [ipfsCID, setIpfsCID] = useState("");
  const [reportPlaintext, setReportPlaintext] = useState("");
  const [messageHash, setMessageHash] = useState("");
  const [encryptedReport, setEncryptedReport] = useState("");
  const [proofJson, setProofJson] = useState("");

  const [adminEncryptionPubKey, setAdminEncryptionPubKey] = useState("");
  const [reports, setReports] = useState([]);

  const canUse = useMemo(() => !!window.ethereum && !!CONTRACT_ADDRESS, []);
  const helpCopy = {
    zh: {
      title: "使用說明",
      intro: "這個工具分成 Admin 與 Employee 兩種角色。Admin 負責建立可解密的收件端與員工白名單，Employee 則用匿名身分產生 proof 並送出加密舉報。",
      quick: [
        "Admin 先連接錢包，按「取得 Admin 加密公鑰」。",
        "Admin 再按「設定 Admin 加密公鑰到鏈上」，讓所有員工都能讀到同一把公鑰。",
        "員工產生 Identity，將 commitment 交給 Admin 加入群組。",
        "員工輸入 ipfsCID 與舉報內容，按「產生 Proof + 加密內容」。",
        "員工送出後，鏈上只保存密文、messageHash、nullifier 與 proof 驗證結果。"
      ],
      adminKeyTitle: "Admin 加密公鑰兩個按鈕",
      adminKey: [
        "取得 Admin 加密公鑰：向 MetaMask 取得目前 Admin 帳號的公開加密公鑰。這不是私鑰，可以公開。",
        "設定 Admin 加密公鑰到鏈上：把這把公鑰寫入合約，讓員工前端自動使用它加密舉報內容。",
        "員工送出時用 Admin 公鑰加密；只有 Admin 的 MetaMask 私鑰可以透過解密按鈕看到明文。"
      ],
      employeeTitle: "Employee 流程",
      employee: [
        "Generate Identity 會產生匿名身分 privateKey(base64) 與 commitment。",
        "commitment 可以交給 Admin 加入群組；privateKey 只能自己保存。",
        "Preview Reporter Commitment 可確認目前舉報者 privateKey 對應哪個 commitment。",
        "Generate Proof + Encrypt 會產生 messageHash、加密舉報內容，並產生 Semaphore proof。",
        "Submit Anonymous Report 會將 ipfsCID、messageHash、密文與 proof 送上鏈。"
      ],
      reportsTitle: "查詢與解密",
      reports: [
        "Admin 與 Employee 都可以查詢鏈上所有舉報。",
        "Employee 只能看到密文與 messageHash，無法看到明文內容。",
        "Admin 可用 Decrypt 或 Decrypt All 透過 MetaMask 私鑰解密內容。"
      ]
    },
    en: {
      title: "How to use",
      intro: "The tool has two roles. Admin manages the decryption endpoint and employee allowlist. Employee generates an anonymous Semaphore proof and submits an encrypted report.",
      quick: [
        "Admin connects wallet and clicks Get Admin Encryption PubKey.",
        "Admin clicks Set Admin Encryption PubKey so the public key is stored on-chain.",
        "Employee generates an identity and gives the commitment to Admin.",
        "Employee enters ipfsCID and report content, then clicks Generate Proof + Encrypt.",
        "The chain stores ciphertext, messageHash, nullifier, and proof validation result."
      ],
      adminKeyTitle: "Admin encryption key buttons",
      adminKey: [
        "Get Admin Encryption PubKey asks MetaMask for the current Admin account encryption public key. It is public, not private.",
        "Set Admin Encryption PubKey writes that key to the contract so employees encrypt to the same Admin key.",
        "Employees encrypt with the Admin public key; only the Admin MetaMask private key can decrypt."
      ],
      employeeTitle: "Employee flow",
      employee: [
        "Generate Identity creates a privateKey(base64) and commitment.",
        "The commitment can be given to Admin; the privateKey must stay with the employee.",
        "Preview Reporter Commitment shows which commitment the current reporter identity maps to.",
        "Generate Proof + Encrypt computes messageHash, encrypts report content, and creates the Semaphore proof.",
        "Submit Anonymous Report sends ipfsCID, messageHash, ciphertext, and proof on-chain."
      ],
      reportsTitle: "Reports and decryption",
      reports: [
        "Both Admin and Employee can load all on-chain reports.",
        "Employee can only see ciphertext and messageHash, not plaintext.",
        "Admin can use Decrypt or Decrypt All to decrypt with MetaMask."
      ]
    }
  }[lang];

  const t = {
    zh: {
      title: "Semaphore 員工匿名舉報系統",
      control: "控制面板",
      admin: "Admin",
      employee: "Employee",
      connect: "連接錢包",
      local: "連到本機",
      amoy: "連到 Amoy",
      check: "檢查合約",
      gid: "讀取 Group ID",
      members: "載入成員",
      addEmployee: "加入員工",
      genIdentity: "產生 Identity",
      importIdentity: "匯入 Identity",
      previewReporter: "預覽舉報者 Commitment",
      getAdminPub: "取得 Admin 加密公鑰",
      setAdminPub: "設定 Admin 加密公鑰到鏈上",
      genProof: "產生 Proof + 加密內容",
      submit: "送出匿名舉報",
      loadReports: "查詢所有鏈上舉報",
      decrypt: "解密",
      decryptAll: "全部解密",
      status: "狀態"
    },
    en: {
      title: "Semaphore Employee Whistleblower",
      control: "Control Panel",
      admin: "Admin",
      employee: "Employee",
      connect: "Connect Wallet",
      local: "Switch Local",
      amoy: "Switch Amoy",
      check: "Check Contract",
      gid: "Load Group ID",
      members: "Load Members",
      addEmployee: "Add Employee",
      genIdentity: "Generate Identity",
      importIdentity: "Import Identity",
      previewReporter: "Preview Reporter Commitment",
      getAdminPub: "Get Admin Encryption PubKey",
      setAdminPub: "Set Admin Encryption PubKey",
      genProof: "Generate Proof + Encrypt",
      submit: "Submit Anonymous Report",
      loadReports: "Load All Reports",
      decrypt: "Decrypt",
      decryptAll: "Decrypt All",
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
  function getReadContract() { return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, getProvider()); }

  async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function encryptWithAdminPubKey(pubKey, plainText) {
    const { encrypt } = await import("@metamask/eth-sig-util");
    const enc = encrypt({ publicKey: pubKey, data: plainText, version: "x25519-xsalsa20-poly1305" });
    const hex = "0x" + Buffer.from(JSON.stringify(enc), "utf8").toString("hex");
    return hex;
  }

  async function connectWallet() {
    if (!window.ethereum) throw new Error("請先安裝 MetaMask");
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWallet(account || "");
    setStatus("Wallet connected");
    pushToast("success", "Wallet connected");
  }

  async function switchToLocal() {
    if (!window.ethereum) throw new Error("請先安裝 MetaMask");
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
    if (!window.ethereum) throw new Error("請先安裝 MetaMask");
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
    if (!canUse) throw new Error("請先設定合約地址並安裝 MetaMask");
    const provider = getProvider();
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

  async function loadGroupId() {
    const id = await getReadContract().groupId();
    setGroupId(id.toString());
    setStatus("Group ID loaded");
  }

  async function loadMembersFromEvents() {
    const c = getReadContract();
    const logs = await c.queryFilter(c.filters.EmployeeMemberAdded(), 0, "latest");
    const list = logs.map((l) => l.args.identityCommitment.toString());
    setMembers(list);
    setStatus(`Loaded ${list.length} members`);
  }

  async function adminGetEncryptionPubKey() {
    if (!wallet) throw new Error("請先連接錢包");
    const pub = await window.ethereum.request({ method: "eth_getEncryptionPublicKey", params: [wallet] });
    setAdminEncryptionPubKey(pub);
    setStatus("Got admin encryption public key");
    pushToast("success", "Got admin encryption public key");
  }

  async function adminSetEncryptionPubKey() {
    if (!adminEncryptionPubKey.trim()) throw new Error("請先取得或輸入公鑰");
    const tx = await getSignerContract().setAdminEncryptionPublicKey(adminEncryptionPubKey.trim());
    await tx.wait();
    setStatus("Admin encryption public key set on-chain");
    pushToast("success", "Admin pubkey set");
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
    if (!commitment) throw new Error("請輸入 employee commitment");
    const tx = await getSignerContract().addEmployeeMember(commitment);
    await tx.wait();
    setStatus("Employee added");
    pushToast("success", "Employee added");
  }

  async function generateProofAndEncrypt() {
    if (!reporterIdentityExport.trim()) throw new Error("請輸入 reporter identity");
    if (!ipfsCID.trim() || !reportPlaintext.trim()) throw new Error("請輸入 ipfsCID 與舉報內容");
    if (!members.length) throw new Error("請先載入群組成員");

    const c = getReadContract();
    const gid = (await c.groupId()).toString();
    const adminPub = await c.adminEncryptionPublicKey();
    if (!adminPub) throw new Error("Admin 公鑰尚未設定，請先由 Admin 設定");

    const messageHashHex = await sha256Hex(reportPlaintext.trim());
    const computedMessageHash = `sha256:${messageHashHex}`;
    setMessageHash(computedMessageHash);

    const encrypted = await encryptWithAdminPubKey(adminPub, reportPlaintext.trim());
    setEncryptedReport(encrypted);

    const identity = Identity.import(reporterIdentityExport.trim());
    setReporterCommitmentPreview(identity.commitment.toString());

    const group = new Group(members);
    const message = ethers.BigNumber.from(
      ethers.utils.keccak256(ethers.utils.solidityPack(["string", "string"], [ipfsCID.trim(), computedMessageHash]))
    ).toString();

    const proof = await generateProof(identity, group, message, gid);

    const solidityProof = {
      merkleTreeDepth: proof.merkleTreeDepth,
      merkleTreeRoot: proof.merkleTreeRoot.toString(),
      nullifier: proof.nullifier.toString(),
      message: proof.message.toString(),
      scope: proof.scope.toString(),
      points: proof.points
    };

    setProofJson(JSON.stringify(solidityProof, null, 2));
    setGroupId(gid);
    setStatus("Proof generated and report encrypted");
    pushToast("success", "Proof generated + encrypted");
  }

  async function submitAnonymousReport() {
    if (!proofJson.trim()) throw new Error("請先生成 proof");
    if (!messageHash.trim() || !encryptedReport.trim()) throw new Error("缺少 messageHash 或 encryptedReport");

    const proof = JSON.parse(proofJson);
    const tx = await getSignerContract().submitAnonymousReport(ipfsCID.trim(), messageHash.trim(), encryptedReport.trim(), proof);
    await tx.wait();
    setStatus("Anonymous report submitted");
    pushToast("success", "Report submitted");
  }

  async function loadAllReports() {
    const c = getReadContract();
    const total = Number((await c.reportCount()).toString());
    const list = [];
    for (let i = 1; i <= total; i++) {
      const r = await c.reports(i);
      list.push({
        id: Number(r.id),
        ipfsCID: r.ipfsCID,
        messageHash: r.messageHash,
        encryptedReport: r.encryptedReport,
        timestamp: Number(r.timestamp),
        nullifier: r.nullifier.toString(),
        message: r.message.toString(),
        plainText: ""
      });
    }
    list.sort((a, b) => b.id - a.id);
    setReports(list);
    setStatus(`Loaded ${list.length} reports`);
    pushToast("success", `Loaded ${list.length} reports`);
  }

  async function decryptOne(reportId) {
    if (!wallet) throw new Error("請先連接 Admin 錢包");
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;
    const plain = await window.ethereum.request({ method: "eth_decrypt", params: [target.encryptedReport, wallet] });
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, plainText: plain } : r)));
    pushToast("success", `Report #${reportId} decrypted`);
  }

  async function decryptAll() {
    for (const r of reports) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const plain = await window.ethereum.request({ method: "eth_decrypt", params: [r.encryptedReport, wallet] });
        setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, plainText: plain } : x)));
      } catch {
        // ignore per-report decrypt failure
      }
    }
    pushToast("success", "Decrypt-all finished");
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
      {loading[k] ? "⏳ " : ""}{label}
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
              <button onClick={() => setShowPanel((v) => !v)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>☰</button>
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
                    <Btn label={t.check} k="check" onClick={checkContractHealth} disabled={!canUse} />
                    <Btn label={t.gid} k="gid" onClick={loadGroupId} disabled={!canUse} />
                    <Btn label={t.members} k="members" onClick={loadMembersFromEvents} disabled={!canUse} />
                  </div>
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
              <button onClick={() => setActiveTab("admin")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === "admin" ? "#111827" : "#fff", color: activeTab === "admin" ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}>{t.admin}</button>
              <button onClick={() => setActiveTab("employee")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === "employee" ? "#111827" : "#fff", color: activeTab === "employee" ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}>{t.employee}</button>
            </div>

            {activeTab === "admin" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{t.admin}: {t.addEmployee}</h3>
                  <input value={newMemberCommitment} onChange={(e) => setNewMemberCommitment(e.target.value)} placeholder="employee identity commitment" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ marginTop: 8 }}><Btn label={t.addEmployee} k="addEmployee" onClick={adminAddEmployee} primary disabled={!canUse} /></div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Admin Encryption Key</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.getAdminPub} k="getAdminPub" onClick={adminGetEncryptionPubKey} disabled={!canUse} />
                    <Btn label={t.setAdminPub} k="setAdminPub" onClick={adminSetEncryptionPubKey} primary disabled={!canUse} />
                  </div>
                  <textarea value={adminEncryptionPubKey} onChange={(e) => setAdminEncryptionPubKey(e.target.value)} placeholder="admin encryption public key" style={{ width: "100%", height: 100, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Reports</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <Btn label={t.loadReports} k="loadReports" onClick={loadAllReports} disabled={!canUse} />
                    <Btn label={t.decryptAll} k="decryptAll" onClick={decryptAll} disabled={!canUse || reports.length === 0} />
                  </div>
                  {reports.length === 0 ? <div>no reports</div> : reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 8, overflowWrap: "anywhere" }}>
                      <div><strong>#{r.id}</strong> | {new Date(r.timestamp * 1000).toLocaleString()}</div>
                      <div>ipfsCID: {r.ipfsCID}</div>
                      <div>messageHash: {r.messageHash}</div>
                      <div>nullifier: {r.nullifier}</div>
                      <div>encrypted: {r.encryptedReport.slice(0, 80)}...</div>
                      <div style={{ marginTop: 6 }}><Btn label={t.decrypt} k={`decrypt_${r.id}`} onClick={() => decryptOne(r.id)} disabled={!canUse} /></div>
                      <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>plain: {r.plainText || "(not decrypted)"}</div>
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
                  <input value={ipfsCID} onChange={(e) => setIpfsCID(e.target.value)} placeholder="ipfsCID" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ height: 8 }} />
                  <textarea value={reportPlaintext} onChange={(e) => setReportPlaintext(e.target.value)} placeholder="舉報內容 / report content" style={{ width: "100%", height: 96, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box" }} />
                  <div style={{ marginTop: 8 }}><Btn label={t.genProof} k="genProof" onClick={generateProofAndEncrypt} primary disabled={!canUse} /></div>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>messageHash: {messageHash || "-"}</div>
                  <textarea value={encryptedReport} onChange={(e) => setEncryptedReport(e.target.value)} placeholder="encrypted report (hex)" style={{ width: "100%", height: 80, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                  <textarea value={proofJson} onChange={(e) => setProofJson(e.target.value)} placeholder="proof json" style={{ width: "100%", height: 160, marginTop: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", boxSizing: "border-box", fontFamily: "ui-monospace,monospace" }} />
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Step 3: Submit + View</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.submit} k="submit" onClick={submitAnonymousReport} primary disabled={!canUse} />
                    <Btn label={t.loadReports} k="loadReportsEmp" onClick={loadAllReports} disabled={!canUse} />
                  </div>
                  {reports.length > 0 ? reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginTop: 8, overflowWrap: "anywhere" }}>
                      <div><strong>#{r.id}</strong> | {new Date(r.timestamp * 1000).toLocaleString()}</div>
                      <div>ipfsCID: {r.ipfsCID}</div>
                      <div>messageHash: {r.messageHash}</div>
                      <div>encrypted: {r.encryptedReport.slice(0, 80)}...</div>
                      <div>plain: {r.plainText || "(no key / not decrypted)"}</div>
                    </div>
                  )) : <div style={{ marginTop: 8 }}>no reports</div>}
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

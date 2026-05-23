import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { Buffer } from "buffer";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import appArtifact from "./EmployeeSemaphoreWhistleblower.json";
import "./App.css";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const LOCAL_CHAIN_HEX = "0x7a69";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_IPFS_CLUSTER_API = import.meta.env.VITE_IPFS_CLUSTER_API || "http://127.0.0.1:9094";
const DEFAULT_IPFS_CLUSTER_USER = import.meta.env.VITE_IPFS_CLUSTER_USER || "admin";
const DEFAULT_IPFS_CLUSTER_PASSWORD = import.meta.env.VITE_IPFS_CLUSTER_PASSWORD || "";
const AMOY_CHAIN_HEX = "0x13882";
const AMOY_RPC_URL = "https://rpc-amoy.polygon.technology";
const REPORT_CREDENTIAL_MESSAGE_TAG = "REPORT_CREDENTIAL_V1";

const inputStyle = {
  width: "100%",
  border: "1px solid #d5dfeb",
  borderRadius: 14,
  padding: "12px 13px",
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.88)",
  color: "#132238",
  outline: "none"
};
const monoStyle = { fontFamily: "ui-monospace,monospace" };

const HelpText = ({ children }) => (
  <div className="help-copy" style={{ marginTop: 5, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>{children}</div>
);

const Field = ({ label, hint, value, onChange, placeholder, type = "text", style = {}, inputProps = {} }) => (
  <label style={{ display: "block", marginBottom: 10, ...style }}>
    <div className="field-label" style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginBottom: 5 }}>{label}</div>
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      style={inputStyle}
      {...inputProps}
    />
    {hint ? <HelpText>{hint}</HelpText> : null}
  </label>
);

const TextAreaField = ({ label, hint, value, onChange, placeholder, height = 88, mono = false, style = {} }) => (
  <label style={{ display: "block", marginBottom: 10, ...style }}>
    <div className="field-label" style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginBottom: 5 }}>{label}</div>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ ...inputStyle, height, ...(mono ? monoStyle : {}) }}
    />
    {hint ? <HelpText>{hint}</HelpText> : null}
  </label>
);

function App() {
  const [activeTab, setActiveTab] = useState("admin");
  const [showPanel, setShowPanel] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showAdvancedSubmitSettings, setShowAdvancedSubmitSettings] = useState(false);
  const [lang, setLang] = useState("zh");
  const [loading, setLoading] = useState({});
  const [toasts, setToasts] = useState([]);

  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [diag, setDiag] = useState("");
  const [botPosition, setBotPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 24, y: 120 };
    return {
      x: Math.max(18, window.innerWidth - 354),
      y: Math.min(Math.max(112, window.innerHeight - 230), 520)
    };
  });
  const [botDragging, setBotDragging] = useState(false);
  const botDragOffset = useRef({ x: 0, y: 0 });

  const [newMemberCommitment, setNewMemberCommitment] = useState("");
  const [removeMemberCommitment, setRemoveMemberCommitment] = useState("");
  const [members, setMembers] = useState([]);
  const [membersReportGroupId, setMembersReportGroupId] = useState("");
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
  const [burnerRpcUrl, setBurnerRpcUrl] = useState(LOCAL_RPC_URL);
  const [lastBurnerAddress, setLastBurnerAddress] = useState("");
  const [ipfsClusterApi, setIpfsClusterApi] = useState(DEFAULT_IPFS_CLUSTER_API);
  const [ipfsClusterUser, setIpfsClusterUser] = useState(DEFAULT_IPFS_CLUSTER_USER);
  const [ipfsClusterPassword, setIpfsClusterPassword] = useState(DEFAULT_IPFS_CLUSTER_PASSWORD);

  const [adminEncryptionPubKey, setAdminEncryptionPubKey] = useState("");
  const [ipfsGateway, setIpfsGateway] = useState("http://127.0.0.1:8080");
  const [reports, setReports] = useState([]);
  const [companyReportGroups, setCompanyReportGroups] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reportStatusDrafts, setReportStatusDrafts] = useState({});
  const [threadSecretKey, setThreadSecretKey] = useState("");
  const [threadReportId, setThreadReportId] = useState("");
  const [lastSubmittedThread, setLastSubmittedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState({});
  const [adminReplyDrafts, setAdminReplyDrafts] = useState({});
  const [reporterReplyText, setReporterReplyText] = useState("");

  const canUse = useMemo(() => !!window.ethereum && !!CONTRACT_ADDRESS, []);
  const canRead = !!CONTRACT_ADDRESS;
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
        "加密並準備舉報會先在本機加密內容、計算 hash；真正送出時才自動上傳 Private IPFS。",
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
        "Encrypt + Prepare Report encrypts content and computes the hash locally; the app uploads to Private IPFS only when submitting.",
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
      genProof: "加密並準備舉報",
      submit: "送出匿名舉報",
      burnerMode: "使用匿名 burner wallet",
      advancedSettings: "進階設定",
      hideAdvancedSettings: "隱藏進階設定",
      loadReports: "查詢所有鏈上舉報",
      loadCompanyReports: "查詢本公司舉報",
      loadCompanyGroups: "查詢公司舉報主題",
      loadGroupReports: "查詢指定主題舉報",
      updateStatus: "更新狀態",
      decrypt: "解密",
      decryptAll: "全部解密",
      loadThread: "載入案件對話",
      sendReply: "送出回覆",
      decryptThread: "解密對話",
      preloadProof: "預載 proof artifacts",
      prepareCredential: "先產生匿名憑證",
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
      genProof: "Encrypt + Prepare Report",
      submit: "Submit Anonymous Report",
      burnerMode: "Use anonymous burner wallet",
      advancedSettings: "Advanced Settings",
      hideAdvancedSettings: "Hide Advanced Settings",
      loadReports: "Load All Reports",
      loadCompanyReports: "Load Company Reports",
      loadCompanyGroups: "Load Company Report Groups",
      loadGroupReports: "Load Group Reports",
      updateStatus: "Update Status",
      decrypt: "Decrypt",
      decryptAll: "Decrypt All",
      loadThread: "Load Thread",
      sendReply: "Send Reply",
      decryptThread: "Decrypt Thread",
      preloadProof: "Preload proof artifacts",
      prepareCredential: "Prepare anonymous credential",
      status: "Status"
    }
  }[lang];

  const ui = {
    zh: {
      saasTitle: "SaaS Admin：公司建立",
      saasIntro: "PoC 版本：平台營運者只在這裡建立公司。舉報主題由各公司 Admin 在 Admin 分頁建立。",
      groupTitle: "Admin：建立公司舉報主題",
      groupIntro: "公司 Admin 可在自己的 companyId 下建立不同舉報主題，例如財務舞弊、職場騷擾、資安事件。",
      membershipTitle: "Admin：員工群組管理",
      encryptionTitle: "Admin 加密公鑰",
      reportsTitle: "舉報案件",
      companyGroupsTitle: "依公司查詢舉報主題",
      companyGroupsIntro: "輸入公司 ID 後可查看該公司有哪些舉報主題、對應 Report Group ID、每人可舉報次數與目前鏈上舉報數量。",
      step1Title: "步驟 1：員工匿名身份",
      step2Title: "步驟 2：Proof 與加密舉報",
      step3Title: "步驟 3：送出與查看",
      anonymousThreadTitle: "匿名案件對話",
      noReports: "目前沒有舉報紀錄",
      notDecrypted: "尚未解密",
      encryptedOnly: "已加密儲存在 Private IPFS",
      storedInIpfs: "儲存在 Private IPFS，尚未讀取",
      noKeyNotDecrypted: "沒有金鑰或尚未解密",
      proofArtifacts: "proof artifacts",
      preparedCredential: "已準備匿名憑證",
      messageHash: "訊息雜湊",
      proofScope: "proof scope",
      identityCommitment: "identity commitment",
      reporterCommitment: "reporter commitment",
      lastBurner: "上次 burner address",
      plain: "明文",
      encrypted: "密文",
      close: "關閉",
      collapse: "收合",
      expand: "展開",
      success: "成功",
      error: "失敗",
      generatedAfterEncrypt: "按下「加密並準備舉報」後產生",
      threadKeyTitle: "請保存這組案件 thread secret key",
      threadKeyHint: "每筆舉報只會有一組對稱金鑰。請私下保存，它會用來查看 Admin 回覆與送出匿名補充說明。",
      memberPrivacyHint: "移除 commitment 會讓離職員工無法再用目前群組資格提交。公司可以知道 commitment 對應哪位員工，但舉報 proof 本身不會揭露是哪個 commitment 送出。",
      companyKeyHint: "這會把公鑰寫入 companies[companyId].adminPublicKey。只有平台 owner 或該公司的 admin address 可以更新。",
      burnerHint: "Burner wallet 是前端臨時產生的匿名交易錢包，適合本機或未來 gasPrice=0 的許可鏈。Amoy 是公測網，仍需要 POL 支付 gas。",
      systemSubmitSettings: "系統送出設定",
      systemSubmitHint: "一般舉報者不需要填寫這些欄位。前端會使用控制面板與環境設定中的 RPC / Private IPFS 連線資訊自動送出。",
      systemConfigMissing: "系統尚未設定 IPFS Cluster 密碼。請由開發者在 frontend/.env 設定 VITE_IPFS_CLUSTER_PASSWORD，並重新啟動前端。",
      systemConfigReady: "系統設定已就緒，舉報者只需要按「送出匿名舉報」。",
      latestThreadKeyTitle: "最近送出案件的 thread secret key",
      latestThreadKeyHint: "請把這組 key 私下保存。之後輸入 reportId + thread secret key，才能查看 Admin 回覆並匿名補充說明。",
      labels: {
        companyId: "公司 ID",
        newCompanyName: "新公司名稱",
        reportGroupId: "舉報主題 ID / Report Group ID",
        topicName: "舉報主題名稱",
        maxReports: "每位員工可舉報次數",
        employeeCommitment: "員工 identity commitment",
        removeCommitment: "離職員工 commitment",
        companyPubKeyId: "要設定公鑰的公司 ID",
        adminPubKey: "公司 Admin 加密公鑰",
        ipfsGateway: "Private IPFS Gateway",
        reportCompanyFilter: "查詢公司 ID",
        period: "舉報期間 / Period",
        reportSlot: "舉報次數 slot",
        ipfsCID: "IPFS CID",
        reportPlaintext: "舉報內容",
        encryptedPayload: "Hybrid encrypted payload",
        proofJson: "ZK proof JSON",
        burnerRpc: "Zero-gas RPC URL",
        ipfsClusterApi: "IPFS Cluster API",
        ipfsUser: "IPFS Cluster 使用者",
        ipfsPassword: "IPFS Cluster 密碼",
        threadReportId: "案件 Report ID",
        threadSecretKey: "案件 thread secret key",
        reporterReply: "舉報者補充 / 反駁內容",
        statusNote: "案件狀態備註",
        adminReply: "Admin 追問 / 回覆內容",
        identityPrivateKey: "員工 identity privateKey(base64)",
        reporterPrivateKey: "舉報者 identity privateKey(base64)"
      },
      examples: {
        companyId: "例如：2。合約中的公司編號，用來區分不同公司。",
        newCompanyName: "例如：TSMC。建立公司時填入公司名稱。",
        reportGroupId: "例如：1。要管理或送出的舉報主題編號。",
        topicName: "例如：財務舞弊、職場騷擾、資安事件。",
        maxReports: "例如：3。代表每位員工在同一期間最多可用 slot 1 到 3。",
        employeeCommitment: "由 Employee 產生 Identity 後提供，只填 commitment，不填 private key。",
        removeCommitment: "填入要退出群組的離職員工 commitment。",
        companyPubKeyId: "例如：2。設定哪一間公司的 Admin public key。",
        adminPubKey: "按「取得 Admin 加密公鑰」後會自動填入，也可手動貼上。",
        ipfsGateway: "例如：http://127.0.0.1:8080。Admin 用它依 CID 讀取密文。",
        reportCompanyFilter: "例如：2。只查詢這間公司的舉報。",
        period: "例如：2026-Q1。會成為 nullifier scope 的一部分。",
        reportSlot: "例如：1。若每人可舉報 3 次，可使用 1、2、3。",
        ipfsCID: "系統會自動上傳密文到 Private IPFS 並回填 CID。",
        reportPlaintext: "填寫要舉報的明文內容，送出前會在前端加密。",
        encryptedPayload: "加密後的 JSON payload，通常不用手動修改。",
        proofJson: "Prepare anonymous credential 後產生，通常不用手動修改。",
        burnerRpc: "例如：http://127.0.0.1:8545。許可鏈 / 本機鏈可用 gasPrice=0。",
        ipfsClusterApi: "例如：http://127.0.0.1:9094。用來把密文上傳到 Private IPFS。",
        ipfsUser: "例如：admin。來自 private-ipfs-cluster/.env。",
        ipfsPassword: "填 private-ipfs-cluster/.env 裡的 CLUSTER_API_PASSWORD。",
        threadReportId: "例如：1。要讀取或回覆哪一筆案件對話。",
        threadSecretKey: "初次舉報加密後顯示，舉報者必須保存。",
        reporterReply: "例如：補充發生時間、地點，或反駁處理結果。",
        statusNote: "例如：已請調查單位補件，或已確認進入調查。",
        adminReply: "例如：請補充發生日期、地點或佐證資料。",
        identityPrivateKey: "由 Generate Identity 產生，員工自己保存。",
        reporterPrivateKey: "測試不同 Employee 身份時可貼入自己的 Identity。"
      }
    },
    en: {
      saasTitle: "SaaS Admin: Company Onboarding",
      saasIntro: "PoC version: the platform operator only creates companies here. Report groups are created by each company's Admin in the Admin tab.",
      groupTitle: "Admin: Create Company Report Group",
      groupIntro: "Company Admin creates report topics under its own companyId, such as financial fraud, harassment, or cybersecurity incidents.",
      membershipTitle: "Admin: Employee Membership",
      encryptionTitle: "Admin Encryption Key",
      reportsTitle: "Reports",
      companyGroupsTitle: "Find Report Groups by Company",
      companyGroupsIntro: "Enter a company ID to see available report topics, their Report Group IDs, max reports per member, and current on-chain report counts.",
      step1Title: "Step 1: Anonymous Employee Identity",
      step2Title: "Step 2: Proof + Encrypted Report",
      step3Title: "Step 3: Submit + View",
      anonymousThreadTitle: "Anonymous Thread Reply",
      noReports: "No reports yet",
      notDecrypted: "not decrypted",
      encryptedOnly: "stored in private IPFS",
      storedInIpfs: "stored in Private IPFS, not fetched yet",
      noKeyNotDecrypted: "no key or not decrypted",
      proofArtifacts: "proof artifacts",
      preparedCredential: "prepared credential",
      messageHash: "message hash",
      proofScope: "proof scope",
      identityCommitment: "identity commitment",
      reporterCommitment: "reporter commitment",
      lastBurner: "last burner address",
      plain: "plain",
      encrypted: "encrypted",
      close: "Close",
      collapse: "Collapse",
      expand: "Expand",
      success: "Success",
      error: "Error",
      generatedAfterEncrypt: "generated after Encrypt + Prepare Report",
      threadKeyTitle: "Save this report thread secret key",
      threadKeyHint: "One report uses one symmetric key. Keep it private; it is required to read Admin replies and send anonymous follow-ups.",
      memberPrivacyHint: "Removing a commitment prevents future credentials from the current member tree. Company HR may know which employee owns a commitment, but submitted reports remain unlinkable to a specific commitment through the proof alone.",
      companyKeyHint: "This writes the public key to companies[companyId].adminPublicKey. Only the platform owner or that company's admin address can update it.",
      burnerHint: "Burner wallet is a temporary anonymous transaction wallet created by the frontend. It is intended for local or future permissioned chains with gasPrice=0. Amoy is a public testnet and still requires POL.",
      systemSubmitSettings: "System Submit Settings",
      systemSubmitHint: "Reporters do not need to fill these fields. The frontend uses the control panel and environment settings for RPC / Private IPFS submission.",
      systemConfigMissing: "IPFS Cluster password is not configured. A developer should set VITE_IPFS_CLUSTER_PASSWORD in frontend/.env and restart the frontend.",
      systemConfigReady: "System settings are ready. The reporter only needs to click Submit Anonymous Report.",
      latestThreadKeyTitle: "Latest submitted report thread secret key",
      latestThreadKeyHint: "Save this key privately. Later, enter reportId + thread secret key to read Admin replies and send anonymous follow-ups.",
      labels: {
        companyId: "Company ID",
        newCompanyName: "New company name",
        reportGroupId: "Report Group ID",
        topicName: "Report topic name",
        maxReports: "Max reports per employee",
        employeeCommitment: "Employee identity commitment",
        removeCommitment: "Ex-employee commitment",
        companyPubKeyId: "Company ID for this public key",
        adminPubKey: "Company Admin encryption public key",
        ipfsGateway: "Private IPFS Gateway",
        reportCompanyFilter: "Company ID filter",
        period: "Reporting period",
        reportSlot: "Report slot",
        ipfsCID: "IPFS CID",
        reportPlaintext: "Report content",
        encryptedPayload: "Hybrid encrypted payload",
        proofJson: "ZK proof JSON",
        burnerRpc: "Zero-gas RPC URL",
        ipfsClusterApi: "IPFS Cluster API",
        ipfsUser: "IPFS Cluster user",
        ipfsPassword: "IPFS Cluster password",
        threadReportId: "Report ID",
        threadSecretKey: "Thread secret key",
        reporterReply: "Reporter follow-up / rebuttal",
        statusNote: "Status note",
        adminReply: "Admin clarification / reply",
        identityPrivateKey: "Employee identity privateKey(base64)",
        reporterPrivateKey: "Reporter identity privateKey(base64)"
      },
      examples: {
        companyId: "e.g. 2. The company id stored in the contract.",
        newCompanyName: "e.g. TSMC. Used when creating a company.",
        reportGroupId: "e.g. 1. The report topic/group to manage or submit to.",
        topicName: "e.g. financial fraud, harassment, cybersecurity incident.",
        maxReports: "e.g. 3. Allows each member to use slots 1 to 3 in the same period.",
        employeeCommitment: "Generated by Employee Identity. Only paste the commitment, never the private key.",
        removeCommitment: "Paste the ex-employee commitment to remove from this group.",
        companyPubKeyId: "e.g. 2. Which company's Admin public key to update.",
        adminPubKey: "Click Get Admin Encryption PubKey to fill this, or paste it manually.",
        ipfsGateway: "e.g. http://127.0.0.1:8080. Admin fetches ciphertext by CID through this gateway.",
        reportCompanyFilter: "e.g. 2. Load only this company's reports.",
        period: "e.g. 2026-Q1. This becomes part of the nullifier scope.",
        reportSlot: "e.g. 1. If max reports is 3, use slots 1, 2, and 3.",
        ipfsCID: "The system uploads ciphertext to Private IPFS and fills the CID automatically.",
        reportPlaintext: "Write the plaintext report. The frontend encrypts it before upload.",
        encryptedPayload: "Encrypted JSON payload. Usually no manual edits needed.",
        proofJson: "Generated after Prepare anonymous credential. Usually no manual edits needed.",
        burnerRpc: "e.g. http://127.0.0.1:8545. Permissioned/local zero-gas RPC.",
        ipfsClusterApi: "e.g. http://127.0.0.1:9094. Used to upload ciphertext to Private IPFS.",
        ipfsUser: "e.g. admin. Read from private-ipfs-cluster/.env.",
        ipfsPassword: "Use CLUSTER_API_PASSWORD from private-ipfs-cluster/.env.",
        threadReportId: "e.g. 1. Which report thread to read or reply to.",
        threadSecretKey: "Shown after initial report encryption. The reporter must save it.",
        reporterReply: "e.g. add incident time/location or rebut a decision.",
        statusNote: "e.g. requested more evidence, or moved to formal investigation.",
        adminReply: "e.g. please provide date, location, or supporting files.",
        identityPrivateKey: "Generated by Generate Identity and kept by the employee.",
        reporterPrivateKey: "Paste a reporter identity when testing different employees."
      }
    }
  }[lang];

  function pushToast(kind, msg) {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, kind, msg }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
  }

  function parseErr(err) {
    const raw = err?.data?.message || err?.reason || err?.error?.message || err?.message || "unknown error";
    const method = err?.method || "";
    const code = err?.code || err?.error?.code || "";
    const noReturnData = err?.data === "0x" || raw.includes('data="0x"');
    if ((code === "CALL_EXCEPTION" || raw.includes("CALL_EXCEPTION")) && noReturnData) {
      return lang === "zh"
        ? `讀取合約失敗${method ? `（${method}）` : ""}：目前 RPC 上的合約地址沒有回傳資料。請確認 .env 的 VITE_CONTRACT_ADDRESS 是最新部署地址，且控制面板的 RPC / MetaMask 在同一條鏈。`
        : `Contract read failed${method ? ` (${method})` : ""}: the current RPC returned no data for this contract address. Check VITE_CONTRACT_ADDRESS and make sure RPC / MetaMask use the same chain.`;
    }
    return raw;
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
  function getReadProvider() { return getBurnerProvider(); }
  function getReadContract() { return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, getReadProvider()); }
  function getReadContracts() {
    const contracts = [getReadContract()];
    if (window.ethereum) {
      contracts.push(new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, getProvider()));
    }
    return contracts;
  }
  function reportStatusLabel(status) {
    const labels = lang === "zh"
      ? ["已送出", "審查中", "已確認", "已駁回", "已結案"]
      : ["Submitted", "Reviewing", "Confirmed", "Rejected", "Closed"];
    return labels[Number(status)] || (lang === "zh" ? "未知" : "Unknown");
  }

  function getProofDepth(memberList = members) {
    if (!memberList.length) return 1;
    const group = new Group(memberList);
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

  async function preloadProofArtifacts(depthOverride) {
    const depth = depthOverride || getProofDepth();
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
    const naclModule = await import("tweetnacl");
    const nacl = naclModule.default || naclModule;
    let pubKeyBytes;
    try {
      pubKeyBytes = base64ToBytes(pubKey.trim());
    } catch {
      throw new Error(lang === "zh" ? "Admin 加密公鑰格式錯誤，請重新取得並設定公司 Admin 公鑰。" : "Invalid Admin encryption public key. Please get and set the company Admin public key again.");
    }
    if (pubKeyBytes.length !== nacl.box.publicKeyLength) {
      throw new Error(lang === "zh" ? "Admin 加密公鑰長度不正確，請重新取得並設定公司 Admin 公鑰。" : "Invalid Admin encryption public key length. Please get and set the company Admin public key again.");
    }
    const ephemeralKeyPair = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = new TextEncoder().encode(plainText);
    const encryptedMessage = nacl.box(messageBytes, nonce, pubKeyBytes, ephemeralKeyPair.secretKey);
    const enc = {
      version: "x25519-xsalsa20-poly1305",
      nonce: bytesToBase64(nonce),
      ephemPublicKey: bytesToBase64(ephemeralKeyPair.publicKey),
      ciphertext: bytesToBase64(encryptedMessage)
    };
    const hex = "0x" + Buffer.from(JSON.stringify(enc), "utf8").toString("hex");
    return hex;
  }

  async function uploadEncryptedReportToIpfs(encryptedPayload) {
    const api = ipfsClusterApi.trim().replace(/\/+$/, "");
    if (!api) {
      throw new Error(lang === "zh" ? "系統尚未設定 IPFS Cluster API，請通知開發者檢查環境設定。" : "IPFS Cluster API is not configured. Ask a developer to check environment settings.");
    }
    if (!ipfsClusterUser.trim() || !ipfsClusterPassword.trim()) {
      throw new Error(lang === "zh"
        ? "系統尚未設定 IPFS Cluster 使用者或密碼，請通知開發者在 frontend/.env 設定 VITE_IPFS_CLUSTER_USER / VITE_IPFS_CLUSTER_PASSWORD 並重新啟動前端。"
        : "IPFS Cluster user/password is not configured. Ask a developer to set VITE_IPFS_CLUSTER_USER / VITE_IPFS_CLUSTER_PASSWORD in frontend/.env and restart the frontend.");
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
    if (!window.ethereum) throw new Error(lang === "zh" ? "請先安裝 MetaMask" : "Please install MetaMask");
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWallet(account || "");
    setStatus("Wallet connected");
    pushToast("success", "Wallet connected");
    return account || "";
  }

  async function switchToLocal() {
    if (!window.ethereum) throw new Error(lang === "zh" ? "請先安裝 MetaMask" : "Please install MetaMask");
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
    if (!window.ethereum) throw new Error(lang === "zh" ? "請先安裝 MetaMask" : "Please install MetaMask");
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
    if (!canRead) throw new Error(lang === "zh" ? "請設定合約地址；若使用 burner 模式也請設定 RPC" : "Please set the contract address; in burner mode also set the RPC URL");
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
    if (!gateway) throw new Error(lang === "zh" ? "請填寫 Private IPFS Gateway" : "Please enter Private IPFS Gateway");

    const startedAt = performance.now();
    let gatewayText = "gateway=unreachable";
    let cidText = "cid=not-tested";

    try {
      const response = await fetch(gateway, { method: "GET", cache: "no-store" });
      gatewayText = `gateway=reachable status=${response.status}`;
    } catch (error) {
      throw new Error(`${lang === "zh" ? "IPFS Gateway 連線失敗" : "IPFS Gateway connection failed"}: ${parseErr(error)}`);
    }

    const cid = ipfsCID.trim();
    if (cid) {
      const response = await fetch(`${gateway}/ipfs/${cid}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${lang === "zh" ? "IPFS CID 讀取失敗" : "IPFS CID fetch failed"}: status=${response.status}`);
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
    const targetReportGroupId = reportGroupId.trim();
    let addLogs = [];
    let removeLogs = [];
    let lastError = null;
    for (const c of getReadContracts()) {
      try {
        const addFilter = targetReportGroupId ? c.filters.EmployeeMemberAdded(targetReportGroupId, null) : c.filters.EmployeeMemberAdded();
        const removeFilter = targetReportGroupId ? c.filters.EmployeeMemberRemoved(targetReportGroupId, null) : c.filters.EmployeeMemberRemoved();
        [addLogs, removeLogs] = await Promise.all([
          c.queryFilter(addFilter, 0, "latest"),
          c.queryFilter(removeFilter, 0, "latest")
        ]);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!addLogs.length && lastError) {
      const msg = parseErr(lastError);
      if (msg.includes("讀取合約失敗") || msg.includes("Contract read failed")) throw new Error(msg);
    }
    const events = [
      ...addLogs.map((log) => ({ log, type: "add" })),
      ...removeLogs.map((log) => ({ log, type: "remove" }))
    ].sort((a, b) => (a.log.blockNumber - b.log.blockNumber) || (a.log.logIndex - b.log.logIndex));
    if (!events.length && targetReportGroupId && membersReportGroupId === targetReportGroupId && members.length > 0) {
      setStatus(lang === "zh"
        ? `事件查詢沒有回傳新資料，保留目前本機已同步的 ${members.length} 位成員。若重新整理後歸零，請確認 RPC 與 MetaMask 是否在同一條鏈。`
        : `Event query returned no logs; keeping ${members.length} locally synced members. If this resets after refresh, check that RPC and MetaMask use the same chain.`);
      pushToast("success", lang === "zh" ? `保留目前 ${members.length} 位成員` : `Keeping ${members.length} current members`);
      return members;
    }
    const current = [];
    for (const event of events) {
      const commitment = event.log.args.identityCommitment.toString();
      const index = current.indexOf(commitment);
      if (event.type === "add" && index === -1) current.push(commitment);
      if (event.type === "remove" && index !== -1) current.splice(index, 1);
    }
    const list = current;
    setMembers(list);
    setMembersReportGroupId(targetReportGroupId || "all");
    setStatus(`Loaded ${list.length} members for reportGroupId=${targetReportGroupId || "all"}`);
    pushToast("success", lang === "zh" ? `已載入 ${list.length} 位群組成員` : `Loaded ${list.length} group members`);
    return list;
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
    const receipt = await tx.wait();
    const evt = receipt.events?.find((e) => e.event === "EmployeeMemberAdded");
    if (!evt) {
      throw new Error(lang === "zh"
        ? "交易已送出但沒有收到 EmployeeMemberAdded 事件，請確認合約版本與前端 ABI 是否一致。"
        : "Transaction completed but EmployeeMemberAdded event was not found. Check contract version and frontend ABI.");
    }
    setMembers((prev) => (membersReportGroupId === reportGroupId.trim() && !prev.includes(commitment) ? [...prev, commitment] : prev));
    setMembersReportGroupId(reportGroupId.trim());
    setStatus(lang === "zh" ? `員工已加入 reportGroupId=${reportGroupId.trim()}` : `Employee added to reportGroupId=${reportGroupId.trim()}`);
    pushToast("success", lang === "zh" ? "員工已加入，已同步本機成員列表" : "Employee added and local member list synced");
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
    setMembersReportGroupId(reportGroupId.trim());
    setStatus("Employee commitment removed");
    pushToast("success", "Employee removed");
  }

  async function adminCreateCompany() {
    const name = companyName.trim();
    if (!name) throw new Error(lang === "zh" ? "請填寫公司名稱" : "Please enter company name");
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
    if (!companyId.trim()) throw new Error(lang === "zh" ? "請填寫公司 ID" : "Please enter companyId");
    if (!topicName.trim()) throw new Error(lang === "zh" ? "請填寫舉報主題名稱" : "Please enter topic name");
    const maxReports = Number(maxReportsPerMember || "0");
    if (!Number.isInteger(maxReports) || maxReports <= 0) throw new Error(lang === "zh" ? "每位員工可舉報次數必須大於 0" : "maxReportsPerMember must be greater than 0");
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
    setMembersReportGroupId("");
    setStatus(`Report group created${id ? `: ${id}` : ""}`);
    pushToast("success", "Report group created");
  }

  async function ensureCurrentGroupMembers() {
    const targetReportGroupId = reportGroupId.trim();
    if (!targetReportGroupId) {
      throw new Error(lang === "zh" ? "請先填寫舉報主題 ID / Report Group ID" : "Please enter reportGroupId first");
    }

    if (members.length && membersReportGroupId === targetReportGroupId) {
      return members;
    }

    setStatus(lang === "zh" ? `正在載入 reportGroupId=${targetReportGroupId} 的成員...` : `Loading members for reportGroupId=${targetReportGroupId}...`);
    const loaded = await loadMembersFromEvents();
    if (!loaded.length) {
      throw new Error(lang === "zh"
        ? `reportGroupId=${targetReportGroupId} 目前沒有任何員工 commitment。請先到 Admin 分頁把員工加入這個舉報主題，再產生匿名憑證。`
        : `reportGroupId=${targetReportGroupId} has no employee commitments. Add an employee in the Admin tab before preparing a credential.`);
    }
    return loaded;
  }

  async function prepareAnonymousCredential() {
    if (!reporterIdentityExport.trim()) {
      throw new Error(lang === "zh"
        ? "請先在步驟 1 產生或貼上 Reporter Identity，再產生匿名憑證。"
        : "Please generate or paste a Reporter Identity in Step 1 before preparing a credential.");
    }
    if (!companyId.trim() || !reportGroupId.trim() || !period.trim() || !reportSlot.trim()) {
      throw new Error(lang === "zh"
        ? "請填寫公司 ID、舉報主題 ID、舉報期間與舉報次數 slot。"
        : "Please enter companyId, reportGroupId, period, and reportSlot.");
    }

    const memberList = await ensureCurrentGroupMembers();
    const c = getReadContract();
    const rg = await c.reportGroups(reportGroupId.trim());
    const gid = rg.semaphoreGroupId.toString();

    const identity = Identity.import(reporterIdentityExport.trim());
    const reporterCommitment = identity.commitment.toString();
    setReporterCommitmentPreview(reporterCommitment);

    if (!memberList.includes(reporterCommitment)) {
      throw new Error(lang === "zh"
        ? `目前 Reporter Identity 的 commitment 不在 reportGroupId=${reportGroupId.trim()} 的成員名單中。請確認 Admin 已把這組 commitment 加入該舉報主題，或改用已加入的 Identity。`
        : `The current Reporter Identity commitment is not a member of reportGroupId=${reportGroupId.trim()}. Add this commitment in Admin or use an enrolled identity.`);
    }

    const group = new Group(memberList);
    const scope = buildCredentialScope();
    const message = buildCredentialMessage();
    const depth = getProofDepth(memberList);
    const artifacts = proofArtifacts && proofArtifactsStatus === `ready depth=${depth}` ? proofArtifacts : await preloadProofArtifacts(depth);
    const proof = await generateProof(identity, group, message, scope, depth, artifacts);

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
    setStatus(lang === "zh" ? "匿名憑證已產生，可以進行加密並準備舉報。" : "Anonymous credential prepared. You can encrypt and prepare the report now.");
    pushToast("success", lang === "zh" ? "匿名憑證已產生" : "Anonymous credential prepared");
  }

  async function generateProofAndEncrypt() {
    if (!reportPlaintext.trim()) {
      throw new Error(lang === "zh" ? "請先填寫舉報內容" : "Please enter report content");
    }
    if (!proofJson.trim() || preparedCredentialContext !== credentialContext) {
      setStatus(lang === "zh" ? "目前沒有可用匿名憑證，正在先幫你產生..." : "No valid anonymous credential yet. Preparing it first...");
      await prepareAnonymousCredential();
    }
    if (!companyId.trim() || !reportGroupId.trim()) {
      throw new Error(lang === "zh" ? "請填寫公司 ID 與舉報主題 ID" : "Please enter companyId and reportGroupId");
    }

    const c = getReadContract();
    const company = await c.companies(companyId.trim());
    const adminPub = company.adminPublicKey || await c.adminEncryptionPublicKey();
    if (!adminPub) {
      throw new Error(lang === "zh"
        ? "這間公司尚未設定 Admin 加密公鑰。請先到 Admin 分頁設定公司 Admin 公鑰。"
        : "Admin public key is not set for this company. Set it in the Admin tab first.");
    }

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
    setMessageHash(contentHash);
    setIpfsCID("");
    setStatus(lang === "zh"
      ? "舉報已在本機加密並準備完成。burner 模式會在送出前先做鏈上預檢，通過後才上傳 IPFS。"
      : "Report encrypted locally and prepared. In burner mode, the app preflights the chain before uploading to IPFS.");
    pushToast("success", lang === "zh" ? "舉報已加密並準備完成" : "Report encrypted + prepared");
    return { encrypted, contentHash, secretKey };
  }

  async function submitAnonymousReport() {
    if (!proofJson.trim()) throw new Error(lang === "zh" ? "請先產生匿名憑證" : "Please prepare an anonymous credential first");
    if (preparedCredentialContext !== credentialContext) {
      throw new Error(lang === "zh" ? "匿名憑證與目前公司/主題/期間/slot 不一致，請重新產生。" : "Anonymous credential does not match the current company/group/period/slot. Please regenerate it.");
    }
    let effectiveEncryptedReport = encryptedReport.trim();
    let effectiveMessageHash = messageHash.trim();
    let effectiveThreadSecretKey = threadSecretKey;
    if (!effectiveEncryptedReport || !effectiveMessageHash) {
      const generated = await generateProofAndEncrypt();
      effectiveEncryptedReport = generated.encrypted;
      effectiveMessageHash = generated.contentHash;
      effectiveThreadSecretKey = generated.secretKey;
    }
    if (!effectiveMessageHash) throw new Error(lang === "zh" ? "缺少訊息雜湊，請先加密並準備舉報。" : "Missing messageHash");

    const proof = JSON.parse(proofJson);
    const buildRequest = (cid) => ({
      companyId: companyId.trim(),
      reportGroupId: reportGroupId.trim(),
      ipfsCID: cid,
      contentHash: effectiveMessageHash,
      period: period.trim(),
      reportSlot: reportSlot.trim()
    });
    const provider = getBurnerProvider();
    const network = await provider.getNetwork();
    if (network.chainId === 80002) {
      throw new Error("Amoy is a public testnet. Burner wallet still needs POL there. Use burner mode only on local/permissioned zero-gas chains.");
    }
    const burner = ethers.Wallet.createRandom().connect(provider);
    setLastBurnerAddress(burner.address);
    const c = new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, burner);
    const preflightRequest = buildRequest("preflight-cid");
    try {
      await c.callStatic.submitAnonymousReport(preflightRequest, proof, { gasPrice: 0 });
    } catch (error) {
      throw new Error(lang === "zh"
        ? `鏈上預檢未通過，尚未上傳 IPFS。可能原因：舉報次數 slot 已用過、quota 超出、proof 已失效或公司/主題不相符。原始錯誤：${parseErr(error)}`
        : `On-chain preflight failed before IPFS upload. Possible causes: used slot, quota exceeded, stale proof, or company/group mismatch. Raw error: ${parseErr(error)}`);
    }
    const submittedIpfsCID = await uploadEncryptedReportToIpfs(effectiveEncryptedReport);
    setIpfsCID(submittedIpfsCID);
    const tx = await c.submitAnonymousReport(buildRequest(submittedIpfsCID), proof, { gasPrice: 0 });

    const receipt = await tx.wait();
    const evt = receipt.events?.find((e) => e.event === "AnonymousReportSubmitted");
    const submittedReportId = evt?.args?.reportId?.toString?.() || "";
    if (submittedReportId) {
      setThreadReportId(submittedReportId);
      setLastSubmittedThread({
        reportId: submittedReportId,
        threadSecretKey: effectiveThreadSecretKey,
        ipfsCID: submittedIpfsCID,
        submittedAt: new Date().toISOString()
      });
    }
    setStatus(lang === "zh"
      ? `匿名舉報已送出${submittedReportId ? `，Report ID=${submittedReportId}` : ""}。請保存 thread secret key。`
      : `Anonymous report submitted${submittedReportId ? `, Report ID=${submittedReportId}` : ""}. Save the thread secret key.`);
    pushToast("success", lang === "zh" ? "burner wallet 已送出舉報" : "Report submitted by burner wallet");
  }

  async function loadAllReports(companyOnly = false) {
    const filter = typeof companyOnly === "object" ? companyOnly : { companyOnly };
    const c = getReadContract();
    const total = Number((await c.reportCount()).toString());
    const list = [];
    for (let i = 1; i <= total; i++) {
      const r = await c.reports(i);
      if (filter.companyOnly && r.companyId.toString() !== companyId.trim()) continue;
      if (filter.groupOnly && r.reportGroupId.toString() !== reportGroupId.trim()) continue;
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
    const scopeText = filter.groupOnly ? ` reportGroupId=${reportGroupId.trim()}` : filter.companyOnly ? ` companyId=${companyId.trim()}` : "";
    setStatus(`Loaded ${list.length}${scopeText} reports`);
    pushToast("success", lang === "zh" ? `已載入 ${list.length} 筆舉報` : `Loaded ${list.length} reports`);
    return list;
  }

  async function loadAllCompanies() {
    const c = getReadContract();
    const companyMap = new Map();
    try {
      const total = Number((await c.companyCount()).toString());
      for (let i = 1; i <= total; i++) {
        const company = await c.companies(i);
        if (!company.id || company.id.toString() === "0") continue;
        companyMap.set(company.id.toString(), {
          id: company.id.toString(),
          companyName: company.companyName,
          adminAddress: company.adminAddress,
          adminPublicKey: company.adminPublicKey,
          active: company.active
        });
      }
    } catch (error) {
      const msg = parseErr(error);
      if (msg.includes("讀取合約失敗") || msg.includes("Contract read failed")) {
        const eventContract = getReadContracts()[0];
        const logs = await eventContract.queryFilter(eventContract.filters.CompanyCreated(), 0, "latest");
        for (const log of logs) {
          const id = log.args.companyId.toString();
          companyMap.set(id, {
            id,
            companyName: log.args.companyName,
            adminAddress: log.args.adminAddress,
            adminPublicKey: "",
            active: true
          });
        }
      } else {
        throw error;
      }
    }
    const list = [...companyMap.values()].sort((a, b) => Number(a.id) - Number(b.id));
    setCompanies(list);
    setStatus(lang === "zh" ? `已載入 ${list.length} 間公司` : `Loaded ${list.length} companies`);
    pushToast("success", lang === "zh" ? `已載入 ${list.length} 間公司` : `Loaded ${list.length} companies`);
    return list;
  }

  async function loadCompanyReportGroups() {
    if (!companyId.trim()) {
      throw new Error(lang === "zh" ? "請先填寫公司 ID" : "Please enter companyId first");
    }

    const c = getReadContract();
    let groupIds = [];
    let reportTotal;
    const groupEventDetails = new Map();
    try {
      const [groupTotalResult, reportTotalResult] = await Promise.all([
        c.reportGroupCount(),
        c.reportCount()
      ]);
      groupIds = Array.from({ length: Number(groupTotalResult.toString()) }, (_, index) => index + 1);
      reportTotal = reportTotalResult;
    } catch (error) {
      const msg = parseErr(error);
      if (!msg.includes("讀取合約失敗") && !msg.includes("Contract read failed")) throw error;
      const eventContract = getReadContracts()[0];
      const logs = await eventContract.queryFilter(eventContract.filters.ReportGroupCreated(null, companyId.trim()), 0, "latest");
      for (const log of logs) {
        const id = log.args.reportGroupId.toString();
        groupEventDetails.set(id, {
          id,
          companyId: log.args.companyId.toString(),
          topicName: log.args.topicName,
          maxReportsPerMember: "-",
          startTime: 0,
          endTime: 0,
          semaphoreGroupId: log.args.semaphoreGroupId.toString(),
          active: true,
          reportCount: 0
        });
      }
      groupIds = [...new Set(logs.map((log) => Number(log.args.reportGroupId.toString())))].sort((a, b) => a - b);
      try {
        reportTotal = await c.reportCount();
      } catch {
        reportTotal = ethers.BigNumber.from(0);
      }
    }
    const reportCounts = {};
    for (let i = 1; i <= Number(reportTotal.toString()); i++) {
      const r = await c.reports(i);
      const gid = r.reportGroupId.toString();
      reportCounts[gid] = (reportCounts[gid] || 0) + 1;
    }

    const groups = [];
    for (const id of groupIds) {
      try {
        const rg = await c.reportGroups(id);
        if (rg.companyId.toString() !== companyId.trim()) continue;
        groups.push({
          id: rg.id.toString(),
          companyId: rg.companyId.toString(),
          topicName: rg.topicName,
          maxReportsPerMember: rg.maxReportsPerMember.toString(),
          startTime: Number(rg.startTime),
          endTime: Number(rg.endTime),
          semaphoreGroupId: rg.semaphoreGroupId.toString(),
          active: rg.active,
          reportCount: reportCounts[rg.id.toString()] || 0
        });
      } catch (error) {
        const fallback = groupEventDetails.get(String(id));
        if (fallback) {
          groups.push({ ...fallback, reportCount: reportCounts[String(id)] || 0 });
        } else {
          throw error;
        }
      }
    }
    setCompanyReportGroups(groups);
    setStatus(lang === "zh" ? `已載入公司 ${companyId.trim()} 的 ${groups.length} 個舉報主題` : `Loaded ${groups.length} report groups for company ${companyId.trim()}`);
    pushToast("success", lang === "zh" ? `已載入 ${groups.length} 個舉報主題` : `Loaded ${groups.length} report groups`);
    return groups;
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
    const adminWallet = wallet || await connectWallet();
    if (!adminWallet) throw new Error(lang === "zh" ? "請先連接 Admin 錢包" : "Please connect Admin wallet first");
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;
    const encryptedPayload = await fetchEncryptedReportFromIpfs(target);
    let plain;
    let recoveredThreadKey = "";
    try {
      const payload = JSON.parse(encryptedPayload);
      if (payload.version === "thread-hybrid-v1" && payload.encryptedKey) {
        recoveredThreadKey = await window.ethereum.request({ method: "eth_decrypt", params: [payload.encryptedKey, adminWallet] });
        plain = await decryptWithThreadKey(recoveredThreadKey, payload.cipher);
      } else {
        plain = await window.ethereum.request({ method: "eth_decrypt", params: [encryptedPayload, adminWallet] });
      }
    } catch {
      plain = await window.ethereum.request({ method: "eth_decrypt", params: [encryptedPayload, adminWallet] });
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
    if (senderRole === 2) {
      const provider = getBurnerProvider();
      const network = await provider.getNetwork();
      if (network.chainId === 80002) throw new Error("Amoy burner replies still need POL. Use local/permissioned zero-gas RPC.");
      const burner = ethers.Wallet.createRandom().connect(provider);
      setLastBurnerAddress(burner.address);
      const c = new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, burner);
      tx = await c.addReportMessage(reportId, senderRole, cid, contentHash, { gasPrice: 0 });
    } else {
      if (!wallet) await connectWallet();
      tx = await getSignerContract().addReportMessage(reportId, senderRole, cid, contentHash);
    }
    await tx.wait();
    await loadReportMessages(reportId);
    pushToast("success", "Thread reply submitted");
  }

  async function adminSendReply(reportId) {
    const report = reports.find((r) => r.id === reportId);
    const key = report?.threadSecretKey || "";
    if (!key) {
      throw new Error(lang === "zh" ? "請先按「解密」取得此案件的 thread secret key，再送出 Admin 回覆。" : "Please decrypt this report first to recover its thread secret key before sending an Admin reply.");
    }
    const text = adminReplyDrafts[reportId] || "";
    await addThreadMessageOnChain(String(reportId), 1, text, key);
    setAdminReplyDrafts((prev) => ({ ...prev, [reportId]: "" }));
  }

  async function reporterSendReply() {
    await addThreadMessageOnChain(threadReportId.trim(), 2, reporterReplyText, threadSecretKey.trim());
    setReporterReplyText("");
  }

  const roleViews = {
    saasAdmin: {
      icon: "◇",
      title: t.saasAdmin,
      eyebrow: lang === "zh" ? "平台營運視角" : "Platform operator",
      description: lang === "zh"
        ? "建立公司租戶，維持聯盟鏈平台治理入口。"
        : "Onboard company tenants and operate the consortium platform.",
      primary: lang === "zh" ? "公司建立" : "Company onboarding",
      accent: "amber"
    },
    admin: {
      icon: "◆",
      title: t.admin,
      eyebrow: lang === "zh" ? "公司處理單位" : "Company workspace",
      description: lang === "zh"
        ? "建立舉報主題、管理員工資格、解密與處理案件。"
        : "Create report topics, manage membership, decrypt, and review cases.",
      primary: lang === "zh" ? "案件處理" : "Case operations",
      accent: "blue"
    },
    employee: {
      icon: "●",
      title: t.employee,
      eyebrow: lang === "zh" ? "匿名舉報者" : "Anonymous reporter",
      description: lang === "zh"
        ? "產生匿名憑證、加密舉報、保存 thread key 後匿名追蹤。"
        : "Prepare anonymous credentials, encrypt reports, and follow up privately.",
      primary: lang === "zh" ? "匿名提交" : "Anonymous submit",
      accent: "green"
    }
  };
  const currentRole = roleViews[activeTab];
  const connectionState = wallet
    ? (lang === "zh" ? "錢包已連接" : "Wallet connected")
    : (lang === "zh" ? "錢包未連接" : "Wallet not connected");
  const contractState = CONTRACT_ADDRESS
    ? (lang === "zh" ? "合約已設定" : "Contract configured")
    : (lang === "zh" ? "合約未設定" : "Contract missing");
  const isWorking = Object.values(loading).some(Boolean) || proofArtifactsStatus.startsWith("loading");
  const assistantStatus = status || (lang === "zh" ? "我會在這裡同步顯示目前執行狀態。" : "I will show the current execution status here.");

  function clampBotPosition(x, y) {
    if (typeof window === "undefined") return { x, y };
    const maxX = Math.max(16, window.innerWidth - 330);
    const maxY = Math.max(16, window.innerHeight - 150);
    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY)
    };
  }

  function startBotDrag(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    botDragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    setBotDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveBot(event) {
    if (!botDragging) return;
    setBotPosition(clampBotPosition(
      event.clientX - botDragOffset.current.x,
      event.clientY - botDragOffset.current.y
    ));
  }

  function endBotDrag(event) {
    setBotDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const Btn = ({ label, k, onClick, primary = false, disabled = false }) => (
    <button
      className={`action-button ${primary ? "action-button--primary" : ""}`}
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
      {loading[k] ? "... " : ""}{label}
    </button>
  );

  return (
    <div className={`app-redesign role-${activeTab}`} style={{ minHeight: "100vh", background: "#f3f6fb", padding: 16 }}>
      <div className="toast-stack" style={{ position: "fixed", right: 16, top: 16, zIndex: 9999, display: "grid", gap: 8 }}>
        {toasts.map((x) => (
          <div key={x.id} className={`toast-card toast-card--${x.kind}`} style={{ minWidth: 280, maxWidth: 420, borderRadius: 10, border: "1px solid " + (x.kind === "success" ? "#86efac" : "#fca5a5"), background: x.kind === "success" ? "#f0fdf4" : "#fef2f2", color: x.kind === "success" ? "#166534" : "#991b1b", padding: "10px 12px" }}>
            <strong>{x.kind === "success" ? ui.success : ui.error}</strong>
            <div>{x.msg}</div>
          </div>
        ))}
      </div>

      <div
        className={`floating-assistant ${botDragging ? "is-dragging" : ""} ${isWorking ? "is-working" : ""}`}
        style={{ left: botPosition.x, top: botPosition.y }}
        onPointerDown={startBotDrag}
        onPointerMove={moveBot}
        onPointerUp={endBotDrag}
        onPointerCancel={endBotDrag}
        role="status"
        aria-live="polite"
        title={lang === "zh" ? "拖曳我到喜歡的位置" : "Drag me anywhere you like"}
      >
        <div className="assistant-bubble">
          <div className="assistant-bubble__topline">
            <span className="assistant-live-dot" />
            {isWorking ? (lang === "zh" ? "執行中" : "Working") : (lang === "zh" ? "系統助理" : "System assistant")}
          </div>
          <div className="assistant-bubble__message">{assistantStatus}</div>
        </div>
        <div className="assistant-bot" aria-hidden="true">
          <div className="assistant-bot__antenna" />
          <div className="assistant-bot__face">
            <span />
            <span />
          </div>
          <div className="assistant-bot__body" />
        </div>
      </div>

      {showHelp ? (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 18 }}>
          <div className="help-modal" style={{ width: "min(860px, 100%)", maxHeight: "86vh", overflow: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)" }}>
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{helpCopy.title}</h2>
              <button onClick={() => setShowHelp(false)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 10px", background: "#fff", cursor: "pointer" }}>
                {ui.close}
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

      <div className="product-frame" style={{ maxWidth: 1320, margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
        <div className="product-hero" style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="hero-copy">
            <div className="hero-kicker">{currentRole.eyebrow}</div>
            <h1 style={{ margin: 0 }}>{t.title}</h1>
            <p className="hero-description">{currentRole.description}</p>
            <div className="hero-pills">
              <span className={`status-pill ${CONTRACT_ADDRESS ? "is-good" : "is-warn"}`}>{contractState}</span>
              <span className={`status-pill ${wallet ? "is-good" : "is-muted"}`}>{connectionState}</span>
              <span className="status-pill is-muted">CID via Private IPFS</span>
            </div>
            <div className="hero-meta">Contract: {CONTRACT_ADDRESS || "(set VITE_CONTRACT_ADDRESS)"}</div>
            <div className="hero-meta">Wallet: {wallet || "(not connected)"}</div>
          </div>
          <button
            className="help-button"
            onClick={() => setShowHelp(true)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {lang === "zh" ? "使用說明" : "Help"}
          </button>
        </div>

        <div className="workspace-grid" style={{ display: "grid", gridTemplateColumns: showPanel ? "340px 1fr" : "70px 1fr", minHeight: "calc(100vh - 150px)", transition: "grid-template-columns .2s ease" }}>
          <aside className="control-panel" style={{ borderRight: "1px solid #e5e7eb", padding: 12, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: showPanel ? "space-between" : "center", marginBottom: 10 }}>
              {showPanel ? <strong>{t.control}</strong> : null}
              <button onClick={() => setShowPanel((v) => !v)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>{showPanel ? ui.collapse : ui.expand}</button>
            </div>
            {showPanel ? (
              <>
                <div className="control-card" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.connect} k="connect" onClick={connectWallet} primary />
                    <Btn label={t.local} k="local" onClick={switchToLocal} />
                    <Btn label={t.amoy} k="amoy" onClick={switchToAmoy} />
                  </div>
                </div>
                <div className="control-card" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.check} k="check" onClick={checkContractHealth} disabled={!canRead} />
                    <Btn label={t.ipfsCheck} k="ipfsCheck" onClick={checkIpfsHealth} />
                    <Btn label={t.gid} k="gid" onClick={loadGroupId} disabled={!canRead} />
                    <Btn label={t.members} k="members" onClick={loadMembersFromEvents} disabled={!canRead} />
                  </div>
                  <Field label={ui.labels.ipfsGateway} hint={ui.examples.ipfsGateway} value={ipfsGateway} onChange={(e) => setIpfsGateway(e.target.value)} placeholder="e.g. http://127.0.0.1:8080" style={{ marginTop: 10 }} />
                  <div style={{ marginTop: 10, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{diag || "Diag: -"}</div>
                </div>
                <div className="control-card" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setLang("zh")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: lang === "zh" ? "#111827" : "#fff", color: lang === "zh" ? "#fff" : "#111827", cursor: "pointer" }}>中文</button>
                    <button onClick={() => setLang("en")} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: lang === "en" ? "#111827" : "#fff", color: lang === "en" ? "#fff" : "#111827", cursor: "pointer" }}>English</button>
                  </div>
                </div>
              </>
            ) : null}
          </aside>

          <main className="role-workspace" style={{ padding: 16 }}>
            <div className="role-switcher" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {Object.entries(roleViews).map(([key, role]) => (
                <button
                  key={key}
                  className={`role-card role-card--${role.accent} ${activeTab === key ? "is-active" : ""}`}
                  onClick={() => setActiveTab(key)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: activeTab === key ? "#111827" : "#fff", color: activeTab === key ? "#fff" : "#111827", cursor: "pointer", fontWeight: 700 }}
                >
                  <span className="role-card__icon">{role.icon}</span>
                  <span>
                    <strong>{role.title}</strong>
                    <small>{role.primary}</small>
                  </span>
                </button>
              ))}
            </div>

            {activeTab === "saasAdmin" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.saasTitle}</h3>
                  <p style={{ color: "#64748b", marginTop: 0 }}>{ui.saasIntro}</p>
                  <Field label={ui.labels.companyId} hint={ui.examples.companyId} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" />
                  <Field label={ui.labels.newCompanyName} hint={ui.examples.newCompanyName} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. TSMC" />
                  <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.createCompany} k="createCompany" onClick={adminCreateCompany} disabled={!canUse} />
                    <Btn label={lang === "zh" ? "查詢所有公司" : "Load Companies"} k="loadCompanies" onClick={loadAllCompanies} disabled={!canRead} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>companyId: {companyId || "-"}</div>
                  {companies.length > 0 ? (
                    <div className="company-directory">
                      <div className="company-directory__header">
                        <span>ID</span>
                        <span>{lang === "zh" ? "公司名稱" : "Company"}</span>
                        <span>{lang === "zh" ? "Admin 地址" : "Admin address"}</span>
                        <span>{lang === "zh" ? "狀態" : "Status"}</span>
                      </div>
                      {companies.map((company) => (
                        <button
                          type="button"
                          key={company.id}
                          className="company-directory__row"
                          onClick={() => setCompanyId(company.id)}
                        >
                          <span>{company.id}</span>
                          <span>{company.companyName || "-"}</span>
                          <code>{company.adminAddress || "-"}</code>
                          <span>{company.active ? (lang === "zh" ? "啟用" : "Active") : (lang === "zh" ? "停用" : "Inactive")}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <HelpText>{lang === "zh" ? "建立公司後可按「查詢所有公司」確認 companyId 與 Admin 地址。" : "After creating companies, click Load Companies to confirm companyId and Admin address."}</HelpText>
                  )}
                </div>
              </div>
            ) : activeTab === "admin" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.groupTitle}</h3>
                  <p style={{ color: "#64748b", marginTop: 0 }}>{ui.groupIntro}</p>
                  <Field label={ui.labels.companyId} hint={ui.examples.companyId} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" />
                  <Field label={ui.labels.reportGroupId} hint={ui.examples.reportGroupId} value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="e.g. 1" />
                  <Field label={ui.labels.topicName} hint={ui.examples.topicName} value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder={lang === "zh" ? "例如：財務舞弊" : "e.g. financial fraud"} />
                  <Field label={ui.labels.maxReports} hint={ui.examples.maxReports} value={maxReportsPerMember} onChange={(e) => setMaxReportsPerMember(e.target.value)} placeholder="e.g. 3" />
                  <div style={{ marginBottom: 12 }}><Btn label={t.createGroup} k="createGroup" onClick={adminCreateReportGroup} disabled={!canUse} /></div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>companyId: {companyId || "-"} | reportGroupId: {reportGroupId || "-"} | Semaphore groupId: {groupId || "-"}</div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3>{ui.membershipTitle}</h3>
                  <Field label={ui.labels.reportGroupId} hint={ui.examples.reportGroupId} value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="e.g. 1" />
                  <Field label={ui.labels.employeeCommitment} hint={ui.examples.employeeCommitment} value={newMemberCommitment} onChange={(e) => setNewMemberCommitment(e.target.value)} placeholder="e.g. 2054340674573900..." />
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.addEmployee} k="addEmployee" onClick={adminAddEmployee} primary disabled={!canUse} />
                    <Btn label={t.members} k="loadMembersAdmin" onClick={loadMembersFromEvents} disabled={!canRead} />
                  </div>
                  <Field label={ui.labels.removeCommitment} hint={ui.examples.removeCommitment} value={removeMemberCommitment} onChange={(e) => setRemoveMemberCommitment(e.target.value)} placeholder="e.g. 2054340674573900..." style={{ marginTop: 10 }} />
                  <div style={{ marginTop: 8 }}><Btn label={t.removeEmployee} k="removeEmployee" onClick={adminRemoveEmployee} disabled={!canUse} /></div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>reportGroupId: {reportGroupId || "-"} | Semaphore groupId: {groupId || "-"} | active members loaded: {members.length}</div>
                  <HelpText>{ui.memberPrivacyHint}</HelpText>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.encryptionTitle}</h3>
                  <Field label={ui.labels.companyPubKeyId} hint={ui.examples.companyPubKeyId} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.getAdminPub} k="getAdminPub" onClick={adminGetEncryptionPubKey} disabled={!canUse} />
                    <Btn label={t.setAdminPub} k="setAdminPub" onClick={adminSetEncryptionPubKey} primary disabled={!canUse} />
                  </div>
                  <TextAreaField label={ui.labels.adminPubKey} hint={ui.examples.adminPubKey} value={adminEncryptionPubKey} onChange={(e) => setAdminEncryptionPubKey(e.target.value)} placeholder="e.g. 5i3P8..." height={110} mono style={{ marginTop: 10 }} />
                  <HelpText>{ui.companyKeyHint}</HelpText>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.reportsTitle}</h3>
                  <Field label={ui.labels.ipfsGateway} hint={ui.examples.ipfsGateway} value={ipfsGateway} onChange={(e) => setIpfsGateway(e.target.value)} placeholder="e.g. http://127.0.0.1:8080" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, max-content))", gap: 8, alignItems: "end", marginBottom: 8 }}>
                    <Field label={ui.labels.reportCompanyFilter} hint={ui.examples.reportCompanyFilter} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" style={{ marginBottom: 0 }} />
                    <Field label={ui.labels.reportGroupId} hint={ui.examples.reportGroupId} value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="e.g. 3" style={{ marginBottom: 0 }} />
                    <Btn label={t.loadCompanyGroups} k="loadCompanyGroupsAdmin" onClick={loadCompanyReportGroups} disabled={!canRead} />
                    <Btn label={t.loadCompanyReports} k="loadCompanyReports" onClick={() => loadAllReports(true)} disabled={!canUse} />
                    <Btn label={t.loadGroupReports} k="loadGroupReports" onClick={() => loadAllReports({ groupOnly: true })} disabled={!canUse} />
                    <Btn label={t.loadReports} k="loadReports" onClick={() => loadAllReports(false)} disabled={!canUse} />
                    <Btn label={t.decryptAll} k="decryptAll" onClick={decryptAll} disabled={!canUse || reports.length === 0} />
                  </div>
                  {companyReportGroups.length > 0 ? (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "70px 1.5fr 120px 120px 120px", gap: 8, padding: 8, background: "#f8fafc", fontWeight: 800, color: "#334155" }}>
                        <span>ID</span><span>{ui.labels.topicName}</span><span>{ui.labels.maxReports}</span><span>{lang === "zh" ? "目前舉報數" : "Reports"}</span><span>Semaphore</span>
                      </div>
                      {companyReportGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setReportGroupId(g.id)}
                          style={{ width: "100%", display: "grid", gridTemplateColumns: "70px 1.5fr 120px 120px 120px", gap: 8, padding: 8, border: 0, borderTop: "1px solid #e2e8f0", background: reportGroupId === g.id ? "#ecfdf5" : "#fff", textAlign: "left", cursor: "pointer" }}
                        >
                          <span>{g.id}</span><span>{g.topicName}</span><span>{g.maxReportsPerMember}</span><span>{g.reportCount}</span><span>{g.semaphoreGroupId}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <HelpText>{lang === "zh" ? `目前列表：${reports.length} 筆。可先查公司主題，再點選表格中的主題 ID 查指定主題舉報。` : `Current list: ${reports.length} reports. Load company groups first, then click a group row to filter reports by group.`}</HelpText>
                  {reports.length === 0 ? (
                    <div className="empty-inbox">
                      <div className="empty-inbox__icon">◎</div>
                      <strong>{ui.noReports}</strong>
                      <span>{lang === "zh" ? "請先查詢本公司或指定主題的舉報案件。" : "Load company or group reports to start reviewing cases."}</span>
                    </div>
                  ) : (
                    <div className="case-inbox">
                      {reports.map((r) => (
                        <article key={r.id} className={`case-card case-card--status-${r.status}`}>
                          <div className="case-card__summary">
                            <div className="case-id">#{r.id}</div>
                            <span className="case-status-badge">{reportStatusLabel(r.status)}</span>
                            <h4>{lang === "zh" ? "匿名舉報案件" : "Anonymous report case"}</h4>
                            <div className="case-time">{new Date(r.timestamp * 1000).toLocaleString()}</div>
                            <div className="case-chip-grid">
                              <span>Company {r.companyId}</span>
                              <span>Group {r.reportGroupId}</span>
                              <span>{r.period || "-"}</span>
                              <span>slot {r.reportSlot || "-"}</span>
                            </div>
                          </div>
                          <div className="case-card__body">
                            <div className="case-section-title">
                              <span>{lang === "zh" ? "鏈上證據摘要" : "On-chain evidence"}</span>
                              <small>{lang === "zh" ? "可驗證，但不揭露舉報者身份" : "Verifiable without revealing reporter identity"}</small>
                            </div>
                            <div className="case-metadata">
                              <div><span>IPFS CID</span><code>{r.ipfsCID}</code></div>
                              <div><span>content hash</span><code>{r.messageHash}</code></div>
                              <div><span>nullifier</span><code>{r.nullifier}</code></div>
                              <div><span>scope</span><code>{r.scope}</code></div>
                              <div><span>sender</span><code>{r.submittedBy}</code></div>
                            </div>
                            <div className="case-action-row">
                              <Btn label={t.decrypt} k={`decrypt_${r.id}`} onClick={() => decryptOne(r.id)} disabled={!canUse} />
                              <Btn label={t.loadThread} k={`loadThread_${r.id}`} onClick={() => loadReportMessages(String(r.id))} disabled={!canRead} />
                              <Btn label={t.decryptThread} k={`decryptThread_${r.id}`} onClick={() => decryptThreadMessages(String(r.id), r.threadSecretKey)} disabled={!canRead || !r.threadSecretKey} />
                            </div>
                            <div className="case-plain-panel">
                              <div className="case-section-title">
                                <span>{ui.plain}</span>
                                <small>{r.plainText ? (lang === "zh" ? "已由 Admin 私鑰解密" : "Decrypted by Admin key") : (lang === "zh" ? "尚未解密" : "Not decrypted")}</small>
                              </div>
                              <pre>{r.plainText || `(${ui.notDecrypted})`}</pre>
                            </div>
                            <div className="case-status-editor">
                              <label>
                                <span>{t.status}</span>
                                <select
                                  value={reportStatusDrafts[r.id]?.status ?? r.status}
                                  onChange={(e) => setReportStatusDrafts((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), status: e.target.value } }))}
                                >
                                  <option value="0">{lang === "zh" ? "已送出" : "Submitted"}</option>
                                  <option value="1">{lang === "zh" ? "審查中" : "Reviewing"}</option>
                                  <option value="2">{lang === "zh" ? "已確認" : "Confirmed"}</option>
                                  <option value="3">{lang === "zh" ? "已駁回" : "Rejected"}</option>
                                  <option value="4">{lang === "zh" ? "已結案" : "Closed"}</option>
                                </select>
                              </label>
                              <Field
                                label={ui.labels.statusNote}
                                hint={ui.examples.statusNote}
                                value={reportStatusDrafts[r.id]?.note ?? r.statusNote}
                                onChange={(e) => setReportStatusDrafts((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), note: e.target.value } }))}
                                placeholder={lang === "zh" ? "例如：已進入調查" : "e.g. moved to investigation"}
                                style={{ marginBottom: 0 }}
                              />
                              <Btn label={t.updateStatus} k={`status_${r.id}`} onClick={() => updateReportStatus(r.id)} disabled={!canUse} />
                            </div>
                            <div className="case-thread-panel">
                              <div className="case-section-title">
                                <span>{ui.anonymousThreadTitle}</span>
                                <small>{lang === "zh" ? "用同一組 thread key 進行匿名雙向溝通" : "Use the same thread key for anonymous follow-up"}</small>
                              </div>
                              <TextAreaField
                                label={ui.labels.adminReply}
                                hint={ui.examples.adminReply}
                                value={adminReplyDrafts[r.id] || ""}
                                onChange={(e) => setAdminReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                placeholder={lang === "zh" ? "例如：請補充發生日期與佐證" : "e.g. please provide date and evidence"}
                                height={72}
                              />
                              <div className="case-action-row"><Btn label={t.sendReply} k={`adminReply_${r.id}`} onClick={() => adminSendReply(r.id)} disabled={!CONTRACT_ADDRESS || !r.threadSecretKey} /></div>
                              {!r.threadSecretKey ? <HelpText>{lang === "zh" ? "請先按「解密」取得此案件 thread key，才能送出 Admin 回覆。" : "Decrypt this report first to recover the thread key before sending an Admin reply."}</HelpText> : null}
                              {(threadMessages[String(r.id)] || []).length > 0 ? (
                                <div className="thread-message-list">
                                  {(threadMessages[String(r.id)] || []).map((m) => (
                                    <div key={m.id} className="thread-message-card">
                                      <div>message #{m.id} | {m.senderRole === 1 ? "Admin" : "Reporter"} | {new Date(m.timestamp * 1000).toLocaleString()}</div>
                                      <div>cid: {m.ipfsCID}</div>
                                      <div>hash: {m.contentHash}</div>
                                      <pre>{ui.plain}: {m.plainText || `(${ui.encryptedOnly})`}</pre>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="employee-wizard" style={{ display: "grid", gap: 12 }}>
                <div className="wizard-step" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.companyGroupsTitle}</h3>
                  <p style={{ color: "#64748b", marginTop: 0 }}>{ui.companyGroupsIntro}</p>
                  <div className="wizard-query-row" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) auto", gap: 8, alignItems: "end", marginBottom: 10 }}>
                    <Field label={ui.labels.companyId} hint={ui.examples.companyId} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" style={{ marginBottom: 0 }} />
                    <div className="wizard-query-action">
                      <Btn label={t.loadCompanyGroups} k="loadCompanyGroupsEmployee" onClick={loadCompanyReportGroups} disabled={!canRead} />
                    </div>
                  </div>
                  {companyReportGroups.length > 0 ? (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflowX: "auto" }}>
                      <div style={{ minWidth: 640 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1.5fr 130px 130px 130px", gap: 8, padding: 8, background: "#f8fafc", fontWeight: 800, color: "#334155" }}>
                          <span>Report Group ID</span><span>{ui.labels.topicName}</span><span>{ui.labels.maxReports}</span><span>{lang === "zh" ? "目前舉報數" : "Reports"}</span><span>Semaphore</span>
                        </div>
                        {companyReportGroups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setReportGroupId(g.id)}
                            style={{ width: "100%", display: "grid", gridTemplateColumns: "80px 1.5fr 130px 130px 130px", gap: 8, padding: 8, border: 0, borderTop: "1px solid #e2e8f0", background: reportGroupId === g.id ? "#eff6ff" : "#fff", textAlign: "left", cursor: "pointer" }}
                          >
                            <span>{g.id}</span><span>{g.topicName}</span><span>{g.maxReportsPerMember}</span><span>{g.reportCount}</span><span>{g.semaphoreGroupId}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <HelpText>{lang === "zh" ? "尚未載入主題。輸入公司 ID 後按「查詢公司舉報主題」。" : "No groups loaded yet. Enter a company ID and click Load Company Report Groups."}</HelpText>
                  )}
                </div>

                <div className="wizard-step" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.step1Title}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.genIdentity} k="genIdentity" onClick={async () => createIdentity()} />
                    <Btn label={t.importIdentity} k="importIdentity" onClick={async () => importIdentity()} />
                    <Btn label={t.previewReporter} k="previewReporter" onClick={async () => previewReporter()} />
                  </div>
                  <TextAreaField label={ui.labels.identityPrivateKey} hint={ui.examples.identityPrivateKey} value={identityExport} onChange={(e) => setIdentityExport(e.target.value)} placeholder="e.g. eyJ0cmFwZG9vciI6..." height={88} mono style={{ marginTop: 10 }} />
                  <div>{ui.identityCommitment}: {identityCommitment || "-"}</div>
                  <TextAreaField label={ui.labels.reporterPrivateKey} hint={ui.examples.reporterPrivateKey} value={reporterIdentityExport} onChange={(e) => setReporterIdentityExport(e.target.value)} placeholder="e.g. eyJ0cmFwZG9vciI6..." height={88} mono style={{ marginTop: 10 }} />
                  <div>{ui.reporterCommitment}: {reporterCommitmentPreview || "-"}</div>
                </div>

                <div className="wizard-step" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.step2Title}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <Field label={ui.labels.companyId} hint={ui.examples.companyId} value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. 2" style={{ marginBottom: 0 }} />
                    <Field label={ui.labels.reportGroupId} hint={ui.examples.reportGroupId} value={reportGroupId} onChange={(e) => setReportGroupId(e.target.value)} placeholder="e.g. 1" style={{ marginBottom: 0 }} />
                    <Field label={ui.labels.period} hint={ui.examples.period} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026-Q1" style={{ marginBottom: 0 }} />
                    <Field label={ui.labels.reportSlot} hint={ui.examples.reportSlot} value={reportSlot} onChange={(e) => setReportSlot(e.target.value)} placeholder="e.g. 1" style={{ marginBottom: 0 }} />
                  </div>
                  <TextAreaField label={ui.labels.reportPlaintext} hint={ui.examples.reportPlaintext} value={reportPlaintext} onChange={(e) => setReportPlaintext(e.target.value)} placeholder={lang === "zh" ? "例如：請描述事件時間、地點、人物與佐證" : "e.g. describe time, location, people involved, and evidence"} height={110} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <Btn label={t.preloadProof} k="preloadProof" onClick={preloadProofArtifacts} disabled={!canRead} />
                    <Btn label={t.prepareCredential} k="prepareCredential" onClick={prepareAnonymousCredential} primary disabled={!canRead} />
                    <Btn label={t.genProof} k="genProof" onClick={generateProofAndEncrypt} disabled={!canRead} />
                  </div>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>{ui.proofArtifacts}: {proofArtifactsStatus}</div>
                  <div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{ui.preparedCredential}: {preparedCredentialContext || "-"}</div>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>{ui.messageHash}: {messageHash || "-"}</div>
                  <div style={{ marginTop: 8, border: "1px solid #facc15", background: "#fffbeb", borderRadius: 10, padding: 10, overflowWrap: "anywhere" }}>
                    <strong>{ui.threadKeyTitle}</strong>
                    <div style={{ marginTop: 4, fontFamily: "ui-monospace,monospace" }}>{threadSecretKey || `(${ui.generatedAfterEncrypt})`}</div>
                    <div style={{ marginTop: 4, color: "#92400e", fontSize: 13 }}>{ui.threadKeyHint}</div>
                  </div>
                  <div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{ui.proofScope}: {proofScope || "-"}</div>
                  <TextAreaField label={ui.labels.encryptedPayload} hint={ui.examples.encryptedPayload} value={encryptedReport} onChange={(e) => setEncryptedReport(e.target.value)} placeholder="e.g. { cipher, encryptedKey, ... }" height={80} mono style={{ marginTop: 10 }} />
                  <TextAreaField label={ui.labels.proofJson} hint={ui.examples.proofJson} value={proofJson} onChange={(e) => setProofJson(e.target.value)} placeholder="e.g. { merkleTreeRoot, nullifier, proof, ... }" height={160} mono />
                </div>

                <div className="wizard-step" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{ui.step3Title}</h3>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>{t.burnerMode}</div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#fff" }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{ui.systemSubmitSettings}</div>
                      <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{ui.systemSubmitHint}</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 4, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#334155", overflowWrap: "anywhere" }}>
                        <span>RPC: {burnerRpcUrl || "-"}</span>
                        <span>IPFS Cluster API: {ipfsClusterApi || "-"}</span>
                        <span>IPFS Cluster User: {ipfsClusterUser || "-"}</span>
                        <span>IPFS Cluster Password: {ipfsClusterPassword ? "configured" : "missing"}</span>
                      </div>
                      <div style={{ marginTop: 8, color: ipfsClusterPassword ? "#166534" : "#991b1b", fontSize: 13 }}>
                        {ipfsClusterPassword ? ui.systemConfigReady : ui.systemConfigMissing}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setShowAdvancedSubmitSettings((v) => !v)}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                        >
                          {showAdvancedSubmitSettings ? t.hideAdvancedSettings : t.advancedSettings}
                        </button>
                      </div>
                    </div>
                    {showAdvancedSubmitSettings ? (
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        <Field label={ui.labels.burnerRpc} hint={ui.examples.burnerRpc} value={burnerRpcUrl} onChange={(e) => setBurnerRpcUrl(e.target.value)} placeholder="e.g. http://127.0.0.1:8545" />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          <Field label={ui.labels.ipfsClusterApi} hint={ui.examples.ipfsClusterApi} value={ipfsClusterApi} onChange={(e) => setIpfsClusterApi(e.target.value)} placeholder="e.g. http://127.0.0.1:9094" style={{ marginBottom: 0 }} />
                          <Field label={ui.labels.ipfsUser} hint={ui.examples.ipfsUser} value={ipfsClusterUser} onChange={(e) => setIpfsClusterUser(e.target.value)} placeholder="e.g. admin" style={{ marginBottom: 0 }} />
                          <Field label={ui.labels.ipfsPassword} hint={ui.examples.ipfsPassword} value={ipfsClusterPassword} onChange={(e) => setIpfsClusterPassword(e.target.value)} placeholder="e.g. changeme" type="password" style={{ marginBottom: 0 }} />
                        </div>
                      </div>
                    ) : null}
                    <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                      {ui.burnerHint}
                    </div>
                    <div style={{ marginTop: 6, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#334155", overflowWrap: "anywhere" }}>
                      {ui.lastBurner}: {lastBurnerAddress || "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn label={t.submit} k="submit" onClick={submitAnonymousReport} primary disabled={!CONTRACT_ADDRESS} />
                    <Btn label={t.loadReports} k="loadReportsEmp" onClick={() => loadAllReports(false)} disabled={!canRead} />
                  </div>
                  {lastSubmittedThread ? (
                    <div style={{ marginTop: 10, border: "1px solid #facc15", background: "#fffbeb", borderRadius: 10, padding: 10, overflowWrap: "anywhere" }}>
                      <strong>{ui.latestThreadKeyTitle}</strong>
                      <div style={{ marginTop: 6 }}>Report ID: {lastSubmittedThread.reportId}</div>
                      <div style={{ marginTop: 4 }}>IPFS CID: {lastSubmittedThread.ipfsCID || "-"}</div>
                      <textarea
                        readOnly
                        value={lastSubmittedThread.threadSecretKey || ""}
                        style={{ ...inputStyle, ...monoStyle, height: 66, marginTop: 8 }}
                      />
                      <div style={{ marginTop: 6, color: "#92400e", fontSize: 13 }}>{ui.latestThreadKeyHint}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(lastSubmittedThread.threadSecretKey || "")}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                        >
                          {lang === "zh" ? "複製 thread key" : "Copy thread key"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setThreadReportId(lastSubmittedThread.reportId);
                            setThreadSecretKey(lastSubmittedThread.threadSecretKey || "");
                          }}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                        >
                          {lang === "zh" ? "帶入下方對話欄" : "Fill thread form below"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {reports.length > 0 ? reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginTop: 8, overflowWrap: "anywhere" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div><strong>#{r.id}</strong> | {new Date(r.timestamp * 1000).toLocaleString()}</div>
                        <span className="case-status-badge">{reportStatusLabel(r.status)}</span>
                      </div>
                      <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div><strong>{lang === "zh" ? "案件狀態" : "Case status"}:</strong> {reportStatusLabel(r.status)}</div>
                        <div><strong>{lang === "zh" ? "狀態備註" : "Status note"}:</strong> {r.statusNote || (lang === "zh" ? "尚無備註" : "No note yet")}</div>
                        <div><strong>{lang === "zh" ? "狀態更新時間" : "Status updated"}:</strong> {r.statusUpdatedAt ? new Date(r.statusUpdatedAt * 1000).toLocaleString() : (lang === "zh" ? "尚未更新" : "Not updated yet")}</div>
                      </div>
                      <div>companyId: {r.companyId} | reportGroupId: {r.reportGroupId}</div>
                      <div>period: {r.period} | slot: {r.reportSlot}</div>
                      <div>ipfsCID: {r.ipfsCID}</div>
                      <div>messageHash: {r.messageHash}</div>
                      <div>nullifier: {r.nullifier}</div>
                      <div>scope: {r.scope}</div>
                      <div>sender: {r.submittedBy}</div>
                      <div>{ui.encrypted}: {r.encryptedReport ? `${r.encryptedReport.slice(0, 80)}...` : `(${ui.storedInIpfs})`}</div>
                      <div>{ui.plain}: {r.plainText || `(${ui.noKeyNotDecrypted})`}</div>
                    </div>
                  )) : <div style={{ marginTop: 8 }}>{ui.noReports}</div>}
                  <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                    <h3 style={{ margin: "0 0 8px" }}>{ui.anonymousThreadTitle}</h3>
                    <Field label={ui.labels.threadReportId} hint={ui.examples.threadReportId} value={threadReportId} onChange={(e) => setThreadReportId(e.target.value)} placeholder="e.g. 1" />
                    <TextAreaField label={ui.labels.threadSecretKey} hint={ui.examples.threadSecretKey} value={threadSecretKey} onChange={(e) => setThreadSecretKey(e.target.value)} placeholder="e.g. JwkZp..." height={76} mono />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <Btn label={t.loadThread} k="employeeLoadThread" onClick={() => loadReportMessages(threadReportId.trim())} disabled={!canRead} />
                      <Btn label={t.decryptThread} k="employeeDecryptThread" onClick={() => decryptThreadMessages(threadReportId.trim(), threadSecretKey.trim())} disabled={!canRead} />
                    </div>
                    <TextAreaField label={ui.labels.reporterReply} hint={ui.examples.reporterReply} value={reporterReplyText} onChange={(e) => setReporterReplyText(e.target.value)} placeholder={lang === "zh" ? "例如：補充事件時間或回覆 Admin 問題" : "e.g. add incident time or answer Admin questions"} height={84} />
                    <div style={{ marginTop: 8 }}><Btn label={t.sendReply} k="reporterReply" onClick={reporterSendReply} primary disabled={!CONTRACT_ADDRESS} /></div>
                    {(threadMessages[threadReportId.trim()] || []).length > 0 ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {(threadMessages[threadReportId.trim()] || []).map((m) => (
                          <div key={m.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, overflowWrap: "anywhere" }}>
                            <div>message #{m.id} | {m.senderRole === 1 ? "Admin" : "Reporter"} | {new Date(m.timestamp * 1000).toLocaleString()}</div>
                            <div>cid: {m.ipfsCID}</div>
                            <div>hash: {m.contentHash}</div>
                            <div style={{ whiteSpace: "pre-wrap" }}>{ui.plain}: {m.plainText || `(${ui.encryptedOnly})`}</div>
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





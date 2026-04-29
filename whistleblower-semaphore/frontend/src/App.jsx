import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import appArtifact from "./EmployeeSemaphoreWhistleblower.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const ALLOWED_LOCAL_CHAIN_IDS = [31337, 1337];
const LOCAL_CHAIN_HEX = "0x7a69";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const AMOY_CHAIN_HEX = "0x13882";
const AMOY_RPC_URL = "https://rpc-amoy.polygon.technology";

function App() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [diag, setDiag] = useState("");

  const [identityExport, setIdentityExport] = useState("");
  const [identityCommitment, setIdentityCommitment] = useState("");
  const [reporterIdentityExport, setReporterIdentityExport] = useState("");
  const [reporterCommitmentPreview, setReporterCommitmentPreview] = useState("");

  const [newMemberCommitment, setNewMemberCommitment] = useState("");
  const [members, setMembers] = useState([]);

  const [ipfsCID, setIpfsCID] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [proofJson, setProofJson] = useState("");

  const [groupId, setGroupId] = useState("");
  const [verificationView, setVerificationView] = useState({
    txHash: "",
    nullifier: "",
    message: "",
    validated: false,
    note: ""
  });

  const canUse = useMemo(() => !!window.ethereum && !!CONTRACT_ADDRESS, []);

  function parseErr(err) {
    return err?.data?.message || err?.reason || err?.message || "unknown error";
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("請先安裝 MetaMask");
      return;
    }
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWallet(account || "");
    setStatus("錢包已連線");
  }

  async function switchToLocal() {
    if (!window.ethereum) {
      setStatus("請先安裝 MetaMask");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LOCAL_CHAIN_HEX }]
      });
      setStatus("已切換到本機鏈 31337");
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: LOCAL_CHAIN_HEX,
                chainName: "Hardhat Local 31337",
                rpcUrls: [LOCAL_RPC_URL],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
              }
            ]
          });
          setStatus("已新增並切換到本機鏈 31337");
        } catch (addErr) {
          setStatus("新增本機鏈失敗: " + parseErr(addErr));
        }
      } else {
        setStatus("切換本機鏈失敗: " + parseErr(switchErr));
      }
    }
  }

  async function switchToAmoy() {
    if (!window.ethereum) {
      setStatus("請先安裝 MetaMask");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY_CHAIN_HEX }]
      });
      setStatus("已切換到 Polygon Amoy");
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: AMOY_CHAIN_HEX,
                chainName: "Polygon Amoy Testnet",
                rpcUrls: [AMOY_RPC_URL],
                nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                blockExplorerUrls: ["https://amoy.polygonscan.com"]
              }
            ]
          });
          setStatus("已新增並切換到 Polygon Amoy");
        } catch (addErr) {
          setStatus("新增 Amoy 失敗: " + parseErr(addErr));
        }
      } else {
        setStatus("切換 Amoy 失敗: " + parseErr(switchErr));
      }
    }
  }

  function getProvider() {
    return new ethers.providers.Web3Provider(window.ethereum);
  }

  function getSignerContract() {
    const provider = getProvider();
    const signer = provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, signer);
  }

  function getReadContract() {
    const provider = getProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, appArtifact.abi, provider);
  }

  async function checkContractHealth() {
    if (!window.ethereum) {
      setStatus("請先安裝 MetaMask");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setStatus("請先設定 VITE_CONTRACT_ADDRESS");
      return;
    }

    try {
      const provider = getProvider();
      const net = await provider.getNetwork();
      const code = await provider.getCode(CONTRACT_ADDRESS);
      const hasCode = code && code !== "0x";

      let ownerText = "n/a";
      let groupText = "n/a";
      if (hasCode) {
        const c = getReadContract();
        try {
          ownerText = await c.owner();
        } catch {
          ownerText = "read-failed";
        }
        try {
          groupText = (await c.groupId()).toString();
        } catch {
          groupText = "read-failed";
        }
      }

      setDiag(
        `chainId=${net.chainId} (${net.name}) | contract=${CONTRACT_ADDRESS} | code=${hasCode ? "yes" : "no"} | owner=${ownerText} | groupId=${groupText}`
      );

      if (!ALLOWED_LOCAL_CHAIN_IDS.includes(net.chainId)) {
        setStatus("目前不是本機 Hardhat 鏈，請切到 chainId 31337 或 1337 再操作。`groupId()` 失敗常見於連錯鏈。");
      } else if (!hasCode) {
        setStatus("該地址在目前鏈上沒有合約程式碼，請重新 deploy 並更新 .env 地址。");
      } else {
        setStatus("合約檢查通過。");
      }
    } catch (err) {
      setStatus("合約檢查失敗: " + parseErr(err));
    }
  }

  async function loadGroupId() {
    try {
      const c = getReadContract();
      const id = await c.groupId();
      setGroupId(id.toString());
      setStatus("已讀取 groupId");
    } catch (err) {
      setStatus(
        "讀取 groupId 失敗: " +
          parseErr(err) +
          "。請先按『Check Contract』確認你在正確鏈，且地址是 EmployeeSemaphoreWhistleblower。"
      );
    }
  }

  function createIdentity() {
    const id = new Identity();
    setIdentityExport(id.export());
    setIdentityCommitment(id.commitment.toString());
    setReporterIdentityExport(id.export());
    setReporterCommitmentPreview(id.commitment.toString());
    setStatus("已產生員工匿名 identity，請保存 privateKey(base64)");
  }

  function importIdentityAndShowCommitment() {
    try {
      const id = Identity.import(identityExport.trim());
      setIdentityCommitment(id.commitment.toString());
      if (!reporterIdentityExport.trim()) {
        setReporterIdentityExport(identityExport.trim());
        setReporterCommitmentPreview(id.commitment.toString());
      }
      setStatus("已由 privateKey 還原 identity");
    } catch (err) {
      setStatus("還原 identity 失敗: " + parseErr(err));
    }
  }

  async function adminAddEmployee() {
    try {
      const commitment = newMemberCommitment.trim();
      if (!commitment) {
        setStatus("請輸入員工 identity commitment");
        return;
      }
      const c = getSignerContract();
      const tx = await c.addEmployeeMember(commitment);
      setStatus("Admin 加入員工中，等待交易...");
      await tx.wait();
      setStatus("員工已加入群組");
      setNewMemberCommitment("");
    } catch (err) {
      setStatus("加入員工失敗: " + parseErr(err));
    }
  }

  async function loadMembersFromEvents() {
    try {
      const c = getReadContract();
      const filter = c.filters.EmployeeMemberAdded();
      const logs = await c.queryFilter(filter, 0, "latest");
      const list = logs.map((l) => l.args.identityCommitment.toString());
      setMembers(list);
      setStatus(`已載入 ${list.length} 位員工 commitment`);
    } catch (err) {
      setStatus("載入員工列表失敗: " + parseErr(err));
    }
  }

  async function employeeGenerateProof() {
    try {
      if (!reporterIdentityExport.trim()) {
        setStatus("請先輸入舉報者自己的 identity privateKey");
        return;
      }
      if (!ipfsCID.trim() || !contentHash.trim()) {
        setStatus("請先輸入 ipfsCID 與 contentHash");
        return;
      }
      if (!members.length) {
        setStatus("請先載入員工群組成員（Load Members）。");
        return;
      }

      const c = getReadContract();
      const gid = (await c.groupId()).toString();
      setGroupId(gid);

      const identity = Identity.import(reporterIdentityExport.trim());
      setReporterCommitmentPreview(identity.commitment.toString());
      const group = new Group(members);

      const message = ethers.BigNumber.from(
        ethers.utils.keccak256(ethers.utils.solidityPack(["string", "string"], [ipfsCID.trim(), contentHash.trim()]))
      ).toString();
      const scope = gid;

      setStatus("正在產生 ZK proof（首次可能較久）...");
      const proof = await generateProof(identity, group, message, scope);

      const solidityProof = {
        merkleTreeDepth: proof.merkleTreeDepth,
        merkleTreeRoot: proof.merkleTreeRoot.toString(),
        nullifier: proof.nullifier.toString(),
        message: proof.message.toString(),
        scope: proof.scope.toString(),
        points: proof.points
      };

      setProofJson(JSON.stringify(solidityProof, null, 2));
      setStatus("Proof 產生完成");
    } catch (err) {
      setStatus("Proof 產生失敗: " + parseErr(err));
    }
  }

  async function employeeSubmitReport() {
    try {
      if (!proofJson.trim()) {
        setStatus("請先生成 proof");
        return;
      }
      const proof = JSON.parse(proofJson);
      const c = getSignerContract();
      const tx = await c.submitAnonymousReport(ipfsCID.trim(), contentHash.trim(), proof);
      setStatus("匿名舉報送出中，等待交易...");
      const receipt = await tx.wait();
      const validatedEvent = receipt.events?.find((e) => e.event === "ProofValidated");
      const reportEvent = receipt.events?.find((e) => e.event === "AnonymousReportSubmitted");
      const nullifierFromEvent =
        reportEvent?.args?.nullifier?.toString() ||
        validatedEvent?.args?.nullifier?.toString() ||
        proof.nullifier?.toString() ||
        "";
      const messageFromEvent =
        reportEvent?.args?.message?.toString() ||
        validatedEvent?.args?.message?.toString() ||
        proof.message?.toString() ||
        "";
      setVerificationView({
        txHash: receipt.transactionHash || tx.hash || "",
        nullifier: nullifierFromEvent,
        message: messageFromEvent,
        validated: !!validatedEvent || !!reportEvent,
        note: "合約只驗證你屬於員工群組並記錄 nullifier，沒有揭露你的 identity private key 或員工真實身分。"
      });
      setStatus("匿名舉報成功，合約已驗證員工身分且記錄 nullifier");
    } catch (err) {
      setStatus("提交失敗: " + parseErr(err));
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Semaphore Employee Whistleblower Demo</h1>
      <p>Contract: {CONTRACT_ADDRESS || "(請設定 frontend/.env 的 VITE_CONTRACT_ADDRESS)"}</p>
      <p>Wallet: {wallet || "(尚未連線)"}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={connectWallet}>Connect Wallet</button>
        <button onClick={switchToLocal}>一鍵連到本機</button>
        <button onClick={switchToAmoy}>一鍵連到 Amoy</button>
        <button onClick={checkContractHealth} disabled={!canUse}>Check Contract</button>
        <button onClick={loadGroupId} disabled={!canUse}>Load Group ID</button>
        <button onClick={loadMembersFromEvents} disabled={!canUse}>Load Members From Chain</button>
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>Diag: {diag}</p>

      <h2>1) Admin Adds Employee</h2>
      <p>先由員工在下方產生 identity commitment，Admin 再把 commitment 加入群組。</p>
      <input
        style={{ width: "100%" }}
        value={newMemberCommitment}
        onChange={(e) => setNewMemberCommitment(e.target.value)}
        placeholder="employee identity commitment"
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={adminAddEmployee} disabled={!canUse}>Admin Add Employee</button>
      </div>

      <h2>2) Employee Generates Identity (Off-chain)</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={createIdentity}>Generate New Identity</button>
        <button onClick={importIdentityAndShowCommitment}>Import Identity + Show Commitment</button>
      </div>
      <textarea
        style={{ width: "100%", height: 90, marginTop: 8 }}
        value={identityExport}
        onChange={(e) => setIdentityExport(e.target.value)}
        placeholder="employee privateKey(base64)"
      />
      <p>Commitment: {identityCommitment || "(尚未產生)"}</p>

      <h2>2.5) Reporter Identity For Proof</h2>
      <p>這裡請輸入「舉報者本人」的 identity privateKey。Proof 驗證會用這個身分。</p>
      <textarea
        style={{ width: "100%", height: 90, marginTop: 8 }}
        value={reporterIdentityExport}
        onChange={(e) => setReporterIdentityExport(e.target.value)}
        placeholder="reporter privateKey(base64)"
      />
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            try {
              const id = Identity.import(reporterIdentityExport.trim());
              setReporterCommitmentPreview(id.commitment.toString());
              setStatus("已解析舉報者 commitment，可拿去比對是否在群組內");
            } catch (err) {
              setStatus("舉報者 identity 格式錯誤: " + parseErr(err));
            }
          }}
        >
          Preview Reporter Commitment
        </button>
      </div>
      <p>Reporter Commitment: {reporterCommitmentPreview || "(尚未解析)"}</p>

      <h2>3) Employee Generates Proof (Off-chain)</h2>
      <p>Group ID: {groupId || "(未載入)"} | Members loaded: {members.length}</p>
      <input
        style={{ width: "100%", marginBottom: 8 }}
        value={ipfsCID}
        onChange={(e) => setIpfsCID(e.target.value)}
        placeholder="ipfsCID"
      />
      <input
        style={{ width: "100%", marginBottom: 8 }}
        value={contentHash}
        onChange={(e) => setContentHash(e.target.value)}
        placeholder="contentHash"
      />
      <button onClick={employeeGenerateProof} disabled={!canUse}>Generate Proof Off-chain</button>
      <textarea
        style={{ width: "100%", height: 200, marginTop: 8 }}
        value={proofJson}
        onChange={(e) => setProofJson(e.target.value)}
        placeholder="generated proof JSON"
      />

      <h2>4) Employee Submits Anonymous Report (On-chain Verification)</h2>
      <button onClick={employeeSubmitReport} disabled={!canUse}>Submit Anonymous Report</button>

      <p style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>Status: {status}</p>

      <h2>Verification Visualization</h2>
      <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
        <p>Validated: {verificationView.validated ? "Yes" : "No"}</p>
        <p>Tx Hash: {verificationView.txHash || "(尚無)"}</p>
        <p>Nullifier (on-chain): {verificationView.nullifier || "(尚無)"}</p>
        <p>Message (on-chain): {verificationView.message || "(尚無)"}</p>
        <p>Not Revealed: identity private key / employee real ID / commitment source mapping</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{verificationView.note || "送出成功後會顯示這筆驗證證據。"}</p>
      </div>
    </div>
  );
}

export default App;

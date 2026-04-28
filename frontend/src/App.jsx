import { useState } from "react";
import { ethers } from "ethers";
import whistleblowerArtifact from "./Whistleblower.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const COMMON_LOCAL_CHAIN_IDS = [31337, 1337];
const COMMON_LOCAL_CHAIN_LABEL = "31337 (0x7a69) 或 1337 (0x539)";
const LOCAL_RPC_CANDIDATES = [
  "http://127.0.0.1:8545",
  "http://localhost:8545",
  "http://127.0.0.1:7545",
  "http://localhost:7545"
];

function toHexChainId(chainIdDec) {
  return `0x${Number(chainIdDec).toString(16)}`;
}

function parseEthersError(err) {
  const raw =
    err?.reason ||
    err?.data?.message ||
    err?.error?.message ||
    err?.message ||
    "unknown error";
  const msg = String(raw);
  const lower = msg.toLowerCase();

  if (err?.code === 4001 || lower.includes("user rejected")) {
    return "你已取消 MetaMask 交易簽署。";
  }
  if (lower.includes("too many errors") || lower.includes("rate limit")) {
    return "RPC 節點不穩或被限流。請確認本機節點仍在執行，或切換到可用 RPC。";
  }
  if (lower.includes("insufficient funds")) {
    return "錢包餘額不足，請匯入測試帳號或補足測試 ETH。";
  }
  if (lower.includes("wrong network") || lower.includes("chain")) {
    return "目前鏈設定不正確，請切換到本機鏈。";
  }
  if (lower.includes("execution reverted")) {
    return "合約執行被拒絕（execution reverted），請檢查輸入內容或合約條件。";
  }
  return msg;
}

async function detectAliveLocalRpc() {
  for (const url of LOCAL_RPC_CANDIDATES) {
    try {
      const body = {
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: Date.now()
      };
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data?.result) {
        const chainHex = String(data.result);
        const chainDec = Number.parseInt(chainHex, 16);
        if (Number.isFinite(chainDec)) {
          return { url, chainHex, chainDec };
        }
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function App() {
  const [report, setReport] = useState("");
  const [status, setStatus] = useState("");
  const [networkInfo, setNetworkInfo] = useState("");
  const [healthInfo, setHealthInfo] = useState("");
  const [cases, setCases] = useState([]);

  async function requestAccount() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  async function sendReport() {
    if (!report) return;

    if (!window.ethereum) {
      setStatus("請先安裝 MetaMask");
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setStatus("請先在 frontend/.env 設定 VITE_CONTRACT_ADDRESS");
      return;
    }

    try {
      await requestAccount();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setNetworkInfo(`目前鏈: ${network.name} (chainId=${network.chainId})`);

      if (!COMMON_LOCAL_CHAIN_IDS.includes(network.chainId)) {
        setStatus(`目前鏈非常見本機鏈，建議先切換到 ${COMMON_LOCAL_CHAIN_LABEL} 再送出。`);
        return;
      }

      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, whistleblowerArtifact.abi, signer);

      setStatus("請在 MetaMask 確認交易...");
      const tx = await contract.submitReport(report, "dummy_hash_for_test");

      setStatus("交易送出，等待上鏈...");
      await tx.wait();
      setStatus("檢舉送出成功");
      setReport("");
    } catch (err) {
      setStatus("交易失敗: " + parseEthersError(err));
    }
  }

  async function checkRpcHealth() {
    if (!window.ethereum) {
      setHealthInfo("未偵測到 MetaMask，請先安裝或啟用。");
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setHealthInfo("請先設定 frontend/.env 的 VITE_CONTRACT_ADDRESS。");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const [chainHex, netVersion, blockNumber, code, account] = await Promise.all([
        provider.send("eth_chainId", []),
        provider.send("net_version", []),
        provider.getBlockNumber(),
        provider.getCode(CONTRACT_ADDRESS),
        signer.getAddress()
      ]);
      const balance = await provider.getBalance(account);

      const hasContract = code && code !== "0x";
      let staticResult = "not-run";
      if (hasContract) {
        try {
          const contract = new ethers.Contract(CONTRACT_ADDRESS, whistleblowerArtifact.abi, signer);
          await contract.callStatic.submitReport("health_check_probe", "dummy_hash_for_test");
          staticResult = "ok";
        } catch (e) {
          staticResult = `failed (${parseEthersError(e)})`;
        }
      }

      setHealthInfo(
        `eth_chainId: ${chainHex} | net_version: ${netVersion} | latest block: ${blockNumber} | account: ${account} | balance: ${ethers.utils.formatEther(
          balance
        )} ETH | contract deployed: ${hasContract ? "yes" : "no"} | callStatic submitReport: ${staticResult}`
      );
    } catch (err) {
      setHealthInfo(
        `健康檢查失敗: ${parseEthersError(err)} | code=${err?.code ?? "n/a"} | raw=${
          err?.message || "n/a"
        }`
      );
    }
  }

  async function repairLocalRpcConnection() {
    if (!window.ethereum) {
      setStatus("未偵測到 MetaMask。");
      return;
    }

    setStatus("正在探測可用本機 RPC...");
    const detected = await detectAliveLocalRpc();
    if (!detected) {
      setStatus("找不到可用本機 RPC。請先確認 node 節點有啟動。",);
      return;
    }

    const chainHex = detected.chainHex.toLowerCase();
    const chainDec = detected.chainDec;
    const chainName = `Local RPC ${chainDec}`;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }]
      });
      setStatus(`已切換到 ${chainName} (${chainHex})，RPC=${detected.url}`);
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainHex,
                chainName,
                rpcUrls: [detected.url],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
              }
            ]
          });
          setStatus(`已新增並切換到 ${chainName} (${chainHex})，RPC=${detected.url}`);
        } catch (addErr) {
          setStatus("新增本機鏈失敗: " + parseEthersError(addErr));
        }
      } else {
        setStatus("切換本機鏈失敗: " + parseEthersError(switchErr));
      }
    }
  }

  function statusLabel(statusCode) {
    const code = Number(statusCode);
    if (code === 0) return "Pending";
    if (code === 1) return "UnderInvestigation";
    if (code === 2) return "Resolved";
    return `Unknown(${code})`;
  }

  function formatTimestamp(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "-";
    return new Date(n * 1000).toLocaleString();
  }

  async function fetchAllCases() {
    if (!window.ethereum) {
      setStatus("未偵測到 MetaMask。");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setStatus("請先在 frontend/.env 設定 VITE_CONTRACT_ADDRESS");
      return;
    }

    try {
      setStatus("正在查詢鏈上檢舉資料...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, whistleblowerArtifact.abi, provider);
      const totalBn = await contract.caseCount();
      const total = Number(totalBn);

      if (!Number.isFinite(total) || total <= 0) {
        setCases([]);
        setStatus("目前沒有檢舉資料。");
        return;
      }

      const indexes = Array.from({ length: total }, (_, i) => i + 1);
      const rows = await Promise.all(
        indexes.map(async (id) => {
          const c = await contract.cases(id);
          return {
            id: Number(c.id),
            ipfsCID: c.ipfsCID,
            contentHash: c.contentHash,
            status: Number(c.status),
            statusText: statusLabel(c.status),
            timestamp: Number(c.timestamp)
          };
        })
      );

      rows.sort((a, b) => b.id - a.id);
      setCases(rows);
      setStatus(`查詢完成，共 ${rows.length} 筆。`);
    } catch (err) {
      setStatus("查詢失敗: " + parseEthersError(err));
    }
  }

  return (
    <div style={{ padding: "48px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Whistleblower DApp</h1>
      <p>Contract: {CONTRACT_ADDRESS || "(未設定)"}</p>
      <p>建議鏈: Localhost {COMMON_LOCAL_CHAIN_LABEL}</p>
      <p>{networkInfo}</p>

      <textarea
        value={report}
        onChange={(e) => setReport(e.target.value)}
        placeholder="輸入檢舉內容或 IPFS CID"
        style={{ width: "100%", height: "140px", padding: "10px" }}
      />

      <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button onClick={sendReport} style={{ padding: "10px 18px", cursor: "pointer" }}>
          送出檢舉 (MetaMask)
        </button>
        <button onClick={checkRpcHealth} style={{ padding: "10px 18px", cursor: "pointer" }}>
          RPC 健康檢查
        </button>
        <button onClick={repairLocalRpcConnection} style={{ padding: "10px 18px", cursor: "pointer" }}>
          通用本機 RPC 修復
        </button>
        <button onClick={fetchAllCases} style={{ padding: "10px 18px", cursor: "pointer" }}>
          查詢所有檢舉
        </button>
      </div>

      <p style={{ marginTop: "16px" }}>{status}</p>
      <p>{healthInfo}</p>

      <div style={{ marginTop: "18px" }}>
        <h2>鏈上檢舉列表</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>ID</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>IPFS CID / Report</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Content Hash</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Status</th>
                <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }} colSpan={5}>
                    尚無資料，請先送出檢舉或點「查詢所有檢舉」。
                  </td>
                </tr>
              ) : (
                cases.map((row) => (
                  <tr key={row.id}>
                    <td style={{ border: "1px solid #ccc", padding: "8px" }}>{row.id}</td>
                    <td style={{ border: "1px solid #ccc", padding: "8px", wordBreak: "break-all" }}>{row.ipfsCID}</td>
                    <td style={{ border: "1px solid #ccc", padding: "8px", wordBreak: "break-all" }}>{row.contentHash}</td>
                    <td style={{ border: "1px solid #ccc", padding: "8px" }}>{row.statusText}</td>
                    <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatTimestamp(row.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;

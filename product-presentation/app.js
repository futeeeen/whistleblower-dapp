const journeyData = {
  employee: {
    eyebrow: "Employee journey",
    title: "員工只需要證明『我有資格』，不需要暴露『我是誰』。",
    body: "員工在前端產生 Semaphore identity，送出時產生 ZK proof。平台產生匿名 burner wallet 送交易，員工不需要準備 Gas，也不需要把真實錢包綁到案件。",
    points: ["產生匿名身份，只交出 commitment", "用 ZK proof 驗證群組資格", "內容加密後上傳 Private IPFS", "保存 thread secret key，日後查看追問"],
    steps: ["Generate identity", "Prepare ZK proof", "Encrypt report", "Submit by burner wallet"]
  },
  admin: {
    eyebrow: "Company Admin journey",
    title: "公司可以處理案件，但不能從 proof 看出舉報者是哪一位。",
    body: "公司 Admin 公布公司專屬 public key，管理員工 commitment，讀取本公司案件，解密內容，更新處理狀態，並透過加密 thread 追問補充資料。",
    points: ["設定 company admin public key", "加入 / 移除員工 commitment", "只解密自己公司的密文", "更新案件狀態與追問"],
    steps: ["Set company key", "Manage commitments", "Review encrypted reports", "Reply in anonymous thread"]
  },
  platform: {
    eyebrow: "Platform / chain journey",
    title: "平台提供可信任基礎設施，而不是成為新的資料風險點。",
    body: "未來部署在聯盟鏈 / 許可鏈，企業或第三方機構可成為節點。鏈負責驗證 proof 和保存 metadata，密文內容留在 Private IPFS。",
    points: ["聯盟鏈節點維護 audit trail", "gasPrice 可為 0，員工免 Gas", "鏈上保存 CID/hash/nullifier", "平台不應能任意讀取明文"],
    steps: ["Verify proof", "Store metadata", "Preserve audit trail", "Notify company admin"]
  }
};

const flowData = {
  zk: {
    title: "ZK Proof: 是員工，但不說是哪位員工",
    body: "員工用 Semaphore proof 證明自己屬於某公司某個舉報群組。公司可以知道哪些 commitment 被加入群組，但從單筆 proof 看不出是哪個 commitment 提交。",
    code: ["input: identity + merkle proof", "public: groupId + scope", "verify: member exists", "reveal: true / false only"]
  },
  encrypt: {
    title: "Hybrid Encryption: 每個案件一把 thread key",
    body: "舉報內容用隨機 symmetric key 加密；這把 key 再用公司 Admin public key 包起來。後續 Admin 追問與 Reporter 回覆都沿用同一把 thread key。",
    code: ["threadKey = random(32 bytes)", "ciphertext = AES-GCM(report, threadKey)", "encryptedKey = encrypt(adminPublicKey, threadKey)", "payload -> Private IPFS"]
  },
  ipfs: {
    title: "Private IPFS: 內容離鏈，證據可驗",
    body: "平台不把舉報明文放上鏈。IPFS 保存密文，鏈上只保存 CID 與 hash。任何人可驗證內容未被替換，但沒有 key 就看不到明文。",
    code: ["IPFS stores: encrypted payload", "Chain stores: ipfsCID", "Chain stores: contentHash", "Admin decrypts locally"]
  },
  chain: {
    title: "Permissioned Chain: 可稽核，也可免員工 Gas",
    body: "在聯盟鏈 / 許可鏈中，企業或第三方機構是授權節點。交易可由 burner wallet 送出，gasPrice 設為 0，由平台或企業訂閱費吸收維運成本。",
    code: ["sender: burner wallet", "gasPrice: 0", "contract: verify proof", "audit: immutable metadata"]
  }
};

const trustData = {
  identity: {
    title: "身份安全：公司知道名單，不等於知道誰舉報",
    body: "HR 可以知道 commitment 對應哪位員工，這有助於入職與離職管理。但提交案件時，proof 只揭露該人屬於群組，不揭露是哪個 commitment。匿名性來自群組大小與 ZK proof。",
    badges: ["Semaphore", "membership proof", "commitment unlinkability"]
  },
  repeat: {
    title: "防重複：nullifier 讓資格可控，但不揭露身份",
    body: "同一位員工在同一個 companyId + groupId + period + reportSlot 會產生同一個 nullifier。合約可以阻擋重複提交，同時仍看不出員工是誰。",
    badges: ["nullifier", "quota scope", "max reports"]
  },
  content: {
    title: "內容安全：公司才能解開案件 thread key",
    body: "初次舉報產生一把隨機 thread secret key。內容用這把 key 加密，而 key 只用公司 Admin public key 包裝。沒有公司錢包帳號授權，就無法解開 thread key。",
    badges: ["AES-GCM", "Admin public key", "Private IPFS"]
  },
  dialogue: {
    title: "雙向溝通：追問與反駁也維持匿名",
    body: "Admin 可針對案件加密追問，Reporter 用保存的 thread key 解密查看，再用 burner wallet 回覆。鏈上只看到 message metadata，不需要 Reporter 使用真實錢包。",
    badges: ["anonymous thread", "burner wallet", "encrypted replies"]
  }
};

const scenarioData = {
  fraud: {
    title: "財務舞弊：怕被報復的關鍵證據",
    report: "我發現同一供應商在三個月份出現異常重複請款，附件中有發票編號與簽核時間。",
    outcome: "Admin 解密後要求補充單據來源，Reporter 使用匿名 thread 回覆。案件狀態更新為 Reviewing，鏈上留下不可竄改紀錄。",
    tags: ["財務舞弊", "匿名追問", "audit trail"]
  },
  harassment: {
    title: "職場騷擾：保護舉報者，也讓調查可進行",
    report: "某主管在非工作時間多次傳送不當訊息，我希望公司先確認紀錄，不要透露我的身份。",
    outcome: "公司只看見有效員工 proof 與加密內容。若需要補充時間地點，可透過 thread 追問，不必要求員工現身。",
    tags: ["敏感案件", "身份保護", "最小揭露"]
  },
  security: {
    title: "資安事件：快速回報但不製造新風險",
    report: "我看到測試環境 API key 可能被提交到外部 repo，附上 repository 路徑與可能外洩時間。",
    outcome: "密文放在 Private IPFS，鏈上只有 hash 與 CID。調查單位可快速追問影響範圍，保留完整處理軌跡。",
    tags: ["資安事件", "Private IPFS", "hash integrity"]
  }
};

function renderJourney(key) {
  const data = journeyData[key];
  document.querySelectorAll("[data-journey]").forEach((btn) => btn.classList.toggle("active", btn.dataset.journey === key));
  document.getElementById("journeyCopy").innerHTML = `
    <p class="eyebrow">${data.eyebrow}</p>
    <h3>${data.title}</h3>
    <p>${data.body}</p>
    <ul class="check-list">${data.points.map((point) => `<li>${point}</li>`).join("")}</ul>
  `;
  document.getElementById("journeyVisual").innerHTML = `
    <div class="timeline">${data.steps.map((step, index) => `
      <div class="timeline-item"><b>${index + 1}</b><span>${step}</span></div>
    `).join("")}</div>
  `;
}

function renderFlow(key) {
  const data = flowData[key];
  document.querySelectorAll("[data-flow]").forEach((btn) => btn.classList.toggle("active", btn.dataset.flow === key));
  document.getElementById("flowDetail").innerHTML = `
    <div>
      <h3>${data.title}</h3>
      <p>${data.body}</p>
      <div class="badge-row"><span>Designed for PoC now</span><span>Consortium-chain ready</span></div>
    </div>
    <div class="code-card">${data.code.map((line) => `<div>${line}</div>`).join("")}</div>
  `;
}

function renderTrust(key) {
  const data = trustData[key];
  document.querySelectorAll("[data-trust]").forEach((btn) => btn.classList.toggle("active", btn.dataset.trust === key));
  document.getElementById("trustDetail").innerHTML = `
    <p class="eyebrow">Mechanism</p>
    <h3>${data.title}</h3>
    <p>${data.body}</p>
    <div class="badge-row">${data.badges.map((badge) => `<span>${badge}</span>`).join("")}</div>
  `;
}

function renderScenario(key) {
  const data = scenarioData[key];
  document.querySelectorAll("[data-scenario]").forEach((btn) => btn.classList.toggle("active", btn.dataset.scenario === key));
  document.getElementById("scenarioCard").innerHTML = `
    <div>
      <span class="status-pill">Proof verified · identity hidden</span>
      <h3 style="margin-top: 22px">${data.title}</h3>
      <p>${data.outcome}</p>
      <div class="badge-row">${data.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </div>
    <div class="demo-phone">
      <strong>Encrypted report preview</strong>
      <div class="demo-message">${data.report}</div>
      <div class="demo-message">threadKey: saved locally by reporter<br/>CID: bafy...<br/>hash: sha256:...</div>
    </div>
  `;
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.14 });
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function setupRail() {
  const buttons = document.querySelectorAll(".slide-rail button");
  buttons.forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.target).scrollIntoView({ behavior: "smooth" }));
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible?.target?.id) return;
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.target === visible.target.id));
  }, { threshold: [0.2, 0.45, 0.7] });

  document.querySelectorAll("[data-section][id]").forEach((section) => observer.observe(section));
}

function setupEvents() {
  document.querySelectorAll("[data-journey]").forEach((btn) => btn.addEventListener("click", () => renderJourney(btn.dataset.journey)));
  document.querySelectorAll("[data-flow]").forEach((btn) => btn.addEventListener("click", () => renderFlow(btn.dataset.flow)));
  document.querySelectorAll("[data-trust]").forEach((btn) => btn.addEventListener("click", () => renderTrust(btn.dataset.trust)));
  document.querySelectorAll("[data-scenario]").forEach((btn) => btn.addEventListener("click", () => renderScenario(btn.dataset.scenario)));
  document.getElementById("focusModeBtn").addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    document.getElementById("focusModeBtn").textContent = document.body.classList.contains("focus-mode") ? "顯示導覽" : "簡報模式";
  });
}

renderJourney("employee");
renderFlow("zk");
renderTrust("identity");
renderScenario("fraud");
setupReveal();
setupRail();
setupEvents();

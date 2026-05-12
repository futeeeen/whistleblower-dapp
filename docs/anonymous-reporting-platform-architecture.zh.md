# 匿名舉報平台產品架構設計

## 1. 產品方向

本產品會從目前的本機 Semaphore PoC，逐步演進成一個面向企業與可信第三方機構的匿名舉報平台。

目標架構不是以公鏈作為正式底層，而是採用聯盟鏈 / 許可鏈。參與公司或第三方機構可以成為具權限的節點。員工提交舉報時，不需要自行準備 ETH、POL 或任何 native token，也不需要自己支付 gas fee。

核心原則：

```text
誰有資格舉報：靠 ZK proof 驗證
誰負責送交易：匿名臨時錢包 burner wallet
```

burner wallet 只是送交易用的外殼，不代表員工真實身分。

## 2. 目前 PoC 架構

目前主要資料夾：

- `whistleblower-semaphore`
  - 使用 Semaphore 做員工群組成員資格驗證。
  - Admin 可以新增員工 identity commitment。
  - Employee 在前端離線產生 proof。
  - 合約驗證 proof 並儲存舉報 metadata。
  - nullifier 用來防止同一 scope 內重複提交。

- `private-ipfs-cluster`
  - 私有 IPFS + IPFS Cluster 環境。
  - 加密後的舉報內容儲存在鏈下。
  - 鏈上只儲存 `ipfsCID`、`messageHash/contentHash`、nullifier、timestamp 與 proof 相關 metadata。

- `legacy-basic-dapp`
  - 早期基本 demo，僅保留作為參考。
  - 不屬於目標產品主線架構。

目前 PoC 流程：

```text
Employee
  |
  | 產生 Semaphore identity 與 proof
  | 使用 Admin 公鑰加密舉報內容
  v
Frontend
  |
  | 提交 ipfsCID + messageHash + proof
  v
Smart Contract
  |
  | 驗證 proof
  | 儲存舉報 metadata
  v
Admin
  |
  | 讀取舉報 metadata
  | 透過 ipfsCID 從私有 IPFS 取得 ciphertext
  | 使用 Admin 私鑰解密
```

## 3. 未來聯盟鏈 / 許可鏈架構

未來正式環境預計部署在聯盟鏈 / 許可鏈上。

預期特性：

- 公司與可信第三方機構可以成為授權節點。
- 鏈上仍可保留 gas accounting，用於限制合約運算資源。
- gas price 可設定為 `0`，或將交易成本抽象化。
- 員工不需要支付 gas fee。
- 平台維運成本由企業訂閱費吸收。

目標流程：

```text
Employee
  |
  | 產生 ZK proof
  | 加密舉報內容
  v
Frontend Platform
  |
  | 上傳 ciphertext 到 Private IPFS
  | 取得 ipfsCID + contentHash
  | 產生匿名臨時錢包 burner wallet
  | 送出 gasPrice=0 的交易
  v
Consortium / Permissioned Chain
  |
  | 驗證 proof
  | 儲存 ipfsCID、hash、metadata、nullifier
  | 保留不可竄改 audit trail
  v
Company Admin
  |
  | 收到舉報通知
  | 從 IPFS 取得 ciphertext
  | 使用公司私鑰解密
```

重要分工：

```text
ZK proof = 證明是否具備舉報資格
Burner wallet = 負責送交易
Admin key = 負責解密舉報內容
```

## 4. 角色權限

### Platform Operator

職責：

- 營運匿名舉報平台。
- 維護前端、可選後端服務、監控與部署工具。
- 管理公司加入聯盟鏈的 onboarding 流程。
- 可提供 hosted private IPFS 基礎設施。
- 可提供 dashboard、通知與 audit 功能。

Platform Operator 原則上不應能解密員工舉報內容，除非公司明確授權。

### Company Admin

職責：

- 註冊公司資料。
- 管理公司加密 key pair。
- 設定舉報主題 / 群組。
- 新增員工 membership commitment。
- 從鏈上讀取舉報 metadata。
- 從 private IPFS 取得 ciphertext。
- 使用公司私鑰解密舉報內容。

Company Admin 不應僅透過鏈上資料直接識別舉報者真實身分。

### Company / Third-Party Validator Node

職責：

- 參與聯盟鏈 / 許可鏈運作。
- 驗證交易與區塊。
- 協助維持不可竄改的 audit trail。

Validator node 應驗證 proof 與鏈上規則，但不應知道舉報明文內容。

### Employee / Reporter

職責：

- 產生或保存本機 ZK identity。
- 產生 ZK proof，證明自己具備群組資格與剩餘舉報次數。
- 使用公司公鑰加密舉報內容。
- 使用前端產生的 burner wallet 送出交易。

Employee 不需要：

- ETH
- POL
- native chain token
- 綁定個人錢包

### Auditor / Investigator

職責：

- 可被授權讀取舉報 metadata。
- 可由 Company Admin 提供解密內容，或透過受控 key-sharing 流程取得內容。
- 可使用鏈上資料作為 audit trail。

Auditor 權限應明確且可限制範圍。

## 5. 多公司 / 多 Group ID 設計

每間公司可以建立多個舉報主題。每個主題可以對應一個 Semaphore group 或邏輯上的 ReportGroup。

主題例子：

- 財務舞弊
- 性騷擾
- 資安事件
- 內線交易

### Company

```text
Company
- companyId
- companyName
- adminPublicKey
- validator/admin address
- enabled topics/groups
```

未來可擴充欄位：

```text
- status
- createdAt
- metadataURI
- notificationEndpoint
- allowedValidatorNodes
```

### ReportGroup

每個舉報主題是一個 group。

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

未來可擴充欄位：

```text
- isActive
- quotaMode
- period
- adminPublicKeyOverride
- groupMetadataURI
```

### Report

每筆舉報只儲存 metadata。

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

未來可擴充欄位：

```text
- status
- encryptedKeyURI
- reportType
- submittedBySender
- chainBlockNumber
```

注意：`submittedBySender` 是 burner wallet address，不應被視為員工身分。

## 6. 員工免 Gas 流程

目標設計是在 MVP 階段不引入 Relayer，但仍讓員工不用支付 gas。

設計決策：

```text
員工前端直接向授權 RPC 送交易。
前端在本機產生匿名 burner wallet。
burner wallet 簽署交易。
許可鏈接受 gasPrice=0 的交易。
```

流程：

```text
1. 員工打開平台前端。
2. 前端載入 company 與 group 設定。
3. 員工輸入舉報內容。
4. 前端使用公司公鑰加密舉報內容。
5. 前端將 ciphertext 上傳到 private IPFS。
6. 前端取得 ipfsCID 與 contentHash。
7. 前端產生 ZK proof。
8. 前端產生匿名 burner wallet。
9. burner wallet 簽署 gasPrice=0 的交易。
10. 交易送到 permissioned chain RPC。
11. 合約驗證 proof 並儲存 metadata。
```

為什麼可行：

- 鏈上仍保留 gas accounting 來限制運算量。
- 許可鏈可以將 gas price 設為 0。
- 不需要公鏈 token。
- 企業訂閱費負擔節點、IPFS、監控與維運成本。

重要安全提醒：

burner wallet 匿名不等於完整網路匿名。RPC 節點仍可能看到 IP 或 request metadata。正式部署時可考慮：

- 公司內網
- VPN
- 隱私 gateway
- rate limit
- abuse detection
- 登入 session 與鏈上交易 sender 分離

## 7. IPFS + Encryption 流程

舉報明文不應上鏈。

加密流程：

```text
1. Company Admin 公開公司 adminPublicKey。
2. Employee frontend 使用 adminPublicKey 加密舉報內容。
3. ciphertext 上傳到 private IPFS。
4. IPFS 回傳 ipfsCID。
5. 前端計算 contentHash。
6. 合約儲存 ipfsCID 與 contentHash。
7. Admin 之後透過 ipfsCID 取得 ciphertext。
8. Admin 使用公司私鑰解密。
```

鏈上儲存：

```text
ipfsCID
contentHash
timestamp
companyId
groupId
nullifier
proof metadata
```

鏈下儲存：

```text
ciphertext
optional encrypted attachments
optional report metadata JSON
```

Admin 解密：

```text
ipfsCID -> Private IPFS Gateway -> ciphertext -> Admin private key -> plaintext
```

完整性驗證：

```text
contentHash = hash(ciphertext or canonical report payload)
```

團隊需要決定 `contentHash` 指的是：

- ciphertext hash，建議作為預設，用於驗證 IPFS payload 完整性
- plaintext hash，可驗證內容完整性，但需避免洩漏可猜測內容的 fingerprint

正式版預設建議使用 ciphertext hash。

## 8. ZK Proof / Nullifier / Quota 設計

ZK proof 應證明：

- reporter 屬於該公司群組
- reporter 屬於指定舉報主題群組
- reporter 仍有剩餘舉報 quota
- proof 與本次提交 metadata 綁定

proof 不應揭露：

- 員工真實身分
- private identity
- 員工具體是哪一個 commitment
- 舉報明文

### Nullifier

Nullifier 用於防止同一個舉報權限被重複使用。

基本一個 scope 只能舉報一次的設計：

```text
scope = companyId + groupId + period
```

意思是同一員工在同一公司、同一主題、同一期間只能提交一次。

### 允許 N 次舉報

如果要允許同一員工提交多次，可加入 report slot。

```text
scope = companyId + groupId + period + reportSlot
```

例子：

```text
reportSlot = 1, 2, 3
```

代表每位有效成員在該 scope 下最多可提交三次。

合約層行為：

```text
usedNullifiers[nullifier] = true
```

若同一 nullifier 再次出現，就拒絕交易。

### Report Period

`period` 可以代表：

- 年度
- 季度
- 特定事件活動
- 任職週期
- 自訂群組有效期間

例子：

```text
scope = keccak256(companyId, groupId, "2026-Q1", reportSlot)
```

### Proof Message Binding

proof 應與提交 metadata 綁定：

```text
message = hash(companyId, groupId, ipfsCID, contentHash, reportSlot, period)
```

這可以避免攻擊者拿有效 proof 改成不同舉報 metadata 重送。

## 9. Smart Contract 演進方向

目前 PoC 合約未來可拆成多個模組。

### Company Registry

職責：

- 註冊公司
- 儲存公司 Admin 公鑰
- 管理 validator/admin address
- 啟用或停用公司狀態

### Group Manager

職責：

- 建立 ReportGroup
- 設定 topic name
- 設定 quota 與 period
- 管理 membership commitments
- 更新 Merkle root / Semaphore group

### Report Registry

職責：

- 驗證 proof
- 檢查 nullifier
- 儲存 report metadata
- emit report submitted events

### Access Control

職責：

- company admin 權限
- platform operator 權限
- validator 權限
- emergency pause / incident response

## 10. 後續實作 Roadmap

### Phase 1：穩定目前 PoC

- 保留 Amoy 支援，作為公開展示 demo。
- 保留 local Hardhat 作為開發流程。
- 保留 private IPFS cluster 資料夾。
- 改善前端標籤與操作提示。
- 穩定 report list 與 Admin decrypt 流程。

### Phase 2：多公司資料模型

- 新增 `companyId`。
- 新增 company registry contract。
- 每間公司擁有自己的 admin public key。
- 前端支援依公司篩選舉報。

### Phase 3：多 Group / Topic 支援

- 新增 `ReportGroup`。
- 每間公司支援多個 group ID。
- 新增主題設定：
  - topic name
  - start/end time
  - max reports per member
  - period

### Phase 4：Quota 與 Nullifier Scope

- 新增 `reportSlot`。
- 新增 period-based scope。
- 儲存 used nullifiers。
- 前端可視情況顯示剩餘 quota。

### Phase 5：Burner Wallet 送交易

- 前端本機產生 burner wallet。
- 前端使用 burner wallet 簽署交易。
- permissioned chain RPC 設定 gasPrice=0。
- 移除員工流程中對個人錢包的依賴。
- 保留 Admin wallet，用於公司管理與解密。

### Phase 6：聯盟鏈部署

- 選擇鏈技術：
  - Hyperledger Besu
  - Quorum
  - Polygon Edge 類型許可鏈
  - 其他 EVM-compatible permissioned chain
- 設定 validator nodes。
- 設定 permissioned RPC access。
- 設定監控與備份。

### Phase 7：正式版隱私與維運

- 加入 abuse prevention 與 rate limits。
- 加入 Admin 通知流程。
- 加入 audit dashboard。
- 加入 key rotation 與 recovery policy。
- 加入員工 onboarding/offboarding。
- 加入公司訂閱與 tenant management。

## 11. 待釐清問題

- `contentHash` 應該是 ciphertext hash 還是 plaintext hash？
- 員工 ZK identity 應完全由員工產生，還是由公司 onboarding 協助？
- 員工離職後如何 revoke membership？
- 舉報是否支援附件？
- Admin 解密應只在 browser 內完成，還是使用受控 Admin tool？
- 第三方調查員是否需要 delegated decrypt access？
- private IPFS 節點應如何跨公司共享？
- 除了 ZK identity privacy 外，是否需要更高程度的 network-level anonymity？


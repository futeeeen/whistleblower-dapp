# 專案 Push 修改紀錄

## 2026.05.12_16:50:00
* 調整 Employee burner wallet 模式，讓員工端讀鏈與送交易不再依賴 MetaMask。
* 新增 burner 模式自動使用 companyId 對應的 Admin public key 加密舉報內容。
* 新增前端自動上傳 encrypted payload 到 Private IPFS Cluster，並自動回填 ipfsCID 與 messageHash。
* 更新 IPFS Cluster Docker CORS 設定，允許本機 Vite 前端呼叫 Cluster REST API。
* 新增與更新 E2E proof 測試腳本，涵蓋公司、群組、員工 commitment、IPFS、burner、nullifier 與 quota 測試路徑。
* 將 ZK proof UX 改成三段式流程：Preload proof artifacts、Prepare anonymous credential、Encrypt + upload report。
* 合約 proof message 改為匿名憑證模式：keccak256(companyId, reportGroupId, period, reportSlot, REPORT_CREDENTIAL_V1)。
* README 補充匿名憑證流程、proof 不再綁定 ipfsCID/contentHash 的設計取捨。
* 修復前端中文說明亂碼造成的 JSX build 問題。
* 完成 sanity test：合約 compile、前端 build、Private IPFS health、IPFS 上傳/讀回、前端 Employee UI 檢查。

## 2026.05.12_13:44:00
* 新增產品架構文件，整理目前 PoC 與未來聯盟鏈 / 許可鏈匿名舉報平台方向。
* 新增多公司 / 多 Group ID 設計，支援 companyId、reportGroupId、topic、quota、period、reportSlot。
* 新增 SaaS Admin tab，讓前端可建立 Company 與 Report Group。
* 新增 burner wallet / zero-gas 設計，模擬員工免 Gas 的聯盟鏈提交流程。
* 更新 nullifier scope 與 quota 設計，使用 companyId + groupId + period + reportSlot 控制每人有效舉報次數。
* 保留 Amoy 測試網功能，但標註 burner 免 Gas 僅適用本機或未來許可鏈環境。
* README 補充 Docker Desktop / Docker daemon / Private IPFS 啟動流程。

## 2026.05.12_00:10:10
* 新增專案資料夾導覽圖，協助組員快速理解 root、docs、whistleblower-semaphore、private-ipfs-cluster、legacy-basic-dapp 的用途。
* 美化導覽圖，修正文字超出框線與版面不專業的問題。
* 將導覽圖放入 docs，供 README 與組員查閱。

## 2026.05.11_23:54:20
* 重新整理專案結構，將早期基礎 DApp demo 移入 legacy-basic-dapp。
* 將目前主要匿名舉報 PoC 保留在 whistleblower-semaphore。
* 新增 private-ipfs-cluster，建立 Private IPFS + IPFS Cluster 環境。
* 新增 IPFS 啟動、停止、健康檢查、上傳 encrypted report 的 scripts。
* 更新根目錄 README，說明主要資料夾、啟動順序、Docker Desktop 與 Private IPFS 操作方式。
* 更新 whistleblower-semaphore README，說明 Private IPFS、Admin decrypt、metadata 上鏈與 IPFS CID 查詢流程。

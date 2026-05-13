# 專案 Push 修改紀錄

## 2026.05.13_19:11:12
* 修復 ZK proof generation E2E 測試長時間卡住的問題。
* 找到根因：proof child 實際已完成 proving，但未明確結束 process，導致 parent 等到 timeout。
* 同時避開 Node 端 BigInt witness input 對 snarkjs 不穩的情況，改為 decimal string witness input。
* 將 generateSemaphoreProofChild.js 改為直接使用 wtns.calculate + groth16.prove，並用 packGroth16Proof 輸出合約可驗證格式。
* E2E timeout 時會附上 child stderr debug 訊息，未來若 proof 卡住更容易定位。
* 修正 non-member proof 測試，讓測試與前端一樣明確使用 group.depth。
* 完整 npm run e2e:proof 已通過，涵蓋 proof、Private IPFS、burner gasPrice=0、nullifier replay、quota slot 與 non-member rejection。
* 同步完成 npm run compile、frontend npm run build 與 diff 格式檢查。

## 2026.05.13_12:57:56
* 新增 product-presentation 互動式產品介紹網站，可取代簡報用來展示匿名舉報平台。
* 展示頁包含產品定位、痛點、角色流程、ZK proof、Hybrid Encryption、Private IPFS、聯盟鏈 / 許可鏈與互動情境 Demo。
* 設計企業級可信任視覺風格，支援簡報模式、右側章節導覽、角色切換、架構卡片與情境切換。
* 新增 GitHub Actions workflow，將 product-presentation 自動部署到 GitHub Pages。
* 修正 GitHub Pages workflow 設定，加入 Pages enablement 與 Node 24 環境設定。
* 完成部署驗證，產品介紹頁已可透過 GitHub Pages 網址公開瀏覽。

## 2026.05.13_11:56:45
* 新增 hybrid encryption 匿名雙向溝通流程，每筆舉報自動產生一組 thread secret key。
* 初次舉報內容改為使用 AES-GCM 對稱式加密，並用公司 Admin public key 加密 thread secret key。
* 前端提醒舉報者保存 thread secret key，後續查看 Admin 回覆與再次回覆都使用同一把案件 thread key。
* 合約新增 ReportMessage、reportMessages mapping、ReportMessageAdded event 與 addReportMessage，鏈上只保存 CID、hash、senderRole、timestamp 等 metadata。
* Admin review 區塊新增匿名案件對話，可解密初次舉報後使用 recovered thread key 加密追問並上傳 Private IPFS。
* Employee 頁面新增輸入 reportId + thread secret key 的匿名對話區，可讀取 Admin 回覆並用 burner wallet 送出後續回覆。
* 補上 Set Company Admin Public Key(companyId, publicKey)，讓每間公司可由 platform owner 或該公司 adminAddress 更新自己的加密公鑰。
* 前端 Admin Encryption Key 區塊新增 companyId 輸入，改為寫入 companies[companyId].adminPublicKey。
* README 補充 hybrid encryption、匿名 thread reply、多公司 Admin public key 設定與正式版需加 reply-token / ZK 授權的注意事項。
* 完成驗證：合約 compile、ABI 同步、前端 production build、diff 格式檢查。

## 2026.05.13_11:01:31
* 新增公司端案件狀態管理，Admin 可查詢本公司舉報後更新指定 report 的狀態與處理備註。
* 合約新增 ReportStatus、reportStatuses mapping 與 ReportStatusUpdated event，讓案件處理狀態可上鏈留存 audit trail。
* 前端 Admin 報表區新增 Load Company Reports、狀態選單、備註輸入與 Update Status 操作。
* 新增離職員工退出流程，Admin 可載入目前群組成員後，使用 commitment 產生 remove proof 並移除該成員。
* 合約新增 EmployeeMemberRemoved event 與 removeEmployeeMember，並允許公司 Admin 管理自己 report group 的成員新增 / 移除。
* 調整成員載入邏輯，前端會同時讀取 EmployeeMemberAdded 與 EmployeeMemberRemoved events，重建目前有效 member list。
* 新建立的 Semaphore group 將 old root validity duration 設為 0，降低離職員工透過舊 Merkle root 繼續提交的風險。
* README 補充 Remove Ex-Employee、Load Company Reports、Update Status，以及 commitment 隱私與 offboarding 安全性說明。
* 完成驗證：合約 compile、前端 production build、ABI 同步與 diff 檢查。

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

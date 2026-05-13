# 匿名舉報平台互動式產品介紹

這個資料夾是一個可取代簡報的互動式產品展示網頁，獨立於主 DApp，不影響 `whistleblower-semaphore` 或 `private-ipfs-cluster`。

## 如何開啟

最簡單方式：

```powershell
cd C:\futen\政大\3_區塊鏈\final\product-presentation
start index.html
```

建議方式，避免部分瀏覽器限制本機檔案互動：

```powershell
cd C:\futen\政大\3_區塊鏈\final\product-presentation
python -m http.server 4173
```

然後打開：

```text
http://localhost:4173
```

## 內容重點

- 產品定位與痛點
- 員工匿名舉報流程
- 公司 Admin 處理與匿名雙向溝通
- ZK proof、nullifier、Private IPFS、hybrid encryption 的信任設計
- 聯盟鏈 / 許可鏈與員工免 Gas 架構
- 適合 demo 時逐段導覽，也可以讓評審自由點選互動

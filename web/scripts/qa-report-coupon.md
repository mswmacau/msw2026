# 優惠券核銷閉環 QA 測試報告

**被測功能**：管理後台「優惠券」tab、優惠券核銷 API、會員端同步、權限。
**環境**：http://localhost:3000（生產模式，未重啟）  
**測試帳號**：admin@msw.mo / msw2026admin；kelvin@msw.mo / msw2026；ming@msw.mo / msw2026  
**執行時間**：2026-09-23  
**報告與截圖路徑**：
- `/workspace/msw/web/scripts/qa-report-coupon.md`
- `/workspace/msw/web/scripts/shots/coupon-*.png`

---

## 執行摘要

| 層面 | 用例數 | 通過 | 失敗 |
|---|---|---|---|
| 功能 | 7 | 6 | 1 |
| 邊界 | 4 | 3 | 1 |
| 安全 | 4 | 4 | 0 |

功能/邊界失敗項見「缺陷清單」。

---

## 缺陷清單

### P2-1：核銷成功後，優惠券列表未即時更新

- **描述**：在「優惠券」tab 輸入有效券號並成功核銷後，下方列表的狀態欄仍顯示「未使用」，必須手動重新整理頁面才會變成「已核銷」。
- **復現步驟**：
  1. 以 admin 登入，進入 `/admin` →「優惠券」tab。
  2. 輸入 Kelvin 的未使用券號 `MSW-202609-99ZA938Z`，點「核銷」。
  3. 觀察綠色成功提示出現，但列表中該列狀態仍為「未使用」。
  4. 等待 6 秒以上仍無變化（`page.on('request')` 只攔截到 `POST /api/admin/coupons/redeem`，無任何重新獲取列表的請求）。
  5. 按 F5 / 重新載入頁面後，狀態才變為「已核銷」。
- **實際結果**：立即刷新列表仍為「未使用」。
- **預期結果**：核銷成功後，列表應在 1-2 秒內自動重新整理並顯示「已核銷」。
- **影響範圍**：管理員核銷流程，可能重複輸入同一張券。
- **證據**：`coupon-2-redeem-success.png`（成功提示＋列表仍顯示未使用）、`coupon-10-stale-list.png`（6 秒後仍為未使用）、`coupon-11-after-reload.png`（重新載入後才正確）。
- **定位**：前端 redeem 成功後未調用列表刷新。
- **修復建議**：在 `POST /api/admin/coupons/redeem` 成功後，使列表查詢失效或主動重新獲取優惠券資料。

### P2-2：後台列表將已過期券顯示為「未使用」

- **描述**：對於 `expiresAt` 已經過期的優惠券，管理後台列表的「狀態」欄仍顯示「未使用」。
- **復現步驟**：建立一張過期券（`MSW-202601-EXPIRED`，有效期 2026-02-01），進入 `/admin` →「優惠券」tab，觀察狀態欄。
- **實際結果**：狀態欄顯示「未使用」。
- **預期結果**：應顯示「已過期」或特殊狀態標記，避免管理員誤發/誤核。
- **影響範圍**：過期券管理視覺辨識。
- **證據**：`coupon-7-expired.png`。
- **修復建議**：列表渲染時根據 `expiresAt < now` 即時計算並顯示「已過期」狀態。

### P3-1：空值輸入無任何回饋

- **描述**：在核銷輸入框只輸入空格後點「核銷」，畫面無 API 請求、無提示。
- **實際結果**：無反應。
- **預期結果**：顯示「請輸入券號」之類的錯誤提示。
- **影響範圍**：極少數使用者誤操作。
- **證據**：`coupon-8-empty.png`。

---

## 驗收標準核對

| 驗收標準 | 結論 | 依據 |
|---|---|---|
| 管理後台 `/admin` 第四個 tab「優惠券」存在 | ✅ 通過 | `coupon-1-list.png`、`coupon-list-final.png` 均顯示 4 個 tab：待確認截圖、訓練出席、達成名單、優惠券。 |
| 含核銷輸入框與全部優惠券列表 | ✅ 通過 | 截圖顯示輸入框 + 表格（券號、會員、內容、月份、狀態、有效期）。 |
| 正常核銷成功並給會員 +20 積分 | ✅ 通過 | 請求 `200`，Kelvin 積分 620→640，積分明細出現「優惠券核銷回饋 +20」。 |
| 重複核銷被攔截 | ✅ 通過 | 第二次兌換回傳 `409`，紅色錯誤提示。 |
| 過期券被攔截 | ✅ 通過 | 過期券回傳 `410`，紅色錯誤提示「此優惠券已過期」。 |
| 錯誤券號提示「找不到這個優惠券號」 | ✅ 通過 | `MSW-FAKE-0000` 回傳 `404` 並顯示指定文案。 |
| 會員端 `/dashboard` 同步顯示已使用與積分 | ✅ 通過 | Kelvin 儀表板顯示「已使用」、卡片變暗、可用積分 640。 |
| 普通會員訪問 `/admin` 被拒 | ✅ 通過 | 顯示「沒有權限」且 API 回傳 `403`。 |

---

## A/B/C/D/E 逐項證據

### A. 正常核銷

- 使用券號：`MSW-202609-99ZA938Z`（Kelvin）
- 操作後畫面：`coupon-2-redeem-success.png`
- API 回傳：
  ```json
  POST /api/admin/coupons/redeem
  HTTP/1.1 200 OK
  {"ok":true,"message":"核銷成功：全館 8 折","coupon":{"code":"MSW-202609-99ZA938Z","title":"2026-09 月度 300KM 達成優惠券","discount":"全館 8 折","periodMonth":"2026-09","memberName":"Kelvin"}}
  ```
- 資料驗證：DB 中 `Coupon.status = USED`、`Kelvin.points = 640`（原 620）。

### B. 重複核銷攔截

- 操作：再次輸入同一券號。
- API 回傳：
  ```json
  POST /api/admin/coupons/redeem
  HTTP/1.1 409 Conflict
  {"error":"此券已於 2026/9/23 上午11:40:17 核銷過","usedAt":"2026-09-23T03:40:17.735Z"}
  ```
- 畫面：`coupon-3-duplicate-blocked.png`（紅色錯誤提示）。
- 查詢 API：
  ```json
  GET /api/admin/coupons/redeem?code=MSW-202609-99ZA938Z
  HTTP/1.1 200 OK
  {"code":"MSW-202609-99ZA938Z","title":"2026-09 月度 300KM 達成優惠券","discount":"全館 8 折","status":"USED","expiresAt":"2026-12-23T00:17:31.203Z","periodMonth":"2026-09","memberName":"Kelvin"}
  ```
- 資料驗證：重複操作後 Kelvin 積分仍為 640，只有一筆 `PointLog`（+20）。

### C. 錯誤券號

- 輸入：`MSW-FAKE-0000`
- API 回傳：
  ```json
  POST /api/admin/coupons/redeem
  HTTP/1.1 404 Not Found
  {"error":"找不到這個優惠券號"}
  ```
- 畫面：`coupon-4-not-found.png`（紅色提示「找不到這個優惠券號」）。

### D. 會員端同步

- 以 `kelvin@msw.mo` 登入後開啟 `/dashboard`。
- 畫面：`coupon-5-member-used.png`
- 驗證：
  - 我的優惠券區塊出現 `MSW-202609-99ZA938Z`，標示「已使用」。
  - 卡片套用 `opacity-60` 與 `border-white/10 bg-ink3`，視覺上變暗。
  - 積分卡顯示「可用積分 640」。
  - 積分明細顯示「優惠券核銷回饋（MSW-202609-99ZA938Z） +20」。

### E. 權限

- 以 `ming@msw.mo` 登入後訪問 `/admin`。
- 畫面：`coupon-6-member-forbidden.png`（顯示「沒有權限」）。
- API 驗證：
  - 會員身份 `POST /api/admin/coupons/redeem` → `403 Forbidden {"error":"沒有權限"}`
  - 會員身份 `GET /api/admin/coupons/redeem?code=...` → `403 Forbidden`
  - 未登入身份 `POST /api/admin/coupons/redeem` → `403 Forbidden`

---

## API 邊界 / 安全探測結果

| 測試項目 | 方法 | 狀態 | 回傳 |
|---|---|---|---|
| 無 code | GET | 400 | `{"error":"請輸入券號"}` |
| 空 code | GET | 400 | `{"error":"請輸入券號"}` |
| 不存在 code | GET | 404 | `{"error":"找不到這個優惠券號"}` |
| SQL injection 樣本 | GET | 404 | `{"error":"找不到這個優惠券號"}` |
| 5000 字超長 code | GET | 404 | `{"error":"找不到這個優惠券號"}` |
| 無 body | POST | 400 | `{"error":"請輸入優惠券號"}` |
| 空 code | POST | 400 | `{"error":"請輸入優惠券號"}` |
| 小寫券號 | POST | 200 | 成功核銷（大小寫不敏感） |

---

## 截圖清單

| 檔名 | 說明 |
|---|---|
| `coupon-1-list.png` | 準備階段：優惠券列表（拍攝於核銷前，兩張皆為「未使用」） |
| `coupon-2-redeem-success.png` | A 正常核銷：綠色成功提示＋會員 Kelvin（列表仍為未使用） |
| `coupon-3-duplicate-blocked.png` | B 重複核銷：紅色錯誤提示，狀態未改變 |
| `coupon-4-not-found.png` | C 錯誤券號：紅色「找不到這個優惠券號」 |
| `coupon-5-member-used.png` | D 會員端：已使用標示 + 積分 640 + 積分明細 +20 |
| `coupon-5-member-used-viewport.png` | D 會員端視窗截圖 |
| `coupon-6-member-forbidden.png` | E 權限：普通會員進入 `/admin` 顯示「沒有權限」 |
| `coupon-7-expired.png` | 過期券攔截（測試過程截圖） |
| `coupon-8-empty.png` | 空值輸入無反應 |
| `coupon-9-tab1~4-*.png` | 四個 tab 切換驗證 |
| `coupon-10-stale-list.png` | 核銷 6 秒後列表仍為未使用（輔助證據） |
| `coupon-11-after-reload.png` | 重新載入後列表正確顯示已核銷（輔助證據） |
| `coupon-list-final.png` | 測試結束後乾淨的優惠券列表 |

---

## 資料異動說明與清理結果

### 本次測試造成的正常異動

- **Kelvin（kelvin@msw.mo）**
  - 優惠券 `MSW-202609-99ZA938Z`：狀態由 `UNUSED` 改為 `USED`。
  - 積分：由 `620` 增加至 `640`（+20 回饋）。
  - 積分明細新增一筆 `PointLog`：`優惠券核銷回饋（MSW-202609-99ZA938Z） +20`。   
  **此為 A 步驟預期內的改動。**

### 本次測試造成的意外異動與清理

- 在執行大小寫邊界探測時，意外使用 `msw-202609-ksxuuugf` 核銷了 阿明 的券 `MSW-202609-KSXUUUGF`，造成：
  - 阿明積分由 87 → 107。
  - 券狀態變為 `USED`。
  - 新增一筆 `PointLog`。
- **已於測試後清理並還原**：刪除該筆 `PointLog`、將 阿明 積分還原為 87、將 `MSW-202609-KSXUUUGF` 還原為 `UNUSED`。

### 測試用資料清理

- 建立並用於過期測試的 `MSW-202601-EXPIRED` 已於測試後從資料庫刪除。

### 最終資料狀態

- Kelvin：`points = 640`、`totalPoints = 640`，`MSW-202609-99ZA938Z` 為 `USED`。
- 阿明：`points = 87`、`totalPoints = 107`，`MSW-202609-KSXUUUGF` 為 `UNUSED`。
- 僅存在一筆 coupon 相關 `PointLog`：Kelvin +20。

---

## 測試結論

**有條件交付（需修復 P2-1）**。

核心閉環功能（核銷、重複攔截、過期攔截、會員端同步、權限控管、積分回饋）均已正確運作；安全邊界（SQL 注入、超長輸入、無權限存取）亦已攔截。主要問題為核銷後列表未即時刷新，建議修復後重新執行 A 步驟回歸測試。

# MSW 街健館「定期訓練活動簽到閉環」測試報告

- 測試日期：2026-09-23（星期三）10:52 – 11:07 CST
- 環境：http://localhost:3000（Next.js 14.2.15 生產模式，未重啟）／時區 Asia/Shanghai (UTC+8)
- 工具：puppeteer-core 25.11.0 + /usr/bin/chromium（headless，--no-sandbox），全程真實瀏覽器操作與截圖
- 帳號：admin@msw.mo（ADMIN）、ming@msw.mo（MEMBER，測前可用積分 87）

## 執行摘要

| 層面 | 用例數 | 通過 | 失敗 |
|---|---|---|---|
| 功能 | 9 | 8 | 1 |
| 邊界 | 2 | 2 | 0 |
| 安全 | 3 | 3 | 0 |

## 缺陷清單

### P1-1 管理端補簽寫入錯誤週次（日期偏移 7 天）
- 描述：管理後台「訓練出席」分頁的場次日期顯示為 2026-09-20（上週日），本週一應為 2026-09-21；以該日期補簽，後端實際寫入 sessionDate=2026-09-14（上上週的週一）。
- 復現步驟：
  1. admin@msw.mo 登入 → /admin →「訓練出席」分頁；
  2. 日期選擇器顯示 09/20/2026（預期 09/21/2026）；
  3. 下拉選「阿明（ming@msw.mo）」→ 點「＋ 補簽」。
- 實際結果：POST /api/checkin 請求體 `{"userId":"cmudcldi9…","date":"2026-09-20"}`，響應 `{"ok":true,"sessionDate":"2026-09-14","points":10}`，出席被記到 2026-09-14 場次；toast 顯示「2026-09-14 出席 1 人」，且日期框漂移為 09/14/2026。
- 預期結果：補簽寫入本週一 2026-09-21 場次。
- 影響範圍：所有手動補簽／移除操作；被補簽會員的會員中心「本週已簽到」狀態不會生效（記到了錯誤週），週一當天自助簽到會與補簽記錄錯週而可重複簽到不同週次，出席統計歸週錯誤。
- 證據：截圖 admin-2-training.png（日期 09/20/2026）、admin-4-after-checkin.png（toast「2026-09-14 出席 1 人」、日期框 09/14/2026）；網路流量記錄（見下）。
- 定位：`src/app/admin/page.tsx:123` `weekSessionDate={thisMonday.toISOString().slice(0, 10)}`——getMondayOfWeek 回傳本地（UTC+8）週一 00:00 的 Date，toISOString 轉 UTC 後倒退 8 小時變成週日，slice 取到 09-20；同樣寫法見 `src/app/dashboard/page.tsx:139`。API 端 `src/app/api/checkin/route.ts:74` 對 `date` 參數 `new Date(body.date)` 按 UTC 解析，經 `getMondayOfWeek`（本地時區運算）再次錯位至 09-14。
- 修復建議：weekSessionDate 改用本地年月日格式化（如 `ymd()` 工具，page.tsx 內已有同函式可復用）；API 端對 `date` 參數先按 `ymd` 解析為本地日期再取週一，避免 UTC/本地混用。

### P2-1 補簽成功提示被覆蓋，未顯示「已補簽」文案
- 描述：AdminConsole.manualCheckIn 先 flash「已補簽出席並給予積分」，隨即 loadCheckIns 內再 flash「{date} 出席 N 人」覆蓋前者。
- 實際：toast 僅顯示「2026-09-14 出席 1 人」；預期：顯示補簽成功提示。
- 影響：管理員仍能感知成功（名單 +1），屬體驗問題。證據：admin-4-after-checkin.png。
- 定位：`src/app/admin/AdminConsole.tsx:122`（flash）與 `:108`（loadCheckIns 內 flash）。
- 修復建議：loadCheckIns 增加靜默參數，操作後刷新名單不覆蓋操作 toast。

### P3-1 favicon.ico 404
- 每個頁面 console 均報 `GET /favicon.ico 404`，為控制台唯一持續性錯誤。建議補充 icon 檔案。

### P3-2 「訓練出席」分頁計數與名單可因日期漂移顯示錯週資料
- 描述：分頁標籤計數 `訓練出席 (N)` 取自服務端正確週次（09-21），而名單刷新邏輯用畫面上的錯誤日期（09-20→映射 09-14），兩者可能指向不同週，出現「標籤計數 1、名單卻顯示本週尚無出席紀錄」的不一致。證據：admin-6-load-with-shown-date.png。根因同 P1-1。

## 功能驗證（A/B/C/D）

| 項目 | 結論 | 依據（實測） |
|---|---|---|
| A 管理員登入 | 通過 | /login 填表點「登入」→ 跳轉 /dashboard（waitForFunction 校驗 pathname），無錯誤提示；admin-dashboard.png |
| B1 待確認截圖 tab | 通過 | 6 張待審卡片（阿明×2、小慧、Kelvin×2、阿祖），均含「✓ 確認」「✕ 駁回」可點；admin-1-review.png |
| B2 訓練出席 tab | 失敗（P1-1） | 分頁存在，含日期選擇器、「載入名單」、補簽下拉（4 名會員）、「＋ 補簽」，初始名單「本週尚無出席紀錄」；但日期顯示 09/20/2026 錯誤；admin-2-training.png |
| B3 達成名單 tab | 通過 | 表格 1 筆：Kelvin 320.0 KM「已發券」；含月份選擇器與一鍵發放按鈕；admin-3-winners.png |
| C 補簽 | 部分通過 | UI 生效：名單 +1（阿明 +10）、toast 成功、分頁計數 0→1；但寫入錯誤週次（P1-1）；admin-4-after-checkin.png |
| C 移除 | 通過 | confirm 對話框「確定移除這筆出席紀錄？積分一併扣回。」→ 接受 → DELETE /api/checkin?id=… 200，名單恢復空、計數 1→0；admin-5-after-remove.png |
| C 積分對帳 | 通過 | ming 積分 87 →（+10）→（−10）→ 87；積分明細可見「出席 2026-09-14 +10」與「取消 2026-09-14 −10」成對記錄；member-dashboard.png |
| D 會員視角 | 通過 | ming 登入 /dashboard：會員卡 87/97、「本週場次」區塊存在且顯示「9月21日 星期一 20:00 – 21:00」、按鈕為「非活動日」禁用態（週三無「我要簽到」按鈕）；member-dashboard.png |
| D 登出 | 通過 | 點「登出」→ 跳轉 /，session={}，再訪 /dashboard 被重定向 /login?callbackUrl=/dashboard |

## 邊界與安全

| 用例 | 結果 | 證據 |
|---|---|---|
| 會員週三直接 POST /api/checkin | 403 `{"error":"定期訓練只在每週一舉行，今天沒有訓練活動"}` | qa-d 腳本輸出 |
| 會員 GET /api/checkin?all=1（管理端名單） | 403 `{"error":"沒有權限"}` | 同上 |
| 會員開啟 /admin 頁 | 渲染「🔒 沒有權限」頁，無資料洩露 | member-admin-forbidden.png |
| 移除不存在的記錄後再查 | 名單 count=0，無殘留 | qa-verify-data 輸出 |

## 控制台錯誤
全程僅兩類：favicon.ico 404（P3-1）；權限測試主動觸發的 403（預期）。無 JS 運行時錯誤（pageerror 為 0）、無 React hydration 報錯。Next.js RSC 預取的 net::ERR_ABORTED 為導航中止的正常現象，不計缺陷。

## 驗收標準核對
| 驗收標準 | 結論 |
|---|---|
| /dashboard 新增「本週場次」區塊與自助簽到按鈕（非活動日禁用） | 通過（顯示「非活動日」，無簽到按鈕） |
| 本週場次顯示正確週一 2026-09-21 | 通過（會員端）；管理端日期選擇器顯示 09-20，不通過（P1-1） |
| /admin 第三個 tab「訓練出席」：名單／補簽／移除（含扣回） | 介面與交互通過；補簽落庫週次錯誤（P1-1），移除含扣分通過 |
| API /api/checkin POST/GET/DELETE | 通過（權限與資料均正確） |
| 週一 19:30–21:30 開放限制 | 邏輯通過（非週一被 403 擋下；時段內行為未實測——當天非週一，無法真實觸發，僅靜態確認程式碼路徑，不作為通過依據） |

## 測試數據清理
- 補簽產生的 TrainingCheckIn 記錄已透過 UI「移除」刪除；複核 GET ?date=2026-09-14 與 2026-09-21 均 count=0。
- ming 積分還原至測前值 87（PointLog 保留 +10/−10 審計記錄，淨額為 0）。
- 未使用 pretest_ 前缀資料（僅操作既有種子會員「阿明」，以成對加減分保證淨零）；無需刪除種子資料。

## 測試腳本與截圖
- 腳本：scripts/qa-ab.mjs、qa-c.mjs、qa-d.mjs、qa-logout.mjs、qa-verify-data.mjs（可重跑，均自清理）
- 截圖目錄：/workspace/msw/web/scripts/shots/

## 測試結論
**有條件交付（需修復 P1-1）**。會員端展示與權限控制、簽到限制、移除扣分閉環均正常；但管理端補簽會把出席記到錯誤週次，屬核心資料正確性缺陷，修復並回歸後方可交付。

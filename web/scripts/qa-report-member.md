# QA 測試報告 — 後台會員管理 & 會員自助設定

- 測試人：秦戈（QA）
- 日期：2026-09-23
- 環境：http://localhost:3000（生產模式，未重啟、未 build）
- 工具：puppeteer-core + Chromium `/usr/bin/chromium`（`--no-sandbox --disable-dev-shm-usage`），viewport 1440×1000
- 腳本：`/workspace/msw/web/scripts/qa-mem-*.mjs`
- 截圖：`/workspace/msw/web/scripts/shots/`

## 【測試範圍】

| 項目 | 內容 |
|---|---|
| 功能 | 後台會員列表 / 搜尋 / 手動調整積分 / 角色切換；`/settings` 改暱稱、改密碼 |
| API | `GET\|PATCH /api/admin/members`、`PATCH /api/profile` |
| 帳號 | admin@msw.mo（ADMIN）、ming / hui / kelvin / joe@msw.mo（MEMBER） |
| 基線 | admin 0分 · ming 57分 · hui 35分 · kelvin 376分 · joe 13分 |

## 【執行摘要】

| 層面 | 用例數 | 通過 | 失敗 |
|---|---|---|---|
| 功能 | 24 | 24 | 0 |
| 邊界 | 18 | 18 | 0 |
| 安全 | 11 | 11 | 0 |
| **合計** | **53** | **53** | **0** |

功能全數通過；發現 **1 個 P2 體驗缺陷**（非阻斷）。

## 【缺陷清單】

### P2-1 `/settings` 儲存後的成功提示落在視窗外，預設畫面看不到回饋

- **描述**：`/settings` 提交暱稱／密碼後，綠色成功提示渲染在兩張卡片**下方**。頁面高 1718px、viewport 僅 1000px，提示 `top=1215px`，使用者按下「儲存資料」時完全看不到任何回饋，容易誤判為失敗並重複提交。
- **復現步驟**：
  1. 以 ming@msw.mo 登入 → 進入 `/settings`
  2. 不捲動，直接點「儲存資料」
  3. 觀察畫面
- **實際結果**：`banner top=1215px > viewport 1000px`，提示不可見；截圖 `settings-7-banner-below-fold.png` 與 `settings-1-name-updated.png` **位元組完全相同**（md5 `eef2204c…`），即兩張截圖畫面一模一樣 → 證明提示不在視窗內。
- **預期結果**：提交後提示應立即出現在使用者視線範圍（如按鈕下方或頂部 toast）。
- **影響範圍**：所有使用 `/settings` 的會員（改暱稱、改密碼皆受影響），100% 觸發。
- **證據**：
  ```
  layout = {"viewportH":1000,"scrollH":1718,"saveBtnBottom":681.25}
  成功 banner = {"text":"暱稱已更新","top":1214.75,"inViewport":false}
  => banner 是否需要捲動才可見: 是
  ```
  捲動後可見截圖：`settings-6-name-banner-visible.png`（提示確實存在，功能本身正常）
- **定位**：`src/app/settings/SettingsForm.tsx:134-144`，提示 `<p>` 置於兩個 `.card` 之後，未做 toast／置頂或 `scrollIntoView`。
- **修復建議**：將提示改為 `fixed` 頂部 toast（沿用 `AdminConsole.tsx:307` 既有 toast 樣式），或在 `setMsg` 後 `msgRef.current?.scrollIntoView({ block: 'center' })`。

> 說明：本次回報**無 P0／P1**。角色越權、積分帳目、密碼校驗均實測通過，未發現阻斷或安全問題。

## 【驗收標準核對】

| 驗收標準 | 結論 | 依據 |
|---|---|---|
| A. 5 位用戶全在列表，1 ADMIN + 4 MEMBER | ✅ | `member-1-list.png`；roles = 1 ADMIN / 4 MEMBER |
| A. tab 共 5 個且都能切換 | ✅ | `["待確認截圖 (6)","訓練出席 (0)","達成名單 (1)","優惠券 (1)","會員 (5)"]`，逐一點擊皆正確切換 |
| A. 搜尋 kelvin 只剩 1 筆 | ✅ | `member-2-search.png`，僅 Kelvin |
| A. 重設恢復列表 | ✅ | 5 筆全回，輸入框清空為 `""` |
| B. +50 即時更新、帳目正確 | ✅ | 376 → **426**，UI 免重整即更新 |
| B. 積分明細出現「測試加分 +50」 | ✅ | `member-4-pointlog.png`，明細含 `測試加分 +50 / 測試扣分 -50` |
| B. 負數可扣分 | ✅ | 426 → **376**（`member-5-points-minus.png`），DB 同步 |
| C. 不能變更自己角色 | ✅ | API 400 + 紅色 toast「不能變更自己的角色」，DB role 仍 ADMIN |
| C. 對他人切換角色可行 | ✅ | kelvin MEMBER→ADMIN→MEMBER 均成功 |
| D. 改暱稱成功且持久化 | ✅ | DB `阿明改`，重整後仍為 `阿明改` |
| D. 改密碼後可用新密碼登入 | ✅ | `msw2026new` 登入成功；舊密碼 bcrypt 比對 false |
| D. 錯誤舊密碼被攔截 | ✅ | 403「目前密碼不正確」，原密碼未變 |
| E. 會員訪問 /admin 顯示沒有權限 | ✅ | `member-8-member-admin-blocked.png` |
| E. 會員 PATCH 管理接口回 403 | ✅ | `{"status":403,"error":"沒有權限"}` |

### 附加邊界／安全實測（全數通過）

- 未登入：`GET/PATCH /api/admin/members` → **403**；`PATCH /api/profile` → **401**；`/settings` 導向 `/login?callbackUrl=/settings`
- 積分非法值：`0` / `"abc"` / `null` → 400；`±100001` → 400「不可超過 100,000 分」；`2.7` → 四捨五入 +3；`"50"` → +50；`-1` → 扣 1
- 缺 userId → 400「缺少 userId」；不存在 userId → 404；未知 action → 400
- 密碼 7 字元 → 400；只給新密碼不給舊密碼 → 400「請輸入目前密碼」；只改暱稱不影響 `passwordHash`（比對一致）
- 暱稱 40 字 → 後端截斷存 30 字（前端 `maxLength=30` 可被繞過，後端有防護）
- 搜尋：`%`、`' OR 1=1--`、500 字長字串 → 皆 200 且無注入、無崩潰（`%` 因 Prisma `contains` 未轉義而回全部 5 筆，屬可接受行為）
- 角色即時生效：joe 被升為 ADMIN 後**無需重登**即可進 `/admin`；降回 MEMBER 後即時收回
- `role` 傳非法值 `SUPERUSER` → 白名單回退為 MEMBER（安全，符合預期）

### 版面檢查

- 橫向溢出：無（`scrollWidth 1440 == clientWidth 1440`）
- 破版／重疊／文字裁切：未發現（見 `member-1-list.png`、`member-2-search.png`）
- 表格 `min-w-[880px]` + `overflow-x-auto`，1440 寬度下完整顯示，操作按鈕未被裁切
- window.prompt / confirm dialog 正常觸發與接收（4 次 prompt、3 次 confirm 皆如預期）

### 控制台報錯

**應用層無錯誤**。以下為預期內紀錄，非缺陷：
- `PATCH /api/admin/members` 400（C 組刻意觸發的「不能變更自己的角色」）
- `PATCH /api/profile` 403（D 組刻意測試的錯誤舊密碼）
- `?_rsc=… net::ERR_ABORTED`（Next.js 路由預取被切換打斷，框架正常行為）

## 【測試結論】

**可以交付**。A/B/C/D/E 五項驗收標準全數通過，53 條用例 0 失敗，無 P0/P1，無越權與帳目不一致。建議排期修復 P2-1（`/settings` 提示不可見），但不阻斷上線。

## 【數據改動與清理】

已於測試後執行 `qa-mem-cleanup.mjs` + `qa-mem-fix-total.mjs` 還原：

| 帳號 | 改動 | 還原狀態 |
|---|---|---|
| ming@msw.mo | 暱稱 阿明→阿明改；密碼 → msw2026new | 暱稱還原「阿明」；密碼還原 **msw2026**（已實測可登入） |
| kelvin@msw.mo | +50/-50 各一次、角色切換 2 次 | 4 筆測試 pointLog 已刪；積分 **376 / 376**；角色 MEMBER |
| hui@msw.mo | 邊界測試 +52 分；暱稱曾暫改 | 3 筆 `pretest_邊界` log 已刪；積分 **35 / 35**；暱稱「小慧」 |
| joe@msw.mo | 升/降 ADMIN | 角色 MEMBER |
| admin@msw.mo | 暱稱曾暫改（超長測試） | 暱稱「MSW 管理員」；角色 ADMIN |

清理後 `pointLog` 表為空，5 位用戶資料與測試基線一致（admin 0 / ming 57 / hui 35 / kelvin 376 / joe 13），回歸驗證通過。

## 【未測到 / 限制】

- 未測多方**併發**同時調整同一會員積分的競態（需壓測工具，本次未涵蓋）
- Google OAuth 登入路徑未測（`hasPassword=false` 分支的 UI 僅由程式碼確認，未實測）
- 未測行動裝置窄螢幕（<880px）的表格橫向捲動體驗
- 未驗證 `PATCH /api/profile` 對**已登入但帳號被刪除**之極端情境

## 【截圖清單】

| 檔案 | 內容 |
|---|---|
| `member-1-list.png` | 會員列表：5 人、1 ADMIN + 4 MEMBER、7 欄完整 |
| `member-2-search.png` | 搜尋 kelvin 後僅 1 筆 |
| `member-3-points-added.png` | +50 綠色 toast「已增加 50 分」+ 列表 426 |
| `member-4-pointlog.png` | Kelvin 會員中心：426 / 476，明細含測試加減分 |
| `member-5-points-minus.png` | -50 扣分後列表 376 |
| `member-6-self-role-blocked.png` | 紅色 toast「不能變更自己的角色」，admin 仍 ADMIN |
| `member-7-role-toggled.png` | Kelvin 角色切換結果 |
| `member-8-member-admin-blocked.png` | 會員訪問 /admin「沒有權限」 |
| `member-9-role-live-upgrade.png` | joe 升級後免重登即可進後台 |
| `settings-1-name-updated.png` | 暱稱變更（改為「阿明改」） |
| `settings-2-password.png` | 密碼變更流程 |
| `settings-3-wrong-oldpw.png` | 錯誤舊密碼「目前密碼不正確」 |
| `settings-4-relogin-newpw.png` | 新密碼重新登入成功 |
| `settings-5-name-banner-scrolled.png` | 全頁截圖 |
| `settings-6-name-banner-visible.png` | **捲動後提示才可見（P2-1 證據）** |
| `settings-7-banner-below-fold.png` | **預設視窗，提示不可見（P2-1 證據）** |
| `tab-待確認截圖/訓練出席/達成名單/優惠券/會員.png` | 5 個 tab 逐一截圖 |

# R3 最後一輪複驗報告

**環境**：https://a6dd31b4ad670a126.app.workbuddy.host  
**工具**：headless Chromium + puppeteer-core，viewport 1440×900 / 390×844  
**測試帳號**：admin@msw.mo / ming@msw.mo

## 執行摘要

| 層面 | 通過 | 失敗 |
|---|---|---|
| 功能 | 9 | 0 |
| 回歸 | 7 | 0 |
| 安全/權限 | 3 | 0 |

P1-2 已修正，無 P0/P1/P2 缺陷，僅 1 筆 P3 建議。

## P1-2 驗證

- **結論：已修正**
- 操作：/events 找到「週末長跑團練」卡片（WP 活動）→ 點擊
- 結果：進入 `/events/%E9%80%B1%E6%9C%AB%E9%95%B7%E8%B7%91%E5%9C%98%E7%B7%B4`，HTTP 200，`document.title` =「週末長跑團練 | MSW 街健館」，h1 與活動介紹正確顯示
- 截圖：`R3_01_events_list.png`、`R3_02_wp_event_detail.png`

## 快速回歸結果

1. 後台「網站設定」改名 → 前台導覽列與 document.title 同步，已還原原值（`R3_08`–`R3_11`）。
2. 新增純中文名稱活動「中文測試活動」（不填網址代稱）→ 系統自動產生 slug `act-mudxg7cn`，前台 `/events` 出現且內頁 200，已刪除（`R3_24`–`R3_28`）。
3. 編輯彈窗不捲動，「儲存活動」按鈕位於 viewport 內且可見（`R3_12_edit_modal.png`）。
4. 權限：ming 登入後開 `/admin` 顯示「沒有權限」（`R3_19_member_admin_denied.png`）；未登入 `GET /api/admin/settings`、`/api/admin/activities` 皆回 403。
5. `/`、`/events`、`/about`、`/contact`、`/login`、`/register`、`/leaderboard` 皆 200 且 CSS 載入正常（`R3_05_*`）。
6. 手機 390×844 開 `/` 與 `/admin`：`document.documentElement.scrollWidth` = `innerWidth` = 390，無水平溢出（`R3_22_mobile_home.png`、`R3_23_mobile_admin.png`）。
7. ming 登入後 `/dashboard`、`/run` 皆可正常開啟（`R3_20_member_dashboard.png`、`R3_21_member_run.png`）。

## 缺陷清單

### P3-1：WordPress 活動詳情資訊顯示佔位文字
- **描述**：「週末長跑團練」內頁的「活動資訊」區塊，時間顯示「請見活動內頁」、地點為「澳門」、積分為「—」，皆為佔位值。
- **影響**：WP 來源活動的資訊完整度不足，使用者無法直接查看時間、地點、積分。
- **截圖**：`R3_02_wp_event_detail.png`
- **修復建議**：從 WordPress 同步或對應欄位回填時間、地點、積分；若無資料則隱藏該區塊或顯示「暫無資訊」。

## 驗收標準核對

| 標準 | 結論 | 依據 |
|---|---|---|
| P1-2 WordPress 活動內頁不再 404 | 通過 | `R3_02`，HTTP 200 |
| 網站名稱同步與還原 | 通過 | `R3_10`、`R3_11` |
| 純中文活動新增與內頁開啟 | 通過 | `R3_25`–`R3_27` |
| 編輯彈窗儲存活動按鈕可見 | 通過 | `R3_12` |
| 會員無法進入 /admin | 通過 | `R3_19` |
| 未登入管理 API 回 403 | 通過 | curl 實測 |
| 主要頁面 200 + CSS 正常 | 通過 | `R3_05_*` |
| 手機無水平溢出 | 通過 | `R3_22`、`R3_23` |
| 會員中心流程可開 | 通過 | `R3_20`、`R3_21` |

## 資料清理

- 測試活動「pretest_中文測試活動」與「中文測試活動」已於後台刪除，活動列表已無 pretest 資料。
- 網站名稱已還原為「MSW 街健館」。

## 測試結論

**可以交付**。P1-2 已修正，必修與回歸項目全部通過，僅 P3 文案/資料回填建議，不阻塞上線。

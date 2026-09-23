# MSW 街健館 — 複驗報告（R2）

- 測試者：秦戈（QA）
- 日期：2026-09-23 08:54–09:15 UTC
- 環境：https://a6dd31b4ad670a126.app.workbuddy.host（公開站）
- 工具：headless Chromium（/usr/bin/chromium）+ puppeteer-core，桌面 1440×900 / 手機 390×844
- 帳號：admin@msw.mo（ADMIN）、ming@msw.mo（MEMBER）
- 截圖：/workspace/msw/qa-screenshots/（48 張，R2_ 前綴）；腳本：/workspace/msw/qa/R2_*.js

## 執行摘要

| 層面 | 用例數 | 通過 | 失敗 |
|---|---|---|---|
| 功能 | 15 | 14 | 1 |
| 邊界 | 3 | 3 | 0 |
| 安全 | 7 | 7 | 0 |

## 上回合缺陷複驗判定

### P1-1 中文活動名稱內頁 404 → ✅ 已修正
- 步驟：後台 UI 新增「週三核心訓練班」、網址代稱留空、勾選立即上架、儲存。
- 實際：系統自動產生 slug `act-mudvhzuo`（純英數），/events 出現該卡片；點入內頁 HTTP 200，`h1=週三核心訓練班`、`document.title="週三核心訓練班 | MSW 街健館"`、無 404 字樣；raw fetch 亦 200。
- 證據：R2_02_P1_form_filled_CJK_no_slug.png、R2_03_P1_front_events_list.png、R2_04_P1_activity_detail_200.png、R2_05_P1_detail_direct_nav.png。測後已刪除該活動（R2_06_P1_admin_after_cleanup.png）。

### P2-1 title/OG 不跟隨網站名稱 → ✅ 已修正
- 步驟：後台網站設定→品牌識別，site_name 改「QA複驗測試站R2」→儲存全部設定→前台重載。
- 實際：`document.title="QA複驗測試站R2 | MACAU STREET WORKOUT 澳門街頭健身"`，`og:title="QA複驗測試站R2 | MACAU STREET WORKOUT"`，頁首/頁尾同步。改回「MSW 街健館」後讀值復原。
- 證據：R2_08、R2_09、R2_10_P2_front_title_changed.png、R2_11、R2_12_P2_front_restored.png。

### P3-1 編輯彈窗儲存鈕要捲動才看得到 → ✅ 已修正
- 步驟：活動管理→第一張卡「編輯」→不捲動直接截圖（viewport 截圖）並量測。
- 實際：視窗高 900；「儲存活動」rect top=784 bottom=837、「取消」同列，皆在視窗內且 elementFromPoint 命中按鈕本身；操作列固定於彈窗底部（彈窗內容 scrollTop=0 未捲動）。
- 證據：R2_13_P3_modal_no_scroll.png。

## 回歸結果（第 4–8 項）

| 項目 | 結果 | 讀值 / 證據 |
|---|---|---|
| 4. 主色 00C2FF → CSS 變數 | ✅ | 改前 `--c-cobalt-bright="0 87 255"` → 改後 `"0 194 255"` → 還原 `"0 87 255"`。R2_15/R2_18/R2_20 |
| 5. 英文代稱活動全生命週期 | ✅ | slug `qa-english-regression`：上架→/events 可見→下架→消失→再上架→重現→刪除→消失。R2_21–R2_27 |
| 6. 權限 | ✅ | 匿名 GET/PUT /api/admin/settings 與 GET/POST /api/admin/activities 全 403 `{"error":"沒有權限"}`；會員 token 同 403；會員開 /admin 顯示「沒有權限」。R2_31/R2_33 |
| 7. 頁面回歸 | ✅ | /、/events、/about、/contact、/login、/register、/leaderboard、/dashboard(會員) 全 200，stylesheets=1、bodyBg=rgb(15,15,15)、變數正常。R2_34_*/R2_35 |
| 8. 手機 390×844 | ✅ | / 與 /admin：scrollWidth=390=innerWidth，無溢出元素。R2_36_mobile_home/admin.png |

## 新缺陷

### P1-2（新）WP 來源活動「週末長跑團練」內頁 404
- 描述：/events 列表含 WordPress 來源卡片「週末長跑團練」（標籤 WP 活動），連結為 percent-encoded 中文 slug，點入 404。
- 重現：1) 開 /events 2) 點「週末長跑團練」卡片。
- 實際：HTTP 404，`document.title="404: This page could not be found."`。
- 期望：200 並顯示活動內容；或列表不應出現死連結。
- 影響：前台活動列表对訪客暴露死連結，與原 P1-1 同症狀（本次修復僅覆蓋後台新增路徑，未覆蓋 WP 資料來源）。
- 證據：R2_23_CRUD_events_published.png（可見卡片）、R2_28_CJK_slug_wp_event_detail.png（404）。
- 定位：`web/src/lib/events.ts:130-140`（getActivities 併入 WP 活動）+ `events.ts:78`（fromWp 直接用 WP 的 CJK slug）；`events.ts:163-174`（getActivityBySlug 只查 DB 與 FALLBACK，不查 WP）。
- 建議：WP 活動入列時 slugify 為英數；或 getActivityBySlug 增加 WP 來源查詢；或 WP 活動改用 DB 落地。

## 測試資料清理

- 「週三核心訓練班」「QA 回歸英文代稱活動」均已刪除；活動剩 3 筆原始資料（weekly-training / monthly-run / street-workout-basics）。
- site_name=「MSW 街健館」、theme_primary=#0057FF 已還原（R2_99_final_front_state.png；前台 title 復原讀值佐證）。
- 匿名攻擊寫入（site_name=HACKED-R2 / POST 活動）均被 403 拒絕，無殘留。
- 未更動任何程式碼。

## 結論

**有條件交付**（需修復新缺陷 P1-2 後複驗）。三個上回合缺陷（P1-1、P2-1、P3-1）經真實瀏覽器實測均已修正，回歸全數通過；惟前台 /events 仍存在 WP 來源活動的 404 死連結（P1-2），屬原缺陷同類症狀，建議修復後再做一次單點複驗即可交付。

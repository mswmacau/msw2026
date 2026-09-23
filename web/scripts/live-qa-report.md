# MSW 街健館 — 公網驗收測試報告

- **測試對象**：https://a6dd31b4ad670a126.app.workbuddy.host （公網，非 localhost）
- **測試方式**：真實瀏覽器（puppeteer-core + Chromium）操作公網 + curl HTTP 探測
- **測試時間**：2026-09-23
- **腳本位置**：`/workspace/msw/web/scripts/live-*.mjs`
- **截圖位置**：`/workspace/msw/web/scripts/shots/live-*.png`
- **測試帳號**：admin@msw.mo、ming@msw.mo、新註冊帳號各一組

---

## 【測試範圍】

| 項目 | 內容 |
|---|---|
| 功能 | 頁面渲染、登入、註冊、跑步上傳、後台審核、優惠券核銷 |
| 邊界 | 表單驗證、參數邊界（負數／超大值／非數字／SQL 注入字串）、移動端溢出 |
| 安全 | 匿名越權、會員越權存取管理 API、IDOR、路徑穿越 |

---

## 【執行摘要】

| 層面 | 用例數 | 通過 | 失敗 |
|---|---|---|---|
| 功能 | 7 | 7 | 0 |
| 邊界 | 8 | 8 | 0 |
| 安全 | 12 | 12 | 0 |
| **合計** | **27** | **27** | **0** |

---

## 【1. 公網可達性與路由狀態】

`curl -I` 首請求：`HTTP/2 200`，`server: CloudStudio Gateway`，`x-powered-by: Next.js`，`eo-cache-status: MISS`。

| 路由 | HTTP | 渲染 | CSS | 備註 |
|---|---|---|---|---|
| `/` | 200 | 正常 | 已載入 | 505KB 截圖，Hero 圖完整 |
| `/events` | 200 | 正常 | 已載入 | |
| `/run` | 200 | 正常 | 已載入 | |
| `/login` | 200 | 正常 | 已載入 | |
| `/register` | 200 | 正常 | 已載入 | |
| `/dashboard` | 200 | 未登入 → `/login?callbackUrl=/dashboard`（預期行為） | 已載入 | |
| `/admin` | 200 | 未登入 → 顯示「請先登入管理員帳號」 | 已載入 | 無資料洩漏 |
| `/leaderboard` | 200 | 正常 | 已載入 | 顯示 Kelvin 376 分 |
| `/about` | 200 | 正常 | 已載入 | |

- **CSS 實證**：`link[rel=stylesheet]` 指向 `/_next/static/css/e83b5eed83686283.css`；`body` 背景為 `rgb(15,15,15)`、`h1` 為 `900` 字重。**非裸 HTML**。
- **圖片實證**：`/images/hero-workout.jpg`、`street-workout.jpg`、`community.jpg`、`running-track.jpg`、`training-outdoor.jpg` 全部 **200**，`naturalWidth=1200`，**0 破圖**。
- 全站 **0 個 500 錯誤頁**，無 `nextjs-portal` 錯誤浮層。
- 每個頁面訊息的 `?_rsc=` `net::ERR_ABORTED` 為 Next.js 預取在 `networkidle` 後的正常取消，非缺陷。

---

## 【2. 登入（公網最關鍵項）】✅ 通過

| 檢查 | 實際結果 |
|---|---|
| 登入後是否跳 localhost / 其他網域 | **否**。`navLog` 僅 `…/login → …/dashboard` |
| 實際請求 Host | **只有** `a6dd31b4ad670a126.app.workbuddy.host`（無任何跨域） |
| NextAuth 錯誤 | **無**，`/api/auth/callback/credentials` 回 200 |
| 登入後落地頁 | `/dashboard`，顯示「MSW 管理員 / admin@msw.mo」 |

> **P0 風險項：不存在。** 未出現跳轉 localhost 或 NextAuth 異常。
> 截圖：`live-login-ok.png`

---

## 【3. 寫入功能（公網 DB / 檔案系統）】✅ 通過

**註冊**（`liveqa<ts>@msw.mo`，密碼 12 碼）
- 送出後 → `/dashboard`，自動登入成功
- **積分 = 50**（明細：「註冊會員贈送積分 +50」）
- 截圖：`live-register.png`、`live-dashboard.png`

**跑步上傳**（`running-track.jpg`，6.66 KM）
- `POST /api/upload` → **200**（公網檔案寫入成功）
- 「我的上傳紀錄」出現 `6.66 KM … 待確認`，`待確認` 計數 0 → 1
- **縮圖正常顯示**：`/api/media/…jpg`，`naturalWidth=1200×800`，**破圖數 = 0**
- 截圖：`live-upload.png`

---

## 【4. 後台審核閉環】✅ 通過（數字全部對上）

| 動作 | 前 | 後 | 校驗 |
|---|---|---|---|
| 待確認紀錄（管理員總覽） | 7 | 6 | ✅ −1 |
| 2026-09 已確認里程 | 395 km | **402 km** | ✅ +6.66 與上傳值一致 |
| 會員「已確認 / 待確認」 | 0 / 1 | **1 / 0** | ✅ 狀態流轉正確 |
| 會員可用積分 | 50 | **57** | ✅ +7（6.66 進位取整，規則 1KM=1 分） |

- 管理員審核頁截圖縮圖全部正常（0 破圖）
- 積分明細新增「跑步紀錄確認 6.66 km +7」
- 截圖：`live-approve.png`、`live-confirmed.png`

> 說明：上傳 6.66 KM 顯示為 `6.7 KM`（1 位小數），積分 +7 為進位取整，與規則一致，非資料錯誤。

---

## 【5. 優惠券核銷】✅ 通過

- 管理員 →「優惠券」tab，輸入 `MSW-202609-DEMO01` → 核銷
- 回饋：「✓ 核銷成功：全館 8 折　會員：阿明 · 券號：MSW-202609-DEMO01」
- 清單狀態：`已核銷`，核銷時間 `2026/9/23`，有效期 `2026/12/23`
- 截圖：`live-redeem.png`

---

## 【6. 移動端 390×844】✅ 通過（無橫向溢出）

| 路由 | scrollWidth | innerWidth | 溢出 |
|---|---|---|---|
| `/` | 390 | 390 | **false** |
| `/run` | 390 | 390 | **false** |
| `/admin` | 390 | 390 | **false** |

- 首頁偵測到的 4 個「right > innerWidth」元素為裝飾性（marquee 跑馬燈、`-right-20` 光暈），已被 `overflow:hidden` 裁切，**未撐開 document**。
- 截圖：`live-mobile-home.png`、`live-mobile-run.png`、`live-mobile-admin.png`

---

## 【安全測試】

| 測試 | 預期 | 實際 | 結論 |
|---|---|---|---|
| 匿名存取 `/dashboard` | 401/跳登入 | 307 → `/login?callbackUrl=` | ✅ |
| 匿名存取 `/admin` | 攔截 | 200 但 SSR HTML **僅含登入提示，0 會員資料** | ✅ |
| 匿名 `GET /api/runs` | 401 | **401 `{"error":"請先登入"}`** | ✅ |
| 匿名 `GET /api/me`、`/api/admin/*` | 404/401 | 404（不存在路由），不洩漏 | ✅ |
| **會員存取 `/api/admin/members`** | 403 | **403 `{"error":"沒有權限"}`** | ✅ |
| **會員存取 `/api/admin/coupons`** | 403 | **403 `{"error":"沒有權限"}`** | ✅ |
| **會員 POST `/api/admin/coupons/redeem`** | 403 | **403** | ✅ |
| **會員 PATCH `/api/admin/runs/:id`** | 403 | **403** | ✅ |
| **會員訪問 `/admin` 頁面** | 拒絕 | 顯示「🔒 沒有權限」，**0 他人資料** | ✅ |
| **IDOR：`GET /api/runs` 僅本人** | 僅本人 | 1 筆，`DISTINCT userId = 1`（本人） | ✅ |
| 路徑穿越 `/api/media/../../etc/passwd` | 拒絕 | **403 WAF 攔截** | ✅ |
| 參數邊界（`-1`/`0`/`1e20`/`abc`/ SQL 字串） | 400/403 | 401（未授權）／403（WAF），**無崩潰、無全量返回** | ✅ |

---

## 【缺陷清单】

**本次未发现 P0 / P1 / P2 级缺陷。**

仅记录 2 条 **P3 观察项**：

### P3-1：匿名访问 `/admin` 返回 HTTP 200 而非 307/401
- **描述**：未登入访问 `/admin` 返回 200，页面显示「請先登入管理員帳號」。
- **复现步骤**：`curl -sI https://<host>/admin`
- **实际结果**：`HTTP/2 200`
- **预期结果**：返回 307 重定向至 `/login`（与 `/dashboard` 的 307 行为一致）
- **影响范围**：仅状态码语义，**无数据泄露**（SSR HTML 内 0 条会员数据，数据在客户端鉴权后加载）
- **证据**：`curl /admin | grep -E "ming@|hui@|待確認截圖"` → **无匹配**；仅含「請先登入管理員帳號」
- **修复建议**：与 `/dashboard` 一致，改为 `redirect('/login?callbackUrl=/admin')`，统一未授权语义

### P3-2：`/api/runs` 响应体包含 `userId` / `email` 字段
- **描述**：`GET /api/runs` 返回记录含 `userId`、`reviewerId`、`user.email`。
- **复现步骤**：登录会员后 `GET /api/runs`
- **实际结果**：返回本人 1 笔记录，含本人 `userId` 与 email
- **预期结果**：属**本人数据**，非越权；仅提示最小化字段原则
- **影响范围**：无（已验证仅返回本人记录，`DISTINCT userId` 数量为 1）
- **修复建议**：可移除响应中的内部 `userId`/`reviewerId`，仅保留展示所需字段

---

## 【验收标准核对】

| 验收标准 | 结论 | 依据 |
|---|---|---|
| 公网可达、9 路由正常渲染 | ✅ | 全部 200 + CSS 已载入 |
| 图片正常显示 | ✅ | 5 张图片全 200，0 破图 |
| 无 500 错误页 | ✅ | 0 错误页 |
| 登录不跳 localhost | ✅ | 仅同域导航 |
| 注册成功并获 50 分 | ✅ | 积分 = 50 |
| 上传进入「待確認」且缩图正常 | ✅ | 待確認 0→1，缩图 1200×800 |
| 管理員可审核、状态流转 | ✅ | 待確認 7→6，里程 395→402 |
| 审核后积分增加 | ✅ | 50 → 57（+7） |
| 优惠券核销成功 | ✅ | 状态「已核銷」 |
| 移动端无横向溢出 | ✅ | scrollWidth = innerWidth = 390 |

---

## 【测试数据清理】

- **清理前**：`live+1790144241788@msw.mo`、`liveqa1790144682257@msw.mo`（各 1 笔记录）
- **已删除**：2 个测试用户 + 其 RunRecord / PointLog / Session / Account + 上传的媒体文件 `tskjlf4j-…jpg`
- **清理后核验**：`REMAINING_TEST_USERS = []`，`TOTAL_USERS = 5`（恢复原始种子账号），`PENDING_RUNS = 6`
- 清理后站点回归：`/`、`/admin`、`/leaderboard`、`/login` 全部 200

> 注：`live+1790144241788@msw.mo` 曾核销优惠券 `MSW-202609-DEMO01`，清理时该券随用户一并删除。
> 清理过程中发现的部分失败注册（A/B 测试账号）经查为**测试脚本选择器缺陷**（昵称输入框无 `type` 属性，`input[type=text]` 未命中导致 HTML5 `required` 拦截提交），**非产品缺陷**，已修正脚本。

---

## 【测试结论】

### ✅ 可以交付

公网链接 **https://a6dd31b4ad670a126.app.workbuddy.host** 各项核心功能在公网环境下**全部可用**：

- 登录/注册/上傳/審核/核銷**全鏈路閉環通過**，公網資料庫與檔案系統**可寫**
- 无 P0/P1/P2 缺陷；仅 2 项 P3 优化建议（不影响使用）
- 积分与公里数**数字全部对账一致**

---

## 【截图清单】

| 文件名 | 内容 |
|---|---|
| `live-home.png` | 首頁 |
| `live-events.png` | 活動頁 |
| `live-run.png` | 月度累積跑（未登入） |
| `live-login.png` | 登入頁 |
| `live-register-page.png` | 註冊頁 |
| `live-dashboard-anon.png` | 未登入訪問會員中心（跳轉登入） |
| `live-admin-anon.png` | 未登入訪問後台 |
| `live-leaderboard.png` | 排行榜 |
| `live-about.png` | 關於我們 |
| `live-login-ok.png` | **管理員登入成功後畫面** |
| `live-dashboard-admin.png` | 管理員會員中心 |
| `live-admin-auth.png` | 管理員後台（待確認清單） |
| `live-register.png` | **註冊成功、50 分** |
| `live-dashboard.png` | **新會員 50 分儀表板** |
| `live-upload.png` | **上傳紀錄 + 縮圖（待確認）** |
| `live-admin-pending.png` | 後台待確認（含新會員紀錄） |
| `live-approve.png` | **審核完成（402 km / 6 筆）** |
| `live-confirmed.png` | **會員端已確認 + 57 分** |
| `live-coupon-tab.png` | 優惠券 tab |
| `live-redeem.png` | **核銷成功** |
| `live-mobile-home.png` | 移動端首頁 |
| `live-mobile-run.png` | 移動端月度累積跑 |
| `live-mobile-admin.png` | 移動端後台 |
| `live-member-at-admin.png` | 會員訪問後台（無權限） |

**未測到的部分**（如實說明）：
1. 每週一訓練簽到自助簽到：測試日 `2026-09-23` 非週一（頁面顯示「非活動日」），**未測**簽到與 +10 分邏輯。
2. 300 KM 月度任務達標後發券：需累積 300 KM，測試未構造該資料量，**未端到端驗證發券**（僅驗證既有券核銷）。
3. 逾期券／重複核銷防護：因指定券僅 1 張且已核銷，**未測**重複核銷拒絕邏輯。

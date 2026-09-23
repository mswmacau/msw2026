# MSW 街健館 — Macau Street Workout

## 🌐 線上展示網址

**https://a6dd31b4ad670a126.app.workbuddy.host**

任何人皆可開啟，不需登入即可瀏覽；後台入口在 `/admin`。

| 角色 | 帳號 | 密碼 |
| --- | --- | --- |
| 管理員 | `admin@msw.mo` | `msw2026admin` |
| 會員 | `ming@msw.mo` | `msw2026` |
| 會員 | `kelvin@msw.mo` | `msw2026`（本月已累積 320KM，已達標） |

> 此連結為雲端沙箱部署的展示環境，方便你先點開看、拿去給人看。
> 若要長期營運，請用第七章的任一方案部署到自己的網域（資料才會永久保存）。

---

從需求到上線的完整專案文件。前端 Next.js 14（App Router），後端 WordPress 6.7 作為內容管理系統，
會員 / 積分 / 活動數據存放於資料庫。

**資料庫採雙軌設計**：
- `prisma/schema.prisma` — **SQLite**（預設）：一支 `.db` 檔案即可跑，免外部服務，用於雲端沙箱 / 單機部署
- `prisma/schema.mysql.prisma` — **MySQL**：正式上線用，指令見下方

```bash
# 切換回 MySQL 正式環境
npm run db:mysql                  # push schema
npm run build:mysql               # 以 MySQL schema 產生 client 並建置
# 並把 .env 的 DATABASE_URL 改回 mysql://...
```

---

## 一、需求梳理

### 1.1 原始需求

| 項目 | 需求 |
| --- | --- |
| 定位 | 澳門街頭健身社群官網，名稱「MSW 街健館」（Macau Street Workout） |
| 視覺參考 | 版面結構與節奏對齊 https://www.run2gather.com/ |
| 技術棧 | Next.js（前端）+ WordPress（後端 / CMS） |
| 語言 | 繁體中文 |
| 會員 | 會員登入（Email + Google OAuth） |
| 積分 | 積分累積與回饋 |
| 活動 A | 定期訓練活動：逢星期一 20:00 – 21:00 |
| 活動 B | 月度累積跑：上傳跑步截圖 + 輸入公里數 → 後台人工確認 → 回饋累積里程 → 單月滿 300 KM 完成任務 → 月底後台產出達成名單 → 發放優惠券 |

### 1.2 品牌色票

| 用途 | 顏色名稱 | Hex | 實作位置 |
| --- | --- | --- | --- |
| 主背景／深色 | 近黑 | `#0F0F0F` | `tailwind.config.ts` → `ink` |
| 主要文字 | 純白 | `#FFFFFF` | 預設文字色 |
| 主要藍色 | 鈷藍 | `#0047AB` / `#0057FF` | `cobalt` / `cobaltBright` |
| 強調紅色 | 活力紅 | `#E3001B` / `#FF2D2D` | `energy` / `energyBright` |
| 淺色背景 | 淺灰白 | `#F5F5F7` | `mist`（內容區塊） |

### 1.3 需求拆解為可驗收的功能點

| # | 功能點 | 驗收標準 |
| --- | --- | --- |
| F1 | 會員註冊 / 登入 | Email + 密碼可註冊登入；Google OAuth 設定後自動出現按鈕 |
| F2 | 積分累積 | 註冊送 50 分；跑步確認後 1KM = 1 分；訓練簽到 10 分 |
| F3 | 定期訓練活動頁 | 顯示每週一 20:00–21:00、地點、積分說明 |
| F4 | 月度累積跑上傳 | 上傳截圖 + 輸入公里數，寫入資料庫，狀態為「待確認」 |
| F5 | 後台人工確認 | 管理員逐筆看圖確認 / 駁回（需填原因） |
| F6 | 里程回饋 | 確認後該筆里程計入當月累積，會員可看到進度條 |
| F7 | 300KM 達標判定 | 當月累積 ≥ 300KM 標記完成，額外 +300 分 |
| F8 | 達成名單 + 發券 | 後台按月產出名單，一鍵批次發放優惠券（同月不重複發） |
| F9 | 會員中心 | 積分、月度進度、優惠券、積分明細 |
| F10 | 權限控管 | 一般會員呼叫審核 API 回傳 403 |

---

## 二、系統架構

```
                    ┌──────────────────────────────┐
   瀏覽器 ─────────▶ │  Next.js 14（App Router）     │
                    │  - 頁面 / UI（Tailwind）      │
                    │  - NextAuth 登入              │
                    │  - Prisma ORM                 │
                    └───────┬──────────────┬───────┘
                            │              │
                  REST API   │              │  SQL
                            ▼              ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  WordPress 6.7    │   │  MySQL 8          │
              │  - 活動（CPT）    │   │  ├ wordpress      │
              │  - 文章 / 頁面    │   │  └ msw_app        │
              │  - 媒體庫         │   │    （會員/積分/   │
              │  - 後台管理       │   │     紀錄/優惠券） │
              └──────────────────┘   └──────────────────┘
```

**為什麼這樣切？**
- WordPress 管「內容」：活動文案、圖片、公告 —— 不懂程式的人也能改，改完前台立刻更新。
- Next.js 管「互動與資料」：登入、積分、上傳、審核 —— 這些 WordPress 做起來笨重且慢。
- 共用同一個 MySQL 但分兩個 database：省一台機器，資料邊界清楚，日後要拆也容易。

---

## 三、目錄結構

```
/workspace/msw
├── docker-compose.yml          # WordPress + MySQL + Nginx（開發環境）
├── docker-compose.prod.yml     # 正式環境覆寫設定
├── nginx.conf                  # WordPress 的 Nginx 設定（含 CORS）
├── initdb/01-msw-app.sql       # 自動建立 msw_app database
├── wp-content/mu-plugins/      # WordPress 活動內容模型（msw_event CPT）
├── ACCOUNTS.md                 # 所有帳號密碼
├── README.md                   # 本文件
└── web/                        # Next.js 前端
    ├── Dockerfile
    ├── .env / .env.example
    ├── prisma/
    │   ├── schema.prisma       # 會員 / 積分 / 跑步紀錄 / 優惠券
    │   └── seed.ts             # 種子資料
    └── src/
        ├── app/
        │   ├── page.tsx            # 首頁
        │   ├── events/             # 活動列表 + 內頁
        │   ├── run/                # 月度累積跑（上傳）
        │   ├── dashboard/          # 會員中心
        │   ├── admin/              # 管理後台（審核 + 發券）
        │   ├── leaderboard/        # 排行榜
        │   ├── login/ register/    # 登入註冊
        │   ├── about/ contact/ faq/
        │   └── api/
        │       ├── auth/[...nextauth]/
        │       ├── register/
        │       ├── upload/         # 截圖上傳
        │       ├── runs/           # 上傳 / 查詢紀錄
        │       └── admin/
        │           ├── runs/[id]/  # 確認 / 駁回
        │           └── coupons/    # 達成名單 / 發券
        ├── components/             # Navbar / Footer / Counter / Reveal
        └── lib/
            ├── auth.ts             # NextAuth 設定
            ├── points.ts           # 積分與任務核心邏輯
            ├── wp.ts               # WordPress REST API 客戶端
            ├── events.ts           # 活動資料（WP 優先，內建兜底）
            └── prisma.ts
```

---

## 四、本地啟動

```bash
# 1. 啟動 WordPress + MySQL
cd /workspace/msw
docker compose up -d

# 2. 安裝前端套件
cd web
npm install

# 3. 建立資料表 + 匯入示範資料
npm run db:push
npm run db:seed

# 4. 啟動開發伺服器
npm run dev
```

- 網站：http://localhost:3000
- WordPress 後台：http://localhost:8080/wp-admin
- 管理後台：http://localhost:3000/admin

種子資料已內含 1 位管理員、4 位會員、多筆待審核與已確認的跑步紀錄，
並讓 Kelvin 當月累積 320 KM（已達標），方便直接體驗「達成名單 → 發券」流程。

---

## 五、核心業務邏輯

### 5.1 月度累積跑完整迴路

```
會員上傳截圖 + 公里數
      │
      ▼
RunRecord(status = PENDING)          ← 尚未計入任何累積
      │
      ▼  管理員在 /admin 逐筆看圖
  確認 / 駁回
      │
      ├── 駁回 → status = REJECTED，記錄原因，會員可在 /run 看到
      │
      └── 確認 → status = APPROVED
                  ├─ 里程計入該月累積
                  ├─ 回饋積分 1KM = 1 分
                  └─ 每月累積 ≥ 300KM
                        ├─ 標記完成任務
                        ├─ 額外 +300 分（同一個月只發一次）
                        └─ 月底後台 → 「一鍵發放優惠券」
```

實作位置：`src/lib/points.ts`（`approveRunRecord` / `getMonthlyWinners` / `issueCoupons`）

### 5.2 積分規則

| 項目 | 積分 | 時機 |
| --- | --- | --- |
| 註冊會員 | +50 | 一次性 |
| 跑步里程確認 | 1 分 / KM | 每筆紀錄確認後 |
| 定期訓練出席 | +10 | 每週一現場簽到 |
| 月度 300KM 達標 | +300 + 優惠券 | 每月結算 |

規則集中定義在 `src/lib/points.ts` 的 `RULES`，也可由 `.env` 覆寫公里門檻。

### 5.3 防弊與去重

- 里程**必須經人工確認**才計算，避免假截圖直接灌水。
- 單次上傳上限 200 KM，超過會被拒絕。
- 同一月份達標獎勵只發一次（以 `PointLog.refId = 月份` 去重）。
- 同一會員同月優惠券只發一張（以 `Coupon(userId, periodMonth)` 去重）。
- 審核 API 強制檢查 `role === 'ADMIN'`，否則回傳 403。

---

## 六、測試報告

端到端自動化驗證（`node scripts/e2e-test.mjs`）結果：**12 項全數通過**

```
✅ 會員登入 (ming@msw.mo)
✅ 上傳跑步紀錄 10KM
✅ 紀錄狀態為待確認
✅ 管理員登入
✅ 後台取得待審核清單（7 筆）
✅ 管理員確認紀錄 → 已確認 10 km，該月累積 63.4 km
✅ 會員積分已回饋 (+10) → 77 → 87
✅ 一般會員無法審核（HTTP 403）
✅ 取得當月達成名單（1 人達標）
✅ 對達標會員發放優惠券 → issued=1
✅ 會員中心顯示優惠券
✅ 重複發券被擋下（同月不重複）→ issued=0
```

路由冒煙測試：13 個頁面全部回應 200（`/dashboard` 未登入時回 307 重導至登入頁，符合預期）。

正式環境建置：`npm run build` 通過，18 個路由，首屏 JS 約 87 KB。

---

## 七、上線部署

### 方案 A：Vercel + 雲端資料庫（推薦，最快）

1. 程式碼推到 GitHub
2. 到 https://vercel.com/new 匯入 repository，**Root Directory 選 `web`**
3. Environment Variables 填入：
   - `DATABASE_URL`（建議用 [PlanetScale](https://planetscale.com) 免費方案或 Supabase）
   - `NEXTAUTH_URL` = `https://你的網域`
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32` 產生
   - `NEXT_PUBLIC_WP_URL` / `WP_URL` = 你的 WordPress 網址
4. Deploy。之後每次 push 到 main 自動部署。
5. 在 Vercel 專案設定 → Deployment Protection 記得關閉，或以自訂網域上線。

> Vercel 的檔案系統是唯讀的，跑步截圖上傳需改成雲端儲存（Cloudinary / S3 / Vercel Blob）。
> `src/app/api/upload/route.ts` 已把路徑集中在一處，替換時只需改這支檔案。

### 方案 B：自有主機 / VPS（Docker，功能最完整）

```bash
# 主機需先安裝 Docker + Docker Compose
git clone <你的 repo> msw && cd msw

cp web/.env.example web/.env
# 編輯 web/.env：填入網域、NEXTAUTH_SECRET

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec wpcli wp core install ...   # 若為全新主機

# 建立資料表
docker compose exec web npx prisma db push
```

再用 Nginx 或 Caddy 反向代理 `3000`（網站）與 `8080`（WordPress），
並用 Let's Encrypt 申請 SSL。

### 方案 C：WordPress 放既有主機，Next.js 放 Vercel

只需把 `NEXT_PUBLIC_WP_URL` 指向你現有的 WordPress 網址即可，
前端程式碼完全不用改。

### 7.1 上線檢查清單

- [ ] `.env` 中的 `NEXTAUTH_SECRET` 已換成隨機長字串
- [ ] `NEXTAUTH_URL` 改為正式網址（含 https）
- [ ] 所有預設帳號密碼已更換（見 `ACCOUNTS.md`）
- [ ] 刪除或移動 `ACCOUNTS.md` 至非公開位置
- [ ] MySQL 對外不開 3306，僅允許本機 / 內網連線
- [ ] WordPress 後台啟用兩步驟驗證、限制登入嘗試次數
- [ ] 上傳目錄 `web/public/uploads` 設定定期備份
- [ ] 資料庫每日自動備份（`mysqldump` + cron）
- [ ] Google OAuth 的重新導向 URI 已加入正式網址
- [ ] 實際用手機上傳一次截圖，確認顯示與審核正常

---

## 八、後續可做

| 優先度 | 項目 | 說明 |
| --- | --- | --- |
| 高 | 訓練簽到 API | 目前 `/dashboard` 只顯示出席紀錄，尚未實作現場 QR Code 簽到 |
| 高 | 雲端圖片儲存 | 部署到 Vercel 前必須處理 |
| 中 | Email 通知 | 確認 / 駁回 / 發券時寄信通知會員 |
| 中 | 積分兌換商城 | 目前積分只累積未開放兌換 |
| 中 | 反作弊 | 截圖 EXIF 比對、同圖重複上傳偵測 |
| 低 | 多語系 | 繁中 / 英 / 葡（澳門官方語言） |
| 低 | APP | 後續可用 React Native 複用同一套 API |

---

## 九、常見維運指令

```bash
# 查看服務狀態
docker compose ps

# 查看前端 log
docker compose logs -f web

# 重新匯入資料表（會清空資料）
cd web && npx prisma db push --force-reset && npm run db:seed

# 用 GUI 查看 / 編輯資料
cd web && npx prisma studio

# 備份資料庫
docker exec msw-db mysqldump -uroot -pmsw_root_2026 --databases wordpress msw_app > backup.sql

# 停止 / 啟動
docker compose stop
docker compose start
```

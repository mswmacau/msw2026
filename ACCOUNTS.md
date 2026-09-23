# MSW 街健館 — 帳號總表

## 🌐 線上網站（任何人可開）

**https://a6dd31b4ad670a126.app.workbuddy.host**

後台：https://a6dd31b4ad670a126.app.workbuddy.host/admin

> ⚠️ 上線前請務必全部更換密碼，並刪除本檔案或移出公開目錄。

## 一、WordPress 後台（內容管理：活動、文章、頁面）

| 項目 | 內容 |
| --- | --- |
| 後台網址 | http://localhost:8080/wp-admin |
| 管理者帳號 | `msw_admin` |
| 管理者密碼 | `Msw@Admin#2026` |
| 管理者 Email | admin@msw-streetworkout.com |
| 站台名稱 | MSW 街健館 |

WordPress 負責：活動（msw_event 文章類型）、最新消息、頁面文案、媒體庫圖片。
Next.js 透過 REST API（`wp-json/wp/v2/msw_event`）讀取，後台改內容前台就會更新。

### MySQL 資料庫（WordPress + 應用共用同一個實例）

| 項目 | 內容 |
| --- | --- |
| Host / Port | `127.0.0.1:3306`（容器之間用 `db:3306`） |
| WordPress DB | `wordpress` / 使用者 `wordpress` / 密碼 `wordpress_pw_2026` |
| 應用 DB | `msw_app` / 使用者 `msw` / 密碼 `msw_app_pw_2026` |
| root 密碼 | `msw_root_2026` |

---

## 二、Next.js 網站（會員系統）

| 角色 | 帳號 | 密碼 | 說明 |
| --- | --- | --- | --- |
| 管理員 | `admin@msw.mo` | `msw2026admin` | 可進入 `/admin` 審核截圖、發放優惠券 |
| 會員 | `ming@msw.mo` | `msw2026` | 阿明，示範會員 |
| 會員 | `hui@msw.mo` | `msw2026` | 小慧 |
| 會員 | `kelvin@msw.mo` | `msw2026` | Kelvin，本月已累積 320 KM（已達標） |
| 會員 | `joe@msw.mo` | `msw2026` | 阿祖 |

網站網址（本地）：http://localhost:3000
網站網址（公網）：https://a6dd31b4ad670a126.app.workbuddy.host
後台入口：網址後面加 `/admin`

---

## 三、如何新增管理員

```bash
cd /workspace/msw/web
npx prisma studio          # 開瀏覽器直接把某位會員的 role 改成 ADMIN
```
或直接用 SQL：
```sql
UPDATE User SET role = 'ADMIN' WHERE email = 'someone@example.com';
```

---

## 四、啟用 Google 登入

1. 前往 https://console.cloud.google.com/apis/credentials
2. 建立 OAuth 用戶端 ID → 類型「網頁應用程式」
3. 已授權的重新導向 URI 填入 `http://localhost:3000/api/auth/callback/google`
   （上線後改成 `https://你的網域/api/auth/callback/google`）
4. 把取得的值填入 `web/.env`：
   ```
   GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="xxxx"
   NEXT_PUBLIC_GOOGLE_ENABLED="true"
   ```
5. 重新啟動：`npm run dev`

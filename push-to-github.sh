#!/usr/bin/env bash
# ---------------------------------------------------------------
# 把 MSW 街健館整個專案推上 GitHub
#
# 用法（在 /workspace/msw 目錄下執行）：
#   bash push-to-github.sh https://github.com/<你的帳號>/<repo名稱>.git
#
# 前置：先在 https://github.com/new 建立一個 **空白** repo（不要勾 README / .gitignore）
# ---------------------------------------------------------------
set -e

REMOTE_URL="$1"

if [ -z "$REMOTE_URL" ]; then
  echo "❌ 請提供 GitHub repo 網址"
  echo "   例如：bash push-to-github.sh https://github.com/macau-jim/msw-streetworkout.git"
  exit 1
fi

cd "$(dirname "$0")"

echo "▶ 檢查 git 狀態…"
if [ ! -d .git ]; then
  git init
fi

# 確保機密檔不會被推上去
if ! grep -q "^.env$" .gitignore 2>/dev/null; then
  echo "⚠️  .gitignore 未排除 .env，請先確認"
  exit 1
fi

git add -A
git -c user.name="MSW Admin" -c user.email="admin@msw.mo" \
  commit -m "更新：後台內容管理（網站設定 / 活動管理）" || echo "（沒有新的變更，略過 commit）"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo master)"
if [ "$BRANCH" = "HEAD" ]; then BRANCH="main"; fi
git branch -M "$BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "▶ 推送到 $REMOTE_URL （分支：$BRANCH）"
git push -u origin "$BRANCH"

echo ""
echo "✅ 完成！到 $REMOTE_URL 就能看到完整程式碼。"
echo "   提醒：.env、資料庫檔案、上傳圖片都不會被上傳（已寫入 .gitignore）。"

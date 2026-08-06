# 部署指南（Vercel + Supabase Cloud）

本專案由兩塊組成，需分別部署：

- **Supabase Cloud** — 資料庫、Google 登入、圖片儲存
- **Vercel** — Next.js 網站前端

以下步驟依序執行。標示 🧑 的步驟需要你本人操作（帳號／密碼／授權），標示 🤖 的由 Claude 代為執行。

---

## 1. 推上 GitHub 🧑 + 🤖

1. 🧑 到 <https://github.com/new> 建立一個**空的** repo（不要勾 README / .gitignore），例如 `local-events`。
2. 🤖 Claude 幫你設定 remote 並推送：
   ```bash
   git remote add origin https://github.com/<你的帳號>/<repo>.git
   git push -u origin main
   ```

> 機密安全：`.env`、`.env.local` 已在 `.gitignore`，不會被推上 GitHub。

---

## 2. 建立 Supabase Cloud 專案 🧑

1. 到 <https://supabase.com/dashboard> 註冊／登入，**New project**。
2. 記下：**Project Ref**（網址中的一串代號）、**Database password**（自己設定，請保存）。
3. 專案建立後，到 **Project Settings → API** 取得：
   - `Project URL`（`https://<ref>.supabase.co`）
   - `anon public` key

---

## 3. 推送資料庫 schema 與種子資料 🤖

在專案目錄執行（Claude 代跑，需要你先登入 CLI）：

```bash
npx supabase login            # 🧑 會開瀏覽器授權，取得 access token
npx supabase link --project-ref <你的 Project Ref>   # 🧑 輸入資料庫密碼
npx supabase db push          # 🤖 套用 migrations 0001–0015（含 storage bucket、pg_cron）
```

種子分類資料：

```bash
# 用連線字串把 seed.sql 灌進雲端 DB（分類：音樂/親子/手作/體育/飲食/廟會）
psql "postgresql://postgres:<密碼>@db.<ref>.supabase.co:5432/postgres" -f supabase/seed.sql
```

> pg_cron 排程（過期活動、開始前通知）會自動建立；若 dashboard 顯示未啟用，到
> **Database → Extensions** 開啟 `pg_cron` 後重跑 `db push`。

---

## 4. 設定 Google 登入 🧑

1. **Google Cloud Console** → APIs & Services → Credentials → 你的 OAuth client：
   - **Authorized redirect URI** 新增：`https://<ref>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** → Authentication → Providers → **Google**：
   - 填入 `Client ID` 與 `Client Secret`（就是本機 `.env` 那組），啟用。
3. **Supabase Dashboard** → Authentication → URL Configuration：
   - **Site URL** = 你的 Vercel 網址（見第 5 步，例：`https://local-events.vercel.app`）
   - **Redirect URLs** 加入：`https://local-events.vercel.app/**`

---

## 5. 部署到 Vercel 🧑

1. 到 <https://vercel.com/new> 用 GitHub 登入，Import 剛才的 repo。
2. **Environment Variables** 填入（第 2 步取得的值）：
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`（anon public key）|
3. **Deploy**。完成後會得到 `https://<專案>.vercel.app`。
4. 把這個網址回填到第 4 步的 Site URL / Redirect URLs。

---

## 6. 建立管理員帳號 🧑 + 🤖

1. 🧑 用 Google 登入一次線上網站（會自動建立 profile）。
2. 🤖 把你的帳號設為 admin（Claude 用雲端連線字串執行）：
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '<你的 email>');
   ```

---

## 7. 活動資料 🤖（選用）

本機已建立的活動與封面圖存在本機 Supabase。上線後可以：

- **重新建立**：直接用線上網站的「發布活動」與後台上傳（最單純），或
- **搬移**：Claude 匯出本機 `events` / `event_categories` 與 storage 圖片，灌進雲端。

> 圖片：本機 `event-covers` bucket 的檔案需一併上傳到雲端同名 bucket，
> 封面網址才不會失效。

---

## 常見問題

- **登入後回到首頁但沒登入成功** → 多半是第 4 步 redirect URI / Site URL 沒設對。
- **圖片顯示不出來** → 雲端 storage bucket 未建立或圖片未搬移（見第 7 步）。
- **時間顯示怪怪的** → 全站已固定用 Asia/Taipei，Vercel（UTC 主機）不受影響。

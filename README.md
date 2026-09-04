# hui-booking

展牆位置預訂系統，供學生填寫志願序，依提交時間與志願序自動分配展牆。

built on Cloudflare Pages + Workers Functions + D1 (SQLite)

---

## 頁面

| 路徑 | 說明 |
|------|------|
| `/` | 學生登入 / 註冊 |
| `/book.html` | 填寫志願序（登入後） |
| `/result.html` | 即時排位結果 |
| `/admin.html` | 管理員 / 超級管理員面板 |

---

## 角色說明

| 角色 | 登入方式 | 權限 |
|------|----------|------|
| 學生 | 自行註冊，密碼自訂 | 填寫志願、查看結果、撤回志願 |
| 一般管理員 | 帳號由超級管理員建立 | 管理學生、專案、複製專案、查看排位 |
| 超級管理員 | 同上，或 `SUPER_PASSWORD` 環境變數登入 | 含以上所有權限 + 一鍵重置學生、設定人數上限 |

### 超級管理員緊急登入（忘記密碼）

若超級管理員帳號密碼遺失，可在 Cloudflare Dashboard 設定環境變數 `SUPER_PASSWORD`，以任意帳號名稱搭配此密碼從 `/admin.html` 登入，取得超級管理員權限。

---

## 分配規則（志願序輪替制）

1. 先比對所有人的**第 1 志願**，若該位置只有一人填寫，直接取得；多人填同一位置，由**提交時間較早者**優先取得。
2. 取得第 1 志願者不再參與後續競爭；剩餘的人進入**第 2 志願**的競爭，規則相同。
3. 以此類推，直到所有人都分配到位置，或所有志願序用盡為止。

---

## 管理員功能

### 專案管理
- 新增 / 編輯展覽專案
- 上傳平面圖，點擊標記展牆座標
- 設定開放時間（`open_at`）與截止時間（`close_at`）
- 勾選「開放」控制學生是否能看到專案
- 複製專案（保留平面圖與設定，重置時間與開放狀態）
- 附加 Google Drive 資料夾連結（供學生上傳宣傳資料）

### 開放條件邏輯

| `is_open` | 時間狀態 | 學生可查看 | 學生可送出志願 |
|-----------|----------|-----------|--------------|
| ✅ 開放 | 未到開放時間 | ✅ | ❌ |
| ✅ 開放 | 在時間窗內 | ✅ | ✅ |
| ✅ 開放 | 超過截止時間 | ✅ | ❌ |
| ❌ 未開放 | 任何時間 | ❌ | ❌ |

### 學生管理
- 查看所有學生志願與分配結果（依專案篩選）
- 搜尋學生姓名
- 重置個別學生志願或密碼
- 匯出 CSV（含備註欄位）

### 超級管理員專屬
- 設定全系統學生人數上限
- 一鍵重置所有學生（清除所有志願、帳號、Session）

---

## 部署

### 前置

```bash
npm install -g wrangler
wrangler login
```

### 建立 D1 資料庫

```bash
wrangler d1 create hui-booking-db
```

將輸出的 `database_id` 填入 `wrangler.toml`。

### 初始化資料表

```bash
wrangler d1 execute hui-booking-db --remote --file=./schema.sql
wrangler d1 execute hui-booking-db --remote --file=./migrations/003_note.sql
wrangler d1 execute hui-booking-db --remote --file=./migrations/004_drive_url.sql
```

### 設定環境變數

```bash
wrangler pages secret put ADMIN_PASSWORD    # 管理員登入密碼
wrangler pages secret put SUPER_PASSWORD    # 超級管理員緊急密碼（選填）
```

### 部署

Push 到 GitHub 後，在 Cloudflare Dashboard 建立 Pages 專案：

- Framework preset：None
- Build command：（留空）
- Build output directory：`public`

建立後至 **Settings → Bindings** 新增 D1 binding，variable name 設為 `DB`，選擇 `hui-booking-db`，再觸發一次重新部署。

也可直接用 CLI 部署：

```bash
npx wrangler pages deploy public --project-name hui-booking
```

### 定期清理過期 Session（選用）

```sql
DELETE FROM sessions WHERE created_at < unixepoch() - 7200;
```

在 Cloudflare D1 console 或 `wrangler d1 execute` 執行。

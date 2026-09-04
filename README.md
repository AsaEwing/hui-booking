# hui-booking

展牆位置預訂系統，供學生填寫志願序，依提交時間與志願序自動分配展牆。

built on Cloudflare Pages + Workers Functions + D1 (SQLite)

---

## 頁面

| 路徑 | 說明 |
|------|------|
| `/` | 學生登入 / 註冊 |
| `/book.html` | 填寫 5 個志願（登入後） |
| `/result.html` | 即時排位結果（公開） |
| `/admin.html` | 管理員面板 |

## 分配規則

依**提交時間**排序，每人依志願順序取第一個尚未被佔用的位置。

## 管理員功能

- 查看所有學生志願與分配結果
- 重置個別學生志願
- 匯出 CSV
- **專案管理**：新增展覽專案、上傳平面圖、點擊標記展牆座標、切換使用中專案（供下一屆重複使用）

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
```

### 設定管理員密碼

```bash
wrangler pages secret put ADMIN_PASSWORD
```

### 部署

Push 到 GitHub 後，在 Cloudflare Dashboard 建立 Pages 專案：

- Framework preset：None
- Build command：（留空）
- Build output directory：`public`

建立後至 **Settings → Bindings** 新增 D1 binding，variable name 設為 `DB`，選擇 `hui-booking-db`，再觸發一次重新部署。

### 平面圖

將展館平面圖放置於 `public/floorplan.jpg`，或在管理員「專案管理」中指定其他網址。

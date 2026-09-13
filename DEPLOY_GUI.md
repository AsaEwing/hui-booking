# 部署教學（免安裝任何軟體）

這份教學給**完全不需要寫過程式**的人看：全程只需要滑鼠點擊 Cloudflare 跟 GitHub 的網頁介面，不用安裝 Node.js、不用打開終端機、不用背任何指令。如果你習慣用指令列，可以改看 [README.md](README.md) 的「部署」章節。

> Cloudflare 跟 GitHub 的畫面偶爾會調整版面或按鈕文字，如果跟這份教學寫的不完全一樣，找畫面上意思最接近的選項就好，不用照著一字不差找。

## 開始之前，你需要準備

- 一個 **Cloudflare** 帳號（沒有的話到 [cloudflare.com](https://dash.cloudflare.com/sign-up) 免費註冊，信用卡不是必填）
- 一個 **GitHub** 帳號（沒有的話到 [github.com](https://github.com/signup) 免費註冊）

整個流程大約 12 個步驟，抓半小時到一小時都算正常，不用急。

---

## 步驟一：把這個專案複製到你自己的 GitHub

1. 打開這個 repo 的頁面，點右上角的 **Fork** 按鈕。
2. GitHub 會問你要建立在哪個帳號底下，選你自己的帳號，名稱可以直接用預設的，也可以改成你喜歡的名字。
3. 點 **Create fork**。完成後，你會有一份完全屬於你自己的複本，之後所有修改都在這份複本上進行，不會影響原本的專案。

---

## 步驟二：建立 Cloudflare Pages 專案，連接你的 GitHub

1. 登入 Cloudflare Dashboard。
2. 左側選單找**運算（Workers & Pages / Compute）**相關的區塊，點選建立新專案的地方（通常是「建立」或「Create」按鈕）。
3. 選擇「連接到 Git（Connect to Git）」，授權 Cloudflare 存取你的 GitHub，選擇你剛剛 Fork 的 repo。
4. 進到建置設定畫面時，填入：
   - **Framework preset（框架預設）**：選 `None`
   - **Build command（建置指令）**：留空
   - **Build output directory（建置輸出目錄）**：填 `public`
5. 點部署（Deploy）。第一次部署因為還沒有資料庫，網站打開會看到錯誤畫面，這是正常的，繼續往下做就會修好。

部署完成後，Cloudflare 會給你一個 `xxx.pages.dev` 的網址，之後每次你在 GitHub 上修改檔案（例如步驟七要改的 `site-config.js`），這個網站都會自動重新部署，不需要手動操作。

---

## 步驟三：建立 D1 資料庫

1. Cloudflare Dashboard 左側選單找**儲存空間和資料庫 → D1 SQLite 資料庫**。
2. 點**建立資料庫**。
3. 資料庫名稱可以自訂（例如 `hui-booking-db`），建立。
4. 建立後，點進這個資料庫，找一下網址列或頁面上顯示的 **database_id**（一長串英數字），先複製起來備用，等一下步驟五會用到。

---

## 步驟四：把資料庫結構匯入

D1 資料庫的頁面上應該會有一個**查詢（Console / Query）**功能，可以直接貼 SQL 進去執行。依照下面順序，把每個檔案的完整內容複製、貼上、執行，一定要照順序，一個一個來：

1. `schema.sql`
2. `migrations/002_admin_roles.sql`
3. `migrations/003_note.sql`
4. `migrations/004_drive_url.sql`
5. `migrations/005_no_password.sql`
6. `migrations/006_backfill_missing_columns.sql`
7. `migrations/007_max_combo_size.sql`
8. `migrations/008_active_until.sql`
9. `migrations/009_lottery.sql`
10. `migrations/010_lottery_signature.sql`
11. `migrations/011_manual_assignments.sql`
12. `migrations/012_display_name.sql`

這些檔案都在你 Fork 的 GitHub repo 裡，點進去、點「Raw」或直接看檔案內容，全選複製即可。**因為是全新的資料庫，全部都要執行，不要跳過任何一個。**（這點跟已經在營運中的正式站不一樣，正式站的注意事項寫在 README 裡，你現在是全新安裝，不受那個限制。）

每個檔案貼上執行後，畫面通常會顯示成功訊息或影響的資料列數，看到沒有紅字錯誤訊息就代表成功，可以接著貼下一個。

---

## 步驟五：把資料庫綁定到 Pages 專案

1. 回到你的 Pages 專案，找 **Settings（設定）→ Bindings（綁定）** 或類似名稱的分頁。
2. 新增一個 D1 資料庫綁定：
   - **Variable name（變數名稱）**：一定要填 `DB`（大寫，這是程式碼裡固定寫死要找的名字）
   - 選擇你步驟三建立的資料庫
3. 儲存後，觸發一次重新部署（通常存檔後會自動觸發，如果沒有，手動點一次「Retry deployment」之類的按鈕）。

---

## 步驟六：設定密碼

1. Pages 專案的 **Settings → Environment variables（環境變數）**，新增以下幾個 **Secret**（不是一般變數，要選加密的 Secret 類型）：

   | 名稱 | 說明 | 是否必填 |
   |------|------|---------|
   | `ADMIN_PASSWORD` | 管理員登入密碼，自己設一個 | 必填 |
   | `SUPER_PASSWORD` | 超級管理員緊急登入密碼（忘記密碼時的備用方式） | 選填，建議設 |
   | `LOTTERY_SIGNING_KEY` | 抽籤結果數位簽章私鑰 | 選填，見步驟八 |

2. 設定完存檔，一樣讓它重新部署一次。

---

## 步驟七：改成你自己的單位資訊

1. 回到 GitHub，打開你 Fork 的 repo，找到 `public/site-config.js`，點右上角的鉛筆圖示（Edit this file）。
2. 把裡面幾個值改成你自己的：

```js
const SITE_CONFIG = {
    siteName: '展覽位置預定系統',      // 你想要的系統名稱
    orgName: '你的單位名稱',           // 頁尾版權會顯示這個
    contactEmail: 'your@email.com',   // 你的聯絡信箱
    domain: 'your-site.pages.dev',    // 你的網站網址（先用步驟二拿到的 xxx.pages.dev，之後有自訂網域再回來改）
};
```

3. 改完，捲到頁面最下面，點 **Commit changes（提交變更）** 存檔。Cloudflare 會自動重新部署，等個一兩分鐘就會生效。

> `public/verify-lottery.html` 這個頁面比較特別，裡面也寫了一份一樣的名稱/信箱，但因為這頁刻意設計成完全獨立、不依賴任何其他檔案（確保離線也能用），所以**不會**自動跟著 `site-config.js` 改變，如果想讓這頁也顯示你自己的資訊，需要另外手動編輯這個檔案裡對應的部分（在檔案裡搜尋 `SITE_CONFIG` 就能找到）。

---

## 步驟八（選用、進階）：抽籤結果數位簽章金鑰

這個功能是加分項，用來讓抽籤結果多一層「無法偽造」的技術保證，**不設定完全不影響系統正常運作**，只是抽籤紀錄不會有簽章可供驗證。如果你還不確定要不要用，可以先跳過，之後隨時可以回來做。

1. 打開你自己網站的 `/generate-signing-key.html`（例如 `https://你的網站/generate-signing-key.html`）。
2. 點「產生一組新金鑰」。
3. 畫面會分別顯示**私鑰**（貼到步驟六的 `LOTTERY_SIGNING_KEY`）跟**公鑰**（要貼到 `public/verify-lottery.html` 裡，頁面上有寫清楚怎麼改）。
4. 兩邊都貼好、確認網站重新部署完成後，才可以離開那個頁面——金鑰只會顯示這一次，離開就拿不回來了（大不了重新產生一組新的，不影響其他功能）。

---

## 步驟九（建議）：Rate Limiting 規則與用量預算警示

這兩項可以防止異常流量把你的 Cloudflare 帳單意外撐高，強烈建議設定：

1. **Rate Limiting**：到你網站所屬的網域（不是 Pages 專案，是網域本身）→ 安全性規則 → 新增限速規則，設定「符合 `/api/` 開頭的路徑」「同一 IP 每 10 秒最多 10 次請求，超過就封鎖」。Free 方案通常只能設 1 條規則、動作只能選「封鎖」，這樣就夠用了。
2. **D1 用量預算警示**：D1 資料庫頁面的「用量」區塊，找「計費儀表板」→「新增預算警示」，設一個你可以接受的金額，超過會收到通知。

（這兩項都只能在 Cloudflare Dashboard 手動設定，不會隨程式碼自動套用，記得設定。）

---

## 步驟十：第一次登入、建立第一個展覽專案

1. 打開你的網站，網址加上 `/admin.html`（例如 `https://你的網站/admin.html`）。
2. 登入身份選「超級管理員」，密碼用步驟六設定的 `SUPER_PASSWORD`（如果沒設，改用「一般管理員」+ `ADMIN_PASSWORD`）。
3. 進到「專案管理」分頁，新增一個展覽專案：填名稱、上傳平面圖圖片、在圖片上點擊標記每個展牆的位置。
4. 設定開放時間、選擇分配方式（時間排序制或抽籤制），儲存後勾選「開放」，讓學生看得到。
5. 回到首頁，用一個測試帳號註冊、填一次志願，確認整個流程跑得通。

---

## 完成後檢查清單

- [ ] 網站首頁打得開，不是錯誤畫面
- [ ] `/admin.html` 能用超級管理員密碼登入
- [ ] 新增的展覽專案在首頁看得到、能填志願
- [ ] `public/site-config.js` 已經改成自己的單位資訊
- [ ] 已設定 Rate Limiting 規則
- [ ] 已設定 D1 用量預算警示
- [ ] （如果有做步驟八）`verify-lottery.html` 打開時公鑰顯示的是你自己產生的那組，不是預設值

全部打勾，代表你的展覽位置預定系統已經可以正式使用了。

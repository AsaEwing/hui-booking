-- 抽籤結果數位簽章：ECDSA P-256，私鑰只存在 Cloudflare 環境變數 LOTTERY_SIGNING_KEY，
-- 公鑰以明碼寫死在 public/verify-lottery.html。任何人都能離線驗證這份資料是否真的由本系統
-- 私鑰簽署，而不只是「重算結果自洽」而已（單純重算自洽的假資料，只要重算邏輯跟宣稱結果一致
-- 就會通過檢查，無法證明資料本身沒被整組換掉；簽章才能真正防止這種情況）。
-- 此功能上線前執行過的抽籤紀錄不會有簽章，signature 允許為 NULL。
ALTER TABLE lottery_draws ADD COLUMN signature TEXT;

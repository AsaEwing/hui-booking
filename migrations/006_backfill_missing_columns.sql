-- 回溯記錄：這些欄位程式碼已在使用，但正式資料庫是先前直接透過
-- Cloudflare D1 Console 手動加上的，schema.sql／migrations 一直沒有同步記錄。
-- 此檔案只給「全新建立資料庫」時使用，正式站資料庫已有這些欄位，請勿在正式站執行，
-- 否則會因欄位已存在而報錯。詳見 README「初始化資料表」一節。

ALTER TABLE projects ADD COLUMN pref_count INTEGER NOT NULL DEFAULT 5;
ALTER TABLE projects ADD COLUMN is_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN open_at INTEGER;
ALTER TABLE projects ADD COLUMN close_at INTEGER;
ALTER TABLE projects ADD COLUMN floorplan_data TEXT;
ALTER TABLE projects ADD COLUMN floorplan_mime TEXT;

ALTER TABLE submissions ADD COLUMN prefs_json TEXT;

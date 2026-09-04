-- 每個專案可設定「志願序最多可組合幾個位置」，預設 1（維持現行單選行為）
ALTER TABLE projects ADD COLUMN max_combo_size INTEGER NOT NULL DEFAULT 1;

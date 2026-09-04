-- 結果顯示可設定自動關閉時間（留空則維持手動開關，不受影響）
ALTER TABLE projects ADD COLUMN active_until INTEGER;

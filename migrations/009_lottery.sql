-- 抽籤制：專案分配方式（時間排序 / 抽籤）與抽籤規則說明
ALTER TABLE projects ADD COLUMN allocation_mode TEXT NOT NULL DEFAULT 'time';
ALTER TABLE projects ADD COLUMN lottery_rules_text TEXT;

-- 抽籤紀錄：只能新增、不可從介面刪改，作為公正性稽核紀錄
CREATE TABLE IF NOT EXISTS lottery_draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    seed TEXT NOT NULL,
    drawn_at INTEGER NOT NULL,
    drawn_by_role TEXT NOT NULL,
    submissions_snapshot TEXT NOT NULL,
    results_snapshot TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

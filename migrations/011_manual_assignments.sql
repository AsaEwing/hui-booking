-- 手動調整紀錄：管理員在正式分配結果（抽籤或時間排序制）之外，額外補位或交換位置時使用。
-- 只能新增、不可從介面修改或刪除既有紀錄，維持可稽核性；顯示「某人目前位置」一律採用
-- 該學生最新一筆紀錄（assigned_at 相同時以 id 較大者為準），沒有紀錄才用原始分配結果。
-- 完全不影響 lottery_draws 的稽核快照與數位簽章，正式抽籤紀錄與驗證頁面看到的永遠是
-- 當初真正抽籤抽到的結果。
CREATE TABLE IF NOT EXISTS manual_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    walls_json TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at INTEGER NOT NULL,
    reason TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_manual_assignments_project ON manual_assignments(project_id);

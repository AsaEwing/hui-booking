-- 管理員設定表（key-value：密碼雜湊、聯絡信箱）
CREATE TABLE IF NOT EXISTS admin_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- sessions 加 role 欄位
ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

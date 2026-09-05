CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    no_password INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- user_id = 0 為管理員 session
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    floorplan_url TEXT NOT NULL DEFAULT '/floorplan.jpg',
    walls_json TEXT NOT NULL DEFAULT '{}',
    wall_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 0,
    active_until INTEGER,
    max_combo_size INTEGER NOT NULL DEFAULT 1,
    allocation_mode TEXT NOT NULL DEFAULT 'time',
    lottery_rules_text TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    pref1 INTEGER NOT NULL,
    pref2 INTEGER NOT NULL,
    pref3 INTEGER NOT NULL,
    pref4 INTEGER NOT NULL,
    pref5 INTEGER NOT NULL,
    submitted_at INTEGER NOT NULL,
    UNIQUE(project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 抽籤紀錄：只能新增、不可從介面刪改，作為公正性稽核紀錄
CREATE TABLE IF NOT EXISTS lottery_draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    seed TEXT NOT NULL,
    drawn_at INTEGER NOT NULL,
    drawn_by_role TEXT NOT NULL,
    submissions_snapshot TEXT NOT NULL,
    results_snapshot TEXT NOT NULL,
    signature TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 預設專案（含本次展覽的 23 個座標）
INSERT OR IGNORE INTO projects (id, name, floorplan_url, walls_json, wall_count, is_active, created_at)
VALUES (1, '地美展 2025', '/floorplan.jpg',
'{"1":{"x":63.49,"y":53.26},"2":{"x":63.65,"y":70.24},"3":{"x":57.97,"y":52.56},"4":{"x":54.58,"y":52.56},"5":{"x":48.40,"y":67.04},"6":{"x":42.55,"y":56.04},"7":{"x":38.92,"y":56.18},"8":{"x":24.49,"y":75.81},"9":{"x":24.65,"y":52.00},"10":{"x":48.73,"y":39.20},"11":{"x":7.42,"y":36.97},"12":{"x":13.44,"y":36.97},"13":{"x":19.21,"y":36.83},"14":{"x":76.85,"y":36.55},"15":{"x":83.11,"y":36.83},"16":{"x":88.97,"y":36.69},"17":{"x":32.07,"y":21.66},"18":{"x":33.06,"y":7.60},"19":{"x":42.38,"y":16.51},"20":{"x":54.09,"y":16.51},"21":{"x":62.66,"y":7.74},"22":{"x":64.89,"y":22.22},"23":{"x":48.48,"y":23.75}}',
23, 1, unixepoch());

-- 允許學生選擇不設密碼的帳號（自行承擔帳號可被他人冒用的風險）
ALTER TABLE users ADD COLUMN no_password INTEGER NOT NULL DEFAULT 0;

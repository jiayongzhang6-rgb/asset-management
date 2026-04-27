-- 添加 password 列到 users 表
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

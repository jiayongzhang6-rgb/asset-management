-- 修复 operation_history 表结构
-- 警告：此脚本会删除 operation_history 表及其所有数据！
-- 如果有重要数据，请先备份

-- 1. 删除旧的 operation_history 表
DROP TABLE IF EXISTS operation_history;

-- 2. 重新创建 operation_history 表，使用 asset_code 字段
CREATE TABLE operation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_code VARCHAR(50) NOT NULL,
    operation_type VARCHAR(20) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 启用行级安全
ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;

-- 4. 创建策略（允许所有人读写）
CREATE POLICY "Allow public read access" ON operation_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON operation_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON operation_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON operation_history FOR DELETE USING (true);

-- 5. 验证表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'operation_history';

-- 6. 同时检查 assets 表的 ID 类型
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'assets' AND column_name IN ('id', 'asset_code');

-- 修复 operation_history 表结构
-- 运行此脚本将 asset_id 字段替换为 asset_code

-- 1. 删除旧的 operation_history 表（如果存在数据请先备份）
DROP TABLE IF EXISTS operation_history;

-- 2. 重新创建 operation_history 表，使用 asset_code
CREATE TABLE operation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_code VARCHAR(50) NOT NULL,
    operation_type VARCHAR(20) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 启用行级安全
ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;

-- 4. 创建策略
CREATE POLICY "Allow public read access" ON operation_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON operation_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON operation_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON operation_history FOR DELETE USING (true);

-- 5. 验证表结构
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operation_history';

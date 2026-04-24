-- 更新 operation_history 表，添加 changes 字段
ALTER TABLE operation_history ADD COLUMN changes TEXT;

-- 验证表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'operation_history';

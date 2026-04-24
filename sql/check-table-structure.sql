-- 检查 assets 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'assets'
ORDER BY ordinal_position;

-- 检查 operation_history 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'operation_history'
ORDER BY ordinal_position;

-- 检查 maintenance_records 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'maintenance_records'
ORDER BY ordinal_position;

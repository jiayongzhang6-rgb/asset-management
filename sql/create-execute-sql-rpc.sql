-- 创建 execute_sql RPC 函数 + 添加 category 列（绕过 PostgREST schema cache 直接操作数据库）
-- 执行方法：在 Supabase Dashboard → SQL Editor 中粘贴并运行
-- 只需执行一次，之后所有页面刷新即可生效

-- 1. 创建 execute_sql 函数
CREATE OR REPLACE FUNCTION execute_sql(sql text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE result json;
BEGIN
  IF sql !~* '^\s*(SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|NOTIFY|DO)\b' THEN
    RAISE EXCEPTION 'Only read/write/DDL/NOTIFY statements are allowed';
  END IF;
  IF sql ~* 'pg_catalog|pg_sleep|COPY|TRUNCATE' THEN
    RAISE EXCEPTION 'Forbidden statement detected';
  END IF;
  EXECUTE sql INTO result;
  RETURN result;
END $$;

-- 2. 授予执行权限
GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated;

-- 3. 确保 category 列存在（如果不存在则添加）
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';

-- 4. 刷新 PostgREST schema cache（让 REST API 也能看到所有新列）
NOTIFY pgrst, 'reload schema';

-- 5. 验证：确认 assets 表有 category 列
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='assets' AND column_name='category';

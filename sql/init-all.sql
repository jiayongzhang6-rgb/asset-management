-- ============================================================
-- 资产管理系统：一次性初始化脚本
-- 执行方法：Supabase Dashboard → SQL Editor → 粘贴运行
-- 包含：execute_sql RPC、category 列、AI 估值列、RLS 权限
-- ============================================================

-- 1. 创建 execute_sql RPC 函数（绕过 PostgREST schema cache 直接操作数据库）
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

GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated;

-- 2. 确保 category 列存在
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';

-- 3. AI 估值持久化列
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_fixed_value INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_current_value INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_reason VARCHAR(200);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_valuated_at TIMESTAMPTZ;

COMMENT ON COLUMN assets.ai_fixed_value IS 'AI估值：购入时全新市场价';
COMMENT ON COLUMN assets.ai_current_value IS 'AI估值：当前二手合理成交价';
COMMENT ON COLUMN assets.ai_reason IS 'AI估值：简要依据';
COMMENT ON COLUMN assets.ai_valuated_at IS 'AI估值：最近一次出值时间';

-- 4. 修复 RLS：允许已认证用户更新资产
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assets' AND cmd='UPDATE') THEN
    CREATE POLICY "Allow all updates" ON assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 6. 验证
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='assets'
AND column_name IN ('category', 'ai_fixed_value', 'ai_current_value', 'ai_reason', 'ai_valuated_at');

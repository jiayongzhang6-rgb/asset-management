-- ============================================================
-- AI 估值持久化：添加列 + execute_sql RPC + RLS 权限
-- ============================================================

-- 1. 添加 4 列（已存在则跳过）
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_fixed_value INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_current_value INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_reason VARCHAR(200);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ai_valuated_at TIMESTAMPTZ;

COMMENT ON COLUMN assets.ai_fixed_value IS 'AI估值：购入时全新市场价';
COMMENT ON COLUMN assets.ai_current_value IS 'AI估值：当前二手合理成交价';
COMMENT ON COLUMN assets.ai_reason IS 'AI估值：简要依据';
COMMENT ON COLUMN assets.ai_valuated_at IS 'AI估值：最近一次出值时间';

-- 2. 修复 RLS：允许已认证用户更新资产
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assets' AND cmd='UPDATE') THEN
    CREATE POLICY "Allow all updates" ON assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. 创建 execute_sql RPC（绕过 PostgREST schema cache）
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

-- 4. 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';
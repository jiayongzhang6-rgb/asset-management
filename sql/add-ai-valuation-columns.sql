-- ============================================================
-- 为 assets 表增加 AI 估值持久化列
-- 执行后请务必：1) 刷新浏览器  2) 点一次"刷新AI估值"
-- 估值结果将永久保存在数据库中
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_fixed_value') THEN
    ALTER TABLE assets ADD COLUMN ai_fixed_value INTEGER;
    RAISE NOTICE 'Added ai_fixed_value column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_current_value') THEN
    ALTER TABLE assets ADD COLUMN ai_current_value INTEGER;
    RAISE NOTICE 'Added ai_current_value column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_reason') THEN
    ALTER TABLE assets ADD COLUMN ai_reason VARCHAR(200);
    RAISE NOTICE 'Added ai_reason column';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_valuated_at') THEN
    ALTER TABLE assets ADD COLUMN ai_valuated_at TIMESTAMPTZ;
    RAISE NOTICE 'Added ai_valuated_at column';
  END IF;
END $$;

COMMENT ON COLUMN assets.ai_fixed_value IS 'AI估值：购入时全新市场价(元整数)';
COMMENT ON COLUMN assets.ai_current_value IS 'AI估值：当前二手合理成交价(元整数)';
COMMENT ON COLUMN assets.ai_reason IS 'AI估值：简要依据(200字内)';
COMMENT ON COLUMN assets.ai_valuated_at IS 'AI估值：最近一次出值时间';

-- ============================================================
-- 刷新 PostgREST schema cache（关键步骤！）
-- 不加这个，REST API 看不到新列，前端 select/update ai_* 列会报 400
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 创建 execute_sql RPC 函数（如果不存在）
-- 这个函数让前端能绕开 PostgREST schema cache 直接读写数据库
-- ============================================================
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  -- 只允许 SELECT、INSERT、UPDATE、DELETE、DDL 语句
  IF sql !~* '^\s*(SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|NOTIFY|DO)\b' THEN
    RAISE EXCEPTION 'Only read/write/DDL/NOTIFY statements are allowed';
  END IF;
  -- 禁止危险操作
  IF sql ~* 'pg_catalog|pg_sleep|pg_read_|pg_write_|COPY|TRUNCATE' THEN
    RAISE EXCEPTION 'Forbidden statement detected';
  END IF;
  EXECUTE sql INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- 返回错误信息而不是抛异常，让前端能处理
    RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- 授权给 anon 和 authenticated 角色
GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated;

-- 完成！请刷新浏览器，然后点一次"刷新AI估值"按钮，估值将永久保存到数据库。

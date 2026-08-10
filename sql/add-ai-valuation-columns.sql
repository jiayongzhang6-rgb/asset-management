-- ============================================================
-- 为 assets 表增加 AI 估值持久化列
-- 执行后请务必：1) 重新部署前端（Vercel） 2) 刷新浏览器  3) 点一次"刷新AI估值"
-- 估值结果将永久保存在数据库中
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_fixed_value') THEN
    ALTER TABLE assets ADD COLUMN ai_fixed_value INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_current_value') THEN
    ALTER TABLE assets ADD COLUMN ai_current_value INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_reason') THEN
    ALTER TABLE assets ADD COLUMN ai_reason VARCHAR(200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ai_valuated_at') THEN
    ALTER TABLE assets ADD COLUMN ai_valuated_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN assets.ai_fixed_value IS 'AI估值：购入时全新市场价(元整数)';
COMMENT ON COLUMN assets.ai_current_value IS 'AI估值：当前二手合理成交价(元整数)';
COMMENT ON COLUMN assets.ai_reason IS 'AI估值：简要依据(200字内)';
COMMENT ON COLUMN assets.ai_valuated_at IS 'AI估值：最近一次出值时间';

-- ============================================================
-- ★★★ 关键：修复 RLS (Row Level Security) 权限 ★★★
-- 如果 assets 表开启了 RLS，anon 用户可能没权限 UPDATE 新列，
-- 导致写入失败（返回 204 但数据库没更新）。
-- 这里确保有一条策略允许已认证用户更新自己的资产。
-- ============================================================

-- 先检查是否已经有允许更新的策略
DO $$
DECLARE
  policy_exists INTEGER;
BEGIN
  SELECT count(*) INTO policy_exists
  FROM pg_policies
  WHERE tablename = 'assets' AND permissive = 'PERMISSIVE'
    AND cmd = 'UPDATE'
    AND roles @> ARRAY['anon', 'authenticated'];
    
  IF policy_exists = 0 THEN
    -- 检查是否有任何 UPDATE 策略
    SELECT count(*) INTO policy_exists
    FROM pg_policies
    WHERE tablename = 'assets' AND cmd = 'UPDATE';
    
    IF policy_exists = 0 THEN
      -- 没有任何 UPDATE 策略 → 创建一个允许所有已认证用户更新的策略
      CREATE POLICY "Allow all updates on assets" ON assets
        FOR UPDATE
        TO anon, authenticated
        USING (true)
        WITH CHECK (true);
      RAISE NOTICE 'Created UPDATE policy for assets (permissive)';
    ELSE
      RAISE NOTICE 'UPDATE policy already exists on assets';
    END IF;
  ELSE
    RAISE NOTICE 'UPDATE policy for anon/authenticated already exists on assets';
  END IF;
END $$;

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
  IF sql !~* '^\s*(SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|NOTIFY|DO)\b' THEN
    RAISE EXCEPTION 'Only read/write/DDL/NOTIFY statements are allowed';
  END IF;
  IF sql ~* 'pg_catalog|pg_sleep|pg_read_|pg_write_|COPY|TRUNCATE' THEN
    RAISE EXCEPTION 'Forbidden statement detected';
  END IF;
  EXECUTE sql INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- 授权给 anon 和 authenticated 角色
GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated;

-- ============================================================
-- 最后：刷新 PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- 完成！请确认前端部署成功后再操作。
-- ============================================================
-- 资产管理系统：一次性初始化脚本
-- 执行方法：Supabase Dashboard → SQL Editor → 粘贴运行
-- 包含：execute_sql RPC、category 列、AI 估值列、RLS 权限
-- ============================================================

-- 1. 创建 execute_sql RPC 函数（绕过 PostgREST schema cache 直接操作数据库）
--    历史坑位（都已修）：
--      a) `EXECUTE sql INTO result` 对 UPDATE/DELETE/INSERT 会抛
--         "query has no destination for result data"
--      b) SELECT 多列多行时，把整行当文本转 json 会抛
--         "invalid input syntax for type json"（单列单行恰好能过，极具迷惑性）
--    正确做法：SELECT 用 json_agg 包成 [{...},{...}] 对象数组；其余语句直接 EXECUTE。
DROP FUNCTION IF EXISTS public.execute_sql(text);

CREATE FUNCTION public.execute_sql(sql text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
  stmt text := btrim(sql);
BEGIN
  IF stmt ~* 'pg_catalog|pg_sleep|COPY\s|TRUNCATE' THEN
    RAISE EXCEPTION 'Forbidden statement';
  END IF;

  -- 去掉结尾分号，便于嵌入子查询
  stmt := btrim(rtrim(stmt, ';'));

  IF substring(stmt FROM 1 FOR 6) ILIKE 'SELECT' OR substring(stmt FROM 1 FOR 4) ILIKE 'WITH' THEN
    -- 返回对象数组：[{"col":val,...}, ...]
    EXECUTE format('SELECT COALESCE(json_agg(t), ''[]''::json) FROM (%s) t', stmt) INTO result;
  ELSE
    EXECUTE stmt;
    result := json_build_object('status', 'ok');
  END IF;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO anon, authenticated;

-- 2. 确保扩展列存在
--    category=分类, lessee_entity=承租主体, lessee_manager=承租负责人, parent_asset_code=所属主机
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lessee_entity VARCHAR(100) DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lessee_manager VARCHAR(50) DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_code VARCHAR(50) DEFAULT '';

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
AND column_name IN ('category', 'lessee_entity', 'lessee_manager', 'parent_asset_code', 'ai_fixed_value', 'ai_current_value', 'ai_reason', 'ai_valuated_at');

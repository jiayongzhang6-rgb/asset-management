-- 为 assets 表增加 AI 估值持久化列
-- 一旦 AI 跑出估值，写入这些列，刷新/换浏览器/清缓存都不会丢
-- 使用 DO 块避免列已存在时报错（PG 没有 IF NOT EXISTS ADD COLUMN 的简单语法，旧 PG 版本不支持）

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

-- 给列加注释，方便后期维护
COMMENT ON COLUMN assets.ai_fixed_value IS 'AI估值：购入时全新市场价(元整数)';
COMMENT ON COLUMN assets.ai_current_value IS 'AI估值：当前二手合理成交价(元整数)';
COMMENT ON COLUMN assets.ai_reason IS 'AI估值：简要依据(200字内)';
COMMENT ON COLUMN assets.ai_valuated_at IS 'AI估值：最近一次出值时间';

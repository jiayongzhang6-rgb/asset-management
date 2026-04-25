-- 创建 asset_images 表，使用 asset_code 作为外键
CREATE TABLE asset_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code VARCHAR(50) NOT NULL,
  image_url TEXT NOT NULL,
  image_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用行级安全
ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Allow public read access" ON asset_images FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON asset_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON asset_images FOR DELETE USING (true);

-- 验证表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'asset_images';

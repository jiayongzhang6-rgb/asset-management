-- 创建 maintenance_records 表
CREATE TABLE maintenance_records (
    id bigint primary key generated always as identity,
    asset_id bigint not null,
    issue_description text not null,
    repair_description text,
    repair_date date,
    repair_cost decimal(10, 2),
    status text not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    foreign key (asset_id) references assets(id)
);

-- 启用行级安全
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Allow public read access" ON maintenance_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON maintenance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON maintenance_records FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON maintenance_records FOR DELETE USING (true);

-- 验证表结构
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'maintenance_records';

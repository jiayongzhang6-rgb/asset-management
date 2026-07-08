CREATE TABLE usage_history (
    id bigint primary key generated always as identity,
    asset_id bigint not null,
    asset_code varchar(50) not null,
    operation_type varchar(20) not null,
    user_email varchar(255) not null,
    changes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    foreign key (asset_id) references assets(id)
);

ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON usage_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON usage_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON usage_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON usage_history FOR DELETE USING (true);

SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'usage_history';
-- 创建assets表（如果不存在）
create table if not exists assets (
  id bigint primary key generated always as identity,
  asset_code text not null,
  brand text not null,
  model text not null,
  cpu text not null,
  ram text not null,
  storage text not null,
  gpu text,
  os text not null,
  department text not null,
  user_name text not null,
  location text not null,
  status text not null default 'active',
  monthly_rent decimal(10, 2) default 0,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 启用行级安全
alter table assets enable row level security;

-- 移除旧的策略（如果存在）
drop policy if exists "Allow public read access" on assets;
drop policy if exists "Allow public insert access" on assets;
drop policy if exists "Allow public update access" on assets;
drop policy if exists "Allow public delete access" on assets;

-- 创建策略，允许所有用户读取资产数据
create policy "Allow public read access" on assets
  for select using (true);

-- 创建策略，允许所有用户插入资产数据
create policy "Allow public insert access" on assets
  for insert with check (true);

-- 创建策略，允许所有用户更新资产数据
create policy "Allow public update access" on assets
  for update using (true);

-- 创建策略，允许所有用户删除资产数据
create policy "Allow public delete access" on assets
  for delete using (true);


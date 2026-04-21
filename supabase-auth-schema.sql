-- 创建用户表（如果不存在）
create table if not exists users (
  id bigint primary key generated always as identity,
  email text unique not null,
  role text not null default 'user', -- 'admin' 或 'user'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 启用行级安全
alter table users enable row level security;

-- 创建操作历史表（如果不存在）
create table if not exists operation_history (
  id bigint primary key generated always as identity,
  asset_id bigint not null,
  operation_type text not null, -- 'create', 'update', 'delete'
  old_data jsonb,
  new_data jsonb,
  user_email text not null,
  created_at timestamp with time zone default now()
);

-- 启用行级安全
alter table operation_history enable row level security;

-- 为操作历史表添加外键约束（如果assets表存在）
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'assets') then
    alter table operation_history add constraint fk_asset foreign key (asset_id) references assets (id) on delete cascade;
  end if;
end $$;

-- 移除旧的策略（如果存在）
drop policy if exists "Allow public read access" on users;
drop policy if exists "Allow public insert access" on users;
drop policy if exists "Allow public update access" on users;
drop policy if exists "Allow public delete access" on users;

drop policy if exists "Allow public read access" on operation_history;
drop policy if exists "Allow public insert access" on operation_history;

-- 创建用户表的策略
create policy "Allow public read access" on users
  for select using (true);

create policy "Allow public insert access" on users
  for insert with check (true);

create policy "Allow public update access" on users
  for update using (true);

create policy "Allow public delete access" on users
  for delete using (true);

-- 创建操作历史表的策略
create policy "Allow public read access" on operation_history
  for select using (true);

create policy "Allow public insert access" on operation_history
  for insert with check (true);

-- 插入管理员用户
insert into users (email, role)
values ('747227185@qq.com', 'admin')
on conflict (email) do update set role = 'admin';

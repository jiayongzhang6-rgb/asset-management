-- ============================================================
-- 资产管理系统 · 安全加固脚本（兼容式）
-- 适用：当前为「自建 users 表 + 明文密码」登录方式。
-- 在 Supabase 控制台 -> SQL Editor 中一次性执行本文件即可生效。
-- 前置：需要 pgcrypto 扩展（Supabase 项目默认可用，下面会自动启用）。
-- 重要：必须先执行本文件，再部署改后的前端，否则登录会因 RPC 不存在而失败。
-- ============================================================

-- 1) 启用密码哈希扩展
create extension if not exists pgcrypto;

-- 2) 登录校验：前端传入明文，数据库内部比对哈希，绝不把哈希返回给前端。
--    兼容历史明文密码：首次用明文登录成功时，自动就地迁移为 bcrypt 哈希。
create or replace function verify_user_password(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_ok boolean := false;
begin
  select * into v_user from users where email = p_email;
  if v_user is null then
    return json_build_object('ok', false);
  end if;

  if v_user.password like '$2%' then
    -- 已是哈希
    v_ok := v_user.password = crypt(p_password, v_user.password);
  else
    -- 历史明文：相等则顺带迁移为哈希
    if v_user.password = p_password then
      v_ok := true;
      update users set password = crypt(p_password, gen_salt('bf')) where id = v_user.id;
    end if;
  end if;

  if v_ok then
    return json_build_object('ok', true, 'email', v_user.email, 'role', v_user.role);
  else
    return json_build_object('ok', false);
  end if;
end;
$$;

-- 3) 注册：密码以哈希存储，角色固定为 user（防匿名自建管理员）
create or replace function register_user(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into users (email, password, role)
  values (p_email, crypt(p_password, gen_salt('bf')), 'user')
  on conflict (email) do nothing
  returning id into v_id;

  if v_id is null then
    return json_build_object('ok', false, 'reason', 'exists');
  end if;
  return json_build_object('ok', true, 'email', p_email, 'role', 'user');
end;
$$;

-- 4) 修改密码：校验旧密码后，写入新哈希
create or replace function change_password(p_email text, p_old text, p_new text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
begin
  select * into v_user from users where email = p_email;
  if v_user is null then
    return json_build_object('ok', false);
  end if;

  if v_user.password like '$2%' then
    if v_user.password <> crypt(p_old, v_user.password) then
      return json_build_object('ok', false);
    end if;
  else
    if v_user.password <> p_old then
      return json_build_object('ok', false);
    end if;
  end if;

  update users set password = crypt(p_new, gen_salt('bf')) where id = v_user.id;
  return json_build_object('ok', true);
end;
$$;

-- 5) 重置密码：用临时密码（哈希后）覆盖
create or replace function reset_password(p_email text, p_temp text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set password = crypt(p_temp, gen_salt('bf')) where email = p_email;
  if found then
    return json_build_object('ok', true);
  else
    return json_build_object('ok', false);
  end if;
end;
$$;

-- 6) 删除用户：仅管理员在前端调用（兼容式下无法在服务端强制校验身份，
--    但配合下方 RLS，匿名用户无法直接 DELETE 表）
create or replace function delete_user(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from users where id = p_id;
  if found then
    return json_build_object('ok', true);
  else
    return json_build_object('ok', false);
  end if;
end;
$$;

-- 7) 授权前端（anon）调用上述 RPC
grant execute on function verify_user_password(text, text) to anon, authenticated;
grant execute on function register_user(text, text) to anon, authenticated;
grant execute on function change_password(text, text, text) to anon, authenticated;
grant execute on function reset_password(text, text) to anon, authenticated;
grant execute on function delete_user(bigint) to anon, authenticated;

-- 8) 收紧 users 表的 RLS（读/写权限）
--    读：保留公开（前端用户列表需要）
--    写：禁止匿名自我提权为 admin、禁止改邮箱、禁止删除、禁止直接插入 admin
drop policy if exists "Allow public insert access" on users;
drop policy if exists "Allow public update access" on users;
drop policy if exists "Allow public delete access" on users;

-- 8a) 两个 SECURITY DEFINER 辅助函数：回查“已存”的 role / email。
--     用 definer 是为了让策略里的判断绕过 RLS，避免同表递归
--     （否则会报 infinite recursion detected in policy for relation users）。
create or replace function user_current_role(p_id bigint)
returns text language sql security definer set search_path = public
as $$ select role from users where id = p_id; $$;

create or replace function user_current_email(p_id bigint)
returns text language sql security definer set search_path = public
as $$ select email from users where id = p_id; $$;

grant execute on function user_current_role(bigint) to anon, authenticated;
grant execute on function user_current_email(bigint) to anon, authenticated;

-- 禁止直接通过 API 插入 admin 角色（注册 RPC 用 definer 权限绕过此限制）
-- 注意：RLS 策略里直接写列名即可，不要写 NEW./OLD.（那是触发器/RULE 的写法，会报 42P01）
create policy "no_direct_admin_insert" on users
  for insert with check (role = 'user');

-- 禁止自我提权为 admin + 禁止修改邮箱（合在一个策略里用 AND，避免多条 permissive 策略被 OR 合并导致防线失效）
--   * role <> 'admin' OR 该账号本来已是 admin  -> 阻止 user 变 admin，但允许 admin 行保持 admin
--   * email = 已存的 email                      -> 阻止改邮箱劫持账号
--   注：WITH CHECK 只能看到“新行”的列，旧值通过上面的 definer 函数回查（绕过 RLS，不会递归）。
create policy "users_update_guard" on users
  for update using (true)
  with check (
    (role <> 'admin' OR user_current_role(id) = 'admin')
    and (email = user_current_email(id))
  );

-- 禁止删除用户（防数据销毁；删除请走 delete_user RPC）
create policy "no_user_delete" on users
  for delete using (false);

-- ============================================================
-- 已知边界（需在后续迁移 Supabase Auth 后才能彻底解决）：
--   assets / rent_records / operation_history 三张表目前仍为全开 RLS。
--   因为前端使用匿名 key 且未走 Supabase Auth，数据库层无法区分
--   「正常登录用户」与「匿名攻击者」，故暂时保持可访问以保证应用可用。
--   彻底锁定数据写权限，需要把登录迁移到 Supabase Auth，
--   并改用基于 auth.uid()/auth.role() 的 RLS 策略。
-- ============================================================

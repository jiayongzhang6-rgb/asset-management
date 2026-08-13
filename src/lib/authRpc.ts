// ============================================================
// 安全加固：把登录/注册/改密/重置/删除 改为走数据库 RPC。
// 明文密码不再返回前端，密码在数据库内用 pgcrypto(bcrypt) 比对。
// 依赖 security/supabase-hardening.sql 中创建的函数，
// 必须先在 Supabase 控制台执行该 SQL，再部署本文件。
// ============================================================
import { supabase } from './supabase'

export interface AuthRpcResult {
  ok: boolean
  email?: string
  role?: string
  reason?: string
}

/** 登录校验：传入明文，数据库内部比对哈希，只回传 ok/email/role */
export async function verifyUserPassword(email: string, password: string): Promise<AuthRpcResult> {
  const { data, error } = await supabase.rpc('verify_user_password', {
    p_email: email,
    p_password: password,
  })
  if (error) throw error
  return (data ?? { ok: false }) as AuthRpcResult
}

/** 注册：密码以哈希存储，角色固定为 user（防匿名自建管理员） */
export async function registerUserRpc(email: string, password: string): Promise<AuthRpcResult> {
  const { data, error } = await supabase.rpc('register_user', {
    p_email: email,
    p_password: password,
  })
  if (error) throw error
  return (data ?? { ok: false }) as AuthRpcResult
}

/** 重置密码：用随机临时密码（哈希后）覆盖 */
export async function resetPasswordRpc(email: string, temp: string): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('reset_password', {
    p_email: email,
    p_password: temp,
  })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

/** 修改密码：先校验旧密码，再写入新哈希 */
export async function changePasswordRpc(
  email: string,
  oldP: string,
  newP: string
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('change_password', {
    p_email: email,
    p_old: oldP,
    p_new: newP,
  })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

/** 删除用户：走 definer 函数，绕过 RLS 的「禁止删除」策略 */
export async function deleteUserRpc(id: number): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('delete_user', { p_id: id })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

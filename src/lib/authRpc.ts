// ============================================================
// 认证封装：
//  - 新流程走 Supabase Auth（signInWithPassword / signUp / updateUser / resetPasswordForEmail），
//    登录后 JWT 含 app_role（由 custom_access_token_hook 注入），数据库 RLS 据此判定角色。
//  - 旧账号兜底：尚未迁移到 Supabase Auth 的账号，仍走原 RPC（verify_user_password 等），
//    并在登录时静默迁移（用原密码 signUp，后台已关确认邮件 → 即时生效）。
// 依赖 security/supabase-auth-migration.sql 中创建的函数/视图，需先在 Supabase 控制台执行该 SQL。
// ============================================================
import { supabase } from './supabase'

export interface AuthRpcResult {
  ok: boolean
  email?: string
  role?: string
  reason?: string
}

// ---------- 旧 RPC（兜底 / 待迁移账号） ----------
export async function verifyUserPassword(email: string, password: string): Promise<AuthRpcResult> {
  const { data, error } = await supabase.rpc('verify_user_password', { p_email: email, p_password: password })
  if (error) throw error
  return (data ?? { ok: false }) as AuthRpcResult
}

export async function registerUserRpc(email: string, password: string): Promise<AuthRpcResult> {
  const { data, error } = await supabase.rpc('register_user', { p_email: email, p_password: password })
  if (error) throw error
  return (data ?? { ok: false }) as AuthRpcResult
}

export async function resetPasswordRpc(email: string, temp: string): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('reset_password', { p_email: email, p_password: temp })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

export async function changePasswordRpc(email: string, oldP: string, newP: string): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('change_password', { p_email: email, p_old: oldP, p_new: newP })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

export async function deleteUserRpc(id: number): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('delete_user', { p_id: id })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean }
}

// ---------- 新增：Supabase Auth 封装 ----------
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  try {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(padded)
  }
}

/** 从 access_token 解码 app_role（由 custom_access_token_hook 注入） */
export function roleFromSession(session: any): 'admin' | 'user' | null {
  const token: string | undefined = session?.access_token
  if (!token) return null
  try {
    const payload = JSON.parse(base64UrlDecode(token.split('.')[1]))
    return (payload.app_role as 'admin' | 'user') ?? null
  } catch {
    return null
  }
}

export async function signInAuth(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpAuth(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signOutAuth() {
  return supabase.auth.signOut()
}

export async function updatePasswordAuth(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
}

export async function resetPasswordAuthEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email)
}

/** 该账号是否待迁移（旧登录兜底判断） */
export async function getUserPending(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_user_pending', { p_email: email })
  if (error) throw error
  return (data as { pending: boolean } | null)?.pending ?? false
}

/** 管理员重置密码：更新 auth.users 加密密码（SECURITY DEFINER） */
export async function adminResetAuthPassword(email: string, temp: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('admin_reset_auth_password', { p_email: email, p_temp: temp })
  if (error) throw error
  return (data ?? { ok: false }) as { ok: boolean; reason?: string }
}

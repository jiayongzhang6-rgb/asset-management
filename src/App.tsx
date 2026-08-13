import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase, type User, initDatabase, warmUpCategoryCheck } from './lib/supabase'
import {
  verifyUserPassword,
  changePasswordRpc,
  roleFromSession,
  signInAuth,
  signUpAuth,
  signOutAuth,
  updatePasswordAuth,
  resetPasswordAuthEmail,
  getUserPending,
} from './lib/authRpc'
import { ErrorBoundary } from './components/ErrorBoundary'
import Index from './pages/Index'
import AssetDetail from './pages/AssetDetail'
import Login from './pages/Login'
import Import from './pages/Import'
import OperationHistory from './pages/OperationHistory'
import RentDetail from './pages/RentDetail'
import RentSettlement from './pages/RentSettlement'
import Users from './pages/Users'
import ChangePassword from './pages/ChangePassword'
import AiValuationSettings from './pages/AiValuationSettings'
import NotFound from './pages/NotFound'

// 简化的AuthProvider，不使用Supabase
interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (emailOrPhone: string, password: string) => Promise<void>
  signUp: (emailOrPhone: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (emailOrPhone: string) => Promise<void>
  updatePassword: (oldPassword: string, newPassword: string) => Promise<void>
  isAuthenticated: boolean
  pendingRedirect: string | null
  setPendingRedirect: (url: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 优先从 localStorage 还原（旧登录态也可用）；登录后 JWT 含 app_role（服务端可信），
  // 不再在前端根据 adminEmails 推导，避免被 DevTools 篡改提权。
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      return JSON.parse(savedUser)
    }
    return null
  })

  const [loading, setLoading] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)

  // 把登录态写入内存 + localStorage（不含密码）
  const applyUser = (email: string, role: 'admin' | 'user' | string | null | undefined) => {
    const userData = { email, role: (role as string) ?? 'user' }
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  // 启动时还原 Supabase session（JWT 含 app_role），保证后续请求带 JWT、RLS 生效
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      if (s?.user?.email) {
        applyUser(s.user.email, roleFromSession(s))
      } else {
        // 没有有效 Supabase session：清掉 localStorage 旧登录态，强制重新登录。
        // 否则前端看似已登录，但 Supabase 客户端无 JWT，请求走 anon key
        // 会被 RLS 拒绝（auth.uid() 为 null），导致数据加载失败/不一致。
        // 旧账号在此处会被导向登录页，登录时走 signIn 的静默迁移逻辑。
        setUser(null)
        localStorage.removeItem('user')
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) {
        applyUser(session.user.email, roleFromSession(session))
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        localStorage.removeItem('user')
      }
      // INITIAL_SESSION 无 session 时，保留 localStorage 里的旧登录态
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const normalizePhone = (v: string) =>
    /^\d{11}$/.test(v) ? `${v}@phone.local` : v

  // 登录：优先 Supabase Auth；失败则回退旧账号（用原密码静默迁移到 Supabase Auth）
  const signIn = async (emailOrPhone: string, password: string) => {
    setLoading(true)
    try {
      const email = normalizePhone(emailOrPhone)

      // 1) 优先 Supabase Auth（已迁移账号）
      const { data } = await signInAuth(email, password)
      if (data.session) {
        applyUser(email, roleFromSession(data.session))
        return
      }
      // 2) 兜底：旧账号（尚未迁移到 Supabase Auth）
      const old = await verifyUserPassword(email, password)
      if (!old.ok) {
        throw new Error('账号或密码错误')
      }
      // 旧账号静默迁移：用刚输入的密码 signUp（后台已关确认邮件 → 即时生效）
      const pending = await getUserPending(email).catch(() => true)
      if (pending) {
        const { error: suErr } = await signUpAuth(email, password)
        if (suErr && !/already registered|user already/i.test(suErr.message)) {
          throw suErr
        }
        const { data: d2, error: e2 } = await signInAuth(email, password)
        if (d2.session) {
          applyUser(email, roleFromSession(d2.session))
          return
        }
        if (e2) throw e2
      }
      // 非 pending 旧账号（理论上不会到这）：用旧返回的角色
      applyUser(email, old.role)
    } catch (error) {
      console.error('Error signing in:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (emailOrPhone: string, password: string) => {
    setLoading(true)
    try {
      const email = normalizePhone(emailOrPhone)
      const { data, error } = await signUpAuth(email, password)
      if (error) throw error
      if (data.session) {
        applyUser(email, roleFromSession(data.session))
      } else if (data.user) {
        // 开启了确认邮件：暂无 session，提示去邮箱确认
        throw new Error('注册成功，请查收确认邮件后登录')
      }
    } catch (error) {
      console.error('Error signing up:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await signOutAuth().catch(() => {})
    setUser(null)
    localStorage.removeItem('user')
  }

  const resetPassword = async (emailOrPhone: string) => {
    setLoading(true)
    try {
      const email = normalizePhone(emailOrPhone)
      // 走 Supabase Auth 发送重置邮件（需后台配置 SMTP / Site URL）
      const { error } = await resetPasswordAuthEmail(email)
      if (error) throw error
    } catch (error) {
      console.error('Error resetting password:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (oldPassword: string, newPassword: string) => {
    setLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      if (sess.session) {
        // 已迁移：直接用 Supabase Auth 改密（session 内不需要旧密码）
        const { error } = await updatePasswordAuth(newPassword)
        if (error) throw error
      } else {
        // 过渡期旧登录态（无 Supabase session）：走旧 RPC
        if (!user?.email) throw new Error('用户未登录')
        const result = await changePasswordRpc(user.email, oldPassword, newPassword)
        if (!result.ok) throw new Error('旧密码错误')
      }
      alert('密码修改成功！')
    } catch (error) {
      console.error('Error updating password:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        isAuthenticated: !!user,
        pendingRedirect,
        setPendingRedirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 管理员路由守卫：非 admin 访问管理路径时自动跳回首页
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// URL参数处理组件
function URLHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, setPendingRedirect } = useAuth()

  useEffect(() => {
    // 检查URL参数
    const params = new URLSearchParams(location.search)
    const action = params.get('action')
    const id = params.get('id')

    // 处理扫码跳转
    if (action === 'edit' && id) {
      // 如果用户已登录，直接跳转到资产详情页
      if (isAuthenticated) {
        navigate(`/asset/${id}`)
      } else {
        // 如果用户未登录，保存目标页面，等登录后再跳转
        setPendingRedirect(`/asset/${id}`)
        navigate('/login')
      }
    }

    // 处理直接访问资产详情页的情况
    if (location.pathname.startsWith('/asset/') && !isAuthenticated) {
      // 保存当前路径作为待跳转页面
      setPendingRedirect(location.pathname)
      navigate('/login')
    }
  }, [location.search, location.pathname, navigate, isAuthenticated, setPendingRedirect])

  return null
}

export default function App() {
  // 应用启动时：初始化数据库表 + 预热 category 列支持探测（异步不阻塞渲染）
  useEffect(() => {
    void initDatabase()
    warmUpCategoryCheck()
  }, [])

  return (
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <URLHandler />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/asset/:id" element={<AssetDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            {/* 以下管理功能仅对 admin 开放 */}
            <Route path="/import" element={<AdminRoute><Import /></AdminRoute>} />
            <Route path="/history" element={<AdminRoute><OperationHistory /></AdminRoute>} />
            <Route path="/rent" element={<AdminRoute><RentDetail /></AdminRoute>} />
            <Route path="/settlement" element={<AdminRoute><RentSettlement /></AdminRoute>} />
            <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="/ai-valuation" element={<AdminRoute><AiValuationSettings /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

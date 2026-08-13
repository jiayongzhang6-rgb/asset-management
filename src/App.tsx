import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase, type User, initDatabase, warmUpCategoryCheck } from './lib/supabase'
import {
  verifyUserPassword,
  registerUserRpc,
  resetPasswordRpc,
  changePasswordRpc,
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
  // 仅从 localStorage 还原；角色以登录时数据库返回为准（服务端可信），
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

  // 登录：密码校验交给数据库 RPC，前端只拿到 ok/email/role，绝不接触明文或哈希
  const signIn = async (emailOrPhone: string, password: string) => {
    setLoading(true)
    try {
      // 如果是手机号（纯数字），转换为邮箱格式查询
      const email = /^\d{11}$/.test(emailOrPhone) ? `${emailOrPhone}@phone.local` : emailOrPhone

      const result = await verifyUserPassword(email, password)
      if (!result.ok) {
        throw new Error('账号或密码错误')
      }

      const userData = { email: result.email, role: result.role ?? 'user' }
      setUser(userData)
      // 存储到localStorage（不含密码）
      localStorage.setItem('user', JSON.stringify(userData))
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
      // 如果是手机号（纯数字），转换为邮箱格式存储
      const email = /^\d{11}$/.test(emailOrPhone) ? `${emailOrPhone}@phone.local` : emailOrPhone

      const result = await registerUserRpc(email, password)
      if (!result.ok) {
        if (result.reason === 'exists') {
          throw new Error('该手机号已被注册')
        }
        throw new Error('注册失败，请稍后重试')
      }

      const userData = { email: result.email, role: result.role ?? 'user' }
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      console.error('Error signing up:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    // 模拟退出
    setUser(null)
    // 从localStorage中删除
    localStorage.removeItem('user')
  }

  const resetPassword = async (emailOrPhone: string) => {
    setLoading(true)
    try {
      // 如果是手机号（纯数字），转换为邮箱格式查询
      const email = /^\d{11}$/.test(emailOrPhone) ? `${emailOrPhone}@phone.local` : emailOrPhone

      // 检查用户是否存在（仅取 email，不取密码）
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
      if (fetchError) throw fetchError

      if (!users || users.length === 0) {
        throw new Error('账号不存在')
      }

      // 生成一个临时密码
      const tempPassword = Math.random().toString(36).substring(2, 10)

      // 通过 RPC 重置（数据库内部哈希存储）
      const result = await resetPasswordRpc(email, tempPassword)
      if (!result.ok) throw new Error('密码重置失败')

      console.log('密码已重置为:', tempPassword)

      // 提示用户联系管理员获取临时密码
      alert('密码重置请求已提交，请联系管理员获取临时密码。')
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
      if (!user) {
        throw new Error('用户未登录')
      }

      // 通过 RPC 校验旧密码并写入新哈希，前端不再持有密码
      const result = await changePasswordRpc(user.email, oldPassword, newPassword)
      if (!result.ok) {
        throw new Error('旧密码错误')
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
            <Route path="/import" element={<Import />} />
            <Route path="/history" element={<OperationHistory />} />
            <Route path="/rent" element={<RentDetail />} />
            <Route path="/settlement" element={<RentSettlement />} />
            <Route path="/users" element={<Users />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/ai-valuation" element={<AiValuationSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

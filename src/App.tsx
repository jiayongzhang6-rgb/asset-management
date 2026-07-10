import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Index from './pages/Index'
import AssetDetail from './pages/AssetDetail'
import Login from './pages/Login'
import Import from './pages/Import'
import OperationHistory from './pages/OperationHistory'
import RentDetail from './pages/RentDetail'
import Users from './pages/Users'
import ChangePassword from './pages/ChangePassword'
import NotFound from './pages/NotFound'

// 简化的AuthProvider，不使用Supabase
interface AuthContextType {
  user: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (oldPassword: string, newPassword: string) => Promise<void>
  isAuthenticated: boolean
  pendingRedirect: string | null
  setPendingRedirect: (url: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 1. 修正后的初始化逻辑
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      // 管理员邮箱列表
      const adminEmails = ['747227185@qq.com']
      return {
        ...parsedUser,
        role: parsedUser.role || (adminEmails.includes(parsedUser.email) ? 'admin' : 'user')
      }
    }
    return null
  })

  const [loading, setLoading] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)

  // 2. 修正后的登录/创建逻辑
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      // 直接在我们的 users 表中查询用户信息并验证密码
      const { data: users, error: fetchError } = await supabase.from('users').select('*').eq('email', email)
      if (fetchError) throw fetchError

      let userData;
      if (users && users.length > 0) {
        userData = users[0]
        // 检查密码是否存在
        if (!userData.password) {
          throw new Error('密码未设置，请联系管理员')
        }
        // 检查密码是否正确
        if (userData.password !== password) {
          throw new Error('密码错误')
        }
      } else {
        throw new Error('邮箱不存在')
      }

      setUser(userData)
      // 存储到localStorage
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      console.error('Error signing in:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    setLoading(true)
    try {
      // 首先检查用户是否已存在
      const { data: existingUsers, error: fetchError } = await supabase.from('users').select('*').eq('email', email)
      if (fetchError) throw fetchError

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('该邮箱已被注册')
      }

      // 直接在 users 表中创建用户记录，不使用 Supabase Auth
      // 管理员邮箱列表
      const adminEmails = ['747227185@qq.com']
      const role = adminEmails.includes(email) ? 'admin' : 'user'
      const { data, error: insertError } = await supabase.from('users').insert({ email, password, role }).select().single()
      if (insertError) throw insertError

      const userData = data || { email, password, role }
      setUser(userData)
      // 存储到localStorage
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

  const resetPassword = async (email: string) => {
    setLoading(true)
    try {
      // 检查用户是否存在
      const { data: users, error: fetchError } = await supabase.from('users').select('*').eq('email', email)
      if (fetchError) throw fetchError

      if (!users || users.length === 0) {
        throw new Error('邮箱不存在')
      }

      // 生成一个临时密码
      const tempPassword = Math.random().toString(36).substring(2, 10)
      
      // 更新用户密码
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: tempPassword })
        .eq('email', email)
      
      if (updateError) throw updateError
      
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

      // 验证旧密码
      if (user.password !== oldPassword) {
        throw new Error('旧密码错误')
      }

      // 更新密码
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('email', user.email)
      
      if (updateError) throw updateError

      // 更新本地用户数据
      const updatedUser = { ...user, password: newPassword }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))

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
  return (
    <AuthProvider>
      <BrowserRouter>
        <URLHandler />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/asset/:id" element={<AssetDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/import" element={<Import />} />
          <Route path="/history" element={<OperationHistory />} />
          <Route path="/rent" element={<RentDetail />} />
          <Route path="/users" element={<Users />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Index from './pages/Index'
import AssetDetail from './pages/AssetDetail'
import Login from './pages/Login'
import Import from './pages/Import'
import OperationHistory from './pages/OperationHistory'
import NotFound from './pages/NotFound'

// 简化的AuthProvider，不使用Supabase
interface AuthContextType {
  user: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
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
      return {
        ...parsedUser,
        role: parsedUser.role || (parsedUser.email === '747227185@qq.com' ? 'admin' : 'user')
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
      const { data: users, error: fetchError } = await supabase.from('users').select('*').eq('email', email)
      if (fetchError) throw fetchError

      let userData;
      if (users && users.length > 0) {
        userData = users[0]
      } else {
        // 这里的 role 判断只需要写一次
        const role = email === '747227185@qq.com' ? 'admin' : 'user'
        const { data, error: insertError } = await supabase.from('users').insert({ email, role }).select().single()
        if (insertError) throw insertError
        userData = data || { email, role }
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
      const { data: users, error: fetchError } = await supabase.from('users').select('*').eq('email', email)
      if (fetchError) throw fetchError

      let userData;
      if (users && users.length > 0) {
        userData = users[0]
      } else {
        // 这里的 role 判断只需要写一次
        const role = email === '747227185@qq.com' ? 'admin' : 'user'
        const { data, error: insertError } = await supabase.from('users').insert({ email, role }).select().single()
        if (insertError) throw insertError
        userData = data || { email, role }
      }

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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
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
  }, [location.search, navigate, isAuthenticated, setPendingRedirect])

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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

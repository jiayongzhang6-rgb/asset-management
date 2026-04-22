import { BrowserRouter, Route, Routes, useLocation, useEffect, useNavigate } from 'react-router-dom'
import React, { createContext, useContext, useState } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 从localStorage中读取用户信息
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      // 确保用户对象有role属性，默认值为'user'
      return {
        ...parsedUser,
        role: parsedUser.role || 'user'
      }
    }
    return null
  })
  const [loading, setLoading] = useState(false)

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      // 检查用户是否存在
      const { data: users, error } = await supabase.from('users').select('*').eq('email', email)
      if (error) throw error
      
      let userData
      if (users.length > 0) {
        // 用户存在
        userData = users[0]
      } else {
        // 用户不存在，创建新用户
        // 检查是否为管理员邮箱
        const role = email === '747227185@qq.com' ? 'admin' : 'user'
        const { data, error } = await supabase.from('users').insert({ email, role })
        if (error) throw error
        userData = { email, role }
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
      // 检查用户是否存在
      const { data: users, error } = await supabase.from('users').select('*').eq('email', email)
      if (error) throw error
      
      let userData
      if (users.length > 0) {
        // 用户存在
        userData = users[0]
      } else {
        // 用户不存在，创建新用户
        // 检查是否为管理员邮箱
        const role = email === '747227185@qq.com' ? 'admin' : 'user'
        const { data, error } = await supabase.from('users').insert({ email, role })
        if (error) throw error
        userData = { email, role }
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
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    // 检查URL参数
    const params = new URLSearchParams(location.search)
    const action = params.get('action')
    const id = params.get('id')

    if (action === 'edit' && id) {
      // 跳转到资产详情页
      navigate(`/asset/${id}`)
    }
  }, [location.search, navigate, isAuthenticated])

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

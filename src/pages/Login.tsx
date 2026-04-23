import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, pendingRedirect, setPendingRedirect } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isSignUp) {
        await signUp(email, password)
        alert('注册成功！')
        // 注册成功后，如果有待跳转页面，跳转到该页面
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      } else {
        await signIn(email, password)
        // 登录成功后，如果有待跳转页面，跳转到该页面
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      }
    } catch (err: any) {
      setError(err.message || (isSignUp ? '注册失败' : '登录失败'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isSignUp ? '注册账户' : '登录'}
        </h2>
        {pendingRedirect && (
          <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">
            请先登录以查看资产详情
          </div>
        )}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">密码</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : (isSignUp ? '注册' : '登录')}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-500 hover:underline"
            disabled={isLoading}
          >
            {isSignUp ? '已有账户？点击登录' : '没有账户？点击注册'}
          </button>
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              setPendingRedirect(null)
              navigate('/')
            }}
            className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-100"
            disabled={isLoading}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

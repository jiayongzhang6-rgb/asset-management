import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, resetPassword, pendingRedirect, setPendingRedirect } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [error, setError] = useState('')

  // 从 URL 参数中获取临时密码
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tempPassword = params.get('tempPassword')
    if (tempPassword) {
      setPassword(tempPassword)
      alert('这是您的临时密码，请登录后修改密码。')
    }
  }, [location.search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isForgotPassword) {
        await resetPassword(phone)
        setIsForgotPassword(false)
      } else if (isSignUp) {
        await signUp(phone, password)
        alert('注册成功！')
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      } else {
        await signIn(phone, password)
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      }
    } catch (err: any) {
      setError(err.message || (isSignUp ? '注册失败' : isForgotPassword ? '重置密码失败' : '登录失败'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isForgotPassword ? '忘记密码' : isSignUp ? '注册账户' : '登录'}
        </h2>
        {pendingRedirect && (
          <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">
            请先登录以查看资产详情
          </div>
        )}
        {isSignUp && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 font-medium">
              请使用手机号注册，需输入11位手机号码。
            </p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2">手机号</label>
            <input
              type="tel"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入11位手机号"
              value={phone}
              onChange={(e) => {
                // 只允许输入数字，最多11位
                const value = e.target.value.replace(/\D/g, '').slice(0, 11)
                setPhone(value)
              }}
              required
              disabled={isLoading}
              pattern="\d{11}"
              maxLength={11}
              minLength={11}
            />
          </div>
          {!isForgotPassword && (
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
          )}
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : isForgotPassword ? '发送重置链接' : (isSignUp ? '注册' : '登录')}
          </button>
        </form>
        {!isForgotPassword && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-500 hover:underline mr-4"
              disabled={isLoading}
            >
              {isSignUp ? '已有账户？点击登录' : '没有账户？点击注册'}
            </button>
            {!isSignUp && (
              <button
                onClick={() => setIsForgotPassword(true)}
                className="text-blue-500 hover:underline"
                disabled={isLoading}
              >
                忘记密码？
              </button>
            )}
          </div>
        )}
        {isForgotPassword && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsForgotPassword(false)}
              className="text-blue-500 hover:underline"
              disabled={isLoading}
            >
              返回登录
            </button>
          </div>
        )}
        {!isForgotPassword && !isSignUp && (
          <div className="mt-4 text-center text-sm text-gray-500">
            有问题请联系管理员
          </div>
        )}
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

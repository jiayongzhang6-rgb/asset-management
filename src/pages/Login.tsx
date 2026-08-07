import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'

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
      toast.success('这是您的临时密码，请登录后修改密码。', { duration: 6000 })
    }
  }, [location.search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isForgotPassword) {
        await resetPassword(phone)
        toast.success('重置密码链接已发送，请查收！')
        setIsForgotPassword(false)
      } else if (isSignUp) {
        await signUp(phone, password)
        toast.success('注册成功！')
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      } else {
        await signIn(phone, password)
        toast.success('登录成功！')
        if (pendingRedirect) {
          navigate(pendingRedirect)
          setPendingRedirect(null)
        } else {
          navigate('/')
        }
      }
    } catch (err: any) {
      const msg = err.message || (isSignUp ? '注册失败' : isForgotPassword ? '重置密码失败' : '登录失败')
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* 装饰性背景圆 */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-300/5 rounded-full blur-3xl pointer-events-none" />

      {/* 登录卡片 */}
      <div className="card w-full max-w-md p-8 fade-in relative z-10">
        {/* Logo & 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold gradient-text">德泽智联</h1>
          <p className="text-sm text-gray-400 mt-1">IT 资产管理系统</p>
        </div>

        {/* 模式标题 */}
        <h2 className="text-lg font-semibold text-center text-gray-700 mb-6">
          {isForgotPassword ? '找回密码' : isSignUp ? '创建账户' : '欢迎回来'}
        </h2>

        {/* 提示信息 */}
        {pendingRedirect && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            请先登录以查看资产详情
          </div>
        )}

        {isSignUp && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            请使用手机号注册，需输入11位手机号码。
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              {isSignUp ? '手机号' : '手机号 / 邮箱'}
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <input
                type={isSignUp ? "tel" : "text"}
                className="input pl-10"
                placeholder={isSignUp ? "请输入11位手机号" : "请输入手机号或邮箱"}
                value={phone}
                onChange={(e) => {
                  if (isSignUp) {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11)
                    setPhone(value)
                  } else {
                    setPhone(e.target.value)
                  }
                }}
                required
                disabled={isLoading}
                {...(isSignUp ? { pattern: "\\d{11}", maxLength: 11, minLength: 11 } : {})}
              />
            </div>
          </div>

          {!isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">密码</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  className="input pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full !py-2.5 !text-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner !w-4 !h-4 !border-2 !border-white/30 !border-t-white" />
                处理中...
              </span>
            ) : isForgotPassword ? '发送重置链接' : (isSignUp ? '注册' : '登录')}
          </button>
        </form>

        {/* 模式切换 */}
        <div className="mt-6 flex items-center justify-center gap-4">
          {!isForgotPassword && (
            <>
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="btn btn-ghost !text-xs"
                disabled={isLoading}
              >
                {isSignUp ? '← 已有账户？登录' : '没有账户？注册 →'}
              </button>
              {!isSignUp && (
                <button
                  onClick={() => setIsForgotPassword(true)}
                  className="btn btn-ghost !text-xs"
                  disabled={isLoading}
                >
                  忘记密码？
                </button>
              )}
            </>
          )}
          {isForgotPassword && (
            <button
              onClick={() => setIsForgotPassword(false)}
              className="btn btn-ghost !text-xs"
              disabled={isLoading}
            >
              ← 返回登录
            </button>
          )}
        </div>

        {/* 分隔线 */}
        {!isForgotPassword && !isSignUp && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400">其他操作</span>
              </div>
            </div>
            <div className="text-center text-xs text-gray-400 mb-3">有问题请联系管理员</div>
          </>
        )}

        <button
          onClick={() => {
            setPendingRedirect(null)
            navigate('/')
          }}
          className="btn btn-ghost w-full !text-xs !text-gray-400"
          disabled={isLoading}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          返回首页
        </button>
      </div>
    </div>
  )
}
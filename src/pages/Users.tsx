import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, formatUserIdentifier, type User } from '../lib/supabase'
import { deleteUserRpc, resetPasswordRpc, adminResetAuthPassword } from '../lib/authRpc'
import toast from 'react-hot-toast'

export default function Users() {
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role !== 'admin') {
        navigate('/')
      } else {
        fetchUsers()
      }
    } else {
      navigate('/login')
    }
  }, [isAuthenticated, user, navigate])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('确定要删除这个用户吗？')) {
      try {
        // 走 RPC（SECURITY DEFINER），绕过 RLS 的「禁止删除」策略
        const result = await deleteUserRpc(userId)
        if (!result.ok) throw new Error('用户删除失败')
        await fetchUsers()
        toast.success('用户删除成功')
      } catch (error) {
        console.error('Error deleting user:', error)
        toast.error('用户删除失败')
      }
    }
  }

  const handleResetPassword = async (userId: number, email: string) => {
    if (window.confirm('确定要为这个用户重置密码吗？')) {
      try {
        const tempPassword = Math.random().toString(36).substring(2, 10)

        // 优先走新 RPC（更新 auth.users 的加密密码，已迁移账号生效）
        const res = await adminResetAuthPassword(email, tempPassword)
        if (!res.ok) {
          // 回退旧 RPC（尚未迁移到 Supabase Auth 的账号）
          const r2 = await resetPasswordRpc(email, tempPassword)
          if (!r2.ok) throw new Error('密码重置失败')
        }

        toast(`密码重置成功！\n用户: ${formatUserIdentifier(email)}\n临时密码: ${tempPassword}`, { duration: 10000 })
      } catch (error) {
        console.error('Error resetting password:', error)
        toast.error('密码重置失败')
      }
    }
  }

  return (
    <div className="min-h-screen">
      <div className="watermark" />
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">德泽智联IT资产管理系统</h1>
              <p className="text-xs text-white/70">用户管理 · 权限控制</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{formatUserIdentifier(user?.email)}</span>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={() => navigate('/history')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              操作历史
            </button>
            <button onClick={() => navigate('/')} className="btn btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10 text-sm px-2 py-1.5">
              返回首页
            </button>
            <button onClick={signOut} className="btn btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10 text-sm px-2 py-1.5">
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">用户管理</h2>
                <p className="text-sm text-gray-500">管理系统中的所有用户账号</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                共 <span className="font-semibold text-blue-600">{users.length}</span> 个用户
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="spinner" />
              <span className="text-sm text-gray-500">加载用户列表...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-gray-400 text-sm">暂无用户数据</span>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="w-16">ID</th>
                    <th>账号</th>
                    <th>角色</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td>
                        <span className="text-sm font-mono text-gray-400">{userItem.id}</span>
                      </td>
                      <td>
                        <span className="text-sm font-medium text-gray-900">{formatUserIdentifier(userItem.email)}</span>
                      </td>
                      <td>
                        <span className={`badge ${userItem.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {userItem.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => handleResetPassword(userItem.id, userItem.email)}
                          className="btn btn-ghost text-blue-600 hover:text-blue-800 text-xs !px-2 !py-1"
                        >
                          重置密码
                        </button>
                        {userItem.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(userItem.id)}
                            className="btn btn-ghost text-red-500 hover:text-red-700 text-xs !px-2 !py-1"
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

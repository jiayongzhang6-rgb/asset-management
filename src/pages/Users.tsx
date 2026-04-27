import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function Users() {
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      // 只有管理员可以访问用户管理页面
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
      console.log('Users fetched:', data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (confirm('确定要删除这个用户吗？')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId)
        if (error) throw error
        // 重新获取用户列表
        await fetchUsers()
        alert('用户删除成功')
      } catch (error) {
        console.error('Error deleting user:', error)
        alert('用户删除失败')
      }
    }
  }

  const handleResetPassword = async (userId: number, email: string) => {
    if (confirm('确定要为这个用户重置密码吗？')) {
      try {
        // 生成一个临时密码
        const tempPassword = Math.random().toString(36).substring(2, 10)
        
        // 更新用户密码
        const { error } = await supabase
          .from('users')
          .update({ password: tempPassword })
          .eq('id', userId)
        if (error) throw error
        
        // 为了确保 Supabase Auth 中的密码也被更新，我们使用 signUp 方法
        try {
          const { error: authError } = await supabase.auth.signUp({
            email,
            password: tempPassword
          })
          
          if (authError) {
            console.log('Error updating Auth password:', authError)
          }
        } catch (authError) {
          console.log('Error with Auth:', authError)
        }
        
        // 提示管理员临时密码
        alert(`密码重置成功！\n用户邮箱: ${email}\n临时密码: ${tempPassword}\n请将临时密码告知用户。`)
      } catch (error) {
        console.error('Error resetting password:', error)
        alert('密码重置失败')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              返回
            </button>
            <h1 className="text-2xl font-bold">用户管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={() => navigate('/history')}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              操作历史
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">所有用户</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg">加载中...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无用户
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {userItem.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {userItem.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${userItem.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {userItem.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          onClick={() => handleResetPassword(userItem.id, userItem.email)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          重置密码
                        </button>
                        {userItem.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(userItem.id)}
                            className="text-red-600 hover:text-red-900"
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

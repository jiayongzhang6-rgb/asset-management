import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function OperationHistory() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory()
    }
  }, [isAuthenticated])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('operation_history').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching operation history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <h2 className="text-2xl font-bold text-center mb-4">需要登录</h2>
          <p className="text-gray-600 text-center mb-6">请登录后查看操作历史</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            去登录
          </button>
        </div>
      </div>
    )
  }

  // 权限控制：只有管理员可以查看操作历史
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <h2 className="text-2xl font-bold text-center mb-4">权限不足</h2>
          <p className="text-gray-600 text-center mb-6">只有管理员可以查看操作历史</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
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
            <h1 className="text-2xl font-bold">操作历史</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">操作历史记录</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.operation_type === 'create' && '创建'}
                      {item.operation_type === 'update' && '更新'}
                      {item.operation_type === 'delete' && '删除'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.asset_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.user_email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <button
                        onClick={() => {
                          alert(`操作详情：\n${JSON.stringify(item, null, 2)}`)
                        }}
                        className="text-blue-500 hover:underline"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无操作历史记录
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

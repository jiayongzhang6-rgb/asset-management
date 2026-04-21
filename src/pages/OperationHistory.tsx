import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function OperationHistory() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [history, setHistory] = useState<any[]>([])
  const [filteredHistory, setFilteredHistory] = useState<any[]>([])
  const [assetId, setAssetId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (assetId) {
      setFilteredHistory(history.filter(item => item.asset_id === parseInt(assetId)))
    } else {
      setFilteredHistory(history)
    }
  }, [assetId, history])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('operation_history').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setHistory(data || [])
      setFilteredHistory(data || [])
    } catch (error) {
      console.error('Error fetching operation history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOperationDetails = (item: any) => {
    if (item.operation_type === 'create') {
      return `创建了资产 ${item.asset_id}\n使用人: ${item.new_data.user_name}\n部门: ${item.new_data.department}\n位置: ${item.new_data.location}`
    } else if (item.operation_type === 'update') {
      let details = `更新了资产 ${item.asset_id}\n`
      if (item.old_data.user_name !== item.new_data.user_name) {
        details += `使用人: ${item.old_data.user_name} → ${item.new_data.user_name}\n`
      }
      if (item.old_data.department !== item.new_data.department) {
        details += `部门: ${item.old_data.department} → ${item.new_data.department}\n`
      }
      if (item.old_data.location !== item.new_data.location) {
        details += `位置: ${item.old_data.location} → ${item.new_data.location}\n`
      }
      return details
    } else if (item.operation_type === 'delete') {
      return `删除了资产 ${item.asset_id}\n使用人: ${item.old_data.user_name}\n部门: ${item.old_data.department}\n位置: ${item.old_data.location}`
    }
    return JSON.stringify(item, null, 2)
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
          
          {/* 筛选功能 */}
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">按资产ID筛选</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="输入资产ID"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setAssetId('')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                清除
              </button>
            </div>
          </div>
          
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
                {filteredHistory.map((item) => (
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
                          alert(getOperationDetails(item))
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
          {filteredHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无操作历史记录
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

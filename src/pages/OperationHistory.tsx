import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

export default function OperationHistory() {
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut } = useAuth()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assetCodeFilter, setAssetCodeFilter] = useState('')
  const [filteredHistory, setFilteredHistory] = useState<any[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory()
    } else {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (assetCodeFilter) {
      setFilteredHistory(history.filter(item => item.asset_code.includes(assetCodeFilter)))
    } else {
      setFilteredHistory(history)
    }
  }, [assetCodeFilter, history])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('operation_history')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setHistory(data || [])
      setFilteredHistory(data || [])
      console.log('Operation history fetched:', data)
    } catch (error) {
      console.error('Error fetching operation history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOperationDetails = (item: any) => {
    if (item.operation_type === 'create') {
      return `创建了资产\n资产编码: ${item.asset_code}\n操作人: ${item.user_email}\n时间: ${new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
    } else if (item.operation_type === 'update') {
      return `更新了资产\n资产编码: ${item.asset_code}\n操作人: ${item.user_email}\n时间: ${new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n变更内容: ${item.changes || '无'}`
    } else if (item.operation_type === 'delete') {
      return `删除了资产\n资产编码: ${item.asset_code}\n操作人: ${item.user_email}\n时间: ${new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
    }
    return JSON.stringify(item, null, 2)
  }

  const viewAsset = async (assetCode: string) => {
    try {
      navigate(`/asset/${assetCode}`)
    } catch (error) {
      console.error('Error viewing asset:', error)
    }
  }

  const handleDeleteHistory = async (historyId: string) => {
    if (confirm('确定要删除这条操作历史记录吗？')) {
      try {
        const { error } = await supabase.from('operation_history').delete().eq('id', historyId)
        if (error) throw error
        await fetchHistory()
        alert('操作历史记录删除成功')
      } catch (error) {
        console.error('Error deleting operation history:', error)
        alert('操作历史记录删除失败')
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
            <h1 className="text-2xl font-bold">操作历史记录</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{user?.email}</span>
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/users')}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                用户管理
              </button>
            )}
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold">所有操作历史</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="按资产编码筛选"
                className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={assetCodeFilter}
                onChange={(e) => setAssetCodeFilter(e.target.value)}
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg">加载中...</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无操作历史记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产编码</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.asset_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.operation_type === 'create' && '创建'}
                        {item.operation_type === 'update' && '更新'}
                        {item.operation_type === 'delete' && '删除'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.user_email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <button
                          onClick={() => alert(getOperationDetails(item))}
                          className="text-blue-500 hover:underline"
                        >
                          查看详情
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium flex gap-2">
                        <button
                          onClick={() => viewAsset(item.asset_code)}
                          className="text-green-600 hover:text-green-900"
                        >
                          查看资产
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
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

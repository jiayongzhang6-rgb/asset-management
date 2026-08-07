import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, formatUserIdentifier, getBeijingTime, getOperationTypeText, getOperationTypeColor, type OperationHistoryRecord } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function OperationHistory() {
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut } = useAuth()
  const [history, setHistory] = useState<OperationHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [assetCodeFilter, setAssetCodeFilter] = useState('')
  const [filteredHistory, setFilteredHistory] = useState<OperationHistoryRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
    setSelectedIds([])
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
    } catch (error) {
      console.error('Error fetching operation history:', error)
      toast.error('获取操作历史失败')
    } finally {
      setLoading(false)
    }
  }

  const getOperationDetails = (item: OperationHistoryRecord) => {
    const beijingTime = getBeijingTime(item.created_at)
    
    if (item.operation_type === 'create') {
      return `创建了资产\n资产编码: ${item.asset_code}\n操作人: ${formatUserIdentifier(item.user_email)}\n时间: ${beijingTime}`
    } else if (item.operation_type === 'update') {
      return `更新了资产\n资产编码: ${item.asset_code}\n操作人: ${formatUserIdentifier(item.user_email)}\n时间: ${beijingTime}\n变更内容: ${item.changes || '无'}`
    } else if (item.operation_type === 'delete') {
      return `删除了资产\n资产编码: ${item.asset_code}\n操作人: ${formatUserIdentifier(item.user_email)}\n时间: ${beijingTime}`
    }
    return JSON.stringify(item, null, 2)
  }

  const viewAsset = (assetCode: string) => {
    navigate(`/asset/${assetCode}`)
  }

  const handleDeleteHistory = async (historyId: string) => {
    if (window.confirm('确定要删除这条操作历史记录吗？')) {
      try {
        const { error } = await supabase.from('operation_history').delete().eq('id', historyId)
        if (error) throw error
        await fetchHistory()
        toast.success('操作历史记录删除成功')
      } catch (error) {
        console.error('Error deleting operation history:', error)
        toast.error('操作历史记录删除失败')
      }
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredHistory.map(item => String(item.id)))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string | number, checked: boolean) => {
    const idStr = String(id)
    if (checked) {
      setSelectedIds([...selectedIds, idStr])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== idStr))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要删除的操作历史记录')
      return
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 条操作历史记录吗？`)) {
      try {
        const { error } = await supabase.from('operation_history').delete().in('id', selectedIds)
        if (error) throw error
        await fetchHistory()
        setSelectedIds([])
        toast.success('操作历史记录批量删除成功')
      } catch (error) {
        console.error('Error batch deleting operation history:', error)
        toast.error('操作历史记录批量删除失败')
      }
    }
  }

  return (
    <div className="min-h-screen">
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn btn-ghost !text-white !border-white/20 hover:!bg-white/10 text-sm px-3 py-1.5 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回
            </button>
            <div className="w-px h-6 bg-white/20" />
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">操作历史记录</h1>
              <p className="text-xs text-white/70">系统操作日志 · 审计追踪</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{formatUserIdentifier(user?.email)}</span>
            <div className="w-px h-6 bg-white/20 mx-1" />
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/users')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
                用户管理
              </button>
            )}
            <button onClick={() => navigate('/change-password')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              修改密码
            </button>
            <button onClick={signOut} className="btn btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10 text-sm px-2 py-1.5">
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">所有操作历史</h2>
              {filteredHistory.length > 0 && (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                  共 {filteredHistory.length} 条
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'admin' && selectedIds.length > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="btn btn-danger text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  批量删除 ({selectedIds.length})
                </button>
              )}
              <div className="search-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="按资产编码搜索..."
                  className="!pl-9"
                  value={assetCodeFilter}
                  onChange={(e) => setAssetCodeFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="spinner" />
              <span className="text-gray-500 text-sm">加载操作历史中...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-400 text-base">暂无操作历史记录</span>
              <span className="text-gray-300 text-xs">系统将自动记录资产的操作行为</span>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {user?.role === 'admin' && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={filteredHistory.length > 0 && selectedIds.length === filteredHistory.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                      </th>
                    )}
                    <th>时间</th>
                    <th>资产编码</th>
                    <th>操作类型</th>
                    <th>操作人</th>
                    <th>详情</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      {user?.role === 'admin' && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(String(item.id))}
                            onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                        </td>
                      )}
                      <td>
                        <span className="text-sm text-gray-600 whitespace-nowrap">{getBeijingTime(item.created_at)}</span>
                      </td>
                      <td>
                        <span className="text-sm font-medium text-blue-600">{item.asset_code}</span>
                      </td>
                      <td>
                        <span className={`badge text-xs font-semibold ${getOperationTypeColor(item.operation_type)}`}>
                          {getOperationTypeText(item.operation_type)}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-gray-700">{formatUserIdentifier(item.user_email)}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => toast(getOperationDetails(item), { duration: 8000 })}
                          className="btn btn-ghost text-blue-600 hover:text-blue-800 text-xs !px-2 !py-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          查看详情
                        </button>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => viewAsset(item.asset_code)}
                          className="btn btn-ghost text-gray-600 hover:text-gray-800 text-xs !px-2 !py-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          查看资产
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
                            className="btn btn-ghost text-red-500 hover:text-red-700 text-xs !px-2 !py-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
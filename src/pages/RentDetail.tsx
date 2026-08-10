import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import {
  supabase,
  type RentRecord,
  type DepartmentRentStat,
  formatUserIdentifier,
  updateAssetRent,
  getDepartmentRentStats
} from '../lib/supabase'
import toast from 'react-hot-toast'

export default function RentDetail() {
  const { user } = useAuth()
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [departments, setDepartments] = useState<string[]>([])

  // 部门实时统计
  const [deptStats, setDeptStats] = useState<DepartmentRentStat[]>([])
  const [deptStatsLoading, setDeptStatsLoading] = useState(false)

  // 内联编辑租金
  const [editingAsset, setEditingAsset] = useState<RentRecord | null>(null)
  const [editingRentValue, setEditingRentValue] = useState<string>('')
  const [savingRent, setSavingRent] = useState(false)

  const isAdmin = user?.role === 'admin'
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const fetchDepartments = async () => {
    try {
      const { data } = await supabase
        .from('assets')
        .select('department')
        .not('department', 'is', null)
        .not('department', 'eq', '')
      const uniqueDepartments = [...new Set((data || []).map(a => a.department))].filter(d => d)
      setDepartments(uniqueDepartments)
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchRentRecords = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('rent_records')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)

      if (departmentFilter !== 'all') {
        query = query.eq('department', departmentFilter)
      }

      const { data, error } = await query.order('department').order('asset_code')
      if (error) throw error

      // 获取最新资产数据，实现月租实时显示
      if (data && data.length > 0) {
        const assetCodes = [...new Set(data.map(r => r.asset_code))]
        const { data: assetsData, error: assetsError } = await supabase
          .from('assets')
          .select('asset_code, monthly_rent, department, user_name')
          .in('asset_code', assetCodes)

        if (assetsError) throw assetsError

        const assetMap = new Map((assetsData || []).map(a => [a.asset_code, a]))

        const updatedRecords = data.map(record => {
          const latestAsset = assetMap.get(record.asset_code)
          if (latestAsset) {
            return {
              ...record,
              monthly_rent: latestAsset.monthly_rent ?? record.monthly_rent,
              department: latestAsset.department ?? record.department,
              user_name: latestAsset.user_name ?? record.user_name
            }
          }
          return record
        })

        setRentRecords(updatedRecords)
      } else {
        setRentRecords([])
      }
    } catch (error) {
      console.error('Error fetching rent records:', error)
      toast.error('获取月租记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchDeptStats = async () => {
    setDeptStatsLoading(true)
    try {
      const stats = await getDepartmentRentStats()
      setDeptStats(stats)
    } catch (error) {
      console.error('Error fetching department rent stats:', error)
    } finally {
      setDeptStatsLoading(false)
    }
  }

  const markAsPaid = async (recordId: number) => {
    if (!isAdmin) return
    try {
      const { error } = await supabase
        .from('rent_records')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString()
        })
        .eq('id', recordId)
      if (error) throw error
      toast.success('已标记为已缴')
      fetchRentRecords()
    } catch (error) {
      console.error('Error marking as paid:', error)
      toast.error('操作失败')
    }
  }

  const markAsUnpaid = async (recordId: number) => {
    if (!isAdmin) return
    try {
      const { error } = await supabase
        .from('rent_records')
        .update({
          status: 'unpaid',
          paid_date: null
        })
        .eq('id', recordId)
      if (error) throw error
      toast.success('已标记为未缴')
      fetchRentRecords()
    } catch (error) {
      console.error('Error marking as unpaid:', error)
      toast.error('操作失败')
    }
  }

  const generateMonthlyRecords = async () => {
    if (!isAdmin) {
      toast.error('只有管理员可以生成月租记录')
      return
    }

    if (!window.confirm(`确定要生成 ${selectedYear}年${selectedMonth}月 的月租记录吗？`)) return

    try {
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('id, asset_code, department, user_name, monthly_rent')
        .neq('monthly_rent', 0)

      if (assetsError) throw assetsError

      const { data: existingRecords, error: existingError } = await supabase
        .from('rent_records')
        .select('asset_code')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)

      if (existingError) throw existingError

      const existingCodes = new Set((existingRecords || []).map(r => r.asset_code))
      const newRecords = assets
        .filter(a => !existingCodes.has(a.asset_code))
        .map(a => ({
          asset_code: a.asset_code,
          asset_id: a.id,
          department: a.department,
          user_name: a.user_name,
          monthly_rent: Number(a.monthly_rent),
          year: selectedYear,
          month: selectedMonth,
          status: 'unpaid' as const,
          paid_date: null
        }))

      if (newRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('rent_records')
          .insert(newRecords)
        if (insertError) throw insertError
      }

      toast.success(`成功生成 ${newRecords.length} 条月租记录`)
      fetchRentRecords()
      fetchDeptStats()
    } catch (error) {
      console.error('Error generating rent records:', error)
      toast.error('生成月租记录失败')
    }
  }

  const exportToCSV = () => {
    const headers = ['资产编码', '部门', '使用人', '月租费', '状态', '缴费日期']
    const csvContent = [
      headers.join(','),
      ...rentRecords.map(r => [
        r.asset_code,
        r.department || '',
        r.user_name || '',
        r.monthly_rent,
        r.status === 'paid' ? '已缴' : '未缴',
        r.paid_date ? new Date(r.paid_date).toLocaleDateString() : ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `月租明细_${selectedYear}年${selectedMonth}月.csv`
    link.click()
  }

  // 打开内联编辑租金框
  const openRentEditor = (record: RentRecord) => {
    if (!isAdmin) return
    setEditingAsset(record)
    setEditingRentValue(String(record.monthly_rent ?? ''))
  }

  // 保存租金修改
  const saveRentEdit = async () => {
    if (!editingAsset || !user?.email) return

    const newRent = parseFloat(editingRentValue)
    if (isNaN(newRent) || newRent < 0) {
      toast.error('请输入有效的月租金额')
      return
    }

    const oldRent = Number(editingAsset.monthly_rent) || 0
    if (newRent === oldRent) {
      toast('租金未发生变化', { icon: 'ℹ️' })
      setEditingAsset(null)
      return
    }

    setSavingRent(true)
    try {
      const result = await updateAssetRent(editingAsset.asset_code, newRent, user.email)
      if (result.success) {
        toast.success(result.message)
        setEditingAsset(null)
        // 刷新月租记录 & 部门统计
        fetchRentRecords()
        fetchDeptStats()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Error updating asset rent:', error)
      toast.error('修改租金失败')
    } finally {
      setSavingRent(false)
    }
  }

  const cancelRentEdit = () => {
    setEditingAsset(null)
    setEditingRentValue('')
  }

  useEffect(() => {
    fetchDepartments()
    fetchDeptStats()
  }, [])

  useEffect(() => {
    fetchRentRecords()
  }, [selectedYear, selectedMonth, departmentFilter])

  const totalRent = rentRecords.reduce((sum, r) => sum + Number(r.monthly_rent), 0)
  const paidRent = rentRecords.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.monthly_rent), 0)
  const unpaidRent = totalRent - paidRent

  // 部门统计汇总
  const totalDeptAssets = deptStats.reduce((sum, d) => sum + d.assetCount, 0)
  const totalDeptRent = deptStats.reduce((sum, d) => sum + d.totalRent, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">德泽智联IT资产管理系统</h1>
              <p className="text-xs text-white/70">租赁费用明细 · 租金统计与管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{formatUserIdentifier(user?.email)}</span>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <span className="btn btn-ghost !text-white/80 !cursor-default text-sm px-2 py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              月租明细
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        {/* 筛选/控制区域 */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">查询条件</h2>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">年份</span>
                <select
                  className="w-auto text-sm min-w-[100px]"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}年</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">月份</span>
                <select
                  className="w-auto text-sm min-w-[90px]"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map(month => (
                    <option key={month} value={month}>{month}月</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">部门</span>
                <select
                  className="w-auto text-sm min-w-[120px]"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="all">全部部门</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="w-px h-8 bg-gray-200 mx-1" />
              {isAdmin && (
                <button
                  onClick={generateMonthlyRecords}
                  className="btn btn-success text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  生成月租记录
                </button>
              )}
              <button
                onClick={exportToCSV}
                className="btn btn-primary text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出CSV
              </button>
            </div>
          </div>
        </div>

        {/* 按部门统计面板 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">部门租金统计</h2>
              <span className="text-xs text-gray-400">实时数据</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>共 <span className="font-semibold text-gray-700">{deptStats.length}</span> 个部门</span>
              <span>资产 <span className="font-semibold text-gray-700">{totalDeptAssets}</span> 台</span>
              <span>月租合计 <span className="font-semibold text-indigo-600">¥{totalDeptRent.toFixed(2)}</span></span>
              <button
                onClick={fetchDeptStats}
                className="btn btn-ghost text-xs !px-2 !py-1"
                title="刷新部门统计"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                刷新
              </button>
            </div>
          </div>

          {deptStatsLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="spinner" />
              <span className="text-gray-500 text-sm">加载部门统计数据...</span>
            </div>
          ) : deptStats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              <span className="text-gray-400 text-sm">暂无部门统计数据</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {deptStats.map(stat => (
                <div
                  key={stat.department}
                  className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-4 hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate" title={stat.department}>
                        {stat.department}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stat.assetCount} 台资产
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">月租小计</span>
                    <span className="text-lg font-bold text-indigo-600">
                      ¥{Number(stat.totalRent).toFixed(2)}
                    </span>
                  </div>
                  {stat.assetCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                      均价 ¥{(Number(stat.totalRent) / stat.assetCount).toFixed(2)}/台
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 汇总统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">本月租金总额</p>
                <p className="text-2xl font-bold text-blue-600">¥{totalRent.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-green-50 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">已收取</p>
                <p className="text-2xl font-bold text-green-600">¥{paidRent.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-yellow-50 text-yellow-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">待收取</p>
                <p className="text-2xl font-bold text-yellow-600">¥{unpaidRent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 月租记录表格 */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>资产编码</th>
                <th>部门</th>
                <th>使用人</th>
                <th className="text-right">月租费</th>
                <th>状态</th>
                <th>缴费日期</th>
                {isAdmin && <th className="text-center">操作</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="spinner" />
                      <span className="text-gray-500 text-sm">加载中...</span>
                    </div>
                  </td>
                </tr>
              ) : rentRecords.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-gray-400 text-sm">暂无月租记录</span>
                      <span className="text-gray-300 text-xs">请选择查询条件或点击「生成月租记录」</span>
                    </div>
                  </td>
                </tr>
              ) : (
                rentRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td>
                      <span className="text-sm font-medium text-blue-600">{record.asset_code}</span>
                    </td>
                    <td>
                      <span className="text-sm">{record.department}</span>
                    </td>
                    <td>
                      <span className="text-sm font-medium">{formatUserIdentifier(record.user_name)}</span>
                    </td>
                    <td className="text-right">
                      {isAdmin ? (
                        <button
                          onClick={() => openRentEditor(record)}
                          className="group inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          title="点击修改月租费"
                        >
                          <span>¥{record.monthly_rent}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-blue-600">¥{record.monthly_rent}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${record.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${record.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        {record.status === 'paid' ? '已缴' : '未缴'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-500">
                        {record.paid_date ? new Date(record.paid_date).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-center">
                        {record.status === 'unpaid' ? (
                          <button
                            onClick={() => markAsPaid(record.id)}
                            className="btn btn-success text-xs !px-3 !py-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            标记已缴
                          </button>
                        ) : (
                          <button
                            onClick={() => markAsUnpaid(record.id)}
                            className="btn btn-ghost text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 text-xs !px-3 !py-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            标记未缴
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && rentRecords.length > 0 && (
          <div className="mt-4 text-sm text-gray-400 text-center">
            共 {rentRecords.length} 条记录
            {isAdmin && <span className="ml-2 text-gray-300">· 点击月租费可快速修改</span>}
          </div>
        )}
      </main>

      {/* 内联编辑租金弹窗 */}
      {editingAsset && (
        <div className="modal-overlay" onClick={cancelRentEdit}>
          <div
            className="modal-content"
            style={{ maxWidth: '28rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">修改月租费</h3>
                <p className="text-xs text-gray-500">将同时更新资产台账与当月租赁记录</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">资产编码</p>
                  <p className="font-medium text-blue-600 truncate">{editingAsset.asset_code}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">部门</p>
                  <p className="font-medium text-gray-700 truncate">{editingAsset.department || '-'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">使用人</p>
                  <p className="font-medium text-gray-700 truncate">
                    {formatUserIdentifier(editingAsset.user_name) || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">当前月租</p>
                  <p className="font-semibold text-gray-700">¥{editingAsset.monthly_rent}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  新月租金额（元）
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={editingRentValue}
                    onChange={(e) => setEditingRentValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRentEdit()
                      if (e.key === 'Escape') cancelRentEdit()
                    }}
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="请输入新月租金额"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  按 Enter 保存 · 按 Esc 取消
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={cancelRentEdit}
                disabled={savingRent}
                className="btn btn-ghost text-sm"
              >
                取消
              </button>
              <button
                onClick={saveRentEdit}
                disabled={savingRent}
                className="btn btn-primary text-sm"
              >
                {savingRent ? (
                  <>
                    <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                    保存中...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    保存修改
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

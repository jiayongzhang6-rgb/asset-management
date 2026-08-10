import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import {
  supabase,
  type RentRecord,
  type DepartmentRentStat,
  formatUserIdentifier,
  generateMonthlySettlement,
  getDepartmentRentStats
} from '../lib/supabase'

export default function RentSettlement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [deptStats, setDeptStats] = useState<DepartmentRentStat[]>([])
  const [settlementRecords, setSettlementRecords] = useState<RentRecord[]>([])
  const [assetInfoMap, setAssetInfoMap] = useState<Record<string, { brand: string; model: string }>>({})
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingSettlement, setLoadingSettlement] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({})
  const [hasFetchedSettlement, setHasFetchedSettlement] = useState(false)

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 获取实时部门租金概览（页面加载时）
  const fetchDeptStats = async () => {
    setLoadingStats(true)
    try {
      const stats = await getDepartmentRentStats()
      setDeptStats(stats)
    } catch (e) {
      console.error('fetchDeptStats error:', e)
    } finally {
      setLoadingStats(false)
    }
  }

  // 查询指定年月的结算单数据，并补充品牌型号信息
  const fetchSettlement = async () => {
    setLoadingSettlement(true)
    try {
      const { data, error } = await supabase
        .from('rent_records')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('department')

      if (error) throw error

      const records = (data || []) as RentRecord[]
      setSettlementRecords(records)

      // 结算单不含品牌型号，从 assets 表补充
      if (records.length > 0) {
        const codes = [...new Set(records.map(r => r.asset_code))]
        const { data: assets, error: assetErr } = await supabase
          .from('assets')
          .select('asset_code, brand, model')
          .in('asset_code', codes)

        if (!assetErr && assets) {
          const map: Record<string, { brand: string; model: string }> = {}
          for (const a of assets) {
            map[a.asset_code] = { brand: a.brand || '', model: a.model || '' }
          }
          setAssetInfoMap(map)
        } else {
          setAssetInfoMap({})
        }
      } else {
        setAssetInfoMap({})
      }

      setHasFetchedSettlement(true)
    } catch (e: any) {
      console.error('fetchSettlement error:', e)
      toast.error('获取结算单数据失败')
    } finally {
      setLoadingSettlement(false)
    }
  }

  // 一键生成月度结算单
  const handleGenerate = async () => {
    if (!isAdmin) {
      toast.error('只有管理员可以生成结算单')
      return
    }
    if (!user?.email) {
      toast.error('无法获取用户信息')
      return
    }
    if (!window.confirm(`确定要生成 ${selectedYear}年${selectedMonth}月 的租赁结算单吗？`)) return

    setGenerating(true)
    try {
      const result = await generateMonthlySettlement(selectedYear, selectedMonth, user.email)
      if (result.success) {
        toast.success(result.message)
        await fetchSettlement()
        await fetchDeptStats()
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      console.error('handleGenerate error:', e)
      toast.error('生成结算单失败')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchDeptStats()
  }, [])

  useEffect(() => {
    fetchSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  // 按部门分组
  const groupedRecords: [string, RentRecord[]][] = (() => {
    const map = new Map<string, RentRecord[]>()
    for (const r of settlementRecords) {
      const dept = r.department || '未分配'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(r)
    }
    return Array.from(map.entries())
  })()

  const totalRent = settlementRecords.reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0)
  const paidRent = settlementRecords
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0)
  const unpaidRent = totalRent - paidRent

  // 实时概览汇总
  const realtimeDeptCount = deptStats.length
  const realtimeAssetCount = deptStats.reduce((sum, d) => sum + d.assetCount, 0)
  const realtimeTotalRent = deptStats.reduce((sum, d) => sum + d.totalRent, 0)

  const toggleDept = (dept: string) => {
    setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))
  }

  const expandAll = () => setCollapsedDepts({})
  const collapseAll = () => {
    const next: Record<string, boolean> = {}
    for (const [dept] of groupedRecords) next[dept] = true
    setCollapsedDepts(next)
  }

  // 导出 CSV（按部门分块，每个部门独立表头）
  const exportToCSV = () => {
    if (groupedRecords.length === 0) {
      toast.error('暂无可导出的结算数据')
      return
    }

    const lines: string[] = []
    lines.push(`月度租赁结算单,${selectedYear}年${selectedMonth}月`)
    lines.push(`生成时间,${new Date().toLocaleString('zh-CN')}`)
    lines.push('')

    let grandTotal = 0
    for (const [dept, records] of groupedRecords) {
      lines.push(`【部门】${dept}`)
      lines.push(['资产编码', '品牌型号', '使用人', '月租费', '状态'].join(','))
      let deptTotal = 0
      for (const r of records) {
        const info = assetInfoMap[r.asset_code]
        const brandModel = info ? `${info.brand} ${info.model}`.trim() : ''
        const rent = Number(r.monthly_rent) || 0
        deptTotal += rent
        lines.push(
          [r.asset_code, brandModel, r.user_name || '', rent.toFixed(2), r.status === 'paid' ? '已缴' : '未缴']
            .map(f => `"${String(f).replace(/"/g, '""')}"`)
            .join(',')
        )
      }
      lines.push(`"小计","","","${deptTotal.toFixed(2)}",""`)
      lines.push('')
      grandTotal += deptTotal
    }
    lines.push(`"总计","","","${grandTotal.toFixed(2)}",""`)

    const csv = lines.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `月度租赁结算单_${selectedYear}年${selectedMonth}月.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('CSV 已导出')
  }

  const handlePrint = () => {
    if (groupedRecords.length === 0) {
      toast.error('暂无可打印的结算数据')
      return
    }
    window.print()
  }

  const formatBrandModel = (code: string) => {
    const info = assetInfoMap[code]
    if (!info) return '-'
    return `${info.brand} ${info.model}`.trim() || '-'
  }

  return (
    <div className="min-h-screen">
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              title="返回首页"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">德泽智联IT资产管理系统</h1>
              <p className="text-xs text-white/70">月度租赁结算单 · 按部门生成</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 hidden sm:inline">{formatUserIdentifier(user?.email)}</span>
            {isAdmin && (
              <span className="badge bg-white/20 text-white">{user?.role === 'admin' ? '管理员' : '普通用户'}</span>
            )}
            <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />
            <button
              onClick={() => navigate('/')}
              className="btn btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10 text-sm px-3 py-1.5"
            >
              返回首页
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        {/* 控制区：年月选择 + 操作按钮 */}
        <div className="card mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">结算期间</h2>
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
              <div className="w-px h-8 bg-gray-200 mx-1" />
              {isAdmin ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn btn-success text-sm"
                >
                  {generating ? (
                    <>
                      <div className="spinner !w-4 !h-4 !border-2" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      一键生成结算单
                    </>
                  )}
                </button>
              ) : (
                <span className="badge bg-gray-100 text-gray-500">只读模式（仅管理员可生成）</span>
              )}
              <button
                onClick={fetchSettlement}
                disabled={loadingSettlement}
                className="btn btn-secondary text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                刷新
              </button>
              <button
                onClick={exportToCSV}
                disabled={settlementRecords.length === 0}
                className="btn btn-primary text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出 CSV
              </button>
              <button
                onClick={handlePrint}
                disabled={settlementRecords.length === 0}
                className="btn btn-ghost text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                打印
              </button>
            </div>
          </div>
        </div>

        {/* 汇总统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">结算部门数</p>
                <p className="text-2xl font-bold text-blue-600">{groupedRecords.length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">结算资产数</p>
                <p className="text-2xl font-bold text-indigo-600">{settlementRecords.length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-green-50 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">已缴金额</p>
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
                <p className="text-xs text-gray-500 font-medium">未缴金额</p>
                <p className="text-2xl font-bold text-yellow-600">¥{unpaidRent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 实时部门租金概览（来自 getDepartmentRentStats） */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">实时部门租金概览</h2>
              <span className="text-xs text-gray-400">（基于当前在用资产，非结算快照）</span>
            </div>
            <div className="text-sm text-gray-500">
              共 <span className="font-bold text-gray-700">{realtimeDeptCount}</span> 个部门 ·
              <span className="font-bold text-gray-700"> {realtimeAssetCount}</span> 台资产 ·
              当月租金 <span className="font-bold text-purple-600">¥{realtimeTotalRent.toFixed(2)}</span>
            </div>
          </div>
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner" />
            </div>
          ) : deptStats.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">暂无资产数据</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deptStats.map(d => (
                <div key={d.department} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{d.department}</p>
                    <p className="text-xs text-gray-500">{d.assetCount} 台资产</p>
                  </div>
                  <p className="text-sm font-bold text-purple-600 ml-2">¥{d.totalRent.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 按部门展示结算单 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedYear}年{selectedMonth}月 结算单明细
            </h2>
            {groupedRecords.length > 0 && (
              <span className="badge bg-blue-100 text-blue-700">{groupedRecords.length} 个部门</span>
            )}
          </div>
          {groupedRecords.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className="btn btn-ghost text-xs !px-2 !py-1">全部展开</button>
              <button onClick={collapseAll} className="btn btn-ghost text-xs !px-2 !py-1">全部折叠</button>
            </div>
          )}
        </div>

        {loadingSettlement ? (
          <div className="card flex flex-col items-center justify-center py-16 gap-3">
            <div className="spinner" />
            <span className="text-gray-500 text-sm">加载结算单数据...</span>
          </div>
        ) : groupedRecords.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-gray-500">{selectedYear}年{selectedMonth}月 暂无结算单数据</span>
            {hasFetchedSettlement && (
              <span className="text-gray-400 text-sm">
                {isAdmin ? '请点击「一键生成结算单」生成当月数据' : '请联系管理员生成当月结算单'}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRecords.map(([dept, records]) => {
              const deptTotal = records.reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0)
              const collapsed = collapsedDepts[dept]
              return (
                <div key={dept} className="card !p-0 overflow-hidden">
                  {/* 部门卡片头部 */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleDept(dept)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{dept}</h3>
                        <p className="text-xs text-gray-500">{records.length} 台资产</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">部门小计</p>
                        <p className="text-lg font-bold text-blue-600">¥{deptTotal.toFixed(2)}</p>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 部门资产明细表格 */}
                  {!collapsed && (
                    <div className="table-container !rounded-none !border-0 !border-t border-gray-100">
                      <table>
                        <thead>
                          <tr>
                            <th>资产编码</th>
                            <th>品牌型号</th>
                            <th>使用人</th>
                            <th className="text-right">月租费</th>
                            <th>状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map(r => (
                            <tr key={r.id}>
                              <td>
                                <span className="text-sm font-medium text-blue-600">{r.asset_code}</span>
                              </td>
                              <td>
                                <span className="text-sm text-gray-700">{formatBrandModel(r.asset_code)}</span>
                              </td>
                              <td>
                                <span className="text-sm font-medium">{formatUserIdentifier(r.user_name)}</span>
                              </td>
                              <td className="text-right">
                                <span className="text-sm font-semibold text-blue-600">¥{(Number(r.monthly_rent) || 0).toFixed(2)}</span>
                              </td>
                              <td>
                                <span className={`badge ${r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${r.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                  {r.status === 'paid' ? '已缴' : '未缴'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-blue-50/50">
                            <td colSpan={3} className="text-right font-semibold text-gray-700">部门小计</td>
                            <td className="text-right">
                              <span className="text-sm font-bold text-blue-600">¥{deptTotal.toFixed(2)}</span>
                            </td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}

            {/* 总计汇总 */}
            <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 !border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">总计汇总</p>
                    <p className="text-xs text-gray-500">{selectedYear}年{selectedMonth}月 · 所有部门合计</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">总租金</p>
                  <p className="text-2xl font-bold text-blue-700">¥{totalRent.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

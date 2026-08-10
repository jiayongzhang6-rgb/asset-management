import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import {
  supabase,
  type RentRecord,
  formatUserIdentifier,
  generateMonthlySettlement,
  deleteMonthlySettlement,
  getDepartmentRentStats,
  formatHardwareSpec,
  estimateAssetValue
} from '../lib/supabase'

// 合并了 assets 硬件信息后的结算记录类型
type MergedRentRecord = RentRecord & {
  cpu?: string
  ram?: string
  storage?: string
  gpu?: string
  brand?: string
  model?: string
  created_at?: string
}

export default function RentSettlement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [settlementRecords, setSettlementRecords] = useState<MergedRentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({})

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 查询指定年月的结算单数据，并补充 assets 表的完整硬件信息
  const fetchSettlement = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rent_records')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('department')

      if (error) throw error

      const records = (data || []) as RentRecord[]

      // 合并 assets 表的完整硬件信息（用于 formatHardwareSpec 和 estimateAssetValue）
      let merged: MergedRentRecord[] = records
      if (records.length > 0) {
        const assetCodes = [...new Set(records.map(r => r.asset_code))]
        const { data: assetsData, error: assetErr } = await supabase
          .from('assets')
          .select('*')
          .in('asset_code', assetCodes)

        if (!assetErr && assetsData) {
          const assetMap = new Map<string, any>()
          for (const a of assetsData) {
            assetMap.set(a.asset_code, a)
          }
          merged = records.map(r => {
            const a = assetMap.get(r.asset_code)
            return {
              ...r,
              cpu: a?.cpu,
              ram: a?.ram,
              storage: a?.storage,
              gpu: a?.gpu,
              brand: a?.brand,
              model: a?.model,
              created_at: a?.created_at || r.created_at
            }
          })
        }
      }

      setSettlementRecords(merged)
    } catch (e: any) {
      console.error('fetchSettlement error:', e)
      toast.error('获取结算单数据失败')
      setSettlementRecords([])
    } finally {
      setLoading(false)
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

  // 取消结算（删除当月结算单，需二次确认）
  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error('只有管理员可以取消结算')
      return
    }
    if (!user?.email) {
      toast.error('无法获取用户信息')
      return
    }
    if (settlementRecords.length === 0) {
      toast.error(`${selectedYear}年${selectedMonth}月 暂无结算单数据`)
      return
    }
    const firstConfirm = window.confirm(
      `确定要取消 ${selectedYear}年${selectedMonth}月 的结算吗？\n当前共 ${settlementRecords.length} 条记录将被删除。`
    )
    if (!firstConfirm) return
    if (!window.confirm(`再次确认：删除后无法恢复，是否继续？`)) return

    setDeleting(true)
    try {
      const result = await deleteMonthlySettlement(selectedYear, selectedMonth, user.email)
      if (result.success) {
        toast.success(result.message)
        setSettlementRecords([])
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      console.error('handleDelete error:', e)
      toast.error('取消结算失败')
    } finally {
      setDeleting(false)
    }
  }

  // 数据流：页面加载时调用 getDepartmentRentStats() 获取实时部门租金概览
  useEffect(() => {
    void getDepartmentRentStats()
  }, [])

  useEffect(() => {
    fetchSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  // 按部门分组
  const groupedRecords: [string, MergedRentRecord[]][] = (() => {
    const map = new Map<string, MergedRentRecord[]>()
    for (const r of settlementRecords) {
      const dept = r.department || '未分配'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(r)
    }
    return Array.from(map.entries())
  })()

  // 汇总统计
  const totalDevices = settlementRecords.length
  const totalRent = settlementRecords.reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0)
  const totalDeptCount = groupedRecords.length
  // 所有设备的当前估值总计（用于底部汇总）
  const totalAssetValue = settlementRecords.reduce((sum, r) => {
    const { currentValue } = estimateAssetValue(r)
    return sum + currentValue
  }, 0)

  const toggleDept = (dept: string) => {
    setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))
  }

  // 导出单个部门 CSV
  const exportDeptCSV = (dept: string, records: MergedRentRecord[]) => {
    if (!records || records.length === 0) {
      toast.error('该部门暂无可导出的数据')
      return
    }
    const lines: string[] = []
    lines.push(`租赁结算单,${selectedYear}年${selectedMonth}月,${dept}`)
    lines.push(`生成时间,${new Date().toLocaleString('zh-CN')}`)
    lines.push('')
    lines.push(['资产编码', '配置', '使用人', '月租费', '固定估值', '当前估值', '状态'].join(','))

    let deptRentTotal = 0
    let deptFixedTotal = 0
    let deptCurrentTotal = 0
    for (const r of records) {
      const rent = Number(r.monthly_rent) || 0
      const { fixedValue, currentValue } = estimateAssetValue(r)
      deptRentTotal += rent
      deptFixedTotal += fixedValue
      deptCurrentTotal += currentValue
      lines.push(
        [
          r.asset_code,
          formatHardwareSpec(r),
          r.user_name || '',
          rent.toFixed(2),
          fixedValue.toFixed(2),
          currentValue.toFixed(2),
          r.status === 'paid' ? '已缴' : '未缴'
        ]
          .map(f => `"${String(f).replace(/"/g, '""')}"`)
          .join(',')
      )
    }
    lines.push(
      [
        '小计',
        '',
        '',
        deptRentTotal.toFixed(2),
        deptFixedTotal.toFixed(2),
        deptCurrentTotal.toFixed(2),
        ''
      ]
        .map(f => `"${String(f).replace(/"/g, '""')}"`)
        .join(',')
    )

    const csv = lines.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `租赁结算单_${selectedYear}年${selectedMonth}月_${dept}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(`${dept} 部门 CSV 已导出`)
  }

  // 导出全部（按部门分块）
  const exportAllCSV = () => {
    if (groupedRecords.length === 0) {
      toast.error('暂无可导出的结算数据')
      return
    }

    const lines: string[] = []
    lines.push(`月度租赁结算单,${selectedYear}年${selectedMonth}月`)
    lines.push(`生成时间,${new Date().toLocaleString('zh-CN')}`)
    lines.push('')

    let grandRentTotal = 0
    let grandFixedTotal = 0
    let grandCurrentTotal = 0

    for (const [dept, records] of groupedRecords) {
      lines.push(`【部门】${dept}`)
      lines.push(['资产编码', '配置', '使用人', '月租费', '固定估值', '当前估值', '状态'].join(','))
      let deptRentTotal = 0
      let deptFixedTotal = 0
      let deptCurrentTotal = 0
      for (const r of records) {
        const rent = Number(r.monthly_rent) || 0
        const { fixedValue, currentValue } = estimateAssetValue(r)
        deptRentTotal += rent
        deptFixedTotal += fixedValue
        deptCurrentTotal += currentValue
        lines.push(
          [
            r.asset_code,
            formatHardwareSpec(r),
            r.user_name || '',
            rent.toFixed(2),
            fixedValue.toFixed(2),
            currentValue.toFixed(2),
            r.status === 'paid' ? '已缴' : '未缴'
          ]
            .map(f => `"${String(f).replace(/"/g, '""')}"`)
            .join(',')
        )
      }
      lines.push(
        [
          '小计',
          '',
          '',
          deptRentTotal.toFixed(2),
          deptFixedTotal.toFixed(2),
          deptCurrentTotal.toFixed(2),
          ''
        ]
          .map(f => `"${String(f).replace(/"/g, '""')}"`)
          .join(',')
      )
      lines.push('')
      grandRentTotal += deptRentTotal
      grandFixedTotal += deptFixedTotal
      grandCurrentTotal += deptCurrentTotal
    }
    lines.push(
      [
        '总计',
        '',
        '',
        grandRentTotal.toFixed(2),
        grandFixedTotal.toFixed(2),
        grandCurrentTotal.toFixed(2),
        ''
      ]
        .map(f => `"${String(f).replace(/"/g, '""')}"`)
        .join(',')
    )

    const csv = lines.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `租赁结算单_${selectedYear}年${selectedMonth}月_全部.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('全部结算单 CSV 已导出')
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
              <p className="text-xs text-white/70">月度租赁结算单</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 hidden sm:inline">{formatUserIdentifier(user?.email)}</span>
            {isAdmin && (
              <span className="badge bg-white/20 text-white">管理员</span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        {/* 控制栏 */}
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
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn btn-primary text-sm"
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
                  <button
                    onClick={handleDelete}
                    disabled={deleting || settlementRecords.length === 0}
                    className="btn btn-danger text-sm"
                  >
                    {deleting ? (
                      <>
                        <div className="spinner !w-4 !h-4 !border-2" />
                        取消中...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        取消结算
                      </>
                    )}
                  </button>
                </>
              ) : (
                <span className="badge bg-gray-100 text-gray-500">只读模式（仅管理员可生成/取消）</span>
              )}
              <button
                onClick={fetchSettlement}
                disabled={loading}
                className="btn btn-ghost text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                刷新
              </button>
              <button
                onClick={exportAllCSV}
                disabled={settlementRecords.length === 0}
                className="btn btn-success text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出全部
              </button>
            </div>
          </div>
        </div>

        {/* 汇总统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">结算设备总数</p>
                <p className="text-2xl font-bold text-indigo-600">{totalDevices}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">月租总计</p>
                <p className="text-2xl font-bold text-blue-600">¥{totalRent.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-purple-50 text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">涉及部门数</p>
                <p className="text-2xl font-bold text-purple-600">{totalDeptCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 按部门分组展示结算单 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedYear}年{selectedMonth}月 结算单明细
            </h2>
            {groupedRecords.length > 0 && (
              <span className="badge bg-blue-100 text-blue-700">{groupedRecords.length} 个部门</span>
            )}
          </div>
        </div>

        {loading ? (
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
            <span className="text-gray-400 text-sm">
              {isAdmin ? '请点击「一键生成结算单」生成当月数据' : '请联系管理员生成当月结算单'}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRecords.map(([dept, records]) => {
              const deptTotal = records.reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0)
              const collapsed = collapsedDepts[dept]
              return (
                <div key={dept} className="card !p-0 overflow-hidden">
                  {/* 部门卡片标题行 */}
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
                        <p className="text-xs text-gray-500">{records.length} 台设备</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">小计金额</p>
                        <p className="text-lg font-bold text-blue-600">¥{deptTotal.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          exportDeptCSV(dept, records)
                        }}
                        className="btn btn-ghost text-xs !px-2 !py-1"
                        title={`导出 ${dept} 部门结算单`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        导出此部门
                      </button>
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
                            <th>配置</th>
                            <th>使用人</th>
                            <th className="text-right">月租费</th>
                            <th>估值</th>
                            <th>缴费状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map(r => {
                            const { fixedValue, currentValue } = estimateAssetValue(r)
                            const rent = Number(r.monthly_rent) || 0
                            return (
                              <tr key={r.id}>
                                <td>
                                  <span className="text-sm font-medium text-blue-600">{r.asset_code}</span>
                                </td>
                                <td>
                                  <span className="text-sm text-gray-700 font-mono">{formatHardwareSpec(r)}</span>
                                </td>
                                <td>
                                  <span className="text-sm font-medium">{formatUserIdentifier(r.user_name)}</span>
                                </td>
                                <td className="text-right">
                                  <span className="text-sm font-semibold text-blue-600">¥{rent.toFixed(2)}</span>
                                </td>
                                <td>
                                  <div className="flex flex-col text-xs">
                                    <span className="text-gray-400">固定 ¥{fixedValue}</span>
                                    <span className="text-blue-600 font-semibold">当前 ¥{currentValue}</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge ${r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${r.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    {r.status === 'paid' ? '已缴' : '未缴'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-blue-50/50 font-semibold">
                            <td colSpan={3} className="text-right text-gray-700">部门小计</td>
                            <td className="text-right">
                              <span className="text-sm font-bold text-blue-600">¥{deptTotal.toFixed(2)}</span>
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}

            {/* 底部总计 */}
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
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">总租金</p>
                    <p className="text-2xl font-bold text-blue-700">¥{totalRent.toFixed(2)}</p>
                  </div>
                  <div className="w-px h-10 bg-blue-200" />
                  <div className="text-right">
                    <p className="text-xs text-gray-500">总设备估值</p>
                    <p className="text-2xl font-bold text-indigo-700">¥{totalAssetValue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

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
  estimateAssetValue,
  batchEstimateAssetValueWithAI,
  getAIValuationConfig
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
  // AI 估值缓存（按 asset_code 索引）
  type AIValResult = { fixedValue: number; currentValue: number; source: 'ai' | 'local'; reason?: string; error?: string }
  const [aiValuations, setAiValuations] = useState<Map<string, AIValResult>>(new Map())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)

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
    const cfg = getAIValuationConfig()
    setAiEnabled(cfg.enabled && !!cfg.apiKey)
  }, [])

  useEffect(() => {
    fetchSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  // 批量刷新 AI 估值
  const handleRefreshAIValuation = async () => {
    if (settlementRecords.length === 0) {
      toast.error('暂无结算数据可估值')
      return
    }
    const cfg = getAIValuationConfig()
    setAiEnabled(cfg.enabled && !!cfg.apiKey)
    if (!cfg.enabled || !cfg.apiKey) {
      toast.error('请先在「AI估值」页面配置 API 并启用开关')
      navigate('/ai-valuation')
      return
    }
    setAiLoading(true)
    const toastId = toast.loading(`正在调用 AI 估值（${settlementRecords.length} 台）...`)
    try {
      const results = await batchEstimateAssetValueWithAI(settlementRecords, 5)
      const nextMap = new Map<string, AIValResult>()
      let aiCount = 0
      settlementRecords.forEach((r, i) => {
        nextMap.set(r.asset_code, results[i])
        if (results[i].source === 'ai') aiCount++
      })
      setAiValuations(nextMap)
      toast.success(`AI 估值完成：AI 出值 ${aiCount} / ${settlementRecords.length} 台`, { id: toastId })
    } catch (e: any) {
      toast.error(`AI 估值异常: ${e?.message || e}`, { id: toastId })
    } finally {
      setAiLoading(false)
    }
  }

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
    lines.push(['资产编码', '配置', '使用人', '月租费',
      '本地-固定估值', '本地-当前估值',
      'AI-固定估值', 'AI-当前估值', 'AI来源', '估值说明',
      '状态'].join(','))

    let deptRentTotal = 0
    let deptLocalFixedTotal = 0
    let deptLocalCurrentTotal = 0
    let deptAiFixedTotal = 0
    let deptAiCurrentTotal = 0
    for (const r of records) {
      const rent = Number(r.monthly_rent) || 0
      const localVal = estimateAssetValue(r)
      const aiVal = aiValuations.get(r.asset_code) || null
      const aiFixed = aiVal ? aiVal.fixedValue : localVal.fixedValue
      const aiCurrent = aiVal ? aiVal.currentValue : localVal.currentValue
      deptRentTotal += rent
      deptLocalFixedTotal += localVal.fixedValue
      deptLocalCurrentTotal += localVal.currentValue
      deptAiFixedTotal += aiFixed
      deptAiCurrentTotal += aiCurrent
      lines.push(
        [
          r.asset_code,
          formatHardwareSpec(r),
          r.user_name || '',
          rent.toFixed(2),
          localVal.fixedValue.toFixed(2),
          localVal.currentValue.toFixed(2),
          aiFixed.toFixed(2),
          aiCurrent.toFixed(2),
          aiVal ? (aiVal.source === 'ai' ? 'AI大模型' : '本地兜底') : '未调用AI',
          aiVal?.reason || '',
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
        deptLocalFixedTotal.toFixed(2),
        deptLocalCurrentTotal.toFixed(2),
        deptAiFixedTotal.toFixed(2),
        deptAiCurrentTotal.toFixed(2),
        '',
        '',
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
    let grandLocalFixedTotal = 0
    let grandLocalCurrentTotal = 0
    let grandAiFixedTotal = 0
    let grandAiCurrentTotal = 0

    for (const [dept, records] of groupedRecords) {
      lines.push(`【部门】${dept}`)
      lines.push(['资产编码', '配置', '使用人', '月租费',
        '本地-固定估值', '本地-当前估值',
        'AI-固定估值', 'AI-当前估值', 'AI来源', '估值说明',
        '状态'].join(','))
      let deptRentTotal = 0
      let deptLocalFixedTotal = 0
      let deptLocalCurrentTotal = 0
      let deptAiFixedTotal = 0
      let deptAiCurrentTotal = 0
      for (const r of records) {
        const rent = Number(r.monthly_rent) || 0
        const localVal = estimateAssetValue(r)
        const aiVal = aiValuations.get(r.asset_code) || null
        const aiFixed = aiVal ? aiVal.fixedValue : localVal.fixedValue
        const aiCurrent = aiVal ? aiVal.currentValue : localVal.currentValue
        deptRentTotal += rent
        deptLocalFixedTotal += localVal.fixedValue
        deptLocalCurrentTotal += localVal.currentValue
        deptAiFixedTotal += aiFixed
        deptAiCurrentTotal += aiCurrent
        lines.push(
          [
            r.asset_code,
            formatHardwareSpec(r),
            r.user_name || '',
            rent.toFixed(2),
            localVal.fixedValue.toFixed(2),
            localVal.currentValue.toFixed(2),
            aiFixed.toFixed(2),
            aiCurrent.toFixed(2),
            aiVal ? (aiVal.source === 'ai' ? 'AI大模型' : '本地兜底') : '未调用AI',
            aiVal?.reason || '',
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
          deptLocalFixedTotal.toFixed(2),
          deptLocalCurrentTotal.toFixed(2),
          deptAiFixedTotal.toFixed(2),
          deptAiCurrentTotal.toFixed(2),
          '',
          '',
          ''
        ]
          .map(f => `"${String(f).replace(/"/g, '""')}"`)
          .join(',')
      )
      lines.push('')
      grandRentTotal += deptRentTotal
      grandLocalFixedTotal += deptLocalFixedTotal
      grandLocalCurrentTotal += deptLocalCurrentTotal
      grandAiFixedTotal += deptAiFixedTotal
      grandAiCurrentTotal += deptAiCurrentTotal
    }
    lines.push(
      [
        '总计',
        '',
        '',
        grandRentTotal.toFixed(2),
        grandLocalFixedTotal.toFixed(2),
        grandLocalCurrentTotal.toFixed(2),
        grandAiFixedTotal.toFixed(2),
        grandAiCurrentTotal.toFixed(2),
        '',
        '',
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
            <button onClick={() => navigate('/ai-valuation')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5" title="AI 大模型估值配置">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI估值
            </button>
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
                onClick={handleRefreshAIValuation}
                disabled={aiLoading || settlementRecords.length === 0}
                className="btn btn-secondary text-sm"
                title="调用AI大模型重新估值（含缓存）"
              >
                {aiLoading ? (
                  <><div className="spinner !w-4 !h-4 !border-2" />AI估值中...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    刷新AI估值
                  </>
                )}
              </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">结算设备</p>
                <p className="text-xl font-bold text-indigo-600">{totalDevices}</p>
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
                <p className="text-xl font-bold text-blue-600">¥{totalRent.toFixed(0)}</p>
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
                <p className="text-xs text-gray-500 font-medium">部门数</p>
                <p className="text-xl font-bold text-purple-600">{totalDeptCount}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-gray-100 text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">本地估值合计</p>
                <p className="text-xl font-bold text-gray-600">¥{totalAssetValue.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className={`stat-card ${aiEnabled ? 'ring-2 ring-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">✨ AI估值合计</p>
                <p className="text-xl font-bold text-indigo-700">
                  ¥{settlementRecords.reduce((sum, r) => {
                    const v = aiValuations.get(r.asset_code)
                    return sum + (v?.currentValue ?? estimateAssetValue(r).currentValue)
                  }, 0).toLocaleString()}
                </p>
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

                  {/* 部门资产明细表格（含本地+AI双估值） */}
                  {!collapsed && (
                    <div className="table-container !rounded-none !border-0 !border-t border-gray-100 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th rowSpan={2}>资产编码</th>
                            <th rowSpan={2}>配置</th>
                            <th rowSpan={2}>使用人</th>
                            <th rowSpan={2} className="text-right">月租费</th>
                            <th colSpan={2} className="text-center border-l border-gray-200 bg-gray-50/50">本地估值（保底）</th>
                            <th colSpan={2} className="text-center bg-indigo-50/70 border-l border-indigo-100">✨ AI估值（实时行情）</th>
                            <th rowSpan={2}>缴费状态</th>
                          </tr>
                          <tr className="text-xs font-medium">
                            <th className="text-right text-gray-400 border-l border-gray-200 bg-gray-50/50">购入</th>
                            <th className="text-right text-gray-400 bg-gray-50/50">当前</th>
                            <th className="text-right text-indigo-400 bg-indigo-50/70 border-l border-indigo-100">购入</th>
                            <th className="text-right text-indigo-400 bg-indigo-50/70">当前</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map(r => {
                            const localVal = estimateAssetValue(r)
                            const aiVal = aiValuations.get(r.asset_code)
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
                                <td className="text-right text-xs text-gray-500 border-l border-gray-100 bg-gray-50/30">
                                  ¥{localVal.fixedValue.toLocaleString()}
                                </td>
                                <td className="text-right text-xs text-gray-600 bg-gray-50/30">
                                  ¥{localVal.currentValue.toLocaleString()}
                                </td>
                                <td className="text-right text-xs text-indigo-500 border-l border-indigo-100 bg-indigo-50/40">
                                  {aiVal ? (
                                    <>
                                      ¥{aiVal.fixedValue.toLocaleString()}
                                      {aiVal.reason && <span className="block text-[10px] text-indigo-400 truncate" title={aiVal.reason}>💡{aiVal.reason}</span>}
                                    </>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="text-right bg-indigo-50/40">
                                  {aiVal ? (
                                    <div className="flex flex-col items-end">
                                      <span className={`text-sm font-bold ${aiVal.source === 'ai' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                        ¥{aiVal.currentValue.toLocaleString()}
                                      </span>
                                      <span className={`text-[10px] ${aiVal.source === 'ai' ? 'text-indigo-400' : 'text-amber-500'}`}>
                                        {aiVal.source === 'ai' ? '✨AI' : '⚠️兜底'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">点击上方「刷新AI估值」</span>
                                  )}
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
                            <td colSpan={2}></td>
                            <td></td>
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

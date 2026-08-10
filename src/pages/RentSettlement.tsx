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
  getAIValuationConfig,
  type AIValResult,
  restoreAIValuationsFromCache,
  syncResolveAIValuation
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
              created_at: a?.created_at || r.created_at,
              // 把 AI 估值持久化列一并带上（渲染端 DB 第一优先级读这些）
              ai_fixed_value: a?.ai_fixed_value,
              ai_current_value: a?.ai_current_value,
              ai_reason: a?.ai_reason,
              ai_valuated_at: a?.ai_valuated_at
            }
          })
        }
      }

      setSettlementRecords(merged)

      // ===== 刷新后 AI 估值丢失修复 =====
      // 结算数据加载完成后，立刻从 localStorage 缓存恢复到 aiValuations state。
      // 渲染端再通过 syncResolveAIValuation(aiValuations, record) 三重兜底显示。
      if (merged && merged.length > 0) {
        try {
          const restored = restoreAIValuationsFromCache(merged as any[])
          if (restored.size > 0) setAiValuations(restored)
        } catch (err) {
          console.warn('恢复 AI 估值缓存失败:', err)
        }
      }
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
      'AI-购入价(元)', 'AI-当前价(元)', 'AI估值依据', '估值时间', '状态'].join(','))

    let deptRentTotal = 0
    let deptAiFixedTotal = 0
    let deptAiCurrentTotal = 0
    let aiCount = 0
    for (const r of records) {
      const rent = Number(r.monthly_rent) || 0
      // 用户要求：不要本地算法，只有 AI 出值才累计
      const aiVal = syncResolveAIValuation(aiValuations, r as any)
      const isAI = aiVal.source === 'ai'
      const aiFixed = isAI ? (aiVal.fixedValue ?? aiVal.currentValue ?? 0) : 0
      const aiCurrent = isAI ? (aiVal.currentValue ?? 0) : 0
      if (isAI) aiCount++
      deptRentTotal += rent
      deptAiFixedTotal += aiFixed
      deptAiCurrentTotal += aiCurrent
      lines.push(
        [
          r.asset_code,
          formatHardwareSpec(r),
          r.user_name || '',
          rent.toFixed(2),
          isAI ? aiFixed.toFixed(0) : '待AI估值',
          isAI ? aiCurrent.toFixed(0) : '待AI估值',
          aiVal.reason || '',
          aiVal.valuatedAt ? new Date(aiVal.valuatedAt).toLocaleString('zh-CN') : '',
          r.status === 'paid' ? '已缴' : '未缴'
        ]
          .map(f => `"${String(f).replace(/"/g, '""')}"`)
          .join(',')
      )
    }
    lines.push(
      [
        `小计（${aiCount}/${records.length}台已AI估值）`,
        '',
        '',
        deptRentTotal.toFixed(2),
        deptAiFixedTotal.toFixed(0),
        deptAiCurrentTotal.toFixed(0),
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
    let grandAiFixedTotal = 0
    let grandAiCurrentTotal = 0
    let totalAICount = 0
    let totalDevices = 0

    for (const [dept, records] of groupedRecords) {
      lines.push(`【部门】${dept}`)
      lines.push(['资产编码', '配置', '使用人', '月租费',
        'AI-购入价(元)', 'AI-当前价(元)', 'AI估值依据', '估值时间', '状态'].join(','))
      let deptRentTotal = 0
      let deptAiFixedTotal = 0
      let deptAiCurrentTotal = 0
      let deptAICount = 0
      for (const r of records) {
        const rent = Number(r.monthly_rent) || 0
        const aiVal = syncResolveAIValuation(aiValuations, r as any)
        const isAI = aiVal.source === 'ai'
        const aiFixed = isAI ? (aiVal.fixedValue ?? aiVal.currentValue ?? 0) : 0
        const aiCurrent = isAI ? (aiVal.currentValue ?? 0) : 0
        if (isAI) deptAICount++
        deptRentTotal += rent
        deptAiFixedTotal += aiFixed
        deptAiCurrentTotal += aiCurrent
        lines.push(
          [
            r.asset_code,
            formatHardwareSpec(r),
            r.user_name || '',
            rent.toFixed(2),
            isAI ? aiFixed.toFixed(0) : '待AI估值',
            isAI ? aiCurrent.toFixed(0) : '待AI估值',
            aiVal.reason || '',
            aiVal.valuatedAt ? new Date(aiVal.valuatedAt).toLocaleString('zh-CN') : '',
            r.status === 'paid' ? '已缴' : '未缴'
          ]
            .map(f => `"${String(f).replace(/"/g, '""')}"`)
            .join(',')
        )
      }
      lines.push(
        [
          `小计（${deptAICount}/${records.length}台已AI估值）`,
          '',
          '',
          deptRentTotal.toFixed(2),
          deptAiFixedTotal.toFixed(0),
          deptAiCurrentTotal.toFixed(0),
          '',
          '',
          ''
        ]
          .map(f => `"${String(f).replace(/"/g, '""')}"`)
          .join(',')
      )
      lines.push('')
      grandRentTotal += deptRentTotal
      grandAiFixedTotal += deptAiFixedTotal
      grandAiCurrentTotal += deptAiCurrentTotal
      totalAICount += deptAICount
      totalDevices += records.length
    }
    lines.push(
      [
        `总计（${totalAICount}/${totalDevices}台已AI估值）`,
        '',
        '',
        grandRentTotal.toFixed(2),
        grandAiFixedTotal.toFixed(0),
        grandAiCurrentTotal.toFixed(0),
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

        {/* 汇总统计卡片（用户要求：去掉本地估值，只保留 AI 估值） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
          <div className={`stat-card ${aiEnabled ? 'ring-2 ring-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  ✨ AI估值合计
                  {(() => {
                    let aiCount = 0
                    let unvalued = 0
                    for (const r of settlementRecords) {
                      const v = syncResolveAIValuation(aiValuations, r as any)
                      if (v.source === 'ai' && typeof v.currentValue === 'number') aiCount++
                      else unvalued++
                    }
                    if (aiCount === settlementRecords.length && settlementRecords.length > 0) {
                      return <span className="badge !py-0 !px-1.5 bg-green-100 text-green-700 border-0 text-[10px]">✓全部已估值</span>
                    }
                    if (unvalued > 0) {
                      return <span className="badge !py-0 !px-1.5 bg-orange-100 text-orange-700 border-0 text-[10px]">{unvalued}台待估值</span>
                    }
                    return null
                  })()}
                </p>
                <p className="text-xl font-bold text-indigo-700">
                  ¥{settlementRecords.reduce((sum, r) => {
                    // 用户：不要本地兜底。只累加 AI 真实出值
                    const v = syncResolveAIValuation(aiValuations, r as any)
                    return sum + (v.source === 'ai' ? (v.currentValue ?? 0) : 0)
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

                  {/* 部门资产明细表格（仅 AI 估值，不再本地兜底） */}
                  {!collapsed && (
                    <div className="table-container !rounded-none !border-0 !border-t border-gray-100 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th>资产编码</th>
                            <th>配置</th>
                            <th>使用人</th>
                            <th className="text-right">月租费</th>
                            <th className="text-right bg-indigo-50/60">
                              ✨ AI购入价
                            </th>
                            <th className="text-right bg-indigo-50/80">
                              ✨ AI当前价
                            </th>
                            <th>缴费状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map(r => {
                            const aiVal = syncResolveAIValuation(aiValuations, r as any)
                            const hasAi = aiVal.source === 'ai' && typeof aiVal.currentValue === 'number'
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
                                <td className="text-right bg-indigo-50/40">
                                  {hasAi ? (
                                    <>
                                      <span className="text-indigo-700 font-medium text-sm">
                                        ¥{(aiVal.fixedValue ?? aiVal.currentValue!).toLocaleString()}
                                      </span>
                                      {aiVal.valuatedAt && (
                                        <span className="block text-[10px] text-indigo-400">
                                          {new Date(aiVal.valuatedAt).toLocaleDateString('zh-CN')}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">
                                      ⚠️ 待估值
                                    </span>
                                  )}
                                </td>
                                <td className="text-right bg-indigo-50/60">
                                  {hasAi ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-bold text-indigo-700">
                                        ¥{aiVal.currentValue!.toLocaleString()}
                                      </span>
                                      {aiVal.reason && (
                                        <span className="text-[10px] text-indigo-500 truncate max-w-[150px]" title={aiVal.reason}>💡 {aiVal.reason}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={handleRefreshAIValuation}
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-sm"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                      </svg>
                                      立即估值
                                    </button>
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
                            <td colSpan={2} className="text-right text-indigo-600">
                              ✨ {records.reduce((sum, r) => {
                                const v = syncResolveAIValuation(aiValuations, r as any)
                                return sum + (v.source === 'ai' ? (v.currentValue ?? 0) : 0)
                              }, 0).toLocaleString()}
                            </td>
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
                    <p className="text-xs text-indigo-500">✨ AI总设备估值</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      ¥{settlementRecords.reduce((sum, r) => {
                        const v = syncResolveAIValuation(aiValuations, r as any)
                        return sum + (v.source === 'ai' ? (v.currentValue ?? 0) : 0)
                      }, 0).toLocaleString()}
                    </p>
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

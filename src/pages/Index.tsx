import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { supabase, type Asset, initDatabase, formatUserIdentifier, formatMemory, formatStorage, getStatusText, getStatusColor, recordAllHistory, generateUniqueAssetCode, updateAssetRobust, insertAssetRobust, isCategorySupportedSync, saveAssetSnapshot, formatHardwareSpec, estimateAssetValue, estimateAssetValueWithAI, batchEstimateAssetValueWithAI, getAIValuationConfig, type AIValResult, restoreAIValuationsFromCache, syncResolveAIValuation } from '../lib/supabase'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'

// 注册 Chart.js 组件
ChartJS.register(ArcElement, Tooltip, Legend)

const categories = ['笔记本', '台式机', '显示器', '外设', '服务器', '网络设备', '其他']

export default function Index() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, signOut, loading: authLoading } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [isBatchStatusDialogOpen, setIsBatchStatusDialogOpen] = useState(false)
  const [batchStatus, setBatchStatus] = useState('active')
  const [rentStats, setRentStats] = useState({
    accumulatedPaid: 0
  })
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    cpu: '',
    ram: '',
    storage: '',
    gpu: '',
    os: '',
    category: '',
    department: '',
    user_name: '',
    location: '',
    status: 'active',
    notes: '',
    monthly_rent: ''
  })
  // 分页相关状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50) // 默认50条一页
  const [totalAssets, setTotalAssets] = useState(0)
  // 筛选相关状态
  const [statusFilter, setStatusFilter] = useState('all') // all, active, idle, maintenance, retired
  const [departmentFilter, setDepartmentFilter] = useState('all')
  // 高级筛选
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState({
    category: '',
    brand: '',
    minMemory: '',
    minStorage: ''
  })
  // 全部资产数据（用于汇总统计）
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  // 所有部门列表（不受筛选影响）
  const [departments, setDepartments] = useState<string[]>([])
  // 所有分类列表（不受筛选影响）
  const [categoriesFilter, setCategoriesFilter] = useState<string[]>([])

  // 筛选汇总面板：显示当前筛选结果和租金合计
  const [showSummaryPanel, setShowSummaryPanel] = useState(false)
  // AI 估值数据：Map<asset_code, {fixedValue, currentValue, source, reason}>
  const [aiValuations, setAiValuations] = useState<Map<string, AIValResult>>(new Map())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)

  // 计算资产状态分布数据
  const getStatusDistribution = () => {
    const statusCounts = allAssets.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const labels: string[] = []
    const data: number[] = []
    const colors: string[] = []

    const colorMap: Record<string, string> = {
      active: '#22c55e',
      idle: '#f59e0b',
      maintenance: '#ef4444',
      retired: '#9ca3af'
    }

    Object.entries(statusCounts).forEach(([status, count]) => {
      labels.push(getStatusText(status))
      data.push(count)
      colors.push(colorMap[status] || '#6b7280')
    })

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 1,
        },
      ],
    }
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || ''
            const value = context.raw || 0
            const total = context.dataset.data.reduce((a: any, b: any) => a + b, 0)
            const percentage = Math.round((value / total) * 100)
            return `${label}: ${value} (${percentage}%)`
          },
        },
      },
    },
  }

  // 初始化数据库
  useEffect(() => {
    initDatabase()
  }, [])

  // 获取所有部门列表和分类列表（不受筛选影响）
  const fetchDepartmentsAndCategories = async () => {
    try {
      // 获取部门
      const { data: deptData } = await supabase
        .from('assets')
        .select('department')
        .not('department', 'is', null)
        .not('department', 'eq', '')
      const uniqueDepartments = [...new Set((deptData || []).map(a => a.department))].filter(d => d)
      setDepartments(uniqueDepartments)

      // 获取分类
      const { data: catData } = await supabase
        .from('assets')
        .select('category')
        .not('category', 'is', null)
        .not('category', 'eq', '')
      const uniqueCategories = [...new Set((catData || []).map(a => a.category))].filter(c => c)
      setCategoriesFilter(uniqueCategories)
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  // 从Supabase中获取资产数据
  const fetchAssets = async () => {
    console.log('Index: Fetching assets')
    setLoading(true)
    let filteredAllData: Asset[] = []
    try {
      // 1. 获取全部资产数据（用于汇总统计）
      let allQuery = supabase.from('assets').select('*')
      if (searchTerm) {
        allQuery = allQuery.or(`asset_code.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`)
      }
      if (statusFilter !== 'all') {
        allQuery = allQuery.eq('status', statusFilter)
      }
      if (departmentFilter !== 'all') {
        allQuery = allQuery.eq('department', departmentFilter)
      }
      // 只有 category 列在 schema cache 中可用时才走后端筛选；否则转到前端过滤
      const catSupported = isCategorySupportedSync()
      if (advancedFilters.category && catSupported) {
        allQuery = allQuery.eq('category', advancedFilters.category)
      }
      if (advancedFilters.brand) {
        allQuery = allQuery.ilike('brand', `%${advancedFilters.brand}%`)
      }
      const { data: allData } = await allQuery
      filteredAllData = allData || []

      // 前端过滤：内存、存储 + （后端不支持 category 时在此补上）
      if (advancedFilters.category && !catSupported) {
        filteredAllData = filteredAllData.filter(a => a.category === advancedFilters.category)
      }
      if (advancedFilters.minMemory) {
        const minMem = parseFloat(advancedFilters.minMemory)
        if (!isNaN(minMem)) {
          filteredAllData = filteredAllData.filter(a => {
            const val = parseFloat(a.ram)
            return !isNaN(val) && val >= minMem
          })
        }
      }
      if (advancedFilters.minStorage) {
        const minStor = parseFloat(advancedFilters.minStorage)
        if (!isNaN(minStor)) {
          filteredAllData = filteredAllData.filter(a => {
            const val = parseFloat(a.storage)
            return !isNaN(val) && val >= minStor
          })
        }
      }
      setAllAssets(filteredAllData)

      // 2. 获取分页数据
      const offset = (page - 1) * pageSize
      let query = supabase.from('assets').select('*', { count: 'exact' })
      if (searchTerm) {
        query = query.or(`asset_code.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%`)
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (departmentFilter !== 'all') {
        query = query.eq('department', departmentFilter)
      }
      if (advancedFilters.category && catSupported) {
        query = query.eq('category', advancedFilters.category)
      }
      if (advancedFilters.brand) {
        query = query.ilike('brand', `%${advancedFilters.brand}%`)
      }
      const { data, error, count } = await query.range(offset, offset + pageSize - 1)
      if (error) throw error

      // 前端过滤：内存、存储 + （后端不支持 category 时在此补上）
      let pageData = data || []
      if (advancedFilters.category && !catSupported) {
        pageData = pageData.filter((a: any) => a.category === advancedFilters.category)
      }
      if (advancedFilters.minMemory) {
        const minMem = parseFloat(advancedFilters.minMemory)
        if (!isNaN(minMem)) {
          pageData = pageData.filter(a => {
            const val = parseFloat(a.ram)
            return !isNaN(val) && val >= minMem
          })
        }
      }
      if (advancedFilters.minStorage) {
        const minStor = parseFloat(advancedFilters.minStorage)
        if (!isNaN(minStor)) {
          pageData = pageData.filter(a => {
            const val = parseFloat(a.storage)
            return !isNaN(val) && val >= minStor
          })
        }
      }

      setAssets(pageData)
      setTotalAssets(count || 0)
      console.log('Index: Assets fetched successfully', pageData)
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }

    // 单独获取累计已缴租金（不随筛选变化）
    try {
      const { data: allRecords } = await supabase
        .from('rent_records')
        .select('monthly_rent, status')

      const accumulatedPaid = (allRecords || [])
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.monthly_rent), 0)

      setRentStats({ accumulatedPaid })
    } catch (error) {
      console.error('Error fetching rent stats:', error)
    }

    // ===== 刷新后 AI 估值丢失修复 =====
    // 资产加载完成后，立刻从「DB ai_* 列 + localStorage 缓存 + execute_sql RPC 兜底」
    // 三层来源恢复 aiValuations state。用户明确要求「估值一次后一直保存」——
    // 这里 async restore 会自动探测 schema cache，不可见时走 execute_sql 直连 DB。
    if (filteredAllData && filteredAllData.length > 0) {
      try {
        const restored = await restoreAIValuationsFromCache(filteredAllData as any[])
        setAiValuations(restored)
      } catch (err) {
        console.warn('恢复 AI 估值缓存失败:', err)
      }
    }
  }

  useEffect(() => {
    fetchDepartmentsAndCategories()
    fetchAssets()
    setAiEnabled(getAIValuationConfig().enabled && !!getAIValuationConfig().apiKey)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchAssets()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchAssets()
  }, [page, pageSize, statusFilter, departmentFilter, advancedFilters])

  // 处理从详情页传来的编辑请求
  useEffect(() => {
    const editAssetId = location.state?.editAssetId
    if (editAssetId) {
      const asset = assets.find(a => a.id === editAssetId)
      if (asset) {
        handleEdit(asset)
      }
    }
  }, [location.state?.editAssetId, assets])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(assets.map(asset => String(asset.id)))
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

  const resetForm = () => {
    setFormData({
      brand: '',
      model: '',
      cpu: '',
      ram: '',
      storage: '',
      gpu: '',
      os: '',
      category: '',
      department: '',
      user_name: '',
      location: '',
      status: 'active',
      notes: '',
      monthly_rent: ''
    })
  }

  // 批量刷新 AI 估值（针对筛选后的 allAssets）
  const handleRefreshAIValuation = async () => {
    if (allAssets.length === 0) {
      toast.error('暂无筛选结果可估值')
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
    const toastId = toast.loading(`正在调用 AI 估值（${allAssets.length} 台，并发 5）...`)
    try {
      const results = await batchEstimateAssetValueWithAI(allAssets, 5)
      const nextMap = new Map<string, AIValResult>()
      let aiCount = 0
      let failedCount = 0
      let lastError: string | undefined
      allAssets.forEach((a, i) => {
        nextMap.set(a.asset_code, results[i])
        if (results[i].source === 'ai') aiCount++
        else failedCount++
        if (results[i].error && !lastError) lastError = results[i].error
      })
      setAiValuations(nextMap)
      if (failedCount === 0) {
        toast.success(`AI 估值完成：全部 ${aiCount} 台成功出值`, { id: toastId })
      } else {
        toast.success(`AI 估值完成：成功 ${aiCount} 台，失败 ${failedCount} 台（可重新估值）`, { id: toastId })
      }
      if (lastError && failedCount > 0) {
        console.warn('AI 估值部分失败，首个错误:', lastError)
      }
    } catch (e: any) {
      toast.error(`AI 估值异常: ${e?.message || e}`, { id: toastId })
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // 异步生成唯一资产编码：查询数据库当月最大序号 +1
      const assetCode = await generateUniqueAssetCode()
      const assetData: Record<string, any> = {
        ...formData,
        monthly_rent: formData.monthly_rent ? parseFloat(formData.monthly_rent) : 0,
        asset_code: assetCode
      }
      // 如果 category 为空字符串则不发送该字段
      if (!assetData.category) {
        delete assetData.category
      }
      console.log('Index: Creating asset with data:', assetData, 'generated code:', assetCode)
      // 使用 insertAssetRobust 双通道插入，category 不会因 schema cache 看不到列而失败
      const { data, error } = await insertAssetRobust(assetData)
      if (error) throw error
      console.log('Index: Asset created successfully:', data)

      // 记录操作历史
      if (user && data && data.length > 0) {
        await recordAllHistory(data[0].asset_code, 'create', user.email)
      }

      await fetchAssets()
      setIsAddDialogOpen(false)
      resetForm()
      toast.success('资产添加成功')
    } catch (error: any) {
      console.error('Error adding asset:', error)
      toast.error(`资产添加失败: ${error?.message || JSON.stringify(error)}`)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingAsset) {
      try {
        // 权限控制：普通用户只能修改使用人、位置、部门等信息
        let updateData: Record<string, any> = { ...formData }
        if (user && user.role !== 'admin') {
          updateData = {
            user_name: formData.user_name,
            location: formData.location,
            department: formData.department
          }
        }

        // 将 monthly_rent 转换为数字，避免空字符串导致数据库更新失败
        if ('monthly_rent' in updateData) {
          const rentValue = parseFloat(updateData.monthly_rent)
          updateData.monthly_rent = isNaN(rentValue) ? 0 : rentValue
        }

        // 构建变更明细（基于原始 updateData，category 由 updateAssetRobust 内部处理）
        const asset = editingAsset
        const changes: string[] = []
        if (updateData.brand !== undefined && updateData.brand !== asset.brand) changes.push(`品牌: ${asset.brand || '无'} → ${updateData.brand || '无'}`)
        if (updateData.model !== undefined && updateData.model !== asset.model) changes.push(`型号: ${asset.model || '无'} → ${updateData.model || '无'}`)
        if (updateData.cpu !== undefined && updateData.cpu !== asset.cpu) changes.push(`CPU: ${asset.cpu || '无'} → ${updateData.cpu || '无'}`)
        if (updateData.ram !== undefined && updateData.ram !== asset.ram) changes.push(`内存: ${asset.ram || '无'} → ${updateData.ram || '无'}`)
        if (updateData.storage !== undefined && updateData.storage !== asset.storage) changes.push(`存储: ${asset.storage || '无'} → ${updateData.storage || '无'}`)
        if (updateData.gpu !== undefined && updateData.gpu !== asset.gpu) changes.push(`显卡: ${asset.gpu || '无'} → ${updateData.gpu || '无'}`)
        if (updateData.os !== undefined && updateData.os !== asset.os) changes.push(`操作系统: ${asset.os || '无'} → ${updateData.os || '无'}`)
        if (updateData.category !== undefined && updateData.category !== asset.category) changes.push(`分类: ${asset.category || '无'} → ${updateData.category || '无'}`)
        if (updateData.department !== undefined && updateData.department !== asset.department) changes.push(`部门: ${asset.department || '无'} → ${updateData.department || '无'}`)
        if (updateData.user_name !== undefined && updateData.user_name !== asset.user_name) changes.push(`使用人: ${asset.user_name || '无'} → ${updateData.user_name || '无'}`)
        if (updateData.location !== undefined && updateData.location !== asset.location) changes.push(`位置: ${asset.location || '无'} → ${updateData.location || '无'}`)
        if (updateData.status !== undefined && updateData.status !== asset.status) changes.push(`状态: ${getStatusText(asset.status)} → ${getStatusText(updateData.status)}`)
        if (updateData.monthly_rent !== undefined && Number(updateData.monthly_rent) !== Number(asset.monthly_rent)) changes.push(`月租费: ¥${asset.monthly_rent || 0} → ¥${updateData.monthly_rent || 0}`)
        if (updateData.notes !== undefined && updateData.notes !== asset.notes) changes.push(`备注: ${asset.notes || '无'} → ${updateData.notes || '无'}`)

        console.log('Index: Updating asset with data:', updateData)

        // 更新前保存快照（防止数据丢失，可用于回溯恢复）
        if (user) {
          await saveAssetSnapshot(editingAsset.asset_code, 'update', user.email, editingAsset)
        }

        // 健壮更新：自动处理 category 列的 PostgREST schema cache 问题
        // 若 REST API 因看不到 category 列而失败，会自动剥离 category 重试 + execute_sql 补写
        const { error } = await updateAssetRobust(editingAsset.asset_code, updateData)
        if (error) throw error
        console.log('Index: Asset updated successfully')

        // 记录操作历史（带变更明细）
        if (user && changes.length > 0) {
          await recordAllHistory(editingAsset.asset_code, 'update', user.email, changes.join('\n'))
        } else if (user) {
          // 即使没有检测到变更，也记录一条无明细的历史
          await recordAllHistory(editingAsset.asset_code, 'update', user.email)
        }

        await fetchAssets()
        setIsEditDialogOpen(false)
        setEditingAsset(null)
        resetForm()
        toast.success('资产更新成功')
      } catch (error: any) {
        console.error('Error updating asset:', error)
        toast.error(`资产更新失败: ${error?.message || JSON.stringify(error)}`)
      }
    }
  }

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset)
    // 权限控制：普通用户只能修改使用人、位置、部门等信息
    const commonFields = {
      brand: asset.brand || '',
      model: asset.model || '',
      cpu: asset.cpu || '',
      ram: asset.ram || '',
      storage: asset.storage || '',
      gpu: asset.gpu || '',
      os: asset.os || '',
      category: asset.category || '',
      department: asset.department || '',
      user_name: asset.user_name || '',
      location: asset.location || '',
      status: asset.status || 'active',
      notes: asset.notes || '',
      monthly_rent: asset.monthly_rent != null ? String(asset.monthly_rent) : ''
    }
    setFormData(commonFields)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string | number) => {
    // 权限控制：只有管理员可以删除资产
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以删除资产')
      return
    }

    if (window.confirm('确定要删除这个资产吗？')) {
      try {
        // 获取要删除的资产信息
        const { data: asset, error: getError } = await supabase.from('assets').select('*').eq('id', id).single()
        if (getError) throw getError

        // 删除前保存快照（可用于恢复）
        if (user && asset) {
          await saveAssetSnapshot(asset.asset_code, 'delete', user.email, asset)
        }

        // 先删除相关的维护记录
        await supabase.from('maintenance_records').delete().eq('asset_id', id)

        // 先删除相关的图片记录
        await supabase.from('asset_images').delete().eq('asset_code', asset.asset_code)

        const { data, error } = await supabase.from('assets').delete().eq('asset_code', asset.asset_code)
        if (error) throw error

        // 记录操作历史
        if (user) {
          await recordAllHistory(asset.asset_code, 'delete', user.email)
        }

        await fetchAssets()
        toast.success('资产删除成功')
      } catch (error) {
        console.error('Error deleting asset:', error)
        toast.error('资产删除失败')
      }
    }
  }

  const handleBatchDelete = async () => {
    // 权限控制：只有管理员可以批量删除资产
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以批量删除资产')
      return
    }

    if (selectedIds.length === 0) {
      toast.error('请选择要删除的资产')
      return
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 个资产吗？`)) {
      try {
        // 并行获取所有要删除的资产信息
        const assetResults = await Promise.all(
          selectedIds.map(id => supabase.from('assets').select('*').eq('id', id).single())
        )

        // 并行删除所有资产及其关联数据
        await Promise.all(assetResults.map(async ({ data: asset }) => {
          if (!asset) return
          // 删除关联的维护记录和图片
          await supabase.from('maintenance_records').delete().eq('asset_id', asset.id)
          await supabase.from('asset_images').delete().eq('asset_code', asset.asset_code)
          // 删除资产
          await supabase.from('assets').delete().eq('asset_code', asset.asset_code)
          // 记录历史
          if (user) {
            await recordAllHistory(asset.asset_code, 'delete', user.email)
          }
        }))

        await fetchAssets()
        setSelectedIds([])
        toast.success('资产批量删除成功')
      } catch (error) {
        console.error('Error batch deleting assets:', error)
        toast.error('资产批量删除失败')
      }
    }
  }

  const handleBatchExportQR = async () => {
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以批量导出二维码')
      return
    }

    if (selectedIds.length === 0) {
      toast.error('请选择要导出二维码的资产')
      return
    }
    try {
      const QRCode = (await import('qrcode')).default
      const qrPromises = selectedIds.map(async (id) => {
        const asset = assets.find(a => a.id === id)
        if (asset) {
          const qrData = `${window.location.origin}/asset/${asset.asset_code}`
          const url = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2
          })
          return { asset, url }
        }
        return null
      })
      const qrResults = await Promise.all(qrPromises)
      const validResults = qrResults.filter((result): result is { asset: Asset; url: string } => result !== null)

      const html = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>资产二维码批量导出</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              color: #333;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
              gap: 20px;
              margin-top: 30px;
            }
            .qr-item {
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              text-align: center;
            }
            .qr-code {
              margin: 0 auto 10px;
            }
            .asset-info {
              font-size: 14px;
              color: #666;
            }
            .asset-code {
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>资产二维码批量导出</h1>
            <div class="qr-grid">
              ${validResults.map(({ asset, url }) => `
                <div class="qr-item">
                  <div class="asset-code">${asset.asset_code}</div>
                  <div class="asset-info">${asset.brand} ${asset.model}</div>
                  <div class="asset-info">${asset.user_name}</div>
                  <img class="qr-code" src="${url}" alt="${asset.asset_code}" width="200" height="200">
                </div>
              `).join('')}
            </div>
          </div>
        </body>
        </html>
      `

      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `资产二维码_${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('二维码导出成功')
    } catch (error) {
      console.error('Error exporting QR codes:', error)
      toast.error(`二维码导出失败: ${error}`)
    }
  }

  // 批量导出设备数据（Excel）
  const handleBatchExportDevices = async () => {
    // 权限控制：只有管理员可以批量导出设备
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以批量导出设备')
      return
    }

    if (selectedIds.length === 0) {
      toast.error('请选择要导出的设备')
      return
    }

    try {
      console.log('Index: Starting batch device export for', selectedIds.length, 'assets')

      // 筛选出选中的资产
      const selectedAssets = assets.filter(asset => selectedIds.includes(asset.id))

      if (selectedAssets.length === 0) {
        toast.error('没有找到可导出的设备')
        return
      }

      // 使用 xlsx 库生成 Excel 文件
      const headers = ['资产编码', '分类', '品牌', '型号', 'CPU', '内存', '存储', '显卡', '操作系统', '部门', '使用人', '位置', '状态', '月租费', '备注']
      const data = selectedAssets.map(asset => [
        asset.asset_code,
        asset.category || '-',
        asset.brand,
        asset.model,
        asset.cpu,
        formatMemory(asset.ram),
        formatStorage(asset.storage),
        asset.gpu || '-',
        asset.os,
        asset.department,
        asset.user_name,
        asset.location,
        getStatusText(asset.status),
        asset.monthly_rent || 0,
        asset.notes || ''
      ])

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
      XLSX.utils.book_append_sheet(wb, ws, '设备导出')
      const fileName = `设备导出_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      toast.success('设备导出成功')
      console.log('Index: Batch device export completed successfully')
    } catch (error) {
      console.error('Error exporting devices:', error)
      toast.error('设备导出失败')
    }
  }

  // 导出全部数据（仅管理员）
  const handleExportAll = async () => {
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以导出全部数据')
      return
    }

    try {
      const { data: allData } = await supabase.from('assets').select('*')
      if (!allData || allData.length === 0) {
        toast.error('没有可导出的数据')
        return
      }

      const headers = ['资产编码', '分类', '品牌', '型号', 'CPU', '内存', '存储', '显卡', '操作系统', '部门', '使用人', '位置', '状态', '月租费', '备注']
      const rows = allData.map(asset => [
        asset.asset_code,
        asset.category || '-',
        asset.brand,
        asset.model,
        asset.cpu,
        formatMemory(asset.ram),
        formatStorage(asset.storage),
        asset.gpu || '-',
        asset.os,
        asset.department,
        asset.user_name,
        asset.location,
        getStatusText(asset.status),
        asset.monthly_rent || 0,
        asset.notes || ''
      ])

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      XLSX.utils.book_append_sheet(wb, ws, '全部资产')
      const fileName = `全部资产导出_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      toast.success(`成功导出 ${allData.length} 条资产数据`)
    } catch (error) {
      console.error('Error exporting all assets:', error)
      toast.error('导出全部数据失败')
    }
  }

  // 批量修改使用状态
  const handleBatchEditStatus = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要修改状态的资产')
      return
    }

    const statusText = getStatusText(batchStatus)
    if (!window.confirm(`确定要将选中的 ${selectedIds.length} 个资产状态修改为「${statusText}」吗？`)) {
      return
    }

    try {
      // 获取选中资产的 asset_code 列表
      const selectedAssets = assets.filter(asset => selectedIds.includes(String(asset.id)))
      const assetCodes = selectedAssets.map(a => a.asset_code)

      // 批量更新状态
      const { error } = await supabase
        .from('assets')
        .update({
          status: batchStatus,
          updated_at: new Date().toISOString()
        })
        .in('asset_code', assetCodes)

      if (error) throw error

      // 记录操作历史
      if (user) {
        const changes = `状态: ${getStatusText(selectedAssets[0]?.status || '')} → ${statusText}`
        for (const asset of selectedAssets) {
          await recordAllHistory(asset.asset_code, 'update', user.email, changes)
        }
      }

      await fetchAssets()
      setSelectedIds([])
      setIsBatchStatusDialogOpen(false)
      toast.success(`成功修改 ${selectedAssets.length} 个资产的状态`)
    } catch (error: any) {
      console.error('Error batch updating status:', error)
      toast.error(`批量修改状态失败: ${error?.message || JSON.stringify(error)}`)
    }
  }

  // 单个资产快速状态切换
  const handleQuickStatusChange = async (asset: Asset, newStatus: string) => {
    if (newStatus === asset.status) return

    try {
      const { error } = await supabase
        .from('assets')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('asset_code', asset.asset_code)

      if (error) throw error

      // 记录操作历史
      if (user) {
        const changes = `状态: ${getStatusText(asset.status)} → ${getStatusText(newStatus)}`
        await recordAllHistory(asset.asset_code, 'update', user.email, changes)
      }

      await fetchAssets()
    } catch (error: any) {
      console.error('Error quick status change:', error)
      toast.error(`状态修改失败: ${error?.message || JSON.stringify(error)}`)
    }
  }

  // 检查认证状态并导航
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="watermark" />
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">德泽智联IT资产管理系统</h1>
              <p className="text-xs text-white/70">资产管理 · 租费管理 · 统计分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{formatUserIdentifier(user?.email)}</span>
            {(user?.role === 'admin') && (
              <>
                <button onClick={() => navigate('/import')} className="btn btn-ghost !text-white !border-white/20 hover:!bg-white/10 text-sm px-3 py-1.5 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  批量导入
                </button>
                <button onClick={handleExportAll} className="btn btn-ghost !text-white !border-white/20 hover:!bg-white/10 text-sm px-3 py-1.5 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  导出全部
                </button>
                <button onClick={() => setIsAddDialogOpen(true)} className="btn btn-ghost !text-white !border-white/20 hover:!bg-white/10 text-sm px-3 py-1.5 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  新增设备
                </button>
              </>
            )}
            <div className="w-px h-6 bg-white/20 mx-1" />
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/users')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
                用户管理
              </button>
            )}
            <button onClick={() => navigate('/history')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              操作历史
            </button>
            <button onClick={() => navigate('/rent')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              月租明细
            </button>
            <button onClick={() => navigate('/settlement')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              租赁结算
            </button>
            <button onClick={() => navigate('/ai-valuation')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5" title="AI 大模型估值配置">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI估值
            </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">资产总数</p>
                <p className="text-xl font-bold text-gray-900">{allAssets.filter(a => a.status !== 'retired').length}</p>
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
                <p className="text-xs text-gray-500 font-medium">使用中</p>
                <p className="text-xl font-bold text-green-600">{allAssets.filter(a => a.status === 'active').length}</p>
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
                <p className="text-xs text-gray-500 font-medium">闲置</p>
                <p className="text-xl font-bold text-yellow-600">{allAssets.filter(a => a.status === 'idle').length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-red-50 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">维修中</p>
                <p className="text-xl font-bold text-red-600">{allAssets.filter(a => a.status === 'maintenance').length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-gray-100 text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">已报废</p>
                <p className="text-xl font-bold text-gray-600">{allAssets.filter(a => a.status === 'retired').length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">当月租金</p>
                <p className="text-xl font-bold text-indigo-600">¥{allAssets.reduce((sum, a) => sum + (Number(a.monthly_rent) || 0), 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-emerald-50 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">累计收取</p>
                <p className="text-xl font-bold text-emerald-600">¥{rentStats.accumulatedPaid.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选汇总面板：显示当前筛选结果和租金合计（带AI估值双列对比） */}
        <div className="card mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">筛选汇总</h2>
              <span className="text-sm text-gray-400">（基于下方筛选结果自动生成）</span>
              {aiEnabled ? (
                <span className="badge bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-200 text-[11px]">
                  ✨ AI 估值模式
                </span>
              ) : (
                <span className="badge bg-red-100 text-red-600 border border-red-200 text-[11px]" title="AI 估值未启用，无法估值">
                  ⚠ AI未启用
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">设备数:</span>
                  <span className="font-bold text-gray-900">{allAssets.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">月租合计:</span>
                  <span className="font-bold text-purple-600 text-lg">¥{allAssets.reduce((sum, a) => sum + (Number(a.monthly_rent) || 0), 0).toFixed(2)}</span>
                </div>
                {(() => {
                  let aiSumCurrent = 0
                  let aiSumFixed = 0
                  let aiCount = 0
                  let unvaluedCount = 0
                  for (const a of allAssets) {
                    // 三级兜底：DB 列 → state → localStorage；用户要求不要本地算法兜底
                    const v = syncResolveAIValuation(aiValuations, a as any)
                    if (v.source === 'ai' && typeof v.currentValue === 'number') {
                      aiCount++
                      aiSumCurrent += v.currentValue
                      aiSumFixed += v.fixedValue ?? v.currentValue
                    } else {
                      unvaluedCount++
                    }
                  }
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">AI购入合计:</span>
                        <span className={`font-bold ${aiCount > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                          ¥{aiSumFixed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">
                          AI当前合计
                          <span className={`ml-1 text-[11px] font-medium ${
                            aiCount === allAssets.length ? 'text-green-600 bg-green-50 px-1.5 py-0.5 rounded'
                            : unvaluedCount > 0 ? 'text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded' : 'text-gray-400'
                          }`}>
                            {aiCount === allAssets.length ? '✓ 全部已估值'
                             : unvaluedCount > 0 ? `${unvaluedCount}台待估值` : `${aiCount}台`}
                          </span>
                          :
                        </span>
                        <span className={`font-bold text-lg ${aiCount > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          ¥{aiSumCurrent.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRefreshAIValuation}
                  disabled={aiLoading || allAssets.length === 0}
                  className="btn btn-secondary text-sm !px-3 !py-1.5"
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
                <button onClick={() => setShowSummaryPanel(!showSummaryPanel)} className="btn btn-ghost text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showSummaryPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showSummaryPanel ? '收起明细' : '展开明细'}
                </button>
              </div>
            </div>
          </div>
          {showSummaryPanel && allAssets.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">资产编码</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">配置</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">部门</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">使用人</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">月租费</th>
                    <th className="text-center py-2 px-3 font-medium text-indigo-600 bg-indigo-50/50" colSpan={2}>
                      ✨ AI估值（仅此来源，不再本地兜底）
                    </th>
                  </tr>
                  <tr className="border-b border-gray-100 text-xs">
                    <th colSpan={5} />
                    <th className="text-right py-1.5 px-3 font-medium text-indigo-400 bg-indigo-50/50">购入价</th>
                    <th className="text-right py-1.5 px-3 font-medium text-indigo-400 bg-indigo-50/50">当前价</th>
                  </tr>
                </thead>
                <tbody>
                  {allAssets.slice(0, 50).map((a, i) => {
                    const aiVal = syncResolveAIValuation(aiValuations, a as any)
                    const hasAI = aiVal.source === 'ai'
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-blue-600 font-medium">{a.asset_code}</td>
                        <td className="py-2 px-3 font-mono text-xs text-gray-600">{formatHardwareSpec(a)}</td>
                        <td className="py-2 px-3">{a.department || '-'}</td>
                        <td className="py-2 px-3">{a.user_name || '-'}</td>
                        <td className="py-2 px-3 text-right font-medium text-blue-600">¥{a.monthly_rent || 0}</td>
                        <td className="py-2 px-3 text-right bg-indigo-50/40">
                          {hasAI ? (
                            <>
                              <span className="text-indigo-700 font-medium">
                                ¥{(aiVal.fixedValue ?? aiVal.currentValue!).toLocaleString()}
                              </span>
                              {aiVal.valuatedAt && (
                                <span className="block text-[10px] text-indigo-400">
                                  {new Date(aiVal.valuatedAt).toLocaleDateString('zh-CN')} 估值
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              待AI估值
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right bg-indigo-50/60">
                          {hasAI ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-indigo-700 text-base">
                                ¥{aiVal.currentValue!.toLocaleString()}
                              </span>
                              {aiVal.reason && (
                                <span className="text-[10px] text-indigo-500 truncate max-w-[150px]" title={aiVal.reason}>
                                  💡 {aiVal.reason}
                                </span>
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
                              点我估值
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-50">
                    <td colSpan={4} className="py-2 px-3 font-semibold text-gray-700 text-right">合计（{allAssets.length} 台）</td>
                    <td className="py-2 px-3 text-right font-bold text-purple-600 text-lg">
                      ¥{allAssets.reduce((sum, a) => sum + (Number(a.monthly_rent) || 0), 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-indigo-600 bg-indigo-50/40 border-l-2 border-indigo-200">
                      ¥{allAssets.reduce((sum, a) => {
                        const v = syncResolveAIValuation(aiValuations, a as any)
                        return sum + (v.source === 'ai' ? (v.fixedValue ?? v.currentValue ?? 0) : 0)
                      }, 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700 text-lg bg-indigo-50/50">
                      ¥{allAssets.reduce((sum, a) => {
                        const v = syncResolveAIValuation(aiValuations, a as any)
                        return sum + (v.source === 'ai' ? (v.currentValue ?? 0) : 0)
                      }, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {allAssets.length > 50 && (
                <p className="text-center text-gray-400 text-xs mt-2">仅显示前 50 条，共 {allAssets.length} 条筛选结果</p>
              )}
            </div>
          )}
        </div>

        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="search-wrapper flex-grow max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索资产编码、品牌、型号、使用人..."
                className="!pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="w-auto text-sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">全部部门</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                className="w-auto text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="active">使用中</option>
                <option value="idle">闲置</option>
                <option value="maintenance">维修中</option>
                <option value="retired">已报废</option>
              </select>
              <button
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className={`btn text-sm ${showAdvancedSearch ? 'btn-primary' : 'btn-secondary'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {showAdvancedSearch ? '收起筛选' : '高级筛选'}
              </button>
              <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <span className="text-gray-600">筛选月租:</span>
                <span className="font-bold text-blue-600 ml-1">¥{allAssets.reduce((sum, a) => sum + (Number(a.monthly_rent) || 0), 0).toFixed(2)}</span>
              </div>
              {selectedIds.length > 0 && (
                <>
                  <button onClick={() => setIsBatchStatusDialogOpen(true)} className="btn btn-primary text-sm">
                    批量状态 ({selectedIds.length})
                  </button>
                  <button onClick={handleBatchDelete} className="btn btn-danger text-sm">
                    批量删除 ({selectedIds.length})
                  </button>
                  <button onClick={handleBatchExportQR} className="btn btn-secondary text-sm">
                    导出二维码 ({selectedIds.length})
                  </button>
                  <button onClick={handleBatchExportDevices} className="btn btn-success text-sm">
                    导出设备 ({selectedIds.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 高级筛选面板 */}
          {showAdvancedSearch && (
            <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-100 rounded-xl slide-down">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">分类</label>
                  <select
                    className="w-full text-sm"
                    value={advancedFilters.category}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, category: e.target.value })}
                  >
                    <option value="">全部</option>
                    {categoriesFilter.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">品牌</label>
                  <input
                    type="text"
                    className="w-full text-sm"
                    placeholder="输入品牌名称"
                    value={advancedFilters.brand}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">内存 ≥ (GB)</label>
                  <input
                    type="number"
                    className="w-full text-sm"
                    placeholder="如 16"
                    value={advancedFilters.minMemory}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, minMemory: e.target.value })}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">存储 ≥ (GB)</label>
                  <input
                    type="number"
                    className="w-full text-sm"
                    placeholder="如 256"
                    value={advancedFilters.minStorage}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, minStorage: e.target.value })}
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === assets.length && assets.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  </th>
                  <th>资产编码</th>
                  <th>分类</th>
                  <th>CPU</th>
                  <th>内存</th>
                  <th>硬盘</th>
                  <th>显卡</th>
                  <th>使用人</th>
                  <th>部门</th>
                  <th>位置</th>
                  <th>品牌/型号</th>
                  <th>状态</th>
                  <th className="text-right">月租费</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="spinner" />
                        <span className="text-gray-500 text-sm">加载中...</span>
                      </div>
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        <span className="text-gray-400">暂无资产数据</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr 
                      key={asset.id} 
                      className="cursor-pointer transition-all"
                      onClick={() => navigate(`/asset/${asset.asset_code}`)}
                    >
                      <td className="w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(asset.id))}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectOne(asset.id, e.target.checked)
                          }}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                      </td>
                      <td>
                        <span className="text-sm font-medium text-blue-600">{asset.asset_code}</span>
                      </td>
                      <td><span className="text-sm">{asset.category || '-'}</span></td>
                      <td>
                        <span className="text-sm text-gray-700" title={asset.cpu}>{asset.cpu.length > 20 ? asset.cpu.slice(0, 20) + '…' : asset.cpu}</span>
                      </td>
                      <td><span className="text-sm font-medium">{formatMemory(asset.ram)}</span></td>
                      <td><span className="text-sm font-medium">{formatStorage(asset.storage)}</span></td>
                      <td><span className="text-sm text-gray-700">{asset.gpu || '-'}</span></td>
                      <td><span className="text-sm font-medium">{asset.user_name}</span></td>
                      <td><span className="text-sm">{asset.department}</span></td>
                      <td><span className="text-sm">{asset.location}</span></td>
                      <td>
                        <span className="text-sm text-gray-700">{asset.brand} <span className="text-gray-400">{asset.model}</span></span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={asset.status}
                          onChange={(e) => handleQuickStatusChange(asset, e.target.value)}
                          className={`badge border-0 cursor-pointer text-xs font-semibold ${getStatusColor(asset.status)}`}
                          style={{ padding: '0.15rem 0.625rem' }}
                        >
                          <option value="active">使用中</option>
                          <option value="idle">闲置</option>
                          <option value="maintenance">维修中</option>
                          <option value="retired">已报废</option>
                        </select>
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-medium">{asset.monthly_rent ? `¥${asset.monthly_rent}` : '-'}</span>
                      </td>
                      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleEdit(asset)} className="btn btn-ghost text-blue-600 hover:text-blue-800 text-xs !px-2 !py-1">
                          编辑
                        </button>
                        <button onClick={() => navigate(`/asset/${asset.asset_code}`)} className="btn btn-ghost text-gray-600 hover:text-gray-800 text-xs !px-2 !py-1">
                          详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* 分页 */}
          <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-3">
            <div className="text-sm text-gray-500">
              显示 <span className="font-medium text-gray-700">{((page - 1) * pageSize) + 1}</span> 到 <span className="font-medium text-gray-700">{Math.min(page * pageSize, totalAssets)}</span> 条，共 <span className="font-medium text-gray-700">{totalAssets}</span> 条
            </div>
            <div className="flex items-center gap-3">
              <select
                className="w-auto text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value))
                  setPage(1)
                }}
              >
                <option value={5}>5条/页</option>
                <option value={10}>10条/页</option>
                <option value={20}>20条/页</option>
                <option value={50}>50条/页</option>
                <option value={100}>100条/页</option>
              </select>
              <div className="flex items-center gap-1">
                <button
                  className="pagination-btn"
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="pagination-btn active">{page}</span>
                <button
                  className="pagination-btn"
                  onClick={() => setPage(prev => Math.min(prev + 1, Math.ceil(totalAssets / pageSize)))}
                  disabled={page >= Math.ceil(totalAssets / pageSize)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 添加资产对话框 */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">新增资产</h2>
              <button
                onClick={() => setIsAddDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">型号</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">分类</label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">请选择分类</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">CPU</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.cpu}
                    onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">内存</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.ram}
                    onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">存储</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.storage}
                    onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">显卡</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.gpu}
                    onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">操作系统</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.os}
                    onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">状态</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                  >
                    <option value="active">使用中</option>
                    <option value="idle">闲置</option>
                    <option value="maintenance">维修中</option>
                    <option value="retired">已报废</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">部门</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">使用人</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">位置</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">月租费（元）</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.monthly_rent}
                    onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">备注</label>
                <textarea
                  className="input"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑资产对话框 */}
      {isEditDialogOpen && editingAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">编辑资产</h2>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?.role === 'admin' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                      <select
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        <option value="">请选择分类</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPU</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.cpu}
                        onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">内存</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.ram}
                        onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">存储</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.storage}
                        onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">显卡</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.gpu}
                        onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">操作系统</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.os}
                        onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                      <select
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        required
                      >
                        <option value="active">使用中</option>
                        <option value="idle">闲置</option>
                        <option value="maintenance">维修中</option>
                        <option value="retired">已报废</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">月租费（元）</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.monthly_rent}
                    onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 批量修改状态对话框 */}
      {isBatchStatusDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">批量修改状态</h2>
              <button
                onClick={() => setIsBatchStatusDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                将选中的 <span className="font-bold text-blue-600">{selectedIds.length}</span> 个资产的状态修改为：
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标状态</label>
                <select
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value)}
                >
                  <option value="active">使用中</option>
                  <option value="idle">闲置</option>
                  <option value="maintenance">维修中</option>
                  <option value="retired">已报废</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsBatchStatusDialogOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchEditStatus}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  确认修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
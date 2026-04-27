import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, type Asset, type AssetCategory, initDatabase } from '../lib/supabase'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'

// 注册 Chart.js 组件
ChartJS.register(ArcElement, Tooltip, Legend)

export default function Index() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, signOut, loading: authLoading } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    cpu: '',
    ram: '',
    storage: '',
    gpu: '',
    os: '',
    department: '',
    user_name: '',
    location: '',
    status: 'active',
    notes: ''
  })
  // 分页相关状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50) // 默认50条一页
  const [totalAssets, setTotalAssets] = useState(0)
  // 筛选相关状态
  const [statusFilter, setStatusFilter] = useState('all') // all, active, idle, maintenance
  const [departmentFilter, setDepartmentFilter] = useState('all')
  // 全部资产数据（用于汇总统计）
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  
  // 计算资产状态分布数据
  const getStatusDistribution = () => {
    const statusCounts = allAssets.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      labels: Object.keys(statusCounts).map(status => 
        status === 'active' ? '使用中' : 
        status === 'idle' ? '闲置' : '维修中'
      ),
      datasets: [
        {
          data: Object.values(statusCounts),
          backgroundColor: [
            '#22c55e', // 绿色 - 使用中
            '#f59e0b', // 黄色 - 闲置
            '#ef4444', // 红色 - 维修中
          ],
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

  // 从Supabase中获取资产数据
  const fetchAssets = async () => {
    console.log('Index: Fetching assets')
    setLoading(true)
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
      const { data: allData } = await allQuery
      setAllAssets(allData || [])
      
      // 2. 获取分页数据
      // 计算偏移量
      const offset = (page - 1) * pageSize
      
      // 获取资产数据，带分页
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
      const { data, error, count } = await query.range(offset, offset + pageSize - 1)
      if (error) throw error
      setAssets(data || [])
      setTotalAssets(count || 0)
      console.log('Index: Assets fetched successfully', data)
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssets()
  }, [])

  useEffect(() => {
    // 添加防抖，避免频繁请求
    const timer = setTimeout(() => {
      // 重置页码到第一页
      setPage(1)
      fetchAssets()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchAssets()
  }, [page, pageSize, statusFilter, departmentFilter])

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

  // 资产数据现在通过数据库查询直接过滤，不再需要前端过滤

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(assets.map(asset => asset.id.toString()))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  const generateAssetCode = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const count = String(assets.length + 1).padStart(3, '0')
    return `PC-${year}-${month}-${count}`
  }

  // 格式化内存显示
  const formatMemory = (memory: string) => {
    try {
      const num = parseFloat(memory)
      if (!isNaN(num)) {
        // 四舍五入到最近的整数
        const rounded = Math.round(num)
        return `${rounded}GB`
      }
    } catch (error) {
      console.error('Error formatting memory:', error)
    }
    return memory
  }

  // 格式化存储显示
  const formatStorage = (storage: string) => {
    try {
      const num = parseFloat(storage)
      if (!isNaN(num)) {
        // 四舍五入到最近的整数
        const rounded = Math.round(num)
        if (rounded >= 1000) {
          // 大于等于1000GB显示为TB
          return `${(rounded / 1000).toFixed(1)}TB`
        } else {
          // 小于1000GB显示为GB
          return `${rounded}GB`
        }
      }
    } catch (error) {
      console.error('Error formatting storage:', error)
    }
    return storage
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
      department: '',
      user_name: '',
      location: '',
      status: 'active',
      notes: ''
    })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const assetData = {
        ...formData,
        asset_code: generateAssetCode()
      }
      console.log('Index: Creating asset with data:', assetData)
      const { data, error } = await supabase.from('assets').insert(assetData)
      if (error) throw error
      console.log('Index: Asset created successfully:', data)
      
      // 记录操作历史
      if (user) {
        console.log('Index: Recording operation history for create')
        try {
          // 使用资产编码作为唯一标识
          const historyData = {
            asset_code: data[0].asset_code,
            operation_type: 'create',
            user_email: user.email,
            created_at: new Date().toISOString()
          }
          console.log('Index: Inserting operation history with data:', historyData)
          
          // 尝试插入操作历史
          const { data: historyResult, error: historyError } = await supabase.from('operation_history').insert(historyData)
          
          if (historyError) {
            console.error('Index: Error recording operation history:', historyError)
            alert(`资产创建成功，但操作历史记录失败: ${historyError.message}`)
          } else {
            console.log('Index: Operation history recorded successfully for create:', historyResult)
          }
        } catch (historyError) {
          console.error('Index: Exception recording operation history:', historyError)
          alert(`资产创建成功，但操作历史记录失败: ${historyError.message}`)
        }
      }
      
      await fetchAssets()
      setIsAddDialogOpen(false)
      resetForm()
      alert('资产添加成功')
    } catch (error) {
      console.error('Error adding asset:', error)
      alert('资产添加失败')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingAsset) {
      try {
        // 权限控制：普通用户只能修改使用人、位置、部门等信息
        let updateData = formData
        if (user && user.role !== 'admin') {
          updateData = {
            user_name: formData.user_name,
            location: formData.location,
            department: formData.department
          }
        }
        
        console.log('Index: Updating asset with data:', updateData)
        const { data, error } = await supabase.from('assets').update(updateData).eq('id', editingAsset.id)
        if (error) throw error
        console.log('Index: Asset updated successfully')
        
        // 记录操作历史
        if (user) {
          console.log('Index: Recording operation history for update')
          try {
            // 使用资产编码作为唯一标识
            const historyData = {
              asset_code: editingAsset.asset_code,
              operation_type: 'update',
              user_email: user.email,
              created_at: new Date().toISOString()
            }
            console.log('Index: Inserting operation history with data:', historyData)
            
            // 尝试插入操作历史
            const { data: historyResult, error: historyError } = await supabase.from('operation_history').insert(historyData)
            
            if (historyError) {
              console.error('Index: Error recording operation history:', historyError)
              alert(`资产更新成功，但操作历史记录失败: ${historyError.message}`)
            } else {
              console.log('Index: Operation history recorded successfully for update:', historyResult)
            }
          } catch (historyError) {
            console.error('Index: Exception recording operation history:', historyError)
            alert(`资产更新成功，但操作历史记录失败: ${historyError.message}`)
          }
        }
        
        await fetchAssets()
        setIsEditDialogOpen(false)
        setEditingAsset(null)
        resetForm()
        alert('资产更新成功')
      } catch (error) {
        console.error('Error updating asset:', error)
        alert('资产更新失败')
      }
    }
  }

  const handleEdit = (asset: any) => {
    setEditingAsset(asset)
    // 权限控制：普通用户只能修改使用人、位置、部门等信息
    if (user && user.role !== 'admin') {
      setFormData({
        brand: asset.brand || '',
        model: asset.model || '',
        cpu: asset.cpu || '',
        ram: asset.ram || '',
        storage: asset.storage || '',
        gpu: asset.gpu || '',
        os: asset.os || '',
        department: asset.department || '',
        user_name: asset.user_name || '',
        location: asset.location || '',
        status: asset.status || 'active',
        notes: asset.notes || ''
      })
    } else {
      setFormData({
        brand: asset.brand || '',
        model: asset.model || '',
        cpu: asset.cpu || '',
        ram: asset.ram || '',
        storage: asset.storage || '',
        gpu: asset.gpu || '',
        os: asset.os || '',
        department: asset.department || '',
        user_name: asset.user_name || '',
        location: asset.location || '',
        status: asset.status || 'active',
        notes: asset.notes || ''
      })
    }
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    // 权限控制：只有管理员可以删除资产
    if (user && user.role !== 'admin') {
      alert('只有管理员可以删除资产')
      return
    }
    
    if (confirm('确定要删除这个资产吗？')) {
      try {
        // 获取要删除的资产信息
        const { data: asset, error: getError } = await supabase.from('assets').select('*').eq('id', id).single()
        if (getError) throw getError
        
        const { data, error } = await supabase.from('assets').delete().eq('id', id)
        if (error) throw error
        
        // 记录操作历史
        if (user) {
          console.log('Index: Recording operation history for delete')
          try {
            // 使用资产编码作为唯一标识
            const historyData = {
              asset_code: asset.asset_code,
              operation_type: 'delete',
              user_email: user.email,
              created_at: new Date().toISOString()
            }
            console.log('Index: Inserting operation history with data:', historyData)
            
            // 尝试插入操作历史
            const { data: historyResult, error: historyError } = await supabase.from('operation_history').insert(historyData)
            
            if (historyError) {
              console.error('Index: Error recording operation history:', historyError)
              alert(`资产删除成功，但操作历史记录失败: ${historyError.message}`)
            } else {
              console.log('Index: Operation history recorded successfully for delete:', historyResult)
            }
          } catch (historyError) {
            console.error('Index: Exception recording operation history:', historyError)
            alert(`资产删除成功，但操作历史记录失败: ${historyError.message}`)
          }
        }
        
        await fetchAssets()
        alert('资产删除成功')
      } catch (error) {
        console.error('Error deleting asset:', error)
        alert('资产删除失败')
      }
    }
  }

  const handleBatchDelete = async () => {
    // 权限控制：只有管理员可以批量删除资产
    if (user && user.role !== 'admin') {
      alert('只有管理员可以批量删除资产')
      return
    }
    
    if (selectedIds.length === 0) {
      alert('请选择要删除的资产')
      return
    }
    if (confirm(`确定要删除选中的 ${selectedIds.length} 个资产吗？`)) {
      try {
        for (const id of selectedIds) {
          // 获取要删除的资产信息
          const { data: asset, error: getError } = await supabase.from('assets').select('*').eq('id', id).single()
          if (getError) throw getError
          
          const { data, error } = await supabase.from('assets').delete().eq('id', id)
          if (error) throw error
          
          // 记录操作历史
          if (user) {
            try {
              // 使用资产编码作为唯一标识
              const historyData = {
                asset_code: asset.asset_code,
                operation_type: 'delete',
                user_email: user.email,
                created_at: new Date().toISOString()
              }
              
              // 尝试插入操作历史
              await supabase.from('operation_history').insert(historyData)
            } catch (historyError) {
              console.error('Index: Error recording operation history for delete:', historyError)
            }
          }
        }
        
        await fetchAssets()
        setSelectedIds([])
        alert('资产批量删除成功')
      } catch (error) {
        console.error('Error batch deleting assets:', error)
        alert('资产批量删除失败')
      }
    }
  }

  const handleBatchExportQR = async () => {
    // 权限控制：只有管理员可以批量导出二维码
    if (user && user.role !== 'admin') {
      alert('只有管理员可以批量导出二维码')
      return
    }
    
    if (selectedIds.length === 0) {
      alert('请选择要导出二维码的资产')
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
      
      // 生成HTML页面
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
      
      // 创建并下载文件
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `资产二维码_${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('二维码导出成功')
    } catch (error) {
      console.error('Error exporting QR codes:', error)
      alert('二维码导出失败')
    }
  }

  // 批量导出设备数据
  const handleBatchExportDevices = async () => {
    // 权限控制：只有管理员可以批量导出设备
    if (user && user.role !== 'admin') {
      alert('只有管理员可以批量导出设备')
      return
    }
    
    if (selectedIds.length === 0) {
      alert('请选择要导出的设备')
      return
    }
    
    try {
      console.log('Index: Starting batch device export for', selectedIds.length, 'assets')
      
      // 筛选出选中的资产
      const selectedAssets = assets.filter(asset => selectedIds.includes(asset.id))
      
      if (selectedAssets.length === 0) {
        alert('没有找到可导出的设备')
        return
      }
      
      // 生成CSV内容
      const headers = ['资产编码', '品牌', '型号', 'CPU', '内存', '存储', '显卡', '操作系统', '部门', '使用人', '位置', '状态', '备注']
      const csvContent = [
        headers.join(','),
        ...selectedAssets.map(asset => [
          asset.asset_code,
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
          asset.status === 'active' ? '使用中' : asset.status === 'idle' ? '闲置' : '维修中',
          asset.notes || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `设备导出_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('设备导出成功')
      console.log('Index: Batch device export completed successfully')
    } catch (error) {
      console.error('Error exporting devices:', error)
      alert('设备导出失败')
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">德泽智联IT资产管理系统</h1>
          <div className="flex items-center gap-2">
            <span>{user?.email}</span>
            {(user?.role === 'admin') && (
              <>
                <button
                  onClick={() => navigate('/import')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
                >
                  批量导入
                </button>
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
                >
                  新增设备
                </button>
                <button
                  onClick={() => navigate('/users')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
                >
                  用户管理
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
                >
                  操作历史
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/change-password')}
              className="bg-white text-green-600 px-3 py-1 rounded text-sm font-medium hover:bg-green-50"
            >
              修改密码
            </button>
            <button
              onClick={signOut}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" style={{ position: 'relative', minHeight: '80vh' }}>
        {/* 水印 */}
        <div style={{ 
          position: 'fixed', 
          top: '0', 
          left: '0', 
          right: '0', 
          bottom: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.15, 
          zIndex: -1,
          pointerEvents: 'none',
          background: 'transparent'
        }}>
          <div style={{ 
            transform: 'rotate(-30deg)',
            whiteSpace: 'nowrap',
            fontSize: '120px',
            fontWeight: 'bold',
            color: '#059669',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            德泽智联IT资产管理系统
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">资产总数</p>
                <p className="text-2xl font-bold">{allAssets.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">使用中</p>
                <p className="text-2xl font-bold">{allAssets.filter(a => a.status === 'active').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">闲置</p>
                <p className="text-2xl font-bold">{allAssets.filter(a => a.status === 'idle').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">报废</p>
                <p className="text-2xl font-bold">{allAssets.filter(a => a.status === 'maintenance').length}</p>
              </div>
            </div>
          </div>
        </div>



        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="搜索资产编码、品牌、使用人..."
                className="w-full px-4 py-2 border rounded text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="px-3 py-2 border rounded text-sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">全部部门</option>
                {/* 部门选项会根据实际数据动态生成 */}
                {[...new Set(allAssets.map(a => a.department))].filter(d => d).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border rounded text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="active">使用中</option>
                <option value="idle">闲置</option>
                <option value="maintenance">维修中</option>
              </select>
              {selectedIds.length > 0 && (
                <>
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    批量删除 ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleBatchExportQR}
                    className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                  >
                    批量导出二维码 ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleBatchExportDevices}
                    className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    批量导出设备 ({selectedIds.length})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto" style={{ maxWidth: '80%', margin: '0 auto' }}>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === assets.length && assets.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产编码</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">硬盘</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">显卡</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用人</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌/型号</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center">
                      加载中...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center">
                      无资产数据
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr 
                      key={asset.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/asset/${asset.asset_code}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(asset.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectOne(asset.id, e.target.checked)
                          }}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{asset.asset_code}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{asset.cpu}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatMemory(asset.ram)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatStorage(asset.storage)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{asset.gpu || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{asset.user_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{asset.department}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{asset.location}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{asset.brand} {asset.model}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.status === 'active' ? 'bg-green-100 text-green-800' : asset.status === 'idle' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {asset.status === 'active' ? '使用中' : asset.status === 'idle' ? '闲置' : '维修中'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* 分页控件 */}
          <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4" style={{ maxWidth: '80%', margin: '0 auto' }}>
            <div className="text-sm text-gray-600">
              显示 {((page - 1) * pageSize) + 1} 到 {Math.min(page * pageSize, totalAssets)} 条，共 {totalAssets} 条
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value))
                  setPage(1)
                }}
                style={{ width: '100px' }}
              >
                <option value={5}>5条/页</option>
                <option value={10}>10条/页</option>
                <option value={20}>20条/页</option>
                <option value={50}>50条/页</option>
              </select>
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <span className="px-3 py-2 bg-gray-100 rounded text-sm">
                  {page}
                </span>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => setPage(prev => Math.min(prev + 1, Math.ceil(totalAssets / pageSize)))}
                  disabled={page >= Math.ceil(totalAssets / pageSize)}
                >
                  下一页
                </button>
              </div>
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
              </div>
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
    </div>
  )
}

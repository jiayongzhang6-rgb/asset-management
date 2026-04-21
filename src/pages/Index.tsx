import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, type Asset } from '../lib/supabase'

export default function Index() {
  const navigate = useNavigate()
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

  // 从Supabase中获取资产数据
  const fetchAssets = async () => {
    console.log('Index: Fetching assets')
    setLoading(true)
    try {
      const { data, error } = await supabase.from('assets').select('*')
      if (error) throw error
      setAssets(data || [])
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

  const filteredAssets = assets.filter(asset =>
    asset.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAssets.map(asset => asset.id))
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const assetData = {
        ...formData,
        asset_code: generateAssetCode()
      }
      const { data, error } = await supabase.from('assets').insert(assetData)
      if (error) throw error
      
      // 记录操作历史
      if (user) {
        await supabase.from('operation_history').insert({
          asset_id: data[0].id,
          operation_type: 'create',
          new_data: assetData,
          user_email: user.email
        })
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
        
        const { data, error } = await supabase.from('assets').update(updateData).eq('id', editingAsset.id)
        if (error) throw error
        
        // 记录操作历史
        if (user) {
          await supabase.from('operation_history').insert({
            asset_id: editingAsset.id,
            operation_type: 'update',
            old_data: editingAsset,
            new_data: updateData,
            user_email: user.email
          })
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
          await supabase.from('operation_history').insert({
            asset_id: id,
            operation_type: 'delete',
            old_data: asset,
            user_email: user.email
          })
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
            await supabase.from('operation_history').insert({
              asset_id: id,
              operation_type: 'delete',
              old_data: asset,
              user_email: user.email
            })
          }
        }
        await fetchAssets()
        setSelectedIds([])
        alert('资产删除成功')
      } catch (error) {
        console.error('Error deleting assets:', error)
        alert('资产删除失败')
      }
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
      department: '',
      user_name: '',
      location: '',
      status: 'active',
      notes: ''
    })
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleBatchExportQR = async () => {
    if (selectedIds.length === 0) {
      alert('请选择要导出二维码的资产')
      return
    }

    try {
      // 导入QRCode库
      const QRCode = (await import('qrcode')).default
      
      // 为每个选中的资产生成二维码
      const qrPromises = selectedIds.map(async (id) => {
        const asset = assets.find(a => a.id === id)
        if (asset) {
          const qrData = `${window.location.origin}/asset/${asset.id}`
          const url = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2
          })
          return { asset, url }
        }
        return null
      })

      const qrResults = await Promise.all(qrPromises)
      const validResults = qrResults.filter(result => result !== null)

      // 创建一个包含所有二维码的HTML页面
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>资产二维码</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            .qr-container {
              display: inline-block;
              margin: 10px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code {
              border: 1px solid #ddd;
              padding: 10px;
              background: white;
            }
            .asset-info {
              margin-top: 10px;
              font-size: 12px;
              max-width: 200px;
            }
            @media print {
              body {
                margin: 0;
              }
              .qr-container {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>资产二维码</h1>
          <div class="qr-grid">
      `

      validResults.forEach((result: any) => {
        html += `
          <div class="qr-container">
            <div class="qr-code">
              <img src="${result.url}" alt="${result.asset.asset_code}" />
            </div>
            <div class="asset-info">
              <p><strong>资产编码:</strong> ${result.asset.asset_code}</p>
              <p><strong>品牌:</strong> ${result.asset.brand}</p>
              <p><strong>型号:</strong> ${result.asset.model}</p>
              <p><strong>使用人:</strong> ${result.asset.user_name}</p>
            </div>
          </div>
        `
      })

      html += `
          </div>
        </body>
        </html>
      `

      // 创建一个Blob对象
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      // 创建一个a标签并点击它来下载
      const a = document.createElement('a')
      a.href = url
      a.download = `资产二维码_${new Date().toISOString().slice(0, 10)}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // 释放URL对象
      URL.revokeObjectURL(url)

      alert('二维码导出成功')
    } catch (error) {
      console.error('Error exporting QR codes:', error)
      alert('二维码导出失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      active: '使用中',
      idle: '闲置',
      maintenance: '维修中'
    }
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      idle: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white shadow">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">IT资产管理系统</h1>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm">{user?.email}</span>
                {user && user.role === 'admin' && (
                  <>
                    <button
                      onClick={() => navigate('/import')}
                      className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                    >
                      批量导入
                    </button>
                    <button
                      onClick={() => setIsAddDialogOpen(true)}
                      className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                    >
                      + 新增设备
                    </button>
                    <button
                      onClick={() => navigate('/history')}
                      className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                    >
                      操作历史
                    </button>
                    <button
                      onClick={handleBatchExportQR}
                      className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                    >
                      批量导出二维码
                    </button>
                  </>
                )}
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
                >
                  退出
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <i className="fa fa-desktop text-blue-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">资产总数</p>
                <p className="text-2xl font-bold">{assets.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <i className="fa fa-check-circle text-green-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">使用中</p>
                <p className="text-2xl font-bold">{assets.filter(a => a.status === 'active').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <i className="fa fa-clock-o text-yellow-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">闲置</p>
                <p className="text-2xl font-bold">{assets.filter(a => a.status === 'idle').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <i className="fa fa-trash text-red-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">报废</p>
                <p className="text-2xl font-bold">{assets.filter(a => a.status === 'maintenance').length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索资产编码、品牌、使用人..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全部部门</option>
              </select>
              <select className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全部状态</option>
              </select>
            </div>
            {isAuthenticated && selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                删除选中 ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    {isAuthenticated && (
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredAssets.length && filteredAssets.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产编码</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">存储</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">显卡</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作系统</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌型号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  {isAuthenticated && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">操作</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/asset/${asset.id}`)}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isAuthenticated && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(asset.id)}
                          onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.asset_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.cpu}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.ram}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.storage}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.gpu || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.os}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.user_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.brand} {asset.model}</td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(asset.status)}</td>
                    {isAuthenticated && (
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(asset)}
                            className="text-blue-500 hover:underline"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="text-red-500 hover:underline"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              没有找到资产
            </div>
          )}
        </div>
      </main>

      {/* 添加资产对话框 */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">添加新资产</h3>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">品牌</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">型号</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">CPU</label>
                    <input
                      type="text"
                      value={formData.cpu}
                      onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">内存</label>
                    <input
                      type="text"
                      value={formData.ram}
                      onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">存储</label>
                    <input
                      type="text"
                      value={formData.storage}
                      onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">显卡</label>
                    <input
                      type="text"
                      value={formData.gpu}
                      onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">操作系统</label>
                    <input
                      type="text"
                      value={formData.os}
                      onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">部门</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">用户</label>
                    <input
                      type="text"
                      value={formData.user_name}
                      onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">位置</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">状态</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">使用中</option>
                      <option value="idle">闲置</option>
                      <option value="maintenance">维修中</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">备注</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex-1">
                    添加资产
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddDialogOpen(false)
                      resetForm()
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 编辑资产对话框 */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">编辑资产</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* 管理员可以修改所有信息 */}
                {user && user.role === 'admin' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 mb-2">品牌</label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">型号</label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">CPU</label>
                      <input
                        type="text"
                        value={formData.cpu}
                        onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">内存</label>
                      <input
                        type="text"
                        value={formData.ram}
                        onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">存储</label>
                      <input
                        type="text"
                        value={formData.storage}
                        onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">显卡</label>
                      <input
                        type="text"
                        value={formData.gpu}
                        onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">操作系统</label>
                      <input
                        type="text"
                        value={formData.os}
                        onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                )}
                
                {/* 所有用户都可以修改的信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">部门</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">用户</label>
                    <input
                      type="text"
                      value={formData.user_name}
                      onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">位置</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {user && user.role === 'admin' && (
                    <div>
                      <label className="block text-gray-700 mb-2">状态</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">使用中</option>
                        <option value="idle">闲置</option>
                        <option value="maintenance">维修中</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {/* 管理员可以修改备注 */}
                {user && user.role === 'admin' && (
                  <div>
                    <label className="block text-gray-700 mb-2">备注</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex-1">
                    更新资产
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditDialogOpen(false)
                      setEditingAsset(null)
                      resetForm()
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
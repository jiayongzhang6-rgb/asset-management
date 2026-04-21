import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Asset } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Index() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
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

  const fetchAssets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssets(data || [])
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
      const { error } = await supabase.from('assets').insert([assetData])
      if (error) throw error
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
        const { error } = await supabase.from('assets').update(formData).eq('id', editingAsset.id)
        if (error) throw error
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

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset)
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
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个资产吗？')) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', id)
        if (error) throw error
        await fetchAssets()
        alert('资产删除成功')
      } catch (error) {
        console.error('Error deleting asset:', error)
        alert('资产删除失败')
      }
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert('请选择要删除的资产')
      return
    }
    if (confirm(`确定要删除选中的 ${selectedIds.length} 个资产吗？`)) {
      try {
        const { error } = await supabase.from('assets').delete().in('id', selectedIds)
        if (error) throw error
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">资产管理系统</h1>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/import')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                导入
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">资产列表</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索资产..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {isAuthenticated && (
                <>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={handleBatchDelete}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      删除选中 ({selectedIds.length})
                    </button>
                  )}
                  <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    添加资产
                  </button>
                </>
              )}
            </div>
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
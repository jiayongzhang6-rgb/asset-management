﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, type Asset, type MaintenanceRecord } from '../lib/supabase'

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user, signOut, loading: authLoading } = useAuth()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false)
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false)
  const [isEditMaintenanceDialogOpen, setIsEditMaintenanceDialogOpen] = useState(false)
  const [editingMaintenanceRecord, setEditingMaintenanceRecord] = useState<MaintenanceRecord | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [assetHistory, setAssetHistory] = useState<any[]>([])
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
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    issue_description: '',
    repair_description: '',
    repair_date: '',
    repair_cost: 0,
    status: 'pending'
  })



  // 从Supabase中获取资产数据
  const fetchAsset = async () => {
    console.log('AssetDetail: fetchAsset called with asset code:', id)
    if (!id) {
      console.error('AssetDetail: No asset code provided')
      return
    }
    setLoading(true)
    try {
      console.log('AssetDetail: Fetching asset with code:', id)
      
      // 尝试获取资产数据，最多重试3次
      let retries = 3
      let data = null
      let error = null
      
      while (retries > 0) {
        console.log(`AssetDetail: Attempt ${4 - retries} of 3`)
        try {
          // 增加超时设置
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
          
          const result = await supabase.from('assets').select('*').eq('asset_code', id).single({ signal: controller.signal })
          clearTimeout(timeoutId)
          
          data = result.data
          error = result.error
          
          console.log('AssetDetail: Result from supabase:', { data, error })
          
          if (!error) {
            break
          }
          
          console.error('AssetDetail: Error fetching asset:', error)
          retries--
          
          if (retries > 0) {
            console.log('AssetDetail: Retrying to fetch asset...')
            // 等待2秒后重试，增加等待时间
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        } catch (e) {
          console.error('AssetDetail: Exception during fetch:', e)
          retries--
          
          if (retries > 0) {
            console.log('AssetDetail: Retrying to fetch asset...')
            // 等待2秒后重试，增加等待时间
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      if (error) {
        console.error('AssetDetail: Final error fetching asset:', error)
        // 显示更友好的错误信息
        alert(`无法获取资产数据: ${error.message}\n请检查网络连接后重试`)
      } else if (data) {
        console.log('AssetDetail: Asset fetched successfully:', data)
        setAsset(data)
        setFormData({
          brand: data.brand || '',
          model: data.model || '',
          cpu: data.cpu || '',
          ram: data.ram || '',
          storage: data.storage || '',
          gpu: data.gpu || '',
          os: data.os || '',
          department: data.department || '',
          user_name: data.user_name || '',
          location: data.location || '',
          status: data.status || 'active',
          notes: data.notes || ''
        })
      } else {
        console.error('AssetDetail: No data returned from supabase')
        alert('无法获取资产数据，请检查网络连接后重试')
      }
    } catch (error) {
      console.error('AssetDetail: Exception fetching asset:', error)
      // 显示更友好的错误信息
      alert(`无法获取资产数据: ${error.message}\n请检查网络连接后重试`)
    } finally {
      setLoading(false)
    }
  }

  // 从Supabase中获取资产历史
  const fetchAssetHistory = async () => {
    if (!id || !asset) return
    try {
      const { data, error } = await supabase
        .from('operation_history')
        .select('*')
        .eq('asset_code', asset.asset_code)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssetHistory(data || [])
      console.log('AssetDetail: Asset history fetched successfully', data)
    } catch (error) {
      console.error('Error fetching asset history:', error)
    }
  }

  // 从Supabase中获取维修记录
  const fetchMaintenanceRecords = async () => {
    if (!id || !asset) return
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMaintenanceRecords(data || [])
      console.log('AssetDetail: Maintenance records fetched successfully', data)
    } catch (error) {
      console.error('Error fetching maintenance records:', error)
    }
  }

  useEffect(() => {
    fetchAsset()
  }, [id])

  useEffect(() => {
    fetchAssetHistory()
    fetchMaintenanceRecords()
  }, [asset])

 const handleEditSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (asset) {
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
      
      console.log('AssetDetail: Updating asset with data:', updateData)
      console.log('AssetDetail: Asset id type:', typeof asset.id, asset.id, asset)
      const { data, error } = await supabase.from('assets').update(updateData).eq('id', asset.id)
      if (error) throw error
      console.log('AssetDetail: Asset updated successfully')
      
      // 记录操作历史
      if (user && asset && asset.asset_code) {
        console.log('AssetDetail: Recording operation history for update')
        console.log('AssetDetail: Asset code for history:', asset.asset_code)
        try {
          const historyData = {
            asset_code: asset.asset_code,
            operation_type: 'update',
            user_email: user.email,
            created_at: new Date().toISOString()
          }
          console.log('AssetDetail: Inserting operation history with data:', historyData)
          const { data: historyResult, error: historyError } = await supabase.from('operation_history').insert(historyData)
          if (historyError) {
            console.error('AssetDetail: Error recording operation history:', historyError)
          } else {
            console.log('AssetDetail: Operation history recorded successfully for update:', historyResult)
          }
        } catch (historyError) {
          console.error('AssetDetail: Exception recording operation history:', historyError)
        }
      } else {
        console.warn('AssetDetail: Cannot record operation history - asset or asset.asset_code is missing:', asset)
      }
      
      await fetchAsset()
      await fetchAssetHistory()
      setIsEditDialogOpen(false)
      alert('资产更新成功')
    } catch (error) {
      console.error('Error updating asset:', error)
      alert('资产更新失败')
    }
  }
}

 const handleDelete = async () => {
  // 权限控制：只有管理员可以删除资产
  if (user && user.role !== 'admin') {
    alert('只有管理员可以删除资产')
    return
  }
  
  if (asset && confirm('确定要删除这个资产吗？')) {
    try {
      const { data, error } = await supabase.from('assets').delete().eq('id', parseInt(asset.id))
      if (error) throw error
      
      // 记录操作历史
      if (user) {
        console.log('AssetDetail: Recording operation history for delete')
        try {
          const historyData = {
            asset_code: asset.asset_code,
            operation_type: 'delete',
            user_email: user.email,
            created_at: new Date().toISOString()
          }
          console.log('AssetDetail: Inserting operation history with data:', historyData)
          const { data: historyResult, error: historyError } = await supabase.from('operation_history').insert(historyData)
          if (historyError) {
            console.error('AssetDetail: Error recording operation history:', historyError)
          } else {
            console.log('AssetDetail: Operation history recorded successfully for delete:', historyResult)
          }
        } catch (historyError) {
          console.error('AssetDetail: Exception recording operation history:', historyError)
        }
      }
      
      navigate('/')
    } catch (error) {
      console.error('Error deleting asset:', error)
      alert('资产删除失败')
    }
  }
}

  const generateQRCode = async () => {
    if (!asset) return
    try {
      const QRCode = (await import('qrcode')).default
      const qrData = `${window.location.origin}?action=edit&id=${asset.id}`
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2
      })
      setQrCodeUrl(url)
      return url
    } catch (error) {
      console.error('Error generating QR code:', error)
      return ''
    }
  }

  const handleGenerateQR = async () => {
    const url = await generateQRCode()
    if (url) {
      setIsQRDialogOpen(true)
    }
  }

  const handleAddMaintenance = () => {
    setEditingMaintenanceRecord(null)
    setMaintenanceFormData({
      issue_description: '',
      repair_description: '',
      repair_date: '',
      repair_cost: 0,
      status: 'pending'
    })
    setIsMaintenanceDialogOpen(true)
  }

  const handleEditMaintenance = (record: MaintenanceRecord) => {
    setEditingMaintenanceRecord(record)
    setMaintenanceFormData({
      issue_description: record.issue_description,
      repair_description: record.repair_description || '',
      repair_date: record.repair_date || '',
      repair_cost: record.repair_cost || 0,
      status: record.status
    })
    setIsEditMaintenanceDialogOpen(true)
  }

  const handleDeleteMaintenance = async (recordId: number) => {
    if (confirm('确定要删除这条维修记录吗？')) {
      try {
        const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId)
        if (error) throw error
        await fetchMaintenanceRecords()
        alert('维修记录删除成功')
      } catch (error) {
        console.error('Error deleting maintenance record:', error)
        alert('维修记录删除失败')
      }
    }
  }

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asset) return
    
    try {
      if (editingMaintenanceRecord) {
        // 更新现有维修记录
        const { error } = await supabase
          .from('maintenance_records')
          .update(maintenanceFormData)
          .eq('id', editingMaintenanceRecord.id)
        if (error) throw error
        setIsEditMaintenanceDialogOpen(false)
        alert('维修记录更新成功')
      } else {
        // 添加新维修记录
        const { error } = await supabase
          .from('maintenance_records')
          .insert({
            ...maintenanceFormData,
            asset_id: parseInt(asset.id)
          })
        if (error) throw error
        setIsMaintenanceDialogOpen(false)
        alert('维修记录添加成功')
      }
      await fetchMaintenanceRecords()
    } catch (error) {
      console.error('Error saving maintenance record:', error)
      alert('维修记录保存失败')
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  // 修复：将 navigate() 调用移到 useEffect 中
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">资产不存在</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">IT资产管理系统</h1>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{user?.email}</span>
            {(user?.role === 'admin') && (
              <>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  返回列表
                </button>
                <button
                  onClick={() => navigate('/import')}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  批量导入
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  操作历史
                </button>
                <button
                  onClick={() => navigate('/users')}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                >
                  用户管理
                </button>
              </>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold">资产详情</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditDialogOpen(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                编辑
              </button>
              <button
                onClick={handleGenerateQR}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                查看二维码
              </button>
              <button
                onClick={handleAddMaintenance}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                添加维修记录
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  删除
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">资产编码</div>
                <div className="font-medium">{asset.asset_code}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">品牌</div>
                <div>{asset.brand}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">型号</div>
                <div>{asset.model}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">CPU</div>
                <div>{asset.cpu}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">内存</div>
                <div>{asset.ram}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">存储</div>
                <div>{asset.storage}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">显卡</div>
                <div>{asset.gpu || '-'}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">操作系统</div>
                <div>{asset.os}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">状态</div>
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.status === 'active' ? 'bg-green-100 text-green-800' : asset.status === 'idle' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                  {asset.status === 'active' ? '使用中' : asset.status === 'idle' ? '闲置' : '维修中'}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">部门</div>
                <div>{asset.department}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">使用人</div>
                <div>{asset.user_name}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-gray-500">位置</div>
                <div>{asset.location}</div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-24 text-gray-500">备注</div>
                <div className="whitespace-pre-wrap">{asset.notes || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">使用历史</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assetHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      暂无操作历史
                    </td>
                  </tr>
                ) : (
                  assetHistory.map((history) => (
                    <tr key={history.id}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${history.operation_type === 'create' ? 'bg-blue-100 text-blue-800' : history.operation_type === 'update' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {history.operation_type === 'create' ? '创建' : history.operation_type === 'update' ? '更新' : '删除'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{history.user_email}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(history.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => {
                            // 显示更详细的操作历史信息
                            alert(`操作类型: ${history.operation_type === 'create' ? '创建' : history.operation_type === 'update' ? '更新' : '删除'}\n操作人: ${history.user_email}\n操作时间: ${new Date(history.created_at).toLocaleString()}\n资产编码: ${history.asset_code}`)
                          }}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">维修记录</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">问题描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">维修描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">维修日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">维修费用</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {maintenanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      暂无维修记录
                    </td>
                  </tr>
                ) : (
                  maintenanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{record.issue_description}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{record.repair_description || '-'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.repair_date ? new Date(record.repair_date).toLocaleDateString() : '-'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.repair_cost ? `¥${record.repair_cost}` : '-'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : record.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {record.status === 'pending' ? '待处理' : record.status === 'completed' ? '已完成' : '处理中'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditMaintenance(record)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteMaintenance(record.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 编辑资产对话框 */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
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

      {/* 二维码对话框 */}
      {isQRDialogOpen && asset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">资产二维码</h2>
              <button
                onClick={() => setIsQRDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center">
              <p className="mb-4">扫描二维码查看资产详情</p>
              <div className="mb-4">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="mx-auto"
                    width={300}
                    height={300}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
                    <div className="text-gray-500">生成中...</div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500">{asset.asset_code}</p>
            </div>
          </div>
        </div>
      )}

      {/* 添加维修记录对话框 */}
      {isMaintenanceDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">添加维修记录</h2>
              <button
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.issue_description}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维修描述</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.repair_description}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修日期</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maintenanceFormData.repair_date}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修费用</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maintenanceFormData.repair_cost}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.status}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, status: e.target.value })}
                  required
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceDialogOpen(false)}
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

      {/* 编辑维修记录对话框 */}
      {isEditMaintenanceDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">编辑维修记录</h2>
              <button
                onClick={() => setIsEditMaintenanceDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.issue_description}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维修描述</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.repair_description}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修日期</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maintenanceFormData.repair_date}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修费用</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maintenanceFormData.repair_cost}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={maintenanceFormData.status}
                  onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, status: e.target.value })}
                  required
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditMaintenanceDialogOpen(false)}
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

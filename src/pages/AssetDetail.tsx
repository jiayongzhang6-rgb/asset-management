import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import * as QRCode from 'qrcode'

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrcodeUrl, setQrcodeUrl] = useState('')
  const [assetHistory, setAssetHistory] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      fetchAsset()
      fetchAssetHistory()
    }
  }, [id])

  useEffect(() => {
    if (asset) {
      generateQRCode()
    }
  }, [asset])

  const generateQRCode = async () => {
    if (asset) {
      try {
        const qrData = `${window.location.origin}?action=edit&id=${asset.id}`
        const url = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2
        })
        setQrcodeUrl(url)
      } catch (error) {
        console.error('Error generating QR code:', error)
      }
    }
  }

  const fetchAsset = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('assets').select('*').eq('id', id).single()
      if (error) throw error
      setAsset(data || null)
    } catch (error) {
      console.error('Error fetching asset:', error)
      setAsset(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssetHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('operation_history')
        .select('*')
        .eq('asset_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssetHistory(data || [])
    } catch (error) {
      console.error('Error fetching asset history:', error)
    }
  }

  const handleEdit = () => {
    // 返回到首页并触发编辑对话框
    navigate('/', { state: { editAssetId: id } })
  }

  const handleDelete = async () => {
    if (asset && confirm('确定要删除这个资产吗？')) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', asset.id)
        if (error) throw error

        // 记录删除操作
        if (user) {
          await supabase.from('operation_history').insert({
            asset_id: asset.id,
            operation_type: 'delete',
            old_data: asset,
            user_email: user.email
          })
        }

        // 模拟删除操作
        setTimeout(() => {
          navigate('/')
          alert('资产删除成功')
        }, 500)
      } catch (error) {
        console.error('Error deleting asset:', error)
        alert('资产删除失败')
      }
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

  const getOperationDetails = (item: any) => {
    if (item.operation_type === 'create') {
      return `创建了资产\n使用人: ${item.new_data.user_name}\n部门: ${item.new_data.department}\n位置: ${item.new_data.location}`
    } else if (item.operation_type === 'update') {
      let details = `更新了资产\n`
      if (item.old_data.user_name !== item.new_data.user_name) {
        details += `使用人: ${item.old_data.user_name} → ${item.new_data.user_name}\n`
      }
      if (item.old_data.department !== item.new_data.department) {
        details += `部门: ${item.old_data.department} → ${item.new_data.department}\n`
      }
      if (item.old_data.location !== item.new_data.location) {
        details += `位置: ${item.old_data.location} → ${item.new_data.location}\n`
      }
      return details || '无变化'
    } else if (item.operation_type === 'delete') {
      return `删除了资产\n使用人: ${item.old_data.user_name}\n部门: ${item.old_data.department}\n位置: ${item.old_data.location}`
    }
    return JSON.stringify(item, null, 2)
  }

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              返回
            </button>
            <h1 className="text-2xl font-bold">资产详情</h1>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                编辑
              </button>
              {user && user.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">基本信息</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">资产编码</p>
                  <p className="text-lg font-medium">{asset.asset_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <div className="mt-1">{getStatusBadge(asset.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">品牌</p>
                  <p className="text-lg">{asset.brand}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">型号</p>
                  <p className="text-lg">{asset.model}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">硬件配置</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">CPU</p>
                <p className="text-lg">{asset.cpu}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">内存</p>
                <p className="text-lg">{asset.ram}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">存储</p>
                <p className="text-lg">{asset.storage}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">显卡</p>
                <p className="text-lg">{asset.gpu || '未配置'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">操作系统</p>
                <p className="text-lg">{asset.os}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">使用信息</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">部门</p>
                <p className="text-lg">{asset.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">使用人</p>
                <p className="text-lg">{asset.user_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">位置</p>
                <p className="text-lg">{asset.location}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">其他信息</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">创建时间</p>
                <p className="text-lg">{new Date(asset.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">更新时间</p>
                <p className="text-lg">{new Date(asset.updated_at).toLocaleString('zh-CN')}</p>
              </div>
              {asset.notes && (
                <div>
                  <p className="text-sm text-gray-500">备注</p>
                  <p className="text-lg mt-2 p-3 bg-gray-100 rounded-md">{asset.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 资产使用历史 */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">使用历史</h2>
          {assetHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assetHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.operation_type === 'create' && '创建'}
                        {item.operation_type === 'update' && '更新'}
                        {item.operation_type === 'delete' && '删除'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.user_email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <button
                          onClick={() => alert(getOperationDetails(item))}
                          className="text-blue-500 hover:underline"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无使用历史记录
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">资产二维码</h2>
          <div className="flex justify-center">
            <div className="p-4 bg-white border rounded-lg">
              {qrcodeUrl ? (
                <img src={qrcodeUrl} alt="资产二维码" width="200" height="200" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                  <span className="text-gray-500">生成中...</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            扫描二维码查看资产详情
          </p>
        </div>
      </main>
    </div>
  )
}

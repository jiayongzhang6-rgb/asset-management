import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, Asset } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQRCode, setShowQRCode] = useState(false)

  useEffect(() => {
    if (id) {
      fetchAsset()
    }
  }, [id])

  const fetchAsset = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      setAsset(data)
    } catch (error) {
      console.error('Error fetching asset:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (asset && confirm('确定要删除这个资产吗？')) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', asset.id)
        if (error) throw error
        navigate('/')
        alert('资产删除成功')
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
                onClick={() => setShowQRCode(!showQRCode)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                {showQRCode ? '隐藏二维码' : '显示二维码'}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                删除
              </button>
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

        {showQRCode && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">资产二维码</h2>
            <div className="flex justify-center">
              <div className="p-4 bg-white border rounded-lg">
                <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                  <rect width="200" height="200" fill="white" stroke="black" strokeWidth="2"/>
                  <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="12">
                    {asset.asset_code}
                  </text>
                </svg>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, type Asset, formatMemory, formatStorage, getStatusText, fetchAssetExtraFieldsViaSQL } from '../lib/supabase'

/**
 * 扫码公开视图（免登录、只读）
 * 只展示硬件配置信息：没有任何按钮、不提供任何编辑入口。
 */
export default function PublicAsset() {
  const { id } = useParams<{ id: string }>()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchAsset = async () => {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const cleanedId = id.trim()
      try {
        const { data, error } = await supabase
          .from('assets_public')
          .select('*')
          .eq('asset_code', cleanedId)

        if (error || !data || data.length === 0) {
          setNotFound(true)
          return
        }
        let assetData = data[0] as Asset
        // 补读扩展字段（分类/承租主体/承租负责人），PostgREST schema cache 可能不返回
        try {
          const extraMap = await fetchAssetExtraFieldsViaSQL([assetData.asset_code])
          const extra = extraMap.get(assetData.asset_code)
          if (extra) {
            assetData = {
              ...assetData,
              category: extra.category ?? assetData.category,
              lessee_entity: extra.lessee_entity ?? '',
              lessee_manager: extra.lessee_manager ?? ''
            }
          }
        } catch { /* 扩展字段读取失败不影响配置信息展示 */ }
        setAsset(assetData)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchAsset()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (notFound || !asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800 mb-1">资产不存在</h1>
          <p className="text-sm text-gray-500">请检查二维码是否正确</p>
        </div>
      </div>
    )
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: '资产编码', value: asset.asset_code },
    { label: '分类', value: asset.category || '-' },
    { label: '品牌', value: asset.brand || '-' },
    { label: '型号', value: asset.model || '-' },
    { label: 'CPU', value: asset.cpu || '-' },
    { label: '内存', value: formatMemory(asset.ram) },
    { label: '硬盘', value: formatStorage(asset.storage) },
    { label: '显卡', value: asset.gpu || '-' },
    { label: '操作系统', value: asset.os || '-' },
    {
      label: '状态',
      value: (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
          {getStatusText(asset.status)}
        </span>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* 标题区（纯展示，无任何按钮） */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{asset.brand} {asset.model}</h1>
          <p className="text-xs text-gray-400 mt-1">德泽智联 · 资产配置信息</p>
        </div>

        {/* 配置信息卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">配置信息</h2>
          </div>
          <div className="px-5 py-2">
            {rows.map((row, idx) => (
              <div
                key={row.label}
                className={`flex items-center justify-between py-3 ${idx < rows.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className="text-sm font-medium text-gray-900 text-right break-all ml-4">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">此页面为只读视图</p>
      </div>
    </div>
  )
}

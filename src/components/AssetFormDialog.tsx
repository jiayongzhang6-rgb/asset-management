import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { type Asset, type AssetStatus, type AssetCategory } from '../lib/supabase'

const categories: AssetCategory[] = ['笔记本', '台式机', '显示器', '外设', '服务器', '网络设备', '其他']

interface AssetFormDialogProps {
  asset: Asset | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Asset>) => Promise<void>
}

interface FormData {
  brand: string
  model: string
  cpu: string
  ram: string
  storage: string
  gpu: string
  os: string
  category: string
  department: string
  user_name: string
  location: string
  status: string
  monthly_rent: string
  notes: string
}

const emptyForm: FormData = {
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
  monthly_rent: '',
  notes: ''
}

const inputClass = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AssetFormDialog({ asset, isOpen, onClose, onSave }: AssetFormDialogProps) {
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // 打开对话框时根据 asset 初始化表单数据
  useEffect(() => {
    if (!isOpen) return
    if (asset) {
      setFormData({
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
        monthly_rent: asset.monthly_rent != null ? String(asset.monthly_rent) : '',
        notes: asset.notes || ''
      })
    } else {
      setFormData(emptyForm)
    }
  }, [isOpen, asset])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const rentValue = parseFloat(formData.monthly_rent)
      const data: Partial<Asset> = {
        brand: formData.brand,
        model: formData.model,
        cpu: formData.cpu,
        ram: formData.ram,
        storage: formData.storage,
        gpu: formData.gpu,
        os: formData.os,
        category: formData.category,
        department: formData.department,
        user_name: formData.user_name,
        location: formData.location,
        status: formData.status as AssetStatus,
        monthly_rent: isNaN(rentValue) ? 0 : rentValue,
        notes: formData.notes
      }
      await onSave(data)
    } catch (error: any) {
      console.error('Error saving asset:', error)
      toast.error(`保存失败: ${error?.message || JSON.stringify(error)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{asset ? '编辑资产' : '新增资产'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
              <input
                type="text"
                className={inputClass}
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
              <input
                type="text"
                className={inputClass}
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
              <select
                className={inputClass}
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
                className={inputClass}
                value={formData.cpu}
                onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内存</label>
              <input
                type="text"
                className={inputClass}
                value={formData.ram}
                onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">存储</label>
              <input
                type="text"
                className={inputClass}
                value={formData.storage}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显卡</label>
              <input
                type="text"
                className={inputClass}
                value={formData.gpu}
                onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">操作系统</label>
              <input
                type="text"
                className={inputClass}
                value={formData.os}
                onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select
                className={inputClass}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
              <input
                type="text"
                className={inputClass}
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
              <input
                type="text"
                className={inputClass}
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
              <input
                type="text"
                className={inputClass}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">月租费（元）</label>
              <input
                type="number"
                className={inputClass}
                value={formData.monthly_rent}
                onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              className={inputClass}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

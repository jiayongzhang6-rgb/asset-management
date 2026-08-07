import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import { supabase, type Asset, type MaintenanceRecord, type AssetImage, type UsageHistoryRecord, formatUserIdentifier, formatMemory, formatStorage, getStatusText, getStatusColor, getOperationTypeText, getOperationTypeColor, recordAllHistory, getBeijingTime } from '../lib/supabase'

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
  const [assetHistory, setAssetHistory] = useState<UsageHistoryRecord[]>([])
  const [assetImages, setAssetImages] = useState<AssetImage[]>([])
  const [isImageUploadDialogOpen, setIsImageUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
    notes: '',
    monthly_rent: ''
  })
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    issue_description: '',
    repair_description: '',
    repair_date: '',
    repair_cost: 0,
    status: 'pending'
  })

  // 图片压缩函数
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        const maxWidth = 1024
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          resolve(blob || file)
        }, 'image/jpeg', 0.8)
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  // 从Supabase中获取资产数据
  const fetchAsset = async () => {
    console.log('AssetDetail: fetchAsset called')
    console.log('AssetDetail: URL parameter id:', id)
    console.log('AssetDetail: Type of id:', typeof id)
    
    if (!id) {
      console.error('AssetDetail: No asset code provided')
      toast.error('未提供资产编码')
      return
    }
    
    const cleanedId = id.trim()
    console.log('AssetDetail: Cleaned asset code:', cleanedId)
    
    setLoading(true)
    try {
      console.log('AssetDetail: Fetching asset with code:', cleanedId)
      
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('asset_code', cleanedId)
      
      console.log('AssetDetail: Result from supabase:', { data, error })
      console.log('AssetDetail: Data length:', data ? data.length : 0)
      
      if (error) {
        console.error('AssetDetail: Error fetching asset:', error)
        toast.error(`无法获取资产数据: ${error.message}`)
      } else if (data && data.length > 0) {
        const assetData = data[0]
        console.log('AssetDetail: Asset fetched successfully:', assetData)
        setAsset(assetData)
        setFormData({
          brand: assetData.brand || '',
          model: assetData.model || '',
          cpu: assetData.cpu || '',
          ram: assetData.ram || '',
          storage: assetData.storage || '',
          gpu: assetData.gpu || '',
          os: assetData.os || '',
          department: assetData.department || '',
          user_name: assetData.user_name || '',
          location: assetData.location || '',
          status: assetData.status || 'active',
          notes: assetData.notes || '',
          monthly_rent: assetData.monthly_rent != null ? String(assetData.monthly_rent) : ''
        })
      } else {
        console.error('AssetDetail: No asset found with code:', cleanedId)
        
        const { data: allAssets } = await supabase.from('assets').select('asset_code')
        console.log('AssetDetail: All assets in database:', allAssets)
        
        toast.error('资产不存在，请检查二维码是否正确')
      }
    } catch (error) {
      console.error('AssetDetail: Exception fetching asset:', error)
      toast.error(`无法获取资产数据: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 从Supabase中获取资产使用历史
  const fetchAssetHistory = async () => {
    if (!id || !asset) return
    try {
      const { data, error } = await supabase
        .from('usage_history')
        .select('*')
        .eq('asset_code', asset.asset_code)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssetHistory(data || [])
      console.log('AssetDetail: Usage history fetched successfully', data)
    } catch (error) {
      console.error('Error fetching usage history:', error)
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

  // 从Supabase中获取资产图片
  const fetchAssetImages = async () => {
    if (!id || !asset) return
    try {
      const { data, error } = await supabase
        .from('asset_images')
        .select('*')
        .eq('asset_code', asset.asset_code)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAssetImages(data || [])
      console.log('AssetDetail: Asset images fetched successfully', data)
    } catch (error) {
      console.error('Error fetching asset images:', error)
    }
  }

  useEffect(() => {
    fetchAsset()
  }, [id])

  useEffect(() => {
    fetchAssetHistory()
    fetchMaintenanceRecords()
    fetchAssetImages()
  }, [asset])

 const handleEditSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!asset) {
    toast.error('资产数据加载中，请稍后重试')
    return
  }
  
  try {
    const assetCodeToUse = asset.asset_code || id
    console.log('AssetDetail: Asset code to use for history:', assetCodeToUse)
    
    let updateData: Record<string, any> = { ...formData }
    if (user?.role !== 'admin') {
      updateData = {
        department: formData.department,
        user_name: formData.user_name,
        location: formData.location,
        notes: formData.notes
      }
    }

    if ('monthly_rent' in updateData) {
      const rentValue = parseFloat(updateData.monthly_rent)
      updateData.monthly_rent = isNaN(rentValue) ? 0 : rentValue
    }
    
    const changes = []
    if (updateData.brand && updateData.brand !== asset.brand) changes.push(`品牌: ${asset.brand || '无'} → ${updateData.brand || '无'}`)
    if (updateData.model && updateData.model !== asset.model) changes.push(`型号: ${asset.model || '无'} → ${updateData.model || '无'}`)
    if (updateData.cpu && updateData.cpu !== asset.cpu) changes.push(`CPU: ${asset.cpu || '无'} → ${updateData.cpu || '无'}`)
    if (updateData.ram && updateData.ram !== asset.ram) changes.push(`内存: ${asset.ram || '无'} → ${updateData.ram || '无'}`)
    if (updateData.storage && updateData.storage !== asset.storage) changes.push(`存储: ${asset.storage || '无'} → ${updateData.storage || '无'}`)
    if (updateData.gpu && updateData.gpu !== asset.gpu) changes.push(`GPU: ${asset.gpu || '无'} → ${updateData.gpu || '无'}`)
    if (updateData.os && updateData.os !== asset.os) changes.push(`操作系统: ${asset.os || '无'} → ${updateData.os || '无'}`)
    if (updateData.department !== asset.department) changes.push(`部门: ${asset.department || '无'} → ${updateData.department || '无'}`)
    if (updateData.user_name !== asset.user_name) changes.push(`使用人: ${asset.user_name || '无'} → ${updateData.user_name || '无'}`)
    if (updateData.location !== asset.location) changes.push(`位置: ${asset.location || '无'} → ${updateData.location || '无'}`)
    if (updateData.status && updateData.status !== asset.status) changes.push(`状态: ${getStatusText(asset.status)} → ${getStatusText(updateData.status)}`)
    if (updateData.notes !== asset.notes) changes.push(`备注: ${asset.notes || '无'} → ${updateData.notes || '无'}`)
    
    console.log('AssetDetail: Changes to record:', changes)
    
    const { error: updateError } = await supabase
      .from('assets')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('asset_code', asset.asset_code)
    
    if (updateError) {
      console.error('AssetDetail: Update error:', updateError)
      throw updateError
    }
    
    if (user && changes.length > 0) {
      await recordAllHistory(assetCodeToUse, 'update', user.email, changes.join('\n'))
    }
    
    setIsEditDialogOpen(false)
    await fetchAsset()
    await fetchAssetHistory()
    toast.success('资产更新成功')
  } catch (error: any) {
    console.error('Error updating asset:', error)
    toast.error(`资产更新失败: ${error?.message || JSON.stringify(error)}`)
  }
}

  const handleDelete = async () => {
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以删除资产')
      return
    }
    
    if (asset && confirm('确定要删除这个资产吗？')) {
      try {
        const { data, error } = await supabase.from('assets').delete().eq('asset_code', asset.asset_code)
        if (error) throw error
        
        if (user) {
          await recordAllHistory(asset.asset_code, 'delete', user.email)
        }
        
        navigate('/')
        toast.success('资产删除成功')
      } catch (error) {
        console.error('Error deleting asset:', error)
        toast.error('资产删除失败')
      }
    }
  }

  const handleAddMaintenance = () => {
    setIsMaintenanceDialogOpen(true)
  }

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asset) return
    
    try {
      if (editingMaintenanceRecord) {
        const { error } = await supabase
          .from('maintenance_records')
          .update(maintenanceFormData)
          .eq('id', editingMaintenanceRecord.id)
        if (error) throw error
        setIsEditMaintenanceDialogOpen(false)
        toast.success('维修记录更新成功')
      } else {
        console.log('AssetDetail: Adding maintenance record for asset:', asset)
        console.log('AssetDetail: Asset id:', asset.id, typeof asset.id)
        const { error } = await supabase
          .from('maintenance_records')
          .insert({
            ...maintenanceFormData,
            asset_id: asset.id
          })
        if (error) {
          console.error('AssetDetail: Maintenance record insert error:', error)
          throw error
        }
        setIsMaintenanceDialogOpen(false)
        toast.success('维修记录添加成功')
      }
      await fetchMaintenanceRecords()
    } catch (error) {
      console.error('Error saving maintenance record:', error)
      toast.error('维修记录保存失败')
    }
  }

  const handleEditMaintenance = (record: MaintenanceRecord) => {
    setEditingMaintenanceRecord(record)
    setMaintenanceFormData({
      issue_description: record.issue_description,
      repair_description: record.repair_description,
      repair_date: record.repair_date,
      repair_cost: record.repair_cost,
      status: record.status
    })
    setIsEditMaintenanceDialogOpen(true)
  }

  const handleDeleteMaintenance = async (id: number) => {
    if (confirm('确定要删除这个维修记录吗？')) {
      try {
        const { error } = await supabase.from('maintenance_records').delete().eq('id', id)
        if (error) throw error
        await fetchMaintenanceRecords()
        toast.success('维修记录删除成功')
      } catch (error) {
        console.error('Error deleting maintenance record:', error)
        toast.error('维修记录删除失败')
      }
    }
  }

  const generateQRCode = async () => {
    if (!asset) return
    try {
      const url = `${window.location.origin}/asset/${asset.asset_code}`
      console.log('AssetDetail: QR code URL:', url)
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`)
      setIsQRDialogOpen(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
      toast.error('生成二维码失败')
    }
  }

  const uploadWithRetry = async (fileName: string, compressedFile: Blob, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`AssetDetail: Upload attempt ${attempt} for ${fileName}`)

        const { data, error } = await supabase
          .storage
          .from('asset-images')
          .upload(fileName, compressedFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error(`AssetDetail: Upload attempt ${attempt} failed:`, error)
          if (attempt === maxRetries) {
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }

        console.log(`AssetDetail: Upload attempt ${attempt} successful:`, data)
        return data
      } catch (error) {
        console.error(`AssetDetail: Upload attempt ${attempt} error:`, error)
        if (attempt === maxRetries) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
    throw new Error('Upload failed after all retries')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!asset) return

    const files = e.target.files
    if (!files || files.length === 0) return

    if (assetImages.length + files.length > 3) {
      toast.error('每件资产最多只能上传3张照片')
      return
    }

    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error('请上传图片文件')
          continue
        }

        try {
          console.log(`AssetDetail: Compressing image: ${file.name}`)
          const compressedFile = await compressImage(file)
          console.log(`AssetDetail: Image compressed, size: ${compressedFile.size} bytes`)

          const fileName = `${asset.asset_code}_${Date.now()}_${file.name}`

          await uploadWithRetry(fileName, compressedFile)

          const { data: urlData } = supabase
            .storage
            .from('asset-images')
            .getPublicUrl(fileName)

          console.log(`AssetDetail: Image URL: ${urlData.publicUrl}`)

          let dbSuccess = false
          for (let dbAttempt = 1; dbAttempt <= 3; dbAttempt++) {
            const { error: dbError } = await supabase
              .from('asset_images')
              .insert({
                asset_code: asset.asset_code,
                image_url: urlData.publicUrl,
                image_name: file.name
              })

            if (dbError) {
              console.error(`AssetDetail: Database insert attempt ${dbAttempt} failed:`, dbError)
              if (dbAttempt === 3) {
                throw dbError
              }
              await new Promise(resolve => setTimeout(resolve, 500 * dbAttempt))
            } else {
              dbSuccess = true
              break
            }
          }

          if (!dbSuccess) {
            throw new Error('Database insert failed after all retries')
          }

          successCount++
          console.log(`AssetDetail: Image ${file.name} uploaded successfully`)
        } catch (error) {
          console.error(`AssetDetail: Error uploading image ${file.name}:`, error)
          failCount++
        }
      }

      await fetchAssetImages()

      if (failCount === 0 && successCount > 0) {
        toast.success(`图片上传成功！${successCount}张图片已上传`)
      } else if (successCount > 0 && failCount > 0) {
        toast(`部分图片上传成功！成功${successCount}张，失败${failCount}张`, { icon: '⚠️' })
      } else {
        toast.error('图片上传失败，请稍后重试')
      }

      if (successCount > 0) {
        setIsImageUploadDialogOpen(false)
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error('图片上传失败，请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  const handleImageDelete = async (imageId: string) => {
    if (confirm('确定要删除这张图片吗？')) {
      try {
        const { error: dbError } = await supabase
          .from('asset_images')
          .delete()
          .eq('id', imageId)
        
        if (dbError) {
          console.error('Error deleting image from database:', dbError)
          toast.error('删除图片失败')
          return
        }
        
        await fetchAssetImages()
        toast.success('图片删除成功')
      } catch (error) {
        console.error('Error deleting image:', error)
        toast.error('删除图片失败')
      }
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p className="mt-4 text-gray-500 font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">请先登录</h2>
          <p className="text-gray-500 mb-6">登录后即可查看资产详情</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-6 py-2.5 rounded-lg"
          >
            返回登录
          </button>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">资产不存在</h2>
          <p className="text-gray-500 mb-6">未找到该资产，请检查二维码是否正确</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-6 py-2.5 rounded-lg"
          >
            返回列表
          </button>
        </div>
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
              <p className="text-xs text-white/70">资产详情 · 维修记录 · 使用历史</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{formatUserIdentifier(user?.email)}</span>
            <button onClick={() => navigate('/')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              返回列表
            </button>
            {(user?.role === 'admin') && (
              <>
                <button onClick={() => navigate('/import')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
                  批量导入
                </button>
                <button onClick={() => navigate('/history')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
                  操作历史
                </button>
                <button onClick={() => navigate('/users')} className="btn btn-ghost !text-white/80 hover:!text-white text-sm px-2 py-1.5">
                  用户管理
                </button>
              </>
            )}
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={signOut} className="btn btn-ghost !text-white/80 hover:!text-white hover:!bg-white/10 text-sm px-2 py-1.5">
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        {/* 操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">资产详情</h2>
            <span className={`badge ${getStatusColor(asset.status)}`}>
              {getStatusText(asset.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generateQRCode}
              className="btn-primary px-4 py-2 rounded-lg text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              二维码
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={handleAddMaintenance}
                className="btn-primary px-4 py-2 rounded-lg text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                添加维修记录
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => setIsImageUploadDialogOpen(true)}
                className="btn-primary px-4 py-2 rounded-lg text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                上传图片
              </button>
            )}
            <button
              onClick={() => setIsEditDialogOpen(true)}
              className="btn-primary px-4 py-2 rounded-lg text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              编辑
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={handleDelete}
                className="btn-danger px-4 py-2 rounded-lg text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </button>
            )}
          </div>
        </div>

        {/* 资产信息卡片 */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 基本信息 */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">资产编码</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono">{asset.asset_code}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">品牌</span>
                  <span className="text-sm font-medium text-gray-900">{asset.brand || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">型号</span>
                  <span className="text-sm font-medium text-gray-900">{asset.model || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">CPU</span>
                  <span className="text-sm font-medium text-gray-900">{asset.cpu || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">内存</span>
                  <span className="text-sm font-medium text-gray-900">{formatMemory(asset.ram)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">硬盘</span>
                  <span className="text-sm font-medium text-gray-900">{formatStorage(asset.storage)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">显卡</span>
                  <span className="text-sm font-medium text-gray-900">{asset.gpu || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">操作系统</span>
                  <span className="text-sm font-medium text-gray-900">{asset.os || <span className="text-gray-400">-</span>}</span>
                </div>
              </div>
            </div>

            {/* 使用信息 */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">使用信息</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">部门</span>
                  <span className="text-sm font-medium text-gray-900">{asset.department || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">使用人</span>
                  <span className="text-sm font-medium text-gray-900">{asset.user_name || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">位置</span>
                  <span className="text-sm font-medium text-gray-900">{asset.location || <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">月租费</span>
                  <span className="text-sm font-semibold text-blue-600">{asset.monthly_rent ? `¥${asset.monthly_rent}` : <span className="text-gray-400">-</span>}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">创建时间</span>
                  <span className="text-sm font-medium text-gray-900">{new Date(asset.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">更新时间</span>
                  <span className="text-sm font-medium text-gray-900">{new Date(asset.updated_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 备注 */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">备注</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
              {asset.notes || <span className="text-gray-400 italic">暂无备注</span>}
            </div>
          </div>
        </div>

        {/* 资产图片 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">资产图片</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{assetImages.length}/3</span>
            </div>
          </div>
          {assetImages.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-400">暂无图片</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {assetImages.map((image) => (
                <div key={image.id} className="relative group rounded-xl overflow-hidden bg-gray-100">
                  <img 
                    src={image.image_url} 
                    alt={image.image_name} 
                    className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleImageDelete(image.id)}
                      className="absolute top-3 right-3 bg-red-500/90 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <p className="text-xs text-white/90 truncate">{image.image_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 维修记录 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">维修记录</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{maintenanceRecords.length} 条</span>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>问题描述</th>
                  <th>维修描述</th>
                  <th>维修日期</th>
                  <th>维修费用</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      暂无维修记录
                    </td>
                  </tr>
                ) : (
                  maintenanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="max-w-[200px]">
                        <div className="text-sm text-gray-900 truncate" title={record.issue_description}>{record.issue_description}</div>
                      </td>
                      <td className="max-w-[200px]">
                        <div className="text-sm text-gray-500 truncate" title={record.repair_description || '-'}>{record.repair_description || '-'}</div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-900">{record.repair_date || '-'}</div>
                      </td>
                      <td>
                        <div className="text-sm font-medium text-gray-900">{record.repair_cost ? `¥${record.repair_cost}` : '-'}</div>
                      </td>
                      <td>
                        <span className={`badge ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : record.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {record.status === 'pending' ? '待处理' : record.status === 'completed' ? '已完成' : '进行中'}
                        </span>
                      </td>
                      <td>
                        {user?.role === 'admin' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditMaintenance(record)}
                              className="btn-ghost text-sm px-2 py-1 rounded-lg"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteMaintenance(record.id)}
                              className="btn-ghost text-sm px-2 py-1 rounded-lg !text-red-500 hover:!bg-red-50"
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 使用历史 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">使用历史</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{assetHistory.length} 条</span>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>操作类型</th>
                  <th>操作人</th>
                  <th>操作时间</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {assetHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      暂无操作历史
                    </td>
                  </tr>
                ) : (
                  assetHistory.map((history) => (
                    <tr key={history.id}>
                      <td>
                        <span className={`badge ${getOperationTypeColor(history.operation_type)}`}>
                          {getOperationTypeText(history.operation_type)}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm text-gray-900">{history.user_email}</div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-500">
                          {getBeijingTime(history.created_at)}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn-ghost text-sm px-2 py-1 rounded-lg"
                          onClick={() => {
                            toast(`操作类型: ${getOperationTypeText(history.operation_type)}\n操作人: ${history.user_email}\n操作时间: ${getBeijingTime(history.created_at)}\n资产编码: ${history.asset_code}\n变更内容: ${history.changes || '无'}`, { duration: 5000 })
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
      </main>

      {/* 编辑资产对话框 */}
      {isEditDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsEditDialogOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">编辑资产</h2>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {user?.role === 'admin' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">品牌</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">型号</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">CPU</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.cpu}
                        onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">内存</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.ram}
                        onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">存储</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.storage}
                        onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">GPU</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.gpu}
                        onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">操作系统</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.os}
                        onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
                      <select
                        className="input"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="active">使用中</option>
                        <option value="idle">闲置</option>
                        <option value="maintenance">维修中</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">部门</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">使用人</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">位置</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                {user?.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">月租费（元）</label>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="btn-secondary px-5 py-2 rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 rounded-lg text-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 二维码对话框 */}
      {isQRDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsQRDialogOpen(false)}>
          <div className="modal-content !max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">资产二维码</h2>
              <button
                onClick={() => setIsQRDialogOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-4">
                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <img src={qrCodeUrl} alt="Asset QR Code" className="w-48 h-48" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-2">扫描二维码查看资产详情</p>
              <div className="text-sm font-mono text-gray-700 bg-gray-50 rounded-lg px-3 py-2 inline-block">
                {asset?.asset_code}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 维修记录对话框 */}
      {isMaintenanceDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsMaintenanceDialogOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">添加维修记录</h2>
              <button
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">问题描述</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={maintenanceFormData.issue_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">维修描述</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={maintenanceFormData.repair_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">维修日期</label>
                    <input
                      type="date"
                      className="input"
                      value={maintenanceFormData.repair_date}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">维修费用</label>
                    <input
                      type="number"
                      className="input"
                      value={maintenanceFormData.repair_cost}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
                    <select
                      className="input"
                      value={maintenanceFormData.status}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, status: e.target.value })}
                    >
                      <option value="pending">待处理</option>
                      <option value="in_progress">进行中</option>
                      <option value="completed">已完成</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceDialogOpen(false)}
                  className="btn-secondary px-5 py-2 rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 rounded-lg text-sm"
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
        <div className="modal-overlay" onClick={() => setIsEditMaintenanceDialogOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">编辑维修记录</h2>
              <button
                onClick={() => setIsEditMaintenanceDialogOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">问题描述</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={maintenanceFormData.issue_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">维修描述</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={maintenanceFormData.repair_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">维修日期</label>
                    <input
                      type="date"
                      className="input"
                      value={maintenanceFormData.repair_date}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">维修费用</label>
                    <input
                      type="number"
                      className="input"
                      value={maintenanceFormData.repair_cost}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
                    <select
                      className="input"
                      value={maintenanceFormData.status}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, status: e.target.value })}
                    >
                      <option value="pending">待处理</option>
                      <option value="in_progress">进行中</option>
                      <option value="completed">已完成</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditMaintenanceDialogOpen(false)}
                  className="btn-secondary px-5 py-2 rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 rounded-lg text-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 图片上传对话框 */}
      {isImageUploadDialogOpen && (
        <div className="modal-overlay" onClick={() => !uploading && setIsImageUploadDialogOpen(false)}>
          <div className="modal-content !max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">上传图片</h2>
              {!uploading && (
                <button
                  onClick={() => setIsImageUploadDialogOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {uploading ? (
              <div className="text-center py-8">
                <div className="spinner mx-auto mb-4" />
                <p className="text-gray-600 font-medium">图片上传中，请稍候...</p>
                <p className="text-xs text-gray-400 mt-2">如果网络较慢，请耐心等待</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    每件资产最多上传 <strong className="text-gray-700">3</strong> 张照片，图片将自动压缩至宽度不超过 1024px，质量 80%。
                  </p>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-600">点击或拖拽文件到此处上传</p>
                        <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP 格式</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsImageUploadDialogOpen(false)}
                      className="btn-secondary px-5 py-2 rounded-lg text-sm"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary px-5 py-2 rounded-lg text-sm"
                    >
                      选择文件
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
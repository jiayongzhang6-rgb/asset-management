﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, type Asset, type MaintenanceRecord, type AssetImage } from '../lib/supabase'

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
    notes: ''
  })
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    issue_description: '',
    repair_description: '',
    repair_date: '',
    repair_cost: 0,
    status: 'pending'
  })

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

  // 图片压缩函数
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // 计算压缩后的尺寸
        const maxWidth = 1024
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        // 绘制压缩后的图片
        ctx?.drawImage(img, 0, 0, width, height)
        
        // 转换为blob，质量80%
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
      alert('未提供资产编码')
      return
    }
    
    // 去除可能的空格或特殊字符
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
        alert(`无法获取资产数据: ${error.message}`)
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
          notes: assetData.notes || ''
        })
      } else {
        console.error('AssetDetail: No asset found with code:', cleanedId)
        
        // 尝试查询所有资产，看看数据库中是否有资产
        const { data: allAssets } = await supabase.from('assets').select('asset_code')
        console.log('AssetDetail: All assets in database:', allAssets)
        
        alert('资产不存在，请检查二维码是否正确')
      }
    } catch (error) {
      console.error('AssetDetail: Exception fetching asset:', error)
      alert(`无法获取资产数据: ${error.message}`)
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
    alert('资产数据加载中，请稍后重试')
    return
  }
  
  try {
    // 保存资产编码用于后续记录操作历史
    const assetCodeToUse = asset.asset_code || id
    console.log('AssetDetail: Asset code to use for history:', assetCodeToUse)
    
    // 根据用户角色过滤可修改的字段
    let updateData = { ...formData }
    if (user?.role !== 'admin') {
      // 普通用户只能修改以下字段
      updateData = {
        department: formData.department,
        user_name: formData.user_name,
        location: formData.location,
        notes: formData.notes
      }
    }
    
    // 计算变更内容
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
    if (updateData.status && updateData.status !== asset.status) changes.push(`状态: ${asset.status === 'active' ? '使用中' : asset.status === 'idle' ? '闲置' : '维修中'} → ${updateData.status === 'active' ? '使用中' : updateData.status === 'idle' ? '闲置' : '维修中'}`)
    if (updateData.notes !== asset.notes) changes.push(`备注: ${asset.notes || '无'} → ${updateData.notes || '无'}`)
    
    console.log('AssetDetail: Changes to record:', changes)
    
    // 开始事务
    const { error: updateError } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', asset.id)
    
    if (updateError) {
      console.error('AssetDetail: Update error:', updateError)
      throw updateError
    }
    
    // 记录操作历史
    if (user && changes.length > 0) {
      console.log('AssetDetail: Recording operation history')
      try {
        const historyData = {
          asset_code: assetCodeToUse,
          operation_type: 'update',
          user_email: user.email,
          created_at: new Date().toISOString(),
          changes: changes.join('\n')
        }
        console.log('AssetDetail: Inserting operation history with data:', historyData)
        
        const { error: historyError } = await supabase
          .from('operation_history')
          .insert(historyData)
        
        if (historyError) {
          console.error('AssetDetail: History insert error:', historyError)
          // 历史记录失败不影响主操作
        }
      } catch (historyError) {
        console.error('AssetDetail: Error recording operation history:', historyError)
      }
    }
    
    setIsEditDialogOpen(false)
    await fetchAsset() // 重新获取资产数据
    alert('资产更新成功')
  } catch (error) {
    console.error('Error updating asset:', error)
    alert('资产更新失败')
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
        const { data, error } = await supabase.from('assets').delete().eq('id', asset.id)
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
            
            // 尝试插入操作历史
            await supabase.from('operation_history').insert(historyData)
          } catch (historyError) {
            console.error('AssetDetail: Error recording operation history for delete:', historyError)
          }
        }
        
        navigate('/')
        alert('资产删除成功')
      } catch (error) {
        console.error('Error deleting asset:', error)
        alert('资产删除失败')
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
        // 更新维修记录
        const { error } = await supabase
          .from('maintenance_records')
          .update(maintenanceFormData)
          .eq('id', editingMaintenanceRecord.id)
        if (error) throw error
        setIsEditMaintenanceDialogOpen(false)
        alert('维修记录更新成功')
      } else {
        // 添加新维修记录
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
        alert('维修记录添加成功')
      }
      await fetchMaintenanceRecords()
    } catch (error) {
      console.error('Error saving maintenance record:', error)
      alert('维修记录保存失败')
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
        alert('维修记录删除成功')
      } catch (error) {
        console.error('Error deleting maintenance record:', error)
        alert('维修记录删除失败')
      }
    }
  }

  const generateQRCode = async () => {
    if (!asset) return
    try {
      const url = `${window.location.origin}/asset/${asset.asset_code}`
      console.log('AssetDetail: QR code URL:', url)
      // 这里使用简单的方法生成二维码，实际项目中可以使用更专业的库
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`)
      setIsQRDialogOpen(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
      alert('生成二维码失败')
    }
  }

  // 重试上传函数
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

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!asset) return

    const files = e.target.files
    if (!files || files.length === 0) return

    // 检查图片数量限制
    if (assetImages.length + files.length > 3) {
      alert('每件资产最多只能上传3张照片')
      return
    }

    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const file of files) {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
          alert('请上传图片文件')
          continue
        }

        try {
          // 压缩图片
          console.log(`AssetDetail: Compressing image: ${file.name}`)
          const compressedFile = await compressImage(file)
          console.log(`AssetDetail: Image compressed, size: ${compressedFile.size} bytes`)

          // 生成唯一文件名
          const fileName = `${asset.asset_code}_${Date.now()}_${file.name}`

          // 上传到Supabase Storage with retry
          await uploadWithRetry(fileName, compressedFile)

          // 获取图片URL
          const { data: urlData } = supabase
            .storage
            .from('asset-images')
            .getPublicUrl(fileName)

          console.log(`AssetDetail: Image URL: ${urlData.publicUrl}`)

          // 保存图片信息到数据库 with retry
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

      // 重新获取图片列表
      await fetchAssetImages()

      // 显示上传结果
      if (failCount === 0 && successCount > 0) {
        alert(`图片上传成功！${successCount}张图片已上传`)
      } else if (successCount > 0 && failCount > 0) {
        alert(`部分图片上传成功！成功${successCount}张，失败${failCount}张`)
      } else {
        alert('图片上传失败，请稍后重试')
      }

      if (successCount > 0) {
        setIsImageUploadDialogOpen(false)
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      alert('图片上传失败，请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  // 处理图片删除
  const handleImageDelete = async (imageId: string) => {
    if (confirm('确定要删除这张图片吗？')) {
      try {
        // 从数据库中删除图片记录
        const { error: dbError } = await supabase
          .from('asset_images')
          .delete()
          .eq('id', imageId)
        
        if (dbError) {
          console.error('Error deleting image from database:', dbError)
          alert('删除图片失败')
          return
        }
        
        // 重新获取图片列表
        await fetchAssetImages()
        alert('图片删除成功')
      } catch (error) {
        console.error('Error deleting image:', error)
        alert('删除图片失败')
      }
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">请先登录</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            返回登录
          </button>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">资产不存在</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            返回列表
          </button>
        </div>
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
                  onClick={() => navigate('/')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 border border-blue-200"
                >
                  返回列表
                </button>
                <button
                  onClick={() => navigate('/import')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 border border-blue-200"
                >
                  批量导入
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 border border-blue-200"
                >
                  操作历史
                </button>
                <button
                  onClick={() => navigate('/users')}
                  className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 border border-blue-200"
                >
                  用户管理
                </button>
              </>
            )}
            <button
              onClick={signOut}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 border border-blue-200"
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
          opacity: 0.08, 
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                返回
              </button>
              <h2 className="text-2xl font-bold">资产详情</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={generateQRCode}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                查看二维码
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={handleAddMaintenance}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  添加维修记录
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => setIsImageUploadDialogOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  上传图片
                </button>
              )}
              <button
                  onClick={() => setIsEditDialogOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  编辑
                </button>
              {user?.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  删除
                </button>
              )}
            </div>
          </div>

          {/* 资产基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">基本信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">资产编码</span>
                  <span className="font-medium">{asset.asset_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">品牌</span>
                  <span className="font-medium">{asset.brand || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">型号</span>
                  <span className="font-medium">{asset.model || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CPU</span>
                  <span className="font-medium">{asset.cpu || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">内存</span>
                  <span className="font-medium">{formatMemory(asset.ram)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">硬盘</span>
                  <span className="font-medium">{formatStorage(asset.storage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">显卡</span>
                  <span className="font-medium">{asset.gpu || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">操作系统</span>
                  <span className="font-medium">{asset.os || '-'}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">使用信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">部门</span>
                  <span className="font-medium">{asset.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">使用人</span>
                  <span className="font-medium">{asset.user_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">位置</span>
                  <span className="font-medium">{asset.location || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">状态</span>
                  <span className={`font-medium ${asset.status === 'active' ? 'text-green-600' : asset.status === 'idle' ? 'text-yellow-600' : 'text-red-600'}`}>
                    {asset.status === 'active' ? '使用中' : asset.status === 'idle' ? '闲置' : '维修中'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">创建时间</span>
                  <span className="font-medium">{new Date(asset.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">更新时间</span>
                  <span className="font-medium">{new Date(asset.updated_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 备注 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">备注</h3>
            <p className="text-gray-700 border border-gray-200 rounded p-4">
              {asset.notes || '无'}
            </p>
          </div>

          {/* 资产图片 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">资产图片</h3>
            {assetImages.length === 0 ? (
              <p className="text-gray-500">暂无图片</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {assetImages.map((image) => (
                  <div key={image.id} className="relative">
                    <img 
                      src={image.image_url} 
                      alt={image.image_name} 
                      className="w-full h-48 object-cover rounded"
                    />
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleImageDelete(image.id)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 维修记录 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
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
                      无维修记录
                    </td>
                  </tr>
                ) : (
                  maintenanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.issue_description}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{record.repair_description || '-'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.repair_date || '-'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">¥{record.repair_cost || 0}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : record.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {record.status === 'pending' ? '待处理' : record.status === 'completed' ? '已完成' : '进行中'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        {user?.role === 'admin' && (
                          <>
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
                          </>
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
                        <div className="text-sm text-gray-900">
                          {/* 手动调整UTC时间到北京时间（+8小时） */}
                          {(() => {
                            const utcDate = new Date(history.created_at);
                            const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
                            return beijingDate.toLocaleString('zh-CN');
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => {
                            // 显示更详细的操作历史信息
                            // 手动调整UTC时间到北京时间（+8小时）
                            const utcDate = new Date(history.created_at);
                            const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
                            const beijingTime = beijingDate.toLocaleString('zh-CN');
                            alert(`操作类型: ${history.operation_type === 'create' ? '创建' : history.operation_type === 'update' ? '更新' : '删除'}\n操作人: ${history.user_email}\n操作时间: ${beijingTime}\n资产编码: ${history.asset_code}\n变更内容: ${history.changes || '无'}`)
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
        </div>
      </main>

      {/* 编辑资产对话框 */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">编辑资产</h2>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPU</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.cpu}
                    onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内存</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.ram}
                    onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">存储</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.storage}
                    onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GPU</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.gpu}
                    onChange={(e) => setFormData({ ...formData, gpu: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">操作系统</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.os}
                    onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">使用中</option>
                    <option value="idle">闲置</option>
                    <option value="maintenance">维修中</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">资产二维码</h2>
              <button
                onClick={() => setIsQRDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="text-center">
              <p className="mb-4">扫描二维码查看资产详情</p>
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeUrl} alt="Asset QR Code" className="w-48 h-48" />
                </div>
              )}
              <div className="mt-4 text-sm text-gray-600">
                {asset?.asset_code}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 维修记录对话框 */}
      {isMaintenanceDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">添加维修记录</h2>
              <button
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    value={maintenanceFormData.issue_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修描述</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    value={maintenanceFormData.repair_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">维修日期</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded"
                      value={maintenanceFormData.repair_date}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">维修费用</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded"
                      value={maintenanceFormData.repair_cost}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select
                      className="w-full px-3 py-2 border rounded"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
              <h2 className="text-2xl font-bold">编辑维修记录</h2>
              <button
                onClick={() => setIsEditMaintenanceDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleMaintenanceSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    value={maintenanceFormData.issue_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, issue_description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">维修描述</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    value={maintenanceFormData.repair_description}
                    onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">维修日期</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded"
                      value={maintenanceFormData.repair_date}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">维修费用</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded"
                      value={maintenanceFormData.repair_cost}
                      onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, repair_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select
                      className="w-full px-3 py-2 border rounded"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">上传图片</h2>
              {!uploading && (
                <button
                  onClick={() => setIsImageUploadDialogOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
            </div>
            {uploading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">图片上传中，请稍候...</p>
                <p className="text-xs text-gray-500 mt-2">如果网络较慢，请耐心等待</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    每件资产最多上传3张照片，图片将自动压缩至宽度不超过1024px，质量80%。
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">点击或拖拽文件到此处上传</p>
                        <p className="text-xs text-gray-500 mt-1">支持 JPG、PNG、WebP 格式</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImageUploadDialogOpen(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
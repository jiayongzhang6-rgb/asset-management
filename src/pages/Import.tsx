import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function Import() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <h2 className="text-2xl font-bold text-center mb-4">需要登录</h2>
          <p className="text-gray-600 text-center mb-6">请登录后使用导入功能</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            去登录
          </button>
        </div>
      </div>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseExcel(selectedFile)
    }
  }

  const generateAssetCode = (index: number) => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const count = String(index + 1).padStart(3, '0')
    return `PC-${year}-${month}-${count}`
  }

  const parseExcel = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const processedData = jsonData.map((item: any, index: number) => {
          // 收集其他字段到备注中
          const otherFields = []
          if (item['计算机名']) otherFields.push(`计算机名: ${item['计算机名']}`)
          if (item['主板']) otherFields.push(`主板: ${item['主板']}`)
          if (item['系统UUID']) otherFields.push(`系统UUID: ${item['系统UUID']}`)
          if (item['BIOS序号']) otherFields.push(`BIOS序号: ${item['BIOS序号']}`)
          if (item['主板序号']) otherFields.push(`主板序号: ${item['主板序号']}`)
          if (item['系统版本']) otherFields.push(`系统版本: ${item['系统版本']}`)
          if (item['磁盘型号']) otherFields.push(`磁盘型号: ${item['磁盘型号']}`)
          if (item['磁盘序号']) otherFields.push(`磁盘序号: ${item['磁盘序号']}`)
          if (item['MAC地址']) otherFields.push(`MAC地址: ${item['MAC地址']}`)
          if (item['IP地址']) otherFields.push(`IP地址: ${item['IP地址']}`)
          
          return {
            asset_code: item['资产编码'] || item['asset_code'] || item['AssetCode'] || generateAssetCode(index),
            brand: item['品牌'] || item['Brand'] || item['brand'] || '',
            model: item['型号'] || item['Model'] || item['model'] || item['计算机名'] || '',
            cpu: item['CPU'] || item['cpu'] || '',
            ram: item['内存(GB)'] || item['内存'] || item['RAM'] || item['ram'] || item['内存容量'] || '',
            storage: item['硬盘'] || item['存储'] || item['Storage'] || item['storage'] || item['硬盘容量'] || '',
            gpu: item['显卡'] || item['GPU'] || item['gpu'] || '',
            os: item['操作系统'] || item['OS'] || item['os'] || '',
            department: item['部门'] || item['Department'] || item['department'] || '',
            user_name: item['使用人'] || item['用户'] || item['User'] || item['user_name'] || item['使用人姓名'] || '',
            location: item['地点'] || item['位置'] || item['Location'] || item['location'] || '',
            status: item['状态'] || item['Status'] || item['status'] || 'active',
            notes: [
              item['备注'] || item['Notes'] || item['notes'] || '',
              ...otherFields
            ].filter(Boolean).join('; ')
          }
        })
        
        setPreviewData(processedData)
        alert(`成功解析 ${processedData.length} 条数据`)
      } catch (error) {
        console.error('文件解析失败:', error)
        alert('文件解析失败，请检查文件格式')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    // 权限控制：只有管理员可以导入资产
    if (user && user.role !== 'admin') {
      alert('只有管理员可以导入资产')
      return
    }
    
    if (previewData.length === 0) {
      alert('没有可导入的数据')
      return
    }

    setIsUploading(true)
    let successCount = 0
    let failCount = 0
    let updateCount = 0
    let insertCount = 0
    
    try {
      // 将导入的资产添加到Supabase中
      for (const asset of previewData) {
        try {
          // 先检查资产编码是否已存在
          const { data: existingAsset, error: checkError } = await supabase
            .from('assets')
            .select('id')
            .eq('asset_code', asset.asset_code)
            .single()
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError
          }
          
          if (existingAsset) {
            // 资产编码已存在，执行更新
            const { error: updateError } = await supabase
              .from('assets')
              .update(asset)
              .eq('asset_code', asset.asset_code)
            
            if (updateError) {
              console.error('Error updating asset:', updateError)
              failCount++
              continue
            }
            
            updateCount++
            successCount++
            
            // 记录操作历史
            if (user) {
              try {
                await supabase.from('operation_history').insert({
                  asset_code: asset.asset_code,
                  operation_type: 'update',
                  user_email: user.email,
                  created_at: new Date().toISOString()
                })
              } catch (historyError) {
                console.error('Error recording operation history:', historyError)
              }
            }
          } else {
            // 资产编码不存在，执行插入
            const { data, error: insertError } = await supabase.from('assets').insert(asset)
            
            if (insertError) {
              console.error('Error inserting asset:', insertError)
              failCount++
              continue
            }
            
            insertCount++
            successCount++
            
            // 记录操作历史
            if (user && data && data.length > 0) {
              try {
                await supabase.from('operation_history').insert({
                  asset_code: asset.asset_code,
                  operation_type: 'create',
                  user_email: user.email,
                  created_at: new Date().toISOString()
                })
              } catch (historyError) {
                console.error('Error recording operation history:', historyError)
              }
            }
          }
        } catch (assetError) {
          console.error('Error processing asset:', assetError)
          failCount++
        }
      }
      
      alert(`资产导入完成！成功：${successCount} 条（新增：${insertCount} 条，更新：${updateCount} 条），失败：${failCount} 条`)
      navigate('/')
    } catch (error) {
      console.error('导入失败:', error)
      alert(`资产导入失败，成功：${successCount} 条（新增：${insertCount} 条，更新：${updateCount} 条），失败：${failCount} 条`)
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    // 创建一个包含模板数据的Excel文件
    const templateData = [
      {
        '资产编码': '',
        '品牌': 'Dell',
        '型号': 'OptiPlex 7090',
        'CPU': 'Intel Core i5-11500',
        '内存(GB)': '16GB',
        '硬盘': '512GB SSD',
        '显卡': '集成显卡',
        '操作系统': 'Windows 10 Pro',
        '部门': '技术部',
        '使用人': '张三',
        '位置': 'A区-101',
        '状态': 'active',
        '备注': '办公用机'
      },
      {
        '资产编码': '',
        '品牌': 'HP',
        '型号': 'EliteBook 840 G8',
        'CPU': 'Intel Core i7-1165G7',
        '内存(GB)': '32GB',
        '硬盘': '1TB SSD',
        '显卡': 'NVIDIA MX450',
        '操作系统': 'Windows 10 Pro',
        '部门': '市场部',
        '使用人': '李四',
        '位置': 'B区-202',
        '状态': 'active',
        '备注': '笔记本电脑'
      }
    ];

    // 创建工作簿和工作表
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '资产模板');

    // 生成Excel文件并下载
    XLSX.writeFile(workbook, '资产导入模板.xlsx');
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
            <h1 className="text-2xl font-bold">资产导入</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">导入Excel文件</h2>
            <p className="text-gray-600 mb-4">上传Excel文件批量导入资产数据。支持.xlsx和.xls格式。</p>
            <div className="flex gap-4 mb-4">
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                下载模板
              </button>
              <div className="flex-1">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border rounded-md"
                  disabled={isUploading}
                />
              </div>
            </div>
            {file && (
              <div className="text-sm text-gray-600">
                已选择: {file.name}
              </div>
            )}
          </div>

          {previewData.length > 0 && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">数据预览</h2>
                <p className="text-gray-600 mb-4">共 {previewData.length} 条数据待导入</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">型号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">存储</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">显卡</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.slice(0, 10).map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.brand}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.model}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.cpu}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.ram}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.storage}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.gpu || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.department}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.user_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 10 && (
                    <p className="text-center text-gray-500 mt-4">
                      还有 {previewData.length - 10} 条数据...
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={handleImport}
                  disabled={isUploading}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {isUploading ? '导入中...' : `开始导入 (${previewData.length} 条数据)`}
                </button>
              </div>
            </>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">导入说明</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>1. 下载模板文件，按照模板格式填写资产信息</li>
              <li>2. 支持的字段：资产编码、品牌、型号、CPU、内存、存储、显卡、操作系统、部门、用户、位置、状态、备注</li>
              <li>3. 状态字段可选值：active（使用中）、idle（闲置）、maintenance（维修中）</li>
              <li>4. 必填字段：品牌、型号、CPU、内存、存储、操作系统、部门、用户、位置</li>
              <li>5. 如果资产编码已存在，系统会更新该资产信息；如果不存在，系统会新建资产</li>
              <li>6. 上传文件后会显示预览，确认无误后点击开始导入</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
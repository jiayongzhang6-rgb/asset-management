import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import * as XLSX from 'xlsx'

export default function Import() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
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
          return {
            brand: item['品牌'] || item['Brand'] || item['brand'] || '',
            model: item['型号'] || item['Model'] || item['model'] || '',
            cpu: item['CPU'] || item['cpu'] || '',
            ram: item['内存'] || item['RAM'] || item['ram'] || '',
            storage: item['存储'] || item['Storage'] || item['storage'] || '',
            gpu: item['显卡'] || item['GPU'] || item['gpu'] || '',
            os: item['操作系统'] || item['OS'] || item['os'] || '',
            department: item['部门'] || item['Department'] || item['department'] || '',
            user_name: item['用户'] || item['User'] || item['user_name'] || '',
            location: item['位置'] || item['Location'] || item['location'] || '',
            status: 'active',
            notes: item['备注'] || item['Notes'] || item['notes'] || '',
            asset_code: generateAssetCode(index)
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
    if (previewData.length === 0) {
      alert('没有可导入的数据')
      return
    }

    setIsUploading(true)
    try {
      const { error } = await supabase.from('assets').insert(previewData)
      if (error) throw error
      alert('资产导入成功')
      navigate('/')
    } catch (error) {
      console.error('导入失败:', error)
      alert('资产导入失败')
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    // 这里简化处理，实际项目中需要生成Excel文件
    alert('模板下载功能开发中')
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
              <li>2. 支持的字段：品牌、型号、CPU、内存、存储、显卡、操作系统、部门、用户、位置、状态、备注</li>
              <li>3. 状态字段可选值：active（使用中）、idle（闲置）、maintenance（维修中）</li>
              <li>4. 必填字段：品牌、型号、CPU、内存、存储、操作系统、部门、用户、位置</li>
              <li>5. 上传文件后会显示预览，确认无误后点击开始导入</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase, recordAllHistory, generateUniqueAssetCode, updateAssetRobust, insertAssetRobust, saveAssetSnapshot } from '../lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function Import() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  // 批量生成编码（先贴标签、后登记信息）
  const [genCount, setGenCount] = useState(20)
  const [genPrefix, setGenPrefix] = useState('DZ-')
  const [genCategory, setGenCategory] = useState('')
  const [genStatus, setGenStatus] = useState('idle')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

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
          
          const statusValue = item['状态']?.trim() || item['Status']?.trim() || item['status']?.trim()
          const validStatuses = ['active', 'idle', 'maintenance', 'retired']
          
          return {
            asset_code: item['资产编码'] || item['asset_code'] || item['AssetCode'] || '', // 留空，导入时自动生成
            category: item['分类'] || item['类别'] || item['category'] || '',
            brand: item['品牌'] || item['Brand'] || item['brand'] || '',
            model: item['型号'] || item['Model'] || item['model'] || item['计算机名'] || '',
            cpu: item['CPU'] || item['cpu'] || '',
            ram: item['内存(GB)'] || item['内存'] || item['RAM'] || item['ram'] || item['内存容量'] || '',
            storage: item['硬盘'] || item['存储'] || item['Storage'] || item['storage'] || item['硬盘容量'] || '',
            gpu: item['显卡'] || item['GPU'] || item['gpu'] || '',
            os: item['操作系统'] || item['OS'] || item['os'] || '',
            department: item['部门'] || item['Department'] || item['department'] || '',
            user_name: item['使用人'] || item['用户'] || item['User'] || item['user_name'] || item['使用人姓名'] || '',
            lessee_entity: item['承租主体'] || item['lessee_entity'] || '',
            lessee_manager: item['承租负责人'] || item['lessee_manager'] || '',
            parent_asset_code: item['所属主机编码'] || item['主机编码'] || item['parent_asset_code'] || '',
            location: item['地点'] || item['位置'] || item['Location'] || item['location'] || '',
            status: validStatuses.includes(statusValue) ? statusValue : 'active',
            monthly_rent: Number(item['月租费']) || Number(item['monthly_rent']) || Number(item['MonthlyRent']) || 0,
            notes: [
              item['备注'] || item['Notes'] || item['notes'] || '',
              ...otherFields
            ].filter(Boolean).join('; ')
          }
        })
        
        setPreviewData(processedData)
        toast.success(`成功解析 ${processedData.length} 条数据`)
      } catch (error) {
        console.error('文件解析失败:', error)
        toast.error('文件解析失败，请检查文件格式')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (user && user.role !== 'admin') {
      toast.error('只有管理员可以导入资产')
      return
    }

    if (previewData.length === 0) {
      toast.error('没有可导入的数据')
      return
    }

    // 预检查：哪些行有明确编号且会覆盖已有数据
    const conflictAssets: { code: string; brand: string; model: string }[] = []
    for (const asset of previewData) {
      const code = asset.asset_code?.trim()
      if (!code) continue
      const { data, error } = await supabase
        .from('assets_public')
        .select('brand, model')
        .eq('asset_code', code)
        .single()
      if (!error && data) {
        conflictAssets.push({ code, brand: data.brand || '', model: data.model || '' })
      }
    }

    // 如果有冲突，弹窗确认
    if (conflictAssets.length > 0) {
      const list = conflictAssets.slice(0, 10).map(a => `  ${a.code} (${a.brand} ${a.model})`).join('\n')
      const more = conflictAssets.length > 10 ? `\n  ...等共 ${conflictAssets.length} 条` : ''
      const confirmed = window.confirm(
        `检测到以下 ${conflictAssets.length} 个资产编码已存在，导入将覆盖这些资产的原有数据：\n\n${list}${more}\n\n` +
        `已自动保存快照备份，确认要覆盖吗？`
      )
      if (!confirmed) {
        toast('导入已取消')
        return
      }
    }

    setIsUploading(true)
    let successCount = 0
    let failCount = 0
    let updateCount = 0
    let insertCount = 0

    try {
      for (const asset of previewData) {
        try {
          // 只有用户在 Excel 中明确填写了资产编码时，才检查是否已存在（走更新）
          // 没填编码的一律走新增，自动生成唯一编号
          const hasExplicitCode = !!(asset.asset_code && asset.asset_code.trim())
          let existingAsset = null

          if (hasExplicitCode) {
            const { data, error: checkError } = await supabase
              .from('assets_public')
              .select('*')
              .eq('asset_code', asset.asset_code)
              .single()

            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError
            }
            existingAsset = data
          }

          if (existingAsset) {
            // 用户明确提供了编号且匹配到已有记录 → 先保存快照再更新
            if (user) {
              await saveAssetSnapshot(asset.asset_code, 'import_update', user.email, existingAsset)
            }
            // category 列空字符串则剥掉（保持与新增一致的语义）
            const assetCopy = { ...asset }
            if ('category' in assetCopy && !assetCopy.category) {
              delete assetCopy.category
            }
            // 使用 updateAssetRobust 双通道更新，category 不会因 schema cache 看不到列而失败
            const { error: updateError } = await updateAssetRobust(asset.asset_code, assetCopy)

            if (updateError) {
              console.error('Error updating asset:', updateError)
              failCount++
              continue
            }

            updateCount++
            successCount++

            if (user) {
              await recordAllHistory(asset.asset_code, 'update', user.email)
            }
          } else {
            // 新增：没填编号时自动生成唯一编号
            if (!hasExplicitCode) {
              asset.asset_code = await generateUniqueAssetCode()
            }
            // category 列空字符串则剥掉
            if ('category' in asset && !asset.category) {
              delete (asset as any).category
            }
            // 使用 insertAssetRobust 双通道插入
            const { data, error: insertError } = await insertAssetRobust(asset)

            if (insertError) {
              console.error('Error inserting asset:', insertError)
              failCount++
              continue
            }

            insertCount++
            successCount++

            if (user) {
              await recordAllHistory(asset.asset_code, 'create', user.email)
            }
          }
        } catch (assetError) {
          console.error('Error processing asset:', assetError)
          failCount++
        }
      }
      
      toast.success(`资产导入完成！成功：${successCount} 条（新增：${insertCount}，更新：${updateCount}），失败：${failCount} 条`)
      navigate('/')
    } catch (error) {
      console.error('导入失败:', error)
      toast.error(`资产导入失败，成功：${successCount} 条，失败：${failCount} 条`)
    } finally {
      setIsUploading(false)
    }
  }

  // 批量生成空白资产编码：先拿编码去贴标签，之后逐台登记信息
  const handleGenerateCodes = async () => {
    if (!user || user.role !== 'admin') {
      toast.error('只有管理员可以批量生成编码')
      return
    }
    const count = Math.floor(Number(genCount))
    if (!count || count < 1 || count > 500) {
      toast.error('生成数量需在 1 ~ 500 之间')
      return
    }
    const prefix = genPrefix.trim()
    if (!prefix) {
      toast.error('请填写编码前缀，例如 DZ- 或 MON-')
      return
    }
    if (!window.confirm(
      `将生成 ${count} 个以「${prefix}」开头的新资产编码，状态默认为「${genStatus === 'idle' ? '闲置' : genStatus === 'active' ? '使用中' : genStatus === 'maintenance' ? '维修中' : '已报废'}」。\n\n` +
      `这些记录只有编码、没有配置信息，可先打印标签贴好后，再到列表里逐台登记。\n\n确认生成？`
    )) return

    setIsGenerating(true)
    try {
      // 一次查出同前缀的已有编码，避免重复
      const { data: existing, error } = await supabase
        .from('assets_public')
        .select('asset_code')
        .like('asset_code', `${prefix}%`)
      if (error) throw error

      const existingSet = new Set<string>((existing || []).map((r: any) => String(r.asset_code)))
      let maxSeq = 0
      existingSet.forEach(code => {
        if (!code.startsWith(prefix)) return
        const tail = code.slice(prefix.length)
        const m = /^(\d+)$/.exec(tail)
        if (m) {
          const n = parseInt(m[1], 10)
          if (n > maxSeq) maxSeq = n
        }
      })

      const created: string[] = []
      let failed = 0
      let seq = maxSeq
      while (created.length < count && seq < maxSeq + count * 3 + 50) {
        seq++
        const code = `${prefix}${String(seq).padStart(3, '0')}`
        if (existingSet.has(code)) continue

        const payload: Record<string, any> = {
          asset_code: code,
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
          status: genStatus,
          monthly_rent: 0,
          notes: '待登记信息'
        }
        if (genCategory.trim()) payload.category = genCategory.trim()

        const { error: insertError } = await insertAssetRobust(payload)
        if (insertError) {
          console.error('生成编码失败:', code, insertError)
          failed++
          continue
        }
        created.push(code)
        if (user) {
          await recordAllHistory(code, 'create', user.email, '批量生成空白编码')
        }
      }

      setGeneratedCodes(created)
      if (created.length === 0) {
        toast.error('生成失败，请检查网络或权限后重试')
      } else if (failed > 0) {
        toast.success(`已生成 ${created.length} 个编码，${failed} 个失败`, { duration: 6000 })
      } else {
        toast.success(`已生成 ${created.length} 个编码`)
      }
    } catch (e: any) {
      console.error('批量生成编码失败:', e)
      toast.error(`批量生成编码失败: ${e?.message || e}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadGeneratedCodes = () => {
    if (generatedCodes.length === 0) return
    const rows = generatedCodes.map(code => ({ '资产编码': code }))
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{ wch: 16 }]
    XLSX.utils.book_append_sheet(workbook, worksheet, '编码清单')
    XLSX.writeFile(workbook, `编码清单_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const copyGeneratedCodes = async () => {
    if (generatedCodes.length === 0) return
    try {
      await navigator.clipboard.writeText(generatedCodes.join('\n'))
      toast.success('编码已复制到剪贴板')
    } catch {
      toast.error('复制失败，请手动下载编码清单')
    }
  }

  const downloadTemplate = () => {
    // 说明：一台主机 + 若干外设，外设用「所属主机编码」挂到主机上
    const templateData = [
      {
        '资产编码': 'DZ-001',
        '分类': '台式机',
        '品牌': 'Dell',
        '型号': 'OptiPlex 7090',
        'CPU': 'Intel Core i5-11500',
        '内存(GB)': '16GB',
        '硬盘': '512GB SSD',
        '显卡': '集成显卡',
        '操作系统': 'Windows 10 Pro',
        '部门': '技术部',
        '使用人': '张三',
        '承租主体': '德泽智联（上海）有限公司',
        '承租负责人': '王五',
        '所属主机编码': '',
        '位置': 'A区-101',
        '状态': 'active',
        '月租费': 0,
        '备注': '办公用机'
      },
      {
        '资产编码': 'DZ-002',
        '分类': '笔记本',
        '品牌': 'HP',
        '型号': 'EliteBook 840 G8',
        'CPU': 'Intel Core i7-1165G7',
        '内存(GB)': '32GB',
        '硬盘': '1TB SSD',
        '显卡': 'NVIDIA MX450',
        '操作系统': 'Windows 10 Pro',
        '部门': '市场部',
        '使用人': '李四',
        '承租主体': '德泽智联（上海）有限公司',
        '承租负责人': '王五',
        '所属主机编码': '',
        '位置': 'B区-202',
        '状态': 'active',
        '月租费': 0,
        '备注': '笔记本电脑'
      },
      {
        '资产编码': 'DZ-003',
        '分类': '显示器',
        '品牌': 'Dell',
        '型号': 'U2419H',
        'CPU': '',
        '内存(GB)': '',
        '硬盘': '',
        '显卡': '',
        '操作系统': '',
        '部门': '技术部',
        '使用人': '张三',
        '承租主体': '德泽智联（上海）有限公司',
        '承租负责人': '王五',
        '所属主机编码': 'DZ-001',
        '位置': 'A区-101',
        '状态': 'active',
        '月租费': 0,
        '备注': '外设-显示器，挂在主机 DZ-001 上'
      },
      {
        '资产编码': 'DZ-004',
        '分类': '外设',
        '品牌': '罗技',
        '型号': 'MK120 键鼠套装',
        'CPU': '',
        '内存(GB)': '',
        '硬盘': '',
        '显卡': '',
        '操作系统': '',
        '部门': '技术部',
        '使用人': '张三',
        '承租主体': '德泽智联（上海）有限公司',
        '承租负责人': '王五',
        '所属主机编码': 'DZ-001',
        '位置': 'A区-101',
        '状态': 'active',
        '月租费': 0,
        '备注': '外设-键鼠'
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    // 设置列宽，避免打开后内容挤在一起
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 26 },
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
      { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, '资产模板');
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
          {/* 批量生成编码：先贴标签，后登记信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-1">批量生成设备编码</h2>
            <p className="text-gray-600 mb-4 text-sm">
              先生成一批固定编码（空白记录，状态默认闲置），打印标签贴到设备上；之后在资产列表里逐台补充配置信息，不必一个个手动新增。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生成数量</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">编码前缀</label>
                <input
                  type="text"
                  value={genPrefix}
                  onChange={(e) => setGenPrefix(e.target.value)}
                  placeholder="如 DZ- 或 MON-"
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类（可选）</label>
                <input
                  type="text"
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  placeholder="如 笔记本 / 显示器"
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">初始状态</label>
                <select
                  value={genStatus}
                  onChange={(e) => setGenStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={isGenerating}
                >
                  <option value="idle">闲置</option>
                  <option value="active">使用中</option>
                  <option value="maintenance">维修中</option>
                  <option value="retired">已报废</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerateCodes}
              disabled={isGenerating}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isGenerating ? '生成中...' : `生成 ${genCount || 0} 个编码`}
            </button>

            {generatedCodes.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    本次生成 {generatedCodes.length} 个编码（{generatedCodes[0]} ~ {generatedCodes[generatedCodes.length - 1]}）
                  </span>
                  <div className="flex gap-2">
                    <button onClick={copyGeneratedCodes} className="text-sm px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300">
                      复制编码
                    </button>
                    <button onClick={downloadGeneratedCodes} className="text-sm px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300">
                      下载编码清单
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto bg-gray-50 border rounded p-3 text-sm text-gray-700 font-mono leading-6">
                  {generatedCodes.map(code => (
                    <div key={code}>{code}</div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  提示：想要二维码标签，可在首页勾选这些设备后点「导出二维码」，打印后贴到设备上。
                </p>
              </div>
            )}
          </div>

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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
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
                          <td className="px-4 py-3 text-sm text-gray-900">{item.category || '-'}</td>
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
              <li>1. 下载模板文件（模板里已含主机、显示器、键鼠示例），按格式填写资产信息</li>
              <li>2. 支持的字段：资产编码、分类、品牌、型号、CPU、内存、存储、显卡、操作系统、部门、使用人、承租主体、承租负责人、所属主机编码、位置、状态、月租费、备注</li>
              <li>3. 外设（显示器、键鼠等）也是独立资产：填自己的固定编码，「所属主机编码」填对应主机的编码即可自动建立关联；显示器和键鼠的 CPU / 内存 / 硬盘 / 显卡 / 操作系统可留空</li>
              <li>4. 状态字段可选值：active（使用中）、idle（闲置）、maintenance（维修中）、retired（已报废）</li>
              <li>5. 如果填写了资产编码且已存在，系统会更新该资产信息（覆盖前自动存快照）；如果不填资产编码，系统会自动生成唯一编号并新建资产</li>
              <li>6. 上传文件后会显示预览，确认无误后点击开始导入</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

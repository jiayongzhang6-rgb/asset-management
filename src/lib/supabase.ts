import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===== 类型定义 =====
export type AssetStatus = 'active' | 'idle' | 'maintenance' | 'retired'
export type AssetCategory = '笔记本' | '台式机' | '显示器' | '外设' | '服务器' | '网络设备' | '其他'
export type OperationType = 'create' | 'update' | 'delete'
export type RentStatus = 'paid' | 'unpaid'
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed'

export interface User {
  id: number | string
  email: string
  password?: string
  role: 'admin' | 'user'
  created_at?: string
  updated_at?: string
}

export interface Asset {
  id: number | string
  asset_code: string
  brand: string
  model: string
  cpu: string
  ram: string
  storage: string
  gpu: string
  os: string
  category: AssetCategory | string
  department: string
  user_name: string
  location: string
  status: AssetStatus | string
  notes: string
  monthly_rent: number
  created_at: string
  updated_at: string
}

export interface OperationHistoryRecord {
  id: string
  asset_code: string
  operation_type: OperationType | string
  user_email: string
  changes: string
  created_at: string
}

export interface UsageHistoryRecord {
  id: number
  asset_code: string
  operation_type: OperationType | string
  user_email: string
  changes: string
  created_at: string
}

export interface MaintenanceRecord {
  id: number
  asset_id: string
  issue_description: string
  repair_description: string
  repair_date: string
  repair_cost: number
  status: MaintenanceStatus | string
  created_at: string
  updated_at: string
}

export interface AssetImage {
  id: string
  asset_code: string
  image_url: string
  image_name: string
  created_at: string
  updated_at: string
}

export interface RentRecord {
  id: number
  asset_code: string
  asset_id: string
  department: string
  user_name: string
  monthly_rent: number
  year: number
  month: number
  status: RentStatus | string
  paid_date: string | null
  created_at: string
  updated_at: string
}

// 部门租金统计
export interface DepartmentRentStat {
  department: string
  assetCount: number
  totalRent: number
  paidRent: number
  unpaidRent: number
  assets: { asset_code: string; user_name: string; monthly_rent: number; status: string; brand: string; model: string }[]
}

// ===== 公共工具函数 =====

// 格式化用户标识
export function formatUserIdentifier(email: string | undefined): string {
  if (!email) return ''
  if (email.endsWith('@phone.local')) {
    return email.replace('@phone.local', '')
  }
  return email
}

// 状态中文映射
export function getStatusText(status: string): string {
  const map: Record<string, string> = {
    active: '使用中',
    idle: '闲置',
    maintenance: '维修中',
    retired: '已报废'
  }
  return map[status] || status
}

// 状态标签颜色
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    idle: 'bg-yellow-100 text-yellow-800',
    maintenance: 'bg-red-100 text-red-800',
    retired: 'bg-gray-200 text-gray-600'
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

// 操作类型中文
export function getOperationTypeText(type: string): string {
  const map: Record<string, string> = { create: '创建', update: '更新', delete: '删除' }
  return map[type] || type
}

// 操作类型颜色
export function getOperationTypeColor(type: string): string {
  const map: Record<string, string> = {
    create: 'bg-blue-100 text-blue-800',
    update: 'bg-green-100 text-green-800',
    delete: 'bg-red-100 text-red-800'
  }
  return map[type] || 'bg-gray-100 text-gray-800'
}

// 记录操作历史
export async function recordOperationHistory(
  assetCode: string,
  operationType: OperationType | string,
  userEmail: string,
  changes?: string
): Promise<void> {
  try {
    await supabase.from('operation_history').insert({
      asset_code: assetCode,
      operation_type: operationType,
      user_email: userEmail,
      created_at: new Date().toISOString(),
      changes: changes || null
    })
  } catch (error) {
    console.error('Error recording operation history:', error)
  }
}

// 记录使用历史
export async function recordUsageHistory(
  assetCode: string,
  operationType: OperationType | string,
  userEmail: string,
  changes?: string
): Promise<void> {
  try {
    await supabase.from('usage_history').insert({
      asset_code: assetCode,
      operation_type: operationType,
      user_email: userEmail,
      changes: changes || null
    })
  } catch (error) {
    console.error('Error recording usage history:', error)
  }
}

// 记录所有历史（操作历史 + 使用历史）
export async function recordAllHistory(
  assetCode: string,
  operationType: OperationType | string,
  userEmail: string,
  changes?: string
): Promise<void> {
  await Promise.all([
    recordOperationHistory(assetCode, operationType, userEmail, changes),
    recordUsageHistory(assetCode, operationType, userEmail, changes)
  ])
}

// 保存资产快照（更新/删除前调用，把旧数据存到 asset_snapshots 表）
export async function saveAssetSnapshot(
  assetCode: string,
  operationType: string,
  operatorEmail: string,
  snapshotData: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('asset_snapshots').insert({
      asset_code: assetCode,
      operation_type: operationType,
      operator_email: operatorEmail,
      snapshot: snapshotData,
      created_at: new Date().toISOString()
    })
    console.log(`Snapshot saved for ${assetCode} (${operationType})`)
  } catch (error) {
    console.error('Error saving asset snapshot:', error)
  }
}

// ===== 租赁管理工具函数 =====

// 快速修改单个资产月租费（同时更新 assets 表和当月 rent_records）
export async function updateAssetRent(
  assetCode: string,
  newRent: number,
  operatorEmail: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. 获取旧数据
    const { data: oldAsset, error: getErr } = await supabase
      .from('assets_public')
      .select('*')
      .eq('asset_code', assetCode)
      .single()
    if (getErr) throw getErr

    // 2. 保存快照
    await saveAssetSnapshot(assetCode, 'rent_change', operatorEmail, oldAsset)

    // 3. 更新 assets 表
    const { error: updateErr } = await supabase
      .from('assets')
      .update({ monthly_rent: newRent, updated_at: new Date().toISOString() })
      .eq('asset_code', assetCode)
    if (updateErr) throw updateErr

    // 4. 同步更新当月 rent_records（如果已生成）
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    await supabase
      .from('rent_records')
      .update({ monthly_rent: newRent, updated_at: new Date().toISOString() })
      .eq('asset_code', assetCode)
      .eq('year', year)
      .eq('month', month)

    // 5. 记录历史
    await recordAllHistory(assetCode, 'update', operatorEmail,
      `月租费: ¥${oldAsset.monthly_rent || 0} → ¥${newRent}`)

    return { success: true, message: `租金已更新: ¥${oldAsset.monthly_rent || 0} → ¥${newRent}` }
  } catch (e: any) {
    console.error('updateAssetRent error:', e)
    return { success: false, message: e?.message || '更新失败' }
  }
}

// 批量修改部门资产月租费
export async function batchUpdateRent(
  updates: { asset_code: string; monthly_rent: number }[],
  operatorEmail: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const u of updates) {
    const result = await updateAssetRent(u.asset_code, u.monthly_rent, operatorEmail)
    if (result.success) {
      success++
    } else {
      failed++
      errors.push(`${u.asset_code}: ${result.message}`)
    }
  }

  return { success, failed, errors }
}

// 获取按部门统计的租金数据（实时，从 assets 表读取）
export async function getDepartmentRentStats(): Promise<DepartmentRentStat[]> {
  try {
    const { data, error } = await supabase
      .from('assets_public')
      .select('asset_code, department, user_name, monthly_rent, status, brand, model')
      .neq('status', 'retired')
      .order('department')

    if (error) throw error

    const deptMap = new Map<string, DepartmentRentStat>()

    for (const a of data || []) {
      const dept = a.department || '未分配'
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          assetCount: 0,
          totalRent: 0,
          paidRent: 0,
          unpaidRent: 0,
          assets: []
        })
      }
      const stat = deptMap.get(dept)!
      stat.assetCount++
      const rent = Number(a.monthly_rent) || 0
      stat.totalRent += rent
      stat.assets.push({
        asset_code: a.asset_code,
        user_name: a.user_name || '',
        monthly_rent: rent,
        status: a.status,
        brand: a.brand || '',
        model: a.model || ''
      })
    }

    return Array.from(deptMap.values())
  } catch (e: any) {
    console.error('getDepartmentRentStats error:', e)
    return []
  }
}

// 一键生成月度租赁结算单（按部门分组）
// includeIdle: 是否包含闲置(idle)设备，默认 false（不统计闲置）
export async function generateMonthlySettlement(
  year: number,
  month: number,
  operatorEmail: string,
  includeIdle: boolean = false
): Promise<{
  success: boolean
  message: string
  details: { departments: number; totalRecords: number; totalRent: number; errors: string[] }
}> {
  try {
    // 1. 检查是否已生成过
    const { data: existing, error: checkErr } = await supabase
      .from('rent_records')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .limit(1)

    if (checkErr) throw checkErr

    if (existing && existing.length > 0) {
      // 已有记录，更新租金为最新值
      // 按当前 includeIdle 策略同步：不统计闲置时，删除闲置设备的结算记录
      const { data: assets, error: assetErr } = await supabase
        .from('assets_public')
        .select('asset_code, monthly_rent, department, user_name, status')
        .neq('status', 'retired')

      if (assetErr) throw assetErr

      const assetMap = new Map((assets || []).map(a => [a.asset_code, a]))
      let updatedCount = 0

      // 若不包含闲置，先删除已存在的闲置设备结算记录
      if (!includeIdle) {
        const idleCodes = (assets || [])
          .filter(a => a.status === 'idle')
          .map(a => a.asset_code)
          .filter(Boolean)
        if (idleCodes.length > 0) {
          // 分批删除（避免 IN 列表过长）
          const batchSize = 200
          for (let i = 0; i < idleCodes.length; i += batchSize) {
            const batch = idleCodes.slice(i, i + batchSize)
            await supabase
              .from('rent_records')
              .delete()
              .in('asset_code', batch)
              .eq('year', year)
              .eq('month', month)
          }
        }
      } else {
        // 包含闲置：把之前可能被删除的闲置设备补回来
        const idleAssets = (assets || []).filter(a => a.status === 'idle')
        if (idleAssets.length > 0) {
          const toInsert = idleAssets.map(a => ({
            asset_code: a.asset_code,
            asset_id: String(a.id),
            department: a.department || '未分配',
            user_name: a.user_name || '',
            monthly_rent: Number(a.monthly_rent) || 0,
            year,
            month,
            status: 'unpaid' as const,
            paid_date: null
          }))
          // 先查已存在的，避免重复
          const existingCodes = idleAssets.map(a => a.asset_code)
          const { data: existingIdle } = await supabase
            .from('rent_records')
            .select('asset_code')
            .eq('year', year)
            .eq('month', month)
            .in('asset_code', existingCodes)
          const existSet = new Set((existingIdle || []).map(r => r.asset_code))
          const newOnes = toInsert.filter(r => !existSet.has(r.asset_code))
          if (newOnes.length > 0) {
            await supabase.from('rent_records').insert(newOnes)
          }
        }
      }

      for (const [code, a] of assetMap) {
        // 不统计闲置时跳过闲置设备
        if (!includeIdle && a.status === 'idle') continue
        const { error: upErr } = await supabase
          .from('rent_records')
          .update({
            monthly_rent: Number(a.monthly_rent) || 0,
            department: a.department,
            user_name: a.user_name,
            updated_at: new Date().toISOString()
          })
          .eq('asset_code', code)
          .eq('year', year)
          .eq('month', month)

        if (!upErr) updatedCount++
      }

      return {
        success: true,
        message: `结算单已更新（${updatedCount} 条记录已同步最新租金${!includeIdle ? '，已剔除闲置设备' : '，已包含闲置设备'}）`,
        details: { departments: 0, totalRecords: updatedCount, totalRent: 0, errors: [] }
      }
    }

    // 2. 首次生成：获取所有非报废资产
    let query = supabase
      .from('assets_public')
      .select('id, asset_code, department, user_name, monthly_rent, status')
      .neq('status', 'retired')
    if (!includeIdle) {
      query = query.neq('status', 'idle')
    }

    const { data: assets, error: assetErr } = await query

    if (assetErr) throw assetErr

    const newRecords = (assets || []).map(a => ({
      asset_code: a.asset_code,
      asset_id: String(a.id),
      department: a.department || '未分配',
      user_name: a.user_name || '',
      monthly_rent: Number(a.monthly_rent) || 0,
      year,
      month,
      status: 'unpaid' as const,
      paid_date: null
    }))

    if (newRecords.length === 0) {
      return {
        success: false,
        message: '没有可生成结算单的资产',
        details: { departments: 0, totalRecords: 0, totalRent: 0, errors: [] }
      }
    }

    const { error: insertErr } = await supabase
      .from('rent_records')
      .insert(newRecords)

    if (insertErr) throw insertErr

    // 统计部门数和总租金
    const deptSet = new Set(newRecords.map(r => r.department))
    const totalRent = newRecords.reduce((sum, r) => sum + r.monthly_rent, 0)

    // 记录历史
    await recordAllHistory('SYSTEM', 'create', operatorEmail,
      `生成 ${year}年${month}月 租赁结算单（${includeIdle ? '含闲置' : '不含闲置'}）：${newRecords.length} 条记录，${deptSet.size} 个部门，总计 ¥${totalRent.toFixed(2)}`)

    return {
      success: true,
      message: `结算单生成成功：${newRecords.length} 条记录，${deptSet.size} 个部门，总计 ¥${totalRent.toFixed(2)}`,
      details: {
        departments: deptSet.size,
        totalRecords: newRecords.length,
        totalRent,
        errors: []
      }
    }
  } catch (e: any) {
    console.error('generateMonthlySettlement error:', e)
    return {
      success: false,
      message: e?.message || '生成结算单失败',
      details: { departments: 0, totalRecords: 0, totalRent: 0, errors: [e?.message] }
    }
  }
}

// 获取随机资产及其租金之和（用于首页随机筛选）
export async function getRandomAssetsRent(count: number = 10): Promise<{
  assets: { asset_code: string; brand: string; model: string; department: string; user_name: string; monthly_rent: number; status: string }[]
  totalRent: number
}> {
  try {
    const { data, error } = await supabase
      .from('assets_public')
      .select('asset_code, brand, model, department, user_name, monthly_rent, status')
      .neq('status', 'retired')

    if (error) throw error

    const all = data || []
    // 随机打乱
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(count, all.length))
    const totalRent = selected.reduce((sum, a) => sum + (Number(a.monthly_rent) || 0), 0)

    return { assets: selected, totalRent }
  } catch (e: any) {
    console.error('getRandomAssetsRent error:', e)
    return { assets: [], totalRent: 0 }
  }
}

// ===== 硬件估价与配置格式化 =====

// 将资产硬件信息格式化为紧凑配置字符串，如 "i7-10700F/16G/512+2T/1660S"
export function formatHardwareSpec(asset: { cpu?: string; ram?: string; storage?: string; gpu?: string }): string {
  const parts: string[] = []

  // CPU：提取核心型号，如 "Intel(R) Core(TM) i7-10700F CPU @ 2.90GHz" → "i7-10700F"
  if (asset.cpu) {
    const cpuMatch = asset.cpu.match(/i[35779]-\d{4,5}[A-Z]*/i)
                   || asset.cpu.match(/Ryzen\s+\d\s+\d{4}/i)
                   || asset.cpu.match(/Atom|Celeron|Pentium|Xeon/i)
    parts.push(cpuMatch ? cpuMatch[0] : asset.cpu.substring(0, 20))
  }

  // 内存：提取数字 + G
  if (asset.ram) {
    const ramNum = parseFloat(asset.ram)
    if (!isNaN(ramNum)) {
      parts.push(`${Math.round(ramNum)}G`)
    } else {
      const ramMatch = asset.ram.match(/(\d+)\s*GB?/i)
      parts.push(ramMatch ? `${ramMatch[1]}G` : asset.ram)
    }
  }

  // 存储：简化显示，如 "512GB SSD;1TB HDD" → "512+1T"
  if (asset.storage) {
    const storageParts = asset.storage.split(/[;，,]/).map(s => s.trim()).filter(Boolean)
    const simplified = storageParts.map(s => {
      const match = s.match(/(\d+)\s*(TB|GB|MB)/i)
      if (match) {
        const num = parseInt(match[1])
        const unit = match[2].toUpperCase()
        if (unit === 'TB') return `${num}T`
        if (unit === 'GB') return num >= 1024 ? `${(num / 1024).toFixed(1).replace('.0', '')}T` : `${num}G`
        return `${num}M`
      }
      return s.substring(0, 10)
    })
    parts.push(simplified.join('+'))
  }

  // GPU：简化显示
  if (asset.gpu) {
    const gpu = asset.gpu
    if (/1660/i.test(gpu)) parts.push('1660')
    else if (/1650/i.test(gpu)) parts.push('1650')
    else if (/2060/i.test(gpu)) parts.push('2060')
    else if (/3060/i.test(gpu)) parts.push('3060')
    else if (/3070/i.test(gpu)) parts.push('3070')
    else if (/3080/i.test(gpu)) parts.push('3080')
    else if (/4060/i.test(gpu)) parts.push('4060')
    else if (/4070/i.test(gpu)) parts.push('4070')
    else if (/4080/i.test(gpu)) parts.push('4080')
    else if (/4090/i.test(gpu)) parts.push('4090')
    else if (/1050/i.test(gpu)) parts.push('1050')
    else if (/1030/i.test(gpu)) parts.push('1030')
    else if (/UHD/i.test(gpu)) parts.push('UHD')
    else if (/集成|Integrated|UHD/i.test(gpu)) parts.push('集显')
    else {
      // 取关键词
      const gpuMatch = gpu.match(/(?:RTX|GTX|GT)\s*\d{3,4}/i)
      parts.push(gpuMatch ? gpuMatch[0] : gpu.substring(0, 10))
    }
  }

  return parts.length > 0 ? parts.join('/') : '-'
}

// 根据硬件配置估算资产价值
// 返回 { fixedValue: 固定估值（购入价估算）, currentValue: 实时估值（折旧后） }
export function estimateAssetValue(asset: { cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; model?: string; created_at?: string }): {
  fixedValue: number
  currentValue: number
} {
  let value = 0

  // CPU 估值
  if (asset.cpu) {
    const cpu = asset.cpu.toUpperCase()
    if (/I9-\d{4,5}/.test(cpu)) value += 3000
    else if (/I7-\d{5}/.test(cpu)) {
      // 12代+
      const gen = parseInt(cpu.match(/I7-(\d)/)?.[1] || '0')
      value += gen >= 12 ? 2200 : 1800
    }
    else if (/I7-\d{4}/.test(cpu)) value += 1800
    else if (/I5-\d{5}/.test(cpu)) {
      const gen = parseInt(cpu.match(/I5-(\d)/)?.[1] || '0')
      value += gen >= 12 ? 1500 : 1200
    }
    else if (/I5-\d{4}/.test(cpu)) value += 1200
    else if (/I3-\d{4,5}/.test(cpu)) value += 800
    else if (/RYZEN\s*[579]/.test(cpu)) value += 1500
    else if (/RYZEN\s*3/.test(cpu)) value += 800
    else if (/CELERON|PENTIUM|ATOM/i.test(cpu)) value += 300
    else if (/XEON/i.test(cpu)) value += 1200
    else value += 800
  }

  // 内存估值
  if (asset.ram) {
    const ramNum = parseFloat(asset.ram)
    if (!isNaN(ramNum)) {
      if (ramNum >= 64) value += 800
      else if (ramNum >= 32) value += 450
      else if (ramNum >= 16) value += 250
      else if (ramNum >= 8) value += 120
      else value += 60
    }
  }

  // 存储估值
  if (asset.storage) {
    const storage = asset.storage.toUpperCase()
    const hasSSD = /SSD|NVME|M\.2/i.test(storage)
    const hasHDD = /HDD|MECHANICAL/i.test(storage)
    const tbMatch = storage.match(/(\d+)\s*TB/)
    const gbMatch = storage.match(/(\d+)\s*GB/)

    let storageVal = 0
    if (tbMatch) {
      const tb = parseInt(tbMatch[1])
      storageVal += tb * (hasSSD ? 500 : 200)
    }
    if (gbMatch) {
      const gb = parseInt(gbMatch[1])
      if (gb >= 512) storageVal += hasSSD ? 250 : 100
      else if (gb >= 256) storageVal += hasSSD ? 150 : 60
      else storageVal += 50
    }
    if (storage.includes(';') || storage.includes(',')) storageVal += 100 // 多盘加价
    value += storageVal || 100
  }

  // GPU 估值
  if (asset.gpu) {
    const gpu = asset.gpu.toUpperCase()
    if (/4090/.test(gpu)) value += 12000
    else if (/4080/.test(gpu)) value += 7000
    else if (/4070/.test(gpu)) value += 4000
    else if (/4060/.test(gpu)) value += 2500
    else if (/3090/.test(gpu)) value += 8000
    else if (/3080/.test(gpu)) value += 5000
    else if (/3070/.test(gpu)) value += 3500
    else if (/3060/.test(gpu)) value += 2000
    else if (/2080/.test(gpu)) value += 2500
    else if (/2070/.test(gpu)) value += 1800
    else if (/2060/.test(gpu)) value += 1200
    else if (/1660/.test(gpu)) value += 900
    else if (/1650/.test(gpu)) value += 600
    else if (/1050/.test(gpu)) value += 300
    else if (/1030/.test(gpu)) value += 150
    else if (/UHD|INTEGRATED|集成/.test(gpu)) value += 0 // 集成显卡不额外加价
    else value += 200
  }

  // 品牌溢价
  if (asset.brand) {
    const brand = asset.brand.toUpperCase()
    if (/APPLE|MAC/.test(brand)) value = Math.round(value * 1.5)
    else if (/DELL|HP|LENOVO|ASUS/.test(brand)) value = Math.round(value * 1.1)
  }

  // 最低价值
  const fixedValue = Math.max(value, 500)

  // 实时估值：按年份折旧
  // 折旧规则：第1年85%，第2年70%，第3年55%，第4年40%，第5年30%，5年以上20%
  let ageYears = 1
  if (asset.created_at) {
    const created = new Date(asset.created_at)
    const now = new Date()
    ageYears = (now.getTime() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ageYears = Math.max(0.5, ageYears)
  }

  let depreciationRate: number
  if (ageYears < 1) depreciationRate = 0.85
  else if (ageYears < 2) depreciationRate = 0.70
  else if (ageYears < 3) depreciationRate = 0.55
  else if (ageYears < 4) depreciationRate = 0.40
  else if (ageYears < 5) depreciationRate = 0.30
  else depreciationRate = 0.20

  const currentValue = Math.round(fixedValue * depreciationRate / 100) * 100

  return { fixedValue, currentValue }
}

// 删除指定年月的结算单（取消结算）
export async function deleteMonthlySettlement(
  year: number,
  month: number,
  operatorEmail: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 先查询要删除的记录数
    const { count, error: countErr } = await supabase
      .from('rent_records')
      .select('*', { count: 'exact', head: true })
      .eq('year', year)
      .eq('month', month)

    if (countErr) throw countErr

    if (!count || count === 0) {
      return { success: false, message: `${year}年${month}月没有结算单记录` }
    }

    // 删除
    const { error: deleteErr } = await supabase
      .from('rent_records')
      .delete()
      .eq('year', year)
      .eq('month', month)

    if (deleteErr) throw deleteErr

    // 记录历史
    await recordAllHistory('SYSTEM', 'delete', operatorEmail,
      `删除 ${year}年${month}月 租赁结算单（${count} 条记录）`)

    return { success: true, message: `已删除 ${year}年${month}月 结算单（${count} 条记录）` }
  } catch (e: any) {
    console.error('deleteMonthlySettlement error:', e)
    return { success: false, message: e?.message || '删除失败' }
  }
}

// 格式化内存
export function formatMemory(memory: string): string {
  try {
    const num = parseFloat(memory)
    if (!isNaN(num)) {
      return `${Math.round(num)}GB`
    }
  } catch { /* ignore */ }
  return memory
}

// 格式化存储
export function formatStorage(storage: string): string {
  try {
    const num = parseFloat(storage)
    if (!isNaN(num)) {
      const rounded = Math.round(num)
      if (rounded >= 1000) {
        return `${(rounded / 1000).toFixed(1)}TB`
      }
      return `${rounded}GB`
    }
  } catch { /* ignore */ }
  return storage
}

// 生成资产编码（同步版本，仅用于已知总数时的快速生成，不推荐）
export function generateAssetCode(count: number): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const seq = String(count + 1).padStart(3, '0')
  return `PC-${year}-${month}-${seq}`
}

// 异步生成资产编码：查询数据库当月最大序号 +1，避免编号冲突
export async function generateUniqueAssetCode(): Promise<string> {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const prefix = `PC-${year}-${month}-`

  try {
    // 查询当月所有以该前缀开头的资产编码
    const { data, error } = await supabase
      .from('assets_public')
      .select('asset_code')
      .like('asset_code', `${prefix}%`)

    if (error) {
      console.warn('Failed to query max asset code, falling back to count:', error.message)
      // 降级：用总数+1
      const { count } = await supabase.from('assets_public').select('*', { count: 'exact', head: true })
      return `${prefix}${String((count || 0) + 1).padStart(3, '0')}`
    }

    // 找出最大序号
    let maxSeq = 0
    if (data && data.length > 0) {
      for (const row of data) {
        const code = row.asset_code as string
        if (code && code.startsWith(prefix)) {
          const seqStr = code.substring(prefix.length)
          const seqNum = parseInt(seqStr, 10)
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum
          }
        }
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`
  } catch (e: any) {
    console.warn('generateUniqueAssetCode error, using fallback:', e?.message)
    return `${prefix}001`
  }
}

// ===== 数据恢复：将被覆盖的3台资产恢复原始数据，新增的3台挪到新编号 =====
export async function recoverOverwrittenAssets(operatorEmail?: string): Promise<{ success: boolean; message: string; details: any }> {
  const operator = operatorEmail || 'system-recovery'

  // 3条原始资产数据（用户提供）
  const originalRecords: Record<string, any>[] = [
    {
      _id: '111209',
      user_name: '111209',
      department: '仓库',
      location: '仓库',
      status: 'idle',
      brand: 'MAXSUN',
      model: 'MS-TZZ H510M-H',
      cpu: 'Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz',
      ram: '31.92',
      os: 'Microsoft Windows 10 企业版 LTSC',
      gpu: 'NVIDIA GeForce GTX 1660 SUPER',
      storage: 'GIGABYTE G325E500G;HIKSEMI USB Device',
      notes: [
        '系统UUID: 6B891920-A9E8-11ED-A405-02BF23AE1200',
        'BIOS: Default string',
        '主板: Default string',
        '系统版本: 10.0.17763',
        '显卡驱动: 495.05',
        '磁盘序号: 6479_A76E_F0C0_06CB.;FC2147403ECF1',
        '计算机名: 20230228PC'
      ].join('; ')
    },
    {
      _id: 'ai技术1',
      user_name: 'ai技术1',
      department: '仓库',
      location: '仓库',
      status: 'idle',
      brand: 'ASUS',
      model: 'System Product Name',
      cpu: '12th Gen Intel(R) Core(TM) i7-12700KF',
      ram: '31.79',
      os: 'Microsoft Windows 11 专业版',
      gpu: 'OrayIddDriver Device',
      storage: 'CT2000P3PSSD8;HIKSEMI USB Device',
      notes: [
        '系统UUID: 1E6DA984-34F5-D929-849F-BCFCE7533406',
        'BIOS: System Serial Number',
        '主板序号: 250149204901162',
        '系统版本: 10.0.26200',
        '显卡驱动: 1892.3',
        '磁盘序号: 0000_0000_0000_0001_00A0_7524_4C86_8CC9.;FC2147403ECF1',
        'MAC: 00:50:56:C0:00:01;00:50:56:C0:00:08',
        'IP: 192.168.139.1;fe80::fcd4:d4c8:2220:9eb5;192.168.190.1;fe80::a3a4:f9a7:3f50:a465',
        '计算机名: XTWY20250317'
      ].join('; ')
    },
    {
      _id: 'laowubijiben1',
      user_name: 'laowubijiben1',
      department: '仓库',
      location: '仓库',
      status: 'idle',
      brand: 'HP',
      model: 'HP EliteBook 630 13 inch G9 Notebook PC',
      cpu: '12th Gen Intel(R) Core(TM) i5-1235U',
      ram: '15.64',
      os: 'Microsoft Windows 10 专业版',
      gpu: 'Intel(R) UHD Graphics',
      storage: 'KBG50ZNV512G KIOXIA;HIKSEMI USB Device',
      notes: [
        '系统UUID: 949528A6-4FDF-4B0B-BFF2-620F0A31E8F7',
        'BIOS: 5CD335GPZ3',
        '主板序号: PPYED118JII0Z8',
        '系统版本: 10.0.19045',
        '显卡驱动: 506.23',
        '磁盘序号: 0000_0000_0000_0000_8CE3_8E04_0453_DB36.;FC2147403ECF1',
        '计算机名: DESKTOP-A4RB6BV'
      ].join('; ')
    }
  ]

  // 查找被覆盖的3条资产（按 user_name 匹配）
  const result: any = { moved: [], restored: [], errors: [] }

  for (const record of originalRecords) {
    try {
      // 找到对应用户的资产
      const { data: assets, error } = await supabase
        .from('assets_public')
        .select('*')
        .eq('user_name', record._id)
        .limit(5)

      if (error) {
        result.errors.push(`查询 ${record._id} 失败: ${error.message}`)
        continue
      }

      if (!assets || assets.length === 0) {
        result.errors.push(`未找到用户 ${record._id} 的资产`)
        continue
      }

      // 取第一条匹配的（按更新时间最近的）
      const targetAsset = assets[0]
      const oldData = { ...targetAsset }

      // 1. 保存快照
      await saveAssetSnapshot(targetAsset.asset_code, 'recovery_backup', operator, oldData)

      // 2. 把当前数据挪到新编号（新增一条，不删除旧的，以防万一）
      const newCode = await generateUniqueAssetCode()
      const { error: insertErr } = await supabase
        .from('assets')
        .insert({
          ...oldData,
          id: undefined,
          asset_code: newCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notes: `[恢复备份] 原编号: ${targetAsset.asset_code}；${oldData.notes || ''}`
        })

      if (insertErr) {
        result.errors.push(`备份 ${targetAsset.asset_code} 到新编号失败: ${insertErr.message}`)
        continue
      }

      result.moved.push({ from: targetAsset.asset_code, to: newCode, user: record._id })

      // 3. 更新原编号为原始数据
      const updateData: Record<string, any> = {
        user_name: record.user_name,
        department: record.department,
        location: record.location,
        status: record.status,
        brand: record.brand,
        model: record.model,
        cpu: record.cpu,
        ram: record.ram,
        os: record.os,
        gpu: record.gpu,
        storage: record.storage,
        notes: record.notes,
        updated_at: new Date().toISOString()
      }

      // 如果 category 列不可用则剥离
      const cleanUpdateData = await sanitizeAssetData(updateData)

      const { error: updateErr } = await supabase
        .from('assets')
        .update(cleanUpdateData)
        .eq('asset_code', targetAsset.asset_code)

      if (updateErr) {
        result.errors.push(`恢复 ${targetAsset.asset_code} 失败: ${updateErr.message}`)
        continue
      }

      result.restored.push({ code: targetAsset.asset_code, user: record._id, model: record.model })

      // 记录操作历史
      await recordAllHistory(targetAsset.asset_code, 'update', operator,
        `恢复原始数据：品牌=${record.brand}, 型号=${record.model}, CPU=${record.cpu}`)
      await recordAllHistory(newCode, 'create', operator,
        `从 ${targetAsset.asset_code} 迁移过来的备份数据`)

    } catch (e: any) {
      result.errors.push(`处理 ${record._id} 异常: ${e?.message}`)
    }
  }

  return {
    success: result.errors.length === 0,
    message: result.errors.length === 0 ? '数据恢复完成' : `恢复完成，${result.errors.length} 项出错`,
    details: result
  }
}

// ===== 数据库初始化 =====获取北京时间
export function getBeijingTime(utcStr: string): string {
  const utcDate = new Date(utcStr)
  const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000)
  return beijingDate.toLocaleString('zh-CN')
}

// ===== 数据库初始化 =====
const DB_VERSION_KEY = 'db_schema_version'
const CURRENT_DB_VERSION = 6

// 运行时检测 category 列是否可用（PostgREST schema cache 是否已包含）
// 注意：_categorySupported 取值含义：null=未探测, true=可用, false=不可用
// 同步代码默认先假定不可用（保守策略），探测结果回来后缓存
let _categorySupported: boolean | null = null

// 同步获取缓存的检测结果（用于同步 if 判断等），未探测时返回 false（保守策略）
export function isCategorySupportedSync(): boolean {
  return _categorySupported === true
}

export async function isCategorySupported(): Promise<boolean> {
  if (_categorySupported !== null) return _categorySupported
  try {
    const { error } = await supabase.from('assets_public').select('category').limit(1)
    if (!error) {
      _categorySupported = true
      return true
    }
    // category 列在 PostgREST 中不可见 → 自动刷新 schema cache 并重试
    console.warn('[Category] category 列不可见，尝试 NOTIFY pgrst 刷新 schema cache')
    try {
      // 尝试用 execute_sql 刷新
      const { data: sqlData } = await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
      if (sqlData && typeof sqlData === 'object' && 'error' in sqlData) {
        // execute_sql 存在但执行失败
        console.warn('[Category] NOTIFY 失败:', (sqlData as any).error)
        _categorySupported = false
        return false
      }
      // 等待 schema cache 刷新
      await new Promise(r => setTimeout(r, 1500))
      const { error: retryErr } = await supabase.from('assets_public').select('category').limit(1)
      _categorySupported = !retryErr
      if (retryErr) {
        console.warn('[Category] 刷新后仍不可见，将剥离 category 字段')
      } else {
        console.log('[Category] schema cache 刷新成功！category 列可用')
      }
      return _categorySupported
    } catch (e: any) {
      // execute_sql RPC 不存在 → 无法自动刷新
      console.warn('[Category] 无法自动刷新 schema cache（execute_sql RPC 不可用）')
      _categorySupported = false
      return false
    }
  } catch (e: any) {
    console.warn('Category check threw error:', e?.message)
    _categorySupported = false
    return false
  }
}

// 预热探测（异步、不阻塞启动），让同步 getter 尽快拿到正确结果
export function warmUpCategoryCheck(): void {
  if (_categorySupported === null) {
    void isCategorySupported()
  }
}

// 在发送给 Supabase 之前，如果 category 列不可用则剥离该字段
export async function sanitizeAssetData<T extends Record<string, any>>(data: T): Promise<T> {
  const supported = await isCategorySupported()
  if (!supported && 'category' in data) {
    const { category, ...rest } = data
    return rest as T
  }
  return data
}

// 批量处理（用于 import 等场景）
export async function sanitizeAssetBatch<T extends Record<string, any>>(items: T[]): Promise<T[]> {
  const supported = await isCategorySupported()
  if (supported) return items
  return items.map(item => {
    if ('category' in item) {
      const { category, ...rest } = item
      return rest as T
    }
    return item
  })
}

/**
 * 通过 execute_sql RPC 更新单个资产的 category（绕过 PostgREST schema cache）。
 * 当 REST API 因 schema cache 看不到 category 列而更新失败时使用。
 * 如果 category 列不存在，会自动添加列后再更新。
 */
export async function updateAssetCategoryViaSQL(assetCode: string, category: string): Promise<boolean> {
  if (!assetCode) return false
  try {
    const escapedCat = String(category ?? '').replace(/'/g, "''")
    const escapedCode = String(assetCode).replace(/'/g, "''")
    const updateSql = `UPDATE assets SET category = '${escapedCat}' WHERE asset_code = '${escapedCode}';`
    const { data, error } = await supabase.rpc('execute_sql', { sql: updateSql })

    // 如果 RPC 本身报错（PostgreSQL 错误，如列不存在），检查是否是列缺失问题
    const missingCol = error && /column|does not exist|category/i.test(error.message || '')
    if (error && !missingCol) {
      console.warn('[Category] execute_sql RPC 调用失败:', error.message)
      return false
    }

    // 列不存在 或 execute_sql 返回了错误对象 → 尝试自动添加列后重试
    const needAddColumn = missingCol || !isExecuteSqlSuccess(data)
    if (needAddColumn) {
      const reason = error?.message || (data as any)?.error || '未知'
      console.warn('[Category] category 列不可用，尝试自动添加:', reason)
      const { error: alterErr } = await supabase.rpc('execute_sql', {
        sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';`
      })
      if (alterErr) {
        console.warn('[Category] ALTER TABLE 失败:', alterErr.message)
        // ALTER TABLE 本身也可能因为 execute_sql 函数不存在而失败
        // 这种情况只能返回 false
        return false
      }
      try { await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch { /* ignore */ }
      const { error: retryErr } = await supabase.rpc('execute_sql', { sql: updateSql })
      if (retryErr) { console.warn('[Category] 重试更新失败:', retryErr.message); return false }
      console.log('[Category] 已自动添加 category 列并更新成功')
    }
    // 刷新运行时检测缓存，让后续 REST API 也能识别 category
    resetCategoryCheck()
    return true
  } catch (e: any) {
    console.warn('[Category] execute_sql 异常:', e?.message)
    return false
  }
}

/**
 * 通过 execute_sql RPC 批量读取资产的 category（绕过 PostgREST schema cache）。
 * 当 REST API 的 .select('*') 因 schema cache 看不到 category 列而不返回该字段时使用。
 * 返回 Map<asset_code, category>。execute_sql 不存在或列不存在时返回空 Map。
 */
export async function fetchCategoriesViaSQL(assetCodes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!assetCodes || assetCodes.length === 0) return out
  try {
    const inList = assetCodes
      .filter(Boolean)
      .map(c => `'${c.replace(/'/g, "''")}'`)
      .join(',')
    if (!inList) return out
    const sql = `SELECT asset_code, category FROM assets WHERE asset_code IN (${inList});`
    const { data, error } = await supabase.rpc('execute_sql', { sql })

    // 如果列不存在，自动添加后再读
    const missingCol = error && /column|does not exist|category/i.test(error.message || '')
    if (error && missingCol) {
      console.warn('[Category] fetchCategoriesViaSQL 检测到列不存在，尝试自动添加')
      const { error: alterErr } = await supabase.rpc('execute_sql', {
        sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';`
      })
      if (!alterErr) {
        try { await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch { /* ignore */ }
        const { data: retryData, error: retryErr } = await supabase.rpc('execute_sql', { sql })
        if (!retryErr) {
          const rows: any[] = parseExecuteSqlResult(retryData)
          for (const r of rows) {
            if (r && r.asset_code) out.set(r.asset_code, r.category ?? '')
          }
          return out
        }
      }
      return out
    }

    if (error) {
      console.warn('[Category] fetchCategoriesViaSQL 失败（execute_sql RPC 可能不存在）:', error.message)
      return out
    }
    if (!isExecuteSqlSuccess(data)) {
      console.warn('[Category] fetchCategoriesViaSQL 返回错误:', (data as any)?.error)
      return out
    }
    const rows: any[] = parseExecuteSqlResult(data)
    for (const r of rows) {
      if (r && r.asset_code) {
        out.set(r.asset_code, r.category ?? '')
      }
    }
    return out
  } catch (e: any) {
    console.warn('[Category] fetchCategoriesViaSQL 异常:', e?.message)
    return out
  }
}

/**
 * 健壮的资产更新：完全规避 PostgREST schema cache 看不到 category 列的问题。
 *
 * 策略（双通道，完全不依赖错误信息关键字匹配）：
 *   A. 数据中不带 category → 直接走普通 REST API 更新
 *   B. 数据中带 category →
 *       1) 先剥离 category，用 REST API 更新其余所有字段（100% 不依赖 schema cache）
 *       2) 再用 execute_sql RPC 单独写 category（直接在 DB 层执行 UPDATE，绕过 PostgREST）
 *
 * 返回值：
 *   - error: 主流程错误（非 category 字段更新失败时返回）。null 表示其他字段已成功更新。
 *   - categoryError: category 单独写入失败的错误信息。非空时说明分类没保存，
 *     通常是因为 execute_sql RPC 函数未创建，需要在 Supabase Dashboard 执行 SQL 脚本。
 */
export async function updateAssetRobust(
  assetCode: string,
  data: Record<string, any>
): Promise<{ error: any | null; categoryError?: string | null }> {
  if (!assetCode) return { error: new Error('asset_code is required') }

  const payload = { ...data, updated_at: new Date().toISOString() }
  const hasCategory = 'category' in payload

  // ===== 路径 A：数据里没有 category → 直接走 REST API =====
  if (!hasCategory) {
    const { error } = await supabase
      .from('assets')
      .update(payload)
      .eq('asset_code', assetCode)
    return { error }
  }

  // ===== 路径 B：数据里有 category → 用分离更新模式 =====
  const { category: catVal, ...rest } = payload

  // B1：先用 REST API 更新除 category 外的所有字段
  const { error: restErr } = await supabase
    .from('assets')
    .update(rest)
    .eq('asset_code', assetCode)
  if (restErr) {
    console.error('[Category] 通道 B1（REST 更新非 category 字段）失败:', restErr.message)
    return { error: restErr }
  }

  // B2：用 execute_sql RPC 单独写 category（绕过 PostgREST schema cache）
  if (catVal !== undefined && catVal !== null) {
    const sqlOk = await updateAssetCategoryViaSQL(assetCode, String(catVal))
    if (!sqlOk) {
      // B2 失败 → 尝试兜底 REST 写入（schema cache 可能已被其他操作刷新）
      let fallbackOk = false
      try {
        const { error: fallbackErr } = await supabase
          .from('assets')
          .update({ category: catVal, updated_at: payload.updated_at })
          .eq('asset_code', assetCode)
        if (!fallbackErr) {
          fallbackOk = true
        } else {
          console.warn('[Category] 兜底 REST 写入也失败:', fallbackErr.message)
        }
      } catch (e: any) {
        console.warn('[Category] 兜底 REST 异常:', e?.message)
      }
      if (!fallbackOk) {
        // B2 和兜底都失败 → category 未保存。返回明确的错误信息让前端提示用户。
        return {
          error: null, // 其他字段已成功更新，主流程不报错
          categoryError: '分类未保存：数据库缺少 execute_sql 函数或 category 列不可用。请在 Supabase Dashboard 的 SQL Editor 中执行 sql/create-execute-sql-rpc.sql 脚本。'
        }
      }
    }
  }

  return { error: null }
}

/**
 * 健壮的资产新增：和 updateAssetRobust 相同的双通道思路。
 *   A. 无 category → 直接 REST INSERT
 *   B. 有 category →
 *       1) 剥 category 先 REST INSERT（保证不会因 schema cache 看不到列而报错）
 *       2) 再用 execute_sql RPC 单独 UPDATE 写 category（绕过 PostgREST）
 *
 * 返回 { data: 插入的行[], error: null } 或 { data: null, error }
 */
export async function insertAssetRobust(
  data: Record<string, any>
): Promise<{ data: any[] | null; error: any | null }> {
  const hasCategory = 'category' in data && data.category !== '' && data.category != null

  // ===== 路径 A：没有 category 字段 → 直接 REST INSERT =====
  if (!hasCategory) {
    const { data: inserted, error } = await supabase
      .from('assets')
      .insert(data)
      .select()
    return { data: inserted, error }
  }

  // ===== 路径 B：有 category → 分离写入 =====
  const { category: catVal, ...rest } = data

  // B1：先 REST INSERT（不带 category）
  const { data: inserted, error: insertErr } = await supabase
    .from('assets')
    .insert(rest)
    .select()
  if (insertErr) {
    console.error('[Category] 通道 B1（REST INSERT 无 category）失败:', insertErr.message)
    return { data: null, error: insertErr }
  }

  // B2：用 execute_sql RPC 单独 UPDATE 写入 category
  if (inserted && inserted.length > 0 && inserted[0].asset_code) {
    const sqlOk = await updateAssetCategoryViaSQL(inserted[0].asset_code, String(catVal))
    if (!sqlOk) {
      console.warn('[Category] 通道 B2（execute_sql 写 category）失败，尝试 REST 兜底')
      // 兜底：单独 REST UPDATE category（此时列可能刚好可见了）
      try {
        const { error: fallbackErr } = await supabase
          .from('assets')
          .update({ category: catVal, updated_at: new Date().toISOString() })
          .eq('asset_code', inserted[0].asset_code)
        if (fallbackErr) {
          console.error('[Category] 兜底 REST UPDATE category 失败:', fallbackErr.message, '（资产已创建，但分类未写入）')
          // 不整体失败，因为资产已经插入成功了；分类只是没写进去
        }
      } catch (e: any) {
        console.error('[Category] 兜底 REST 异常:', e?.message)
      }
    }
  }

  return { data: inserted, error: null }
}

// 重置 category 支持检测（添加列后调用）
export function resetCategoryCheck(): void {
  _categorySupported = null
}

// ===== AI 估值列 schema 探测（避免 PostgREST schema cache 未刷新时报错） =====
let _aiColumnsSupported: boolean | null = null
// execute_sql RPC 是否可用（绕过 PostgREST schema cache 直接读写 ai_* 列）
let _aiViaSQL: boolean | null = null

export function isAIColumnsSupportedSync(): boolean {
  return _aiColumnsSupported === true
}

export async function isAIColumnsSupported(): Promise<boolean> {
  if (_aiColumnsSupported !== null) return _aiColumnsSupported
  try {
    const { error } = await supabase.from('assets_public').select('ai_current_value').limit(1)
    if (!error) {
      _aiColumnsSupported = true
      return true
    }
    // REST API 看不到列 → 尝试刷新 PostgREST schema cache
    // 注意：information_schema.columns 通过 anon key 可能也查不到，
    // 所以我们直接尝试 SELECT ai_current_value FROM assets LIMIT 1 来确认
    console.warn('[AI DB] ai_current_value 列在 PostgREST 中不可见，尝试 NOTIFY pgrst 刷新 schema cache')
    try {
      // 用 execute_sql RPC 刷新（如果存在），否则跳过
      const { data: sqlOk } = await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
      if (sqlOk && typeof sqlOk === 'object' && 'error' in sqlOk) {
        // execute_sql 返回了错误 → RPC 存在但执行失败，说明列确实不存在
        console.warn('[AI DB] NOTIFY 失败（列可能不存在）:', (sqlOk as any).error)
        _aiColumnsSupported = false
        return false
      }
      console.log('[AI DB] NOTIFY pgrst sent, 等待 2s 后重试...')
      await new Promise(r => setTimeout(r, 2000))
      const { error: retryErr } = await supabase.from('assets_public').select('ai_current_value').limit(1)
      _aiColumnsSupported = !retryErr
      if (retryErr) {
        console.warn('[AI DB] NOTIFY 后 REST API 仍看不到列，将使用 execute_sql 通道兜底')
      } else {
        console.log('[AI DB] schema cache 刷新成功，REST API 可正常访问 ai_* 列')
      }
      return _aiColumnsSupported
    } catch (notifyErr: any) {
      // execute_sql RPC 不存在 → 无法刷新 schema cache
      console.warn("[AI DB] execute_sql RPC 不存在，无法自动刷新 schema cache。请手动在 Supabase Dashboard 执行 NOTIFY pgrst, 'reload schema'")
      _aiColumnsSupported = false
      return false
    }
  } catch (e: any) {
    console.warn('AI columns check threw:', e?.message)
    _aiColumnsSupported = false
    return false
  }
}

export function resetAIColumnsCheck(): void {
  _aiColumnsSupported = null
  _aiViaSQL = null
}

/**
 * execute_sql RPC 返回值统一解析器。
 * Supabase 的 execute_sql 函数返回格式因实现而异：
 *  - 数组：[{col1: v1, col2: v2}, ...]
 *  - 字符串：'[{"col1":v1}]' 或 '{"col1":v1}'（需要 JSON.parse）
 *  - 对象：{rows: [...]} 或 {data: ...} 或直接就是行对象
 *  - null/undefined：无返回行（DDL/UPDATE/NOTIFY 语句执行成功）
 *  - {error: "xxx"}：execute_sql 异常捕获的错误
 */
function parseExecuteSqlResult(data: any): any[] {
  if (data == null) return []
  if (typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    // execute_sql 异常捕获的错误对象 → 不是行数据
    return []
  }
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') return [parsed]
    } catch { return [] }
    return []
  }
  if (typeof data === 'object') {
    if (Array.isArray(data.rows)) return data.rows
    if (Array.isArray(data.data)) return data.data
    return [data]
  }
  return []
}

/**
 * 判断 execute_sql RPC 的返回值是否表示"执行成功"。
 * 返回 json 类型的函数，成功时可能返回 null（DDL/UPDATE/NOTIFY）或行数组（SELECT）
 * 只有 {error: "..."} 对象才表示失败。
 */
function isExecuteSqlSuccess(data: any): boolean {
  if (data == null) return true  // DDL/UPDATE/NOTIFY 成功
  if (typeof data === 'object' && !Array.isArray(data) && 'error' in data) return false
  return true  // 行数据数组或其他格式
}

/**
 * execute_sql RPC 通道是否可用（不需要 PostgREST schema cache 刷新，
 * 直接在 DB 层执行 SELECT/UPDATE，最可靠的 ai_* 列读写方式）。
 * 探测：先试 information_schema 再试 LIMIT 1。
 */
export async function isAIWriteViaSQLSupported(): Promise<boolean> {
  if (_aiViaSQL !== null) return _aiViaSQL
  try {
    // 先探测 execute_sql RPC 是否存在（用 pg_catalog，不需要 information_schema 权限）
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='assets' LIMIT 1;`
    })
    if (error) {
      console.warn('[AI DB] execute_sql RPC 不可用:', error.message)
      _aiViaSQL = false
      return false
    }
    const arr = parseExecuteSqlResult(data)
    if (arr.length >= 1) {
      // 确认列是否存在
      const { data: colData, error: colErr } = await supabase.rpc('execute_sql', {
        sql: `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='assets' AND a.attname IN ('ai_fixed_value','ai_current_value') AND a.attnum > 0 AND NOT a.attisdropped;`
      })
      if (!colErr) {
        const cols = parseExecuteSqlResult(colData)
        if (cols.length >= 1) {
          _aiViaSQL = true
          return true
        }
      }
      // 列不存在但 RPC 可用 → 尝试添加（自动迁移）
      try {
        const { error: addErr } = await supabase.rpc('execute_sql', {
          sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='assets' AND a.attname='ai_fixed_value' AND a.attnum > 0) THEN
              ALTER TABLE assets ADD COLUMN ai_fixed_value INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='assets' AND a.attname='ai_current_value' AND a.attnum > 0) THEN
              ALTER TABLE assets ADD COLUMN ai_current_value INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='assets' AND a.attname='ai_reason' AND a.attnum > 0) THEN
              ALTER TABLE assets ADD COLUMN ai_reason VARCHAR(200);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='assets' AND a.attname='ai_valuated_at' AND a.attnum > 0) THEN
              ALTER TABLE assets ADD COLUMN ai_valuated_at TIMESTAMPTZ;
            END IF;
          END $$;`
        })
        if (!addErr) {
          // 加列成功后刷新 schema cache
          await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
          console.log('[AI DB] execute_sql 通道自动添加了 4 列并刷新 schema cache')
        }
        _aiViaSQL = !addErr
        return _aiViaSQL!
      } catch (_) {
        _aiViaSQL = false
        return false
      }
    }
    _aiViaSQL = false
    return false
  } catch (e: any) {
    console.warn('[AI DB] execute_sql RPC 探测失败:', e?.message)
    _aiViaSQL = false
    return false
  }
}

/**
 * 通过 execute_sql RPC 单条写入 AI 估值（绕过 PostgREST schema cache）。
 */
async function persistAIValuationViaSQL(
  asset_code: string,
  value: { fixedValue: number; currentValue: number; reason?: string }
): Promise<boolean> {
  if (!asset_code) return false
  const reasonEscaped = (value.reason || '').replace(/'/g, "''").slice(0, 200)
  const sql = `UPDATE assets SET
    ai_fixed_value = ${Math.round(value.fixedValue)},
    ai_current_value = ${Math.round(value.currentValue)},
    ai_reason = '${reasonEscaped}',
    ai_valuated_at = NOW()
  WHERE asset_code = '${asset_code.replace(/'/g, "''")}';`
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql })
    if (error) return false
    return isExecuteSqlSuccess(data)
  } catch (e: any) {
    console.warn('[AI DB] SQL 写入失败:', e?.message)
    return false
  }
}

/**
 * 通过 execute_sql RPC 批量写 AI 估值（一条 CASE WHEN UPDATE，性能远好于逐条）。
 */
async function batchPersistAIValuationViaSQL(
  items: Array<{ asset_code: string; fixedValue: number; currentValue: number; reason?: string }>
): Promise<number> {
  if (!items || items.length === 0) return 0
  const codes: string[] = []
  const fixedCases: string[] = []
  const currentCases: string[] = []
  const reasonCases: string[] = []
  for (const it of items) {
    if (!it.asset_code) continue
    const c = it.asset_code.replace(/'/g, "''")
    codes.push(`'${c}'`)
    fixedCases.push(`WHEN '${c}' THEN ${Math.round(it.fixedValue)}`)
    currentCases.push(`WHEN '${c}' THEN ${Math.round(it.currentValue)}`)
    const r = (it.reason || '').replace(/'/g, "''").slice(0, 200)
    reasonCases.push(`WHEN '${c}' THEN '${r}'::varchar(200)`)
  }
  if (codes.length === 0) return 0
  const sql = `UPDATE assets SET
    ai_fixed_value = CASE asset_code ${fixedCases.join(' ')} ELSE ai_fixed_value END,
    ai_current_value = CASE asset_code ${currentCases.join(' ')} ELSE ai_current_value END,
    ai_reason = CASE asset_code ${reasonCases.join(' ')} ELSE ai_reason END,
    ai_valuated_at = NOW()
  WHERE asset_code IN (${codes.join(',')});`
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql })
    if (error) {
      console.warn('[AI DB] 批量 SQL 写入失败:', error.message)
      return 0
    }
    if (!isExecuteSqlSuccess(data)) {
      console.warn('[AI DB] 批量 SQL 写入返回错误:', (data as any)?.error)
      return 0
    }
    return codes.length
  } catch (e: any) {
    console.warn('[AI DB] 批量 SQL 写入异常:', e?.message)
    return 0
  }
}

/**
 * 通过 execute_sql RPC 一次性读取一批资产的 AI 估值结果（绕过 PostgREST schema cache）。
 * 返回 Map<asset_code, AIValResult>。
 */
export async function fetchAIMapFromDBViaSQL(asset_codes: string[]): Promise<Map<string, AIValResult>> {
  const out = new Map<string, AIValResult>()
  if (!asset_codes || asset_codes.length === 0) return out
  try {
    const supported = await isAIWriteViaSQLSupported()
    if (!supported) return out
    const inList = asset_codes
      .filter(Boolean)
      .map(c => `'${c.replace(/'/g, "''")}'`)
      .join(',')
    if (!inList) return out
    const sql = `SELECT asset_code, ai_fixed_value, ai_current_value, ai_reason, ai_valuated_at
FROM assets
WHERE asset_code IN (${inList})
  AND ai_current_value IS NOT NULL
  AND ai_current_value > 0;`
    const { data, error } = await supabase.rpc('execute_sql', { sql })
    if (error) return out
    if (!isExecuteSqlSuccess(data)) {
      console.warn('[AI DB] fetchAIMapFromDBViaSQL 返回错误:', (data as any)?.error)
      return out
    }
    const rows: any[] = parseExecuteSqlResult(data)
    for (const r of rows) {
      if (!r || !r.asset_code) continue
      const current = Number(r.ai_current_value)
      if (!current || current <= 0) continue
      const fixed = Number(r.ai_fixed_value) || current
      out.set(r.asset_code, {
        fixedValue: Math.round(fixed),
        currentValue: Math.round(current),
        source: 'ai',
        reason: r.ai_reason ?? undefined,
        valuatedAt: r.ai_valuated_at ?? undefined
      })
    }
    return out
  } catch (e: any) {
    console.warn('[AI DB] SQL 读取 AI 估值失败:', e?.message)
    return out
  }
}

/**
 * 查询单台资产的 AI 估值（优先 REST，失败走 execute_sql RPC）。
 * 用于 estimateAssetValueWithAI 的 DB 缓存检查，避免重复调用 AI 浪费 token。
 */
async function fetchSingleAIValuationFromDB(assetCode: string): Promise<{
  fixedValue?: number
  currentValue?: number
  reason?: string
} | null> {
  if (!assetCode) return null
  try {
    // 优先 REST（schema cache 可见时）
    const { data, error } = await supabase
      .from('assets_public')
      .select('ai_fixed_value, ai_current_value, ai_reason, ai_valuated_at')
      .eq('asset_code', assetCode)
      .maybeSingle()
    if (!error && data) {
      const current = Number(data.ai_current_value)
      if (current && current > 0) {
        return {
          fixedValue: Number(data.ai_fixed_value) || current,
          currentValue: current,
          reason: data.ai_reason ?? undefined
        }
      }
    }
    // REST 失败（schema cache 看不到 ai_* 列）→ 走 execute_sql RPC
    const m = await fetchAIMapFromDBViaSQL([assetCode])
    const v = m.get(assetCode)
    if (v && v.currentValue && v.currentValue > 0) {
      return { fixedValue: v.fixedValue, currentValue: v.currentValue, reason: v.reason }
    }
    return null
  } catch (e: any) {
    console.warn('[AI DB] fetchSingleAIValuationFromDB 异常:', e?.message)
    return null
  }
}

/**
 * 把 AI 估值结果写入 assets 表对应的 ai_* 列（持久化到数据库）。
 * 刷新/换浏览器/清 localStorage 都不会丢。
 * 双通道：优先 REST API（PostgREST schema cache 刷新后）；
 *         不可用时自动走 execute_sql RPC（不依赖 schema cache）。
 */
export async function persistAIValuationToDB(
  asset_code: string,
  value: { fixedValue: number; currentValue: number; reason?: string; source?: 'ai' | 'local' }
): Promise<boolean> {
  if (!asset_code) return false
  if (value.source === 'local') return false // 用户说不要本地估值，只持久化 AI 真结果
  try {
    // 通道 1：REST API（schema cache 已包含列时最快）
    const supported = await isAIColumnsSupported()
    if (supported) {
      const payload: any = {
        ai_fixed_value: Math.round(value.fixedValue),
        ai_current_value: Math.round(value.currentValue),
        ai_valuated_at: new Date().toISOString()
      }
      if (value.reason) payload.ai_reason = value.reason.slice(0, 200)
      const { error } = await supabase
        .from('assets')
        .update(payload)
        .eq('asset_code', asset_code)
      if (!error) return true
      console.warn(`[AI DB] REST 写入失败(${asset_code})，切换 SQL 通道:`, error.message)
    }
    // 通道 2：execute_sql RPC（绕过 PostgREST schema cache，最可靠）
    const viaSQL = await isAIWriteViaSQLSupported()
    if (viaSQL) {
      return persistAIValuationViaSQL(asset_code, {
        fixedValue: value.fixedValue,
        currentValue: value.currentValue,
        reason: value.reason
      })
    }
    return false
  } catch (e: any) {
    console.warn('persistAIValuationToDB exception:', e?.message)
    return false
  }
}

/**
 * 批量写 AI 估值结果回 DB（双通道，REST API 不行就走 execute_sql SQL）。
 */
export async function batchPersistAIValuationToDB(
  items: Array<{ asset_code: string; fixedValue: number; currentValue: number; reason?: string; source?: 'ai' | 'local' }>
): Promise<number> {
  if (!items || items.length === 0) return 0
  const filtered = items.filter(it => it.asset_code && it.source !== 'local' && typeof it.currentValue === 'number' && it.currentValue > 0)
  if (filtered.length === 0) return 0

  // 通道 1：REST API
  let okCount = 0
  const supported = await isAIColumnsSupported()
  if (supported) {
    for (const it of filtered) {
      try {
        const payload: any = {
          ai_fixed_value: Math.round(it.fixedValue),
          ai_current_value: Math.round(it.currentValue),
          ai_valuated_at: new Date().toISOString()
        }
        if (it.reason) payload.ai_reason = it.reason.slice(0, 200)
        const { error } = await supabase.from('assets').update(payload).eq('asset_code', it.asset_code)
        if (!error) okCount++
      } catch {
        // skip
      }
    }
    if (okCount === filtered.length) return okCount
  }
  // 通道 2：SQL 通道兜底（批量 CASE WHEN 一条语句，高性能）
  try {
    const viaSQL = await isAIWriteViaSQLSupported()
    if (viaSQL) {
      const rest = (okCount > 0) ? filtered : filtered
      const sqlCount = await batchPersistAIValuationViaSQL(rest)
      return Math.max(okCount, sqlCount)
    }
  } catch { /* ignore */ }
  return okCount
}

async function ensureColumn(table: string, column: string, definition: string): Promise<boolean> {
  // 用 pg_catalog 检查列是否存在（anon key 可读 pg_catalog，information_schema 不行）
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='${table}' AND a.attname='${column}' AND a.attnum > 0 AND NOT a.attisdropped LIMIT 1;`
    })
    if (!error && parseExecuteSqlResult(data).length > 0) return true
  } catch {
    // execute_sql RPC 不存在，用 information_schema 兜底
    try {
      const { data: cols } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .eq('column_name', column)
      if (cols && cols.length > 0) return true
    } catch {
      // information_schema 也不可用
    }
  }

  // 尝试通过 execute_sql RPC 添加列
  try {
    const { error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${definition};`
    })
    if (error) {
      console.warn(`Could not add column ${column} to ${table}:`, error.message)
      return false
    }
    try {
      await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
    } catch (_) { /* ignore */ }
    console.log(`Added column ${column} to ${table}`)
    return true
  } catch (e: any) {
    console.warn(`Could not add column ${column} to ${table}:`, e?.message)
    return false
  }
}

async function ensureTable(table: string, createSql: string): Promise<boolean> {
  // 用 pg_catalog 检查表是否存在
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${table}' LIMIT 1;`
    })
    if (!error && parseExecuteSqlResult(data).length > 0) return true
  } catch {
    try {
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
      if (tables && tables.length > 0) return true
    } catch {
      // information_schema 也不可用
    }
  }

  try {
    const { error } = await supabase.rpc('execute_sql', { sql: createSql })
    if (error) {
      console.warn(`Could not create table ${table}:`, error.message)
      return false
    }
    try {
      await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
    } catch (_) { /* ignore */ }
    console.log(`Created table ${table}`)
    return true
  } catch (e: any) {
    console.warn(`Could not create table ${table}:`, e?.message)
    return false
  }
}

export const initDatabase = async () => {
  const savedVersion = parseInt(localStorage.getItem(DB_VERSION_KEY) || '0', 10)
  if (savedVersion >= CURRENT_DB_VERSION) {
    console.log('Database schema is up to date (version:', CURRENT_DB_VERSION, ')')
    return
  }

  console.log('Starting database initialization (version:', savedVersion, '→', CURRENT_DB_VERSION, ')')

  const tableDefs: Record<string, string> = {
    operation_history: `
      CREATE TABLE operation_history (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        asset_code VARCHAR(50) NOT NULL,
        operation_type VARCHAR(20) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        changes text,
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON operation_history FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON operation_history FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update access" ON operation_history FOR UPDATE USING (true);
      CREATE POLICY "Allow public delete access" ON operation_history FOR DELETE USING (true);
    `,
    maintenance_records: `
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id bigint primary key generated always as identity,
        asset_id bigint,
        issue_description text not null,
        repair_description text,
        repair_date date,
        repair_cost decimal(10, 2),
        status text not null default 'pending',
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
      ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON maintenance_records FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON maintenance_records FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update access" ON maintenance_records FOR UPDATE USING (true);
      CREATE POLICY "Allow public delete access" ON maintenance_records FOR DELETE USING (true);
    `,
    asset_images: `
      CREATE TABLE asset_images (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        asset_code VARCHAR(50) NOT NULL,
        image_url TEXT NOT NULL,
        image_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON asset_images FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON asset_images FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public delete access" ON asset_images FOR DELETE USING (true);
    `,
    usage_history: `
      CREATE TABLE IF NOT EXISTS usage_history (
        id bigint primary key generated always as identity,
        asset_code VARCHAR(50) NOT NULL,
        operation_type VARCHAR(20) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        changes text,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
      ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON usage_history FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON usage_history FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update access" ON usage_history FOR UPDATE USING (true);
      CREATE POLICY "Allow public delete access" ON usage_history FOR DELETE USING (true);
    `,
    rent_records: `
      CREATE TABLE IF NOT EXISTS rent_records (
        id bigint primary key generated always as identity,
        asset_code VARCHAR(50) NOT NULL,
        asset_id VARCHAR(50),
        department VARCHAR(100),
        user_name VARCHAR(255),
        monthly_rent decimal(10, 2) NOT NULL,
        year integer NOT NULL,
        month integer NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
        paid_date timestamp with time zone,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );
      CREATE INDEX IF NOT EXISTS idx_rent_records_asset_code ON rent_records(asset_code);
      CREATE INDEX IF NOT EXISTS idx_rent_records_year_month ON rent_records(year, month);
      CREATE INDEX IF NOT EXISTS idx_rent_records_department ON rent_records(department);
      CREATE INDEX IF NOT EXISTS idx_rent_records_status ON rent_records(status);
      ALTER TABLE rent_records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON rent_records FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON rent_records FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update access" ON rent_records FOR UPDATE USING (true);
      CREATE POLICY "Allow public delete access" ON rent_records FOR DELETE USING (true);
    `,
    asset_snapshots: `
      CREATE TABLE IF NOT EXISTS asset_snapshots (
        id bigint primary key generated always as identity,
        asset_code VARCHAR(50) NOT NULL,
        operation_type VARCHAR(20) NOT NULL,
        operator_email VARCHAR(255),
        snapshot JSONB NOT NULL,
        created_at timestamp with time zone default now()
      );
      CREATE INDEX IF NOT EXISTS idx_asset_snapshots_asset_code ON asset_snapshots(asset_code);
      CREATE INDEX IF NOT EXISTS idx_asset_snapshots_created_at ON asset_snapshots(created_at);
      ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read access" ON asset_snapshots FOR SELECT USING (true);
      CREATE POLICY "Allow public insert access" ON asset_snapshots FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public delete access" ON asset_snapshots FOR DELETE USING (true);
    `
  }

  // 创建所有表
  for (const [table, sql] of Object.entries(tableDefs)) {
    await ensureTable(table, sql)
  }

  // 迁移：给 assets 表添加 category 列（version 2 & 3 & 4）
  // 每次启动都尝试确保列存在
  await ensureColumn('assets', 'category', 'category VARCHAR(50) DEFAULT \'\'')
  // 重置运行时检测，确保后续请求重新检查
  resetCategoryCheck()

  // 迁移 version 6：给 assets 表加 4 个 AI 估值持久化列
  await ensureColumn('assets', 'ai_fixed_value', 'ai_fixed_value INTEGER')
  await ensureColumn('assets', 'ai_current_value', 'ai_current_value INTEGER')
  await ensureColumn('assets', 'ai_reason', 'ai_reason VARCHAR(200)')
  await ensureColumn('assets', 'ai_valuated_at', 'ai_valuated_at TIMESTAMPTZ')
  resetAIColumnsCheck()

  localStorage.setItem(DB_VERSION_KEY, String(CURRENT_DB_VERSION))
  console.log('Database initialization completed (version:', CURRENT_DB_VERSION, ')')

  // 启动后异步补填历史变更明细
  void backfillHistoryChanges()
}

// ===== 历史数据补填 =====
const BACKFILL_KEY = 'db_backfill_history_changes_done'

async function backfillHistoryChanges(): Promise<void> {
  if (localStorage.getItem(BACKFILL_KEY)) return
  try {
    // 补填 operation_history 中缺少变更明细的更新记录
    const { data: opData, error: opError } = await supabase
      .from('operation_history')
      .update({ changes: '变更明细（历史版本已升级，后续编辑将自动记录）' })
      .is('changes', null)
      .eq('operation_type', 'update')
    if (opError) {
      console.warn('Backfill operation_history failed:', opError.message)
    } else {
      console.log('Backfill operation_history completed')
    }

    // 补填 usage_history 中缺少变更明细的更新记录
    const { data: usageData, error: usageError } = await supabase
      .from('usage_history')
      .update({ changes: '变更明细（历史版本已升级，后续编辑将自动记录）' })
      .is('changes', null)
      .eq('operation_type', 'update')
    if (usageError) {
      console.warn('Backfill usage_history failed:', usageError.message)
    } else {
      console.log('Backfill usage_history completed')
    }

    localStorage.setItem(BACKFILL_KEY, 'true')
  } catch (e: any) {
    console.warn('Backfill history changes failed:', e?.message)
  }
}

// ===== AI 大模型估值 =====
// 配置数据结构
export interface AIValuationConfig {
  apiKey: string
  baseUrl: string       // 兼容 OpenAI 格式的 API Base URL，如 https://api.openai.com/v1
  model: string         // 模型名，如 gpt-4o-mini / deepseek-chat / qwen-plus 等
  enabled: boolean      // 是否启用AI估值（关闭则走本地保底算法）
  cacheTTL: number      // 缓存有效期（毫秒），默认 24h
  forceDisabled?: boolean  // ★ 全局紧急切断：为 true 时所有 AI 调用直接拒绝，防止意外消耗
  dailyLimit?: number      // ★ 每日调用上限（次），默认 50；0 = 不限
}

// AI 调用日志条目（用于审计谁/何时调用了 AI）
interface AICallLog {
  timestamp: number
  assetCodes: string[]
  count: number
  source: string
}

const AI_CALL_LOG_KEY = 'ai_valuation_call_log_v1'
const AI_DAILY_COUNT_KEY = 'ai_valuation_daily_count_v1'

const AI_CONFIG_KEY = 'ai_valuation_config_v1'
const AI_CACHE_KEY = 'ai_valuation_cache_v1'

// 默认配置：已内置小米 MiMo 端点与模型，只需粘贴 API Key 即可启用
const DEFAULT_AI_CONFIG: AIValuationConfig = {
  apiKey: '',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  model: 'mimo-v2.5-pro',
  enabled: false,
  // 用户要求「估值一次后，刷新页面还能一直保存」：
  // 缓存 TTL 改为 90 天（基本等同「永久」，过期前若已写 DB 就不依赖缓存）
  cacheTTL: 90 * 24 * 60 * 60 * 1000,
  forceDisabled: false,
  dailyLimit: 50  // 默认每日最多 50 次 AI 调用，防止意外消耗
}

// 读取AI配置（从 localStorage，因为纯前端不存数据库）
export function getAIValuationConfig(): AIValuationConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (!raw) return DEFAULT_AI_CONFIG
    const parsed = JSON.parse(raw)
    const merged = { ...DEFAULT_AI_CONFIG, ...parsed }
    // ★ 用户要求「估值一次后，刷新页面还能一直保存」
    // 旧版保存的 config 里 cacheTTL=86400000(24h)，合并后会覆盖新的 90 天默认值
    // 这里强制取 Math.max，确保 TTL 至少为 90 天
    merged.cacheTTL = Math.max(merged.cacheTTL || 0, DEFAULT_AI_CONFIG.cacheTTL)
    return merged
  } catch {
    return DEFAULT_AI_CONFIG
  }
}

// 保存AI配置
export function saveAIValuationConfig(cfg: Partial<AIValuationConfig>): AIValuationConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG
  const current = getAIValuationConfig()
  const next = { ...current, ...cfg }
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next))
  return next
}

// ===== AI 安全护栏 =====

// 获取今日已调用次数（按本地日期重置）
function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function getAIDailyUsage(): { date: string; count: number; limit: number } {
  if (typeof window === 'undefined') return { date: getTodayKey(), count: 0, limit: 0 }
  try {
    const raw = localStorage.getItem(AI_DAILY_COUNT_KEY)
    const cfg = getAIValuationConfig()
    const limit = cfg.dailyLimit ?? 0
    if (!raw) return { date: getTodayKey(), count: 0, limit }
    const parsed = JSON.parse(raw) as { date: string; count: number }
    if (parsed.date !== getTodayKey()) {
      return { date: getTodayKey(), count: 0, limit }
    }
    return { date: parsed.date, count: parsed.count, limit }
  } catch {
    return { date: getTodayKey(), count: 0, limit: 0 }
  }
}

// 增加一次调用计数；返回 false 表示已达上限
function incrementAIDailyCount(count: number): boolean {
  if (typeof window === 'undefined') return true
  const cfg = getAIValuationConfig()
  const limit = cfg.dailyLimit ?? 0
  if (limit === 0) return true // 不限
  const usage = getAIDailyUsage()
  const newCount = usage.count + count
  if (newCount > limit) return false
  localStorage.setItem(AI_DAILY_COUNT_KEY, JSON.stringify({
    date: getTodayKey(),
    count: newCount
  }))
  return true
}

// 记录 AI 调用日志
function logAICall(assetCodes: string[], source: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(AI_CALL_LOG_KEY)
    const logs: AICallLog[] = raw ? JSON.parse(raw) : []
    logs.unshift({
      timestamp: Date.now(),
      assetCodes,
      count: assetCodes.length,
      source
    })
    // 最多保留 200 条
    const trimmed = logs.slice(0, 200)
    localStorage.setItem(AI_CALL_LOG_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

// 获取 AI 调用日志（供 UI 展示）
export function getAICallLogs(): AICallLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AI_CALL_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// 清空 AI 调用日志
export function clearAICallLogs(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AI_CALL_LOG_KEY)
}

// 检查 AI 是否被全局禁用
export function isAIForceDisabled(): boolean {
  const cfg = getAIValuationConfig()
  return !!cfg.forceDisabled
}

// 缓存条目类型
interface AICacheEntry {
  key: string
  fixedValue: number
  currentValue: number
  reason?: string
  createdAt: number
}

// 读取全部缓存
function readAICache(): Map<string, AICacheEntry> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY)
    if (!raw) return new Map()
    const arr: AICacheEntry[] = JSON.parse(raw)
    return new Map(arr.map(e => [e.key, e]))
  } catch {
    return new Map()
  }
}

// 写入缓存（清理过期 + 最多保留 500 条）
function writeAICache(map: Map<string, AICacheEntry>, ttl: number) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const entries: AICacheEntry[] = []
  for (const e of map.values()) {
    if (now - e.createdAt <= ttl) entries.push(e)
  }
  entries.sort((a, b) => b.createdAt - a.createdAt)
  const trimmed = entries.slice(0, 500)
  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(trimmed))
}

// 生成缓存 key：
// ★ 用户要求「估值一次后，刷新页面还能一直保存」
// 旧 key 用 brand|spec|age 拼接，age 随时间变化 → 刷新后 key 不匹配 → 缓存丢失
// 现在改用 asset_code 做唯一 key（稳定不变），同时兼容旧 key 格式读取
function makeCacheKey(asset: { asset_code?: string; cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string }): string {
  // 优先用 asset_code（唯一、稳定、不随时间变）
  if (asset.asset_code) return `code:${asset.asset_code}`
  // 兜底：无 asset_code 时用硬件规格（极少数场景）
  const spec = formatHardwareSpec(asset)
  const brand = (asset.brand || '').toUpperCase().slice(0, 20)
  return `${brand}|${spec}`
}

// 旧版缓存 key（基于硬件+age），仅用于读取兼容
function makeLegacyCacheKey(asset: { cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string }): string {
  let ageYears = 1
  if (asset.created_at) {
    const age = (Date.now() - new Date(asset.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ageYears = Math.max(0.5, Math.round(age * 2) / 2)
  }
  const spec = formatHardwareSpec(asset)
  const brand = (asset.brand || '').toUpperCase().slice(0, 20)
  return `${brand}|${spec}|age${ageYears}`
}

// 内部：直接调用兼容 OpenAI Chat Completions 的接口（兼容小米 MiMo mimo-v2.5-pro）
async function callAI(messages: { role: string; content: string }[], config: AIValuationConfig): Promise<string> {
  if (!config.apiKey) throw new Error('未配置 API Key')
  // 确保 base_url 只到版本段，不包含资源路径，避免 SDK 拼接重复
  const normalizedBase = config.baseUrl.replace(/\/+$/, '')
  const url = `${normalizedBase}/chat/completions`

  // 小米 MiMo（mimo-v2.5-pro）兼容性处理：
  // 1. 不显式开启 thinking 相关字段（否则服务要求回传 reasoning_content 导致 400）
  // 2. response_format 对非所有模型通用，默认不传；改为让模型按 JSON 文本返回，由 safeParse 兜底解析
  const isMiMo = /mimo/i.test(config.model) || /xiaomimimo\.com/i.test(normalizedBase)

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0.2,
    stream: false,
    messages
  }
  if (!isMiMo) {
    body.response_format = { type: 'json_object' }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI 接口错误 ${resp.status}: ${text.slice(0, 200) || resp.statusText}`)
  }
  const data = await resp.json()
  const choice = data?.choices?.[0]
  const content = choice?.message?.content
  // 忽略 reasoning_content 字段（MiMo 有时会返回，无需回传）
  if (typeof content !== 'string') throw new Error('AI 返回内容格式异常')
  return content
}

// 构建估值 Prompt
function buildValuationPrompt(
  asset: { cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; model?: string; created_at?: string }
): string {
  const today = new Date().toISOString().slice(0, 10)
  let ageDesc = '使用时长未知，按1年估算'
  if (asset.created_at) {
    const ageYears = (Date.now() - new Date(asset.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ageDesc = `入库时间 ${asset.created_at.slice(0, 10)}，至今约 ${ageYears.toFixed(1)} 年`
  }
  return `
你是专业的二手电脑硬件估值师，参考中国大陆当日（${today}）二手行情（闲鱼、转转、拍拍等主流平台），对以下电脑硬件进行准确估值。

【设备信息】
- 品牌/型号：${asset.brand || ''} ${asset.model || ''}
- CPU：${asset.cpu || '未知'}
- 内存：${asset.ram || '未知'}
- 存储：${asset.storage || '未知'}
- 显卡：${asset.gpu || '未知'}
- ${ageDesc}

【估值要求】
1. 给出两个人民币估值：
   - fixedValue：购入时全新市场价估算（元，整数）
   - currentValue：当前二手合理成交价（元，整数，按成色、折旧、当前硬件行情综合评估）
2. 若某配件信息缺失，按该档位常见主流配置保守估算；不确定时宁低勿高。
3. 折旧参考：一般办公电脑约每年降 15%~25%；游戏卡/高端U随代际波动更大。
4. 请严格返回 JSON 格式，不要附加任何多余字符或说明，结构如下：
{
  "fixedValue": 4500,
  "currentValue": 2200,
  "reason": "一句话简要说明估值依据（20字内）"
}
`.trim()
}

// 安全解析 JSON（兜底：从任意文本中提取 JSON 块 + 数字）
function safeParseAIValuation(text: string): { fixedValue: number; currentValue: number; reason?: string } | null {
  // 1. 优先尝试直接 JSON.parse
  try {
    const obj = JSON.parse(text)
    const fv = Number(obj.fixedValue)
    const cv = Number(obj.currentValue)
    if (!isNaN(fv) && !isNaN(cv) && fv > 0 && cv > 0) {
      return { fixedValue: Math.round(fv), currentValue: Math.round(cv), reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 50) : undefined }
    }
  } catch { /* ignore */ }

  // 2. 尝试提取第一个 {} JSON 块
  const match = text.match(/\{[\s\S]*?\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      const fv = Number(obj.fixedValue)
      const cv = Number(obj.currentValue)
      if (!isNaN(fv) && !isNaN(cv) && fv > 0 && cv > 0) {
        return { fixedValue: Math.round(fv), currentValue: Math.round(cv), reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 50) : undefined }
      }
    } catch { /* ignore */ }
  }

  // 3. 终极兜底：从文本里提取前两个数字
  const nums = text.match(/\d+/g)?.map(Number).filter(n => n >= 100) || []
  if (nums.length >= 2) {
    return { fixedValue: nums[0], currentValue: nums[1] }
  }
  return null
}

/**
 * 使用 AI 大模型进行硬件估值（支持缓存 + 本地保底）。
 * - 若配置未启用 / API 调用失败 / 解析失败，自动回退到本地 estimateAssetValue 算法。
 * - 返回值增加字段 source（'ai' | 'local'）和 reason（AI 估值依据）。
 */
/**
 * 对单台硬件做 AI 估值（用户明确：不要本地估值兜底，仅 AI 成功时返回数字，否则返回 error）。
 * 为了持久化：如果传了 asset_code，AI 出值后会同时写入 assets.ai_* 列和 localStorage 缓存。
 * - DB 是第一级持久化（刷新/换浏览器/清缓存都不会丢）
 * - localStorage 是第二级缓存（减少重复调用 AI）
 */
export async function estimateAssetValueWithAI(asset: {
  asset_code?: string;
  cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; model?: string; created_at?: string
}): Promise<{
  fixedValue?: number
  currentValue?: number
  source: 'ai' | 'none'
  reason?: string
  error?: string
}> {
  const config = getAIValuationConfig()

  // ① ★ 全局紧急切断（防止意外消耗 token）
  if (config.forceDisabled) {
    return { source: 'none' as const, error: 'AI 调用已被全局禁用，请在 AI 估值设置页重新启用。' }
  }

  // ② 用户明确：不要本地估值；未启用 / 未配 Key → 直接返回 none
  if (!config.enabled || !config.apiKey) {
    return { source: 'none' as const, error: 'AI估值未启用或未填写 API Key，请先到 AI估值设置页配置。' }
  }

  // ③ 每日调用上限检查
  if (config.dailyLimit && config.dailyLimit > 0) {
    const usage = getAIDailyUsage()
    if (usage.count >= config.dailyLimit) {
      return { source: 'none' as const, error: `今日 AI 调用已达上限（${usage.count}/${config.dailyLimit}次），请明天再试或在 AI 估值设置页调整上限。` }
    }
  }

  // ② 先查 localStorage 缓存（避免重复调用 AI）
  const cacheKey = makeCacheKey(asset)
  const cache = readAICache()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt <= config.cacheTTL) {
    return {
      fixedValue: cached.fixedValue,
      currentValue: cached.currentValue,
      source: 'ai' as const,
      reason: cached.reason
    }
  }

  // ②-bis 查 DB 缓存（ai_* 列）—— 即使 localStorage 被清/换浏览器，DB 有数据就不调 AI
  if (asset.asset_code) {
    try {
      const dbVal = await fetchSingleAIValuationFromDB(asset.asset_code)
      if (dbVal && dbVal.currentValue && dbVal.currentValue > 0) {
        // 回填 localStorage 缓存，下次直接命中
        const entry: AICacheEntry = {
          key: cacheKey,
          fixedValue: dbVal.fixedValue,
          currentValue: dbVal.currentValue,
          reason: dbVal.reason,
          createdAt: Date.now()
        }
        cache.set(cacheKey, entry)
        writeAICache(cache, config.cacheTTL)
        return {
          fixedValue: dbVal.fixedValue,
          currentValue: dbVal.currentValue,
          source: 'ai' as const,
          reason: dbVal.reason
        }
      }
    } catch { /* DB 查询失败则继续调 AI */ }
  }

  // 兼容旧版 key：旧 key 用 brand|spec|age 拼接，age 随时间变化可能不匹配。
  // 改为：用硬件规格前缀在缓存里模糊查找（同配置同品牌的设备估值应该一样）
  const spec = formatHardwareSpec(asset)
  const brand = (asset.brand || '').toUpperCase().slice(0, 20)
  const prefix = `${brand}|${spec}|age`
  for (const [k, v] of cache.entries()) {
    if (k.startsWith(prefix) && Date.now() - v.createdAt <= config.cacheTTL) {
      // 用新 key 重新写入，下次直接命中
      cache.set(cacheKey, { ...v, key: cacheKey })
      writeAICache(cache, config.cacheTTL)
      return {
        fixedValue: v.fixedValue,
        currentValue: v.currentValue,
        source: 'ai' as const,
        reason: v.reason
      }
    }
  }

  // ③ 调用 AI
  try {
    // ★ 先扣减每日额度（在实际调用前占位，避免并发超卖）
    if (config.dailyLimit && config.dailyLimit > 0) {
      if (!incrementAIDailyCount(1)) {
        return { source: 'none' as const, error: `今日 AI 调用已达上限（${config.dailyLimit}次/天），请明天再试或在 AI 估值设置页调整。` }
      }
    }

    const content = await callAI(
      [
        { role: 'system', content: '你是专业的二手硬件估值师，只输出 JSON。' },
        { role: 'user', content: buildValuationPrompt(asset) }
      ],
      config
    )
    const parsed = safeParseAIValuation(content)
    if (!parsed) {
      return { source: 'none' as const, error: 'AI 返回内容无法解析为估值数据' }
    }
    if (!parsed.fixedValue || !parsed.currentValue || parsed.currentValue <= 0 || parsed.fixedValue <= 0) {
      return { source: 'none' as const, error: 'AI 估值结果无效(数值非正)' }
    }

    // 合理性边界：AI 价格太离谱时直接报错，而不是用本地估值兜底
    const ratio = parsed.currentValue / parsed.fixedValue
    if (ratio > 1.5 || ratio < 0.05) {
      return { source: 'none' as const, error: `AI 估值折旧比例异常（${ratio.toFixed(2)}）` }
    }

    // 写 localStorage 缓存
    const entry: AICacheEntry = {
      key: cacheKey,
      fixedValue: parsed.fixedValue,
      currentValue: parsed.currentValue,
      reason: parsed.reason,
      createdAt: Date.now()
    }
    cache.set(cacheKey, entry)
    writeAICache(cache, config.cacheTTL)

    // 写 DB（持久化核心：刷新/换浏览器都不丢），静默不报错
    if (asset.asset_code) {
      void persistAIValuationToDB(asset.asset_code, {
        fixedValue: parsed.fixedValue,
        currentValue: parsed.currentValue,
        reason: parsed.reason,
        source: 'ai'
      })
    }

    // ★ 记录调用日志
    if (asset.asset_code) {
      logAICall([asset.asset_code], 'single')
    }

    return {
      fixedValue: parsed.fixedValue,
      currentValue: parsed.currentValue,
      source: 'ai' as const,
      reason: parsed.reason
    }
  } catch (e: any) {
    return { source: 'none' as const, error: e?.message || 'AI 调用失败' }
  }
}

/**
 * 批量 AI 估值（并发可控，避免触发 API 限流）。
 * 注意：入参 assets 最好含 asset_code，跑完后会批量写 DB（ai_* 列持久化）。
 */
export async function batchEstimateAssetValueWithAI(
  assets: Array<{ asset_code?: string; cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; model?: string; created_at?: string }>,
  concurrency: number = 5,
  onProgress?: (done: number, total: number) => void
): Promise<Array<{
  fixedValue?: number
  currentValue?: number
  source: 'ai' | 'none'
  reason?: string
  error?: string
}>> {
  // ★ 批量级别安全检查：先扣减整批额度，避免并发超额
  const config = getAIValuationConfig()
  if (config.forceDisabled) {
    return assets.map(() => ({ source: 'none' as const, error: 'AI 调用已被全局禁用' }))
  }
  if (!config.enabled || !config.apiKey) {
    return assets.map(() => ({ source: 'none' as const, error: 'AI估值未启用或未配置' }))
  }
  if (config.dailyLimit && config.dailyLimit > 0) {
    const usage = getAIDailyUsage()
    const remaining = config.dailyLimit - usage.count
    if (remaining <= 0) {
      return assets.map(() => ({ source: 'none' as const, error: `今日 AI 调用已达上限（${config.dailyLimit}次/天）` }))
    }
    if (remaining < assets.length) {
      // 额度不足，只处理剩余额度内的
      console.warn(`[AI 估值] 今日额度剩余 ${remaining}，请求 ${assets.length} 台，仅处理前 ${remaining} 台`)
    }
  }

  const results: any[] = new Array(assets.length)
  let cursor = 0
  let done = 0
  const batchAssetCodes: string[] = []

  async function worker() {
    while (cursor < assets.length) {
      const idx = cursor++
      // ★ 额度检查：逐台检查是否还有剩余
      if (config.dailyLimit && config.dailyLimit > 0) {
        const usage = getAIDailyUsage()
        if (usage.count >= config.dailyLimit) {
          results[idx] = { source: 'none' as const, error: `今日 AI 调用已达上限（${config.dailyLimit}次/天）` }
          done++
          onProgress?.(done, assets.length)
          continue
        }
      }
      results[idx] = await estimateAssetValueWithAI(assets[idx])
      if (results[idx].source === 'ai' && assets[idx].asset_code) {
        batchAssetCodes.push(assets[idx].asset_code)
      }
      done++
      onProgress?.(done, assets.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, assets.length) }, () => worker())
  await Promise.all(workers)

  // ★ 记录批量调用日志
  if (batchAssetCodes.length > 0) {
    logAICall(batchAssetCodes, 'batch')
  }

  // 统一批量写 DB（AI 出值的那些）
  let dbWriteCount = 0
  try {
    const dbItems = results
      .map((r, i) => ({ asset_code: assets[i].asset_code, ...r }))
      .filter(r => r.asset_code && r.source === 'ai' && typeof r.currentValue === 'number') as any[]
    if (dbItems.length > 0) {
      dbWriteCount = await batchPersistAIValuationToDB(dbItems)
      console.log(`[AI 估值诊断] AI成功=${dbItems.length}台, DB写入成功=${dbWriteCount}台, REST可用=${_aiColumnsSupported}, SQL可用=${_aiViaSQL}`)
    }
  } catch (err) {
    console.warn('批量持久化 AI 估值到 DB 失败:', err)
  }

  // 诊断：打印失败原因
  const failed = results.filter(r => r.source !== 'ai')
  if (failed.length > 0) {
    const errorReasons: Record<string, number> = {}
    failed.forEach(r => {
      const reason = r.error || '未知原因'
      errorReasons[reason] = (errorReasons[reason] || 0) + 1
    })
    console.warn(`[AI 估值诊断] ${failed.length}台失败, 原因分布:`, errorReasons)
  }

  return results
}

// 清除 AI 估值缓存
export function clearAIValuationCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AI_CACHE_KEY)
  }
}

// ====== 修复：页面刷新后 AI 估值丢失 ======
// 原因：aiValuations 仅保存在组件 useState（内存）里，刷新即空；
//       而真实结果其实已写入 localStorage 缓存，但组件没有读回。
// 解决：
//  1) 提供 restoreAIValuationsFromCache：把缓存按资产列表恢复成
//     Map<asset_code, AIValResult>，供页面加载后 setAiValuations()
//  2) 提供 syncResolveAIValuation：在渲染时兜底（state 没命中时）
//     直接查缓存，连缓存都没有则返回本地估值。渲染端用它替代
//     aiValuations.get()，保证刷新后也能立刻显示 AI 历史结果。
// =========================================

// AI 估值结果类型：
//  - source='ai'   ：字段 fixedValue/currentValue 一定存在（AI 成功出值或从 DB/缓存恢复）
//  - source='none' ：用户要求"不要本地估值兜底"，因此这些字段为 undefined；
//                    渲染端应显示"待AI估值"并给刷新按钮
export type AIValResult = {
  fixedValue?: number
  currentValue?: number
  source: 'ai' | 'none'
  reason?: string
  error?: string
  // 估值时间（从 DB 读出时带），展示用
  valuatedAt?: string
}

/**
 * 同步恢复 AI 估值到 state 的 Map（两来源：① 每行 asset 自带的 ai_* 列 ② localStorage 缓存）。
 * - 若 PostgREST schema cache 还没包含 ai_* 列，asset.ai_current_value 将为 undefined，
 *   此时只靠 localStorage 缓存兜底；需要持久化请调用 async 版 `restoreAIValuationsFromCache`
 *   它会再用 execute_sql 通道从 DB 真正读出来并合并。
 */
export function syncRestoreAIValuationsFromCache<
  T extends {
    asset_code: string;
    cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string
    ai_fixed_value?: number | null
    ai_current_value?: number | null
    ai_reason?: string | null
    ai_valuated_at?: string | null
  }
>(assets: T[]): Map<string, AIValResult> {
  const out = new Map<string, AIValResult>()
  if (!assets || assets.length === 0) return out

  // 预读一次 localStorage 缓存（避免每台资产都 parse JSON）
  const cache = readAICache()
  const cfg = getAIValuationConfig()
  const ttl = cfg.cacheTTL || DEFAULT_AI_CONFIG.cacheTTL
  const now = Date.now()

  for (const a of assets) {
    if (!a.asset_code) continue

    // ① 最高优先级：从 assets.ai_* 列读（持久化，刷新/换浏览器都不丢）
    if (a.ai_current_value != null && typeof a.ai_current_value === 'number' && a.ai_current_value > 0) {
      const fixed = (a.ai_fixed_value != null && typeof a.ai_fixed_value === 'number' && a.ai_fixed_value > 0)
        ? a.ai_fixed_value : a.ai_current_value // 极少数历史只有 current 值
      out.set(a.asset_code, {
        fixedValue: fixed,
        currentValue: a.ai_current_value,
        source: 'ai',
        reason: a.ai_reason ?? undefined,
        valuatedAt: a.ai_valuated_at ?? undefined
      })
      continue
    }

    // ② 次优先级：localStorage 缓存（新 key: code:asset_code）
    const key = makeCacheKey(a)
    const entry = cache.get(key)
    if (entry && now - entry.createdAt <= ttl) {
      out.set(a.asset_code, {
        fixedValue: entry.fixedValue,
        currentValue: entry.currentValue,
        source: 'ai',
        reason: entry.reason
      })
      continue
    }
    // ②-兼容 旧版 key（brand|spec|age 格式），用前缀模糊匹配（age 会变）
    const spec = formatHardwareSpec(a)
    const brand = (a.brand || '').toUpperCase().slice(0, 20)
    const prefix = `${brand}|${spec}|age`
    let found = false
    for (const [k, v] of cache.entries()) {
      if (k.startsWith(prefix) && now - v.createdAt <= ttl) {
        out.set(a.asset_code, {
          fixedValue: v.fixedValue,
          currentValue: v.currentValue,
          source: 'ai',
          reason: v.reason
        })
        found = true
        break
      }
    }
    if (found) continue
  }
  return out
}

/**
 * 异步恢复 AI 估值：先跑同步版本（DB 列 + localStorage），
 * 若发现很多资产的 ai_* 列在同步版本不可见 → 再通过 execute_sql RPC
 * 直接从数据库查出所有 ai_* 估值，合并进结果 Map。
 *
 * 用户要求「估值一次后，刷新页面还能一直保存」：
 * 这条函数是核心保障，不依赖 PostgREST schema cache 是否刷新。
 */
export async function restoreAIValuationsFromCache<
  T extends {
    asset_code: string;
    cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string
    ai_fixed_value?: number | null
    ai_current_value?: number | null
    ai_reason?: string | null
    ai_valuated_at?: string | null
  }
>(assets: T[]): Promise<Map<string, AIValResult>> {
  const out = syncRestoreAIValuationsFromCache(assets)
  if (!assets || assets.length === 0) return out

  const syncCount = out.size
  const total = assets.length

  // 统计：有多少台资产在「同步版」里通过 ① DB ai_current_value 列读到了
  let dbColVisibleCount = 0
  const missingCodes: string[] = []
  for (const a of assets) {
    if (!a.asset_code) continue
    if (a.ai_current_value != null && typeof a.ai_current_value === 'number' && a.ai_current_value > 0) {
      dbColVisibleCount++
    } else if (!out.has(a.asset_code)) {
      missingCodes.push(a.asset_code)
    }
  }

  console.log(`[AI 恢复诊断] 总${total}台, 同步恢复${syncCount}台, DB列可见${dbColVisibleCount}台, 仍缺${missingCodes.length}台`)

  // 如果 DB 列基本不可见（少于 20% 资产带列），或者有超过 5 台缺失，
  // 那就启动 SQL 通道兜底读取（异步，不阻塞首屏渲染）。
  const needSQLFallback =
    (total > 0 && dbColVisibleCount / total < 0.2) ||
    missingCodes.length >= 5

  if (needSQLFallback) {
    try {
      const allCodes = assets.map(a => a.asset_code).filter(Boolean) as string[]
      const sqlMap = await fetchAIMapFromDBViaSQL(allCodes)
      if (sqlMap.size > 0) {
        for (const [code, val] of sqlMap) {
          out.set(code, val)
        }
        console.log(`[AI 恢复诊断] execute_sql 通道从DB恢复了 ${sqlMap.size} 台, 恢复后总计 ${out.size} 台`)
      } else {
        console.warn(`[AI 恢复诊断] execute_sql 通道未返回数据（可能RPC不存在或DB无ai_*列）`)
      }
    } catch (e: any) {
      console.warn('[AI 恢复诊断] SQL 通道兜底读取失败:', e?.message)
    }
  }

  return out
}

/**
 * 渲染端同步解析 AI 估值：
 *   DB（asset.ai_* 列）→ state Map → localStorage 缓存
 *
 * 用户明确：不再用本地算法兜底。三档都没有时返回 source='none'，
 * UI 据此显示"待AI估值"引导用户刷新。
 */
export function syncResolveAIValuation(
  stateMap: Map<string, AIValResult> | undefined | null,
  asset: {
    asset_code: string;
    cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string
    ai_fixed_value?: number | null
    ai_current_value?: number | null
    ai_reason?: string | null
    ai_valuated_at?: string | null
  }
): AIValResult {
  // ① 组件 state（用户刚点过刷新，或 restoreAIValuationsFromCache 已回填）
  if (stateMap && asset.asset_code) {
    const fromState = stateMap.get(asset.asset_code)
    if (fromState) return fromState
  }

  // ② DB 持久化列（ai_*）—— 最高可靠度，不依赖 TTL，只要写过就一直有
  if (asset.asset_code) {
    if (asset.ai_current_value != null && typeof asset.ai_current_value === 'number' && asset.ai_current_value > 0) {
      const fixed = (asset.ai_fixed_value != null && typeof asset.ai_fixed_value === 'number' && asset.ai_fixed_value > 0)
        ? asset.ai_fixed_value : asset.ai_current_value
      return {
        fixedValue: fixed,
        currentValue: asset.ai_current_value,
        source: 'ai',
        reason: asset.ai_reason ?? undefined,
        valuatedAt: asset.ai_valuated_at ?? undefined
      }
    }
  }

  // ③ localStorage 缓存（DB 列还没写/不存在时的补偿）—— 兼容新旧 key
  if (asset.asset_code) {
    try {
      const cfg = getAIValuationConfig()
      const ttl = Math.max(cfg.cacheTTL || 0, DEFAULT_AI_CONFIG.cacheTTL)
      const cache = readAICache()
      // 新 key 精确匹配
      const entry = cache.get(makeCacheKey(asset))
      if (entry && Date.now() - entry.createdAt <= ttl) {
        return {
          fixedValue: entry.fixedValue,
          currentValue: entry.currentValue,
          source: 'ai',
          reason: entry.reason
        }
      }
      // 旧版 key 前缀模糊匹配（age 会变，不能精确匹配）
      const spec = formatHardwareSpec(asset)
      const brand = (asset.brand || '').toUpperCase().slice(0, 20)
      const prefix = `${brand}|${spec}|age`
      for (const [k, v] of cache.entries()) {
        if (k.startsWith(prefix) && Date.now() - v.createdAt <= ttl) {
          return {
            fixedValue: v.fixedValue,
            currentValue: v.currentValue,
            source: 'ai',
            reason: v.reason
          }
        }
      }
    } catch {
      // ignore cache error
    }
  }

  // 三档都没有 → 不要本地兜底，返回 source='none' 让 UI 显示待估值
  return { source: 'none' }
}

// 暴露到 window 以便在浏览器控制台调用恢复函数
// 使用方法: 在浏览器控制台输入: await window.recoverData()
if (typeof window !== 'undefined') {
  (window as any).recoverData = recoverOverwrittenAssets
}
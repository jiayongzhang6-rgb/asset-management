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
      .from('assets')
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
      .from('assets')
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
export async function generateMonthlySettlement(
  year: number,
  month: number,
  operatorEmail: string
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
      const { data: assets, error: assetErr } = await supabase
        .from('assets')
        .select('asset_code, monthly_rent, department, user_name')
        .neq('status', 'retired')

      if (assetErr) throw assetErr

      const assetMap = new Map((assets || []).map(a => [a.asset_code, a]))
      let updatedCount = 0

      for (const [code, a] of assetMap) {
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
        message: `结算单已更新（${updatedCount} 条记录已同步最新租金）`,
        details: { departments: 0, totalRecords: updatedCount, totalRent: 0, errors: [] }
      }
    }

    // 2. 首次生成：获取所有非报废资产
    const { data: assets, error: assetErr } = await supabase
      .from('assets')
      .select('id, asset_code, department, user_name, monthly_rent, status')
      .neq('status', 'retired')

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
      `生成 ${year}年${month}月 租赁结算单：${newRecords.length} 条记录，${deptSet.size} 个部门，总计 ¥${totalRent.toFixed(2)}`)

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
      .from('assets')
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
      .from('assets')
      .select('asset_code')
      .like('asset_code', `${prefix}%`)

    if (error) {
      console.warn('Failed to query max asset code, falling back to count:', error.message)
      // 降级：用总数+1
      const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true })
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
        .from('assets')
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
    const { error } = await supabase.from('assets').select('category').limit(1)
    _categorySupported = !error
    if (error) {
      console.warn('Category column not available in schema cache, will strip from requests:', error.message)
    } else {
      console.log('Category column is available in schema cache')
    }
    return _categorySupported
  } catch (e: any) {
    console.warn('Category check threw error, treating as unsupported:', e?.message)
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

// 重置 category 支持检测（添加列后调用）
export function resetCategoryCheck(): void {
  _categorySupported = null
}

// ===== AI 估值列 schema 探测（避免 PostgREST schema cache 未刷新时报错） =====
let _aiColumnsSupported: boolean | null = null

export function isAIColumnsSupportedSync(): boolean {
  return _aiColumnsSupported === true
}

export async function isAIColumnsSupported(): Promise<boolean> {
  if (_aiColumnsSupported !== null) return _aiColumnsSupported
  try {
    const { error } = await supabase.from('assets').select('ai_current_value').limit(1)
    _aiColumnsSupported = !error
    if (error) {
      console.warn('AI valuation columns not in schema cache, will skip writing to DB:', error.message)
    }
    return _aiColumnsSupported
  } catch (e: any) {
    console.warn('AI columns check threw:', e?.message)
    _aiColumnsSupported = false
    return false
  }
}

export function resetAIColumnsCheck(): void {
  _aiColumnsSupported = null
}

/**
 * 把 AI 估值结果写入 assets 表对应的 ai_* 列（持久化到数据库）。
 * 刷新/换浏览器/清 localStorage 都不会丢。
 * 如果 schema cache 还没包含这些列 → 静默跳过，不报错。
 */
export async function persistAIValuationToDB(
  asset_code: string,
  value: { fixedValue: number; currentValue: number; reason?: string; source?: 'ai' | 'local' }
): Promise<boolean> {
  if (!asset_code) return false
  if (value.source === 'local') return false // 用户说不要本地估值，只持久化 AI 真结果
  try {
    const supported = await isAIColumnsSupported()
    if (!supported) return false
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
    if (error) {
      console.warn(`写 AI 估值到 DB 失败(${asset_code}):`, error.message)
      return false
    }
    return true
  } catch (e: any) {
    console.warn('persistAIValuationToDB exception:', e?.message)
    return false
  }
}

/**
 * 批量写 AI 估值结果回 DB。
 */
export async function batchPersistAIValuationToDB(
  items: Array<{ asset_code: string; fixedValue: number; currentValue: number; reason?: string; source?: 'ai' | 'local' }>
): Promise<number> {
  if (!items || items.length === 0) return 0
  const supported = await isAIColumnsSupported()
  if (!supported) return 0
  let okCount = 0
  for (const it of items) {
    if (it.source === 'local') continue
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
      // skip one error, continue others
    }
  }
  return okCount
}

async function ensureColumn(table: string, column: string, definition: string): Promise<boolean> {
  const { data: cols } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .eq('column_name', column)

  if (cols && cols.length > 0) return true

  // 尝试通过 RPC 添加列
  const { error } = await supabase.rpc('execute_sql', {
    sql: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${definition};`
  })
  if (error) {
    console.warn(`Could not add column ${column} to ${table} via RPC:`, error.message)
    return false
  }

  // 添加列后刷新 PostgREST schema cache，否则 API 仍然看不到新列
  try {
    await supabase.rpc('execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" })
    console.log('PostgREST schema cache reload notified')
  } catch (e) {
    console.warn('Could not notify PostgREST schema reload:', e)
  }

  return true
}

async function ensureTable(table: string, createSql: string): Promise<boolean> {
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)

  if (tables && tables.length > 0) return true

  const { error } = await supabase.rpc('execute_sql', { sql: createSql })
  if (error) {
    console.error(`Error creating table ${table}:`, error)
    return false
  }
  return true
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
}

const AI_CONFIG_KEY = 'ai_valuation_config_v1'
const AI_CACHE_KEY = 'ai_valuation_cache_v1'

// 默认配置：已内置小米 MiMo 端点与模型，只需粘贴 API Key 即可启用
const DEFAULT_AI_CONFIG: AIValuationConfig = {
  apiKey: '',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  model: 'mimo-v2.5-pro',
  enabled: false,
  cacheTTL: 24 * 60 * 60 * 1000
}

// 读取AI配置（从 localStorage，因为纯前端不存数据库）
export function getAIValuationConfig(): AIValuationConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (!raw) return DEFAULT_AI_CONFIG
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_AI_CONFIG, ...parsed }
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

// 生成缓存 key：硬件配置 + 使用年数（四舍五入半年粒度）
function makeCacheKey(asset: { cpu?: string; ram?: string; storage?: string; gpu?: string; brand?: string; created_at?: string }): string {
  let ageYears = 1
  if (asset.created_at) {
    const age = (Date.now() - new Date(asset.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ageYears = Math.max(0.5, Math.round(age * 2) / 2) // 0.5 年粒度
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

  // ① 用户明确：不要本地估值；未启用 / 未配 Key → 直接返回 none
  if (!config.enabled || !config.apiKey) {
    return { source: 'none' as const, error: 'AI估值未启用或未填写 API Key，请先到 AI估值设置页配置。' }
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

  // ③ 调用 AI
  try {
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
  const results: any[] = new Array(assets.length)
  let cursor = 0
  let done = 0

  async function worker() {
    while (cursor < assets.length) {
      const idx = cursor++
      results[idx] = await estimateAssetValueWithAI(assets[idx])
      done++
      onProgress?.(done, assets.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, assets.length) }, () => worker())
  await Promise.all(workers)

  // 统一批量写 DB（AI 出值的那些）
  try {
    const dbItems = results
      .map((r, i) => ({ asset_code: assets[i].asset_code, ...r }))
      .filter(r => r.asset_code && r.source === 'ai' && typeof r.currentValue === 'number') as any[]
    if (dbItems.length > 0) await batchPersistAIValuationToDB(dbItems)
  } catch (err) {
    console.warn('批量持久化 AI 估值到 DB 失败:', err)
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
 * 恢复 AI 估值到组件 state 的 Map（DB 列 + localStorage 缓存两个来源，DB 优先）。
 * - 刷新页面后首次加载资产/结算数据时调用，把之前 AI 出值立刻回填到 state。
 * - asset 必须带 asset_code，以及可能的 ai_fixed_value / ai_current_value / ai_reason / ai_valuated_at 列（来自 Supabase select）。
 */
export function restoreAIValuationsFromCache<
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

    // ② 次优先级：localStorage 缓存（DB 还没写或列不可用时的补充）
    const key = makeCacheKey(a)
    const entry = cache.get(key)
    if (entry && now - entry.createdAt <= ttl) {
      out.set(a.asset_code, {
        fixedValue: entry.fixedValue,
        currentValue: entry.currentValue,
        source: 'ai',
        reason: entry.reason
      })
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

  // ③ localStorage 缓存（DB 列还没写/不存在时的补偿）
  if (asset.asset_code) {
    try {
      const cfg = getAIValuationConfig()
      const ttl = cfg.cacheTTL || DEFAULT_AI_CONFIG.cacheTTL
      const cache = readAICache()
      const entry = cache.get(makeCacheKey(asset))
      if (entry && Date.now() - entry.createdAt <= ttl) {
        return {
          fixedValue: entry.fixedValue,
          currentValue: entry.currentValue,
          source: 'ai',
          reason: entry.reason
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
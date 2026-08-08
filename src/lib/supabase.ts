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

// 生成资产编码
export function generateAssetCode(count: number): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const seq = String(count + 1).padStart(3, '0')
  return `PC-${year}-${month}-${seq}`
}

// 获取北京时间
export function getBeijingTime(utcStr: string): string {
  const utcDate = new Date(utcStr)
  const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000)
  return beijingDate.toLocaleString('zh-CN')
}

// ===== 数据库初始化 =====
const DB_VERSION_KEY = 'db_schema_version'
const CURRENT_DB_VERSION = 4

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
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Asset = {
  id: string
  asset_code: string
  brand: string
  model: string
  cpu: string
  ram: string
  storage: string
  gpu: string
  os: string
  department: string
  user_name: string
  location: string
  status: string
  notes: string
  created_at: string
  updated_at: string
}

export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'updated_at'>
export type AssetUpdate = Partial<AssetInsert>

// 初始化数据库表结构
export const initDatabase = async () => {
  try {
    // 检查operation_history表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'operation_history')

    if (tablesError) {
      console.error('Error checking tables:', tablesError)
      return
    }

    // 如果表不存在，创建它
    if (tables.length === 0) {
      const { error: createError } = await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE operation_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_id UUID NOT NULL,
            operation_type VARCHAR(20) NOT NULL,
            user_email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      })

      if (createError) {
        console.error('Error creating operation_history table:', createError)
      } else {
        console.log('Operation history table created successfully')
      }
    } else {
      // 检查表结构，确保asset_id是UUID类型
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'operation_history')

      if (columnsError) {
        console.error('Error checking columns:', columnsError)
      } else {
        const assetIdColumn = columns.find(col => col.column_name === 'asset_id')
        if (assetIdColumn && assetIdColumn.data_type !== 'uuid') {
          console.warn('Asset ID column is not UUID type, consider migrating it')
        }
      }
    }
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

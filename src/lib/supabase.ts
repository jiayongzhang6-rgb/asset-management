import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type MaintenanceRecord = {
  id: number
  asset_id: string // 使用 string 类型以兼容 UUID
  issue_description: string
  repair_description: string
  repair_date: string
  repair_cost: number
  status: string
  created_at: string
  updated_at: string
}

export type Asset = {
  id: string // 使用 string 类型以兼容 UUID
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
export type MaintenanceRecordInsert = Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>
export type MaintenanceRecordUpdate = Partial<MaintenanceRecordInsert>

export type AssetImage = {
  id: string
  asset_code: string
  image_url: string
  image_name: string
  created_at: string
  updated_at: string
}
export type AssetImageInsert = Omit<AssetImage, 'id' | 'created_at' | 'updated_at'>

export type UsageHistory = {
  id: number
  asset_code: string
  operation_type: string
  user_email: string
  changes: string
  created_at: string
  updated_at: string
}
export type UsageHistoryInsert = Omit<UsageHistory, 'id' | 'created_at' | 'updated_at'>
export type UsageHistoryUpdate = Partial<UsageHistoryInsert>

// 初始化数据库表结构
export const initDatabase = async () => {
  console.log('Starting database initialization...')
  
  // 检查 operation_history 表结构并迁移
  try {
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'operation_history')

    if (tablesError) {
      console.error('Error checking operation_history table:', tablesError)
    } else if (tables.length === 0) {
      // 表不存在，创建新表
      console.log('Creating operation_history table...')
      const { error: createError } = await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE operation_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            asset_code VARCHAR(50) NOT NULL,
            operation_type VARCHAR(20) NOT NULL,
            user_email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );
          
          ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Allow public read access" ON operation_history FOR SELECT USING (true);
          CREATE POLICY "Allow public insert access" ON operation_history FOR INSERT WITH CHECK (true);
          CREATE POLICY "Allow public update access" ON operation_history FOR UPDATE USING (true);
          CREATE POLICY "Allow public delete access" ON operation_history FOR DELETE USING (true);
        `
      })
      
      if (createError) {
        console.error('Error creating operation_history table:', createError)
      } else {
        console.log('Operation history table created successfully')
      }
    } else {
      // 表已存在，检查列结构
      console.log('Checking operation_history table structure...')
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'operation_history')

      if (columnsError) {
        console.error('Error checking columns:', columnsError)
      } else {
        console.log('Current columns:', columns)
        
        const hasAssetCode = columns.some(col => col.column_name === 'asset_code')
        const hasAssetId = columns.some(col => col.column_name === 'asset_id')
        
        if (!hasAssetCode && hasAssetId) {
          console.log('Migrating operation_history from asset_id to asset_code...')
          // 需要迁移表结构
          const { error: migrateError } = await supabase.rpc('execute_sql', {
            sql: `
              ALTER TABLE operation_history DROP COLUMN IF EXISTS asset_id;
              ALTER TABLE operation_history ADD COLUMN asset_code VARCHAR(50) NOT NULL;
            `
          })
          
          if (migrateError) {
            console.error('Migration error:', migrateError)
            // 如果 RPC 失败，尝试使用原始 SQL
            console.log('Trying alternative migration method...')
          } else {
            console.log('Migration completed successfully')
          }
        } else if (hasAssetCode) {
          console.log('operation_history table already has asset_code column')
        }
      }
    }
  } catch (error) {
    console.error('Error in operation_history initialization:', error)
  }
  
  // 检查 maintenance_records 表
  try {
    const { data: maintenanceTables, error: maintenanceTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'maintenance_records')

    if (maintenanceTablesError) {
      console.error('Error checking maintenance_records table:', maintenanceTablesError)
    } else if (maintenanceTables.length === 0) {
      console.log('Creating maintenance_records table...')
      const { error: createMaintenanceError } = await supabase.rpc('execute_sql', {
        sql: `
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
        `
      })

      if (createMaintenanceError) {
        console.error('Error creating maintenance_records table:', createMaintenanceError)
      } else {
        console.log('Maintenance records table created successfully')
      }
    } else {
      console.log('maintenance_records table already exists')
    }
  } catch (error) {
    console.error('Error in maintenance_records initialization:', error)
  }
  
  // 检查 asset_images 表
  try {
    const { data: imageTables, error: imageTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'asset_images')

    if (imageTablesError) {
      console.error('Error checking asset_images table:', imageTablesError)
    } else if (imageTables.length === 0) {
      console.log('Creating asset_images table...')
      const { error: createImageError } = await supabase.rpc('execute_sql', {
        sql: `
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
        `
      })

      if (createImageError) {
        console.error('Error creating asset_images table:', createImageError)
      } else {
        console.log('Asset images table created successfully')
      }
    } else {
      console.log('asset_images table already exists')
    }
  } catch (error) {
    console.error('Error in asset_images initialization:', error)
  }
  
  // 检查 usage_history 表
  try {
    const { data: usageTables, error: usageTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'usage_history')

    if (usageTablesError) {
      console.error('Error checking usage_history table:', usageTablesError)
    } else if (usageTables.length === 0) {
      console.log('Creating usage_history table...')
      const { error: createUsageError } = await supabase.rpc('execute_sql', {
        sql: `
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
        `
      })

      if (createUsageError) {
        console.error('Error creating usage_history table:', createUsageError)
      } else {
        console.log('Usage history table created successfully')
      }
    } else {
      console.log('usage_history table already exists')
    }
  } catch (error) {
    console.error('Error in usage_history initialization:', error)
  }
  
  console.log('Database initialization completed')
}
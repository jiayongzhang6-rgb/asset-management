import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type MaintenanceRecord = {
  id: number
  asset_id: number
  issue_description: string
  repair_description: string
  repair_date: string
  repair_cost: number
  status: string
  created_at: string
  updated_at: string
}

export type Asset = {
  id: number
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

// 初始化数据库表结构
export const initDatabase = async () => {
  try {
    // 检查maintenance_records表是否存在
    const { data: maintenanceTables, error: maintenanceTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'maintenance_records')

    if (maintenanceTablesError) {
      console.error('Error checking maintenance_records table:', maintenanceTablesError)
    } else {
      if (maintenanceTables.length === 0) {
        const { error: createMaintenanceError } = await supabase.rpc('execute_sql', {
          sql: `
            CREATE TABLE maintenance_records (
              id bigint primary key generated always as identity,
              asset_id bigint not null,
              issue_description text not null,
              repair_description text,
              repair_date date,
              repair_cost decimal(10, 2),
              status text not null default 'pending',
              created_at timestamp with time zone default now(),
              updated_at timestamp with time zone default now(),
              foreign key (asset_id) references assets(id)
            );
            
            -- 启用行级安全
            alter table maintenance_records enable row level security;
            
            -- 创建策略
            create policy "Allow public read access" on maintenance_records
              for select using (true);
            
            create policy "Allow public insert access" on maintenance_records
              for insert with check (true);
            
            create policy "Allow public update access" on maintenance_records
              for update using (true);
            
            create policy "Allow public delete access" on maintenance_records
              for delete using (true);
          `
        })

        if (createMaintenanceError) {
          console.error('Error creating maintenance_records table:', createMaintenanceError)
        } else {
          console.log('Maintenance records table created successfully')
        }
      }
    }

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
            asset_id bigint NOT NULL,
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
      // 检查表结构，确保asset_id是bigint类型
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'operation_history')

      if (columnsError) {
        console.error('Error checking columns:', columnsError)
      } else {
        const assetIdColumn = columns.find(col => col.column_name === 'asset_id')
        if (assetIdColumn && assetIdColumn.data_type !== 'bigint') {
          console.warn('Asset ID column is not bigint type, consider migrating it')
        }
      }
    }
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

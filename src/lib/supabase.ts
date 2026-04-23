import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type AssetCategory = {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}

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
  category_id: number
  created_at: string
  updated_at: string
}

export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'updated_at'>
export type AssetUpdate = Partial<AssetInsert>
export type AssetCategoryInsert = Omit<AssetCategory, 'id' | 'created_at' | 'updated_at'>
export type AssetCategoryUpdate = Partial<AssetCategoryInsert>
export type MaintenanceRecordInsert = Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>
export type MaintenanceRecordUpdate = Partial<MaintenanceRecordInsert>

// 初始化数据库表结构
export const initDatabase = async () => {
  try {
    // 检查asset_categories表是否存在
    const { data: categoriesTables, error: categoriesTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'asset_categories')

    if (categoriesTablesError) {
      console.error('Error checking asset_categories table:', categoriesTablesError)
    } else {
      if (categoriesTables.length === 0) {
        const { error: createCategoriesError } = await supabase.rpc('execute_sql', {
          sql: `
            CREATE TABLE asset_categories (
              id bigint primary key generated always as identity,
              name text not null unique,
              description text,
              created_at timestamp with time zone default now(),
              updated_at timestamp with time zone default now()
            );
            
            -- 启用行级安全
            alter table asset_categories enable row level security;
            
            -- 创建策略
            create policy "Allow public read access" on asset_categories
              for select using (true);
            
            create policy "Allow public insert access" on asset_categories
              for insert with check (true);
            
            create policy "Allow public update access" on asset_categories
              for update using (true);
            
            create policy "Allow public delete access" on asset_categories
              for delete using (true);
            
            -- 插入默认分类
            INSERT INTO asset_categories (name, description) VALUES
              ('台式电脑', '桌面式计算机设备'),
              ('笔记本电脑', '便携式计算机设备'),
              ('服务器', '网络服务器设备'),
              ('网络设备', '路由器、交换机等网络设备'),
              ('其他', '其他类型的IT资产');
          `
        })

        if (createCategoriesError) {
          console.error('Error creating asset_categories table:', createCategoriesError)
        } else {
          console.log('Asset categories table created successfully')
        }
      }
    }

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

    // 检查assets表是否有category_id列
    const { data: assetsColumns, error: assetsColumnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'assets')
      .eq('column_name', 'category_id')

    if (assetsColumnsError) {
      console.error('Error checking assets columns:', assetsColumnsError)
    } else {
      if (assetsColumns.length === 0) {
        const { error: addColumnError } = await supabase.rpc('execute_sql', {
          sql: `
            ALTER TABLE assets ADD COLUMN category_id bigint DEFAULT 1;
            ALTER TABLE assets ADD CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES asset_categories(id);
          `
        })

        if (addColumnError) {
          console.error('Error adding category_id column to assets:', addColumnError)
        } else {
          console.log('Added category_id column to assets table')
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

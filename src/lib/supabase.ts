import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
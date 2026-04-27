import { supabase } from './src/lib/supabase.js'

async function testConnection() {
  console.log('=== Testing Supabase Connection ===')
  
  try {
    // 测试基本连接
    console.log('1. Testing basic connection...')
    const { data: health, error: healthError } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (healthError) {
      console.error('Health check failed:', healthError)
      
      // 检查是否有 users 表
      console.log('\n2. Checking if users table exists...')
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
      
      if (tablesError) {
        console.error('Error checking tables:', tablesError)
      } else {
        console.log('Available tables:', tables.map(t => t.table_name))
      }
    } else {
      console.log('Basic connection successful')
      
      // 获取所有用户
      console.log('\n3. Fetching all users...')
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        console.log(`Found ${users.length} users:`)
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.email} (role: ${user.role})`)
        })
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }
  
  console.log('=== Test Complete ===')
}

testConnection()

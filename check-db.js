import { supabase } from './src/lib/supabase.js'

async function checkUsersTable() {
  try {
    // 检查 users 表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')

    if (tablesError) {
      console.error('Error checking users table:', tablesError)
      return
    }

    if (tables.length === 0) {
      console.log('Users table does not exist')
      return
    }

    // 检查 users 表的列
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')

    if (columnsError) {
      console.error('Error checking columns:', columnsError)
      return
    }

    console.log('Users table columns:')
    columns.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`)
    })

    // 检查是否有数据
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return
    }

    console.log('\nUsers data:')
    console.log(users)
  } catch (error) {
    console.error('Error:', error)
  }
}

checkUsersTable()

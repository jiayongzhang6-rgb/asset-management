import { supabase } from './src/lib/supabase.js'

async function testUsersTable() {
  try {
    // 尝试插入一个用户，看看是否有 password 字段
    const { data, error } = await supabase
      .from('users')
      .insert({ 
        email: 'test@example.com', 
        password: 'test123', 
        role: 'user' 
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting user:', error)
      return
    }

    console.log('User inserted successfully:')
    console.log(data)

    // 尝试查询用户
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@example.com')

    if (queryError) {
      console.error('Error querying users:', queryError)
      return
    }

    console.log('\nUser queried successfully:')
    console.log(users)
  } catch (error) {
    console.error('Error:', error)
  }
}

testUsersTable()

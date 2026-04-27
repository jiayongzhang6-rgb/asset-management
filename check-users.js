import { supabase } from './src/lib/supabase.js'

async function checkUsers() {
  try {
    // 从 users 表中获取所有用户
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      return
    }

    console.log(`Found ${users.length} users:`)
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role})`)
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

checkUsers()

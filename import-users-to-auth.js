import { supabase } from './src/lib/supabase.js'

async function importUsersToAuth() {
  try {
    // 从 users 表中获取所有用户
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      return
    }

    console.log(`Found ${users.length} users to import`)

    let successCount = 0
    let errorCount = 0

    // 为每个用户创建 Supabase Auth 账号
    for (const user of users) {
      try {
        console.log(`Importing user: ${user.email}`)

        // 尝试注册用户
        const { error: authError } = await supabase.auth.signUp({
          email: user.email,
          password: user.password || 'default123' // 如果没有密码，使用默认密码
        })

        if (authError) {
          console.error(`Error importing ${user.email}:`, authError)
          errorCount++
        } else {
          console.log(`Successfully imported ${user.email}`)
          successCount++
        }

        // 为了避免 API 速率限制，添加一个小延迟
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error processing ${user.email}:`, error)
        errorCount++
      }
    }

    console.log('\nImport complete:')
    console.log(`Successfully imported: ${successCount}`)
    console.log(`Failed to import: ${errorCount}`)
  } catch (error) {
    console.error('Error:', error)
  }
}

importUsersToAuth()

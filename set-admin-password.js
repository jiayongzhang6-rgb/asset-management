import { supabase } from './src/lib/supabase.js'

async function setAdminPassword() {
  try {
    const email = '747227185@qq.com'
    const password = '747227185@qq.com' // 密码设为与邮箱相同

    // 检查用户是否存在
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return
    }

    if (users && users.length > 0) {
      // 用户存在，更新密码
      const { error: updateError } = await supabase
        .from('users')
        .update({ password })
        .eq('email', email)

      if (updateError) {
        console.error('Error updating password:', updateError)
        return
      }

      console.log('管理员密码更新成功！')
      console.log('邮箱:', email)
      console.log('密码:', password)
    } else {
      // 用户不存在，创建新用户
      const { data, error: insertError } = await supabase
        .from('users')
        .insert({ email, password, role: 'admin' })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating user:', insertError)
        return
      }

      console.log('管理员账号创建成功！')
      console.log('邮箱:', email)
      console.log('密码:', password)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

setAdminPassword()

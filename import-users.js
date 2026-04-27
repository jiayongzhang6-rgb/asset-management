// import-users.js
import { createClient } from '@supabase/supabase-js';

// 直接填写你的 Supabase 项目信息
const supabaseUrl = 'https://ikmgnhjyiibchpuwynvi.supabase.co/rest/v1/';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrbWduaGp5aWliY2hwdXd5bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDg1MTMsImV4cCI6MjA5MjI4NDUxM30.cEw9T3KL4BTLwW3kjg23tJaONRajBKqXPav6GhddK_0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function importUsers() {
  try {
    // 从 users 表中获取所有用户
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*');

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return;
    }

    console.log(`Found ${users.length} users to import`);

    let successCount = 0;
    let errorCount = 0;

    // 为每个用户创建 Supabase Auth 账号
    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email}`);

        // 尝试注册用户
        const { error: authError } = await supabase.auth.signUp({
          email: user.email,
          password: user.password || 'default123'
        });

        if (authError) {
          console.error(`Error importing ${user.email}:`, authError);
          errorCount++;
        } else {
          console.log(`Successfully imported ${user.email}`);
          successCount++;
        }

        // 避免 API 速率限制
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('\nImport complete:');
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${errorCount}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

importUsers();
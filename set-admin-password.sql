-- 为管理员账号设置密码
UPDATE users 
SET password = '747227185@qq.com' 
WHERE email = '747227185@qq.com';

-- 如果管理员账号不存在，创建它
INSERT INTO users (email, password, role) 
VALUES ('747227185@qq.com', '747227185@qq.com', 'admin')
ON CONFLICT (email) DO NOTHING;

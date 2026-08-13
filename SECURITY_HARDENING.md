# 安全加固交付说明（兼容式）

针对 `asset-management` 审计发现的 4 个高危问题，本次加固覆盖：

| 风险 | 原状 | 加固后 |
|---|---|---|
| 密码明文存储 | `users.password` 是明文，登录 `userData.password !== password` 前端比对 | 改为 pgcrypto(bcrypt) 哈希；密码校验在数据库内完成，前端**永不接触明文/哈希** |
| 匿名自我提权为管理员 | RLS `using(true)`，任何人可 `update users set role='admin'` | 新增 RLS 禁止把角色提升为 admin、禁止直接插入 admin、禁止改邮箱、禁止删除 |
| 管理员可被前端伪造 | `adminEmails` 硬编码，role 由前端写进 localStorage，DevTools 可改 | 角色以**数据库返回为准**（服务端可信），前端不再推导/可改 |
| 注册/改密/重置走明文直写 | 直接 `insert/update` users 表 | 全部走 `SECURITY DEFINER` RPC，密码入库即哈希 |

## 文件清单

```
security/
├── supabase-hardening.sql        # 在 Supabase 控制台执行的 SQL（建 RPC + 收紧 RLS）
├── README_加固说明.md            # 本文件
└── src/
    ├── lib/authRpc.ts            # 新增：RPC 封装（登录/注册/改密/重置/删除）
    ├── App.tsx                   # 改：signIn/signUp/resetPassword/updatePassword 走 RPC
    └── pages/Users.tsx           # 改：删除/重置密码走 RPC
```

## 部署步骤（顺序不能错）

### 第 1 步：在 Supabase 控制台执行 SQL
1. 打开你的 Supabase 项目 → **SQL Editor**。
2. 粘贴 `security/supabase-hardening.sql` 全部内容，点 **Run**。
3. 确认无报错。该脚本会：启用 pgcrypto、创建 5 个 RPC 函数、授权 anon 调用、并收紧 `users` 表的 RLS。
4. **已有用户**：首次用原明文密码登录时，RPC 会自动把该账号密码迁移为 bcrypt 哈希；长期不登录的账号仍是明文，建议登录一次或手动 `update users set password = crypt(password, gen_salt('bf')) where password not like '$2%'`。

> ⚠️ 必须先执行 SQL，再部署前端。否则前端调用 RPC 会因函数不存在而登录失败。

### 第 2 步：部署改后的前端文件
把下面 3 个文件覆盖到仓库对应路径（保持相对路径一致）：
- `security/src/lib/authRpc.ts` → `src/lib/authRpc.ts`（新增）
- `security/src/App.tsx` → `src/App.tsx`
- `security/src/pages/Users.tsx` → `src/pages/Users.tsx`

然后正常构建部署（`npm run build` + 你的 Cloudflare/Vercel 流程）。

## 仍然存在的边界（需后续迁移才能根除）

1. **资产/租金/操作历史三张表仍是全开 RLS**。因为前端用匿名 key 且未走 Supabase Auth，数据库层无法区分「正常登录用户」与「匿名攻击者」。彻底锁定需把登录迁移到 **Supabase Auth**，并改用基于 `auth.uid()` 的 RLS。
2. **`users` 表 SELECT 仍公开**（前端用户列表需要）。攻击者可枚举邮箱/角色——属信息泄露，迁移 Auth 后可按 `auth.uid()` 限制。
3. **遗留后端 `server/server.js`** 仍有硬编码管理员密码、未鉴权的 `/api/*` 和 `/api/reset` 清库接口。若已不用，建议直接删除；若在用，需独立加固（不在本次兼容式范围内）。

## 验证清单
- [ ] SQL 执行无报错
- [ ] 用原密码能正常登录（明文账号自动迁移为哈希）
- [ ] DevTools 把 localStorage 里 `role` 改成 `admin` 刷新后，仍不能进入 `/users`（因为页面判定基于登录时数据库返回的 role，且 RLS 已禁止提权）
- [ ] 匿名直接调 Supabase API 执行 `update users set role='admin'` 被 RLS 拒绝
- [ ] 注册新账号默认角色为 `user`，无法自设为 `admin`

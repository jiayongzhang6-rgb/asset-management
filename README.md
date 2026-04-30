# 德泽智联IT资产管理系统

基于 React + TypeScript + Supabase 构建的现代化IT资产管理系统。

## 功能特性

### 资产管理
- ✅ 资产列表展示与分页
- ✅ 资产新增、编辑、删除
- ✅ 资产二维码生成与扫描
- ✅ 资产图片上传（最多3张）
- ✅ 维修记录管理
- ✅ 操作历史记录

### 用户管理
- ✅ 用户登录/注册
- ✅ 修改密码
- ✅ 忘记密码（联系管理员重置）
- ✅ 管理员/普通用户权限区分
- ✅ 用户列表管理（管理员）

### 数据管理
- ✅ 批量导入资产（模板下载）
- ✅ 批量导出二维码
- ✅ 批量导出设备信息
- ✅ 资产状态统计

### 权限控制
- ✅ 普通用户：仅可修改资产使用信息（部门、使用人、位置、备注）
- ✅ 管理员：可修改所有资产信息，管理用户，删除资产

## 技术栈

- **前端框架**: React 18 + TypeScript
- **UI样式**: Tailwind CSS 3
- **数据库**: Supabase
- **构建工具**: Vite
- **路由**: React Router

## 快速开始

### 前置要求

- Node.js >= 18
- Supabase 项目（用于数据库存储）

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 部署到 Cloudflare Pages

1. 将项目推送到 GitHub 仓库
2. 登录 Cloudflare 控制台
3. 进入 Pages → 创建项目
4. 选择 GitHub 仓库
5. 配置构建命令：`npm run build`
6. 配置输出目录：`dist`
7. 添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
8. 部署完成

## 使用说明

### 首次使用

1. 注册账号（默认注册为普通用户）
2. 如需管理员权限，请联系系统管理员添加邮箱到管理员列表

### 管理员账号

管理员邮箱列表在 `src/App.tsx` 中配置：

```typescript
const adminEmails = ['your-admin-email@example.com']
```

### 忘记密码

1. 在登录页面点击"忘记密码"
2. 输入邮箱后联系管理员获取临时密码
3. 使用临时密码登录后修改密码

## 项目结构

```
src/
├── components/       # 公共组件
├── lib/             # 工具函数与配置
│   └── supabase.ts  # Supabase 配置
├── pages/           # 页面组件
│   ├── Index.tsx        # 首页（资产列表）
│   ├── AssetDetail.tsx  # 资产详情页
│   ├── Login.tsx        # 登录页面
│   ├── Register.tsx     # 注册页面
│   ├── ChangePassword.tsx # 修改密码
│   ├── Users.tsx        # 用户管理（管理员）
│   ├── OperationHistory.tsx # 操作历史
│   └── Import.tsx       # 批量导入
├── App.tsx          # 主应用组件
├── main.tsx         # 入口文件
└── index.css        # 全局样式
```

## 浏览器兼容性

- Chrome（推荐）
- Firefox
- Edge
- Safari

## License

MIT
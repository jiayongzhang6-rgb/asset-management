# IT资产管理系统

## 使用说明

### 方式一：直接使用（推荐）

1. 直接用浏览器打开 `full-system.html` 文件即可使用
2. 无需安装任何依赖，无需服务器

### 方式二：使用服务器版本

1. 进入 server 目录：`cd server`
2. 安装依赖：`npm install`
3. 启动服务器：`npm start`
4. 浏览器访问：`http://localhost:3000`

## 功能特性

- 资产列表管理
- 新增/编辑/删除资产
- 批量导入/导出
- 登录/注册功能
- 资产二维码生成
- 扫码快速编辑使用信息
- 硬件信息展示（不可修改）
- 使用信息修改（登录后）
- 数据持久化（localStorage）

## 二维码跨网络使用

要让二维码在任何网络环境都能扫描打开，请按以下步骤操作：

1. 将 `full-system.html` 部署到公网服务器（如阿里云、腾讯云、GitHub Pages等）
2. 访问部署后的页面
3. 登录后点击右上角的齿轮图标（设置）
4. 在"部署URL"字段中填入您的部署地址，例如：
   - `https://yourdomain.com/asset.html`
   - `https://username.github.io/asset-management/full-system.html`
5. 点击保存
6. 重新生成的二维码就可以在任何网络环境下扫描打开了

## 部署到 GitHub Pages

1. 将项目上传到 GitHub 仓库
2. 进入仓库 Settings → Pages
3. Source 选择 main 分支
4. 保存后等待部署完成
5. 获取部署地址，填入系统设置中

## 数据备份

系统使用浏览器 localStorage 保存数据，如需备份：
- 打开浏览器开发者工具（F12）
- Application → Local Storage
- 导出 `asset_assets`、`asset_users` 等键的值

## 浏览器兼容性

- Chrome（推荐）
- Firefox
- Edge
- Safari

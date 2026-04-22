# Git 推送脚本
Write-Host "开始执行 Git 命令..."

# 检查 Git 状态
Write-Host "检查 Git 状态..."
git status

# 添加所有修改的文件
Write-Host "添加所有修改的文件..."
git add .

# 提交修改
Write-Host "提交修改..."
git commit -m "fix: 修复资产系统类型不匹配并强制同步数据结构"

# 推送到 GitHub
Write-Host "推送到 GitHub..."
git push origin main --force

Write-Host "执行完成！"

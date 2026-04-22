# Git 推送脚本
Write-Host "开始执行 Git 命令..."

# 检查 Git 状态
Write-Host "检查 Git 状态..."
git status > git-output.txt 2>&1

# 添加所有修改的文件
Write-Host "添加所有修改的文件..."
git add . >> git-output.txt 2>&1

# 提交修改
Write-Host "提交修改..."
git commit -m "修复类型不匹配问题，将Asset的id字段类型从string改为number" >> git-output.txt 2>&1

# 推送到 GitHub
Write-Host "推送到 GitHub..."
git push origin main >> git-output.txt 2>&1

Write-Host "执行完成！输出已保存到 git-output.txt 文件中。"

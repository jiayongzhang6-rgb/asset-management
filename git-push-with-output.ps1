# Git 推送脚本，将输出重定向到文件
$outputFile = "git-output.txt"

# 清空输出文件
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

Write-Host "开始执行 Git 命令..."
Write-Host "输出将保存到 $outputFile 文件中..."

# 检查 Git 状态
Write-Host "检查 Git 状态..."
Start-Process -FilePath "git" -ArgumentList "status" -NoNewWindow -Wait -RedirectStandardOutput $outputFile -RedirectStandardError $outputFile

# 添加所有修改的文件
Write-Host "添加所有修改的文件..."
Start-Process -FilePath "git" -ArgumentList "add", "." -NoNewWindow -Wait -RedirectStandardOutput $outputFile -RedirectStandardError $outputFile

# 提交修改
Write-Host "提交修改..."
Start-Process -FilePath "git" -ArgumentList "commit", "-m", "fix: 修复资产系统类型不匹配并强制同步数据结构" -NoNewWindow -Wait -RedirectStandardOutput $outputFile -RedirectStandardError $outputFile

# 推送到 GitHub
Write-Host "推送到 GitHub..."
Start-Process -FilePath "git" -ArgumentList "push", "origin", "main", "--force" -NoNewWindow -Wait -RedirectStandardOutput $outputFile -RedirectStandardError $outputFile

Write-Host "执行完成！输出已保存到 $outputFile 文件中。"

# 显示输出文件内容
Write-Host "输出内容："
Get-Content $outputFile

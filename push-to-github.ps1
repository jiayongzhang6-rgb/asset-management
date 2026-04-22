# 推送代码到 GitHub 的脚本

# 定义输出文件
$outputFile = "git-output.txt"

# 清空输出文件
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

# 执行 git status 命令
Write-Output "=== Git Status ===" | Out-File -FilePath $outputFile -Append
& git status | Out-File -FilePath $outputFile -Append

# 执行 git add . 命令
Write-Output "\n=== Git Add . ===" | Out-File -FilePath $outputFile -Append
& git add . | Out-File -FilePath $outputFile -Append

# 执行 git commit 命令
Write-Output "\n=== Git Commit ===" | Out-File -FilePath $outputFile -Append
& git commit -m "fix: 修复资产系统类型不匹配并强制同步数据结构" | Out-File -FilePath $outputFile -Append

# 执行 git push 命令
Write-Output "\n=== Git Push ===" | Out-File -FilePath $outputFile -Append
& git push origin main --force | Out-File -FilePath $outputFile -Append

# 显示执行完成
Write-Output "\n=== 执行完成 ===" | Out-File -FilePath $outputFile -Append

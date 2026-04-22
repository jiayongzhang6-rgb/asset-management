@echo off
echo === Git Status === > git-output.txt
git status >> git-output.txt
echo.
echo === Git Add . === >> git-output.txt
git add . >> git-output.txt
echo.
echo === Git Commit === >> git-output.txt
git commit -m "fix: 修复资产系统类型不匹配并强制同步数据结构" >> git-output.txt
echo.
echo === Git Push === >> git-output.txt
git push origin main --force >> git-output.txt
echo.
echo === 执行完成 === >> git-output.txt

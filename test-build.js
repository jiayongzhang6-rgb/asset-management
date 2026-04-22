// 简单的构建测试脚本
const fs = require('fs');
const path = require('path');

// 检查项目文件是否存在
const requiredFiles = [
  'package.json',
  'src/App.tsx',
  'src/main.tsx',
  'vite.config.ts'
];

console.log('检查项目文件...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file} 存在`);
  } else {
    console.log(`✗ ${file} 不存在`);
  }
});

// 检查依赖是否安装
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✓ node_modules 存在');
} else {
  console.log('✗ node_modules 不存在，需要运行 npm install');
}

console.log('测试完成');

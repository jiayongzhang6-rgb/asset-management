const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080; // 使用不同的端口
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initial data
const initialAssets = [
  { id: '1', asset_code: 'PC-2026-0001', brand: 'Lenovo', model: 'ThinkPad X1', cpu: 'Intel Core i7-1165G7', ram: '16GB', storage: '512GB SSD', gpu: 'Intel Iris Xe', os: 'Windows 10 Pro', department: '研发部', user_name: '张伟', location: 'A座301室', status: 'active', notes: '用于开发工作', created_at: '2026-04-15', updated_at: '2026-04-15' },
  { id: '2', asset_code: 'PC-2026-0002', brand: 'ASUS', model: 'ROG Strix', cpu: 'Intel Core i5-14600KF', ram: '32GB', storage: '1TB SSD', gpu: 'NVIDIA RTX 4070', os: 'Windows 11 Pro', department: '设计部', user_name: '李娜', location: 'B座201室', status: 'active', notes: '用于设计工作', created_at: '2026-04-15', updated_at: '2026-04-15' },
  { id: '3', asset_code: 'PC-2026-0003', brand: 'MSI', model: 'GS66 Stealth', cpu: 'Intel Core i5-10400F', ram: '16GB', storage: '512GB SSD', gpu: 'NVIDIA RTX 3060', os: 'Windows 11 Pro', department: '市场部', user_name: '王芳', location: 'C座101室', status: 'idle', notes: '备用设备', created_at: '2026-04-15', updated_at: '2026-04-15' },
  { id: '4', asset_code: 'PC-2026-0004', brand: 'HP', model: 'EliteBook 840 G8', cpu: 'Intel Core i5-1135G7', ram: '8GB', storage: '256GB SSD', gpu: 'Intel Iris Xe', os: 'Windows 10 Pro', department: '行政部', user_name: '赵强', location: 'D座101室', status: 'active', notes: '用于行政工作', created_at: '2026-04-15', updated_at: '2026-04-15' },
  { id: '5', asset_code: 'PC-2026-0005', brand: 'Dell', model: 'XPS 13', cpu: 'Intel Core i7-1185G7', ram: '16GB', storage: '512GB SSD', gpu: 'Intel Iris Xe', os: 'Windows 11 Pro', department: '财务部', user_name: '陈明', location: 'E座101室', status: 'active', notes: '用于财务工作', created_at: '2026-04-15', updated_at: '2026-04-15' }
];

const initialUsers = [
  { id: '1', username: 'admin', password: '747227185@qq.com', email: '747227185@qq.com', role: 'admin' }
];

// Load or initialize data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
  return { assets: initialAssets, users: initialUsers };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving data:', err);
    return false;
  }
}

let db = loadData();

// API Routes

// Get all assets
app.get('/api/assets', (req, res) => {
  res.json(db.assets);
});

// Get single asset
app.get('/api/assets/:id', (req, res) => {
  const asset = db.assets.find(a => a.id === req.params.id);
  if (asset) {
    res.json(asset);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// Create asset
app.post('/api/assets', (req, res) => {
  const asset = {
    id: Date.now().toString(),
    ...req.body,
    created_at: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString().split('T')[0]
  };
  db.assets.push(asset);
  saveData(db);
  res.json(asset);
});

// Update asset
app.put('/api/assets/:id', (req, res) => {
  const index = db.assets.findIndex(a => a.id === req.params.id);
  if (index !== -1) {
    db.assets[index] = {
      ...db.assets[index],
      ...req.body,
      updated_at: new Date().toISOString().split('T')[0]
    };
    saveData(db);
    res.json(db.assets[index]);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// Delete asset
app.delete('/api/assets/:id', (req, res) => {
  const index = db.assets.findIndex(a => a.id === req.params.id);
  if (index !== -1) {
    db.assets.splice(index, 1);
    saveData(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// Batch delete assets
app.post('/api/assets/batch-delete', (req, res) => {
  const { ids } = req.body;
  db.assets = db.assets.filter(a => !ids.includes(a.id));
  saveData(db);
  res.json({ success: true, deleted: ids.length });
});

// Batch import assets
app.post('/api/assets/batch-import', (req, res) => {
  const { assets } = req.body;
  let added = 0;
  let skipped = 0;
  
  assets.forEach(assetData => {
    const exists = db.assets.some(a => a.asset_code === assetData.asset_code);
    if (exists) {
      skipped++;
    } else {
      const asset = {
        id: Date.now().toString() + added,
        ...assetData,
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0]
      };
      db.assets.push(asset);
      added++;
    }
  });
  
  saveData(db);
  res.json({ success: true, added, skipped });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email && u.password === password);
  if (user) {
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Register
app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  const exists = db.users.some(u => u.username === username);
  if (exists) {
    res.status(400).json({ success: false, error: 'Username already exists' });
  } else {
    const user = {
      id: Date.now().toString(),
      username,
      password,
      email: email || '',
      role: 'user'
    };
    db.users.push(user);
    saveData(db);
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  }
});

// Get users
app.get('/api/users', (req, res) => {
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Reset data to initial
app.post('/api/reset', (req, res) => {
  db = { assets: initialAssets, users: initialUsers };
  saveData(db);
  res.json({ success: true });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
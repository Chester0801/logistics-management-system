const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ctms_secret_key_2024_construction';
const DB_PATH = path.join(__dirname, 'database', 'ctms.db');

let db;

// ============================================================
// DATABASE HELPER
// ============================================================
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runSave(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const cols = result[0].columns;
  const vals = result[0].values[0];
  const row = {};
  cols.forEach((col, i) => { row[col] = vals[i]; });
  return row;
}

function all(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const row = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    return row;
  });
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0];
  return lastId ? lastId.values[0][0] : null;
}

function runBatch(sql, params = []) {
  db.run(sql, params);
}

// ============================================================
// INITIALIZE DB
// ============================================================
async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'supervisor',
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS truck_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transportName TEXT NOT NULL,
      driverName TEXT NOT NULL,
      truckNumber TEXT NOT NULL,
      materialType TEXT NOT NULL,
      weight REAL NOT NULL,
      date TEXT NOT NULL,
      timeIn TEXT NOT NULL,
      timeOut TEXT,
      remarks TEXT,
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  
  saveDb();
  
  // Seed admin
  const adminExists = get('SELECT id FROM users WHERE email = ?', ['admin@ctms.com']);
  if (!adminExists) {
    const adminPass = bcrypt.hashSync('admin123', 10);
    runBatch('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['System Admin', 'admin@ctms.com', adminPass, 'admin']);
    const supPass = bcrypt.hashSync('supervisor123', 10);
    runBatch('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Site Supervisor', 'supervisor@ctms.com', supPass, 'supervisor']);
    saveDb();
    console.log('Default users created.');
  }
  
  // Seed sample data
  const entryCount = get('SELECT COUNT(*) as count FROM truck_entries');
  if (!entryCount || entryCount.count === 0) {
    const materials = ['Sand', 'Gravel', 'Cement', 'Steel', 'Bricks', 'Aggregate', 'Concrete Mix'];
    const transports = ['Sharma Transport', 'Kumar Logistics', 'Singh Carriers', 'Patel Transport', 'Mehta & Sons'];
    const drivers = ['Raju Kumar', 'Suresh Singh', 'Mohan Lal', 'Vijay Sharma', 'Ramesh Patel', 'Arun Mehta'];
    const trucks = ['MH-12-AB-1234', 'GJ-01-CD-5678', 'RJ-14-EF-9012', 'UP-32-GH-3456', 'MP-09-IJ-7890', 'HR-26-KL-2345'];
    
    for (let d = 60; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const numEntries = Math.floor(Math.random() * 8) + 3;
      
      for (let i = 0; i < numEntries; i++) {
        const ti = Math.floor(Math.random() * transports.length);
        const di = Math.floor(Math.random() * drivers.length);
        const tri = Math.floor(Math.random() * trucks.length);
        const mi = Math.floor(Math.random() * materials.length);
        const weight = parseFloat((Math.random() * 15 + 5).toFixed(2));
        const hour = Math.floor(Math.random() * 10) + 7;
        const min = Math.floor(Math.random() * 60);
        const timeIn = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
        const outHour = hour + Math.floor(Math.random() * 3) + 1;
        const timeOut = outHour < 22 ? `${String(outHour).padStart(2,'0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}` : null;
        
        runBatch(
          'INSERT INTO truck_entries (transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [transports[ti], drivers[di], trucks[tri], materials[mi], weight, dateStr, timeIn, timeOut, i % 5 === 0 ? 'Urgent delivery' : null, 1]
        );
      }
    }
    saveDb();
    console.log('Sample data seeded.');
  }
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(403).json({ error: 'Invalid token.' }); }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials.' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = get('SELECT id, name, email, role, createdAt FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// ============================================================
// USER ROUTES
// ============================================================
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  res.json(all('SELECT id, name, email, role, createdAt FROM users'));
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required.' });
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role]);
    saveDb();
    res.json({ id, message: 'User created successfully.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists.' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [parseInt(req.params.id)]);
  saveDb();
  res.json({ message: 'User deleted.' });
});

// ============================================================
// DASHBOARD ROUTES
// ============================================================
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  res.json({
    today: get("SELECT COUNT(*) as count, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date = ?", [today]) || {count:0,totalWeight:0},
    week: get("SELECT COUNT(*) as count, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date >= ?", [weekStartStr]) || {count:0,totalWeight:0},
    month: get("SELECT COUNT(*) as count, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date >= ?", [monthStartStr]) || {count:0,totalWeight:0},
    total: get("SELECT COUNT(*) as count, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries") || {count:0,totalWeight:0}
  });
});

app.get('/api/dashboard/recent', authenticateToken, (req, res) => {
  res.json(all("SELECT * FROM truck_entries ORDER BY date DESC, timeIn DESC LIMIT 10"));
});

app.get('/api/dashboard/material-chart', authenticateToken, (req, res) => {
  const monthStart = new Date(); monthStart.setDate(1);
  res.json(all("SELECT materialType, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date >= ? GROUP BY materialType ORDER BY count DESC", [monthStart.toISOString().split('T')[0]]));
});

app.get('/api/dashboard/daily-chart', authenticateToken, (req, res) => {
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  res.json(all("SELECT date, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date >= ? GROUP BY date ORDER BY date", [thirtyAgo.toISOString().split('T')[0]]));
});

app.get('/api/dashboard/transport-chart', authenticateToken, (req, res) => {
  const monthStart = new Date(); monthStart.setDate(1);
  res.json(all("SELECT transportName, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date >= ? GROUP BY transportName ORDER BY count DESC LIMIT 5", [monthStart.toISOString().split('T')[0]]));
});

// ============================================================
// ENTRIES ROUTES
// ============================================================
function buildWhereClause(query) {
  const conditions = [];
  const params = [];
  const { search, transportName, driverName, truckNumber, materialType, date, dateFrom, dateTo } = query;
  
  if (search) {
    conditions.push("(transportName LIKE ? OR driverName LIKE ? OR truckNumber LIKE ? OR materialType LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (transportName) { conditions.push("transportName LIKE ?"); params.push(`%${transportName}%`); }
  if (driverName) { conditions.push("driverName LIKE ?"); params.push(`%${driverName}%`); }
  if (truckNumber) { conditions.push("truckNumber LIKE ?"); params.push(`%${truckNumber}%`); }
  if (materialType) { conditions.push("materialType = ?"); params.push(materialType); }
  if (date) { conditions.push("date = ?"); params.push(date); }
  if (dateFrom) { conditions.push("date >= ?"); params.push(dateFrom); }
  if (dateTo) { conditions.push("date <= ?"); params.push(dateTo); }
  
  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

app.get('/api/entries', authenticateToken, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { where, params } = buildWhereClause(req.query);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const totalRow = get(`SELECT COUNT(*) as count FROM truck_entries ${where}`, params);
  const total = totalRow ? totalRow.count : 0;
  const entries = all(`SELECT * FROM truck_entries ${where} ORDER BY date DESC, timeIn DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
  
  res.json({ entries, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
});

app.get('/api/entries/:id', authenticateToken, (req, res) => {
  const entry = get('SELECT * FROM truck_entries WHERE id = ?', [parseInt(req.params.id)]);
  if (!entry) return res.status(404).json({ error: 'Entry not found.' });
  res.json(entry);
});

app.post('/api/entries', authenticateToken, (req, res) => {
  const { transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks } = req.body;
  if (!transportName || !driverName || !truckNumber || !materialType || !weight || !date || !timeIn)
    return res.status(400).json({ error: 'Required fields missing.' });
  
  try {
    const id = run(
      'INSERT INTO truck_entries (transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [transportName, driverName, truckNumber, materialType, parseFloat(weight), date, timeIn, timeOut || null, remarks || null, req.user.id]
    );
    saveDb();
    res.status(201).json(get('SELECT * FROM truck_entries WHERE id = ?', [id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/entries/:id', authenticateToken, (req, res) => {
  const { transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks } = req.body;
  if (!transportName || !driverName || !truckNumber || !materialType || !weight || !date || !timeIn)
    return res.status(400).json({ error: 'Required fields missing.' });
  
  if (!get('SELECT id FROM truck_entries WHERE id = ?', [parseInt(req.params.id)]))
    return res.status(404).json({ error: 'Entry not found.' });
  
  db.run(
    'UPDATE truck_entries SET transportName=?, driverName=?, truckNumber=?, materialType=?, weight=?, date=?, timeIn=?, timeOut=?, remarks=? WHERE id=?',
    [transportName, driverName, truckNumber, materialType, parseFloat(weight), date, timeIn, timeOut || null, remarks || null, parseInt(req.params.id)]
  );
  saveDb();
  res.json(get('SELECT * FROM truck_entries WHERE id = ?', [parseInt(req.params.id)]));
});

app.delete('/api/entries/:id', authenticateToken, (req, res) => {
  if (!get('SELECT id FROM truck_entries WHERE id = ?', [parseInt(req.params.id)]))
    return res.status(404).json({ error: 'Entry not found.' });
  db.run('DELETE FROM truck_entries WHERE id = ?', [parseInt(req.params.id)]);
  saveDb();
  res.json({ message: 'Entry deleted successfully.' });
});

// ============================================================
// REPORTS
// ============================================================
app.get('/api/reports/daily', authenticateToken, (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  res.json({
    date: targetDate,
    summary: get("SELECT COUNT(*) as truckCount, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date = ?", [targetDate]) || {truckCount:0,totalWeight:0},
    materialSummary: all("SELECT materialType, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date = ? GROUP BY materialType ORDER BY count DESC", [targetDate]),
    transportSummary: all("SELECT transportName, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date = ? GROUP BY transportName ORDER BY count DESC", [targetDate]),
    entries: all("SELECT * FROM truck_entries WHERE date = ? ORDER BY timeIn", [targetDate])
  });
});

app.get('/api/reports/weekly', authenticateToken, (req, res) => {
  const { weekStart } = req.query;
  const startDate = weekStart || (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
  const endDateStr = endDate.toISOString().split('T')[0];
  res.json({
    startDate, endDate: endDateStr,
    summary: get("SELECT COUNT(*) as truckCount, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ?", [startDate, endDateStr]) || {truckCount:0,totalWeight:0},
    dailyBreakdown: all("SELECT date, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date", [startDate, endDateStr]),
    materialSummary: all("SELECT materialType, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY materialType ORDER BY count DESC", [startDate, endDateStr]),
    transportSummary: all("SELECT transportName, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY transportName ORDER BY count DESC", [startDate, endDateStr])
  });
});

app.get('/api/reports/monthly', authenticateToken, (req, res) => {
  const now = new Date();
  const targetYear = parseInt(req.query.year) || now.getFullYear();
  const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);
  const startDate = `${targetYear}-${String(targetMonth).padStart(2,'0')}-01`;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const endDate = `${targetYear}-${String(targetMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  res.json({
    year: targetYear, month: targetMonth, startDate, endDate,
    summary: get("SELECT COUNT(*) as truckCount, COALESCE(TOTAL(weight), 0) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ?", [startDate, endDate]) || {truckCount:0,totalWeight:0},
    dailyBreakdown: all("SELECT date, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date", [startDate, endDate]),
    materialSummary: all("SELECT materialType, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY materialType ORDER BY count DESC", [startDate, endDate]),
    transportSummary: all("SELECT transportName, COUNT(*) as count, TOTAL(weight) as totalWeight FROM truck_entries WHERE date BETWEEN ? AND ? GROUP BY transportName ORDER BY count DESC", [startDate, endDate])
  });
});

// ============================================================
// EXPORT ROUTES
// ============================================================
app.get('/api/export/csv', authenticateToken, (req, res) => {
  const { where, params } = buildWhereClause(req.query);
  const entries = all(`SELECT id, transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks, createdAt FROM truck_entries ${where} ORDER BY date DESC, timeIn DESC`, params);
  const csvHeader = 'ID,Transport Name,Driver Name,Truck Number,Material Type,Weight (Tons),Date,Time In,Time Out,Remarks,Created At\n';
  const csvRows = entries.map(e => `${e.id},"${e.transportName}","${e.driverName}","${e.truckNumber}","${e.materialType}",${e.weight},"${e.date}","${e.timeIn}","${e.timeOut || ''}","${(e.remarks || '').replace(/"/g, '""')}","${e.createdAt}"`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="truck_entries_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvHeader + csvRows);
});

app.get('/api/export/excel', authenticateToken, (req, res) => {
  const { where, params } = buildWhereClause(req.query);
  const entries = all(`SELECT id, transportName, driverName, truckNumber, materialType, weight, date, timeIn, timeOut, remarks, createdAt FROM truck_entries ${where} ORDER BY date DESC, timeIn DESC`, params);
  const wsData = [
    ['ID', 'Transport Name', 'Driver Name', 'Truck Number', 'Material Type', 'Weight (Tons)', 'Date', 'Time In', 'Time Out', 'Remarks', 'Created At'],
    ...entries.map(e => [e.id, e.transportName, e.driverName, e.truckNumber, e.materialType, e.weight, e.date, e.timeIn, e.timeOut || '', e.remarks || '', e.createdAt])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Truck Entries');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="truck_entries_${new Date().toISOString().split('T')[0]}.xlsx"`);
  res.send(buffer);
});

// ============================================================
// MISC ROUTES
// ============================================================
app.get('/api/material-types', authenticateToken, (req, res) => {
  res.json(all("SELECT DISTINCT materialType FROM truck_entries ORDER BY materialType").map(r => r.materialType));
});

app.get('/api/transport-names', authenticateToken, (req, res) => {
  res.json(all("SELECT DISTINCT transportName FROM truck_entries ORDER BY transportName").map(r => r.transportName));
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START SERVER
// ============================================================
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚛 Construction Transport Management System`);
    console.log(`📍 Server running at http://localhost:${PORT}`);
    console.log(`\n👤 Default Credentials:`);
    console.log(`   Admin:      admin@ctms.com / admin123`);
    console.log(`   Supervisor: supervisor@ctms.com / supervisor123\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

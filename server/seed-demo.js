const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'lion_heart.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migration first
const migration = fs.readFileSync(path.join(__dirname, 'migrations/001_initial.sql'), 'utf8');
db.exec(migration);
console.log('Migration executed');

// Reset all passwords to admin123
const hash = bcrypt.hashSync('admin123', 10);
db.prepare('UPDATE users SET password_hash = ?').run(hash);
console.log('All passwords set to: admin123');
console.log('Login: admin / admin123');
console.log('Manager PIN: 1234');

// Add extra demo users
const extraUsers = [
  { id: 'mgr001', username: 'manager', full_name: 'Store Manager', role: 'manager', pin: '5678' },
  { id: 'csr001', username: 'cashier1', full_name: 'Ama Cashier', role: 'cashier', pin: '1111' },
  { id: 'csr002', username: 'cashier2', full_name: 'Kofi Cashier', role: 'cashier', pin: '2222' },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, pin) VALUES (?, ?, ?, ?, ?, ?)');
for (const u of extraUsers) {
  insertUser.run(u.id, u.username, hash, u.full_name, u.role, u.pin);
}
console.log(`Created ${extraUsers.length} extra demo users (all password: admin123)`);

// Verify
const users = db.prepare('SELECT username, role, is_active FROM users').all();
console.log('\nUsers in database:');
users.forEach(u => console.log('  ' + u.username + ' (' + u.role + ') active=' + u.is_active));

const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
const suppliers = db.prepare('SELECT COUNT(*) as count FROM suppliers').get();
console.log('\nData: ' + products.count + ' products, ' + categories.count + ' categories, ' + suppliers.count + ' suppliers');

db.close();
console.log('\nDemo database ready!');

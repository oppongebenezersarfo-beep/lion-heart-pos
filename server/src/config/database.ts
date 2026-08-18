import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, readFileSync, existsSync } from 'fs';

// Use DB_PATH env var for persistent storage (Railway volume), or default to local path
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/lion_heart.db');
const dbDir = path.dirname(dbPath);
mkdirSync(dbDir, { recursive: true });

console.log(`Database path: ${dbPath}`);

const sqliteDb = new Database(dbPath);
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

// Auto-run migration on first run
const migrationPath = path.join(__dirname, '../../migrations/001_initial.sql');
if (existsSync(migrationPath)) {
  const tableCheck = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!tableCheck) {
    console.log('Running initial migration...');
    const migration = readFileSync(migrationPath, 'utf8');
    sqliteDb.exec(migration);
    console.log('Migration complete');
  }
}

// Auto-run transactions migration
const txMigrationPath = path.join(__dirname, '../../migrations/002_transactions.sql');
if (existsSync(txMigrationPath)) {
  const txCheck = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").get();
  if (!txCheck) {
    console.log('Running transactions migration...');
    const txMigration = readFileSync(txMigrationPath, 'utf8');
    sqliteDb.exec(txMigration);
    console.log('Transactions migration complete');
  } else {
    // Add access_code column if it doesn't exist
    const colCheck = sqliteDb.prepare("SELECT name FROM pragma_table_info('transactions') WHERE name='access_code'").get();
    if (!colCheck) {
      console.log('Adding access_code column to transactions...');
      sqliteDb.exec("ALTER TABLE transactions ADD COLUMN access_code TEXT");
    }
  }
}

// Auto-run price_history migration
const priceHistoryPath = path.join(__dirname, '../../migrations/003_price_history.sql');
if (existsSync(priceHistoryPath)) {
  const phCheck = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'").get();
  if (!phCheck) {
    console.log('Running price_history migration...');
    const phMigration = readFileSync(priceHistoryPath, 'utf8');
    sqliteDb.exec(phMigration);
    console.log('Price history migration complete');
  }
}

function transformSQL(sql: string): string {
  return sql
    .replace(/\$\d+/g, () => '?')
    .replace(/::jsonb/g, '')
    .replace(/jsonb/g, 'text')
    .replace(/DATE_TRUNC\('month', NOW\(\)\)/g, "date('now', 'start of month')")
    .replace(/NOW\(\)/g, "datetime('now')")
    .replace(/ILIKE/g, 'LIKE')
    .replace(/- INTERVAL '(\d+) days'/g, (_: string, days: string) => `- ${days} days`);
}

function runQuery(sql: string, params: any[] = []): { rows: any[]; rowCount: number; lastID?: number | bigint } {
  const sqliteSQL = transformSQL(sql);
  const trimmed = sqliteSQL.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    const rows = sqliteDb.prepare(sqliteSQL).all(...params) as any[];
    return { rows, rowCount: rows.length };
  }
  const result = sqliteDb.prepare(sqliteSQL).run(...params);
  return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
}

function runTransaction(fn: () => any): any {
  const transaction = sqliteDb.transaction(fn);
  return transaction();
}

const pool: {
  query: typeof runQuery;
  exec: (sql: string) => void;
  transaction: typeof runTransaction;
} = {
  query: runQuery,
  exec: (sql: string) => { sqliteDb.exec(sql); },
  transaction: runTransaction,
};

export default pool;

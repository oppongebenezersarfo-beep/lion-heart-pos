import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, readFileSync, existsSync } from 'fs';

const dbPath = path.join(__dirname, '../../data/lion_heart.db');
const dbDir = path.dirname(dbPath);
mkdirSync(dbDir, { recursive: true });

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

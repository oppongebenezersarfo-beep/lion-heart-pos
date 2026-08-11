import { readFileSync } from 'fs';
import { join } from 'path';
import db from './database';

async function migrate() {
  try {
    const migrationPath = join(__dirname, '../../migrations/001_initial.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    db.exec(sql);
    console.log('Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

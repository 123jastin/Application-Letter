import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || path.join(__dirname, '../../data/jobsreport.db');

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('✅ SQLite connected:', DB_PATH);

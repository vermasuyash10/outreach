import path from 'node:path';
import Database from 'better-sqlite3';
import { applySchema } from './schema';
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from '../scoring/defaults';

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  return process.env.QUALIFY_DB_PATH || path.join(process.cwd(), 'data', 'outreach.db');
}

/** Lazily opens (and schema-initializes) a singleton SQLite connection. */
export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  applySchema(db);
  seedDefaultSettings(db);

  dbInstance = db;
  return db;
}

function seedDefaultSettings(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM settings LIMIT 1').get();
  if (existing) return;

  db.prepare(
    'INSERT INTO settings (scoring_weights, thresholds) VALUES (?, ?)'
  ).run(JSON.stringify(DEFAULT_WEIGHTS), JSON.stringify(DEFAULT_THRESHOLDS));
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

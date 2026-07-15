import type Database from 'better-sqlite3';

/**
 * Schema is applied idempotently on every connection so the CLI script and
 * the Next.js app can both open the DB file without a separate migration step.
 */
export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      niche_keywords TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      status_code INTEGER,
      is_live INTEGER NOT NULL DEFAULT 0,
      relevance_score REAL,
      outbound_link_count INTEGER,
      has_blog INTEGER NOT NULL DEFAULT 0,
      has_guest_post_page INTEGER NOT NULL DEFAULT 0,
      guest_post_url TEXT,
      discovered_emails TEXT NOT NULL DEFAULT '[]',
      spam_flags TEXT NOT NULL DEFAULT '[]',
      fit_score REAL,
      is_qualified INTEGER NOT NULL DEFAULT 0,
      qualification_reasons TEXT NOT NULL DEFAULT '[]',
      dr REAL,
      monthly_traffic INTEGER,
      already_contacted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_prospects_run_id ON prospects(run_id);
    CREATE INDEX IF NOT EXISTS idx_prospects_domain ON prospects(domain);

    CREATE TABLE IF NOT EXISTS contacted (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      contacted_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scoring_weights TEXT NOT NULL,
      thresholds TEXT NOT NULL
    );
  `);
}

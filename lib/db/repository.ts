import { getDb } from './index';
import type { ScoringConfig } from '../scoring/types';
import type { ProspectSignals } from '../scoring/types';
import type { ScoringResult } from '../scoring/types';

export interface RunRecord {
  id: number;
  created_at: string;
  niche_keywords: string;
  notes: string | null;
}

export function createRun(nicheKeywords: string[], notes?: string): RunRecord {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO runs (niche_keywords, notes) VALUES (?, ?)')
    .run(nicheKeywords.join(','), notes ?? null);
  return db
    .prepare('SELECT * FROM runs WHERE id = ?')
    .get(info.lastInsertRowid) as RunRecord;
}

export function getScoringConfig(): ScoringConfig {
  const db = getDb();
  const row = db
    .prepare('SELECT scoring_weights, thresholds FROM settings ORDER BY id DESC LIMIT 1')
    .get() as { scoring_weights: string; thresholds: string } | undefined;

  if (!row) {
    throw new Error('No settings row found; getDb() should have seeded defaults.');
  }

  return {
    weights: JSON.parse(row.scoring_weights),
    thresholds: JSON.parse(row.thresholds),
  };
}

export function isAlreadyContacted(domain: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM contacted WHERE domain = ?').get(domain);
  return !!row;
}

export interface ProspectInsert {
  runId: number;
  signals: ProspectSignals;
  scoring: ScoringResult;
}

export function insertProspect({ runId, signals, scoring }: ProspectInsert): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO prospects (
        run_id, domain, status_code, is_live, relevance_score,
        outbound_link_count, has_blog, has_guest_post_page, guest_post_url,
        discovered_emails, spam_flags, fit_score, is_qualified,
        qualification_reasons, dr, monthly_traffic, already_contacted
      ) VALUES (
        @runId, @domain, @statusCode, @isLive, @relevanceScore,
        @outboundLinkCount, @hasBlog, @hasGuestPostPage, @guestPostUrl,
        @discoveredEmails, @spamFlags, @fitScore, @isQualified,
        @qualificationReasons, @dr, @monthlyTraffic, @alreadyContacted
      )`
    )
    .run({
      runId,
      domain: signals.domain,
      statusCode: signals.statusCode,
      isLive: signals.isLive ? 1 : 0,
      relevanceScore: signals.relevanceScore,
      outboundLinkCount: signals.outboundLinkCount,
      hasBlog: signals.hasBlog ? 1 : 0,
      hasGuestPostPage: signals.hasGuestPostPage ? 1 : 0,
      guestPostUrl: signals.guestPostUrl,
      discoveredEmails: JSON.stringify(signals.discoveredEmails),
      spamFlags: JSON.stringify(signals.spamFlags),
      fitScore: scoring.fitScore,
      isQualified: scoring.isQualified ? 1 : 0,
      qualificationReasons: JSON.stringify(scoring.qualificationReasons),
      dr: signals.dr,
      monthlyTraffic: signals.monthlyTraffic,
      alreadyContacted: signals.alreadyContacted ? 1 : 0,
    });

  return Number(info.lastInsertRowid);
}

export interface ProspectRow {
  id: number;
  run_id: number;
  domain: string;
  status_code: number | null;
  is_live: number;
  relevance_score: number | null;
  outbound_link_count: number | null;
  has_blog: number;
  has_guest_post_page: number;
  guest_post_url: string | null;
  discovered_emails: string;
  spam_flags: string;
  fit_score: number | null;
  is_qualified: number;
  qualification_reasons: string;
  dr: number | null;
  monthly_traffic: number | null;
  already_contacted: number;
  created_at: string;
}

export function getProspectsForRun(runId: number): ProspectRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM prospects WHERE run_id = ? ORDER BY fit_score DESC')
    .all(runId) as ProspectRow[];
}

export function getAllProspects(limit = 200): ProspectRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM prospects ORDER BY id DESC LIMIT ?')
    .all(limit) as ProspectRow[];
}

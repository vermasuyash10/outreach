import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';
import { enrichDomain } from '../lib/enrichment/pipeline';
import { scoreProspect } from '../lib/scoring/score';
import { createRun, getScoringConfig, insertProspect, isAlreadyContacted } from '../lib/db/repository';
import { closeDb } from '../lib/db';
import type { ProspectSignals } from '../lib/scoring/types';

interface CliArgs {
  csvPath: string;
  keywords: string[];
  notes?: string;
  concurrency: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      args[key] = value;
      i += value === 'true' ? 0 : 1;
    }
  }

  const csvPath = args.csv ?? 'sample-domains.csv';
  const keywordsRaw = args.keywords;
  if (!keywordsRaw) {
    console.error(
      'Usage: npm run qualify -- --csv sample-domains.csv --keywords "keyword one,keyword two" [--notes "..."] [--concurrency 5]'
    );
    process.exit(1);
  }

  return {
    csvPath,
    keywords: keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean),
    notes: args.notes,
    concurrency: args.concurrency ? Number(args.concurrency) : 5,
  };
}

function readDomainsFromCsv(csvPath: string): string[] {
  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');

  return raw
    .split(/\r?\n/)
    .map((line) => line.split(',')[0].trim())
    .filter((domain) => domain.length > 0 && domain.toLowerCase() !== 'domain');
}

function printSummaryTable(
  rows: { domain: string; fitScore: number; isQualified: boolean; topReason: string }[]
): void {
  const sorted = [...rows].sort((a, b) => b.fitScore - a.fitScore);

  console.log('\n=== Prospect Qualification Summary ===\n');
  console.table(
    sorted.map((row) => ({
      Domain: row.domain,
      'Fit Score': row.fitScore,
      Qualified: row.isQualified ? 'YES' : 'no',
      'Top Reason': row.topReason,
    }))
  );

  const qualifiedCount = sorted.filter((r) => r.isQualified).length;
  console.log(`\n${qualifiedCount} of ${sorted.length} domains qualified.\n`);
}

async function main(): Promise<void> {
  const { csvPath, keywords, notes, concurrency } = parseArgs(process.argv.slice(2));

  const domains = readDomainsFromCsv(csvPath);
  if (domains.length === 0) {
    console.error(`No domains found in ${csvPath}`);
    process.exit(1);
  }

  console.log(`Loaded ${domains.length} domain(s) from ${csvPath}`);
  console.log(`Niche keywords: ${keywords.join(', ')}`);

  const run = createRun(keywords, notes);
  const scoringConfig = getScoringConfig();
  const limit = pLimit(concurrency);

  const summaryRows: { domain: string; fitScore: number; isQualified: boolean; topReason: string }[] =
    [];

  const tasks = domains.map((domain) =>
    limit(async () => {
      console.log(`Enriching ${domain}...`);
      let enrichment;
      try {
        enrichment = await enrichDomain(domain, keywords);
      } catch (err) {
        console.error(`  Failed to enrich ${domain}:`, (err as Error).message);
        enrichment = {
          domain,
          isLive: false,
          statusCode: null,
          relevanceScore: null,
          outboundLinkCount: null,
          hasBlog: false,
          hasGuestPostPage: false,
          guestPostUrl: null,
          discoveredEmails: [],
          spamFlags: [],
          dr: null,
          monthlyTraffic: null,
        };
      }

      const signals: ProspectSignals = {
        ...enrichment,
        alreadyContacted: isAlreadyContacted(domain),
      };

      const scoring = scoreProspect(signals, scoringConfig);
      insertProspect({ runId: run.id, signals, scoring });

      summaryRows.push({
        domain,
        fitScore: scoring.fitScore,
        isQualified: scoring.isQualified,
        topReason: scoring.qualificationReasons[0] ?? '',
      });
    })
  );

  await Promise.all(tasks);

  printSummaryTable(summaryRows);
  closeDb();
}

main().catch((err) => {
  console.error('Fatal error running qualify script:', err);
  process.exit(1);
});

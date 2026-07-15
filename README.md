# Outreach Prospect Qualifier

Phase 1 of a pre-outreach prospect qualification tool: an enrichment + scoring
engine that turns a list of domains into ranked, qualified guest-post/outreach
prospects. No polished UI yet — the primary interface is the `qualify` CLI
script, plus a minimal Next.js page that lists whatever is in the database.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- SQLite via `better-sqlite3`
- `cheerio` for HTML parsing
- `p-limit` for concurrency control
- `vitest` for unit tests

## Setup

```bash
npm install
```

This creates `data/outreach.db` (SQLite file, git-ignored) on first run, with
schema and default scoring settings seeded automatically.

## Running the qualification pipeline

```bash
npm run qualify -- --csv sample-domains.csv --keywords "seo,content marketing,blogging" --notes "first test run"
```

Flags:

- `--csv` — path to a CSV with a single `domain` column (defaults to `sample-domains.csv`)
- `--keywords` — comma-separated niche keywords used for relevance scoring (required)
- `--notes` — optional free-text note stored on the run record
- `--concurrency` — max domains enriched in parallel (default `5`)

The script will:

1. Create a `runs` row for this batch.
2. For each domain (bounded concurrency, 10s timeout per request, robots.txt
   respected): fetch the homepage plus `/contact`, `/about`, `/write-for-us`,
   `/contribute`, `/blog`, and extract free signals (relevance, outbound
   links, blog detection, guest-post page detection, emails, spam flags).
3. Score each prospect with the pure scoring function using the weights/
   thresholds stored in the `settings` table.
4. Write everything to `prospects` and print a ranked summary table to the
   console.

A single unreachable/dead domain is caught and recorded as `is_live: false`
rather than crashing the run.

## Viewing results

```bash
npm run dev
```

Then open http://localhost:3000 — it lists the most recent prospects from
the database (read-only for now).

## Running tests

```bash
npm test
```

Covers the scoring function (`lib/scoring/score.ts`) and email extraction
(`lib/enrichment/signals.ts`).

## Project layout

```
lib/
  db/            SQLite connection, schema, repository helpers
  enrichment/    robots.txt-aware fetcher, cheerio signal extraction, pipeline
  scoring/       types, default weights/thresholds, pure scoreProspect()
scripts/
  qualify.ts     CLI entrypoint (npm run qualify)
app/
  page.tsx       minimal read-only prospect table
tests/
  scoring.test.ts
  emailExtraction.test.ts
sample-domains.csv
```

## Data model (SQLite)

- **runs** — one row per `qualify` invocation (`niche_keywords`, `notes`).
- **prospects** — one row per domain per run, with all enrichment signals and
  scoring output (`fit_score`, `is_qualified`, `qualification_reasons`, plus
  placeholder `dr` / `monthly_traffic` columns).
- **contacted** — domains already reached out to, for outreach dedupe. Any
  domain in this table scores `already_contacted: true` and is
  auto-disqualified.
- **settings** — `scoring_weights` and `thresholds` JSON blobs; a default row
  is seeded automatically on first connection.

## Extending with paid data (DR / traffic)

`lib/enrichment/dataProvider.ts` defines a `PaidDataProvider` interface:

```ts
interface PaidDataProvider {
  name: string;
  getDomainMetrics(domain: string): Promise<{ dr: number | null; monthlyTraffic: number | null }>;
}
```

Only `NullPaidDataProvider` (returns `null` for both fields) is wired in today
— no paid API is called. To add a real provider (Ahrefs, Moz, SEMrush, etc.),
implement the interface and pass it into `enrichDomain(domain, keywords, { paidDataProvider })`
in `scripts/qualify.ts`.

## Scoring

`lib/scoring/score.ts` exports a pure `scoreProspect(signals, config)` function:
no I/O, deterministic, fully unit-testable. It combines relevance, guest-post/
blog/email presence, and outbound-link "friendliness" into a 0-100 raw score,
then applies flat penalties for spam flags, dead sites, and domains already
contacted, producing `fitScore`, `isQualified`, and a list of human-readable
`qualificationReasons`. Weights and thresholds live in the `settings` table
(`lib/scoring/defaults.ts` has the defaults used to seed it).

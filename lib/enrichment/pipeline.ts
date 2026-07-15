import { resolveOrigin, fetchPage } from './fetcher';
import {
  loadHtml,
  extractVisibleText,
  extractEmails,
  computeRelevanceScore,
  countOutboundLinks,
  detectHasBlog,
  detectGuestPostPage,
  detectSpamFlags,
} from './signals';
import { NullPaidDataProvider, type PaidDataProvider } from './dataProvider';
import type { ProspectSignals } from '../scoring/types';

const LIKELY_PAGES = ['/contact', '/about', '/write-for-us', '/contribute', '/blog'];
const DEFAULT_MAX_OUTBOUND_LINKS_BEFORE_SPAM = 150;

export type EnrichmentResult = Omit<ProspectSignals, 'alreadyContacted'>;

export interface EnrichOptions {
  timeoutMs?: number;
  paidDataProvider?: PaidDataProvider;
  maxOutboundLinksBeforeSpam?: number;
}

function deadSignals(domain: string, statusCode: number | null): EnrichmentResult {
  return {
    domain,
    isLive: false,
    statusCode,
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

/**
 * Enriches a single domain: fetches the homepage plus a handful of likely
 * pages, extracts free signals, and never throws — a dead/unreachable domain
 * simply comes back with isLive: false so a batch run can keep going.
 */
export async function enrichDomain(
  domain: string,
  nicheKeywords: string[],
  options: EnrichOptions = {}
): Promise<EnrichmentResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxOutboundLinksBeforeSpam =
    options.maxOutboundLinksBeforeSpam ?? DEFAULT_MAX_OUTBOUND_LINKS_BEFORE_SPAM;
  const paidDataProvider = options.paidDataProvider ?? new NullPaidDataProvider();

  try {
    const resolved = await resolveOrigin(domain, timeoutMs);
    if (!resolved) {
      return deadSignals(domain, null);
    }

    const { origin, homepage } = resolved;
    if (!homepage.html) {
      return deadSignals(domain, homepage.statusCode);
    }

    const ownHost = new URL(origin).hostname;
    const $home = loadHtml(homepage.html);

    const outboundLinkCount = countOutboundLinks($home, ownHost);
    const hasBlog = detectHasBlog($home);
    const guestPostFromHome = detectGuestPostPage($home, origin);

    const subPageTexts: string[] = [extractVisibleText($home)];
    const emailSources: string[] = [homepage.html];

    let hasGuestPostPage = guestPostFromHome.hasGuestPostPage;
    let guestPostUrl = guestPostFromHome.guestPostUrl;
    let hasBlogPage = false;

    for (const path of LIKELY_PAGES) {
      const page = await fetchPage(origin, path, timeoutMs);
      if (!page.ok || !page.html) continue;

      if (path === '/blog') hasBlogPage = true;

      const $page = loadHtml(page.html);
      subPageTexts.push(extractVisibleText($page));
      emailSources.push(page.html);

      if (!hasGuestPostPage) {
        const detection = detectGuestPostPage($page, page.url);
        if (detection.hasGuestPostPage) {
          hasGuestPostPage = true;
          guestPostUrl = detection.guestPostUrl ?? page.url;
        }
      }
    }

    const combinedText = subPageTexts.join(' ');
    const relevanceScore = computeRelevanceScore(combinedText, nicheKeywords);
    const discoveredEmails = [...new Set(emailSources.flatMap((html) => extractEmails(html)))];
    const spamFlags = detectSpamFlags(combinedText, outboundLinkCount, maxOutboundLinksBeforeSpam);

    const paidMetrics = await paidDataProvider.getDomainMetrics(domain);

    return {
      domain,
      isLive: true,
      statusCode: homepage.statusCode,
      relevanceScore,
      outboundLinkCount,
      hasBlog: hasBlog || hasBlogPage,
      hasGuestPostPage,
      guestPostUrl,
      discoveredEmails,
      spamFlags,
      dr: paidMetrics.dr,
      monthlyTraffic: paidMetrics.monthlyTraffic,
    };
  } catch {
    return deadSignals(domain, null);
  }
}

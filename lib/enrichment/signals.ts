import * as cheerio from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp)$/i;
const PLACEHOLDER_DOMAINS = ['example.com', 'domain.com', 'yourdomain.com', 'sentry.io'];

const GUEST_POST_PHRASES = [
  'write for us',
  'guest post',
  'guest posting',
  'guest author',
  'contribute',
  'contributor guidelines',
  'submit a post',
  'submit an article',
  'become a contributor',
];

const BLOG_PHRASES = ['blog', 'articles', 'news', 'insights', 'resources'];

const SPAM_KEYWORDS = [
  'casino',
  'gambling',
  'slot machine',
  'poker online',
  'viagra',
  'cialis',
  'pharmacy online',
  'payday loan',
  'cash advance',
  'bad credit loan',
];

/** Loads HTML into cheerio, tolerating malformed markup. */
export function loadHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

/** Extracts a plausible page title + visible body text for keyword/spam scanning. */
export function extractVisibleText($: cheerio.CheerioAPI): string {
  $('script, style, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

/** Regex + mailto extraction from a page's HTML, deduped and filtered for placeholders. */
export function extractEmails(html: string): string[] {
  const $ = loadHtml(html);
  const found = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const address = href.replace(/^mailto:/i, '').split('?')[0].trim();
    if (address) found.add(address.toLowerCase());
  });

  const bodyText = extractVisibleText(cheerio.load(html));
  const matches = bodyText.match(EMAIL_REGEX) ?? [];
  for (const match of matches) {
    found.add(match.toLowerCase());
  }

  return [...found].filter(
    (email) =>
      !IMAGE_EXTENSIONS.test(email) &&
      !PLACEHOLDER_DOMAINS.some((placeholder) => email.endsWith(`@${placeholder}`))
  );
}

/** Simple term-frequency relevance score, normalized 0-100. */
export function computeRelevanceScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\W+/).filter(Boolean);
  const totalWords = words.length || 1;

  let hits = 0;
  for (const keyword of keywords) {
    const term = keyword.trim().toLowerCase();
    if (!term) continue;
    if (term.includes(' ')) {
      const occurrences = normalizedText.split(term).length - 1;
      hits += occurrences;
    } else {
      hits += words.filter((w) => w === term).length;
    }
  }

  const frequency = hits / totalWords;
  // Scale so that ~2% keyword density maps to 100; clamp to [0, 100].
  const score = Math.min(100, Math.round((frequency / 0.02) * 100));
  return score;
}

/** Counts anchor tags whose hostname differs from the site's own host. */
export function countOutboundLinks($: cheerio.CheerioAPI, ownHost: string): number {
  let count = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const url = new URL(href, `https://${ownHost}`);
      if (url.hostname && url.hostname !== ownHost && !url.hostname.endsWith(`.${ownHost}`)) {
        count += 1;
      }
    } catch {
      // ignore unparsable hrefs (mailto:, tel:, javascript:, etc.)
    }
  });
  return count;
}

export function detectHasBlog($: cheerio.CheerioAPI): boolean {
  let found = false;
  $('a[href], nav a').each((_, el) => {
    const href = ($(el).attr('href') ?? '').toLowerCase();
    const text = $(el).text().toLowerCase().trim();
    if (BLOG_PHRASES.some((phrase) => href.includes(`/${phrase}`) || text === phrase)) {
      found = true;
    }
  });
  return found;
}

export interface GuestPostDetection {
  hasGuestPostPage: boolean;
  guestPostUrl: string | null;
}

export function detectGuestPostPage(
  $: cheerio.CheerioAPI,
  baseUrl: string
): GuestPostDetection {
  let guestPostUrl: string | null = null;

  $('a[href]').each((_, el) => {
    if (guestPostUrl) return;
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().toLowerCase().trim();
    const combined = `${href.toLowerCase()} ${text}`;
    if (GUEST_POST_PHRASES.some((phrase) => combined.includes(phrase))) {
      try {
        guestPostUrl = new URL(href, baseUrl).toString();
      } catch {
        guestPostUrl = href;
      }
    }
  });

  if (!guestPostUrl) {
    const bodyText = extractVisibleText($).toLowerCase();
    if (GUEST_POST_PHRASES.some((phrase) => bodyText.includes(phrase))) {
      return { hasGuestPostPage: true, guestPostUrl: baseUrl };
    }
  }

  return { hasGuestPostPage: guestPostUrl !== null, guestPostUrl };
}

export function detectSpamFlags(
  text: string,
  outboundLinkCount: number,
  maxOutboundLinksBeforeSpam: number
): string[] {
  const flags: string[] = [];
  const lowerText = text.toLowerCase();

  const matchedKeywords = SPAM_KEYWORDS.filter((keyword) => lowerText.includes(keyword));
  if (matchedKeywords.length > 0) {
    flags.push(`spam keywords: ${matchedKeywords.join(', ')}`);
  }

  if (outboundLinkCount >= maxOutboundLinksBeforeSpam) {
    flags.push('excessive outbound links (possible link farm)');
  }

  const sponsoredHits = (lowerText.match(/sponsored post/g) ?? []).length;
  if (sponsoredHits >= 3) {
    flags.push('heavy "sponsored post" language');
  }

  return flags;
}

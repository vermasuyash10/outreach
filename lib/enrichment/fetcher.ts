import { USER_AGENT, isAllowedByRobots } from './robots';

export interface PageFetchResult {
  url: string;
  ok: boolean;
  statusCode: number | null;
  html: string | null;
  blockedByRobots: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetches a single path on a domain, respecting robots.txt and a hard timeout.
 * Never throws — network/timeout/robots failures are reported in the result
 * so one dead domain can't crash a batch run.
 */
export async function fetchPage(
  origin: string,
  pathname: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PageFetchResult> {
  const url = `${origin}${pathname}`;

  const allowed = await isAllowedByRobots(origin, pathname, timeoutMs);
  if (!allowed) {
    return { url, ok: false, statusCode: null, html: null, blockedByRobots: true };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { url, ok: false, statusCode: res.status, html: null, blockedByRobots: false };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('xml') && contentType !== '') {
      return { url, ok: true, statusCode: res.status, html: null, blockedByRobots: false };
    }

    const html = await res.text();
    return { url, ok: true, statusCode: res.status, html, blockedByRobots: false };
  } catch {
    return { url, ok: false, statusCode: null, html: null, blockedByRobots: false };
  }
}

/** Tries https first, falling back to http, for a homepage fetch. Returns the origin that worked. */
export async function resolveOrigin(
  domain: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ origin: string; homepage: PageFetchResult } | null> {
  const bareDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  for (const scheme of ['https', 'http']) {
    const origin = `${scheme}://${bareDomain}`;
    const homepage = await fetchPage(origin, '/', timeoutMs);
    if (homepage.ok) {
      return { origin, homepage };
    }
  }

  return null;
}

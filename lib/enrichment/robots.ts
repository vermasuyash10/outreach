export const USER_AGENT = 'OutreachQualifierBot/0.1 (+https://github.com/vermasuyash10/outreach)';

interface RobotsRule {
  disallow: string[];
  allow: string[];
}

/** Very small robots.txt parser: enough to respect Disallow/Allow for our UA and '*'. */
function parseRobots(text: string): RobotsRule {
  const lines = text.split(/\r?\n/);
  let matchesUs = false;
  let matchesWildcard = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  let activeGroup = false;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      const ua = value.toLowerCase();
      if (ua === '*') {
        matchesWildcard = true;
        activeGroup = true;
      } else if (USER_AGENT.toLowerCase().includes(ua)) {
        matchesUs = true;
        activeGroup = true;
      } else {
        activeGroup = false;
      }
      continue;
    }

    if (!activeGroup) continue;

    if (key === 'disallow' && value) {
      disallow.push(value);
    } else if (key === 'allow' && value) {
      allow.push(value);
    }
  }

  if (!matchesUs && !matchesWildcard) {
    return { disallow: [], allow: [] };
  }

  return { disallow, allow };
}

const robotsCache = new Map<string, RobotsRule | null>();

async function fetchRobots(origin: string, timeoutMs: number): Promise<RobotsRule | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timer);

    if (!res.ok) {
      robotsCache.set(origin, null);
      return null;
    }

    const text = await res.text();
    const rules = parseRobots(text);
    robotsCache.set(origin, rules);
    return rules;
  } catch {
    robotsCache.set(origin, null);
    return null;
  }
}

/** Returns true if we're allowed to fetch `pathname` on `origin` per robots.txt. */
export async function isAllowedByRobots(
  origin: string,
  pathname: string,
  timeoutMs: number
): Promise<boolean> {
  const rules = await fetchRobots(origin, timeoutMs);
  if (!rules) return true;

  const matchingAllow = rules.allow.filter((rule) => pathname.startsWith(rule));
  const matchingDisallow = rules.disallow.filter((rule) => pathname.startsWith(rule));

  if (matchingDisallow.length === 0) return true;

  const longestAllow = Math.max(0, ...matchingAllow.map((r) => r.length));
  const longestDisallow = Math.max(0, ...matchingDisallow.map((r) => r.length));
  return longestAllow >= longestDisallow;
}

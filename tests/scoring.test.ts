import { describe, expect, it } from 'vitest';
import { scoreProspect } from '../lib/scoring/score';
import { DEFAULT_SCORING_CONFIG } from '../lib/scoring/defaults';
import type { ProspectSignals } from '../lib/scoring/types';

function baseSignals(overrides: Partial<ProspectSignals> = {}): ProspectSignals {
  return {
    domain: 'example-test.com',
    isLive: true,
    statusCode: 200,
    relevanceScore: 0,
    outboundLinkCount: 0,
    hasBlog: false,
    hasGuestPostPage: false,
    guestPostUrl: null,
    discoveredEmails: [],
    spamFlags: [],
    dr: null,
    monthlyTraffic: null,
    alreadyContacted: false,
    ...overrides,
  };
}

describe('scoreProspect', () => {
  it('scores a strong prospect as qualified with positive reasons', () => {
    const signals = baseSignals({
      relevanceScore: 90,
      hasGuestPostPage: true,
      hasBlog: true,
      discoveredEmails: ['editor@example-test.com'],
      outboundLinkCount: 10,
    });

    const result = scoreProspect(signals, DEFAULT_SCORING_CONFIG);

    expect(result.isQualified).toBe(true);
    expect(result.fitScore).toBeGreaterThanOrEqual(DEFAULT_SCORING_CONFIG.thresholds.minFitScore);
    expect(result.qualificationReasons).toContain('Has "write for us" / guest post page');
    expect(result.qualificationReasons).toContain('Contact email found');
  });

  it('disqualifies a site that is not live regardless of other signals', () => {
    const signals = baseSignals({
      isLive: false,
      relevanceScore: 100,
      hasGuestPostPage: true,
    });

    const result = scoreProspect(signals, DEFAULT_SCORING_CONFIG);

    expect(result.isQualified).toBe(false);
    expect(result.fitScore).toBe(0);
    expect(result.qualificationReasons).toContain('Site is not live / unreachable');
  });

  it('disqualifies a site flagged as spam even with high relevance', () => {
    const signals = baseSignals({
      relevanceScore: 95,
      hasGuestPostPage: true,
      hasBlog: true,
      discoveredEmails: ['a@b.com'],
      spamFlags: ['spam keywords: casino'],
    });

    const result = scoreProspect(signals, DEFAULT_SCORING_CONFIG);

    expect(result.isQualified).toBe(false);
    expect(result.qualificationReasons.some((r) => r.includes('spam'))).toBe(true);
  });

  it('disqualifies a domain that was already contacted', () => {
    const signals = baseSignals({
      relevanceScore: 90,
      hasGuestPostPage: true,
      hasBlog: true,
      discoveredEmails: ['a@b.com'],
      alreadyContacted: true,
    });

    const result = scoreProspect(signals, DEFAULT_SCORING_CONFIG);

    expect(result.isQualified).toBe(false);
    expect(result.qualificationReasons).toContain('Already contacted previously');
  });

  it('scores a weak prospect (no signals) as not qualified with a low score', () => {
    const signals = baseSignals();
    const result = scoreProspect(signals, DEFAULT_SCORING_CONFIG);

    expect(result.isQualified).toBe(false);
    expect(result.fitScore).toBeLessThan(DEFAULT_SCORING_CONFIG.thresholds.minFitScore);
    expect(result.qualificationReasons).toContain('No contact email found');
  });

  it('is a pure function: same inputs always produce the same output', () => {
    const signals = baseSignals({ relevanceScore: 50, hasBlog: true });
    const first = scoreProspect(signals, DEFAULT_SCORING_CONFIG);
    const second = scoreProspect(signals, DEFAULT_SCORING_CONFIG);
    expect(first).toEqual(second);
  });
});

import type { ProspectSignals, ScoringConfig, ScoringResult } from './types';

/**
 * Sum of positive weights used to normalize the raw weighted score into 0-100
 * before penalties are applied. Penalties are then subtracted as flat point
 * deductions rather than being part of the normalization base.
 */
function maxPositiveScore(weights: ScoringConfig['weights']): number {
  return (
    weights.relevance +
    weights.hasGuestPostPage +
    weights.hasBlog +
    weights.hasContactEmail +
    weights.outboundLinkFriendliness
  );
}

/**
 * Pure function: signals + weights/thresholds in, fit_score/is_qualified/reasons out.
 * No I/O, no randomness — safe to unit test directly.
 */
export function scoreProspect(
  signals: ProspectSignals,
  config: ScoringConfig
): ScoringResult {
  const { weights, thresholds } = config;
  const reasons: string[] = [];

  const relevance = signals.relevanceScore ?? 0;
  const isRelevant = relevance >= thresholds.minRelevanceScore;
  reasons.push(isRelevant ? 'High relevance to niche' : 'Low relevance to niche');

  let raw = (relevance / 100) * weights.relevance;

  if (signals.hasGuestPostPage) {
    raw += weights.hasGuestPostPage;
    reasons.push('Has "write for us" / guest post page');
  }

  if (signals.hasBlog) {
    raw += weights.hasBlog;
    reasons.push('Has an active blog');
  }

  const hasEmail = signals.discoveredEmails.length > 0;
  if (hasEmail) {
    raw += weights.hasContactEmail;
    reasons.push('Contact email found');
  } else {
    reasons.push('No contact email found');
  }

  const outboundLinks = signals.outboundLinkCount ?? 0;
  const isGuestPostFriendly =
    outboundLinks >= thresholds.minOutboundLinksForFriendliness &&
    outboundLinks < thresholds.maxOutboundLinksBeforeSpam;
  if (isGuestPostFriendly) {
    raw += weights.outboundLinkFriendliness;
    reasons.push('Outbound link profile looks guest-post friendly');
  }

  const maxPositive = maxPositiveScore(weights) || 1;
  let fitScore = (raw / maxPositive) * 100;

  const isSpam = signals.spamFlags.length > 0;
  if (isSpam) {
    fitScore -= weights.spamPenalty;
    reasons.push(`Flagged as potential spam (${signals.spamFlags.join(', ')})`);
  }

  if (!signals.isLive) {
    fitScore -= weights.notLivePenalty;
    reasons.push('Site is not live / unreachable');
  }

  if (signals.alreadyContacted) {
    fitScore -= weights.alreadyContactedPenalty;
    reasons.push('Already contacted previously');
  }

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  const isQualified =
    signals.isLive &&
    !isSpam &&
    !signals.alreadyContacted &&
    fitScore >= thresholds.minFitScore;

  return {
    fitScore,
    isQualified,
    qualificationReasons: reasons,
  };
}

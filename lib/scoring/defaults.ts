import type { ScoringConfig } from './types';

export const DEFAULT_WEIGHTS: ScoringConfig['weights'] = {
  relevance: 35,
  hasGuestPostPage: 25,
  hasBlog: 10,
  hasContactEmail: 15,
  outboundLinkFriendliness: 10,
  spamPenalty: 40,
  notLivePenalty: 100,
  alreadyContactedPenalty: 20,
};

export const DEFAULT_THRESHOLDS: ScoringConfig['thresholds'] = {
  minFitScore: 55,
  minOutboundLinksForFriendliness: 3,
  maxOutboundLinksBeforeSpam: 150,
  minRelevanceScore: 30,
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
};

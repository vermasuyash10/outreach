/** Signals collected by the enrichment engine for a single domain. */
export interface ProspectSignals {
  domain: string;
  isLive: boolean;
  statusCode: number | null;
  relevanceScore: number | null; // 0-100
  outboundLinkCount: number | null;
  hasBlog: boolean;
  hasGuestPostPage: boolean;
  guestPostUrl: string | null;
  discoveredEmails: string[];
  spamFlags: string[];
  dr: number | null; // pluggable paid data, null until a provider is wired in
  monthlyTraffic: number | null; // pluggable paid data, null until a provider is wired in
  alreadyContacted: boolean;
}

export interface ScoringWeights {
  relevance: number;
  hasGuestPostPage: number;
  hasBlog: number;
  hasContactEmail: number;
  outboundLinkFriendliness: number;
  spamPenalty: number;
  notLivePenalty: number;
  alreadyContactedPenalty: number;
}

export interface ScoringThresholds {
  /** Minimum fit_score (0-100) required to be considered qualified. */
  minFitScore: number;
  /** Outbound link counts at/above this are treated as guest-post friendly. */
  minOutboundLinksForFriendliness: number;
  /** Outbound link counts at/above this are flagged as spammy link farms. */
  maxOutboundLinksBeforeSpam: number;
  /** Minimum relevance score (0-100) to count as "relevant". */
  minRelevanceScore: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
}

export interface ScoringResult {
  fitScore: number;
  isQualified: boolean;
  qualificationReasons: string[];
}

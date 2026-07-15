/**
 * Interface for a future paid data provider (e.g. Ahrefs, Moz, SEMrush) that
 * can supply Domain Rating and monthly traffic estimates. No implementation
 * calls a paid API yet — `NullPaidDataProvider` always returns nulls so
 * these fields stay empty until a real provider is wired in.
 */
export interface PaidDataProvider {
  name: string;
  getDomainMetrics(domain: string): Promise<PaidDomainMetrics>;
}

export interface PaidDomainMetrics {
  dr: number | null;
  monthlyTraffic: number | null;
}

export class NullPaidDataProvider implements PaidDataProvider {
  name = 'none';

  async getDomainMetrics(_domain: string): Promise<PaidDomainMetrics> {
    return { dr: null, monthlyTraffic: null };
  }
}

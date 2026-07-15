import { describe, expect, it } from 'vitest';
import { extractEmails, computeRelevanceScore } from '../lib/enrichment/signals';

describe('extractEmails', () => {
  it('extracts a mailto link', () => {
    const html = `<html><body><a href="mailto:editor@blog.com">Email us</a></body></html>`;
    expect(extractEmails(html)).toEqual(['editor@blog.com']);
  });

  it('extracts a plain-text email in body copy', () => {
    const html = `<html><body><p>Reach out at contact@example-blog.io for pitches.</p></body></html>`;
    expect(extractEmails(html)).toEqual(['contact@example-blog.io']);
  });

  it('dedupes emails found via both mailto and body text', () => {
    const html = `
      <html><body>
        <a href="mailto:hello@site.com">Contact</a>
        <p>Or email hello@site.com directly.</p>
      </body></html>`;
    expect(extractEmails(html)).toEqual(['hello@site.com']);
  });

  it('filters out placeholder / example addresses', () => {
    const html = `<html><body><p>e.g. someone@example.com should be ignored.</p></body></html>`;
    expect(extractEmails(html)).toEqual([]);
  });

  it('ignores mailto hrefs that resolve to image-like garbage', () => {
    const html = `<html><body><a href="mailto:banner@ads.com?subject=logo.png">x</a></body></html>`;
    expect(extractEmails(html)).toEqual(['banner@ads.com']);
  });

  it('returns an empty array when no emails are present', () => {
    const html = `<html><body><p>No contact info here.</p></body></html>`;
    expect(extractEmails(html)).toEqual([]);
  });
});

describe('computeRelevanceScore', () => {
  it('returns 0 when there are no keyword matches', () => {
    const score = computeRelevanceScore('this page is about cooking recipes', ['gardening', 'soil']);
    expect(score).toBe(0);
  });

  it('returns a higher score for higher keyword density', () => {
    const filler = (count: number) => new Array(count).fill('filler').join(' ');

    const lowDensity = computeRelevanceScore(`${filler(100)} gardening`, ['gardening']);
    const highDensity = computeRelevanceScore(
      `${filler(20)} gardening gardening gardening soil soil`,
      ['gardening', 'soil']
    );
    expect(highDensity).toBeGreaterThan(lowDensity);
  });

  it('matches multi-word keyword phrases', () => {
    const score = computeRelevanceScore('we love organic soil amendments for raised beds', [
      'organic soil',
    ]);
    expect(score).toBeGreaterThan(0);
  });

  it('is capped at 100', () => {
    const score = computeRelevanceScore('soil soil soil soil soil soil soil soil soil soil', ['soil']);
    expect(score).toBeLessThanOrEqual(100);
  });
});

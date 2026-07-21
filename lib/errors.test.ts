import { describe, it, expect } from 'vitest';
import { isRateLimitError, getRateLimitResetMinutes, describeSectionError } from './errors';

describe('isRateLimitError', () => {
  it('returns true for 403 and 429 status errors', () => {
    expect(isRateLimitError({ status: 403 })).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isRateLimitError({ status: 404 })).toBe(false);
    expect(isRateLimitError(new Error('boom'))).toBe(false);
  });
});

describe('getRateLimitResetMinutes', () => {
  it('computes whole minutes until the reset header timestamp', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const resetSeconds = Math.floor(now / 1000) + 150; // 2.5 minutes ahead
    const minutes = getRateLimitResetMinutes(
      { status: 403, response: { headers: { 'x-ratelimit-reset': String(resetSeconds) } } },
      now
    );
    expect(minutes).toBe(3);
  });

  it('returns at least 1 minute when the header is missing', () => {
    const minutes = getRateLimitResetMinutes({ status: 403 }, Date.now());
    expect(minutes).toBe(1);
  });

  it('returns at least 1 minute when the reset timestamp is in the past', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const resetSeconds = Math.floor(now / 1000) - 30; // 30 seconds ago (in the past)
    const minutes = getRateLimitResetMinutes(
      { status: 403, response: { headers: { 'x-ratelimit-reset': String(resetSeconds) } } },
      now
    );
    expect(minutes).toBe(1); // Should be clamped to 1, not negative or zero
  });

  it('returns 1 minute when the reset header is non-numeric', () => {
    const minutes = getRateLimitResetMinutes(
      { status: 403, response: { headers: { 'x-ratelimit-reset': 'not-a-number' } } },
      Date.now()
    );
    expect(minutes).toBe(1);
  });
});

describe('describeSectionError', () => {
  it('returns a rate-limit-specific message', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const resetSeconds = Math.floor(now / 1000) + 60;
    const message = describeSectionError(
      { status: 429, response: { headers: { 'x-ratelimit-reset': String(resetSeconds) } } },
      now
    );
    expect(message).toBe('Rate limited, try again in 1m');
  });

  it('returns a generic message for other errors', () => {
    expect(describeSectionError(new Error('boom'), Date.now())).toBe(
      'Something went wrong loading this section.'
    );
  });
});

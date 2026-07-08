import { describe, expect, it } from 'vitest';
import { formatAuthSendError, isEmailRateLimitError } from '@src/lib/auth-errors';

describe('auth error formatting', () => {
  it('detects email rate-limit responses', () => {
    expect(isEmailRateLimitError('email rate limit exceeded')).toBe(true);
    expect(isEmailRateLimitError('over_email_send_rate_limit')).toBe(true);
    expect(isEmailRateLimitError('invalid email')).toBe(false);
  });

  it('returns a friendly english rate-limit message', () => {
    expect(formatAuthSendError('email rate limit exceeded', 'en')).toContain(
      'temporarily rate-limiting sign-in emails',
    );
  });
});

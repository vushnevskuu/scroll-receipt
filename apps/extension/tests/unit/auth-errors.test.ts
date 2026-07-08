import { describe, expect, it } from 'vitest';
import {
  formatAuthSendError,
  formatEmailSendError,
  getEmailProviderErrorText,
  isEmailRateLimitError,
} from '@src/lib/auth-errors';

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

  it('unwraps nested resend json errors', () => {
    expect(
      getEmailProviderErrorText(
        '{"error":"Resend error: {\\"statusCode\\":403,\\"message\\":\\"You can only send testing emails to your own email address\\"}"}',
      ),
    ).toBe('You can only send testing emails to your own email address');
  });

  it('returns a friendly resend test-mode message', () => {
    expect(
      formatEmailSendError(
        '{"error":"Resend error: {\\"statusCode\\":403,\\"message\\":\\"You can only send testing emails to your own email address\\"}"}',
        'en',
      ),
    ).toContain('verify your domain in Resend');
  });
});

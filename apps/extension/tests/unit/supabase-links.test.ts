import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthCallbackUrl } from '@src/lib/env';
import {
  buildExtensionHandledEmailLink,
  looksLikeEmailSignInLink,
  openEmailSignInLink,
} from '@src/lib/supabase';

describe('supabase email auth links', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes Supabase verify links', () => {
    expect(
      looksLikeEmailSignInLink(
        'https://example-project.supabase.co/auth/v1/verify?token=abc&type=signup',
      ),
    ).toBe(true);
    expect(looksLikeEmailSignInLink('123456')).toBe(false);
  });

  it('rewrites the redirect target to the public auth callback', () => {
    const rewritten = buildExtensionHandledEmailLink(
      'https://example-project.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=http://localhost:3000',
      'person@example.com',
    );

    const url = new URL(rewritten);
    expect(url.searchParams.get('redirect_to')).toBe(getAuthCallbackUrl('person@example.com'));
  });

  it('opens the rewritten link in a new tab', async () => {
    const create = vi.spyOn(chrome.tabs, 'create').mockResolvedValue(undefined);

    const result = await openEmailSignInLink(
      'https://example-project.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=http://localhost:3000',
      'person@example.com',
    );

    expect(result).toEqual({ ok: true });
    expect(create).toHaveBeenCalledWith({
      url: expect.stringContaining(encodeURIComponent(getAuthCallbackUrl('person@example.com'))),
    });
  });
});

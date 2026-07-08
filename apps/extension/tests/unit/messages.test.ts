import { describe, expect, it } from 'vitest';
import { parseExtensionMessage } from '@src/types/messages';

describe('extension message parsing', () => {
  it('does not inject locale into partial settings updates', () => {
    const parsed = parseExtensionMessage({
      type: 'UPDATE_SETTINGS',
      payload: {
        email: 'person@example.com',
        reportEnabled: true,
      },
    });

    expect(parsed?.type).toBe('UPDATE_SETTINGS');
    if (!parsed || parsed.type !== 'UPDATE_SETTINGS') {
      throw new Error('Expected UPDATE_SETTINGS message');
    }

    expect(parsed.payload).toEqual({
      email: 'person@example.com',
      reportEnabled: true,
    });
  });
});

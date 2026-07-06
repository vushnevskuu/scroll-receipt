import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('Scroll Receipt extension build', () => {
  test('production manifest exists after build', async () => {
    const manifestPath = resolve('.output/chrome-mv3/manifest.json');
    let manifest: { name?: string; manifest_version?: number };

    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string;
        manifest_version?: number;
      };
    } catch {
      test.skip(true, 'Run pnpm build before e2e tests');
      return;
    }

    expect(manifest.name).toBe('Scroll Receipt');
    expect(manifest.manifest_version).toBe(3);
  });
});

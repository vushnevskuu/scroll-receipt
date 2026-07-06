#!/usr/bin/env node
/**
 * Deploy Supabase edge functions via Management API using files on disk.
 * Requires SUPABASE_ACCESS_TOKEN in env (from `supabase login` or dashboard token).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'lqkxaykwsnrouqwsbivr';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

function readFn(name) {
  const base = resolve(root, 'supabase/functions', name);
  const files = [{ name: 'index.ts', content: readFileSync(resolve(base, 'index.ts'), 'utf8') }];
  if (name === 'daily-receipt' || name === 'send-test-receipt') {
    files.push({
      name: '_shared/receipt.ts',
      content: readFileSync(resolve(base, '_shared/receipt.ts'), 'utf8'),
    });
  }
  return files;
}

async function deploy(name, verifyJwt) {
  const body = {
    name,
    entrypoint_path: 'index.ts',
    verify_jwt: verifyJwt,
    files: readFn(name),
  };

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${name}: ${res.status} ${text}`);
  }
  console.log(`Deployed ${name}`);
}

for (const [name, jwt] of [
  ['sync-usage', true],
  ['send-test-receipt', true],
  ['daily-receipt', false],
]) {
  await deploy(name, jwt);
}

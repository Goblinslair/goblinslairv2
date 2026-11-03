// Runs a product sync (Loyverse POS -> `products` table) by calling the
// site's own sync endpoint, so there is only one copy of the sync logic
// (src/lib/product-sync.ts). The site must be running.
//
//   npm run sync-products                       # local `npm run dev`
//   SYNC_URL=https://<domain> npm run sync-products
//
// Requires SYNC_SECRET in .env, matching the one the site runs with.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const SECRET = process.env.SYNC_SECRET;
if (!SECRET) {
  console.error('Missing SYNC_SECRET. Add it to .env in the project root.');
  process.exit(1);
}

const base = process.env.SYNC_URL || 'http://localhost:4321';
const res = await fetch(new URL('/api/admin/sync-products', base), {
  method: 'POST',
  headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
  body: '{}',
}).catch((err) => {
  console.error(`Could not reach ${base}: ${err.message}`);
  process.exit(1);
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Sync failed (${res.status}): ${data.error || 'unknown error'}`);
  process.exit(1);
}
console.log(`Synced ${data.synced} product(s), removed ${data.removed}.`);

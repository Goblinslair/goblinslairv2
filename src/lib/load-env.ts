import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Astro/Vite only bridges .env into import.meta.env, not the real
// process.env — fine in production (Vercel injects real env vars), but
// plain process.env.X is undefined in local `astro dev` unless loaded here.
// Same manual approach scripts/sync-products.mjs already uses for the same
// reason. No-ops if .env doesn't exist (production) or the key's already
// set for real. Call once per module that reads process.env directly.
export function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
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

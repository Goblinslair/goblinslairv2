export const prerender = false;

import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../../lib/admin-auth';
import { loadDotEnv } from '../../../lib/load-env';
import { syncProducts } from '../../../lib/product-sync';

loadDotEnv();

// Two callers: staff pressing "Sync products now" in /admin (admin session
// cookie), and the droplet's hourly timer / `npm run sync-products`, which
// have no session and send `Authorization: Bearer <SYNC_SECRET>` instead.
function hasSyncSecret(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const allowed = hasSyncSecret(request) || (token ? await isValidAdminSession(token) : false);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  try {
    const result = await syncProducts();
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Product sync failed.';
    console.error('Product sync failed:', message);
    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
};

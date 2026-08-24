export const prerender = false;

import type { APIRoute } from 'astro';
import { verifyAdminPassword, createAdminSession, ADMIN_SESSION_COOKIE } from '../../../lib/admin-auth';
import { checkRateLimit } from '../../../lib/rate-limit';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Stricter than the customer login limit — this single shared password
  // gates GitHub commit access and Blob write access for the whole site.
  if (!(await checkRateLimit(`admin-login:${clientAddress}`, 5, 15))) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Please try again in a few minutes.' }), { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password || !(await verifyAdminPassword(password))) {
    return new Response(JSON.stringify({ error: 'Incorrect password.' }), { status: 401 });
  }

  const { token } = await createAdminSession();
  // No `expires` — a session cookie the browser drops on full close, so
  // staff are asked for the password again next time they open the browser,
  // even though the cookie survives ordinary navigation/tab-switching in
  // between. The DB-side 7-day expiry (admin-auth.ts) still hard-caps it as
  // a backstop, since some browsers restore session cookies on "continue
  // where you left off".
  cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const prerender = false;

import type { APIRoute } from 'astro';
import { verifyAdminPassword, createAdminSession, ADMIN_SESSION_COOKIE } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password || !(await verifyAdminPassword(password))) {
    return new Response(JSON.stringify({ error: 'Incorrect password.' }), { status: 401 });
  }

  const { token, expiresAt } = await createAdminSession();
  cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

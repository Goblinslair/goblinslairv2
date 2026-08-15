export const prerender = false;

import type { APIRoute } from 'astro';
import { destroySession, SESSION_COOKIE } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

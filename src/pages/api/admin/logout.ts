export const prerender = false;

import type { APIRoute } from 'astro';
import { destroyAdminSession, ADMIN_SESSION_COOKIE } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) await destroyAdminSession(token);
  cookies.delete(ADMIN_SESSION_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

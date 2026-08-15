export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { verifyPassword, createSession, SESSION_COOKIE } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const invalid = () =>
    new Response(JSON.stringify({ error: 'Incorrect email or password.' }), { status: 401 });

  if (!email || !password) return invalid();

  const [customer] = await sql<{ id: number; password_hash: string }[]>`
    SELECT id, password_hash FROM customers WHERE email = ${email}
  `;
  if (!customer || !(await verifyPassword(password, customer.password_hash))) {
    return invalid();
  }

  const { token, expiresAt } = await createSession(customer.id);
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

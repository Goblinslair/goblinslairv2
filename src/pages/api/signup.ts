export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { hashPassword, createSession, SESSION_COOKIE } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!(await checkRateLimit(`signup:${clientAddress}`, 10, 15))) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Please try again in a few minutes.' }), { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name || !EMAIL_RE.test(email) || password.length < 8) {
    return new Response(JSON.stringify({ error: 'Enter your name, a valid email, and a password of at least 8 characters.' }), { status: 400 });
  }

  const existing = await sql`SELECT id FROM customers WHERE email = ${email}`;
  if (existing.length > 0) {
    return new Response(JSON.stringify({ error: 'An account with that email already exists.' }), { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [customer] = await sql<{ id: number }[]>`
    INSERT INTO customers (email, password_hash, name) VALUES (${email}, ${passwordHash}, ${name})
    RETURNING id
  `;

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

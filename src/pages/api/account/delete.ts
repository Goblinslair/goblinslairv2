export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionCustomer, verifyPassword, SESSION_COOKIE } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM customers WHERE id = ${customer.id}
  `;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return new Response(JSON.stringify({ error: 'Password is incorrect.' }), { status: 401 });
  }

  // sessions row is removed via ON DELETE CASCADE (scripts/schema.sql)
  await sql`DELETE FROM customers WHERE id = ${customer.id}`;
  cookies.delete(SESSION_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

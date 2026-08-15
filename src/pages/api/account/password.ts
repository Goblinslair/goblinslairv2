export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionCustomer, hashPassword, verifyPassword, SESSION_COOKIE } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (newPassword.length < 8) {
    return new Response(JSON.stringify({ error: 'New password must be at least 8 characters.' }), { status: 400 });
  }

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM customers WHERE id = ${customer.id}
  `;
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await sql`UPDATE customers SET password_hash = ${newHash} WHERE id = ${customer.id}`;

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

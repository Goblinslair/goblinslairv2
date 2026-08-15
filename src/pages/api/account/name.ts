export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionCustomer, SESSION_COOKIE } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return new Response(JSON.stringify({ error: 'Name cannot be empty.' }), { status: 400 });

  await sql`UPDATE customers SET name = ${name} WHERE id = ${customer.id}`;

  return new Response(JSON.stringify({ ok: true, name }), { status: 200 });
};

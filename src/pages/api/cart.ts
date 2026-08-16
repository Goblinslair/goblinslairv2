export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { getSessionCustomer, SESSION_COOKIE } from '../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const rows = await sql<{ items: unknown }[]>`SELECT items FROM carts WHERE customer_id = ${customer.id}`;
  return new Response(
    JSON.stringify({ items: rows[0]?.items ?? [] }),
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items.slice(0, 200) : null;
  if (!items) return new Response(JSON.stringify({ error: 'Invalid cart payload.' }), { status: 400 });

  await sql`
    INSERT INTO carts (customer_id, items, updated_at)
    VALUES (${customer.id}, ${sql.json(items)}, now())
    ON CONFLICT (customer_id) DO UPDATE SET items = ${sql.json(items)}, updated_at = now()
  `;

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

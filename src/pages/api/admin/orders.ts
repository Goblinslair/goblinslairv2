export const prerender = false;

import type { APIRoute } from 'astro';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../../lib/admin-auth';
import { sql } from '../../../lib/db';
import { getOrderById, ensureLoyverseReceipt, reconcilePendingOrder } from '../../../lib/order-fulfillment';

async function requireAdmin(cookies: any) {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return token && (await isValidAdminSession(token));
}

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const status = url.searchParams.get('status') || '';

  const rows = status
    ? await sql`
        SELECT orders.*, customers.email, customers.name,
          CASE WHEN status = 'pending' AND reserved_until < now() THEN 'expired' ELSE status END AS display_status
        FROM orders JOIN customers ON customers.id = orders.customer_id
        WHERE status = ${status}
        ORDER BY created_at DESC LIMIT 200
      `
    : await sql`
        SELECT orders.*, customers.email, customers.name,
          CASE WHEN status = 'pending' AND reserved_until < now() THEN 'expired' ELSE status END AS display_status
        FROM orders JOIN customers ON customers.id = orders.customer_id
        ORDER BY created_at DESC LIMIT 200
      `;

  return new Response(JSON.stringify({ orders: rows }), { status: 200, headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'number' ? body.id : null;
  const action = typeof body?.action === 'string' ? body.action : '';
  if (!id || !action) {
    return new Response(JSON.stringify({ error: 'Missing order id or action.' }), { status: 400 });
  }

  if (action === 'fulfill') {
    const rows = await sql`
      UPDATE orders SET status = 'fulfilled', fulfilled_at = now()
      WHERE id = ${id} AND status = 'paid' RETURNING id
    `;
    if (!rows.length) return new Response(JSON.stringify({ error: 'Order not found or not marked paid.' }), { status: 409 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (action === 'retry-receipt') {
    const order = await getOrderById(id);
    if (!order) return new Response(JSON.stringify({ error: 'Order not found.' }), { status: 404 });
    if (order.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Order is not marked paid.' }), { status: 409 });
    }
    if (order.loyverse_receipt_id) {
      return new Response(JSON.stringify({ error: 'This order already has a Loyverse receipt.' }), { status: 409 });
    }
    await ensureLoyverseReceipt(order);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (action === 'reconcile') {
    const result = await reconcilePendingOrder(id);
    if (!result.ok) return new Response(JSON.stringify({ error: result.message }), { status: 409 });
    return new Response(JSON.stringify({ ok: true, message: result.message }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'Unknown action.' }), { status: 400 });
};

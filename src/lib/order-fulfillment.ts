import { sql } from './db';
import { getStoreId, getLiveStockForVariant } from './loyverse-stock';
import { createLoyverseReceipt } from './loyverse';
import { notifyOrderPaid } from './order-notifications';
import { requeryTransaction, type FiuuNotificationFields } from './fiuu';
import { getShippingRegion } from './shipping';

interface OrderItem {
  slug: string;
  name: string;
  price: number;
  qty: number;
  variantId: string | null;
  image: string | null;
}

interface ShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  state: string;
  phone: string;
}

interface OrderRow {
  id: number;
  customer_id: number;
  status: string;
  items: OrderItem[];
  discount_percent: string;
  discount_amount: string;
  total: string;
  loyverse_receipt_id: string | null;
  fiuu_orderid: string;
  customer_email: string;
  fulfillment_method: 'pickup' | 'delivery';
  shipping_cost: string;
  shipping_address: ShippingAddress | null;
}

async function getOrderByFiuuOrderId(fiuuOrderId: string): Promise<OrderRow | null> {
  const rows = await sql<OrderRow[]>`
    SELECT orders.*, customers.email AS customer_email
    FROM orders JOIN customers ON customers.id = orders.customer_id
    WHERE orders.fiuu_orderid = ${fiuuOrderId}
  `;
  return rows[0] ?? null;
}

export async function getOrderById(id: number): Promise<OrderRow | null> {
  const rows = await sql<OrderRow[]>`
    SELECT orders.*, customers.email AS customer_email
    FROM orders JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = ${id}
  `;
  return rows[0] ?? null;
}

// Re-verifies live stock immediately before creating the Loyverse receipt
// (not just relying on the checkout-time check) — Loyverse's own
// negative-stock alert is a dismissible UI warning, not a hard API-level
// block, so it can't be trusted to catch an oversell on its own. Returns
// the slug of the first insufficient line, or null if everything's still
// available.
async function findInsufficientStockItem(items: OrderItem[]): Promise<string | null> {
  const storeId = await getStoreId();
  if (!storeId) return null; // can't verify — proceed rather than block on an unrelated outage

  for (const item of items) {
    if (!item.variantId) continue;
    const live = await getLiveStockForVariant(storeId, item.variantId);
    if (live !== null && live < item.qty) return item.slug;
  }
  return null;
}

// Creates the Loyverse receipt for a paid order, guarding against
// concurrent/duplicate creation (two near-simultaneous webhook deliveries
// must never both create a receipt for the same order — see the atomic
// claim below) and against silently overselling stock that got sold
// in-store during the reservation window.
export async function ensureLoyverseReceipt(order: OrderRow): Promise<void> {
  if (order.loyverse_receipt_id) return; // already has one (or already claimed — see below)

  const insufficientSlug = await findInsufficientStockItem(order.items);
  if (insufficientSlug) {
    await sql`UPDATE orders SET status = 'payment_stock_conflict' WHERE id = ${order.id}`;
    console.error(
      `Order ${order.id} (${order.fiuu_orderid}): payment succeeded but "${insufficientSlug}" is out of stock — set to payment_stock_conflict for manual review.`
    );
    return;
  }

  // Atomic claim: only the delivery that successfully flips NULL ->
  // 'creating' proceeds to call Loyverse. Makes double-receipt-creation
  // from racing webhook redeliveries structurally impossible rather than
  // merely unlikely (a plain "if not already set" check has a
  // read-then-write race between two near-simultaneous deliveries).
  const claimed = await sql`
    UPDATE orders SET loyverse_receipt_id = 'creating'
    WHERE id = ${order.id} AND loyverse_receipt_id IS NULL
    RETURNING id
  `;
  if (claimed.length === 0) return; // another delivery already claimed it

  const storeId = await getStoreId();
  if (!storeId) {
    await sql`UPDATE orders SET loyverse_receipt_id = NULL WHERE id = ${order.id} AND loyverse_receipt_id = 'creating'`;
    console.error(`Order ${order.id}: no Loyverse store resolved, cannot create receipt yet.`);
    return;
  }

  // Reuse the order's own already-stored, already-charged values verbatim
  // — never recompute price/discount/total here, to avoid drift if a
  // product's price changed between checkout and webhook arrival.
  const shippingCost = parseFloat(order.shipping_cost);
  const result = await createLoyverseReceipt({
    storeId,
    customerEmail: order.customer_email,
    items: order.items
      .filter((item): item is OrderItem & { variantId: string } => !!item.variantId)
      .map((item) => ({ variantId: item.variantId, quantity: item.qty })),
    discountAmount: parseFloat(order.discount_amount),
    totalAmount: parseFloat(order.total),
    note: order.fiuu_orderid, // audit trail — traces any accidental duplicate straight back to the order
    shippingCost,
    shippingRegion: order.fulfillment_method === 'delivery' && order.shipping_address
      ? getShippingRegion(order.shipping_address.state)
      : null,
  });

  if (result.ok) {
    await sql`UPDATE orders SET loyverse_receipt_id = ${result.receiptId} WHERE id = ${order.id}`;
  } else {
    // Reset the claim so the next webhook redelivery (FIUU retries ~4x
    // over ~15min-1hr) can retry — money's already charged, so this must
    // never be swallowed silently.
    await sql`UPDATE orders SET loyverse_receipt_id = NULL WHERE id = ${order.id} AND loyverse_receipt_id = 'creating'`;
    console.error(`Order ${order.id} (${order.fiuu_orderid}): Loyverse receipt creation failed — ${result.error}`);
  }
}

// Entry point called from the FIUU Notification URL webhook
// (src/pages/api/checkout/fiuu-webhook.ts) after its signature has already
// been verified. Must be safe to call more than once for the same order —
// FIUU retries undelivered webhooks up to 4x over ~15min-1hr.
export async function finalizeOrderPayment(fields: FiuuNotificationFields): Promise<void> {
  const order = await getOrderByFiuuOrderId(fields.orderid);
  if (!order) {
    console.error('FIUU webhook: unknown fiuu_orderid', fields.orderid);
    return;
  }

  if (fields.status === '00') {
    // A valid signature only proves the message came from FIUU unmodified
    // — it doesn't prove it's paying the right amount for THIS order.
    // Cross-check before trusting it.
    const expected = parseFloat(order.total).toFixed(2);
    const received = parseFloat(fields.amount).toFixed(2);
    if (expected !== received) {
      console.error(`Order ${order.id} (${order.fiuu_orderid}): amount mismatch — expected ${expected}, webhook said ${received}. Not finalizing.`);
      return;
    }

    // Idempotent: only the delivery that actually flips pending/expired ->
    // paid runs the notification hook below.
    const flipped = await sql`
      UPDATE orders SET status = 'paid', paid_at = now(), fiuu_tran_id = ${fields.tranID}
      WHERE id = ${order.id} AND status IN ('pending', 'expired')
      RETURNING id
    `;

    // Receipt creation is retried on every redelivery (keyed off
    // loyverse_receipt_id IS NULL inside ensureLoyverseReceipt), not just
    // on the delivery that flipped the status — a Loyverse hiccup on the
    // first attempt gets more free tries within FIUU's own retry window.
    await ensureLoyverseReceipt(order);

    if (flipped.length > 0) {
      await notifyOrderPaid({ id: order.id, customerEmail: order.customer_email, total: parseFloat(order.total) });
    }
  } else if (fields.status === '11') {
    await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${order.id} AND status = 'pending'`;
  }
}

// Staff-triggered reconciliation for a pending/expired order whose FIUU
// webhook never arrived (src/pages/api/admin/orders.ts's 'reconcile'
// action) — queries FIUU's Requery API directly rather than waiting on a
// webhook that may never come. Deliberately staff-triggered rather than an
// automated poll/cron, matching this codebase's bias against background
// infra it doesn't strictly need for a handful of stuck orders.
//
// Note: unlike finalizeOrderPayment, this does NOT cross-check a webhook
// `amount` field against the order total — FIUU's Requery response shape
// wasn't confirmed during planning (see src/lib/fiuu.ts's TODOs), so no
// amount field is available to check yet. Acceptable for now since this
// is a manual, low-volume, staff-supervised action, not an automated
// trust boundary — revisit once the real Requery response shape is
// confirmed.
export async function reconcilePendingOrder(orderId: number): Promise<{ ok: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, message: 'Order not found.' };
  if (order.status !== 'pending' && order.status !== 'expired') {
    return { ok: false, message: `Order is already "${order.status}" — nothing to reconcile.` };
  }

  const result = await requeryTransaction(order.fiuu_orderid);
  if (!result.ok) return { ok: false, message: `Could not reach FIUU: ${result.error}` };

  if (result.status === 'paid') {
    const flipped = await sql`
      UPDATE orders SET status = 'paid', paid_at = now(), fiuu_tran_id = ${result.tranId ?? null}
      WHERE id = ${order.id} AND status IN ('pending', 'expired')
      RETURNING id
    `;
    await ensureLoyverseReceipt(order);
    if (flipped.length > 0) {
      await notifyOrderPaid({ id: order.id, customerEmail: order.customer_email, total: parseFloat(order.total) });
    }
    return { ok: true, message: 'FIUU confirmed this order was paid — marked paid and receipt creation triggered.' };
  }

  if (result.status === 'failed') {
    await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${order.id} AND status IN ('pending', 'expired')`;
    return { ok: true, message: 'FIUU confirmed this payment failed — order cancelled.' };
  }

  return { ok: true, message: 'FIUU still shows this payment as pending. Try again shortly.' };
}

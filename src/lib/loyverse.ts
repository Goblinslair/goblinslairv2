import { loadDotEnv } from './load-env';

loadDotEnv();

const BASE_URL = 'https://api.loyverse.com/v1.0';

const DISCOUNT_BY_LEVEL: Record<1 | 2, number> = { 1: 10, 2: 15 };

export interface MembershipTier {
  level: 1 | 2 | null;
  discountPercent: number;
}

// Links a website account to its Loyverse customer record by email — the
// same field on both sides, no separate linking table. Misses if the
// customer's in-store Loyverse profile has no email or a different one than
// they signed up with here; callers should show that as "no tier found",
// not an error, since it's an expected/legitimate outcome, not a bug.
export async function getMembershipTier(email: string): Promise<MembershipTier> {
  const token = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!token) return { level: null, discountPercent: 0 };

  const url = new URL(`${BASE_URL}/customers`);
  url.searchParams.set('email', email);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { level: null, discountPercent: 0 };

  const json = await res.json();
  const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
  const customer = listKey ? json[listKey][0] : undefined;
  const note: string = customer?.note ?? '';
  const noteLower = note.toLowerCase();

  // "level 2" checked first: the note is free text mixed with other staff
  // comments, so this is a deterministic tie-break, not a real ambiguity
  // resolver — fails closed to null if neither substring appears.
  const level: 1 | 2 | null = noteLower.includes('level 2')
    ? 2
    : noteLower.includes('level 1')
      ? 1
      : null;

  return { level, discountPercent: level ? DISCOUNT_BY_LEVEL[level] : 0 };
}

// Looks up a Loyverse customer id by email — same lookup as
// getMembershipTier above. Returns null (an expected, non-error outcome)
// if no token, no matching Loyverse customer, or the request fails; the
// receipt still gets created without a linked customer in that case.
async function findLoyverseCustomerIdByEmail(email: string, token: string): Promise<string | null> {
  const url = new URL(`${BASE_URL}/customers`);
  url.searchParams.set('email', email);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;

  const json = await res.json();
  const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
  const customer = listKey ? json[listKey][0] : undefined;
  return customer?.id ?? null;
}

export type CreateReceiptResult =
  | { ok: true; receiptId: string }
  | { ok: false; error: string };

// Creates a real Loyverse sale for a paid click-and-collect order —
// called from src/lib/order-fulfillment.ts once the FIUU payment webhook
// confirms payment. Deliberately NOT the fail-closed-and-silent style of
// getMembershipTier/getLiveStockMap above: a failure here means money has
// already been charged, so callers must see the failure and act on it
// (retry, surface in /admin/orders) rather than have it swallowed.
//
// totalAmount/discountPercent must be the order's own already-computed,
// already-stored values (never recomputed here) — the customer paid a
// specific amount at checkout time, and the receipt must reflect exactly
// that, not a value freshly recalculated from current prices.
export async function createLoyverseReceipt(input: {
  storeId: string;
  customerEmail: string;
  items: { variantId: string; quantity: number }[];
  discountAmount: number;
  totalAmount: number;
  note: string; // fiuu_orderid, embedded for audit traceability
  shippingCost?: number;
  shippingRegion?: 'west' | 'east' | null;
}): Promise<CreateReceiptResult> {
  const token = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LOYVERSE_ACCESS_TOKEN not configured' };

  const paymentTypeId = process.env.LOYVERSE_ONLINE_PAYMENT_TYPE_ID;
  if (!paymentTypeId) return { ok: false, error: 'LOYVERSE_ONLINE_PAYMENT_TYPE_ID not configured' };

  const lineItems: { variant_id: string; quantity: number; price?: number }[] = input.items.map((item) => ({
    variant_id: item.variantId,
    quantity: item.quantity,
  }));

  // Delivery orders need their own catalog line so the receipt's line
  // items still balance against the payment total — Loyverse requires a
  // variant_id per line (no evidence an entirely ad-hoc no-SKU line is
  // accepted), but its `price` can be explicitly overridden per line, so
  // one placeholder product per region always carries the real RM10/RM15
  // rather than whatever price it has in the catalog. Two separate
  // West/East products (not one shared one) so Loyverse's own sales
  // reports show the region split without opening individual receipts.
  if (input.shippingCost && input.shippingCost > 0) {
    const shippingVariantId = input.shippingRegion === 'east'
      ? process.env.LOYVERSE_SHIPPING_VARIANT_ID_EAST
      : input.shippingRegion === 'west'
        ? process.env.LOYVERSE_SHIPPING_VARIANT_ID_WEST
        : null;
    if (!shippingVariantId) {
      return { ok: false, error: `LOYVERSE_SHIPPING_VARIANT_ID_${(input.shippingRegion ?? 'UNKNOWN').toUpperCase()} not configured` };
    }
    lineItems.push({ variant_id: shippingVariantId, quantity: 1, price: input.shippingCost });
  }

  const customerId = await findLoyverseCustomerIdByEmail(input.customerEmail, token);

  const res = await fetch(`${BASE_URL}/receipts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: input.storeId,
      customer_id: customerId ?? undefined,
      source: 'Goblin\'s Lair Website',
      note: input.note,
      line_items: lineItems,
      // Confirmed shape during planning: total_discounts is an array;
      // type VARIABLE_AMOUNT pairs with `money_amount` (VARIABLE_PERCENTAGE
      // would instead pair with `percentage`, applied proportionally
      // across every line — deliberately NOT used here, since a
      // percentage discount would incorrectly also discount the shipping
      // line item above; the membership discount only ever applies to
      // the product subtotal). Sending the already-computed exact amount
      // sidesteps needing to know how Loyverse's own percentage math
      // treats mixed line items. Whether `name`/`id` are required on this
      // object wasn't confirmed — verify against a real test receipt (see
      // plan's Verification section) before relying on this in production.
      total_discounts: input.discountAmount > 0
        ? [{ name: 'Member Discount', type: 'VARIABLE_AMOUNT', money_amount: input.discountAmount }]
        : undefined,
      payments: [{ payment_type_id: paymentTypeId, money_amount: input.totalAmount }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Loyverse receipt creation failed', res.status, body);
    return { ok: false, error: `Loyverse API returned ${res.status}` };
  }

  const json = await res.json();
  const receiptId = json.receipt_number ?? json.id;
  if (!receiptId) {
    console.error('Loyverse receipt creation: no receipt id in response', json);
    return { ok: false, error: 'No receipt id returned' };
  }
  return { ok: true, receiptId: String(receiptId) };
}

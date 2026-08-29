export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sql } from '../../lib/db';
import { getSessionCustomer, SESSION_COOKIE } from '../../lib/auth';
import { getMembershipTier } from '../../lib/loyverse';
import { getStoreId, getLiveStockForVariant } from '../../lib/loyverse-stock';
import { getReservedQtyForVariant } from '../../lib/reservations';
import { generateOrderId, buildHostedPagePayload } from '../../lib/fiuu';
import { getShippingCost } from '../../lib/shipping';

const RESERVATION_MINUTES = 15; // matches FIUU's own ~15min IPN retry cadence

interface ShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  state: string;
  phone: string;
}

export const POST: APIRoute = async ({ request, cookies, site, url }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  if (!customer) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

  const body = await request.json().catch(() => null);
  const fulfillmentMethod: 'pickup' | 'delivery' = body?.fulfillmentMethod === 'delivery' ? 'delivery' : 'pickup';

  let shippingAddress: ShippingAddress | null = null;
  let shippingCost = 0;

  if (fulfillmentMethod === 'delivery') {
    const addr = body?.shippingAddress;
    const line1 = typeof addr?.line1 === 'string' ? addr.line1.trim() : '';
    const line2 = typeof addr?.line2 === 'string' ? addr.line2.trim() : '';
    const city = typeof addr?.city === 'string' ? addr.city.trim() : '';
    const postcode = typeof addr?.postcode === 'string' ? addr.postcode.trim() : '';
    const state = typeof addr?.state === 'string' ? addr.state.trim() : '';
    const phone = typeof addr?.phone === 'string' ? addr.phone.trim() : '';

    if (!line1 || !city || !postcode || !state || !phone) {
      return new Response(JSON.stringify({ error: 'Please fill in your full delivery address.' }), { status: 400 });
    }
    if (!/^\d{5}$/.test(postcode)) {
      return new Response(JSON.stringify({ error: 'Postcode must be 5 digits.' }), { status: 400 });
    }
    // Never trust a client-supplied shipping cost — always look it up
    // server-side from the state alone.
    const cost = getShippingCost(state);
    if (cost === null) {
      return new Response(JSON.stringify({ error: 'Please select a valid state.' }), { status: 400 });
    }

    shippingAddress = { line1, line2: line2 || null, city, postcode, state, phone };
    shippingCost = cost;
  }

  // Cart is account-owned, not browser-owned (see public/cart.js) — always
  // read the customer's server-side cart, never trust a client-supplied
  // cart payload for money math.
  const cartRows = await sql<{ items: { slug: string; qty: number }[] }[]>`
    SELECT items FROM carts WHERE customer_id = ${customer.id}
  `;
  const cartItems = cartRows[0]?.items ?? [];
  if (cartItems.length === 0) {
    return new Response(JSON.stringify({ error: 'Your cart is empty.' }), { status: 400 });
  }

  const products = await getCollection('products');
  const storeId = await getStoreId();

  const orderItems: { slug: string; name: string; price: number; qty: number; variantId: string | null; image: string | null }[] = [];

  for (const cartItem of cartItems) {
    const product = products.find((p) => p.id === cartItem.slug);
    if (!product) {
      return new Response(JSON.stringify({ error: `"${cartItem.slug}" is no longer available. Please remove it from your cart.` }), { status: 400 });
    }
    if (!product.data.variantId) {
      return new Response(JSON.stringify({ error: `"${product.data.name}" can't be checked out online right now. Please remove it from your cart.` }), { status: 400 });
    }

    // Stock check: live Loyverse stock minus what's already soft-reserved
    // by OTHER pending orders (this order doesn't exist yet, so nothing to
    // exclude). Uncached, authoritative last-check.
    let available = product.data.stock; // synced-snapshot fallback if live lookup fails
    if (storeId) {
      const live = await getLiveStockForVariant(storeId, product.data.variantId);
      if (live !== null) available = live;
    }
    if (available !== null) {
      const reserved = await getReservedQtyForVariant(product.data.variantId);
      available = Math.max(0, available - reserved);
      if (cartItem.qty > available) {
        return new Response(JSON.stringify({ error: `Only ${available} of "${product.data.name}" left — please update the quantity in your cart.` }), { status: 400 });
      }
    }

    // Re-derive price/name from the product collection, never trust the
    // client-cached cart price for money math.
    orderItems.push({
      slug: product.id,
      name: product.data.name,
      price: product.data.price,
      qty: cartItem.qty,
      variantId: product.data.variantId,
      image: product.data.image,
    });
  }

  const tier = await getMembershipTier(customer.email);
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = subtotal * tier.discountPercent / 100;
  // Shipping is never discounted — the membership discount only ever
  // applies to the product subtotal (see the matching note in
  // src/lib/loyverse.ts's createLoyverseReceipt for why this also matters
  // for how the Loyverse receipt's discount gets sent).
  const total = subtotal - discountAmount + shippingCost;

  const fiuuOrderId = generateOrderId();
  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  // Final stock re-check + insert wrapped in a transaction to shrink (not
  // eliminate — a concurrent in-store sale isn't lockable from here) the
  // race window between two customers checking out the last unit at once.
  try {
    await sql.begin(async (tx) => {
      for (const item of orderItems) {
        if (!item.variantId) continue;
        const reservedRows = await tx<{ total: string | null }[]>`
          SELECT SUM((elem->>'qty')::int) AS total
          FROM orders, jsonb_array_elements(items) AS elem
          WHERE status = 'pending' AND reserved_until > now() AND elem->>'variantId' = ${item.variantId}
        `;
        const reserved = parseInt(reservedRows[0]?.total ?? '0', 10);
        const live = storeId ? await getLiveStockForVariant(storeId, item.variantId) : null;
        const available = live !== null ? live - reserved : null;
        if (available !== null && item.qty > available) {
          throw new Error(`Only ${Math.max(0, available)} of "${item.name}" left — please update the quantity in your cart.`);
        }
      }

      await tx`
        INSERT INTO orders (customer_id, items, subtotal, discount_percent, discount_amount, total, fiuu_orderid, reserved_until, fulfillment_method, shipping_cost, shipping_address)
        VALUES (${customer.id}, ${sql.json(orderItems)}, ${subtotal.toFixed(2)}, ${tier.discountPercent}, ${discountAmount.toFixed(2)}, ${total.toFixed(2)}, ${fiuuOrderId}, ${reservedUntil}, ${fulfillmentMethod}, ${shippingCost.toFixed(2)}, ${shippingAddress ? sql.json(shippingAddress) : null})
      `;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong starting checkout.';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  const siteOrigin = site?.origin ?? url.origin;
  const { url: hostedUrl, fields } = buildHostedPagePayload({
    fiuuOrderId,
    amount: total,
    currency: 'MYR',
    customerEmail: customer.email,
    customerName: customer.name,
    returnUrl: `${siteOrigin}/checkout/return?orderid=${fiuuOrderId}`,
    notifyUrl: `${siteOrigin}/api/checkout/fiuu-webhook`,
  });

  return new Response(JSON.stringify({ ok: true, url: hostedUrl, fields }), { status: 200 });
};

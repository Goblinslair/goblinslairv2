import { loadDotEnv } from './load-env';
import type { OrderItem, OrderRow, ShippingAddress } from './order-fulfillment';

loadDotEnv();

// Single seam for "an order just got paid" side effects that aren't core
// to fulfillment itself (that's src/lib/order-fulfillment.ts). Called once
// per order, only on the actual pending->paid transition, not on
// idempotent webhook redeliveries — see src/lib/order-fulfillment.ts.
// Email delivery is deliberately best-effort: a Brevo hiccup must never
// roll back or retry the payment/receipt logic that already ran, so this
// only ever logs on failure, never throws.

const SENDER_EMAIL = 'goblinslairpj@gmail.com';
const SENDER_NAME = "Goblin's Lair";

// Brand tokens mirrored from public/style.css. Email clients can't load the
// site's self-hosted Althea font (or any @font-face reliably), so the
// display face falls back to a web-safe serif instead.
const MAROON = '#560e00';
const MAROON_DEEP = '#3e0a00';
const CREAM = '#ecead7';
const CREAM_SOFT = '#e2ded0';
const BRASS = '#a67c3d';
const INK = '#2a1a12';

function money(amount: number): string {
  return `RM${amount.toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function formatPaidDate(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}

function buildFulfillmentHtml(fulfillmentMethod: 'pickup' | 'delivery', shippingAddress: ShippingAddress | null): string {
  if (fulfillmentMethod === 'delivery' && shippingAddress) {
    const lines = [shippingAddress.line1, shippingAddress.line2, `${shippingAddress.postcode} ${shippingAddress.city}, ${shippingAddress.state}`]
      .filter(Boolean)
      .map((line) => escapeHtml(line as string))
      .join('<br>');
    return `
      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${BRASS};">Delivery</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${INK};">We'll get your order packed and shipped out soon, to:<br>${lines}</p>`;
  }
  return `
    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${BRASS};">Pick Up In-Store</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${INK};">Swing by any time during opening hours — show this email or your name at the counter.<br>
    84A, Jalan SS 24/2, Taman Megah, 47301 Petaling Jaya, Selangor<br>
    Wed&ndash;Fri 1:30pm&ndash;8:30pm &middot; Sat&ndash;Sun 12:30pm&ndash;9pm</p>`;
}

function buildItemRowsHtml(items: OrderItem[]): string {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(166,124,61,0.18);font-size:14px;vertical-align:top;">
          <div style="font-weight:bold;color:${INK};">${escapeHtml(item.name)}</div>
          <div style="font-size:12px;color:${INK};opacity:0.6;">Qty ${item.qty}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid rgba(166,124,61,0.18);font-size:14px;text-align:right;white-space:nowrap;color:${INK};">${money(item.price * item.qty)}</td>
      </tr>`
    )
    .join('');
}

function buildEmailHtml(order: OrderRow): string {
  const subtotal = parseFloat(order.subtotal);
  const discountPercent = parseFloat(order.discount_percent);
  const discountAmount = parseFloat(order.discount_amount);
  const shippingCost = parseFloat(order.shipping_cost);
  const total = parseFloat(order.total);
  const customerName = order.customer_name || order.customer_email.split('@')[0];

  return `<!doctype html>
<html>
<body style="margin:0;background:${CREAM_SOFT};font-family:Verdana,Geneva,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM_SOFT};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid rgba(166,124,61,0.35);border-radius:10px;overflow:hidden;">
        <tr><td style="background:${MAROON_DEEP};padding:28px 32px;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;color:${CREAM};font-size:22px;letter-spacing:0.12em;text-transform:uppercase;">Goblin's Lair</div>
          <div style="font-family:Verdana,sans-serif;letter-spacing:0.18em;font-size:9px;color:${BRASS};margin-top:6px;">WARHAMMER &amp; TABLETOP HOBBY SHOP</div>
        </td></tr>
        <tr><td style="padding:34px 32px 8px;">
          <span style="display:inline-block;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;background:rgba(86,14,0,0.08);color:${MAROON};border:1px solid rgba(86,14,0,0.25);border-radius:999px;padding:4px 12px;margin-bottom:16px;">Payment Received</span>
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;margin:0 0 10px;color:${INK};">Thanks, ${escapeHtml(customerName)}!</h1>
          <p style="font-size:14px;line-height:1.6;margin:0 0 4px;color:${INK};opacity:0.85;">Your payment went through. Here's what you ordered.</p>
          <p style="font-size:12px;margin:0 0 26px;color:${INK};opacity:0.6;">Order ${escapeHtml(order.fiuu_orderid)} &middot; Paid ${formatPaidDate()}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th align="left" style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${BRASS};padding:0 0 8px;border-bottom:1px solid rgba(166,124,61,0.4);">Item</th>
                <th align="right" style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${BRASS};padding:0 0 8px;border-bottom:1px solid rgba(166,124,61,0.4);">Price</th></tr>
            ${buildItemRowsHtml(order.items)}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:18px 0 4px;">
            <tr><td style="font-size:13px;padding:5px 0;color:${INK};opacity:0.7;">Subtotal</td><td align="right" style="font-size:13px;padding:5px 0;color:${INK};">${money(subtotal)}</td></tr>
            ${discountAmount > 0 ? `<tr><td style="font-size:13px;padding:5px 0;color:${INK};opacity:0.7;">Member Discount (${discountPercent}%)</td><td align="right" style="font-size:13px;padding:5px 0;color:#3f7a4f;">&minus;${money(discountAmount)}</td></tr>` : ''}
            ${shippingCost > 0 ? `<tr><td style="font-size:13px;padding:5px 0;color:${INK};opacity:0.7;">Shipping</td><td align="right" style="font-size:13px;padding:5px 0;color:${INK};">${money(shippingCost)}</td></tr>` : ''}
            <tr><td style="font-size:16px;font-weight:bold;padding-top:12px;border-top:1px solid rgba(166,124,61,0.4);color:${MAROON};">Total Paid</td><td align="right" style="font-size:16px;font-weight:bold;padding-top:12px;border-top:1px solid rgba(166,124,61,0.4);color:${MAROON};">${money(total)}</td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
            <tr><td style="padding:18px 20px;background:${CREAM_SOFT};border-radius:8px;border:1px solid rgba(166,124,61,0.3);">
              ${buildFulfillmentHtml(order.fulfillment_method, order.shipping_address)}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="height:1px;background:rgba(166,124,61,0.25);"></div></td></tr>
        <tr><td style="padding:28px 32px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:${INK};opacity:0.55;line-height:1.7;">Questions about this order? Reply to this email or reach us at<br><a href="mailto:${SENDER_EMAIL}" style="color:${MAROON};text-decoration:none;">${SENDER_EMAIL}</a></p>
          <p style="margin:0;font-size:11px;color:${INK};opacity:0.55;line-height:1.7;">Goblin's Lair &middot; Petaling Jaya, Selangor</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(order: OrderRow): string {
  const customerName = order.customer_name || order.customer_email.split('@')[0];
  const itemLines = order.items.map((item) => `- ${item.name} x${item.qty}: ${money(item.price * item.qty)}`).join('\n');
  const fulfillmentText = order.fulfillment_method === 'delivery' && order.shipping_address
    ? `Delivery to: ${order.shipping_address.line1}, ${order.shipping_address.postcode} ${order.shipping_address.city}, ${order.shipping_address.state}`
    : 'Pick up in-store: 84A, Jalan SS 24/2, Taman Megah, 47301 Petaling Jaya, Selangor';

  return `Thanks, ${customerName}!

Your payment went through. Order ${order.fiuu_orderid}, paid ${formatPaidDate()}.

${itemLines}

Subtotal: ${money(parseFloat(order.subtotal))}
${parseFloat(order.discount_amount) > 0 ? `Member Discount: -${money(parseFloat(order.discount_amount))}\n` : ''}${parseFloat(order.shipping_cost) > 0 ? `Shipping: ${money(parseFloat(order.shipping_cost))}\n` : ''}Total Paid: ${money(parseFloat(order.total))}

${fulfillmentText}

Questions? Reply to this email or reach us at ${SENDER_EMAIL}.
Goblin's Lair, Petaling Jaya, Selangor`;
}

export async function notifyOrderPaid(order: OrderRow): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error(`Order ${order.id} (${order.fiuu_orderid}): BREVO_API_KEY not configured — skipping payment confirmation email.`);
    return;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: order.customer_email, name: order.customer_name || undefined }],
        subject: `Your order is confirmed — ${order.fiuu_orderid}`,
        htmlContent: buildEmailHtml(order),
        textContent: buildEmailText(order),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Order ${order.id} (${order.fiuu_orderid}): Brevo email send failed`, res.status, body);
    }
  } catch (err) {
    console.error(`Order ${order.id} (${order.fiuu_orderid}): Brevo email send threw`, err);
  }
}

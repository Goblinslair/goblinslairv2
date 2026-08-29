export const prerender = false;

import type { APIRoute } from 'astro';
import { verifyNotificationSignature, buildAckBody, type FiuuNotificationFields } from '../../../lib/fiuu';
import { finalizeOrderPayment } from '../../../lib/order-fulfillment';

// FIUU's Notification URL — server-to-server, the only thing this codebase
// trusts to mark an order paid (the browser-facing Return URL is
// spoofable, see src/pages/checkout/return.astro). Body is
// x-www-form-urlencoded, not JSON — the one deliberate exception to this
// codebase's usual JSON API bodies, since that's FIUU's own convention.
export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData().catch(() => null);
  if (!formData) return new Response('Bad Request', { status: 400 });

  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    fields[key] = String(value);
  }

  const notification = fields as unknown as FiuuNotificationFields;
  if (!verifyNotificationSignature(notification)) {
    // Invalid signature: log and reject with no ack body — don't help an
    // attacker learn the ack format. A genuine FIUU delivery with a
    // transient issue will still retry.
    console.error('FIUU webhook: signature verification failed', fields.orderid);
    return new Response('Invalid signature', { status: 400 });
  }

  await finalizeOrderPayment(notification);

  // Always ack once the signature is valid, regardless of what
  // finalizeOrderPayment internally did (it's idempotent) — so FIUU stops
  // retrying a delivery we've already understood.
  return new Response(buildAckBody(fields), {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};

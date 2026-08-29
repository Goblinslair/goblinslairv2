// Single seam for "an order just got paid" side effects that aren't core
// to fulfillment itself (that's src/lib/order-fulfillment.ts). No-op today
// — wire a real email provider (Resend/Postmark/etc.) here later without
// hunting through webhook logic for where to add it. Called once per
// order, only on the actual pending->paid transition, not on idempotent
// webhook redeliveries — see src/lib/order-fulfillment.ts.
export async function notifyOrderPaid(order: {
  id: number;
  customerEmail: string;
  total: number;
}): Promise<void> {
  // TODO: send a "paid — come pick it up" email once a provider is chosen.
  // Contact form (public/contact-form.js) has the same "no backend chosen
  // yet" gap for the same reason.
}

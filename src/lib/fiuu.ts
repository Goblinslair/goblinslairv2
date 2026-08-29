import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadDotEnv } from './load-env';

loadDotEnv();

// FIUU (formerly Razer Merchant Services) — payment gateway for
// click-and-collect checkout. Isolated in this one file so it's a clean
// drop-in once real sandbox/production credentials exist (not yet
// obtained as of this writing — see CLAUDE.md / project memory). Requests
// are x-www-form-urlencoded, not JSON, per FIUU's own convention — the one
// deliberate exception to this codebase's usual JSON API bodies.
//
// IMPORTANT: the Hosted Payment Page endpoint URL and outbound field names
// below (buildHostedPagePayload, requeryTransaction) are PLACEHOLDERS —
// only the Notification URL webhook's inbound fields/signature formula and
// the Refund API's fields were confirmed against FIUU's docs/cheatsheet
// during planning. Verify buildHostedPagePayload's endpoint and field
// names against FIUU's actual Hosted Payment Page integration guide once
// sandbox credentials exist, before relying on it.

function isSandbox(): boolean {
  return (process.env.FIUU_SANDBOX ?? 'true').toLowerCase() !== 'false';
}

// TODO: confirm the real hosted-page host once sandbox credentials +
// FIUU's integration guide are in hand — placeholder based on FIUU's
// general domain pattern, not yet verified.
const HOSTED_PAGE_URL = isSandbox()
  ? 'https://sandbox.merchant.razer.com/RMS/pay/'
  : 'https://pay.fiuu.com/RMS/pay/';

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// 'GL' + 12 hex chars — generated at order-insert time so the INSERT is a
// single statement (no insert-then-update round trip to fill this in).
export function generateOrderId(): string {
  return 'GL' + randomBytes(6).toString('hex').toUpperCase();
}

export interface HostedPageOrder {
  fiuuOrderId: string;
  amount: number; // MYR, e.g. 49.90
  currency: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  notifyUrl: string;
}

// Builds the signed field set for the redirect to FIUU's hosted payment
// page. This is a form POST (auto-submitted client-side), not a GET
// redirect. Field names/signing formula here are a placeholder shape —
// see the file-level note above.
export function buildHostedPagePayload(order: HostedPageOrder): { url: string; fields: Record<string, string> } {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const verifyKey = process.env.FIUU_VERIFY_KEY!;
  const amountStr = order.amount.toFixed(2);

  // TODO: confirm this is FIUU's actual outbound signature formula for
  // *initiating* a Hosted Payment Page transaction — only the inbound
  // Notification URL formula (verifyNotificationSignature below) was
  // confirmed during planning.
  const vsign = md5(`${amountStr}${merchantId}${order.fiuuOrderId}${verifyKey}`);

  return {
    url: HOSTED_PAGE_URL,
    fields: {
      merchant_id: merchantId,
      amount: amountStr,
      orderid: order.fiuuOrderId,
      bill_name: order.customerName,
      bill_email: order.customerEmail,
      currency: order.currency,
      vsign,
      returnurl: order.returnUrl,
      notifyurl: order.notifyUrl,
    },
  };
}

export interface FiuuNotificationFields {
  nbcb: string;
  amount: string;
  orderid: string;
  tranID: string;
  domain: string;
  status: string;
  appcode: string;
  error_code?: string;
  error_desc?: string;
  skey: string;
  currency: string;
  channel?: string;
  paydate: string;
}

// Notification URL (server-to-server) signature check — the ONLY thing
// that should ever be trusted to mark an order paid (the browser-facing
// Return URL is spoofable, see src/pages/checkout/return.astro). Formula
// confirmed against FIUU's docs during planning:
//   key0 = md5(tranID+orderid+status+domain+amount+currency)
//   key1 = md5(paydate+domain+key0+appcode+secret_key)
// skey must equal key1 (constant-time compare).
export function verifyNotificationSignature(fields: FiuuNotificationFields): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  if (!secretKey) return false;

  const key0 = md5(fields.tranID + fields.orderid + fields.status + fields.domain + fields.amount + fields.currency);
  const key1 = md5(fields.paydate + fields.domain + key0 + fields.appcode + secretKey);
  return safeEqual(key1, fields.skey);
}

// FIUU requires the merchant to ack a Notification URL delivery by echoing
// back every received field plus treq=1, or it retries every ~15 min up
// to 4 times.
export function buildAckBody(fields: Record<string, string>): string {
  return new URLSearchParams({ ...fields, treq: '1' }).toString();
}

export type RefundResult = { ok: true } | { ok: false; code: string; retryable: boolean };

// Full/partial refund, up to 180 days post-transaction (per FIUU's docs).
// For the payment_stock_conflict fallback (in-store sold the item during
// an online hold) — not wired to any UI yet, see scripts/schema.sql's
// 'refunded' status note. Same hash-signature pattern as above.
export async function refundTransaction(input: {
  txnId: string;
  refId: string;
  amountCents: number;
}): Promise<RefundResult> {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const secretKey = process.env.FIUU_SECRET_KEY!;
  const amount = (input.amountCents / 100).toFixed(2);
  const signature = md5(`${input.txnId}${merchantId}${amount}${secretKey}`);

  // TODO: confirm the real refund endpoint URL once sandbox credentials +
  // FIUU's integration guide are in hand.
  const res = await fetch(isSandbox() ? 'https://sandbox.merchant.razer.com/RMS/API/refund/' : 'https://pay.fiuu.com/RMS/API/refund/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      MerchantID: merchantId,
      RefID: input.refId,
      TxnID: input.txnId,
      Amount: amount,
      Signature: signature,
    }).toString(),
  });

  if (!res.ok) return { ok: false, code: `HTTP_${res.status}`, retryable: true };
  const text = await res.text();
  // TODO: parse FIUU's actual PR001-PR020 error-code response format once
  // confirmed against the live API — treating any non-"success" response
  // as a non-retryable failure for now, safer default than assuming retry.
  if (!/success/i.test(text)) return { ok: false, code: text.slice(0, 50), retryable: false };
  return { ok: true };
}

export type RequeryResult =
  | { ok: true; status: 'paid' | 'failed' | 'pending'; tranId?: string }
  | { ok: false; error: string };

// Reconciliation for a pending/expired order whose webhook never arrived
// (see src/pages/api/admin/orders.ts's 'reconcile' action) — queries
// FIUU's Requery API by our own fiuu_orderid. Field names/endpoint are a
// placeholder pending FIUU's real Merchant Request API docs (confirmed
// during planning only that a Requery API exists, by TxnID/OrderID — not
// its exact request/response shape).
export async function requeryTransaction(fiuuOrderId: string): Promise<RequeryResult> {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const secretKey = process.env.FIUU_SECRET_KEY!;
  const signature = md5(`${fiuuOrderId}${merchantId}${secretKey}`);

  // TODO: confirm the real requery endpoint URL + response shape.
  const res = await fetch(isSandbox() ? 'https://sandbox.merchant.razer.com/RMS/API/requery/' : 'https://pay.fiuu.com/RMS/API/requery/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MerchantID: merchantId, OrderID: fiuuOrderId, Signature: signature }).toString(),
  });

  if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
  const text = await res.text();
  // TODO: parse the real response format once confirmed.
  if (/^00/.test(text)) return { ok: true, status: 'paid' };
  if (/^11/.test(text)) return { ok: true, status: 'failed' };
  return { ok: true, status: 'pending' };
}

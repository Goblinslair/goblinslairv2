import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadDotEnv } from './load-env';

loadDotEnv();

// FIUU (formerly Razer Merchant Services) — payment gateway for
// click-and-collect checkout. Isolated in this one file so it's a clean
// drop-in once real sandbox/production credentials exist. Requests are
// x-www-form-urlencoded, not JSON, per FIUU's own convention — the one
// deliberate exception to this codebase's usual JSON API bodies.
//
// Endpoints/field names/signature formulas below are confirmed against
// FIUU's official "API Specifications for Hosted Payment Page + 3
// Endpoints + General Operational Functions" doc (v13.97), read directly
// from github.com/FiuuPayment/Documentation-Fiuu_API_Spec.

function isSandbox(): boolean {
  return (process.env.FIUU_SANDBOX ?? 'true').toLowerCase() !== 'false';
}

// Merchant ID is part of the URL path (not a form field) — confirmed
// pattern: https://pay.fiuu.com/RMS/pay/{MerchantID}/{Payment_Method}.
// {Payment_Method} is omitted here (channel selection stays enabled on
// the hosted page).
const HOSTED_PAGE_BASE = isSandbox()
  ? 'https://sandbox-payment.fiuu.com/RMS/pay/'
  : 'https://pay.fiuu.com/RMS/pay/';

// Non-payment-flow service APIs (refund, requery) use a separate FQDN —
// per FIUU's docs, sandbox only swaps the *payment* host; these stay on
// api.fiuu.com in both sandbox and production.
const API_BASE = 'https://api.fiuu.com';

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
  customerMobile: string;
  billDesc: string;
  returnUrl: string;
  notifyUrl: string;
}

// Builds the signed field set for the redirect to FIUU's hosted payment
// page. This is a form POST (auto-submitted client-side), not a GET
// redirect.
export function buildHostedPagePayload(order: HostedPageOrder): { url: string; fields: Record<string, string> } {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const verifyKey = process.env.FIUU_VERIFY_KEY!;
  const amountStr = order.amount.toFixed(2);

  // Confirmed formula (plain, non-extended form): vcode = md5(amount +
  // merchantID + orderid + verify_key). This assumes the merchant portal's
  // "Use extended format for Verify Payment" toggle (which would also fold
  // currency into the hash) stays OFF — fine for a single-currency (MYR)
  // shop. If that toggle is ever enabled in the portal, this formula must
  // also append currency, or every payment request will fail vcode check.
  const vcode = md5(`${amountStr}${merchantId}${order.fiuuOrderId}${verifyKey}`);

  return {
    url: `${HOSTED_PAGE_BASE}${merchantId}/`,
    fields: {
      amount: amountStr,
      orderid: order.fiuuOrderId,
      bill_name: order.customerName,
      bill_email: order.customerEmail,
      bill_mobile: order.customerMobile,
      bill_desc: order.billDesc,
      country: 'MY',
      currency: order.currency,
      vcode,
      returnurl: order.returnUrl,
      callbackurl: order.notifyUrl, // FIUU's real field name for both callback + notification URL
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

// Full/partial refund, up to 180 days post-transaction (per FIUU's docs)
// via the "Advanced Full/Partial Refund" API. For the
// payment_stock_conflict fallback (in-store sold the item during an
// online hold) — not wired to any UI yet, see scripts/schema.sql's
// 'refunded' status note. RefundType 'P' with the full order amount acts
// as a full refund — FIUU's spec only documents 'P' (partial) explicitly,
// so this is the one universal path for both full and partial cases.
export async function refundTransaction(input: {
  txnId: string; // FIUU's own TranID (order.fiuu_tran_id), not our orderid
  refId: string;
  amountCents: number;
}): Promise<RefundResult> {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const secretKey = process.env.FIUU_SECRET_KEY!;
  const amount = (input.amountCents / 100).toFixed(2);
  const refundType = 'P';
  // Signature = md5(RefundType + MerchantID + RefID + TxnID + Amount + secret_key)
  const signature = md5(`${refundType}${merchantId}${input.refId}${input.txnId}${amount}${secretKey}`);

  const res = await fetch(`${API_BASE}/RMS/API/refundAPI/index.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      RefundType: refundType,
      MerchantID: merchantId,
      RefID: input.refId,
      TxnID: input.txnId,
      Amount: amount,
      Signature: signature,
    }).toString(),
  });

  if (!res.ok) return { ok: false, code: `HTTP_${res.status}`, retryable: true };
  const json = await res.json().catch(() => null);
  // On error FIUU returns {error_code, error_desc} instead of Status.
  if (!json || json.error_code) return { ok: false, code: json?.error_code ?? 'UNKNOWN', retryable: false };
  // Status: 22 pending, 00 success, 11 rejected (per Advanced Refund spec).
  if (json.Status === '22' || json.Status === '00') return { ok: true };
  return { ok: false, code: json.reason ?? json.Status ?? 'REJECTED', retryable: false };
}

export type RequeryResult =
  | { ok: true; status: 'paid' | 'failed' | 'pending'; tranId?: string }
  | { ok: false; error: string };

// Reconciliation for a pending/expired order whose webhook never arrived
// (see src/pages/api/admin/orders.ts's 'reconcile' action) — queries
// FIUU's "Query by order ID" Indirect Status Requery API by our own
// fiuu_orderid. Needs the order's own amount since it's part of the skey
// signature (binds the signed request to a specific charge, not just an
// order id).
export async function requeryTransaction(fiuuOrderId: string, amount: number): Promise<RequeryResult> {
  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const verifyKey = process.env.FIUU_VERIFY_KEY!;
  const amountStr = amount.toFixed(2);
  // skey = md5(oID + domain + verify_key + amount)
  const skey = md5(`${fiuuOrderId}${merchantId}${verifyKey}${amountStr}`);

  const url = new URL(`${API_BASE}/RMS/query/q_by_oid.php`);
  url.searchParams.set('amount', amountStr);
  url.searchParams.set('oID', fiuuOrderId);
  url.searchParams.set('domain', merchantId);
  url.searchParams.set('skey', skey);
  url.searchParams.set('type', '2'); // JSON response

  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
  const json = await res.json().catch(() => null);
  if (!json) return { ok: false, error: 'Invalid response from FIUU' };

  // StatCode: 00 success, 11 failure, 22 pending/authorized (FPX-B2B/M2E).
  if (json.StatCode === '00') return { ok: true, status: 'paid', tranId: json.TranID };
  if (json.StatCode === '11') return { ok: true, status: 'failed' };
  return { ok: true, status: 'pending' };
}

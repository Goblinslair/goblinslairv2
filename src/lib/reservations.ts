import { sql } from './db';

// Stock a pending click-and-collect checkout has soft-reserved but not yet
// paid for. Needed so a second customer's page shows reduced availability
// even though Loyverse's own /inventory hasn't been touched yet (that only
// happens once a paid order's webhook creates the receipt, see
// src/lib/order-fulfillment.ts). Expires lazily — always filters
// reserved_until > now(), so an abandoned checkout frees stock back up on
// its own with no cron, matching how this codebase avoids background jobs
// it doesn't need (see the "expired" status note in scripts/schema.sql).
export async function getReservedQtyMap(): Promise<Map<string, number>> {
  const rows = await sql<{ items: { variantId: string | null; qty: number }[] }[]>`
    SELECT items FROM orders WHERE status = 'pending' AND reserved_until > now()
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    for (const item of row.items) {
      if (!item.variantId) continue;
      map.set(item.variantId, (map.get(item.variantId) ?? 0) + item.qty);
    }
  }
  return map;
}

export async function getReservedQtyForVariant(variantId: string): Promise<number> {
  return (await getReservedQtyMap()).get(variantId) ?? 0;
}

import { loadDotEnv } from './load-env';

loadDotEnv();

const BASE_URL = 'https://api.loyverse.com/v1.0';
const CACHE_MS = 20_000;

function getToken(): string | null {
  return process.env.LOYVERSE_ACCESS_TOKEN || null;
}

// Resolves which store's stock to read — same logic as scripts/sync-products.mjs:
// explicit LOYVERSE_STORE_ID if set, otherwise the account's first store.
let cachedStoreId: string | null = null;
export async function getStoreId(): Promise<string | null> {
  if (process.env.LOYVERSE_STORE_ID) return process.env.LOYVERSE_STORE_ID;
  if (cachedStoreId) return cachedStoreId;

  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BASE_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = await res.json();
    const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
    const stores = listKey ? json[listKey] : [];
    cachedStoreId = stores[0]?.id ?? null;
    return cachedStoreId;
  } catch {
    return null;
  }
}

// Full-store stock map, cached for CACHE_MS so concurrent requests within a
// warm serverless instance share one Loyverse call instead of each firing
// their own — stock is still fresh within that window, effectively
// real-time for a shop this size. Never throws: callers fall back to the
// synced snapshot's stock value on any failure.
let stockCache: { storeId: string; data: Map<string, number>; expiresAt: number } | null = null;

export async function getLiveStockMap(storeId: string): Promise<Map<string, number> | null> {
  if (stockCache && stockCache.storeId === storeId && stockCache.expiresAt > Date.now()) {
    return stockCache.data;
  }

  const token = getToken();
  if (!token) return null;

  try {
    const map = new Map<string, number>();
    let cursor: string | undefined;
    do {
      const url = new URL(`${BASE_URL}/inventory`);
      url.searchParams.set('store_ids', storeId);
      url.searchParams.set('limit', '250');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const json = await res.json();
      const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
      for (const level of listKey ? json[listKey] : []) {
        map.set(level.variant_id, level.in_stock);
      }
      cursor = json.cursor;
    } while (cursor);

    stockCache = { storeId, data: map, expiresAt: Date.now() + CACHE_MS };
    return map;
  } catch {
    return null;
  }
}

// Single-item lookup for the product detail page — far cheaper than pulling
// the whole store's inventory to overlay one product's stock.
export async function getLiveStockForVariant(storeId: string, variantId: string): Promise<number | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = new URL(`${BASE_URL}/inventory`);
    url.searchParams.set('store_ids', storeId);
    url.searchParams.set('variant_ids', variantId);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = await res.json();
    const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
    const level = listKey ? json[listKey][0] : undefined;
    return level ? level.in_stock : null;
  } catch {
    return null;
  }
}

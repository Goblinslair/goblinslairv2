import { loadDotEnv } from './load-env';
import { sql } from './db';
import { getStoreId } from './loyverse-stock';
import { clearProductCache } from './products';

loadDotEnv();

// Pulls the live catalog from Loyverse POS into the `products` table.
// Called by POST /api/admin/sync-products — the admin "Sync products now"
// button, and the droplet's hourly timer (which calls that same endpoint
// with SYNC_SECRET). Replaces the old scripts/sync-products.mjs, which wrote
// JSON files and needed a git commit + redeploy for changes to show.

const BASE_URL = 'https://api.loyverse.com/v1.0';

// Categories that aren't retail products (deposits, services, in-store-only
// stock, etc.) — excluded from the site entirely, not just hidden in the UI.
const EXCLUDED_CATEGORIES = new Set(
  [
    'Deposit',
    'Food and Drinks',
    'Gaming Tools',
    // Hidden for now, to be added back when there is more range (remove the
    // four lines below and sync again to bring them back).
    'Black Library',
    'White Dwarf',
    'Starter Products',
    'Hobby Heresy',
    'Membership',
    'Painting & Modelling Tools',
    'Payments & Services',
    'Plastic Moon Arts',
    'Store Exclusives',
    'Vallejo Paints',
    'Warmachine',
  ].map((c) => c.toLowerCase())
);

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loyverseGet(token: string, endpoint: string, params: Record<string, string> = {}): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  let listKey: string | undefined;
  do {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set('limit', '250');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Loyverse ${endpoint} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    listKey = listKey || Object.keys(json).find((k) => Array.isArray(json[k]));
    results.push(...(listKey ? json[listKey] : []));
    cursor = json.cursor;
  } while (cursor);
  return results;
}

export interface SyncResult {
  synced: number;
  removed: number;
}

async function runSync(): Promise<SyncResult> {
  const token = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!token) throw new Error('LOYVERSE_ACCESS_TOKEN is not set.');

  const storeId = await getStoreId();
  if (!storeId) throw new Error('Could not find a Loyverse store.');

  const [categories, allItems, inventoryLevels] = await Promise.all([
    loyverseGet(token, '/categories'),
    loyverseGet(token, '/items'),
    loyverseGet(token, '/inventory', { store_ids: storeId }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const stockByVariantId = new Map(inventoryLevels.map((lvl) => [lvl.variant_id, lvl.in_stock]));
  const items = allItems.filter((item) => !item.deleted_at);

  const usedSlugs = new Set<string>();
  const rows = [];

  for (const item of items) {
    const categoryName = categoryNameById.get(item.category_id) || 'Uncategorized';
    if (EXCLUDED_CATEGORIES.has(categoryName.toLowerCase())) continue;

    const variant = item.variants?.[0];
    if (!variant) continue;

    const storeOverride = variant.stores?.find((s: any) => s.store_id === storeId);
    const price = storeOverride?.price ?? variant.default_price ?? 0;
    const availableForSale = storeOverride?.available_for_sale ?? true;
    if (!availableForSale) continue;

    let slug = slugify(item.item_name) || item.id.slice(0, 8);
    if (usedSlugs.has(slug)) slug = `${slug}-${item.id.slice(0, 8)}`;
    usedSlugs.add(slug);

    rows.push({
      slug,
      name: item.item_name,
      description: item.description ? item.description.trim() : '',
      category: categoryName,
      price,
      image: item.image_url || null,
      sku: variant.sku || null,
      stock: item.track_stock ? (stockByVariantId.get(variant.variant_id) ?? 0) : null,
      variant_id: variant.variant_id || null,
    });
  }

  // An empty result almost certainly means Loyverse returned something odd,
  // not that the shop sold everything — refuse rather than wipe the catalog.
  if (rows.length === 0) throw new Error('Loyverse returned no products. Catalog left unchanged.');

  const slugs = rows.map((r) => r.slug);
  const removed = await sql.begin(async (tx) => {
    await tx`
      INSERT INTO products ${tx(rows, 'slug', 'name', 'description', 'category', 'price', 'image', 'sku', 'stock', 'variant_id')}
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        image = EXCLUDED.image,
        sku = EXCLUDED.sku,
        stock = EXCLUDED.stock,
        variant_id = EXCLUDED.variant_id,
        synced_at = now()
    `;
    const deleted = await tx`DELETE FROM products WHERE NOT (slug = ANY(${slugs}))`;
    return deleted.count;
  });

  clearProductCache();
  return { synced: rows.length, removed };
}

// One sync at a time — a button click landing during the hourly run just
// waits for (and reports) the run already in progress.
let running: Promise<SyncResult> | null = null;

export function syncProducts(): Promise<SyncResult> {
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
}

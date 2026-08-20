// Pulls the live catalog from Loyverse POS and writes it into
// src/content/products/*.json as a static snapshot for the site to build from.
// Run with: npm run sync-products
// Requires LOYVERSE_ACCESS_TOKEN (and optionally LOYVERSE_STORE_ID) in .env

import { readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'src', 'content', 'products');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const TOKEN = process.env.LOYVERSE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Missing LOYVERSE_ACCESS_TOKEN. Add it to .env in the project root.');
  process.exit(1);
}

const BASE_URL = 'https://api.loyverse.com/v1.0';

async function loyverseGet(endpoint, params = {}) {
  const results = [];
  let cursor;
  let listKey;
  do {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set('limit', '250');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Loyverse ${endpoint} failed: ${res.status} ${body}`);
    }
    const json = await res.json();
    listKey = listKey || Object.keys(json).find((k) => Array.isArray(json[k]));
    results.push(...json[listKey]);
    cursor = json.cursor;
  } while (cursor);
  return results;
}

// Categories that aren't retail products (deposits, services, in-store-only
// stock, etc.) — excluded from the site entirely, not just hidden in the UI.
const EXCLUDED_CATEGORIES = new Set(
  [
    'Deposit',
    'Food and Drinks',
    'Gaming Tools',
    'Membership',
    'Painting & Modelling Tools',
    'Payments & Services',
    'Plastic Moon Arts',
    'Store Exclusives',
    'Vallejo Paints',
    'Warmachine',
  ].map((c) => c.toLowerCase())
);

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Fetching stores...');
  const stores = await loyverseGet('/stores');
  if (!stores.length) throw new Error('No stores found on this Loyverse account.');

  let storeId = process.env.LOYVERSE_STORE_ID;
  if (!storeId) {
    storeId = stores[0].id;
    if (stores.length > 1) {
      console.log(
        `Found ${stores.length} stores, using "${stores[0].name}" (${storeId}). ` +
          `Set LOYVERSE_STORE_ID in .env to pick a different one.`
      );
    }
  }

  console.log('Fetching categories...');
  const categories = await loyverseGet('/categories');
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  console.log('Fetching items...');
  const items = (await loyverseGet('/items')).filter((item) => !item.deleted_at);

  console.log('Fetching inventory levels...');
  const inventoryLevels = await loyverseGet('/inventory', { store_ids: storeId });
  const stockByVariantId = new Map(inventoryLevels.map((lvl) => [lvl.variant_id, lvl.in_stock]));

  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(outDir)) {
    if (file.endsWith('.json')) unlinkSync(path.join(outDir, file));
  }

  const usedSlugs = new Set();
  let written = 0;

  for (const item of items) {
    const categoryName = categoryNameById.get(item.category_id) || 'Uncategorized';
    if (EXCLUDED_CATEGORIES.has(categoryName.toLowerCase())) continue;

    const variant = item.variants?.[0];
    if (!variant) continue;

    const storeOverride = variant.stores?.find((s) => s.store_id === storeId);
    const price = storeOverride?.price ?? variant.default_price ?? 0;
    const availableForSale = storeOverride?.available_for_sale ?? true;
    if (!availableForSale) continue;

    let slug = slugify(item.item_name) || item.id.slice(0, 8);
    if (usedSlugs.has(slug)) slug = `${slug}-${item.id.slice(0, 8)}`;
    usedSlugs.add(slug);

    const product = {
      name: item.item_name,
      description: item.description ? item.description.trim() : '',
      category: categoryName,
      price,
      image: item.image_url || null,
      sku: variant.sku || null,
      stock: item.track_stock ? (stockByVariantId.get(variant.variant_id) ?? 0) : null,
      variantId: variant.variant_id || null,
    };

    writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(product, null, 2));
    written += 1;
  }

  console.log(`Synced ${written} product(s) from Loyverse into src/content/products/.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

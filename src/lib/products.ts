import { sql } from './db';

// Reads the product catalog from the `products` table (filled by
// src/lib/product-sync.ts). Same { id, data } shape the old `products`
// content collection had, so pages only swap the import.

export interface ProductData {
  name: string;
  description: string;
  category: string;
  price: number;
  image: string | null;
  sku: string | null;
  stock: number | null;
  variantId: string | null;
}

export interface Product {
  id: string;
  data: ProductData;
}

// Catalog only changes on a sync, so keep it in memory for a minute — most
// page views never touch the database (also hides Neon's cold start). A sync
// clears this straight away so new prices show on the next view.
const CACHE_MS = 60_000;
let cache: { products: Product[]; expiresAt: number } | null = null;

export function clearProductCache() {
  cache = null;
}

async function loadProducts(): Promise<Product[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.products;

  const rows = await sql<{
    slug: string; name: string; description: string; category: string; price: string;
    image: string | null; sku: string | null; stock: number | null; variant_id: string | null;
  }[]>`
    SELECT slug, name, description, category, price, image, sku, stock, variant_id
    FROM products
    ORDER BY slug
  `;
  const products = rows.map((r) => ({
    id: r.slug,
    data: {
      name: r.name,
      description: r.description,
      category: r.category,
      price: Number(r.price),
      image: r.image,
      sku: r.sku,
      stock: r.stock,
      variantId: r.variant_id,
    },
  }));
  cache = { products, expiresAt: Date.now() + CACHE_MS };
  return products;
}

// Returns fresh copies: pages overwrite `data.stock` with live stock, and
// that must never leak back into the shared cache.
function copy(p: Product): Product {
  return { id: p.id, data: { ...p.data } };
}

export async function getAllProducts(): Promise<Product[]> {
  return (await loadProducts()).map(copy);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const found = (await loadProducts()).find((p) => p.id === slug);
  return found ? copy(found) : undefined;
}

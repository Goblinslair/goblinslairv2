import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
  }),
});

// Synced from Loyverse POS via `npm run sync-products` (see scripts/sync-products.mjs).
// Files in src/content/products/ are generated output, not hand-authored.
const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    description: z.string().default(''),
    category: z.string(),
    price: z.number(),
    image: z.string().nullable().default(null),
    sku: z.string().nullable().default(null),
    stock: z.number().nullable().default(null),
    variantId: z.string().nullable().default(null),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
  }),
});

export const collections = { blog, products, events };

import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// No production domain assigned yet - set SITE_URL in Vercel's env vars once
// one is. Everything below (sitemap, canonical tags, OG/Twitter meta,
// LocalBusiness schema) reads Astro.site, so this is the one line to fix.
const site = process.env.SITE_URL || 'https://example.com';

// products/[slug] opts into server rendering (see below), so Astro's own
// build manifest never sees those routes and the sitemap integration can't
// find them automatically. Read the same synced JSON files sync-products.mjs
// writes and list them explicitly instead.
const productSlugs = readdirSync(new URL('./src/content/products/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

// output: 'static' by default — most pages still build to plain HTML/CSS/JS
// with no server involved. Individual routes can opt into server rendering
// with `export const prerender = false` (used by the product item page,
// which renders per-request from live-synced product data instead of
// pre-building one HTML file per product).
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  site,
  integrations: [
    sitemap({
      customPages: productSlugs.map((slug) => `${site}/products/${slug}`),
    }),
  ],
  // sharp ships a native .node binary (used by src/pages/api/admin/upload.ts)
  // that the server bundler can't inline — keep it external so Vercel's file
  // tracer picks up the real platform binary instead of a broken bundled stub.
  vite: {
    ssr: {
      external: ['sharp'],
    },
  },
});

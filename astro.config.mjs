import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// output: 'static' by default — most pages still build to plain HTML/CSS/JS
// with no server involved. Individual routes can opt into server rendering
// with `export const prerender = false` (used by the product item page,
// which renders per-request from live-synced product data instead of
// pre-building one HTML file per product).
export default defineConfig({
  output: 'static',
  adapter: vercel(),
});

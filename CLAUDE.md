# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A marketing/blog website for "Goblin's Lair," a Warhammer 40,000 / Age of Sigmar tabletop hobby shop, built with Astro. Output is `'static'` in `astro.config.mjs` (most pages prerender to plain HTML/CSS/JS), but the site now runs the `@astrojs/vercel` adapter so individual routes can opt into on-demand server rendering with `export const prerender = false` — used by the product item page (see Architecture below), which needs to serve hundreds of products without pre-building a file per product. Hosted on Vercel; `npm run build` outputs to `.vercel/output/` (Vercel's format) rather than a plain portable `dist/` now that a server route exists — deploying elsewhere would need a different Astro adapter for that host, or dropping the dynamic product route back to static generation.

## Commands

```
npm install          # install deps
npm run dev           # start local dev server (usually http://localhost:4321)
npm run build         # build for Vercel (outputs to .vercel/output/)
npm run preview       # serve the build locally
npm run sync-products  # pull the live catalog from Loyverse POS into src/content/products/
```

There is no test suite, linter, or type-checker configured in this repo.

## Architecture

- **Pages** (`src/pages/`) are file-based routes: `index.astro`, `about.astro`, `products.astro`, `contact.astro`, `blog/index.astro` (listing), `blog/[slug].astro` (dynamic post route via `getStaticPaths`, prerendered — one HTML file per post), `products/[slug].astro` (dynamic product route, **not** prerendered — renders per-request on Vercel instead of generating hundreds of files). Every page wraps its content in `src/layouts/BaseLayout.astro`, which owns the `<head>` (including `title`/`description`/`og:*` meta, `image` prop optional), header/nav, mobile menu markup, and footer.
- **Blog content** is an Astro Content Collection: markdown files in `src/content/blog/*.md` validated against the schema in `src/content/config.ts` (`title: string`, `date: date`, `excerpt: string`). Adding a new post is just adding a new `.md` file with that frontmatter — no other files need to change, and a page is generated automatically at `/blog/<file-name>` (slug = filename).
- **Product content** is a `'data'` Content Collection: JSON files in `src/content/products/*.json`, schema in `src/content/config.ts`. These files are **generated**, not hand-authored — `npm run sync-products` (`scripts/sync-products.mjs`) wipes and regenerates them from the Loyverse POS API (catalog, pricing, per-store stock) using `LOYVERSE_ACCESS_TOKEN` (and optional `LOYVERSE_STORE_ID`) from `.env`. Re-run it whenever the shop's catalog/stock should refresh on the site — `products.astro` (the grid) is static and only reflects the last sync until the site rebuilds; `products/[slug].astro` (the item page) reads the same synced JSON but server-renders per request, so it's as fresh as the last sync but doesn't require a rebuild to serve. Loyverse item descriptions arrive as HTML and are stripped to plain text by the sync script (`stripHtml`) before being stored. Online checkout/cart is not implemented — product pages are informational only.
- **No client-side framework or bundler-managed JS.** Interactive behavior (hero slideshow, scroll parallax, mobile menu) lives in plain vanilla JS files under `public/` (`hero-slideshow.js`, `parallax.js`, `mobile-menu.js`), each an IIFE, and is wired into pages via `<script src="..." is:inline>` tags rather than Astro component imports. Follow this pattern for new interactive widgets rather than introducing a UI framework.
- **Styling** is a single global stylesheet at `public/style.css`, linked from `BaseLayout.astro`. There are no CSS modules or scoped `<style>` blocks in use.
- **Photography** lives in `src/assets/images/` and goes through Astro's build-time image pipeline (resized, re-encoded to WebP) rather than being served verbatim from `public/`. `src/pages/index.astro` resolves it with an eager `import.meta.glob` over `*.{jpg,jpeg,png}` keyed by basename: `hero-1`–`hero-5` for the slideshow, `reason-1`–`reason-5` for the diamonds in the Reasons section. Dropping a correctly-named file in replaces the CSS gradient placeholder without touching page code; a missing name keeps its gradient. A plain-English version for non-developers is in `HOW-TO.md`.

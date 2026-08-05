# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A marketing/blog website for "Goblin's Lair," a Warhammer 40,000 / Age of Sigmar tabletop hobby shop, built with Astro in fully static output mode (`output: 'static'` in `astro.config.mjs`) — `npm run build` produces a plain `dist/` folder of HTML/CSS/JS with no server or adapter required. Currently hosted on Vercel (auto-detects Astro, no config needed), but designed to be portable to any static host by uploading `dist/` directly.

## Commands

```
npm install       # install deps
npm run dev        # start local dev server (usually http://localhost:4321)
npm run build      # produce static dist/ output
npm run preview    # serve the built dist/ locally
```

There is no test suite, linter, or type-checker configured in this repo.

## Architecture

- **Pages** (`src/pages/`) are file-based routes: `index.astro`, `about.astro`, `products.astro`, `contact.astro`, `blog/index.astro` (listing), `blog/[slug].astro` (dynamic post route via `getStaticPaths`). Every page wraps its content in `src/layouts/BaseLayout.astro`, which owns the `<head>`, header/nav, mobile menu markup, and footer — passing `title`/`description` as props.
- **Blog content** is an Astro Content Collection: markdown files in `src/content/blog/*.md` validated against the schema in `src/content/config.ts` (`title: string`, `date: date`, `excerpt: string`). Adding a new post is just adding a new `.md` file with that frontmatter — no other files need to change, and a page is generated automatically at `/blog/<file-name>` (slug = filename).
- **No client-side framework or bundler-managed JS.** Interactive behavior (hero slideshow, scroll parallax, mobile menu) lives in plain vanilla JS files under `public/` (`hero-slideshow.js`, `parallax.js`, `mobile-menu.js`), each an IIFE, and is wired into pages via `<script src="..." is:inline>` tags rather than Astro component imports. Follow this pattern for new interactive widgets rather than introducing a UI framework.
- **Styling** is a single global stylesheet at `public/style.css`, linked from `BaseLayout.astro`. There are no CSS modules or scoped `<style>` blocks in use.
- **Images** referenced by pages (e.g. hero slideshow images at `/images/hero-1.jpg`, `/images/hero-2.jpg`, `/images/hero-3.jpg` in `src/pages/index.astro`) live in `public/images/`; dropping a correctly-named file in there replaces the current placeholder without touching page code.

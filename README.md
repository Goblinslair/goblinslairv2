# Goblin's Lair — Astro Site

## Local setup
```
npm install
npm run dev
```
Then open the local URL it prints (usually http://localhost:4321).

To check a production build locally, run `npm run build` followed by
`npm run preview`, which serves the generated `dist/` folder.

## Adding a new blog post
Add a new `.md` file to `src/content/blog/` with this frontmatter, then write
the post body underneath in plain Markdown:

```
---
title: "Your Post Title"
date: 2026-08-01
excerpt: "One-line summary shown on the blog listing page."
---

Post content goes here.
```

A new page is generated automatically at `/blog/your-file-name`. No other
files need to be touched.

## Deploying
- **Vercel (current hosting):** connect this repo (via GitHub import or
  `vercel git connect`) and it will auto-detect Astro — no config needed.
- **Traditional web host (future):** run `npm run build` locally, which
  produces a plain static `dist/` folder of HTML/CSS/JS. Upload the contents
  of `dist/` to any web server, same as any static site.

## Adding real photography
Hero slideshow images are referenced in `src/pages/index.astro` as
`/images/hero-1.jpg`, `/images/hero-2.jpg`, `/images/hero-3.jpg`. Drop files
with those names into the `public/images/` folder and they'll replace the
placeholder gradient automatically.

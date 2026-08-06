# Goblin's Lair — Astro Site

## Local setup
Astro 5 requires Node 18.20.8+, 20.3+, or 22+.
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
files need to be touched. The blog listing is paginated, so older posts move
to `/blog/2`, `/blog/3`, and so on as new ones are added.

## Deploying
- **Vercel (current hosting):** connect this repo (via GitHub import or
  `vercel git connect`) and it will auto-detect Astro — no config needed.
- **Traditional web host (future):** run `npm run build` locally, which
  produces a plain static `dist/` folder of HTML/CSS/JS. Upload the contents
  of `dist/` to any web server, same as any static site.

## Adding real photography
Drop files into `src/assets/images/` using these names — `.jpg`, `.jpeg`, and
`.png` all work:

- `hero-1`, `hero-2`, `hero-3` — the homepage slideshow
- `reason-1` through `reason-5` — the diamond photos in the Reasons section

They replace the placeholder gradients automatically; a name with no matching
file just keeps its gradient. Reason photos are clipped to a diamond, so use a
square crop with the subject centred.

Astro resizes and re-encodes these to WebP at build time (heroes at 1920px
wide, diamonds at 600px), so full-resolution camera files are fine to commit —
a 4MB JPEG lands as roughly 30KB of WebP in `dist/`. The originals in
`src/assets/images/` are never modified. Because this happens at build time,
a file added while `npm run dev` is running needs a dev-server restart.

Note this is `src/assets/images/`, not `public/images/` — files in `public/`
are copied out verbatim with no optimisation.

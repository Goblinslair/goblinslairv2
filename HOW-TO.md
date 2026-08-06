# How to update the site

Three common jobs: swap a hero photo, swap a diamond photo, add a blog post.
All three are just adding or replacing files — no code to edit.

After any change: commit and push. The site rebuilds and goes live on its own.

---

## 1. Change a hero image (the big slideshow at the top)

The homepage slideshow shows up to five photos.

1. Go to the folder `src/assets/images/`.
2. Put your photo there, named `hero-1`, `hero-2`, `hero-3`, `hero-4`, or `hero-5`.
   - `.jpg`, `.jpeg`, and `.png` all work. So `hero-2.png` is fine.
   - To *replace* a slide, delete the old `hero-2.jpg` and add your new file
     as `hero-2` with whatever extension it has.
   - To *remove* a slide, just delete the file. The slideshow skips it.
3. Done. Slides play in number order.

Tips:
- Use a wide (landscape) photo. It fills the whole screen width.
- Full-size camera photos are fine. The site shrinks and compresses them
  automatically when it builds — a 4MB photo ends up around 30KB on the live
  site, and your original file is never changed.

## 2. Change a diamond image (the "Reasons" section)

Same folder, different names. Five diamonds, numbered top to bottom.

1. Go to `src/assets/images/`.
2. Put your photo there, named `reason-1` through `reason-5`
   (`.jpg`, `.jpeg`, or `.png`).
   - `reason-1` is the first diamond down the page, `reason-5` is the last.
   - Delete a file to go back to the plain gradient placeholder.

Tip: diamonds are cut into a diamond shape, so use a **square** photo with the
subject in the middle. Anything near the corners gets cut off.

## 3. Add a blog post

1. Go to the folder `src/content/blog/`.
2. Create a new file ending in `.md`. The file name becomes the web address —
   `terrain-build-watchtower.md` becomes `/blog/terrain-build-watchtower`.
   Use lowercase words with dashes, no spaces.
3. Paste this at the top of the file and fill it in:

```
---
title: "Your Post Title"
date: 2026-08-06
excerpt: "One-line summary shown on the blog listing page."
---

Write the post here in plain text.

Blank line between paragraphs.

**Bold text** uses two stars either side.
```

The three lines between the `---` marks are required — the site will refuse to
build if any are missing or misspelled. Date format is `YYYY-MM-DD`.

That's it. The post page is created automatically and appears on the blog
listing, newest first. Older posts roll onto page 2, page 3, and so on.

---

## Seeing your changes before they go live

In a terminal in this folder:

```
npm run dev
```

Open the address it prints (usually http://localhost:4321). Press `Ctrl+C` to
stop it.

One catch: if you **add a new image file** while `npm run dev` is already
running, stop it and start it again — new images are only picked up on start.

## Where images do NOT go

Put photos in `src/assets/images/`, not `public/images/`. Files in `public/`
are copied to the live site untouched, so a big photo stays big and slow.

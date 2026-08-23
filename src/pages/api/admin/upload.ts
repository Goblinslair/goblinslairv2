export const prerender = false;

import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../../lib/admin-auth';

// Keeps blog/event post images from ballooning Blob storage or per-pageview
// bandwidth — matches the resize-on-ingest treatment the site's own hero/
// reason photography already gets via Astro's build-time image pipeline.
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;
// Body arrives as base64 JSON (see below) rather than multipart/form-data —
// Astro's default CSRF check (security.checkOrigin) blocks POSTs whose
// Content-Type is multipart/form-data or urlencoded unless the Origin header
// lines up exactly right, which real-world proxies/browsers don't always
// send; every other admin route already avoids this by using JSON bodies.
// Base64 inflates size ~33%, and Vercel's Node function body limit is
// 4.5MB, so cap the raw file well under that.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !(await isValidAdminSession(token))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dataUrl = typeof body?.image === 'string' ? body.image : '';
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'No image provided.' }), { status: 400 });
  }

  const input = Buffer.from(match[1], 'base64');
  if (input.length > MAX_UPLOAD_BYTES) {
    return new Response(JSON.stringify({ error: 'Image is too large (3MB max).' }), { status: 400 });
  }

  let resized: Buffer;
  try {
    resized = await sharp(input)
      .rotate() // apply EXIF orientation before stripping metadata
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return new Response(JSON.stringify({ error: 'Could not read that image file.' }), { status: 400 });
  }

  const blob = await put(`content-images/${crypto.randomUUID()}.webp`, resized, {
    access: 'public',
    contentType: 'image/webp',
  });

  return new Response(JSON.stringify({ ok: true, url: blob.url }), { status: 200 });
};

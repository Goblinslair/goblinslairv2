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
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // guard against pasting in huge raw photos before we even try to resize

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !(await isValidAdminSession(token))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No image provided.' }), { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return new Response(JSON.stringify({ error: 'File must be an image.' }), { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return new Response(JSON.stringify({ error: 'Image is too large (15MB max).' }), { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
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

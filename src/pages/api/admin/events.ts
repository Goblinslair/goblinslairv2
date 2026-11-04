export const prerender = false;

import type { APIRoute } from 'astro';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../../lib/admin-auth';
import { sql } from '../../../lib/db';
import { clearContentCache, toDateInput } from '../../../lib/content';
import { slugify } from '../../../lib/slug';

async function requireAdmin(cookies: any) {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return token && (await isValidAdminSession(token));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readFields(body: any) {
  const image = typeof body?.image === 'string' ? body.image.trim() : '';
  return {
    title: typeof body?.title === 'string' ? body.title.trim() : '',
    date: typeof body?.date === 'string' ? body.date.trim() : '',
    excerpt: typeof body?.excerpt === 'string' ? body.excerpt.trim() : '',
    image: image || null,
  };
}

function missingFields() {
  return new Response(JSON.stringify({ error: 'Title, date, and excerpt are all required.' }), { status: 400 });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { title, date, excerpt, image } = readFields(body);
  if (!title || !DATE_RE.test(date) || !excerpt) return missingFields();

  const slug = slugify(title);
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Title needs at least one letter or number.' }), { status: 400 });
  }

  const inserted = await sql`
    INSERT INTO events (slug, title, date, excerpt, image)
    VALUES (${slug}, ${title}, ${date}, ${excerpt}, ${image})
    ON CONFLICT (slug) DO NOTHING
  `;
  if (inserted.count === 0) {
    return new Response(JSON.stringify({ error: 'An event with that title already exists.' }), { status: 409 });
  }

  clearContentCache();
  return new Response(JSON.stringify({ ok: true, slug }), { status: 200 });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const { title, date, excerpt, image } = readFields(body);
  if (!slug || !title || !DATE_RE.test(date) || !excerpt) return missingFields();

  const updated = await sql`
    UPDATE events
    SET title = ${title}, date = ${date}, excerpt = ${excerpt}, image = ${image}, updated_at = now()
    WHERE slug = ${slug}
  `;
  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: 'Event not found.' }), { status: 404 });
  }

  clearContentCache();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug.' }), { status: 400 });
  }

  const deleted = await sql`DELETE FROM events WHERE slug = ${slug}`;
  if (deleted.count === 0) {
    return new Response(JSON.stringify({ error: 'Event not found.' }), { status: 404 });
  }

  clearContentCache();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const slug = url.searchParams.get('slug') || '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug.' }), { status: 400 });
  }

  const rows = await sql<{ title: string; date: Date; excerpt: string; image: string | null }[]>`
    SELECT title, date, excerpt, image FROM events WHERE slug = ${slug}
  `;
  const event = rows[0];
  if (!event) {
    return new Response(JSON.stringify({ error: 'Event not found.' }), { status: 404 });
  }

  return new Response(JSON.stringify({ ...event, image: event.image ?? '', date: toDateInput(event.date), slug }), { status: 200 });
};

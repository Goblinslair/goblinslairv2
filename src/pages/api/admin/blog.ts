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
  return {
    title: typeof body?.title === 'string' ? body.title.trim() : '',
    date: typeof body?.date === 'string' ? body.date.trim() : '',
    excerpt: typeof body?.excerpt === 'string' ? body.excerpt.trim() : '',
    postBody: typeof body?.body === 'string' ? body.body.trim() : '',
  };
}

function missingFields() {
  return new Response(JSON.stringify({ error: 'Title, date, excerpt, and body are all required.' }), { status: 400 });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { title, date, excerpt, postBody } = readFields(body);
  if (!title || !DATE_RE.test(date) || !excerpt || !postBody) return missingFields();

  const slug = slugify(title);
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Title needs at least one letter or number.' }), { status: 400 });
  }

  const inserted = await sql`
    INSERT INTO blog_posts (slug, title, date, excerpt, body)
    VALUES (${slug}, ${title}, ${date}, ${excerpt}, ${postBody})
    ON CONFLICT (slug) DO NOTHING
  `;
  if (inserted.count === 0) {
    return new Response(JSON.stringify({ error: 'A post with that title already exists.' }), { status: 409 });
  }

  clearContentCache();
  return new Response(JSON.stringify({ ok: true, slug }), { status: 200 });
};

// Editing keeps the original slug even if the title changes, so old links
// to the post keep working.
export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const { title, date, excerpt, postBody } = readFields(body);
  if (!slug || !title || !DATE_RE.test(date) || !excerpt || !postBody) return missingFields();

  const updated = await sql`
    UPDATE blog_posts
    SET title = ${title}, date = ${date}, excerpt = ${excerpt}, body = ${postBody}, updated_at = now()
    WHERE slug = ${slug}
  `;
  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
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

  const deleted = await sql`DELETE FROM blog_posts WHERE slug = ${slug}`;
  if (deleted.count === 0) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
  }

  clearContentCache();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

// Fetches a single post for the edit form to pre-fill from.
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const slug = url.searchParams.get('slug') || '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug.' }), { status: 400 });
  }

  const rows = await sql<{ title: string; date: Date; excerpt: string; body: string }[]>`
    SELECT title, date, excerpt, body FROM blog_posts WHERE slug = ${slug}
  `;
  const post = rows[0];
  if (!post) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
  }

  return new Response(JSON.stringify({ ...post, date: toDateInput(post.date), slug }), { status: 200 });
};

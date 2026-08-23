export const prerender = false;

import type { APIRoute } from 'astro';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../../lib/admin-auth';
import { getFile, putFile, deleteFile } from '../../../lib/github-content';
import { buildMarkdown, parseFrontmatter } from '../../../lib/markdown';
import { slugify } from '../../../lib/slug';

const DIR = 'src/content/blog';

async function requireAdmin(cookies: any) {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return token && (await isValidAdminSession(token));
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  const excerpt = typeof body?.excerpt === 'string' ? body.excerpt.trim() : '';
  const postBody = typeof body?.body === 'string' ? body.body : '';

  if (!title || !date || !excerpt || !postBody.trim()) {
    return new Response(JSON.stringify({ error: 'Title, date, excerpt, and body are all required.' }), { status: 400 });
  }

  const slug = slugify(title);
  const path = `${DIR}/${slug}.md`;

  const existing = await getFile(path);
  if (existing) {
    return new Response(JSON.stringify({ error: 'A post with that title already exists.' }), { status: 409 });
  }

  await putFile(path, buildMarkdown({ title, date, excerpt }, postBody), `chore: add blog post "${title}" via admin panel`);

  return new Response(JSON.stringify({ ok: true, slug }), { status: 200 });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  const excerpt = typeof body?.excerpt === 'string' ? body.excerpt.trim() : '';
  const postBody = typeof body?.body === 'string' ? body.body : '';

  if (!slug || !title || !date || !excerpt || !postBody.trim()) {
    return new Response(JSON.stringify({ error: 'Title, date, excerpt, and body are all required.' }), { status: 400 });
  }

  const path = `${DIR}/${slug}.md`;
  const existing = await getFile(path);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
  }

  await putFile(path, buildMarkdown({ title, date, excerpt }, postBody), `chore: update blog post "${title}" via admin panel`, existing.sha);

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

  const path = `${DIR}/${slug}.md`;
  const existing = await getFile(path);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
  }

  await deleteFile(path, existing.sha, `chore: delete blog post "${slug}" via admin panel`);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

// Fetches and parses a single post for the edit form to pre-fill from.
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await requireAdmin(cookies))) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  }

  const slug = url.searchParams.get('slug') || '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug.' }), { status: 400 });
  }

  const file = await getFile(`${DIR}/${slug}.md`);
  if (!file) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), { status: 404 });
  }

  return new Response(JSON.stringify({ ...parseFrontmatter(file.content), slug }), { status: 200 });
};

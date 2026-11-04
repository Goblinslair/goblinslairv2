import { marked } from 'marked';
import { sql } from './db';

// Blog posts and homepage events, stored in the `blog_posts` and `events`
// tables and written by the /admin panel. Same { id, data } shape the old
// content collections had, so pages only swap the import. Saving in /admin
// is live on the next page view — no commit, no rebuild.

export interface BlogPost {
  id: string;
  data: { title: string; date: Date; excerpt: string };
  body: string;
}

export interface SiteEvent {
  id: string;
  data: { title: string; date: Date; excerpt: string; image: string | null };
}

// Content only changes when staff save in /admin, which clears this, so a
// short cache just saves a database round trip on busy minutes.
const CACHE_MS = 60_000;
let postsCache: { posts: BlogPost[]; expiresAt: number } | null = null;
let eventsCache: { events: SiteEvent[]; expiresAt: number } | null = null;

export function clearContentCache() {
  postsCache = null;
  eventsCache = null;
}

// Newest first.
export async function listPosts(): Promise<BlogPost[]> {
  if (postsCache && postsCache.expiresAt > Date.now()) return postsCache.posts;
  const rows = await sql<{ slug: string; title: string; date: Date; excerpt: string; body: string }[]>`
    SELECT slug, title, date, excerpt, body FROM blog_posts ORDER BY date DESC, slug
  `;
  const posts = rows.map((r) => ({
    id: r.slug,
    data: { title: r.title, date: r.date, excerpt: r.excerpt },
    body: r.body,
  }));
  postsCache = { posts, expiresAt: Date.now() + CACHE_MS };
  return posts;
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (await listPosts()).find((p) => p.id === slug);
}

// Soonest first.
export async function listEvents(): Promise<SiteEvent[]> {
  if (eventsCache && eventsCache.expiresAt > Date.now()) return eventsCache.events;
  const rows = await sql<{ slug: string; title: string; date: Date; excerpt: string; image: string | null }[]>`
    SELECT slug, title, date, excerpt, image FROM events ORDER BY date, slug
  `;
  const events = rows.map((r) => ({
    id: r.slug,
    data: { title: r.title, date: r.date, excerpt: r.excerpt, image: r.image },
  }));
  eventsCache = { events, expiresAt: Date.now() + CACHE_MS };
  return events;
}

// Post bodies are Markdown typed by staff in /admin (a trusted, password-
// gated source — same trust the old hand-committed .md files had).
export function renderMarkdown(body: string): string {
  return marked.parse(body, { async: false });
}

// DATE columns come back as a Date at UTC midnight; the admin forms'
// <input type="date"> wants plain YYYY-MM-DD.
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

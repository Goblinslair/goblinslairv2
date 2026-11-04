// One-off: copies the old src/content/blog/*.md and src/content/events/*.md
// files into the blog_posts and events tables (scripts/add-content-tables.sql
// must be run first). Rows that already exist are left alone, so running it
// twice is harmless.
//
//   node scripts/import-content.mjs
//
// The .md files were removed from the repo once imported. To run this again,
// restore them first: git checkout dfc6909 -- src/content/blog src/content/events

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Same flat frontmatter the admin panel used to write: quoted title/excerpt,
// plain date, optional plain image URL.
function parse(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found.');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    let value = line.slice(colon + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    fields[line.slice(0, colon).trim()] = value;
  }
  return { ...fields, body: match[2].trim() };
}

function readDir(dir) {
  const full = path.join(root, 'src', 'content', dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ slug: f.replace(/\.md$/, ''), ...parse(readFileSync(path.join(full, f), 'utf-8')) }));
}

loadEnv();
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to .env in the project root.');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL);

const posts = readDir('blog');
const events = readDir('events');
let addedPosts = 0;
let addedEvents = 0;

for (const p of posts) {
  const r = await sql`
    INSERT INTO blog_posts (slug, title, date, excerpt, body)
    VALUES (${p.slug}, ${p.title}, ${p.date}, ${p.excerpt}, ${p.body})
    ON CONFLICT (slug) DO NOTHING
  `;
  addedPosts += r.count;
}
for (const e of events) {
  const r = await sql`
    INSERT INTO events (slug, title, date, excerpt, image)
    VALUES (${e.slug}, ${e.title}, ${e.date}, ${e.excerpt}, ${e.image || null})
    ON CONFLICT (slug) DO NOTHING
  `;
  addedEvents += r.count;
}

console.log(`Blog posts: ${addedPosts} added (${posts.length} found). Events: ${addedEvents} added (${events.length} found).`);
await sql.end();

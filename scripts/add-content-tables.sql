-- One-off: adds the blog_posts and events tables to a database created
-- before they existed in scripts/schema.sql. Run once against your existing
-- Neon database (SQL editor, or
-- `psql "$DATABASE_URL" -f scripts/add-content-tables.sql`).
-- Safe to skip on a brand new database — schema.sql already includes them.
-- Then run `node scripts/import-content.mjs` once to copy in the old
-- src/content/{blog,events}/*.md files (from git history if already deleted).

CREATE TABLE IF NOT EXISTS blog_posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  excerpt TEXT NOT NULL,
  -- Markdown, rendered to HTML per request by src/lib/content.ts
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  excerpt TEXT NOT NULL,
  -- Featured-image URL, shown only on the homepage's highlighted event card
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

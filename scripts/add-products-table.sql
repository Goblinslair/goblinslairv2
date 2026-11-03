-- One-off: adds the products table to a database created before it existed
-- in scripts/schema.sql. Run once against your existing Neon database (SQL
-- editor, or `psql "$DATABASE_URL" -f scripts/add-products-table.sql`).
-- Safe to skip on a brand new database — schema.sql already includes it.
-- The table starts empty: run a product sync afterwards to fill it.

CREATE TABLE IF NOT EXISTS products (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  image TEXT,
  sku TEXT,
  stock INTEGER,
  variant_id TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

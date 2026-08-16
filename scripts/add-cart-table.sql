-- One-off: adds the carts table to a database created before it existed in
-- scripts/schema.sql. Run once against your existing Neon database (SQL
-- editor, or `psql "$DATABASE_URL" -f scripts/add-cart-table.sql`).
-- Safe to skip on a brand new database — schema.sql already includes it.

CREATE TABLE IF NOT EXISTS carts (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

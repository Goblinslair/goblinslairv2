-- One-off: adds the "name" column to a database created before it existed
-- in scripts/schema.sql. Run once against your existing Neon database (SQL
-- editor, or `psql "$DATABASE_URL" -f scripts/add-customer-name.sql`).
-- Safe to skip on a brand new database — schema.sql already includes it.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS name TEXT;

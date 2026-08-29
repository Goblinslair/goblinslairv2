-- One-off: adds delivery-option columns to the orders table on a database
-- created before delivery existed (the orders table itself came from
-- scripts/add-orders-table.sql). Run once against your existing Neon
-- database (SQL editor, or `psql "$DATABASE_URL" -f scripts/add-order-delivery-columns.sql`).
-- Safe to skip on a brand new database — scripts/schema.sql already
-- includes these columns in its CREATE TABLE orders.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'pickup'
  CHECK (fulfillment_method IN ('pickup', 'delivery'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;

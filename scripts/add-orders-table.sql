-- One-off: adds the orders table to a database created before it existed
-- in scripts/schema.sql. Run once against your existing Neon database (SQL
-- editor, or `psql "$DATABASE_URL" -f scripts/add-orders-table.sql`).
-- Safe to skip on a brand new database — schema.sql already includes it.

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled','expired','fulfilled','refunded','payment_stock_conflict')),
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  fiuu_orderid TEXT UNIQUE NOT NULL,
  fiuu_tran_id TEXT,
  loyverse_receipt_id TEXT,
  reserved_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_reservation_idx ON orders (status, reserved_until);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);

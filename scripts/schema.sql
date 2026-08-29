-- Run once against the Neon database (Neon's SQL editor, or
-- `psql "$DATABASE_URL" -f scripts/schema.sql`). No migration framework in
-- this repo — see HOW-TO.md / CLAUDE.md for the rest of the setup.

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE carts (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single shared admin identity (one site-wide password, see
-- ADMIN_PASSWORD_HASH) rather than a customer flag, so a valid token here
-- is sufficient on its own — no admin_id/foreign key needed.
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Fixed-window counter shared by the login/signup/admin-login routes (see
-- src/lib/rate-limit.ts) — one row per (route, client IP), reset once the
-- window expires. A DB table rather than in-memory state because Vercel
-- serverless functions don't share memory across instances/regions.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Click-and-collect orders (pay online via FIUU, pick up in-store OR have
-- it delivered — see fulfillment_method below). items is a JSONB snapshot
-- ([{slug,name,price,qty,variantId,image}] at checkout time), same choice
-- already made for carts.items: nothing needs cross-order item queries,
-- and a later product price/name change must not retroactively alter what
-- a past order says the customer paid.
--
-- status lifecycle:
--   pending   created at checkout; stock soft-reserved (see
--             src/lib/reservations.ts) until reserved_until; customer
--             redirected to FIUU's hosted payment page
--   paid      <- FIUU Notification URL webhook, status=00 + amount
--             cross-check passes (source of truth — the Return URL
--             redirect is never trusted for this)
--   cancelled <- FIUU Notification URL webhook, status=11 (failed)
--   expired   cosmetic only, no cron ever writes this: a pending order
--             whose reserved_until has passed with no webhook simply
--             stops counting against live stock on its own, since every
--             reservation query filters status='pending' AND
--             reserved_until > now(). The admin orders list computes this
--             label at read time (SQL CASE).
--   fulfilled <- staff clicks "Mark Picked Up"/"Mark Shipped" (wording
--             depends on fulfillment_method) in /admin/orders (only
--             valid from 'paid')
--   payment_stock_conflict  payment succeeded but the pre-receipt stock
--             re-check failed (in-store sold it during the hold) —
--             requires manual staff resolution (refund or backorder),
--             never auto-oversold
--   refunded  set after a manual refund from a payment_stock_conflict
--             order (or any other manual refund) — not otherwise
--             automated in this pass
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled','expired','fulfilled','refunded','payment_stock_conflict')),
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- total already includes shipping_cost (total = subtotal -
  -- discount_amount + shipping_cost) — there's no separate "grand total"
  -- column, matching how total already worked before delivery existed.
  total NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  fulfillment_method TEXT NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_method IN ('pickup', 'delivery')),
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- {line1,line2,city,postcode,state,phone}; null for pickup orders. See
  -- src/lib/shipping.ts for the state -> region -> rate mapping.
  shipping_address JSONB,
  fiuu_orderid TEXT UNIQUE NOT NULL,
  fiuu_tran_id TEXT,
  loyverse_receipt_id TEXT,
  reserved_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);

-- Used by src/lib/reservations.ts (the "how much is currently soft-
-- reserved" query) and by the admin list's pending/paid filters.
CREATE INDEX orders_reservation_idx ON orders (status, reserved_until);
CREATE INDEX orders_customer_idx ON orders (customer_id);

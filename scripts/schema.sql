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

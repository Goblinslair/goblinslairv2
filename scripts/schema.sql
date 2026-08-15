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

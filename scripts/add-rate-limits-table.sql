-- One-off migration for an existing database created before rate limiting
-- existed. Run by hand against Neon (Neon's SQL editor, or
-- `psql "$DATABASE_URL" -f scripts/add-rate-limits-table.sql`).
-- A fresh database only needs scripts/schema.sql plus this file.

-- Fixed-window counter shared by the login/signup/admin-login routes (see
-- src/lib/rate-limit.ts) — one row per (route, client IP), reset once the
-- window expires. A DB table rather than in-memory state because Vercel
-- serverless functions don't share memory across instances/regions.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

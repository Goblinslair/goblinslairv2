-- One-off migration for an existing database created before the admin
-- panel existed. Run by hand against Neon (Neon's SQL editor, or
-- `psql "$DATABASE_URL" -f scripts/add-admin-sessions-table.sql`).
-- A fresh database only needs scripts/schema.sql plus this file.

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

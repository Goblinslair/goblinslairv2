import { sql } from './db';

// Fixed-window limiter backed by the `rate_limits` table (scripts/schema.sql
// / scripts/add-rate-limits-table.sql) rather than in-memory state, since
// Vercel serverless functions don't share memory across instances/regions.
// The upsert below is a single atomic statement — safe under concurrent
// requests for the same key without a separate read-then-write round trip.
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number
): Promise<boolean> {
  const [row] = await sql<{ attempts: number }[]>`
    INSERT INTO rate_limits (key, attempts, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN rate_limits.window_start < now() - make_interval(mins => ${windowMinutes})
          THEN 1
          ELSE rate_limits.attempts + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - make_interval(mins => ${windowMinutes})
          THEN now()
          ELSE rate_limits.window_start
      END
    RETURNING attempts
  `;
  return row.attempts <= maxAttempts;
}

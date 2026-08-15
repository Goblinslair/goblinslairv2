import postgres from 'postgres';
import { loadDotEnv } from './load-env';

loadDotEnv();

// Single shared connection pool, reused across requests within the same
// serverless function instance. Requires DATABASE_URL (a pooled Neon
// connection string — the host should contain "-pooler") in .env locally
// and in Vercel's project env vars.
export const sql = postgres(process.env.DATABASE_URL!);

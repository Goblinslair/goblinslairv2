import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from './db';

export const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_DAYS = 7;

export function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

export async function createAdminSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO admin_sessions (id, expires_at) VALUES (${token}, ${expiresAt})`;
  return { token, expiresAt };
}

export async function isValidAdminSession(token: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM admin_sessions WHERE id = ${token} AND expires_at > now()
  `;
  return rows.length > 0;
}

export async function destroyAdminSession(token: string): Promise<void> {
  await sql`DELETE FROM admin_sessions WHERE id = ${token}`;
}

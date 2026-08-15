import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from './db';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(customerId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (id, customer_id, expires_at)
    VALUES (${token}, ${customerId}, ${expiresAt})
  `;
  return { token, expiresAt };
}

export async function getSessionCustomer(
  token: string
): Promise<{ id: number; email: string; name: string } | null> {
  const rows = await sql<{ id: number; email: string; name: string | null }[]>`
    SELECT customers.id, customers.email, customers.name
    FROM sessions
    JOIN customers ON customers.id = sessions.customer_id
    WHERE sessions.id = ${token} AND sessions.expires_at > now()
  `;
  const customer = rows[0];
  if (!customer) return null;
  // Accounts created before the name field existed have no name on file yet.
  return { ...customer, name: customer.name || customer.email.split('@')[0] };
}

export async function destroySession(token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${token}`;
}

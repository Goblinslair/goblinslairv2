export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionCustomer, SESSION_COOKIE } from '../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const customer = token ? await getSessionCustomer(token) : null;
  return new Response(
    JSON.stringify({ email: customer?.email ?? null, name: customer?.name ?? null }),
    { status: 200 }
  );
};

import { loadDotEnv } from './load-env';

loadDotEnv();

const BASE_URL = 'https://api.loyverse.com/v1.0';

const DISCOUNT_BY_LEVEL: Record<1 | 2, number> = { 1: 10, 2: 15 };

export interface MembershipTier {
  level: 1 | 2 | null;
  discountPercent: number;
}

// Links a website account to its Loyverse customer record by email — the
// same field on both sides, no separate linking table. Misses if the
// customer's in-store Loyverse profile has no email or a different one than
// they signed up with here; callers should show that as "no tier found",
// not an error, since it's an expected/legitimate outcome, not a bug.
export async function getMembershipTier(email: string): Promise<MembershipTier> {
  const token = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!token) return { level: null, discountPercent: 0 };

  const url = new URL(`${BASE_URL}/customers`);
  url.searchParams.set('email', email);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { level: null, discountPercent: 0 };

  const json = await res.json();
  const listKey = Object.keys(json).find((k) => Array.isArray(json[k]));
  const customer = listKey ? json[listKey][0] : undefined;
  const note: string = customer?.note ?? '';
  const noteLower = note.toLowerCase();

  // "level 2" checked first: the note is free text mixed with other staff
  // comments, so this is a deterministic tie-break, not a real ambiguity
  // resolver — fails closed to null if neither substring appears.
  const level: 1 | 2 | null = noteLower.includes('level 2')
    ? 2
    : noteLower.includes('level 1')
      ? 1
      : null;

  return { level, discountPercent: level ? DISCOUNT_BY_LEVEL[level] : 0 };
}

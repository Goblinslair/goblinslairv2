// Single source of truth for Malaysian state -> shipping region/rate,
// imported by both the cart page (to render the state dropdown) and the
// checkout API (to compute the authoritative cost) so the two never drift.
// Flat rate by region, not weight/zone-based — see project memory for why.

export type ShippingRegion = 'west' | 'east';

export const MALAYSIA_STATES: { name: string; region: ShippingRegion }[] = [
  { name: 'Johor', region: 'west' },
  { name: 'Kedah', region: 'west' },
  { name: 'Kelantan', region: 'west' },
  { name: 'Melaka', region: 'west' },
  { name: 'Negeri Sembilan', region: 'west' },
  { name: 'Pahang', region: 'west' },
  { name: 'Perak', region: 'west' },
  { name: 'Perlis', region: 'west' },
  { name: 'Pulau Pinang', region: 'west' },
  { name: 'Selangor', region: 'west' },
  { name: 'Terengganu', region: 'west' },
  { name: 'Kuala Lumpur', region: 'west' },
  { name: 'Putrajaya', region: 'west' },
  { name: 'Sabah', region: 'east' },
  { name: 'Sarawak', region: 'east' },
  { name: 'Labuan', region: 'east' },
];

const RATES: Record<ShippingRegion, number> = { west: 10, east: 15 };

export function getShippingRegion(stateName: string): ShippingRegion | null {
  return MALAYSIA_STATES.find((s) => s.name === stateName)?.region ?? null;
}

// null = invalid/unrecognized state — caller must reject, never fall back
// to a default rate for money math.
export function getShippingCost(stateName: string): number | null {
  const region = getShippingRegion(stateName);
  return region ? RATES[region] : null;
}

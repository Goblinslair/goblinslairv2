// Shared between products.astro (the filter drawer + card data-system
// attribute) and index.astro (the "Shop 40K/AoS/Hobby" homepage links) so
// the two can't drift apart on what counts as which game system, or on how
// a group label turns into a URL-safe slug.

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Loyverse gives us a flat category per product — group them into game
// systems so both the product-filter drawer and the homepage's faction
// links can point at the same buckets. Anything not named below (new
// Loyverse categories, etc.) safely falls into "Hobby & Supplies" rather
// than disappearing.
const FORTY_K = new Set([
  "ADEPTA SORORITAS", "ADEPTUS / LEGIO CUSTODES", "ADEPTUS MECHANICUS", "AELDARI", "ASTRA MILITARUM",
  "BLACK TEMPLARS", "BLOOD ANGELS", "CHAOS SPACE MARINES", "DARK ANGELS", "DEATH GUARD", "DEATHWATCH",
  "DRUKHARI", "EMPEROR'S CHILDREN", "GENESTEALER CULTS", "IMPERIAL FISTS", "IMPERIAL KNIGHTS", "IRON HANDS",
  "LEAGUES OF VOTANN", "NECRONS", "ORKS", "SALAMANDERS", "SPACE MARINES", "SPACE WOLVES", "T'AU EMPIRE",
  "THOUSAND SONS", "TYRANIDS", "ULTRAMARINES", "WHITE SCARS", "WORLD EATERS",
]);
const AGE_OF_SIGMAR = new Set([
  "BLADES OF KHORNE", "CITIES OF SIGMAR", "DAUGHTERS OF KHAINE", "DISCIPLES OF TZEENTCH", "GLOOMSPITE GITZ",
  "HEDONITES OF SLAANESH", "HELSMITHS OF HASHUT", "IDONETH DEEPKIN", "KHARADRON OVERLORDS", "LUMINETH REALM-LORDS",
  "MAGGOTKIN OF NURGLE", "NIGHTHAUNT", "ORRUK WARCLANS", "OSSIARCH BONEREAPERS", "SERAPHON", "SKAVEN",
  "SLAVES TO DARKNESS", "SOULBLIGHT GRAVELORDS", "STORMCAST ETERNALS", "SYLVANETH",
]);
const HORUS_HERESY = new Set(["HORUS HERESY: LEGIONES ASTARTES"]);
const OTHER_GAMES = new Set(["NECROMUNDA", "BLOOD BOWL"]);

export function groupFor(category: string): string {
  if (FORTY_K.has(category)) return 'Warhammer 40,000';
  if (AGE_OF_SIGMAR.has(category)) return 'Age of Sigmar';
  if (HORUS_HERESY.has(category)) return 'The Horus Heresy';
  if (OTHER_GAMES.has(category)) return 'Other Games';
  return 'Hobby & Supplies';
}

export const GROUP_ORDER = ['Warhammer 40,000', 'Age of Sigmar', 'The Horus Heresy', 'Other Games', 'Hobby & Supplies'];

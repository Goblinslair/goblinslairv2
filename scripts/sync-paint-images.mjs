// Fills in missing product images for Loyverse "Paints" category items using
// Games Workshop's public trade resource library (no login needed - GW's own
// retailer asset pack, explicitly meant for this).
// Run with: npm run sync-paint-images  (add --dry-run to preview with no upload)
// Requires LOYVERSE_ACCESS_TOKEN in .env (same as sync-products.mjs)
//
// Safe to re-run any time. Two things happen on every run:
//   1. Items with no image_url at all get matched fresh (see tiers below).
//   2. Items this script previously gave a PACK-shot fallback to (tracked in
//      paint-image-fallback-state.json) get re-checked for a real single-unit
//      image and upgraded automatically if GW has since published one -
//      confirmed live that 'Ardcoat/Ryza Rust/etc only have pack (6-Pack)
//      photography today, no single-unit shot exists anywhere in GW's
//      system, so this is a real gap that may get filled later, not
//      hypothetical.
// An item never touched by this script (image already set before it ever
// ran, or set by hand) is never overwritten - only images this script itself
// uploaded as a fallback are eligible for replacement.
//
// Matching is name-only (GW's SKU/barcode numbers don't line up with
// Loyverse's - confirmed by hand on Abaddon Black, different schemes
// entirely). A paint's colour name is compared after stripping range
// prefixes (Base/Layer/Shade/Contrast/Technical/Dry/Air/Spray), volume
// ("12ml"), pack-size suffixes, and punctuation from both sides.
//   Tier 1 (exact): exactly one non-pack, non-tool single-unit candidate.
//   Tier 2 (fallback): no single-unit candidate, but exactly one pack/case
//     shot of that colour - used only when tier 1 comes up empty, and
//     recorded as provisional so it can be upgraded later.
// Anything that doesn't resolve to exactly one candidate at either tier is
// skipped and written to the report - never uploads a guessed image.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const TOKEN = process.env.LOYVERSE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Missing LOYVERSE_ACCESS_TOKEN. Add it to .env in the project root.');
  process.exit(1);
}

const LOYVERSE_BASE = 'https://api.loyverse.com/v1.0';
const PAINTS_CATEGORY_NAME = 'Paints';

async function loyverseGet(endpoint, params = {}) {
  const results = [];
  let cursor;
  let listKey;
  do {
    const url = new URL(`${LOYVERSE_BASE}${endpoint}`);
    url.searchParams.set('limit', '250');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Loyverse ${endpoint} failed: ${res.status} ${body}`);
    }
    const json = await res.json();
    listKey = listKey || Object.keys(json).find((k) => Array.isArray(json[k]));
    results.push(...json[listKey]);
    cursor = json.cursor;
  } while (cursor);
  return results;
}

async function uploadItemImage(itemId, imageBytes, filename) {
  // Confirmed working shape (core/loyverse_api.py, Finance Automation tool):
  // field name must be exactly "file" - other names return 500. A
  // successful call is a 201 with an empty body.
  const form = new FormData();
  form.append('file', new Blob([imageBytes]), filename);
  const res = await fetch(`${LOYVERSE_BASE}/items/${itemId}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Image upload failed for item ${itemId}: ${res.status} ${body}`);
  }
}

// --- Games Workshop trade resource library ---------------------------------

const GW_MEDIA_ENDPOINT = 'https://trade.games-workshop.com/wp-json/gw/v2/media';
const GW_GROUP_IMAGES_AND_LOGOS = 46;
const GW_BRAND_CITADEL = 57;

// Filtering by race=Paint + type=Product Images (GW's own facets) misses a
// real chunk of assets - confirmed live: "Technical: Martian Ironearth
// (6-Pack)" and others carry empty races[]/types[] on GW's own backend
// (an untagged/older asset, not a filtering mistake on this end), so it's
// invisible to that filter combo despite otherwise being exactly the right
// image. Filtering by group + brand only (both reliably populated) instead
// and letting the title-shape checks below (VOLUME_PATTERN/PACK_PATTERN) do
// the real filtering catches these too.
//
// GW's own "total_items" field in the response is also unreliable (reports
// a stale/unfiltered count regardless of the filters applied - confirmed by
// requesting per_page=1000 and getting fewer assets back than total_items
// claimed), so pagination here stops on the first empty page rather than
// trusting page_count/total_items.
async function fetchGwPaintAssets() {
  const assets = [];
  for (let page = 1; ; page += 1) {
    const batch = await fetchGwPage(page);
    if (batch.length === 0) break;
    assets.push(...batch);
  }
  return assets;
}

async function fetchGwPage(page) {
  const url = new URL(GW_MEDIA_ENDPOINT);
  url.searchParams.set('fe', '1');
  url.searchParams.set('group', GW_GROUP_IMAGES_AND_LOGOS);
  url.searchParams.set('brand', GW_BRAND_CITADEL);
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', String(page));
  url.searchParams.set('lang', 'en');
  url.searchParams.set('country', '220');

  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`GW media API failed on page ${page}: ${res.status}`);
  }
  const json = await res.json();
  return json.assets || [];
}

// --- Name normalisation / matching ------------------------------------------

// Range words appear inconsistently on both sides (Loyverse always has one as
// a prefix, e.g. "BASE: ORRUK FLESH"; GW's single-pot titles usually bury the
// range in an internal SKU code instead, e.g. "BS:F-21-01-...-AVERLAND
// SUNSET 12ML ROW"). Since a Citadel colour name is unique on its own,
// matching drops range words entirely rather than trying to align them.
// Includes pack/case/bundle words too - PACK_PATTERN below decides which
// index an asset goes into (exact vs pack-fallback), but the key itself
// needs the pack wording stripped either way, or a title like "'Ardcoat
// (24 ml) (6-Pack)" normalizes to "ardcoat pack" and never matches
// Loyverse's plain "ardcoat".
const NOISE_WORDS = new Set([
  'base', 'layer', 'shade', 'contrast', 'technical', 'dry', 'air', 'spray',
  'edge', 'wash', 'foundation', 'colour', 'color', 'paint', 'row', 'ml',
  'pack', 'case', 'bundle',
]);

// GW's single-pot titles bury the colour name after an internal SKU code and
// barcode, e.g. "BS:F-21-01-99189950265-AVERLAND SUNSET 12ML ROW" - "BS:F"
// isn't a range word we can drop by a stopword list (it's an opaque code,
// varies per range/batch), so instead find the barcode (the long digit run)
// and keep only what follows it, which is consistently just the colour name
// + volume + "ROW". Loyverse titles have no such prefix, so this is a no-op
// for them - the barcode pattern just never matches.
function stripGwSkuCode(raw) {
  const m = raw.match(/\d{6,}[-\s]*(.+)$/);
  return m ? m[1] : raw;
}

function normalizeName(raw) {
  return stripGwSkuCode(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space (keeps word boundaries)
    .replace(/\b\d+\s*ml\b/g, ' ') // "12ml" / "12 ml"
    .replace(/\b\d+\b/g, ' ') // bare numbers (pack counts, leftover digits)
    .split(/\s+/)
    .filter((word) => word && !NOISE_WORDS.has(word))
    .sort() // word order differs ("Base: Orruk Flesh" vs "Orruk Flesh Base")
    .join(' ');
}

const PACK_PATTERN = /\b(pack|case|bundle)\b/i;
// Not \bml\b - confirmed live that "_" (as in a filename like
// "..._18ml_2022_New.png") counts as a word character in regex, so \b never
// fires between "ml" and "_" and the real boundary check silently never
// matched filenames at all. A trailing letter/digit is what actually needs
// excluding (so "mls"/"millilitre" don't false-positive), not any word char.
const VOLUME_PATTERN = /\d+\s*ml(?![a-z0-9])/i; // real single-pot shots always state a volume

// Volume/pack info doesn't always live in the display title - confirmed
// live: "Contrast: Black Legion" has no "ml" anywhere in its title, but its
// filename is "Black_Legion_Contrast_18ml_2022_New.png". Checking both
// fields (title is still what's used for the actual name-matching key -
// filename formats are too inconsistent for that) catches these instead of
// wrongly treating them as a non-paint tool/set and dropping them.
function classificationText(asset) {
  return `${asset.title} ${asset.file_name || ''}`;
}

// Two separate indexes - single-unit shots (tier 1) and pack/case shots
// (tier 2 fallback) - built from the same asset list, split by whether the
// title/filename matches PACK_PATTERN. A tool/set/book (no volume anywhere)
// isn't a paint pot either way, so both indexes exclude it.
function buildGwIndexes(assets) {
  const exact = new Map();
  const pack = new Map();
  for (const asset of assets) {
    const text = classificationText(asset);
    if (!VOLUME_PATTERN.test(text)) continue; // tool/set/book, not a paint pot
    const index = PACK_PATTERN.test(text) ? pack : exact;
    const key = normalizeName(asset.title);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(asset);
  }
  return { exact, pack };
}

function findMatch(key, { exact, pack }) {
  const exactCandidates = exact.get(key) || [];
  if (exactCandidates.length === 1) return { tier: 'exact', asset: exactCandidates[0] };
  if (exactCandidates.length > 1) {
    return { tier: null, reason: `ambiguous - ${exactCandidates.length} single-unit candidates`, candidateTitles: exactCandidates.map((a) => a.title) };
  }
  const packCandidates = pack.get(key) || [];
  if (packCandidates.length === 1) return { tier: 'fallback', asset: packCandidates[0] };
  if (packCandidates.length > 1) {
    return { tier: null, reason: `ambiguous - ${packCandidates.length} pack-shot candidates`, candidateTitles: packCandidates.map((a) => a.title) };
  }
  return { tier: null, reason: 'no match found' };
}

// --- Local fallback-tracking state -------------------------------------------
// Loyverse's item object has no field to record "this image is provisional" -
// image_url is just a URL, no metadata about where it came from. So that
// state lives here instead: which items this script gave a pack-shot
// fallback to, so a later run knows which ones are worth re-checking for a
// real single-unit upgrade (everything else is left alone - never touch an
// image this script didn't put there).
const STATE_PATH = path.join(__dirname, 'paint-image-fallback-state.json');

function loadFallbackState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveFallbackState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// --- Main --------------------------------------------------------------------

async function downloadImage(asset) {
  const imageUrl = asset.file_large_url || asset.file_url;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const filename = path.basename(new URL(imageUrl).pathname) || 'image.jpg';
  return { bytes, filename };
}

async function main() {
  const fallbackState = loadFallbackState();

  console.log('Fetching Loyverse categories...');
  const categories = await loyverseGet('/categories');
  const paintsCategory = categories.find((c) => c.name === PAINTS_CATEGORY_NAME);
  if (!paintsCategory) {
    throw new Error(`No Loyverse category named "${PAINTS_CATEGORY_NAME}" found.`);
  }

  console.log('Fetching Loyverse items...');
  const allPaints = (await loyverseGet('/items')).filter(
    (item) => !item.deleted_at && item.category_id === paintsCategory.id
  );

  const unimaged = allPaints.filter((item) => !item.image_url);
  // Only items THIS script gave a pack fallback to are eligible for an
  // upgrade check - an image_url this script never touched (pre-existing,
  // or set by hand) is left alone regardless of what's in the state file.
  const upgradeCandidates = allPaints.filter(
    (item) => item.image_url && fallbackState[item.id]?.tier === 'fallback'
  );

  console.log(`${unimaged.length} paint(s) with no image, ${upgradeCandidates.length} fallback image(s) to re-check for an upgrade.`);
  if (unimaged.length === 0 && upgradeCandidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('Fetching Games Workshop trade resource image index...');
  const gwAssets = await fetchGwPaintAssets();
  const gwIndexes = buildGwIndexes(gwAssets);
  console.log(
    `${gwAssets.length} GW asset(s) fetched, ${gwIndexes.exact.size} single-unit colour(s) + ${gwIndexes.pack.size} pack-only colour(s) indexed.`
  );

  const matched = []; // { item, asset, tier, isUpgrade }
  const skipped = [];

  for (const item of unimaged) {
    const key = normalizeName(item.item_name);
    const result = findMatch(key, gwIndexes);
    if (result.tier) {
      matched.push({ item, asset: result.asset, tier: result.tier, isUpgrade: false });
    } else {
      skipped.push({ item, reason: result.reason, normalizedName: key, candidateTitles: result.candidateTitles });
    }
  }

  for (const item of upgradeCandidates) {
    const key = normalizeName(item.item_name);
    const exactCandidates = gwIndexes.exact.get(key) || [];
    if (exactCandidates.length === 1) {
      matched.push({ item, asset: exactCandidates[0], tier: 'exact', isUpgrade: true });
    }
    // No real single-unit shot yet (0 or ambiguous) - leave the existing
    // pack fallback in place, nothing to report, just try again next run.
  }

  const exactCount = matched.filter((m) => m.tier === 'exact' && !m.isUpgrade).length;
  const fallbackCount = matched.filter((m) => m.tier === 'fallback').length;
  const upgradeCount = matched.filter((m) => m.isUpgrade).length;
  console.log(
    `${matched.length} to upload (${exactCount} exact, ${fallbackCount} pack-fallback, ${upgradeCount} upgrades), ${skipped.length} skipped (see report).`
  );

  if (!DRY_RUN) {
    let uploaded = 0;
    for (const { item, asset, tier, isUpgrade } of matched) {
      try {
        const { bytes, filename } = await downloadImage(asset);
        await uploadItemImage(item.id, bytes, filename);
        uploaded += 1;
        if (isUpgrade) {
          delete fallbackState[item.id];
          console.log(`Upgraded to single-unit image: ${item.item_name}`);
        } else {
          if (tier === 'fallback') {
            fallbackState[item.id] = { tier: 'fallback', gwTitle: asset.title, setAt: new Date().toISOString() };
          }
          console.log(`Uploaded (${tier}): ${item.item_name}`);
        }
      } catch (err) {
        skipped.push({ item, reason: `upload failed: ${err.message}` });
        console.error(`FAILED: ${item.item_name} - ${err.message}`);
      }
    }
    console.log(`Uploaded ${uploaded} image(s) to Loyverse.`);
    saveFallbackState(fallbackState);
  } else {
    console.log('--dry-run: no images were uploaded, fallback-state file not touched.');
    for (const { item, asset, tier, isUpgrade } of matched) {
      const label = isUpgrade ? 'would upgrade' : `would upload (${tier})`;
      console.log(`  ${label}: ${item.item_name}  <-  ${asset.title}`);
    }
  }

  const reportPath = path.join(__dirname, 'paint-image-sync-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        dryRun: DRY_RUN,
        matchedCount: matched.length,
        skippedCount: skipped.length,
        matched: matched.map(({ item, asset, tier, isUpgrade }) => ({
          sku: item.variants?.[0]?.sku || null,
          name: item.item_name,
          tier,
          isUpgrade,
          gwTitle: asset.title,
          imageUrl: asset.file_large_url || asset.file_url,
        })),
        skipped: skipped.map(({ item, reason, normalizedName, candidateTitles }) => ({
          sku: item.variants?.[0]?.sku || null,
          name: item.item_name,
          reason,
          normalizedName,
          candidateTitles,
        })),
      },
      null,
      2
    )
  );
  console.log(`Report written to ${path.relative(root, reportPath)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

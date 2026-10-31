import { readFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import type { Card, Detail, Verdict } from '../shared/types.js';
export const manifest = JSON.parse(
  readFileSync(new URL('../public/config/judgement-manifest.v1.json', import.meta.url), 'utf8'),
);
export const assetManifest = JSON.parse(
  readFileSync(new URL('../public/assets/tarot/manifest.json', import.meta.url), 'utf8'),
);
export const details: Record<string, Detail> = JSON.parse(
  readFileSync(new URL('../shared/card-details.json', import.meta.url), 'utf8'),
);
export const cards: Card[] = manifest.cards;
export const byId = new Map(cards.map((c) => [c.id, c]));
export const rank = { R: 1, SR: 2, SSR: 3 };
export function roll() {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}
export function weighted(weights: Record<string, number>, value: number) {
  let total = Object.values(weights).reduce((a, b) => a + b, 0),
    n = value * total;
  for (const [key, w] of Object.entries(weights)) {
    n -= w;
    if (n < 0) return key;
  }
  return Object.keys(weights).at(-1)!;
}
export function draw(verdict: Verdict, rng = roll, exclude?: string) {
  const audit = [rng(), rng(), rng()];
  const character = weighted(manifest.selection.character_weights, audit[0]);
  const rarity = weighted(manifest.selection.rarity_weights, audit[1]);
  let pool = cards.filter(
    (c) =>
      c.character === character &&
      c.alignment === manifest.selection.alignment_from_verdict[verdict] &&
      c.rarity === rarity,
  );
  if (pool.length > 1) pool = pool.filter((c) => c.id !== exclude);
  if (pool.length === 1 && pool[0].id === exclude) {
    return draw(verdict, rng);
  }
  return { card: pool[Math.floor(audit[2] * pool.length)], audit };
}
export function hash(s: string) {
  let n = 2166136261;
  for (const c of s) {
    n ^= c.codePointAt(0)!;
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}
export function artUrls(c: Card) {
  const ch = manifest.characters[c.character];
  const version = manifest.content_version || manifest.schema_version;
  const specific = manifest.asset_policy.supported_extensions.map(
    (ext: string) => `/cloud/assets/tarot/cards/${c.id}.${ext}`,
  );
  const safePool = ch.art_pool.filter((name: string) =>
    assetManifest.assets.some(
      (a: any) => a.path === ch.asset_dir + name && a.enabled && !a.adult_only,
    ),
  );
  const fallback = safePool.length
    ? ch.asset_dir + safePool[hash(c.id + version) % safePool.length]
    : null;
  return [...specific, ...(fallback ? ['/cloud/' + fallback.replace(/^public\//, '')] : [])].map(
    (p) => p + '?v=' + version,
  );
}
export function validateManifest() {
  if (cards.length !== 60 || new Set(cards.map((c) => c.id)).size !== 60) throw Error('CARD_COUNT');
  for (const c of cards) {
    if (!details[c.id]) throw Error('MISSING_DETAIL ' + c.id);
    if (c.rarity === 'SSR' && manifest.ssr_animations[c.id]?.key !== c.animation_key)
      throw Error('SSR_KEY');
  }
  for (const key of Object.keys(manifest.characters)) {
    for (const alignment of ['upright', 'reversed'])
      for (const [r, n] of [
        ['R', 5],
        ['SR', 4],
        ['SSR', 1],
      ] as const) {
        if (
          cards.filter((c) => c.character === key && c.alignment === alignment && c.rarity === r)
            .length !== n
        )
          throw Error('POOL');
      }
    const ch = manifest.characters[key];
    for (const file of ch.art_pool)
      if (!existsSync(ch.asset_dir + file)) throw Error('MISSING_ART');
  }
}

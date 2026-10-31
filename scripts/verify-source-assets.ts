import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateManifest, cards, details, assetManifest, artUrls } from '../server/cards';
validateManifest();
const base = 'be24dc5123e416758b9e38a1f6e16020172548b1';
const frozen = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', base], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const path of frozen) {
  let original = execFileSync('git', ['show', base + ':' + path], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (path === 'public/config/judgement-manifest.v1.json') {
    // 013 permits only nickname entities and hidden opportunities; assets and pools remain frozen.
    const expected = JSON.parse(original.toString('utf8'));
    const actual = JSON.parse(readFileSync(path, 'utf8'));
    expected.execution_types = { ...expected.execution_types };
    delete expected.execution_types.role;
    delete expected.execution_types.state;
    expected.execution_types.token = 'hidden_one_use_opportunity';
    expected.content_version = '0.2.1-nickname-only';
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      // Key order is immaterial; compare the complete structures.
      const { isDeepStrictEqual } = await import('node:util');
      if (!isDeepStrictEqual(expected, actual)) throw Error('Frozen manifest structure changed');
    }
    original = readFileSync(path);
  }
  const current = readFileSync(path);
  if (!original.equals(current)) throw Error('Frozen file changed: ' + path);
}
for (const a of assetManifest.assets.filter((a: any) => !a.enabled || a.adult_only)) {
  if (existsSync(a.path) && existsSync('dist/' + a.path.replace(/^public\//, '')))
    throw Error('Disabled art copied into deployment');
}
const st = JSON.parse(readFileSync('public/assets/stickers/manifest.json', 'utf8'));
if (st.stickers.length !== 16) throw Error('Sticker count');
for (const s of st.stickers) if (!existsSync('public' + s.url)) throw Error('Missing sticker');
for (const c of cards) {
  for (const a of details[c.id].actions) {
    if (a.hours <= 0 || a.hours > 24) throw Error('Effect duration');
  }
  const last = decodeURIComponent(artUrls(c).at(-1)!.split('?')[0]).replace('/cloud/', 'public/');
  if (!assetManifest.assets.some((a: any) => a.path === last && a.enabled && !a.adult_only))
    throw Error('Unsafe fallback');
}
console.log(
  JSON.stringify(
    {
      frozen_baseline: base,
      frozen_files_unchanged: frozen.length - 1,
      authorized_manifest_nickname_migration: true,
      cards: cards.length,
      stickers: st.stickers.length,
      art_assets: assetManifest.assets.length,
      blocked_adult_assets: assetManifest.assets.filter((a: any) => a.adult_only).length,
      details_sha256: createHash('sha256')
        .update(readFileSync('shared/card-details.json'))
        .digest('hex'),
    },
    null,
    2,
  ),
);

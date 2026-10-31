import { build } from 'vite';
import { cpSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
const catalog = JSON.parse(
  readFileSync(new URL('../public/assets/tarot/manifest.json', import.meta.url), 'utf8'),
);
const denied = new Set(
  catalog.assets
    .filter((a) => !a.enabled || a.adult_only)
    .map((a) => a.path.replace(/^public\//, '')),
);
// Disable Vite's unfiltered public copy, then publish only enabled runtime assets.
await build({ publicDir: false });
const source = resolve('public');
cpSync(source, resolve('dist'), {
  recursive: true,
  filter: (path) => !denied.has(relative(source, path).split(sep).join('/')),
});

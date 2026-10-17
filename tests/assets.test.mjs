// Run with: node tests/assets.test.mjs
// Fails if a CSS or JS file changed without index.html's ?v= hashes being updated.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stamp } from '../tools/stamp-assets.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(stamp(html), html, 'index.html asset versions are out of date. Run: node tools/stamp-assets.mjs');
console.log('Asset versions are up to date.');

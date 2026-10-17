// Adds a content hash (?v=...) to every CSS and JS file index.html loads, so
// browsers fetch a changed file instead of reusing an old copy from cache.
// Imports between modules (main.js -> ./config.js) are versioned through the
// import map, so the JS files themselves never need editing.
//
//   node tools/stamp-assets.mjs           update index.html
//   node tools/stamp-assets.mjs --check   exit 1 if index.html is out of date
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(root + f, 'utf8');
const hash = (f) => createHash('sha256').update(readFileSync(root + f)).digest('hex').slice(0, 10);

// theme.js is a classic script and main.js is the entry point: both are linked
// directly. Every other module is reached through an import.
const LINKED = ['styles.css', 'js/theme.js', 'js/main.js'];
const MODULES = readdirSync(root + 'js').filter((f) => f.endsWith('.js') && f !== 'theme.js').sort();

export function stamp(html) {
  for (const f of LINKED) {
    const re = new RegExp(`((?:href|src)=")${f.replace(/[.]/g, '\\.')}(?:\\?v=[0-9a-f]+)?"`);
    if (!re.test(html)) throw new Error(`index.html doesn't link ${f}`);
    html = html.replace(re, `$1${f}?v=${hash(f)}"`);
  }
  const map = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (!map) throw new Error('index.html has no import map');
  const json = JSON.parse(map[1]);
  for (const k of Object.keys(json.imports)) if (k.startsWith('./js/')) delete json.imports[k];
  for (const f of MODULES) json.imports[`./js/${f}`] = `./js/${f}?v=${hash(`js/${f}`)}`;
  const body = JSON.stringify(json, null, 2).replace(/^/gm, '  ');
  return html.replace(map[0], `<script type="importmap">\n${body}\n  </script>`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = read('index.html');
  const next = stamp(html);
  if (process.argv.includes('--check')) {
    if (next !== html) {
      console.error('index.html asset versions are out of date. Run: node tools/stamp-assets.mjs');
      process.exit(1);
    }
    console.log('Asset versions are up to date.');
  } else {
    writeFileSync(root + 'index.html', next);
    console.log(next === html ? 'Asset versions already up to date.' : 'Updated asset versions in index.html.');
  }
}

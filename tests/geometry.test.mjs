// Run with: node tests/geometry.test.mjs
import assert from 'node:assert/strict';
import { computeAxle, compareToReference, IN } from '../js/fitment.js';
import {
  barrelProfile, ringProfile, hubProfile, clipProfileZ, lathe, sweptBeam,
  spokeLayout, beamSamples, signedArea, ensureCCW, dedupe, tyreProfile,
} from '../js/geom.js';
import { DESIGNS } from '../js/config.js';

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const finite = (arr, msg) => { for (const v of arr) ok(Number.isFinite(v), msg); };

function segmentsIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
         ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}
function isSimple(poly) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
  }
  return true;
}

function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Lathe winding must agree with the supplied normals (front faces face outward).
function windingAgrees({ positions, normals, indices }) {
  let agree = 0, disagree = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map((k) => positions.slice(k * 3, k * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const k = indices[i] * 3;
    const dot = n[0] * normals[k] + n[1] * normals[k + 1] + n[2] * normals[k + 2];
    if (Math.hypot(...n) < 1e-9) continue;
    if (dot > 0) agree++; else disagree++;
  }
  return { agree, disagree };
}

// 1. Lathe winding on a simple square ring
{
  const w = windingAgrees(lathe([[100, 0], [120, 0], [120, 20], [100, 20]], 16));
  ok(w.disagree === 0 && w.agree > 0, `lathe winding should match normals (agree ${w.agree}, disagree ${w.disagree})`);
}

// 2. Sweep every design / construction / size combination
const designs = DESIGNS.map((d) => d.id);
const constructions = ['1pc', '2pc', '3pc'];
const depths = [8, 30, 55];
let combos = 0;
const warningCounts = {};
for (const construction of constructions) {
  for (const profileDepth of depths) {
    for (const stepped of [false, true]) {
      for (let diameter = 18; diameter <= 24; diameter++) {
        for (let width = 8; width <= 13; width += 0.5) {
          for (let offset = -30; offset <= 70; offset += 10) {
            const ax = computeAxle({ diameter, width, offset }, { profileDepth, construction, stepped, pcd: 112, bore: 66.6 });
            combos++;
            for (const k of ['R', 'h', 'zc', 'concave', 'rIn', 'ringInner', 'backspacing', 'frontSpacing', 'lipDepth', 'spokeClearance', 'barrelID']) {
              ok(Number.isFinite(ax[k]), `${k} finite`);
            }
            for (const w of ax.warnings) warningCounts[w.level] = (warningCounts[w.level] || 0) + 1;
            ok(ax.lipDepth >= 12 - 1e-9, 'lip at least minimum');

            const barrel = barrelProfile(ax);
            ok(isSimple(barrel), `barrel profile self-intersects: ${JSON.stringify({ diameter, width, offset, construction, profileDepth, stepped })}`);
            const ringBack = ax.zc - ax.dims.ringT;
            const lip = clipProfileZ(barrel, ax.zc, Infinity);
            const back = clipProfileZ(barrel, -Infinity, construction === '3pc' ? ringBack : ax.zc);
            ok(lip.length >= 3 && back.length >= 3, 'barrel splits into two closed pieces');
            ok(Math.abs(signedArea(lip)) > 50 && Math.abs(signedArea(back)) > 50, 'barrel pieces have area');
            ok(isSimple(ringProfile(ax, construction)), 'ring profile simple');
            ok(isSimple(hubProfile(ax)), 'hub profile simple');

            // The tyre is a clean shape that never cuts into the barrel
            const tyre = tyreProfile(ax);
            ok(isSimple(tyre), `tyre profile self-intersects: ${JSON.stringify({ diameter, width, offset })}`);
            for (const q of tyre) ok(!pointInPolygon(q, barrel), `tyre point inside barrel: ${JSON.stringify({ q, diameter, width, offset, construction, stepped })}`);
            for (const q of barrel) ok(!pointInPolygon(q, tyre), `barrel point inside tyre: ${JSON.stringify({ q, diameter, width, offset, construction, stepped })}`);

            // Spokes stay inside the barrel and stay finite (check one size in three to keep this quick)
            if (offset % 30 === 0) {
              for (const design of designs) {
                for (const b of spokeLayout(design, ax, 20)) {
                  const s = beamSamples(ax, b);
                  for (const { p } of s) {
                    finite(p, 'spoke point finite');
                    ok(Math.hypot(p[0], p[1]) < ax.rIn, 'spoke stays inside the barrel');
                  }
                  const g = sweptBeam(s);
                  finite(g.positions, 'beam vertex finite');
                  finite(g.normals, 'beam normal finite');
                  if (diameter === 20 && width === 9.5) {
                    const w = windingAgrees(g);
                    ok(w.disagree === 0, `${design} spoke winding (disagree ${w.disagree})`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// 3. Lathe output for a real barrel is finite and consistently wound
{
  const ax = computeAxle({ diameter: 20, width: 9.5, offset: 20 }, { profileDepth: 30, construction: '2pc', stepped: true, pcd: 112, bore: 66.6 });
  for (const prof of [barrelProfile(ax), ringProfile(ax, '2pc'), hubProfile(ax)]) {
    const g = lathe(prof, 32);
    finite(g.positions, 'lathe positions finite');
    finite(g.normals, 'lathe normals finite');
    const w = windingAgrees(g);
    ok(w.disagree === 0, `real profile winding (disagree ${w.disagree})`);
  }
  // Reference example values (hand-checked)
  // 20x9.5 ET20: overall 266.7 mm, backspacing 153.35, front spacing 113.35
  ok(Math.abs(ax.backspacing - 153.35) < 0.01, `backspacing ${ax.backspacing}`);
  ok(Math.abs(ax.frontSpacing - 113.35) < 0.01, `front spacing ${ax.frontSpacing}`);
  // hub front 54, + 30 concave = 84 face plane; lip = 120.65 - 84 = 36.65
  ok(Math.abs(ax.zc - 84) < 1e-9 && Math.abs(ax.lipDepth - 36.65) < 0.01, `zc ${ax.zc} lip ${ax.lipDepth}`);
}

// 4. Reference comparison maths
{
  const c = compareToReference({ diameter: 20, width: 10, offset: 15 }, { diameter: 19, width: 9, offset: 20 });
  // Poke: (127 - 15) - (114.3 - 20) = 112 - 94.3 = 17.7 mm further out
  ok(Math.abs(c.pokeDelta - 17.7) < 0.01, `poke ${c.pokeDelta}`);
  // Inner: (127 + 15) - (114.3 + 20) = 142 - 134.3 = 7.7 mm closer
  ok(Math.abs(c.innerDelta - 7.7) < 0.01, `inner ${c.innerDelta}`);
  ok(c.warnings.length === 2, 'two warnings expected');
}

// 5. Same offset: more concave means less lip (the trade-off we explain in the UI)
{
  const base = { diameter: 21, width: 10.5, offset: 20 };
  const o = { construction: '2pc', stepped: false, pcd: 112, bore: 66.6 };
  const flat = computeAxle(base, { ...o, profileDepth: 8 });
  const deep = computeAxle(base, { ...o, profileDepth: 55 });
  ok(deep.lipDepth < flat.lipDepth && deep.concave > flat.concave, 'concave/lip trade-off');
}

// dedupe/ensureCCW sanity
ok(dedupe([[0, 0], [0, 0], [1, 0], [0, 1], [0, 0]]).length === 3, 'dedupe');
ok(signedArea(ensureCCW([[0, 0], [0, 1], [1, 0]])) > 0, 'ensureCCW');

console.log(`All good: ${checks.toLocaleString()} checks across ${combos.toLocaleString()} wheel specs.`);
console.log('Warnings raised across the sweep:', warningCounts);

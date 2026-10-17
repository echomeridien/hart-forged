// Pure geometry helpers. No three.js here, so everything in this file
// can be tested in Node without a browser.
//
// Coordinate system (millimetres):
//   z axis = wheel axle. +z points out of the car, towards the viewer.
//   z = 0  = wheel centreline (middle of the bead seats).
//   Profiles are given as [r, z] pairs: r = distance from the axle.

const TAU = Math.PI * 2;

// ---------- 2D profile utilities ----------

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

export function dedupe(poly, eps = 1e-6) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > eps) break;
    out.pop();
  }
  return out;
}

export function ensureCCW(poly) {
  return signedArea(poly) < 0 ? poly.slice().reverse() : poly;
}

// Keep the part of a closed profile where predicate f(p) >= 0 (Sutherland–Hodgman).
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Cut a closed [r, z] profile down to the slab zMin <= z <= zMax.
export function clipProfileZ(poly, zMin = -Infinity, zMax = Infinity) {
  let out = poly;
  if (zMin > -Infinity) out = clipHalf(out, (p) => p[1] - zMin);
  if (zMax < Infinity) out = clipHalf(out, (p) => zMax - p[1]);
  return dedupe(out);
}

// ---------- Lathe: spin a closed profile around the z axis ----------
// Each profile edge gets its own ring of vertices, so machined corners stay crisp.

export function lathe(profile, segments = 128) {
  const pts = ensureCCW(dedupe(profile));
  const n = pts.length;
  const positions = [], normals = [], indices = [];
  for (let e = 0; e < n; e++) {
    const [r0, z0] = pts[e];
    const [r1, z1] = pts[(e + 1) % n];
    const dr = r1 - r0, dz = z1 - z0;
    const len = Math.hypot(dr, dz);
    if (len < 1e-9) continue;
    const nr = dz / len, nz = -dr / len; // outward normal for a CCW profile
    const base = positions.length / 3;
    for (let s = 0; s <= segments; s++) {
      const phi = (s / segments) * TAU;
      const c = Math.cos(phi), si = Math.sin(phi);
      positions.push(r0 * c, r0 * si, z0, r1 * c, r1 * si, z1);
      normals.push(nr * c, nr * si, nz, nr * c, nr * si, nz);
    }
    for (let s = 0; s < segments; s++) {
      const a = base + s * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, d, b, a, c, d);
    }
  }
  return { positions, normals, indices };
}

// ---------- Swept beam: a spoke with a tapered, chamfered cross-section ----------
// samples: [{ p: [x, y, z] (centre of the front face), w: width, d: depth }]

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function sweptBeam(samples, frontRatio = 0.78) {
  const n = samples.length;
  const corners = []; // per sample: [FL, FR, BR, BL]
  for (let i = 0; i < n; i++) {
    const prev = samples[Math.max(0, i - 1)].p;
    const next = samples[Math.min(n - 1, i + 1)].p;
    const T = norm(sub(next, prev));
    const L = norm(cross(T, [0, 0, 1]));
    const N = norm(cross(L, T));
    const { p, w, d } = samples[i];
    const back = sub(p, scale(N, d));
    corners.push([
      add(p, scale(L, (w * frontRatio) / 2)),
      sub(p, scale(L, (w * frontRatio) / 2)),
      sub(back, scale(L, w / 2)),
      add(back, scale(L, w / 2)),
    ]);
  }
  const positions = [], indices = [];
  // Four long faces, each with its own vertices (sharp edges between faces).
  for (let side = 0; side < 4; side++) {
    const c0 = side, c1 = (side + 1) % 4;
    const base = positions.length / 3;
    for (let i = 0; i < n; i++) {
      positions.push(...corners[i][c0], ...corners[i][c1]);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, d, a, d, c);
    }
  }
  // End caps
  for (const i of [0, n - 1]) {
    const base = positions.length / 3;
    for (const k of [0, 1, 2, 3]) positions.push(...corners[i][k]);
    if (i === 0) indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, indices };
}

// ---------- Wheel profiles ----------

// Full barrel cross-section (inner flange to outer lip), as one closed profile.
export function barrelProfile(ax) {
  const { R, h, dims, dropWell, stepZ } = ax;
  const { t, F, fT, stepDepth: sd, dwDepth } = dims;
  const P = [];
  // Inboard flange
  P.push([R + F - 4, -h - fT], [R + F, -h - fT + 4], [R + F, -h - 3], [R + F - 3, -h], [R + 3, -h], [R, -h + 3]);
  // Drop centre (where the tyre bead drops in for fitting)
  if (dropWell) {
    P.push([R, dropWell.a - 14], [R - dwDepth, dropWell.a], [R - dwDepth, dropWell.b], [R, dropWell.b + 14]);
  }
  // Outboard bead seat and lip flange
  P.push([R, h - 3], [R + 3, h], [R + F - 3, h], [R + F, h + 3], [R + F, h + fT - 4], [R + F - 4, h + fT]);
  // Lip edge, then the visible inside of the lip (with optional step)
  P.push([R - t + 2, h + fT], [R - t, h + fT - 2]);
  if (stepZ !== null) P.push([R - t, stepZ], [R - t - sd, stepZ - sd]);
  const rBehind = R - t - (stepZ !== null ? sd : 0);
  if (dropWell) {
    P.push([rBehind, dropWell.b + 14], [R - dwDepth - t, dropWell.b], [R - dwDepth - t, dropWell.a], [R - t, dropWell.a - 14]);
  } else {
    P.push([rBehind, -h + 20]);
  }
  P.push([R - t, -h + 6], [R - t + 2, -h - fT]);
  return P;
}

// Ring where the forged centre meets the barrel.
export function ringProfile(ax, construction) {
  const { zc, rIn, R, dims } = ax;
  const inner = ax.ringInner;
  const back = zc - dims.ringT;
  const outer = construction === '3pc' ? R + 1.5 : rIn - 0.4;
  return [[inner, back], [outer, back], [outer, zc], [inner + 4, zc], [inner, zc - 4]];
}

// Mounting pad around the hub bore.
export function hubProfile(ax) {
  const { ET, hubFront, hubR, boreR } = ax;
  return [
    [boreR, ET], [hubR + 6, ET], [hubR + 6, hubFront - 8], [hubR - 2, hubFront],
    [boreR + 12, hubFront + 2], [boreR + 2, hubFront + 2], [boreR, hubFront - 1],
  ];
}

// Front-face height of a spoke at radius r: deep at the hub, rising to the lip.
export function faceZ(ax, r) {
  const { hubR, ringInner, hubFront, zc } = ax;
  const s = Math.min(1, Math.max(0, (r - hubR) / (ringInner - hubR)));
  const f = 0.55 * s + 0.45 * s * s * (3 - 2 * s);
  return hubFront + (zc - hubFront) * f;
}

// ---------- Spoke layouts ----------
// Each beam: list of { r, theta, w, d } along its length.

const deg = (x) => (x * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function beam(N, fn) {
  const out = [];
  for (let i = 0; i <= N; i++) out.push(fn(i / N));
  return out;
}

export function spokeLayout(design, ax, N = 40) {
  const r0 = ax.hubR - 10;
  const r1 = ax.ringInner + 8;
  const beams = [];
  if (design === 'split10') {
    for (let k = 0; k < 5; k++) {
      const phi = deg(90 + k * 72);
      for (const side of [-1, 1]) {
        beams.push(beam(N, (t) => {
          const r = lerp(r0, r1, t);
          const w = lerp(16, 12, t);
          const gap = lerp(3, 26, t);
          return { r, theta: phi + side * ((gap + w) / 2) / r, w, d: lerp(30, 16, t) };
        }));
      }
    }
  } else if (design === 'yspoke') {
    const rs = lerp(r0, r1, 0.42);
    for (let k = 0; k < 5; k++) {
      const phi = deg(90 + k * 72);
      beams.push(beam(N, (t) => {
        const r = lerp(r0, rs + 18, t);
        return { r, theta: phi, w: lerp(32, 26, t), d: lerp(32, 24, t) };
      }));
      for (const side of [-1, 1]) {
        beams.push(beam(N, (t) => {
          const r = lerp(rs - 6, r1, t);
          return { r, theta: phi + side * deg(15.5) * smooth(t), w: lerp(19, 14, t), d: lerp(25, 16, t) };
        }));
      }
    }
  } else if (design === 'mesh') {
    for (let k = 0; k < 10; k++) {
      const phi = deg(90 + k * 36);
      for (const dir of [-1, 1]) {
        beams.push(beam(N, (t) => {
          const r = lerp(r0, r1, t);
          return { r, theta: phi + dir * deg(30) * t, w: lerp(12, 9, t), d: lerp(26, 14, t) };
        }));
      }
    }
  } else {
    throw new Error(`Unknown design: ${design}`);
  }
  return beams;
}

// Turn a spoke layout into 3D sample points on the concave face.
export function beamSamples(ax, layoutBeam) {
  return layoutBeam.map(({ r, theta, w, d }) => ({
    p: [r * Math.cos(theta), r * Math.sin(theta), faceZ(ax, r)],
    w, d,
  }));
}

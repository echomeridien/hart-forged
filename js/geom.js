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

// ---------- Swept beam: a spoke with a tapered cross-section and rounded edges ----------
// samples: [{ p: [x, y, z] (centre of the front face), w: width, d: depth }]
// Returns positions, normals and indices. The flat faces stay flat and only the
// rounded edges shade smoothly, so each edge catches a thin line of light.

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

const EDGE_STEPS = 3; // segments in each rounded edge

// Cross-section in local 2D coordinates (x across the spoke, y out of the face):
// a trapezoid with each corner replaced by an arc. Returns [{ x, y, nx, ny }].
export function roundedSection(w, d, frontRatio) {
  const fw = (w * frontRatio) / 2, bw = w / 2;
  const corners = [[fw, 0], [-fw, 0], [-bw, -d], [bw, -d]];
  const front = Math.min(fw, d) * 0.45, back = front * 0.6;
  const out = [];
  corners.forEach((P, i) => {
    const A = corners[(i + 3) % 4], B = corners[(i + 1) % 4];
    const ua = norm([A[0] - P[0], A[1] - P[1], 0]), ub = norm([B[0] - P[0], B[1] - P[1], 0]);
    const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
    const rad = i < 2 ? front : back;
    const t = rad / Math.tan(half);                 // corner to where the arc meets each edge
    const bis = norm([ua[0] + ub[0], ua[1] + ub[1], 0]);
    const c = [P[0] + bis[0] * (rad / Math.sin(half)), P[1] + bis[1] * (rad / Math.sin(half))];
    const a0 = Math.atan2(P[1] + ua[1] * t - c[1], P[0] + ua[0] * t - c[0]);
    let a1 = Math.atan2(P[1] + ub[1] * t - c[1], P[0] + ub[0] * t - c[0]);
    // Take the short way round the arc
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    for (let k = 0; k <= EDGE_STEPS; k++) {
      const a = a0 + ((a1 - a0) * k) / EDGE_STEPS;
      const nx = Math.cos(a), ny = Math.sin(a);
      out.push({ x: c[0] + nx * rad, y: c[1] + ny * rad, nx, ny });
    }
  });
  return out;
}

export function sweptBeam(samples, frontRatio = 0.78) {
  const n = samples.length;
  const positions = [], normals = [], indices = [];
  const rings = [];
  for (let i = 0; i < n; i++) {
    const prev = samples[Math.max(0, i - 1)].p;
    const next = samples[Math.min(n - 1, i + 1)].p;
    const T = norm(sub(next, prev));
    const L = norm(cross(T, [0, 0, 1]));
    const N = norm(cross(L, T));
    const { p, w, d } = samples[i];
    rings.push({ T, sec: roundedSection(w, d, frontRatio), L, N, p });
  }
  const m = rings[0].sec.length;
  // Sides: one shared ring of vertices per sample
  for (const { sec, L, N, p } of rings) {
    for (const v of sec) {
      positions.push(...add(p, add(scale(L, v.x), scale(N, v.y))));
      normals.push(...norm(add(scale(L, v.nx), scale(N, v.ny))));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, e = b + m;
      indices.push(a, e, b, a, c, e);
    }
  }
  // End caps (buried in the hub and the rim, but closed all the same)
  for (const [i, sign] of [[0, -1], [n - 1, 1]]) {
    const { T } = rings[i];
    const base = positions.length / 3;
    for (let j = 0; j < m; j++) {
      positions.push(positions[(i * m + j) * 3], positions[(i * m + j) * 3 + 1], positions[(i * m + j) * 3 + 2]);
      normals.push(...scale(T, sign));
    }
    for (let j = 1; j < m - 1; j++) {
      if (sign > 0) indices.push(base, base + j + 1, base + j);
      else indices.push(base, base + j, base + j + 1);
    }
  }
  return { positions, normals, indices };
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

// Tyre: an illustrative low-profile tyre on the bead seats. The sidewall is
// about 35% of the section width, so it reads like a typical performance tyre.
export function tyreSize(ax) {
  const { R, h, W, dims } = ax;
  const sidewall = Math.min(130, Math.max(70, 0.35 * (W + 20)));
  return { outerR: R + sidewall, halfW: h + dims.fT + 8 };
}

export function tyreProfile(ax) {
  const { R, h, dims } = ax;
  const { F, fT } = dims;
  const { outerR: top, halfW } = tyreSize(ax);
  const tread = halfW - 16;
  // Outer half, from the tread centre round the shoulder, down the sidewall,
  // over the rim flange and in to the bead seat
  const half = [
    [top, 0], [top, tread - 10], [top - 3, tread], [top - 12, halfW - 3], [top - 28, halfW],
    [R + F + 16, halfW - 1], [R + F + 5, h + fT + 2], [R + F + 1.5, h + fT - 2],
    [R + F + 1.5, h - 4], [R + 0.5, h - 4],
  ];
  return [...half, ...half.slice().reverse().map(([r, z]) => [r, -z])];
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
  } else if (design === 'five' || design === 'six' || design === 'multi15') {
    // Straight spokes: [count, width at hub, width at rim, depth at hub, depth at rim]
    const [n, w0, w1, d0, d1] = { five: [5, 36, 26, 34, 22], six: [6, 30, 22, 32, 20], multi15: [15, 13, 9, 26, 14] }[design];
    for (let k = 0; k < n; k++) {
      const phi = deg(90 + (k * 360) / n);
      beams.push(beam(N, (t) => ({ r: lerp(r0, r1, t), theta: phi, w: lerp(w0, w1, t), d: lerp(d0, d1, t) })));
    }
  } else if (design === 'twin7') {
    for (let k = 0; k < 7; k++) {
      const phi = deg(90 + (k * 360) / 7);
      for (const side of [-1, 1]) {
        beams.push(beam(N, (t) => {
          const r = lerp(r0, r1, t);
          const w = lerp(12, 9, t);
          const gap = lerp(2, 16, t);
          return { r, theta: phi + side * ((gap + w) / 2) / r, w, d: lerp(28, 15, t) };
        }));
      }
    }
  } else if (design === 'blade' || design === 'turbine') {
    // Directional spokes that sweep round as they reach the rim
    const [n, sweep, w0, w1, d0, d1] = { blade: [10, 26, 20, 12, 30, 16], turbine: [20, 38, 11, 8, 26, 14] }[design];
    for (let k = 0; k < n; k++) {
      const phi = deg(90 + (k * 360) / n);
      beams.push(beam(N, (t) => ({ r: lerp(r0, r1, t), theta: phi + deg(sweep) * t * t, w: lerp(w0, w1, t), d: lerp(d0, d1, t) })));
    }
  } else if (design === 'heritage') {
    // Five stems, each forking into three
    const rs = lerp(r0, r1, 0.38);
    for (let k = 0; k < 5; k++) {
      const phi = deg(90 + k * 72);
      beams.push(beam(N, (t) => {
        const r = lerp(r0, rs + 12, t);
        return { r, theta: phi, w: lerp(30, 24, t), d: lerp(32, 24, t) };
      }));
      for (const side of [-1, 0, 1]) {
        beams.push(beam(N, (t) => {
          const r = lerp(rs - 6, r1, t);
          return { r, theta: phi + side * deg(13) * smooth(t), w: lerp(15, 10, t), d: lerp(24, 15, t) };
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

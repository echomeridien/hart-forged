import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import {
  DESIGNS, STYLES, CONSTRUCTIONS, PROFILES, FACE_FINISHES, LIP_FINISHES, HARDWARE_FINISHES,
  BARREL_FINISHES, BOLT_PATTERNS, DIAMETERS, WIDTHS, OFFSET_RANGE, HARDWARE_COUNT, DEFAULT_STATE,
} from './config.js';
import { computeAxle, compareToReference, mmToIn } from './fitment.js';
import { spokeLayout } from './geom.js';
import { buildWheel, disposeWheel, makeCapTexture } from './wheel.js';
import { initCarPhoto } from './carphoto.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- state

const state = loadState();

function loadState() {
  const base = structuredClone(DEFAULT_STATE);
  try {
    const raw = location.hash.slice(1);
    if (!raw) return base;
    const json = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
    for (const k of Object.keys(base)) {
      if (!(k in json)) continue;
      if (typeof base[k] === 'object') Object.assign(base[k], json[k]);
      else base[k] = json[k];
    }
  } catch { /* ignore a malformed link and start from the defaults */ }
  return base;
}

function saveState() {
  const b64 = btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  history.replaceState(null, '', `#${b64}`);
}

const byId = (list, id) => list.find((x) => x.id === id) || list[0];
const shownAxle = () => (state.staggered ? state.axle : 'front');
const refKey = (axle) => (axle === 'front' ? 'refFront' : 'refRear');
const boltPattern = () => byId(BOLT_PATTERNS, state.bolt);

function axleFor(axle) {
  const bolt = boltPattern();
  return computeAxle(state[axle], {
    profileDepth: byId(PROFILES, state.profile).depth,
    construction: state.construction,
    stepped: state.lipStyle === 'stepped',
    pcd: bolt.pcd,
    bore: state.bore,
  });
}

// ---------------------------------------------------------------- 3D scene

const viewport = $('viewport');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (err) {
  $('loading').textContent = 'This browser could not start 3D graphics. Try a recent version of Chrome, Safari or Firefox.';
  $('loading').classList.add('is-error');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
viewport.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 1.3);
key.position.set(700, 1100, 1300);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe6ff, 0.6);
rim.position.set(-1200, 300, -600);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(28, 1, 10, 20000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 500;
controls.maxDistance = 5000;
controls.autoRotateSpeed = 1.4;

// Soft floor shadow
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(20,24,30,0.55)');
  grd.addColorStop(0.55, 'rgba(20,24,30,0.18)');
  grd.addColorStop(1, 'rgba(20,24,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
);
scene.add(shadow);

// Cut-away plane: keeps the half of the wheel where x < 0
const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

// Materials (updated in place when finishes change)
const physical = () => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
const mats = {
  face: physical(),
  lip: physical(),
  barrel: physical(),
  hardware: physical(),
  lug: new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
  cap: new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
};

function applyFinish(mat, f, customHex) {
  mat.color.set(f.custom ? customHex : f.color);
  mat.metalness = f.metalness;
  mat.roughness = f.roughness;
  mat.clearcoat = f.clearcoat ?? 0;
  mat.clearcoatRoughness = f.clearcoatRoughness ?? 0.1;
}

function applyMaterials() {
  const face = byId(FACE_FINISHES, state.face);
  const whole = state.finishMode === 'whole';
  applyFinish(mats.face, face, state.faceCustom);
  if (whole) {
    applyFinish(mats.lip, face, state.faceCustom);
    applyFinish(mats.barrel, face, state.faceCustom);
  } else {
    applyFinish(mats.lip, byId(LIP_FINISHES, state.lip), state.lipCustom);
    applyFinish(mats.barrel, byId(BARREL_FINISHES, state.barrel), state.barrelCustom);
  }
  applyFinish(mats.hardware, byId(HARDWARE_FINISHES, state.hardware));
  const planes = sectionOn ? [cutPlane] : [];
  for (const m of [...Object.values(mats), datumMat]) {
    m.clippingPlanes = planes;
    m.needsUpdate = true;
  }
}

// Datum markers shown in cut-away: mounting face and wheel centreline
const datumMat = new THREE.MeshBasicMaterial({ color: 0x3b4c9b, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
const datum = new THREE.Group();
datum.visible = false;
scene.add(datum);

function labelEl(text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}

function rebuildDatum(ax) {
  datum.clear();
  const mount = new THREE.Mesh(new THREE.RingGeometry(ax.boreR, ax.R - 12, 96), datumMat);
  mount.position.z = ax.ET;
  const centre = new THREE.Mesh(new THREE.RingGeometry(ax.R - 40, ax.R + ax.dims.F + 30, 96), datumMat);
  const l1 = new CSS2DObject(labelEl(`Mounting face, ET${ax.ET}`, 'datum-label'));
  l1.position.set(0, -ax.R + 40, ax.ET);
  const l2 = new CSS2DObject(labelEl('Wheel centreline', 'datum-label'));
  l2.position.set(0, -ax.R - ax.dims.F - 30, 0);
  datum.add(mount, centre, l1, l2);
  setDatumVisible(sectionOn);
}

// CSS labels don't inherit their parent's visibility, so set each one.
function setDatumVisible(on) {
  datum.traverse((o) => { o.visible = on; });
}

// ---------------------------------------------------------------- wheel

let wheel = null;
let currentAx = null;
let explode = 0;

function rebuild() {
  const axle = shownAxle();
  const ax = axleFor(axle);
  currentAx = ax;
  disposeWheel(wheel);
  wheel = buildWheel(state, ax, mats, boltPattern());
  for (const l of wheel.labels) {
    const obj = new CSS2DObject(labelEl(l.text, 'part-label'));
    obj.position.copy(l.anchor);
    wheel.parts[l.part].add(obj);
  }
  scene.add(wheel.root);
  rebuildDatum(ax);
  applyExplode();
  renderPanel();
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function applyExplode() {
  if (!wheel) return;
  const e = ease(explode);
  for (const g of Object.values(wheel.parts)) {
    g.position.z = g.userData.explode * e;
    g.traverse((o) => {
      if (o.isCSS2DObject) o.element.style.opacity = String(Math.min(1, Math.max(0, (explode - 0.3) / 0.3)));
    });
  }
  const ax = currentAx;
  const spread = Math.max(...Object.values(wheel.parts).map((g) => g.userData.explode)) -
    Math.min(...Object.values(wheel.parts).map((g) => g.userData.explode));
  shadow.position.y = -(ax.R + ax.dims.F + 4);
  shadow.position.z = 0;
  shadow.scale.set((ax.R + ax.dims.F) * 1.9, 1, ax.W * 2.6 + spread * e * 1.2);
}

// ---------------------------------------------------------------- camera views

function viewPosition(view) {
  const ax = currentAx;
  const d = (ax.R + ax.dims.F) * 5.6;
  switch (view) {
    case 'face': return new THREE.Vector3(0, 0, d);
    case 'profile': return new THREE.Vector3(d * 1.12, d * 0.04, 1);
    case 'cut': return new THREE.Vector3(d * 0.92, d * 0.14, d * 0.42);
    default: return new THREE.Vector3(d * 0.62, d * 0.16, d * 0.78);
  }
}

let tween = null;
function goTo(view) {
  const to = viewPosition(view);
  if (reduceMotion) { camera.position.copy(to); controls.update(); return; }
  tween = { from: camera.position.clone(), to, start: performance.now(), dur: 750 };
}

// ---------------------------------------------------------------- panel UI

function svgFor(design) {
  const ax = { hubR: 24, ringInner: 76 };
  const beams = spokeLayout(design, ax, 16);
  const lines = beams.map((b) => {
    const pts = b.map(({ r, theta }) => `${(100 + r * Math.cos(theta)).toFixed(1)},${(100 - r * Math.sin(theta)).toFixed(1)}`).join(' ');
    const w = (b[0].w + b[b.length - 1].w) / 2 * 0.42;
    return `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="6"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    ${lines}
    <circle cx="100" cy="100" r="24" fill="currentColor"/>
  </svg>`;
}

function pressed(container, attr, value) {
  for (const b of container.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
}

function buildPanel() {
  // Styles: each one is a starting point, and filters the design grid
  $('styles').innerHTML = STYLES.map((st) =>
    `<button type="button" class="style-card" data-id="${st.id}">${svgFor(st.preset.design)}<span class="style-name">${st.name}</span><span class="style-cue">${st.cue}</span></button>`).join('');
  $('styles').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const st = byId(STYLES, b.dataset.id);
    Object.assign(state, st.preset, { style: st.id, designFilter: st.id });
    changed(true);
    toast(`Started from ${st.name}. Change anything you like.`);
  });

  // Designs
  $('designFilter').innerHTML = [{ id: 'all', name: 'All designs' }, ...STYLES]
    .map((st) => `<button type="button" class="chip chip-sm" data-filter="${st.id}">${st.name}</button>`).join('');
  $('designFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.designFilter = b.dataset.filter; changed(false);
  });
  $('designs').innerHTML = DESIGNS.map((d) =>
    `<button type="button" class="design" data-id="${d.id}">${svgFor(d.id)}<span>${d.name}</span></button>`).join('');
  $('designs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.design = b.dataset.id; changed(true);
  });

  // Construction and profile
  $('constructions').innerHTML = CONSTRUCTIONS.map((c) => `<button type="button" data-id="${c.id}">${c.name}</button>`).join('');
  $('constructions').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.construction = b.dataset.id; changed(true);
  });
  $('seeParts').addEventListener('click', () => animateExplode(explode > 0.5 ? 0 : 1));
  $('profiles').innerHTML = PROFILES.map((p) => `<button type="button" data-id="${p.id}">${p.name}</button>`).join('');
  $('profiles').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.profile = b.dataset.id; changed(true);
  });

  // Finishes
  $('finishMode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.finishMode = b.dataset.mode; changed(false);
  });
  const swatches = (list, el, keyName, customKey) => {
    el.innerHTML = list.map((f) => {
      const bg = f.custom ? 'conic-gradient(#d33,#dd3,#3d3,#3dd,#33d,#d3d,#d33)' : f.swatch;
      return `<button type="button" class="swatch" data-id="${f.id}"><i style="background:${bg}"></i>${f.name}</button>`;
    }).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      state[keyName] = b.dataset.id;
      changed(false);
      if (customKey && byId(list, b.dataset.id).custom) $(customKey).click();
    });
  };
  swatches(FACE_FINISHES, $('faceFinishes'), 'face', 'faceCustom');
  swatches(LIP_FINISHES, $('lipFinishes'), 'lip', 'lipCustom');
  swatches(BARREL_FINISHES, $('barrelFinishes'), 'barrel', 'barrelCustom');
  swatches(HARDWARE_FINISHES, $('hardwareFinishes'), 'hardware');
  $('faceCustom').addEventListener('input', (e) => { state.faceCustom = e.target.value; changed(false); });
  $('lipCustom').addEventListener('input', (e) => { state.lipCustom = e.target.value; changed(false); });
  $('barrelCustom').addEventListener('input', (e) => { state.barrelCustom = e.target.value; changed(false); });
  $('lipStyles').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.lipStyle = b.dataset.lipstyle; changed(true);
  });

  // Fitment fields
  const opts = (values, fmt) => values.map((v) => `<option value="${v}">${fmt(v)}</option>`).join('');
  for (const id of ['fDiameter', 'rDiameter']) $(id).innerHTML = opts(DIAMETERS, (v) => `${v}"`);
  for (const id of ['fWidth', 'rWidth']) $(id).innerHTML = opts(WIDTHS, (v) => `${v}"`);
  for (const id of ['fOffset', 'rOffset']) { $(id).min = OFFSET_RANGE.min; $(id).max = OFFSET_RANGE.max; }
  $('bolt').innerHTML = BOLT_PATTERNS.map((b) => `<option value="${b.id}">${b.id}</option>`).join('');

  const editAxle = () => (state.staggered ? state.axle : 'front');
  const setSpec = (target, field, value) => {
    state[target][field] = value;
    if (!state.staggered) {
      const mirror = { front: 'rear', refFront: 'refRear' }[target];
      if (mirror) state[mirror][field] = value;
    }
    changed(true);
  };
  const clampOffset = (v) => Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, Math.round(Number(v) || 0)));
  $('fDiameter').addEventListener('change', (e) => setSpec(editAxle(), 'diameter', Number(e.target.value)));
  $('fWidth').addEventListener('change', (e) => setSpec(editAxle(), 'width', Number(e.target.value)));
  $('fOffset').addEventListener('change', (e) => setSpec(editAxle(), 'offset', clampOffset(e.target.value)));
  $('rDiameter').addEventListener('change', (e) => setSpec(refKey(editAxle()), 'diameter', Number(e.target.value)));
  $('rWidth').addEventListener('change', (e) => setSpec(refKey(editAxle()), 'width', Number(e.target.value)));
  $('rOffset').addEventListener('change', (e) => setSpec(refKey(editAxle()), 'offset', clampOffset(e.target.value)));
  $('bolt').addEventListener('change', (e) => {
    state.bolt = e.target.value;
    state.bore = boltPattern().bore;
    changed(true);
  });
  $('bore').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (v >= 50 && v <= 130) state.bore = v;
    changed(true);
  });

  $('fitMode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.staggered = b.dataset.fit === 'staggered';
    if (!state.staggered) {
      state.rear = { ...state.front };
      state.refRear = { ...state.refFront };
      state.axle = 'front';
    }
    changed(true);
  });
  const pickAxle = (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    state.axle = b.dataset.axle; changed(true);
  };
  $('axleTabs').addEventListener('click', pickAxle);
  $('axleSwitch').addEventListener('click', pickAxle);

  // Stage controls
  $('explode').addEventListener('input', (e) => { explodeTween = null; explode = Number(e.target.value); applyExplode(); });
  $('views').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    goTo(b.dataset.view);
  });
  $('section').addEventListener('click', () => {
    sectionOn = !sectionOn;
    $('section').setAttribute('aria-pressed', String(sectionOn));
    setDatumVisible(sectionOn);
    applyMaterials();
    if (sectionOn) goTo('cut');
  });
  $('spin').addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    $('spin').setAttribute('aria-pressed', String(controls.autoRotate));
  });

  // Specification actions
  $('copySpec').addEventListener('click', () => copy(specText(), 'Specification copied'));
  $('copyLink').addEventListener('click', () => { saveState(); copy(location.href, 'Link copied'); });
  $('saveImage').addEventListener('click', saveImage);
  for (const id of ['openCar', 'openCar2']) $(id).addEventListener('click', () => carPhoto.open());
}

let sectionOn = false;

function fmtMm(mm, dp = 0) { return `${mm.toFixed(dp)} mm`; }
function fmtIn(mm) { return `${mmToIn(mm).toFixed(2)}"`; }

function describeDelta(mm, outWord, inWord) {
  const r = Math.round(mm);
  if (r === 0) return 'Unchanged';
  return `${Math.abs(r)} mm ${r > 0 ? outWord : inWord}`;
}

function renderPanel() {
  const axle = shownAxle();
  const ax = currentAx;
  const spec = state[axle];
  const ref = state[refKey(axle)];
  const cmp = compareToReference(spec, ref);
  const design = byId(DESIGNS, state.design);
  const construction = byId(CONSTRUCTIONS, state.construction);

  pressed($('styles'), 'id', state.style);
  pressed($('designFilter'), 'filter', state.designFilter);
  for (const b of $('designs').querySelectorAll('button')) {
    b.hidden = state.designFilter !== 'all' && !byId(DESIGNS, b.dataset.id).styles.includes(state.designFilter);
  }
  pressed($('designs'), 'id', state.design);
  $('designBlurb').textContent = design.blurb;
  pressed($('constructions'), 'id', state.construction);
  $('constructionBlurb').textContent = construction.blurb;
  pressed($('profiles'), 'id', state.profile);
  pressed($('faceFinishes'), 'id', state.face);
  pressed($('lipFinishes'), 'id', state.lip);
  pressed($('hardwareFinishes'), 'id', state.hardware);
  pressed($('lipStyles'), 'lipstyle', state.lipStyle);
  pressed($('barrelFinishes'), 'id', state.barrel);
  pressed($('finishMode'), 'mode', state.finishMode);
  const whole = state.finishMode === 'whole';
  $('partFinishes').hidden = whole;
  $('faceTitle').textContent = whole ? 'Whole wheel' : 'Face';
  $('faceCustom').value = state.faceCustom;
  $('lipCustom').value = state.lipCustom;
  $('barrelCustom').value = state.barrelCustom;
  $('faceCustomWrap').hidden = !byId(FACE_FINISHES, state.face).custom;
  $('lipCustomWrap').hidden = !byId(LIP_FINISHES, state.lip).custom;
  $('barrelCustomWrap').hidden = !byId(BARREL_FINISHES, state.barrel).custom;
  $('buildCaption').textContent = construction.parts;
  const mono = state.construction === '1pc';
  for (const b of $('hardwareFinishes').querySelectorAll('button')) b.disabled = mono;
  $('hardwareHint').hidden = !mono;

  pressed($('fitMode'), 'fit', state.staggered ? 'staggered' : 'square');
  pressed($('axleTabs'), 'axle', axle);
  pressed($('axleSwitch'), 'axle', axle);
  for (const c of [$('axleTabs'), $('axleSwitch')]) {
    for (const b of c.querySelectorAll('button')) b.disabled = !state.staggered && b.dataset.axle === 'rear';
  }
  $('axleTabs').hidden = !state.staggered;

  $('fDiameter').value = spec.diameter;
  $('fWidth').value = spec.width;
  $('fOffset').value = spec.offset;
  $('rDiameter').value = ref.diameter;
  $('rWidth').value = ref.width;
  $('rOffset').value = ref.offset;
  $('bolt').value = state.bolt;
  $('bore').value = state.bore;

  const axleName = state.staggered ? (axle === 'front' ? 'Front' : 'Rear') : 'Front and rear';
  $('resultsTitle').textContent = `Results, ${axleName.toLowerCase()}`;
  $('readout').innerHTML = `${spec.diameter} × ${spec.width} ET${spec.offset}<span>${axleName}, ${design.name}, ${construction.name.toLowerCase()}</span>`;

  const concaveText = ax.concave >= 0 ? fmtMm(ax.concave) : `Convex by ${fmtMm(-ax.concave)}`;
  const rows = [
    ['Backspacing', fmtMm(ax.backspacing), fmtIn(ax.backspacing)],
    ['Front spacing', fmtMm(ax.frontSpacing), fmtIn(ax.frontSpacing)],
    ['Lip depth', fmtMm(ax.lipDepth), fmtIn(ax.lipDepth)],
    ['Face concave', concaveText, 'hub behind spoke tips'],
    ['Spoke clearance at rim', fmtMm(ax.spokeClearance), 'in front of mounting face'],
    ['Barrel inner diameter', fmtMm(ax.barrelID), 'at the drop centre'],
    ['Lip position', describeDelta(cmp.pokeDelta, 'further out', 'further in'), 'versus current wheel'],
    ['Inner edge', describeDelta(cmp.innerDelta, 'closer to suspension', 'further from suspension'), 'versus current wheel'],
  ];
  $('results').innerHTML = rows.map(([k, v, s]) => `<dt>${k}</dt><dd>${v}<small>${s}</small></dd>`).join('');

  // Warnings for every axle on the car, not just the one shown.
  const axles = state.staggered ? ['front', 'rear'] : ['front'];
  const items = [];
  for (const a of axles) {
    const axA = a === axle ? ax : axleFor(a);
    const cmpA = a === axle ? cmp : compareToReference(state[a], state[refKey(a)]);
    const prefix = state.staggered ? `${a === 'front' ? 'Front' : 'Rear'}: ` : '';
    for (const w of [...axA.warnings, ...cmpA.warnings]) items.push({ ...w, text: prefix + w.text });
  }
  const order = { alert: 0, warn: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  $('warnings').innerHTML = items.map((w) => `<li class="${w.level}">${w.text}</li>`).join('');

  $('specText').textContent = specText();
}

function specText() {
  const design = byId(DESIGNS, state.design);
  const construction = byId(CONSTRUCTIONS, state.construction);
  const face = byId(FACE_FINISHES, state.face);
  const lip = byId(LIP_FINISHES, state.lip);
  const hw = byId(HARDWARE_FINISHES, state.hardware);
  const barrel = byId(BARREL_FINISHES, state.barrel);
  const custom = (f, hex) => (f.custom ? `Custom colour ${hex.toUpperCase()}` : f.name);
  const line = (label, a) => {
    const s = state[a];
    const ax = axleFor(a);
    return `${label}: ${s.diameter} × ${s.width} ET${s.offset}, lip ${Math.round(ax.lipDepth)} mm, concave ${Math.round(ax.concave)} mm`;
  };
  const lines = [
    'Hart Forged bespoke specification',
    '',
    `Design: ${design.name}`,
    `Construction: ${construction.name}`,
    `Face profile: ${byId(PROFILES, state.profile).name}`,
  ];
  const lipStyle = state.lipStyle === 'stepped' ? 'stepped' : 'standard';
  if (state.finishMode === 'whole') {
    lines.push(`Finish: ${custom(face, state.faceCustom)}, whole wheel`, `Lip style: ${lipStyle}`);
  } else {
    lines.push(
      `Face finish: ${custom(face, state.faceCustom)}`,
      `Lip: ${custom(lip, state.lipCustom)}, ${lipStyle}`,
      `Barrel: ${custom(barrel, state.barrelCustom)}`,
    );
  }
  if (state.construction !== '1pc') lines.push(`Hardware: ${hw.name}, ${HARDWARE_COUNT[state.construction]} bolts`);
  if (state.staggered) {
    lines.push(line('Front', 'front'), line('Rear', 'rear'));
  } else {
    lines.push(line('Front and rear', 'front'));
  }
  lines.push(`Hub: ${state.bolt}, centre bore ${state.bore} mm`);
  lines.push('', 'Indicative figures. Final fitment confirmed by Racing Hart Concepts.');
  return lines.join('\n');
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Copying was blocked by the browser. Select the text and copy it instead.');
  }
}

function saveImage() {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext('2d');
  const grd = g.createRadialGradient(out.width / 2, out.height * 0.44, 0, out.width / 2, out.height * 0.44, Math.max(out.width, out.height) * 0.7);
  // Match the on-screen stage, which follows the light / dark theme
  const css = getComputedStyle(document.documentElement);
  const stage = (n) => css.getPropertyValue(`--stage-${n}`).trim();
  grd.addColorStop(0, stage(1));
  grd.addColorStop(0.58, stage(2));
  grd.addColorStop(1, stage(3));
  g.fillStyle = grd;
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, 0, 0);
  const a = document.createElement('a');
  a.download = `hart-forged-${state.design}-${state[shownAxle()].diameter}in.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  toast('Image saved');
}

// Animate the construction view open or closed (the "See the parts" button)
let explodeTween = null;
function animateExplode(to) {
  if (reduceMotion) { explode = to; syncExplode(); return; }
  explodeTween = { from: explode, to, start: performance.now(), dur: 900 };
}

function syncExplode() {
  $('explode').value = String(explode);
  $('seeParts').textContent = explode > 0.5 ? 'Put it back together' : 'See the parts';
  applyExplode();
}

// Renders the assembled wheel for one axle, seen face-on but turned by yaw
// (radians), onto a transparent square canvas px wide. The outer edge of the
// rim fills the canvas. Used to draw the wheel onto a photo of the car.
function renderWheelImage(axle, yaw, px) {
  const ax = axleFor(axle);
  const temp = axle === shownAxle() ? null : buildWheel(state, ax, mats, boltPattern());
  const r = ax.R + ax.dims.F;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 1, 10000);
  // Centre on the outer lip, so it lines up with the ring on the photo when turned
  const front = new THREE.Vector3(0, 0, ax.h + ax.dims.fT);
  cam.position.set(Math.sin(yaw) * 3000, 0, front.z + Math.cos(yaw) * 3000);
  cam.lookAt(front);

  // Show only the assembled wheel, without cut-away, datums or floor shadow
  const wasSection = sectionOn;
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  sectionOn = false;
  applyMaterials();
  shadow.visible = false;
  datum.visible = false;
  if (temp) { wheel.root.visible = false; scene.add(temp.root); }
  for (const g of Object.values(wheel.parts)) g.position.z = 0;

  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.render(scene, cam);
  const out = document.createElement('canvas');
  out.width = out.height = px;
  out.getContext('2d').drawImage(renderer.domElement, 0, 0);

  renderer.setPixelRatio(ratio);
  renderer.setSize(size.x, size.y, false);
  if (temp) { disposeWheel(temp); wheel.root.visible = true; }
  shadow.visible = true;
  sectionOn = wasSection;
  setDatumVisible(sectionOn);
  applyMaterials();
  applyExplode();
  return out;
}

const carPhoto = initCarPhoto({
  renderWheelImage,
  wheels: () => (state.staggered
    ? [{ axle: 'front', label: 'Front' }, { axle: 'rear', label: 'Rear' }]
    : [{ axle: 'front', label: 'Wheel' }, { axle: 'front', label: 'Wheel' }]),
  version: () => JSON.stringify(state),
  toast,
});

// ---------------------------------------------------------------- change handling

function changed(geometry) {
  applyMaterials();
  if (geometry) rebuild();
  else renderPanel();
  saveState();
}

// ---------------------------------------------------------------- render loop

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

function frame(now) {
  if (tween) {
    const t = Math.min(1, (now - tween.start) / tween.dur);
    camera.position.lerpVectors(tween.from, tween.to, ease(t));
    if (t >= 1) tween = null;
  }
  if (explodeTween) {
    const t = Math.min(1, (now - explodeTween.start) / explodeTween.dur);
    explode = explodeTween.from + (explodeTween.to - explodeTween.from) * t;
    if (t >= 1) explodeTween = null;
    syncExplode();
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- start

async function start() {
  try { await document.fonts.ready; } catch { /* fonts are optional */ }
  mats.cap.map = makeCapTexture('#16181c');
  buildPanel();
  applyMaterials();
  rebuild();
  camera.position.copy(viewPosition('three'));
  controls.target.set(0, 0, 0);
  controls.update();
  resize();
  $('loading').hidden = true;
  requestAnimationFrame(frame);
}

start();

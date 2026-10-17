// Builds the 3D wheel from a computed axle spec (see fitment.js).
import * as THREE from 'three';
import {
  lathe, sweptBeam, barrelProfile, ringProfile, hubProfile, clipProfileZ,
  spokeLayout, beamSamples,
} from './geom.js';
import { HARDWARE_COUNT } from './config.js';

function latheGeometry(profile, segments = 160) {
  const { positions, normals, indices } = lathe(profile, segments);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}

function spokesGeometry(ax, design) {
  const positions = [], indices = [];
  for (const b of spokeLayout(design, ax)) {
    const g = sweptBeam(beamSamples(ax, b));
    const base = positions.length / 3;
    positions.push(...g.positions);
    for (const i of g.indices) indices.push(i + base);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function capTexture(bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#f2f3f5';
  g.font = '800 104px "Archivo", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('HF', 128, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Explode distances (mm, along the axle) for each construction.
const EXPLODE = {
  '1pc': { wheel: 0, cap: 320 },
  '2pc': { barrel: -190, centre: 150, hardware: 320, cap: 460 },
  '3pc': { innerBarrel: -220, centre: 120, outerLip: 290, hardware: 420, cap: 540 },
};

export function buildWheel(state, ax, mats, bolt) {
  const root = new THREE.Group();
  const parts = {};
  const labels = [];
  const c = state.construction;
  const groupFor = (name) => {
    if (!parts[name]) {
      const g = new THREE.Group();
      g.userData.explode = EXPLODE[c][name] ?? 0;
      parts[name] = g;
      root.add(g);
    }
    return parts[name];
  };
  const add = (name, mesh) => { mesh.castShadow = false; groupFor(name).add(mesh); return mesh; };

  // ---- Barrel ----
  const barrel = barrelProfile(ax);
  const ringBack = ax.zc - ax.dims.ringT;
  const lipProfile = clipProfileZ(barrel, ax.zc, Infinity);
  const backProfile = clipProfileZ(barrel, -Infinity, c === '3pc' ? ringBack : ax.zc);
  const lipPart = c === '3pc' ? 'outerLip' : c === '2pc' ? 'barrel' : 'wheel';
  const backPart = c === '3pc' ? 'innerBarrel' : c === '2pc' ? 'barrel' : 'wheel';
  add(lipPart, new THREE.Mesh(latheGeometry(lipProfile), mats.lip));
  add(backPart, new THREE.Mesh(latheGeometry(backProfile), mats.barrel));

  // ---- Forged centre ----
  const centrePart = c === '1pc' ? 'wheel' : 'centre';
  add(centrePart, new THREE.Mesh(latheGeometry(ringProfile(ax, c)), mats.face));
  add(centrePart, new THREE.Mesh(latheGeometry(hubProfile(ax), 96), mats.face));
  add(centrePart, new THREE.Mesh(spokesGeometry(ax, state.design), mats.face));

  // Lug seats on the mounting pad
  const lugGeo = new THREE.CylinderGeometry(10.5, 10.5, 6, 32);
  lugGeo.rotateX(Math.PI / 2);
  const lugs = new THREE.InstancedMesh(lugGeo, mats.lug, bolt.lugs);
  const m = new THREE.Matrix4();
  for (let i = 0; i < bolt.lugs; i++) {
    const a = Math.PI / 2 + (i / bolt.lugs) * Math.PI * 2 + Math.PI / bolt.lugs;
    m.makeTranslation((ax.pcd / 2) * Math.cos(a), (ax.pcd / 2) * Math.sin(a), ax.hubFront);
    lugs.setMatrixAt(i, m);
  }
  add(centrePart, lugs);

  // ---- Assembly hardware ----
  if (c !== '1pc') {
    const n = HARDWARE_COUNT[c];
    const boltGeo = new THREE.CylinderGeometry(4.4, 4.4, 5, 6);
    boltGeo.rotateX(Math.PI / 2);
    const bolts = new THREE.InstancedMesh(boltGeo, mats.hardware, n);
    const rb = ax.ringInner + (ax.rIn - ax.ringInner) / 2 + 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      m.makeRotationZ(a);
      m.setPosition(rb * Math.cos(a), rb * Math.sin(a), ax.zc + 2.5);
      bolts.setMatrixAt(i, m);
    }
    add('hardware', bolts);
  }

  // ---- Centre cap ----
  const capR = ax.boreR + 9;
  const capSide = new THREE.Mesh(new THREE.CylinderGeometry(capR, capR, 7, 64, 1, true).rotateX(Math.PI / 2), mats.face);
  capSide.position.z = ax.hubFront + 5.5;
  add('cap', capSide);
  const capFace = new THREE.Mesh(new THREE.CircleGeometry(capR, 64), mats.cap);
  capFace.position.z = ax.hubFront + 9;
  add('cap', capFace);

  for (const g of Object.values(parts)) {
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // ---- Exploded-view labels (anchor points in each part's own space) ----
  const top = ax.R + ax.dims.F + 40;
  const names = {
    wheel: 'Forged monoblock', barrel: 'Barrel and lip', innerBarrel: 'Inner barrel',
    outerLip: 'Outer lip', centre: 'Forged centre', hardware: 'Assembly hardware', cap: 'Centre cap',
  };
  const anchorZ = {
    wheel: 0, barrel: 0, innerBarrel: -ax.h / 2, outerLip: ax.zc + (ax.h - ax.zc) / 2,
    centre: ax.zc, hardware: ax.zc, cap: ax.hubFront,
  };
  const anchorY = { centre: top - 70, hardware: ax.rIn + 10, cap: ax.boreR + 70 };
  for (const name of Object.keys(parts)) {
    labels.push({ part: name, text: names[name], anchor: new THREE.Vector3(0, anchorY[name] ?? top, anchorZ[name]) });
  }

  return { root, parts, labels };
}

export function makeCapTexture(bg) {
  return capTexture(bg);
}

export function disposeWheel(w) {
  if (!w) return;
  w.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isCSS2DObject && o.element) o.element.remove(); // label elements live in the DOM
  });
  w.root.removeFromParent();
}

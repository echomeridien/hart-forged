// Everything a customer can choose. Edit this file to add designs, finishes or sizes.

export const DESIGNS = [
  { id: 'split10', name: 'Split-10', blurb: 'Five twin spokes that open towards the lip.' },
  { id: 'yspoke', name: 'Y-Spoke', blurb: 'Five solid stems that branch before the barrel.' },
  { id: 'mesh', name: 'Mesh', blurb: 'Twenty crossing spokes in a woven lattice.' },
];

export const CONSTRUCTIONS = [
  { id: '1pc', name: 'Monoblock', blurb: 'Forged from one billet. Lightest and stiffest.' },
  { id: '2pc', name: '2-piece', blurb: 'Forged centre bolted into a one-piece barrel.' },
  { id: '3pc', name: '3-piece', blurb: 'Centre sandwiched between outer lip and inner barrel.' },
];

// depth: how far the hub sits behind the spoke tips, in mm (before barrel limits apply)
export const PROFILES = [
  { id: 'flat', name: 'Flat', depth: 8 },
  { id: 'concave', name: 'Concave', depth: 30 },
  { id: 'deep', name: 'Deep concave', depth: 55 },
];

// swatch: CSS background for the picker. color/metalness/roughness: the 3D material.
export const FACE_FINISHES = [
  { id: 'brushed', name: 'Brushed silver', color: '#c9ccd1', metalness: 1, roughness: 0.3, swatch: 'linear-gradient(135deg,#f4f5f7,#aeb3ba 55%,#e3e5e8)' },
  { id: 'polished', name: 'Polished', color: '#eceef0', metalness: 1, roughness: 0.07, swatch: 'linear-gradient(135deg,#ffffff,#9ea4ab 45%,#f7f8f9 70%,#c3c7cc)' },
  { id: 'gunmetal', name: 'Satin gunmetal', color: '#4c5159', metalness: 0.85, roughness: 0.42, swatch: 'linear-gradient(135deg,#6b717a,#3c4047)' },
  { id: 'bronze', name: 'Brushed bronze', color: '#8d6b45', metalness: 1, roughness: 0.34, swatch: 'linear-gradient(135deg,#c09a6b,#7a5a37)' },
  { id: 'satinblack', name: 'Satin black', color: '#1b1c1f', metalness: 0.2, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5, swatch: 'linear-gradient(135deg,#3a3c40,#151618)' },
  { id: 'matteblack', name: 'Matte black', color: '#141517', metalness: 0, roughness: 0.85, swatch: '#1c1d20' },
  { id: 'glossblack', name: 'Gloss black', color: '#0e0f11', metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, swatch: 'linear-gradient(135deg,#55585e,#0b0c0d 40%,#222428)' },
  { id: 'custom', name: 'Custom colour', custom: true, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 },
];

export const LIP_FINISHES = [
  { id: 'chrome', name: 'Chrome', color: '#f4f5f7', metalness: 1, roughness: 0.03, swatch: 'linear-gradient(135deg,#ffffff,#7d848c 40%,#ffffff 62%,#a9afb6)' },
  { id: 'brushed', name: 'Brushed', color: '#c9ccd1', metalness: 1, roughness: 0.3, swatch: 'linear-gradient(135deg,#f4f5f7,#aeb3ba 55%,#e3e5e8)' },
  { id: 'tinted', name: 'Matte tinted', color: '#3a3d42', metalness: 0.9, roughness: 0.48, swatch: 'linear-gradient(135deg,#5b5f66,#2c2e32)' },
  { id: 'glossblack', name: 'Gloss black', color: '#0e0f11', metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, swatch: 'linear-gradient(135deg,#55585e,#0b0c0d 40%,#222428)' },
  { id: 'custom', name: 'Custom colour', custom: true, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 },
];

export const HARDWARE_FINISHES = [
  { id: 'titanium', name: 'Burnt titanium', color: '#6a5fa8', metalness: 1, roughness: 0.22, swatch: 'linear-gradient(135deg,#c9a24a,#9b5aa0 45%,#3f5fb0)' },
  { id: 'polished', name: 'Polished', color: '#e2e4e7', metalness: 1, roughness: 0.08, swatch: 'linear-gradient(135deg,#ffffff,#9ea4ab 50%,#eef0f2)' },
  { id: 'black', name: 'Gloss black', color: '#111214', metalness: 0.3, roughness: 0.25, swatch: 'linear-gradient(135deg,#55585e,#0b0c0d)' },
  { id: 'gold', name: 'Gold', color: '#c9a54c', metalness: 1, roughness: 0.22, swatch: 'linear-gradient(135deg,#f0d58a,#a8812e)' },
  { id: 'red', name: 'Red anodised', color: '#a3222a', metalness: 0.6, roughness: 0.3, swatch: 'linear-gradient(135deg,#d9454d,#7d151b)' },
];

export const BARREL_FINISH = { name: 'Satin aluminium', color: '#b6bac0', metalness: 1, roughness: 0.45 };

export const BOLT_PATTERNS = [
  { id: '5x112', lugs: 5, pcd: 112, bore: 66.6 },
  { id: '5x120', lugs: 5, pcd: 120, bore: 72.6 },
  { id: '5x114.3', lugs: 5, pcd: 114.3, bore: 64.1 },
  { id: '5x130', lugs: 5, pcd: 130, bore: 71.6 },
  { id: '5x108', lugs: 5, pcd: 108, bore: 63.4 },
  { id: '6x139.7', lugs: 6, pcd: 139.7, bore: 106.1 },
];

export const DIAMETERS = [18, 19, 20, 21, 22, 23, 24];
export const WIDTHS = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13];
export const OFFSET_RANGE = { min: -30, max: 70 };

export const HARDWARE_COUNT = { '2pc': 30, '3pc': 40 };

export const DEFAULT_STATE = {
  design: 'split10',
  construction: '2pc',
  profile: 'concave',
  face: 'brushed',
  faceCustom: '#7b2d2d',
  lip: 'chrome',
  lipCustom: '#2f3540',
  lipStyle: 'stepped',
  hardware: 'titanium',
  bolt: '5x112',
  bore: 66.6,
  staggered: true,
  axle: 'front',
  front: { diameter: 20, width: 9.5, offset: 20 },
  rear: { diameter: 21, width: 10.5, offset: 20 },
  refFront: { diameter: 19, width: 9.5, offset: 20 },
  refRear: { diameter: 20, width: 10.5, offset: 20 },
};

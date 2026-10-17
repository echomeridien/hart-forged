// Everything a customer can choose. Edit this file to add designs, finishes or sizes.

// styles: which of the STYLES below each design suits (used to filter the grid)
export const DESIGNS = [
  { id: 'five', name: 'Five-Spoke', styles: ['sport', 'classic'], blurb: 'Five broad, straight spokes. Open and purposeful, with plenty of brake on show.' },
  { id: 'six', name: 'Six-Spoke', styles: ['sport'], blurb: 'Six tapered spokes for a stiff, motorsport look.' },
  { id: 'yspoke', name: 'Y-Spoke', styles: ['sport'], blurb: 'Five solid stems that branch before the barrel.' },
  { id: 'split10', name: 'Split-10', styles: ['sport', 'elegant'], blurb: 'Five twin spokes that open towards the lip.' },
  { id: 'twin7', name: 'Twin-7', styles: ['elegant'], blurb: 'Seven slender twin spokes. Light and refined.' },
  { id: 'blade', name: 'Blade', styles: ['elegant'], blurb: 'Ten curved spokes that sweep towards the lip, so the wheel looks like it is turning.' },
  { id: 'mesh', name: 'Mesh', styles: ['classic', 'multi'], blurb: 'Twenty crossing spokes in a woven lattice.' },
  { id: 'heritage', name: 'Heritage', styles: ['classic', 'multi'], blurb: 'Five stems that each fork into three, in the style of classic period wheels.' },
  { id: 'multi15', name: 'Fifteen', styles: ['multi'], blurb: 'Fifteen fine straight spokes for a busy, technical face.' },
  { id: 'turbine', name: 'Turbine', styles: ['multi'], blurb: 'Twenty thin spokes swept like a turbine. Bold at a standstill, a blur at speed.' },
];

// The styles a customer can start from. preset: the starting point a style applies.
export const STYLES = [
  {
    id: 'sport', name: 'Sport',
    cue: 'Fewer, stronger spokes, a flatter face and lots of brake on show. Light and track-bred.',
    preset: { design: 'five', construction: '1pc', profile: 'flat', face: 'satinblack', lip: 'tinted', lipStyle: 'standard', finishMode: 'parts', barrel: 'satin' },
  },
  {
    id: 'elegant', name: 'Elegant',
    cue: 'Slender twin or curved spokes, a deep concave and bright finishes. Refined rather than loud.',
    preset: { design: 'twin7', construction: '2pc', profile: 'deep', face: 'polished', lip: 'chrome', lipStyle: 'stepped', hardware: 'polished', finishMode: 'parts', barrel: 'satin' },
  },
  {
    id: 'classic', name: 'Classic',
    cue: 'Cross-laced mesh, a deep polished lip and gold hardware. Period motorsport that never dates.',
    preset: { design: 'mesh', construction: '3pc', profile: 'flat', face: 'brushed', lip: 'chrome', lipStyle: 'stepped', hardware: 'gold', finishMode: 'parts', barrel: 'satin' },
  },
  {
    id: 'multi', name: 'Multi-spoke',
    cue: 'Many fine spokes for a detailed, technical face that still looks good in close-up.',
    preset: { design: 'multi15', construction: '2pc', profile: 'concave', face: 'gunmetal', lip: 'brushed', lipStyle: 'standard', hardware: 'titanium', finishMode: 'parts', barrel: 'satin' },
  },
];

export const CONSTRUCTIONS = [
  // parts: what the "See how it's built" view separates
  { id: '1pc', name: 'Monoblock', blurb: 'Forged from one billet. Lightest and stiffest.', parts: 'Monoblock: one forged piece, plus the centre cap' },
  { id: '2pc', name: '2-piece', blurb: 'Forged centre bolted into a one-piece barrel.', parts: '2-piece: forged centre, barrel and lip, 30 bolts' },
  { id: '3pc', name: '3-piece', blurb: 'Centre sandwiched between outer lip and inner barrel.', parts: '3-piece: outer lip, forged centre, inner barrel, 40 bolts' },
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

export const BARREL_FINISHES = [
  { id: 'satin', name: 'Satin aluminium', color: '#b6bac0', metalness: 1, roughness: 0.45, swatch: 'linear-gradient(135deg,#dfe2e6,#9ca1a8)' },
  { id: 'brushed', name: 'Brushed silver', color: '#c9ccd1', metalness: 1, roughness: 0.3, swatch: 'linear-gradient(135deg,#f4f5f7,#aeb3ba 55%,#e3e5e8)' },
  { id: 'gunmetal', name: 'Satin gunmetal', color: '#4c5159', metalness: 0.85, roughness: 0.42, swatch: 'linear-gradient(135deg,#6b717a,#3c4047)' },
  { id: 'satinblack', name: 'Satin black', color: '#1b1c1f', metalness: 0.2, roughness: 0.55, swatch: 'linear-gradient(135deg,#3a3c40,#151618)' },
  { id: 'custom', name: 'Custom colour', custom: true, metalness: 0.3, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 },
];

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
  style: null,          // the style last started from, if any
  designFilter: 'all',  // 'all' or a style id
  design: 'split10',
  construction: '2pc',
  profile: 'concave',
  face: 'brushed',
  faceCustom: '#7b2d2d',
  lip: 'chrome',
  lipCustom: '#2f3540',
  lipStyle: 'stepped',
  finishMode: 'parts',  // 'whole': the face finish covers face, lip and barrel
  barrel: 'satin',
  barrelCustom: '#3a3f47',
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

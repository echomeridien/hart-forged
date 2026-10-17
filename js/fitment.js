// Fitment maths. Pure functions, no three.js, testable in Node.
// All outputs are indicative: they come from a simplified wheel model,
// not engineering drawings.

export const IN = 25.4;

export const DIMS = {
  t: 7,          // barrel wall thickness
  F: 17,         // flange height above the bead seat
  fT: 9,         // flange thickness beyond the bead seat
  ringT: 12,     // thickness of the centre's mounting ring
  padT: 34,      // hub mounting pad thickness
  stepDepth: 7,  // depth of a stepped lip
  dwDepth: 24,   // drop centre depth
  spokeRimDepth: 16,
};

// Minimum lip (bead seat to face) each construction can be built with.
export const MIN_LIP = { '1pc': 12, '2pc': 18, '3pc': 18 };

const round = (x, dp = 0) => Number(x.toFixed(dp));

export function computeAxle(spec, opts) {
  const { profileDepth, construction, stepped, pcd, bore } = opts;
  const R = (spec.diameter * IN) / 2;
  const W = spec.width * IN;
  const h = W / 2;
  const ET = spec.offset;
  const hubFront = ET + DIMS.padT;
  const minLip = MIN_LIP[construction];

  // Where the spokes meet the barrel (the "face plane").
  const zMax = h - minLip;
  const zMin = -h + 45;
  let zc = Math.min(hubFront + profileDepth, zMax);
  const limitedByWidth = hubFront + profileDepth > zMax;
  let tooDeep = false;
  if (zc < zMin) { zc = zMin; tooDeep = true; }
  const concave = zc - hubFront;

  const stepZ = stepped && h - zc > 30 ? zc + (h - zc) * 0.55 : null;
  const rIn = R - DIMS.t - (stepZ !== null ? DIMS.stepDepth : 0);
  const ringInner = rIn - (construction === '1pc' ? 14 : 22);

  const dwA = -h + 30;
  const dwB = Math.min(zc - DIMS.ringT - 22, h - 30);
  const dropWell = dwB - dwA >= 20 ? { a: dwA, b: dwB } : null;

  const hubR = pcd / 2 + 24;
  const boreR = bore / 2;

  const overall = W + IN; // rim width + flanges, the usual convention
  const backspacing = overall / 2 + ET;
  const frontSpacing = overall - backspacing;
  const lipDepth = h - zc;
  const spokeClearance = zc - DIMS.spokeRimDepth - ET;
  const barrelID = 2 * (R - DIMS.t - (dropWell ? DIMS.dwDepth : 0));

  const warnings = [];
  if (concave < 0) {
    warnings.push({
      level: 'alert',
      text: `At ET${ET} the centre would sit proud of the lip on a ${spec.width}" barrel. Lower the offset or choose a wider barrel.`,
    });
  } else if (limitedByWidth) {
    warnings.push({
      level: 'info',
      text: `Concave is limited to ${round(concave)} mm by the barrel width at this offset.`,
    });
  }
  if (hubFront > h + DIMS.fT - 2) {
    warnings.push({ level: 'alert', text: 'The hub pad would stand out beyond the lip. Lower the offset.' });
  }
  if (tooDeep) {
    warnings.push({
      level: 'alert',
      text: `At ET${ET} the centre sits at the back of the barrel. Raise the offset or choose a narrower barrel.`,
    });
  }
  if (!dropWell) {
    warnings.push({
      level: 'warn',
      text: 'There is little room for a drop centre behind the face. Confirm the tyre can be fitted.',
    });
  }
  if (hubR > ringInner - 40) {
    warnings.push({ level: 'warn', text: 'This bolt pattern leaves very short spokes at this diameter.' });
  }

  return {
    spec, R, W, h, ET, hubFront, zc, concave, stepZ, rIn, ringInner, dropWell,
    hubR, boreR, pcd, dims: DIMS,
    backspacing, frontSpacing, lipDepth, spokeClearance, barrelID,
    warnings,
  };
}

// Compare a new wheel against the wheel currently on the car.
export function compareToReference(spec, ref) {
  const W = spec.width * IN, Wr = ref.width * IN;
  const pokeDelta = (W / 2 - spec.offset) - (Wr / 2 - ref.offset);     // + = outer lip sits further out
  const innerDelta = (W / 2 + spec.offset) - (Wr / 2 + ref.offset);    // + = inner edge sits closer to suspension
  const diameterDelta = spec.diameter - ref.diameter;
  const warnings = [];
  if (pokeDelta > 10) {
    warnings.push({ level: 'warn', text: `The lip sits ${round(pokeDelta)} mm further out than your reference wheel. Check arch clearance.` });
  }
  if (innerDelta > 5) {
    warnings.push({ level: 'warn', text: `The inner barrel sits ${round(innerDelta)} mm closer to the suspension. Check strut and caliper clearance.` });
  }
  if (Math.abs(diameterDelta) >= 2) {
    warnings.push({ level: 'info', text: `That's a ${Math.abs(diameterDelta)}" change in diameter. Choose a tyre that keeps the overall rolling diameter.` });
  }
  return { pokeDelta, innerDelta, diameterDelta, warnings };
}

export function mmToIn(mm) {
  return mm / IN;
}

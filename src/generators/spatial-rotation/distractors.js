// ─── Distractor generation for Spatial Rotation ─────────────────────────────

// ─── Snap angles ────────────────────────────────────────────────────────────

export const SNAP_ANGLES = [0, 45, 90, 135, 180];

export function nextSnap(current) {
  const c = ((Math.round(current) % 360) + 360) % 360;
  for (const a of SNAP_ANGLES) {
    if (a > c) return a;
  }
  return 0;
}

export function prevSnap(current) {
  const c = ((Math.round(current) % 360) + 360) % 360;
  for (let i = SNAP_ANGLES.length - 1; i >= 0; i--) {
    if (SNAP_ANGLES[i] < c) return SNAP_ANGLES[i];
  }
  return SNAP_ANGLES[SNAP_ANGLES.length - 1];
}

// ─── Rotation clamping ──────────────────────────────────────────────────────

export const clampRot = v => Math.max(-180, Math.min(180, Math.round(v)));

// ─── Generate 3 distractors ─────────────────────────────────────────────────

export function generateDistractors(viewB, dRoll, dElev, dAzim) {
  const abs = [Math.abs(dRoll), Math.abs(dElev), Math.abs(dAzim)];
  const domIdx = abs.indexOf(Math.max(...abs));
  const domAxis = ['roll', 'elev', 'azim'][domIdx];

  // 1. Near-miss: +35 degrees on dominant axis
  const d1 = { ...viewB, [domAxis]: clampRot(viewB[domAxis] + 35) };

  // 2. Axis swap: exchange the two largest rotation axes
  const sorted = [0, 1, 2].sort((a, b) => abs[b] - abs[a]);
  const [i0, i1] = sorted;
  const axes = ['roll', 'elev', 'azim'];
  const d2 = { ...viewB, [axes[i0]]: viewB[axes[i1]], [axes[i1]]: viewB[axes[i0]] };

  // 3. Mirror trap: flip mirror + subtract 20 degrees from dominant axis
  const d3 = { ...viewB, mirror: !viewB.mirror, [domAxis]: clampRot(viewB[domAxis] - 20) };

  return [
    { view: d1, label: 'Near-Miss (+35\u00b0)', tag: 'near' },
    { view: d2, label: 'Axis Swap', tag: 'axis' },
    { view: d3, label: 'Mirror Trap', tag: 'mirror' },
  ];
}

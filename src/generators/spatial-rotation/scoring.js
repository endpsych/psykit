// ─── Difficulty scoring for Spatial Rotation ────────────────────────────────

import { BLANK_VIEW } from './shapes.js';

// ─── Difficulty labels and colors ───────────────────────────────────────────

export const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];
export const DIFFICULTY_COLORS = ['', '#34d399', '#86efac', '#fbbf24', '#f97316', '#ef4444'];

// ─── Compute difficulty ─────────────────────────────────────────────────────

export function computeDifficulty(dRoll, dElev, dAzim, mirrorChanged) {
  const abs = [Math.abs(dRoll), Math.abs(dElev), Math.abs(dAzim)];
  const total = abs[0] + abs[1] + abs[2];
  const axesUsed = abs.filter(v => v > 8).length;
  const pts = Math.min(4.5, total / 45)
    + (axesUsed > 1 ? (axesUsed - 1) * 0.7 : 0)
    + (mirrorChanged ? 1.2 : 0);
  const score = Math.max(1, Math.min(5, Math.ceil(pts)));
  return {
    score,
    label: DIFFICULTY_LABELS[score],
    color: DIFFICULTY_COLORS[score],
    total,
    axesUsed,
    mirrorChanged,
  };
}

// ─── Rotation presets ───────────────────────────────────────────────────────

export const ROTATION_PRESETS = [
  {
    label: 'Very Easy', color: '#34d399', desc: '1 axis \u00b7 45\u00b0',
    vA: { ...BLANK_VIEW },
    vB: { ...BLANK_VIEW, elev: 45 },
  },
  {
    label: 'Easy', color: '#86efac', desc: '1 axis \u00b7 90\u00b0',
    vA: { ...BLANK_VIEW },
    vB: { ...BLANK_VIEW, elev: 90 },
  },
  {
    label: 'Medium', color: '#fbbf24', desc: '2 axes \u00b7 45\u00b0+45\u00b0',
    vA: { ...BLANK_VIEW },
    vB: { ...BLANK_VIEW, roll: 45, elev: 45 },
  },
  {
    label: 'Hard', color: '#f97316', desc: '2 axes \u00b7 90\u00b0+45\u00b0',
    vA: { ...BLANK_VIEW },
    vB: { ...BLANK_VIEW, roll: 90, elev: 45 },
  },
  {
    label: 'Very Hard', color: '#ef4444', desc: '3 axes + mirror',
    vA: { ...BLANK_VIEW },
    vB: { ...BLANK_VIEW, roll: 90, elev: 90, azim: 45, mirror: true },
  },
];

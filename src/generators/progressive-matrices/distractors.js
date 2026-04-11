// Progressive Matrices — Template-specific distractor generation
// Each template has 4 distractor strategies producing plausible wrong answers.

import { CIRCLE_POSITIONS } from './templates';

function layerSig(layers) {
  return JSON.stringify((layers || []).map(l => [l.shape, l.size, l.rotation, l.fill, l.moveX, l.moveY].join(',')));
}

function unique(candidates, correctSig) {
  const seen = new Set([correctSig]);
  return candidates.filter(c => {
    const sig = layerSig(c.layers);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

// --- Rotation distractors ---
function rotationDistractors(config, derivedLayers) {
  const ref = derivedLayers[0];
  const rot = ref.rotation || 0;
  return [
    { strategyId: 'rotation-off-by-one', label: 'Off by one step', layers: [{ ...ref, rotation: (rot + 45) % 360 }] },
    { strategyId: 'rotation-row-only', label: 'Row only', layers: [{ ...ref, rotation: (rot - 90 + 360) % 360 }] },
    { strategyId: 'rotation-reverse', label: 'Reverse direction', layers: [{ ...ref, rotation: (360 - rot) % 360 }] },
    { strategyId: 'rotation-overshoot', label: 'Overshoot', layers: [{ ...ref, rotation: (rot + 90) % 360 }] },
  ];
}

// --- Size distractors ---
function sizeDistractors(config, derivedLayers) {
  const ref = derivedLayers[0];
  const sz = ref.size || 50;
  return [
    { strategyId: 'size-too-small', label: 'Too small (\u22128)', layers: [{ ...ref, size: sz - 8 }] },
    { strategyId: 'size-too-large', label: 'Too large (+8)', layers: [{ ...ref, size: sz + 8 }] },
    { strategyId: 'size-axis-confusion', label: 'Axis confusion', layers: [{ ...ref, size: sz - 10 }] },
    { strategyId: 'size-previous-cell', label: 'Previous cell', layers: [{ ...ref, size: sz - 18 }] },
  ];
}

// --- Count distractors ---
function countDistractors(config, derivedLayers) {
  const count = derivedLayers.length;
  const ref = derivedLayers[0] || { shape: 'circle', fill: '#38bdf8', stroke: '#ffffff', strokeW: 1, size: 14, rotation: 0 };
  const buildCluster = (n) => {
    const c = Math.max(1, Math.min(7, n));
    const pos = CIRCLE_POSITIONS[c] || CIRCLE_POSITIONS[1];
    return pos.map(p => ({ ...ref, moveX: p.moveX, moveY: p.moveY, count: n }));
  };
  return [
    { strategyId: 'count-minus-one', label: 'One fewer', layers: buildCluster(count - 1) },
    { strategyId: 'count-plus-one', label: 'One extra', layers: buildCluster(count + 1) },
    { strategyId: 'count-row-only', label: 'Row only (\u22122)', layers: buildCluster(count - 2) },
    { strategyId: 'count-position-confusion', label: 'Position confusion', layers: buildCluster(count).map((l, i) => ({ ...l, moveX: -l.moveX, moveY: -l.moveY })) },
  ];
}

// --- Alternation distractors ---
function alternationDistractors(config, derivedLayers) {
  const ref = derivedLayers[0];
  const isCircle = ref.shape === 'circle';
  const blue = '#38bdf8', pink = '#f472b6';
  return [
    { strategyId: 'alternation-shape-swap', label: 'Shape swap', layers: [{ ...ref, shape: isCircle ? 'square' : 'circle' }] },
    { strategyId: 'alternation-color-swap', label: 'Color swap', layers: [{ ...ref, fill: ref.fill === blue ? pink : blue }] },
    { strategyId: 'alternation-full-swap', label: 'Full swap', layers: [{ ...ref, shape: isCircle ? 'square' : 'circle', fill: ref.fill === blue ? pink : blue }] },
    { strategyId: 'alternation-unrelated', label: 'Unrelated', layers: [{ ...ref, shape: 'triangle', fill: '#a78bfa' }] },
  ];
}

// --- Dual rule distractors ---
function dualRuleDistractors(config, derivedLayers) {
  const ref = derivedLayers[0];
  const shapes = ['triangle', 'square', 'circle'].filter(s => s !== ref.shape);
  return [
    { strategyId: 'dual-wrong-shape', label: 'Wrong shape', layers: [{ ...ref, shape: shapes[0] || 'square' }] },
    { strategyId: 'dual-wrong-size', label: 'Wrong size', layers: [{ ...ref, size: (ref.size || 40) - 12 }] },
    { strategyId: 'dual-row-only', label: 'Row only', layers: [{ ...ref, shape: 'triangle', size: 40 }] },
    { strategyId: 'dual-col-only', label: 'Col only', layers: [{ ...ref, shape: shapes[1] || 'square', size: (ref.size || 40) + 12 }] },
  ];
}

// --- Dual rotation+size distractors ---
function dualRotSizeDistractors(config, derivedLayers) {
  const ref     = derivedLayers[0];
  const adjRot  = (ref.rotation + 90) % 360;
  const adjSize = Math.max(10, (ref.size || 32) - 12);
  return [
    { strategyId: 'dual-rot-size-wrong-rot',  label: 'Wrong rotation',    layers: [{ ...ref, rotation: adjRot }] },
    { strategyId: 'dual-rot-size-wrong-size', label: 'Wrong size',        layers: [{ ...ref, size: adjSize }] },
    { strategyId: 'dual-rot-size-both-wrong', label: 'Both wrong',        layers: [{ ...ref, rotation: adjRot, size: adjSize }] },
    { strategyId: 'dual-rot-size-180',        label: '180° rotation',     layers: [{ ...ref, rotation: (ref.rotation + 180) % 360 }] },
  ];
}

// --- Shape set completion distractors ---
function shapeSetDistractors(config, derivedLayers) {
  const ref        = derivedLayers[0];
  const allShapes  = ['circle', 'square', 'triangle', 'polygon', 'cross', 'star'];
  const wrongShapes = allShapes.filter(s => s !== ref.shape);
  const sz         = ref.size || 28;
  return [
    { strategyId: 'set-wrong-shape-1',  label: 'Wrong shape A',        layers: [{ ...ref, shape: wrongShapes[0] }] },
    { strategyId: 'set-wrong-shape-2',  label: 'Wrong shape B',        layers: [{ ...ref, shape: wrongShapes[1] }] },
    { strategyId: 'set-size-variant',   label: 'Right shape, wrong size', layers: [{ ...ref, size: sz + 10 }] },
    { strategyId: 'set-wrong-both',     label: 'Wrong shape + size',   layers: [{ ...ref, shape: wrongShapes[2], size: sz - 6 }] },
  ];
}

// --- Rotation+color distractors ---
function rotColorDistractors(config, derivedLayers) {
  const ref = derivedLayers[0];
  const adjRot = (ref.rotation + 45) % 360;
  const allColors = new Set();
  Object.values(config.cells).forEach(cell => {
    if (cell?.layers?.[0]?.fill) allColors.add(cell.layers[0].fill);
  });
  const wrongColor = [...allColors].find(c => c !== ref.fill) || '#f472b6';
  return [
    { strategyId: 'rot-color-wrong-rot',   label: 'Wrong rotation',        layers: [{ ...ref, rotation: adjRot }] },
    { strategyId: 'rot-color-wrong-color', label: 'Wrong color',           layers: [{ ...ref, fill: wrongColor }] },
    { strategyId: 'rot-color-both-wrong',  label: 'Wrong rotation + color',layers: [{ ...ref, rotation: adjRot, fill: wrongColor }] },
    { strategyId: 'rot-color-180',         label: '180° + wrong color',    layers: [{ ...ref, rotation: (ref.rotation + 180) % 360, fill: wrongColor }] },
  ];
}

// --- Overlay distractors ---
function overlayDistractors(config, derivedLayers) {
  const [layerA, layerB] = derivedLayers;
  if (!layerA || !layerB) return [];
  const shapes  = ['circle', 'square', 'triangle', 'polygon', 'cross', 'star'];
  const wrongA  = shapes.find(s => s !== layerA.shape) || 'square';
  const wrongB  = shapes.find(s => s !== layerB.shape && s !== wrongA) || 'triangle';
  return [
    { strategyId: 'overlay-wrong-bg',   label: 'Wrong background shape', layers: [{ ...layerA, shape: wrongA }, { ...layerB }] },
    { strategyId: 'overlay-wrong-fg',   label: 'Wrong foreground shape', layers: [{ ...layerA }, { ...layerB, shape: wrongB }] },
    { strategyId: 'overlay-both-wrong', label: 'Both shapes wrong',      layers: [{ ...layerA, shape: wrongA }, { ...layerB, shape: wrongB }] },
    { strategyId: 'overlay-swapped',    label: 'Shapes swapped',         layers: [{ ...layerA, shape: layerB.shape }, { ...layerB, shape: layerA.shape }] },
  ];
}

// --- Tri-rule distractors ---
function triRuleDistractors(config, derivedLayers) {
  const ref       = derivedLayers[0];
  const shapes    = ['circle', 'square', 'triangle', 'polygon', 'cross', 'star'];
  const wrongShape = shapes.find(s => s !== ref.shape) || 'square';
  const adjSize   = Math.max(10, (ref.size || 32) - 12);
  const adjRot    = (ref.rotation + 60) % 360;
  return [
    { strategyId: 'tri-wrong-shape',      label: 'Wrong shape',           layers: [{ ...ref, shape: wrongShape }] },
    { strategyId: 'tri-wrong-size',       label: 'Wrong size',            layers: [{ ...ref, size: adjSize }] },
    { strategyId: 'tri-wrong-rotation',   label: 'Wrong rotation',        layers: [{ ...ref, rotation: adjRot }] },
    { strategyId: 'tri-wrong-shape-size', label: 'Wrong shape + size',    layers: [{ ...ref, shape: wrongShape, size: adjSize }] },
  ];
}

const DISTRACTOR_MAP = {
  'rotation-progression':    rotationDistractors,
  'size-progression':        sizeDistractors,
  'count-progression':       countDistractors,
  'alternating-shapes':      alternationDistractors,
  'dual-rule-shape-size':    dualRuleDistractors,
  'dual-rule-rotation-size': dualRotSizeDistractors,
  'shape-set-completion':    shapeSetDistractors,
  'rotation-color-cycle':    rotColorDistractors,
  'overlay-two-shape':       overlayDistractors,
  'tri-rule':                triRuleDistractors,
};

export function generateMatrixDistractors(config, templateId, derivedLayers) {
  if (!derivedLayers || derivedLayers.length === 0) return [];
  const factory = DISTRACTOR_MAP[templateId];
  if (!factory) return [];
  const candidates = factory(config, derivedLayers);
  const correctSig = layerSig(derivedLayers);
  return unique(candidates, correctSig).slice(0, 4);
}

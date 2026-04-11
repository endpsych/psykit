/**
 * Progressive Matrices — Answer Derivation
 *
 * Derives the correct answer for the missing cell based on the template rules.
 * Each template has its own derivation logic.
 */

import { CIRCLE_POSITIONS, COLS, ROWS, cellKey } from './templates';

/**
 * Derive the correct answer for a matrix config.
 * @param {object} config - full matrix config with cells, missingCell, etc.
 * @param {string} templateId - which template was used
 * @returns {{ ok: boolean, derivedLayers: object[]|null, explanation: string[] }}
 */
export function deriveMatrixAnswer(config, templateId) {
  switch (templateId) {
    case 'rotation-progression':
      return deriveRotation(config);
    case 'size-progression':
      return deriveSize(config);
    case 'count-progression':
      return deriveCount(config);
    case 'alternating-shapes':
      return deriveAlternation(config);
    case 'dual-rule-shape-size':
      return deriveDualRule(config);
    case 'dual-rule-rotation-size':
      return deriveDualRotationSize(config);
    case 'shape-set-completion':
      return deriveShapeSetCompletion(config);
    case 'rotation-color-cycle':
      return deriveRotationColor(config);
    case 'overlay-two-shape':
      return deriveOverlay(config);
    case 'tri-rule':
      return deriveTriRule(config);
    default:
      return { ok: false, derivedLayers: null, explanation: ['Unknown template: ' + templateId] };
  }
}

// --- Helpers ---

function getLayer0(config, key) {
  const cell = config.cells[key];
  if (!cell || !cell.layers || cell.layers.length === 0) return null;
  return cell.layers[0];
}

function missingIndices(config) {
  // parse missing cell key, e.g. 'CZ' => colIdx=2, rowIdx=2
  const mc = config.missingCell || 'CZ';
  const colIdx = COLS.indexOf(mc[0]);
  const rowIdx = ROWS.indexOf(mc[1]);
  return { colIdx, rowIdx };
}

// --- Rotation derivation ---

function deriveRotation(config) {
  const explanation = [];
  const ax = getLayer0(config, 'AX');
  const bx = getLayer0(config, 'BX');
  const ay = getLayer0(config, 'AY');

  if (!ax || !bx || !ay) {
    return { ok: false, derivedLayers: null, explanation: ['Missing reference cells for rotation derivation'] };
  }

  const colDelta = ((bx.rotation || 0) - (ax.rotation || 0) + 360) % 360;
  const rowDelta = ((ay.rotation || 0) - (ax.rotation || 0) + 360) % 360;

  explanation.push(`Column delta: AX(${ax.rotation || 0}) to BX(${bx.rotation || 0}) = +${colDelta} deg`);
  explanation.push(`Row delta: AX(${ax.rotation || 0}) to AY(${ay.rotation || 0}) = +${rowDelta} deg`);

  const { colIdx, rowIdx } = missingIndices(config);
  const derived = ((ax.rotation || 0) + colIdx * colDelta + rowIdx * rowDelta) % 360;
  explanation.push(`Missing cell (col=${colIdx}, row=${rowIdx}): ${ax.rotation || 0} + ${colIdx}*${colDelta} + ${rowIdx}*${rowDelta} = ${derived} deg`);

  const derivedLayers = [{
    ...ax,
    rotation: derived,
  }];

  return { ok: true, derivedLayers, explanation };
}

// --- Size derivation ---

function deriveSize(config) {
  const explanation = [];
  const ax = getLayer0(config, 'AX');
  const bx = getLayer0(config, 'BX');
  const ay = getLayer0(config, 'AY');

  if (!ax || !bx || !ay) {
    return { ok: false, derivedLayers: null, explanation: ['Missing reference cells for size derivation'] };
  }

  const colDelta = (bx.size || 0) - (ax.size || 0);
  const rowDelta = (ay.size || 0) - (ax.size || 0);

  explanation.push(`Column size delta: AX(${ax.size}) to BX(${bx.size}) = +${colDelta}`);
  explanation.push(`Row size delta: AX(${ax.size}) to AY(${ay.size}) = +${rowDelta}`);

  const { colIdx, rowIdx } = missingIndices(config);
  const derivedSize = (ax.size || 0) + colIdx * colDelta + rowIdx * rowDelta;
  explanation.push(`Missing cell size: ${ax.size} + ${colIdx}*${colDelta} + ${rowIdx}*${rowDelta} = ${derivedSize}`);

  const derivedLayers = [{
    ...ax,
    size: derivedSize,
  }];

  return { ok: true, derivedLayers, explanation };
}

// --- Count derivation ---

function deriveCount(config) {
  const explanation = [];
  const axLayers = config.cells['AX']?.layers;
  const bxLayers = config.cells['BX']?.layers;
  const ayLayers = config.cells['AY']?.layers;

  if (!axLayers || !bxLayers || !ayLayers) {
    return { ok: false, derivedLayers: null, explanation: ['Missing reference cells for count derivation'] };
  }

  const countAX = axLayers.length;
  const countBX = bxLayers.length;
  const countAY = ayLayers.length;
  const colDelta = countBX - countAX;
  const rowDelta = countAY - countAX;

  explanation.push(`Column count delta: AX(${countAX}) to BX(${countBX}) = +${colDelta}`);
  explanation.push(`Row count delta: AX(${countAX}) to AY(${countAY}) = +${rowDelta}`);

  const { colIdx, rowIdx } = missingIndices(config);
  const derivedCount = countAX + colIdx * colDelta + rowIdx * rowDelta;
  explanation.push(`Missing cell count: ${countAX} + ${colIdx}*${colDelta} + ${rowIdx}*${rowDelta} = ${derivedCount}`);

  // Build circle cluster layers
  const clamped = Math.max(1, Math.min(7, derivedCount));
  const positions = CIRCLE_POSITIONS[clamped] || CIRCLE_POSITIONS[1];
  const ref = axLayers[0];
  const derivedLayers = positions.map(p => ({
    shape: 'circle',
    fill: ref.fill || '#38bdf8',
    stroke: ref.stroke || '#ffffff',
    strokeW: ref.strokeW != null ? ref.strokeW : 1,
    size: ref.size || 14,
    rotation: 0,
    moveX: p.moveX,
    moveY: p.moveY,
    count: derivedCount,
  }));

  return { ok: true, derivedLayers, explanation };
}

// --- Alternation derivation ---

function deriveAlternation(config) {
  const explanation = [];
  const { colIdx, rowIdx } = missingIndices(config);
  const parity = (rowIdx + colIdx) % 2;

  explanation.push(`Missing cell at col=${colIdx}, row=${rowIdx}, parity = (${rowIdx}+${colIdx})%2 = ${parity}`);

  // Find a source cell with the same parity
  let sourceKey = null;
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      if ((ri + ci) % 2 === parity) {
        const key = cellKey(COLS[ci], ROWS[ri]);
        if (config.cells[key]) {
          sourceKey = key;
          break;
        }
      }
    }
    if (sourceKey) break;
  }

  if (!sourceKey || !config.cells[sourceKey]) {
    return { ok: false, derivedLayers: null, explanation: [...explanation, 'No matching parity source cell found'] };
  }

  explanation.push(`Parity ${parity} matches cell ${sourceKey} => copy its layers`);

  const derivedLayers = config.cells[sourceKey].layers.map(l => ({ ...l }));
  return { ok: true, derivedLayers, explanation };
}

// --- Dual rule derivation ---

function deriveDualRule(config) {
  const explanation = [];
  const { colIdx, rowIdx } = missingIndices(config);

  // Shape from row anchor: same row, column A
  const rowAnchorKey = cellKey('A', ROWS[rowIdx]);
  const rowAnchor = getLayer0(config, rowAnchorKey);

  // Size from column anchor: same column, row X
  const colAnchorKey = cellKey(COLS[colIdx], 'X');
  const colAnchor = getLayer0(config, colAnchorKey);

  if (!rowAnchor || !colAnchor) {
    return { ok: false, derivedLayers: null, explanation: ['Missing anchor cells for dual-rule derivation'] };
  }

  explanation.push(`Shape from row anchor ${rowAnchorKey}: ${rowAnchor.shape}`);
  explanation.push(`Size from column anchor ${colAnchorKey}: ${colAnchor.size}`);

  const derivedLayers = [{
    ...rowAnchor,
    shape: rowAnchor.shape,
    size: colAnchor.size,
  }];

  explanation.push(`Derived: ${rowAnchor.shape} at size ${colAnchor.size}`);

  return { ok: true, derivedLayers, explanation };
}

// --- Dual rotation+size derivation ---

function deriveDualRotationSize(config) {
  const { colIdx, rowIdx } = missingIndices(config);
  const explanation = [];

  const rowAnchorKey = cellKey('A', ROWS[rowIdx]);
  const rowAnchor    = getLayer0(config, rowAnchorKey);
  const colAnchorKey = cellKey(COLS[colIdx], 'X');
  const colAnchor    = getLayer0(config, colAnchorKey);

  if (!rowAnchor || !colAnchor) {
    return { ok: false, derivedLayers: null, explanation: ['Missing anchor cells for dual-rot-size derivation'] };
  }

  explanation.push(`Rotation from row anchor ${rowAnchorKey}: ${rowAnchor.rotation}°`);
  explanation.push(`Size from column anchor ${colAnchorKey}: ${colAnchor.size}`);
  explanation.push(`Derived: ${rowAnchor.shape} at ${rowAnchor.rotation}° size ${colAnchor.size}`);

  return { ok: true, derivedLayers: [{ ...rowAnchor, size: colAnchor.size }], explanation };
}

// --- Shape set completion derivation ---

function deriveShapeSetCompletion(config) {
  const { colIdx, rowIdx } = missingIndices(config);
  const explanation = [];

  const shapesInRow = [];
  for (let ci = 0; ci < 3; ci++) {
    if (ci === colIdx) continue;
    const l = getLayer0(config, cellKey(COLS[ci], ROWS[rowIdx]));
    if (l) shapesInRow.push(l.shape);
  }

  const shapesInCol = [];
  for (let ri = 0; ri < 3; ri++) {
    if (ri === rowIdx) continue;
    const l = getLayer0(config, cellKey(COLS[colIdx], ROWS[ri]));
    if (l) shapesInCol.push(l.shape);
  }

  explanation.push(`Row ${ROWS[rowIdx]} contains: ${shapesInRow.join(', ')}`);
  explanation.push(`Column ${COLS[colIdx]} contains: ${shapesInCol.join(', ')}`);

  const allShapes = new Set();
  Object.values(config.cells).forEach(cell => {
    if (cell?.layers?.[0]?.shape) allShapes.add(cell.layers[0].shape);
  });

  const rowSet = new Set(shapesInRow);
  const colSet = new Set(shapesInCol);
  const answerShape = [...allShapes].find(s => !rowSet.has(s) && !colSet.has(s));

  if (!answerShape) {
    return { ok: false, derivedLayers: null, explanation: [...explanation, 'Cannot determine missing shape by elimination'] };
  }

  explanation.push(`Missing shape (absent from both row and column): ${answerShape}`);

  const refLayer = getLayer0(config, Object.keys(config.cells)[0]);
  return { ok: true, derivedLayers: [{ ...refLayer, shape: answerShape }], explanation };
}

// --- Rotation + color cycle derivation ---

function deriveRotationColor(config) {
  const explanation = [];
  const ax = getLayer0(config, 'AX');
  const bx = getLayer0(config, 'BX');
  const ay = getLayer0(config, 'AY');

  if (!ax || !bx || !ay) {
    return { ok: false, derivedLayers: null, explanation: ['Missing reference cells for rotation-color derivation'] };
  }

  const colDelta = ((bx.rotation || 0) - (ax.rotation || 0) + 360) % 360;
  const rowDelta = ((ay.rotation || 0) - (ax.rotation || 0) + 360) % 360;
  explanation.push(`Column rotation delta: +${colDelta}°`);
  explanation.push(`Row rotation delta: +${rowDelta}°`);

  const { colIdx, rowIdx } = missingIndices(config);
  const derived = ((ax.rotation || 0) + colIdx * colDelta + rowIdx * rowDelta) % 360;
  explanation.push(`Derived rotation: ${ax.rotation || 0} + ${colIdx}*${colDelta} + ${rowIdx}*${rowDelta} = ${derived}°`);

  // Color from any visible cell in the same row
  let rowColor = ax.fill;
  for (let ci = 0; ci < 3; ci++) {
    const l = getLayer0(config, cellKey(COLS[ci], ROWS[rowIdx]));
    if (l) { rowColor = l.fill; break; }
  }
  explanation.push(`Row color (from row ${ROWS[rowIdx]}): ${rowColor}`);

  return { ok: true, derivedLayers: [{ ...ax, rotation: derived, fill: rowColor }], explanation };
}

// --- Overlay derivation ---

function deriveOverlay(config) {
  const { colIdx, rowIdx } = missingIndices(config);
  const explanation = [];

  // Background layer: any visible cell in same row provides layer[0]
  let layerA = null;
  for (let ci = 0; ci < 3; ci++) {
    const cell = config.cells[cellKey(COLS[ci], ROWS[rowIdx])];
    if (cell?.layers?.[0]) { layerA = cell.layers[0]; break; }
  }

  // Foreground layer: any visible cell in same column provides layer[1]
  let layerB = null;
  for (let ri = 0; ri < 3; ri++) {
    const cell = config.cells[cellKey(COLS[colIdx], ROWS[ri])];
    if (cell?.layers?.[1]) { layerB = cell.layers[1]; break; }
  }

  if (!layerA || !layerB) {
    return { ok: false, derivedLayers: null, explanation: ['Missing references for overlay derivation'] };
  }

  explanation.push(`Background shape (row ${ROWS[rowIdx]} rule): ${layerA.shape}`);
  explanation.push(`Foreground shape (column ${COLS[colIdx]} rule): ${layerB.shape}`);
  explanation.push(`Derived: ${layerA.shape} (bg, large) + ${layerB.shape} (fg, small)`);

  return { ok: true, derivedLayers: [{ ...layerA }, { ...layerB }], explanation };
}

// --- Tri-rule derivation ---

function deriveTriRule(config) {
  const { colIdx, rowIdx } = missingIndices(config);
  const explanation = [];

  const rowAnchorKey = cellKey('A', ROWS[rowIdx]);
  const rowAnchor    = getLayer0(config, rowAnchorKey);
  const colAnchorKey = cellKey(COLS[colIdx], 'X');
  const colAnchor    = getLayer0(config, colAnchorKey);
  const ax = getLayer0(config, 'AX');
  const bx = getLayer0(config, 'BX');
  const ay = getLayer0(config, 'AY');

  if (!rowAnchor || !colAnchor || !ax || !bx || !ay) {
    return { ok: false, derivedLayers: null, explanation: ['Missing reference cells for tri-rule derivation'] };
  }

  const colRotD  = ((bx.rotation || 0) - (ax.rotation || 0) + 360) % 360;
  const rowRotD  = ((ay.rotation || 0) - (ax.rotation || 0) + 360) % 360;
  const derived  = ((ax.rotation || 0) + colIdx * colRotD + rowIdx * rowRotD) % 360;

  explanation.push(`Shape from row ${ROWS[rowIdx]} (col A): ${rowAnchor.shape}`);
  explanation.push(`Size from col ${COLS[colIdx]} (row X): ${colAnchor.size}`);
  explanation.push(`Col rotation delta: +${colRotD}°  |  Row rotation delta: +${rowRotD}°`);
  explanation.push(`Derived rotation: ${ax.rotation || 0} + ${colIdx}*${colRotD} + ${rowIdx}*${rowRotD} = ${derived}°`);

  return {
    ok: true,
    derivedLayers: [{ ...rowAnchor, size: colAnchor.size, rotation: derived }],
    explanation,
  };
}

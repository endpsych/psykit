/**
 * Progressive Matrices — Rule Templates
 *
 * Each template builder accepts an optional `params` object so it can be
 * called with fixed values (for reproducibility) or randomized values
 * (for generation). Use buildRandomizedTemplateConfig() to auto-generate
 * a unique item from any template family.
 */

// --- Randomization helpers ---

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randChoiceExcluding(arr, exclude) {
  const filtered = arr.filter(v => v !== exclude);
  return randChoice(filtered.length ? filtered : arr);
}

function randSample(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- Visual palettes ---

const FILL_COLORS = [
  '#38bdf8', // sky blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#fb923c', // orange
  '#a78bfa', // violet
  '#facc15', // amber
  '#22d3ee', // cyan
  '#f87171', // coral red
];

// Pairs guaranteed to look distinct together
const COLOR_PAIRS = [
  ['#38bdf8', '#f472b6'],
  ['#34d399', '#fb923c'],
  ['#a78bfa', '#facc15'],
  ['#38bdf8', '#34d399'],
  ['#f472b6', '#facc15'],
  ['#22d3ee', '#f87171'],
  ['#fb923c', '#a78bfa'],
];

const SHAPES = ['circle', 'square', 'triangle', 'polygon', 'cross', 'star'];

// --- Rotation delta pools ---

const COL_DELTA_OPTS = [30, 45, 60, 90];
const ROW_DELTA_OPTS = [45, 60, 90, 120, 135, 180];

// --- Circle-cluster positions for counts 1-7 ---
const CIRCLE_POSITIONS = {
  1: [{ moveX: 0, moveY: 0 }],
  2: [{ moveX: -12, moveY: 0 }, { moveX: 12, moveY: 0 }],
  3: [{ moveX: 0, moveY: -10 }, { moveX: -12, moveY: 10 }, { moveX: 12, moveY: 10 }],
  4: [{ moveX: -12, moveY: -10 }, { moveX: 12, moveY: -10 }, { moveX: -12, moveY: 10 }, { moveX: 12, moveY: 10 }],
  5: [{ moveX: 0, moveY: -14 }, { moveX: -14, moveY: -4 }, { moveX: 14, moveY: -4 }, { moveX: -8, moveY: 12 }, { moveX: 8, moveY: 12 }],
  6: [{ moveX: -12, moveY: -12 }, { moveX: 0, moveY: -12 }, { moveX: 12, moveY: -12 }, { moveX: -12, moveY: 8 }, { moveX: 0, moveY: 8 }, { moveX: 12, moveY: 8 }],
  7: [{ moveX: 0, moveY: -16 }, { moveX: -14, moveY: -6 }, { moveX: 14, moveY: -6 }, { moveX: -14, moveY: 8 }, { moveX: 14, moveY: 8 }, { moveX: -8, moveY: 18 }, { moveX: 8, moveY: 18 }],
};

// Column labels: A, B, C   Row labels: X, Y, Z
const COLS = ['A', 'B', 'C'];
const ROWS = ['X', 'Y', 'Z'];

function cellKey(col, row) { return `${col}${row}`; }

/**
 * Parse a cell key like 'CZ' into {colIdx, rowIdx} indices into COLS/ROWS.
 */
function parseMissingCell(key) {
  const colIdx = COLS.indexOf(key[0]);
  const rowIdx = ROWS.indexOf(key[1]);
  return {
    colIdx: colIdx >= 0 ? colIdx : 2,
    rowIdx: rowIdx >= 0 ? rowIdx : 2,
  };
}

/**
 * Valid missing cell positions per template family.
 * Cells excluded are those required as derivation anchors:
 *   - rotation/size/count:  AX, BX, AY must be visible (used to derive colDelta/rowDelta)
 *   - alternation:          AX must be visible (anchors the checkerboard parity)
 *   - dual-rule:            col-A and row-X cells are excluded (trivial; leave non-trivial quadrant)
 */
const VALID_MISSING_CELLS = {
  rotation:         ['CX', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  size:             ['CX', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  count:            ['CX', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  alternation:      ['BX', 'CX', 'AY', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  'dual-rule':      ['BY', 'CY', 'BZ', 'CZ'],
  'dual-rot-size':  ['BY', 'CY', 'BZ', 'CZ'],
  'set-completion': ['BX', 'CX', 'AY', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  'rotation-color': ['CX', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  'overlay':        ['CX', 'BY', 'CY', 'AZ', 'BZ', 'CZ'],
  'tri-rule':       ['BY', 'CY', 'BZ', 'CZ'],
};

function buildCircleCluster(count, fillColor = '#38bdf8', size = 14) {
  const positions = CIRCLE_POSITIONS[Math.max(1, Math.min(7, count))];
  if (!positions) return [{ shape: 'circle', fill: fillColor, stroke: '#ffffff', strokeW: 1, size, rotation: 0, moveX: 0, moveY: 0 }];
  return positions.map(p => ({
    shape: 'circle',
    fill: fillColor,
    stroke: '#ffffff',
    strokeW: 1,
    size,
    rotation: 0,
    moveX: p.moveX,
    moveY: p.moveY,
    count,
  }));
}

// ============================================================
// Template 1: Rotation Progression
// ============================================================
function buildRotationProgression(params = {}, missingCell = 'CZ') {
  const fill   = params.fill        ?? '#38bdf8';
  const stroke = params.stroke      ?? '#ffffff';
  const base   = params.baseRotation ?? 0;
  const colD   = params.colDelta    ?? 45;
  const rowD   = params.rowDelta    ?? 90;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const rotation = (base + ci * colD + ri * rowD) % 360;
      cells[key] = {
        layers: [{ shape: 'triangle', fill, stroke, strokeW: 2, size: 30, rotation, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerRotation = (base + colIdx * colD + rowIdx * rowD) % 360;
  const answerLayers = [{ shape: 'triangle', fill, stroke, strokeW: 2, size: 30, rotation: answerRotation, moveX: 0, moveY: 0 }];

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], rotation: (answerRotation + colD) % 360 }] },
    OPT3: { layers: [{ ...answerLayers[0], rotation: (answerRotation + rowD) % 360 }] },
    OPT4: { layers: [{ ...answerLayers[0], rotation: (answerRotation - colD + 360) % 360 }] },
    OPT5: { layers: [{ ...answerLayers[0], rotation: (answerRotation + 180) % 360 }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { fill, stroke, baseRotation: base, colDelta: colD, rowDelta: rowD } };
}

function randomParamsRotation() {
  const fill   = randChoice(FILL_COLORS);
  const colD   = randChoice(COL_DELTA_OPTS);
  const rowD   = randChoiceExcluding(ROW_DELTA_OPTS, colD);
  const base   = randInt(0, 11) * 30; // 0, 30, 60, ..., 330
  return { fill, stroke: '#ffffff', baseRotation: base, colDelta: colD, rowDelta: rowD };
}

// ============================================================
// Template 2: Size Progression
// ============================================================
function buildSizeProgression(params = {}, missingCell = 'CZ') {
  const fill   = params.fill     ?? '#38bdf8';
  const stroke = params.stroke   ?? '#ffffff';
  const shape  = params.shape    ?? 'square';
  const base   = params.baseSize ?? 24;
  const colD   = params.colDelta ?? 10;
  const rowD   = params.rowDelta ?? 8;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const size = base + ci * colD + ri * rowD;
      cells[key] = {
        layers: [{ shape, fill, stroke, strokeW: 2, size, rotation: 0, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerSize = base + colIdx * colD + rowIdx * rowD;
  const answerLayers = [{ shape, fill, stroke, strokeW: 2, size: answerSize, rotation: 0, moveX: 0, moveY: 0 }];

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], size: Math.max(4, answerSize - rowD) }] },
    OPT3: { layers: [{ ...answerLayers[0], size: answerSize + rowD }] },
    OPT4: { layers: [{ ...answerLayers[0], size: Math.max(4, answerSize - colD) }] },
    OPT5: { layers: [{ ...answerLayers[0], size: base + colIdx * colD + Math.max(0, rowIdx - 1) * rowD }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { fill, stroke, shape, baseSize: base, colDelta: colD, rowDelta: rowD } };
}

function randomParamsSize() {
  // Keep maxSize ≤ 76 so shapes never overflow the cell
  let base, colD, rowD;
  do {
    base = randInt(8, 20) * 2;          // 16–40, even steps
    colD = randInt(3,  7) * 2;          // 6–14, even steps
    rowD = randInt(3,  7) * 2;
  } while (base + 2 * colD + 2 * rowD > 76);

  const shape = randChoice(['square', 'circle', 'triangle', 'polygon']);
  const fill  = randChoice(FILL_COLORS);
  return { fill, stroke: '#ffffff', shape, baseSize: base, colDelta: colD, rowDelta: rowD };
}

// ============================================================
// Template 3: Count Progression
// ============================================================
function buildCountProgression(params = {}, missingCell = 'CZ') {
  const fill  = params.fill     ?? '#38bdf8';
  const base  = params.baseCount ?? 1;
  const colD  = params.colDelta  ?? 1;
  const rowD  = params.rowDelta  ?? 1;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const count = base + ci * colD + ri * rowD;
      cells[key] = { layers: buildCircleCluster(count, fill) };
    }
  }

  const answerCount = base + colIdx * colD + rowIdx * rowD;
  const answerLayers = buildCircleCluster(answerCount, fill);

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: buildCircleCluster(Math.max(1, answerCount - colD), fill) },
    OPT3: { layers: buildCircleCluster(Math.min(7, answerCount + colD), fill) },
    OPT4: { layers: buildCircleCluster(Math.max(1, answerCount - rowD - colD), fill) },
    OPT5: { layers: buildCircleCluster(Math.max(1, answerCount - rowD), fill) },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { fill, baseCount: base, colDelta: colD, rowDelta: rowD } };
}

function randomParamsCount() {
  // Keep answerCount = base + 2*colD + 2*rowD ≤ 7
  let base, colD, rowD;
  do {
    base = randInt(1, 3);
    colD = randInt(1, 2);
    rowD = randInt(1, 2);
  } while (base + 2 * colD + 2 * rowD > 7);

  const fill = randChoice(FILL_COLORS);
  return { fill, baseCount: base, colDelta: colD, rowDelta: rowD };
}

// ============================================================
// Template 4: Alternating Shapes
// ============================================================
function buildAlternatingShapes(params = {}, missingCell = 'CZ') {
  const evenShape  = params.evenShape  ?? 'circle';
  const oddShape   = params.oddShape   ?? 'square';
  const evenColor  = params.evenColor  ?? '#38bdf8';
  const oddColor   = params.oddColor   ?? '#f472b6';
  const size       = params.size       ?? 28;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const parity = (ri + ci) % 2;
      const shape = parity === 0 ? evenShape : oddShape;
      const fill  = parity === 0 ? evenColor : oddColor;
      cells[key] = {
        layers: [{ shape, fill, stroke: '#ffffff', strokeW: 2, size, rotation: 0, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerParity = (rowIdx + colIdx) % 2;
  const answerShape = answerParity === 0 ? evenShape : oddShape;
  const answerColor = answerParity === 0 ? evenColor : oddColor;
  const wrongShape  = answerParity === 0 ? oddShape  : evenShape;
  const wrongColor  = answerParity === 0 ? oddColor  : evenColor;
  const unrelatedShape = SHAPES.find(s => s !== evenShape && s !== oddShape) || 'polygon';

  const answerLayers = [{ shape: answerShape, fill: answerColor, stroke: '#ffffff', strokeW: 2, size, rotation: 0, moveX: 0, moveY: 0 }];

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], shape: wrongShape, fill: answerColor }] },  // shape swap
    OPT3: { layers: [{ ...answerLayers[0], shape: answerShape, fill: wrongColor }] },  // color swap
    OPT4: { layers: [{ ...answerLayers[0], shape: wrongShape, fill: wrongColor }] },   // full swap
    OPT5: { layers: [{ ...answerLayers[0], shape: unrelatedShape, fill: '#94a3b8' }] }, // unrelated
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { evenShape, oddShape, evenColor, oddColor, size } };
}

function randomParamsAlternating() {
  const [evenShape, oddShape] = randSample(SHAPES, 2);
  const [evenColor, oddColor] = randChoice(COLOR_PAIRS);
  const size = randInt(7, 14) * 3; // 21, 24, 27, 30, 33, 36, 39, 42
  return { evenShape, oddShape, evenColor, oddColor, size };
}

// ============================================================
// Template 5: Dual Rule — Shape + Size
// ============================================================
function buildDualRuleShapeSize(params = {}, missingCell = 'CZ') {
  const rowShapes = params.rowShapes ?? ['triangle', 'square', 'circle'];
  const colSizes  = params.colSizes  ?? [28, 40, 52];
  const fill      = params.fill      ?? '#38bdf8';
  const stroke    = params.stroke    ?? '#ffffff';
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      cells[key] = {
        layers: [{
          shape: rowShapes[ri],
          fill,
          stroke,
          strokeW: 2,
          size: colSizes[ci],
          rotation: 0,
          moveX: 0,
          moveY: 0,
        }],
      };
    }
  }

  const answerLayers = [{
    shape: rowShapes[rowIdx],
    fill,
    stroke,
    strokeW: 2,
    size: colSizes[colIdx],
    rotation: 0,
    moveX: 0,
    moveY: 0,
  }];

  const adjRowIdx = (rowIdx + 1) % 3;
  const adjColIdx = (colIdx + 1) % 3;
  const farRowIdx = (rowIdx + 2) % 3;
  const unrelatedShape = SHAPES.find(s => !rowShapes.includes(s)) || 'star';

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], shape: rowShapes[adjRowIdx] }] },                     // wrong shape (adjacent row)
    OPT3: { layers: [{ ...answerLayers[0], size: colSizes[adjColIdx] }] },                       // wrong size (adjacent col)
    OPT4: { layers: [{ ...answerLayers[0], shape: rowShapes[farRowIdx], size: colSizes[adjColIdx] }] }, // both wrong
    OPT5: { layers: [{ ...answerLayers[0], shape: unrelatedShape, size: colSizes[colIdx] + 10 }] },     // unrelated
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { rowShapes, colSizes, fill, stroke } };
}

function randomParamsDualRule() {
  const rowShapes = randSample(SHAPES, 3);
  // Pick 3 sizes with a consistent step, base in 20–32, step in 10–16
  const base = randInt(2, 4) * 8;           // 16, 24, 32
  const step = randChoice([10, 12, 14, 16]);
  const colSizes = [base, base + step, base + 2 * step];
  const fill = randChoice(FILL_COLORS);
  return { rowShapes, colSizes, fill, stroke: '#ffffff' };
}

// ============================================================
// Helper: Latin square generator for set completion
// ============================================================
function generateLatinSquare(shapes) {
  // 6 cyclic-distinct 3×3 Latin square patterns
  const basePerms = [
    [[0,1,2],[1,2,0],[2,0,1]],
    [[0,1,2],[2,0,1],[1,2,0]],
    [[0,2,1],[1,0,2],[2,1,0]],
    [[0,2,1],[2,1,0],[1,0,2]],
    [[1,0,2],[0,2,1],[2,1,0]],
    [[1,2,0],[0,1,2],[2,0,1]],
  ];
  const perm = randChoice(basePerms);
  const shuffled = [...shapes].sort(() => Math.random() - 0.5);
  return perm.map(row => row.map(i => shuffled[i]));
}

// ============================================================
// Template 6: Dual Rule — Rotation + Size
// ============================================================
function buildDualRotationSize(params = {}, missingCell = 'CZ') {
  const fill         = params.fill         ?? '#38bdf8';
  const stroke       = params.stroke       ?? '#ffffff';
  const shape        = params.shape        ?? 'triangle';
  const rowRotations = params.rowRotations ?? [0, 120, 240];
  const colSizes     = params.colSizes     ?? [20, 32, 44];
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      cells[key] = {
        layers: [{ shape, fill, stroke, strokeW: 2, size: colSizes[ci], rotation: rowRotations[ri], moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerLayers = [{ shape, fill, stroke, strokeW: 2, size: colSizes[colIdx], rotation: rowRotations[rowIdx], moveX: 0, moveY: 0 }];
  const adjRowIdx = (rowIdx + 1) % 3;
  const adjColIdx = (colIdx + 1) % 3;

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], rotation: rowRotations[adjRowIdx] }] },
    OPT3: { layers: [{ ...answerLayers[0], size: colSizes[adjColIdx] }] },
    OPT4: { layers: [{ ...answerLayers[0], rotation: rowRotations[adjRowIdx], size: colSizes[adjColIdx] }] },
    OPT5: { layers: [{ ...answerLayers[0], rotation: (rowRotations[rowIdx] + 180) % 360 }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { fill, stroke, shape, rowRotations, colSizes } };
}

function randomParamsDualRotationSize() {
  const shape    = randChoice(['triangle', 'square', 'polygon', 'star']);
  const fill     = randChoice(FILL_COLORS);
  const rotBase  = randInt(0, 5) * 30;
  const rotStep  = randChoice([60, 90, 120]);
  const rowRotations = [rotBase, (rotBase + rotStep) % 360, (rotBase + 2 * rotStep) % 360];
  const base     = randInt(2, 4) * 8;
  const sizeStep = randChoice([10, 12, 14]);
  const colSizes = [base, base + sizeStep, base + 2 * sizeStep];
  return { fill, stroke: '#ffffff', shape, rowRotations, colSizes };
}

// ============================================================
// Template 7: Shape Set Completion (Latin Square)
// ============================================================
function buildShapeSetCompletion(params = {}, missingCell = 'CZ') {
  const shapes = params.shapes ?? ['triangle', 'square', 'circle'];
  const fill   = params.fill   ?? '#38bdf8';
  const stroke = params.stroke ?? '#ffffff';
  const size   = params.size   ?? 28;
  const grid   = params.grid   ?? generateLatinSquare(shapes);
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      cells[key] = {
        layers: [{ shape: grid[ri][ci], fill, stroke, strokeW: 2, size, rotation: 0, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerShape  = grid[rowIdx][colIdx];
  const answerLayers = [{ shape: answerShape, fill, stroke, strokeW: 2, size, rotation: 0, moveX: 0, moveY: 0 }];
  const wrongShapes  = shapes.filter(s => s !== answerShape);

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], shape: wrongShapes[0] }] },
    OPT3: { layers: [{ ...answerLayers[0], shape: wrongShapes[1] }] },
    OPT4: { layers: [{ ...answerLayers[0], size: size + 10 }] },
    OPT5: { layers: [{ ...answerLayers[0], shape: wrongShapes[0], size: size - 8 }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { shapes, fill, stroke, size, grid } };
}

function randomParamsShapeSetCompletion() {
  const shapes = randSample(SHAPES, 3);
  const fill   = randChoice(FILL_COLORS);
  const size   = randInt(6, 11) * 4; // 24–44
  const grid   = generateLatinSquare(shapes);
  return { shapes, fill, stroke: '#ffffff', size, grid };
}

// ============================================================
// Template 8: Rotation + Color Cycle
// ============================================================
function buildRotationColorCycle(params = {}, missingCell = 'CZ') {
  const rowColors = params.rowColors    ?? ['#38bdf8', '#f472b6', '#34d399'];
  const stroke    = params.stroke       ?? '#ffffff';
  const base      = params.baseRotation ?? 0;
  const colD      = params.colDelta     ?? 45;
  const rowD      = params.rowDelta     ?? 90;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const rotation = (base + ci * colD + ri * rowD) % 360;
      cells[key] = {
        layers: [{ shape: 'triangle', fill: rowColors[ri], stroke, strokeW: 2, size: 30, rotation, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerRotation = (base + colIdx * colD + rowIdx * rowD) % 360;
  const answerColor    = rowColors[rowIdx];
  const answerLayers   = [{ shape: 'triangle', fill: answerColor, stroke, strokeW: 2, size: 30, rotation: answerRotation, moveX: 0, moveY: 0 }];
  const wrongColor     = rowColors[(rowIdx + 1) % 3];

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], rotation: (answerRotation + colD) % 360 }] },
    OPT3: { layers: [{ ...answerLayers[0], fill: wrongColor }] },
    OPT4: { layers: [{ ...answerLayers[0], fill: wrongColor, rotation: (answerRotation + rowD) % 360 }] },
    OPT5: { layers: [{ ...answerLayers[0], rotation: (answerRotation + 180) % 360 }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { rowColors, stroke, baseRotation: base, colDelta: colD, rowDelta: rowD } };
}

function randomParamsRotationColor() {
  const rowColors = randSample(FILL_COLORS, 3);
  const colD      = randChoice(COL_DELTA_OPTS);
  const rowD      = randChoiceExcluding(ROW_DELTA_OPTS, colD);
  const base      = randInt(0, 11) * 30;
  return { rowColors, stroke: '#ffffff', baseRotation: base, colDelta: colD, rowDelta: rowD };
}

// ============================================================
// Template 9: Overlay — Two-Shape Superimposition
// ============================================================
function buildOverlayTwoShape(params = {}, missingCell = 'CZ') {
  const rowShapes = params.rowShapes ?? ['triangle', 'square', 'circle'];
  const colShapes = params.colShapes ?? ['circle', 'triangle', 'square'];
  const fillA     = params.fillA     ?? '#38bdf8';
  const fillB     = params.fillB     ?? '#f472b6';
  const sizeA     = params.sizeA     ?? 38;
  const sizeB     = params.sizeB     ?? 17;
  const stroke    = params.stroke    ?? '#ffffff';
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      cells[key] = {
        layers: [
          { shape: rowShapes[ri], fill: fillA, stroke, strokeW: 2, size: sizeA, rotation: 0, moveX: 0, moveY: 0, zIndex: 0 },
          { shape: colShapes[ci], fill: fillB, stroke, strokeW: 1, size: sizeB, rotation: 0, moveX: 0, moveY: 0, zIndex: 1 },
        ],
      };
    }
  }

  const adjRowIdx = (rowIdx + 1) % 3;
  const adjColIdx = (colIdx + 1) % 3;
  const answerLayers = [
    { shape: rowShapes[rowIdx], fill: fillA, stroke, strokeW: 2, size: sizeA, rotation: 0, moveX: 0, moveY: 0, zIndex: 0 },
    { shape: colShapes[colIdx], fill: fillB, stroke, strokeW: 1, size: sizeB, rotation: 0, moveX: 0, moveY: 0, zIndex: 1 },
  ];

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0] }, { ...answerLayers[1], shape: colShapes[adjColIdx] }] },
    OPT3: { layers: [{ ...answerLayers[0], shape: rowShapes[adjRowIdx] }, { ...answerLayers[1] }] },
    OPT4: { layers: [{ ...answerLayers[0], shape: rowShapes[adjRowIdx] }, { ...answerLayers[1], shape: colShapes[adjColIdx] }] },
    OPT5: { layers: [{ ...answerLayers[0], shape: answerLayers[1].shape, fill: fillB }, { ...answerLayers[1], shape: answerLayers[0].shape, fill: fillA }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { rowShapes, colShapes, fillA, fillB, sizeA, sizeB, stroke } };
}

function randomParamsOverlay() {
  const rowShapes = randSample(SHAPES, 3);
  // colShapes: pick 3, but try to differ from rowShapes for clarity
  const remaining = SHAPES.filter(s => !rowShapes.includes(s));
  const colShapes = remaining.length >= 3 ? randSample(remaining, 3) : randSample(SHAPES, 3);
  const [fillA, fillB] = randChoice(COLOR_PAIRS);
  const sizeA = randInt(7, 9) * 5; // 35, 40, 45
  const sizeB = Math.max(12, Math.round(sizeA * 0.42));
  return { rowShapes, colShapes, fillA, fillB, sizeA, sizeB, stroke: '#ffffff' };
}

// ============================================================
// Template 10: Three-Rule — Shape + Size + Rotation
// ============================================================
function buildTriRule(params = {}, missingCell = 'CZ') {
  const rowShapes = params.rowShapes   ?? ['triangle', 'square', 'circle'];
  const colSizes  = params.colSizes    ?? [20, 32, 44];
  const fill      = params.fill        ?? '#38bdf8';
  const stroke    = params.stroke      ?? '#ffffff';
  const baseRot   = params.baseRotation ?? 0;
  const colRotD   = params.colRotDelta  ?? 45;
  const rowRotD   = params.rowRotDelta  ?? 90;
  const { colIdx, rowIdx } = parseMissingCell(missingCell);

  const cells = {};
  for (let ri = 0; ri < 3; ri++) {
    for (let ci = 0; ci < 3; ci++) {
      const key = cellKey(COLS[ci], ROWS[ri]);
      if (key === missingCell) continue;
      const rotation = (baseRot + ci * colRotD + ri * rowRotD) % 360;
      cells[key] = {
        layers: [{ shape: rowShapes[ri], fill, stroke, strokeW: 2, size: colSizes[ci], rotation, moveX: 0, moveY: 0 }],
      };
    }
  }

  const answerRotation = (baseRot + colIdx * colRotD + rowIdx * rowRotD) % 360;
  const answerLayers   = [{ shape: rowShapes[rowIdx], fill, stroke, strokeW: 2, size: colSizes[colIdx], rotation: answerRotation, moveX: 0, moveY: 0 }];
  const adjRowIdx      = (rowIdx + 1) % 3;
  const adjColIdx      = (colIdx + 1) % 3;

  const options = {
    OPT1: { layers: answerLayers },
    OPT2: { layers: [{ ...answerLayers[0], shape: rowShapes[adjRowIdx] }] },
    OPT3: { layers: [{ ...answerLayers[0], size: colSizes[adjColIdx] }] },
    OPT4: { layers: [{ ...answerLayers[0], rotation: (answerRotation + colRotD) % 360 }] },
    OPT5: { layers: [{ ...answerLayers[0], shape: rowShapes[adjRowIdx], size: colSizes[adjColIdx] }] },
  };

  return { gridLabel: '3x3', missingCell, keyedOption: 'OPT1', cells, options,
    _params: { rowShapes, colSizes, fill, stroke, baseRotation: baseRot, colRotDelta: colRotD, rowRotDelta: rowRotD } };
}

function randomParamsTriRule() {
  const rowShapes = randSample(SHAPES, 3);
  const base      = randInt(2, 4) * 8;
  const sizeStep  = randChoice([10, 12, 14]);
  const colSizes  = [base, base + sizeStep, base + 2 * sizeStep];
  const fill      = randChoice(FILL_COLORS);
  const baseRot   = randInt(0, 5) * 30;
  const colRotD   = randChoice([30, 45, 60]);
  const rowRotD   = randChoiceExcluding([45, 60, 90, 120], colRotD);
  return { rowShapes, colSizes, fill, stroke: '#ffffff', baseRotation: baseRot, colRotDelta: colRotD, rowRotDelta: rowRotD };
}

// ============================================================
// Template definitions
// ============================================================

export const ALL_TEMPLATES = [
  {
    id: 'rotation-progression',
    name: 'Rotation Progression',
    family: 'rotation',
    difficulty: 'easy',
    build: buildRotationProgression,
    randomParams: randomParamsRotation,
    description: 'A triangle rotates by a fixed angle across columns and rows.',
  },
  {
    id: 'size-progression',
    name: 'Size Progression',
    family: 'size',
    difficulty: 'easy',
    build: buildSizeProgression,
    randomParams: randomParamsSize,
    description: 'A shape increases in size consistently across columns and rows.',
  },
  {
    id: 'count-progression',
    name: 'Count Progression',
    family: 'count',
    difficulty: 'medium',
    build: buildCountProgression,
    randomParams: randomParamsCount,
    description: 'The number of elements increases across columns and rows.',
  },
  {
    id: 'alternating-shapes',
    name: 'Alternating Shapes',
    family: 'alternation',
    difficulty: 'medium',
    build: buildAlternatingShapes,
    randomParams: randomParamsAlternating,
    description: 'Checkerboard parity governs shape and color. Two visual states alternate.',
  },
  {
    id: 'dual-rule-shape-size',
    name: 'Dual Rule: Shape + Size',
    family: 'dual-rule',
    difficulty: 'hard',
    build: buildDualRuleShapeSize,
    randomParams: randomParamsDualRule,
    description: 'Rows encode shape identity; columns encode size. Both rules must be integrated.',
  },
  {
    id: 'dual-rule-rotation-size',
    name: 'Dual Rule: Rotation + Size',
    family: 'dual-rot-size',
    difficulty: 'hard',
    build: buildDualRotationSize,
    randomParams: randomParamsDualRotationSize,
    description: 'Rows encode rotation angle; columns encode size. Two quantitative rules must be identified and combined.',
  },
  {
    id: 'shape-set-completion',
    name: 'Shape Set Completion',
    family: 'set-completion',
    difficulty: 'hard',
    build: buildShapeSetCompletion,
    randomParams: randomParamsShapeSetCompletion,
    description: 'Each row and column contains each of three shapes exactly once. Find the shape absent from both the target row and column.',
  },
  {
    id: 'rotation-color-cycle',
    name: 'Rotation + Color Cycle',
    family: 'rotation-color',
    difficulty: 'hard',
    build: buildRotationColorCycle,
    randomParams: randomParamsRotationColor,
    description: 'Rotation angle progresses with column and row deltas; fill color cycles independently per row. Both rules must be integrated.',
  },
  {
    id: 'overlay-two-shape',
    name: 'Overlay: Two-Shape Superimposition',
    family: 'overlay',
    difficulty: 'very hard',
    build: buildOverlayTwoShape,
    randomParams: randomParamsOverlay,
    description: 'Each cell overlays two shapes. The background shape follows the row rule; the foreground shape follows the column rule independently.',
  },
  {
    id: 'tri-rule',
    name: 'Three-Rule: Shape + Size + Rotation',
    family: 'tri-rule',
    difficulty: 'very hard',
    build: buildTriRule,
    randomParams: randomParamsTriRule,
    description: 'Three rules simultaneously: rows encode shape, columns encode size, and rotation follows an independent two-axis progression.',
  },
];

/**
 * Build a config from a template ID using fixed (default) parameters.
 * Always produces the same item — useful as a preview/demo.
 */
export function buildRuleTemplateConfig(templateId) {
  const template = ALL_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  const config = template.build();
  return {
    ...config,
    templateId: template.id,
    templateName: template.name,
    family: template.family,
    templateDifficulty: template.difficulty,
  };
}

/**
 * Randomly reassign OPT1–OPT5 slots so the correct answer isn't always OPT1.
 * Updates keyedOption to reflect where the answer actually landed.
 */
function shuffleOptions(config) {
  const OPT_KEYS = ['OPT1', 'OPT2', 'OPT3', 'OPT4', 'OPT5'];

  // Fisher-Yates shuffle on a copy
  const shuffled = [...OPT_KEYS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // shuffled[i] is the new OPT slot that gets the content that was in OPT_KEYS[i]
  const newOptions = {};
  OPT_KEYS.forEach((origKey, i) => {
    newOptions[shuffled[i]] = config.options[origKey];
  });

  // The answer was in OPT1 (index 0), so it moved to shuffled[0]
  const newKeyedOption = shuffled[0];

  return { ...config, options: newOptions, keyedOption: newKeyedOption };
}

/**
 * Build a config from a template ID using randomized parameters.
 * Produces a unique item every call, with a random missing cell and
 * the answer placed in a random option slot.
 */
export function buildRandomizedTemplateConfig(templateId) {
  const template = ALL_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  const params = template.randomParams();
  const validCells = VALID_MISSING_CELLS[template.family] || ['CZ'];
  const missingCell = randChoice(validCells);
  const config = template.build(params, missingCell);
  const shuffled = shuffleOptions(config);
  return {
    ...shuffled,
    templateId: template.id,
    templateName: template.name,
    family: template.family,
    templateDifficulty: template.difficulty,
  };
}

export { CIRCLE_POSITIONS, COLS, ROWS, cellKey };

/**
 * Progressive Matrices — Item Validation
 *
 * Adapted from AppCraft's matrixValidation.js.
 * Runs structural and logical checks on a generated matrix item to catch
 * issues before the item is added to the bank.
 */

const COLS = ['A', 'B', 'C'];
const ROWS = ['X', 'Y', 'Z'];
const OPT_KEYS = ['OPT1', 'OPT2', 'OPT3', 'OPT4', 'OPT5'];

function allBoardCells() {
  const cells = [];
  for (const row of ROWS) {
    for (const col of COLS) {
      cells.push(`${col}${row}`);
    }
  }
  return cells;
}

function layerSignature(layer) {
  return JSON.stringify([
    layer.shape, layer.size, layer.rotation, layer.fill,
    layer.stroke, layer.strokeW, layer.moveX, layer.moveY,
  ]);
}

function layerSetSignature(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return '';
  return layers.map(layerSignature).sort().join('|');
}

function makeCheck(id, label, status, detail) {
  return { id, label, status, detail };
}

/**
 * Validate a matrix item for structural and logical consistency.
 *
 * @param {object} config     — full matrix config (cells, options, missingCell, keyedOption, …)
 * @param {object} derivation — result of deriveMatrixAnswer() (may be null)
 * @param {array}  distractors — result of generateMatrixDistractors() (may be empty)
 * @returns {{ ok, status, summary, checks, counts }}
 */
export function validateMatrixItem(config, derivation, distractors) {
  if (!config) {
    return {
      ok: false, status: 'fail',
      summary: 'No configuration to validate.',
      checks: [], counts: { pass: 0, warning: 0, fail: 1 },
    };
  }

  const checks = [];
  const { cells = {}, options = {}, missingCell, keyedOption } = config;
  const boardCells = allBoardCells();

  // 1. Matrix coverage — every visible cell has at least one layer
  const visibleCells = boardCells.filter(c => c !== missingCell);
  const emptyCells = visibleCells.filter(c =>
    !cells[c] || !cells[c].layers || cells[c].layers.length === 0
  );
  checks.push(makeCheck(
    'matrix-coverage', 'Matrix coverage',
    emptyCells.length === 0 ? 'pass' : 'fail',
    emptyCells.length === 0
      ? 'Every visible matrix cell has at least one layer.'
      : `Empty cells: ${emptyCells.join(', ')}.`,
  ));

  // 2. Missing cell validity
  const validCell = boardCells.includes(missingCell);
  checks.push(makeCheck(
    'missing-cell-valid', 'Missing cell validity',
    validCell ? 'pass' : 'fail',
    validCell
      ? `Missing cell ${missingCell} is a valid grid position.`
      : `Missing cell "${missingCell}" is not a valid grid position.`,
  ));

  // 3. Keyed option present — the correct answer slot has layers
  const keyedLayers = options[keyedOption]?.layers || [];
  checks.push(makeCheck(
    'keyed-option-present', 'Keyed option coverage',
    keyedLayers.length > 0 ? 'pass' : 'fail',
    keyedLayers.length > 0
      ? `${keyedOption} has ${keyedLayers.length} layer(s).`
      : `${keyedOption} has no layers.`,
  ));

  // 4. Option coverage — all 5 slots populated
  const populated = OPT_KEYS.filter(k => (options[k]?.layers || []).length > 0);
  checks.push(makeCheck(
    'option-coverage', 'Option coverage',
    populated.length === 5 ? 'pass' : populated.length >= 2 ? 'warning' : 'fail',
    populated.length === 5
      ? 'All 5 option slots are populated.'
      : `${populated.length}/5 options populated.`,
  ));

  // 5. Option uniqueness — no two options visually identical
  const duplicatePairs = [];
  const optSets = populated.map(k => ({
    key: k,
    sig: layerSetSignature(options[k]?.layers || []),
  }));
  for (let i = 0; i < optSets.length; i++) {
    for (let j = i + 1; j < optSets.length; j++) {
      if (optSets[i].sig && optSets[i].sig === optSets[j].sig) {
        duplicatePairs.push(`${optSets[i].key} = ${optSets[j].key}`);
      }
    }
  }
  checks.push(makeCheck(
    'option-uniqueness', 'Option uniqueness',
    duplicatePairs.length === 0 ? 'pass' : 'fail',
    duplicatePairs.length === 0
      ? 'All options are visually distinct.'
      : `Duplicate options: ${duplicatePairs.join('; ')}.`,
  ));

  // 6. Derivation match — keyed option matches derived answer, and only it does
  if (derivation?.ok) {
    const derivedSig = layerSetSignature(derivation.derivedLayers || []);
    const matchingOpts = OPT_KEYS.filter(k =>
      layerSetSignature(options[k]?.layers || []) === derivedSig
    );
    const isCorrect = matchingOpts.length === 1 && matchingOpts[0] === keyedOption;
    checks.push(makeCheck(
      'derivation-match', 'Derived answer alignment',
      isCorrect ? 'pass' : matchingOpts.length === 1 ? 'fail' : 'warning',
      isCorrect
        ? `${keyedOption} is the only option matching the derived answer.`
        : matchingOpts.length === 0
          ? 'No option currently matches the derived answer.'
          : matchingOpts.length === 1
            ? `${matchingOpts[0]} matches instead of ${keyedOption}.`
            : `Multiple options match: ${matchingOpts.join(', ')}.`,
    ));
  } else {
    checks.push(makeCheck(
      'derivation-match', 'Derived answer alignment', 'warning',
      'No derivation available for the current configuration.',
    ));
  }

  // 7. Distractor isolation — no distractor duplicates the correct answer
  if (Array.isArray(distractors) && distractors.length > 0) {
    const correctSig = layerSetSignature(keyedLayers);
    const dupes = distractors.filter(d =>
      layerSetSignature(d.layers || []) === correctSig
    );
    checks.push(makeCheck(
      'distractor-validity', 'Distractor isolation',
      dupes.length === 0 ? 'pass' : 'fail',
      dupes.length === 0
        ? 'No distractor duplicates the correct answer.'
        : `${dupes.length} distractor(s) match the correct answer.`,
    ));
  } else {
    checks.push(makeCheck(
      'distractor-validity', 'Distractor isolation', 'warning',
      'Distractors not generated yet.',
    ));
  }

  // Aggregate
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warning').length;
  const passCount = checks.filter(c => c.status === 'pass').length;
  const status = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';

  return {
    ok: status === 'pass',
    status,
    summary: status === 'pass'
      ? 'All checks passed. Item is logically consistent.'
      : status === 'warning'
        ? 'Warnings found. Item usable but some checks need attention.'
        : 'Validation failed. Structural or logical issues detected.',
    checks,
    counts: { pass: passCount, warning: warnCount, fail: failCount },
  };
}

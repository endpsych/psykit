/* ---------------------------------------------------------------
   engine.js  --  Sequence generation for Number Series models
   --------------------------------------------------------------- */

import {
  integer, frac, surd, addTerms, multiplyTerms, subtractTerms, divideTerms,
  displayTerm, termValue, termsEqual,
} from './terms.js';
import { buildDistractors } from './distractors.js';
import { computeItemDifficulty } from './scoring.js';

// ---------- Model definitions ----------

export const NUMBER_SERIES_MODELS = [
  { id: 1,  name: 'Integer Arithmetic Sequence',            title: 'One-step arithmetic sequence with integers',            description: 'aₙ₊₁ = aₙ + k',                           stepType: 'one', elementType: 'integer',  step1Rule: 'arithmetic',     step2Rule: null,         behaviorType: 'constant-step', extendedType: null, score: 1, tier: 'easy' },
  { id: 2,  name: 'Integer Geometric Sequence',             title: 'One-step geometric sequence with integers',             description: 'aₙ₊₁ = aₙ × k',                           stepType: 'one', elementType: 'integer',  step1Rule: 'geometric',      step2Rule: null,         behaviorType: 'constant-step', extendedType: null, score: 2, tier: 'easy' },
  { id: 3,  name: 'Integer Addition Sequence',              title: 'Integer addition sequence',                             description: 'aₙ₊₂ = aₙ₊₁ + aₙ',                       stepType: 'one', elementType: 'integer',  step1Rule: 'addition',       step2Rule: null,         behaviorType: 'recurrence',    extendedType: null, score: 4, tier: 'medium' },
  { id: 4,  name: 'Integer Multiplication Sequence',        title: 'Integer multiplication sequence',                       description: 'aₙ₊₂ = aₙ₊₁ × aₙ',                       stepType: 'one', elementType: 'integer',  step1Rule: 'multiplication', step2Rule: null,         behaviorType: 'recurrence',    extendedType: null, score: 6, tier: 'hard' },
  { id: 5,  name: 'Fraction Arithmetic Sequence',           title: 'One-step arithmetic sequence with fractions',           description: 'aₙ₊₁ = aₙ + k',                           stepType: 'one', elementType: 'fraction', step1Rule: 'arithmetic',     step2Rule: null,         behaviorType: 'constant-step', extendedType: null, score: 3, tier: 'medium' },
  { id: 6,  name: 'Fraction Geometric Sequence',            title: 'One-step geometric sequence with fractions',            description: 'aₙ₊₁ = aₙ × k',                           stepType: 'one', elementType: 'fraction', step1Rule: 'geometric',      step2Rule: null,         behaviorType: 'constant-step', extendedType: null, score: 4, tier: 'medium' },
  { id: 7,  name: 'Integer Arithmetic + Arithmetic Sequence', title: 'Two-step arithmetic + arithmetic sequence with integers', description: 'aₙ₊₁ = aₙ + bₙ, bₙ₊₁ = bₙ + k',         stepType: 'two', elementType: 'integer',  step1Rule: 'arithmetic',     step2Rule: 'arithmetic', behaviorType: 'derived-step',  extendedType: null, score: 4, tier: 'medium' },
  { id: 8,  name: 'Integer Arithmetic + Geometric Sequence',  title: 'Two-step arithmetic + geometric sequence with integers',  description: 'aₙ₊₁ = aₙ + bₙ, bₙ₊₁ = bₙ × k',         stepType: 'two', elementType: 'integer',  step1Rule: 'arithmetic',     step2Rule: 'geometric',  behaviorType: 'derived-step',  extendedType: null, score: 5, tier: 'hard' },
  { id: 9,  name: 'Integer Geometric + Arithmetic Sequence',  title: 'Two-step geometric + arithmetic sequence with integers',  description: 'aₙ₊₁ = aₙ × bₙ, bₙ₊₁ = bₙ + k',         stepType: 'two', elementType: 'integer',  step1Rule: 'geometric',      step2Rule: 'arithmetic', behaviorType: 'derived-step',  extendedType: null, score: 5, tier: 'hard' },
  { id: 10, name: 'Integer Geometric + Geometric Sequence', title: 'Two-step geometric + geometric sequence with integers', description: 'aₙ₊₁ = aₙ × bₙ, bₙ₊₁ = bₙ × k',         stepType: 'two', elementType: 'integer',  step1Rule: 'geometric',      step2Rule: 'geometric',  behaviorType: 'derived-step',  extendedType: null, score: 6, tier: 'hard' },
];

export const EXTENDED_MODELS = [];

export const ALL_MODELS = [...NUMBER_SERIES_MODELS, ...EXTENDED_MODELS];

export function getModel(id) {
  return ALL_MODELS.find(m => m.id === id);
}

export function getModelForItem(item) {
  if (!item) return null;

  if (item.modelId === 3 && item.derivative && item.step2Rule === 'arithmetic') {
    return getModel(7);
  }

  if (item.modelId === 4 && item.derivative && item.step2Rule === 'geometric') {
    return getModel(10);
  }

  return getModel(item.modelId);
}

// ---------- random helpers ----------

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function randNonZero(lo, hi) {
  let v;
  do { v = randInt(lo, hi); } while (v === 0);
  return v;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomElement(elementType, seedLimit) {
  const sl = seedLimit || 5;
  if (elementType === 'fraction') {
    const n = randNonZero(-sl, sl);
    const d = randInt(2, 5);
    return frac(n, d);
  }
  if (elementType === 'surd') {
    const rads = [2, 3, 5, 7, 11];
    const c = randNonZero(1, sl);
    const r = rads[randInt(0, rads.length - 1)];
    return surd(c, r);
  }
  return integer(randNonZero(-sl, sl));
}

function randomIncrement(elementType, boundLimit) {
  const bl = boundLimit || 5;
  if (elementType === 'fraction') {
    return integer(randNonZero(-bl, bl));
  }
  if (elementType === 'surd') {
    const rads = [2, 3, 5];
    const c = randNonZero(1, Math.min(bl, 3));
    return surd(c, rads[randInt(0, rads.length - 1)]);
  }
  return integer(randNonZero(-bl, bl));
}

function randomRatio(elementType, boundLimit) {
  const bl = Math.max(2, boundLimit || 3);
  if (elementType === 'fraction') {
    return integer(randNonZero(2, bl));
  }
  return integer(randNonZero(2, bl));
}

// ---------- one-step builder ----------

export function buildOneStep(rule, elementType, seedLimit, boundLimit, length = 5, fixedSeed = null, fixedIncrement = null, fixedSecondSeed = null, secondSeedLimit = null) {
  const sl = seedLimit || 5;
  const bl = boundLimit || 5;
  const ssl = secondSeedLimit || sl;
  const n = Math.max(5, Math.min(8, length));
  const terms = new Array(n);
  const canUseExactScalar = elementType !== 'fraction';

  if (rule === 'arithmetic') {
    const start = canUseExactScalar && fixedSeed !== null ? integer(fixedSeed) : randomElement(elementType, sl);
    const inc = canUseExactScalar && fixedIncrement !== null ? integer(fixedIncrement) : randomIncrement(elementType, bl);
    terms[0] = start;
    for (let i = 1; i < n; i++) {
      terms[i] = addTerms(terms[i - 1], inc);
    }
    return { terms, rule, inc };
  }

  if (rule === 'geometric') {
    const start = canUseExactScalar && fixedSeed !== null ? integer(fixedSeed) : randomElement(elementType, sl);
    const ratio = canUseExactScalar && fixedIncrement !== null ? integer(fixedIncrement) : randomRatio(elementType, bl);
    terms[0] = start;
    for (let i = 1; i < n; i++) {
      terms[i] = multiplyTerms(terms[i - 1], ratio);
    }
    return { terms, rule, ratio };
  }

  if (rule === 'addition') {
    // Fibonacci-like: t[i] = t[i-1] + t[i-2]
    terms[0] = canUseExactScalar && fixedSeed !== null ? integer(fixedSeed) : randomElement(elementType, sl);
    terms[1] = canUseExactScalar && fixedSecondSeed !== null ? integer(fixedSecondSeed) : randomElement(elementType, ssl);
    for (let i = 2; i < n; i++) {
      terms[i] = addTerms(terms[i - 1], terms[i - 2]);
    }
    return { terms, rule };
  }

  if (rule === 'multiplication') {
    // t[i] = t[i-1] * t[i-2]
    const small = Math.min(sl, 3);
    const secondSmall = Math.min(ssl, 3);
    terms[0] = canUseExactScalar && fixedSeed !== null ? integer(fixedSeed) : randomElement(elementType, small);
    terms[1] = canUseExactScalar && fixedSecondSeed !== null ? integer(fixedSecondSeed) : randomElement(elementType, secondSmall);
    for (let i = 2; i < n; i++) {
      terms[i] = multiplyTerms(terms[i - 1], terms[i - 2]);
    }
    return { terms, rule };
  }

  return { terms: Array.from({ length: n }, () => integer(0)), rule };
}

// ---------- two-step builder ----------

export function buildTwoStep(step1Rule, step2Rule, seedLimit, boundLimit, length = 5, fixedSeed = null, fixedIncrement = null) {
  const sl = seedLimit || 5;
  const bl = boundLimit || 5;
  const n = Math.max(5, Math.min(8, length));
  const derivLen = n - 1;

  // Build derivative sequence via step2Rule
  const deriv = new Array(derivLen);
  if (step2Rule === 'arithmetic') {
    const start = fixedIncrement !== null ? integer(fixedIncrement) : integer(randNonZero(1, bl));
    const inc = integer(randNonZero(-bl, bl));
    deriv[0] = start;
    for (let i = 1; i < derivLen; i++) deriv[i] = addTerms(deriv[i - 1], inc);
  } else if (step2Rule === 'geometric') {
    const start = fixedIncrement !== null ? integer(Math.max(2, Math.abs(fixedIncrement))) : integer(randNonZero(1, Math.min(bl, 3)));
    const ratio = integer(randNonZero(2, Math.min(bl, 3)));
    deriv[0] = start;
    for (let i = 1; i < derivLen; i++) deriv[i] = multiplyTerms(deriv[i - 1], ratio);
  } else {
    for (let i = 0; i < derivLen; i++) deriv[i] = integer(randNonZero(1, bl));
  }

  // Construct primary via step1Rule applied with derivative
  const terms = new Array(n);
  terms[0] = fixedSeed !== null ? integer(fixedSeed) : integer(randNonZero(-sl, sl));
  for (let i = 1; i < n; i++) {
    if (step1Rule === 'arithmetic') {
      terms[i] = addTerms(terms[i - 1], deriv[i - 1]);
    } else if (step1Rule === 'geometric') {
      terms[i] = multiplyTerms(terms[i - 1], deriv[i - 1]);
    }
  }

  return { terms, derivative: deriv, step1Rule, step2Rule };
}

// ---------- item generation ----------

function isZeroTerm(term) {
  return termValue(term) === 0;
}

function fitsGeometricSequence(terms) {
  if (!terms.length || terms.some((term) => !term || isZeroTerm(term))) return false;

  let ratio = null;
  for (let i = 1; i < terms.length; i++) {
    if (!isZeroTerm(terms[i - 1])) {
      ratio = divideTerms(terms[i], terms[i - 1]);
      break;
    }
  }
  if (!ratio) return false;

  for (let i = 1; i < terms.length; i++) {
    if (!termsEqual(terms[i], multiplyTerms(terms[i - 1], ratio))) {
      return false;
    }
  }
  return true;
}

function fitsAdditionSequence(terms) {
  if (terms.length < 3 || terms.some((term) => !term)) return false;
  for (let i = 2; i < terms.length; i++) {
    if (!termsEqual(terms[i], addTerms(terms[i - 1], terms[i - 2]))) {
      return false;
    }
  }
  return true;
}

function solveAdditionMissing(visibleTerms, missingIndex) {
  const n = visibleTerms.length;
  if (n < 3) return null;

  if (missingIndex === 0) {
    if (!visibleTerms[1] || !visibleTerms[2]) return null;
    return subtractTerms(visibleTerms[2], visibleTerms[1]);
  }

  if (missingIndex === 1) {
    if (!visibleTerms[0] || !visibleTerms[2]) return null;
    return subtractTerms(visibleTerms[2], visibleTerms[0]);
  }

  if (missingIndex === n - 1) {
    if (!visibleTerms[n - 2] || !visibleTerms[n - 3]) return null;
    return addTerms(visibleTerms[n - 2], visibleTerms[n - 3]);
  }

  if (!visibleTerms[missingIndex - 1] || !visibleTerms[missingIndex + 1]) return null;
  return subtractTerms(visibleTerms[missingIndex + 1], visibleTerms[missingIndex - 1]);
}

function hasCompetingAdditionCompletion(terms, missingIndex, answer) {
  const visibleTerms = terms.map((term, index) => (index === missingIndex ? null : term));
  const candidate = solveAdditionMissing(visibleTerms, missingIndex);
  if (!candidate || termsEqual(candidate, answer)) return false;

  const completed = visibleTerms.map((term, index) => (index === missingIndex ? candidate : term));
  return fitsAdditionSequence(completed);
}

function isConstructValid(model, terms, missingIndex, answer) {
  if (terms.length < 5) return false;

  if (
    model.stepType === 'two'
    && model.step1Rule === 'arithmetic'
    && model.step2Rule === 'geometric'
    && fitsGeometricSequence(terms)
  ) {
    return false;
  }

  if (
    model.stepType === 'two'
    && model.step1Rule === 'arithmetic'
    && model.step2Rule === 'arithmetic'
    && hasCompetingAdditionCompletion(terms, missingIndex, answer)
  ) {
    return false;
  }

  return true;
}

function isBounded(terms, limit) {
  return terms.every(t => {
    const v = Math.abs(termValue(t));
    return isFinite(v) && v < limit;
  });
}

function hasEnoughUnique(terms, minUnique) {
  const strs = new Set(terms.map(displayTerm));
  return strs.size >= minUnique;
}

function bumpReason(reasonCounts, key, label) {
  const current = reasonCounts.get(key) || { key, label, count: 0 };
  current.count += 1;
  reasonCounts.set(key, current);
}

function generateSeriesItemInternal(model, settings = {}, options = {}) {
  const {
    seedLimit = 5,
    boundLimit = 5,
    fixedSeed = null,
    fixedIncrement = null,
    fixedSecondSeed = null,
    secondSeedLimit = 5,
    missingPosition = 'last',
    responseFormat = 'mc',
    distractorCount = 3,
    seriesLength = 5,
  } = settings;

  const n = Math.max(5, Math.min(8, seriesLength));
  const magnitudeLimit = 5000;
  const maxRetries = 120;
  const reasonCounts = new Map();
  const withDiagnostics = options.withDiagnostics === true;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let result;
    try {
      if (model.stepType === 'one') {
        result = buildOneStep(model.step1Rule, model.elementType, seedLimit, boundLimit, n, fixedSeed, fixedIncrement, fixedSecondSeed, secondSeedLimit);
      } else if (model.stepType === 'two') {
        result = buildTwoStep(model.step1Rule, model.step2Rule, seedLimit, boundLimit, n, fixedSeed, fixedIncrement);
      } else {
        if (withDiagnostics) bumpReason(reasonCounts, 'unsupported-model', 'This model configuration is not supported by the generator.');
        continue;
      }
    } catch {
      if (withDiagnostics) bumpReason(reasonCounts, 'build-error', 'The generator could not build a valid candidate from the current settings.');
      continue;
    }

    const { terms } = result;
    if (!terms || terms.length !== n) {
      if (withDiagnostics) bumpReason(reasonCounts, 'invalid-length', 'The generated series did not have the expected number of terms.');
      continue;
    }

    // bounds check
    if (!isBounded(terms, magnitudeLimit)) {
      if (withDiagnostics) bumpReason(reasonCounts, 'magnitude-limit', 'The generated numbers grew too large for the current safety limit.');
      continue;
    }

    // uniqueness check — require at least min(4, n-1) distinct values
    if (!hasEnoughUnique(terms, Math.min(4, n - 1))) {
      if (withDiagnostics) bumpReason(reasonCounts, 'not-enough-variation', 'The generated series did not contain enough distinct values.');
      continue;
    }

    // pick missing index
    let missingIndex;
    if (typeof missingPosition === 'number') {
      missingIndex = Math.max(0, Math.min(n - 1, missingPosition));
    } else {
      missingIndex = missingPosition === 'last' ? n - 1 : randInt(2, n - 1);
    }

    // build stem string
    const stemParts = terms.map((t, i) => i === missingIndex ? '?' : displayTerm(t));
    const stem = stemParts.join(',  ');

    const answer = terms[missingIndex];
    const answerDisplay = displayTerm(answer);
    if (!isConstructValid(model, terms, missingIndex, answer)) {
      if (withDiagnostics) bumpReason(reasonCounts, 'construct-validity', 'The candidate failed the construct-validity checks for this model.');
      continue;
    }

    // build signature for dedup
    const signature = terms.map(displayTerm).join(',');
    const draftItem = {
      modelId: model.id,
      modelName: model.name,
      terms,
      missingIndex,
      answer,
      answerDisplay,
      stem,
      signature,
      tier: model.tier,
      responseFormat,
      ...result,
    };
    const difficulty = computeItemDifficulty(model, draftItem);
    const distractors = responseFormat === 'mc'
      ? buildDistractors(terms, missingIndex, answer, model, distractorCount)
      : [];
    const responseOptions = responseFormat === 'mc'
      ? shuffle([answerDisplay, ...distractors])
      : [];

    const item = {
      ...draftItem,
      difficulty,
      distractors,
      responseOptions,
    };
    return withDiagnostics ? { item, diagnostics: [] } : item;
  }

  if (!withDiagnostics) return null; // failed after max retries

  return {
    item: null,
    diagnostics: Array.from(reasonCounts.values())
      .sort((a, b) => b.count - a.count)
      .map(({ label, count }) => `${label} (${count}/${maxRetries} attempts)`),
  };
}

export function generateSeriesItem(model, settings = {}) {
  return generateSeriesItemInternal(model, settings, { withDiagnostics: false });
}

export function diagnoseSeriesGenerationFailure(model, settings = {}) {
  return generateSeriesItemInternal(model, settings, { withDiagnostics: true });
}

// ---------- batch generation ----------

export function generateBatch(models, settings = {}, count = 1) {
  const items = [];
  const seen = new Set();

  for (const model of models) {
    for (let i = 0; i < count; i++) {
      const item = generateSeriesItem(model, settings);
      if (item && !seen.has(item.signature)) {
        seen.add(item.signature);
        items.push(item);
      }
    }
  }

  return items;
}

function cloneFormulaValue(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function buildNumberSeriesFormula(settings, resolvedItem, meta = {}) {
  return {
    formulaType: 'psychkit.number-series.item-formula',
    version: 1,
    generator: 'number-series',
    settings: cloneFormulaValue(settings),
    resolvedItem: cloneFormulaValue(resolvedItem),
    meta: cloneFormulaValue(meta),
  };
}

export function getNumberSeriesItemFromFormula(formula) {
  return cloneFormulaValue(formula?.resolvedItem) || null;
}

export function getNumberSeriesSettingsFromFormula(formula) {
  return cloneFormulaValue(formula?.settings) || null;
}

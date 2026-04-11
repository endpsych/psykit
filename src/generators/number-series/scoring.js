/* ---------------------------------------------------------------
   scoring.js  --  Difficulty scoring for Number Series models
   Model-level score: integer 1-8
   --------------------------------------------------------------- */

import { termValue } from './terms.js';

// ---------- difficulty breakdown ----------

function clampScore(score) {
  return Math.max(1, Math.min(8, score));
}

export function buildDifficultyBreakdown(model, item = null) {
  const components = [];

  // Base: step type
  if (model.stepType === 'one') {
    components.push({ label: 'One-step base', value: 1 });
  } else if (model.stepType === 'recurrence') {
    components.push({ label: 'Recurrence base', value: 2 });
  } else if (model.stepType === 'two') {
    components.push({ label: 'Two-step base', value: 3 });
  }

  // Rule complexity
  if (model.step1Rule === 'arithmetic') {
    components.push({ label: 'Arithmetic rule', value: 0 });
  } else if (model.step1Rule === 'geometric') {
    components.push({ label: 'Geometric rule', value: 1 });
  } else if (model.step1Rule === 'addition') {
    components.push({ label: 'Fibonacci/addition rule', value: 1 });
  } else if (model.step1Rule === 'multiplication') {
    components.push({ label: 'Multiplication rule', value: 2 });
  }

  // Second step rule (two-step models)
  if (model.stepType === 'two' && model.step2Rule) {
    if (model.step2Rule === 'arithmetic') {
      components.push({ label: 'Derivative: arithmetic', value: 0 });
    } else if (model.step2Rule === 'geometric') {
      components.push({ label: 'Derivative: geometric', value: 1 });
    }
  }

  // Element type complexity
  if (model.elementType === 'fraction') {
    components.push({ label: 'Fraction elements', value: 2 });
  } else if (model.elementType === 'surd') {
    components.push({ label: 'Surd elements', value: 3 });
  } else {
    components.push({ label: 'Integer elements', value: 0 });
  }

  if (item?.terms?.length) {
    if (item.terms.length >= 7) {
      components.push({ label: 'Longer series span', value: 1 });
    }

    if (item.missingIndex === 0) {
      components.push({ label: 'Leading missing term', value: 2 });
    } else if (item.missingIndex > 0 && item.missingIndex < item.terms.length - 1) {
      components.push({ label: 'Internal missing term', value: 1 });
    }

    const numericValues = item.terms.map(termValue).filter((value) => Number.isFinite(value));
    if (numericValues.length) {
      const maxAbs = Math.max(...numericValues.map((value) => Math.abs(value)));
      if (maxAbs >= 25) {
        components.push({ label: 'Larger term magnitude', value: 1 });
      }

      const hasPositive = numericValues.some((value) => value > 0);
      const hasNegative = numericValues.some((value) => value < 0);
      if (hasPositive && hasNegative) {
        components.push({ label: 'Mixed signs', value: 1 });
      }
    }
  }

  return components;
}

export function computeItemDifficulty(model, item = null) {
  const total = buildDifficultyBreakdown(model, item).reduce((sum, component) => sum + component.value, 0);
  return clampScore(total);
}

// ---------- target ranges by preset ----------

export function targetRange(preset) {
  switch (preset) {
    case 'easy':      return [1, 1];
    case 'medium':    return [2, 3];
    case 'hard':      return [4, 5];
    case 'very-hard': return [6, 8];
    case 'custom':    return [1, 8];
    default:          return [1, 8];
  }
}

// ---------- normalize 1-8 to 1-5 for bank export ----------

export function normalizeTo5(score) {
  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 4) return 3;
  if (score <= 6) return 4;
  return 5;
}

// ---------- difficulty label / color for raw 1-8 score ----------

export function difficultyLabel8(score) {
  if (score <= 1) return 'Very Easy';
  if (score <= 2) return 'Easy';
  if (score <= 3) return 'Medium-Easy';
  if (score <= 4) return 'Medium';
  if (score <= 5) return 'Medium-Hard';
  if (score <= 6) return 'Hard';
  if (score <= 7) return 'Very Hard';
  return 'Extreme';
}

export function modelsInRange(models, preset) {
  const [lo, hi] = targetRange(preset);
  return models.filter(m => m.score >= lo && m.score <= hi);
}

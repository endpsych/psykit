/* ---------------------------------------------------------------
   distractors.js  --  Layered distractor generation for Number Series
   --------------------------------------------------------------- */

import {
  addTerms, subtractTerms, multiplyTerms,
  displayTerm, termValue, integer, frac, surd,
} from './terms.js';

// ---------- helpers ----------

function perturbInt(term, delta) {
  if (term.kind === 'fraction' && term.d === 1) {
    return { kind: 'fraction', n: term.n + delta, d: 1 };
  }
  return term;
}

function perturbFraction(term) {
  const results = [];
  if (term.kind === 'fraction') {
    // perturb numerator
    results.push(frac(term.n + 1, term.d));
    results.push(frac(term.n - 1, term.d));
    // perturb denominator
    if (term.d > 1) {
      results.push(frac(term.n, term.d + 1));
      results.push(frac(term.n, term.d - 1 || 1));
    }
  }
  return results;
}

function perturbSurd(term) {
  const results = [];
  if (term.kind === 'surd') {
    results.push(surd(term.coeff + 1, term.rad));
    results.push(surd(term.coeff - 1, term.rad));
    const altRads = [2, 3, 5, 7, 11].filter(r => r !== term.rad);
    if (altRads.length > 0) {
      results.push(surd(term.coeff, altRads[0]));
    }
  }
  return results;
}

function dedupDisplays(arr, excludeDisplay) {
  const seen = new Set();
  if (excludeDisplay) seen.add(excludeDisplay);
  const out = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// ---------- main distractor builder ----------

export function buildDistractors(terms, missingIndex, answer, model, desiredCount = 3) {
  const answerStr = displayTerm(answer);
  const candidates = [];

  // Layer 1: Rule-specific errors
  if (model.step1Rule === 'arithmetic') {
    _arithmeticErrors(terms, missingIndex, answer, candidates);
  }
  if (model.step1Rule === 'geometric') {
    _geometricErrors(terms, missingIndex, answer, candidates);
  }
  if (model.step1Rule === 'addition') {
    _additionErrors(terms, missingIndex, answer, candidates);
  }
  if (model.step1Rule === 'multiplication') {
    _multiplicationErrors(terms, missingIndex, answer, candidates);
  }

  // Layer 2: Two-step derivative errors
  if (model.stepType === 'two') {
    _twoStepErrors(terms, missingIndex, answer, candidates);
  }

  // Layer 3: Arithmetic-vs-geometric confusion
  _confusionErrors(terms, missingIndex, answer, candidates);

  // Layer 4: Term-position confusion (last two visible terms)
  _positionConfusion(terms, missingIndex, candidates);

  // Layer 5: Neighborhood perturbations
  _neighborhoodErrors(answer, candidates);

  // Layer 6: Random fallback
  _randomFallback(answer, candidates, 12);

  // Dedup and filter
  const displays = dedupDisplays(
    candidates.map(c => typeof c === 'string' ? c : displayTerm(c)),
    answerStr,
  );

  return displays.slice(0, desiredCount);
}

// ---------- layer implementations ----------

function _arithmeticErrors(terms, missingIndex, answer, out) {
  // Off-by-one on the common difference
  if (missingIndex > 0) {
    const prev = terms[missingIndex - 1];
    const diff = subtractTerms(answer, prev);
    // answer + diff (double step)
    out.push(addTerms(answer, diff));
    // answer - 1 unit of diff
    out.push(subtractTerms(answer, integer(1)));
    // off-by-one increment
    out.push(addTerms(prev, addTerms(diff, integer(1))));
    out.push(addTerms(prev, subtractTerms(diff, integer(1))));
  }
}

function _geometricErrors(terms, missingIndex, answer, out) {
  // Double-apply ratio
  if (missingIndex > 0) {
    const prev = terms[missingIndex - 1];
    const v1 = termValue(prev);
    const v2 = termValue(answer);
    if (v1 !== 0 && isFinite(v1) && isFinite(v2)) {
      const ratio = v2 / v1;
      // double-apply
      const doubled = Math.round(v2 * ratio);
      if (isFinite(doubled) && Math.abs(doubled) < 5000) {
        out.push(integer(doubled));
      }
      // half-apply
      const half = Math.round(v1 * Math.sqrt(Math.abs(ratio)));
      if (isFinite(half) && Math.abs(half) < 5000) {
        out.push(integer(half));
      }
    }
  }
}

function _additionErrors(terms, missingIndex, answer, out) {
  // Wrong sum: use wrong pair
  if (missingIndex >= 2) {
    // use terms[mi-1] + terms[mi-3] instead of terms[mi-1] + terms[mi-2]
    if (missingIndex >= 3) {
      out.push(addTerms(terms[missingIndex - 1], terms[missingIndex - 3]));
    }
    // just the previous term
    out.push(terms[missingIndex - 1]);
  }
}

function _multiplicationErrors(terms, missingIndex, answer, out) {
  // Wrong product
  if (missingIndex >= 2) {
    // addition instead of multiplication
    out.push(addTerms(terms[missingIndex - 1], terms[missingIndex - 2]));
    if (missingIndex >= 3) {
      out.push(multiplyTerms(terms[missingIndex - 1], terms[missingIndex - 3]));
    }
  }
}

function _twoStepErrors(terms, missingIndex, answer, out) {
  // Compute naive differences and assume wrong next derivative
  if (missingIndex >= 2) {
    const d1 = subtractTerms(terms[missingIndex - 1], terms[missingIndex - 2]);
    // wrong: use same derivative instead of progressed one
    out.push(addTerms(terms[missingIndex - 1], d1));
    // wrong: double derivative
    out.push(addTerms(terms[missingIndex - 1], addTerms(d1, d1)));
  }
}

function _confusionErrors(terms, missingIndex, answer, out) {
  // Try arithmetic where geometric was used and vice versa
  if (missingIndex >= 2) {
    const t1 = terms[missingIndex - 2];
    const t2 = terms[missingIndex - 1];
    const v1 = termValue(t1);
    const v2 = termValue(t2);

    // arithmetic extrapolation: last + diff
    const arithDiff = v2 - v1;
    const arithNext = Math.round(v2 + arithDiff);
    if (isFinite(arithNext) && Math.abs(arithNext) < 5000) {
      out.push(integer(arithNext));
    }

    // geometric extrapolation: last * ratio
    if (v1 !== 0) {
      const geoRatio = v2 / v1;
      const geoNext = Math.round(v2 * geoRatio);
      if (isFinite(geoNext) && Math.abs(geoNext) < 5000) {
        out.push(integer(geoNext));
      }
    }
  }
}

function _positionConfusion(terms, missingIndex, out) {
  // Include last two visible terms as distractors
  const visible = terms.filter((_, i) => i !== missingIndex);
  if (visible.length >= 2) {
    out.push(visible[visible.length - 1]);
    out.push(visible[visible.length - 2]);
  }
}

function _neighborhoodErrors(answer, out) {
  if (answer.kind === 'fraction' && answer.d === 1) {
    // integer neighborhood: +/- 1, 2, 3
    out.push(perturbInt(answer, 1));
    out.push(perturbInt(answer, -1));
    out.push(perturbInt(answer, 2));
    out.push(perturbInt(answer, -2));
    out.push(perturbInt(answer, 3));
  } else if (answer.kind === 'fraction') {
    perturbFraction(answer).forEach(t => out.push(t));
  } else if (answer.kind === 'surd') {
    perturbSurd(answer).forEach(t => out.push(t));
  }
}

function _randomFallback(answer, out, maxAttempts) {
  for (let i = 0; i < maxAttempts; i++) {
    const offset = Math.floor(Math.random() * 11) - 5;
    if (offset === 0) continue;
    if (answer.kind === 'fraction' && answer.d === 1) {
      out.push(integer(answer.n + offset));
    } else if (answer.kind === 'fraction') {
      const flip = Math.random() > 0.5;
      if (flip) out.push(frac(answer.n + offset, answer.d));
      else out.push(frac(answer.n, Math.max(1, answer.d + (offset > 0 ? 1 : -1))));
    } else if (answer.kind === 'surd') {
      out.push(surd(answer.coeff + offset, answer.rad));
    }
  }
}

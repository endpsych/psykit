// Verbal Reasoning — Generative refutation engine
//
// Evaluates distractor claims via truth-table analysis, producing structured
// refutation traces with counterexamples and fallacy classifications.
// Each claim is enumerated from the item's predicate set, evaluated for logical
// validity, and — if invalid — receives a step-by-step proof of invalidity.

import { article } from './engine';

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = p => (p.negated ? '¬' : '') + p.base;
const ptxt = p => p.negated ? `not ${p.base}` : p.base;
const pval = (pred, σ) => pred.negated ? !σ[pred.base] : σ[pred.base];

// ── Truth-table engine ──────────────────────────────────────────────────────

function allAssignments(vars) {
  const n = vars.length;
  const out = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const σ = {};
    vars.forEach((v, i) => { σ[v] = !!(mask & (1 << i)); });
    out.push(σ);
  }
  return out;
}

/** Extract the fact as a predicate assertion, or null for instructional facts. */
function extractFactPred(draft) {
  switch (draft.templateId) {
    case 'hypothetical-syllogism':
    case 'modus-ponens':
      return draft.predicates[0]; // affirms first predicate
    case 'modus-tollens': {
      const c = draft.predicates[1];
      return { base: c.base, negated: !c.negated }; // denies consequent
    }
    default:
      return null; // contraposition, nec-suf: no predicate assertion
  }
}

function premiseHolds(premise, σ) {
  return !(pval(premise.antecedent, σ) && !pval(premise.consequent, σ)); // A→B fails only when A true, B false
}

function premisesHold(premises, factPred, σ) {
  for (const p of premises) {
    if (!premiseHolds(p, σ)) return false;
  }
  if (factPred && !pval(factPred, σ)) return false;
  return true;
}

function buildFilterSteps(draft, factPred, σs) {
  let remaining = σs;
  const steps = [{
    label: 'All possible models',
    remaining: remaining.length,
    eliminated: 0,
  }];

  draft.premises.forEach((premise, index) => {
    const next = remaining.filter(σ => premiseHolds(premise, σ));
    steps.push({
      label: `Premise ${index + 1}`,
      remaining: next.length,
      eliminated: remaining.length - next.length,
    });
    remaining = next;
  });

  if (factPred) {
    const next = remaining.filter(σ => pval(factPred, σ));
    steps.push({
      label: 'Given fact',
      remaining: next.length,
      eliminated: remaining.length - next.length,
    });
    remaining = next;
  }

  return steps;
}

function evalClaim(claim, σ) {
  switch (claim.type) {
    case 'assertion':   return pval(claim, σ);
    case 'conjunction':  return claim.preds.every(p => pval(p, σ));
    case 'conditional':
    case 'sufficiency':  return !pval(claim.from, σ) || pval(claim.to, σ);
    case 'necessity':    return !pval(claim.to, σ) || pval(claim.from, σ); // "A nec B" = B→A
    default: return false;
  }
}

/**
 * Full truth-table evaluation of a claim against the item's premises + fact.
 * Returns validity verdict, model counts, and the first counterexample found.
 */
function evaluate(draft, claim) {
  const varSet = new Set();
  draft.predicates.forEach(p => varSet.add(p.base));
  if (claim.type === 'assertion') varSet.add(claim.base);
  else if (claim.type === 'conjunction') claim.preds.forEach(p => varSet.add(p.base));
  if (claim.from) { varSet.add(claim.from.base); varSet.add(claim.to.base); }

  const vars = [...varSet];
  const σs = allAssignments(vars);
  const factPred = extractFactPred(draft);

  let premModels = 0, holds = 0, cx = null;
  const compatibleModels = [];
  const allModels = [];
  for (const σ of σs) {
    const premiseCompatible = premisesHold(draft.premises, factPred, σ);
    const claimHolds = evalClaim(claim, σ);
    allModels.push({ assignment: { ...σ }, premiseCompatible, claimHolds });
    if (premiseCompatible) {
      premModels++;
      compatibleModels.push({ assignment: { ...σ }, claimHolds });
      if (claimHolds) holds++;
      else if (!cx) cx = { ...σ };
    }
  }

  return {
    validity: holds === premModels ? 'valid' : holds === 0 ? 'contradicted' : 'contingent',
    total: σs.length,
    premModels,
    holds,
    fails: premModels - holds,
    cx,
    models: compatibleModels,
    allModels,
    filterSteps: buildFilterSteps(draft, factPred, σs),
  };
}

// ── Claim rendering ─────────────────────────────────────────────────────────

export function renderForm(claim) {
  switch (claim.type) {
    case 'assertion':    return fmt(claim);
    case 'conjunction':  return claim.preds.map(fmt).join(' ∧ ');
    case 'conditional':
    case 'sufficiency':  return `${fmt(claim.from)} → ${fmt(claim.to)}`;
    case 'necessity':    return `${fmt(claim.to)} → ${fmt(claim.from)}`;
    default: return '';
  }
}

function renderText(claim, draft) {
  const s = draft.subject;
  switch (claim.type) {
    case 'assertion':   return `The ${s} is ${ptxt(claim)}.`;
    case 'conjunction':  return `The ${s} is ${claim.preds.map(ptxt).join(' and ')}.`;
    case 'conditional':  return `If ${article(s)} ${s} is ${ptxt(claim.from)}, then it is ${ptxt(claim.to)}.`;
    case 'sufficiency':  return `Being ${ptxt(claim.from)} is sufficient for being ${ptxt(claim.to)}.`;
    case 'necessity':    return `Being ${ptxt(claim.from)} is necessary for being ${ptxt(claim.to)}.`;
    default: return '';
  }
}

// ── Valid claim ─────────────────────────────────────────────────────────────

export function buildValidClaim(draft) {
  const p = draft.predicates;
  switch (draft.templateId) {
    case 'hypothetical-syllogism': {
      const last = p[p.length - 1];
      return { type: 'assertion', base: last.base, negated: last.negated };
    }
    case 'modus-ponens':
      return { type: 'assertion', base: p[1].base, negated: p[1].negated };
    case 'modus-tollens':
      return { type: 'assertion', base: p[0].base, negated: !p[0].negated };
    case 'contraposition':
      return { type: 'conditional', from: { base: p[1].base, negated: !p[1].negated }, to: { base: p[0].base, negated: !p[0].negated } };
    case 'necessary-sufficient':
      return { type: 'sufficiency', from: { base: p[0].base, negated: p[0].negated }, to: { base: p[1].base, negated: p[1].negated } };
    default: return null;
  }
}

export function buildPresentedClaim(draft) {
  if (draft.isMCFormat || !draft.conclusion) return null;
  if (draft.conclusionIsValid) return buildValidClaim(draft);

  const p = draft.predicates;
  switch (draft.templateId) {
    case 'hypothetical-syllogism': {
      const last = p[p.length - 1];
      return { type: 'assertion', base: last.base, negated: !last.negated };
    }
    case 'modus-ponens':
      return { type: 'assertion', base: p[1].base, negated: !p[1].negated };
    case 'modus-tollens':
      return { type: 'assertion', base: p[0].base, negated: p[0].negated };
    default:
      return buildValidClaim(draft);
  }
}

export function evaluateClaimAgainstDraft(draft, claim) {
  if (!claim) return null;
  return evaluate(draft, claim);
}

// ── Fallacy classification ──────────────────────────────────────────────────

function classify(draft, claim, ev) {
  const vc = buildValidClaim(draft);
  if (ev.validity === 'valid') return classifyScope(draft, claim);
  return classifyLogical(draft, claim, vc);
}

function classifyScope(draft, claim) {
  const fp = extractFactPred(draft);

  // Restates the given fact
  if (fp && claim.type === 'assertion' && claim.base === fp.base && claim.negated === fp.negated)
    return { name: 'Restated Given', desc: 'Restates the given fact rather than deriving a new conclusion.' };

  // Intermediate step in a chain (HS only)
  if (draft.templateId === 'hypothetical-syllogism' && claim.type === 'assertion') {
    const mid = draft.predicates.slice(1, -1);
    if (mid.some(p => p.base === claim.base && p.negated === claim.negated))
      return { name: 'Incomplete Chain', desc: 'Stops at an intermediate link instead of following the chain to the final conclusion.' };
  }

  // Conjunction: includes the valid answer plus extras
  if (claim.type === 'conjunction')
    return { name: 'Over-Specification', desc: 'Includes the correct conclusion but adds unsupported extra claims.' };

  return { name: 'Scope Mismatch', desc: 'Logically true in this scenario but does not answer the specific question.' };
}

function classifyLogical(draft, claim, vc) {
  // Compare conditional-family claims (conditional / sufficiency / necessity)
  if (claim.from && vc && vc.from) {
    // Normalize both to "X → Y" direction
    const cf = claim.type === 'necessity' ? claim.to : claim.from;
    const ct = claim.type === 'necessity' ? claim.from : claim.to;
    const vf = vc.type === 'necessity' ? vc.to : vc.from;
    const vt = vc.type === 'necessity' ? vc.from : vc.to;

    const same = cf.base === vf.base && ct.base === vt.base;
    const swap = cf.base === vt.base && ct.base === vf.base;

    if (same) {
      const fn = cf.negated !== vf.negated, tn = ct.negated !== vt.negated;
      if (fn && tn) return { name: 'Inverse Error', desc: 'Negates both terms without reversing direction — the inverse fallacy (¬A→¬B from A→B).' };
      if (fn && !tn) return { name: 'Antecedent Negation', desc: 'Negates only the antecedent while keeping the consequent unchanged.' };
      if (!fn && tn) return { name: 'Consequent Negation', desc: 'Negates only the consequent — directly contradicts the licensed conclusion.' };
    }
    if (swap) {
      const fn = cf.negated !== vt.negated, tn = ct.negated !== vf.negated;
      if (!fn && !tn) return { name: 'Converse Error', desc: 'Reverses the direction of the conditional — asserts B→A from A→B.' };
      if (fn && tn) return { name: 'Contrapositive', desc: 'Actually the valid contrapositive — should not be a distractor.' };
      return { name: 'Partial Contraposition', desc: 'Swaps direction and negates one term but not the other — an incomplete, incorrect contrapositive.' };
    }
  }

  // Compare assertion claims
  if (claim.type === 'assertion' && vc) {
    if (vc.type === 'assertion' && claim.base === vc.base && claim.negated !== vc.negated)
      return { name: 'Polarity Reversal', desc: 'Asserts the opposite of the valid conclusion.' };
    if (!draft.predicates.some(p => p.base === claim.base))
      return { name: 'Unrelated Predicate', desc: 'Introduces a property not constrained by any premise.' };
    return { name: 'Wrong Predicate', desc: 'Concludes about a predicate other than the one the chain derives.' };
  }

  return { name: 'Structural Error', desc: 'Structurally different from the valid conclusion.' };
}

// ── Counterexample rendering ────────────────────────────────────────────────

function renderCx(σ, draft) {
  const bases = new Set();
  draft.predicates.forEach(p => bases.add(p.base));
  const parts = [...bases].filter(b => σ[b] !== undefined).map(b => σ[b] ? b : `not ${b}`);
  return `${article(draft.subject)} ${draft.subject} that is ${parts.join(' and ')}`;
}

function renderCxFormal(σ, draft) {
  const bases = new Set();
  draft.predicates.forEach(p => bases.add(p.base));
  return [...bases].filter(b => σ[b] !== undefined).map(b => `${b}=${σ[b] ? 'T' : 'F'}`).join(', ');
}

// ── Refutation trace builder ────────────────────────────────────────────────

function buildTrace(draft, claim, ev, fallacy) {
  const steps = [];
  let n = 1;

  // 1. Premises
  draft.premises.forEach((p, i) => {
    steps.push({ line: n++, statement: `${fmt(p.antecedent)} → ${fmt(p.consequent)}`, rule: `Premise ${i + 1}`, cites: [], type: 'premise' });
  });

  // 2. Given fact (if any)
  const factPred = extractFactPred(draft);
  const factLine = factPred ? n : null;
  if (factPred) {
    steps.push({ line: n++, statement: fmt(factPred), rule: 'Given fact', cites: [], type: 'given' });
  }

  // 3. The claim under examination
  const claimLine = n;
  steps.push({ line: n++, statement: renderForm(claim), rule: 'Claim (to refute)', cites: [], type: 'claim' });

  // === Branch by verdict ===

  if (ev.validity === 'valid') {
    // ── Scope refutation ──────────────────────────────────────────────────
    steps.push({
      line: n++, statement: `${renderForm(claim)} holds in all ${ev.premModels} model(s)`,
      rule: 'Truth-table: valid', cites: [claimLine], type: 'verified',
    });
    const vc = buildValidClaim(draft);
    steps.push({
      line: n++, statement: `Expected answer: ${renderForm(vc)}`,
      rule: 'Question scope', cites: [], type: 'scope',
    });
    steps.push({
      line: n++, statement: `∴ ${renderForm(claim)} ≠ expected answer ✗`,
      rule: fallacy.name, cites: [claimLine, n - 2], type: 'refuted',
    });

  } else if (ev.cx) {
    // ── Counterexample refutation (contingent) ────────────────────────────
    const cxStr = renderCxFormal(ev.cx, draft);
    const premCites = draft.premises.map((_, i) => i + 1);
    if (factLine) premCites.push(factLine);
    steps.push({
      line: n++, statement: `⟨${cxStr}⟩ ⊨ Premises`,
      rule: 'Counterexample: premises hold', cites: premCites, type: 'counterexample',
    });
    steps.push({
      line: n++, statement: `⟨${cxStr}⟩ ⊭ ${renderForm(claim)}`,
      rule: 'Counterexample: claim fails', cites: [claimLine], type: 'counterexample',
    });
    steps.push({
      line: n++, statement: `∴ ${renderForm(claim)} not derivable ✗`,
      rule: fallacy.name, cites: [n - 2, n - 1], type: 'refuted',
    });

  } else {
    // ── Derivation-contradiction refutation (contradicted, single-model) ──
    // Derive the valid conclusion, then show it contradicts the claim.
    if (factPred) {
      let prevLine = factLine;
      switch (draft.templateId) {
        case 'hypothetical-syllogism':
        case 'modus-ponens':
          for (let i = 0; i < draft.premises.length; i++) {
            steps.push({
              line: n++, statement: fmt(draft.premises[i].consequent),
              rule: '→-Elim', cites: [i + 1, prevLine], type: 'derived',
            });
            prevLine = n - 1;
          }
          break;
        case 'modus-tollens': {
          const ante = draft.predicates[0];
          steps.push({
            line: n++, statement: fmt({ base: ante.base, negated: !ante.negated }),
            rule: 'Modus Tollens', cites: [1, factLine], type: 'derived',
          });
          break;
        }
      }
    }
    const derivedLine = n - 1;
    const vc = buildValidClaim(draft);
    steps.push({
      line: n++, statement: `${renderForm(vc)} contradicts ${renderForm(claim)}`,
      rule: 'Contradiction', cites: [derivedLine, claimLine], type: 'contradiction',
    });
    steps.push({
      line: n++, statement: `∴ ${renderForm(claim)} refuted ✗`,
      rule: fallacy.name, cites: [n - 2], type: 'refuted',
    });
  }

  return steps;
}

export function buildClaimRefutation(draft, claim) {
  if (!claim) return null;

  const evaluation = evaluate(draft, claim);
  const fallacy = classify(draft, claim, evaluation);
  const trace = buildTrace(draft, claim, evaluation, fallacy);
  const counterexample = evaluation.cx
    ? { assignment: evaluation.cx, english: renderCx(evaluation.cx, draft) }
    : null;

  return {
    claim,
    claim_form: renderForm(claim),
    text: renderText(claim, draft),
    evaluation,
    counterexample,
    fallacy,
    trace,
  };
}

function buildBinaryResponseTrace(draft, claim, analysis, wrongResponse, correctResponse) {
  const steps = [];
  let n = 1;

  draft.premises.forEach((p, i) => {
    steps.push({ line: n++, statement: `${fmt(p.antecedent)} → ${fmt(p.consequent)}`, rule: `Premise ${i + 1}`, cites: [], type: 'premise' });
  });

  const factPred = extractFactPred(draft);
  const factLine = factPred ? n : null;
  if (factPred) {
    steps.push({ line: n++, statement: fmt(factPred), rule: 'Given fact', cites: [], type: 'given' });
  }

  const claimLine = n;
  steps.push({ line: n++, statement: renderForm(claim), rule: 'Presented conclusion', cites: [], type: 'claim' });

  const ev = analysis.evaluation;
  if (ev.premModels === 0) {
    steps.push({
      line: n++,
      statement: 'No premise-compatible model was found',
      rule: 'Logical validity check',
      cites: [],
      type: 'refuted',
    });
    steps.push({
      line: n++,
      statement: `∴ Response "${wrongResponse}" requires review`,
      rule: 'Generation guardrail',
      cites: [n - 1],
      type: 'refuted',
    });
    return steps;
  }

  if (draft.conclusionIsValid) {
    const validLine = n;
    steps.push({
      line: n++,
      statement: `${renderForm(claim)} holds in all ${ev.premModels} premise-compatible model(s)`,
      rule: 'Truth-table: valid',
      cites: [claimLine],
      type: 'verified',
    });
    steps.push({
      line: n++,
      statement: `∴ Response "${wrongResponse}" is wrong; correct response is "${correctResponse}"`,
      rule: 'Response refuted',
      cites: [claimLine, validLine],
      type: 'refuted',
    });
    return steps;
  }

  const premCites = draft.premises.map((_, i) => i + 1);
  if (factLine) premCites.push(factLine);

  if (ev.cx) {
    const cxStr = renderCxFormal(ev.cx, draft);
    const premisesHoldLine = n;
    steps.push({
      line: n++,
      statement: `⟨${cxStr}⟩ ⊨ Premises`,
      rule: 'Counterexample: premises hold',
      cites: premCites,
      type: 'counterexample',
    });
    steps.push({
      line: n++,
      statement: `⟨${cxStr}⟩ ⊭ ${renderForm(claim)}`,
      rule: 'Counterexample: claim fails',
      cites: [claimLine],
      type: 'counterexample',
    });
    steps.push({
      line: n++,
      statement: `∴ Response "${wrongResponse}" is wrong; correct response is "${correctResponse}"`,
      rule: 'Response refuted',
      cites: [premisesHoldLine, n - 1],
      type: 'refuted',
    });
    return steps;
  }

  steps.push({
    line: n++,
    statement: `${renderForm(claim)} fails in all ${ev.premModels} premise-compatible model(s)`,
    rule: 'Truth-table: contradicted',
    cites: [claimLine],
    type: 'contradiction',
  });
  steps.push({
    line: n++,
    statement: `∴ Response "${wrongResponse}" is wrong; correct response is "${correctResponse}"`,
    rule: 'Response refuted',
    cites: [n - 1],
    type: 'refuted',
  });
  return steps;
}

export function buildBinaryResponseDistractor(draft) {
  if (!draft || draft.isMCFormat) return null;

  const presentedClaim = buildPresentedClaim(draft);
  const analysis = buildClaimRefutation(draft, presentedClaim);
  if (!presentedClaim || !analysis) return null;

  const wrongResponse = draft.correctAnswer === 'Must follow' ? 'Cannot follow' : 'Must follow';
  const correctResponse = draft.correctAnswer || (draft.conclusionIsValid ? 'Must follow' : 'Cannot follow');
  const ev = analysis.evaluation;
  const pattern = draft.conclusionIsValid ? 'validity-denial' : 'invalidity-acceptance';
  const rationale = draft.conclusionIsValid
    ? `The presented conclusion follows: it holds in all ${ev.premModels} premise-compatible model(s).`
    : ev.cx
      ? 'The presented conclusion does not follow: a counterexample satisfies all premises while falsifying the conclusion.'
      : `The presented conclusion does not follow: it holds in ${ev.holds} of ${ev.premModels} premise-compatible model(s).`;
  const fallacy = draft.conclusionIsValid
    ? { name: 'Validity Denial', desc: 'Treats a conclusion that follows from the premises as if it did not follow.' }
    : { name: 'Invalidity Acceptance', desc: 'Treats a conclusion that is not entailed by the premises as if it must follow.' };

  return {
    responseOption: wrongResponse,
    correctResponse,
    claim: presentedClaim,
    claim_form: renderForm(presentedClaim),
    text: wrongResponse,
    presentedConclusion: draft.conclusion,
    pattern,
    rationale,
    refutation: {
      validity: ev.validity,
      evaluation: {
        models_checked: ev.total,
        premise_models: ev.premModels,
        claim_holds_in: ev.holds,
        claim_fails_in: ev.fails,
      },
      counterexample: analysis.counterexample,
      fallacy,
      trace: buildBinaryResponseTrace(draft, presentedClaim, analysis, wrongResponse, correctResponse),
    },
  };
}

// ── Candidate enumeration ───────────────────────────────────────────────────

function enumerateCandidates(draft) {
  const out = [];

  // Unique predicate base names + both polarities
  const baseSet = new Set();
  draft.predicates.forEach(p => baseSet.add(p.base));
  const variants = [];
  for (const b of baseSet) {
    variants.push({ base: b, negated: false });
    variants.push({ base: b, negated: true });
  }

  const spare = (draft.spareProperties || [])[0];

  switch (draft.templateId) {
    case 'hypothetical-syllogism':
    case 'modus-ponens':
    case 'modus-tollens': {
      // Single-predicate assertions (both polarities for each base)
      for (const v of variants) out.push({ type: 'assertion', base: v.base, negated: v.negated });

      // Spare property assertions
      if (spare) {
        out.push({ type: 'assertion', base: spare, negated: false });
        out.push({ type: 'assertion', base: spare, negated: true });
      }

      // Conjunction: given fact + valid conclusion
      const fp = extractFactPred(draft);
      const vc = buildValidClaim(draft);
      if (fp && vc && vc.type === 'assertion' && fp.base !== vc.base) {
        out.push({ type: 'conjunction', preds: [
          { base: fp.base, negated: fp.negated },
          { base: vc.base, negated: vc.negated },
        ]});
      }

      // Conjunction: valid conclusion + spare
      if (spare && vc && vc.type === 'assertion') {
        out.push({ type: 'conjunction', preds: [
          { base: vc.base, negated: vc.negated },
          { base: spare, negated: false },
        ]});
      }

      // Reverse conditional (last→first)
      const preds = draft.predicates;
      if (preds.length >= 2) {
        const first = preds[0], last = preds[preds.length - 1];
        out.push({ type: 'conditional',
          from: { base: last.base, negated: last.negated },
          to:   { base: first.base, negated: first.negated },
        });
      }
      break;
    }

    case 'contraposition': {
      // All conditional claims between predicate variants
      for (const from of variants) {
        for (const to of variants) {
          if (from.base === to.base && from.negated === to.negated) continue;
          out.push({ type: 'conditional', from, to });
        }
      }
      break;
    }

    case 'necessary-sufficient': {
      // All sufficiency and necessity claims between predicate variants
      for (const from of variants) {
        for (const to of variants) {
          if (from.base === to.base && from.negated === to.negated) continue;
          out.push({ type: 'sufficiency', from, to });
          out.push({ type: 'necessity', from, to });
        }
      }
      break;
    }
  }

  return out;
}

// ── Priority ordering ───────────────────────────────────────────────────────

const PRIORITY = {
  'classic-fallacies': [
    'converse-error', 'inverse-error', 'partial-contraposition',
    'polarity-reversal', 'wrong-predicate',
    'antecedent-negation', 'consequent-negation',
    'incomplete-chain', 'restated-given', 'over-specification',
    'unrelated-predicate', 'structural-error',
  ],
  'near-miss': [
    'partial-contraposition', 'consequent-negation', 'antecedent-negation',
    'inverse-error', 'over-specification',
    'converse-error', 'polarity-reversal',
    'incomplete-chain', 'restated-given',
    'wrong-predicate', 'unrelated-predicate', 'structural-error',
  ],
  mixed: [
    'polarity-reversal', 'converse-error', 'inverse-error',
    'partial-contraposition', 'wrong-predicate',
    'incomplete-chain', 'restated-given', 'over-specification',
    'antecedent-negation', 'consequent-negation',
    'unrelated-predicate', 'structural-error',
  ],
};

function orderByStyle(distractors, settings) {
  const prio = PRIORITY[settings.distractorStyle] || PRIORITY.mixed;
  const ordered = [];
  for (const p of prio) {
    const m = distractors.find(d => d.pattern === p && !ordered.includes(d));
    if (m) ordered.push(m);
  }
  for (const d of distractors) {
    if (!ordered.includes(d)) ordered.push(d);
  }
  return ordered.slice(0, 3);
}

// ── Main API ────────────────────────────────────────────────────────────────

/**
 * Generative distractor builder with full refutation traces.
 *
 * 1. Enumerates all plausible claims from the item's predicate set
 * 2. Evaluates each via truth-table against the premises
 * 3. Classifies the fallacy or scope error
 * 4. Builds a step-by-step refutation trace
 * 5. Enforces orthogonality (no two distractors share the same logical form)
 * 6. Returns the top 3, ordered by distractor style preference
 */
export function buildRefutedDistractors(draft, settings) {
  const candidates = enumerateCandidates(draft);
  const vc = buildValidClaim(draft);
  const vcForm = vc ? renderForm(vc) : '';

  const evaluated = [];

  for (const claim of candidates) {
    const form = renderForm(claim);

    // Skip the correct answer
    if (form === vcForm) continue;

    const analysis = buildClaimRefutation(draft, claim);
    const ev = analysis.evaluation;
    const fallacy = analysis.fallacy;

    // Skip valid contrapositives (they're correct, not distractors)
    if (fallacy.name === 'Contrapositive') continue;
    // Skip generic scope mismatches (not pedagogically useful)
    if (fallacy.name === 'Scope Mismatch') continue;

    evaluated.push({
      claim,
      claim_form: form,
      text: analysis.text,
      pattern: fallacy.name.toLowerCase().replace(/\s+/g, '-'),
      rationale: fallacy.desc,
      refutation: {
        validity: ev.validity,
        evaluation: {
          models_checked: ev.total,
          premise_models: ev.premModels,
          claim_holds_in: ev.holds,
          claim_fails_in: ev.fails,
        },
        counterexample: analysis.counterexample,
        fallacy,
        trace: analysis.trace,
      },
    });
  }

  // Deduplicate by text (surface form)
  const textSeen = new Set();
  let unique = evaluated.filter(d => {
    if (textSeen.has(d.text)) return false;
    textSeen.add(d.text);
    return true;
  });

  // Orthogonality enforcement: no two distractors with the same logical form
  const formSeen = new Set();
  unique = unique.filter(d => {
    if (formSeen.has(d.claim_form)) return false;
    formSeen.add(d.claim_form);
    return true;
  });

  return orderByStyle(unique, settings);
}

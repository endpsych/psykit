// Verbal Reasoning — Conditional reasoning item builder

const SAFE_SUBJECT_POOL = [
  'item', 'card', 'box', 'token', 'object', 'shape', 'tile', 'block',
  'cube', 'panel', 'button', 'switch', 'lever', 'dial', 'marker', 'tag',
  'label', 'folder', 'file', 'packet', 'parcel', 'container', 'vessel',
  'module', 'device', 'unit', 'gadget', 'widget', 'tool', 'instrument',
  'sample', 'specimen', 'element', 'figure', 'symbol', 'signal', 'node',
  'cell', 'frame', 'plate', 'disk', 'ring', 'chip', 'part', 'piece',
  'component', 'segment', 'strip', 'bar', 'rod', 'peg', 'pin', 'slot',
  'tab', 'seal', 'stamp', 'ticket', 'badge', 'cardlet', 'capsule',
  'bead', 'gem', 'stone', 'sphere', 'cone', 'cylinder', 'prism',
];

const SAFE_QUALIFIER_POOL = [
  'blue', 'red', 'green', 'yellow', 'orange', 'purple', 'black', 'white',
  'gray', 'silver', 'gold', 'brown', 'pink', 'cyan', 'teal', 'amber',
  'violet', 'indigo', 'striped', 'spotted', 'dotted', 'speckled',
  'shaded', 'colored', 'tinted', 'pale', 'dark', 'bright', 'dull',
  'light', 'clear', 'opaque', 'transparent', 'glossy', 'matte', 'smooth',
  'rough', 'flat', 'curved', 'round', 'square', 'angular', 'straight',
  'bent', 'hollow', 'solid', 'open', 'closed', 'sealed', 'unsealed',
  'locked', 'unlocked', 'marked', 'unmarked', 'labeled', 'unlabeled',
  'tagged', 'untagged', 'checked', 'unchecked', 'sorted', 'unsorted',
  'stacked', 'aligned', 'misaligned', 'centered', 'offset', 'rotated',
  'tilted', 'raised', 'lowered', 'inverted', 'upright', 'ready',
  'active', 'inactive', 'enabled', 'disabled', 'selected', 'unselected',
  'valid', 'invalid', 'visible', 'hidden', 'present', 'absent', 'full',
  'empty', 'complete', 'incomplete', 'stable', 'unstable', 'balanced',
  'unbalanced', 'matched', 'unmatched', 'paired', 'unpaired', 'linked',
  'unlinked', 'connected', 'disconnected', 'attached', 'detached',
  'fixed', 'loose', 'movable', 'static', 'fresh', 'stale', 'clean',
  'dirty', 'dry', 'wet', 'warm', 'cool', 'quiet', 'loud', 'heavy',
  'lightweight', 'large', 'small', 'wide', 'narrow', 'thick', 'thin',
  'short', 'long', 'early', 'late', 'fast', 'slow', 'new', 'old',
  'modern', 'plain', 'ornate', 'simple', 'complex', 'regular',
  'irregular', 'standard', 'special', 'primary', 'secondary',
];

const LEXICALLY_NEGATIVE_QUALIFIERS = new Set([
  'unsealed', 'unlocked', 'unmarked', 'unlabeled', 'untagged', 'unchecked',
  'unsorted', 'misaligned', 'inactive', 'disabled', 'unselected', 'hidden',
  'absent', 'empty', 'incomplete', 'unstable', 'unbalanced', 'unmatched',
  'unpaired', 'unlinked', 'disconnected', 'detached', 'invalid',
]);

function uniqueSafeTerms(pool, validator) {
  const seen = new Set();
  return pool.filter(term => {
    if (!validator(term) || seen.has(term)) return false;
    seen.add(term);
    return true;
  });
}

// Grammar guardrails: generated nouns must fit "a/an/the <noun> ... it",
// and qualifiers must fit "is <qualifier>", "not <qualifier>", and "being <qualifier>".
function isSafeSubject(term) {
  return /^[a-z][a-z-]*$/.test(term) && !term.endsWith('s');
}

function isSafeQualifier(term) {
  return /^[a-z][a-z-]*$/.test(term)
    && !term.startsWith('not-')
    && term !== 'not'
    && !LEXICALLY_NEGATIVE_QUALIFIERS.has(term);
}

export const CONDITIONAL_SUBJECTS = uniqueSafeTerms(SAFE_SUBJECT_POOL, isSafeSubject);

export const CONDITIONAL_PROPERTY_POOL = uniqueSafeTerms(SAFE_QUALIFIER_POOL, isSafeQualifier);

export const CONDITIONAL_TEMPLATES = [
  {
    id: 'hypothetical-syllogism',
    name: 'Hypothetical Syllogism',
    fixedPremiseCount: null,
    chainLengthRange: [2, 4],
    description: 'Chain of if-then premises: affirm start to derive end',
  },
  {
    id: 'modus-ponens',
    name: 'Modus Ponens',
    fixedPremiseCount: 1,
    chainLengthRange: null,
    description: 'Single conditional: affirm antecedent to affirm consequent',
  },
  {
    id: 'modus-tollens',
    name: 'Modus Tollens',
    fixedPremiseCount: 1,
    chainLengthRange: null,
    description: 'Single conditional: deny consequent to deny antecedent',
  },
  {
    id: 'contraposition',
    name: 'Contraposition',
    fixedPremiseCount: 1,
    chainLengthRange: null,
    description: 'Judge whether the negated-swapped conditional is valid',
  },
  {
    id: 'necessary-sufficient',
    name: 'Necessary vs. Sufficient',
    fixedPremiseCount: 1,
    chainLengthRange: null,
    description: 'Translate if-then into necessity/sufficiency language',
  },
];

export const DEFAULT_CONDITIONAL_SETTINGS = {
  templateId: 'hypothetical-syllogism',
  chainLength: 2,
  includeNegation: false,
  conclusionValidity: 'valid',
  invalidPattern: 'polarity-reversal',
  responseMode: 'must-follow',
  distractorStyle: 'mixed',
};

function cloneConditionalValue(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

// --- Helpers ---

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns "an" if word starts with a vowel sound, otherwise "a".
export function article(word) {
  const normalized = String(word || '').trim().toLowerCase();
  if (/^(honest|honor|hour|heir)/.test(normalized)) return 'an';
  if (/^(uni([^n]|$)|use|user|usual|utility|euro|one\b)/.test(normalized)) return 'a';
  return /^[aeiou]/i.test(normalized) ? 'an' : 'a';
}

function drawUnique(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function makePredicate(base, negated) {
  return {
    base,
    negated: !!negated,
    text: negated ? `not ${base}` : base,
    symbol: negated ? `~${base}` : base,
  };
}

const PHRASING_VARIANTS = [
  (subj, ante, cons) => `If ${article(subj)} ${subj} is ${ante}, then it is ${cons}.`,
  (subj, ante, cons) => `Any ${subj} that is ${ante} is also ${cons}.`,
  (subj, ante, cons) => `Whenever ${article(subj)} ${subj} is ${ante}, it is ${cons}.`,
];

function buildPremiseSentence(subject, antecedent, consequent) {
  const variant = pick(PHRASING_VARIANTS);
  return variant(subject, antecedent.text, consequent.text);
}

function getTemplate(templateId) {
  return CONDITIONAL_TEMPLATES.find(t => t.id === templateId);
}

function resolveChainLength(template, settings) {
  if (template.fixedPremiseCount != null) return template.fixedPremiseCount;
  return Math.max(2, Math.min(4, settings.chainLength || 2));
}

// --- Template draft builders ---

function buildHypotheticalSyllogism(subject, props, settings) {
  const chainLen = Math.max(2, Math.min(4, settings.chainLength || 2));
  const neededProps = chainLen + 1;
  const predicates = props.slice(0, neededProps).map((p, i) => {
    const neg = settings.includeNegation && i > 0 && i < neededProps - 1 && Math.random() < 0.3;
    return makePredicate(p, neg);
  });

  const premises = [];
  for (let i = 0; i < chainLen; i++) {
    premises.push({
      text: buildPremiseSentence(subject, predicates[i], predicates[i + 1]),
      antecedent: predicates[i],
      consequent: predicates[i + 1],
    });
  }

  const fact = `The ${subject} is ${predicates[0].text}.`;
  const validConclusion = `The ${subject} is ${predicates[predicates.length - 1].text}.`;
  const invalidConclusion = `The ${subject} is not ${predicates[predicates.length - 1].text}.`;

  const abstractForm = predicates.slice(0, -1).map((p, i) =>
    `${p.symbol} -> ${predicates[i + 1].symbol}`
  ).join(', ') + ` ; ${predicates[0].symbol} => ${predicates[predicates.length - 1].symbol}`;

  return {
    templateId: 'hypothetical-syllogism',
    subject,
    predicates,
    premises,
    fact,
    validConclusion,
    invalidConclusion,
    abstractForm,
    chainLength: chainLen,
    inferenceSummary: `From chained conditionals and affirming ${predicates[0].symbol}, derive ${predicates[predicates.length - 1].symbol}.`,
  };
}

function buildModusPonens(subject, props, settings) {
  const neg = settings.includeNegation;
  const ante = makePredicate(props[0], false);
  const cons = makePredicate(props[1], neg && Math.random() < 0.5);

  const premise = {
    text: buildPremiseSentence(subject, ante, cons),
    antecedent: ante,
    consequent: cons,
  };

  const fact = `The ${subject} is ${ante.text}.`;
  const validConclusion = `The ${subject} is ${cons.text}.`;
  const invalidConclusion = `The ${subject} is ${cons.negated ? cons.base : 'not ' + cons.base}.`;

  return {
    templateId: 'modus-ponens',
    subject,
    predicates: [ante, cons],
    premises: [premise],
    fact,
    validConclusion,
    invalidConclusion,
    abstractForm: `${ante.symbol} -> ${cons.symbol} ; ${ante.symbol} => ${cons.symbol}`,
    chainLength: 1,
    inferenceSummary: `Affirm antecedent ${ante.symbol}, therefore ${cons.symbol}.`,
  };
}

function buildModusTollens(subject, props, settings) {
  const neg = settings.includeNegation;
  const ante = makePredicate(props[0], false);
  const cons = makePredicate(props[1], neg && Math.random() < 0.5);

  const premise = {
    text: buildPremiseSentence(subject, ante, cons),
    antecedent: ante,
    consequent: cons,
  };

  const denyText = cons.negated ? cons.base : `not ${cons.base}`;
  const fact = `The ${subject} is ${denyText}.`;
  const denyAnte = ante.negated ? ante.base : `not ${ante.base}`;
  const validConclusion = `The ${subject} is ${denyAnte}.`;
  const invalidConclusion = `The ${subject} is ${ante.text}.`;

  return {
    templateId: 'modus-tollens',
    subject,
    predicates: [ante, cons],
    premises: [premise],
    fact,
    validConclusion,
    invalidConclusion,
    abstractForm: `${ante.symbol} -> ${cons.symbol} ; ~${cons.symbol} => ~${ante.symbol}`,
    chainLength: 1,
    inferenceSummary: `Deny consequent ${cons.symbol}, therefore deny antecedent ${ante.symbol}.`,
  };
}

function buildContraposition(subject, props, settings) {
  const neg = settings.includeNegation;
  const ante = makePredicate(props[0], false);
  const cons = makePredicate(props[1], neg && Math.random() < 0.5);

  const premise = {
    text: buildPremiseSentence(subject, ante, cons),
    antecedent: ante,
    consequent: cons,
  };

  const negCons = makePredicate(cons.base, !cons.negated);
  const negAnte = makePredicate(ante.base, !ante.negated);

  const fact = `Consider the contrapositive form of the rule above.`;
  const validConclusion = `If ${article(subject)} ${subject} is ${negCons.text}, then it is ${negAnte.text}.`;
  const invalidConclusion = `If ${article(subject)} ${subject} is ${cons.text}, then it is ${ante.text}.`;

  return {
    templateId: 'contraposition',
    subject,
    predicates: [ante, cons, negCons, negAnte],
    premises: [premise],
    fact,
    validConclusion,
    invalidConclusion,
    abstractForm: `${ante.symbol} -> ${cons.symbol} <=> ~${cons.symbol} -> ~${ante.symbol}`,
    chainLength: 1,
    inferenceSummary: `Contrapositive: if ~${cons.symbol} then ~${ante.symbol}.`,
  };
}

function buildNecessarySufficient(subject, props, settings) {
  const neg = settings.includeNegation;
  const ante = makePredicate(props[0], false);
  const cons = makePredicate(props[1], neg && Math.random() < 0.5);

  const premise = {
    text: buildPremiseSentence(subject, ante, cons),
    antecedent: ante,
    consequent: cons,
  };

  const fact = `Interpret the rule in terms of necessity and sufficiency.`;
  const validConclusion = `Being ${ante.text} is sufficient for being ${cons.text}.`;
  const invalidConclusion = `Being ${ante.text} is necessary for being ${cons.text}.`;

  return {
    templateId: 'necessary-sufficient',
    subject,
    predicates: [ante, cons],
    premises: [premise],
    fact,
    validConclusion,
    invalidConclusion,
    abstractForm: `${ante.symbol} -> ${cons.symbol} : ${ante.symbol} is sufficient for ${cons.symbol}`,
    chainLength: 1,
    inferenceSummary: `${ante.symbol} is sufficient (not necessary) for ${cons.symbol}.`,
  };
}

const TEMPLATE_BUILDERS = {
  'hypothetical-syllogism': buildHypotheticalSyllogism,
  'modus-ponens': buildModusPonens,
  'modus-tollens': buildModusTollens,
  'contraposition': buildContraposition,
  'necessary-sufficient': buildNecessarySufficient,
};

// Templates that use 4-option MC format (correct option among distractors)
// rather than the binary Must follow / Cannot follow format.
export const MC_TEMPLATES = ['contraposition', 'necessary-sufficient'];

// --- Public API ---

export function buildTemplateDraft(settings) {
  const template = getTemplate(settings.templateId || 'hypothetical-syllogism');
  if (!template) throw new Error(`Unknown template: ${settings.templateId}`);

  const subject = pick(CONDITIONAL_SUBJECTS);
  const chainLen = resolveChainLength(template, settings);
  const neededProps = Math.max(chainLen + 2, 4);
  const props = drawUnique(CONDITIONAL_PROPERTY_POOL, neededProps);

  const builder = TEMPLATE_BUILDERS[template.id];
  const draft = builder(subject, props, settings);

  draft.templateName = template.name;
  draft.spareProperties = props.slice(draft.predicates.length);

  return draft;
}

export function buildConditionalDraft(settings) {
  const draft = buildTemplateDraft(settings);
  const isMC = MC_TEMPLATES.includes(draft.templateId);

  if (isMC) {
    // MC templates: the correct answer is always the valid conclusion, presented
    // among distractors as a 4-option MC item. answerOptions is assembled by the
    // caller after distractor generation (shuffle + inject valid conclusion).
    draft.isMCFormat = true;
    draft.conclusion = null;
    draft.conclusionIsValid = true;
    draft.correctAnswer = draft.validConclusion;
    draft.answerOptions = null;
  } else {
    const isValid = settings.conclusionValidity !== 'invalid';
    draft.isMCFormat = false;
    draft.conclusion = isValid ? draft.validConclusion : draft.invalidConclusion;
    draft.conclusionIsValid = isValid;
    draft.correctAnswer = isValid ? 'Must follow' : 'Cannot follow';
    draft.answerOptions = ['Must follow', 'Cannot follow'];
  }

  const QUESTION_PROMPTS = {
    'contraposition':      'Which of the following means exactly the same as the rule above?',
    'necessary-sufficient':'Which of the following correctly describes what the rule tells us?',
  };
  draft.questionPrompt = QUESTION_PROMPTS[draft.templateId] || 'Does the conclusion follow from the premises and the given fact?';

  return draft;
}

export function buildConditionalFormula(settings, resolvedItem, meta = {}) {
  return {
    formulaType: 'psychkit.verbal-reasoning.item-formula',
    version: 1,
    generator: 'verbal-reasoning',
    settings: cloneConditionalValue(settings),
    resolvedItem: cloneConditionalValue(resolvedItem),
    meta: cloneConditionalValue(meta),
  };
}

export function getConditionalItemFromFormula(formula) {
  return cloneConditionalValue(formula?.resolvedItem) || null;
}

export function getConditionalSettingsFromFormula(formula) {
  return cloneConditionalValue(formula?.settings) || null;
}

export function getConditionalMetaFromFormula(formula) {
  return cloneConditionalValue(formula?.meta) || {};
}

export function generateBatch(settings, count) {
  const seen = new Set();
  const results = [];
  let attempts = 0;
  const maxAttempts = count * 10;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const draft = buildConditionalDraft(settings);
    // MC templates have null conclusion; use validConclusion for dedup signature
    const sig = draft.premises.map(p => p.text).join('|') + '|' + (draft.conclusion ?? draft.validConclusion);
    if (!seen.has(sig)) {
      seen.add(sig);
      results.push(draft);
    }
  }

  return results;
}

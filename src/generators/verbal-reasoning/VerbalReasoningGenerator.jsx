import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { colors, pill } from '../../theme';
import { appendToBank, genBankId, makeBankItem } from '../../store/bankStore';
import {
  CONDITIONAL_TEMPLATES,
  DEFAULT_CONDITIONAL_SETTINGS,
  MC_TEMPLATES,
  buildConditionalDraft,
  buildConditionalFormula,
  generateBatch,
  getConditionalItemFromFormula,
  getConditionalSettingsFromFormula,
} from './engine';
import { validateConditionalDraft } from './scoring';
import { buildConditionalDistractors } from './distractors';
import {
  buildClaimRefutation,
  buildPresentedClaim,
  buildValidClaim,
  evaluateClaimAgainstDraft,
  renderForm,
} from './refutation';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const accent = '#22d3ee';
const PREMISE_COLORS = ['#22d3ee', '#4ade80', '#fbbf24', '#f472b6'];
const PROOF_TERM_COLORS = ['#22d3ee', '#4ade80', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#fb923c', '#34d399'];
const FONT_SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'DM Mono', 'SF Mono', 'Fira Code', Consolas, monospace";

const C_VRB = {
  bg:           '#0A0F1A',
  card:         'rgba(10,15,26,0.5)',
  border:       'rgba(34,211,238,0.15)',
  borderStrong: 'rgba(34,211,238,0.28)',
  sep:          'rgba(255,255,255,0.07)',
};

const sty = {
  container:      { display: 'flex', flexDirection: 'column', fontFamily: FONT_SANS, color: colors.text, height: '100vh', width: '100%', minWidth: 0, overflow: 'hidden', background: C_VRB.bg },
  contentRow:     { display: 'flex', alignItems: 'stretch', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
  left:           { flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0, padding: '12px 12px 20px 16px', borderRight: `1px solid ${C_VRB.sep}` },
  right:          { flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' },
  pageFooter:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: '#070C16', borderTop: `1px solid ${C_VRB.sep}`, flex: '0 0 auto' },
  pageFooterGroup:{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  section:        { background: C_VRB.card, border: `1px solid ${C_VRB.border}`, borderRadius: 2, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' },
  title:          { fontSize: 11, fontWeight: 800, color: 'rgba(34,211,238,0.68)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, marginBottom: 10 },
  label:          { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  sel:            { background: '#111827', color: colors.text, border: '1px solid #2D3748', borderRadius: 2, padding: '7px 10px', fontSize: 13, fontFamily: FONT_SANS, width: '100%', outline: 'none' },
  row:            { display: 'flex', alignItems: 'center', gap: 8 },
  // Cyan operator action button
  btn:            { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,211,238,0.08)', color: accent, border: '1px solid rgba(34,211,238,0.28)', borderRadius: 2, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS, letterSpacing: '0.02em' },
  // Neutral secondary button
  btnOut:         { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', color: colors.text, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS, letterSpacing: '0.02em' },
  // Green positive action button
  btnBank:        { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 2, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS, letterSpacing: '0.02em' },
  toast:          { position: 'fixed', bottom: 20, right: 20, background: accent, color: '#000', padding: '9px 18px', borderRadius: 2, fontWeight: 700, fontSize: 12, zIndex: 999, boxShadow: '0 8px 28px rgba(0,0,0,0.55)' },
  modalOverlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 },
  modalCard:      { width: 'min(900px, 100%)', maxHeight: 'min(88vh, 860px)', background: C_VRB.bg, border: `1px solid rgba(34,211,238,0.28)`, borderRadius: 2, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '18px 22px 14px', borderBottom: `1px solid ${C_VRB.sep}` },
  modalTitle:     { margin: 0, fontSize: 17, fontWeight: 700, color: colors.text, fontFamily: FONT_SANS },
  modalSubtitle:  { margin: '4px 0 0', fontSize: 12, color: colors.textMuted, lineHeight: 1.6 },
  modalClose:     { width: 32, height: 32, borderRadius: 2, border: `1px solid rgba(255,255,255,0.1)`, background: 'rgba(255,255,255,0.04)', color: colors.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  premise:        { fontSize: 15, lineHeight: 1.4, color: colors.text, padding: '5px 10px', background: 'rgba(34,211,238,0.04)', borderRadius: 2, borderLeft: `3px solid ${accent}`, marginBottom: 4 },
  fact:           { fontSize: 15, lineHeight: 1.4, color: colors.text, padding: '5px 10px' },
  conclusion:     { fontSize: 15, lineHeight: 1.4, color: colors.text, padding: '5px 10px', background: 'rgba(34,211,238,0.06)', borderRadius: 2, border: '1px solid rgba(34,211,238,0.2)' },
  abstract:       { fontFamily: FONT_MONO, fontSize: 12, color: colors.textDim, padding: '6px 10px', background: '#111827', borderRadius: 2, border: '1px solid #2D3748' },
  staged:         { background: C_VRB.card, border: `1px solid ${C_VRB.border}`, borderRadius: 2, padding: '14px 16px', marginBottom: 8 },
};

// ── Tooltip content ───────────────────────────────────────────────────────────

const LOGICAL_FORM_TIPS = {
  section:     "This section provides multiple formal representations of the item's logical structure — from visual graphs and symbolic notation to machine-readable exports and step-by-step proofs. Each sub-section serves a different analytical purpose.",
  graph:       "A directed graph of the item's logical structure. Each predicate is a node; each conditional rule (→) is a solid edge; the derived conclusion (⇒) is a dashed arc above the chain. Dashed-bordered nodes are negated predicates. The graph makes transitive chains and equivalences visually unambiguous.",
  abstract:    "The item's logic in compact symbolic notation. Predicates are colour-coded by unique term (a, b, c…). The → arrow denotes a conditional rule; ⇒ denotes the derived conclusion; ~ denotes negation. The ∴ symbol separates the premise chain (left) from what is derived (right).",
  inference:   "A plain-English description of the inference pattern applied — which predicates are affirmed or denied, and how the valid conclusion follows. Use this to verify that the item's narrative matches its underlying logic.",
  proof:       "A validity trace for the keyed answer. Chain templates show a derivation from the premises and given fact; contraposition and necessary/sufficient items show the governing equivalence or definition. A truth-table summary confirms the keyed answer across all premise-compatible models, and invalid binary conclusions receive an explicit invalidity check.",
  formal:      "Machine-readable formal representations. Propositional Logic uses standard mathematical symbols (∧ = and, → = if-then, ⊢ = derives, ≡ = equivalent). Prolog expresses the same logic as executable facts and rules that can be run in any Prolog interpreter to verify the inference.",
  ner:         "Named Entity Recognition annotation in IOB2 format — the standard used by NLP pipelines (spaCy, HuggingFace, etc.). B-PRED marks the first mention of a predicate; I-PRED marks a repeated (coreferential) mention, identifying pivot predicates in chains. Operators are tagged O (outside any entity span).",
  graphExport: "The item's logical structure as a JSON graph compatible with NetworkX, D3.js, and GraphML. Nodes are unique predicates; edges carry a type (CONDITIONAL, INFERRED, EQUIVALENT, SUFFICIENT) and a label. Use this to feed items into graph neural networks, knowledge-graph pipelines, or automated reasoning tools.",
  cypher:      "Neo4j Cypher CREATE statements that reproduce the item's graph in a property graph database. Each predicate becomes a :Predicate node; each logical relationship becomes a typed edge (CONDITIONAL, INFERRED, EQUIVALENT, SUFFICIENT). Paste directly into Neo4j Browser or any Bolt-compatible driver to explore the inference chain with graph queries.",
};

const VERBAL_TAB_TIPS = {
  proof: 'Validity Layers brings together the item evidence: formal proof trace, truth-table verification, graph structure, abstract notation, NER/IOB2 annotation, and logical-validity checks. Use this tab to inspect whether the item follows from a sound underlying logical structure.',
  distractors: 'Distractors shows only the response options actually presented to the test-taker. In binary Must follow/Cannot follow items, it analyzes the single non-keyed response and explains why that response is wrong.',
  formal: 'Formal Notation gives machine-readable and textbook-style formalizations of the item logic, including propositional notation and Prolog. Use it when you want to audit or export the reasoning rules in a more formal language.',
  export: 'Export provides structured representations of the item logic. JSON is useful for graph/data workflows, while Cypher is useful for loading the item structure into Neo4j or another property-graph workflow.',
  formula: 'Formula exposes the single JSON source of truth for the current verbal item. It captures both the selected settings and the resolved generated item data that the preview, validity layers, and exports are reading from.',
};

const VALIDITY_LAYER_SUBTABS = [
  ['trace', 'Proof Trace Table'],
  ['truth', 'Truth-Table Verification'],
  ['graph', 'Graph'],
  ['abstract', 'Abstract Form'],
  ['ner', 'NER / IOB2'],
  ['checks', 'Logical Validity'],
];

const TIPS = {
  template: 'The logical form that structures each item. Each template tests a different inference skill — choose one to focus the batch on that reasoning type.',
  templateOptions: {
    'hypothetical-syllogism': 'Chains multiple if-then rules together. The test-taker follows the chain from a given fact to reach the final conclusion.',
    'modus-ponens':           'The most basic conditional rule: "If A then B; A is true; therefore B." Affirms the antecedent to affirm the consequent. Good for introductory items.',
    'modus-tollens':          '"If A then B; B is false; therefore A is false." Requires reasoning backwards through a denial.',
    'contraposition':         'Tests whether the test-taker knows that "If A then B" is logically equivalent to "If not-B then not-A." A common source of reasoning errors.',
    'necessary-sufficient':   'Tests understanding that "If A then B" makes A sufficient (but not necessary) for B. Confusing necessity with sufficiency is a frequent logical mistake.',
  },
  chainLength:  'How many if-then premises are chained together. Longer chains require tracking more intermediate steps before the final conclusion is reached.',
  chainOptions: {
    2: 'Two premises (A→B, B→C). A single intermediate step — the simplest chain.',
    3: 'Three premises. Requires tracking one extra intermediate link before reaching the conclusion.',
    4: 'Four premises — the longest chain available in this generator. Tests sustained logical tracking across a long chain.',
  },
  conclusion:   'Whether the conclusion presented in the item logically follows from the premises. Determines what the correct answer is.',
  conclusionOptions: {
    valid:   'The conclusion does follow. The correct answer is "Must follow." Use this for straightforward items.',
    invalid: 'The conclusion does NOT follow. The correct answer is "Cannot follow." The test-taker must detect the logical error in the presented conclusion.',
  },
  distractorStyle: 'How wrong-answer conclusions are constructed for 4-option multiple-choice templates. Binary Must follow/Cannot follow items instead analyze only the one non-keyed response option.',
  distractorOptions: {
    mixed:             'A balanced mix of all fallacy types. Good default for varied, unpredictable distractors.',
    'classic-fallacies': 'Prioritises formal logical fallacies (e.g. affirming the consequent, denying the antecedent) — the errors most commonly made on logic tests.',
    'near-miss':        'Distractors that are almost correct — differing by one small detail. Useful when you want alternatives that stay very close to the licensed answer.',
  },
  negation:   'Introduces negated predicates (e.g. "not blue") into the premises. Requires tracking both affirmed and denied properties simultaneously.',
  batchSize:  'Number of items generated in one batch. All items use the current settings. Review each one and accept or reject before adding to the item bank.',
};

// ── InfoTip component ─────────────────────────────────────────────────────────

function InfoTip({ content, placement = 'bottom-start' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      if (placement === 'top-end') {
        setPos({
          bottom: window.innerHeight - r.top + 7,
          right: window.innerWidth - r.right,
        });
      } else {
        setPos({ top: r.bottom + 7, left: r.left });
      }
    }
    setOpen(o => !o);
  };

  const isTopEnd = placement === 'top-end';
  const card = open ? createPortal(
    <div style={{
      position: 'fixed',
      ...(isTopEnd ? { bottom: pos.bottom, right: pos.right } : { top: pos.top, left: pos.left }),
      zIndex: 9999, width: 240,
      background: '#111827',
      border: `1px solid rgba(34,211,238,0.28)`,
      borderRadius: 2,
      padding: '10px 14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
      fontSize: 12, color: '#C2CDD8', lineHeight: 1.65,
      fontFamily: FONT_SANS,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute',
        ...(isTopEnd ? { bottom: -5, right: 6 } : { top: -5, left: 6 }),
        width: 8, height: 8, background: '#111827',
        border: '1px solid rgba(34,211,238,0.28)',
        ...(isTopEnd ? { borderLeft: 'none', borderTop: 'none' } : { borderRight: 'none', borderBottom: 'none' }),
        transform: 'rotate(45deg)',
      }} />
      {content}
    </div>,
    document.body
  ) : null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          width: 15, height: 15, borderRadius: '50%', padding: 0,
          border: `1px solid ${open ? 'rgba(34,211,238,0.7)' : 'rgba(34,211,238,0.3)'}`,
          background: open ? 'rgba(34,211,238,0.18)' : 'rgba(34,211,238,0.06)',
          color: open ? accent : 'rgba(34,211,238,0.55)',
          fontSize: 9, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, fontFamily: 'serif', letterSpacing: 0,
          transition: 'all 0.12s', flexShrink: 0,
        }}
        title="More info"
      >i</button>
      {card}
    </span>
  );
}

// ── Shared abstract-form tokenizer (module scope) ────────────────────────────

function tokenizeAbstractForm(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    if (str.startsWith('=>', i))       { tokens.push({ t: 'derived' });                i += 2; }
    else if (str.startsWith('<=>', i)) { tokens.push({ t: 'bicond' });                  i += 3; }
    else if (str.startsWith('->', i))  { tokens.push({ t: 'cond' });                    i += 2; }
    else if (str[i] === '~') {
      let j = i + 1;
      while (j < str.length && /[a-zA-Z]/.test(str[j])) j++;
      tokens.push({ t: 'neg-pred', base: str.slice(i + 1, j) });
      i = j;
    } else if (/[a-zA-Z]/.test(str[i])) {
      let j = i;
      while (j < str.length && /[a-zA-Z]/.test(str[j])) j++;
      tokens.push({ t: 'pred', base: str.slice(i, j) });
      i = j;
    } else if (str[i] === ';') { tokens.push({ t: 'sep', ch: ';' }); i++; }
    else if (str[i] === ':') { tokens.push({ t: 'sep', ch: ':' }); i++; }
    else if (str[i] === ',') { tokens.push({ t: 'comma' }); i++; }
    else if (str[i] === ' ') { i++; } // skip spaces
    else { tokens.push({ t: 'other', ch: str[i] }); i++; }
  }
  return tokens;
}

// ── NER Annotation Builder ────────────────────────────────────────────────────

function buildNERAnnotation(abstractForm) {
  if (!abstractForm) return [];
  const tokens = tokenizeAbstractForm(abstractForm);
  const seen = new Map(); // base -> count

  return tokens
    .filter(tok => tok.t !== 'other')
    .map((tok, i) => {
      if (tok.t === 'pred' || tok.t === 'neg-pred') {
        const base = tok.base;
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        const iob   = count === 0 ? 'B' : 'I';
        const label = tok.t === 'neg-pred' ? 'NEG-PRED' : 'PRED';
        return { key: i, text: tok.t === 'neg-pred' ? `¬${base}` : base, iob2: `${iob}-${label}`, entityType: label, isNeg: tok.t === 'neg-pred', isPivot: count > 0 };
      }
      const OPS = {
        cond:    { text: '→',  iob2: 'O', entityType: 'COND'   },
        derived: { text: '⇒',  iob2: 'O', entityType: 'DERIV'  },
        bicond:  { text: '⟺', iob2: 'O', entityType: 'BICOND' },
        sep:     { text: tok.ch, iob2: 'O', entityType: 'SEP'  },
        comma:   { text: ',',  iob2: 'O', entityType: 'SEP'    },
      };
      return OPS[tok.t] ? { key: i, ...OPS[tok.t] } : null;
    })
    .filter(Boolean);
}

// ── NER Annotation Renderer ───────────────────────────────────────────────────

const NER_ENTITY_COLORS = {
  'PRED':    '#34d399',
  'NEG-PRED':'#f87171',
  'COND':    '#e879f9',
  'DERIV':   '#22d3ee',
  'BICOND':  '#a78bfa',
  'SEP':     'rgba(255,255,255,0.25)',
};

function NERAnnotationRenderer({ abstractForm }) {
  if (!abstractForm) return null;
  const tokens = buildNERAnnotation(abstractForm);
  const nerLegendItems = Object.entries(NER_ENTITY_COLORS).map(([tag, color]) => [
    tag,
    tag === 'PRED' ? 'predicate (first mention)' :
      tag === 'NEG-PRED' ? 'negated predicate' :
      tag === 'COND' ? 'conditional operator' :
      tag === 'DERIV' ? 'derived conclusion' :
      tag === 'BICOND' ? 'biconditional' :
      'separator',
    color,
  ]);

  return (
    <div style={{ ...sty.abstract, padding: 0, overflow: 'hidden' }}>
      <div>
        <div style={{ padding: '14px 16px' }}>
          {/* Token chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end' }}>
            {tokens.map(tok => {
              const c = NER_ENTITY_COLORS[tok.entityType] || 'rgba(255,255,255,0.4)';
              const isOp = ['COND','DERIV','BICOND','SEP'].includes(tok.entityType);
              return (
                <div key={tok.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* Token text */}
                  <div style={{
                    fontSize: isOp ? 14 : 14,
                    fontFamily: FONT_MONO,
                    fontWeight: isOp ? 400 : 600,
                    color: tok.isPivot ? c : isOp ? c : '#fff',
                    padding: isOp ? '4px 6px' : '5px 10px',
                    background: isOp ? 'transparent' : `${c}15`,
                    border: isOp ? 'none' : `1px solid ${c}40`,
                    borderRadius: 4,
                    textDecoration: tok.isPivot ? 'underline' : 'none',
                    textDecorationColor: `${c}80`,
                    textUnderlineOffset: 3,
                  }}>
                    {tok.text}
                  </div>
                  {/* IOB2 tag */}
                  <div style={{
                    fontSize: 9, fontWeight: 800, fontFamily: FONT_MONO,
                    color: c,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    opacity: isOp ? 0.5 : 1,
                  }}>
                    {tok.iob2}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.045)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: FONT_SANS }}>
            Tag Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 18px' }}>
            {nerLegendItems.map(([tag, meaning, color]) => (
              <div key={tag} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0f` }}>
                <span style={{ color, fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO }}>{tag}</span>
                <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>{meaning}</span>
              </div>
            ))}
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.06)' }}>
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO }}>B-</span>
              <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>first mention</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.06)' }}>
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO }}>I-</span>
              <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>repeated/coreferential mention</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Graph Renderer ────────────────────────────────────────────────────────

const EDGE_COLORS = { CONDITIONAL: '#e879f9', INFERRED: '#22d3ee', EQUIVALENT: '#a78bfa', SUFFICIENT: '#fbbf24' };

function isPulsingTerm(pulsingTermKey, key) {
  if (Array.isArray(pulsingTermKey)) {
    return pulsingTermKey.includes(key);
  }
  return pulsingTermKey === key;
}

function renderNotationWithConditionalArrows(text, colorEntries = [], pulsingTermKey = null, pulseAllTerms = false) {
  const value = String(text ?? '');
  if (!value) {
    return value;
  }

  const lower = value.toLowerCase();
  const parts = [];
  let cursor = 0;

  while (cursor < value.length) {
    if (value[cursor] === '→') {
      parts.push(
        <span key={`arrow-${cursor}`} style={{ color: EDGE_COLORS.CONDITIONAL }}>
          →
        </span>
      );
      cursor += 1;
      continue;
    }

    let matched = null;
    for (const entry of colorEntries) {
      if (
        lower.startsWith(entry.key, cursor)
        && isStatementMatchBoundary(lower, cursor, entry.key.length)
      ) {
        matched = entry;
        break;
      }
    }

    if (!matched) {
      const nextIndex = cursor + 1;
      parts.push(value.slice(cursor, nextIndex));
      cursor = nextIndex;
      continue;
    }

    const segment = value.slice(cursor, cursor + matched.key.length);
    parts.push(
      <span
        key={`${matched.key}-${cursor}`}
        style={{
          color: matched.color,
          fontWeight: 700,
          display: 'inline-block',
          animation: pulseAllTerms || isPulsingTerm(pulsingTermKey, matched.key) ? 'proofTraceTermPulse 0.9s ease-in-out infinite' : 'none',
          willChange: pulseAllTerms || isPulsingTerm(pulsingTermKey, matched.key) ? 'transform, text-shadow' : 'auto',
        }}
      >
        {segment}
      </span>
    );
    cursor += matched.key.length;
  }

  return parts;
}

function renderNotationWithTruthMarker(text, colorEntries = [], pulsingTermKey = null, pulseAllTerms = false, truthState = null) {
  const notation = renderNotationWithConditionalArrows(text, colorEntries, pulsingTermKey, pulseAllTerms);
  if (!truthState) {
    return notation;
  }
  return (
    <>
      {notation}
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{' ('}</span>
      <span style={{ color: '#34d399', fontWeight: 700 }}>{truthState}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{')'}</span>
    </>
  );
}

function buildProofStatementColorEntries(draft) {
  if (!draft?.predicates?.length) return [];
  const seen = new Set();
  const entries = [];

  draft.predicates.forEach((predicate, index) => {
    const label = String(predicate?.text ?? '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      label,
      key,
      color: PROOF_TERM_COLORS[index % PROOF_TERM_COLORS.length],
    });
  });

  return entries.sort((a, b) => b.label.length - a.label.length);
}

function isStatementMatchBoundary(text, start, length) {
  const prev = start > 0 ? text[start - 1] : '';
  const next = start + length < text.length ? text[start + length] : '';
  const isBoundary = ch => !ch || !/[a-z0-9]/i.test(ch);
  return isBoundary(prev) && isBoundary(next);
}

function renderStatementWithPredicateColors(text, colorEntries, pulsingTermKey = null, pulseAllTerms = false) {
  const value = String(text ?? '');
  if (!value || !colorEntries?.length) {
    return value;
  }

  const lower = value.toLowerCase();
  const parts = [];
  let cursor = 0;

  while (cursor < value.length) {
    let matched = null;
    for (const entry of colorEntries) {
      if (
        lower.startsWith(entry.key, cursor)
        && isStatementMatchBoundary(lower, cursor, entry.key.length)
      ) {
        matched = entry;
        break;
      }
    }

    if (!matched) {
      const nextIndex = cursor + 1;
      parts.push(value.slice(cursor, nextIndex));
      cursor = nextIndex;
      continue;
    }

    if (matched && cursor < value.length) {
      const segment = value.slice(cursor, cursor + matched.key.length);
      parts.push(
        <span
          key={`${matched.key}-${cursor}`}
          style={{
            color: matched.color,
            fontWeight: 700,
            display: 'inline-block',
            animation: pulseAllTerms || isPulsingTerm(pulsingTermKey, matched.key) ? 'proofTraceTermPulse 0.9s ease-in-out infinite' : 'none',
            willChange: pulseAllTerms || isPulsingTerm(pulsingTermKey, matched.key) ? 'transform, text-shadow' : 'auto',
          }}
        >
          {segment}
        </span>
      );
      cursor += matched.key.length;
    }
  }

  return parts;
}

function SVGGraphRenderer({ draft }) {
  const [hoveredId, setHoveredId] = useState(null);
  if (!draft) return null;

  const schema = buildGraphSchema(draft);

  // Collect all node ids — including ¬-prefixed negated variants from edges
  const allNodeIds = new Set();
  schema.edges.forEach(e => { allNodeIds.add(e.from); allNodeIds.add(e.to); });
  schema.nodes.forEach(n => allNodeIds.add(n.id));

  const nodeList = [...allNodeIds];
  const NODE_W = 124, NODE_H = 44, H_GAP = 56, PADDING = 24;
  const totalW = nodeList.length * NODE_W + (nodeList.length - 1) * H_GAP + PADDING * 2;
  // Extra height for tall arc above nodes
  const SVG_H = 170;
  // Push nodes downward so the arc has room above
  const nodeY = SVG_H - NODE_H - 28;

  const nodeX = {};
  nodeList.forEach((id, i) => { nodeX[id] = PADDING + i * (NODE_W + H_GAP); });

  const termMap = buildTermMap(draft);

  function nodeColor(id) {
    const base = id.replace(/^¬/, '');
    const label = termMap.get(base);
    const idx = label ? TERM_LETTERS.indexOf(label) : 0;
    return TERM_COLORS[idx % TERM_COLORS.length];
  }

  function nodeTerm(id) {
    const isNeg = id.startsWith('¬');
    const base = isNeg ? id.slice(1) : id;
    const node = schema.nodes.find(n => n.id === base);
    const term = node ? node.term : base;
    return isNeg ? `not ${term}` : term;
  }

  const markerIds = Object.keys(EDGE_COLORS);
  // Vertical midpoint of nodes (center of the node rect)
  const cy = nodeY + NODE_H / 2;

  return (
    <div style={{ ...sty.abstract, padding: 0, overflow: 'hidden' }}>
      <div>
        <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
          <svg width={totalW} height={SVG_H} style={{ display: 'block', minWidth: totalW }}>
            <defs>
              {markerIds.map(type => (
                <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={EDGE_COLORS[type]} />
                </marker>
              ))}
            </defs>

            {/* Edges — drawn first so nodes render on top */}
            {schema.edges.map((edge) => {
              const x1 = nodeX[edge.from] + NODE_W;
              const x2 = nodeX[edge.to];
              const y  = cy;
              const color = EDGE_COLORS[edge.type] || '#fff';
              const isDerived = edge.type === 'INFERRED' || edge.type === 'EQUIVALENT';
              const midX = (x1 + x2) / 2;
              // Taller arc: curve apex 68px above the node center line
              const curveY = isDerived ? y - 68 : y;
              const d = isDerived
                ? `M ${x1} ${y} Q ${midX} ${curveY} ${x2} ${y}`
                : `M ${x1} ${y} L ${x2 - 8} ${y}`;
              const pathId = `edgepath-${edge.id}`;
              const tooltipText = edge.source ? `${edge.source}: ${edge.from} → ${edge.to}` : `${edge.type}: ${edge.from} → ${edge.to}`;
              return (
                <g key={edge.id}>
                  <title>{tooltipText}</title>
                  {/* Visible path — also used as textPath anchor */}
                  <path
                    id={pathId}
                    d={d}
                    stroke={color}
                    strokeWidth={isDerived ? 2 : 1.5}
                    strokeDasharray={isDerived ? '5 3' : 'none'}
                    fill="none"
                    markerEnd={`url(#arrow-${edge.type})`}
                    opacity={0.85}
                  />
                  {/* Edge label follows the path — sits ON the edge, not floating */}
                  <text fontSize="10" fill={color} fontFamily={FONT_MONO} fontWeight="700" dy={isDerived ? '-5' : '-4'}>
                    <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                      {edge.label}
                    </textPath>
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodeList.map(id => {
              const x = nodeX[id];
              const color = nodeColor(id);
              const isNeg = id.startsWith('¬');
              const termText = nodeTerm(id);
              const isHovered = hoveredId === id;
              return (
                <g key={id}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: 'default' }}>
                  {/* Native SVG tooltip on hover */}
                  <title>{termText}{isNeg ? ' (negated)' : ''}</title>
                  {/* Color-filled node rect */}
                  <rect x={x} y={nodeY} width={NODE_W} height={NODE_H} rx="4"
                    fill={isHovered ? `${color}30` : `${color}1a`}
                    stroke={color} strokeWidth={isNeg ? 1 : 1.5}
                    strokeDasharray={isNeg ? '4 2' : 'none'} />
                  {/* Predicate name — primary label */}
                  <text x={x + NODE_W / 2} y={nodeY + NODE_H / 2 + 5} textAnchor="middle"
                    fontSize="12" fontWeight="700" fill={color} fontFamily={FONT_SANS}>
                    {termText}
                  </text>
                  {/* Letter label badge — top-right corner */}
                  <text x={x + NODE_W - 6} y={nodeY + 10} textAnchor="end"
                    fontSize="8" fontWeight="600" fill={`${color}99`} fontFamily={FONT_MONO}>
                    {id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.045)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: FONT_SANS }}>
            Edge Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 18px' }}>
            {Object.entries(EDGE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0f` }}>
                <svg width="52" height="12">
                  <line x1="0" y1="6" x2="44" y2="6" stroke={color} strokeWidth="2"
                    strokeDasharray={type === 'INFERRED' || type === 'EQUIVALENT' ? '4 2' : 'none'} />
                </svg>
                <span style={{ color, fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO }}>{type}</span>
              </div>
            ))}
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)' }}>
              <span style={{ color: '#f87171', fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO }}>dashed</span>
              <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>negated predicate border</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO }}>hover</span>
              <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>nodes and edges show details</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formal Notation Builder ───────────────────────────────────────────────────

function buildFormalNotations(draft) {
  const fmt    = p => p.negated ? `¬${p.base}` : p.base;
  const fmtNeg = p => p.negated ? p.base : `¬${p.base}`;
  const prologAtom = s => s.replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  // Propositional logic
  let propPremises = draft.premises.map(p => `(${fmt(p.antecedent)} → ${fmt(p.consequent)})`).join(' ∧ ');

  let propStatement;
  switch (draft.templateId) {
    case 'hypothetical-syllogism':
    case 'modus-ponens': {
      const given = fmt(draft.predicates[0]);
      const derived = fmt(draft.premises[draft.premises.length - 1].consequent);
      propStatement = `${propPremises} ∧ ${given} ⊢ ${derived}`;
      break;
    }
    case 'modus-tollens': {
      const ante = draft.predicates[0], cons = draft.predicates[1];
      propStatement = `${propPremises} ∧ ${fmtNeg(cons)} ⊢ ${fmtNeg(ante)}`;
      break;
    }
    case 'contraposition': {
      const ante = draft.predicates[0], cons = draft.predicates[1];
      propStatement = `(${fmt(ante)} → ${fmt(cons)}) ≡ (${fmtNeg(cons)} → ${fmtNeg(ante)})`;
      break;
    }
    case 'necessary-sufficient': {
      const ante = draft.predicates[0], cons = draft.predicates[1];
      propStatement = `(${fmt(ante)} → ${fmt(cons)}) ⊨ sufficient(${fmt(ante)}, ${fmt(cons)})`;
      break;
    }
    default: propStatement = draft.abstractForm;
  }

  // Prolog
  const prologLines = [];
  draft.premises.forEach(p => {
    prologLines.push(`conditional(${prologAtom(p.antecedent.base)}, ${prologAtom(p.consequent.base)}).`);
  });
  switch (draft.templateId) {
    case 'hypothetical-syllogism':
    case 'modus-ponens':
      prologLines.push(`affirmed(${prologAtom(draft.predicates[0].base)}).`);
      prologLines.push(`derives(Y) :- conditional(X, Y), affirmed(X).`);
      prologLines.push(`derives(Z) :- conditional(X, Z), derives(X).`);
      break;
    case 'modus-tollens':
      prologLines.push(`denied(${prologAtom(draft.predicates[1].base)}).`);
      prologLines.push(`denied_antecedent(X) :- conditional(X, Y), denied(Y).`);
      break;
    case 'contraposition':
      prologLines.push(`contrapositive(NB, NA) :- conditional(A, B), NA = not(A), NB = not(B).`);
      break;
    case 'necessary-sufficient':
      prologLines.push(`sufficient_for(X, Y) :- conditional(X, Y).`);
      break;
  }
  const prolog = prologLines.join('\n');

  return { propositional: propStatement, prolog };
}

// ── Formal Notation Renderer ──────────────────────────────────────────────────

function renderColoredFormalNotation(content, tab) {
  if (!content) return null;
  const tokenColors = tab === 'prop'
    ? {
      '→': '#e879f9',
      '∧': '#34d399',
      '⊢': '#fbbf24',
      '¬': '#f87171',
      '(': '#60a5fa',
      ')': '#60a5fa',
    }
    : {
      ':-': '#e879f9',
      '.': '#60a5fa',
      ',': '#34d399',
      not_: '#f87171',
      query: '#fbbf24',
    };
  const tokenPattern = tab === 'prop'
    ? /(→|∧|⊢|¬|\(|\))/g
    : /(:-|not_|query|\.|,)/g;

  return content.split(tokenPattern).map((part, i) => {
    if (!part) return null;
    const color = tokenColors[part];
    return color ? (
      <span key={`${part}-${i}`} style={{ color, fontWeight: 800 }}>{part}</span>
    ) : (
      <span key={`${part}-${i}`}>{part}</span>
    );
  });
}

function FormalNotationRenderer({ draft }) {
  const [tab, setTab] = React.useState('prop');
  const [copiedTab, setCopiedTab] = React.useState(null);
  if (!draft) return null;

  const { propositional, prolog } = buildFormalNotations(draft);

  const TABS = [
    { id: 'prop',   label: 'Propositional Logic' },
    { id: 'prolog', label: 'Prolog'               },
  ];
  const TAB_TIPS = {
    prop: 'Propositional Logic expresses the item as symbolic conditional statements. Use this view to inspect the formal if-then structure with standard logical operators such as →, ∧, ⊢, and ¬.',
    prolog: 'Prolog expresses the same item as executable facts and rules. Use this view when you want a logic-programming representation that can be copied into a Prolog-style reasoning workflow.',
  };

  const content = tab === 'prop' ? propositional : prolog;
  const copyLabel = tab === 'prop' ? 'Copy Propositional' : 'Copy Prolog';
  const copied = copiedTab === tab;
  const legendItems = tab === 'prop'
    ? [
      ['→', 'conditional: if left side is true, then right side follows', '#e879f9'],
      ['∧', 'and: combines premises/facts', '#34d399'],
      ['⊢', 'therefore/entails: the right side is derived from the left side', '#fbbf24'],
      ['¬', 'not: negates a predicate', '#f87171'],
      ['()', 'grouping: keeps each rule visually separate', '#60a5fa'],
    ]
    : [
      [':-', 'rule: the left side follows if the right-side conditions hold', '#e879f9'],
      ['.', 'end of fact or rule', '#60a5fa'],
      [',', 'and: all listed conditions must hold', '#34d399'],
      ['not_', 'negated predicate naming convention', '#f87171'],
      ['query', 'the final goal to verify', '#fbbf24'],
    ];
  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 1800);
    });
  };

  return (
    <div style={{ ...sty.abstract, padding: 0, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 16px', fontSize: 11, fontWeight: 700, fontFamily: FONT_MONO,
              cursor: 'pointer', border: 'none', borderBottom: `2px solid ${tab === t.id ? accent : 'transparent'}`,
              background: tab === t.id ? 'rgba(34,211,238,0.06)' : 'transparent',
              color: tab === t.id ? accent : 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              transition: 'all 0.12s',
            }}
          >{t.label}</button>
        ))}
        <span style={{ flex: '0 0 auto', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingRight: 10 }}>
          <InfoTip content={TAB_TIPS[tab]} placement="top-end" />
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: '1 1 420px', minWidth: 260, margin: 0 }}>
          <button
            type="button"
            aria-label={copyLabel}
            title={copied ? 'Copied' : copyLabel}
            onClick={copy}
            style={{
              position: 'absolute',
              bottom: 12,
              right: 10,
              zIndex: 1,
              width: 30,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(34,211,238,0.08)',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(34,211,238,0.28)'}`,
              borderRadius: 2,
              padding: 0,
              cursor: 'pointer',
              color: copied ? '#34d399' : accent,
              transition: 'all 0.15s',
            }}
          >
            <CopyGlyph color={copied ? '#34d399' : accent} />
          </button>
          <pre style={{ margin: 0, minHeight: '100%', padding: '18px 54px 52px 16px', fontSize: 13, lineHeight: 1.7, color: '#fff', fontFamily: FONT_MONO, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderColoredFormalNotation(content, tab)}
          </pre>
        </div>
        <div style={{ flex: '0 1 330px', minWidth: 240, padding: '12px 14px', borderLeft: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.045)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: FONT_SANS }}>
            Symbol Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 16px' }}>
            {legendItems.map(([symbol, meaning, color]) => (
              <div key={symbol} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0f` }}>
                <span style={{ color, fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO }}>{symbol}</span>
                <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>{meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Graph Schema Builder ──────────────────────────────────────────────────────

const GRAPH_THEOREMS = {
  'hypothetical-syllogism': 'Hypothetical Syllogism',
  'modus-ponens':           'Modus Ponens',
  'modus-tollens':          'Modus Tollens',
  'contraposition':         'Law of Contraposition',
  'necessary-sufficient':   'Sufficiency Definition',
};

// Maps each unique predicate base to a letter label in first-appearance order
function buildTermMap(draft) {
  const map = new Map();
  const letters = ['a','b','c','d','e','f','g','h'];
  let i = 0;
  draft.predicates.forEach(p => {
    if (!map.has(p.base)) { map.set(p.base, letters[i] ?? String(i + 1)); i++; }
  });
  return map; // base -> label
}

function buildGraphSchema(draft) {
  const termMap = buildTermMap(draft);

  // Helper: node ID including negation prefix where applicable
  const nodeId = p => (p.negated ? `¬` : '') + termMap.get(p.base);

  // Nodes — one per unique base predicate
  const nodes = [...termMap.entries()].map(([base, label]) => ({
    id: label,
    term: base,
    type: 'PREDICATE',
  }));

  // Edges
  const edges = [];
  let edgeNum = 1;

  // One CONDITIONAL edge per premise
  draft.premises.forEach((p, i) => {
    edges.push({
      id: `e${edgeNum++}`,
      from: nodeId(p.antecedent),
      to:   nodeId(p.consequent),
      type: 'CONDITIONAL',
      label: '→',
      source: `Premise ${i + 1}`,
    });
  });

  // Derived / equivalent edge from the conclusion
  if (draft.templateId === 'contraposition') {
    const ante = draft.predicates[0], cons = draft.predicates[1];
    edges.push({ id: `e${edgeNum++}`, from: nodeId(cons),   to: nodeId(ante),   type: 'EQUIVALENT',   label: '⟺'            });
    edges.push({ id: `e${edgeNum++}`, from: '¬' + termMap.get(cons.base), to: '¬' + termMap.get(ante.base), type: 'EQUIVALENT', label: '⟺' });
  } else if (draft.templateId === 'necessary-sufficient') {
    const ante = draft.predicates[0], cons = draft.predicates[1];
    edges.push({ id: `e${edgeNum++}`, from: nodeId(ante), to: nodeId(cons), type: 'SUFFICIENT', label: 'sufficient for' });
  } else {
    // HS / MP / MT: add the inferred conclusion edge
    const first = draft.premises[0], last = draft.premises[draft.premises.length - 1];
    if (first && last) {
      edges.push({ id: `e${edgeNum++}`, from: nodeId(first.antecedent), to: nodeId(last.consequent), type: 'INFERRED', label: '⇒' });
    }
  }

  return {
    template:       draft.templateId,
    inference_rule: GRAPH_THEOREMS[draft.templateId] || draft.templateName,
    subject:        draft.subject,
    conclusion_valid: draft.conclusionIsValid,
    nodes,
    edges,
  };
}

// ── Graph Export Renderer ─────────────────────────────────────────────────────

function ExportFormatSelector({ value, onChange }) {
  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, display: 'inline-flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
      {[
        ['json', 'JSON'],
        ['cypher', 'Cypher'],
      ].map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: FONT_SANS,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: 'none',
              background: active ? 'rgba(34,211,238,0.08)' : 'rgba(10,15,26,0.72)',
              color: active ? accent : 'rgba(255,255,255,0.5)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const EXPORT_CODE_COLORS = {
  key: '#7dd3fc',
  string: '#86efac',
  number: '#fbbf24',
  boolean: '#c084fc',
  null: '#fb7185',
  punctuation: '#94a3b8',
  comment: '#64748b',
  keyword: '#c084fc',
  label: '#38bdf8',
  relation: '#fbbf24',
  property: '#34d399',
  operator: '#e879f9',
};

const EXPORT_TOOLBAR_HEIGHT = 46;

function CopyGlyph({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="5" y="3" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="2.5" y="6" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function ExportCopyButton({ copied, onClick, label }) {
  const iconColor = copied ? '#34d399' : accent;
  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? 'Copied' : label}
      onClick={onClick}
      style={{
        position: 'absolute', top: 9, right: 10, zIndex: 1,
        width: 30, height: 28,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(34,211,238,0.08)',
        border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(34,211,238,0.28)'}`,
        borderRadius: 2, padding: 0, cursor: 'pointer',
        color: iconColor,
        transition: 'all 0.15s',
      }}
    >
      <CopyGlyph color={iconColor} />
    </button>
  );
}

function ExportCodeToolbar({ exportFormat, setExportFormat, copied, onCopy, copyLabel }) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: EXPORT_TOOLBAR_HEIGHT,
      zIndex: 2,
      background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
      border: '1px solid #2D3748',
      borderBottom: '1px solid rgba(148,163,184,0.2)',
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
      boxShadow: '0 10px 18px rgba(17,24,39,0.94)',
    }}>
      <ExportFormatSelector value={exportFormat} onChange={setExportFormat} />
      <ExportCopyButton copied={copied} onClick={onCopy} label={copyLabel} />
    </div>
  );
}

function renderHighlightedJson(json) {
  const tokenPattern = /"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\]:,]/g;
  const nodes = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of json.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    const afterToken = json.slice(index + token.length);
    let color = EXPORT_CODE_COLORS.punctuation;

    if (lastIndex < index) nodes.push(json.slice(lastIndex, index));

    if (token.startsWith('"') && /^\s*:/.test(afterToken)) {
      color = EXPORT_CODE_COLORS.key;
    } else if (token.startsWith('"')) {
      color = EXPORT_CODE_COLORS.string;
    } else if (token === 'true' || token === 'false') {
      color = EXPORT_CODE_COLORS.boolean;
    } else if (token === 'null') {
      color = EXPORT_CODE_COLORS.null;
    } else if (/^-?\d/.test(token)) {
      color = EXPORT_CODE_COLORS.number;
    }

    nodes.push(
      <span key={`json-token-${index}-${tokenIndex++}`} style={{ color }}>
        {token}
      </span>
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < json.length) nodes.push(json.slice(lastIndex));
  return nodes;
}

function renderHighlightedCypher(cypher) {
  const tokenPattern = /\/\/.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|:\w+|\b(?:CREATE|MATCH|MERGE|RETURN|WITH|WHERE|SET|DELETE|DETACH|OPTIONAL|CALL|UNWIND|AS|AND|OR|NOT)\b|\btrue\b|\bfalse\b|\bnull\b|[A-Za-z_][A-Za-z0-9_]*(?=\s*:)|-\[|\]->|->|<-|[()[\]{}.,;=]/gi;
  const nodes = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of cypher.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    let color = EXPORT_CODE_COLORS.punctuation;

    if (lastIndex < index) nodes.push(cypher.slice(lastIndex, index));

    if (token.startsWith('//')) {
      color = EXPORT_CODE_COLORS.comment;
    } else if (token.startsWith('"') || token.startsWith("'")) {
      color = EXPORT_CODE_COLORS.string;
    } else if (token.startsWith(':')) {
      const label = token.slice(1);
      color = label === label.toUpperCase() ? EXPORT_CODE_COLORS.relation : EXPORT_CODE_COLORS.label;
    } else if (/^(true|false)$/i.test(token)) {
      color = EXPORT_CODE_COLORS.boolean;
    } else if (/^null$/i.test(token)) {
      color = EXPORT_CODE_COLORS.null;
    } else if (/^(CREATE|MATCH|MERGE|RETURN|WITH|WHERE|SET|DELETE|DETACH|OPTIONAL|CALL|UNWIND|AS|AND|OR|NOT)$/i.test(token)) {
      color = EXPORT_CODE_COLORS.keyword;
    } else if (/^[A-Za-z_]/.test(token)) {
      color = EXPORT_CODE_COLORS.property;
    } else if (/^(?:-\[|\]->|->|<-)$/.test(token)) {
      color = EXPORT_CODE_COLORS.operator;
    }

    nodes.push(
      <span key={`cypher-token-${index}-${tokenIndex++}`} style={{ color }}>
        {token}
      </span>
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < cypher.length) nodes.push(cypher.slice(lastIndex));
  return nodes;
}

function GraphExportRenderer({ draft, exportFormat, setExportFormat }) {
  const [copied, setCopied] = React.useState(false);
  if (!draft) return null;

  const schema = buildGraphSchema(draft);
  const json   = JSON.stringify(schema, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <ExportCodeToolbar exportFormat={exportFormat} setExportFormat={setExportFormat} copied={copied} onCopy={copy} copyLabel="Copy JSON" />
      <pre style={{
        ...sty.abstract,
        fontSize: 12, lineHeight: 1.6, margin: 0,
        overflowX: 'auto', maxHeight: 300,
        paddingTop: EXPORT_TOOLBAR_HEIGHT + 10,
        color: '#e5e7eb',
        whiteSpace: 'pre',
      }}>
        {renderHighlightedJson(json)}
      </pre>
    </div>
  );
}

// ── Cypher Export Builder ─────────────────────────────────────────────────────

function buildCypherCode(draft) {
  const schema = buildGraphSchema(draft);

  // Collect all unique node ids — plain and ¬-prefixed negated variants
  const allIds = new Set(schema.nodes.map(n => n.id));
  schema.edges.forEach(e => { allIds.add(e.from); allIds.add(e.to); });

  // Sanitize id to a valid Cypher variable name
  const varName = id => 'n_' + id.replace('¬', 'neg');

  // Resolve human-readable term for any node id (including negated)
  const termForId = id => {
    const isNeg = id.startsWith('¬');
    const base = isNeg ? id.slice(1) : id;
    const node = schema.nodes.find(n => n.id === base);
    const term = node ? node.term : base;
    return isNeg ? `not_${term}` : term;
  };

  const lines = [];
  lines.push(`// ${schema.inference_rule} · subject: ${schema.subject}`);
  lines.push('');

  [...allIds].forEach(id => {
    lines.push(`CREATE (${varName(id)}:Predicate {label: "${id}", name: "${termForId(id)}", negated: ${id.startsWith('¬')}})`);
  });

  lines.push('');

  schema.edges.forEach(e => {
    const props = [`label: "${e.label}"`];
    if (e.source) props.push(`source: "${e.source}"`);
    lines.push(`CREATE (${varName(e.from)})-[:${e.type} {${props.join(', ')}}]->(${varName(e.to)})`);
  });

  return lines.join('\n');
}

function CypherExportRenderer({ draft, exportFormat, setExportFormat }) {
  const [copied, setCopied] = useState(false);
  if (!draft) return null;

  const cypher = buildCypherCode(draft);

  const copy = () => {
    navigator.clipboard.writeText(cypher).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <ExportCodeToolbar exportFormat={exportFormat} setExportFormat={setExportFormat} copied={copied} onCopy={copy} copyLabel="Copy Cypher" />
      <pre style={{
        ...sty.abstract,
        fontSize: 12, lineHeight: 1.7, margin: 0,
        overflowX: 'auto', maxHeight: 280,
        paddingTop: EXPORT_TOOLBAR_HEIGHT + 10,
        color: '#e5e7eb',
        whiteSpace: 'pre',
      }}>
        {renderHighlightedCypher(cypher)}
      </pre>
    </div>
  );
}

function FormulaRenderer({ formula }) {
  const [tab, setTab] = useState('json');
  const [copied, setCopied] = useState(false);
  if (!formula) return null;

  const json = JSON.stringify(formula, null, 2);
  const resolvedItem = formula.resolvedItem || {};
  const settings = formula.settings || {};
  const meta = formula.meta || {};
  const engineCards = [
    {
      title: 'Source of Truth',
      tone: accent,
      body: 'The current verbal item is hydrated from this formula object. The UI no longer treats the preview as an independent truth source.',
    },
    {
      title: 'Hydration Engine',
      tone: '#4ade80',
      body: 'The engine reads formula.settings and formula.resolvedItem, reconstructs the item payload, and then uses that same payload for preview text, response options, and validity analysis.',
    },
    {
      title: 'Downstream Layers',
      tone: '#fbbf24',
      body: 'Proof trace, truth-table verification, graph, abstract form, NER / IOB2, formal notation, distractor analysis, and exports all derive from the formula-hydrated item.',
    },
  ];
  const mappingRows = [
    ['Template + control state', 'formula.settings', 'Locks the generation configuration snapshot used for this item.'],
    ['Premises / fact / conclusion', 'formula.resolvedItem.premises, fact, conclusion', 'Drives the Elements of Item panel and the test-taker preview.'],
    ['Response options', 'formula.resolvedItem.answerOptions, correctAnswer', 'Determines the presented answers and keyed response.'],
    ['Validity Layers', 'formula.resolvedItem + formula.settings', 'Feeds proof trace, truth-table verification, graph schema, abstract form, and logical validity checks.'],
    ['Distractor analysis', 'formula.resolvedItem.distractors', 'Explains why the non-keyed presented response is wrong.'],
    ['Bank metadata', 'formula.meta + formula.resolvedItem.bankId', 'Preserves the saved ID and the generator trace when the item is added to the bank.'],
  ];
  const pipelineSteps = [
    ['1', 'Controls snapshot', 'Current UI control values are frozen into formula.settings.'],
    ['2', 'Resolved item payload', 'Randomly chosen subject, predicates, premises, fact, conclusion, response options, distractors, and bank ID are stored in formula.resolvedItem.'],
    ['3', 'Hydrate preview', 'The generator reads formula.resolvedItem to rebuild the item preview without re-rolling the item.'],
    ['4', 'Validate + analyze', 'validateConditionalDraft and the validity-layer renderers consume the hydrated item to compute the proof trace and semantic checks.'],
    ['5', 'Save / export', 'The same formula-backed item is used for exports and for the item bank metadata.'],
  ];
  const statBadges = [
    ['Generator', formula.generator || 'verbal-reasoning', '#22d3ee'],
    ['Version', String(formula.version ?? '1'), '#a78bfa'],
    ['Template', resolvedItem.templateName || settings.templateId || '—', '#4ade80'],
    ['Format', resolvedItem.isMCFormat ? '4-option MC' : 'Must follow / Cannot follow', '#fbbf24'],
    ['Premises', String(resolvedItem.premises?.length || 0), '#60a5fa'],
    ['Predicates', String(resolvedItem.predicates?.length || 0), '#f472b6'],
  ];
  const formulaTabs = [
    { id: 'json', label: 'JSON Formula' },
    { id: 'engine', label: 'Engine' },
  ];

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ ...sty.abstract, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.58)' }}>
        {formulaTabs.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              style={{
                flex: '0 0 auto',
                padding: '8px 11px',
                border: 'none',
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                background: active ? 'rgba(34,211,238,0.08)' : 'transparent',
                color: active ? accent : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: active ? 800 : 700,
                fontFamily: FONT_SANS,
                letterSpacing: '0.055em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'json' && (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: EXPORT_TOOLBAR_HEIGHT,
            zIndex: 2,
            background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            boxShadow: '0 10px 18px rgba(17,24,39,0.94)',
          }}>
            <div style={{
              position: 'absolute',
              top: 11,
              left: 12,
              fontSize: 10,
              fontWeight: 800,
              fontFamily: FONT_SANS,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(34,211,238,0.7)',
            }}>
              JSON Formula
            </div>
            <ExportCopyButton copied={copied} onClick={copy} label="Copy Formula JSON" />
          </div>
          <pre style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            lineHeight: 1.6,
            margin: 0,
            overflowX: 'auto',
            maxHeight: 300,
            padding: `${EXPORT_TOOLBAR_HEIGHT + 10}px 12px 12px`,
            color: '#e5e7eb',
            whiteSpace: 'pre',
          }}>
            {renderHighlightedJson(json)}
          </pre>
        </div>
      )}

      {tab === 'engine' && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {statBadges.map(([label, value, color]) => (
              <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}10` }}>
                <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e5e7eb', fontFamily: FONT_MONO }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {engineCards.map(card => (
              <div key={card.title} style={{ border: `1px solid ${card.tone}33`, background: `${card.tone}10`, borderRadius: 4, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: card.tone, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.78)', fontFamily: FONT_SANS }}>
                  {card.body}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid rgba(34,211,238,0.18)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(34,211,238,0.05)', fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Engine Pipeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pipelineSteps.map(([step, title, body], index) => (
                <div key={step} style={{ display: 'grid', gridTemplateColumns: '56px 180px minmax(0, 1fr)', gap: 0, borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO, textAlign: 'center' }}>{step}</div>
                  <div style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: 12, fontWeight: 700 }}>{title}</div>
                  <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.65 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 10, fontWeight: 800, color: 'rgba(34,211,238,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Formula to Item Mapping
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '210px 280px minmax(0, 1fr)' }}>
              {['Item aspect', 'Formula field', 'How the engine uses it'].map((header, index) => (
                <div key={header} style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: index < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {header}
                </div>
              ))}
              {mappingRows.map((row, rowIndex) => row.map((cell, cellIndex) => (
                <div
                  key={`${row[0]}-${cellIndex}`}
                  style={{
                    padding: '10px 12px',
                    borderBottom: rowIndex === mappingRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    borderRight: cellIndex < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: cellIndex === 1 ? '#93c5fd' : 'rgba(255,255,255,0.8)',
                    fontFamily: cellIndex === 1 ? FONT_MONO : FONT_SANS,
                  }}
                >
                  {cell}
                </div>
              )))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['Builder', 'buildConditionalFormula'],
              ['Hydrator', 'getConditionalItemFromFormula'],
              ['Validator', 'validateConditionalDraft'],
              ['Proof trace', 'buildProofTrace'],
              ['Graph/export', 'buildGraphSchema'],
            ].map(([label, fn]) => (
              <div key={fn} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 9px', borderRadius: 4, border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <span style={{ fontSize: 11, color: '#ddd6fe', fontFamily: FONT_MONO }}>{fn}</span>
              </div>
            ))}
          </div>

          {meta.generatedAt && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: FONT_MONO }}>
              Generated at: {meta.generatedAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Proof Trace Builder ───────────────────────────────────────────────────────

function buildProofTrace(draft) {
  const steps = [];
  let n = 1;
  let inferenceIndex = 1;

  // Format predicate in formal proof notation (¬ for negation)
  const fmt    = p => p.negated ? `¬${p.base}` : p.base;
  const fmtNeg = p => p.negated ? p.base : `¬${p.base}`; // flip polarity
  const plainPredicate = p => `The ${draft.subject} is ${p.text}.`;

  // Add one step per premise
  draft.premises.forEach((p, i) => {
    steps.push({
      line: n++,
      elementLabel: `Premise ${i + 1}`,
      elementKind: 'premise',
      premiseIndex: i,
      plainStatement: p.text,
      statement: `${fmt(p.antecedent)} → ${fmt(p.consequent)}`,
      rule: `Premise ${i + 1}`,
      cites: [],
      type: 'premise',
    });
  });

  // Template-specific inference steps
  switch (draft.templateId) {
    case 'hypothetical-syllogism': {
      const factLine = n;
      steps.push({ line: n++, elementLabel: 'Given Fact', elementKind: 'given', plainStatement: draft.fact, statement: fmt(draft.predicates[0]), rule: 'Given fact', cites: [], type: 'given' });
      let prevLine = factLine;
      for (let i = 0; i < draft.premises.length; i++) {
        steps.push({
          line: n++,
          elementLabel: `Inference ${inferenceIndex++}`,
          elementKind: 'derived',
          plainStatement: plainPredicate(draft.premises[i].consequent),
          statement: fmt(draft.premises[i].consequent),
          rule: '→-Elim',
          cites: [i + 1, prevLine],
          type: 'derived',
        });
        prevLine = n - 1;
      }
      break;
    }
    case 'modus-ponens': {
      const factLine = n;
      steps.push({ line: n++, elementLabel: 'Given Fact', elementKind: 'given', plainStatement: draft.fact, statement: fmt(draft.predicates[0]), rule: 'Given fact', cites: [], type: 'given' });
      steps.push({ line: n++, elementLabel: `Inference ${inferenceIndex++}`, elementKind: 'derived', plainStatement: plainPredicate(draft.predicates[1]), statement: fmt(draft.predicates[1]), rule: '→-Elim', cites: [1, factLine], type: 'derived' });
      break;
    }
    case 'modus-tollens': {
      const factLine = n;
      steps.push({ line: n++, elementLabel: 'Given Fact', elementKind: 'given', plainStatement: draft.fact, statement: fmtNeg(draft.predicates[1]), rule: 'Given (¬consequent)', cites: [], type: 'given' });
      steps.push({ line: n++, elementLabel: `Inference ${inferenceIndex++}`, elementKind: 'derived', plainStatement: draft.validConclusion, statement: fmtNeg(draft.predicates[0]), rule: 'Modus Tollens', cites: [1, factLine], type: 'derived' });
      break;
    }
    case 'contraposition': {
      const ante = draft.predicates[0], cons = draft.predicates[1];
      steps.push({ line: n++, elementLabel: `Inference ${inferenceIndex++}`, elementKind: 'derived', plainStatement: draft.validConclusion, statement: `${fmtNeg(cons)} → ${fmtNeg(ante)}`, rule: 'Contraposition: (P→Q) ≡ (¬Q→¬P)', cites: [1], type: 'derived' });
      break;
    }
    case 'necessary-sufficient': {
      const ante = draft.predicates[0], cons = draft.predicates[1];
      steps.push({ line: n++, elementLabel: `Inference ${inferenceIndex++}`, elementKind: 'derived', plainStatement: draft.validConclusion, statement: `${fmt(ante)} sufficient for ${fmt(cons)}`, rule: 'Definition: P→Q ⟹ P sufficient for Q', cites: [1], type: 'derived' });
      break;
    }
  }

  const THEOREMS = {
    'hypothetical-syllogism': 'Hypothetical Syllogism',
    'modus-ponens':           'Modus Ponens',
    'modus-tollens':          'Modus Tollens',
    'contraposition':         'Law of Contraposition',
    'necessary-sufficient':   'Sufficiency Definition',
  };

  return {
    steps,
    theorem: THEOREMS[draft.templateId] || draft.templateName,
    validConclusion: draft.validConclusion,
    validElementLabel: !draft.isMCFormat && !draft.conclusionIsValid ? 'Valid Conclusion' : 'Conclusion',
    presentedConclusion: draft.conclusion,
    presentedElementLabel: 'Presented Conclusion',
    isMCFormat: draft.isMCFormat,
    conclusionIsValid: draft.conclusionIsValid,
    proofStyle: ['contraposition', 'necessary-sufficient'].includes(draft.templateId) ? 'equivalence' : 'derivation',
  };
}

// ── Proof Trace Renderer ──────────────────────────────────────────────────────

const PROOF_COLORS = { premise: '#60a5fa', given: '#fbbf24', derived: '#a78bfa' };
const PREVIEW_ELEMENT_COLORS = {
  given: '#fbbf24',
  conclusion: '#f87171',
  derived: '#a78bfa',
  presented: '#f87171',
};
const VALIDATION_LEVEL_STYLES = {
  success: { color: '#34d399', background: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.24)' },
  info: { color: accent, background: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.24)' },
  warning: { color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.24)' },
};

function getTraceLayout(density = 'full') {
  if (density === 'ultra') {
    return {
      cols: '18px minmax(0,1fr) fit-content(116px) fit-content(44px)',
      lineWidth: 18,
      elementWidth: 84,
      notationWidth: 112,
      ruleWidth: 116,
      citesWidth: 44,
      gap: 6,
      headerFont: 10,
      rowFont: 14,
      metaFont: 12,
      chipFont: 10,
      symbolFont: 16,
    };
  }
  if (density === 'narrow') {
    return {
      cols: '22px minmax(0,1fr) fit-content(132px) fit-content(52px)',
      lineWidth: 22,
      elementWidth: 88,
      notationWidth: 122,
      ruleWidth: 132,
      citesWidth: 52,
      gap: 7,
      headerFont: 10,
      rowFont: 14,
      metaFont: 12,
      chipFont: 10,
      symbolFont: 16,
    };
  }
  if (density === 'tight') {
    return {
      cols: '24px minmax(0,1fr) fit-content(148px) fit-content(56px)',
      lineWidth: 24,
      elementWidth: 92,
      notationWidth: 132,
      ruleWidth: 148,
      citesWidth: 56,
      gap: 8,
      headerFont: 10,
      rowFont: 14,
      metaFont: 12,
      chipFont: 10,
      symbolFont: 16,
    };
  }
  if (density === 'compact') {
    return {
      cols: '26px minmax(0,1fr) fit-content(164px) fit-content(60px)',
      lineWidth: 26,
      elementWidth: 96,
      notationWidth: 144,
      ruleWidth: 164,
      citesWidth: 60,
      gap: 9,
      headerFont: 10,
      rowFont: 13,
      metaFont: 12,
      chipFont: 10,
      symbolFont: 16,
    };
  }
  return {
    cols: '28px minmax(0,1fr) fit-content(180px) fit-content(64px)',
    lineWidth: 28,
    elementWidth: 104,
    notationWidth: 156,
    ruleWidth: 180,
    citesWidth: 64,
    gap: 10,
    headerFont: 10,
    rowFont: 14,
    metaFont: 12,
    chipFont: 10,
    symbolFont: 16,
  };
}

function clampProofTraceWidths(widths, totalWidth, density) {
  if (!widths || !totalWidth) return widths;
  const statementMinWidth = density === 'compact' ? 240 : 260;
  const mins = {
    lineWidth: 28,
    elementWidth: 92,
    notationWidth: 132,
    ruleWidth: 156,
    citesWidth: 56,
  };
  const nextWidths = { ...widths };
  const maxFixedWidth = totalWidth - statementMinWidth;
  let overflow = nextWidths.lineWidth + nextWidths.elementWidth + nextWidths.notationWidth + nextWidths.ruleWidth + nextWidths.citesWidth - maxFixedWidth;
  if (overflow <= 0) {
    return nextWidths;
  }

  ['citesWidth', 'ruleWidth', 'notationWidth', 'elementWidth', 'lineWidth'].forEach(key => {
    if (overflow <= 0) return;
    const available = nextWidths[key] - mins[key];
    if (available <= 0) return;
    const reduction = Math.min(available, overflow);
    nextWidths[key] -= reduction;
    overflow -= reduction;
  });

  return nextWidths;
}

function getProofElementTheme(step) {
  if (!step) return { color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)' };
  if (step.elementKind === 'premise') {
    const color = PREMISE_COLORS[step.premiseIndex % PREMISE_COLORS.length];
    return { color, background: `${color}18`, border: `${color}30` };
  }
  const color = PREVIEW_ELEMENT_COLORS[step.elementKind] || '#34d399';
  return { color, background: `${color}18`, border: `${color}30` };
}

function getCompactElementLabel(step, label) {
  if (!step) return label;
  if (step.elementKind === 'premise') {
    return `PRM${(step.premiseIndex ?? 0) + 1}`;
  }
  if (step.elementKind === 'given') {
    return 'FACT';
  }
  if (step.elementKind === 'derived') {
    const match = String(label || '').match(/(\d+)/);
    return match ? `INF${match[1]}` : 'INF';
  }
  if (step.elementKind === 'conclusion') {
    return 'CONC';
  }
  if (step.elementKind === 'presented') {
    return 'CONC';
  }
  return label;
}

function getProofElementKey(step, fallback = 'element') {
  if (!step) return fallback;
  if (step.elementKind === 'premise') {
    return `premise-${step.premiseIndex ?? 0}`;
  }
  if (step.elementKind === 'given') {
    return 'given';
  }
  if (step.elementKind === 'derived') {
    return `derived-${step.line ?? fallback}`;
  }
  if (step.elementKind === 'conclusion') {
    return 'conclusion';
  }
  if (step.elementKind === 'presented') {
    return 'presented';
  }
  return `${step.elementKind ?? 'element'}-${step.line ?? fallback}`;
}

function ProofElementBadge({ label, step, fontSize = 11, onMouseEnter, onMouseLeave }) {
  const theme = getProofElementTheme(step);
  const compactLabel = getCompactElementLabel(step, label);
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        alignSelf: 'stretch',
        background: 'transparent',
        borderLeft: 'none',
        borderRight: 'none',
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        cursor: 'default',
        userSelect: 'none',
        transition: 'color 0.12s ease',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: theme.color,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {compactLabel}
      </span>
    </div>
  );
}

function ProofTraceRenderer({ draft, validation, density = 'full', linkedElementKey = null, setLinkedElementKey = () => {}, proofTraceSubtab = 'trace' }) {
  const traceFrameRef = useRef(null);
  const dragStateRef = useRef(null);
  const [traceFrameWidth, setTraceFrameWidth] = useState(0);
  const [columnWidths, setColumnWidths] = useState(() => {
    const initialLayout = getTraceLayout(density);
    return {
      lineWidth: initialLayout.lineWidth,
      elementWidth: initialLayout.elementWidth,
      notationWidth: initialLayout.notationWidth,
      ruleWidth: initialLayout.ruleWidth,
      citesWidth: initialLayout.citesWidth,
    };
  });
  const [hoveredCiteKey, setHoveredCiteKey] = useState(null);
  const [hoveredReferenceTermKey, setHoveredReferenceTermKey] = useState(null);
  const [hoveredReferencePremiseLine, setHoveredReferencePremiseLine] = useState(null);
  const [hoveredRuleCard, setHoveredRuleCard] = useState(null);
  const [truthModelsOpen, setTruthModelsOpen] = useState(false);
  const [rawTruthTableOpen, setRawTruthTableOpen] = useState(false);
  const [filterStepsOpen, setFilterStepsOpen] = useState(false);
  const [hoveredTruthModelKeys, setHoveredTruthModelKeys] = useState([]);
  const layout = getTraceLayout(density);
  const isStacked = density === 'ultra' || density === 'narrow' || density === 'tight';
  const dividerColor = 'rgba(255,255,255,0.08)';
  const columnPad = density === 'ultra' ? 8 : density === 'narrow' ? 10 : 12;
  const elementBadgeFontSize = 11;
  const defaultFullWidths = {
    lineWidth: layout.lineWidth,
    elementWidth: layout.elementWidth,
    notationWidth: layout.notationWidth,
    ruleWidth: layout.ruleWidth,
    citesWidth: layout.citesWidth,
  };

  useEffect(() => {
    const node = traceFrameRef.current;
    if (!node) return undefined;
    const updateWidth = width => setTraceFrameWidth(width);
    updateWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => updateWidth(node.getBoundingClientRect().width);
      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect?.width;
      if (typeof nextWidth === 'number') {
        updateWidth(nextWidth);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePointerMove = event => {
      const drag = dragStateRef.current;
      if (!drag || isStacked || !traceFrameWidth) return;

      const deltaX = event.clientX - drag.startX;
      const start = drag.startWidths;
      const statementMinWidth = density === 'compact' ? 240 : 260;
      const mins = {
        lineWidth: 28,
        elementWidth: 92,
        notationWidth: 132,
        ruleWidth: 156,
        citesWidth: 56,
      };

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const maxLineWidth = traceFrameWidth - statementMinWidth - start.elementWidth - start.notationWidth - start.ruleWidth - start.citesWidth;
      const maxElementWidth = traceFrameWidth - statementMinWidth - start.lineWidth - start.notationWidth - start.ruleWidth - start.citesWidth;
      const maxNotationWidth = traceFrameWidth - statementMinWidth - start.lineWidth - start.elementWidth - start.ruleWidth - start.citesWidth;
      const maxRuleWidth = traceFrameWidth - statementMinWidth - start.lineWidth - start.elementWidth - start.notationWidth - start.citesWidth;
      const maxCitesWidth = traceFrameWidth - statementMinWidth - start.lineWidth - start.elementWidth - start.notationWidth - start.ruleWidth;

      let nextWidths = start;
      switch (drag.column) {
        case 'line':
          nextWidths = {
            ...start,
            lineWidth: clamp(start.lineWidth + deltaX, mins.lineWidth, Math.max(mins.lineWidth, maxLineWidth)),
          };
          break;
        case 'element':
          nextWidths = {
            ...start,
            elementWidth: clamp(start.elementWidth + deltaX, mins.elementWidth, Math.max(mins.elementWidth, maxElementWidth)),
          };
          break;
        case 'notation':
          nextWidths = {
            ...start,
            notationWidth: clamp(start.notationWidth - deltaX, mins.notationWidth, Math.max(mins.notationWidth, maxNotationWidth)),
          };
          break;
        case 'rule':
          nextWidths = {
            ...start,
            ruleWidth: clamp(start.ruleWidth - deltaX, mins.ruleWidth, Math.max(mins.ruleWidth, maxRuleWidth)),
          };
          break;
        case 'cites':
          nextWidths = {
            ...start,
            citesWidth: clamp(start.citesWidth - deltaX, mins.citesWidth, Math.max(mins.citesWidth, maxCitesWidth)),
          };
          break;
        default:
          return;
      }

      setColumnWidths(nextWidths);
    };

    const stopDrag = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopDrag);
      stopDrag();
    };
  }, [density, isStacked, traceFrameWidth]);

  const startColumnResize = column => event => {
    if (isStacked || !traceFrameWidth) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      column,
      startX: event.clientX,
      startWidths: {
        lineWidth: clampedFullWidths.lineWidth,
        elementWidth: clampedFullWidths.elementWidth,
        notationWidth: clampedFullWidths.notationWidth,
        ruleWidth: clampedFullWidths.ruleWidth,
        citesWidth: clampedFullWidths.citesWidth,
      },
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const effectiveFullWidths = {
    lineWidth: columnWidths?.lineWidth ?? defaultFullWidths.lineWidth,
    elementWidth: columnWidths?.elementWidth ?? defaultFullWidths.elementWidth,
    notationWidth: columnWidths?.notationWidth ?? defaultFullWidths.notationWidth,
    ruleWidth: columnWidths?.ruleWidth ?? defaultFullWidths.ruleWidth,
    citesWidth: columnWidths?.citesWidth ?? defaultFullWidths.citesWidth,
  };
  const clampedFullWidths = clampProofTraceWidths(effectiveFullWidths, traceFrameWidth, density);
  const stackedRuleWidth = density === 'ultra' ? layout.ruleWidth : density === 'narrow' ? layout.ruleWidth : layout.ruleWidth;
  const stackedCitesWidth = density === 'ultra' ? 64 : density === 'narrow' ? 72 : 84;
  const stackedElementWidth = layout.elementWidth;
  const stackedNotationWidth = layout.notationWidth;
  const stackedCols = `${layout.lineWidth}px ${stackedElementWidth}px minmax(0,1fr) ${stackedNotationWidth}px ${stackedRuleWidth}px ${stackedCitesWidth}px`;
  const fullCols = `${clampedFullWidths.lineWidth}px ${clampedFullWidths.elementWidth}px minmax(0,1fr) ${clampedFullWidths.notationWidth}px ${clampedFullWidths.ruleWidth}px ${clampedFullWidths.citesWidth}px`;
  const statementColorEntries = buildProofStatementColorEntries(draft);
  const separatedCellStyle = {
    minWidth: 0,
    paddingLeft: columnPad,
  };
  const fullDividerPositions = !isStacked
    ? [
        { key: 'line', left: clampedFullWidths.lineWidth },
        { key: 'element', left: clampedFullWidths.lineWidth + clampedFullWidths.elementWidth },
        { key: 'notation', left: traceFrameWidth - (clampedFullWidths.notationWidth + clampedFullWidths.ruleWidth + clampedFullWidths.citesWidth) },
        { key: 'rule', left: traceFrameWidth - (clampedFullWidths.ruleWidth + clampedFullWidths.citesWidth) },
        { key: 'cites', left: traceFrameWidth - clampedFullWidths.citesWidth },
      ].filter(divider => Number.isFinite(divider.left) && divider.left >= 0 && divider.left <= traceFrameWidth)
    : [];

  if (!draft) return null;
  const trace = buildProofTrace(draft);
  const validClaim = buildValidClaim(draft);
  const cachedValidEvaluation = validation?.analyses?.validEvaluation;
  const validEvaluation = cachedValidEvaluation?.allModels
    ? cachedValidEvaluation
    : evaluateClaimAgainstDraft(draft, validClaim);
  const presentedClaim = !draft.isMCFormat && !draft.conclusionIsValid
    ? buildPresentedClaim(draft)
    : null;
  const presentedRefutation = validation?.analyses?.presentedRefutation
    || (presentedClaim ? buildClaimRefutation(draft, presentedClaim) : null);

  const metaLabelStyle = {
    fontSize: layout.headerFont,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    fontFamily: FONT_MONO,
  };
  const metaValueStyle = {
    fontSize: layout.metaFont,
    lineHeight: 1.4,
    fontFamily: FONT_MONO,
  };
  const citeLabelMap = new Map(
    trace.steps.map(step => [step.line, getCompactElementLabel(step, step.elementLabel)])
  );
  const getPrimaryStepTermKey = step => {
    if (!step) return null;
    if (step.elementKind === 'premise') {
      return draft.premises?.[step.premiseIndex ?? -1]?.antecedent?.text?.toLowerCase?.() || null;
    }
    const notation = String(step.statement || '').trim().toLowerCase();
    const match = statementColorEntries.find(entry => (
      notation.includes(entry.key)
      && isStatementMatchBoundary(notation, notation.indexOf(entry.key), entry.key.length)
    ));
    return match?.key || null;
  };
  const getReferencePulseTermKey = citeLine => {
    const citedStep = trace.steps.find(step => step.line === citeLine);
    return getPrimaryStepTermKey(citedStep);
  };
  const getReferencedStep = citeLine => trace.steps.find(step => step.line === citeLine) || null;
  const getOrderedCites = cites => {
    if (!Array.isArray(cites) || cites.length <= 1) return cites || [];
    const withLabels = cites.map(cite => ({ cite, label: citeLabelMap.get(cite) || String(cite) }));
    const factRefs = withLabels.filter(entry => entry.label === 'FACT');
    const otherRefs = withLabels.filter(entry => entry.label !== 'FACT');
    return [...factRefs, ...otherRefs];
  };
  const getCiteChipStyle = (color, citeKey) => ({
    padding: density === 'narrow' ? '1px 4px' : '1px 5px',
    borderRadius: 3,
    fontSize: layout.chipFont,
    fontWeight: 700,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    color,
    fontFamily: FONT_MONO,
    animation: hoveredCiteKey === citeKey ? 'proofTraceCitePulse 0.9s ease-in-out infinite' : 'none',
    transformOrigin: 'center',
    willChange: hoveredCiteKey === citeKey ? 'transform, box-shadow' : 'auto',
    cursor: 'pointer',
  });
  const activePulsingTermKey = hoveredTruthModelKeys.length ? hoveredTruthModelKeys : hoveredReferenceTermKey;
  const closeRuleCard = () => setHoveredRuleCard(null);
  const getRuleCardContent = ruleText => {
    if (ruleText === '→-Elim') {
      return {
        accent: '#a78bfa',
        title: '→-Elim',
        subtitle: 'Conditional Elimination',
        body: (
          <>
            If <span style={{ color: '#e879f9', fontFamily: FONT_MONO }}>P → Q</span> and <span style={{ color: '#34d399', fontFamily: FONT_MONO }}>P</span> is true, then <span style={{ color: '#34d399', fontFamily: FONT_MONO }}>Q</span> follows.
          </>
        ),
        note: 'This row applies a cited conditional premise together with a cited true antecedent to derive the next true statement.',
      };
    }
    if (/^Premise \d+$/.test(ruleText)) {
      const premiseNumber = ruleText.match(/\d+/)?.[0] || '';
      return {
        accent: '#60a5fa',
        title: ruleText,
        subtitle: 'Given Conditional Premise',
        body: (
          <>
            This is an accepted premise in the proof. It contributes a formal conditional rule of the form <span style={{ color: '#e879f9', fontFamily: FONT_MONO }}>P → Q</span>.
          </>
        ),
        note: `Premise ${premiseNumber} is available as a licensed starting rule for later derivation steps.`,
      };
    }
    if (ruleText === 'Given fact' || ruleText === 'Given (¬consequent)') {
      return {
        accent: '#fbbf24',
        title: ruleText,
        subtitle: 'Given True Statement',
        body: (
          <>
            This row marks the starting fact supplied to the reasoner. It is treated as an asserted true statement that can activate a matching premise.
          </>
        ),
        note: 'In chained items, this is the entry point that allows conditional rules to begin firing.',
      };
    }
    return null;
  };
  const renderRuleValue = (ruleText, color) => {
    const cardContent = getRuleCardContent(ruleText);
    const content = (
      <span style={{ ...metaValueStyle, color, minWidth: 0, overflowWrap: 'anywhere' }}>
        {ruleText}
      </span>
    );
    if (!cardContent) {
      return content;
    }
    return (
      <span
        onMouseEnter={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredRuleCard({
            ...cardContent,
            top: rect.bottom + 10,
            left: Math.max(16, rect.left - 12),
          });
        }}
        onMouseLeave={closeRuleCard}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      >
        {content}
      </span>
    );
  };
  const renderQEDValue = (proofStyle, theorem) => {
    const qid = proofStyle === 'equivalence' ? 'Verified' : 'QED';
    const cardContent = {
      accent: '#34d399',
      title: `${qid} — ${theorem}`,
      subtitle: proofStyle === 'equivalence' ? 'Equivalence Verified' : 'Proof Completed',
      body: proofStyle === 'equivalence'
        ? (
          <>
            The target claim has been established by applying a governing logical equivalence or definition, then checking that the keyed result is licensed by the premises.
          </>
        )
        : (
          <>
            The derivation is complete. The theorem named here identifies the logical rule pattern that validates the full chain from the premises and given fact to the final conclusion.
          </>
        ),
      note: proofStyle === 'equivalence'
        ? 'This marks the point where the equivalence-based proof is considered complete.'
        : 'QED signals that the conclusion has now been formally derived from the cited steps above.',
    };
    return (
      <span
        onMouseEnter={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredRuleCard({
            ...cardContent,
            top: rect.bottom + 10,
            left: Math.max(16, rect.left - 12),
          });
        }}
        onMouseLeave={closeRuleCard}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      >
        <span style={{ ...metaValueStyle, color: '#34d399', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
          {qid} — {theorem}
        </span>
      </span>
    );
  };

  const bindElementInteractions = (step, fallback) => {
    const key = getProofElementKey(step, fallback);
    const active = linkedElementKey === key;
    return {
      active,
      onMouseEnter: () => setLinkedElementKey(key),
      onMouseLeave: () => setLinkedElementKey(current => (current === key ? null : current)),
    };
  };

  const getActiveRowStyle = (step, active) => {
    if (!active) {
      return {
        background: 'transparent',
      };
    }
    const theme = getProofElementTheme(step);
    return {
      background: theme.background,
      boxShadow: `inset 0 1px 0 ${theme.border}, inset 0 -1px 0 ${theme.border}`,
    };
  };

  const headerRow = isStacked ? (
    <div style={{ display: 'grid', gridTemplateColumns: stackedCols, width: '100%', paddingBottom: 8, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <span style={{ ...metaLabelStyle, textAlign: 'center', color: '#fff' }}>#</span>
      <span style={metaLabelStyle}>Element</span>
      <span style={{ ...metaLabelStyle, paddingLeft: columnPad }}>Statement</span>
      <span style={{ ...metaLabelStyle, ...separatedCellStyle }}>Notation</span>
      <span style={{ ...metaLabelStyle, ...separatedCellStyle }}>Rule applied</span>
      <span style={{ ...metaLabelStyle, ...separatedCellStyle }}>References</span>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: fullCols, width: '100%', paddingBottom: 8, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      {['#', 'Element', 'Statement', 'Notation', 'Rule applied', 'References'].map((h, i) => (
        <span
          key={i}
          style={{
            ...metaLabelStyle,
            textAlign: i === 0 ? 'center' : 'left',
            ...(i === 0 ? { color: '#fff' } : null),
            ...(i > 3 ? separatedCellStyle : i >= 2 ? { paddingLeft: columnPad } : null),
          }}
        >
          {h}
        </span>
      ))}
    </div>
  );

  const renderStepRow = (step) => {
    const { line, statement, plainStatement, rule, cites, type } = step;
    const c = PROOF_COLORS[type] || '#fff';
    const isLastPremise = step.elementKind === 'premise' && step.premiseIndex === draft.premises.length - 1;
    const hasFollowingInference = step.elementKind === 'given' && trace.steps.some(nextStep => nextStep.line > step.line && nextStep.elementKind === 'derived');
    const orderedCites = getOrderedCites(cites);
    const pulseEntireReferencedPremise = step.line === hoveredReferencePremiseLine && step.elementKind === 'premise';
    const truthMarker = step.elementKind === 'given' || step.elementKind === 'derived' ? 'TRUE' : null;
    const rowBorderBottom = (isLastPremise || hasFollowingInference)
      ? '2px solid rgba(255,255,255,0.12)'
      : '1px solid rgba(255,255,255,0.04)';
    if (isStacked) {
      const elementInteractions = bindElementInteractions(step, `row-${line}`);
      const rowHighlightStyle = getActiveRowStyle(step, elementInteractions.active);
      return (
        <div
          key={line}
          onMouseEnter={elementInteractions.onMouseEnter}
          onMouseLeave={elementInteractions.onMouseLeave}
          style={{ display: 'grid', gridTemplateColumns: stackedCols, width: '100%', padding: '7px 0', borderBottom: rowBorderBottom, alignItems: 'start', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
        >
          <span style={{ fontSize: layout.metaFont, fontWeight: 700, color: '#fff', textAlign: 'center', fontFamily: FONT_MONO, paddingTop: 6 }}>{line}</span>
          <ProofElementBadge label={step.elementLabel} step={step} fontSize={elementBadgeFontSize} {...elementInteractions} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, paddingLeft: columnPad }}>
            <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_SANS, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
              {renderStatementWithPredicateColors(plainStatement || statement, statementColorEntries, activePulsingTermKey, pulseEntireReferencedPremise)}
            </span>
          </div>
          <div style={{ ...separatedCellStyle, display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
            <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_MONO, lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere' }}>
              {renderNotationWithTruthMarker(statement, statementColorEntries, activePulsingTermKey, pulseEntireReferencedPremise, truthMarker)}
            </span>
          </div>
          <div style={{ ...separatedCellStyle, display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
            {renderRuleValue(rule, c)}
          </div>
          <div style={{ ...separatedCellStyle, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
            {orderedCites.length ? orderedCites.map(({ cite: cl, label }, i) => (
              <span
                key={i}
                onMouseEnter={() => {
                  const referencedStep = getReferencedStep(cl);
                  setHoveredCiteKey(`cite-${line}-${cl}`);
                  setHoveredReferenceTermKey(referencedStep?.elementKind === 'premise' ? null : getReferencePulseTermKey(cl));
                  setHoveredReferencePremiseLine(referencedStep?.elementKind === 'premise' ? referencedStep.line : null);
                }}
                onMouseLeave={() => {
                  setHoveredCiteKey(current => (current === `cite-${line}-${cl}` ? null : current));
                  setHoveredReferenceTermKey(current => (current === getReferencePulseTermKey(cl) ? null : current));
                  setHoveredReferencePremiseLine(current => (current === cl ? null : current));
                }}
                style={getCiteChipStyle(c, `cite-${line}-${cl}`)}
              >
                {label}
              </span>
            )) : <span style={{ ...metaValueStyle, color: 'rgba(255,255,255,0.45)' }}>—</span>}
          </div>
        </div>
      );
    }
    const elementInteractions = bindElementInteractions(step, `row-${line}`);
    const rowHighlightStyle = getActiveRowStyle(step, elementInteractions.active);
    return (
      <div
        key={line}
        onMouseEnter={elementInteractions.onMouseEnter}
        onMouseLeave={elementInteractions.onMouseLeave}
        style={{ display: 'grid', gridTemplateColumns: fullCols, width: '100%', padding: density === 'ultra' ? '4px 0' : density === 'narrow' ? '5px 0' : '6px 0', borderBottom: rowBorderBottom, alignItems: 'center', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
      >
        <span style={{ fontSize: layout.metaFont, fontWeight: 700, color: '#fff', textAlign: 'center', fontFamily: FONT_MONO }}>{line}</span>
        <ProofElementBadge label={step.elementLabel} step={step} fontSize={elementBadgeFontSize} {...elementInteractions} />
        <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_SANS, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere', paddingLeft: columnPad }}>
          {renderStatementWithPredicateColors(plainStatement || statement, statementColorEntries, activePulsingTermKey, pulseEntireReferencedPremise)}
        </span>
        <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_MONO, lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere', ...separatedCellStyle }}>
          {renderNotationWithTruthMarker(statement, statementColorEntries, activePulsingTermKey, pulseEntireReferencedPremise, truthMarker)}
        </span>
        <span style={{ ...separatedCellStyle }}>
          {renderRuleValue(rule, c)}
        </span>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', ...separatedCellStyle }}>
          {orderedCites.map(({ cite: cl, label }, i) => (
            <span
              key={i}
              onMouseEnter={() => {
                const referencedStep = getReferencedStep(cl);
                setHoveredCiteKey(`cite-${line}-${cl}`);
                setHoveredReferenceTermKey(referencedStep?.elementKind === 'premise' ? null : getReferencePulseTermKey(cl));
                setHoveredReferencePremiseLine(referencedStep?.elementKind === 'premise' ? referencedStep.line : null);
              }}
              onMouseLeave={() => {
                setHoveredCiteKey(current => (current === `cite-${line}-${cl}` ? null : current));
                setHoveredReferenceTermKey(current => (current === getReferencePulseTermKey(cl) ? null : current));
                setHoveredReferencePremiseLine(current => (current === cl ? null : current));
              }}
              style={getCiteChipStyle(c, `cite-${line}-${cl}`)}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const verificationSummary = !validEvaluation
    ? 'Truth-table verification is unavailable for this item.'
    : validEvaluation.premModels === 0
      ? 'No premise-compatible models were found for this item.'
      : `Keyed claim ${renderForm(validClaim)} holds in ${validEvaluation.holds} of ${validEvaluation.premModels} premise-compatible model(s).`;
  const verificationVerdict = (() => {
    if (!validEvaluation) {
      return { label: 'Unavailable', tone: '#fbbf24', description: 'Truth-table verification could not be computed.' };
    }
    if (validEvaluation.premModels === 0) {
      return { label: 'No Models', tone: '#fbbf24', description: 'No premise-compatible model exists for this item.' };
    }
    if (validEvaluation.validity === 'valid') {
      return { label: 'Valid', tone: '#34d399', description: 'The keyed claim holds in every premise-compatible model.' };
    }
    if (validEvaluation.validity === 'contradicted') {
      return { label: 'Contradicted', tone: '#f87171', description: 'The keyed claim holds in none of the premise-compatible models.' };
    }
    return { label: 'Contingent', tone: '#fbbf24', description: 'The keyed claim holds in some, but not all, premise-compatible models.' };
  })();
  const truthModelRows = validEvaluation?.models || [];
  const rawTruthModelRows = validEvaluation?.allModels || [];
  const filterSteps = validEvaluation?.filterSteps || [];
  const truthPredicateEntries = [];
  const seenTruthPredicates = new Set();
  draft.predicates.forEach(predicate => {
    if (!predicate?.base || seenTruthPredicates.has(predicate.base)) return;
    seenTruthPredicates.add(predicate.base);
    const color = statementColorEntries.find(entry => entry.key === String(predicate.text || predicate.base).toLowerCase())?.color || '#cbd5e1';
    truthPredicateEntries.push({ base: predicate.base, label: predicate.text || predicate.base, color });
  });
  const counterexampleModel = validEvaluation?.cx || null;
  const counterexampleEntries = counterexampleModel
    ? truthPredicateEntries.filter(entry => counterexampleModel[entry.base] !== undefined)
    : [];
  const truthPredicateKeys = truthPredicateEntries.map(entry => String(entry.label || entry.base).toLowerCase());
  const compatibleModelExplanation = (() => {
    if (!validEvaluation) return 'Compatible-model explanation is unavailable for this item.';
    if (!truthModelRows.length) return 'No assignment satisfies the premises and given fact.';
    const constraintSubject = draft.fact ? 'The premises and given fact' : 'The premises';
    const unconstrained = truthPredicateEntries.filter(entry => {
      const values = new Set(truthModelRows.map(model => model.assignment?.[entry.base]));
      return values.size > 1;
    });
    if (!unconstrained.length) {
      return `${constraintSubject} constrain all predicates uniquely.`;
    }
    const labels = unconstrained.map(entry => `"${entry.label}"`).join(', ');
    return `${constraintSubject} constrain all predicates uniquely except ${labels}.`;
  })();
  const validTruthStatus = (() => {
    if (!validEvaluation) return null;
    if (validEvaluation.premModels === 0) return 'NO COMPATIBLE MODELS';
    if (validEvaluation.validity === 'valid') return 'TRUE in all compatible models';
    if (validEvaluation.validity === 'contradicted') return `FALSE in ${validEvaluation.premModels} compatible model(s)`;
    return `TRUE in ${validEvaluation.holds} of ${validEvaluation.premModels} compatible model(s)`;
  })();
  const presentedTruthStatus = (() => {
    const evaluation = presentedRefutation?.evaluation;
    if (!evaluation) return null;
    if (evaluation.premModels === 0) return 'NO COMPATIBLE MODELS';
    if (evaluation.validity === 'valid') return 'TRUE in all compatible models';
    if (evaluation.validity === 'contradicted') return `FALSE in ${evaluation.premModels} compatible model(s)`;
    return `FALSE in ${evaluation.fails} counterexample model(s)`;
  })();
  const truthTableGridCols = `70px repeat(${truthPredicateEntries.length}, minmax(86px, 1fr)) 96px`;
  const rawTruthTableGridCols = `70px repeat(${truthPredicateEntries.length}, minmax(74px, 1fr)) 86px 86px`;
  const validNotation = validClaim ? renderForm(validClaim) : trace.validConclusion;
  const presentedNotation = presentedClaim ? renderForm(presentedClaim) : trace.presentedConclusion;

  let invaliditySummary = null;
  let invalidityTone = '#f87171';
  if (presentedRefutation) {
    if (presentedRefutation.evaluation.validity === 'contingent' && presentedRefutation.counterexample) {
      invalidityTone = '#e879f9';
      invaliditySummary = `Counterexample: ${presentedRefutation.counterexample.english}.`;
    } else if (presentedRefutation.evaluation.validity === 'contradicted') {
      invaliditySummary = `The premises force ${trace.validConclusion}, which conflicts with the presented conclusion.`;
    } else if (presentedRefutation.evaluation.validity === 'valid') {
      invalidityTone = '#fbbf24';
      invaliditySummary = 'The presented conclusion also holds in every premise-compatible model and should be reviewed.';
    }
  }

  return (
    <div
      style={{
        ...sty.abstract,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: density === 'narrow' ? '12px 12px' : density === 'tight' ? '13px 14px' : '14px 16px',
        fontSize: layout.rowFont,
        overflowX: 'hidden',
      }}
    >
      <style>{`
        @keyframes proofTraceCitePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(167,139,250,0);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 14px rgba(167,139,250,0.35);
          }
        }
        @keyframes proofTraceTermPulse {
          0%, 100% {
            transform: scale(1);
            text-shadow: 0 0 0 rgba(255,255,255,0);
          }
          50% {
            transform: scale(1.08);
            text-shadow: 0 0 10px currentColor;
          }
        }
      `}</style>
      {hoveredRuleCard && createPortal(
        <div
          style={{
            position: 'fixed',
            top: hoveredRuleCard.top,
            left: hoveredRuleCard.left,
            zIndex: 9999,
            width: 280,
            background: 'linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(10,15,26,0.98) 100%)',
            border: `1px solid ${hoveredRuleCard.accent || 'rgba(34,211,238,0.35)'}`,
            borderRadius: 4,
            padding: '12px 14px',
            boxShadow: '0 18px 40px rgba(0,0,0,0.65)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: hoveredRuleCard.accent || '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: FONT_SANS }}>
            {hoveredRuleCard.title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6, fontFamily: FONT_SANS }}>
            {hoveredRuleCard.subtitle}
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.65, fontFamily: FONT_SANS }}>
            {hoveredRuleCard.body}
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, fontFamily: FONT_SANS }}>
            {hoveredRuleCard.note}
          </div>
        </div>,
        document.body
      )}
      <div style={{ display: proofTraceSubtab === 'trace' ? 'block' : 'none' }}>
      <div ref={traceFrameRef} style={{ position: 'relative', width: '100%' }}>
        {isStacked && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${layout.lineWidth}px`,
                width: 1,
                background: dividerColor,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${layout.lineWidth + stackedElementWidth}px`,
                width: 1,
                background: dividerColor,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `calc(100% - ${stackedNotationWidth + stackedRuleWidth + stackedCitesWidth}px)`,
                width: 1,
                background: dividerColor,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `calc(100% - ${stackedRuleWidth + stackedCitesWidth}px)`,
                width: 1,
                background: dividerColor,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `calc(100% - ${stackedCitesWidth}px)`,
                width: 1,
                background: dividerColor,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        {!isStacked && (
          <>
            {fullDividerPositions.map(divider => (
              <React.Fragment key={divider.key}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: divider.left,
                    width: 1,
                    background: dividerColor,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  onMouseDown={startColumnResize(divider.key)}
                  title="Drag to resize column"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: divider.left - 4,
                    width: 8,
                    cursor: 'col-resize',
                    zIndex: 4,
                    background: 'transparent',
                  }}
                />
              </React.Fragment>
            ))}
          </>
        )}

        {headerRow}
        {trace.steps.map(renderStepRow)}

        {/* QED line */}
        {isStacked ? (
          (() => {
            const elementInteractions = bindElementInteractions({ elementKind: 'conclusion' }, 'conclusion');
            const rowHighlightStyle = getActiveRowStyle({ elementKind: 'conclusion' }, elementInteractions.active);
            return (
          <div
            onMouseEnter={elementInteractions.onMouseEnter}
            onMouseLeave={elementInteractions.onMouseLeave}
            style={{ display: 'grid', gridTemplateColumns: stackedCols, width: '100%', padding: '10px 0 4px', borderTop: '2px solid rgba(52,211,153,0.3)', marginTop: 4, alignItems: 'center', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
          >
            <span style={{ fontSize: layout.symbolFont, fontWeight: 800, color: '#f87171', textAlign: 'center', fontFamily: FONT_MONO }}>∴</span>
            <ProofElementBadge label={trace.validElementLabel} step={{ elementKind: 'conclusion' }} fontSize={elementBadgeFontSize} {...elementInteractions} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, paddingLeft: columnPad }}>
              <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_SANS, fontWeight: 600, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>{trace.validConclusion}</span>
            </div>
            <div style={{ ...separatedCellStyle, display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_MONO, fontWeight: 600, lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere' }}>{renderNotationWithTruthMarker(validNotation, statementColorEntries, activePulsingTermKey, false, validTruthStatus)}</span>
            </div>
            <div style={{ ...separatedCellStyle, display: 'flex', alignItems: 'center', minWidth: 0 }}>
              {renderQEDValue(trace.proofStyle, trace.theorem)}
            </div>
            <div style={{ ...separatedCellStyle, display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: layout.symbolFont, color: '#34d399', fontFamily: FONT_MONO }}>✓</span>
            </div>
          </div>
            );
          })()
        ) : (
          (() => {
            const elementInteractions = bindElementInteractions({ elementKind: 'conclusion' }, 'conclusion');
            const rowHighlightStyle = getActiveRowStyle({ elementKind: 'conclusion' }, elementInteractions.active);
            return (
          <div
            onMouseEnter={elementInteractions.onMouseEnter}
            onMouseLeave={elementInteractions.onMouseLeave}
            style={{ display: 'grid', gridTemplateColumns: fullCols, width: '100%', padding: '10px 0 4px', borderTop: '2px solid rgba(52,211,153,0.3)', marginTop: 4, alignItems: 'center', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
          >
            <span style={{ fontSize: layout.symbolFont, fontWeight: 800, color: '#f87171', textAlign: 'center', fontFamily: FONT_MONO }}>∴</span>
            <ProofElementBadge label={trace.validElementLabel} step={{ elementKind: 'conclusion' }} fontSize={elementBadgeFontSize} {...elementInteractions} />
            <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_SANS, fontWeight: 600, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere', paddingLeft: columnPad }}>{trace.validConclusion}</span>
            <span style={{ fontSize: layout.rowFont, color: '#fff', fontFamily: FONT_MONO, fontWeight: 600, lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere', ...separatedCellStyle }}>{renderNotationWithTruthMarker(validNotation, statementColorEntries, activePulsingTermKey, false, validTruthStatus)}</span>
            <span style={{ ...separatedCellStyle }}>
              {renderQEDValue(trace.proofStyle, trace.theorem)}
            </span>
            <span style={{ fontSize: layout.symbolFont, color: '#34d399', textAlign: 'center', ...separatedCellStyle }}>✓</span>
          </div>
            );
          })()
        )}

        {trace.proofStyle === 'equivalence' && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT_MONO }}>
            This template is verified by applying an equivalence or definition, then checking the keyed answer against all premise-compatible models.
          </div>
        )}

        {/* Invalid conclusion callout — binary templates only */}
        {!trace.isMCFormat && !trace.conclusionIsValid && trace.presentedConclusion && (
          isStacked ? (
            (() => {
              const elementInteractions = bindElementInteractions({ elementKind: 'presented' }, 'presented');
              const rowHighlightStyle = getActiveRowStyle({ elementKind: 'presented' }, elementInteractions.active);
              return (
            <div
              onMouseEnter={elementInteractions.onMouseEnter}
              onMouseLeave={elementInteractions.onMouseLeave}
              style={{ display: 'grid', gridTemplateColumns: stackedCols, width: '100%', padding: '8px 0 0', alignItems: 'center', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
            >
              <span style={{ fontSize: layout.symbolFont, fontWeight: 800, color: '#f87171', textAlign: 'right', fontFamily: FONT_MONO }}>✗</span>
              <ProofElementBadge label={trace.presentedElementLabel} step={{ elementKind: 'presented' }} fontSize={elementBadgeFontSize} {...elementInteractions} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, paddingLeft: columnPad }}>
                <span style={{ fontSize: layout.rowFont, color: '#f87171', fontFamily: FONT_SANS, textDecoration: 'line-through', textDecorationColor: 'rgba(248,113,113,0.55)', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>{trace.presentedConclusion}</span>
              </div>
              <span style={{ fontSize: layout.rowFont, color: '#f87171', fontFamily: FONT_MONO, textDecoration: 'line-through', textDecorationColor: 'rgba(248,113,113,0.55)', lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere', ...separatedCellStyle }}>{renderNotationWithTruthMarker(presentedNotation, statementColorEntries, activePulsingTermKey, false, presentedTruthStatus)}</span>
              <span style={{ ...metaValueStyle, color: '#f87171', ...separatedCellStyle }}>Presented — does not follow</span>
              <span style={{ ...separatedCellStyle }} />
            </div>
              );
            })()
          ) : (
            (() => {
              const elementInteractions = bindElementInteractions({ elementKind: 'presented' }, 'presented');
              const rowHighlightStyle = getActiveRowStyle({ elementKind: 'presented' }, elementInteractions.active);
              return (
            <div
              onMouseEnter={elementInteractions.onMouseEnter}
              onMouseLeave={elementInteractions.onMouseLeave}
              style={{ display: 'grid', gridTemplateColumns: fullCols, width: '100%', padding: '8px 0 0', alignItems: 'center', transition: 'background 0.12s ease, box-shadow 0.12s ease', ...rowHighlightStyle }}
            >
              <span style={{ fontSize: layout.symbolFont, fontWeight: 800, color: '#f87171', textAlign: 'right', fontFamily: FONT_MONO }}>✗</span>
              <ProofElementBadge label={trace.presentedElementLabel} step={{ elementKind: 'presented' }} fontSize={elementBadgeFontSize} {...elementInteractions} />
              <span style={{ fontSize: layout.rowFont, color: '#f87171', fontFamily: FONT_SANS, textDecoration: 'line-through', textDecorationColor: 'rgba(248,113,113,0.55)', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere', paddingLeft: columnPad }}>{trace.presentedConclusion}</span>
              <span style={{ fontSize: layout.rowFont, color: '#f87171', fontFamily: FONT_MONO, textDecoration: 'line-through', textDecorationColor: 'rgba(248,113,113,0.55)', lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere', ...separatedCellStyle }}>{renderNotationWithTruthMarker(presentedNotation, statementColorEntries, activePulsingTermKey, false, presentedTruthStatus)}</span>
              <span style={{ fontSize: layout.metaFont, color: '#f87171', fontFamily: FONT_MONO, lineHeight: 1.4, ...separatedCellStyle }}>Presented — does not follow</span>
              <span />
            </div>
              );
            })()
          )
        )}
      </div>

      {/* MC note */}
      {trace.isMCFormat && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: FONT_MONO }}>
          4-option MC — proof establishes the correct answer; test-taker selects it from the options.
        </div>
      )}
      </div>

      <div style={{ display: proofTraceSubtab === 'truth' ? 'block' : 'none' }}>
      <div style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: `1px solid ${verificationVerdict.tone}66`,
            background: `${verificationVerdict.tone}18`,
            color: verificationVerdict.tone,
            borderRadius: 3,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: FONT_MONO,
          }}>
            {verificationVerdict.label}
          </span>
        </div>
        <div style={{
          padding: '8px 10px',
          background: `${verificationVerdict.tone}12`,
          border: `1px solid ${verificationVerdict.tone}33`,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 12, color: '#fff', fontFamily: FONT_MONO }}>
            Keyed claim: {validClaim ? renderForm(validClaim) : 'Unavailable'}
          </div>
          <div style={{ fontSize: 12, color: verificationVerdict.tone, fontFamily: FONT_MONO }}>
            {verificationSummary}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, fontFamily: FONT_SANS }}>
            {verificationVerdict.description}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, fontFamily: FONT_SANS }}>
            {compatibleModelExplanation}
          </div>
          {counterexampleModel && validEvaluation?.validity !== 'valid' && (
            <div style={{
              padding: '8px 10px',
              border: '1px solid rgba(232,121,249,0.35)',
              background: 'rgba(232,121,249,0.09)',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#e879f9', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>
                Counterexample Model
              </div>
              <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.55, fontFamily: FONT_SANS }}>
                This premise-compatible model makes the keyed claim false.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {counterexampleEntries.map(entry => (
                  <span
                    key={entry.base}
                    style={{
                      display: 'inline-flex',
                      gap: 5,
                      alignItems: 'center',
                      padding: '3px 7px',
                      borderRadius: 3,
                      background: 'rgba(10,15,26,0.62)',
                      border: `1px solid ${entry.color}40`,
                      fontSize: 11,
                      fontFamily: FONT_MONO,
                    }}
                  >
                    <span style={{ color: entry.color, fontWeight: 800 }}>{entry.label}</span>
                    <span style={{ color: counterexampleModel[entry.base] ? '#34d399' : '#f87171', fontWeight: 800 }}>
                      {counterexampleModel[entry.base] ? 'T' : 'F'}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {truthModelRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={() => setTruthModelsOpen(open => !open)}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 3,
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: FONT_SANS,
                  letterSpacing: '0.03em',
                }}
              >
                <span>{truthModelsOpen ? 'Hide' : 'Show'} compatible models</span>
                <span style={{ color: verificationVerdict.tone, fontFamily: FONT_MONO }}>{truthModelRows.length}</span>
              </button>
              {truthModelsOpen && (
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: truthTableGridCols,
                    gap: 0,
                    background: 'rgba(255,255,255,0.035)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Model</span>
                    {truthPredicateEntries.map(entry => (
                      <span key={entry.base} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: entry.color, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>
                        {entry.label}
                      </span>
                    ))}
                    <span style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Claim</span>
                  </div>
                  {truthModelRows.map((model, modelIndex) => (
                    <div
                      key={modelIndex}
                      onMouseEnter={() => setHoveredTruthModelKeys(truthPredicateKeys)}
                      onMouseLeave={() => setHoveredTruthModelKeys([])}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: truthTableGridCols,
                        borderBottom: modelIndex === truthModelRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        background: !model.claimHolds ? 'rgba(232,121,249,0.08)' : 'transparent',
                        cursor: 'default',
                      }}
                    >
                      <span style={{ padding: '6px 8px', color: '#fff', fontWeight: 800, fontSize: 11, fontFamily: FONT_MONO }}>M{modelIndex + 1}</span>
                      {truthPredicateEntries.map(entry => {
                        const value = model.assignment?.[entry.base];
                        return (
                          <span key={entry.base} style={{ padding: '6px 8px', fontSize: 11, fontFamily: FONT_MONO, color: value ? '#34d399' : '#f87171', fontWeight: 800 }}>
                            {entry.label} = {value ? 'T' : 'F'}
                          </span>
                        );
                      })}
                      <span style={{ padding: '6px 8px', fontSize: 11, fontFamily: FONT_MONO, color: model.claimHolds ? '#34d399' : '#f87171', fontWeight: 800 }}>
                        {model.claimHolds ? 'TRUE' : 'FALSE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {rawTruthModelRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={() => setRawTruthTableOpen(open => !open)}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(34,211,238,0.05)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(34,211,238,0.18)',
                  borderRadius: 3,
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: FONT_SANS,
                  letterSpacing: '0.03em',
                }}
              >
                <span>{rawTruthTableOpen ? 'Hide' : 'Show'} raw truth table</span>
                <span style={{ color: '#22d3ee', fontFamily: FONT_MONO }}>{rawTruthModelRows.length}</span>
              </button>
              {rawTruthTableOpen && (
                <div style={{ border: '1px solid rgba(34,211,238,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: rawTruthTableGridCols,
                    background: 'rgba(34,211,238,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Model</span>
                    {truthPredicateEntries.map(entry => (
                      <span key={entry.base} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: entry.color, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>
                        {entry.label}
                      </span>
                    ))}
                    <span style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Premises</span>
                    <span style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Claim</span>
                  </div>
                  {rawTruthModelRows.map((model, modelIndex) => (
                    <div
                      key={modelIndex}
                      onMouseEnter={() => setHoveredTruthModelKeys(truthPredicateKeys)}
                      onMouseLeave={() => setHoveredTruthModelKeys([])}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: rawTruthTableGridCols,
                        borderBottom: modelIndex === rawTruthModelRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        background: model.premiseCompatible ? 'rgba(52,211,153,0.055)' : 'transparent',
                        cursor: 'default',
                      }}
                    >
                      <span style={{ padding: '6px 8px', color: '#fff', fontWeight: 800, fontSize: 11, fontFamily: FONT_MONO }}>R{modelIndex + 1}</span>
                      {truthPredicateEntries.map(entry => {
                        const value = model.assignment?.[entry.base];
                        return (
                          <span key={entry.base} style={{ padding: '6px 8px', fontSize: 11, fontFamily: FONT_MONO, color: value ? '#34d399' : '#f87171', fontWeight: 800 }}>
                            {value ? 'T' : 'F'}
                          </span>
                        );
                      })}
                      <span style={{ padding: '6px 8px', fontSize: 11, fontFamily: FONT_MONO, color: model.premiseCompatible ? '#34d399' : '#f87171', fontWeight: 800 }}>
                        {model.premiseCompatible ? 'PASS' : 'FAIL'}
                      </span>
                      <span style={{ padding: '6px 8px', fontSize: 11, fontFamily: FONT_MONO, color: model.claimHolds ? '#34d399' : '#f87171', fontWeight: 800 }}>
                        {model.claimHolds ? 'TRUE' : 'FALSE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {filterSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={() => setFilterStepsOpen(open => !open)}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(251,191,36,0.06)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(251,191,36,0.18)',
                  borderRadius: 3,
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: FONT_SANS,
                  letterSpacing: '0.03em',
                }}
              >
                <span>{filterStepsOpen ? 'Hide' : 'Show'} premise filtering</span>
                <span style={{ color: '#fbbf24', fontFamily: FONT_MONO }}>{filterSteps.length}</span>
              </button>
              {filterStepsOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', border: '1px solid rgba(251,191,36,0.16)', borderRadius: 3, background: 'rgba(251,191,36,0.04)' }}>
                  {filterSteps.map((step, stepIndex) => {
                    const maxModels = Math.max(1, filterSteps[0]?.remaining || 1);
                    const widthPct = Math.max(4, (step.remaining / maxModels) * 100);
                    return (
                      <div key={`${step.label}-${stepIndex}`} style={{ display: 'grid', gridTemplateColumns: '130px minmax(80px, 1fr) 150px', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: stepIndex === 0 ? '#fff' : '#fbbf24', fontSize: 11, fontWeight: 800, fontFamily: FONT_MONO }}>
                          {step.label}
                        </span>
                        <span style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${widthPct}%`, background: stepIndex === 0 ? 'rgba(255,255,255,0.55)' : '#fbbf24' }} />
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontFamily: FONT_MONO }}>
                          {step.remaining} remain · {step.eliminated} removed
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {presentedRefutation && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: invalidityTone, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>
            Invalidity Check
          </div>
          <div style={{
            padding: '8px 10px',
            background: `${invalidityTone}12`,
            border: `1px solid ${invalidityTone}33`,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: 12, color: '#fff', fontFamily: FONT_MONO }}>
              Presented claim: {presentedRefutation.claim_form}
            </div>
            <div style={{ fontSize: 12, color: invalidityTone, fontFamily: FONT_MONO }}>
              {presentedRefutation.evaluation.premModels === 0
                ? 'No premise-compatible models were found for the presented conclusion.'
                : `Presented claim holds in ${presentedRefutation.evaluation.holds} of ${presentedRefutation.evaluation.premModels} premise-compatible model(s).`}
            </div>
            {invaliditySummary && (
              <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>
                {invaliditySummary}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      <div style={{ display: proofTraceSubtab === 'graph' ? 'block' : 'none' }}>
        <SVGGraphRenderer draft={draft} />
      </div>

      <div style={{ display: proofTraceSubtab === 'abstract' ? 'block' : 'none' }}>
        <AbstractFormRenderer abstractForm={draft.abstractForm} />
      </div>

      <div style={{ display: proofTraceSubtab === 'ner' ? 'block' : 'none' }}>
        <NERAnnotationRenderer abstractForm={draft.abstractForm} />
      </div>

      <div style={{ display: proofTraceSubtab === 'checks' ? 'block' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            {validation && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${validation.status === 'ready' ? 'rgba(52,211,153,0.42)' : 'rgba(251,191,36,0.42)'}`,
                background: validation.status === 'ready' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                color: validation.status === 'ready' ? '#34d399' : '#fbbf24',
                borderRadius: 3,
                padding: '4px 9px',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: FONT_MONO,
              }}>
                {validation.status === 'ready' ? 'Ready' : 'Review Recommended'}
              </span>
            )}
          </div>

          {validation ? (
            validation.messages.map((entry, i) => {
              const tone = VALIDATION_LEVEL_STYLES[entry.level] || VALIDATION_LEVEL_STYLES.info;
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: tone.color,
                    padding: '7px 10px',
                    background: tone.background,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 2,
                    lineHeight: 1.55,
                  }}
                >
                  {entry.message}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: '#fbbf24', padding: '7px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.24)', borderRadius: 2, lineHeight: 1.55 }}>
              Logical validity checks are unavailable for this item.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Refutation Trace Renderer ────────────────────────────────────────────────

const REFUTATION_COLORS = {
  premise: '#60a5fa', given: '#fbbf24', claim: '#f87171',
  counterexample: '#e879f9', derived: '#34d399', contradiction: '#f87171',
  verified: '#34d399', scope: '#fbbf24', refuted: '#f87171',
};

function RefutationTraceRenderer({ distractor }) {
  const [open, setOpen] = useState(false);
  const [hoveredTraceLine, setHoveredTraceLine] = useState(null);
  const [hoveredTraceCite, setHoveredTraceCite] = useState(null);
  if (!distractor || !distractor.refutation) return null;

  const ref = distractor.refutation;
  const { trace, evaluation: ev, counterexample: cx, fallacy } = ref;

  const layout = getTraceLayout('compact');
  const traceCols = '30px minmax(0, 1fr) minmax(136px, 190px) minmax(76px, 112px)';
  const cellBorder = '1px solid rgba(255,255,255,0.08)';
  const baseCellStyle = {
    minWidth: 0,
    padding: '7px 10px',
    borderLeft: cellBorder,
  };
  const headerCellStyle = {
    fontSize: layout.headerFont,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    fontFamily: FONT_MONO,
    whiteSpace: 'nowrap',
  };

  const verdictColor = ref.validity === 'valid' ? '#fbbf24'
    : ref.validity === 'contradicted' ? '#f87171' : '#e879f9';
  const verdictLabel = distractor.responseOption
    ? (ref.validity === 'valid' ? 'PRESENTED CLAIM VALID' : ref.validity === 'contradicted' ? 'PRESENTED CLAIM CONTRADICTED' : 'PRESENTED CLAIM CONTINGENT')
    : (ref.validity === 'valid' ? 'VALID (scope error)' : ref.validity === 'contradicted' ? 'CONTRADICTED' : 'CONTINGENT');

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2, padding: '3px 8px', cursor: 'pointer',
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT_SANS,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
      >
        {open ? '▾' : '▸'} {distractor.responseOption ? 'Response Analysis' : 'Refutation Trace'}
      </button>

      {open && (
        <div style={{ ...sty.abstract, padding: '12px 14px', marginTop: 6, fontSize: 13 }}>
          {/* Header: claim form + verdict + truth-table stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {distractor.responseOption ? `Wrong response: ${distractor.responseOption}` : `Claim: ${distractor.claim_form}`}
            </span>
            {distractor.responseOption && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: '#e879f9' }}>
                Presented claim: {distractor.claim_form}
              </span>
            )}
            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${verdictColor}18`, border: `1px solid ${verdictColor}44`, color: verdictColor }}>
              {verdictLabel}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: FONT_MONO }}>
              {ev.premise_models} model(s) · claim holds in {ev.claim_holds_in} · fails in {ev.claim_fails_in}
            </span>
          </div>

          {/* Counterexample callout */}
          {cx && (
            <div style={{ padding: '6px 10px', marginBottom: 10, background: 'rgba(232,121,249,0.06)', border: '1px solid rgba(232,121,249,0.2)', borderRadius: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#e879f9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Counterexample</div>
              <div style={{ fontSize: 12, color: '#fff', fontFamily: FONT_MONO }}>{cx.english}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: FONT_MONO, marginTop: 2 }}>
                This scenario satisfies all premises but falsifies the claim.
              </div>
            </div>
          )}

          {/* Step-by-step trace */}
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: traceCols, width: '100%', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {['#', 'Statement', 'Rule applied', 'References'].map((h, i) => (
                <span
                  key={h}
                  style={{
                    ...headerCellStyle,
                    ...(i === 0
                      ? { padding: '7px 8px', textAlign: 'center', color: '#fff' }
                      : { ...baseCellStyle, textAlign: 'left' }),
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {trace.map(s => {
              const c = REFUTATION_COLORS[s.type] || '#fff';
              const rowActive = hoveredTraceLine === s.line || hoveredTraceCite === s.line;
              return (
                <div
                  key={s.line}
                  onMouseEnter={() => setHoveredTraceLine(s.line)}
                  onMouseLeave={() => setHoveredTraceLine(current => (current === s.line ? null : current))}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: traceCols,
                    width: '100%',
                    borderBottom: s.line === trace[trace.length - 1]?.line ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    alignItems: 'stretch',
                    background: rowActive ? `${c}10` : 'transparent',
                    boxShadow: rowActive ? `inset 0 1px 0 ${c}22, inset 0 -1px 0 ${c}22` : 'none',
                    transition: 'background 0.12s ease, box-shadow 0.12s ease',
                  }}
                >
                  <span style={{ padding: '7px 8px', fontSize: layout.metaFont, fontWeight: 700, color: rowActive ? '#fff' : 'rgba(255,255,255,0.3)', textAlign: 'center', fontFamily: FONT_MONO }}>{s.line}</span>
                  <span style={{ ...baseCellStyle, fontSize: layout.rowFont, color: s.type === 'refuted' ? '#f87171' : '#fff', fontFamily: FONT_MONO, fontWeight: s.type === 'refuted' ? 600 : 400, lineHeight: 1.45, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center' }}>{s.statement}</span>
                  <span style={{ ...baseCellStyle, fontSize: layout.metaFont, color: c, fontFamily: FONT_MONO, lineHeight: 1.4, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center' }}>{s.rule}</span>
                  <div style={{ ...baseCellStyle, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(s.cites || []).length ? (s.cites || []).map((cl, i) => {
                      const chipKey = `refutation-${s.line}-${cl}-${i}`;
                      const chipActive = hoveredTraceCite === cl || hoveredTraceLine === s.line;
                      return (
                        <span
                          key={chipKey}
                          onMouseEnter={() => setHoveredTraceCite(cl)}
                          onMouseLeave={() => setHoveredTraceCite(current => (current === cl ? null : current))}
                          style={{
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: layout.chipFont,
                            fontWeight: 700,
                            background: `${c}22`,
                            border: `1px solid ${c}44`,
                            color: c,
                            fontFamily: FONT_MONO,
                            cursor: 'pointer',
                            animation: chipActive ? 'proofTraceCitePulse 0.9s ease-in-out infinite' : 'none',
                            transformOrigin: 'center',
                            willChange: chipActive ? 'transform, box-shadow' : 'auto',
                          }}
                        >
                          {cl}
                        </span>
                      );
                    }) : <span style={{ fontSize: layout.metaFont, color: 'rgba(255,255,255,0.45)', fontFamily: FONT_MONO }}>—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fallacy classification */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fallacy:</span>
            <span style={{ fontSize: 12, color: '#fff', fontFamily: FONT_MONO }}>{fallacy.name}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>— {fallacy.desc}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Abstract Form Renderer ────────────────────────────────────────────────────

// Per-term color palette — distinct from PREMISE_COLORS (which tracks premise order)
const TERM_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
const TERM_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function AbstractFormRenderer({ abstractForm, fontSize = 18 }) {
  if (!abstractForm) return null;

  // Split into left (premises/rule) and right (conclusion/interpretation)
  let left, right, splitType;
  if (abstractForm.includes(' <=> ')) {
    const idx = abstractForm.indexOf(' <=> ');
    left = abstractForm.slice(0, idx);
    right = abstractForm.slice(idx + 5);
    splitType = 'biconditional';
  } else if (abstractForm.includes(' ; ')) {
    const idx = abstractForm.indexOf(' ; ');
    left = abstractForm.slice(0, idx);
    right = abstractForm.slice(idx + 3);
    splitType = 'inference';
  } else if (abstractForm.includes(' : ')) {
    const idx = abstractForm.indexOf(' : ');
    left = abstractForm.slice(0, idx);
    right = abstractForm.slice(idx + 3);
    splitType = 'interpretation';
  } else {
    left = abstractForm;
    right = null;
    splitType = null;
  }

  // Assign letter + color to each unique predicate base in order of first appearance
  // termMap: base -> { label, color }
  const termMap = new Map();
  let termIdx = 0;
  function assignTerm(base) {
    if (!termMap.has(base)) {
      termMap.set(base, {
        label: TERM_LETTERS[termIdx] ?? String(termIdx + 1),
        color: TERM_COLORS[termIdx % TERM_COLORS.length],
      });
      termIdx++;
    }
    return termMap.get(base);
  }
  function preScan(str) {
    const re = /[a-zA-Z]+/g;
    let m;
    while ((m = re.exec(str)) !== null) assignTerm(m[0]);
  }
  preScan(left);
  if (splitType !== 'interpretation' && right) preScan(right);

  // Detect pivot predicates: bases that appear >1 time in the premises (left) region.
  // In HS chains, these are the shared consequent/antecedent links between premises.
  const leftBaseCounts = new Map();
  { const re = /[a-zA-Z]+/g; let m;
    while ((m = re.exec(left)) !== null)
      leftBaseCounts.set(m[0], (leftBaseCounts.get(m[0]) || 0) + 1); }
  const pivotBases = new Set([...leftBaseCounts.entries()].filter(([, c]) => c > 1).map(([b]) => b));

  // For HS-style left sides: the comma separates individual premise chips (A->B, B->C)
  const leftChips = left.split(', ');

  // Delegate to shared module-level tokenizer
  const tokenize = tokenizeAbstractForm;

  // Render a predicate span with colored text, styled badge label, and optional pivot underline
  function renderPred(base, negated, keyIdx, isPremiseContext) {
    const term = termMap.get(base);
    if (!term) return null;
    const isPivot = isPremiseContext && pivotBases.has(base);
    const { label, color } = term;
    return (
      <span key={keyIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom', lineHeight: 1, margin: '0 2px' }}>
        <span style={{
          fontWeight: isPivot ? 800 : 600,
          textDecoration: isPivot ? 'underline' : 'none',
          textDecorationColor: `${color}70`,
          textUnderlineOffset: '3px',
        }}>
          {negated && <span style={{ color: '#f87171', fontWeight: 700 }}>~</span>}
          <span style={{ color }}>{base}</span>
        </span>
        <span style={{
          fontSize: '0.58em', fontWeight: 700, lineHeight: 1, marginTop: 3,
          color, background: `${color}22`, borderRadius: 3, padding: '0 3px',
        }}>{negated ? `~${label}` : label}</span>
      </span>
    );
  }

  function renderTokens(tokens, isPremiseContext = false) {
    return tokens.map((tok, i) => {
      switch (tok.t) {
        case 'sp':      return <React.Fragment key={i}>{' '}</React.Fragment>;
        case 'cond':    return <span key={i} style={{ color: '#e879f9', margin: '0 4px' }}>→</span>;
        case 'derived': return <span key={i} style={{ color: accent, fontWeight: 700, margin: '0 4px' }}>⇒</span>;
        case 'bicond':  return <span key={i} style={{ color: '#a78bfa', fontWeight: 700, margin: '0 4px' }}>⟺</span>;
        case 'pred':     return renderPred(tok.base, false, i, isPremiseContext);
        case 'neg-pred': return renderPred(tok.base, true,  i, isPremiseContext);
        default: return <span key={i} style={{ color: 'rgba(255,255,255,0.2)' }}>{tok.ch}</span>;
      }
    });
  }

  const splitColor  = splitType === 'biconditional' ? '#a78bfa' : accent;
  const splitSymbol = splitType === 'biconditional' ? '⟺' : '∴';
  const rightBg     = splitType === 'biconditional' ? 'rgba(167,139,250,0.06)' : 'rgba(34,211,238,0.06)';
  const rightBorder = splitType === 'biconditional' ? 'rgba(167,139,250,0.2)'  : 'rgba(34,211,238,0.2)';

  return (
    <div style={{ ...sty.abstract, fontSize, padding: 0, overflow: 'hidden' }}>
      <div>
        <div style={{ padding: '14px 16px' }}>
          {/* Notation row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>

            {/* Left: one chip per premise, connected by › */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {leftChips.map((chip, ci) => (
                <React.Fragment key={ci}>
                  {ci > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13, userSelect: 'none' }}>›</span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 4, padding: '5px 10px',
                  }}>
                    {renderTokens(tokenize(chip), true)}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {right && (
              <>
                {/* Split divider + symbol */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 6px', flexShrink: 0 }}>
                  <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.12)' }} />
                  <span style={{ color: splitColor, fontWeight: 700, fontSize: 18 }}>{splitSymbol}</span>
                  <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.12)' }} />
                </div>

                {/* Right: conclusion chip */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: rightBg, border: `1px solid ${rightBorder}`,
                  borderRadius: 4, padding: '5px 10px',
                }}>
                  {splitType === 'interpretation'
                    ? <span style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>{right}</span>
                    : renderTokens(tokenize(right), false)
                  }
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.045)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: FONT_SANS }}>
            Symbol Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 16px', marginBottom: termMap.size > 0 ? 12 : 0 }}>
            {[
              ['→', 'conditional', '#e879f9'],
              ['⇒', 'derived conclusion', accent],
              ['~', 'negation', '#f87171'],
              splitType === 'biconditional' ? ['⟺', 'equivalence', '#a78bfa'] : ['∴', 'therefore', accent],
            ].map(([symbol, meaning, color]) => (
              <div key={symbol} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0f` }}>
                <span style={{ color, fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO }}>{symbol}</span>
                <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 1.45, fontFamily: FONT_SANS }}>{meaning}</span>
              </div>
            ))}
          </div>
          {termMap.size > 0 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>terms</div>
              {[...termMap.entries()].map(([base, { label, color }]) => (
                <div key={base} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}0f` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}22`, borderRadius: 3, padding: '1px 5px', fontFamily: FONT_MONO, justifySelf: 'start' }}>{label}</span>
                  <span style={{ color, fontSize: 11, lineHeight: 1.45, fontFamily: FONT_MONO }}>{base}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Label with optional InfoTip ───────────────────────────────────────────────

function CtrlLabel({ children, tip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.text, marginBottom: 2 }}>
      {children}
      {tip && <InfoTip content={tip} />}
    </div>
  );
}

// ── Batch Modal ───────────────────────────────────────────────────────────────

function VerbalBatchModal({ open, onClose, settings, showToast }) {
  const [batchCount, setBatchCount] = useState(5);
  const [batchSettings, setBatchSettings] = useState(() => ({ ...settings }));
  const [items, setItems] = useState([]);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [addConfirmOpen, setAddConfirmOpen] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const batchRegenerateBtn = {
    ...sty.btnOut,
    color: '#38bdf8',
    borderColor: 'rgba(56,189,248,0.45)',
    background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(37,99,235,0.08))',
    boxShadow: '0 0 16px rgba(56,189,248,0.12)',
  };

  if (!open) return null;

  const setBatchSetting = (key, value) => {
    setBatchSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'templateId' && (value === 'contraposition' || value === 'necessary-sufficient')) {
        next.includeNegation = false;
      }
      return next;
    });
  };

  const handleCancel = () => {
    if (!items.length) {
      onClose();
      return;
    }
    setCancelConfirmOpen(true);
  };

  const confirmCancel = () => {
    setCancelConfirmOpen(false);
    setItems([]);
    onClose();
  };

  const createBatchItem = (settingsOverride = batchSettings, forcedKey = null) => {
    const isMC = MC_TEMPLATES.includes(settingsOverride.templateId);
    let draft;
    let dist;

    if (isMC) {
      draft = buildConditionalDraft(settingsOverride);
      dist = buildConditionalDistractors(draft, settingsOverride);
      let attempts = 1;
      while (dist.length < 3 && attempts < 10) {
        draft = buildConditionalDraft(settingsOverride);
        dist = buildConditionalDistractors(draft, settingsOverride);
        attempts++;
      }
      draft.answerOptions = shuffle([draft.validConclusion, ...dist.map(d => d.text)]);
    } else {
      [draft] = generateBatch(settingsOverride, 1);
      dist = buildConditionalDistractors(draft, settingsOverride);
    }

    const validation = validateConditionalDraft(draft, settingsOverride, dist);
    const resolvedItem = { ...draft, distractors: dist, bankId: genBankId('verbal') };
    return {
      ...resolvedItem,
      validation,
      formula: buildConditionalFormula(settingsOverride, resolvedItem, { generatedAt: new Date().toISOString() }),
      _key: forcedKey || `vr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
    };
  };

  const generate = () => {
    const count = Math.min(20, Math.max(1, batchCount));
    setItems(Array.from({ length: count }, () => createBatchItem(batchSettings)));
  };

  const handleGenerate = () => {
    if (items.length) {
      setGenerateConfirmOpen(true);
      return;
    }
    generate();
  };

  const confirmGenerate = () => {
    setGenerateConfirmOpen(false);
    generate();
  };

  const setStatus = (key, st) => setItems(prev => prev.map(it => it._key === key ? { ...it, status: st } : it));
  const regenerateItem = key => {
    setItems(prev => prev.map(it => it._key === key ? createBatchItem(batchSettings, key) : it));
  };

  const addAccepted = () => {
    const acc = items.filter(it => it.status === 'accepted');
    if (!acc.length) { showToast('No accepted items'); return; }
    appendToBank(acc.map(it => {
      return makeBankItem({
        id: it.bankId || genBankId('verbal'), name: `Verbal ${it.templateName}`,
        stem: it.premises.map(p => p.text).join(' ') + ' ' + (it.fact || '') + (it.isMCFormat ? '' : ' Conclusion: ' + it.conclusion),
        generatedBy: 'verbal-reasoning', constructId: 'verbal-reasoning', responseFormat: 'mc',
        responseOptions: it.answerOptions || ['Must follow', 'Cannot follow'],
        generatorMeta: {
          templateId: it.templateId,
          templateName: it.templateName,
          subject: it.subject,
          chainLength: it.chainLength,
          conclusionIsValid: it.conclusionIsValid,
          abstractForm: it.abstractForm,
          validationStatus: it.validation?.status || null,
          formula: it.formula || null,
        },
      });
    }));
    setItems(prev => prev.filter(it => it.status === 'pending'));
    showToast(`Added ${acc.length} item${acc.length !== 1 ? 's' : ''} to bank`);
  };

  const acceptedCount = items.filter(it => it.status === 'accepted').length;
  const hasAccepted = acceptedCount > 0;
  const confirmAddAccepted = () => {
    setAddConfirmOpen(false);
    addAccepted();
  };
  const batchTemplate = CONDITIONAL_TEMPLATES.find(t => t.id === batchSettings.templateId);
  const batchIsMC = MC_TEMPLATES.includes(batchSettings.templateId);
  const batchNegationDisabled = batchSettings.templateId === 'contraposition' || batchSettings.templateId === 'necessary-sufficient';
  const cancelButtonStyle = {
    ...sty.btnOut,
    color: '#f87171',
    borderColor: 'rgba(248,113,113,0.5)',
    background: 'rgba(248,113,113,0.08)',
  };
  const batchOptionButton = (active, color = accent) => ({
    ...sty.btnOut,
    justifyContent: 'center',
    padding: '8px 10px',
    flex: '1 1 0',
    minWidth: 0,
    color: active ? color : colors.textMuted,
    borderColor: active ? `${color}88` : 'rgba(255,255,255,0.1)',
    background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
  });

  return (
    <div style={sty.modalOverlay}>
      <div style={{ ...sty.modalCard, width: 'min(1180px, 100%)', flexDirection: 'row' }}>
        <div style={{ order: 1, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={sty.modalHeader}>
            <div>
              <h3 style={sty.modalTitle}>Batch Generate Verbal Items</h3>
              <p style={sty.modalSubtitle}>Generate multiple items, review each one, then add the best to the item bank.</p>
            </div>
          </div>

          {/* Item list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.length > 0 ? items.map((it, idx) => {
              const validityColor = it.conclusionIsValid ? '#38bdf8' : '#f87171';
              const borderAccent = it.status === 'accepted' ? colors.success : it.status === 'rejected' ? colors.error : C_VRB.border;
              return (
                <div key={it._key} style={{
                  background: C_VRB.card, borderRadius: 6,
                  border: `1px solid ${C_VRB.border}`,
                  borderLeft: `3px solid ${borderAccent}`,
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, fontWeight: 900, fontFamily: FONT_MONO, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, padding: '4px 8px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(74,222,128,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.16)' }}>
                    ID {it.bankId || 'pending'}
                  </div>
                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>#{idx + 1}</span>
                    <span style={pill(accent)}>{it.templateName}</span>
                    {it.chainLength > 1 && <span style={{ fontSize: 11, color: colors.textMuted }}>chain {it.chainLength}</span>}
                    {it.isMCFormat
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>4-option MC</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: validityColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{it.conclusionIsValid ? 'Valid' : 'Invalid'}</span>
                    }
                  </div>

                  {/* Premises */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {it.premises.map((p, i) => {
                      const c = PREMISE_COLORS[i % PREMISE_COLORS.length];
                      return (
                        <div key={i} style={{ fontSize: 13, color: colors.text, paddingLeft: 8, borderLeft: `2px solid ${c}` }}>
                          <strong style={{ color: c, fontSize: 11 }}>Premise {i + 1} </strong>{p.text}
                        </div>
                      );
                    })}
                  </div>

                  {it.fact && (
                    <div style={{ fontSize: 13, color: colors.text, paddingLeft: 8, borderLeft: '2px solid #fbbf24' }}>
                      <strong style={{ color: '#fbbf24', fontSize: 11 }}>Given Fact </strong>{it.fact}
                    </div>
                  )}

                  {it.isMCFormat ? (
                    /* MC options */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {it.answerOptions?.map((o, i) => {
                        const isCorrect = o === it.correctAnswer;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 13, color: isCorrect ? colors.text : colors.textMuted, padding: '4px 0' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: isCorrect ? accent : colors.textMuted, flexShrink: 0, width: 14 }}>{'ABCD'[i]}</span>
                            <span style={{ borderLeft: `2px solid ${isCorrect ? accent : 'rgba(255,255,255,0.1)'}`, paddingLeft: 7 }}>{o}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Binary conclusion */
                    <div style={{ fontSize: 13, color: colors.text, padding: '6px 10px', borderRadius: 4, background: `${validityColor}12`, border: `1px solid ${validityColor}30` }}>
                      <strong style={{ color: validityColor, fontSize: 11 }}>Conclusion </strong>{it.conclusion}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...sty.btnBank, padding: '4px 14px', fontSize: 11, opacity: it.status === 'accepted' ? 1 : 0.55 }}
                      onClick={() => setStatus(it._key, it.status === 'accepted' ? 'pending' : 'accepted')}
                    >
                      {it.status === 'accepted' ? '✓ Accepted' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      style={{ ...batchRegenerateBtn, padding: '4px 14px', fontSize: 11 }}
                      onClick={() => regenerateItem(it._key)}
                      title={`Regenerate item ${idx + 1}`}
                      aria-label={`Regenerate item ${idx + 1}`}
                    >
                      Regenerate
                    </button>
                    <button
                      style={{ ...sty.btnOut, padding: '4px 14px', fontSize: 11, color: colors.error, borderColor: colors.error, opacity: it.status === 'rejected' ? 1 : 0.55 }}
                      onClick={() => setStatus(it._key, it.status === 'rejected' ? 'pending' : 'rejected')}
                    >
                      {it.status === 'rejected' ? '✗ Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div style={{ background: C_VRB.card, border: `1px solid ${C_VRB.border}`, borderRadius: 6, padding: 36, textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>
                Configure the batch, then click <strong style={{ color: colors.text }}>Generate</strong> to preview items here.
              </div>
            )}
          </div>
        </div>

        {/* Configuration panel */}
        <div style={{ order: 0, width: 300, flexShrink: 0, borderRight: `1px solid ${C_VRB.sep}`, display: 'flex', flexDirection: 'column', background: 'rgba(15,23,42,0.42)' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C_VRB.sep}` }}>
            <h4 style={{ ...sty.modalTitle, fontSize: 14 }}>Batch Configuration</h4>
            <p style={sty.modalSubtitle}>These settings apply only to items generated from this modal.</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={sty.label}>Model</div>
              <select
                value={batchSettings.templateId}
                onChange={e => setBatchSetting('templateId', e.target.value)}
                style={sty.sel}
              >
                {CONDITIONAL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {batchTemplate && (
                <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 6 }}>
                  {batchTemplate.description}{batchTemplate.description.endsWith('.') ? '' : '.'}
                </div>
              )}
            </div>

            <div>
              <div style={sty.label}>Count</div>
              <input
                type="number"
                min={1}
                max={20}
                value={batchCount}
                onChange={e => setBatchCount(Number(e.target.value))}
                style={{ ...sty.sel, width: 84 }}
              />
              <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 5 }}>Up to 20 items per batch.</div>
            </div>

            {batchSettings.templateId === 'hypothetical-syllogism' && (
              <div>
                <div style={sty.label}>Chain Length</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBatchSetting('chainLength', n)}
                      style={batchOptionButton(batchSettings.chainLength === n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 6 }}>{TIPS.chainOptions[batchSettings.chainLength]}</div>
              </div>
            )}

            {!batchIsMC && (
              <div>
                <div style={sty.label}>Conclusion</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['valid', 'Valid', '#38bdf8'], ['invalid', 'Invalid', '#f87171']].map(([val, label, color]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBatchSetting('conclusionValidity', val)}
                      style={batchOptionButton(batchSettings.conclusionValidity === val, color)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 6 }}>
                  {TIPS.conclusionOptions[batchSettings.conclusionValidity]}
                </div>
              </div>
            )}

            {batchIsMC && (
              <div>
                <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, borderLeft: `2px solid rgba(34,211,238,0.2)`, paddingLeft: 8 }}>
                  This model uses a 4-option multiple-choice format. The valid conclusion is mixed with distractors.
                </div>
              </div>
            )}

            {batchIsMC && (
              <div>
                <div style={sty.label}>Distractor Style</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[['mixed', 'Mixed'], ['classic-fallacies', 'Classic Fallacies'], ['near-miss', 'Near-Miss']].map(([val, label]) => {
                    const active = batchSettings.distractorStyle === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBatchSetting('distractorStyle', val)}
                        style={{ ...sty.btnOut, justifyContent: 'flex-start', color: active ? accent : colors.textMuted, borderColor: active ? 'rgba(34,211,238,0.45)' : 'rgba(255,255,255,0.1)', background: active ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)' }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 6 }}>
                  {TIPS.distractorOptions[batchSettings.distractorStyle]}
                </div>
              </div>
            )}

            <div style={{ opacity: batchNegationDisabled ? 0.45 : 1 }}>
              <label style={{ ...sty.row, cursor: batchNegationDisabled ? 'not-allowed' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={batchSettings.includeNegation}
                  onChange={e => setBatchSetting('includeNegation', e.target.checked)}
                  disabled={batchNegationDisabled}
                  style={{ accentColor: accent }}
                />
                <span style={{ fontSize: 13 }}>Include Negation</span>
              </label>
              <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5, marginTop: 6 }}>
                {batchNegationDisabled
                  ? 'Disabled for this model to keep the target inference unambiguous.'
                  : TIPS.negation}
              </div>
            </div>

          </div>

          {/* Action buttons */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C_VRB.sep}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" style={{ ...sty.btn, justifyContent: 'center' }} onClick={handleGenerate}>Generate</button>
            <button type="button" style={{ ...cancelButtonStyle, justifyContent: 'center' }} onClick={handleCancel}>Cancel</button>
            <button
              type="button"
              style={{ ...sty.btnBank, justifyContent: 'center', opacity: hasAccepted ? 1 : 0.45, cursor: hasAccepted ? 'pointer' : 'not-allowed' }}
              disabled={!hasAccepted}
              onClick={() => setAddConfirmOpen(true)}
            >
              Add Accepted ({acceptedCount}) to Bank
            </button>
          </div>
        </div>

        {addConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: 'min(480px, 100%)', border: '1px solid rgba(34,197,94,0.42)', borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 10 }}>Confirm add to bank</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 10 }}>Add accepted items?</div>
              <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.65 }}>
                This will add {acceptedCount} accepted verbal item{acceptedCount === 1 ? '' : 's'} to the item bank and remove them from this batch review list.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setAddConfirmOpen(false)} style={sty.btnOut}>Review More</button>
                <button type="button" onClick={confirmAddAccepted} style={{ ...sty.btnBank, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add {acceptedCount} to Bank</button>
              </div>
            </div>
          </div>
        )}
        {generateConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: 'min(500px, 100%)', border: '1px solid rgba(251,191,36,0.34)', borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1a1620 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(251,191,36,0.12)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 10 }}>Replace generated batch?</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 10 }}>Generate a new verbal batch?</div>
              <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.65 }}>
                Generating again will delete the {items.length} item{items.length === 1 ? '' : 's'} already shown in this batch list. If you want to keep any of them, add them to the item bank first.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setGenerateConfirmOpen(false)} style={sty.btnOut}>Keep Current Batch</button>
                <button type="button" onClick={confirmGenerate} style={{ ...sty.btn, boxShadow: '0 0 24px rgba(251,191,36,0.18)' }}>Generate New Batch</button>
              </div>
            </div>
          </div>
        )}
        {cancelConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: 'min(460px, 100%)', border: '1px solid rgba(248,113,113,0.34)', borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1f1118 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(248,113,113,0.12)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#f87171', marginBottom: 10 }}>Discard generated batch?</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 10 }}>Close batch generator</div>
              <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.65 }}>
                This will clear {items.length} generated item{items.length === 1 ? '' : 's'} from the batch list. This cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setCancelConfirmOpen(false)} style={sty.btnOut}>Keep Working</button>
                <button type="button" onClick={confirmCancel} style={cancelButtonStyle}>Discard Items</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main generator ────────────────────────────────────────────────────────────

export default function VerbalReasoningGenerator() {
  const [settings, setSettings] = useState({ ...DEFAULT_CONDITIONAL_SETTINGS });
  const [previewFormula, setPreviewFormula] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [singleAddConfirmOpen, setSingleAddConfirmOpen] = useState(false);
  const [fallaciesOpen, setFallaciesOpen] = useState(false);
  const [itemPreviewOpen, setItemPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('proof');
  const [proofTraceSubtab, setProofTraceSubtab] = useState('trace');
  const [exportFormat, setExportFormat] = useState('json');
  const [toast, setToast] = useState(null);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const rightPaneRef = useRef(null);
  const [rightPaneWidth, setRightPaneWidth] = useState(0);
  const [linkedElementKey, setLinkedElementKey] = useState(null);

  const set = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const tmpl = CONDITIONAL_TEMPLATES.find(t => t.id === settings.templateId);
  const negationDisabled = settings.templateId === 'contraposition' || settings.templateId === 'necessary-sufficient';
  const contentWidth = rightPaneWidth || viewportWidth;
  const isCompactShell = contentWidth < 1320;
  const isTightLayout = contentWidth < 1080;
  const isNarrowLayout = contentWidth < 900;
  const isUltraLayout = contentWidth < 760;
  const density = isUltraLayout ? 'ultra' : isNarrowLayout ? 'narrow' : isTightLayout ? 'tight' : isCompactShell ? 'compact' : 'full';
  const leftPaneWidth = isNarrowLayout ? 272 : isTightLayout ? 300 : isCompactShell ? 328 : 360;
  const controlsRailWidth = isNarrowLayout ? 22 : 26;
  const previewRailCols = isUltraLayout
    ? '110px minmax(0,1fr)'
    : isNarrowLayout
      ? '116px minmax(0,1fr)'
      : isTightLayout
        ? '120px minmax(0,1fr)'
        : '124px minmax(0,1fr)';
  const questionCols = isUltraLayout
    ? '1fr'
    : isNarrowLayout
      ? '1fr'
      : isTightLayout
        ? '84px minmax(0,1fr)'
        : '120px minmax(0,1fr)';
  const previewTextSize = 15;
  const previewLabelFontSize = 11;
  const tabLabelSize = 11;
  const topPaneHeight = isUltraLayout ? 356 : isNarrowLayout ? 372 : isTightLayout ? 388 : 400;
  const sectionPad = isUltraLayout ? '10px 10px' : isNarrowLayout ? '12px 12px' : isTightLayout ? '13px 14px' : sty.section.padding;
  const preview = useMemo(() => getConditionalItemFromFormula(previewFormula), [previewFormula]);
  const previewSettings = useMemo(() => getConditionalSettingsFromFormula(previewFormula) || settings, [previewFormula, settings]);
  const previewDist = useMemo(() => preview?.distractors || [], [preview]);
  const previewValid = useMemo(
    () => (preview ? validateConditionalDraft(preview, previewSettings, previewDist) : null),
    [preview, previewSettings, previewDist]
  );
  const displayQuestionPrompt = preview?.questionPrompt?.replace(/observed fact/gi, 'given fact');

  const bindLinkedElementHover = (key) => ({
    onMouseEnter: () => setLinkedElementKey(key),
    onMouseLeave: () => setLinkedElementKey(current => (current === key ? null : current)),
  });

  const getLinkedPreviewStyles = (step, active) => {
    const theme = getProofElementTheme(step);
    return {
      rail: {
        background: active ? theme.background : 'transparent',
        borderLeft: `3px solid ${theme.color}`,
        borderRight: `1px solid ${active ? theme.border : 'rgba(255,255,255,0.08)'}`,
      },
      body: {
        background: active ? theme.background : 'transparent',
        border: `1px solid ${active ? theme.border : 'rgba(255,255,255,0.08)'}`,
        borderLeft: 'none',
        transition: 'background 0.12s ease, border-color 0.12s ease',
      },
    };
  };

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const node = rightPaneRef.current;
    if (!node) return;
    const updateWidth = () => setRightPaneWidth(node.getBoundingClientRect().width);
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, [controlsHidden]);

  useEffect(() => {
    if (!itemPreviewOpen) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') setItemPreviewOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [itemPreviewOpen]);

  const generateOne = () => {
    let draft = buildConditionalDraft(settings);
    let dist = buildConditionalDistractors(draft, settings);

    if (draft.isMCFormat) {
      // MC templates need 3 distractors to fill 4 options; retry up to 10 times
      let attempts = 1;
      while (dist.length < 3 && attempts < 10) {
        draft = buildConditionalDraft(settings);
        dist = buildConditionalDistractors(draft, settings);
        attempts++;
      }
      draft.answerOptions = shuffle([draft.validConclusion, ...dist.map(d => d.text)]);
    }

    const resolvedItem = {
      ...draft,
      distractors: dist,
      bankId: genBankId('verbal'),
    };
    setPreviewFormula(buildConditionalFormula(settings, resolvedItem, { generatedAt: new Date().toISOString() }));
  };

  const addPreviewToBank = () => {
    if (!preview) {
      showToast('Generate an item first');
      return;
    }
    setSingleAddConfirmOpen(true);
  };

  const confirmAddPreviewToBank = () => {
    if (!preview) {
      setSingleAddConfirmOpen(false);
      showToast('Generate an item first');
      return;
    }
    appendToBank([
      makeBankItem({
        id: preview.bankId || genBankId('verbal'),
        name: `Verbal ${preview.templateName}`,
        stem: preview.premises.map(p => p.text).join(' ') + ' ' + (preview.fact || '') + (preview.isMCFormat ? '' : ' Conclusion: ' + preview.conclusion),
        generatedBy: 'verbal-reasoning',
        constructId: 'verbal-reasoning',
        responseFormat: 'mc',
        responseOptions: preview.answerOptions || ['Must follow', 'Cannot follow'],
        generatorMeta: {
          templateId: preview.templateId,
          templateName: preview.templateName,
          subject: preview.subject,
          chainLength: preview.chainLength,
          conclusionIsValid: preview.conclusionIsValid,
          abstractForm: preview.abstractForm,
          validationStatus: previewValid?.status || null,
          formula: previewFormula,
        },
      }),
    ]);
    setSingleAddConfirmOpen(false);
    setPreviewFormula(prev => (
      prev
        ? {
            ...prev,
            resolvedItem: {
              ...prev.resolvedItem,
              bankId: genBankId('verbal'),
            },
          }
        : prev
    ));
    showToast('Added item to bank');
  };


  return (
    <div style={sty.container}>
      <div style={sty.contentRow}>
      <div style={{
        flex: `0 0 ${controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth}px`,
        minWidth: controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth,
        display: 'flex',
        minHeight: 0,
        transition: 'flex-basis 0.18s ease, min-width 0.18s ease',
      }}>
      {!controlsHidden && (
      <div style={{ ...sty.left, flex: `0 0 ${leftPaneWidth}px`, minWidth: leftPaneWidth, padding: isNarrowLayout ? '10px 10px 16px 12px' : isTightLayout ? '11px 10px 18px 14px' : sty.left.padding, borderRight: 'none' }}>
        <div style={{ ...sty.section, marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <h4 style={{ ...sty.title, marginBottom: 0 }}>Template</h4>
            <InfoTip content={TIPS.template} />
            <button
              onClick={() => setFallaciesOpen(true)}
              title="Classic fallacies reference"
              style={{
                marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(34,211,238,0.06)', border: `1px solid rgba(34,211,238,0.25)`,
                borderRadius: 2, padding: '3px 8px', cursor: 'pointer',
                fontSize: 10, fontWeight: 700, color: 'rgba(34,211,238,0.55)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.14)'; e.currentTarget.style.color = accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.06)'; e.currentTarget.style.color = 'rgba(34,211,238,0.55)'; }}
            >
              ⚡ Fallacies
            </button>
          </div>
          <select
            value={settings.templateId}
            onChange={e => {
              const templateId = e.target.value;
              setSettings(prev => ({
                ...prev,
                templateId,
                includeNegation: (templateId === 'contraposition' || templateId === 'necessary-sufficient')
                  ? false
                  : prev.includeNegation,
              }));
            }}
            style={sty.sel}
          >
            {CONDITIONAL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {/* Per-template description with its own InfoTip */}
          {tmpl && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              <div style={{ fontSize: 12, color: colors.text, flex: 1, lineHeight: 1.5, height: '3em', overflow: 'hidden' }}>
                {tmpl.description}{tmpl.description.endsWith('.') ? '' : '.'}
              </div>
              <InfoTip content={TIPS.templateOptions[tmpl.id]} />
            </div>
          )}
        </div>

        <div style={sty.section}>
          <h4 style={sty.title}>Settings</h4>
          {settings.templateId === 'hypothetical-syllogism' && (
            <>
              <CtrlLabel tip={TIPS.chainLength}>Chain Length</CtrlLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => set('chainLength', n)}
                    style={{
                      width: 40, height: 40, borderRadius: 2, border: `1px solid`,
                      borderColor: settings.chainLength === n ? accent : 'rgba(34,211,238,0.2)',
                      background: settings.chainLength === n ? 'rgba(34,211,238,0.12)' : '#111827',
                      color: settings.chainLength === n ? accent : colors.textMuted,
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS,
                      transition: 'all 0.12s',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{
                fontSize: 11, color: colors.text, lineHeight: 1.5,
                height: '3em', overflow: 'hidden',
                borderLeft: `2px solid rgba(34,211,238,0.2)`,
                paddingLeft: 8, marginTop: 4,
              }}>
                {TIPS.chainOptions[settings.chainLength]}
              </div>
            </>
          )}

          {!MC_TEMPLATES.includes(settings.templateId) && (
            <>
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.07)`, margin: '4px 0' }} />

              <CtrlLabel tip={TIPS.conclusion}>Conclusion</CtrlLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[['valid', 'Valid', '#38bdf8'], ['invalid', 'Invalid', '#f87171']].map(([val, label, color]) => {
                  const active = settings.conclusionValidity === val;
                  return (
                    <div
                      key={val}
                      onClick={() => set('conclusionValidity', val)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer',
                        color: active ? color : colors.textMuted,
                        fontWeight: active ? 600 : 400,
                        transition: 'color 0.12s',
                      }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: active ? color : 'transparent',
                        border: `1px solid ${active ? color : 'rgba(34,211,238,0.2)'}`,
                        transition: 'all 0.12s',
                      }} />
                      {label}
                    </div>
                  );
                })}
              </div>
              <div style={{
                fontSize: 11, color: colors.text, lineHeight: 1.5,
                height: '3em', overflow: 'hidden',
                borderLeft: `2px solid rgba(34,211,238,0.2)`,
                paddingLeft: 8, marginTop: 4,
              }}>
                {TIPS.conclusionOptions[settings.conclusionValidity]}
              </div>
            </>
          )}

          {MC_TEMPLATES.includes(settings.templateId) && (
            <>
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.07)`, margin: '4px 0' }} />
              <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5, borderLeft: `2px solid rgba(34,211,238,0.2)`, paddingLeft: 8 }}>
                This template uses a 4-option multiple choice format. The correct answer is always the valid conclusion, presented among three distractors in random order.
              </div>
            </>
          )}

          {MC_TEMPLATES.includes(settings.templateId) && (
            <>
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.07)`, margin: '4px 0' }} />

              <CtrlLabel tip={TIPS.distractorStyle}>Distractor Style</CtrlLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[['mixed', 'Mixed'], ['classic-fallacies', 'Classic Fallacies'], ['near-miss', 'Near-Miss']].map(([val, label]) => {
                  const active = settings.distractorStyle === val;
                  return (
                    <div
                      key={val}
                      onClick={() => set('distractorStyle', val)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer',
                        color: active ? accent : colors.textMuted,
                        fontWeight: active ? 600 : 400,
                        transition: 'color 0.12s',
                      }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: active ? accent : 'transparent',
                        border: `1px solid ${active ? accent : 'rgba(34,211,238,0.2)'}`,
                        transition: 'all 0.12s',
                      }} />
                      {label}
                    </div>
                  );
                })}
              </div>
              <div style={{
                fontSize: 11, color: colors.text, lineHeight: 1.5,
                height: '3em', overflow: 'hidden',
                borderLeft: `2px solid rgba(34,211,238,0.2)`,
                paddingLeft: 8, marginTop: 4,
              }}>
                {TIPS.distractorOptions[settings.distractorStyle]}
              </div>
            </>
          )}

          <div style={{ borderTop: `1px solid rgba(255,255,255,0.07)`, margin: '4px 0' }} />

          <div style={{ ...sty.row, opacity: negationDisabled ? 0.4 : 1 }}>
            <input type="checkbox" checked={settings.includeNegation} onChange={e => set('includeNegation', e.target.checked)} style={{ accentColor: accent }} id="neg" disabled={negationDisabled} />
            <label htmlFor="neg" style={{ fontSize: 13, cursor: negationDisabled ? 'not-allowed' : 'pointer' }}>Include Negation</label>
            <InfoTip content={TIPS.negation} />
          </div>
          {negationDisabled && (
            <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5, paddingLeft: 2 }}>
              {settings.templateId === 'contraposition'
                ? 'Disabled for Contraposition — extra negation would blur the polarity swap the template is meant to test.'
                : 'Disabled for Necessary vs. Sufficient — negated predicates produce grammatically ambiguous phrasing.'}
            </div>
          )}

        </div>

      </div>
      )}

      <div style={{
        flex: `0 0 ${controlsRailWidth}px`,
        minWidth: controlsRailWidth,
        borderRight: `1px solid ${C_VRB.sep}`,
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 12,
      }}>
        <button
          type="button"
          onClick={() => setControlsHidden(value => !value)}
          title={controlsHidden ? 'Show controls' : 'Hide controls'}
          aria-label={controlsHidden ? 'Show controls' : 'Hide controls'}
          style={{
            width: controlsRailWidth - 6,
            height: 34,
            borderRadius: 2,
            border: '1px solid rgba(34,211,238,0.22)',
            background: controlsHidden ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
            color: controlsHidden ? accent : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
          }}
        >
          {controlsHidden ? '»' : '«'}
        </button>
      </div>
      </div>

      <div ref={rightPaneRef} style={{ ...sty.right, padding: 0, gap: 0, overflowY: 'hidden' }}>
        {/* ─── Top pane: item elements + question + response options (fixed) ─── */}
        <div style={{ flex: '0 0 auto', height: topPaneHeight, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: isUltraLayout ? 4 : isNarrowLayout ? 6 : 8, padding: isUltraLayout ? '8px 10px' : isNarrowLayout ? '10px 12px' : isTightLayout ? '11px 14px' : '12px 16px', borderBottom: `1px solid ${C_VRB.sep}` }}>
          {preview ? (<>
            {/* Box 1: Premises, Given Fact, Conclusion */}
            <div style={{ ...sty.section, padding: sectionPad }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <h4 style={{ ...sty.title, marginBottom: 0 }}>Elements of Item</h4>
                <button
                  type="button"
                  onClick={() => setItemPreviewOpen(true)}
                  style={{
                    ...sty.btnOut,
                    padding: isUltraLayout ? '4px 8px' : '5px 10px',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    flexShrink: 0,
                  }}
                >
                  Item Preview
                </button>
              </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {preview.premises.map((p, i) => {
                  const c = PREMISE_COLORS[i % PREMISE_COLORS.length];
                  const previewStep = { elementKind: 'premise', premiseIndex: i };
                  const active = linkedElementKey === `premise-${i}`;
                  const linkedStyles = getLinkedPreviewStyles(previewStep, active);
                  const hoverBindings = bindLinkedElementHover(`premise-${i}`);
                  return (
                    <div key={i} {...hoverBindings} style={{ display: 'grid', gridTemplateColumns: previewRailCols, gap: 0, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ ...linkedStyles.rail, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', display: 'flex', alignItems: 'center', transition: 'background 0.12s ease, border-color 0.12s ease' }}>
                        <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: c, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>Premise {i + 1}</span>
                      </div>
                      <div style={{ ...sty.premise, ...linkedStyles.body, marginBottom: 0, borderRadius: 0, fontSize: previewTextSize, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {p.text}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 4 }} />
                {preview.fact && (['contraposition', 'necessary-sufficient'].includes(preview.templateId)
                  ? <div style={{ display: 'grid', gridTemplateColumns: previewRailCols, gap: 0, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid rgba(255,255,255,0.15)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>Note</span>
                      </div>
                      <div style={{ fontSize: previewTextSize, lineHeight: 1.4, color: colors.text, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', background: 'rgba(255,255,255,0.03)', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {preview.fact}
                      </div>
                    </div>
                  : (() => {
                      const active = linkedElementKey === 'given';
                      const linkedStyles = getLinkedPreviewStyles({ elementKind: 'given' }, active);
                      const hoverBindings = bindLinkedElementHover('given');
                      return (
                    <div {...hoverBindings} style={{ display: 'grid', gridTemplateColumns: previewRailCols, gap: 0, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ ...linkedStyles.rail, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', display: 'flex', alignItems: 'center', transition: 'background 0.12s ease, border-color 0.12s ease' }}>
                      <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>Given Fact</span>
                      </div>
                      <div style={{ ...linkedStyles.body, fontSize: previewTextSize, lineHeight: 1.4, color: colors.text, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {preview.fact}
                      </div>
                    </div>
                      );
                    })()
                )}
                {!preview.isMCFormat && (
                  <>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }} />
                    {(() => {
                      const active = linkedElementKey === 'conclusion';
                      const linkedStyles = getLinkedPreviewStyles({ elementKind: 'conclusion' }, active);
                      const hoverBindings = bindLinkedElementHover('conclusion');
                      return (
                    <div {...hoverBindings} style={{ display: 'grid', gridTemplateColumns: previewRailCols, gap: 0, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ ...linkedStyles.rail, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', display: 'flex', alignItems: 'center', transition: 'background 0.12s ease, border-color 0.12s ease' }}>
                        <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>Conclusion</span>
                      </div>
                      <div style={{ ...sty.conclusion, ...linkedStyles.body, borderRadius: 0, fontSize: previewTextSize, padding: isUltraLayout ? '4px 6px' : isNarrowLayout ? '5px 8px' : '5px 10px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {preview.conclusion}
                      </div>
                    </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Box 2: Question */}
            <div style={{ ...sty.section, padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: questionCols, width: '100%', minWidth: 0 }}>
                {/* Left label column */}
                <div style={{ background: 'rgba(34,211,238,0.06)', borderRight: isNarrowLayout ? 'none' : '1px solid rgba(34,211,238,0.15)', borderBottom: isNarrowLayout ? '1px solid rgba(34,211,238,0.15)' : 'none', padding: isUltraLayout ? '8px 10px' : isNarrowLayout ? '10px 12px' : '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: 'rgba(34,211,238,0.68)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Question</span>
                </div>
                {/* Right content — centered */}
                <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: isUltraLayout ? '8px 10px' : isNarrowLayout ? '10px 12px' : '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isUltraLayout ? 5 : isNarrowLayout ? 6 : 8 }}>
                  <div style={{ width: '100%', fontSize: previewTextSize, color: colors.text, lineHeight: 1.5, textAlign: 'center', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{displayQuestionPrompt}</div>
                </div>
              </div>
            </div>

            {/* Box 3: Response options */}
            <div style={{ ...sty.section, padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: questionCols, width: '100%', minWidth: 0 }}>
                <div style={{ background: 'rgba(34,211,238,0.06)', borderRight: isNarrowLayout ? 'none' : '1px solid rgba(34,211,238,0.15)', borderBottom: isNarrowLayout ? '1px solid rgba(34,211,238,0.15)' : 'none', padding: isUltraLayout ? '8px 10px' : isNarrowLayout ? '10px 12px' : '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: previewLabelFontSize, fontWeight: 800, color: 'rgba(34,211,238,0.68)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Response option</span>
                </div>
                <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: isUltraLayout ? '8px 10px' : isNarrowLayout ? '10px 12px' : '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isUltraLayout ? 5 : isNarrowLayout ? 6 : 8 }}>
                  {preview.isMCFormat ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      {(preview.answerOptions || []).map((o, i) => {
                        const isCorrect = o === preview.correctAnswer;
                        const letter = 'ABCD'[i];
                        return (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 0, borderRadius: 2, overflow: 'hidden', border: `1px solid ${isCorrect ? 'rgba(34,211,238,0.4)' : '#2D3748'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCorrect ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)', borderRight: `1px solid ${isCorrect ? 'rgba(34,211,238,0.3)' : '#2D3748'}` }}>
                              <span style={{ fontSize: previewTextSize, fontWeight: 800, color: isCorrect ? accent : colors.textMuted }}>{letter}</span>
                            </div>
                            <div style={{ fontSize: previewTextSize, lineHeight: 1.5, color: isCorrect ? colors.text : colors.textMuted, padding: isNarrowLayout ? '10px 12px' : '12px 16px', background: isCorrect ? 'rgba(34,211,238,0.05)' : 'transparent', minWidth: 0, overflowWrap: 'anywhere' }}>
                              {o}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', gap: isUltraLayout ? 8 : 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {(preview.answerOptions || []).map((o, i) => (
                        <span key={i} style={{ padding: isUltraLayout ? '5px 10px' : isNarrowLayout ? '6px 12px' : '6px 16px', borderRadius: 2, fontSize: previewTextSize, fontWeight: 600, background: o === preview.correctAnswer ? 'rgba(34,211,238,0.12)' : '#111827', border: o === preview.correctAnswer ? `1px solid rgba(34,211,238,0.4)` : '1px solid #2D3748', color: o === preview.correctAnswer ? accent : colors.textMuted }}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </> ) : (
            <div style={{ ...sty.section, alignItems: 'center', padding: 40, color: colors.text }}>
              Click <strong style={{ color: colors.text }}>Generate Item</strong> to generate a single item, or <strong style={{ color: colors.text }}>Generate Batch</strong> to open the batch generator.
            </div>
          )}
        </div>

        {/* ─── Bottom pane: tab navigator ─── */}
        {preview && (() => {
          const hasDistractors = previewDist.length > 0;
          const TABS = [
            { id: 'proof',      label: 'Validity Layers' },
            ...(hasDistractors ? [{ id: 'distractors', label: 'Distractors' }] : []),
            { id: 'formal',     label: 'Formal Notation' },
            { id: 'export',     label: 'Export' },
            { id: 'formula',    label: 'Formula' },
          ];
          const tab = TABS.find(t => t.id === activeTab) ? activeTab : TABS[0].id;
          const activeTabTip = VERBAL_TAB_TIPS[tab] || LOGICAL_FORM_TIPS.section;
          return (
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Tab bar */}
              <div style={{ flex: '0 0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C_VRB.sep}`, padding: isUltraLayout ? '0 8px' : isNarrowLayout ? '0 10px' : isTightLayout ? '0 12px' : '0 16px', gap: 2, background: C_VRB.bg }}>
                {TABS.map(t => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        flex: '0 0 auto', padding: isUltraLayout ? '7px 8px' : isNarrowLayout ? '8px 10px' : isTightLayout ? '8px 11px' : '8px 14px', fontSize: tabLabelSize, fontWeight: active ? 800 : 600,
                        color: active ? accent : 'rgba(255,255,255,0.45)',
                        background: 'transparent', border: 'none', borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                        cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: FONT_SANS,
                        marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.12s',
                      }}
                    >{t.label}</button>
                  );
                })}
                <span style={{ flex: '0 0 auto', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 1 }}>
                  <InfoTip content={activeTabTip} placement="top-end" />
                </span>
              </div>

              {tab === 'proof' && (
                <div style={{ flex: '0 0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: isUltraLayout ? '0 8px' : isNarrowLayout ? '0 10px' : isTightLayout ? '0 12px' : '0 16px', borderBottom: `1px solid ${C_VRB.sep}`, background: 'rgba(15,23,42,0.58)' }}>
                  {VALIDITY_LAYER_SUBTABS.map(([id, label]) => {
                    const active = proofTraceSubtab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setProofTraceSubtab(id)}
                        style={{
                          flex: '0 0 auto',
                          padding: density === 'ultra' ? '6px 8px' : isNarrowLayout ? '7px 9px' : '7px 11px',
                          border: 'none',
                          borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                          background: active ? 'rgba(34,211,238,0.08)' : 'transparent',
                          color: active ? accent : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          fontSize: tabLabelSize,
                          fontWeight: active ? 800 : 700,
                          fontFamily: FONT_SANS,
                          letterSpacing: '0.055em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          marginBottom: -1,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tab content */}
              <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: isUltraLayout ? '10px 10px' : isNarrowLayout ? '12px 12px' : isTightLayout ? '14px 16px' : '16px 20px' }}>
                {tab === 'graph' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Graph Visualization</span>
                      <InfoTip content={LOGICAL_FORM_TIPS.graph} />
                    </div>
                    <SVGGraphRenderer draft={preview} />
                  </div>
                )}

                {tab === 'abstract' && (
                  <div>
                    <AbstractFormRenderer abstractForm={preview.abstractForm} />
                  </div>
                )}

                {tab === 'proof' && (
                  <ProofTraceRenderer draft={preview} validation={previewValid} density={density} linkedElementKey={linkedElementKey} setLinkedElementKey={setLinkedElementKey} proofTraceSubtab={proofTraceSubtab} />
                )}

                {tab === 'formal' && (
                  <FormalNotationRenderer draft={preview} />
                )}

                {tab === 'ner' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.07em' }}>NER Annotation — IOB2</span>
                      <InfoTip content={LOGICAL_FORM_TIPS.ner} />
                    </div>
                    <NERAnnotationRenderer abstractForm={preview.abstractForm} />
                  </div>
                )}

                {tab === 'export' && (
                  exportFormat === 'json'
                    ? <GraphExportRenderer draft={preview} exportFormat={exportFormat} setExportFormat={setExportFormat} />
                    : <CypherExportRenderer draft={preview} exportFormat={exportFormat} setExportFormat={setExportFormat} />
                )}

                {tab === 'formula' && (
                  <FormulaRenderer formula={previewFormula} />
                )}

                {tab === 'distractors' && hasDistractors && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {previewDist.map((d, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#111827', border: '1px solid #2D3748', borderRadius: 2 }}>
                        <div style={{ fontSize: 13, color: colors.text, marginBottom: 4 }}>
                          {d.responseOption ? (
                            <>
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 8 }}>Incorrect response</span>
                              <span style={{ color: '#fff', fontWeight: 700 }}>{d.responseOption}</span>
                            </>
                          ) : d.text}
                        </div>
                        {d.responseOption && (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 6, lineHeight: 1.5 }}>
                            Presented conclusion: <span style={{ color: colors.text }}>{d.presentedConclusion}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: colors.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.28)', color: '#f87171' }}>{d.pattern}</span>
                          {d.claim_form && (
                            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.25)', color: '#e879f9', fontFamily: FONT_MONO }}>{d.claim_form}</span>
                          )}
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.rationale}</span>
                        </div>
                        <RefutationTraceRenderer distractor={d} />
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          );
        })()}

        {/* Test-taker item preview modal */}
        {itemPreviewOpen && preview && createPortal(
          <div style={{ ...sty.modalOverlay, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(7px)' }} onClick={e => { if (e.target === e.currentTarget) setItemPreviewOpen(false); }}>
            <div style={{ ...sty.modalCard, width: 'min(820px, 100%)', maxHeight: 'min(88vh, 820px)', background: '#e8eef7', border: '1px solid rgba(226,232,240,0.9)', borderRadius: 14, boxShadow: '0 26px 90px rgba(0,0,0,0.65)' }}>
              <div style={{ ...sty.modalHeader, background: 'linear-gradient(135deg, #0f172a 0%, #172033 60%, #20304a 100%)', borderBottom: '1px solid rgba(148,163,184,0.22)', padding: '18px 22px' }}>
                <div>
                  <h3 style={{ ...sty.modalTitle, color: '#f8fafc', letterSpacing: '0.01em' }}>Item Preview</h3>
                  <p style={{ ...sty.modalSubtitle, color: '#cbd5e1' }}>Test-taker administration view. Correct-answer and proof cues are hidden.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setItemPreviewOpen(false)}
                  style={{ ...sty.modalClose, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#e2e8f0', borderRadius: 999 }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div style={{ overflowY: 'auto', padding: isUltraLayout ? 16 : 24, background: 'radial-gradient(circle at top left, rgba(34,211,238,0.16), transparent 34%), linear-gradient(135deg, #dbeafe 0%, #f8fafc 48%, #e0f2fe 100%)' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', background: '#ffffff', color: '#111827', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 16, boxShadow: '0 18px 50px rgba(15,23,42,0.2)', overflow: 'hidden' }}>
                  <div style={{ padding: isUltraLayout ? '20px 18px 14px' : '26px 30px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Verbal Reasoning</div>
                    <h2 style={{ margin: 0, fontSize: isUltraLayout ? 22 : 26, lineHeight: 1.2, color: '#0f172a', fontWeight: 800 }}>Select the best answer</h2>
                    <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, color: '#475569' }}>
                      Read the statements carefully, then answer the question below.
                    </p>
                  </div>

                  <div style={{ padding: isUltraLayout ? '18px' : '24px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <section aria-label="Statements" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Statements</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          ...preview.premises.map((p, i) => ({ key: `premise-${i}`, text: p.text })),
                          ...(preview.fact ? [{ key: 'given-fact', text: preview.fact }] : []),
                          ...(!preview.isMCFormat && preview.conclusion ? [{ key: 'conclusion', text: preview.conclusion }] : []),
                        ].map((row, i) => (
                          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 12, alignItems: 'start', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: 999, background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
                            <span style={{ fontSize: 17, lineHeight: 1.55, color: '#111827' }}>{row.text}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section aria-label="Question" style={{ padding: isUltraLayout ? '16px' : '18px 20px', borderRadius: 12, background: '#0f172a', color: '#f8fafc', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Question</div>
                      <div style={{ fontSize: 18, lineHeight: 1.55 }}>{displayQuestionPrompt || 'Select the response that best follows from the statements above.'}</div>
                    </section>

                    <section aria-label="Response options" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Response options</div>
                      <div style={{ display: 'grid', gridTemplateColumns: isUltraLayout ? '1fr' : preview.isMCFormat ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        {(preview.answerOptions || ['Must follow', 'Cannot follow']).map((option, i) => (
                          <button
                            key={`${option}-${i}`}
                            type="button"
                            style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', padding: '13px 14px', background: '#ffffff', color: '#111827', border: '1px solid #cbd5e1', borderRadius: 12, fontFamily: FONT_SANS, fontSize: 16, lineHeight: 1.45, cursor: 'default', boxShadow: '0 2px 0 rgba(15,23,42,0.04)' }}
                            onClick={e => e.currentTarget.blur()}
                          >
                            <span style={{ width: 32, height: 32, borderRadius: 999, background: '#eef2ff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>{preview.isMCFormat ? 'ABCD'[i] : i + 1}</span>
                            <span>{option}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
      </div>

      <div style={sty.pageFooter}>
        <div style={sty.pageFooterGroup}>
          <button style={sty.btn} onClick={generateOne}>Generate Item</button>
          <button style={sty.btnOut} onClick={() => setBatchModalOpen(true)}>Generate Batch</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: preview ? 1 : 0.45 }}>
            ID {preview?.bankId || 'pending'}
          </div>
          <button
            style={{ ...sty.btnBank, opacity: preview ? 1 : 0.45, cursor: preview ? 'pointer' : 'not-allowed' }}
            onClick={addPreviewToBank}
            disabled={!preview}
          >
            Add to Bank
          </button>
        </div>
      </div>

      {toast && <div style={sty.toast}>{toast}</div>}

      {singleAddConfirmOpen && preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: 'min(480px, 100%)', border: '1px solid rgba(34,197,94,0.42)', borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 10 }}>Confirm add to bank</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 10 }}>Add current verbal item?</div>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.65 }}>
              This will add the current preview item to the item bank using the ID shown below.
            </p>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ID {preview.bankId || 'pending'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSingleAddConfirmOpen(false)} style={sty.btnOut}>Review More</button>
              <button type="button" onClick={confirmAddPreviewToBank} style={{ ...sty.btnBank, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add to Bank</button>
            </div>
          </div>
        </div>
      )}

      <VerbalBatchModal
        key={batchModalOpen ? 'verbal-batch-open' : 'verbal-batch-closed'}
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        settings={settings}
        showToast={showToast}
      />

      {fallaciesOpen && (
        <div style={sty.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setFallaciesOpen(false); }}>
          <div style={{ ...sty.modalCard, width: 'min(680px, 100%)', maxHeight: 'min(70vh, 560px)' }}>
            <div style={sty.modalHeader}>
              <div>
                <h3 style={sty.modalTitle}>Classic Fallacies by Template</h3>
                <p style={sty.modalSubtitle}>Named, well-studied logical errors — the kind taught in logic textbooks. Each template has its own canonical mistake.</p>
              </div>
              <button type="button" onClick={() => setFallaciesOpen(false)} style={sty.modalClose} aria-label="Close">×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '150px 180px 1fr',
                padding: '0 14px 8px',
                borderBottom: `1px solid rgba(34,211,238,0.15)`,
                marginBottom: 6,
              }}>
                {['Template', 'Classic Fallacy', 'What It Looks Like'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(34,211,238,0.55)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
              {[
                {
                  template: 'Modus Ponens',
                  fallacy: 'Affirming the consequent',
                  description: 'If A→B and B is true, therefore A is true — wrong, B could have other causes.',
                  color: '#38bdf8',
                },
                {
                  template: 'Modus Tollens',
                  fallacy: 'Denying the antecedent',
                  description: 'If A→B and A is false, therefore B is false — wrong, B could still be true.',
                  color: '#34d399',
                },
                {
                  template: 'Hypothetical Syllogism',
                  fallacy: 'Breaking the chain',
                  description: 'Skipping a link and concluding from a non-adjacent step in the chain.',
                  color: '#fbbf24',
                },
                {
                  template: 'Contraposition',
                  fallacy: 'Illicit converse',
                  description: 'Confusing ~B→~A with B→A — treating the contrapositive as the converse.',
                  color: '#f472b6',
                },
                {
                  template: 'Necessary vs. Sufficient',
                  fallacy: 'Necessity/sufficiency swap',
                  description: 'Treating "A is sufficient for B" as "A is necessary for B."',
                  color: accent,
                },
              ].map(({ template, fallacy, description, color }, i, arr) => (
                <div key={template} style={{
                  display: 'grid', gridTemplateColumns: '150px 180px 1fr',
                  borderLeft: `3px solid ${color}`,
                  borderBottom: i < arr.length - 1 ? `1px solid ${C_VRB.sep}` : 'none',
                  padding: '12px 14px',
                  alignItems: 'center',
                  gap: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', paddingRight: 12 }}>{template}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, paddingRight: 16, lineHeight: 1.4 }}>{fallacy}</span>
                  <span style={{ fontSize: 12, color: colors.text, lineHeight: 1.6 }}>{description}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, padding: '10px 14px', background: 'rgba(34,211,238,0.04)', border: `1px solid rgba(34,211,238,0.15)`, borderRadius: 2, fontSize: 11, color: colors.text, lineHeight: 1.6 }}>
                <strong style={{ color: colors.text }}>Note:</strong> All five templates now have two dedicated Classic Fallacies distractor patterns each.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

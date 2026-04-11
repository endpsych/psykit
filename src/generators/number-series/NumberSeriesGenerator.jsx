import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { colors, fonts } from '../../theme';
import { appendToBank, genBankId, makeBankItem } from '../../store/bankStore';
import {
  ALL_MODELS,
  getModel,
  getModelForItem,
  generateSeriesItem,
  diagnoseSeriesGenerationFailure,
  buildNumberSeriesFormula,
  getNumberSeriesItemFromFormula,
} from './engine';
import { computeItemDifficulty } from './scoring';
import { displayTerm, parseDisplayTerm, termValue, subtractTerms, divideTerms } from './terms';

// ── Design tokens ─────────────────────────────────────────────────────────────
const accent    = colors.number;   // #fbbf24 yellow
const FONT_MONO = '"SF Mono","Cascadia Code","Fira Code",Consolas,monospace';
const FONT_SANS = fonts.body;

const C = {
  bg:      '#0A0F1A',
  card:    'rgba(10,15,26,0.55)',
  border:  'rgba(251,191,36,0.14)',
  borderHd:'rgba(251,191,36,0.28)',
  sep:     'rgba(255,255,255,0.07)',
  text:    '#E5E7EB',
  textSec: '#C2CDD8',
  textMut: '#8B97A8',
  success: '#4ade80',
  warn:    '#fbbf24',
  danger:  '#f87171',
};

const sty = {
  container: {
    display: 'flex', flexDirection: 'column',
    fontFamily: FONT_SANS, color: C.text,
    height: '100vh', overflow: 'hidden', background: C.bg,
  },
  contentRow: { display: 'flex', alignItems: 'stretch', flex: 1, minHeight: 0, overflow: 'hidden' },
  left: {
    flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 8,
    overflowY: 'auto', minHeight: 0,
    padding: '12px 12px 20px 16px',
    borderRight: `1px solid ${C.sep}`,
  },
  right: {
    flex: 1, display: 'flex', flexDirection: 'column',
    minWidth: 0, minHeight: 0, padding: 0, gap: 0, overflowY: 'hidden',
  },
  section: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 2, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  title: {
    fontSize: 11, fontWeight: 800, color: `rgba(251,191,36,0.68)`,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    margin: 0, marginBottom: 10,
  },
  label: {
    fontSize: 11, fontWeight: 700, color: C.textMut,
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2,
  },
  sel: {
    background: '#111827', color: C.text,
    border: `1px solid rgba(251,191,36,0.22)`,
    borderRadius: 2, padding: '7px 10px',
    fontSize: 13, fontFamily: FONT_SANS, width: '100%', outline: 'none',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: `rgba(251,191,36,0.08)`, color: accent,
    border: `1px solid rgba(251,191,36,0.28)`,
    borderRadius: 2, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: FONT_SANS, letterSpacing: '0.02em',
  },
  btnOut: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.04)', color: C.text,
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: FONT_SANS, letterSpacing: '0.02em',
  },
  btnBank: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(74,222,128,0.1)', color: C.success,
    border: '1px solid rgba(74,222,128,0.25)',
    borderRadius: 2, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: FONT_SANS, letterSpacing: '0.02em',
  },
  pageFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '10px 16px',
    background: '#070C16', borderTop: `1px solid ${C.sep}`, flex: '0 0 auto',
  },
  pageFooterGroup: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  toast: {
    position: 'fixed', bottom: 20, right: 20,
    background: accent, color: '#000',
    padding: '9px 18px', borderRadius: 2,
    fontWeight: 700, fontSize: 12, zIndex: 999,
    boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 1000,
  },
  modalCard: {
    width: 'min(980px, 100%)', maxHeight: 'min(86vh, 860px)',
    background: C.bg, border: `1px solid ${C.borderHd}`,
    borderRadius: 2, boxShadow: '0 28px 64px rgba(0,0,0,0.55)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, padding: '18px 20px 14px', borderBottom: `1px solid ${C.sep}`,
  },
  modalTitle:    { margin: 0, fontSize: 17, fontWeight: 700, color: C.text, fontFamily: FONT_SANS },
  modalSubtitle: { margin: '4px 0 0', fontSize: 12, color: C.textMut, lineHeight: 1.6 },
  modalClose: {
    width: 32, height: 32, borderRadius: 2,
    border: `1px solid rgba(255,255,255,0.1)`, background: 'rgba(255,255,255,0.04)',
    color: C.textMut, cursor: 'pointer', fontSize: 18, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  helper: { fontSize: 11, color: C.textMut },
};

// ── Small reusable pieces ──────────────────────────────────────────────────────

const NUM_STEPPER_STYLE = `
  .psykit-numstep::-webkit-inner-spin-button,
  .psykit-numstep::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .psykit-numstep { -moz-appearance: textfield; }
  .psykit-stepbtn:hover { background: rgba(251,191,36,0.08) !important; color: rgba(251,191,36,0.9) !important; }
`;

function NumStepper({ value, onChange, min, max, disabled, style }) {
  const clamp = n => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };
  const btnBase = {
    flex: 1, background: 'none', border: 'none',
    color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    transition: 'background 0.12s, color 0.12s',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', overflow: 'hidden',
      background: '#111827', border: `1px solid rgba(251,191,36,0.22)`,
      borderRadius: 2, opacity: disabled ? 0.55 : 1, ...style,
    }}>
      <input
        type="number" className="psykit-numstep"
        value={value} onChange={e => onChange(clamp(Number(e.target.value)))}
        min={min} max={max} disabled={disabled}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: C.text, fontSize: 11, fontFamily: FONT_SANS,
          padding: '5px 8px', width: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid rgba(251,191,36,0.15)`, width: 22, flexShrink: 0 }}>
        <button type="button" className="psykit-stepbtn" onClick={() => !disabled && onChange(clamp(value + 1))}
          style={{ ...btnBase, borderBottom: `1px solid rgba(251,191,36,0.1)` }}>
          <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ display: 'block' }}>
            <path d="M3.5 0L7 5H0Z" />
          </svg>
        </button>
        <button type="button" className="psykit-stepbtn" onClick={() => !disabled && onChange(clamp(value - 1))}
          style={btnBase}>
          <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ display: 'block' }}>
            <path d="M3.5 5L0 0H7Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Badge({ label, color = accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
      textTransform: 'uppercase', color,
      background: `${color}1A`, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  );
}

// ── Pattern trace table ───────────────────────────────────────────────────────

function PatternTraceTable({ item }) {
  if (!item) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;
  if (item.analysisValid === false) {
    return (
      <div style={{ fontSize: 12, color: C.textMut, lineHeight: 1.6 }}>
        Manual term edits detached this item from its original generated rule. Pattern tracing is unavailable until the item is regenerated.
      </div>
    );
  }

  const model = getModelForItem(item);
  const patternLines = describePattern(item) || [];

  const rows = [
    { prop: 'Step Type',    val: model?.stepType ?? '—' },
    { prop: 'Behavior',     val: model?.behaviorType ?? getModelBehavior(model) ?? '—' },
    { prop: 'Element Type', val: model?.elementType ?? '—' },
    ...(model?.step1Rule    ? [{ prop: 'Primary Rule',   val: model.step1Rule }]   : []),
    ...(model?.step2Rule    ? [{ prop: 'Secondary Rule', val: model.step2Rule }]   : []),
    ...(model?.extendedType ? [{ prop: 'Extended Type',  val: model.extendedType }]: []),
    ...patternLines.map(l => ({ prop: 'Pattern Rule', val: l, highlight: true })),
  ];

  const cols = '32px 130px 1fr';

  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'Property', 'Value'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingTop: 1 }}>{i + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMut }}>{row.prop}</span>
          <span style={{ fontSize: 12, color: row.highlight ? '#c4d4ff' : C.text, lineHeight: 1.55 }}>{row.val}</span>
        </div>
      ))}
    </div>
  );
}

// ── Model info table ───────────────────────────────────────────────────────────

function ModelInfoTable({ item }) {
  if (!item) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;

  const model = getModelForItem(item);
  if (!model) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;

  const rows = [
    { key: 'ID',           val: `${model.id}` },
    { key: 'Name',         val: model.name },
    { key: 'Title',        val: model.title },
    { key: 'Description',  val: model.description || '—' },
    { key: 'Step Type',    val: model.stepType },
    { key: 'Behavior',     val: model.behaviorType || getModelBehavior(model) || '—' },
    { key: 'Element Type', val: model.elementType },
    { key: 'Step 1 Rule',  val: model.step1Rule  || '—' },
    { key: 'Step 2 Rule',  val: model.step2Rule  || '—' },
    { key: 'Extended',     val: model.extendedType || '—' },
  ];

  const cols = '32px 130px 1fr';

  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'Property', 'Value'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingTop: 1 }}>{i + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMut }}>{row.key}</span>
          <span style={{ fontSize: 12, color: C.text, lineHeight: 1.55 }}>{row.val}</span>
        </div>
      ))}
    </div>
  );
}

function renderFormulaJson(json) {
  const tokenPattern = /"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\]:,]/g;
  const nodes = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of json.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    const afterToken = json.slice(index + token.length);
    let color = 'rgba(255,255,255,0.58)';

    if (lastIndex < index) nodes.push(json.slice(lastIndex, index));

    if (token.startsWith('"') && /^\s*:/.test(afterToken)) {
      color = '#7dd3fc';
    } else if (token.startsWith('"')) {
      color = '#86efac';
    } else if (token === 'true' || token === 'false') {
      color = '#c084fc';
    } else if (token === 'null') {
      color = '#fb7185';
    } else if (/^-?\d/.test(token)) {
      color = accent;
    }

    nodes.push(
      <span key={`ns-formula-token-${index}-${tokenIndex++}`} style={{ color }}>
        {token}
      </span>
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < json.length) nodes.push(json.slice(lastIndex));
  return nodes;
}

function NumberSeriesFormulaRenderer({ formula }) {
  const [tab, setTab] = useState('json');
  const [copied, setCopied] = useState(false);

  if (!formula) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;

  const json = JSON.stringify(formula, null, 2);
  const resolvedItem = formula.resolvedItem || {};
  const settings = formula.settings || {};
  const meta = formula.meta || {};
  const subtabs = [
    { id: 'json', label: 'JSON Formula' },
    { id: 'engine', label: 'Engine' },
  ];
  const statBadges = [
    ['Generator', formula.generator || 'number-series', '#22d3ee'],
    ['Version', String(formula.version ?? '1'), '#a78bfa'],
    ['Model', resolvedItem.modelName || resolvedItem.modelId || '—', '#4ade80'],
    ['Length', String(resolvedItem.terms?.length || settings.seriesLength || 0), accent],
    ['Missing', typeof resolvedItem.missingIndex === 'number' ? String(resolvedItem.missingIndex + 1) : '—', '#60a5fa'],
  ];
  const pipelineSteps = [
    ['1', 'Controls snapshot', 'The selected model and generation controls are frozen into formula.settings before the item is shown.'],
    ['2', 'Series resolution', 'The generator resolves the concrete terms, answer, missing position, derivative/rule data, and bank ID into formula.resolvedItem.'],
    ['3', 'Hydrate preview', 'The series preview and answer panel read directly from the resolved item instead of regenerating the sequence.'],
    ['4', 'Validity layer', 'Pattern, model info, and proof/validation tracing all read the same resolved item payload.'],
    ['5', 'Save to bank', 'The exact same formula-backed item is preserved in the bank metadata when the item is added to the bank.'],
  ];
  const mappingRows = [
    ['Model selection + controls', 'formula.settings', 'Captures the model, series length, first-seed settings, second-seed or increment settings, and missing-position rule used to generate the item.'],
    ['Sequence + answer', 'formula.resolvedItem.terms, answer, missingIndex', 'Drives the series visualizer, answer display, and open-response target.'],
    ['Rule / derivative state', 'formula.resolvedItem.rule, inc, ratio, derivative, step1Rule, step2Rule', 'Explains the logic behind one-step constant-step, one-step recurrence, and two-step derived-step series models.'],
    ['Item analysis', 'formula.resolvedItem + model metadata', 'Feeds the pattern, model info, and validity-layer tracing for the generated item.'],
    ['Bank save trace', 'formula.resolvedItem.bankId + formula.meta', 'Keeps the predetermined bank ID and generation timestamp attached to the item.'],
  ];
  const activeModelId = resolvedItem.modelId;
  const modelGrid = '52px minmax(180px, 1.05fr) minmax(220px, 1.15fr) 100px 140px 110px 120px 120px 100px';

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 6, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {subtabs.map(item => {
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
                background: active ? 'rgba(251,191,36,0.08)' : 'transparent',
                color: active ? accent : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: active ? 800 : 700,
                fontFamily: FONT_SANS,
                letterSpacing: '0.055em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                marginBottom: -7,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'json' && (
        <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', background: '#111827' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: FONT_SANS, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.72)' }}>
              JSON Formula
            </span>
            <button
              type="button"
              onClick={copy}
              title={copied ? 'Copied' : 'Copy formula JSON'}
              style={{
                width: 30,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.08)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.28)'}`,
                borderRadius: 2,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <rect x="5" y="3" width="8" height="8" rx="1.5" fill="none" stroke={copied ? C.success : accent} strokeWidth="1.6" />
                <rect x="2.5" y="6" width="8" height="8" rx="1.5" fill="none" stroke={copied ? C.success : accent} strokeWidth="1.6" />
              </svg>
            </button>
          </div>
          <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', padding: '12px', fontSize: 12, lineHeight: 1.6, color: C.text, whiteSpace: 'pre' }}>
            {renderFormulaJson(json)}
          </pre>
        </div>
      )}

      {tab === 'engine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {statBadges.map(([label, value, color]) => (
              <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 4, border: `1px solid ${color}33`, background: `${color}10` }}>
                <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: FONT_MONO }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid rgba(251,191,36,0.18)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(251,191,36,0.05)', fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>
              Engine Pipeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pipelineSteps.map(([step, title, body], index) => (
                <div key={step} style={{ display: 'grid', gridTemplateColumns: '56px 180px minmax(0, 1fr)', borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: FONT_MONO, textAlign: 'center' }}>{step}</div>
                  <div style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)', color: C.text, fontSize: 12, fontWeight: 700 }}>{title}</div>
                  <div style={{ padding: '10px 12px', color: C.textSec, fontSize: 12, lineHeight: 1.65, fontFamily: FONT_SANS }}>{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 10, fontWeight: 800, color: 'rgba(251,191,36,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>
              Formula to Item Mapping
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 300px minmax(0, 1fr)' }}>
              {['Item aspect', 'Formula field', 'How the engine uses it'].map((header, index) => (
                <div key={header} style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: index < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>
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
                    color: cellIndex === 1 ? '#93c5fd' : C.textSec,
                    fontFamily: cellIndex === 1 ? FONT_MONO : FONT_SANS,
                  }}
                >
                  {cell}
                </div>
              )))}
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 10, fontWeight: 800, color: 'rgba(251,191,36,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>
              Available Models
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: modelGrid }}>
              {['ID', 'Model Name', 'Description', 'Step', 'Behavior', 'Element', 'Step 1', 'Step 2', 'Operations'].map((header, index) => (
                <div key={header} style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: index < 8 ? '1px solid rgba(255,255,255,0.08)' : 'none', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT_SANS }}>
                  {header}
                </div>
              ))}
              {ALL_MODELS.map((model, rowIndex) => {
                const active = model.id === activeModelId;
                const bg = active ? 'rgba(251,191,36,0.10)' : 'transparent';
                const border = active ? 'rgba(251,191,36,0.20)' : 'rgba(255,255,255,0.06)';
                const nameColor = active ? accent : C.text;
                const cells = [
                  String(model.id),
                  `${model.title}${active ? '  [active item model]' : ''}`,
                  model.description || '—',
                  model.stepType,
                  model.behaviorType || getModelBehavior(model) || '—',
                  model.elementType,
                  model.step1Rule || '—',
                  model.step2Rule || '—',
                  model,
                ];
                return cells.map((cell, cellIndex) => (
                  <div
                    key={`${model.id}-${cellIndex}`}
                    style={{
                      padding: '10px 12px',
                      borderBottom: rowIndex === ALL_MODELS.length - 1 ? 'none' : `1px solid ${border}`,
                      borderRight: cellIndex < 8 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      background: bg,
                      color:
                        cellIndex === 1 ? nameColor
                        : cellIndex === 2 ? '#7CFF6B'
                        : cellIndex === 3 ? (cell === 'one' ? '#B792FF' : cell === 'two' ? '#FFB347' : C.textSec)
                        : C.textSec,
                      fontSize: 12,
                      lineHeight: 1.55,
                      fontFamily: cellIndex === 0 ? FONT_MONO : FONT_SANS,
                      fontWeight: active && cellIndex < 2 ? 700 : 500,
                    }}
                  >
                    {cellIndex === 8 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(MODEL_OPERATIONS[model.id] || []).map(op => (
                          <span
                            key={`${model.id}-${op.symbol}`}
                            style={{
                              fontFamily: FONT_MONO,
                              fontSize: 12,
                              fontWeight: 800,
                              color: op.color,
                              background: `${op.color}20`,
                              border: `1px solid ${op.color}55`,
                              borderRadius: 2,
                              padding: '1px 6px',
                              lineHeight: 1.4,
                            }}
                          >
                            {op.symbol}
                          </span>
                        ))}
                      </div>
                    ) : (
                      cell
                    )}
                  </div>
                ));
              })}
            </div>
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

// ── Utilities ─────────────────────────────────────────────────────────────────

function buildStem(terms, missingIndex) {
  return terms.map((term, index) => (index === missingIndex ? '?' : displayTerm(term))).join(',  ');
}

function getModelBehavior(model) {
  if (!model) return null;
  if (model.behaviorType) return model.behaviorType;
  if (model.stepType === 'two') return 'derived-step';
  if (model.step1Rule === 'addition' || model.step1Rule === 'multiplication') return 'recurrence';
  return 'constant-step';
}

function isRecurrenceModel(model) {
  return getModelBehavior(model) === 'recurrence';
}

function describeParameterControls(model, seedMode, seedValue, incrementMode, incrementValue) {
  if (!model) {
    return {
      seedLabel: 'Starting Value',
      seedHelper: seedMode === 'random' ? `Random start in ±${seedValue}` : `Series starts at ${seedValue}`,
      incrementLabel: 'Rule Parameter',
      incrementHelper: incrementMode === 'random' ? `Random rule parameter in ±${incrementValue}` : `Fixed rule parameter of ${incrementValue}`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  if (model.elementType === 'fraction') {
    return {
      seedLabel: 'Starting Value',
      seedHelper: `Fraction models randomize numerator and denominator within ±${seedValue}.`,
      incrementLabel: model.step1Rule === 'geometric' ? 'Common Ratio' : 'Common Difference',
      incrementHelper: `Fraction models keep the R1 Rule as an integer value within ±${incrementValue} so the step stays constant and legible.`,
      incrementDisabled: false,
      seedExactDisabled: true,
      incrementExactDisabled: true,
    };
  }

  const isOneStep = model.stepType === 'one';
  const isRecurrence = isRecurrenceModel(model);
  const usesTwoSeeds = isRecurrence && (model.step1Rule === 'addition' || model.step1Rule === 'multiplication');

  if (usesTwoSeeds) {
    return {
      seedLabel: 'First Seed',
      seedHelper: seedMode === 'random'
        ? `Random first seed in ±${seedValue}.`
        : `First seed fixed at ${seedValue}.`,
      incrementLabel: 'Second Seed',
      incrementHelper: incrementMode === 'random'
        ? `Random second seed in ±${incrementValue}.`
        : `Second seed fixed at ${incrementValue}.`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  if (isOneStep && model.step1Rule === 'arithmetic') {
    return {
      seedLabel: 'Starting Value',
      seedHelper: seedMode === 'random' ? `Random start in ±${seedValue}` : `Series starts at ${seedValue}`,
      incrementLabel: 'Common Difference',
      incrementHelper: incrementMode === 'random' ? `Random difference in ±${incrementValue}` : `Each step adds or subtracts ${incrementValue}`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  if (isOneStep && model.step1Rule === 'geometric') {
    return {
      seedLabel: 'Starting Value',
      seedHelper: seedMode === 'random' ? `Random start in ±${seedValue}` : `Series starts at ${seedValue}`,
      incrementLabel: 'Common Ratio',
      incrementHelper: incrementMode === 'random' ? `Random ratio up to ${Math.max(2, incrementValue)}` : `Each step multiplies by ${incrementValue}`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  if (model.stepType === 'two') {
    return {
      seedLabel: 'Starting Value',
      seedHelper: seedMode === 'random' ? `Random series start in ±${seedValue}` : `Series starts at ${seedValue}`,
      incrementLabel: 'Derivative Start',
      incrementHelper: incrementMode === 'random'
        ? `Random initial derivative in ±${incrementValue}`
        : `Initial derivative fixed at ${incrementValue}`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  if (isRecurrence) {
    return {
      seedLabel: 'First Seed',
      seedHelper: seedMode === 'random'
        ? `Random first seed in ±${seedValue}.`
        : `First seed fixed at ${seedValue}.`,
      incrementLabel: 'Second Seed',
      incrementHelper: incrementMode === 'random'
        ? `Random second seed in ±${incrementValue}.`
        : `Second seed fixed at ${incrementValue}.`,
      incrementDisabled: false,
      seedExactDisabled: false,
      incrementExactDisabled: false,
    };
  }

  return {
    seedLabel: 'Starting Value',
    seedHelper: seedMode === 'random' ? `Random start in ±${seedValue}` : `Series starts at ${seedValue}`,
    incrementLabel: 'Rule Parameter',
    incrementHelper: incrementMode === 'random' ? `Random rule parameter in ±${incrementValue}` : `Fixed rule parameter of ${incrementValue}`,
    incrementDisabled: false,
    seedExactDisabled: false,
    incrementExactDisabled: false,
  };
}

function validateGenerationSettings(model, seedMode, seedValue, incrementMode, incrementValue) {
  if (!model) return null;

  if (model.stepType === 'one' && model.step1Rule === 'arithmetic' && incrementMode === 'exact' && incrementValue === 0) {
    return 'Arithmetic items need a non-zero difference.';
  }

  if (model.stepType === 'one' && model.step1Rule === 'geometric' && incrementMode === 'exact' && Math.abs(incrementValue) < 2) {
    return 'Geometric items need a ratio with absolute value 2 or greater.';
  }

  if (model.elementType === 'fraction' && (seedMode === 'exact' || incrementMode === 'exact')) {
    return null;
  }

  if (
    isRecurrenceModel(model)
    && model.step1Rule === 'multiplication'
    && ((seedMode === 'exact' && seedValue === 0) || (incrementMode === 'exact' && incrementValue === 0))
  ) {
    return 'Multiplication recurrence items need non-zero seeds.';
  }

  return null;
}

function buildNumberSeriesBankItem(it) {
  return makeBankItem({
    id: it.bankId || genBankId('nseries'),
    name: `Number Series ${it.modelId}`,
    stem: `Complete the series: ${it.stem}`,
    generatedBy: 'number-series',
    constructId: 'numerical-reasoning',
    responseFormat: 'open',
    responseOptions: [],
    generatorMeta: {
      modelId: it.modelId,
      modelName: it.modelName,
      terms: it.terms.map(displayTerm),
      answer: it.answerDisplay,
      missingIndex: it.missingIndex,
      formula: it.formula || null,
    },
  });
}

function createEditorDraft(item) {
  return {
    missingIndex: item.missingIndex ?? 4,
    termInputs: item.terms.map(displayTerm),
  };
}

function applyDraftToItem(item, draft) {
  const parsedTerms = draft.termInputs.map(parseDisplayTerm);
  if (parsedTerms.some((term) => !term)) {
    return { error: 'Enter valid terms using integers, fractions like 3/4, or surds like 2√3.' };
  }

  const missingIndex = Number(draft.missingIndex);
  const maxMissingIndex = parsedTerms.length - 1;
  if (!Number.isInteger(missingIndex) || missingIndex < 0 || missingIndex > maxMissingIndex) {
    return { error: 'Choose a valid missing position.' };
  }

  const answer = parsedTerms[missingIndex];
  const answerDisplay = displayTerm(answer);
  const model = getModelForItem(item);
  const nextSignature = parsedTerms.map(displayTerm).join(',');
  const termsChanged = nextSignature !== item.signature;
  const nextItem = {
    ...item,
    terms: parsedTerms,
    missingIndex,
    answer,
    answerDisplay,
    stem: buildStem(parsedTerms, missingIndex),
    signature: nextSignature,
    responseFormat: 'open',
    distractors: [],
    responseOptions: [],
    analysisValid: termsChanged ? false : (item.analysisValid ?? true),
    ...(termsChanged ? {
      rule: undefined,
      inc: undefined,
      ratio: undefined,
      derivative: undefined,
      step1Rule: undefined,
      step2Rule: undefined,
    } : {}),
  };

  return {
    item: {
      ...nextItem,
      difficulty: model ? computeItemDifficulty(model, nextItem) : item.difficulty,
    },
  };
}

function buildNumberSeriesGenerationSettings({
  seedMode,
  seedValue,
  incrementMode,
  incrementValue,
  missingPosition,
  responseFormat = 'open',
  seriesLength,
}) {
  return {
    seedLimit: seedMode === 'random' ? seedValue : 5,
    boundLimit: incrementMode === 'random' ? incrementValue : 5,
    fixedSeed: seedMode === 'exact' ? seedValue : null,
    fixedIncrement: incrementMode === 'exact' ? incrementValue : null,
    secondSeedLimit: incrementMode === 'random' ? incrementValue : 5,
    fixedSecondSeed: incrementMode === 'exact' ? incrementValue : null,
    missingPosition,
    responseFormat,
    seriesLength,
  };
}

function describePattern(item) {
  if (!item) return null;
  const model = getModelForItem(item);
  if (!model) return null;
  const lines = [];

  if (model.stepType === 'one' && !isRecurrenceModel(model)) {
    const rule = model.step1Rule;
    if (rule === 'arithmetic') {
      const inc = item.inc ? displayTerm(item.inc) : '?';
      const sign = item.inc && termValue(item.inc) >= 0 ? '+' : '';
      lines.push(`Each term = previous ${sign}${inc}`);
    } else if (rule === 'geometric') {
      const ratio = item.ratio ? displayTerm(item.ratio) : '?';
      lines.push(`Each term = previous × ${ratio}`);
    }
  } else if (isRecurrenceModel(model)) {
    if (model.step1Rule === 'addition') {
      lines.push('Each new term = sum of the two previous terms');
    } else if (model.step1Rule === 'multiplication') {
      lines.push('Each new term = product of the two previous terms');
    }
  } else if (model.stepType === 'two') {
    lines.push(`Step rule: ${model.step1Rule}`);
    lines.push(`Steps themselves follow: ${model.step2Rule}`);
  }
  return lines;
}

function formatAdditionRuleLabel(leftTerm, rightTerm) {
  const left = displayTerm(leftTerm);
  const right = displayTerm(rightTerm);
  if (right.startsWith('-')) return `${left}-${right.slice(1)}`;
  return `${left}+${right}`;
}

function formatMultiplicationRuleLabel(leftTerm, rightTerm) {
  const leftRaw = displayTerm(leftTerm);
  const rightRaw = displayTerm(rightTerm);
  const left = leftRaw.startsWith('-') ? `(${leftRaw})` : leftRaw;
  const right = rightRaw.startsWith('-') ? `(${rightRaw})` : rightRaw;
  return `${left}×${right}`;
}

function formatRuleValue(term, isMultiply) {
  const value = termValue(term);
  const abs = displayTerm(term).replace('-', '');
  if (isMultiply) return `×${abs}`;
  return value >= 0 ? `+${abs}` : `-${abs}`;
}

function formatTermApplication(baseTerm, ruleTerm, isMultiply) {
  const baseRaw = displayTerm(baseTerm);
  const ruleRaw = displayTerm(ruleTerm);
  if (isMultiply) {
    const base = baseRaw.startsWith('-') ? `(${baseRaw})` : baseRaw;
    const rule = ruleRaw.startsWith('-') ? `(${ruleRaw})` : ruleRaw;
    return `${base} × ${rule}`;
  }
  const op = termValue(ruleTerm) >= 0 ? '+' : '-';
  return `${baseRaw} ${op} ${ruleRaw.replace('-', '')}`;
}

function buildSeriesValidationParts(baseTerm, ruleTerm, resultTerm, isMultiply, baseSeriesKey, resultSeriesKey) {
  const baseRaw = displayTerm(baseTerm);
  const resultRaw = displayTerm(resultTerm);
  const ruleRaw = displayTerm(ruleTerm);

  if (isMultiply) {
    const baseLabel = baseRaw.startsWith('-') ? `(${baseRaw})` : baseRaw;
    const ruleLabel = ruleRaw.startsWith('-') ? `(${ruleRaw})` : ruleRaw;
    return [
      { text: baseLabel, series: true, seriesKey: baseSeriesKey },
      { text: ' × ' },
      { text: ruleLabel },
      { text: ' = ' },
      { text: resultRaw, series: true, seriesKey: resultSeriesKey },
    ];
  }

  const op = termValue(ruleTerm) >= 0 ? '+' : '-';
  return [
    { text: baseRaw, series: true, seriesKey: baseSeriesKey },
    { text: ` ${op} ` },
    { text: ruleRaw.replace('-', '') },
    { text: ' = ' },
    { text: resultRaw, series: true, seriesKey: resultSeriesKey },
  ];
}

function buildR1DerivationParts(prevRuleTerm, step2Rule, r2Term, prevR1Key, r2Key) {
  const prevLabel = formatRuleValue(prevRuleTerm, step2Rule === 'geometric');

  if (step2Rule === 'geometric') {
    const ratioRaw = displayTerm(r2Term);
    const ratioLabel = ratioRaw.startsWith('-') ? `(${ratioRaw})` : ratioRaw;
    return [
      { text: ' (' },
      { text: prevLabel, r1Key: prevR1Key },
      { text: ' × ' },
      { text: ratioLabel, r2Key },
      { text: ')' },
    ];
  }

  const raw = displayTerm(r2Term);
  const op = termValue(r2Term) >= 0 ? '+' : '-';
  return [
    { text: ' (' },
    { text: prevLabel, r1Key: prevR1Key },
    { text: ` ${op} ` },
    { text: raw.replace('-', ''), r2Key },
    { text: ')' },
  ];
}

function buildOneStepValidationRows(item) {
  const primaryRule = item.step1Rule || item.rule;
  const model = getModelForItem(item);
  const { terms } = item;

  if (!terms?.length || !primaryRule) return [];

  if (isRecurrenceModel(model)) {
    if (primaryRule === 'addition') {
      return [
        {
          kind: 'seed',
          seriesValue: 'Seeds',
          d1Value: '—',
          expression: `${displayTerm(terms[0])}, ${displayTerm(terms[1])}`,
          color: accent,
        },
        ...terms.slice(2).map((term, index) => ({
          kind: 'step',
          seriesValue: `${displayTerm(terms[index])}, ${displayTerm(terms[index + 1])}`,
          d1Value: `${formatRuleValue(terms[index], false)}, ${formatRuleValue(terms[index + 1], false)}`,
          expression: `${formatAdditionRuleLabel(terms[index], terms[index + 1])} = ${displayTerm(term)}`,
          color: colors.success,
        })),
      ];
    }

    if (primaryRule === 'multiplication') {
      return [
        {
          kind: 'seed',
          seriesValue: 'Seeds',
          d1Value: '—',
          expression: `${displayTerm(terms[0])}, ${displayTerm(terms[1])}`,
          color: accent,
        },
        ...terms.slice(2).map((term, index) => ({
          kind: 'step',
          seriesValue: `${displayTerm(terms[index])}, ${displayTerm(terms[index + 1])}`,
          d1Value: `${formatRuleValue(terms[index], true)}, ${formatRuleValue(terms[index + 1], true)}`,
          expression: `${formatMultiplicationRuleLabel(terms[index], terms[index + 1])} = ${displayTerm(term)}`,
          color: '#60a5fa',
        })),
      ];
    }
  }

  if (primaryRule === 'arithmetic' && item.inc) {
    const d1Value = formatRuleValue(item.inc, false);
    return terms.slice(1).map((term, index) => ({
      kind: 'step',
      seriesValue: displayTerm(terms[index]),
      seriesKey: `term-${index}`,
      d1Value,
      r1Key: 'r1-constant',
      expression: `${displayTerm(terms[index])} ${termValue(item.inc) >= 0 ? '+' : '-'} ${displayTerm(item.inc).replace('-', '')} = ${displayTerm(term)}`,
      expressionParts: buildSeriesValidationParts(terms[index], item.inc, term, false, `term-${index}`, `term-${index + 1}`).map((part, partIndex) => (
        partIndex === 2 ? { ...part, r1Key: 'r1-constant' } : part
      )),
      color: termValue(item.inc) >= 0 ? colors.success : '#ef4444',
    }));
  }

  if (primaryRule === 'geometric' && item.ratio) {
    const ratio = displayTerm(item.ratio);
    const d1Value = formatRuleValue(item.ratio, true);
    return terms.slice(1).map((term, index) => ({
      kind: 'step',
      seriesValue: displayTerm(terms[index]),
      seriesKey: `term-${index}`,
      d1Value,
      r1Key: 'r1-constant',
      expression: `${displayTerm(terms[index])} × ${ratio} = ${displayTerm(term)}`,
      expressionParts: buildSeriesValidationParts(terms[index], item.ratio, term, true, `term-${index}`, `term-${index + 1}`).map((part, partIndex) => (
        partIndex === 2 ? { ...part, r1Key: 'r1-constant' } : part
      )),
      color: '#60a5fa',
    }));
  }

  return [];
}

function buildTwoStepValidationRows(item) {
  const model = getModelForItem(item);
  const { terms, derivative } = item;
  if (model?.stepType !== 'two' || !terms?.length || !derivative?.length) return [];

  const primaryIsMultiply = model.step1Rule === 'geometric';
  const r2Term = model.step2Rule === 'geometric'
    ? divideTerms(derivative[1], derivative[0])
    : subtractTerms(derivative[1], derivative[0]);
  const r2Value = formatRuleValue(r2Term, model.step2Rule === 'geometric');

  return [
    ...terms.slice(1).map((term, index) => ({
      kind: 'step',
      seriesValue: displayTerm(terms[index]),
      seriesKey: `term-${index}`,
      d1Value: formatRuleValue(derivative[index], primaryIsMultiply),
      r1Key: `r1-${index}`,
      r1Parts: [
        { text: formatRuleValue(derivative[index], primaryIsMultiply), r1Key: `r1-${index}` },
        ...(index > 0 ? buildR1DerivationParts(derivative[index - 1], model.step2Rule, r2Term, `r1-${index - 1}`, `r2-${index - 1}`) : []),
      ],
      r2Value,
      r2Key: `r2-${index}`,
      expression: `${formatTermApplication(terms[index], derivative[index], primaryIsMultiply)} = ${displayTerm(term)}`,
      expressionParts: buildSeriesValidationParts(terms[index], derivative[index], term, primaryIsMultiply, `term-${index}`, `term-${index + 1}`).map((part, partIndex) => (
        partIndex === 2 ? { ...part, r1Key: `r1-${index}` } : part
      )),
      color: primaryIsMultiply ? '#60a5fa' : (termValue(derivative[index]) < 0 ? '#ef4444' : colors.success),
    })),
    {
      kind: 'answer',
      seriesValue: displayTerm(terms[terms.length - 1]),
      seriesKey: `term-${terms.length - 1}`,
      isAnswerRow: true,
      d1Value: '',
      r2Value: '',
      expression: '',
      expressionParts: [],
      color: accent,
    },
  ];
}

// ── SeriesVisual ──────────────────────────────────────────────────────────────

function SeriesVisual({
  item,
  showDeltas,
  accent: itemAccent,
  revealAnswer = false,
  highlightSeriesKey = null,
  onSeriesHoverChange = null,
  highlightR1Key = null,
  onR1HoverChange = null,
  highlightR2Key = null,
  onR2HoverChange = null,
}) {
  const containerRef  = useRef(null);
  const boxRefs       = useRef([]);
  const connectorRefs = useRef([]);
  const d1BadgeRefs   = useRef([]);
  const [svgLines, setSvgLines]     = useState([]);
  const [d2Overlays, setD2Overlays] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

  const { terms, missingIndex } = item;
  const model = getModelForItem(item);

  // ── D1 / rule trace — built from generation parameters, not back-computed ────
  const primaryRule  = item.step1Rule || item.rule;
  const isGeoPrimary = primaryRule === 'geometric' || primaryRule === 'multiplication';
  const isRecurrencePrimary = isRecurrenceModel(model);

  const fmtVal = (v) => {
    const abs = Number.isInteger(v) ? String(Math.abs(v)) : Math.abs(v).toFixed(2).replace(/\.?0+$/, '');
    return { abs, sign: v >= 0 ? '+' : '-' };
  };

  const d1Display = terms.map((_, i) => {
    if (i === 0) return null;
    // Two-step: derivative array holds the actual adders/multipliers used
    if (item.derivative) {
      const d = item.derivative[i - 1];
      if (!d) return null;
      const v = termValue(d);
      const { abs } = fmtVal(v);
      return isGeoPrimary
        ? { label: `×${abs}`, value: v, isMultiply: true }
        : { label: v >= 0 ? `+${abs}` : `-${abs}`, value: v, isMultiply: false };
    }
    // One-step arithmetic: constant inc
    if (primaryRule === 'arithmetic' && item.inc) {
      const v = termValue(item.inc);
      const { abs } = fmtVal(v);
      return { label: v >= 0 ? `+${abs}` : `-${abs}`, value: v, isMultiply: false };
    }
    // One-step geometric: constant ratio
    if (primaryRule === 'geometric' && item.ratio) {
      const v = termValue(item.ratio);
      const { abs } = fmtVal(v);
      return { label: `×${abs}`, value: v, isMultiply: true };
    }
    // Recurrence models are validated in the side panel, not as D1 rule badges.
    if (isRecurrencePrimary) {
      return null;
    }
    return null;
  });

  const d1Labels = d1Display.map(e => e ? e.label : null);

  const inferredD1 = new Set();
  if (isRecurrencePrimary) {
    for (let i = 2; i < terms.length; i++) {
      if (missingIndex === i || missingIndex === i - 1 || missingIndex === i - 2) {
        inferredD1.add(i);
      }
    }
  } else {
    inferredD1.add(missingIndex);
    if (missingIndex + 1 < terms.length) inferredD1.add(missingIndex + 1);
  }

  const d1Color = d1Display.map((e) => {
    if (!e) return null;
    if (e.isMultiply) return '#60a5fa';
    return e.value < 0 ? '#ef4444' : colors.success;
  });

  // ── D2 — built from item.derivative directly (always constant) ───────────
  const d2LabelFor = {};
  if (item.step2Rule && item.derivative) {
    for (let i = 1; i < terms.length - 1; i++) {
      const v1 = termValue(item.derivative[i - 1]);
      const v2 = termValue(item.derivative[i]);
      if (item.step2Rule === 'geometric') {
        if (v1 !== 0) {
          const ratio    = v2 / v1;
          const ratioStr = Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(2).replace(/\.?0+$/, '');
          d2LabelFor[i]  = { label: `×${ratioStr}`, diff: ratio, isMultiply: true };
        }
      } else {
        const diff = v2 - v1;
        const { abs } = fmtVal(diff);
        d2LabelFor[i] = { label: diff >= 0 ? `+${abs}` : `-${abs}`, diff, isMultiply: false };
      }
    }
  }
  const hasD2 = !!item.step2Rule && Object.keys(d2LabelFor).length > 0;

  const d2EntryColor = (entry) => entry.isMultiply ? '#60a5fa' : (entry.diff < 0 ? '#ef4444' : colors.success);

  const d1LayoutKey = d1Labels.map((label) => label || '').join('|');
  const d2LayoutKey = JSON.stringify(Object.entries(d2LabelFor));

  const baseBoxH = showDeltas ? 64 : 73;
  const baseConnectorW = showDeltas ? 42 : 50;
  const baseLineW = showDeltas ? 28 : 34;
  const baseBoxFont = showDeltas ? 22 : 25;
  const baseLabelFont = 14;
  const baseD1Top = showDeltas ? -58 : -65;
  const baseTopPadding = showDeltas ? 100 : 22;
  const availableWidth = Math.max(0, containerWidth - (showDeltas ? 20 : 0));
  const baseSeriesWidth = (terms.length * baseBoxH) + (Math.max(terms.length - 1, 0) * baseConnectorW);
  const widthScale = availableWidth > 0 && baseSeriesWidth > 0
    ? Math.min(1, availableWidth / baseSeriesWidth)
    : 1;
  const scale = showDeltas ? Math.max(0.66, widthScale) : Math.max(0.78, widthScale);
  const BOX_H = Math.round(baseBoxH * scale);
  const CONNECTOR_W = Math.round(baseConnectorW * scale);
  const LINE_W = Math.round(baseLineW * scale);
  const BOX_FONT = Math.max(18, Math.round(baseBoxFont * scale));
  const LABEL_FONT = Math.max(11, Math.round(baseLabelFont * scale));
  const D1_TOP = Math.round(baseD1Top * scale);
  const ARROW = Math.max(4, Math.round(5 * scale));
  const topPadding = Math.round(baseTopPadding * scale);
  const badgePaddingY = Math.max(2, Math.round(2 * scale));
  const badgePaddingX = Math.max(5, Math.round(7 * scale));
  const boxPaddingX = Math.max(8, Math.round(14 * scale));
  const d2YOffset = Math.round(34 * scale);

  useLayoutEffect(() => {
    let frameId = 0;
    let resizeObserver;

    const updateLayout = () => {
      const container = containerRef.current;
      if (!container || !showDeltas) {
        setSvgLines([]);
        setD2Overlays([]);
        return;
      }

      const layoutD1Labels = d1LayoutKey ? d1LayoutKey.split('|') : [];
      const layoutD2Entries = d2LayoutKey ? JSON.parse(d2LayoutKey) : [];
      const layoutD2Map = Object.fromEntries(layoutD2Entries);

      const cr = container.getBoundingClientRect();
      if (cr.width === 0) return;
      setContainerWidth((prev) => (prev === Math.round(cr.width) ? prev : Math.round(cr.width)));

      const firstBox = boxRefs.current.find(Boolean);
      if (!firstBox) return;

      const lines = [];
      const newD2Overlays = [];

      connectorRefs.current.forEach((el, i) => {
        if (!el || !layoutD1Labels[i]) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - cr.left;
        const badgeCenterY = r.top - cr.top + D1_TOP + 9;

        const nextEl = connectorRefs.current[i + 1];
        if (!nextEl || !layoutD1Labels[i + 1]) return;
        const nr = nextEl.getBoundingClientRect();
        const cx2 = nr.left + nr.width / 2 - cr.left;
        const nextBadgeCenterY = nr.top - cr.top + D1_TOP + 9;
        const lineY = (badgeCenterY + nextBadgeCenterY) / 2;

        const badgeEl = d1BadgeRefs.current[i];
        const nextBadgeEl = d1BadgeRefs.current[i + 1];
        const x1 = badgeEl ? badgeEl.getBoundingClientRect().right - cr.left : r.right - cr.left;
        const x2 = nextBadgeEl ? nextBadgeEl.getBoundingClientRect().left - cr.left : nr.left - cr.left;

        const d2Entry = layoutD2Map[String(i)];
        const connColor = (hasD2 && d2Entry) ? d2EntryColor(d2Entry) : '#60a5fa';
        lines.push({ x1, y1: lineY, x2, y2: lineY, color: connColor, opacity: 0.35, arrow: true });

        if (hasD2 && d2Entry) {
          const mx = (cx + cx2) / 2;
          newD2Overlays.push({ x: mx, y: badgeCenterY - d2YOffset, label: d2Entry.label, color: d2EntryColor(d2Entry), key: `r2-${i - 1}` });
        }
      });

      setSvgLines(lines);
      setD2Overlays(newD2Overlays);
    };

    const scheduleLayout = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateLayout);
    };

    scheduleLayout();
    window.addEventListener('resize', scheduleLayout);

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(scheduleLayout);
      [
        containerRef.current,
        ...boxRefs.current,
        ...connectorRefs.current,
        ...d1BadgeRefs.current,
      ].filter(Boolean).forEach((node) => resizeObserver.observe(node));
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleLayout);
      resizeObserver?.disconnect();
    };
  }, [showDeltas, d1LayoutKey, d2LayoutKey, hasD2, D1_TOP, d2YOffset]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        flexWrap: 'nowrap', justifyContent: 'center',
        paddingTop: topPadding, paddingBottom: 12, gap: 0,
      }}
    >
      {/* SVG layer: tick lines and D1-level horizontal connectors */}
      {svgLines.length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          {svgLines.map((l, idx) => {
            if (l.arrow) {
              const A = 4; // arrowhead size for D1-level lines
              return (
                <g key={idx}>
                  <line
                    x1={l.x1} y1={l.y1} x2={l.x2 - A} y2={l.y2}
                    stroke={l.color} strokeWidth={1} strokeOpacity={l.opacity ?? 0.35}
                  />
                  <polygon
                    points={`${l.x2 - A},${l.y2 - A / 2} ${l.x2},${l.y2} ${l.x2 - A},${l.y2 + A / 2}`}
                    fill={l.color} fillOpacity={(l.opacity ?? 0.35) + 0.15}
                  />
                </g>
              );
            }
            return (
              <line
                key={idx}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={l.color} strokeWidth={1}
                strokeOpacity={l.opacity ?? 0.45}
                strokeDasharray={l.dash ? '3 3' : undefined}
              />
            );
          })}
        </svg>
      )}

      {/* D2 badge overlays */}
      {showDeltas && d2Overlays.map((lbl, idx) => (
        <div key={idx} style={{
          position: 'absolute', left: lbl.x, top: lbl.y,
          transform: 'translate(-50%, -50%)',
          fontSize: LABEL_FONT, fontWeight: 700, fontFamily: FONT_MONO, whiteSpace: 'nowrap',
          color: highlightR2Key === lbl.key ? '#a78bfa' : lbl.color,
          background: highlightR2Key === lbl.key ? 'rgba(167,139,250,0.22)' : `${lbl.color}22`,
          border: `1px solid ${highlightR2Key === lbl.key ? '#a78bfa' : lbl.color}88`,
          borderRadius: 2, padding: `${badgePaddingY}px ${badgePaddingX}px`,
          pointerEvents: 'auto',
          cursor: onR2HoverChange ? 'pointer' : 'default',
          boxShadow: highlightR2Key === lbl.key ? '0 0 0 1px rgba(167,139,250,0.88) inset' : 'none',
        }}
          onMouseEnter={onR2HoverChange ? () => onR2HoverChange(lbl.key) : undefined}
          onMouseLeave={onR2HoverChange ? () => onR2HoverChange(null) : undefined}
        >{lbl.label}</div>
      ))}

      {/* Terms row */}
      {terms.map((term, i) => {
        const isMissing  = i === missingIndex;
        const connColor  = d1Color[i] || colors.success;
        const isInferred = inferredD1.has(i);
        const isSeriesHighlighted = highlightSeriesKey === `term-${i}`;
        const r1HoverKey = item.derivative ? `r1-${i - 1}` : (i > 0 ? 'r1-constant' : null);
        const isR1Highlighted = r1HoverKey && highlightR1Key === r1HoverKey;
        const boxBorderColor = isSeriesHighlighted ? '#a78bfa' : (isMissing ? itemAccent : 'rgba(255,255,255,0.12)');
        const boxBackground = isSeriesHighlighted ? 'rgba(167,139,250,0.14)' : (isMissing ? `${itemAccent}22` : 'rgba(255,255,255,0.04)');
        const boxTextColor = isSeriesHighlighted ? '#a78bfa' : (isMissing ? itemAccent : C.text);

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div
                ref={el => { connectorRefs.current[i] = el; }}
                style={{ position: 'relative', width: CONNECTOR_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* D1 badge */}
                <div ref={el => { d1BadgeRefs.current[i] = el; }} style={{
                  position: 'absolute', top: D1_TOP, left: '50%', transform: 'translateX(-50%)',
                  fontSize: LABEL_FONT, fontWeight: 700, fontFamily: FONT_MONO, whiteSpace: 'nowrap',
                  color:      (showDeltas && d1Labels[i]) ? (isR1Highlighted ? '#a78bfa' : connColor) : 'transparent',
                  background: (showDeltas && d1Labels[i]) ? (isR1Highlighted ? 'rgba(167,139,250,0.22)' : `${connColor}22`) : 'transparent',
                  border:     (showDeltas && d1Labels[i])
                    ? `1px ${isInferred ? 'dashed' : 'solid'} ${(isR1Highlighted ? '#a78bfa' : connColor)}${isInferred ? 'cc' : '88'}`
                    : '1px solid transparent',
                  borderRadius: 2, padding: `${badgePaddingY}px ${badgePaddingX}px`,
                  cursor: r1HoverKey && onR1HoverChange ? 'pointer' : 'default',
                  boxShadow: isR1Highlighted ? '0 0 0 1px rgba(167,139,250,0.88) inset' : 'none',
                }}
                  onMouseEnter={r1HoverKey && onR1HoverChange ? () => onR1HoverChange(r1HoverKey) : undefined}
                  onMouseLeave={r1HoverKey && onR1HoverChange ? () => onR1HoverChange(null) : undefined}
                >
                  {d1Labels[i] || '+0'}
                </div>
                {/* Connector line with arrowhead */}
                <svg width={LINE_W} height={10} style={{ display: 'block' }}>
                  <line
                    x1={0} y1={5}
                    x2={LINE_W - ARROW - 1} y2={5}
                    stroke={connColor} strokeWidth={1.5} strokeOpacity={0.5}
                    strokeDasharray={isInferred ? '3 2' : undefined}
                  />
                  <polygon
                    points={`${LINE_W - ARROW - 1},${5 - ARROW / 2 - 0.5} ${LINE_W - 1},5 ${LINE_W - ARROW - 1},${5 + ARROW / 2 + 0.5}`}
                    fill={connColor}
                    fillOpacity={isInferred ? 0.3 : 0.5}
                  />
                </svg>
              </div>
            )}
            <div ref={el => { boxRefs.current[i] = el; }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                minWidth: BOX_H, height: BOX_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 2,
                border: `2px solid ${boxBorderColor}`,
                background: boxBackground,
                boxShadow: isSeriesHighlighted ? '0 0 0 2px rgba(167,139,250,0.85), 0 0 18px rgba(167,139,250,0.18)' : 'none',
                fontFamily: FONT_MONO, fontSize: BOX_FONT, fontWeight: 700,
                color: boxTextColor,
                padding: `0 ${boxPaddingX}px`,
                transition: 'box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease, color 0.12s ease',
                cursor: onSeriesHoverChange ? 'pointer' : 'default',
              }}>
                <span
                  onMouseEnter={onSeriesHoverChange ? () => onSeriesHoverChange(`term-${i}`) : undefined}
                  onMouseLeave={onSeriesHoverChange ? () => onSeriesHoverChange(null) : undefined}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
                >
                  {isMissing ? (revealAnswer ? item.answerDisplay : '?') : displayTerm(term)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Operations Reference Modal ────────────────────────────────────────────────

// Series operations — one entry per rule actually used across the current models.
// Arithmetic add/subtract are the same model (c can be positive or negative),
// so they share a single entry.
const SERIES_OPERATIONS = [
  {
    name: 'Arithmetic',
    symbol: '±c',
    formula: 'tₙ = tₙ₋₁ + c',
    example: '2, 5, 8, 11  (c = +3)  /  20, 15, 10, 5  (c = −5)',
    description: 'Each term is obtained by adding a fixed constant c (positive or negative) to the previous term.',
    color: colors.success,
  },
  {
    name: 'Geometric',
    symbol: '×r',
    formula: 'tₙ = tₙ₋₁ × r',
    example: '2, 6, 18, 54  (r = 3)',
    description: 'Each term is multiplied by a fixed ratio r. Produces exponential growth or decay.',
    color: '#60a5fa',
  },
  {
    name: 'Fibonacci / Additive',
    symbol: 'Fib',
    formula: 'tₙ = tₙ₋₁ + tₙ₋₂',
    example: '1, 2, 3, 5, 8, 13',
    description: 'Each term is the sum of the two preceding terms. Requires two seed values to start.',
    color: '#a78bfa',
  },
  {
    name: 'Consecutive Multiplication',
    symbol: 'Mul',
    formula: 'tₙ = tₙ₋₁ × tₙ₋₂',
    example: '2, 3, 6, 18, 108',
    description: 'Each term is the product of the two preceding terms. Values grow very rapidly.',
    color: '#f59e0b',
  },
  {
    name: 'Two-Step (Arithmetic R1)',
    symbol: 'R2+',
    formula: 'Δtₙ = Δtₙ₋₁ + d',
    example: '1, 2, 4, 7, 11  (R1: +1, +2, +3, +4)',
    description: 'The first differences (R1) themselves form an arithmetic sequence. R2 values are constant.',
    color: '#34d399',
  },
  {
    name: 'Two-Step (Geometric R1)',
    symbol: 'R2×',
    formula: 'Δtₙ = Δtₙ₋₁ × r',
    example: '1, 2, 4, 8, 16  (R1: +1, +2, +4, +8)',
    description: 'The first differences (R1) themselves form a geometric sequence. R2 values multiply by r.',
    color: '#38bdf8',
  },
];

const BASIC_OPERATIONS = [
  {
    name: 'Addition',
    symbol: '+',
    notation: 'a + b',
    example: '3 + 4 = 7',
    description: 'Combines two numbers into their total sum.',
    color: colors.success,
    models: [1, 3, 5, 7, 8, 9],
  },
  {
    name: 'Subtraction',
    symbol: '−',
    notation: 'a − b',
    example: '9 − 4 = 5',
    description: 'Finds the difference between two numbers. Occurs in arithmetic models when the step constant is negative.',
    color: '#ef4444',
    models: [1, 5, 7, 9],
  },
  {
    name: 'Multiplication',
    symbol: '×',
    notation: 'a × b',
    example: '6 × 7 = 42',
    description: 'Repeated addition; scales one number by another.',
    color: '#60a5fa',
    models: [2, 4, 6, 8, 9, 10],
  },
];

function OpCard({ op, formulaKey }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '110px 1fr',
      border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 12px', background: `${op.color}12`,
        borderRight: `2px solid ${op.color}44`,
        display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: op.color, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>{op.name}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: op.color }}>{op.symbol}</span>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.text, fontWeight: 600 }}>{op[formulaKey]}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMut }}>{op.example}</span>
        </div>
        <span style={{ fontSize: 11, color: C.textMut, lineHeight: 1.5 }}>{op.description}</span>
        {op.models && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: C.textMut, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Models:</span>
            {op.models.map(id => (
              <span key={id} style={{
                fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
                color: op.color, background: `${op.color}18`,
                border: `1px solid ${op.color}44`,
                borderRadius: 2, padding: '1px 5px',
              }}>{id}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OperationsReferenceModal({ open, onClose }) {
  const [tab, setTab] = useState('series');

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const tabs = [
    { id: 'series', label: 'Series Rules' },
    { id: 'basic',  label: 'Basic Operations' },
  ];

  return (
    <div style={sty.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...sty.modalCard, width: 'min(720px, 100%)' }}>
        <div style={sty.modalHeader}>
          <div>
            <h3 style={sty.modalTitle}>Operation Types</h3>
            <p style={sty.modalSubtitle}>
              {tab === 'series' ? 'Sequence rules used across the current number series models.' : 'Fundamental mathematical operations for reference.'}
            </p>
          </div>
          <button style={sty.modalClose} onClick={onClose}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.sep}`, padding: '0 20px', gap: 2, background: C.bg, flexShrink: 0 }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 14px', fontSize: 11, fontWeight: active ? 800 : 600,
                color: active ? accent : 'rgba(255,255,255,0.45)',
                background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                cursor: 'pointer', letterSpacing: '0.04em',
                textTransform: 'uppercase', fontFamily: FONT_SANS,
                marginBottom: -1, whiteSpace: 'nowrap',
              }}>{t.label}</button>
            );
          })}
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'series' && SERIES_OPERATIONS.map(op => <OpCard key={op.name} op={op} formulaKey="formula" />)}
          {tab === 'basic'  && BASIC_OPERATIONS.map(op  => <OpCard key={op.name} op={op} formulaKey="notation" />)}
        </div>
      </div>
    </div>
  );
}

// ── Proof Tracing tab ────────────────────────────────────────────────────────

function NumberSeriesValidationPanel({
  item,
  model,
  hoveredSeriesKey,
  onSeriesHoverChange,
  hoveredR1Key,
  onR1HoverChange,
  hoveredR2Key,
  onR2HoverChange,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const primaryRule = item.step1Rule || item.rule;
  const isOneStep = model?.stepType === 'one';
  const isTwoStep = model?.stepType === 'two';
  const hoverAccent = '#a78bfa';
  const gridTemplateColumns = isTwoStep
    ? '56px 132px 44px minmax(0, 1fr)'
    : '92px 72px minmax(0, 1fr)';
  const rows = isOneStep
    ? buildOneStepValidationRows(item)
    : isTwoStep
      ? buildTwoStepValidationRows(item)
      : [];
  const highlightStyle = {
    background: `${hoverAccent}22`,
    boxShadow: `0 0 0 1px ${hoverAccent}88 inset`,
    borderRadius: 2,
  };
  const visibleRowCount = 5;
  const rowBodyMaxHeight = visibleRowCount * 42;

  return (
    <div style={{
      width: 430,
      flex: '0 0 430px',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 2,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      alignSelf: 'stretch',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: `rgba(251,191,36,0.68)`, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Series Validation
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(prev => !prev)}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: showHelp ? `${accent}1a` : 'rgba(255,255,255,0.04)',
              color: showHelp ? accent : C.textMut,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: FONT_SANS,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Show validation help"
            title="Show validation help"
          >
            ?
          </button>
        </div>
        {showHelp ? (
          <div style={{
            position: 'absolute',
            top: 28,
            right: 0,
            width: 260,
            padding: '10px 12px',
            background: '#101827',
            border: `1px solid ${C.border}`,
            borderRadius: 2,
            boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
            fontSize: 11,
            color: C.textMut,
            lineHeight: 1.6,
            zIndex: 3,
          }}>
            {isOneStep
              ? 'Starts from the seed term, then reapplies the R1 Rule step by step until the final term is reached.'
              : isTwoStep
                ? 'Shows both layers of the transformation: R1 Rule applied to the series, and R2 Rule applied to the R1 rules.'
                : 'This panel currently validates one-step and two-step number series.'}
          </div>
        ) : null}
      </div>

      {(isOneStep || isTwoStep) ? (
        rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns,
              gap: 10,
              alignItems: 'end',
              paddingBottom: 2,
              borderBottom: `1px solid ${C.sep}`,
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: C.textMut,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                N
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                R1
              </span>
              {isTwoStep ? (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  R2
                </span>
              ) : null}
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Validation
              </span>
            </div>
            <div style={{ maxHeight: rowBodyMaxHeight, overflowY: 'auto', paddingRight: 4 }}>
              {rows.map((row, index) => (
                <div key={`${row.kind}-${index}`} style={{
                  display: 'grid',
                  gridTemplateColumns,
                  gap: 10,
                  alignItems: 'start',
                  padding: '2px 0',
                  borderTop: index === 0 ? 'none' : `1px solid ${C.sep}`,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: row.isAnswerRow ? accent : C.text,
                    fontFamily: FONT_MONO,
                    lineHeight: 1.25,
                    wordBreak: 'break-word',
                  }}>
                    {row.seriesKey ? (
                      <span
                        onMouseEnter={() => onSeriesHoverChange?.(row.seriesKey)}
                        onMouseLeave={() => onSeriesHoverChange?.(null)}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: hoveredSeriesKey === row.seriesKey ? '0 4px' : 0,
                          color: hoveredSeriesKey === row.seriesKey ? hoverAccent : (row.isAnswerRow ? accent : C.text),
                          ...(hoveredSeriesKey === row.seriesKey ? highlightStyle : {}),
                        }}
                      >
                        {row.seriesValue || '—'}
                      </span>
                    ) : (row.seriesValue || '—')}
                  </span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: row.color,
                    fontFamily: FONT_MONO,
                    lineHeight: 1.25,
                    whiteSpace: isTwoStep ? 'nowrap' : 'normal',
                    wordBreak: isTwoStep ? 'normal' : 'break-word',
                  }}>
                    {row.r1Parts
                      ? row.r1Parts.map((part, partIndex) => (
                        <span
                          key={partIndex}
                          onMouseEnter={
                            part.r1Key
                              ? () => onR1HoverChange?.(part.r1Key)
                              : part.r2Key
                                ? () => onR2HoverChange?.(part.r2Key)
                                : undefined
                          }
                          onMouseLeave={part.r1Key || part.r2Key ? () => { onR1HoverChange?.(null); onR2HoverChange?.(null); } : undefined}
                          style={{
                            cursor: part.r1Key || part.r2Key ? 'pointer' : 'default',
                            display: part.r1Key || part.r2Key ? 'inline-flex' : 'inline',
                            alignItems: part.r1Key || part.r2Key ? 'center' : undefined,
                            padding:
                              (part.r1Key && hoveredR1Key === part.r1Key) || (part.r2Key && hoveredR2Key === part.r2Key)
                                ? '0 4px'
                                : 0,
                            color:
                              (part.r1Key && hoveredR1Key === part.r1Key) || (part.r2Key && hoveredR2Key === part.r2Key)
                                ? hoverAccent
                                : row.color,
                            textDecoration: part.r2Key ? 'underline' : 'none',
                            textUnderlineOffset: part.r2Key ? '2px' : undefined,
                            ...(((part.r1Key && hoveredR1Key === part.r1Key) || (part.r2Key && hoveredR2Key === part.r2Key)) ? highlightStyle : {}),
                          }}
                        >
                          {part.text}
                        </span>
                      ))
                      : row.r1Key ? (
                        <span
                          onMouseEnter={() => onR1HoverChange?.(row.r1Key)}
                          onMouseLeave={() => onR1HoverChange?.(null)}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: hoveredR1Key === row.r1Key ? '0 4px' : 0,
                            color: hoveredR1Key === row.r1Key ? hoverAccent : row.color,
                            ...(hoveredR1Key === row.r1Key ? highlightStyle : {}),
                          }}
                        >
                          {row.d1Value || '—'}
                        </span>
                      ) : (row.d1Value || '—')}
                  </span>
                  {isTwoStep ? (
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: row.color,
                    fontFamily: FONT_MONO,
                    lineHeight: 1.25,
                    whiteSpace: isTwoStep ? 'nowrap' : 'normal',
                    wordBreak: isTwoStep ? 'normal' : 'break-word',
                  }}>
                    {row.r2Key ? (
                      <span
                        onMouseEnter={() => onR2HoverChange?.(row.r2Key)}
                        onMouseLeave={() => onR2HoverChange?.(null)}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: hoveredR2Key === row.r2Key ? '0 4px' : 0,
                          color: hoveredR2Key === row.r2Key ? hoverAccent : row.color,
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                          ...(hoveredR2Key === row.r2Key ? highlightStyle : {}),
                        }}
                      >
                        {row.r2Value || '—'}
                      </span>
                    ) : (row.r2Value || '—')}
                  </span>
                  ) : null}
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: row.color,
                    fontFamily: FONT_MONO,
                    lineHeight: 1.25,
                    whiteSpace: isTwoStep ? 'nowrap' : 'normal',
                    wordBreak: isTwoStep ? 'normal' : 'break-word',
                  }}>
                    {row.expressionParts
                      ? row.expressionParts.map((part, partIndex) => (
                        <span
                          key={partIndex}
                          onMouseLeave={part.seriesKey || part.r1Key || part.r2Key ? () => { onSeriesHoverChange?.(null); onR1HoverChange?.(null); onR2HoverChange?.(null); } : undefined}
                          onMouseEnter={
                            part.seriesKey
                              ? () => onSeriesHoverChange?.(part.seriesKey)
                              : part.r1Key
                                ? () => onR1HoverChange?.(part.r1Key)
                                : part.r2Key
                                  ? () => onR2HoverChange?.(part.r2Key)
                                : undefined
                          }
                          style={{
                            color: part.series
                              ? (part.seriesKey && hoveredSeriesKey === part.seriesKey ? hoverAccent : C.text)
                              : part.r1Key
                                ? (part.r1Key && hoveredR1Key === part.r1Key ? hoverAccent : row.color)
                                : part.r2Key
                                  ? (part.r2Key && hoveredR2Key === part.r2Key ? hoverAccent : row.color)
                              : row.color,
                            cursor: part.seriesKey || part.r1Key || part.r2Key ? 'pointer' : 'default',
                            display: part.seriesKey || part.r1Key || part.r2Key ? 'inline-flex' : 'inline',
                            alignItems: part.seriesKey || part.r1Key || part.r2Key ? 'center' : undefined,
                            padding:
                              (part.seriesKey && hoveredSeriesKey === part.seriesKey)
                              || (part.r1Key && hoveredR1Key === part.r1Key)
                              || (part.r2Key && hoveredR2Key === part.r2Key)
                                ? '0 4px'
                                : 0,
                            ...(((part.seriesKey && hoveredSeriesKey === part.seriesKey)
                              || (part.r1Key && hoveredR1Key === part.r1Key)
                              || (part.r2Key && hoveredR2Key === part.r2Key)) ? highlightStyle : {}),
                          }}
                        >
                          {part.text}
                        </span>
                      ))
                      : row.expression}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textMut, lineHeight: 1.6 }}>
            No validation steps are available for this rule yet.
          </div>
        )
      ) : (
        <div style={{ fontSize: 12, color: C.textMut, lineHeight: 1.6 }}>
          This model validation view is not implemented yet.
        </div>
      )}

      {(isOneStep || isTwoStep) && primaryRule && (
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${C.sep}`, fontSize: 11, color: C.textMut, lineHeight: 1.6 }}>
          Active rule: <span style={{ color: C.text, fontFamily: FONT_MONO }}>{primaryRule}</span>
          {isTwoStep && model?.step2Rule ? (
            <>
              {' · '}R2: <span style={{ color: C.text, fontFamily: FONT_MONO }}>{model.step2Rule}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ProofTracingTab({ item }) {
  const [showOpsModal, setShowOpsModal] = useState(false);
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState(null);
  const [hoveredR1Key, setHoveredR1Key] = useState(null);
  const [hoveredR2Key, setHoveredR2Key] = useState(null);
  if (item.analysisValid === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: C.textMut, lineHeight: 1.6 }}>
          Manual term edits detached this item from its original generated rule. Proof tracing is unavailable until the item is regenerated.
        </div>
        <SeriesVisual item={item} showDeltas={false} accent={accent} revealAnswer={true} />
      </div>
    );
  }

  const model = getModelForItem(item);

  const primaryRule  = item.step1Rule || item.rule;
  const isRecurrencePrimary = primaryRule === 'addition' || primaryRule === 'multiplication';

  const stepLabel = model?.stepType === 'two'
    ? 'Two-step model with derived-step behavior — R1 Rule and R2 Rule are shown.'
    : isRecurrencePrimary
      ? 'One-step model with recurrence behavior — use the validation tool to verify each R1 Rule application step by step.'
      : 'One-step model with constant-step behavior — R1 Rule is shown.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 11, color: C.textMut, letterSpacing: '0.03em' }}>{stepLabel}</p>
        <button
          type="button"
          onClick={() => setShowOpsModal(true)}
          style={{ ...sty.btnOut, padding: '4px 12px', fontSize: 11, flexShrink: 0 }}
        >Operation Types</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'nowrap', minWidth: 0 }}>
        <div style={{ flex: '1 1 540px', minWidth: 0 }}>
          <SeriesVisual
            item={item}
            showDeltas={true}
            accent={accent}
            revealAnswer={true}
            highlightSeriesKey={hoveredSeriesKey}
            onSeriesHoverChange={setHoveredSeriesKey}
            highlightR1Key={hoveredR1Key}
            onR1HoverChange={setHoveredR1Key}
            highlightR2Key={hoveredR2Key}
            onR2HoverChange={setHoveredR2Key}
          />
        </div>
        <NumberSeriesValidationPanel
          item={item}
          model={model}
          hoveredSeriesKey={hoveredSeriesKey}
          onSeriesHoverChange={setHoveredSeriesKey}
          hoveredR1Key={hoveredR1Key}
          onR1HoverChange={setHoveredR1Key}
          hoveredR2Key={hoveredR2Key}
          onR2HoverChange={setHoveredR2Key}
        />
      </div>

      <OperationsReferenceModal open={showOpsModal} onClose={() => setShowOpsModal(false)} />
    </div>
  );
}

// ── Editor Modal ──────────────────────────────────────────────────────────────

function NumberSeriesEditorModal({ open, item, onClose, onSave }) {
  const [draft, setDraft] = useState(() => (item ? createEditorDraft(item) : null));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open || !item || !draft) return null;

  const preview = applyDraftToItem(item, draft);
  const previewItem = preview.item || item;

  const save = () => {
    const result = applyDraftToItem(item, draft);
    if (result.error) { setError(result.error); return; }
    onSave(result.item);
  };

  const termInput = {
    background: '#111827', color: C.text,
    border: `1px solid rgba(251,191,36,0.22)`,
    borderRadius: 2, padding: '7px 10px',
    fontSize: 13, fontFamily: FONT_MONO, width: '100%', outline: 'none',
  };

  return (
    <div style={sty.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={sty.modalCard}>
        <div style={sty.modalHeader}>
          <div>
            <h3 style={sty.modalTitle}>Edit Number Series Item</h3>
            <p style={sty.modalSubtitle}>Adjust a single staged item, preview the result, and save the updated version back into the list.</p>
          </div>
          <button type="button" onClick={onClose} style={sty.modalClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', gap: 18, padding: 20, overflow: 'hidden', minHeight: 0, flex: 1 }}>
          {/* Left */}
          <div style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 6, minHeight: 0 }}>
            <div style={sty.section}>
              <h4 style={sty.title}>Item Setup</h4>
              <div style={sty.label}>Model</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: FONT_MONO }}>M{item.modelId} · {item.modelName}</div>
              <div style={sty.label}>Missing Position</div>
              <select
                value={draft.missingIndex}
                onChange={e => setDraft(cur => ({ ...cur, missingIndex: Number(e.target.value) }))}
                style={sty.sel}
              >
                {draft.termInputs.map((_, i) => <option key={i} value={i}>Term {i + 1}</option>)}
              </select>
            </div>

            <div style={sty.section}>
              <h4 style={sty.title}>Series Terms</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                {draft.termInputs.map((term, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={sty.label}>T{i + 1}</div>
                    <input
                      value={term}
                      onChange={e => setDraft(cur => ({ ...cur, termInputs: cur.termInputs.map((v, j) => j === i ? e.target.value : v) }))}
                      style={termInput}
                    />
                  </div>
                ))}
              </div>
              <div style={sty.helper}>Integers, fractions (3/4), or surds (2√3).</div>
            </div>

            {error && <div style={{ fontSize: 12, color: C.danger, fontWeight: 600 }}>{error}</div>}
          </div>

          {/* Right */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 6, minHeight: 0 }}>
            <div style={sty.section}>
              <h4 style={sty.title}>Preview</h4>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 2, color: C.text, padding: '10px 14px', background: 'rgba(10,15,26,0.7)', border: `1px solid ${C.border}`, borderRadius: 2, textAlign: 'center' }}>
                {previewItem.stem}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textMut }}>Answer:</span>
                <span style={{ fontFamily: FONT_MONO, color: accent, fontWeight: 700, fontSize: 18 }}>{previewItem.answerDisplay}</span>
              </div>
            </div>

            <div style={sty.section}>
              <h4 style={sty.title}>Item Details</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label={`${item.modelId}`} color={accent} />
                <Badge label={item.modelName} color={C.textMut} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: `1px solid ${C.sep}` }}>
          <div style={sty.helper}>Changes apply only to this staged item until you save.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={sty.btnOut}>Cancel</button>
            <button type="button" onClick={save} style={sty.btn}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Model Reference Modal ─────────────────────────────────────────────────────

const MODEL_OPERATIONS = {
  1:  [{ symbol: '+', color: colors.success }, { symbol: '−', color: '#ef4444' }],
  2:  [{ symbol: '×', color: '#60a5fa' }],
  3:  [{ symbol: '+', color: colors.success }],
  4:  [{ symbol: '×', color: '#60a5fa' }],
  5:  [{ symbol: '+', color: colors.success }, { symbol: '−', color: '#ef4444' }],
  6:  [{ symbol: '×', color: '#60a5fa' }],
  7:  [{ symbol: '+', color: colors.success }, { symbol: '−', color: '#ef4444' }],
  8:  [{ symbol: '+', color: colors.success }, { symbol: '×', color: '#60a5fa' }],
  9:  [{ symbol: '+', color: colors.success }, { symbol: '−', color: '#ef4444' }, { symbol: '×', color: '#60a5fa' }],
  10: [{ symbol: '×', color: '#60a5fa' }],
};

function ModelReferenceModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const cols = '40px 300px 250px 70px 140px 90px 110px 110px 100px';

  return (
    <div style={sty.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...sty.modalCard, width: 'min(1340px, 100%)' }}>
        <div style={sty.modalHeader}>
          <div>
            <h3 style={sty.modalTitle}>Number Series Models</h3>
            <p style={sty.modalSubtitle}>Reference table for available models and their generation properties.</p>
          </div>
          <button type="button" onClick={onClose} style={sty.modalClose} aria-label="Close">×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ width: 'max-content', display: 'inline-block', fontFamily: FONT_MONO, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '8px 12px', background: 'rgba(251,191,36,0.06)', borderBottom: `1px solid ${C.border}` }}>
              {['ID', 'Model Name', 'Description', 'Step', 'Behavior', 'Elements', 'Step 1', 'Step 2', 'Operations'].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(251,191,36,0.68)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
              ))}
            </div>
            {ALL_MODELS.map((model) => (
              <div key={model.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '7px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)`, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: accent }}>M{model.id}</span>
                <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.45 }}>{model.title}</span>
                <span style={{ fontSize: 11, color: '#7CFF6B', lineHeight: 1.45 }}>{model.description || '—'}</span>
                <span style={{ fontSize: 11, color: model.stepType === 'one' ? '#B792FF' : model.stepType === 'two' ? '#FFB347' : C.textMut }}>{model.stepType}</span>
                <span style={{ fontSize: 11, color: '#c4d4ff' }}>{model.behaviorType || getModelBehavior(model) || '—'}</span>
                <span style={{ fontSize: 11, color: C.textMut }}>{model.elementType}</span>
                <span style={{ fontSize: 11, color: '#c4d4ff' }}>{model.step1Rule || '—'}</span>
                <span style={{ fontSize: 11, color: '#c4d4ff' }}>{model.step2Rule || '—'}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(MODEL_OPERATIONS[model.id] || []).map(op => (
                    <span key={op.symbol} style={{
                      fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800,
                      color: op.color, background: `${op.color}20`,
                      border: `1px solid ${op.color}55`,
                      borderRadius: 2, padding: '1px 6px', lineHeight: 1.4,
                    }}>{op.symbol}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: `1px solid ${C.sep}` }}>
          <div style={sty.helper}>Use this table as a quick reference before selecting a specific model.</div>
          <button type="button" onClick={onClose} style={sty.btn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Batch Modal ───────────────────────────────────────────────────────────────

function NumberSeriesBatchModal({ open, onCancel, batchCount, onBatchCountChange, onGenerate, items, onSetStatus, onEdit, onAddAccepted, onRegenerateItem }) {
  const [batchModelChoice,   setBatchModelChoice]   = useState('');
  const [batchSeriesLength,  setBatchSeriesLength]  = useState(5);
  const [batchSeedMode,      setBatchSeedMode]      = useState('random');
  const [batchSeedValue,     setBatchSeedValue]     = useState(4);
  const [batchIncrMode,      setBatchIncrMode]      = useState('random');
  const [batchIncrValue,     setBatchIncrValue]     = useState(3);
  const [cancelConfirmOpen,  setCancelConfirmOpen]  = useState(false);
  const [addConfirmOpen,     setAddConfirmOpen]     = useState(false);
  const [generateConfirmOpen,setGenerateConfirmOpen]= useState(false);

  if (!open) return null;

  const handleCancel = () => {
    if (!items.length) {
      onCancel();
      return;
    }
    setCancelConfirmOpen(true);
  };

  const confirmCancel = () => {
    setCancelConfirmOpen(false);
    onCancel();
  };

  const acceptedCount = items.filter(it => it.status === 'accepted').length;
  const hasAccepted = acceptedCount > 0;
  const confirmAddAccepted = () => {
    setAddConfirmOpen(false);
    onAddAccepted();
  };
  const requestGenerate = () => {
    if (items.length) {
      setGenerateConfirmOpen(true);
      return;
    }
    onGenerate({ batchModelChoice, batchSeriesLength, batchSeedMode: effSeedMode, batchSeedValue, batchIncrMode: effIncrMode, batchIncrValue });
  };
  const confirmGenerate = () => {
    setGenerateConfirmOpen(false);
    onGenerate({ batchModelChoice, batchSeriesLength, batchSeedMode: effSeedMode, batchSeedValue, batchIncrMode: effIncrMode, batchIncrValue });
  };
  const cancelButtonStyle = {
    ...sty.btnOut,
    justifyContent: 'center',
    color: C.danger,
    borderColor: `${C.danger}80`,
    background: 'rgba(248,113,113,0.08)',
  };

  const batchModelId = typeof batchModelChoice === 'string' && batchModelChoice.startsWith('model-')
    ? Number(batchModelChoice.replace('model-', '')) : null;
  const batchModel = batchModelId ? getModel(batchModelId) || null : null;
  const paramCopy  = describeParameterControls(batchModel, batchSeedMode, batchSeedValue, batchIncrMode, batchIncrValue);
  const effSeedMode = paramCopy.seedExactDisabled && batchSeedMode === 'exact' ? 'random' : batchSeedMode;
  const effIncrMode = paramCopy.incrementExactDisabled && batchIncrMode === 'exact' ? 'random' : batchIncrMode;

  const modeBtn = (active, onClick, disabled) => ({
    ...sty.btn, width: 58, flexShrink: 0, padding: '4px 4px', fontSize: 11,
    opacity: disabled ? 0.3 : active ? 1 : 0.45, justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div style={sty.modalOverlay}>
      <div style={{ ...sty.modalCard, width: 'min(1200px, 100%)', flexDirection: 'row' }}>

        {/* ── Left: Parameters ── */}
        <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.sep}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.sep}` }}>
            <h3 style={sty.modalTitle}>Batch Generate</h3>
            <p style={sty.modalSubtitle}>Configure parameters, then generate.</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Item Model */}
            <div>
              <div style={sty.label}>Item Model</div>
              <select value={batchModelChoice} onChange={e => setBatchModelChoice(e.target.value)} style={sty.sel}>
                <option value="">Random item model</option>
                {ALL_MODELS.map(m => (
                  <option key={m.id} value={`model-${m.id}`}>{m.id} · {m.name}</option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div>
              <div style={sty.label}>Count</div>
              <input type="number" min={1} max={12} value={batchCount} onChange={e => onBatchCountChange(e.target.value)} style={{ ...sty.sel, width: 80 }} />
              <div style={sty.helper}>Up to 12 items per batch.</div>
            </div>

            {/* Series Length */}
            <div>
              <div style={sty.label}>Series Length</div>
              <input
                type="number" min={5} max={7} value={batchSeriesLength}
                onChange={e => setBatchSeriesLength(Math.min(7, Math.max(5, Number(e.target.value))))}
                style={{ ...sty.sel, width: 80 }}
              />
            </div>


            {/* Starting Value */}
            <div>
              <div style={sty.label}>{paramCopy.seedLabel}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {['exact', 'random'].map(mode => (
                  <button key={mode} type="button"
                    onClick={() => !(mode === 'exact' && paramCopy.seedExactDisabled) && setBatchSeedMode(mode)}
                    disabled={mode === 'exact' && paramCopy.seedExactDisabled}
                    style={modeBtn(effSeedMode === mode, null, mode === 'exact' && paramCopy.seedExactDisabled)}
                  >{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                ))}
                <NumStepper value={batchSeedValue} onChange={setBatchSeedValue} style={{ width: 72, flexShrink: 1 }} />
              </div>
              <div style={sty.helper}>{paramCopy.seedHelper}</div>
            </div>

            {/* Rule Parameter */}
            <div>
              <div style={sty.label}>{paramCopy.incrementLabel}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {['exact', 'random'].map(mode => (
                  <button key={mode} type="button"
                    onClick={() => !paramCopy.incrementDisabled && !(mode === 'exact' && paramCopy.incrementExactDisabled) && setBatchIncrMode(mode)}
                    disabled={paramCopy.incrementDisabled || (mode === 'exact' && paramCopy.incrementExactDisabled)}
                    style={modeBtn(effIncrMode === mode, null, paramCopy.incrementDisabled || (mode === 'exact' && paramCopy.incrementExactDisabled))}
                  >{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                ))}
                <NumStepper value={batchIncrValue} onChange={setBatchIncrValue} disabled={paramCopy.incrementDisabled} style={{ width: 72, flexShrink: 1 }} />
              </div>
              <div style={sty.helper}>{paramCopy.incrementHelper}</div>
            </div>

          </div>

          {/* Action buttons */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.sep}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={requestGenerate} style={{ ...sty.btn, justifyContent: 'center' }}>Generate</button>
            <button type="button" onClick={handleCancel} style={cancelButtonStyle}>Cancel</button>
            <button type="button" onClick={() => setAddConfirmOpen(true)} style={{ ...sty.btnBank, justifyContent: 'center', opacity: hasAccepted ? 1 : 0.45, cursor: hasAccepted ? 'pointer' : 'not-allowed' }} disabled={!hasAccepted}>
              Add Accepted ({acceptedCount}) to Bank
            </button>
          </div>
        </div>

        {/* ── Right: Item list ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.sep}` }}>
            <h4 style={{ ...sty.modalTitle, fontSize: 14 }}>Generated Items</h4>
            <p style={sty.modalSubtitle}>Review each item and accept or reject before adding to the bank.</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length > 0 ? items.map((item, idx) => {
              const borderAccent = item.status === 'accepted' ? C.success
                : item.status === 'rejected' ? C.danger : C.border;
              return (
                <div key={item._key} style={{
                  background: C.card, borderRadius: 2,
                  border: `1px solid ${C.border}`, borderLeft: `3px solid ${borderAccent}`,
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, fontWeight: 900, fontFamily: FONT_MONO, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, padding: '4px 8px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(34,211,238,0.08))', boxShadow: '0 0 18px rgba(251,191,36,0.16)' }}>
                    ID {item.bankId || 'pending'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge label={`Item ${idx + 1}`} color={accent} />
                    <span style={{ fontSize: 12, color: C.textMut, fontFamily: FONT_MONO }}>M{item.modelId} · {item.modelName}</span>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 2, color: C.text, padding: '10px 14px', background: 'rgba(10,15,26,0.7)', border: `1px solid ${C.border}`, borderRadius: 2, textAlign: 'center' }}>
                    {item.stem}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textMut }}>Answer:</span>
                    <span style={{ fontFamily: FONT_MONO, color: accent, fontWeight: 700, fontSize: 16 }}>{item.answerDisplay}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => onSetStatus(item._key, 'accepted')} style={{ ...sty.btnBank, padding: '4px 12px', fontSize: 11, opacity: item.status === 'accepted' ? 1 : 0.6 }}>
                      {item.status === 'accepted' ? '✓ Accepted' : 'Accept'}
                    </button>
                    <button type="button" onClick={() => onSetStatus(item._key, 'rejected')} style={{ ...sty.btnOut, padding: '4px 12px', fontSize: 11, color: C.danger, borderColor: `${C.danger}60`, opacity: item.status === 'rejected' ? 1 : 0.6 }}>
                      {item.status === 'rejected' ? '✗ Rejected' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerateItem(item._key, {
                        batchModelChoice,
                        batchSeriesLength,
                        batchSeedMode: effSeedMode,
                        batchSeedValue,
                        batchIncrMode: effIncrMode,
                        batchIncrValue,
                      })}
                      style={{
                        ...sty.btnOut,
                        padding: '4px 12px',
                        fontSize: 11,
                        color: '#38bdf8',
                        borderColor: 'rgba(56,189,248,0.45)',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(37,99,235,0.08))',
                        boxShadow: '0 0 16px rgba(56,189,248,0.12)',
                      }}
                      title={`Regenerate item ${idx + 1}`}
                      aria-label={`Regenerate item ${idx + 1}`}
                    >Regenerate</button>
                    <button type="button" onClick={() => onEdit(item._key)} style={{ ...sty.btnOut, padding: '4px 12px', fontSize: 11 }}>Edit</button>
                  </div>
                </div>
              );
            }) : (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2, padding: 36, textAlign: 'center', color: C.textMut, fontSize: 13 }}>
                Click <strong style={{ color: C.text }}>Generate</strong> to preview the batch here.
              </div>
            )}
          </div>
        </div>

        {addConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add accepted items?</div>
              <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
                This will add {acceptedCount} accepted item{acceptedCount === 1 ? '' : 's'} to the item bank and remove them from this batch review list.
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
            <div style={{ width: 'min(500px, 100%)', border: `1px solid ${C.warn}66`, borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1a1620 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(251,191,36,0.12)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.warn, marginBottom: 10 }}>Replace generated batch?</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Generate a new number-series batch?</div>
              <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
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
            <div style={{ width: 'min(460px, 100%)', border: `1px solid ${C.danger}66`, borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1f1118 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(248,113,113,0.12)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.danger, marginBottom: 10 }}>Discard generated batch?</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Close batch generator</div>
              <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
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

// ── Main Generator ─────────────────────────────────────────────────────────────

export default function NumberSeriesGenerator() {
  const [modelChoice, setModelChoice]           = useState('');
  const [seriesLength, setSeriesLength]         = useState(5);
  const [batchCount, setBatchCount]             = useState('4');
  const [seedMode, setSeedMode]                 = useState('exact');
  const [seedValue, setSeedValue]               = useState(1);
  const [incrementMode, setIncrementMode]       = useState('exact');
  const [incrementValue, setIncrementValue]     = useState(1);
  const [singleFormula, setSingleFormula]       = useState(null);
  const [staged, setStaged]                     = useState([]);
  const [editingKey, setEditingKey]             = useState(null);
  const [batchModalOpen, setBatchModalOpen]     = useState(false);
  const [singleAddConfirmOpen, setSingleAddConfirmOpen] = useState(false);
  const [showModelReference, setShowModelReference] = useState(false);
  const [activeTab, setActiveTab]               = useState('proof');
  const [controlsHidden, setControlsHidden]     = useState(false);
  const [toast, setToast]                       = useState(null);
  const [activeTooltip, setActiveTooltip]       = useState(null);
  const toastTimeoutRef                         = useRef(null);
  const leftPaneWidth = 320;
  const controlsRailWidth = 26;


  const selectedModelId = typeof modelChoice === 'string' && modelChoice.startsWith('model-')
    ? Number(modelChoice.replace('model-', ''))
    : null;
  const selectedModel = selectedModelId ? getModel(selectedModelId) || null : null;
  const randomPool    = ALL_MODELS;
  const showToast = (messageOrConfig, options = {}) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    const toastConfig = typeof messageOrConfig === 'string'
      ? { message: messageOrConfig, type: options.type || 'info', details: options.details || [] }
      : {
        message: messageOrConfig.message,
        type: messageOrConfig.type || 'info',
        details: messageOrConfig.details || [],
      };

    const nextToast = { ...toastConfig, expanded: false };
    if (nextToast.type !== 'error') {
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 2000);
    }
    setToast(nextToast);
  };
  const parameterCopy = describeParameterControls(selectedModel, seedMode, seedValue, incrementMode, incrementValue);
  const effectiveMissingPos = seriesLength - 1;
  const effectiveSeedMode = parameterCopy.seedExactDisabled && seedMode === 'exact' ? 'random' : seedMode;
  const effectiveIncrementMode = parameterCopy.incrementExactDisabled && incrementMode === 'exact' ? 'random' : incrementMode;
  const singleItem = useMemo(() => getNumberSeriesItemFromFormula(singleFormula), [singleFormula]);

  const openBatchModal = () => {
    setStaged([]);
    setBatchModalOpen(true);
  };

  const cancelBatchModal = () => {
    setStaged([]);
    setBatchModalOpen(false);
  };

  const buildBatchItems = (count, params = {}, excludedSignatures = new Set()) => {
    const {
      batchModelChoice = '',
      batchSeriesLength: bSL = seriesLength,
      batchSeedMode: bSM = effectiveSeedMode,
      batchSeedValue: bSV = seedValue,
      batchIncrMode: bIM = effectiveIncrementMode,
      batchIncrValue: bIV = incrementValue,
    } = params;

    const batchModelId = typeof batchModelChoice === 'string' && batchModelChoice.startsWith('model-')
      ? Number(batchModelChoice.replace('model-', '')) : null;
    const batchModel = batchModelId ? getModel(batchModelId) || null : null;
    const validationError = validateGenerationSettings(batchModel, bSM, bSV, bIM, bIV);
    if (validationError) {
      return { items: [], validationError, safeCount: 0 };
    }

    const parsedCount = Number.parseInt(count, 10);
    const safeCount = Number.isFinite(parsedCount) ? Math.min(Math.max(parsedCount, 1), 12) : 4;
    const effMissing = bSL - 1;
    const settings = buildNumberSeriesGenerationSettings({
      seedMode: bSM,
      seedValue: bSV,
      incrementMode: bIM,
      incrementValue: bIV,
      missingPosition: effMissing,
      responseFormat: 'open',
      seriesLength: bSL,
    });

    const items = [];
    const pool = batchModel ? [batchModel] : randomPool;
    const seen = new Set(excludedSignatures);
    const maxAttempts = safeCount * 10;

    for (let i = 0; i < maxAttempts && items.length < safeCount; i++) {
      // eslint-disable-next-line react-hooks/purity
      const model = pool[Math.floor(Math.random() * pool.length)];
      const item = generateSeriesItem(model, settings);
      if (item && !seen.has(item.signature)) {
        seen.add(item.signature);
        item.responseFormat = 'open';
        item.distractors = [];
        item.bankId = genBankId('nseries');
        item.formula = buildNumberSeriesFormula(settings, item, { generatedAt: new Date().toISOString() });
        // eslint-disable-next-line react-hooks/purity
        item._key = `ns-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        item.status = 'pending';
        items.push(item);
      }
    }

    return { items, validationError: null, safeCount };
  };

  const generateBatch = (params = {}) => {
    const { items, validationError, safeCount } = buildBatchItems(batchCount, params);
    if (validationError) { showToast(validationError); return; }
    setBatchCount(String(safeCount));
    setStaged(items);
    if (items.length < safeCount) {
      showToast(`Generated ${items.length} of ${safeCount} items. Relax the settings for more variety.`);
    }
  };

  const regenerateBatchItem = (key, params = {}) => {
    const existingSignatures = new Set(
      staged
        .filter(it => it._key !== key)
        .map(it => it.signature)
        .filter(Boolean)
    );
    const { items, validationError } = buildBatchItems(1, params, existingSignatures);
    if (validationError) { showToast(validationError); return; }
    if (!items.length) {
      showToast('Could not regenerate this item with the current batch settings.');
      return;
    }
    const replacement = { ...items[0], _key: key, status: 'pending' };
    setStaged(prev => prev.map(it => (it._key === key ? replacement : it)));
  };

  const generateSingle = () => {
    const validationError = validateGenerationSettings(selectedModel, effectiveSeedMode, seedValue, effectiveIncrementMode, incrementValue);
    if (validationError) { showToast(validationError); return; }

    const settings = buildNumberSeriesGenerationSettings({
      seedMode: effectiveSeedMode,
      seedValue,
      incrementMode: effectiveIncrementMode,
      incrementValue,
      missingPosition: effectiveMissingPos,
      responseFormat: 'open',
      seriesLength,
    });
    const pool  = selectedModel ? [selectedModel] : randomPool;
    // eslint-disable-next-line react-hooks/purity
    const model = pool[Math.floor(Math.random() * pool.length)];
    const item  = generateSeriesItem(model, settings);
    if (!item) {
      const diagnostic = diagnoseSeriesGenerationFailure(model, settings);
      showToast({
        message: 'Unable to generate item',
        type: 'error',
        details: diagnostic?.diagnostics?.length
          ? diagnostic.diagnostics
          : ['The generator exhausted its retries without finding a valid item.'],
      });
      return;
    }
    item.responseFormat = 'open';
    item.distractors    = [];
    item.bankId         = genBankId('nseries');
    // eslint-disable-next-line react-hooks/purity
    item._key           = `ns-single-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setSingleFormula(buildNumberSeriesFormula(settings, item, { generatedAt: new Date().toISOString() }));
  };

  const setStatus      = (key, st) => setStaged(prev => prev.map(it => it._key === key ? { ...it, status: st } : it));
  const saveEditedItem = (nextItem) => {
    setStaged(prev => prev.map(it => {
      if (it._key !== nextItem._key) return it;
      const nextFormula = it.formula
        ? buildNumberSeriesFormula(it.formula.settings || {}, { ...nextItem, formula: undefined }, it.formula.meta || {})
        : null;
      return { ...nextItem, formula: nextFormula };
    }));
    setEditingKey(null);
  };

  const addToBank = () => {
    const acc = staged.filter(it => it.status === 'accepted');
    if (!acc.length) { showToast('Accept items first'); return; }
    const bankItems = acc.map(buildNumberSeriesBankItem);
    appendToBank(bankItems);
    setStaged(prev => prev.filter(it => it.status === 'pending'));
    showToast(`Added ${bankItems.length} items`);
  };

  const addSingleToBank = () => {
    if (!singleItem) { showToast('Generate a single item first'); return; }
    setSingleAddConfirmOpen(true);
  };

  const confirmAddSingleToBank = () => {
    if (!singleItem) {
      setSingleAddConfirmOpen(false);
      showToast('Generate a single item first');
      return;
    }
    appendToBank([buildNumberSeriesBankItem({ ...singleItem, formula: singleFormula })]);
    setSingleAddConfirmOpen(false);
    setSingleFormula(prev => (
      prev
        ? {
            ...prev,
            resolvedItem: {
              ...prev.resolvedItem,
              bankId: genBankId('nseries'),
            },
          }
        : prev
    ));
    showToast('Added single item');
  };

  const TABS = [
    { id: 'proof',      label: 'Validity Layer' },
    { id: 'pattern',    label: 'Pattern' },
    { id: 'model',      label: 'Model Info' },
    { id: 'formula',    label: 'Formula' },
  ];
  const tab = TABS.find(t => t.id === activeTab) ? activeTab : 'proof';

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  return (
    <div style={sty.container}>
      <style>{NUM_STEPPER_STYLE}</style>
      <div style={sty.contentRow}>
        <div style={{
          flex: `0 0 ${controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth}px`,
          minWidth: controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth,
          display: 'flex',
          minHeight: 0,
          transition: 'flex-basis 0.18s ease, min-width 0.18s ease',
        }}>

        {/* ── Left panel ────────────────────────────────────────── */}
        {!controlsHidden && (
        <div style={{ ...sty.left, flex: `0 0 ${leftPaneWidth}px`, minWidth: leftPaneWidth, borderRight: 'none' }}>

          {/* Model Selection */}
          <div style={sty.section}>
            <h4 style={sty.title}>Model Selection</h4>
            <select value={modelChoice} onChange={e => setModelChoice(e.target.value)} style={sty.sel}>
              <option value="">Random model</option>
              {ALL_MODELS.map(m => {
                const stepLabel = m.stepType === 'one' ? '1-step'
                  : m.stepType === 'two' ? '2-step'
                  : m.stepType;
                return (
                  <option key={m.id} value={`model-${m.id}`}>{m.id} · {m.name}  —  {stepLabel}</option>
                );
              })}
            </select>
            <div style={sty.helper}>
              {selectedModel
                ? `Using ${selectedModel.id}: ${selectedModel.name}.`
                : 'No model selected — generation picks randomly.'}
            </div>
            <div style={{ marginTop: 4 }}>
              <button type="button" onClick={() => setShowModelReference(true)} style={{ ...sty.btnOut, padding: '6px 12px', fontSize: 11 }}>
                View Model Table
              </button>
            </div>
          </div>

          {/* Parameters */}
          <div style={sty.section} onClick={() => setActiveTooltip(null)}>
            <h4 style={sty.title}>Parameters</h4>

            {/* Series Length */}
            {(() => {
              const tipId = 'seriesLength';
              const tipOpen = activeTooltip === tipId;
              return (
                <>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ ...sty.label, marginBottom: 0 }}>Series Length</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setActiveTooltip(tipOpen ? null : tipId); }}
                      style={{ background: tipOpen ? `rgba(251,191,36,0.12)` : 'rgba(255,255,255,0.04)', border: `1px solid ${tipOpen ? `rgba(251,191,36,0.5)` : 'rgba(255,255,255,0.14)'}`, color: tipOpen ? accent : 'rgba(255,255,255,0.38)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', fontSize: 9, fontWeight: 700, fontFamily: FONT_SANS, flexShrink: 0, letterSpacing: 0, transition: 'all 0.15s' }}>i</button>
                    {tipOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 236, background: 'linear-gradient(150deg,#09111f 0%,#0e1a2f 100%)', border: `1px solid rgba(251,191,36,0.22)`, borderLeft: `3px solid ${accent}`, borderRadius: '0 6px 6px 0', padding: '10px 12px 10px 11px', boxShadow: '0 0 0 1px rgba(251,191,36,0.06), 0 20px 56px rgba(0,0,0,0.75)', fontSize: 11, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7 }}>
                          <div style={{ position: 'absolute', top: -5, left: 13, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid rgba(251,191,36,0.3)` }} />
                          Total number of terms in the series, including the missing position. Allowed range: 5–7.
                      </div>
                    )}
                  </div>
                  <input
                    type="number" min={5} max={7} value={seriesLength}
                    onChange={e => setSeriesLength(Math.min(7, Math.max(5, Number(e.target.value))))}
                    style={{ ...sty.sel, width: 80 }}
                  />
                </>
              );
            })()}


            {/* Starting Value */}
            {(() => {
              const tipId = 'seed';
              const tipOpen = activeTooltip === tipId;
              return (
                <>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4, marginTop: 8 }}>
                    <span style={{ ...sty.label, marginBottom: 0 }}>{parameterCopy.seedLabel}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setActiveTooltip(tipOpen ? null : tipId); }}
                      style={{ background: tipOpen ? `rgba(251,191,36,0.12)` : 'rgba(255,255,255,0.04)', border: `1px solid ${tipOpen ? `rgba(251,191,36,0.5)` : 'rgba(255,255,255,0.14)'}`, color: tipOpen ? accent : 'rgba(255,255,255,0.38)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', fontSize: 9, fontWeight: 700, fontFamily: FONT_SANS, flexShrink: 0, letterSpacing: 0, transition: 'all 0.15s' }}>i</button>
                    {tipOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 236, background: 'linear-gradient(150deg,#09111f 0%,#0e1a2f 100%)', border: `1px solid rgba(251,191,36,0.22)`, borderLeft: `3px solid ${accent}`, borderRadius: '0 6px 6px 0', padding: '10px 12px 10px 11px', boxShadow: '0 0 0 1px rgba(251,191,36,0.06), 0 20px 56px rgba(0,0,0,0.75)', fontSize: 11, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7 }}>
                          <div style={{ position: 'absolute', top: -5, left: 13, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid rgba(251,191,36,0.3)` }} />
                          {isRecurrenceModel(selectedModel)
                            ? <>The first starting term of the recurrence. In <strong style={{ color: accent }}>Random</strong> mode a value is drawn uniformly from [−N, N]. In <strong style={{ color: accent }}>Exact</strong> mode the sequence starts from the precise first seed you enter.</>
                            : <>The initial term of the series. In <strong style={{ color: accent }}>Random</strong> mode a value is drawn uniformly from [−N, N]. In <strong style={{ color: accent }}>Exact</strong> mode the series starts at the precise value you enter.</>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {['exact', 'random'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => !(mode === 'exact' && parameterCopy.seedExactDisabled) && setSeedMode(mode)}
                        disabled={mode === 'exact' && parameterCopy.seedExactDisabled}
                        style={{
                          ...sty.btn, width: 60, flexShrink: 0, padding: '5px 4px', fontSize: 11,
                          opacity: (mode === 'exact' && parameterCopy.seedExactDisabled) ? 0.3 : effectiveSeedMode === mode ? 1 : 0.45, justifyContent: 'center',
                          cursor: (mode === 'exact' && parameterCopy.seedExactDisabled) ? 'not-allowed' : 'pointer',
                        }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                    ))}
                    <NumStepper value={seedValue} onChange={setSeedValue} style={{ width: 72, flexShrink: 1 }} />
                  </div>
                  <div style={sty.helper}>{parameterCopy.seedHelper}</div>
                </>
              );
            })()}

            {/* Derivative Start / Rule Parameter */}
            {(() => {
              const tipId = 'increment';
              const tipOpen = activeTooltip === tipId;
              return (
                <>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4, marginTop: 8 }}>
                    <span style={{ ...sty.label, marginBottom: 0 }}>{parameterCopy.incrementLabel}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setActiveTooltip(tipOpen ? null : tipId); }}
                      style={{ background: tipOpen ? `rgba(251,191,36,0.12)` : 'rgba(255,255,255,0.04)', border: `1px solid ${tipOpen ? `rgba(251,191,36,0.5)` : 'rgba(255,255,255,0.14)'}`, color: tipOpen ? accent : 'rgba(255,255,255,0.38)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', fontSize: 9, fontWeight: 700, fontFamily: FONT_SANS, flexShrink: 0, letterSpacing: 0, transition: 'all 0.15s' }}>i</button>
                    {tipOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 236, background: 'linear-gradient(150deg,#09111f 0%,#0e1a2f 100%)', border: `1px solid rgba(251,191,36,0.22)`, borderLeft: `3px solid ${accent}`, borderRadius: '0 6px 6px 0', padding: '10px 12px 10px 11px', boxShadow: '0 0 0 1px rgba(251,191,36,0.06), 0 20px 56px rgba(0,0,0,0.75)', fontSize: 11, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7 }}>
                          <div style={{ position: 'absolute', top: -5, left: 13, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid rgba(251,191,36,0.3)` }} />
                          {isRecurrenceModel(selectedModel)
                            ? <>The second starting term of the recurrence. In <strong style={{ color: accent }}>Random</strong> mode it is sampled within [−N, N]. In <strong style={{ color: accent }}>Exact</strong> mode the sequence uses the precise second seed you enter.</>
                            : <>The step parameter for the selected model's rule — common difference, ratio, or initial derivative. In <strong style={{ color: accent }}>Random</strong> mode sampled within ±N.</>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {['exact', 'random'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => !parameterCopy.incrementDisabled && !(mode === 'exact' && parameterCopy.incrementExactDisabled) && setIncrementMode(mode)}
                        disabled={parameterCopy.incrementDisabled || (mode === 'exact' && parameterCopy.incrementExactDisabled)}
                        style={{
                          ...sty.btn, width: 60, flexShrink: 0, padding: '5px 4px', fontSize: 11,
                          opacity: (parameterCopy.incrementDisabled || (mode === 'exact' && parameterCopy.incrementExactDisabled)) ? 0.3 : effectiveIncrementMode === mode ? 1 : 0.45, justifyContent: 'center',
                          cursor: (parameterCopy.incrementDisabled || (mode === 'exact' && parameterCopy.incrementExactDisabled)) ? 'not-allowed' : 'pointer',
                        }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                    ))}
                    <NumStepper value={incrementValue} onChange={setIncrementValue} disabled={parameterCopy.incrementDisabled} style={{ width: 72, flexShrink: 1 }} />
                  </div>
                  <div style={sty.helper}>{parameterCopy.incrementHelper}</div>
                </>
              );
            })()}
          </div>

        </div>
        )}

        <div style={{
          flex: `0 0 ${controlsRailWidth}px`,
          minWidth: controlsRailWidth,
          borderRight: `1px solid ${C.sep}`,
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
              border: '1px solid rgba(251,191,36,0.22)',
              background: controlsHidden ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
              color: controlsHidden ? accent : 'rgba(255,255,255,0.7)',
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: controlsHidden ? '0 0 0 1px rgba(251,191,36,0.1)' : 'none',
              transition: 'all 0.14s ease',
            }}
          >
            {controlsHidden ? '»' : '«'}
          </button>
        </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────── */}
        <div style={sty.right}>

          {/* ─── Top pane: Series Preview (fixed height) ─── */}
          <div style={{ flex: '0 0 auto', height: 348, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 20px 12px', borderBottom: `1px solid ${C.sep}`, gap: 10 }}>
            <div style={sty.section}>
              {/* Header row */}
              <div style={{ marginBottom: 4 }}>
                <h4 style={sty.title}>Series Preview</h4>
              </div>

              {singleItem ? (
                <>
                  <SeriesVisual item={singleItem} showDeltas={false} accent={accent} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0 2px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Answer</span>
                    <span style={{ fontFamily: FONT_MONO, color: accent, fontWeight: 700, fontSize: 28 }}>{singleItem.answerDisplay}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge label={`${singleItem.modelId}`} color={accent} />
                    <Badge label={singleItem.modelName} color={C.textMut} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: C.textMut, padding: '32px 0', textAlign: 'center' }}>
                  {selectedModel
                    ? <>No item generated yet. Click <strong style={{ color: C.text }}>Generate Item</strong> to begin.</>
                    : <>No model selected. Click <strong style={{ color: C.text }}>Generate Item</strong> to sample a random model.</>
                  }
                </div>
              )}
            </div>
          </div>

          {/* ─── Bottom pane: tabbed analysis ─── */}
          {singleItem && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Tab bar */}
              <div style={{ flex: '0 0 auto', display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.sep}`, padding: '0 16px', gap: 2, background: C.bg }}>
                {TABS.map(t => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{
                        flex: '0 0 auto', padding: '8px 14px',
                        fontSize: 11, fontWeight: active ? 800 : 600,
                        color: active ? accent : 'rgba(255,255,255,0.45)',
                        background: 'transparent', border: 'none',
                        borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                        cursor: 'pointer', letterSpacing: '0.04em',
                        textTransform: 'uppercase', fontFamily: FONT_SANS,
                        marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.12s',
                      }}
                    >{t.label}</button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={sty.section}>
                  {tab === 'proof'      && <ProofTracingTab item={singleItem} />}
                  {tab === 'pattern'    && <PatternTraceTable item={singleItem} />}
                  {tab === 'model'      && <ModelInfoTable item={singleItem} />}
                  {tab === 'formula'    && <NumberSeriesFormulaRenderer formula={singleFormula} />}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div style={sty.pageFooter}>
        <div style={sty.pageFooterGroup}>
          <button
            style={sty.btn}
            onClick={generateSingle}
          >Generate Item</button>
          <button style={sty.btn} onClick={openBatchModal}>Generate Batch</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: singleItem ? 1 : 0.45 }}>
            ID {singleItem?.bankId || 'pending'}
          </div>
          <button
            style={{ ...sty.btnBank, opacity: singleItem ? 1 : 0.6 }}
            onClick={addSingleToBank}
            disabled={!singleItem}
          >Add to Bank</button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            ...sty.toast,
            background: toast.type === 'error' ? C.danger : accent,
            color: toast.type === 'error' ? '#fff' : '#000',
            padding: toast.type === 'error' ? '10px 14px' : '9px 18px',
            minWidth: toast.type === 'error' ? 280 : undefined,
            maxWidth: toast.type === 'error' ? 360 : undefined,
            cursor: toast.type === 'error' && toast.details?.length ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (toast.type === 'error' && toast.details?.length) {
              setToast(prev => prev ? { ...prev, expanded: !prev.expanded } : prev);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>{toast.message}</span>
            {toast.type === 'error' && toast.details?.length ? (
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>
                {toast.expanded ? 'Hide details' : 'Show details'}
              </span>
            ) : null}
          </div>
          {toast.type === 'error' && toast.expanded && toast.details?.length ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {toast.details.map((detail, index) => (
                <div key={`${detail}-${index}`} style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.45 }}>
                  {detail}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {singleAddConfirmOpen && singleItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add current number-series item?</div>
            <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
              This will add the current preview item to the item bank using the ID shown below.
            </p>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ID {singleItem.bankId || 'pending'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSingleAddConfirmOpen(false)} style={sty.btnOut}>Review More</button>
              <button type="button" onClick={confirmAddSingleToBank} style={{ ...sty.btnBank, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add to Bank</button>
            </div>
          </div>
        </div>
      )}

      <NumberSeriesBatchModal
        open={batchModalOpen}
        onCancel={cancelBatchModal}
        batchCount={batchCount}
        onBatchCountChange={setBatchCount}
        onGenerate={generateBatch}
        items={staged}
        onSetStatus={setStatus}
        onEdit={setEditingKey}
        onAddAccepted={addToBank}
        onRegenerateItem={regenerateBatchItem}
      />
      <NumberSeriesEditorModal
        key={editingKey ? `staged-${editingKey}` : 'staged-closed'}
        open={Boolean(editingKey)}
        item={staged.find(it => it._key === editingKey) || null}
        onClose={() => setEditingKey(null)}
        onSave={saveEditedItem}
      />
      <ModelReferenceModal open={showModelReference} onClose={() => setShowModelReference(false)} />
    </div>
  );
}

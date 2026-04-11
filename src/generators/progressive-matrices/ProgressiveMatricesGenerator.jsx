import React, { useState, useMemo } from 'react';
import { colors, fonts } from '../../theme';
import { appendToBank, genBankId, makeBankItem } from '../../store/bankStore';
import { ALL_TEMPLATES, buildRandomizedTemplateConfig } from './templates';
import { MatrixPreview } from './renderer';
import { deriveMatrixAnswer } from './derivation';
import { generateMatrixDistractors } from './distractors';
import { validateMatrixItem } from './validation';

// ── Design tokens ────────────────────────────────────────────────────────────
const accent    = colors.matrix;   // #38bdf8 cyan
const FONT_MONO = '"SF Mono","Cascadia Code","Fira Code",Consolas,monospace';
const FONT_SANS = fonts.body;

const C = {
  bg:      '#0A0F1A',
  card:    'rgba(10,15,26,0.55)',
  border:  'rgba(56,189,248,0.14)',
  borderHd:'rgba(56,189,248,0.28)',
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
    fontSize: 11, fontWeight: 800, color: `rgba(56,189,248,0.68)`,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    margin: 0, marginBottom: 10,
  },
  sel: {
    background: '#111827', color: C.text,
    border: `1px solid rgba(56,189,248,0.22)`,
    borderRadius: 2, padding: '7px 10px',
    fontSize: 13, fontFamily: FONT_SANS, width: '100%', outline: 'none',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: `rgba(56,189,248,0.08)`, color: accent,
    border: `1px solid rgba(56,189,248,0.28)`,
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
    background: C.success, color: '#000',
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
    width: 'min(1200px, 100%)', maxHeight: 'min(88vh, 900px)',
    background: C.bg, border: `1px solid ${C.borderHd}`,
    borderRadius: 2, boxShadow: '0 28px 64px rgba(0,0,0,0.55)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, padding: '18px 20px 14px', borderBottom: `1px solid ${C.sep}`,
  },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: C.text, fontFamily: FONT_SANS },
  modalSubtitle: { margin: '4px 0 0', fontSize: 12, color: C.textMut, lineHeight: 1.6 },
  modalClose: {
    width: 32, height: 32, borderRadius: 2,
    border: `1px solid rgba(255,255,255,0.1)`, background: 'rgba(255,255,255,0.04)',
    color: C.textMut, cursor: 'pointer', fontSize: 18, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

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

function StatusBadge({ status }) {
  const map = {
    pass:    { label: 'Pass',    color: C.success },
    warning: { label: 'Warn',   color: C.warn    },
    fail:    { label: 'Fail',   color: C.danger  },
  };
  const { label, color } = map[status] || { label: status, color: C.textMut };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
      textTransform: 'uppercase', color,
      background: `${color}18`, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  );
}

// ── Derivation trace table (proof-trace style) ────────────────────────────────

function DerivationTraceTable({ derivation }) {
  if (!derivation) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;
  if (!derivation.ok) return (
    <div style={{ padding: '8px 10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 2, fontSize: 12, color: C.danger }}>
      Derivation failed
    </div>
  );

  const steps = derivation.explanation || [];
  const cols = '32px 1fr';

  return (
    <div style={{ fontFamily: FONT_MONO }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'Step'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {/* Rows */}
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingTop: 1 }}>{i + 1}</span>
          <span style={{ fontSize: 12, color: '#c4d4ff', lineHeight: 1.55 }}>{step}</span>
        </div>
      ))}
    </div>
  );
}

// ── Distractor strategies table ───────────────────────────────────────────────

function DistractorStrategiesTable({ distractors, keyedOption, options }) {
  if (!distractors || distractors.length === 0) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;
  const visibleDistractorSlots = Object.keys(options || {})
    .sort((a, b) => Number(a.replace('OPT', '')) - Number(b.replace('OPT', '')))
    .filter(oKey => oKey !== keyedOption)
    .map(oKey => oKey.replace('OPT', ''))
    .slice(0, distractors.length);
  const cols = '24px 1fr';
  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'Strategy'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {distractors.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{visibleDistractorSlots[i] || i + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: C.text }}>{d.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Validation table ──────────────────────────────────────────────────────────

function ValidationTable({ validation }) {
  if (!validation) return <span style={{ fontSize: 12, color: C.textMut }}>—</span>;

  const summaryColor = validation.status === 'pass' ? C.success
    : validation.status === 'warning' ? C.warn : C.danger;
  const summaryIcon = validation.status === 'pass' ? '✓' : validation.status === 'warning' ? '⚠' : '✗';
  const cols = '72px 140px 1fr';

  return (
    <div>
      {/* Summary badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '6px 10px', background: `${summaryColor}0d`, border: `1px solid ${summaryColor}30`, borderRadius: 2 }}>
        <span style={{ fontSize: 14, color: summaryColor }}>{summaryIcon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: summaryColor, fontFamily: FONT_MONO }}>
          {validation.counts.pass} pass · {validation.counts.warning} warn · {validation.counts.fail} fail
        </span>
      </div>

      {/* Table */}
      <div style={{ fontFamily: FONT_MONO }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {['Status', 'Check', 'Detail'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {validation.checks.map((c, i) => {
          const clr = c.status === 'pass' ? C.success : c.status === 'warning' ? C.warn : C.danger;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
              <StatusBadge status={c.status} />
              <span style={{ fontSize: 11, fontWeight: 700, color: clr }}>{c.label}</span>
              <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>{c.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Batch Modal ───────────────────────────────────────────────────────────────

function MatrixBatchModal({ open, onCancel, batchCount, onBatchCountChange, batchTemplateId, onBatchTemplateChange, onGenerate, items, onSetStatus, onAddAccepted, onRegenerateItem, theme }) {
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [addConfirmOpen, setAddConfirmOpen] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

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
  const handleGenerate = () => {
    if (items.length) {
      setGenerateConfirmOpen(true);
      return;
    }
    onGenerate();
  };
  const confirmGenerate = () => {
    setGenerateConfirmOpen(false);
    onGenerate();
  };
  const cancelButtonStyle = {
    ...sty.btnOut,
    color: C.danger,
    borderColor: `${C.danger}80`,
    background: 'rgba(248,113,113,0.08)',
  };

  return (
    <div style={sty.modalOverlay}>
      <div style={sty.modalCard}>

        <div style={sty.modalHeader}>
          <div>
            <h3 style={sty.modalTitle}>Batch Generate Matrices</h3>
            <p style={sty.modalSubtitle}>Generate multiple matrix items, review each one, and add the best to the item bank.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            flex: '0 0 290px',
            minWidth: 290,
            borderRight: `1px solid ${C.sep}`,
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 2 }}>Batch Configuration</div>
            <div style={{ fontSize: 12, color: C.textMut, lineHeight: 1.6 }}>
              Choose the item model and batch size, generate matrix items, then review them on the right before sending accepted ones to the item bank.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Count</span>
              <input type="number" min={1} max={12} value={batchCount} onChange={e => onBatchCountChange(e.target.value)} style={{ ...sty.sel, width: 72 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Item Model</span>
              <select value={batchTemplateId} onChange={e => onBatchTemplateChange(e.target.value)} style={sty.sel}>
                <option value="__random__">Random — mix of all item models</option>
                {ALL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11, color: C.textMut }}>Up to 12 per batch.</div>

            <button style={{ ...sty.btn, justifyContent: 'center' }} onClick={handleGenerate}>Generate</button>
            <button style={{ ...cancelButtonStyle, justifyContent: 'center' }} onClick={handleCancel}>Cancel</button>
            <button
              style={{ ...sty.btnBank, justifyContent: 'center', opacity: hasAccepted ? 1 : 0.45, cursor: hasAccepted ? 'pointer' : 'not-allowed' }}
              disabled={!hasAccepted}
              onClick={() => setAddConfirmOpen(true)}
            >Add Accepted ({acceptedCount}) to Bank</button>
          </div>

        {/* Item list */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length > 0 ? items.map((item, idx) => {
            const valColor = !item.validation ? C.textMut
              : item.validation.status === 'pass' ? C.success
              : item.validation.status === 'warning' ? C.warn : C.danger;
            const valLabel = !item.validation ? null
              : item.validation.status === 'pass' ? '✓ pass'
              : item.validation.status === 'warning' ? '⚠ warn' : '✗ fail';
            const borderAccent = item.status === 'accepted' ? C.success
              : item.status === 'rejected' ? C.danger : C.border;
            return (
              <div key={item._key} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: C.card, borderRadius: 2,
                border: `1px solid ${C.border}`, borderLeft: `3px solid ${borderAccent}`,
                padding: 12, position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, fontWeight: 900, fontFamily: FONT_MONO, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, padding: '4px 8px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(74,222,128,0.08))', boxShadow: '0 0 18px rgba(34,211,238,0.16)' }}>
                  ID {item.bankId || 'pending'}
                </div>
                <div style={{ flexShrink: 0, paddingLeft: 32 }}>
                  <MatrixPreview config={item.config} selected={null} cellSize={52} theme={theme} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: FONT_MONO }}>#{idx + 1}</span>
                    <Badge label={item.templateName} color={accent} />
                    <Badge label={`missing: ${item.config.missingCell}`} color={C.textMut} />
                    {valLabel && <span style={{ fontSize: 10, fontWeight: 800, color: valColor, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT_MONO }}>{valLabel}</span>}
                  </div>
                  {item.derivation?.explanation?.length > 0 && (
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#c4d4ff', background: 'rgba(10,15,26,0.7)', border: `1px solid rgba(56,189,248,0.12)`, borderRadius: 2, padding: '4px 8px', lineHeight: 1.5 }}>
                      {item.derivation.explanation[item.derivation.explanation.length - 1]}
                    </div>
                  )}
                  {item.distractors?.length > 0 && (
                    <div style={{ fontSize: 11, color: C.textMut, fontFamily: FONT_MONO }}>
                      Distractors: {item.distractors.map(d => d.label).join(' · ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button
                      style={{ ...sty.btnBank, padding: '4px 14px', fontSize: 11, opacity: item.status === 'accepted' ? 1 : 0.55 }}
                      onClick={() => onSetStatus(item._key, item.status === 'accepted' ? 'pending' : 'accepted')}
                    >{item.status === 'accepted' ? '✓ Accepted' : 'Accept'}</button>
                    <button
                      style={{ ...sty.btnOut, padding: '4px 14px', fontSize: 11, color: C.danger, borderColor: `${C.danger}60`, opacity: item.status === 'rejected' ? 1 : 0.55 }}
                      onClick={() => onSetStatus(item._key, item.status === 'rejected' ? 'pending' : 'rejected')}
                    >{item.status === 'rejected' ? '✗ Rejected' : 'Reject'}</button>
                    <button
                      type="button"
                      style={{
                        ...sty.btnOut,
                        padding: '4px 12px',
                        fontSize: 11,
                        color: '#38bdf8',
                        borderColor: 'rgba(56,189,248,0.45)',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(37,99,235,0.08))',
                        boxShadow: '0 0 16px rgba(56,189,248,0.12)',
                      }}
                      onClick={() => onRegenerateItem(item._key)}
                      title={`Regenerate item ${idx + 1}`}
                      aria-label={`Regenerate item ${idx + 1}`}
                    >Regenerate</button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2, padding: 36, textAlign: 'center', color: C.textMut, fontSize: 13 }}>
              Choose a count and item model, then click <strong style={{ color: C.text }}>Generate</strong>.
            </div>
          )}
        </div>
        </div>
        {addConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add accepted matrices?</div>
              <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
                This will add {acceptedCount} accepted matrix item{acceptedCount === 1 ? '' : 's'} to the item bank and remove them from this batch review list.
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
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Generate a new matrices batch?</div>
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

// ── Main Generator ────────────────────────────────────────────────────────────

export default function ProgressiveMatricesGenerator() {
  const [templateId, setTemplateId]       = useState(ALL_TEMPLATES[0].id);
  const [config, setConfig]               = useState(null);
  const [derivation, setDerivation]       = useState(null);
  const [distractors, setDistractors]     = useState([]);
  const [validation, setValidation]       = useState(null);
  const [selectedOpt, setSelectedOpt]     = useState(null);
  const [bgMode, setBgMode]               = useState('light');
  const [colorOverrides, setColorOverrides] = useState({});
  const [activeTab, setActiveTab]         = useState('derivation');
  const [toast, setToast]                 = useState(null);

  const [batchModalOpen, setBatchModalOpen]     = useState(false);
  const [batchItems, setBatchItems]             = useState([]);
  const [batchCount, setBatchCount]             = useState('4');
  const [batchTemplateId, setBatchTemplateId]   = useState('__random__');
  const [singleBankId, setSingleBankId]         = useState(null);
  const [singleAddConfirmOpen, setSingleAddConfirmOpen] = useState(false);
  const [controlsHidden, setControlsHidden]     = useState(false);
  const leftPaneWidth = 320;
  const controlsRailWidth = 26;

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const effectiveConfig = useMemo(() => {
    if (!config) return null;
    const hasOverride = colorOverrides.fill != null || colorOverrides.stroke != null;
    if (!hasOverride) return config;
    const applyToLayers = (layers) => layers.map(l => ({
      ...l,
      ...(colorOverrides.fill   != null ? { fill:   colorOverrides.fill   } : {}),
      ...(colorOverrides.stroke != null ? { stroke: colorOverrides.stroke } : {}),
    }));
    const applyToCell = (cell) => cell ? { ...cell, layers: applyToLayers(cell.layers || []) } : cell;
    return {
      ...config,
      cells:   Object.fromEntries(Object.entries(config.cells   || {}).map(([k, v]) => [k, applyToCell(v)])),
      options: Object.fromEntries(Object.entries(config.options || {}).map(([k, v]) => [k, applyToCell(v)])),
    };
  }, [config, colorOverrides]);

  const applyTemplate = () => {
    const cfg = buildRandomizedTemplateConfig(templateId);
    if (!cfg) return;
    setColorOverrides({});
    setConfig(cfg);
    setSingleBankId(genBankId('matrix'));
    setSelectedOpt(cfg.keyedOption);
    const drv = deriveMatrixAnswer(cfg, templateId);
    setDerivation(drv);
    let dist = [];
    if (drv.ok) {
      dist = generateMatrixDistractors(cfg, templateId, drv.derivedLayers);
      setDistractors(dist);
    } else {
      setDistractors([]);
    }
    setValidation(validateMatrixItem(cfg, drv, dist));
  };

  const addToBank = () => {
    if (!config) { showToast('Generate an item first'); return; }
    setSingleAddConfirmOpen(true);
  };

  const confirmAddToBank = () => {
    if (!config) {
      setSingleAddConfirmOpen(false);
      showToast('Generate an item first');
      return;
    }
    appendToBank([makeBankItem({
      id: singleBankId || genBankId('matrix'),
      name: `Matrix ${config.templateName}`,
      stem: 'Select the option that best completes the matrix.',
      generatedBy: 'progressive-matrices',
      constructId: 'abstract-reasoning',
      responseFormat: 'mc',
      responseOptions: Object.keys(config.options || {}),
      generatorMeta: { templateId, templateName: config.templateName, family: config.family, gridLabel: config.gridLabel, missingCell: config.missingCell, keyedOption: config.keyedOption, theme: bgMode, config },
    })]);
    setSingleAddConfirmOpen(false);
    setSingleBankId(genBankId('matrix'));
    showToast('Added to Item Bank');
  };

  const openBatchModal = () => {
    setBatchItems([]);
    setBatchModalOpen(true);
  };

  const cancelBatchModal = () => {
    setBatchItems([]);
    setBatchModalOpen(false);
  };

  const buildBatchMatrixItem = (templateIdForItem, keySuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`) => {
    const cfg = buildRandomizedTemplateConfig(templateIdForItem);
    if (!cfg) return null;
    const drv = deriveMatrixAnswer(cfg, templateIdForItem);
    const dist = drv.ok ? generateMatrixDistractors(cfg, templateIdForItem, drv.derivedLayers) : [];
    return {
      _key: `${templateIdForItem}-${keySuffix}`,
      bankId: genBankId('matrix'),
      config: cfg,
      templateId: templateIdForItem,
      templateName: cfg.templateName,
      derivation: drv,
      distractors: dist,
      validation: validateMatrixItem(cfg, drv, dist),
      status: 'pending',
    };
  };

  const generateBatch = () => {
    const n = Math.min(12, Math.max(1, parseInt(batchCount, 10) || 4));
    const items = [];
    for (let i = 0; i < n; i++) {
      const tid = batchTemplateId === '__random__'
        ? ALL_TEMPLATES[Math.floor(Math.random() * ALL_TEMPLATES.length)].id
        : batchTemplateId;
      const item = buildBatchMatrixItem(tid, `${Date.now()}-${i}`);
      if (!item) continue;
      items.push(item);
    }
    setBatchItems(items);
  };

  const regenerateBatchItem = (itemKey) => {
    setBatchItems(prev => prev.map(it => {
      if (it._key !== itemKey) return it;
      const targetTemplateId = batchTemplateId === '__random__'
        ? ALL_TEMPLATES[Math.floor(Math.random() * ALL_TEMPLATES.length)].id
        : batchTemplateId;
      const next = buildBatchMatrixItem(targetTemplateId);
      return next || it;
    }));
  };

  const addBatchToBank = () => {
    const accepted = batchItems.filter(it => it.status === 'accepted');
    if (!accepted.length) { showToast('No accepted items'); return; }
    appendToBank(accepted.map(it => makeBankItem({
      id: it.bankId || genBankId('matrix'),
      name: `Matrix ${it.templateName}`,
      stem: 'Select the option that best completes the matrix.',
      generatedBy: 'progressive-matrices',
      constructId: 'abstract-reasoning',
      responseFormat: 'mc',
      responseOptions: Object.keys(it.config.options || {}),
      generatorMeta: { templateId: it.templateId, templateName: it.templateName, family: it.config.family, missingCell: it.config.missingCell, keyedOption: it.config.keyedOption, theme: bgMode, config: it.config },
    })));
    setBatchItems(prev => prev.filter(it => it.status === 'pending'));
    showToast(`Added ${accepted.length} item${accepted.length !== 1 ? 's' : ''} to bank`);
  };

  const tmpl = ALL_TEMPLATES.find(t => t.id === templateId);

  // Tab definitions for bottom pane
  const TABS = [
    { id: 'derivation',  label: 'Derivation' },
    { id: 'distractors', label: 'Distractors' },
    { id: 'validation',  label: 'Validation' },
  ];
  const tab = TABS.find(t => t.id === activeTab) ? activeTab : 'derivation';

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
        <div style={{ ...sty.left, flex: `0 0 ${leftPaneWidth}px`, minWidth: leftPaneWidth, borderRight: 'none' }}>

          {/* Item Model */}
          <div style={sty.section}>
            <h4 style={sty.title}>Item Model</h4>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={sty.sel}>
              {ALL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {tmpl && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={tmpl.family} color={accent} />
                </div>
                <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>{tmpl.description}</div>
              </div>
            )}
          </div>

          {/* Parameters */}
          <div style={sty.section}>
            <h4 style={sty.title}>Parameters</h4>
            {config?._params
              ? Object.entries(config._params).map(([k, v]) => {
                  const isColorKey = k.toLowerCase().includes('color') || k === 'fill' || k === 'stroke';
                  const isEditable = k === 'fill' || k === 'stroke';
                  const effectiveColor = isColorKey
                    ? (k === 'fill'   ? (colorOverrides.fill   ?? v)
                     : k === 'stroke' ? (colorOverrides.stroke ?? (bgMode === 'light' ? '#475569' : v))
                     : v)
                    : v;
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingBottom: 4, borderBottom: `1px solid ${C.sep}` }}>
                      <span style={{ color: C.textMut, minWidth: 80, fontFamily: FONT_MONO, fontSize: 11 }}>{k}</span>
                      {Array.isArray(v)
                        ? <span style={{ color: C.text, fontFamily: FONT_MONO, fontSize: 11 }}>{v.join(', ')}</span>
                        : isColorKey
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              <span style={{ width: 12, height: 12, borderRadius: 2, background: effectiveColor, border: '1px solid rgba(255,255,255,0.15)', display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ color: '#c4d4ff', fontFamily: FONT_MONO, fontSize: 11, flex: 1 }}>{effectiveColor}</span>
                              {isEditable && (
                                <input
                                  type="color" value={effectiveColor}
                                  onChange={e => setColorOverrides(prev => ({ ...prev, [k]: e.target.value }))}
                                  title={`Edit ${k}`}
                                  style={{ width: 22, height: 22, borderRadius: 2, cursor: 'pointer', border: `1px solid rgba(56,189,248,0.25)`, padding: 1, background: 'rgba(56,189,248,0.06)', flexShrink: 0 }}
                                />
                              )}
                            </span>
                          : <span style={{ color: C.text, fontFamily: FONT_MONO, fontSize: 11 }}>{String(v)}</span>
                      }
                    </div>
                  );
                })
              : <span style={{ fontSize: 12, color: C.textMut }}>—</span>
            }
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
            border: '1px solid rgba(56,189,248,0.22)',
            background: controlsHidden ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
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

        {/* ── Right panel ───────────────────────────────────────── */}
        <div style={sty.right}>

          {/* ─── Top pane: Matrix Preview (fixed height) ─── */}
          <div style={{ flex: '0 0 auto', height: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 20px 16px', borderBottom: `1px solid ${C.sep}`, gap: 10 }}>
            <div style={sty.section}>
              {/* Header: title + dark/light toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <h4 style={sty.title}>Matrix Preview</h4>
                <div style={{ display: 'flex', gap: 0, borderRadius: 2, overflow: 'hidden', border: `1px solid rgba(56,189,248,0.25)` }}>
                  {['dark', 'light'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setBgMode(mode)}
                      style={{
                        padding: '4px 12px', fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        cursor: 'pointer', border: 'none',
                        background: bgMode === mode ? accent : 'transparent',
                        color: bgMode === mode ? '#000' : C.textMut,
                        transition: 'background 0.15s, color 0.15s',
                        fontFamily: FONT_SANS,
                      }}
                    >{mode === 'dark' ? '🌙 Dark' : '☀ Light'}</button>
                  ))}
                </div>
              </div>

              {config ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: -8 }}>
                    <MatrixPreview
                      config={effectiveConfig}
                      selected={selectedOpt}
                      onSelect={setSelectedOpt}
                      theme={bgMode}
                      strokeOverride={colorOverrides.stroke}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <Badge label={config.templateName} color={accent} />
                    {config.family && <Badge label={config.family} color={`rgba(56,189,248,0.6)`} />}
                    {config.missingCell && <Badge label={`missing: ${config.missingCell}`} color={C.textMut} />}
                    {config.keyedOption && <Badge label={`answer: ${config.keyedOption}`} color={C.success} />}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: C.textMut, padding: '24px 0', textAlign: 'center' }}>
                  No item generated yet. Click <strong style={{ color: C.text }}>Generate Item</strong> to begin.
                </div>
              )}
            </div>
          </div>

          {/* ─── Bottom pane: tabbed analysis ─── */}
          {config && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Tab bar */}
              <div style={{ flex: '0 0 auto', display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.sep}`, padding: '0 16px', gap: 2, background: C.bg }}>
                {TABS.map(t => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
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
                  {tab === 'derivation'  && <DerivationTraceTable derivation={derivation} />}
                  {tab === 'distractors' && (
                    <DistractorStrategiesTable
                      distractors={distractors}
                      keyedOption={config.keyedOption}
                      options={config.options}
                    />
                  )}
                  {tab === 'validation'  && <ValidationTable validation={validation} />}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div style={sty.pageFooter}>
        <div style={sty.pageFooterGroup}>
          <button style={sty.btn} onClick={applyTemplate}>Generate Item</button>
          <button style={sty.btnOut} onClick={openBatchModal}>Generate Batch</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(56,189,248,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(56,189,248,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: config ? 1 : 0.45 }}>
            ID {config ? (singleBankId || 'pending') : 'pending'}
          </div>
          <button style={{ ...sty.btnBank, opacity: config ? 1 : 0.6 }} onClick={addToBank} disabled={!config}>Add to Bank</button>
        </div>
      </div>

      {toast && <div style={sty.toast}>{toast}</div>}

      {singleAddConfirmOpen && config && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add current matrix item?</div>
            <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
              This will add the current preview item to the item bank using the ID shown below.
            </p>
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(56,189,248,0.14), rgba(34,197,94,0.08))', boxShadow: '0 0 18px rgba(56,189,248,0.14)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ID {singleBankId || 'pending'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSingleAddConfirmOpen(false)} style={sty.btnOut}>Review More</button>
              <button type="button" onClick={confirmAddToBank} style={{ ...sty.btnBank, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add to Bank</button>
            </div>
          </div>
        </div>
      )}

      <MatrixBatchModal
        open={batchModalOpen}
        onCancel={cancelBatchModal}
        batchCount={batchCount}
        onBatchCountChange={setBatchCount}
        batchTemplateId={batchTemplateId}
        onBatchTemplateChange={setBatchTemplateId}
        onGenerate={generateBatch}
        items={batchItems}
        onSetStatus={(key, status) => setBatchItems(prev => prev.map(it => it._key === key ? { ...it, status } : it))}
        onAddAccepted={addBatchToBank}
        onRegenerateItem={regenerateBatchItem}
        theme={bgMode}
      />
    </div>
  );
}

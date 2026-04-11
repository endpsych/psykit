import React, { useEffect } from 'react';
import { colors } from '../theme';
import { MatrixPreview } from '../generators/progressive-matrices/renderer';
import { SpatialItemPreview } from '../generators/spatial-rotation/SpatialItemPreview';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_MONO = "'JetBrains Mono', 'Fira Mono', 'Cascadia Code', monospace";
const FONT_SANS = "'Inter', 'Segoe UI', system-ui, sans-serif";

const C = {
  bg:      'rgba(10,15,26,0.55)',
  bgDeep:  '#0d1117',
  border:  'rgba(255,255,255,0.07)',
  borderHd:'rgba(255,255,255,0.10)',
  text:    '#f1f5f9',
  dim:     '#94a3b8',
  muted:   '#64748b',
  number:  colors.number,
  matrix:  colors.matrix,
  spatial: colors.spatial,
  verbal:  colors.verbal,
};

const cardStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: 14 };

export const GEN_COLORS = {
  'spatial-rotation':     C.spatial,
  'number-series':        C.number,
  'progressive-matrices': C.matrix,
  'verbal-reasoning':     C.verbal,
};

const btnStyle = { display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS };

function Badge({ color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: `${color}15`, color,
      border: `1px solid ${color}33`,
      borderRadius: 2, fontSize: 10, padding: '2px 7px',
      fontWeight: 700, letterSpacing: '0.05em',
      fontFamily: FONT_MONO, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

// ─── Type-specific visual previews ────────────────────────────────────────────

function MatrixVisualPreview({ item }) {
  const meta  = item.generatorMeta || {};
  const cfg   = meta.config;
  const theme = meta.theme || 'dark';

  if (!cfg) {
    return (
      <div style={{ color: C.muted, fontSize: 12, padding: '20px 0', fontStyle: 'italic' }}>
        Visual preview not available — item was saved before config storage was added.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <MatrixPreview config={cfg} selected={cfg.keyedOption} cellSize={80} theme={theme} />
      <div style={{ fontSize: 12, color: C.dim }}>
        Answer: <span style={{ color: C.matrix, fontFamily: FONT_MONO, fontWeight: 700 }}>{cfg.keyedOption}</span>
        {' · '}Missing cell: <span style={{ color: C.text, fontFamily: FONT_MONO }}>{cfg.missingCell}</span>
      </div>
    </div>
  );
}

function NumberSeriesVisualPreview({ item }) {
  const meta   = item.generatorMeta || {};
  const terms  = meta.terms || [];
  const mi     = meta.missingIndex ?? -1;
  const answer = meta.answer ?? '?';

  if (!terms.length) {
    return <div style={{ color: C.muted, fontSize: 12 }}>{item.stem}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {terms.map((t, i) => {
          const isMissing = i === mi;
          return (
            <div key={i} style={{
              fontFamily: FONT_MONO, fontSize: 22, fontWeight: isMissing ? 800 : 500,
              minWidth: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMissing ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isMissing ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 4, color: isMissing ? C.number : C.text, padding: '0 10px',
            }}>
              {isMissing ? '?' : t}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: C.dim }}>
        Answer: <span style={{ color: C.number, fontFamily: FONT_MONO, fontWeight: 700 }}>{answer}</span>
        {meta.modelName && <span style={{ marginLeft: 12 }}>Model: {meta.modelName}</span>}
      </div>
    </div>
  );
}

function VerbalVisualPreview({ item }) {
  const meta = item.generatorMeta || {};
  const stem = item.stem || '';
  const conclusionMatch = stem.match(/Conclusion:\s*(.+)$/i);
  const premisesText    = conclusionMatch ? stem.slice(0, stem.indexOf('Conclusion:')).trim() : stem;
  const conclusion      = conclusionMatch ? conclusionMatch[1] : null;
  const validityColor   = meta.conclusionIsValid ? '#22c55e' : '#ef4444';
  const validityLabel   = meta.conclusionIsValid ? 'Valid — conclusion follows' : 'Invalid — conclusion does not follow';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: 'rgba(167,139,250,0.06)', border: `1px solid rgba(167,139,250,0.18)`, borderRadius: 2, padding: '10px 14px', fontSize: 13, color: C.text, lineHeight: 1.7 }}>
        {premisesText}
      </div>
      {conclusion && (
        <div style={{ background: 'rgba(167,139,250,0.03)', border: `1px solid rgba(167,139,250,0.12)`, borderRadius: 2, padding: '8px 14px', fontSize: 12, color: C.text }}>
          <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Conclusion</span><br />
          {conclusion}
        </div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: validityColor }}>
        {meta.conclusionIsValid !== undefined ? validityLabel : ''}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.muted }}>
        {meta.templateName && <span>Template: <span style={{ color: C.text }}>{meta.templateName}</span></span>}
        {meta.subject      && <span>Subject: <span style={{ color: C.text }}>{meta.subject}</span></span>}
        {meta.chainLength  && <span>Chain: <span style={{ color: C.text }}>{meta.chainLength}</span></span>}
      </div>
    </div>
  );
}

function SpatialVisualPreview({ item }) {
  return <SpatialItemPreview item={item} refSize={140} optionSize={140} accentOverride={C.spatial} />;
}

function ItemVisualPreview({ item }) {
  switch (item.generatedBy) {
    case 'progressive-matrices': return <MatrixVisualPreview item={item} />;
    case 'number-series':        return <NumberSeriesVisualPreview item={item} />;
    case 'verbal-reasoning':     return <VerbalVisualPreview item={item} />;
    case 'spatial-rotation':     return <SpatialVisualPreview item={item} />;
    default:
      return <div style={{ color: C.muted, fontSize: 12 }}>{item.stem}</div>;
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * ItemPreviewModal
 *
 * Props:
 *   item        – item object to preview (null = hidden)
 *   onClose     – called when modal should close
 *   onPrev      – navigate to previous item (optional)
 *   onNext      – navigate to next item (optional)
 *   hasPrev     – boolean (optional)
 *   hasNext     – boolean (optional)
 *   index       – 0-based current index for counter display (optional)
 *   total       – total items in list for counter display (optional)
 */
export function ItemPreviewModal({ item, onClose, onPrev, onNext, hasPrev, hasNext, index, total }) {
  useEffect(() => {
    if (!item) return;
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft'  && hasPrev && onPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [item, onClose, onPrev, onNext, hasPrev, hasNext]);

  if (!item) return null;

  const genColor = GEN_COLORS[item.generatedBy] || C.dim;
  const rawGeneratorMeta = item.generatorMeta
    ? (() => {
        if (item.generatedBy !== 'number-series') {
          return { ...item.generatorMeta, config: item.generatorMeta.config ? '(stored)' : undefined };
        }
        const { family: _family, ...meta } = item.generatorMeta;
        return { ...meta, config: item.generatorMeta.config ? '(stored)' : undefined };
      })()
    : null;

  const showNav = onPrev || onNext;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(1100px, 100%)', maxHeight: 'min(94vh, 960px)',
        background: C.bgDeep, border: `1px solid ${C.borderHd}`,
        borderRadius: 2, boxShadow: '0 28px 64px rgba(0,0,0,0.60)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: FONT_SANS, color: C.text,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '16px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: FONT_MONO }}>{item.name}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.muted }}>{item.id}</span>
              <Badge color={genColor}>{item.generatedBy}</Badge>
              {item.constructId && <span style={{ fontSize: 10, color: C.muted }}>{item.constructId}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 2, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.dim, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            aria-label="Close preview"
          >×</button>
        </div>

        {/* Body: preview left, metadata right */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Visual preview */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '18px 20px', borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, fontFamily: FONT_MONO }}>Preview</div>
            <ItemVisualPreview item={item} />
          </div>

          {/* Metadata panel */}
          <div style={{ flex: '0 0 300px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Stem */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontFamily: FONT_MONO }}>Stem</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{item.stem}</div>
              </div>

              {/* Response options */}
              {item.responseOptions?.length > 0 && (() => {
                const sortedOptions = [...item.responseOptions].sort((a, b) =>
                  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
                );
                const correctLabel =
                  item.generatedBy === 'progressive-matrices' ? item.generatorMeta?.keyedOption :
                  item.generatedBy === 'spatial-rotation'     ? 'Correct Answer' :
                  null;
                return (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontFamily: FONT_MONO }}>Response Options</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {sortedOptions.map((o, i) => {
                        const label = typeof o === 'string' ? o : JSON.stringify(o);
                        const isCorrect = correctLabel && label === correctLabel;
                        return (
                          <span key={i} style={{
                            padding: '2px 8px', borderRadius: 2, fontSize: 11, fontFamily: FONT_MONO,
                            background: isCorrect ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isCorrect ? 'rgba(56,189,248,0.45)' : C.border}`,
                            color: isCorrect ? '#38bdf8' : C.text,
                            fontWeight: isCorrect ? 700 : 400,
                          }}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {item.notes && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontFamily: FONT_MONO }}>Notes</div>
                  <div style={{ fontSize: 12, color: C.dim }}>{item.notes}</div>
                </div>
              )}

              {/* Item info */}
              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontFamily: FONT_MONO }}>Item Info</div>
                {[
                  ['Response format', item.responseFormat],
                  ['Construct',       item.constructId],
                  ['Created',         item.createdAt?.slice(0, 10)],
                  ['Status',          item.status],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: C.muted, minWidth: 120, fontFamily: FONT_MONO }}>{label}</span>
                    <span style={{ color: C.text }}>{value}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* Raw metadata — pinned at bottom */}
            {rawGeneratorMeta && (
              <div style={{ flexShrink: 0, padding: '12px 20px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO, marginBottom: 2 }}>Raw Metadata</div>
                <pre style={{
                  margin: 0, fontSize: 10, color: C.muted,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  background: 'rgba(255,255,255,0.03)', padding: '10px 12px',
                  borderRadius: 2, border: `1px solid ${C.border}`,
                  height: 160, overflowY: 'auto',
                }}>
                  {JSON.stringify(rawGeneratorMeta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showNav && (
              <>
                <button type="button" onClick={onPrev} disabled={!hasPrev} style={{ ...btnStyle, opacity: hasPrev ? 1 : 0.35, cursor: hasPrev ? 'pointer' : 'default' }}>← Prev</button>
                <button type="button" onClick={onNext} disabled={!hasNext} style={{ ...btnStyle, opacity: hasNext ? 1 : 0.35, cursor: hasNext ? 'pointer' : 'default' }}>Next →</button>
                {total != null && <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.muted, minWidth: 40, textAlign: 'center' }}>{index + 1}/{total}</span>}
              </>
            )}
          </div>
          <button type="button" onClick={onClose} style={btnStyle}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ItemPreviewModal;

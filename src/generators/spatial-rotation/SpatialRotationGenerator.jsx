import React, { useState, useRef, useEffect } from 'react';
import { colors, fonts } from '../../theme.js';
import { appendToBank, genBankId, makeBankItem } from '../../store/bankStore.js';
import { BLANK_VIEW, SHAPES, getConfigs, getCoords } from './shapes.js';
import { autoCenterCanvas, offscreenRender, makeConfig } from './renderer.js';
import { computeDifficulty, DIFFICULTY_COLORS } from './scoring.js';
import { generateDistractors, SNAP_ANGLES } from './distractors.js';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const accent              = colors.spatial;   // #34c759 green
const correctAnswerAccent = '#38bdf8';         // blue
const distractorAccent    = '#f04aa8';         // pink
const viewerAccent        = '#a78bfa';         // violet
const FONT_MONO = '"SF Mono","Cascadia Code","Fira Code",Consolas,monospace';
const FONT_SANS = fonts.body;

const C = {
  bg:      '#0A0F1A',
  card:    'rgba(10,15,26,0.55)',
  border:  'rgba(52,199,89,0.14)',
  borderHd:'rgba(52,199,89,0.28)',
  sep:     'rgba(255,255,255,0.07)',
  text:    '#E5E7EB',
  textSec: '#C2CDD8',
  textMut: '#8B97A8',
  success: '#4ade80',
  danger:  '#f87171',
};

const FIGURE_COLORS = [
  { value: '#34c759', label: 'Green'  },
  { value: '#38bdf8', label: 'Sky'    },
  { value: '#fbbf24', label: 'Amber'  },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red'    },
  { value: '#a78bfa', label: 'Violet' },
  { value: '#f472b6', label: 'Pink'   },
  { value: '#e2e8f0', label: 'Silver' },
];
const DISTRACTOR_LABELS = ['Distractor A', 'Distractor B', 'Distractor C'];
const BACKGROUND_MODES = {
  dark:  { label: 'Dark',  canvas: '#040816' },
  light: { label: 'Light', canvas: '#ffffff' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', gap: 0,
    fontFamily: FONT_SANS, color: C.text,
    height: '100vh', minHeight: 0, overflow: 'hidden', background: C.bg,
  },
  contentRow: {
    display: 'flex', alignItems: 'stretch', flex: 1, minHeight: 0, overflow: 'hidden',
  },
  left: {
    flex: '0 0 360px', display: 'flex', flexDirection: 'column', gap: 8,
    overflowY: 'auto', minHeight: 0,
    padding: '12px 12px 20px 16px', borderRight: `1px solid ${C.sep}`,
  },
  right: {
    flex: 1, display: 'flex', flexDirection: 'column',
    minWidth: 0, minHeight: 0, padding: 0, gap: 0, overflowY: 'hidden',
  },
  pageFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '10px 16px',
    background: '#070C16', borderTop: `1px solid ${C.sep}`, flex: '0 0 auto',
  },
  pageFooterGroup: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  section: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 2, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  sectionTitle: (sectionAccent = accent) => ({
    fontSize: 11, fontWeight: 800,
    color: sectionAccent,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    margin: 0, marginBottom: 10,
  }),
  label: { fontSize: 11, fontWeight: 600, color: C.textMut, marginBottom: 2 },
  select: {
    background: '#111827', color: C.text,
    border: `1px solid rgba(52,199,89,0.22)`,
    borderRadius: 2, padding: '7px 10px',
    fontSize: 13, fontFamily: FONT_SANS, width: '100%', outline: 'none',
  },
  slider: (sliderAccent = accent) => ({ width: '100%', accentColor: sliderAccent }),
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: `rgba(52,199,89,0.08)`, color: accent,
    border: `1px solid rgba(52,199,89,0.28)`,
    borderRadius: 2, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: FONT_SANS, letterSpacing: '0.02em',
  },
  btnOutline: {
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
  canvasWrap: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: -10 },
  canvasBox: { borderRadius: 2, border: `1px solid rgba(255,255,255,0.1)`, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  canvasLabel: { fontSize: 11, color: C.textMut, padding: '6px 8px 2px', textAlign: 'center', fontFamily: FONT_MONO, lineHeight: 1.35, minHeight: 22 },
  checkbox: { accentColor: accent },
  dropdownWrap: { position: 'relative' },
  modeRow: { display: 'flex', gap: 6 },
  modeBtn: (selected, btnAccent = accent) => ({
    flex: 1, padding: '6px 12px', borderRadius: 2,
    border: `1px solid ${selected ? btnAccent : `${btnAccent}55`}`,
    background: selected ? `${btnAccent}18` : 'rgba(10,15,26,0.6)',
    color: selected ? C.text : btnAccent,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS,
  }),
  miniBtn: (btnAccent = accent) => ({
    alignSelf: 'flex-start',
    background: 'transparent', color: btnAccent,
    border: `1px solid ${btnAccent}55`, borderRadius: 2,
    padding: '4px 10px', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: FONT_SANS,
  }),
  dropdownButton: (open) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: 2,
    border: `1px solid ${open ? accent : 'rgba(52,199,89,0.22)'}`,
    background: '#111827', cursor: 'pointer',
    fontSize: 13, color: C.text, width: '100%',
  }),
  dropdownValue: { display: 'flex', alignItems: 'center', gap: 8 },
  dropdownCaret: (open) => ({
    fontSize: 10, color: C.textMut,
    transform: open ? 'rotate(180deg)' : 'none',
  }),
  dropdownMenu: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#111827', border: `1px solid rgba(52,199,89,0.22)`,
    borderRadius: 2, padding: 4,
    boxShadow: '0 14px 28px rgba(0,0,0,0.45)', zIndex: 20,
  },
  dropdownItem: (selected, swatch) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px', borderRadius: 2,
    border: 'none', background: selected ? `${swatch}18` : 'transparent',
    color: C.text, cursor: 'pointer', textAlign: 'left', fontSize: 13,
  }),
  colorSwatch: (swatch) => ({
    width: 12, height: 12, borderRadius: 999,
    background: swatch, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
  }),
  mirrorText: { color: C.danger, fontWeight: 700 },
  previewDivider: { width: '100%', height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 2px' },
  distractorRow: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', width: '100%', marginTop: -10 },
  swatchInline: (swatch) => ({
    display: 'inline-block', width: 10, height: 10, borderRadius: 999,
    background: swatch, marginRight: 6, verticalAlign: 'middle',
    border: '1px solid rgba(255,255,255,0.2)',
  }),
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 1000,
  },
  modalCard: {
    width: 'min(1180px, 100%)', height: 'min(88vh, 920px)', maxHeight: 'min(88vh, 920px)',
    background: C.bg, border: `1px solid ${C.borderHd}`,
    borderRadius: 2, boxShadow: '0 28px 64px rgba(0,0,0,0.55)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, padding: '18px 20px 14px', borderBottom: `1px solid ${C.sep}`,
  },
  modalTitle:    { margin: 0, fontSize: 17, fontWeight: 700, color: C.text },
  modalText:     { margin: '4px 0 0', fontSize: 12, color: C.textMut, lineHeight: 1.6 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 2,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: C.textMut, cursor: 'pointer', fontSize: 18, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  modalBody: {
    display: 'flex', flexDirection: 'column', gap: 14,
    padding: 20, overflowY: 'auto', minHeight: 0,
  },
  editorBody:    { display: 'flex', flex: 1, padding: 20, overflow: 'hidden', minHeight: 0 },
  modalControls: { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
  modalInputWrap: { minWidth: 160, maxWidth: 200 },
  input: {
    background: '#111827', color: C.text,
    border: `1px solid rgba(52,199,89,0.22)`,
    borderRadius: 2, padding: '7px 10px',
    fontSize: 13, fontFamily: FONT_SANS, width: '100%', outline: 'none',
  },
  helperText: { fontSize: 11, color: C.textMut },
  batchList: { display: 'flex', flexDirection: 'column', gap: 14 },
  batchCard: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 2, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
  },
  batchCardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  },
  batchCardTitle: { margin: 0, fontSize: 13, fontWeight: 700, color: C.text },
  batchMeta:      { fontSize: 11, color: C.textMut, fontFamily: FONT_MONO },
  batchHeaderActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 2,
    border: `1px solid ${accent}`, background: 'transparent',
    color: accent, cursor: 'pointer', fontSize: 16, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  batchRegenerateBtn: {
    borderRadius: 2,
    border: '1px solid rgba(56,189,248,0.45)',
    background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(37,99,235,0.08))',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    padding: '6px 12px',
    fontFamily: FONT_SANS,
    letterSpacing: '0.02em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 16px rgba(56,189,248,0.12)',
  },
  batchEditBtn: {
    borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: C.text,
    cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '6px 12px', fontFamily: FONT_SANS,
  },
  batchViewerRow: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'stretch' },
  batchPreviewColumn: { display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 620px', minWidth: 0 },
  batchReferenceRow:  { display: 'flex', justifyContent: 'center' },
  batchOptionsRow:    { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  batchViewerTile:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  editorLayout:  { display: 'flex', flex: 1, gap: 18, alignItems: 'stretch', minHeight: 0, height: '100%', overflow: 'hidden' },
  editorSidebar: { flex: '0 0 310px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto', paddingRight: 6 },
  editorPreview: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto', paddingRight: 6 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px',
    borderTop: `1px solid ${C.sep}`,
  },
  confirmBody: { padding: '16px 20px 6px', color: C.text, fontSize: 14, lineHeight: 1.5 },
  batchEmpty: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 2,
    padding: '16px', color: C.textMut, fontSize: 13,
  },
  toast: {
    position: 'fixed', bottom: 20, right: 20,
    background: accent, color: '#000',
    padding: '9px 18px', borderRadius: 2,
    fontWeight: 700, fontSize: 12, zIndex: 999,
    boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
  },
};

// ─── Trace table components ───────────────────────────────────────────────────

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

function RotationSummaryTable({ viewA, viewB, distractorViews }) {
  const correctDelta = { roll: viewB.roll - viewA.roll, elev: viewB.elev - viewA.elev, azim: viewB.azim - viewA.azim };
  const rows = [
    { label: 'Reference',      accentColor: accent,              view: viewA, delta: null, mirrorNote: viewA.mirror },
    { label: 'Correct Answer', accentColor: correctAnswerAccent, view: viewB, delta: correctDelta, mirrorNote: viewB.mirror },
    ...distractorViews.map((view, i) => ({
      label: DISTRACTOR_LABELS[i], accentColor: distractorAccent,
      view,
      delta: { roll: view.roll - viewA.roll, elev: view.elev - viewA.elev, azim: view.azim - viewA.azim },
      mirrorNote: view.mirror,
    })),
  ];
  const cols = '32px 130px 160px 1fr';
  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'View', 'Angles', 'Delta'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right', paddingTop: 2 }}>{i + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: row.accentColor }}>{row.label}</span>
          <span style={{ fontSize: 11, color: '#c4d4ff', lineHeight: 1.6 }}>
            X={row.view.roll}° Y={row.view.elev}° Z={row.view.azim}°
            {row.mirrorNote && <span style={{ color: C.danger, marginLeft: 4 }}>[M]</span>}
          </span>
          <span style={{ fontSize: 11, color: C.textMut, lineHeight: 1.6 }}>
            {row.delta
              ? `ΔX=${row.delta.roll}° ΔY=${row.delta.elev}° ΔZ=${row.delta.azim}°`
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function DifficultyTraceTable({ dRoll, dElev, dAzim, mirrorChanged }) {
  const difficulty = computeDifficulty(dRoll, dElev, dAzim, mirrorChanged);
  const tierColor = DIFFICULTY_COLORS[difficulty.score] || accent;

  const rows = [
    { label: 'X Rotation (ΔX)', val: `${Math.abs(dRoll)}°` },
    { label: 'Y Rotation (ΔY)', val: `${Math.abs(dElev)}°` },
    { label: 'Z Rotation (ΔZ)', val: `${Math.abs(dAzim)}°` },
    { label: 'Total rotation',  val: `${difficulty.total}°` },
    { label: 'Axes used',       val: String(difficulty.axesUsed) },
    { label: 'Mirror changed',  val: mirrorChanged ? 'Yes' : 'No' },
  ];
  const cols = '32px 1fr 80px';
  return (
    <div style={{ fontFamily: FONT_MONO }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '6px 10px', background: `${tierColor}0d`, border: `1px solid ${tierColor}30`, borderRadius: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: tierColor }}>
          Score {difficulty.score} · {difficulty.label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['#', 'Factor', 'Value'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 0 ? 'right' : i === 2 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 16px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{i + 1}</span>
          <span style={{ fontSize: 12, color: '#c4d4ff' }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'right' }}>{row.val}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Render helper hook ─────────────────────────────────────────────────────

function useCanvasRender(canvasRef, view, coords, figureColor, backgroundFill) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !coords.length) return;
    const dW = canvas.width;
    const dH = canvas.height;
    const offSize = Math.max(dW, dH) * 2;
    const cfg = makeConfig(coords, offSize, view, { cubeFill: figureColor, backgroundFill });
    const raw = offscreenRender(view, coords, cfg, offSize);
    const centered = autoCenterCanvas(raw, backgroundFill);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dW, dH);
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, dW, dH);
    ctx.drawImage(centered, 0, 0, dW, dH);
  }, [view.shape, view.config, view.roll, view.elev, view.azim, view.tX, view.tY, view.tZ, view.mirror, coords, figureColor, backgroundFill]);
}

// ─── View controls sub-component ────────────────────────────────────────────

const AXIS_LABELS = { roll: 'X Rotation', elev: 'Y Rotation', azim: 'Z Rotation' };

function ViewControls({ label, view, onChange, wrapped = true, showTitle = true, showMirror = true, leadingContent = null, accentColor = accent, mirrorDisabled = false }) {
  const set = (key, val) => onChange({ ...view, [key]: val });
  const content = (
    <>
      {showTitle && <h4 style={styles.sectionTitle(accentColor)}>{label}</h4>}
      {leadingContent}
      {['roll', 'elev', 'azim'].map(axis => (
        <div key={axis}>
          <div style={styles.row}>
            <span style={{ ...styles.label, width: 72, flexShrink: 0 }}>{AXIS_LABELS[axis]}</span>
            <input
              type="range" min={-180} max={180} step={1}
              value={view[axis]} onChange={e => set(axis, Number(e.target.value))}
              style={styles.slider(accentColor)}
            />
            <span style={{ fontSize: 12, color: C.textMut, width: 40, textAlign: 'right', fontFamily: FONT_MONO }}>
              {view[axis]}&deg;
            </span>
          </div>
        </div>
      ))}
      {showMirror && (
        <div style={styles.row}>
          <input
            type="checkbox" checked={view.mirror}
            onChange={e => set('mirror', e.target.checked)}
            style={{ ...styles.checkbox, accentColor }}
            id={`mirror-${label}`} disabled={mirrorDisabled}
          />
          <label htmlFor={`mirror-${label}`} style={{ fontSize: 13, cursor: mirrorDisabled ? 'default' : 'pointer', opacity: mirrorDisabled ? 0.7 : 1 }}>
            Mirror
          </label>
        </div>
      )}
    </>
  );
  if (!wrapped) return content;
  return <div style={styles.section}>{content}</div>;
}

function FigureSelectorControls({ title, view, onChange }) {
  return (
    <div>
      <div style={{ ...styles.label, fontWeight: 700, color: C.textSec, marginBottom: 6 }}>{title}</div>
      <div style={styles.row}>
        <div style={{ flex: 1 }}>
          <div style={styles.label}>Shape</div>
          <select value={view.shape} onChange={e => onChange('shape', e.target.value)} style={styles.select}>
            {SHAPES.map(s => <option key={s} value={s}>Shape {s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.label}>Config</div>
          <select value={view.config} onChange={e => onChange('config', e.target.value)} style={styles.select}>
            {getConfigs(view.shape).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function usesSameBaseFigure(a, b) {
  return a.shape === b.shape && a.config === b.config;
}

function normalizeDistractorView(view, referenceView) {
  if (usesSameBaseFigure(view, referenceView)) return { ...view, mirror: true };
  return view;
}

function pickRandomFigureBase() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const configs = getConfigs(shape);
  const config  = configs[Math.floor(Math.random() * configs.length)];
  return { shape, config };
}

function pickRandomFigureColor() {
  return FIGURE_COLORS[Math.floor(Math.random() * FIGURE_COLORS.length)].value;
}

function pickRandomSnapAngle() {
  return SNAP_ANGLES[Math.floor(Math.random() * SNAP_ANGLES.length)] * (Math.random() > 0.5 ? 1 : -1);
}

function buildSuggestedDistractorViews(viewB, dRoll, dElev, dAzim, referenceView) {
  return generateDistractors(viewB, dRoll, dElev, dAzim)
    .map(({ view }) => normalizeDistractorView({ ...view, ...pickRandomFigureBase() }, referenceView));
}

// ─── Color picker dropdown ────────────────────────────────────────────────────

function FigureColorDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = FIGURE_COLORS.find(o => o.value === value) || FIGURE_COLORS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown  = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={rootRef} style={styles.dropdownWrap}>
      <button type="button" onClick={() => setOpen(p => !p)} style={styles.dropdownButton(open)} aria-haspopup="listbox" aria-expanded={open}>
        <span style={styles.dropdownValue}>
          <span style={styles.colorSwatch(selected.value)} />
          <span>{selected.label}</span>
        </span>
        <span style={styles.dropdownCaret(open)}>▼</span>
      </button>
      {open && (
        <div role="listbox" style={styles.dropdownMenu}>
          {FIGURE_COLORS.map(option => (
            <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} style={styles.dropdownItem(option.value === value, option.value)} aria-selected={option.value === value}>
              <span style={styles.colorSwatch(option.value)} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview canvas ────────────────────────────────────────────────────────────

function SpatialPreviewCanvas({ view, figureColor, backgroundFill, size = 180, label }) {
  const canvasRef = useRef(null);
  const coords    = getCoords(view.shape, view.config);
  useCanvasRender(canvasRef, view, coords, figureColor, backgroundFill);
  return (
    <div style={styles.batchViewerTile}>
      <div style={{ ...styles.canvasBox, background: backgroundFill }}>
        <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block' }} />
      </div>
      {label && <div style={styles.canvasLabel}>{label}</div>}
    </div>
  );
}

// ─── Batch item summary card ──────────────────────────────────────────────────

function BatchItemSummary({ item, onEdit, onSetStatus, onRegenerate, itemIndex }) {
  const { viewA, viewB, distractorViews, figureColor, backgroundMode } = item;
  const figLabel = FIGURE_COLORS.find(o => o.value === figureColor)?.label || figureColor;

  return (
    <div style={{ minWidth: 260, flex: '1 1 300px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: `rgba(52,199,89,0.68)`, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Item Summary</div>
        <div style={styles.batchHeaderActions}>
          <button
            type="button"
            style={{ ...styles.btnBank, padding: '4px 14px', fontSize: 11, opacity: item.status === 'accepted' ? 1 : 0.55 }}
            onClick={() => onSetStatus(item.id, item.status === 'accepted' ? 'pending' : 'accepted')}
          >
            {item.status === 'accepted' ? '✓ Accepted' : 'Accept'}
          </button>
          <button
            type="button"
            style={{ ...styles.btnOutline, padding: '4px 14px', fontSize: 11, color: C.danger, borderColor: C.danger, opacity: item.status === 'rejected' ? 1 : 0.55 }}
            onClick={() => onSetStatus(item.id, item.status === 'rejected' ? 'pending' : 'rejected')}
          >
            {item.status === 'rejected' ? '✗ Rejected' : 'Reject'}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            style={{ ...styles.batchRegenerateBtn, padding: '4px 12px', fontSize: 11 }}
            title={`Regenerate item ${itemIndex + 1}`}
            aria-label={`Regenerate item ${itemIndex + 1}`}
          >
            Regenerate
          </button>
          <button type="button" onClick={onEdit} style={styles.batchEditBtn}>Edit</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <Badge label={`${viewA.shape}${viewA.config}`} color={accent} />
        <Badge label={figLabel} color={C.textMut} />
        <Badge label={BACKGROUND_MODES[backgroundMode].label} color={C.textMut} />
      </div>
      <RotationSummaryTable viewA={viewA} viewB={viewB} distractorViews={distractorViews} />
    </div>
  );
}

// ─── Utility functions ─────────────────────────────────────────────────────────

function normalizeBatchItem(item) {
  const referenceView     = { ...item.viewA, mirror: false };
  const correctAnswerView = { ...item.viewB, shape: referenceView.shape, config: referenceView.config, mirror: false };
  const distractorViews   = item.distractorViews.map(view => normalizeDistractorView({ ...view }, referenceView));
  return { ...item, status: item.status || 'pending', viewA: referenceView, viewB: correctAnswerView, distractorViews };
}

function buildSpatialBankItemFromViews({ viewA, viewB, figureColor, backgroundMode, distractorViews, bankId }) {
  const dRoll         = viewB.roll  - viewA.roll;
  const dElev         = viewB.elev  - viewA.elev;
  const dAzim         = viewB.azim  - viewA.azim;
  const mirrorChanged = viewA.mirror !== viewB.mirror;
  const difficulty    = computeDifficulty(dRoll, dElev, dAzim, mirrorChanged);
  const normalizedDistractors = distractorViews.map(view => normalizeDistractorView({ ...view }, viewA));

  return makeBankItem({
    id: bankId || genBankId('rotation'),
    name: `Spatial Rotation ${viewA.shape}${viewA.config}`,
    stem: 'Identify which answer option matches the reference figure from a different viewpoint.',
    generatedBy: 'spatial-rotation',
    constructId: 'spatial-reasoning',
    responseFormat: 'mc',
    responseOptions: ['Correct Answer', 'Distractor A', 'Distractor B', 'Distractor C'],
    difficulty: { score: difficulty.score, label: difficulty.label, raw: difficulty },
    generatorMeta: { viewA: { ...viewA }, viewB: { ...viewB }, figureColor, backgroundMode, distractorViews: normalizedDistractors, dRoll, dElev, dAzim, mirrorChanged },
  });
}

function createRandomSpatialItem(backgroundMode) {
  const randomBase  = pickRandomFigureBase();
  const referenceView = { ...BLANK_VIEW, ...randomBase, roll: pickRandomSnapAngle(), elev: pickRandomSnapAngle(), azim: pickRandomSnapAngle(), mirror: false };
  const delta = { roll: pickRandomSnapAngle(), elev: pickRandomSnapAngle(), azim: pickRandomSnapAngle() };
  const correctAnswerView = { ...referenceView, ...randomBase, roll: referenceView.roll + delta.roll, elev: referenceView.elev + delta.elev, azim: referenceView.azim + delta.azim, mirror: false };
  const itemFigureColor   = pickRandomFigureColor();

  return normalizeBatchItem({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    bankId: genBankId('rotation'),
    status: 'pending',
    figureColor: itemFigureColor, backgroundMode,
    viewA: referenceView, viewB: correctAnswerView,
    distractorViews: buildSuggestedDistractorViews(correctAnswerView, correctAnswerView.roll - referenceView.roll, correctAnswerView.elev - referenceView.elev, correctAnswerView.azim - referenceView.azim, referenceView),
  });
}

// ─── Batch Item Editor Modal ───────────────────────────────────────────────────

function BatchItemEditorModal({ open, item, onClose, onSave }) {
  const [draft, setDraft] = useState(() => item ? normalizeBatchItem(item) : null);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const handleReferenceFigureChange = (key, val) => {
    if (key === 'shape') {
      const configs     = getConfigs(val);
      const nextConfig  = configs.includes(draft.viewA.config) ? draft.viewA.config : configs[0];
      const nextRef     = { ...draft.viewA, shape: val, config: nextConfig, mirror: false };
      setDraft(cur => normalizeBatchItem({ ...cur, viewA: nextRef, viewB: { ...cur.viewB, shape: val, config: nextConfig, mirror: false } }));
      return;
    }
    const nextRef = { ...draft.viewA, config: val, mirror: false };
    setDraft(cur => normalizeBatchItem({ ...cur, viewA: nextRef, viewB: { ...cur.viewB, config: val, mirror: false } }));
  };

  const handleViewAChange = (nextView) => setDraft(cur => normalizeBatchItem({ ...cur, viewA: { ...nextView, mirror: false } }));
  const handleViewBChange = (nextView) => setDraft(cur => normalizeBatchItem({ ...cur, viewB: { ...nextView, shape: cur.viewA.shape, config: cur.viewA.config, mirror: false } }));

  const handleDistractorFigureChange = (index, key, val) => {
    setDraft(cur => {
      const next = cur.distractorViews.map((view, i) => {
        if (i !== index) return view;
        if (key === 'shape') { const configs = getConfigs(val); return { ...view, shape: val, config: configs.includes(view.config) ? view.config : configs[0] }; }
        return { ...view, config: val };
      });
      return normalizeBatchItem({ ...cur, distractorViews: next });
    });
  };

  const handleDistractorViewChange = (index, nextView) => {
    setDraft(cur => normalizeBatchItem({ ...cur, distractorViews: cur.distractorViews.map((v, i) => i === index ? nextView : v) }));
  };

  const handleRandomizeDistractor = (index) => {
    setDraft(cur => {
      const next = cur.distractorViews.map((view, i) => {
        if (i !== index) return view;
        return { ...view, ...pickRandomFigureBase(), roll: pickRandomSnapAngle(), elev: pickRandomSnapAngle(), azim: pickRandomSnapAngle(), mirror: Math.random() > 0.5 };
      });
      return normalizeBatchItem({ ...cur, distractorViews: next });
    });
  };

  const previewBackground = BACKGROUND_MODES[draft.backgroundMode].canvas;

  return (
    <div style={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Edit Generated Item</h3>
            <p style={styles.modalText}>Tweak the generated item, preview the result, and save the updated version back into the batch list.</p>
          </div>
          <button type="button" onClick={onClose} style={styles.modalCloseBtn} aria-label="Close">×</button>
        </div>

        <div style={styles.editorBody}>
          <div style={styles.editorLayout}>
            <div style={styles.editorSidebar}>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle(viewerAccent)}>Figure Color</h4>
                <FigureColorDropdown value={draft.figureColor} onChange={val => setDraft(cur => ({ ...cur, figureColor: val }))} />
              </div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle(viewerAccent)}>Viewer Background</h4>
                <div style={styles.modeRow}>
                  {Object.entries(BACKGROUND_MODES).map(([key, mode]) => (
                    <button key={key} type="button" onClick={() => setDraft(cur => ({ ...cur, backgroundMode: key }))} style={styles.modeBtn(draft.backgroundMode === key, viewerAccent)}>{mode.label}</button>
                  ))}
                </div>
              </div>

              <ViewControls
                label="Reference Figure" view={draft.viewA} onChange={handleViewAChange} showMirror={false}
                leadingContent={<>
                  <FigureSelectorControls title="Reference Figure" view={draft.viewA} onChange={handleReferenceFigureChange} />
                  <div style={{ fontSize: 11, color: C.textMut }}>Correct Answer uses the same base figure as the reference.</div>
                </>}
              />
              <ViewControls label="Correct Answer" view={draft.viewB} onChange={handleViewBChange} showMirror={false} accentColor={correctAnswerAccent} />

              {DISTRACTOR_LABELS.map((label, index) => (
                <div key={label} style={styles.section}>
                  <h4 style={styles.sectionTitle(distractorAccent)}>{label}</h4>
                  <FigureSelectorControls title={`${label} Figure`} view={draft.distractorViews[index]} onChange={(key, val) => handleDistractorFigureChange(index, key, val)} />
                  <button type="button" onClick={() => handleRandomizeDistractor(index)} style={styles.miniBtn(distractorAccent)}>Randomize</button>
                  <div style={{ marginTop: 4 }}>
                    <ViewControls label={label} view={draft.distractorViews[index]} onChange={nextView => handleDistractorViewChange(index, nextView)} wrapped={false} showTitle={false} accentColor={distractorAccent} mirrorDisabled={usesSameBaseFigure(draft.distractorViews[index], draft.viewA)} />
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.editorPreview}>
              <div style={styles.section}>
                <div style={styles.canvasWrap}>
                  <SpatialPreviewCanvas view={draft.viewA} figureColor={draft.figureColor} backgroundFill={previewBackground} size={180} label="Reference Figure" />
                </div>
                <div style={styles.previewDivider} />
                <h4 style={styles.sectionTitle()}>Answer Options</h4>
                <div style={styles.distractorRow}>
                  <SpatialPreviewCanvas view={draft.viewB} figureColor={draft.figureColor} backgroundFill={previewBackground} size={180} label="Correct Answer" />
                  {draft.distractorViews.map((view, i) => (
                    <SpatialPreviewCanvas key={`${draft.id}-edit-${DISTRACTOR_LABELS[i]}`} view={view} figureColor={draft.figureColor} backgroundFill={previewBackground} size={180} label={DISTRACTOR_LABELS[i]} />
                  ))}
                </div>
              </div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle()}>Rotation Summary</h4>
                <RotationSummaryTable viewA={draft.viewA} viewB={draft.viewB} distractorViews={draft.distractorViews} />
              </div>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button type="button" onClick={onClose} style={styles.btnOutline}>Cancel</button>
          <button type="button" onClick={() => onSave(normalizeBatchItem(draft))} style={styles.btn}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modals ────────────────────────────────────────────────────────────

function ConfirmBatchSendModal({ open, itemCount, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add accepted spatial items?</div>
        <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
          This will add {itemCount} accepted spatial item{itemCount === 1 ? '' : 's'} to the item bank and remove them from this batch list.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} style={styles.btnOutline}>Review More</button>
          <button type="button" onClick={onConfirm} style={{ ...styles.btn, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add {itemCount} to Bank</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmSingleSendModal({ open, bankId, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 'min(480px, 100%)', border: `1px solid ${C.success}66`, borderRadius: 12, background: 'linear-gradient(145deg, #0f172a 0%, #082f2a 48%, #052e16 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 42px rgba(34,197,94,0.16)', padding: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.success, marginBottom: 10 }}>Confirm add to bank</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Add current spatial item?</div>
        <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
          This will add the current spatial-rotation item to the item bank using the ID shown below.
        </p>
        <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(52,199,89,0.18), rgba(34,211,238,0.08))', boxShadow: '0 0 18px rgba(52,199,89,0.16)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ID {bankId || 'pending'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} style={styles.btnOutline}>Review More</button>
          <button type="button" onClick={onConfirm} style={{ ...styles.btn, boxShadow: '0 0 24px rgba(34,197,94,0.18)' }}>Add to Bank</button>
        </div>
      </div>
    </div>
  );
}

// ─── Batch generation modal ────────────────────────────────────────────────────

function BatchGenerationModal({ open, onCancel, batchCount, onBatchCountChange, onGenerate, batchItems, onRegenerateItem, onEditItem, onSendToBank, onSetStatus }) {
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const acceptedCount = batchItems.filter(item => item.status === 'accepted').length;
  const hasAccepted = acceptedCount > 0;

  if (!open) return null;

  const handleCancel = () => {
    if (!batchItems.length) {
      onCancel();
      return;
    }
    setCancelConfirmOpen(true);
  };

  const confirmCancel = () => {
    setCancelConfirmOpen(false);
    onCancel();
  };
  const handleGenerate = () => {
    if (batchItems.length) {
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
    ...styles.btnOutline,
    color: C.danger,
    borderColor: `${C.danger}80`,
    background: 'rgba(248,113,113,0.08)',
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Batch Generate Spatial Items</h3>
            <p style={styles.modalText}>Generate a batch of random spatial-rotation items and preview each one.</p>
          </div>
        </div>

        <div style={{ ...styles.modalBody, padding: 0, overflow: 'hidden' }}>
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
                Set the batch size, generate spatial items, then review them on the right before sending them to the item bank.
              </div>

              <div style={styles.modalInputWrap}>
                <div style={styles.label}>Number of items</div>
                <input type="number" min={1} max={50} value={batchCount} onChange={e => onBatchCountChange(e.target.value)} style={styles.input} />
              </div>

              <div style={styles.helperText}>Up to 50 items per batch.</div>

              <button type="button" onClick={handleGenerate} style={{ ...styles.btn, justifyContent: 'center' }}>Generate</button>
              <button type="button" onClick={handleCancel} style={{ ...cancelButtonStyle, justifyContent: 'center' }}>Cancel</button>
              <button
                type="button"
                onClick={onSendToBank}
                style={{ ...styles.btnOutline, justifyContent: 'center', opacity: hasAccepted ? 1 : 0.55, cursor: hasAccepted ? 'pointer' : 'not-allowed' }}
                disabled={!hasAccepted}
              >
                Add Accepted ({acceptedCount}) to Bank
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: 20 }}>
          {batchItems.length > 0 ? (
            <div style={styles.batchList}>
              {batchItems.map((item, index) => (
                <div key={item.id} style={styles.batchCard}>
                  <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, fontWeight: 900, fontFamily: FONT_MONO, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, padding: '4px 8px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(52,199,89,0.18), rgba(34,211,238,0.08))', boxShadow: '0 0 18px rgba(52,199,89,0.16)' }}>
                    ID {item.bankId || 'pending'}
                  </div>
                  <div style={styles.batchCardHeader}>
                    <h4 style={styles.batchCardTitle}>Item {index + 1}</h4>
                  </div>
                  <div style={styles.batchViewerRow}>
                    <div style={styles.batchPreviewColumn}>
                      <div style={styles.batchReferenceRow}>
                        <SpatialPreviewCanvas view={item.viewA} figureColor={item.figureColor} backgroundFill={BACKGROUND_MODES[item.backgroundMode].canvas} size={120} label="Reference Figure" />
                      </div>
                      <div style={styles.batchOptionsRow}>
                        <SpatialPreviewCanvas view={item.viewB} figureColor={item.figureColor} backgroundFill={BACKGROUND_MODES[item.backgroundMode].canvas} size={120} label="Correct Answer" />
                        {item.distractorViews.map((view, i) => (
                          <SpatialPreviewCanvas key={`${item.id}-${DISTRACTOR_LABELS[i]}`} view={view} figureColor={item.figureColor} backgroundFill={BACKGROUND_MODES[item.backgroundMode].canvas} size={120} label={DISTRACTOR_LABELS[i]} />
                        ))}
                      </div>
                    </div>
                    <BatchItemSummary
                      item={item}
                      itemIndex={index}
                      onSetStatus={onSetStatus}
                      onRegenerate={() => onRegenerateItem(item.id)}
                      onEdit={() => onEditItem(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.batchEmpty}>
              Enter how many items you want and click <strong style={{ color: C.text }}>Generate</strong> to preview the batch here.
            </div>
          )}
            </div>
          </div>
          {cancelConfirmOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
              <div style={{ width: 'min(460px, 100%)', border: `1px solid ${C.danger}66`, borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1f1118 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(248,113,113,0.12)', padding: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.danger, marginBottom: 10 }}>Discard generated batch?</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Close batch generator</div>
                <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
                  This will clear {batchItems.length} generated item{batchItems.length === 1 ? '' : 's'} from the batch list. This cannot be undone.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setCancelConfirmOpen(false)} style={styles.btnOutline}>Keep Working</button>
                  <button type="button" onClick={confirmCancel} style={cancelButtonStyle}>Discard Items</button>
                </div>
              </div>
            </div>
          )}
          {generateConfirmOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)' }}>
              <div style={{ width: 'min(500px, 100%)', border: `1px solid ${accent}66`, borderRadius: 10, background: 'linear-gradient(145deg, #0f172a 0%, #111827 50%, #1a1620 100%)', boxShadow: '0 28px 90px rgba(0,0,0,0.65), 0 0 38px rgba(52,199,89,0.12)', padding: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, marginBottom: 10 }}>Replace generated batch?</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 10 }}>Generate a new spatial batch?</div>
                <p style={{ margin: 0, color: C.textMut, fontSize: 13, lineHeight: 1.65 }}>
                  Generating again will delete the {batchItems.length} item{batchItems.length === 1 ? '' : 's'} already shown in this batch list. If you want to keep any of them, add them to the item bank first.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setGenerateConfirmOpen(false)} style={styles.btnOutline}>Keep Current Batch</button>
                  <button type="button" onClick={confirmGenerate} style={{ ...styles.btn, boxShadow: '0 0 24px rgba(52,199,89,0.18)' }}>Generate New Batch</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main generator component ──────────────────────────────────────────────────

export default function SpatialRotationGenerator() {
  const [viewA, setViewA]               = useState({ ...BLANK_VIEW });
  const [viewB, setViewB]               = useState({ ...BLANK_VIEW, elev: 45 });
  const [figureColor, setFigureColor]   = useState(FIGURE_COLORS[0].value);
  const [backgroundMode, setBackgroundMode] = useState('light');
  const [distractorViews, setDistractorViews] = useState(() => buildSuggestedDistractorViews({ ...BLANK_VIEW, elev: 45 }, 0, 45, 0, { ...BLANK_VIEW }));
  const [batchModalOpen, setBatchModalOpen]     = useState(false);
  const [batchCount, setBatchCount]             = useState('10');
  const [batchItems, setBatchItems]             = useState([]);
  const [editingBatchItemId, setEditingBatchItemId] = useState(null);
  const [confirmBatchSendOpen, setConfirmBatchSendOpen]   = useState(false);
  const [confirmSingleSendOpen, setConfirmSingleSendOpen] = useState(false);
  const [singleBankId, setSingleBankId]         = useState(() => genBankId('rotation'));
  const [activeTab, setActiveTab]       = useState('summary');
  const [controlsHidden, setControlsHidden] = useState(false);
  const [toast, setToast]               = useState(null);
  const leftPaneWidth = 360;
  const controlsRailWidth = 26;

  const canvasBackground = BACKGROUND_MODES[backgroundMode].canvas;
  const canvasARef       = useRef(null);
  const canvasBRef       = useRef(null);
  const distRefs         = [useRef(null), useRef(null), useRef(null)];

  const coordsA = getCoords(viewA.shape, viewA.config);
  const coordsB = getCoords(viewB.shape, viewB.config);

  const dRoll         = viewB.roll  - viewA.roll;
  const dElev         = viewB.elev  - viewA.elev;
  const dAzim         = viewB.azim  - viewA.azim;
  const mirrorChanged = viewA.mirror !== viewB.mirror;

  useCanvasRender(canvasARef, viewA, coordsA, figureColor, canvasBackground);
  useCanvasRender(canvasBRef, viewB, coordsB, figureColor, canvasBackground);

  useEffect(() => {
    distractorViews.forEach((view, i) => {
      const ref = distRefs[i];
      if (!ref.current) return;
      const coords = getCoords(view.shape, view.config);
      if (!coords.length) return;
      const canvas  = ref.current;
      const offSize = Math.max(canvas.width, canvas.height) * 2;
      const cfg     = makeConfig(coords, offSize, view, { cubeFill: figureColor, backgroundFill: canvasBackground });
      const raw     = offscreenRender(view, coords, cfg, offSize);
      const centered = autoCenterCanvas(raw, canvasBackground);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = canvasBackground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(centered, 0, 0, canvas.width, canvas.height);
    });
  }, [distractorViews, figureColor, canvasBackground]);

  const handleReferenceFigureChange = (key, val) => {
    if (key === 'shape') {
      const configs = getConfigs(val);
      let nextReference = null;
      setViewA(cur => { const nextConfig = configs.includes(cur.config) ? cur.config : configs[0]; nextReference = { ...cur, shape: val, config: nextConfig }; return nextReference; });
      setViewB(cur => { const nextConfig = configs.includes(cur.config) ? cur.config : configs[0]; return { ...cur, shape: val, config: nextConfig }; });
      setDistractorViews(cur => cur.map(view => normalizeDistractorView(view, nextReference || { ...viewA, shape: val, config: configs.includes(viewA.config) ? viewA.config : configs[0] })));
      return;
    }
    const nextReference = { ...viewA, config: val };
    setViewA(cur => ({ ...cur, config: val }));
    setViewB(cur => ({ ...cur, config: val }));
    setDistractorViews(cur => cur.map(view => normalizeDistractorView(view, nextReference)));
  };

  const handleDistractorFigureChange = (index, key, val) => {
    setDistractorViews(cur => cur.map((view, i) => {
      if (i !== index) return view;
      if (key === 'shape') { const configs = getConfigs(val); return normalizeDistractorView({ ...view, shape: val, config: configs.includes(view.config) ? view.config : configs[0] }, viewA); }
      return normalizeDistractorView({ ...view, config: val }, viewA);
    }));
  };

  const handleDistractorViewChange = (index, nextView) => {
    setDistractorViews(cur => cur.map((v, i) => i === index ? normalizeDistractorView(nextView, viewA) : v));
  };

  const handleRandomizeDistractor = (index) => {
    setDistractorViews(cur => cur.map((view, i) => {
      if (i !== index) return view;
      return normalizeDistractorView({ ...view, ...pickRandomFigureBase(), roll: pickRandomSnapAngle(), elev: pickRandomSnapAngle(), azim: pickRandomSnapAngle(), mirror: Math.random() > 0.5 }, viewA);
    }));
  };

  const generateRandom = () => {
    const shape   = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const configs = getConfigs(shape);
    const config  = configs[Math.floor(Math.random() * configs.length)];
    const newA    = { ...BLANK_VIEW, shape, config };
    const newB    = { ...BLANK_VIEW, shape, config, roll: pickRandomSnapAngle(), elev: pickRandomSnapAngle(), azim: pickRandomSnapAngle(), mirror: Math.random() > 0.7 };
    setViewA(newA);
    setViewB(newB);
    setDistractorViews(buildSuggestedDistractorViews(newB, newB.roll - newA.roll, newB.elev - newA.elev, newB.azim - newA.azim, newA));
    setSingleBankId(genBankId('rotation'));
  };

  const handleGenerateDistractors = () => {
    setDistractorViews(buildSuggestedDistractorViews(viewB, dRoll, dElev, dAzim, viewA));
  };

  const handleGenerateBatch = () => {
    const parsed = Number.parseInt(batchCount, 10);
    const count  = Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 10;
    setBatchCount(String(count));
    setBatchItems(Array.from({ length: count }, () => createRandomSpatialItem(backgroundMode)));
  };

  const handleOpenBatchModal = () => {
    setBatchItems([]);
    setBatchModalOpen(true);
  };

  const handleCancelBatchModal = () => {
    setBatchItems([]);
    setBatchModalOpen(false);
  };

  const handleSendBatchToBank = () => {
    if (batchItems.some(item => item.status === 'accepted')) setConfirmBatchSendOpen(true);
  };

  const handleConfirmSendBatchToBank = () => {
    const acceptedItems = batchItems.filter(item => item.status === 'accepted');
    const bankItems = acceptedItems.map(item => buildSpatialBankItemFromViews(normalizeBatchItem(item)));
    appendToBank(bankItems);
    setBatchItems(cur => cur.filter(item => item.status === 'pending'));
    setConfirmBatchSendOpen(false);
    setToast(`${bankItems.length} accepted item${bankItems.length === 1 ? '' : 's'} added to Item Bank`);
    setTimeout(() => setToast(null), 2000);
  };

  const handleRegenerateBatchItem = (itemId) => {
    setBatchItems(cur => cur.map(item => item.id === itemId ? createRandomSpatialItem(item.backgroundMode) : item));
  };

  const handleSetBatchItemStatus = (itemId, status) => {
    setBatchItems(cur => cur.map(item => item.id === itemId ? { ...item, status } : item));
  };

  const handleSaveBatchItem = (nextItem) => {
    setBatchItems(cur => cur.map(item => item.id === nextItem.id ? normalizeBatchItem(nextItem) : item));
    setEditingBatchItemId(null);
  };

  const editingBatchItem = batchItems.find(item => item.id === editingBatchItemId) || null;

  const handleConfirmAddToBank = () => {
    const dViews = distractorViews.length === 3
      ? distractorViews.map(view => normalizeDistractorView({ ...view }, viewA))
      : buildSuggestedDistractorViews(viewB, dRoll, dElev, dAzim, viewA);
    appendToBank([buildSpatialBankItemFromViews({ viewA: { ...viewA }, viewB: { ...viewB }, figureColor, backgroundMode, distractorViews: dViews, bankId: singleBankId })]);
    setConfirmSingleSendOpen(false);
    setSingleBankId(genBankId('rotation'));
    setToast('Added to Item Bank');
    setTimeout(() => setToast(null), 2000);
  };

  const TABS = [
    { id: 'summary',    label: 'Rotation Summary' },
    { id: 'difficulty', label: 'Difficulty'        },
  ];
  const tab = TABS.find(t => t.id === activeTab) ? activeTab : 'summary';

  return (
    <div style={styles.container}>
      <div style={styles.contentRow}>
        <div style={{
          flex: `0 0 ${controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth}px`,
          minWidth: controlsHidden ? controlsRailWidth : leftPaneWidth + controlsRailWidth,
          display: 'flex',
          minHeight: 0,
          transition: 'flex-basis 0.18s ease, min-width 0.18s ease',
        }}>

        {/* ── Left panel: controls ──────────────────────────── */}
        {!controlsHidden && (
        <div style={{ ...styles.left, flex: `0 0 ${leftPaneWidth}px`, minWidth: leftPaneWidth, borderRight: 'none' }}>
          <div style={styles.section}>
            <h4 style={styles.sectionTitle(viewerAccent)}>Figure Color</h4>
            <FigureColorDropdown value={figureColor} onChange={setFigureColor} />
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle(viewerAccent)}>Viewer Background</h4>
            <div style={styles.modeRow}>
              {Object.entries(BACKGROUND_MODES).map(([key, mode]) => (
                <button key={key} type="button" onClick={() => setBackgroundMode(key)} style={styles.modeBtn(backgroundMode === key, viewerAccent)}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <ViewControls
            label="Reference Figure" view={viewA}
            onChange={v => setViewA({ ...v, mirror: false })}
            showMirror={false}
            leadingContent={<>
              <FigureSelectorControls title="Reference Figure" view={viewA} onChange={handleReferenceFigureChange} />
              <div style={{ fontSize: 11, color: C.textMut }}>Correct Answer uses the same base figure as the reference.</div>
            </>}
          />

          <ViewControls
            label="Correct Answer" view={viewB}
            onChange={v => setViewB({ ...v, shape: viewA.shape, config: viewA.config, mirror: false })}
            showMirror={false} accentColor={correctAnswerAccent}
          />

          {DISTRACTOR_LABELS.map((label, index) => (
            <div key={label} style={styles.section}>
              <h4 style={styles.sectionTitle(distractorAccent)}>{label}</h4>
              <FigureSelectorControls title={`${label} Figure`} view={distractorViews[index]} onChange={(key, val) => handleDistractorFigureChange(index, key, val)} />
              <button type="button" onClick={() => handleRandomizeDistractor(index)} style={styles.miniBtn(distractorAccent)}>Randomize</button>
              <div style={{ marginTop: 4 }}>
                <ViewControls label={label} view={distractorViews[index]} onChange={nextView => handleDistractorViewChange(index, nextView)} wrapped={false} showTitle={false} accentColor={distractorAccent} mirrorDisabled={usesSameBaseFigure(distractorViews[index], viewA)} />
              </div>
            </div>
          ))}
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
              border: '1px solid rgba(167,139,250,0.22)',
              background: controlsHidden ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
              color: controlsHidden ? viewerAccent : 'rgba(255,255,255,0.7)',
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: controlsHidden ? '0 0 0 1px rgba(167,139,250,0.1)' : 'none',
              transition: 'all 0.14s ease',
            }}
          >
            {controlsHidden ? '»' : '«'}
          </button>
        </div>
        </div>

        {/* ── Right panel ───────────────────────────────────── */}
        <div style={styles.right}>

          {/* ─── Top pane: canvas preview (fixed height) ─── */}
          <div style={{ flex: '0 0 auto', height: 528, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 20px 12px', borderBottom: `1px solid ${C.sep}`, gap: 8 }}>
            <div style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                <h4 style={styles.sectionTitle()}>Item Preview</h4>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <Badge label={`${viewA.shape}${viewA.config}`} color={accent} />
                  <Badge label={FIGURE_COLORS.find(o => o.value === figureColor)?.label || figureColor} color={C.textMut} />
                  <Badge label={BACKGROUND_MODES[backgroundMode].label} color={C.textMut} />
                </div>
              </div>

              {/* Reference figure */}
              <div style={styles.canvasWrap}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ ...styles.canvasBox, background: canvasBackground }}>
                    <canvas ref={canvasARef} width={180} height={180} style={{ display: 'block' }} />
                  </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2 }}>
                    <span style={styles.canvasLabel}>Reference Figure</span>
                    {viewA.mirror && <span style={{ fontSize: 10, fontWeight: 700, color: C.danger, letterSpacing: 1, fontFamily: FONT_MONO }}>MIRRORED</span>}
                  </div>
                </div>
              </div>

              <div style={styles.previewDivider} />
              <h4 style={{ ...styles.sectionTitle(), marginBottom: 2 }}>Answer Options</h4>

              {/* Answer options row */}
              <div style={styles.distractorRow}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ ...styles.canvasBox, background: canvasBackground }}>
                    <canvas ref={canvasBRef} width={180} height={180} style={{ display: 'block' }} />
                  </div>
                  <div style={styles.canvasLabel}>Correct Answer</div>
                </div>
                {distractorViews.map((view, i) => (
                  <div key={DISTRACTOR_LABELS[i]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ ...styles.canvasBox, background: canvasBackground }}>
                      <canvas ref={distRefs[i]} width={180} height={180} style={{ display: 'block' }} />
                    </div>
                    <div style={styles.canvasLabel}>{DISTRACTOR_LABELS[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Bottom pane: tabbed analysis ─── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            <div style={{ flex: '0 0 auto', display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.sep}`, padding: '0 16px', gap: 2, background: C.bg }}>
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    flex: '0 0 auto', padding: '8px 14px',
                    fontSize: 11, fontWeight: active ? 800 : 600,
                    color: active ? accent : 'rgba(255,255,255,0.45)',
                    background: 'transparent', border: 'none',
                    borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                    cursor: 'pointer', letterSpacing: '0.04em',
                    textTransform: 'uppercase', fontFamily: FONT_SANS,
                    marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.12s',
                  }}>{t.label}</button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={styles.section}>
                {tab === 'summary'    && <RotationSummaryTable viewA={viewA} viewB={viewB} distractorViews={distractorViews} />}
                {tab === 'difficulty' && <DifficultyTraceTable dRoll={dRoll} dElev={dElev} dAzim={dAzim} mirrorChanged={mirrorChanged} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={styles.pageFooter}>
        <div style={styles.pageFooterGroup}>
          <button style={styles.btn}        onClick={generateRandom}>Randomize Parameters</button>
          <button style={styles.btnOutline} onClick={handleGenerateDistractors}>Randomize Distractors</button>
          <button style={styles.btnOutline} onClick={handleOpenBatchModal}>Batch Generate</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 2, border: `1px solid ${accent}55`, background: 'linear-gradient(135deg, rgba(52,199,89,0.18), rgba(34,211,238,0.08))', boxShadow: '0 0 18px rgba(52,199,89,0.16)', fontSize: 11, fontWeight: 900, fontFamily: FONT_MONO, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ID {singleBankId || 'pending'}
          </div>
          <button style={styles.btnBank} onClick={() => setConfirmSingleSendOpen(true)}>Add to Bank</button>
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}

      <BatchGenerationModal
        open={batchModalOpen} onCancel={handleCancelBatchModal}
        batchCount={batchCount} onBatchCountChange={setBatchCount}
        onGenerate={handleGenerateBatch} batchItems={batchItems}
        onRegenerateItem={handleRegenerateBatchItem}
        onEditItem={id => setEditingBatchItemId(id)}
        onSendToBank={handleSendBatchToBank}
        onSetStatus={handleSetBatchItemStatus}
      />
      <BatchItemEditorModal
        key={editingBatchItem ? editingBatchItem.id : 'batch-editor-closed'}
        open={Boolean(editingBatchItem)} item={editingBatchItem}
        onClose={() => setEditingBatchItemId(null)}
        onSave={handleSaveBatchItem}
      />
      <ConfirmBatchSendModal
        open={confirmBatchSendOpen} itemCount={batchItems.filter(item => item.status === 'accepted').length}
        onCancel={() => setConfirmBatchSendOpen(false)}
        onConfirm={handleConfirmSendBatchToBank}
      />
      <ConfirmSingleSendModal
        open={confirmSingleSendOpen}
        bankId={singleBankId}
        onCancel={() => setConfirmSingleSendOpen(false)}
        onConfirm={handleConfirmAddToBank}
      />
    </div>
  );
}

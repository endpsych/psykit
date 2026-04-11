import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '../theme';
import { load } from '../store/localStorage';
import { loadBank, subscribe } from '../store/bankStore';
import DifficultyBadge from '../components/DifficultyBadge';
import { getCoords } from '../generators/spatial-rotation/shapes';
import { offscreenRender, autoCenterCanvas, makeConfig } from '../generators/spatial-rotation/renderer';
import { MatrixPreview } from '../generators/progressive-matrices/renderer';
import { buildRuleTemplateConfig } from '../generators/progressive-matrices/templates';
import { displayTerm, parseDisplayTerm } from '../generators/number-series/terms';

// ─── Constants ──────────────────────────────────────────────────────────────

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
  success: '#22c55e',
  error:   '#ef4444',
  matrix:  colors.matrix,
  spatial: colors.spatial,
  number:  colors.number,
  verbal:  colors.verbal,
};

const cardStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: 16 };

const TEST_KEY   = 'tests';
const GEN_LABELS = { 'spatial-rotation': 'Spatial Reasoning', 'number-series': 'Numerical Reasoning', 'progressive-matrices': 'Abstract Reasoning', 'verbal-reasoning': 'Verbal Reasoning' };
const GEN_COLORS = { 'spatial-rotation': C.spatial, 'number-series': C.number, 'progressive-matrices': C.matrix, 'verbal-reasoning': C.verbal };

const sty = {
  header:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  title:      { fontSize: 18, fontWeight: 800, flex: 1, fontFamily: FONT_MONO },
  btn:        { display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', background: `rgba(56,189,248,0.08)`, color: C.matrix, border: `1px solid rgba(56,189,248,0.28)`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS },
  input:      { background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 10px', fontSize: 13, fontFamily: FONT_SANS, width: '100%' },
};

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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeNumberSeriesResponse(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = parseDisplayTerm(raw);
  return parsed ? displayTerm(parsed) : raw.replace(/\s+/g, '');
}

function currentIsCorrect(selected, expectedAnswer) {
  return normalizeNumberSeriesResponse(selected) === normalizeNumberSeriesResponse(expectedAnswer);
}

// ─── Spatial Rotation canvas ─────────────────────────────────────────────────

const SPATIAL_BACKGROUND_MODES = {
  dark:  { canvas: '#040816' },
  light: { canvas: '#ffffff' },
};

function RotationCanvas({ view, size = 220, figureColor = C.spatial, backgroundMode = 'dark' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !view) return;
    const coords = getCoords(view.shape, view.config);
    if (!coords.length) return;
    const offSize = size * 2;
    const backgroundFill = SPATIAL_BACKGROUND_MODES[backgroundMode]?.canvas || SPATIAL_BACKGROUND_MODES.dark.canvas;
    const cfg = makeConfig(coords, offSize, view, { cubeFill: figureColor, backgroundFill });
    const raw = offscreenRender(view, coords, cfg, offSize);
    const centered = autoCenterCanvas(raw, backgroundFill);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(centered, 0, 0, size, size);
  }, [view, size, figureColor, backgroundMode]);
  return <canvas ref={ref} width={size} height={size} style={{ display: 'block', borderRadius: 2 }} />;
}

// ─── Item renderers ──────────────────────────────────────────────────────────

function SpatialItem({ item, selected, onSelect, revealed }) {
  const meta = item.generatorMeta || {};
  const { viewA, viewB, distractorViews = [], figureColor = C.spatial, backgroundMode = 'dark' } = meta;

  const options = useMemo(() => {
    const opts = [
      { view: viewB, isCorrect: true, key: 'opt-correct' },
      ...distractorViews.map((v, i) => ({ view: v, isCorrect: false, key: `opt-dist-${i}` })),
    ];
    return shuffle(opts);
  }, [item.id]);

  if (!viewA || !viewB) {
    return <div style={{ color: C.muted }}>Spatial rotation item data unavailable.</div>;
  }

  const bgFill  = backgroundMode === 'light' ? '#ffffff' : '#040816';
  const OPT_SIZE = 160;
  const REF_SIZE = 160;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <div style={{ fontSize: 12, color: C.dim, alignSelf: 'flex-start' }}>
        Which figure shows the <strong style={{ color: C.text }}>same shape</strong> from a different viewpoint?
      </div>

      {/* Reference figure — centered, same size as options */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, fontFamily: FONT_MONO, letterSpacing: '0.07em' }}>REFERENCE FIGURE</div>
        <div style={{ width: REF_SIZE, height: REF_SIZE, background: bgFill, border: `1px solid ${figureColor}44`, borderRadius: 2, overflow: 'hidden' }}>
          <RotationCanvas view={viewA} size={REF_SIZE} figureColor={figureColor} backgroundMode={backgroundMode} />
        </div>
      </div>

      <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* Answer options — centered row, same size as reference */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, fontFamily: FONT_MONO, letterSpacing: '0.07em' }}>SELECT THE MATCHING VIEW</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {options.map((opt, i) => {
            const isSelected  = selected === opt.key;
            const showResult  = revealed;
            const borderColor = showResult
              ? (opt.isCorrect ? C.success : isSelected ? C.error : 'rgba(255,255,255,0.08)')
              : isSelected ? figureColor : 'rgba(255,255,255,0.08)';
            return (
              <div key={opt.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div
                  onClick={() => !revealed && onSelect(opt.key, opt.isCorrect)}
                  style={{
                    width: OPT_SIZE, height: OPT_SIZE,
                    background: bgFill,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 2, overflow: 'hidden',
                    cursor: revealed ? 'default' : 'pointer',
                    boxShadow: isSelected ? `0 0 14px ${borderColor}66` : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <RotationCanvas view={opt.view} size={OPT_SIZE} figureColor={figureColor} backgroundMode={backgroundMode} />
                </div>
                <div style={{ fontSize: 11, fontFamily: FONT_MONO, color: showResult ? (opt.isCorrect ? C.success : isSelected ? C.error : C.muted) : C.muted }}>
                  {String.fromCharCode(65 + i)}
                  {showResult && opt.isCorrect && ' ✓'}
                  {showResult && isSelected && !opt.isCorrect && ' ✗'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NumberSeriesItem({ item, selected, onSelect, revealed }) {
  const opts = useMemo(() => shuffle(item.responseOptions || []), [item.id]);
  const meta = item.generatorMeta || {};
  const terms = meta.terms || [];
  const mi    = meta.missingIndex ?? -1;
  const isOpenResponse = item.responseFormat === 'open' || !opts.length;
  const expectedAnswer = meta.answer || item.answerDisplay || '';
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setInputValue(selected ? String(selected) : '');
  }, [item.id, selected]);

  // Shared series boxes display
  const seriesBoxes = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
      {terms.length > 0 ? terms.map((t, i) => {
        const isMissing = i === mi;
        return (
          <div key={i} style={{
            fontFamily: FONT_MONO, fontSize: 22, fontWeight: isMissing ? 800 : 500,
            minWidth: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isMissing ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isMissing ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 4, color: isMissing ? C.number : C.text, padding: '0 10px',
          }}>
            {isMissing ? '?' : t}
          </div>
        );
      }) : (
        // Fallback: plain stem text if no terms stored
        <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: C.text, padding: '12px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 2, border: `1px solid ${C.border}` }}>
          {item.stem?.replace('Complete the series: ', '') || item.stem}
        </div>
      )}
    </div>
  );

  if (isOpenResponse) {
    const submitOpenResponse = () => {
      if (revealed) return;
      const raw = inputValue.trim();
      if (!raw) return;
      const isCorrect = normalizeNumberSeriesResponse(raw) === normalizeNumberSeriesResponse(expectedAnswer);
      onSelect(raw, isCorrect);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>What number completes the series?</div>
        {seriesBoxes}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitOpenResponse(); }}
            disabled={revealed}
            placeholder="Type your answer"
            style={{ ...sty.input, width: 220, fontFamily: FONT_MONO, fontSize: 15, borderWidth: 2, borderColor: revealed ? (currentIsCorrect(selected, expectedAnswer) ? C.success : C.error) : C.borderHd }}
          />
          <button onClick={submitOpenResponse} disabled={revealed || !inputValue.trim()} style={{ ...sty.btnPrimary, opacity: revealed || !inputValue.trim() ? 0.55 : 1, cursor: revealed || !inputValue.trim() ? 'default' : 'pointer' }}>
            Check Answer
          </button>
        </div>
        {revealed && (
          <div style={{ marginTop: 10, fontSize: 12, color: currentIsCorrect(selected, expectedAnswer) ? C.success : C.dim }}>
            Correct answer: <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: currentIsCorrect(selected, expectedAnswer) ? C.success : C.number }}>{expectedAnswer}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>What number completes the series?</div>
      {seriesBoxes}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {opts.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrect  = opt === meta.answer;
          const showResult = revealed;
          return (
            <button key={i} onClick={() => !revealed && onSelect(opt, opt === meta.answer)} style={{
              fontFamily: FONT_MONO, fontSize: 16, padding: '10px 18px', borderRadius: 4, cursor: revealed ? 'default' : 'pointer', border: '2px solid',
              borderColor: showResult ? (isCorrect ? C.success : isSelected ? C.error : C.border) : isSelected ? C.number : C.border,
              background: showResult ? (isCorrect ? `${C.success}18` : isSelected ? `${C.error}18` : 'rgba(255,255,255,0.04)') : isSelected ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',
              color: showResult ? (isCorrect ? C.success : isSelected ? C.error : C.text) : isSelected ? C.number : C.text,
              fontWeight: isSelected ? 700 : 400, transition: 'all 0.15s',
            }}>
              {opt}{showResult && isCorrect && ' ✓'}{showResult && isSelected && !isCorrect && ' ✗'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatrixItem({ item, selected, onSelect, revealed }) {
  const meta   = item.generatorMeta || {};
  const theme  = meta.theme || 'light';
  // Prefer stored config (exact same matrix); fallback to rebuilding from templateId
  const config = useMemo(() => meta.config || (meta.templateId ? buildRuleTemplateConfig(meta.templateId) : null), [meta.templateId, meta.config]);

  if (!config) return <div style={{ color: C.muted }}>Matrix item data unavailable.</div>;

  const handleSelect = (optKey) => {
    if (revealed) return;
    onSelect(optKey, optKey === config.keyedOption);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 12, color: C.dim, alignSelf: 'flex-start' }}>Select the option that best completes the matrix.</div>
      <MatrixPreview config={config} selected={selected} onSelect={revealed ? undefined : handleSelect} cellSize={80} theme={theme} />
      {revealed && selected && (
        <div style={{ fontSize: 12, color: selected === config.keyedOption ? C.success : C.error, alignSelf: 'flex-start' }}>
          {selected === config.keyedOption ? '✓ Correct' : `✗ Incorrect — correct answer was ${config.keyedOption.replace('OPT', '#')}`}
        </div>
      )}
    </div>
  );
}

function VerbalItem({ item, selected, onSelect, revealed }) {
  const meta           = item.generatorMeta || {};
  const opts           = item.responseOptions || ['Must follow', 'Cannot follow'];
  const correctAnswer  = meta.conclusionIsValid ? 'Must follow' : 'Cannot follow';
  const stem           = item.stem || '';
  const conclusionMatch = stem.match(/Conclusion:\s*(.+)$/i);
  const premisesText   = conclusionMatch ? stem.slice(0, stem.indexOf('Conclusion:')).trim() : stem;
  const conclusionText = conclusionMatch ? conclusionMatch[1] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: C.dim }}>Read the premises and decide whether the conclusion follows.</div>
      {/* Premises box — purple tint matching ItemBank */}
      <div style={{ background: 'rgba(167,139,250,0.06)', border: `1px solid rgba(167,139,250,0.18)`, borderRadius: 2, padding: '10px 14px', fontSize: 13, color: C.text, lineHeight: 1.7 }}>
        {premisesText}
      </div>
      {/* Conclusion box */}
      {conclusionText && (
        <div style={{ background: 'rgba(167,139,250,0.03)', border: `1px solid rgba(167,139,250,0.12)`, borderRadius: 2, padding: '8px 14px' }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO, marginBottom: 4 }}>Conclusion</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.verbal }}>{conclusionText}</div>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Does the conclusion follow from the premises?</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {opts.map(opt => {
          const isSelected = selected === opt;
          const isCorrect  = opt === correctAnswer;
          const showResult = revealed;
          return (
            <button key={opt} onClick={() => !revealed && onSelect(opt, opt === correctAnswer)} style={{
              fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 2, cursor: revealed ? 'default' : 'pointer', border: '2px solid',
              borderColor: showResult ? (isCorrect ? C.success : isSelected ? C.error : C.border) : isSelected ? C.verbal : C.border,
              background: showResult ? (isCorrect ? `${C.success}18` : isSelected ? `${C.error}18` : 'rgba(255,255,255,0.04)') : isSelected ? `${C.verbal}18` : 'rgba(255,255,255,0.04)',
              color: C.text, transition: 'all 0.15s',
            }}>
              {opt}{showResult && isCorrect && ' ✓'}{showResult && isSelected && !isCorrect && ' ✗'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

function TestRunner({ test, bank, onExit }) {
  const allItems = useMemo(() => {
    const flat = [];
    test.subtests.forEach(sub => {
      sub.items.forEach(id => {
        const item = bank.find(b => b.id === id);
        if (item) flat.push({ ...item, subtestName: sub.name });
      });
    });
    return flat;
  }, [test, bank]);

  const [idx, setIdx]           = useState(0);
  const [answers, setAnswers]   = useState({});
  const [revealed, setRevealed] = useState(false);
  const [done, setDone]         = useState(false);

  const current  = allItems[idx];
  const total    = allItems.length;
  const progress = (idx / Math.max(total, 1)) * 100;

  const handleSelect = useCallback((selected, isCorrect) => {
    setAnswers(prev => ({ ...prev, [current.id]: { selected, isCorrect } }));
    setRevealed(true);
  }, [current]);

  const handleNext = () => {
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
    setRevealed(false);
  };

  const currentAnswer = answers[current?.id];

  if (done) {
    const correct = Object.values(answers).filter(a => a.isCorrect).length;
    const total2  = allItems.length;
    const pct     = Math.round((correct / Math.max(total2, 1)) * 100);

    const bySubtest = {};
    test.subtests.forEach(sub => {
      const subItems   = allItems.filter(it => it.subtestName === sub.name);
      const subCorrect = subItems.filter(it => answers[it.id]?.isCorrect).length;
      bySubtest[sub.name] = { correct: subCorrect, total: subItems.length, gen: sub.generatorType };
    });

    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: pct >= 70 ? C.success : pct >= 40 ? C.number : C.error, fontFamily: FONT_MONO }}>{pct}%</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{correct} / {total2} correct</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>{test.name}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {Object.entries(bySubtest).map(([name, data]) => {
            const subPct = Math.round((data.correct / Math.max(data.total, 1)) * 100);
            const accent = GEN_COLORS[data.gen] || C.muted;
            return (
              <div key={name} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 1, background: accent, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                <span style={{ fontSize: 12, color: C.dim }}>{data.correct}/{data.total}</span>
                <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${subPct}%`, height: '100%', background: accent, borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right', color: accent, fontFamily: FONT_MONO }}>{subPct}%</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button style={sty.btnPrimary} onClick={onExit}>← Back to Tests</button>
          <button style={sty.btn} onClick={() => { setIdx(0); setAnswers({}); setRevealed(false); setDone(false); }}>Retake</button>
        </div>
      </div>
    );
  }

  if (!current) return (
    <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
      No items in this test. Add items using the Test Builder.
      <br /><br />
      <button style={sty.btn} onClick={onExit}>← Back to Tests</button>
    </div>
  );

  const genColor = GEN_COLORS[current.generatedBy] || C.muted;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {test.settings.showProgressBar && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4, fontFamily: FONT_MONO }}>
            <span>{current.subtestName}</span>
            <span>Item {idx + 1} of {total}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: genColor, transition: 'width 0.3s', borderRadius: 2 }} />
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Badge color={genColor}>{GEN_LABELS[current.generatedBy] || current.generatedBy}</Badge>
          {current.difficulty && current.generatedBy !== 'verbal-reasoning' && <DifficultyBadge score={current.difficulty.score} />}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO }}>{idx + 1} / {total}</span>
        </div>

        {current.generatedBy === 'spatial-rotation'     && <SpatialItem item={current} selected={currentAnswer?.selected} onSelect={handleSelect} revealed={revealed} />}
        {current.generatedBy === 'number-series'        && <NumberSeriesItem item={current} selected={currentAnswer?.selected} onSelect={handleSelect} revealed={revealed} />}
        {current.generatedBy === 'progressive-matrices' && <MatrixItem item={current} selected={currentAnswer?.selected} onSelect={handleSelect} revealed={revealed} />}
        {current.generatedBy === 'verbal-reasoning'     && <VerbalItem item={current} selected={currentAnswer?.selected} onSelect={handleSelect} revealed={revealed} />}
      </div>

      {revealed && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: currentAnswer?.isCorrect ? C.success : C.error }}>
            {currentAnswer?.isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </div>
          <button style={sty.btnPrimary} onClick={handleNext}>
            {idx + 1 >= total ? 'View Results →' : 'Next Item →'}
          </button>
        </div>
      )}

      {!revealed && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={{ ...sty.btn, fontSize: 11 }} onClick={() => handleSelect(null, false)}>Skip</button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TakeTestPage() {
  const [tests, setTests]         = useState([]);
  const [bank, setBank]           = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const allTests = load(TEST_KEY, []);
    setTests(allTests.filter(t => t.saved === true));
    setBank(loadBank());
    return subscribe(() => setBank(loadBank()));
  }, []);

  // Re-sync tests from storage whenever we return to the list
  useEffect(() => {
    if (!activeTest) {
      const allTests = load(TEST_KEY, []);
      setTests(allTests.filter(t => t.saved === true));
    }
  }, [activeTest]);

  if (activeTest) {
    return (
      <div style={{ fontFamily: FONT_SANS, color: C.text, padding: '28px 36px 32px' }}>
        <div style={{ ...sty.header, marginBottom: 20 }}>
          <button style={sty.btn} onClick={() => setActiveTest(null)}>← Tests</button>
          <h2 style={sty.title}>{activeTest.name}</h2>
        </div>
        <TestRunner test={activeTest} bank={bank} onExit={() => setActiveTest(null)} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT_SANS, color: C.text, padding: '28px 36px 32px' }}>
      <div style={{ ...sty.header, marginBottom: 20 }}>
        <h2 style={sty.title}>Take Test</h2>
      </div>

      {tests.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          No saved tests available.{' '}
          <span
            onClick={() => navigate('/test-builder')}
            style={{ color: C.matrix, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Go to Test Builder
          </span>{' '}
          to create and save one.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {[['Name', 'auto'], ['Items', 60], ['Subtests', 80], ['Composition', 'auto'], ['Created', 100], ['', 130]].map(([label, w]) => (
                <th key={label} style={{
                  textAlign: 'left', padding: '7px 12px',
                  borderBottom: `1px solid ${C.border}`,
                  color: C.muted, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  fontFamily: FONT_MONO,
                  width: w === 'auto' ? undefined : w,
                }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tests.map(test => {
              const totalItems = test.subtests.reduce((n, s) => n + s.items.length, 0);
              const typeCounts = test.subtests
                .filter(s => s.items.length > 0)
                .map(s => ({ type: GEN_LABELS[s.generatorType], count: s.items.length, color: GEN_COLORS[s.generatorType] }));
              return (
                <tr key={test.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, fontFamily: FONT_MONO }}>{test.name}</span>
                    {test.description && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, fontSize: 12, color: C.dim }}>{totalItems}</td>
                  <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, fontSize: 12, color: C.dim }}>{test.subtests.length}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {typeCounts.length === 0
                        ? <span style={{ fontSize: 11, color: C.muted }}>—</span>
                        : typeCounts.map((tc, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: `${tc.color}12`, border: `1px solid ${tc.color}30`,
                              borderRadius: 2, padding: '1px 7px',
                              fontSize: 11, color: tc.color, fontWeight: 600,
                            }}>
                              <span style={{ fontFamily: FONT_MONO, fontWeight: 800 }}>{tc.count}</span> {tc.type}
                            </span>
                          ))
                      }
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, color: C.dim }}>{test.createdAt?.slice(0, 10)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{test.createdAt?.slice(11, 16)}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      style={{ ...sty.btnPrimary, fontSize: 11, padding: '5px 14px', opacity: totalItems === 0 ? 0.4 : 1, cursor: totalItems === 0 ? 'default' : 'pointer' }}
                      disabled={totalItems === 0}
                      onClick={() => setActiveTest(test)}
                    >▶ Take Test</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

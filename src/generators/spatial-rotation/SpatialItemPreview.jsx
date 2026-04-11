import React, { useRef, useEffect } from 'react';
import { getCoords } from './shapes';
import { makeConfig, offscreenRender, autoCenterCanvas } from './renderer';

const FONT_MONO = "'JetBrains Mono', 'Fira Mono', 'Cascadia Code', monospace";
const FONT_SANS = "'Inter', 'Segoe UI', system-ui, sans-serif";

function useCanvasRender(canvasRef, view, figureColor, backgroundFill) {
  useEffect(() => {
    if (!view) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCoords(view.shape, view.config);
    if (!coords?.length) return;
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
  }, [
    view?.shape, view?.config,
    view?.roll, view?.elev, view?.azim,
    view?.tX, view?.tY, view?.tZ,
    view?.mirror,
    figureColor, backgroundFill,
  ]);
}

function FigureCanvas({ view, figureColor, bgFill, size, label, labelColor, borderColor }) {
  const ref = useRef(null);
  useCanvasRender(ref, view, figureColor, bgFill);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: size, height: size,
        background: bgFill,
        border: `1px solid ${borderColor || 'rgba(255,255,255,0.08)'}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <canvas ref={ref} width={size} height={size} style={{ display: 'block' }} />
      </div>
      {label && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: labelColor || 'rgba(255,255,255,0.38)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          fontFamily: FONT_MONO,
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Reusable spatial rotation item preview.
 * Works with any item that has generatorMeta.viewA/viewB/figureColor/backgroundMode/distractorViews.
 *
 * Props:
 *   item           — full bank/generator item object
 *   refSize        — px size of the reference figure canvas (default 200)
 *   optionSize     — px size of each answer option canvas (default 130)
 *   accentOverride — optional color override for section headers
 */
export function SpatialItemPreview({ item, refSize = 200, optionSize = 130, accentOverride }) {
  const meta = item?.generatorMeta || {};
  const {
    viewA,
    viewB,
    figureColor  = '#34c759',
    backgroundMode = 'dark',
    distractorViews = [],
  } = meta;

  const accent = accentOverride || figureColor;
  const bgFill = backgroundMode === 'light' ? '#ffffff' : '#040816';

  if (!viewA) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: FONT_SANS, fontStyle: 'italic' }}>
        Visual preview not available — item predates config storage.
      </div>
    );
  }

  const SectionLabel = ({ children }) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color: accent,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      fontFamily: FONT_MONO, marginBottom: 10,
    }}>{children}</div>
  );

  const answerEntries = [
    { view: viewB, label: 'Correct Answer', isCorrect: true },
    ...distractorViews.map((v, i) => ({
      view: v,
      label: `Distractor ${String.fromCharCode(65 + i)}`,
      isCorrect: false,
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT_SANS }}>

      {/* Reference figure */}
      <div>
        <SectionLabel>Reference Figure</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FigureCanvas
            view={viewA}
            figureColor={figureColor}
            bgFill={bgFill}
            size={refSize}
            label="Reference"
            labelColor="rgba(255,255,255,0.45)"
            borderColor={`${accent}30`}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* Answer options */}
      <div>
        <SectionLabel>Answer Options</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap', justifyContent: 'center' }}>
          {answerEntries.map(({ view, label, isCorrect }) => (
            <FigureCanvas
              key={label}
              view={view}
              figureColor={figureColor}
              bgFill={bgFill}
              size={optionSize}
              label={label}
              labelColor={isCorrect ? accent : 'rgba(255,255,255,0.3)'}
              borderColor={isCorrect ? `${accent}40` : 'rgba(255,255,255,0.07)'}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

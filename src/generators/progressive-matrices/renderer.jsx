/**
 * Progressive Matrices — SVG Renderer
 *
 * Renders individual shape elements as SVG strings and composes them
 * into matrix grid cells. Provides the MatrixPreview React component.
 */

import React from 'react';
import { colors, card } from '../../theme';

// --- Geometry helpers ---

/**
 * Regular polygon vertices centered at (cx, cy) with radius r and n sides.
 */
export function polyPoints(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

/**
 * Star vertices: alternating outer and inner radius points.
 */
export function starPoints(cx, cy, outerR, innerR, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

function ptsToString(pts) {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

// --- Single element SVG ---

/**
 * Render a single layer/element as an SVG string.
 * @param {object} layer - { shape, fill, stroke, strokeW, size, rotation, moveX, moveY, count? }
 * @param {number} svgSize - viewport size of the SVG (default 86)
 * @returns {string} SVG markup for this element
 */
export function elementSVG(layer, svgSize = 86, strokeOverride) {
  const cx = svgSize / 2 + (layer.moveX || 0);
  const cy = svgSize / 2 + (layer.moveY || 0);
  const r = (layer.size || 24) / 2;
  const fill = layer.fill || '#38bdf8';
  const stroke = strokeOverride !== undefined ? strokeOverride : (layer.stroke || '#ffffff');
  const sw = layer.strokeW != null ? layer.strokeW : 1;
  const rot = layer.rotation || 0;

  const transform = rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : '';

  switch (layer.shape) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;

    case 'square': {
      const pts = polyPoints(cx, cy, r, 4);
      // rotate 45 so it looks like a square (flat top)
      const angle45 = Math.PI / 4;
      const rotated = pts.map(([px, py]) => {
        const dx = px - cx, dy = py - cy;
        return [
          cx + dx * Math.cos(angle45) - dy * Math.sin(angle45),
          cy + dx * Math.sin(angle45) + dy * Math.cos(angle45),
        ];
      });
      return `<polygon points="${ptsToString(rotated)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
    }

    case 'triangle': {
      const pts = polyPoints(cx, cy, r, 3);
      return `<polygon points="${ptsToString(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
    }

    case 'polygon': {
      const n = Math.max(3, Math.min(12, layer.sides || 6));
      const pts = polyPoints(cx, cy, r, n);
      return `<polygon points="${ptsToString(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
    }

    case 'cross': {
      // 12-point cross shape
      const a = r * 0.35;
      const pts = [
        [cx - a, cy - r], [cx + a, cy - r],
        [cx + a, cy - a], [cx + r, cy - a],
        [cx + r, cy + a], [cx + a, cy + a],
        [cx + a, cy + r], [cx - a, cy + r],
        [cx - a, cy + a], [cx - r, cy + a],
        [cx - r, cy - a], [cx - a, cy - a],
      ];
      return `<polygon points="${ptsToString(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
    }

    case 'star': {
      const nPts = layer.starPoints || 5;
      const innerR = r * 0.46;
      const pts = starPoints(cx, cy, r, innerR, nPts);
      return `<polygon points="${ptsToString(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
    }

    default:
      // fallback: circle
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${transform}/>`;
  }
}

// --- Multi-layer cell SVG ---

/**
 * Compose multiple layers into a single SVG cell.
 * Layers are sorted by optional zIndex (lower first).
 */
export function cellSVG(layers, size = 86, strokeOverride) {
  if (!layers || layers.length === 0) return '';
  const sorted = [...layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const inner = sorted.map(l => elementSVG(l, size, strokeOverride)).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${inner}\n</svg>`;
}

// --- React: cell renderer as dangerouslySetInnerHTML ---

function CellDisplay({ layers, size = 86, style, strokeOverride }) {
  const svg = cellSVG(layers, size, strokeOverride);
  return (
    <div
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// --- MatrixPreview component ---

const COLS = ['A', 'B', 'C'];
const ROWS = ['X', 'Y', 'Z'];

// Built-in themes
const THEMES = {
  dark: {
    cellBg:          colors.surface,
    missingBg:       colors.surfaceLight,
    missingColor:    colors.textMuted,
    cellBorder:      colors.border,
    labelColor:      colors.textDim,
    optLabelColor:   colors.textDim,
    optSelColor:     colors.matrix,
    optSelBorder:    colors.matrix,
    optSelShadow:    colors.matrixDim,
  },
  light: {
    cellBg:          '#f1f5f9',
    missingBg:       '#e2e8f0',
    missingColor:    '#94a3b8',
    cellBorder:      '#cbd5e1',
    labelColor:      '#64748b',
    optLabelColor:   '#94a3b8',
    optSelColor:     colors.matrix,
    optSelBorder:    colors.matrix,
    optSelShadow:    colors.matrixDim,
    strokeOverride:  '#475569',
  },
};

/**
 * MatrixPreview — interactive 3x3 grid with options row.
 *
 * Props:
 *   config     — { cells, options, missingCell, keyedOption }
 *   selected   — currently selected option key (e.g. 'OPT1')
 *   onSelect   — callback(optionKey)
 *   cellSize   — px per cell (default 86)
 *   theme      — 'dark' | 'light' (default 'dark')
 */
export function MatrixPreview({ config, selected, onSelect, cellSize = 86, theme = 'dark', strokeOverride: strokeOverrideProp }) {
  if (!config) return null;

  const T = THEMES[theme] || THEMES.dark;
  // Explicit strokeOverride prop takes precedence over the theme's override
  const activeStrokeOverride = strokeOverrideProp !== undefined ? strokeOverrideProp : T.strokeOverride;
  const { cells, options, missingCell } = config;
  const optionKeys = Object.keys(options || {}).sort();

  const cellBase = {
    width: cellSize, height: cellSize,
    background: T.cellBg,
    border: `1px solid ${T.cellBorder}`,
    borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  };

  const missingStyle = {
    ...cellBase,
    background: T.missingBg,
    fontSize: 28, fontWeight: 700,
    color: T.missingColor,
  };

  const labelSty = {
    fontSize: 11, fontWeight: 600,
    color: T.labelColor,
    textAlign: 'center',
  };

  const optStyle = (isSel, isCorrectReveal) => ({
    ...cellBase,
    cursor: 'pointer',
    border: isCorrectReveal
      ? `2px solid ${colors.success}`
      : isSel
        ? `2px solid ${T.optSelBorder}`
        : `1px solid ${T.cellBorder}`,
    boxShadow: isCorrectReveal
      ? '0 0 10px rgba(74,222,128,0.28)'
      : isSel
        ? `0 0 8px ${T.optSelShadow}`
        : 'none',
    transition: 'border 0.15s, box-shadow 0.15s',
  });

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'flex', gap: 4, marginLeft: 24, marginBottom: 2 }}>
        {COLS.map(c => (
          <div key={c} style={{ ...labelSty, width: cellSize }}>{c}</div>
        ))}
      </div>

      {/* Grid rows */}
      {ROWS.map(row => (
        <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <div style={{ ...labelSty, width: 20 }}>{row}</div>
          {COLS.map(col => {
            const key = `${col}${row}`;
            if (key === missingCell) {
              return (
                <div key={key} style={missingStyle}>?</div>
              );
            }
            const cell = cells[key];
            return (
              <div key={key} style={cellBase}>
                {cell && <CellDisplay layers={cell.layers} size={cellSize} strokeOverride={activeStrokeOverride} />}
              </div>
            );
          })}
        </div>
      ))}

      {/* Options row */}
      {optionKeys.length > 0 && (() => {
        // Align option #3 (index 2) center under column B (index 1) center
        const gap = 4;
        const rowLabelW = 24; // 20px label + 4px gap
        const colBCenter = rowLabelW + cellSize + gap + cellSize / 2;
        const opt3Center = 2 * (cellSize + gap) + cellSize / 2;
        const optionsOffset = colBCenter - opt3Center;
        return (
        <div style={{ marginTop: 6, marginLeft: optionsOffset }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.labelColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Options
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {optionKeys.map(oKey => {
              const opt = options[oKey];
              const isSel = selected === oKey;
              const isCorrectReveal = Boolean(selected) && oKey === config.keyedOption;
              return (
                <div key={oKey} style={{ textAlign: 'center' }}>
                  <div style={optStyle(isSel, isCorrectReveal)} onClick={() => onSelect && onSelect(oKey)} title={oKey}>
                    {opt && <CellDisplay layers={opt.layers} size={cellSize} strokeOverride={activeStrokeOverride} />}
                  </div>
                  <div style={{ fontSize: 10, color: isSel ? T.optSelColor : T.optLabelColor, marginTop: 4, lineHeight: 1.2 }}>
                    {oKey.replace('OPT', '#')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default MatrixPreview;

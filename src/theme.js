export const colors = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceLight: '#273548',
  border: '#334155',
  borderLight: '#475569',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  white: '#ffffff',
  black: '#000000',

  // generator accents
  spatial: '#34c759',
  spatialDim: 'rgba(52,199,89,0.15)',
  number: '#fbbf24',
  numberDim: 'rgba(251,191,36,0.15)',
  matrix: '#38bdf8',
  matrixDim: 'rgba(56,189,248,0.15)',
  verbal: '#a78bfa',
  verbalDim: 'rgba(167,139,250,0.15)',

  // difficulty
  diff1: '#34d399',
  diff2: '#86efac',
  diff3: '#fbbf24',
  diff4: '#f97316',
  diff5: '#ef4444',

  // status
  success: '#34d399',
  warning: '#fbbf24',
  error: '#ef4444',
  info: '#38bdf8',
};

export const difficultyColors = ['', colors.diff1, colors.diff2, colors.diff3, colors.diff4, colors.diff5];
export const difficultyLabels = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

export const fonts = {
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
};

export const card = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: 16,
};

export const pill = (color, bg) => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 99,
  fontSize: 12,
  fontWeight: 600,
  color,
  background: bg || `${color}22`,
});

// Progressive Matrices — Additive difficulty scoring (0-100)

const TEMPLATE_BASE = { easy: 20, medium: 38, hard: 58, 'very-hard': 78 };
const FAMILY_BONUS = { rotation: 8, size: 6, count: 12, alternation: 16, 'dual-rule': 24 };

export function estimateMatrixDifficulty(config) {
  const td = config.templateDifficulty || 'easy';
  const family = config.family || 'rotation';
  let score = (TEMPLATE_BASE[td] || 20) + (FAMILY_BONUS[family] || 0);

  const drivers = [
    { label: `Template base (${td})`, value: TEMPLATE_BASE[td] || 20 },
    { label: `Family bonus (${family})`, value: FAMILY_BONUS[family] || 0 },
  ];

  // Options populated = +3
  const optKeys = Object.keys(config.options || {});
  if (optKeys.length > 1) {
    score += 3;
    drivers.push({ label: 'Options populated', value: 3 });
  }

  score = Math.max(5, Math.min(95, score));

  let tier;
  if (score >= 72) tier = 'Very Hard';
  else if (score >= 52) tier = 'Hard';
  else if (score >= 30) tier = 'Medium';
  else tier = 'Easy';

  return { score, tier, drivers };
}

export function normalizeTo5(score100) {
  if (score100 < 30) return 1;
  if (score100 < 45) return 2;
  if (score100 < 60) return 3;
  if (score100 < 75) return 4;
  return 5;
}

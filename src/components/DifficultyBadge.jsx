import { difficultyColors, difficultyLabels, pill } from '../theme';

export default function DifficultyBadge({ score }) {
  if (!score || score < 1 || score > 5) return null;
  const color = difficultyColors[score];
  return <span style={pill(color)}>{difficultyLabels[score]} ({score})</span>;
}

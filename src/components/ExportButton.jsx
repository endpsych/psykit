import { colors } from '../theme';

const style = {
  padding: '6px 14px',
  background: 'transparent',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  color: colors.textMuted,
  cursor: 'pointer',
  fontSize: 13,
};

export default function ExportButton({ onClick, children }) {
  return (
    <button style={style} onClick={onClick}
      onMouseEnter={e => { e.target.style.borderColor = colors.text; e.target.style.color = colors.text; }}
      onMouseLeave={e => { e.target.style.borderColor = colors.border; e.target.style.color = colors.textMuted; }}
    >
      {children || 'Export JSON'}
    </button>
  );
}

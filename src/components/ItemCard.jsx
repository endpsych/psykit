import { colors, card as cardStyle, fonts } from '../theme';
import DifficultyBadge from './DifficultyBadge';

export default function ItemCard({ item, actions, expanded, onToggle }) {
  return (
    <div style={{ ...cardStyle, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: onToggle ? 'pointer' : 'default' }} onClick={onToggle}>
        <span style={{ fontSize: 12, color: colors.textDim, fontFamily: fonts.mono, minWidth: 100 }}>{item.id}</span>
        <span style={{ flex: 1, fontSize: 13, color: colors.text }}>{item.name || item.stem?.slice(0, 80)}</span>
        {item.difficulty && item.generatedBy !== 'verbal-reasoning' && <DifficultyBadge score={item.difficulty.score} />}
        <span style={{ fontSize: 11, color: colors.textDim }}>{item.generatedBy}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>{item.stem}</div>
          {item.responseOptions?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {item.responseOptions.map((o, i) => (
                <span key={i} style={{ fontSize: 12, padding: '2px 8px', background: colors.surfaceLight, borderRadius: 4, color: colors.text }}>
                  {typeof o === 'string' ? o : o.text || o.label || JSON.stringify(o)}
                </span>
              ))}
            </div>
          )}
          {item.notes && <div style={{ fontSize: 12, color: colors.textDim, marginTop: 8 }}>{item.notes}</div>}
          {actions && <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
    </div>
  );
}

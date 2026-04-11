import React, { useState, useEffect } from 'react';
import { colors, fonts } from '../theme';
import { loadBank, saveBank, exportBank, removeManyFromBank, subscribe } from '../store/bankStore';
import { uploadJSON } from '../store/localStorage';
import { ItemPreviewModal, GEN_COLORS } from '../components/ItemPreviewModal';

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

const cardStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: 14 };

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

const sty = {
  header:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  title:     { fontSize: 18, fontWeight: 800, flex: 1, fontFamily: FONT_MONO },
  btn:       { display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS },
  btnDanger: { display: 'inline-flex', alignItems: 'center', background: 'transparent', color: C.error, border: `1px solid ${C.error}44`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS },
  filters:   { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  sel:       { background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '5px 10px', fontSize: 12, fontFamily: FONT_SANS },
  input:     { background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '5px 10px', fontSize: 12, fontFamily: FONT_SANS, width: 200 },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO },
  td:        { padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)` },
  row:       (sel) => ({ background: sel ? `${C.matrix}12` : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }),
  empty:     { ...cardStyle, textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 },
};

function formatCreatedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ItemBankPage() {
  const [items, setItems]         = useState([]);
  const [genFilter, setGenFilter] = useState('all');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(new Set());
  const [previewItem, setPreviewItem] = useState(null);
  const [sortCol, setSortCol]     = useState('createdAt');
  const [sortDir, setSortDir]     = useState('desc');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = () => setItems(loadBank());
  useEffect(() => { reload(); return subscribe(reload); }, []);

  const filtered = items.filter(it => {
    if (genFilter !== 'all' && it.generatedBy !== genFilter) return false;
    if (search && !it.stem?.toLowerCase().includes(search.toLowerCase()) && !it.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).slice().sort((a, b) => {
    const av = (a[sortCol] ?? '').toString().toLowerCase();
    const bv = (b[sortCol] ?? '').toString().toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    setConfirmDelete(true);
  };

  const confirmDeleteExecute = () => {
    if (previewItem && selected.has(previewItem.id)) setPreviewItem(null);
    removeManyFromBank([...selected]);
    setSelected(new Set());
    setConfirmDelete(false);
    reload();
  };

  const importItems = async () => {
    try {
      const data = await uploadJSON();
      if (Array.isArray(data)) {
        const bank = loadBank();
        bank.push(...data);
        saveBank(bank);
        reload();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ fontFamily: FONT_SANS, color: C.text, padding: '28px 36px 32px' }}>
      <div style={sty.header}>
        <h2 style={sty.title}>Item Bank</h2>
        <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT_MONO }}>{items.length} items total</span>
        <button style={sty.btn} onClick={importItems}>Import JSON</button>
        <button style={sty.btn} onClick={exportBank}>Export JSON</button>
        {selected.size > 0 && (
          <button style={sty.btnDanger} onClick={deleteSelected}>Delete {selected.size}</button>
        )}
      </div>

      <div style={sty.filters}>
        <select value={genFilter} onChange={e => setGenFilter(e.target.value)} style={sty.sel}>
          <option value="all">All Generators</option>
          <option value="spatial-rotation">Spatial Rotation</option>
          <option value="number-series">Number Series</option>
          <option value="progressive-matrices">Progressive Matrices</option>
          <option value="verbal-reasoning">Verbal Reasoning</option>
        </select>
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={sty.input} />
      </div>

      {filtered.length === 0 ? (
        <div style={sty.empty}>
          {items.length === 0
            ? 'Item bank is empty. Generate items from any generator and add them here.'
            : 'No items match the current filters.'}
        </div>
      ) : (
        <table style={sty.table}>
          <thead>
            <tr>
              <th style={{ ...sty.th, width: 32 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(it => selected.has(it.id))}
                  ref={el => { if (el) el.indeterminate = filtered.some(it => selected.has(it.id)) && !filtered.every(it => selected.has(it.id)); }}
                  onChange={() => {
                    const allSelected = filtered.every(it => selected.has(it.id));
                    setSelected(prev => {
                      const next = new Set(prev);
                      filtered.forEach(it => allSelected ? next.delete(it.id) : next.add(it.id));
                      return next;
                    });
                  }}
                  style={{ accentColor: C.matrix }}
                />
              </th>
              {[['id','ID'],['name','Name'],['generatedBy','Generator'],['createdAt','Created']].map(([col, label]) => (
                <th key={col} style={{ ...sty.th, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(col)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {label}
                    <span style={{ fontSize: 9, color: sortCol === col ? C.text : C.muted, opacity: sortCol === col ? 1 : 0.4 }}>
                      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
              ))}
              <th style={{ ...sty.th, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} style={sty.row(selected.has(item.id))}>
                <td style={sty.td}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    style={{ accentColor: C.matrix }}
                  />
                </td>
                <td style={{ ...sty.td, fontFamily: FONT_MONO, fontSize: 10, color: C.muted }}>{item.id}</td>
                <td style={{ ...sty.td, fontSize: 12 }}>{item.name}</td>
                <td style={sty.td}>
                  <Badge color={GEN_COLORS[item.generatedBy] || C.dim}>{item.generatedBy}</Badge>
                </td>
                <td style={{ ...sty.td, fontSize: 10, color: C.muted, fontFamily: FONT_MONO }}>{formatCreatedAt(item.createdAt)}</td>
                <td style={{ ...sty.td, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid rgba(255,255,255,0.1)`,
                      borderRadius: 2, padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, color: C.dim,
                      cursor: 'pointer', fontFamily: FONT_SANS,
                      transition: 'border-color 0.12s, color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = C.text; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = C.dim; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <ellipse cx="6" cy="6" rx="5.2" ry="3.6" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
                    </svg>
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(() => {
        const idx = previewItem ? filtered.findIndex(it => it.id === previewItem.id) : -1;
        return (
          <ItemPreviewModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            hasPrev={idx > 0}
            hasNext={idx >= 0 && idx < filtered.length - 1}
            onPrev={() => idx > 0 && setPreviewItem(filtered[idx - 1])}
            onNext={() => idx >= 0 && idx < filtered.length - 1 && setPreviewItem(filtered[idx + 1])}
            index={idx}
            total={filtered.length}
          />
        );
      })()}

      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setConfirmDelete(false)}>
          <div style={{
            background: '#0d1524', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '24px 28px', minWidth: 320, maxWidth: 420,
            display: 'flex', flexDirection: 'column', gap: 16,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Delete {selected.size} item{selected.size !== 1 ? 's' : ''}?</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              This action cannot be undone. The selected item{selected.size !== 1 ? 's' : ''} will be permanently removed from the bank.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={sty.btn} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button style={sty.btnDanger} onClick={confirmDeleteExecute}>Delete {selected.size}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

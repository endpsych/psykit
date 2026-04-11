import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '../theme';
import { load, save, downloadJSON, uploadJSON } from '../store/localStorage';
import { loadBank, subscribe } from '../store/bankStore';
import { ItemPreviewModal } from '../components/ItemPreviewModal';

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

const TEST_KEY  = 'tests';
const GEN_TYPES = ['spatial-rotation', 'number-series', 'progressive-matrices', 'verbal-reasoning'];
const GEN_LABELS = { 'spatial-rotation': 'Spatial Reasoning', 'number-series': 'Numerical Reasoning', 'progressive-matrices': 'Abstract Reasoning', 'verbal-reasoning': 'Verbal Reasoning' };
const GEN_COLORS = { 'spatial-rotation': C.spatial, 'number-series': C.number, 'progressive-matrices': C.matrix, 'verbal-reasoning': C.verbal };

function uid() { return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function genCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function newTest() {
  return {
    id: uid(), name: 'New Test', description: '',
    code: genCode(),
    subtests: [],
    settings: { showProgressBar: true },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    saved: false,
  };
}

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

// ─── Shared styles ───────────────────────────────────────────────────────────

const sty = {
  header:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  title:      { fontSize: 18, fontWeight: 800, flex: 1, fontFamily: FONT_MONO },
  btn:        { display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', background: `rgba(56,189,248,0.08)`, color: C.matrix, border: `1px solid rgba(56,189,248,0.28)`, borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT_SANS },
  input:      { background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '6px 10px', fontSize: 13, fontFamily: FONT_SANS, width: '100%' },
  textarea:   { background: 'rgba(255,255,255,0.04)', color: C.text, border: `1px solid ${C.borderHd}`, borderRadius: 2, padding: '8px 10px', fontSize: 13, fontFamily: FONT_SANS, width: '100%', minHeight: 60, resize: 'vertical' },
  subtest:    (accent) => ({ ...cardStyle, borderLeft: `2px solid ${accent}`, marginBottom: 10 }),
  row:        { display: 'flex', alignItems: 'center', gap: 8 },
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBody:  { background: C.bgDeep, borderRadius: 2, border: `1px solid ${C.borderHd}`, padding: 24, width: 600, maxHeight: '80vh', overflowY: 'auto' },
  itemRow:    (sel) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 2, background: sel ? `${C.matrix}12` : 'transparent', cursor: 'pointer', marginBottom: 2 }),
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestBuilderPage() {
  const [tests, setTests]   = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [bank, setBank]     = useState([]);
  const [modal, setModal]   = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [subtestModalOpen, setSubtestModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [importError, setImportError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = load(TEST_KEY, []);
    setTests(stored);
    if (stored.length > 0) {
      setActiveId(stored[0].id);
    }
    setBank(loadBank());
    return subscribe(() => setBank(loadBank()));
  }, []);

  const persist    = (updated) => { setTests(updated); save(TEST_KEY, updated); };
  const test       = tests.find(t => t.id === activeId);
  const updateTest = (fn) => {
    persist(tests.map(t => t.id === activeId ? { ...fn(t), updatedAt: new Date().toISOString() } : t));
  };

  const addSubtest = (generatorType) => {
    const label = GEN_LABELS[generatorType];
    updateTest(t => ({
      ...t,
      subtests: [...t.subtests, { id: uid(), name: label, generatorType, items: [] }],
    }));
    setSubtestModalOpen(false);
  };
  const removeSubtest = (sid) => updateTest(t => ({ ...t, subtests: t.subtests.filter(s => s.id !== sid) }));
  const updateSubtest = (sid, k, v) => updateTest(t => ({ ...t, subtests: t.subtests.map(s => s.id === sid ? { ...s, [k]: v } : s) }));

  const toggleItem = (subtestId, itemId) => updateTest(t => ({
    ...t, subtests: t.subtests.map(s => {
      if (s.id !== subtestId) return s;
      const has = s.items.includes(itemId);
      return { ...s, items: has ? s.items.filter(i => i !== itemId) : [...s.items, itemId] };
    }),
  }));

  const removeItem = (sid, iid) => updateTest(t => ({ ...t, subtests: t.subtests.map(s => s.id !== sid ? s : { ...s, items: s.items.filter(i => i !== iid) }) }));

  // Move item up/down within a subtest
  const moveItem = (subtestId, itemId, direction) => {
    updateTest(t => ({
      ...t,
      subtests: t.subtests.map(s => {
        if (s.id !== subtestId) return s;
        const items = [...s.items];
        const idx = items.indexOf(itemId);
        if (idx === -1) return s;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= items.length) return s;
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        return { ...s, items };
      }),
    }));
  };

  // Move subtest up/down in the test
  const moveSubtest = (subtestId, direction) => {
    updateTest(t => {
      const subtests = [...t.subtests];
      const idx = subtests.findIndex(s => s.id === subtestId);
      if (idx === -1) return t;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= subtests.length) return t;
      [subtests[idx], subtests[newIdx]] = [subtests[newIdx], subtests[idx]];
      return { ...t, subtests };
    });
  };

  const totalItems = test ? test.subtests.reduce((n, s) => n + s.items.length, 0) : 0;

  const handleCreateNewTest = () => {
    const t = newTest();
    persist([...tests, t]);
    setActiveId(t.id);
    setIsCreating(true);
  };

  const handleSaveTest = () => {
    if (!test) return;
    updateTest(t => ({ ...t, saved: true }));
    setSaveModalOpen(false);
    setIsCreating(false);
  };

  const openDeleteModal = (testId) => {
    setTestToDelete(testId);
    setDeleteModalOpen(true);
  };

  const handleDeleteTest = () => {
    if (!testToDelete) return;
    const updatedTests = tests.filter(t => t.id !== testToDelete);
    persist(updatedTests);
    if (activeId === testToDelete) {
      setActiveId(updatedTests.length > 0 ? updatedTests[0].id : null);
    }
    setDeleteModalOpen(false);
    setTestToDelete(null);
  };

  const handleImportTest = async () => {
    setImportError(null);
    try {
      const data = await uploadJSON();
      // Validate — must be a single test object with name + subtests
      if (Array.isArray(data) || typeof data !== 'object' || !data.name || !Array.isArray(data.subtests)) {
        setImportError('Invalid test file. The file must be a test exported from PsychKit.');
        return;
      }
      // Assign a fresh id if there's already a test with the same id, otherwise keep original
      const idConflict = tests.some(t => t.id === data.id);
      const imported = {
        ...data,
        id:        idConflict ? uid() : (data.id || uid()),
        code:      data.code || genCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        saved:     true,
      };
      persist([...tests, imported]);
    } catch (e) {
      if (e.message !== 'No file selected') setImportError('Could not read file. Make sure it is a valid JSON export.');
    }
  };

  const getItemCountsByType = () => {
    if (!test) return [];
    return test.subtests
      .filter(s => s.items.length > 0)
      .map(s => ({
        type: GEN_LABELS[s.generatorType] || s.generatorType,
        count: s.items.length,
        color: GEN_COLORS[s.generatorType] || C.muted,
      }));
  };

  return (
    <div style={{ fontFamily: FONT_SANS, color: C.text, padding: '28px 36px 0', display: 'flex', flexDirection: 'column', ...(isCreating ? { height: '100vh', overflow: 'hidden' } : { minHeight: '100vh', paddingBottom: 32 }) }}>
      {/* Header */}
      <div style={{ ...sty.header, marginBottom: 20 }}>
        <h2 style={sty.title}>Test Builder</h2>
      </div>

      {/* Build New Test + Import buttons — shown above list when not in editing mode */}
      {!isCreating && (
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{
                ...sty.btn,
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.35)',
                fontWeight: 700,
              }}
              onClick={handleCreateNewTest}
            >
              + Build New Test
            </button>
            <button
              style={{ ...sty.btn }}
              onClick={handleImportTest}
            >
              ↑ Import Test
            </button>
          </div>
          {importError && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: `${C.error}12`, border: `1px solid ${C.error}33`,
              borderRadius: 2, padding: '6px 12px',
              fontSize: 12, color: C.error, fontFamily: FONT_SANS,
            }}>
              <span style={{ fontWeight: 700 }}>Import failed:</span> {importError}
              <button
                onClick={() => setImportError(null)}
                style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', padding: '0 0 0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isCreating && tests.filter(t => t.saved).length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 48, color: C.muted, fontSize: 13 }}>
          No saved tests yet. Click <strong style={{ color: '#22c55e' }}>+ Build New Test</strong> to get started.
        </div>
      )}

      {/* Saved Tests List */}
      {!isCreating && tests.filter(t => t.saved).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO, marginBottom: 10 }}>
            Saved Tests ({tests.filter(t => t.saved).length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[['Name', 'auto'], ['Items', 60], ['Subtests', 80], ['Composition', 'auto'], ['Created', 100], ['', 176]].map(([label, w]) => (
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
              {tests.filter(t => t.saved).map(t => {
                const itemCount  = t.subtests.reduce((n, s) => n + s.items.length, 0);
                const typeCounts = t.subtests
                  .filter(s => s.items.length > 0)
                  .map(s => ({ type: GEN_LABELS[s.generatorType], count: s.items.length, color: GEN_COLORS[s.generatorType] }));
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, fontFamily: FONT_MONO }}>{t.name}</span>
                      {t.description && (
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, fontSize: 12, color: C.dim }}>{itemCount}</td>
                    <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, fontSize: 12, color: C.dim }}>{t.subtests.length}</td>
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
                      <div style={{ fontSize: 11, color: C.dim }}>{t.createdAt?.slice(0, 10)}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{t.createdAt?.slice(11, 16)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          style={{ ...sty.btn, fontSize: 11, padding: '4px 10px' }}
                          onClick={() => { setActiveId(t.id); setIsCreating(true); }}
                        >Edit</button>
                        <button
                          style={{ ...sty.btn, fontSize: 11, padding: '4px 10px' }}
                          onClick={() => downloadJSON(t, `test-${t.name.replace(/\s+/g, '-').toLowerCase()}-${t.id}.json`)}
                        >Export</button>
                        <button
                          style={{ ...sty.btn, fontSize: 11, padding: '4px 10px', color: C.error, borderColor: `${C.error}44` }}
                          onClick={() => openDeleteModal(t.id)}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Build UI */}
      {test && isCreating && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: 16 }}>
          {/* Section title */}
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, fontFamily: FONT_MONO, color: C.dim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            New Test Build
          </h3>

          {/* Top row: fields left, summary right */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'flex-start' }}>

            {/* Left: name + description stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 380px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Test Name</label>
                    <input value={test.name} onChange={e => updateTest(t => ({ ...t, name: e.target.value }))} style={{ ...sty.input, fontSize: 14, fontWeight: 700, fontFamily: FONT_MONO }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '0 0 90px' }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Test ID</label>
                    <input
                      value={test.code || ''}
                      onChange={e => updateTest(t => ({ ...t, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
                      maxLength={6}
                      style={{ ...sty.input, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'center' }}
                      placeholder="------"
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Description</label>
                <textarea value={test.description} onChange={e => updateTest(t => ({ ...t, description: e.target.value }))} placeholder="Optional description..." style={{ ...sty.textarea, minHeight: 60, resize: 'vertical' }} />
              </div>
            </div>

            {/* Right: live summary table */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO, marginBottom: 8 }}>Test Summary</div>
              {test.subtests.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, padding: '10px 0', fontStyle: 'italic' }}>No subtests added yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {[['Subtest', 'auto'], ['Type', 210], ['Items', 60]].map(([label, w]) => (
                        <th key={label} style={{
                          textAlign: 'left', padding: '5px 10px',
                          borderBottom: `1px solid ${C.border}`,
                          color: C.muted, fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO,
                          width: w === 'auto' ? undefined : w,
                        }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {test.subtests.map(sub => {
                      const accent = GEN_COLORS[sub.generatorType] || C.muted;
                      return (
                        <tr key={sub.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                          <td style={{ padding: '6px 10px', fontSize: 12, color: C.text }}>{sub.name}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center',
                              background: `${accent}12`, border: `1px solid ${accent}30`,
                              borderRadius: 2, padding: '1px 7px',
                              fontSize: 10, color: accent, fontWeight: 700,
                              fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>{sub.generatorType}</span>
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: FONT_MONO, fontWeight: 700, color: sub.items.length > 0 ? C.text : C.muted }}>
                            {sub.items.length}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr>
                      <td colSpan={2} style={{ padding: '6px 10px', fontSize: 11, color: C.muted, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 10 }}>Total</td>
                      <td style={{ padding: '6px 10px', paddingTop: 10, fontFamily: FONT_MONO, fontWeight: 800, fontSize: 13, color: C.text }}>{totalItems}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>



          {/* Subtest scrollable area */}
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: 2,
            maxHeight: 'calc(4.5 * 74px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* Column headers */}
            {test.subtests.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18, padding: '7px 12px 7px 18px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bgDeep, zIndex: 1 }}>
                <span style={{ width: 28, flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>#</span>
                <span style={{ width: 56, flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Order</span>
                <span style={{ width: 220, flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Subtest</span>
                <span style={{ width: 175, flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Item Type</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT_MONO }}>Items</span>
              </div>
            )}

            {/* Empty subtest state */}
            {test.subtests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 24px', borderColor: 'rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                  This test has no subtests yet.
                </div>
                <div style={{ fontSize: 14, color: C.dim }}>
                  Click the <strong style={{ color: C.matrix }}>Add Subtest</strong> button to add your first subtest and begin building the test.
                </div>
              </div>
            )}

          {test.subtests.map((sub, subIndex) => {
            const accent        = GEN_COLORS[sub.generatorType] || C.muted;
            const bankItems     = bank.filter(b => b.generatedBy === sub.generatorType);
            const selectedItems = sub.items.map(id => bank.find(b => b.id === id)).filter(Boolean);
            const isFirstSubtest = subIndex === 0;
            const isLastSubtest = subIndex === test.subtests.length - 1;
            return (
              <div key={sub.id} style={{ ...sty.subtest(accent), marginBottom: 0, borderRadius: 0, border: 'none', borderBottom: `1px solid ${C.border}`, borderLeft: `2px solid ${accent}` }}>
                <div style={sty.row}>
                  <span style={{ width: 28, flexShrink: 0, fontSize: 12, fontWeight: 700, fontFamily: FONT_MONO, color: C.muted, textAlign: 'center' }}>{subIndex + 1}</span>
                  <div style={{ display: 'flex', gap: 2, width: 56, flexShrink: 0 }}>
                    <button
                      style={{ ...sty.btn, padding: '4px 8px', fontSize: 11, opacity: isFirstSubtest ? 0.3 : 0.7, cursor: isFirstSubtest ? 'not-allowed' : 'pointer' }}
                      onClick={() => !isFirstSubtest && moveSubtest(sub.id, 'up')}
                      disabled={isFirstSubtest}
                      title="Move subtest up"
                    >
                      ↑
                    </button>
                    <button
                      style={{ ...sty.btn, padding: '4px 8px', fontSize: 11, opacity: isLastSubtest ? 0.3 : 0.7, cursor: isLastSubtest ? 'not-allowed' : 'pointer' }}
                      onClick={() => !isLastSubtest && moveSubtest(sub.id, 'down')}
                      disabled={isLastSubtest}
                      title="Move subtest down"
                    >
                      ↓
                    </button>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_MONO, color: C.text, padding: '0 4px', width: 220, flexShrink: 0 }}>{sub.name}</span>
                  <div style={{ width: 175, flexShrink: 0 }}><Badge color={accent}>{sub.generatorType}</Badge></div>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO }}>{sub.items.length} items</span>
                  <div style={{ flex: 1 }} />
                  <button style={sty.btnPrimary} onClick={() => setModal({ subtestId: sub.id, generatorType: sub.generatorType, pendingItems: [...sub.items] })}>Select Items</button>
                  <button style={{ ...sty.btn, color: C.error, borderColor: `${C.error}44` }} onClick={() => removeSubtest(sub.id)}>Remove</button>
                </div>
                {selectedItems.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {selectedItems.map((item, itemIdx) => {
                      const isFirstItem = itemIdx === 0;
                      const isLastItem = itemIdx === selectedItems.length - 1;
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.muted, width: 100 }}>{item.id}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              style={{ background: 'none', border: 'none', color: isFirstItem ? C.muted : C.dim, cursor: isFirstItem ? 'not-allowed' : 'pointer', fontSize: 14, padding: '2px 4px', opacity: isFirstItem ? 0.3 : 1 }}
                              onClick={() => !isFirstItem && moveItem(sub.id, item.id, 'up')}
                              disabled={isFirstItem}
                              title="Move item up"
                            >
                              ↑
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: isLastItem ? C.muted : C.dim, cursor: isLastItem ? 'not-allowed' : 'pointer', fontSize: 14, padding: '2px 4px', opacity: isLastItem ? 0.3 : 1 }}
                              onClick={() => !isLastItem && moveItem(sub.id, item.id, 'down')}
                              disabled={isLastItem}
                              title="Move item down"
                            >
                              ↓
                            </button>
                          </div>
                          <span style={{ flex: 1, fontSize: 12 }}>{item.name}</span>
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.10)`,
                              borderRadius: 2, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                              color: C.dim, cursor: 'pointer', fontFamily: FONT_SANS,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = C.text; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = C.dim; }}
                          >
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <ellipse cx="6" cy="6" rx="5.2" ry="3.6" stroke="currentColor" strokeWidth="1.2"/>
                              <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
                            </svg>
                          </button>
                          <button onClick={() => removeItem(sub.id, item.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 14 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {bankItems.length === 0 && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>No {sub.generatorType} items in bank yet.</div>
                )}
              </div>
            );
          })}

          </div>{/* end scrollable subtest area */}

        </div>
      )}

      {/* Build footbar — pushed to bottom of flex column */}
      {test && isCreating && (
        <div style={{
          marginTop: 'auto',
          margin: 'auto -36px 0',
          background: 'rgba(10,12,20,0.96)',
          borderTop: `1px solid ${C.borderHd}`,
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 36px',
          zIndex: 50,
        }}>
          <button
            style={{
              ...sty.btnPrimary,
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.35)',
            }}
            onClick={() => setSubtestModalOpen(true)}
          >
            + Add Subtest
          </button>
          <button
            style={{
              ...sty.btn,
              background: 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.4)',
              fontWeight: 700,
              fontSize: 13,
            }}
            onClick={() => setSaveModalOpen(true)}
          >
            ✓ Save Test
          </button>
          <button
            style={{ ...sty.btn, color: C.error, borderColor: `${C.error}44` }}
            onClick={() => setIsCreating(false)}
          >
            Cancel Test Building
          </button>
        </div>
      )}

      {/* Item selection modal */}
      {modal && (
        <div style={sty.modal} onClick={() => setModal(null)}>
          <div style={{ ...sty.modalBody, width: 'fit-content', minWidth: 360 }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ ...sty.row, marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_MONO, margin: 0 }}>Select Items</h3>
              <Badge color={GEN_COLORS[modal.generatorType] || C.muted}>{modal.generatorType}</Badge>
            </div>

            {/* Item list */}
            <div style={{ marginBottom: 14 }}>
              {(() => {
                const available = bank.filter(b => b.generatedBy === modal.generatorType);
                if (!available.length) return (
                  <div style={{ color: C.muted, padding: 16, textAlign: 'center', fontSize: 12 }}>
                    No items available. Generate {modal.generatorType} items first.
                  </div>
                );
                const pending = new Set(modal.pendingItems);
                return available.map(item => {
                  const sel = pending.has(item.id);
                  const accentColor = GEN_COLORS[modal.generatorType] || C.matrix;
                  return (
                    <div
                      key={item.id}
                      style={{ ...sty.itemRow(sel), paddingRight: 6 }}
                      onClick={() => {
                        const next = new Set(modal.pendingItems);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        setModal(m => ({ ...m, pendingItems: [...next] }));
                      }}
                    >
                      <input type="checkbox" checked={sel} readOnly style={{ accentColor }} />
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.muted }}>{item.id}</span>
                      <span style={{ fontSize: 12 }}>{item.name}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setPreviewItem(item); }}
                        style={{
                          marginLeft: 'auto',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.10)`,
                          borderRadius: 2, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                          color: C.dim, cursor: 'pointer', fontFamily: FONT_SANS, flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = C.text; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = C.dim; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <ellipse cx="6" cy="6" rx="5.2" ry="3.6" stroke="currentColor" strokeWidth="1.2"/>
                          <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
                        </svg>
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO }}>
                {modal.pendingItems.length} item{modal.pendingItems.length !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    ...sty.btn,
                    color: '#eab308',
                    border: '1px solid rgba(234,179,8,0.45)',
                    background: 'rgba(234,179,8,0.08)',
                    fontWeight: 600,
                  }}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  disabled={modal.pendingItems.length === 0}
                  style={{
                    ...sty.btn,
                    background: modal.pendingItems.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(34,197,94,0.15)',
                    color: modal.pendingItems.length === 0 ? C.muted : '#22c55e',
                    border: `1px solid ${modal.pendingItems.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.4)'}`,
                    fontWeight: 700,
                    cursor: modal.pendingItems.length === 0 ? 'default' : 'pointer',
                  }}
                  onClick={() => {
                    if (modal.pendingItems.length === 0) return;
                    updateTest(t => ({
                      ...t,
                      subtests: t.subtests.map(s =>
                        s.id === modal.subtestId ? { ...s, items: modal.pendingItems } : s
                      ),
                    }));
                    setModal(null);
                  }}
                >
                  ✓ Add Selected Items to Subtest
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Test Confirmation Modal */}
      {saveModalOpen && test && (
        <div style={sty.modal} onClick={() => setSaveModalOpen(false)}>
          <div style={{ ...sty.modalBody, width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={sty.row}>
              <h3 style={{ fontSize: 16, fontWeight: 700, flex: 1, fontFamily: FONT_MONO }}>Save Test</h3>
              <button style={sty.btn} onClick={() => setSaveModalOpen(false)}>Cancel</button>
            </div>

            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
                Please confirm you want to save this test:
              </div>

              <div style={{ ...cardStyle, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Test Name</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>{test.name}</div>

                {test.description && (
                  <>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 12 }}>Description</div>
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>{test.description}</div>
                  </>
                )}
              </div>

              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Items by Type ({totalItems} total)
              </div>

              {getItemCountsByType().length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {getItemCountsByType().map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.type}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT_MONO, color: item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.muted, padding: '12px 0' }}>
                  No items added yet. You can save an empty test.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={sty.btn} onClick={() => setSaveModalOpen(false)}>Cancel</button>
              <button
                style={{
                  ...sty.btn,
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.4)',
                  fontWeight: 700,
                }}
                onClick={handleSaveTest}
              >
                ✓ Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subtest Modal */}
      {subtestModalOpen && (
        <div style={sty.modal} onClick={() => setSubtestModalOpen(false)}>
          <div style={{ ...sty.modalBody, width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={sty.row}>
              <h3 style={{ fontSize: 16, fontWeight: 700, flex: 1, fontFamily: FONT_MONO }}>Select Subtest Type</h3>
              <button style={sty.btn} onClick={() => setSubtestModalOpen(false)}>✕</button>
            </div>

            <div style={{ marginTop: 20, marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
                Choose which type of items this subtest will contain:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {GEN_TYPES.map((genType) => (
                  <button
                    key={genType}
                    onClick={() => addSubtest(genType)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = GEN_COLORS[genType];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = C.border;
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: GEN_COLORS[genType],
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>
                      {GEN_LABELS[genType]}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, textTransform: 'lowercase' }}>
                      {genType}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Preview Modal */}
      {(() => {
        // When the select-items modal is open, navigate through its available items list;
        // otherwise navigate through all items currently in the test.
        const navItems = modal
          ? bank.filter(b => b.generatedBy === modal.generatorType)
          : test
            ? test.subtests.flatMap(s => s.items.map(id => bank.find(b => b.id === id)).filter(Boolean))
            : [];
        const idx = previewItem ? navItems.findIndex(it => it.id === previewItem.id) : -1;
        return (
          <ItemPreviewModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            hasPrev={idx > 0}
            hasNext={idx >= 0 && idx < navItems.length - 1}
            onPrev={() => idx > 0 && setPreviewItem(navItems[idx - 1])}
            onNext={() => idx >= 0 && idx < navItems.length - 1 && setPreviewItem(navItems[idx + 1])}
            index={idx}
            total={navItems.length}
          />
        );
      })()}

      {/* Delete Test Confirmation Modal */}
      {deleteModalOpen && testToDelete && (
        <div style={sty.modal} onClick={() => setDeleteModalOpen(false)}>
          <div style={{ ...sty.modalBody, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={sty.row}>
              <h3 style={{ fontSize: 16, fontWeight: 700, flex: 1, fontFamily: FONT_MONO, color: C.error }}>
                ⚠ Delete Test
              </h3>
              <button style={sty.btn} onClick={() => setDeleteModalOpen(false)}>✕</button>
            </div>

            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
                Are you sure you want to delete this test?
              </div>

              <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${C.error}30` }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {tests.find(t => t.id === testToDelete)?.name}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {tests.find(t => t.id === testToDelete)?.subtests.reduce((n, s) => n + s.items.length, 0)} items
                  {' · '}
                  {tests.find(t => t.id === testToDelete)?.subtests.length} subtests
                </div>
              </div>

              <div style={{
                fontSize: 12,
                color: C.error,
                background: `${C.error}10`,
                padding: '10px 12px',
                borderRadius: 2,
                border: `1px solid ${C.error}30`,
              }}>
                <strong>Warning:</strong> This action cannot be undone. The test will be permanently deleted.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={sty.btn} onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button
                style={{
                  ...sty.btn,
                  background: 'rgba(239,68,68,0.15)',
                  color: C.error,
                  border: '1px solid rgba(239,68,68,0.4)',
                  fontWeight: 700,
                }}
                onClick={handleDeleteTest}
              >
                Delete Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme';
import { loadBank, subscribe } from '../store/bankStore';
import { load } from '../store/localStorage';

const FONT_MONO = "'JetBrains Mono', 'Fira Mono', 'Cascadia Code', monospace";
const FONT_SANS = "'Inter', 'Segoe UI', system-ui, sans-serif";
const FONT_SERIF = "'Georgia', 'Times New Roman', serif";

const C = {
  bg:         'rgba(10,15,26,0.55)',
  border:     '1px solid rgba(255,255,255,0.07)',
  text:       '#f1f5f9',
  dim:        '#94a3b8',
  muted:      '#64748b',
  matrix:     colors.matrix,
  // Document card palette — steel-blue tones
  docBg:      'rgba(8,16,36,0.82)',
  docBorder:  'rgba(56,100,180,0.28)',
  docBorderHd:'rgba(56,100,180,0.55)',
  docHead:    '#93b4e8',
  docText:    '#c8d8f0',
  docMuted:   '#6a85b0',
  docAccent:  '#4a80d4',
  docDivider: 'rgba(56,100,180,0.18)',
  docBadgeBg: 'rgba(56,100,180,0.12)',
};

const GENERATORS = [
  { key: 'spatial-rotation',     name: 'Spatial Rotation',     desc: '3D mental rotation items with isometric rendering, difficulty scoring, and distractor generation', color: colors.spatial, path: '/spatial-rotation' },
  { key: 'number-series',        name: 'Number Series',        desc: '25 sequence models (arithmetic, geometric, Fibonacci, two-step) with layered distractors', color: colors.number, path: '/number-series' },
  { key: 'progressive-matrices', name: 'Progressive Matrices', desc: '5 rule templates (rotation, size, count, alternation, dual-rule) with SVG rendering', color: colors.matrix, path: '/progressive-matrices' },
  { key: 'verbal-reasoning',     name: 'Verbal Reasoning',     desc: '5 conditional logic templates (syllogism, modus ponens/tollens, contraposition, necessity)', color: colors.verbal, path: '/verbal-reasoning' },
];

function DocDivider() {
  return (
    <div style={{
      height: 1,
      background: `linear-gradient(to right, transparent, ${C.docBorder}, transparent)`,
      margin: '18px 0',
    }} />
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: C.docAccent,
      fontFamily: FONT_MONO, marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ flex: 1, height: 1, background: C.docDivider, display: 'block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: C.docDivider, display: 'block' }} />
    </div>
  );
}

export default function HomePage() {
  const [bank, setBank] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { setBank(loadBank()); return subscribe(() => setBank(loadBank())); }, []);

  const testCount = (load('tests', []) || []).length;
  const countFor  = (gen) => bank.filter(b => b.generatedBy === gen).length;

  return (
    <div style={{ fontFamily: FONT_SANS, color: C.text, maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: -0.5, fontFamily: FONT_MONO, margin: '0 0 6px' }}>PsychKit</h1>
        <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, margin: 0 }}>
          Psychometric item generation and test assembly. Generate standardized test items with real scoring, principled distractor generation, and difficulty calibration.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        {GENERATORS.map(g => (
          <div
            key={g.key}
            style={{ background: C.bg, border: C.border, borderLeft: `2px solid ${g.color}`, borderRadius: 2, padding: '14px 16px', cursor: 'pointer' }}
            onClick={() => navigate(g.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 1, background: g.color, flexShrink: 0 }} />
              <h3 style={{ fontSize: 13, fontWeight: 700, flex: 1, margin: 0 }}>{g.name}</h3>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO }}>{countFor(g.key)} items</span>
            </div>
            <p style={{ fontSize: 12, color: C.dim, margin: 0, lineHeight: 1.5 }}>{g.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <div
          style={{ background: C.bg, border: C.border, borderRadius: 2, flex: 1, padding: '20px 0', textAlign: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/bank')}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.matrix, fontFamily: FONT_MONO }}>{bank.length}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Items in Bank</div>
        </div>
        <div
          style={{ background: C.bg, border: C.border, borderRadius: 2, flex: 1, padding: '20px 0', textAlign: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/test-builder')}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.matrix, fontFamily: FONT_MONO }}>{testCount}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Tests Assembled</div>
        </div>
      </div>

      {/* ── Document card ─────────────────────────────────────────────────────── */}
      <div style={{
        background: C.docBg,
        border: `1px solid ${C.docBorderHd}`,
        borderTop: `3px solid ${C.docAccent}`,
        borderRadius: 2,
        boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(56,100,180,0.08)',
        overflow: 'hidden',
      }}>

        {/* Card header */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: `1px solid ${C.docDivider}`,
          background: 'rgba(56,100,180,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_MONO, color: C.docHead, letterSpacing: '0.02em' }}>
                PsychKit
              </div>
              <div style={{ fontSize: 11, color: C.docMuted, marginTop: 3, fontFamily: FONT_SANS }}>
                Psychometric Item Generation Toolkit
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: C.docBadgeBg, border: `1px solid ${C.docBorder}`,
                borderRadius: 2, padding: '3px 10px',
                fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
                color: C.docAccent, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                v0.1.0 — Experimental Build
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: C.docText, fontFamily: FONT_SANS }}>
              Developed by <span style={{ fontWeight: 700, color: C.docHead }}>Ender de Freitas</span>
              <span style={{ color: C.docMuted }}> — AI & Cognitive Scientist</span>
            </div>
            <span style={{ color: C.docDivider, fontSize: 14, userSelect: 'none' }}>|</span>
            <div style={{ display: 'flex', gap: 14 }}>
              <a
                href="https://www.linkedin.com/in/endpsych"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: C.docAccent, textDecoration: 'none', fontFamily: FONT_MONO, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn: endpsych
              </a>
              <a
                href="https://github.com/endpsych"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: C.docAccent, textDecoration: 'none', fontFamily: FONT_MONO, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub: endpsych
              </a>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* What PsychKit does */}
          <SectionLabel>About This Tool</SectionLabel>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: '0 0 12px', fontFamily: FONT_SANS }}>
            PsychKit currently implements four procedural item generators, each targeting a distinct cognitive construct.
            All generators include proof tracing methods to verify item validity and quality.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {[
              { label: 'Spatial Rotation',     color: colors.spatial, desc: 'Generates 3D figure rotation items requiring mental rotation and the perceived rotation of objects across randomized shapes, orientations, and distractor configurations.' },
              { label: 'Number Series',        color: colors.number,  desc: 'Generates numerical sequence completion items across ten rule models, including arithmetic, geometric, recurrence, and two-step series with configurable parameters.' },
              { label: 'Progressive Matrices', color: colors.matrix,  desc: 'Generates abstract reasoning matrix items with rule-governed visual patterns across shape, color, size, and positional transformations.' },
              { label: 'Verbal Reasoning',     color: colors.verbal,  desc: 'Generates syllogistic reasoning items requiring logical evaluation of premise-conclusion structures across varying argument forms.' },
            ].map(({ label, color, desc }) => (
              <div key={label} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '7px 10px',
                background: `${color}08`,
                border: `1px solid ${color}22`,
                borderLeft: `2px solid ${color}`,
                borderRadius: 2,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: color, fontFamily: FONT_MONO, minWidth: 148, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 11, color: C.docText, lineHeight: 1.6, fontFamily: FONT_SANS }}>{desc}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: 0, fontFamily: FONT_SANS }}>
            Items can be reviewed, edited, and saved to a persistent <span style={{ color: C.docHead, fontWeight: 600 }}>Item Bank</span>. From the bank, items can be assembled into structured tests using the <span style={{ color: C.docHead, fontWeight: 600 }}>Test Builder</span>, which supports multi-subtest configurations with ordered item selection. Assembled tests can be administered directly through the <span style={{ color: C.docHead, fontWeight: 600 }}>Take Test</span> module, which presents items sequentially and provides per-item and aggregate scoring upon completion.
          </p>

          <DocDivider />

          {/* Recommended use cases */}
          <SectionLabel>Recommended Use Cases</SectionLabel>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: 0, fontFamily: FONT_SANS }}>
            This tool is suitable for: item prototyping and pilot generation, cognitive assessment methodology research, classroom and teaching demonstrations, and exploration of procedural item generation approaches.
          </p>

          <DocDivider />

          {/* Data & Privacy */}
          <SectionLabel>Data &amp; Privacy</SectionLabel>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: 0, fontFamily: FONT_SANS }}>
            All data — including generated items, the item bank, and assembled tests — is stored exclusively in your browser's local storage. Nothing is transmitted to any external server. Clearing your browser data will permanently erase all stored content.
          </p>

          <DocDivider />

          {/* Disclaimer */}
          <SectionLabel>Disclaimer &amp; Notice of Limitations</SectionLabel>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: '0 0 10px', fontFamily: FONT_SANS }}>
            This application is a research and development prototype built for experimental purposes. It is not intended for operational use in clinical, educational, or professional assessment contexts. Functionality is deliberately scoped and constrained; this is not a full psychometric platform.
          </p>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: '0 0 10px', fontFamily: FONT_SANS }}>
            If you need a more comprehensive, validated, or custom-built psychometric solution, the author is available for commissioned development. More advanced implementations — including full item banks, adaptive testing engines, and reporting pipelines — can be produced on request.
          </p>
          <p style={{ fontSize: 12, color: C.docText, lineHeight: 1.75, margin: 0, fontFamily: FONT_SANS }}>
            This software is provided as-is, without warranty of any kind. The author bears no liability for how this application or its outputs are used, interpreted, or applied. Users are solely responsible for ensuring that any use complies with applicable standards and regulations.
          </p>

          <DocDivider />

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 10, color: C.docMuted, fontFamily: FONT_MONO, letterSpacing: '0.04em' }}>
              © 2026 Ender de Freitas. All rights reserved.
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: C.docMuted,
              fontFamily: FONT_MONO, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: `1px solid ${C.docDivider}`, borderRadius: 2, padding: '2px 8px',
            }}>
              Experimental · Not for Operational Use
            </span>
          </div>

        </div>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
}

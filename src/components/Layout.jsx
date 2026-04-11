import { createElement, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { colors, fonts } from '../theme';
import SpatialRotationGenerator from '../generators/spatial-rotation/SpatialRotationGenerator';
import NumberSeriesGenerator from '../generators/number-series/NumberSeriesGenerator';
import ProgressiveMatricesGenerator from '../generators/progressive-matrices/ProgressiveMatricesGenerator';
import VerbalReasoningGenerator from '../generators/verbal-reasoning/VerbalReasoningGenerator';
import HomePage from '../pages/HomePage';
import ItemBankPage from '../item-bank/ItemBankPage';
import TestBuilderPage from '../test-builder/TestBuilderPage';
import TakeTestPage from '../test-builder/TakeTestPage';

// All components that should be kept alive when navigating away
const KEEP_ALIVE_ROUTES = {
  '/':                       HomePage,
  '/spatial-rotation':       SpatialRotationGenerator,
  '/number-series':          NumberSeriesGenerator,
  '/progressive-matrices':   ProgressiveMatricesGenerator,
  '/verbal-reasoning':       VerbalReasoningGenerator,
  '/bank':                   ItemBankPage,
  '/test-builder':           TestBuilderPage,
  '/take-test':              TakeTestPage,
};

const NAV = [
  { to: '/', label: 'Home', icon: '⌂' },
  { header: 'Generators' },
  { to: '/verbal-reasoning', label: 'Verbal Reasoning', dot: colors.verbal },
  { to: '/number-series', label: 'Number Series', dot: colors.number },
  { to: '/spatial-rotation', label: 'Spatial Rotation', dot: colors.spatial },
  { to: '/progressive-matrices', label: 'Progressive Matrices', dot: colors.matrix },
  { header: 'Tools' },
  { to: '/bank', label: 'Item Bank', icon: '◫' },
  { to: '/test-builder', label: 'Test Builder', icon: '☰' },
  { to: '/take-test', label: 'Take Test', icon: '▶' },
];

const SIDEBAR_EXPANDED = 208;
const SIDEBAR_COLLAPSED = 60;
const SIDEBAR_STORAGE_KEY = 'psychkit-sidebar-collapsed';

const sidebarStyle = (collapsed) => ({
  width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
  minWidth: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
  height: '100vh',
  background: colors.surface,
  borderRight: `1px solid ${colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  padding: '16px 0',
  fontFamily: fonts.body,
  position: 'fixed',
  left: 0,
  top: 0,
  overflowY: 'auto',
  zIndex: 10,
  transition: 'width 0.18s ease',
});

const linkBase = (collapsed) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  justifyContent: collapsed ? 'center' : 'flex-start',
  padding: collapsed ? '10px 12px' : '8px 20px',
  color: colors.textMuted,
  textDecoration: 'none',
  fontSize: 14,
  borderLeft: 'none',
  transition: 'all 0.15s',
  boxShadow: 'none',
});

const linkActive = (collapsed) => ({
  ...linkBase(collapsed),
  color: colors.text,
  background: `${colors.white}08`,
});

const topRowStyle = (collapsed) => ({
  padding: collapsed ? '0 12px 16px' : '0 20px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: collapsed ? 'center' : 'space-between',
  gap: 8,
});

const collapseBtnStyle = {
  background: colors.surfaceLight,
  color: colors.textMuted,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });
  const location = useLocation();
  const pathname = location.pathname;
  const isKeepAliveRoute = pathname in KEEP_ALIVE_ROUTES;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        paddingLeft: sidebarWidth,
        fontFamily: fonts.body,
        color: colors.text,
        background: colors.bg,
        minHeight: '100vh',
        transition: 'padding-left 0.18s ease',
      }}
    >
      <nav style={sidebarStyle(collapsed)}>
        <div style={topRowStyle(collapsed)}>
          {!collapsed && (
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, letterSpacing: -0.3 }}>
              PsychKit
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            style={collapseBtnStyle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        {NAV.map((item, i) => {
          if (item.header) {
            return (
              collapsed
                ? <div key={i} style={{ margin: '10px 18px 6px', borderTop: `1px solid ${colors.border}` }} />
                : <div key={i} style={{ padding: '16px 20px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: colors.textDim, letterSpacing: 1 }}>
                    {item.header}
                  </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              style={({ isActive }) => isActive ? linkActive(collapsed) : linkBase(collapsed)}
              title={item.label}
            >
              {item.dot && <span style={{ width: 8, height: 8, borderRadius: 4, background: item.dot, flexShrink: 0 }} />}
              {item.icon && <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>}
              {!collapsed && item.label}
            </NavLink>
          );
        })}
      </nav>
      <main
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          flex: '1 1 auto',
          overflow: 'hidden',
          padding: pathname === '/' ? 32 : 0,
          minHeight: '100vh',
        }}
      >
        {/* Keep-alive: render each page once visited; hide via CSS instead of unmounting */}
        {Object.entries(KEEP_ALIVE_ROUTES).map(([path, Component]) => (
          <div key={path} style={{ display: pathname === path ? 'contents' : 'none' }}>
            {createElement(Component)}
          </div>
        ))}
        {/* Normal outlet for unknown routes (404 fallback) */}
        {!isKeepAliveRoute && <Outlet />}
      </main>
    </div>
  );
}

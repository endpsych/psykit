// ─── Isometric Canvas 2D renderer for Spatial Rotation (object_rotation mode) ──

// ─── Default config ─────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  panX: 0,
  panY: 0,
  cubeFill: '#34c759',
  cubeEdge: '#111111',
  backgroundFill: '#040816',
};

/**
 * Returns a render config with zoom and panY computed so the shape:
 *  1. Uses a stable, conservative zoom for the shape regardless of rotation
 *  2. Is centered after mirror/rotation/translation are applied
 */
export function makeConfig(coords, offscreenSize, view = {}, overrides = {}) {
  const renderView = {
    roll: 0,
    elev: 0,
    azim: 0,
    tX: 0,
    tY: 0,
    tZ: 0,
    mirror: false,
    ...view,
  };

  const pivot = getShapePivot(coords);
  const maxR = getBoundingRadius(coords, pivot);
  const halfExtentRatio = 0.36;
  const zoom = Math.min(
    halfExtentRatio / (1.225 * Math.max(maxR, 0.5) * 0.064),
    5.0,
  );

  const fittedBounds = getProjectedBounds(coords, renderView, pivot, offscreenSize, zoom);
  const panX = offscreenSize / 2 - fittedBounds.centerX;
  const panY = offscreenSize / 2 - fittedBounds.centerY;

  return { ...DEFAULT_CONFIG, zoom, panX, panY, ...overrides };
}

// ─── Color helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const p = parseInt(v, 16);
  return [(p >> 16) & 0xFF, (p >> 8) & 0xFF, p & 0xFF];
}

function mixRgb(from, to, t) {
  return from.map((v, i) => Math.round(v + (to[i] - v) * t));
}

function rgbCss(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function buildFillPalette(hex) {
  const base = hexToRgb(hex);
  return [
    rgbCss(mixRgb(base, [255, 255, 255], 0.32)),
    rgbCss(mixRgb(base, [255, 255, 255], 0.08)),
    rgbCss(base),
    rgbCss(mixRgb(base, [0, 0, 0], 0.12)),
    rgbCss(mixRgb(base, [0, 0, 0], 0.22)),
    rgbCss(mixRgb(base, [0, 0, 0], 0.32)),
  ];
}

// ─── 3D math ────────────────────────────────────────────────────────────────

export function rotatePoint([x, y, z], rollDeg, elevDeg, azimDeg) {
  const r = rollDeg * Math.PI / 180;
  const e = elevDeg * Math.PI / 180;
  const a = azimDeg * Math.PI / 180;
  // Roll (X axis)
  const y1 = y * Math.cos(r) - z * Math.sin(r);
  const z1 = y * Math.sin(r) + z * Math.cos(r);
  // Elevation (Y axis)
  const x2 = x * Math.cos(e) + z1 * Math.sin(e);
  const z2 = -x * Math.sin(e) + z1 * Math.cos(e);
  // Azimuth (Z axis)
  const x3 = x2 * Math.cos(a) - y1 * Math.sin(a);
  const y3 = x2 * Math.sin(a) + y1 * Math.cos(a);
  return [x3, y3, z2];
}

export function getShapePivot(coords) {
  if (!coords.length) return [0, 0, 0];
  const xs = coords.flatMap(c => [c[0], c[0] + 1]);
  const ys = coords.flatMap(c => [c[1], c[1] + 1]);
  const zs = coords.flatMap(c => [c[2], c[2] + 1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  ];
}

function getBoundingRadius(coords, pivot) {
  let maxR = 0;
  coords.forEach(([cx, cy, cz]) => {
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = 0; dz <= 1; dz++) {
          const px = cx + dx - pivot[0];
          const py = cy + dy - pivot[1];
          const pz = cz + dz - pivot[2];
          const d = px * px + py * py + pz * pz;
          if (d > maxR) maxR = d;
        }
      }
    }
  });
  return Math.sqrt(maxR);
}

function rotateAroundPivot(pt, view, pivot) {
  const s = [pt[0] - pivot[0], pt[1] - pivot[1], pt[2] - pivot[2]];
  const rotated = rotatePoint(s, view.roll, view.elev, view.azim);
  return [rotated[0] + pivot[0], rotated[1] + pivot[1], rotated[2] + pivot[2]];
}

function mirrorPointAroundPivot(pt, pivot, mirrored) {
  if (!mirrored) return pt;
  return [(2 * pivot[0]) - pt[0], pt[1], pt[2]];
}

export function transformPoint(pt, view, pivot) {
  const tx = view.tX || 0, ty = view.tY || 0, tz = view.tZ || 0;
  const mirrored = mirrorPointAroundPivot(pt, pivot, view.mirror);
  const rp = rotateAroundPivot(mirrored, view, pivot);
  return [rp[0] + tx, rp[1] + ty, rp[2] + tz];
}

export function projectPoint(x, y, z, w, h, zoom, panX, panY) {
  const s = Math.min(w, h) * 0.064 * zoom;
  return {
    x: w / 2 + panX + (x - y) * s * 0.866,
    y: h * 0.7 + panY + (x + y) * s * 0.5 - z * s,
    d: x + y + z,
  };
}

function getProjectedBounds(coords, view, pivot, size, zoom) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  coords.forEach((coord) => {
    cubeVerts(coord).forEach((vertex) => {
      const transformed = transformPoint(vertex, view, pivot);
      const projected = projectPoint(transformed[0], transformed[1], transformed[2], size, size, zoom, 0, 0);
      if (projected.x < minX) minX = projected.x;
      if (projected.x > maxX) maxX = projected.x;
      if (projected.y < minY) minY = projected.y;
      if (projected.y > maxY) maxY = projected.y;
    });
  });

  if (!Number.isFinite(minX)) {
    return { width: 1, height: 1, centerX: size / 2, centerY: size / 2 };
  }

  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// ─── Cube geometry ──────────────────────────────────────────────────────────

export function cubeVerts([x, y, z]) {
  return [
    [x, y, z], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z],
    [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
  ];
}

export const FACE_IDX = [
  [0, 1, 2, 3],  // bottom
  [4, 5, 6, 7],  // top
  [0, 1, 5, 4],  // front
  [2, 3, 7, 6],  // back
  [1, 2, 6, 5],  // right
  [0, 3, 7, 4],  // left
];

// ─── Main render ────────────────────────────────────────────────────────────

export function renderCanvas(canvas, view, coords, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  if (!w || !h) return;

  // Clear and fill background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cfg.backgroundFill;
  ctx.fillRect(0, 0, w, h);

  if (!coords || !coords.length) return;

  const pivot = getShapePivot(coords);
  const fills = buildFillPalette(cfg.cubeFill);
  const faces = [];

  coords.forEach(coord => {
    const verts3d = cubeVerts(coord).map(v => transformPoint(v, view, pivot));
    const verts = verts3d.map(v => projectPoint(v[0], v[1], v[2], w, h, cfg.zoom, cfg.panX, cfg.panY));

    FACE_IDX.forEach((idx, fi) => {
      const pts = idx.map(i => verts[i]);
      const depth = idx.reduce((s, i) => s + verts[i].d, 0) / idx.length;
      faces.push({ pts, depth, fill: fills[fi] });
    });
  });

  // Painter's algorithm: sort by depth ascending (back-to-front)
  faces.sort((a, b) => a.depth - b.depth);

  faces.forEach(f => {
    ctx.beginPath();
    ctx.moveTo(f.pts[0].x, f.pts[0].y);
    f.pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    ctx.strokeStyle = cfg.cubeEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

}

// ─── Auto-center canvas ─────────────────────────────────────────────────────

export function autoCenterCanvas(srcCanvas, outputBg) {
  const { width: w, height: h } = srcCanvas;
  const ctx = srcCanvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h).data;

  // Use top-left pixel as background color reference
  const bgR = data[0], bgG = data[1], bgB = data[2], bgA = data[3];
  const THRESH = 18;
  const isBg = (i) => {
    if (bgA < 10) return data[i + 3] < 10;
    const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB;
    return (dr * dr + dg * dg + db * db) < THRESH * THRESH;
  };

  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBg((y * w + x) * 4)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return srcCanvas;

  // Expand by a small amount to account for strokes touching the boundary.
  minX = Math.max(0, minX - 2);
  minY = Math.max(0, minY - 2);
  maxX = Math.min(w - 1, maxX + 2);
  maxY = Math.min(h - 1, maxY + 2);

  const contentCX = Math.round((minX + maxX) / 2);
  const contentCY = Math.round((minY + maxY) / 2);
  const dx = Math.round(w / 2 - contentCX);
  const dy = Math.round(h / 2 - contentCY);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const oc = canvas.getContext('2d');
  oc.fillStyle = outputBg;
  oc.fillRect(0, 0, w, h);
  oc.drawImage(srcCanvas, dx, dy);

  return canvas;
}

// ─── Offscreen render ───────────────────────────────────────────────────────

export function offscreenRender(view, coords, config, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  renderCanvas(c, view, coords, config);
  return c;
}

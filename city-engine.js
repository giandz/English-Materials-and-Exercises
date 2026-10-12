/* ══════════════════════════════════════════════════════════════════════════
   city-engine.js — the City Playground's map art, as pictures for lessons.

   The directions playground (a1_freer_directions_playground) draws its city
   with its own code; this file is that same tile art — roads with sidewalks,
   lane lines and crossings, rivers with curved banks, railroads, bridges,
   tunnels, parking lots, ferry docks, ground colours, places and 📍 pins —
   packaged so any lesson page can draw a neighbourhood from data, the way
   HousePicture draws a house. No interaction: these are pictures.

     <script src="house.js"></script>
     <script src="city-engine.js"></script>

     CityPicture.draw(el, city, opts)   // renders into el, returns the <svg>
     CityPicture.svg(city, opts)        // the markup, as a string

   city: a file saved from the playground (⚙️ Options → 💾 Save) — or the
   quick form CityPicture.map(…) below. Either way it is the playground's
   own format:
     { app: 'city-playground', version: 1, cols, rows,
       cells:  [{ r, c, kind, symbol?, special?, pin?, terrain? }],
       labels: [{ text, x, y, orientation }] }
   kind: 'building' (symbol = its emoji) | 'road' | 'rail' | 'river' | 'special'
   special: bridge-h/v · railbridge-h/v · railcross-h/v · parking · tunnel-n/e/s/w
   pin: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' (on a place)
   terrain: 'dirt' | 'sand' | 'snow' (no value = grass)

   opts (all optional):
     alt     text for screen readers
     grid    false hides the dotted grid lines
     labels  extra [{ r, c, text }] written over squares (row, column)

   Paths (the 🧭 routes) are not drawn — a picture shows the place, the
   lesson asks the way.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CELL = 60;

  const PIN_SYMBOL = '📍';
  // the same six pin colours as the playground: one emoji, hue-rotated
  const PIN_COLORS = {
    red:    { rotate: 0,   bright: 1   },
    orange: { rotate: 30,  bright: 1.6 },
    yellow: { rotate: 50,  bright: 2.3 },
    green:  { rotate: 120, bright: 1.2 },
    blue:   { rotate: 210, bright: 1.1 },
    purple: { rotate: 265, bright: 1   }
  };
  const pinFilter = info => info ? `hue-rotate(${info.rotate}deg) brightness(${info.bright})` : '';

  const TERRAINS = { dirt: '#b58c5c', sand: '#ead38e', snow: '#f3f6f9' };
  const TERRAIN_ORDER = ['dirt', 'sand', 'snow'];

  const ROAD_COLOR = '#6b6f76', LANE_COLOR = '#f2f2f2', SIDEWALK_COLOR = '#b8b5ad', RIVER_COLOR = '#5b9bd5';
  const ARM_W = CELL * 0.34 * 1.25, SIDEWALK_EXTRA = CELL * 0.10, RIVER_ARM_W = CELL * 0.9 * 0.75;
  const BALLAST_COLOR = '#b3a896', TIE_COLOR = '#7a5534', RAIL_COLOR = '#4f545b';
  const BALLAST_W = CELL * 0.40, RAIL_GAUGE = CELL * 0.22, TIE_LEN = CELL * 0.36, TIE_W = 3.5, TIE_SPACING = CELL / 6;
  const DOCK_COLOR = '#8b5e34', DOCK_PLANK_COLOR = '#6b4423', PIER_W = CELL * 0.42;
  const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const DIRVEC = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
  // nature stands right on the ground, without the white place tile: a tree,
  // a field or a cow on a square reads as countryside, not as a shop called "🌳"
  const OPEN_AIR = new Set(['🌳', '🌲', '🌴', '🌵', '🌾', '🌻', '🌷', '🐄', '🐑', '🐎', '🐖', '🐔', '🚜']);
  const SPECIALS = ['bridge-h', 'bridge-v', 'parking', 'railbridge-h', 'railbridge-v', 'railcross-h', 'railcross-v', 'tunnel-n', 'tunnel-e', 'tunnel-s', 'tunnel-w'];

  const STYLE_ID = 'city-picture-styles';
  const CSS = `
.city-pic{ display:block; width:100%; height:auto; border-radius:var(--border-radius-lg, 12px); }
.city-pic .city-place{ font-size:30px; }
.city-pic .city-pin{ font-size:64px; }
.city-pic .city-label{ font-family:var(--font-sans, sans-serif); font-weight:700; font-size:19px; fill:#1a1a1a;
  paint-order:stroke; stroke:#ffffff; stroke-width:3px; stroke-linejoin:round; }
`;
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  const polyD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ');

  // Marching-squares shape for one dual cell of ground colour (see the playground).
  function terrainPolygon(tl, tr, br, bl, x0, y0, x1, y1) {
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const TL = [x0, y0, 0], TR = [x1, y0, 0], BR = [x1, y1, 0], BL = [x0, y1, 0];
    const T = [xm, y0, 1], R = [x1, ym, 1], B = [xm, y1, 1], L = [x0, ym, 1];
    switch ((tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0)) {
      case 0: return null;
      case 1: return [L, B, BL];
      case 2: return [B, R, BR];
      case 3: return [L, R, BR, BL];
      case 4: return [T, TR, R];
      case 5: return [L, T, TR, R, B, BL];
      case 6: return [T, TR, BR, B];
      case 7: return [L, T, TR, BR, BL];
      case 8: return [TL, T, L];
      case 9: return [TL, T, B, BL];
      case 10: return [TL, T, R, BR, B, L];
      case 11: return [TL, T, R, BR, BL];
      case 12: return [TL, TR, R, L];
      case 13: return [TL, TR, R, B, BL];
      case 14: return [TL, TR, BR, B, L];
      case 15: return [TL, TR, BR, BL];
    }
  }

  /* ── one map → one <svg> element ─────────────────────────────────────── */
  function render(city, opts) {
    opts = opts || {};
    const COLS = Math.max(1, Math.round(city.cols)), ROWS = Math.max(1, Math.round(city.rows));
    const grid = [];
    for (let r = 0; r < ROWS; r++) { grid.push([]); for (let c = 0; c < COLS; c++) grid[r].push({ kind: null }); }
    const inGrid = (r, c) => Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < ROWS && c >= 0 && c < COLS;
    (city.cells || []).forEach(x => {
      if (!x || !inGrid(x.r, x.c)) return;
      const cell = grid[x.r][x.c];
      if (x.terrain && TERRAINS[x.terrain]) cell.terrain = x.terrain;
      if (x.kind === 'building' && x.symbol) { cell.kind = 'building'; cell.symbol = String(x.symbol); if (PIN_COLORS[x.pin]) cell.pin = x.pin; }
      else if (x.kind === 'special' && SPECIALS.includes(x.special)) { cell.kind = 'special'; cell.special = x.special; }
      else if (['road', 'rail', 'river'].includes(x.kind)) cell.kind = x.kind;
    });

    const isFerryTerminal = cell => !!cell && cell.kind === 'building' && cell.symbol === '⚓';
    const isTrainStation = cell => !!cell && cell.kind === 'building' && cell.symbol === '🚉';

    // ── connectivity (identical rules to the playground) ──
    function roadConnectsToward(cell, dir) {
      if (cell.kind === 'road') return true;
      if (cell.kind !== 'special') return false;
      const sp = cell.special;
      if (sp === 'bridge-h') return dir === 'E' || dir === 'W';
      if (sp === 'bridge-v') return dir === 'N' || dir === 'S';
      if (sp === 'tunnel-n') return dir === 'N';
      if (sp === 'tunnel-s') return dir === 'S';
      if (sp === 'tunnel-e') return dir === 'E';
      if (sp === 'tunnel-w') return dir === 'W';
      if (sp === 'parking') return true;
      if (sp === 'railcross-h') return dir === 'N' || dir === 'S';
      if (sp === 'railcross-v') return dir === 'E' || dir === 'W';
      return false;
    }
    function riverConnectsToward(cell, dir) {
      if (cell.kind === 'river') return true;
      if (cell.kind !== 'special') return false;
      const sp = cell.special;
      if (sp === 'bridge-h' || sp === 'railbridge-h') return dir === 'N' || dir === 'S';
      if (sp === 'bridge-v' || sp === 'railbridge-v') return dir === 'E' || dir === 'W';
      return false;
    }
    function railConnectsToward(cell, dir) {
      if (cell.kind === 'rail') return true;
      if (isTrainStation(cell)) return true;
      if (cell.kind !== 'special') return false;
      const sp = cell.special;
      if (sp === 'railcross-h' || sp === 'railbridge-h') return dir === 'E' || dir === 'W';
      if (sp === 'railcross-v' || sp === 'railbridge-v') return dir === 'N' || dir === 'S';
      return false;
    }
    const cellExit = (r, c, dir, fn) => inGrid(r, c) && fn(grid[r][c], dir);
    const neighbors = (r, c, fn) => ({
      N: cellExit(r - 1, c, 'S', fn), S: cellExit(r + 1, c, 'N', fn),
      E: cellExit(r, c + 1, 'W', fn), W: cellExit(r, c - 1, 'E', fn)
    });
    const isWaterBridge = cell => !!cell && cell.kind === 'special' && /^(rail)?bridge-[hv]$/.test(cell.special || '');
    const carriesWater = (r, c) => inGrid(r, c) && (grid[r][c].kind === 'river' || isWaterBridge(grid[r][c]));
    const riverSame = (r, c) => !inGrid(r, c) || grid[r][c].kind === 'river' || isWaterBridge(grid[r][c]);
    const edgeMid = (r, c, dir) => {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2;
      return { N: { x: cx, y: y0 }, S: { x: cx, y: y0 + CELL }, W: { x: x0, y: cy }, E: { x: x0 + CELL, y: cy } }[dir];
    };

    // ── rivers ──
    function drawRiverTile(art, r, c, on) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2, h = RIVER_ARM_W / 2;
      const dirs = ['N', 'S', 'E', 'W'].filter(k => on[k]);
      const V = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      const quad = (d1, d2) => {
        if (!on[d1] || !on[d2]) return false;
        const [a1, b1] = V[d1], [a2, b2] = V[d2];
        return riverSame(r + b1, c + a1) && riverSame(r + b2, c + a2) && riverSame(r + b1 + b2, c + a1 + a2);
      };
      const water = a => art.appendChild(svgEl(a.d ? 'path' : a.r ? 'circle' : 'rect', Object.assign({ fill: RIVER_COLOR, stroke: RIVER_COLOR, 'stroke-width': 0.8 }, a)));
      const CORNERS = [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']];
      CORNERS.forEach(([d1, d2]) => {
        if (!quad(d1, d2)) return;
        water({ x: V[d1][0] + V[d2][0] > 0 ? cx : x0, y: V[d1][1] + V[d2][1] > 0 ? cy : y0, width: CELL / 2, height: CELL / 2 });
      });
      if (dirs.length === 0) { water({ cx, cy, r: h }); return; }
      if (dirs.length === 1) {
        const [dx, dy] = V[dirs[0]];
        water(dx ? { x: dx > 0 ? cx : x0, y: cy - h, width: CELL / 2, height: 2 * h } : { x: cx - h, y: dy > 0 ? cy : y0, width: 2 * h, height: CELL / 2 });
        water({ cx, cy, r: h });
        return;
      }
      if (dirs.length === 2 && !(on.N && on.S) && !(on.E && on.W)) {
        const px = on.E ? x0 + CELL : x0, py = on.S ? y0 + CELL : y0;
        const angOf = d => { const m = edgeMid(r, c, d); return Math.atan2(m.y - py, m.x - px); };
        const t0 = angOf(dirs[0]);
        let dt = angOf(dirs[1]) - t0; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
        const R0 = CELL / 2 - h, R1 = CELL / 2 + h, N = 18, outer = [], inner = [];
        for (let i = 0; i <= N; i++) {
          const t = t0 + dt * i / N;
          outer.push([px + R1 * Math.cos(t), py + R1 * Math.sin(t)]);
          inner.push([px + R0 * Math.cos(t), py + R0 * Math.sin(t)]);
        }
        water({ d: 'M' + outer.concat(inner.reverse()).map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z' });
        return;
      }
      water({ x: cx - h, y: cy - h, width: 2 * h, height: 2 * h });
      dirs.forEach(k => {
        const [dx, dy] = V[k];
        water(dx ? { x: dx > 0 ? cx : x0, y: cy - h, width: CELL / 2, height: 2 * h } : { x: cx - h, y: dy > 0 ? cy : y0, width: 2 * h, height: CELL / 2 });
      });
      const f = 9;
      CORNERS.forEach(([d1, d2]) => {
        if (!on[d1] || !on[d2] || quad(d1, d2)) return;
        const sx = V[d1][0] + V[d2][0], sy = V[d1][1] + V[d2][1];
        const px = cx + sx * h, py = cy + sy * h, ax = px + sx * f, by = py + sy * f;
        water({ d: `M${px} ${py}L${ax} ${py}A${f} ${f} 0 0 ${sx * sy > 0 ? 0 : 1} ${px} ${by}Z` });
      });
    }
    function riverWaterAt(r, c, on, x, y) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2, h = RIVER_ARM_W / 2;
      const dirs = ['N', 'S', 'E', 'W'].filter(k => on[k]);
      const V = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      for (const [d1, d2] of [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']]) {
        if (!on[d1] || !on[d2]) continue;
        const [a1, b1] = V[d1], [a2, b2] = V[d2];
        if (!(riverSame(r + b1, c + a1) && riverSame(r + b2, c + a2) && riverSame(r + b1 + b2, c + a1 + a2))) continue;
        const qx = a1 + a2 > 0 ? cx : x0, qy = b1 + b2 > 0 ? cy : y0;
        if (x >= qx && x <= qx + CELL / 2 && y >= qy && y <= qy + CELL / 2) return true;
      }
      const inArm = k => {
        const [dx, dy] = V[k];
        return dx ? (Math.abs(y - cy) <= h && (dx > 0 ? x >= cx : x <= cx)) : (Math.abs(x - cx) <= h && (dy > 0 ? y >= cy : y <= cy));
      };
      if (dirs.length === 0) return Math.hypot(x - cx, y - cy) <= h;
      if (dirs.length === 1) return inArm(dirs[0]) || Math.hypot(x - cx, y - cy) <= h;
      if (dirs.length === 2 && !(on.N && on.S) && !(on.E && on.W)) {
        const px = on.E ? x0 + CELL : x0, py = on.S ? y0 + CELL : y0, d = Math.hypot(x - px, y - py);
        return d >= CELL / 2 - h && d <= CELL / 2 + h;
      }
      return (Math.abs(x - cx) <= h && Math.abs(y - cy) <= h) || dirs.some(inArm);
    }
    function drawFerryDocks(art, r, c, on) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2;
      ['N', 'S', 'E', 'W'].forEach(dir => {
        const [dr, dc] = DIRVEC[dir];
        if (!inGrid(r + dr, c + dc) || !isFerryTerminal(grid[r + dr][c + dc])) return;
        const along = t => ({ N: [cx, y0 + t], S: [cx, y0 + CELL - t], W: [x0 + t, cy], E: [x0 + CELL - t, cy] })[dir];
        let bank = CELL / 2;
        for (let t = 0; t <= CELL; t += 1) { const [px, py] = along(t); if (riverWaterAt(r, c, on, px, py)) { bank = t; break; } }
        const depth = Math.min(CELL - 4, Math.max(CELL * 0.3, bank + CELL * 0.22));
        const vertical = dir === 'N' || dir === 'S';
        const rect = vertical
          ? { x: cx - PIER_W / 2, y: dir === 'N' ? y0 : y0 + CELL - depth, width: PIER_W, height: depth }
          : { x: dir === 'W' ? x0 : x0 + CELL - depth, y: cy - PIER_W / 2, width: depth, height: PIER_W };
        art.appendChild(svgEl('rect', Object.assign({ fill: DOCK_COLOR, stroke: DOCK_PLANK_COLOR, 'stroke-width': 1 }, rect)));
        const planks = Math.max(3, Math.round(depth / 7));
        for (let i = 1; i < planks; i++) {
          const [px, py] = along(depth * i / planks);
          art.appendChild(svgEl('line', vertical
            ? { x1: cx - PIER_W / 2 + 1, x2: cx + PIER_W / 2 - 1, y1: py, y2: py, stroke: DOCK_PLANK_COLOR, 'stroke-width': 1.2 }
            : { y1: cy - PIER_W / 2 + 1, y2: cy + PIER_W / 2 - 1, x1: px, x2: px, stroke: DOCK_PLANK_COLOR, 'stroke-width': 1.2 }));
        }
      });
    }

    // ── roads ──
    function drawArmSet(art, cx, cy, r, c, on, armW, color, o) {
      o = o || {};
      const dirs = [
        { key: 'N', on: on.N, x: cx - armW / 2, y: r * CELL, w: armW, h: CELL / 2 },
        { key: 'S', on: on.S, x: cx - armW / 2, y: cy, w: armW, h: CELL / 2 },
        { key: 'W', on: on.W, x: c * CELL, y: cy - armW / 2, w: CELL / 2, h: armW },
        { key: 'E', on: on.E, x: cx, y: cy - armW / 2, w: CELL / 2, h: armW }
      ];
      if (o.cornerFillKind) {
        const kind = o.cornerFillKind;
        const same = (rr, cc) => !inGrid(rr, cc) || grid[rr][cc].kind === kind;
        [
          { need: ['N', 'E'], orth: [[r - 1, c], [r, c + 1]], diag: [r - 1, c + 1], x: cx, y: r * CELL },
          { need: ['N', 'W'], orth: [[r - 1, c], [r, c - 1]], diag: [r - 1, c - 1], x: c * CELL, y: r * CELL },
          { need: ['S', 'E'], orth: [[r + 1, c], [r, c + 1]], diag: [r + 1, c + 1], x: cx, y: cy },
          { need: ['S', 'W'], orth: [[r + 1, c], [r, c - 1]], diag: [r + 1, c - 1], x: c * CELL, y: cy }
        ].forEach(k => {
          if (!on[k.need[0]] || !on[k.need[1]]) return;
          if (!same(...k.orth[0]) || !same(...k.orth[1]) || !same(...k.diag)) return;
          art.appendChild(svgEl('rect', { x: k.x, y: k.y, width: CELL / 2, height: CELL / 2, fill: o.sidewalk ? SIDEWALK_COLOR : color }));
        });
      }
      if (o.sidewalk) {
        const sw = armW + SIDEWALK_EXTRA * 2;
        art.appendChild(svgEl('rect', { x: cx - sw / 2, y: cy - sw / 2, width: sw, height: sw, fill: SIDEWALK_COLOR }));
        dirs.forEach(d => {
          if (!d.on) return;
          art.appendChild(svgEl('rect', (d.key === 'N' || d.key === 'S')
            ? { x: cx - sw / 2, width: sw, y: d.y, height: d.h, fill: SIDEWALK_COLOR }
            : { y: cy - sw / 2, height: sw, x: d.x, width: d.w, fill: SIDEWALK_COLOR }));
        });
      }
      art.appendChild(svgEl('rect', { x: cx - armW / 2, y: cy - armW / 2, width: armW, height: armW, fill: color }));
      dirs.forEach(d => { if (d.on) art.appendChild(svgEl('rect', { x: d.x, y: d.y, width: d.w, height: d.h, fill: color })); });
      if (o.laneLines) {
        dirs.forEach(d => {
          if (!d.on) return;
          const a = { N: [cx, r * CELL, cx, cy], S: [cx, cy, cx, (r + 1) * CELL], W: [c * CELL, cy, cx, cy], E: [cx, cy, (c + 1) * CELL, cy] }[d.key];
          art.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: a[2], y2: a[3], stroke: LANE_COLOR, 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
        });
      }
      if (o.crossings && ['N', 'S', 'E', 'W'].filter(k => on[k]).length >= 3) {
        dirs.forEach(d => {
          if (!d.on) return;
          const n = 4, gap = armW / (n * 2 - 1);
          for (let i = 0; i < n; i++) {
            if (d.key === 'N' || d.key === 'S') {
              art.appendChild(svgEl('rect', { x: cx - armW / 2 + i * gap * 2, y: d.key === 'N' ? cy - armW / 2 - 6 : cy + armW / 2 + 2, width: gap, height: 4, fill: '#ffffff' }));
            } else {
              art.appendChild(svgEl('rect', { y: cy - armW / 2 + i * gap * 2, x: d.key === 'W' ? cx - armW / 2 - 6 : cx + armW / 2 + 2, height: gap, width: 4, fill: '#ffffff' }));
            }
          }
        });
      }
      if (!on.N && !on.S && !on.E && !on.W) {
        if (o.sidewalk) art.appendChild(svgEl('circle', { cx, cy, r: armW / 2 + SIDEWALK_EXTRA, fill: SIDEWALK_COLOR }));
        art.appendChild(svgEl('circle', { cx, cy, r: armW / 2, fill: color }));
      }
    }
    const isPavedNeighbor = cell => (cell.kind === 'building' && !OPEN_AIR.has(cell.symbol)) || (cell.kind === 'special' && cell.special === 'parking');
    function drawBuildingSidewalks(art, r, c, on) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2, sw = ARM_W + SIDEWALK_EXTRA * 2;
      const isBldg = (rr, cc) => inGrid(rr, cc) && isPavedNeighbor(grid[rr][cc]);
      ['N', 'S', 'E', 'W'].forEach(dir => {
        const [dr, dc] = DIRVEC[dir];
        if (!isBldg(r + dr, c + dc)) return;
        if (dir === 'N' || dir === 'S') {
          const left = on.W ? x0 : cx - sw / 2, right = on.E ? x0 + CELL : cx + sw / 2;
          art.appendChild(svgEl('rect', { x: left, width: right - left, y: dir === 'N' ? y0 : cy, height: CELL / 2, fill: SIDEWALK_COLOR }));
        } else {
          const top = on.N ? y0 : cy - sw / 2, bottom = on.S ? y0 + CELL : cy + sw / 2;
          art.appendChild(svgEl('rect', { y: top, height: bottom - top, x: dir === 'W' ? x0 : cx, width: CELL / 2, fill: SIDEWALK_COLOR }));
        }
      });
      const side = dir => { const [dr, dc] = DIRVEC[dir]; return isBldg(r + dr, c + dc) ? 'bldg' : (on[dir] ? 'arm' : null); };
      [['N', 'E'], ['N', 'W'], ['S', 'E'], ['S', 'W']].forEach(([d1, d2]) => {
        const s1 = side(d1), s2 = side(d2);
        if (!s1 || !s2) return;
        const diag = isBldg(r + DIRVEC[d1][0] + DIRVEC[d2][0], c + DIRVEC[d1][1] + DIRVEC[d2][1]);
        if (s1 !== 'bldg' && s2 !== 'bldg' && !diag) return;
        art.appendChild(svgEl('rect', { x: d2 === 'E' ? cx : x0, y: d1 === 'S' ? cy : y0, width: CELL / 2, height: CELL / 2, fill: SIDEWALK_COLOR }));
      });
    }
    function extendStraightToGridEdge(r, c, on) {
      const connected = ['N', 'S', 'E', 'W'].filter(k => on[k]);
      if (connected.length !== 1) return;
      const opp = OPPOSITE[connected[0]];
      if ((opp === 'N' && r === 0) || (opp === 'S' && r === ROWS - 1) || (opp === 'W' && c === 0) || (opp === 'E' && c === COLS - 1)) on[opp] = true;
    }
    function extendWaterToGridEdges(r, c, on) {
      if (r === 0) on.N = true;
      if (r === ROWS - 1) on.S = true;
      if (c === 0) on.W = true;
      if (c === COLS - 1) on.E = true;
    }

    // ── railroad ──
    function drawTracks(art, tracks) {
      const normalAt = (pts, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        return { x: -dy / len, y: dx / len, tx: dx / len, ty: dy / len };
      };
      tracks.forEach(t => {
        if (t.ballast === false) return;
        art.appendChild(svgEl('path', { d: polyD(t.pts), fill: 'none', stroke: BALLAST_COLOR, 'stroke-width': BALLAST_W, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }));
      });
      tracks.forEach(t => {
        const cum = [0];
        for (let i = 1; i < t.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(t.pts[i].x - t.pts[i - 1].x, t.pts[i].y - t.pts[i - 1].y));
        const L = cum[cum.length - 1], n = Math.max(1, Math.round(L / TIE_SPACING));
        for (let k = 0; k < n; k++) {
          const s = (k + 0.5) * L / n;
          let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
          const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
          const p = { x: t.pts[i - 1].x + (t.pts[i].x - t.pts[i - 1].x) * f, y: t.pts[i - 1].y + (t.pts[i].y - t.pts[i - 1].y) * f };
          const dx = t.pts[i].x - t.pts[i - 1].x, dy = t.pts[i].y - t.pts[i - 1].y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
          art.appendChild(svgEl('line', { x1: p.x - nx * TIE_LEN / 2, y1: p.y - ny * TIE_LEN / 2, x2: p.x + nx * TIE_LEN / 2, y2: p.y + ny * TIE_LEN / 2, stroke: TIE_COLOR, 'stroke-width': TIE_W }));
        }
      });
      tracks.forEach(t => {
        const pts = t.pts.slice();
        [-1, 1].forEach(side => {
          const off = pts.map((p, i) => { const n = normalAt(pts, i); return { x: p.x + n.x * side * RAIL_GAUGE / 2, y: p.y + n.y * side * RAIL_GAUGE / 2 }; });
          art.appendChild(svgEl('path', { d: polyD(off), fill: 'none', stroke: RAIL_COLOR, 'stroke-width': 2.5, 'stroke-linecap': 'butt' }));
        });
      });
    }
    function railCurvePts(r, c, d1, d2) {
      const a = edgeMid(r, c, d1), b = edgeMid(r, c, d2);
      const px = (d1 === 'E' || d2 === 'E' ? c + 1 : c) * CELL, py = (d1 === 'S' || d2 === 'S' ? r + 1 : r) * CELL, R = CELL / 2;
      const a0 = Math.atan2(a.y - py, a.x - px);
      let d = Math.atan2(b.y - py, b.x - px) - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const pts = [];
      for (let i = 0; i <= 16; i++) { const th = a0 + d * i / 16; pts.push({ x: px + R * Math.cos(th), y: py + R * Math.sin(th) }); }
      return pts;
    }
    function drawRailTile(art, r, c, on) {
      const cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
      const dirs = ['N', 'S', 'E', 'W'].filter(k => on[k]);
      if (dirs.length >= 2) {
        const tracks = [];
        if (on.N && on.S) tracks.push({ pts: [edgeMid(r, c, 'N'), edgeMid(r, c, 'S')] });
        if (on.E && on.W) tracks.push({ pts: [edgeMid(r, c, 'W'), edgeMid(r, c, 'E')] });
        [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']].forEach(([d1, d2]) => { if (on[d1] && on[d2]) tracks.push({ pts: railCurvePts(r, c, d1, d2) }); });
        drawTracks(art, tracks);
        return;
      }
      if (dirs.length === 0) {
        drawTracks(art, [{ pts: [{ x: cx - CELL * 0.3, y: cy }, { x: cx + CELL * 0.3, y: cy }] }]);
        [-1, 1].forEach(s => art.appendChild(svgEl('rect', { x: cx + s * CELL * 0.3 - (s > 0 ? 4 : 0), y: cy - TIE_LEN / 2, width: 4, height: TIE_LEN, fill: '#c0392b', rx: 1 })));
        return;
      }
      drawTracks(art, dirs.map(k => ({ pts: [edgeMid(r, c, k), { x: cx, y: cy }] })));
      const vertical = dirs[0] === 'N' || dirs[0] === 'S';
      art.appendChild(svgEl('rect', vertical
        ? { x: cx - TIE_LEN / 2, y: cy - 2, width: TIE_LEN, height: 4, fill: '#c0392b', rx: 1 }
        : { x: cx - 2, y: cy - TIE_LEN / 2, width: 4, height: TIE_LEN, fill: '#c0392b', rx: 1 }));
    }

    // ── bridges, tunnels, parking, crossings ──
    function drawBridgeWater(art, r, c, ends, deckW) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2;
      ends.forEach(dir => {
        const [dr, dc] = DIRVEC[dir], nr = r + dr, nc = c + dc;
        if (!carriesWater(nr, nc)) return;
        art.appendChild(svgEl('rect', Object.assign({ fill: RIVER_COLOR }, {
          N: { x: x0, y: y0, width: CELL, height: CELL / 2 }, S: { x: x0, y: cy, width: CELL, height: CELL / 2 },
          W: { x: x0, y: y0, width: CELL / 2, height: CELL }, E: { x: cx, y: y0, width: CELL / 2, height: CELL }
        }[dir])));
        if (isWaterBridge(grid[nr][nc])) {
          const pw = deckW + 12, pt = 4;
          art.appendChild(svgEl('rect', Object.assign({ fill: SIDEWALK_COLOR }, {
            N: { x: cx - pw / 2, y: y0, width: pw, height: pt }, S: { x: cx - pw / 2, y: y0 + CELL - pt, width: pw, height: pt },
            W: { x: x0, y: cy - pw / 2, width: pt, height: pw }, E: { x: x0 + CELL - pt, y: cy - pw / 2, width: pt, height: pw }
          }[dir])));
        }
      });
    }
    function drawSpecialTile(art, r, c, special) {
      const x0 = c * CELL, y0 = r * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2;
      if (special === 'parking') {
        art.appendChild(svgEl('rect', { x: x0, y: y0, width: CELL, height: CELL, fill: SIDEWALK_COLOR }));
        const bays = 4, bayDepth = CELL * 0.27, bayW = CELL / bays;
        for (let i = 0; i <= bays; i++) {
          const x = x0 + i * bayW;
          art.appendChild(svgEl('line', { x1: x, x2: x, y1: y0, y2: y0 + bayDepth, stroke: '#f7f6f2', 'stroke-width': 2 }));
          art.appendChild(svgEl('line', { x1: x, x2: x, y1: y0 + CELL - bayDepth, y2: y0 + CELL, stroke: '#f7f6f2', 'stroke-width': 2 }));
        }
        return;
      }
      if (special.indexOf('railbridge-') === 0 || special.indexOf('railcross-') === 0) {
        const g = svgEl('g', special.endsWith('-v') ? { transform: `rotate(90 ${cx} ${cy})` } : {});
        art.appendChild(g);
        const track = { pts: [{ x: x0, y: cy }, { x: x0 + CELL, y: cy }] };
        if (special.indexOf('railbridge-') === 0) {
          g.appendChild(svgEl('rect', { x: cx - RIVER_ARM_W / 2, y: y0, width: RIVER_ARM_W, height: CELL, fill: RIVER_COLOR }));
          const deckW = BALLAST_W + 6, wet = svgEl('g', {});
          art.insertBefore(wet, g);
          drawBridgeWater(wet, r, c, special.endsWith('-v') ? ['N', 'S'] : ['E', 'W'], deckW);
          g.appendChild(svgEl('rect', { x: x0, y: cy - deckW / 2, width: CELL, height: deckW, fill: '#8a6d3b' }));
          [-1, 1].forEach(s => g.appendChild(svgEl('line', { x1: x0, x2: x0 + CELL, y1: cy + s * deckW / 2, y2: cy + s * deckW / 2, stroke: '#5c4626', 'stroke-width': 3 })));
          drawTracks(g, [Object.assign(track, { ballast: false })]);
          return;
        }
        const sw = ARM_W + SIDEWALK_EXTRA * 2, gap = BALLAST_W / 2 + 7;
        g.appendChild(svgEl('rect', { x: x0, y: cy - BALLAST_W / 2, width: CELL, height: BALLAST_W, fill: BALLAST_COLOR }));
        drawTracks(g, [{ pts: track.pts, ballast: false }]);
        g.appendChild(svgEl('rect', { x: cx - sw / 2, y: y0, width: sw, height: CELL, fill: SIDEWALK_COLOR }));
        g.appendChild(svgEl('rect', { x: cx - ARM_W / 2, y: y0, width: ARM_W, height: CELL, fill: ROAD_COLOR }));
        g.appendChild(svgEl('line', { x1: cx, x2: cx, y1: y0, y2: cy - gap, stroke: LANE_COLOR, 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
        g.appendChild(svgEl('line', { x1: cx, x2: cx, y1: y0 + CELL, y2: cy + gap, stroke: LANE_COLOR, 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
        [-1, 1].forEach(s => g.appendChild(svgEl('rect', { x: cx - ARM_W / 2, y: cy + s * (BALLAST_W / 2 + 3) - 1.5, width: ARM_W, height: 3, fill: '#ffffff' })));
        [-1, 1].forEach(s => g.appendChild(svgEl('line', { x1: x0, x2: x0 + CELL, y1: cy + s * RAIL_GAUGE / 2, y2: cy + s * RAIL_GAUGE / 2, stroke: RAIL_COLOR, 'stroke-width': 2.5 })));
        return;
      }
      if (special === 'bridge-h' || special === 'bridge-v') {
        const sw = ARM_W + SIDEWALK_EXTRA * 2, h = special === 'bridge-h';
        art.appendChild(svgEl('rect', h
          ? { x: cx - RIVER_ARM_W / 2, y: y0, width: RIVER_ARM_W, height: CELL, fill: RIVER_COLOR }
          : { x: x0, y: cy - RIVER_ARM_W / 2, width: CELL, height: RIVER_ARM_W, fill: RIVER_COLOR }));
        drawBridgeWater(art, r, c, h ? ['E', 'W'] : ['N', 'S'], sw);
        art.appendChild(svgEl('rect', h ? { x: x0, y: cy - sw / 2, width: CELL, height: sw, fill: SIDEWALK_COLOR } : { x: cx - sw / 2, y: y0, width: sw, height: CELL, fill: SIDEWALK_COLOR }));
        art.appendChild(svgEl('rect', h ? { x: x0, y: cy - ARM_W / 2, width: CELL, height: ARM_W, fill: '#8a6d3b' } : { x: cx - ARM_W / 2, y: y0, width: ARM_W, height: CELL, fill: '#8a6d3b' }));
        [-1, 1].forEach(s => art.appendChild(svgEl('line', h
          ? { x1: x0, x2: x0 + CELL, y1: cy + s * ARM_W / 2, y2: cy + s * ARM_W / 2, stroke: '#5c4626', 'stroke-width': 3 }
          : { y1: y0, y2: y0 + CELL, x1: cx + s * ARM_W / 2, x2: cx + s * ARM_W / 2, stroke: '#5c4626', 'stroke-width': 3 })));
        return;
      }
      // tunnel: a road stub running into a hill, with an arched portal
      const entranceDir = { 'tunnel-n': 'N', 'tunnel-s': 'S', 'tunnel-e': 'E', 'tunnel-w': 'W' }[special];
      const farDir = OPPOSITE[entranceDir], ht = CELL * 0.58;
      let nearEdge, hill;
      if (farDir === 'N') { hill = { x: x0, y: y0, width: CELL, height: ht }; nearEdge = y0 + ht; }
      if (farDir === 'S') { hill = { x: x0, y: y0 + CELL - ht, width: CELL, height: ht }; nearEdge = y0 + CELL - ht; }
      if (farDir === 'W') { hill = { x: x0, y: y0, width: ht, height: CELL }; nearEdge = x0 + ht; }
      if (farDir === 'E') { hill = { x: x0 + CELL - ht, y: y0, width: ht, height: CELL }; nearEdge = x0 + CELL - ht; }
      art.appendChild(svgEl('rect', Object.assign({ fill: '#7a5c3e' }, hill)));
      const on = { N: false, S: false, E: false, W: false };
      on[entranceDir] = true;
      drawArmSet(art, cx, cy, r, c, on, ARM_W, ROAD_COLOR, { sidewalk: true, laneLines: true });
      const archW = ARM_W * 1.5 * 1.1 * 1.05, archH = ARM_W * 1.15 * 1.1 * 1.05, rad = archW / 2;
      let d;
      if (entranceDir === 'S') { const l = cx - archW / 2, rt = cx + archW / 2, m = nearEdge - (archH - rad); d = `M ${l} ${nearEdge} L ${l} ${m} A ${rad} ${rad} 0 0 1 ${rt} ${m} L ${rt} ${nearEdge} Z`; }
      else if (entranceDir === 'N') { const l = cx - archW / 2, rt = cx + archW / 2, m = nearEdge + (archH - rad); d = `M ${l} ${nearEdge} L ${l} ${m} A ${rad} ${rad} 0 0 0 ${rt} ${m} L ${rt} ${nearEdge} Z`; }
      else if (entranceDir === 'E') { const t = cy - archW / 2, b = cy + archW / 2, m = nearEdge - (archH - rad); d = `M ${nearEdge} ${t} L ${m} ${t} A ${rad} ${rad} 0 0 0 ${m} ${b} L ${nearEdge} ${b} Z`; }
      else { const t = cy - archW / 2, b = cy + archW / 2, m = nearEdge + (archH - rad); d = `M ${nearEdge} ${t} L ${m} ${t} A ${rad} ${rad} 0 0 1 ${m} ${b} L ${nearEdge} ${b} Z`; }
      art.appendChild(svgEl('path', { d, fill: '#241a10' }));
    }

    function drawTile(art, r, c) {
      const cell = grid[r][c], cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
      if (cell.kind === 'special') { drawSpecialTile(art, r, c, cell.special); return; }
      if (cell.kind === 'road') {
        const on = neighbors(r, c, roadConnectsToward);
        extendStraightToGridEdge(r, c, on);
        drawBuildingSidewalks(art, r, c, on);
        drawArmSet(art, cx, cy, r, c, on, ARM_W, ROAD_COLOR, { sidewalk: true, laneLines: true, crossings: true, cornerFillKind: 'road' });
        return;
      }
      if (cell.kind === 'rail') {
        const on = neighbors(r, c, railConnectsToward);
        extendStraightToGridEdge(r, c, on);
        drawRailTile(art, r, c, on);
        return;
      }
      if (cell.kind === 'river') {
        const on = neighbors(r, c, riverConnectsToward);
        extendWaterToGridEdges(r, c, on);
        drawRiverTile(art, r, c, on);
        drawFerryDocks(art, r, c, on);
      }
    }

    // ── assemble ──
    const W = COLS * CELL, H = ROWS * CELL;
    const pinnedTop = grid[0].some(cell => cell.kind === 'building' && cell.pin);
    const top = pinnedTop ? 40 : 0;
    const svg = svgEl('svg', { class: 'city-pic', viewBox: `0 ${-top} ${W} ${H + top}`, role: 'img', 'aria-label': opts.alt || 'A map of a neighborhood' });

    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#8bc76b' }));
    // ground colours
    TERRAIN_ORDER.forEach(t => {
      if (!grid.some(row => row.some(cell => cell.terrain === t))) return;
      const at = (r, c) => grid[Math.max(0, Math.min(ROWS - 1, r))][Math.max(0, Math.min(COLS - 1, c))].terrain === t;
      const clX = x => Math.max(0, Math.min(W, x)), clY = y => Math.max(0, Math.min(H, y));
      let d = '';
      for (let i = -1; i < ROWS; i++) for (let j = -1; j < COLS; j++) {
        const x0 = j * CELL + CELL / 2, y0 = i * CELL + CELL / 2;
        const poly = terrainPolygon(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j), x0, y0, x0 + CELL, y0 + CELL);
        if (!poly) continue;
        const qx = clX(x0 + CELL / 2), qy = clY(y0 + CELL / 2);
        d += 'M' + clX(poly[0][0]) + ' ' + clY(poly[0][1]);
        for (let k = 1; k <= poly.length; k++) {
          const a = poly[k - 1], b = poly[k % poly.length];
          d += (a[2] && b[2]) ? `Q${qx} ${qy} ${clX(b[0])} ${clY(b[1])}` : `L${clX(b[0])} ${clY(b[1])}`;
        }
        d += 'Z';
      }
      svg.appendChild(svgEl('path', { d, fill: TERRAINS[t], stroke: TERRAINS[t], 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    });
    if (opts.grid !== false) {
      for (let i = 1; i < COLS; i++) svg.appendChild(svgEl('line', { x1: i * CELL, x2: i * CELL, y1: 0, y2: H, stroke: 'rgba(0,0,0,0.17)', 'stroke-width': 1.5, 'stroke-dasharray': '2 6' }));
      for (let i = 1; i < ROWS; i++) svg.appendChild(svgEl('line', { y1: i * CELL, y2: i * CELL, x1: 0, x2: W, stroke: 'rgba(0,0,0,0.17)', 'stroke-width': 1.5, 'stroke-dasharray': '2 6' }));
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c], g = svgEl('g', {});
      if (cell.kind === 'building') {
        if (!OPEN_AIR.has(cell.symbol)) g.appendChild(svgEl('rect', { x: c * CELL + 1, y: r * CELL + 1, width: CELL - 2, height: CELL - 2, fill: '#f7f7f8', stroke: '#e3e3e6', 'stroke-width': 1.5 }));
        const t = svgEl('text', { class: 'city-place', x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        t.textContent = cell.symbol;
        g.appendChild(t);
      } else if (cell.kind) {
        drawTile(g, r, c);
      }
      svg.appendChild(g);
    }
    // labels over everything but the pins
    const labelAt = (x, y, text, vertical) => {
      const t = svgEl('text', { class: 'city-label', x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      if (vertical) t.setAttribute('transform', `rotate(-90, ${x}, ${y})`);
      t.textContent = text;
      svg.appendChild(t);
    };
    (city.labels || []).forEach(l => { if (l && l.text) labelAt(Number(l.x), Number(l.y), String(l.text), l.orientation === 'v'); });
    (opts.labels || []).forEach(l => labelAt(l.c * CELL + CELL / 2, l.r * CELL + CELL / 2, String(l.text), l.orientation === 'v'));
    // pins on top of everything
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.kind !== 'building' || !cell.pin) continue;
      const p = svgEl('text', { class: 'city-pin', x: c * CELL + CELL / 2, y: r * CELL - CELL * 0.1, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'filter:' + pinFilter(PIN_COLORS[cell.pin]) });
      p.textContent = PIN_SYMBOL;
      svg.appendChild(p);
    }
    return svg;
  }

  function pictureSvg(city, opts) {
    injectStyles();
    return render(city, opts).outerHTML;
  }
  function pictureDraw(el, city, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    injectStyles();
    const svg = render(city, opts);
    el.innerHTML = '';
    el.appendChild(svg);
    return svg;
  }

  /* CityPicture.map(spec) — the quick way to write a small map for a lesson.
     It returns an ordinary playground save file.

       CityPicture.map({
         rows: [
           'R  R  R  R  R',
           '🏠 .  🌳 R  🏪',
           '🏠@red 🏠 . R  🅿️'
         ],
         ground: ['.  .  sand …']        // optional, same grid: dirt / sand / snow
       });

     One token per square, separated by spaces:
       .  grass        R  road         T  railroad      W  water
       BH / BV  road bridge (horizontal / vertical road)
       RBH / RBV  rail bridge     XH / XV  level crossing (track horizontal / vertical)
       P  parking lot  TN TE TS TW  tunnel (entrance side)
       anything else is a place: its emoji. Add @colour for a pin (🏠@red).
     Trees, fields, farm animals and tractors (🌳 🌲 🌾 🐄 🐑 🚜 …) are drawn
     straight on the ground, with no white place tile under them. */
  const TOKEN = {
    R: { kind: 'road' }, T: { kind: 'rail' }, W: { kind: 'river' },
    BH: { kind: 'special', special: 'bridge-h' }, BV: { kind: 'special', special: 'bridge-v' },
    RBH: { kind: 'special', special: 'railbridge-h' }, RBV: { kind: 'special', special: 'railbridge-v' },
    XH: { kind: 'special', special: 'railcross-h' }, XV: { kind: 'special', special: 'railcross-v' },
    P: { kind: 'special', special: 'parking' },
    TN: { kind: 'special', special: 'tunnel-n' }, TE: { kind: 'special', special: 'tunnel-e' },
    TS: { kind: 'special', special: 'tunnel-s' }, TW: { kind: 'special', special: 'tunnel-w' }
  };
  function map(spec) {
    const rows = (spec.rows || []).map(s => String(s).trim().split(/\s+/));
    const cols = Math.max(...rows.map(r => r.length));
    const ground = (spec.ground || []).map(s => String(s).trim().split(/\s+/));
    const cells = [];
    rows.forEach((row, r) => row.forEach((tok, c) => {
      const g = ground[r] && ground[r][c];
      const terrain = TERRAINS[g] ? g : undefined;
      let cell = null;
      if (tok !== '.' && tok) {
        if (TOKEN[tok]) cell = Object.assign({ r, c }, TOKEN[tok]);
        else {
          const [symbol, pin] = tok.split('@');
          cell = { r, c, kind: 'building', symbol };
          if (PIN_COLORS[pin]) cell.pin = pin;
        }
      }
      if (terrain) cell = Object.assign(cell || { r, c, kind: null }, { terrain });
      if (cell) cells.push(cell);
    }));
    return { app: 'city-playground', version: 1, cols, rows: rows.length, cells, labels: spec.labels || [] };
  }

  global.CityPicture = { svg: pictureSvg, draw: pictureDraw, map, PIN_COLORS: Object.keys(PIN_COLORS) };
})(window);

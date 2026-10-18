/* ══════════════════════════════════════════════════════════════════════════
   house-character-3d.js — people from house-character.js standing in the
   3D isometric houses drawn by house-engine.js.

   It changes neither file. Load it after both:

     <script src="house.js"></script>
     <script src="house-engine.js"></script>
     <script src="house-character.js"></script>
     <script src="house-character-3d.js"></script>

     HouseCharacter3D.svg(house, people, opts)       → '<svg>…</svg>'
     HouseCharacter3D.draw(el, house, people, opts)  → renders into el, returns the <svg>

   house   a saved House Builder file (or HousePicture.room(…) / .house(…))
   people  [{ character,        a HouseCharacter object (saved JSON is fine)
              x, y,             where the feet are, in metres (any value, not just grid spots)
              level: 0,         the floor they stand on
              facing: 'S',      N / E / S / W / NE … or degrees clockwise from north
              z: 0,             stand this much higher (a step, a stage)
              seat: i,          sitting on furniture number i of that floor. x, y and facing
                                may then be left out: the person is put on the seat, facing
                                the way it faces, hips at its seat height
              place: 0,         which cushion of a sofa (0 = the left one seen from the front)
              bed: i,           asleep in bed number i of that floor: lying on the mattress,
                                head on the pillow, eyes closed, under the duvet
              side: 0 | 1,      which half of a double bed (left / right seen from its foot)
              tag: '…' }]       a name tag above the head ('' for none; see opts.tags)
   opts    everything HousePicture.svg takes (rot, level, walls, keep, roofs,
           labels, focus, aspect, box, alt), plus
             tags   true  write each person's name above their head
             line   0.6   outline width of the people, in screen pixels
             shadow false no soft shadow under the feet
             turn   45    trunk turn for the three-quarter view (also per person)
             joints 1     share of the floor slope taken by re-aiming the bones (0–1, see 2b)
             split  1     the split skew: both halves of the body lifted from the centre line (0–1)
             flat   true  keep the authored pose (no retargeting, no split)
             back   false never use the back view

   HOW IT WORKS
   1. Each person is a flat picture (a billboard) drawn by HouseCharacter.render,
      stood at its feet point with engine.scr() and scaled so one metre of
      person is one metre of house (ZS ≈ 39.2 px per metre up).
   2. Facing: every compass direction is a diagonal on screen, so the trunk
      turns 45° (torsoOrientation and pelvisOrientation ±45) toward the side the
      person faces. People facing away use house-character.js's back view
      (back: true). That view is built as a front view and mirrored, so their
      build faces the other way.
   2b. Fitting the pose to the floor: two components, each with a weight.
      joints 0–1  (default 1) each bone is re-aimed through the camera, so strides,
                  kicks and outstretched arms run along the floor diagonals; standing
                  feet turn the same share to point the way the person faces.
      split  0–1  (default 1) the split skew: the body is cut on its centre line and
                  both halves are lifted away from the cut, at split × the ½
                  isometric slope, so the body shows two faces like a box corner.
                  The crease on the centre line is rounded (a soft absolute value)
                  and the lift levels off smoothly past the shoulders, so no line
                  gets a sharp corner. It reshapes the path geometry itself (see
                  warpBody): shapes become Bézier paths, long segments are
                  subdivided and every point is lifted. Heads stay rigid and ride up
                  with the body; the lift fades out below the knees.
      opts.flat keeps the authored pose as it is.
   3. Depth: the engine has no hook for new drawables, so each person goes
      into the scene as an invisible stand-in piece of furniture with the
      person's footprint (0.4 × 0.4 m) and height. The engine's own painter's
      sort puts it among the walls and furniture; the stand-in's drawing is
      then swapped for the person. The stand-in only lives in this picture's
      own engine instance; the house data is never touched.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const PX_PER_M = 405.33 / 1.72;   // HouseCharacter stage px per metre: an 'Average' person (405 px) is 1.72 m
  const FOOT = 0.4;                  // the stand-in's footprint (m)
  const STAGE_X = 300, STAGE_GROUND = 550;   // HouseCharacter.STAGE
  const DIRS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

  const PIC_STYLE_ID = 'house-character-3d-styles';
  const PIC_CSS = `
.house-pic{ display:block; width:100%; height:auto; background:var(--iso-bg); border-radius:var(--border-radius-lg, 12px); }
.house-pic .lot-line, .house-pic .air-line, .house-pic .air-edge{ display:none; }
.house-pic .pic-label{ font-family:var(--font-sans, sans-serif); font-weight:700; font-size:13px; fill:var(--color-text-primary, #1a1a1a);
  paint-order:stroke; stroke:var(--iso-bg); stroke-width:4px; stroke-linejoin:round; text-anchor:middle; dominant-baseline:central; }
.house-pic .pic-label.pic-num{ font-size:17px; stroke-width:5px; }
.house-pic .hc3d-tag{ font-size:11px; }
`;
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(PIC_STYLE_ID)) return;
    const s = document.createElement('style'); s.id = PIC_STYLE_ID; s.textContent = PIC_CSS; document.head.appendChild(s);
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const facingDeg = f => typeof f === 'number' ? f : (DIRS[String(f || 'S').toUpperCase()] ?? 180);

  /* Camera-relative yaw of a world facing: 0 = looking at the camera,
     +90 = looking to screen right, −90 = screen left, ±180 = away.
     The camera looks from +a +b of the engine's rotated frame. */
  function yawFor(facing, rot) {
    const t = facingDeg(facing) * Math.PI / 180, vx = Math.sin(t), vy = -Math.cos(t);   // north is −y
    const [da, db] = [[vx, vy], [-vy, vx], [-vx, -vy], [vy, -vx]][((rot % 4) + 4) % 4];
    const toward = da + db, right = da - db;
    return Math.atan2(right, toward) * 180 / Math.PI;
  }

  /* screen pixels of one world metre along (vx, vy) — vx east, vy south — for a camera quarter turn */
  const HW = 32, HH = 16, ZS = HW * Math.SQRT2 * Math.cos(Math.PI / 6);
  function screenOf(vx, vy, rot) {
    const [da, db] = [[vx, vy], [-vy, vx], [-vx, -vy], [vy, -vx]][((rot % 4) + 4) % 4];
    return [(da - db) * HW, (da + db) * HH];
  }

  /* Joint retargeting. The flat rig draws every bone in the picture plane: a sideways
     (x) reach is a reach across the screen. In the house that reach runs along a
     world axis, which the dimetric camera shows as a diagonal: one stage px across
     becomes ax px across and ay px down. Each bone keeps its length and takes the
     direction of its projected self, and the joint angles are rebuilt from those. */
  const DOWN = { pelvis: 0, hipL: 0, kneeL: 0, ankleL: 0, hipR: 0, kneeR: 0, ankleR: 0, shoulderL: 0, elbowL: 0, wristL: 0, shoulderR: 0, elbowR: 0, wristR: 0 };
  const CHAINS = [   // [joint, parent bone] — absolute angles are summed down these chains
    ['torso', 'root'], ['neck', 'torso'], ['pelvis', 'root'],
    ['shoulderL', 'torso'], ['elbowL', 'shoulderL'], ['wristL', 'elbowL'],
    ['shoulderR', 'torso'], ['elbowR', 'shoulderR'], ['wristR', 'elbowR'],
    ['hipL', 'pelvis'], ['kneeL', 'hipL'], ['ankleL', 'kneeL'],
    ['hipR', 'pelvis'], ['kneeR', 'hipR'], ['ankleR', 'kneeR']];
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  function retarget(j, ax, ay, keep) {
    const abs = { root: j.root }, out = { root: j.root }, abs2 = { root: j.root };
    CHAINS.forEach(([k, par]) => { abs[k] = abs[par] + j[k]; });
    CHAINS.forEach(([k, par]) => {
      let A = abs[k];
      if (!keep || !keep.includes(k)) {
        const up = !(k in DOWN), r = rad(A);
        const vx = up ? Math.sin(r) : -Math.sin(r), vy = up ? -Math.cos(r) : Math.cos(r);
        const x = vx * ax, y = vy + vx * ay;
        A = deg(up ? Math.atan2(x, -y) : Math.atan2(-x, y));
      }
      abs2[k] = A;
      out[k] = A - abs2[par];
    });
    for (const k in out) out[k] = Math.round(((out[k] + 180) % 360 + 360) % 360 - 180);
    return out;
  }

  /* The character as it should be drawn for this facing and camera, and how to warp it.
     opts.turn    how far the trunk turns for a three-quarter view (45)
     opts.flat    true: no joint retargeting and no split
     opts.joints  0–1 (1)  share of the floor slope taken by the bones
     opts.split   0–1 (1)  the split skew (see warpBody)
     opts.back    false: never use the back view (people facing away keep a front body)
     Returns { d, warp: { split } }. */
  function viewPlan(character, facing, rot, opts) {
    opts = opts || {};
    const HC = global.HouseCharacter;
    const d = HC.normalize(character), yaw = yawFor(facing, rot), side = yaw >= 0 ? 1 : -1;
    const toward = Math.abs(yaw) <= 90, profile = Math.abs(d.torsoOrientation) >= 45;
    const canBack = 'back' in HC.defaults() && opts.back !== false;
    const back = !toward && canBack;
    const turn = opts.turn != null ? opts.turn : 45;
    /* The back view is built as a front view and mirrored at the end, so a person whose
       drawing should face screen-right from behind is built facing screen-left. */
    const bs = back ? -side : side;                 // the side the BUILD faces
    if (profile && Math.sign(d.torsoOrientation) !== bs) HC.mirror(d);   // side-view poses face the way they go
    const twist = d.pelvisOrientation - d.torsoOrientation;
    d.torsoOrientation = bs * turn;
    d.pelvisOrientation = clamp(bs * turn + (profile ? twist * Math.sign(bs * d.torsoOrientation) : 0), -90, 90);
    d.back = back;
    if (back) d.head = 'front';   // 'front' + back = the back of the head, also in side-view poses
    else if (profile || !toward || d.head !== 'front') d.head = side > 0 ? 'right' : 'left';
    if (opts.flat) return { d: HC.normalize(d), warp: { split: 0 }, away: !toward };

    // which world axis the drawing's own x axis stands for: the way they face for a
    // side-view pose, their left–right for a front-view pose — as a screen slope
    const t = facingDeg(facing) * Math.PI / 180, fx = Math.sin(t), fy = -Math.cos(t);
    let [sx, sy] = profile ? screenOf(fx, fy, rot) : screenOf(-fy, fx, rot);
    if (sx < 0) { sx = -sx; sy = -sy; }
    const ax = sx / ZS, ay = sy / ZS;
    const w = weights(opts);
    // the build is the mirror image of the screen in the back view: its slope runs the other way
    const m = back ? -1 : 1;
    if (w.joints) {
      const keep = profile ? [] : ['ankleL', 'ankleR'];
      // joints: the bones take this share of the slope, and as much of the squeeze across
      d.joints = retarget(d.joints, 1 - w.joints * (1 - ax), m * w.joints * ay, keep);
      if (!profile) {
        // standing feet turn (by the same share) to point the way the person faces
        const [fsx, fsy] = screenOf(fx, fy, rot), A = m * deg(Math.atan2(-fsx / ZS, fsy / ZS));
        const j = d.joints, wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
        const foot = (hip, knee, ank, out) => {
          const shin = j.root + j.pelvis + j[hip] + j[knee], target = wrap(A + out - shin);
          j[ank] = Math.round(wrap(j[ank] + w.joints * wrap(target - j[ank])));
        };
        if (Math.abs(j.ankleL) < 60 && Math.abs(j.ankleR) < 60) {   // only feet resting on the floor
          const o = 8 * bs * (back ? 1 : toward ? 1 : -1);
          foot('hipL', 'kneeL', 'ankleL', -o);
          foot('hipR', 'kneeR', 'ankleR', o);
        }
      }
    }
    return { d: HC.normalize(d), warp: { split: w.split }, away: !toward };
  }
  /* How much each fitting component does: opts.joints and opts.split, 0–1, both 1 by default. */
  function weights(opts) {
    const num = (v, d) => v == null || isNaN(Number(v)) ? d : Math.max(0, Number(v));
    return { joints: num(opts.joints, 1), split: num(opts.split, 1) };
  }
  const viewData = (character, facing, rot, opts) => viewPlan(character, facing, rot, opts).d;

  /* how far the drawing reaches round its feet point, in stage px (root x, ground y) */
  function extent(d) {
    const vb = global.HouseCharacter.render(d, { fit: true }).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    return { left: vb[0] + 8, right: vb[0] + vb[2] - 8, top: vb[1] + 8, bottom: vb[1] + vb[3] - 8 };
  }


  /* ── Body warp: the split skew, applied to the path geometry itself ───────────────────
     The figure is cut on its centre line (stage x = 300) and both halves are lifted away
     from the cut, at split × the ½ isometric slope: the body shows two faces, like the
     corner of a box seen from above. To keep every line smooth:
       · the crease on the centre line is rounded — a soft absolute value,
         √(dx² + r²) − r, so a line crossing the centre bends in a small arc;
       · past the shoulders the lift levels off with tanh instead of stopping at a
         corner, so outstretched arms are not flung upward;
       · below the knees the lift fades to 0, so feet stay on the floor.
     Every shape is turned into cubic Béziers, long segments are subdivided, and each
     point is lifted. Points are warped in the figure's coordinates and mapped back into
     the shape's own frame, so each shape keeps its transform, its stroke width and its
     pattern. Heads (data-joint="neck") are not bent: they are lifted whole with the body. */
  const BODY_W = 46;        // half-width of the body (stage px): about the shoulders
  const SPLIT_R = 12;       // radius of the rounding on the centre line (stage px)
  const CURVE_FOOT = 110;   // below this height (stage px, about the knees) the lift fades to 0
  const SEG = 6;            // longest segment left unsplit (stage px)
  function liftAt(x, y, wp) {
    const dx = x - STAGE_X, q = Math.sqrt(dx * dx + SPLIT_R * SPLIT_R) - SPLIT_R;   // |dx|, rounded at 0
    const sat = BODY_W * 1.15, a = sat * Math.tanh(q / sat);                       // levels off past the shoulders
    return wp.split * 0.5 * a * clamp((STAGE_GROUND - y) / CURVE_FOOT, 0, 1);
  }

  // 2D affine matrices [a b c d e f]
  const mmul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const minv = m => { const det = m[0] * m[3] - m[1] * m[2]; if (Math.abs(det) < 1e-12) return null;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; };
  const mapPt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  function parseTransform(t) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    for (let k; (k = re.exec(t || ''));) {
      const v = (k[2].match(NUM) || []).map(Number); let n;
      switch (k[1]) {
        case 'matrix': n = v.length === 6 ? v : [1, 0, 0, 1, 0, 0]; break;
        case 'translate': n = [1, 0, 0, 1, v[0] || 0, v[1] || 0]; break;
        case 'scale': n = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]; break;
        case 'rotate': { const r = (v[0] || 0) * Math.PI / 180, c = Math.cos(r), s2 = Math.sin(r), cx = v[1] || 0, cy = v[2] || 0;
          n = mmul(mmul([1, 0, 0, 1, cx, cy], [c, s2, -s2, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]); break; }
        case 'skewX': n = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
        default: n = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }
      m = mmul(m, n);
    }
    return m;
  }
  const attr = (tag, name) => { const k = new RegExp('\\s' + name + '="([^"]*)"').exec(tag); return k ? k[1] : null; };
  const num = (tag, name, d) => { const v = attr(tag, name); return v == null || v === '' ? d : Number(v); };

  /* any path data → subpaths of cubic segments [[x0,y0], [[c1x,c1y,c2x,c2y,x,y]…], closed] */
  function pathToCubics(d) {
    const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    const subs = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null, pc = null, pq = null;
    const n = () => Number(toks[i++]);
    const line = (x1, y1) => { cur.segs.push([x + (x1 - x) / 3, y + (y1 - y) / 3, x + 2 * (x1 - x) / 3, y + 2 * (y1 - y) / 3, x1, y1]); x = x1; y = y1; };
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      let nc = null, nq = null;
      if (C === 'M') { x = n() + ox; y = n() + oy; sx = x; sy = y; cur = { start: [x, y], segs: [], closed: false }; subs.push(cur); cmd = rel ? 'l' : 'L'; }
      else if (C === 'Z') { if (cur) { if (Math.hypot(x - sx, y - sy) > 1e-9) line(sx, sy); cur.closed = true; } x = sx; y = sy; cur = null; }
      else {
        if (!cur) { cur = { start: [x, y], segs: [], closed: false }; subs.push(cur); sx = x; sy = y; }
        if (C === 'L') line(n() + ox, n() + oy);
        else if (C === 'H') line(n() + ox, y);
        else if (C === 'V') line(x, n() + oy);
        else if (C === 'C') { const s = [n() + ox, n() + oy, n() + ox, n() + oy, n() + ox, n() + oy]; cur.segs.push(s); nc = [s[2], s[3]]; x = s[4]; y = s[5]; }
        else if (C === 'S') { const r1 = pc ? [2 * x - pc[0], 2 * y - pc[1]] : [x, y], s = [r1[0], r1[1], n() + ox, n() + oy, n() + ox, n() + oy]; cur.segs.push(s); nc = [s[2], s[3]]; x = s[4]; y = s[5]; }
        else if (C === 'Q' || C === 'T') {
          const q = C === 'Q' ? [n() + ox, n() + oy] : (pq ? [2 * x - pq[0], 2 * y - pq[1]] : [x, y]), x1 = n() + ox, y1 = n() + oy;
          cur.segs.push([x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y), x1 + 2 / 3 * (q[0] - x1), y1 + 2 / 3 * (q[1] - y1), x1, y1]); nq = q; x = x1; y = y1;
        } else if (C === 'A') {
          const rx = Math.abs(n()), ry = Math.abs(n()), phi = n() * Math.PI / 180, fa = n(), fs = n(), x1 = n() + ox, y1 = n() + oy;
          arcToCubics(x, y, rx, ry, phi, fa, fs, x1, y1).forEach(s => cur.segs.push(s)); x = x1; y = y1;
        } else { i++; continue; }   // unknown: skip a token rather than loop forever
      }
      pc = nc; pq = nq;
    }
    return subs;
  }
  function arcToCubics(x0, y0, rx, ry, phi, fa, fs, x1, y1) {
    if (!rx || !ry || (x0 === x1 && y0 === y1)) return [[x0, y0, x1, y1, x1, y1]];
    const c = Math.cos(phi), s = Math.sin(phi), dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
    const xp = c * dx + s * dy, yp = -s * dx + c * dy;
    let l = xp * xp / (rx * rx) + yp * yp / (ry * ry); if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
    const sg = fa === fs ? -1 : 1, num_ = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
    const co = sg * Math.sqrt(Math.max(0, num_ / den)), cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
    const cx = c * cxp - s * cyp + (x0 + x1) / 2, cy = s * cxp + c * cyp + (y0 + y1) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t0 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const nseg = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9), h = dt / nseg, k = 4 / 3 * Math.tan(h / 4), out = [];
    const P = t => [cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
    const D = t => [-rx * Math.sin(t) * c - ry * Math.cos(t) * s, -rx * Math.sin(t) * s + ry * Math.cos(t) * c];
    for (let j = 0; j < nseg; j++) {
      const a = t0 + j * h, b = a + h, pa = P(a), pb = P(b), da = D(a), db = D(b);
      out.push([pa[0] + k * da[0], pa[1] + k * da[1], pb[0] - k * db[0], pb[1] - k * db[1], pb[0], pb[1]]);
    }
    return out;
  }
  // basic shapes as path data, in their own coordinates
  function shapePath(name, tag) {
    if (name === 'path') return attr(tag, 'd') || '';
    if (name === 'rect') {
      const x = num(tag, 'x', 0), y = num(tag, 'y', 0), w = num(tag, 'width', 0), h = num(tag, 'height', 0);
      if (!(w > 0 && h > 0)) return '';
      let rx = attr(tag, 'rx'), ry = attr(tag, 'ry'); rx = rx != null ? Number(rx) : ry != null ? Number(ry) : 0; ry = ry != null ? Number(ry) : rx;
      rx = Math.min(Math.max(0, rx), w / 2); ry = Math.min(Math.max(0, ry), h / 2);
      if (!rx || !ry) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`;
    }
    if (name === 'circle' || name === 'ellipse') {
      const cx = num(tag, 'cx', 0), cy = num(tag, 'cy', 0), rx = name === 'circle' ? num(tag, 'r', 0) : num(tag, 'rx', 0), ry = name === 'circle' ? rx : num(tag, 'ry', 0);
      if (!(rx > 0 && ry > 0)) return '';
      return `M${cx - rx},${cy}A${rx},${ry} 0 0 1 ${cx + rx},${cy}A${rx},${ry} 0 0 1 ${cx - rx},${cy}Z`;
    }
    if (name === 'line') return `M${num(tag, 'x1', 0)},${num(tag, 'y1', 0)}L${num(tag, 'x2', 0)},${num(tag, 'y2', 0)}`;
    if (name === 'polyline' || name === 'polygon') { const v = (attr(tag, 'points') || '').match(NUM) || []; if (v.length < 4) return '';
      let d = `M${v[0]},${v[1]}`; for (let j = 2; j + 1 < v.length; j += 2) d += `L${v[j]},${v[j + 1]}`; return d + (name === 'polygon' ? 'Z' : ''); }
    return null;
  }
  // de Casteljau halving until a segment is short (in figure coordinates)
  function splitSeg(p0, s, m, out, depth) {
    const q = [p0, [s[0], s[1]], [s[2], s[3]], [s[4], s[5]]].map(([x, y]) => mapPt(m, x, y));
    const len = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]) + Math.hypot(q[3][0] - q[2][0], q[3][1] - q[2][1]);
    if (len <= SEG || depth > 7) { out.push(s); return; }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], P0 = p0, P1 = [s[0], s[1]], P2 = [s[2], s[3]], P3 = [s[4], s[5]];
    const a = mid(P0, P1), b = mid(P1, P2), c = mid(P2, P3), d = mid(a, b), e = mid(b, c), f = mid(d, e);
    splitSeg(P0, [a[0], a[1], d[0], d[1], f[0], f[1]], m, out, depth + 1);
    splitSeg(f, [e[0], e[1], c[0], c[1], P3[0], P3[1]], m, out, depth + 1);
  }
  function warpPath(d, m, wp) {
    const inv = minv(m); if (!inv) return null;
    const W = (x, y) => { const g = mapPt(m, x, y); return mapPt(inv, g[0], g[1] - liftAt(g[0], g[1], wp)); };
    const f = v => +v.toFixed(2);
    return pathToCubics(d).map(sp => {
      const segs = []; let p = sp.start;
      sp.segs.forEach(s => { splitSeg(p, s, m, segs, 0); p = [s[4], s[5]]; });
      const st = W(...sp.start);
      return `M${f(st[0])},${f(st[1])}` + segs.map(s => { const a = W(s[0], s[1]), b = W(s[2], s[3]), c = W(s[4], s[5]);
        return `C${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${f(c[0])},${f(c[1])}`; }).join('') + (sp.closed ? 'Z' : '');
    }).join('');
  }
  const GEOM = { path: ['d'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'] };
  const OPAQUE = new Set(['defs', 'pattern', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'filter', 'svg', 'text', 'marker', 'symbol', 'title']);
  /* walk the drawing's markup, keeping the transform stack; bend shapes, lift heads whole */
  function warpBody(art, wp, headX) {
    const stack = [{ m: [1, 0, 0, 1, 0, 0], rigid: false, skip: 0 }], headLift = liftAt(headX, -1e6, wp);
    return art.replace(/<(\/?)([a-zA-Z]+)((?:\s+[^\s=>\/]+="[^"]*")*)\s*(\/?)>/g, (tag, close, name, attrs, self) => {
      const top = stack[stack.length - 1];
      if (close) { if (stack.length > 1) stack.pop(); return tag; }
      if (top.skip || OPAQUE.has(name)) { if (!self) stack.push({ m: top.m, rigid: top.rigid, skip: 1 }); return tag; }
      const own = parseTransform(attr(tag, 'transform')), m = mmul(top.m, own);
      if (name === 'g') {
        let out = tag, rigid = top.rigid;
        if (!rigid && /\sdata-joint="neck"/.test(tag)) {
          rigid = true;   // the head: lifted whole, in figure coordinates (prepended to its own transform)
          out = /\stransform="/.test(tag) ? tag.replace(/\stransform="/, ` transform="translate(0 ${(-headLift).toFixed(3)}) `) : tag.replace(/^<g/, `<g transform="translate(0 ${(-headLift).toFixed(3)})"`);
        }
        if (!self) stack.push({ m, rigid, skip: 0 });
        return out;
      }
      if (!self) stack.push({ m, rigid: top.rigid, skip: 0 });
      if (top.rigid || !GEOM[name]) return tag;
      const d0 = shapePath(name, tag); if (!d0) return tag;
      const d1 = warpPath(d0, m, wp); if (d1 == null) return tag;
      let rest = attrs; GEOM[name].concat(name === 'path' ? [] : []).forEach(k => { rest = rest.replace(new RegExp('\\s' + k + '="[^"]*"'), ''); });
      // an open shape that was a <line>/<polyline> has no fill of its own
      const fillNone = (name === 'line' || name === 'polyline') && !/\sfill="/.test(rest) ? ' fill="none"' : '';
      return `<path d="${d1}"${rest}${fillNone}${self ? '/' : ''}>` + (self ? '' : '');
    }).replace(/<\/(rect|circle|ellipse|line|polyline|polygon)>/g, '</path>');
  }

  /* Where a person sits on a piece of furniture: sitting back, with the hips placed so the
     knees come to the seat's front edge (thigh = the sitter's own thigh length, in metres),
     never closer than 5 cm to the backrest; on a sofa, on cushion number `place`. At the
     seat's height, facing the way the seat faces. Frame: u across, v from back to front. */
  function seatSpot(eng, f, place, thigh) {
    const F = eng.FURN[f.type], lv = (F.levels || [])[0];
    const z = lv ? lv.z : F.h * 0.5;
    let u = 0, back = -F.d / 2, front = F.d / 2;
    if (f.type === 'chair') { back = -0.185; front = 0.225; }
    else if (f.type === 'officechair') { back = -0.22; front = 0.25; }
    else if (eng.isSofa(f.type)) {
      const a = 0.16, bd = 0.2, cw = (F.w - 2 * a) / F.seats, k = clamp(Math.round(place || 0), 0, F.seats - 1);
      u = -F.w / 2 + a + (k + 0.5) * cw; back = -F.d / 2 + bd; front = F.d / 2;
    }
    const v = clamp(front - (thigh || 0.37) + 0.02, back + 0.05, back + 0.25);
    const [x, y] = eng.furnPt(f, u, v);
    return { x, y, z, facing: ['N', 'E', 'S', 'W'][f.dir || 0] };
  }

  /* The parts of a seat that stand between the viewer and a sitter facing away, as screen
     outlines. body: the backrest, and on a sofa or armchair also the armrest nearer the
     viewer — they hide the sitter's back. legs: every real part of the seat (seat, legs or
     base, cushions, back, arms): the shins and feet hang down behind them, and show only
     through the open space under a chair. (Only rig parts below the knee use it.) Box sizes are the engine's own
     (furnParts in house-engine.js), as [u0, u1, v0, v1, z0, z1] in the piece's frame. */
  function occluders(eng, f, L) {
    if (!f) return { body: [], legs: [] };
    const F = eng.FURN[f.type], body = [], legs = [];
        if (f.type === 'chair') {
      body.push([-0.225, 0.225, -0.225, -0.185, 0.47, 0.92]);
      legs.push([-0.225, 0.225, -0.225, 0.225, 0.43, 0.47], ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * 0.19 - 0.02, a * 0.19 + 0.02, b * 0.19 - 0.02, b * 0.19 + 0.02, 0, 0.43]));   // the seat and the four legs
    } else if (f.type === 'officechair') {
      body.push([-0.22, 0.22, -0.28, -0.22, 0.56, 1.05]);
      legs.push([-0.24, 0.24, -0.22, 0.25, 0.42, 0.5], [-0.025, 0.025, -0.025, 0.025, 0.06, 0.42], [-0.28, 0.28, -0.03, 0.03, 0.02, 0.06], [-0.03, 0.03, -0.28, 0.28, 0.02, 0.06]);   // seat, post, base
    } else if (eng.isSofa(f.type)) {
      const hw = F.w / 2, hd = F.d / 2, a = 0.16, bd = 0.2;
      const back = [-hw, hw, -hd, -hd + bd, 0.24, 0.82], arms = [[-hw, -hw + a, -hd + bd, hd, 0.24, 0.6], [hw - a, hw, -hd + bd, hd, 0.24, 0.6]];
      const depth = b => eng.scr(...eng.furnPt(f, (b[0] + b[1]) / 2, (b[2] + b[3]) / 2), 0)[1];   // lower on screen = nearer
      body.push(back, depth(arms[0]) > depth(arms[1]) ? arms[0] : arms[1]);
      legs.push([-hw, hw, -hd, hd, 0, 0.24], [-hw + a, hw - a, -hd + bd, hd, 0.24, 0.44], back, ...arms);   // base, cushions, back, arms
    }
    const z0 = eng.baseZ(L), outline = ([u0, u1, v0, v1, za, zb]) => {
      const pts = [];
      [u0, u1].forEach(u => [v0, v1].forEach(v => [za, zb].forEach(z => { const [x, y] = eng.furnPt(f, u, v); pts.push(eng.scr(x, y, z0 + z)); })));
      return hull(pts);
    };
    return { body: body.map(outline), legs: legs.concat(body).map(outline) };
  }
  /* A mask that hides the given screen outlines. `toLocal` maps screen coordinates into the
     user space of the element the mask is set on (a mask works in that space). Masks, not
     clip paths: where two outlines overlap, the overlap stays hidden. */
  function hideMask(id, polys, toLocal) {
    const P = q => 'M' + q.map(pt => { const [x, y] = toLocal ? mapPt(toLocal, pt[0], pt[1]) : pt; return x.toFixed(2) + ' ' + y.toFixed(2); }).join('L') + 'Z';
    const big = [[-1e5, -1e5], [1e5, -1e5], [1e5, 1e5], [-1e5, 1e5]];
    return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-1e6" y="-1e6" width="2e6" height="2e6"><path d="${P(big)}" fill="#fff"/><path d="${polys.map(P).join('')}" fill="#000"/></mask>`;
  }
  /* Put a mask on each lower-leg part of the drawing (rig parts tagged knee… / ankle…).
     outer = the matrix from the drawing's own coordinates to the screen. */
  function maskLowerLegs(art, outer, polys, id) {
    const stack = [outer]; let n = 0, defs = '';
    const out = art.replace(/<(\/?)([a-zA-Z]+)((?:\s+[^\s=>\/]+="[^"]*")*)\s*(\/?)>/g, (tag, close, name, attrs, self) => {
      if (close) { if (stack.length > 1) stack.pop(); return tag; }
      const m = mmul(stack[stack.length - 1], parseTransform(attr(tag, 'transform')));
      if (!self) stack.push(m);
      if (name !== 'g' || !/\sdata-joint="(knee|ankle)[LR]"/.test(tag)) return tag;
      const inv = minv(m); if (!inv) return tag;
      const mid = id + '-' + (n++);
      defs += hideMask(mid, polys, inv);
      return tag.replace(/^<g/, `<g mask="url(#${mid})"`);
    });
    return defs ? `<defs>${defs}</defs>${out}` : out;
  }
  function hull(pts) {   // convex hull, monotone chain
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  /* the <g>…</g> starting at index i, with nested groups counted */
  function groupEnd(s, i) {
    let depth = 0;
    const re = /<g[\s>]|<\/g>/g; re.lastIndex = i;
    for (let m; (m = re.exec(s));) {
      if (m[0] === '</g>') { if (--depth === 0) return re.lastIndex; } else depth++;
    }
    return -1;
  }
  const findGroup = (s, cls) => {
    const i = s.indexOf(`<g class="it ${cls}`);
    return i < 0 ? null : [i, groupEnd(s, i)];
  };

  let seq = 0;

  function pictureSvg(house, people, opts) {
    opts = opts || {}; people = people || [];
    const HC = global.HouseCharacter, HE = global.HouseEngine;
    if (!HC || !HE) throw new Error('HouseCharacter3D needs house-engine.js and house-character.js loaded first.');
    let box = null;
    const eng = HE.create({ setViewBox: (v, b) => { if (v === 'iso') box = b; } });
    injectStyles();
    const st = eng.state;
    const h = eng.validateHouse(Object.assign({ app: 'house-builder', version: 12 }, house));
    st.COLS = h.cols; st.ROWS = h.rows; st.floors = h.floors;
    st.level = opts.level || 0;
    st.rot = ((opts.rot || 0) % 4 + 4) % 4;
    st.showRoofs = !!opts.roofs; st.showCeiling = false; st.showSlabs = true;
    const walls = opts.walls || 'cutout';
    st.wallsDown = walls === 'down'; st.cutout = walls === 'cutout';
    st.keepAmount = opts.keep != null ? opts.keep : 0.12;
    st.currentTool = 'picture'; st.viewMode = 'iso';
    const stBy = {}, rmBy = {};
    eng.LEVELS.forEach(L => { stBy[L] = eng.displayState(L); rmBy[L] = eng.computeAreas(stBy[L].edges); });

    // everyone: their drawing, its size, and a stand-in in the scene for the depth sort
    const scale = eng.ZS / PX_PER_M, line = opts.line != null ? opts.line : 0.6;
    let clashes = 0;
    const who = people.map((p, i) => {
      const L = p.level || 0;
      if (L > st.level || !stBy[L]) return null;   // floors above the one shown are not drawn
      const bed = p.bed != null && st.floors[L] && st.floors[L].furniture[p.bed] && st.floors[L].furniture[p.bed].type === 'bed' ? st.floors[L].furniture[p.bed] : null;
      if (bed) return sleeper(p, i, L, bed);
      const seat = p.seat != null && st.floors[L] ? st.floors[L].furniture[p.seat] : null;
      const thigh = seat ? (() => { const pv = global.HouseCharacter.pivots(p.character); return Math.hypot(pv.kneeL.x - pv.hipL.x, pv.kneeL.y - pv.hipL.y) / PX_PER_M; })() : 0;
      const sp = seat ? seatSpot(eng, seat, p.place, thigh) : null;
      const facing = p.facing != null ? p.facing : sp ? sp.facing : 'S';
      const vp = viewPlan(p.character, facing, st.rot, Object.assign({}, opts, { turn: p.turn != null ? p.turn : opts.turn })), d = vp.d, ex = extent(d);
      const H = (ex.bottom - ex.top) / PX_PER_M;
      const out = { p, i, L, d, ex, H, warp: vp.warp, away: vp.away, x: p.x != null ? p.x : sp ? sp.x : 0, y: p.y != null ? p.y : sp ? sp.y : 0, z: p.z || 0 };
      if (sp) {
        // hips on the cushion: the bottom of the pelvis (just under the hip joints) at the seat's height
        const root = global.HouseCharacter.pivots(d).root, hipH = (STAGE_GROUND - (root.y + 16)) / PX_PER_M;
        out.z += sp.z - hipH;
      }
      if (!stBy[L]) return out;
      const type = 'hc3d_person_' + i;
      eng.FURN[type] = { w: FOOT, d: FOOT, h: H, levels: [{ z: Math.max(0, H + Math.max(0, out.z) - 1.8) }] };
      // a 1.8 m single box on the stand-in, raised so its top is the top of the head: the
      // sort then knows how tall the person is (a stand-in that is too tall is harmless)
      const proxy = { type, X: out.x * 2, Y: out.y * 2, dir: 0, items: [{ type: 'fridge', lvl: 0, slot: 'C', rdir: 0 }] };
      stBy[L].furniture.push({ f: proxy, cls: 'hc3d-ref hc3d-ref-' + i, idx: -1 });
      if (p.seat != null && stBy[L].furniture[p.seat]) stBy[L].furniture[p.seat].cls += ' hc3d-seat-' + i;
      else {
        const prev = st.level; st.level = L;
        if (!eng.furnValid(proxy, L)) { clashes++; console.warn('HouseCharacter3D: ' + (out.d.name || 'a person') + ' is standing in something (a wall, furniture or stairs).'); }
        st.level = prev;
      }
      return out;
    }).filter(Boolean);

    /* Someone asleep in a bed: laid flat on the mattress, head on the pillow, eyes closed.
       The figure is drawn as a decal on the mattress plane (see the drawing step) and a
       raised duvet is pulled over the body. side: 0 left, 1 right half of a double bed. */
    function sleeper(p, i, L, f) {
      // built standing (so long hair falls toward the body, as on a pillow); the picture is turned when drawn
      const d = HC.normalize(p.character), stand = (HC.POSES.find(q => q.id === 'standing') || { joints: {} }).joints;
      HC.JOINTS.forEach(([k]) => { d.joints[k] = stand[k] || 0; });
      Object.assign(d, { torsoOrientation: 0, pelvisOrientation: 0, head: 'front', back: false, eyes: 'closed', eyebrows: 'neutral', mouth: 'rest', held: { left: null, right: null }, prop: null });
      const u = p.side === 0 || p.side === 'left' ? -0.34 : p.side === 1 || p.side === 'right' ? 0.34 : 0;
      const [x, y] = eng.furnPt(f, u, 0);
      const type = 'hc3d_person_' + i;
      eng.FURN[type] = { w: FOOT, d: FOOT, h: 0.7, levels: [{ z: 0 }] };
      stBy[L].furniture.push({ f: { type, X: x * 2, Y: y * 2, dir: 0, items: [] }, cls: 'hc3d-ref hc3d-ref-' + i, idx: -1 });
      stBy[L].furniture[p.bed].cls += ' hc3d-seat-' + i;
      return { p, i, L, d: HC.normalize(d), sleep: { f, u }, x, y, z: 0, warp: { split: 0 } };
    }

    let markup = eng.renderIso(stBy, rmBy);
    const ns = 'hc3d' + (++seq) + '-';
    markup = markup.replace(/id="([^"]+)"/g, (m, id) => `id="${ns}${id}"`).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${ns}${id})`);

    /* Seated people are drawn right after their seat, so the seat and its legs are under
       them. When they face away, the backrest (and a sofa's near armrest) is between them
       and the viewer: those parts' outlines are cut out of the person (see occluders). */
    who.forEach(w => {
      if (w.p.seat == null && !w.sleep) return;
      const me = findGroup(markup, 'hc3d-ref hc3d-ref-' + w.i + '"'), sm = new RegExp('hc3d-seat-' + w.i + '(?=["\\s])').exec(markup), seat = sm ? sm.index : -1;
      if (!me || seat < 0) return;
      const sStart = markup.lastIndexOf('<g class="it', seat), sEnd = groupEnd(markup, sStart), g = markup.slice(me[0], me[1]);
      if (me[0] < sStart) markup = markup.slice(0, me[0]) + markup.slice(me[1], sEnd) + g + markup.slice(sEnd);
      if (w.away) w.cut = occluders(eng, st.floors[w.L].furniture[w.p.seat], w.L);
    });

    // swap each stand-in for its person
    const tags = [];
    who.forEach(w => {
      if (w.sleep) return drawSleeper(w);
      const [sx, sy] = eng.scr(w.x, w.y, eng.baseZ(w.L) + w.z);
      // the drawing's insides, moved into a plain transformed group: a nested <svg> would be
      // resized by any page CSS aimed at svg elements (svg{width:100%} and the like)
      let art = HC.render(w.d).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>[\s\S]*?<\/title>/, '')
        .replace('stroke-width="1.3" stroke-linejoin', `stroke-width="${(line / scale).toFixed(2)}" stroke-linejoin`);
      if (w.warp.split) art = warpBody(art, w.warp, HC.pivots(w.d).neck.x);
      const inner = art;
      art = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${art}</g>`;
      const [hx, hy] = eng.scr(w.x, w.y, eng.baseZ(w.L));   // the shadow stays on the floor, also under a seated person
      const shadow = opts.shadow === false || w.p.seat != null ? '' : `<ellipse cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" rx="${(0.32 * eng.HW).toFixed(2)}" ry="${(0.32 * eng.HH).toFixed(2)}" fill="#000" fill-opacity=".14"/>`;
      if (w.cut && (w.cut.body.length || w.cut.legs.length)) {
        // facing away on a seat: the shins and feet hang behind the whole seat, the back is behind the backrest
        const outer = mmul(mmul([1, 0, 0, 1, sx, sy], [scale, 0, 0, scale, 0, 0]), [1, 0, 0, 1, -STAGE_X, -STAGE_GROUND]);
        art = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${maskLowerLegs(inner, outer, w.cut.legs, ns + 'legs' + w.i)}</g>`;
        if (w.cut.body.length) art = hideMask(ns + 'cut' + w.i, w.cut.body) + `<g mask="url(#${ns}cut${w.i})">${art}</g>`;
      }
      art = `<g class="hc3d-person" data-name="${esc(w.d.name)}">${shadow}${art}</g>`;
      const g = findGroup(markup, 'hc3d-ref hc3d-ref-' + w.i + '"');
      if (g) markup = markup.slice(0, g[0]) + art + markup.slice(g[1]);
      else markup += art;   // not on a floor that is drawn in this sort: on top
      { // the drawing's box on screen (the split lifts the shoulders by at most ~0.3 × the half-width)
        const lift = (w.warp.split || 0) * 0.5 * BODY_W * 1.15 * scale;
        w.headTop = sy + (w.ex.top - w.ex.bottom) * scale;
        w.screen = { x0: sx + w.ex.left * scale, x1: sx + w.ex.right * scale, y0: w.headTop - lift, y1: sy };
      }
      const tag = w.L !== st.level ? '' : w.p.tag != null ? w.p.tag : (opts.tags ? w.d.name : '');
      if (tag) tags.push(`<text class="pic-label hc3d-tag" x="${sx.toFixed(1)}" y="${(w.headTop - 8).toFixed(1)}">${esc(tag)}</text>`);
    });
    function drawSleeper(w) {
      /* The head is drawn the normal way (round things look the same from any side), full size,
         turned in the picture so the body runs toward the headboard; only the head and neck
         are kept, the duvet covers the rest. */
      const { f, u } = w.sleep, pv = HC.pivots(w.d), P = (uu, vv) => eng.furnPt(f, uu, vv);
      const zb = eng.baseZ(w.L), S0 = eng.scr(...P(u, -0.58), zb + 0.6), S1 = eng.scr(...P(u, -1.58), zb + 0.6);
      const th = Math.atan2(S1[1] - S0[1], S1[0] - S0[0]);                         // headboard direction on screen
      const ax = pv.neck.x - pv.root.x, ay = pv.neck.y - pv.root.y, ph = Math.atan2(ay, ax), al = Math.hypot(ax, ay) || 1;
      const ux = ax / al, uy = ay / al, keep = 14;                                    // keep the drawing beyond 14 px below the neck
      const cut = [[pv.neck.x - keep * ux - 999 * uy, pv.neck.y - keep * uy + 999 * ux], [pv.neck.x - keep * ux + 999 * uy, pv.neck.y - keep * uy - 999 * ux],
                   [pv.neck.x + 999 * ux + 999 * uy, pv.neck.y + 999 * uy - 999 * ux], [pv.neck.x + 999 * ux - 999 * uy, pv.neck.y + 999 * uy + 999 * ux]];
      const cid = ns + 'sleep' + w.i, deg = r => (r * 180 / Math.PI).toFixed(2);
      const art = HC.render(w.d).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>[\s\S]*?<\/title>/, '')
        .replace('stroke-width="1.3" stroke-linejoin', `stroke-width="${(line / scale).toFixed(2)}" stroke-linejoin`);
      const head = `<clipPath id="${cid}"><path d="M${cut.map(c => c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join('L')}Z"/></clipPath>`
        + `<g transform="translate(${S0[0].toFixed(2)} ${S0[1].toFixed(2)}) rotate(${deg(th)}) scale(${scale.toFixed(5)}) rotate(${deg(-ph)}) translate(${(-pv.neck.x).toFixed(2)} ${(-pv.neck.y).toFixed(2)})"><g clip-path="url(#${cid})">${art}</g></g>`;
      const g = findGroup(markup, 'hc3d-ref hc3d-ref-' + w.i + '"');
      let html = `${head}${duvetLump(f, u, w.L)}`;
      // when the headboard is nearer the camera than the pillow, it hides part of the sleeper
      const near = (vv) => eng.scr(...P(u, vv), zb)[1];
      if (near(-0.97) > near(-0.75)) {
        const pts = [];
        [-0.7, 0.7].forEach(uu => [-1, -0.94].forEach(vv => [0, 0.95].forEach(z => pts.push(eng.scr(...P(uu, vv), zb + z)))));
        html = hideMask(ns + 'hb' + w.i, [hull(pts)]) + `<g mask="url(#${ns}hb${w.i})">${html}</g>`;
      }
      html = `<g class="hc3d-person hc3d-asleep" data-name="${esc(w.d.name)}">${html}</g>`;
      if (g) markup = markup.slice(0, g[0]) + html + markup.slice(g[1]); else markup += html;
      const hd = eng.scr(...P(u, -0.75), zb + 0.6), corners = [[-0.7, -1], [0.7, -1], [0.7, 1], [-0.7, 1]].map(([a, b]) => eng.scr(...P(a, b), zb));
      w.screen = { x0: Math.min(...corners.map(c => c[0])), x1: Math.max(...corners.map(c => c[0])), y0: hd[1] - 30, y1: Math.max(...corners.map(c => c[1])) };
      const tag = w.L !== st.level ? '' : w.p.tag != null ? w.p.tag : (opts.tags ? w.d.name : '');
      if (tag) tags.push(`<text class="pic-label hc3d-tag" x="${hd[0].toFixed(1)}" y="${(hd[1] - 24).toFixed(1)}">${esc(tag)}</text>`);
    }
    /* A duvet pulled up to the sleeper's chest: a soft box over their half of the bed, in the
       engine's own duvet colours (m-duvet), with the faces the camera sees. */
    function duvetLump(f, u, L) {
      const z0 = eng.baseZ(L) + 0.5, z1 = z0 + 0.14, u0 = u === 0 ? -0.66 : u - 0.32, u1 = u === 0 ? 0.66 : u + 0.32, v0 = -0.5, v1 = 0.97;
      const W = (uu, vv, z) => eng.scr(...eng.furnPt(f, uu, vv), z), pts = q => q.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
      const sides = [[[u0, v0], [u1, v0]], [[u1, v0], [u1, v1]], [[u1, v1], [u0, v1]], [[u0, v1], [u0, v0]]];
      let out = '';
      sides.forEach(([a, b]) => {
        const q = [W(a[0], a[1], z0), W(b[0], b[1], z0), W(b[0], b[1], z1), W(a[0], a[1], z1)];
        // outward-facing toward the camera: the bottom edge, walked from a to b, has the box on its upper side on screen
        const cx = (q[0][0] + q[1][0]) / 2, cy = (q[0][1] + q[1][1]) / 2, m = W((u0 + u1) / 2, (v0 + v1) / 2, z0);
        if (cy <= m[1] + 0.01) return;
        out += `<polygon class="m-duvet ${cx < m[0] ? 'fl' : 'fr'}" points="${pts(q)}"/>`;
      });
      const top = [W(u0, v0, z1), W(u1, v0, z1), W(u1, v1, z1), W(u0, v1, z1)];
      const fold = [W(u0, v0 + 0.12, z1), W(u1, v0 + 0.12, z1)];
      return out + `<polygon class="m-duvet ft" points="${pts(top)}"/><path d="M${fold[0][0].toFixed(2)} ${fold[0][1].toFixed(2)}L${fold[1][0].toFixed(2)} ${fold[1][1].toFixed(2)}" stroke="rgba(0,0,0,.15)" stroke-width="1.2" fill="none"/>`;
    }

    // words on the floor (as HousePicture), then name tags, drawn last
    const zl = eng.baseZ(st.level) + 0.02;
    (opts.labels || []).forEach(l => {
      const [sx, sy] = eng.scr(l.x, l.y, zl + (l.z || 0));
      markup += `<text class="pic-label${l.num ? ' pic-num' : ''}" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}">${esc(l.text)}</text>`;
    });
    markup += tags.join('');

    // frame: the floor shown, up to the walls or the tallest thing — people included
    const FL = st.level >= 0 ? st.floors[st.level] : null, zf = st.level >= 0 ? eng.baseZ(st.level) : 0;
    const screenBox = rects => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      rects.forEach(([r, lo, hi]) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].forEach(([cx, cy]) => [lo, hi].forEach(zz => {
        const [sx, sy] = eng.scr(cx, cy, zf + zz);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      })));
      return [x0, y0, x1, y1];
    };
    const addPeople = b => { who.forEach(w => { if (w.L !== st.level || !w.screen) return;
      b[0] = Math.min(b[0], w.screen.x0); b[1] = Math.min(b[1], w.screen.y0 - (tags.length ? 18 : 0)); b[2] = Math.max(b[2], w.screen.x1); b[3] = Math.max(b[3], w.screen.y1); }); return b; };
    if (FL && !opts.roofs) {
      const pieces = [];
      FL.furniture.forEach(f => {
        let top = eng.FURN[f.type].h;
        if (eng.FURN[f.type].wall) top = eng.FURN[f.type].hangZ + eng.FURN[f.type].h / 2;
        (f.items || []).forEach(it => { top = Math.max(top, eng.FURN[f.type].levels[it.lvl].z + eng.APPL[it.type].h); });
        pieces.push([eng.furnRect(f), 0, top]);
      });
      FL.appliances.forEach(a => pieces.push([eng.applRect(a), 0, eng.APPL[a.type].h]));
      let b;
      if (opts.focus) {
        const m = opts.focus === true ? 0.6 : Number(opts.focus);
        const rs = pieces.concat(who.filter(w => w.L === st.level).map(w => [{ x0: w.x - FOOT / 2, x1: w.x + FOOT / 2, y0: w.y - FOOT / 2, y1: w.y + FOOT / 2 }, 0, 0]));
        const u = rs.reduce((a, [r]) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        b = screenBox(rs.concat([[{ x0: Math.max(0, u.x0 - m), y0: Math.max(0, u.y0 - m), x1: Math.min(st.COLS, u.x1 + m), y1: Math.min(st.ROWS, u.y1 + m) }, 0, 0]]));
      } else {
        let zTop = walls === 'down' ? 0.6 : eng.WALL_H;
        pieces.forEach(([, , top]) => { zTop = Math.max(zTop, top); });
        b = screenBox([[{ x0: 0, y0: 0, x1: st.COLS, y1: st.ROWS }, -zf - 0.3, zTop + 0.05]]);   // down to the ground: an upper floor shows the house under it
      }
      b = addPeople(b);
      const pad = opts.focus ? 8 : 12;
      box = [b[0] - pad, b[1] - pad, b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad];
    }
    if (opts.box) box = opts.box.slice();
    if (box && opts.aspect) {
      const [bx, by, bw, bh] = box;
      box = bw / bh < opts.aspect ? [bx + bw / 2 - bh * opts.aspect / 2, by, bh * opts.aspect, bh] : [bx, by + bh / 2 - bw / opts.aspect / 2, bw, bw / opts.aspect];
    }
    const [x, y, w, hh] = box || [0, 0, 100, 100];
    const alt = esc(opts.alt || 'A picture of people in a room');
    return `<svg class="house-pic" xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}" role="img" aria-label="${alt}"${clashes ? ` data-clashes="${clashes}"` : ''}>${markup}</svg>`;
  }

  function pictureDraw(el, house, people, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    el.innerHTML = pictureSvg(house, people, opts);
    return el.firstElementChild;
  }

  global.HouseCharacter3D = { svg: pictureSvg, draw: pictureDraw, viewData, viewPlan, yawFor, PX_PER_M };
})(typeof window !== 'undefined' ? window : globalThis);

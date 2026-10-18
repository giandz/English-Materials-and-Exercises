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
              side: 0 | 1,      which half of a double bed (left / right seen from its foot); leave it out
                                for the middle. A single bed (narrower than 1.2 m) is always the middle
              bunk: 'top',      in a bunk bed: the top bed (default: the bottom one)
              swim: true,       in a swimming pool: standing on the bottom with the water just
                                under the shoulders; below the surface the body shows only faintly
              garment: 'footwear' | 'upper' | 'lower' | 'headwear' | 'eyewear' | 'watch' | 'accessory',
                                not a person but one piece of their clothing, on its own:
                                footwear stands on the floor (which: 'left' / 'right' for one
                                shoe or boot), with an opening drawn across the top; the others
                                lie flat, top toward `facing`, gently wrinkled (wrinkle: 2.5, 0 = none;
                                angle: a turn in degrees). on: i lays or stands it on furniture
                                number i (at: [u, v] there, e.g. a jacket on a bed). 'accessory' takes
                                item: an accessory id ('watch' is item 'watchL'); scale: 2 draws a small
                                thing bigger than life so it can be seen
              armOver: 'right', that arm (and anything in its hand) drawn on top of the picture,
                                e.g. a cook reaching over a counter (only when facing the camera)
              opacity: 1,       0–1, how solid the person is drawn (a guess, a memory, a ghost);
                                below 0.5 the figure also gets a dashed outline in the colour opposite
                                the page, as strong as the figure is faint (see ghost)
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
             ghostLine 1.2 width of the dashed outline round people drawn below 50 % (screen px)
             ghostDash 2.6 length of its dashes (screen px)
             around m     close-up on the people: frame them plus m metres of floor round them

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
  const WATER_Z = -0.15;             // a pool's water surface, below the ground (house-engine.js)
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

  /* ── Garments on their own ────────────────────────────────────────────────────────
     A garment is cut out of a character's drawing by drawing the character twice, with
     and without it, and keeping only what the first drawing has that the second lacks.
     The two drawings are matched group by group (the joints, in order); inside each group
     the shapes are matched in order too (a longest common subsequence), so the skin under
     a sleeve, which both drawings have, is left out, and only the cloth is kept. Group
     transforms are taken from the drawing with the garment (shoes, for one, lift the body
     a little), so the garment sits where the character wore it. */
  const GARMENT_KEY = { footwear: 'footwear', shoes: 'footwear', boots: 'footwear', upper: 'upperGarment', top: 'upperGarment',
    lower: 'lowerGarment', bottoms: 'lowerGarment', headwear: 'headwear', hat: 'headwear',
    eyewear: 'eyewear', glasses: 'eyewear', accessory: 'accessories', watch: 'accessories' };
  const stripSvg = s => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  function topElements(s) {   // the top-level elements of a piece of markup, as strings
    const out = [], re = /<(\/?)([a-zA-Z]+)(?:\s[^>]*?)?(\/?)>/g;
    let depth = 0, start = 0;
    for (let m; (m = re.exec(s));) {
      if (m[1]) { if (--depth === 0) out.push(s.slice(start, re.lastIndex)); }
      else if (m[3]) { if (depth === 0) out.push(s.slice(m.index, re.lastIndex)); }
      else { if (depth === 0) start = m.index; depth++; }
    }
    return out;
  }
  const openTag = s => (s.match(/^<[^>]*>/) || [''])[0];
  const isGroup = s => /^<g[\s>]/.test(s);
  const groupLabel = s => (openTag(s).match(/data-joint="([^"]+)"/) || [, 'g'])[1];
  const innerOf = s => s.slice(openTag(s).length, s.lastIndexOf('</'));
  // the elements of `a` that are not in `b` (groups are compared recursively)
  function diffMarkup(a, b, keepGroup) {
    const A = topElements(a), B = topElements(b), out = [];
    // groups pair up by label, k-th with k-th
    const seen = {}, byLabel = {};
    B.filter(isGroup).forEach(g => { (byLabel[groupLabel(g)] = byLabel[groupLabel(g)] || []).push(g); });
    const plainB = B.filter(x => !isGroup(x));
    // LCS over the non-group elements, to keep order-sensitive duplicates straight
    const plainA = A.filter(x => !isGroup(x)), n = plainA.length, m = plainB.length;
    const T = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = plainA[i] === plainB[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    const matched = new Set();
    for (let i = 0, j = 0; i < n && j < m;) {
      if (plainA[i] === plainB[j]) { matched.add(i); i++; j++; } else if (T[i + 1][j] >= T[i][j + 1]) i++; else j++;
    }
    let pi = 0;
    A.forEach(x => {
      if (!isGroup(x)) { if (!matched.has(pi++)) out.push(x); return; }
      const lab = groupLabel(x), k = seen[lab] = (seen[lab] || 0) + 1;
      if (keepGroup && !keepGroup(lab)) return;
      const twin = (byLabel[lab] || [])[k - 1];
      const kept = twin ? diffMarkup(innerOf(x), innerOf(twin), null) : innerOf(x);
      if (kept) out.push(openTag(x) + kept + '</g>');
    });
    return out.join('');
  }
  /* garmentArt(d, key, side): the markup of one garment of character d (as HouseCharacter.render
     draws it, without the <svg> wrapper). side 'L' / 'R' keeps one side's joints only (one boot). */
  function garmentArt(d, key, side) {
    const HC = global.HouseCharacter;
    // only that garment is worn (nothing over or under it to change its shape), on a body
    // with nothing in its hands; then the same body without it
    d = Object.assign(JSON.parse(JSON.stringify(d)), { upperGarment: null, lowerGarment: null, footwear: null, headwear: null, eyewear: null,
      accessories: [], held: { left: null, right: null }, prop: null }, { [key]: d[key] });
    const bare = JSON.parse(JSON.stringify(d)); bare[key] = null;
    const w = stripSvg(HC.render(d)), n = stripSvg(HC.render(bare));
    const wi = w.indexOf('<g'), ni = n.indexOf('<g'), outerW = w.slice(wi), outerN = n.slice(ni);
    const other = side === 'L' ? 'R' : side === 'R' ? 'L' : null;
    const keep = other ? lab => !(lab.length > 1 && lab.endsWith(other) && /^(ankle|knee|hip|shoulder|elbow|wrist)/.test(lab)) : null;
    return w.slice(0, wi) + openTag(outerW) + diffMarkup(innerOf(outerW), innerOf(outerN), keep) + '</g>';
  }
  /* The cut-out keeps a few shapes that are not cloth: skin seen through an opening (a
     V-neck) or drawn over the garment. Drawing the garment a second time in another colour
     shows which fills belong to it (they change) and which do not (they stay): skin is
     dropped, other fixed fills with no outline (an opening) become the garment's lining. */
  const hueOf = hex => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn; if (dl < 0.08) return null;
    return ((mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4) * 60 + 360) % 360; };
  const hueGap = (a, b) => { const x = hueOf(a), y = hueOf(b); if (x == null || y == null) return x === y ? 0 : 180; const d = Math.abs(x - y) % 360; return Math.min(d, 360 - d); };
  const COLOR_OF = { upperGarment: 'upperColor', lowerGarment: 'lowerColor', footwear: 'footwearColor', headwear: 'headwearColor' };
  function looseGarment(d, key, side) {
    const HC = global.HouseCharacter, ck = COLOR_OF[key];
    const art = garmentArt(d, key, side);
    if (!ck) return art;
    const alt = JSON.parse(JSON.stringify(d)); alt[ck] = d[ck] === '#00FF00' ? '#FF00FF' : '#00FF00';
    const art2 = garmentArt(alt, key, side);
    const els = s2 => s2.match(/<[a-zA-Z]+(?:\s[^>]*)?\/?>/g) || [];
    const A = els(art), B = els(art2);
    if (A.length !== B.length) return art;
    const skin = ((HC.SKIN || []).find(k => k.id === d.skin) || {}).hex || '';
    const own = d[ck] || (key === 'footwear' && HC.FOOT[d.footwear] ? HC.FOOT[d.footwear].col : '#666666');
    let k = 0;
    return art.replace(/<[a-zA-Z]+(?:\s[^>]*)?\/?>/g, tag => {
      const other = B[k++], f1 = attr(tag, 'fill'), f2 = attr(other || '', 'fill');
      if (!f1 || !/^#/.test(f1)) return tag;
      // a top's neck opening is drawn in a colour that goes with the top (a shirt under a
      // jacket); lying on its own, the opening shows the top's own lining instead
      if (f1 !== f2) return key === 'upperGarment' && attr(tag, 'stroke') === 'none' && hueGap(f1, own) > 60 ? tag.replace(/\sfill="[^"]*"/, ` fill="${darken(own, 0.55)}"`) : tag;
      if (skin && f1.toLowerCase() === skin.toLowerCase()) return tag.replace(/\sfill="[^"]*"/, ' fill="none"').replace(/\sstroke="[^"]*"/, ' stroke="none"').replace(/^<([a-zA-Z]+)/, '<$1 display="none"');
      if (attr(tag, 'stroke') === 'none') return tag.replace(/\sfill="[^"]*"/, ` fill="${darken(own, 0.55)}"`);
      return tag;
    });
  }
  /* Every point of every shape in a piece of markup, in its outermost coordinates. */
  function artPoints(art) {
    const stack = [{ m: [1, 0, 0, 1, 0, 0], skip: 0 }], pts = [];
    art.replace(/<(\/?)([a-zA-Z]+)((?:\s+[^\s=>\/]+="[^"]*")*)\s*(\/?)>/g, (tag, close, name, attrs, self) => {
      const top = stack[stack.length - 1];
      if (close) { if (stack.length > 1) stack.pop(); return tag; }
      if (top.skip || OPAQUE.has(name)) { if (!self) stack.push({ m: top.m, skip: 1 }); return tag; }
      const m = mmul(top.m, parseTransform(attr(tag, 'transform')));
      if (!self) stack.push({ m, skip: 0 });
      if (name === 'g' || !GEOM[name]) return tag;
      const d0 = shapePath(name, tag); if (!d0) return tag;
      pathToCubics(d0).forEach(sp => { pts.push(mapPt(m, ...sp.start)); sp.segs.forEach(q => pts.push(mapPt(m, q[0], q[1]), mapPt(m, q[2], q[3]), mapPt(m, q[4], q[5]))); });
      return tag;
    });
    return pts;
  }
  /* Bend every shape of a piece of markup by fn([x, y]) → [x', y'] (outermost coordinates):
     the same path rewriting as the split skew, for any displacement — here, wrinkles. */
  function warpArt(art, fn) {
    const stack = [{ m: [1, 0, 0, 1, 0, 0], skip: 0 }], f = v => +v.toFixed(2);
    return art.replace(/<(\/?)([a-zA-Z]+)((?:\s+[^\s=>\/]+="[^"]*")*)\s*(\/?)>/g, (tag, close, name, attrs, self) => {
      const top = stack[stack.length - 1];
      if (close) { if (stack.length > 1) stack.pop(); return tag; }
      if (top.skip || OPAQUE.has(name)) { if (!self) stack.push({ m: top.m, skip: 1 }); return tag; }
      const m = mmul(top.m, parseTransform(attr(tag, 'transform')));
      if (!self) stack.push({ m, skip: 0 });
      if (name === 'g' || !GEOM[name]) return tag;
      const d0 = shapePath(name, tag), inv = minv(m); if (!d0 || !inv) return tag;
      const W = (x, y) => { const g = fn(mapPt(m, x, y)); return mapPt(inv, g[0], g[1]); };
      const d1 = pathToCubics(d0).map(sp => {
        const segs = []; let q0 = sp.start;
        sp.segs.forEach(q => { splitSeg(q0, q, m, segs, 0); q0 = [q[4], q[5]]; });
        const st = W(...sp.start);
        return `M${f(st[0])},${f(st[1])}` + segs.map(q => { const a = W(q[0], q[1]), b = W(q[2], q[3]), c = W(q[4], q[5]);
          return `C${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${f(c[0])},${f(c[1])}`; }).join('') + (sp.closed ? 'Z' : '');
      }).join('');
      let rest = attrs; GEOM[name].forEach(k => { rest = rest.replace(new RegExp('\\s' + k + '="[^"]*"'), ''); });
      const fillNone = (name === 'line' || name === 'polyline') && !/\sfill="/.test(rest) ? ' fill="none"' : '';
      return `<path d="${d1}"${rest}${fillNone}${self ? '/' : ''}>`;
    }).replace(/<\/(rect|circle|ellipse|line|polyline|polygon)>/g, '</path>');
  }
  const darken = (hex, f) => { const n = parseInt(String(hex || '#666666').slice(1), 16); const c = k => Math.round(((n >> k) & 255) * f);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); };
  /* Loose shoes and boots have an opening: an ellipse (a circle on the floor, seen at the
     camera's angle) across the top of each one, the inside in shadow. */
  function toplines(d, side) {
    const HC = global.HouseCharacter, F = (HC.FOOT || {})[d.footwear];
    if (!F || F.kind === 'sandal' || F.kind === 'sock') return '';
    const col = d.footwearColor || F.col;
    return (side ? [side] : ['L', 'R']).map(sd => {
      const pts = artPoints(garmentArt(d, 'footwear', sd)); if (!pts.length) return '';
      const y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1])), band = Math.max(3, 0.12 * (y1 - y0));
      const xs = pts.filter(p => p[1] <= y0 + band).map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const rx = Math.max(3, (x1 - x0) / 2 * 0.92), ry = rx * 0.45;
      return `<ellipse cx="${((x0 + x1) / 2).toFixed(2)}" cy="${(y0 + ry * 0.35).toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${darken(col, 0.45)}" stroke="${darken(col, 0.3)}"/>`;
    }).join('');
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
      const bed = p.bed != null && st.floors[L] && st.floors[L].furniture[p.bed] && isBed(st.floors[L].furniture[p.bed].type) ? st.floors[L].furniture[p.bed] : null;
      if (bed) return sleeper(p, i, L, bed);
      if (p.garment) return garmentItem(p, i, L);
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
      if (p.swim) {
        // in a swimming pool: standing on the bottom, the water just under the shoulders
        const neckH = (STAGE_GROUND - global.HouseCharacter.pivots(d).neck.y) / PX_PER_M;
        out.z = WATER_Z - (neckH - 0.13);
      }
      if (!stBy[L]) return out;
      const type = 'hc3d_person_' + i;
      eng.FURN[type] = { w: FOOT, d: FOOT, h: H, levels: [{ z: Math.max(0, H + Math.max(0, out.z) - 1.8) }] };
      // a 1.8 m single box on the stand-in, raised so its top is the top of the head: the
      // sort then knows how tall the person is (a stand-in that is too tall is harmless)
      const proxy = { type, X: out.x * 2, Y: out.y * 2, dir: 0, items: [{ type: 'fridge', lvl: 0, slot: 'C', rdir: 0 }] };
      stBy[L].furniture.push({ f: proxy, cls: 'hc3d-ref hc3d-ref-' + i, idx: -1 });
      if (p.seat != null && stBy[L].furniture[p.seat]) stBy[L].furniture[p.seat].cls += ' hc3d-seat-' + i;
      else if (!p.swim) {
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
      // a single bed: in the middle. A double bed: in the middle, or on one half (side 0 / 1)
      const bw = eng.FURN[f.type].w, half = bw >= 1.2 ? bw / 4 : 0;
      const zo = f.type === 'bunkbed' && (p.bunk === 'top' || p.bunk === 1) ? 0.9 : 0;   // the top bunk is 0.9 m higher
      const u = p.side === 0 || p.side === 'left' ? -half : p.side === 1 || p.side === 'right' ? half : 0;
      const [x, y] = eng.furnPt(f, u, 0);
      const type = 'hc3d_person_' + i;
      eng.FURN[type] = { w: FOOT, d: FOOT, h: 0.7, levels: [{ z: 0 }] };
      stBy[L].furniture.push({ f: { type, X: x * 2, Y: y * 2, dir: 0, items: [] }, cls: 'hc3d-ref hc3d-ref-' + i, idx: -1 });
      stBy[L].furniture[p.bed].cls += ' hc3d-seat-' + i;
      return { p, i, L, d: HC.normalize(d), sleep: { f, u, zo }, x, y, z: 0, warp: { split: 0 } };
    }

    /* A garment on its own (people entries with garment: …):
         footwear — standing upright where it was put, a pair or one shoe (which: 'left' / 'right'),
                    turned the way `facing` says, with an opening across the top of each;
         anything else — lying flat (a jacket on a bed, trousers on the floor), its top
                    (collar, waistband) toward `facing`, slightly wrinkled (wrinkle: stage px).
       on: i puts it on furniture number i (on its top; at: [u, v] in the piece's frame, and
       by default the top points to the piece's back, e.g. a bed's headboard). */
    function garmentItem(p, i, L) {
      const key = GARMENT_KEY[p.garment] || p.garment;
      let d = HC.normalize(p.character);
      if (key === 'accessories') d.accessories = [p.item || (p.garment === 'watch' ? 'watchL' : (d.accessories || [])[0])].filter(Boolean);
      if (!d[key] || (Array.isArray(d[key]) && !d[key].length)) return null;
      const stand = (HC.POSES.find(q => q.id === 'standing') || { joints: {} }).joints;
      HC.JOINTS.forEach(([k]) => { d.joints[k] = stand[k] || 0; });
      Object.assign(d, { torsoOrientation: 0, pelvisOrientation: 0, head: 'front', back: false, held: { left: null, right: null }, prop: null });
      const f = p.on != null && st.floors[L] ? st.floors[L].furniture[p.on] : null;
      const lv = f ? (eng.FURN[f.type].levels || []) : [];
      const surf = f ? ((lv.find(l => l.top) || lv[0] || { z: eng.FURN[f.type].h }).z) : 0;
      const at = p.at || [0, f && isBed(f.type) ? 0.25 : 0];
      const [x, y] = f ? eng.furnPt(f, at[0], at[1]) : [p.x || 0, p.y || 0];
      const side = p.which === 'left' || p.which === 'L' ? 'L' : p.which === 'right' || p.which === 'R' ? 'R' : null;
      const type = 'hc3d_person_' + i, flat = key !== 'footwear';
      eng.FURN[type] = { w: 0.3, d: 0.3, h: flat ? 0.05 : 0.4, levels: [{ z: 0 }] };
      stBy[L].furniture.push({ f: { type, X: x * 2, Y: y * 2, dir: 0, items: [] }, cls: 'hc3d-ref hc3d-ref-' + i, idx: -1 });
      if (f) stBy[L].furniture[p.on].cls += ' hc3d-seat-' + i;
      const out = { p, i, L, x, y, z: (p.z || 0) + surf, onF: !!f, garment: { key, side, flat, f } };
      if (flat) {
        // laid out: arms a little away from the body, legs a little apart
        Object.assign(d.joints, { shoulderL: -24, elbowL: -6, shoulderR: 24, elbowR: 6, hipL: -5, hipR: 5, ankleL: 0, ankleR: 0 });
        return Object.assign(out, { d, warp: { split: 0 } });
      }
      const vp = viewPlan(d, p.facing != null ? p.facing : 'S', st.rot, opts);
      return Object.assign(out, { d: vp.d, warp: vp.warp, away: vp.away, ex: extent(vp.d) });
    }
    function drawGarment(w) {
      const g = w.garment, op = opacityOf(w.p), zb = eng.baseZ(w.L) + w.z;
      const lineW = `stroke-width="${(line / scale).toFixed(2)}" stroke-linejoin`;
      let html;
      if (!g.flat) {
        // upright, like the person who wore it but with nobody inside
        const [sx, sy] = eng.scr(w.x, w.y, zb);
        let art = looseGarment(w.d, 'footwear', g.side).replace('stroke-width="1.3" stroke-linejoin', lineW) + toplines(w.d, g.side);
        if (w.warp.split) art = warpBody(art, w.warp, HC.pivots(w.d).neck.x);
        art = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${(scale * (+w.p.scale || 1)).toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${art}</g>`;
        const sh = `<ellipse cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" rx="${(0.2 * eng.HW).toFixed(2)}" ry="${(0.2 * eng.HH).toFixed(2)}" fill="#000" fill-opacity=".12"/>`;
        html = sh + (op < 1 ? ghost(ns + 'ghost' + w.i, op, art, opts) : art);
        w.screen = { x0: sx - 15, x1: sx + 15, y0: sy - 25, y1: sy + 4 };
      } else {
        // flat on the floor or on top of a piece of furniture: the drawing laid on that plane
        let art = looseGarment(w.d, g.key);
        const amp = w.p.wrinkle != null ? +w.p.wrinkle : 2.5, ph = (w.i * 1.7) % 6.28;
        if (amp) art = warpArt(art, ([x, y]) => [x + amp * Math.sin(y / 17 + ph) + 0.5 * amp * Math.sin(y / 7.3 + 2 * ph),
          y + 0.6 * amp * Math.sin(x / 13 + ph) + 0.4 * amp * Math.sin((x + y) / 9.1)]);
        const pts = artPoints(art); if (!pts.length) return;
        const cx = (Math.min(...pts.map(q => q[0])) + Math.max(...pts.map(q => q[0]))) / 2, cy = (Math.min(...pts.map(q => q[1])) + Math.max(...pts.map(q => q[1]))) / 2;
        // the plane's axes: stage x → u, stage y (down the garment) → v, both turned to the facing
        let U, V, O = [w.x, w.y];
        if (g.f && w.p.facing == null) {
          const a = eng.furnPt(g.f, 0, 0), b = eng.furnPt(g.f, 1, 0), c = eng.furnPt(g.f, 0, 1);
          U = [b[0] - a[0], b[1] - a[1]]; V = [c[0] - a[0], c[1] - a[1]];   // top toward the piece's back
        } else {
          const t = facingDeg(w.p.facing != null ? w.p.facing : 'N') * Math.PI / 180, fx = Math.sin(t), fy = -Math.cos(t);
          V = [-fx, -fy]; U = [-fy, fx];
        }
        const ang = (w.p.angle || 0) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
        [U, V] = [[U[0] * ca + V[0] * sa, U[1] * ca + V[1] * sa], [V[0] * ca - U[0] * sa, V[1] * ca - U[1] * sa]];
        const zz = zb + 0.006, S0 = eng.scr(O[0], O[1], zz), SU = eng.scr(O[0] + U[0], O[1] + U[1], zz), SV = eng.scr(O[0] + V[0], O[1] + V[1], zz);
        const k = (+w.p.scale || 1) / PX_PER_M;   // scale: drawn larger than life (a watch, a pair of glasses)
        const a = (SU[0] - S0[0]) * k, b = (SU[1] - S0[1]) * k, c = (SV[0] - S0[0]) * k, dd = (SV[1] - S0[1]) * k;
        const M = [a, b, c, dd, S0[0] - a * cx - c * cy, S0[1] - b * cx - dd * cy].map(v => v.toFixed(5)).join(' ');
        art = art.replace('stroke-width="1.3" stroke-linejoin', lineW);
        art = `<g transform="matrix(${M})">${art}</g>`;
        html = op < 1 ? ghost(ns + 'ghost' + w.i, op, art, opts) : art;
        w.screen = { x0: S0[0] - 20, x1: S0[0] + 20, y0: S0[1] - 12, y1: S0[1] + 12 };
      }
      html = `<g class="hc3d-garment" data-name="${esc(w.d.name)}" data-garment="${g.key}">${html}</g>`;
      const at = findGroup(markup, 'hc3d-ref hc3d-ref-' + w.i + '"');
      if (at) markup = markup.slice(0, at[0]) + html + markup.slice(at[1]); else markup += html;
    }

    let markup = eng.renderIso(stBy, rmBy);
    const ns = 'hc3d' + (++seq) + '-';
    markup = markup.replace(/id="([^"]+)"/g, (m, id) => `id="${ns}${id}"`).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${ns}${id})`);

    /* Seated people are drawn right after their seat, so the seat and its legs are under
       them. When they face away, the backrest (and a sofa's near armrest) is between them
       and the viewer: those parts' outlines are cut out of the person (see occluders). */
    const depth = w => w.sleep || w.onF ? eng.scr(w.x, w.y, 0)[1] : 0;
    who.slice().sort((a, b) => depth(b) - depth(a)).forEach(w => {
      if (w.p.seat == null && !w.sleep && !w.onF) return;
      const me = findGroup(markup, 'hc3d-ref hc3d-ref-' + w.i + '"'), sm = new RegExp('hc3d-seat-' + w.i + '(?=["\\s])').exec(markup), seat = sm ? sm.index : -1;
      if (!me || seat < 0) return;
      const sStart = markup.lastIndexOf('<g class="it', seat), sEnd = groupEnd(markup, sStart), g = markup.slice(me[0], me[1]);
      if (me[0] < sStart) markup = markup.slice(0, me[0]) + markup.slice(me[1], sEnd) + g + markup.slice(sEnd);
      if (w.away && w.p.seat != null) w.cut = occluders(eng, st.floors[w.L].furniture[w.p.seat], w.L);
    });

    // swap each stand-in for its person
    const tags = [], overs = [];
    who.forEach(w => {
      if (w.sleep) return drawSleeper(w);
      if (w.garment) return drawGarment(w);
      const [sx, sy] = eng.scr(w.x, w.y, eng.baseZ(w.L) + w.z);
      // the drawing's insides, moved into a plain transformed group: a nested <svg> would be
      // resized by any page CSS aimed at svg elements (svg{width:100%} and the like)
      let art = HC.render(w.d).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>[\s\S]*?<\/title>/, '')
        .replace('stroke-width="1.3" stroke-linejoin', `stroke-width="${(line / scale).toFixed(2)}" stroke-linejoin`);
      if (w.warp.split) art = warpBody(art, w.warp, HC.pivots(w.d).neck.x);
      /* armOver: one arm (and what its hand holds) is lifted out of the figure and drawn on top
         of the whole picture, e.g. a cook's arm reaching over the counter to the stove. Only
         when the person faces the camera: from behind, that arm is on the far side of them. */
      let armArt = '';
      const fwd = (() => { const r = facingDeg(w.p.facing != null ? w.p.facing : 'S') * Math.PI / 180, a0 = eng.scr(w.x, w.y, 0), a1 = eng.scr(w.x + Math.sin(r), w.y - Math.cos(r), 0); return a1[1] - a0[1]; })();
      if (w.p.armOver && !w.away && fwd > 0) {
        const sd = /^l/i.test(w.p.armOver) ? 'L' : 'R', want = new RegExp(`^<g[^>]*data-joint="(shoulder|elbow|wrist)${sd}"`);
        let out = '', k = 0;
        const body = art.replace(/^(<g[^>]*>)([\s\S]*)(<\/g>)$/, (m0, open, mid, close) => {
          for (let i = 0; i < mid.length;) {
            const j = mid.indexOf('<g', i);
            if (j < 0) { out += mid.slice(i); break; }
            out += mid.slice(i, j);
            const e = groupEnd(mid, j), g = mid.slice(j, e);
            if (want.test(g)) armArt += g; else out += g;
            i = e; k++;
          }
          return open + out + close;
        });
        if (armArt) { art = body; armArt = art.match(/^<g[^>]*>/)[0] + armArt + '</g>'; }
      }
      const inner = art;
      art = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${art}</g>`;
      const [hx, hy] = eng.scr(w.x, w.y, eng.baseZ(w.L));   // the shadow stays on the floor, also under a seated person
      const shadow = opts.shadow === false || w.p.seat != null || w.p.swim ? '' : `<ellipse cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" rx="${(0.32 * eng.HW).toFixed(2)}" ry="${(0.32 * eng.HH).toFixed(2)}" fill="#000" fill-opacity=".14"/>`;
      if (w.cut && (w.cut.body.length || w.cut.legs.length)) {
        // facing away on a seat: the shins and feet hang behind the whole seat, the back is behind the backrest
        const outer = mmul(mmul([1, 0, 0, 1, sx, sy], [scale, 0, 0, scale, 0, 0]), [1, 0, 0, 1, -STAGE_X, -STAGE_GROUND]);
        art = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${maskLowerLegs(inner, outer, w.cut.legs, ns + 'legs' + w.i)}</g>`;
        if (w.cut.body.length) art = hideMask(ns + 'cut' + w.i, w.cut.body) + `<g mask="url(#${ns}cut${w.i})">${art}</g>`;
      }
      const op = opacityOf(w.p);
      if (op < 1) art = ghost(ns + 'ghost' + w.i, op, art, opts);
      if (armArt) {
        const a = `<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-STAGE_X} ${-STAGE_GROUND})">${armArt}</g>`;
        overs.push(`<g class="hc3d-arm-over" data-name="${esc(w.d.name)}">${op < 1 ? ghost(ns + 'ghostarm' + w.i, op, a, opts) : a}</g>`);
      }
      if (w.p.swim) {
        /* Above the water the person is drawn as usual; below it only faintly, as if seen
           through the water, and rings of ripples spread from where the body meets the surface. */
        // the water line (and its ripples) drawn a little up the chest from where the plane meets the body
        const [wx, wy0] = eng.scr(w.x, w.y, eng.baseZ(w.L) + WATER_Z), wy = wy0 - 0.09 * eng.ZS, up = ns + 'up' + w.i, dn = ns + 'dn' + w.i;
        const ripple = `<ellipse cx="${wx.toFixed(2)}" cy="${wy.toFixed(2)}" rx="${(0.36 * eng.HW).toFixed(2)}" ry="${(0.36 * eng.HH).toFixed(2)}" fill="#fff" fill-opacity=".28" stroke="#fff" stroke-opacity=".85" stroke-width="1.1"/>`
          + `<ellipse cx="${wx.toFixed(2)}" cy="${wy.toFixed(2)}" rx="${(0.6 * eng.HW).toFixed(2)}" ry="${(0.6 * eng.HH).toFixed(2)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>`;
        /* The water meets the body in an ellipse round the torso (a circle on the water,
           seen at an angle), concentric with the ripples: its near half dips down the
           body, so the water line curves round the chest instead of cutting straight across. */
        const erx = (0.26 * eng.HW).toFixed(2), ery = (0.26 * eng.HH).toFixed(2), ell = `<ellipse cx="${wx.toFixed(2)}" cy="${wy.toFixed(2)}" rx="${erx}" ry="${ery}"/>`;
        const ellD = `M${(wx - +erx).toFixed(2)} ${wy.toFixed(2)}a${erx} ${ery} 0 1 0 ${(2 * erx).toFixed(2)} 0a${erx} ${ery} 0 1 0 ${(-2 * erx).toFixed(2)} 0Z`;
        art = `<clipPath id="${up}"><rect x="-9999" y="-9999" width="19998" height="${(wy + 9999).toFixed(2)}"/>${ell}</clipPath>`
          + `<clipPath id="${dn}"><path clip-rule="evenodd" d="M-9999 ${wy.toFixed(2)}H9999V9999H-9999Z${ellD}"/></clipPath>`
          + `<g clip-path="url(#${dn})" opacity=".2">${art}</g>${ripple}<g clip-path="url(#${up})">${art}</g>`;
      }
      art = `<g class="hc3d-person" data-name="${esc(w.d.name)}"${op < 1 ? ` data-opacity="${op.toFixed(2)}"` : ''}>${shadow && op < 1 ? `<g opacity="${op.toFixed(3)}">${shadow}</g>` : shadow}${art}</g>`;
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
      const { f, u, zo } = w.sleep, pv = HC.pivots(w.d), P = (uu, vv) => eng.furnPt(f, uu, vv);
      const bw2 = eng.FURN[f.type].w / 2, bd2 = eng.FURN[f.type].d / 2, hv = -bd2 + 0.42;   // the bed's half sizes; the neck's spot
      const zb = eng.baseZ(w.L) + zo, S0 = eng.scr(...P(u, hv), zb + 0.6), S1 = eng.scr(...P(u, hv - 1), zb + 0.6);
      /* The bed's length and width are not at right angles on screen (they cross at about 127°).
         The neck cut must lie along the duvet's top edge, which runs across the bed, so the head is
         turned to put its shoulder line on the bed's width — crown on the headboard's side. */
      const thH = Math.atan2(S1[1] - S0[1], S1[0] - S0[0]);                        // toward the headboard on screen
      const Sw = eng.scr(...P(u + 1, hv), zb + 0.6), thW = Math.atan2(Sw[1] - S0[1], Sw[0] - S0[0]);   // across the bed
      const near_ = a => Math.abs(Math.atan2(Math.sin(a - thH), Math.cos(a - thH)));
      const th = near_(thW + Math.PI / 2) < near_(thW - Math.PI / 2) ? thW + Math.PI / 2 : thW - Math.PI / 2;
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
      /* Below full certainty the head is faded and outlined (the person), the duvet only
         faded: the outline belongs to the character, not to the bedding. */
      const op = opacityOf(w.p), gid = ns + 'ghost' + w.i;
      const headArt = op < 1 ? ghost(gid, op, head, opts) : head;
      const duvet = duvetLump(f, u, w.L, zo);
      let html = headArt + (op < 1 ? `<g opacity="${op.toFixed(3)}">${duvet}</g>` : duvet);
      // when the headboard is nearer the camera than the pillow, it hides part of the sleeper
      const near = (vv) => eng.scr(...P(u, vv), zb)[1];
      if (near(-bd2 + 0.03) > near(hv - 0.17)) {
        const pts = [];
        [-bw2, bw2].forEach(uu => [-bd2, -bd2 + 0.06].forEach(vv => (f.type === 'bunkbed' ? [0.3, 0.72] : [0, 0.95]).forEach(z => pts.push(eng.scr(...P(uu, vv), zb + z)))));
        html = hideMask(ns + 'hb' + w.i, [hull(pts)]) + `<g mask="url(#${ns}hb${w.i})">${html}</g>`;
      }
      if (f.type === 'bunkbed') {
        /* The whole bunk bed is one piece in the depth sort, so whatever of it is between the
           camera and the sleeper is cut out of them: for the bottom bunk the top bed over it;
           for both, the posts, the ladder and the top bed's guard rails on the camera's side. */
        const zf = eng.baseZ(w.L), box = (u0, u1, v0, v1, z0, z1) => {
          const q = []; [u0, u1].forEach(a => [v0, v1].forEach(b => [z0, z1].forEach(z => q.push(eng.scr(...P(a, b), zf + z))))); return hull(q); };
        const at = (uu, vv) => eng.scr(...P(uu, vv), zf)[1], front = (uu, vv) => at(uu, vv) > at(u, (vv > 0 ? 0.3 : -0.3));
        const polys = zo ? [] : [box(-0.5, 0.5, -1, 1, 1.06, 1.42)];   // the top bed's frame, mattress and duvet
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
          if (front(a * 0.47, b * 0.97)) polys.push(box(a * 0.47 - 0.03, a * 0.47 + 0.03, b * 0.97 - 0.03, b * 0.97 + 0.03, 0, 1.65));
        });
        if (front(-0.5, 0.65)) {   // the ladder, up the left long side near the foot end
          polys.push(box(-0.52, -0.48, 0.42, 0.46, 0, 1.5), box(-0.52, -0.48, 0.84, 0.88, 0, 1.5));
          [0.32, 0.62, 0.92, 1.22].forEach(z => polys.push(box(-0.515, -0.485, 0.46, 0.84, z, z + 0.035)));
        }
        if (zo) {   // the top bed's guard rails
          if (front(0.5, 0)) polys.push(box(0.47, 0.5, -0.94, 0.94, 1.44, 1.5));
          if (front(-0.5, -0.3)) polys.push(box(-0.5, -0.47, -0.94, 0.38, 1.44, 1.5));
        }
        if (polys.length) html = hideMask(ns + 'bunk' + w.i, polys) + `<g mask="url(#${ns}bunk${w.i})">${html}</g>`;
      }
      html = `<g class="hc3d-person hc3d-asleep" data-name="${esc(w.d.name)}"${op < 1 ? ` data-opacity="${op.toFixed(2)}"` : ''}>${html}</g>`;
      if (g) markup = markup.slice(0, g[0]) + html + markup.slice(g[1]); else markup += html;
      const hd = eng.scr(...P(u, hv - 0.17), zb + 0.6), corners = [[-bw2, -bd2], [bw2, -bd2], [bw2, bd2], [-bw2, bd2]].map(([a, b]) => eng.scr(...P(a, b), zb));
      w.screen = { x0: Math.min(...corners.map(c => c[0])), x1: Math.max(...corners.map(c => c[0])), y0: hd[1] - 30, y1: Math.max(...corners.map(c => c[1])) };
      const tag = w.L !== st.level ? '' : w.p.tag != null ? w.p.tag : (opts.tags ? w.d.name : '');
      if (tag) tags.push(`<text class="pic-label hc3d-tag" x="${hd[0].toFixed(1)}" y="${(hd[1] - 24).toFixed(1)}">${esc(tag)}</text>`);
    }
    /* The duvet over a sleeper: a soft lump the width of one person, as wide as the shoulders
       at the top and narrowing toward the feet, its sides sloping down to the sheet at 45°, from the chest to the foot of the bed, in the
       engine's own duvet colours (m-duvet), with the faces the camera sees. Two people in a
       double bed make two lumps side by side. */
    function duvetLump(f, u, L, zo) {
      const H = 0.12, bd2 = eng.FURN[f.type].d / 2, z0 = eng.baseZ(L) + (zo || 0) + 0.5, z1 = z0 + H, v0 = -bd2 + 0.5, v1 = bd2 - 0.03;
      const SH = 0.29, FT = 0.22;   // half-widths at the shoulders and at the feet, where it meets the sheet (m)
      const W = (uu, vv, z) => eng.scr(...eng.furnPt(f, uu, vv), z), pts = q => q.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
      // the outline on the sheet, and the top: every side slopes in at 45°, so the top is H smaller all round
      const C = [[u - SH, v0], [u + SH, v0], [u + FT, v1], [u - FT, v1]];
      const T = [[u - SH + H, v0 + H], [u + SH - H, v0 + H], [u + FT - H, v1 - H], [u - FT + H, v1 - H]];
      const sides = [[0, 1], [1, 2], [2, 3], [3, 0]];
      let out = '';
      sides.forEach(([i, j]) => {
        const a = C[i], b = C[j];
        const q = [W(a[0], a[1], z0), W(b[0], b[1], z0), W(T[j][0], T[j][1], z1), W(T[i][0], T[i][1], z1)];
        // outward-facing toward the camera: the bottom edge, walked from a to b, has the lump on its upper side on screen
        const cx = (q[0][0] + q[1][0]) / 2, cy = (q[0][1] + q[1][1]) / 2, m = W(u, (v0 + v1) / 2, z0);
        if (cy <= m[1] + 0.01) return;
        out += `<polygon class="m-duvet ${cx < m[0] ? 'fl' : 'fr'}" points="${pts(q)}"/>`;
      });
      const top = T.map(([uu, vv]) => W(uu, vv, z1));
      const fold = [W(u - SH + H + 0.01, v0 + H + 0.1, z1), W(u + SH - H - 0.01, v0 + H + 0.1, z1)];
      return out + `<polygon class="m-duvet ft" points="${pts(top)}"/><path d="M${fold[0][0].toFixed(2)} ${fold[0][1].toFixed(2)}L${fold[1][0].toFixed(2)} ${fold[1][1].toFixed(2)}" stroke="rgba(0,0,0,.15)" stroke-width="1.2" fill="none"/>`;
    }

    // words on the floor (as HousePicture), then name tags, drawn last
    const zl = eng.baseZ(st.level) + 0.02;
    (opts.labels || []).forEach(l => {
      const [sx, sy] = eng.scr(l.x, l.y, zl + (l.z || 0));
      markup += `<text class="pic-label${l.num ? ' pic-num' : ''}" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}">${esc(l.text)}</text>`;
    });
    markup += overs.join('') + tags.join('');

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
      const near = who.filter(w => w.L === st.level).concat((opts.aroundAt || []).map(([x, y]) => ({ x, y })));   // aroundAt: other spots to frame
      if (opts.around != null && near.length) {
        // close-up on the people: their spots plus that many metres of room round them
        const m = Number(opts.around) || 0;
        const rs = near.map(w => [{ x0: Math.max(0, w.x - m), x1: Math.min(st.COLS, w.x + m), y0: Math.max(0, w.y - m), y1: Math.min(st.ROWS, w.y + m) }, 0, 0]);
        b = screenBox(rs);
      } else if (opts.focus) {
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
      const pad = opts.focus || opts.around != null ? 8 : 12;
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

  /* A person drawn less than fully solid (opacity < 1: a guess, a memory) is faded. Below
     50 % they also get a dashed outline round the outside of the figure, so even a faint
     ghost reads as a person. The line takes the colour opposite the page (the page's text
     colour, or --hc3d-ghost-line) and the alpha the figure lost: a 30 % figure gets a 70 %
     line. The outline is a ring just inside the edge of the figure's silhouette (a filter: the
     silhouette minus itself shrunk), so the figure stays its own size; the dashes
     come from masking that ring with a fine checkerboard, which breaks a line of any
     direction into short dashes. */
  const GHOST_LINE_BELOW = 0.5;
  function ghost(id, op, art, opts) {
    const width = opts.ghostLine || 1.2, dash = opts.ghostDash || 2.6, faded = `<g opacity="${op.toFixed(3)}">${art}</g>`;
    if (op >= GHOST_LINE_BELOW) return faded;
    const ring = `<filter id="${id}f" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">`
      + `<feMorphology in="SourceAlpha" operator="erode" radius="${width.toFixed(2)}" result="shrunk"/>`
      + `<feComposite in="SourceAlpha" in2="shrunk" operator="out" result="ring"/>`
      + `<feFlood style="flood-color:var(--hc3d-ghost-line, var(--color-text-primary, #1a1a1a))" flood-opacity="${(1 - op).toFixed(3)}"/>`
      + `<feComposite in2="ring" operator="in"/></filter>`
      + `<pattern id="${id}p" patternUnits="userSpaceOnUse" width="${2 * dash}" height="${2 * dash}">`
      + `<rect width="${dash}" height="${dash}" fill="#fff"/><rect x="${dash}" y="${dash}" width="${dash}" height="${dash}" fill="#fff"/></pattern>`
      + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="-9999" y="-9999" width="19998" height="19998"><rect x="-9999" y="-9999" width="19998" height="19998" fill="url(#${id}p)"/></mask>`;
    return faded + ring + `<g mask="url(#${id}m)"><g filter="url(#${id}f)">${art}</g></g>`;
  }
  const isBed = t => /bed/i.test(t) && !/bedside/i.test(t);   // bed, and the single and double beds
  const opacityOf = p => p.opacity != null ? Math.max(0, Math.min(1, +p.opacity)) : 1;

  function pictureDraw(el, house, people, opts) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    el.innerHTML = pictureSvg(house, people, opts);
    return el.firstElementChild;
  }

  global.HouseCharacter3D = { svg: pictureSvg, draw: pictureDraw, viewData, viewPlan, yawFor, garmentArt, looseGarment, PX_PER_M };
})(typeof window !== 'undefined' ? window : globalThis);

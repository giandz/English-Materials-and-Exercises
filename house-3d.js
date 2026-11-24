/* ══════════════════════════════════════════════════════════════════════════
   house-3d.js — 3D models drawn as SVG, for "parts of a thing" lessons.

     House3D.viewer({ container, models:['microwave', …], start:'microwave' })
         A 3D viewer: drag to turn it round (orbit), right-drag / Shift-drag / two
         fingers to move it (pan), wheel / pinch / ＋ − to zoom, ⟲ to reset.
         Point at a part (mouse) or tap it (touch): a leader line comes out of the part
         to a label with its name and what you can do with it:
             lid
             You can:
              ▶ open    ▶ close
         Pressing an action plays it on the model (the lid opens, the knob turns…).
         A row of model buttons above the view (with a small picture of each), and a
         row of the model's parts below it (tap one to show its label).

     <span class="h3d-mini" data-model="toaster" data-part="lever"></span>
     <span class="h3d-mini" data-model="toaster" data-part="lever" data-act="push down"></span>
         A small picture of a model, zoomed on one part and outlined in the accent
         colour. With data-act it plays that action again and again. Any .h3d-mini
         put on the page — now or later (a matching game re-dealing its cards) — is
         drawn by itself. data-height sets its height in px (default 104).
         data-mark="off" draws the part without the outline.

     House3D.define(id, model)   add a model (see the models at the end of this file)
     House3D.models               the models

   A model is boxes, cylinders (and cones) and cords, each with a colour, flat-shaded
   and sorted back to front. Parts have a name and the actions you can do with them;
   an action plays a motion (a group of shapes turns round a pivot or moves) or a
   finger effect (tap, swipe). Light/dark: the model colours stay, the view's
   background, label, outline and leader line come from the house tokens.
   Load after house.js (it uses HouseSpeak when there is one: tap a label's name).
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── styles ─────────────────────────────────────────────────────────────── */
  var STYLE_ID = 'house-3d-css';
  var CSS = ''
    + '.h3d-viewer{ border:.5px solid var(--color-border-tertiary,#ebebee); border-radius:var(--border-radius-lg,12px); background:var(--surface-2,#fff); overflow:hidden; margin-bottom:14px; }'
    + '.h3d-picker{ display:flex; flex-wrap:wrap; gap:6px; padding:10px 10px 0; }'
    + '.h3d-pick{ display:inline-flex; align-items:center; gap:6px; font-family:inherit; font-size:.8667rem; font-weight:500; padding:3px 12px 3px 4px; border-radius:999px; border:1px solid var(--border,#ebebee); background:var(--surface-1,#f7f7f8); color:var(--text-primary,#1a1a1a); cursor:pointer; }'
    + '.h3d-pick[aria-pressed="true"]{ border-color:var(--text-accent,#185fa5); background:var(--color-background-info,#e6f1fb); color:var(--color-text-info,#0c447c); font-weight:600; }'
    + '.h3d-pick .h3d-thumb{ width:34px; height:28px; display:block; }'
    + '.h3d-stage{ position:relative; height:clamp(300px, 62vw, 430px); margin:8px 10px 0; border-radius:var(--border-radius-md,8px); background:var(--surface-1,#f7f7f8); overflow:hidden; }'
    + '.h3d-stage > svg{ position:absolute; inset:0; width:100%; height:100%; display:block; touch-action:none; cursor:grab; user-select:none; -webkit-user-select:none; }'
    + '.h3d-stage > svg:focus-visible{ outline:2px solid var(--text-accent,#185fa5); outline-offset:-2px; }'
    + '.h3d-stage.h3d-dragging > svg{ cursor:grabbing; }'
    + '.h3d-stage.h3d-on-part > svg{ cursor:pointer; }'
    + '.h3d-label{ position:absolute; z-index:2; min-width:7.5rem; max-width:12rem; background:var(--surface-2,#fff); border:1.5px solid var(--text-accent,#185fa5); border-radius:var(--border-radius-md,8px); padding:7px 11px 8px; box-shadow:0 4px 14px rgba(0,0,0,.14); font-size:.8667rem; line-height:1.45; color:var(--text-primary,#1a1a1a); }'
    + '.h3d-label[hidden]{ display:none; }'
    + '.h3d-name{ font-weight:700; font-size:1rem; color:var(--text-accent,#185fa5); cursor:pointer; }'
    + '.h3d-can{ color:var(--text-secondary,#5b5b60); font-size:.8rem; margin-top:1px; }'
    + '.h3d-label ul{ list-style:none; margin:2px 0 0; padding:0; display:flex; flex-direction:column; gap:3px; }'
    + '.h3d-act{ font-family:inherit; font-size:.8667rem; font-weight:500; padding:2px 10px 2px 7px; border-radius:999px; border:1px solid var(--border,#ebebee); background:var(--surface-1,#f7f7f8); color:var(--text-primary,#1a1a1a); cursor:pointer; text-align:left; }'
    + '.h3d-act:hover{ background:var(--color-background-info,#e6f1fb); border-color:var(--text-accent,#185fa5); }'
    + '.h3d-act.h3d-still{ cursor:default; background:none; border-color:transparent; padding-left:0; }'
    + '.h3d-act.h3d-still:hover{ background:none; border-color:transparent; }'
    + '.h3d-close{ position:absolute; top:2px; right:4px; font-size:.8rem; padding:0 5px; border:none; background:none; color:var(--text-muted,#8b8b90); cursor:pointer; }'
    + '.h3d-tools{ position:absolute; right:8px; bottom:8px; z-index:3; display:flex; gap:5px; }'
    + '.h3d-tools button{ width:34px; height:34px; padding:0; border-radius:50%; font-size:1rem; line-height:1; border:1px solid var(--border,#ebebee); background:var(--surface-2,#fff); color:var(--text-primary,#1a1a1a); cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.1); }'
    + '.h3d-hint{ position:absolute; left:10px; bottom:10px; z-index:1; right:130px; font-size:.7333rem; color:var(--text-muted,#8b8b90); pointer-events:none; line-height:1.35; }'
    + '.h3d-parts{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:10px; }'
    + '.h3d-parts-label{ font-size:.7333rem; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:var(--text-muted,#8b8b90); margin-right:2px; }'
    + '.h3d-part{ font-family:inherit; font-size:.8667rem; font-weight:500; padding:4px 12px; border-radius:999px; border:1.5px solid var(--color-border-secondary,#e3e3e6); background:var(--surface-2,#fff); color:var(--text-primary,#1a1a1a); cursor:pointer; }'
    + '.h3d-part[aria-pressed="true"]{ border-color:var(--text-accent,#185fa5); background:var(--color-background-info,#e6f1fb); color:var(--color-text-info,#0c447c); }'
    + '.h3d-mini{ display:block; width:100%; min-width:96px; height:var(--h3d-h,104px); border-radius:var(--border-radius-md,8px); background:var(--surface-1,#f7f7f8); overflow:hidden; }'
    + '.h3d-mini > svg{ display:block; width:100%; height:100%; }'
    + '.h3d-leader{ fill:none; stroke:var(--text-accent,#185fa5); stroke-width:1.5; }'
    + '.h3d-dot{ fill:var(--text-accent,#185fa5); stroke:var(--surface-2,#fff); stroke-width:1.5; }'
    + '.h3d-finger{ fill:rgba(255,255,255,.75); stroke:var(--text-accent,#185fa5); stroke-width:2; }'
    + '.h3d-ring{ fill:none; stroke:var(--text-accent,#185fa5); stroke-width:2; }'
    + '.h3d-trail{ fill:none; stroke:var(--text-accent,#185fa5); stroke-width:3; stroke-linecap:round; opacity:.45; }';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── vectors ────────────────────────────────────────────────────────────── */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mean(ps) { var c = [0, 0, 0]; ps.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); return mul(c, 1 / ps.length); }
  var AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  /* turn p round an axis through a pivot (Rodrigues) */
  function rotate(p, axis, deg, pivot) {
    if (!deg) return p;
    var k = AX[axis] || norm(axis), t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    var v = sub(p, pivot || [0, 0, 0]);
    var r = add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
    return add(r, pivot || [0, 0, 0]);
  }

  /* ── colours ────────────────────────────────────────────────────────────── */
  function rgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) { m = /rgba?\(([^)]+)\)/.exec(String(hex)); if (m) return m[1].split(',').slice(0, 3).map(Number); return [24, 95, 165]; }
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function css(c) { return 'rgb(' + Math.round(Math.max(0, Math.min(255, c[0]))) + ',' + Math.round(Math.max(0, Math.min(255, c[1]))) + ',' + Math.round(Math.max(0, Math.min(255, c[2]))) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function accent() {
    try { return rgb(getComputedStyle(document.documentElement).getPropertyValue('--text-accent') || '#185fa5'); } catch (e) { return [24, 95, 165]; }
  }

  /* ── shapes → faces ─────────────────────────────────────────────────────── */
  /* every face is turned to face outward from its shape's middle, so faces that
     look away from the camera can be skipped */
  function orient(pts, ref) {
    var n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    return dot(n, sub(mean(pts), ref)) < 0 ? pts.slice().reverse() : pts;
  }
  /* skip: faces left out ('front' +z, 'back', 'top', 'bottom', 'right' +x, 'left');
     inside: the faces look in, not out (the walls of a hollow: an oven, a well) */
  var SIDES = ['front', 'back', 'top', 'bottom', 'right', 'left'];
  function boxFaces(e, skip, inside) {
    var x0 = e[0], x1 = e[1], y0 = e[2], y1 = e[3], z0 = e[4], z1 = e[5], c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    return [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]
    ].map(function (f) { f = orient(f, c); return inside ? f.slice().reverse() : f; })
      .filter(function (f, i) { return !skip || skip.indexOf(SIDES[i]) < 0; });
  }
  /* open: 'top' (the + end) / 'bottom' / 'both' leaves that end open; inside: the faces look in */
  function cylFaces(c, axis, r, len, r2, seg, open, inside, flat) {
    seg = seg || 20; r2 = r2 == null ? r : r2;
    var map = { x: function (a, b, h) { return [c[0] + h, c[1] + a, c[2] + b]; }, y: function (a, b, h) { return [c[0] + a, c[1] + h, c[2] + b]; }, z: function (a, b, h) { return [c[0] + a, c[1] + b, c[2] + h]; } }[axis];
    var lo = [], hi = [], faces = [];
    for (var i = 0; i < seg; i++) {
      var t = i / seg * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
      lo.push(map(r * ca, r * sa, -len / 2)); hi.push(map(r2 * ca, r2 * sa, len / 2));
    }
    if (!flat) for (i = 0; i < seg; i++) { var j = (i + 1) % seg; faces.push(orient([lo[i], lo[j], hi[j], hi[i]], c)); }
    if (open !== 'bottom' && open !== 'both') faces.push(orient(lo, c));
    if (open !== 'top' && open !== 'both') faces.push(orient(hi, c));
    return inside ? faces.map(function (f) { return f.slice().reverse(); }) : faces;
  }
  function tubeFaces(pts, r) {
    var faces = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], d = norm(sub(b, a));
      var up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var u = mul(norm(cross(d, up)), r), w = mul(norm(cross(d, u)), r), m = mul(add(a, b), 0.5);
      var q = [add(u, w), sub(u, w), mul(add(u, w), -1), sub(w, u)];
      for (var k = 0; k < 4; k++) {
        var k2 = (k + 1) % 4;
        faces.push(orient([add(a, q[k]), add(b, q[k]), add(b, q[k2]), add(a, q[k2])], m));
      }
    }
    return faces;
  }

  /* a model, made ready to draw: its faces, groups and motions */
  function compile(model) {
    if (model._faces) return model;
    var faces = [];
    /* the model's size first: small things on a surface (knobs, buttons, screens…) are sorted a little
       in front of the big faces they sit on, so a big face never hides them */
    var ext = function (s) {
      if (s.t === 'box') return Math.max(s.e[1] - s.e[0], s.e[3] - s.e[2], s.e[5] - s.e[4]);
      if (s.t === 'top') return Math.max(s.e[1] - s.e[0], s.e[4] - s.e[3]);
      if (s.t === 'cyl') return Math.max(2 * s.r, s.len);
      if (s.t === 'faces') { var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; s.faces.forEach(function (f) { f.forEach(function (q) { for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } }); }); return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); }
      return 1e9;
    };
    var big = Math.max.apply(null, model.shapes.map(function (s) { return s.t === 'tube' ? 0 : ext(s); }));
    model.shapes.forEach(function (s, si) {
      var fs = s.t === 'box' ? boxFaces(s.e, s.skip, s.inside) : s.t === 'cyl' ? cylFaces(s.c, s.ax, s.r, s.len, s.r2, s.seg, s.open, s.inside, s.flat)
        : s.t === 'top' ? [[[s.e[0], s.e[2], s.e[3]], [s.e[0], s.e[2], s.e[4]], [s.e[1], s.e[2], s.e[4]], [s.e[1], s.e[2], s.e[3]]]].map(function (f) { return orient(f, [0, -1e6, 0]); })
        : s.t === 'faces' ? s.faces : s.t === 'tube' ? null : [];
      if (s.t === 'tube') { faces.push({ tube: s, shape: si }); return; }
      fs.forEach(function (f) { faces.push({ pts: f, col: rgb(s.col), part: s.part || null, group: s.group || s.part || null, id: s.id || null, on: s.on || null, layer: s.layer || 1, bias: (s.bias || 0) + (ext(s) < big * 0.3 ? 2.5 : 0), clipY: s.clipY, clipZ: s.clipZ, seamless: s.seamless, key: s.key, shape: si }); });
    });
    model._faces = faces;
    /* bounds: the middle and the size the camera fits */
    var all = [];
    faces.forEach(function (f) { (f.pts || f.tube.pts).forEach(function (p) { all.push(p); }); });
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    all.forEach(function (p) { for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } });
    model._center = mul(add(lo, hi), 0.5);
    /* the machine itself, without its power cord, plug and socket: what the camera looks at */
    var POWER = { cord: 1, plug: 1, socket: 1, charger: 1, connector: 1 }, clo = [1e9, 1e9, 1e9], chi = [-1e9, -1e9, -1e9];
    faces.forEach(function (f) { if (f.tube || POWER[f.part]) return; f.pts.forEach(function (p) { for (var i = 0; i < 3; i++) { clo[i] = Math.min(clo[i], p[i]); chi[i] = Math.max(chi[i], p[i]); } }); });
    if (clo[0] < 1e9) model._center = mul(add(clo, chi), 0.5);
    model._radius = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.66;
    /* where each part is, for the leader line and the zoomed pictures */
    model._partAt = {};
    Object.keys(model.parts).forEach(function (id) {
      var ps = [];
      faces.forEach(function (f) { if (f.part === id) ps = ps.concat(f.pts); else if (f.tube && f.tube.part === id) ps = ps.concat(f.tube.pts); });
      model._partAt[id] = model.parts[id].at || (ps.length ? mean(ps) : model._center);
    });
    return model;
  }

  /* ── a scene: one model, its motions now, and a camera ───────────────────── */
  function Scene(model) {
    this.m = compile(model);
    this.val = {};          // motion → value now (0 … 1, or more for a knob that keeps turning)
    this.anim = {};         // motion → { from, to, t0, dur, next }
    this.fx = [];           // finger effects playing
    Object.keys(this.m.motions || {}).forEach(function (k) { this.val[k] = this.m.motions[k].start || 0; }, this);
    this.state = { ch: 0, src: 0 };                                                // the TV's channel and source (0 = TV, 1 = video 1…)
    this.now = performance.now();
    this.dtext = (this.m.displays || []).map(function (d) { return d.text; });    // what each 7-segment display says
    this.sp = (this.m.spins || []).map(function () { return { a: 0, r: 0 }; });   // things that keep turning: angle, speed
    this.lv = (this.m.lights || []).map(function () { return 0; });               // how bright each light is now (0 … 1)
    this.dv = (this.m.displays || []).map(function () { return 0; });
    this.tm = (this.m.timers || []).map(function () { return null; });
    this.queue = [];                                                                // steps waiting to be played: { t, act }            // when each timer started (-1: it has fired)
    this.last = null;
    this.settle();
  }
  /* lights and displays straight to what they should be now (no fading) */
  Scene.prototype.settle = function () {
    var self = this;
    (this.m.lights || []).forEach(function (l, i) { self.lv[i] = l.when(self) ? 1 : 0; });
    (this.m.displays || []).forEach(function (d, i) { self.dv[i] = d.when(self) ? 1 : 0; });
  };
  Scene.prototype.on = function (k) { return (this.val[k] || 0) > 0.5; };
  /* plugged in: the plug all the way in (a model with no plug has batteries) */
  Scene.prototype.plugged = function () { return !this.m.motions.plug || this.val.plug > 0.97; };
  Scene.prototype.ops = function (g) {
    /* the moves on group g (in motion order), then its parent's */
    var out = [], m = this.m, self = this;
    Object.keys(m.motions || {}).forEach(function (k) {
      var v = self.val[k];
      (m.motions[k].do || []).forEach(function (op) {
        if (op.g !== g || !v) return;
        if (op.rot) out.push({ rot: op.rot, deg: op.rot.deg * v });
        if (op.move) out.push({ move: mul(op.move, Math.min(v, 1)) });
      });
    });
    (m.spins || []).forEach(function (sp, i) {
      if (sp.g !== g) return;
      var st = self.sp[i];
      if (sp.wobble) { if (st.r > 0.001) out.push({ move: mul(sp.wobble, Math.sin(st.a * Math.PI / 180) * st.r) }); }
      else if (sp.swing) { var sw = sp.swing * Math.sin(st.a * Math.PI / 180); if (sw) out.push({ rot: { ax: sp.ax, pivot: sp.pivot }, deg: sw }); }
      else if (st.a) out.push({ rot: { ax: sp.ax, pivot: sp.pivot }, deg: st.a });
    });
    /* a group that works out its own moves (a mixer attachment between the head and the table) */
    if (m.groups && m.groups[g] && m.groups[g].ops) return out.concat(m.groups[g].ops(this));
    var par = m.groups && m.groups[g] && m.groups[g].parent;
    return par ? out.concat(this.ops(par)) : out;
  };
  Scene.prototype.place = function (p, ops) {
    for (var i = 0; i < ops.length; i++) p = ops[i].rot ? rotate(p, ops[i].rot.ax, ops[i].deg, ops[i].rot.pivot) : add(p, ops[i].move);
    return p;
  };
  /* → { col, lv } for the brightest light on group g now, or null */
  Scene.prototype.lit = function (g) {
    var self = this, best = null;
    (this.m.lights || []).forEach(function (l, i) {
      if (l.g !== g || self.lv[i] < 0.003 || (best && self.lv[i] <= best.lv)) return;
      best = { lv: self.lv[i], col: typeof l.col === 'function' ? l.col(self) : (l.col || [255, 214, 90]) };
    });
    return best;
  };
  Scene.prototype.world = function (now) {
    /* every face where it is now */
    var self = this, cache = {}, litCache = {}, out = [], pressed = this.pressed(now || performance.now());
    var litOf = function (g) { if (!g) return null; if (!(g in litCache)) litCache[g] = self.lit(g); return litCache[g]; };
    var opsOf = function (g) { if (!g) return []; if (!cache[g]) cache[g] = self.ops(g); return cache[g]; };
    this.m._faces.forEach(function (f) {
      if (f.tube) {
        var t = f.tube, pts = t.pts.slice();
        if (t.endGroup) pts[pts.length - 1] = self.place(pts[pts.length - 1], opsOf(t.endGroup));
        if (t.startGroup) pts[0] = self.place(pts[0], opsOf(t.startGroup));
        if (t.group) { var tops = opsOf(t.group); if (tops.length) pts = pts.map(function (p) { return self.place(p, tops); }); }
        var tl = litOf(t.group), tc = rgb(t.col);   /* a cord or a coil: it can glow (a hot plate on a stove) */
        tubeFaces(pts, t.r).forEach(function (q) { out.push({ pts: q, col: tl ? mix(tc, tl.col, tl.lv) : tc, glow: tl ? tl.lv : 0, part: t.part || null, bias: t.bias || 0 }); });
        return;
      }
      var ops = opsOf(f.group), pts = ops.length ? f.pts.map(function (p) { return self.place(p, ops); }) : f.pts;
      if (f.clipY != null) pts = pts.map(function (p) { return p[1] < f.clipY ? [p[0], f.clipY, p[2]] : p; });
      if (f.clipZ != null) pts = pts.map(function (p) { return p[2] < f.clipZ ? [p[0], p[1], f.clipZ] : p; });
      var col = f.col, lc = litOf(f.group);
      if (f.key != null && pressed[f.key]) { var d = pressed[f.key]; pts = pts.map(function (p) { return [p[0], p[1] - 0.3 * d, p[2]]; }); col = mul(col, 1 - 0.35 * d); }
      out.push({ pts: pts, col: lc ? mix(col, lc.col, lc.lv) : col, glow: lc ? lc.lv : 0, part: f.part, bias: f.bias, id: f.id, on: f.on, layer: f.layer, seamless: f.seamless });
    });
    /* 7-segment displays: the lit segments, lying on their screen */
    (this.m.displays || []).forEach(function (d, i) {
      var lv = self.dv[i];
      if (lv < 0.01) return;
      var ops = opsOf(d.g), u = d.u || [1, 0, 0], v = d.v || [0, 1, 0], col = mix(rgb(d.bg || '#000000'), rgb(d.col), lv);
      var text = d.textFn ? d.textFn(self) : self.dtext[i];
      (d.font === 'pix' ? pixPolys(text, d.h) : segPolys(text, d.h)).forEach(function (poly) {
        var pts = poly.map(function (q) { var p = add(add(d.at, mul(u, q[0])), mul(v, q[1])); return ops.length ? self.place(p, ops) : p; });
        out.push({ pts: pts, col: col, glow: lv, part: d.part, bias: 0, id: null, on: d.on, layer: d.layer || 3 });
      });
    });
    return out;
  };
  /* keys going down and up one after another: key number → how far down now (0 … 1) */
  Scene.prototype.pressed = function (now) {
    var out = {};
    this.fx.forEach(function (f) {
      if (f.act.fx !== 'keys') return;
      f.seq.forEach(function (q) {
        var u = (now - f.t0 - q.t) / 170;
        if (u > 0 && u < 1) out[q.k] = Math.max(out[q.k] || 0, Math.sin(Math.PI * u));
      });
    });
    return out;
  };
  Scene.prototype.groupPoint = function (p, g) { return g ? this.place(p, this.ops(g)) : p; };
  Scene.prototype.partPoint = function (id) {
    var part = this.m.parts[id], p = this.m._partAt[id];
    return this.groupPoint(p, part && (part.group || this.groupOfPart(id)));
  };
  Scene.prototype.groupOfPart = function (id) {
    var f = this.m._faces.filter(function (x) { return x.part === id && x.group; })[0];
    return f ? f.group : null;
  };

  /* play an action: a motion, or a finger effect */
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  Scene.prototype.play = function (act, now) {
    now = now || performance.now();
    var self = this;
    if (act.wait) { this.queue.push({ t: now + act.wait, act: Object.assign({}, act, { wait: 0 }) }); return; }   /* later */
    if (act.if && !act.if(this)) return;   /* only when… (the bread jumps only if it is down) */
    if (act.seq) { act.seq(this).forEach(function (a) { self.play(a, now); }); return; }   /* a series of steps (with wait: ms) */
    if (act.also) [].concat(act.also).forEach(function (a) { self.play(a, now); });
    if (act.fx === 'read') {   /* a 7-segment display shows something new — if it is on */
      var di = (this.m.displays || []).map(function (d) { return d.id; }).indexOf(act.d), d = this.m.displays[di];
      if (d && this.dv[di] > 0.5) this.dtext[di] = (RAND[d.kind] || RAND.num2)();
      return;
    }
    if (act.fx === 'channel') {   /* back to the TV picture, then the next channel */
      var n = this.m.channels || 4;
      if (this.state.src) this.state.src = 0; else this.state.ch = (this.state.ch + (act.dir || 1) + n) % n;
      return;
    }
    if (act.fx === 'source') { this.state.src = (this.state.src + 1) % (this.m.sources || 3); return; }
    if (act.fx === 'keys') {   /* random keys, one after another */
      var n = this.m.keyCount || 0, seq = [], gap = act.gap || 140, last = -1;
      for (var q = 0; q < (act.count || 6) && n; q++) {
        var k; do { k = Math.floor(Math.random() * n); } while (k === last && n > 1);
        last = k; seq.push({ k: k, t: q * gap });
      }
      this.fx.push({ act: act, t0: now, seq: seq, dur: (act.count || 6) * gap + 220 });
      return;
    }
    if (act.fx) { this.fx.push({ act: act, t0: now, dur: act.fx === 'swipe' ? 900 : 750 }); return; }
    var k = act.m, mo = this.m.motions[k];
    if (!mo) return;
    var v = this.value(k, now), dur = act.dur || mo.dur || 650, to = act.to;
    if (to === 'toggle') to = v > 0.5 ? 0 : 1;
    if (to === 'step') to = Math.round(v) + 1;
    if (to === 'cycle') to = (Math.round(v) + 1) % ((act.max || 3) + 1);
    if (to === 'up' || to === 'down') {   /* a volume: one step up or down, 0 … max */
      var st = act.step || mo.step || 0.2, mx = act.max || 1;
      to = Math.max(0, Math.min(mx, Math.round(v / st + (to === 'up' ? 1 : -1)) * st));
    }
    if (to === 'bounce') {
      var times = act.times || 1, seq = [];
      for (var i = 0; i < times; i++) seq.push(1, 0);
      this.anim[k] = { from: v, to: seq.shift(), t0: now, dur: dur, next: seq };
      return;
    }
    this.anim[k] = { from: v, to: to, t0: now, dur: act.dur ? act.dur : dur * Math.max(0.4, Math.abs(to - v)), next: [] };
  };
  Scene.prototype.value = function (k) { return this.val[k]; };
  /* → true while something is still moving */
  Scene.prototype.tick = function (now) {
    var busy = false, self = this, dt = this.last == null ? 16 : Math.max(0, Math.min(100, now - this.last));
    this.last = now; this.now = now;
    var fade = function (arr, i, on, inMs, outMs) {
      var t = on ? 1 : 0, v = arr[i];
      if (v === t) return;
      v += (t > v ? 1 : -1) * dt / (t > v ? (inMs || 250) : (outMs || 250));
      arr[i] = t > arr[i] ? Math.min(t, v) : Math.max(t, v);
      busy = true;
    };
    (this.m.lights || []).forEach(function (l, i) { fade(self.lv, i, l.when(self), l.fadeIn, l.fadeOut); });
    (this.m.displays || []).forEach(function (d, i) { fade(self.dv, i, d.when(self), d.fadeIn || 300, d.fadeOut || 400); });
    /* timers: when() has been true for after() ms → play act (once, until when() is false again) */
    if (this.m.alive && this.m.alive(this)) busy = true;   /* a light that keeps going on and off */
    (this.m.timers || []).forEach(function (tm, i) {
      if (!tm.when(self)) { self.tm[i] = null; return; }
      if (self.tm[i] == null) self.tm[i] = now;
      if (self.tm[i] < 0) return;
      busy = true;
      if (now - self.tm[i] >= (typeof tm.after === 'function' ? tm.after(self) : tm.after)) { self.tm[i] = -1; [].concat(tm.act).forEach(function (a) { self.play(a, now); }); }
    });
    (this.m.spins || []).forEach(function (sp, i) {
      var st = self.sp[i], soft = sp.wobble || sp.swing, target = soft ? (sp.when(self) ? (sp.scale ? sp.scale(self) : 1) : 0) : sp.rate(self);
      st.r += (target - st.r) * Math.min(1, dt / (sp.ease || 700));
      if (Math.abs(st.r - target) < (soft ? 0.002 : 0.3)) st.r = target;
      /* a swing keeps where it is when it stops (its phase stops); a wobble shakes in place */
      st.a = sp.wobble ? (st.a + 360 * sp.hz * dt / 1000) % 360 : sp.swing ? (st.a + 360 * sp.hz * st.r * dt / 1000) % 360 : (st.a + st.r * dt / 1000) % 360;
      if (st.r || target) busy = true;
    });
    Object.keys(this.anim).forEach(function (k) {
      var a = self.anim[k], t = (now - a.t0) / a.dur;
      self.val[k] = a.from + (a.to - a.from) * ease(t);
      if (t >= 1) {
        self.val[k] = a.to;
        if (a.next && a.next.length) self.anim[k] = { from: a.to, to: a.next.shift(), t0: now, dur: a.dur, next: a.next };
        else delete self.anim[k];
      }
      busy = true;
    });
    this.fx = this.fx.filter(function (f) { return now - f.t0 < f.dur; });
    var due = this.queue.filter(function (q) { return q.t <= now; });
    this.queue = this.queue.filter(function (q) { return q.t > now; });
    due.forEach(function (q) { self.play(q.act, now); });
    return busy || this.fx.length > 0 || this.queue.length > 0 || due.length > 0;
  };
  Scene.prototype.busy = function () { return Object.keys(this.anim).length > 0 || this.fx.length > 0; };

  /* ── 7-segment digits ─────────────────────────────────────────────────────
     text: digits, '-', '°', ' ', ':' and '.' (a decimal point after the digit before it).
     → polygons in the display's own plane, centred on 0,0; h = the height of a digit */
  var SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', '°': 'abfg', ' ': '' };
  function segPolys(text, h) {
    var w = h * 0.52, t = h * 0.15, gap = h * 0.22, sk = 0.1, glyphs = [];
    String(text).split('').forEach(function (ch) { if (ch === '.' && glyphs.length) glyphs[glyphs.length - 1].dot = true; else glyphs.push({ ch: ch }); });
    var widthOf = function (g) { return g.ch === ':' ? t * 2.2 : w; };
    var total = glyphs.reduce(function (sum, g) { return sum + widthOf(g); }, 0) + gap * (glyphs.length - 1);
    var x = -total / 2, y0 = -h / 2, out = [];
    var rect = function (a, b, c, d) { return [[a + b * sk, b], [c + b * sk, b], [c + d * sk, d], [a + d * sk, d]]; };
    glyphs.forEach(function (g) {
      if (g.ch === ':') { out.push(rect(x + t * 0.6, y0 + h * 0.22, x + t * 1.6, y0 + h * 0.22 + t)); out.push(rect(x + t * 0.6, y0 + h * 0.66, x + t * 1.6, y0 + h * 0.66 + t)); }
      else {
        var m = t * 0.55, X0 = x, X1 = x + w, Ym = y0 + h / 2;
        var R = { a: [X0 + m, y0 + h - t, X1 - m, y0 + h], d: [X0 + m, y0, X1 - m, y0 + t], g: [X0 + m, Ym - t / 2, X1 - m, Ym + t / 2],
          f: [X0, Ym + t * 0.25, X0 + t, y0 + h - m], b: [X1 - t, Ym + t * 0.25, X1, y0 + h - m], e: [X0, y0 + m, X0 + t, Ym - t * 0.25], c: [X1 - t, y0 + m, X1, Ym - t * 0.25] };
        (SEG[g.ch] || '').split('').forEach(function (k) { var r = R[k]; out.push(rect(r[0], r[1], r[2], r[3])); });
        if (g.dot) out.push(rect(X1 + gap * 0.2, y0, X1 + gap * 0.2 + t, y0 + t));
      }
      x += widthOf(g) + gap;
    });
    return out;
  }
  /* a small dot-matrix font (5 × 7) for on-screen text: CH 2, VIDEO-1 */
  var PIX = {
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], 'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'], 'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], 'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], 'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
  };
  function pixPolys(text, h) {
    var px = h / 7, chars = String(text).toUpperCase().split(''), w = chars.length * 6 * px - px, out = [];
    chars.forEach(function (ch, k) {
      (PIX[ch] || PIX[' ']).forEach(function (row, r) {
        row.split('').forEach(function (b, c) {
          if (b !== '1') return;
          var x = -w / 2 + (k * 6 + c) * px, y = h / 2 - (r + 1) * px, g = px * 0.12;
          out.push([[x + g, y + g], [x + px - g, y + g], [x + px - g, y + px - g], [x + g, y + px - g]]);
        });
      });
    });
    return out;
  }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  /* what "read" shows next: a time, minutes left, a radio station, a freezer temperature */
  var RAND = {
    time: function () { return two(1 + rnd(12)) + ':' + two(rnd(60)); },
    num2: function () { return String(10 + rnd(90)); },
    freq: function () { return ((875 + rnd(206)) / 10).toFixed(1); },
    temp: function () { return '-' + (15 + rnd(9)) + '°'; }
  };

  /* ── the camera and the drawing ─────────────────────────────────────────── */
  function Camera(scene, w, h) {
    this.yaw = scene.m.view ? scene.m.view.yaw : -30;
    this.pitch = scene.m.view ? scene.m.view.pitch : 20;
    this.zoom = (scene.m.view && scene.m.view.zoom) || 1; this.pan = [0, 0];
    this.target = scene.m._center;
    this.radius = scene.m._radius;
    this.w = w; this.h = h;
  }
  Camera.prototype.toCam = function (p) {
    var v = sub(p, this.target), y = this.yaw * Math.PI / 180, x = this.pitch * Math.PI / 180;
    var a = [v[0] * Math.cos(y) + v[2] * Math.sin(y), v[1], -v[0] * Math.sin(y) + v[2] * Math.cos(y)];
    return [a[0], a[1] * Math.cos(x) - a[2] * Math.sin(x), a[1] * Math.sin(x) + a[2] * Math.cos(x)];
  };
  Camera.prototype.D = function () { return this.radius * 5; };
  Camera.prototype.scale = function () { return Math.min(this.w, this.h) * 0.47 / this.radius * this.zoom; };
  Camera.prototype.toScreen = function (c) {
    var D = this.D(), k = D / Math.max(D - c[2], D * 0.15) * this.scale();
    return [this.w / 2 + this.pan[0] + c[0] * k, this.h / 2 + this.pan[1] - c[1] * k];
  };
  Camera.prototype.project = function (p) { return this.toScreen(this.toCam(p)); };

  var LIGHT = norm([-0.35, 0.7, 0.62]);
  function f1(n) { return Math.round(n * 10) / 10; }

  /* the faces as SVG paths, back to front; `mark` = the part drawn in the accent colour */
  function drawFaces(scene, cam, mark, now) {
    var D = cam.D(), eye = [0, 0, D], list = [];
    scene.world(now).forEach(function (f) {
      var cp = f.pts.map(function (p) { return cam.toCam(p); });
      var n = norm(cross(sub(cp[1], cp[0]), sub(cp[2], cp[0])));
      var mid = mean(cp);
      if (dot(n, sub(eye, mid)) <= 0) return;
      var sh = 0.5 + 0.55 * Math.max(0, dot(n, LIGHT)) + 0.08 * Math.max(0, n[2]), light = sh + (1.08 - sh) * (f.glow || 0);
      var col = mul(f.col, light);
      var on = mark && f.part === mark, edge = mul(col, 0.8);
      if (on) {   /* the part pointed at: a thick outline in the opposite colour (black or white when that is too close) */
        var c2 = [Math.min(255, col[0]), Math.min(255, col[1]), Math.min(255, col[2])], inv = [255 - c2[0], 255 - c2[1], 255 - c2[2]];
        var lum = function (c) { return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; };
        edge = Math.abs(lum(inv) - lum(c2)) > 90 ? inv : lum(c2) > 128 ? [0, 0, 0] : [255, 255, 255];
        col = mix(col, inv, 0.1);
      }
      list.push({ id: f.id, on: f.on, layer: f.layer, n: n, mid: mid, z: mid[2] + f.bias, d: 'M' + cp.map(function (c) { var s = cam.toScreen(c); return f1(s[0]) + ',' + f1(s[1]); }).join('L') + 'Z', fill: css(col), stroke: on ? css(edge) : css(f.seamless ? col : edge), sw: on ? 1.8 : 0.6, part: f.part });
    });
    /* a thing lying on a surface ("on") is drawn just after that surface's face that looks the same way */
    var settle = function (x, depth) {
      if (!x.on || x.done || depth > 6) return;
      var best = null;
      list.forEach(function (y) { if (y.id === x.on && y !== x && dot(y.n, x.n) > 0.9 && (!best || y.z > best.z)) best = y; });
      if (best) {
        /* the back of a thing lying on a surface is inside the machine: not drawn */
        if (dot(sub(x.mid, best.mid), x.n) < -0.001) x.hidden = true;
        settle(best, depth + 1); x.z = best.z + 0.01 * (x.layer || 1);
      } else {
        /* a side of a thing sticking out of the surface (a knob's edge): never behind the surface it stands on */
        var alt = null;
        list.forEach(function (y) { if (y.id === x.on && y !== x && dot(y.n, x.n) > -0.05 && (!alt || y.z > alt.z)) alt = y; });
        if (alt) { settle(alt, depth + 1); x.z = Math.max(x.z, alt.z + 0.01 * (x.layer || 1)); }
      }
      x.done = true;
    };
    list.forEach(function (x) { settle(x, 0); });
    list = list.filter(function (x) { return !x.hidden; });
    /* the glow of a light, sorted in with the faces: walls in front of it hide it */
    (scene.m.lights || []).forEach(function (l, i) {
      var lv = scene.lv[i];
      if (!l.glow || lv < 0.01) return;
      var p = scene.groupPoint(l.glow, l.g), c = cam.project(p), r = (l.glowR || 9) * cam.scale() * (0.6 + 0.4 * lv);
      list.push({ z: cam.toCam(p)[2] + (l.glowBias == null ? 1 : l.glowBias), raw: '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '" fill="url(#h3dGlow' + (l.glowCol === 'white' ? 'W' : '') + ')" opacity="' + f1(lv) + '" pointer-events="none"/>' });
    });
    list.sort(function (a, b) { return a.z - b.z; });
    return list.map(function (x) {
      if (x.raw) return x.raw;
      return '<path d="' + x.d + '" fill="' + x.fill + '" stroke="' + x.stroke + '" stroke-width="' + x.sw + '" stroke-linejoin="round"' + (x.part ? ' data-part="' + x.part + '"' : '') + '/>';
    }).join('');
  }
  /* light from a lamp, finger taps and swipes */
  function drawFx(scene, cam, now) {
    var out = '', m = scene.m;
    scene.fx.forEach(function (f) {
      var t = Math.min(1, (now - f.t0) / f.dur), a = f.act;
      if (a.fx === 'tap') {
        var p = cam.project(scene.groupPoint(a.at, a.g));
        out += '<circle class="h3d-ring" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(4 + 18 * t) + '" opacity="' + f1(1 - t) + '"/>'
          + '<circle class="h3d-finger" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(t < 0.35 ? 9 - 6 * t : 7) + '" opacity="' + f1(t > 0.7 ? (1 - t) / 0.3 : 1) + '"/>';
      } else if (a.fx === 'swipe') {
        var u = ease(Math.min(1, t / 0.8)), A = cam.project(scene.groupPoint(a.from, a.g)), B = cam.project(scene.groupPoint(a.to, a.g));
        var P = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u], T = [A[0] + (B[0] - A[0]) * Math.max(0, u - 0.35), A[1] + (B[1] - A[1]) * Math.max(0, u - 0.35)];
        var op = t > 0.8 ? (1 - t) / 0.2 : 1;
        out += '<path class="h3d-trail" d="M' + f1(T[0]) + ',' + f1(T[1]) + 'L' + f1(P[0]) + ',' + f1(P[1]) + '" opacity="' + f1(op * 0.9) + '"/>'
          + '<circle class="h3d-finger" cx="' + f1(P[0]) + '" cy="' + f1(P[1]) + '" r="8" opacity="' + f1(op) + '"/>';
      }
    });
    return out;
  }
  var DEFS = '<defs><radialGradient id="h3dGlow"><stop offset="0" stop-color="#ffe27a" stop-opacity=".85"/><stop offset=".45" stop-color="#ffd24a" stop-opacity=".35"/><stop offset="1" stop-color="#ffd24a" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="h3dGlowW"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".3" stop-color="#f4f8ff" stop-opacity=".75"/><stop offset="1" stop-color="#e8f0ff" stop-opacity="0"/></radialGradient></defs>';

  function actionsOf(model, id) {
    return (model.parts[id].can || []).map(function (a) { return typeof a === 'string' ? { v: a } : a; });
  }

  /* ══ the viewer ══════════════════════════════════════════════════════════ */
  function viewer(o) {
    injectStyles();
    var host = typeof o.container === 'string' ? document.getElementById(o.container) : o.container;
    var ids = o.models || Object.keys(MODELS);
    host.classList.add('h3d-viewer');
    host.innerHTML = '<div class="h3d-picker" role="group" aria-label="Choose a device"></div>'
      + '<div class="h3d-stage"><svg tabindex="0" role="img" aria-label="3D model"></svg><div class="h3d-label" hidden></div>'
      + '<div class="h3d-hint">' + (o.hint || 'Drag to turn · right-drag or two fingers to move · wheel or pinch to zoom · point at or tap a part') + '</div>'
      + '<div class="h3d-tools"><button type="button" data-z="in" aria-label="Zoom in">＋</button><button type="button" data-z="out" aria-label="Zoom out">－</button><button type="button" data-z="reset" aria-label="Reset the view">⟲</button></div></div>'
      + '<div class="h3d-parts"></div>';
    var picker = host.querySelector('.h3d-picker'), stage = host.querySelector('.h3d-stage'), svg = stage.querySelector('svg');
    var label = stage.querySelector('.h3d-label'), partsRow = host.querySelector('.h3d-parts');
    var scene, cam, hover = null, pinned = null, raf = 0;

    ids.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'h3d-pick'; b.dataset.model = id;
      b.innerHTML = '<span class="h3d-thumb"></span><span>' + MODELS[id].name + '</span>';
      picker.appendChild(b);
      still(b.querySelector('.h3d-thumb'), id, 34, 28);
      b.addEventListener('click', function () { load(id); });
    });

    function size() { var r = stage.getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; }
    function load(id) {
      var s = size();
      scene = new Scene(MODELS[id]); cam = new Camera(scene, s[0], s[1]);
      hover = pinned = null;
      picker.querySelectorAll('.h3d-pick').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.model === id)); });
      svg.setAttribute('aria-label', 'A 3D ' + MODELS[id].name + '. Its parts are listed below.');
      /* parts with the same name (several buttons…) get one chip: the top-left-most one */
      var byName = {}, order = [];
      Object.keys(scene.m.parts).forEach(function (p) {
        var nm = scene.m.parts[p].name, a = scene.m._partAt[p], b = byName[nm] && scene.m._partAt[byName[nm]];
        if (!byName[nm]) { byName[nm] = p; order.push(nm); return; }
        if (a[1] > b[1] + 0.5 || (Math.abs(a[1] - b[1]) <= 0.5 && (a[0] < b[0] - 0.5 || (Math.abs(a[0] - b[0]) <= 0.5 && a[2] < b[2])))) byName[nm] = p;
      });
      partsRow.innerHTML = '<span class="h3d-parts-label">Parts</span>' + order.map(function (nm) { return byName[nm]; }).map(function (p) {
        return '<button type="button" class="h3d-part" data-part="' + p + '" aria-pressed="false">' + scene.m.parts[p].name + '</button>';
      }).join('');
      draw(); kick();   /* things that move by themselves (a blinking light) start at once */
    }
    function current() { return pinned || hover; }
    function draw() {
      var s = size(); cam.w = s[0]; cam.h = s[1];
      svg.setAttribute('viewBox', '0 0 ' + f1(s[0]) + ' ' + f1(s[1]));
      var now = performance.now(), mark = current();
      svg.innerHTML = DEFS + '<g>' + drawFaces(scene, cam, mark, now) + '</g><g>' + drawFx(scene, cam, now) + '</g>' + leader(mark);
      partsRow.querySelectorAll('.h3d-part').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.part === mark)); });
      stage.classList.toggle('h3d-on-part', !!hover);
    }
    function loop() {
      raf = 0;
      var busy = scene.tick(performance.now());
      draw();
      if (busy) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    /* the label and its leader line: the label goes to the side the part is on */
    var labelFor = null;
    function leader(id) {
      if (!id) { label.hidden = true; labelFor = null; return ''; }
      if (labelFor !== id) fillLabel(id);
      label.hidden = false;
      var a = cam.project(scene.partPoint(id)), W = cam.w, H = cam.h;
      var lw = label.offsetWidth, lh = label.offsetHeight, left = a[0] < W / 2 + cam.pan[0];
      var lx = left ? 10 : W - lw - 10, ly = Math.max(10, Math.min(H - lh - 52, a[1] - lh / 2 - 34));
      label.style.left = f1(lx) + 'px'; label.style.top = f1(ly) + 'px';
      var ex = left ? lx + lw : lx, ey = ly + Math.min(lh / 2, 18), bx = left ? ex + 14 : ex - 14;
      return '<path class="h3d-leader" d="M' + f1(a[0]) + ',' + f1(a[1]) + 'L' + f1(bx) + ',' + f1(ey) + 'L' + f1(ex) + ',' + f1(ey) + '"/>'
        + '<circle class="h3d-dot" cx="' + f1(a[0]) + '" cy="' + f1(a[1]) + '" r="4.5"/>';
    }
    function fillLabel(id) {
      labelFor = id;
      var p = scene.m.parts[id], acts = actionsOf(scene.m, id);
      label.innerHTML = (pinned ? '<button type="button" class="h3d-close" aria-label="Close">✕</button>' : '')
        + '<div class="h3d-name" data-say="' + p.name + '">' + p.name + '</div><div class="h3d-can">You can:</div><ul>'
        + acts.map(function (a, i) {
          var moves = a.m || a.fx || a.seq;
          return '<li><button type="button" class="h3d-act' + (moves ? '' : ' h3d-still') + '" data-i="' + i + '">' + (moves ? '▶ ' : '– ') + a.v + '</button></li>';
        }).join('') + '</ul>';
    }
    label.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('h3d-close')) { pinned = null; hover = null; draw(); return; }
      var id = labelFor, a = actionsOf(scene.m, id)[+b.dataset.i];
      if (a && (a.m || a.fx || a.seq)) { scene.play(a); kick(); }
    });
    label.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !pinned && !stage.contains(e.relatedTarget)) { hover = null; draw(); } });

    partsRow.addEventListener('click', function (e) {
      var b = e.target.closest('.h3d-part');
      if (!b) return;
      pinned = pinned === b.dataset.part ? null : b.dataset.part; labelFor = null; draw();
    });

    /* ── pointer: orbit, pan, pinch, hover, tap ── */
    var ptrs = {}, start = null, moved = false;
    function partAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest && svg.contains(el) && el.getAttribute('data-part'); }
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    svg.addEventListener('pointerdown', function (e) {
      ptrs[e.pointerId] = [e.clientX, e.clientY];
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var n = Object.keys(ptrs).length;
      start = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, pan: cam.pan.slice(), zoom: cam.zoom,
        mode: n > 1 ? 'two' : (e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'orbit', type: e.pointerType };
      if (n > 1) { var ps = Object.values(ptrs); start.mid = [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2]; start.dist = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) || 1; }
      moved = n > 1;
    });
    svg.addEventListener('pointermove', function (e) {
      if (!start) {
        if (e.pointerType === 'mouse') { var p = partAt(e.clientX, e.clientY) || null; if (p !== hover) { hover = p; draw(); } }
        return;
      }
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = [e.clientX, e.clientY];
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      moved = true; stage.classList.add('h3d-dragging');
      var ps = Object.values(ptrs);
      if (start.mode === 'two' && ps.length > 1) {
        var mid = [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2], dist = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
        cam.pan = [start.pan[0] + mid[0] - start.mid[0], start.pan[1] + mid[1] - start.mid[1]];
        cam.zoom = Math.max(0.4, Math.min(4, start.zoom * dist / start.dist));
      } else if (start.mode === 'pan') {
        cam.pan = [start.pan[0] + e.clientX - start.x, start.pan[1] + e.clientY - start.y];
      } else if (start.mode === 'orbit') {
        cam.yaw = start.yaw + (e.clientX - start.x) * 0.5;
        cam.pitch = Math.max(-85, Math.min(85, start.pitch + (e.clientY - start.y) * 0.4));
      }
      draw();
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId];
      if (Object.keys(ptrs).length) { start.mode = 'none'; return; }   /* one finger of a pinch lifted: wait for the other */
      stage.classList.remove('h3d-dragging');
      if (start && !moved && e.type === 'pointerup') {
        var p = partAt(e.clientX, e.clientY) || null;
        if (start.type === 'mouse') { pinned = p && pinned !== p ? p : null; hover = p; }
        else { pinned = p && pinned !== p ? p : null; hover = null; }
        labelFor = null; draw();
      }
      start = null;
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', function (e) { if (ptrs[e.pointerId]) up(e); });
    window.addEventListener('blur', function () { ptrs = {}; start = null; stage.classList.remove('h3d-dragging'); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !start && hover && !label.contains(e.relatedTarget)) { hover = null; draw(); } });
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.zoom = Math.max(0.4, Math.min(4, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
      draw();
    }, { passive: false });
    svg.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') cam.yaw -= 10; else if (k === 'ArrowRight') cam.yaw += 10;
      else if (k === 'ArrowUp') cam.pitch = Math.max(-85, cam.pitch - 8); else if (k === 'ArrowDown') cam.pitch = Math.min(85, cam.pitch + 8);
      else if (k === '+' || k === '=') cam.zoom = Math.min(4, cam.zoom * 1.15); else if (k === '-') cam.zoom = Math.max(0.4, cam.zoom / 1.15);
      else used = false;
      if (used) { e.preventDefault(); draw(); }
    });
    stage.querySelector('.h3d-tools').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'in') cam.zoom = Math.min(4, cam.zoom * 1.25);
      else if (b.dataset.z === 'out') cam.zoom = Math.max(0.4, cam.zoom / 1.25);
      else { var c = new Camera(scene, cam.w, cam.h); cam.yaw = c.yaw; cam.pitch = c.pitch; cam.zoom = c.zoom; cam.pan = [0, 0]; }
      draw();
    });
    label.addEventListener('click', function (e) {
      /* the name in the label is tap-to-hear */
      var n = e.target.closest('.h3d-name');
      if (n) say(n.dataset.say, n);
    });
    if (global.ResizeObserver) new ResizeObserver(function () { if (scene) draw(); }).observe(stage);
    themeWatch(function () { if (scene) draw(); });

    load(o.start || ids[0]);
    return { load: load, select: function (p) { pinned = p; labelFor = null; draw(); }, play: function (part, verb) {
      var a = actionsOf(scene.m, part).filter(function (x) { return x.v === verb; })[0]; if (a) { scene.play(a); kick(); }
    }, view: function (v) { Object.assign(cam, v); draw(); }, scene: function () { return scene; } };
  }

  function say(text, el) {
    try {
      if (global.HouseSpeak && global.HouseSpeak.speak) return global.HouseSpeak.speak(text, el);
      if (global.HouseDict && global.HouseDict.say) return global.HouseDict.say(text);
      if (global.speechSynthesis) { var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    } catch (e) { /* no speech */ }
  }
  function themeWatch(fn) {
    if (!global.MutationObserver) return;
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ══ small pictures ══════════════════════════════════════════════════════ */
  /* a still picture of a whole model (the model buttons) */
  function still(el, id, w, h) {
    var sc = new Scene(MODELS[id]), cam = new Camera(sc, w, h);
    cam.zoom = 1.02;
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + drawFaces(sc, cam, null) + '</svg>';
  }

  /* a zoomed picture of one part, still or playing one action again and again */
  var minis = [], miniRaf = 0, io = null, ro = null;
  function mountMini(el) {
    if (el._h3d) return;
    var model = MODELS[el.dataset.model];
    if (!model) return;
    injectStyles();
    var part = el.dataset.part, verb = el.dataset.act;
    var sc = new Scene(model), act = null;
    if (verb && part && model.parts[part]) act = actionsOf(model, part).filter(function (a) { return a.v === verb; })[0] || null;
    if (act && !act.m && !act.fx && !act.seq) act = null;   /* "put the clothes in": nothing to play — a still picture */
    if (el.dataset.height) el.style.setProperty('--h3d-h', el.dataset.height + 'px');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', act ? 'an animation' : 'a picture');
    el.setAttribute('data-dict', 'off');
    var mini = { el: el, sc: sc, part: part, act: act, visible: true, t0: performance.now(), phase: -1, mark: el.dataset.mark !== 'off' ? part : null };
    var p = model.parts[part] || {};
    mini.view = p.view || model.view || {};
    if (p.pose) { Object.keys(p.pose).forEach(function (k) { sc.val[k] = p.pose[k]; }); sc.settle(); }   /* e.g. the door open to show a shelf */
    if (act && act.m && (act.to === 0 || act.to === 1)) { sc.val[act.m] = 1 - act.to; sc.settle(); }   /* start from the other state */
    el._h3d = mini;
    minis.push(mini);
    if (ro) ro.observe(el);
    drawMini(mini, performance.now());
    if (io) io.observe(el);
    if (act) runMinis();
  }
  function drawMini(mini, now) {
    var r = mini.el.getBoundingClientRect(), w = Math.max(60, r.width), h = Math.max(50, r.height);
    var sc = mini.sc, cam = new Camera(sc, w, h);
    if (mini.view.yaw != null) cam.yaw = mini.view.yaw;
    if (mini.view.auto && mini.part) {   /* look at the part from its own side, a little turned */
      var d = sub(sc.m._partAt[mini.part], sc.m._center);
      cam.yaw = Math.atan2(-d[0], d[2]) * 180 / Math.PI + 25;
    }
    if (mini.view.pitch != null) cam.pitch = mini.view.pitch;
    if (mini.part && sc.m.parts[mini.part]) {
      var p = sc.m._partAt[mini.part];
      cam.target = mix(sc.m._center, p, mini.view.focus != null ? mini.view.focus : 0.65);
      cam.zoom = mini.view.zoom || sc.m.parts[mini.part].zoom || 1.7;
    }
    mini.el.innerHTML = '<svg viewBox="0 0 ' + f1(w) + ' ' + f1(h) + '" aria-hidden="true">' + DEFS + drawFaces(sc, cam, mini.mark, now) + drawFx(sc, cam, now) + '</svg>';
  }
  /* one loop for every playing picture: play, rest, play back, rest */
  function cycle(mini, now) {
    var a = mini.act, sc = mini.sc;
    if (!a) return;
    var period = a.period || (a.fx || a.seq ? 1900 : (a.to === 'bounce' ? 1500 + (a.times || 1) * 400 : 3200));
    var t = (now - mini.t0) % period, phase = a.fx || a.seq || a.to === 'bounce' ? (t < 200 ? 0 : 1) : (t < period / 2 ? 0 : 1);
    if (phase !== mini.phase) {
      mini.phase = phase;
      if (a.fx || a.seq) { if (phase === 1) sc.play(a, now); }
      else if (a.to === 'bounce') { if (phase === 1) sc.play(a, now); }
      else {
        var mo = sc.m.motions[a.m], base = mo.start || 0;
        var other = a.to === 0 ? 1 : a.to === 1 ? 0 : null;
        if (a.to === 'up' || a.to === 'down') sc.play({ m: a.m, to: phase === 0 ? a.to : (a.to === 'up' ? 'down' : 'up'), step: a.step, max: a.max, also: a.also }, now);   /* louder ⇄ quieter */
        else if (other != null) sc.play({ m: a.m, to: phase === 0 ? a.to : other }, now);       /* open ⇄ close, starting with this action */
        else sc.play({ m: a.m, to: phase === 0 ? base + 1 : base }, now);                    /* toggle / step: there and back */
      }
    }
    sc.tick(now);
  }
  function runMinis() {
    if (miniRaf) return;
    var last = 0;
    var step = function (now) {
      miniRaf = 0;
      var any = false;
      minis = minis.filter(function (m) { return m.el.isConnected; });
      if (now - last > 38) {
        last = now;
        minis.forEach(function (m) {
          if (!m.act) return;
          any = true;
          if (!m.visible) return;
          cycle(m, now); drawMini(m, now);
        });
      } else any = minis.some(function (m) { return m.act; });
      if (any) miniRaf = requestAnimationFrame(step);
    };
    miniRaf = requestAnimationFrame(step);
  }
  function scan(root) {
    (root || document).querySelectorAll('.h3d-mini[data-model]').forEach(mountMini);
  }
  function start() {
    if (global.IntersectionObserver) io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.target._h3d) en.target._h3d.visible = en.isIntersecting; });
    }, { rootMargin: '80px' });
    if (global.ResizeObserver) ro = new ResizeObserver(function (es) { es.forEach(function (en) { var m = en.target._h3d; if (m && !m.act) drawMini(m, performance.now()); }); });
    scan();
    if (global.MutationObserver) new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].addedNodes.length) { scan(); return; }
    }).observe(document.body, { childList: true, subtree: true });
    var redrawAll = function () { minis.forEach(function (m) { if (m.el.isConnected) drawMini(m, performance.now()); }); };
    themeWatch(redrawAll);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ══ the models ══════════════════════════════════════════════════════════
     Units are about 1 cm. y is up, the front faces +z.
       box   { t:'box', e:[x0,x1, y0,y1, z0,z1], col, part, group }
       cyl   { t:'cyl', c:[x,y,z], ax:'x'|'y'|'z', r, len, r2 (the +end's radius: a cone), col, part, group }
       top   { t:'top', e:[x0,x1, y, z0,z1] }      a flat face looking up (keys)
       tube  { t:'tube', pts:[[x,y,z]…], r, col, part, endGroup, startGroup, group, bias }   a cord; its last / first point moves with that group
             (group: all of it moves with that group, and shines with its light — a coil)
       faces { t:'faces', faces:[[p,p,p…]…] }      ready-made faces (a box turned at an angle: rotBox)
       box skip:['top', …] leaves faces out; inside:true turns the faces in (the walls of an oven, a slot, a well)
       cyl open:'top'|'bottom'|'both' leaves an end open; inside:true (the inside of a kettle, a drum); flat:true = no sides (a disc: water)
       key:n on a 'top' face makes it key n of a keyboard (an action { fx:'keys', count, gap } presses random keys)
     bias pushes a face forward when sorting (things lying on a surface); id / on / layer: a thing lying on a surface.
     seamless: no darker outline (a thing that should melt into its screen).
     clipY / clipZ: nothing of that shape is drawn below this height / behind this depth (a tray inside a stereo).
     groups: { lid:{ parent:'kettle' } }   — a group moves with its parent.
     motions: { door:{ do:[{ g:'door', rot:{ ax:'y', pivot:[…], deg:-100 } }, { g:'x', move:[…] }], dur, start } }
       the value 0 → 1 runs the moves (a knob's value can keep growing: it keeps turning)
     lights:   [{ g, col:[r,g,b] | fn(scene), when: fn(scene), fadeIn, fadeOut (ms), glow:[x,y,z], glowR }]
       the group's faces shine while when() is true. scene.on('motion'), scene.plugged(), scene.val.x, scene.state.ch
     displays: [{ id, g, on, part, at:[x,y,z], u, v (the display's right and up), h, text, col, bg, kind, when }]
       7-segment digits; kind = what "read" shows next: 'time' 12:34 · 'num2' 12 · 'freq' 98.5 · 'temp' -18°
     alive: fn(scene) — keep drawing while true (a light that blinks on a clock: scene.now)
     timers:   [{ when: fn(scene), after: ms | fn(scene), act }]   when() true for that long → play act (a toaster pops up)
     an action can have if: fn(scene) (play it only then), dur (its own speed, ms), wait (play it that much later),
       seq: fn(scene) → a list of actions (steps, with waits), period (ms: how often a small picture plays it)
     groups: { g: { ops: fn(scene) → its moves } } — a group that works out its own moves
     spins:    [{ g, ax, pivot, rate: fn(scene) → degrees a second }] · [{ g, wobble:[dx,dy,dz], hz, when, scale: fn(scene) → how far }]
     parts: { lid:{ name:'lid', can:[{ v:'open', m:'lid', to:1 }, { v:'close', m:'lid', to:0 }] } }
       to: 1 · 0 · 'toggle' · 'bounce' (there and back; times:3) · 'step' (one more turn) · 'cycle' (0 → 1 → … → max → 0)
           'up' / 'down' (one step: act.step or the motion's step, default 0.2; max 1)
       also: another action (or a list) played at the same time
       { v:'tap', fx:'tap', at:[x,y,z], g:'lid' } · { v:'swipe', fx:'swipe', from:[…], to:[…], g:'lid' }
       { v:'read', fx:'read', d:'display id' } · { v:'change the channel', fx:'channel', dir:1 }
       { v:'put the bread in' } — something you can do that the model doesn't play
       view: { yaw, pitch, zoom, focus } for the zoomed pictures of that part
     Parts with the same name (several buttons) each have their own actions; the parts row shows the top-left one. */
  var MODELS = {};
  function define(id, m) { m.id = id; MODELS[id] = m; return m; }

  var B = function (e, col, part, group, more) { return Object.assign({ t: 'box', e: e, col: col, part: part, group: group }, more || {}); };
  var C = function (c, ax, r, len, col, part, group, more) { return Object.assign({ t: 'cyl', c: c, ax: ax, r: r, len: len, col: col, part: part, group: group }, more || {}); };
  /* a box turned about an axis (a fan blade, a tilted lever) */
  var rotBox = function (e, ax, deg, pivot, col, part, group, more) {
    return Object.assign({ t: 'faces', faces: boxFaces(e, more && more.skip).map(function (f) { return f.map(function (p) { return rotate(p, ax, deg, pivot); }); }), col: col, part: part, group: group }, more || {});
  };
  /* a cord's points, cut into short pieces (long straight pieces sort badly against things near them) */
  var finely = function (pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
      for (var k = 1; k <= n; k++) out.push(add(a, mul(sub(b, a), k / n)));
    }
    return out;
  };
  var ring = function (c, r, n) { var out = []; for (var i = 0; i <= n; i++) { var t = i / n * Math.PI * 2; out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), c[2]]); } return out; };
  var PLUG = '#2b2b2b', PIN = '#c9a25a', CORD = '#333333';
  var plugged = function (sc) { return sc.plugged(); };

  /* buttons, each one its own part: 'button' is the top-left one, then 'button2', 'button3'…
     list: [{ e, col, also, more:[actions], move, parent, view }]; o: the defaults (col, move, prefix, on, layer, zoom, view, parent) */
  function buttons(list, o) {
    var out = { shapes: [], motions: {}, parts: {}, groups: {} };
    list.slice().sort(function (a, b) {
      if (Math.abs(a.e[3] - b.e[3]) > 0.5) return b.e[3] - a.e[3];
      if (Math.abs(a.e[0] - b.e[0]) > 0.5) return a.e[0] - b.e[0];
      return a.e[4] - b.e[4];
    }).forEach(function (b, k) {
      var id = k ? 'button' + (k + 1) : 'button', mo = (o.prefix || 'btn') + k, par = b.parent || o.parent;
      out.shapes.push(B(b.e, b.col || o.col || '#f4f6f8', id, mo, { on: b.on || o.on, layer: o.layer || 2 }));
      out.motions[mo] = { do: [{ g: mo, move: b.move || o.move }], dur: 160 };
      if (par) out.groups[mo] = { parent: par };
      out.parts[id] = { name: 'button', can: [{ v: 'press', m: mo, to: 'bounce', also: b.also }].concat(b.more || []), zoom: b.zoom || o.zoom || 2.4, view: b.view || o.view };
    });
    return out;
  }
  /* a volume bar on a screen: 10 steps that show for a moment when the volume changes (motions 'vol' 0 … 1 and 'vshow').
     a = [x0, x1, y0] (bottom-left, right), hMax, z, on: the screen's id, screen: fn(scene) → the screen is on,
     back: the screen's light colour (array or fn) — a step above the volume looks like the screen */
  function volumeBar(x0, x1, y0, hMax, z, on, layer, screen, back) {
    var out = { shapes: [], lights: [], groups: {} }, w = (x1 - x0) / 10;
    /* the steps that are on sit in the middle of the screen: they slide by half the steps that are off;
       the steps that are off go just behind the screen (out of sight) */
    var slide = function (i) { return function (sc) {
      var n = Math.round(sc.val.vol * 10);
      return i < n ? (n < 10 ? [{ move: [(10 - n) * w / 2, 0, 0] }] : []) : [{ move: [0, 0, -0.3] }];
    }; };
    for (var i = 0; i < 10; i++) {
      var g = 'vbar' + i, lvl = (i + 0.5) / 10;
      out.shapes.push(B([x0 + i * w + w * 0.15, x0 + (i + 1) * w - w * 0.15, y0, y0 + hMax * (0.25 + 0.75 * (i + 1) / 10), z, z + 0.02], '#0b0d10', 'screen', g, { on: on, layer: layer, seamless: true }));   /* no outline: an empty step is just screen */
      out.groups[g] = { ops: slide(i) };
      out.lights.push({ g: g, col: [248, 248, 248], fadeIn: 80, fadeOut: 250, when: (function (lvl) { return function (sc) { return screen(sc) && sc.val.vshow > 0.05 && sc.val.vol >= lvl; }; })(lvl) });
      out.lights.push({ g: g, col: back, when: screen, fadeIn: 350, fadeOut: 300 });
    }
    return out;
  }
  var VOL = { vol: { do: [], dur: 200, start: 0.6, step: 0.1 }, vshow: { do: [], dur: 900 } };   /* volume: 10 steps */
  var louder = [{ m: 'vol', to: 'up' }, { m: 'vshow', to: 'bounce' }], quieter = [{ m: 'vol', to: 'down' }, { m: 'vshow', to: 'bounce' }];
  function merge(m, x) {
    m.shapes = m.shapes.concat(x.shapes || []);
    ['motions', 'parts', 'groups'].forEach(function (k) { if (x[k]) m[k] = Object.assign(m[k] || {}, x[k]); });
    ['lights', 'displays', 'spins'].forEach(function (k) { if (x[k]) m[k] = (m[k] || []).concat(x[k]); });
    return m;
  }

  /* a power cord from `pts` to a plug at (px, pz) on the floor, and a socket beside it. Plugged in to start with.
     dir: the way the plug points, '-x' (default) or '-z'; the cord goes into its other end.
     Plugging in pushes it all the way: the plug's face meets the socket, the pins go in. */
  function powered(pts, px, pz, dir) {
    var last = [px, 1.5, pz], X = dir !== '-z';
    /* a box along the plug's direction: a = from, b = to (how far along, pointing in), w = half width, y0, y1 */
    var along = function (a, b, w, y0, y1, ofs) {
      ofs = ofs || 0;
      return X ? [px - b, px - a, y0, y1, pz - w + ofs, pz + w + ofs] : [px - w + ofs, px + w + ofs, y0, y1, pz - b, pz - a];
    };
    return {
      shapes: [
        { t: 'tube', pts: pts.concat([last]), r: 0.55, col: CORD, part: 'cord', endGroup: 'plug' },
        B(along(0, 6, 1.6, 0, 3), PLUG, 'plug', 'plug'),
        B(along(6, 9, 0.2, 1.1, 1.6, -0.8), PIN, 'plug', 'plug'),
        B(along(6, 9, 0.2, 1.1, 1.6, 0.8), PIN, 'plug', 'plug'),
        B(along(15, 23, 4.5, 0, 5.5), '#f1f1ee', 'socket', null, { id: 'sock' + px + pz }),
        B(along(14.85, 15, 0.3, 1.0, 1.7, -0.8), '#3a3a3a', 'socket', null, { on: 'sock' + px + pz }),
        B(along(14.85, 15, 0.3, 1.0, 1.7, 0.8), '#3a3a3a', 'socket', null, { on: 'sock' + px + pz })
      ],
      motion: { do: [{ g: 'plug', move: X ? [-9, 0, 0] : [0, 0, -9] }], dur: 750, start: 1 },
      parts: {
        cord: { name: 'power cord', can: [{ v: 'plug in', m: 'plug', to: 1 }, { v: 'unplug', m: 'plug', to: 0 }], at: pts[Math.min(2, pts.length - 1)], view: { auto: true, pitch: 28 }, zoom: 1.5 },
        plug: { name: 'plug', can: [{ v: 'plug in', m: 'plug', to: 1 }, { v: 'unplug', m: 'plug', to: 0 }], zoom: 2.4, view: { auto: true, pitch: 28 } },
        socket: { name: 'socket', can: [{ v: 'plug in', m: 'plug', to: 1 }], zoom: 2.2, view: { auto: true, pitch: 28 } }
      }
    };
  }
  function withPower(m, p) {
    m.shapes = m.shapes.concat(p.shapes);
    m.motions.plug = p.motion;
    Object.keys(p.parts).forEach(function (k) { m.parts[k] = p.parts[k]; });
    return m;
  }

  /* ── microwave: a box open at the front, the oven inside, a door over it, a clock ── */
  (function () {
    var read = { fx: 'read', d: 'mdisp' };
    var m = define('microwave', {
      name: 'microwave', view: { yaw: -28, pitch: 16 },
      shapes: [
        B([-25, 25, 0, 30, -18, 18], '#dfe3e8', null, null, { skip: ['front'] }),
        B([-25, 9, 27, 30, 17.6, 18], '#dfe3e8'), B([-25, 9, 0, 3, 17.6, 18], '#dfe3e8'),
        B([-25, -23, 3, 27, 17.6, 18], '#dfe3e8'), B([8, 9, 3, 27, 17.6, 18], '#dfe3e8'),
        B([-23, 8, 3, 27, -16, 18], '#b4bbc3', null, 'mcav', { inside: true, skip: ['front'] }),
        C([-7.5, 3.5, 1], 'y', 9, 0.5, '#d7e6ec', null, 'mplate', { seg: 24 }),
        B([-23, -22.75, 19, 25, -9, -1], '#e9e6da', null, 'mlamp', { skip: ['left'], bias: -2.5 }),   /* the lamp in the left wall */
        B([9, 25, 0, 30, 17.6, 18.6], '#c5cbd2', null, null, { id: 'mpanel' }),
        B([-24, 9, 2, 28, 18, 19.2], '#46505c', 'door', 'door', { id: 'mdoor', bias: 5 }),
        B([-21, 4, 5, 25, 19.2, 19.45], '#1b222a', 'door', 'door', { on: 'mdoor' }),
        B([5, 7.4, 8, 22, 19.2, 22.2], '#a2abb5', 'handle', 'door', { on: 'mdoor', layer: 2 }),
        B([11, 23, 21.5, 26, 18.6, 18.9], '#173b2a', 'screen', 'mscr', { id: 'mscr', on: 'mpanel' }),
        C([17, 6.5, 19.5], 'z', 3, 1.8, '#79848f', 'knob', 'mknob', { id: 'mk', on: 'mpanel' }),
        B([16.6, 17.4, 7.2, 9.2, 20.35, 20.6], '#f2f4f6', 'knob', 'mknob', { on: 'mk', layer: 2 })
      ],
      motions: {
        door: { do: [{ g: 'door', rot: { ax: 'y', pivot: [-24, 0, 19.2], deg: -95 } }], dur: 800 },
        mknob: { do: [{ g: 'mknob', rot: { ax: 'z', pivot: [17, 6.5, 19.5], deg: -90 } }], dur: 600 }
      },
      lights: [
        { g: 'mscr', col: [36, 92, 62], when: plugged, fadeIn: 300, fadeOut: 500 },
        /* the light inside comes on while the door is open (if it is plugged in) */
        { g: 'mcav', col: [238, 226, 186], when: function (sc) { return sc.val.door > 0.12 && sc.plugged(); }, fadeIn: 150, fadeOut: 300 },
        { g: 'mplate', col: [246, 244, 230], when: function (sc) { return sc.val.door > 0.12 && sc.plugged(); }, fadeIn: 150, fadeOut: 300 },
        { g: 'mlamp', col: [255, 250, 225], glow: [-21.5, 22, -5], glowR: 10, glowBias: 3, when: function (sc) { return sc.val.door > 0.12 && sc.plugged(); }, fadeIn: 150, fadeOut: 300 }
      ],
      displays: [{ id: 'mdisp', g: 'mscr', on: 'mscr', part: 'screen', at: [17, 23.75, 18.9], h: 2.6, text: '12:34', col: '#63ff8f', bg: '#173b2a', kind: 'time', when: plugged }],
      parts: {
        door: { name: 'door', can: [{ v: 'open', m: 'door', to: 1 }, { v: 'close', m: 'door', to: 0 }], zoom: 1.3 },
        handle: { name: 'handle', can: [{ v: 'pull', m: 'door', to: 'toggle' }], zoom: 1.6, view: { yaw: -10 } },
        screen: { name: 'screen', can: [{ v: 'read', fx: 'read', d: 'mdisp' }], zoom: 2.6, view: { yaw: -10, pitch: 8 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'mknob', to: 'step', also: read }], zoom: 2.6, view: { yaw: -10, pitch: 8 } }
      }
    });
    merge(m, buttons([
      { e: [11.5, 16, 17, 19.5, 18.6, 19.4] }, { e: [18, 22.5, 17, 19.5, 18.6, 19.4] },
      { e: [11.5, 16, 13.5, 16, 18.6, 19.4] }, { e: [18, 22.5, 13.5, 16, 18.6, 19.4] }
    ].map(function (b) { b.also = read; return b; }), { prefix: 'mbtn', move: [0, 0, -0.6], on: 'mpanel', view: { yaw: -10 } }));
    withPower(m, powered([[20, 4, -18], [20, 1.2, -25], [10, 1.5, -30]], 2, -30));
  })();

  /* ── toaster: two real slots; the heating wires glow while the lever is down (if it is plugged in) ── */
  (function () {
    var down = function (sc) { return sc.val.lever > 0.5; };
    var POP = [{ m: 'lever', to: 0, dur: 180, if: down }, { m: 'pop', to: 'bounce', if: down }];
    var wires = [];
    [[-4.6, 1, 'tw1'], [-2, -1, 'tw1'], [2, 1, 'tw2'], [4.6, -1, 'tw2']].forEach(function (w) {
      /* on each wall of a slot, three hot wires: flat faces looking into the slot */
      [8.5, 11.5, 14.5].forEach(function (y) {
        var z = w[0] + 0.02 * w[1];
        var f = [[-10, y, z], [10, y, z], [10, y + 0.45, z], [-10, y + 0.45, z]];
        wires.push({ t: 'faces', faces: [w[1] > 0 ? f : f.slice().reverse()], col: '#4d3a30', part: 'slot', group: 'twire', on: w[2], layer: 2 });
      });
    });
    var m = define('toaster', {
      name: 'toaster', view: { yaw: -32, pitch: 22, zoom: 1.35 },
      shapes: [
        B([-14, 14, 0, 18, -8, 8], '#c94c3c', null, null, { skip: ['top'], id: 'tbody' }),
        B([-14, 14, 17.7, 18, 4.6, 8], '#c94c3c'), B([-14, 14, 17.7, 18, -2, 2], '#c94c3c'), B([-14, 14, 17.7, 18, -8, -4.6], '#c94c3c'),
        B([-14, -11, 17.7, 18, -4.6, 4.6], '#c94c3c'), B([11, 14, 17.7, 18, -4.6, 4.6], '#c94c3c'),
        B([-11, 11, 6, 18, -4.6, -2], '#3b2a22', 'slot', 'twell', { inside: true, skip: ['top'], id: 'tw1' }),
        B([-11, 11, 6, 18, 2, 4.6], '#3b2a22', 'slot', 'twell', { inside: true, skip: ['top'], id: 'tw2' })
      ].concat(wires).concat([
        B([-9, 9, 10.5, 21.5, -4.0, -2.6], '#e2b06b', null, 'bread'), B([-9, 9, 10.5, 21.5, 2.6, 4.0], '#e2b06b', null, 'bread'),
        B([14, 14.2, 4, 15.5, -0.6, 0.6], '#5a201a', null, null, { on: 'tbody' }),
        B([14, 17.5, 12.5, 14.5, -1.4, 1.4], '#2b2b2b', 'lever', 'lever', { on: 'tbody', layer: 2 }), B([17.5, 19, 12, 15, -2, 2], '#2b2b2b', 'lever', 'lever', { on: 'tbody', layer: 2 }),
        C([7, 6, 8.9], 'z', 2.3, 1.8, '#2b2b2b', 'knob', 'tknob', { id: 'tk', on: 'tbody' }),
        rotBox([6.7, 7.3, 6.6, 8.0, 9.8, 10.0], 'z', 135, [7, 6, 8.9], '#eeeeee', 'knob', 'tknob', { on: 'tk', layer: 2 })
      ]),
      motions: {
        lever: { do: [{ g: 'lever', move: [0, -8, 0] }, { g: 'bread', move: [0, -3.8, 0] }], dur: 700 },
        pop: { do: [{ g: 'bread', move: [0, 4.5, 0] }], dur: 170 },
        heat: { do: [{ g: 'tknob', rot: { ax: 'z', pivot: [7, 6, 8.9], deg: -270 } }], dur: 400, start: 0.5 }
      },
      lights: [
        /* the knob sets the heat: the wires glow brighter, and the toast takes longer */
        { g: 'twire', col: function (sc) { return mix([200, 62, 24], [255, 150, 60], sc.val.heat); }, when: function (sc) { return sc.on('lever') && sc.plugged(); }, fadeIn: 1800, fadeOut: 1200 },
        { g: 'twell', col: function (sc) { return mix([150, 55, 22], [215, 95, 35], sc.val.heat); }, when: function (sc) { return sc.on('lever') && sc.plugged(); }, fadeIn: 2200, fadeOut: 1400 }
      ],
      /* the lever jumps up and the bread pops out: after the toasting time — at once if it is not plugged in (it doesn't stay down) */
      timers: [
        { when: function (sc) { return sc.val.lever > 0.97 && !sc.anim.lever && sc.plugged(); }, after: function (sc) { return 2500 + 5000 * sc.val.heat; }, act: POP },
        { when: function (sc) { return sc.val.lever > 0.97 && !sc.anim.lever && !sc.plugged(); }, after: 350, act: POP }
      ],
      parts: {
        slot: { name: 'slot', can: [{ v: 'put the bread in' }], zoom: 1.8, view: { pitch: 50 } },
        lever: { name: 'lever', can: [{ v: 'push down', m: 'lever', to: 'toggle' }], zoom: 2, view: { yaw: -55 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'heat', to: 'up' }, { v: 'turn up the heat', m: 'heat', to: 'up' }, { v: 'turn down the heat', m: 'heat', to: 'down' }], zoom: 2.6, view: { yaw: -15, pitch: 10 } }
      }
    });
    /* the button stops the toaster: up it jumps */
    merge(m, buttons([{ e: [-11, -6, 4.5, 7, 8, 8.8], col: '#f2f2f2', also: POP, more: [{ v: 'stop the toaster', m: 'lever', to: 0, dur: 180, also: POP[1] }] }], { prefix: 'tbtn', move: [0, 0, -0.6], on: 'tbody', zoom: 2.6, view: { yaw: -15, pitch: 10 } }));
    withPower(m, powered([[-10, 3, -8], [-10, 1.2, -13], [-2, 1.5, -15]], 0, -19, '-z'));
  })();

  /* ── electric kettle: open at the top inside the lid, with water in it ── */
  withPower(define('kettle', {
    name: 'kettle', view: { yaw: -62, pitch: 16, zoom: 1.3 },
    groups: { lid: { parent: 'kettle' }, ksw: { parent: 'kettle' } },
    shapes: [
      C([0, 1, 0], 'y', 9.5, 2, '#2b2b2b'),
      C([0, 12.5, 0], 'y', 8, 19, '#cfd6dc', null, 'kettle', { r2: 6.6, open: 'top' }),
      C([0, 12.6, 0], 'y', 7.5, 18.8, '#97a2ac', null, 'kettle', { r2: 6.1, open: 'top', inside: true }),
      C([0, 18, 0], 'y', 6.3, 0.02, '#4f9fe0', null, 'kettle', { seg: 20, flat: true, open: 'bottom' }),
      C([0, 19, 9], 'z', 2.4, 4.5, '#cfd6dc', 'spout', 'kettle', { r2: 1.3, seg: 14 }),
      C([0, 22.5, 0], 'y', 6.5, 1, '#a9b2bb', 'lid', 'lid'),
      C([0, 23.6, 0], 'y', 1.6, 1.2, '#2b2b2b', 'lid', 'lid', { seg: 12 }),
      B([-1.3, 1.3, 6, 20, -12.2, -10.4], '#2b2b2b', 'handle', 'kettle'),
      B([-1.3, 1.3, 18.2, 20, -10.4, -6.2], '#2b2b2b', 'handle', 'kettle'),
      B([-1.3, 1.3, 6, 7.8, -10.4, -7.4], '#2b2b2b', 'handle', 'kettle'),
      B([-1, 1, 3.9, 6, -12, -10.2], '#c8651a', 'switch', 'ksw')
    ],
    motions: {
      lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 23, -6.5], deg: -95 } }], dur: 700 },
      ksw: { do: [{ g: 'ksw', rot: { ax: 'x', pivot: [0, 6, -11.1], deg: -22 } }], dur: 260 },
      lift: { do: [{ g: 'kettle', move: [0, 7, 0] }], dur: 700 },
      pour: { do: [{ g: 'kettle', move: [0, 6, 0] }, { g: 'kettle', rot: { ax: 'x', pivot: [0, 3, 8], deg: 38 } }], dur: 800 }
    },
    /* the switch lights up only on the base, plugged in */
    lights: [{ g: 'ksw', col: [255, 170, 60], when: function (sc) { return sc.on('ksw') && sc.plugged() && sc.val.lift < 0.05 && sc.val.pour < 0.05; }, fadeIn: 200, fadeOut: 500 }],
    parts: {
      lid: { name: 'lid', can: [{ v: 'open', m: 'lid', to: 1 }, { v: 'close', m: 'lid', to: 0 }, { v: 'lift', m: 'lid', to: 'toggle' }], zoom: 1.8, view: { pitch: 34 } },
      handle: { name: 'handle', can: [{ v: 'hold', m: 'lift', to: 'toggle' }, { v: 'pick up', m: 'lift', to: 'toggle' }], zoom: 1.5, view: { yaw: -110 } },
      switch: { name: 'switch', can: [{ v: 'switch on', m: 'ksw', to: 1 }, { v: 'switch off', m: 'ksw', to: 0 }], zoom: 2.4, view: { yaw: -140, pitch: 10 } },
      spout: { name: 'spout', can: [{ v: 'pour', m: 'pour', to: 'bounce' }], zoom: 1.4, view: { yaw: -70, pitch: 8 } }
    }
  }), powered([[-6, 1.2, -8], [-8, 1.2, -13], [-2, 1.5, -15]], 0, -19, '-z'));

  /* ── laptop: keys with a space bar, a hinge, and a charger (power brick) that unplugs at both ends ── */
  (function () {
    var keys = [], n = 0;
    var key = function (x0, x1, z0, z1) { keys.push({ t: 'top', e: [x0, x1, 1.75, z0, z1], col: '#4b525b', part: 'keyboard', group: 'keys', on: 'kbd', key: n++ }); };
    for (var r = 0; r < 4; r++) for (var c = 0; c < 11; c++) { var x = -13 + c * 2.4, z = -9 + r * 2.3; key(x + 0.2, x + 2.1, z + 0.2, z + 2.0); }
    var zs = -9 + 4 * 2.3;                                     /* the bottom row: two keys, the space bar, two keys */
    key(-12.8, -10.9, zs + 0.2, zs + 2.0); key(-10.4, -8.5, zs + 0.2, zs + 2.0);
    key(-8.0, 8.0, zs + 0.2, zs + 2.0);
    key(8.5, 10.4, zs + 0.2, zs + 2.0); key(10.9, 12.8, zs + 0.2, zs + 2.0);
    var m = define('laptop', {
      name: 'laptop', view: { yaw: -22, pitch: 26, zoom: 1.15 }, keyCount: n,
      groups: { lscr: { parent: 'lid' } },
      shapes: [
        B([-16, 16, 0, 1.4, -11, 11], '#c3c8cf', null, null, { id: 'base' }),
        B([-14, 14, 1.4, 1.6, -9.6, 2.6], '#2d3238', 'keyboard', null, { id: 'kbd', on: 'base' })
      ].concat(keys).concat([
        B([-5.5, 5.5, 1.4, 1.52, 3.4, 9.6], '#a7aeb6', 'touchpad', null, { on: 'base' }),
        C([-11, 2.3, -10.6], 'x', 0.8, 5, '#2d3238', null, null, { seg: 12 }), C([11, 2.3, -10.6], 'x', 0.8, 5, '#2d3238', null, null, { seg: 12 }),
        B([-16, 16, 1.6, 24, -11, -10.2], '#3b4048', 'lid', 'lid', { id: 'bezel', bias: 1.5 }),   /* closed, its top edge meets the front of the base */
        B([-14.5, 14.5, 3.2, 22.5, -10.2, -10.02], '#141a22', 'screen', 'lscr', { on: 'bezel' }),
        /* the charger: a connector in the laptop's side, a cord, the power brick (its light), and the cord to the wall */
        B([-16.05, -16, 0.3, 1.1, -0.9, 0.9], '#151515', null, null, { on: 'base' }),
        B([-19.5, -16, 0.3, 1.1, -0.6, 0.6], '#2b2b2b', 'connector', 'dc'),
        { t: 'tube', pts: [[-19.5, 0.7, 0], [-22, 0.8, 0.6], [-25, 1.3, 2]], r: 0.4, col: CORD, part: 'cord', startGroup: 'dc' },
        B([-33, -25, 0, 2.6, -1, 5], '#2b2b2b', 'charger', null, { id: 'brick' }),
        B([-27.2, -26.2, 2.6, 2.65, 3.6, 4.4], '#1f3527', 'charger', 'led', { on: 'brick' })
      ]),
      motions: {
        lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 2.4, -10.6], deg: 90 } }], dur: 900 },
        dc: { do: [{ g: 'dc', move: [-4, 0, 0] }], dur: 600 }
      },
      lights: [
        /* the charger's light: on only while it is plugged into the wall; it fades out in under two seconds */
        { g: 'led', col: [61, 220, 132], when: plugged, fadeIn: 300, fadeOut: 1600 },
        /* the screen runs on the battery: on while the lid is open */
        { g: 'lscr', col: [52, 110, 190], when: function (sc) { return sc.val.lid < 0.6; }, fadeIn: 400, fadeOut: 300 }
      ],
      parts: {
        screen: { name: 'screen', can: [{ v: 'tap', fx: 'tap', at: [2, 12, -10], g: 'lid' }, { v: 'swipe', fx: 'swipe', from: [-8, 12, -10], to: [8, 12, -10], g: 'lid' }], zoom: 2.5, view: { yaw: -8, pitch: 10 } },
        keyboard: { name: 'keyboard', can: [{ v: 'type', fx: 'keys', count: 9, gap: 120 }, { v: 'press the keys', fx: 'keys', count: 4, gap: 260 }], zoom: 2.6, view: { pitch: 50 } },
        touchpad: { name: 'touchpad', can: [{ v: 'tap', fx: 'tap', at: [0, 1.55, 6.5] }, { v: 'swipe', fx: 'swipe', from: [-4, 1.55, 6.5], to: [4, 1.55, 6.5] }], zoom: 3.2, view: { pitch: 55 } },
        lid: { name: 'lid', can: [{ v: 'close', m: 'lid', to: 1 }, { v: 'open', m: 'lid', to: 0 }], zoom: 2 },
        connector: { name: 'connector', can: [{ v: 'unplug', m: 'dc', to: 1 }, { v: 'plug in', m: 'dc', to: 0 }], zoom: 3.2, view: { yaw: -70, pitch: 22 } },
        charger: { name: 'charger', can: [{ v: 'plug in', m: 'plug', to: 1 }, { v: 'unplug', m: 'plug', to: 0 }], zoom: 2.2, view: { auto: true, pitch: 30 } }
      }
    });
    merge(m, buttons([{ e: [11.5, 14, 1.4, 1.8, -10.7, -10], col: '#eceff2' }], { prefix: 'pbtn', move: [0, -0.3, 0], zoom: 3.8, view: { pitch: 45, yaw: -10 } }));
    withPower(m, powered([[-29, 1.3, -1], [-29, 1.2, -6]], -29, -10, '-z'));
  })();

  /* ── washing machine (top loader): the drum inside, under the lid; minutes left on the screen.
        Running (the start button, the lid closed, plugged in): the agitator turns and the machine shakes ── */
  (function () {
    var read = { fx: 'read', d: 'wdisp' };
    var running = function (sc) { return sc.on('run') && sc.plugged() && sc.val.lid < 0.05; };
    var fins = [];
    for (var k = 0; k < 3; k++) fins.push(rotBox([1.3, 3.0, 8, 19, 0.75, 1.25], 'y', k * 120, [0, 0, 1], '#e3e8ed', null, 'agit', { bias: -2.5 }));
    var W = 'wb';   /* the whole machine: it shakes */
    var m = define('washer', {
      name: 'washing machine', view: { yaw: -32, pitch: 24, zoom: 0.84 },
      groups: { lid: { parent: W }, wknob: { parent: W }, wscr: { parent: W }, agit: { parent: W } },
      shapes: [
        B([-15, 15, 0, 36, -15, 15], '#eef1f4', null, W, { skip: ['top'] }),
        B([-15, 15, 35.6, 36, 10, 15], '#eef1f4', null, W), B([-15, 15, 35.6, 36, -15, -8], '#eef1f4', null, W),
        B([-15, -11, 35.6, 36, -8, 10], '#eef1f4', null, W), B([11, 15, 35.6, 36, -8, 10], '#eef1f4', null, W),
        B([-11, 11, 6, 36, -8, 10], '#c9d0d7', null, W, { inside: true, skip: ['top'] }),
        C([0, 20, 1], 'y', 8.6, 26, '#7d8893', null, W, { open: 'top', inside: true, seg: 24 }),
        C([0, 14, 1], 'y', 1.6, 14, '#f4f6f8', null, 'agit', { seg: 12 })
      ].concat(fins).concat([
        B([-12.5, 12.5, 36.15, 36.9, -9, 11.5], '#cfd6de', 'lid', 'lid'),
        B([-4, 4, 36.9, 37.6, 8.8, 10.4], '#8d97a3', 'handle', 'lid'),
        B([-15, 15, 36, 44, -15, -11.5], '#dde2e8', null, W, { id: 'wpanel' }),
        C([-9, 40, -11.0], 'z', 2.6, 1.2, '#7c8794', 'knob', 'wknob', { on: 'wpanel' }),
        B([-9.35, -8.65, 41, 42.4, -10.4, -10.2], '#f2f4f6', 'knob', 'wknob', { on: 'wpanel', layer: 2 }),
        B([-3.5, 4.5, 38.5, 42.5, -11.5, -11.25], '#123828', 'screen', 'wscr', { id: 'wscr', on: 'wpanel' })
      ]),
      motions: {
        lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 36.9, -9], deg: -92 } }], dur: 900 },
        wknob: { do: [{ g: 'wknob', rot: { ax: 'z', pivot: [-9, 40, -11], deg: -90 } }], dur: 600 },
        run: { do: [], dur: 200 }
      },
      lights: [{ g: 'wscr', col: [24, 84, 92], when: plugged, fadeIn: 300, fadeOut: 500 }],
      displays: [{ id: 'wdisp', g: 'wscr', on: 'wscr', part: 'screen', at: [0.5, 40.5, -11.25], h: 2.6, text: '12', col: '#6ff2ff', bg: '#123828', kind: 'num2', when: plugged }],
      spins: [
        { g: 'agit', ax: 'y', pivot: [0, 0, 1], ease: 800, rate: function (sc) { return running(sc) ? 220 : 0; } },
        { g: W, wobble: [0.16, 0, 0.11], hz: 9, ease: 500, when: running }
      ],
      parts: {
        lid: { name: 'lid', can: [{ v: 'open', m: 'lid', to: 1 }, { v: 'close', m: 'lid', to: 0 }], zoom: 1.4, view: { pitch: 35 } },
        handle: { name: 'handle', can: [{ v: 'lift', m: 'lid', to: 'toggle' }, { v: 'pull', m: 'lid', to: 'toggle' }], zoom: 1.8, view: { pitch: 35 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'wknob', to: 'step', also: read }], zoom: 2.4, view: { yaw: -10, pitch: 12 } },
        screen: { name: 'screen', can: [{ v: 'read', fx: 'read', d: 'wdisp' }, { v: 'tap', fx: 'tap', at: [0.5, 40.5, -11.2], also: read }], zoom: 2.4, view: { yaw: -10, pitch: 12 } }
      }
    });
    merge(m, buttons([
      { e: [7, 10, 39, 41.5, -11.5, -10.9], also: [{ m: 'run', to: 'toggle' }, read], more: [{ v: 'start the machine', m: 'run', to: 1 }, { v: 'stop the machine', m: 'run', to: 0 }] },
      { e: [11, 14, 39, 41.5, -11.5, -10.9], also: read }
    ], { prefix: 'wbtn', col: '#fafafa', move: [0, 0, -0.45], on: 'wpanel', parent: W, view: { yaw: -15, pitch: 12 } }));
    withPower(m, powered([[10, 4, -15], [10, 1.2, -22], [2, 1.5, -26]], -4, -26));
  })();

  /* ── clothes dryer (front loader): a round door, a drum with paddles that turns, a timer; it shakes while it runs ── */
  (function () {
    var read = { fx: 'read', d: 'ddisp' };
    var running = function (sc) { return sc.on('drun') && sc.plugged() && sc.val.ddoor < 0.05; };
    var D = 'db', fins = [];
    for (var k = 0; k < 3; k++) fins.push(rotBox([-2.6, -1.4, 23.8, 25.5, -12, 12], 'z', k * 120, [-2, 16, 0], '#c9d0d7', 'drum', 'drum', { bias: -2.5 }));
    var m = define('dryer', {
      name: 'clothes dryer', view: { yaw: -30, pitch: 18, zoom: 0.86 },
      groups: { drum: { parent: D }, ddoor: { parent: D }, dknob: { parent: D }, dscrg: { parent: D } },
      shapes: [
        B([-15, 15, 0, 40, -14, 15], '#eef1f4', null, D, { skip: ['front'], bias: 4 }),   /* the outside walls: in front of everything inside */
        B([-15, 15, 22.5, 40, 14.6, 15], '#eef1f4', null, D, { id: 'dtop' }),
        B([-15, 15, 0, 9.5, 14.6, 15], '#eef1f4', null, D), B([-15, -8.5, 9.5, 22.5, 14.6, 15], '#eef1f4', null, D), B([4.5, 15, 9.5, 22.5, 14.6, 15], '#eef1f4', null, D),
        C([-2, 16, -0.5], 'z', 9.5, 27, '#9aa3ad', 'drum', 'drum', { open: 'top', inside: true, seg: 24 })
      ].concat(fins).concat([
        /* the round door with its glass, and a handle */
        C([-2, 16, 15.6], 'z', 10.5, 1.2, '#e4e8ec', 'door', 'ddoor', { id: 'dd', bias: 5, seg: 30 }),
        C([-2, 16, 16.25], 'z', 7.6, 0.1, '#41535f', 'door', 'ddoor', { on: 'dd', seg: 28 }),
        B([6.6, 8.1, 12.5, 19.5, 16.2, 17.4], '#b9c0c8', 'handle', 'ddoor', { on: 'dd', layer: 2 }),
        /* the controls */
        C([-10, 31.5, 15.5], 'z', 2.6, 1.2, '#7c8794', 'knob', 'dknob', { on: 'dtop' }),
        B([-10.35, -9.65, 32.5, 33.9, 16.1, 16.3], '#f2f4f6', 'knob', 'dknob', { on: 'dtop', layer: 2 }),
        B([-4, 4, 29.5, 33.5, 15, 15.25], '#123828', 'screen', 'dscrg', { id: 'dscr', on: 'dtop' })
      ]),
      motions: {
        ddoor: { do: [{ g: 'ddoor', rot: { ax: 'y', pivot: [-12.5, 0, 15.6], deg: -100 } }], dur: 850 },
        dknob: { do: [{ g: 'dknob', rot: { ax: 'z', pivot: [-10, 31.5, 15.5], deg: -90 } }], dur: 600 },
        drun: { do: [], dur: 200 }
      },
      lights: [{ g: 'dscrg', col: [24, 84, 92], when: plugged, fadeIn: 300, fadeOut: 500 }],
      displays: [{ id: 'ddisp', g: 'dscrg', on: 'dscr', part: 'screen', at: [0, 31.5, 15.25], h: 2.4, text: '45', col: '#6ff2ff', bg: '#123828', kind: 'num2', when: plugged }],
      spins: [
        { g: 'drum', ax: 'z', pivot: [-2, 16, 0], ease: 900, rate: function (sc) { return running(sc) ? 150 : 0; } },
        { g: D, wobble: [0.14, 0.03, 0.08], hz: 11, ease: 500, when: running }
      ],
      parts: {
        door: { name: 'door', can: [{ v: 'open', m: 'ddoor', to: 1 }, { v: 'close', m: 'ddoor', to: 0 }], zoom: 1.4, view: { yaw: -15 } },
        handle: { name: 'handle', can: [{ v: 'pull', m: 'ddoor', to: 'toggle' }], zoom: 2, view: { yaw: -15 } },
        drum: { name: 'drum', can: [{ v: 'put the clothes in' }, { v: 'take the clothes out' }], zoom: 1.6, view: { yaw: 10, pitch: 10 }, pose: { ddoor: 1 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'dknob', to: 'step', also: read }], zoom: 2.6, view: { yaw: -10, pitch: 8 } },
        screen: { name: 'screen', can: [{ v: 'read', fx: 'read', d: 'ddisp' }], zoom: 2.6, view: { yaw: -10, pitch: 8 } }
      }
    });
    merge(m, buttons([
      { e: [7, 10.5, 30, 33, 15, 15.6], col: '#5fbf7f', also: [{ m: 'drun', to: 'toggle' }, read], more: [{ v: 'start the machine', m: 'drun', to: 1 }, { v: 'stop the machine', m: 'drun', to: 0 }] },
      { e: [11.5, 14, 30, 33, 15, 15.6], also: read }
    ], { prefix: 'dbtn', col: '#fafafa', move: [0, 0, -0.45], on: 'dtop', parent: D, zoom: 2.8, view: { yaw: -15, pitch: 8 } }));
    withPower(m, powered([[10, 4, -14], [10, 1.2, -21], [2, 1.5, -25]], -4, -25));
  })();

  /* ── sandwich maker: a lid on a hinge, hot plates with ridges, a thermostat knob, a power light and a ready light ── */
  (function () {
    var ridges = function (y0, y1, group, on) {
      /* only the face that looks out of the plate: the rest would show through the lid */
      var keep = group === 'pl1' ? 'top' : 'bottom', o = { on: on, layer: 2, skip: ['front', 'back', 'top', 'bottom', 'right', 'left'].filter(function (x) { return x !== keep; }) }, out = [B([-0.2, 0.2, y0, y1, -9, 9], '#454545', 'plate', group, o)];
      [-5, 5].forEach(function (cx) { out.push(rotBox([cx - 10.2, cx + 10.2, y0, y1, -0.2, 0.2], 'y', 60.9, [cx, 0, 0], '#454545', 'plate', group, o)); });
      return out;
    };
    var hot = function (sc) { return sc.plugged() && sc.val.heat > 0.02; };
    var plateCol = function (sc) { return mix([60, 48, 42], [175, 80, 40], sc.val.heat); };
    var m = define('sandwich', {
      name: 'sandwich maker', view: { yaw: -30, pitch: 26, zoom: 1.25 },
      groups: { pl2: { parent: 'slid' } },
      alive: function (sc) { return sc.plugged() && sc.val.heat > 0.02; },
      shapes: [
        B([-12, 12, 0, 5, -11, 11], '#e8ebee', null, null, { id: 'sbase' }),
        B([-10, 10, 5, 5.05, -9, 9], '#2a2a2a', 'plate', 'pl1', { on: 'sbase', id: 'p1' })
      ].concat(ridges(5.05, 5.3, 'pl1', 'p1')).concat([
        C([-8, 2.5, 11.06], 'z', 0.55, 0.12, '#4a1a1a', 'light', 'sled1', { on: 'sbase', seg: 12 }),
        C([-6, 2.5, 11.06], 'z', 0.55, 0.12, '#1a3a22', null, 'sled2', { on: 'sbase', seg: 12 }),
        /* the thermostat knob */
        C([7, 2.5, 11.6], 'z', 1.9, 1.2, '#2f3338', 'knob', 'smk', { on: 'sbase', seg: 18, id: 'swk' }),
        rotBox([6.75, 7.25, 3.0, 4.2, 12.2, 12.35], 'z', 135, [7, 2.5, 11.6], '#f2f4f6', 'knob', 'smk', { on: 'swk', layer: 2 }),
        /* the lid */
        B([-12, 12, 5, 10, -11, 11], '#3f8f8a', 'lid', 'slid', { id: 'stop' }),
        B([-10, 10, 4.95, 5, -9, 9], '#2a2a2a', 'plate', 'pl2', { on: 'stop', id: 'p2' })
      ]).concat(ridges(4.75, 4.95, 'pl2', 'p2')).concat([
        B([-4, 4, 7, 8.6, 11, 14.5], '#2f3338', 'handle', 'slid')
      ]),
      motions: {
        slid: { do: [{ g: 'slid', rot: { ax: 'x', pivot: [0, 10, -11], deg: -105 } }], dur: 800 },
        heat: { do: [{ g: 'smk', rot: { ax: 'z', pivot: [7, 2.5, 11.6], deg: -270 } }], dur: 400, start: 0.6 }
      },
      lights: [
        /* the plates get hot slowly; the green light comes on when they are hot */
        { g: 'pl1', col: plateCol, when: hot, fadeIn: 3000, fadeOut: 3000 },
        { g: 'pl2', col: plateCol, when: hot, fadeIn: 3000, fadeOut: 3000 },
        { g: 'sled1', col: [255, 50, 40], when: plugged, fadeIn: 100, fadeOut: 300 },
        /* the thermostat: once the plates are hot, the green light goes on and off (every 3 s);
           the higher the heat, the longer it stays on each time */
        { g: 'sled2', col: [70, 235, 110], fadeIn: 120, fadeOut: 250, when: function (sc) {
          return hot(sc) && sc.lv[0] > 0.95 && (sc.now / 3000) % 1 < 0.15 + 0.75 * sc.val.heat;
        } }
      ],
      parts: {
        lid: { name: 'lid', can: [{ v: 'open', m: 'slid', to: 1 }, { v: 'close', m: 'slid', to: 0 }], zoom: 1.5 },
        handle: { name: 'handle', can: [{ v: 'lift', m: 'slid', to: 1 }, { v: 'push down', m: 'slid', to: 0 }], zoom: 2.2, view: { yaw: -20, pitch: 15 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'heat', to: 'up' }, { v: 'turn up the heat', m: 'heat', to: 'up' }, { v: 'turn down the heat', m: 'heat', to: 'down' }], zoom: 2.8, view: { yaw: -15, pitch: 12 } },
        plate: { name: 'hot plate', can: [{ v: 'put the bread in' }, { v: 'clean' }], zoom: 1.6, view: { pitch: 50 }, pose: { slid: 1 } },
        light: { name: 'power light', can: [{ v: 'plug in', m: 'plug', to: 1 }], zoom: 3, view: { yaw: -10, pitch: 10 } }
      }
    });
    withPower(m, powered([[8, 2, -11], [8, 1.2, -16], [0, 1.5, -19]], -6, -19));
  })();

  /* ── electric stove: five spiral elements, a knob for each (like the toaster's: more or less heat),
        one light for all of them, and an oven with a door, a handle and a rack ── */
  (function () {
    var Y = 36, EL = [[-16, 10, 7], [16, 10, 5.5], [-16, -10, 5.5], [16, -10, 7], [0, 0, 5]];   /* x, z, size: front-left, front-right, back-left, back-right, middle */
    var KX = [-26, -18, -10, -2, 6];   /* the element knobs, left to right: front-left, back-left, middle, back-right, front-right; then their light, then the oven knob */
    var KEL = [0, 2, 4, 3, 1];        /* which element each knob works */
    var shapes = [
      B([-30, 30, 0, Y, -22, 22], '#eef1f4', null, null, { skip: ['front'], id: 'stop', bias: 4 }),
      B([-30, 30, 26, Y, 21.6, 22], '#e4e8ec', null, null, { id: 'spanel' }),
      B([-30, 30, 0, 4, 21.6, 22], '#eef1f4'), B([-30, -23, 4, 26, 21.6, 22], '#eef1f4'), B([23, 30, 4, 26, 21.6, 22], '#eef1f4'),
      B([-23, 23, 4.5, 25.5, -20, 22], '#3a3f46', null, null, { inside: true, skip: ['front', 'bottom'] }),
      B([-23, 23, 4.4, 4.5, -20, 22], '#33383e', null, null, { skip: ['front', 'back', 'left', 'right', 'bottom'], bias: -12 }),   /* the oven floor: under everything in the oven */
      /* the oven door */
      B([-24, 24, 4, 26, 22, 23.6], '#e4e8ec', 'oven door', 'odoor', { id: 'od', bias: 5 }),
      B([-17, 17, 9, 21, 23.6, 23.75], '#2a2f36', 'oven door', 'owin', { on: 'od' }),
      B([-15, 15, 22.5, 23.7, 23.6, 26], '#b9c0c8', 'handle', 'odoor', { on: 'od', layer: 2 }),
      /* the light for all the elements */
      C([12, 31, 22.1], 'z', 0.7, 0.2, '#4a2a14', 'light', 'slight', { on: 'spanel', seg: 12 }),
      /* the oven knob, and the oven's heating element: a bent tube on the floor of the oven */
      C([21, 31, 22.9], 'z', 2.6, 1.8, '#2c3238', 'oven knob', 'okn', { seg: 20, id: 'ok', on: 'spanel' }),
      rotBox([20.65, 21.35, 31.8, 33.3, 23.8, 23.95], 'z', 135, [21, 31, 22.9], '#ffb347', 'oven knob', 'okn', { on: 'ok', layer: 2 }),
      { t: 'tube', pts: finely([[-19, 6, 17], [-19, 6, -16], [-11, 6, -16], [-11, 6, 14], [-3, 6, 14], [-3, 6, -16], [5, 6, -16], [5, 6, 14], [13, 6, 14], [13, 6, -16], [19, 6, -16], [19, 6, 17]], 1.5),
        r: 0.45, col: '#55575a', part: 'oven element', group: 'ocoil' }
    ];
    /* the rack: wires across, so each one sorts well against the element under it */
    for (var rz = -18; rz <= 18.5; rz += 3) shapes.push(B([-22.5, 22.5, 13, 13.25, rz - 0.15, rz + 0.15], '#b9c0c8', 'rack', null));
    shapes.push(B([-22.5, -22, 13, 13.3, -19, 19.5], '#b9c0c8', 'rack', null), B([22, 22.5, 13, 13.3, -19, 19.5], '#b9c0c8', 'rack', null));
    var ovenOn = function (sc) { return sc.plugged() && sc.val.oven > 0.02; };
    var motions = {
      odoor: { do: [{ g: 'odoor', rot: { ax: 'x', pivot: [0, 4, 23.6], deg: 85 } }], dur: 900 },
      oven: { do: [{ g: 'okn', rot: { ax: 'z', pivot: [21, 31, 22.9], deg: -270 } }], dur: 400 }
    };
    var lights = [
      /* the oven: its element glows, and the window in the door shows a warm light */
      { g: 'ocoil', col: function (sc) { return mix([160, 45, 25], [255, 120, 45], sc.val.oven); }, when: ovenOn, fadeIn: 3000, fadeOut: 4000 },
      { g: 'owin', col: function (sc) { return mix([70, 40, 30], [130, 75, 40], sc.val.oven); }, when: ovenOn, fadeIn: 3000, fadeOut: 4000 }
    ], parts = {
      'oven knob': { name: 'oven knob', can: [{ v: 'turn', m: 'oven', to: 'up' }, { v: 'turn up the heat', m: 'oven', to: 'up' }, { v: 'turn down the heat', m: 'oven', to: 'down' }, { v: 'turn off', m: 'oven', to: 0 }], zoom: 2.8, view: { yaw: -12, pitch: 14 } },
      'oven element': { name: 'heating element', can: [{ v: 'turn on', m: 'oven', to: 'up' }], zoom: 1.4, view: { yaw: -10, pitch: 35 }, pose: { odoor: 1, oven: 0.6 } },
      'oven door': { name: 'oven door', can: [{ v: 'open', m: 'odoor', to: 1 }, { v: 'close', m: 'odoor', to: 0 }], zoom: 1.3, view: { yaw: -20, pitch: 15 } },
      handle: { name: 'handle', can: [{ v: 'pull', m: 'odoor', to: 'toggle' }], zoom: 1.8, view: { yaw: -15, pitch: 10 } },
      rack: { name: 'rack', can: [{ v: 'put the food in' }, { v: 'pull out' }], zoom: 1.5, view: { yaw: -15, pitch: 25 }, pose: { odoor: 1 } },
      light: { name: 'light', can: [{ v: 'turn on an element', m: 'h4', to: 'up' }], zoom: 3, view: { yaw: -15, pitch: 10 } }
    };
    EL.forEach(function (e, i) {
      /* a spiral coil on a shiny drip pan */
      var pts = [], turns = 2.75, n = 40;
      for (var k = 0; k <= n; k++) { var t = k / n, a = t * turns * Math.PI * 2, r = 0.9 + (e[2] - 0.9) * t; pts.push([e[0] + r * Math.cos(a), Y + 0.45, e[1] + r * Math.sin(a)]); }
      shapes.push(C([e[0], Y + 0.02, e[1]], 'y', e[2] + 1.3, 0.04, '#cfd5db', 'element' + (i ? i + 1 : ''), null, { on: 'stop', seg: 26, flat: true, open: 'bottom' }));
      shapes.push({ t: 'tube', pts: pts, r: 0.36, col: '#3b3b3b', part: 'element' + (i ? i + 1 : ''), group: 'coil' + i, bias: 20 });
    });
    KX.forEach(function (x, k) {
      var i = KEL[k], hm = 'h' + i, g = 'sk' + i, id = k ? 'knob' + (k + 1) : 'knob';
      shapes.push(C([x, 31, 22.8], 'z', 2.2, 1.6, '#3a3f46', id, g, { seg: 18, id: 'k' + k, on: 'spanel' }));
      shapes.push(rotBox([x - 0.3, x + 0.3, 31.7, 32.9, 23.6, 23.75], 'z', 135, [x, 31, 22.8], '#f2f4f6', id, g, { on: 'k' + k, layer: 2 }));
      motions[hm] = { do: [{ g: g, rot: { ax: 'z', pivot: [x, 31, 22.8], deg: -270 } }], dur: 400 };
      parts[id] = { name: 'knob', can: [{ v: 'turn', m: hm, to: 'up' }, { v: 'turn up the heat', m: hm, to: 'up' }, { v: 'turn down the heat', m: hm, to: 'down' }, { v: 'turn off', m: hm, to: 0 }], zoom: 2.8, view: { yaw: -12, pitch: 14 } };
      /* the coil: slowly red — brighter at a higher setting */
      lights.push({ g: 'coil' + i, col: function (sc) { return mix([150, 40, 24], [255, 110, 40], sc.val[hm]); }, when: function (sc) { return sc.plugged() && sc.val[hm] > 0.02; }, fadeIn: 2500, fadeOut: 3500 });
    });
    EL.forEach(function (e, i) {
      parts['element' + (i ? i + 1 : '')] = { name: 'element', can: [{ v: 'turn on', m: 'h' + i, to: 'up' }, { v: 'put a pan on' }], zoom: 1.7, view: { pitch: 45, yaw: -15 }, pose: { ['h' + i]: 0.6 } };
    });
    lights.push({ g: 'slight', col: [255, 140, 40], fadeIn: 120, fadeOut: 300, when: function (sc) {
      if (!sc.plugged()) return false;
      for (var i = 0; i < 5; i++) if (sc.val['h' + i] > 0.02) return true;
      return false;
    } });
    var m = define('stove', { name: 'stove', view: { yaw: -26, pitch: 28, zoom: 0.8 }, shapes: shapes, motions: motions, lights: lights, parts: parts });
    withPower(m, powered([[20, 5, -22], [20, 1.2, -28], [10, 1.5, -32]], 4, -32));
  })();

  /* ── stand mixer: a bowl, an arm (the head) that lifts, a speed lever 0 · 1 · 2 · 3, and two attachments:
        a flat beater and a wire whisk. One is on the mixer, the other lies on the table beside it.
        The attachment turns only with the arm down; lifting the arm turns the mixer off (the lever goes back to 0).
        "Change the attachment": the arm goes up, the attachment comes off and goes to the table, the other one goes on, the arm comes down ── */
  (function () {
    var BODY = '#d64550', ARM = -55, PIVOT = [0, 22, -10], SHAFT = [0, 0, 2];
    var running = function (sc) { return sc.plugged() && sc.val.speed > 0.5 && sc.val.arm < 0.02; };
    /* where an attachment is: d = 0 on the mixer … 0.3 pulled down off the shaft … 1 lying on the table (left of the mixer) */
    var placeOps = function (sc, k) {
      var d = sc.val[k], pull = Math.min(1, d / 0.3), u = d <= 0.3 ? 0 : ease((d - 0.3) / 0.7);
      var out = [{ move: [0, -3 * pull, 0] }];
      if (sc.val.arm && u < 1) out.push({ rot: { ax: 'x', pivot: PIVOT }, deg: ARM * sc.val.arm * (1 - u) });   /* it goes with the head, less and less */
      if (u) {
        out.push({ rot: { ax: 'z', pivot: [0, 9.75, 2] }, deg: 90 * u });   /* it lies down… */
        out.push({ move: add(mul([-15, -6.45, 2], u), [0, 7 * Math.sin(Math.PI * u), 0]) });   /* …on the table (up over the bowl on the way) */
      }
      return out;
    };
    var beater = [
      B([-3, -2.4, 7.5, 18, 1.7, 2.3], '#e6e9ec', 'beater', 'beater'),
      B([2.4, 3, 7.5, 18, 1.7, 2.3], '#e6e9ec', 'beater', 'beater'),
      B([-3, 3, 7.5, 8.1, 1.7, 2.3], '#e6e9ec', 'beater', 'beater'),
      B([-3, 3, 17.4, 18, 1.7, 2.3], '#e6e9ec', 'beater', 'beater'),
      B([-0.3, 0.3, 8.1, 17.4, 1.7, 2.3], '#e6e9ec', 'beater', 'beater')
    ];
    /* the wire whisk: four loops of wire (eight wires) from the top down to a round bottom */
    var whisk = [C([0, 17.6, 2], 'y', 0.95, 2, '#c9d0d7', 'whisk', 'whisk', { seg: 14 })];
    for (var L = 0; L < 4; L++) {
      var phi = L * Math.PI / 4, pts = [];
      var at = function (q, side) { var r = 3.3 * Math.sin(Math.PI * Math.pow(q, 1.6)) * side; return [r * Math.cos(phi), 16.8 - 9.3 * q, 2 + r * Math.sin(phi)]; };
      for (var i = 0; i <= 14; i++) pts.push(at(i / 14, 1));
      for (i = 13; i >= 0; i--) pts.push(at(i / 14, -1));
      whisk.push({ t: 'tube', pts: pts, r: 0.13, col: '#dfe4e8', part: 'whisk', group: 'whisk' });
    }
    var change = {
      v: 'change the attachment', period: 6800,
      seq: function (sc) {
        var on = sc.val.dB < 0.5 ? 'dB' : 'dW', off = on === 'dB' ? 'dW' : 'dB', up = sc.val.arm > 0.9 ? 0 : 850;
        return [{ m: 'speed', to: 0 }, { m: 'arm', to: 1 },
          { m: on, to: 1, wait: up, dur: 1500 }, { m: off, to: 0, wait: up + 1700, dur: 1500 }, { m: 'arm', to: 0, wait: up + 3400 }];
      }
    };
    var m = define('mixer', {
      name: 'stand mixer', view: { yaw: -40, pitch: 16, zoom: 1.0 },
      groups: { msw: { parent: 'head' }, beater: { ops: function (sc) { return placeOps(sc, 'dB'); } }, whisk: { ops: function (sc) { return placeOps(sc, 'dW'); } } },
      shapes: [
        B([-9, 9, 0, 3, -14, 10], BODY, null, null, { id: 'mbase' }),
        C([0, 3.3, 2], 'y', 6, 0.6, '#b9c0c8', null, null, { seg: 24, on: 'mbase' }),
        C([0, 9.1, 2], 'y', 4.5, 11, '#d5dce2', 'bowl', null, { r2: 7.5, open: 'top', seg: 26, seamless: true }),
        C([0, 9.2, 2], 'y', 4.1, 10.8, '#9aa3ad', 'bowl', null, { r2: 7.1, open: 'top', inside: true, seg: 26, seamless: true }),
        B([-4, 4, 3, 22, -13, -7], BODY, null, null, { id: 'mcol' }),
        /* the head (the arm), on a hinge at the top of the column, and the shaft the attachments go on */
        B([-4.5, 4.5, 20, 29, -13.5, 8], BODY, 'arm', 'head', { id: 'mhead' }),
        C([0, 24.5, 8.6], 'z', 2.6, 1.2, '#b9c0c8', 'arm', 'head', { seg: 18, on: 'mhead' }),
        C([0, 19.2, 2], 'y', 0.45, 2.6, '#b9c0c8', 'arm', 'head', { seg: 10, on: 'mhead' }),
        /* the speed lever on the right side of the head */
        rotBox([4.5, 5.0, 24, 25.9, -7.3, -6.7], 'x', 37.5, [4.75, 24, -7], '#2f3338', 'knob', 'msw', { on: 'mhead' }),
        rotBox([4.5, 5.3, 25.7, 26.5, -7.45, -6.55], 'x', 37.5, [4.75, 24, -7], '#2f3338', 'knob', 'msw', { on: 'mhead' })
      ].concat(beater).concat(whisk),
      motions: {
        arm: { do: [{ g: 'head', rot: { ax: 'x', pivot: PIVOT, deg: ARM } }], dur: 800 },
        speed: { do: [{ g: 'msw', rot: { ax: 'x', pivot: [4.75, 24, -7], deg: -25 } }], dur: 220 },
        dB: { do: [], dur: 1500, start: 0 },   /* the beater: on the mixer */
        dW: { do: [], dur: 1500, start: 1 }    /* the whisk: on the table */
      },
      /* the numbers by the lever (they go round with the head) */
      displays: [{ id: 'mmarks', g: 'head', on: 'mhead', part: 'knob', at: [4.5, 27.8, -7], u: [0, 0, -1], v: [0, 1, 0], h: 1.4, text: '0123', col: '#fbe3e5', bg: BODY, when: function () { return true; } }],
      spins: [
        { g: 'beater', ax: 'y', pivot: SHAFT, ease: 600, rate: function (sc) { return running(sc) && sc.val.dB < 0.01 ? sc.val.speed * 220 : 0; } },
        { g: 'whisk', ax: 'y', pivot: SHAFT, ease: 600, rate: function (sc) { return running(sc) && sc.val.dW < 0.01 ? sc.val.speed * 300 : 0; } }
      ],
      /* lifting the arm turns the mixer off */
      timers: [{ when: function (sc) { return sc.val.arm > 0.05 && sc.val.speed > 0.02; }, after: 0, act: { m: 'speed', to: 0 } }],
      parts: {
        knob: { name: 'knob', can: [{ v: 'switch on', m: 'speed', to: 1 }, { v: 'change the speed', m: 'speed', to: 'cycle', max: 3 }, { v: 'switch off', m: 'speed', to: 0 }], zoom: 2.8, view: { yaw: -80, pitch: 12 } },
        arm: { name: 'arm', can: [{ v: 'lift', m: 'arm', to: 1 }, { v: 'lower', m: 'arm', to: 0 }], zoom: 1.2, view: { yaw: -70, pitch: 10 } },
        beater: { name: 'beater', can: [{ v: 'mix', m: 'speed', to: 1, if: function (sc) { return sc.val.dB < 0.5; } }, change], zoom: 1.2, view: { yaw: -30, pitch: 20 } },
        whisk: { name: 'whisk', can: [{ v: 'whisk', m: 'speed', to: 1, if: function (sc) { return sc.val.dW < 0.5; } }, change], zoom: 1.2, view: { yaw: -30, pitch: 20 } },
        bowl: { name: 'bowl', can: [{ v: 'put the ingredients in' }], zoom: 1.6, view: { yaw: -30, pitch: 35 } }
      }
    });
    withPower(m, powered([[6, 1.5, -14], [6, 1.2, -19], [0, 1.5, -22]], -6, -22));
  })();

  /* ── desk lamp: the bulb shines when it is switched on and plugged in — not while it is being changed ── */
  withPower(define('lamp', {
    name: 'lamp', view: { yaw: -28, pitch: 14 },
    groups: { bulb: { parent: 'shade' } },
    shapes: [
      C([0, 1, 0], 'y', 7, 2, '#2f3338'),
      B([2.5, 5, 2, 2.8, 2.2, 4.4], '#e9ecef', 'switch', 'lsw'),
      { t: 'tube', pts: [[0, 2, -1], [0, 17, -4], [7, 27, -1]], r: 0.65, col: '#2f3338' },
      C([8, 24.5, 0], 'y', 6, 5, '#2c7a7b', 'shade', 'shade', { r2: 2.2 }),
      C([8, 21.8, 0], 'y', 1.8, 2.4, '#ecece2', 'bulb', 'bulb', { seg: 14 })
    ],
    motions: {
      lsw: { do: [{ g: 'lsw', rot: { ax: 'x', pivot: [3.75, 2.4, 3.3], deg: 18 } }], dur: 240 },
      shade: { do: [{ g: 'shade', rot: { ax: 'z', pivot: [7, 27, -1], deg: 22 } }], dur: 700 },
      bulb: { do: [{ g: 'bulb', move: [0, -3, 0] }], dur: 500 }
    },
    lights: [{ g: 'bulb', col: [255, 222, 120], glow: [8, 21.8, 0], glowBias: 5, fadeIn: 150, fadeOut: 250,
      when: function (sc) { return sc.on('lsw') && sc.plugged() && sc.val.bulb < 0.02; } }],
    parts: {
      switch: { name: 'switch', can: [{ v: 'switch on', m: 'lsw', to: 1 }, { v: 'switch off', m: 'lsw', to: 0 }], zoom: 2.8, view: { pitch: 40, yaw: -10 } },
      shade: { name: 'shade', can: [{ v: 'move', m: 'shade', to: 'toggle' }], zoom: 1.6 },
      bulb: { name: 'light bulb', can: [{ v: 'change', m: 'bulb', to: 'bounce' }, { v: 'switch on', m: 'lsw', to: 1 }], zoom: 1.9, view: { pitch: -15 } }
    }
  }), powered([[0, 1, -7], [0, 1, -12], [-5, 1.5, -16]], -9, -16));

  /* ── smartphone on a stand: a touch screen, three buttons, a camera with a flash (it has a battery: no plug) ── */
  (function () {
    var icons = [], ICON = ['#3ddc84', '#ff8a3d', '#4fa3ff', '#ffd23f'];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
      var x = -2.85 + c * 1.55, y = 13.6 - r * 1.75;
      icons.push(B([x, x + 1.05, y, y + 1.05, 0.5, 0.53], '#0d1014', 'screen', 'pic' + ((r + c) % 4), { on: 'pscr', layer: 2 }));
    }
    var pon = function (sc) { return sc.on('pon'); };
    /* taking a photo: the screen flashes white for a moment */
    var shutter = ['pscr', 'pic0', 'pic1', 'pic2', 'pic3'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return 'vbar' + i; })).map(function (g) {
      return { g: g, col: [255, 255, 255], when: function (sc) { return sc.on('pon') && sc.val.snap > 0.35; }, fadeIn: 40, fadeOut: 260 };
    });
    var m = define('phone', {
      name: 'smartphone', view: { yaw: -24, pitch: 10, zoom: 0.95 },
      shapes: [
        B([-5, 5, 0, 0.8, -3.5, 2.5], '#b9c0c8'),
        B([-5, 5, 0.8, 2.0, 0.55, 1.5], '#b9c0c8'),
        rotBox([-3, 3, 0.8, 8, -1.4, -0.6], 'x', -12, [0, 0.8, -0.6], '#aab2bb'),
        B([-3.8, 3.8, 1, 17, -0.45, 0.45], '#22262b', null, null, { id: 'pbody' }),
        B([-3.4, 3.4, 2.2, 16.2, 0.45, 0.5], '#0d1014', 'screen', 'pscr', { id: 'pscr', on: 'pbody' }),
        B([-0.9, 0.9, 16.45, 16.65, 0.45, 0.5], '#3a3f46', null, null, { on: 'pbody', layer: 2 }),
        B([-1.4, 1.4, 1.45, 1.75, 0.45, 0.5], '#3a3f46', 'speaker', null, { on: 'pbody', layer: 2 })
      ].concat(icons).concat([
        /* the camera on the back: no faces looking forward, so nothing shows through the screen */
        B([1.4, 3.3, 14.4, 16.4, -0.5, -0.45], '#15181b', 'camera', null, { id: 'pcam', on: 'pbody', skip: ['front', 'left', 'right', 'top', 'bottom'] }),
        C([2.35, 15.9, -0.5], 'z', 0.5, 0.02, '#1e3f66', 'camera', null, { on: 'pcam', layer: 2, seg: 14, flat: true, open: 'top' }),
        C([2.35, 14.9, -0.5], 'z', 0.4, 0.02, '#1e3f66', 'camera', null, { on: 'pcam', layer: 2, seg: 14, flat: true, open: 'top' }),
        B([0.2, 1.0, 15.6, 16.2, -0.5, -0.45], '#d8d2b8', 'camera', 'flash', { on: 'pbody', skip: ['front', 'left', 'right', 'top', 'bottom'] })
      ]),
      motions: {
        vol: VOL.vol, vshow: VOL.vshow,
        pon: { do: [], dur: 200, start: 1 },
        snap: { do: [], dur: 420 }
      },
      lights: shutter.concat([
        { g: 'pscr', col: [44, 92, 168], when: pon, fadeIn: 350, fadeOut: 300 },
        /* the flash: very bright, with a big white glow behind the phone */
        { g: 'flash', col: [255, 255, 255], glow: [0.6, 15.9, -0.9], glowR: 18, glowCol: 'white', glowBias: 0.3, when: function (sc) { return sc.val.snap > 0.12; }, fadeIn: 30, fadeOut: 500 }
      ]).concat(ICON.map(function (col, i) { return { g: 'pic' + i, col: rgb(col), when: pon, fadeIn: 350, fadeOut: 300 }; })),
      parts: {
        screen: { name: 'screen', can: [{ v: 'tap', fx: 'tap', at: [0.8, 9, 0.55] }, { v: 'swipe', fx: 'swipe', from: [-2.2, 8, 0.55], to: [2.2, 8, 0.55] }], zoom: 1.15, view: { yaw: -8, pitch: 6 } },
        camera: { name: 'camera', can: [{ v: 'take a photo', m: 'snap', to: 'bounce' }], zoom: 2.2, view: { yaw: 160, pitch: 10 } },
        speaker: { name: 'speaker', can: [{ v: 'turn up the volume', m: 'vol', to: 'up', also: louder[1] }, { v: 'turn down the volume', m: 'vol', to: 'down', also: quieter[1] }], zoom: 2.4, view: { yaw: -8, pitch: 6 } }
      }
    });
    merge(m, volumeBar(-2.6, 2.6, 4.2, 1.4, 0.5, 'pscr', 2, pon, [44, 92, 168]));
    merge(m, buttons([
      { e: [3.8, 4.1, 12, 14, -0.25, 0.25], move: [-0.18, 0, 0], also: { m: 'pon', to: 'toggle' }, more: [{ v: 'switch on', m: 'pon', to: 1 }, { v: 'switch off', m: 'pon', to: 0 }], view: { yaw: 60, pitch: 8 } },
      { e: [-4.1, -3.8, 13, 14.6, -0.25, 0.25], move: [0.18, 0, 0], also: louder, more: [{ v: 'turn up the volume', m: 'vol', to: 'up', also: louder[1] }], view: { yaw: -70, pitch: 8 } },
      { e: [-4.1, -3.8, 10.8, 12.4, -0.25, 0.25], move: [0.18, 0, 0], also: quieter, more: [{ v: 'turn down the volume', m: 'vol', to: 'down', also: quieter[1] }], view: { yaw: -70, pitch: 8 } }
    ], { prefix: 'phb', col: '#3a3f46', zoom: 1.8 }));
  })();

  /* ── TV and its remote control: the picture changes with the channel; a red light on standby ── */
  (function () {
    var PICS = [   /* the picture on each channel: sky / middle / bottom / a spot */
      [[110, 180, 240], [120, 200, 110], [70, 150, 70], [255, 220, 80]],
      [[250, 150, 90], [200, 90, 110], [60, 40, 80], [255, 205, 90]],
      [[30, 60, 120], [220, 225, 235], [200, 40, 40], [255, 255, 255]],
      [[255, 130, 205], [120, 230, 255], [255, 230, 90], [130, 255, 130]]
    ];
    var VIDS = [   /* the other sources: video 1 (a game), video 2 (nothing connected: a blue screen) */
      [[24, 22, 48], [70, 200, 95], [44, 40, 70], [240, 70, 70]],
      [[30, 70, 210], [30, 70, 210], [30, 70, 210], [30, 70, 210]]
    ];
    var pal = function (sc) { return sc.state.src ? VIDS[sc.state.src - 1] : PICS[sc.state.ch]; };
    var tvOn = function (sc) { return sc.on('tvon') && sc.plugged(); };
    var pic = function (i) { return { g: 'pic' + i, col: function (sc) { return pal(sc)[i]; }, when: tvOn, fadeIn: 400, fadeOut: 300 }; };
    var osd = { m: 'osd', to: 'bounce' };
    var m = define('tv', {
      name: 'TV', view: { yaw: -22, pitch: 14, zoom: 0.95 }, channels: 4, sources: 3,
      groups: { remote: {} },
      shapes: [
        B([-12, 12, 0, 1.2, -7, 5], '#2a2e33'),
        B([-3, 3, 1.2, 8, -2.4, -0.8], '#2a2e33'),
        B([-25, 25, 8, 37, -1.5, 1.5], '#1d2024', null, null, { id: 'tvb' }),
        B([-17, 17, 12, 33, -2.2, -1.5], '#24282d', null, null, { skip: ['front', 'left', 'right', 'top', 'bottom'], on: 'tvb' }),
        B([-23.5, 23.5, 9.5, 35.5, 1.5, 1.58], '#0b0d10', 'screen', 'tvs', { id: 'tvs', on: 'tvb' }),
        B([-23.5, 23.5, 27, 35.5, 1.58, 1.62], '#0b0d10', 'screen', 'pic0', { on: 'tvs', layer: 2, seamless: true }),
        B([-23.5, 23.5, 18, 27, 1.58, 1.62], '#0b0d10', 'screen', 'pic1', { on: 'tvs', layer: 2, seamless: true }),
        B([-23.5, 23.5, 9.5, 18, 1.58, 1.62], '#0b0d10', 'screen', 'pic2', { on: 'tvs', layer: 2, seamless: true }),
        B([12, 18, 28.5, 33.5, 1.62, 1.66], '#0b0d10', 'screen', 'pic3', { on: 'tvs', layer: 3, seamless: true }),
        B([20.5, 21.7, 8.5, 9.1, 1.5, 1.6], '#3a1616', null, 'tvled', { on: 'tvb', layer: 2 }),
        B([-12, 10, 8.35, 9.15, 1.5, 1.56], '#2c3036', 'speaker', null, { on: 'tvb', layer: 2 }),
        /* the remote control, lying in front of the TV */
        B([6, 10, 0, 1.4, 8, 22], '#454b54', 'remote', 'remote', { id: 'rbody' }),
        B([6.6, 9.4, 1.4, 1.43, 17, 21], '#5a616b', 'remote', 'remote', { on: 'rbody', layer: 2 })
      ],
      motions: {
        tvon: { do: [], dur: 200, start: 1 },
        osd: { do: [], dur: 1100 },
        vol: VOL.vol, vshow: VOL.vshow,
        rlift: { do: [{ g: 'remote', rot: { ax: 'x', pivot: [8, 0.7, 15], deg: 30 } }, { g: 'remote', move: [4, 9, 10] }], dur: 800 }
      },
      /* the on-screen display: the channel or the source, for a moment after it changes */
      displays: [0, 1].map(function (k) {   /* a dark shadow, then the green letters */
        return { id: 'osd' + k, g: 'tvs', on: 'tvs', layer: 4 + k, part: 'screen', at: [-15.5 + (k ? 0 : 0.14), 32.6 - (k ? 0 : 0.14), 1.67], h: 2.3, font: 'pix',
          col: k ? '#7dff9a' : '#000000', bg: k ? '#1c3a1c' : '#000000', fadeIn: 80, fadeOut: 300,
          when: function (sc) { return tvOn(sc) && sc.val.osd > 0.04; }, textFn: function (sc) { return sc.state.src ? 'VIDEO-' + sc.state.src : 'CH ' + (sc.state.ch + 1); } };
      }),
      lights: [0, 1, 2, 3].map(pic).concat([
        { g: 'tvs', col: [20, 24, 30], when: tvOn, fadeIn: 400, fadeOut: 300 },
        { g: 'tvled', col: [255, 40, 40], when: function (sc) { return sc.plugged() && !sc.on('tvon'); }, fadeIn: 200, fadeOut: 800 }
      ]),
      parts: {
        screen: { name: 'screen', can: [{ v: 'watch', m: 'tvon', to: 1 }, { v: 'switch on', m: 'tvon', to: 1 }, { v: 'switch off', m: 'tvon', to: 0 }, { v: 'change the source', fx: 'source', also: [{ m: 'tvon', to: 1 }, osd] }], zoom: 1.1 },
        remote: { name: 'remote control', can: [{ v: 'pick up', m: 'rlift', to: 'toggle' }, { v: 'change the channel', fx: 'channel', dir: 1, also: [{ m: 'tvon', to: 1 }, osd] },
          { v: 'change the source', fx: 'source', also: [{ m: 'tvon', to: 1 }, osd] },
          { v: 'turn up the volume', m: 'vol', to: 'up', also: louder[1] }, { v: 'turn down the volume', m: 'vol', to: 'down', also: quieter[1] }], zoom: 2.2, view: { pitch: 40, yaw: -15 } },
        speaker: { name: 'speaker', can: [{ v: 'turn up the volume', m: 'vol', to: 'up', also: louder[1] }, { v: 'turn down the volume', m: 'vol', to: 'down', also: quieter[1] }], zoom: 2.4, view: { yaw: -10, pitch: 8 } }
      }
    });
    /* the volume on the screen, in the same letters, in the middle: VOLUME ||||||---- (one | for each of 10 steps) */
    m.displays = m.displays.concat([0, 1].map(function (k) {
      return { id: 'vosd' + k, g: 'tvs', on: 'tvs', layer: 4 + k, part: 'screen', at: [0 + (k ? 0 : 0.14), 11.6 - (k ? 0 : 0.14), 1.67], h: 2.3, font: 'pix',
        col: k ? '#7dff9a' : '#000000', bg: k ? '#1c3a1c' : '#000000', fadeIn: 80, fadeOut: 300,
        when: function (sc) { return tvOn(sc) && sc.val.vshow > 0.04; },
        textFn: function (sc) { var n = Math.round(sc.val.vol * 10); return 'VOLUME ' + new Array(n + 1).join('|') + new Array(11 - n).join('-'); } };
    }));
    var R = { parent: 'remote', move: [0, -0.25, 0], view: { pitch: 55, yaw: -10 }, zoom: 3 };
    var rb = function (x, z, col, also, more) { return Object.assign({ e: [x, x + 1.2, 1.4, 1.75, z, z + 1.2], col: col, also: also, more: more }, R); };
    merge(m, buttons([
      { e: [15, 18, 8.3, 9.2, 1.5, 1.85], col: '#3a3f46', move: [0, 0, -0.3], also: { m: 'tvon', to: 'toggle' }, more: [{ v: 'switch on', m: 'tvon', to: 1 }, { v: 'switch off', m: 'tvon', to: 0 }], view: { yaw: -10, pitch: 6 }, zoom: 3 },
      rb(6.6, 9.2, '#d9483b', { m: 'tvon', to: 'toggle' }, [{ v: 'switch on', m: 'tvon', to: 1 }, { v: 'switch off', m: 'tvon', to: 0 }]),
      rb(8.2, 9.2, '#5fa8d3', [{ fx: 'source' }, osd], [{ v: 'change the source', fx: 'source', also: osd }]),
      rb(8.2, 11.5, '#e9ecef', [{ fx: 'channel', dir: 1 }, osd], [{ v: 'change the channel', fx: 'channel', dir: 1, also: osd }]),
      rb(8.2, 13.4, '#e9ecef', [{ fx: 'channel', dir: -1 }, osd], [{ v: 'go back a channel', fx: 'channel', dir: -1, also: osd }]),
      rb(6.6, 11.5, '#9fb0c0', louder, [{ v: 'turn up the volume', m: 'vol', to: 'up', also: louder[1] }]),
      rb(6.6, 13.4, '#9fb0c0', quieter, [{ v: 'turn down the volume', m: 'vol', to: 'down', also: quieter[1] }])
    ], { prefix: 'tvb' }));
    withPower(m, powered([[20, 10, -1.5], [20, 1.2, -6], [12, 1.5, -12]], 6, -12));
  })();

  /* ── fan: three blades that spin; a toggle switch with 0 · 1 · 2 · 3 ── */
  (function () {
    var blades = [];
    for (var i = 0; i < 3; i++) blades.push(rotBox([-1.8, 1.8, 25.5, 33.5, 3.0, 3.35], 'z', i * 120, [0, 24, 0], '#7cc4c8', 'blade', 'blades'));
    var guard = [{ t: 'tube', pts: ring([0, 24, 4.6], 10.6, 28), r: 0.2, col: '#b8c0c8', group: 'head' }, { t: 'tube', pts: ring([0, 24, 1.6], 10.6, 28), r: 0.2, col: '#b8c0c8', group: 'head' }];
    for (i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2;
      guard.push({ t: 'tube', pts: [[1.9 * Math.cos(a), 24 + 1.9 * Math.sin(a), 4.8], [10.6 * Math.cos(a), 24 + 10.6 * Math.sin(a), 4.6]], r: 0.16, col: '#b8c0c8', group: 'head' });
    }
    var m = define('fan', {
      name: 'fan', view: { yaw: -30, pitch: 12, zoom: 0.95 },
      shapes: [
        C([0, 1, 0], 'y', 9, 2, '#e8ebee'),
        B([-3, 3, 2, 4.2, 4, 8], '#d5dade', 'switch', null, { id: 'fhous' }),
        rotBox([-0.35, 0.35, 4.2, 6.2, 5.0, 5.8], 'z', 37.5, [0, 4.2, 5.4], '#2f3338', 'switch', 'fsw'),
        rotBox([-0.6, 0.6, 6.0, 6.8, 4.9, 5.9], 'z', 37.5, [0, 4.2, 5.4], '#2f3338', 'switch', 'fsw'),
        C([0, 12, -2], 'y', 0.9, 20, '#cfd5db'),
        C([0, 24, -1], 'z', 3.2, 7, '#e8ebee', null, 'head'),
        C([0, 27.8, -2], 'y', 0.7, 1.6, '#2f3338', 'knob', 'swk', { seg: 12 }),
        C([0, 24, 3.2], 'z', 1.6, 1.4, '#cfd5db', 'blade', 'blades', { seg: 14 })
      ].concat(blades).concat(guard).concat([
        C([0, 24, 4.85], 'z', 1.9, 0.35, '#2c7a7b', null, 'head', { seg: 16 })
      ]),
      groups: { blades: { parent: 'head' }, swk: { parent: 'head' } },
      motions: {
        swing: { do: [{ g: 'swk', move: [0, -0.7, 0] }], dur: 300 },
        speed: { do: [{ g: 'fsw', rot: { ax: 'z', pivot: [0, 4.2, 5.4], deg: -25 } }], dur: 220 }
      },
      /* the numbers by the switch */
      displays: [{ id: 'fmarks', on: 'fhous', part: 'switch', at: [0, 4.2, 7.0], u: [1, 0, 0], v: [0, 0, -1], h: 1.4, text: '0123', col: '#3a3f45', bg: '#d5dade', when: function () { return true; } }],
      spins: [
        { g: 'blades', ax: 'z', pivot: [0, 24, 0], ease: 900, rate: function (sc) { return sc.plugged() ? Math.max(0, sc.val.speed) * 400 : 0; } },
        /* swing: the head turns from side to side while the knob is down and the fan is on */
        { g: 'head', ax: 'y', pivot: [0, 24, -2], swing: 40, hz: 0.14, ease: 700, when: function (sc) { return sc.on('swing') && sc.plugged() && sc.val.speed > 0.5; } }
      ],
      parts: {
        switch: { name: 'switch', can: [{ v: 'switch on', m: 'speed', to: 1 }, { v: 'change the speed', m: 'speed', to: 'cycle', max: 3 }, { v: 'switch off', m: 'speed', to: 0 }], zoom: 3, view: { pitch: 45, yaw: -10 } },
        blade: { name: 'blade', can: [{ v: 'spin', m: 'speed', to: 1 }], zoom: 1.4, view: { yaw: -15, pitch: 6 } },
        knob: { name: 'knob', can: [{ v: 'push down', m: 'swing', to: 1 }, { v: 'pull up', m: 'swing', to: 0 }], zoom: 1.3, view: { yaw: -20, pitch: 30 }, pose: { speed: 2 } }
      }
    });
    withPower(m, powered([[0, 1, -9], [0, 1, -13], [-5, 1.5, -17]], -9, -17));
  })();

  /* ── stereo: a radio display, a CD tray, a volume knob, buttons, two speakers that move with the music ── */
  (function () {
    var playing = function (sc) { return sc.on('play') && sc.plugged(); };
    var speaker = function (x, k) {
      return [
        B([x - 4.5, x + 4.5, 0, 16, -7, 7], '#3a3f46', null, null, { id: 'spk' + k }),
        C([x, 9.5, 7.2], 'z', 3.3, 0.4, '#1b1e22', 'speaker' + (k ? '2' : ''), 'cone' + k, { on: 'spk' + k, seg: 22 }),
        C([x, 9.5, 7.45], 'z', 1.1, 0.3, '#30353c', 'speaker' + (k ? '2' : ''), 'cone' + k, { on: 'spk' + k, layer: 2, seg: 14 }),
        C([x, 3.6, 7.15], 'z', 1.3, 0.3, '#1b1e22', 'speaker' + (k ? '2' : ''), null, { on: 'spk' + k, seg: 14 })
      ];
    };
    /* the graphic equalizer: 7 bands × 8 steps that dance with the music — higher when it is louder */
    var EQ = { shapes: [], lights: [] }, BANDS = 7, STEPS = 8;
    var level = function (sc, b) {
      var t = sc.now / 1000;
      var v = 0.35 + 0.65 * Math.abs(Math.sin(t * (2.1 + 0.83 * b) + b * 1.7)) * (0.55 + 0.45 * Math.sin(t * (0.9 + 0.31 * b) + b));
      return v * sc.val.vol * (1 - 0.06 * Math.abs(b - 2));
    };
    for (var b = 0; b < BANDS; b++) for (var j = 0; j < STEPS; j++) {
      var x = -7.6 + b * 1.6, y = 13.1 + j * 0.46, g = 'eq' + b + '_' + j;
      EQ.shapes.push(B([x, x + 1.15, y, y + 0.34, 10.15, 10.17], '#0c1318', 'screen2', g, { on: 'eqs', layer: 2, seamless: true }));
      EQ.lights.push({ g: g, col: j < 5 ? [80, 230, 110] : j < 7 ? [255, 210, 60] : [255, 70, 60], fadeIn: 50, fadeOut: 160,
        when: (function (b, j) { return function (sc) { return playing(sc) && level(sc, b) * STEPS > j + 0.5; }; })(b, j) });
    }
    var spk = { name: 'speaker', can: [{ v: 'listen to music', m: 'play', to: 1 }, { v: 'turn up the volume', m: 'vol', to: 'up', also: { m: 'play', to: 1 } }, { v: 'turn down the volume', m: 'vol', to: 'down', also: { m: 'play', to: 1 } }], zoom: 1.8, view: { yaw: -15, pitch: 8 } };
    var m = define('stereo', {
      name: 'stereo', view: { yaw: -22, pitch: 16, zoom: 1.05 },
      shapes: [
        B([-12, 12, 0, 18, -10, 10], '#2b2f35', null, null, { id: 'sb' }),
        B([-8.2, 4.2, 12.8, 17, 10, 10.15], '#0c1318', 'screen2', null, { id: 'eqs', on: 'sb' }),
        B([-8, 4, 6.5, 9, 10, 10.15], '#0f2a3a', 'screen', 'sscr', { id: 'sscr', on: 'sb' }),
        B([-8.2, 4.2, 10.4, 11.9, 10, 10.05], '#17191d', null, null, { on: 'sb' }),
        /* the CD tray: inside the stereo until it opens (clipZ: nothing behind the front is drawn) */
        B([-8, 4, 10.5, 11.8, 0, 10.08], '#202328', 'tray', 'tray', { id: 'tray', clipZ: 10, bias: 1 }),
        C([-2, 11.82, 5], 'y', 4.4, 0.04, '#cfd8e3', 'tray', 'tray', { on: 'tray', layer: 2, clipZ: 10.1, seg: 24, flat: true, open: 'bottom' }),
        C([-2, 11.86, 5], 'y', 0.8, 0.04, '#8a96a4', 'tray', 'tray', { on: 'tray', layer: 3, clipZ: 10.1, seg: 12, flat: true, open: 'bottom' }),
        C([8, 7.5, 10.6], 'z', 2.4, 1.2, '#9aa3ad', 'knob', 'sknob', { seg: 22, id: 'svk', on: 'sb' }),
        /* the knob's mark: at volume 0 it points down-left, at 1 down-right (it turns 270°) */
        rotBox([7.7, 8.3, 8.6, 9.7, 11.2, 11.35], 'z', 135, [8, 7.5, 10.6], '#f2f4f6', 'knob', 'sknob', { on: 'svk', layer: 2 })
      ].concat(speaker(-19.5, 0)).concat(speaker(19.5, 1)),
      motions: {
        tray: { do: [{ g: 'tray', move: [0, 0, 9] }], dur: 900 },
        vol: { do: [{ g: 'sknob', rot: { ax: 'z', pivot: [8, 7.5, 10.6], deg: -270 } }], dur: 400, start: 0.6, step: 0.1 },
        play: { do: [], dur: 200 }
      },
      lights: [{ g: 'sscr', col: [22, 66, 90], when: plugged, fadeIn: 300, fadeOut: 500 }],
      displays: [{ id: 'sdisp', g: 'sscr', on: 'sscr', part: 'screen', at: [-2, 7.75, 10.15], h: 1.9, text: '98.5', col: '#7fe0ff', bg: '#0f2a3a', kind: 'freq', when: plugged }],
      spins: [
        /* the louder, the more the speakers move */
        { g: 'cone0', wobble: [0, 0, 0.6], hz: 5, when: playing, ease: 200, scale: function (sc) { return sc.val.vol; } },
        { g: 'cone1', wobble: [0, 0, 0.6], hz: 5, when: playing, ease: 200, scale: function (sc) { return sc.val.vol; } }
      ],
      parts: {
        screen: { name: 'screen', can: [{ v: 'read', fx: 'read', d: 'sdisp' }], zoom: 2.6, view: { yaw: -8, pitch: 8 } },
        screen2: { name: 'equalizer', can: [{ v: 'watch', m: 'play', to: 1 }, { v: 'turn up the volume', m: 'vol', to: 'up', also: { m: 'play', to: 1 } }, { v: 'turn down the volume', m: 'vol', to: 'down', also: { m: 'play', to: 1 } }], zoom: 2.6, view: { yaw: -8, pitch: 8 } },
        tray: { name: 'CD tray', can: [{ v: 'open', m: 'tray', to: 1 }, { v: 'close', m: 'tray', to: 0 }, { v: 'put a CD in' }], zoom: 2.2, view: { yaw: -20, pitch: 30 }, at: [-2, 11.2, 10.1], pose: { tray: 1 } },
        knob: { name: 'knob', can: [{ v: 'turn', m: 'vol', to: 'up' }, { v: 'turn up the volume', m: 'vol', to: 'up' }, { v: 'turn down the volume', m: 'vol', to: 'down' }], zoom: 2.8, view: { yaw: -12, pitch: 8 } },
        speaker: spk, speaker2: spk
      }
    });
    merge(m, buttons([
      { e: [-8, -5.8, 3, 4.6, 10, 10.5], col: '#5fbf7f', also: [{ m: 'play', to: 1 }], more: [{ v: 'play music', m: 'play', to: 1 }] },
      { e: [-5, -2.8, 3, 4.6, 10, 10.5], col: '#d9483b', also: [{ m: 'play', to: 0 }], more: [{ v: 'stop the music', m: 'play', to: 0 }] },
      { e: [-2, 0.2, 3, 4.6, 10, 10.5], col: '#e9ecef', also: [{ m: 'tray', to: 'toggle' }], more: [{ v: 'open the CD tray', m: 'tray', to: 1 }, { v: 'close the CD tray', m: 'tray', to: 0 }] },
      { e: [1, 3.2, 3, 4.6, 10, 10.5], col: '#e9ecef', also: [{ fx: 'read', d: 'sdisp' }], more: [{ v: 'change the station', fx: 'read', d: 'sdisp' }] }
    ], { prefix: 'sbt', move: [0, 0, -0.35], on: 'sb', zoom: 3, view: { yaw: -10, pitch: 10 } }));
    merge(m, EQ);
    withPower(m, powered([[10, 3, -10], [10, 1.2, -15], [2, 1.5, -18]], -4, -18));
  })();

  /* ── refrigerator: a fridge and a freezer, shelves with food, a light that comes on when the door opens ── */
  (function () {
    var food = function (s) { s.bias = (s.bias || 0) - 2.5; return s; };
    var m = define('fridge', {
      name: 'refrigerator', view: { yaw: -32, pitch: 14, zoom: 0.85 },
      groups: { fscrg: { parent: 'zdoor' } },
      shapes: [
        B([-15, 15, 0, 60, -14, 14], '#eef1f4', null, null, { skip: ['front'], bias: 4 }),   /* the outside walls: in front of everything inside */
        B([-15, -14, 0, 60, 13.6, 14], '#eef1f4'), B([14, 15, 0, 60, 13.6, 14], '#eef1f4'),
        B([-15, 15, 59, 60, 13.6, 14], '#eef1f4'), B([-15, 15, 0, 2, 13.6, 14], '#eef1f4'), B([-15, 15, 40, 42, 13.6, 14], '#eef1f4'),
        B([-14, 14, 2, 40, -13, 14], '#dfe6ec', null, null, { inside: true, skip: ['front'], id: 'fin' }),
        B([-14, 14, 42, 59, -13, 14], '#d3dde6', null, null, { inside: true, skip: ['front'] }),
        B([-14, 14, 14, 14.5, -13, 12], '#cfe3ef', 'shelf', null, { bias: -2.5 }),
        B([-14, 14, 27, 27.5, -13, 12], '#cfe3ef', 'shelf2', null, { bias: -2.5 }),
        B([-4, 4, 39.6, 40, -2, 5], '#e7e5dc', null, 'flight', { on: 'fin', skip: ['top'] }),
        food(C([-9, 20.5, -5], 'y', 1.6, 12, '#4caf50', null, null, { seg: 14 })),
        food(B([-3, 2, 14.5, 22, -8, -3], '#f6f6f2')),
        food(C([7, 3.8, 0], 'y', 2.1, 3.6, '#d9483b', null, null, { seg: 14 })),
        food(B([3, 10, 27.5, 30, -7, 0], '#f2c94c')),
        food(B([-8, 4, 42, 44, -9, 6], '#bde3f5')),
        /* the doors */
        B([-15, 15, 2, 40, 14, 16], '#e4e8ec', 'door', 'fdoor', { id: 'fd', bias: 5 }),
        B([11, 12.5, 24, 36, 16, 18.2], '#b9c0c8', 'handle', 'fdoor', { on: 'fd', layer: 2 }),
        B([-15, 15, 42, 59, 14, 16], '#e4e8ec', 'freezer', 'zdoor', { id: 'zd', bias: 5 }),
        B([11, 12.5, 45, 55, 16, 18.2], '#b9c0c8', 'handle2', 'zdoor', { on: 'zd', layer: 2 }),
        B([-10.5, -2.5, 52, 55.6, 16, 16.12], '#102830', 'screen', 'fscrg', { id: 'fscr', on: 'zd', layer: 2 })
      ],
      motions: {
        fdoor: { do: [{ g: 'fdoor', rot: { ax: 'y', pivot: [-15, 0, 14], deg: -100 } }], dur: 900 },
        zdoor: { do: [{ g: 'zdoor', rot: { ax: 'y', pivot: [-15, 0, 14], deg: -100 } }], dur: 900 }
      },
      lights: [
        { g: 'flight', col: [255, 248, 210], glow: [0, 38.6, 1.5], glowR: 8, glowBias: 6, when: function (sc) { return sc.val.fdoor > 0.15 && sc.plugged(); }, fadeIn: 150, fadeOut: 300 },
        { g: 'fscrg', col: [22, 70, 84], when: plugged, fadeIn: 300, fadeOut: 500 }
      ],
      displays: [{ id: 'fdisp', g: 'fscrg', on: 'fscr', part: 'screen', at: [-6.5, 53.8, 16.12], h: 2.2, text: '-18°', col: '#7fe0ff', bg: '#102830', kind: 'temp', when: plugged }],
      parts: {
        door: { name: 'door', can: [{ v: 'open', m: 'fdoor', to: 1 }, { v: 'close', m: 'fdoor', to: 0 }], zoom: 1.1 },
        freezer: { name: 'freezer door', can: [{ v: 'open', m: 'zdoor', to: 1 }, { v: 'close', m: 'zdoor', to: 0 }], zoom: 1.4, view: { pitch: 18 } },
        handle: { name: 'handle', can: [{ v: 'pull', m: 'fdoor', to: 'toggle' }], zoom: 2, view: { yaw: -20 } },
        handle2: { name: 'handle', can: [{ v: 'pull', m: 'zdoor', to: 'toggle' }], zoom: 2, view: { yaw: -20 } },
        screen: { name: 'screen', can: [{ v: 'read', fx: 'read', d: 'fdisp' }], zoom: 3, view: { yaw: -10, pitch: 8 } },
        shelf: { name: 'shelf', can: [{ v: 'put food on' }], zoom: 1.5, view: { yaw: -20, pitch: 20 }, pose: { fdoor: 1 } },
        shelf2: { name: 'shelf', can: [{ v: 'put food on' }], zoom: 1.5, view: { yaw: -20, pitch: 20 }, pose: { fdoor: 1 } }
      }
    });
    withPower(m, powered([[10, 3, -14], [10, 1.2, -19], [2, 1.5, -23]], -4, -23));
  })();

  global.House3D = { viewer: viewer, define: define, models: MODELS, mount: mountMini, scan: scan };
})(window);

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
  function boxFaces(e) {
    var x0 = e[0], x1 = e[1], y0 = e[2], y1 = e[3], z0 = e[4], z1 = e[5], c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    return [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]
    ].map(function (f) { return orient(f, c); });
  }
  function cylFaces(c, axis, r, len, r2, seg) {
    seg = seg || 20; r2 = r2 == null ? r : r2;
    var map = { x: function (a, b, h) { return [c[0] + h, c[1] + a, c[2] + b]; }, y: function (a, b, h) { return [c[0] + a, c[1] + h, c[2] + b]; }, z: function (a, b, h) { return [c[0] + a, c[1] + b, c[2] + h]; } }[axis];
    var lo = [], hi = [], faces = [];
    for (var i = 0; i < seg; i++) {
      var t = i / seg * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
      lo.push(map(r * ca, r * sa, -len / 2)); hi.push(map(r2 * ca, r2 * sa, len / 2));
    }
    for (i = 0; i < seg; i++) { var j = (i + 1) % seg; faces.push(orient([lo[i], lo[j], hi[j], hi[i]], c)); }
    faces.push(orient(lo, c)); faces.push(orient(hi, c));
    return faces;
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
      return 1e9;
    };
    var big = Math.max.apply(null, model.shapes.map(function (s) { return s.t === 'tube' ? 0 : ext(s); }));
    model.shapes.forEach(function (s, si) {
      var fs = s.t === 'box' ? boxFaces(s.e) : s.t === 'cyl' ? cylFaces(s.c, s.ax, s.r, s.len, s.r2, s.seg)
        : s.t === 'top' ? [[[s.e[0], s.e[2], s.e[3]], [s.e[0], s.e[2], s.e[4]], [s.e[1], s.e[2], s.e[4]], [s.e[1], s.e[2], s.e[3]]]].map(function (f) { return orient(f, [0, -1e6, 0]); })
        : s.t === 'tube' ? null : [];
      if (s.t === 'tube') { faces.push({ tube: s, shape: si }); return; }
      fs.forEach(function (f) { faces.push({ pts: f, col: rgb(s.col), part: s.part || null, group: s.group || s.part || null, id: s.id || null, on: s.on || null, layer: s.layer || 1, bias: (s.bias || 0) + (ext(s) < big * 0.3 ? 2.5 : 0), clipY: s.clipY, shape: si }); });
    });
    model._faces = faces;
    /* bounds: the middle and the size the camera fits */
    var all = [];
    faces.forEach(function (f) { (f.pts || f.tube.pts).forEach(function (p) { all.push(p); }); });
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    all.forEach(function (p) { for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } });
    model._center = mul(add(lo, hi), 0.5);
    /* the machine itself, without its power cord, plug and socket: what the camera looks at */
    var POWER = { cord: 1, plug: 1, socket: 1 }, clo = [1e9, 1e9, 1e9], chi = [-1e9, -1e9, -1e9];
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
  }
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
    var par = m.groups && m.groups[g] && m.groups[g].parent;
    return par ? out.concat(this.ops(par)) : out;
  };
  Scene.prototype.place = function (p, ops) {
    for (var i = 0; i < ops.length; i++) p = ops[i].rot ? rotate(p, ops[i].rot.ax, ops[i].deg, ops[i].rot.pivot) : add(p, ops[i].move);
    return p;
  };
  Scene.prototype.lit = function (g) {
    var m = this.m, self = this, on = false;
    Object.keys(m.motions || {}).forEach(function (k) { if (m.motions[k].light === g && self.val[k] > 0.5) on = true; });
    return on;
  };
  Scene.prototype.world = function () {
    /* every face where it is now */
    var self = this, cache = {}, out = [];
    var opsOf = function (g) { if (!g) return []; if (!cache[g]) cache[g] = self.ops(g); return cache[g]; };
    this.m._faces.forEach(function (f) {
      if (f.tube) {
        var t = f.tube, pts = t.pts.slice();
        if (t.endGroup) pts[pts.length - 1] = self.place(pts[pts.length - 1], opsOf(t.endGroup));
        tubeFaces(pts, t.r).forEach(function (q) { out.push({ pts: q, col: rgb(t.col), part: t.part || null, bias: 0 }); });
        return;
      }
      var ops = opsOf(f.group), pts = ops.length ? f.pts.map(function (p) { return self.place(p, ops); }) : f.pts;
      if (f.clipY != null) pts = pts.map(function (p) { return p[1] < f.clipY ? [p[0], f.clipY, p[2]] : p; });
      out.push({ pts: pts, col: f.group && self.lit(f.group) ? [255, 214, 90] : f.col, glow: f.group && self.lit(f.group), part: f.part, bias: f.bias, id: f.id, on: f.on, layer: f.layer });
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
    if (act.fx) { this.fx.push({ act: act, t0: now, dur: act.fx === 'swipe' ? 900 : 750 }); return; }
    var k = act.m, mo = this.m.motions[k];
    if (!mo) return;
    var v = this.value(k, now), dur = mo.dur || 650, to = act.to;
    if (to === 'toggle') to = v > 0.5 ? 0 : 1;
    if (to === 'step') to = Math.round(v) + 1;
    if (to === 'bounce') {
      var times = act.times || 1, seq = [];
      for (var i = 0; i < times; i++) seq.push(1, 0);
      this.anim[k] = { from: v, to: seq.shift(), t0: now, dur: dur, next: seq };
      return;
    }
    this.anim[k] = { from: v, to: to, t0: now, dur: dur * Math.max(0.4, Math.abs(to - v)), next: [] };
  };
  Scene.prototype.value = function (k) { return this.val[k]; };
  /* → true while something is still moving */
  Scene.prototype.tick = function (now) {
    var busy = false, self = this;
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
    return busy || this.fx.length > 0;
  };
  Scene.prototype.busy = function () { return Object.keys(this.anim).length > 0 || this.fx.length > 0; };

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
  function drawFaces(scene, cam, mark) {
    var D = cam.D(), eye = [0, 0, D], acc = accent(), list = [];
    scene.world().forEach(function (f) {
      var cp = f.pts.map(function (p) { return cam.toCam(p); });
      var n = norm(cross(sub(cp[1], cp[0]), sub(cp[2], cp[0])));
      var mid = mean(cp);
      if (dot(n, sub(eye, mid)) <= 0) return;
      var light = f.glow ? 1.08 : 0.5 + 0.55 * Math.max(0, dot(n, LIGHT)) + 0.08 * Math.max(0, n[2]);
      var col = mul(f.col, light);
      var on = mark && f.part === mark;
      if (on) col = mix(col, acc, 0.38);
      list.push({ id: f.id, on: f.on, layer: f.layer, n: n, z: mid[2] + f.bias, d: 'M' + cp.map(function (c) { var s = cam.toScreen(c); return f1(s[0]) + ',' + f1(s[1]); }).join('L') + 'Z', fill: css(col), stroke: on ? 'var(--text-accent,#185fa5)' : css(mul(col, 0.8)), sw: on ? 1.4 : 0.6, part: f.part });
    });
    /* a thing lying on a surface ("on") is drawn just after that surface's face that looks the same way */
    var settle = function (x, depth) {
      if (!x.on || x.done || depth > 6) return;
      var best = null;
      list.forEach(function (y) { if (y.id === x.on && y !== x && dot(y.n, x.n) > 0.9 && (!best || y.z > best.z)) best = y; });
      if (best) { settle(best, depth + 1); x.z = best.z + 0.01 * (x.layer || 1); }
      x.done = true;
    };
    list.forEach(function (x) { settle(x, 0); });
    list.sort(function (a, b) { return a.z - b.z; });
    return list.map(function (x) {
      return '<path d="' + x.d + '" fill="' + x.fill + '" stroke="' + x.stroke + '" stroke-width="' + x.sw + '" stroke-linejoin="round"' + (x.part ? ' data-part="' + x.part + '"' : '') + '/>';
    }).join('');
  }
  /* light from a lamp, finger taps and swipes */
  function drawFx(scene, cam, now) {
    var out = '', m = scene.m;
    Object.keys(m.motions || {}).forEach(function (k) {
      var mo = m.motions[k];
      if (!mo.glow || scene.val[k] < 0.5) return;
      var c = cam.project(scene.groupPoint(mo.glow, mo.light)), r = 9 * cam.scale();
      out += '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '" fill="url(#h3dGlow)" pointer-events="none"/>';
    });
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
  var DEFS = '<defs><radialGradient id="h3dGlow"><stop offset="0" stop-color="#ffe27a" stop-opacity=".85"/><stop offset=".45" stop-color="#ffd24a" stop-opacity=".35"/><stop offset="1" stop-color="#ffd24a" stop-opacity="0"/></radialGradient></defs>';

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
      partsRow.innerHTML = '<span class="h3d-parts-label">Parts</span>' + Object.keys(scene.m.parts).map(function (p) {
        return '<button type="button" class="h3d-part" data-part="' + p + '" aria-pressed="false">' + scene.m.parts[p].name + '</button>';
      }).join('');
      draw();
    }
    function current() { return pinned || hover; }
    function draw() {
      var s = size(); cam.w = s[0]; cam.h = s[1];
      svg.setAttribute('viewBox', '0 0 ' + f1(s[0]) + ' ' + f1(s[1]));
      var now = performance.now(), mark = current();
      svg.innerHTML = DEFS + '<g>' + drawFaces(scene, cam, mark) + '</g><g>' + drawFx(scene, cam, now) + '</g>' + leader(mark);
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
          var moves = a.m || a.fx;
          return '<li><button type="button" class="h3d-act' + (moves ? '' : ' h3d-still') + '" data-i="' + i + '">' + (moves ? '▶ ' : '– ') + a.v + '</button></li>';
        }).join('') + '</ul>';
    }
    label.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('h3d-close')) { pinned = null; hover = null; draw(); return; }
      var id = labelFor, a = actionsOf(scene.m, id)[+b.dataset.i];
      if (a && (a.m || a.fx)) { scene.play(a); kick(); }
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
    } };
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
    if (el.dataset.height) el.style.setProperty('--h3d-h', el.dataset.height + 'px');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', act ? 'an animation' : 'a picture');
    el.setAttribute('data-dict', 'off');
    var mini = { el: el, sc: sc, part: part, act: act, visible: true, t0: performance.now(), phase: -1, mark: el.dataset.mark !== 'off' ? part : null };
    var p = model.parts[part] || {};
    mini.view = p.view || model.view || {};
    if (act && act.m && act.to === 0) sc.val[act.m] = 1;   /* "close", "unplug": start from the other state */
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
    mini.el.innerHTML = '<svg viewBox="0 0 ' + f1(w) + ' ' + f1(h) + '" aria-hidden="true">' + DEFS + drawFaces(sc, cam, mini.mark) + drawFx(sc, cam, now) + '</svg>';
  }
  /* one loop for every playing picture: play, rest, play back, rest */
  function cycle(mini, now) {
    var a = mini.act, sc = mini.sc;
    if (!a) return;
    var period = a.fx ? 1900 : (a.to === 'bounce' ? 1500 + (a.times || 1) * 400 : 3200);
    var t = (now - mini.t0) % period, phase = a.fx || a.to === 'bounce' ? (t < 200 ? 0 : 1) : (t < period / 2 ? 0 : 1);
    if (phase !== mini.phase) {
      mini.phase = phase;
      if (a.fx) { if (phase === 1) sc.play(a, now); }
      else if (a.to === 'bounce') { if (phase === 1) sc.play(a, now); }
      else {
        var mo = sc.m.motions[a.m], base = mo.start || 0;
        var other = a.to === 0 ? 1 : a.to === 1 ? 0 : null;
        if (other != null) sc.play({ m: a.m, to: phase === 0 ? a.to : other }, now);       /* open ⇄ close, starting with this action */
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
       box  { t:'box', e:[x0,x1, y0,y1, z0,z1], col, part, group }
       cyl  { t:'cyl', c:[x,y,z], ax:'x'|'y'|'z', r, len, r2 (the +end's radius: a cone), col, part, group }
       top  { t:'top', e:[x0,x1, y, z0,z1] }      a flat face looking up (keys)
       tube { t:'tube', pts:[[x,y,z]…], r, col, part, endGroup }   a cord; its last point moves with endGroup
     bias pushes a face forward when sorting (things lying on a surface).
     clipY: nothing of that shape is drawn below this height (bread in a toaster).
     groups: { lid:{ parent:'kettle' } }   — a group moves with its parent.
     motions: { door:{ do:[{ g:'door', rot:{ ax:'y', pivot:[…], deg:-100 } }, { g:'x', move:[…] }], dur, start, light:'group', glow:[x,y,z] } }
       the value 0 → 1 runs the moves (a knob's value can keep growing: it keeps turning)
     parts: { lid:{ name:'lid', can:[{ v:'open', m:'lid', to:1 }, { v:'close', m:'lid', to:0 }] } }
       to: 1 · 0 · 'toggle' · 'bounce' (there and back; times:3) · 'step' (one more turn)
       { v:'tap', fx:'tap', at:[x,y,z], g:'lid' } · { v:'swipe', fx:'swipe', from:[…], to:[…], g:'lid' }
       { v:'read it' } — something you can do that the model doesn't play
       view: { yaw, pitch, zoom, focus } for the zoomed pictures of that part */
  var MODELS = {};
  function define(id, m) { m.id = id; MODELS[id] = m; return m; }

  var B = function (e, col, part, group, more) { return Object.assign({ t: 'box', e: e, col: col, part: part, group: group }, more || {}); };
  var C = function (c, ax, r, len, col, part, group, more) { return Object.assign({ t: 'cyl', c: c, ax: ax, r: r, len: len, col: col, part: part, group: group }, more || {}); };
  var PLUG = '#2b2b2b', PIN = '#c9a25a', CORD = '#333333';
  /* a power cord from `pts` to a plug at (px, pz) on the floor, and a socket box beside it */
  function powered(pts, px, pz) {
    var last = [px, 1.5, pz];
    return {
      shapes: [
        { t: 'tube', pts: pts.concat([last]), r: 0.55, col: CORD, part: 'cord', endGroup: 'plug' },
        B([px - 6, px, 0, 3, pz - 1.6, pz + 1.6], PLUG, 'plug', 'plug'),
        B([px - 9, px - 6, 1.1, 1.6, pz - 1.0, pz - 0.6], PIN, 'plug', 'plug'),
        B([px - 9, px - 6, 1.1, 1.6, pz + 0.6, pz + 1.0], PIN, 'plug', 'plug'),
        B([px - 23, px - 15, 0, 5.5, pz - 4.5, pz + 4.5], '#f1f1ee', 'socket'),
        B([px - 15, px - 14.85, 1.0, 1.7, pz - 1.1, pz - 0.5], '#3a3a3a', 'socket', null, { bias: 0.3 }),
        B([px - 15, px - 14.85, 1.0, 1.7, pz + 0.5, pz + 1.1], '#3a3a3a', 'socket', null, { bias: 0.3 })
      ],
      motion: { do: [{ g: 'plug', move: [-7.5, 0, 0] }], dur: 700 },
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

  /* ── microwave ── */
  withPower(define('microwave', {
    name: 'microwave', view: { yaw: -28, pitch: 16 },
    shapes: [
      B([-25, 25, 0, 30, -18, 18], '#dfe3e8', null, null, { id: 'mbody' }),
      B([9, 25, 2, 28, 18, 18.6], '#c5cbd2'),
      B([-23, 8, 3, 27, 18, 18.05], '#2a2f36', null, null, { on: 'mbody' }),
      B([-24, 9, 2, 28, 18, 19.2], '#46505c', 'door', 'door', { id: 'mdoor', on: 'mbody', layer: 2 }),
      B([-21, 4, 5, 25, 19.2, 19.45], '#1b222a', 'door', 'door', { on: 'mdoor' }),
      B([5, 7.4, 8, 22, 19.2, 22.2], '#a2abb5', 'handle', 'door', { on: 'mdoor', layer: 2 }),
      B([11, 23, 21.5, 26, 18.6, 18.9], '#173b2a', null, null, { bias: 0.3 }),
      B([11.5, 16, 17, 19.5, 18.6, 19.4], '#f4f6f8', 'button', 'mbtn'), B([18, 22.5, 17, 19.5, 18.6, 19.4], '#f4f6f8', 'button', 'mbtn'),
      B([11.5, 16, 13.5, 16, 18.6, 19.4], '#f4f6f8', 'button', 'mbtn'), B([18, 22.5, 13.5, 16, 18.6, 19.4], '#f4f6f8', 'button', 'mbtn'),
      C([17, 6.5, 19.5], 'z', 3, 1.8, '#79848f', 'knob', 'mknob'),
      B([16.6, 17.4, 7.2, 9.2, 20.35, 20.6], '#f2f4f6', 'knob', 'mknob', { bias: 0.4 })
    ],
    motions: {
      door: { do: [{ g: 'door', rot: { ax: 'y', pivot: [-24, 0, 19.2], deg: -95 } }], dur: 800 },
      mbtn: { do: [{ g: 'mbtn', move: [0, 0, -0.6] }], dur: 160 },
      mknob: { do: [{ g: 'mknob', rot: { ax: 'z', pivot: [17, 6.5, 19.5], deg: -90 } }], dur: 600 }
    },
    parts: {
      door: { name: 'door', can: [{ v: 'open', m: 'door', to: 1 }, { v: 'close', m: 'door', to: 0 }], zoom: 1.3 },
      handle: { name: 'handle', can: [{ v: 'pull', m: 'door', to: 'toggle' }], zoom: 1.6, view: { yaw: -10 } },
      button: { name: 'button', can: [{ v: 'press', m: 'mbtn', to: 'bounce' }, { v: 'push', m: 'mbtn', to: 'bounce' }], zoom: 2.4, view: { yaw: -10 } },
      knob: { name: 'knob', can: [{ v: 'turn', m: 'mknob', to: 'step' }], zoom: 2.6, view: { yaw: -10, pitch: 8 } }
    }
  }), powered([[20, 4, -18], [20, 1.2, -25], [10, 1.5, -30]], 2, -30));

  /* ── toaster ── */
  withPower(define('toaster', {
    name: 'toaster', view: { yaw: -32, pitch: 20 },
    shapes: [
      B([-14, 14, 0, 18, -8, 8], '#c94c3c'),
      B([-11, 11, 18, 18.12, -4.6, -2.0], '#1e1e1e', 'slot', null, { bias: 0.4 }), B([-11, 11, 18, 18.12, 2.0, 4.6], '#1e1e1e', 'slot', null, { bias: 0.4 }),
      B([-9, 9, 10.5, 21.5, -4.0, -2.6], '#e2b06b', null, 'bread', { clipY: 18.14 }), B([-9, 9, 10.5, 21.5, 2.6, 4.0], '#e2b06b', null, 'bread', { clipY: 18.14 }),
      B([14, 14.2, 4, 15.5, -0.6, 0.6], '#5a201a', null, null, { bias: 0.3 }),
      B([14, 17.5, 12.5, 14.5, -1.4, 1.4], '#2b2b2b', 'lever', 'lever'), B([17.5, 19, 12, 15, -2, 2], '#2b2b2b', 'lever', 'lever'),
      C([7, 6, 8.9], 'z', 2.3, 1.8, '#2b2b2b', 'knob', 'tknob'),
      B([6.7, 7.3, 6.6, 8.0, 9.8, 10.0], '#eeeeee', 'knob', 'tknob', { bias: 0.4 }),
      B([-11, -6, 4.5, 7, 8, 8.8], '#f2f2f2', 'button', 'tbtn')
    ],
    motions: {
      lever: { do: [{ g: 'lever', move: [0, -8, 0] }, { g: 'bread', move: [0, -3.6, 0] }], dur: 700 },
      tknob: { do: [{ g: 'tknob', rot: { ax: 'z', pivot: [7, 6, 8.9], deg: -90 } }], dur: 600 },
      tbtn: { do: [{ g: 'tbtn', move: [0, 0, -0.6] }], dur: 160 }
    },
    parts: {
      slot: { name: 'slot', can: [{ v: 'put the bread in' }], zoom: 1.8, view: { pitch: 45 } },
      lever: { name: 'lever', can: [{ v: 'push down', m: 'lever', to: 'toggle' }], zoom: 2, view: { yaw: -55 } },
      knob: { name: 'knob', can: [{ v: 'turn', m: 'tknob', to: 'step' }], zoom: 2.6, view: { yaw: -15, pitch: 10 } },
      button: { name: 'button', can: [{ v: 'press', m: 'tbtn', to: 'bounce' }], zoom: 2.6, view: { yaw: -15, pitch: 10 } }
    }
  }), powered([[-10, 3, -8], [-10, 1.2, -14], [0, 1.5, -20]], 6, -20));

  /* ── electric kettle ── */
  withPower(define('kettle', {
    name: 'kettle', view: { yaw: -62, pitch: 14 },
    groups: { lid: { parent: 'kettle' }, ksw: { parent: 'kettle' } },
    shapes: [
      C([0, 1, 0], 'y', 9.5, 2, '#2b2b2b'),
      C([0, 12.5, 0], 'y', 8, 19, '#cfd6dc', null, 'kettle', { r2: 6.6 }),
      C([0, 19, 9], 'z', 2.4, 4.5, '#cfd6dc', 'spout', 'kettle', { r2: 1.3, seg: 14 }),
      C([0, 22.5, 0], 'y', 6.5, 1, '#a9b2bb', 'lid', 'lid'),
      C([0, 23.6, 0], 'y', 1.6, 1.2, '#2b2b2b', 'lid', 'lid', { seg: 12 }),
      B([-1.3, 1.3, 6, 20, -12.2, -10.4], '#2b2b2b', 'handle', 'kettle'),
      B([-1.3, 1.3, 18.2, 20, -10.4, -6.2], '#2b2b2b', 'handle', 'kettle'),
      B([-1.3, 1.3, 6, 7.8, -10.4, -7.4], '#2b2b2b', 'handle', 'kettle'),
      B([-1, 1, 3.9, 6, -12, -10.2], '#ff8a1e', 'switch', 'ksw')
    ],
    motions: {
      lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 23, -6.5], deg: -95 } }], dur: 700 },
      ksw: { do: [{ g: 'ksw', rot: { ax: 'x', pivot: [0, 6, -11.1], deg: -22 } }], dur: 260, light: 'ksw' },
      lift: { do: [{ g: 'kettle', move: [0, 7, 0] }], dur: 700 },
      pour: { do: [{ g: 'kettle', move: [0, 6, 0] }, { g: 'kettle', rot: { ax: 'x', pivot: [0, 3, 8], deg: 38 } }], dur: 800 }
    },
    parts: {
      lid: { name: 'lid', can: [{ v: 'open', m: 'lid', to: 1 }, { v: 'close', m: 'lid', to: 0 }, { v: 'lift', m: 'lid', to: 'toggle' }], zoom: 1.8, view: { pitch: 30 } },
      handle: { name: 'handle', can: [{ v: 'hold', m: 'lift', to: 'toggle' }, { v: 'pick up', m: 'lift', to: 'toggle' }], zoom: 1.5, view: { yaw: -110 } },
      switch: { name: 'switch', can: [{ v: 'switch on', m: 'ksw', to: 1 }, { v: 'switch off', m: 'ksw', to: 0 }], zoom: 2.4, view: { yaw: -140, pitch: 10 } },
      spout: { name: 'spout', can: [{ v: 'pour', m: 'pour', to: 'bounce' }], zoom: 1.4, view: { yaw: -70, pitch: 8 } }
    }
  }), powered([[-6, 1.2, -8], [-8, 1.2, -14], [0, 1.5, -20]], 6, -20));

  /* ── laptop ── */
  (function () {
    var keys = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 11; c++) {
      var x = -13 + c * 2.4, z = -9 + r * 2.3;
      keys.push({ t: 'top', e: [x + 0.2, x + 2.1, 1.75, z + 0.2, z + 2.0], col: '#4b525b', part: 'keyboard', group: 'keys', on: 'kbd' });
    }
    withPower(define('laptop', {
      name: 'laptop', view: { yaw: -22, pitch: 26 },
      shapes: [
        B([-16, 16, 0, 1.4, -11, 11], '#c3c8cf', null, null, { id: 'base' }),
        B([-14, 14, 1.4, 1.6, -9.6, 0.4], '#2d3238', 'keyboard', null, { id: 'kbd', on: 'base' })
      ].concat(keys).concat([
        B([-5.5, 5.5, 1.4, 1.52, 2.5, 9], '#a7aeb6', 'touchpad', null, { on: 'base' }),
        B([11.5, 14, 1.4, 1.8, -10.7, -10], '#eceff2', 'button', 'pbtn'),
        B([-16, 16, 1.4, 22, -11, -10.2], '#3b4048', 'lid', 'lid', { id: 'bezel', bias: 1.5 }),
        B([-14.5, 14.5, 3, 20.5, -10.2, -10.02], '#1f3a5f', 'screen', 'lid', { on: 'bezel' })
      ]),
      motions: {
        lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 1.4, -11], deg: 88 } }], dur: 900 },
        keys: { do: [{ g: 'keys', move: [0, -0.25, 0] }], dur: 120 },
        pbtn: { do: [{ g: 'pbtn', move: [0, -0.3, 0] }], dur: 160 }
      },
      parts: {
        screen: { name: 'screen', can: [{ v: 'tap', fx: 'tap', at: [2, 12, -10], g: 'lid' }, { v: 'swipe', fx: 'swipe', from: [-8, 12, -10], to: [8, 12, -10], g: 'lid' }], zoom: 2.5, view: { yaw: -8, pitch: 10 } },
        keyboard: { name: 'keyboard', can: [{ v: 'type', m: 'keys', to: 'bounce', times: 3 }, { v: 'press the keys', m: 'keys', to: 'bounce' }], zoom: 2.6, view: { pitch: 50 } },
        touchpad: { name: 'touchpad', can: [{ v: 'tap', fx: 'tap', at: [0, 1.55, 5.7] }, { v: 'swipe', fx: 'swipe', from: [-4, 1.55, 5.7], to: [4, 1.55, 5.7] }], zoom: 3.2, view: { pitch: 55 } },
        button: { name: 'button', can: [{ v: 'press', m: 'pbtn', to: 'bounce' }], zoom: 3.8, view: { pitch: 45, yaw: -10 } },
        lid: { name: 'lid', can: [{ v: 'close', m: 'lid', to: 1 }, { v: 'open', m: 'lid', to: 0 }], zoom: 2 }
      }
    }), powered([[-16, 0.7, 0], [-20, 0.9, 0], [-23, 1.2, -9]], -26, -14));
  })();

  /* ── washing machine (top loader) ── */
  withPower(define('washer', {
    name: 'washing machine', view: { yaw: -32, pitch: 22, zoom: 0.84 },
    shapes: [
      B([-15, 15, 0, 36, -15, 15], '#eef1f4'),
      B([-12.5, 12.5, 36.15, 36.9, -9, 11.5], '#cfd6de', 'lid', 'lid'),
      B([-4, 4, 36.9, 37.6, 8.8, 10.4], '#8d97a3', 'handle', 'lid'),
      B([-15, 15, 36, 44, -15, -11.5], '#dde2e8', null, null, { id: 'wpanel' }),
      C([-9, 40, -11.0], 'z', 2.6, 1.2, '#7c8794', 'knob', 'wknob', { on: 'wpanel' }),
      B([-9.35, -8.65, 41, 42.4, -10.4, -10.2], '#f2f4f6', 'knob', 'wknob', { on: 'wpanel', layer: 2 }),
      B([-3.5, 4.5, 38.5, 42.5, -11.5, -11.25], '#174a36', 'screen', null, { on: 'wpanel' }),
      B([7, 10, 39, 41.5, -11.5, -10.9], '#fafafa', 'button', 'wbtn', { on: 'wpanel' }), B([11, 14, 39, 41.5, -11.5, -10.9], '#fafafa', 'button', 'wbtn', { on: 'wpanel' })
    ],
    motions: {
      lid: { do: [{ g: 'lid', rot: { ax: 'x', pivot: [0, 36.9, -9], deg: -92 } }], dur: 900 },
      wknob: { do: [{ g: 'wknob', rot: { ax: 'z', pivot: [-9, 40, -11], deg: -90 } }], dur: 600 },
      wbtn: { do: [{ g: 'wbtn', move: [0, 0, -0.45] }], dur: 160 }
    },
    parts: {
      lid: { name: 'lid', can: [{ v: 'open', m: 'lid', to: 1 }, { v: 'close', m: 'lid', to: 0 }], zoom: 1.4, view: { pitch: 35 } },
      handle: { name: 'handle', can: [{ v: 'lift', m: 'lid', to: 'toggle' }, { v: 'pull', m: 'lid', to: 'toggle' }], zoom: 1.8, view: { pitch: 35 } },
      knob: { name: 'knob', can: [{ v: 'turn', m: 'wknob', to: 'step' }], zoom: 2.4, view: { yaw: -10, pitch: 12 } },
      screen: { name: 'screen', can: [{ v: 'tap', fx: 'tap', at: [0.5, 40.5, -11.2] }, { v: 'read' }], zoom: 2.4, view: { yaw: -10, pitch: 12 } },
      button: { name: 'button', can: [{ v: 'press', m: 'wbtn', to: 'bounce' }], zoom: 2.4, view: { yaw: -15, pitch: 12 } }
    }
  }), powered([[10, 4, -15], [10, 1.2, -22], [2, 1.5, -26]], -4, -26));

  /* ── desk lamp ── */
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
      lsw: { do: [{ g: 'lsw', rot: { ax: 'x', pivot: [3.75, 2.4, 3.3], deg: 18 } }], dur: 240, light: 'bulb', glow: [8, 21.8, 0] },
      shade: { do: [{ g: 'shade', rot: { ax: 'z', pivot: [7, 27, -1], deg: 22 } }], dur: 700 },
      bulb: { do: [{ g: 'bulb', move: [0, -3, 0] }], dur: 500 }
    },
    parts: {
      switch: { name: 'switch', can: [{ v: 'switch on', m: 'lsw', to: 1 }, { v: 'switch off', m: 'lsw', to: 0 }], zoom: 2.8, view: { pitch: 40, yaw: -10 } },
      shade: { name: 'shade', can: [{ v: 'move', m: 'shade', to: 'toggle' }], zoom: 1.6 },
      bulb: { name: 'light bulb', can: [{ v: 'change', m: 'bulb', to: 'bounce' }, { v: 'switch on', m: 'lsw', to: 1 }], zoom: 1.9, view: { pitch: -15 } }
    }
  }), powered([[0, 1, -7], [0, 1, -12], [-5, 1.5, -16]], -9, -16));

  global.House3D = { viewer: viewer, define: define, models: MODELS, mount: mountMini, scan: scan };
})(window);

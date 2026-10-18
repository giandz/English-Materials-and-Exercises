/* ══════════════════════════════════════════════════════════════════════════
   deduction-house.js — the García family's house, for the lessons on
   deduction (must / might / could / can't) and adverbs of certainty
   (definitely, probably, maybe, perhaps …).

   Load it after house-engine.js, house-character.js and house-character-3d.js.

     DeductionHouse.scene(room, [{ who, act, pct }], opts)  → '<svg>…</svg>'
         one room on its own, with people doing things in it
     DeductionHouse.house([{ who, act, pct }], opts)        → '<svg>…</svg>'
         the whole house and backyard
     DeductionHouse.bubble(panels, opts)                    → '<div class="dh-think">…</div>'
         a thought bubble: one picture per guess, each with how sure the
         speaker is. panels: [{ who, act, pct, cap? }]
     DeductionHouse.meter()                                 → the certainty scale

   pct is how sure the speaker is (0–100). It is shown as a percentage and is
   also how solid the person is drawn: 100 % is a person, 30 % a faint ghost,
   0 % only a trace (they can't be there).

   who  julia (Mom) · juan (Dad) · rosa (Grandma) · lucas (the little brother)
   act  cooking · swimming · garden · tv · reading · napping · shower ·
        working · gaming · kitchen · living · bedroom · bathroom · study
        (the last five: just standing in that room)
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const HC = global.HouseCharacter, H3 = global.HouseCharacter3D;

  /* ── the rooms ──────────────────────────────────────────────────────────
     at: [x, y, w, h] of the room in the house (metres from the back-left corner).
     Everything inside a room is written in the room's own metres. Openings are
     [o, r, c, type] on the room's own grid. */
  const ROOMS = {
    kitchen: { at: [0, 0, 3, 3], floor: 'tile', emoji: '🍳', word: 'the kitchen',
      openings: [['v', 1, 0, 'window'], ['v', 1, 3, 'door'], ['h', 3, 1, 'door']],
      furniture: [
        { type: 'countertop', edge: { o: 'h', r: 0, c: 0 }, side: 'p', insets: [0, 0], items: [{ type: 'microwave', level: 0, slot: 'C', dir: 2 }] },
        { type: 'countertop', edge: { o: 'h', r: 2, c: 0 }, side: 'm', insets: [0, 0], items: [{ type: 'sink', level: 0, slot: 'C', dir: 0 }] },
        { type: 'countertop', edge: { o: 'h', r: 2, c: 1 }, side: 'm', insets: [0, 0], items: [{ type: 'stove', level: 0, slot: 'C', dir: 0 }] }],
      appliances: [{ type: 'fridge', x: 2.5, y: 0.5, dir: 2 }] },
    living: { at: [3, 0, 3, 3], emoji: '🛋️', word: 'the living room',
      openings: [['v', 1, 0, 'door'], ['v', 1, 3, 'door'], ['h', 3, 1, 'door']],
      furniture: [
        { type: 'couch', x: 1.5, y: 0.5, dir: 2 },
        { type: 'tvstand', x: 1.5, y: 2.5, dir: 0, items: [{ type: 'tv', level: 1, slot: 'C', dir: 0 }] }],
      appliances: [{ type: 'rug', x: 1.5, y: 1.5, dir: 0 }] },
    bedroom: { at: [6, 0, 3, 3], floor: 'carpet', emoji: '🛏️', word: 'the bedroom',
      openings: [['v', 1, 0, 'door'], ['v', 1, 3, 'window']],
      furniture: [
        { type: 'bed', x: 1.5, y: 1.5, dir: 2 },
        { type: 'nightstand', x: 0.5, y: 0.5, dir: 2, items: [{ type: 'lamp', level: 0, slot: 'C', dir: 0 }] }],
      appliances: [] },
    bathroom: { at: [0, 3, 3, 2], floor: 'tile', emoji: '🚿', word: 'the bathroom',
      openings: [['h', 0, 1, 'door'], ['v', 1, 0, 'window']],
      furniture: [
        { type: 'shower', edge: { o: 'h', r: 0, c: 0 }, side: 'p', items: [] },
        { type: 'washbasin', x: 2.5, y: 0.5, dir: 2 },
        { type: 'bathtub', x: 1.5, y: 1.5, dir: 1 }],
      appliances: [] },
    study: { at: [0, 5, 3, 2], emoji: '💻', word: 'the study',
      openings: [['h', 0, 1, 'door'], ['h', 2, 1, 'door'], ['v', 1, 3, 'door']],
      furniture: [
        { type: 'officechair', x: 1.5, y: 0.5, dir: 2 },
        { type: 'table', x: 1.5, y: 1.5, dir: 0, items: [{ type: 'laptop', level: 0, slot: 'C', dir: 0 }] },
        { type: 'bookshelf', x: 0.5, y: 0.5, dir: 2 }],
      appliances: [] },
    garden: { at: [3, 3, 6, 4], garden: true, emoji: '🌳', word: 'the backyard',
      pools: [{ x0: 1, y0: 1, x1: 4, y1: 3 }],
      furniture: [{ type: 'chair', x: 5, y: 2, dir: 3 }],
      appliances: [{ type: 'planter', x: 0.5, y: 0.5, dir: 0 }, { type: 'planter', x: 5.5, y: 3.5, dir: 0 }] }
  };
  const COLS = 9, ROWS = 7;

  /* ── the family ───────────────────────────────────────────────────────── */
  const base = (o, outfit) => Object.assign(HC.defaults(), o, outfit);
  const CAST = {
    julia: { name: 'Julia', role: 'Mom', he: 'she', avatar: '👩',
      c: base({ name: 'Julia', bodyType: 'female', hairStyle: 'ponytail', hairColor: '3-0', skin: 3, height: 3, mouth: 'smile' },
        { upperGarment: 'tshirt', upperColor: '#CC0066', lowerGarment: 'jeans', lowerColor: '#336699', footwear: 'sneakers', footwearColor: '#FFFFFF' }) },
    juan: { name: 'Juan', role: 'Dad', he: 'he', avatar: '👨',
      c: base({ name: 'Juan', bodyType: 'male', hairStyle: 'short', hairColor: '1-0', skin: 4, height: 4, facialHair: 'stubble', mouth: 'smile' },
        { upperGarment: 'polo', upperColor: '#006666', lowerGarment: 'chinos', lowerColor: '#CCCC99', footwear: 'shoes', footwearColor: '#663300' }) },
    rosa: { name: 'Rosa', role: 'Grandma', he: 'she', avatar: '👵',
      c: base({ name: 'Rosa', bodyType: 'female', hairStyle: 'bun', hairColor: 'white', skin: 3, height: 2, eyewear: 'glasses', mouth: 'smile' },
        { upperGarment: 'blouse', upperColor: '#6666CC', lowerGarment: 'skirt', lowerColor: '#333333', footwear: 'shoes', footwearColor: '#000000' }) },
    lucas: { name: 'Lucas', role: 'little brother', he: 'he', avatar: '👦',
      c: base({ name: 'Lucas', bodyType: 'male', hairStyle: 'curly', hairColor: '4-0', skin: 3, height: 1, weight: 2, mouth: 'smile' },
        { upperGarment: 'hoodie', upperColor: '#FF6600', lowerGarment: 'trackpants', lowerColor: '#333333', footwear: 'sneakers', footwearColor: '#CC0000' }) }
  };
  const SWIM = { upperGarment: null, lowerGarment: 'swimshorts', footwear: null };
  const SWIM_F = { upperGarment: 'swimsuit', lowerGarment: null, footwear: null };

  /* ── what people can be doing ─────────────────────────────────────────
     room, where (room metres) or seat (index in the room's furniture), facing,
     pose (joints added to the standing pose), and what changes about them. */
  const STAND = { shoulderL: -8, elbowL: -5, shoulderR: 8, elbowR: 5, ankleL: -35, ankleR: 35 };
  const ACTS = {
    cooking:  { room: 'kitchen', x: 1.5, y: 1.05, facing: 'S', emoji: '🍳', ing: 'cooking',
                joints: { shoulderR: 15, elbowR: 30, shoulderL: -15, elbowL: 100 }, held: { left: 'spoon', right: 'pan' }, armOver: 'right' },
    kitchen:  { room: 'kitchen', x: 0.6, y: 1.05, facing: 'S', emoji: '🍳', ing: 'in the kitchen' },
    swimming: { room: 'garden', x: 2.5, y: 2.1, facing: 'S', swim: true, emoji: '🏊', ing: 'swimming',
                joints: { shoulderL: -62, elbowL: -10, shoulderR: 62, elbowR: 10 } },
    garden:   { room: 'garden', x: 4.6, y: 0.6, facing: 'S', emoji: '🌳', ing: 'in the backyard' },
    tv:       { room: 'living', seat: 0, place: 1, emoji: '📺', ing: 'watching TV', pose: 'chair' },
    reading:  { room: 'living', seat: 0, place: 0, emoji: '📖', ing: 'reading', pose: 'chair', held: { left: null, right: 'book' } },
    living:   { room: 'living', x: 2.5, y: 1.5, facing: 'S', emoji: '🛋️', ing: 'in the living room' },
    napping:  { room: 'bedroom', bed: 0, emoji: '😴', ing: 'sleeping' },
    bedroom:  { room: 'bedroom', x: 2.5, y: 2.6, facing: 'S', emoji: '🛏️', ing: 'in the bedroom' },
    shower:   { room: 'bathroom', x: 0.5, y: 0.6, facing: 'S', swimwear: true, emoji: '🚿', ing: 'taking a shower',
                joints: { shoulderL: -150, elbowL: -60, shoulderR: 150, elbowR: 60 }, eyes: 'closed' },
    bathroom: { room: 'bathroom', x: 0.5, y: 0.6, facing: 'S', emoji: '🚿', ing: 'in the bathroom' },
    working:  { room: 'study', seat: 0, emoji: '💻', ing: 'working', pose: 'chair' },
    gaming:   { room: 'study', seat: 0, emoji: '🎮', ing: 'playing games', pose: 'chair' },
    study:    { room: 'study', x: 2.5, y: 1.2, facing: 'S', emoji: '💻', ing: 'in the study' },
    leaving:  { room: 'study', x: 2.45, y: 1.5, facing: 'E', emoji: '🚪', ing: 'going out', pose: 'walking', doors: true },
    rushing:  { room: 'study', x: 2.45, y: 1.5, facing: 'E', emoji: '🏃', ing: 'leaving in a hurry', pose: 'running', doors: true }
  };

  function person(spec, local, rot) {
    const who = CAST[spec.who], a = ACTS[spec.act];
    if (!who || !a) return null;
    let d = JSON.parse(JSON.stringify(who.c));
    if (a.swim || a.swimwear) Object.assign(d, d.bodyType === 'female' ? SWIM_F : SWIM);
    d = HC.applyPose(d, a.pose || 'standing');
    if (a.joints) Object.assign(d.joints, a.joints);
    if (a.held) d.held = Object.assign({}, a.held);
    if (a.eyes) d.eyes = a.eyes;
    const R = ROOMS[a.room], [ox, oy] = local ? [0, 0] : R.at;
    const p = { character: d, tag: spec.tag != null ? spec.tag : '' };
    if (a.seat != null) { p.seat = a.seat + (local ? 0 : seatOffset(a.room)); p.place = a.place; }
    else if (a.bed != null) { p.bed = a.bed + (local ? 0 : seatOffset(a.room)); }
    else { p.x = a.x + ox; p.y = a.y + oy; p.facing = a.facing; }
    if (a.swim) p.swim = true;
    // the cook's arm reaches over the counter to the stove: drawn on top in the front view only
    if (a.armOver && !(((rot || 0) % 4 + 4) % 4)) p.armOver = a.armOver;
    if (spec.pct != null) p.opacity = opacityOf(spec.pct);
    return p;
  }
  // how solid a guess is drawn: the certainty itself, but never quite invisible
  const opacityOf = pct => Math.max(0.1, Math.min(1, pct / 100));

  /* ── building the house ─────────────────────────────────────────────── */
  const ORDER = ['kitchen', 'living', 'bedroom', 'bathroom', 'study', 'garden'];
  const seatOffset = room => { let n = 0; for (const k of ORDER) { if (k === room) return n; n += ROOMS[k].furniture.length; } return n; };
  const shiftF = (f, ox, oy) => {
    const g = JSON.parse(JSON.stringify(f));
    if (g.edge) { g.edge.r += oy; g.edge.c += ox; } else { g.x += ox; g.y += oy; }
    return g;
  };
  const WALL = { m: 'drywall', p: 'drywall' };
  function perimeter(x0, y0, w, h, put, type) {
    for (let c = x0; c < x0 + w; c++) { put('h', y0, c, type); put('h', y0 + h, c, type); }
    for (let r = y0; r < y0 + h; r++) { put('v', r, x0, type); put('v', r, x0 + w, type); }
  }
  function build(rooms, local, bo) {
    bo = bo || {};
    const edges = new Map(), fl = { level: 0, edges: [], floorStyles: [], furniture: [], appliances: [], stairs: [], pools: [] };
    let cols = COLS, rows = ROWS;
    if (local) { cols = Math.max(3, ROOMS[rooms[0]].at[2]); rows = Math.max(3, ROOMS[rooms[0]].at[3]); }   // the engine needs at least 3 × 3
    const put = (o, r, c, type) => {
      const k = o + ':' + r + ':' + c, old = edges.get(k);
      if (old && old.type !== 'fence' && type === 'fence') return;   // a house wall beats a garden fence
      edges.set(k, { o, r, c, type, sides: type === 'fence' ? undefined : WALL });
    };
    rooms.forEach(id => { const R = ROOMS[id], [x, y, w, h] = local ? [0, 0, R.at[2], R.at[3]] : R.at; if (!R.garden) perimeter(x, y, w, h, put, 'wall'); });
    rooms.forEach(id => { const R = ROOMS[id], [x, y, w, h] = local ? [0, 0, R.at[2], R.at[3]] : R.at; if (R.garden) perimeter(x, y, w, h, put, 'fence'); });
    rooms.forEach(id => {
      const R = ROOMS[id], [ox, oy] = local ? [0, 0] : R.at;
      (R.openings || []).forEach(([o, r, c, type]) => {
        const k = o + ':' + (r + oy) + ':' + (c + ox);
        if (!edges.has(k)) return;
        if (local && type === 'door' && !bo.doors) return;   // a room on its own: no open doors in the way
        const e = { o, r: r + oy, c: c + ox, type, sides: WALL };
        if (type === 'door') { e.swing = 0; if (bo.closed) e.closed = true; }
        edges.set(k, e);
      });
      if (R.floor) for (let r = 0; r < R.at[3]; r++) for (let c = 0; c < R.at[2]; c++) fl.floorStyles.push({ r: r + oy, c: c + ox, style: R.floor });
      R.furniture.forEach(f => fl.furniture.push(shiftF(f, ox, oy)));
      R.appliances.forEach(a => fl.appliances.push(shiftF(a, ox, oy)));
      (R.pools || []).forEach(q => fl.pools.push({ x0: q.x0 + ox, y0: q.y0 + oy, x1: q.x1 + ox, y1: q.y1 + oy }));
    });
    fl.edges = [...edges.values()];
    return { app: 'house-builder', version: 12, cols, rows, floors: [fl] };
  }
  const cache = {};
  const roomHouse = (id, o) => { o = o || {}; const k = id + (o.doors ? (o.closed ? ':shut' : ':open') : '');
    return cache[k] || (cache[k] = build([id], true, o)); };
  const wholeHouse = () => cache._all || (cache._all = build(ORDER, false));

  /* Things left lying around (opts.items): one piece of someone's clothing, from the family's
     own wardrobe, through house-character-3d.js's loose garments.
       { garment: 'footwear' | 'upper' | 'lower' | 'watch' | 'glasses' | …, who: 'juan',
         wear: { footwear: 'boots', … }   (what it is, if not what they usually wear),
         x, y (room metres) or on: furniture number in the room, at: [u, v],
         facing, angle, which, scale, pct }                                              */
  function thing(it, local) {
    const who = CAST[it.who]; if (!who) return null;
    const R = ROOMS[it.room], [ox, oy] = local || !R ? [0, 0] : R.at;
    const t = Object.assign({}, it, { character: Object.assign(JSON.parse(JSON.stringify(who.c)), it.wear || {}) });
    if (it.on != null) t.on = it.on + (local || !R ? 0 : seatOffset(it.room)); else { t.x = (it.x || 0) + ox; t.y = (it.y || 0) + oy; }
    if (it.pct != null) t.opacity = opacityOf(it.pct);
    delete t.who; delete t.wear; delete t.room; delete t.pct;
    return t;
  }
  function scene(room, people, opts) {
    opts = Object.assign({ rot: 0, walls: 'cutout', line: 0.7 }, opts || {});
    const list = (people || []).map(p => person(p, true, opts.rot)).filter(Boolean)
      .concat((opts.items || []).map(it => thing(it, true)).filter(Boolean));
    return H3.svg(roomHouse(room, opts), list, Object.assign({ alt: altOf(people, ROOMS[room].word) }, opts));
  }
  // where each room's name is written on the floor of the whole-house picture (house metres)
  const LABEL_AT = { kitchen: [1.3, 1.05], living: [4.5, 1.6], bedroom: [7.6, 2.75], bathroom: [2.3, 3.6], study: [2.2, 6.65], garden: [7.8, 4.2] };
  function house(people, opts) {
    opts = Object.assign({ rot: 0, walls: 'cutout', line: 0.6 }, opts || {});
    if (opts.labels === true) opts.labels = ORDER.map(k => ({ x: LABEL_AT[k][0], y: LABEL_AT[k][1], text: ROOMS[k].word.replace(/^the /, '') }));
    const list = (people || []).map(p => person(p, false, opts.rot)).filter(Boolean);
    return H3.svg(wholeHouse(), list, Object.assign({ alt: altOf(people, 'the house and backyard') }, opts));
  }
  function altOf(people, where) {
    const bits = (people || []).filter(p => CAST[p.who] && ACTS[p.act]).map(p => CAST[p.who].name + ' ' + ACTS[p.act].ing + (p.pct != null ? ' (' + p.pct + '%)' : ''));
    return bits.length ? bits.join(', ') + ' — ' + where : where;
  }

  /* ── the thought bubble ────────────────────────────────────────────── */
  const STYLE_ID = 'deduction-house-styles';
  const CSS = `
.dh-think{ position:relative; margin:12px 0 4px; padding-top:14px; width:fit-content; max-width:100%; }
.dh-think.right{ margin-left:auto; }
.dh-think::before, .dh-think::after{ content:''; position:absolute; border-radius:50%; background:var(--surface-2); border:1.5px solid var(--color-border-primary); }
.dh-think::before{ width:13px; height:13px; top:0; left:22px; }
.dh-think::after{ width:8px; height:8px; top:-9px; left:14px; }
.dh-think.right::before{ left:auto; right:22px; } .dh-think.right::after{ left:auto; right:14px; }
.dh-cloud{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; padding:9px; border-radius:26px;
  background:var(--surface-2); border:1.5px solid var(--color-border-primary); box-shadow:0 2px 10px rgba(0,0,0,.07); }
.dh-panel{ position:relative; flex:0 1 220px; width:220px; min-width:0; }
.dh-panel .house-pic{ border-radius:16px; }
.dh-pct{ position:absolute; top:6px; right:6px; font-family:var(--font-mono); font-size:.8667rem; font-weight:700; line-height:1;
  padding:4px 8px; border-radius:999px; color:#fff; background:var(--dh-c); box-shadow:0 1px 4px rgba(0,0,0,.25); }
.dh-cap{ display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px; font-size:.8rem; font-weight:600; color:var(--text-secondary); text-align:center; line-height:1.3; }
.dh-bar{ height:5px; border-radius:3px; background:var(--color-border-secondary); overflow:hidden; margin:4px 10px 0; }
.dh-bar i{ display:block; height:100%; background:var(--dh-c); }
.dh-meter{ background:var(--surface-1); border:1px solid var(--border); border-radius:var(--radius); padding:12px 12px 8px; margin-bottom:1rem; }
.dh-scale{ display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:6px; }
.dh-step{ display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center; min-width:0; }
.dh-step .house-pic{ border-radius:12px; }
.dh-step b{ font-family:var(--font-mono); font-size:.9333rem; color:var(--dh-c); }
.dh-words{ font-size:.8rem; line-height:1.35; color:var(--text-primary); font-weight:600; }
.dh-words span{ display:block; font-weight:400; color:var(--text-secondary); font-size:.7333rem; }
.dh-ramp{ height:8px; border-radius:4px; margin:8px 2px 4px; background:linear-gradient(90deg, hsl(120deg 60% 36%), hsl(60deg 75% 42%), hsl(0deg 75% 45%)); }
.dh-ramp-l{ display:flex; justify-content:space-between; font-size:.7333rem; color:var(--text-muted); }
.dh-split .dh-cloud{ flex-wrap:nowrap; align-items:stretch; gap:6px; }
.dh-side{ display:flex; flex-direction:column; align-items:center; gap:5px; border-radius:20px; padding:6px; min-width:0; }
.dh-was{ background:rgba(160,120,60,.12); }
.dh-was .house-pic{ filter:sepia(.9) saturate(.7) contrast(.96); }
.dh-panels{ display:flex; gap:6px; justify-content:center; }
.dh-split .dh-panel{ flex:0 1 190px; width:190px; }
.dh-think.dh-many{ width:100%; }
.dh-many .dh-cloud{ width:100%; }
.dh-many .dh-was{ flex:2 1 0; } .dh-many .dh-is{ flex:1 1 0; }
.dh-many .dh-panel{ flex:1 1 0; width:auto; min-width:0; }
.dh-when{ font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); }
.dh-arrow{ display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); flex:0 0 auto; }
.dh-arr{ font-size:1.8rem; line-height:1; }
.dh-arrow small{ font-size:.6667rem; white-space:nowrap; }
@media (max-width:640px){ .dh-split .dh-cloud{ flex-direction:column; align-items:center; } .dh-arr{ transform:rotate(90deg); } .dh-split .dh-panel{ width:170px; flex-basis:170px; }
  .dh-many .dh-was, .dh-many .dh-is{ flex:none; width:100%; } .dh-many .dh-panel{ flex:1 1 0; width:auto; } .dh-many .dh-is .dh-panel{ max-width:200px; } }
@media (max-width:520px){ .dh-scale{ grid-template-columns:repeat(3, minmax(0,1fr)); } .dh-panel{ flex-basis:150px; width:150px; } }
`;
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
  }
  // the certainty colour runs red (0 %) → amber → green (100 %), like the gap-fill bars
  const colourOf = pct => `hsl(${Math.round(pct * 1.2)}deg 70% 38%)`;

  function panel(p, opts) {
    const a = ACTS[p.act] || {}, cap = p.cap != null ? p.cap : ((a.emoji ? a.emoji + ' ' : '') + a.ing);
    return `<div class="dh-panel" style="--dh-c:${colourOf(p.pct)}">${scene(a.room, [p], Object.assign({ doors: a.doors }, opts))}`
      + `<span class="dh-pct">${p.pct}%</span><div class="dh-cap">${cap}</div><div class="dh-bar"><i style="width:${p.pct}%"></i></div></div>`;
  }
  function bubble(panels, opts) {
    injectStyles();
    opts = opts || {};
    const pics = { rot: opts.rot != null ? opts.rot : 0, aspect: 4 / 3, around: opts.around != null ? opts.around : 1.1 };
    return `<div class="dh-think${opts.side === 'right' ? ' right' : ''}" aria-label="${opts.label || 'What the speaker thinks'}"><div class="dh-cloud">`
      + panels.map(p => panel(p, Object.assign({}, pics, p.opts))).join('') + '</div></div>';
  }

  /* Things people leave behind — the evidence for deductions about the past. Each is a
     "now" for pastBubble (a room, what is lying in it, a caption). */
  const EVIDENCE = {
    watch:     { room: 'kitchen', cap: '⌚ Dad’s watch on the counter', around: 0.4,
                 items: [{ garment: 'watch', who: 'juan', on: 0, at: [0.38, 0.05], scale: 5 }] },
    shorts:    { room: 'bedroom', cap: '🩳 wet swim shorts on the floor', around: 0.7,
                 items: [{ garment: 'lower', who: 'lucas', wear: { lowerGarment: 'swimshorts', lowerColor: '#FF6600' }, x: 2.6, y: 1.75, angle: 25, scale: 1.4 }] },
    boots:     { room: 'study', cap: '🥾 Grandma’s gardening boots — clean and dry', around: 0.6,
                 items: [{ garment: 'footwear', who: 'rosa', wear: { footwear: 'boots', footwearColor: '#336633' }, x: 2.55, y: 0.45, facing: 'W', scale: 1.4 }] },
    backdoor:  { room: 'study', cap: '🚪 the back door is open', doors: true, around: 0.8, opts: { rot: 3, aroundAt: [[2.75, 1.5]] } },
    glasses:   { room: 'study', cap: '👓 Grandma’s glasses on the desk', around: 0.6,
                 items: [{ garment: 'glasses', who: 'rosa', wear: { eyewear: 'glasses' }, on: 1, at: [-0.35, 0.1], scale: 3 }] },
    jacket:    { room: 'bedroom', cap: '🧥 Dad’s work jacket on the bed', around: 0.9,
                 items: [{ garment: 'upper', who: 'juan', wear: { upperGarment: 'jacket', upperColor: '#333333' }, on: 0, at: [0.1, 0.3], angle: -10 }] },
    dress:     { room: 'bedroom', cap: '👗 Mom’s party dress on the bed', around: 0.9,
                 items: [{ garment: 'upper', who: 'julia', wear: { upperGarment: 'dress', upperColor: '#6600CC' }, on: 0, at: [0.15, 0.25], angle: 12 },
                         { garment: 'footwear', who: 'julia', wear: { footwear: 'heels', footwearColor: '#CC0000' }, x: 2.5, y: 2.65, facing: 'SW', scale: 1.5 }] },
    sneakers:  { room: 'study', cap: '👟 Lucas’s sneakers by the back door', around: 0.6,
                 items: [{ garment: 'footwear', who: 'lucas', x: 2.55, y: 0.45, facing: 'W', scale: 1.5 }] }
  };

  /* A thought about the past (past modals of deduction): on the left, in sepia, what the
     speaker thinks happened, with how sure they are (one picture per guess); an arrow for the
     time in between; on the right, in full colour, what they can see now — the evidence.
       pastBubble({ past: [{ who, act, pct, cap? }],
                    now:  { room, items: [loose things], cap, doors, closed, people } }, { side }) */
  function pastBubble(spec, opts) {
    injectStyles();
    opts = opts || {};
    const pics = { rot: 0, aspect: 4 / 3, around: 1.1 }, n = typeof spec.now === 'string' ? EVIDENCE[spec.now] : (spec.now || {});
    const past = (spec.past || []).map(p => panel(p, Object.assign({}, pics, p.opts))).join('');
    const nowOpts = Object.assign({}, pics, { items: n.items, doors: n.doors, closed: n.closed, around: n.around !== undefined ? n.around : 0.9 }, n.opts);
    if (nowOpts.around == null) delete nowOpts.around;
    const now = `<div class="dh-panel dh-now">${scene(n.room, n.people || [], nowOpts)}<div class="dh-cap">${n.cap || ''}</div></div>`;
    return `<div class="dh-think dh-split${(spec.past || []).length > 1 ? ' dh-many' : ''}${opts.side === 'right' ? ' right' : ''}" aria-label="${opts.label || 'What the speaker thinks happened'}"><div class="dh-cloud">`
      + `<div class="dh-side dh-was"><span class="dh-when">⏪ before</span><div class="dh-panels">${past}</div></div>`
      + `<div class="dh-arrow" aria-hidden="true"><span class="dh-arr">⟶</span><small>time passes</small></div>`
      + `<div class="dh-side dh-is"><span class="dh-when">👀 now</span>${now}</div></div></div>`;
  }

  /* The scale on the clarification page: the same guess drawn at five levels of certainty. */
  const LEVELS = [
    { pct: 100, words: 'is definitely / certainly', note: 'I saw it' },
    { pct: 95, words: 'must be', note: 'I’m sure — I have a reason' },
    { pct: 75, words: 'is probably', note: 'I think so' },
    { pct: 40, words: 'might / may / could be', note: 'maybe · perhaps · possibly' },
    { pct: 0, words: 'can’t be / definitely isn’t', note: 'I’m sure it’s not true' }
  ];
  function meter(spec) {
    injectStyles();
    spec = spec || { who: 'juan', act: 'swimming' };
    return '<div class="dh-meter"><div class="dh-scale">' + LEVELS.map(l =>
      `<div class="dh-step" style="--dh-c:${colourOf(l.pct)}">${scene(ACTS[spec.act].room, [{ who: spec.who, act: spec.act, pct: l.pct }], { aspect: 1, around: 0.9 })}`
      + `<b>${l.pct}%</b><div class="dh-words">${l.words}<span>${l.note}</span></div></div>`).join('')
      + '</div><div class="dh-ramp"></div><div class="dh-ramp-l"><span>sure it’s true</span><span>sure it’s not true</span></div></div>';
  }

  global.DeductionHouse = { ROOMS, CAST, ACTS, LEVELS, EVIDENCE, scene, house, bubble, pastBubble, meter, colourOf, opacityOf, injectStyles,
    houseData: wholeHouse, roomData: roomHouse };
})(typeof window !== 'undefined' ? window : globalThis);

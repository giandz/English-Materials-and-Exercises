/* ═══════════════════════════════════════════════════════════════════════════
   StickSentence — sentences with stick figures standing on top of the words
   they stand for. Needs stick-character.js loaded first.

     StickSentence.cast({ mia:{ base:'woman', colour:'#6600CC' }, ... });
     el.innerHTML = StickSentence.html('{[I/subject]|mia} [went/verb] to {my grandparents’|grandpa,grandma} house.');

   Markup
     {words|fig,fig,...}   the words, with one figure per item centred over them as a group
     [word/pos]            part-of-speech span (house grammar colours), anywhere
   A figure is a cast name or a preset (man, woman, boy, girl, grandpa, grandma),
   then optional modifiers after colons:
     say                   a speech bubble with dots (the person is talking)
     happy, sad, tired …   a feeling in the bubble (any StickCharacter emotion)
     me                    the front hand points at the figure's own head (added on its own over "I")
     arrow / selector      an arrow (or triangle) pointing down at the figure
     left / right          which way the figure faces (figures right after "told" or "asked" face left
                           on their own, toward the speaker)
     waving, sitting …     a pose (any StickCharacter pose)
     phone, cup, book …    a thing in the front hand (any StickCharacter item)
     red, blue, …          the figure's colour (from the StickCharacter palette)

   Size: one head (a circle) is as tall as a capital O — about 0.72em — so an
   adult is 3.5 × that, and the figures scale with the 🔎 text-size slider.
   Figures keep at least a quarter head apart; when several speak at once their bubbles go outward
   (and straight up, alternately low and high, for the ones in the middle).
   Black figures are drawn in currentColor, so they follow the light/dark theme.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SC = window.StickCharacter;
const HEAD_EM = 0.72;                 /* a head across = a capital O */
const K = HEAD_EM / SC.H;             /* em per drawing unit */

const PRESETS = {
  man:     {},
  woman:   { headwear:'longhair', skirt:true },
  boy:     { age:'child', headwear:'cap' },
  girl:    { age:'child', headwear:'pigtails', skirt:true },
  grandpa: { hunchback:true, headwear:'strawhat', hatAngle:-55, held:{ front:'cane' } },
  grandma: { hunchback:true, headwear:'bun', hatAngle:-15, skirt:true, held:{ front:'cane' } }
};
const COLOURS = {}; SC.PALETTE.forEach(c => { COLOURS[SC.colourName(c)] = c; });
let CAST = {};

function cast(map){ CAST = Object.assign({}, CAST, map || {}); return CAST; }

function figData(spec){
  const parts = spec.trim().split(':').map(s => s.trim()).filter(Boolean);
  const name = parts.shift() || 'man';
  const c = CAST[name] || {};
  const base = PRESETS[c.base || name] || PRESETS[name] || {};
  const src = JSON.parse(JSON.stringify(Object.assign({}, base, c)));
  src.name = c.label || name;
  const d = SC.normalize(src);
  let me = false;
  parts.forEach(m => {
    if (m === 'say') { d.emotion = 'dots'; return; }
    if (m === 'arrow' || m === 'selector') { d.arrow = m; return; }
    if (m === 'left' || m === 'right') { d.facing = m; return; }
    if (m in SC.EMOTIONS) { d.emotion = m; return; }
    if (SC.POSES[m]) { const keep = d.held; SC.applyPose(d, m); d.held = keep; return; }
    if (SC.ITEMS[m]) { d.held.back = d.held.front; d.held.front = m; return; }
    if (COLOURS[m]) { d.colour = COLOURS[m]; return; }
    if (m === 'me') me = true;
  });
  /* what the front hand holds sets the arm: phones and tablets up beside the head, a book upright at arm's length,
     anything else (a cup …) raised to chest height */
  const HOLD = { phone:{ shoulderF:100, elbowF:70 }, tablet:{ shoulderF:100, elbowF:70 },
                 book:{ shoulderF:90, elbowF:0 }, cane:null };
  const it = d.held.front;
  if (it && !me) { const j = it in HOLD ? HOLD[it] : { shoulderF:50, elbowF:70 }; if (j) Object.assign(d.joints, j);
    if (it === 'book') d.grip.front = 90; }   /* the book turned upright in the hand, its pages facing the reader */
  if (me) {   /* "I": the front hand points at the figure's own head; anything held moves to the other hand */
    if (d.held.front) { d.held.back = d.held.front; d.held.front = null; }
    Object.assign(d.joints, { shoulderF:90, elbowF:87 });
    /* … and the other arm lifts it the same way the front arm would have */
    const ib = d.held.back;
    if (ib) { const j = ib in HOLD ? HOLD[ib] : { shoulderF:50, elbowF:70 };
      if (j) Object.assign(d.joints, { shoulderB:j.shoulderF, elbowB:j.elbowF });
      if (ib === 'book') d.grip.back = 90; }
  }
  /* an arrow and a speech bubble together: push the bubble forward, clear of the arrow */
  if (d.arrow && d.emotion) d.bubbleX = Math.round(0.8 * SC.H);
  return d;
}

/* ── layout ────────────────────────────────────────────────────────────────
   Every figure is measured as a set of boxes (in the 320-wide stage units of stick-character.js):
   its body, its speech bubble, the bubble's tail and its arrow. Figures in a group are then placed
   left to right, each as close as it can go while every box keeps a quarter head clear of the
   boxes of the figures before it (boxes that sit at different heights don't push each other).
   Speech bubbles, when two or more figures in a group speak at once:
     · two figures: each bubble goes outward (left one to the left, right one to the right)
     · three or more: the leftmost and rightmost go outward, the ones in the middle go straight up,
       alternately low and high, so neighbours' bubbles stack instead of pushing the figures apart
   A bubble that would touch its own figure's arrow is lifted clear of it.               */
const GAP = 0.25 * SC.H, HS = SC.H, ST = SC.STAGE;
const num = v => Math.round(v * 100) / 100;
const hit = (a, b) => a[0] < b[2] + GAP && b[0] < a[2] + GAP && a[1] < b[3] + GAP && b[1] < a[3] + GAP;
const vhit = (a, b) => a[1] < b[3] + GAP && b[1] < a[3] + GAP;

function headX(d){ const k = SC.skeleton(d); return ST.cx + (d.facing === 'left' ? -1 : 1) * k.head[0]; }

/* the body's box: drawn without bubble or arrow, the fitted viewBox minus its padding */
function bodyBox(d){
  const plain = SC.normalize(JSON.parse(JSON.stringify(d))); plain.emotion = null; plain.arrow = null;
  const vb = SC.render(plain, { fit:true }).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const S2 = HS / 8, turning = ['front', 'back'].some(h => d.held[h] && !SC.ITEMS[d.held[h]].upright) ? 0.4 * HS : 0;
  return [vb[0] + 0.9 * HS - S2 - turning, vb[1] + 1.9 * HS - S2, vb[0] + vb[2] - 0.9 * HS + S2 + turning, ST.ground + HS / 4];
}
function bubbleOf(svg){
  const m = svg.match(/class="stick-bubble"[^>]*><ellipse cx="([-\d.]+)" cy="([-\d.]+)" rx="([-\d.]+)" ry="([-\d.]+)"/);
  if (!m) return null; const [cx, cy, rx, ry] = m.slice(1).map(Number), e = HS / 8;
  return { cx, cy, box:[cx - rx - e, cy - ry - e, cx + rx + e, cy + ry + e] };
}
function arrowOf(svg){
  let m = svg.match(/data-arrow="1" d="M([-\d.]+),([-\d.]+)V([-\d.]+)/);
  if (m) { const x = +m[1]; return [x - 0.75 * HS, +m[2] - HS / 8, x + 0.75 * HS, +m[3] + HS / 8]; }
  m = svg.match(/data-arrow="1" d="M([-\d.]+),([-\d.]+)H([-\d.]+)L([-\d.]+),([-\d.]+)Z/);
  if (m) return [+m[1] - HS / 8, +m[2] - HS / 8, +m[3] + HS / 8, +m[5] + HS / 8];
  return null;
}

/* draw one figure with its bubble where `want` says: {dir:-1|0|1 (left, straight up, right), high:bool} or null (default) */
function place(d, want){
  const f = d.facing === 'left' ? -1 : 1, hx = headX(d);
  let svg = SC.render(d, { fit:true }), bub = bubbleOf(svg);
  if (bub && want) {
    const reachOut = (d.arrow ? 0.75 * HS + GAP : 0.1 * HS) + 1.5 * HS;
    const target = hx + want.dir * reachOut;
    for (let i = 0; i < 2 && Math.abs(bub.cx - target) > 1; i++) {   /* the engine may put the bubble behind a raised hand: measure and correct */
      d.bubbleX = Math.round(d.bubbleX + (target - bub.cx) * f);
      svg = SC.render(d, { fit:true }); bub = bubbleOf(svg);
    }
  }
  const arrow = arrowOf(svg);
  let dy = 0;
  if (bub && arrow && hit(bub.box, arrow)) dy = Math.min(dy, arrow[1] - GAP - bub.box[3]);
  if (bub && want && want.high) dy -= bub.box[3] - bub.box[1] + GAP;
  const boxes = [bodyBox(d)];
  if (arrow) boxes.push(arrow);
  if (bub) {
    const b = bub.box;
    boxes.push([b[0], b[1] + dy, b[2], b[3] + dy]);
    if (dy < 0) {   /* lifted bubble: the tail is stretched so it still reaches the head; it takes space too */
      boxes.push([bub.cx - 0.3 * HS, b[3] + dy, bub.cx + 0.3 * HS, b[3]]);
      const at = svg.indexOf('class="stick-bubble"');
      const head = svg.slice(0, at), tail = svg.slice(at)
        .replace('class="stick-bubble" data-bubble="1"', 'class="stick-bubble" data-bubble="1" transform="translate(0 ' + num(dy) + ')"')
        .replace(/L([-\d.]+),([-\d.]+)Z"/, (m0, x, y) => 'L' + x + ',' + num(+y - dy) + 'Z"');
      svg = head + tail;
    }
  }
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/#222222/gi, 'currentColor');
  return { inner, boxes, body:boxes[0], label:(svg.match(/aria-label="([^"]*)"/) || [])[1] || '' };
}

const isSpeaking = d => !!d.emotion;
function figs(specs, opts){
  opts = opts || {};
  const data = specs.split(',').map(figData), n = data.length;
  const talkers = data.filter(isSpeaking).length;
  let middle = 0;
  const parts = data.map((d, i) => {
    let want = null;
    if (talkers > 1 && isSpeaking(d)) {
      if (i === 0) want = { dir:-1 };
      else if (i === n - 1) want = { dir:1 };
      else want = { dir:0, high:(middle++) % 2 === 1 };
    }
    return place(d, want);
  });
  /* place left to right: as close as possible with a quarter head between any two boxes at the same height */
  const xs = [0];
  for (let j = 1; j < n; j++) {
    let x = -Infinity;
    for (let i = 0; i < j; i++) for (const a of parts[i].boxes) for (const b of parts[j].boxes)
      if (vhit(a, b)) x = Math.max(x, xs[i] + a[2] + GAP - b[0]);
    xs.push(x === -Infinity ? xs[j - 1] : x);
  }
  const all = parts.flatMap((p, i) => p.boxes.map(b => [b[0] + xs[i], b[1], b[2] + xs[i], b[3]]));
  /* standing on the word after a possessive ("my sister"): an arrow at head height points back to the owner on the left.
     The arrow is the one from stick-character.js (a shaft with two legs, 1.5 heads wide, 2 heads long), turned to point left */
  let back = '';
  if (opts.backArrow) {
    const half = 0.75 * HS, len = 2 * HS, cy = parts[0].body[1] + 0.6 * HS;
    const row = [-Infinity, cy - half, Infinity, cy + half];
    const lefts = parts[0].boxes.filter(bx => vhit(bx, row)).map(bx => bx[0]);
    const tip = Math.min(...lefts) - GAP - len;
    const i = HS / 8, w = half - i, hh = 0.95 * HS, col = data[0].colour === '#222222' ? 'currentColor' : data[0].colour;
    back = '<g transform="translate(' + num(tip) + ' ' + num(cy) + ') rotate(90)">' +
      '<path d="M0,' + num(-len + i) + 'V' + num(-i) + 'M' + num(-w) + ',' + num(-hh) + 'L0,' + num(-i) + 'L' + num(w) + ',' + num(-hh) +
      '" fill="none" stroke="' + col + '" stroke-width="' + num(HS / 4) + '" stroke-linecap="round" stroke-linejoin="round"/></g>';
    all.push([tip, cy - half, tip + len, cy + half]);
  }
  const bodies = parts.map((p, i) => [p.body[0] + xs[i], p.body[2] + xs[i]]);
  const mid = (Math.min(...bodies.map(b => b[0])) + Math.max(...bodies.map(b => b[1]))) / 2;
  const reach = Math.max(mid - Math.min(...all.map(b => b[0])), Math.max(...all.map(b => b[2])) - mid) + GAP / 2;
  const top = Math.min(...all.map(b => b[1])) - HS / 8, bottom = ST.ground + HS / 4;
  const vb = [num(mid - reach), num(top), num(2 * reach), num(bottom - top)];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" overflow="visible">' +
    parts.map((p, i) => '<g transform="translate(' + num(xs[i]) + ' 0)">' + p.inner + '</g>').join('') + back + '</svg>';
  return '<span class="ss-figs" role="img" aria-label="' + parts.map(p => p.label).join(' ') + '" style="width:' +
    (vb[2] * K).toFixed(3) + 'em;height:' + (vb[3] * K).toFixed(3) + 'em">' + svg + '</span>';
}

/* one figure on its own (kept for pages that draw a single figure) */
function figure(spec){ return figs(spec); }

const pos = s => s.replace(/\[([^\/\]]+)\/(\w+)\]/g, '<span class="pos-hl pos-$2">$1</span>');

/* the word before decides: after a possessive adjective the figures get an arrow back to its owner */
const POSSESSIVE = /^(my|your|his|her|our|their)$/;

function html(markup){
  const out = [];
  const re = /\{([^|}]+)\|([^}]+)\}([^\s\[{]*)|((?:\[[^\]]+\]|[^\s\[{]+)+)/g;
  let m, prev = '';
  while ((m = re.exec(markup))) {
    if (m[4]) { out.push('<span class="ss-unit"><span class="ss-txt">' + pos(m[4]) + '</span></span>'); prev = text(m[4]).toLowerCase(); continue; }
    /* after "told" or "asked", the listeners turn to face the speaker */
    if (prev === 'told' || prev === 'asked') m[2] = m[2].split(',').map(sp => /:(left|right)\b/.test(sp) ? sp : sp + ':left').join(',');
    /* a figure standing on "I" points at its own head */
    if (/^i$/i.test(text(m[1]).replace(/[^A-Za-z]/g, '')) && !m[2].includes(',')) m[2] += ':me';
    const backArrow = POSSESSIVE.test(prev);
    prev = /\/(object|subject)\]/.test(m[1]) ? '' : text(m[1]).toLowerCase().replace(/[^a-z]/g, '');   /* "her" tagged as an object is not a possessive */
    out.push('<span class="ss-unit ss-has">' + figs(m[2], { backArrow }) + '<span class="ss-txt">' + pos(m[1]) + m[3] + '</span></span>');
  }
  return '<span class="ss-line">' + out.join('') + '</span>';
}

/* plain text of a markup line (for the speech engine, aria labels, answer checks) */
function text(markup){
  return markup.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\[([^\/\]]+)\/\w+\]/g, '$1');
}

const CSS = ''
  + '.ss-line{ display:flex; flex-wrap:wrap; align-items:flex-end; column-gap:.3em; row-gap:.35em; }'
  + '.ss-unit{ display:inline-flex; flex-direction:column; align-items:center; }'
  + '.ss-txt{ white-space:nowrap; }'
  + '.ss-figs{ position:relative; display:block; flex:0 0 auto; margin-bottom:.1em; color:currentColor; }'
  + '.ss-figs svg{ display:block; width:100%; height:100%; overflow:visible; }'
  + '.ss-pic{ display:block; font-size:2.2em; line-height:1; margin-bottom:.1em; }'
  + '.ss-sticks-hidden .ss-figs, .ss-sticks-hidden .ss-pic{ display:none; }'
  + '.ss-stick-btn{ margin-right:6px; }';
if (!document.getElementById('stick-sentence-css')) {
  const st = document.createElement('style'); st.id = 'stick-sentence-css'; st.textContent = CSS;
  document.head.appendChild(st);
}

/* ── show / hide the stick figures (the same switch as present-perfect-kit.js, for pages without it) ──
   StickSentence.toggle()                 the figures start hidden; a "🧍 Show stick figures" button is added
   StickSentence.toggle({ shown:true })   the figures start visible
   Other pictures that stand for people or animals (an emoji in the cast row, say) hide with the figures:
   give them class="ss-pic" — e.g. <span class="ss-unit"><span class="ss-pic">🐶</span><span class="ss-txt">Max</span></span>.
   The button goes before the grammar toggle, or under the page's first subtitle. Opt-in: pages that
   don't call it are unchanged, and a page that already has a #stickToggle button keeps its own.   */
function toggle(opts){
  opts = opts || {};
  const root = document.documentElement, cls = 'ss-sticks-hidden';
  root.classList.toggle(cls, !opts.shown);
  const run = () => {
    if (document.getElementById('stickToggle')) return;
    const b = document.createElement('button');
    b.id = 'stickToggle'; b.className = 'grammar-toggle-btn ss-stick-btn'; b.type = 'button';
    const show = on => { root.classList.toggle(cls, !on); b.textContent = on ? '🧍 Hide stick figures' : '🧍 Show stick figures'; b.setAttribute('aria-pressed', String(on)); };
    b.addEventListener('click', () => show(root.classList.contains(cls)));
    show(!!opts.shown);
    const g = document.getElementById('grammarToggle');
    if (g) g.parentNode.insertBefore(b, g);
    else { const sub = document.querySelector('.page h1 ~ .subtitle') || document.querySelector('.page h1'); sub.insertAdjacentElement('afterend', b); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else setTimeout(run, 0);
}

window.StickSentence = { cast, html, text, figure, toggle, PRESETS, HEAD_EM };
})();

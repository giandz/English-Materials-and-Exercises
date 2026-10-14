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
     left / right          which way the figure faces (figures right after "told" face left
                           on their own, toward the speaker)
     waving, sitting …     a pose (any StickCharacter pose)
     phone, cup, book …    a thing in the front hand (any StickCharacter item)
     red, blue, …          the figure's colour (from the StickCharacter palette)

   Size: one head (a circle) is as tall as a capital O — about 0.72em — so an
   adult is 3.5 × that, and the figures scale with the 🔎 text-size slider.
   Two or more figures with speech bubbles in one group are spaced so the bubbles don't overlap.
   Black figures are drawn in currentColor, so they follow the light/dark theme.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const SC = window.StickCharacter;
const HEAD_EM = 0.72;                 /* a head across = a capital O */
const K = HEAD_EM / SC.H;             /* em per drawing unit */
const STEP = 1.7 * SC.H;              /* centre-to-centre in a group of figures */
const BODY = 1.6 * SC.H;              /* the width a plain figure needs */

const PRESETS = {
  man:     {},
  woman:   { headwear:'longhair', skirt:true },
  boy:     { age:'child', headwear:'cap' },
  girl:    { age:'child', headwear:'pigtails', skirt:true },
  grandpa: { hunchback:true, headwear:'strawhat', held:{ front:'cane' } },
  grandma: { hunchback:true, headwear:'bun', skirt:true, held:{ front:'cane' } }
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
  if (me) {   /* "I": the front hand points at the figure's own head; anything held moves to the other hand */
    if (d.held.front) { d.held.back = d.held.front; d.held.front = null; }
    Object.assign(d.joints, { shoulderF:90, elbowF:87 });
  }
  /* an arrow and a speech bubble together: push the bubble forward, clear of the arrow */
  if (d.arrow && d.emotion) d.bubbleX = Math.round(0.8 * SC.H);
  return d;
}

/* one figure: its svg, how big it is, and where its middle is (all in drawing units) */
function figure(spec){
  const d = figData(spec);
  let svg = SC.render(d, { fit:true });
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1].split(' ').map(Number);
  svg = svg.replace(/#222222/gi, 'currentColor');
  return { svg, x:vb[0], w:vb[2], h:vb[3], mid:SC.STAGE.cx - vb[0] };
}

function figs(specs){
  const list = specs.split(',').map(figure);
  /* two or more speech bubbles in one group: space the figures a bubble apart so they never overlap */
  const mods = specs.split(',').map(sp => sp.split(':').slice(1));
  const bubbles = mods.filter(ms => ms.some(m => m === 'say' || m in SC.EMOTIONS)).length;
  const arrows = mods.filter(ms => ms.includes('arrow') || ms.includes('selector')).length;
  const step = arrows > 1 && bubbles > 1 ? 4.7 * SC.H : bubbles > 1 ? 3.3 * SC.H : STEP;
  const centres = list.map((f, i) => i * step);
  /* how far the drawings reach left and right of the group's middle */
  const middle = centres[centres.length - 1] / 2;
  let reach = BODY / 2 + middle;
  list.forEach((f, i) => {
    const c = centres[i] - middle;
    reach = Math.max(reach, Math.abs(c - f.mid), Math.abs(c - f.mid + f.w));
  });
  const W = 2 * reach, Hh = Math.max(...list.map(f => f.h));
  const inner = list.map((f, i) => {
    const left = (reach + centres[i] - middle - f.mid) * K;
    return '<span class="ss-fig" style="left:' + left.toFixed(3) + 'em;width:' + (f.w * K).toFixed(3) +
      'em;height:' + (f.h * K).toFixed(3) + 'em">' + f.svg + '</span>';
  }).join('');
  return '<span class="ss-figs" aria-hidden="true" style="width:' + (W * K).toFixed(3) + 'em;height:' + (Hh * K).toFixed(3) + 'em">' + inner + '</span>';
}

const pos = s => s.replace(/\[([^\/\]]+)\/(\w+)\]/g, '<span class="pos-hl pos-$2">$1</span>');

function html(markup){
  const out = [];
  const re = /\{([^|}]+)\|([^}]+)\}([^\s\[{]*)|((?:\[[^\]]+\]|[^\s\[{]+)+)/g;
  let m, prev = '';
  while ((m = re.exec(markup))) {
    if (m[4]) { out.push('<span class="ss-unit"><span class="ss-txt">' + pos(m[4]) + '</span></span>'); prev = text(m[4]).toLowerCase(); continue; }
    /* after "told", the listeners turn to face the speaker */
    if (prev === 'told') m[2] = m[2].split(',').map(sp => /:(left|right)\b/.test(sp) ? sp : sp + ':left').join(',');
    /* a figure standing on "I" points at its own head */
    if (/^i$/i.test(text(m[1]).replace(/[^A-Za-z]/g, '')) && !m[2].includes(',')) m[2] += ':me';
    prev = '';
    out.push('<span class="ss-unit ss-has">' + figs(m[2]) + '<span class="ss-txt">' + pos(m[1]) + m[3] + '</span></span>');
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
  + '.ss-fig{ position:absolute; bottom:0; display:block; }'
  + '.ss-fig svg{ display:block; width:100%; height:100%; overflow:visible; }';
if (!document.getElementById('stick-sentence-css')) {
  const st = document.createElement('style'); st.id = 'stick-sentence-css'; st.textContent = CSS;
  document.head.appendChild(st);
}

window.StickSentence = { cast, html, text, figure, PRESETS, HEAD_EM };
})();
